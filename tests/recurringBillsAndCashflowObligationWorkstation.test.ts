import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateCashflowObligations,
  getNextDueDate,
  getDaysUntilDue,
  getBillDueStatusLabel,
} from "../src/hooks/useBills";
import { findBestMatchingBill } from "../src/lib/billMatchingEngine";
import type { Bill } from "../src/lib/types";
import fs from "fs";
import path from "path";
import { format } from "date-fns";

describe("Audit #43: Recurring Bills, Subscriptions & Cashflow Obligation Workstation Suite", () => {
  const referenceDate = new Date("2026-10-15T12:00:00Z");

  const sampleBills: Bill[] = [
    {
      id: "b-netflix",
      user_id: "u1",
      title: "Netflix 4K Premium",
      amount: 186000,
      due_date: "2026-10-20",
      repeat_rule: "monthly",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-chatgpt",
      user_id: "u1",
      title: "ChatGPT Plus Subscription",
      amount: 320000,
      due_date: "2026-10-16",
      repeat_rule: "monthly",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-gym",
      user_id: "u1",
      title: "Celebrity Fitness Gym",
      amount: 600000,
      due_date: "2026-10-10",
      repeat_rule: "monthly",
      is_paid: true, // already paid
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-weekly-market",
      user_id: "u1",
      title: "Weekly Grocery Delivery",
      amount: 250000,
      due_date: "2026-10-18",
      repeat_rule: "weekly",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-domain",
      user_id: "u1",
      title: "Cloud Domain Renewal",
      amount: 240000, // yearly 240k -> 20k/month
      due_date: "2026-12-05",
      repeat_rule: "yearly",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-overdue-utility",
      user_id: "u1",
      title: "Listrik PLN Pascabayar",
      amount: 450000,
      due_date: "2026-10-12", // 3 days before referenceDate
      repeat_rule: "monthly",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-oneoff-tax",
      user_id: "u1",
      title: "PBB Pajak Rumah",
      amount: 500000,
      due_date: "2026-10-28", // one-off due in current reference month
      repeat_rule: "none",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "b-future-oneoff",
      user_id: "u1",
      title: "Konser Musik",
      amount: 1500000,
      due_date: "2026-12-15", // one-off in December, NOT in October
      repeat_rule: "none",
      is_paid: false,
      created_at: "2026-10-01T00:00:00Z",
    },
  ];

  describe("1. Cashflow Obligation Normalization & Run-Rate Burn Calculation", () => {
    it("computes normalized monthly commitment accurately across repetition frequencies", () => {
      // Monthly:
      // Netflix: 186.000
      // ChatGPT: 320.000
      // Gym: 600.000
      // PLN: 450.000
      // Sum Monthly = 1.556.000
      // Weekly:
      // Weekly Grocery: 250.000 * 52 / 12 = 1.083.333
      // Yearly:
      // Domain: 240.000 / 12 = 20.000
      // One-off in Oct:
      // PBB: 500.000
      // Total monthly commitment = 1.556.000 + 1.083.333 + 20.000 + 500.000 = 3.159.333
      const summary = calculateCashflowObligations(sampleBills, referenceDate);
      expect(summary.totalMonthlyCommitment).toBe(3159333);
    });

    it("correctly segregates paid vs pending obligation sums and counts", () => {
      const summary = calculateCashflowObligations(sampleBills, referenceDate);
      // Paid: Gym (600.000)
      expect(summary.totalPaidCount).toBe(1);
      expect(summary.totalPaidAmount).toBe(600000);

      // Pending: Netflix (186k), ChatGPT (320k), Weekly (250k), Domain (240k), PLN (450k), PBB (500k), Future (1.5M)
      // Total pending sum = 186k + 320k + 250k + 240k + 450k + 500k + 1500k = 3.446.000
      expect(summary.totalPendingCount).toBe(7);
      expect(summary.totalPendingAmount).toBe(3446000);
    });

    it("identifies upcoming 7-day bills and overdue obligations relative to reference date", () => {
      // Reference: 2026-10-15
      // Overdue (< Oct 15):
      // - PLN: due 2026-10-12 (amount 450.000) -> 1 bill, 450.000
      // Upcoming 7 days (Oct 15 to Oct 22):
      // - ChatGPT: due 2026-10-16 (320.000)
      // - Weekly: due 2026-10-18 (250.000)
      // - Netflix: due 2026-10-20 (186.000)
      // Sum upcoming 7d = 320k + 250k + 186k = 756.000, Count = 3
      const summary = calculateCashflowObligations(sampleBills, referenceDate);
      expect(summary.overdueCount).toBe(1);
      expect(summary.overdueAmount).toBe(450000);

      expect(summary.upcoming7DaysCount).toBe(3);
      expect(summary.upcoming7DaysAmount).toBe(756000);
    });

    it("ignores bills with zero or undefined amounts", () => {
      const emptyBills: Bill[] = [
        {
          id: "b-zero",
          user_id: "u1",
          title: "Zero Bill",
          amount: 0,
          due_date: "2026-10-20",
          repeat_rule: "monthly",
          is_paid: false,
          created_at: "2026-10-01T00:00:00Z",
        },
      ];
      const summary = calculateCashflowObligations(emptyBills, referenceDate);
      expect(summary.totalMonthlyCommitment).toBe(0);
      expect(summary.totalPendingAmount).toBe(0);
      expect(summary.totalPendingCount).toBe(0);
    });
  });

  describe("2. Recurrence Rollover & Status Formatter", () => {
    it("computes next due dates correctly for weekly, monthly, and yearly cycles", () => {
      expect(
        getNextDueDate({
          id: "1",
          user_id: "u1",
          title: "Test",
          due_date: "2026-10-15",
          repeat_rule: "weekly",
          is_paid: false,
          created_at: "2026-10-01T00:00:00Z",
        })
      ).toBe("2026-10-22");

      expect(
        getNextDueDate({
          id: "2",
          user_id: "u1",
          title: "Test",
          due_date: "2026-10-15",
          repeat_rule: "monthly",
          is_paid: false,
          created_at: "2026-10-01T00:00:00Z",
        })
      ).toBe("2026-11-15");

      expect(
        getNextDueDate({
          id: "3",
          user_id: "u1",
          title: "Test",
          due_date: "2026-10-15",
          repeat_rule: "yearly",
          is_paid: false,
          created_at: "2026-10-01T00:00:00Z",
        })
      ).toBe("2027-10-15");

      expect(
        getNextDueDate({
          id: "4",
          user_id: "u1",
          title: "Test",
          due_date: "2026-10-15",
          repeat_rule: "none",
          is_paid: false,
          created_at: "2026-10-01T00:00:00Z",
        })
      ).toBeNull();
    });

    it("formats bilingual due status labels cleanly without mixed phrasing", () => {
      // Due today (today = 2026-10-15)
      const todayStr = format(new Date(), "yyyy-MM-dd");
      expect(getBillDueStatusLabel(todayStr, true)).toBe("Jatuh tempo hari ini");
      expect(getBillDueStatusLabel(todayStr, false)).toBe("Due today");
    });
  });

  describe("3. Expanded Smart Bill Matching Engine (Cloud, AI, Telco, Utilities)", () => {
    it("matches AI & Cloud subscriptions (ChatGPT, Claude, iCloud)", () => {
      const matchChatGpt = findBestMatchingBill(
        "OpenAI ChatGPT Subscription",
        320000,
        sampleBills,
        true
      );
      expect(matchChatGpt).not.toBeNull();
      expect(matchChatGpt?.bill.id).toBe("b-chatgpt");
      expect(matchChatGpt?.confidence).toBe(0.95);

      const matchIcloud = findBestMatchingBill(
        "Apple iCloud 200GB Storage",
        45000,
        [
          {
            id: "b-icloud",
            user_id: "u1",
            title: "iCloud Storage",
            amount: 45000,
            due_date: "2026-10-25",
            repeat_rule: "monthly",
            is_paid: false,
            created_at: "2026-10-01T00:00:00Z",
          },
        ],
        false
      );
      expect(matchIcloud).not.toBeNull();
      expect(matchIcloud?.bill.id).toBe("b-icloud");
    });

    it("matches Telco and Cellular services (Telkomsel, Indosat, XL)", () => {
      const matchTelco = findBestMatchingBill(
        "Pembelian Paket Data Telkomsel Halo",
        150000,
        [
          {
            id: "b-halo",
            user_id: "u1",
            title: "Pascabayar Telkomsel",
            amount: 150000,
            due_date: "2026-10-20",
            repeat_rule: "monthly",
            is_paid: false,
            created_at: "2026-10-01T00:00:00Z",
          },
        ],
        true
      );
      expect(matchTelco).not.toBeNull();
      expect(matchTelco?.bill.id).toBe("b-halo");
    });

    it("matches Property, IPL, and Maintenance service fees", () => {
      const matchIpl = findBestMatchingBill(
        "IPL Apartemen & Service Charge",
        850000,
        [
          {
            id: "b-ipl",
            user_id: "u1",
            title: "Maintenance Fee Apartemen",
            amount: 850000,
            due_date: "2026-10-22",
            repeat_rule: "monthly",
            is_paid: false,
            created_at: "2026-10-01T00:00:00Z",
          },
        ],
        true
      );
      expect(matchIpl).not.toBeNull();
      expect(matchIpl?.bill.id).toBe("b-ipl");
    });
  });

  describe("4. UI/UX Architectural & Quality Rule Invariants", () => {
    const rootDir = path.resolve(__dirname, "..");
    const billSheetsPath = path.join(
      rootDir,
      "src/components/settings/BillManagementSheets.tsx"
    );
    const payBillPath = path.join(rootDir, "src/components/bills/PayBillModal.tsx");
    const reminderSheetPath = path.join(
      rootDir,
      "src/components/settings/BillDailyReminderSheet.tsx"
    );
    const upcomingBillsSectionPath = path.join(
      rootDir,
      "src/components/bills/CalendarUpcomingBillsSection.tsx"
    );

    it("enforces Rule 1 (Zero native system colored emojis across bill components)", () => {
      const systemEmojiRegex =
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      const files = [
        billSheetsPath,
        payBillPath,
        reminderSheetPath,
        upcomingBillsSectionPath,
      ];

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(systemEmojiRegex.test(content)).toBe(false);
      }
    });

    it("enforces Rule 5 (Dynamic safe-area bottom inset in bottom sheets)", () => {
      const billSheetsContent = fs.readFileSync(billSheetsPath, "utf-8");
      expect(billSheetsContent).toContain("safe-area-inset-bottom");

      const payBillContent = fs.readFileSync(payBillPath, "utf-8");
      expect(payBillContent).toContain(
        "pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),28px)]"
      );

      const reminderContent = fs.readFileSync(reminderSheetPath, "utf-8");
      expect(reminderContent).toContain("safe-area-inset-bottom");
    });

    it("enforces Rule 6 (Pure non-mixed localization without gado-gado phrases)", () => {
      const billSheetsContent = fs.readFileSync(billSheetsPath, "utf-8");
      expect(billSheetsContent).not.toContain("Ganti Nama (Rename)");
      expect(billSheetsContent).not.toContain("Nominal (Amount)");
      expect(billSheetsContent).not.toContain("Action");

      const payBillContent = fs.readFileSync(payBillPath, "utf-8");
      expect(payBillContent).toContain("Bayar dari Akun Pribadi");
      expect(payBillContent).toContain("Dibayar oleh Orang Lain / Kantor");
    });

    it("enforces Rule 8.1 (Full ISO 8601 timestamps with seconds on payment recording)", () => {
      const payBillContent = fs.readFileSync(payBillPath, "utf-8");
      expect(payBillContent).toContain(
        'occurredOn: format(new Date(), "yyyy-MM-dd\'T\'HH:mm:ss")'
      );

      const timestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it("verifies GlassConfirmationModal and undo recovery for bill deletion in BillManagementSheets", () => {
      const billSheetsContent = fs.readFileSync(billSheetsPath, "utf-8");
      expect(billSheetsContent).toContain("<GlassConfirmationModal");
      expect(billSheetsContent).toContain("handleRequestDeleteBill");
      expect(billSheetsContent).toContain("handleConfirmDelete");
      expect(billSheetsContent).toContain("addBill.mutate");
    });

    it("verifies category selection integration in BillManagementSheets", () => {
      const billSheetsContent = fs.readFileSync(billSheetsPath, "utf-8");
      expect(billSheetsContent).toContain("billCategoryId");
      expect(billSheetsContent).toContain("expenseCategories");
      expect(billSheetsContent).toContain("category_id: billCategoryId || null");
    });
  });
});
