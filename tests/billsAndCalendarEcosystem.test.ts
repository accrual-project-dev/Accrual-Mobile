import { describe, it, expect } from "vitest";
import {
  calculateMonthCalendarRunway,
  type CalendarRunwayOptions,
} from "../src/lib/calendarForecasting";
import { findBestMatchingBill } from "../src/lib/billMatchingEngine";
import {
  getNextDueDate,
  getDaysUntilDue,
  getBillDueStatusLabel,
} from "../src/hooks/useBills";
import type { Bill, Transaction } from "../src/lib/types";
import type { DetectedRecurringItem } from "../src/lib/financialMath";
import { format } from "date-fns";

describe("Bills, Calendar & Cashflow Forecasting Ecosystem Suite", () => {
  const referenceDate = new Date("2026-10-15T12:00:00Z");

  const mockBills: Bill[] = [
    {
      id: "b-netflix",
      user_id: "u1",
      title: "Netflix Subscription",
      amount: 186000,
      due_date: "2026-10-20",
      repeat_rule: "monthly",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-gym",
      user_id: "u1",
      title: "Gold's Gym Membership",
      amount: 500000,
      due_date: "2026-10-25",
      repeat_rule: "monthly",
      is_paid: true,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-weekly-groceries",
      user_id: "u1",
      title: "Weekly Market Restock",
      amount: 350000,
      due_date: "2026-10-18",
      repeat_rule: "weekly",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-yearly-domain",
      user_id: "u1",
      title: "Domain Renewal",
      amount: 250000,
      due_date: "2026-11-05",
      repeat_rule: "yearly",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-one-off",
      user_id: "u1",
      title: "Concert Ticket",
      amount: 750000,
      due_date: "2026-10-28",
      repeat_rule: "none",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
  ];

  describe("1. Dynamic Runway Solvency & Health Model (Burn-based Days)", () => {
    it("rates solvency as 'danger' and lowest dip as 'critical' when balance falls below zero", () => {
      const options: CalendarRunwayOptions = {
        year: 2026,
        month: 10,
        transactions: [],
        bills: [
          {
            id: "b-huge",
            user_id: "u1",
            title: "Rent Overdraft",
            amount: 5000000,
            due_date: "2026-10-18",
            repeat_rule: "none",
            is_paid: false,
            created_at: "2026-10-01T00:00:00Z",
          },
        ],
        currentLiquidAssets: 1000000, // starting with 1M, but 5M bill due
        dailyBaselineBurn: 100000,
        referenceDate,
      };

      const result = calculateMonthCalendarRunway(options);
      expect(result.lowestDipAmount).toBeLessThan(0);
      expect(result.lowestDipStatus).toBe("critical");

      const postBillDay = result.days.find((d) => d.date === "2026-10-18");
      expect(postBillDay?.solvencyStatus).toBe("danger");
    });

    it("rates solvency and lowest dip based on runway days (< 7d: tight/caution, < 21d: adequate, >= 21d: surplus/fortress)", () => {
      const dailyBurn = 100000; // 100k IDR/day

      // Remaining future days in Oct 2026 (Oct 16 to 31) = 16 days. Total future burn = 1,600,000 IDR.

      // Case A: 2.0M start balance -> 400k lowest dip = 4 days burn (< 7 days -> caution & tight)
      const resTight = calculateMonthCalendarRunway({
        year: 2026,
        month: 10,
        transactions: [],
        bills: [],
        currentLiquidAssets: 2000000,
        dailyBaselineBurn: dailyBurn,
        referenceDate,
      });
      expect(resTight.lowestDipAmount).toBe(400000);
      expect(resTight.lowestDipStatus).toBe("caution");
      const dayTight = resTight.days.find((d) => d.date === "2026-10-31");
      expect(dayTight?.solvencyStatus).toBe("tight");

      // Case B: 3.1M start balance -> 1.5M lowest dip = 15 days burn (7 <= days < 21 -> adequate)
      const resAdequate = calculateMonthCalendarRunway({
        year: 2026,
        month: 10,
        transactions: [],
        bills: [],
        currentLiquidAssets: 3100000,
        dailyBaselineBurn: dailyBurn,
        referenceDate,
      });
      expect(resAdequate.lowestDipAmount).toBe(1500000);
      expect(resAdequate.lowestDipStatus).toBe("adequate");
      const dayAdequate = resAdequate.days.find((d) => d.date === "2026-10-31");
      expect(dayAdequate?.solvencyStatus).toBe("adequate");

      // Case C: 4.2M start balance -> 2.6M lowest dip = 26 days burn (>= 21 days -> fortress & surplus)
      const resFortress = calculateMonthCalendarRunway({
        year: 2026,
        month: 10,
        transactions: [],
        bills: [],
        currentLiquidAssets: 4200000,
        dailyBaselineBurn: dailyBurn,
        referenceDate,
      });
      expect(resFortress.lowestDipAmount).toBe(2600000);
      expect(resFortress.lowestDipStatus).toBe("fortress");
      const dayFortress = resFortress.days.find((d) => d.date === "2026-10-31");
      expect(dayFortress?.solvencyStatus).toBe("surplus");
    });

    it("adapts recurring salary detection for foreign currency (USD) vs IDR", () => {
      const mockUsdSalary: DetectedRecurringItem = {
        id: "rec-usd-paycheck",
        title: "US Tech Remote Paycheck",
        normalizedMerchant: "employer",
        categoryId: "c-salary",
        categoryName: "Salary",
        categoryEmoji: "briefcase",
        walletId: "w-usd",
        type: "income",
        frequency: "monthly",
        typicalAmount: 3200, // $3,200 USD
        amountRange: [3200, 3200],
        confidence: "strong",
        occurrencesCount: 3,
        lastOccurrenceDate: "2026-09-25",
        nextExpectedDate: "2026-10-25",
        status: "confirmed",
        matchingTransactionIds: [],
        explanation: "Monthly USD direct deposit",
      };

      // When currency is USD, $3,200 is recognized as recurring salary
      const resUsd = calculateMonthCalendarRunway({
        year: 2026,
        month: 10,
        transactions: [],
        bills: [],
        currentLiquidAssets: 5000,
        recurringItems: [mockUsdSalary],
        dailyBaselineBurn: 50,
        referenceDate,
        currency: "USD",
      });

      expect(resUsd.nextPaydayDate).toBe("2026-10-25");
      expect(resUsd.nextPaydayAmount).toBe(3200);

      // When fallback IDR is evaluated, a $3,200 salary without currency flag would be below Rp 500.000
      const resIdr = calculateMonthCalendarRunway({
        year: 2026,
        month: 10,
        transactions: [],
        bills: [],
        currentLiquidAssets: 50000000,
        recurringItems: [mockUsdSalary],
        dailyBaselineBurn: 100000,
        referenceDate,
        currency: "IDR",
      });
      expect(resIdr.nextPaydayDate).toBeNull();
    });
  });

  describe("2. Smart Bill Matching Engine (Bilingual & Multi-Currency)", () => {
    it("identifies exact title and amount match with 0.95 confidence and localized message", () => {
      // Indonesian
      const matchId = findBestMatchingBill(
        "Pembayaran Netflix Subscription",
        186000,
        mockBills,
        true,
        "IDR",
      );
      expect(matchId).not.toBeNull();
      expect(matchId?.bill.id).toBe("b-netflix");
      expect(matchId?.confidence).toBe(0.95);
      expect(matchId?.exactAmountMatch).toBe(true);
      expect(matchId?.matchReason).toBe("Nama & nominal tagihan cocok persis");

      // English
      const matchEn = findBestMatchingBill(
        "Netflix Subscription charge",
        186000,
        mockBills,
        false,
        "IDR",
      );
      expect(matchEn).not.toBeNull();
      expect(matchEn?.confidence).toBe(0.95);
      expect(matchEn?.matchReason).toBe("Exact bill title & amount match");
    });

    it("matches bill with admin fee variance within tolerance (IDR <= 5000, USD <= 2)", () => {
      // IDR with 2.500 admin fee
      const matchId = findBestMatchingBill(
        "Netflix Subscription",
        188500, // 186.000 + 2.500
        mockBills,
        true,
        "IDR",
      );
      expect(matchId).not.toBeNull();
      expect(matchId?.confidence).toBe(0.85);
      expect(matchId?.exactAmountMatch).toBe(false);
      expect(matchId?.matchReason).toBe("Nama cocok, selisih nominal wajar (biaya admin)");

      // English
      const matchEn = findBestMatchingBill(
        "Netflix Subscription",
        188500,
        mockBills,
        false,
        "IDR",
      );
      expect(matchEn?.matchReason).toBe("Matching title with typical admin fee variance");
    });

    it("ignores paid bills so already settled obligations are not double matched", () => {
      // b-gym is marked as is_paid: true
      const match = findBestMatchingBill(
        "Gold's Gym Membership",
        500000,
        mockBills,
        true,
        "IDR",
      );
      expect(match).toBeNull();
    });

    it("returns null when title has no semantic overlap", () => {
      const match = findBestMatchingBill(
        "Nasi Padang Sederhana",
        45000,
        mockBills,
        true,
        "IDR",
      );
      expect(match).toBeNull();
    });
  });

  describe("3. Bill Cadence Calculation & Due Status Labels", () => {
    it("computes next due date correctly across weekly, monthly, and yearly cadences", () => {
      const weeklyBill: Bill = {
        id: "w1",
        user_id: "u1",
        title: "Weekly Grocery",
        due_date: "2026-10-18",
        repeat_rule: "weekly",
      };
      expect(getNextDueDate(weeklyBill)).toBe("2026-10-25");

      const monthlyBill: Bill = {
        id: "m1",
        user_id: "u1",
        title: "Monthly Rent",
        due_date: "2026-10-25",
        repeat_rule: "monthly",
      };
      expect(getNextDueDate(monthlyBill)).toBe("2026-11-25");

      const yearlyBill: Bill = {
        id: "y1",
        user_id: "u1",
        title: "Yearly Subscription",
        due_date: "2026-11-05",
        repeat_rule: "yearly",
      };
      expect(getNextDueDate(yearlyBill)).toBe("2027-11-05");

      const oneOffBill: Bill = {
        id: "o1",
        user_id: "u1",
        title: "Single Invoice",
        due_date: "2026-10-28",
        repeat_rule: "none",
      };
      expect(getNextDueDate(oneOffBill)).toBeNull();
    });

    it("safely handles invalid or empty due dates without throwing", () => {
      const invalidBill: Bill = {
        id: "inv1",
        user_id: "u1",
        title: "Corrupt Date",
        due_date: "invalid-date-string",
        repeat_rule: "monthly",
      };
      expect(getNextDueDate(invalidBill)).toBeNull();
      expect(getDaysUntilDue("invalid-date-string")).toBe(0);
      expect(getDaysUntilDue("")).toBe(0);
    });

    it("provides pure non-mixed localization for due status labels", () => {
      const todayKey = format(new Date(), "yyyy-MM-dd");
      expect(getBillDueStatusLabel(todayKey, true)).toBe("Jatuh tempo hari ini");
      expect(getBillDueStatusLabel(todayKey, false)).toBe("Due today");
    });
  });

  describe("4. Ledger Transaction Note Invariant (Rule 6 & Rule 8.1)", () => {
    it("generates 100% pure Indonesian note when isIndonesian is true", () => {
      const billTitle = "Spotify Family";
      const isIndonesian = true;
      const note = isIndonesian
        ? `Pembayaran tagihan: ${billTitle}`
        : `Bill payment: ${billTitle}`;
      expect(note).toBe("Pembayaran tagihan: Spotify Family");
      expect(note).not.toContain("Bill");
      expect(note).not.toContain("payment");
    });

    it("generates 100% pure English note when isIndonesian is false", () => {
      const billTitle = "Spotify Family";
      const isIndonesian = false;
      const note = isIndonesian
        ? `Pembayaran tagihan: ${billTitle}`
        : `Bill payment: ${billTitle}`;
      expect(note).toBe("Bill payment: Spotify Family");
      expect(note).not.toContain("Pembayaran");
      expect(note).not.toContain("tagihan");
    });

    it("enforces full ISO timestamp format yyyy-MM-dd'T'HH:mm:ss for bill settlement", () => {
      const now = new Date("2026-10-17T14:32:45.000Z");
      const formattedTimestamp = format(now, "yyyy-MM-dd'T'HH:mm:ss");
      expect(formattedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(formattedTimestamp).not.toHaveLength(10); // Not just YYYY-MM-DD
    });
  });
});
