import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Category, TransactionType, CashflowNature } from "../lib/types";
import { generateUUID } from "../lib/utils";

export const categoryKeys = {
  all: (userId?: string) => ["categories", userId ?? null, null] as const,
  byType: (userId?: string, type?: TransactionType) =>
    ["categories", userId ?? null, type ?? null] as const,
};

// ======================================================================
// DEFAULT CATEGORIES — using PNG icons from public/icons/
// Income: gaji, bunga, pemberian, trading, side job, investasi, hadiah
// Expense: everything else
// ======================================================================
export const CATEGORY_PARENT_MAP: Record<string, string> = {
  // Universal Generalized Expense Parents (Indonesian)
  "makanan & minuman": "Pangan",
  "bahan makanan & pasar": "Papan",
  "groceries & supermarket": "Papan",
  "transportasi & kendaraan": "Transportasi",
  "hunian & utilitas": "Papan",
  "tagihan & langganan": "Biaya",
  "belanja & gaya hidup": "Sandang",
  "kesehatan & medis": "Sandang",
  "hiburan & rekreasi": "Hiburan",
  "keluarga & pribadi": "Keluarga",
  "pendidikan & karier": "Sandang",
  "pendidikan & karir": "Sandang",
  "sosial & amal": "Sosial",
  "biaya finansial & pajak": "Biaya",
  "investasi & tabungan": "Keuangan",

  // Universal Generalized Expense Parents (English)
  "food & dining": "Pangan",
  "transportation & travel": "Transportasi",
  "housing & utilities": "Papan",
  "bills & subscriptions": "Biaya",
  "shopping & lifestyle": "Sandang",
  "health & medical": "Sandang",
  "entertainment & leisure": "Hiburan",
  "family & personal care": "Keluarga",
  "education & career": "Sandang",
  "gifts & donations": "Sosial",
  "financial fees & taxes": "Biaya",
  "savings & investments": "Keuangan",
  "other expenses": "Lainnya",

  // Legacy & Specific Expense Mappings (for existing data backward compatibility)
  kerugian: "Biaya",
  karir: "Biaya",
  "admin & fee": "Biaya",
  "pajak & legal": "Biaya",
  jasa: "Biaya",
  keluarga: "Keluarga",
  pets: "Keluarga",
  groceries: "Papan",
  peralatan: "Papan",
  furnitur: "Papan",
  reparasi: "Papan",
  elektronik: "Papan",
  laundry: "Papan",
  hunian: "Papan",
  housing: "Papan",
  utilities: "Papan",
  asuransi: "Sandang",
  fashion: "Sandang",
  perawatan: "Sandang",
  kesehatan: "Sandang",
  medical: "Sandang",
  healthcare: "Sandang",
  pendidikan: "Sandang",
  education: "Sandang",
  zakat: "Sosial",
  hadiah: "Sosial",
  donasi: "Sosial",
  donations: "Sosial",
  hiburan: "Hiburan",
  entertainment: "Hiburan",
  subscription: "Hiburan",
  subscriptions: "Biaya",
  bills: "Biaya",
  liburan: "Hiburan",
  tabungan: "Keuangan",
  savings: "Keuangan",
  internet: "Komunikasi",
  lainnya: "Lainnya",
  olahraga: "Olahraga",
  makanan: "Pangan",
  minuman: "Pangan",
  kopi: "Pangan",
  cafe: "Pangan",
  gadget: "Personal",
  transportasi: "Transportasi",
  transportation: "Transportasi",
  bensin: "Transportasi",
  parkir: "Transportasi",
  kendaraan: "Transportasi",

  // Universal Generalized Income Parents (Indonesian)
  "gaji & upah": "Pendapatan",
  "bisnis & kerja lepas": "Pendapatan",
  "bisnis & freelance": "Pendapatan",
  "bonus & komisi": "Pendapatan",
  "investasi & dividen": "Keuangan",
  "bunga & imbal hasil": "Pendapatan",
  "bunga & passive income": "Pendapatan",
  "pengembalian & diskon": "Pendapatan",
  "cashback & refund": "Pendapatan",
  "hadiah & hibah": "Pendapatan",
  "pendapatan lainnya": "Pendapatan",

  // Universal Generalized Income Parents (English)
  "salary & wages": "Pendapatan",
  "business & freelance": "Pendapatan",
  "bonuses & commissions": "Pendapatan",
  "investments & dividends": "Keuangan",
  "interest & passive income": "Pendapatan",
  "cashback & refunds": "Pendapatan",
  "gifts & grants": "Pendapatan",
  "other income": "Pendapatan",

  // Legacy & Specific Income Mappings
  bonus: "Pendapatan",
  bonuses: "Pendapatan",
  komisi: "Pendapatan",
  commissions: "Pendapatan",
  saku: "Pendapatan",
  cashback: "Pendapatan",
  refund: "Pendapatan",
  refunds: "Pendapatan",
  penjualan: "Pendapatan",
  gaji: "Pendapatan",
  salary: "Pendapatan",
  wages: "Pendapatan",
  "side job": "Pendapatan",
  freelance: "Pendapatan",
  business: "Pendapatan",
  bunga: "Pendapatan",
  interest: "Pendapatan",
  pemberian: "Pendapatan",
  investasi: "Keuangan",
  investments: "Keuangan",
  trading: "Keuangan",
  dividends: "Keuangan",
};

export const PARENT_NAME_LOCALIZED: Record<string, { id: string; en: string }> = {
  Pangan: { id: "Pangan", en: "Food & Sustenance" },
  Papan: { id: "Papan", en: "Housing & Groceries" },
  Transportasi: { id: "Transportasi", en: "Transportation" },
  Sandang: { id: "Sandang", en: "Lifestyle & Health" },
  Biaya: { id: "Biaya", en: "Bills & Fees" },
  Sosial: { id: "Sosial", en: "Social & Giving" },
  Hiburan: { id: "Hiburan", en: "Entertainment" },
  Komunikasi: { id: "Komunikasi", en: "Communications" },
  Keluarga: { id: "Keluarga", en: "Family & Pets" },
  Olahraga: { id: "Olahraga", en: "Sports & Fitness" },
  Keuangan: { id: "Keuangan", en: "Financial & Investment" },
  Personal: { id: "Personal", en: "Personal Care" },
  Pendapatan: { id: "Pendapatan", en: "Income" },
  Lainnya: { id: "Lainnya", en: "Other" },
};

export function getParentDisplayName(parentName: string, isIndonesian = true): string {
  if (!parentName) return isIndonesian ? "Lainnya" : "Other";
  const entry = PARENT_NAME_LOCALIZED[parentName];
  if (entry) return isIndonesian ? entry.id : entry.en;
  return parentName;
}

export const PARENT_ICON_MAP: Record<string, string> = {
  Pangan: "Utensils",
  Transportasi: "Car",
  Papan: "Home",
  Sandang: "Shirt",
  Biaya: "Receipt",
  Sosial: "HeartHandshake",
  Hiburan: "Gamepad2",
  Komunikasi: "Wifi",
  Keluarga: "Users",
  Olahraga: "Dumbbell",
  Keuangan: "TrendingUp",
  Personal: "Sparkles",
  Pendapatan: "Briefcase",
  Lainnya: "Tag",
};

export function getCategoryParent(categoryName: string): string {
  if (!categoryName) return "Lainnya";
  const k = categoryName.trim().toLowerCase();
  if (CATEGORY_PARENT_MAP[k]) return CATEGORY_PARENT_MAP[k];
  for (const [key, parent] of Object.entries(CATEGORY_PARENT_MAP)) {
    if (k.includes(key) || key.includes(k)) {
      return parent;
    }
  }
  return "Lainnya";
}

export function getParentIcon(parentName: string): string {
  return PARENT_ICON_MAP[parentName] || "Tag";
}

export const CATEGORY_CASHFLOW_MAP: Record<string, CashflowNature> = {
  investasi: "investing",
  "investasi & tabungan": "investing",
  "investasi & dividen": "investing",
  trading: "investing",
  saham: "investing",
  "saham idx": "investing",
  crypto: "investing",
  reksadana: "investing",
  "reksa dana": "investing",
  deposito: "investing",
  emas: "investing",
  gadget: "investing",
  elektronik: "investing",
  furnitur: "investing",
  peralatan: "investing",
  investment: "investing",
  investments: "investing",
  "investments & dividends": "investing",
  "savings & investments": "investing",
  stocks: "investing",
  brokerage: "investing",
  cicilan: "financing",
  hutang: "financing",
  pinjaman: "financing",
  liabilitas: "financing",
  "kartu kredit": "financing",
  paylater: "financing",
  loan: "financing",
  loans: "financing",
  mortgage: "financing",
  "credit card": "financing",
  liabilities: "financing",
};

export function getCategoryCashflowNature(
  categoryName?: string | null,
  customNature?: CashflowNature,
): CashflowNature {
  if (customNature) return customNature;
  if (!categoryName) return "operating";
  const k = categoryName.trim().toLowerCase();
  if (CATEGORY_CASHFLOW_MAP[k]) return CATEGORY_CASHFLOW_MAP[k];
  for (const [key, nature] of Object.entries(CATEGORY_CASHFLOW_MAP)) {
    if (k.includes(key)) {
      return nature;
    }
  }
  return "operating";
}

// ======================================================================
// DEFAULT CATEGORIES — Universal, Non-Redundant Luxury Taxonomy
// ======================================================================

export const DEFAULT_CATEGORIES_ID: Omit<
  Category,
  "id" | "user_id" | "created_at"
>[] = [
  // --- INCOME (8 Universal Streams) ---
  {
    name: "Gaji & Upah",
    emoji: "Briefcase",
    type: "income",
    is_default: true,
  },
  {
    name: "Bisnis & Freelance",
    emoji: "Store",
    type: "income",
    is_default: true,
  },
  {
    name: "Bonus & Komisi",
    emoji: "Gift",
    type: "income",
    is_default: true,
  },
  {
    name: "Investasi & Dividen",
    emoji: "TrendingUp",
    type: "income",
    is_default: true,
  },
  {
    name: "Bunga & Imbal Hasil",
    emoji: "Percent",
    type: "income",
    is_default: true,
  },
  {
    name: "Pengembalian & Diskon",
    emoji: "RotateCcw",
    type: "income",
    is_default: true,
  },
  {
    name: "Hadiah & Hibah",
    emoji: "Trophy",
    type: "income",
    is_default: true,
  },
  {
    name: "Pendapatan Lainnya",
    emoji: "Coins",
    type: "income",
    is_default: true,
  },

  // --- EXPENSE (14 Universal Pillars) ---
  {
    name: "Makanan & Minuman",
    emoji: "Utensils",
    type: "expense",
    is_default: true,
  },
  {
    name: "Groceries & Supermarket",
    emoji: "ShoppingBag",
    type: "expense",
    is_default: true,
  },
  {
    name: "Transportasi & Kendaraan",
    emoji: "Car",
    type: "expense",
    is_default: true,
  },
  {
    name: "Hunian & Utilitas",
    emoji: "Home",
    type: "expense",
    is_default: true,
  },
  {
    name: "Tagihan & Langganan",
    emoji: "Receipt",
    type: "expense",
    is_default: true,
  },
  {
    name: "Belanja & Gaya Hidup",
    emoji: "Shirt",
    type: "expense",
    is_default: true,
  },
  {
    name: "Kesehatan & Medis",
    emoji: "HeartPulse",
    type: "expense",
    is_default: true,
  },
  {
    name: "Hiburan & Rekreasi",
    emoji: "Gamepad2",
    type: "expense",
    is_default: true,
  },
  {
    name: "Keluarga & Pribadi",
    emoji: "Users",
    type: "expense",
    is_default: true,
  },
  {
    name: "Pendidikan & Karier",
    emoji: "GraduationCap",
    type: "expense",
    is_default: true,
  },
  {
    name: "Sosial & Amal",
    emoji: "HeartHandshake",
    type: "expense",
    is_default: true,
  },
  {
    name: "Biaya Finansial & Pajak",
    emoji: "Scale",
    type: "expense",
    is_default: true,
  },
  {
    name: "Investasi & Tabungan",
    emoji: "TrendingUp",
    type: "expense",
    is_default: true,
  },
  {
    name: "Lainnya",
    emoji: "Tag",
    type: "expense",
    is_default: true,
  },
];

export const DEFAULT_CATEGORIES_EN: Omit<
  Category,
  "id" | "user_id" | "created_at"
>[] = [
  // --- INCOME (8 Universal Streams) ---
  {
    name: "Salary & Wages",
    emoji: "Briefcase",
    type: "income",
    is_default: true,
  },
  {
    name: "Business & Freelance",
    emoji: "Store",
    type: "income",
    is_default: true,
  },
  {
    name: "Bonuses & Commissions",
    emoji: "Gift",
    type: "income",
    is_default: true,
  },
  {
    name: "Investments & Dividends",
    emoji: "TrendingUp",
    type: "income",
    is_default: true,
  },
  {
    name: "Interest & Passive Income",
    emoji: "Percent",
    type: "income",
    is_default: true,
  },
  {
    name: "Cashback & Refunds",
    emoji: "RotateCcw",
    type: "income",
    is_default: true,
  },
  {
    name: "Gifts & Grants",
    emoji: "Trophy",
    type: "income",
    is_default: true,
  },
  {
    name: "Other Income",
    emoji: "Coins",
    type: "income",
    is_default: true,
  },

  // --- EXPENSE (14 Universal Pillars) ---
  {
    name: "Food & Dining",
    emoji: "Utensils",
    type: "expense",
    is_default: true,
  },
  {
    name: "Groceries & Supermarket",
    emoji: "ShoppingBag",
    type: "expense",
    is_default: true,
  },
  {
    name: "Transportation & Travel",
    emoji: "Car",
    type: "expense",
    is_default: true,
  },
  {
    name: "Housing & Utilities",
    emoji: "Home",
    type: "expense",
    is_default: true,
  },
  {
    name: "Bills & Subscriptions",
    emoji: "Receipt",
    type: "expense",
    is_default: true,
  },
  {
    name: "Shopping & Lifestyle",
    emoji: "Shirt",
    type: "expense",
    is_default: true,
  },
  {
    name: "Health & Medical",
    emoji: "HeartPulse",
    type: "expense",
    is_default: true,
  },
  {
    name: "Entertainment & Leisure",
    emoji: "Gamepad2",
    type: "expense",
    is_default: true,
  },
  {
    name: "Family & Personal Care",
    emoji: "Users",
    type: "expense",
    is_default: true,
  },
  {
    name: "Education & Career",
    emoji: "GraduationCap",
    type: "expense",
    is_default: true,
  },
  {
    name: "Gifts & Donations",
    emoji: "HeartHandshake",
    type: "expense",
    is_default: true,
  },
  {
    name: "Financial Fees & Taxes",
    emoji: "Scale",
    type: "expense",
    is_default: true,
  },
  {
    name: "Savings & Investments",
    emoji: "TrendingUp",
    type: "expense",
    is_default: true,
  },
  {
    name: "Other Expenses",
    emoji: "Tag",
    type: "expense",
    is_default: true,
  },
];

export const DEFAULT_CATEGORIES = DEFAULT_CATEGORIES_ID;

export function getDefaultCategories(options?: {
  currency?: string | null;
  isIndo?: boolean;
}): Omit<Category, "id" | "user_id" | "created_at">[] {
  let currency = options?.currency;
  if (!currency && typeof window !== "undefined") {
    currency = localStorage.getItem("trouvaille_preferred_currency");
  }

  let isIndo = options?.isIndo;
  if (isIndo === undefined && typeof window !== "undefined") {
    const lang = localStorage.getItem("trouvaille_language");
    isIndo = lang !== "en";
  }

  if ((currency && currency !== "IDR") || isIndo === false) {
    return DEFAULT_CATEGORIES_EN;
  }
  return DEFAULT_CATEGORIES_ID;
}

import { useAuth } from "../contexts/AuthContext";

function withTimeout<T>(promise: PromiseLike<T>, ms = 6000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Categories fetch timeout after ${ms}ms`)), ms),
    ),
  ]);
}

const CATEGORIES_BACKUP_STORAGE_KEY = "TROUVAILLE_CATEGORIES_BACKUP_V1";

export function useCategories(type?: TransactionType) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: categoryKeys.byType(userId, type),
    queryFn: async () => {
      if (userId === "guest_local_user") {
        try {
          const cached = localStorage.getItem(CATEGORIES_BACKUP_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as Category[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              return type ? parsed.filter((c) => c.type === type) : parsed;
            }
          }
        } catch {}

        const activeDefaults = getDefaultCategories();
        const fallbackList: Category[] = activeDefaults
          .filter((c) => !type || c.type === type)
          .map((c) => ({
            id: generateUUID(),
            user_id: "guest_local_user",
            name: c.name,
            emoji: c.emoji,
            type: c.type,
            is_default: true,
            created_at: new Date().toISOString(),
          }));

        try {
          if (!type) {
            localStorage.setItem(
              CATEGORIES_BACKUP_STORAGE_KEY,
              JSON.stringify(fallbackList),
            );
          }
        } catch {}

        return fallbackList;
      }
      try {
        let query = supabase
          .from("categories")
          .select("*")
          .order("is_default", { ascending: false })
          .order("name");
        if (userId) query = query.eq("user_id", userId);
        if (type) query = query.eq("type", type);
        const { data, error } = await withTimeout(query, 6000);
        if (error) throw error;

        // Deduplicate by name (case-insensitive) per type to prevent any duplicate categories
        const seen = new Set<string>();
        const uniqueList: Category[] = [];
        ((data as Category[]) || []).forEach((cat) => {
          const key = `${cat.type}_${cat.name.trim().toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueList.push(cat);
          }
        });

        if (uniqueList.length > 0 && !type) {
          try {
            localStorage.setItem(
              CATEGORIES_BACKUP_STORAGE_KEY,
              JSON.stringify(uniqueList),
            );
          } catch {}
        } else if (uniqueList.length === 0) {
          const activeDefaults = getDefaultCategories();
          const fallbackCategories: Category[] = activeDefaults
            .filter((c) => !type || c.type === type)
            .map((c) => ({
              id: `default-${c.type}-${c.name.toLowerCase().replace(/\s+/g, "-")}`,
              user_id: userId || "guest_local_user",
              name: c.name,
              emoji: c.emoji,
              type: c.type,
              is_default: true,
              created_at: new Date().toISOString(),
            }));

          return fallbackCategories;
        }
        return uniqueList;
      } catch (err) {
        console.warn("[useCategories] Fetch failed, restoring from backup/defaults:", err);
        try {
          const cached = localStorage.getItem(CATEGORIES_BACKUP_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as Category[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              return type ? parsed.filter((c) => c.type === type) : parsed;
            }
          }
        } catch {}

        // Fallback to active defaults
        const activeDefaults = getDefaultCategories();
        const fallbackList: Category[] = activeDefaults
          .filter((c) => !type || c.type === type)
          .map((c) => ({
            id: generateUUID(),
            user_id: userId || "default",
            name: c.name,
            emoji: c.emoji,
            type: c.type,
            is_default: c.is_default,
            created_at: new Date().toISOString(),
          }));
        return fallbackList;
      }
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useEnsureDefaultCategories(options?: {
  currency?: string | null;
  isIndo?: boolean;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const { data: existing } = await supabase
          .from("categories")
          .select("id, name, type")
          .eq("user_id", user.id);

        // If the user already has categories, NEVER inject defaults
        if (existing && existing.length > 0) {
          return;
        }

        const targetDefaults = getDefaultCategories(options);
        if (targetDefaults.length > 0) {
          await supabase
            .from("categories")
            .insert(targetDefaults.map((c) => ({ ...c, user_id: user.id })));
        }
      } catch (err) {
        console.warn("useEnsureDefaultCategories error:", err);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useResetDefaultCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      // Delete all default categories
      await supabase
        .from("categories")
        .delete()
        .eq("user_id", user.id)
        .eq("is_default", true);
      // Re-insert with new PNG icons
      await supabase
        .from("categories")
        .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: user.id })));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (cat: {
      name: string;
      emoji: string;
      type: TransactionType;
      budget_amount?: number;
    }) => {
      // 1. Guest / Offline Mode (evaluated dynamically per invocation)
      const isCurrentGuest =
        !user ||
        user.id === "guest_local_user" ||
        localStorage.getItem("trouvaille_guest_mode") === "true";

      if (isCurrentGuest) {
        const trimmedName = cat.name.trim();
        try {
          const raw = localStorage.getItem(CATEGORIES_BACKUP_STORAGE_KEY);
          const list = raw ? JSON.parse(raw) : [];
          if (Array.isArray(list)) {
            const existing = list.find(
              (c: Category) =>
                c.type === cat.type &&
                c.name.trim().toLowerCase() === trimmedName.toLowerCase(),
            );
            if (existing) return existing;
          }
        } catch {}

        const newCat: Category = {
          id: generateUUID(),
          name: trimmedName,
          emoji: cat.emoji,
          type: cat.type,
          budget_amount: cat.budget_amount,
          is_default: false,
          created_at: new Date().toISOString(),
          user_id: "guest_local_user",
        };
        try {
          const raw = localStorage.getItem(CATEGORIES_BACKUP_STORAGE_KEY);
          const list = raw ? JSON.parse(raw) : [];
          if (Array.isArray(list)) {
            list.push(newCat);
            localStorage.setItem(
              CATEGORIES_BACKUP_STORAGE_KEY,
              JSON.stringify(list),
            );
          }
        } catch {}
        return newCat;
      }

      // 2. Cloud Mode
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) throw new Error("Not authenticated");

      const trimmedName = cat.name.trim();

      // Duplicate pre-check: Return existing category if identical name and type already exists
      const { data: existingDup } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", authUser.id)
        .eq("type", cat.type)
        .ilike("name", trimmedName)
        .limit(1);

      if (existingDup && existingDup.length > 0) {
        return existingDup[0] as Category;
      }

      try {
        const { data, error } = await supabase
          .from("categories")
          .insert({ ...cat, name: trimmedName, user_id: authUser.id, is_default: false })
          .select()
          .single();

        if (error) {
          console.warn("[useAddCategory] Cloud insert error:", error);
          if (error.message?.includes("budget_amount")) {
            const fallbackCat = { ...cat };
            delete fallbackCat.budget_amount;
            const { data: retryData, error: retryError } = await supabase
              .from("categories")
              .insert({ ...fallbackCat, user_id: authUser.id, is_default: false })
              .select()
              .single();
            if (retryError) throw retryError;
            return retryData as Category;
          }
          throw error;
        }

        // Cache locally
        try {
          const raw = localStorage.getItem(CATEGORIES_BACKUP_STORAGE_KEY);
          const list = raw ? JSON.parse(raw) : [];
          if (Array.isArray(list)) {
            list.push(data);
            localStorage.setItem(
              CATEGORIES_BACKUP_STORAGE_KEY,
              JSON.stringify(list),
            );
          }
        } catch {}

        return data as Category;
      } catch (cloudErr) {
        console.warn("[useAddCategory] Exception inserting category:", cloudErr);
        // Fallback local return
        const fallbackCat: Category = {
          id: generateUUID(),
          name: cat.name,
          emoji: cat.emoji,
          type: cat.type,
          budget_amount: cat.budget_amount,
          is_default: false,
          created_at: new Date().toISOString(),
          user_id: authUser.id,
        };
        return fallbackCat;
      }
    },
    onSuccess: (newCat) => {
      qc.setQueriesData<Category[]>({ queryKey: ["categories"] }, (old) => {
        if (!old) return [newCat];
        return [...old.filter((c) => c.id !== newCat.id), newCat];
      });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isGuest =
    !user ||
    user.id === "guest_local_user" ||
    (typeof window !== "undefined" &&
      localStorage.getItem("trouvaille_guest_mode") === "true");

  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        try {
          const raw = localStorage.getItem(CATEGORIES_BACKUP_STORAGE_KEY);
          if (raw) {
            const list: Category[] = JSON.parse(raw);
            if (Array.isArray(list)) {
              const filtered = list.filter((c) => c.id !== id);
              localStorage.setItem(
                CATEGORIES_BACKUP_STORAGE_KEY,
                JSON.stringify(filtered),
              );
            }
          }
          const rawTx = localStorage.getItem("TROUVAILLE_TX_BACKUP_V1");
          if (rawTx) {
            const txList = JSON.parse(rawTx);
            if (Array.isArray(txList)) {
              const updatedTxs = txList.map((t: any) =>
                t.category_id === id
                  ? { ...t, category_id: null, categories: null }
                  : t,
              );
              localStorage.setItem(
                "TROUVAILLE_TX_BACKUP_V1",
                JSON.stringify(updatedTxs),
              );
            }
          }
        } catch {}
        return id;
      }

      // Unassign linked transactions so deletion succeeds and transitions them to uncategorized
      await supabase
        .from("transactions")
        .update({ category_id: null })
        .eq("category_id", id);

      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      try {
        const raw = localStorage.getItem(CATEGORIES_BACKUP_STORAGE_KEY);
        if (raw) {
          const list: Category[] = JSON.parse(raw);
          if (Array.isArray(list)) {
            localStorage.setItem(
              CATEGORIES_BACKUP_STORAGE_KEY,
              JSON.stringify(list.filter((c) => c.id !== id)),
            );
          }
        }
      } catch {}
      return id;
    },
    onSuccess: (deletedId) => {
      qc.setQueriesData<Category[]>({ queryKey: ["categories"] }, (old) => {
        if (!old) return [];
        return old.filter((c) => c.id !== deletedId);
      });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isGuest =
    !user ||
    user.id === "guest_local_user" ||
    localStorage.getItem("trouvaille_guest_mode") === "true";

  return useMutation({
    mutationFn: async ({
      id,
      name,
      emoji,
      budget_amount,
    }: {
      id: string;
      name?: string;
      emoji?: string;
      budget_amount?: number | null;
    }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (emoji !== undefined) updates.emoji = emoji;
      if (budget_amount !== undefined) updates.budget_amount = budget_amount;

      // Handle Guest or Offline Mode
      if (isGuest) {
        let cachedCategories: Category[] = [];
        try {
          const raw = localStorage.getItem(CATEGORIES_BACKUP_STORAGE_KEY);
          if (raw) cachedCategories = JSON.parse(raw);
        } catch {}
        const existingIdx = cachedCategories.findIndex((c) => c.id === id);
        const existingCat = existingIdx >= 0 ? cachedCategories[existingIdx] : null;
        const updatedCat: Category = {
          id,
          name: name !== undefined ? name : existingCat?.name || "Category",
          emoji: emoji !== undefined ? emoji : existingCat?.emoji || "Tag",
          type: existingCat?.type || "expense",
          budget_amount:
            budget_amount !== undefined ? budget_amount : existingCat?.budget_amount,
          created_at: existingCat?.created_at || new Date().toISOString(),
          is_default: existingCat?.is_default ?? false,
          user_id: "guest_local_user",
        };
        if (existingIdx >= 0) {
          cachedCategories[existingIdx] = updatedCat;
        } else {
          cachedCategories.push(updatedCat);
        }
        try {
          localStorage.setItem(
            CATEGORIES_BACKUP_STORAGE_KEY,
            JSON.stringify(cachedCategories),
          );
        } catch {}
        return updatedCat;
      }

      // Cloud user
      try {
        let q = supabase
          .from("categories")
          .update(updates)
          .eq("id", id);
        if (user?.id && user.id !== "guest_local_user") {
          q = q.eq("user_id", user.id);
        }
        const { data, error } = await q.select().single();

        if (error) {
          console.warn("[useUpdateCategory] Cloud update error:", error);
          if (error.message?.includes("budget_amount")) {
            const fallbackUpdates = { ...updates };
            delete fallbackUpdates.budget_amount;
            let fbQ = supabase.from("categories").update(fallbackUpdates).eq("id", id);
            if (user?.id && user.id !== "guest_local_user") {
              fbQ = fbQ.eq("user_id", user.id);
            }
            await fbQ;
          }
        }

        if (data) {
          // Sync to local cache
          try {
            const raw = localStorage.getItem(CATEGORIES_BACKUP_STORAGE_KEY);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const idx = list.findIndex((c: Category) => c.id === id);
                if (idx >= 0) {
                  list[idx] = { ...list[idx], ...updates };
                  localStorage.setItem(
                    CATEGORIES_BACKUP_STORAGE_KEY,
                    JSON.stringify(list),
                  );
                }
              }
            }
          } catch {}
          return data as Category;
        }
      } catch (cloudErr) {
        console.warn("[useUpdateCategory] Cloud mutation exception:", cloudErr);
      }

      // Local fallback return
      return {
        id,
        name: name || "Category",
        emoji: emoji || "Tag",
        budget_amount,
      } as Category;
    },
    onSuccess: (updated) => {
      qc.setQueriesData<Category[]>({ queryKey: ["categories"] }, (old) => {
        if (!old) return [updated];
        return old.map((c) =>
          c.id === updated.id
            ? { ...c, ...updated, type: updated.type || c.type }
            : c,
        );
      });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
