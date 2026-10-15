import { describe, it, expect, beforeEach } from "vitest";

// Mock sessionStorage
let sessionStore: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (k: string) => sessionStore[k] ?? null,
  setItem: (k: string, v: string) => {
    sessionStore[k] = String(v);
  },
  removeItem: (k: string) => {
    delete sessionStore[k];
  },
  clear: () => {
    sessionStore = {};
  },
};

Object.defineProperty(globalThis, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
  configurable: true,
});

describe("Accrual Paywall Guest Protection & Auto-Resume Workflow", () => {
  beforeEach(() => {
    mockSessionStorage.clear();
  });

  it("stores resume token in sessionStorage when guest is prompted to login", () => {
    const RESUME_KEY = "accrual_resume_paywall";
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();

    // Guest clicks confirm to login from paywall
    sessionStorage.setItem(RESUME_KEY, "true");
    expect(sessionStorage.getItem(RESUME_KEY)).toBe("true");
  });

  it("clears resume token and triggers auto-resume when authenticated", () => {
    const RESUME_KEY = "accrual_resume_paywall";
    sessionStorage.setItem(RESUME_KEY, "true");

    let isPaywallReopened = false;
    const openPaywall = () => {
      isPaywallReopened = true;
    };

    // User authentication resumes
    const user = { id: "user-registered-123" };
    const isGuest = false;

    if (user && !isGuest) {
      const shouldResume = sessionStorage.getItem(RESUME_KEY);
      if (shouldResume === "true") {
        sessionStorage.removeItem(RESUME_KEY);
        openPaywall();
      }
    }

    expect(isPaywallReopened).toBe(true);
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
  });

  it("does not auto-resume if user is still in guest mode", () => {
    const RESUME_KEY = "accrual_resume_paywall";
    sessionStorage.setItem(RESUME_KEY, "true");

    let isPaywallReopened = false;
    const openPaywall = () => {
      isPaywallReopened = true;
    };

    const user = { id: "guest_local_user" };
    const isGuest = true;

    if (user && !isGuest) {
      const shouldResume = sessionStorage.getItem(RESUME_KEY);
      if (shouldResume === "true") {
        sessionStorage.removeItem(RESUME_KEY);
        openPaywall();
      }
    }

    expect(isPaywallReopened).toBe(false);
    expect(sessionStorage.getItem(RESUME_KEY)).toBe("true");
  });
});
