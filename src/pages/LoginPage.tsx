import { useState, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  User,
  Loader2,
  KeyRound,
  Check,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import {
  getBiometricLoginCredentials,
  saveBiometricLoginCredentials,
  getSecuritySettings,
  authenticateWithPin,
} from "../lib/biometricAuth";
import { triggerHaptic, triggerSuccessHaptic } from "../lib/haptics";
import {
  formatAuthError,
  getPasswordStrength,
  getShowcaseSlides,
  isValidEmail,
} from "../components/auth/loginAuthHelpers";
import { DynamicShowcaseCapsule } from "../components/auth/DynamicShowcaseCapsule";
import { VaultPinLoginModal } from "../components/auth/VaultPinLoginModal";
import { LegalModal } from "../components/legal/LegalModal";
import { cn } from "../lib/utils";

export function LoginPage() {
  const chartGradientId = useId();
  const { setSession, continueAsGuest } = useAuth();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();

  const [activeSlide, setActiveSlide] = useState(0);
  const [viewMode, setViewMode] = useState<"welcome" | "login" | "otp">("welcome");

  // OTP Verification state
  const [otpCode, setOtpCode] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<"privacy" | "terms" | "security">(
    "privacy",
  );

  // Inline email form state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState(
    () => getBiometricLoginCredentials()?.email || "",
  );
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Vault PIN Modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinVerifying, setPinVerifying] = useState(false);
  const [hasVaultPin] = useState(() => getSecuritySettings().hasPin);

  const slides = getShowcaseSlides(isIndonesian);

  // Auto-advance showcase slides every 5.5 seconds (paused when user opens form or modal)
  useEffect(() => {
    if (showEmailForm || showPinModal) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [showEmailForm, showPinModal, slides.length]);

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setLoading(true);
    setError(null);
    setMessage(null);
    triggerHaptic("medium");
    try {
      const isNative =
        typeof window !== "undefined" && Capacitor.isNativePlatform();
      const redirectUri = isNative
        ? "accrual://auth-callback"
        : typeof window !== "undefined"
          ? window.location.origin
          : undefined;

      if (isNative) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          // Listen for user closing the in-app browser sheet
          let browserListener: any = null;
          try {
            browserListener = await Browser.addListener("browserFinished", () => {
              setLoading(false);
              try { browserListener?.remove(); } catch {}
            });
          } catch {}

          // 25-second fallback timeout
          setTimeout(() => {
            setLoading(false);
            try { browserListener?.remove(); } catch {}
          }, 25000);

          await Browser.open({
            url: data.url,
            presentationStyle: "popover",
            toolbarColor: isDark ? "#09090c" : "#ffffff",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: redirectUri,
          },
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(
        err?.message ||
          (isIndonesian
            ? `Gagal masuk dengan ${provider === "apple" ? "Apple" : "Google"}.`
            : `Failed to sign in with ${provider === "apple" ? "Apple" : "Google"}.`),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    triggerHaptic("medium");
    continueAsGuest();
  };

  const handleToggleEmailForm = () => {
    triggerHaptic("light");
    setError(null);
    setMessage(null);
    setShowEmailForm((prev) => !prev);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError(
        isIndonesian
          ? "Masukkan alamat surel Anda untuk menyetel ulang kata sandi."
          : "Please enter your email address to reset password.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const resetRedirectUri =
        typeof window !== "undefined" && Capacitor.isNativePlatform()
          ? "com.syntheticae.accrual://reset-password"
          : typeof window !== "undefined"
            ? `${window.location.origin}/?type=recovery`
            : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: resetRedirectUri,
        },
      );
      if (error) throw error;
      setMessage(
        isIndonesian
          ? "Tautan pengaturan ulang kata sandi telah dikirim ke surel Anda."
          : "Password reset link sent to your email.",
      );
    } catch (err: any) {
      setError(
        err?.message ||
          (isIndonesian
            ? "Gagal mengirimkan tautan pengaturan ulang."
            : "Failed to send reset link."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (code.length !== 6) {
      setError(
        isIndonesian
          ? "Harap masukkan 6 digit kode verifikasi."
          : "Please enter the 6-digit verification code.",
      );
      return;
    }

    setOtpLoading(true);
    setError(null);
    setMessage(null);
    triggerHaptic("medium");

    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: code,
        type: "signup",
      });

      if (verifyErr) throw verifyErr;

      if (data?.session) {
        triggerSuccessHaptic();
        saveBiometricLoginCredentials(otpEmail, data.session, password);
        setSession(data.session);
        showToast(
          isIndonesian
            ? "Verifikasi berhasil! Selamat datang di Accrual."
            : "Verification successful! Welcome to Accrual.",
          "update",
        );
      }
    } catch (err: any) {
      triggerHaptic("heavy");
      setError(
        formatAuthError(err?.message, isIndonesian) ||
          (isIndonesian
            ? "Kode verifikasi tidak valid atau telah kedaluwarsa."
            : "Invalid or expired verification code."),
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0 || !otpEmail) return;
    triggerHaptic("light");
    setError(null);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email: otpEmail,
      });
      if (resendErr) throw resendErr;
      setOtpCooldown(60);
      setMessage(
        isIndonesian
          ? "Kode verifikasi baru telah dikirimkan ke surel Anda."
          : "New verification code sent to your email.",
      );
      showToast(
        isIndonesian
          ? "Kode verifikasi baru telah dikirim."
          : "New verification code sent.",
        "info",
      );
    } catch (err: any) {
      setError(
        err?.message ||
          (isIndonesian
            ? "Gagal mengirim ulang kode verifikasi."
            : "Failed to resend verification code."),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      triggerHaptic("heavy");
      showToast(
        isIndonesian
          ? "Harap masukkan alamat surel Anda."
          : "Please enter your email address.",
        "info",
      );
      return;
    }

    if (!isValidEmail(email)) {
      triggerHaptic("heavy");
      showToast(
        isIndonesian
          ? "Format surel tidak valid (contoh: nama@domain.com)."
          : "Invalid email format (e.g. name@domain.com).",
        "error",
      );
      return;
    }

    if (!password) {
      triggerHaptic("heavy");
      showToast(
        isIndonesian
          ? "Harap masukkan kata sandi Anda."
          : "Please enter your password.",
        "info",
      );
      return;
    }

    if (password.length < 6) {
      triggerHaptic("heavy");
      showToast(
        isIndonesian
          ? "Kata sandi minimal 6 karakter."
          : "Password must be at least 6 characters.",
        "error",
      );
      return;
    }

    const isSignUpMode = viewMode === "welcome";

    if (isSignUpMode) {
      if (!confirmPassword) {
        triggerHaptic("heavy");
        showToast(
          isIndonesian
            ? "Harap konfirmasi kata sandi Anda."
            : "Please confirm your password.",
          "info",
        );
        return;
      }

      if (password !== confirmPassword) {
        triggerHaptic("heavy");
        setError(
          isIndonesian
            ? "Konfirmasi kata sandi tidak cocok."
            : "Passwords do not match.",
        );
        showToast(
          isIndonesian
            ? "Konfirmasi kata sandi tidak cocok."
            : "Passwords do not match.",
          "error",
        );
        return;
      }
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUpMode) {
      const { error, data } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(formatAuthError(error.message, isIndonesian));
        showToast(formatAuthError(error.message, isIndonesian), "error");
      } else if (data?.session) {
        saveBiometricLoginCredentials(email.trim(), data.session, password);
        setSession(data.session);
      } else {
        // Transition to in-app OTP view
        setOtpEmail(email.trim());
        setOtpCode("");
        setOtpCooldown(60);
        setError(null);
        setMessage(null);
        setViewMode("otp");
        showToast(
          isIndonesian
            ? "Kode verifikasi 6-digit telah dikirimkan ke surel Anda."
            : "A 6-digit verification code has been sent to your email.",
          "info",
        );
      }
    } else {
      const { error, data } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        if (error.message?.toLowerCase().includes("email not confirmed")) {
          setOtpEmail(email.trim());
          setOtpCode("");
          setOtpCooldown(30);
          setError(null);
          setMessage(null);
          setViewMode("otp");
          showToast(
            isIndonesian
              ? "Surel Anda belum diverifikasi. Masukkan kode verifikasi 6-digit."
              : "Email not verified. Please enter your 6-digit verification code.",
            "info",
          );
          supabase.auth.resend({ type: "signup", email: email.trim() }).catch(() => {});
          setLoading(false);
          return;
        }
        setError(formatAuthError(error.message, isIndonesian));
        showToast(formatAuthError(error.message, isIndonesian), "error");
      } else if (data?.session) {
        saveBiometricLoginCredentials(email.trim(), data.session, password);
        setSession(data.session);
      }
    }
    setLoading(false);
  };

  const handlePinDigit = async (digit: string) => {
    if (pinInput.length >= 6 || pinVerifying) return;
    triggerHaptic("light");
    const nextPin = pinInput + digit;
    setPinInput(nextPin);
    setPinError(null);

    if (nextPin.length >= 4) {
      setPinVerifying(true);
      try {
        const res = await authenticateWithPin(nextPin);
        if (res.success) {
          triggerSuccessHaptic();
          if (res.session) {
            setSession(res.session);
          } else if (res.email) {
            setEmail(res.email);
            setShowPinModal(false);
            setViewMode("login");
            setShowEmailForm(true);
          } else {
            setShowPinModal(false);
          }
        } else {
          triggerHaptic("heavy");
          setPinError(
            res.error || (isIndonesian ? "PIN tidak valid." : "Invalid PIN."),
          );
          setTimeout(() => setPinInput(""), 600);
        }
      } catch (err: any) {
        triggerHaptic("heavy");
        setPinError(
          err?.message ||
            (isIndonesian
              ? "Gagal memverifikasi PIN."
              : "Failed to verify PIN."),
        );
        setTimeout(() => setPinInput(""), 600);
      } finally {
        setPinVerifying(false);
      }
    }
  };

  const handlePinDelete = () => {
    triggerHaptic("light");
    setPinInput((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  const currentSlide = slides[activeSlide] || slides[0];

  return (
    <div
      className={cn(
        "min-h-dvh w-full flex flex-col justify-between items-center relative overflow-hidden select-none transition-colors duration-500",
        isDark ? "bg-[#060608] text-white" : "bg-[#f4f4f7] text-zinc-950",
      )}
      style={{
        fontFamily: "'Urbanist', sans-serif",
        paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 8px), 14px)",
      }}
    >
      {/* ── 1. CINEMATIC AMBIENT AURORA MESH (POLISHED & BALANCED) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Soft Top-Center Luminous Caustic */}
        <div
          className={cn(
            "absolute top-[6%] left-1/2 -translate-x-1/2 w-[380px] h-[340px] rounded-full blur-[100px] transition-opacity",
            isDark ? "bg-white/[0.055]" : "bg-white opacity-85",
          )}
        />

        {/* Ambient Mid Glow */}
        <div
          className={cn(
            "absolute top-[36%] left-1/2 -translate-x-1/2 w-[520px] h-[260px] rounded-full blur-[90px] transition-opacity",
            isDark ? "bg-white/[0.035]" : "bg-slate-200/50 opacity-70",
          )}
        />

        {/* Bottom Atmospheric Vignette */}
        <div
          className={cn(
            "absolute bottom-0 inset-x-0 h-44 transition-opacity",
            isDark
              ? "bg-gradient-to-t from-[#060608] via-[#060608]/80 to-transparent"
              : "bg-gradient-to-t from-[#f4f4f7] via-[#f4f4f7]/80 to-transparent",
          )}
        />
      </div>

      {/* ── 2. POLISHED CELESTIAL HORIZON ARC (CRADLES SHOWCASE & LIQUID SHEET) ── */}
      <div
        className={cn(
          "absolute top-[37%] sm:top-[39%] left-1/2 -translate-x-1/2 w-[180vw] max-w-[960px] aspect-square rounded-[50%] pointer-events-none border-t transition-all duration-700",
          isDark ? "border-white/[0.18]" : "border-black/[0.07]",
        )}
        style={{
          background: isDark
            ? "radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.015) 38%, transparent 68%)"
            : "radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.85) 0%, rgba(230, 233, 242, 0.45) 32%, transparent 65%)",
          boxShadow: isDark
            ? "0 -10px 30px -10px rgba(0, 0, 0, 0.45)"
            : "0 -12px 28px -10px rgba(20, 25, 45, 0.04)",
        }}
      />

      {/* ── 3. TOP SECTION: SHOWCASE STAGE & PROPORTIONAL TITLE ── */}
      <div className="flex-1 w-full max-w-sm px-6 relative z-10 flex flex-col justify-center items-center text-center py-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-1 mb-2.5"
          >
            <h1 className="text-[25px] sm:text-[27px] font-bold tracking-tight leading-tight">
              {currentSlide.title}
            </h1>
            <p
              className={cn(
                "text-[12.5px] font-medium leading-relaxed max-w-[290px] mx-auto",
                isDark ? "text-zinc-400" : "text-zinc-600",
              )}
            >
              {currentSlide.tagline}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Dynamic Showcase Capsule with Organic Glass Reflection */}
        <div className="w-full flex justify-center items-center min-h-[160px] my-1">
          <DynamicShowcaseCapsule
            currentSlide={currentSlide}
            isDark={isDark}
            isIndonesian={isIndonesian}
            chartGradientId={chartGradientId}
            onNext={() => {
              triggerHaptic("light");
              setActiveSlide((prev) => (prev + 1) % slides.length);
            }}
            onPrev={() => {
              triggerHaptic("light");
              setActiveSlide(
                (prev) => (prev - 1 + slides.length) % slides.length,
              );
            }}
          />
        </div>

        {/* Apple Tactile Segment Pagination Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setActiveSlide(idx);
              }}
              aria-label={`Slide ${idx + 1}`}
              className="p-1 cursor-pointer"
            >
              <div
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  idx === activeSlide
                    ? isDark
                      ? "w-4 bg-white"
                      : "w-4 bg-zinc-950"
                    : isDark
                      ? "w-1 bg-white/25 hover:bg-white/50"
                      : "w-1 bg-black/15 hover:bg-black/30",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. MATURE LIQUID GLASS SHEET (APPLE VISIONOS / IOS 18 SPEC) ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "w-full max-w-[450px] rounded-t-[34px] sm:rounded-t-[38px] px-6 pt-5 pb-6 relative z-20 overflow-hidden border-t border-x transition-all",
          isDark
            ? "bg-gradient-to-b from-white/[0.09] via-white/[0.04] to-[#0c0c0e]/95 border-white/[0.14]"
            : "bg-gradient-to-b from-white/85 via-white/65 to-white/90 border-white/80",
        )}
        style={{
          backdropFilter: "blur(40px) saturate(190%)",
          WebkitBackdropFilter: "blur(40px) saturate(190%)",
          boxShadow: isDark
            ? "0 -10px 30px -10px rgba(0, 0, 0, 0.45)"
            : "0 -12px 28px -10px rgba(25, 30, 50, 0.05)",
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom, 0px) + 14px), 22px)",
        }}
      >
        {/* Specular Highlight Rim at the top edge */}
        <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent pointer-events-none" />

        <AnimatePresence mode="wait">
          {/* ========================================================== */}
          {/* VIEW MODE A: WELCOME / REGISTER                           */}
          {/* ========================================================== */}
          {/* ========================================================== */}
          {/* VIEW MODE C: IN-APP 6-DIGIT EMAIL OTP VERIFICATION       */}
          {/* ========================================================== */}
          {viewMode === "otp" ? (
            <motion.div
              key="view-otp"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full flex flex-col"
            >
              <div className="text-center space-y-1 mb-3 px-1">
                <div
                  className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center mb-2 border"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Mail size={18} strokeWidth={1.8} />
                </div>
                <h2 className="text-[19px] sm:text-[20px] font-bold tracking-tight">
                  {isIndonesian ? "Verifikasi Surel Anda" : "Verify Your Email"}
                </h2>
                <p
                  className={cn(
                    "text-[12px] font-medium leading-relaxed max-w-[300px] mx-auto",
                    isDark ? "text-zinc-400" : "text-zinc-600",
                  )}
                >
                  {isIndonesian
                    ? "Masukkan 6 digit kode verifikasi yang dikirim ke "
                    : "Enter the 6-digit verification code sent to "}
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {otpEmail}
                  </span>
                </p>
              </div>

              {/* 6-Box Luxury Monochrome OTP Input */}
              <div className="relative my-4 w-full">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const digit = otpCode[idx] || "";
                    const isCurrent = idx === otpCode.length;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "w-11 h-13 rounded-xl border flex items-center justify-center text-[20px] font-mono font-bold transition-all select-none",
                          isDark ? "bg-white/[0.04]" : "bg-black/[0.03]",
                          isCurrent
                            ? "border-[var(--text-primary)] ring-2 ring-[var(--text-primary)]/20 shadow-sm"
                            : digit
                              ? "border-[var(--text-primary)]/40 text-[var(--text-primary)]"
                              : "border-[var(--glass-border)] text-[var(--text-tertiary)]",
                        )}
                      >
                        {digit ? (
                          <span>{digit}</span>
                        ) : isCurrent ? (
                          <span className="w-0.5 h-5 bg-[var(--text-primary)] animate-pulse" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                    setOtpCode(val);
                    if (error) setError(null);
                    if (val.length === 6) {
                      handleVerifyOtp(val);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-transparent"
                  autoFocus
                  aria-label={isIndonesian ? "Kode OTP 6-digit" : "6-digit OTP code"}
                />
              </div>

              {/* Error & Message */}
              {error && (
                <p className="text-[12px] text-rose-400 text-center font-medium mb-3">
                  {error}
                </p>
              )}
              {message && (
                <p className="text-[12px] text-zinc-300 text-center font-medium mb-3">
                  {message}
                </p>
              )}

              {/* Actions */}
              <div className="space-y-2.5 w-full">
                <button
                  type="button"
                  disabled={otpLoading || otpCode.length !== 6}
                  onClick={() => handleVerifyOtp()}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm select-none",
                    otpLoading || otpCode.length !== 6
                      ? "opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-400"
                      : isDark
                        ? "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
                        : "bg-zinc-950 text-white hover:bg-zinc-900 active:scale-[0.98]",
                  )}
                >
                  {otpLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>
                      <Check size={14} strokeWidth={2.5} />
                      <span>
                        {isIndonesian ? "Verifikasi & Masuk" : "Verify & Sign In"}
                      </span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between px-1 pt-1 text-[11.5px]">
                  <button
                    type="button"
                    disabled={otpCooldown > 0}
                    onClick={handleResendOtp}
                    className={cn(
                      "font-medium transition-colors cursor-pointer",
                      otpCooldown > 0
                        ? "text-[var(--text-tertiary)] cursor-not-allowed"
                        : "text-[var(--text-primary)] hover:underline",
                    )}
                  >
                    {otpCooldown > 0
                      ? isIndonesian
                        ? `Kirim ulang (${otpCooldown}s)`
                        : `Resend (${otpCooldown}s)`
                      : isIndonesian
                        ? "Kirim Ulang Kode"
                        : "Resend Code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setViewMode("welcome");
                      setShowEmailForm(true);
                      setError(null);
                      setMessage(null);
                    }}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {isIndonesian ? "Ubah Alamat Surel" : "Change Email"}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : viewMode === "welcome" ? (
            <motion.div
              key="view-welcome"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full flex flex-col"
            >
              {/* Header */}
              <div className="text-center space-y-1 mb-4 px-1">
                <h2 className="text-[19px] sm:text-[20px] font-bold tracking-tight">
                  {isIndonesian
                    ? "Selamat Datang di Accrual"
                    : "Welcome to Accrual"}
                </h2>
                <p
                  className={cn(
                    "text-[12px] font-medium leading-relaxed max-w-[300px] mx-auto",
                    isDark ? "text-zinc-400" : "text-zinc-600",
                  )}
                >
                  {isIndonesian
                    ? "Pantau arus kas harian dan bangun kejelasan aset dengan presisi tinggi."
                    : "Track everyday cashflow and build lasting wealth clarity with effortless precision."}
                </p>
              </div>

              {/* Action Area */}
              <div className="space-y-2 w-full">
                {showEmailForm ? (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    onSubmit={handleSubmit}
                    className="space-y-2 overflow-hidden"
                  >
                    {/* Email Input */}
                    <div className="relative">
                      <Mail
                        size={15}
                        className={cn(
                          "absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.75]",
                          isDark ? "text-zinc-500" : "text-zinc-400",
                        )}
                      />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        onBlur={() => setEmailTouched(true)}
                        placeholder="your.email@domain.com"
                        aria-label={
                          isIndonesian ? "Alamat email" : "Email address"
                        }
                        required
                        disabled={loading}
                        className={cn(
                          "w-full pl-9 pr-3.5 py-2.5 rounded-xl text-[16px] border-0 border-none outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 appearance-none transition-all",
                          isDark
                            ? "bg-white/[0.05] focus:bg-white/[0.08] text-white placeholder:text-zinc-500"
                            : "bg-black/[0.04] focus:bg-black/[0.06] text-zinc-950 placeholder:text-zinc-400",
                        )}
                      />
                    </div>
                    {emailTouched && email.trim().length > 0 && !isValidEmail(email) && (
                      <p
                        className={cn(
                          "text-[10.5px] font-medium px-1 -mt-0.5",
                          isDark ? "text-zinc-400" : "text-zinc-500",
                        )}
                      >
                        {isIndonesian
                          ? "Format surel belum valid (contoh: nama@domain.com)"
                          : "Invalid email format (e.g. name@domain.com)"}
                      </p>
                    )}

                    {/* Password Input */}
                    <div className="relative">
                      <Lock
                        size={15}
                        className={cn(
                          "absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.75]",
                          isDark ? "text-zinc-500" : "text-zinc-400",
                        )}
                      />
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          isIndonesian
                            ? "Kata sandi (min 6 karakter)"
                            : "Password (min 6 characters)"
                        }
                        aria-label={
                          isIndonesian
                            ? "Kata sandi akun"
                            : "Account password"
                        }
                        required
                        minLength={6}
                        disabled={loading}
                        className={cn(
                          "w-full pl-9 pr-9 py-2.5 rounded-xl text-[16px] border-0 border-none outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 appearance-none transition-all",
                          isDark
                            ? "bg-white/[0.05] focus:bg-white/[0.08] text-white placeholder:text-zinc-500"
                            : "bg-black/[0.04] focus:bg-black/[0.06] text-zinc-950 placeholder:text-zinc-400",
                        )}
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword
                            ? isIndonesian
                              ? "Sembunyikan kata sandi"
                              : "Hide password"
                            : isIndonesian
                              ? "Tampilkan kata sandi"
                              : "Show password"
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowPassword(!showPassword)}
                        className={cn(
                          "absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer select-none",
                          isDark
                            ? "text-zinc-500 hover:text-zinc-300"
                            : "text-zinc-400 hover:text-zinc-700",
                        )}
                      >
                        {showPassword ? (
                          <EyeOff size={15} strokeWidth={1.75} />
                        ) : (
                          <Eye size={15} strokeWidth={1.75} />
                        )}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {password.length > 0 && (
                      <div className="px-1 space-y-1 pt-0.5">
                        <div
                          className={cn(
                            "w-full h-1 rounded-full overflow-hidden flex gap-1",
                            isDark ? "bg-white/[0.08]" : "bg-black/[0.06]",
                          )}
                        >
                          {[1, 2, 3, 4].map((s) => {
                            const strength = getPasswordStrength(
                              password,
                              isIndonesian,
                            );
                            const active = strength.score >= s;
                            return (
                              <div
                                key={s}
                                className={cn(
                                  "h-full flex-1 transition-all rounded-full",
                                  active
                                    ? isDark
                                      ? "bg-white"
                                      : "bg-zinc-950"
                                    : "bg-transparent",
                                )}
                                style={{
                                  opacity: active
                                    ? s === 1
                                      ? 0.35
                                      : s === 2
                                        ? 0.6
                                        : s === 3
                                          ? 0.85
                                          : 1
                                    : 0,
                                }}
                              />
                            );
                          })}
                        </div>
                        <div
                          className={cn(
                            "flex items-center justify-between text-[9.5px]",
                            isDark ? "text-zinc-500" : "text-zinc-500",
                          )}
                        >
                          <span>
                            {isIndonesian
                              ? "Kekuatan Kata Sandi"
                              : "Password Strength"}
                          </span>
                          <span
                            className={
                              isDark
                                ? "text-zinc-300 font-semibold"
                                : "text-zinc-800 font-semibold"
                            }
                          >
                            {getPasswordStrength(password, isIndonesian).label}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Confirm Password Input */}
                    <div className="relative">
                      <Lock
                        size={15}
                        className={cn(
                          "absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.75]",
                          isDark ? "text-zinc-500" : "text-zinc-400",
                        )}
                      />
                      <input
                        id="register-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder={
                          isIndonesian
                            ? "Konfirmasi kata sandi"
                            : "Confirm password"
                        }
                        aria-label={
                          isIndonesian
                            ? "Konfirmasi kata sandi"
                            : "Confirm password"
                        }
                        required
                        minLength={6}
                        disabled={loading}
                        className={cn(
                          "w-full pl-9 pr-9 py-2.5 rounded-xl text-[16px] border-0 border-none outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 appearance-none transition-all",
                          isDark
                            ? "bg-white/[0.05] focus:bg-white/[0.08] text-white placeholder:text-zinc-500"
                            : "bg-black/[0.04] focus:bg-black/[0.06] text-zinc-950 placeholder:text-zinc-400",
                        )}
                      />
                      <button
                        type="button"
                        aria-label={
                          showConfirmPassword
                            ? isIndonesian
                              ? "Sembunyikan konfirmasi kata sandi"
                              : "Hide confirm password"
                            : isIndonesian
                              ? "Tampilkan konfirmasi kata sandi"
                              : "Show confirm password"
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className={cn(
                          "absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer select-none",
                          isDark
                            ? "text-zinc-500 hover:text-zinc-300"
                            : "text-zinc-400 hover:text-zinc-700",
                        )}
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={15} strokeWidth={1.75} />
                        ) : (
                          <Eye size={15} strokeWidth={1.75} />
                        )}
                      </button>
                    </div>

                    {/* Confirm Password Inline Feedback */}
                    {confirmPassword.length > 0 && (
                      <div className="flex items-center gap-1.5 px-1 -mt-0.5">
                        {confirmPassword === password ? (
                          <>
                            <Check
                              size={12}
                              strokeWidth={2.2}
                              className={isDark ? "text-zinc-300" : "text-zinc-700"}
                            />
                            <span
                              className={cn(
                                "text-[10.5px] font-medium",
                                isDark ? "text-zinc-300" : "text-zinc-700",
                              )}
                            >
                              {isIndonesian
                                ? "Kata sandi cocok"
                                : "Passwords match"}
                            </span>
                          </>
                        ) : (
                          <span
                            className={cn(
                              "text-[10.5px] font-medium",
                              isDark ? "text-zinc-400" : "text-zinc-500",
                            )}
                          >
                            {isIndonesian
                              ? "Kata sandi belum cocok"
                              : "Passwords do not match yet"}
                          </span>
                        )}
                      </div>
                    )}

                    {error && (
                      <p
                        className={cn(
                          "text-[11.5px] font-medium px-1",
                          isDark ? "text-zinc-300" : "text-zinc-700",
                        )}
                      >
                        {error}
                      </p>
                    )}
                    {message && (
                      <p
                        className={cn(
                          "text-[11.5px] font-medium px-1",
                          isDark ? "text-white" : "text-zinc-900",
                        )}
                      >
                        {message}
                      </p>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      onMouseDown={(e) => e.preventDefault()}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] transition-all cursor-pointer select-none mt-1 border-0 border-none shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
                        isDark
                          ? "bg-white text-zinc-950 hover:bg-zinc-100"
                          : "bg-zinc-950 text-white hover:bg-zinc-900",
                      )}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 size={15} className="animate-spin" />
                          <span>
                            {isIndonesian
                              ? "Membuat Akun..."
                              : "Creating Account..."}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span>
                            {isIndonesian ? "Buat Akun" : "Create Account"}
                          </span>
                          <ArrowRight size={14} strokeWidth={2.2} />
                        </>
                      )}
                    </button>

                    <div
                      className={cn(
                        "flex items-center justify-between px-1 pt-1 text-[11px] font-medium",
                        isDark ? "text-zinc-400" : "text-zinc-500",
                      )}
                    >
                      <button
                        type="button"
                        disabled={loading}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setShowEmailForm(false);
                          setError(null);
                          setMessage(null);
                          setConfirmPassword("");
                          setShowConfirmPassword(false);
                          setEmailTouched(false);
                        }}
                        className={
                          isDark ? "hover:text-white" : "hover:text-zinc-900"
                        }
                      >
                        {isIndonesian ? "Batal" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setViewMode("login");
                          setShowEmailForm(true);
                          setError(null);
                          setMessage(null);
                          setConfirmPassword("");
                          setShowConfirmPassword(false);
                          setEmailTouched(false);
                        }}
                        className={
                          isDark
                            ? "text-white hover:underline"
                            : "text-zinc-950 hover:underline"
                        }
                      >
                        {isIndonesian
                          ? "Sudah punya akun? Masuk"
                          : "Already have an account? Sign in"}
                      </button>
                    </div>
                  </motion.form>
                ) : (
                  <>
                    {/* 1. Continue with Email */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleToggleEmailForm}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-4 rounded-xl font-bold text-[13px] transition-all cursor-pointer border-0 border-none shadow-[0_2px_8px_rgba(0,0,0,0.18)] select-none",
                        isDark
                          ? "bg-white text-zinc-950 hover:bg-zinc-100"
                          : "bg-zinc-950 text-white hover:bg-zinc-900",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Mail size={16} strokeWidth={2} />
                        <span>
                          {isIndonesian
                            ? "Lanjutkan dengan Surel"
                            : "Continue with Email"}
                        </span>
                      </div>
                      <ArrowRight
                        size={14}
                        strokeWidth={2.2}
                        className="opacity-60"
                      />
                    </button>

                    {/* 1. Continue with Apple (Prioritized on iOS per Apple HIG / Guideline 4.8) */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleOAuthLogin("apple")}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-4 rounded-xl font-semibold text-[13px] transition-all cursor-pointer border select-none",
                        isDark
                          ? "bg-white text-zinc-950 hover:bg-zinc-100 border-white/20 shadow-[0_2px_12px_rgba(255,255,255,0.06)]"
                          : "bg-zinc-950 text-white hover:bg-zinc-800 border-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.12)]",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 170 170" fill="currentColor">
                          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.7-11.64-13.98-5.77-8.8-10.15-18.9-13.13-30.31-2.98-11.41-4.47-22.38-4.47-32.9 0-16.14 4.09-29.6 12.28-40.39 8.19-10.79 18.57-16.32 31.14-16.59 5.56 0 11.36 1.48 17.4 4.43 6.04 2.95 10.13 4.49 12.27 4.62 1.95 0 6.33-1.6 13.14-4.8 6.81-3.2 12.56-4.66 17.26-4.38 13.06.66 23.36 5.48 30.9 14.46-11.41 6.89-17.01 16.5-16.79 28.84.22 9.68 3.96 17.81 11.22 24.38 7.27 6.57 15.86 10.37 25.79 11.39-2.06 6.07-4.4 12.11-7.02 18.12zm-33.15-104.9c0-6.73 2.45-13.16 7.35-19.29 4.9-6.13 11-10.02 18.29-11.68.87 6.95-.76 13.56-4.9 19.82-4.13 6.26-10.33 10.16-18.6 11.71-.55-.18-1.12-.34-1.7-.49-.29-.02-.44-.07-.44-.07z" />
                        </svg>
                        <span>
                          {isIndonesian
                            ? "Lanjutkan dengan Apple"
                            : "Continue with Apple"}
                        </span>
                      </div>
                      <ArrowRight
                        size={14}
                        strokeWidth={2.2}
                        className="opacity-70"
                      />
                    </button>

                    {/* 2. Continue with Google */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleOAuthLogin("google")}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-4 rounded-xl font-semibold text-[13px] transition-all cursor-pointer border select-none",
                        isDark
                          ? "bg-white/[0.04] hover:bg-white/[0.07] border-white/[0.08] text-white"
                          : "bg-black/[0.03] hover:bg-black/[0.05] border-black/[0.06] text-zinc-950 shadow-[0_1px_3px_rgba(0,0,0,0.03)]",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>
                          {isIndonesian
                            ? "Lanjutkan dengan Google"
                            : "Continue with Google"}
                        </span>
                      </div>
                      <ArrowRight
                        size={14}
                        strokeWidth={2}
                        className="opacity-40"
                      />
                    </button>

                    {/* 3. Continue without account */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleContinueAsGuest}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-4 rounded-xl font-medium text-[13px] transition-all cursor-pointer border select-none",
                        isDark
                          ? "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] text-zinc-300"
                          : "bg-black/[0.02] hover:bg-black/[0.04] border-black/[0.05] text-zinc-700",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <User
                          size={16}
                          strokeWidth={1.75}
                          className="opacity-70"
                        />
                        <span>
                          {isIndonesian
                            ? "Lanjutkan tanpa akun"
                            : "Continue without an account"}
                        </span>
                      </div>
                      <ArrowRight
                        size={14}
                        strokeWidth={2}
                        className="opacity-40"
                      />
                    </button>

                    <p
                      className={cn(
                        "text-[10px] text-center pt-0.5",
                        isDark ? "text-zinc-500" : "text-zinc-500",
                      )}
                    >
                      {isIndonesian
                        ? "Privat & hanya di perangkat · Tanpa pencadangan cloud"
                        : "Private & on-device only · No cloud backup"}
                    </p>
                  </>
                )}
              </div>

              {!showEmailForm && (
                /* Minimal Divider */
                <div className="flex items-center gap-3 my-3">
                  <div
                    className={cn(
                      "h-[1px] flex-1",
                      isDark ? "bg-white/[0.08]" : "bg-black/[0.06]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10.5px]",
                      isDark ? "text-zinc-500" : "text-zinc-400",
                    )}
                  >
                    {isIndonesian ? "atau" : "or"}
                  </span>
                  <div
                    className={cn(
                      "h-[1px] flex-1",
                      isDark ? "bg-white/[0.08]" : "bg-black/[0.06]",
                    )}
                  />
                </div>
              )}

              {/* Footer Switch */}
              <div className="text-center">
                {!showEmailForm && (
                  <p
                    className={cn(
                      "text-[11.5px]",
                      isDark ? "text-zinc-400" : "text-zinc-600",
                    )}
                  >
                    {isIndonesian
                      ? "Sudah memiliki akun? "
                      : "Already have an account? "}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setViewMode("login");
                        setShowEmailForm(false);
                        setError(null);
                        setMessage(null);
                        setConfirmPassword("");
                        setShowConfirmPassword(false);
                        setEmailTouched(false);
                      }}
                      className={cn(
                        "font-semibold hover:underline cursor-pointer",
                        isDark ? "text-white" : "text-zinc-950",
                      )}
                    >
                      {isIndonesian ? "Masuk" : "Sign in"}
                    </button>
                  </p>
                )}

                {/* Legal & Privacy Policy Link */}
                <p
                  className={cn(
                    "text-[10px] leading-relaxed mt-2.5",
                    isDark ? "text-zinc-500" : "text-zinc-500",
                  )}
                >
                  {isIndonesian
                    ? "Dengan melanjutkan, Anda menyetujui "
                    : "By continuing, you agree to our "}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setLegalTab("terms");
                      setShowLegalModal(true);
                    }}
                    className={cn(
                      "underline underline-offset-2 transition-colors cursor-pointer",
                      isDark ? "hover:text-zinc-300" : "hover:text-zinc-800",
                    )}
                  >
                    {isIndonesian ? "Ketentuan Layanan" : "Terms of Service"}
                  </button>
                  {isIndonesian ? " & " : " & "}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setLegalTab("privacy");
                      setShowLegalModal(true);
                    }}
                    className={cn(
                      "underline underline-offset-2 transition-colors cursor-pointer",
                      isDark ? "hover:text-zinc-300" : "hover:text-zinc-800",
                    )}
                  >
                    {isIndonesian ? "Kebijakan Privasi" : "Privacy Policy"}
                  </button>
                </p>
              </div>
            </motion.div>
          ) : (
            /* ========================================================== */
            /* VIEW MODE B: LOG IN                                        */
            /* ========================================================== */
            <motion.div
              key="view-login"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full flex flex-col"
            >
              {/* Header */}
              <div className="text-center space-y-1 mb-4 px-1">
                <h2 className="text-[19px] sm:text-[20px] font-bold tracking-tight">
                  {isIndonesian ? "Selamat Datang Kembali" : "Welcome Back"}
                </h2>
                <p
                  className={cn(
                    "text-[12px] font-medium leading-relaxed max-w-[300px] mx-auto",
                    isDark ? "text-zinc-400" : "text-zinc-600",
                  )}
                >
                  {isIndonesian
                    ? "Masuk untuk mengakses brankas aset dan space tersinkronisasi milik Anda."
                    : "Sign in to access your synchronized wealth vault and spaces."}
                </p>
              </div>

              {/* Action Area */}
              <div className="space-y-2 w-full">
                {showEmailForm ? (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    onSubmit={handleSubmit}
                    className="space-y-2 overflow-hidden"
                  >
                    {/* Email Input */}
                    <div className="relative">
                      <Mail
                        size={15}
                        className={cn(
                          "absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.75]",
                          isDark ? "text-zinc-500" : "text-zinc-400",
                        )}
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        onBlur={() => setEmailTouched(true)}
                        placeholder="your.email@domain.com"
                        required
                        disabled={loading}
                        className={cn(
                          "w-full pl-9 pr-3.5 py-2.5 rounded-xl text-[16px] border-0 border-none outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 appearance-none transition-all",
                          isDark
                            ? "bg-white/[0.05] focus:bg-white/[0.08] text-white placeholder:text-zinc-500"
                            : "bg-black/[0.04] focus:bg-black/[0.06] text-zinc-950 placeholder:text-zinc-400",
                        )}
                      />
                    </div>
                    {emailTouched && email.trim().length > 0 && !isValidEmail(email) && (
                      <p
                        className={cn(
                          "text-[10.5px] font-medium px-1 -mt-0.5",
                          isDark ? "text-zinc-400" : "text-zinc-500",
                        )}
                      >
                        {isIndonesian
                          ? "Format surel belum valid (contoh: nama@domain.com)"
                          : "Invalid email format (e.g. name@domain.com)"}
                      </p>
                    )}

                    {/* Password Input */}
                    <div className="relative">
                      <Lock
                        size={15}
                        className={cn(
                          "absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.75]",
                          isDark ? "text-zinc-500" : "text-zinc-400",
                        )}
                      />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isIndonesian ? "Kata sandi" : "Password"}
                        required
                        disabled={loading}
                        className={cn(
                          "w-full pl-9 pr-9 py-2.5 rounded-xl text-[16px] border-0 border-none outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 appearance-none transition-all",
                          isDark
                            ? "bg-white/[0.05] focus:bg-white/[0.08] text-white placeholder:text-zinc-500"
                            : "bg-black/[0.04] focus:bg-black/[0.06] text-zinc-950 placeholder:text-zinc-400",
                        )}
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowPassword(!showPassword)}
                        className={cn(
                          "absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer select-none",
                          isDark
                            ? "text-zinc-500 hover:text-zinc-300"
                            : "text-zinc-400 hover:text-zinc-700",
                        )}
                      >
                        {showPassword ? (
                          <EyeOff size={15} strokeWidth={1.75} />
                        ) : (
                          <Eye size={15} strokeWidth={1.75} />
                        )}
                      </button>
                    </div>

                    {error && (
                      <p
                        className={cn(
                          "text-[11.5px] font-medium px-1",
                          isDark ? "text-zinc-300" : "text-zinc-700",
                        )}
                      >
                        {error}
                      </p>
                    )}
                    {message && (
                      <p
                        className={cn(
                          "text-[11.5px] font-medium px-1",
                          isDark ? "text-white" : "text-zinc-900",
                        )}
                      >
                        {message}
                      </p>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      onMouseDown={(e) => e.preventDefault()}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] transition-all cursor-pointer select-none mt-1 border-0 border-none shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
                        isDark
                          ? "bg-white text-zinc-950 hover:bg-zinc-100"
                          : "bg-zinc-950 text-white hover:bg-zinc-900",
                      )}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 size={15} className="animate-spin" />
                          <span>
                            {isIndonesian ? "Sedang Masuk..." : "Signing In..."}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span>
                            {isIndonesian
                              ? "Masuk dengan Surel"
                              : "Sign In with Email"}
                          </span>
                          <ArrowRight size={14} strokeWidth={2.2} />
                        </>
                      )}
                    </button>

                    <div
                      className={cn(
                        "flex items-center justify-between px-1 pt-1 text-[11px] font-medium",
                        isDark ? "text-zinc-400" : "text-zinc-500",
                      )}
                    >
                      <button
                        type="button"
                        disabled={loading}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setShowEmailForm(false);
                          setError(null);
                          setMessage(null);
                          setEmailTouched(false);
                        }}
                        className={
                          isDark ? "hover:text-white" : "hover:text-zinc-900"
                        }
                      >
                        {isIndonesian ? "Batal" : "Cancel"}
                      </button>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleForgotPassword}
                          className={cn(
                            "hover:underline",
                            isDark ? "text-zinc-400" : "text-zinc-600",
                          )}
                        >
                          {isIndonesian ? "Lupa kata sandi?" : "Forgot password?"}
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setViewMode("welcome");
                            setShowEmailForm(true);
                            setError(null);
                            setMessage(null);
                            setConfirmPassword("");
                            setShowConfirmPassword(false);
                            setEmailTouched(false);
                          }}
                          className={
                            isDark
                              ? "text-white hover:underline"
                              : "text-zinc-950 hover:underline"
                          }
                        >
                          {isIndonesian ? "Daftar" : "Sign up"}
                        </button>
                      </div>
                    </div>
                  </motion.form>
                ) : (
                  <>
                    {/* 1. Unlock with Security PIN (If Enrolled) */}
                    {hasVaultPin && (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setPinInput("");
                          setPinError(null);
                          setShowPinModal(true);
                          triggerHaptic("light");
                        }}
                        className={cn(
                          "w-full flex items-center justify-between py-3 px-4 rounded-xl font-bold text-[13px] transition-all cursor-pointer border-0 border-none shadow-[0_2px_8px_rgba(0,0,0,0.18)] select-none",
                          isDark
                            ? "bg-white text-zinc-950 hover:bg-zinc-100"
                            : "bg-zinc-950 text-white hover:bg-zinc-900",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <KeyRound size={16} strokeWidth={2} />
                          <span>
                            {isIndonesian
                              ? "Buka dengan PIN Brankas"
                              : "Unlock with Vault PIN"}
                          </span>
                        </div>
                        <ArrowRight
                          size={14}
                          strokeWidth={2.2}
                          className="opacity-60"
                        />
                      </button>
                    )}

                    {/* 2. Log in with Email */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleToggleEmailForm}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-4 rounded-xl font-bold text-[13px] transition-all cursor-pointer select-none",
                        !hasVaultPin
                          ? isDark
                            ? "bg-white text-zinc-950 hover:bg-zinc-100 shadow-[0_2px_8px_rgba(0,0,0,0.18)] border-0 border-none"
                            : "bg-zinc-950 text-white hover:bg-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.18)] border-0 border-none"
                          : isDark
                            ? "bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-white"
                            : "bg-black/[0.03] hover:bg-black/[0.05] border border-black/[0.06] text-zinc-950",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Mail size={16} strokeWidth={2} />
                        <span>
                          {isIndonesian
                            ? "Masuk dengan Surel"
                            : "Log in with Email"}
                        </span>
                      </div>
                      <ArrowRight
                        size={14}
                        strokeWidth={2.2}
                        className="opacity-60"
                      />
                    </button>

                    {/* 2. Log in with Apple (Prioritized on iOS per Apple HIG / Guideline 4.8) */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleOAuthLogin("apple")}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-4 rounded-xl font-semibold text-[13px] transition-all cursor-pointer border select-none",
                        isDark
                          ? "bg-white text-zinc-950 hover:bg-zinc-100 border-white/20 shadow-[0_2px_12px_rgba(255,255,255,0.06)]"
                          : "bg-zinc-950 text-white hover:bg-zinc-800 border-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.12)]",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 170 170" fill="currentColor">
                          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.7-11.64-13.98-5.77-8.8-10.15-18.9-13.13-30.31-2.98-11.41-4.47-22.38-4.47-32.9 0-16.14 4.09-29.6 12.28-40.39 8.19-10.79 18.57-16.32 31.14-16.59 5.56 0 11.36 1.48 17.4 4.43 6.04 2.95 10.13 4.49 12.27 4.62 1.95 0 6.33-1.6 13.14-4.8 6.81-3.2 12.56-4.66 17.26-4.38 13.06.66 23.36 5.48 30.9 14.46-11.41 6.89-17.01 16.5-16.79 28.84.22 9.68 3.96 17.81 11.22 24.38 7.27 6.57 15.86 10.37 25.79 11.39-2.06 6.07-4.4 12.11-7.02 18.12zm-33.15-104.9c0-6.73 2.45-13.16 7.35-19.29 4.9-6.13 11-10.02 18.29-11.68.87 6.95-.76 13.56-4.9 19.82-4.13 6.26-10.33 10.16-18.6 11.71-.55-.18-1.12-.34-1.7-.49-.29-.02-.44-.07-.44-.07z" />
                        </svg>
                        <span>
                          {isIndonesian
                            ? "Masuk dengan Apple"
                            : "Log in with Apple"}
                        </span>
                      </div>
                      <ArrowRight
                        size={14}
                        strokeWidth={2.2}
                        className="opacity-70"
                      />
                    </button>

                    {/* 3. Log in with Google */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleOAuthLogin("google")}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-4 rounded-xl font-semibold text-[13px] transition-all cursor-pointer border select-none",
                        isDark
                          ? "bg-white/[0.04] hover:bg-white/[0.07] border-white/[0.08] text-white"
                          : "bg-black/[0.03] hover:bg-black/[0.05] border-black/[0.06] text-zinc-950 shadow-[0_1px_3px_rgba(0,0,0,0.03)]",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>
                          {isIndonesian
                            ? "Masuk dengan Google"
                            : "Log in with Google"}
                        </span>
                      </div>
                      <ArrowRight
                        size={14}
                        strokeWidth={2}
                        className="opacity-40"
                      />
                    </button>
                  </>
                )}
              </div>

              {!showEmailForm && (
                /* Minimal Divider */
                <div className="flex items-center gap-3 my-3">
                  <div
                    className={cn(
                      "h-[1px] flex-1",
                      isDark ? "bg-white/[0.08]" : "bg-black/[0.06]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10.5px]",
                      isDark ? "text-zinc-500" : "text-zinc-400",
                    )}
                  >
                    {isIndonesian ? "atau" : "or"}
                  </span>
                  <div
                    className={cn(
                      "h-[1px] flex-1",
                      isDark ? "bg-white/[0.08]" : "bg-black/[0.06]",
                    )}
                  />
                </div>
              )}

              {/* Footer Switch */}
              <div className="text-center">
                {!showEmailForm && (
                  <p
                    className={cn(
                      "text-[11.5px]",
                      isDark ? "text-zinc-400" : "text-zinc-600",
                    )}
                  >
                    {isIndonesian
                      ? "Belum memiliki akun? "
                      : "Don't have an account? "}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setViewMode("welcome");
                        setShowEmailForm(false);
                        setError(null);
                        setMessage(null);
                        setConfirmPassword("");
                        setShowConfirmPassword(false);
                        setEmailTouched(false);
                      }}
                      className={cn(
                        "font-semibold hover:underline cursor-pointer",
                        isDark ? "text-white" : "text-zinc-950",
                      )}
                    >
                      {isIndonesian ? "Daftar" : "Sign up"}
                    </button>
                  </p>
                )}

                {/* Legal & Privacy Policy Link */}
                <p
                  className={cn(
                    "text-[10px] leading-relaxed mt-2.5",
                    isDark ? "text-zinc-500" : "text-zinc-500",
                  )}
                >
                  {isIndonesian
                    ? "Dengan melanjutkan, Anda menyetujui "
                    : "By continuing, you agree to our "}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setLegalTab("terms");
                      setShowLegalModal(true);
                    }}
                    className={cn(
                      "underline underline-offset-2 transition-colors cursor-pointer",
                      isDark ? "hover:text-zinc-300" : "hover:text-zinc-800",
                    )}
                  >
                    {isIndonesian ? "Ketentuan Layanan" : "Terms of Service"}
                  </button>
                  {isIndonesian ? " & " : " & "}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setLegalTab("privacy");
                      setShowLegalModal(true);
                    }}
                    className={cn(
                      "underline underline-offset-2 transition-colors cursor-pointer",
                      isDark ? "hover:text-zinc-300" : "hover:text-zinc-800",
                    )}
                  >
                    {isIndonesian ? "Kebijakan Privasi" : "Privacy Policy"}
                  </button>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── 5. VAULT PIN MODAL ── */}
      <VaultPinLoginModal
        isOpen={showPinModal}
        isDark={isDark}
        isIndonesian={isIndonesian}
        pinInput={pinInput}
        pinError={pinError}
        pinVerifying={pinVerifying}
        onClose={() => {
          setShowPinModal(false);
          setPinInput("");
          setPinError(null);
        }}
        onClear={() => setPinInput("")}
        onDigit={handlePinDigit}
        onDelete={handlePinDelete}
      />

      {/* ── 6. LEGAL & PRIVACY POLICY MODAL ── */}
      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialTab={legalTab}
      />
    </div>
  );
}
