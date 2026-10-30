// ======================================================================
// TROUVAILLE ENCRYPTED LOCAL VAULT BACKUP ENGINE
// Standard: AES-GCM-256 encryption with PBKDF2 key derivation & SHA-256 integrity verification
// ======================================================================

import type { Transaction, Wallet, Category, Bill, Goal } from "./types";
import type { Shortcut } from "../hooks/useShortcuts";
import type { DebtReceivableRecord } from "../types/debt";
import { getDebtStorageKey, saveDebtReceivables } from "./debtReceivableEngine";
import { supabase } from "./supabase";

export interface VaultItemCounts {
  transactions: number;
  wallets: number;
  categories: number;
  bills: number;
  goals: number;
  debts?: number;
}

export interface EncryptedVaultPayload {
  format: "accrual-vault" | "trouvaille-vault";
  version: 1;
  createdAt: string;
  cipher: "AES-GCM-256";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string; // hex string
  iv: string; // hex string
  ciphertext: string; // base64 string
  checksum: string; // hex string of plaintext sha256
  metadata: {
    appVersion: string;
    itemCounts: VaultItemCounts;
  };
}

export interface TrouvailleVaultData {
  version: 1;
  exportedAt: string;
  transactions: Transaction[];
  wallets: Wallet[];
  categories: Category[];
  bills: Bill[];
  goals: Goal[];
  budgetTarget?: number;
  shortcuts?: Shortcut[];
  debts?: DebtReceivableRecord[];
}

// ----------------------------------------------------------------------
// Byte conversions (Environment safe for Browser & Node/Vitest)
// ----------------------------------------------------------------------

export function uint8ToHex(arr: Uint8Array): string {
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToUint8(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return arr;
}

export function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function computeSha256(content: string | Uint8Array): Promise<string> {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", bytes as any);
  return uint8ToHex(new Uint8Array(hashBuffer));
}

// ----------------------------------------------------------------------
// Core Encryption
// ----------------------------------------------------------------------

export async function encryptVault(
  data: TrouvailleVaultData,
  passphrase: string,
): Promise<EncryptedVaultPayload> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error("A passphrase or PIN is required to encrypt the vault.");
  }

  const normalizedData: TrouvailleVaultData = {
    version: 1,
    exportedAt: data.exportedAt || new Date().toISOString(),
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    wallets: Array.isArray(data.wallets) ? data.wallets : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    bills: Array.isArray(data.bills) ? data.bills : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    budgetTarget: data.budgetTarget,
    shortcuts: Array.isArray(data.shortcuts) ? data.shortcuts : [],
    debts: Array.isArray(data.debts) ? data.debts : [],
  };

  const plainJson = JSON.stringify(normalizedData);
  const checksum = await computeSha256(plainJson);

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const iterations = 100_000;

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const aesKey = await globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const plainBytes = new TextEncoder().encode(plainJson);
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plainBytes,
  );

  return {
    format: "accrual-vault",
    version: 1,
    createdAt: new Date().toISOString(),
    cipher: "AES-GCM-256",
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: uint8ToHex(salt),
    iv: uint8ToHex(iv),
    ciphertext: uint8ToBase64(new Uint8Array(encrypted)),
    checksum,
    metadata: {
      appVersion: "2.5.0",
      itemCounts: {
        transactions: normalizedData.transactions.length,
        wallets: normalizedData.wallets.length,
        categories: normalizedData.categories.length,
        bills: normalizedData.bills.length,
        goals: normalizedData.goals.length,
        debts: normalizedData.debts?.length ?? 0,
      },
    },
  };
}

// ----------------------------------------------------------------------
// Core Decryption
// ----------------------------------------------------------------------

export async function decryptVault(
  payloadOrString: EncryptedVaultPayload | string,
  passphrase: string,
): Promise<TrouvailleVaultData> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error("A passphrase or PIN is required to decrypt the vault.");
  }

  let payload: EncryptedVaultPayload;
  if (typeof payloadOrString === "string") {
    try {
      payload = JSON.parse(payloadOrString);
    } catch {
      throw new Error("Invalid vault file: Failed to parse JSON contents.");
    }
  } else {
    payload = payloadOrString;
  }

  if (payload.format !== "accrual-vault" && payload.format !== "trouvaille-vault") {
    throw new Error("Unrecognized vault format: Must be a .accrual or .trouvaille backup file.");
  }

  if (payload.version !== 1) {
    throw new Error(`Unsupported vault version: ${payload.version}`);
  }

  const salt = hexToUint8(payload.salt);
  const iv = hexToUint8(payload.iv);
  const ciphertextBytes = base64ToUint8(payload.ciphertext);

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const aesKey = await globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: payload.iterations || 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as any },
      aesKey,
      ciphertextBytes as any,
    );
  } catch {
    throw new Error("Decryption failed: Incorrect passphrase or corrupted vault file.");
  }

  const plainJson = new TextDecoder().decode(decryptedBuffer);

  // Validate integrity checksum
  const computedChecksum = await computeSha256(plainJson);
  if (payload.checksum && computedChecksum !== payload.checksum) {
    throw new Error("Integrity check failed: Vault checksum mismatch.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(plainJson);
  } catch {
    throw new Error("Corrupted payload: Decrypted data is not valid JSON.");
  }

  return validateVaultData(parsed);
}

// ----------------------------------------------------------------------
// Schema Validation
// ----------------------------------------------------------------------

export function validateVaultData(data: any): TrouvailleVaultData {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid vault data structure.");
  }

  return {
    version: 1,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : new Date().toISOString(),
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    wallets: Array.isArray(data.wallets) ? data.wallets : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    bills: Array.isArray(data.bills) ? data.bills : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    budgetTarget: typeof data.budgetTarget === "number" ? data.budgetTarget : undefined,
    shortcuts: Array.isArray(data.shortcuts) ? data.shortcuts : [],
    debts: Array.isArray(data.debts) ? data.debts : [],
  };
}

// ----------------------------------------------------------------------
// File Helpers (Browser & Device Export/Import)
// ----------------------------------------------------------------------

export function downloadVaultFile(
  payload: EncryptedVaultPayload,
  filename?: string,
): void {
  const json = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const resolvedName = filename || `accrual_vault_${dateStr}.accrual`;
  const blob = new Blob([json], { type: "application/json" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent || "")
  ) {
    try {
      const file = new File([blob], resolvedName, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        void navigator.share({
          files: [file],
          title: resolvedName,
        }).catch(() => {});
        return;
      }
    } catch {}
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = resolvedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function parseVaultFile(file: File): Promise<EncryptedVaultPayload> {
  const text = await file.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Selected file is not valid JSON.");
  }

  if (json.format !== "accrual-vault" && json.format !== "trouvaille-vault") {
    throw new Error("Selected file is not a valid encrypted vault backup (.accrual or .trouvaille).");
  }

  return json as EncryptedVaultPayload;
}

import { setVaultItem } from "./indexedDbStorage";
import { clearPendingMutations } from "./syncEngine";
import { generateUUID } from "./utils";

export interface RestoreProgress {
  stage: string;
  progress: number; // 0 to 100
}

export interface RestoreVaultResult {
  restoredTransactions: number;
  restoredWallets: number;
  restoredCategories: number;
  restoredBills: number;
  restoredGoals: number;
  restoredDebts?: number;
}

export async function restoreVaultData(
  vaultData: TrouvailleVaultData,
  options: {
    mode: "merge" | "replace";
    isIndonesian?: boolean;
    onProgress?: (progress: RestoreProgress) => void;
  },
): Promise<RestoreVaultResult> {
  const { mode, isIndonesian = false, onProgress } = options;
  onProgress?.({
    stage: isIndonesian
      ? "Menyiapkan data brankas..."
      : "Preparing vault data...",
    progress: 5,
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const isGuestMode =
    typeof localStorage !== "undefined" &&
    localStorage.getItem("trouvaille_guest_mode") === "true";
  const userId = !isGuestMode ? session?.user?.id : undefined;

  const walletIdMap: Record<string, string> = {};
  const categoryIdMap: Record<string, string> = {};

  let restoredWallets = 0;
  let restoredCategories = 0;
  let restoredBills = 0;
  let restoredTransactions = 0;
  let restoredGoals = 0;
  let restoredDebts = 0;

  if (userId) {
    // ------------------------------------------------------------------
    // 1. Wallets (Cloud Mode)
    // ------------------------------------------------------------------
    onProgress?.({
      stage: isIndonesian ? "Memulihkan rekening..." : "Restoring wallets...",
      progress: 15,
    });
    const { data: existingWallets } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId);

    for (const vWallet of vaultData.wallets) {
      const match = existingWallets?.find(
        (w) => w.name.trim().toLowerCase() === vWallet.name.trim().toLowerCase(),
      );
      if (match) {
        walletIdMap[vWallet.id] = match.id;
      } else {
        const { data: inserted } = await supabase
          .from("wallets")
          .insert({
            user_id: userId,
            name: vWallet.name,
            icon: vWallet.icon || "/icons/Budgets/Cash.png",
            classification: vWallet.classification || "liquid",
          })
          .select()
          .single();
        if (inserted) {
          walletIdMap[vWallet.id] = inserted.id;
          restoredWallets++;
        }
      }
    }

    // ------------------------------------------------------------------
    // 2. Categories (Cloud Mode)
    // ------------------------------------------------------------------
    onProgress?.({
      stage: isIndonesian
        ? "Memulihkan kategori..."
        : "Restoring categories...",
      progress: 30,
    });
    const { data: existingCategories } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId);

    for (const vCat of vaultData.categories) {
      const match = existingCategories?.find(
        (c) =>
          c.name.trim().toLowerCase() === vCat.name.trim().toLowerCase() &&
          c.type === vCat.type,
      );
      if (match) {
        categoryIdMap[vCat.id] = match.id;
      } else {
        const { data: inserted } = await supabase
          .from("categories")
          .insert({
            user_id: userId,
            name: vCat.name,
            emoji: vCat.emoji || "file-text",
            type: vCat.type,
            is_default: vCat.is_default ?? false,
            cashflow_nature: vCat.cashflow_nature || "operating",
            budget_amount: vCat.budget_amount ?? null,
          })
          .select()
          .single();
        if (inserted) {
          categoryIdMap[vCat.id] = inserted.id;
          restoredCategories++;
        }
      }
    }

    // ------------------------------------------------------------------
    // 3. Bills (Cloud Mode)
    // ------------------------------------------------------------------
    onProgress?.({
      stage: isIndonesian
        ? "Memulihkan jadwal tagihan..."
        : "Restoring scheduled bills...",
      progress: 45,
    });
    if (mode === "replace") {
      await supabase.from("bills").delete().eq("user_id", userId);
    }

    for (const bill of vaultData.bills) {
      const { error } = await supabase.from("bills").insert({
        user_id: userId,
        title: bill.title,
        amount: bill.amount,
        due_date: bill.due_date,
        repeat_rule: bill.repeat_rule || "none",
        is_paid: !!bill.is_paid,
        note: bill.note || null,
      });
      if (!error) restoredBills++;
    }

    // ------------------------------------------------------------------
    // 4. Transactions (Cloud Mode)
    // ------------------------------------------------------------------
    onProgress?.({
      stage: isIndonesian
        ? "Memulihkan transaksi..."
        : "Restoring transactions...",
      progress: 55,
    });
    if (mode === "replace") {
      await supabase.from("transactions").delete().eq("user_id", userId);
    }

    const txsToInsert = vaultData.transactions.map((tx) => ({
      user_id: userId,
      amount: Number(tx.amount),
      type: tx.type,
      occurred_on: tx.occurred_on,
      note: tx.note || null,
      wallet_id: tx.wallet_id ? walletIdMap[tx.wallet_id] || tx.wallet_id : null,
      to_wallet_id: tx.to_wallet_id
        ? walletIdMap[tx.to_wallet_id] || tx.to_wallet_id
        : null,
      category_id: tx.category_id
        ? categoryIdMap[tx.category_id] || tx.category_id
        : null,
      created_at: tx.created_at || new Date().toISOString(),
    }));

    const batchSize = 50;
    for (let i = 0; i < txsToInsert.length; i += batchSize) {
      const chunk = txsToInsert.slice(i, i + batchSize);
      const { error } = await supabase.from("transactions").insert(chunk);
      if (!error) {
        restoredTransactions += chunk.length;
      }
      const currentProgress =
        55 + Math.round(((i + chunk.length) / txsToInsert.length) * 35);
      onProgress?.({
        stage: isIndonesian
          ? `Memulihkan transaksi (${Math.min(i + batchSize, txsToInsert.length)}/${txsToInsert.length})...`
          : `Restoring transactions (${Math.min(i + batchSize, txsToInsert.length)}/${txsToInsert.length})...`,
        progress: currentProgress,
      });
    }
  } else if (typeof localStorage !== "undefined") {
    // ------------------------------------------------------------------
    // Guest / Offline Local Mode Restoration
    // ------------------------------------------------------------------
    onProgress?.({
      stage: isIndonesian
        ? "Memulihkan rekening lokal..."
        : "Restoring local wallets...",
      progress: 20,
    });
    let localWallets: Wallet[] = [];
    if (mode === "merge") {
      try {
        const raw = localStorage.getItem("TROUVAILLE_WALLETS_BACKUP_V1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) localWallets = parsed;
        }
      } catch {}
    }

    for (const vWallet of vaultData.wallets) {
      const match = localWallets.find(
        (w) => w.name.trim().toLowerCase() === vWallet.name.trim().toLowerCase(),
      );
      if (match) {
        walletIdMap[vWallet.id] = match.id;
      } else {
        const newId = vWallet.id || generateUUID();
        walletIdMap[vWallet.id] = newId;
        localWallets.push({
          ...vWallet,
          id: newId,
          user_id: "guest_local_user",
          icon: vWallet.icon || "Banknote",
          classification: vWallet.classification || "liquid",
          created_at: vWallet.created_at || new Date().toISOString(),
        });
        restoredWallets++;
      }
    }
    try {
      localStorage.setItem(
        "TROUVAILLE_WALLETS_BACKUP_V1",
        JSON.stringify(localWallets),
      );
    } catch {}

    onProgress?.({
      stage: isIndonesian
        ? "Memulihkan kategori lokal..."
        : "Restoring local categories...",
      progress: 40,
    });
    let localCategories: Category[] = [];
    if (mode === "merge") {
      try {
        const raw = localStorage.getItem("TROUVAILLE_CATEGORIES_BACKUP_V1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) localCategories = parsed;
        }
      } catch {}
    }

    for (const vCat of vaultData.categories) {
      const match = localCategories.find(
        (c) =>
          c.name.trim().toLowerCase() === vCat.name.trim().toLowerCase() &&
          c.type === vCat.type,
      );
      if (match) {
        categoryIdMap[vCat.id] = match.id;
      } else {
        const newId = vCat.id || generateUUID();
        categoryIdMap[vCat.id] = newId;
        localCategories.push({
          ...vCat,
          id: newId,
          user_id: "guest_local_user",
          emoji: vCat.emoji || "file-text",
          is_default: vCat.is_default ?? false,
          created_at: vCat.created_at || new Date().toISOString(),
        });
        restoredCategories++;
      }
    }
    try {
      localStorage.setItem(
        "TROUVAILLE_CATEGORIES_BACKUP_V1",
        JSON.stringify(localCategories),
      );
    } catch {}

    onProgress?.({
      stage: isIndonesian
        ? "Memulihkan transaksi lokal..."
        : "Restoring local transactions...",
      progress: 70,
    });
    let existingTxs: Transaction[] = [];
    if (mode === "replace") {
      clearPendingMutations();
    } else {
      try {
        const raw = localStorage.getItem("TROUVAILLE_TX_BACKUP_V1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) existingTxs = parsed;
        }
      } catch {}
    }

    const txMap = new Map<string, Transaction>();
    for (const tx of existingTxs) {
      if (tx.id) txMap.set(tx.id, tx);
    }

    for (const tx of vaultData.transactions) {
      const mappedId = tx.id || generateUUID();
      const mappedCatId = tx.category_id
        ? categoryIdMap[tx.category_id] || tx.category_id
        : null;
      const matchedCategory =
        localCategories.find((c) => c.id === mappedCatId) ||
        tx.categories ||
        null;

      txMap.set(mappedId, {
        ...tx,
        id: mappedId,
        user_id: "guest_local_user",
        amount: Number(tx.amount),
        wallet_id: tx.wallet_id
          ? walletIdMap[tx.wallet_id] || tx.wallet_id
          : null,
        to_wallet_id: tx.to_wallet_id
          ? walletIdMap[tx.to_wallet_id] || tx.to_wallet_id
          : null,
        category_id: mappedCatId,
        categories: matchedCategory,
        created_at: tx.created_at || new Date().toISOString(),
      });
      restoredTransactions++;
    }

    const finalLocalTxs = Array.from(txMap.values()).sort((a, b) =>
      (b.occurred_on || "").localeCompare(a.occurred_on || ""),
    );
    try {
      localStorage.setItem(
        "TROUVAILLE_TX_BACKUP_V1",
        JSON.stringify(finalLocalTxs),
      );
    } catch {}
    try {
      await setVaultItem("TROUVAILLE_TX_BACKUP_V1", finalLocalTxs);
    } catch {}

    restoredBills = vaultData.bills.length;
  }

  // ------------------------------------------------------------------
  // 5. Local Storage Settings & Goals
  // ------------------------------------------------------------------
  onProgress?.({
    stage: isIndonesian
      ? "Memulihkan target & pengaturan..."
      : "Restoring financial goals & settings...",
    progress: 95,
  });
  if (vaultData.goals && vaultData.goals.length > 0) {
    try {
      localStorage.setItem(
        "trouvaille_financial_goals_v2",
        JSON.stringify(vaultData.goals),
      );
      localStorage.setItem("trouvaille_goals_initialized_v2", "true");
      restoredGoals = vaultData.goals.length;
    } catch (e) {
      console.warn("Failed to restore goals to localStorage:", e);
    }
  }

  if (typeof vaultData.budgetTarget === "number") {
    try {
      localStorage.setItem(
        "trouvaille_budget_target",
        vaultData.budgetTarget.toString(),
      );
    } catch (e) {
      console.warn("Failed to restore budget target:", e);
    }
  }

  if (vaultData.shortcuts && vaultData.shortcuts.length > 0) {
    try {
      const remappedShortcuts = vaultData.shortcuts.map((s) => ({
        ...s,
        wallet_id: s.wallet_id
          ? walletIdMap[s.wallet_id] || s.wallet_id
          : "",
        category_id: s.category_id
          ? categoryIdMap[s.category_id] || s.category_id
          : "",
      }));
      localStorage.setItem(
        "trouvaille_shortcuts",
        JSON.stringify(remappedShortcuts),
      );
    } catch (e) {
      console.warn("Failed to restore shortcuts:", e);
    }
  }

  if (vaultData.debts && vaultData.debts.length > 0) {
    try {
      const debtKey = getDebtStorageKey(userId);
      let existingDebts: DebtReceivableRecord[] = [];
      if (mode === "merge") {
        const raw = localStorage.getItem(debtKey);
        if (raw) {
          try {
            existingDebts = JSON.parse(raw) || [];
          } catch {}
        }
      }
      const debtMap = new Map<string, DebtReceivableRecord>();
      existingDebts.forEach((d) => debtMap.set(d.id, d));
      for (const d of vaultData.debts) {
        const rawWalletId = d.walletId || (d as any).wallet_id;
        const remappedWalletId = rawWalletId ? walletIdMap[rawWalletId] || rawWalletId : null;
        const remappedRepayments = (d.repayments || []).map((r) => {
          const rawRepWalletId = r.walletId || (r as any).wallet_id;
          return {
            ...r,
            walletId: rawRepWalletId ? walletIdMap[rawRepWalletId] || rawRepWalletId : null,
          };
        });
        debtMap.set(d.id, {
          ...d,
          walletId: remappedWalletId,
          repayments: remappedRepayments,
        });
        restoredDebts++;
      }
      saveDebtReceivables(Array.from(debtMap.values()), userId);
    } catch (e) {
      console.warn("Failed to restore debts to localStorage:", e);
    }
  }

  onProgress?.({
    stage: isIndonesian ? "Pemulihan selesai!" : "Restoration complete!",
    progress: 100,
  });

  return {
    restoredTransactions,
    restoredWallets,
    restoredCategories,
    restoredBills,
    restoredGoals,
    restoredDebts,
  };
}

