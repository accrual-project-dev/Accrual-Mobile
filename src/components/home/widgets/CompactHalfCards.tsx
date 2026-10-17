import { Zap, Clock, SlidersHorizontal, ChevronRight } from "lucide-react";
import { CompactShell } from "./CompactShell";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useCurrency } from "../../../contexts/CurrencyContext";

export function CompactSpendingStabilityHalf({
  level,
  dailyAvg,
  volatilityScore,
  onOpenDetail,
}: {
  level: "Low" | "Moderate" | "High";
  dailyAvg: number;
  volatilityScore: number;
  onOpenDetail?: () => void;
}) {
  const { language } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isIndonesian = language === "id";

  const localizedLevel = isIndonesian
    ? level === "Low"
      ? "Rendah"
      : level === "Moderate"
        ? "Moderat"
        : "Tinggi"
    : level;

  return (
    <CompactShell title={isIndonesian ? "Stabilitas" : "Stability"} onOpenDetail={onOpenDetail}>
      <div className="flex-1 flex flex-col justify-center py-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
            {isIndonesian ? "Rerata Harian" : "Daily Outlay"}
          </span>
          <span
            className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
            style={{
              background: "var(--glass-fill)",
              color: "var(--text-secondary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {localizedLevel}
          </span>
        </div>
        <p className="text-[16px] font-semibold amount text-[var(--text-primary)] leading-tight mt-1">
          {formatWithPreferred(dailyAvg)}
        </p>
      </div>

      <div className="shrink-0">
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mb-1">
          <span>{isIndonesian ? "Variansi" : "Variance"}</span>
          <span className="font-semibold text-[var(--text-secondary)]">
            {(volatilityScore * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--text-primary)] transition-all"
            style={{ width: `${Math.min(100, Math.max(10, volatilityScore * 100))}%` }}
          />
        </div>
      </div>
    </CompactShell>
  );
}

export function CompactCashflowPulseHalf({
  netCashflow,
  consumedPct,
  isAheadOfPace,
  onOpenDetail,
}: {
  netCashflow: number;
  consumedPct: number;
  isAheadOfPace: boolean;
  onOpenDetail?: () => void;
}) {
  const { language } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isIndonesian = language === "id";
  const isSurplus = netCashflow >= 0;

  const paceLabel = isAheadOfPace
    ? isIndonesian ? "Boros" : "Over Pace"
    : isIndonesian ? "Sesuai Jalur" : "On Track";

  return (
    <CompactShell title={isIndonesian ? "Arus Kas" : "Cashflow"} onOpenDetail={onOpenDetail}>
      <div className="flex-1 flex flex-col justify-center py-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
            {isIndonesian ? "Sisa Kas" : "Net Retention"}
          </span>
          <span
            className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
            style={{
              background: "var(--glass-fill)",
              color: isAheadOfPace ? "var(--text-secondary)" : "var(--text-primary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {paceLabel}
          </span>
        </div>
        <p className="text-[16px] font-semibold amount text-[var(--text-primary)] leading-tight mt-1">
          {isSurplus ? "+" : ""}
          {formatWithPreferred(netCashflow)}
        </p>
      </div>

      <div className="shrink-0">
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mb-1">
          <span>{isIndonesian ? "Anggaran Terpakai" : "Budget Used"}</span>
          <span className="font-semibold text-[var(--text-secondary)]">
            {consumedPct.toFixed(0)}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--text-primary)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, consumedPct))}%` }}
          />
        </div>
      </div>
    </CompactShell>
  );
}

export function CompactAIInsightsHalf({
  insightTitle,
  insightCategory,
  onOpenDetail,
}: {
  insightTitle: string;
  insightCategory?: string;
  onOpenDetail?: () => void;
}) {
  const { language } = useLanguage();
  const isIndonesian = language === "id";

  return (
    <CompactShell title={isIndonesian ? "Wawasan Finansial" : "Financial Insight"} onOpenDetail={onOpenDetail}>
      <div className="flex-1 flex items-center py-1">
        <p className="text-[11.5px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2">
          {insightTitle}
        </p>
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-black/5 dark:border-white/5 text-[10px] font-medium text-[var(--text-tertiary)] shrink-0">
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Zap size={9.5} strokeWidth={1.75} className="text-[var(--text-primary)]" />
          </div>
          <span>{isIndonesian ? "Diagnostik" : "Diagnostic"}</span>
        </div>
        {insightCategory && (
          <span
            className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
            style={{
              background: "var(--glass-fill)",
              color: "var(--text-secondary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {insightCategory}
          </span>
        )}
      </div>
    </CompactShell>
  );
}

export function CompactGoalsHalf({
  goalTitle,
  progressPct,
  currentAmount,
  targetAmount,
  onOpenDetail,
}: {
  goalTitle: string;
  progressPct: number;
  currentAmount: number;
  targetAmount: number;
  onOpenDetail?: () => void;
}) {
  const { language } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isIndonesian = language === "id";

  return (
    <CompactShell title={isIndonesian ? "Target Utama" : "Top Goal"} onOpenDetail={onOpenDetail}>
      <div className="flex-1 flex flex-col justify-center py-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate flex-1 min-w-0 pr-1">
            {goalTitle}
          </p>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
            style={{
              background: "var(--glass-fill)",
              color: "var(--text-secondary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {progressPct.toFixed(0)}%
          </span>
        </div>
        <p className="text-[11px] amount text-[var(--text-tertiary)] mt-1 truncate">
          {formatWithPreferred(currentAmount)} / {formatWithPreferred(targetAmount)}
        </p>
      </div>

      <div className="shrink-0">
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--text-primary)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      </div>
    </CompactShell>
  );
}

export function CompactBillsHalf({
  nextBillName,
  nextBillAmount,
  daysLeft,
  onOpenDetail,
}: {
  nextBillName: string;
  nextBillAmount: number;
  daysLeft: number;
  onOpenDetail?: () => void;
}) {
  const { language } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isIndonesian = language === "id";

  const badgeLabel =
    daysLeft <= 0
      ? isIndonesian ? "Jatuh Tempo Hari Ini" : "Due Today"
      : isIndonesian ? `${daysLeft} hr lagi` : `In ${daysLeft}d`;

  return (
    <CompactShell title={isIndonesian ? "Tagihan" : "Next Bill"} onOpenDetail={onOpenDetail}>
      <div className="flex-1 flex flex-col justify-center py-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate flex-1 min-w-0 pr-1">
            {nextBillName}
          </p>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
            style={{
              background: "var(--glass-fill)",
              color: "var(--text-secondary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {badgeLabel}
          </span>
        </div>
        <p className="text-[16px] font-semibold amount text-[var(--text-primary)] leading-tight mt-1">
          {formatWithPreferred(nextBillAmount)}
        </p>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-tertiary)] pt-1 border-t border-black/5 dark:border-white/5 shrink-0">
        <div
          className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <Clock size={9.5} strokeWidth={1.75} className="text-[var(--text-primary)]" />
        </div>
        <span>{isIndonesian ? "Siklus mendatang" : "Upcoming cycle"}</span>
      </div>
    </CompactShell>
  );
}

export function CompactTopCategoriesHalf({
  topCategoryName,
  topCategoryAmount,
  topCategoryPct,
  onOpenDetail,
}: {
  topCategoryName: string;
  topCategoryAmount: number;
  topCategoryPct: number;
  onOpenDetail?: () => void;
}) {
  const { language } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isIndonesian = language === "id";

  return (
    <CompactShell title={isIndonesian ? "Kategori Teratas" : "Top Category"} onOpenDetail={onOpenDetail}>
      <div className="flex-1 flex flex-col justify-center py-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate flex-1 min-w-0 pr-1">
            {topCategoryName}
          </span>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
            style={{
              background: "var(--glass-fill)",
              color: "var(--text-secondary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {topCategoryPct.toFixed(0)}%
          </span>
        </div>
        <p className="text-[16px] font-semibold amount text-[var(--text-primary)] leading-tight mt-1">
          {formatWithPreferred(topCategoryAmount)}
        </p>
      </div>

      <div className="shrink-0">
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--text-primary)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, topCategoryPct))}%` }}
          />
        </div>
      </div>
    </CompactShell>
  );
}

export function CompactCategoryBudgetsHalf({
  topEnvelope,
  totalEnvelopesCount,
  hideBalance,
  onOpenManage,
}: {
  topEnvelope?: {
    name: string;
    spent: number;
    budgetAmount: number;
    percentage: number;
    isOverbudget: boolean;
    emoji?: string;
  } | null;
  totalEnvelopesCount: number;
  hideBalance?: boolean;
  onOpenManage?: () => void;
}) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();

  return (
    <CompactShell
      title={isIndonesian ? "Amplop Anggaran" : "Category Budgets"}
      onOpenDetail={onOpenManage}
    >
      {topEnvelope && totalEnvelopesCount > 0 ? (
        <div className="flex-1 flex flex-col justify-between py-0.5 min-h-0">
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate flex-1 min-w-0 pr-1">
                {topEnvelope.name}
              </span>
              <span
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${
                  topEnvelope.isOverbudget
                    ? "text-[var(--text-primary)] font-bold"
                    : "text-[var(--text-secondary)]"
                }`}
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {topEnvelope.isOverbudget
                  ? isIndonesian
                    ? "Lebih"
                    : "Over"
                  : `${topEnvelope.percentage}%`}
              </span>
            </div>

            <p className="text-[14px] font-semibold amount text-[var(--text-primary)] leading-tight mt-1 truncate">
              {hideBalance
                ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                : formatWithPreferred(topEnvelope.spent)}
              <span className="text-[10px] font-normal text-[var(--text-tertiary)] ml-1">
                /{" "}
                {hideBalance
                  ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                  : formatWithPreferred(topEnvelope.budgetAmount)}
              </span>
            </p>
          </div>

          <div className="shrink-0 space-y-1">
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--text-primary)] transition-all"
                style={{
                  width: `${Math.min(100, Math.max(3, topEnvelope.percentage))}%`,
                }}
              />
            </div>
            <div className="flex justify-between items-center text-[9.5px] text-[var(--text-tertiary)]">
              <span>
                {isIndonesian
                  ? `${totalEnvelopesCount} kuota aktif`
                  : `${totalEnvelopesCount} active`}
              </span>
              <span className="font-medium text-[var(--text-secondary)]">
                {topEnvelope.percentage}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between py-0.5 min-h-0">
          <div className="flex items-center gap-2 pt-1">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <SlidersHorizontal size={13} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[11.5px] font-semibold text-[var(--text-primary)] truncate">
                {isIndonesian ? "Belum Diatur" : "Not Configured"}
              </p>
              <p className="text-[9.5px] text-[var(--text-tertiary)] truncate">
                {isIndonesian ? "Batas kuota belanja" : "Envelope limits"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenManage?.();
            }}
            className="w-full py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <span>{isIndonesian ? "Atur Kuota" : "Set Limits"}</span>
            <ChevronRight size={11} />
          </button>
        </div>
      )}
    </CompactShell>
  );
}

export function CompactSavingsRateVelocityHalf({
  savingsRate,
  runwayMonths,
  onOpenDetail,
}: {
  savingsRate: number;
  runwayMonths: number;
  onOpenDetail?: () => void;
}) {
  const { isIndonesian } = useLanguage();

  return (
    <CompactShell
      title={isIndonesian ? "Rasio & Runway" : "Savings & Runway"}
      onOpenDetail={onOpenDetail}
    >
      <div className="flex-1 flex flex-col justify-between py-0.5 min-h-0">
        {/* Savings Rate Section */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
              {isIndonesian ? "Rasio Tabungan" : "Savings Rate"}
            </span>
            <p className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight mt-0.5">
              {savingsRate}%
            </p>
          </div>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md text-[var(--text-secondary)]"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {savingsRate >= 20 ? (isIndonesian ? "Optimal" : "Optimal") : (isIndonesian ? "Moderat" : "Moderate")}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-black/5 dark:border-white/5 my-0.5" />

        {/* Runway Section */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
              {isIndonesian ? "Runway Kas" : "Runway"}
            </span>
            <p className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight mt-0.5">
              {runwayMonths > 0 ? runwayMonths.toFixed(1) : "0.0"}{" "}
              <span className="text-[10px] font-normal text-[var(--text-tertiary)]">
                {isIndonesian ? "bulan" : "mo"}
              </span>
            </p>
          </div>
          <span className="text-[9.5px] text-[var(--text-tertiary)] font-medium">
            {isIndonesian ? "Cadangan" : "Buffer"}
          </span>
        </div>
      </div>
    </CompactShell>
  );
}


