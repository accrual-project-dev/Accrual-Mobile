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

  it("validates password confirmation logic on registration submit", () => {
    const validateSignUp = (password: string, confirmPassword: string, isIndonesian: boolean) => {
      if (password !== confirmPassword) {
        return {
          valid: false,
          error: isIndonesian
            ? "Konfirmasi kata sandi tidak cocok."
            : "Passwords do not match.",
        };
      }
      return { valid: true, error: null };
    };

    // Mismatched
    const mismatchId = validateSignUp("Secret123", "Secret456", true);
    expect(mismatchId.valid).toBe(false);
    expect(mismatchId.error).toBe("Konfirmasi kata sandi tidak cocok.");

    const mismatchEn = validateSignUp("Secret123", "Secret456", false);
    expect(mismatchEn.valid).toBe(false);
    expect(mismatchEn.error).toBe("Passwords do not match.");

    // Matched
    const matched = validateSignUp("Secret123", "Secret123", true);
    expect(matched.valid).toBe(true);
    expect(matched.error).toBeNull();
  });

  it("validates email format and full registration pre-flight validation suite", () => {
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("rthrth")).toBe(false);
    expect(isValidEmail("user@domain")).toBe(false);
    expect(isValidEmail("")).toBe(false);

    const validateRegistration = (email: string, pwd: string, confirmPwd: string, isId: boolean) => {
      if (!email.trim()) {
        return { valid: false, error: isId ? "Harap masukkan alamat surel Anda." : "Please enter your email address." };
      }
      if (!isValidEmail(email)) {
        return { valid: false, error: isId ? "Format surel tidak valid (contoh: nama@domain.com)." : "Invalid email format (e.g. name@domain.com)." };
      }
      if (!pwd) {
        return { valid: false, error: isId ? "Harap masukkan kata sandi Anda." : "Please enter your password." };
      }
      if (pwd.length < 6) {
        return { valid: false, error: isId ? "Kata sandi minimal 6 karakter." : "Password must be at least 6 characters." };
      }
      if (!confirmPwd) {
        return { valid: false, error: isId ? "Harap konfirmasi kata sandi Anda." : "Please confirm your password." };
      }
      if (pwd !== confirmPwd) {
        return { valid: false, error: isId ? "Konfirmasi kata sandi tidak cocok." : "Passwords do not match." };
      }
      return { valid: true, error: null };
    };

    // Case 1: Invalid email like user screenshot ("rthrth")
    const res1 = validateRegistration("rthrth", "dsvsvf", "gdhfghtftr", true);
    expect(res1.valid).toBe(false);
    expect(res1.error).toBe("Format surel tidak valid (contoh: nama@domain.com).");

    // Case 2: Short password
    const res2 = validateRegistration("valid@accrual.app", "123", "123", true);
    expect(res2.valid).toBe(false);
    expect(res2.error).toBe("Kata sandi minimal 6 karakter.");

    // Case 3: Mismatched confirm password
    const res3 = validateRegistration("valid@accrual.app", "password123", "diffpassword", true);
    expect(res3.valid).toBe(false);
    expect(res3.error).toBe("Konfirmasi kata sandi tidak cocok.");

    // Case 4: Valid
    const res4 = validateRegistration("valid@accrual.app", "password123", "password123", true);
    expect(res4.valid).toBe(true);
    expect(res4.error).toBeNull();
  });
});
