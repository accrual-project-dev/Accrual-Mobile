import { useMemo } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  ShieldCheck,
  TrendingUp,
  Compass,
  Zap,
  Layers,
  Activity,
  ShieldAlert,
  PieChart,
} from "lucide-react";
import {
  calculateFinancialHealthDiagnostic,
  type PersonalBaselineResult,
  type CategoryMoMShift,
} from "../../lib/financialMath";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { usePrivacy } from "../../contexts/PrivacyContext";

interface FinancialHealthDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  healthScore: number;
  savingsRate: number;
  totalIncome: number;
  totalExpense: number;
  rangeTitle: string;
  baselines?: PersonalBaselineResult;
  categoryShifts?: CategoryMoMShift[];
  liquidAssets?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  monthlyDebtService?: number;
  walletBalances?: number[];
}

export function FinancialHealthDiagnosticModal({
  isOpen,
  onClose,
  healthScore,
  savingsRate,
  totalIncome,
  totalExpense,
  rangeTitle,
  baselines,
  categoryShifts = [],
  liquidAssets = 0,
  monthlyDebtService = 0,
  walletBalances = [],
}: FinancialHealthDiagnosticModalProps) {
  const { isIndonesian } = useLanguage();
  const { isStealthMode } = usePrivacy();
  const { currencyMeta, formatWithPreferred } = useCurrency();

  const formatMoney = (amount: number) => {
    if (isStealthMode) {
      return `${currencyMeta?.symbol || "Rp"} ••••••••`;
    }
    return formatWithPreferred(amount);
  };

  const diagnostic = useMemo(() => {
    return calculateFinancialHealthDiagnostic({
      healthScore,
      savingsRate,
      totalIncome,
      totalExpense,
      liquidAssets,
      monthlyDebtService,
      walletBalances,
      baselines,
      categoryShifts,
      isIndonesian,
    });
  }, [
    healthScore,
    savingsRate,
    totalIncome,
    totalExpense,
    liquidAssets,
    monthlyDebtService,
    walletBalances,
    baselines,
    categoryShifts,
    isIndonesian,
  ]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="p-5 space-y-4"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill-strong)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Audit Penasihat Modal" : "Capital Advisory Audit"}
                </span>
              </div>
              <h3
                className="font-semibold text-[17px] leading-snug"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? "Diagnostik Kesehatan Modal" : "Capital Health Diagnostic"}
              </h3>
            </div>
          </div>
          <div className="text-right">
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-xl"
              style={{
                background: "var(--glass-fill-strong)",
                color: "var(--text-primary)",
                border: "1px solid var(--glass-border)",
              }}
            >
              {diagnostic.isZeroData
                ? isIndonesian
                  ? "Kalibrasi"
                  : "Standby"
                : `${isIndonesian ? "Peringkat" : "Tier"} ${diagnostic.rating}`}
            </span>
          </div>
        </div>

        {/* Executive Verdict Hero Card */}
        <div
          className="p-4 rounded-[22px] space-y-3 relative overflow-hidden"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div className="flex justify-between items-center">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Sintesis Diagnostik" : "Diagnostic Synthesis"} · {rangeTitle}
            </span>
            <span
              className="amount text-[12px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {diagnostic.isZeroData
                ? isIndonesian
                  ? "FONDASI AWAL"
                  : "FOUNDATION"
                : `${healthScore} / 100 ${isIndonesian ? "POIN" : "PTS"}`}
            </span>
          </div>

          <div>
            <h4
              className="text-[15px] font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {diagnostic.statusTitle}
            </h4>
            <p
              className="text-[12px] leading-relaxed mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {diagnostic.statusVerdict}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--glass-border)] text-center">
            <div
              className="p-2 rounded-xl min-w-0"
              style={{ background: "var(--glass-fill)" }}
            >
              <p
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Marjin Operasional" : "Operating Margin"}
              </p>
              <p
                className="amount text-[13px] font-semibold mt-0.5 truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {diagnostic.operatingMarginText}
              </p>
            </div>
            <div
              className="p-2 rounded-xl"
              style={{ background: "var(--glass-fill)" }}
            >
              <p
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Kas Tersimpan" : "Retained Cash"}
              </p>
              <p
                className="amount text-[13px] font-semibold mt-0.5 truncate"
                style={{
                  color:
                    diagnostic.netCashflow >= 0
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                {formatMoney(diagnostic.netCashflow)}
              </p>
            </div>
            <div
              className="p-2 rounded-xl"
              style={{ background: "var(--glass-fill)" }}
            >
              <p
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Rasio Burn" : "Burn Ratio"}
              </p>
              <p
                className="amount text-[13px] font-semibold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {diagnostic.operatingRatio > 999
                  ? ">999%"
                  : `${diagnostic.operatingRatio.toFixed(0)}%`}
              </p>
            </div>
          </div>
        </div>

        {/* Resilience Telemetry: Emergency Fund Cushion, DTI & Diversification */}
        <div className="space-y-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Ketahanan Modal & Solvabilitas" : "Capital Resilience & Solvency"}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Metric 1: Emergency Fund Cushion */}
            <div
              className="p-3.5 rounded-2xl flex flex-col justify-between"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Activity size={13} style={{ color: "var(--text-primary)" }} className="shrink-0" />
                    <span
                      className="text-[11px] font-bold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian ? "Dana Darurat" : "Emergency Cushion"}
                    </span>
                  </div>
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: "var(--glass-fill)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {diagnostic.emergencyCushion.badgeLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span
                    className="amount text-[20px] font-bold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {diagnostic.emergencyCushion.months}
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Bulan Biaya Hidup" : "Months of Living Costs"}
                  </span>
                </div>
              </div>
              <p
                className="text-[10.5px] leading-relaxed mt-2"
                style={{ color: "var(--text-secondary)" }}
              >
                {diagnostic.emergencyCushion.verdict}
              </p>
            </div>

            {/* Metric 2: Debt-to-Income (DTI) */}
            <div
              className="p-3.5 rounded-2xl flex flex-col justify-between"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ShieldAlert size={13} style={{ color: "var(--text-primary)" }} className="shrink-0" />
                    <span
                      className="text-[11px] font-bold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian ? "Beban Utang (DTI)" : "Debt-to-Income (DTI)"}
                    </span>
                  </div>
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: "var(--glass-fill)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {diagnostic.dti.badgeLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span
                    className="amount text-[20px] font-bold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {diagnostic.dti.ratioPct}%
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "dari Pemasukan" : "of Monthly Inflow"}
                  </span>
                </div>
              </div>
              <p
                className="text-[10.5px] leading-relaxed mt-2"
                style={{ color: "var(--text-secondary)" }}
              >
                {diagnostic.dti.verdict}
              </p>
            </div>

            {/* Metric 3: Asset Diversification */}
            <div
              className="p-3.5 rounded-2xl flex flex-col justify-between"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PieChart size={13} style={{ color: "var(--text-primary)" }} className="shrink-0" />
                    <span
                      className="text-[11px] font-bold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian ? "Diversifikasi Modal" : "Capital Spread"}
                    </span>
                  </div>
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: "var(--glass-fill)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {diagnostic.diversification.badgeLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span
                    className="amount text-[20px] font-bold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {diagnostic.diversification.score}
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    / 100 {isIndonesian ? "Skor Sebaran" : "Spread Score"}
                  </span>
                </div>
              </div>
              <p
                className="text-[10.5px] leading-relaxed mt-2"
                style={{ color: "var(--text-secondary)" }}
              >
                {diagnostic.diversification.verdict}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Quantitative Diagnostic Pillars */}
        <div className="space-y-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Audit Struktural Empat Pilar" : "Four-Pillar Structural Audit"}
          </span>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Pillar 1 */}
            <div
              className="p-3.5 rounded-2xl flex items-start gap-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <TrendingUp
                  size={13}
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-center">
                  <p
                    className="text-[12px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "1. Retensi Kas & Imbal Hasil" : "1. Cash Retention & Yield"}
                  </p>
                  <span
                    className="text-[10px] font-semibold amount"
                    style={{
                      color:
                        !diagnostic.isZeroData && savingsRate >= 20
                          ? "var(--text-primary)"
                          : "var(--text-tertiary)",
                    }}
                  >
                    {diagnostic.isZeroData
                      ? isIndonesian
                        ? "KALIBRASI"
                        : "CALIBRATING"
                      : savingsRate >= 20
                        ? "OPTIMAL (≥20%)"
                        : isIndonesian
                          ? "KETAT (<20%)"
                          : "TIGHT (<20%)"}
                  </span>
                </div>
                <p
                  className="text-[11px] leading-relaxed mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {diagnostic.isZeroData
                    ? isIndonesian
                      ? "Belum ada transaksi arus masuk atau keluar tercatat di periode ini untuk mengevaluasi efisiensi retensi modal."
                      : "No inflow or outflow transactions recorded in this period to evaluate capital retention efficiency."
                    : savingsRate >= 20
                      ? isIndonesian
                        ? `Anda mengonversi ${savingsRate}% pemasukan langsung menjadi ekuitas tersimpan, melampaui ambang batas keberlanjutan institusional.`
                        : `You convert ${savingsRate}% of inflow directly into retained equity, exceeding standard institutional sustainability thresholds.`
                      : isIndonesian
                        ? `Menyimpan ${savingsRate}% menyisakan ruang gerak operasional yang terbatas. Memperkuat marjin bersih akan melindungi dari volatilitas pendapatan.`
                        : `Retaining ${savingsRate}% leaves limited operational leeway. Strengthening net margin will protect against income volatility.`}
                </p>
              </div>
            </div>

            {/* Pillar 2 */}
            <div
              className="p-3.5 rounded-2xl flex items-start gap-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <Compass size={13} style={{ color: "var(--text-primary)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-center">
                  <p
                    className="text-[12px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "2. Disiplin Baseline" : "2. Baseline Discipline"}
                  </p>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {baselines?.currentMonthStatus
                      ? isIndonesian
                        ? baselines.currentMonthStatus === "above_range"
                          ? "DI ATAS RENTANG"
                          : baselines.currentMonthStatus === "below_range"
                            ? "DI BAWAH RENTANG"
                            : "RENTANG NORMAL"
                        : baselines.currentMonthStatus === "above_range"
                          ? "ABOVE RANGE"
                          : baselines.currentMonthStatus === "below_range"
                            ? "BELOW RANGE"
                            : "NORMAL RANGE"
                      : isIndonesian
                        ? "TERAUDIT"
                        : "AUDITED"}
                  </span>
                </div>
                <p
                  className="text-[11px] leading-relaxed mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {!baselines
                    ? isIndonesian
                      ? "Disiplin baseline paling akurat dievaluasi pada tampilan bulanan, saat periode yang dipilih dapat dibandingkan dengan siklus historis lengkap."
                      : "Baseline discipline is evaluated most accurately in month view, where the selected period can be compared against completed historical cycles."
                    : baselines.currentMonthStatus === "above_range"
                      ? isIndonesian
                        ? `Pengeluaran berada di atas median historis Anda sebesar ${formatMoney(baselines.medianExpense)}. Waspadai pengeluaran non-pokok.`
                        : `Expenditure is tracking above your historical median of ${formatMoney(baselines.medianExpense)}. Watch non-core outflows.`
                      : isIndonesian
                        ? "Pengeluaran disiplin dan tetap berada dalam pita rentang normal historis Anda."
                        : "Spending is disciplined and remains within your proven historical normal bandwidth."}
                </p>
              </div>
            </div>

            {/* Pillar 3 */}
            <div
              className="p-3.5 rounded-2xl flex items-start gap-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <Layers size={13} style={{ color: "var(--text-primary)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-center">
                  <p
                    className="text-[12px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "3. Konsentrasi Pengeluaran" : "3. Expenditure Concentration"}
                  </p>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {diagnostic.topShift
                      ? `+${diagnostic.topShift.pctChange}% MoM`
                      : isIndonesian
                        ? "STABIL"
                        : "STABLE"}
                  </span>
                </div>
                <p
                  className="text-[11px] leading-relaxed mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {diagnostic.topShift
                    ? isIndonesian
                      ? `Peningkatan beban tertinggi dipicu oleh ${diagnostic.topShift.name} (+${formatMoney(diagnostic.topShift.deltaAmount)}).`
                      : `Highest outflow expansion is driven by ${diagnostic.topShift.name} (+${formatMoney(diagnostic.topShift.deltaAmount)}).`
                    : categoryShifts.length === 0
                      ? isIndonesian
                        ? "Konsentrasi kategori dirangkum dalam tampilan bulanan, tempat pergeseran bulanan dapat diukur secara akurat."
                        : "Category concentration is summarized in month view, where month-over-month movement can be measured honestly."
                      : isIndonesian
                        ? "Distribusi pengeluaran antar kategori menunjukkan alokasi yang seimbang tanpa lonjakan konsentrasi ekstrem."
                        : "Outflow distribution across categories shows balanced allocation without severe concentration spikes."}
                </p>
              </div>
            </div>

            {/* Pillar 4 */}
            <div
              className="p-3.5 rounded-2xl flex items-start gap-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <Zap size={13} style={{ color: "var(--text-primary)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-center">
                  <p
                    className="text-[12px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "4. Runway Target Modal" : "4. Capital Goal Runway"}
                  </p>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {diagnostic.isZeroData
                      ? isIndonesian
                        ? "SIAGA"
                        : "STANDBY"
                      : isIndonesian
                        ? "SOLVEN"
                        : "SOLVENT"}
                  </span>
                </div>
                <p
                  className="text-[11px] leading-relaxed mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {diagnostic.isZeroData
                    ? isIndonesian
                      ? "Sistem siap memproyeksikan lintasan pertumbuhan modal begitu transaksi pertama dibukukan."
                      : "System is ready to project capital growth trajectories as soon as transactions are logged."
                    : isIndonesian
                      ? "Kapasitas surplus historis menyediakan lintasan yang stabil untuk mendanai rencana target dan bantalan darurat tanpa leverage eksternal."
                      : "Historical surplus capacity provides a stable trajectory to finance planned milestones and emergency buffers without external leverage."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Strategic Advisory Recommendations */}
        <div className="space-y-2 pt-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Arahan Fokus Strategis" : "Strategic Focus Directives"}
          </span>

          <div
            className="p-4 rounded-[22px] space-y-2.5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {diagnostic.strategicDirectives.map((directive, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <strong style={{ color: "var(--text-primary)" }}>
                    {directive.title}
                  </strong>{" "}
                  {directive.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
