import { describe, it, expect } from "vitest";
import {
  generateLuxuryPdf,
  generateLuxuryPrintableHtml,
  calculateReportSummary,
  filterTransactionsForReport,
  resolveCurrencyFormatter,
  type ReportFilterOptions,
} from "../src/lib/reportExportService";
import { generateFinancialReportPackage } from "../src/lib/financialAccounting";
import type { Transaction, Wallet, Category } from "../src/lib/types";

describe("Financial Reports, Balance Sheet & Export Ecosystem Integrity Test Suite", () => {
  const mockWallets: Wallet[] = [
    {
      id: "w-bca",
      user_id: "u-auditor",
      name: "BCA Priority",
      type: "bank",
      balance: 120_000_000,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "w-usd",
      user_id: "u-auditor",
      name: "Wise USD Holding",
      type: "bank",
      balance: 15_000_000,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "w-crypto",
      user_id: "u-auditor",
      name: "Binance USDT Vault",
      type: "investment",
      balance: 45_000_000,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "w-cc",
      user_id: "u-auditor",
      name: "BCA Visa Infinite",
      type: "credit_card",
      balance: 8_500_000,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "w-kpr",
      user_id: "u-auditor",
      name: "KPR CIMB Niaga",
      type: "loan",
      balance: 350_000_000,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  const mockCategories: Category[] = [
    {
      id: "c-salary",
      user_id: "u-auditor",
      name: "Executive Compensation",
      type: "income",
      is_default: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "c-living",
      user_id: "u-auditor",
      name: "Private Living & Estate",
      type: "expense",
      is_default: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "c-travel",
      user_id: "u-auditor",
      name: "Business Travel",
      type: "expense",
      is_default: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: "tx-inc-1",
      user_id: "u-auditor",
      amount: 85_000_000,
      type: "income",
      category_id: "c-salary",
      wallet_id: "w-bca",
      occurred_on: "2026-09-02T09:00:00",
      created_at: "2026-09-02T09:00:00Z",
      categories: { name: "Executive Compensation", type: "income" },
      note: "Monthly Executive Advisory Retainer",
      space_id: "personal",
    },
    {
      id: "tx-exp-1",
      user_id: "u-auditor",
      amount: 12_500_000,
      type: "expense",
      category_id: "c-living",
      wallet_id: "w-bca",
      occurred_on: "2026-09-10T14:30:00",
      created_at: "2026-09-10T14:30:00Z",
      categories: { name: "Private Living & Estate", type: "expense" },
      note: "Residence Management",
      space_id: "personal",
    },
    {
      id: "tx-exp-2",
      user_id: "u-auditor",
      amount: 6_000_000,
      type: "expense",
      category_id: "c-travel",
      wallet_id: "w-cc",
      occurred_on: "2026-09-15T18:00:00",
      created_at: "2026-09-15T18:00:00Z",
      categories: { name: "Business Travel", type: "expense" },
      note: "Flight Tickets",
      space_id: "personal",
    },
  ];

  it("1. resolveCurrencyFormatter correctly resolves custom formatter or falls back to IDR", () => {
    // Default fallback
    const defaultFmt = resolveCurrencyFormatter();
    expect(defaultFmt(15000000)).toMatch(/Rp/);

    // Custom USD formatter injection
    const customUsdFmt = (v: number) => `$${v.toLocaleString("en-US")}`;
    const resolvedCustom = resolveCurrencyFormatter({
      formatCurrency: customUsdFmt,
      preferredCurrency: "USD",
    });
    expect(resolvedCustom(12500000)).toBe("$12,500,000");
  });

  it("2. generateLuxuryPrintableHtml honors injected multi-currency formatter", () => {
    const filterOptions: ReportFilterOptions = {
      dateRange: "all",
      spaceId: "all",
      spaceName: "All Spaces",
      transactionType: "all",
      formatCurrency: (v: number) => `$${v.toLocaleString("en-US")}`,
      preferredCurrency: "USD",
    };

    const summary = calculateReportSummary(mockTransactions, filterOptions, mockWallets, false);
    const html = generateLuxuryPrintableHtml(mockTransactions, summary, mockWallets, false, filterOptions);

    // Verify USD signs are rendered in key executive metrics instead of hardcoded Rp
    expect(html).toContain("+$85,000,000");
    expect(html).toContain("-$18,500,000");
    expect(html).toContain("+$66,500,000");
    // Should NOT contain Rupiah in USD mode
    expect(html).not.toContain("Rp 85.000.000");
  });

  it("3. generateLuxuryPdf renders multi-currency symbols without crash", () => {
    const filterOptions: ReportFilterOptions = {
      dateRange: "all",
      spaceId: "all",
      spaceName: "Family Office",
      transactionType: "all",
      formatCurrency: (v: number) => `USD ${v.toLocaleString("en-US")}`,
      preferredCurrency: "USD",
    };

    const summary = calculateReportSummary(mockTransactions, filterOptions, mockWallets, false);

    // Should generate a valid jsPDF document
    const doc = generateLuxuryPdf(
      mockTransactions,
      summary,
      mockWallets,
      mockCategories,
      false, // English
      mockTransactions,
      filterOptions
    );

    expect(doc).toBeDefined();
    // Verify pages were generated (at least 3 pages: Cover/Neraca, Arus Kas & CaLK, Ledger)
    expect(doc.internal.pages.length).toBeGreaterThanOrEqual(3);
  });

  it("4. Strict Non-Mixed Localization: Indonesian HTML & PDF outputs contain zero English leaks", () => {
    const filterOptions: ReportFilterOptions = {
      dateRange: "all",
      spaceId: "all",
      spaceName: "Pribadi",
      transactionType: "all",
    };

    const summary = calculateReportSummary(mockTransactions, filterOptions, mockWallets, true);
    const html = generateLuxuryPrintableHtml(mockTransactions, summary, mockWallets, true, filterOptions);

    // In Indonesian mode, executive terms must be pure Indonesian
    expect(html).toContain("TOTAL PEMASUKAN");
    expect(html).toContain("TOTAL PENGELUARAN");
    expect(html).toContain("ARUS KAS BERSIH");
    expect(html).toContain("Laporan Eksekutif");
    expect(html).toContain("Tabel Transaksi");

    // Pure Indonesian should not leak English equivalents
    expect(html).not.toContain("TOTAL INFLOW");
    expect(html).not.toContain("TOTAL OUTFLOW");
    expect(html).not.toContain(">Transactions Table<");
  });

  it("5. Strict Non-Mixed Localization: English HTML & PDF outputs contain zero Indonesian leaks", () => {
    const filterOptions: ReportFilterOptions = {
      dateRange: "all",
      spaceId: "all",
      spaceName: "Private Portfolio",
      transactionType: "all",
    };

    const summary = calculateReportSummary(mockTransactions, filterOptions, mockWallets, false);
    const html = generateLuxuryPrintableHtml(mockTransactions, summary, mockWallets, false, filterOptions);

    // In English mode, executive terms must be pure English
    expect(html).toContain("TOTAL INFLOW");
    expect(html).toContain("TOTAL OUTFLOW");
    expect(html).toContain("NET CASH FLOW");
    expect(html).toContain("Executive Statement");
    expect(html).toContain("Transactions Table");

    // Pure English should not leak Indonesian equivalents
    expect(html).not.toContain("TOTAL PEMASUKAN");
    expect(html).not.toContain("TOTAL PENGELUARAN");
    expect(html).not.toContain(">Tabel Transaksi<");
  });

  it("6. Rule 8.3 Invariant: Balance sheet lists all accounts across classes without omission", () => {
    const pkg = generateFinancialReportPackage(mockWallets, mockTransactions, mockCategories, {
      periodLabel: "Full Year 2026",
    });

    const { balanceSheet } = pkg;
    expect(balanceSheet).toBeDefined();

    // Verify all active wallets appear across asset and liability classes
    const allAccountIdsInNeraca = [
      ...balanceSheet.liquidAssets.items.map((i) => i.id),
      ...balanceSheet.investmentAssets.items.map((i) => i.id),
      ...balanceSheet.receivableAssets.items.map((i) => i.id),
      ...balanceSheet.currentLiabilities.items.map((i) => i.id),
      ...balanceSheet.longTermLiabilities.items.map((i) => i.id),
    ];

    expect(allAccountIdsInNeraca).toContain("w-bca");
    expect(allAccountIdsInNeraca).toContain("w-usd");
    expect(allAccountIdsInNeraca).toContain("w-crypto");
    expect(allAccountIdsInNeraca).toContain("w-cc");
    expect(allAccountIdsInNeraca).toContain("w-kpr");

    // Total assets must equal sum of liquid + investment + receivables
    expect(balanceSheet.totalAssets).toBe(
      balanceSheet.liquidAssets.total +
      balanceSheet.investmentAssets.total +
      balanceSheet.receivableAssets.total
    );
    // Total liabilities must equal sum of current + long term
    expect(balanceSheet.totalLiabilities).toBe(
      balanceSheet.currentLiabilities.total +
      balanceSheet.longTermLiabilities.total
    );
    // Net worth = Assets - Liabilities and Neraca is 100% balanced
    expect(balanceSheet.netWorth).toBe(balanceSheet.totalAssets - balanceSheet.totalLiabilities);
    expect(balanceSheet.isBalanced).toBe(true);
    expect(balanceSheet.discrepancy).toBe(0);
  });
});
