// ======================================================================
// ACCRUAL CANCEL / MANAGE AUTO-RENEWAL SUBSCRIPTION MODAL
// Strictly compliant with GEMINI.md:
// - Rule 1: No native colored emojis (Lucide vector outline icons only)
// - Rule 2: Monochrome Apple Luxury Theme (Obsidian & Frosted Glass)
// - Rule 3: Centered modal card layout (No excess blank space)
// - Rule 6: 100% pure localization (zero bilingual mixing)
// - Rule 7: Zero vibrant/rainbow colored utility classes
// ======================================================================

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShieldAlert,
  ExternalLink,
  Clock,
  HelpCircle,
  Smartphone,
} from "lucide-react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { triggerHaptic } from "../../lib/haptics";
import type { UserSubscription } from "../../types/subscription";

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: UserSubscription | null;
}

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  subscription,
}: CancelSubscriptionModalProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";

  if (!isOpen) return null;

  const handleOpenAppleSubscriptions = async () => {
    triggerHaptic("medium");
    const appleSubscriptionsUrl = "https://apps.apple.com/account/subscriptions";
    try {
      if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
        await Browser.open({ url: appleSubscriptionsUrl, windowName: "_system" });
      } else {
        window.open(appleSubscriptionsUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      window.open(appleSubscriptionsUrl, "_blank", "noopener,noreferrer");
    }
  };

  const formattedPeriodEnd = (() => {
    if (Boolean(subscription?.isLifetime || subscription?.planId === "accrual_lifetime_499k")) {
      return isIndonesian
        ? "Akses Seumur Hidup (Tidak memerlukan perpanjangan)"
        : "Lifetime Access (No renewal required)";
    }
    if (subscription?.currentPeriodEnd) {
      try {
        const d = new Date(subscription.currentPeriodEnd);
        return new Intl.DateTimeFormat(isIndonesian ? "id-ID" : "en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(d);
      } catch {
        return subscription.currentPeriodEnd;
      }
    }
    return isIndonesian ? "Akhir periode penagihan aktif" : "End of active billing period";
  })();

  const isTrial = subscription?.status === "trialing";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md mx-auto rounded-3xl p-6 shadow-2xl z-10 overflow-hidden text-[var(--text-primary)]"
          style={{
            fontFamily: "'Urbanist', sans-serif",
            background: isDark
              ? "linear-gradient(165deg, rgba(24, 24, 28, 0.98) 0%, rgba(12, 12, 16, 0.99) 100%)"
              : "linear-gradient(165deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 247, 250, 0.98) 100%)",
            border: isDark
              ? "1px solid rgba(255, 255, 255, 0.12)"
              : "1px solid rgba(0, 0, 0, 0.08)",
            boxShadow: isDark
              ? "0 25px 60px -15px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
              : "0 25px 60px -15px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
          }}
        >
          {/* Top Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label={isIndonesian ? "Tutup" : "Close"}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>

          {/* Header Icon & Title */}
          <div className="flex flex-col items-center text-center mt-1 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3.5"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)",
                color: "var(--text-primary)",
              }}
            >
              <ShieldAlert size={22} strokeWidth={1.75} />
            </div>

            <h3 className="text-[20px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
              {isIndonesian ? "Pembatalan Perpanjangan Otomatis" : "Cancel Auto-Renewal"}
            </h3>
            <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1.5 leading-relaxed max-w-xs">
              {isIndonesian
                ? "Anda dapat mematikan perpanjangan otomatis kapan saja tanpa langsung kehilangan akses ke fitur Pro."
                : "You can turn off automatic renewal anytime without losing your active Pro privileges immediately."}
            </p>
          </div>

          {/* Active Period Protection Notice */}
          <div
            className="p-3.5 rounded-2xl mb-4.5 flex items-start gap-3"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.05)",
            }}
          >
            <Clock size={16} strokeWidth={1.75} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[12.5px] font-semibold text-[var(--text-primary)] block leading-snug">
                {isTrial
                  ? isIndonesian
                    ? "Uji Coba Berjalan Hingga:"
                    : "Trial Active Until:"
                  : isIndonesian
                    ? "Akses Pro Tetap Aktif Hingga:"
                    : "Pro Access Remains Active Until:"}
              </span>
              <span className="text-[12px] font-mono font-medium text-[var(--text-secondary)] block mt-0.5">
                {formattedPeriodEnd}
              </span>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1 leading-normal">
                {isIndonesian
                  ? "Jika Anda mematikan perpanjangan otomatis, akun Anda tidak akan ditagih lagi pada siklus berikutnya."
                  : "If you disable auto-renewal, your account will not be billed again on the next cycle."}
              </p>
            </div>
          </div>

          {/* Apple StoreKit Policy Explanation */}
          <div
            className="p-3.5 rounded-2xl mb-5 space-y-2.5"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
            }}
          >
            <div className="flex items-center gap-2">
              <Smartphone size={13} strokeWidth={1.75} className="text-[var(--text-tertiary)] shrink-0" />
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Kebijakan Langganan Apple" : "Apple Subscription Policy"}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
              {isIndonesian
                ? "Sesuai regulasi keamanan Apple App Store, perpanjangan otomatis langganan in-app purchase wajib dikelola langsung melalui akun Apple ID Anda."
                : "Per Apple App Store security regulations, in-app subscription renewals must be managed directly via your personal Apple ID account."}
            </p>
          </div>

          {/* Primary Action Button: Open Apple Subscriptions */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleOpenAppleSubscriptions}
              className="w-full h-12 rounded-2xl font-semibold text-[13.5px] flex items-center justify-center gap-2 active:scale-[0.985] transition-transform duration-150 cursor-pointer shadow-sm select-none"
              style={{
                background: isDark ? "#ffffff" : "#18181b",
                color: isDark ? "#000000" : "#ffffff",
              }}
            >
              <span>
                {isIndonesian ? "Buka Pengaturan Langganan Apple" : "Manage in Apple ID Subscriptions"}
              </span>
              <ExternalLink size={14} strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full h-10 rounded-2xl text-[12.5px] font-semibold active:scale-[0.985] transition-all cursor-pointer text-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              }}
            >
              {isIndonesian ? "Tetap Berlangganan (Tutup)" : "Keep Subscription (Close)"}
            </button>
          </div>

          {/* Support Email Assistance */}
          <div className="flex items-center justify-center gap-1.5 mt-4 text-[10.5px] text-[var(--text-tertiary)]">
            <HelpCircle size={11} strokeWidth={1.6} />
            <span>
              {isIndonesian ? "Butuh bantuan bantuan?" : "Need assistance?"}{" "}
              <a
                href="mailto:accrual.project.app@gmail.com"
                className="underline hover:text-[var(--text-secondary)] transition-colors"
              >
                accrual.project.app@gmail.com
              </a>
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
