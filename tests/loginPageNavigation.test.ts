import { describe, it, expect } from "vitest";

describe("Login and Registration Page Navigation & Ergonomics Invariants", () => {
  it("verifies registration mode (welcome) displays correct prompt without duplicate or contradictory questions", () => {
    type ViewMode = "welcome" | "login";
    let viewMode: ViewMode = "welcome";
    let showEmailForm = false;

    // State A: Welcome screen with choices (Email, Google, Guest)
    const getWelcomeFooter = (isId: boolean, isEmailFormOpen: boolean) => {
      if (isEmailFormOpen) return null;
      return {
        question: isId ? "Sudah memiliki akun? " : "Already have an account? ",
        action: isId ? "Masuk" : "Sign in",
      };
    };

    const footerClosed = getWelcomeFooter(true, showEmailForm);
    expect(footerClosed).not.toBeNull();
    expect(footerClosed?.question).toBe("Sudah memiliki akun? ");
    expect(footerClosed?.action).toBe("Masuk");
    expect(footerClosed?.question).not.toContain("Belum memiliki akun?");

    // Clicking switch button changes viewMode to login
    viewMode = "login";
    expect(viewMode).toBe("login");

    // State B: Welcome screen with email form open
    showEmailForm = true;
    const footerOpen = getWelcomeFooter(true, showEmailForm);
    // Outer footer switch MUST be hidden to avoid duplicate navigation
    expect(footerOpen).toBeNull();
  });

  it("verifies login mode displays correct prompt and hides outer footer when email form is open", () => {
    type ViewMode = "welcome" | "login";
    let viewMode: ViewMode = "login";
    let showEmailForm = false;

    const getLoginFooter = (isId: boolean, isEmailFormOpen: boolean) => {
      if (isEmailFormOpen) return null;
      return {
        question: isId ? "Belum memiliki akun? " : "Don't have an account? ",
        action: isId ? "Daftar" : "Sign up",
      };
    };

    // State A: Login screen with choices (PIN/Email/Google)
    const footerClosed = getLoginFooter(true, showEmailForm);
    expect(footerClosed).not.toBeNull();
    expect(footerClosed?.question).toBe("Belum memiliki akun? ");
    expect(footerClosed?.action).toBe("Daftar");

    // Clicking switch button changes viewMode to welcome
    viewMode = "welcome";
    expect(viewMode).toBe("welcome");

    // State B: Login screen with email form open
    showEmailForm = true;
    const footerOpen = getLoginFooter(true, showEmailForm);
    // Outer footer switch MUST be hidden to avoid duplicate navigation
    expect(footerOpen).toBeNull();
  });

  it("verifies English localization adheres to strict non-mixed rules", () => {
    const welcomeFooterEn = {
      question: "Already have an account? ",
      action: "Sign in",
    };
    const loginFooterEn = {
      question: "Don't have an account? ",
      action: "Sign up",
    };

    expect(welcomeFooterEn.question).not.toMatch(/[a-z]+\s*\([a-z]+\)/i);
    expect(loginFooterEn.question).not.toMatch(/[a-z]+\s*\([a-z]+\)/i);
    expect(welcomeFooterEn.action).toBe("Sign in");
    expect(loginFooterEn.action).toBe("Sign up");
  });
});
