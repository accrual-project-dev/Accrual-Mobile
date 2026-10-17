import { describe, it, expect } from "vitest";
import {
  encryptVault,
  decryptVault,
  restoreVaultData,
  uint8ToHex,
  hexToUint8,
  uint8ToBase64,
  base64ToUint8,
  type TrouvailleVaultData,
} from "../src/lib/vaultEncryption";
import {
  doesTransactionMatchResetPeriod,
  getResetPeriodDateBounds,
} from "../src/hooks/useResetTransactions";

describe("vaultEncryption", () => {
  const sampleVaultData: TrouvailleVaultData = {
    version: 1,
    exportedAt: "2026-09-09T12:00:00.000Z",
    transactions: [
      {
        id: "tx-1",
        user_id: "user-123",
        amount: 50000,
        type: "expense",
        category_id: "cat-1",
        wallet_id: "w-1",
        to_wallet_id: null,
        note: "Kopi Kenangan",
        occurred_on: "2026-09-09",
        created_at: "2026-09-09T10:00:00.000Z",
      },
      {
        id: "tx-2",
        user_id: "user-123",
        amount: 15000000,
        type: "income",
        category_id: "cat-2",
        wallet_id: "w-1",
        to_wallet_id: null,
        note: "Monthly Salary",
        occurred_on: "2026-09-01",
        created_at: "2026-09-01T08:00:00.000Z",
      },
    ],
    wallets: [
      {
        id: "w-1",
        user_id: "user-123",
        name: "BCA",
        icon: "credit-card",
        created_at: "2026-01-01T00:00:00.000Z",
        classification: "liquid",
      },
    ],
    categories: [
      {
        id: "cat-1",
        user_id: "user-123",
        name: "Kopi",
        emoji: "☕",
        type: "expense",
        is_default: true,
        created_at: "2026-01-01T00:00:00.000Z",
        cashflow_nature: "operating",
      },
      {
        id: "cat-2",
        user_id: "user-123",
        name: "Gaji",
        emoji: "💰",
        type: "income",
        is_default: true,
        created_at: "2026-01-01T00:00:00.000Z",
        cashflow_nature: "operating",
      },
    ],
    bills: [
      {
        id: "bill-1",
        user_id: "user-123",
        title: "Internet WiFi",
        amount: 350000,
        due_date: "2026-09-25",
        repeat_rule: "monthly",
        is_paid: false,
        note: "Indihome",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    goals: [
      {
        id: "goal-1",
        title: "Emergency Fund",
        targetAmount: 50000000,
        currentAmount: 20000000,
        icon: "shield",
        color: "#10b981",
      },
    ],
    budgetTarget: 7500000,
    shortcuts: [
      {
        id: "s1",
        title: "Coffee",
        amount: 25000,
        wallet_id: "w-1",
        category_id: "cat-1",
        type: "expense",
        note: "Coffee",
      },
    ],
    debts: [
      {
        id: "debt-1",
        type: "receivable",
        personName: "Budi",
        totalAmount: 1000000,
        remainingAmount: 500000,
        dueDate: "2026-10-30",
        createdDate: "2026-09-01",
        note: "Pinjaman modal",
        status: "unpaid",
        walletId: "w-1",
        isAdministrativeOnly: false,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        repayments: [
          {
            id: "rep-1",
            amount: 500000,
            date: "2026-09-15",
            note: "Cicilan 1",
            walletId: "w-1",
            createdAt: "2026-09-15T10:00:00.000Z",
          },
        ],
      },
    ],
  };

  it("should encrypt and decrypt a complete vault payload round-trip with high fidelity", async () => {
    const passphrase = "TrouvailleLuxuryKey#2026!";
    const encrypted = await encryptVault(sampleVaultData, passphrase);

    expect(encrypted.format).toBe("accrual-vault");
    expect(encrypted.version).toBe(1);
    expect(encrypted.cipher).toBe("AES-GCM-256");
    expect(encrypted.kdf).toBe("PBKDF2-SHA256");
    expect(encrypted.iterations).toBe(100_000);
    expect(encrypted.metadata.itemCounts.transactions).toBe(2);
    expect(encrypted.metadata.itemCounts.wallets).toBe(1);
    expect(encrypted.metadata.itemCounts.categories).toBe(2);
    expect(encrypted.metadata.itemCounts.bills).toBe(1);
    expect(encrypted.metadata.itemCounts.goals).toBe(1);
    expect(encrypted.metadata.itemCounts.debts).toBe(1);

    // Decrypt back
    const decrypted = await decryptVault(encrypted, passphrase);

    expect(decrypted.transactions).toHaveLength(2);
    expect(decrypted.transactions[0].note).toBe("Kopi Kenangan");
    expect(decrypted.wallets[0].name).toBe("BCA");
    expect(decrypted.categories[0].name).toBe("Kopi");
    expect(decrypted.bills[0].title).toBe("Internet WiFi");
    expect(decrypted.goals[0].title).toBe("Emergency Fund");
    expect(decrypted.budgetTarget).toBe(7500000);
    expect(decrypted.shortcuts?.[0].title).toBe("Coffee");
    expect(decrypted.debts).toHaveLength(1);
    expect(decrypted.debts?.[0].personName).toBe("Budi");
  });

  it("should decrypt legacy format trouvaille-vault payload with 100% backward compatibility", async () => {
    const passphrase = "LegacyKey2026!";
    const encrypted = await encryptVault(sampleVaultData, passphrase);
    const legacyPayload = {
      ...encrypted,
      format: "trouvaille-vault" as const,
    };

    const decrypted = await decryptVault(legacyPayload, passphrase);
    expect(decrypted.transactions).toHaveLength(2);
    expect(decrypted.wallets[0].name).toBe("BCA");
    expect(decrypted.debts).toHaveLength(1);
  });

  it("should reject decryption with an incorrect passphrase", async () => {
    const passphrase = "CorrectSecretPassword123";
    const encrypted = await encryptVault(sampleVaultData, passphrase);

    await expect(
      decryptVault(encrypted, "WrongPassword456"),
    ).rejects.toThrow(/Decryption failed|Incorrect passphrase/);
  });

  it("should detect ciphertext tampering and reject decryption", async () => {
    const passphrase = "TamperResistanceTest#99";
    const encrypted = await encryptVault(sampleVaultData, passphrase);

    // Modify one base64 character in the ciphertext
    const rawBytes = base64ToUint8(encrypted.ciphertext);
    rawBytes[rawBytes.length - 1] ^= 0xff; // Flip bits in the auth tag
    const tamperedCiphertext = uint8ToBase64(rawBytes);

    const tamperedPayload = {
      ...encrypted,
      ciphertext: tamperedCiphertext,
    };

    await expect(
      decryptVault(tamperedPayload, passphrase),
    ).rejects.toThrow(/Decryption failed|corrupted/);
  });

  it("should detect SHA-256 checksum tampering and reject compromised vault", async () => {
    const passphrase = "ChecksumVerificationTest";
    const encrypted = await encryptVault(sampleVaultData, passphrase);

    const tamperedPayload = {
      ...encrypted,
      checksum: "0000000000000000000000000000000000000000000000000000000000000000",
    };

    await expect(
      decryptVault(tamperedPayload, passphrase),
    ).rejects.toThrow(/Integrity check failed/);
  });

  it("should generate cryptographically unique salts, IVs, and ciphertexts for identical inputs", async () => {
    const passphrase = "MasterPassphrase";
    const enc1 = await encryptVault(sampleVaultData, passphrase);
    const enc2 = await encryptVault(sampleVaultData, passphrase);

    expect(enc1.salt).not.toBe(enc2.salt);
    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it("should accept serialized JSON string input for decryptVault", async () => {
    const passphrase = "StringInputTest";
    const encrypted = await encryptVault(sampleVaultData, passphrase);
    const jsonString = JSON.stringify(encrypted);

    const decrypted = await decryptVault(jsonString, passphrase);
    expect(decrypted.transactions).toHaveLength(2);
    expect(decrypted.wallets[0].name).toBe("BCA");
  });

  it("should validate byte conversion utilities correctly", () => {
    const sampleBytes = new Uint8Array([0, 15, 16, 255, 128, 64]);
    const hex = uint8ToHex(sampleBytes);
    expect(hex).toBe("000f10ff8040");
    const restoredFromHex = hexToUint8(hex);
    expect(Array.from(restoredFromHex)).toEqual([0, 15, 16, 255, 128, 64]);

    const base64 = uint8ToBase64(sampleBytes);
    const restoredFromBase64 = base64ToUint8(base64);
    expect(Array.from(restoredFromBase64)).toEqual([0, 15, 16, 255, 128, 64]);
  });

  it("should restore vault data into local storage when in Guest/Offline Mode", async () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, val);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      configurable: true,
      writable: true,
    });

    localStorage.setItem("trouvaille_guest_mode", "true");
    localStorage.removeItem("TROUVAILLE_TX_BACKUP_V1");
    localStorage.removeItem("TROUVAILLE_WALLETS_BACKUP_V1");
    localStorage.removeItem("TROUVAILLE_CATEGORIES_BACKUP_V1");

    const stages: string[] = [];
    const result = await restoreVaultData(sampleVaultData, {
      mode: "replace",
      isIndonesian: true,
      onProgress: (p) => stages.push(p.stage),
    });

    expect(result.restoredTransactions).toBe(2);
    expect(result.restoredWallets).toBe(1);
    expect(result.restoredCategories).toBe(2);
    expect(result.restoredGoals).toBe(1);
    expect(result.restoredDebts).toBe(1);
    expect(stages.some((s) => s.includes("Pemulihan selesai"))).toBe(true);

    const savedTxs = JSON.parse(
      localStorage.getItem("TROUVAILLE_TX_BACKUP_V1") || "[]",
    );
    expect(savedTxs).toHaveLength(2);

    const savedDebts = JSON.parse(
      localStorage.getItem("trouvaille_debt_receivables_guest_v1") || "[]",
    );
    expect(savedDebts).toHaveLength(1);
    expect(savedDebts[0].personName).toBe("Budi");
  });

  it("should accurately match full ISO timestamps (YYYY-MM-DDTHH:mm:ss) in doesTransactionMatchResetPeriod (Rule 8.1)", () => {
    const refNow = new Date(2026, 8, 30, 15, 30, 0); // 2026-09-30 15:30:00
    const bounds = getResetPeriodDateBounds("today", refNow);
    expect(bounds).toEqual({ startDate: "2026-09-30", endDate: "2026-09-30" });

    // Full ISO timestamp on today must match "today", "week", "month", "year", "all"
    expect(
      doesTransactionMatchResetPeriod("2026-09-30T14:25:00", "today", refNow),
    ).toBe(true);
    expect(
      doesTransactionMatchResetPeriod("2026-09-30T23:59:59", "week", refNow),
    ).toBe(true);
    expect(
      doesTransactionMatchResetPeriod("2026-09-30T08:00:00", "month", refNow),
    ).toBe(true);
    expect(
      doesTransactionMatchResetPeriod("2026-09-30T08:00:00", "year", refNow),
    ).toBe(true);

    // Previous day in same week matches "week" and "month", but not "today"
    expect(
      doesTransactionMatchResetPeriod("2026-09-28T19:10:00", "today", refNow),
    ).toBe(false);
    expect(
      doesTransactionMatchResetPeriod("2026-09-28T19:10:00", "week", refNow),
    ).toBe(true);
  });
});

