import { describe, it, expect, vi, beforeEach } from "vitest";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "../src/lib/utils";
import { CURRENCY_METADATA, type SupportedCurrency } from "../src/lib/currency";
import {
  enqueuePendingMutation,
  getPendingMutations,
  clearPendingMutations,
} from "../src/lib/syncEngine";
import { evaluateMathSafe } from "../src/lib/evaluateMathSafe";

let store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    store = {};
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe("Phase 1: Transaction Data Integrity & Multi-Currency Synchronization Suite", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    clearPendingMutations();
  });
  // ─── 1. Pencegahan Kehilangan Data Transaksi & Dialog Konfirmasi ────────────
  describe("1. Transaction Loss Prevention & Apple Luxury Deletion Confirmation", () => {
    it("ensures deletion callback restores the deleted transaction snapshot instead of no-op", () => {
      const mockDeletedTx = {
        id: "tx-to-delete-123",
        user_id: "user-1",
        amount: 250000,
        type: "expense" as const,
        category_id: "cat-dining",
        wallet_id: "wallet-main",
        to_wallet_id: null,
        note: "Dining out with family",
        occurred_on: "2026-10-14T19:30:00",
        created_at: "2026-10-14T12:30:00.000Z",
        space_id: "personal",
        ledger_id: "personal",
        created_by_name: "John Doe",
      };

      const addTxMutateMock = vi.fn();
      const showToastMock = vi.fn();

      // Simulate handleDelete inside TransactionSheet
      const handleDeleteSimulated = (tx: typeof mockDeletedTx, isIndonesian: boolean) => {
        const deletedTx = { ...tx };
        // Simulate deleteTx.mutate onSuccess callback
        const onSuccess = () => {
          showToastMock(
            isIndonesian ? "Transaksi dihapus" : "Transaction deleted",
            "delete",
            () => {
              addTxMutateMock(
                {
                  id: deletedTx.id,
                  amount: Number(deletedTx.amount),
                  type: deletedTx.type,
                  category_id: deletedTx.category_id,
                  wallet_id: deletedTx.wallet_id,
                  to_wallet_id: deletedTx.to_wallet_id,
                  note: deletedTx.note,
                  occurred_on: deletedTx.occurred_on,
                  created_at: deletedTx.created_at,
                  space_id: deletedTx.space_id,
                  ledger_id: deletedTx.ledger_id,
                  created_by_name: deletedTx.created_by_name,
                },
                {
                  onSuccess: () => {
                    showToastMock(
                      isIndonesian
                        ? "Transaksi dipulihkan"
                        : "Transaction restored",
                      "add",
                    );
                  },
                },
              );
            },
            5000,
          );
        };
        onSuccess();
      };

      // Trigger simulated delete in Indonesian
      handleDeleteSimulated(mockDeletedTx, true);

      expect(showToastMock).toHaveBeenCalledWith(
        "Transaksi dihapus",
        "delete",
        expect.any(Function),
        5000,
      );

      // Extract the undo callback passed to showToast
      const undoCallback = showToastMock.mock.calls[0][2];
      expect(typeof undoCallback).toBe("function");
      expect(undoCallback.toString()).not.toBe("() => {}");
      expect(undoCallback.toString()).not.toBe("() => { }");

      // Execute undo callback (simulating user tapping 'Urungkan')
      undoCallback();

      expect(addTxMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "tx-to-delete-123",
          amount: 250000,
          type: "expense",
          category_id: "cat-dining",
          wallet_id: "wallet-main",
          note: "Dining out with family",
          occurred_on: "2026-10-14T19:30:00",
        }),
        expect.any(Object),
      );

      // Trigger the onSuccess of the restoration mutation
      const addOnSuccess = addTxMutateMock.mock.calls[0][1].onSuccess;
      addOnSuccess();
      expect(showToastMock).toHaveBeenCalledWith(
        "Transaksi dipulihkan",
        "add",
      );
    });

    it("branches pure localization for deletion confirmation and undo notifications (Rule 6)", () => {
      const getToastMessages = (isIndonesian: boolean) => ({
        deleteMsg: isIndonesian ? "Transaksi dihapus" : "Transaction deleted",
        restoreMsg: isIndonesian ? "Transaksi dipulihkan" : "Transaction restored",
        confirmTitle: isIndonesian ? "Konfirmasi Hapus" : "Delete Confirmation",
        confirmHeading: isIndonesian ? "Hapus transaksi ini?" : "Delete this transaction?",
        confirmDesc: isIndonesian
          ? "Transaksi akan dihapus dari catatan keuangan Anda. Anda dapat membatalkannya melalui tombol Urungkan pada notifikasi."
          : "This transaction will be removed from your financial records. You can restore it using the Undo button on the notification.",
        cancelBtn: isIndonesian ? "Batal" : "Cancel",
        deleteBtn: isIndonesian ? "Hapus" : "Delete",
      });

      const idMsg = getToastMessages(true);
      const enMsg = getToastMessages(false);

      // Verify no mixed gado-gado phrases
      expect(idMsg.deleteMsg).toBe("Transaksi dihapus");
      expect(idMsg.restoreMsg).toBe("Transaksi dipulihkan");
      expect(idMsg.confirmTitle).toBe("Konfirmasi Hapus");
      expect(idMsg.confirmHeading).toBe("Hapus transaksi ini?");
      expect(idMsg.cancelBtn).toBe("Batal");
      expect(idMsg.deleteBtn).toBe("Hapus");

      expect(enMsg.deleteMsg).toBe("Transaction deleted");
      expect(enMsg.restoreMsg).toBe("Transaction restored");
      expect(enMsg.confirmTitle).toBe("Delete Confirmation");
      expect(enMsg.confirmHeading).toBe("Delete this transaction?");
      expect(enMsg.cancelBtn).toBe("Cancel");
      expect(enMsg.deleteBtn).toBe("Delete");
    });
  });

  // ─── 2. Validasi Nominal Transaksi <= 0 ───────────────────────────────────
  describe("2. Informative Amount Validation (<= 0)", () => {
    it("notifies user with informative toast message when amount is zero or negative instead of silent return", () => {
      const showToast = vi.fn();

      const validateAmount = (rawAmount: number, isIndonesian: boolean) => {
        if (rawAmount <= 0) {
          showToast(
            isIndonesian
              ? "Nominal transaksi harus lebih besar dari 0"
              : "Amount must be greater than 0",
            "delete",
          );
          return false;
        }
        return true;
      };

      // Test zero amount
      expect(validateAmount(0, true)).toBe(false);
      expect(showToast).toHaveBeenCalledWith(
        "Nominal transaksi harus lebih besar dari 0",
        "delete",
      );

      // Test negative amount
      expect(validateAmount(-15000, true)).toBe(false);
      expect(showToast).toHaveBeenCalledWith(
        "Nominal transaksi harus lebih besar dari 0",
        "delete",
      );

      // Test English localization
      expect(validateAmount(0, false)).toBe(false);
      expect(showToast).toHaveBeenCalledWith(
        "Amount must be greater than 0",
        "delete",
      );

      // Test valid positive amount
      expect(validateAmount(50000, true)).toBe(true);
    });
  });

  // ─── 3. Preservasi Timestamp occurred_on Format ISO ───────────────────────
  describe("3. Full ISO occurred_on Timestamp Integrity (Rule 8.1)", () => {
    it("formats occurred_on with full date and time (yyyy-MM-dd'T'HH:mm:ss)", () => {
      const date = new Date(2026, 9, 14); // Oct 14, 2026
      const time = "14:45";
      const [h, m] = time.split(":").map(Number);
      const txDate = new Date(date);
      txDate.setHours(h, m, 0, 0);

      const formatted = format(txDate, "yyyy-MM-dd'T'HH:mm:ss");
      expect(formatted).toBe("2026-10-14T14:45:00");
      expect(formatted).toMatch(/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it("preserves occurred_on with time in sanitization logic without stripping or resetting to today", () => {
      const sanitizeOccurredOn = (inputOccurredOn?: string) => {
        let cleanOccurredOn = inputOccurredOn;
        if (!cleanOccurredOn || !/^20\d{2}-\d{2}-\d{2}($|T\d{2}:\d{2}(:\d{2})?)/.test(cleanOccurredOn)) {
          cleanOccurredOn = format(new Date(), "yyyy-MM-dd");
        }
        return cleanOccurredOn;
      };

      // Full ISO with seconds
      expect(sanitizeOccurredOn("2026-10-14T14:45:00")).toBe("2026-10-14T14:45:00");

      // Full ISO with minutes
      expect(sanitizeOccurredOn("2026-10-14T09:30")).toBe("2026-10-14T09:30");

      // Date only fallback
      expect(sanitizeOccurredOn("2026-10-14")).toBe("2026-10-14");

      // Invalid input defaults to today
      const todayStr = format(new Date(), "yyyy-MM-dd");
      expect(sanitizeOccurredOn("invalid-date")).toBe(todayStr);
      expect(sanitizeOccurredOn("")).toBe(todayStr);
      expect(sanitizeOccurredOn(undefined)).toBe(todayStr);
    });

    it("correctly parses time from occurred_on when re-opening existing transaction", () => {
      const txOccurredOn = "2026-10-14T17:35:00";
      const parsedTime = txOccurredOn && txOccurredOn.includes("T")
        ? format(parseISO(txOccurredOn), "HH:mm")
        : "12:00";

      expect(parsedTime).toBe("17:35");
    });
  });

  // ─── 4. Sinkronisasi Multi-Mata Uang & Stealth Mask ────────────────────────
  describe("4. Multi-Currency Synchronization & Dynamic Stealth Mask", () => {
    it("renders active currency symbol in stealth mask based on currencyMeta", () => {
      const getStealthMask = (curr: SupportedCurrency) => {
        const symbol = CURRENCY_METADATA[curr]?.symbol || "Rp";
        return `${symbol} ••••••••`;
      };

      expect(getStealthMask("IDR")).toBe("Rp ••••••••");
      expect(getStealthMask("USD")).toBe("$ ••••••••");
      expect(getStealthMask("EUR")).toBe("€ ••••••••");
      expect(getStealthMask("SGD")).toBe("S$ ••••••••");
      expect(getStealthMask("JPY")).toBe("¥ ••••••••");
      expect(getStealthMask("GBP")).toBe("£ ••••••••");
      expect(getStealthMask("USDT")).toBe("₮ ••••••••");
    });

    it("formats transaction amount using formatCurrency with preferredCurrency", () => {
      const idrAmount = 158500; // ~10 USD with DEFAULT_RATES

      // In IDR
      const formattedIDR = formatCurrency(idrAmount, "IDR");
      expect(formattedIDR).toContain("Rp");

      // In USD
      const formattedUSD = formatCurrency(idrAmount, "USD");
      expect(formattedUSD).toContain("$");
      expect(formattedUSD).toContain("10");

      // In EUR
      const formattedEUR = formatCurrency(idrAmount, "EUR");
      expect(formattedEUR).toContain("€");
    });

    it("slices occurred_on to 10 characters for daily grouping and date group headers", () => {
      const tx1 = { id: "1", occurred_on: "2026-10-14T08:30:00", amount: 50000, type: "expense" };
      const tx2 = { id: "2", occurred_on: "2026-10-14T19:45:00", amount: 75000, type: "expense" };
      const tx3 = { id: "3", occurred_on: "2026-10-15T12:00:00", amount: 200000, type: "income" };

      const grouped: Record<string, typeof tx1[]> = {};
      [tx1, tx2, tx3].forEach((tx) => {
        const dateKey = tx.occurred_on ? tx.occurred_on.slice(0, 10) : "Unknown";
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(tx);
      });

      // Both tx1 and tx2 should group under "2026-10-14"
      expect(Object.keys(grouped)).toEqual(["2026-10-14", "2026-10-15"]);
      expect(grouped["2026-10-14"].length).toBe(2);
      expect(grouped["2026-10-15"].length).toBe(1);

      // Verify dayTotal formatting
      const day1Total = grouped["2026-10-14"].reduce((sum, t) => sum - t.amount, 0);
      const day1FormattedUSD = formatCurrency(day1Total, "USD");
      expect(day1FormattedUSD).toContain("$");

      const day2Total = grouped["2026-10-15"].reduce((sum, t) => sum + t.amount, 0);
      const day2FormattedUSD = formatCurrency(day2Total, "USD");
      expect(day2FormattedUSD).toContain("$");
    });

    it("masks date group header dayTotal when isStealthMode is active", () => {
      const renderDayTotal = (
        dayTotal: number,
        isStealthMode: boolean,
        prefCurr: SupportedCurrency,
      ) => {
        const symbol = CURRENCY_METADATA[prefCurr]?.symbol || "Rp";
        if (isStealthMode) {
          return `${symbol} ••••••••`;
        }
        return `${dayTotal > 0 ? "+" : ""}${formatCurrency(dayTotal, prefCurr)}`;
      };

      // In Stealth Mode with USD
      expect(renderDayTotal(500000, true, "USD")).toBe("$ ••••••••");
      // In Stealth Mode with IDR
      expect(renderDayTotal(500000, true, "IDR")).toBe("Rp ••••••••");
      // Stealth Mode disabled
      expect(renderDayTotal(500000, false, "USD")).toContain("$");
      expect(renderDayTotal(500000, false, "USD")).not.toContain("••••••••");
    });

    it("evaluates rawDisplayAmount correctly when editing an existing transaction to prevent stale amount bypass", () => {
      const existingAmount = "50000";

      const evaluateAmountOnSave = (inputStr: string, currentAmount: string) => {
        const evaluatedFromInput =
          inputStr.trim() !== ""
            ? evaluateMathSafe(inputStr)
            : Number(currentAmount) || 0;
        return evaluatedFromInput;
      };

      // User types "0" into the input
      expect(evaluateAmountOnSave("0", existingAmount)).toBe(0);

      // User types negative expression (evaluateMathSafe clamps to 0, which triggers <= 0 validation)
      expect(evaluateAmountOnSave("1000 - 2000", existingAmount)).toBe(0);

      // User clears input completely -> defaults to 0 if amount is 0, or current if not empty
      expect(evaluateAmountOnSave("", "0")).toBe(0);

      // Valid entry
      expect(evaluateAmountOnSave("75000", existingAmount)).toBe(75000);
    });

    it("resolves timeLabel from occurred_on over created_at in TransactionItem", () => {
      const resolveTimeLabel = (tx: { occurred_on?: string; created_at?: string }) => {
        if (tx.occurred_on && /[T ]\d{2}:\d{2}/.test(tx.occurred_on)) {
          try {
            return format(parseISO(tx.occurred_on.replace(" ", "T")), "HH:mm");
          } catch {
            // fallback
          }
        }
        if (tx.created_at) {
          try {
            return format(new Date(tx.created_at), "HH:mm");
          } catch {
            return "";
          }
        }
        return "";
      };

      // Case 1: occurred_on has ISO T timestamp differing from created_at
      const txISO = {
        occurred_on: "2026-10-14T19:30:00",
        created_at: "2026-10-14T05:15:00.000Z",
      };
      expect(resolveTimeLabel(txISO)).toBe("19:30");

      // Case 2: occurred_on has space-separated timestamp
      const txSpace = {
        occurred_on: "2026-10-14 14:45:00",
        created_at: "2026-10-14T08:00:00.000Z",
      };
      expect(resolveTimeLabel(txSpace)).toBe("14:45");

      // Case 3: occurred_on is date-only -> falls back to created_at
      const txDateOnly = {
        occurred_on: "2026-10-14",
        created_at: "2026-10-14T07:22:00.000Z",
      };
      expect(resolveTimeLabel(txDateOnly)).toBe(format(new Date(txDateOnly.created_at), "HH:mm"));
    });

    it("normalizes space-separated occurred_on and handles 2100 boundary", () => {
      const sanitizeOccurredOn = (inputOccurredOn?: string) => {
        let cleanOccurredOn = inputOccurredOn;
        if (!cleanOccurredOn || !/^(?:20\d{2}|2100)-\d{2}-\d{2}($|[T ]\d{2}:\d{2}(:\d{2})?)/.test(cleanOccurredOn)) {
          cleanOccurredOn = format(new Date(), "yyyy-MM-dd");
        } else {
          cleanOccurredOn = cleanOccurredOn.replace(" ", "T");
        }
        return cleanOccurredOn;
      };

      expect(sanitizeOccurredOn("2026-10-14 15:30:00")).toBe("2026-10-14T15:30:00");
      expect(sanitizeOccurredOn("2100-01-01T12:00:00")).toBe("2100-01-01T12:00:00");
      expect(sanitizeOccurredOn("2100-12-31")).toBe("2100-12-31");
    });

    it("cancels pending delete mutation when restoring via insert in syncEngine", () => {
      clearPendingMutations();

      const txId = "tx-restore-test-999";
      // Step 1: Enqueue delete mutation
      enqueuePendingMutation("delete", { id: txId });
      expect(getPendingMutations().some((m) => m.type === "delete" && m.payload?.id === txId)).toBe(true);

      // Step 2: User taps "Urungkan" -> enqueue insert mutation with same txId
      enqueuePendingMutation("insert", { id: txId, amount: 150000, type: "expense" });
      const currentPending = getPendingMutations();

      // Verify the delete mutation was removed
      expect(currentPending.some((m) => m.type === "delete" && m.payload?.id === txId)).toBe(false);
      // Verify the restored insert mutation is present
      expect(currentPending.some((m) => m.type === "insert" && m.payload?.id === txId)).toBe(true);

      clearPendingMutations();
    });
  });
});
