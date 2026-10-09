import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  X,
  Sparkles,
  TrendingUp,
  Calendar,
  ShieldCheck,
  Activity,
  Pause,
} from "lucide-react";
import type { Transaction, Category } from "../../lib/types";
import { formatRupiah } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { format, parseISO, getDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { resolveTransactionCategory } from "../../lib/categoryResolver";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  buildCascadeCategories,
  buildSpendingHeatmap,
  buildAnnualSpendingHeatmap,
  buildPeriodicCashflowData,
  buildRunwayProjection,
} from "../../lib/wrappedAnalytics";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useWalletBalances } from "../../hooks/useWalletBalances";

interface TopCategoryStat {
  total: number;
  count: number;
  name: string;
  emoji?: string;
}

interface FinancialWrappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  mode: "month" | "year";
  targetDate?: Date;
}

export function FinancialWrappedModal({
  isOpen,
  onClose,
  transactions,
  categories,
  mode,
  targetDate = new Date(),
}: FinancialWrappedModalProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { formatWithPreferred, formatCompactWithPreferred } = useCurrency();
  const { liquidCapital, marketAssets, fixedAssets, totalAssets } =
    useWalletBalances();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState<number>(1);
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseHUD, setShowPauseHUD] = useState(false);
  const totalSlides = 10;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseHUDTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  const handleCenterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");
    setIsPaused((prev) => {
      const next = !prev;
      if (pauseHUDTimerRef.current) {
        clearTimeout(pauseHUDTimerRef.current);
        pauseHUDTimerRef.current = null;
      }
      if (next) {
        // Paused: Show pause HUD overlay for exactly 2 seconds, then fade out while remaining paused
        setShowPauseHUD(true);
        pauseHUDTimerRef.current = setTimeout(() => {
          setShowPauseHUD(false);
          pauseHUDTimerRef.current = null;
        }, 2000);
      } else {
        // Resumed: immediately hide pause HUD
        setShowPauseHUD(false);
      }
      return next;
    });
  };

  const totalAssetVal =
    totalAssets > 0 ? totalAssets : liquidCapital + marketAssets + fixedAssets;

  const assetPcts = useMemo(() => {
    if (totalAssetVal <= 0) {
      return { liquid: 34, physical: 33, invest: 33 };
    }
    const lPct = Math.round((liquidCapital / totalAssetVal) * 100);
    const pPct = Math.round((fixedAssets / totalAssetVal) * 100);
    const iPct = Math.max(0, 100 - lPct - pPct);
    return { liquid: lPct, physical: pPct, invest: iPct };
  }, [totalAssetVal, liquidCapital, fixedAssets]);


  const assetBarHeights = useMemo(() => {
    const maxVal = Math.max(liquidCapital, marketAssets, fixedAssets, 1);
    const h1 = Math.max(12, Math.round((liquidCapital / maxVal) * 90));
    const h2 = Math.max(12, Math.round((fixedAssets / maxVal) * 90));
    const h3 = Math.max(12, Math.round((marketAssets / maxVal) * 90));
    return { liquid: h1, physical: h2, invest: h3 };
  }, [liquidCapital, marketAssets, fixedAssets]);

  const diversificationLabel = useMemo(() => {
    const activeCount = [
      liquidCapital > 0,
      marketAssets > 0,
      fixedAssets > 0,
    ].filter(Boolean).length;
    if (activeCount === 3)
      return isIndonesian
        ? "8.8 / 10 · Terdiversifikasi"
        : "8.8 / 10 · Diversified";
    if (activeCount === 2)
      return isIndonesian ? "6.5 / 10 · Moderat" : "6.5 / 10 · Moderate";
    return isIndonesian
      ? "4.0 / 10 · Terkonsentrasi"
      : "4.0 / 10 · Concentrated";
  }, [liquidCapital, marketAssets, fixedAssets, isIndonesian]);

  // Compute period boundaries
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1;
  const monthKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const yearKey = String(targetYear);

  const periodTitle =
    mode === "month"
      ? format(targetDate, "MMMM yyyy", {
          locale: isIndonesian ? idLocale : undefined,
        })
      : isIndonesian
        ? `Tahun ${targetYear}`
        : `Year ${targetYear}`;

  const periodTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.occurred_on) return false;
      if (mode === "month") {
        return t.occurred_on.startsWith(monthKey);
      }
      return t.occurred_on.startsWith(yearKey);
    });
  }, [transactions, mode, monthKey, yearKey]);

  // Aggregates & Insights
  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const catMap = new Map<
      string,
      { total: number; count: number; name: string; emoji?: string }
    >();
    const dailySpendMap = new Map<string, number>();
    const dailyIncomeMap = new Map<string, number>();
    const weekdaySpend = [0, 0, 0, 0, 0, 0, 0]; // Sun=0, Mon=1, ..., Sat=6

    const catLookup = new Map<string, Category>();
    categories.forEach((c) => catLookup.set(c.id, c));

    let maxSingleExpense = 0;
    let maxExpenseNote = "";
    let maxExpenseDate = "";

    // Track essential spending (Food, Transport, Bills, Utilities, Health, Education)
    let essentialSpend = 0;

    periodTxs.forEach((t) => {
      const amt = Number(t.amount || 0);
      const isCorrection =
        t.note?.includes("[Correction]") ||
        t.note?.includes("Saldo Awal") ||
        t.note?.includes("Opening Balance");

      if (isCorrection) return;

      const d = t.occurred_on.slice(0, 10);

      if (t.type === "income") {
        totalIncome += amt;
        dailyIncomeMap.set(d, (dailyIncomeMap.get(d) || 0) + amt);
      } else if (t.type === "expense") {
        totalExpense += amt;
        dailySpendMap.set(d, (dailySpendMap.get(d) || 0) + amt);

        if (amt > maxSingleExpense) {
          maxSingleExpense = amt;
          maxExpenseNote = t.note || "Expense";
          maxExpenseDate = d;
        }

        const resolvedCat = resolveTransactionCategory(t, categories);
        const catName = resolvedCat.name;
        const existing = catMap.get(catName) || {
          total: 0,
          count: 0,
          name: catName,
          emoji: resolvedCat.emoji,
        };
        existing.total += amt;
        existing.count += 1;
        catMap.set(catName, existing);

        // Check essential categories
        const lowerName = catName.toLowerCase();
        if (
          lowerName.includes("makan") ||
          lowerName.includes("food") ||
          lowerName.includes("belanja") ||
          lowerName.includes("transport") ||
          lowerName.includes("tagihan") ||
          lowerName.includes("bill") ||
          lowerName.includes("listrik") ||
          lowerName.includes("sewa") ||
          lowerName.includes("kesehatan") ||
          lowerName.includes("edukasi") ||
          lowerName.includes("pendidikan")
        ) {
          essentialSpend += amt;
        }

        try {
          const wDay = getDay(parseISO(d));
          weekdaySpend[wDay] += amt;
        } catch {
          // ignore date parse error
        }
      }
    });

    const netCashflow = totalIncome - totalExpense;
    const savingsRate =
      totalIncome > 0
        ? Math.max(
            0,
            Math.round(((totalIncome - totalExpense) / totalIncome) * 100),
          )
        : 0;

    // Top Categories Sorted
    const sortedCats = Array.from(catMap.values()).sort(
      (a, b) => b.total - a.total,
    );
    const topCat: TopCategoryStat | null = sortedCats[0] || null;
    const top4Cats = sortedCats.slice(0, 4);

    // Peak Spending Day
    let peakDate: string | null = null;
    let peakAmount = 0;
    const spendEntries = Array.from(dailySpendMap.entries());
    for (let i = 0; i < spendEntries.length; i++) {
      const [d, amt] = spendEntries[i];
      if (amt > peakAmount) {
        peakAmount = amt;
        peakDate = d;
      }
    }

    const spendValues = spendEntries.map((e) => e[1]);
    const avgDaily =
      spendValues.length > 0 ? totalExpense / spendValues.length : 0;

    // Weekend vs Weekday Spend Ratio
    const weekendSpend = weekdaySpend[0] + weekdaySpend[6];
    const weekendPct =
      totalExpense > 0 ? Math.round((weekendSpend / totalExpense) * 100) : 0;

    // Essential Needs Ratio
    const essentialPct =
      totalExpense > 0
        ? Math.min(100, Math.round((essentialSpend / totalExpense) * 100))
        : 50;

    // Budget Discipline Score (based on savings rate and consistency)
    const disciplineScore = Math.min(
      98,
      Math.max(45, Math.round(50 + savingsRate * 0.4 + essentialPct * 0.1)),
    );

    // Max weekday volume for step bars
    const maxWeekdaySpend = Math.max(...weekdaySpend, 1);

    // Generate normalized curve points for Waves Chart (Image 1 style)
    // Create 10 timeline sample buckets across the period
    const curvePointsCount = 10;
    const sortedDailySpend = Array.from(dailySpendMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    const maxDayVal = Math.max(
      ...Array.from(dailySpendMap.values()),
      ...Array.from(dailyIncomeMap.values()),
      1,
    );

    const wavePoints: {
      x: number;
      inflowY: number;
      outflowY: number;
      dateLabel: string;
      isPeak: boolean;
    }[] = [];

    const bucketSize = Math.max(
      1,
      Math.floor(sortedDailySpend.length / curvePointsCount),
    );
    for (let b = 0; b < curvePointsCount; b++) {
      const slice = sortedDailySpend.slice(
        b * bucketSize,
        (b + 1) * bucketSize,
      );
      const sumOutflow = slice.reduce((acc, curr) => acc + curr[1], 0);
      const avgOutflow = slice.length > 0 ? sumOutflow / slice.length : 0;

      // Approximate inflow distribution
      const approxInflow =
        (totalIncome / curvePointsCount) * (0.6 + 0.8 * Math.sin(b * 0.7));

      const normOutflowY = Math.min(
        75,
        Math.max(15, 80 - (avgOutflow / maxDayVal) * 65),
      );
      const normInflowY = Math.min(
        75,
        Math.max(12, 80 - (approxInflow / maxDayVal) * 60),
      );

      const hasPeak = slice.some((item) => item[0] === peakDate);

      wavePoints.push({
        x: (b / (curvePointsCount - 1)) * 300,
        inflowY: normInflowY,
        outflowY: normOutflowY,
        dateLabel: slice[0]?.[0]?.slice(5) || `Day ${b * 3 + 1}`,
        isPeak: hasPeak || b === 6,
      });
    }

    // Financial Archetype
    let persona = isIndonesian
      ? "The Balanced Achiever"
      : "The Balanced Achiever";
    let personaTag = isIndonesian
      ? "EKUILIBRIUM MODAL OPTIMAL"
      : "OPTIMAL CAPITAL EQUILIBRIUM";
    let personaDesc = isIndonesian
      ? "Anda mempertahankan gaya hidup yang nyaman dengan disiplin terukur, secara konsisten menjaga bantalan modal positif untuk ekspansi masa depan."
      : "You sustain an enjoyable lifestyle with measured discipline, consistently maintaining a positive capital cushion for future expansion.";
    let volatilityLabel = isIndonesian ? "STABIL" : "STABLE";
    let efficiencyGrade = "A-";

    if (savingsRate >= 35 && totalExpense > 0) {
      persona = isIndonesian ? "Arsitek Kapital" : "The Capital Architect";
      personaTag = isIndonesian
        ? "RETENSI MODAL SECARA KOKOH"
        : "FORTRESS-TIER CAPITAL RETENTION";
      personaDesc = isIndonesian
        ? "Tingkat retensi Anda melampaui 35%. Akumulasi kekayaan beroperasi di bawah disiplin finansial ketat dan keseimbangan multi-aset strategis."
        : "Your retention rate exceeds 35%. Wealth accumulation operates under rigorous financial discipline and strategic multi-asset balance.";
      volatilityLabel = isIndonesian ? "RENDAH" : "LOW";
      efficiencyGrade = "A+";
    } else if (totalExpense > totalIncome * 1.15 && totalIncome > 0) {
      persona = isIndonesian ? "Alokator Dinamis" : "The Dynamic Allocator";
      personaTag = isIndonesian
        ? "SIKLUS EKSPANSI & REINVESTASI"
        : "EXPANSION & REINVESTMENT CYCLE";
      personaDesc = isIndonesian
        ? "Fase alokasi modal aktif dengan pengeluaran yang meningkat. Kecepatan kas tinggi, meletakkan fondasi bagi siklus kekayaan berikutnya."
        : "An active capital deployment phase with elevated outflow. Cash velocity is high, laying ground for subsequent wealth cycles.";
      volatilityLabel = isIndonesian ? "DINAMIS" : "DYNAMIC";
      efficiencyGrade = "B";
    } else if (totalExpense === 0 && totalIncome > 0) {
      persona = isIndonesian ? "Akumulator Murni" : "The Pure Accumulator";
      personaTag = isIndonesian ? "ABSORPSI MAKSIMAL" : "MAXIMUM ABSORPTION";
      personaDesc = isIndonesian
        ? "Retensi pemasukan penuh tanpa pengeluaran tercatat sepanjang periode pelaporan ini."
        : "Complete inflow retention with zero expenditure recorded across this reporting timeframe.";
      volatilityLabel = isIndonesian ? "MINIMAL" : "MINIMAL";
      efficiencyGrade = "A+";
    } else if (savingsRate >= 15) {
      persona = isIndonesian ? "Pembangun Handal" : "The Steady Builder";
      personaTag = isIndonesian
        ? "PEMBENTUKAN KONSISTEN"
        : "CONSISTENT COMPOUNDING";
      personaDesc = isIndonesian
        ? "Arus kas terkendali dengan baik, marjin bulanan yang dapat diprediksi, dan stabilitas surplus yang andal."
        : "Well-controlled cashflow with predictable monthly margins and dependable surplus stability.";
      volatilityLabel = isIndonesian ? "STABIL" : "STABLE";
      efficiencyGrade = "A";
    }

    // Stacked Cascade Categories (User reference image style)
    const cascadeCategories = buildCascadeCategories(
      sortedCats,
      totalExpense,
      5,
    );

    // Multiple-series Periodic Cashflow (Slide 2)
    const periodicCashflow = buildPeriodicCashflowData(
      transactions,
      mode,
      targetYear,
      targetMonth,
    );

    // Spending Heatmap (Monthly Matrix for month mode, Full 52-Week 365-day Matrix for year mode)
    const monthlyHeatmap = buildSpendingHeatmap(
      periodTxs,
      targetYear,
      targetMonth,
    );
    const annualHeatmap = buildAnnualSpendingHeatmap(transactions, targetYear);

    // Multi-horizon Runway Projection (bklit projection curve)
    const runway = buildRunwayProjection(totalIncome, totalExpense);

    return {
      totalIncome,
      totalExpense,
      netCashflow,
      savingsRate,
      turnover: totalIncome + totalExpense,
      txCount: periodTxs.length,
      topCat,
      top4Cats,
      topCatPct:
        totalExpense > 0 && topCat
          ? Math.round((topCat.total / totalExpense) * 100)
          : 0,
      peakDate,
      peakAmount,
      avgDaily,
      weekdaySpend,
      maxWeekdaySpend,
      maxSingleExpense,
      maxExpenseNote,
      maxExpenseDate,
      weekendPct,
      essentialPct,
      disciplineScore,
      wavePoints,
      persona,
      personaTag,
      personaDesc,
      volatilityLabel,
      efficiencyGrade,
      cascadeCategories,
      periodicCashflow,
      monthlyHeatmap,
      annualHeatmap,
      heatmap: monthlyHeatmap,
      runway,
    };
  }, [
    transactions,
    periodTxs,
    categories,
    targetYear,
    targetMonth,
    mode,
    isIndonesian,
  ]);

  const handleNext = useCallback(() => {
    triggerHaptic("light");
    setDirection(1);
    if (pauseHUDTimerRef.current) {
      clearTimeout(pauseHUDTimerRef.current);
      pauseHUDTimerRef.current = null;
    }
    setShowPauseHUD(false);
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide((s) => s + 1);
    } else {
      onClose();
    }
  }, [currentSlide, totalSlides, onClose]);

  const handlePrev = useCallback(() => {
    triggerHaptic("light");
    setDirection(-1);
    if (pauseHUDTimerRef.current) {
      clearTimeout(pauseHUDTimerRef.current);
      pauseHUDTimerRef.current = null;
    }
    setShowPauseHUD(false);
    if (currentSlide > 0) {
      setCurrentSlide((s) => s - 1);
    }
  }, [currentSlide]);

  // Auto-advance timer (5.5s per slide)
  useEffect(() => {
    if (!isOpen || isPaused) return;

    timerRef.current = setTimeout(() => {
      if (currentSlide < totalSlides - 1) {
        setDirection(1);
        setCurrentSlide((s) => s + 1);
      }
    }, 5500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, currentSlide, isPaused, totalSlides]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset slide on open
  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
      setDirection(1);
      setIsPaused(false);
      setShowPauseHUD(false);
      if (pauseHUDTimerRef.current) {
        clearTimeout(pauseHUDTimerRef.current);
        pauseHUDTimerRef.current = null;
      }
    }
  }, [isOpen]);

  const slideVariants: Variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.8 },
        opacity: { duration: 0.28, ease: "easeOut" },
        scale: { duration: 0.28, ease: "easeOut" },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -50 : 50,
      opacity: 0,
      scale: 0.98,
      transition: {
        x: { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.8 },
        opacity: { duration: 0.2, ease: "easeIn" },
        scale: { duration: 0.2, ease: "easeIn" },
      },
    }),
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={`fixed inset-0 z-[999] flex flex-col justify-between overflow-hidden select-none transition-colors duration-200 ${
            isDark ? "bg-[#0A0A0D] text-white" : "bg-[#F5F5F7] text-[#09090B]"
          }`}
          style={{ fontFamily: "'Urbanist', sans-serif" }}
        >
          {/* ============================================================ */}
          {/* 1. APPLE FRACTAL GLASS & MONOCHROME GRADIENT MESH BACKDROP */}
          {/* ============================================================ */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Radial Mesh Layers (Silver / Cool White / Deep Slate) */}
            <div
              className={`absolute -top-36 -left-36 w-[480px] h-[480px] rounded-full blur-[130px] ${
                isDark ? "bg-white/[0.045]" : "bg-black/[0.04]"
              }`}
            />
            <div
              className={`absolute top-1/4 -right-36 w-[420px] h-[420px] rounded-full blur-[140px] ${
                isDark ? "bg-zinc-400/[0.035]" : "bg-zinc-400/[0.08]"
              }`}
            />
            <div
              className={`absolute -bottom-36 left-1/4 w-[500px] h-[500px] rounded-full blur-[150px] ${
                isDark ? "bg-white/[0.04]" : "bg-black/[0.035]"
              }`}
            />

            {/* Fluted Fractal Glass Slats (Vertical Light Refraction Texture) */}
            <div
              className="absolute inset-0 opacity-[0.4]"
              style={{
                backgroundImage: isDark
                  ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 34px)"
                  : "repeating-linear-gradient(90deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 1px, transparent 1px, transparent 34px)",
              }}
            />

            {/* Subtle Ambient Vignette */}
            <div
              className="absolute inset-0"
              style={{
                background: isDark
                  ? "radial-gradient(ellipse at center, transparent 30%, rgba(10,10,13,0.85) 100%)"
                  : "radial-gradient(ellipse at center, transparent 30%, rgba(245,245,247,0.8) 100%)",
              }}
            />
          </div>

          {/* ============================================================ */}
          {/* 2. TOP STORY PROGRESS BAR & NAVIGATION HEADER */}
          {/* ============================================================ */}
          <div
            className="absolute top-0 left-0 right-0 z-40 px-4 pb-2 flex flex-col gap-2"
            style={{
              paddingTop:
                "max(calc(env(safe-area-inset-top, 0px) + 12px), 24px)",
            }}
          >
            {/* Multi-segment story progress line */}
            <div className="flex gap-1.5 w-full mb-1">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <div
                  key={i}
                  className={`h-[2.5px] flex-1 rounded-full overflow-hidden backdrop-blur-md ${
                    isDark ? "bg-white/20" : "bg-black/15"
                  }`}
                >
                  <motion.div
                    key={`${i}-${currentSlide}`}
                    className={`h-full rounded-full ${
                      isDark ? "bg-white" : "bg-[#09090B]"
                    }`}
                    initial={{ width: i < currentSlide ? "100%" : "0%" }}
                    animate={{
                      width:
                        i < currentSlide
                          ? "100%"
                          : i === currentSlide
                            ? "100%"
                            : "0%",
                    }}
                    transition={{
                      duration: i === currentSlide ? 5.5 : 0,
                      ease: "linear",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Elegant Apple Story Header (Single Row, Never Wraps) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-xl ${
                    isDark
                      ? "bg-white/[0.08] border-white/15 text-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
                      : "bg-black/[0.05] border-black/10 text-black/90 shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isDark ? "bg-white/90" : "bg-black/90"
                    }`}
                  />
                  <span className="text-[11px] font-bold tracking-wider uppercase whitespace-nowrap truncate max-w-[170px] sm:max-w-xs">
                    {isIndonesian ? "Wrapped" : "Wrapped"} · {periodTitle}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onClose();
                  }}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center active:scale-90 transition-transform cursor-pointer backdrop-blur-xl ${
                    isDark
                      ? "bg-white/[0.08] border-white/15 text-white/90 hover:text-white hover:bg-white/[0.14] shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
                      : "bg-black/[0.05] border-black/10 text-black/90 hover:text-black hover:bg-black/[0.09] shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                  }`}
                  title={isIndonesian ? "Tutup" : "Close"}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* CENTERED LIQUID GLASS PAUSE HUD OVERLAY                     */}
          {/* ============================================================ */}
          <AnimatePresence>
            {showPauseHUD && (
              <motion.div
                data-html2canvas-ignore="true"
                data-ignore-export="true"
                initial={{
                  opacity: 0,
                  scale: 0.65,
                  y: "-35%",
                  filter: "blur(10px)",
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: "-50%",
                  filter: "blur(0px)",
                }}
                exit={{
                  opacity: 0,
                  scale: 0.75,
                  y: "-40%",
                  filter: "blur(8px)",
                }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none select-none flex flex-col items-center justify-center gap-2 px-4 py-2 rounded-[20px]"
                style={{
                  background: isDark
                    ? "linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 100%)"
                    : "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%)",
                  backdropFilter: "blur(32px) saturate(190%)",
                  WebkitBackdropFilter: "blur(32px) saturate(190%)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.22)"
                    : "1px solid rgba(255, 255, 255, 0.85)",
                  boxShadow: isDark
                    ? "0 24px 60px rgba(0, 0, 0, 0.8), inset 0 1.5px 1px rgba(255, 255, 255, 0.35), inset 0 -1px 1px rgba(0, 0, 0, 0.5)"
                    : "0 20px 50px rgba(0, 0, 0, 0.12), inset 0 1.5px 1.5px rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(0, 0, 0, 0.05)",
                  color: isDark ? "#ffffff" : "#09090b",
                }}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center ${
                    isDark
                      ? "bg-white/15 text-white"
                      : "bg-black/5 text-[#09090b]"
                  }`}
                  style={{
                    boxShadow: isDark
                      ? "inset 0 1px 1px rgba(255, 255, 255, 0.3)"
                      : "inset 0 1px 1px rgba(255, 255, 255, 0.9)",
                  }}
                >
                  <Pause size={18} fill="currentColor" strokeWidth={0} />
                </div>
                <span
                  className={`text-[10px]  tracking-[0.25em] uppercase font-bold ${
                    isDark ? "text-white/90" : "text-[#09090b]/80"
                  }`}
                >
                  {isIndonesian ? "DIJEDA" : "PAUSED"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ============================================================ */}
          {/* 3. TAP ZONES FOR SLIDE NAVIGATION */}
          {/* ============================================================ */}
          {currentSlide < totalSlides - 1 ? (
            <div
              data-html2canvas-ignore="true"
              data-ignore-export="true"
              className="absolute inset-x-0 z-30 flex pointer-events-auto"
              style={{
                top: "max(calc(env(safe-area-inset-top, 0px) + 50px), 88px)",
                bottom: 0,
              }}
            >
              {/* Left Zone: Previous Slide */}
              <div
                className="w-[33%] h-full cursor-pointer select-none"
                title={
                  isIndonesian
                    ? "Klik untuk slide sebelumnya"
                    : "Click for previous slide"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
              />

              {/* Center Zone: Pause / Resume Slide */}
              <div
                className="w-[34%] h-full cursor-pointer select-none flex items-center justify-center"
                title={
                  isIndonesian
                    ? "Klik untuk jeda / lanjutkan"
                    : "Click to pause / resume"
                }
                onClick={handleCenterClick}
              />

              {/* Right Zone: Next Slide */}
              <div
                className="w-[33%] h-full cursor-pointer select-none"
                title={
                  isIndonesian
                    ? "Klik untuk slide berikutnya"
                    : "Click for next slide"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
              />
            </div>
          ) : (
            /* Slide 10 (Last slide): No Pause, No Next. Only Left tap zone in upper 35% of screen. */
            <div
              data-html2canvas-ignore="true"
              data-ignore-export="true"
              className="absolute inset-x-0 z-30 pointer-events-none flex"
              style={{
                top: "max(calc(env(safe-area-inset-top, 0px) + 50px), 88px)",
                height: "35%",
              }}
            >
              <div
                className="w-[30%] h-full cursor-pointer select-none pointer-events-auto"
                title={
                  isIndonesian
                    ? "Klik untuk slide sebelumnya"
                    : "Click for previous slide"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
              />
            </div>
          )}

          {/* ============================================================ */}
          {/* 4. DYNAMIC SLIDE CONTENT */}
          {/* ============================================================ */}
          <div
            ref={slideContainerRef}
            className={`flex-1 flex flex-col justify-center px-6 relative max-w-lg mx-auto w-full h-full min-h-0 overflow-hidden ${
              currentSlide === totalSlides - 1
                ? "z-40 pointer-events-auto"
                : "z-20"
            }`}
            style={{
              paddingTop:
                "max(calc(env(safe-area-inset-top, 0px) + 56px), 108px)",
              paddingBottom:
                "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 36px)",
            }}
          >
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              {/* -------------------------------------------------------- */}
              {/* SLIDE 0: Editorial Brutalist Architectural Cover         */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 0 && (
                <motion.div
                  key="slide-0"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col text-left space-y-6"
                >
                  {/* Asymmetric Technical Tag */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px]  tracking-[0.25em] uppercase ${
                        isDark ? "text-zinc-400" : "text-zinc-600"
                      }`}
                    >
                      {isIndonesian ? "ARSIP.SISTEM" : "SYS.ARCHIVE"} //{" "}
                      {periodTitle.toUpperCase()}
                    </span>
                    <span
                      className={`text-[11px]  font-medium ${
                        isDark ? "text-white/40" : "text-black/40"
                      }`}
                    >
                      [01 / 10]
                    </span>
                  </div>

                  {/* Hero Typographic Stacking */}
                  <div>
                    <h1
                      className={`text-4xl sm:text-5xl font-light tracking-tighter leading-none ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      {mode === "month"
                        ? isIndonesian
                          ? "KILAS BALIK"
                          : "MONTHLY"
                        : isIndonesian
                          ? "KILAS BALIK"
                          : "ANNUAL"}
                      <span className="block font-semibold mt-1">
                        {isIndonesian
                          ? mode === "month"
                            ? "BULANAN."
                            : "TAHUNAN."
                          : "WRAPPED."}
                      </span>
                    </h1>
                    <p
                      className={`text-[12px] font-normal tracking-wider mt-2.5 ${
                        isDark ? "text-zinc-400" : "text-zinc-600"
                      }`}
                    >
                      {isIndonesian
                        ? "Intelijen Eksekutif · Audit Finansial Pribadi"
                        : "Executive Intelligence · Private Financial Audit"}
                    </p>
                  </div>

                  {/* Open Floating Turnover Display */}
                  <div className="pt-2">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span
                        className={`text-[10px]  tracking-wider uppercase ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {isIndonesian
                          ? "TOTAL PERPUTARAN MODAL"
                          : "TOTAL CAPITAL TURNOVER"}
                      </span>
                      <span
                        className={`text-[11px]  ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {stats.txCount} {isIndonesian ? "OPS" : "OPS"}
                      </span>
                    </div>

                    <p
                      className={`amount text-4xl sm:text-5xl font-light tracking-tight leading-tight ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      {formatWithPreferred(stats.turnover)}
                    </p>
                  </div>

                  {/* Minimalist Floating Stat Row */}
                  <div
                    className={`grid grid-cols-2 gap-4 pt-4 border-t ${
                      isDark ? "border-white/10" : "border-black/10"
                    }`}
                  >
                    <div>
                      <span
                        className={`text-[10px]  uppercase tracking-wider block ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {isIndonesian ? "BEBAN HARIAN" : "BURN RATE / DAY"}
                      </span>
                      <span
                        className={`text-[15px] font-medium mt-1 block ${
                          isDark ? "text-white" : "text-[#09090B]"
                        }`}
                      >
                        ~{formatWithPreferred(stats.avgDaily)}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`text-[10px]  uppercase tracking-wider block ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {isIndonesian
                          ? "EFISIENSI RETENSI"
                          : "RETENTION EFFICIENCY"}
                      </span>
                      <span
                        className={`text-[15px] font-medium mt-1 block ${
                          isDark ? "text-white" : "text-[#09090B]"
                        }`}
                      >
                        {stats.savingsRate}%{" "}
                        {isIndonesian ? "Tersimpan" : "Retained"}
                      </span>
                    </div>
                  </div>

                  {/* Geometric Telemetry Footer Pill */}
                  <div
                    className={`pt-2 flex items-center justify-between text-[10px]  ${
                      isDark ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                        isDark
                          ? "bg-white/[0.05] border-white/10 text-zinc-300"
                          : "bg-black/[0.04] border-black/10 text-zinc-700"
                      }`}
                    >
                      <span>
                        {isIndonesian ? "PERINGKAT" : "TIER"}:{" "}
                        {stats.efficiencyGrade}
                      </span>
                      <span
                        className={isDark ? "text-white/20" : "text-black/20"}
                      >
                        |
                      </span>
                      <span>
                        {isIndonesian ? "DISIPLIN" : "DISCIPLINE"}:{" "}
                        {stats.disciplineScore}%
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-1 text-[11px] font-light tracking-wider ${
                        isDark ? "text-zinc-400" : "text-zinc-600"
                      }`}
                    >
                      <span>
                        {isIndonesian
                          ? "Lihat perjalanan Anda"
                          : "Let's see your journey"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* -------------------------------------------------------- */}
              {/* -------------------------------------------------------- */}
              {/* SLIDE 1: Multiple-Series Periodic Cashflow Bar Chart     */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 1 && (
                <motion.div
                  key="slide-1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-4 text-left"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[10px]  uppercase tracking-[0.2em] ${
                          isDark ? "text-white/50" : "text-black/50"
                        }`}
                      >
                        {isIndonesian
                          ? "Seri Arus Kas · [02 / 10]"
                          : "Cashflow Series · [02 / 10]"}
                      </span>
                      <span
                        className={`text-[10px] font-normal px-2.5 py-0.5 rounded-full border ${
                          isDark
                            ? "bg-white/[0.08] text-white/80 border-white/10"
                            : "bg-black/[0.05] text-black/80 border-black/10"
                        }`}
                      >
                        {mode === "year"
                          ? isIndonesian
                            ? "Seri Bulanan"
                            : "Monthly Series"
                          : isIndonesian
                            ? "Seri Mingguan"
                            : "Weekly Series"}
                      </span>
                    </div>
                    <h2
                      className={`text-2xl sm:text-3xl font-medium tracking-tight ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      {isIndonesian
                        ? "Dinamika Arus Masuk & Keluar"
                        : "Inflow & Outflow Dynamics"}
                    </h2>
                    <p
                      className={`text-[12px] font-light mt-0.5 ${
                        isDark ? "text-white/50" : "text-black/50"
                      }`}
                    >
                      {mode === "year"
                        ? isIndonesian
                          ? "Volume modal komparatif bulanan sepanjang tahun"
                          : "Monthly comparative capital volume across the year"
                        : isIndonesian
                          ? "Volume modal komparatif sepanjang bulan pelaporan"
                          : "Weekly comparative capital volume across the reporting month"}
                    </p>
                  </div>

                  {/* Multiple Series Bar Chart Canvas */}
                  <div className="relative py-2">
                    {/* Background guidelines */}
                    <div className="absolute inset-x-0 inset-y-3 pointer-events-none flex flex-col justify-between opacity-15">
                      <div
                        className={`border-b border-dashed ${isDark ? "border-white" : "border-black"}`}
                      />
                      <div
                        className={`border-b border-dashed ${isDark ? "border-white" : "border-black"}`}
                      />
                      <div
                        className={`border-b border-dashed ${isDark ? "border-white" : "border-black"}`}
                      />
                    </div>

                    {/* Bars Grid */}
                    <div className="w-full h-44 relative z-10 flex items-end justify-between gap-1 sm:gap-2 px-1 pt-4 pb-6">
                      {(() => {
                        const maxVal = Math.max(
                          ...stats.periodicCashflow.map((p) =>
                            Math.max(p.inflow, p.outflow),
                          ),
                          1,
                        );

                        return stats.periodicCashflow.map((pt) => {
                          const inflowHeightPct = Math.min(
                            100,
                            Math.max(4, Math.round((pt.inflow / maxVal) * 92)),
                          );
                          const outflowHeightPct = Math.min(
                            100,
                            Math.max(4, Math.round((pt.outflow / maxVal) * 92)),
                          );

                          return (
                            <div
                              key={pt.label}
                              className="flex-1 flex flex-col items-center h-full justify-end group relative"
                            >
                              {/* Dual Bars side-by-side */}
                              <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                                {/* Inflow Bar (Solid Accent) */}
                                <div
                                  className={`w-[45%] rounded-t-sm transition-all duration-500 ${
                                    isDark
                                      ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                                      : "bg-[#18181b]"
                                  }`}
                                  style={{
                                    height:
                                      pt.inflow > 0
                                        ? `${inflowHeightPct}%`
                                        : "2px",
                                    opacity: pt.inflow > 0 ? 1 : 0.2,
                                  }}
                                  title={`${isIndonesian ? "Pemasukan" : "Inflow"}: +${formatRupiah(pt.inflow)}`}
                                />

                                {/* Outflow Bar (Frosted Accent) */}
                                <div
                                  className={`w-[45%] rounded-t-sm transition-all duration-500 ${
                                    isDark
                                      ? "bg-white/35 border-t border-white/40"
                                      : "bg-black/30 border-t border-black/40"
                                  }`}
                                  style={{
                                    height:
                                      pt.outflow > 0
                                        ? `${outflowHeightPct}%`
                                        : "2px",
                                    opacity: pt.outflow > 0 ? 1 : 0.2,
                                  }}
                                  title={`${isIndonesian ? "Pengeluaran" : "Outflow"}: -${formatRupiah(pt.outflow)}`}
                                />
                              </div>

                              {/* Label */}
                              <span
                                className={`absolute -bottom-5 text-[10px]  text-center truncate w-full ${
                                  pt.isPeakOutflow
                                    ? isDark
                                      ? "font-semibold text-white"
                                      : "font-semibold text-black"
                                    : isDark
                                      ? "text-zinc-400"
                                      : "text-zinc-600"
                                }`}
                              >
                                {pt.label}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Floating Legend */}
                    <div
                      className={`flex justify-between items-center text-[11px] pt-3 mt-4 border-t ${
                        isDark
                          ? "border-white/10 text-white/70"
                          : "border-black/10 text-black/70"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-sm ${
                            isDark ? "bg-white" : "bg-[#18181b]"
                          }`}
                        />
                        <span>
                          {isIndonesian ? "Pemasukan: +" : "Inflow: +"}
                          {formatRupiah(stats.totalIncome)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-sm ${
                            isDark ? "bg-white/35" : "bg-black/30"
                          }`}
                        />
                        <span>
                          {isIndonesian ? "Pengeluaran: -" : "Outflow: -"}
                          {formatRupiah(stats.totalExpense)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Period Peak Callout Card */}
                  <div
                    className={`p-3 rounded-2xl border flex items-center justify-between text-left ${
                      isDark
                        ? "bg-white/[0.04] border-white/[0.1]"
                        : "bg-black/[0.035] border-black/[0.08]"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <span
                        className={`text-[9px]  uppercase tracking-wider block ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {mode === "year"
                          ? isIndonesian
                            ? "BULAN DENGAN DISRUPSI TERTINGGI"
                            : "PEAK DISRUPTION MONTH"
                          : isIndonesian
                            ? "INTERVAL DENGAN DISRUPSI TERTINGGI"
                            : "PEAK DISRUPTION INTERVAL"}
                      </span>
                      <p
                        className={`text-[12px] font-normal truncate mt-0.5 ${
                          isDark ? "text-white" : "text-[#09090B]"
                        }`}
                      >
                        {(() => {
                          const peakP =
                            stats.periodicCashflow.find(
                              (p) => p.isPeakOutflow,
                            ) || stats.periodicCashflow[0];
                          return `${peakP?.label} (${
                            mode === "year"
                              ? isIndonesian
                                ? "Total Pengeluaran"
                                : "Total Outflow"
                              : peakP?.subLabel || ""
                          })`;
                        })()}
                      </p>
                    </div>
                    <p
                      className={`amount text-[13px] font-medium shrink-0 ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      -
                      {formatRupiah(
                        Math.max(
                          ...stats.periodicCashflow.map((p) => p.outflow),
                          0,
                        ),
                      )}
                    </p>
                  </div>

                  {/* Net Retention Surplus Strip */}
                  <div
                    className={`flex items-center justify-between pt-1 text-[12px] ${
                      isDark ? "text-zinc-300" : "text-zinc-700"
                    }`}
                  >
                    <span>
                      {isIndonesian
                        ? "Surplus Retensi Bersih:"
                        : "Net Retention Surplus:"}
                    </span>
                    <span
                      className={`font-semibold ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      {stats.netCashflow >= 0 ? "+" : ""}
                      {formatRupiah(stats.netCashflow)} ({stats.savingsRate}%)
                    </span>
                  </div>
                </motion.div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SLIDE 2: Key Numbers Editorial Prospectus (Reference)   */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 2 && (
                <motion.div
                  key="slide-2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-3 sm:space-y-4 text-left"
                >
                  {/* Header with Superscript Footnote 1 */}
                  <div className="flex justify-between items-baseline mb-2">
                    <div>
                      <span
                        className={`text-[10px]  uppercase tracking-[0.25em] block mb-1 ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        PROSPECTUS · [03 / 10]
                      </span>
                      <h2
                        className={`text-3xl sm:text-4xl font-light tracking-tight ${
                          isDark ? "text-white" : "text-[#09090B]"
                        }`}
                      >
                        {isIndonesian ? "Angka Kunci" : "Key Numbers"}
                        <sup
                          className={`text-sm font-light ml-0.5 ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          1
                        </sup>
                      </h2>
                    </div>
                    <span
                      className={`text-[10px]  px-2.5 py-1 rounded-full border ${
                        isDark
                          ? "bg-white/[0.08] text-white/80 border-white/15"
                          : "bg-black/[0.05] text-black/80 border-black/10"
                      }`}
                    >
                      {isIndonesian ? "Accrual" : "Accrual"}
                    </span>
                  </div>

                  {/* Editorial Rows with crisp hairline dividers */}
                  <div
                    className={`border-t border-b ${
                      isDark
                        ? "border-white/20 divide-y divide-white/15"
                        : "border-black/15 divide-y divide-black/10"
                    }`}
                  >
                    {/* Row 1: Net Cumulative Capital Turnover */}
                    <div className="py-2.5 sm:py-3.5 flex items-center justify-between">
                      <div className="pr-3 max-w-[60%]">
                        <span
                          className={`text-[12px] sm:text-[13px] font-normal leading-snug ${
                            isDark ? "text-zinc-200" : "text-zinc-800"
                          }`}
                        >
                          <span
                            className={`mr-1.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            →
                          </span>
                          {isIndonesian
                            ? "Perputaran Modal Bersih"
                            : "Net Capital Turnover"}
                          <sup
                            className={`text-[9px] ml-0.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            2
                          </sup>
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`amount text-2xl sm:text-3xl md:text-4xl font-light tracking-tight ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.turnover >= 1_000_000
                            ? formatCompactWithPreferred(stats.turnover)
                            : formatWithPreferred(stats.turnover)}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Retained Capital Surplus */}
                    <div className="py-2.5 sm:py-3.5 flex items-center justify-between">
                      <div className="pr-3 max-w-[60%]">
                        <span
                          className={`text-[12px] sm:text-[13px] font-normal leading-snug ${
                            isDark ? "text-zinc-200" : "text-zinc-800"
                          }`}
                        >
                          <span
                            className={`mr-1.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            →
                          </span>
                          {isIndonesian
                            ? "Surplus Modal Tersimpan"
                            : "Retained Capital Surplus"}
                          <sup
                            className={`text-[9px] ml-0.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            3
                          </sup>
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`amount text-2xl sm:text-3xl md:text-4xl font-light tracking-tight ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.savingsRate >= 50 ? ">" : ""}
                          {stats.savingsRate}%
                        </span>
                      </div>
                    </div>

                    {/* Row 3: Net Operating Cushion */}
                    <div className="py-2.5 sm:py-3.5 flex items-center justify-between">
                      <div className="pr-3 max-w-[60%]">
                        <span
                          className={`text-[12px] sm:text-[13px] font-normal leading-snug ${
                            isDark ? "text-zinc-200" : "text-zinc-800"
                          }`}
                        >
                          <span
                            className={`mr-1.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            →
                          </span>
                          {isIndonesian
                            ? "Bantalan Operasional Bersih"
                            : "Net Operating Cushion"}
                          <sup
                            className={`text-[9px] ml-0.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            4
                          </sup>
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`amount text-2xl sm:text-3xl md:text-4xl font-light tracking-tight ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.netCashflow >= 0 ? "+" : "-"}
                          {Math.abs(stats.netCashflow) >= 1_000_000
                            ? formatCompactWithPreferred(
                                Math.abs(stats.netCashflow),
                              )
                            : formatWithPreferred(Math.abs(stats.netCashflow))}
                        </span>
                      </div>
                    </div>

                    {/* Row 4: Essential Living Allocation Index */}
                    <div className="py-2.5 sm:py-3.5 flex items-center justify-between">
                      <div className="pr-3 max-w-[60%]">
                        <span
                          className={`text-[12px] sm:text-[13px] font-normal leading-snug ${
                            isDark ? "text-zinc-200" : "text-zinc-800"
                          }`}
                        >
                          <span
                            className={`mr-1.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            →
                          </span>
                          {isIndonesian
                            ? "Indeks Alokasi Pokok"
                            : "Essential Allocation Index"}
                          <sup
                            className={`text-[9px] ml-0.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            5
                          </sup>
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`amount text-2xl sm:text-3xl md:text-4xl font-light tracking-tight ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.essentialPct >= 50 ? ">" : ""}
                          {stats.essentialPct}%
                        </span>
                      </div>
                    </div>

                    {/* Row 5: Audit Discipline & Consistency */}
                    <div className="py-2.5 sm:py-3.5 flex items-center justify-between">
                      <div className="pr-3 max-w-[60%]">
                        <span
                          className={`text-[12px] sm:text-[13px] font-normal leading-snug ${
                            isDark ? "text-zinc-200" : "text-zinc-800"
                          }`}
                        >
                          <span
                            className={`mr-1.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            →
                          </span>
                          {isIndonesian
                            ? "Disiplin & Konsistensi"
                            : "Discipline & Consistency"}
                          <sup
                            className={`text-[9px] ml-0.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            6
                          </sup>
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`amount text-2xl sm:text-3xl md:text-4xl font-light tracking-tight ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.disciplineScore >= 80 ? ">" : ""}
                          {stats.disciplineScore}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Editorial Footnotes Section */}
                  <div
                    className={`pt-2 text-[9px] sm:text-[10px] font-normal leading-relaxed space-y-1 ${
                      isDark ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    <p>
                      <span
                        className={isDark ? " text-zinc-500" : " text-zinc-500"}
                      >
                        1)
                      </span>{" "}
                      {isIndonesian
                        ? `Indikator kinerja privat yang diaudit pada space internal Accrual untuk ${periodTitle}.`
                        : `Audited private performance indicators across internal Accrual space for ${periodTitle}.`}
                    </p>
                    <p>
                      <span
                        className={isDark ? " text-zinc-500" : " text-zinc-500"}
                      >
                        2)
                      </span>{" "}
                      {isIndonesian
                        ? "Agregat perputaran transaksi bruto yang tercatat di seluruh akun aktif."
                        : "Aggregate gross transaction turnover recorded across active accounts."}
                    </p>
                    <p>
                      <span
                        className={isDark ? " text-zinc-500" : " text-zinc-500"}
                      >
                        3)
                      </span>{" "}
                      {isIndonesian
                        ? "Surplus likuid bersih yang tersimpan relatif terhadap total pemasukan periode."
                        : "Net liquid surplus retained relative to total period income."}
                    </p>
                    <p>
                      <span
                        className={isDark ? " text-zinc-500" : " text-zinc-500"}
                      >
                        4)
                      </span>{" "}
                      {isIndonesian
                        ? "Bantalan operasional kumulatif yang dipertahankan setelah komitmen hidup."
                        : "Cumulative operational cushion preserved post living commitments."}
                    </p>
                    <p>
                      <span
                        className={isDark ? " text-zinc-500" : " text-zinc-500"}
                      >
                        5)
                      </span>{" "}
                      {isIndonesian
                        ? "Indeks pengeluaran pokok non-diskresioner (makanan, tempat tinggal, utilitas, mobilitas)."
                        : "Non-discretionary baseline spending index (food, housing, utilities, mobility)."}
                    </p>
                    <p>
                      <span
                        className={isDark ? " text-zinc-500" : " text-zinc-500"}
                      >
                        6)
                      </span>{" "}
                      {isIndonesian
                        ? "Komposit kepatuhan perilaku yang memperhitungkan volatilitas pengeluaran dan target anggaran."
                        : "Behavioral adherence composite factoring spending volatility and budget targets."}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SLIDE 3: Asset Valuation & Portfolio Proportion          */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 3 && (
                <motion.div
                  key="slide-3"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="h-full flex flex-col justify-between text-left select-none"
                >
                  <div className="space-y-1 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px]  tracking-widest uppercase ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {isIndonesian
                          ? "SYS.ASET // VALUASI · [04 / 10]"
                          : "SYS.ASSET // VALUATION · [04 / 10]"}
                      </span>
                    </div>

                    <h2
                      className={`text-4xl sm:text-4xl lg:text-[40px] font-bold uppercase tracking-tighter ${
                        isDark ? "text-white" : "text-[#09090B]"
                      } leading-tight`}
                    >
                      {isIndonesian ? "Valuasi Portofolio" : "Portfolio Assets"}
                    </h2>
                    <p
                      className={`text-xs sm:text-sm font-normal leading-relaxed ${
                        isDark ? "text-white/60" : "text-black/60"
                      }`}
                    >
                      {isIndonesian
                        ? "Struktur proporsi modal dan alokasi aset."
                        : "Capital proportion asset allocation distribution."}
                    </p>

                    {/* Monolithic Summary Card */}
                    <div
                      className={`p-4  sm:p-4.5 rounded-2xl border space-y-3 ${
                        isDark
                          ? "bg-white/[0.03] border-white/10 shadow-xl"
                          : "bg-black/[0.02] border-black/10 shadow-sm"
                      }`}
                    >
                      <div className="flex items-end justify-between">
                        <div>
                          <span
                            className={`text-[10px]  uppercase tracking-wider block ${
                              isDark ? "text-white/40" : "text-black/40"
                            }`}
                          >
                            {isIndonesian
                              ? "TOTAL VALUASI ASET"
                              : "TOTAL ASSET VALUATION"}
                          </span>
                          <span
                            className={`text-2xl sm:text-3xl font-light tracking-tight block mt-1 ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                          >
                            {formatWithPreferred(totalAssetVal)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-[10px]  uppercase tracking-wider block ${
                              isDark ? "text-white/40" : "text-black/40"
                            }`}
                          >
                            {isIndonesian
                              ? "INDEKS DIVERSIFIKASI"
                              : "DIVERSIFICATION SCORE"}
                          </span>
                          <span
                            className={`text-sm sm:text-base font-bold ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                          >
                            {diversificationLabel}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-full h-px ${isDark ? "bg-white/15" : "bg-black/15"}`}
                      />

                      <div className="grid grid-cols-3 gap-2 text-left pt-0.5">
                        <div>
                          <span
                            className={`text-[9px]  uppercase tracking-wider block ${
                              isDark ? "text-white/40" : "text-black/40"
                            }`}
                          >
                            {isIndonesian ? "KAS LIKUID" : "LIQUID"}
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-bold block truncate mt-0.5 ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                            title={formatWithPreferred(liquidCapital)}
                          >
                            {formatWithPreferred(liquidCapital)}
                          </span>
                        </div>
                        <div>
                          <span
                            className={`text-[9px]  uppercase tracking-wider block ${
                              isDark ? "text-white/40" : "text-black/40"
                            }`}
                          >
                            {isIndonesian ? "ASET FISIK" : "PHYSICAL"}
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-bold block truncate mt-0.5 ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                            title={formatWithPreferred(fixedAssets)}
                          >
                            {formatWithPreferred(fixedAssets)}
                          </span>
                        </div>
                        <div>
                          <span
                            className={`text-[9px]  uppercase tracking-wider block ${
                              isDark ? "text-white/40" : "text-black/40"
                            }`}
                          >
                            {isIndonesian ? "INVESTASI" : "INVEST"}
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-bold block truncate mt-0.5 ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                            title={formatWithPreferred(marketAssets)}
                          >
                            {formatWithPreferred(marketAssets)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Monolithic Proportion Bars (Unboxed, 3 Columns) */}
                  <div className="flex-1 w-full flex flex-col justify-end pt-3 pb-1 min-h-[220px]">
                    <div className="h-full w-full flex items-end justify-between gap-3 px-0.5">
                      {/* Column 1: Kas Likuid */}
                      <div className="flex-1 h-full flex flex-col items-center justify-end">
                        <div
                          className="w-full rounded-t-md transition-all duration-700 relative flex items-end justify-center p-2.5"
                          style={{
                            height: `${assetBarHeights.liquid}%`,
                            background: isDark
                              ? "linear-gradient(to top, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.14) 100%)"
                              : "linear-gradient(to top, rgba(0, 0, 0, 0.36) 0%, rgba(0, 0, 0, 0.22) 100%)",
                            borderTop: isDark
                              ? "1px solid rgba(255, 255, 255, 0.32)"
                              : "1px solid rgba(0, 0, 0, 0.38)",
                            borderLeft: isDark
                              ? "1px solid rgba(255, 255, 255, 0.20)"
                              : "1px solid rgba(0, 0, 0, 0.25)",
                            borderRight: isDark
                              ? "1px solid rgba(255, 255, 255, 0.20)"
                              : "1px solid rgba(0, 0, 0, 0.25)",
                          }}
                        ></div>
                        <div className="w-full text-left mt-2 pl-0.5">
                          <span
                            className={`text-xl sm:text-lg font-bold block ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                          >
                            {assetPcts.liquid}%
                          </span>
                          <span
                            className={`text-[12px]  uppercase truncate block ${
                              isDark ? "text-white/40" : "text-black/40"
                            }`}
                          >
                            {isIndonesian ? "Kas Likuid" : "Liquid Cash"}
                          </span>
                        </div>
                      </div>

                      {/* Column 2: Aset Fisik */}
                      <div className="flex-1 h-full flex flex-col items-center justify-end">
                        <div
                          className="w-full rounded-t-md transition-all duration-700 relative flex items-end justify-center p-2.5"
                          style={{
                            height: `${assetBarHeights.physical}%`,
                            background: isDark
                              ? "linear-gradient(to top, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.08) 100%)"
                              : "linear-gradient(to top, rgba(0, 0, 0, 0.24) 0%, rgba(0, 0, 0, 0.14) 100%)",
                            borderTop: isDark
                              ? "1px solid rgba(255, 255, 255, 0.22)"
                              : "1px solid rgba(0, 0, 0, 0.26)",
                            borderLeft: isDark
                              ? "1px solid rgba(255, 255, 255, 0.14)"
                              : "1px solid rgba(0, 0, 0, 0.18)",
                            borderRight: isDark
                              ? "1px solid rgba(255, 255, 255, 0.14)"
                              : "1px solid rgba(0, 0, 0, 0.18)",
                          }}
                        ></div>
                        <div className="w-full text-left mt-2 pl-0.5">
                          <span
                            className={`text-xl sm:text-lg font-bold block ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                          >
                            {assetPcts.physical}%
                          </span>
                          <span
                            className={`text-[12px]  uppercase truncate block ${
                              isDark ? "text-white/40" : "text-black/40"
                            }`}
                          >
                            {isIndonesian ? "Aset Fisik" : "Physical Assets"}
                          </span>
                        </div>
                      </div>

                      {/* Column 3: Investasi */}
                      <div className="flex-1 h-full flex flex-col items-center justify-end">
                        <div
                          className="w-full rounded-t-md transition-all duration-700 relative flex flex-col justify-between p-3.5 shadow-2xl"
                          style={{
                            height: `${assetBarHeights.invest}%`,
                            background: isDark
                              ? "linear-gradient(to top, #e5e5ea 0%, #ffffff 100%)"
                              : "linear-gradient(to top, #09090b 0%, #1c1c20 100%)",
                            color: isDark ? "#09090b" : "#ffffff",
                            borderTop: isDark
                              ? "1px solid rgba(255, 255, 255, 0.12)"
                              : "1px solid rgba(0, 0, 0, 0.18)",
                            borderLeft: isDark
                              ? "1px solid rgba(255, 255, 255, 0.08)"
                              : "1px solid rgba(0, 0, 0, 0.12)",
                            borderRight: isDark
                              ? "1px solid rgba(255, 255, 255, 0.08)"
                              : "1px solid rgba(0, 0, 0, 0.12)",
                          }}
                        ></div>
                        <div className="w-full text-left mt-2 pl-0.5">
                          <span
                            className={`text-xl sm:text-lg font-extrabold block ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                          >
                            {assetPcts.invest}%
                          </span>
                          <span
                            className={`text-[12px]  uppercase truncate block ${
                              isDark ? "text-white/40" : "text-black/40"
                            }`}
                          >
                            {isIndonesian ? "Investasi" : "Investments"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SLIDE 4: Temporal Spending Heatmap (Month vs Annual Grid) */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 4 && (
                <motion.div
                  key="slide-4"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-4 text-left"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[10px]  uppercase tracking-[0.2em] ${
                          isDark ? "text-white/50" : "text-black/50"
                        }`}
                      >
                        {isIndonesian
                          ? "Matriks Temporal · [05 / 10]"
                          : "Temporal Matrix · [05 / 10]"}
                      </span>
                      <div
                        className={`inline-flex items-center gap-1 text-[10px] font-normal px-2.5 py-0.5 rounded-full border ${
                          isDark
                            ? "bg-white/[0.08] text-white/80 border-white/10"
                            : "bg-black/[0.05] text-black/80 border-black/10"
                        }`}
                      >
                        <Calendar size={11} />
                        <span>
                          {mode === "year"
                            ? isIndonesian
                              ? "Matriks 52-Minggu"
                              : "52-Week Matrix"
                            : isIndonesian
                              ? "Kisi Bulanan"
                              : "Monthly Grid"}
                        </span>
                      </div>
                    </div>
                    <h2
                      className={`text-2xl sm:text-3xl font-medium tracking-tight ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      {isIndonesian
                        ? "Peta Panas Pengeluaran"
                        : "Spending Heatmap"}
                    </h2>
                    <p
                      className={`text-[12px] font-light mt-0.5 ${
                        isDark ? "text-white/50" : "text-black/50"
                      }`}
                    >
                      {mode === "year"
                        ? isIndonesian
                          ? `Intensitas pengeluaran tahunan 365 hari sepanjang Tahun ${targetYear}`
                          : `365-day annual outflow intensity across Year ${targetYear}`
                        : isIndonesian
                          ? `Intensitas pengeluaran harian sepanjang ${format(new Date(targetYear, targetMonth - 1, 1), "MMMM yyyy", { locale: idLocale })}`
                          : `Day-by-day outflow intensity across ${format(new Date(targetYear, targetMonth - 1, 1), "MMMM yyyy")}`}
                    </p>
                  </div>

                  {/* ============================================================ */}
                  {/* VIEW A: ANNUAL 52-WEEK HEATMAP MATRIX                        */}
                  {/* ============================================================ */}
                  {mode === "year" ? (
                    <div className="py-2 space-y-3">
                      {/* Month Headers */}
                      <div className="flex justify-between text-[9px]  px-1 opacity-60">
                        {(isIndonesian
                          ? [
                              "Jan",
                              "Feb",
                              "Mar",
                              "Apr",
                              "Mei",
                              "Jun",
                              "Jul",
                              "Agt",
                              "Sep",
                              "Okt",
                              "Nov",
                              "Des",
                            ]
                          : [
                              "Jan",
                              "Feb",
                              "Mar",
                              "Apr",
                              "May",
                              "Jun",
                              "Jul",
                              "Aug",
                              "Sep",
                              "Oct",
                              "Nov",
                              "Dec",
                            ]
                        ).map((m) => (
                          <span key={m}>{m}</span>
                        ))}
                      </div>

                      {/* 52-Week Contribution Grid */}
                      <div className="p-3 rounded-2xl border bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 overflow-x-auto no-scrollbar">
                        <div className="flex gap-[3px] min-w-[310px] justify-between">
                          {Array.from({
                            length: stats.annualHeatmap.weeksCount,
                          }).map((_, wIdx) => {
                            const weekDays = stats.annualHeatmap.days.filter(
                              (d) => d.weekIndex === wIdx,
                            );
                            return (
                              <div
                                key={wIdx}
                                className="flex flex-col gap-[3px] shrink-0"
                              >
                                {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
                                  const day = weekDays.find(
                                    (d) => d.weekday === dayOfWeek,
                                  );
                                  if (!day) {
                                    return (
                                      <div
                                        key={dayOfWeek}
                                        className="w-1.5 h-1.5 rounded-[1px] bg-transparent"
                                      />
                                    );
                                  }

                                  const intensityClasses = isDark
                                    ? [
                                        "bg-white/[0.04] border border-white/[0.04]",
                                        "bg-white/25",
                                        "bg-white/50",
                                        "bg-white/80",
                                        "bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]",
                                      ]
                                    : [
                                        "bg-black/[0.04] border border-black/[0.04]",
                                        "bg-black/20",
                                        "bg-black/45",
                                        "bg-black/75",
                                        "bg-black shadow-[0_0_6px_rgba(0,0,0,0.3)]",
                                      ];

                                  return (
                                    <div
                                      key={day.dayOfYear}
                                      className={`w-1.5 h-1.5 rounded-[1.5px] transition-all relative ${intensityClasses[day.intensity]}`}
                                      title={`${day.dateStr}: ${formatRupiah(day.amount)}`}
                                    />
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 12-Month Outflow Distribution Bars */}
                      <div className="pt-2 border-t border-black/10 dark:border-white/10">
                        <div className="flex items-center justify-between text-[10px]  mb-2">
                          <span
                            className={
                              isDark ? "text-zinc-400" : "text-zinc-600"
                            }
                          >
                            {isIndonesian
                              ? "Intensitas Bulanan"
                              : "Month-by-Month Intensity"}
                          </span>
                          <span
                            className={`font-semibold ${
                              isDark ? "text-white" : "text-black"
                            }`}
                          >
                            {isIndonesian ? "Puncak:" : "Peak:"}{" "}
                            {stats.annualHeatmap.peakMonth?.monthName || "N/A"}
                          </span>
                        </div>

                        <div className="grid grid-cols-12 gap-1">
                          {stats.annualHeatmap.monthSummaries.map((ms) => {
                            const isPeak = ms.isPeak;
                            return (
                              <div
                                key={ms.month}
                                className="flex flex-col items-center gap-1"
                              >
                                <div
                                  className={`w-full rounded-sm flex items-end justify-center transition-all ${
                                    isPeak
                                      ? isDark
                                        ? "bg-white text-black"
                                        : "bg-black text-white"
                                      : ms.intensity > 2
                                        ? isDark
                                          ? "bg-white/60"
                                          : "bg-black/60"
                                        : ms.intensity > 0
                                          ? isDark
                                            ? "bg-white/20"
                                            : "bg-black/20"
                                          : isDark
                                            ? "bg-white/[0.05]"
                                            : "bg-black/[0.05]"
                                  }`}
                                  style={{
                                    height: ms.amount > 0 ? "26px" : "8px",
                                  }}
                                  title={`${ms.monthName}: ${formatRupiah(ms.amount)} (${ms.activeDaysCount} ${isIndonesian ? "hari aktif" : "active days"})`}
                                />
                                <span
                                  className={`text-[8px]  ${
                                    isPeak
                                      ? isDark
                                        ? "font-bold text-white"
                                        : "font-bold text-black"
                                      : isDark
                                        ? "text-zinc-400"
                                        : "text-zinc-600"
                                  }`}
                                >
                                  {ms.monthName[0]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Floating Annual Metrics Summary */}
                      <div
                        className={`flex items-center justify-between text-[11px] pt-1 ${
                          isDark ? "text-zinc-300" : "text-zinc-700"
                        }`}
                      >
                        <span>
                          {stats.annualHeatmap.activeSpendDaysCount}{" "}
                          {isIndonesian
                            ? "hari aktif belanja"
                            : "active spend days"}
                        </span>
                        <span
                          className={`font-medium ${isDark ? "text-white" : "text-black"}`}
                        >
                          {stats.annualHeatmap.zeroSpendDaysCount}{" "}
                          {isIndonesian
                            ? "hari tanpa belanja"
                            : "zero-spend days"}
                        </span>
                      </div>

                      {/* Annual Peak Day Callout */}
                      {stats.annualHeatmap.peakDay && (
                        <div
                          className={`p-3 rounded-2xl border flex items-center justify-between text-left ${
                            isDark
                              ? "bg-white/[0.04] border-white/[0.1]"
                              : "bg-black/[0.035] border-black/[0.08]"
                          }`}
                        >
                          <div>
                            <span
                              className={`text-[9px]  uppercase tracking-wider block ${
                                isDark ? "text-zinc-400" : "text-zinc-600"
                              }`}
                            >
                              {isIndonesian
                                ? "LONJAKAN INTENSITAS PUNCAK TAHUNAN"
                                : "ANNUAL PEAK INTENSITY SPIKE"}
                            </span>
                            <p
                              className={`text-[12px] font-normal mt-0.5 ${
                                isDark ? "text-white" : "text-[#09090B]"
                              }`}
                            >
                              {format(
                                parseISO(stats.annualHeatmap.peakDay.dateStr),
                                "EEEE, dd MMMM yyyy",
                                { locale: isIndonesian ? idLocale : undefined },
                              )}
                            </p>
                          </div>
                          <p
                            className={`amount text-[13px] font-medium ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                          >
                            {formatRupiah(stats.annualHeatmap.peakDay.amount)}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ============================================================ */
                    /* VIEW B: MONTHLY 7-COLUMN HEATMAP GRID                        */
                    /* ============================================================ */
                    <div className="py-2">
                      {/* Day of Week Labels (Mon - Sun) */}
                      <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
                        {(isIndonesian
                          ? ["S", "S", "R", "K", "J", "S", "M"]
                          : ["M", "T", "W", "T", "F", "S", "S"]
                        ).map((label, i) => (
                          <span
                            key={i}
                            className={`text-[10px]  ${
                              isDark ? "text-zinc-400" : "text-zinc-600"
                            }`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>

                      {/* Grid of Day Tiles */}
                      <div className="grid grid-cols-7 gap-1.5">
                        {/* Leading blanks for alignment (Monday-first) */}
                        {Array.from({
                          length:
                            ((stats.monthlyHeatmap.days[0]?.weekday ?? 0) + 6) %
                              7 || 0,
                        }).map((_, i) => (
                          <div
                            key={`blank-${i}`}
                            className="aspect-square rounded-xl bg-transparent"
                          />
                        ))}

                        {/* Calendar days */}
                        {stats.monthlyHeatmap.days.map((day) => {
                          const intensityClasses = isDark
                            ? [
                                "bg-white/[0.03] text-white/30 border border-white/[0.04]",
                                "bg-white/[0.5] text-black font-semibold border border-white/[0.08]",
                                "bg-white/[0.75] text-black font-semibold border border-white/[0.25]",
                                "bg-white/[0.85] text-black font-semibold border border-white/[0.45]",
                                "bg-white text-black font-bold border border-white shadow-[0_0_14px_rgba(255,255,255,0.1)]",
                              ]
                            : [
                                "bg-black/[0.03] text-black/30 border border-black/[0.04]",
                                "bg-black/[0.25] text-white font-semibold border border-black/[0.08]",
                                "bg-black/[0.5] text-white font-semibold border border-black/[0.25]",
                                "bg-black/[0.75] text-white font-semibold border border-black/[0.45]",
                                "bg-black text-white font-bold border border-black shadow-[0_0_14px_rgba(0,0,0,0.15)]",
                              ];

                          return (
                            <div
                              key={day.day}
                              className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[11px] transition-all relative ${intensityClasses[day.intensity]}`}
                              title={`${day.dateStr}: ${formatRupiah(day.amount)}`}
                            >
                              <span>{day.day}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Heatmap Legend */}
                      <div
                        className={`flex items-center justify-between text-[10px]  pt-3 mt-2 border-t ${
                          isDark
                            ? "border-white/10 text-zinc-400"
                            : "border-black/10 text-zinc-600"
                        }`}
                      >
                        <span>{isIndonesian ? "Intensitas" : "Intensity"}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                          >
                            {isIndonesian ? "Rendah" : "Less"}
                          </span>
                          <span
                            className={`w-3 h-3 rounded-md ${isDark ? "bg-white/[0.04] border border-white/[0.05]" : "bg-black/[0.04] border border-black/[0.05]"}`}
                          />
                          <span
                            className={`w-3 h-3 rounded-md ${isDark ? "bg-white/[0.15]" : "bg-black/[0.15]"}`}
                          />
                          <span
                            className={`w-3 h-3 rounded-md ${isDark ? "bg-white/[0.35]" : "bg-black/[0.35]"}`}
                          />
                          <span
                            className={`w-3 h-3 rounded-md ${isDark ? "bg-white/[0.6]" : "bg-black/[0.6]"}`}
                          />
                          <span
                            className={`w-3 h-3 rounded-md ${isDark ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" : "bg-black shadow-[0_0_6px_rgba(0,0,0,0.3)]"}`}
                          />
                          <span
                            className={`text-[9px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                          >
                            {isIndonesian ? "Tinggi" : "More"}
                          </span>
                        </div>
                      </div>

                      {/* Floating Metrics Summary */}
                      <div
                        className={`flex items-center justify-between text-[11px] pt-1 ${
                          isDark ? "text-zinc-300" : "text-zinc-700"
                        }`}
                      >
                        <span>
                          {stats.monthlyHeatmap.activeSpendDaysCount}{" "}
                          {isIndonesian
                            ? "hari aktif belanja"
                            : "active spend days"}
                        </span>
                        <span
                          className={`font-medium ${isDark ? "text-white" : "text-black"}`}
                        >
                          {stats.monthlyHeatmap.zeroSpendDaysCount}{" "}
                          {isIndonesian
                            ? "hari tanpa belanja"
                            : "zero-spend days"}
                        </span>
                      </div>

                      {/* Peak Day Callout */}
                      {stats.monthlyHeatmap.peakDay && (
                        <div
                          className={`p-3 rounded-2xl border flex items-center justify-between text-left ${
                            isDark
                              ? "bg-white/[0.04] border-white/[0.1]"
                              : "bg-black/[0.035] border-black/[0.08]"
                          }`}
                        >
                          <div>
                            <span
                              className={`text-[9px]  uppercase tracking-wider block ${
                                isDark ? "text-zinc-400" : "text-zinc-600"
                              }`}
                            >
                              {isIndonesian
                                ? "LONJAKAN INTENSITAS PUNCAK"
                                : "PEAK INTENSITY SPIKE"}
                            </span>
                            <p
                              className={`text-[12px] font-normal mt-0.5 ${
                                isDark ? "text-white" : "text-[#09090B]"
                              }`}
                            >
                              {format(
                                parseISO(stats.monthlyHeatmap.peakDay.dateStr),
                                "EEEE, dd MMMM",
                                { locale: isIndonesian ? idLocale : undefined },
                              )}
                            </p>
                          </div>
                          <p
                            className={`amount text-[13px] font-medium ${
                              isDark ? "text-white" : "text-[#09090B]"
                            }`}
                          >
                            {formatRupiah(stats.monthlyHeatmap.peakDay.amount)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SLIDE 5: Vital Efficiency Ratios (Bleeding Stadium Bars) */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 5 && (
                <motion.div
                  key="slide-5"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-4 text-left"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[10px]  uppercase tracking-[0.2em] ${
                          isDark ? "text-white/50" : "text-black/50"
                        }`}
                      >
                        {isIndonesian
                          ? "Tolok Ukur Modal · [06 / 10]"
                          : "Capital Benchmarks · [06 / 10]"}
                      </span>
                      <div
                        className={`inline-flex items-center gap-1 text-[10px] font-normal px-2.5 py-0.5 rounded-full border ${
                          isDark
                            ? "bg-white/[0.08] text-white/80 border-white/10"
                            : "bg-black/[0.05] text-black/80 border-black/10"
                        }`}
                      >
                        <ShieldCheck size={11} />
                        <span>
                          {isIndonesian ? "Rasio Vital" : "Vital Ratios"}
                        </span>
                      </div>
                    </div>
                    <h2
                      className={`text-2xl sm:text-3xl font-medium tracking-tight ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      {isIndonesian
                        ? "Rasio Efisiensi Vital"
                        : "Vital Efficiency Ratios"}
                    </h2>
                    <p
                      className={`text-[12px] font-light mt-0.5 ${
                        isDark ? "text-white/50" : "text-black/50"
                      }`}
                    >
                      {isIndonesian
                        ? `Metrik alokasi dan perilaku sepanjang arus kas ${mode === "year" ? "tahunan" : "bulanan"}`
                        : `Allocation and behavioral metrics across ${mode === "year" ? "annual" : "monthly"} cashflow`}
                    </p>
                  </div>

                  {/* Bleeding Stadium Bars (Reference media_1789625343517.png) */}
                  <div className="space-y-3.5 sm:space-y-4 py-2 -mx-6">
                    {(() => {
                      const benchmarks = [
                        {
                          percentage: stats.savingsRate,
                          label: isIndonesian
                            ? "Surplus retensi modal yang berhasil diamankan ke kekayaan bersih"
                            : "Capital retention surplus successfully preserved into net worth",
                        },
                        {
                          percentage: stats.essentialPct,
                          label: isIndonesian
                            ? "Komitmen hidup pokok esensial (Makanan, Tempat Tinggal, Utilitas, Kesehatan)"
                            : "Essential baseline commitments (Food, Housing, Utilities, Health)",
                        },
                        {
                          percentage: stats.disciplineScore,
                          label: isIndonesian
                            ? "Indeks kepatuhan anggaran & konsistensi pengeluaran non-impulsif"
                            : "Budget adherence & non-impulsive spending consistency index",
                        },
                        {
                          percentage: stats.weekendPct,
                          label: isIndonesian
                            ? "Pangsa pengeluaran akhir pekan dibanding ritme konsumsi hari kerja"
                            : "Weekend outflow share compared to weekday consumption rhythm",
                        },
                        {
                          percentage: Math.min(
                            95,
                            Math.max(
                              25,
                              Math.round(
                                100 -
                                  (stats.totalExpense > 0
                                    ? (stats.maxSingleExpense /
                                        stats.totalExpense) *
                                      100
                                    : 20),
                              ),
                            ),
                          ),
                          label: isIndonesian
                            ? "Ketahanan operasional dalam menyerap guncangan pengeluaran satu hari"
                            : "Operational resilience absorbing single-day spending shocks",
                        },
                      ];

                      const maxPct = Math.max(
                        ...benchmarks.map((b) => b.percentage),
                        1,
                      );

                      return benchmarks.map((bm, idx) => {
                        const isHero = bm.percentage === maxPct;
                        const barWidthPct = Math.min(
                          95,
                          Math.max(38, 28 + (bm.percentage / 100) * 65),
                        );

                        return (
                          <div key={idx} className="relative select-none">
                            {/* Bleeding horizontal stadium pill */}
                            <motion.div
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: `${barWidthPct}%`, opacity: 1 }}
                              transition={{
                                delay: 0.08 + idx * 0.08,
                                duration: 0.55,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className={`h-11 sm:h-12 rounded-r-full flex items-center justify-end pr-4 transition-transform hover:scale-[1.01] ${
                                isDark
                                  ? isHero
                                    ? "bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.15)]"
                                    : idx === 1
                                      ? "bg-zinc-200 text-zinc-950 shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
                                      : idx === 2
                                        ? "bg-white/[0.16] text-white border-y border-r border-white/25 backdrop-blur-xl shadow-[0_6px_18px_rgba(0,0,0,0.4)]"
                                        : idx === 3
                                          ? "bg-zinc-800/90 text-zinc-100 border-y border-r border-white/15 backdrop-blur-lg"
                                          : "bg-white/[0.08] text-white/90 border-y border-r border-white/10"
                                  : isHero
                                    ? "bg-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
                                    : idx === 1
                                      ? "bg-zinc-800 text-zinc-50 shadow-[0_6px_18px_rgba(0,0,0,0.15)]"
                                      : idx === 2
                                        ? "bg-black/[0.16] text-black border-y border-r border-black/25 backdrop-blur-xl"
                                        : idx === 3
                                          ? "bg-zinc-200 text-zinc-900 border-y border-r border-black/15 backdrop-blur-lg"
                                          : "bg-black/[0.08] text-black/90 border-y border-r border-black/10"
                              }`}
                            >
                              <span
                                className={`text-2xl sm:text-3xl font-semibold  tracking-tight leading-none ${
                                  isHero
                                    ? isDark
                                      ? "text-black"
                                      : "text-white"
                                    : idx === 1
                                      ? isDark
                                        ? "text-zinc-950"
                                        : "text-zinc-50"
                                      : isDark
                                        ? "text-white"
                                        : "text-black"
                                }`}
                              >
                                {bm.percentage}%
                              </span>
                            </motion.div>

                            {/* Descriptive statement below each bar */}
                            <p
                              className={`text-[11px] sm:text-[12px] ml-6 mt-1 leading-snug font-medium max-w-sm ${
                                isDark ? "text-zinc-300" : "text-zinc-700"
                              }`}
                            >
                              {bm.label}
                            </p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </motion.div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SLIDE 6: Multi-Horizon Runway Projection (Line Chart)    */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 6 && (
                <motion.div
                  key="slide-6"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-4 text-left"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[10px]  uppercase tracking-[0.2em] ${
                          isDark ? "text-white/50" : "text-black/50"
                        }`}
                      >
                        {isIndonesian
                          ? "Horizon Runway · [07 / 10]"
                          : "Runway Horizon · [07 / 10]"}
                      </span>
                      <div
                        className={`inline-flex items-center gap-1 text-[10px] font-normal px-2.5 py-0.5 rounded-full border ${
                          isDark
                            ? "bg-white/[0.08] text-white/80 border-white/10"
                            : "bg-black/[0.05] text-black/80 border-black/10"
                        }`}
                      >
                        <TrendingUp size={11} />
                        <span>
                          {isIndonesian ? "Prakiraan +6 Bln" : "+6 Mo Forecast"}
                        </span>
                      </div>
                    </div>
                    <h2
                      className={`text-2xl sm:text-3xl font-medium tracking-tight ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      {isIndonesian
                        ? "Runway Modal & Prakiraan"
                        : "Capital Runway & Forecast"}
                    </h2>
                    <p
                      className={`text-[12px] font-light mt-0.5 ${
                        isDark ? "text-white/50" : "text-black/50"
                      }`}
                    >
                      {isIndonesian
                        ? "Ekstrapolasi akumulasi surplus modal selama 6 bulan ke depan"
                        : "Forward extrapolation of surplus accumulation over 6 months"}
                    </p>
                  </div>

                  {/* Dynamic Multi-Horizon Projection SVG Curve */}
                  <div className="relative py-2">
                    <div className="absolute inset-x-0 inset-y-4 pointer-events-none flex flex-col justify-between opacity-15">
                      <div
                        className={`border-b border-dashed ${
                          isDark ? "border-white" : "border-black"
                        }`}
                      />
                      <div
                        className={`border-b border-dashed ${
                          isDark ? "border-white" : "border-black"
                        }`}
                      />
                      <div
                        className={`border-b border-dashed ${
                          isDark ? "border-white" : "border-black"
                        }`}
                      />
                    </div>

                    {(() => {
                      const rSvgW = 320;
                      const rSvgH = 130;
                      const rPadL = 20;
                      const rPadR = 24;
                      const rPadT = 24;
                      const rPadB = 26;
                      const rPlotW = rSvgW - rPadL - rPadR;
                      const rPlotH = rSvgH - rPadT - rPadB;
                      const rMaxVal = Math.max(
                        1,
                        stats.runway.terminalProjectedSurplus,
                      );

                      const rPoints = stats.runway.points.map((pt, i) => {
                        const x = rPadL + (i / 6) * rPlotW;
                        const y =
                          rPadT + rPlotH - (pt.amount / rMaxVal) * rPlotH;
                        return { ...pt, x, y };
                      });

                      const rPath = rPoints.reduce((acc, pt, i, arr) => {
                        if (i === 0) return `M ${pt.x} ${pt.y}`;
                        const prev = arr[i - 1];
                        const cx = (prev.x + pt.x) / 2;
                        return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
                      }, "");

                      const rAreaPath = `${rPath} L ${rPoints[6].x} ${rPadT + rPlotH} L ${rPoints[0].x} ${rPadT + rPlotH} Z`;

                      return (
                        <div className="w-full h-36 relative z-10">
                          <svg
                            viewBox={`0 0 ${rSvgW} ${rSvgH}`}
                            className="w-full h-full overflow-visible"
                          >
                            <defs>
                              <linearGradient
                                id="projGrad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor={isDark ? "#FFFFFF" : "#000000"}
                                  stopOpacity={isDark ? "0.22" : "0.15"}
                                />
                                <stop
                                  offset="100%"
                                  stopColor={isDark ? "#FFFFFF" : "#000000"}
                                  stopOpacity="0.01"
                                />
                              </linearGradient>
                            </defs>

                            {/* Projection Area Fill */}
                            <path d={rAreaPath} fill="url(#projGrad)" />

                            {/* Baseline */}
                            <line
                              x1={rPadL}
                              y1={rPadT + rPlotH}
                              x2={rPadL + rPlotW + 4}
                              y2={rPadT + rPlotH}
                              stroke={
                                isDark
                                  ? "rgba(255,255,255,0.15)"
                                  : "rgba(0,0,0,0.15)"
                              }
                              strokeWidth="1"
                            />

                            {/* Dashed forward projection curve */}
                            <path
                              d={rPath}
                              fill="none"
                              stroke={isDark ? "#FFFFFF" : "#000000"}
                              strokeWidth="2.2"
                              strokeDasharray="5 4"
                              strokeLinecap="round"
                            />

                            {/* Milestone nodes at Present, +2M, +4M */}
                            <circle
                              cx={rPoints[0].x}
                              cy={rPoints[0].y}
                              r="4"
                              fill={isDark ? "#FFFFFF" : "#000000"}
                            />
                            <circle
                              cx={rPoints[2].x}
                              cy={rPoints[2].y}
                              r="3"
                              fill={isDark ? "#FFFFFF" : "#000000"}
                              opacity="0.8"
                            />
                            <circle
                              cx={rPoints[4].x}
                              cy={rPoints[4].y}
                              r="3"
                              fill={isDark ? "#FFFFFF" : "#000000"}
                              opacity="0.8"
                            />

                            {/* Terminal +6M Anchor Pin with glowing halo */}
                            <circle
                              cx={rPoints[6].x}
                              cy={rPoints[6].y}
                              r="10"
                              fill={isDark ? "#FFFFFF" : "#000000"}
                              opacity="0.2"
                            />
                            <circle
                              cx={rPoints[6].x}
                              cy={rPoints[6].y}
                              r="4.5"
                              fill={isDark ? "#FFFFFF" : "#000000"}
                            />

                            {/* Terminal Value Badge */}
                            <text
                              x={rPoints[6].x}
                              y={rPoints[6].y - 8}
                              textAnchor="end"
                              fill={isDark ? "#FFFFFF" : "#000000"}
                              fontSize="8.5"
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              +
                              {formatRupiah(
                                stats.runway.terminalProjectedSurplus,
                              )}
                            </text>
                          </svg>
                        </div>
                      );
                    })()}

                    {/* Period Timeline Points */}
                    <div
                      className={`flex justify-between text-[10px]  pt-1 ${
                        isDark ? "text-zinc-400" : "text-zinc-600"
                      }`}
                    >
                      <span>{isIndonesian ? "Saat Ini" : "Present"}</span>
                      <span>{isIndonesian ? "+2 Bln" : "+2 Mo"}</span>
                      <span>{isIndonesian ? "+4 Bln" : "+4 Mo"}</span>
                      <span
                        className={`font-medium ${isDark ? "text-white" : "text-black"}`}
                      >
                        {isIndonesian ? "Horizon +6 Bln" : "+6 Mo Horizon"}
                      </span>
                    </div>
                  </div>

                  {/* Floating Horizon Callout Pills */}
                  <div
                    className={`grid grid-cols-2 gap-3 pt-2 border-t ${
                      isDark ? "border-white/10" : "border-black/10"
                    }`}
                  >
                    <div>
                      <span
                        className={`text-[9px]  uppercase tracking-wider block ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {isIndonesian
                          ? "LAJU SURPLUS BULANAN"
                          : "MONTHLY SURPLUS PACE"}
                      </span>
                      <p
                        className={`amount text-[15px] font-semibold mt-0.5 ${
                          isDark ? "text-white" : "text-[#09090B]"
                        }`}
                      >
                        +{formatRupiah(stats.runway.monthlyPace)}
                        <span
                          className={`text-[10px] font-normal ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian ? "/bln" : "/mo"}
                        </span>
                      </p>
                    </div>

                    <div>
                      <span
                        className={`text-[9px]  uppercase tracking-wider block ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {isIndonesian
                          ? "ESTIMASI BANTALAN 6 BULAN"
                          : "ESTIMATED 6-MO CUSHION"}
                      </span>
                      <p
                        className={`amount text-[15px] font-semibold mt-0.5 ${
                          isDark ? "text-white" : "text-[#09090B]"
                        }`}
                      >
                        +{formatRupiah(stats.runway.terminalProjectedSurplus)}
                      </p>
                    </div>
                  </div>

                  {/* Trajectory Status Pill */}
                  <div
                    className={`p-3 rounded-2xl border flex items-center justify-between text-left ${
                      isDark
                        ? "bg-white/[0.04] border-white/[0.1]"
                        : "bg-black/[0.035] border-black/[0.08]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity
                        size={13}
                        className={isDark ? "text-white/80" : "text-black/80"}
                      />
                      <span
                        className={`text-[11px] font-normal ${
                          isDark ? "text-white" : "text-[#09090B]"
                        }`}
                      >
                        {stats.runway.monthlyPace > 0
                          ? isIndonesian
                            ? "Trayektori ekspansi positif dengan surplus terakumulasi"
                            : "Positive expansion trajectory with compounding surplus"
                          : isIndonesian
                            ? "Kecepatan arus kas impas membutuhkan konservasi modal"
                            : "Break-even cashflow velocity requiring capital conservation"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SLIDE 7: Weekly Rhythm & Outliers (Step Bars)            */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 7 && (
                <motion.div
                  key="slide-7"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-4 text-left"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[10px]  uppercase tracking-[0.2em] ${
                          isDark ? "text-white/50" : "text-black/50"
                        }`}
                      >
                        {isIndonesian
                          ? "Ritme Temporal · [08 / 10]"
                          : "Temporal Rhythm · [08 / 10]"}
                      </span>
                      <span
                        className={`text-[10px] font-normal px-2.5 py-0.5 rounded-full border ${
                          isDark
                            ? "bg-white/[0.08] text-white/80 border-white/10"
                            : "bg-black/[0.05] text-black/80 border-black/10"
                        }`}
                      >
                        {isIndonesian
                          ? "Distribusi Hari"
                          : "Weekday Distribution"}
                      </span>
                    </div>
                    <h2
                      className={`text-2xl sm:text-3xl font-medium tracking-tight ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      {isIndonesian
                        ? "Ritme Mingguan & Outlier"
                        : "Weekly Rhythm & Outliers"}
                    </h2>
                    <p
                      className={`text-[12px] font-light mt-0.5 ${
                        isDark ? "text-white/50" : "text-black/50"
                      }`}
                    >
                      {isIndonesian
                        ? "Konsentrasi volume harian dan pencapaian tunggal"
                        : "Day-of-week volume concentration and singular milestones"}
                    </p>
                  </div>

                  {/* Step Bars floating without enclosing card box */}
                  <div className="py-2">
                    <div className="flex items-end justify-between gap-1.5 h-28 px-1">
                      {(isIndonesian
                        ? ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
                        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                      ).map((dName, idx) => {
                        const val = stats.weekdaySpend[idx];
                        const pct = Math.max(
                          10,
                          Math.round((val / stats.maxWeekdaySpend) * 100),
                        );
                        const isWeekend = idx === 0 || idx === 6;

                        return (
                          <div
                            key={dName}
                            className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                          >
                            <span
                              className={`text-[9px]  ${
                                isDark ? "text-zinc-400" : "text-zinc-600"
                              }`}
                            >
                              {val > 0
                                ? val >= 1000000
                                  ? `${(val / 1000000).toFixed(1)}m`
                                  : `${Math.round(val / 1000)}k`
                                : "-"}
                            </span>
                            <div
                              className="w-full rounded-lg transition-all duration-700"
                              style={{
                                height: `${pct}%`,
                                background: isDark
                                  ? isWeekend
                                    ? "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.25) 100%)"
                                    : "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)"
                                  : isWeekend
                                    ? "linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.25) 100%)"
                                    : "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 100%)",
                              }}
                            />
                            <span
                              className={`text-[10px] ${
                                isWeekend
                                  ? isDark
                                    ? "font-semibold text-white"
                                    : "font-semibold text-black"
                                  : isDark
                                    ? "font-normal text-zinc-400"
                                    : "font-normal text-zinc-600"
                              }`}
                            >
                              {dName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Single Largest Outflow Spotlight */}
                  {stats.maxSingleExpense > 0 && (
                    <div
                      className={`p-3.5 rounded-2xl border flex justify-between items-center text-left ${
                        isDark
                          ? "bg-white/[0.04] border-white/[0.1]"
                          : "bg-black/[0.035] border-black/[0.08]"
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <span
                          className={`text-[9px]  uppercase tracking-wider block mb-0.5 ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian
                            ? "PENGELUARAN TUNGGAL TERBESAR"
                            : "MAX DISRUPTION EVENT"}
                        </span>
                        <p
                          className={`text-[13px] font-medium truncate ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          "{stats.maxExpenseNote}"
                        </p>
                        {stats.maxExpenseDate && (
                          <p
                            className={`text-[11px]  mt-0.5 ${
                              isDark ? "text-zinc-400" : "text-zinc-600"
                            }`}
                          >
                            {format(
                              parseISO(stats.maxExpenseDate),
                              "EEE, dd MMM yyyy",
                              { locale: isIndonesian ? idLocale : undefined },
                            )}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-[9px]  uppercase block ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian ? "PENGELUARAN" : "OUTFLOW"}
                        </span>
                        <p
                          className={`amount text-[15px] font-semibold mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {formatRupiah(stats.maxSingleExpense)}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SLIDE 8: Financial Archetype Persona                     */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 8 && (
                <motion.div
                  key="slide-8"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-4 text-left"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[10px]  uppercase tracking-[0.2em] ${
                          isDark ? "text-white/50" : "text-black/50"
                        }`}
                      >
                        {isIndonesian
                          ? "Intelijen Persona · [09 / 10]"
                          : "Persona Intelligence · [09 / 10]"}
                      </span>
                      <span
                        className={`text-[10px] font-normal px-2.5 py-0.5 rounded-full border ${
                          isDark
                            ? "bg-white/[0.08] text-white/80 border-white/10"
                            : "bg-black/[0.05] text-black/80 border-black/10"
                        }`}
                      >
                        {isIndonesian
                          ? "Profil Eksekutif"
                          : "Executive Profile"}
                      </span>
                    </div>
                    <h2
                      className={`text-2xl sm:text-3xl font-medium tracking-tight ${
                        isDark ? "text-white" : "text-[#09090B]"
                      }`}
                    >
                      {isIndonesian ? "Arketipe Modal" : "Capital Archetype"}
                    </h2>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px]  tracking-wider uppercase border ${
                        isDark
                          ? "bg-white/[0.08] border-white/15 text-white/90"
                          : "bg-black/[0.05] border-black/15 text-black/90"
                      }`}
                    >
                      <Sparkles size={11} />
                      <span>{stats.personaTag}</span>
                    </div>

                    <div>
                      <h3
                        className={`text-3xl sm:text-4xl font-light tracking-tight ${
                          isDark ? "text-white" : "text-[#09090B]"
                        }`}
                      >
                        {stats.persona}
                      </h3>
                    </div>

                    {/* 4-Metric Grid (Cardless, minimal dividing hairlines) */}
                    <div
                      className={`grid grid-cols-2 gap-3 py-3 border-y ${
                        isDark ? "border-white/10" : "border-black/10"
                      }`}
                    >
                      <div>
                        <p
                          className={`text-[9px]  uppercase tracking-wider ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian ? "TINGKAT RETENSI" : "RETENTION RATE"}
                        </p>
                        <p
                          className={`text-[16px] font-medium mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.savingsRate}%{" "}
                          {isIndonesian ? "Tersimpan" : "Saved"}
                        </p>
                      </div>
                      <div>
                        <p
                          className={`text-[9px]  uppercase tracking-wider ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian
                            ? "INDEKS VOLATILITAS"
                            : "VOLATILITY INDEX"}
                        </p>
                        <p
                          className={`text-[16px] font-medium mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.volatilityLabel}
                        </p>
                      </div>
                      <div>
                        <p
                          className={`text-[9px]  uppercase tracking-wider ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian ? "SKOR DISIPLIN" : "DISCIPLINE SCORE"}
                        </p>
                        <p
                          className={`text-[16px] font-medium mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.disciplineScore} / 100
                        </p>
                      </div>
                      <div>
                        <p
                          className={`text-[9px]  uppercase tracking-wider ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian
                            ? "GRADE EFISIENSI"
                            : "EFFICIENCY GRADE"}
                        </p>
                        <p
                          className={`text-[16px] font-medium mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {isIndonesian ? "Tingkat" : "Grade"}{" "}
                          {stats.efficiencyGrade}
                        </p>
                      </div>
                    </div>

                    <p
                      className={`text-[13px] font-light leading-relaxed ${
                        isDark ? "text-zinc-300" : "text-zinc-700"
                      }`}
                    >
                      {stats.personaDesc}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SLIDE 9: Shareable Recap Poster                         */}
              {/* -------------------------------------------------------- */}
              {currentSlide === 9 && (
                <motion.div
                  key="slide-9"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-4 text-left"
                >
                  {/* Luxury Report Poster */}
                  <div
                    className={`p-5 rounded-3xl backdrop-blur-3xl relative overflow-hidden text-left border ${
                      isDark
                        ? "bg-gradient-to-b from-white/[0.08] to-white/[0.02] border-white/[0.16]"
                        : "bg-gradient-to-b from-black/[0.04] to-black/[0.01] border-black/[0.1] shadow-xl"
                    }`}
                    style={{
                      boxShadow: isDark
                        ? "inset 0 1px 0 0 rgba(255,255,255,0.22), 0 25px 50px -12px rgba(0,0,0,0.8)"
                        : "inset 0 1px 0 0 rgba(255,255,255,0.9), 0 20px 40px -10px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* Fluted glass background slats within the card */}
                    <div
                      className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage: isDark
                          ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 28px)"
                          : "repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 28px)",
                      }}
                    />

                    {/* Header */}
                    <div
                      className={`flex justify-between items-start border-b pb-3 mb-3 relative z-10 ${
                        isDark ? "border-white/[0.1]" : "border-black/[0.1]"
                      }`}
                    >
                      <div>
                        <p
                          className={`text-[10px]  tracking-[0.25em] uppercase ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          Accrual
                        </p>
                        <h4
                          className={`text-xl font-medium tracking-tight mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {isIndonesian
                            ? "Wrapped · [10 / 10]"
                            : "Wrapped · [10 / 10]"}
                        </h4>
                        <p
                          className={`text-[11px] font-light ${
                            isDark ? "text-zinc-300" : "text-zinc-600"
                          }`}
                        >
                          {periodTitle}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            isDark
                              ? "bg-white/10 text-white border-white/15"
                              : "bg-black/10 text-black border-black/15"
                          }`}
                        >
                          {stats.persona}
                        </span>
                      </div>
                    </div>

                    {/* 4 Summary Matrix Columns */}
                    <div className="grid grid-cols-2 gap-2.5 py-1 relative z-10">
                      <div
                        className={`p-2.5 rounded-2xl border ${
                          isDark
                            ? "bg-white/[0.03] border-white/[0.06]"
                            : "bg-black/[0.03] border-black/[0.06]"
                        }`}
                      >
                        <span
                          className={`text-[9px]  uppercase tracking-wider block ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian ? "Pemasukan Modal" : "Capital Inflow"}
                        </span>
                        <p
                          className={`amount text-[14px] font-medium mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          +{formatWithPreferred(stats.totalIncome)}
                        </p>
                      </div>

                      <div
                        className={`p-2.5 rounded-2xl border ${
                          isDark
                            ? "bg-white/[0.03] border-white/[0.06]"
                            : "bg-black/[0.03] border-black/[0.06]"
                        }`}
                      >
                        <span
                          className={`text-[9px]  uppercase tracking-wider block ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian
                            ? "Pengeluaran Modal"
                            : "Capital Outflow"}
                        </span>
                        <p
                          className={`amount text-[14px] font-medium mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          -{formatWithPreferred(stats.totalExpense)}
                        </p>
                      </div>

                      <div
                        className={`p-2.5 rounded-2xl border ${
                          isDark
                            ? "bg-white/[0.03] border-white/[0.06]"
                            : "bg-black/[0.03] border-black/[0.06]"
                        }`}
                      >
                        <span
                          className={`text-[9px]  uppercase tracking-wider block ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian ? "Surplus Bersih" : "Net Surplus"}
                        </span>
                        <p
                          className={`amount text-[14px] font-medium mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.netCashflow >= 0 ? "+" : ""}
                          {formatWithPreferred(stats.netCashflow)}
                        </p>
                      </div>

                      <div
                        className={`p-2.5 rounded-2xl border ${
                          isDark
                            ? "bg-white/[0.03] border-white/[0.06]"
                            : "bg-black/[0.03] border-black/[0.06]"
                        }`}
                      >
                        <span
                          className={`text-[9px]  uppercase tracking-wider block ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {isIndonesian ? "Modal Tersimpan" : "Capital Saved"}
                        </span>
                        <p
                          className={`amount text-[14px] font-medium mt-0.5 ${
                            isDark ? "text-white" : "text-[#09090B]"
                          }`}
                        >
                          {stats.savingsRate}%{" "}
                          {isIndonesian ? "Tersimpan" : "Retained"}
                        </p>
                      </div>
                    </div>

                    {/* Additional Highlights Footer */}
                    <div
                      className={`mt-3 pt-2.5 border-t flex justify-between items-center text-[11px] font-light relative z-10 ${
                        isDark
                          ? "border-white/[0.08] text-zinc-400"
                          : "border-black/[0.08] text-zinc-600"
                      }`}
                    >
                      <span>
                        {stats.txCount}{" "}
                        {isIndonesian
                          ? "operasi tercatat"
                          : "recorded operations"}
                      </span>
                      <span>
                        {isIndonesian ? "Skor disiplin:" : "Discipline score:"}{" "}
                        {stats.disciplineScore}%
                      </span>
                    </div>
                  </div>

                  {/* Done / Close Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic("light");
                      onClose();
                    }}
                    className={`w-full py-3.5 rounded-2xl text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-lg relative z-50 pointer-events-auto ${
                      isDark
                        ? "bg-white text-black hover:bg-zinc-100"
                        : "bg-black text-white hover:bg-zinc-900"
                    }`}
                  >
                    <span>{isIndonesian ? "Selesai" : "Done"}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
