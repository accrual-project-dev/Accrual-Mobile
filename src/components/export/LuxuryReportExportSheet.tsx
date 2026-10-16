import { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Printer,
  Download,
  Share2,
  X,
  FileText,
  FileJson,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useAllTransactions } from "../../hooks/useTransactions";
import { useWallets } from "../../hooks/useWallets";
import { useCategories } from "../../hooks/useCategories";
import { useSpace } from "../../contexts/SpaceContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useToast } from "../../contexts/ToastContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { format, parseISO } from "date-fns";
import {
  filterTransactionsForReport,
  calculateReportSummary,
  generateJsonVaultContent,
  generateCsvContent,
  triggerPrintLuxuryReport,
  downloadLuxuryPdf,
  shareLuxuryPdf,
  downloadExportFile,
  shareOrDownloadFile,
  type ReportDateRange,
  type ReportTransactionType,
  type ReportFilterOptions,
} from "../../lib/reportExportService";

export interface LuxuryReportExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSpaceId?: string;
}

type ExportFormat = "pdf" | "csv" | "json";

export function LuxuryReportExportSheet({
  isOpen,
  onClose,
  defaultSpaceId,
}: LuxuryReportExportSheetProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, preferredCurrency } = useCurrency();
  const { data: allTxs = [] } = useAllTransactions();
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const { spaces, activeSpaceId } = useSpace();
  const { showToast } = useToast();

  const [dateRange, setDateRange] = useState<ReportDateRange>("this_month");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(() => {
    return defaultSpaceId || (activeSpaceId !== "all" ? activeSpaceId : "all");
  });
  const [transactionType, setTransactionType] = useState<ReportTransactionType>("all");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [isExporting, setIsExporting] = useState(false);

  // Custom date picker state
  const [customStart, setCustomStart] = useState(() => format(new Date(), "yyyy-MM-01"));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const spaceName = useMemo(() => {
    const s = spaces.find((sp) => sp.id === selectedSpaceId);
    return s ? s.name : isIndonesian ? "Semua Space" : "All Spaces";
  }, [spaces, selectedSpaceId, isIndonesian]);

  const filterOptions: ReportFilterOptions = useMemo(() => {
    return {
      dateRange,
      customStartDate: dateRange === "custom" ? new Date(customStart) : undefined,
      customEndDate: dateRange === "custom" ? new Date(customEnd) : undefined,
      spaceId: selectedSpaceId,
      spaceName,
      transactionType,
      formatCurrency: formatWithPreferred,
      preferredCurrency,
    };
  }, [dateRange, customStart, customEnd, selectedSpaceId, spaceName, transactionType, formatWithPreferred, preferredCurrency]);

  const filteredTransactions = useMemo(() => {
    return filterTransactionsForReport(allTxs, filterOptions);
  }, [allTxs, filterOptions]);

  const summary = useMemo(() => {
    return calculateReportSummary(filteredTransactions, filterOptions, wallets, isIndonesian);
  }, [filteredTransactions, filterOptions, wallets, isIndonesian]);

  const handleExport = async (action: "download" | "share" | "print") => {
    triggerHaptic("medium");
    if (filteredTransactions.length === 0 && action !== "print") {
      showToast(
        isIndonesian
          ? "Tidak ada transaksi dalam periode yang dipilih"
          : "No transactions found in selected period",
        "delete",
        () => {},
      );
      return;
    }

    setIsExporting(true);
    const isAllSpaces = selectedSpaceId === "all";
    const safePeriod = summary.periodLabel.replace(/[–—]/g, "-").replace(/[/\\:*?"<>|]/g, "").trim();
    const safeSpace = spaceName.replace(/[/\\:*?"<>|]/g, "").trim();
    const spaceSegment = isAllSpaces || !safeSpace || safeSpace.toLowerCase().includes("semua") || safeSpace.toLowerCase().includes("all")
      ? ""
      : ` (${safeSpace})`;

    try {
      if (action === "print") {
        triggerSuccessHaptic();
        triggerPrintLuxuryReport(filteredTransactions, summary, wallets, isIndonesian, filterOptions);
        showToast(
          isIndonesian ? "Laporan siap dicetak" : "Executive statement ready for print",
          "update",
          () => {},
        );
      } else if (exportFormat === "pdf") {
        const filename = isIndonesian
          ? `Trouvaille - Laporan Keuangan${spaceSegment} - ${safePeriod}.pdf`
          : `Trouvaille - Financial Statement${spaceSegment} - ${safePeriod}.pdf`;

        if (action === "share") {
          const ok = await shareLuxuryPdf(
            filteredTransactions,
            summary,
            wallets,
            categories,
            filename,
            isIndonesian,
            allTxs,
            filterOptions,
          );
          if (ok) {
            triggerSuccessHaptic();
            showToast(
              isIndonesian ? "Laporan PDF berhasil dibagikan" : "PDF statement shared successfully",
              "update",
              () => {},
            );
          }
        } else {
          await downloadLuxuryPdf(
            filteredTransactions,
            summary,
            wallets,
            categories,
            filename,
            isIndonesian,
            allTxs,
            filterOptions,
          );
          triggerSuccessHaptic();
          showToast(
            isIndonesian ? "Laporan PDF berhasil diunduh" : "PDF statement downloaded",
            "update",
            () => {},
          );
        }
      } else if (exportFormat === "csv") {
        const csvContent = generateCsvContent(filteredTransactions, wallets, isIndonesian);
        const filename = isIndonesian
          ? `Trouvaille - Catatan Transaksi${spaceSegment} - ${safePeriod}.csv`
          : `Trouvaille - Transaction Records${spaceSegment} - ${safePeriod}.csv`;

        if (action === "share") {
          const ok = await shareOrDownloadFile(
            csvContent,
            filename,
            "text/csv;charset=utf-8;",
            isIndonesian ? "Catatan Transaksi Trouvaille" : "Trouvaille Transaction Records",
          );
          if (ok) {
            triggerSuccessHaptic();
            showToast(
              isIndonesian ? "Berkas CSV berhasil dibagikan" : "CSV records shared successfully",
              "update",
              () => {},
            );
          }
        } else {
          downloadExportFile(csvContent, filename, "text/csv;charset=utf-8;");
          triggerSuccessHaptic();
          showToast(
            isIndonesian ? "Berkas CSV berhasil diunduh" : "CSV records downloaded",
            "update",
            () => {},
          );
        }
      } else if (exportFormat === "json") {
        const jsonContent = generateJsonVaultContent(
          filteredTransactions,
          wallets,
          categories,
          summary,
        );
        const filename = isIndonesian
          ? `Trouvaille - Cadangan Data Vault${spaceSegment} - ${safePeriod}.json`
          : `Trouvaille - Data Vault Backup${spaceSegment} - ${safePeriod}.json`;

        if (action === "share") {
          const ok = await shareOrDownloadFile(
            jsonContent,
            filename,
            "application/json",
            isIndonesian ? "Arsip Vault Trouvaille" : "Trouvaille Vault JSON",
          );
          if (ok) {
            triggerSuccessHaptic();
            showToast(
              isIndonesian ? "Arsip JSON berhasil dibagikan" : "JSON vault shared successfully",
              "update",
              () => {},
            );
          }
        } else {
          downloadExportFile(jsonContent, filename, "application/json;charset=utf-8;");
          triggerSuccessHaptic();
          showToast(
            isIndonesian ? "Arsip JSON berhasil diunduh" : "JSON vault archive downloaded",
            "update",
            () => {},
          );
        }
      }
    } catch (err: any) {
      showToast(
        err?.message || (isIndonesian ? "Gagal mengekspor laporan" : "Failed to export report"),
        "delete",
        () => {},
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="p-5 space-y-4"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3
              className="font-semibold text-base tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian ? "Ekspor Laporan Keuangan" : "Financial Statement & Records"}
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              {isIndonesian
                ? "Neraca, Arus Kas, CaLK, Transaksi & arsip cadangan"
                : "Balance Sheet, Cash Flow, CaLK, Records & vault archives"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isIndonesian ? "Tutup" : "Close"}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] active:scale-95 transition-colors"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {/* 1. Executive Cashflow Summary Card */}
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] p-4 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {summary.periodLabel}
            </span>
            <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)]">
              {summary.transactionCount} {isIndonesian ? "transaksi" : "records"} · {summary.spaceName}
            </span>
          </div>

          {/* Hero Cashflow Metric */}
          <div className="flex items-baseline justify-between pt-0.5">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Arus Kas Bersih" : "Net Cashflow"}
              </span>
              <span className="text-[22px] font-semibold text-[var(--text-primary)]  tracking-tight mt-0.5 block">
                {(summary.netCashflow >= 0 ? "+" : "") + formatWithPreferred(summary.netCashflow)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Rasio Tabungan" : "Savings Rate"}
              </span>
              <span className="text-[18px] font-semibold text-[var(--text-primary)]  tracking-tight mt-0.5 block">
                {summary.savingsRate.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Inflow & Outflow Dual Sub-Cards (Stacked Layout - Never Clips!) */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--glass-border)]">
            <div className="p-2.5 rounded-xl bg-[var(--glass-fill)] border border-[var(--glass-border)] space-y-1">
              <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                <ArrowDownLeft size={13} strokeWidth={1.75} className="shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {isIndonesian ? "Pemasukan" : "Inflow"}
                </span>
              </div>
              <div className=" text-[13px] font-semibold text-[var(--text-primary)] tracking-tight">
                +{formatWithPreferred(summary.totalIncome)}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[var(--glass-fill)] border border-[var(--glass-border)] space-y-1">
              <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                <ArrowUpRight size={13} strokeWidth={1.75} className="shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {isIndonesian ? "Pengeluaran" : "Outflow"}
                </span>
              </div>
              <div className=" text-[13px] font-semibold text-[var(--text-primary)] tracking-tight">
                -{formatWithPreferred(summary.totalExpense)}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Apple iOS Inset Grouped Controls */}
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] divide-y divide-[var(--glass-border)] overflow-hidden shadow-sm">
          {/* Row A: Period Selector */}
          <div className="p-3.5 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider block text-[var(--text-tertiary)]">
              {isIndonesian ? "Rentang Waktu" : "Time Period"}
            </span>
            <div className="grid grid-cols-5 gap-1 p-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)]">
              {(
                [
                  { id: "this_month", label: isIndonesian ? "Bulan Ini" : "Month" },
                  { id: "last_month", label: isIndonesian ? "Lalu" : "Last" },
                  { id: "ytd", label: "YTD" },
                  { id: "all", label: isIndonesian ? "Semua" : "All" },
                  { id: "custom", label: isIndonesian ? "Kustom" : "Custom" },
                ] as const
              ).map((item) => {
                const active = dateRange === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setDateRange(item.id);
                    }}
                    className={`py-1.5 px-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center truncate ${
                      active
                        ? "bg-[#18181b] text-white dark:bg-white dark:text-black shadow-sm"
                        : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Dates (collapsible) */}
            {dateRange === "custom" && (
              <div className="grid grid-cols-2 gap-2.5 pt-2 animate-fadeIn">
                <div className="relative p-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] min-w-0 transition-colors hover:border-[var(--text-secondary)] flex flex-col justify-center cursor-pointer">
                  <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] mb-1">
                    <Calendar size={12} strokeWidth={1.5} className="shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider truncate">
                      {isIndonesian ? "Mulai" : "Start Date"}
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    {customStart
                      ? format(parseISO(customStart), isIndonesian ? "d MMM yyyy" : "MMM d, yyyy")
                      : "-"}
                  </div>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                <div className="relative p-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] min-w-0 transition-colors hover:border-[var(--text-secondary)] flex flex-col justify-center cursor-pointer">
                  <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] mb-1">
                    <Calendar size={12} strokeWidth={1.5} className="shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider truncate">
                      {isIndonesian ? "Selesai" : "End Date"}
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    {customEnd
                      ? format(parseISO(customEnd), isIndonesian ? "d MMM yyyy" : "MMM d, yyyy")
                      : "-"}
                  </div>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Row B: Ledger Scope (If multiple ledgers exist) */}
          {spaces.length > 1 && (
            <div className="p-3.5 space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider block text-[var(--text-tertiary)]">
                {isIndonesian ? "Cakupan Space" : "Space Scope"}
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {spaces.map((sp) => {
                  const active = selectedSpaceId === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setSelectedSpaceId(sp.id);
                      }}
                      className={`py-1 px-2.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                        active
                          ? "bg-[#18181b] text-white dark:bg-white dark:text-black border-transparent shadow-sm"
                          : "border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {sp.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row C: Ledger Type Filter */}
          <div className="p-3.5 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider block text-[var(--text-tertiary)]">
              {isIndonesian ? "Jenis Transaksi" : "Transaction Filter"}
            </span>
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)]">
              {(
                [
                  { id: "all" as const, label: isIndonesian ? "Semua" : "All Records" },
                  { id: "expense" as const, label: isIndonesian ? "Pengeluaran" : "Expenses" },
                  { id: "income" as const, label: isIndonesian ? "Pemasukan" : "Income" },
                  { id: "transfer" as const, label: isIndonesian ? "Transfer" : "Transfers" },
                ] as const
              ).map((t) => {
                const active = transactionType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setTransactionType(t.id);
                    }}
                    className={`py-1.5 px-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center truncate ${
                      active
                        ? "bg-[#18181b] text-white dark:bg-white dark:text-black shadow-sm"
                        : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row D: Export Format (Single-word labels - Never wraps!) */}
          <div className="p-3.5 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider block text-[var(--text-tertiary)]">
              {isIndonesian ? "Format Berkas" : "Export Format"}
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)]">
              {(
                [
                  {
                    id: "pdf" as const,
                    label: "PDF",
                    icon: FileText,
                  },
                  {
                    id: "csv" as const,
                    label: "CSV",
                    icon: FileSpreadsheet,
                  },
                  {
                    id: "json" as const,
                    label: "JSON",
                    icon: FileJson,
                  },
                ] as const
              ).map((fmt) => {
                const active = exportFormat === fmt.id;
                const Icon = fmt.icon;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setExportFormat(fmt.id);
                    }}
                    className={`py-2 px-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      active
                        ? "bg-[#18181b] text-white dark:bg-white dark:text-black shadow-sm"
                        : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon size={14} strokeWidth={1.75} />
                    <span>{fmt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Primary Export Action Dock */}
        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport("download")}
            disabled={isExporting}
            className="flex-1 h-12 rounded-full flex items-center justify-center gap-2 text-[13px] font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-sm disabled:opacity-50"
            style={{
              background: "var(--text-primary)",
              color: "var(--bg-base)",
            }}
          >
            <Download size={15} strokeWidth={1.75} />
            <span>
              {exportFormat === "pdf"
                ? isIndonesian
                  ? "Unduh PDF"
                  : "Download PDF"
                : exportFormat === "csv"
                  ? isIndonesian
                    ? "Unduh CSV"
                    : "Download CSV"
                  : isIndonesian
                    ? "Unduh JSON"
                    : "Download JSON"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleExport("share")}
            disabled={isExporting}
            aria-label={isIndonesian ? "Bagikan Berkas" : "Share Document"}
            title={isIndonesian ? "Bagikan Berkas" : "Share Document"}
            className="w-12 h-12 rounded-full flex items-center justify-center border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-primary)] transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <Share2 size={16} strokeWidth={1.75} />
          </button>

          {exportFormat === "pdf" && (
            <button
              type="button"
              onClick={() => handleExport("print")}
              disabled={isExporting}
              aria-label={isIndonesian ? "Cetak Pratinjau Laporan" : "Print Statement Preview"}
              title={isIndonesian ? "Cetak Pratinjau Laporan" : "Print Statement Preview"}
              className="w-12 h-12 rounded-full flex items-center justify-center border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Printer size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
