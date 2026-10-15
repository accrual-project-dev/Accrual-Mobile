import { useState } from "react";
import { Lock, KeyRound, Eye, EyeOff, Check, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../contexts/LanguageContext";
import { useToast } from "../../contexts/ToastContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResetPasswordModal({ isOpen, onClose }: ResetPasswordModalProps) {
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Strength score: 0 to 4
  const getStrengthScore = (pwd: string): number => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strengthScore = getStrengthScore(password);
  const strengthLabels = isIndonesian
    ? ["Terlalu pendek", "Lemah", "Cukup", "Kuat", "Sangat Kuat"]
    : ["Too short", "Weak", "Fair", "Good", "Strong"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError(
        isIndonesian
          ? "Silakan masukkan kata sandi baru."
          : "Please enter your new password.",
      );
      return;
    }

    if (password.length < 6) {
      setError(
        isIndonesian
          ? "Kata sandi harus terdiri dari minimal 6 karakter."
          : "Password must be at least 6 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        isIndonesian
          ? "Konfirmasi kata sandi tidak cocok."
          : "Password confirmation does not match.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    triggerHaptic("medium");

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
      });

      if (updateErr) {
        throw updateErr;
      }

      triggerSuccessHaptic();
      showToast(
        isIndonesian
          ? "Kata sandi Anda berhasil diperbarui."
          : "Password updated successfully.",
        "update",
      );

      // Clean form state
      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      triggerHaptic("heavy");
      setError(
        err?.message ||
          (isIndonesian
            ? "Gagal memperbarui kata sandi. Silakan coba kembali."
            : "Failed to update password. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose}>
      <div className="p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)] space-y-5">
        {/* Header Icon & Title */}
        <div className="text-center">
          <div
            className="w-13 h-13 mx-auto rounded-3xl flex items-center justify-center mb-3 shadow-lg"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <KeyRound size={22} strokeWidth={1.75} style={{ color: "var(--text-primary)" }} />
          </div>
          <h3
            className="font-semibold text-[19px] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Setel Ulang Kata Sandi" : "Reset Your Password"}
          </h3>
          <p
            className="text-[12px] font-normal mt-1 max-w-xs mx-auto leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian
              ? "Buat kata sandi baru yang aman untuk akun Trouvaille Anda."
              : "Create a new, secure password for your Trouvaille account."}
          </p>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div
            className="p-3.5 rounded-2xl flex items-center gap-2.5 text-[12px] font-medium leading-relaxed"
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#f87171",
            }}
          >
            <AlertCircle size={16} strokeWidth={1.75} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. New Password Input */}
          <div className="space-y-1.5">
            <label
              className="text-[11px] font-semibold uppercase tracking-wider block px-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Kata Sandi Baru" : "New Password"}
            </label>
            <div
              className="relative flex items-center rounded-2xl transition-all"
              style={{
                background: "var(--glass-fill)",
                border: "none",
              }}
            >
              <div className="pl-3.5 pointer-events-none" style={{ color: "var(--text-tertiary)" }}>
                <Lock size={16} strokeWidth={1.75} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isIndonesian ? "Minimal 6 karakter" : "At least 6 characters"}
                className="w-full py-3.5 pl-3 pr-11 text-[13.5px] bg-transparent focus:outline-none placeholder:text-[var(--text-tertiary)]"
                style={{ color: "var(--text-primary)" }}
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
                style={{ color: "var(--text-tertiary)" }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <div className="px-1 pt-1 space-y-1.5">
                <div className="flex gap-1 h-1">
                  {[0, 1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className="flex-1 rounded-full transition-all duration-300"
                      style={{
                        background:
                          strengthScore > step
                            ? "var(--text-primary)"
                            : "var(--glass-border)",
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian ? "Kekuatan Sandi" : "Strength"}
                  </span>
                  <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                    {strengthLabels[strengthScore]}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Confirm Password Input */}
          <div className="space-y-1.5">
            <label
              className="text-[11px] font-semibold uppercase tracking-wider block px-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Konfirmasi Kata Sandi" : "Confirm Password"}
            </label>
            <div
              className="relative flex items-center rounded-2xl transition-all"
              style={{
                background: "var(--glass-fill)",
                border: "none",
              }}
            >
              <div className="pl-3.5 pointer-events-none" style={{ color: "var(--text-tertiary)" }}>
                <ShieldCheck size={16} strokeWidth={1.75} />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={isIndonesian ? "Ulangi kata sandi baru" : "Re-enter new password"}
                className="w-full py-3.5 pl-3 pr-11 text-[13.5px] bg-transparent focus:outline-none placeholder:text-[var(--text-tertiary)]"
                style={{ color: "var(--text-primary)" }}
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3.5 p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
                style={{ color: "var(--text-tertiary)" }}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>
            {password && confirmPassword && password === confirmPassword && (
              <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-medium text-zinc-400">
                <Check size={13} strokeWidth={2} />
                <span>{isIndonesian ? "Kata sandi cocok" : "Passwords match"}</span>
              </div>
            )}
          </div>

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !password || password !== confirmPassword}
              className="w-full py-3.5 px-4 rounded-2xl font-semibold text-[13.5px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-primary)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{isIndonesian ? "Menyimpan Sandi..." : "Saving Password..."}</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={2} />
                  <span>{isIndonesian ? "Simpan Kata Sandi Baru" : "Save New Password"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </BottomSheet>
  );
}
