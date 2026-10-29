import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearAllLocalUserSessionData,
  USER_SESSION_STORAGE_KEYS,
} from "../src/lib/sessionCleanup";
import {
  DEFAULT_CATEGORIES_ID,
  DEFAULT_CATEGORIES_EN,
  getDefaultCategories,
  getCategoryParent,
  getParentDisplayName,
  getParentIcon,
} from "../src/hooks/useCategories";

describe("Session Cleanup & Global vs Indonesian Category Taxonomy Suite", () => {
  beforeEach(() => {
    let store: Record<string, string> = {};
    const mockStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
      key: (i: number) => Object.keys(store)[i] || null,
      get length() {
        return Object.keys(store).length;
      },
    };

    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).window = globalThis;
    mockStorage.clear();
  });

  describe("1. Total Session Teardown & Data Isolation (clearAllLocalUserSessionData)", () => {
    it("wipes all sensitive financial keys, backups, and dynamic user caches", async () => {
      // Seed dummy user data
      USER_SESSION_STORAGE_KEYS.forEach((k) => {
        localStorage.setItem(k, k === "trouvaille_draft_transactions" ? JSON.stringify([{items:[{id:"legacy"}]}]) : k === "TROUVAILLE_PENDING_MUTATIONS_V2" ? JSON.stringify([{payload:{id:"ordinary"}}]) : "some_secret_user_data");
      });
      localStorage.setItem("trouvaille_guest_mode", "true");
      localStorage.setItem("trouvaille_migrated_guest_user123", "true");
      localStorage.setItem("trouvaille:usr_user123:pref", "active");
      localStorage.setItem("trouvaille_holdings_user123", JSON.stringify([{ id: "btc" }]));
      localStorage.setItem("trouvaille_custom_category_user123", "Personal Custom Category");

      const mockQueryClient = {
        cancelQueries: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn(),
      } as any;

      await clearAllLocalUserSessionData(mockQueryClient, { preserveGuestFlag: false });

      // Verify all static keys removed
      for (const k of USER_SESSION_STORAGE_KEYS) {
        expect(localStorage.getItem(k)).toBeNull();
      }
      expect(localStorage.getItem("trouvaille_guest_mode")).toBeNull();
      expect(localStorage.getItem("trouvaille_migrated_guest_user123")).toBeNull();
      expect(localStorage.getItem("trouvaille:usr_user123:pref")).toBeNull();
      expect(localStorage.getItem("trouvaille_holdings_user123")).toBeNull();
      expect(localStorage.getItem("trouvaille_custom_category_user123")).toBeNull();

      // Verify queryClient was cancelled and cleared
      expect(mockQueryClient.cancelQueries).toHaveBeenCalledTimes(1);
      expect(mockQueryClient.clear).toHaveBeenCalledTimes(1);
    });

    it("preserves guest flag when preserveGuestFlag option is true", async () => {
      localStorage.setItem("trouvaille_guest_mode", "true");
      localStorage.setItem("TROUVAILLE_CATEGORIES_BACKUP_V1", "old_categories");

      await clearAllLocalUserSessionData(null, { preserveGuestFlag: true });

      expect(localStorage.getItem("trouvaille_guest_mode")).toBe("true");
      expect(localStorage.getItem("TROUVAILLE_CATEGORIES_BACKUP_V1")).toBeNull();
    });
  });

  describe("2. Adaptive Standard Category Taxonomy Presets (Indo vs. Global)", () => {
    it("defines 8 Income and 14 Expense categories in Indonesian preset with vector icons only", () => {
      const income = DEFAULT_CATEGORIES_ID.filter((c) => c.type === "income");
      const expense = DEFAULT_CATEGORIES_ID.filter((c) => c.type === "expense");

      expect(income.length).toBe(8);
      expect(expense.length).toBe(14);

      // Verify names in Indonesian
      expect(income.map((c) => c.name)).toContain("Gaji & Upah");
      expect(income.map((c) => c.name)).toContain("Bisnis & Freelance");
      expect(expense.map((c) => c.name)).toContain("Makanan & Minuman");
      expect(expense.map((c) => c.name)).toContain("Groceries & Supermarket");
      expect(expense.map((c) => c.name)).toContain("Hunian & Utilitas");

      // Verify no colored system emojis in icons
      for (const cat of DEFAULT_CATEGORIES_ID) {
        expect(cat.emoji).toMatch(/^[A-Za-z0-9]+$/); // Vector Lucide icon names like Briefcase, Utensils
        expect(cat.is_default).toBe(true);
      }
    });

    it("defines 8 Income and 14 Expense categories in Global/English preset with vector icons only", () => {
      const income = DEFAULT_CATEGORIES_EN.filter((c) => c.type === "income");
      const expense = DEFAULT_CATEGORIES_EN.filter((c) => c.type === "expense");

      expect(income.length).toBe(8);
      expect(expense.length).toBe(14);

      // Verify names in English
      expect(income.map((c) => c.name)).toContain("Salary & Wages");
      expect(income.map((c) => c.name)).toContain("Business & Freelance");
      expect(expense.map((c) => c.name)).toContain("Food & Dining");
      expect(expense.map((c) => c.name)).toContain("Groceries & Supermarket");
      expect(expense.map((c) => c.name)).toContain("Housing & Utilities");
      expect(expense.map((c) => c.name)).toContain("Bills & Subscriptions");

      // Verify vector Lucide icons
      for (const cat of DEFAULT_CATEGORIES_EN) {
        expect(cat.emoji).toMatch(/^[A-Za-z0-9]+$/);
        expect(cat.is_default).toBe(true);
      }
    });

    it("resolves English preset when currency is USD, EUR, SGD or language is English", () => {
      expect(getDefaultCategories({ currency: "USD", isIndo: false })).toBe(DEFAULT_CATEGORIES_EN);
      expect(getDefaultCategories({ currency: "EUR", isIndo: true })).toBe(DEFAULT_CATEGORIES_EN);
      expect(getDefaultCategories({ currency: "SGD", isIndo: false })).toBe(DEFAULT_CATEGORIES_EN);
    });

    it("resolves Indonesian preset when currency is IDR and language is Indonesian", () => {
      expect(getDefaultCategories({ currency: "IDR", isIndo: true })).toBe(DEFAULT_CATEGORIES_ID);
    });
  });

  describe("3. Parent Grouping & Non-Mixed Localization (Strict Rule)", () => {
    it("maps both Indonesian and English categories accurately to standard macro parents", () => {
      // Indonesian mappings
      expect(getCategoryParent("Makanan & Minuman")).toBe("Pangan");
      expect(getCategoryParent("Gaji & Upah")).toBe("Pendapatan");
      expect(getCategoryParent("Hunian & Utilitas")).toBe("Papan");
      expect(getCategoryParent("Transportasi & Kendaraan")).toBe("Transportasi");

      // English mappings
      expect(getCategoryParent("Food & Dining")).toBe("Pangan");
      expect(getCategoryParent("Salary & Wages")).toBe("Pendapatan");
      expect(getCategoryParent("Housing & Utilities")).toBe("Papan");
      expect(getCategoryParent("Transportation & Travel")).toBe("Transportasi");
      expect(getCategoryParent("Bills & Subscriptions")).toBe("Biaya");
    });

    it("localizes parent display names purely in Indonesian or pure English without bilingual mixing", () => {
      // Indonesian mode
      expect(getParentDisplayName("Pangan", true)).toBe("Pangan");
      expect(getParentDisplayName("Pendapatan", true)).toBe("Pendapatan");
      expect(getParentDisplayName("Papan", true)).toBe("Papan");
      expect(getParentDisplayName("Transportasi", true)).toBe("Transportasi");

      // English mode
      expect(getParentDisplayName("Pangan", false)).toBe("Food & Sustenance");
      expect(getParentDisplayName("Pendapatan", false)).toBe("Income");
      expect(getParentDisplayName("Papan", false)).toBe("Housing & Groceries");
      expect(getParentDisplayName("Transportasi", false)).toBe("Transportation");
      expect(getParentDisplayName("Biaya", false)).toBe("Bills & Fees");
    });

    it("returns correct vector icons for macro parents", () => {
      expect(getParentIcon("Pangan")).toBe("Utensils");
      expect(getParentIcon("Pendapatan")).toBe("Briefcase");
      expect(getParentIcon("Transportasi")).toBe("Car");
      expect(getParentIcon("Papan")).toBe("Home");
    });
  });
});
