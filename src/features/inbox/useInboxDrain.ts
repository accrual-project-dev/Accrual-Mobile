import { useEffect, useRef, useCallback } from "react";
import { App } from "@capacitor/app";
import { AccrualInbox, type InboxDraft } from "../../plugins/accrualInbox";
import { saveDraftBatch } from "../../lib/draftTransactionService";
import type { ParsedStatementItem } from "../../lib/statementParser";
import { useLanguage } from "../../contexts/LanguageContext";
import { useToast } from "../../contexts/ToastContext";

export function useInboxDrain() {
  const isDrainingRef = useRef(false);
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();

  const drainInbox = useCallback(async () => {
    if (isDrainingRef.current) return;
    isDrainingRef.current = true;

    try {
      const res = await AccrualInbox.drain();
      const items: InboxDraft[] = res?.items || [];
      if (!items.length) return;

      const statementItems: ParsedStatementItem[] = items.map((item) => {
        const parsedDate = new Date(item.transaction_date || item.captured_at);
        const dateStr = !isNaN(parsedDate.getTime())
          ? parsedDate.toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const timeStr = !isNaN(parsedDate.getTime())
          ? parsedDate.toTimeString().slice(0, 5)
          : undefined;

        const defaultDesc =
          item.direction === "income"
            ? isIndonesian ? "Dana Masuk" : "Income"
            : isIndonesian ? "Pengeluaran" : "Expense";

        const desc = item.merchant || defaultDesc;

        return {
          id: item.id,
          date: dateStr,
          time: timeStr,
          description: desc,
          cleanDescription: desc,
          amount: Math.abs(item.amount),
          type: item.direction === "income" ? "income" : "expense",
          walletName: item.wallet_hint || undefined,
          suggestedCategoryId: null,
          suggestedCategoryName: null,
          suggestedCategoryEmoji: null,
          isDuplicate: false,
          selected: true,
          raw: item.raw_text,
          confidence: item.confidence,
          needsReview: item.confidence < 0.7 || item.direction === "unknown",
        };
      });

      const sourceTitle =
        items[0]?.source === "shortcut_notification"
          ? isIndonesian ? "Notifikasi Transaksi" : "Transaction Notification"
          : isIndonesian ? "Tangkapan Layar" : "Screenshot Ingestion";

      saveDraftBatch(statementItems, sourceTitle, "back_tap");

      // Acknowledge processed IDs so native removes the JSON files
      const ids = items.map((i) => i.id);
      await AccrualInbox.ack({ ids });

      showToast(
        isIndonesian
          ? `${statementItems.length} transaksi baru siap ditinjau di Arsip Draft`
          : `${statementItems.length} new transactions ready for review in Draft Archive`,
        "info",
        null,
        3500
      );
    } catch (err) {
      console.warn("[useInboxDrain] Error draining native inbox:", err);
    } finally {
      isDrainingRef.current = false;
    }
  }, [isIndonesian, showToast]);

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
