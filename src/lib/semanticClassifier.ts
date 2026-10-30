// ======================================================================
// TROUVAILLE UNIFIED SEMANTIC TAXONOMY ENGINE
// Deterministic, zero-latency, on-device semantic classifier for
// Indonesian & English financial vocabulary, food items, transit, & merchants.
// ======================================================================

import type { Category } from "./types";

export type SemanticConceptId =
  | "FOOD_DINING"
  | "COFFEE_BEVERAGE"
  | "GROCERIES"
  | "TRANSPORTATION"
  | "BILLS_UTILITIES"
  | "COMMUNICATION_DATA"
  | "HEALTH_MEDICAL"
  | "ENTERTAINMENT_SUBSCRIPTIONS"
  | "SHOPPING_CLOTHING"
  | "ONLINE_SHOPPING"
  | "PERSONAL_CARE"
  | "EDUCATION"
  | "HOUSING_LODGING"
  | "DONATION_CHARITY"
  | "PETS"
  | "INVESTMENT_SAVINGS"
  | "SALARY_INCOME"
  | "TRANSFER_FINANCE";

interface ConceptDefinition {
  id: SemanticConceptId;
  canonicalCategoryNames: { id: string[]; en: string[] };
  categoryNameKeywords: string[];
  keywords: string[];
}

export const CONCEPT_TAXONOMY: Record<SemanticConceptId, ConceptDefinition> = {
  FOOD_DINING: {
    id: "FOOD_DINING",
    canonicalCategoryNames: {
      id: ["makanan", "makanan & minuman", "kuliner", "konsumsi", "makan", "f&b", "pangan"],
      en: ["food", "food & drink", "dining", "restaurant", "meals", "groceries & food"],
    },
    categoryNameKeywords: [
      "makan", "food", "kuliner", "resto", "restoran", "f&b", "dining", "meal", "konsumsi", "pangan", "jajan", "snack"
    ],
    keywords: [
      "bakso", "baso", "soto", "sate", "mie", "bakmi", "ayam", "bebek", "padang", "nasi",
      "warung", "warkop", "wartel", "gacoan", "mcd", "mcdonald", "mcdonalds", "kfc", "burger",
      "pizza", "steak", "martabak", "pecel", "rendang", "geprek", "dimsum", "ramen", "sushi",
      "udang", "cumi", "ikan", "lalapan", "rawon", "seblak", "batagor", "siomay", "gorengan",
      "ketoprak", "bubur", "lontong", "kupat", "pempek", "kwetiau", "bihun", "rotiboy",
      "roti", "baker", "bread", "salad", "sandwich", "hokben", "solaria", "marugame", "dcost",
      "ta wan", "subway", "wingstop", "richeese", "krisbar", "lunch", "dinner", "breakfast",
      "sarapan", "maksi", "ngemil", "cemilan", "snack", "gofood", "grabfood", "shopeefood",
      "dapur", "resto", "restoran", "chick", "wings", "tahu walik", "french fries", "odeng",
      "chikuwa", "kitamura", "shabu", "katsu", "bento", "teriyaki", "yoshinoya", "sukiya",
      "steak", "daging", "iga", "buntut", "sop", "nasi uduk", "nasi kuning", "nasi goreng",
      "nasgor", "migor", "mie ayam", "pangsit", "bakpao", "mpek", "pempek"
    ],
  },

  COFFEE_BEVERAGE: {
    id: "COFFEE_BEVERAGE",
    canonicalCategoryNames: {
      id: ["kopi", "minuman", "kafe", "minuman & kopi"],
      en: ["coffee", "drinks", "beverages", "cafe", "coffee & tea"],
    },
    categoryNameKeywords: ["kopi", "coffee", "cafe", "kafe", "minuman", "drink", "beverage", "tea", "teh"],
    keywords: [
      "kopi", "coffee", "kafe", "cafe", "latte", "espresso", "cappuccino", "americano",
      "ngopi", "kopsus", "boba", "chatime", "haus", "teguk", "janji jiwa", "kenangan",
      "kopikenangan", "starbucks", "sbux", "fore", "tomoro", "kulo", "point coffee", "anomali",
      "tanamera", "tea", "teh", "jus", "juice", "es teh", "esteh", "matcha", "kombucha",
      "gelato", "ice cream", "mixue", "chatime", "koi", "gong cha", "hop hop", "dum dum",
      "minuman", "boba", "smoothie", "milkshake"
    ],
  },

  GROCERIES: {
    id: "GROCERIES",
    canonicalCategoryNames: {
      id: ["belanja", "kebutuhan pokok", "sembako", "supermarket", "minimarket", "groceries"],
      en: ["groceries", "supermarket", "household", "essentials", "supplies"],
    },
    categoryNameKeywords: ["belanja", "groceries", "sembako", "supermarket", "minimarket", "pasar", "kebutuhan"],
    keywords: [
      "indomaret", "alfamart", "alfamidi", "superindo", "hypermart", "transmart",
      "grand lucky", "hero", "farmers market", "lotte", "lottemart", "sembako", "beras",
      "minyak", "minyak goreng", "gula", "telur", "telor", "sabun", "odol", "shampoo",
      "detergen", "rinso", "sunlight", "molto", "pelembut", "pewangi", "sikat gigi",
      "tisu", "tissue", "pampers", "popok", "pasar", "sayur", "sayuran", "buah",
      "buah buahan", "bumbu", "bawang", "cabai", "cabe", "daging ayam", "daging sapi",
      "dettol", "biore", "lifebuoy", "clear", "pantene", "pepsodent", "sensodyne",
      "familymart", "family mart", "lawson", "circle k", "klikindomaret", "alfagift"
    ],
  },

  TRANSPORTATION: {
    id: "TRANSPORTATION",
    canonicalCategoryNames: {
      id: ["transportasi", "bensin", "kendaraan", "transport", "bbm"],
      en: ["transportation", "fuel", "commute", "vehicle", "transit"],
    },
    categoryNameKeywords: ["transport", "kendaraan", "bensin", "bbm", "fuel", "commute", "transit", "mobil", "motor"],
    keywords: [
      "bensin", "pertamax", "pertalite", "solar", "dexlite", "pertamina", "spbu",
      "shell", "bp akr", "vivo", "parkir", "parking", "tol", "e-toll", "etoll",
      "jasamarga", "gojek", "goride", "gocar", "grab", "grabbike", "grabcar",
      "maxim", "indrive", "taksi", "taxi", "bluebird", "blue bird", "kereta",
      "krl", "mrt", "lrt", "kai", "commuter", "busway", "transjakarta", "tj",
      "bus", "angkot", "pesawat", "garuda", "lion", "citilink", "airasia", "bbm",
      "kendaraan", "motor", "mobil", "bengkel", "tambal ban", "cuci motor", "cuci mobil",
      "service motor", "service mobil", "oli", "ganti oli", "helm", "spion",
      "perjalanan", "ojek", "ojol", "travel", "ongkos"
    ],
  },

  BILLS_UTILITIES: {
    id: "BILLS_UTILITIES",
    canonicalCategoryNames: {
      id: ["tagihan", "utilitas", "listrik & air", "hunian", "tagihan & utilitas"],
      en: ["bills", "utilities", "electricity", "water", "bills & utilities"],
    },
    categoryNameKeywords: ["tagihan", "bill", "utilitas", "utility", "listrik", "pln", "air", "pdam"],
    keywords: [
      "listrik", "pln", "token", "token listrik", "tagihan listrik", "pdam", "air",
      "wifi", "internet", "indihome", "biznet", "myrepublic", "first media", "iconnet",
      "ipl", "sampah", "maintenance", "iuran", "lingkungan", "gas", "pgn", "keamanan"
    ],
  },

  COMMUNICATION_DATA: {
    id: "COMMUNICATION_DATA",
    canonicalCategoryNames: {
      id: ["pulsa", "paket data", "telekomunikasi", "komunikasi"],
      en: ["mobile data", "phone", "telecom", "mobile bills"],
    },
    categoryNameKeywords: ["pulsa", "kuota", "data", "telekomunikasi", "phone", "mobile", "paket"],
    keywords: [
      "pulsa", "kuota", "paket data", "telkomsel", "byu", "by.u", "xl", "axiata",
      "indosat", "im3", "ooredoo", "smartfren", "tri", "three", "kartu halo",
      "roaming", "perpanjang kuota", "beli pulsa"
    ],
  },

  HEALTH_MEDICAL: {
    id: "HEALTH_MEDICAL",
    canonicalCategoryNames: {
      id: ["kesehatan", "medis", "obat & apotek", "kesehatan & kebugaran"],
      en: ["health", "medical", "pharmacy", "wellness", "healthcare"],
    },
    categoryNameKeywords: ["sehat", "health", "medis", "medical", "obat", "apotek", "dokter", "klinik"],
    keywords: [
      "obat", "apotek", "apotik", "kimia farma", "k24", "k-24", "century", "guardian",
      "watsons", "dokter", "rumah sakit", "rs", "klinik", "puskesmas", "vitamin",
      "suplemen", "panadol", "bodrex", "tolak angin", "paracetamol", "sanmol",
      "promag", "diapet", "periksa", "dental", "gigi", "cabut gigi", "tambal gigi",
      "kacamata", "optik", "optik melawai", "optik seis", "bpjs", "bpjs kesehatan",
      "rapid", "swab", "antigen", "termometer", "tensimeter", "masker"
    ],
  },

  ENTERTAINMENT_SUBSCRIPTIONS: {
    id: "ENTERTAINMENT_SUBSCRIPTIONS",
    canonicalCategoryNames: {
      id: ["hiburan", "langganan", "rekreasi", "hobi", "hiburan & hobi"],
      en: ["entertainment", "subscriptions", "hobbies", "leisure", "streaming"],
    },
    categoryNameKeywords: ["hiburan", "entertain", "langganan", "subscript", "hobi", "hobby", "rekreasi", "game"],
    keywords: [
      "bioskop", "cinema", "xxi", "premiere", "imax", "cgv", "cinepolis", "nonton",
      "netflix", "spotify", "youtube", "youtube premium", "disney", "disney+", "hbo",
      "vidio", "prime video", "steam", "playstation", "psn", "nintendo", "game",
      "top up game", "diamond", "mlbb", "genshin", "valorant", "fifa", "konser",
      "tiket konser", "rekreasi", "hiburan", "timezone", "karaoke", "dufan", "ancol",
      "taman safari", "museum", "bowling", "billiard"
    ],
  },

  SHOPPING_CLOTHING: {
    id: "SHOPPING_CLOTHING",
    canonicalCategoryNames: {
      id: ["pakaian", "fashion", "busana", "pakaian & aksesoris"],
      en: ["clothing", "apparel", "fashion", "wardrobe"],
    },
    categoryNameKeywords: ["pakaian", "cloth", "fashion", "baju", "busana", "apparel", "outfit"],
    keywords: [
      "baju", "celana", "kaos", "kemeja", "jaket", "hoodie", "sweater", "sepatu",
      "sandal", "sneakers", "tas", "dompet", "ransel", "topi", "kacamata hitam",
      "mall", "uniqlo", "zara", "h&m", "pull&bear", "mango", "stradivarius",
      "cotton on", "distro", "thrift", "thrifting", "fashion", "aksesoris",
      "gamis", "hijab", "jilbab", "mukena", "jas", "blazer", "rok", "jeans"
    ],
  },

  ONLINE_SHOPPING: {
    id: "ONLINE_SHOPPING",
    canonicalCategoryNames: {
      id: ["belanja", "belanja online", "shopping", "kebutuhan", "lifestyle"],
      en: ["shopping", "online shopping", "purchases", "lifestyle"],
    },
    categoryNameKeywords: ["belanja", "shop", "online", "kebutuhan", "paket", "lifestyle"],
    keywords: [
      "shopee", "tokopedia", "tiktok shop", "lazada", "blibli", "bukalapak",
      "belanja online", "olshop", "checkout", "pesanan shopee", "spay", "shopeepay",
      "tokped", "tiktokshop", "amazon", "aliexpress", "zalora", "paket", "ongkir",
      "marketplace", "e-commerce"
    ],
  },

  PERSONAL_CARE: {
    id: "PERSONAL_CARE",
    canonicalCategoryNames: {
      id: ["perawatan", "kecantikan", "grooming", "personal care"],
      en: ["personal care", "beauty", "grooming", "self care"],
    },
    categoryNameKeywords: ["perawatan", "care", "cantik", "beauty", "grooming", "salon", "barber"],
    keywords: [
      "potong rambut", "pangkas", "cukur", "barbershop", "barber", "salon",
      "creambath", "facial", "skincare", "skin care", "makeup", "make up",
      "serum", "sunscreen", "moisturizer", "toner", "micellar", "lipstik",
      "parfum", "cologne", "body lotion", "spa", "massage", "pijat", "refleksi",
      "manicure", "pedicure", "nail art", "waxing", "perawatan"
    ],
  },

  EDUCATION: {
    id: "EDUCATION",
    canonicalCategoryNames: {
      id: ["pendidikan", "edukasi", "kursus & buku", "belajar"],
      en: ["education", "learning", "courses", "books", "tuition"],
    },
    categoryNameKeywords: ["didik", "educat", "kursus", "course", "buku", "book", "belajar", "learn"],
    keywords: [
      "buku", "gramedia", "periplus", "kursus", "les", "bimbel", "ruangguru",
      "udemy", "coursera", "bootcamp", "spp", "skripsi", "wisuda", "kuliah",
      "sekolah", "seminar", "workshop", "alat tulis", "fotokopi", "print", "jilid"
    ],
  },

  HOUSING_LODGING: {
    id: "HOUSING_LODGING",
    canonicalCategoryNames: {
      id: ["sewa & kos", "tempat tinggal", "penginapan", "hotel & villa"],
      en: ["rent", "housing", "lodging", "hotel", "accommodation"],
    },
    categoryNameKeywords: ["sewa", "rent", "kos", "kost", "hotel", "lodging", "villa", "tinggal", "housing"],
    keywords: [
      "kost", "kos", "kosan", "kontrakan", "sewa rumah", "sewa apartemen",
      "hotel", "villa", "resort", "airbnb", "agoda", "booking.com", "traveloka hotel",
      "penginapan", "hostel", "homestay"
    ],
  },

  DONATION_CHARITY: {
    id: "DONATION_CHARITY",
    canonicalCategoryNames: {
      id: ["donasi", "sedekah", "amal", "zakat", "sosial"],
      en: ["charity", "donation", "giving", "tithe", "social"],
    },
    categoryNameKeywords: ["donasi", "donat", "sedekah", "amal", "charity", "zakat", "giving"],
    keywords: [
      "sedekah", "infaq", "zakat", "zakat fitrah", "zakat maal", "donasi",
      "sumbangan", "persembahan", "perpuluhan", "kitabisa", "amal", "masjid",
      "gereja", "pantiasuhan", "panti asuhan"
    ],
  },

  PETS: {
    id: "PETS",
    canonicalCategoryNames: {
      id: ["hewan peliharaan", "hewan", "kucing & anjing"],
      en: ["pets", "pet care", "animals"],
    },
    categoryNameKeywords: ["hewan", "pet", "kucing", "cat", "anjing", "dog"],
    keywords: [
      "petshop", "pet shop", "cat food", "dog food", "whiskas", "pro plan",
      "royal canin", "me-o", "dokter hewan", "vet", "pasir kucing", "grooming kucing",
      "grooming anjing", "vaksin hewan", "makanan kucing", "makanan anjing"
    ],
  },

  INVESTMENT_SAVINGS: {
    id: "INVESTMENT_SAVINGS",
    canonicalCategoryNames: {
      id: ["investasi", "tabungan", "aset", "reksadana & saham"],
      en: ["investment", "savings", "assets", "portfolio", "wealth"],
    },
    categoryNameKeywords: ["invest", "tabung", "saving", "saham", "crypto", "aset", "asset"],
    keywords: [
      "investasi", "saham", "crypto", "kripto", "bitcoin", "btc", "eth", "usdt",
      "reksadana", "bibit", "ajaib", "bareksa", "pluang", "stockbit", "emas",
      "antm", "antam", "deposito", "tabungan", "obligasi", "sbn", "ori"
    ],
  },

  SALARY_INCOME: {
    id: "SALARY_INCOME",
    canonicalCategoryNames: {
      id: ["gaji", "pendapatan", "pemasukan", "bonus & insentif"],
      en: ["salary", "income", "payroll", "earnings", "bonus"],
    },
    categoryNameKeywords: ["gaji", "salary", "dapat", "income", "masuk", "payroll", "bonus", "upah"],
    keywords: [
      "gaji", "gajian", "salary", "payroll", "bonus", "thr", "tunjangan",
      "dividen", "dividend", "freelance", "fee", "honor", "invoice", "proyek",
      "omset", "keuntungan", "profit", "hadiah", "cashback", "refund"
    ],
  },

  TRANSFER_FINANCE: {
    id: "TRANSFER_FINANCE",
    canonicalCategoryNames: {
      id: ["transfer", "antar akun", "biaya admin", "keuangan"],
      en: ["transfer", "internal transfer", "admin fee", "banking"],
    },
    categoryNameKeywords: ["transfer", "antar", "admin", "pindah", "tarik"],
    keywords: [
      "transfer", "pindah dana", "tarik tunai", "top up", "topup", "isi saldo",
      "biaya admin", "admin bank", "biaya transfer", "bifast", "bi-fast"
    ],
  },
};

export interface SemanticClassificationResult {
  category: Category | null;
  conceptId: SemanticConceptId | null;
  confidence: number;
  matchedKeyword: string | null;
}

/**
 * Normalizes input words by stripping noise characters and common prefixes.
 */
function cleanToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Intelligently classifies an input description (voice or text) into the user's categories.
 * 1. Checks for exact user category name mentions (highest priority).
 * 2. Matches input tokens against the canonical Concept Taxonomy.
 * 3. Finds user categories matching the identified concept.
 */
import type { TransactionType } from "./types";

export function classifySemanticCategory(
  inputText: string,
  categories: Category[],
  typeHint?: TransactionType,
): SemanticClassificationResult {
  if (!inputText || !categories || categories.length === 0) {
    return { category: null, conceptId: null, confidence: 0, matchedKeyword: null };
  }

  const pool = typeHint && typeHint !== "transfer"
    ? categories.filter((c) => c.type === typeHint)
    : categories;
  const activeCategories = pool.length > 0 ? pool : categories;

  const rawLower = inputText.toLowerCase();
  const tokens = rawLower
    .split(/\s+/)
    .map(cleanToken)
    .filter((t) => t.length >= 2);

  // 1. Direct Category Name Match (High Priority)
  for (const cat of activeCategories) {
    const catName = cat.name.toLowerCase().trim();
    if (!catName) continue;
    // Exact or word boundary match
    const regex = new RegExp(`\\b${catName}\\b`, "i");
    if (regex.test(rawLower)) {
      return {
        category: cat,
        conceptId: null,
        confidence: 0.95,
        matchedKeyword: catName,
      };
    }
  }

  // 1.5 Contextual Disambiguation for E-Commerce / Shopee / Tokopedia
  const isMarketplace = /shopee|tokopedia|tiktok\s*shop|tokped|lazada|blibli/i.test(rawLower);
  let forcedConceptHint: SemanticConceptId | null = null;
  if (isMarketplace) {
    if (/shopeefood|food|makan|kopi|coffee|resto|restoran|ayam|bakso|mie|burger|pizza|dapur|snack/i.test(rawLower)) {
      forcedConceptHint = /kopi|coffee|latte|kafe|boba|tea/i.test(rawLower) ? "COFFEE_BEVERAGE" : "FOOD_DINING";
    } else if (/pln|listrik|pulsa|paket\s*data|kuota|bpjs|tagihan|pdam|telkom|indihome/i.test(rawLower)) {
      forcedConceptHint = /pulsa|data|kuota/i.test(rawLower) ? "COMMUNICATION_DATA" : "BILLS_UTILITIES";
    } else if (/baju|celana|kaos|kemeja|jaket|hoodie|sweater|sepatu|sandal|sneakers|tas|gamis|hijab|mukena|rok|jeans/i.test(rawLower)) {
      forcedConceptHint = "SHOPPING_CLOTHING";
    } else if (/supermarket|sembako|beras|minyak|gula|telur|sabun|detergen/i.test(rawLower)) {
      forcedConceptHint = "GROCERIES";
    } else {
      forcedConceptHint = "ONLINE_SHOPPING";
    }
  }

  // 2. Score All Semantic Concepts Against Tokens
  let bestConceptId: SemanticConceptId | null = forcedConceptHint;
  let bestConceptScore = forcedConceptHint ? 5 : 0;
  let bestKeyword: string | null = forcedConceptHint
    ? (forcedConceptHint === "ONLINE_SHOPPING" ? "shopee/marketplace" : "marketplace context")
    : null;

  for (const concept of Object.values(CONCEPT_TAXONOMY)) {
    let score = 0;
    let localBestKeyword: string | null = null;

    // Check multi-word keywords first (e.g., "potong rambut", "nasi goreng", "point coffee")
    for (const kw of concept.keywords) {
      if (kw.includes(" ")) {
        if (rawLower.includes(kw)) {
          score += 3;
          if (!localBestKeyword) localBestKeyword = kw;
        }
      }
    }

    // Check single tokens
    for (const token of tokens) {
      for (const kw of concept.keywords) {
        if (kw === token) {
          score += 2;
          if (!localBestKeyword) localBestKeyword = kw;
        } else if (token.length >= 4 && (token.startsWith(kw) || kw.startsWith(token))) {
          score += 1;
          if (!localBestKeyword) localBestKeyword = kw;
        }
      }
    }

    if (score > bestConceptScore) {
      bestConceptScore = score;
      bestConceptId = concept.id;
      bestKeyword = localBestKeyword;
    }
  }

  if (!bestConceptId || bestConceptScore === 0) {
    return { category: null, conceptId: null, confidence: 0, matchedKeyword: null };
  }

  // 3. Find the best user category matching this concept
  const targetConcept = CONCEPT_TAXONOMY[bestConceptId];
  let bestMatchedCat: Category | null = null;
  let highestCatAffinity = 0;

  for (const cat of activeCategories) {
    const catLower = cat.name.toLowerCase();
    let affinity = 0;

    // A. Check canonical names
    for (const canon of [
      ...targetConcept.canonicalCategoryNames.id,
      ...targetConcept.canonicalCategoryNames.en,
    ]) {
      if (catLower === canon) {
        affinity += 10;
      } else if (catLower.includes(canon) || canon.includes(catLower)) {
        affinity += 6;
      }
    }

    // B. Check category name keywords
    for (const kw of targetConcept.categoryNameKeywords) {
      if (catLower.includes(kw)) {
        affinity += 4;
      }
    }

    if (affinity > highestCatAffinity) {
      highestCatAffinity = affinity;
      bestMatchedCat = cat;
    }
  }

  if (bestMatchedCat) {
    const confidence = Math.min(0.9, 0.6 + bestConceptScore * 0.1);
    return {
      category: bestMatchedCat,
      conceptId: bestConceptId,
      confidence,
      matchedKeyword: bestKeyword,
    };
  }

  return {
    category: null,
    conceptId: bestConceptId,
    confidence: 0.4,
    matchedKeyword: bestKeyword,
  };
}
