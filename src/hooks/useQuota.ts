// ======================================================================
// ACCRUAL HYBRID QUOTA & FEATURE GATING ENGINE
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// - Local storage caching for offline instant response
// - Supabase user_monthly_quotas sync with atomic increment RPC
// ======================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { useAuth, GUEST_USER_ID } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useLanguage } from "../contexts/LanguageContext";
import { supabase } from "../lib/supabase";
import {
  MONETIZATION_LIMITS,
  PRO_WIDGET_IDS,
} from "../types/subscription";

export function useQuota() {
  const { user } = useAuth();
  const { isPremium, openPaywall } = useSubscription();
  const { isIndonesian } = useLanguage();

  const userTenantId = user?.id || GUEST_USER_ID;
  const currentPeriod = useMemo(() => format(new Date(), "yyyy-MM"), []);
  const storageKey = useMemo(
    () => `accrual_ocr_quota_${userTenantId}_${currentPeriod}`,
    [userTenantId, currentPeriod]
  );

  // 1. Initialize count from local cache immediately (with backward-compatible legacy fallback)
  const [ocrCount, setOcrCount] = useState<number>(() => {
    try {
      const stored =
        localStorage.getItem(storageKey) ||
        localStorage.getItem(`accrual_ocr_quota_${currentPeriod}`);
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  // Re-sync local state when active tenant key changes
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(storageKey) ||
        (userTenantId === GUEST_USER_ID
          ? localStorage.getItem(`accrual_ocr_quota_${currentPeriod}`)
          : null);
      setOcrCount(stored ? parseInt(stored, 10) || 0 : 0);
    } catch {
      setOcrCount(0);
    }
  }, [storageKey, userTenantId, currentPeriod]);

  // Reset on session teardown event
  useEffect(() => {
    const handleTeardown = () => {
      setOcrCount(0);
    };
    window.addEventListener("trouvaille_session_teardown", handleTeardown);
    return () => {
      window.removeEventListener("trouvaille_session_teardown", handleTeardown);
    };
  }, []);

  // 2. Sync with Supabase on mount / auth change if logged in
  useEffect(() => {
    if (!user || user.id === GUEST_USER_ID) return;

    let isMounted = true;
    async function syncRemoteQuota() {
      try {
        const { data, error } = await supabase
          .from("user_monthly_quotas")
          .select("ocr_import_count")
          .eq("user_id", user!.id)
          .eq("billing_period", currentPeriod)
          .maybeSingle();

        if (error) {
          // Table might not exist or network unavailable
          return;
        }

        if (data && isMounted) {
          const remoteCount = data.ocr_import_count || 0;
          setOcrCount((prevLocal) => {
            const resolved = Math.max(prevLocal, remoteCount);
            try {
              localStorage.setItem(storageKey, resolved.toString());
            } catch {}
            return resolved;
          });
        }
      } catch (err) {
        console.warn("[useQuota] Remote quota sync skipped:", err);
      }
    }

    syncRemoteQuota();
    return () => {
      isMounted = false;
    };
  }, [user, currentPeriod, storageKey]);

  const ocrLimit = useMemo(() => {
    return isPremium ? Infinity : MONETIZATION_LIMITS.FREE_OCR_MONTHLY_LIMIT;
  }, [isPremium]);

  const ocrRemaining = useMemo(() => {
    if (isPremium) return Infinity;
    return Math.max(0, MONETIZATION_LIMITS.FREE_OCR_MONTHLY_LIMIT - ocrCount);
  }, [isPremium, ocrCount]);

  const isOcrLimitReached = useMemo(() => {
    if (isPremium) return false;
    return ocrCount >= MONETIZATION_LIMITS.FREE_OCR_MONTHLY_LIMIT;
  }, [isPremium, ocrCount]);

  // Atomically record an OCR usage increment
  const recordOcrUsage = useCallback(async (): Promise<number> => {
    const nextLocalCount = ocrCount + 1;
    setOcrCount(nextLocalCount);
    try {
      localStorage.setItem(storageKey, nextLocalCount.toString());
    } catch {}

    // Increment in Supabase via RPC if logged in
    if (user && user.id !== GUEST_USER_ID) {
      try {
        const { data, error } = await supabase.rpc("increment_monthly_ocr_usage", {
          p_user_id: user.id,
          p_period: currentPeriod,
        });
        if (!error && typeof data === "number") {
          setOcrCount(data);
          try {
            localStorage.setItem(storageKey, data.toString());
          } catch {}
          return data;
        }
      } catch (rpcErr) {
        console.warn("[useQuota] Supabase RPC increment fallback to local:", rpcErr);
      }
    }

    return nextLocalCount;
  }, [ocrCount, storageKey, user, currentPeriod]);

  // Prompt paywall if OCR limit reached
  const checkOcrLimitAndPrompt = useCallback((): boolean => {
    if (isOcrLimitReached) {
      openPaywall({
        feature: "ocr_quota",
        title: isIndonesian
          ? "Batas Pemindaian Mutasi Tercapai"
          : "Statement OCR Limit Reached",
        description: isIndonesian
          ? `Akun standar memiliki kuota ${MONETIZATION_LIMITS.FREE_OCR_MONTHLY_LIMIT}x pemindaian per bulan. Berlangganan Accrual Pro untuk pemindaian tanpa batas.`
          : `Standard accounts include ${MONETIZATION_LIMITS.FREE_OCR_MONTHLY_LIMIT} scans per month. Upgrade to Accrual Pro for unlimited processing.`,
      });
      return false;
    }
    return true;
  }, [isOcrLimitReached, openPaywall, isIndonesian]);

  // Check if a widget is exclusively for Pro
  const isWidgetProOnly = useCallback((widgetId: string): boolean => {
    return (PRO_WIDGET_IDS as readonly string[]).includes(widgetId);
  }, []);

  // Check if user can add more widgets to home
  const canAddHomeWidget = useCallback(
    (currentActiveCount: number): boolean => {
      if (isPremium) return true;
      return currentActiveCount < MONETIZATION_LIMITS.FREE_DASHBOARD_MAX_SLOTS;
    },
    [isPremium]
  );

  // Validate widget activation and prompt paywall if restricted
  const checkWidgetAndPrompt = useCallback(
    (_widgetId: string, _currentActiveCount: number): boolean => {
      // Home dashboard widgets are open to all users without inline locks.
      // Pro monetization is triggered on deep diagnostic drill-downs (e.g. Capital Health audit),
      // multi-ledger space creation, and luxury financial report exports.
      return true;
    },
    []
  );

  // Check ledger creation limit
  const canCreateLedger = useCallback(
    (currentLedgerCount: number): boolean => {
      if (isPremium) return true;
      return currentLedgerCount < MONETIZATION_LIMITS.FREE_MAX_LEDGERS;
    },
    [isPremium]
  );

  const checkLedgerAndPrompt = useCallback(
    (currentLedgerCount: number): boolean => {
      if (!canCreateLedger(currentLedgerCount)) {
        openPaywall({
          feature: "multi_ledger",
          title: isIndonesian
            ? "Batas Space Tercapai"
            : "Space Limit Reached",
          description: isIndonesian
            ? `Akun standar dapat mengelola hingga ${MONETIZATION_LIMITS.FREE_MAX_LEDGERS} space finansial (Space Pribadi & 1 Space Tambahan). Beralih ke Accrual Pro untuk membuat space tanpa batas.`
            : `Standard accounts can manage up to ${MONETIZATION_LIMITS.FREE_MAX_LEDGERS} financial spaces (Personal Space & 1 Additional Space). Upgrade to Accrual Pro for unlimited spaces.`,
        });
        return false;
      }
      return true;
    },
    [canCreateLedger, openPaywall, isIndonesian]
  );

  return {
    ocrCount,
    ocrLimit,
    ocrRemaining,
    isOcrLimitReached,
    recordOcrUsage,
    checkOcrLimitAndPrompt,
    isWidgetProOnly,
    canAddHomeWidget,
    checkWidgetAndPrompt,
    canCreateLedger,
    checkLedgerAndPrompt,
  };
}
