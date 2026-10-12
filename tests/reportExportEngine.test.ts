import { describe, it, expect } from "vitest";
import {
  filterTransactionsForReport,
  calculateReportSummary,
  generateCsvContent,
  generateJsonVaultContent,
  generateLuxuryPrintableHtml,
  type ReportFilterOptions,
} from "../src/lib/reportExportService";
import type { Transaction, Wallet, Category } from "../src/lib/types";

describe("Luxury Financial Report & Tax/Export Engine Test Suite", () => {
  const mockWallets: Wallet[] = [
    {
      id: "w-bca",
      user_id: "u1",
      name: "BCA Main",
      icon: "/icons/Budgets/BCA.png",
      balance: 15000000,
      created_at: "",
    },
    {
      id: "w-cash",
      user_id: "u1",
      name: "Cash Vault",
      icon: "/icons/Budgets/Cash.png",
      balance: 2000000,
      created_at: "",
    },
  ];

  const mockCategories: Category[] = [
    {
      id: "c-gaji",
      user_id: "u1",
      name: "Gaji",
      emoji: "Briefcase",
      type: "income",
      is_default: true,
      created_at: "",
    },
    {
      id: "c-makan",
      user_id: "u1",
      name: "Makanan",
      emoji: "Utensils",
      type: "expense",
      is_default: true,
      created_at: "",
    },
    {
      id: "c-transport",
      user_id: "u1",
      name: "Transportasi",
      emoji: "Car",
      type: "expense",
      is_default: true,
      created_at: "",
    },
  ];

  const refNow = new Date("2026-09-20T12:00:00Z");

  const mockTransactions: Transaction[] = [
    // Current month income
    {
      id: "tx-1",
      user_id: "u1",
      amount: 25000000,
      type: "income",
      category_id: "c-gaji",
      wallet_id: "w-bca",
      occurred_on: "2026-09-01",
      created_at: "2026-09-01T08:00:00Z",
      categories: { name: "Gaji", emoji: "Briefcase", type: "income" },
      note: "Salary Monthly",
      space_id: "personal",
    },
    // Current month expense personal
    {
      id: "tx-2",
      user_id: "u1",
      amount: 150000,
      type: "expense",
      category_id: "c-makan",
      wallet_id: "w-cash",
      occurred_on: "2026-09-05",
      created_at: "2026-09-05T12:30:00Z",
      categories: { name: "Makanan", emoji: "Utensils", type: "expense" },
      note: "Dinner with friends",
      space_id: "personal",
    },
    // Current month business tax-deductible expense
    {
      id: "tx-3",
      user_id: "u1",
      amount: 1200000,
      type: "expense",
      category_id: "c-transport",
      wallet_id: "w-bca",
      occurred_on: "2026-09-10",
      created_at: "2026-09-10T14:00:00Z",
      categories: { name: "Transportasi", emoji: "Car", type: "expense" },
      note: "Client meeting transport #business #reimburse",
      space_id: "business",
    },
    // Previous month expense
    {
      id: "tx-4",
      user_id: "u1",
      amount: 500000,
      type: "expense",
      category_id: "c-makan",
      wallet_id: "w-bca",
      occurred_on: "2026-08-15",
      created_at: "2026-08-15T19:00:00Z",
      categories: { name: "Makanan", emoji: "Utensils", type: "expense" },
      note: "August dining",
      space_id: "personal",
    },
  ];

  describe("Transaction Filtering Engine", () => {
    it("filters by 'this_month' accurately", () => {
      const opts: ReportFilterOptions = { dateRange: "this_month" };
      const filtered = filterTransactionsForReport(mockTransactions, opts, refNow);
      expect(filtered.length).toBe(3);
      expect(filtered.some((t) => t.id === "tx-4")).toBe(false);
    });

    it("filters by 'last_month' accurately", () => {
      const opts: ReportFilterOptions = { dateRange: "last_month" };
      const filtered = filterTransactionsForReport(mockTransactions, opts, refNow);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("tx-4");
    });

    it("filters by space scope: business (#business)", () => {
      const opts: ReportFilterOptions = { dateRange: "all", spaceId: "business" };
      const filtered = filterTransactionsForReport(mockTransactions, opts, refNow);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("tx-3");
    });

    it("filters by transaction type: 'expense'", () => {
      const opts: ReportFilterOptions = { dateRange: "all", transactionType: "expense" };
      const filtered = filterTransactionsForReport(mockTransactions, opts, refNow);
      expect(filtered.length).toBe(3);
      expect(filtered.every((t) => t.type === "expense")).toBe(true);
    });
  });

  describe("Executive Summary Calculator", () => {
    it("calculates totals, net savings, and category rankings", () => {
      const opts: ReportFilterOptions = { dateRange: "this_month" };
      const filtered = filterTransactionsForReport(mockTransactions, opts, refNow);
      const summary = calculateReportSummary(filtered, opts, mockWallets, true, refNow);

      expect(summary.totalIncome).toBe(25000000);
      expect(summary.totalExpense).toBe(1350000); // 150.000 + 1.200.000
      expect(summary.netCashflow).toBe(23650000);
      expect(summary.transactionCount).toBe(3);
      expect(summary.savingsRate).toBeGreaterThan(90);
      expect(summary.topCategories.length).toBe(2);
      expect(summary.topCategories[0].name).toBe("Transportasi"); // 1.200.000 > 150.000
    });
  });

  describe("CSV Generation", () => {
    it("produces valid UTF-8 BOM CSV with complete metadata", () => {
      const csv = generateCsvContent(mockTransactions, mockWallets, false);
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("Date,Time,Type,Category");
      expect(csv).toContain("Salary Monthly");
      expect(csv).toContain("BCA Main");
      expect(csv).toContain("#business #reimburse");
    });
  });

  describe("JSON Vault Generation", () => {
    it("produces structured portable JSON vault with schema version", () => {
      const opts: ReportFilterOptions = { dateRange: "all" };
      const summary = calculateReportSummary(mockTransactions, opts, mockWallets, refNow);
      const jsonStr = generateJsonVaultContent(mockTransactions, mockWallets, mockCategories, summary);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.trouvaille_vault_version).toBe("2.0");
      expect(parsed.metrics.total_income).toBe(25000000);
      expect(parsed.transactions.length).toBe(4);
      expect(parsed.accounts.length).toBe(2);
      expect(parsed.categories.length).toBe(3);
    });
  });

  describe("Printable Luxury HTML Generation", () => {
    it("generates editorial HTML document with print styles and monochrome palette", () => {
      const opts: ReportFilterOptions = { dateRange: "this_month" };
      const filtered = filterTransactionsForReport(mockTransactions, opts, refNow);
      const summary = calculateReportSummary(filtered, opts, mockWallets, refNow);
      const html = generateLuxuryPrintableHtml(filtered, summary, mockWallets);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("ACCRUAL");
      expect(html).toContain("Executive Statement");
      expect(html).toContain("TOTAL INFLOW");
      expect(html).toContain("TOTAL OUTFLOW");
      expect(html).toContain("NET CASH FLOW");
      expect(html).toContain("@media print");
      expect(html).toContain("window.print()");
    });
  });
});
