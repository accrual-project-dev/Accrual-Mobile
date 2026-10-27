// ======================================================================
// TROUVAILLE CUSTOMIZE STATISTICS MODAL
// Ultra-luxury Apple Monochrome Liquid Glass
// - Specular rim highlights & tactile segmented controls
// - Inset grouped iOS-style feature clusters with gradient hairlines
// - 100% preserved configuration & widget logic
// ======================================================================

import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Check, ChevronUp, ChevronDown } from "lucide-react";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import type {
  CardWidgetConfig,
  StatisticsPresetKey,
} from "../../lib/widgetLayoutTypes";
import { STATISTICS_PRESETS } from "../../lib/widgetLayoutTypes";

const STATISTICS_CARD_METAS: Record<
  string,
  {
    en: { title: string; subtitle: string };
    id: { title: string; subtitle: string };
  }
> = {
  financial_report: {
    en: {
      title: "Financial Report",
      subtitle: "Balance Sheet, Cash Flows & Disclosures",
    },
    id: {
      title: "Laporan Keuangan",
      subtitle: "Neraca Keuangan, Arus Kas & Catatan Kaki",
    },
  },
  health_score: {
    en: {
      title: "Financial Health Diagnostic Index",
      subtitle:
        "Composite health score, diagnostic pillars & performance rating",
    },
    id: {
      title: "Indeks Ketahanan Finansial",
      subtitle: "Skor komposit kesehatan, pilar diagnosis & rating kinerja",
    },
  },
  monthly_review: {
    en: {
      title: "Monthly Financial Review",
      subtitle: "Period performance review & significant category shifts",
    },
    id: {
      title: "Tinjauan Finansial Bulanan",
      subtitle: "Evaluasi kinerja periode & pergeseran kategori signifikan",
    },
  },
  expense_structure: {
    en: {
      title: "Expense Structure Analysis",
      subtitle: "Essential baseline vs discretionary monthly commitments",
    },
    id: {
      title: "Analisis Struktur Beban",
      subtitle: "Komitmen kebutuhan pokok vs pengeluaran diskresioner",
    },
  },
  spending_patterns: {
    en: {
      title: "Spending Patterns & Cycles",
      subtitle: "Temporal spending cadence & weekday vs weekend pacing",
    },
    id: {
      title: "Pola & Siklus Pengeluaran",
      subtitle: "Ritme waktu belanja & komparasi hari kerja vs akhir pekan",
    },
  },
  cashflow_summary: {
    en: {
      title: "Period Cashflow Summary",
      subtitle: "Net cash retention, total turnover & operational runway",
    },
    id: {
      title: "Ringkasan Arus Kas",
      subtitle: "Retensi kas bersih, total omset & cadangan operasional",
    },
  },
  inflow_outflow_trend: {
    en: {
      title: "Inflow vs Outflow Trend",
      subtitle: "Multi-period historical cash movement comparison",
    },
    id: {
      title: "Tren Arus Masuk vs Keluar",
      subtitle: "Komparasi historis pergerakan kas antar periode",
    },
  },
  category_breakdown: {
    en: {
      title: "Category Expense Breakdown",
      subtitle: "Hierarchical category distribution and share of wallet",
    },
    id: {
      title: "Rincian Beban Kategori",
      subtitle: "Distribusi hierarki kategori & porsi alokasi pengeluaran",
    },
  },
  cashflow_velocity: {
    en: {
      title: "Cashflow Velocity & Pacing",
      subtitle: "Daily burn rate & moving average expenditure curve",
    },
    id: {
      title: "Kecepatan & Pacing Arus Kas",
      subtitle: "Laju pengeluaran harian & kurva rata-rata bergerak",
    },
  },
  fire_planner: {
    en: {
      title: "FIRE Independence Planner",
      subtitle: "Retirement velocity & target capital runway",
    },
    id: {
      title: "Perencana Kemandirian FIRE",
      subtitle: "Kecepatan menuju pensiun & target landasan kapital",
    },
  },
  monte_carlo: {
    en: {
      title: "Monte Carlo Wealth Projection",
      subtitle: "Stochastic probability dispersion across market conditions",
    },
    id: {
      title: "Proyeksi Kekayaan Monte Carlo",
      subtitle:
        "Dispersi probabilitas stokastik melintasi berbagai kondisi pasar",
    },
  },
  what_if_simulator: {
    en: {
      title: "What-If Simulator",
      subtitle: "Interactive shock scenarios & liquidity stress test",
    },
    id: {
      title: "Simulator Skenario What-If",
      subtitle: "Skenario guncangan interaktif & uji stres likuiditas",
    },
  },
  personal_financial_model: {
    en: {
      title: "Personal Financial Model",
      subtitle: "Baseline trajectory, structural runway & liquidity horizon",
    },
    id: {
      title: "Model Finansial Personal",
      subtitle: "Trajektori dasar, landasan struktural & horizon likuiditas",
    },
  },
};

export interface CustomizeStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: CardWidgetConfig[];
  onToggleVisibility: (cardId: string) => void;
  onReset: () => void;
  onApplyPreset: (presetKey: StatisticsPresetKey) => void;
  onEnterGridEdit?: () => void;
  activePresetKey?: StatisticsPresetKey | null;
  onSelectPresetKey?: (key: StatisticsPresetKey | null) => void;
  onReorder?: (reorderedIds: string[]) => void;
  onCycleSize?: (cardId: string) => void;
}

export function CustomizeStatisticsModal({
  isOpen,
  onClose,
  widgets,
  onToggleVisibility,
  onReset,
  onApplyPreset,
  activePresetKey = "executive",
  onSelectPresetKey,
  onReorder,
  onCycleSize,
}: CustomizeStatisticsModalProps) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const isIndonesian = language === "id";

  if (!isOpen) return null;

  const currentPresetDef = STATISTICS_PRESETS.find(
    (preset) => preset.key === activePresetKey,
  );

  const getPresetDescription = () => {
    if (!activePresetKey || !currentPresetDef) {
      return isIndonesian
        ? "Konfigurasi kustom sesuai preferensi Anda"
        : "Custom configuration tailored to your preference";
    }

    if (isIndonesian) {
      switch (activePresetKey) {
        case "executive":
          return "Pusat komando lengkap: skor ketahanan, proyeksi kekayaan & seluruh model skenario";
        case "telemetry":
          return "Fokus telemetri: arus kas operasional, tren siklus belanja & kurva pacing harian";
        case "planning":
          return "Fokus perencanaan jangka panjang: akumulasi kekayaan, target FIRE & simulasi skenario";
        case "essential":
          return "Tampilan esensial tanpa distraksi: skor utama, laporan neraca & arus kas inti";
      }
    }

    return currentPresetDef.description;
  };

  const groups = [
    {
      title: isIndonesian ? "Laporan Keuangan" : "Financial Report",
      ids: ["financial_report"],
    },
    {
      title: isIndonesian ? "Kecerdasan Finansial" : "Financial Intelligence",
      ids: [
        "health_score",
        "monthly_review",
        "expense_structure",
        "spending_patterns",
      ],
    },
    {
      title: isIndonesian ? "Arus Kas & Tren" : "Cashflow & Trend",
      ids: [
        "cashflow_summary",
        "inflow_outflow_trend",
        "category_breakdown",
        "cashflow_velocity",
      ],
    },
    {
      title: isIndonesian ? "Simulasi & Proyeksi" : "Simulation & Planning",
      ids: [
        "fire_planner",
        "monte_carlo",
        "what_if_simulator",
        "personal_financial_model",
      ],
    },
  ];

  // ── Liquid Glass Tactile Materials ──
  const shellBg = isDark
    ? "linear-gradient(160deg, rgba(24, 24, 28, 0.96) 0%, rgba(12, 12, 15, 0.99) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.96) 100%)";

  const shellBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.12)"
    : "1px solid rgba(0, 0, 0, 0.08)";

  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 247, 250, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.085)"
    : "1px solid rgba(0, 0, 0, 0.065)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.22)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.035)";

  // Hairline Gradient Divider
  const gradientDivider = {
    background: isDark
      ? "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.075) 15%, rgba(255, 255, 255, 0.075) 85%, transparent 100%)"
      : "linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.06) 15%, rgba(0, 0, 0, 0.06) 85%, transparent 100%)",
    height: "1px",
    width: "100%",
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-statistics-title"
      >
        {/* Soft Ambient Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-[20px]"
          onClick={onClose}
        />

        {/* ================================================================
            MODAL SHEET CONTAINER
        ================================================================= */}
        <motion.div
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 32, stiffness: 380 }}
          className="relative w-full max-w-md max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden rounded-t-[32px] sm:rounded-[32px] z-10"
          style={{
            background: shellBg,
            border: shellBorder,
            boxShadow: isDark
              ? "0 -16px 48px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.16)"
              : "0 -12px 36px rgba(0, 0, 0, 0.12), inset 0 1px 0 #ffffff",
            backdropFilter: "blur(32px) saturate(190%)",
            WebkitBackdropFilter: "blur(32px) saturate(190%)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Specular Top Rim Reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[10%] right-[10%] top-[1px] h-[1.5px] rounded-full"
            style={{
              background: isDark
                ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), rgba(255,255,255,0.5), rgba(255,255,255,0.3), transparent)"
                : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
            }}
          />

          {/* Drag Handle Notch on Mobile */}
          <div className="w-10 h-1 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden bg-white/20 dark:bg-white/20" />

          {/* ================================================================
              HEADER
          ================================================================= */}
          <div className="shrink-0 px-5 pt-3 sm:pt-4 pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3
                  id="customize-statistics-title"
                  className="text-[16px] font-bold tracking-tight text-[var(--text-primary)] leading-tight"
                >
                  {t("statistics.customizeCards", "Customize Analytics")}
                </h3>
                <p className="mt-0.5 text-[11px] font-normal text-[var(--text-tertiary)] leading-normal truncate">
                  {t(
                    "statistics.customizeCardsDesc",
                    "Personalize analytics cards and dashboard sections",
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onClose();
                }}
                className="shrink-0 w-7.5 h-7.5 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  color: "var(--text-tertiary)",
                }}
                aria-label="Close"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* ================================================================
              SCROLLABLE CONTENT
          ================================================================= */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {/* ==============================================================
                PRESET SEGMENTED CONTROL
            =============================================================== */}
            <div className="px-5 pb-3">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {t("statistics.presetsLabel", "Presets")}
                </span>
              </div>

              {/* Segmented Track */}
              <div
                className="flex items-center w-full p-1 rounded-full select-none"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                }}
              >
                {STATISTICS_PRESETS.map((preset) => {
                  const isActive = activePresetKey === preset.key;

                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        triggerHaptic("medium");
                        onSelectPresetKey?.(preset.key);
                        onApplyPreset(preset.key);
                      }}
                      className="flex-1 min-w-0 py-1.5 px-1 rounded-full text-[11px] text-center truncate select-none cursor-pointer transition-all active:scale-[0.97]"
                      style={{
                        background: isActive
                          ? isDark
                            ? "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.84) 48%, rgba(244,245,247,0.90) 100%)"
                            : "#18181b"
                          : "transparent",
                        color: isActive
                          ? isDark
                            ? "#000000"
                            : "#ffffff"
                          : "var(--text-tertiary)",
                        border: isActive
                          ? isDark
                            ? "1px solid rgba(255, 255, 255, 0.95)"
                            : "1px solid #18181b"
                          : "1px solid transparent",
                        boxShadow: isActive
                          ? isDark
                            ? "inset 0 1px 0 #ffffff, 0 2px 6px rgba(0, 0, 0, 0.25)"
                            : "0 2px 6px rgba(0, 0, 0, 0.14)"
                          : "none",
                        fontWeight: isActive ? 600 : 500,
                      }}
                    >
                      {t(`statistics.presets.${preset.key}`, preset.label)}
                    </button>
                  );
                })}
              </div>

              <p className="mt-1.5 px-1 text-[10.5px] font-normal text-center leading-relaxed text-[var(--text-tertiary)] line-clamp-1">
                {getPresetDescription()}
              </p>
            </div>

            {/* ==============================================================
                FEATURE GROUPS (Inset Grouped iOS Style)
            =============================================================== */}
            <div className="space-y-3.5 px-5 pb-5">
              {groups.map((group) => {
                const groupWidgets = widgets
                  .filter((widget) => group.ids.includes(widget.id))
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

                if (groupWidgets.length === 0) return null;

                return (
                  <section key={group.title}>
                    {/* Section Label */}
                    <div className="px-1 mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        {group.title}
                      </span>
                    </div>

                    {/* Group Inset Card */}
                    <div
                      className="overflow-hidden rounded-2xl transition-all"
                      style={{
                        background: controlBg,
                        border: controlBorder,
                        boxShadow: controlShadow,
                      }}
                    >
                      {groupWidgets.map((widget, index) => {
                        const isEnabled = widget.isVisible;
                        const meta = STATISTICS_CARD_METAS[widget.id];
                        const cardTitle = isIndonesian
                          ? (meta?.id.title ?? widget.title)
                          : (meta?.en.title ?? widget.title);
                        const cardSubtitle = isIndonesian
                          ? (meta?.id.subtitle ?? widget.subtitle)
                          : (meta?.en.subtitle ?? widget.subtitle);

                        const canMoveUp = Boolean(onReorder && index > 0);
                        const canMoveDown = Boolean(
                          onReorder && index < groupWidgets.length - 1,
                        );
                        const handleMoveInGroup = (direction: -1 | 1) => {
                          if (!onReorder) return;
                          const targetIdx = index + direction;
                          if (targetIdx < 0 || targetIdx >= groupWidgets.length) return;
                          triggerHaptic("light");
                          onSelectPresetKey?.(null);
                          const sortedAll = [...widgets].sort(
                            (a, b) => (a.order ?? 0) - (b.order ?? 0),
                          );
                          const idA = groupWidgets[index].id;
                          const idB = groupWidgets[targetIdx].id;
                          const posA = sortedAll.findIndex((w) => w.id === idA);
                          const posB = sortedAll.findIndex((w) => w.id === idB);
                          if (posA !== -1 && posB !== -1) {
                            const temp = sortedAll[posA];
                            sortedAll[posA] = sortedAll[posB];
                            sortedAll[posB] = temp;
                            onReorder(sortedAll.map((w) => w.id));
                          }
                        };

                        return (
                          <div key={widget.id}>
                            {index > 0 && <div style={gradientDivider} />}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                onSelectPresetKey?.(null);
                                onToggleVisibility(widget.id);
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  onSelectPresetKey?.(null);
                                  onToggleVisibility(widget.id);
                                }
                              }}
                              className="flex items-center justify-between gap-2.5 min-h-[54px] px-3.5 py-2.5 cursor-pointer select-none transition-all active:bg-white/[0.04]"
                              style={{
                                opacity: isEnabled ? 1 : 0.6,
                              }}
                            >
                              {/* 1-Tap Up/Down Stepper */}
                              {groupWidgets.length > 1 && onReorder && (
                                <div
                                  className="flex flex-col items-center gap-0.5 shrink-0"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    disabled={!canMoveUp}
                                    onClick={() => handleMoveInGroup(-1)}
                                    className="w-6 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer disabled:opacity-25 disabled:cursor-default active:scale-90"
                                    style={{
                                      background: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                      border: controlBorder,
                                      color: "var(--text-secondary)",
                                    }}
                                    aria-label={isIndonesian ? "Pindah ke atas" : "Move up"}
                                  >
                                    <ChevronUp size={12} strokeWidth={2.2} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canMoveDown}
                                    onClick={() => handleMoveInGroup(1)}
                                    className="w-6 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer disabled:opacity-25 disabled:cursor-default active:scale-90"
                                    style={{
                                      background: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                      border: controlBorder,
                                      color: "var(--text-secondary)",
                                    }}
                                    aria-label={isIndonesian ? "Pindah ke bawah" : "Move down"}
                                  >
                                    <ChevronDown size={12} strokeWidth={2.2} />
                                  </button>
                                </div>
                              )}

                              {/* Text Info */}
                              <div className="min-w-0 flex-1 pr-1">
                                <p className="text-[12.5px] font-semibold text-[var(--text-primary)] leading-tight truncate">
                                  {cardTitle}
                                </p>
                                <p className="mt-0.5 text-[10.5px] text-[var(--text-tertiary)] leading-tight line-clamp-1">
                                  {cardSubtitle}
                                </p>
                              </div>

                              {/* Optional Size Pill + Toggle Switch */}
                              <div
                                className="shrink-0 flex items-center gap-2 ml-1"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {onCycleSize &&
                                  widget.supportedSizes &&
                                  widget.supportedSizes.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        triggerHaptic("light");
                                        onCycleSize(widget.id);
                                      }}
                                      className="h-6 px-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                                      style={{
                                        background: isDark
                                          ? "rgba(255,255,255,0.06)"
                                          : "rgba(0,0,0,0.04)",
                                        border: controlBorder,
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      {widget.size === "half" ? "1/2" : "100%"}
                                    </button>
                                  )}
                                <ToggleSwitch
                                  checked={isEnabled}
                                  onChange={() => {
                                    onSelectPresetKey?.(null);
                                    onToggleVisibility(widget.id);
                                  }}
                                  size="sm"
                                  ariaLabel={`Toggle ${cardTitle}`}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          {/* ================================================================
              FOOTER ACTION DOCK
          ================================================================= */}
          <div
            className="shrink-0 px-5 pt-3 pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),28px)] border-t"
            style={{
              background: shellBg,
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.06)",
            }}
          >
            <div className="flex gap-2.5">
              {/* Reset Defaults */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  onSelectPresetKey?.("executive");
                  onReset();
                }}
                className="flex-1 h-10 rounded-2xl text-[12px] font-semibold cursor-pointer active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                  color: "var(--text-secondary)",
                }}
              >
                <RotateCcw size={12.5} strokeWidth={2} />
                <span>{t("statistics.resetDefaults", "Reset Defaults")}</span>
              </button>

              {/* Done Action Button */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onClose();
                }}
                className="flex-1 h-10 rounded-2xl text-[12px] font-semibold cursor-pointer active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm select-none"
                style={{
                  background: isDark ? "#ffffff" : "#18181b",
                  color: isDark ? "#000000" : "#ffffff",
                }}
              >
                <Check size={13} strokeWidth={2.8} />
                <span>{t("common.done", "Done")}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
