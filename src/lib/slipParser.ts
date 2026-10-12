// ======================================================================
// TROUVAILLE INDONESIAN FINANCIAL SLIP & RECEIPT PARSER
// Deterministic, offline heuristic parser for M-Banking, E-Wallets, QRIS & Struk Kasir
// ======================================================================

import { format } from "date-fns";
import type { Category, Wallet, TransactionType } from "./types";
import { formatRupiah } from "./utils";
import { classifySemanticCategory } from "./semanticClassifier";
import { getMerchantMemory } from "./merchantCategoryMemory";

export interface ParsedSlipResult {
  amount: number | null;
  amountFormatted: string | null;
  adminFee: number | null;
  adminFeeFormatted?: string | null;
  type: TransactionType;
  date: Date;
  dateFormatted: string;
  time?: string;
  merchantOrRecipient: string;
  sourceWalletId: string | null;
  sourceWalletName: string | null;
  destinationWalletId: string | null;
  destinationWalletName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  confidence: number;
  detectedSlipType: "m_banking" | "ewallet" | "qris" | "receipt" | "general";
  detectedInstitution?: string;
  detectedCategory?: string;
  isVirtualAccount: boolean;
  vaNumber?: string | null;
  rawText: string;
  extractedLines: string[];
}

export interface CategorySynonymGroup {
  targetKeys: string[];
  keywords: string[];
}

export const CATEGORY_SYNONYMS: Record<string, CategorySynonymGroup> = {
  groceries: {
    targetKeys: ["groceries", "belanja", "minimarket", "supermarket", "sembako", "papan"],
    keywords: [
      "indomaret", "alfamart", "alfamidi", "superindo", "hypermart", "transmart",
      "grand lucky", "hero", "farmers", "lotte", "tokopedia", "shopee", "tiktok shop",
      "blibli", "lazada", "indomarco", "klikindomaret", "poinku", "gula", "mie", "minyak", "beras",
      "familymart", "family mart", "lawson", "circle k", "bukalapak"
    ],
  },
  kopi: {
    targetKeys: ["kopi", "coffee", "cafe", "kafe", "minuman", "makanan", "pangan"],
    keywords: [
      "kopi", "coffee", "cafe", "kafe", "starbucks", "kenangan", "janji jiwa",
      "fore", "tomoro", "kulo", "point coffee", "kopsus", "latte", "espresso",
      "americano", "cappuccino", "brize", "dominance", "nogi", "kopikenangan",
      "anomali", "tanamera"
    ],
  },
  makanan: {
    targetKeys: ["makanan", "food", "kuliner", "resto", "restoran", "cafe", "kafe", "pangan"],
    keywords: [
      "resto", "restoran", "makan", "bakso", "mie", "ayam", "bebek", "padang",
      "sederhana", "mcdonald", "mcd", "kfc", "hokben", "pizza", "burger", "d cost",
      "warung", "gofood", "grabfood", "shopeefood", "dapur", "baker", "roti",
      "sushi", "ramen", "solaria", "marugame", "steak", "soto", "sate",
      "chick", "wings", "tahu walik", "french fries", "odeng", "chikuwa",
      "gacoan", "mie gacoan", "ichiban", "ichiban sushi", "kitamura", "shabu",
      "bakmi", "bakmi bangka", "mie ayam", "suputra", "esb", "belut", "belud",
      "udang", "keju", "dimsum", "siomay", "geprek", "binggrae", "celano"
    ],
  },
  minuman: {
    targetKeys: ["minuman", "beverage", "drink", "cafe", "kafe", "pangan"],
    keywords: [
      "tea", "teh", "juice", "jus", "boba", "chatime", "haus", "pure life", "aqua", "lemon tea", "ice tea", "kombucha"
    ],
  },
  tagihan: {
    targetKeys: ["tagihan", "cicilan", "pinjaman", "kredit", "utilitas", "hunian"],
    keywords: [
      "finansia", "kredit hp", "kredit", "cicilan", "pinjaman", "koperasi", "simpan pinjam",
      "dana mapan", "adira", "fif", "baf", "kreditplus", "multifinance", "multi finance"
    ],
  },
  transportasi: {
    targetKeys: ["transportasi", "bensin", "kendaraan", "transport"],
    keywords: [
      "pertamina", "spbu", "shell", "bp akr", "bensin", "pertamax", "pertalite",
      "solar", "parkir", "parking", "tol", "jasamarga", "gojek", "grab", "maxim",
      "bluebird", "kereta", "krl", "mrt", "lrt", "kai", "tiket.com", "traveloka"
    ],
  },
  hunian: {
    targetKeys: ["hunian", "papan", "tagihan", "utilitas", "internet"],
    keywords: [
      "pln", "listrik", "pdam", "air", "ipl", "indihome", "biznet", "myrepublic",
      "first media", "wifi", "kost", "kos", "kontrakan", "sewa"
    ],
  },
  hiburan: {
    targetKeys: ["hiburan", "entertainment", "rekreasi"],
    keywords: [
      "cinema", "xxi", "cgv", "cinepolis", "bioskop", "nonton", "netflix", "spotify",
      "youtube", "disney", "steam", "playstation", "nintendo", "game", "karaoke"
    ],
  },
  kesehatan: {
    targetKeys: ["kesehatan", "obat", "medical"],
    keywords: [
      "apotek", "apotik", "kimia farma", "k-24", "century", "halodoc", "alodokter",
      "klinik", "rumah sakit", "rs ", "lab", "pramita", "prodia", "optik", "dokter"
    ],
  },
};

export const BANK_ALIASES: Record<string, string[]> = {
  bca: ["bca", "klikbca", "m-bca", "mybca", "m-transfer", "bank central asia", "tahapan", "tahapan bca"],
  superbank: ["superbank", "super bank"],
  bni: ["bni", "wondr", "bank negara indonesia", "bni tapcash"],
  wondr: ["wondr", "wondr by bni", "bni"],
  tapcash: ["tapcash"],
  mandiri: ["mandiri", "livin", "bank mandiri"],
  bri: ["bri", "brimo", "bank rakyat indonesia"],
  brimo: ["brimo", "bri", "bank rakyat indonesia"],
  btn: ["btn", "bank tabungan negara"],
  cimb: ["cimb", "octo", "niaga"],
  jago: ["jago", "bank jago"],
  seabank: ["seabank", "sea bank"],
  blu: ["blu", "blubybcadigital"],
  jenius: ["jenius", "btpn"],
  permata: ["permata", "permatanet"],
  bsi: ["bsi", "bank syariah indonesia", "bsi mobile"],
  krom: ["krom", "bank krom"],
  linebank: ["line bank", "linebank", "hanabank", "hana bank", "keb hana"],
  bankmas: ["bank mas", "bankmas", "multiarta sentosa"],
  danamon: ["danamon", "bank danamon", "d-bank"],
  gopay: ["gopay", "gojek"],
  ovo: ["ovo"],
  dana: ["dana"],
  shopeepay: ["shopeepay", "spay"],
  linkaja: ["linkaja"],
  cash: ["cash", "tunai"],
};

export const KNOWN_MERCHANT_PATTERNS = [
  { match: (t: string) => /familymart|family\s*mart/i.test(t), name: "FamilyMart", categoryKey: "groceries" },
  { match: (t: string) => /mie\.?gacoan|mie\s+gacoan/i.test(t), name: "Mie Gacoan", categoryKey: "makanan" },
  { match: (t: string) => /ichiban\s*sushi|ichiban/i.test(t), name: "Ichiban Sushi", categoryKey: "makanan" },
  { match: (t: string) => /kitan?ura/i.test(t), name: "Kitamura Shabu-Shabu", categoryKey: "makanan" },
  { match: (t: string) => /bakmi\s+bangka/i.test(t), name: "Bakmi Bangka 99", categoryKey: "makanan" },
  { match: (t: string) => /mie\s+ayam\s+bintang/i.test(t), name: "Mie Ayam Bintang", categoryKey: "makanan" },
  { match: (t: string) => /warung\s+suputra/i.test(t), name: "Warung Suputra", categoryKey: "makanan" },
  { match: (t: string) => /esb\s+restaurant/i.test(t), name: "ESB Restaurant", categoryKey: "makanan" },
  { match: (t: string) => /belu[td]\s*karawang|elud\s*karawang/i.test(t), name: "Belut Karawang", categoryKey: "makanan" },
  { match: (t: string) => /brize\s*cafe|brize/i.test(t), name: "Brize Cafe", categoryKey: "kopi" },
  { match: (t: string) => /dominance\s*coffee|dominance|duminange/i.test(t), name: "Dominance Coffee", categoryKey: "kopi" },
  { match: (t: string) => /nogi\s*coffee|nogi/i.test(t), name: "Nogi Coffee & Space", categoryKey: "kopi" },
  { match: (t: string) => /kopi\s*kenangan|kopikenangan/i.test(t), name: "Kopi Kenangan", categoryKey: "kopi" },
  { match: (t: string) => /fore\s*coffee/i.test(t), name: "Fore Coffee", categoryKey: "kopi" },
  { match: (t: string) => /tomoro\s*coffee|tomoro/i.test(t), name: "Tomoro Coffee", categoryKey: "kopi" },
  { match: (t: string) => /janji\s*jiwa/i.test(t), name: "Janji Jiwa", categoryKey: "kopi" },
  { match: (t: string) => /shopeefood|shopee\s*food/i.test(t), name: "ShopeeFood", categoryKey: "makanan" },
  { match: (t: string) => /grabfood|grab\s*food/i.test(t), name: "GrabFood", categoryKey: "makanan" },
  { match: (t: string) => /gofood|go-food/i.test(t), name: "GoFood", categoryKey: "makanan" },
  { match: (t: string) => /bukalapak/i.test(t), name: "Bukalapak", categoryKey: "groceries" },
  { match: (t: string) => /tokopedia/i.test(t), name: "Tokopedia", categoryKey: "groceries" },
  { match: (t: string) => /shopee/i.test(t), name: "Shopee", categoryKey: "groceries" },
  { match: (t: string) => /kb\s+finansia/i.test(t), name: "KB Finansia Multi Finance", categoryKey: "tagihan" },
  { match: (t: string) => /dana\s+mapan|koperasi\s+si[mh]pan\s+pinjam/i.test(t), name: "KSP Dana Mapan", categoryKey: "tagihan" },
];

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesWord(text: string, word: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(word)}(?:[^a-z0-9]|$)`, "i").test(text);
}

/**
 * Normalizes Indonesian currency string (e.g. "Rp 150.000", "150.000,00", "150000", "49,000") to integer number.
 */
export function cleanCurrency(val: string): number {
  if (!val) return 0;

  // Remove currency symbol (Rp, IDR) and whitespace
  let clean = val.replace(/(?:rp\.?|idr)/gi, "").trim();

  // If format has ,00 decimal at the end (e.g. Rp39.075,00 or 44.075,00) -> remove ,00
  if (clean.includes(",") && clean.indexOf(",") === clean.length - 3) {
    clean = clean.slice(0, -3);
  } else if (clean.includes(".") && clean.indexOf(".") === clean.length - 3 && clean.length > 6) {
    // Rare .00 decimal e.g. 39075.00
    clean = clean.slice(0, -3);
  }

  // Remove dots, commas and whitespace
  clean = clean.replace(/[.,\s]/g, "");

  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses raw text extracted from a receipt / transfer slip.
 */
export function parseSlipText(
  rawText: string,
  userWallets: Wallet[] = [],
  userCategories: Category[] = [],
): ParsedSlipResult {
  if (!rawText || !rawText.trim()) {
    return {
      amount: null,
      amountFormatted: null,
      adminFee: null,
      adminFeeFormatted: null,
      type: "expense",
      date: new Date(),
      dateFormatted: format(new Date(), "yyyy-MM-dd"),
      merchantOrRecipient: "",
      sourceWalletId: userWallets[0]?.id || null,
      sourceWalletName: userWallets[0]?.name || null,
      destinationWalletId: null,
      destinationWalletName: null,
      categoryId: userCategories[0]?.id || null,
      categoryName: userCategories[0]?.name || null,
      confidence: 0,
      detectedSlipType: "general",
      isVirtualAccount: false,
      vaNumber: null,
      rawText: "",
      extractedLines: [],
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const fullTextLower = rawText.toLowerCase();

  // 1. Detect Slip Classification & Institution
  let detectedSlipType: ParsedSlipResult["detectedSlipType"] = "general";
  let detectedInstitution: string | undefined;

  if (fullTextLower.includes("qris") || fullTextLower.includes("nmid")) {
    detectedSlipType = "qris";
  } else if (
    fullTextLower.includes("gopay") ||
    fullTextLower.includes("gojek") ||
    fullTextLower.includes("shopeepay") ||
    fullTextLower.includes("ovo") ||
    (fullTextLower.includes("dana") && !fullTextLower.includes("sumber dana") && !fullTextLower.includes("dana mapan"))
  ) {
    detectedSlipType = "ewallet";
  } else if (
    fullTextLower.includes("transfer") ||
    fullTextLower.includes("m-transfer") ||
    fullTextLower.includes("superbank") ||
    fullTextLower.includes("livin") ||
    fullTextLower.includes("brimo") ||
    fullTextLower.includes("bca") ||
    fullTextLower.includes("mandiri") ||
    fullTextLower.includes("bni") ||
    fullTextLower.includes("wondr") ||
    fullTextLower.includes("line bank") ||
    fullTextLower.includes("hanabank") ||
    fullTextLower.includes("seabank")
  ) {
    detectedSlipType = "m_banking";
  } else if (
    fullTextLower.includes("total") ||
    fullTextLower.includes("kasir") ||
    fullTextLower.includes("kembali") ||
    fullTextLower.includes("tunai") ||
    fullTextLower.includes("subtotal") ||
    fullTextLower.includes("pos:") ||
    fullTextLower.includes("struk")
  ) {
    detectedSlipType = "receipt";
  }

  // Detect institution: prioritize sender / funding lines over acquirer lines
  const nonAcquirerLines = lines.filter((l) => !/nama\s+acquirer|acquirer/i.test(l));
  const nonAcquirerText = nonAcquirerLines.join("\n").toLowerCase();

  // Specific high-priority bank checks
  if (nonAcquirerText.includes("line bank") || nonAcquirerText.includes("hanabank")) {
    detectedInstitution = "LINEBANK";
  } else if (nonAcquirerText.includes("bank mas") || nonAcquirerText.includes("multiarta sentosa")) {
    detectedInstitution = "BANKMAS";
  } else if (nonAcquirerText.includes("seabank") || nonAcquirerText.includes("sea bank")) {
    detectedInstitution = "SEABANK";
  } else if (nonAcquirerText.includes("bsi") || nonAcquirerText.includes("bank syariah indonesia")) {
    detectedInstitution = "BSI";
  } else if (nonAcquirerText.includes("superbank") || nonAcquirerText.includes("super bank")) {
    detectedInstitution = "SUPERBANK";
  } else if (nonAcquirerText.includes("tahapan") || nonAcquirerText.includes("bca")) {
    detectedInstitution = "BCA";
  } else {
    for (const [instKey, aliases] of Object.entries(BANK_ALIASES)) {
      const matched = aliases.some((a) => {
        if (a === "dana") {
          return matchesWord(nonAcquirerText.replace(/sumber\s+dana|dana\s+mapan/gi, ""), "dana");
        }
        return matchesWord(nonAcquirerText, a);
      });

      if (matched) {
        detectedInstitution = instKey.toUpperCase();
        break;
      }
    }
  }

  // If slip explicitly says QRIS and no institution matched yet
  if (!detectedInstitution && (fullTextLower.includes("qris") || fullTextLower.includes("nmid"))) {
    detectedInstitution = "QRIS";
  }

  // 2. Extract Amount
  let detectedAmount: number | null = null;
  const candidateAmounts: { amount: number; score: number; line: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    const prevLineLower = i > 0 ? lines[i - 1].toLowerCase() : "";
    const contextLower = `${prevLineLower} ${lineLower}`.trim();

    // Skip reference lines / transaction ID / account numbers
    const isReferenceLine =
      contextLower.includes("referensi") ||
      contextLower.includes("no. ref") ||
      contextLower.includes("ref no") ||
      contextLower.includes("id transaksi") ||
      contextLower.includes("no. transaksi") ||
      contextLower.includes("no. pesanan") ||
      contextLower.includes("order id") ||
      contextLower.includes("no. rekening") ||
      contextLower.includes("nomor rekening") ||
      contextLower.includes("terminal id") ||
      contextLower.includes("rrn");
    if (isReferenceLine && !contextLower.includes("total") && !contextLower.includes("nominal")) {
      continue;
    }

    // Skip card / account numbers / ref numbers (10+ digits without separator)
    if (/\b\d{10,19}\b/.test(line)) {
      continue;
    }

    // Skip phone numbers
    if (/\b08\d{8,12}\b/.test(line)) {
      continue;
    }

    // Skip lines with admin fees
    const isAdminFeeLine =
      contextLower.includes("admin") ||
      contextLower.includes("biaya transaksi") ||
      contextLower.includes("biaya:") ||
      contextLower.includes("fee");

    // Skip discount or negative lines: % or (2.300) or diskon or soft opening
    const isDiscountOrNegative =
      lineLower.includes("%") ||
      /\(\s*[\d.,]+\s*\)/.test(line) ||
      /-\s*(?:rp\.?|idr)?\s*[\d.,]+/i.test(line) ||
      contextLower.includes("diskon") ||
      contextLower.includes("voucher") ||
      contextLower.includes("hemat") ||
      contextLower.includes("potongan") ||
      contextLower.includes("soft opening");

    // Line item with quantity: e.g. "1x @ 10,000", "2x 25.000", "1 30,000"
    const isLineItem =
      /\b\d+\s*x\s*@?\s*[\d.,]+/i.test(line) ||
      /^\s*\d+\s+[a-z]+/i.test(line);

    // Search for currency numbers
    const currencyMatches = line.match(
      /(?:rp\.?|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:,[0-9]{2})?|[0-9]{4,9})/gi
    );

    if (currencyMatches) {
      for (const match of currencyMatches) {
        const amt = cleanCurrency(match);

        // Ignore small noise (< Rp 1.000) or massive unreasonable numbers (> Rp 500.000.000)
        if (amt < 1000 || amt > 500_000_000) continue;

        // Discard if the raw match is a long digit sequence (>= 11 digits) without Rp indicator
        const rawDigitsOnly = match.replace(/\D/g, "");
        if (rawDigitsOnly.length >= 11 && !match.toLowerCase().includes("rp")) {
          continue;
        }

        let score = 1;

        if (
          contextLower.includes("grand total") ||
          contextLower.includes("téng s6") ||
          contextLower.includes("tong cong") ||
          contextLower.includes("total bayar") ||
          contextLower.includes("total belanja") ||
          contextLower.includes("total pembayaran") ||
          contextLower.includes("jumlah total")
        ) {
          score += 150;
        } else if (
          contextLower.includes("total transaksi") ||
          contextLower.includes("purchase") ||
          contextLower.includes("non tunai") ||
          contextLower.includes("nontunai") ||
          contextLower.includes("qris")
        ) {
          score += 120;
        } else if (contextLower.includes("transfer") && !contextLower.includes("biaya")) {
          score += 95;
        } else if (
          (contextLower.includes("total") ||
            contextLower.includes("tota)") ||
            contextLower.includes("tota1") ||
            contextLower.includes("tota]")) &&
          !contextLower.includes("subtotal") &&
          !contextLower.includes("sub total")
        ) {
          score += 90;
        } else if (
          contextLower.includes("nominal transfer") ||
          contextLower.includes("jumlah transfer") ||
          contextLower.includes("jumlah")
        ) {
          score += 75;
        } else if (contextLower.includes("nominal bayar")) {
          score += 60;
        } else if (contextLower.includes("nominal") || contextLower.includes("amount")) {
          score += 50;
        } else if (lineLower.startsWith("rp") || lineLower.includes("rp.")) {
          score += 35;
        }

        // Severe penalties
        if (isDiscountOrNegative) {
          score -= 300;
        }
        if (isLineItem) {
          score -= 80;
        }
        if (contextLower.includes("subtotal") || contextLower.includes("sub total")) {
          score -= 50;
        }
        if (isAdminFeeLine) {
          score -= 100;
        }

        // Tax / PPN / PB1 / Service Charge penalty
        if (
          contextLower.includes("pajak") ||
          contextLower.includes("ppn") ||
          contextLower.includes("pb1") ||
          contextLower.includes("pb 1") ||
          contextLower.includes("service charge") ||
          contextLower.includes("tax") ||
          contextLower.includes("pjk")
        ) {
          score -= 250;
        }

        // Cash / Tunai tendered penalty (unless nontunai / non-tunai)
        if (
          (contextLower.includes("tunai") ||
            contextLower.includes("cash") ||
            contextLower.includes("uang diterima") ||
            contextLower.includes("dibayar") ||
            contextLower.includes("tendered")) &&
          !contextLower.includes("non tunai") &&
          !contextLower.includes("nontunai")
        ) {
          score -= 150;
        }

        if (
          contextLower.includes("kembalian") ||
          contextLower.includes("kembali") ||
          contextLower.includes("change")
        ) {
          score -= 280;
        }

        candidateAmounts.push({ amount: amt, score, line });
      }
    }
  }

  // Cross-validation: Check if any candidate equals Cash - Change
  const cashCandidate = candidateAmounts.find(
    (c) =>
      (c.line.toLowerCase().includes("tunai") || c.line.toLowerCase().includes("cash")) &&
      !c.line.toLowerCase().includes("non"),
  );
  const changeCandidate = candidateAmounts.find(
    (c) =>
      c.line.toLowerCase().includes("kembali") || c.line.toLowerCase().includes("change"),
  );
  if (cashCandidate && changeCandidate) {
    const diff = cashCandidate.amount - changeCandidate.amount;
    if (diff > 0) {
      const match = candidateAmounts.find((c) => c.amount === diff);
      if (match) {
        match.score += 350; // Absolute mathematical confirmation of Grand Total
      }
    }
  }

  // Sort candidate amounts by score descending
  candidateAmounts.sort((a, b) => b.score - a.score);

  if (candidateAmounts.length > 0) {
    detectedAmount = candidateAmounts[0].amount;
  }

  // 2b. Extract Admin Fee (BI-FAST, Top-Up, Inter-bank fee)
  let detectedAdminFee: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    const prevLineLower = i > 0 ? lines[i - 1].toLowerCase() : "";
    const contextLower = `${prevLineLower} ${lineLower}`.trim();

    const isAdminFeePattern =
      contextLower.includes("biaya admin") ||
      contextLower.includes("biaya transfer") ||
      contextLower.includes("biaya transaksi") ||
      contextLower.includes("biaya layanan") ||
      contextLower.includes("admin fee") ||
      contextLower.includes("bi-fast") ||
      contextLower.includes("bifast") ||
      contextLower.includes("biaya:") ||
      lineLower.startsWith("biaya ") ||
      lineLower.startsWith("admin ");

    if (isAdminFeePattern) {
      const feeMatches = line.match(
        /(?:rp\.?|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:,[0-9]{2})?|[0-9]{3,6})/gi
      );
      if (feeMatches) {
        for (const m of feeMatches) {
          const feeAmt = cleanCurrency(m);
          // Standard Indonesian admin fees range from Rp 500 to Rp 25.000
          if (feeAmt >= 500 && feeAmt <= 25_000) {
            detectedAdminFee = feeAmt;
            break;
          }
        }
      }
      if (detectedAdminFee) break;
    }
  }

  // Cross-validation: Check if detectedAmount was accidentally the Gross Total (Principal + Fee)
  // E.g., Principal Rp 100.000, Fee Rp 2.500, Gross Total Rp 102.500.
  // We want detectedAmount to be the principal Rp 100.000!
  if (detectedAmount && detectedAdminFee && detectedAmount > detectedAdminFee) {
    const netPrincipal = detectedAmount - detectedAdminFee;
    const principalCandidate = candidateAmounts.find((c) => c.amount === netPrincipal);
    if (principalCandidate) {
      detectedAmount = netPrincipal;
    }
  }

  // 2c. Detect Virtual Account (VA)
  const isVirtualAccount =
    fullTextLower.includes("virtual account") ||
    fullTextLower.includes("briva") ||
    fullTextLower.includes("bca va") ||
    fullTextLower.includes("mandiri va") ||
    fullTextLower.includes("bni va") ||
    fullTextLower.includes("permata va") ||
    fullTextLower.includes("cimb va") ||
    fullTextLower.includes("kode bayar") ||
    /\bva\s*[:\-#]/i.test(rawText) ||
    /\bno\.?\s*va\b/i.test(rawText);

  let vaNumber: string | null = null;
  const vaMatch = rawText.match(
    /(?:virtual\s*account|briva|va|nomor\s*va|kode\s*bayar)\s*[:\-#]?\s*(\d{8,20})/i
  );
  if (vaMatch && vaMatch[1]) {
    vaNumber = vaMatch[1];
  }

  // 3. Extract Date
  let detectedDate = new Date();
  const MONTHS: Record<string, number> = {
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

  const textDateMatch = rawText.match(
    /\b(\d{1,2})[\s/-]+(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec|[a-z]+)[\s/-]+(\d{2,4})\b/i
  );
  const numDateMatch = rawText.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);

  if (textDateMatch) {
    const day = parseInt(textDateMatch[1], 10);
    const monthStr = textDateMatch[2].toLowerCase();
    const month = MONTHS[monthStr] ?? -1;
    let year = parseInt(textDateMatch[3], 10);
    if (year < 100) year += 2000;

    if (month >= 0 && day >= 1 && day <= 31 && year >= 2020 && year <= 2040) {
      detectedDate = new Date(year, month, day);
    }
  } else if (numDateMatch) {
    const p1 = parseInt(numDateMatch[1], 10);
    const p2 = parseInt(numDateMatch[2], 10);
    let year = parseInt(numDateMatch[3], 10);
    if (year < 100) year += 2000;

    if (p1 >= 1 && p1 <= 31 && p2 >= 1 && p2 <= 12 && year >= 2020 && year <= 2040) {
      detectedDate = new Date(year, p2 - 1, p1);
    }
  }

  // 3b. Extract Time (e.g. 14:22, 10:15 WIB, 18:30:11)
  let detectedTime: string | undefined = undefined;
  const timeMatch = rawText.match(
    /\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.][0-5]\d)?(?:\s*(?:wib|wita|wit|am|pm))?\b/i
  );
  if (timeMatch) {
    const hh = parseInt(timeMatch[1], 10);
    const mm = parseInt(timeMatch[2], 10);
    if (!isNaN(hh) && !isNaN(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      detectedTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      detectedDate.setHours(hh, mm, 0, 0);
    }
  }

  // 4. Extract Merchant / Note
  let merchantOrRecipient = "";
  let detectedCategoryFromMerchant: string | undefined = undefined;

  // Check known merchants first
  for (const km of KNOWN_MERCHANT_PATTERNS) {
    if (km.match(fullTextLower)) {
      merchantOrRecipient = km.name;
      detectedCategoryFromMerchant = km.categoryKey;
      break;
    }
  }

  // Check Indomaret / Alfamart specifics
  if (!merchantOrRecipient) {
    if (fullTextLower.includes("indomaret") || fullTextLower.includes("indomarco") || fullTextLower.includes("klikindomaret")) {
      const qrisIndoMatch = rawText.match(/indomaret\s+([a-z0-9\s]+?)(?:\s+id|\n|$)/i);
      if (qrisIndoMatch && qrisIndoMatch[1]) {
        merchantOrRecipient = `Indomaret ${qrisIndoMatch[1].trim()}`;
      } else {
        merchantOrRecipient = "Indomaret";
      }
      detectedCategoryFromMerchant = "groceries";
    } else if (fullTextLower.includes("alfamart") || fullTextLower.includes("alfamidi")) {
      merchantOrRecipient = fullTextLower.includes("alfamidi") ? "Alfamidi" : "Alfamart";
      detectedCategoryFromMerchant = "groceries";
    }
  }

  // Line-by-line label matching
  if (!merchantOrRecipient) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Single line: "Payment to <merchant>", "Ke <merchant>", "Penerima: <merchant>", "Receiver <merchant>"
      const inlineMatch = line.match(
        /^(?:payment\s+to|bayar\s+ke|dibayar\s+kepada|tujuan\s+transfer|transfer\s+ke|penerima|receiver|nama\s+penerima|nama\s+periairas|merchant|nama\s+merchant|toko|perusahaan|institusi|nama\s+va|nama\s+pelanggan)\s*[:\-]?\s*([a-z0-9\s.&'-]+)$/i
      );
      if (inlineMatch && inlineMatch[1] && inlineMatch[1].trim().length >= 3) {
        const candidate = inlineMatch[1].trim();
        if (!/^(?:total|nominal|rp|idr|wib|\d+|dari|rekening)/i.test(candidate)) {
          merchantOrRecipient = candidate.slice(0, 45);
          break;
        }
      }

      // "Ke <target>" (e.g. "Ke warung suputra", "Ke ESB RESTAURANT TECHNOLOGY")
      const keMatch = line.match(/^ke\s+([a-z0-9\s.&'-]+)$/i);
      if (keMatch && keMatch[1] && keMatch[1].trim().length >= 3) {
        const candidate = keMatch[1].trim();
        if (!/^(?:total|nominal|rp|idr|rekening|bank|bca|mandiri|bri|bni)/i.test(candidate)) {
          merchantOrRecipient = candidate.slice(0, 45);
          break;
        }
      }

      // Multi-line: label on line i, recipient on line i+1
      if (/^(?:penerima|receiver|tujuan|kepada|nama\s+merchant|nama\s+toko|perusahaan|institusi|nama\s+va|nama\s+pelanggan)$/i.test(line)) {
        if (i < lines.length - 1) {
          const nextLine = lines[i + 1].trim();
          if (
            nextLine.length >= 3 &&
            !/^(?:total|nominal|rp|idr|wib|\d+|dari|rekening|sumber\s+dana)/i.test(nextLine)
          ) {
            merchantOrRecipient = nextLine.slice(0, 45);
            break;
          }
        }
      }
    }
  }

  // Header of physical receipt (e.g. Kitamura Jambi, Brize Cafe, etc.)
  if (!merchantOrRecipient && lines.length > 0) {
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      const l = lines[i].replace(/^[:\s\-]+/, "").trim();
      if (
        !/struk|bukti|resi|selamat|selesai|receipt|invoice|\d{5,}|http|www|pos:|kasir|tanggal/i.test(l) &&
        !/^(?:rp|idr|total|nominal)/i.test(l) &&
        l.length >= 3 &&
        l.length <= 40 &&
        /[a-z]/i.test(l)
      ) {
        merchantOrRecipient = l;
        break;
      }
    }
  }

  // Clean up merchant name
  if (merchantOrRecipient) {
    merchantOrRecipient = merchantOrRecipient
      .replace(/[\*\_\#\-\:\;]+$/g, "")
      .replace(/^[:\s\-]+/, "")
      .replace(/\s+(?:bni|bca|mandiri|bri)$/i, "") // Remove trailing bank tag from merchant name
      .trim();
  }

  if (!merchantOrRecipient && detectedInstitution) {
    merchantOrRecipient = `Transaksi ${detectedInstitution}`;
  }

  // 5. Match Source Wallet against User's Wallets
  let matchedWallet: Wallet | null = null;

  // Filter spendable wallets so Liabilities, Piutang, Crypto, Saham are never chosen as default
  const isSpendableWallet = (w: Wallet) => {
    const n = w.name.toLowerCase();
    return (
      !n.includes("liabilit") &&
      !n.includes("hutang") &&
      !n.includes("pinjam") &&
      !n.includes("piutang") &&
      !n.includes("crypto") &&
      !n.includes("saham") &&
      !n.includes("investasi") &&
      !n.includes("term loan")
    );
  };

  const spendableWallets = userWallets.filter(isSpendableWallet);
  const eligibleWallets = spendableWallets.length > 0 ? spendableWallets : userWallets;

  if (userWallets.length > 0) {
    // Priority 1: Match detectedInstitution if it's a known bank/wallet (not just generic QRIS)
    if (detectedInstitution && detectedInstitution !== "QRIS") {
      const instLower = detectedInstitution.toLowerCase();
      matchedWallet =
        userWallets.find((w) => {
          const wLower = w.name.toLowerCase();
          const aliases = BANK_ALIASES[instLower] || [instLower];
          return aliases.some((a) => wLower === a || matchesWord(wLower, a));
        }) || null;
    }

    // Priority 2: Look for user wallet name explicitly in non-acquirer lines
    if (!matchedWallet) {
      for (const line of nonAcquirerLines) {
        const lineLower = line.toLowerCase();
        if (lineLower.includes("penerima") || lineLower.includes("tujuan")) {
          continue;
        }

        for (const w of eligibleWallets) {
          const wLower = w.name.toLowerCase();
          // Avoid matching "dana" when line is "sumber dana"
          if (wLower === "dana" && lineLower.includes("sumber dana")) {
            const afterSumberDana = lineLower.replace(/sumber\s+dana/gi, "");
            if (!matchesWord(afterSumberDana, "dana")) continue;
          }
          if (matchesWord(lineLower, wLower)) {
            matchedWallet = w;
            break;
          }
        }
        if (matchedWallet) break;
      }
    }

    // Priority 3: Check entire nonAcquirerText against BANK_ALIASES
    if (!matchedWallet) {
      for (const [instKey, aliases] of Object.entries(BANK_ALIASES)) {
        const matchedAlias = aliases.find((a) => {
          if (a === "dana") {
            const cleaned = nonAcquirerText.replace(/sumber\s+dana|dana\s+mapan/gi, "");
            return matchesWord(cleaned, "dana");
          }
          return matchesWord(nonAcquirerText, a);
        });

        if (matchedAlias) {
          matchedWallet =
            eligibleWallets.find((w) => {
              const wLower = w.name.toLowerCase();
              return wLower === instKey || aliases.some((a) => matchesWord(wLower, a));
            }) || null;
          if (matchedWallet) break;
        }
      }
    }

    // Smart Fallback: Never Liabilities
    if (!matchedWallet && eligibleWallets.length > 0) {
      if (detectedSlipType === "receipt") {
        matchedWallet =
          eligibleWallets.find((w) => /cash|tunai/i.test(w.name)) ||
          eligibleWallets.find((w) => /bca|mandiri|bri|bni/i.test(w.name)) ||
          eligibleWallets[0];
      } else {
        matchedWallet =
          eligibleWallets.find((w) => /bca|mandiri|bri|bni|seabank|jago/i.test(w.name)) ||
          eligibleWallets[0];
      }
    }
  }

  // 6. Match Category against User's Categories (Using Unified Semantic Taxonomy Engine)
  let matchedCategory: Category | null = null;
  let detectedCategory: string | undefined = undefined;

  // Priority 0: Self-Learning Merchant Memory (Pilar 1)
  if (merchantOrRecipient) {
    const memory = getMerchantMemory(merchantOrRecipient);
    if (memory && userCategories.length > 0) {
      const match = userCategories.find(
        (c) =>
          c.id === memory.categoryId ||
          c.name.toLowerCase() === memory.categoryName.toLowerCase(),
      );
      if (match) {
        matchedCategory = match;
        detectedCategory = match.name;
      }
    }
  }

  // Semantic Classifier check on merchant name or receipt text
  if (!matchedCategory) {
    const semanticClass = classifySemanticCategory(
      merchantOrRecipient || rawText,
      userCategories,
    );
    if (semanticClass.category) {
      matchedCategory = semanticClass.category;
      detectedCategory = semanticClass.category.name;
    }
  }

  // Priority 1: Category from recognized merchant brand
  if (!matchedCategory && detectedCategoryFromMerchant) {
    const grp = CATEGORY_SYNONYMS[detectedCategoryFromMerchant];
    if (grp) {
      detectedCategory = grp.targetKeys[0].charAt(0).toUpperCase() + grp.targetKeys[0].slice(1);
      if (userCategories.length > 0) {
        matchedCategory =
          userCategories.find((c) => {
            const cLower = c.name.toLowerCase();
            return grp.targetKeys.some(
              (target) => cLower.includes(target) || target.includes(cLower)
            );
          }) || null;
      }
    }
  }

  // Priority 2: Match merchant name against CATEGORY_SYNONYMS keywords
  const merchantLower = merchantOrRecipient.toLowerCase();
  if (!matchedCategory) {
    for (const group of Object.values(CATEGORY_SYNONYMS)) {
      const kwMatch = group.keywords.some((kw) => merchantLower.includes(kw));
      if (kwMatch) {
        detectedCategory = group.targetKeys[0].charAt(0).toUpperCase() + group.targetKeys[0].slice(1);
        if (userCategories.length > 0) {
          matchedCategory =
            userCategories.find((c) => {
              const cLower = c.name.toLowerCase();
              return group.targetKeys.some(
                (target) => cLower.includes(target) || target.includes(cLower)
              );
            }) || null;
        }
        if (matchedCategory) break;
      }
    }
  }

  // Priority 3: Match full text against CATEGORY_SYNONYMS keywords
  if (!matchedCategory) {
    for (const group of Object.values(CATEGORY_SYNONYMS)) {
      const kwMatch = group.keywords.some((kw) => matchesWord(fullTextLower, kw) || fullTextLower.includes(kw));
      if (kwMatch) {
        if (!detectedCategory) {
          detectedCategory = group.targetKeys[0].charAt(0).toUpperCase() + group.targetKeys[0].slice(1);
        }
        if (userCategories.length > 0) {
          matchedCategory =
            userCategories.find((c) => {
              const cLower = c.name.toLowerCase();
              return group.targetKeys.some(
                (target) => cLower.includes(target) || target.includes(cLower)
              );
            }) || null;
        }
        if (matchedCategory) break;
      }
    }
  }

  // Priority 4: Direct name matching with user categories (excluding admin & fee)
  if (!matchedCategory && userCategories.length > 0) {
    for (const c of userCategories) {
      const cLower = c.name.toLowerCase();
      // Skip admin fee unless fullText specifically is an admin charge
      if (cLower.includes("admin") || cLower.includes("fee")) continue;
      if (matchesWord(fullTextLower, cLower)) {
        matchedCategory = c;
        break;
      }
    }
  }

  // Smart Fallback Category: Never blind Admin & Fee
  const isCleanCategory = (c: Category) => {
    const n = c.name.toLowerCase();
    return (
      !n.includes("admin") &&
      !n.includes("fee") &&
      !n.includes("pajak") &&
      !n.includes("legal") &&
      !n.includes("rugi") &&
      !n.includes("kerugian")
    );
  };
  const cleanCategories = userCategories.filter(isCleanCategory);
  const fallbackCatPool = cleanCategories.length > 0 ? cleanCategories : userCategories;

  if (!matchedCategory && fallbackCatPool.length > 0) {
    if (detectedSlipType === "receipt") {
      matchedCategory =
        fallbackCatPool.find((c) => /makanan|kuliner|food|resto/i.test(c.name)) ||
        fallbackCatPool.find((c) => /belanja|groceries/i.test(c.name)) ||
        fallbackCatPool.find((c) => /lainnya|other/i.test(c.name)) ||
        fallbackCatPool[0];
    } else {
      matchedCategory =
        fallbackCatPool.find((c) => /lainnya|other/i.test(c.name)) ||
        fallbackCatPool.find((c) => /belanja/i.test(c.name)) ||
        fallbackCatPool[0];
    }
  }

  // 6b. Detect Destination Wallet (for Transfer / Top-up Slips)
  let matchedDestinationWallet: Wallet | null = null;

  // ----------------------------------------------------------------
  // MULTI-SIGNAL TRANSACTION TYPE SCORING
  // Score three type hypotheses; highest score wins.
  // ----------------------------------------------------------------
  let incomeScore = 0;
  let transferScore = 0;
  let expenseScore = 0;

  // --- INCOME SIGNALS ---
  const INCOME_STRONG = [
    "transfer masuk", "dana masuk", "uang masuk", "saldo masuk",
    "pembayaran masuk", "kredit masuk", "terima transfer", "dana diterima",
    "menerima transfer", "kamu menerima", "anda menerima",
    "telah menerima", "telah terkirim ke", "berhasil masuk",
    "menerima dana", "menerima kiriman", "top-up berhasil",
    "topup berhasil", "saldo berhasil ditambahkan",
    "pencairan pinjaman", "pencairan dana", "gaji masuk",
    "gaji telah ditransfer", "pembayaran gaji",
    "refund berhasil", "pengembalian dana", "pengembalian berhasil",
    "cashback berhasil", "bonus masuk",
    "penerimaan", "incoming transfer", "credit", // bank statement term
    "incoming", "received",
  ];
  const INCOME_MODERATE = [
    "diterima", "pemasukan", "masuk ke rekening",
    "saldo bertambah", "ke rekening kamu", "ke akun kamu",
    "top up sukses", "topup sukses",
    "gaji", "honor", "dividen",
  ];

  for (const sig of INCOME_STRONG) {
    if (fullTextLower.includes(sig)) incomeScore += 20;
  }
  for (const sig of INCOME_MODERATE) {
    if (fullTextLower.includes(sig)) incomeScore += 8;
  }

  // --- TRANSFER SIGNALS ---
  const TRANSFER_STRONG = [
    "berhasil transfer", "transfer berhasil", "kirim dana berhasil",
    "berhasil mengirim", "transfer ke rekening", "transfer ke akun",
    "dana terkirim", "uang terkirim", "bi-fast", "bifast",
    "realtime online", "sknbi", "rtgs",
    "isi ulang", "top up gopay", "top up ovo", "top up dana",
    "top up shopeepay", "top up linkaja", "isi saldo gopay",
    "isi saldo ovo", "isi saldo dana",
    "transfer antar bank", "transfer antar rekening",
    "qr transfer",
  ];
  const TRANSFER_MODERATE = [
    "transfer", "jumlah transfer", "nominal transfer",
    "kirim dana", "pindah dana",
    "top up", "topup", "isi saldo",
    "ke rekening", "tujuan transfer",
    "bank tujuan", "transfer money",
  ];

  for (const sig of TRANSFER_STRONG) {
    if (fullTextLower.includes(sig)) transferScore += 20;
  }
  for (const sig of TRANSFER_MODERATE) {
    if (fullTextLower.includes(sig)) transferScore += 6;
  }

  // If a destination wallet in user's wallets is found, strongly boost transfer
  // First: extract destination candidates from label lines
  const destinationCandidates: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const keMatch = line.match(
      /^(?:ke|transfer\s+ke|transfer\s+to|recipient\s+bank|bank\s+tujuan|tujuan\s+transfer|penerima)\s*[:\-]?\s*(.+)$/i
    );
    if (keMatch && keMatch[1]) {
      destinationCandidates.push(keMatch[1].trim());
    } else if (
      /^(?:ke|transfer\s+ke|transfer\s+to|recipient\s+bank|bank\s+tujuan|penerima)$/i.test(line)
    ) {
      if (i < lines.length - 1) {
        destinationCandidates.push(lines[i + 1].trim());
      }
    }
  }

  const destSearchText = (destinationCandidates.join(" ") + " " + merchantOrRecipient).toLowerCase();

  // Try to match destination to a user wallet
  for (const w of eligibleWallets) {
    if (matchedWallet && w.id === matchedWallet.id) continue;
    const wLower = w.name.toLowerCase();
    const aliases = BANK_ALIASES[wLower] || [wLower];
    const isDestMatch = aliases.some(
      (alias) => destSearchText.includes(alias) || matchesWord(destSearchText, alias)
    );
    if (isDestMatch) {
      matchedDestinationWallet = w;
      transferScore += 30; // Destination wallet confirmed → strongly transfer
      break;
    }
  }

  // --- VIRTUAL ACCOUNT (VA) OWNERSHIP-BASED ROUTING ---
  // If payment is via Virtual Account:
  // - Top-up to user-owned e-wallet (e.g. ShopeePay, DANA, GoPay, OVO) -> Transfer to that wallet
  // - Payment to merchant, e-commerce, or someone else's e-wallet -> Expense
  if (isVirtualAccount) {
    const EWALLET_KEYS = ["shopeepay", "shopee pay", "spay", "dana", "gopay", "ovo", "linkaja"];
    const isEWalletVA = EWALLET_KEYS.some(
      (ew) => destSearchText.includes(ew) || fullTextLower.includes(ew)
    );

    if (isEWalletVA && matchedDestinationWallet) {
      // User owns the destination e-wallet account -> Confirmed Inter-Wallet Transfer!
      transferScore += 50;
    } else {
      // E-commerce purchase (Shopee, Tokopedia, Blibli, etc.) or utility bill -> Confirmed Expense!
      expenseScore += 45;
    }
  }

  // --- EXPENSE SIGNALS ---
  // QRIS, struk kasir, debit purchase → expense
  const EXPENSE_STRONG = [
    "qris", "nmid", "merchant id",
    "kasir", "struk", "nota", "invoice",
    "purchase", "debet", "pembayaran qris",
    "belanja", "bayar ke", "payment to",
    "transaksi berhasil dibayar",
  ];
  const EXPENSE_MODERATE = [
    "total bayar", "grand total", "total belanja",
    "subtotal", "kembalian", "kembali", "tunai",
    "merchant", "toko", "resto", "restoran",
  ];

  for (const sig of EXPENSE_STRONG) {
    if (fullTextLower.includes(sig)) expenseScore += 18;
  }
  for (const sig of EXPENSE_MODERATE) {
    if (fullTextLower.includes(sig)) expenseScore += 5;
  }

  // If slip type is physical receipt → strong expense prior
  if (detectedSlipType === "receipt") expenseScore += 25;
  if (detectedSlipType === "qris") expenseScore += 20;

  // INCOME: if income > both, it's income
  // TRANSFER: if transfer > income AND dest wallet found (or transfer >> expense)
  // EXPENSE: default

  let type: TransactionType = "expense";

  // Income wins if it has the strongest signal and isn't confused with a send-transfer
  if (incomeScore > transferScore && incomeScore > expenseScore && incomeScore >= 20) {
    type = "income";
  } else if (
    transferScore > expenseScore &&
    (matchedDestinationWallet !== null || transferScore >= 26)
  ) {
    type = "transfer";
  } else {
    type = "expense";
  }

  // --- INCOME-SPECIFIC: For income slips, source wallet = the destination account (where money arrived)
  // Re-match matchedWallet for income slips using the "penerima" / "tujuan" lines
  // that contain a user account. The income "from" field becomes merchant (sender).
  if (type === "income") {
    // Try to find which user wallet received the money by scanning "ke:" / "penerima:" lines
    // For income slips the "tujuan" / "ke" lines point to the user's own wallet
    const incomeDestCandidates: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const destMatch = line.match(
        /^(?:ke|rekening\s+tujuan|akun\s+tujuan|penerima|tujuan|masuk\s+ke)\s*[:\-]?\s*(.+)$/i
      );
      if (destMatch && destMatch[1]) incomeDestCandidates.push(destMatch[1].trim());
      // "dari:" / "pengirim:" = sender (will become merchant)
      const senderMatch = line.match(
        /^(?:dari|pengirim|sumber\s+dana|from)\s*[:\-]?\s*(.+)$/i
      );
      if (senderMatch && senderMatch[1] && !merchantOrRecipient) {
        const candidate = senderMatch[1].trim();
        if (candidate.length >= 3 && !/^\d+$/.test(candidate)) {
          merchantOrRecipient = candidate.slice(0, 45);
        }
      }
    }

    // Try to match income dest to a user wallet (override matchedWallet if found)
    if (incomeDestCandidates.length > 0) {
      const incomeDestText = incomeDestCandidates.join(" ").toLowerCase();
      for (const w of eligibleWallets) {
        const wLower = w.name.toLowerCase();
        const aliases = BANK_ALIASES[wLower] || [wLower];
        if (aliases.some((a) => incomeDestText.includes(a) || matchesWord(incomeDestText, a))) {
          matchedWallet = w;
          break;
        }
      }
    }
  }

  // 8. Confidence Calculation — field-presence weighted
  let confidence = 0.25;
  if (detectedAmount && detectedAmount > 0) confidence += 0.30;
  if (detectedInstitution) confidence += 0.15;
  if (merchantOrRecipient) confidence += 0.12;
  if (matchedWallet) confidence += 0.08;
  if (type === "transfer" && matchedDestinationWallet) confidence += 0.10;
  if (detectedAdminFee && detectedAdminFee > 0) confidence += 0.05;
  if (isVirtualAccount && vaNumber) confidence += 0.05;
  // Penalty if type is ambiguous (both income and transfer signals present)
  if (incomeScore > 0 && transferScore > 0 && Math.abs(incomeScore - transferScore) < 15) {
    confidence -= 0.10;
  }

  return {
    amount: detectedAmount,
    amountFormatted: detectedAmount ? formatRupiah(detectedAmount) : null,
    adminFee: detectedAdminFee,
    adminFeeFormatted: detectedAdminFee ? formatRupiah(detectedAdminFee) : null,
    type,
    date: detectedDate,
    dateFormatted: format(detectedDate, "yyyy-MM-dd"),
    time: detectedTime,
    merchantOrRecipient,
    sourceWalletId: matchedWallet?.id || null,
    sourceWalletName: matchedWallet?.name || null,
    destinationWalletId: matchedDestinationWallet?.id || null,
    destinationWalletName: matchedDestinationWallet?.name || null,
    categoryId: matchedCategory?.id || null,
    categoryName: matchedCategory?.name || null,
    confidence: Math.min(1, Math.round(confidence * 100) / 100),
    detectedSlipType,
    detectedInstitution,
    detectedCategory,
    isVirtualAccount,
    vaNumber,
    rawText,
    extractedLines: lines,
  };
}
