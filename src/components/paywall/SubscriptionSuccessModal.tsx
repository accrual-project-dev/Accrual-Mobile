// ======================================================================
// ACCRUAL PRO SUBSCRIPTION SUCCESS & PRIVILEGES MODAL
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
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  FileText,
  Lock,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { triggerSuccessHaptic, triggerHaptic } from "../../lib/haptics";
import type { UserSubscription } from "../../types/subscription";

interface SubscriptionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: UserSubscription | null;
  onOpenCancelModal?: () => void;
}

export function SubscriptionSuccessModal({
  isOpen,
  onClose,
  subscription,
  onOpenCancelModal,
}: SubscriptionSuccessModalProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";

  if (!isOpen) return null;

  const handleFinish = () => {
    triggerSuccessHaptic();
    onClose();
  };

  const planName = (() => {
    if (subscription?.isLifetime || subscription?.planId === "accrual_lifetime_499k") {
      return isIndonesian ? "Accrual Pro Seumur Hidup" : "Accrual Pro Lifetime";
    }
    if (subscription?.planId === "accrual_annual_199k") {
      return isIndonesian ? "Accrual Pro Tahunan" : "Accrual Pro Annual";
    }
    if (subscription?.planId === "accrual_monthly_29k") {
      return isIndonesian ? "Accrual Pro Bulanan" : "Accrual Pro Monthly";
    }
    return "Accrual Pro";
  })();

  const isTrial = subscription?.status === "trialing";

  const formattedPeriodEnd = (() => {
    if (subscription?.isLifetime) {
      return isIndonesian
        ? "Akses Seumur Hidup (Tanpa Batas Waktu)"
        : "Lifetime Access (Never Expires)";
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
    return isIndonesian ? "Aktif" : "Active";
  })();

  const privileges = [
    {
      title: isIndonesian
        ? "Pemindaian Mutasi & Struk Tanpa Batas"
        : "Unlimited Bank Statement & Receipt OCR",
      desc: isIndonesian
        ? "Unggah PDF & Excel rekening koran perbankan tanpa kuota bulanan."
        : "Import statement PDFs and Excel sheets with zero monthly caps.",
      icon: FileText,
    },
    {
      title: isIndonesian
        ? "Widget Home & Analitik Eksekutif Terbuka Penuh"
        : "Unlimited Home Widgets & Executive Telemetry",
      desc: isIndonesian
        ? "Buka Runway Likuiditas, Rasio Stabilitas, & Diagnostic Gauge."
        : "Unlock Liquid Runway, Stability Ratio, and Diagnostic Gauge.",
      icon: Zap,
    },
    {
      title: isIndonesian
        ? "Multi-Buku Kas & Brankas Terenkripsi Biometrik"
        : "Unlimited Multi-Ledgers & Encrypted Vault",
      desc: isIndonesian
        ? "Pisahkan buku kas bisnis, pribadi, dan lindungi dengan PIN/Face ID."
        : "Isolate personal and business books, protected with PIN/Face ID.",
      icon: Lock,
    },
    {
      title: isIndonesian
        ? "Sinkronisasi Cloud Real-Time Antar-Perangkat"
        : "Instant Real-Time Cloud Synchronization",
      desc: isIndonesian
        ? "Data portofolio terhubung otomatis ke akun Anda tanpa jeda."
        : "Portfolio state stays synchronized across all your devices seamlessly.",
      icon: Layers,
    },
    {
      title: isIndonesian
        ? "Ekspor Laporan Neraca & Laba Rugi Resmi"
        : "Official High-Resolution PDF Financial Reports",
      desc: isIndonesian
        ? "Unduh neraca komprehensif tanpa pemotongan aset beresolusi tinggi."
        : "Export untruncated balance sheets and audit-ready reports.",
      icon: ShieldCheck,
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleFinish}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md mx-auto rounded-3xl p-6 shadow-2xl z-10 overflow-hidden text-[var(--text-primary)] max-h-[92dvh] flex flex-col"
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
            onClick={handleFinish}
            aria-label={isIndonesian ? "Tutup" : "Close"}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] z-10"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>

          {/* Scrollable Container for natural flow */}
          <div className="flex-1 overflow-y-auto no-scrollbar -mr-1 pr-1 space-y-4 pt-1">
            {/* Header: Celebratory Capsule & Title */}
            <div className="flex flex-col items-center text-center">
              <div
                className="w-13 h-13 rounded-2xl flex items-center justify-center mb-3"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid rgba(0, 0, 0, 0.08)",
                  color: "var(--text-primary)",
                }}
              >
                <Sparkles size={24} strokeWidth={1.6} />
              </div>

              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-[var(--glass-border)] mb-2">
                <span className="text-[9.5px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">
                  {isIndonesian ? "KEANGGOTAAN EKSKLUSIF AKTIF" : "EXECUTIVE MEMBERSHIP ACTIVE"}
                </span>
              </div>

              <h2 className="text-[22px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
                {isIndonesian ? "Selamat Datang di Accrual Pro" : "Welcome to Accrual Pro"}
              </h2>
              <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1 max-w-[310px] leading-relaxed">
                {isIndonesian
                  ? "Seluruh kapabilitas profesional dan otomatisasi portofolio tanpa batas kini terbuka penuh untuk Anda."
                  : "All professional capabilities and limitless portfolio automation are now completely unlocked."}
              </p>
            </div>

            {/* Plan & Validity Card */}
            <div
              className="p-4 rounded-2xl space-y-2.5"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.06)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Paket Terpilih" : "Selected Plan"}
                  </span>
                  <span className="text-[14px] font-bold text-[var(--text-primary)] block mt-0.5">
                    {planName}
                  </span>
                </div>
                <div
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.16)" : "1px solid rgba(0, 0, 0, 0.1)",
                    color: "var(--text-primary)",
                  }}
                >
                  {isTrial
                    ? isIndonesian ? "Uji Coba 7 Hari" : "7-Day Trial"
                    : isIndonesian ? "Aktif" : "Active"}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--glass-border)]/50 flex items-start justify-between gap-2 text-[11.5px]">
                <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                  <Calendar size={13} strokeWidth={1.7} />
                  <span>
                    {subscription?.isLifetime
                      ? isIndonesian ? "Masa Berlaku:" : "Validity:"
                      : isTrial
                        ? isIndonesian ? "Uji Coba Hingga:" : "Trial Until:"
                        : isIndonesian ? "Aktif Hingga:" : "Active Until:"}
                  </span>
                </div>
                <span className="font-semibold text-[var(--text-primary)] text-right">
                  {formattedPeriodEnd}
                </span>
              </div>

              {!subscription?.isLifetime && (
                <p className="text-[10px] text-[var(--text-tertiary)] pt-0.5 leading-snug">
                  {isIndonesian
                    ? "Dikelola aman via Apple ID. Perpanjangan otomatis dapat dikelola kapan saja."
                    : "Managed securely via Apple ID. Automatic renewal can be managed at any time."}
                </p>
              )}
            </div>

            {/* Privileges Matrix */}
            <div className="space-y-2">
              <span className="text-[10.5px] uppercase font-bold tracking-wider text-[var(--text-tertiary)] block px-1">
                {isIndonesian ? "Hak Istimewa yang Anda Dapatkan:" : "Your Unlocked Privileges:"}
              </span>

              <div className="space-y-1.5">
                {privileges.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl flex items-start gap-3"
                      style={{
                        background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                        border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                          border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.05)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <Icon size={14} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[12px] font-semibold text-[var(--text-primary)] block leading-tight">
                          {p.title}
                        </span>
                        <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5 leading-normal">
                          {p.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-4 border-t border-[var(--glass-border)]/60 space-y-2 shrink-0">
            <button
              type="button"
              onClick={handleFinish}
              className="w-full h-12 rounded-2xl font-semibold text-[13.5px] flex items-center justify-center gap-2 active:scale-[0.985] transition-transform duration-150 cursor-pointer shadow-sm select-none"
              style={{
                background: isDark ? "#ffffff" : "#18181b",
                color: isDark ? "#000000" : "#ffffff",
              }}
            >
              <span>{isIndonesian ? "Mulai Eksplorasi Fitur Pro" : "Start Exploring Pro Features"}</span>
              <ArrowRight size={14} strokeWidth={2} />
            </button>

            {!subscription?.isLifetime && onOpenCancelModal && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenCancelModal();
                }}
                className="w-full h-8 text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer text-center"
              >
                {isIndonesian
                  ? "Kelola / Batalkan Perpanjangan Otomatis"
                  : "Manage / Cancel Auto-Renewal"}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
