import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getSecuritySettings,
  saveSecuritySettings,
  updateLastActiveTimestamp,
  isLockTimeoutExceeded,
  isBiometricAvailable,
  getBiometryKind,
  verifyBiometricPasskey,
  registerBiometricPasskey,
  verifySecurityPin,
  setSecurityPin,
  clearSecurityPin,
  clearBiometricCredential,
  resetPinLockout,
  type SecuritySettings,
  type BiometryKind,
  type VerifyBiometricOptions,
} from "../lib/biometricAuth";
import { triggerHaptic, triggerSuccessHaptic } from "../lib/haptics";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

interface SecurityLockContextType {
  isLocked: boolean;
  isBiometricSupported: boolean;
  biometryKind: BiometryKind;
  securitySettings: SecuritySettings;
  unlockWithBiometric: (options?: VerifyBiometricOptions) => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  updateSettings: (partial: Partial<SecuritySettings>) => void;
  enrollBiometric: (options?: VerifyBiometricOptions) => Promise<boolean>;
  enrollPin: (pin: string) => Promise<boolean>;
  removePin: () => void;
  removeBiometric: () => void;
}

const SecurityLockContext = createContext<SecurityLockContextType | null>(null);

export function SecurityLockProvider({ children }: { children: ReactNode }) {
  const [securitySettings, setSecuritySettingsState] = useState<SecuritySettings>(
    () => getSecuritySettings(),
  );
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometryKind, setBiometryKind] = useState<BiometryKind>("none");
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const s = getSecuritySettings();
    return s.enabled; // Locked initially on app start if enabled
  });

  // Check device biometric capabilities on mount & listen for session teardown (Rule 8.2)
  useEffect(() => {
    let isMounted = true;
    isBiometricAvailable().then((supported) => {
      if (isMounted) setIsBiometricSupported(supported);
    });
    getBiometryKind().then((kind) => {
      if (isMounted) setBiometryKind(kind);
    });

    const handleSessionTeardown = () => {
      setIsLocked(false);
      setSecuritySettingsState(getSecuritySettings());
    };

    window.addEventListener("trouvaille_session_teardown", handleSessionTeardown);
    return () => {
      isMounted = false;
      window.removeEventListener("trouvaille_session_teardown", handleSessionTeardown);
    };
  }, []);

  // Sync settings helper
  const updateSettings = useCallback((partial: Partial<SecuritySettings>) => {
    const updated = saveSecuritySettings(partial);
    setSecuritySettingsState({ ...updated });
  }, []);

  const unlockWithBiometric = useCallback(
    async (options?: VerifyBiometricOptions): Promise<boolean> => {
      if (!securitySettings.enabled || !securitySettings.hasBiometric) {
        return false;
      }
      const ok = await verifyBiometricPasskey(options);
      if (ok) {
        setIsLocked(false);
        updateLastActiveTimestamp();
        resetPinLockout();
        triggerSuccessHaptic();
        return true;
      }
      triggerHaptic("heavy");
      return false;
    },
    [securitySettings.enabled, securitySettings.hasBiometric],
  );

  const unlockWithPin = useCallback(async (pin: string): Promise<boolean> => {
    const valid = await verifySecurityPin(pin);
    if (valid) {
      setIsLocked(false);
      updateLastActiveTimestamp();
      triggerHaptic("medium");
      return true;
    }
    triggerHaptic("heavy");
    return false;
  }, []);

  const lockApp = useCallback(() => {
    if (securitySettings.enabled) {
      setIsLocked(true);
      triggerHaptic("light");
    }
  }, [securitySettings.enabled]);

  const enrollBiometric = useCallback(
    async (options?: VerifyBiometricOptions): Promise<boolean> => {
      if (!securitySettings.hasPin) {
        return false;
      }
      const ok = await registerBiometricPasskey(options);
      if (ok) {
        updateSettings({ hasBiometric: true });
        triggerSuccessHaptic();
        return true;
      }
      return false;
    },
    [securitySettings.hasPin, updateSettings],
  );

  const enrollPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const success = await setSecurityPin(pin);
      if (success) {
        updateSettings({ hasPin: true });
        triggerSuccessHaptic();
      }
      return success;
    },
    [updateSettings],
  );

  const removePin = useCallback(() => {
    clearSecurityPin();
    clearBiometricCredential();
    updateSettings({ hasPin: false, hasBiometric: false, enabled: false });
    triggerHaptic("light");
  }, [updateSettings]);

  const removeBiometric = useCallback(() => {
    clearBiometricCredential();
    updateSettings({ hasBiometric: false });
    triggerHaptic("light");
  }, [updateSettings]);

  // Visibility change & window focus/blur handler
  useEffect(() => {
    if (!securitySettings.enabled) return;

    let backgroundedAt = 0;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        backgroundedAt = Date.now();
        updateLastActiveTimestamp();
      } else {
        if (isLockTimeoutExceeded() || (securitySettings.timeoutMinutes === 0 && backgroundedAt > 0)) {
          setIsLocked(true);
        }
      }
    };

    const handleBlur = () => {
      backgroundedAt = Date.now();
      updateLastActiveTimestamp();
    };

    const handleFocus = () => {
      if (isLockTimeoutExceeded() || (securitySettings.timeoutMinutes === 0 && backgroundedAt > 0)) {
        setIsLocked(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    let appStateHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgroundedAt = Date.now();
          updateLastActiveTimestamp();
        } else {
          if (
            isLockTimeoutExceeded() ||
            (securitySettings.timeoutMinutes === 0 && backgroundedAt > 0)
          ) {
            setIsLocked(true);
          }
        }
      }).then((handle) => {
        appStateHandle = handle;
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      if (appStateHandle) {
        appStateHandle.remove();
      }
    };
  }, [securitySettings.enabled, securitySettings.timeoutMinutes]);

  return (
    <SecurityLockContext.Provider
      value={{
        isLocked,
        isBiometricSupported,
        biometryKind,
        securitySettings,
        unlockWithBiometric,
        unlockWithPin,
        lockApp,
        updateSettings,
        enrollBiometric,
        enrollPin,
        removePin,
        removeBiometric,
      }}
    >
      {children}
    </SecurityLockContext.Provider>
  );
}

export function useSecurityLock() {
  const ctx = useContext(SecurityLockContext);
  if (!ctx) {
    throw new Error("useSecurityLock must be used within a SecurityLockProvider");
  }
  return ctx;
}
