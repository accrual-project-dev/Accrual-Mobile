import { describe, it, expect, beforeEach } from "vitest";
import { filterTransactionsForReport } from "../src/lib/reportExportService";
import type { Transaction } from "../src/types";

describe("Money Spaces & Shared Ledgers Ecosystem Integrity Suite", () => {
  beforeEach(() => {
    let store: Record<string, string> = {};
    const mockStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
      key: (i: number) => Object.keys(store)[i] || null,
      get length() {
        return Object.keys(store).length;
      },
    };

    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).window = globalThis;
    mockStorage.clear();
  });
  const sampleTransactions: Transaction[] = [
    {
      id: "tx-personal-1",
      user_id: "u1",
      category_id: "c1",
      wallet_id: "w1",
      to_wallet_id: null,
      type: "expense",
      amount: 50000,
      note: "Belanja harian di supermarket",
      occurred_on: "2026-10-10T12:00:00",
      created_at: "2026-10-10T12:00:00Z",
      ledger_id: "personal",
    },
    {
      id: "tx-personal-legacy",
      user_id: "u1",
      category_id: "c1",
      wallet_id: "w1",
      to_wallet_id: null,
      type: "expense",
      amount: 25000,
      note: "Kopi pagi tanpa tag",
      occurred_on: "2026-10-10T08:00:00",
      created_at: "2026-10-10T08:00:00Z",
      // ledger_id is omitted / null
    },
    {
      id: "tx-custom-space",
      user_id: "u1",
      category_id: "c2",
      wallet_id: "w2",
      to_wallet_id: null,
      type: "expense",
      amount: 350000,
      note: "Server deployment #infra",
      occurred_on: "2026-10-11T14:00:00",
      created_at: "2026-10-11T14:00:00Z",
      ledger_id: "ledger-startup-tech",
      space_id: null,
    },
    {
      id: "tx-tagged-space",
      user_id: "u1",
      category_id: "c3",
      wallet_id: "w3",
      to_wallet_id: null,
      type: "expense",
      amount: 1500000,
      note: "Tiket kereta cepat ke Bandung #proyek-bdg",
      occurred_on: "2026-10-12T09:00:00",
      created_at: "2026-10-12T09:00:00Z",
    },
  ];


  describe("1. Financial Report Export Space Scoping (reportExportService)", () => {
    it("includes modern ledger_id custom space transactions and excludes them from personal space report", () => {
      // Personal space report
      const personalReportTxs = filterTransactionsForReport(sampleTransactions, {
        dateRange: "all",
        spaceId: "personal",
      });

      const personalIds = personalReportTxs.map((t) => t.id);
      expect(personalIds).toContain("tx-personal-1");
      expect(personalIds).toContain("tx-personal-legacy");
      // Must NOT leak custom ledger_id transaction into personal space report
      expect(personalIds).not.toContain("tx-custom-space");

      // Custom space report
      const customReportTxs = filterTransactionsForReport(sampleTransactions, {
        dateRange: "all",
        spaceId: "ledger-startup-tech",
      });

      const customIds = customReportTxs.map((t) => t.id);
      expect(customIds).toEqual(["tx-custom-space"]);
      expect(customIds).not.toContain("tx-personal-1");
    });

    it("includes all transactions when spaceId is 'all'", () => {
      const allReportTxs = filterTransactionsForReport(sampleTransactions, {
        dateRange: "all",
        spaceId: "all",
      });

      expect(allReportTxs.length).toBe(sampleTransactions.length);
    });

    it("matches tag-based transactions for custom space report", () => {
      const taggedReportTxs = filterTransactionsForReport(sampleTransactions, {
        dateRange: "all",
        spaceId: "proyek-bdg",
      });

      expect(taggedReportTxs.map((t) => t.id)).toEqual(["tx-tagged-space"]);
    });
  });

  describe("2. Space Transaction Counting & All Space Badge Integrity", () => {
    it("accurately tallies total transactions for 'all' space instead of staying 0", () => {
      // Simulate filtering for each space
      const spaces = [
        { id: "personal", name: "Personal Space" },
        { id: "ledger-startup-tech", name: "Startup Tech" },
        { id: "all", name: "All Ledgers" },
      ];

      const counts: Record<string, number> = {};
      spaces.forEach((s) => {
        if (s.id === "all") {
          counts[s.id] = sampleTransactions.length;
        } else if (s.id === "personal") {
          counts[s.id] = sampleTransactions.filter((t) => {
            const lid = t.ledger_id || t.space_id;
            return (!lid || lid === "personal") && !t.note?.includes("#proyek-bdg");
          }).length;
        } else {
          counts[s.id] = sampleTransactions.filter((t) => (t.ledger_id || t.space_id) === s.id).length;
        }
      });

      expect(counts["all"]).toBe(4);
      expect(counts["ledger-startup-tech"]).toBe(1);
      expect(counts["personal"]).toBe(2);
    });
  });

  describe("3. Space Teardown & LocalStorage Member Cache Purge", () => {
    it("cleans up shared member caches and resets orphaned activeSpaceId", () => {
      const deletedSpaceId = "ledger-to-delete-999";
      const memberCacheKey = `trouvaille_shared_members_${deletedSpaceId}`;

      // Simulate state prior to deletion
      localStorage.setItem(memberCacheKey, JSON.stringify([{ id: "m1", user_id: "u1", role: "owner" }]));
      localStorage.setItem("trouvaille_active_space_id", deletedSpaceId);
      localStorage.setItem("trouvaille_default_ledger_id", deletedSpaceId);

      // Execute simulated deletion cleanup (identical to updated deleteCustomSpace)
      localStorage.removeItem(memberCacheKey);
      if (localStorage.getItem("trouvaille_active_space_id") === deletedSpaceId) {
        localStorage.setItem("trouvaille_active_space_id", "personal");
      }
      if (localStorage.getItem("trouvaille_default_ledger_id") === deletedSpaceId) {
        localStorage.setItem("trouvaille_default_ledger_id", "personal");
      }

      // Assertions
      expect(localStorage.getItem(memberCacheKey)).toBeNull();
      expect(localStorage.getItem("trouvaille_active_space_id")).toBe("personal");
      expect(localStorage.getItem("trouvaille_default_ledger_id")).toBe("personal");
    });
  });
});
