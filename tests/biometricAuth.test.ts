import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSecuritySettings,
  saveSecuritySettings,
  isLockTimeoutExceeded,
  hashSecurityPin,
  setSecurityPin,
  verifySecurityPin,
  clearSecurityPin,
  saveBiometricLoginCredentials,
  getBiometricLoginCredentials,
  clearBiometricLoginCredentials,
  savePersistentSession,
  getPersistentSession,
  clearPersistentSession,
  authenticateWithPin,
  authenticateWithBiometrics,
  isBiometricAvailable,
  getBiometryKind,
  verifyBiometricPasskey,
  registerBiometricPasskey,
  clearBiometricCredential,
} from "../src/lib/biometricAuth";
import { supabase } from "../src/lib/supabase";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { Capacitor } from "@capacitor/core";

vi.mock("@capgo/capacitor-native-biometric", () => ({
  NativeBiometric: {
    isAvailable: vi.fn().mockResolvedValue({ isAvailable: false, biometryType: 0 }),
    verifyIdentity: vi.fn().mockResolvedValue(undefined),
    getCredentials: vi.fn().mockResolvedValue({ username: "", password: "" }),
    setCredentials: vi.fn().mockResolvedValue(undefined),
    deleteCredentials: vi.fn().mockResolvedValue(undefined),
    setData: vi.fn().mockResolvedValue(undefined),
    getData: vi.fn().mockResolvedValue({ value: "" }),
    deleteData: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

// Polyfill localStorage in node test environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k in store) {
      delete store[k];
    }
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

describe("Biometric & Security Engine Test Suite", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns default security settings on cold start", () => {
    const settings = getSecuritySettings();
    expect(settings.enabled).toBe(false);
    expect(settings.timeoutMinutes).toBe(0);
    expect(settings.hasBiometric).toBe(false);
    expect(settings.hasPin).toBe(false);
  });

  it("persists updated security settings in localStorage", () => {
    saveSecuritySettings({ enabled: true, timeoutMinutes: 5 });
    const settings = getSecuritySettings();
    expect(settings.enabled).toBe(true);
    expect(settings.timeoutMinutes).toBe(5);
  });

  it("calculates lock timeout accurately", () => {
    // Disabled lock: never exceeds timeout
    saveSecuritySettings({ enabled: false, timeoutMinutes: 1, lastActiveTimestamp: Date.now() - 120000 });
    expect(isLockTimeoutExceeded()).toBe(false);

    // Enabled lock: immediate (timeout = 0)
    saveSecuritySettings({ enabled: true, timeoutMinutes: 0, lastActiveTimestamp: Date.now() - 500 });
    expect(isLockTimeoutExceeded()).toBe(true);

    // Enabled lock with 5 min timeout: active 2 min ago -> not exceeded
    saveSecuritySettings({ enabled: true, timeoutMinutes: 5, lastActiveTimestamp: Date.now() - 2 * 60 * 1000 });
    expect(isLockTimeoutExceeded()).toBe(false);

    // Enabled lock with 5 min timeout: active 6 min ago -> exceeded
    saveSecuritySettings({ enabled: true, timeoutMinutes: 5, lastActiveTimestamp: Date.now() - 6 * 60 * 1000 });
    expect(isLockTimeoutExceeded()).toBe(true);
  });

  it("hashes and validates security PIN accurately", async () => {
    const pin = "123456";
    const hash1 = await hashSecurityPin(pin);
    const hash2 = await hashSecurityPin(pin);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBeGreaterThan(10);

    // Enroll PIN
    await setSecurityPin("889900");
    const settings = getSecuritySettings();
    expect(settings.hasPin).toBe(true);

    // Verify correct PIN
    const isValid = await verifySecurityPin("889900");
    expect(isValid).toBe(true);

    // Verify wrong PIN
    const isInvalid = await verifySecurityPin("000000");
    expect(isInvalid).toBe(false);

    // Clear PIN
    clearSecurityPin();
    expect(getSecuritySettings().hasPin).toBe(false);
  });

  it("locks out verification after repeated failed attempts", async () => {
    await setSecurityPin("123456");

    // 4 failed attempts: not locked out yet
    for (let i = 0; i < 4; i++) {
      const res = await verifySecurityPin("000000");
      expect(res).toBe(false);
    }

    // 5th failed attempt: triggers lockout
    const fifthAttempt = await verifySecurityPin("000000");
    expect(fifthAttempt).toBe(false);

    // Even with correct PIN, verification is rejected during lockout
    const lockedAttempt = await verifySecurityPin("123456");
    expect(lockedAttempt).toBe(false);

    // Clean up
    clearSecurityPin();
  });

  it("auto-migrates legacy SHA-256 PIN to hardened PBKDF2 on successful verification", async () => {
    const legacyPin = "778899";
    const legacyHash = await hashSecurityPin(legacyPin);
    mockLocalStorage.setItem("trouvaille_security_pin_hash_v1", legacyHash);

    expect(getSecuritySettings().hasPin).toBe(true);
    expect(mockLocalStorage.getItem("trouvaille_security_pin_pbkdf2_v2")).toBeNull();

    // Verify correct PIN
    const isValid = await verifySecurityPin(legacyPin);
    expect(isValid).toBe(true);

    // Should now be upgraded to PBKDF2 and legacy key removed
    expect(mockLocalStorage.getItem("trouvaille_security_pin_pbkdf2_v2")).not.toBeNull();
    expect(mockLocalStorage.getItem("trouvaille_security_pin_hash_v1")).toBeNull();

    clearSecurityPin();
  });

  it("stores and retrieves biometric login hint", () => {
    saveBiometricLoginCredentials("owner@trouvaille.app");
    const hint = getBiometricLoginCredentials();
    expect(hint?.email).toBe("owner@trouvaille.app");
  });

  it("stores, retrieves, and clears persistent session vault", () => {
    const mockSession = {
      access_token: "mock-access-token-123",
      refresh_token: "mock-refresh-token-456",
      user: { id: "user-abc-123", email: "user@trouvaille.app" },
    };

    savePersistentSession(mockSession);
    const retrieved = getPersistentSession();
    expect(retrieved).toEqual(mockSession);
    expect(retrieved?.refresh_token).toBe("mock-refresh-token-456");

    clearPersistentSession();
    expect(getPersistentSession()).toBeNull();
  });

  it("stores biometric credentials along with persistent session and clears them", () => {
    const mockSession = {
      access_token: "mock-jwt-token",
      refresh_token: "mock-refresh-token",
      user: { id: "u-456", email: "biometric@trouvaille.app" },
    };

    saveBiometricLoginCredentials("biometric@trouvaille.app", mockSession);

    const hint = getBiometricLoginCredentials();
    expect(hint?.email).toBe("biometric@trouvaille.app");
    expect(hint?.session?.refresh_token).toBe("mock-refresh-token");

    const vault = getPersistentSession();
    expect(vault?.refresh_token).toBe("mock-refresh-token");

    clearBiometricLoginCredentials();
    expect(getBiometricLoginCredentials()).toBeNull();
    expect(getPersistentSession()).toBeNull();
  });

  it("authenticates with PIN and restores session via setSession", async () => {
    await setSecurityPin("123456");

    const mockSession = {
      access_token: "fresh-access-token",
      refresh_token: "fresh-refresh-token",
      user: { id: "user-123", email: "user@trouvaille.app" },
    };

    saveBiometricLoginCredentials("user@trouvaille.app", {
      refresh_token: "stored-refresh-token",
    });

    // Mock supabase.auth.setSession
    const setSessionSpy = vi.spyOn(supabase.auth, "setSession").mockResolvedValue({
      data: { session: mockSession as any, user: mockSession.user as any },
      error: null,
    });

    const result = await authenticateWithPin("123456");
    expect(result.success).toBe(true);
    expect(result.session).toEqual(mockSession);
    expect(setSessionSpy).toHaveBeenCalledWith({
      access_token: "",
      refresh_token: "stored-refresh-token",
    });

    // Restore
    setSessionSpy.mockRestore();
    clearSecurityPin();
  });

  it("authenticates with PIN and returns offline session fallback when offline", async () => {
    await setSecurityPin("123456");

    const offlineSession = {
      access_token: "offline-token",
      refresh_token: "offline-refresh-token",
      user: { id: "offline-user", email: "offline@trouvaille.app" },
    };

    saveBiometricLoginCredentials("offline@trouvaille.app", offlineSession);

    // Mock supabase.auth.setSession throwing network error
    const setSessionSpy = vi.spyOn(supabase.auth, "setSession").mockRejectedValue(
      new Error("Failed to fetch")
    );

    // Set offline
    const origOnLine = globalThis.navigator.onLine;
    Object.defineProperty(globalThis.navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });

    const result = await authenticateWithPin("123456");
    expect(result.success).toBe(true);
    expect(result.session).toEqual(offlineSession);

    // Restore
    setSessionSpy.mockRestore();
    Object.defineProperty(globalThis.navigator, "onLine", {
      value: origOnLine,
      configurable: true,
      writable: true,
    });
    clearSecurityPin();
  });

  it("checks native biometric availability and kind accurately", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    // Mock Face ID (biometryType: 2)
    vi.mocked(NativeBiometric.isAvailable).mockResolvedValue({
      isAvailable: true,
      biometryType: 2,
      authenticationStrength: 1,
      deviceIsSecure: true,
      strongBiometryIsAvailable: true,
    });

    expect(await isBiometricAvailable()).toBe(true);
    expect(await getBiometryKind()).toBe("face");

    // Mock Fingerprint / Touch ID (biometryType: 1)
    vi.mocked(NativeBiometric.isAvailable).mockResolvedValueOnce({
      isAvailable: true,
      biometryType: 1,
      authenticationStrength: 1,
      deviceIsSecure: true,
      strongBiometryIsAvailable: true,
    });
    expect(await getBiometryKind()).toBe("fingerprint");

    // Mock unavailable
    vi.mocked(NativeBiometric.isAvailable).mockResolvedValue({
      isAvailable: false,
      biometryType: 0,
      authenticationStrength: 0,
      deviceIsSecure: false,
      strongBiometryIsAvailable: false,
    });
    expect(await isBiometricAvailable()).toBe(false);
    expect(await getBiometryKind()).toBe("none");
  });

  it("registers biometric passkey and clears credentials accurately", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(NativeBiometric.isAvailable).mockResolvedValue({
      isAvailable: true,
      biometryType: 2,
      authenticationStrength: 1,
      deviceIsSecure: true,
      strongBiometryIsAvailable: true,
    });
    vi.mocked(NativeBiometric.verifyIdentity).mockResolvedValue();

    const registered = await registerBiometricPasskey();
    expect(registered).toBe(true);
    expect(getSecuritySettings().hasBiometric).toBe(true);

    // Clear biometric credential
    clearBiometricCredential();
    expect(getSecuritySettings().hasBiometric).toBe(false);
  });

  it("authenticates with biometrics and returns stored session vault", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(NativeBiometric.isAvailable).mockResolvedValue({
      isAvailable: true,
      biometryType: 2,
      authenticationStrength: 1,
      deviceIsSecure: true,
      strongBiometryIsAvailable: true,
    });
    vi.mocked(NativeBiometric.verifyIdentity).mockResolvedValue();

    // Not enrolled yet -> returns error
    clearBiometricCredential();
    const disabledResult = await authenticateWithBiometrics(true);
    expect(disabledResult.success).toBe(false);
    expect(disabledResult.error).toContain("Otentikasi biometrik belum diaktifkan");

    // Enroll and save session
    await registerBiometricPasskey();
    savePersistentSession({ user: { email: "biometric@trouvaille.app" } });

    const authResult = await authenticateWithBiometrics(false);
    expect(authResult.success).toBe(true);
    expect(authResult.session?.user?.email).toBe("biometric@trouvaille.app");

    clearBiometricCredential();
    clearPersistentSession();
  });

  it("returns strictly localized error messages on failed PIN authentication (Rule 6)", async () => {
    await setSecurityPin("998877");

    // English wrong PIN
    const resEn = await authenticateWithPin("000000", false);
    expect(resEn.success).toBe(false);
    expect(resEn.error).toBe("Incorrect PIN. Please try again.");

    // Indonesian wrong PIN
    const resId = await authenticateWithPin("000000", true);
    expect(resId.success).toBe(false);
    expect(resId.error).toBe("PIN salah. Silakan coba lagi.");

    clearSecurityPin();
  });
});
