import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  setSecurityPin,
  verifySecurityPin,
  clearSecurityPin,
  saveSecuritySettings,
  getSecuritySettings,
  recordFailedPinAttempt,
  resetPinLockout,
  getPinLockoutState,
  isLockTimeoutExceeded,
} from "../src/lib/biometricAuth";

// Polyfill localStorage in node test environment
let store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    store = {};
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() {
    return Object.keys(store).length;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe("Security Gate & Biometric Lock Gate Architectural Integrity Suite", () => {
  const biometricAuthPath = path.resolve(__dirname, "../src/lib/biometricAuth.ts");
  const securityContextPath = path.resolve(__dirname, "../src/contexts/SecurityLockContext.tsx");
  const lockOverlayPath = path.resolve(__dirname, "../src/components/security/BiometricLockOverlay.tsx");
  const pinSetupModalPath = path.resolve(__dirname, "../src/components/settings/PinSetupModal.tsx");
  const settingsPagePath = path.resolve(__dirname, "../src/pages/SettingsPage.tsx");

  beforeEach(() => {
    mockLocalStorage.clear();
    resetPinLockout();
    vi.clearAllMocks();
  });

  describe("1. PBKDF2 PIN Engine & Anti-Brute Force Lockout Invariants", () => {
    it("enforces minimum 4-digit PIN requirement", async () => {
      await expect(setSecurityPin("123")).rejects.toThrow("PIN must be at least 4 digits.");
      await expect(setSecurityPin("")).rejects.toThrow("PIN must be at least 4 digits.");
      const success = await setSecurityPin("1234");
      expect(success).toBe(true);
      expect(getSecuritySettings().hasPin).toBe(true);
    });

    it("executes progressive cooldown lockout: 5 attempts = 30s, 7+ attempts = 60s", async () => {
      await setSecurityPin("123456");

      // 4 failed attempts -> not locked yet
      for (let i = 0; i < 4; i++) {
        const state = recordFailedPinAttempt();
        expect(state.isLocked).toBe(false);
      }

      // 5th failed attempt -> 30s lockout
      const fifthState = recordFailedPinAttempt();
      expect(fifthState.isLocked).toBe(true);
      expect(fifthState.remainingSeconds).toBeGreaterThanOrEqual(28);
      expect(fifthState.remainingSeconds).toBeLessThanOrEqual(30);

      // Verify rejected during lockout even with correct PIN
      const verifyDuringLockout = await verifySecurityPin("123456");
      expect(verifyDuringLockout).toBe(false);

      // Advance to 7th attempt -> 60s lockout
      recordFailedPinAttempt(); // 6th
      const seventhState = recordFailedPinAttempt(); // 7th
      expect(seventhState.isLocked).toBe(true);
      expect(seventhState.remainingSeconds).toBeGreaterThanOrEqual(58);
      expect(seventhState.remainingSeconds).toBeLessThanOrEqual(60);

      // Reset
      resetPinLockout();
      expect(getPinLockoutState().isLocked).toBe(false);
      expect(await verifySecurityPin("123456")).toBe(true);
    });

    it("verifies lock timeout calculation with immediate vs delay thresholds", () => {
      // Disabled lock never exceeds
      saveSecuritySettings({ enabled: false, timeoutMinutes: 0 });
      expect(isLockTimeoutExceeded()).toBe(false);

      // 0m immediate lock
      saveSecuritySettings({ enabled: true, timeoutMinutes: 0, lastActiveTimestamp: Date.now() - 100 });
      expect(isLockTimeoutExceeded()).toBe(true);

      // 1m delay lock
      saveSecuritySettings({ enabled: true, timeoutMinutes: 1, lastActiveTimestamp: Date.now() - 30 * 1000 });
      expect(isLockTimeoutExceeded()).toBe(false);

      saveSecuritySettings({ enabled: true, timeoutMinutes: 1, lastActiveTimestamp: Date.now() - 65 * 1000 });
      expect(isLockTimeoutExceeded()).toBe(true);
    });
  });

  describe("2. BiometricLockOverlay Component Integrity & Invariants", () => {
    it("exists and imports vector icons without colored system emojis (Rule 1)", () => {
      const content = fs.readFileSync(lockOverlayPath, "utf-8");
      expect(content).toContain("BiometricLockOverlay");
      expect(content).toContain("ScanFace");
      expect(content).toContain("Fingerprint");
      expect(content).toContain("Lock");
      expect(content).toContain("Delete");

      // Verify NO native system emojis in UI markup (Rule 1)
      const systemEmojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(systemEmojiRegex.test(content)).toBe(false);
    });

    it("implements auto-prompt biometrics and live lockout countdown interval", () => {
      const content = fs.readFileSync(lockOverlayPath, "utf-8");
      expect(content).toContain("triggerBiometricUnlock");
      expect(content).toContain("setInterval(checkLockout, 1000)");
      expect(content).toContain("isPromptingRef");
      expect(content).toContain("unlockWithBiometric");
    });

    it("provides fallback biometric button in keypad grid", () => {
      const content = fs.readFileSync(lockOverlayPath, "utf-8");
      expect(content).toContain("pinInput.length > 0");
      expect(content).toContain("securitySettings.hasBiometric && isBiometricSupported");
      expect(content).toContain("aria-label=");
      expect(content).toContain("Buka dengan Face ID");
      expect(content).toContain("Unlock with Face ID");
    });

    it("enforces strict non-mixed localization without English/Indonesian mixing (Rule 6)", () => {
      const content = fs.readFileSync(lockOverlayPath, "utf-8");
      expect(content).toContain('isIndonesian ? "Accrual Terkunci" : "Accrual Locked"');
      expect(content).toContain('isIndonesian ? "Hapus" : "Clear"');
      expect(content).toContain('"Keluar dari Perangkat Ini"');
      expect(content).toContain('"Sign Out from this Device"');
      expect(content).not.toContain("Ganti Nama (Rename)");
      expect(content).not.toContain("Nominal (Amount)");
    });

    it("enforces safe area insets for mobile display notch and home indicator (Rule 3 & 5)", () => {
      const content = fs.readFileSync(lockOverlayPath, "utf-8");
      expect(content).toContain("env(safe-area-inset-top, 0px)");
      expect(content).toContain("env(safe-area-inset-bottom, 0px)");
    });
  });

  describe("3. PinSetupModal Strict Monochrome Luxury Styling (Rule 7)", () => {
    it("uses strict monochrome button styling and avoids colored accent variables", () => {
      const content = fs.readFileSync(pinSetupModalPath, "utf-8");
      expect(content).toContain("PinSetupModal");
      expect(content).toContain('background: "var(--text-primary)"');
      expect(content).toContain('color: "var(--bg-canvas)"');

      // Rule 7 invariant: var(--accent) must NEVER be used on buttons in setting sheets
      expect(content).not.toContain('background: "var(--accent)"');
    });

    it("respects safe area bottom inset for iOS home indicator (Rule 5)", () => {
      const content = fs.readFileSync(pinSetupModalPath, "utf-8");
      expect(content).toContain("env(safe-area-inset-bottom,0px)");
      expect(content).toContain("BottomSheet");
    });
  });

  describe("4. SettingsPage Biometric Enrollment & Prerequisite Enforcement", () => {
    it("exposes Biometric Unlock toggle when supported with Face ID / Fingerprint detection", () => {
      const content = fs.readFileSync(settingsPagePath, "utf-8");
      expect(content).toContain("isBiometricSupported && showBiometric");
      expect(content).toContain("biometryKind === \"face\"");
      expect(content).toContain("Buka Kunci Face ID");
      expect(content).toContain("Face ID Unlock");
      expect(content).toContain("Buka Kunci Biometrik");
      expect(content).toContain("Biometric Unlock");
    });

    it("strictly checks PIN prerequisite before allowing biometric toggle", () => {
      const content = fs.readFileSync(settingsPagePath, "utf-8");
      expect(content).toContain("!securitySettings.hasPin");
      expect(content).toContain("Atur PIN Keamanan terlebih dahulu sebelum mengaktifkan biometrik");
      expect(content).toContain("Set up a Security PIN first before enabling biometrics");
    });

    it("cleans up biometric credentials and disables lock when PIN is removed", () => {
      const content = fs.readFileSync(securityContextPath, "utf-8");
      expect(content).toContain("clearSecurityPin()");
      expect(content).toContain("clearBiometricCredential()");
      expect(content).toContain("hasPin: false, hasBiometric: false, enabled: false");
    });
  });
});
