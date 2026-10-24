import type { Category, Wallet, Transaction, TransactionType } from "./types";
import { parseBankNotification } from "./bankNotificationParser";
import { parseNaturalTransaction } from "./nlpParser";
import { parseSlipText } from "./slipParser";
import { isMultiTransactionHistoryText, parseScreenshotHistory } from "./screenshotHistoryParser";
import type { ParsedStatementItem } from "./statementParser";

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
}

export interface DeepLinkResult {
  action: "transaction" | "voice" | "scan" | "import" | "navigate" | "restore_balance" | "batch_review" | "none";
  path?: string;
  autoSave?: boolean;
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
export function extractTimeComponents(str?: string | null): { hours: number; minutes: number } | null {
  if (!str || typeof str !== "string") return null;
  const match = str.match(/(?:at\s+)?(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\s*([ap]\.?m\.?))?/i);
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
  // Strip leading day names (e.g. "Senin, ", "Monday, ") often produced by iOS Shortcuts
  const clean = dateStr
    .trim()
    .replace(/^(?:senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+/i, "")
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

  // Try standard JS parse only if it has reasonable year (e.g. ISO 8601 or YYYY-MM-DD)
  // NEVER allow loose JS parse on strings like "28" which JS parses as Year 0028 AD!
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

  // Pattern 0: Single day number (e.g. "28" or "28 at 09:30") -> interpret as current month & year
  const singleDayMatch = clean.match(/^(\d{1,2})(?:\s+(?:at|pukul|jam)?\s*[\d:.]+)?$/i);
  if (singleDayMatch) {
    const day = parseInt(singleDayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const now = new Date();
      resolvedDate = new Date(now.getFullYear(), now.getMonth(), day);
    }
  }

  // Pattern A: "28/09/2026", "28-09-2026", "28/09/26" (DD/MM/YYYY or DD-MM-YYYY)
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

  // Pattern B: "28 Sep 2026", "28 September 2026", "28 Okt 2026", "28-Agu-2026"
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

  // Pattern B2: "28 Sep", "28 September" without year -> infer current year
  if (!resolvedDate) {
    const textNoYearMatch = clean.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(?:at|pukul|jam)?\s*[\d:.]+)?$/i);
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

  // Pattern C: YYYY-MM-DD
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
    // Sanity check year: clamp strictly between 2000 and 2100
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
  if (trimmed === "-" || trimmed === "--") return "";
  return trimmed;
}

/**
 * Parses structured multi-line text generated by iOS Shortcuts Dialog / Automation:
 * Format:
 * Nominal: 50.000
 * Kategori: Makanan & Minuman
 * Akun: BCA
 * Catatan: Makan siang
 */
export function parseStructuredShortcutText(
  text: string,
  categories: Category[] = [],
  wallets: Wallet[] = []
): DeepLinkResult | null {
  if (!text || typeof text !== "string") return null;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let rawAmount: string | undefined;
  let rawCategory: string | undefined;
  let rawWallet: string | undefined;
  let rawToWallet: string | undefined;
  let rawNote: string | undefined;
  let rawDate: string | undefined;
  let rawType: TransactionType | undefined;
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
        key === "source"
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
        key === "deskripsi"
      ) {
        hasStructuredKey = true;
        rawNote = sanitizeDeepLinkNote(val);
      } else if (key === "tanggal" || key === "date" || key === "datetime" || key === "waktu" || key === "time") {
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
      (rawCategory && rawCategory.toLowerCase().includes(c.name.toLowerCase()))
  );
  if (!matchedCat && categories.length > 0) {
    matchedCat = categories.find((c) => c.type !== "income") || categories[0];
  }

  let matchedWal = wallets.find(
    (w) =>
      (rawWallet && w.id.toLowerCase() === rawWallet.toLowerCase()) ||
      (rawWallet && w.name.toLowerCase() === rawWallet.toLowerCase()) ||
      (rawWallet && w.name.toLowerCase().includes(rawWallet.toLowerCase())) ||
      (rawWallet && rawWallet.toLowerCase().includes(w.name.toLowerCase()))
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
        rawToWallet.toLowerCase().includes(w.name.toLowerCase())
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
    : undefined;

  return {
    action: "transaction",
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
    },
  };
}

/**
 * Parses incoming URL scheme strings (e.g. `trouvaille://add?text=...`, `trouvaille://voice`, etc.)
 * or standard web search parameters.
 */
export function parseDeepLink(
  urlString: string,
  categories: Category[] = [],
  wallets: Wallet[] = [],
  existingTransactions: Transaction[] = []
): DeepLinkResult {
  if (!urlString || typeof urlString !== "string") {
    return { action: "none" };
  }

  try {
    // Standardize URL scheme to a valid dummy HTTP URL for safe URLSearchParams parsing
    let targetUrl = urlString.trim();
    if (targetUrl.startsWith("?")) {
      targetUrl = `https://accrual.internal/${targetUrl}`;
    } else if (/^(?:accrual|trouvaille):\/\//i.test(targetUrl)) {
      targetUrl = targetUrl.replace(/^(?:accrual|trouvaille):\/\//i, "https://accrual.internal/");
    } else if (!/^https?:\/\//i.test(targetUrl)) {
      return { action: "none" };
    }

    const qIndex = targetUrl.indexOf("?");
    let safeUrl = targetUrl;
    if (qIndex !== -1) {
      const base = targetUrl.slice(0, qIndex);
      let query = targetUrl.slice(qIndex + 1);

      // 1. Replace raw spaces with %20
      query = query.replace(/ /g, "%20");

      // 2. Protect parameter delimiter '&' by encoding literal '&' that are part of values (e.g. Makanan & Minuman)
      const tokens = query.split("&");
      const reconstructedTokens: string[] = [];
      const isKnownParamKey = (t: string) =>
        /^(?:action|mode|text|teks|title|q|ocr|content|amount|nominal|note|catatan|deskripsi|type|tipe|category|kategori|category_id|categoryid|wallet|rekening|dompet|akun|account|wallet_id|walletid|dari|to_wallet|to_wallet_id|towallet|ke|tujuan|date|tanggal|datetime|time|waktu|autosave|auto|otomatis)=/i.test(t);

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (i === 0 || isKnownParamKey(token)) {
          reconstructedTokens.push(token);
        } else {
          // Token is a continuation of the previous parameter value that had an unencoded '&' (e.g. "Minuman" from "Makanan & Minuman")
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

    // 1. Direct modal routing actions (via path, ?mode=, or ?action=)
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
    if (actionPath === "voice" || params.get("mode") === "voice" || params.get("action") === "voice") {
      return { action: "voice" };
    }
    if (actionPath === "scan" || params.get("mode") === "scan" || params.get("action") === "scan") {
      return { action: "scan" };
    }
    if (actionPath === "import" || params.get("mode") === "import" || params.get("action") === "import") {
      return { action: "import" };
    }
    if (
      actionPath === "capture" ||
      params.get("mode") === "capture" ||
      params.get("action") === "capture"
    ) {
      const captureText =
        params.get("text") ||
        params.get("teks") ||
        params.get("content") ||
        params.get("ocr");
      if (captureText && isMultiTransactionHistoryText(captureText)) {
        const batchItems = parseScreenshotHistory(captureText, existingTransactions, categories, wallets);
        if (batchItems && batchItems.length > 0) {
          return { action: "batch_review", batchItems };
        }
      }
    }
    if (params.get("action") === "add") {
      return { action: "transaction" };
    }

    // 2. Direct tab navigation routes & Widget deep-link aliases
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

    // 2. Extract potential parameter tokens
    const rawText =
      params.get("text") ||
      params.get("teks") ||
      params.get("title") ||
      params.get("q") ||
      params.get("ocr") ||
      params.get("content");
    const directAmount = params.get("amount") || params.get("nominal");
    const directNote = sanitizeDeepLinkNote(
      params.get("note") || params.get("catatan") || params.get("deskripsi")
    );
    const directType = (params.get("type") || params.get("tipe")) as TransactionType | null;
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
      params.get("wallet_id") ||
      params.get("walletId") ||
      params.get("dari");
    const directToWallet =
      params.get("to_wallet") ||
      params.get("to_wallet_id") ||
      params.get("toWallet") ||
      params.get("ke") ||
      params.get("tujuan");
    const directDate = params.get("date") || params.get("tanggal") || params.get("datetime");
    const directTime = params.get("time") || params.get("waktu");

    // Case A: Direct structured parameters (e.g. from Siri Shortcuts with ask for input / Dialog)
    if (directAmount) {
      const cleanNum = parseCurrencyAmount(directAmount);
      let matchedCat = categories.find(
        (c) =>
          (directCategory && c.id.toLowerCase() === directCategory.toLowerCase()) ||
          (directCategory && c.name.toLowerCase() === directCategory.toLowerCase()) ||
          (directCategory && c.name.toLowerCase().includes(directCategory.toLowerCase())) ||
          (directCategory && directCategory.toLowerCase().includes(c.name.toLowerCase()))
      );
      if (!matchedCat && categories.length > 0) {
        matchedCat = categories.find((c) => c.type !== "income") || categories[0];
      }

      let matchedWal = wallets.find(
        (w) =>
          (directWallet && w.id.toLowerCase() === directWallet.toLowerCase()) ||
          (directWallet && w.name.toLowerCase() === directWallet.toLowerCase()) ||
          (directWallet && w.name.toLowerCase().includes(directWallet.toLowerCase())) ||
          (directWallet && directWallet.toLowerCase().includes(w.name.toLowerCase()))
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
            directToWallet.toLowerCase().includes(w.name.toLowerCase())
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
      const timeComp = extractTimeComponents(combinedDateStr) || extractTimeComponents(directTime);
      const effectiveTime = timeComp
        ? `${String(timeComp.hours).padStart(2, "0")}:${String(timeComp.minutes).padStart(2, "0")}`
        : directTime || undefined;

      const autoParam = (params.get("autosave") || params.get("auto") || params.get("otomatis") || "").toLowerCase();
      // Auto-save only if explicitly requested (opt-in) to prevent unintended auto-inserts
      const shouldAutoSave = (autoParam === "true" || autoParam === "1" || autoParam === "ya") && !isNaN(cleanNum) && cleanNum > 0;

      const effectiveType: TransactionType =
        directType === "income"
          ? "income"
          : directType === "transfer" || matchedToWal
          ? "transfer"
          : "expense";

      return {
        action: "transaction",
        autoSave: shouldAutoSave,
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
        },
      };
    }

    // Case B: Raw text provided (from iOS Back Tap OCR / Shortcuts Notification Automations / Dialog Shortcuts)
    if (rawText) {
      const trimmedText = rawText.trim();
      const autoParam = (params.get("autosave") || params.get("auto") || params.get("otomatis") || "").toLowerCase();
      const isAutoRequested = autoParam === "true" || autoParam === "1" || autoParam === "ya";

      // B-Pre: Multi-Transaction Screenshot History Check (GoPay Riwayat, Shopee, BCA Mutasi)
      if (isMultiTransactionHistoryText(trimmedText)) {
        const batchItems = parseScreenshotHistory(trimmedText, existingTransactions, categories, wallets);
        if (batchItems && batchItems.length >= 2) {
          return {
            action: "batch_review",
            batchItems,
          };
        } else if (batchItems && batchItems.length === 1) {
          const single = batchItems[0];
          return {
            action: "transaction",
            autoSave: isAutoRequested,
            matchedCategoryName: single.suggestedCategoryName || undefined,
            matchedWalletName: single.walletName || undefined,
            matchedToWalletName: single.destinationWalletName || undefined,
            prefilledValues: {
              amount: single.amount,
              type: single.type,
              note: single.cleanDescription || single.description,
              category_id: single.type === "transfer" ? undefined : (single.suggestedCategoryId || undefined),
              categoryId: single.type === "transfer" ? undefined : (single.suggestedCategoryId || undefined),
              wallet_id: single.walletId || undefined,
              walletId: single.walletId || undefined,
              to_wallet_id: single.destinationWalletId || undefined,
              toWalletId: single.destinationWalletId || undefined,
              date: single.date ? new Date(single.date) : new Date(),
              time: single.time,
            },
          };
        }
      }

      // B0: Structured Shortcut Text (from iOS Dialog Shortcuts: "Nominal: ...\nKategori: ...\nAkun: ...\nCatatan: ...")
      const structuredResult = parseStructuredShortcutText(trimmedText, categories, wallets);
      if (structuredResult && structuredResult.prefilledValues?.amount && structuredResult.prefilledValues.amount > 0) {
        return {
          ...structuredResult,
          autoSave: isAutoRequested,
        };
      }

      const isMultiLineOrSlip =
        trimmedText.includes("\n") ||
        trimmedText.includes("\r") ||
        trimmedText.length > 70 ||
        /(?:struk|nota|total|subtotal|biaya admin|rekening|pengirim|penerima|no\.?\s*referensi|bi-fast|bukti transfer|transfer berhasil|transaksi berhasil)/i.test(trimmedText);

      // B1: If multi-line OCR text or matches slip characteristics (Back Tap Live Text OCR output),
      // prioritize parseSlipText so transfer slips (e.g. SeaBank -> ShopeePay) are accurately parsed!
      if (isMultiLineOrSlip) {
        const slipResult = parseSlipText(trimmedText, wallets, categories);
        if (slipResult && slipResult.amount && slipResult.amount > 0) {
          return {
            action: "transaction",
            autoSave: isAutoRequested,
            matchedCategoryName: slipResult.categoryName || undefined,
            matchedWalletName: slipResult.sourceWalletName || undefined,
            matchedToWalletName: slipResult.destinationWalletName || undefined,
            prefilledValues: {
              amount: slipResult.amount,
              type: slipResult.type,
              note: directNote || "", // Strictly empty note for scanned receipts/slips unless explicit directNote
              category_id: slipResult.type === "transfer" ? undefined : (slipResult.categoryId || undefined),
              categoryId: slipResult.type === "transfer" ? undefined : (slipResult.categoryId || undefined),
              wallet_id: slipResult.sourceWalletId || undefined,
              walletId: slipResult.sourceWalletId || undefined,
              to_wallet_id: slipResult.destinationWalletId || undefined,
              toWalletId: slipResult.destinationWalletId || undefined,
              date: slipResult.date || new Date(),
              time: slipResult.time || undefined,
            },
          };
        }
      }

      // B2: Indonesian Bank / E-Wallet push notification parser (single-line notifications from iOS notification center)
      const bankResult = parseBankNotification(trimmedText, categories, wallets);
      if (bankResult && bankResult.amount > 0) {
        const matchedCat = categories.find((c) => c.id === bankResult.suggestedCategoryId);
        const matchedWal = wallets.find((w) => w.id === bankResult.suggestedWalletId);
        const matchedToWal = wallets.find((w) => w.id === bankResult.suggestedToWalletId);

        return {
          action: "transaction",
          autoSave: isAutoRequested,
          matchedCategoryName: matchedCat?.name,
          matchedWalletName: matchedWal?.name,
          matchedToWalletName: matchedToWal?.name,
          prefilledValues: {
            amount: bankResult.amount,
            type: bankResult.type,
            note: directNote || (bankResult.type === "transfer" ? "" : (bankResult.merchantOrNote || "")),
            category_id: bankResult.type === "transfer" ? undefined : bankResult.suggestedCategoryId,
            categoryId: bankResult.type === "transfer" ? undefined : bankResult.suggestedCategoryId,
            wallet_id: bankResult.suggestedWalletId,
            walletId: bankResult.suggestedWalletId,
            to_wallet_id: bankResult.suggestedToWalletId,
            toWalletId: bankResult.suggestedToWalletId,
            date: new Date(),
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
            matchedCategoryName: slipResult.categoryName || undefined,
            matchedWalletName: slipResult.sourceWalletName || undefined,
            matchedToWalletName: slipResult.destinationWalletName || undefined,
            prefilledValues: {
              amount: slipResult.amount,
              type: slipResult.type,
              note: directNote || "",
              category_id: slipResult.type === "transfer" ? undefined : (slipResult.categoryId || undefined),
              categoryId: slipResult.type === "transfer" ? undefined : (slipResult.categoryId || undefined),
              wallet_id: slipResult.sourceWalletId || undefined,
              walletId: slipResult.sourceWalletId || undefined,
              to_wallet_id: slipResult.destinationWalletId || undefined,
              toWalletId: slipResult.destinationWalletId || undefined,
              date: slipResult.date || new Date(),
              time: slipResult.time || undefined,
            },
          };
        }
      }

      // B4: Try Natural Language Transaction parser (e.g., "Kopi tuku 25rb pakai gopay")
      const nlpResult = parseNaturalTransaction(trimmedText, categories, wallets);
      if (nlpResult && nlpResult.amount && nlpResult.amount > 0) {
        const matchedCat = categories.find((c) => c.id === nlpResult.categoryId) || categories[0];
        const matchedWal = wallets.find((w) => w.id === nlpResult.walletId) || wallets[0];
        return {
          action: "transaction",
          autoSave: isAutoRequested,
          matchedCategoryName: matchedCat?.name,
          matchedWalletName: matchedWal?.name,
          prefilledValues: {
            amount: nlpResult.amount,
            type: nlpResult.type || "expense",
            note: directNote || sanitizeDeepLinkNote(nlpResult.note) || sanitizeDeepLinkNote(trimmedText.slice(0, 40)),
            category_id: nlpResult.categoryId || matchedCat?.id,
            categoryId: nlpResult.categoryId || matchedCat?.id,
            wallet_id: nlpResult.walletId || matchedWal?.id,
            walletId: nlpResult.walletId || matchedWal?.id,
            date: new Date(),
          },
        };
      }

      // B5: Fallback if amount couldn't be extracted, open with note
      return {
        action: "transaction",
        autoSave: false,
        prefilledValues: {
          note: directNote || sanitizeDeepLinkNote(trimmedText.slice(0, 60)),
          type: "expense",
        },
      };
    }

    // Case C: Explicit open transaction modal (e.g. `accrual://log?type=...`, `trouvaille://add` or `trouvaille://transaction`)
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
        logType === "income" ? "income" : logType === "transfer" ? "transfer" : "expense";
      return {
        action: "transaction",
        prefilledValues: { type: targetType },
      };
    }

    return { action: "none" };
  } catch (err) {
    console.warn("[DeepLink] Failed to parse deep link URL:", err);
    return { action: "none" };
  }
}
