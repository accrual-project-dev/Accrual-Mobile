import { subDays } from "date-fns";
import type { Category, Wallet, TransactionType } from "./types";
import { formatRupiah } from "./utils";
import { classifySemanticCategory } from "./semanticClassifier";

export interface ParsedTransactionResult {
  amount: number | null;
  amountFormatted: string | null;
  type: TransactionType;
  categoryId: string | null;
  categoryName: string | null;
  categoryEmoji?: string;
  walletId: string | null;
  walletName: string | null;
  toWalletId: string | null;
  toWalletName: string | null;
  date: Date;
  dateLabel: string;
  note: string;
  rawInput: string;
  confidence: number;
  matchedTokens: {
    amountToken?: string;
    categoryToken?: string;
    walletToken?: string;
    toWalletToken?: string;
    dateToken?: string;
  };
}

export function stemIndonesianCategoryWord(word: string): string {
  let w = word.toLowerCase().trim();
  // Strip common Indonesian STT artifacts
  w = w.replace(/[^a-z0-9]/g, "");
  if (!w) return "";

  // Common direct verb/slang to noun root mappings
  if (w === "ngopi" || w === "ngops") return "kopi";
  if (w === "ngemil" || w === "nyemil") return "makan";
  if (w === "sarapan") return "makan";
  if (w === "makann" || w === "makam" || w === "mkn") return "makan";
  if (w === "bensin" || w === "pertalite" || w === "pertamax" || w === "solar") return "bensin";

  // Strip suffix -nya (makannya -> makan, bensinnya -> bensin, kopinya -> kopi)
  if (w.endsWith("nya") && w.length > 5) {
    w = w.slice(0, -3);
  }

  // Common root words ending in "an" that should NOT be stripped further
  if (w === "makan" || w === "jajan") {
    return w;
  }

  // Strip suffix -an (makanan -> makan, minuman -> minum, jajanan -> jajan, gajian -> gaji)
  if (w.endsWith("an") && w.length > 4) {
    w = w.slice(0, -2);
  }

  // Strip prefix ng- or nge- (ngopi -> kopi)
  if (w.startsWith("nge") && w.length > 5) {
    w = w.slice(3);
  } else if (w.startsWith("ng") && w.length > 4) {
    w = w.slice(2);
  }

  return w;
}

export function normalizeSpokenIndonesianNumbers(input: string): string {
  let s = input;

  // Common STT mishearings for "makan"
  s = s.replace(/\b(?:bahkan|makam|makann|mkn)\b/gi, "makan");

  // Pre-normalize common slang / STT number suffixes & brands
  s = s.replace(/\brebu\b/gi, "ribu");
  s = s.replace(/\b(?:kris|chris|keris)\b/gi, "qris");
  s = s.replace(/\bgo\s+pay\b/gi, "gopay");
  s = s.replace(/\bshopee\s+pay\b/gi, "shopeepay");
  s = s.replace(/\bspay\b/gi, "shopeepay");
  s = s.replace(/\bb\s+c\s+a\b/gi, "bca");

  // Multi-word million phrases with fractions:
  s = s.replace(/\b(?:satu|1)\s+setengah\s+juta\b/gi, "1500000");
  s = s.replace(/\bdua\s+setengah\s+juta\b/gi, "2500000");
  s = s.replace(/\btiga\s+setengah\s+juta\b/gi, "3500000");
  s = s.replace(/\bempat\s+setengah\s+juta\b/gi, "4500000");
  s = s.replace(/\blima\s+setengah\s+juta\b/gi, "5500000");
  s = s.replace(/\bsetengah\s+juta\b/gi, "500000");
  s = s.replace(/\b(?:sejuta|satu\s+juta)\s+lima\s+ratus\b/gi, "1500000");
  s = s.replace(/\bdua\s+juta\s+lima\s+ratus\b/gi, "2500000");

  // Decimal / comma millions (e.g. "1.5 juta", "1,5 juta", "2.5 jt", "0.5 juta")
  s = s.replace(/\b(\d+)[.,](\d+)\s*(?:juta|jt)\b/gi, (_, whole, frac) => {
    const val = parseFloat(`${whole}.${frac}`) * 1000000;
    return `${Math.round(val)}`;
  });

  const digits: Record<string, number> = {
    satu: 1,
    dua: 2,
    tiga: 3,
    empat: 4,
    lima: 5,
    enam: 6,
    tujuh: 7,
    delapan: 8,
    sembilan: 9,
  };

  // Spoken fractional millions: e.g. "satu koma lima juta", "dua koma lima juta"
  s = s.replace(
    /\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+koma\s+(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|\d+)\s*(?:juta|jt)\b/gi,
    (_, whole, frac) => {
      const wVal = digits[whole.toLowerCase()] || 0;
      const isWord = digits[frac.toLowerCase()] !== undefined;
      const fVal = digits[frac.toLowerCase()] || parseInt(frac, 10) || 0;
      const fracNum = isWord ? fVal / 10 : fVal / Math.pow(10, frac.length);
      const val = (wVal + fracNum) * 1000000;
      return `${Math.round(val)}`;
    },
  );

  s = s.replace(/\b(?:satu\s+juta|sejuta)\b/gi, "1000000");
  s = s.replace(/\bdua\s+juta\b/gi, "2000000");
  s = s.replace(/\btiga\s+juta\b/gi, "3000000");
  s = s.replace(/\bempat\s+juta\b/gi, "4000000");
  s = s.replace(/\blima\s+juta\b/gi, "5000000");
  s = s.replace(/\benam\s+juta\b/gi, "6000000");
  s = s.replace(/\btujuh\s+juta\b/gi, "7000000");
  s = s.replace(/\bdelapan\s+juta\b/gi, "8000000");
  s = s.replace(/\bsembilan\s+juta\b/gi, "9000000");
  s = s.replace(/\bsepuluh\s+juta\b/gi, "10000000");

  // Ratus ribu phrases: e.g. "seratus lima puluh ribu", "seratus ribu", "dua ratus ribu", "lima ratus ribu"
  s = s.replace(/\bseratus\s+lima\s+puluh\s+ribu\b/gi, "150000");
  s = s.replace(/\bseratus\s+dua\s+puluh\s+ribu\b/gi, "120000");
  s = s.replace(/\bseratus\s+tujuh\s+puluh\s+lima\s+ribu\b/gi, "175000");
  s = s.replace(/\bseratus\s+ribu\b/gi, "100000");
  s = s.replace(
    /\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+ratus\s+lima\s+puluh\s+ribu\b/gi,
    (_, hundreds) => {
      const hVal = digits[hundreds.toLowerCase()] || 0;
      return `${hVal * 100000 + 50000}`;
    },
  );
  s = s.replace(/\bdua\s+ratus\s+ribu\b/gi, "200000");
  s = s.replace(/\btiga\s+ratus\s+ribu\b/gi, "300000");
  s = s.replace(/\bempat\s+ratus\s+ribu\b/gi, "400000");
  s = s.replace(/\blima\s+ratus\s+ribu\b/gi, "500000");
  s = s.replace(/\benam\s+ratus\s+ribu\b/gi, "600000");
  s = s.replace(/\btujuh\s+ratus\s+ribu\b/gi, "700000");
  s = s.replace(/\bdelapan\s+ratus\s+ribu\b/gi, "800000");
  s = s.replace(/\bsembilan\s+ratus\s+ribu\b/gi, "900000");

  // Pattern: "(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan) puluh (satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan) ribu"
  s = s.replace(
    /\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+puluh\s+(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+ribu\b/gi,
    (_, tens, ones) => {
      const tVal = digits[tens.toLowerCase()] || 0;
      const oVal = digits[ones.toLowerCase()] || 0;
      return `${tVal * 10000 + oVal * 1000}`;
    },
  );

  // Pattern: "(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan) puluh ribu"
  s = s.replace(
    /\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+puluh\s+ribu\b/gi,
    (_, tens) => {
      const tVal = digits[tens.toLowerCase()] || 0;
      return `${tVal * 10000}`;
    },
  );

  // Belas ribu phrases: e.g. "sebelas ribu", "dua belas ribu", "lima belas ribu"
  s = s.replace(/\bsebelas\s+ribu\b/gi, "11000");
  s = s.replace(/\bdua\s+belas\s+ribu\b/gi, "12000");
  s = s.replace(/\btiga\s+belas\s+ribu\b/gi, "13000");
  s = s.replace(/\bempat\s+belas\s+ribu\b/gi, "14000");
  s = s.replace(/\blima\s+belas\s+ribu\b/gi, "15000");
  s = s.replace(/\benam\s+belas\s+ribu\b/gi, "16000");
  s = s.replace(/\btujuh\s+belas\s+ribu\b/gi, "17000");
  s = s.replace(/\bdelapan\s+belas\s+ribu\b/gi, "18000");
  s = s.replace(/\bsembilan\s+belas\s+ribu\b/gi, "19000");

  // Sepuluh ribu, seribu
  s = s.replace(/\bsepuluh\s+ribu\b/gi, "10000");
  s = s.replace(/\bseribu\b/gi, "1000");
  s = s.replace(
    /\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+ribu\b/gi,
    (_, ones) => {
      const oVal = digits[ones.toLowerCase()] || 0;
      return `${oVal * 1000}`;
    },
  );

  // Numeric + "ribu" (e.g. "50 ribu" -> "50000", "25 ribu" -> "25000")
  s = s.replace(/\b(\d+)\s+ribu\b/gi, (_, n) => `${n}000`);

  return s;
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  kopi: [
    "kopi",
    "ngopi",
    "coffee",
    "cafe",
    "kafe",
    "starbucks",
    "kopsus",
    "americano",
    "latte",
    "espresso",
    "cappuccino",
    "janji jiwa",
    "kenangan",
    "tuku",
    "point coffee",
    "fore",
    "tomoro",
    "anomali",
    "flash coffee",
  ],
  minuman: [
    "minum",
    "minuman",
    "drink",
    "drinks",
    "beverage",
    "beverages",
    "boba",
    "jus",
    "juice",
    "es teh",
    "aqua",
    "air mineral",
    "teh",
    "chatime",
    "haus",
    "kopi",
    "ngopi",
  ],
  makanan: [
    "makan",
    "makanan",
    "makann",
    "mkn",
    "food",
    "kuliner",
    "f&b",
    "sarapan",
    "lunch",
    "dinner",
    "nasi",
    "padang",
    "bakso",
    "mie",
    "ayam",
    "gofood",
    "grabfood",
    "shopeefood",
    "restoran",
    "resto",
    "warung",
    "warteg",
    "snack",
    "jajan",
    "jajanan",
    "ngemil",
    "cemilan",
    "gorengan",
    "sate",
    "pecel",
    "geprek",
    "seblak",
    "martabak",
    "roti",
    "siomay",
    "batagor",
    "indomie",
    "mcd",
    "mcdonalds",
    "kfc",
    "hokben",
    "burger",
    "pizza",
    "soto",
    "rendang",
    "rawon",
    "kantin",
  ],
  bensin: [
    "bensin",
    "pertalite",
    "pertamax",
    "solar",
    "shell",
    "bbm",
    "spbu",
    "pom bensin",
  ],
  parkir: [
    "parkir",
    "parkiran",
    "valet",
  ],
  transportasi: [
    "transport",
    "transportasi",
    "bensin",
    "pertalite",
    "pertamax",
    "solar",
    "shell",
    "bbm",
    "tol",
    "parkir",
    "gojek",
    "grab",
    "goride",
    "gocar",
    "grabride",
    "grabcar",
    "maxim",
    "ojol",
    "kereta",
    "mrt",
    "krl",
    "lrt",
    "busway",
    "transjakarta",
    "taxi",
    "taksi",
    "angkot",
    "kendaraan",
  ],
  hunian: [
    "hunian",
    "kost",
    "kos",
    "kontrakan",
    "sewa",
    "listrik",
    "pln",
    "air",
    "pdam",
    "wifi",
    "indihome",
    "biznet",
    "myrepublic",
    "firstmedia",
    "ipl",
    "apartemen",
    "gas",
    "lpg",
  ],
  hiburan: [
    "hiburan",
    "nonton",
    "bioskop",
    "xxi",
    "cgv",
    "cinepolis",
    "netflix",
    "spotify",
    "youtube",
    "disney",
    "game",
    "steam",
    "playstation",
    "topup game",
    "diamond",
    "mlbb",
    "genshin",
    "valorant",
    "liburan",
    "karaoke",
    "tiket",
  ],
  kesehatan: [
    "kesehatan",
    "obat",
    "dokter",
    "apotek",
    "klinik",
    "rs",
    "rumah sakit",
    "vitamin",
    "halodoc",
    "alodokter",
    "optik",
    "kacamata",
  ],
  fashion: [
    "fashion",
    "baju",
    "sepatu",
    "celana",
    "kaos",
    "zara",
    "uniqlo",
    "h&m",
    "pakaian",
    "tas",
    "jaket",
    "hoodie",
    "skincare",
  ],
  belanja: [
    "belanja",
    "groceries",
    "supermarket",
    "indomaret",
    "alfamart",
    "alfamidi",
    "superindo",
    "hypermart",
    "shopee",
    "tokopedia",
    "tiktok shop",
    "lazada",
    "sayur",
    "pasar",
    "buah",
  ],
  tagihan: [
    "tagihan",
    "pulsa",
    "kuota",
    "paket data",
    "telkomsel",
    "byu",
    "indosat",
    "xl",
    "tri",
    "smartfren",
    "bpjs",
    "asuransi",
    "pajak",
  ],
  pendidikan: [
    "pendidikan",
    "kursus",
    "buku",
    "kuliah",
    "spp",
    "sekolah",
    "udemy",
    "les",
  ],
  amal: [
    "zakat",
    "infaq",
    "sedekah",
    "donasi",
    "amal",
    "masjid",
    "gereja",
    "kitabisa",
  ],
  gaji: ["gaji", "gajian", "salary", "payroll", "upah", "fee", "uang lembur"],
  bonus: [
    "bonus",
    "thr",
    "insentif",
    "komisi",
    "tips",
    "cashback",
    "dividen",
    "bunga",
    "hadiah",
    "angpao",
    "uang saku",
    "dapet duit",
    "dapat duit",
    "dapet uang",
    "dapat uang",
    "dikasih",
    "refund",
    "pengembalian",
  ],
  penjualan: [
    "hasil jualan",
    "jualan",
    "penjualan",
    "omzet",
    "omset",
    "dagang",
    "laba",
  ],
};

function parseWordMultiplier(word?: string): number {
  if (!word) return 1;
  const clean = word.trim().toLowerCase();
  if (/^\d+$/.test(clean)) return parseInt(clean, 10);
  switch (clean) {
    case "se":
    case "satu":
    case "1":
      return 1;
    case "dua":
    case "2":
      return 2;
    case "tiga":
    case "3":
      return 3;
    case "empat":
    case "4":
      return 4;
    case "lima":
    case "5":
      return 5;
    default:
      return 1;
  }
}

const INDONESIAN_SLANG_AMOUNTS: Array<{
  pattern: RegExp;
  baseValue: number;
  tokenName: string;
}> = [
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(setengah\s+juta|setengah\s+jt)\b/i,
    baseValue: 500000,
    tokenName: "setengah juta",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(gopek\s+ceng|gopek\s+ribu)\b/i,
    baseValue: 500000,
    tokenName: "gopek ceng",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(cepek\s+ceng|cepek\s+ribu)\b/i,
    baseValue: 100000,
    tokenName: "cepek ceng",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(pego(?:an)?(?:\s+ceng|\s+ribu)?)\b/i,
    baseValue: 150000,
    tokenName: "pego",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(sejutaan|sejuta|satu\s+juta)\b/i,
    baseValue: 1000000,
    tokenName: "sejuta",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(nopek(?:an)?)\b/i,
    baseValue: 200000,
    tokenName: "nopek",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(gocap(?:an)?|goban(?:an)?)\b/i,
    baseValue: 50000,
    tokenName: "gocap",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(nocap|noban(?:an)?)\b/i,
    baseValue: 20000,
    tokenName: "nocap",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(ceban(?:an)?|seceban)\b/i,
    baseValue: 10000,
    tokenName: "ceban",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(goceng(?:an)?)\b/i,
    baseValue: 5000,
    tokenName: "goceng",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(noceng)\b/i,
    baseValue: 2000,
    tokenName: "noceng",
  },
  {
    pattern: /\b(?:(\d+|se|satu|dua|tiga|empat|lima)\s+)?(seceng(?:an)?)\b/i,
    baseValue: 1000,
    tokenName: "seceng",
  },
  {
    pattern: /\b(cepek)\b/i,
    baseValue: 100000,
    tokenName: "cepek",
  },
];

export function parseNaturalTransaction(
  input: string,
  categories: Category[] = [],
  wallets: Wallet[] = [],
  referenceDate = new Date(),
): ParsedTransactionResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      amount: null,
      amountFormatted: null,
      type: "expense",
      categoryId: null,
      categoryName: null,
      walletId: null,
      walletName: null,
      toWalletId: null,
      toWalletName: null,
      date: referenceDate,
      dateLabel: "Today",
      note: "",
      rawInput: input,
      confidence: 0,
      matchedTokens: {},
    };
  }

  let text = trimmed.toLowerCase();
  const matchedTokens: ParsedTransactionResult["matchedTokens"] = {};
  let confidence = 0;

  // 0. Pre-clean STT artifacts: spoken Indonesian numbers, trailing periods on numbers, phonetic cash, and STT mishearings
  text = normalizeSpokenIndonesianNumbers(text);
  text = text.replace(/(\d{1,3}(?:\.\d{3})+)\./g, "$1");
  text = text.replace(/\bbahkan\b/gi, "makan");

  const hasCashWallet = wallets.some((w) => {
    const n = w.name.toLowerCase();
    return n.includes("cash") || n.includes("tunai");
  });

  if (hasCashWallet) {
    text = text
      .replace(/\b(?:pake|pakai|lewat|dari|di|bayar)\s+(?:gas|kes|ces|kas|kesh)\b/gi, " cash ")
      .replace(/(?<=\d[\d.,]*\s*(?:[.,]\s*)?)(gas|kes|ces|kas|kesh)\b/gi, " cash ")
      .replace(/[.\s]+(gas|kes|ces|kas|kesh)$/gi, " cash");
  }

  // 1. Transaction Type & Transfer Route Detection
  let detectedType: TransactionType = "expense";
  let fromWalletId: string | null = null;
  let fromWalletName: string | null = null;
  let toWalletId: string | null = null;
  let toWalletName: string | null = null;

  // Helper to locate cash/tunai wallet
  const findCashWallet = () => {
    return (
      wallets.find((w) => {
        const n = w.name.toLowerCase();
        return (
          n === "cash" ||
          n === "tunai" ||
          n === "dompet" ||
          n === "kas" ||
          n.includes("cash") ||
          n.includes("tunai")
        );
      }) ||
      wallets.find((w) => !w.name.toLowerCase().includes("bank")) ||
      wallets[0]
    );
  };

  // Helper to locate specific bank or non-cash wallet mentioned in text
  const findMentionedBankWallet = () => {
    return wallets.find((w) => {
      const n = w.name.toLowerCase();
      if (n.includes("cash") || n.includes("tunai") || n === "dompet" || n === "kas") {
        return false;
      }
      return text.includes(n);
    });
  };

  // A. Tarik Tunai (Bank -> Cash withdrawal)
  const withdrawalMatch = text.match(
    /\b(?:tarik\s+tunai|penarikan\s+tunai|tarik\s+kas|tarik\s+uang|ambil\s+uang(?:\s+di\s+atm|\s+dari\s+atm)?|tarik\s+cash|ambil\s+cash|cash\s+withdrawal|withdraw\s+cash|withdraw|withdrawal)\b/i,
  );

  // B. Setor Tunai (Cash -> Bank deposit)
  const depositMatch = text.match(
    /\b(?:setor\s+tunai|setor\s+uang|nabung\s+cash|setor\s+cash|deposit\s+tunai|cash\s+deposit|deposit\s+cash)\b/i,
  );

  // C. Transfer or E-Wallet Top-up keywords
  const isTransferKeyword = /\b(transfer|pindah|kirim|tf|send|move)\b/i.test(text);
  const isNotFuelOrCommodityRefill = !/\bisi\s+(?:bensin|solar|pertamax|pertalite|bbm|angin|gas|lpg|air|pulsa|paket|kuota)\b/i.test(text);
  const isTopUpKeyword =
    /\b(top\s*up|topup|isi\s*saldo|reload)\b/i.test(text) ||
    (/\bisi\b/i.test(text) &&
      isNotFuelOrCommodityRefill &&
      /(?:top\s*up|topup|isi\s*(?:saldo)?|reload)\s+(\w+)(?:.*?)(?:dari|pake|pakai|lewat|from|via|using)\s+(\w+)/i.test(text));

  if (withdrawalMatch) {
    detectedType = "transfer";
    confidence += 0.35;
    text = text.replace(withdrawalMatch[0], " ").trim();

    const bankWallet = findMentionedBankWallet();
    const cashWallet = findCashWallet();

    if (bankWallet) {
      fromWalletId = bankWallet.id;
      fromWalletName = bankWallet.name;
      matchedTokens.walletToken = bankWallet.name;
      text = text.replace(new RegExp(`\\b${bankWallet.name}\\b`, "i"), " ");
    }
    if (cashWallet) {
      toWalletId = cashWallet.id;
      toWalletName = cashWallet.name;
      matchedTokens.toWalletToken = cashWallet.name;
      text = text.replace(new RegExp(`\\b${cashWallet.name}\\b`, "i"), " ");
    }
  } else if (depositMatch) {
    detectedType = "transfer";
    confidence += 0.35;
    text = text.replace(depositMatch[0], " ").trim();

    const cashWallet = findCashWallet();
    const bankWallet = findMentionedBankWallet();

    if (cashWallet) {
      fromWalletId = cashWallet.id;
      fromWalletName = cashWallet.name;
      matchedTokens.walletToken = cashWallet.name;
      text = text.replace(new RegExp(`\\b${cashWallet.name}\\b`, "i"), " ");
    }
    if (bankWallet) {
      toWalletId = bankWallet.id;
      toWalletName = bankWallet.name;
      matchedTokens.toWalletToken = bankWallet.name;
      text = text.replace(new RegExp(`\\b${bankWallet.name}\\b`, "i"), " ");
    }
  } else if (isTransferKeyword || isTopUpKeyword) {
    detectedType = "transfer";
    confidence += 0.3;

    // Pattern A: "top up gopay 100k dari bca", "topup dana pake bca", "reload ovo from bca"
    const topUpRouteMatch = text.match(
      /(?:top\s*up|topup|isi\s*(?:saldo)?|reload)\s+(\w+)(?:.*?)(?:dari|pake|pakai|lewat|from|via|using)\s+(\w+)/i,
    );

    // Pattern B: "dari X ke Y", "from X to Y", or "X ke Y" / "X to Y"
    const standardRouteMatch = text.match(/(?:(?:dari|from)\s+)?(\w+)\s+(?:ke|to)\s+(\w+)/i);

    if (topUpRouteMatch) {
      const targetStr = topUpRouteMatch[1].toLowerCase();
      const sourceStr = topUpRouteMatch[2].toLowerCase();

      const matchedFrom = wallets.find((w) =>
        w.name.toLowerCase().includes(sourceStr),
      );
      const matchedTo = wallets.find((w) =>
        w.name.toLowerCase().includes(targetStr),
      );

      if (matchedFrom) {
        fromWalletId = matchedFrom.id;
        fromWalletName = matchedFrom.name;
        matchedTokens.walletToken = matchedFrom.name;
      }
      if (matchedTo) {
        toWalletId = matchedTo.id;
        toWalletName = matchedTo.name;
        matchedTokens.toWalletToken = matchedTo.name;
      }
    } else if (standardRouteMatch) {
      const fromStr = standardRouteMatch[1].toLowerCase();
      const toStr = standardRouteMatch[2].toLowerCase();
      const isFromAmountLike = /^\d+(?:[kK]|rb|ribu|jt|juta|m|mio|million)?$/i.test(fromStr);

      const matchedFrom = !isFromAmountLike
        ? wallets.find((w) => w.name.toLowerCase().includes(fromStr))
        : undefined;
      const matchedTo = wallets.find((w) =>
        w.name.toLowerCase().includes(toStr),
      );

      if (matchedFrom) {
        fromWalletId = matchedFrom.id;
        fromWalletName = matchedFrom.name;
        matchedTokens.walletToken = matchedFrom.name;
      }
      if (matchedTo) {
        toWalletId = matchedTo.id;
        toWalletName = matchedTo.name;
        matchedTokens.toWalletToken = matchedTo.name;
      }

      if (matchedFrom && matchedTo) {
        text = text.replace(standardRouteMatch[0], " ").trim();
      } else if (matchedTo) {
        text = text.replace(new RegExp(`(?:ke|to)\\s+${toStr}`, "i"), " ").trim();
      }
    }

    text = text
      .replace(/\b(transfer|pindah|kirim|tf|send|move|top\s*up|topup|isi\s*saldo|isi|reload)\b/gi, " ")
      .trim();
  } else if (
    /\b(?:gaji|gajian|salary|income|bonus|komisi|terima(?:\s+transferan)?|dapat\s+transferan|dapet\s+transferan|cair(?:\s+dividen)?|dividen|hadiah|angpao|thr|uang\s+saku|dapat\s+duit|dapet\s+duit|dapat\s+uang|dapet\s+uang|dikasih(?:\s+uang)?|hasil\s+jualan|penjualan|omzet|omset|cashback|refund|pengembalian|upah|fee|royalti)\b/i.test(
      text,
    )
  ) {
    detectedType = "income";
    confidence += 0.25;
  }

  // 2. Amount Extraction
  let detectedAmount: number | null = null;
  let amountStr = "";

  // Millions pattern: "1.5jt", "15juta", "15jt", "1.5m", "10mio"
  const millionsMatch = text.match(/(?:rp\.?|idr)?\s*(\d+(?:[.,]\d+)?)\s*(?:jt|juta|mio|m)\b/i);
  if (millionsMatch) {
    const rawVal = parseFloat(millionsMatch[1].replace(",", "."));
    if (!isNaN(rawVal)) {
      detectedAmount = Math.round(rawVal * 1000000);
      amountStr = millionsMatch[0];
      matchedTokens.amountToken = amountStr.trim();
      confidence += 0.35;
      text = text.replace(millionsMatch[0], " ");
    }
  }

  // Thousands pattern: "35rb", "45k", "150ribu"
  if (detectedAmount === null) {
    const thousandsMatch = text.match(/(?:rp\.?|idr)?\s*(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
    if (thousandsMatch) {
      const rawVal = parseFloat(thousandsMatch[1].replace(",", "."));
      if (!isNaN(rawVal)) {
        detectedAmount = Math.round(rawVal * 1000);
        amountStr = thousandsMatch[0];
        matchedTokens.amountToken = amountStr.trim();
        confidence += 0.35;
        text = text.replace(thousandsMatch[0], " ");
      }
    }
  }

  // Slang numbers: "gocap", "ceban", "2 goceng", "setengah juta", "cepek ceng", etc.
  if (detectedAmount === null) {
    for (const slang of INDONESIAN_SLANG_AMOUNTS) {
      const slangMatch = text.match(slang.pattern);
      if (slangMatch) {
        const mult = parseWordMultiplier(slangMatch[1]);
        detectedAmount = mult * slang.baseValue;
        amountStr = slangMatch[0];
        matchedTokens.amountToken = amountStr.trim();
        confidence += 0.35;
        text = text.replace(slangMatch[0], " ");
        break;
      }
    }
  }

  // Indonesian dotted numbers: "Rp 35.000", "50.000"
  if (detectedAmount === null) {
    const dottedMatch = text.match(/(?:rp\.?|idr)?\s*(\d{1,3}(?:\.\d{3})+)\b/i);
    if (dottedMatch) {
      const cleanDigits = dottedMatch[1].replace(/\./g, "");
      detectedAmount = Number(cleanDigits) || null;
      if (detectedAmount !== null) {
        amountStr = dottedMatch[0];
        matchedTokens.amountToken = amountStr.trim();
        confidence += 0.35;
        text = text.replace(dottedMatch[0], " ");
      }
    }
  }

  // Plain integers (>= 100)
  if (detectedAmount === null) {
    const rawNumMatch = text.match(/(?:rp\.?|idr)?\s*(\d{3,})\b/i);
    if (rawNumMatch) {
      const val = parseInt(rawNumMatch[1], 10);
      if (!isNaN(val) && val >= 100) {
        detectedAmount = val;
        amountStr = rawNumMatch[0];
        matchedTokens.amountToken = amountStr.trim();
        confidence += 0.3;
        text = text.replace(rawNumMatch[0], " ");
      }
    }
  }

  // 3. Relative Date Extraction
  let detectedDate: Date = referenceDate;
  let dateLabel = "Today";

  if (/\b(kemarin|yesterday)\b/i.test(text)) {
    detectedDate = subDays(referenceDate, 1);
    dateLabel = "Yesterday";
    matchedTokens.dateToken = "Yesterday";
    confidence += 0.15;
    text = text.replace(/\b(kemarin|yesterday)\b/i, " ");
  } else if (/\b(\d+)\s*(?:hari|days?)\s*(?:lalu|ago)\b/i.test(text)) {
    const daysAgoMatch = text.match(/\b(\d+)\s*(?:hari|days?)\s*(?:lalu|ago)\b/i);
    if (daysAgoMatch) {
      const numDays = parseInt(daysAgoMatch[1], 10);
      detectedDate = subDays(referenceDate, numDays);
      dateLabel = `${numDays}d ago`;
      matchedTokens.dateToken = dateLabel;
      confidence += 0.15;
      text = text.replace(daysAgoMatch[0], " ");
    }
  } else if (/\b(hari ini|today)\b/i.test(text)) {
    detectedDate = referenceDate;
    dateLabel = "Today";
    matchedTokens.dateToken = "Today";
    text = text.replace(/\b(hari ini|today)\b/i, " ");
  }

  // 4. Wallet Matching (if not transfer or if fromWallet not resolved yet)
  if (detectedType !== "transfer" || !fromWalletId) {
    // Sort wallets by length descending so "kartu kredit" matches before "kartu"
    const sortedWallets = [...wallets].sort((a, b) => b.name.length - a.name.length);
    for (const w of sortedWallets) {
      const wName = w.name.toLowerCase();
      // Match exact word boundary
      const wRegex = new RegExp(`\\b${wName}\\b`, "i");
      if (wRegex.test(text)) {
        fromWalletId = w.id;
        fromWalletName = w.name;
        matchedTokens.walletToken = w.name;
        confidence += 0.2;
        text = text.replace(wRegex, " ");
        break;
      }
    }

    // Check alias "tunai" or phonetic cash "gas"/"kes" -> matches "cash" or "tunai"
    if (!fromWalletId && /\b(tunai|cash|gas|kes|ces|kas|kesh|kontan)\b/i.test(text)) {
      const cashWallet = wallets.find((w) => {
        const n = w.name.toLowerCase();
        return n.includes("cash") || n.includes("tunai");
      });
      if (cashWallet) {
        fromWalletId = cashWallet.id;
        fromWalletName = cashWallet.name;
        matchedTokens.walletToken = cashWallet.name;
        confidence += 0.2;
        text = text.replace(/\b(tunai|cash|gas|kes|ces|kas|kesh|kontan)\b/i, " ");
      }
    }
  }

  // 5. Category Matching
  let detectedCategoryId: string | null = null;
  let detectedCategoryName: string | null = null;
  let detectedCategoryEmoji: string | undefined;

  // Filter categories by detected transaction type
  const targetCategories = categories.filter(
    (c) => c.type === detectedType || detectedType === "transfer",
  );

  // A. Direct match against category names
  for (const cat of targetCategories) {
    const cName = cat.name.toLowerCase();
    const cRegex = new RegExp(`\\b${cName}\\b`, "i");
    if (cRegex.test(text)) {
      detectedCategoryId = cat.id;
      detectedCategoryName = cat.name;
      detectedCategoryEmoji = cat.emoji;
      matchedTokens.categoryToken = cat.name;
      confidence += 0.25;
      text = text.replace(cRegex, " ");
      break;
    }
  }

  // B. Indonesian Morphological Stem & Root Matcher (e.g. "makan" -> "Makanan", "minum" -> "Minuman", "ngopi" -> "Kopi")
  if (!detectedCategoryId) {
    const textWords = text.split(/[\s,.;]+/).filter(Boolean);
    for (const w of textWords) {
      const stem = stemIndonesianCategoryWord(w);
      if (!stem || stem.length < 3) continue;

      // Find matching category by stem, prefix, or canonical concept
      const matchedCat = targetCategories.find((cat) => {
        const catLower = cat.name.toLowerCase();
        const catStem = stemIndonesianCategoryWord(cat.name);
        return (
          catStem === stem ||
          catLower.startsWith(stem) ||
          catLower === stem ||
          (stem === "makan" && (catLower.includes("makan") || catLower.includes("food") || catLower.includes("kuliner") || catLower.includes("f&b"))) ||
          (stem === "minum" && (catLower.includes("minum") || catLower.includes("drink") || catLower.includes("beverage"))) ||
          (stem === "kopi" && (catLower.includes("kopi") || catLower.includes("coffee") || catLower.includes("cafe"))) ||
          (stem === "bensin" && (catLower.includes("bensin") || catLower.includes("transport") || catLower.includes("bbm"))) ||
          (stem === "gaji" && (catLower.includes("gaji") || catLower.includes("salary") || catLower.includes("income")))
        );
      });

      if (matchedCat) {
        detectedCategoryId = matchedCat.id;
        detectedCategoryName = matchedCat.name;
        detectedCategoryEmoji = matchedCat.emoji;
        matchedTokens.categoryToken = matchedCat.name;
        confidence += 0.35;
        text = text.replace(new RegExp(`\\b${w}\\b`, "i"), " ");
        break;
      }
    }
  }

  // C. Unified Semantic Taxonomy Engine (25+ Concepts, 600+ keywords, colloquial food & items)
  if (!detectedCategoryId) {
    const semanticResult = classifySemanticCategory(
      text,
      targetCategories.length > 0 ? targetCategories : categories,
    );
    if (semanticResult.category) {
      detectedCategoryId = semanticResult.category.id;
      detectedCategoryName = semanticResult.category.name;
      detectedCategoryEmoji = semanticResult.category.emoji;
      matchedTokens.categoryToken = semanticResult.matchedKeyword || semanticResult.category.name;
      confidence += Math.max(0.25, semanticResult.confidence * 0.4);
      if (semanticResult.matchedKeyword) {
        text = text.replace(new RegExp(`\\b${semanticResult.matchedKeyword}\\b`, "i"), " ");
      }
    }
  }

  // D. Legacy alias matching fallback
  if (!detectedCategoryId) {
    for (const [canonKey, aliasList] of Object.entries(CATEGORY_ALIASES)) {
      const foundAlias = aliasList.find((alias) =>
        new RegExp(`\\b${alias}\\b`, "i").test(text),
      );
      if (foundAlias) {
        // Find best matching category in user's categories
        const matchedCategory =
          targetCategories.find((c) => {
            const n = c.name.toLowerCase();
            return (
              n === canonKey ||
              n.includes(canonKey) ||
              canonKey.includes(n) ||
              aliasList.some((a) => n.includes(a)) ||
              (canonKey === "makanan" && (n.includes("food") || n.includes("kuliner") || n.includes("f&b"))) ||
              (canonKey === "minuman" && (n.includes("drink") || n.includes("beverage") || n.includes("makan") || n.includes("minum"))) ||
              (canonKey === "kopi" && (n.includes("coffee") || n.includes("cafe") || n.includes("makan") || n.includes("minum"))) ||
              (canonKey === "bensin" && (n.includes("transport") || n.includes("bbm") || n.includes("kendaraan")))
            );
          }) ||
          categories.find((c) => {
            const n = c.name.toLowerCase();
            return (
              n === canonKey ||
              n.includes(canonKey) ||
              canonKey.includes(n) ||
              aliasList.some((a) => n.includes(a))
            );
          });

        if (matchedCategory) {
          detectedCategoryId = matchedCategory.id;
          detectedCategoryName = matchedCategory.name;
          detectedCategoryEmoji = matchedCategory.emoji;
          matchedTokens.categoryToken = matchedCategory.name;
          confidence += 0.25;
          text = text.replace(new RegExp(`\\b${foundAlias}\\b`, "i"), " ");
          break;
        }
      }
    }
  }

  // 6. Clean Note / Residual Text
  // Remove filler words and strip stray periods/commas left over by speech recognition
  let cleanNote = text
    .replace(/\b(dari|ke|di|beli|bayar|untuk|buat|at|in|for|pada|from|to|by|via)\b/gi, " ")
    .replace(/[.,;:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If transaction is transfer, category shouldn't be assigned
  if (detectedType === "transfer") {
    detectedCategoryId = null;
    detectedCategoryName = null;
    detectedCategoryEmoji = undefined;
    matchedTokens.categoryToken = undefined;
    const isCleanNoteWalletName =
      (fromWalletName && cleanNote.toLowerCase() === fromWalletName.toLowerCase()) ||
      (toWalletName && cleanNote.toLowerCase() === toWalletName.toLowerCase());

    if (!cleanNote || /^[.\s,;:-]+$/.test(cleanNote) || isCleanNoteWalletName) {
      if (withdrawalMatch) {
        const isEnglishWithdrawal = /\b(?:cash\s+withdrawal|withdraw\s+cash|withdraw|withdrawal)\b/i.test(withdrawalMatch[0]);
        cleanNote = isEnglishWithdrawal ? "Cash Withdrawal" : "Tarik Tunai";
      } else if (depositMatch) {
        const isEnglishDeposit = /\b(?:cash\s+deposit|deposit\s+cash)\b/i.test(depositMatch[0]);
        cleanNote = isEnglishDeposit ? "Cash Deposit" : "Setor Tunai";
      } else {
        cleanNote = "Transfer";
      }
    } else {
      cleanNote = cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
    }
  } else if ((!cleanNote || /^[.\s,;:-]+$/.test(cleanNote)) && detectedCategoryName) {
    cleanNote = detectedCategoryName;
  } else if (cleanNote) {
    // Capitalize first letter
    cleanNote = cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
  }

  return {
    amount: detectedAmount,
    amountFormatted: detectedAmount !== null ? formatRupiah(detectedAmount) : null,
    type: detectedType,
    categoryId: detectedCategoryId,
    categoryName: detectedCategoryName,
    categoryEmoji: detectedCategoryEmoji,
    walletId: fromWalletId,
    walletName: fromWalletName,
    toWalletId,
    toWalletName,
    date: detectedDate,
    dateLabel,
    note: cleanNote,
    rawInput: input,
    confidence: Math.min(1, Math.round(confidence * 100) / 100),
    matchedTokens,
  };
}

const AMOUNT_DETECTION_REGEX =
  /(?:\d+(?:[.,]\d+)?\s*(?:jt|juta|mio|m|rb|ribu|k)\b|\d{1,3}(?:\.\d{3})+|\b\d{3,}\b|\b(?:gocap|nocap|ceban|goceng|seceng|cepek|seceban|pego|gopek|setengah\s+juta|sejutaan|sejuta)\b)/i;

export function splitSegmentByAmounts(
  segment: string,
  wallets: Wallet[] = [],
): string[] {
  const amountRegex = new RegExp(AMOUNT_DETECTION_REGEX.source, "gi");
  const matches: Array<{ match: string; index: number; length: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = amountRegex.exec(segment)) !== null) {
    matches.push({ match: m[0], index: m.index, length: m[0].length });
  }

  if (matches.length <= 1) {
    return [segment];
  }

  const walletKeywords = new Set([
    "cash",
    "tunai",
    "gas",
    "kes",
    "ces",
    "kas",
    "kesh",
    "kontan",
    "bca",
    "mandiri",
    "bri",
    "bni",
    "jago",
    "gopay",
    "ovo",
    "dana",
    "shopeepay",
    "seabank",
    "jenius",
    "kartu",
    "kredit",
    "debit",
    "pake",
    "pakai",
    "lewat",
    "dari",
    "ke",
  ]);

  for (const w of wallets) {
    w.name
      .toLowerCase()
      .split(/\s+/)
      .forEach((part) => {
        if (part.length > 1) walletKeywords.add(part);
      });
  }

  const dateKeywords = new Set([
    "kemarin",
    "semalam",
    "tadi",
    "siang",
    "pagi",
    "sore",
    "malam",
    "hari",
    "ini",
  ]);

  const clauses: string[] = [];
  let currentStart = 0;

  for (let i = 0; i < matches.length - 1; i++) {
    const currMatch = matches[i];
    const nextMatch = matches[i + 1];

    const afterCurrAmount = currMatch.index + currMatch.length;
    const beforeNextAmount = nextMatch.index;
    const interText = segment.slice(afterCurrAmount, beforeNextAmount);

    const wordRegex = /\S+/g;
    const words: Array<{ word: string; start: number; end: number }> = [];
    let wm: RegExpExecArray | null;
    while ((wm = wordRegex.exec(interText)) !== null) {
      words.push({
        word: wm[0],
        start: wm.index,
        end: wm.index + wm[0].length,
      });
    }

    let splitOffset = 0;
    let foundBoundary = false;

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const w = words[wIdx];
      const cleanWord = w.word.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (walletKeywords.has(cleanWord) || dateKeywords.has(cleanWord)) {
        splitOffset = w.end;
      } else {
        splitOffset = w.start;
        foundBoundary = true;
        break;
      }
    }

    if (!foundBoundary && words.length > 0) {
      splitOffset = words[words.length - 1].end;
    }

    const cutIndex = afterCurrAmount + splitOffset;
    let rawClause = segment.slice(currentStart, cutIndex).trim();
    rawClause = rawClause
      .replace(/^(?:dan|sama|juga|serta|plus|lalu|terus)\s+/i, "")
      .replace(/[\s,.;]+$/, "")
      .trim();
    if (rawClause) {
      clauses.push(rawClause);
    }
    currentStart = cutIndex;
  }

  let finalClause = segment.slice(currentStart).trim();
  finalClause = finalClause
    .replace(/^(?:dan|sama|juga|serta|plus|lalu|terus)\s+/i, "")
    .replace(/[\s,.;]+$/, "")
    .trim();
  if (finalClause) {
    clauses.push(finalClause);
  }

  return clauses.length > 0 ? clauses : [segment];
}

export function splitIntoClauses(
  input: string,
  wallets: Wallet[] = [],
): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // 0. Pre-normalize spoken numbers (e.g. "lima puluh ribu" -> "50000")
  const preprocessed = normalizeSpokenIndonesianNumbers(trimmed);

  // 1. Normalize sequential conjunctions & line breaks into delimiter " ||| "
  const normalized = preprocessed
    .replace(/[\n;]+/g, " ||| ")
    .replace(/\b(?:habis\s+itu|setelah\s+itu|abis\s+itu)\b/gi, " ||| ")
    .replace(/\b(?:terus|lalu|kemudian|sekalian)\b/gi, " ||| ")
    .replace(/\s*,\s*(?=(?:dan|sama|terus|lalu|kemudian|abis|habis|\d|kopi|ngopi|makan|minum|bensin|beli|bayar|transfer|topup|gaji))/gi, " ||| ")
    .replace(/\s+\b(?:dan|sama|plus)\s+(?=(?:kopi|ngopi|makan|minum|bensin|beli|bayar|transfer|topup|gaji|\d))/gi, " ||| ");

  const rawSegments = normalized
    .split("|||")
    .map((s) => s.trim())
    .filter(Boolean);

  const finalClauses: string[] = [];
  for (const seg of rawSegments) {
    const subClauses = splitSegmentByAmounts(seg, wallets);
    finalClauses.push(...subClauses);
  }

  return finalClauses
    .map((c) => c.replace(/^(?:dan|sama|plus|lalu|terus)\s+/i, "").trim())
    .filter((c) => c.length > 0);
}

export function parseMultiNaturalTransactions(
  input: string,
  categories: Category[] = [],
  wallets: Wallet[] = [],
  referenceDate = new Date(),
): ParsedTransactionResult[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [parseNaturalTransaction("", categories, wallets, referenceDate)];
  }

  const clauses = splitIntoClauses(trimmed, wallets);
  if (clauses.length <= 1) {
    return [parseNaturalTransaction(trimmed, categories, wallets, referenceDate)];
  }

  // Parse each clause individually
  const parsedItems = clauses.map((clause) =>
    parseNaturalTransaction(clause, categories, wallets, referenceDate),
  );

  // Filter items that successfully resolved an amount
  const validItems = parsedItems.filter(
    (item) => item.amount !== null && item.amount > 0,
  );

  // If fewer than 2 valid items were detected, fallback to single parse of full input
  if (validItems.length < 2) {
    return [parseNaturalTransaction(trimmed, categories, wallets, referenceDate)];
  }

  // Context Inheritance across detected transactions:
  // 1. Date inheritance: if one clause specified a date (e.g. "yesterday"), propagate to others without explicit date
  const explicitDateItem = validItems.find(
    (it) => it.matchedTokens.dateToken && it.dateLabel !== "Today",
  );
  if (explicitDateItem) {
    for (const it of validItems) {
      if (!it.matchedTokens.dateToken || it.dateLabel === "Today") {
        it.date = explicitDateItem.date;
        it.dateLabel = explicitDateItem.dateLabel;
        it.matchedTokens.dateToken = explicitDateItem.matchedTokens.dateToken;
      }
    }
  }

  // 2. Wallet inheritance: if only one specific wallet was mentioned across the input,
  // or all mentioned wallets are identical, propagate to other clauses that didn't mention a wallet
  const itemsWithWallet = validItems.filter((it) => it.walletId !== null);
  if (itemsWithWallet.length > 0) {
    const uniqueWalletIds = Array.from(
      new Set(itemsWithWallet.map((it) => it.walletId)),
    );
    if (uniqueWalletIds.length === 1) {
      const primaryWallet = itemsWithWallet[0];
      for (const it of validItems) {
        if (!it.walletId) {
          it.walletId = primaryWallet.walletId;
          it.walletName = primaryWallet.walletName;
          it.matchedTokens.walletToken = primaryWallet.matchedTokens.walletToken;
          it.confidence = Math.min(1, it.confidence + 0.15);
        }
      }
    }
  }

  return validItems;
}

