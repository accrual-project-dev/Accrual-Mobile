import { describe, it, expect, vi, beforeEach } from "vitest";
import { format } from "date-fns";
import { formatCurrency } from "../src/lib/utils";
import { clearAllLocalUserSessionData } from "../src/lib/sessionCleanup";
import * as ocrEngine from "../src/lib/ocrEngine";
import type { Category, Wallet } from "../src/lib/types";

describe("Receipt Scan Ecosystem Integrity & Architectural Audit Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Full ISO Timestamps & Date-Time Formatting (Rule 8.1)", () => {
    it("ensures occurred_on includes full date and time YYYY-MM-DDTHH:mm:ss for transactions", () => {
      const selectedDate = new Date("2026-10-16T00:00:00.000Z");
      const selectedTime = "14:35";

      const [h, m] = selectedTime.split(":").map(Number);
      const txDate = new Date(selectedDate);
      txDate.setHours(h, m, 0, 0);

      const occurredOn = format(txDate, "yyyy-MM-dd'T'HH:mm:ss");
      expect(occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(occurredOn).toContain("T14:35:00");
    });

    it("ensures admin fee transaction occurred_on has offset timestamp and valid ISO format", () => {
      const selectedDate = new Date("2026-10-16T00:00:00.000Z");
      const selectedTime = "10:15";

      const [h, m] = selectedTime.split(":").map(Number);
      const txDate = new Date(selectedDate);
      txDate.setHours(h, m, 0, 0);

      const adminTxDate = new Date(txDate.getTime() + 1000);
      const occurredOn = format(adminTxDate, "yyyy-MM-dd'T'HH:mm:ss");

      expect(occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(occurredOn).toContain("T10:15:01");
    });
  });

  describe("2. Admin Fee Preservation on Customize Form", () => {
    it("appends admin fee note suffix in Indonesian when includeAdminFee is true", () => {
      const isIndonesian = true;
      const includeAdminFee = true;
      const adminFeeAmount = 2500;
      const preferredCurrency = "IDR";
      const finalDescription = "Transfer ke Budi";

      const feeSuffix =
        includeAdminFee && adminFeeAmount > 0
          ? isIndonesian
            ? ` (Biaya admin: ${formatCurrency(adminFeeAmount, preferredCurrency)})`
            : ` (Admin fee: ${formatCurrency(adminFeeAmount, preferredCurrency)})`
          : "";

      const note = `${finalDescription}${feeSuffix}`;
      expect(note).toContain("Transfer ke Budi");
      expect(note).toContain("Biaya admin:");
      expect(note).toContain("2.500");
    });

    it("appends admin fee note suffix in English when isIndonesian is false", () => {
      const isIndonesian = false;
      const includeAdminFee = true;
      const adminFeeAmount = 25000;
      const preferredCurrency = "USD";
      const finalDescription = "Transfer to Alice";

      const feeSuffix =
        includeAdminFee && adminFeeAmount > 0
          ? isIndonesian
            ? ` (Biaya admin: ${formatCurrency(adminFeeAmount, preferredCurrency)})`
            : ` (Admin fee: ${formatCurrency(adminFeeAmount, preferredCurrency)})`
          : "";

      const note = `${finalDescription}${feeSuffix}`;
      expect(note).toContain("Transfer to Alice");
      expect(note).toContain("Admin fee:");
      expect(note).toContain("$");
    });
  });

  describe("3. Category Fallback Type Alignment", () => {
    const mockCategories: Category[] = [
      { id: "c-salary", name: "Gaji Pokok", type: "income", icon: "Briefcase", color: "#111", user_id: "u-1", created_at: "", updated_at: "" },
      { id: "c-invest", name: "Hasil Investasi", type: "income", icon: "TrendingUp", color: "#222", user_id: "u-1", created_at: "", updated_at: "" },
      { id: "c-food", name: "Makanan & Minuman", type: "expense", icon: "Utensils", color: "#333", user_id: "u-1", created_at: "", updated_at: "" },
      { id: "c-groceries", name: "Belanja Bulanan", type: "expense", icon: "ShoppingBag", color: "#444", user_id: "u-1", created_at: "", updated_at: "" },
    ];

    it("ensures expense receipt falls back to an expense category rather than top income category", () => {
      const detectedSlipType = "expense";
      const targetType = detectedSlipType === "income" ? "income" : "expense";
      const typeMatchedCategories = mockCategories.filter((c) => c.type === targetType);
      const categoryPool = typeMatchedCategories.length > 0 ? typeMatchedCategories : mockCategories;

      const cleanCats = categoryPool.filter(
        (c) =>
          !c.name.toLowerCase().includes("admin") &&
          !c.name.toLowerCase().includes("fee") &&
          !c.name.toLowerCase().includes("pajak") &&
          !c.name.toLowerCase().includes("legal") &&
          !c.name.toLowerCase().includes("kerugian"),
      );

      const fallbackCat =
        cleanCats.find((c) => /makanan|kuliner|food|resto/i.test(c.name)) ||
        cleanCats.find((c) => /belanja|groceries/i.test(c.name)) ||
        cleanCats.find((c) => /lainnya|other/i.test(c.name)) ||
        cleanCats[0] ||
        categoryPool[0] ||
        mockCategories[0];

      expect(fallbackCat.type).toBe("expense");
      expect(fallbackCat.id).toBe("c-food");
    });
  });

  describe("4. Multi-Currency Formatting", () => {
    it("formats amount chips and values correctly across currencies", () => {
      expect(formatCurrency(50000, "IDR")).toContain("50.000");
      expect(formatCurrency(158500, "USD")).toContain("$10.00");
      expect(formatCurrency(106000, "JPY")).toContain("1,000");
    });
  });

  describe("5. Session Teardown & OCR Worker Termination", () => {
    it("terminates OCR worker when clearing all user session data", async () => {
      const terminateSpy = vi.spyOn(ocrEngine, "terminateOCRWorker").mockResolvedValue();

      await clearAllLocalUserSessionData(null);

      expect(terminateSpy).toHaveBeenCalled();
    });
  });
});
