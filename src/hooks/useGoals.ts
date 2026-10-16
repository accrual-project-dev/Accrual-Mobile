import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth, GUEST_USER_ID } from "../contexts/AuthContext";

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  icon: string;
  color: string;
  targetDate?: string;
}

export const LEGACY_GOALS_STORAGE_KEY = "trouvaille_financial_goals_v2";
export const GOALS_STORAGE_KEY = "trouvaille_financial_goals_v2";
export const GOALS_INITIALIZED_KEY = "trouvaille_goals_initialized_v2";
export const GOALS_UPDATED_EVENT = "trouvaille_goals_updated";

export const getGoalsStorageKey = (userId: string = GUEST_USER_ID) =>
  `trouvaille_financial_goals_${userId}`;

export const getGoalsInitializedKey = (userId: string = GUEST_USER_ID) =>
  `trouvaille_goals_initialized_${userId}`;

export function getActiveUserTenantId(): string {
  try {
    if (typeof window === "undefined" || !window.localStorage) return GUEST_USER_ID;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user?.id) return parsed.user.id;
        }
      }
    }
  } catch {}
  return GUEST_USER_ID;
}

export function deductGoalFromStorage(
  goalIdOrTag: string,
  amount: number,
  userId?: string
) {
  try {
    const tenantId = userId || getActiveUserTenantId();
    const key = getGoalsStorageKey(tenantId);
    const raw = localStorage.getItem(key) || localStorage.getItem(LEGACY_GOALS_STORAGE_KEY);
    if (!raw) return;
    const goals: Goal[] = JSON.parse(raw);
    if (!Array.isArray(goals)) return;

    let matched = false;
    const cleanTag = goalIdOrTag.trim();
    const updated = goals.map((g) => {
      const matchesId = g.id === cleanTag || cleanTag.includes(g.id);
      const matchesTitle =
        cleanTag.toLowerCase().includes(g.title.toLowerCase()) ||
        g.title.toLowerCase().includes(cleanTag.toLowerCase());
      if (!matched && (matchesId || matchesTitle)) {
        matched = true;
        return {
          ...g,
          currentAmount: Math.max(0, (g.currentAmount || 0) - amount),
        };
      }
      return g;
    });

    if (matched) {
      localStorage.setItem(key, JSON.stringify(updated));
      if (tenantId === GUEST_USER_ID) {
        localStorage.setItem(LEGACY_GOALS_STORAGE_KEY, JSON.stringify(updated));
      }
      window.dispatchEvent(new CustomEvent(GOALS_UPDATED_EVENT));
    }
  } catch (err) {
    console.warn("[deductGoalFromStorage] Error:", err);
  }
}

export function addGoalToStorage(
  goalIdOrTag: string,
  amount: number,
  userId?: string
) {
  try {
    const tenantId = userId || getActiveUserTenantId();
    const key = getGoalsStorageKey(tenantId);
    const raw = localStorage.getItem(key) || localStorage.getItem(LEGACY_GOALS_STORAGE_KEY);
    if (!raw) return;
    const goals: Goal[] = JSON.parse(raw);
    if (!Array.isArray(goals)) return;

    let matched = false;
    const cleanTag = goalIdOrTag.trim();
    const updated = goals.map((g) => {
      const matchesId = g.id === cleanTag || cleanTag.includes(g.id);
      const matchesTitle =
        cleanTag.toLowerCase().includes(g.title.toLowerCase()) ||
        g.title.toLowerCase().includes(cleanTag.toLowerCase());
      if (!matched && (matchesId || matchesTitle)) {
        matched = true;
        return {
          ...g,
          currentAmount: Math.min(g.targetAmount, (g.currentAmount || 0) + amount),
        };
      }
      return g;
    });

    if (matched) {
      localStorage.setItem(key, JSON.stringify(updated));
      if (tenantId === GUEST_USER_ID) {
        localStorage.setItem(LEGACY_GOALS_STORAGE_KEY, JSON.stringify(updated));
      }
      window.dispatchEvent(new CustomEvent(GOALS_UPDATED_EVENT));
    }
  } catch (err) {
    console.warn("[addGoalToStorage] Error:", err);
  }
}

export function useGoals() {
  const { user } = useAuth();
  const userId = user?.id || GUEST_USER_ID;
  const storageKey = useMemo(() => getGoalsStorageKey(userId), [userId]);
  const initKey = useMemo(() => getGoalsInitializedKey(userId), [userId]);

  const readStoredGoals = useCallback((): Goal[] => {
    try {
      const stored =
        localStorage.getItem(storageKey) ||
        (userId === GUEST_USER_ID
          ? localStorage.getItem(LEGACY_GOALS_STORAGE_KEY)
          : null);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  }, [storageKey, userId]);

  const [goals, setGoals] = useState<Goal[]>(readStoredGoals);

  // Sync goals when active user tenant changes
  useEffect(() => {
    setGoals(readStoredGoals());
  }, [readStoredGoals]);

  const persistGoals = useCallback(
    (nextGoals: Goal[]) => {
      setGoals(nextGoals);
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextGoals));
        localStorage.setItem(initKey, "true");
        if (userId === GUEST_USER_ID) {
          localStorage.setItem(LEGACY_GOALS_STORAGE_KEY, JSON.stringify(nextGoals));
          localStorage.setItem(GOALS_INITIALIZED_KEY, "true");
        }
        window.dispatchEvent(new CustomEvent(GOALS_UPDATED_EVENT));
      } catch (e) {
        console.warn("Failed to persist goals:", e);
      }
    },
    [storageKey, initKey, userId]
  );

  // Listen to multi-window storage sync and session teardown events
  useEffect(() => {
    const handleSync = () => {
      setGoals(readStoredGoals());
    };
    const handleTeardown = () => {
      setGoals([]);
    };
    window.addEventListener(GOALS_UPDATED_EVENT, handleSync);
    window.addEventListener("storage", handleSync);
    window.addEventListener("trouvaille_session_teardown", handleTeardown);
    return () => {
      window.removeEventListener(GOALS_UPDATED_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("trouvaille_session_teardown", handleTeardown);
    };
  }, [readStoredGoals]);

  const addGoal = (goal: Omit<Goal, "id">) => {
    const newGoal: Goal = { ...goal, id: Math.random().toString(36).slice(2, 9) };
    persistGoals([newGoal, ...goals]);
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    const next = goals.map((g) => (g.id === id ? { ...g, ...updates } : g));
    persistGoals(next);
  };

  const deleteGoal = (id: string) => {
    const next = goals.filter((g) => g.id !== id);
    persistGoals(next);
  };

  const depositToGoal = (id: string, amount: number) => {
    const next = goals.map((g) => {
      if (g.id === id) {
        return {
          ...g,
          currentAmount: Math.min(g.targetAmount, (g.currentAmount || 0) + amount),
        };
      }
      return g;
    });
    persistGoals(next);
  };

  return {
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    depositToGoal,
  };
}

