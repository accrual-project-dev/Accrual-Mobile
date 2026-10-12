import type { Category, Wallet, TransactionType } from "./types";
import { parseNaturalTransaction } from "./nlpParser";
import { BANK_ALIASES, KNOWN_MERCHANT_PATTERNS } from "./slipParser";

export interface DetectedBankNotification {
  rawText: string;
  sourceApp: string; // e.g., "SeaBank", "ShopeePay", "wondr by BNI", "BCA", "Mandiri Livin"
  amount: number;
  merchantOrNote: string;
  type: TransactionType;
  suggestedWalletId?: string;
  suggestedWalletName?: string;
  suggestedToWalletId?: string;
  suggestedToWalletName?: string;
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
}

/**
 * Detects if a text string looks like an Indonesian m-Banking, SMS, or e-Wallet payment notification
 * and extracts financial tokens with transfer vs expense intelligence.
 */
export function parseBankNotification(
  text: string,
  categories: Category[] = [],
  wallets: Wallet[] = [],
): DetectedBankNotification | null {
  if (!text || typeof text !== "string") return null;
  const clean = text.trim();
  if (clean.length < 8 || clean.length > 1000) return null;

  const lower = clean.toLowerCase();

  // 1. Check for banking / e-wallet signal keywords
  const bankSignals = [
    "bca",
    "m-transfer",
    "mybca",
    "klikbca",
    "livin",
    "mandiri",
    "brimo",
    "bri",
    "bni",
    "wondr",
    "cimb",
    "octo",
    "jago",
    "kantong",
    "seabank",
    "sea bank",
    "superbank",
    "blu",
    "jenius",
    "krom",
    "line bank",
    "linebank",
    "danamon",
    "bsi",
    "gopay",
    "gojek",
    "ovo",
    "shopeepay",
    "spay",
    "shopee",
    "dana",
    "qris",
    "transfer",
    "transfer berhasil",
    "kamu berhasil transfer",
    "pembayaran berhasil",
    "pembayaran sukses",
    "transaksi berhasil",
    "top up",
    "top-up",
    "isi saldo",
    "dana masuk",
    "transfer masuk",
    "uang masuk",
    "debit",
    "kredit",
    "kamu telah bayar",
    "kamu berhasil bayar",
    "berhasil bayar",
  ];

  const hasSignal = bankSignals.some((sig) => lower.includes(sig));
  if (!hasSignal) return null;

  // 2. Extract amount (e.g. "Rp 10.000", "Rp10000", "sebesar 10.000", "sebesar Rp 10.000", "senilai 50.000")
  const amountRegex = /(?:sebesar\s+rp\.?|senilai\s+rp\.?|rp\.?|idr|sebesar|senilai)\s*([\d.,]+)/i;
  const amountMatch = clean.match(amountRegex);

  let amount = 0;
  if (amountMatch && amountMatch[1]) {
    const rawNum = amountMatch[1].trim();
    // Normalize Indonesian numbers: 10.000 or 10.000,00
    let normalized = rawNum;
    if (normalized.includes(".") && normalized.includes(",")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(".")) {
      const parts = normalized.split(".");
      if (parts[parts.length - 1].length === 3) {
        normalized = normalized.replace(/\./g, "");
      }
    } else if (normalized.includes(",")) {
      const parts = normalized.split(",");
      if (parts[parts.length - 1].length === 3) {
        normalized = normalized.replace(/,/g, "");
      } else {
        normalized = normalized.replace(",", ".");
      }
    }
    const parsedNum = parseFloat(normalized);
    if (!isNaN(parsedNum) && parsedNum > 0) {
      amount = parsedNum;
    }
  }

  // Fallback: look for standalone numbers (supporting 1.000, 5.000, 10.000, 100.000, etc.)
  if (amount <= 0) {
    const fallbackNum = clean.match(/\b(\d{1,3}(?:\.\d{3})+)\b/);
    if (fallbackNum && fallbackNum[1]) {
      const num = parseFloat(fallbackNum[1].replace(/\./g, ""));
      if (!isNaN(num) && num >= 1000) amount = num;
    }
  }

  if (amount <= 0) return null;

  // 3. Detect Source Bank / E-Wallet
  let sourceApp = "Bank / E-Wallet";
  let matchedSourceWallet: Wallet | undefined;

  // Helper to match wallet against keywords and aliases
  const findWalletByKeyword = (kw: string) => {
    const kwLower = kw.toLowerCase();
    const aliases = BANK_ALIASES[kwLower] || [kwLower];
    return wallets.find((w) => {
      const wLower = w.name.toLowerCase();
      return aliases.some((a) => wLower === a || wLower.includes(a) || a.includes(wLower));
    });
  };

  if (lower.includes("wondr")) {
    sourceApp = "wondr by BNI";
    matchedSourceWallet = findWalletByKeyword("wondr") || findWalletByKeyword("bni");
  } else if (lower.includes("seabank") || lower.includes("sea bank")) {
    sourceApp = "SeaBank";
    matchedSourceWallet = findWalletByKeyword("seabank");
  } else if (lower.includes("superbank") || lower.includes("super bank")) {
    sourceApp = "Superbank";
    matchedSourceWallet = findWalletByKeyword("superbank");
  } else if (lower.includes("blu")) {
    sourceApp = "blu by BCA Digital";
    matchedSourceWallet = findWalletByKeyword("blu");
  } else if (lower.includes("bca") || lower.includes("m-transfer") || lower.includes("mybca")) {
    sourceApp = "BCA";
    matchedSourceWallet = findWalletByKeyword("bca");
  } else if (lower.includes("livin") || lower.includes("mandiri")) {
    sourceApp = "Mandiri Livin";
    matchedSourceWallet = findWalletByKeyword("mandiri");
  } else if (lower.includes("brimo") || lower.includes("bri")) {
    sourceApp = lower.includes("brimo") ? "BRImo" : "BRI";
    matchedSourceWallet = findWalletByKeyword("brimo") || findWalletByKeyword("bri");
  } else if (lower.includes("bni")) {
    sourceApp = "BNI";
    matchedSourceWallet = findWalletByKeyword("bni");
  } else if (lower.includes("jago") || lower.includes("kantong")) {
    sourceApp = "Bank Jago";
    matchedSourceWallet = findWalletByKeyword("jago");
  } else if (lower.includes("cimb") || lower.includes("octo")) {
    sourceApp = "CIMB Niaga";
    matchedSourceWallet = findWalletByKeyword("cimb");
  } else if (lower.includes("shopeepay") || lower.includes("spay")) {
    sourceApp = "ShopeePay";
    matchedSourceWallet = findWalletByKeyword("shopeepay");
  } else if (lower.includes("gopay") || lower.includes("gojek")) {
    sourceApp = "GoPay";
    matchedSourceWallet = findWalletByKeyword("gopay");
  } else if (lower.includes("ovo")) {
    sourceApp = "OVO";
    matchedSourceWallet = findWalletByKeyword("ovo");
  } else if (lower.includes("dana")) {
    sourceApp = "DANA";
    matchedSourceWallet = findWalletByKeyword("dana");
  } else if (lower.includes("qris")) {
    sourceApp = "QRIS";
  }

  // Fallback to primary wallet if not resolved
  if (!matchedSourceWallet && wallets.length > 0) {
    matchedSourceWallet = wallets[0];
  }

  // 4. Detect Destination Account / Wallet for Transfers & Top-ups
  const isTransferOrTopup =
    lower.includes("transfer") ||
    lower.includes("top up") ||
    lower.includes("top-up") ||
    lower.includes("isi saldo") ||
    lower.includes("kirim uang") ||
    lower.includes("kirim dana");

  let matchedDestinationWallet: Wallet | undefined;
  let destinationCandidate = "";

  if (isTransferOrTopup) {
    // Check patterns like:
    // "ke ShopeePay ...", "ke BCA ...", "ke rek BCA ...", "ke rek ...", "ke [Target]"
    // "Top Up ShopeePay ...", "Top up GoPay ..."
    const keMatch = clean.match(
      /(?:ke\s+(?:bank\s+|rek(?:ening)?\s+)?|tujuan\s+|top\s*up\s+|isi\s+saldo\s+)([A-Za-z0-9\s&@_.-]+?)(?:\s+(?:berhasil|sukses|sebesar|senilai|rp|\d{3,}|\(|\.|\n|$))/i,
    );
    if (keMatch && keMatch[1]) {
      destinationCandidate = keMatch[1].trim();
    }

    if (destinationCandidate && wallets.length > 0) {
      const destLower = destinationCandidate.toLowerCase();
      // Match candidate against user wallets (excluding source wallet)
      for (const w of wallets) {
        if (matchedSourceWallet && w.id === matchedSourceWallet.id) continue;
        const wLower = w.name.toLowerCase();
        const aliases = BANK_ALIASES[wLower] || [wLower];
        const isMatch = aliases.some(
          (a) => destLower.includes(a) || a.includes(destLower),
        );
        if (isMatch) {
          matchedDestinationWallet = w;
          break;
        }
      }
    }
  }

  // 5. Determine Transaction Type
  const isIncome =
    lower.includes("dana masuk") ||
    lower.includes("transfer masuk") ||
    lower.includes("menerima transfer") ||
    lower.includes("uang masuk") ||
    lower.includes("diterima dari") ||
    lower.includes("kredit") ||
    lower.includes("kamu menerima");

  let type: TransactionType = "expense";
  if (isIncome) {
    type = "income";
  } else if (isTransferOrTopup && matchedDestinationWallet) {
    // Internal transfer between user's own wallets (e.g. SeaBank to ShopeePay)
    type = "transfer";
  } else {
    // External transfer to a person or payment to merchant
    type = "expense";
  }

  // 6. Extract Merchant / Note
  let merchantOrNote = "";
  if (type === "transfer" && matchedDestinationWallet) {
    merchantOrNote = ""; // Clean note for transfers
  } else {
    // Check known merchants first!
    for (const km of KNOWN_MERCHANT_PATTERNS) {
      if (km.match(clean)) {
        merchantOrNote = km.name;
        break;
      }
    }

    if (!merchantOrNote) {
      const targetMatch = clean.match(
        /(?:ke|di|pada)\s+([A-Za-z0-9\s&'.-]+?)(?:\s+(?:berhasil|sukses|sebesar|senilai|rp|tanggal|\.|\n|$))/i,
      );
      if (targetMatch && targetMatch[1]) {
        let extracted = targetMatch[1].trim();
        // Strip trailing app/wallet clauses e.g. "via GoPay", "pake GoPay", "di Livin", "dari Kantong Utama"
        extracted = extracted
          .replace(/\s+(?:via|pake|pakai|lewat|dari|di)\s+[A-Za-z0-9\s'.-]+$/i, "")
          .trim();
        // Strip leading recipient tokens e.g. "rek 1234567890 an ", "an ", "a/n "
        extracted = extracted
          .replace(/^(?:rek(?:ening)?\s+)?(?:\d+\s+)?(?:an\s+|a\/n\s+)/i, "")
          .trim();
        if (extracted.length >= 2) {
          merchantOrNote = extracted;
        }
      }
    }

    if (!merchantOrNote || merchantOrNote.length < 2) {
      let remaining = clean
        .replace(/(?:sebesar\s+rp\.?|senilai\s+rp\.?|rp\.?|idr)\s*[\d.,]+/gi, "")
        .replace(
          /transfer|berhasil|sukses|pembayaran|sebesar|senilai|transaksi|debit|kredit|rekening|kamu telah bayar|kamu berhasil bayar|kamu berhasil/gi,
          "",
        )
        .replace(/[0-9]{6,}/g, "") // remove account numbers
        .trim();
      merchantOrNote =
        remaining.slice(0, 35) ||
        (type === "income" ? "Dana Masuk" : `${sourceApp} Payment`);
    }
  }

  // 7. Suggest Category using NLP parser
  const nlpResult = parseNaturalTransaction(merchantOrNote || clean, categories, wallets);

  return {
    rawText: clean,
    sourceApp,
    amount,
    merchantOrNote,
    type,
    suggestedWalletId: matchedSourceWallet?.id || undefined,
    suggestedWalletName: matchedSourceWallet?.name || undefined,
    suggestedToWalletId: matchedDestinationWallet?.id || undefined,
    suggestedToWalletName: matchedDestinationWallet?.name || undefined,
    suggestedCategoryId: type === "transfer" ? undefined : nlpResult.categoryId || undefined,
    suggestedCategoryName: type === "transfer" ? undefined : nlpResult.categoryName || undefined,
  };
}
