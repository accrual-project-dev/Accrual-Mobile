import { useEffect, useRef, useCallback } from "react";
import { App } from "@capacitor/app";
import { format } from "date-fns";
import { AccrualInbox, type InboxDraft } from "../../plugins/accrualInbox";
import { getCaptureOwner } from "./captureOwner";
import {
  saveDraftBatch,
  resolveActiveDraftSpaceId,
  type DraftSourceType,
} from "../../lib/draftTransactionService";
import type { ParsedStatementItem } from "../../lib/statementParser";
import {
  parseBankNotification,
  isPromotionalOrSpamNotification,
} from "../../lib/bankNotificationParser";
import { parseSlipText } from "../../lib/slipParser";
import { classifySemanticCategory } from "../../lib/semanticClassifier";
import { getMerchantMemory } from "../../lib/merchantCategoryMemory";
import { showNativeLocalNotification, formatNotificationCurrency } from "../../lib/notifications";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useToast } from "../../contexts/ToastContext";
import { useSpace } from "../../contexts/SpaceContext";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import { useAddTransaction } from "../../hooks/useTransactions";

export function useInboxDrain() {
  const isDrainingRef = useRef(false);
  const { user } = useAuth();
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();
  const { activeSpaceId, activeSpace, defaultSpaceId } = useSpace();
  const { data: categories = [] } = useCategories();
  const { data: wallets = [] } = useWallets();
  const addTxMutation = useAddTransaction();

  const drainInbox = useCallback(async () => {
    if (isDrainingRef.current) return;
    isDrainingRef.current = true;

    const ownerId = getCaptureOwner(user?.id) || user?.id || "guest_local_user";

    try {
      // Ensure the iOS App Group always knows the active ownerId so native AppIntents never fail
      if (typeof AccrualInbox.setOwner === "function") {
        await AccrualInbox.setOwner({ ownerId }).catch(() => {});
      }

      const res = await AccrualInbox.drain({ ownerId });
      const items: InboxDraft[] = res?.items || [];
      if (!items.length) return;

      const targetSpaceId = resolveActiveDraftSpaceId(
        activeSpaceId !== "all" ? activeSpaceId : defaultSpaceId,
      );
      const targetSpaceName =
        activeSpace?.id !== "all" && activeSpace?.name
          ? activeSpace.name
          : isIndonesian
          ? "Space Pribadi"
          : "Personal Space";

      const allIds = items.map((i) => i.id);
      const validStatementItems: ParsedStatementItem[] = [];
      let directRecordedCount = 0;
      let lastDirectRecordedInfo: {
        amount: number;
        categoryName: string;
        walletName: string;
        note: string;
        dateLabel: string;
      } | null = null;

      for (const item of items) {
        const rawText = (item.raw_text || "").trim();

        const parsedDate = new Date(item.transaction_date || item.captured_at);
        const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
        const dateStr = format(validDate, "yyyy-MM-dd");
        const timeStr = format(validDate, "HH:mm");
        const fullLocalOccurredOn = format(validDate, "yyyy-MM-dd'T'HH:mm:ss");

        // ── FAST PATH: DIALOG GLASS -> Directly record into Transactions (skip Review/Draft) ──
        if (item.source === "glass_dialog") {
          const directAmount = Math.abs(Number(item.amount || 0));
          if (directAmount <= 0) continue;

          // Match category by name from item.title
          const catHint = (item.title || "").trim().toLowerCase();
          const matchedCat =
            (catHint
              ? categories.find(
                  (c) =>
                    c.name.trim().toLowerCase() === catHint ||
                    c.name.trim().toLowerCase().includes(catHint) ||
                    catHint.includes(c.name.trim().toLowerCase()),
                )
              : undefined) ||
            categories.find((c) => c.type !== "income") ||
            categories[0];

          // Match wallet/account by name from item.source_app or item.wallet_hint
          const walHint = (item.source_app || item.wallet_hint || "").trim().toLowerCase();
          const matchedWal =
            (walHint
              ? wallets.find(
                  (w) =>
                    w.name.trim().toLowerCase() === walHint ||
                    w.name.trim().toLowerCase().includes(walHint) ||
                    walHint.includes(w.name.trim().toLowerCase()),
                )
              : undefined) || wallets[0];

          // Clean note: ONLY use what the user explicitly typed in Note. If empty, keep null!
          const explicitNote = (item.subtitle ?? item.raw_text ?? "").trim();

          await addTxMutation.mutateAsync({
            id: item.id,
            amount: directAmount,
            type: matchedCat?.type === "income" ? "income" : "expense",
            category_id: matchedCat?.id || null,
            wallet_id: matchedWal?.id || null,
            to_wallet_id: null,
            note: explicitNote.length > 0 ? explicitNote : null,
            occurred_on: fullLocalOccurredOn,
            created_at: validDate.toISOString(),
            ledger_id: targetSpaceId,
            space_id: targetSpaceId === "personal" ? null : targetSpaceId,
          });

          directRecordedCount += 1;
          lastDirectRecordedInfo = {
            amount: directAmount,
            categoryName:
              matchedCat?.name || (isIndonesian ? "Pengeluaran" : "Expense"),
            walletName: matchedWal?.name || "Cash",
            note: explicitNote,
            dateLabel: `${format(validDate, "d MMM yyyy")}, ${timeStr}`,
          };
          continue;
        }

        // 1. If from notification channel, enforce 3-Layer Promo/OTP/Spam Blocker
        if (
          item.source === "shortcut_notification" &&
          isPromotionalOrSpamNotification(rawText, item.merchant || item.title)
        ) {
          continue;
        }

        // 2. Try intelligent enrichment via Bank Notification Parser or Slip Parser
        let resolvedAmount = Math.abs(Number(item.amount || 0));
        let resolvedType: "income" | "expense" | "transfer" =
          item.direction === "income" ? "income" : "expense";
        let resolvedDesc = (item.merchant || item.subtitle || "").trim();
        let resolvedWalletId: string | null = null;
        let resolvedWalletName: string | undefined =
          item.wallet_hint || item.source_app || undefined;
        let resolvedToWalletId: string | null = null;
        let resolvedToWalletName: string | undefined;
        let resolvedCatId: string | null = null;
        let resolvedCatName: string | null = item.title || null;
        let resolvedCatEmoji: string | null = null;

        if (item.source === "shortcut_notification" && rawText) {
          const bankParsed = parseBankNotification(rawText, categories, wallets, {
            sourceApp: item.source_app || item.wallet_hint,
            title: item.title || item.merchant,
            subtitle: item.subtitle,
            receivedAt: item.transaction_date || item.captured_at,
          });
          if (!bankParsed && isPromotionalOrSpamNotification(rawText)) {
            continue;
          }
          if (bankParsed) {
            if (resolvedAmount <= 0) resolvedAmount = bankParsed.amount;
            resolvedType =
              bankParsed.type === "transfer"
                ? "transfer"
                : bankParsed.type === "income"
                ? "income"
                : "expense";
            resolvedDesc = bankParsed.merchantOrNote || resolvedDesc;
            resolvedWalletId = bankParsed.suggestedWalletId || null;
            resolvedWalletName = bankParsed.suggestedWalletName || resolvedWalletName;
            resolvedToWalletId = bankParsed.suggestedToWalletId || null;
            resolvedToWalletName = bankParsed.suggestedToWalletName;
            resolvedCatId = bankParsed.suggestedCategoryId || null;
            resolvedCatName = bankParsed.suggestedCategoryName || resolvedCatName;
          }
        } else if (
          (item.source === "shortcut_screenshot" || item.source === "smart_text") &&
          rawText
        ) {
          const slipParsed = parseSlipText(rawText, wallets, categories);
          if (slipParsed && slipParsed.amount && slipParsed.amount > 0) {
            if (resolvedAmount <= 0) resolvedAmount = slipParsed.amount;
            resolvedType =
              slipParsed.type === "transfer"
                ? "transfer"
                : slipParsed.type === "income"
                ? "income"
                : "expense";
            resolvedDesc = slipParsed.merchantOrRecipient || resolvedDesc;
            resolvedWalletId = slipParsed.sourceWalletId;
            resolvedWalletName = slipParsed.sourceWalletName || resolvedWalletName;
            resolvedToWalletId = slipParsed.destinationWalletId;
            resolvedToWalletName = slipParsed.destinationWalletName || undefined;
            resolvedCatId = slipParsed.categoryId;
            resolvedCatName = slipParsed.categoryName;
          } else if (resolvedAmount <= 0) {
            const bankFallback = parseBankNotification(rawText, categories, wallets);
            if (bankFallback && bankFallback.amount > 0) {
              resolvedAmount = bankFallback.amount;
              resolvedType =
                bankFallback.type === "transfer"
                  ? "transfer"
                  : bankFallback.type === "income"
                  ? "income"
                  : "expense";
              resolvedDesc = bankFallback.merchantOrNote || resolvedDesc;
              resolvedWalletId = bankFallback.suggestedWalletId || null;
              resolvedWalletName = bankFallback.suggestedWalletName || resolvedWalletName;
              resolvedCatId = bankFallback.suggestedCategoryId || null;
              resolvedCatName = bankFallback.suggestedCategoryName || null;
            }
          }
        } else if (item.source === "card_transaction" && rawText && resolvedAmount <= 0) {
          const firstNum = rawText.match(/(\d+(?:[.,]\d+)?)/);
          if (firstNum) {
            resolvedAmount = Math.round(Number(firstNum[1].replace(/,/g, "")));
          }
          const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          if (lines.length >= 2 && !resolvedDesc) resolvedDesc = lines[1];
          if (lines.length >= 3 && !resolvedWalletName) resolvedWalletName = lines[2];
        }

        if (resolvedAmount <= 0) continue;

        // 3. Match wallet by hint if still unresolved
        if (!resolvedWalletId && wallets.length > 0) {
          if (resolvedWalletName) {
            const hintLower = resolvedWalletName.toLowerCase();
            const foundWal = wallets.find(
              (w) =>
                w.name.toLowerCase() === hintLower ||
                w.name.toLowerCase().includes(hintLower) ||
                hintLower.includes(w.name.toLowerCase()),
            );
            if (foundWal) {
              resolvedWalletId = foundWal.id;
              resolvedWalletName = foundWal.name;
            }
          }
          if (!resolvedWalletId) {
            resolvedWalletId = wallets[0].id;
            resolvedWalletName = wallets[0].name;
          }
        }

        // 4. Match category by title/hint or Merchant Memory & Semantic Classifier
        if (resolvedType !== "transfer" && !resolvedCatId && categories.length > 0) {
          if (resolvedCatName) {
            const catHintLower = resolvedCatName.toLowerCase();
            const matchedByName = categories.find(
              (c) =>
                c.name.toLowerCase() === catHintLower ||
                c.name.toLowerCase().includes(catHintLower) ||
                catHintLower.includes(c.name.toLowerCase()),
            );
            if (matchedByName) {
              resolvedCatId = matchedByName.id;
              resolvedCatName = matchedByName.name;
              resolvedCatEmoji = matchedByName.emoji;
            }
          }
          const lookupText = `${resolvedDesc} ${rawText}`.trim();
          if (!resolvedCatId) {
            const mem = getMerchantMemory(resolvedDesc || rawText);
            if (mem) {
              const foundCat = categories.find((c) => c.id === mem.categoryId);
              if (foundCat) {
                resolvedCatId = foundCat.id;
                resolvedCatName = foundCat.name;
                resolvedCatEmoji = foundCat.emoji;
              }
            }
          }
          if (!resolvedCatId && lookupText) {
            const sem = classifySemanticCategory(
              lookupText,
              categories,
              resolvedType === "income" ? "income" : "expense",
            );
            if (sem.category) {
              resolvedCatId = sem.category.id;
              resolvedCatName = sem.category.name;
              resolvedCatEmoji = sem.category.emoji;
            }
          }
          if (!resolvedCatId) {
            const fallbackCat =
              categories.find((c) =>
                resolvedType === "income" ? c.type === "income" : c.type !== "income",
              ) || categories[0];
            if (fallbackCat) {
              resolvedCatId = fallbackCat.id;
              resolvedCatName = fallbackCat.name;
              resolvedCatEmoji = fallbackCat.emoji;
            }
          }
        } else if (resolvedCatId) {
          const catObj = categories.find((c) => c.id === resolvedCatId);
          if (catObj) resolvedCatEmoji = catObj.emoji;
        }

        // Keep cleanDescription empty if there was no real merchant/note so notes aren't polluted
        const finalDesc = resolvedDesc.trim();
        const resolvedConfidence =
          typeof item.confidence === "number" && item.confidence > 0 ? item.confidence : 0.9;

        validStatementItems.push({
          id: item.id,
          date: dateStr,
          time: timeStr,
          description: finalDesc,
          cleanDescription: finalDesc,
          amount: resolvedAmount,
          type: resolvedType,
          walletId: resolvedWalletId,
          walletName: resolvedWalletName,
          destinationWalletId: resolvedToWalletId,
          destinationWalletName: resolvedToWalletName,
          suggestedCategoryId: resolvedType === "transfer" ? null : resolvedCatId,
          suggestedCategoryName: resolvedType === "transfer" ? null : resolvedCatName,
          suggestedCategoryEmoji: resolvedType === "transfer" ? null : resolvedCatEmoji,
          isDuplicate: false,
          selected: true,
          raw: rawText,
          confidence: resolvedConfidence,
          needsReview: resolvedConfidence < 0.7 || item.direction === "unknown",
          spaceId: targetSpaceId,
          spaceName: targetSpaceName,
          captureOwnerId: ownerId,
          captureLedgerId: targetSpaceId,
          captureTimestampConfirmed: true,
        });
      }

      // Acknowledge all processed IDs so native cleans up files and resets app icon badge
      await AccrualInbox.ack({ ids: allIds, ownerId });

      // Notify UI if Dialog Glass directly recorded transactions
      if (directRecordedCount > 0 && lastDirectRecordedInfo) {
        window.dispatchEvent(
          new CustomEvent("trouvaille:test-hud", {
            detail: {
              amount: lastDirectRecordedInfo.amount,
              type: "expense",
              categoryName: lastDirectRecordedInfo.categoryName,
              walletName: lastDirectRecordedInfo.walletName,
              note: lastDirectRecordedInfo.note,
            },
          }),
        );
        showToast(
          isIndonesian
            ? `Transaksi Dialog Glass berhasil dicatat ke ${targetSpaceName}`
            : `Dialog Glass transaction recorded to ${targetSpaceName}`,
          "add",
          null,
          3200,
        );
      }

      if (validStatementItems.length === 0) return;

      const firstSource = items.find((i) => i.source !== "glass_dialog")?.source;
      const sourceTitle =
        firstSource === "shortcut_notification"
          ? isIndonesian
            ? "Notifikasi Transaksi"
            : "Transaction Notification"
          : firstSource === "smart_text"
          ? isIndonesian
            ? "Teks Papan Klip Pintar"
            : "Smart Clipboard Text"
          : firstSource === "card_transaction"
          ? isIndonesian
            ? "Transaksi Kartu / Dompet"
            : "Wallet Card Transaction"
          : isIndonesian
          ? "Pindai Layar"
          : "Screen Scanner";

      const draftSource: DraftSourceType =
        firstSource === "shortcut_notification"
          ? "notification"
          : firstSource === "smart_text"
          ? "smart_text"
          : firstSource === "card_transaction"
          ? "wallet_tap"
          : "screen_scan";

      saveDraftBatch(validStatementItems, sourceTitle, draftSource, targetSpaceId);

      // Fire native local notification
      const firstItem = validStatementItems[0];
      const displayLabel =
        firstItem.cleanDescription ||
        firstItem.suggestedCategoryName ||
        (isIndonesian ? "Transaksi" : "Transaction");
      const notifTitle = isIndonesian
        ? `Draft Masuk (${targetSpaceName})`
        : `Draft Queued (${targetSpaceName})`;
      const notifBody =
        validStatementItems.length === 1
          ? `${formatNotificationCurrency(firstItem.amount)} • ${displayLabel}${
              firstItem.walletName ? ` (${firstItem.walletName})` : ""
            }`
          : isIndonesian
          ? `${validStatementItems.length} transaksi baru siap ditinjau di ${targetSpaceName}`
          : `${validStatementItems.length} new transactions ready for review in ${targetSpaceName}`;

      void showNativeLocalNotification({ title: notifTitle, body: notifBody });

      showToast(
        isIndonesian
          ? `${validStatementItems.length} transaksi masuk ke Draft (${targetSpaceName})`
          : `${validStatementItems.length} transactions queued in Draft (${targetSpaceName})`,
        "info",
        null,
        3500,
      );
    } catch (err) {
      console.warn("[useInboxDrain] Error draining native inbox:", err);
    } finally {
      isDrainingRef.current = false;
    }
  }, [
    user?.id,
    isIndonesian,
    showToast,
    activeSpaceId,
    activeSpace,
    defaultSpaceId,
    categories,
    wallets,
    addTxMutation,
  ]);

  useEffect(() => {
    drainInbox();

    let sub: any;
    try {
      const p = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          drainInbox();
        }
      });
      p.then((handle) => {
        sub = handle;
      }).catch(() => {});
    } catch {
      // Browser / fallback
    }

    return () => {
      if (sub && typeof sub.remove === "function") {
        sub.remove();
      }
    };
  }, [drainInbox]);
}
