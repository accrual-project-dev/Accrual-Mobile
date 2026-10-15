import { useState } from "react";
import { Layers3, ChevronRight, CheckCircle2 } from "lucide-react";
import type { ExpenseStructureResult } from "../../hooks/useFinancialIntelligence";
import { motion } from "framer-motion";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useTheme } from "../../contexts/ThemeContext";
import { BottomSheet } from "../ui/BottomSheet";

interface ExpenseStructureCardProps {
  expenseStructure: ExpenseStructureResult;
  hideBalance?: boolean;
}

export function ExpenseStructureCard({
  expenseStructure,
  hideBalance = false,
}: ExpenseStructureCardProps) {
  const { formatWithPreferred } = useCurrency();
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const [breakdownSheetOpen, setBreakdownSheetOpen] = useState(false);

  const buckets = [
    {
      key: "fixed",
      label: isIndonesian ? "Tetap" : "Fixed",
      amount: expenseStructure.fixedAmount,
      pct: expenseStructure.fixedPercentage,
      color: isDark ? "#FFFFFF" : "#18181B",
      desc: isIndonesian ? "Sewa, cicilan, tagihan" : "Rent, loans, bills",
    },
    {
      key: "variable",
      label: isIndonesian ? "Pokok" : "Needs",
      amount: expenseStructure.variableAmount,
      pct: expenseStructure.variablePercentage,
      color: isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(24, 24, 27, 0.65)",
      desc: isIndonesian ? "Bahan makanan, transport" : "Groceries, transit",
    },
    {
      key: "discretionary",
      label: isIndonesian ? "Fleksibel" : "Flexible",
      amount: expenseStructure.discretionaryAmount,
      pct: expenseStructure.discretionaryPercentage,
      color: isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(24, 24, 27, 0.35)",
      desc: isIndonesian ? "Hiburan, jajan, belanja" : "Dining, leisure, hobby",
    },
  ] as const;

  const mask = (val: string) => (hideBalance ? "••••••••" : val);

  return (
    <section
      className="relative overflow-hidden rounded-[24px] p-5 transition-all select-none space-y-4"
      style={{
        background: isDark
          ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
          : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid rgba(0, 0, 0, 0.06)",
        boxShadow: isDark
          ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
          : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff",
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

      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              color: "var(--text-primary)",
            }}
          >
            <Layers3 size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {isIndonesian ? "Anatomi Komitmen & Amplop" : "Committed & Envelope Pacing"}
            </h3>
            <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
              {expenseStructure.totalExpense === 0
                ? (isIndonesian
                    ? "Belum ada pengeluaran di periode ini"
                    : "No expenses recorded in this period")
                : (isIndonesian
                    ? `${expenseStructure.committedPercentage.toFixed(0)}% beban rutin tak terhindarkan`
                    : `${expenseStructure.committedPercentage.toFixed(0)}% non-discretionary commitments`)}
            </p>
          </div>
        </div>

        {/* Committed vs Flexible Badge (Single Line) */}
        <div
          className="px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          <span
            className="text-[10.5px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Komitmen" : "Committed"}
          </span>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {expenseStructure.committedPercentage.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* ── 2. Segmented Proportional Bar Chart ─────────────────────────────── */}
      <div
        className="p-3.5 rounded-2xl space-y-2.5"
        style={{
          background: isDark ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.02)",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
        }}
      >
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span style={{ color: "var(--text-tertiary)" }}>
            {isIndonesian ? "Distribusi Beban Pengeluaran" : "Expense Distribution"}
          </span>
          <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {mask(formatWithPreferred(expenseStructure.totalExpense))}
          </span>
        </div>

        {/* Multi-Segment Stacked Bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-white/[0.06] p-0.5 gap-1">
          {buckets.map((b) => (
            <motion.div
              key={b.key}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(b.pct > 0 ? 3 : 0, b.pct)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full relative group"
              style={{ background: b.color }}
              title={`${b.label}: ${b.pct.toFixed(1)}%`}
            />
          ))}
          {expenseStructure.unclassifiedPercentage > 0 && (
            <div
              className="h-full rounded-full opacity-20"
              style={{
                width: `${Math.max(2, expenseStructure.unclassifiedPercentage)}%`,
                background: isDark ? "#FFFFFF" : "#000000",
              }}
              title={`Lainnya: ${expenseStructure.unclassifiedPercentage.toFixed(1)}%`}
            />
          )}
        </div>

        {/* Legend Pills below chart */}
        <div className="grid grid-cols-3 gap-1 pt-1">
          {buckets.map((b) => (
            <div key={b.key} className="flex items-center gap-1.5 min-w-0">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: b.color }}
              />
              <span className="text-[10px] font-medium truncate text-[var(--text-secondary)]">
                {b.label}
              </span>
              <span className="text-[10px] font-bold tabular-nums text-[var(--text-primary)] ml-auto">
                {b.pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. 3-Bucket Metric Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {buckets.map((b) => (
          <div
            key={b.key}
            className="p-3 rounded-2xl flex flex-col justify-between"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
            }}
          >
            <div>
              <p
                className="text-[9.5px] font-semibold uppercase tracking-wider truncate"
                style={{ color: "var(--text-tertiary)" }}
              >
                {b.label}
              </p>
              <p
                className="amount text-[12px] font-bold tabular-nums mt-1"
                style={{ color: "var(--text-primary)" }}
              >
                {mask(formatWithPreferred(b.amount))}
              </p>
            </div>
            <p
              className="text-[9px] mt-1.5 truncate"
              style={{ color: "var(--text-tertiary)" }}
            >
              {b.desc}
            </p>
          </div>
        ))}
      </div>

      {/* ── 4. Strategic Financial Insight ──────────────────────────────────── */}
      <div
        className="p-3 rounded-2xl flex items-center justify-between text-[11px]"
        style={{
          background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
        }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={13} className="text-[var(--text-primary)] shrink-0" />
          <span style={{ color: "var(--text-secondary)" }}>
            {expenseStructure.totalExpense === 0
              ? (isIndonesian
                  ? "Struktur komitmen akan terpetakan otomatis saat transaksi pengeluaran dicatat."
                  : "Expense structure will be automatically mapped once transactions are logged.")
              : expenseStructure.committedPercentage > 70
                ? (isIndonesian
                    ? `${expenseStructure.committedPercentage.toFixed(0)}% beban terkunci pada komitmen rutin. Pertimbangkan efisiensi biaya tetap.`
                    : `${expenseStructure.committedPercentage.toFixed(0)}% locked in fixed commitments. Consider optimizing recurring overhead.`)
                : expenseStructure.flexiblePercentage >= 50
                  ? (isIndonesian
                      ? `${expenseStructure.flexiblePercentage.toFixed(0)}% adalah ruang fleksibel yang lincah dan aman dipangkas saat kondisi darurat.`
                      : `${expenseStructure.flexiblePercentage.toFixed(0)}% of outflow is flexible and agile to trim down during emergencies.`)
                  : (isIndonesian
                      ? `Struktur belanja seimbang: ${expenseStructure.committedPercentage.toFixed(0)}% komitmen dan ${expenseStructure.flexiblePercentage.toFixed(0)}% alokasi fleksibel.`
                      : `Balanced expense structure: ${expenseStructure.committedPercentage.toFixed(0)}% committed and ${expenseStructure.flexiblePercentage.toFixed(0)}% flexible allocation.`)}
          </span>
        </div>
      </div>

      {/* ── 5. Category Breakdown BottomSheet Trigger ──────────────────────── */}
      {expenseStructure.items && expenseStructure.items.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setBreakdownSheetOpen(true);
            }}
            className="w-full pt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold cursor-pointer transition-colors hover:text-[var(--text-primary)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span>
              {isIndonesian
                ? `Lihat Rincian Klasifikasi (${expenseStructure.items.length} Pos)`
                : `View Category Breakdown (${expenseStructure.items.length} Items)`}
            </span>
            <ChevronRight size={13} />
          </button>

          {/* Dedicated Drilldown BottomSheet */}
          <BottomSheet
            isOpen={breakdownSheetOpen}
            onClose={() => setBreakdownSheetOpen(false)}
            title={isIndonesian ? "Klasifikasi Pos Pengeluaran" : "Expense Breakdown"}
          >
            <div className="space-y-4 px-5 pb-6">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-3 gap-2">
                {buckets.map((b) => (
                  <div
                    key={b.key}
                    className="p-3 rounded-2xl flex flex-col justify-between border"
                    style={{
                      background: "var(--glass-fill)",
                      borderColor: "var(--glass-border)",
                    }}
                  >
                    <div>
                      <p
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {b.label}
                      </p>
                      <p
                        className="amount text-[13px] font-bold tabular-nums mt-1"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {mask(formatWithPreferred(b.amount))}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-semibold tabular-nums mt-1.5"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {b.pct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Items List Sorted by Amount */}
              <div className="space-y-2 pt-1">
                <p
                  className="text-[10.5px] font-semibold uppercase tracking-wider px-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Daftar Pos Pengeluaran" : "Category Outflow Details"}
                </p>

                {expenseStructure.items
                  .slice()
                  .sort((a, b) => b.amount - a.amount)
                  .map((item, i) => {
                    const isFixed = item.classification === "fixed";
                    const isVariable = item.classification === "variable";
                    const pctOfTotal =
                      expenseStructure.totalExpense > 0
                        ? (item.amount / expenseStructure.totalExpense) * 100
                        : 0;

                    return (
                      <div
                        key={`item-${i}`}
                        className="p-3.5 rounded-2xl flex items-center justify-between text-[12.5px] border"
                        style={{
                          background: "var(--glass-fill)",
                          borderColor: "var(--glass-border)",
                        }}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                background: isFixed
                                  ? isDark ? "#FFFFFF" : "#18181B"
                                  : isVariable
                                    ? isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(24, 24, 27, 0.65)"
                                    : isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(24, 24, 27, 0.35)",
                              }}
                            />
                            <span className="font-semibold text-[var(--text-primary)] truncate block">
                              {item.name}
                            </span>
                            <span
                              className="text-[9.5px] font-semibold uppercase px-2 py-0.5 rounded-full"
                              style={{
                                background: isDark
                                  ? "rgba(255, 255, 255, 0.08)"
                                  : "rgba(0, 0, 0, 0.05)",
                                color: "var(--text-tertiary)",
                                border: "1px solid var(--glass-border)",
                              }}
                            >
                              {isFixed
                                ? isIndonesian ? "Tetap" : "Fixed"
                                : isVariable
                                  ? isIndonesian ? "Pokok" : "Needs"
                                  : isIndonesian ? "Fleksibel" : "Flexible"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-tertiary)]">
                            {pctOfTotal.toFixed(1)}% {isIndonesian ? "dari total belanja" : "of total outflow"}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="tabular-nums font-bold text-[13.5px] text-[var(--text-primary)] block">
                            {mask(formatWithPreferred(item.amount))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </BottomSheet>
        </>
      )}
    </section>
  );
}
