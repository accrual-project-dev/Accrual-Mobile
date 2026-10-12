import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { triggerHaptic } from "../lib/haptics";
import { App as CapApp } from "@capacitor/app";

const PRIVACY_STORAGE_KEY = "trouvaille_stealth_mode_v1";
const SHIELD_STORAGE_KEY = "trouvaille_privacy_shield_enabled_v1";

interface PrivacyContextType {
  isStealthMode: boolean;
  toggleStealthMode: () => void;
  setStealthMode: (value: boolean) => void;
  isPrivacyShieldEnabled: boolean;
  togglePrivacyShield: () => void;
  setPrivacyShieldEnabled: (value: boolean) => void;
  isPrivacyShieldActive: boolean;
  setIsPrivacyShieldActive: (value: boolean) => void;
  maskAmount: (formattedText: string, placeholder?: string) => string;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isStealthMode: false,
  toggleStealthMode: () => {},
  setStealthMode: () => {},
  isPrivacyShieldEnabled: false,
  togglePrivacyShield: () => {},
  setPrivacyShieldEnabled: () => {},
  isPrivacyShieldActive: false,
  setIsPrivacyShieldActive: () => {},
  maskAmount: (text) => text,
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  // Master Privacy Shield setting (controls app switcher overlay & auto-masking)
  const [isPrivacyShieldEnabled, setIsPrivacyShieldEnabledState] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem(SHIELD_STORAGE_KEY);
      return val === "true";
    } catch {
      return false;
    }
  });

  // App Switcher / background blur state (true when app is backgrounded or in app switcher)
  const [isPrivacyShieldActive, setIsPrivacyShieldActive] = useState(false);

  // Stealth mode (masks monetary figures in UI)
  const [isStealthMode, setIsStealthModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PRIVACY_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const setPrivacyShieldEnabled = useCallback((val: boolean) => {
    setIsPrivacyShieldEnabledState(val);
    if (!val) {
      setIsPrivacyShieldActive(false);
      setIsStealthModeState(false);
      try {
        localStorage.setItem(PRIVACY_STORAGE_KEY, "false");
      } catch {}
    }
    try {
      localStorage.setItem(SHIELD_STORAGE_KEY, String(val));
    } catch {}
  }, []);

  const togglePrivacyShield = useCallback(() => {
    setIsPrivacyShieldEnabledState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SHIELD_STORAGE_KEY, String(next));
      } catch {}
      if (!next) {
        setIsPrivacyShieldActive(false);
        setIsStealthModeState(false);
        try {
          localStorage.setItem(PRIVACY_STORAGE_KEY, "false");
        } catch {}
      }
      triggerHaptic("medium");
      return next;
    });
  }, []);

  const setStealthMode = useCallback((val: boolean) => {
    setIsStealthModeState(val);
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, String(val));
    } catch {
      // ignore
    }
  }, []);

  const toggleStealthMode = useCallback(() => {
    setIsStealthModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PRIVACY_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      triggerHaptic("medium");
      return next;
    });
  }, []);

  const maskAmount = useCallback(
    (formattedText: string, placeholder = "••••••••") => {
      if (!isStealthMode && !isPrivacyShieldEnabled) return formattedText;
      if (formattedText.startsWith("Rp")) {
        return `Rp ${placeholder}`;
      }
      return placeholder;
    },
    [isStealthMode, isPrivacyShieldEnabled]
  );

  // Listen to session teardown (Rule 8.2)
  useEffect(() => {
    const handleTeardown = () => {
      setIsPrivacyShieldEnabledState(false);
      setIsPrivacyShieldActive(false);
      setIsStealthModeState(false);
    };
    window.addEventListener("trouvaille_session_teardown", handleTeardown);
    return () => {
      window.removeEventListener("trouvaille_session_teardown", handleTeardown);
    };
  }, []);

  // iOS App Switcher & Background Privacy Shield overlay listeners
  useEffect(() => {
    if (!isPrivacyShieldEnabled) {
      return;
    }

    const handleBlur = () => setIsPrivacyShieldActive(true);
    const handleFocus = () => setIsPrivacyShieldActive(false);
    const handleVisibility = () => {
      if (document.hidden) {
        setIsPrivacyShieldActive(true);
      } else {
        setTimeout(() => setIsPrivacyShieldActive(false), 120);
      }
    };
    const handlePageHide = () => setIsPrivacyShieldActive(true);
    const handlePageShow = () => setIsPrivacyShieldActive(false);

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    let capListenerHandle: any;
    try {
      capListenerHandle = CapApp.addListener("appStateChange", ({ isActive }) => {
        setIsPrivacyShieldActive(!isActive);
      });
    } catch {}

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      if (capListenerHandle) {
        capListenerHandle.then((h: any) => h.remove?.()).catch(() => {});
      }
    };
  }, [isPrivacyShieldEnabled]);

  // Global listeners: 3-finger touch on mobile & Cmd+H / Ctrl+H on keyboard
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length === 3) {
        // 3-finger tap detected!
        togglePrivacyShield();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "h") {
        // Avoid intercepting browser history if inside input field
        const target = e.target as HTMLElement;
        const isInputField =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (!isInputField) {
          e.preventDefault();
          togglePrivacyShield();
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [togglePrivacyShield]);

  const value = useMemo<PrivacyContextType>(
    () => ({
      isStealthMode,
      toggleStealthMode,
      setStealthMode,
      isPrivacyShieldEnabled,
      togglePrivacyShield,
      setPrivacyShieldEnabled,
      isPrivacyShieldActive: isPrivacyShieldEnabled && isPrivacyShieldActive,
      setIsPrivacyShieldActive,
      maskAmount,
    }),
    [
      isStealthMode,
      toggleStealthMode,
      setStealthMode,
      isPrivacyShieldEnabled,
      togglePrivacyShield,
      setPrivacyShieldEnabled,
      isPrivacyShieldActive,
      setIsPrivacyShieldActive,
      maskAmount,
    ],
  );

  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  );
}

export const usePrivacy = () => useContext(PrivacyContext);
