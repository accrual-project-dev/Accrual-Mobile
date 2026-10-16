import { useState, useEffect } from "react";
import { useAuth, GUEST_USER_ID } from "../contexts/AuthContext";

export function useBudgetTarget() {
  const { user } = useAuth();
  const userId = user?.id || GUEST_USER_ID;
  const targetKey = `trouvaille_budget_target_${userId}`;
  const periodKey = `trouvaille_budget_period_start_${userId}`;

  const [budgetTarget, setBudgetTarget] = useState<number>(() => {
    try {
      const saved =
        localStorage.getItem(targetKey) ||
        localStorage.getItem("trouvaille_budget_target");
      return saved ? Number(saved) : 5000000;
    } catch {
      return 5000000;
    }
  });

  const [budgetPeriodStart, setBudgetPeriodStart] = useState<number>(() => {
    try {
      const saved =
        localStorage.getItem(periodKey) ||
        localStorage.getItem("trouvaille_budget_period_start");
      const num = saved ? Number(saved) : 1;
      return num >= 1 && num <= 28 ? num : 1;
    } catch {
      return 1;
    }
  });

  // Re-sync when active user tenant changes
  useEffect(() => {
    try {
      const savedTarget =
        localStorage.getItem(targetKey) ||
        localStorage.getItem("trouvaille_budget_target");
      if (savedTarget) {
        setBudgetTarget(Number(savedTarget));
      }
      const savedPeriod =
        localStorage.getItem(periodKey) ||
        localStorage.getItem("trouvaille_budget_period_start");
      if (savedPeriod) {
        const num = Number(savedPeriod);
        if (num >= 1 && num <= 28) {
          setBudgetPeriodStart(num);
        }
      }
    } catch {}
  }, [targetKey, periodKey]);

  useEffect(() => {
    try {
      localStorage.setItem(targetKey, budgetTarget.toString());
      if (userId === GUEST_USER_ID) {
        localStorage.setItem("trouvaille_budget_target", budgetTarget.toString());
      }
    } catch {}
  }, [budgetTarget, targetKey, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(periodKey, budgetPeriodStart.toString());
      if (userId === GUEST_USER_ID) {
        localStorage.setItem(
          "trouvaille_budget_period_start",
          budgetPeriodStart.toString()
        );
      }
    } catch {}
  }, [budgetPeriodStart, periodKey, userId]);

  // Reset to default on session teardown
  useEffect(() => {
    const handleTeardown = () => {
      setBudgetTarget(5000000);
      setBudgetPeriodStart(1);
    };
    window.addEventListener("trouvaille_session_teardown", handleTeardown);
    return () => {
      window.removeEventListener("trouvaille_session_teardown", handleTeardown);
    };
  }, []);

  return { budgetTarget, setBudgetTarget, budgetPeriodStart, setBudgetPeriodStart };
}

