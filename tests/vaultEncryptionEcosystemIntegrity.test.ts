import { describe, it, expect } from "vitest";
import {
  encryptVault,
  decryptVault,
  restoreVaultData,
  validateVaultData,
  parseVaultFile,
  type TrouvailleVaultData,
  type EncryptedVaultPayload,
} from "../src/lib/vaultEncryption";
import { getDebtStorageKey, getDebtReceivables } from "../src/lib/debtReceivableEngine";
import * as fs from "fs";
import * as path from "path";

describe("Vault Encryption Ecosystem & Integrity Tests (Audit #25)", () => {
  const mockVaultDataWithDebts: TrouvailleVaultData = {
    version: 1,
    exportedAt: "2026-10-17T15:00:00.000Z",
    transactions: [
      {
        id: "tx-test-1",
        user_id: "user-1",
        amount: 150000,
        type: "expense",
        category_id: "cat-1",
        wallet_id: "w-old-1",
        to_wallet_id: null,
        note: "Dinner with team",
        occurred_on: "2026-10-17T19:30:00",
        created_at: "2026-10-17T19:30:00.000Z",
      },
    ],
    wallets: [
      {
        id: "w-old-1",
        user_id: "user-1",
        name: "Main Savings",
        icon: "wallet",
        classification: "liquid",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    categories: [
      {
        id: "cat-1",
        user_id: "user-1",
        name: "Food & Dining",
        emoji: "utensils",
        type: "expense",
        is_default: true,
        created_at: "2026-01-01T00:00:00.000Z",
        cashflow_nature: "operating",
      },
    ],
    bills: [],
    goals: [],
    budgetTarget: 10000000,
    shortcuts: [],
    debts: [
      {
        id: "debt-test-1",
        type: "debt",
        personName: "Alexander",
        totalAmount: 5000000,
        remainingAmount: 3000000,
        dueDate: "2026-12-31",
        createdDate: "2026-10-01",
        note: "Loan for laptop",
        walletId: "w-old-1",
        status: "unpaid",
        isAdministrativeOnly: false,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        repayments: [
          {
            id: "rep-test-1",
            amount: 2000000,
            date: "2026-10-15",
            walletId: "w-old-1",
            note: "First installment",
            createdAt: "2026-10-15T12:00:00.000Z",
          },
        ],
      },
    ],
  };

  it("should encrypt vault data with format accrual-vault and preserve debts in metadata envelope", async () => {
    const passphrase = "AccrualSecretPassphrase!2026";
    const encrypted = await encryptVault(mockVaultDataWithDebts, passphrase);

    expect(encrypted.format).toBe("accrual-vault");
    expect(encrypted.version).toBe(1);
    expect(encrypted.cipher).toBe("AES-GCM-256");
    expect(encrypted.kdf).toBe("PBKDF2-SHA256");
    expect(encrypted.iterations).toBe(100_000);
    expect(encrypted.metadata.itemCounts.transactions).toBe(1);
    expect(encrypted.metadata.itemCounts.wallets).toBe(1);
    expect(encrypted.metadata.itemCounts.categories).toBe(1);
    expect(encrypted.metadata.itemCounts.debts).toBe(1);

    const decrypted = await decryptVault(encrypted, passphrase);
    expect(decrypted.debts).toHaveLength(1);
    expect(decrypted.debts?.[0].personName).toBe("Alexander");
    expect(decrypted.debts?.[0].remainingAmount).toBe(3000000);
    expect(decrypted.debts?.[0].repayments).toHaveLength(1);
    expect(decrypted.debts?.[0].repayments?.[0].amount).toBe(2000000);
  });

  it("should reject vault files with invalid format", async () => {
    const invalidPayload: any = {
      format: "unknown-vault",
      version: 1,
      ciphertext: "abc",
      iv: "123",
      salt: "456",
    };

    await expect(decryptVault(invalidPayload, "some-pass")).rejects.toThrow(
      /Unrecognized vault format: Must be a \.accrual or \.trouvaille backup file\./,
    );
  });

  it("should parse vault file correctly and reject invalid formats in parseVaultFile", async () => {
    const validJson = JSON.stringify({
      format: "accrual-vault",
      version: 1,
      salt: "aa",
      iv: "bb",
      ciphertext: "cc",
      checksum: "dd",
      iterations: 100000,
      metadata: { appVersion: "1.0", itemCounts: {} },
    });

    const file = new File([validJson], "backup.accrual", { type: "application/json" });
    const parsed = await parseVaultFile(file);
    expect(parsed.format).toBe("accrual-vault");

    const invalidJson = JSON.stringify({ format: "corrupted-format" });
    const invalidFile = new File([invalidJson], "corrupt.json", { type: "application/json" });
    await expect(parseVaultFile(invalidFile)).rejects.toThrow(
      /Selected file is not a valid encrypted vault backup \(\.accrual or \.trouvaille\)\./,
    );
  });

  it("should validate and normalize vault data structure with validateVaultData", () => {
    const rawData = {
      exportedAt: "2026-10-17T00:00:00.000Z",
      transactions: [{ id: "tx-1" }],
      wallets: [{ id: "w-1" }],
      categories: [{ id: "c-1" }],
      bills: [],
      goals: [],
      debts: [{ id: "d-1", personName: "Jane" } as any],
    };

    const validated = validateVaultData(rawData);
    expect(validated.transactions).toHaveLength(1);
    expect(validated.wallets).toHaveLength(1);
    expect(validated.categories).toHaveLength(1);
    expect(validated.debts).toHaveLength(1);
    expect(validated.debts?.[0].personName).toBe("Jane");
  });

  it("should restore debts into local storage and remap wallet IDs accurately", async () => {
    const storageStore = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => storageStore.get(k) ?? null,
      setItem: (k: string, v: string) => storageStore.set(k, v),
      removeItem: (k: string) => storageStore.delete(k),
      clear: () => storageStore.clear(),
      key: (i: number) => Array.from(storageStore.keys())[i] ?? null,
      get length() {
        return storageStore.size;
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      configurable: true,
      writable: true,
    });

    localStorage.setItem("trouvaille_guest_mode", "true");
    const result = await restoreVaultData(mockVaultDataWithDebts, {
      mode: "replace",
      isIndonesian: false,
    });

    expect(result.restoredDebts).toBe(1);
    const debtKey = getDebtStorageKey("guest");
    const savedDebtsRaw = localStorage.getItem(debtKey);
    expect(savedDebtsRaw).not.toBeNull();
    const savedDebts = JSON.parse(savedDebtsRaw!);
    expect(savedDebts).toHaveLength(1);
    expect(savedDebts[0].personName).toBe("Alexander");
    expect(savedDebts[0].repayments).toHaveLength(1);
  });

  it("should verify strict localization and absence of bilingual mixing in vault components", () => {
    const modalPath = path.resolve(__dirname, "../src/components/security/EncryptedVaultModal.tsx");
    const modalCode = fs.readFileSync(modalPath, "utf-8");

    // Must not contain "txs"
    expect(modalCode).not.toContain('"txs"');
    // Must contain proper Indonesian translation for transactions
    expect(modalCode).toContain('isIndonesian ? "transaksi" : "transactions"');

    const exportModalPath = path.resolve(__dirname, "../src/components/settings/DataExportVaultModal.tsx");
    const exportModalCode = fs.readFileSync(exportModalPath, "utf-8");
    // Must contain "Basis Data" for Indonesian
    expect(exportModalCode).toContain('{isIndonesian ? "Basis Data" : "Database"}');

    const sectionPath = path.resolve(__dirname, "../src/components/settings/SettingsDataVaultSection.tsx");
    const sectionCode = fs.readFileSync(sectionPath, "utf-8");
    // Must contain "Laporan & Cadangan Brankas" for Indonesian
    expect(sectionCode).toContain("Laporan & Cadangan Brankas");
  });
});
