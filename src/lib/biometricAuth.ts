// ======================================================================
// TROUVAILLE BIOMETRIC / PASKEY & SECURITY ENGINE
// Standard: WebAuthn FIDO2 Platform Authenticator (Face ID, Touch ID, Windows Hello)
// ======================================================================

export interface SecuritySettings {
  enabled: boolean;
  timeoutMinutes: number; // 0 = Immediately, 1 = 1 minute, 5 = 5 minutes
  hasBiometric: boolean;
  hasPin: boolean;
  lastActiveTimestamp: number;
}

const SECURITY_SETTINGS_KEY = "trouvaille_security_settings_v1";
const BIOMETRIC_CREDENTIAL_KEY = "trouvaille_biometric_cred_v1";
const SECURITY_PIN_HASH_KEY = "trouvaille_security_pin_hash_v1";
const SECURITY_PIN_PBKDF2_KEY = "trouvaille_security_pin_pbkdf2_v2";
const PIN_LOCKOUT_KEY = "trouvaille_pin_lockout_v1";
const BIOMETRIC_LOGIN_TOKEN_KEY = "trouvaille_biometric_login_token_v1";

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  enabled: false,
  timeoutMinutes: 0, // Immediately upon app switch
  hasBiometric: false,
  hasPin: false,
  lastActiveTimestamp: Date.now(),
};

// ======================================================================
// SETTINGS PERSISTENCE
// ======================================================================

export function getSecuritySettings(): SecuritySettings {
  try {
    const raw = localStorage.getItem(SECURITY_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_SECURITY_SETTINGS,
      ...parsed,
      lastActiveTimestamp: parsed.lastActiveTimestamp || Date.now(),
      hasBiometric: !!localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY),
      hasPin:
        !!localStorage.getItem(SECURITY_PIN_PBKDF2_KEY) ||
        !!localStorage.getItem(SECURITY_PIN_HASH_KEY),
    };
  } catch {
    return { ...DEFAULT_SECURITY_SETTINGS, lastActiveTimestamp: Date.now() };
  }
}

export function saveSecuritySettings(settings: Partial<SecuritySettings>): SecuritySettings {
  try {
    const current = getSecuritySettings();
    const updated: SecuritySettings = {
      ...current,
      ...settings,
    };
    localStorage.setItem(SECURITY_SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn("Failed to save security settings:", e);
    return { ...DEFAULT_SECURITY_SETTINGS, ...settings };
  }
}

export function updateLastActiveTimestamp(): void {
  try {
    const current = getSecuritySettings();
    current.lastActiveTimestamp = Date.now();
    localStorage.setItem(SECURITY_SETTINGS_KEY, JSON.stringify(current));
  } catch {}
}

export function isLockTimeoutExceeded(): boolean {
  const settings = getSecuritySettings();
  if (!settings.enabled) return false;
  const now = Date.now();
  const elapsedMinutes = (now - settings.lastActiveTimestamp) / (1000 * 60);
  return elapsedMinutes >= settings.timeoutMinutes;
}

import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";

export type BiometryKind = "face" | "fingerprint" | "biometric" | "none";

export interface VerifyBiometricOptions {
  reason?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  negativeButtonText?: string;
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await NativeBiometric.isAvailable({ useFallback: false });
      return !!result?.isAvailable;
    } catch {
      return false;
    }
  }
  if (typeof window !== "undefined" && window.PublicKeyCredential) {
    try {
      const available =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return !!available;
    } catch {
      return false;
    }
  }
  return false;
}

export async function getBiometryKind(): Promise<BiometryKind> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await NativeBiometric.isAvailable({ useFallback: false });
      if (!result?.isAvailable) return "none";
      // 1=TOUCH_ID, 2=FACE_ID, 3=FINGERPRINT, 4=FACE_AUTHENTICATION, 5=IRIS, 6=MULTIPLE
      if (result.biometryType === 2 || result.biometryType === 4) return "face";
      if (result.biometryType === 1 || result.biometryType === 3) return "fingerprint";
      return "biometric";
    } catch {
      return "none";
    }
  }
  return "none";
}

export async function verifyBiometricPasskey(
  options?: VerifyBiometricOptions,
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBiometric.verifyIdentity({
        reason: options?.reason || "Verify your identity to unlock Accrual",
        title: options?.title || "Accrual Security",
        subtitle: options?.subtitle || "Confirm biometrics to continue",
        description: options?.description,
        negativeButtonText: options?.negativeButtonText || "Cancel",
        useFallback: false,
      });
      return true;
    } catch (err: any) {
      console.info("[biometricAuth] Biometric verification cancelled or failed:", err?.message || err);
      return false;
    }
  }
  return false;
}

export async function registerBiometricPasskey(
  options?: VerifyBiometricOptions,
): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return false;

  const verified = await verifyBiometricPasskey(
    options || {
      reason: "Enroll biometrics to protect your vault",
      title: "Enroll Biometrics",
      subtitle: "Verify identity to enable biometric unlock",
      negativeButtonText: "Cancel",
    },
  );

  if (verified) {
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, "enrolled_" + Date.now());
    saveSecuritySettings({ hasBiometric: true });
    return true;
  }
  return false;
}

export function clearBiometricCredential(): void {
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  localStorage.removeItem(BIOMETRIC_LOGIN_TOKEN_KEY);
  saveSecuritySettings({ hasBiometric: false });
}

// ======================================================================
// SECURITY PIN FALLBACK
// ======================================================================

export interface PinLockoutState {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
}

export function getPinLockoutState(): PinLockoutState {
  try {
    const raw = localStorage.getItem(PIN_LOCKOUT_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    const { attempts, lockedUntil } = JSON.parse(raw);
    const now = Date.now();
    if (lockedUntil && now < lockedUntil) {
      const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds, attempts: attempts || 0 };
    }
    return { isLocked: false, remainingSeconds: 0, attempts: attempts || 0 };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }
}

export function recordFailedPinAttempt(): PinLockoutState {
  const current = getPinLockoutState();
  const nextAttempts = (current.attempts || 0) + 1;
  let lockedUntil: number | null = null;

  if (nextAttempts >= 5) {
    const durationMs = nextAttempts >= 7 ? 60_000 : 30_000;
    lockedUntil = Date.now() + durationMs;
  }

  localStorage.setItem(
    PIN_LOCKOUT_KEY,
    JSON.stringify({ attempts: nextAttempts, lockedUntil }),
  );

  return getPinLockoutState();
}

export function resetPinLockout(): void {
  localStorage.removeItem(PIN_LOCKOUT_KEY);
}

// Derive 256-bit PBKDF2 key hash with random salt (100,000 iterations)
async function derivePbkdf2PinHash(pin: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(derivedBits), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

export async function hashSecurityPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`trouvaille_salt_${pin}_salt`);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  return bufferToBase64(hashBuffer);
}

export async function setSecurityPin(pin: string): Promise<boolean> {
  if (!pin || pin.length < 4) {
    throw new Error("PIN must be at least 4 digits.");
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePbkdf2PinHash(pin, salt);
  const payload = {
    salt: Array.from(salt, (b) => b.toString(16).padStart(2, "0")).join(""),
    hash,
    iterations: 100_000,
  };
  localStorage.setItem(SECURITY_PIN_PBKDF2_KEY, JSON.stringify(payload));
  localStorage.removeItem(SECURITY_PIN_HASH_KEY); // Clean up legacy key
  resetPinLockout();
  saveSecuritySettings({ hasPin: true });
  return true;
}

export async function verifySecurityPin(pin: string): Promise<boolean> {
  const lockout = getPinLockoutState();
  if (lockout.isLocked) {
    return false;
  }

  // 1. Check PBKDF2 hardened PIN
  const pbkdf2Raw = localStorage.getItem(SECURITY_PIN_PBKDF2_KEY);
  if (pbkdf2Raw) {
    try {
      const { salt, hash } = JSON.parse(pbkdf2Raw);
      const saltBytes = new Uint8Array(
        salt.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || [],
      );
      const calculatedHash = await derivePbkdf2PinHash(pin, saltBytes);
      if (calculatedHash === hash) {
        resetPinLockout();
        return true;
      }
    } catch (e) {
      console.warn("Failed to verify PBKDF2 PIN:", e);
    }
  }

  // 2. Fallback to legacy SHA-256 and auto-upgrade to PBKDF2
  const legacyHash = localStorage.getItem(SECURITY_PIN_HASH_KEY);
  if (legacyHash) {
    const inputHash = await hashSecurityPin(pin);
    if (legacyHash === inputHash) {
      resetPinLockout();
      // Auto-migrate legacy PIN to PBKDF2 in background
      await setSecurityPin(pin);
      return true;
    }
  }

  // Failed attempt
  recordFailedPinAttempt();
  return false;
}

export function clearSecurityPin(): void {
  localStorage.removeItem(SECURITY_PIN_PBKDF2_KEY);
  localStorage.removeItem(SECURITY_PIN_HASH_KEY);
  resetPinLockout();
  saveSecuritySettings({ hasPin: false });
}

// ======================================================================
// BIOMETRIC QUICK LOGIN SESSION & VAULT PERSISTENCE
// ======================================================================

const SESSION_VAULT_KEY = "trouvaille_session_vault_v1";

export function savePersistentSession(session: any): void {
  try {
    if (!session) return;
    localStorage.setItem(SESSION_VAULT_KEY, JSON.stringify(session));
    if (Capacitor.isNativePlatform()) {
      NativeBiometric.setData({
        key: "trouvaille_vault_session",
        value: JSON.stringify(session),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("[biometricAuth] Failed to persist session vault:", err);
  }
}

export function getPersistentSession(): any | null {
  try {
    const raw = localStorage.getItem(SESSION_VAULT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

export function clearPersistentSession(): void {
  try {
    localStorage.removeItem(SESSION_VAULT_KEY);
    if (Capacitor.isNativePlatform()) {
      NativeBiometric.deleteData({ key: "trouvaille_vault_session" }).catch(() => {});
    }
  } catch {}
}

export function saveBiometricLoginCredentials(
  email: string,
  sessionData?: any,
  password?: string,
): void {
  try {
    const payload = {
      email,
      timestamp: Date.now(),
      session: sessionData,
    };
    localStorage.setItem(BIOMETRIC_LOGIN_TOKEN_KEY, JSON.stringify(payload));

    if (sessionData) {
      savePersistentSession(sessionData);
    }

    if (Capacitor.isNativePlatform() && password) {
      NativeBiometric.setCredentials({
        username: email,
        password: password,
        server: "trouvaille.app",
      }).catch((err) => {
        console.warn("[biometricAuth] Failed to set native keychain credentials:", err);
      });
    }
  } catch (e) {
    console.warn("[biometricAuth] Failed to save biometric login credentials:", e);
  }
}

export function getBiometricLoginCredentials(): { email: string; session?: any } | null {
  try {
    const raw = localStorage.getItem(BIOMETRIC_LOGIN_TOKEN_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

export function clearBiometricLoginCredentials(): void {
  try {
    localStorage.removeItem(BIOMETRIC_LOGIN_TOKEN_KEY);
    clearPersistentSession();
    if (Capacitor.isNativePlatform()) {
      NativeBiometric.deleteCredentials({ server: "trouvaille.app" }).catch(() => {});
    }
  } catch {}
}

export interface BiometricAuthResult {
  success: boolean;
  session?: any;
  email?: string;
  error?: string;
}

export async function authenticateWithBiometrics(
  isIndonesian = false,
): Promise<BiometricAuthResult> {
  const available = await isBiometricAvailable();
  const settings = getSecuritySettings();
  if (!available || !settings.hasBiometric) {
    return {
      success: false,
      error: isIndonesian
        ? "Otentikasi biometrik belum diaktifkan. Silakan gunakan PIN Keamanan."
        : "Biometric authentication is not enabled. Please authenticate using your Security PIN.",
    };
  }

  const verified = await verifyBiometricPasskey({
    reason: isIndonesian
      ? "Verifikasi identitas Anda untuk masuk"
      : "Verify your identity to sign in",
    title: isIndonesian ? "Otentikasi Biometrik" : "Biometric Authentication",
    negativeButtonText: isIndonesian ? "Gunakan PIN" : "Use PIN",
  });

  if (!verified) {
    return {
      success: false,
      error: isIndonesian
        ? "Otentikasi biometrik dibatalkan atau tidak cocok."
        : "Biometric authentication was cancelled or failed.",
    };
  }

  // 1. Hardware Keychain credentials if native
  if (Capacitor.isNativePlatform()) {
    try {
      const creds = await NativeBiometric.getCredentials({ server: "trouvaille.app" });
      if (creds?.username && creds?.password) {
        const { data } = await supabase.auth.signInWithPassword({
          email: creds.username,
          password: creds.password,
        });
        if (data?.session) {
          saveBiometricLoginCredentials(creds.username, data.session, creds.password);
          return {
            success: true,
            session: data.session,
            email: creds.username,
          };
        }
      }
    } catch (e) {
      console.info("[biometricAuth] Native Keychain lookup skipped in biometric auth:", e);
    }
  }

  // 2. Persistent session or biometric credentials with refresh token
  const hint = getBiometricLoginCredentials();
  const vaultSession = hint?.session || getPersistentSession();

  if (vaultSession?.refresh_token) {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: vaultSession.access_token || "",
        refresh_token: vaultSession.refresh_token,
      });

      if (data?.session) {
        saveBiometricLoginCredentials(hint?.email || data.session.user?.email || "", data.session);
        return {
          success: true,
          session: data.session,
          email: hint?.email || data.session.user?.email,
        };
      }

      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline || error?.message?.toLowerCase().includes("fetch")) {
        return {
          success: true,
          session: vaultSession,
          email: hint?.email || vaultSession.user?.email,
        };
      }
    } catch {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline) {
        return {
          success: true,
          session: vaultSession,
          email: hint?.email || vaultSession.user?.email,
        };
      }
    }
  }

  // 3. Active session check
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      saveBiometricLoginCredentials(data.session.user?.email || "", data.session);
      return {
        success: true,
        session: data.session,
        email: data.session.user?.email,
      };
    }
  } catch {}

  // 4. Fallback vault session
  if (vaultSession) {
    return {
      success: true,
      session: vaultSession,
      email: hint?.email || vaultSession.user?.email,
    };
  }

  return {
    success: true,
    email: hint?.email,
  };
}

export async function authenticateWithPin(
  pin: string,
  isIndonesian = false,
): Promise<BiometricAuthResult> {
  const verified = await verifySecurityPin(pin);
  if (!verified) {
    const lockout = getPinLockoutState();
    if (lockout.isLocked) {
      const waitMins = Math.ceil(lockout.remainingSeconds / 60);
      return {
        success: false,
        error: isIndonesian
          ? `PIN terkunci karena terlalu banyak percobaan salah. Coba lagi dalam ${waitMins} menit.`
          : `PIN locked due to too many failed attempts. Try again in ${waitMins} minute(s).`,
      };
    }
    return {
      success: false,
      error: isIndonesian
        ? "PIN salah. Silakan coba lagi."
        : "Incorrect PIN. Please try again.",
    };
  }

  // 1. Native iOS / Android: Try hardware-backed Keychain credentials
  if (Capacitor.isNativePlatform()) {
    try {
      const creds = await NativeBiometric.getCredentials({ server: "trouvaille.app" });
      if (creds?.username && creds?.password) {
        const { data } = await supabase.auth.signInWithPassword({
          email: creds.username,
          password: creds.password,
        });
        if (data?.session) {
          saveBiometricLoginCredentials(creds.username, data.session, creds.password);
          return {
            success: true,
            session: data.session,
            email: creds.username,
          };
        }
      }
    } catch (e) {
      console.info("[biometricAuth] Native Keychain lookup skipped in PIN auth:", e);
    }
  }

  // 2. Try session vault or biometric credentials with refresh token
  const hint = getBiometricLoginCredentials();
  const vaultSession = hint?.session || getPersistentSession();

  if (vaultSession?.refresh_token) {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: vaultSession.access_token || "",
        refresh_token: vaultSession.refresh_token,
      });

      if (data?.session) {
        saveBiometricLoginCredentials(hint?.email || data.session.user?.email || "", data.session);
        return {
          success: true,
          session: data.session,
          email: hint?.email || data.session.user?.email,
        };
      }

      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline || error?.message?.toLowerCase().includes("fetch")) {
        return {
          success: true,
          session: vaultSession,
          email: hint?.email || vaultSession.user?.email,
        };
      }
    } catch {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline) {
        return {
          success: true,
          session: vaultSession,
          email: hint?.email || vaultSession.user?.email,
        };
      }
    }
  }

  // 3. Active session check
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      saveBiometricLoginCredentials(data.session.user?.email || "", data.session);
      return {
        success: true,
        session: data.session,
        email: data.session.user?.email,
      };
    }
  } catch {}

  // 4. Session vault fallback
  if (vaultSession) {
    return {
      success: true,
      session: vaultSession,
      email: hint?.email || vaultSession.user?.email,
    };
  }

  return {
    success: true,
    email: hint?.email,
  };
}

