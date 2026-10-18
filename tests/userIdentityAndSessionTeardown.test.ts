import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  clearAllLocalUserSessionData,
  USER_SESSION_STORAGE_KEYS,
} from "../src/lib/sessionCleanup";

// Mock localStorage for tenant isolation tests
let store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => {
    store[k] = String(v);
  }),
  removeItem: vi.fn((k: string) => {
    delete store[k];
  }),
  clear: vi.fn(() => {
    store = {};
  }),
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  get length() {
    return Object.keys(store).length;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

const mockDispatchEvent = vi.fn();
if (typeof (globalThis as any).CustomEvent === "undefined") {
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, options?: any) {
      this.type = type;
      this.detail = options?.detail;
    }
  };
}
Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: mockLocalStorage,
    dispatchEvent: mockDispatchEvent,
  },
  writable: true,
  configurable: true,
});

// Mock dependencies of sessionCleanup
vi.mock("../src/hooks/useTransactions", () => ({
  clearLocalTransactionsCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/indexedDbStorage", () => ({
  clearAllVaultItems: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/biometricAuth", () => ({
  clearPersistentSession: vi.fn(),
  clearBiometricLoginCredentials: vi.fn(),
}));

vi.mock("../src/lib/merchantCategoryMemory", () => ({
  clearMerchantMemory: vi.fn(),
}));

describe("Audit #36: User Identity, Profile Capsule, Password Recovery & Multi-Tenant Teardown Workstation Suite", () => {
  const topIdentityCapsulePath = path.resolve(
    __dirname,
    "../src/components/home/TopIdentityCapsule.tsx"
  );
  const profileMenuModalPath = path.resolve(
    __dirname,
    "../src/components/home/ProfileMenuModal.tsx"
  );
  const profileSheetPath = path.resolve(
    __dirname,
    "../src/components/settings/ProfileSheet.tsx"
  );
  const deleteAccountModalPath = path.resolve(
    __dirname,
    "../src/components/settings/DeleteAccountModal.tsx"
  );
  const resetPasswordModalPath = path.resolve(
    __dirname,
    "../src/components/auth/ResetPasswordModal.tsx"
  );
  const sessionCleanupPath = path.resolve(
    __dirname,
    "../src/lib/sessionCleanup.ts"
  );

  const topIdentityContent = fs.readFileSync(topIdentityCapsulePath, "utf-8");
  const profileMenuContent = fs.readFileSync(profileMenuModalPath, "utf-8");
  const profileSheetContent = fs.readFileSync(profileSheetPath, "utf-8");
  const deleteAccountContent = fs.readFileSync(deleteAccountModalPath, "utf-8");
  const resetPasswordContent = fs.readFileSync(resetPasswordModalPath, "utf-8");
  const sessionCleanupContent = fs.readFileSync(sessionCleanupPath, "utf-8");

  beforeEach(() => {
    store = {};
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Dynamic Notch / Island & Safe-Area Inset Architecture (Rules 3 & 5)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("1. Dynamic Notch / Dynamic Island & Safe-Area Inset Architecture Compliance", () => {
    it("enforces dynamic top clearance and centered max-w-md in ProfileMenuModal", () => {
      expect(profileMenuContent).toContain(
        'top: "max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)"'
      );
      expect(profileMenuContent).toContain("max-w-md");
      expect(profileMenuContent).toContain("mx-auto");
      expect(profileMenuContent).not.toContain("max-w-none");
    });

    it("enforces dynamic safe-area-inset-bottom in DeleteAccountModal", () => {
      expect(deleteAccountContent).toContain(
        'paddingBottom:\n            "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("enforces dynamic safe-area-inset-bottom in ResetPasswordModal", () => {
      expect(resetPasswordContent).toContain(
        'paddingBottom:\n            "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("enforces dynamic safe-area-inset-bottom in ProfileSheet", () => {
      expect(profileSheetContent).toContain(
        'paddingBottom:\n            "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Strict Vector Outline Iconography & Zero Emojis (Rule 1)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("2. Strict Vector Outline Iconography & Zero System Emojis", () => {
    const coloredEmojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    it("verifies zero native system colored emojis in TopIdentityCapsule", () => {
      expect(coloredEmojiRegex.test(topIdentityContent)).toBe(false);
    });

    it("verifies zero native system colored emojis in ProfileMenuModal", () => {
      expect(coloredEmojiRegex.test(profileMenuContent)).toBe(false);
    });

    it("verifies zero native system colored emojis in ProfileSheet", () => {
      expect(coloredEmojiRegex.test(profileSheetContent)).toBe(false);
    });

    it("verifies zero native system colored emojis in DeleteAccountModal", () => {
      expect(coloredEmojiRegex.test(deleteAccountContent)).toBe(false);
    });

    it("verifies zero native system colored emojis in ResetPasswordModal", () => {
      expect(coloredEmojiRegex.test(resetPasswordContent)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Strict Non-Mixed Localization & Brand Consistency (Rules 6 & Branding)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("3. Strict Non-Mixed Localization & Brand Consistency", () => {
    it("does not mix English parenthetical in ProfileSheet offline tags", () => {
      expect(profileSheetContent).not.toContain("Local Vault (Offline)");
      expect(profileSheetContent).not.toContain("Guest User (Offline)");
      expect(profileSheetContent).toContain('"Local Vault"');
      expect(profileSheetContent).toContain('"Guest User"');
    });

    it("ensures ResetPasswordModal uses Accrual branding without legacy Trouvaille naming", () => {
      expect(resetPasswordContent).toContain("akun Accrual Anda");
      expect(resetPasswordContent).toContain("your Accrual account");
      expect(resetPasswordContent).not.toContain("akun Trouvaille Anda");
      expect(resetPasswordContent).not.toContain("your Trouvaille account");
    });

    it("provides pure Indonesian & English labels for action buttons in TopIdentityCapsule", () => {
      expect(topIdentityContent).toContain('"Ringkasan Finansial"');
      expect(topIdentityContent).toContain('"Financial Overview"');
      expect(topIdentityContent).toContain('"Beralih ke Mode Gelap"');
      expect(topIdentityContent).toContain('"Switch to Dark Mode"');
      expect(topIdentityContent).toContain('"Kustomisasi Widget Dashboard"');
      expect(topIdentityContent).toContain('"Customize Dashboard Widgets"');
    });

    it("provides pure Indonesian & English labels for action buttons in ProfileMenuModal", () => {
      expect(profileMenuContent).toContain('"Pemberitahuan"');
      expect(profileMenuContent).toContain('"Notifications"');
      expect(profileMenuContent).toContain('"Dasbor Web"');
      expect(profileMenuContent).toContain('"Web Dashboard"');
      expect(profileMenuContent).toContain('"Tutup"');
      expect(profileMenuContent).toContain('"Close"');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Monochrome Luxury Styling & Design Tokens (Rules 2 & 7)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("4. Monochrome Luxury Styling & Design Tokens Compliance", () => {
    it("uses standardized theme variables in DeleteAccountModal action button", () => {
      expect(deleteAccountContent).toContain('color:\n                isConfirmed && !isDeleting\n                  ? "var(--bg-base)"');
      expect(deleteAccountContent).not.toContain('"var(--bg-primary)"');
    });

    it("uses standardized theme variables in ResetPasswordModal submit button", () => {
      expect(resetPasswordContent).toContain('color: "var(--bg-base)"');
      expect(resetPasswordContent).not.toContain('"var(--bg-primary)"');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Multi-Tenant Session Teardown & Storage Purge (Rule 8.2)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("5. Multi-Tenant Session Teardown & Storage Purge (Rule 8.2)", () => {
    it("includes trouvaille_avatar and critical financial keys in USER_SESSION_STORAGE_KEYS", () => {
      expect(USER_SESSION_STORAGE_KEYS).toContain("trouvaille_avatar");
      expect(USER_SESSION_STORAGE_KEYS).toContain("trouvaille_budget_target");
      expect(USER_SESSION_STORAGE_KEYS).toContain("trouvaille_shortcuts");
      expect(USER_SESSION_STORAGE_KEYS).toContain("trouvaille_financial_goals_v2");
      expect(USER_SESSION_STORAGE_KEYS).toContain("trouvaille_usdt_valuation_v2");
    });

    it("purges all user tenant keys while strictly preserving app settings during teardown", async () => {
      // Seed storage with user tenant keys and settings
      store["trouvaille_avatar"] = "https://example.com/avatar.jpg";
      store["trouvaille_budget_target"] = "5000000";
      store["trouvaille_shortcuts"] = JSON.stringify([{ id: "s1" }]);
      store["trouvaille_holdings_v1"] = JSON.stringify([{ id: "h1" }]);
      store["trouvaille:usr_123_custom"] = "data";
      store["trouvaille_migrated_guest_456"] = "true";
      store["accrual_subscription_state_v1"] = "pro";

      // Seed settings to be preserved
      store["trouvaille_theme"] = "dark";
      store["trouvaille_language"] = "id";
      store["trouvaille_currency"] = "IDR";
      store["trouvaille_privacy_stealth"] = "true";

      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      // Execute session teardown
      await clearAllLocalUserSessionData(null, { preserveGuestFlag: false });

      // Verify user tenant keys were wiped
      expect(store["trouvaille_avatar"]).toBeUndefined();
      expect(store["trouvaille_budget_target"]).toBeUndefined();
      expect(store["trouvaille_shortcuts"]).toBeUndefined();
      expect(store["trouvaille_holdings_v1"]).toBeUndefined();
      expect(store["trouvaille:usr_123_custom"]).toBeUndefined();
      expect(store["trouvaille_migrated_guest_456"]).toBeUndefined();
      expect(store["accrual_subscription_state_v1"]).toBeUndefined();

      // Verify preserved settings remain intact
      expect(store["trouvaille_theme"]).toBe("dark");
      expect(store["trouvaille_language"]).toBe("id");
      expect(store["trouvaille_currency"]).toBe("IDR");
      expect(store["trouvaille_privacy_stealth"]).toBe("true");

      // Verify session teardown event dispatched
      expect(dispatchSpy).toHaveBeenCalled();
      const event = dispatchSpy.mock.calls.find(
        ([e]) => (e as CustomEvent).type === "trouvaille_session_teardown"
      );
      expect(event).toBeDefined();
    });

    it("respects preserveGuestFlag when clearing session", async () => {
      store["trouvaille_guest_mode"] = "true";
      store["trouvaille_avatar"] = "guest_avatar";

      await clearAllLocalUserSessionData(null, { preserveGuestFlag: true });

      expect(store["trouvaille_guest_mode"]).toBe("true");
      expect(store["trouvaille_avatar"]).toBeUndefined();
    });

    it("purges query client caches when queryClient instance is provided", async () => {
      const mockQueryClient = {
        cancelQueries: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn(),
      };

      await clearAllLocalUserSessionData(mockQueryClient as any);

      expect(mockQueryClient.cancelQueries).toHaveBeenCalled();
      expect(mockQueryClient.clear).toHaveBeenCalled();
    });
  });
});
