import { describe, it, expect } from "vitest";
import { PayBillModal } from "../src/components/bills/PayBillModal";
import { CalendarDayDetailSheet } from "../src/components/bills/CalendarDayDetailSheet";
import fs from "fs";
import path from "path";
import { format } from "date-fns";

describe("Daily Calendar Day Schedule Inspector & Interactive Bill Settlement Workstation Suite (Audit #31)", () => {
  const rootDir = path.resolve(__dirname, "..");
  const payBillPath = path.join(rootDir, "src/components/bills/PayBillModal.tsx");
  const calendarDayPath = path.join(
    rootDir,
    "src/components/bills/CalendarDayDetailSheet.tsx",
  );
  const useBillsPath = path.join(rootDir, "src/hooks/useBills.ts");
  const calendarPagePath = path.join(rootDir, "src/pages/CalendarPage.tsx");
  const homeModalsPath = path.join(
    rootDir,
    "src/components/home/HomeModalsContainer.tsx",
  );
  const billSheetsPath = path.join(
    rootDir,
    "src/components/settings/BillManagementSheets.tsx",
  );

  describe("1. Component Exports & Function Signatures", () => {
    it("exports PayBillModal component function", () => {
      expect(PayBillModal).toBeDefined();
      expect(typeof PayBillModal).toBe("function");
    });

    it("exports CalendarDayDetailSheet component function", () => {
      expect(CalendarDayDetailSheet).toBeDefined();
      expect(typeof CalendarDayDetailSheet).toBe("function");
    });

    it("exports PayBillSettlementParams from bills index layer", () => {
      const billsIndexPath = path.join(rootDir, "src/components/bills/index.ts");
      const content = fs.readFileSync(billsIndexPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain("export { PayBillModal } from \"./PayBillModal\";");
      expect(content).toContain(
        "export type { PayBillSettlementParams } from \"./PayBillModal\";",
      );
      expect(content).toContain(
        "export { CalendarDayDetailSheet } from \"./CalendarDayDetailSheet\";",
      );
    });
  });

  describe("2. PayBillModal Settlement Hardening & Invariants", () => {
    it("enforces dynamic iOS home indicator safe-area bottom inset (Rule 5)", () => {
      const content = fs.readFileSync(payBillPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain(
        "pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),28px)]",
      );
    });

    it("verifies zero native system colored emojis in PayBillModal (Rule 1)", () => {
      const content = fs.readFileSync(payBillPath, "utf-8").replace(/\r\n/g, "\n");
      const systemEmojiRegex =
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(systemEmojiRegex.test(content)).toBe(false);
    });

    it("verifies pure non-mixed Indonesian localization without 'space' (Rule 6)", () => {
      const content = fs.readFileSync(payBillPath, "utf-8").replace(/\r\n/g, "\n");

      // Zero mixed English words in Indonesian phrases
      expect(content).not.toContain("pengeluaran di space");
      expect(content).toContain(
        "Potong saldo akun dan catat transaksi pengeluaran",
      );
      expect(content).toContain(
        "Tandai lunas tanpa memotong saldo akun & tanpa mencatat transaksi",
      );
    });

    it("includes empty wallet recovery notice when no debit wallets are available", () => {
      const content = fs.readFileSync(payBillPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain("wallets.length === 0");
      expect(content).toContain(
        "Belum ada akun dompet aktif. Tambahkan akun terlebih dahulu atau gunakan opsi pembayaran pihak ketiga.",
      );
      expect(content).toContain(
        "No active accounts found. Please add an account first or settle via third party.",
      );
    });

    it("generates full ISO 8601 timestamps with seconds on settlement confirmation (Rule 8.1)", () => {
      const content = fs.readFileSync(payBillPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain(
        'occurredOn: format(new Date(), "yyyy-MM-dd\'T\'HH:mm:ss")',
      );

      // Verify the generated timestamp string matches ISO 8601 format
      const generatedTimestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
      const fullIsoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
      expect(generatedTimestamp).toMatch(fullIsoRegex);
    });
  });

  describe("3. CalendarDayDetailSheet Inspector Hardening & Invariants", () => {
    it("enforces dynamic iOS home indicator safe-area bottom padding (Rule 5)", () => {
      const content = fs.readFileSync(calendarDayPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain(
        '"max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"',
      );
    });

    it("verifies zero native system colored emojis in CalendarDayDetailSheet (Rule 1)", () => {
      const content = fs.readFileSync(calendarDayPath, "utf-8").replace(/\r\n/g, "\n");
      const systemEmojiRegex =
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(systemEmojiRegex.test(content)).toBe(false);
    });

    it("integrates useCurrency() for resilient multi-currency fallback", () => {
      const content = fs.readFileSync(calendarDayPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain("useCurrency");
      expect(content).toContain(
        "const formatAmount = displayCurrency || displayRupiah || formatWithPreferred;",
      );
    });

    it("provides refined relative date badges for today, tomorrow, and yesterday", () => {
      const content = fs.readFileSync(calendarDayPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain("isToday(selectedDay)");
      expect(content).toContain("isTomorrow(selectedDay)");
      expect(content).toContain("isYesterday(selectedDay)");
      expect(content).toContain("Besok • Proyeksi");
      expect(content).toContain("Kemarin • Transaksi Lampau");
    });

    it("replaces question mark fallback with vector outline 'Tag' icon for categories", () => {
      const content = fs.readFileSync(calendarDayPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).not.toContain('emoji ?? "??"');
      expect(content).toContain('tx.categories?.emoji ||\n                              "Tag"');
    });

    it("applies monochrome vector icon theme variable to Bell containers", () => {
      const content = fs.readFileSync(calendarDayPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain("text-[var(--text-secondary)]");
    });
  });

  describe("4. useMarkBillPaid & Downstream Ingestion Wiring", () => {
    it("accepts occurredOn in useMarkBillPaid and guarantees full ISO 8601 formatting", () => {
      const content = fs.readFileSync(useBillsPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain("occurredOn?: string;");
      expect(content).toContain(
        "occurred_on: occurredOn || format(new Date(), \"yyyy-MM-dd'T'HH:mm:ss\")",
      );
    });

    it("forwards occurredOn from CalendarPage to markBillPaidMutation", () => {
      const content = fs.readFileSync(calendarPagePath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain(
        "onConfirmPaid={({ bill, recordTransaction, walletId, occurredOn }) => {",
      );
      expect(content).toContain(
        "markBillPaidMutation.mutate(\n              { bill, paid: true, recordTransaction, walletId, isIndonesian, occurredOn },",
      );
    });

    it("forwards occurredOn from HomeModalsContainer to markBillPaid", () => {
      const content = fs.readFileSync(homeModalsPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain(
        "onConfirmPaid={({ bill, recordTransaction, walletId, occurredOn }) => {",
      );
      expect(content).toContain(
        "markBillPaid.mutate(\n                { bill, paid: true, recordTransaction, walletId, isIndonesian, occurredOn },",
      );
    });

    it("forwards occurredOn from BillManagementSheets to markBillPaid", () => {
      const content = fs.readFileSync(billSheetsPath, "utf-8").replace(/\r\n/g, "\n");
      expect(content).toContain(
        "onConfirmPaid={({ bill, recordTransaction, walletId, occurredOn }) => {",
      );
      expect(content).toContain(
        "markBillPaid.mutate(\n              { bill, paid: true, recordTransaction, walletId, isIndonesian, occurredOn },",
      );
    });
  });
});
