// ======================================================================
// TROUVAILLE CATEGORY BUDGET ENVELOPES DECK
// Unified Single Card for Top 5 Envelopes Near Spending Limit
// Gentle Setup Notice when no category budgets are configured
// Strictly Apple Monochrome Luxury | Zero Native Emojis | Responsive
// ======================================================================

import { useState, useMemo } from "react";
import {
  ChevronRight,
  Info,
  SlidersHorizontal,
  Target,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { useCategories } from "../../hooks/useCategories";
import { useAllTransactions } from "../../hooks/useTransactions";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { IconRenderer } from "../ui/IconRenderer";
import { BottomSheet } from "../ui/BottomSheet";

interface CategoryBudgetDeckProps {
  onOpenManageCategories?: () => void;
  hideBalance?: boolean;
  isEditMode?: boolean;
}

interface EnvelopeItem {
  id: string;
  name: string;
  emoji: string;
  budgetAmount: number;
  spent: number;
  percentage: number;
  remaining: number;
  isOverbudget: boolean;
}

export function CategoryBudgetDeck({
  onOpenManageCategories,
  hideBalance = false,
  isEditMode = false,
}: CategoryBudgetDeckProps) {
  const { data: categories = [] } = useCategories();
  const { data: allTxs = [] } = useAllTransactions();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();

  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Current month prefix (YYYY-MM)
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // Filter explicitly configured budgets (type !== income && budget_amount > 0)
  const userConfiguredCategories = useMemo(() => {
    return categories.filter(
      (c) => c.type !== "income" && Number(c.budget_amount || 0) > 0,
    );
  }, [categories]);

  // Compute category spend vs configured budget amount
  const envelopes: EnvelopeItem[] = useMemo(() => {
    const spendMap = new Map<string, number>();

    allTxs.forEach((t) => {
      if (t.type !== "expense" || !t.occurred_on) return;
      if (!t.occurred_on.startsWith(currentMonthKey)) return;
      const isCorrection =
        t.note?.includes("[Correction]") ||
        t.note?.includes("Saldo Awal") ||
        t.note?.includes("Opening Balance");
      if (isCorrection) return;

      const amt = Number(t.amount || 0);
      const catId = t.category_id || "uncategorized";
      spendMap.set(catId, (spendMap.get(catId) || 0) + amt);
    });

    const items: EnvelopeItem[] = userConfiguredCategories.map((cat) => {
      const spent = spendMap.get(cat.id) || 0;
      const budgetAmount = Number(cat.budget_amount || 0);
      const percentage =
        budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
      const remaining = budgetAmount - spent;

      return {
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji || "Tag",
        budgetAmount,
        spent,
        percentage,
        remaining,
        isOverbudget: budgetAmount > 0 && spent > budgetAmount,
      };
    });

    return items.sort((a, b) => b.percentage - a.percentage);
  }, [userConfiguredCategories, allTxs, currentMonthKey]);

  // Top 5 envelopes closest to limit
  const top5Envelopes = useMemo(() => {
    return envelopes.slice(0, 5);
  }, [envelopes]);

  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const cardShadow = isDark
    ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
    : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff";

  if (categories.length === 0) return null;

  return (
    <section className="space-y-2.5 select-none">
      {/* Section Header */}
      <div className="flex items-center justify-between px-0.5">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
            {isIndonesian ? "Amplop Anggaran Kategori" : "Category Budgets"}
          </h3>
          <p className="text-[11px] text-[var(--text-tertiary)] font-medium">
            {userConfiguredCategories.length > 0
              ? isIndonesian
                ? "5 kategori paling mendekati batas limit"
                : "Top 5 categories near spending limits"
              : isIndonesian
                ? "Batas belanja & kontrol pengeluaran"
                : "Spending limits & envelope controls"}
          </p>
        </div>

        {/* Action Controls: Info Modal & Manage Categories - Hidden during Edit Mode to avoid collision */}
        {!isEditMode && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setIsInfoOpen(true);
              }}
              className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-[var(--glass-fill)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title={isIndonesian ? "Info Detail Anggaran" : "Budget Envelope Info"}
            >
              <Info size={14} strokeWidth={1.75} />
            </button>

            {onOpenManageCategories && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenManageCategories();
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <span>{isIndonesian ? "Atur" : "Manage"}</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Case 1: User has not configured any category budgets yet (Gentle Setup Prompt) */}
      {userConfiguredCategories.length === 0 ? (
        <div
          className="p-4 rounded-3xl relative overflow-hidden space-y-3 transition-all"
          style={{
            background: cardBg,
            border: cardBorder,
            boxShadow: cardShadow,
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
          }}
        >
          {/* Specular Rim Light Reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
            style={{
              background: isDark
                ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
                : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
            }}
          />

          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                border: cardBorder,
              }}
            >
              <SlidersHorizontal
                size={16}
                strokeWidth={1.75}
                className="text-[var(--text-primary)]"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">
                {isIndonesian
                  ? "Atur Kuota Anggaran Kategori"
                  : "Configure Category Limits"}
              </h4>
              <p className="text-[11.5px] text-[var(--text-tertiary)] leading-relaxed">
                {isIndonesian
                  ? "Anda belum menetapkan batas limit bulanan untuk kategori pengeluaran. Tentukan kuota agar Anda dapat memantau kategori yang mendekati batas secara real-time."
                  : "You haven't set monthly limits on your categories yet. Assign limits to monitor near-capacity envelopes in real time."}
              </p>
            </div>
          </div>

          {onOpenManageCategories && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onOpenManageCategories();
              }}
              className="w-full py-2.5 px-4 rounded-2xl text-[12px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                border: cardBorder,
                color: "var(--text-primary)",
              }}
            >
              <span>
                {isIndonesian
                  ? "Atur Anggaran Kategori Sekarang"
                  : "Set Category Budgets Now"}
              </span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      ) : (
        /* Case 2: Unified Single Card showing Top 5 Budgets Near Limit */
        <div
          className="p-4 sm:p-5 rounded-3xl relative overflow-hidden space-y-3.5 transition-all"
          style={{
            background: cardBg,
            border: cardBorder,
            boxShadow: cardShadow,
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
          }}
        >
          {/* Specular Rim Light Reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
            style={{
              background: isDark
                ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
                : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
            }}
          />

          {top5Envelopes.map((env) => {
            const clampedPct = Math.min(100, Math.max(3, env.percentage));

            return (
              <div key={env.id} className="space-y-1.5">
                {/* Top Row: Category Icon + Name & Quota Breakdown */}
                <div className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                        border: cardBorder,
                      }}
                    >
                      <IconRenderer icon={env.emoji} size="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-[var(--text-primary)] truncate">
                      {env.name}
                    </span>

                    {env.isOverbudget && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.15)"
                            : "rgba(0, 0, 0, 0.08)",
                          color: "var(--text-primary)",
                          border: cardBorder,
                        }}
                      >
                        {isIndonesian ? "Lebih" : "Over"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {hideBalance ? `${currencyMeta.symbol} ••••` : formatWithPreferred(env.spent)}
                    </span>
                    <span className="text-[var(--text-tertiary)]">
                      / {hideBalance ? `${currencyMeta.symbol} ••••` : formatWithPreferred(env.budgetAmount)}
                    </span>
                    <span
                      className={`text-[10.5px] font-bold ml-0.5 ${
                        env.isOverbudget
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)]"
                      }`}
                    >
                      ({env.percentage}%)
                    </span>
                  </div>
                </div>

                {/* Monochromatic Progress Bar */}
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${clampedPct}%`,
                      background: env.isOverbudget
                        ? isDark
                          ? "#FFFFFF"
                          : "#18181B"
                        : "var(--text-primary)",
                    }}
                  />
                </div>

                {/* Bottom Row: Remaining buffer or excess amount */}
                <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                  <span>
                    {env.isOverbudget
                      ? isIndonesian
                        ? "Melampaui batas kuota:"
                        : "Exceeded by:"
                      : isIndonesian
                        ? "Sisa kuota belanja:"
                        : "Remaining quota:"}
                  </span>
                  <span
                    className={
                      env.isOverbudget
                        ? "font-bold text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] font-medium"
                    }
                  >
                    {hideBalance
                      ? `${currencyMeta.symbol} ••••`
                      : `${env.isOverbudget ? "+" : ""}${formatWithPreferred(Math.abs(env.remaining))}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info BottomSheet Modal */}
      <BottomSheet
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        title={isIndonesian ? "Sistem Amplop Anggaran" : "Category Envelope System"}
      >
        <div
          className="p-5 space-y-4 select-none"
          style={{
            paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 16px), 32px)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                border: cardBorder,
              }}
            >
              <Target
                size={18}
                strokeWidth={1.75}
                className="text-[var(--text-primary)]"
              />
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-[var(--text-primary)]">
                {isIndonesian
                  ? "Tentang Amplop Anggaran"
                  : "About Category Envelopes"}
              </h4>
              <p className="text-[11.5px] text-[var(--text-tertiary)]">
                {isIndonesian
                  ? "Prinsip disiplin alokasi kas bulanan"
                  : "Monthly cash allocation discipline"}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            <div
              className="p-3.5 rounded-2xl space-y-1.5"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
                border: cardBorder,
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[var(--text-primary)]" />
                <span className="font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "Top 5 Kategori Paling Mendekati Limit"
                    : "Top 5 Envelopes Near Capacity"}
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--text-tertiary)]">
                {isIndonesian
                  ? "Kartu ini secara otomatis mengurutkan 5 kategori dengan persentase pemakaian kuota tertinggi. Anda dapat langsung mengidentifikasi pos pengeluaran yang berisiko melampaui anggaran sebelum bulan berakhir."
                  : "This card automatically ranks the 5 categories consuming the highest percentage of their budget so you can prevent overspending before month-end."}
              </p>
            </div>

            <div
              className="p-3.5 rounded-2xl space-y-1.5"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
                border: cardBorder,
              }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-[var(--text-primary)]" />
                <span className="font-semibold text-[var(--text-primary)]">
                  {isIndonesian ? "Penetapan Kuota Fleksibel" : "Configuring Limits"}
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--text-tertiary)]">
                {isIndonesian
                  ? "Batas kuota nominal dapat diatur secara mandiri pada setiap kategori melalui tombol 'Atur' di pojok kanan atas."
                  : "Nominal spending limits can be configured individually for each category via the 'Manage' button at top right."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsInfoOpen(false)}
            className="w-full py-3 rounded-2xl text-[12.5px] font-semibold active:scale-[0.98] transition-transform cursor-pointer"
            style={{
              background: "var(--text-primary)",
              color: "var(--bg-base)",
            }}
          >
            {isIndonesian ? "Mengerti" : "Got it"}
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
