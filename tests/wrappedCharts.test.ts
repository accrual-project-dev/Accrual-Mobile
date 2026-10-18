import { describe, it, expect } from "vitest";
import {
  buildCascadeCategories,
  buildSpendingHeatmap,
  buildAnnualSpendingHeatmap,
  buildPeriodicCashflowData,
  buildRunwayProjection,
} from "../src/lib/wrappedAnalytics";
import type { Transaction } from "../src/lib/types";

describe("Financial Wrapped Analytics & Chart Engines", () => {
  describe("Stacked Cascade Categories Builder", () => {
    it("formats top categories with accurate rank and relative percentages", () => {
      const mockSortedCats = [
        { name: "Food & Dining", total: 3000000, count: 25 },
        { name: "Rock & Gear", total: 2400000, count: 12 },
        { name: "Rhythm & Blues", total: 1700000, count: 8 },
        { name: "Pop Music", total: 500000, count: 4 },
        { name: "Blues", total: 400000, count: 2 },
        { name: "Other", total: 200000, count: 1 },
      ];
      const totalExpense = 10000000; // 10 Million total

      const cascade = buildCascadeCategories(mockSortedCats, totalExpense, 5);

      expect(cascade).toHaveLength(5);
      expect(cascade[0].name).toBe("Food & Dining");
      expect(cascade[0].percentage).toBe(30);
      expect(cascade[0].rank).toBe(1);

      expect(cascade[1].name).toBe("Rock & Gear");
      expect(cascade[1].percentage).toBe(24);
      expect(cascade[1].rank).toBe(2);

      expect(cascade[2].name).toBe("Rhythm & Blues");
      expect(cascade[2].percentage).toBe(17);

      expect(cascade[3].name).toBe("Pop Music");
      expect(cascade[3].percentage).toBe(5);

      expect(cascade[4].name).toBe("Blues");
      expect(cascade[4].percentage).toBe(4);
    });

    it("handles empty categories gracefully", () => {
      const cascade = buildCascadeCategories([], 100000);
      expect(cascade).toEqual([]);
    });
  });

  describe("Spending Heatmap Matrix Engine (Monthly)", () => {
    it("calculates daily intensities across a month and identifies peak spend day", () => {
      const mockTxs: Transaction[] = [
        {
          id: "tx-1",
          user_id: "u1",
          amount: 50000,
          category_id: "c1",
          wallet_id: "w1",
          to_wallet_id: null,
          type: "expense",
          note: "Coffee",
          occurred_on: "2026-09-02",
          created_at: "2026-09-02T10:00:00Z",
        },
        {
          id: "tx-2",
          user_id: "u1",
          amount: 500000,
          category_id: "c1",
          wallet_id: "w1",
          to_wallet_id: null,
          type: "expense",
          note: "Big Dinner",
          occurred_on: "2026-09-15",
          created_at: "2026-09-15T20:00:00Z",
        },
      ];

      const heatmap = buildSpendingHeatmap(mockTxs, 2026, 9);

      expect(heatmap.days).toHaveLength(30); // September has 30 days
      expect(heatmap.peakDay).not.toBeNull();
      expect(heatmap.peakDay?.day).toBe(15);
      expect(heatmap.peakDay?.amount).toBe(500000);
      expect(heatmap.peakDay?.intensity).toBe(4);

      // Day 2 should have lower intensity
      const day2 = heatmap.days.find((d) => d.day === 2);
      expect(day2?.amount).toBe(50000);
      expect(day2?.intensity).toBeGreaterThan(0);

      // Day 1 has 0 spend
      const day1 = heatmap.days.find((d) => d.day === 1);
      expect(day1?.amount).toBe(0);
      expect(day1?.intensity).toBe(0);

      expect(heatmap.zeroSpendDaysCount).toBe(28);
      expect(heatmap.activeSpendDaysCount).toBe(2);
    });
  });

  describe("Annual Spending Heatmap Matrix Engine (365-day 52-week)", () => {
    it("generates full 365 days across 52 weeks and identifies annual peak month and day", () => {
      const mockTxs: Transaction[] = [
        {
          id: "tx-1",
          user_id: "u1",
          amount: 250000,
          category_id: "c1",
          wallet_id: "w1",
          to_wallet_id: null,
          type: "expense",
          note: "New Year Gadget",
          occurred_on: "2026-01-05",
          created_at: "2026-01-05T10:00:00Z",
        },
        {
          id: "tx-2",
          user_id: "u1",
          amount: 2500000,
          category_id: "c1",
          wallet_id: "w1",
          to_wallet_id: null,
          type: "expense",
          note: "Mid-Year Vacation Outflow",
          occurred_on: "2026-07-20",
          created_at: "2026-07-20T12:00:00Z",
        },
      ];

      const annualHeatmap = buildAnnualSpendingHeatmap(mockTxs, 2026);

      expect(annualHeatmap.days).toHaveLength(365);
      expect(annualHeatmap.weeksCount).toBeGreaterThanOrEqual(52);
      expect(annualHeatmap.monthSummaries).toHaveLength(12);

      // Peak month should be July (month 7)
      expect(annualHeatmap.peakMonth).not.toBeNull();
      expect(annualHeatmap.peakMonth?.month).toBe(7);
      expect(annualHeatmap.peakMonth?.monthName).toBe("Jul");
      expect(annualHeatmap.peakMonth?.amount).toBe(2500000);
      expect(annualHeatmap.peakMonth?.isPeak).toBe(true);

      // Peak day should be July 20
      expect(annualHeatmap.peakDay).not.toBeNull();
      expect(annualHeatmap.peakDay?.dateStr).toBe("2026-07-20");
      expect(annualHeatmap.peakDay?.amount).toBe(2500000);
      expect(annualHeatmap.peakDay?.intensity).toBe(4);

      // Active vs zero spend days
      expect(annualHeatmap.activeSpendDaysCount).toBe(2);
      expect(annualHeatmap.zeroSpendDaysCount).toBe(363);
    });
  });

  describe("Periodic Cashflow Engine (Slide 2 Dynamic Bar Chart)", () => {
    const mockTxs: Transaction[] = [
      {
        id: "tx-in-1",
        user_id: "u1",
        amount: 10000000,
        category_id: "c-inc",
        wallet_id: "w1",
        to_wallet_id: null,
        type: "income",
        note: "January Salary",
        occurred_on: "2026-01-25",
        created_at: "2026-01-25T08:00:00Z",
      },
      {
        id: "tx-out-1",
        user_id: "u1",
        amount: 4000000,
        category_id: "c-exp",
        wallet_id: "w1",
        to_wallet_id: null,
        type: "expense",
        note: "January Rent",
        occurred_on: "2026-01-28",
        created_at: "2026-01-28T09:00:00Z",
      },
      {
        id: "tx-in-2",
        user_id: "u1",
        amount: 15000000,
        category_id: "c-inc",
        wallet_id: "w1",
        to_wallet_id: null,
        type: "income",
        note: "February Bonus",
        occurred_on: "2026-02-15",
        created_at: "2026-02-15T08:00:00Z",
      },
      {
        id: "tx-out-2",
        user_id: "u1",
        amount: 6000000,
        category_id: "c-exp",
        wallet_id: "w1",
        to_wallet_id: null,
        type: "expense",
        note: "February Gear",
        occurred_on: "2026-02-20",
        created_at: "2026-02-20T09:00:00Z",
      },
    ];

    it("generates 12 monthly dual-series data points for year mode", () => {
      const cashflow = buildPeriodicCashflowData(mockTxs, "year", 2026, 1);

      expect(cashflow).toHaveLength(12);
      expect(cashflow[0].label).toBe("Jan");
      expect(cashflow[0].inflow).toBe(10000000);
      expect(cashflow[0].outflow).toBe(4000000);
      expect(cashflow[0].net).toBe(6000000);

      expect(cashflow[1].label).toBe("Feb");
      expect(cashflow[1].inflow).toBe(15000000);
      expect(cashflow[1].outflow).toBe(6000000);
      expect(cashflow[1].net).toBe(9000000);

      const maxInflow = Math.max(...cashflow.map((p) => p.inflow));
      const maxOutflow = Math.max(...cashflow.map((p) => p.outflow));
      expect(maxInflow).toBe(15000000);
      expect(maxOutflow).toBe(6000000);
    });

    it("generates 4-5 weekly dual-series data points for month mode", () => {
      const monthTxs: Transaction[] = [
        {
          id: "tx-m1",
          user_id: "u1",
          amount: 5000000,
          category_id: "c-inc",
          wallet_id: "w1",
          to_wallet_id: null,
          type: "income",
          note: "Week 1 Freelance",
          occurred_on: "2026-01-03",
          created_at: "2026-01-03T08:00:00Z",
        },
        {
          id: "tx-m2",
          user_id: "u1",
          amount: 1500000,
          category_id: "c-exp",
          wallet_id: "w1",
          to_wallet_id: null,
          type: "expense",
          note: "Week 1 Groceries",
          occurred_on: "2026-01-04",
          created_at: "2026-01-04T09:00:00Z",
        },
      ];

      const cashflow = buildPeriodicCashflowData(monthTxs, "month", 2026, 1);

      expect(cashflow.length).toBeGreaterThanOrEqual(4);
      expect(cashflow[0].label).toBe("W1");
      expect(cashflow[0].inflow).toBe(5000000);
      expect(cashflow[0].outflow).toBe(1500000);
      expect(cashflow[0].net).toBe(3500000);
    });
  });

  describe("Multi-Horizon Runway Projection Engine", () => {
    it("extrapolates wealth retention across future periods", () => {
      const totalIncome = 10000000;
      const totalExpense = 6000000; // 4 Million net monthly surplus

      const projection = buildRunwayProjection(totalIncome, totalExpense);

      expect(projection.monthlyPace).toBe(4000000);
      expect(projection.points).toHaveLength(7);
      expect(projection.points[0].amount).toBe(0); // Present
      expect(projection.points[1].amount).toBe(4000000); // +1 Mo
      expect(projection.terminalProjectedSurplus).toBeGreaterThan(20000000); // +6 Mo
    });

    it("safely clamps negative cashflow deficit to zero surplus", () => {
      const totalIncome = 3000000;
      const totalExpense = 8000000; // Deficit

      const projection = buildRunwayProjection(totalIncome, totalExpense);

      expect(projection.monthlyPace).toBe(0);
      expect(projection.terminalProjectedSurplus).toBe(0);
      projection.points.forEach((pt) => {
        expect(pt.amount).toBe(0);
      });
    });
  });

  describe("Heatmap Edge Cases & Accounting Isolation", () => {
    it("excludes [Correction], Saldo Awal, and Opening Balance from spending heatmap", () => {
      const mockTxs: Transaction[] = [
        {
          id: "tx-real",
          user_id: "u1",
          amount: 150000,
          category_id: "c1",
          wallet_id: "w1",
          to_wallet_id: null,
          type: "expense",
          note: "Real lunch",
          occurred_on: "2026-05-10",
          created_at: "2026-05-10T10:00:00Z",
        },
        {
          id: "tx-corr-1",
          user_id: "u1",
          amount: 5000000,
          category_id: "c1",
          wallet_id: "w1",
          to_wallet_id: null,
          type: "expense",
          note: "[Correction] Adjust wallet balance",
          occurred_on: "2026-05-10",
          created_at: "2026-05-10T11:00:00Z",
        },
        {
          id: "tx-corr-2",
          user_id: "u1",
          amount: 2000000,
          category_id: "c1",
          wallet_id: "w1",
          to_wallet_id: null,
          type: "expense",
          note: "Saldo Awal Penyesuaian",
          occurred_on: "2026-05-10",
          created_at: "2026-05-10T12:00:00Z",
        },
      ];

      const heatmap = buildSpendingHeatmap(mockTxs, 2026, 5);
      const day10 = heatmap.days.find((d) => d.day === 10);

      // Only real lunch (150000) should be included, not the 7M in corrections
      expect(day10?.amount).toBe(150000);
      expect(heatmap.peakDay?.amount).toBe(150000);
    });

    it("handles leap year (2024 has 366 days) vs standard year (2026 has 365 days)", () => {
      const leapHeatmap = buildAnnualSpendingHeatmap([], 2024);
      expect(leapHeatmap.days).toHaveLength(366);

      const standardHeatmap = buildAnnualSpendingHeatmap([], 2026);
      expect(standardHeatmap.days).toHaveLength(365);
    });

    it("handles month mode week buckets: 28 days yields 4 buckets, 31 days yields 5 buckets", () => {
      const febCashflow = buildPeriodicCashflowData([], "month", 2026, 2); // 28 days
      expect(febCashflow).toHaveLength(4);

      const janCashflow = buildPeriodicCashflowData([], "month", 2026, 1); // 31 days
      expect(janCashflow).toHaveLength(5);
    });
  });
});
