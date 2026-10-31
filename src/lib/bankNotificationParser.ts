import type { Category, Wallet, TransactionType } from "./types";
import { parseNaturalTransaction } from "./nlpParser";
import { BANK_ALIASES, KNOWN_MERCHANT_PATTERNS } from "./slipParser";
import { classifySemanticCategory } from "./semanticClassifier";
import { getMerchantMemory } from "./merchantCategoryMemory";

export interface BankNotificationMetadata {
  title?: string | null;
  subtitle?: string | null;
  sourceApp?: string | null;
  receivedAt?: string | null;
}

export interface DetectedBankNotification {
  rawText: string;
  sourceApp: string; // e.g., "SeaBank", "ShopeePay", "wondr by BNI", "BCA", "Mandiri Livin"
  amount: number;
  merchantOrNote: string;
  type: TransactionType;
  occurredAt?: Date;
  suggestedWalletId?: string;
  suggestedWalletName?: string;
  suggestedToWalletId?: string;
  suggestedToWalletName?: string;
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
}

/**
 * Layer 1: Hard Promotional, Marketing, Voucher & Loan Offer Blacklist
 */
export const PROMO_BLACKLIST_PATTERNS: RegExp[] = [
  /\bsiap[\s-]*siap\s+dapetin\b/i,
  /\b(?:diskon|cashback|voucher|voucer|promo|promosi|reward|rewards|kupon|coupon)\b/i,
  /\b(?:serbu|klaim|claim|undian|hadiah|flash\s*sale|payday\s*sale|special\s*offer|penawaran\s*spesial)\b/i,
  /\b(?:bunga\s*rendah|limit\s*pinjaman|limit\s*kredit|ajukan\s*sekarang|aktifkan\s*paylater|spaylater\s*kamu|gopay\s*later\s*kamu)\b/i,
  /\b(?:nikmati\s+keuntungan|s&k\s*berlaku|syarat\s*&\s*ketentuan|hingga\s*rp|up\s*to\s*rp|s\/d\s*rp|dapatkan\s+saldo|bonus\s+saldo)\b/i,
  /\b(?:gratis\s*ongkir|bebas\s*biaya\s*admin\s*hingga|yuk\s*transaksi|jangan\s*lewatkan|khusus\s*buat\s*kamu)\b/i,
];

/**
 * Layer 2: Security, OTP, Login Alert, Failed Transaction & Unpaid Reminder Blocker
 */
export const NON_MUTATION_BLACKLIST_PATTERNS: RegExp[] = [
  /\b(?:otp|kode\s*rahasia|kode\s*verifikasi|verification\s*code|jangan\s*berikan|jangan\s*bagikan)\b/i,
  /\b(?:login\s*baru|perangkat\s*baru|aktivitas\s*masuk|ubah\s*pin|ganti\s*pin|reset\s*password|kata\s*sandi)\b/i,
  /\b(?:transaksi\s*gagal|pembayaran\s*gagal|transfer\s*gagal|dibatalkan|ditolak|tidak\s*mencukupi|saldo\s*kurang|kadaluarsa|expired)\b/i,
  /\b(?:menunggu\s*pembayaran|bayar\s*sebelum|segera\s*lunasi|tagihan\s*akan\s*jatuh\s*tempo|kode\s*virtual\s*account\s*dibuat)\b/i,
];

/**
 * Definitive completed financial mutation verbs.
 * If a real receipt contains a secondary promo note (e.g. "Pembayaran Rp 45.000 berhasil. Kamu hemat Rp 5.000"),
 * the presence of a definitive mutation phrase rescues the transaction while stripping the promo clause.
 */
const DEFINITIVE_MUTATION_REGEX =
  /\b(?:pembayaran\s+(?:qris\s+)?berhasil|pembayaran\s+sukses|transaksi\s+berhasil|transfer\s+berhasil|kamu\s+berhasil\s+(?:bayar|transfer)|kamu\s+telah\s+(?:bayar|membayar|transfer)|berhasil\s+(?:dibayar|membayar|transfer|top\s*up|isi\s*saldo)|dana\s+masuk|uang\s+masuk|transfer\s+masuk|menerima\s+transfer|berhasil\s+diterima|telah\s+diterima|mutasi\s+(?:debit|kredit))\b/i;

/**
 * Checks whether a notification text (combined with title/subtitle) is promotional spam,
 * an OTP/security alert, or a failed/pending notification that must NOT be logged as a transaction.
 */
export function isPromotionalOrSpamNotification(
  text: string,
  title?: string | null,
  subtitle?: string | null,
): boolean {
  const combined = [title, subtitle, text].filter(Boolean).join(" ").trim();
  if (!combined) return true;

  // Layer 2 (OTP / Security / Failed / Pending) is unconditionally blocked
  if (NON_MUTATION_BLACKLIST_PATTERNS.some((rx) => rx.test(combined))) {
    return true;
  }

  // Layer 1 (Promo / Cashback / Voucher / Marketing)
  const hasPromoKeyword = PROMO_BLACKLIST_PATTERNS.some((rx) => rx.test(combined));
  if (hasPromoKeyword) {
    // Only allow if it has an explicit completed transaction verb AND is not a "Dapatkan cashback..." headline
    const isDefinitiveReceipt = DEFINITIVE_MUTATION_REGEX.test(combined);
    const startsWithPromo =
      /^\s*(?:promo|diskon|cashback|voucher|kupon|klaim|serbu|nikmati|dapatkan|spesial|yuk|jangan\s+lewatkan)/i.test(
        title || text,
      );
    if (!isDefinitiveReceipt || startsWithPromo) {
      return true;
    }
  }

  return false;
}

/**
 * Detects if a text string looks like an Indonesian m-Banking, SMS, or e-Wallet payment notification
 * and extracts financial tokens with transfer vs expense intelligence and 3-layer anti-promo filtering.
 */
export function parseBankNotification(
  text: string,
  categories: Category[] = [],
  wallets: Wallet[] = [],
  metadata?: BankNotificationMetadata,
): DetectedBankNotification | null {
  if (!text || typeof text !== "string") return null;
  const cleanText = text.trim();
  const cleanTitle = metadata?.title?.trim() || "";
  const cleanSubtitle = metadata?.subtitle?.trim() || "";
  const cleanSourceApp = metadata?.sourceApp?.trim() || "";

  const combinedRaw = [cleanTitle, cleanSubtitle, cleanText]
    .filter(Boolean)
    .join(" — ")
    .trim();

  if (combinedRaw.length < 6 || combinedRaw.length > 1500) return null;

  // 0. Run 3-Layer Promo, Marketing, OTP & Failed Transaction Shield
  if (isPromotionalOrSpamNotification(cleanText, cleanTitle, cleanSubtitle)) {
    return null;
  }

  const lower = `${cleanSourceApp} ${cleanTitle} ${cleanSubtitle} ${cleanText}`.toLowerCase();

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
    "linkaja",
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
    "berhasil dibayar",
  ];

  const hasSignal = bankSignals.some((sig) => lower.includes(sig));
  if (!hasSignal) return null;

  // Strip secondary discount/hemat clauses before extracting the primary transaction amount
  const sanitizedForAmount = cleanText
    .replace(
      /\b(?:hemat|diskon|cashback|potongan|voucher|reward|koin)\s*(?:rp\.?|idr)?\s*[\d.,]+/gi,
      "",
    )
    .replace(
      /\b(?:saldo\s*(?:akhir|tersedia|kamu|anda)|sisa\s*saldo)\s*[:=]?\s*(?:rp\.?|idr)?\s*[\d.,]+/gi,
      "",
    );

  // 2. Extract amount (e.g. "Rp 10.000", "Rp10000", "sebesar 10.000", "sebesar Rp 10.000", "senilai 50.000")
  const amountRegex = /(?:sebesar\s+rp\.?|senilai\s+rp\.?|rp\.?|idr|sebesar|senilai)\s*([\d.,]+)/i;
  const amountMatch =
    sanitizedForAmount.match(amountRegex) ||
    cleanSubtitle.match(amountRegex) ||
    cleanTitle.match(amountRegex);

  let amount = 0;
  if (amountMatch && amountMatch[1]) {
    const rawNum = amountMatch[1].trim().replace(/[.,]+$/, "");
    let normalized = rawNum;
    if (normalized.includes(".") && normalized.includes(",")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(".")) {
      const parts = normalized.split(".");
      if (parts[parts.length - 1].length === 3 || parts.length > 2) {
        normalized = normalized.replace(/\./g, "");
      }
    } else if (normalized.includes(",")) {
      const parts = normalized.split(",");
      if (parts[parts.length - 1].length === 3 || parts.length > 2) {
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

  // Fallback: look for standalone formatted numbers (supporting 1.000, 5.000, 10.000, 100.000, etc.)
  if (amount <= 0) {
    const fallbackNum = sanitizedForAmount.match(/\b(\d{1,3}(?:\.\d{3})+)\b/);
    if (fallbackNum && fallbackNum[1]) {
      const num = parseFloat(fallbackNum[1].replace(/\./g, ""));
      if (!isNaN(num) && num >= 1000) amount = num;
    }
  }

  if (amount <= 0) return null;

  // 3. Detect Source Bank / E-Wallet (prioritizing explicit metadata.sourceApp and title)
  let sourceApp = cleanSourceApp || "Bank / E-Wallet";
  let matchedSourceWallet: Wallet | undefined;

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
  } else if (lower.includes("jenius") || lower.includes("btpn")) {
    sourceApp = "Jenius";
    matchedSourceWallet = findWalletByKeyword("jenius");
  } else if (lower.includes("bsi")) {
    sourceApp = "BSI";
    matchedSourceWallet = findWalletByKeyword("bsi");
  } else if (lower.includes("shopeepay") || lower.includes("spay") || lower.includes("shopee")) {
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
  } else if (lower.includes("linkaja")) {
    sourceApp = "LinkAja";
    matchedSourceWallet = findWalletByKeyword("linkaja");
  } else if (lower.includes("qris")) {
    sourceApp = cleanSourceApp || "QRIS";
  }

  // If explicit sourceApp was provided in metadata and still no wallet matched, try direct matching
  if (!matchedSourceWallet && cleanSourceApp && wallets.length > 0) {
    matchedSourceWallet = findWalletByKeyword(cleanSourceApp);
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
    const keMatch = cleanText.match(
      /(?:ke\s+(?:bank\s+|rek(?:ening)?\s+)?|tujuan\s+|top\s*up\s+|isi\s+saldo\s+)([A-Za-z0-9\s&@_.-]+?)(?:\s+(?:berhasil|sukses|sebesar|senilai|rp|\d{3,}|\(|\.|\n|$))/i,
    );
    if (keMatch && keMatch[1]) {
      destinationCandidate = keMatch[1].trim();
    }

    if (destinationCandidate && wallets.length > 0) {
      const destLower = destinationCandidate.toLowerCase();
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
    lower.includes("kamu menerima") ||
    lower.includes("berhasil diterima");

  let type: TransactionType = "expense";
  if (isIncome) {
    type = "income";
  } else if (isTransferOrTopup && matchedDestinationWallet) {
    type = "transfer";
  } else {
    type = "expense";
  }

  // 6. Extract Merchant / Note
  let merchantOrNote = "";
  if (type === "transfer" && matchedDestinationWallet) {
    merchantOrNote = "";
  } else {
    for (const km of KNOWN_MERCHANT_PATTERNS) {
      if (km.match(combinedRaw)) {
        merchantOrNote = km.name;
        break;
      }
    }

    if (!merchantOrNote) {
      const targetMatch = cleanText.match(
        /(?:ke|di|pada|untuk|merchant)\s+([A-Za-z0-9\s&'.-]+?)(?:\s+(?:berhasil|sukses|sebesar|senilai|rp|tanggal|via|pakai|dengan|\.|\n|$))/i,
      );
      if (targetMatch && targetMatch[1]) {
        let extracted = targetMatch[1].trim();
        extracted = extracted
          .replace(/\s+(?:via|pake|pakai|lewat|dari|di)\s+[A-Za-z0-9\s'.-]+$/i, "")
          .replace(/^(?:rek(?:ening)?\s+)?(?:\d+\s+)?(?:an\s+|a\/n\s+)/i, "")
          .trim();
        if (extracted.length >= 2) {
          merchantOrNote = extracted;
        }
      }
    }

    if (!merchantOrNote || merchantOrNote.length < 2) {
      let remaining = cleanText
        .replace(/(?:sebesar\s+rp\.?|senilai\s+rp\.?|rp\.?|idr)\s*[\d.,]+/gi, "")
        .replace(
          /transfer|berhasil|sukses|pembayaran|sebesar|senilai|transaksi|debit|kredit|rekening|kamu telah bayar|kamu berhasil bayar|kamu berhasil/gi,
          "",
        )
        .replace(/[0-9]{6,}/g, "")
        .trim();
      merchantOrNote =
        remaining.slice(0, 40) ||
        cleanSubtitle ||
        (type === "income" ? "Dana Masuk" : `${sourceApp} Payment`);
    }
  }

  // 7. Suggest Category using Merchant Memory -> Semantic Classifier -> NLP Parser
  let suggestedCategoryId: string | undefined;
  let suggestedCategoryName: string | undefined;

  if (type !== "transfer" && categories.length > 0) {
    const mem = getMerchantMemory(merchantOrNote || cleanText);
    if (mem) {
      const foundCat = categories.find((c) => c.id === mem.categoryId);
      if (foundCat) {
        suggestedCategoryId = foundCat.id;
        suggestedCategoryName = foundCat.name;
      }
    }

    if (!suggestedCategoryId) {
      const sem = classifySemanticCategory(
        `${merchantOrNote} ${cleanText}`,
        categories,
        type === "income" ? "income" : "expense",
      );
      if (sem.category) {
        suggestedCategoryId = sem.category.id;
        suggestedCategoryName = sem.category.name;
      }
    }

    if (!suggestedCategoryId) {
      const nlpResult = parseNaturalTransaction(merchantOrNote || cleanText, categories, wallets);
      if (nlpResult.categoryId) {
        suggestedCategoryId = nlpResult.categoryId;
        suggestedCategoryName = nlpResult.categoryName || undefined;
      }
    }
  }

  // 8. Parse receivedAt timestamp if provided
  let occurredAt: Date | undefined;
  if (metadata?.receivedAt) {
    const d = new Date(metadata.receivedAt);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
      occurredAt = d;
    }
  }

  return {
    rawText: combinedRaw,
    sourceApp,
    amount,
    merchantOrNote,
    type,
    occurredAt,
    suggestedWalletId: matchedSourceWallet?.id || undefined,
    suggestedWalletName: matchedSourceWallet?.name || undefined,
    suggestedToWalletId: matchedDestinationWallet?.id || undefined,
    suggestedToWalletName: matchedDestinationWallet?.name || undefined,
    suggestedCategoryId,
    suggestedCategoryName,
  };
}
