import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import type { Transaction, Wallet, Category } from "./types";
import { formatRupiah } from "./utils";
import { generateFinancialReportPackage } from "./financialAccounting";

export type ReportDateRange =
  | "this_month"
  | "last_month"
  | "ytd"
  | "last_year"
  | "all"
  | "custom";

export type ReportTransactionType = "all" | "expense" | "income" | "transfer";

export interface ReportFilterOptions {
  dateRange: ReportDateRange;
  customStartDate?: Date;
  customEndDate?: Date;
  spaceId?: string; // "all", "personal", or specific spaceId / tag
  spaceName?: string;
  transactionType?: ReportTransactionType;
}

export interface CategorySummaryItem {
  name: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface WalletSummaryItem {
  name: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface ReportSummary {
  periodLabel: string;
  spaceName: string;
  totalIncome: number;
  totalExpense: number;
  totalTransfer: number;
  netCashflow: number;
  savingsRate: number; // 0 to 100
  transactionCount: number;
  topCategories: CategorySummaryItem[];
  walletBreakdown: WalletSummaryItem[];
}

/**
 * Filter transactions based on date range, space, and transaction type
 */
export function filterTransactionsForReport(
  transactions: Transaction[],
  options: ReportFilterOptions,
  now = new Date(),
): Transaction[] {
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  switch (options.dateRange) {
    case "this_month":
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      break;
    case "last_month": {
      const prev = subMonths(now, 1);
      startDate = startOfMonth(prev);
      endDate = endOfMonth(prev);
      break;
    }
    case "ytd":
      startDate = startOfYear(now);
      endDate = now;
      break;
    case "last_year": {
      const prevYear = subYears(now, 1);
      startDate = startOfYear(prevYear);
      endDate = endOfYear(prevYear);
      break;
    }
    case "custom":
      startDate = options.customStartDate || startOfMonth(now);
      endDate = options.customEndDate || endOfMonth(now);
      break;
    case "all":
    default:
      startDate = null;
      endDate = null;
      break;
  }

  const startStr = startDate ? format(startDate, "yyyy-MM-dd") : null;
  const endStr = endDate ? format(endDate, "yyyy-MM-dd") : null;

  return transactions.filter((tx) => {
    const rawDate = tx.occurred_on || tx.created_at || "";
    const txDate = rawDate.slice(0, 10);
    if (!txDate) return false;

    // Date bounds (normalized to YYYY-MM-DD so full ISO timestamps on the end date are included)
    if (startStr && txDate < startStr) return false;
    if (endStr && txDate > endStr) return false;

    // Space filtering
    if (options.spaceId && options.spaceId !== "all") {
      if (options.spaceId === "personal") {
        const note = (tx.note || "").toLowerCase();
        if (tx.space_id || note.includes("#business") || note.includes("#travel") || note.includes("#kantor") || note.includes("#liburan")) {
          return false;
        }
      } else {
        const target = options.spaceId.toLowerCase().replace(/^#/, "");
        const txSpace = (tx.space_id || "").toLowerCase();
        const note = (tx.note || "").toLowerCase();
        const matchesSpace =
          txSpace === target ||
          note.includes(`#${target}`) ||
          (target === "business" && (note.includes("#kantor") || note.includes("#reimburse"))) ||
          (target === "travel" && note.includes("#liburan"));
        if (!matchesSpace) return false;
      }
    }

    // Transaction type filtering
    if (options.transactionType && options.transactionType !== "all") {
      if (tx.type !== options.transactionType) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Compute executive summary statistics
 */
export function calculateReportSummary(
  filteredTxs: Transaction[],
  options: ReportFilterOptions,
  wallets: Wallet[] = [],
  isIndonesian = true,
  now = new Date(),
): ReportSummary {
  let periodLabel = isIndonesian ? "Semua Waktu" : "All Time";
  const dateLocale = isIndonesian ? idLocale : undefined;

  switch (options.dateRange) {
    case "this_month":
      periodLabel = format(now, "MMMM yyyy", { locale: dateLocale });
      break;
    case "last_month":
      periodLabel = format(subMonths(now, 1), "MMMM yyyy", { locale: dateLocale });
      break;
    case "ytd":
      periodLabel = isIndonesian
        ? `Tahun Berjalan (${format(now, "yyyy")})`
        : `Year to Date (${format(now, "yyyy")})`;
      break;
    case "last_year":
      periodLabel = isIndonesian
        ? `Tahun Buku ${format(subYears(now, 1), "yyyy")}`
        : `Fiscal Year ${format(subYears(now, 1), "yyyy")}`;
      break;
    case "custom":
      periodLabel = `${options.customStartDate ? format(options.customStartDate, "dd MMM yyyy", { locale: dateLocale }) : isIndonesian ? "Awal" : "Start"} – ${options.customEndDate ? format(options.customEndDate, "dd MMM yyyy", { locale: dateLocale }) : isIndonesian ? "Akhir" : "End"}`;
      break;
    case "all":
      periodLabel = isIndonesian ? "Semua Riwayat Transaksi" : "Complete Transaction Archive";
      break;
  }

  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfer = 0;
  const categoryMap = new Map<string, { amount: number; count: number }>();
  const walletMap = new Map<string, { inflow: number; outflow: number }>();

  // Initialize wallet map
  wallets.forEach((w) => {
    walletMap.set(w.id, { inflow: 0, outflow: 0 });
  });

  filteredTxs.forEach((tx) => {
    const amt = tx.amount || 0;
    const catName = tx.categories?.name || (tx.type === "transfer" ? "Transfer" : "General");

    if (tx.type === "income") {
      totalIncome += amt;
      if (tx.wallet_id) {
        const cur = walletMap.get(tx.wallet_id) || { inflow: 0, outflow: 0 };
        cur.inflow += amt;
        walletMap.set(tx.wallet_id, cur);
      }
    } else if (tx.type === "expense") {
      totalExpense += amt;
      const curCat = categoryMap.get(catName) || { amount: 0, count: 0 };
      curCat.amount += amt;
      curCat.count += 1;
      categoryMap.set(catName, curCat);

      if (tx.wallet_id) {
        const cur = walletMap.get(tx.wallet_id) || { inflow: 0, outflow: 0 };
        cur.outflow += amt;
        walletMap.set(tx.wallet_id, cur);
      }
    } else if (tx.type === "transfer") {
      totalTransfer += amt;
      if (tx.wallet_id) {
        const cur = walletMap.get(tx.wallet_id) || { inflow: 0, outflow: 0 };
        cur.outflow += amt;
        walletMap.set(tx.wallet_id, cur);
      }
      if (tx.to_wallet_id) {
        const cur = walletMap.get(tx.to_wallet_id) || { inflow: 0, outflow: 0 };
        cur.inflow += amt;
        walletMap.set(tx.to_wallet_id, cur);
      }
    }
  });

  const netCashflow = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? Math.max(0, Math.min(100, Math.round((netCashflow / totalIncome) * 100))) : 0;

  // Top categories sorted by expense amount descending
  const topCategories: CategorySummaryItem[] = Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      count: data.count,
      percentage: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Wallet breakdown
  const walletBreakdown: WalletSummaryItem[] = Array.from(walletMap.entries())
    .map(([wId, data]) => {
      const wName = wallets.find((w) => w.id === wId)?.name || wId;
      return {
        name: wName,
        inflow: data.inflow,
        outflow: data.outflow,
        net: data.inflow - data.outflow,
      };
    })
    .filter((w) => w.inflow > 0 || w.outflow > 0);

  const spaceName =
    options.spaceName ||
    (!options.spaceId || options.spaceId === "all"
      ? isIndonesian
        ? "Semua Space"
        : "All Spaces"
      : options.spaceId === "personal"
        ? isIndonesian
          ? "Space Pribadi"
          : "Personal Space"
        : `#${options.spaceId}`);

  return {
    periodLabel,
    spaceName,
    totalIncome,
    totalExpense,
    totalTransfer,
    netCashflow,
    savingsRate,
    transactionCount: filteredTxs.length,
    topCategories,
    walletBreakdown,
  };
}

/**
 * Normalizes transaction date (YYYY-MM-DD) and time (HH:mm) from Full ISO occurred_on or created_at
 */
export function extractTxDateAndTime(tx: Transaction): { dateStr: string; timeStr: string } {
  const rawDate = tx.occurred_on || tx.created_at || "";
  const dateStr = rawDate.slice(0, 10);
  if (tx.occurred_on && tx.occurred_on.length >= 16 && tx.occurred_on.includes("T")) {
    return { dateStr, timeStr: tx.occurred_on.slice(11, 16) };
  }
  if (tx.created_at) {
    try {
      return { dateStr, timeStr: format(new Date(tx.created_at), "HH:mm") };
    } catch {
      return { dateStr, timeStr: "" };
    }
  }
  return { dateStr, timeStr: "" };
}

/**
 * Generate CSV formatted string with UTF-8 BOM (pure clean CSV without '#' lines)
 */
export function generateCsvContent(
  transactions: Transaction[],
  wallets: Wallet[] = [],
  isIndonesian = true,
): string {
  const headers = isIndonesian
    ? [
        "No.",
        "Tanggal",
        "Waktu",
        "Tipe",
        "Kategori",
        "Deskripsi / Catatan",
        "Akun Sumber",
        "Akun Tujuan",
        "Pemasukan (IDR)",
        "Pengeluaran (IDR)",
        "Transfer (IDR)",
        "ID Transaksi",
      ]
    : [
        "No.",
        "Date",
        "Time",
        "Type",
        "Category",
        "Description / Note",
        "Source Account",
        "Destination Account",
        "Income (IDR)",
        "Expense (IDR)",
        "Transfer (IDR)",
        "Transaction ID",
      ];

  const walletMap = new Map<string, string>();
  wallets.forEach((w) => walletMap.set(w.id, w.name));

  const sortedTxs = [...transactions].sort((a, b) => {
    const da = a.occurred_on || a.created_at || "";
    const db = b.occurred_on || b.created_at || "";
    return db.localeCompare(da);
  });

  const rows = sortedTxs.map((t, idx) => {
    const { dateStr, timeStr } = extractTxDateAndTime(t);
    const typeStr = isIndonesian
      ? t.type === "income"
        ? "Pemasukan"
        : t.type === "expense"
          ? "Pengeluaran"
          : "Transfer"
      : t.type === "income"
        ? "Income"
        : t.type === "expense"
          ? "Expense"
          : "Transfer";

    const catStr =
      t.categories?.name ||
      (t.type === "transfer" ? "Transfer" : isIndonesian ? "Umum" : "General");
    const fromAccount = t.wallet_id ? walletMap.get(t.wallet_id) || t.wallet_id : "-";
    const toAccount =
      t.type === "transfer" && t.to_wallet_id ? walletMap.get(t.to_wallet_id) || t.to_wallet_id : "-";
    const note = t.note || "";
    const cleanNote = note.replace(/"/g, '""');

    // Clean numeric output: leave blank "" for non-applicable columns instead of 0
    const incomeVal = t.type === "income" ? String(t.amount || 0) : "";
    const expenseVal = t.type === "expense" ? String(t.amount || 0) : "";
    const transferVal = t.type === "transfer" ? String(t.amount || 0) : "";

    return [
      idx + 1,
      dateStr,
      timeStr,
      typeStr,
      `"${catStr.replace(/"/g, '""')}"`,
      `"${cleanNote}"`,
      `"${fromAccount.replace(/"/g, '""')}"`,
      `"${toAccount.replace(/"/g, '""')}"`,
      incomeVal,
      expenseVal,
      transferVal,
      t.id || "",
    ].join(",");
  });

  // Include UTF-8 BOM (\uFEFF) for native Excel UTF-8 support
  return "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
}

/**
 * Generate Structured JSON Vault backup
 */
export function generateJsonVaultContent(
  transactions: Transaction[],
  wallets: Wallet[],
  categories: Category[],
  summary: ReportSummary,
): string {
  const vault = {
    trouvaille_vault_version: "2.0",
    generated_at: new Date().toISOString(),
    system: "Accrual Luxury Wealth Engine",
    scope: {
      period: summary.periodLabel,
      space: summary.spaceName,
    },
    metrics: {
      total_income: summary.totalIncome,
      total_expense: summary.totalExpense,
      total_transfer: summary.totalTransfer,
      net_cashflow: summary.netCashflow,
      savings_rate_pct: summary.savingsRate,
      transaction_count: summary.transactionCount,
    },
    accounts: wallets.map((w) => ({
      id: w.id,
      name: w.name,
      balance: w.balance || 0,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      budget_amount: c.budget_amount || 0,
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      occurred_on: t.occurred_on,
      created_at: t.created_at,
      category_name: t.categories?.name || null,
      wallet_id: t.wallet_id,
      to_wallet_id: t.to_wallet_id,
      space_id: t.space_id || null,
      note: t.note || null,
    })),
  };

  return JSON.stringify(vault, null, 2);
}

/**
 * Generate Printable Luxury HTML Report
 */
export function generateLuxuryPrintableHtml(
  transactions: Transaction[],
  summary: ReportSummary,
  wallets: Wallet[] = [],
  isIndonesian = false,
): string {
  const walletMap = new Map<string, string>();
  wallets.forEach((w) => walletMap.set(w.id, w.name));

  const sortedTxs = [...transactions].sort((a, b) => {
    const da = a.occurred_on || a.created_at || "";
    const db = b.occurred_on || b.created_at || "";
    return db.localeCompare(da);
  });

  const rowsHtml = sortedTxs
    .map((tx) => {
      const { dateStr, timeStr } = extractTxDateAndTime(tx);
      const dateDisplay = timeStr ? `${dateStr} ${timeStr}` : dateStr;
      const isExpense = tx.type === "expense";
      const isIncome = tx.type === "income";
      const sign = isIncome ? "+" : isExpense ? "-" : "⇄";
      const amtColor = isIncome ? "#0d9488" : isExpense ? "#09090c" : "#71717a";
      const cat =
        tx.categories?.name ||
        (tx.type === "transfer" ? "Transfer" : isIndonesian ? "Umum" : "General");
      const account = tx.wallet_id
        ? walletMap.get(tx.wallet_id) || (isIndonesian ? "Akun" : "Account")
        : "-";
      const toAccount = tx.to_wallet_id
        ? walletMap.get(tx.to_wallet_id) || (isIndonesian ? "Akun" : "Account")
        : "";
      const accountLabel = tx.type === "transfer" && toAccount ? `${account} → ${toAccount}` : account;
      const note = tx.note || "";

      return `
        <tr style="border-bottom: 1px solid #f0f0f4; font-size: 11px;">
          <td style="padding: 9px 8px; color: #71717a; white-space: nowrap;">${dateDisplay}</td>
          <td style="padding: 9px 8px; font-weight: 500; color: #09090c;">
            <div>${note || cat}</div>
            ${note && note !== cat ? `<div style="font-size: 10px; color: #a1a1aa;">${cat}</div>` : ""}
          </td>
          <td style="padding: 9px 8px; color: #52525b; white-space: nowrap;">${accountLabel}</td>
          <td style="padding: 9px 8px; text-align: right; font-family: -apple-system, BlinkMacSystemFont, monospace; font-weight: 600; color: ${amtColor}; white-space: nowrap;">
            ${sign} ${formatRupiah(tx.amount || 0)}
          </td>
        </tr>
      `;
    })
    .join("");

  const topCatsHtml = summary.topCategories
    .slice(0, 5)
    .map((c) => {
      return `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
            <span style="font-weight: 500; color: #18181b;">${c.name}</span>
            <span style="font-family: -apple-system, BlinkMacSystemFont, monospace; color: #71717a;">${formatRupiah(c.amount)} (${c.percentage.toFixed(1)}%)</span>
          </div>
          <div style="width: 100%; height: 5px; background: #f0f0f4; border-radius: 99px; overflow: hidden;">
            <div style="width: ${c.percentage}%; height: 100%; background: #27272a; border-radius: 99px;"></div>
          </div>
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Accrual ${isIndonesian ? "Laporan Eksekutif" : "Statement"} - ${summary.periodLabel}</title>
  <style>
    @media print {
      @page { margin: 15mm; size: A4 portrait; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #09090c;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <!-- Header Bar -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #09090c; padding-bottom: 14px; margin-bottom: 24px;">
    <div>
      <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #09090c;">ACCRUAL</div>
      <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.05em; color: #71717a; text-transform: uppercase; margin-top: 2px;">${
        isIndonesian
          ? "Arsitektur Kekayaan Privat · Laporan Eksekutif"
          : "Private Wealth Architecture · Executive Statement"
      }</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 13px; font-weight: 600; color: #09090c;">${summary.periodLabel}</div>
      <div style="font-size: 11px; color: #71717a; margin-top: 2px;">${summary.spaceName}</div>
      <div style="font-size: 10px; color: #a1a1aa; margin-top: 1px;">${
        isIndonesian ? "Dicetak pada" : "Generated on"
      } ${format(new Date(), "dd MMMM yyyy, HH:mm")}</div>
    </div>
  </div>

  <!-- Key Executive Metrics -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px;">
    <div style="background: #fafafc; border: 1px solid #e4e4e9; border-radius: 12px; padding: 14px 16px;">
      <div style="font-size: 10px; font-weight: 600; color: #71717a; letter-spacing: 0.08em; text-transform: uppercase;">${
        isIndonesian ? "TOTAL PEMASUKAN" : "TOTAL INFLOW"
      }</div>
      <div style="font-size: 18px; font-weight: 700; color: #09090c; margin-top: 5px; font-family: -apple-system, BlinkMacSystemFont, monospace;">+${formatRupiah(summary.totalIncome)}</div>
      <div style="font-size: 10px; color: #a1a1aa; margin-top: 3px;">${
        isIndonesian ? "Pemasukan & kredit" : "Income & credits"
      }</div>
    </div>

    <div style="background: #fafafc; border: 1px solid #e4e4e9; border-radius: 12px; padding: 14px 16px;">
      <div style="font-size: 10px; font-weight: 600; color: #71717a; letter-spacing: 0.08em; text-transform: uppercase;">${
        isIndonesian ? "TOTAL PENGELUARAN" : "TOTAL OUTFLOW"
      }</div>
      <div style="font-size: 18px; font-weight: 700; color: #09090c; margin-top: 5px; font-family: -apple-system, BlinkMacSystemFont, monospace;">-${formatRupiah(summary.totalExpense)}</div>
      <div style="font-size: 10px; color: #a1a1aa; margin-top: 3px;">${
        isIndonesian ? "Pengeluaran & debit" : "Expenses & debits"
      }</div>
    </div>

    <div style="background: #fafafc; border: 1px solid #e4e4e9; border-radius: 12px; padding: 14px 16px;">
      <div style="font-size: 10px; font-weight: 600; color: #71717a; letter-spacing: 0.08em; text-transform: uppercase;">${
        isIndonesian ? "ARUS KAS BERSIH" : "NET CASH FLOW"
      }</div>
      <div style="font-size: 18px; font-weight: 700; color: #09090c; margin-top: 5px; font-family: -apple-system, BlinkMacSystemFont, monospace;">${(summary.netCashflow >= 0 ? "+" : "") + formatRupiah(summary.netCashflow)}</div>
      <div style="font-size: 10px; color: #a1a1aa; margin-top: 3px;">${
        isIndonesian ? "Pergerakan modal bersih" : "Net capital movement"
      }</div>
    </div>

    <div style="background: #fafafc; border: 1px solid #e4e4e9; border-radius: 12px; padding: 14px 16px;">
      <div style="font-size: 10px; font-weight: 600; color: #71717a; letter-spacing: 0.08em; text-transform: uppercase;">${
        isIndonesian ? "RASIO TABUNGAN" : "SAVINGS RATE"
      }</div>
      <div style="font-size: 18px; font-weight: 700; color: #09090c; margin-top: 5px; font-family: -apple-system, BlinkMacSystemFont, monospace;">${summary.savingsRate.toFixed(1)}%</div>
      <div style="font-size: 10px; color: #a1a1aa; margin-top: 3px;">${
        isIndonesian ? "Rasio retensi dana" : "Preservation ratio"
      }</div>
    </div>
  </div>

  ${
    summary.topCategories.length > 0
      ? `
  <!-- Top Expense Categories Breakdown -->
  <div style="margin-bottom: 28px; background: #fafafc; border: 1px solid #e4e4e9; border-radius: 12px; padding: 16px 20px;">
    <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #09090c; margin-bottom: 12px;">${
      isIndonesian ? "Kategori Pengeluaran Terbesar" : "Top Spending Categories"
    }</div>
    ${topCatsHtml}
  </div>
  `
      : ""
  }

  <!-- Transactions Table -->
  <div style="margin-bottom: 30px;">
    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #09090c;">${
        isIndonesian ? "Tabel Transaksi" : "Transactions Table"
      }</div>
      <div style="font-size: 11px; color: #71717a;">${summary.transactionCount} ${
        isIndonesian ? "transaksi" : "records"
      }</div>
    </div>
    <table style="width: 100%; border-collapse: collapse; text-align: left;">
      <thead>
        <tr style="border-bottom: 1.5px solid #09090c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a;">
          <th style="padding: 8px; width: 85px;">${isIndonesian ? "Tanggal" : "Date"}</th>
          <th style="padding: 8px;">${isIndonesian ? "Deskripsi / Kategori" : "Description / Category"}</th>
          <th style="padding: 8px; width: 140px;">${isIndonesian ? "Akun" : "Account"}</th>
          <th style="padding: 8px; text-align: right; width: 130px;">${isIndonesian ? "Nominal" : "Amount"}</th>
        </tr>
      </thead>
      <tbody>
        ${
          rowsHtml ||
          `<tr><td colspan="4" style="padding: 24px; text-align: center; color: #a1a1aa;">${
            isIndonesian
              ? "Tidak ada transaksi ditemukan pada periode ini."
              : "No transactions found in this period."
          }</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <!-- Confidentiality Statement / Footer -->
  <div style="border-top: 1px solid #e4e4e9; padding-top: 14px; display: flex; justify-content: space-between; font-size: 10px; color: #a1a1aa;">
    <div>${
      isIndonesian ? "Accrual · Arsitektur Kekayaan Privat" : "Accrual · Private Wealth Architecture"
    }</div>
    <div>${
      isIndonesian
        ? "Dokumen Rahasia · Ikhtisar Kekayaan Eksekutif"
        : "Confidential Document · Executive Wealth Summary"
    }</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;
}

/**
 * Triggers direct luxury report printing via dedicated window/tab
 */
export function triggerPrintLuxuryReport(
  transactions: Transaction[],
  summary: ReportSummary,
  wallets: Wallet[] = [],
  isIndonesian = false,
): void {
  const html = generateLuxuryPrintableHtml(transactions, summary, wallets, isIndonesian);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    // Fallback if popups blocked: inject iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }
}

/**
 * Download a file in the browser (supports text or binary Blob)
 */
export function downloadExportFile(
  content: string | Blob,
  filename: string,
  mimeType = "text/csv;charset=utf-8;",
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share or download file with Web Share API fallback (supports text or binary Blob)
 */
export async function shareOrDownloadFile(
  content: string | Blob,
  filename: string,
  mimeType = "text/csv",
  title = "Accrual Financial Report",
): Promise<boolean> {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: `Here is the financial report export from Accrual (${filename}).`,
        });
        return true;
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.warn("[reportExportService] Web Share failed, falling back to download:", e);
      } else {
        return false;
      }
    }
  }

  // Fallback to standard download
  downloadExportFile(blob, filename, mimeType);
  return true;
}

/**
 * Helper to turn off gridlines on all sheets in generated XLSX binary
 */
function patchGridlinesInUint8Array(buffer: Uint8Array): Uint8Array {
  const target = new TextEncoder().encode('<sheetView workbookViewId="0"/>');
  const replace = new TextEncoder().encode('<sheetView showGridLines="0" />');
  const n = buffer.length;
  const m = target.length;
  for (let i = 0; i <= n - m; i++) {
    let match = true;
    for (let j = 0; j < m; j++) {
      if (buffer[i + j] !== target[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      buffer.set(replace, i);
      i += m - 1;
    }
  }
  return buffer;
}

/**
 * Generates an executive Excel workbook (.xlsx) focused 100% on the transaction ledger:
 * clean typography, column widths, separate Inflow / Outflow / Transfer columns without zero clutter,
 * and background gridlines disabled.
 */
export async function generateLuxuryExcelBlob(
  transactions: Transaction[],
  summary: ReportSummary,
  wallets: Wallet[] = [],
  categories: Category[] = [],
  isIndonesian = true,
): Promise<Blob> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const walletMap = new Map<string, string>();
  wallets.forEach((w) => walletMap.set(w.id, w.name));

  const catMap = new Map<string, string>();
  categories.forEach((c) => catMap.set(c.id, c.name));

  const sortedTxs = [...transactions].sort((a, b) => {
    const da = a.occurred_on || a.created_at || "";
    const db = b.occurred_on || b.created_at || "";
    return db.localeCompare(da);
  });

  const sheetTitle = isIndonesian ? "Catatan Transaksi" : "Transaction Records";

  // Data structure focused 100% on transaction records
  const aoaLedger: any[][] = [
    ["ACCRUAL — " + (isIndonesian ? "CATATAN TRANSAKSI" : "TRANSACTION RECORDS")],
    [
      (isIndonesian ? "Space: " : "Space: ") +
        summary.spaceName +
        "   |   " +
        (isIndonesian ? "Periode: " : "Period: ") +
        summary.periodLabel +
        "   |   " +
        (isIndonesian ? "Total Catatan: " : "Total Records: ") +
        transactions.length,
    ],
    [],
    isIndonesian
      ? [
          "No.",
          "Tanggal",
          "Waktu",
          "Tipe",
          "Kategori",
          "Deskripsi / Catatan",
          "Akun Sumber",
          "Akun Tujuan",
          "Pemasukan (IDR)",
          "Pengeluaran (IDR)",
          "Transfer (IDR)",
          "ID Transaksi",
        ]
      : [
          "No.",
          "Date",
          "Time",
          "Type",
          "Category",
          "Description / Note",
          "Source Account",
          "Destination Account",
          "Income (IDR)",
          "Expense (IDR)",
          "Transfer (IDR)",
          "Transaction ID",
        ],
  ];

  sortedTxs.forEach((t, idx) => {
    const { dateStr, timeStr } = extractTxDateAndTime(t);
    const typeStr = isIndonesian
      ? t.type === "income"
        ? "Pemasukan"
        : t.type === "expense"
          ? "Pengeluaran"
          : "Transfer"
      : t.type === "income"
        ? "Income"
        : t.type === "expense"
          ? "Expense"
          : "Transfer";

    const catStr =
      (t.category_id ? catMap.get(t.category_id) : t.categories?.name) ||
      (t.type === "transfer" ? "Transfer" : isIndonesian ? "Umum" : "General");
    const fromAccount = t.wallet_id ? walletMap.get(t.wallet_id) || t.wallet_id : "-";
    const toAccount =
      t.type === "transfer" && t.to_wallet_id ? walletMap.get(t.to_wallet_id) || t.to_wallet_id : "-";
    const note = t.note || "";

    // Numeric amounts: only assign number when applicable, otherwise empty string ""
    // Avoids zero clutter in the spreadsheet
    const incomeVal = t.type === "income" ? Number(t.amount || 0) : "";
    const expenseVal = t.type === "expense" ? Number(t.amount || 0) : "";
    const transferVal = t.type === "transfer" ? Number(t.amount || 0) : "";

    aoaLedger.push([
      idx + 1,
      dateStr,
      timeStr,
      typeStr,
      catStr,
      note,
      fromAccount,
      toAccount,
      incomeVal,
      expenseVal,
      transferVal,
      t.id || "",
    ]);
  });

  // Total summary row at bottom
  aoaLedger.push([
    isIndonesian ? "TOTAL" : "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    summary.totalIncome,
    summary.totalExpense,
    summary.totalTransfer,
    "",
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(aoaLedger);
  ws1["!cols"] = [
    { wch: 6 }, // No.
    { wch: 14 }, // Tanggal
    { wch: 8 }, // Waktu
    { wch: 14 }, // Tipe
    { wch: 22 }, // Kategori
    { wch: 38 }, // Deskripsi
    { wch: 20 }, // Akun Sumber
    { wch: 20 }, // Akun Tujuan
    { wch: 18 }, // Pemasukan
    { wch: 18 }, // Pengeluaran
    { wch: 18 }, // Transfer
    { wch: 20 }, // ID Transaksi
  ];

  // Auto-filter on row 4 (A4:L)
  ws1["!autofilter"] = { ref: `A4:L${aoaLedger.length}` };

  // Apply number format #,##0 to columns I, J, K (Pemasukan, Pengeluaran, Transfer)
  for (let r = 5; r <= aoaLedger.length; r++) {
    ["I", "J", "K"].forEach((col) => {
      const cell = ws1[`${col}${r}`];
      if (cell && typeof cell.v === "number") {
        cell.z = "#,##0";
        cell.t = "n";
      }
    });
  }

  XLSX.utils.book_append_sheet(wb, ws1, sheetTitle);

  // Generate uncompressed XLSX binary
  const rawUint8 = XLSX.write(wb, { bookType: "xlsx", type: "array", compression: false });

  // Patch all sheet views to disable gridlines (<sheetView showGridLines="0" />)
  const patchedUint8 = patchGridlinesInUint8Array(new Uint8Array(rawUint8));

  return new Blob([patchedUint8.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Direct luxury Excel (.xlsx) download
 */
export async function downloadLuxuryExcel(
  transactions: Transaction[],
  summary: ReportSummary,
  wallets: Wallet[] = [],
  categories: Category[] = [],
  filename = "accrual_catatan_transaksi.xlsx",
  isIndonesian = true,
): Promise<void> {
  const blob = await generateLuxuryExcelBlob(transactions, summary, wallets, categories, isIndonesian);

  if (Capacitor.isNativePlatform() && typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: isIndonesian ? "Catatan Transaksi Accrual" : "Accrual Transaction Records",
          text: isIndonesian
            ? `Berikut berkas catatan transaksi dari Accrual (${filename}).`
            : `Here is the transaction records export from Accrual (${filename}).`,
        });
        return;
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Direct luxury Excel (.xlsx) share with Web Share API fallback
 */
export async function shareLuxuryExcel(
  transactions: Transaction[],
  summary: ReportSummary,
  wallets: Wallet[] = [],
  categories: Category[] = [],
  filename = "accrual_catatan_transaksi.xlsx",
  isIndonesian = true,
): Promise<boolean> {
  const blob = await generateLuxuryExcelBlob(transactions, summary, wallets, categories, isIndonesian);

  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: isIndonesian ? "Catatan Transaksi Accrual" : "Accrual Transaction Records",
          text: isIndonesian
            ? `Berikut berkas catatan transaksi dari Accrual (${filename}).`
            : `Here is the transaction records export from Accrual (${filename}).`,
        });
        return true;
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.warn("[reportExportService] Web Share failed, falling back to download:", e);
      } else {
        return false;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Generates an executive luxury PDF document structured into formal wealth sections:
 * Page 1: Executive Summary, Key Metrics, Balance Sheet (Neraca) & Top Spending
 * Page 2: Statement of Cash Flows (Arus Kas) & Notes to Financial Statements (CaLK)
 * Page 3+: Paginated Ledger Transactions Table
 */
export function generateLuxuryPdf(
  transactions: Transaction[],
  summary: ReportSummary,
  wallets: Wallet[] = [],
  categories: Category[] = [],
  isIndonesian = true,
  allTransactions: Transaction[] = [],
  options?: ReportFilterOptions,
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const margin = 36;
  const contentWidth = pageWidth - margin * 2; // 523.28 pt

  let endDateStr: string | undefined;
  if (options) {
    if (options.dateRange === "custom" && options.customEndDate) {
      endDateStr = format(options.customEndDate, "yyyy-MM-dd");
    } else if (options.dateRange === "this_month") {
      endDateStr = format(endOfMonth(new Date()), "yyyy-MM-dd");
    } else if (options.dateRange === "last_month") {
      endDateStr = format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
    } else if (options.dateRange === "ytd") {
      endDateStr = format(new Date(), "yyyy-MM-dd");
    } else if (options.dateRange === "last_year") {
      endDateStr = format(endOfYear(subYears(new Date(), 1)), "yyyy-MM-dd");
    }
  }

  const effectiveAllTxs = allTransactions.length > 0 ? allTransactions : transactions;

  const reportPkg = generateFinancialReportPackage(wallets, transactions, categories, {
    periodLabel: summary.periodLabel,
    endDate: endDateStr,
    allTransactions: effectiveAllTxs,
  });
  const { balanceSheet, cashFlow, calk } = reportPkg;

  const now = new Date();
  const docRef = `REF: TVL-${format(now, "yyyyMMdd-HHmm")}`;

  // ==========================================
  // PAGE 1: Executive Statement & Neraca
  // ==========================================
  let y = 46;

  // Header Brand & Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(18, 18, 20); // obsidian
  doc.text("ACCRUAL", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 122); // zinc-500
  doc.text(
    isIndonesian
      ? "ARSITEKTUR KEKAYAAN PRIVAT · LAPORAN KEUANGAN EKSEKUTIF"
      : "PRIVATE WEALTH ARCHITECTURE · EXECUTIVE STATEMENT",
    margin,
    y + 13
  );

  // Period, Scope & Generation Date (right aligned)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27);
  doc.text(summary.periodLabel, pageWidth - margin, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 122);
  doc.text(`${summary.spaceName} · ${docRef}`, pageWidth - margin, y + 11, { align: "right" });
  doc.text(
    isIndonesian
      ? `Diterbitkan: ${format(now, "dd MMMM yyyy, HH:mm", { locale: idLocale })}`
      : `Issued: ${format(now, "dd MMMM yyyy, HH:mm:ss")}`,
    pageWidth - margin,
    y + 21,
    { align: "right" }
  );

  y += 32;

  // Hairline divider
  doc.setDrawColor(228, 228, 233);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);

  y += 18;

  // 1. Key Financial Metrics Grid (4 columns)
  const colGap = 8;
  const metricColW = (contentWidth - colGap * 3) / 4;
  const metrics = [
    {
      label: isIndonesian ? "TOTAL PEMASUKAN" : "TOTAL INFLOW",
      val: `+${formatRupiah(summary.totalIncome)}`,
      sub: isIndonesian ? "Penerimaan kas" : "Income & credits",
    },
    {
      label: isIndonesian ? "TOTAL PENGELUARAN" : "TOTAL OUTFLOW",
      val: `-${formatRupiah(summary.totalExpense)}`,
      sub: isIndonesian ? "Pengeluaran belanja" : "Expenses & debits",
    },
    {
      label: isIndonesian ? "ARUS KAS BERSIH" : "NET CASHFLOW",
      val: `${summary.netCashflow >= 0 ? "+" : ""}${formatRupiah(summary.netCashflow)}`,
      sub: isIndonesian ? "Surplus / defisit" : "Net movement",
    },
    {
      label: isIndonesian ? "RASIO TABUNGAN" : "SAVINGS RATE",
      val: `${summary.savingsRate.toFixed(1)}%`,
      sub: isIndonesian ? "Ketahanan modal" : "Preservation",
    },
  ];

  metrics.forEach((m, idx) => {
    const x = margin + idx * (metricColW + colGap);
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x, y, metricColW, 46, 5, 5, "F");
    doc.setDrawColor(235, 235, 239);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, metricColW, 46, 5, 5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(113, 113, 122);
    doc.text(m.label, x + 8, y + 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(24, 24, 27);
    doc.text(m.val, x + 8, y + 27);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(161, 161, 170);
    doc.text(m.sub, x + 8, y + 39);
  });

  y += 64;

  // 2. Neraca / Statement of Financial Position (Balance Sheet) with account breakdown
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(18, 18, 20);
  doc.text(isIndonesian ? "LAPORAN POSISI KEUANGAN (NERACA)" : "STATEMENT OF FINANCIAL POSITION", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text(
    isIndonesian
      ? `Rincian posisi saldo kas, bank, investasi, dan liabilitas per ${summary.periodLabel}`
      : `Account breakdown of cash, bank, investments, and liabilities as of ${summary.periodLabel}`,
    margin + 185,
    y
  );

  y += 12;

  const bsColW = (contentWidth - 10) / 2;
  const rightX = margin + bsColW + 10;

  // Calculate dynamic card height to display 100% of accounts without truncation
  const liquidItems = balanceSheet.liquidAssets.items;
  const investItems = balanceSheet.investmentAssets.items;
  const recItems = balanceSheet.receivableAssets.items;
  const curLiabItems = balanceSheet.currentLiabilities.items;
  const ltLiabItems = balanceSheet.longTermLiabilities.items;

  // Left card row calculations
  let leftContentH = 44; // Total assets header + divider line
  leftContentH += 11 + (liquidItems.length > 0 ? liquidItems.length * 10.5 : 10.5); // Kas & Bank header + items
  if (investItems.length > 0) {
    leftContentH += 11 + investItems.length * 10.5;
  }
  if (recItems.length > 0) {
    leftContentH += 11 + recItems.length * 10.5;
  }
  leftContentH += 10; // bottom padding

  // Right card row calculations
  let rightContentH = 44; // Total liabilities header + divider line
  rightContentH += 11 + (curLiabItems.length > 0 ? curLiabItems.length * 10.5 : 10.5); // Current liab header + items
  if (ltLiabItems.length > 0) {
    rightContentH += 11 + ltLiabItems.length * 10.5;
  }
  rightContentH += 46; // Net Worth box + divider line + padding

  const bsColH = Math.max(152, Math.max(leftContentH, rightContentH));

  // Card A: ASET (Left Card)
  doc.setFillColor(248, 248, 250);
  doc.roundedRect(margin, y, bsColW, bsColH, 5, 5, "F");
  doc.setDrawColor(235, 235, 239);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, bsColW, bsColH, 5, 5, "S");

  // Card B: LIABILITAS & KEKAYAAN BERSIH (Right Card)
  doc.setFillColor(248, 248, 250);
  doc.roundedRect(rightX, y, bsColW, bsColH, 5, 5, "F");
  doc.setDrawColor(235, 235, 239);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightX, y, bsColW, bsColH, 5, 5, "S");

  // --- Left Card Contents (ASET) ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(113, 113, 122);
  doc.text(isIndonesian ? "TOTAL ASET" : "TOTAL ASSETS", margin + 10, y + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text(formatRupiah(balanceSheet.totalAssets), margin + 10, y + 27);

  doc.setDrawColor(232, 232, 237);
  doc.setLineWidth(0.5);
  doc.line(margin + 10, y + 33, margin + bsColW - 10, y + 33);

  let leftY = y + 45;

  // Group 1: Kas & Bank (100% of accounts rendered, zero truncation)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(82, 82, 91);
  doc.text(isIndonesian ? "Aset Lancar (Kas & Bank)" : "Liquid Assets (Cash & Bank)", margin + 10, leftY);
  leftY += 11;

  if (liquidItems.length > 0) {
    liquidItems.forEach((item) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(39, 39, 42);
      doc.text(item.name.slice(0, 26), margin + 10, leftY);
      doc.setTextColor(24, 24, 27);
      doc.text(formatRupiah(item.balance), margin + bsColW - 10, leftY, { align: "right" });
      leftY += 10.5;
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(161, 161, 170);
    doc.text(isIndonesian ? "Tidak ada akun kas/bank" : "No cash/bank accounts", margin + 10, leftY);
    leftY += 10.5;
  }

  // Group 2: Investasi (100% of items rendered)
  if (investItems.length > 0) {
    leftY += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(82, 82, 91);
    doc.text(isIndonesian ? "Aset Investasi & Portofolio" : "Investments", margin + 10, leftY);
    leftY += 10;
    investItems.forEach((item) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(39, 39, 42);
      doc.text(item.name.slice(0, 26), margin + 10, leftY);
      doc.setTextColor(24, 24, 27);
      doc.text(formatRupiah(item.balance), margin + bsColW - 10, leftY, { align: "right" });
      leftY += 10.5;
    });
  }

  // Group 3: Piutang (100% of items rendered)
  if (recItems.length > 0) {
    leftY += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(82, 82, 91);
    doc.text(isIndonesian ? "Piutang" : "Receivables", margin + 10, leftY);
    leftY += 10;
    recItems.forEach((item) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(39, 39, 42);
      doc.text(item.name.slice(0, 26), margin + 10, leftY);
      doc.setTextColor(24, 24, 27);
      doc.text(formatRupiah(item.balance), margin + bsColW - 10, leftY, { align: "right" });
      leftY += 10.5;
    });
  }

  // --- Right Card Contents (LIABILITAS & KEKAYAAN BERSIH) ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(113, 113, 122);
  doc.text(isIndonesian ? "TOTAL LIABILITAS" : "TOTAL LIABILITIES", rightX + 10, y + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text(formatRupiah(balanceSheet.totalLiabilities), rightX + 10, y + 27);

  doc.setDrawColor(232, 232, 237);
  doc.setLineWidth(0.5);
  doc.line(rightX + 10, y + 33, rightX + bsColW - 10, y + 33);

  let rightY = y + 45;

  // Group 1: Liabilitas Lancar (100% of items rendered)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(82, 82, 91);
  doc.text(
    isIndonesian ? "Liabilitas Lancar (Kartu Kredit & Paylater)" : "Current Liabilities (Credit)",
    rightX + 10,
    rightY
  );
  rightY += 11;

  if (curLiabItems.length > 0) {
    curLiabItems.forEach((item) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(39, 39, 42);
      doc.text(item.name.slice(0, 26), rightX + 10, rightY);
      doc.setTextColor(24, 24, 27);
      doc.text(formatRupiah(item.balance), rightX + bsColW - 10, rightY, { align: "right" });
      rightY += 10.5;
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(161, 161, 170);
    doc.text(isIndonesian ? "Tidak ada liabilitas lancar (Rp 0)" : "No current liabilities (Rp 0)", rightX + 10, rightY);
    rightY += 10.5;
  }

  // Group 2: Liabilitas Jangka Panjang (100% of items rendered)
  if (ltLiabItems.length > 0) {
    rightY += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(82, 82, 91);
    doc.text(isIndonesian ? "Liabilitas Jangka Panjang (Pinjaman)" : "Long-Term Liabilities", rightX + 10, rightY);
    rightY += 10;
    ltLiabItems.forEach((item) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(39, 39, 42);
      doc.text(item.name.slice(0, 26), rightX + 10, rightY);
      doc.setTextColor(24, 24, 27);
      doc.text(formatRupiah(item.balance), rightX + bsColW - 10, rightY, { align: "right" });
      rightY += 10.5;
    });
  }

  // Divider above Net Worth
  const netWorthY = y + bsColH - 42;
  doc.setDrawColor(228, 228, 233);
  doc.setLineWidth(0.5);
  doc.line(rightX + 10, netWorthY, rightX + bsColW - 10, netWorthY);

  // Net Worth Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(113, 113, 122);
  doc.text(isIndonesian ? "KEKAYAAN BERSIH (EKUITAS)" : "NET WORTH (EQUITY)", rightX + 10, netWorthY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(18, 18, 20);
  doc.text(formatRupiah(balanceSheet.netWorth), rightX + 10, netWorthY + 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(113, 113, 122);
  doc.text(
    balanceSheet.isBalanced
      ? isIndonesian
        ? "100% Seimbang"
        : "100% Balanced"
      : isIndonesian
        ? `Selisih: ${formatRupiah(balanceSheet.discrepancy)}`
        : `Diff: ${formatRupiah(balanceSheet.discrepancy)}`,
    rightX + bsColW - 10,
    netWorthY + 26,
    { align: "right" }
  );

  y += bsColH + 16;

  // 3. Top Expense Distribution (Rendered on Page 1 if space permits, or dynamically moved to Page 2)
  const topSpendingNeeded =
    summary.topCategories.length > 0
      ? 14 + 14 + Math.min(5, summary.topCategories.length) * 18 + 12
      : 0;
  const bottomMarginLimit = pageHeight - margin - 15;
  const canFitTopSpendingOnPage1 = y + topSpendingNeeded <= bottomMarginLimit;

  if (summary.topCategories.length > 0 && canFitTopSpendingOnPage1) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(18, 18, 20);
    doc.text(isIndonesian ? "DISTRIBUSI PENGELUARAN TERBESAR" : "TOP EXPENSE DISTRIBUTION", margin, y);

    y += 14;

    summary.topCategories.slice(0, 5).forEach((cat) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(39, 39, 42);
      doc.text(cat.name, margin, y);

      const amtText = `${formatRupiah(cat.amount)}  (${cat.percentage.toFixed(1)}%)`;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(113, 113, 122);
      doc.text(amtText, pageWidth - margin, y, { align: "right" });

      y += 4;
      doc.setFillColor(240, 240, 244);
      doc.roundedRect(margin, y, contentWidth, 3, 1.5, 1.5, "F");

      const fillW = Math.max(3, (contentWidth * Math.min(100, cat.percentage)) / 100);
      doc.setFillColor(39, 39, 42);
      doc.roundedRect(margin, y, fillW, 3, 1.5, 1.5, "F");

      y += 14;
    });
  }

  // ==========================================
  // PAGE 2: Arus Kas & CaLK
  // ==========================================
  doc.addPage();
  y = 46;

  // Page 2 Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(18, 18, 20);
  doc.text("ACCRUAL", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 122);
  doc.text(
    isIndonesian
      ? "LAPORAN ARUS KAS & CATATAN ATAS LAPORAN KEUANGAN"
      : "STATEMENT OF CASH FLOWS & FINANCIAL NOTES",
    margin,
    y + 13
  );

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27);
  doc.text(summary.periodLabel, pageWidth - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 122);
  doc.text(`${summary.spaceName} · ${docRef}`, pageWidth - margin, y + 11, { align: "right" });

  y += 28;
  doc.setDrawColor(228, 228, 233);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);

  y += 18;

  // If Top Spending didn't fit on Page 1 due to extensive account breakdown, render here gracefully
  if (summary.topCategories.length > 0 && !canFitTopSpendingOnPage1) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(18, 18, 20);
    doc.text(isIndonesian ? "DISTRIBUSI PENGELUARAN TERBESAR" : "TOP EXPENSE DISTRIBUTION", margin, y);

    y += 14;

    summary.topCategories.slice(0, 5).forEach((cat) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(39, 39, 42);
      doc.text(cat.name, margin, y);

      const amtText = `${formatRupiah(cat.amount)}  (${cat.percentage.toFixed(1)}%)`;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(113, 113, 122);
      doc.text(amtText, pageWidth - margin, y, { align: "right" });

      y += 4;
      doc.setFillColor(240, 240, 244);
      doc.roundedRect(margin, y, contentWidth, 3, 1.5, 1.5, "F");

      const fillW = Math.max(3, (contentWidth * Math.min(100, cat.percentage)) / 100);
      doc.setFillColor(39, 39, 42);
      doc.roundedRect(margin, y, fillW, 3, 1.5, 1.5, "F");

      y += 14;
    });

    y += 14;
  }

  // Section: Laporan Arus Kas (3 Activity Cards)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(18, 18, 20);
  doc.text(isIndonesian ? "LAPORAN ARUS KAS" : "STATEMENT OF CASH FLOWS", margin, y);

  y += 12;

  const cfColW = (contentWidth - 16) / 3;
  const cfBoxH = 62;
  const cfActivities = [
    {
      title: isIndonesian ? "AKTIVITAS OPERASI" : "OPERATING ACTIVITIES",
      inflow: cashFlow.operatingInflow,
      outflow: cashFlow.operatingOutflow,
      net: cashFlow.netOperatingCashFlow,
    },
    {
      title: isIndonesian ? "AKTIVITAS INVESTASI" : "INVESTING ACTIVITIES",
      inflow: cashFlow.investingInflow,
      outflow: cashFlow.investingOutflow,
      net: cashFlow.netInvestingCashFlow,
    },
    {
      title: isIndonesian ? "AKTIVITAS PENDANAAN" : "FINANCING ACTIVITIES",
      inflow: cashFlow.financingInflow,
      outflow: cashFlow.financingOutflow,
      net: cashFlow.netFinancingCashFlow,
    },
  ];

  cfActivities.forEach((act, idx) => {
    const x = margin + idx * (cfColW + 8);
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x, y, cfColW, cfBoxH, 5, 5, "F");
    doc.setDrawColor(235, 235, 239);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, cfColW, cfBoxH, 5, 5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(113, 113, 122);
    doc.text(act.title, x + 8, y + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(113, 113, 122);
    doc.text(`${isIndonesian ? "Masuk: +" : "Inflow: +"}${formatRupiah(act.inflow)}`, x + 8, y + 27);
    doc.text(`${isIndonesian ? "Keluar: -" : "Outflow: -"}${formatRupiah(act.outflow)}`, x + 8, y + 39);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(24, 24, 27);
    doc.text(
      `${isIndonesian ? "Bersih: " : "Net: "}${(act.net >= 0 ? "+" : "") + formatRupiah(act.net)}`,
      x + 8,
      y + 52
    );
  });

  y += cfBoxH + 10;

  // Net Cash Change Bar
  doc.setFillColor(244, 244, 247);
  doc.roundedRect(margin, y, contentWidth, 24, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(18, 18, 20);
  doc.text(isIndonesian ? "PERUBAHAN KAS BERSIH" : "NET CHANGE IN CASH", margin + 8, y + 15);
  doc.text(
    `${cashFlow.netCashFlow >= 0 ? "+" : ""}${formatRupiah(cashFlow.netCashFlow)}`,
    pageWidth - margin - 8,
    y + 15,
    { align: "right" }
  );

  y += 42;

  // Section: CaLK & Analisis Rasio
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(18, 18, 20);
  doc.text(
    isIndonesian
      ? "CATATAN ATAS LAPORAN KEUANGAN & ANALISIS RASIO"
      : "NOTES TO FINANCIAL STATEMENTS & FINANCIAL RATIOS",
    margin,
    y
  );

  y += 12;

  // 3 Metric Badges
  const rColW = (contentWidth - 16) / 3;
  const ratios = [
    {
      title: isIndonesian ? "RUNWAY LIKUIDITAS" : "LIQUIDITY RUNWAY",
      val: `${calk.solvencyRunwayMonths} ${isIndonesian ? "Bulan" : "Months"}`,
      rating: isIndonesian
        ? calk.solvencyRunwayMonths >= 6
          ? "AMAN"
          : calk.solvencyRunwayMonths >= 3
            ? "CUKUP"
            : "KRITIS"
        : calk.solvencyRunwayRating.toUpperCase(),
    },
    {
      title: isIndonesian ? "RASIO UTANG (DAR)" : "DEBT TO ASSET RATIO",
      val: `${calk.debtToAssetRatioPct}%`,
      rating: isIndonesian
        ? calk.debtToAssetRatioPct <= 30
          ? "SEHAT"
          : calk.debtToAssetRatioPct <= 50
            ? "MODERAT"
            : "TINGGI"
        : calk.debtRating.toUpperCase(),
    },
    {
      title: isIndonesian ? "ARUS KAS BEBAS (FCF)" : "FREE CASH FLOW RATE",
      val: `${calk.freeCashflowRatePct}%`,
      rating: isIndonesian
        ? calk.freeCashflowRatePct >= 20
          ? "OPTIMAL"
          : calk.freeCashflowRatePct >= 10
            ? "CUKUP"
            : "KETAT"
        : calk.freeCashflowRating.toUpperCase(),
    },
  ];

  ratios.forEach((r, idx) => {
    const x = margin + idx * (rColW + 8);
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x, y, rColW, 40, 4, 4, "F");
    doc.setDrawColor(235, 235, 239);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, rColW, 40, 4, 4, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(113, 113, 122);
    doc.text(r.title, x + 8, y + 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(24, 24, 27);
    doc.text(r.val, x + 8, y + 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(113, 113, 122);
    doc.text(r.rating, x + rColW - 8, y + 26, { align: "right" });
  });

  y += 50;

  // Material Transactions Table (>= 5% threshold)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(18, 18, 20);
  doc.text(
    isIndonesian
      ? "PENGUNGKAPAN TRANSAKSI MATERIAL (>= 5% DARI TOTAL PENGELUARAN)"
      : "MATERIAL TRANSACTIONS DISCLOSURE (>= 5% OF TOTAL EXPENSE)",
    margin,
    y
  );

  y += 10;

  // CaLK Table Header
  doc.setFillColor(244, 244, 246);
  doc.rect(margin, y, contentWidth, 15, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text(isIndonesian ? "TANGGAL" : "DATE", margin + 6, y + 10);
  doc.text(isIndonesian ? "DESKRIPSI / KATEGORI" : "DESCRIPTION / CATEGORY", margin + 70, y + 10);
  doc.text(isIndonesian ? "PORSI BELANJA" : "PORTION", margin + 340, y + 10);
  doc.text(isIndonesian ? "NOMINAL" : "AMOUNT", pageWidth - margin - 6, y + 10, { align: "right" });

  y += 16;

  if (calk.materialTransactions.length > 0) {
    calk.materialTransactions.slice(0, 5).forEach((item, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, y - 1, contentWidth, 15, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 71, 78);
      doc.text(item.date || "", margin + 6, y + 9);
      doc.text(`${item.note.slice(0, 36)} (${item.categoryName})`, margin + 70, y + 9);
      doc.text(`${item.percentageOfTotalExpense}%`, margin + 340, y + 9);
      doc.text(formatRupiah(item.amount), pageWidth - margin - 6, y + 9, { align: "right" });

      doc.setDrawColor(240, 240, 244);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 13, pageWidth - margin, y + 13);
      y += 15;
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(161, 161, 170);
    doc.text(
      isIndonesian
        ? "Tidak ada transaksi tunggal yang melebihi ambang batas material 5%."
        : "No single transaction exceeded the 5% materiality threshold.",
      margin + 6,
      y + 10
    );
    y += 16;
  }

  y += 10;

  // Audit Reconciliation Banner
  doc.setFillColor(248, 248, 250);
  doc.roundedRect(margin, y, contentWidth, 30, 4, 4, "F");
  doc.setDrawColor(235, 235, 239);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 30, 4, 4, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(18, 18, 20);
  doc.text(
    isIndonesian
      ? "REKONSILIASI & INTEGRITAS AUDIT INTERNAL"
      : "AUDIT RECONCILIATION & INTERNAL INTEGRITY",
    margin + 8,
    y + 12
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(113, 113, 122);
  doc.text(
    calk.reconciliation.auditStatus === "CERTIFIED_BALANCED"
      ? isIndonesian
        ? "Status: TERVERIFIKASI SEIMBANG — Seluruh saldo akun dan mutasi kas konsisten 100% tanpa selisih."
        : "Status: VERIFIED BALANCED — All account balances and transaction records are 100% consistent."
      : isIndonesian
        ? `Status: PERINGATAN — Ditemukan selisih ${formatRupiah(calk.reconciliation.discrepancyAmount)}.`
        : `Status: WARNING — Discrepancy detected: ${formatRupiah(calk.reconciliation.discrepancyAmount)}.`,
    margin + 8,
    y + 22
  );

  // ==========================================
  // PAGE 3+: Catatan Transaksi (Transaction Records)
  // ==========================================
  doc.addPage();
  y = 46;

  // Table Header Function
  const renderTransactionRecordsHeader = (currY: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(18, 18, 20);
    doc.text(
      isIndonesian
        ? `CATATAN TRANSAKSI (${transactions.length} CATATAN)`
        : `TRANSACTION RECORDS (${transactions.length} RECORDS)`,
      margin,
      currY
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(113, 113, 122);
    doc.text(`${summary.spaceName} · ${summary.periodLabel}`, pageWidth - margin, currY, { align: "right" });

    currY += 12;

    doc.setFillColor(244, 244, 246);
    doc.rect(margin, currY, contentWidth, 16, "F");
    doc.setDrawColor(228, 228, 233);
    doc.setLineWidth(0.5);
    doc.line(margin, currY + 16, pageWidth - margin, currY + 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(113, 113, 122);
    doc.text(isIndonesian ? "TANGGAL" : "DATE", margin + 6, currY + 11);
    doc.text(isIndonesian ? "DESKRIPSI / KATEGORI" : "DESCRIPTION / CATEGORY", margin + 70, currY + 11);
    doc.text(isIndonesian ? "AKUN" : "ACCOUNT", margin + 310, currY + 11);
    doc.text(isIndonesian ? "NOMINAL" : "AMOUNT", pageWidth - margin - 6, currY + 11, { align: "right" });

    return currY + 18;
  };

  y = renderTransactionRecordsHeader(y);

  const sortedTxs = [...transactions].sort((a, b) => {
    const da = a.occurred_on || a.created_at || "";
    const db = b.occurred_on || b.created_at || "";
    return db.localeCompare(da);
  });

  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));

  sortedTxs.forEach((tx, idx) => {
    if (y > pageHeight - 55) {
      doc.addPage();
      y = renderTransactionRecordsHeader(44);
    }

    // Alternating row background tint
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margin, y - 1, contentWidth, 16, "F");
    }

    const { dateStr: txDate } = extractTxDateAndTime(tx);
    const fromName = tx.wallet_id ? walletMap.get(tx.wallet_id) || (isIndonesian ? "Akun" : "Account") : "-";
    const toName = tx.to_wallet_id ? walletMap.get(tx.to_wallet_id) || (isIndonesian ? "Akun" : "Account") : "";
    const accountLabel = tx.type === "transfer" && toName ? `${fromName} -> ${toName}` : fromName;

    const catName = tx.categories?.name || (tx.type === "transfer" ? "Transfer" : (isIndonesian ? "Umum" : "General"));
    const noteText = tx.type === "transfer"
      ? (tx.note ? `${tx.note} (Transfer)` : "Transfer")
      : (tx.note ? `${tx.note} (${catName})` : catName);
    const desc = noteText.length > 50 ? noteText.slice(0, 48) + "..." : noteText;

    const isIncome = tx.type === "income";
    const isExpense = tx.type === "expense";

    // Clean formatting without broken Unicode characters
    const prefix = isIncome ? "+" : isExpense ? "-" : "";
    const amtStr = `${prefix}${formatRupiah(Number(tx.amount || 0))}`;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 71, 78);
    doc.text(txDate, margin + 6, y + 10);
    doc.text(desc, margin + 70, y + 10);
    doc.text(accountLabel.slice(0, 26), margin + 310, y + 10);

    // Regular font weight for all line amounts
    if (isIncome) {
      doc.setTextColor(13, 148, 136); // teal-600 for inflow
    } else if (isExpense) {
      doc.setTextColor(24, 24, 27); // obsidian for outflow
    } else {
      doc.setTextColor(113, 113, 122); // zinc-500 neutral for transfer
    }
    doc.text(amtStr, pageWidth - margin - 6, y + 10, { align: "right" });

    doc.setDrawColor(240, 240, 244);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 15, pageWidth - margin, y + 15);

    y += 16;
  });

  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(228, 228, 233);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(161, 161, 170);
    doc.text(
      isIndonesian
        ? "Accrual · Arsitektur Kekayaan Privat · Dokumen Rahasia"
        : "Accrual · Private Wealth Architecture · Confidential Document",
      margin,
      pageHeight - 12
    );
    doc.text(
      isIndonesian ? `Halaman ${i} dari ${totalPages}` : `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 12,
      { align: "right" }
    );
  }

  return doc;
}

/**
 * Direct luxury PDF download: immediately triggers file saving without opening print dialog
 */
export async function downloadLuxuryPdf(
  transactions: Transaction[],
  summary: ReportSummary,
  wallets: Wallet[] = [],
  categories: Category[] = [],
  filename = "accrual_statement.pdf",
  isIndonesian = true,
  allTransactions: Transaction[] = [],
  options?: ReportFilterOptions,
): Promise<void> {
  const doc = generateLuxuryPdf(transactions, summary, wallets, categories, isIndonesian, allTransactions, options);
  const blob = doc.output("blob");

  // In native Capacitor iOS WKWebView, <a download> is ignored; Web Share API prompts native "Save to Files"
  if (Capacitor.isNativePlatform() && typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: isIndonesian ? "Laporan Keuangan Accrual" : "Accrual Financial Statement",
          text: isIndonesian
            ? `Berikut laporan keuangan dari Accrual (${filename}).`
            : `Here is the financial statement export from Accrual (${filename}).`,
        });
        return;
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
    }
  }

  // Web browser / Safari / PWA direct download
  doc.save(filename);
}

/**
 * Direct luxury PDF share with Web Share API fallback
 */
export async function shareLuxuryPdf(
  transactions: Transaction[],
  summary: ReportSummary,
  wallets: Wallet[] = [],
  categories: Category[] = [],
  filename = "accrual_statement.pdf",
  isIndonesian = true,
  allTransactions: Transaction[] = [],
  options?: ReportFilterOptions,
): Promise<boolean> {
  const doc = generateLuxuryPdf(transactions, summary, wallets, categories, isIndonesian, allTransactions, options);
  const blob = doc.output("blob");

  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: isIndonesian ? "Laporan Keuangan Accrual" : "Accrual Financial Statement",
          text: isIndonesian
            ? `Berikut laporan keuangan dari Accrual (${filename}).`
            : `Here is the financial statement export from Accrual (${filename}).`,
        });
        return true;
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.warn("[reportExportService] Web Share failed, falling back to download:", e);
      } else {
        return false;
      }
    }
  }

  doc.save(filename);
  return true;
}

