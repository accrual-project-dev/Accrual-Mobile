import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  CalendarDays,
  TrendingUp,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  getDay,
  isSameMonth,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  useMonthTransactions,
  useAllTransactions,
} from "../hooks/useTransactions";
import { useBills, useAddBill, useMarkBillPaid } from "../hooks/useBills";
import { useWalletBalances } from "../hooks/useWalletBalances";
import { useCategories } from "../hooks/useCategories";
import {
  detectRecurringTransactions,
  calculatePersonalBaselines,
  type DetectedRecurringItem,
} from "../lib/financialMath";
import { calculateMonthCalendarRunway } from "../lib/calendarForecasting";
import { formatRupiah } from "../lib/utils";
import { formatCompactRupiah } from "../lib/currency";
import { useTheme } from "../contexts/ThemeContext";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import {
  CalendarRunwayBento,
  CalendarMonthlyMatrix,
  CalendarUpcomingBillsSection,
  CalendarDayDetailSheet,
  PayBillModal,
  BillDailyReminderSheet,
  BillManagementSheets,
} from "../components/bills";
import type { Bill, RepeatRule } from "../lib/types";
import { triggerHaptic } from "../lib/haptics";

export function CalendarPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { isStealthMode, toggleStealthMode } = usePrivacy();
  const { t, isIndonesian } = useLanguage();
  const { showToast } = useToast();
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [isManageBillsOpen, setIsManageBillsOpen] = useState(false);
  const [isReminderSheetOpen, setIsReminderSheetOpen] = useState(false);

  const dateLocale = isIndonesian ? idLocale : undefined;
  const displayRupiah = (val: number) =>
    isStealthMode ? "Rp ••••••••" : formatRupiah(val);
  const displayCompact = (val: number) =>
    isStealthMode ? "••••" : formatCompactRupiah(val);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [customViewMode, setCustomViewMode] = useState<
    "activity" | "runway" | null
  >(null);
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const viewMode =
    customViewMode ?? (viewParam === "runway" ? "runway" : "activity");
  const setViewMode = (mode: "activity" | "runway") => setCustomViewMode(mode);
  const [slideDirection, setSlideDirection] = useState<number>(0);

  const { data: monthTxs = [] } = useMonthTransactions(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
  );
  const { data: allTxs = [] } = useAllTransactions();
  const { data: bills = [] } = useBills();
  const { liquidAssets = 0 } = useWalletBalances();
  const { data: categories = [] } = useCategories();
  const addBillMutation = useAddBill();
  const markBillPaidMutation = useMarkBillPaid();

  // Ignored recurring IDs state for DetectedRecurringSection
  const [ignoredRecurringIds, setIgnoredRecurringIds] = useState<string[]>(
    () => {
      try {
        const raw = localStorage.getItem("trouvaille_ignored_recurring_ids");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
  );
  const [confirmingRecurringId, setConfirmingRecurringId] = useState<
    string | null
  >(null);

  // Baseline Discretionary Burn & Recurring Inflows Detection
  const personalBaselines = useMemo(() => {
    return calculatePersonalBaselines(
      allTxs,
      categories,
      new Date(),
      isIndonesian ? "id" : "en",
    );
  }, [allTxs, categories, isIndonesian]);

  const detectedRecurring = useMemo(() => {
    return detectRecurringTransactions(allTxs, bills, categories, new Date());
  }, [allTxs, bills, categories]);

  const detectedRecurringExpenseItems = useMemo(() => {
    return detectedRecurring.filter(
      (item) =>
        item.type === "expense" &&
        item.status === "detected" &&
        !ignoredRecurringIds.includes(item.id),
    );
  }, [detectedRecurring, ignoredRecurringIds]);

  const handleIgnoreRecurring = (item: DetectedRecurringItem) => {
    if (ignoredRecurringIds.includes(item.id)) return;
    const nextIds = [...ignoredRecurringIds, item.id];
    setIgnoredRecurringIds(nextIds);
    localStorage.setItem(
      "trouvaille_ignored_recurring_ids",
      JSON.stringify(nextIds),
    );
    triggerHaptic("light");
    showToast(
      isIndonesian
        ? `${item.title} disembunyikan dari saran tagihan rutin`
        : `${item.title} hidden from recurring suggestions`,
      "update",
      () => {},
    );
  };

  const handleConfirmRecurring = (item: DetectedRecurringItem) => {
    const repeatRule: RepeatRule =
      item.frequency === "weekly"
        ? "weekly"
        : item.frequency === "monthly"
          ? "monthly"
          : item.frequency === "yearly"
            ? "yearly"
            : "none";
    const freqLabelId =
      item.frequency === "weekly"
        ? "mingguan"
        : item.frequency === "monthly"
          ? "bulanan"
          : item.frequency === "yearly"
            ? "tahunan"
            : item.frequency;
    const note = isIndonesian
      ? repeatRule === "none"
        ? `Pola transaksi berulang ${freqLabelId} terdeteksi dari riwayat. Tinjau jadwal pembayaran secara manual setelah konfirmasi.`
        : `Dikonfirmasi dari pola transaksi berulang ${freqLabelId} yang terdeteksi.`
      : repeatRule === "none"
        ? `Detected ${item.frequency} recurring pattern from transaction history. Review cadence manually after confirmation.`
        : `Confirmed from detected ${item.frequency} recurring transaction pattern.`;

    setConfirmingRecurringId(item.id);
    addBillMutation.mutate(
      {
        title: item.title,
        amount: Math.round(item.typicalAmount),
        due_date: item.nextExpectedDate,
        repeat_rule: repeatRule,
        note,
        is_paid: false,
      },
      {
        onSuccess: () => {
          setConfirmingRecurringId(null);
          triggerHaptic("medium");
          showToast(
            isIndonesian
              ? `${item.title} ditambahkan ke tagihan rutin`
              : `${item.title} added to recurring bills`,
            "add",
            () => {},
          );
        },
        onError: () => {
          setConfirmingRecurringId(null);
          showToast(
            isIndonesian
              ? "Gagal mengonfirmasi transaksi rutin yang terdeteksi"
              : "Failed to confirm detected recurring item",
            "delete",
            () => {},
          );
        },
      },
    );
  };

  const dailyBaselineBurn = useMemo(() => {
    const monthlyMedian =
      personalBaselines.medianExpense || personalBaselines.meanExpense || 0;
    return Math.round(monthlyMedian / 30);
  }, [personalBaselines]);

  // Calendar Runway Forecast Telemetry
  const runwayTelemetry = useMemo(() => {
    return calculateMonthCalendarRunway({
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
      transactions: monthTxs,
      bills,
      currentLiquidAssets: liquidAssets,
      recurringItems: detectedRecurring,
      dailyBaselineBurn,
      referenceDate: new Date(),
    });
  }, [
    currentDate,
    monthTxs,
    bills,
    liquidAssets,
    detectedRecurring,
    dailyBaselineBurn,
  ]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  // Selected Day Forecast & Actuals
  const selectedDayForecast = useMemo(() => {
    if (!selectedDay) return null;
    const dStr = format(selectedDay, "yyyy-MM-dd");
    return runwayTelemetry.days.find((d) => d.date === dStr) ?? null;
  }, [selectedDay, runwayTelemetry.days]);

  const selectedDayTxs = useMemo(() => {
    if (!selectedDay) return [];
    const dStr = format(selectedDay, "yyyy-MM-dd");
    return monthTxs.filter(
      (tx) => (tx.occurred_on || "").slice(0, 10) === dStr,
    );
  }, [selectedDay, monthTxs]);

  const handlePrevMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic("light");
    setSlideDirection(-1);
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic("light");
    setSlideDirection(1);
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleResetToToday = () => {
    triggerHaptic("medium");
    setSlideDirection(0);
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  };

  const handleBack = () => {
    triggerHaptic("light");
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const isCurrentMonthView = isSameMonth(currentDate, new Date());

  // ── Clean Apple Liquid Glass Tokens (Zero Glow Shadows) ──
  const buttonGlassBg = isDark
    ? "rgba(255, 255, 255, 0.05)"
    : "rgba(0, 0, 0, 0.035)";

  const buttonGlassBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.09)"
    : "1px solid rgba(0, 0, 0, 0.07)";

  const buttonGlassShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.25)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.04)";

  const segmentedTrackBg = isDark
    ? "rgba(255, 255, 255, 0.04)"
    : "rgba(0, 0, 0, 0.03)";

  return (
    <div
      className="px-4 sm:px-5 min-h-screen space-y-4 pb-36 select-none max-w-lg sm:max-w-xl mx-auto"
      style={{
        background: "var(--bg-base)",
        paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 12px), 18px)",
      }}
    >
      {/* ── 1. Top Header & Tactile View Mode Switcher (Clean, Zero Glow) ── */}
      <div
        className="flex items-center justify-between gap-3 pt-0.5"
        data-tour="calendar-header"
      >
        {/* Left Side: Back Button & Title */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleBack}
            className="w-8.5 h-8.5 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer select-none shrink-0"
            style={{
              background: buttonGlassBg,
              border: buttonGlassBorder,
              boxShadow: buttonGlassShadow,
              color: "var(--text-primary)",
            }}
            title={isIndonesian ? "Kembali" : "Back"}
            aria-label={isIndonesian ? "Kembali" : "Back"}
          >
            <ChevronLeft size={17} strokeWidth={2} />
          </button>

          <div className="min-w-0 flex-1 leading-none">
            <h1
              className="text-[17px] sm:text-[18px] font-bold tracking-tight truncate leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {t("calendar.title", isIndonesian ? "Kalender" : "Calendar")}
            </h1>
            <p
              className="text-[10px] sm:text-[10.5px] font-medium truncate mt-0.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              {viewMode === "runway"
                ? t(
                    "calendar.runwaySubtitle",
                    isIndonesian
                      ? "Ketahanan Kas & Proyeksi"
                      : "Runway & Projections",
                  )
                : t(
                    "calendar.activitySubtitle",
                    isIndonesian
                      ? "Aktivitas & Jadwal Tagihan"
                      : "Activity & Schedule",
                  )}
            </p>
          </div>
        </div>

        {/* Right Side: Stealth Button & Apple Segmented Control */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Stealth Mode Button */}
          <button
            type="button"
            onClick={toggleStealthMode}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer select-none"
            style={{
              background: buttonGlassBg,
              border: buttonGlassBorder,
              boxShadow: buttonGlassShadow,
              color: isStealthMode
                ? "var(--text-primary)"
                : "var(--text-tertiary)",
            }}
            title={
              isStealthMode
                ? isIndonesian
                  ? "Tampilkan Saldo"
                  : "Show Balance"
                : isIndonesian
                  ? "Sembunyikan Saldo"
                  : "Hide Balance"
            }
            aria-label="Toggle Stealth"
          >
            {isStealthMode ? (
              <EyeOff size={13.5} strokeWidth={1.8} />
            ) : (
              <Eye size={13.5} strokeWidth={1.8} />
            )}
          </button>

          {/* Minimalist Tactile Segmented Track (Zero Glow) */}
          <div
            className="flex p-0.5 rounded-full select-none"
            style={{
              background: segmentedTrackBg,
              border: buttonGlassBorder,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setViewMode("activity");
                triggerHaptic("light");
              }}
              className={`h-7 px-2.5 rounded-full text-[10.5px] font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer select-none active:scale-95 ${
                viewMode === "activity"
                  ? isDark
                    ? "bg-white text-zinc-950 shadow-xs"
                    : "bg-[#18181b] text-white shadow-xs"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <CalendarDays size={11.5} strokeWidth={2} />
              <span>
                {t(
                  "calendar.activityTab",
                  isIndonesian ? "Aktivitas" : "Activity",
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode("runway");
                triggerHaptic("light");
              }}
              className={`h-7 px-2.5 rounded-full text-[10.5px] font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer select-none active:scale-95 ${
                viewMode === "runway"
                  ? isDark
                    ? "bg-white text-zinc-950 shadow-xs"
                    : "bg-[#18181b] text-white shadow-xs"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <TrendingUp size={11.5} strokeWidth={2} />
              <span>
                {t("calendar.runwayTab", isIndonesian ? "Ketahanan" : "Runway")}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Runway Telemetry Bento Banner (Runway Mode) ── */}
      <CalendarRunwayBento
        viewMode={viewMode}
        runwayTelemetry={runwayTelemetry}
        isIndonesian={isIndonesian}
        dateLocale={dateLocale}
        displayRupiah={displayRupiah}
      />

      {/* ── 3. Monthly Matrix & Heatmap Grid + Legend ── */}
      <CalendarMonthlyMatrix
        currentDate={currentDate}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        days={days}
        startPad={startPad}
        slideDirection={slideDirection}
        isCurrentMonthView={isCurrentMonthView}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onResetToToday={handleResetToToday}
        viewMode={viewMode}
        runwayTelemetry={runwayTelemetry}
        isDark={isDark}
        isIndonesian={isIndonesian}
        dateLocale={dateLocale}
        displayCompact={displayCompact}
        t={t}
      />

      {/* ── 4. Subscription, Recurring Bill Tracker & Detected Recurring Patterns ── */}
      <CalendarUpcomingBillsSection
        bills={bills}
        detectedRecurringItems={detectedRecurringExpenseItems}
        confirmingRecurringId={confirmingRecurringId}
        onConfirmRecurring={handleConfirmRecurring}
        onIgnoreRecurring={handleIgnoreRecurring}
        onPayBill={(bill) => setPayingBill(bill)}
        onOpenManageBills={() => setIsManageBillsOpen(true)}
        onOpenReminderSettings={() => setIsReminderSheetOpen(true)}
        isIndonesian={isIndonesian}
        dateLocale={dateLocale}
        displayRupiah={displayRupiah}
      />

      {/* ── 5. Daily Obligation & Transaction Drawer ── */}
      <CalendarDayDetailSheet
        selectedDay={selectedDay}
        selectedDayForecast={selectedDayForecast}
        selectedDayTxs={selectedDayTxs}
        bills={bills}
        onClose={() => setSelectedDay(null)}
        onPayBill={(bill) => setPayingBill(bill)}
        isIndonesian={isIndonesian}
        dateLocale={dateLocale}
        displayRupiah={displayRupiah}
      />

      {/* ── 6. Pay Bill Settlement Modal ── */}
      {payingBill && (
        <PayBillModal
          isOpen={!!payingBill}
          bill={payingBill}
          onClose={() => setPayingBill(null)}
          isPending={markBillPaidMutation.isPending}
          onConfirmPaid={({ bill, recordTransaction, walletId }) => {
            markBillPaidMutation.mutate(
              { bill, paid: true, recordTransaction, walletId },
              {
                onSuccess: () => {
                  setPayingBill(null);
                  showToast(
                    isIndonesian
                      ? `${bill.title} berhasil ditandai lunas`
                      : `${bill.title} marked as paid`,
                    "add",
                    () => {},
                  );
                },
                onError: (error: any) => {
                  showToast(
                    error?.message ||
                      (isIndonesian
                        ? `Gagal menandai ${bill.title}`
                        : `Failed to mark ${bill.title} as paid`),
                    "delete",
                    () => {},
                  );
                },
              },
            );
          }}
        />
      )}

      {/* ── 7. Recurring Bill Management Sheets ── */}
      <BillManagementSheets
        isOpen={isManageBillsOpen}
        onClose={() => setIsManageBillsOpen(false)}
      />

      {/* ── 8. Bill & Daily Log Reminder Settings Sheet ── */}
      <BillDailyReminderSheet
        isOpen={isReminderSheetOpen}
        onClose={() => setIsReminderSheetOpen(false)}
        bills={bills}
      />

      <div className="h-2" />
    </div>
  );
}
