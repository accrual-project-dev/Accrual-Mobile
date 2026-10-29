import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { AccrualInbox } from "../plugins/accrualInbox";
import { GUEST_CAPTURE_OWNER_KEY } from "../features/inbox/captureOwner";
import { supabase } from "../lib/supabase";
import {
  savePersistentSession,
  getPersistentSession,
  clearPersistentSession,
  clearBiometricLoginCredentials,
} from "../lib/biometricAuth";
import { useQueryClient } from "@tanstack/react-query";
import { clearAllLocalUserSessionData } from "../lib/sessionCleanup";
import { revenueCatService } from "../lib/revenueCatService";

export const GUEST_USER_ID = "guest_local_user";

export const GUEST_USER: User = {
  id: GUEST_USER_ID,
  app_metadata: { provider: "guest" },
  user_metadata: { display_name: "Guest" },
  aud: "guest",
  created_at: new Date().toISOString(),
  email: "guest@trouvaille.local",
  role: "anon",
} as User;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (value: boolean) => void;
  setSession: (session: Session | null) => void;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  exitGuestMode: (options?: { wipeGuestData?: boolean }) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isGuest: false,
  isPasswordRecovery: false,
  setIsPasswordRecovery: () => {},
  setSession: () => {},
  signOut: async () => {},
  continueAsGuest: () => {},
  exitGuestMode: () => {},
});

function getStoredSupabaseSession(): Session | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.access_token || parsed.user)) {
            return parsed as Session;
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronous session restore from local vault for instant 0ms startup
  const [session, setSession] = useState<Session | null>(() => {
    try {
      if (typeof window === "undefined") return null;
      const storedIsGuest = localStorage.getItem("trouvaille_guest_mode") === "true";
      if (storedIsGuest) return null;
      return getPersistentSession() || getStoredSupabaseSession();
    } catch {
      return null;
    }
  });

  const [isGuest, setIsGuest] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("trouvaille_guest_mode") === "true";
  });

  // Only block initial render if user status is completely undetermined
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const storedIsGuest = localStorage.getItem("trouvaille_guest_mode") === "true";
    const initialSession = getPersistentSession() || getStoredSupabaseSession();
    // If we already have a local session OR user is in guest mode, render immediately (0ms)
    return !storedIsGuest && !initialSession;
  });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const queryClient = useQueryClient();

  const continueAsGuest = () => {
    const returningToPendingGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("trouvaille_pending_guest_migration") === "true";
    if (returningToPendingGuest) {
      localStorage.removeItem("trouvaille_pending_guest_migration");
    } else {
      localStorage.removeItem(GUEST_CAPTURE_OWNER_KEY);
      clearAllLocalUserSessionData(queryClient, { preserveGuestFlag: true }).catch(() => {});
    }
    try {
      supabase.auth.signOut().catch(() => {});
    } catch {}
    setSession(null);
    localStorage.setItem("trouvaille_guest_mode", "true");
    setIsGuest(true);
  };

  const exitGuestMode = (options?: { wipeGuestData?: boolean }) => {
    if (options?.wipeGuestData) {
      localStorage.removeItem(GUEST_CAPTURE_OWNER_KEY);
      clearAllLocalUserSessionData(queryClient, { preserveGuestFlag: false }).catch(() => {});
      localStorage.removeItem("trouvaille_pending_guest_migration");
    } else {
      localStorage.setItem("trouvaille_pending_guest_migration", "true");
    }
    localStorage.removeItem("trouvaille_guest_mode");
    setIsGuest(false);
  };

  useEffect(() => {
    let isMounted = true;

    const handleAuthDeepLink = async (rawUrl: string) => {
      try {
        if (!rawUrl) return;
        const isAuthTarget =
          rawUrl.includes("auth-callback") ||
          rawUrl.includes("reset-password") ||
          rawUrl.includes("access_token=") ||
          rawUrl.includes("refresh_token=") ||
          rawUrl.includes("type=recovery") ||
          rawUrl.includes("code=");

        if (!isAuthTarget) return;

        // Dismiss external in-app browser if still open
        try {
          await Browser.close();
        } catch {}

        let queryParams = new URLSearchParams();
        let hashParams = new URLSearchParams();
        try {
          if (rawUrl.includes("?")) {
            const qPart = rawUrl.split("?")[1].split("#")[0];
            queryParams = new URLSearchParams(qPart);
          }
          if (rawUrl.includes("#")) {
            const hPart = rawUrl.split("#")[1];
            hashParams = new URLSearchParams(hPart);
          }
        } catch {}

        const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
        const code = queryParams.get("code") || hashParams.get("code");
        const type = queryParams.get("type") || hashParams.get("type");
        const token = queryParams.get("token") || hashParams.get("token");
        const email = queryParams.get("email") || hashParams.get("email");

        if (token && email && (type === "recovery" || rawUrl.includes("reset-password"))) {
          try {
            const { data } = await supabase.auth.verifyOtp({
              email: email.trim(),
              token: token.trim(),
              type: "recovery",
            });
            if (data?.session && isMounted) {
              savePersistentSession(data.session);
              setSession(data.session);
              setIsGuest(false);
              localStorage.removeItem("trouvaille_guest_mode");
              setIsPasswordRecovery(true);
            }
          } catch (otpErr) {
            console.warn("[AuthContext] Direct recovery token verification failed:", otpErr);
          }
        }

        if (accessToken && refreshToken) {
          const { data } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (data?.session && isMounted) {
            savePersistentSession(data.session);
            setSession(data.session);
            setIsGuest(false);
            localStorage.removeItem("trouvaille_guest_mode");
          }
        } else if (code) {
          const { data } = await supabase.auth.exchangeCodeForSession(code);
          if (data?.session && isMounted) {
            savePersistentSession(data.session);
            setSession(data.session);
            setIsGuest(false);
            localStorage.removeItem("trouvaille_guest_mode");
          }
        }

        if (type === "recovery" || rawUrl.includes("reset-password")) {
          if (isMounted) {
            setIsPasswordRecovery(true);
          }
        }
      } catch (err) {
        console.warn("[AuthContext] Failed handling native deep link:", err);
      }
    };

    let urlListenerHandle: { remove: () => void } | null = null;
    CapApp.addListener("appUrlOpen", (event) => {
      if (isMounted && event?.url) {
        handleAuthDeepLink(event.url);
      }
    })
      .then((handle) => {
        urlListenerHandle = handle;
      })
      .catch(() => {});

    CapApp.getLaunchUrl()
      .then((launch) => {
        if (launch?.url) {
          handleAuthDeepLink(launch.url);
        }
      })
      .catch(() => {});

    async function initAuth() {
      try {
        const storedIsGuest =
          typeof window !== "undefined" &&
          localStorage.getItem("trouvaille_guest_mode") === "true";

        if (typeof window !== "undefined") {
          const fullUrl = window.location.href;
          if (
            fullUrl.includes("type=recovery") ||
            fullUrl.includes("reset-password") ||
            window.location.hash.includes("type=recovery") ||
            window.location.search.includes("type=recovery")
          ) {
            setIsPasswordRecovery(true);
          }

          if (window.location.hash.includes("access_token=")) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const aToken = hashParams.get("access_token");
            const rToken = hashParams.get("refresh_token");
            const type = hashParams.get("type");
            if (aToken && rToken) {
              try {
                const { data } = await supabase.auth.setSession({
                  access_token: aToken,
                  refresh_token: rToken,
                });
                if (data?.session && isMounted) {
                  savePersistentSession(data.session);
                  setSession(data.session);
                  setIsGuest(false);
                  localStorage.removeItem("trouvaille_guest_mode");
                }
              } catch {}
            }
            if (type === "recovery") {
              setIsPasswordRecovery(true);
            }
          }
        }

        if (storedIsGuest) {
          if (!isMounted) return;
          setIsGuest(true);
          setSession(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (data?.session) {
          savePersistentSession(data.session);
          setSession(data.session);
          setIsGuest(false);
          localStorage.removeItem("trouvaille_guest_mode");
          setLoading(false);
          return;
        }

        // If Supabase getSession returned null or threw, check session vault or stored tokens
        const vault = getPersistentSession() || getStoredSupabaseSession();
        if (vault) {
          if (vault.refresh_token) {
            try {
              const { data: refreshed } = await supabase.auth.setSession({
                access_token: vault.access_token || "",
                refresh_token: vault.refresh_token,
              });
              if (refreshed?.session && isMounted) {
                savePersistentSession(refreshed.session);
                setSession(refreshed.session);
                setIsGuest(false);
                localStorage.removeItem("trouvaille_guest_mode");
                setLoading(false);
                return;
              }
            } catch (rErr) {
              console.warn("[AuthContext] Background token refresh failed, holding offline session:", rErr);
            }
          }

          // If offline or network error occurred during refresh, do not log user out
          const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
          if (isOffline || (error && error.message?.toLowerCase().includes("fetch"))) {
            console.info("[AuthContext] Network unavailable: preserving session from vault");
            if (isMounted) {
              setSession(vault);
              setLoading(false);
              return;
            }
          }
        }

        if (isMounted) {
          setSession(null);
          setLoading(false);
        }
      } catch (err) {
        console.warn("[AuthContext] initAuth exception:", err);
        const vault = getPersistentSession() || getStoredSupabaseSession();
        if (vault && isMounted) {
          setSession(vault);
        } else if (isMounted) {
          setSession(null);
        }
        if (isMounted) setLoading(false);
      }
    }

    // Watchdog fallback: Guarantee loading is NEVER stuck longer than 3.0s under any network condition
    const watchdogTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 3000);

    initAuth().finally(() => {
      clearTimeout(watchdogTimer);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY") {
        if (newSession) {
          savePersistentSession(newSession);
          setSession(newSession);
        }
        setIsPasswordRecovery(true);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_OUT") {
        clearPersistentSession();
        clearBiometricLoginCredentials();
        clearAllLocalUserSessionData(queryClient).catch(() => {});
        setSession(null);
        setLoading(false);
        return;
      }

      if (newSession) {
        savePersistentSession(newSession);
        setSession(newSession);
        setIsGuest(false);
        localStorage.removeItem("trouvaille_guest_mode");
        setLoading(false);
        return;
      }

      // If newSession is null, only preserve if vault has a valid, non-expired session
      const vault = getPersistentSession() || getStoredSupabaseSession();
      const isExpired = vault?.expires_at ? Date.now() / 1000 > vault.expires_at : false;
      if (!vault || isExpired) {
        clearPersistentSession();
        setSession(null);
        setLoading(false);
      } else {
        console.info("[AuthContext] newSession is null, preserving active session vault");
      }
    });

    const handleOnline = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session && isMounted) {
          savePersistentSession(data.session);
          setSession(data.session);
        }
      } catch {}
    };
    window.addEventListener("online", handleOnline);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener("online", handleOnline);
      urlListenerHandle?.remove();
    };
  }, []);

  const signOut = async () => {
    localStorage.removeItem(GUEST_CAPTURE_OWNER_KEY);
    if (Capacitor.getPlatform() === "ios") {
      try { await AccrualInbox.setOwner({ ownerId: null }); } catch (error) { console.error(error); }
    }
    try {
      await clearAllLocalUserSessionData(queryClient, { preserveGuestFlag: false });
    } catch (cleanErr) {
      console.warn("[AuthContext] clearAllLocalUserSessionData warning:", cleanErr);
    }
    try {
      await revenueCatService.logOut();
    } catch (rcErr) {
      console.warn("[AuthContext] revenueCatService.logOut warning:", rcErr);
    }
    await supabase.auth.signOut();
    setSession(null);
    setIsGuest(false);
    try {
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/");
        if (window.location.hash) {
          window.location.hash = "#/";
        }
      }
    } catch {}
  };

  const effectiveUser = isGuest ? GUEST_USER : (session?.user ?? null);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: effectiveUser,
        loading,
        isGuest,
        isPasswordRecovery,
        setIsPasswordRecovery,
        setSession: (s) => {
          if (s) {
            setIsGuest(false);
            localStorage.removeItem("trouvaille_guest_mode");
          }
          setSession(s);
        },
        signOut,
        continueAsGuest,
        exitGuestMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
