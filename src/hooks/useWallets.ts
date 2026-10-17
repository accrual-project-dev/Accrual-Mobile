import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Wallet, AccountClassification } from "../lib/types";
import { generateUUID } from "../lib/utils";

export const WALLET_CLASSIFICATION_STORAGE_KEY =
  "trouvaille_wallet_classifications_v1";

export function getDefaultWalletClassification(name: string): AccountClassification {
  if (!name) return "liquid";
  const n = name.trim().toLowerCase();
  if (
    n.includes("saham") ||
    n.includes("crypto") ||
    n.includes("investasi") ||
    n.includes("reksadana") ||
    n.includes("reksa dana") ||
    n.includes("deposito") ||
    n.includes("stock") ||
    n.includes("brokerage") ||
    n.includes("ibkr") ||
    n.includes("schwab") ||
    n.includes("emas") ||
    n.includes("gold") ||
    n.includes("usdt") ||
    n.includes("vault") ||
    n.includes("tether") ||
    n.includes("btc") ||
    n.includes("bitcoin") ||
    n.includes("eth") ||
    n.includes("ethereum") ||
    n.includes("binance") ||
    n.includes("indodax") ||
    n.includes("tokocrypto") ||
    n.includes("bybit") ||
    n.includes("okx")
  ) {
    return "investment";
  }
  if (
    n.includes("rumah") ||
    n.includes("tanah") ||
    n.includes("apartemen") ||
    n.includes("properti") ||
    n.includes("property") ||
    n.includes("real estate") ||
    n.includes("mobil") ||
    n.includes("motor") ||
    n.includes("kendaraan") ||
    n.includes("vehicle")
  ) {
    return "fixed_asset";
  }
  if (
    n.includes("piutang") ||
    n.includes("receivable") ||
    n.includes("pinjaman teman")
  ) {
    return "receivable";
  }
  if (
    n.includes("credit") ||
    n.includes("paylater") ||
    n.includes("cc") ||
    n.includes("kartu kredit") ||
    n.includes("spaylater") ||
    n.includes("gopaylater")
  ) {
    return "credit";
  }
  if (
    n.includes("liabilities") ||
    n.includes("loan") ||
    n.includes("kpr") ||
    n.includes("hutang") ||
    n.includes("pinjaman")
  ) {
    return "loan";
  }
  return "liquid";
}

export function getSavedWalletClassifications(): Record<string, AccountClassification> {
  try {
    const raw = localStorage.getItem(WALLET_CLASSIFICATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveWalletClassification(
  walletIdOrName: string,
  classification: AccountClassification,
): void {
  try {
    const map = getSavedWalletClassifications();
    map[walletIdOrName.toLowerCase()] = classification;
    localStorage.setItem(WALLET_CLASSIFICATION_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Failed to save wallet classification:", e);
  }
}

export function resolveWalletClassification(wallet: {
  id?: string;
  name: string;
  classification?: AccountClassification;
}): AccountClassification {
  const defaultByName = getDefaultWalletClassification(wallet.name);
  const savedMap = getSavedWalletClassifications();

  let stored: AccountClassification | undefined;
  if (wallet.id && savedMap[wallet.id.toLowerCase()]) {
    stored = savedMap[wallet.id.toLowerCase()];
  } else if (wallet.name && savedMap[wallet.name.trim().toLowerCase()]) {
    stored = savedMap[wallet.name.trim().toLowerCase()];
  } else if (wallet.classification) {
    stored = wallet.classification;
  }

  // If the wallet name explicitly denotes an investment/crypto/debt/receivable account (e.g. "USDT", "Crypto", "Saham")
  // and its stored classification is still the generic "liquid" default from legacy import, upgrade it automatically.
  if ((!stored || stored === "liquid") && defaultByName !== "liquid") {
    return defaultByName;
  }

  return stored || defaultByName;
}

export const walletKeys = {
  all: (userId?: string) => ["wallets", userId ?? null] as const,
};

export function getWalletIcon(name: string): string {
  if (!name) return "Wallet";
  const n = name.trim().toLowerCase();
  if (
    n === "bca" ||
    n === "bri" ||
    n === "mandiri" ||
    n === "bni" ||
    n === "blu" ||
    n === "jago" ||
    n === "bank jago" ||
    n === "krom" ||
    n === "seabank" ||
    n === "superbank" ||
    n === "bank" ||
    n === "chase" ||
    n === "citi" ||
    n === "hsbc" ||
    n === "dbs" ||
    n === "ocbc"
  ) {
    return "Landmark";
  }
  if (n === "cash" || n === "tunai" || n === "physical cash") return "Banknote";
  if (
    n === "crypto" ||
    n === "usdt" ||
    n === "btc" ||
    n === "crypto / usdt" ||
    n === "crypto vault" ||
    n === "usdt vault" ||
    n === "binance"
  ) {
    return "Coins";
  }
  if (
    n === "dana" ||
    n === "gopay" ||
    n === "ovo" ||
    n === "link" ||
    n === "linkaja" ||
    n === "shopeepay" ||
    n === "shopee" ||
    n === "paypal" ||
    n === "ewallet" ||
    n === "digital e-wallet"
  ) {
    return "Smartphone";
  }
  if (
    n === "wise" ||
    n === "revolut" ||
    n === "global" ||
    n === "multi-currency" ||
    n === "borderless"
  ) {
    return "Globe";
  }
  if (
    n === "tapcash" ||
    n === "credit" ||
    n === "kartu kredit" ||
    n === "credit card" ||
    n === "paylater"
  ) {
    return "CreditCard";
  }
  if (
    n === "saham" ||
    n === "saham idx" ||
    n === "investasi" ||
    n === "bibit" ||
    n === "ajaib" ||
    n === "brokerage" ||
    n === "global brokerage" ||
    n === "stocks" ||
    n === "ibkr" ||
    n === "schwab"
  ) {
    return "TrendingUp";
  }
  if (n === "piutang") return "HandCoins";
  if (n === "liabilities" || n === "hutang") return "Scale";
  if (
    n === "tabungan" ||
    n === "saving" ||
    n === "savings" ||
    n === "reksa dana" ||
    n === "emergency fund"
  ) {
    return "PiggyBank";
  }
  return "Wallet";
}

export const DEFAULT_WALLETS = ["Cash"];

export const WALLET_PRESETS = [
  // Cash & Physical
  "Cash",
  // Indonesian Banks
  "BCA",
  "Mandiri",
  "BRI",
  "BNI",
  "Bank Jago",
  "SeaBank",
  "Blu",
  // Indonesian E-Wallets
  "GoPay",
  "OVO",
  "DANA",
  "ShopeePay",
  // Global & Multi-Currency
  "PayPal",
  "Wise",
  "Revolut",
  // Investments & Assets
  "Global Brokerage",
  "Crypto / USDT",
  "Saham IDX",
  "Reksa Dana",
];

export interface CategorizedWalletItem {
  name: string;
  icon: string;
  classification: AccountClassification;
  currency?: string;
  badge?: string;
  description?: string;
}

export interface WalletPresetGroup {
  id: string;
  label: string;
  wallets: CategorizedWalletItem[];
}

export const CATEGORIZED_WALLET_PRESETS: WalletPresetGroup[] = [
  {
    id: "local_banks",
    label: "Lokal & Perbankan (IDR)",
    wallets: [
      { name: "Cash", icon: "Banknote", classification: "liquid", badge: "Tunai", description: "Uang tunai fisik" },
      { name: "BCA", icon: "Landmark", classification: "liquid", badge: "BCA", description: "Bank Central Asia" },
      { name: "Mandiri", icon: "Landmark", classification: "liquid", badge: "Mandiri", description: "Bank Mandiri" },
      { name: "BRI", icon: "Landmark", classification: "liquid", badge: "BRI", description: "Bank Rakyat Indonesia" },
      { name: "BNI", icon: "Landmark", classification: "liquid", badge: "BNI", description: "Bank Negara Indonesia" },
      { name: "Bank Jago", icon: "Landmark", classification: "liquid", badge: "Digital", description: "Kantong tabungan digital" },
      { name: "SeaBank", icon: "Landmark", classification: "liquid", badge: "Digital", description: "Bunga cair harian" },
      { name: "Blu", icon: "Landmark", classification: "liquid", badge: "Digital", description: "blu by BCA Digital" },
    ],
  },
  {
    id: "local_wallets",
    label: "e-Wallet Digital (IDR)",
    wallets: [
      { name: "GoPay", icon: "Smartphone", classification: "liquid", badge: "QRIS", description: "Gojek & merchant QRIS" },
      { name: "OVO", icon: "Smartphone", classification: "liquid", badge: "OVO", description: "Grab & e-commerce" },
      { name: "DANA", icon: "Smartphone", classification: "liquid", badge: "DANA", description: "e-Wallet digital serbaguna" },
      { name: "ShopeePay", icon: "Smartphone", classification: "liquid", badge: "Shopee", description: "Belanja online" },
    ],
  },
  {
    id: "global",
    label: "Global & Multi-Currency (USD/EUR)",
    wallets: [
      { name: "PayPal", icon: "Smartphone", classification: "liquid", badge: "USD", description: "Global checkout & freelance" },
      { name: "Wise", icon: "Globe", classification: "liquid", badge: "Multi", description: "Multi-currency borderless account" },
      { name: "Revolut", icon: "Globe", classification: "liquid", badge: "Multi", description: "Global card & exchange" },
    ],
  },
  {
    id: "investments",
    label: "Investasi & Vault",
    wallets: [
      { name: "Global Brokerage", icon: "TrendingUp", classification: "investment", badge: "US Stocks", description: "IBKR, Charles Schwab, ETF" },
      { name: "Saham IDX", icon: "TrendingUp", classification: "investment", badge: "IDX", description: "Pasar modal Indonesia" },
      { name: "Crypto / USDT", icon: "Coins", classification: "investment", badge: "Web3", description: "Binance, cold storage & USDT" },
      { name: "Reksa Dana", icon: "PiggyBank", classification: "investment", badge: "Mutual Funds", description: "Bibit, Bareksa & pasar uang" },
    ],
  },
];

export const FALLBACK_WALLETS: Wallet[] = [
  {
    id: "fallback-0-cash",
    user_id: "default",
    name: "Cash",
    icon: "Banknote",
    classification: "liquid",
    created_at: new Date().toISOString(),
  },
];

export const AVAILABLE_WALLET_ICONS = [
  "Banknote",
  "Landmark",
  "Smartphone",
  "CreditCard",
  "Globe",
  "Coins",
  "PiggyBank",
  "TrendingUp",
  "HandCoins",
  "Scale",
  "Vault",
  "Wallet",
  "Building2",
  "Receipt",
];

export function useEnsureDefaultWallets() {
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
          .from("wallets")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);
        // Only seed on brand new user with 0 wallets. Never restore deleted wallets.
        if (!existing || existing.length === 0) {
          await supabase.from("wallets").insert(
            DEFAULT_WALLETS.map((name) => ({
              name,
              icon: getWalletIcon(name),
              user_id: user.id,
            })),
          );
        }
      } catch (e) {
        console.warn("useEnsureDefaultWallets caught error:", e);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallets"] }),
  });
}

import { useAuth } from "../contexts/AuthContext";
import { format } from "date-fns";
import { TX_BACKUP_STORAGE_KEY } from "./useTransactions";
import type { Transaction } from "../lib/types";

function withTimeout<T>(promise: PromiseLike<T>, ms = 6000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Wallets fetch timeout after ${ms}ms`)), ms),
    ),
  ]);
}

export const WALLETS_BACKUP_STORAGE_KEY = "TROUVAILLE_WALLETS_BACKUP_V1";

export interface OnboardingWalletChoice {
  name: string;
  icon: string;
  classification: AccountClassification;
}

export async function seedOnboardingWallets(
  userId: string | undefined,
  selectedWallets: OnboardingWalletChoice[],
  initialBalance?: number,
  isIndonesian: boolean = false,
): Promise<Wallet[]> {
  const isGuest =
    !userId ||
    userId === "guest_local_user" ||
    localStorage.getItem("trouvaille_guest_mode") === "true";
  const now = new Date().toISOString();
  const fullIsoOccurredOn = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
  const initialNote = isIndonesian
    ? "Saldo Awal Pembukaan Akun"
    : "Initial Starting Balance";

  const seeded: Wallet[] = selectedWallets.map((w) => ({
    id: generateUUID(),
    user_id: isGuest ? "guest_local_user" : userId!,
    name: w.name,
    icon: w.icon || getWalletIcon(w.name),
    classification: w.classification,
    created_at: now,
  }));

  if (isGuest) {
    try {
      localStorage.setItem(WALLETS_BACKUP_STORAGE_KEY, JSON.stringify(seeded));
    } catch (e) {
      console.warn("[seedOnboardingWallets] Local storage error:", e);
    }

    if (initialBalance && initialBalance > 0 && seeded.length > 0) {
      const primaryWallet = seeded[0];
      const initialTx: Transaction = {
        id: `tx-init-balance-${Date.now()}`,
        user_id: "guest_local_user",
        type: "adjustment",
        amount: initialBalance,
        occurred_on: fullIsoOccurredOn,
        created_at: now,
        note: initialNote,
        wallet_id: primaryWallet.id,
        to_wallet_id: null,
        category_id: null,
      };
      try {
        let existingTxs: Transaction[] = [];
        const raw = localStorage.getItem(TX_BACKUP_STORAGE_KEY);
        if (raw) existingTxs = JSON.parse(raw);
        if (!Array.isArray(existingTxs)) existingTxs = [];
        existingTxs.unshift(initialTx);
        localStorage.setItem(TX_BACKUP_STORAGE_KEY, JSON.stringify(existingTxs));
      } catch (e) {
        console.warn("[seedOnboardingWallets] Failed to store initial tx:", e);
      }
    }
  } else if (userId) {
    try {
      const { data: existingWallets } = await supabase
        .from("wallets")
        .select("id, name")
        .eq("user_id", userId);

      // If user already has wallets in cloud, NEVER inject default wallets
      if (existingWallets && existingWallets.length > 0) {
        return seeded;
      }

      const walletsToInsert = seeded;

      let error = null;
      if (walletsToInsert.length > 0) {
        const res = await supabase
          .from("wallets")
          .insert(
            walletsToInsert.map((w) => ({
              id: w.id,
              user_id: userId,
              name: w.name,
              icon: w.icon,
            })),
          );
        error = res.error;
      }

      if (!error && initialBalance && initialBalance > 0 && seeded.length > 0) {
        const primaryWallet = seeded[0];
        await supabase.from("transactions").insert({
          id: generateUUID(),
          user_id: userId,
          type: "adjustment",
          amount: initialBalance,
          occurred_on: fullIsoOccurredOn,
          note: initialNote,
          wallet_id: primaryWallet.id,
          category_id: null,
        });
      }
    } catch (e) {
      console.warn("[seedOnboardingWallets] Supabase insert warning:", e);
    }
  }

  return seeded;
}

export function useWallets() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: walletKeys.all(userId),
    queryFn: async () => {
      if (!userId) return [];
      if (userId === "guest_local_user") {
        try {
          const cached = localStorage.getItem(WALLETS_BACKUP_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((w: Wallet) => ({
                ...w,
                classification: resolveWalletClassification(w),
              }));
            }
          }
        } catch {}
        return FALLBACK_WALLETS;
      }
      try {
        const query = supabase
          .from("wallets")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        const { data, error } = await withTimeout(query, 6000);
        if (error) throw error;

        const seen = new Set<string>();
        const unique: Wallet[] = [];
        ((data as Wallet[]) || []).forEach((w) => {
          const k = w.name.trim().toLowerCase();
          if (!seen.has(k)) {
            seen.add(k);
            const resolvedIcon =
              !w.icon || w.icon === "/icons/wallet.png"
                ? getWalletIcon(w.name)
                : w.icon;
            const resolvedClassification = resolveWalletClassification(w);
            unique.push({
              ...w,
              icon: resolvedIcon,
              classification: resolvedClassification,
            });
          }
        });

        if (unique.length > 0) {
          try {
            localStorage.setItem(WALLETS_BACKUP_STORAGE_KEY, JSON.stringify(unique));
          } catch {}
        }
        return unique;
      } catch (err) {
        console.warn("[useWallets] Fetch failed, restoring from backup/fallback:", err);
        try {
          const cached = localStorage.getItem(WALLETS_BACKUP_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((w: Wallet) => ({
                ...w,
                classification: resolveWalletClassification(w),
              }));
            }
          }
        } catch {}
        return FALLBACK_WALLETS;
      }
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useAddWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (w: {
      name: string;
      icon?: string;
      classification?: AccountClassification;
    }) => {
      const finalIcon = w.icon || getWalletIcon(w.name);
      const resolvedClassification =
        w.classification || resolveWalletClassification({ name: w.name });

      // 1. Guest / Offline Mode check
      let isGuest = false;
      let authUser: any = null;
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        authUser = session?.user;
        if (
          !authUser ||
          authUser.id === "guest_local_user" ||
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("trouvaille_guest_mode") === "true")
        ) {
          isGuest = true;
        }
      } catch {
        isGuest = true;
      }

      if (isGuest || !authUser) {
        const guestWallet: Wallet = {
          id: generateUUID(),
          user_id: authUser?.id || "guest_local_user",
          name: w.name.trim(),
          icon: finalIcon,
          classification: resolvedClassification,
          created_at: new Date().toISOString(),
        };

        try {
          const raw = localStorage.getItem(WALLETS_BACKUP_STORAGE_KEY);
          const list = raw ? JSON.parse(raw) : [];
          if (Array.isArray(list)) {
            list.push(guestWallet);
            localStorage.setItem(WALLETS_BACKUP_STORAGE_KEY, JSON.stringify(list));
          }
        } catch {}

        saveWalletClassification(guestWallet.id, resolvedClassification);
        saveWalletClassification(guestWallet.name, resolvedClassification);
        return guestWallet;
      }

      // 2. Authenticated Cloud Mode with local offline fallback
      let created: Wallet;
      const trimmedName = w.name.trim();

      // Duplicate pre-check: Return existing wallet if identical name exists
      const { data: existingDup } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", authUser.id)
        .ilike("name", trimmedName)
        .limit(1);

      if (existingDup && existingDup.length > 0) {
        return existingDup[0] as Wallet;
      }

      try {
        const { data, error } = await supabase
          .from("wallets")
          .insert({
            name: trimmedName,
            icon: finalIcon,
            user_id: authUser.id,
            classification: resolvedClassification,
          })
          .select()
          .single();
        if (error) throw error;
        created = data as Wallet;
      } catch (cloudErr) {
        // Safe fallback if 'classification' column is not yet migrated in Supabase
        try {
          const { data, error } = await supabase
            .from("wallets")
            .insert({ name: trimmedName, icon: finalIcon, user_id: authUser.id })
            .select()
            .single();
          if (error) throw error;
          created = data as Wallet;
        } catch (fallbackErr) {
          console.warn("[useAddWallet] Cloud insert failed, saving to local backup:", fallbackErr);
          const localFallback: Wallet = {
            id: generateUUID(),
            user_id: authUser.id,
            name: w.name.trim(),
            icon: finalIcon,
            classification: resolvedClassification,
            created_at: new Date().toISOString(),
          };
          try {
            const raw = localStorage.getItem(WALLETS_BACKUP_STORAGE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            if (Array.isArray(list)) {
              list.push(localFallback);
              localStorage.setItem(WALLETS_BACKUP_STORAGE_KEY, JSON.stringify(list));
            }
          } catch {}
          saveWalletClassification(localFallback.id, resolvedClassification);
          saveWalletClassification(localFallback.name, resolvedClassification);
          return localFallback;
        }
      }

      saveWalletClassification(created.id, resolvedClassification);
      saveWalletClassification(created.name, resolvedClassification);
      return { ...created, classification: resolvedClassification };
    },
    onSuccess: (newWallet) => {
      qc.setQueriesData<Wallet[]>({ queryKey: ["wallets"] }, (old) => {
        if (!old) return [newWallet];
        return [...old.filter((w) => w.id !== newWallet.id), newWallet];
      });
      qc.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

export function useUpdateWallet() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async ({
      id,
      name,
      icon,
      classification,
    }: {
      id: string;
      name: string;
      icon?: string;
      classification?: AccountClassification;
    }) => {
      const payload: any = { name };
      if (icon) payload.icon = icon;
      else payload.icon = getWalletIcon(name);
      if (classification) payload.classification = classification;

      let updated: Wallet;
      try {
        let q = supabase
          .from("wallets")
          .update(payload)
          .eq("id", id);
        if (userId && userId !== "guest_local_user") {
          q = q.eq("user_id", userId);
        }
        const { data, error } = await q.select().single();
        if (error) throw error;
        updated = data as Wallet;
      } catch {
        // Safe fallback if 'classification' column does not exist yet
        delete payload.classification;
        let q = supabase
          .from("wallets")
          .update(payload)
          .eq("id", id);
        if (userId && userId !== "guest_local_user") {
          q = q.eq("user_id", userId);
        }
        const { data, error } = await q.select().single();
        if (error) throw error;
        updated = data as Wallet;
      }

      if (classification) {
        saveWalletClassification(id, classification);
        saveWalletClassification(name, classification);
      }
      const finalClassification =
        classification || resolveWalletClassification(updated);
      return { ...updated, classification: finalClassification };
    },
    onSuccess: (updated) => {
      qc.setQueriesData<Wallet[]>({ queryKey: ["wallets"] }, (old) => {
        if (!old) return [];
        return old.map((w) => (w.id === updated.id ? updated : w));
      });
      qc.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

export function useDeleteWallet() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { count, error: refError } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .or(`wallet_id.eq.${id},to_wallet_id.eq.${id}`);

      if (refError) throw refError;
      if ((count || 0) > 0) {
        throw new Error(
          "Wallet is currently used by transactions. Please reassign or delete its transactions first.",
        );
      }

      let q = supabase.from("wallets").delete().eq("id", id);
      if (userId && userId !== "guest_local_user") {
        q = q.eq("user_id", userId);
      }
      const { error } = await q;
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      qc.setQueriesData<Wallet[]>({ queryKey: ["wallets"] }, (old) => {
        if (!old) return [];
        return old.filter((w) => w.id !== deletedId);
      });
      qc.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

export function resolveTransactionWallets(
  tx: { wallet_id?: string | null; to_wallet_id?: string | null },
  walletsOrMap: Wallet[] | Map<string, Wallet>,
): { from: string; to: string } {
  const isMap = walletsOrMap instanceof Map;
  const getWallet = (id: string): Wallet | undefined =>
    isMap ? walletsOrMap.get(id) : walletsOrMap.find((w) => w.id === id);

  let fromName: string | undefined;
  let toName: string | undefined;

  if (tx.wallet_id) {
    const found = getWallet(tx.wallet_id);
    if (found) fromName = found.name;
  }
  if (tx.to_wallet_id) {
    const found = getWallet(tx.to_wallet_id);
    if (found) toName = found.name;
  }

  return { from: fromName || "Cash", to: toName || "Cash" };
}
