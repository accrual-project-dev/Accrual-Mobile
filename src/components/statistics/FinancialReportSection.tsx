import { useState, useMemo } from "react";
import {
  ShieldCheck,
  TrendingUp,
  Scale,
  Copy,
  Check,
  ChevronDown,
  Building2,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Wallet, Transaction, Category } from "../../lib/types";
import {
  generateFinancialReportPackage,
  type FinancialReportPackage,
  type CALKReport,
} from "../../lib/financialAccounting";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useTheme } from "../../contexts/ThemeContext";

interface FinancialReportSectionProps {
  wallets: Wallet[];
  transactions: Transaction[];
  allTransactions?: Transaction[];
  categories: Category[];
  startDate?: string;
  endDate?: string;
  periodLabel?: string;
}

const getSolvencyRatingLabel = (rating: string, isIndonesian: boolean) => {
  if (isIndonesian) {
    switch (rating) {
      case "fortress":
        return "Sangat Kuat";
      case "optimal":
        return "Sehat";
      case "caution":
        return "Waspada";
      case "critical":
        return "Kritis";
      default:
        return rating;
    }
  }
  switch (rating) {
    case "fortress":
      return "Fortress";
    case "optimal":
      return "Optimal";
    case "caution":
      return "Caution";
    case "critical":
      return "Critical";
    default:
      return rating;
  }
};

const getDebtRatingLabel = (rating: string, isIndonesian: boolean) => {
  if (isIndonesian) {
    switch (rating) {
      case "debt-free":
        return "Bebas Utang";
      case "conservative":
        return "Konservatif";
      case "moderate":
        return "Moderat";
      case "elevated":
        return "Tinggi";
      default:
        return rating;
    }
  }
  switch (rating) {
    case "debt-free":
      return "Debt-Free";
    case "conservative":
      return "Conservative";
    case "moderate":
      return "Moderate";
    case "elevated":
      return "Elevated";
    default:
      return rating;
  }
};

const getFreeCashflowRatingLabel = (rating: string, isIndonesian: boolean) => {
  if (isIndonesian) {
    switch (rating) {
      case "superior":
        return "Prima";
      case "healthy":
        return "Sehat";
      case "tight":
        return "Ketat";
      case "deficit":
        return "Defisit";
      default:
        return rating;
    }
  }
  switch (rating) {
    case "superior":
      return "Superior";
    case "healthy":
      return "Healthy";
    case "tight":
      return "Tight";
    case "deficit":
      return "Deficit";
    default:
      return rating;
  }
};

const getSolvencyDescription = (calk: CALKReport, isIndonesian: boolean) => {
  if (!isIndonesian) return calk.solvencyDescription;
  if (calk.solvencyRunwayRating === "fortress") {
    return `Likuiditas sangat kokoh: Cadangan kas Anda menopang ${calk.solvencyRunwayMonths} bulan pengeluaran operasional tanpa memerlukan pemasukan tambahan.`;
  }
  if (calk.solvencyRunwayRating === "optimal") {
    return `Likuiditas sehat: Cadangan kas menopang ${calk.solvencyRunwayMonths} bulan biaya hidup, memenuhi batas aman rekomendasi 3–6 bulan.`;
  }
  if (calk.solvencyRunwayRating === "caution") {
    return `Cadangan kas ketat: Ketahanan kas Anda ${calk.solvencyRunwayMonths} bulan. Disarankan memperbesar bantalan dana darurat untuk mengantisipasi risiko tak terduga.`;
  }
  return `Likuiditas kritis: Ketahanan kas di bawah 1 bulan (${calk.solvencyRunwayMonths} bln). Alokasi segera ke cadangan kas likuid darurat sangat disarankan.`;
};

const getDebtDescription = (calk: CALKReport, isIndonesian: boolean) => {
  if (!isIndonesian) return calk.debtDescription;
  if (calk.debtRating === "debt-free") {
    return "Neraca murni: Bebas liabilitas atau pinjaman berjalan. Seluruh aset merupakan 100% ekuitas bersih.";
  }
  if (calk.debtRating === "conservative") {
    return `Leverage konservatif: Liabilitas hanya menyumbang ${calk.debtToAssetRatioPct}% dari total aset, berada dalam batas aman solvabilitas.`;
  }
  if (calk.debtRating === "moderate") {
    return `Leverage moderat: Utang mencapai ${calk.debtToAssetRatioPct}% dari nilai aset. Beban cicilan perlu terus dipantau secara berkala.`;
  }
  return `Beban utang tinggi: Liabilitas mencapai ${calk.debtToAssetRatioPct}% dari total aset. Prioritaskan percepatan pengurangan pokok pinjaman.`;
};

const getFreeCashflowDescription = (
  calk: CALKReport,
  isIndonesian: boolean,
) => {
  if (!isIndonesian) return calk.freeCashflowDescription;
  if (calk.freeCashflowRating === "superior") {
    return `Laju tabungan prima: Anda mempertahankan ${calk.freeCashflowRatePct}% pemasukan sebagai surplus arus kas operasional.`;
  }
  if (calk.freeCashflowRating === "healthy") {
    return `Akumulasi sehat: Rasio kas tersisa sebesar ${calk.freeCashflowRatePct}%, mendorong pertumbuhan modal secara konsisten.`;
  }
  if (calk.freeCashflowRating === "tight") {
    return `Margin ketat: Surplus kas tersisa sebesar ${calk.freeCashflowRatePct}%. Penekanan belanja diskresioner akan meningkatkan tabungan.`;
  }
  return `Defisit operasional: Arus kas keluar melampaui pemasukan periode ini sebesar ${Math.abs(calk.freeCashflowRatePct)}%.`;
};

const getReconciliationNotes = (
  calk: CALKReport,
  isIndonesian: boolean,
  formatMoney: (val: number) => string,
) => {
  if (!isIndonesian) return calk.reconciliation.notes;
  if (calk.reconciliation.assetsEqualLiabilitiesPlusEquity) {
    return `Seluruh pos neraca telah terekonsiliasi sempurna dengan selisih ${formatMoney(0)} terhadap total aset tercatat sesuai standar prinsip akuntansi.`;
  }
  return `Perhatian: Terdeteksi diskrepansi sebesar ${formatMoney(Math.abs(calk.reconciliation.discrepancyAmount))} antara Total Aset dan Liabilitas + Ekuitas.`;
};

export function FinancialReportSection({
  wallets,
  transactions,
  allTransactions,
  categories,
  startDate,
  endDate,
  periodLabel = "Current Period",
}: FinancialReportSectionProps) {
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const [copied, setCopied] = useState(false);

  // Section collapse toggles (default folded for clean luxury presentation)
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [liabilitiesOpen, setLiabilitiesOpen] = useState(false);
  const [equityOpen, setEquityOpen] = useState(false);
  const [operatingOpen, setOperatingOpen] = useState(false);
  const [investingOpen, setInvestingOpen] = useState(false);
  const [financingOpen, setFinancingOpen] = useState(false);

  const report: FinancialReportPackage = useMemo(() => {
    return generateFinancialReportPackage(wallets, transactions, categories, {
      startDate,
      endDate,
      periodLabel,
      allTransactions,
    });
  }, [
    wallets,
    transactions,
    allTransactions,
    categories,
    startDate,
    endDate,
    periodLabel,
  ]);

  const { balanceSheet, cashFlow, calk } = report;

  const handleCopySummary = () => {
    triggerHaptic("medium");
    const summaryText = isIndonesian
      ? `
=== LAPORAN KEUANGAN TROUVAILLE ===
Periode: ${periodLabel}
Tanggal Dibuat: ${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" })}

--- 1. LAPORAN POSISI KEUANGAN (NERACA) ---
* ASET:
  - Aset Likuid (Kas & Bank): ${formatWithPreferred(balanceSheet.liquidAssets.total)}
  - Portofolio Investasi: ${formatWithPreferred(balanceSheet.investmentAssets.total)}
  - Piutang Tertunda: ${formatWithPreferred(balanceSheet.receivableAssets.total)}
  TOTAL ASET: ${formatWithPreferred(balanceSheet.totalAssets)}

* LIABILITAS:
  - Jangka Pendek (Kartu Kredit & PayLater): ${formatWithPreferred(balanceSheet.currentLiabilities.total)}
  - Jangka Panjang (Pinjaman & Cicilan): ${formatWithPreferred(balanceSheet.longTermLiabilities.total)}
  TOTAL LIABILITAS: ${formatWithPreferred(balanceSheet.totalLiabilities)}

* EKUITAS:
  KEKAYAAN BERSIH: ${formatWithPreferred(balanceSheet.netWorth)}
  Status Keseimbangan: ${balanceSheet.isBalanced ? "SEIMBANG (Aset = Liabilitas + Ekuitas)" : "DISKREPANSI TERDETEKSI"}

--- 2. LAPORAN ARUS KAS ---
* Arus Kas Operasional (OCF):
  - Masuk: ${formatWithPreferred(cashFlow.operatingInflow)}
  - Keluar: ${formatWithPreferred(cashFlow.operatingOutflow)}
  - Bersih OCF: ${formatWithPreferred(cashFlow.netOperatingCashFlow)}
* Arus Kas Investasi (ICF):
  - Masuk: ${formatWithPreferred(cashFlow.investingInflow)}
  - Keluar: ${formatWithPreferred(cashFlow.investingOutflow)}
  - Bersih ICF: ${formatWithPreferred(cashFlow.netInvestingCashFlow)}
* Arus Kas Pendanaan (FCF):
  - Masuk: ${formatWithPreferred(cashFlow.financingInflow)}
  - Keluar: ${formatWithPreferred(cashFlow.financingOutflow)}
  - Bersih FCF: ${formatWithPreferred(cashFlow.netFinancingCashFlow)}
PERGERAKAN KAS BERSIH: ${formatWithPreferred(cashFlow.netCashFlow)}

--- 3. CATATAN ATAS LAPORAN KEUANGAN (CALK) ---
* Ketahanan Kas: ${calk.solvencyRunwayMonths} bulan (${getSolvencyRatingLabel(calk.solvencyRunwayRating, true)})
* Rasio Utang terhadap Aset (DAR): ${calk.debtToAssetRatioPct}% (${getDebtRatingLabel(calk.debtRating, true)})
* Tingkat Arus Kas Bebas: ${calk.freeCashflowRatePct}% (${getFreeCashflowRatingLabel(calk.freeCashflowRating, true)})
* Status Audit: ${balanceSheet.isBalanced ? "Terekonsiliasi Penuh" : "Perlu Ditinjau"}
      `.trim()
      : `
=== TROUVAILLE FINANCIAL REPORT ===
Period: ${periodLabel}
Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}

--- 1. STATEMENT OF FINANCIAL POSITION (BALANCE SHEET) ---
* ASSETS:
  - Liquid Assets (Cash & Bank): ${formatWithPreferred(balanceSheet.liquidAssets.total)}
  - Investment Portfolio: ${formatWithPreferred(balanceSheet.investmentAssets.total)}
  - Receivables: ${formatWithPreferred(balanceSheet.receivableAssets.total)}
  TOTAL ASSETS: ${formatWithPreferred(balanceSheet.totalAssets)}

* LIABILITIES:
  - Current (Credit Cards & PayLater): ${formatWithPreferred(balanceSheet.currentLiabilities.total)}
  - Long-Term Debt & Loans: ${formatWithPreferred(balanceSheet.longTermLiabilities.total)}
  TOTAL LIABILITIES: ${formatWithPreferred(balanceSheet.totalLiabilities)}

* EQUITY:
  NET WORTH: ${formatWithPreferred(balanceSheet.netWorth)}
  Balance Status: ${balanceSheet.isBalanced ? "BALANCED (Assets = Liabilities + Equity)" : "DISCREPANCY DETECTED"}

--- 2. STATEMENT OF CASH FLOWS ---
* Operating Cash Flow (OCF):
  - Inflow: ${formatWithPreferred(cashFlow.operatingInflow)}
  - Outflow: ${formatWithPreferred(cashFlow.operatingOutflow)}
  - Net OCF: ${formatWithPreferred(cashFlow.netOperatingCashFlow)}
* Investing Cash Flow (ICF):
  - Inflow: ${formatWithPreferred(cashFlow.investingInflow)}
  - Outflow: ${formatWithPreferred(cashFlow.investingOutflow)}
  - Net ICF: ${formatWithPreferred(cashFlow.netInvestingCashFlow)}
* Financing Cash Flow (FCF):
  - Inflow: ${formatWithPreferred(cashFlow.financingInflow)}
  - Outflow: ${formatWithPreferred(cashFlow.financingOutflow)}
  - Net FCF: ${formatWithPreferred(cashFlow.netFinancingCashFlow)}
NET CASH MOVEMENT: ${formatWithPreferred(cashFlow.netCashFlow)}

--- 3. NOTES TO FINANCIAL STATEMENTS (DISCLOSURES) ---
* Solvency Runway: ${calk.solvencyRunwayMonths} months (${getSolvencyRatingLabel(calk.solvencyRunwayRating, false)})
* Debt-to-Asset Ratio: ${calk.debtToAssetRatioPct}% (${getDebtRatingLabel(calk.debtRating, false)})
* Free Cash Flow Rate: ${calk.freeCashflowRatePct}% (${getFreeCashflowRatingLabel(calk.freeCashflowRating, false)})
* Audit Status: ${balanceSheet.isBalanced ? "Fully Reconciled" : "Discrepancy Under Review"}
      `.trim();

    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true);
      showToast(
        isIndonesian
          ? "Laporan keuangan berhasil disalin ke clipboard"
          : "Financial statement copied to clipboard",
        "update",
        () => {},
      );
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // ── Liquid Glass Tactile Tokens ──
  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 247, 250, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.09)"
    : "1px solid rgba(0, 0, 0, 0.065)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.22)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.035)";

  const gradientDivider = {
    background: isDark
      ? "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 15%, rgba(255, 255, 255, 0.08) 85%, transparent 100%)"
      : "linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.06) 15%, rgba(0, 0, 0, 0.06) 85%, transparent 100%)",
    height: "1px",
    width: "100%",
  };

  return (
    <div className="space-y-3.5 select-none">
      {/* ====================================================================== */}
      {/* 1. EXECUTIVE ACCOUNTING HEADER HERO                                    */}
      {/* ====================================================================== */}
      <section
        className="p-4 sm:p-5 rounded-[26px] relative overflow-hidden space-y-3 transition-all"
        style={{
          background: controlBg,
          border: controlBorder,
          boxShadow: controlShadow,
        }}
      >
        {/* Specular Rim Light */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
          style={{
            background: isDark
              ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), rgba(255,255,255,0.5), rgba(255,255,255,0.3), transparent)"
              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
          }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Laporan" : "Statements"} • {periodLabel}
              </span>
            </div>
            <h2 className="text-[19px] sm:text-[21px] font-bold tracking-tight text-[var(--text-primary)] leading-tight truncate">
              {isIndonesian ? "Laporan Keuangan" : "Financial Report"}
            </h2>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] truncate">
              {isIndonesian
                ? "Neraca Posisi Keuangan, Arus Kas & Catatan Pengungkapan"
                : "Balance Sheet, Cash Flows & Disclosures"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold active:scale-95 transition-all cursor-pointer shrink-0"
            style={{
              background: controlBg,
              border: controlBorder,
              color: "var(--text-primary)",
              boxShadow: controlShadow,
            }}
          >
            {copied ? (
              <>
                <Check size={12} strokeWidth={2.8} />
                <span>{isIndonesian ? "Tersalin" : "Copied"}</span>
              </>
            ) : (
              <>
                <Copy size={12} strokeWidth={1.8} />
                <span>{isIndonesian ? "Ekspor" : "Export"}</span>
              </>
            )}
          </button>
        </div>

        {/* Status Keseimbangan Neraca */}
        <div style={gradientDivider} className="pt-0.5" />
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-tight truncate text-[var(--text-secondary)]">
            <ShieldCheck
              size={13.5}
              strokeWidth={2}
              className="shrink-0 text-[var(--text-primary)]"
            />
            <span className="truncate">
              {balanceSheet.isBalanced
                ? isIndonesian
                  ? "Aset = Liabilitas + Ekuitas"
                  : "Assets = Liabilities + Equity"
                : isIndonesian
                  ? "Diskrepansi Akuntansi Terdeteksi"
                  : "Accounting Discrepancy Detected"}
            </span>
          </div>

          <div className="text-[10.5px] font-mono font-medium whitespace-nowrap shrink-0 text-[var(--text-tertiary)]">
            {isIndonesian ? "Selisih" : "Diff"}:{" "}
            {formatWithPreferred(balanceSheet.discrepancy)}
          </div>
        </div>
      </section>

      {/* ====================================================================== */}
      {/* 2. STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)                     */}
      {/* ====================================================================== */}
      <section
        className="p-4 sm:p-5 rounded-[26px] space-y-3.5 relative overflow-hidden transition-all"
        style={{
          background: controlBg,
          border: controlBorder,
          boxShadow: controlShadow,
        }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
                border: controlBorder,
                color: "var(--text-primary)",
              }}
            >
              <Scale size={15} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)] leading-tight truncate">
                {isIndonesian
                  ? "1. Laporan Posisi Keuangan (Neraca)"
                  : "1. Statement of Financial Position"}
              </h3>
              <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5 leading-tight truncate">
                {isIndonesian
                  ? "Struktur aset, liabilitas & ekuitas bersih"
                  : "Asset structure, liabilities & net worth equity"}
              </p>
            </div>
          </div>
          <span
            className="whitespace-nowrap shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-full border"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.04)",
              borderColor: "var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            {isIndonesian ? "Terverifikasi" : "Verified"}
          </span>
        </div>

        {/* 3-Col Bento Telemetry */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            {
              label: isIndonesian ? "Total Aset" : "Total Assets",
              value: formatWithPreferred(balanceSheet.totalAssets),
              highlight: false,
            },
            {
              label: isIndonesian ? "Total Liabilitas" : "Liabilities",
              value: formatWithPreferred(balanceSheet.totalLiabilities),
              highlight: false,
            },
            {
              label: isIndonesian ? "Kekayaan Bersih" : "Net Worth",
              value: formatWithPreferred(balanceSheet.netWorth),
              highlight: true,
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-2xl transition-all"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.04)"
                  : "rgba(0, 0, 0, 0.03)",
                border: controlBorder,
              }}
            >
              <span className="text-[8.5px] uppercase font-bold text-[var(--text-tertiary)] block truncate">
                {item.label}
              </span>
              <span
                className={`amount text-[12px] sm:text-[13px] font-bold mt-0.5 block truncate tabular-nums ${
                  item.highlight
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Inset Accordion Rows */}
        <div className="space-y-1.5 pt-0.5">
          {/* Accordion 1: Assets Breakdown */}
          <div
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.02)",
              border: controlBorder,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setAssetsOpen(!assetsOpen);
                triggerHaptic("light");
              }}
              className="w-full p-3 flex items-center justify-between text-left cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <Layers size={12.5} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                    {isIndonesian ? "Rincian Aset" : "Assets Breakdown"}
                  </h4>
                  <p className="text-[9.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                    {isIndonesian
                      ? `Kas/Bank: ${formatWithPreferred(balanceSheet.liquidAssets.total)} • Investasi: ${formatWithPreferred(balanceSheet.investmentAssets.total)}`
                      : `Liquid: ${formatWithPreferred(balanceSheet.liquidAssets.total)} • Inv: ${formatWithPreferred(balanceSheet.investmentAssets.total)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="amount text-[12px] font-bold text-[var(--text-primary)] tabular-nums">
                  {formatWithPreferred(balanceSheet.totalAssets)}
                </span>
                <motion.div
                  animate={{ rotate: assetsOpen ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[var(--text-tertiary)]"
                >
                  <ChevronDown size={14} />
                </motion.div>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {assetsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 pt-1 space-y-2.5 text-[11px]"
                >
                  <div style={gradientDivider} />
                  {/* Liquid Assets Sub-group */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-[var(--text-primary)]">
                      <span>
                        {isIndonesian
                          ? "Aset Likuid (Kas & Bank)"
                          : "Liquid Assets"}
                      </span>
                      <span className="tabular-nums">
                        {formatWithPreferred(balanceSheet.liquidAssets.total)}
                      </span>
                    </div>
                    {balanceSheet.liquidAssets.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between py-1 px-1.5 text-[10.5px] text-[var(--text-secondary)]"
                      >
                        <span className="truncate">{it.name}</span>
                        <div className="flex items-center gap-2 tabular-nums shrink-0">
                          <span className="text-[9.5px] text-[var(--text-tertiary)]">
                            {it.percentageOfTotal.toFixed(1)}%
                          </span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {formatWithPreferred(it.balance)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Investment Portfolio Sub-group */}
                  <div style={gradientDivider} />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-[var(--text-primary)]">
                      <span>
                        {isIndonesian
                          ? "Portofolio Investasi"
                          : "Investment Portfolio"}
                      </span>
                      <span className="tabular-nums">
                        {formatWithPreferred(balanceSheet.investmentAssets.total)}
                      </span>
                    </div>
                    {balanceSheet.investmentAssets.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between py-1 px-1.5 text-[10.5px] text-[var(--text-secondary)]"
                      >
                        <span className="truncate">{it.name}</span>
                        <div className="flex items-center gap-2 tabular-nums shrink-0">
                          <span className="text-[9.5px] text-[var(--text-tertiary)]">
                            {it.percentageOfTotal.toFixed(1)}%
                          </span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {formatWithPreferred(it.balance)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Receivables Sub-group */}
                  {balanceSheet.receivableAssets.items.length > 0 && (
                    <>
                      <div style={gradientDivider} />
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-[var(--text-primary)]">
                          <span>
                            {isIndonesian ? "Piutang Tertunda" : "Receivables"}
                          </span>
                          <span className="tabular-nums">
                            {formatWithPreferred(balanceSheet.receivableAssets.total)}
                          </span>
                        </div>
                        {balanceSheet.receivableAssets.items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between py-1 px-1.5 text-[10.5px] text-[var(--text-secondary)]"
                          >
                            <span className="truncate">{it.name}</span>
                            <div className="flex items-center gap-2 tabular-nums shrink-0">
                              <span className="text-[9.5px] text-[var(--text-tertiary)]">
                                {it.percentageOfTotal.toFixed(1)}%
                              </span>
                              <span className="font-semibold text-[var(--text-primary)]">
                                {formatWithPreferred(it.balance)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Accordion 2: Liabilities Breakdown */}
          <div
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.02)",
              border: controlBorder,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setLiabilitiesOpen(!liabilitiesOpen);
                triggerHaptic("light");
              }}
              className="w-full p-3 flex items-center justify-between text-left cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <Building2 size={12.5} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                    {isIndonesian
                      ? "Rincian Liabilitas"
                      : "Liabilities Breakdown"}
                  </h4>
                  <p className="text-[9.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                    {isIndonesian
                      ? `Utang Lancar: ${formatWithPreferred(balanceSheet.currentLiabilities.total)} • Jangka Panjang: ${formatWithPreferred(balanceSheet.longTermLiabilities.total)}`
                      : `Current: ${formatWithPreferred(balanceSheet.currentLiabilities.total)} • Long-Term: ${formatWithPreferred(balanceSheet.longTermLiabilities.total)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="amount text-[12px] font-bold text-[var(--text-secondary)] tabular-nums">
                  {formatWithPreferred(balanceSheet.totalLiabilities)}
                </span>
                <motion.div
                  animate={{ rotate: liabilitiesOpen ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[var(--text-tertiary)]"
                >
                  <ChevronDown size={14} />
                </motion.div>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {liabilitiesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 pt-1 space-y-2 text-[11px]"
                >
                  <div style={gradientDivider} />
                  {balanceSheet.totalLiabilities === 0 ? (
                    <p className="text-[10.5px] px-1 text-[var(--text-tertiary)]">
                      {isIndonesian
                        ? "Bebas dari liabilitas dan pinjaman aktif."
                        : "Zero active debt or loan liabilities recorded."}
                    </p>
                  ) : (
                    <>
                      {balanceSheet.currentLiabilities.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between py-1 px-1.5 text-[10.5px] text-[var(--text-secondary)]"
                        >
                          <span className="truncate">{it.name}</span>
                          <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                            {formatWithPreferred(it.balance)}
                          </span>
                        </div>
                      ))}
                      {balanceSheet.longTermLiabilities.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between py-1 px-1.5 text-[10.5px] text-[var(--text-secondary)]"
                        >
                          <span className="truncate">{it.name}</span>
                          <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                            {formatWithPreferred(it.balance)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Accordion 3: Equity & Capital Structure */}
          <div
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.02)",
              border: controlBorder,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setEquityOpen(!equityOpen);
                triggerHaptic("light");
              }}
              className="w-full p-3 flex items-center justify-between text-left cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <ShieldCheck size={12.5} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                    {isIndonesian
                      ? "Struktur Modal & Ekuitas"
                      : "Equity & Capital Structure"}
                  </h4>
                  <p className="text-[9.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                    {isIndonesian
                      ? `Solvabilitas: ${balanceSheet.totalAssets > 0 ? ((balanceSheet.netWorth / balanceSheet.totalAssets) * 100).toFixed(1) + "%" : "100%"}`
                      : `Solvency: ${balanceSheet.totalAssets > 0 ? ((balanceSheet.netWorth / balanceSheet.totalAssets) * 100).toFixed(1) + "%" : "100%"}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="amount text-[12px] font-bold text-[var(--text-primary)] tabular-nums">
                  {formatWithPreferred(balanceSheet.netWorth)}
                </span>
                <motion.div
                  animate={{ rotate: equityOpen ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[var(--text-tertiary)]"
                >
                  <ChevronDown size={14} />
                </motion.div>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {equityOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 pt-1 space-y-1.5 text-[11px]"
                >
                  <div style={gradientDivider} />
                  <div className="flex items-center justify-between py-1 px-1 text-[10.5px]">
                    <span className="text-[var(--text-secondary)]">
                      {isIndonesian ? "Rasio Solvabilitas" : "Solvency Ratio"}
                    </span>
                    <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                      {balanceSheet.totalLiabilities > 0
                        ? `${((balanceSheet.netWorth / balanceSheet.totalAssets) * 100).toFixed(1)}%`
                        : "100.0% (Bebas Utang)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-1 text-[10.5px]">
                    <span className="text-[var(--text-secondary)]">
                      {isIndonesian ? "Keseimbangan Neraca" : "Balance Status"}
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {balanceSheet.isBalanced
                        ? "100% Seimbang"
                        : "Ada Diskrepansi"}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ====================================================================== */}
      {/* 3. STATEMENT OF CASH FLOWS (3 CORE ACTIVITIES)                         */}
      {/* ====================================================================== */}
      <section
        className="p-4 sm:p-5 rounded-[26px] space-y-3.5 relative overflow-hidden transition-all"
        style={{
          background: controlBg,
          border: controlBorder,
          boxShadow: controlShadow,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
                border: controlBorder,
                color: "var(--text-primary)",
              }}
            >
              <TrendingUp size={15} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)] leading-tight truncate">
                {isIndonesian
                  ? "2. Laporan Arus Kas"
                  : "2. Statement of Cash Flows"}
              </h3>
              <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5 leading-tight truncate">
                {isIndonesian
                  ? "Rekonsiliasi kas 3 aktivitas utama"
                  : "Cash reconciliation across 3 core activities"}
              </p>
            </div>
          </div>
          <span
            className="whitespace-nowrap shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border tabular-nums"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.04)",
              borderColor: "var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            {cashFlow.netCashFlow >= 0 ? "+" : ""}
            {formatWithPreferred(cashFlow.netCashFlow)}
          </span>
        </div>

        {/* 3-Col Bento Telemetry */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            {
              label: isIndonesian ? "Operasional (OCF)" : "Operating (OCF)",
              value: `${cashFlow.netOperatingCashFlow >= 0 ? "+" : ""}${formatWithPreferred(cashFlow.netOperatingCashFlow)}`,
            },
            {
              label: isIndonesian ? "Investasi (ICF)" : "Investing (ICF)",
              value: `${cashFlow.netInvestingCashFlow >= 0 ? "+" : ""}${formatWithPreferred(cashFlow.netInvestingCashFlow)}`,
            },
            {
              label: isIndonesian ? "Pendanaan (FCF)" : "Financing (FCF)",
              value: `${cashFlow.netFinancingCashFlow >= 0 ? "+" : ""}${formatWithPreferred(cashFlow.netFinancingCashFlow)}`,
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-2xl transition-all"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.04)"
                  : "rgba(0, 0, 0, 0.03)",
                border: controlBorder,
              }}
            >
              <span className="text-[8.5px] uppercase font-bold text-[var(--text-tertiary)] block truncate">
                {item.label}
              </span>
              <span className="amount text-[12px] sm:text-[13px] font-bold mt-0.5 block truncate tabular-nums text-[var(--text-primary)]">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Inset Accordion Rows */}
        <div className="space-y-1.5 pt-0.5">
          {/* Operating Accordion */}
          <div
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.02)",
              border: controlBorder,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOperatingOpen(!operatingOpen);
                triggerHaptic("light");
              }}
              className="w-full p-3 flex items-center justify-between text-left cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <TrendingUp size={12.5} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                    {isIndonesian
                      ? "Aktivitas Operasional (OCF)"
                      : "Operating Activities (OCF)"}
                  </h4>
                  <p className="text-[9.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                    {isIndonesian
                      ? `Masuk: ${formatWithPreferred(cashFlow.operatingInflow)} • Keluar: ${formatWithPreferred(cashFlow.operatingOutflow)}`
                      : `In: ${formatWithPreferred(cashFlow.operatingInflow)} • Out: ${formatWithPreferred(cashFlow.operatingOutflow)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="amount text-[12px] font-bold text-[var(--text-primary)] tabular-nums">
                  {cashFlow.netOperatingCashFlow >= 0 ? "+" : ""}
                  {formatWithPreferred(cashFlow.netOperatingCashFlow)}
                </span>
                <motion.div
                  animate={{ rotate: operatingOpen ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[var(--text-tertiary)]"
                >
                  <ChevronDown size={14} />
                </motion.div>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {operatingOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 pt-1 space-y-1 text-[11px]"
                >
                  <div style={gradientDivider} />
                  {cashFlow.operatingItems.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between py-1 px-1 text-[10.5px]"
                    >
                      <span className="text-[var(--text-secondary)] truncate">
                        {it.name}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {it.net >= 0 ? "+" : ""}
                        {formatWithPreferred(it.net)}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Investing Accordion */}
          <div
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.02)",
              border: controlBorder,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setInvestingOpen(!investingOpen);
                triggerHaptic("light");
              }}
              className="w-full p-3 flex items-center justify-between text-left cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <Layers size={12.5} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                    {isIndonesian
                      ? "Aktivitas Investasi (ICF)"
                      : "Investing Activities (ICF)"}
                  </h4>
                  <p className="text-[9.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                    {isIndonesian
                      ? `Masuk: ${formatWithPreferred(cashFlow.investingInflow)} • Keluar: ${formatWithPreferred(cashFlow.investingOutflow)}`
                      : `In: ${formatWithPreferred(cashFlow.investingInflow)} • Out: ${formatWithPreferred(cashFlow.investingOutflow)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="amount text-[12px] font-bold text-[var(--text-secondary)] tabular-nums">
                  {cashFlow.netInvestingCashFlow >= 0 ? "+" : ""}
                  {formatWithPreferred(cashFlow.netInvestingCashFlow)}
                </span>
                <motion.div
                  animate={{ rotate: investingOpen ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[var(--text-tertiary)]"
                >
                  <ChevronDown size={14} />
                </motion.div>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {investingOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 pt-1 space-y-1 text-[11px]"
                >
                  <div style={gradientDivider} />
                  {cashFlow.investingItems.length === 0 ? (
                    <p className="text-[10.5px] px-1 text-[var(--text-tertiary)]">
                      {isIndonesian
                        ? "Tidak ada pergerakan investasi pada periode ini."
                        : "No investment movements recorded."}
                    </p>
                  ) : (
                    cashFlow.investingItems.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between py-1 px-1 text-[10.5px]"
                      >
                        <span className="text-[var(--text-secondary)] truncate">
                          {it.name}
                        </span>
                        <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                          {it.net >= 0 ? "+" : ""}
                          {formatWithPreferred(it.net)}
                        </span>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Financing Accordion */}
          <div
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.02)",
              border: controlBorder,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setFinancingOpen(!financingOpen);
                triggerHaptic("light");
              }}
              className="w-full p-3 flex items-center justify-between text-left cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <Building2 size={12.5} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                    {isIndonesian
                      ? "Aktivitas Pendanaan (FCF)"
                      : "Financing Activities (FCF)"}
                  </h4>
                  <p className="text-[9.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                    {isIndonesian
                      ? `Masuk: ${formatWithPreferred(cashFlow.financingInflow)} • Keluar: ${formatWithPreferred(cashFlow.financingOutflow)}`
                      : `In: ${formatWithPreferred(cashFlow.financingInflow)} • Out: ${formatWithPreferred(cashFlow.financingOutflow)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="amount text-[12px] font-bold text-[var(--text-secondary)] tabular-nums">
                  {cashFlow.netFinancingCashFlow >= 0 ? "+" : ""}
                  {formatWithPreferred(cashFlow.netFinancingCashFlow)}
                </span>
                <motion.div
                  animate={{ rotate: financingOpen ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[var(--text-tertiary)]"
                >
                  <ChevronDown size={14} />
                </motion.div>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {financingOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 pt-1 space-y-1 text-[11px]"
                >
                  <div style={gradientDivider} />
                  {cashFlow.financingItems.length === 0 ? (
                    <p className="text-[10.5px] px-1 text-[var(--text-tertiary)]">
                      {isIndonesian
                        ? "Tidak ada mutasi pinjaman atau pembiayaan pada periode ini."
                        : "No financing movements recorded."}
                    </p>
                  ) : (
                    cashFlow.financingItems.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between py-1 px-1 text-[10.5px]"
                      >
                        <span className="text-[var(--text-secondary)] truncate">
                          {it.name}
                        </span>
                        <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                          {it.net >= 0 ? "+" : ""}
                          {formatWithPreferred(it.net)}
                        </span>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ====================================================================== */}
      {/* 4. NOTES TO FINANCIAL STATEMENTS (CALK & DISCLOSURES)                   */}
      {/* ====================================================================== */}
      <section
        className="p-4 sm:p-5 rounded-[26px] space-y-3.5 relative overflow-hidden transition-all"
        style={{
          background: controlBg,
          border: controlBorder,
          boxShadow: controlShadow,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
                border: controlBorder,
                color: "var(--text-primary)",
              }}
            >
              <FileSpreadsheet size={15} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)] leading-tight truncate">
                {isIndonesian
                  ? "3. Catatan atas Laporan Keuangan (CaLK)"
                  : "3. Notes to Financial Statements"}
              </h3>
              <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5 leading-tight truncate">
                {isIndonesian
                  ? "Pengungkapan & catatan kaki"
                  : "Disclosures & explanatory footnotes"}
              </p>
            </div>
          </div>
          <span
            className="whitespace-nowrap shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-full border"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.04)",
              borderColor: "var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            {isIndonesian ? "Pengungkapan" : "Disclosures"}
          </span>
        </div>

        {/* 3-Col Bento Telemetry */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            {
              label: isIndonesian ? "Ketahanan Kas" : "Solvency Runway",
              value: `${calk.solvencyRunwayMonths} ${isIndonesian ? "bln" : "mo"}`,
              sub: getSolvencyRatingLabel(
                calk.solvencyRunwayRating,
                isIndonesian,
              ),
            },
            {
              label: isIndonesian ? "Rasio Utang (DAR)" : "Debt-to-Asset",
              value: `${calk.debtToAssetRatioPct}%`,
              sub: getDebtRatingLabel(calk.debtRating, isIndonesian),
            },
            {
              label: isIndonesian ? "Arus Kas Bebas" : "Free Cashflow",
              value: `${calk.freeCashflowRatePct}%`,
              sub: getFreeCashflowRatingLabel(
                calk.freeCashflowRating,
                isIndonesian,
              ),
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-2xl transition-all"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.04)"
                  : "rgba(0, 0, 0, 0.03)",
                border: controlBorder,
              }}
            >
              <span className="text-[8.5px] uppercase font-bold text-[var(--text-tertiary)] block truncate">
                {item.label}
              </span>
              <span className="amount text-[12px] sm:text-[13px] font-bold mt-0.5 block truncate tabular-nums text-[var(--text-primary)]">
                {item.value}
              </span>
              <span className="text-[8.5px] font-medium text-[var(--text-secondary)] block truncate mt-0.5">
                {item.sub}
              </span>
            </div>
          ))}
        </div>

        {/* Notes Cards Container */}
        <div className="space-y-2 pt-0.5">
          {/* Note 1, 2, 3 Card */}
          <div
            className="p-3.5 rounded-2xl space-y-2.5 text-[11px]"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.02)",
              border: controlBorder,
            }}
          >
            <div>
              <h4 className="text-[11.5px] font-bold text-[var(--text-primary)]">
                {isIndonesian
                  ? "Catatan 1: Penilaian Solvabilitas"
                  : "Note 1: Solvency Assessment"}
              </h4>
              <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
                {getSolvencyDescription(calk, isIndonesian)}
              </p>
            </div>

            <div style={gradientDivider} />

            <div>
              <h4 className="text-[11.5px] font-bold text-[var(--text-primary)]">
                {isIndonesian
                  ? "Catatan 2: Struktur Modal & Leverage"
                  : "Note 2: Capital Structure & Leverage"}
              </h4>
              <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
                {getDebtDescription(calk, isIndonesian)}
              </p>
            </div>

            <div style={gradientDivider} />

            <div>
              <h4 className="text-[11.5px] font-bold text-[var(--text-primary)]">
                {isIndonesian
                  ? "Catatan 3: Retensi & Surplus Arus Kas"
                  : "Note 3: Operating Retention & Surplus"}
              </h4>
              <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
                {getFreeCashflowDescription(calk, isIndonesian)}
              </p>
            </div>
          </div>

          {/* Note 4: Material Transactions */}
          <div
            className="p-3.5 rounded-2xl space-y-2 text-[11px]"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.02)",
              border: controlBorder,
            }}
          >
            <div>
              <h4 className="text-[11.5px] font-bold text-[var(--text-primary)]">
                {isIndonesian
                  ? "Catatan 4: Transaksi Material (≥ 15% Belanja)"
                  : "Note 4: Material Transactions (≥ 15%)"}
              </h4>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                {isIndonesian
                  ? "Transparansi akuntansi untuk transaksi bernilai signifikan terhadap arus kas."
                  : "Accounting disclosure for transactions heavily impacting period cashflow."}
              </p>
            </div>

            <div className="space-y-1 pt-1">
              {calk.materialTransactions.length === 0 ? (
                <p className="text-[10.5px] text-[var(--text-secondary)]">
                  {isIndonesian
                    ? "Tidak ada transaksi individual yang melebihi 15% dari total pengeluaran."
                    : "No single transaction exceeded 15% of total period expenses."}
                </p>
              ) : (
                calk.materialTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2 rounded-xl flex items-center justify-between gap-2"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-medium text-[var(--text-primary)] truncate">
                        {tx.note ||
                          (isIndonesian ? "Transaksi" : "Transaction")}
                      </div>
                      <div className="text-[9.5px] text-[var(--text-tertiary)] truncate">
                        {tx.categoryName} • {tx.date}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="amount text-[11.5px] font-bold text-[var(--text-primary)] tabular-nums">
                        {formatWithPreferred(tx.amount)}
                      </div>
                      <div className="text-[9.5px] text-[var(--text-secondary)] tabular-nums">
                        {tx.percentageOfTotalExpense.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Note 5: Audit Status */}
          <div
            className="p-3.5 rounded-2xl flex items-start gap-2.5 text-[11px]"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.02)",
              border: controlBorder,
            }}
          >
            <ShieldCheck
              size={16}
              strokeWidth={2}
              className="shrink-0 text-[var(--text-primary)] mt-0.5"
            />
            <div className="min-w-0">
              <h4 className="text-[11.5px] font-bold text-[var(--text-primary)]">
                {isIndonesian
                  ? "Catatan 5: Status Rekonsiliasi Audit"
                  : "Note 5: Reconciliation & Audit Status"}
              </h4>
              <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
                {getReconciliationNotes(calk, isIndonesian, formatWithPreferred)}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
