// ======================================================================
// TROUVAILLE BANK E-STATEMENT & TABULAR / CSV INGESTION ENGINE v2.1
// Deterministic, offline client-side parser for Indonesian bank statements
// Supports: BCA, Mandiri, Jenius, GoPay, SeaBank, OVO, DANA, BRI, BNI,
//           Permata, CIMB, ShopeePay + Generic CSV/TSV/PDF
// Includes quote-safe CSV parsing, internal wallet matching, and
// dual-key fuzzy deduplication.
// ======================================================================

import { format, parse, isValid } from "date-fns";
import type { Transaction, Category, TransactionType, Wallet } from "./types";
import { resolveTransactionCategory } from "./categoryResolver";
import { detectColumns, type DetectedColumnMap } from "./csvColumnDetector";
import { parseDelimitedText } from "./csvParser";

export interface ParsedStatementItem {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  description: string;
  cleanDescription: string;
  amount: number;
  type: TransactionType; // "income" | "expense" | "transfer"
  walletId?: string | null;
  walletName?: string | null;
  destinationWalletId?: string | null;
  destinationWalletName?: string | null;
  balance?: number;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  suggestedCategoryEmoji: string | null;
  isDuplicate: boolean;
  duplicateReason?: string;
  selected: boolean;
  raw: string;
  confidence?: number;
  needsReview?: boolean;
  spaceId?: string | null;
  spaceName?: string | null;
  matchedBill?: {
    id: string;
    title: string;
    amount?: number | null;
    exactAmountMatch: boolean;
    confirmedPaid: boolean;
  } | null;
}

export type StatementFormat =
  | "bca"
  | "mandiri"
  | "jenius"
  | "gopay"
  | "seabank"
  | "ovo"
  | "dana"
  | "bri"
  | "bni"
  | "permata"
  | "cimb"
  | "shopeepay"
  | "generic_csv"
  | "generic_pdf";

export interface ParseStatementResult {
  detectedFormat: StatementFormat;
  items: ParsedStatementItem[];
  /** Detected column mapping (only set for CSV/Excel inputs) */
  columnMap?: DetectedColumnMap;
  /** Unique wallet/account names found in the file that do not exist yet */
  newWalletsDetected: string[];
  /** Unique category names found in the file that do not exist yet */
  newCategoriesDetected: string[];
  summary: {
    totalInflow: number;
    totalOutflow: number;
    totalTransfer: number;
    duplicateCount: number;
    validCount: number;
  };
};

// -----------------------------------------------------------------------
// Number Parser — handles Indonesian & US number formats
// -----------------------------------------------------------------------

export function parseLocalizedNumber(raw: string): number {
  if (!raw) return 0;
  let clean = raw.trim().replace(/[^\d.,\-+]/g, "");

  // Indonesian: 1.250.000,00 (dot=thousands, comma=decimal)
  if (clean.includes(".") && clean.includes(",")) {
    if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,250,000.00
      clean = clean.replace(/,/g, "");
    }
  } else if (clean.includes(",")) {
    if (/,\d{2}$/.test(clean)) {
      clean = clean.replace(",", ".");
    } else {
      clean = clean.replace(/,/g, "");
    }
  } else if (clean.includes(".")) {
    // 50.000 or 1.500.000 → thousands separator
    if (/\.\d{3}/.test(clean) && !/\.\d{2}$/.test(clean)) {
      clean = clean.replace(/\./g, "");
    }
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.abs(num);
}

// -----------------------------------------------------------------------
// Date Normalizer — handles DD/MM/YYYY, DD/MM, YYYY-MM-DD, "14 Sep 2026"
// -----------------------------------------------------------------------

export function normalizeDateString(
  dateStr: string,
  defaultYear = new Date().getFullYear()
): string {
  const trimmed = dateStr.trim();
  const currentYearStr = String(defaultYear);

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyFull = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyFull) {
    const [, day, month, year] = dmyFull;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // DD/MM (BCA style — assume current year)
  const dmyShort = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dmyShort) {
    const [, day, month] = dmyShort;
    return `${currentYearStr}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // YYYY-MM-DD (ISO)
  const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // "14 Sep 2026" or "14 Sep" (Jenius / Eng-locale)
  try {
    const parsedWithYear = parse(trimmed, "dd MMM yyyy", new Date());
    if (isValid(parsedWithYear)) return format(parsedWithYear, "yyyy-MM-dd");

    const parsedShort = parse(trimmed, "dd MMM", new Date());
    if (isValid(parsedShort)) {
      parsedShort.setFullYear(defaultYear);
      return format(parsedShort, "yyyy-MM-dd");
    }
  } catch {
    // fallback below
  }

  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Normalizes time string (HH:mm:ss, HH:mm, or 12h) to standard HH:mm:ss.
 */
export function normalizeTimeString(timeStr?: string): string | undefined {
  if (!timeStr) return undefined;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const [, h, m, s] = match;
    const hours = h.padStart(2, "0");
    const minutes = m.padStart(2, "0");
    const seconds = s ? s.padStart(2, "0") : "00";
    return `${hours}:${minutes}:${seconds}`;
  }
  return undefined;
}

/**
 * Sanitizes note by stripping placeholder characters like "-", "--", "n/a" to clean empty string.
 */
export function sanitizeNote(note: string): string {
  if (!note) return "";
  const trimmed = note.trim();
  if (/^[-–—\s]+$/.test(trimmed) || /^(n\/a|none|null|\.)$/i.test(trimmed)) {
    return "";
  }
  return trimmed;
}

/**
 * Normalizes multi-byte arrow artifacts (â†’, \u2192, \u21D2, -->, ->, =>),
 * non-breaking spaces (\u00A0), zero-width spaces (\u200B), and language prepositions ('to', 'ke')
 * into standard clean "→".
 */
export function sanitizeTransferArrowText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/â†’/g, "→")
    .replace(/[\u2192\u21D2\u2794\u279C\u27A1]/g, "→")
    .replace(/\s*(?:-->|->|=>|\bto\b|\bke\b)\s*/gi, " → ")
    .replace(/\s*→\s*/g, " → ")
    .trim();
}

// -----------------------------------------------------------------------
// Bank Narration Cleaner
// -----------------------------------------------------------------------

export function cleanBankNarration(raw: string): string {
  if (!raw) return "Transaction";
  let text = raw.trim();

  text = text
    // Common Indonesian bank metadata prefixes
    .replace(/\b(TRSF|TRANSFER|E-BANKING|M-BCA|M-BANKING|QRIS|BI-FAST|BIFAST|LLG|RTGS|WS\d+|FTSCY|SWITCHING)\b/gi, "")
    .replace(/\b(CR|DB|D\/K|DEBET|KREDIT)\b/gi, "")
    .replace(/\b0{4,}\b/g, "")
    .replace(/\d{4,}\/\w+\/\w+/g, "")
    // SeaBank / OVO / DANA / GoPay prefixes
    .replace(/\b(SEABANK|SEA BANK|OVO CASH|OVO TRANSFER|DANA|GOPAY|SHOPEEPAY|SPAY)\b/gi, "")
    .replace(/\b(TRFIN|TRFOUT|TRFMASUK|TRFKELUAR)\b/gi, "")
    .replace(/\b(BAYAR|PAYMENT|TOP.?UP|TOPUP|PULSA|AUTODEBET|AUTOPAY|TAGIHAN|CICILAN)\b/gi, "")
    // BRI / BNI noise
    .replace(/\b(BRIMO|WONDR|IBANK|MOBILE BANKING)\b/gi, "")
    // Generic batch/trans IDs
    .replace(/[A-Z]{2,4}\d{6,}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return text || raw.trim();
}

// -----------------------------------------------------------------------
// Format Detector
// -----------------------------------------------------------------------

export function detectStatementFormat(rawText: string): StatementFormat {
  const lower = rawText.toLowerCase();

  // E-wallet specific
  if (lower.includes("gopay") || (lower.includes("pembayaran") && lower.includes("berhasil") && lower.includes("gojek"))) {
    return "gopay";
  }
  if (lower.includes("shopeepay") || (lower.includes("spay") && lower.includes("shopee"))) {
    return "shopeepay";
  }
  if (lower.includes("ovo cash") || lower.includes("ovo transfer") || lower.includes("pt visionet")) {
    return "ovo";
  }
  if (lower.includes("dompet digital dana") || (lower.includes("dana") && lower.includes("transfer berhasil"))) {
    return "dana";
  }

  // Bank specific
  if (lower.includes("seabank") || lower.includes("sea bank")) {
    return "seabank";
  }
  if (lower.includes("jenius") || lower.includes("money out") || lower.includes("money in")) {
    return "jenius";
  }
  if (lower.includes("m-bca") || lower.includes("trsf e-banking") || lower.includes("klik bca")) {
    return "bca";
  }
  if (/\b(db|cr)\b/i.test(rawText) && /^\s*\d{1,2}\/\d{1,2}\s+/m.test(rawText)) {
    return "bca";
  }
  if (lower.includes("livin") || lower.includes("bank mandiri")) {
    return "mandiri";
  }
  if (/\b[dk]\s+[\d.,]+/i.test(rawText) && !lower.includes("wondr")) {
    return "mandiri";
  }
  if (lower.includes("brimo") || lower.includes("bank rakyat indonesia")) {
    return "bri";
  }
  if (lower.includes("wondr") || lower.includes("bank negara indonesia")) {
    return "bni";
  }
  if (lower.includes("permatanet") || lower.includes("bank permata")) {
    return "permata";
  }
  if (lower.includes("octo") || lower.includes("cimb niaga")) {
    return "cimb";
  }

  // Generic PDF (multi-page extracted text)
  if (rawText.length > 3000 && lower.includes("mutasi rekening")) {
    return "generic_pdf";
  }

  // Generic CSV/TSV detection
  const nonBlankLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const firstLine = nonBlankLines[0] || "";
  const strippedFirstLine = firstLine.replace(/\d+,\d+/g, "");
  if (strippedFirstLine.includes(",") || firstLine.includes(";") || firstLine.includes("\t")) {
    return "generic_csv";
  }

  return "bca";
}

// -----------------------------------------------------------------------
// Match internal user wallet from transaction description
// -----------------------------------------------------------------------

function matchDestinationWallet(description: string, wallets: Wallet[] = []): Wallet | null {
  if (!description || wallets.length === 0) return null;
  const lowerDesc = description.toLowerCase();

  for (const w of wallets) {
    const wName = w.name.toLowerCase().trim();
    if (wName.length < 3) continue;
    const escaped = wName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(lowerDesc) || lowerDesc.includes(wName)) {
      return w;
    }
  }
  return null;
}

// -----------------------------------------------------------------------
// MAIN PARSER
// -----------------------------------------------------------------------

export function parseStatementText(
  rawText: string,
  existingTransactions: Transaction[] = [],
  categories: Category[] = [],
  columnMap?: DetectedColumnMap,
  wallets: Wallet[] = []
): ParseStatementResult {
  if (!rawText.trim()) {
    return {
      detectedFormat: "generic_csv",
      items: [],
      newWalletsDetected: [],
      newCategoriesDetected: [],
      summary: { totalInflow: 0, totalOutflow: 0, totalTransfer: 0, duplicateCount: 0, validCount: 0 },
    };
  }

  const detectedFormat = detectStatementFormat(rawText);
  const items: ParsedStatementItem[] = [];

  // Build dedup lookup from existing transactions
  // Normalize occurred_on to YYYY-MM-DD so comparisons work whether occurred_on has a full ISO time or not
  const existingMap = new Map<string, boolean>();
  const existing48hMap = new Map<string, boolean>();

  for (const tx of existingTransactions) {
    const rawOccurred = tx.occurred_on || "";
    const txDate = rawOccurred.length >= 10 ? rawOccurred.slice(0, 10) : rawOccurred;
    const roundedAmt = Math.round(Number(tx.amount) / 1000) * 1000;
    const noteSlug = (tx.note || "").toLowerCase().replace(/\s+/g, "").slice(0, 20);

    // Exact day keys
    const key1 = `${txDate}_${Math.round(Number(tx.amount))}_${tx.type}`;
    const key2 = `${txDate}_${roundedAmt}_${tx.type}_${noteSlug}`;
    existingMap.set(key1, true);
    existingMap.set(key2, true);

    // 48-hour tolerance (adjacent day keys: D-1 and D+1) for Rule 8.1
    try {
      const parsedD = parse(txDate, "yyyy-MM-dd", new Date());
      if (isValid(parsedD)) {
        const prevDay = new Date(parsedD.getTime() - 86400000);
        const nextDay = new Date(parsedD.getTime() + 86400000);
        const prevStr = format(prevDay, "yyyy-MM-dd");
        const nextStr = format(nextDay, "yyyy-MM-dd");
        existing48hMap.set(`${prevStr}_${Math.round(Number(tx.amount))}_${tx.type}`, true);
        existing48hMap.set(`${nextStr}_${Math.round(Number(tx.amount))}_${tx.type}`, true);
        if (noteSlug) {
          existing48hMap.set(`${prevStr}_${roundedAmt}_${tx.type}_${noteSlug}`, true);
          existing48hMap.set(`${nextStr}_${roundedAmt}_${tx.type}_${noteSlug}`, true);
        }
      }
    } catch {
      // ignore date parse errors
    }
  }

  let idCounter = 1;

  // ----------------------------------------------------------------
  // Generic CSV parsing using PapaParse (quote-safe, delimiter-adaptive)
  // ----------------------------------------------------------------
  const isCSVLike =
    detectedFormat === "generic_csv" ||
    detectedFormat === "gopay" ||
    detectedFormat === "shopeepay" ||
    detectedFormat === "ovo" ||
    detectedFormat === "dana";

  if (isCSVLike) {
    const parsedCSV = parseDelimitedText(rawText);
    const rows = parsedCSV.rows;
    let resolvedColumnMap = columnMap;

    if (!resolvedColumnMap) {
      resolvedColumnMap = detectColumns(parsedCSV.headers, rows);
    }

    const cm = resolvedColumnMap;

    for (const cols of rows) {
      if (!cols || cols.length === 0) continue;
      const dateStr = cols[cm.dateCol] || "";
      let timeStr = cm.timeCol !== null && cols[cm.timeCol] ? cols[cm.timeCol].trim() : "";
      if (!timeStr && dateStr) {
        // Look for inline time: "2025-01-21T14:30:00" or "2025-01-21 14:30" or "21/01/2025 14:30:00"
        const inlineTimeMatch = dateStr.match(/[T\s](\d{1,2}:\d{2}(?::\d{2})?)/i);
        if (inlineTimeMatch) {
          timeStr = inlineTimeMatch[1];
        }
      }
      const description = cols[cm.descCol] || "";
      let amount = 0;
      let type: TransactionType = "expense";

      if (cm.debitCol !== null && cm.creditCol !== null) {
        const debitVal = parseLocalizedNumber(cols[cm.debitCol] || "");
        const creditVal = parseLocalizedNumber(cols[cm.creditCol] || "");
        if (creditVal > 0 && debitVal === 0) {
          amount = creditVal;
          type = "income";
        } else if (debitVal > 0 && creditVal === 0) {
          amount = debitVal;
          type = "expense";
        } else if (debitVal > 0 && creditVal > 0) {
          if (creditVal > debitVal) {
            amount = creditVal;
            type = "income";
          } else {
            amount = debitVal;
            type = "expense";
          }
        }
      } else if (cm.debitCol !== null) {
        const v = parseLocalizedNumber(cols[cm.debitCol] || "");
        if (v > 0) {
          amount = v;
          type = "expense";
        }
      } else if (cm.creditCol !== null) {
        const v = parseLocalizedNumber(cols[cm.creditCol] || "");
        if (v > 0) {
          amount = v;
          type = "income";
        }
      } else if (cm.amountCol !== null) {
        amount = parseLocalizedNumber(cols[cm.amountCol] || "");
        if (cm.typeCol !== null) {
          const typeCell = (cols[cm.typeCol] || "").toLowerCase();
          if (/kredit|cr|income|masuk|pemasukan/.test(typeCell)) {
            type = "income";
          } else if (/pindah saldo|transfer|antar rekening/.test(typeCell)) {
            type = "transfer";
          } else if (/debet|db|expense|keluar|pengeluaran/.test(typeCell)) {
            type = "expense";
          }
        } else {
          const rowText = cols.join(" ").toLowerCase();
          if (/\b(pindah saldo|antar rekening)\b/.test(rowText)) type = "transfer";
          else if (/\b(cr|kredit|pemasukan|income|masuk)\b/.test(rowText)) type = "income";
        }
      }

      if (!amount || amount <= 0) continue;

      const normalizedDate = normalizeDateString(dateStr || new Date().toISOString());
      const normalizedTime = normalizeTimeString(timeStr);
      const cleanDesc = cleanBankNarration(description);
      const sanitizedDescription = sanitizeNote(description);
      const sanitizedCleanDesc = sanitizeNote(cleanDesc);

      // Multi-wallet & transfer arrow extraction from row (if file has an account/wallet column)
      let itemWalletId: string | null = null;
      let itemWalletName: string | null = null;
      let destinationWalletId: string | null = null;
      let destinationWalletName: string | null = null;

      if (cm.walletCol !== null && cols[cm.walletCol]) {
        const rawWallet = sanitizeTransferArrowText(cols[cm.walletCol]);
        if (rawWallet) {
          // Check for transfer arrow pattern: "BNI → Blu"
          const arrowParts = rawWallet.split(" → ");
          if (arrowParts.length === 2 && arrowParts[0].trim() && arrowParts[1].trim()) {
            type = "transfer";
            const srcName = arrowParts[0].trim();
            const dstName = arrowParts[1].trim();
            itemWalletName = srcName;
            destinationWalletName = dstName;

            const matchedSrc = wallets.find(
              (w) => w.name.toLowerCase().trim() === srcName.toLowerCase()
            );
            if (matchedSrc) {
              itemWalletId = matchedSrc.id;
              itemWalletName = matchedSrc.name;
            }

            const matchedDst = wallets.find(
              (w) => w.name.toLowerCase().trim() === dstName.toLowerCase()
            );
            if (matchedDst) {
              destinationWalletId = matchedDst.id;
              destinationWalletName = matchedDst.name;
            }
          } else {
            itemWalletName = rawWallet;
            const matchedW = wallets.find(
              (w) => w.name.toLowerCase().trim() === rawWallet.toLowerCase()
            );
            if (matchedW) {
              itemWalletId = matchedW.id;
              itemWalletName = matchedW.name;
            }
          }
        }
      }

      // Category extraction from row (if file has a category column)
      let itemCategoryId: string | null = null;
      let itemCategoryName: string | null = null;
      let itemCategoryEmoji: string | null = null;

      if (cm.categoryCol !== null && cols[cm.categoryCol]) {
        const rawCat = cols[cm.categoryCol].trim();
        if (rawCat) {
          itemCategoryName = rawCat;
          const matchedC = categories.find(
            (c) => c.name.toLowerCase().trim() === rawCat.toLowerCase()
          );
          if (matchedC) {
            itemCategoryId = matchedC.id;
            itemCategoryName = matchedC.name;
            itemCategoryEmoji = matchedC.emoji;
          }
        }
      }

      // If category not explicitly defined in row, resolve via semantic classifier
      if (!itemCategoryName) {
        const mockTx: Partial<Transaction> = {
          note: `${sanitizedCleanDesc} ${sanitizedDescription}`.trim(),
          type,
          amount,
        };
        const resolvedCat = resolveTransactionCategory(mockTx, categories);
        itemCategoryId = resolvedCat.id || null;
        itemCategoryName = resolvedCat.name;
        itemCategoryEmoji = resolvedCat.emoji;
      }

      // Arrow Transfer in Description check (e.g. "BCA → Mandiri", "ShopeePay -> Cash", "BNI ke Blu")
      const arrowCleanedDesc = sanitizeTransferArrowText(description || cleanDesc);
      const arrowParts = arrowCleanedDesc.split(" → ");
      if (arrowParts.length === 2 && arrowParts[0].trim() && arrowParts[1].trim()) {
        const srcCandidate = arrowParts[0].trim();
        const dstCandidate = arrowParts[1].trim();

        const matchedSrc = wallets.find(
          (w) => w.name.toLowerCase().trim() === srcCandidate.toLowerCase()
        );
        const matchedDst = wallets.find(
          (w) => w.name.toLowerCase().trim() === dstCandidate.toLowerCase()
        );

        if (matchedSrc || matchedDst || type === "transfer") {
          type = "transfer";
          if (matchedSrc) {
            itemWalletId = matchedSrc.id;
            itemWalletName = matchedSrc.name;
          } else if (!itemWalletName) {
            itemWalletName = srcCandidate;
          }

          if (matchedDst) {
            destinationWalletId = matchedDst.id;
            destinationWalletName = matchedDst.name;
          } else if (!destinationWalletName) {
            destinationWalletName = dstCandidate;
          }
        }
      }

      // Transfer vs Expense check
      const isTransferSignal = /\b(transfer ke|kirim ke|to rekening|ke rek|top.?up|isi saldo|pindah saldo)\b/i.test(description);
      if (type === "expense" && isTransferSignal) {
        const matched = matchDestinationWallet(description, wallets);
        if (matched) {
          type = "transfer";
          destinationWalletId = matched.id;
          destinationWalletName = matched.name;
        }
      }

      const roundedAmt = Math.round(amount / 1000) * 1000;
      const noteSlug = (sanitizedCleanDesc || sanitizedDescription || "tx").toLowerCase().replace(/\s+/g, "").slice(0, 20);
      const dedupKey1 = `${normalizedDate}_${Math.round(amount)}_${type}`;
      const dedupKey2 = `${normalizedDate}_${roundedAmt}_${type}_${noteSlug}`;
      const isExactDuplicate = existingMap.has(dedupKey1) || existingMap.has(dedupKey2);
      const is48hDuplicate = !isExactDuplicate && (existing48hMap.has(dedupKey1) || existing48hMap.has(dedupKey2));

      const isDuplicate = isExactDuplicate || is48hDuplicate;
      const duplicateReason = isExactDuplicate
        ? `Sama dengan transaksi ${type} pada ${normalizedDate} (${amount.toLocaleString()})`
        : is48hDuplicate
        ? `Kemungkinan duplikat (toleransi 48 jam) ${type} (${amount.toLocaleString()})`
        : undefined;

      items.push({
        id: `stmt-tx-${Date.now()}-${idCounter++}`,
        date: normalizedDate,
        time: normalizedTime,
        description: sanitizedDescription,
        cleanDescription: sanitizedCleanDesc,
        amount,
        type,
        walletId: itemWalletId,
        walletName: itemWalletName,
        destinationWalletId,
        destinationWalletName,
        suggestedCategoryId: itemCategoryId,
        suggestedCategoryName: itemCategoryName,
        suggestedCategoryEmoji: itemCategoryEmoji,
        isDuplicate,
        duplicateReason,
        needsReview: is48hDuplicate,
        selected: !isExactDuplicate,
        raw: cols.join(", "),
      });
    }

    const totalInflow = items.filter((it) => it.selected && it.type === "income").reduce((s, it) => s + it.amount, 0);
    const totalOutflow = items.filter((it) => it.selected && it.type === "expense").reduce((s, it) => s + it.amount, 0);
    const totalTransfer = items.filter((it) => it.selected && it.type === "transfer").reduce((s, it) => s + it.amount, 0);
    const duplicateCount = items.filter((it) => it.isDuplicate).length;

    // Detect new wallets and categories from CSV
    const newWalletsSet = new Set<string>();
    const newCategoriesSet = new Set<string>();
    for (const it of items) {
      if (it.walletName && !it.walletId) {
        newWalletsSet.add(it.walletName);
      }
      if (it.destinationWalletName && !it.destinationWalletId) {
        newWalletsSet.add(it.destinationWalletName);
      }
      if (it.suggestedCategoryName && !it.suggestedCategoryId) {
        newCategoriesSet.add(it.suggestedCategoryName);
      }
    }

    return {
      detectedFormat,
      columnMap: resolvedColumnMap,
      newWalletsDetected: Array.from(newWalletsSet),
      newCategoriesDetected: Array.from(newCategoriesSet),
      items,
      summary: { totalInflow, totalOutflow, totalTransfer, duplicateCount, validCount: items.length },
    };
  }

  // ----------------------------------------------------------------
  // Line-by-line bank mutasi parsing (BCA, Mandiri, Jenius, SeaBank, BRI, BNI)
  // ----------------------------------------------------------------
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const SKIP_PREFIXES = [
    "tanggal", "date", "mutasi rekening", "periode", "nomor rekening",
    "saldo awal", "saldo akhir", "no.", "no rekening", "nama nasabah",
    "account name", "account no", "opening balance", "closing balance",
  ];

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    if (SKIP_PREFIXES.some((p) => lineLower.startsWith(p))) continue;

    let dateStr = "";
    let description = "";
    let amount = 0;
    let type: TransactionType = "expense";

    // BCA Mutasi
    if (detectedFormat === "bca") {
      const bcaMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(.+)$/);
      if (bcaMatch) {
        dateStr = bcaMatch[1];
        const rest = bcaMatch[2];
        const isCredit = /\bCR\b/i.test(rest);
        type = isCredit ? "income" : "expense";

        const amountMatch = rest.match(/([\d.,]+)\s*(?:CR|DB)/i) || rest.match(/([\d.,]+)\s+[\d.,]+$/);
        if (amountMatch) {
          amount = parseLocalizedNumber(amountMatch[1]);
          description = rest
            .replace(amountMatch[0], "")
            .replace(/\b(CR|DB)\b/gi, "")
            .replace(/[\d.,]+$/, "")
            .trim();
        } else {
          const numbers = rest.match(/[\d.,]{3,}/g);
          if (numbers && numbers.length > 0) {
            amount = parseLocalizedNumber(numbers[0]);
            description = rest.replace(numbers[0], "").trim();
          }
        }
      }
    }

    // Mandiri Livin
    else if (detectedFormat === "mandiri") {
      const mandiriMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+)$/);
      if (mandiriMatch) {
        dateStr = mandiriMatch[1];
        const rest = mandiriMatch[2];
        const dkBeforeAmount = rest.match(/\b([DK]|DEBET|KREDIT)\s+([\d.,]+)/i);
        if (dkBeforeAmount) {
          const indicator = dkBeforeAmount[1];
          type = /K|KREDIT/i.test(indicator) ? "income" : "expense";
          amount = parseLocalizedNumber(dkBeforeAmount[2]);
          description = rest.replace(dkBeforeAmount[0], "").trim();
        } else {
          const amountMatch = rest.match(/([\d.,]+)(?:\s+([DK]|DEBET|KREDIT))?(?:\s+[\d.,]+)?$/i);
          if (amountMatch) {
            amount = parseLocalizedNumber(amountMatch[1]);
            const indicator = amountMatch[2];
            if (indicator) type = /K|KREDIT/i.test(indicator) ? "income" : "expense";
            description = rest.replace(amountMatch[0], "").trim();
          }
        }
      }
    }

    // Jenius
    else if (detectedFormat === "jenius") {
      const jeniusMatch = line.match(/^(\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{2,4})?)\s+(.+)$/);
      if (jeniusMatch) {
        dateStr = jeniusMatch[1];
        const rest = jeniusMatch[2];
        const isPositive = /\+\s*[\d.,]+/i.test(rest) || /money in/i.test(rest);
        type = isPositive ? "income" : "expense";
        const amountMatch = rest.match(/[+\-]?\s*(?:Rp)?\s*([\d.,]{3,})/i);
        if (amountMatch) {
          amount = parseLocalizedNumber(amountMatch[1]);
          description = rest.replace(amountMatch[0], "").trim();
        }
      }
    }

    // SeaBank
    else if (detectedFormat === "seabank") {
      const seaMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(.+)$/);
      if (seaMatch) {
        dateStr = seaMatch[1];
        const rest = seaMatch[2];
        const lRest = rest.toLowerCase();
        const isMasuk = /\b(masuk|kredit|terima|diterima|cr|received)\b/.test(lRest);
        const isKeluar = /\b(keluar|debet|kirim|transfer ke|db|sent)\b/.test(lRest);
        if (isMasuk && !isKeluar) type = "income";
        else type = "expense";

        const numbers = rest.match(/[\d.,]{4,}/g);
        if (numbers && numbers.length > 0) {
          amount = parseLocalizedNumber(numbers[0]);
          description = rest.replace(numbers[0], "").replace(/[\d.,]{4,}/g, "").trim();
        }
      }
    }

    // BRI BRImo
    else if (detectedFormat === "bri") {
      const briMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+)$/);
      if (briMatch) {
        dateStr = briMatch[1];
        const rest = briMatch[2];
        const amountMatch = rest.match(/([\d.,]{4,})(?:\s+([KD]))?/i);
        if (amountMatch) {
          amount = parseLocalizedNumber(amountMatch[1]);
          const indicator = amountMatch[2];
          if (indicator) type = /K/i.test(indicator) ? "income" : "expense";
          else {
            const isKredit = /\b(masuk|kredit|terima)\b/i.test(rest);
            type = isKredit ? "income" : "expense";
          }
          description = rest.replace(amountMatch[0], "").trim();
        }
      }
    }

    // BNI wondr / generic
    else {
      const bniMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+)$/);
      if (bniMatch) {
        dateStr = bniMatch[1];
        const rest = bniMatch[2];
        const dkMatch = rest.match(/\b([DK])\s+([\d.,]+)/i);
        if (dkMatch) {
          type = /K/i.test(dkMatch[1]) ? "income" : "expense";
          amount = parseLocalizedNumber(dkMatch[2]);
          description = rest.replace(dkMatch[0], "").trim();
        } else {
          const numbers = rest.match(/[\d.,]{4,}/g);
          if (numbers && numbers.length > 0) {
            amount = parseLocalizedNumber(numbers[0]);
            description = rest.replace(numbers[0], "").trim();
          }
        }
      }
    }

    if (!amount || amount <= 0) continue;

    const normalizedDate = normalizeDateString(dateStr || new Date().toISOString());
    const cleanDesc = cleanBankNarration(description);
    const sanitizedDescription = sanitizeNote(description);
    const sanitizedCleanDesc = sanitizeNote(cleanDesc);

    // Transfer vs Expense check
    let destinationWalletId: string | null = null;
    let destinationWalletName: string | null = null;

    // Arrow Transfer in Description check
    const arrowCleanedDesc = sanitizeTransferArrowText(description || cleanDesc);
    const arrowParts = arrowCleanedDesc.split(" → ");
    if (arrowParts.length === 2 && arrowParts[0].trim() && arrowParts[1].trim()) {
      const srcCandidate = arrowParts[0].trim();
      const dstCandidate = arrowParts[1].trim();

      const matchedDst = wallets.find(
        (w) => w.name.toLowerCase().trim() === dstCandidate.toLowerCase()
      );
      const matchedSrc = wallets.find(
        (w) => w.name.toLowerCase().trim() === srcCandidate.toLowerCase()
      );

      if (matchedSrc || matchedDst || (type as TransactionType) === "transfer") {
        type = "transfer";
        destinationWalletId = matchedDst ? matchedDst.id : null;
        destinationWalletName = matchedDst ? matchedDst.name : dstCandidate;
      }
    }

    const isTransferSignal = /\b(transfer ke|kirim ke|to rekening|ke rek|top.?up|isi saldo)\b/i.test(description);
    if (type === "expense" && isTransferSignal) {
      const matched = matchDestinationWallet(description, wallets);
      if (matched) {
        type = "transfer";
        destinationWalletId = matched.id;
        destinationWalletName = matched.name;
      }
    }

    const mockTx: Partial<Transaction> = {
      note: `${sanitizedCleanDesc} ${sanitizedDescription}`.trim(),
      type,
      amount,
    };
    const resolvedCat = resolveTransactionCategory(mockTx, categories);

    const roundedAmt = Math.round(amount / 1000) * 1000;
    const noteSlug = (sanitizedCleanDesc || sanitizedDescription || "tx").toLowerCase().replace(/\s+/g, "").slice(0, 20);
    const dedupKey1 = `${normalizedDate}_${Math.round(amount)}_${type}`;
    const dedupKey2 = `${normalizedDate}_${roundedAmt}_${type}_${noteSlug}`;
    const isExactDuplicate = existingMap.has(dedupKey1) || existingMap.has(dedupKey2);
    const is48hDuplicate = !isExactDuplicate && (existing48hMap.has(dedupKey1) || existing48hMap.has(dedupKey2));

    const isDuplicate = isExactDuplicate || is48hDuplicate;
    const duplicateReason = isExactDuplicate
      ? `Sama dengan transaksi ${type} pada ${normalizedDate} (${amount.toLocaleString()})`
      : is48hDuplicate
      ? `Kemungkinan duplikat (toleransi 48 jam) ${type} (${amount.toLocaleString()})`
      : undefined;

    items.push({
      id: `stmt-tx-${Date.now()}-${idCounter++}`,
      date: normalizedDate,
      description: sanitizedDescription || "Transaction",
      cleanDescription: sanitizedCleanDesc,
      amount,
      type,
      destinationWalletId,
      destinationWalletName,
      suggestedCategoryId: resolvedCat.id || null,
      suggestedCategoryName: resolvedCat.name,
      suggestedCategoryEmoji: resolvedCat.emoji,
      isDuplicate,
      duplicateReason,
      needsReview: is48hDuplicate,
      selected: !isExactDuplicate,
      raw: line,
    });
  }

  const totalInflow = items.filter((it) => it.selected && it.type === "income").reduce((s, it) => s + it.amount, 0);
  const totalOutflow = items.filter((it) => it.selected && it.type === "expense").reduce((s, it) => s + it.amount, 0);
  const totalTransfer = items.filter((it) => it.selected && it.type === "transfer").reduce((s, it) => s + it.amount, 0);
  const duplicateCount = items.filter((it) => it.isDuplicate).length;

  return {
    detectedFormat,
    columnMap,
    newWalletsDetected: [],
    newCategoriesDetected: [],
    items,
    summary: { totalInflow, totalOutflow, totalTransfer, duplicateCount, validCount: items.length },
  };
}
