// ======================================================================
// ACCRUAL PRO PAYWALL MODAL
// Strictly compliant with GEMINI.md:
// - Rule 1: No native colored emojis (Lucide vector outline icons only)
// - Rule 2: Monochrome Apple Luxury Theme (Obsidian & Frosted Glass)
// - Rule 5: Natural vertical flow inside BottomSheet (No artificial height cap)
// - Rule 6: 100% pure localization (zero bilingual mixing)
// - Rule 7: Zero colored utility classes
// ======================================================================

import { useState } from "react";
import { Sparkles, Check, RotateCcw, Lock, ArrowRight } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { LegalModal } from "../legal/LegalModal";
import { GlassConfirmationModal } from "../ui/GlassConfirmationModal";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { triggerHaptic } from "../../lib/haptics";
import type { SubscriptionPlanId } from "../../types/subscription";

interface AccrualPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccrualPaywallModal({ isOpen, onClose }: AccrualPaywallModalProps) {
  const { isIndonesian } = useLanguage();
  const {
    upgradeToPlan,
    restorePurchases,
    paywallContext,
    isLoading: isSubLoading,
  } = useSubscription();
  const { isGuest, exitGuestMode } = useAuth();
  const { showToast } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>("accrual_annual_199k");
  const [isProcessing, setIsProcessing] = useState(false);
  const [legalTab, setLegalTab] = useState<"privacy" | "terms" | null>(null);
  const [showGuestLoginPrompt, setShowGuestLoginPrompt] = useState(false);

  const handleSelectPlan = (plan: SubscriptionPlanId) => {
    triggerHaptic();
    setSelectedPlan(plan);
  };

  const handleConfirmLoginRedirect = () => {
    try {
      sessionStorage.setItem("accrual_resume_paywall", "true");
    } catch {}
    setShowGuestLoginPrompt(false);
    onClose();
    exitGuestMode();
  };

  const handlePurchase = async () => {
    if (isGuest) {
      triggerHaptic("medium");
      setShowGuestLoginPrompt(true);
      return;
    }
    try {
      setIsProcessing(true);
      const success = await upgradeToPlan(selectedPlan);
      if (success) {
        showToast(
          isIndonesian
            ? "Selamat! Akun Accrual Pro Anda kini telah aktif."
            : "Welcome to Accrual Pro! Your membership is active.",
          "update"
        );
        onClose();
      } else {
        showToast(
          isIndonesian
            ? "Gagal memproses transaksi. Silakan coba kembali."
            : "Unable to process transaction. Please try again.",
          "error"
        );
      }
    } catch {
      showToast(
        isIndonesian
          ? "Terjadi kendala saat transaksi."
          : "An unexpected error occurred during checkout.",
        "error"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (isGuest) {
      triggerHaptic("medium");
      setShowGuestLoginPrompt(true);
      return;
    }
    try {
      setIsProcessing(true);
      const restored = await restorePurchases();
      if (restored) {
        showToast(
          isIndonesian
            ? "Status pembelian Anda berhasil diperbarui."
            : "Purchases successfully restored.",
          "update"
        );
        onClose();
      } else {
        showToast(
          isIndonesian
            ? "Tidak ditemukan riwayat pembelian aktif pada akun ini."
            : "No active purchases found for this account.",
          "info"
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const perkList = isIndonesian
    ? [
        "Pemindaian mutasi rekening (PDF/Excel) & struk tanpa batas",
        "Slot widget tanpa batas & buka semua analitik eksekutif",
        "Ruang multi-buku kas (Personal, Bisnis, Kantor) tanpa batas",
        "Sinkronisasi cloud seketika ke seluruh perangkat Anda",
        "Ekspor laporan keuangan resmi berformat PDF resolusi tinggi",
      ]
    : [
        "Unlimited bank statement (PDF/Excel) & receipt OCR imports",
        "Unlimited home widget slots & all executive telemetry cards",
        "Unlimited multi-ledger spaces for personal and business books",
        "Instant real-time cloud synchronization across all devices",
        "Official executive financial report exports in high-res PDF",
      ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} zIndex={110}>
      <div className="flex flex-col px-5 pt-2 pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),24px)] text-[var(--text-primary)]">
        {/* ==============================================================
            HEADER CAPSULE & TITLE
        =============================================================== */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 mb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--text-primary)]" strokeWidth={1.5} />
            <span className="text-[10px] tracking-wider font-semibold uppercase text-[var(--text-secondary)]">
              {isIndonesian ? "KEANGGOTAAN EKSKLUSIF" : "EXECUTIVE MEMBERSHIP"}
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Accrual Pro
          </h2>
          <p className="text-[13px] text-[var(--text-tertiary)] max-w-xs mt-1.5 leading-relaxed">
            {isIndonesian
              ? "Buka kendali penuh atas portofolio dan otomatisasi keuangan tanpa batas."
              : "Unlock complete control over your portfolio and limitless financial automation."}
          </p>
        </div>

        {/* ==============================================================
            CONTEXTUAL TRIGGER BANNER (IF TRIGGERED BY SPECIFIC LIMIT)
        =============================================================== */}
        {paywallContext && (
          <div className="mb-5 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5 text-[var(--text-primary)]" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">
                {paywallContext.title ||
                  (paywallContext.feature === "ocr_quota"
                    ? isIndonesian
                      ? "Batas Pemindaian Mutasi Tercapai"
                      : "Statement OCR Limit Reached"
                    : paywallContext.feature === "dashboard_limit"
                    ? isIndonesian
                      ? "Batas Slot Widget Tercapai"
                      : "Widget Slot Limit Reached"
                    : paywallContext.feature === "advanced_widget"
                    ? isIndonesian
                      ? "Widget Analitik Eksekutif"
                      : "Executive Telemetry Widget"
                    : isIndonesian
                    ? "Fitur Eksklusif Accrual Pro"
                    : "Accrual Pro Feature")}
              </h4>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
                {paywallContext.description ||
                  (paywallContext.feature === "ocr_quota"
                    ? isIndonesian
                      ? "Akun standar dibatasi 5x pemindaian per bulan. Beralih ke Pro untuk pemrosesan tanpa batas."
                      : "Standard accounts include 5 scans per month. Upgrade to Pro for unlimited processing."
                    : paywallContext.feature === "dashboard_limit"
                    ? isIndonesian
                      ? "Akun standar dibatasi maksimal 4 widget aktif di Home. Pasang widget tanpa batas dengan Pro."
                      : "Standard accounts can pin up to 4 active widgets on Home. Unlock unlimited widgets with Pro."
                    : isIndonesian
                    ? "Fitur ini dirancang khusus untuk anggota Accrual Pro."
                    : "This feature is exclusively designed for Accrual Pro members.")}
              </p>
            </div>
          </div>
        )}

        {/* ==============================================================
            PLAN SELECTION CARDS
        =============================================================== */}
        <div className="flex flex-col gap-2.5 mb-6">
          {/* 1. TAHUNAN / ANNUAL (RECOMMENDED & 7-DAY TRIAL) */}
          <button
            type="button"
            onClick={() => handleSelectPlan("accrual_annual_199k")}
            className={`w-full text-left p-4 rounded-2xl transition-all duration-200 relative ${
              selectedPlan === "accrual_annual_199k"
                ? "bg-white/[0.08] border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_rgba(0,0,0,0.3)]"
                : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] opacity-75"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/[0.1] border border-white/10 text-[var(--text-primary)]">
                {isIndonesian ? "HEMAT 43% • UJI COBA 7 HARI" : "SAVE 43% • 7-DAY TRIAL"}
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  selectedPlan === "accrual_annual_199k"
                    ? "border-[var(--text-primary)] bg-[var(--text-primary)]"
                    : "border-white/30"
                }`}
              >
                {selectedPlan === "accrual_annual_199k" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-black" />
                )}
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian ? "Paket Tahunan" : "Annual Plan"}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {isIndonesian
                    ? "7 hari gratis, lalu Rp 16.583/bln"
                    : "7 days free, then ~Rp 16,583/mo"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Rp 199.000
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  {isIndonesian ? "/ tahun" : "/ year"}
                </div>
              </div>
            </div>
          </button>

          {/* 2. BULANAN / MONTHLY */}
          <button
            type="button"
            onClick={() => handleSelectPlan("accrual_monthly_29k")}
            className={`w-full text-left p-4 rounded-2xl transition-all duration-200 ${
              selectedPlan === "accrual_monthly_29k"
                ? "bg-white/[0.08] border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_rgba(0,0,0,0.3)]"
                : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] opacity-75"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian ? "Paket Bulanan" : "Monthly Plan"}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {isIndonesian ? "Fleksibel, batalkan kapan saja" : "Flexible, cancel anytime"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                    Rp 29.000
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    {isIndonesian ? "/ bulan" : "/ month"}
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    selectedPlan === "accrual_monthly_29k"
                      ? "border-[var(--text-primary)] bg-[var(--text-primary)]"
                      : "border-white/30"
                  }`}
                >
                  {selectedPlan === "accrual_monthly_29k" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-black" />
                  )}
                </div>
              </div>
            </div>
          </button>

          {/* 3. LIFETIME ACCESS */}
          <button
            type="button"
            onClick={() => handleSelectPlan("accrual_lifetime_499k")}
            className={`w-full text-left p-4 rounded-2xl transition-all duration-200 relative ${
              selectedPlan === "accrual_lifetime_499k"
                ? "bg-white/[0.08] border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_rgba(0,0,0,0.3)]"
                : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] opacity-75"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/[0.1] border border-white/10 text-[var(--text-primary)]">
                {isIndonesian ? "SEKALI BAYAR • AKSES SELAMANYA" : "ONE-TIME • LIFETIME"}
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  selectedPlan === "accrual_lifetime_499k"
                    ? "border-[var(--text-primary)] bg-[var(--text-primary)]"
                    : "border-white/30"
                }`}
              >
                {selectedPlan === "accrual_lifetime_499k" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-black" />
                )}
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian ? "Akses Seumur Hidup" : "Lifetime Access"}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {isIndonesian
                    ? "Satu kali pembayaran tanpa perpanjangan"
                    : "Pay once, access all updates forever"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Rp 499.000
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  {isIndonesian ? "sekali bayar" : "one-time"}
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* ==============================================================
            PERKS CHECKLIST MATRIX
        =============================================================== */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-6 flex flex-col gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            {isIndonesian ? "SEMUA FITUR PRO MENCAKUP:" : "ALL PRO FEATURES INCLUDE:"}
          </div>
          {perkList.map((perk, index) => (
            <div key={index} className="flex items-center gap-2.5 text-[12px] text-[var(--text-secondary)]">
              <div className="w-4 h-4 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 text-[var(--text-primary)]" strokeWidth={2} />
              </div>
              <span className="leading-snug">{perk}</span>
            </div>
          ))}
        </div>

        {/* ==============================================================
            PRIMARY ACTION CTA BUTTON
        =============================================================== */}
        <button
          type="button"
          disabled={isProcessing || isSubLoading}
          onClick={handlePurchase}
          className="w-full h-12 rounded-2xl bg-[var(--text-primary)] text-black font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {isProcessing ? (
            <span className="text-[13px]">
              {isIndonesian ? "Memproses Transaksi..." : "Processing..."}
            </span>
          ) : selectedPlan === "accrual_annual_199k" ? (
            <>
              <span>{isIndonesian ? "Mulai Uji Coba Gratis 7 Hari" : "Start 7-Day Free Trial"}</span>
              <ArrowRight className="w-4 h-4 text-black" strokeWidth={2} />
            </>
          ) : (
            <>
              <span>{isIndonesian ? "Lanjutkan Pembelian" : "Continue to Purchase"}</span>
              <ArrowRight className="w-4 h-4 text-black" strokeWidth={2} />
            </>
          )}
        </button>

        {/* ==============================================================
            APPLE APP STORE COMPLIANCE & RESTORE PURCHASES
        =============================================================== */}
        <div className="flex flex-col items-center text-center mt-4 gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleRestore}
            className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:opacity-75 transition-colors py-1"
          >
            <RotateCcw className="w-3 h-3 text-[var(--text-tertiary)]" strokeWidth={1.5} />
            <span>{isIndonesian ? "Pulihkan Pembelian" : "Restore Purchases"}</span>
          </button>

          <p className="text-[10px] text-[var(--text-tertiary)] max-w-xs leading-relaxed">
            {isIndonesian
              ? "Langganan diperpanjang secara otomatis melalui Apple ID kecuali dibatalkan minimal 24 jam sebelum masa berakhir."
              : "Subscriptions renew automatically via your Apple ID unless canceled at least 24 hours before expiration."}
          </p>

          <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)] mt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setLegalTab("terms");
              }}
              className="hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
            >
              {isIndonesian ? "Ketentuan Penggunaan" : "Terms of Use"}
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setLegalTab("privacy");
              }}
              className="hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
            >
              {isIndonesian ? "Kebijakan Privasi" : "Privacy Policy"}
            </button>
          </div>
        </div>
      </div>

      {legalTab !== null && (
        <LegalModal
          isOpen={true}
          onClose={() => setLegalTab(null)}
          initialTab={legalTab}
        />
      )}

      <GlassConfirmationModal
        isOpen={showGuestLoginPrompt}
        onClose={() => setShowGuestLoginPrompt(false)}
        onConfirm={handleConfirmLoginRedirect}
        title={isIndonesian ? "Masuk Diperlukan" : "Sign In Required"}
        description={
          isIndonesian
            ? "Untuk membeli atau memulihkan paket Accrual Pro, Anda perlu masuk atau membuat akun terlebih dahulu agar keanggotaan terhubung dengan aman."
            : "To purchase or restore Accrual Pro, please sign in or create an account first so your membership is safely linked to your profile."
        }
        confirmLabel={isIndonesian ? "Masuk / Buat Akun" : "Sign In / Register"}
        cancelLabel={isIndonesian ? "Batal" : "Cancel"}
        icon={Lock}
        isIndonesian={isIndonesian}
        zIndex={1100}
      />
    </BottomSheet>
  );
}
