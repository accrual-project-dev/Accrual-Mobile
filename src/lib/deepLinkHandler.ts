import { format } from "date-fns";
import type { Category, Wallet, Transaction, TransactionType } from "./types";
import {
  parseBankNotification,
  isPromotionalOrSpamNotification,
} from "./bankNotificationParser";
import {
  parseNaturalTransaction,
  parseMultiNaturalTransactions,
} from "./nlpParser";
import { parseSlipText } from "./slipParser";
import {
  isMultiTransactionHistoryText,
  parseScreenshotHistory,
} from "./screenshotHistoryParser";
import type { ParsedStatementItem } from "./statementParser";
import { classifySemanticCategory } from "./semanticClassifier";
import { getMerchantMemory } from "./merchantCategoryMemory";
import { resolveActiveDraftSpaceId, type DraftSourceType } from "./draftTransactionService";

export interface DeepLinkPrefill {
  amount?: number;
  type?: TransactionType;
  note?: string;
  category_id?: string;
  categoryId?: string;
  wallet_id?: string;
  walletId?: string;
  to_wallet_id?: string;
  toWalletId?: string;
  date?: Date;
  time?: string;
  spaceId?: string;
}

export interface DeepLinkResult {
  action:
    | "transaction"
    | "voice"
    | "scan"
    | "import"
    | "navigate"
    | "restore_balance"
    | "batch_review"
    | "none";
  path?: string;
  autoSave?: boolean;
  fromShortcut?: boolean;
  isIgnoredPromo?: boolean;
  sourceChannel?: DraftSourceType;
  spaceId?: string;
  matchedCategoryName?: string;
  matchedWalletName?: string;
  matchedToWalletName?: string;
  prefilledValues?: DeepLinkPrefill;
  batchItems?: ParsedStatementItem[];
}

/**
 * Extracts hours and minutes from a date-time string.
 * Supports "17:30", "17.30", "17:30:00", "05:30 PM", "5:30pm", "5.30 am", "at 17:30", etc.
 */
export function extractTimeComponents(
  str?: string | null,
): { hours: number; minutes: number } | null {
  if (!str || typeof str !== "string") return null;
  // Avoid matching date parts like "28.09.2026" as time
  const cleaned = str.replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, " ");
  const match = cleaned.match(
    /(?:at\s+|pukul\s+|jam\s+|\b)(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\s*([ap]\.?m\.?))?/i,
  );
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const meridian = match[3]?.toLowerCase().replace(/\./g, "");
  if (meridian === "pm" && h < 12) h += 12;
  if (meridian === "am" && h === 12) h = 0;
  if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
    return { hours: h, minutes: m };
  }
  return null;
}

/**
 * Resilient multi-format Indonesian & international date parser.
 * Handles ISO, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY with Indonesian month names and optional time.
 */
export function parseIndonesianDate(dateStr?: string | null): Date | undefined {
  if (!dateStr || typeof dateStr !== "string") return undefined;
  const clean = dateStr
    .trim()
    .replace(
      /^(?:senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+/i,
      "",
    )
    .trim();
  if (!clean) return undefined;

  const timeComp = extractTimeComponents(clean);

  const monthMap: Record<string, number> = {
    jan: 0, januari: 0, january: 0,
    feb: 1, februari: 1, february: 1,
    mar: 2, maret: 2, march: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5, june: 5,
    jul: 6, juli: 6, july: 6,
    agu: 7, agustus: 7, aug: 7, august: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9, oct: 9, october: 9,
    nov: 10, november: 10,
    des: 11, desember: 11, dec: 11, december: 11,
  };

  let resolvedDate: Date | undefined;

  if (!/^\d{1,2}$/.test(clean)) {
    const stdDate = new Date(clean);
    if (
      !isNaN(stdDate.getTime()) &&
      !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(clean) &&
      stdDate.getFullYear() >= 2000 &&
      stdDate.getFullYear() <= 2100
    ) {
      if (timeComp && stdDate.getHours() === 0 && stdDate.getMinutes() === 0) {
        stdDate.setHours(timeComp.hours, timeComp.minutes, 0, 0);
      }
      return stdDate;
    }
  }

  const singleDayMatch = clean.match(
    /^(\d{1,2})(?:\s+(?:at|pukul|jam)?\s*[\d:.]+)?$/i,
  );
  if (singleDayMatch) {
    const day = parseInt(singleDayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const now = new Date();
      resolvedDate = new Date(now.getFullYear(), now.getMonth(), day);
    }
  }

  if (!resolvedDate) {
    const numMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (numMatch) {
      const d = parseInt(numMatch[1], 10);
      const m = parseInt(numMatch[2], 10);
      let y = parseInt(numMatch[3], 10);
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
        resolvedDate = new Date(y, m - 1, d);
      }
    }
  }

  if (!resolvedDate) {
    const textMatch =
      clean.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})/i) ||
      clean.match(/^(\d{1,2})[/-]([a-zA-Z]+)[/-](\d{2,4})/i);
    if (textMatch) {
      const d = parseInt(textMatch[1], 10);
      const mStr = textMatch[2].toLowerCase();
      const m = monthMap[mStr];
      let y = parseInt(textMatch[3], 10);
      if (y < 100) y += 2000;
      if (m !== undefined && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
        resolvedDate = new Date(y, m, d);
      }
    }
  }

  if (!resolvedDate) {
    const textNoYearMatch = clean.match(
      /^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(?:at|pukul|jam)?\s*[\d:.]+)?$/i,
    );
    if (textNoYearMatch) {
      const d = parseInt(textNoYearMatch[1], 10);
      const mStr = textNoYearMatch[2].toLowerCase();
      const m = monthMap[mStr];
      if (m !== undefined && d >= 1 && d <= 31) {
        const now = new Date();
        resolvedDate = new Date(now.getFullYear(), m, d);
      }
    }
  }

  if (!resolvedDate) {
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        resolvedDate = new Date(y, m - 1, d);
      }
    }
  }

  if (resolvedDate) {
    if (resolvedDate.getFullYear() < 2000 || resolvedDate.getFullYear() > 2100) {
      resolvedDate = new Date();
    }
    if (timeComp) {
      resolvedDate.setHours(timeComp.hours, timeComp.minutes, 0, 0);
    }
    return resolvedDate;
  }

  return undefined;
}

/**
 * Normalizes Indonesian & International currency strings into clean numbers.
 * Handles "Rp 50.000", "50.000", "50,000", "50000", "1.500.000,00", etc.
 */
export function parseCurrencyAmount(rawStr?: string | null): number {
  if (!rawStr || typeof rawStr !== "string") return 0;
  let clean = rawStr.trim().replace(/^[^\d]+/g, "");
  if (!clean) return 0;

  if (clean.includes(".") && clean.includes(",")) {
    const dotIdx = clean.lastIndexOf(".");
    const commaIdx = clean.lastIndexOf(",");
    if (commaIdx > dotIdx) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
      clean = clean.replace(/,/g, "");
    }
  } else if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts[parts.length - 1].length === 3 || parts.length > 2) {
      clean = clean.replace(/\./g, "");
    }
  } else if (clean.includes(",")) {
    const parts = clean.split(",");
    if (parts[parts.length - 1].length === 3 || parts.length > 2) {
      clean = clean.replace(/,/g, "");
    } else {
      clean = clean.replace(",", ".");
    }
  } else {
    clean = clean.replace(/[^\d.]/g, "");
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Sanitizes transaction notes per Rule 8.1:
 * Converts placeholder tokens ("-", "--") or whitespace-only into empty string.
 */
export function sanitizeDeepLinkNote(note?: string | null): string {
  if (!note || typeof note !== "string") return "";
  const trimmed = note.trim();
  if (
    trimmed === "-" ||
    trimmed === "--" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "n/a" ||
    /^screenshot\.(?:png|jpg|jpeg|heic)$/i.test(trimmed)
  ) {
    return "";
  }
  return trimmed;
}

/**
 * Parses structured multi-line text generated by iOS Shortcuts Dialog / Automation:
 * Format:
 * Nominal: 50.000
 * Kategori: Makanan & Minuman
 * Akun: BCA
 * Tanggal: 30 Okt 2026 14:30
 * Catatan: Makan siang
 */
export function parseStructuredShortcutText(
  text: string,
  categories: Category[] = [],
  wallets: Wallet[] = [],
): DeepLinkResult | null {
  if (!text || typeof text !== "string") return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let rawAmount: string | undefined;
  let rawCategory: string | undefined;
  let rawWallet: string | undefined;
  let rawToWallet: string | undefined;
  let rawNote: string | undefined;
  let rawDate: string | undefined;
  let rawType: TransactionType | undefined;
  let rawSpace: string | undefined;
  let hasStructuredKey = false;

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim();
      if (!val) continue;

      if (key === "nominal" || key === "amount" || key === "jumlah" || key === "biaya") {
        hasStructuredKey = true;
        rawAmount = val;
      } else if (key === "kategori" || key === "category") {
        hasStructuredKey = true;
        rawCategory = val;
      } else if (
        key === "akun" ||
        key === "wallet" ||
        key === "rekening" ||
        key === "dompet" ||
        key === "dari" ||
        key === "account" ||
        key === "source" ||
        key === "card" ||
        key === "kartu"
      ) {
        hasStructuredKey = true;
        rawWallet = val;
      } else if (
        key === "ke" ||
        key === "tujuan" ||
        key === "to" ||
        key === "to_wallet" ||
        key === "destination"
      ) {
        hasStructuredKey = true;
        rawToWallet = val;
      } else if (
        key === "catatan" ||
        key === "note" ||
        key === "notes" ||
        key === "keterangan" ||
        key === "deskripsi" ||
        key === "merchant"
      ) {
        hasStructuredKey = true;
        rawNote = sanitizeDeepLinkNote(val);
      } else if (
        key === "tanggal" ||
        key === "date" ||
        key === "datetime" ||
        key === "waktu" ||
        key === "time"
      ) {
        hasStructuredKey = true;
        if (!rawDate) {
          rawDate = val;
        } else {
          rawDate = `${rawDate} ${val}`;
        }
      } else if (key === "tipe" || key === "type") {
        hasStructuredKey = true;
        const t = val.toLowerCase();
        if (t === "income" || t === "pemasukan") rawType = "income";
        else if (t === "transfer") rawType = "transfer";
        else rawType = "expense";
      } else if (key === "space" || key === "space_id") {
        hasStructuredKey = true;
        rawSpace = val;
      }
    }
  }

  if (!hasStructuredKey || !rawAmount) {
    return null;
  }

  const cleanNum = parseCurrencyAmount(rawAmount);
  if (isNaN(cleanNum) || cleanNum <= 0) {
    return null;
  }

  let matchedCat = categories.find(
    (c) =>
      (rawCategory && c.id.toLowerCase() === rawCategory.toLowerCase()) ||
      (rawCategory && c.name.toLowerCase() === rawCategory.toLowerCase()) ||
      (rawCategory && c.name.toLowerCase().includes(rawCategory.toLowerCase())) ||
      (rawCategory && rawCategory.toLowerCase().includes(c.name.toLowerCase())),
  );
  if (!matchedCat && categories.length > 0) {
    matchedCat = categories.find((c) => c.type !== "income") || categories[0];
  }

  let matchedWal = wallets.find(
    (w) =>
      (rawWallet && w.id.toLowerCase() === rawWallet.toLowerCase()) ||
      (rawWallet && w.name.toLowerCase() === rawWallet.toLowerCase()) ||
      (rawWallet && w.name.toLowerCase().includes(rawWallet.toLowerCase())) ||
      (rawWallet && rawWallet.toLowerCase().includes(w.name.toLowerCase())),
  );
  if (!matchedWal && wallets.length > 0) {
    matchedWal = wallets[0];
  }

  let matchedToWal: Wallet | undefined;
  if (rawToWallet) {
    matchedToWal = wallets.find(
      (w) =>
        w.id.toLowerCase() === rawToWallet.toLowerCase() ||
        w.name.toLowerCase() === rawToWallet.toLowerCase() ||
        w.name.toLowerCase().includes(rawToWallet.toLowerCase()) ||
        rawToWallet.toLowerCase().includes(w.name.toLowerCase()),
    );
    if (matchedToWal && matchedWal && matchedToWal.id === matchedWal.id) {
      matchedToWal = wallets.find((w) => w.id !== matchedWal?.id);
    }
  }

  const effectiveType: TransactionType =
    rawType || (matchedToWal ? "transfer" : "expense");

  const parsedDate = parseIndonesianDate(rawDate) || new Date();
  const timeComp = extractTimeComponents(rawDate);
  const timeStr = timeComp
    ? `${String(timeComp.hours).padStart(2, "0")}:${String(timeComp.minutes).padStart(2, "0")}`
    : format(parsedDate, "HH:mm");

  const targetSpaceId = resolveActiveDraftSpaceId(rawSpace);

  return {
    action: "transaction",
    fromShortcut: true,
    sourceChannel: "glass_dialog",
    spaceId: targetSpaceId,
    matchedCategoryName: matchedCat?.name,
    matchedWalletName: matchedWal?.name,
    matchedToWalletName: matchedToWal?.name,
    prefilledValues: {
      amount: cleanNum,
      type: effectiveType,
      note: sanitizeDeepLinkNote(rawNote),
      category_id: effectiveType === "transfer" ? undefined : matchedCat?.id,
      categoryId: effectiveType === "transfer" ? undefined : matchedCat?.id,
      wallet_id: matchedWal?.id,
      walletId: matchedWal?.id,
      to_wallet_id: matchedToWal?.id,
      toWalletId: matchedToWal?.id,
      date: parsedDate,
      time: timeStr,
      spaceId: targetSpaceId,
    },
  };
}

/**
 * Parses incoming URL scheme strings (e.g. `accrual://...`, `trouvaille://...`)
 * and routes all Shortcut transaction captures to the Active Space Draft Inbox.
 */
export function parseDeepLink(
  urlString: string,
  categories: Category[] = [],
  wallets: Wallet[] = [],
  existingTransactions: Transaction[] = [],
  activeSpaceId?: string | null,
): DeepLinkResult {
  if (!urlString || typeof urlString !== "string") {
    return { action: "none" };
  }

  try {
    let targetUrl = urlString.trim();
    if (targetUrl.startsWith("?")) {
      targetUrl = `https://accrual.internal/${targetUrl}`;
    } else if (/^(?:accrual|trouvaille):\/\//i.test(targetUrl)) {
      targetUrl = targetUrl.replace(
        /^(?:accrual|trouvaille):\/\//i,
        "https://accrual.internal/",
      );
    } else if (!/^https?:\/\//i.test(targetUrl)) {
      return { action: "none" };
    }

    const qIndex = targetUrl.indexOf("?");
    let safeUrl = targetUrl;
    if (qIndex !== -1) {
      const base = targetUrl.slice(0, qIndex);
      let query = targetUrl.slice(qIndex + 1);

      query = query.replace(/ /g, "%20");

      const tokens = query.split("&");
      const reconstructedTokens: string[] = [];
      const isKnownParamKey = (t: string) =>
        /^(?:action|mode|source|channel|text|teks|title|judul|subtitle|subjudul|app|source_app|aplikasi|at|received_at|waktu_terima|q|ocr|content|amount|nominal|jumlah|note|catatan|deskripsi|merchant|type|tipe|category|kategori|category_id|categoryid|wallet|rekening|dompet|akun|account|card|kartu|wallet_id|walletid|dari|to_wallet|to_wallet_id|towallet|ke|tujuan|date|tanggal|datetime|time|waktu|space|space_id|ledger|ledger_id|autosave|auto|otomatis|draft)=/i.test(
          t,
        );

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (i === 0 || isKnownParamKey(token)) {
          reconstructedTokens.push(token);
        } else {
          const lastIdx = reconstructedTokens.length - 1;
          if (lastIdx >= 0) {
            reconstructedTokens[lastIdx] += "%26" + token;
          } else {
            reconstructedTokens.push(token);
          }
        }
      }
      safeUrl = `${base}?${reconstructedTokens.join("&")}`;
    } else {
      safeUrl = targetUrl.replace(/ /g, "%20");
    }

    const parsed = new URL(safeUrl);
    const actionPath = parsed.pathname.replace(/^\/+/, "").toLowerCase();
    const params = parsed.searchParams;

    const explicitSpaceParam =
      params.get("space") ||
      params.get("space_id") ||
      params.get("ledger") ||
      params.get("ledger_id");
    const resolvedSpaceId = resolveActiveDraftSpaceId(
      explicitSpaceParam || activeSpaceId,
    );

    // 1. Direct modal & utility routing actions
    if (
      actionPath === "restore-balance" ||
      actionPath === "clean-sync" ||
      actionPath === "reset-queue" ||
      params.get("action") === "restore_balance" ||
      params.get("action") === "clean_sync" ||
      params.get("mode") === "clean_sync"
    ) {
      return { action: "restore_balance" };
    }
    if (
      actionPath === "voice" ||
      params.get("mode") === "voice" ||
      params.get("action") === "voice"
    ) {
      return { action: "voice" };
    }
    if (
      actionPath === "inbox" ||
      actionPath === "draft" ||
      actionPath === "drafts" ||
      actionPath === "review" ||
      params.get("action") === "inbox" ||
      params.get("mode") === "inbox" ||
      params.get("action") === "review"
    ) {
      return { action: "batch_review", spaceId: resolvedSpaceId };
    }
    if (
      actionPath === "scan" ||
      params.get("mode") === "scan" ||
      params.get("action") === "scan"
    ) {
      return { action: "scan" };
    }
    if (
      actionPath === "import" ||
      params.get("mode") === "import" ||
      params.get("action") === "import"
    ) {
      return { action: "import" };
    }

    // 2. Direct tab navigation routes
    if (actionPath === "calendar") {
      return { action: "navigate", path: "/calendar" };
    }
    if (actionPath === "bills" || actionPath === "tagihan") {
      return { action: "navigate", path: "/bills" };
    }
    if (
      actionPath === "transactions" ||
      actionPath === "history" ||
      actionPath === "riwayat" ||
      actionPath === "activity"
    ) {
      return { action: "navigate", path: "/transactions" };
    }
    if (
      actionPath === "statistics" ||
      actionPath === "stats" ||
      actionPath === "statistik" ||
      actionPath === "savings" ||
      actionPath === "cashflow" ||
      actionPath === "capital" ||
      actionPath === "spending-stability"
    ) {
      return { action: "navigate", path: "/statistics" };
    }
    if (
      actionPath === "assets" ||
      actionPath === "wealth" ||
      actionPath === "investments" ||
      actionPath === "aset" ||
      actionPath === "networth" ||
      actionPath === "allocation" ||
      actionPath === "cash" ||
      actionPath === "runway"
    ) {
      return { action: "navigate", path: "/assets" };
    }
    if (actionPath === "settings" || actionPath === "pengaturan") {
      return { action: "navigate", path: "/settings" };
    }
    if (
      actionPath === "reports" ||
      actionPath === "report" ||
      actionPath === "laporan" ||
      actionPath === "balance-sheet"
    ) {
      return { action: "navigate", path: "/transactions?open=export" };
    }
    if (actionPath === "home" || actionPath === "beranda") {
      return { action: "navigate", path: "/" };
    }

    // 3. Extract Shortcut & Notification parameters
    const rawTextParam =
      params.get("text") ||
      params.get("teks") ||
      params.get("q") ||
      params.get("ocr") ||
      params.get("content");
    const notifTitle = params.get("title") || params.get("judul");
    const notifSubtitle = params.get("subtitle") || params.get("subjudul");
    const notifSourceApp =
      params.get("app") || params.get("source_app") || params.get("aplikasi");
    const notifReceivedAt =
      params.get("at") || params.get("received_at") || params.get("waktu_terima");

    // If `title` was used as legacy `rawText` only when `text` is absent and `actionPath !== "notify"`
    const rawText =
      rawTextParam ||
      (actionPath !== "notify" && !notifSubtitle && !notifSourceApp
        ? notifTitle
        : "");

    const directAmount =
      params.get("amount") || params.get("nominal") || params.get("jumlah");
    const directMerchant = params.get("merchant");
    const directNote = sanitizeDeepLinkNote(
      params.get("note") ||
        params.get("catatan") ||
        params.get("deskripsi") ||
        directMerchant,
    );
    const directType = (params.get("type") ||
      params.get("tipe")) as TransactionType | null;
    const directCategory =
      params.get("category") ||
      params.get("kategori") ||
      params.get("category_id") ||
      params.get("categoryId");
    const directWallet =
      params.get("wallet") ||
      params.get("rekening") ||
      params.get("dompet") ||
      params.get("akun") ||
      params.get("account") ||
      params.get("card") ||
      params.get("kartu") ||
      params.get("wallet_id") ||
      params.get("walletId") ||
      params.get("dari") ||
      notifSourceApp;
    const directToWallet =
      params.get("to_wallet") ||
      params.get("to_wallet_id") ||
      params.get("toWallet") ||
      params.get("ke") ||
      params.get("tujuan");
    const directDate =
      params.get("date") ||
      params.get("tanggal") ||
      params.get("datetime") ||
      notifReceivedAt;
    const directTime = params.get("time") || params.get("waktu");

    const sourceParam = (
      params.get("source") ||
      params.get("channel") ||
      actionPath ||
      ""
    ).toLowerCase();

    const resolvedChannel: DraftSourceType =
      sourceParam.includes("notify") || sourceParam.includes("notification")
        ? "notification"
        : sourceParam.includes("scan-screen") ||
          sourceParam.includes("screen_scan") ||
          sourceParam.includes("capture")
        ? "screen_scan"
        : sourceParam.includes("wallet-tap") || sourceParam.includes("wallet_tap")
        ? "wallet_tap"
        : sourceParam.includes("smart-text") || sourceParam.includes("smart_text")
        ? "smart_text"
        : directAmount
        ? "glass_dialog"
        : "back_tap";

    // Guard against unextracted image filename placeholder (e.g. if user passed Screenshot image instead of Extracted Text)
    if (rawText && /^screenshot(?:\s*\d*)?\.(?:png|jpg|jpeg|heic|pdf)$/i.test(rawText.trim())) {
      return { action: "none" };
    }

    // 4. Explicit Notification Reader Channel (`accrual://notify?...` or `source=notification`)
    if (
      actionPath === "notify" ||
      resolvedChannel === "notification" ||
      notifSourceApp ||
      notifSubtitle
    ) {
      const textToParse = [rawText, notifSubtitle, notifTitle]
        .filter(Boolean)
        .join("\n")
        .trim();
      if (!textToParse) {
        return { action: "none" };
      }

      if (isPromotionalOrSpamNotification(rawText || "", notifTitle, notifSubtitle)) {
        return { action: "none", isIgnoredPromo: true };
      }

      const bankResult = parseBankNotification(textToParse, categories, wallets, {
        title: notifTitle,
        subtitle: notifSubtitle,
        sourceApp: notifSourceApp,
        receivedAt: notifReceivedAt || directDate,
      });

      if (!bankResult || bankResult.amount <= 0) {
        return { action: "none", isIgnoredPromo: true };
      }

      const matchedCat = categories.find(
        (c) => c.id === bankResult.suggestedCategoryId,
      );
      const matchedWal = wallets.find(
        (w) => w.id === bankResult.suggestedWalletId,
      );
      const matchedToWal = wallets.find(
        (w) => w.id === bankResult.suggestedToWalletId,
      );
      const effectiveDate =
        bankResult.occurredAt ||
        parseIndonesianDate(notifReceivedAt || directDate) ||
        new Date();
      const timeComp = extractTimeComponents(notifReceivedAt || directDate);
      const effectiveTime = timeComp
        ? `${String(timeComp.hours).padStart(2, "0")}:${String(timeComp.minutes).padStart(2, "0")}`
        : format(effectiveDate, "HH:mm");

      return {
        action: "transaction",
        autoSave: false,
        fromShortcut: true,
        sourceChannel: "notification",
        spaceId: resolvedSpaceId,
        matchedCategoryName: matchedCat?.name,
        matchedWalletName: matchedWal?.name || bankResult.sourceApp,
        matchedToWalletName: matchedToWal?.name,
        prefilledValues: {
          amount: bankResult.amount,
          type: bankResult.type,
          note:
            directNote ||
            (bankResult.type === "transfer"
              ? ""
              : bankResult.merchantOrNote || ""),
          category_id:
            bankResult.type === "transfer"
              ? undefined
              : bankResult.suggestedCategoryId,
          categoryId:
            bankResult.type === "transfer"
              ? undefined
              : bankResult.suggestedCategoryId,
          wallet_id: bankResult.suggestedWalletId,
          walletId: bankResult.suggestedWalletId,
          to_wallet_id: bankResult.suggestedToWalletId,
          toWalletId: bankResult.suggestedToWalletId,
          date: effectiveDate,
          time: effectiveTime,
          spaceId: resolvedSpaceId,
        },
      };
    }

    // 5. Case A: Direct structured parameters (Glass Dialog, Wallet Card Tap, or 1-Tap Preset)
    if (directAmount) {
      const cleanNum = parseCurrencyAmount(directAmount);
      let matchedCat = categories.find(
        (c) =>
          (directCategory &&
            c.id.toLowerCase() === directCategory.toLowerCase()) ||
          (directCategory &&
            c.name.toLowerCase() === directCategory.toLowerCase()) ||
          (directCategory &&
            c.name.toLowerCase().includes(directCategory.toLowerCase())) ||
          (directCategory &&
            directCategory.toLowerCase().includes(c.name.toLowerCase())),
      );

      // If no explicit category was passed (e.g. Wallet Tap with Merchant), infer category from merchant/note!
      if (!matchedCat && directNote && categories.length > 0) {
        const mem = getMerchantMemory(directNote);
        if (mem) {
          matchedCat = categories.find((c) => c.id === mem.categoryId);
        }
        if (!matchedCat) {
          const sem = classifySemanticCategory(directNote, categories, "expense");
          if (sem.category) {
            matchedCat = sem.category;
          }
        }
      }

      if (!matchedCat && categories.length > 0) {
        matchedCat =
          categories.find((c) => c.type !== "income") || categories[0];
      }

      let matchedWal = wallets.find(
        (w) =>
          (directWallet && w.id.toLowerCase() === directWallet.toLowerCase()) ||
          (directWallet &&
            w.name.toLowerCase() === directWallet.toLowerCase()) ||
          (directWallet &&
            w.name.toLowerCase().includes(directWallet.toLowerCase())) ||
          (directWallet &&
            directWallet.toLowerCase().includes(w.name.toLowerCase())),
      );
      if (!matchedWal && wallets.length > 0) {
        matchedWal = wallets[0];
      }

      let matchedToWal: Wallet | undefined;
      if (directToWallet) {
        matchedToWal = wallets.find(
          (w) =>
            w.id.toLowerCase() === directToWallet.toLowerCase() ||
            w.name.toLowerCase() === directToWallet.toLowerCase() ||
            w.name.toLowerCase().includes(directToWallet.toLowerCase()) ||
            directToWallet.toLowerCase().includes(w.name.toLowerCase()),
        );
        if (matchedToWal && matchedWal && matchedToWal.id === matchedWal.id) {
          matchedToWal = wallets.find((w) => w.id !== matchedWal?.id);
        }
      }

      let combinedDateStr = directDate;
      if (directDate && directTime && !directDate.includes(directTime)) {
        combinedDateStr = `${directDate} ${directTime}`;
      } else if (!directDate && directTime) {
        combinedDateStr = directTime;
      }

      const parsedDate = parseIndonesianDate(combinedDateStr) || new Date();
      const timeComp =
        extractTimeComponents(combinedDateStr) ||
        extractTimeComponents(directTime);
      const effectiveTime = timeComp
        ? `${String(timeComp.hours).padStart(2, "0")}:${String(timeComp.minutes).padStart(2, "0")}`
        : directTime || format(parsedDate, "HH:mm");

      const autoParam = (
        params.get("autosave") ||
        params.get("auto") ||
        params.get("otomatis") ||
        ""
      ).toLowerCase();
      const shouldAutoSave =
        (autoParam === "true" || autoParam === "1" || autoParam === "ya") &&
        !isNaN(cleanNum) &&
        cleanNum > 0;

      const effectiveType: TransactionType =
        directType === "income"
          ? "income"
          : directType === "transfer" || matchedToWal
          ? "transfer"
          : "expense";

      return {
        action: "transaction",
        autoSave: shouldAutoSave,
        fromShortcut: true,
        sourceChannel: resolvedChannel,
        spaceId: resolvedSpaceId,
        matchedCategoryName: matchedCat?.name,
        matchedWalletName: matchedWal?.name,
        matchedToWalletName: matchedToWal?.name,
        prefilledValues: {
          amount: isNaN(cleanNum) ? undefined : cleanNum,
          note: directNote || "",
          type: effectiveType,
          category_id: effectiveType === "transfer" ? undefined : matchedCat?.id,
          categoryId: effectiveType === "transfer" ? undefined : matchedCat?.id,
          wallet_id: matchedWal?.id,
          walletId: matchedWal?.id,
          to_wallet_id: matchedToWal?.id,
          toWalletId: matchedToWal?.id,
          date: parsedDate,
          time: effectiveTime,
          spaceId: resolvedSpaceId,
        },
      };
    }

    // 6. Case B: Raw text provided (Screen Scanner, Notification, Smart Text/Clipboard, or Structured Dialog)
    if (rawText) {
      const trimmedText = rawText.trim();
      const autoParam = (
        params.get("autosave") ||
        params.get("auto") ||
        params.get("otomatis") ||
        ""
      ).toLowerCase();
      const isAutoRequested =
        autoParam === "true" || autoParam === "1" || autoParam === "ya";

      // B-Pre 1: Multi-Transaction Screenshot History Check (GoPay Riwayat, Shopee, BCA Mutasi)
      if (isMultiTransactionHistoryText(trimmedText)) {
        const batchItems = parseScreenshotHistory(
          trimmedText,
          existingTransactions,
          categories,
          wallets,
        );
        if (batchItems && batchItems.length >= 2) {
          return {
            action: "batch_review",
            fromShortcut: true,
            sourceChannel: "screen_scan",
            spaceId: resolvedSpaceId,
            batchItems: batchItems.map((it) => ({
              ...it,
              spaceId: resolvedSpaceId,
            })),
          };
        } else if (batchItems && batchItems.length === 1) {
          const single = batchItems[0];
          return {
            action: "transaction",
            autoSave: isAutoRequested,
            fromShortcut: true,
            sourceChannel: "screen_scan",
            spaceId: resolvedSpaceId,
            matchedCategoryName: single.suggestedCategoryName || undefined,
            matchedWalletName: single.walletName || undefined,
            matchedToWalletName: single.destinationWalletName || undefined,
            prefilledValues: {
              amount: single.amount,
              type: single.type,
              note: single.cleanDescription || single.description,
              category_id:
                single.type === "transfer"
                  ? undefined
                  : single.suggestedCategoryId || undefined,
              categoryId:
                single.type === "transfer"
                  ? undefined
                  : single.suggestedCategoryId || undefined,
              wallet_id: single.walletId || undefined,
              walletId: single.walletId || undefined,
              to_wallet_id: single.destinationWalletId || undefined,
              toWalletId: single.destinationWalletId || undefined,
              date: single.date ? new Date(single.date) : new Date(),
              time: single.time,
              spaceId: resolvedSpaceId,
            },
          };
        }
      }

      // B0: Structured Shortcut Text ("Nominal: ...\nKategori: ...\nAkun: ...\nCatatan: ...")
      const structuredResult = parseStructuredShortcutText(
        trimmedText,
        categories,
        wallets,
      );
      if (
        structuredResult &&
        structuredResult.prefilledValues?.amount &&
        structuredResult.prefilledValues.amount > 0
      ) {
        return {
          ...structuredResult,
          autoSave: isAutoRequested,
          fromShortcut: true,
          spaceId: resolvedSpaceId,
          prefilledValues: {
            ...structuredResult.prefilledValues,
            spaceId: resolvedSpaceId,
          },
        };
      }

      const isMultiLineOrSlip =
        trimmedText.includes("\n") ||
        trimmedText.includes("\r") ||
        trimmedText.length > 70 ||
        /(?:struk|nota|total|subtotal|biaya admin|rekening|pengirim|penerima|no\.?\s*referensi|bi-fast|bukti transfer|transfer berhasil|transaksi berhasil)/i.test(
          trimmedText,
        );

      // B1: Multi-line OCR text or transfer slip characteristics (Screen Scanner Live Text OCR output)
      if (isMultiLineOrSlip) {
        const slipResult = parseSlipText(trimmedText, wallets, categories);
        if (slipResult && slipResult.amount && slipResult.amount > 0) {
          return {
            action: "transaction",
            autoSave: isAutoRequested,
            fromShortcut: true,
            sourceChannel: "screen_scan",
            spaceId: resolvedSpaceId,
            matchedCategoryName: slipResult.categoryName || undefined,
            matchedWalletName: slipResult.sourceWalletName || undefined,
            matchedToWalletName: slipResult.destinationWalletName || undefined,
            prefilledValues: {
              amount: slipResult.amount,
              type: slipResult.type,
              note:
                directNote ||
                (slipResult.type === "transfer"
                  ? ""
                  : sanitizeDeepLinkNote(slipResult.merchantOrRecipient)),
              category_id:
                slipResult.type === "transfer"
                  ? undefined
                  : slipResult.categoryId || undefined,
              categoryId:
                slipResult.type === "transfer"
                  ? undefined
                  : slipResult.categoryId || undefined,
              wallet_id: slipResult.sourceWalletId || undefined,
              walletId: slipResult.sourceWalletId || undefined,
              to_wallet_id: slipResult.destinationWalletId || undefined,
              toWalletId: slipResult.destinationWalletId || undefined,
              date: slipResult.date || new Date(),
              time: slipResult.time || format(slipResult.date || new Date(), "HH:mm"),
              spaceId: resolvedSpaceId,
            },
          };
        }
      }

      // B2: Indonesian Bank / E-Wallet push notification parser (with 3-Layer Promo Shield)
      if (isPromotionalOrSpamNotification(trimmedText, notifTitle, notifSubtitle)) {
        return { action: "none", isIgnoredPromo: true };
      }

      const bankResult = parseBankNotification(trimmedText, categories, wallets, {
        title: notifTitle,
        subtitle: notifSubtitle,
        sourceApp: notifSourceApp,
        receivedAt: notifReceivedAt,
      });
      if (bankResult && bankResult.amount > 0) {
        const matchedCat = categories.find(
          (c) => c.id === bankResult.suggestedCategoryId,
        );
        const matchedWal = wallets.find(
          (w) => w.id === bankResult.suggestedWalletId,
        );
        const matchedToWal = wallets.find(
          (w) => w.id === bankResult.suggestedToWalletId,
        );

        return {
          action: "transaction",
          autoSave: isAutoRequested,
          fromShortcut: true,
          sourceChannel: "notification",
          spaceId: resolvedSpaceId,
          matchedCategoryName: matchedCat?.name,
          matchedWalletName: matchedWal?.name,
          matchedToWalletName: matchedToWal?.name,
          prefilledValues: {
            amount: bankResult.amount,
            type: bankResult.type,
            note:
              directNote ||
              (bankResult.type === "transfer"
                ? ""
                : bankResult.merchantOrNote || ""),
            category_id:
              bankResult.type === "transfer"
                ? undefined
                : bankResult.suggestedCategoryId,
            categoryId:
              bankResult.type === "transfer"
                ? undefined
                : bankResult.suggestedCategoryId,
            wallet_id: bankResult.suggestedWalletId,
            walletId: bankResult.suggestedWalletId,
            to_wallet_id: bankResult.suggestedToWalletId,
            toWalletId: bankResult.suggestedToWalletId,
            date: bankResult.occurredAt || new Date(),
            time: format(bankResult.occurredAt || new Date(), "HH:mm"),
            spaceId: resolvedSpaceId,
          },
        };
      }

      // B3: Fallback to Slip & Receipt Parser if not already run in B1
      if (!isMultiLineOrSlip) {
        const slipResult = parseSlipText(trimmedText, wallets, categories);
        if (slipResult && slipResult.amount && slipResult.amount > 0) {
          return {
            action: "transaction",
            autoSave: isAutoRequested,
            fromShortcut: true,
            sourceChannel: "screen_scan",
            spaceId: resolvedSpaceId,
            matchedCategoryName: slipResult.categoryName || undefined,
            matchedWalletName: slipResult.sourceWalletName || undefined,
            matchedToWalletName: slipResult.destinationWalletName || undefined,
            prefilledValues: {
              amount: slipResult.amount,
              type: slipResult.type,
              note: directNote || "",
              category_id:
                slipResult.type === "transfer"
                  ? undefined
                  : slipResult.categoryId || undefined,
              categoryId:
                slipResult.type === "transfer"
                  ? undefined
                  : slipResult.categoryId || undefined,
              wallet_id: slipResult.sourceWalletId || undefined,
              walletId: slipResult.sourceWalletId || undefined,
              to_wallet_id: slipResult.destinationWalletId || undefined,
              toWalletId: slipResult.destinationWalletId || undefined,
              date: slipResult.date || new Date(),
              time: slipResult.time || undefined,
              spaceId: resolvedSpaceId,
            },
          };
        }
      }

      // B4: Multi-Item Natural Language Parser (Smart Text / Clipboard / Voice Compound Sentences)
      const multiNlpResults = parseMultiNaturalTransactions(
        trimmedText,
        categories,
        wallets,
        new Date(),
      ).filter((item) => item.amount && item.amount > 0);

      if (multiNlpResults.length >= 2) {
        const batchItems: ParsedStatementItem[] = multiNlpResults.map(
          (item, idx) => {
            const matchedCat =
              categories.find((c) => c.id === item.categoryId) || categories[0];
            const matchedWal =
              wallets.find((w) => w.id === item.walletId) || wallets[0];
            const txDate = item.date || new Date();
            return {
              id: `nlp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              date: format(txDate, "yyyy-MM-dd"),
              time: format(txDate, "HH:mm"),
              description:
                sanitizeDeepLinkNote(item.note) ||
                matchedCat?.name ||
                "Transaksi",
              cleanDescription:
                sanitizeDeepLinkNote(item.note) ||
                matchedCat?.name ||
                "Transaksi",
              amount: item.amount!,
              type: item.type || "expense",
              walletId: matchedWal?.id || null,
              walletName: matchedWal?.name || null,
              destinationWalletId: item.toWalletId || null,
              destinationWalletName: item.toWalletName || null,
              suggestedCategoryId:
                item.type === "transfer"
                  ? null
                  : item.categoryId || matchedCat?.id || null,
              suggestedCategoryName:
                item.type === "transfer"
                  ? null
                  : item.categoryName || matchedCat?.name || null,
              suggestedCategoryEmoji: matchedCat?.emoji || null,
              isDuplicate: false,
              selected: true,
              raw: trimmedText,
              confidence: 0.9,
              needsReview: false,
              spaceId: resolvedSpaceId,
            };
          },
        );
        return {
          action: "batch_review",
          fromShortcut: true,
          sourceChannel: "smart_text",
          spaceId: resolvedSpaceId,
          batchItems,
        };
      }

      // B5: Single Natural Language Transaction parser (e.g., "Kopi tuku 25rb pakai gopay")
      const nlpResult = parseNaturalTransaction(trimmedText, categories, wallets);
      if (nlpResult && nlpResult.amount && nlpResult.amount > 0) {
        const matchedCat =
          categories.find((c) => c.id === nlpResult.categoryId) || categories[0];
        const matchedWal =
          wallets.find((w) => w.id === nlpResult.walletId) || wallets[0];
        const txDate = nlpResult.date || new Date();
        return {
          action: "transaction",
          autoSave: isAutoRequested,
          fromShortcut: true,
          sourceChannel: "smart_text",
          spaceId: resolvedSpaceId,
          matchedCategoryName: matchedCat?.name,
          matchedWalletName: matchedWal?.name,
          prefilledValues: {
            amount: nlpResult.amount,
            type: nlpResult.type || "expense",
            note:
              directNote ||
              sanitizeDeepLinkNote(nlpResult.note) ||
              sanitizeDeepLinkNote(trimmedText.slice(0, 40)),
            category_id: nlpResult.categoryId || matchedCat?.id,
            categoryId: nlpResult.categoryId || matchedCat?.id,
            wallet_id: nlpResult.walletId || matchedWal?.id,
            walletId: nlpResult.walletId || matchedWal?.id,
            date: txDate,
            time: format(txDate, "HH:mm"),
            spaceId: resolvedSpaceId,
          },
        };
      }

      // B6: Fallback if amount couldn't be extracted, open with note
      return {
        action: "transaction",
        autoSave: false,
        fromShortcut: false,
        spaceId: resolvedSpaceId,
        prefilledValues: {
          note: directNote || sanitizeDeepLinkNote(trimmedText.slice(0, 60)),
          type: "expense",
          spaceId: resolvedSpaceId,
        },
      };
    }

    // 7. Case C: Explicit open transaction modal (e.g. `accrual://log?type=...`, `trouvaille://add`)
    if (
      actionPath === "add" ||
      actionPath === "log" ||
      actionPath === "quick-log" ||
      actionPath === "transaction" ||
      actionPath === ""
    ) {
      const logType = (params.get("type") || params.get("tipe"))?.toLowerCase();
      if (logType === "scan") {
        return { action: "scan" };
      }
      const targetType: TransactionType =
        logType === "income"
          ? "income"
          : logType === "transfer"
          ? "transfer"
          : "expense";
      return {
        action: "transaction",
        spaceId: resolvedSpaceId,
        prefilledValues: { type: targetType, spaceId: resolvedSpaceId },
      };
    }

    return { action: "none" };
  } catch (err) {
    console.warn("[DeepLink] Failed to parse deep link URL:", err);
    return { action: "none" };
  }
}
