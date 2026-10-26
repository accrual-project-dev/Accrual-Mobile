import { useState, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Check,
  ChevronLeft,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { SignInWithApple, type SignInWithAppleResponse } from "@capacitor-community/apple-sign-in";
import { OAuthSession } from "../lib/oauthSession";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import {
  getBiometricLoginCredentials,
  saveBiometricLoginCredentials,
  savePersistentSession,
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
  const [viewMode, setViewMode] = useState<"landing" | "register" | "login" | "otp" | "reset_password">("landing");

  // OTP Verification state
  const [otpCode, setOtpCode] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // In-App Password Reset state
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setInterval(() => {
      setResetCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resetCooldown]);

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

  // Email form state
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(
    () => getBiometricLoginCredentials()?.email || "",
  );
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Vault PIN Modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinVerifying, setPinVerifying] = useState(false);

  const slides = getShowcaseSlides(isIndonesian);

  // Auto-advance showcase slides every 5.5 seconds (paused when user opens form or modal)
  useEffect(() => {
    if (viewMode !== "landing" || showPinModal) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [viewMode, showPinModal, slides.length]);

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setLoading(true);
    setError(null);
    setMessage(null);
    triggerHaptic("medium");
    try {
      const isNative =
        typeof window !== "undefined" && Capacitor.isNativePlatform();

      // 1. Native Sign in with Apple (iOS only): 100% In-App Face ID / Passcode sheet, ZERO browser
      if (provider === "apple" && isNative && Capacitor.getPlatform() === "ios") {
        try {
          const result: SignInWithAppleResponse = await SignInWithApple.authorize({
            clientId: "com.syntheticae.accrual",
            redirectURI: "https://iqjcmqkgrfmopznrfikx.supabase.co/auth/v1/callback",
            scopes: "email name",
          });

          const identityToken = result.response?.identityToken;
          if (!identityToken) {
            throw new Error(
              isIndonesian
                ? "Tidak menerima token autentikasi dari Apple."
                : "No identity token returned from Apple Sign-In."
            );
          }

          const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
            provider: "apple",
            token: identityToken,
          });

          if (authError) throw authError;

          if (authData?.session) {
            savePersistentSession(authData.session);
            setSession(authData.session);
            triggerSuccessHaptic();
          }
          return;
        } catch (appleErr: any) {
          // Detect user cancellation (ASAuthorizationError code 1001 or "canceled")
          const isCancel =
            appleErr?.message?.toLowerCase().includes("cancel") ||
            appleErr?.message?.includes("1001") ||
            appleErr?.code === 1001 ||
            appleErr?.code === "1001";

          if (isCancel) {
            // User intentionally dismissed the Apple bottom sheet - no error banner
            return;
          }
          throw appleErr;
        }
      }

      // 2. Native iOS ASWebAuthenticationSession (Google on iOS)
      // Uses Apple's system modal: zero Safari address bar/tabs, auto-dismisses on callback
      if (isNative && Capacitor.getPlatform() === "ios") {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: "accrual://auth-callback",
            skipBrowserRedirect: true,
            queryParams: {
              prompt: "select_account",
              access_type: "offline",
            },
          },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("Gagal membuat sesi autentikasi.");

        try {
          const sessionRes = await OAuthSession.startSession({
            url: data.url,
            callbackScheme: "accrual",
          });

          if (sessionRes?.url) {
            const callbackUrl = sessionRes.url;
            let queryParams = new URLSearchParams();
            let hashParams = new URLSearchParams();
            if (callbackUrl.includes("?")) {
              const qPart = callbackUrl.split("?")[1].split("#")[0];
              queryParams = new URLSearchParams(qPart);
            }
            if (callbackUrl.includes("#")) {
              const hPart = callbackUrl.split("#")[1];
              hashParams = new URLSearchParams(hPart);
            }

            const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
            const code = queryParams.get("code") || hashParams.get("code");

            if (accessToken && refreshToken) {
              const { data: authData, error: sessionErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionErr) throw sessionErr;
              if (authData?.session) {
                savePersistentSession(authData.session);
                setSession(authData.session);
                triggerSuccessHaptic();
              }
            } else if (code) {
              const { data: authData, error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
              if (codeErr) throw codeErr;
              if (authData?.session) {
                savePersistentSession(authData.session);
                setSession(authData.session);
                triggerSuccessHaptic();
              }
            }
          }
          return;
        } catch (oauthErr: any) {
          const isCancelled =
            oauthErr?.code === "CANCELLED" ||
            oauthErr?.message?.toLowerCase().includes("cancel") ||
            oauthErr?.message?.toLowerCase().includes("batal");
          if (isCancelled) {
            return;
          }
          throw oauthErr;
        }
      }

      // 3. Fallback OAuth flow (Android / Web)
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
            queryParams: {
              prompt: "select_account",
              access_type: "offline",
            },
          },
        });
        if (error) throw error;
        if (data?.url) {
          let browserListener: any = null;
          try {
            browserListener = await Browser.addListener("browserFinished", () => {
              setLoading(false);
              try { browserListener?.remove(); } catch {}
            });
          } catch {}

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

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      triggerHaptic("heavy");
      setError(
        isIndonesian
          ? "Masukkan alamat surel Anda untuk menyetel ulang kata sandi."
          : "Please enter your email address to reset password.",
      );
      showToast(
        isIndonesian
          ? "Harap masukkan alamat surel Anda."
          : "Please enter your email address.",
        "info",
      );
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: "accrual://reset-password",
        },
      );
      if (error) throw error;
      setResetEmail(email.trim());
      setResetOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetCooldown(60);
      setViewMode("reset_password");
      showToast(
        isIndonesian
          ? "Kode keamanan 6-digit telah dikirimkan ke surel Anda."
          : "A 6-digit security code has been sent to your email.",
        "info",
      );
    } catch (err: any) {
      setError(
        formatAuthError(err?.message, isIndonesian) ||
          (isIndonesian
            ? "Gagal mengirimkan kode pengaturan ulang kata sandi."
            : "Failed to send reset code."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePasswordReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = resetOtp.trim();
    if (code.length !== 6) {
      setError(
        isIndonesian
          ? "Harap masukkan 6 digit kode keamanan."
          : "Please enter the 6-digit security code.",
      );
      return;
    }
    if (newPassword.length < 6) {
      setError(
        isIndonesian
          ? "Kata sandi baru minimal 6 karakter."
          : "New password must be at least 6 characters.",
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(
        isIndonesian
          ? "Konfirmasi kata sandi tidak cocok."
          : "Password confirmation does not match.",
      );
      return;
    }

    setResetLoading(true);
    setError(null);
    setMessage(null);
    triggerHaptic("medium");

    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: resetEmail.trim(),
        token: code,
        type: "recovery",
      });
      if (verifyErr) throw verifyErr;

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) throw updateErr;

      if (data?.session) {
        saveBiometricLoginCredentials(resetEmail.trim(), data.session, newPassword);
        setSession(data.session);
        triggerSuccessHaptic();
        showToast(
          isIndonesian
            ? "Kata sandi berhasil diperbarui! Selamat datang kembali."
            : "Password updated successfully! Welcome back.",
          "update",
        );
      } else {
        const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
          email: resetEmail.trim(),
          password: newPassword,
        });
        if (signErr) throw signErr;
        if (signData?.session) {
          saveBiometricLoginCredentials(resetEmail.trim(), signData.session, newPassword);
          setSession(signData.session);
          triggerSuccessHaptic();
          showToast(
            isIndonesian
              ? "Kata sandi berhasil diperbarui! Selamat datang kembali."
              : "Password updated successfully! Welcome back.",
            "update",
          );
        }
      }
    } catch (err: any) {
      triggerHaptic("heavy");
      setError(
        formatAuthError(err?.message, isIndonesian) ||
          (isIndonesian
            ? "Gagal mengatur ulang kata sandi. Pastikan kode verifikasi benar."
            : "Failed to reset password. Please check your verification code."),
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (resetCooldown > 0 || !resetEmail) return;
    triggerHaptic("light");
    setError(null);
    try {
      const { error: resendErr } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim(),
        { redirectTo: "accrual://reset-password" },
      );
      if (resendErr) throw resendErr;
      setResetCooldown(60);
      showToast(
        isIndonesian
          ? "Kode keamanan baru telah dikirimkan ke surel Anda."
          : "New security code sent to your email.",
        "info",
      );
    } catch (err: any) {
      setError(
        err?.message ||
          (isIndonesian ? "Gagal mengirim ulang kode." : "Failed to resend code."),
      );
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

    const isSignUpMode = viewMode === "register";

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
        paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 16px), 22px)",
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
          "absolute top-[46%] sm:top-[48%] left-1/2 -translate-x-1/2 w-[180vw] max-w-[960px] aspect-square rounded-[50%] pointer-events-none border-t transition-all duration-700",
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
      <div className="flex-1 w-full max-w-[390px] px-5 relative z-10 flex flex-col justify-center items-center text-center py-2 min-h-0">
        {/* Official High-Resolution Transparent Brandmark Logo */}
        <div className="pt-1 pb-3 sm:pb-3.5 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Accrual Logo"
            className="h-9 sm:h-9.5 w-auto object-contain select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_2px_12px_rgba(255,255,255,0.12)]"
            draggable={false}
          />
        </div>

        {/* Dynamic Carousel Title & Subtitle */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-1 mb-3"
          >
            <h1 className="text-[24px] sm:text-[26px] font-bold tracking-tight leading-tight">
              {currentSlide.title}
            </h1>
            <p
              className={cn(
                "text-[12px] font-medium leading-relaxed max-w-[290px] mx-auto",
                isDark ? "text-zinc-400" : "text-zinc-600",
              )}
            >
              {currentSlide.tagline}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Dynamic Showcase Capsule with Organic Glass Reflection */}
        <div className="w-full flex justify-center items-center min-h-[195px] my-1">
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
        <div className="flex items-center justify-center gap-1.5 mt-2.5 sm:mt-3 mb-0.5">
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
          "w-full max-w-[450px] rounded-t-[32px] sm:rounded-t-[36px] px-6 pt-5 sm:pt-6 relative z-20 overflow-hidden border-t border-x transition-all",
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
            "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 34px)",
        }}
      >
        {/* Specular Highlight Rim at the top edge */}
        <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent pointer-events-none" />

                <AnimatePresence mode="wait">
          {/* ========================================================== */}
          {/* 1. VIEW MODE: OTP VERIFICATION                            */}
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
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setError(null);
                    setMessage(null);
                    setViewMode("register");
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer -ml-1",
                    isDark ? "hover:bg-white/[0.08] text-zinc-300" : "hover:bg-black/[0.06] text-zinc-700",
                  )}
                  aria-label={isIndonesian ? "Kembali" : "Back"}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[17px] font-bold tracking-tight truncate">
                    {isIndonesian ? "Verifikasi Surel Anda" : "Verify Your Email"}
                  </h2>
                  <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                    {isIndonesian
                      ? "Masukkan 6 digit kode yang dikirim ke "
                      : "Enter 6-digit code sent to "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {otpEmail}
                    </span>
                  </p>
                </div>
              </div>

              {/* 6-Box Luxury Monochrome OTP Input */}
              <div className="relative my-3 w-full">
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
                <p className="text-[12px] text-rose-400 text-center font-medium mb-2.5">
                  {error}
                </p>
              )}
              {message && (
                <p className="text-[12px] text-zinc-300 text-center font-medium mb-2.5">
                  {message}
                </p>
              )}

              {/* Actions */}
              <div className="space-y-2 w-full">
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

                <div className="flex items-center justify-between px-1 pt-0.5 text-[11.5px]">
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
                      setViewMode("register");
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
          ) : viewMode === "reset_password" ? (
            /* ========================================================== */
            /* 1B. VIEW MODE: IN-APP PASSWORD RESET VIA 6-DIGIT OTP       */
            /* ========================================================== */
            <motion.div
              key="view-reset-password"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full flex flex-col"
            >
              {/* Back button & Title */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setError(null);
                    setMessage(null);
                    setViewMode("login");
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer -ml-1",
                    isDark ? "hover:bg-white/[0.08] text-zinc-300" : "hover:bg-black/[0.06] text-zinc-700",
                  )}
                  aria-label={isIndonesian ? "Kembali ke Masuk" : "Back to Sign In"}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[17px] font-bold tracking-tight truncate">
                    {isIndonesian ? "Atur Ulang Kata Sandi" : "Reset Password"}
                  </h2>
                  <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                    {isIndonesian
                      ? "Kode 6-digit dikirim ke "
                      : "6-digit code sent to "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {resetEmail}
                    </span>
                  </p>
                </div>
              </div>

              {/* 6-Box Luxury Monochrome OTP Input */}
              <div className="relative my-2 w-full">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const digit = resetOtp[idx] || "";
                    const isCurrent = idx === resetOtp.length;
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
                  value={resetOtp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                    setResetOtp(val);
                    if (error) setError(null);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-transparent"
                  autoFocus
                  aria-label={isIndonesian ? "Kode Keamanan 6-digit" : "6-digit Security code"}
                />
              </div>

              {/* Form Input Kata Sandi Baru */}
              <form onSubmit={handleExecutePasswordReset} className="space-y-2.5 mt-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-tertiary)] px-1">
                    {isIndonesian ? "Kata Sandi Baru" : "New Password"}
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                    />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--glass-border)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-tertiary)] px-1">
                    {isIndonesian ? "Konfirmasi Kata Sandi Baru" : "Confirm New Password"}
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                    />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--glass-border)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)] font-mono"
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <p className="text-[12px] text-rose-400 text-center font-medium pt-1">
                    {error}
                  </p>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={resetLoading || resetOtp.length !== 6 || newPassword.length < 6}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm select-none mt-2",
                    resetLoading || resetOtp.length !== 6 || newPassword.length < 6
                      ? "opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-400"
                      : isDark
                        ? "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
                        : "bg-zinc-950 text-white hover:bg-zinc-900 active:scale-[0.98]",
                  )}
                >
                  {resetLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>
                      <Check size={14} strokeWidth={2.5} />
                      <span>
                        {isIndonesian ? "Simpan Kata Sandi & Masuk" : "Save Password & Sign In"}
                      </span>
                    </>
                  )}
                </button>

                {/* Resend & Back to login */}
                <div className="flex items-center justify-between px-1 pt-1 text-[11.5px]">
                  <button
                    type="button"
                    disabled={resetCooldown > 0}
                    onClick={handleResendResetOtp}
                    className={cn(
                      "font-medium transition-colors cursor-pointer",
                      resetCooldown > 0
                        ? "text-[var(--text-tertiary)] cursor-not-allowed"
                        : "text-[var(--text-primary)] hover:underline",
                    )}
                  >
                    {resetCooldown > 0
                      ? isIndonesian
                        ? `Kirim ulang (${resetCooldown}s)`
                        : `Resend (${resetCooldown}s)`
                      : isIndonesian
                        ? "Kirim Ulang Kode"
                        : "Resend Code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setViewMode("login");
                      setError(null);
                      setMessage(null);
                    }}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {isIndonesian ? "Kembali ke Masuk" : "Back to Sign In"}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : viewMode === "landing" ? (
            /* ========================================================== */
            /* 2. VIEW MODE: INITIAL WELCOME LANDING                      */
            /* ========================================================== */
            <motion.div
              key="view-landing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex flex-col"
            >
              {/* Header */}
              <div className="text-center space-y-1 mb-3.5 sm:mb-4 px-1">
                <h2 className="text-[19px] sm:text-[21px] font-bold tracking-tight">
                  {isIndonesian ? "Selamat Datang di Accrual" : "Welcome to Accrual"}
                </h2>
                <p
                  className={cn(
                    "text-[11.5px] font-medium leading-relaxed max-w-[300px] mx-auto",
                    isDark ? "text-zinc-400" : "text-zinc-600",
                  )}
                >
                  {isIndonesian
                    ? "Pantau arus kas harian dan bangun kejelasan aset dengan presisi tinggi."
                    : "Track everyday cashflow and build lasting wealth clarity with effortless precision."}
                </p>
              </div>

              {/* Actions Area */}
              <div className="space-y-2.5 sm:space-y-3 w-full">
                {/* 1. Primary Solid High-Contrast Pill: Get Started */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("medium");
                    setError(null);
                    setMessage(null);
                    setViewMode("register");
                  }}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl font-semibold text-[13.5px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.98] select-none",
                    isDark
                      ? "bg-white text-black hover:bg-zinc-200"
                      : "bg-zinc-950 text-white hover:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
                  )}
                >
                  <span>{isIndonesian ? "Mulai Sekarang" : "Get Started"}</span>
                  <ArrowRight size={15} strokeWidth={2.5} />
                </button>

                {/* 2. Secondary Frosted Glass Pill: Already have account? Login */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setError(null);
                    setMessage(null);
                    setViewMode("login");
                  }}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border active:scale-[0.98] select-none",
                    isDark
                      ? "bg-white/[0.05] hover:bg-white/[0.08] border-white/[0.1] text-white"
                      : "bg-black/[0.03] hover:bg-black/[0.06] border-black/[0.08] text-zinc-950 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
                  )}
                >
                  <span>
                    {isIndonesian
                      ? "Sudah punya akun? Masuk"
                      : "Already have an account? Sign in"}
                  </span>
                </button>

                {/* 3. Clean Text Link: Guest Mode (no card) */}
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={handleContinueAsGuest}
                    className="text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors py-1 cursor-pointer"
                  >
                    {isIndonesian ? "Coba masuk mode tamu" : "Try guest mode"}
                  </button>
                </div>

                {/* 4. Bottom Legal / Privacy Disclaimer */}
                <p
                  className={cn(
                    "text-[9.5px] leading-relaxed text-center pt-2 sm:pt-2.5 max-w-[310px] mx-auto",
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
                  {isIndonesian ? " dan " : " and "}
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
          ) : viewMode === "register" ? (
            /* ========================================================== */
            /* 3. VIEW MODE: GET STARTED / REGISTER                       */
            /* ========================================================== */
            <motion.div
              key="view-register"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex flex-col"
            >
              {/* Top Back Navigation & Title */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setError(null);
                    setMessage(null);
                    setViewMode("landing");
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer -ml-1",
                    isDark ? "hover:bg-white/[0.08] text-zinc-300" : "hover:bg-black/[0.06] text-zinc-700",
                  )}
                  aria-label={isIndonesian ? "Kembali" : "Back"}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[17px] font-bold tracking-tight truncate">
                    {isIndonesian ? "Mulai dengan Accrual" : "Get Started with Accrual"}
                  </h2>
                  <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                    {isIndonesian
                      ? "Pilih metode pendaftaran yang Anda inginkan"
                      : "Choose your preferred sign up method"}
                  </p>
                </div>
              </div>

              {/* Social OAuth Buttons */}
              <div className="space-y-2 mb-2.5">
                {/* Apple */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleOAuthLogin("apple")}
                  className={cn(
                    "w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl font-semibold text-[12.5px] transition-all cursor-pointer border select-none active:scale-[0.98]",
                    isDark
                      ? "bg-white hover:bg-zinc-200 text-black border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                      : "bg-black hover:bg-zinc-800 text-white border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.12)]",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.59-7.71-11.66-14-4.89-7.51-8.71-16.14-11.45-25.88-2.74-9.74-4.11-19.14-4.11-28.21 0-13.39 3.36-24.36 10.08-32.9 6.72-8.55 15.22-12.89 25.5-13.02 5.01 0 10.33 1.25 15.97 3.75 5.63 2.5 9.4 3.8 11.31 3.9 1.63 0 5.65-1.37 12.06-4.11 6.41-2.73 11.9-3.93 16.48-3.6 12.19.98 21.68 5.76 28.48 14.34-10.88 6.64-16.2 15.78-15.97 27.42.22 9.14 3.76 16.76 10.62 22.86 6.86 6.1 14.93 9.61 24.21 10.53-2.17 6.53-4.99 13.05-8.46 19.57zM119.22 31.84c0-7.39 2.67-14.35 8.01-20.87 5.34-6.52 11.96-10.43 19.86-11.73.65 1.52.98 3.15.98 4.9 0 7.39-2.75 14.35-8.25 20.87-5.5 6.52-12.21 10.37-20.13 11.55-.11-1.52-.47-3.09-.47-4.72z" />
                    </svg>
                    <span>{isIndonesian ? "Daftar dengan Apple" : "Sign up with Apple"}</span>
                  </div>
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>

                {/* Google */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleOAuthLogin("google")}
                  className={cn(
                    "w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl font-semibold text-[12.5px] transition-all cursor-pointer border select-none active:scale-[0.98]",
                    isDark
                      ? "bg-white/[0.04] hover:bg-white/[0.07] border-white/[0.08] text-white"
                      : "bg-black/[0.03] hover:bg-black/[0.05] border-black/[0.06] text-zinc-950 shadow-[0_1px_3px_rgba(0,0,0,0.03)]",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{isIndonesian ? "Daftar dengan Google" : "Sign up with Google"}</span>
                  </div>
                  <ArrowRight size={13} strokeWidth={2.5} className="opacity-45" />
                </button>
              </div>

              {/* Soft Divider */}
              <div className="flex items-center gap-2 my-2 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                <div className="flex-1 h-[1px] bg-[var(--glass-border)]" />
                <span>{isIndonesian ? "atau daftar dengan surel" : "or sign up with email"}</span>
                <div className="flex-1 h-[1px] bg-[var(--glass-border)]" />
              </div>

              {/* Form Email & 1 Password */}
              <form onSubmit={handleSubmit} className="space-y-2">
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="your.email@domain.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--glass-border)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder={
                        isIndonesian
                          ? "Kata sandi (min. 6 karakter)"
                          : "Password (min. 6 characters)"
                      }
                      required
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--glass-border)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password strength */}
                  {password && (() => {
                    const str = getPasswordStrength(password, isIndonesian);
                    const widthClass =
                      str.score === 1
                        ? "w-1/4"
                        : str.score === 2
                          ? "w-2/4"
                          : str.score === 3
                            ? "w-3/4"
                            : str.score >= 4
                              ? "w-full"
                              : "w-0";
                    return (
                      <div className="flex items-center gap-1.5 px-1 pt-0.5">
                        <div className="flex-1 h-1 bg-[var(--glass-border)] rounded-full overflow-hidden flex gap-0.5">
                          <div
                            className={cn(
                              "h-full transition-all duration-300",
                              widthClass,
                              isDark ? "bg-white" : "bg-zinc-950",
                            )}
                          />
                        </div>
                        <span className="text-[9.5px] text-[var(--text-tertiary)]">
                          {str.label}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {error && (
                  <p className="text-[11.5px] text-rose-400 font-medium px-1">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98] select-none mt-1",
                    isDark
                      ? "bg-white text-black hover:bg-zinc-200"
                      : "bg-zinc-950 text-white hover:bg-zinc-900",
                  )}
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <span>{isIndonesian ? "Daftar Sekarang" : "Sign Up"}</span>
                  )}
                </button>

                {/* Switch to login link */}
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setError(null);
                      setMessage(null);
                      setViewMode("login");
                    }}
                    className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {isIndonesian
                      ? "Sudah punya akun? Masuk"
                      : "Already have an account? Sign in"}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            /* ========================================================== */
            /* 4. VIEW MODE: LOGIN / WELCOME BACK                         */
            /* ========================================================== */
            <motion.div
              key="view-login"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex flex-col"
            >
              {/* Top Back Navigation & Title */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setError(null);
                    setMessage(null);
                    setViewMode("landing");
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer -ml-1",
                    isDark ? "hover:bg-white/[0.08] text-zinc-300" : "hover:bg-black/[0.06] text-zinc-700",
                  )}
                  aria-label={isIndonesian ? "Kembali" : "Back"}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[17px] font-bold tracking-tight truncate">
                    {isIndonesian ? "Selamat Datang Kembali" : "Welcome Back"}
                  </h2>
                  <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                    {isIndonesian
                      ? "Masuk ke akun Anda untuk melanjutkan"
                      : "Sign in to your account to continue"}
                  </p>
                </div>
              </div>

              {/* Social OAuth Buttons */}
              <div className="space-y-2 mb-2.5">
                {/* Apple */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleOAuthLogin("apple")}
                  className={cn(
                    "w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl font-semibold text-[12.5px] transition-all cursor-pointer border select-none active:scale-[0.98]",
                    isDark
                      ? "bg-white hover:bg-zinc-200 text-black border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                      : "bg-black hover:bg-zinc-800 text-white border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.12)]",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.59-7.71-11.66-14-4.89-7.51-8.71-16.14-11.45-25.88-2.74-9.74-4.11-19.14-4.11-28.21 0-13.39 3.36-24.36 10.08-32.9 6.72-8.55 15.22-12.89 25.5-13.02 5.01 0 10.33 1.25 15.97 3.75 5.63 2.5 9.4 3.8 11.31 3.9 1.63 0 5.65-1.37 12.06-4.11 6.41-2.73 11.9-3.93 16.48-3.6 12.19.98 21.68 5.76 28.48 14.34-10.88 6.64-16.2 15.78-15.97 27.42.22 9.14 3.76 16.76 10.62 22.86 6.86 6.1 14.93 9.61 24.21 10.53-2.17 6.53-4.99 13.05-8.46 19.57zM119.22 31.84c0-7.39 2.67-14.35 8.01-20.87 5.34-6.52 11.96-10.43 19.86-11.73.65 1.52.98 3.15.98 4.9 0 7.39-2.75 14.35-8.25 20.87-5.5 6.52-12.21 10.37-20.13 11.55-.11-1.52-.47-3.09-.47-4.72z" />
                    </svg>
                    <span>{isIndonesian ? "Masuk dengan Apple" : "Sign in with Apple"}</span>
                  </div>
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>

                {/* Google */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleOAuthLogin("google")}
                  className={cn(
                    "w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl font-semibold text-[12.5px] transition-all cursor-pointer border select-none active:scale-[0.98]",
                    isDark
                      ? "bg-white/[0.04] hover:bg-white/[0.07] border-white/[0.08] text-white"
                      : "bg-black/[0.03] hover:bg-black/[0.05] border-black/[0.06] text-zinc-950 shadow-[0_1px_3px_rgba(0,0,0,0.03)]",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{isIndonesian ? "Masuk dengan Google" : "Sign in with Google"}</span>
                  </div>
                  <ArrowRight size={13} strokeWidth={2.5} className="opacity-45" />
                </button>
              </div>

              {/* Soft Divider */}
              <div className="flex items-center gap-2 my-2 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                <div className="flex-1 h-[1px] bg-[var(--glass-border)]" />
                <span>{isIndonesian ? "atau masuk dengan surel" : "or sign in with email"}</span>
                <div className="flex-1 h-[1px] bg-[var(--glass-border)]" />
              </div>

              {/* Form Email & Password */}
              <form onSubmit={handleSubmit} className="space-y-2">
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="your.email@domain.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--glass-border)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)]"
                  />
                </div>

                {/* Password with 'Forgot password?' on the right above it */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-[var(--text-tertiary)]">
                      {isIndonesian ? "Kata Sandi" : "Password"}
                    </span>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer transition-colors"
                    >
                      {isIndonesian ? "Lupa kata sandi?" : "Forgot password?"}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--glass-border)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-[11.5px] text-rose-400 font-medium px-1">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="text-[11.5px] text-zinc-300 font-medium px-1">
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98] select-none mt-1",
                    isDark
                      ? "bg-white text-black hover:bg-zinc-200"
                      : "bg-zinc-950 text-white hover:bg-zinc-900",
                  )}
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <span>{isIndonesian ? "Masuk" : "Sign In"}</span>
                  )}
                </button>

                {/* Switch to register link */}
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setError(null);
                      setMessage(null);
                      setViewMode("register");
                    }}
                    className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {isIndonesian
                      ? "Belum punya akun? Daftar"
                      : "Don't have an account? Sign up"}
                  </button>
                </div>
              </form>
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
