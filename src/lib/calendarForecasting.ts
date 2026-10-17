import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  differenceInCalendarDays,
  parseISO,
} from "date-fns";
import type { Transaction, Bill } from "./types";
import type { DetectedRecurringItem } from "./financialMath";

export interface CalendarDayForecast {
  date: string; // "YYYY-MM-DD"
  dateObj: Date;
  dayOfMonth: number;
  dayOfWeek: number; // 0 = Sun, 6 = Sat
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;

  // Actuals (for past & today)
  actualInflow: number;
  actualOutflow: number;
  netActualCashflow: number;
  transactionsCount: number;
  isNoSpendDay: boolean; // Past day with 0 outflow

  // Commitments & Future projections (for today & future)
  scheduledBills: Array<{
    id: string;
    title: string;
    amount: number;
    isPaid: boolean;
  }>;
  billsTotal: number;
  expectedInflows: Array<{
    title: string;
    amount: number;
    isPayday: boolean;
  }>;
  expectedInflowsTotal: number;
  estimatedBurn: number; // Baseline daily burn for future days
  netProjectedDailyChange: number;

  // Running balance telemetry
  projectedBalance: number;
  isLowestDip: boolean;
  isPayday: boolean;
  solvencyStatus: "surplus" | "adequate" | "tight" | "danger";
}

export interface MonthRunwayTelemetry {
  year: number;
  month: number;
  currentLiquidAssets: number;
  projectedMonthEndBalance: number;
  netProjectedChange: number;

  // Lowest Cash Dip (Runway Floor)
  lowestDipAmount: number;
  lowestDipDate: string | null;
  daysUntilLowestDip: number | null;
  lowestDipStatus: "fortress" | "adequate" | "caution" | "critical";

  // Payday Horizon
  nextPaydayDate: string | null;
  daysUntilPayday: number | null;
  nextPaydayAmount: number;

  // No-Spend Days
  noSpendDaysCount: number;
  totalPastDaysCount: number;
  noSpendRatioPct: number;

  // Day list for rendering
  days: CalendarDayForecast[];
}

export interface CalendarRunwayOptions {
  year: number;
  month: number; // 1-indexed (1 = Jan, 12 = Dec)
  transactions: Transaction[];
  bills: Bill[];
  currentLiquidAssets: number;
  recurringItems?: DetectedRecurringItem[];
  dailyBaselineBurn?: number;
  referenceDate?: Date;
  currency?: string;
}

/**
 * Calculate outlier-resistant daily baseline burn from historical transactions:
 * 1. Groups expenses by calendar date.
 * 2. Trims extreme top outliers (e.g. top 10% highest spend days) if >= 4 active days.
 * 3. Computes the median daily expense of the remaining days.
 */
export function calculateOutlierResistantDailyBurn(transactions: Transaction[]): number {
  const expenseTxs = transactions.filter(
    (t) => t.type === "expense" && Number(t.amount || 0) > 0,
  );
  if (expenseTxs.length === 0) return 0;

  const dailyTotals = new Map<string, number>();
  expenseTxs.forEach((t) => {
    const d = (t.occurred_on || "").split("T")[0];
    if (d) {
      dailyTotals.set(d, (dailyTotals.get(d) || 0) + Number(t.amount || 0));
    }
  });

  const values = Array.from(dailyTotals.values()).sort((a, b) => a - b);
  if (values.length === 0) return 0;

  // Trim top 10% outlier days to avoid skewing future burn from one-off capital expenditures
  const trimCount = values.length >= 4 ? Math.floor(values.length * 0.1) || 1 : 0;
  const trimmed = values.slice(0, values.length - trimCount);

  const mid = Math.floor(trimmed.length / 2);
  const median =
    trimmed.length % 2 !== 0
      ? trimmed[mid]
      : (trimmed[mid - 1] + trimmed[mid]) / 2;

  return Math.round(median);
}

export function calculateMonthCalendarRunway(
  options: CalendarRunwayOptions,
): MonthRunwayTelemetry {
  const {
    year,
    month,
    transactions = [],
    bills = [],
    currentLiquidAssets = 0,
    recurringItems = [],
    dailyBaselineBurn = 0,
    referenceDate = new Date(),
  } = options;

  // Outlier-resistant daily baseline burn
  const effectiveDailyBurn =
    dailyBaselineBurn > 0
      ? dailyBaselineBurn
      : calculateOutlierResistantDailyBurn(transactions);

  // Target month range
  const targetDate = new Date(year, month - 1, 1);
  const mStart = startOfMonth(targetDate);
  const mEnd = endOfMonth(targetDate);
  const calendarDays = eachDayOfInterval({ start: mStart, end: mEnd });

  const refDateStr = format(referenceDate, "yyyy-MM-dd");
  const refDateParsed = parseISO(refDateStr);

  // Recurring salaries (adaptive threshold: 50 for foreign currencies like USD/EUR, 500,000 for IDR)
  const isForeign = options.currency && options.currency !== "IDR";
  const minSalaryThreshold = isForeign ? 50 : 500000;
  const recurringSalaries = recurringItems.filter(
    (r) =>
      r.type === "income" &&
      (r.status === "confirmed" || r.status === "detected") &&
      r.typicalAmount >= minSalaryThreshold,
  );

  let runningBalance = currentLiquidAssets;
  let lowestDipAmount = currentLiquidAssets;
  let lowestDipDate: string | null = null;
  let daysUntilLowestDip: number | null = null;

  let nextPaydayDate: string | null = null;
  let daysUntilPayday: number | null = null;
  let nextPaydayAmount = 0;

  let noSpendDaysCount = 0;
  let totalPastDaysCount = 0;

  const dayForecasts: CalendarDayForecast[] = [];

  for (const dayObj of calendarDays) {
    const dStr = format(dayObj, "yyyy-MM-dd");
    const isPast = dStr < refDateStr;
    const isTod = options.referenceDate
      ? dStr === refDateStr
      : isToday(dayObj);
    const isFut = !isPast && !isTod;
    const dayDateParsed = parseISO(dStr);

    // Actual transactions (normalize full ISO timestamps YYYY-MM-DDTHH:mm:ss per Rule 8.1)
    const dayTxs = transactions.filter(
      (t) => (t.occurred_on || "").slice(0, 10) === dStr,
    );
    const actualInflow = dayTxs
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const actualOutflow = dayTxs
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const netActualCashflow = actualInflow - actualOutflow;

    // No-Spend Day: past day with zero outflow
    const isNoSpendDay = isPast && actualOutflow === 0;
    if (isPast) {
      totalPastDaysCount++;
      if (isNoSpendDay) {
        noSpendDaysCount++;
      }
    }

    // Scheduled bills due on this date
    const dayBills = bills.filter(
      (b) => (b.due_date || "").slice(0, 10) === dStr,
    );
    const unpaidDayBills = dayBills.filter((b) => !b.is_paid);
    const billsTotal = (isFut || isTod
      ? unpaidDayBills
      : dayBills
    ).reduce((sum, b) => sum + Number(b.amount || 0), 0);

    const scheduledBills = dayBills.map((b) => ({
      id: b.id,
      title: b.title,
      amount: Number(b.amount || 0),
      isPaid: Boolean(b.is_paid),
    }));

    // Expected recurring inflows (e.g. Salary / Payday)
    const expectedInflows: Array<{
      title: string;
      amount: number;
      isPayday: boolean;
    }> = [];

    recurringSalaries.forEach((sal) => {
      const salDayOfMonth = sal.lastOccurrenceDate
        ? parseISO(sal.lastOccurrenceDate).getUTCDate()
        : null;
      const isDateMatch =
        sal.nextExpectedDate === dStr ||
        (salDayOfMonth !== null && dayObj.getUTCDate() === salDayOfMonth);

      if (isDateMatch) {
        expectedInflows.push({
          title: sal.title || "Recurring Income",
          amount: sal.typicalAmount,
          isPayday: true,
        });
      }
    });

    const expectedInflowsTotal = expectedInflows.reduce(
      (sum, i) => sum + i.amount,
      0,
    );
    const isPayday = expectedInflows.some((i) => i.isPayday);

    // Track closest future payday
    if (isPayday && (isFut || isTod) && nextPaydayDate === null) {
      nextPaydayDate = dStr;
      daysUntilPayday = Math.max(
        0,
        differenceInCalendarDays(dayDateParsed, refDateParsed),
      );
      nextPaydayAmount = expectedInflowsTotal;
    }

    // Baseline daily burn (applied for future days)
    const estimatedBurn = isFut ? Math.max(0, effectiveDailyBurn) : 0;

    // Projected daily change
    const netProjectedDailyChange = isPast
      ? netActualCashflow
      : expectedInflowsTotal - billsTotal - estimatedBurn;

    if (isFut) {
      runningBalance += netProjectedDailyChange;
    }

    // Solvency status rating based on Burn-based Runway Days (< 7d: tight, < 21d: adequate, >= 21d: surplus)
    let solvencyStatus: CalendarDayForecast["solvencyStatus"] = "surplus";
    if (runningBalance < 0) {
      solvencyStatus = "danger";
    } else if (effectiveDailyBurn > 0) {
      const runwayDays = runningBalance / effectiveDailyBurn;
      if (runwayDays < 7) {
        solvencyStatus = "tight";
      } else if (runwayDays < 21) {
        solvencyStatus = "adequate";
      } else {
        solvencyStatus = "surplus";
      }
    } else {
      const tightFloor = isForeign ? 100 : 1500000;
      const adequateFloor = isForeign ? 350 : 5000000;
      if (runningBalance < tightFloor) {
        solvencyStatus = "tight";
      } else if (runningBalance < adequateFloor) {
        solvencyStatus = "adequate";
      }
    }

    // Track lowest dip among today and future dates
    if (isTod || isFut) {
      if (runningBalance < lowestDipAmount || lowestDipDate === null) {
        lowestDipAmount = runningBalance;
        lowestDipDate = dStr;
        daysUntilLowestDip = Math.max(
          0,
          differenceInCalendarDays(dayDateParsed, refDateParsed),
        );
      }
    }

    dayForecasts.push({
      date: dStr,
      dateObj: dayObj,
      dayOfMonth: dayObj.getDate(),
      dayOfWeek: dayObj.getDay(),
      isPast,
      isToday: isTod,
      isFuture: isFut,
      actualInflow,
      actualOutflow,
      netActualCashflow,
      transactionsCount: dayTxs.length,
      isNoSpendDay,
      scheduledBills,
      billsTotal,
      expectedInflows,
      expectedInflowsTotal,
      estimatedBurn,
      netProjectedDailyChange,
      projectedBalance: isPast ? 0 : runningBalance,
      isLowestDip: false, // will flag after loop
      isPayday,
      solvencyStatus,
    });
  }

  // Flag the lowest dip day
  if (lowestDipDate) {
    const dipDay = dayForecasts.find((d) => d.date === lowestDipDate);
    if (dipDay) {
      dipDay.isLowestDip = true;
    }
  }

  // Compute lowest dip health status based on Burn-based Runway Days (< 7d: caution, < 21d: adequate, >= 21d: fortress)
  let lowestDipStatus: MonthRunwayTelemetry["lowestDipStatus"] = "fortress";
  if (lowestDipAmount < 0) {
    lowestDipStatus = "critical";
  } else if (effectiveDailyBurn > 0) {
    const runwayDays = lowestDipAmount / effectiveDailyBurn;
    if (runwayDays < 7) {
      lowestDipStatus = "caution";
    } else if (runwayDays < 21) {
      lowestDipStatus = "adequate";
    } else {
      lowestDipStatus = "fortress";
    }
  } else {
    const cautionFloor = isForeign ? 100 : 1500000;
    const adequateFloor = isForeign ? 350 : 5000000;
    if (lowestDipAmount < cautionFloor) {
      lowestDipStatus = "caution";
    } else if (lowestDipAmount < adequateFloor) {
      lowestDipStatus = "adequate";
    }
  }

  const projectedMonthEndBalance = runningBalance;
  const netProjectedChange = projectedMonthEndBalance - currentLiquidAssets;
  const noSpendRatioPct =
    totalPastDaysCount > 0
      ? Math.round((noSpendDaysCount / totalPastDaysCount) * 100)
      : 0;

  return {
    year,
    month,
    currentLiquidAssets,
    projectedMonthEndBalance,
    netProjectedChange,
    lowestDipAmount,
    lowestDipDate,
    daysUntilLowestDip,
    lowestDipStatus,
    nextPaydayDate,
    daysUntilPayday,
    nextPaydayAmount,
    noSpendDaysCount,
    totalPastDaysCount,
    noSpendRatioPct,
    days: dayForecasts,
  };
}
