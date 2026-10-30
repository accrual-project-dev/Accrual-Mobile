// ======================================================================
// ACCRUAL PRO PAYWALL MODAL
// Strictly compliant with GEMINI.md:
// - Rule 1: No native colored emojis (Lucide vector outline icons only)
// - Rule 2: Monochrome Apple Luxury Theme (Obsidian & Frosted Glass)
// - Rule 5: Natural vertical flow inside BottomSheet (No artificial height cap)
// - Rule 6: 100% pure localization (zero bilingual mixing)
// - Rule 7: Zero colored utility classes
// ======================================================================

import { useState, useEffect } from "react";
import { Sparkles, Check, RotateCcw, Lock, ArrowRight } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { LegalModal } from "../legal/LegalModal";
import { GlassConfirmationModal } from "../ui/GlassConfirmationModal";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useAuth, GUEST_USER_ID } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { triggerHaptic } from "../../lib/haptics";
import type { SubscriptionPlanId } from "../../types/subscription";
import { PLAN_PRICING_CONFIG } from "../../types/subscription";
import { revenueCatService } from "../../lib/revenueCatService";
import type { PurchasesOffering } from "@revenuecat/purchases-capacitor";

interface AccrualPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccrualPaywallModal({
  isOpen,
  onClose,
}: AccrualPaywallModalProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const {
    upgradeToPlan,
    restorePurchases,
    paywallContext,
  } = useSubscription();
  const { user, exitGuestMode } = useAuth();
  const { showToast } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>(
    "accrual_annual_199k",
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [legalTab, setLegalTab] = useState<"privacy" | "terms" | null>(null);
  const [showGuestLoginPrompt, setShowGuestLoginPrompt] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      revenueCatService.getOffering().then((off) => {
        if (isMounted && off) {
          setOffering(off);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const getPlanPriceDisplay = (planId: SubscriptionPlanId) => {
    const pkg = revenueCatService.resolvePackageFromOffering(offering, planId);

    if (pkg?.product?.priceString) {
      return pkg.product.priceString;
    }

    const config = PLAN_PRICING_CONFIG[planId];
    return formatWithPreferred(config.price);
  };

  const getPlanSecondaryPriceDisplay = (planId: SubscriptionPlanId) => {
    const pkg = revenueCatService.resolvePackageFromOffering(offering, planId);
    // If StoreKit returned non-IDR (e.g. USD from a US Apple ID), show approximate IDR reference
    if (pkg?.product?.currencyCode && pkg.product.currencyCode !== "IDR") {
      const config = PLAN_PRICING_CONFIG[planId];
      return isIndonesian
        ? `≈ ${formatWithPreferred(config.price)}`
        : `≈ ${formatWithPreferred(config.price)}`;
    }
    return null;
  };

  const getAnnualMonthlyBreakdown = () => {
    const annualPkg = revenueCatService.resolvePackageFromOffering(
      offering,
      "accrual_annual_199k"
    );

    let monthlyDisplay: string;
    if (annualPkg?.product?.price) {
      const monthlyPrice = annualPkg.product.price / 12;
      monthlyDisplay = annualPkg.product.currencyCode
        ? `${annualPkg.product.currencyCode} ${monthlyPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : formatWithPreferred(Math.round(monthlyPrice));
    } else {
      const annualPriceIdr = PLAN_PRICING_CONFIG.accrual_annual_199k.price;
      monthlyDisplay = `${formatWithPreferred(Math.round(annualPriceIdr / 12))}`;
    }

    return isIndonesian
      ? `7 hari gratis, lalu ${monthlyDisplay}/bln`
      : `7 days free, then ~${monthlyDisplay}/mo`;
  };

  const handleSelectPlan = (plan: SubscriptionPlanId) => {
    triggerHaptic();
    setSelectedPlan(plan);
  };

  const handleConfirmLoginRedirect = () => {
    setShowGuestLoginPrompt(false);
    onClose();
    exitGuestMode();
  };

  const handlePurchase = async () => {
    try {
      setIsProcessing(true);
      const res = await upgradeToPlan(selectedPlan);
      if (res.success) {
        showToast(
          isIndonesian
            ? "Selamat! Akun Accrual Pro Anda kini telah aktif."
            : "Welcome to Accrual Pro! Your membership is active.",
          "update",
        );
        onClose();
      } else if (res.cancelled) {
        // User voluntarily dismissed Apple StoreKit purchase sheet; exit cleanly
      } else {
        const errorMsg =
          res.error ||
          (isIndonesian
            ? "Gagal memproses transaksi. Silakan coba kembali."
            : "Unable to process transaction. Please try again.");
        showToast(errorMsg, "error", undefined, 5000);
      }
    } catch (err: any) {
      showToast(
        err?.message ||
          (isIndonesian
            ? "Terjadi kendala saat transaksi."
            : "An unexpected error occurred during checkout."),
        "error",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsProcessing(true);
      const res = await restorePurchases();
      if (res.hasActivePro) {
        showToast(
          isIndonesian
            ? "Status pembelian Anda berhasil diperbarui."
            : "Purchases successfully restored.",
          "update",
        );
        onClose();
      } else if (res.error) {
        showToast(res.error, "error", undefined, 5000);
      } else {
        showToast(
          isIndonesian
            ? "Tidak ditemukan riwayat pembelian aktif pada akun ini."
            : "No active purchases found for this account.",
          "info",
        );
      }
    } catch (err: any) {
      console.error("[AccrualPaywallModal] Restore error:", err);
      showToast(
        err?.message ||
          (isIndonesian
            ? "Gagal memulihkan pembelian. Periksa koneksi internet Anda."
            : "Failed to restore purchases. Please check your internet connection."),
        "error",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const perkList = isIndonesian
    ? [
        "Pemindaian mutasi rekening (PDF/Excel) & struk tanpa batas",
        "Slot widget tanpa batas & buka semua analitik eksekutif",
        "Multi-Space tanpa batas (Pribadi, Bisnis, Bersama)",
        "Sinkronisasi cloud seketika ke seluruh perangkat Anda",
        "Ekspor laporan keuangan resmi berformat PDF resolusi tinggi",
      ]
    : [
        "Unlimited bank statement (PDF/Excel) & receipt OCR imports",
        "Unlimited home widget slots & all executive telemetry cards",
        "Unlimited financial spaces for personal and business",
        "Instant real-time cloud synchronization across all devices",
        "Official executive financial report exports in high-res PDF",
      ];

  const getCardSurfaceClass = (isSelected: boolean) =>
    isSelected
      ? "bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)]"
      : "bg-[color-mix(in_srgb,var(--text-primary)_3.5%,transparent)] border border-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] hover:bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]";

  const renderRadioIndicator = (isSelected: boolean) => (
    <div
      className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
        isSelected
          ? "bg-[var(--text-primary)]"
          : "border border-[color-mix(in_srgb,var(--text-primary)_22%,transparent)] bg-transparent"
      }`}
    >
      {isSelected && (
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] invert" />
      )}
    </div>
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} zIndex={1100}>
      <div className="flex flex-col px-5 pt-2 pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),24px)] text-[var(--text-primary)]">
        {/* ==============================================================
            HEADER CAPSULE & TITLE
        =============================================================== */}
        <div className="flex flex-col items-center text-center mt-1.5 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)] mb-3">
            <Sparkles
              className="w-3 h-3 text-[var(--text-secondary)]"
              strokeWidth={1.75}
            />
            <span className="text-[10px] tracking-[0.1em] font-semibold uppercase text-[var(--text-secondary)]">
              {isIndonesian ? "KEANGGOTAAN EKSKLUSIF" : "EXECUTIVE MEMBERSHIP"}
            </span>
          </div>

          <h2 className="text-[26px] font-semibold tracking-[-0.025em] text-[var(--text-primary)] leading-tight">
            Accrual Pro
          </h2>
          <p className="text-[13px] text-[var(--text-tertiary)] max-w-[280px] mt-1.5 leading-relaxed">
            {isIndonesian
              ? "Buka kendali penuh atas portofolio dan otomatisasi keuangan tanpa batas."
              : "Unlock complete control over your portfolio and limitless financial automation."}
          </p>
        </div>

        {/* ==============================================================
            CONTEXTUAL TRIGGER BANNER (IF TRIGGERED BY SPECIFIC LIMIT)
        =============================================================== */}
        {paywallContext && (
          <div className="mb-5 p-3.5 rounded-2xl bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] flex items-center justify-center shrink-0 mt-0.5">
              <Lock
                className="w-3.5 h-3.5 text-[var(--text-primary)]"
                strokeWidth={1.5}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
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
              <p className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
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
            GUEST MODE NOTIFICATION BANNER
        =============================================================== */}
        {(!user || user.id === GUEST_USER_ID) && (
          <div className="mb-4 p-3 rounded-2xl bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Lock
                className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0"
                strokeWidth={1.5}
              />
              <span className="text-[11.5px] text-[var(--text-tertiary)] leading-tight">
                {isIndonesian
                  ? "Mode Tamu. Masuk akun agar langganan tersinkronkan ke cloud."
                  : "Guest Mode. Sign in to synchronize purchases across devices."}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowGuestLoginPrompt(true)}
              className="text-[11.5px] font-semibold text-[var(--text-primary)] underline decoration-[color-mix(in_srgb,var(--text-primary)_30%,transparent)] underline-offset-2 shrink-0 cursor-pointer"
            >
              {isIndonesian ? "Masuk" : "Sign In"}
            </button>
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
            className={`w-full text-left px-4 py-3.5 rounded-2xl transition-colors duration-200 flex items-center justify-between gap-3 ${getCardSurfaceClass(
              selectedPlan === "accrual_annual_199k",
            )}`}
          >
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] mb-1.5">
                <span className="text-[9.5px] font-semibold tracking-[0.06em] uppercase text-[var(--text-primary)]">
                  {isIndonesian
                    ? "HEMAT 43% • UJI COBA 7 HARI"
                    : "SAVE 43% • 7-DAY TRIAL"}
                </span>
              </div>
              <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                {isIndonesian ? "Paket Tahunan" : "Annual Plan"}
              </div>
              <div className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5">
                {getAnnualMonthlyBreakdown()}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-[15px] font-semibold tracking-[-0.015em] text-[var(--text-primary)] tabular-nums">
                  {getPlanPriceDisplay("accrual_annual_199k")}
                </div>
                {getPlanSecondaryPriceDisplay("accrual_annual_199k") && (
                  <div className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                    {getPlanSecondaryPriceDisplay("accrual_annual_199k")}
                  </div>
                )}
                <div className="text-[10.5px] text-[var(--text-tertiary)]">
                  {isIndonesian ? "/ tahun" : "/ year"}
                </div>
              </div>
              {renderRadioIndicator(selectedPlan === "accrual_annual_199k")}
            </div>
          </button>

          {/* 2. BULANAN / MONTHLY */}
          <button
            type="button"
            onClick={() => handleSelectPlan("accrual_monthly_29k")}
            className={`w-full text-left px-4 py-3.5 rounded-2xl transition-colors duration-200 flex items-center justify-between gap-3 ${getCardSurfaceClass(
              selectedPlan === "accrual_monthly_29k",
            )}`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                {isIndonesian ? "Paket Bulanan" : "Monthly Plan"}
              </div>
              <div className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5">
                {isIndonesian
                  ? "Fleksibel, batalkan kapan saja"
                  : "Flexible, cancel anytime"}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-[15px] font-semibold tracking-[-0.015em] text-[var(--text-primary)] tabular-nums">
                  {getPlanPriceDisplay("accrual_monthly_29k")}
                </div>
                {getPlanSecondaryPriceDisplay("accrual_monthly_29k") && (
                  <div className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                    {getPlanSecondaryPriceDisplay("accrual_monthly_29k")}
                  </div>
                )}
                <div className="text-[10.5px] text-[var(--text-tertiary)]">
                  {isIndonesian ? "/ bulan" : "/ month"}
                </div>
              </div>
              {renderRadioIndicator(selectedPlan === "accrual_monthly_29k")}
            </div>
          </button>

          {/* 3. LIFETIME ACCESS */}
          <button
            type="button"
            onClick={() => handleSelectPlan("accrual_lifetime_499k")}
            className={`w-full text-left px-4 py-3.5 rounded-2xl transition-colors duration-200 flex items-center justify-between gap-3 ${getCardSurfaceClass(
              selectedPlan === "accrual_lifetime_499k",
            )}`}
          >
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] mb-1.5">
                <span className="text-[9.5px] font-semibold tracking-[0.06em] uppercase text-[var(--text-primary)]">
                  {isIndonesian
                    ? "SEKALI BAYAR • SELAMANYA"
                    : "ONE-TIME • LIFETIME"}
                </span>
              </div>
              <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                {isIndonesian ? "Akses Seumur Hidup" : "Lifetime Access"}
              </div>
              <div className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5">
                {isIndonesian
                  ? "Satu kali pembayaran tanpa perpanjangan"
                  : "Pay once, access all updates forever"}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-[15px] font-semibold tracking-[-0.015em] text-[var(--text-primary)] tabular-nums">
                  {getPlanPriceDisplay("accrual_lifetime_499k")}
                </div>
                {getPlanSecondaryPriceDisplay("accrual_lifetime_499k") && (
                  <div className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                    {getPlanSecondaryPriceDisplay("accrual_lifetime_499k")}
                  </div>
                )}
                <div className="text-[10.5px] text-[var(--text-tertiary)]">
                  {isIndonesian ? "sekali bayar" : "one-time"}
                </div>
              </div>
              {renderRadioIndicator(selectedPlan === "accrual_lifetime_499k")}
            </div>
          </button>
        </div>

        {/* ==============================================================
            PERKS CHECKLIST MATRIX
        =============================================================== */}
        <div className="p-4 rounded-2xl bg-[color-mix(in_srgb,var(--text-primary)_3.5%,transparent)] mb-6 flex flex-col gap-2.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] mb-0.5">
            {isIndonesian
              ? "SEMUA FITUR PRO MENCAKUP:"
              : "ALL PRO FEATURES INCLUDE:"}
          </div>
          {perkList.map((perk, index) => (
            <div
              key={index}
              className="flex items-start gap-2.5 text-[12px] text-[var(--text-secondary)]"
            >
              <div className="w-4 h-4 rounded-full bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] flex items-center justify-center shrink-0 mt-0.5">
                <Check
                  className="w-2.5 h-2.5 text-[var(--text-primary)]"
                  strokeWidth={2}
                />
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
          disabled={isProcessing}
          onClick={handlePurchase}
          className="w-full h-12 rounded-2xl bg-[var(--text-primary)] font-semibold text-[14px] flex items-center justify-center active:scale-[0.985] transition-transform duration-150 disabled:opacity-50"
        >
          <span className="inline-flex items-center justify-center gap-2 text-[var(--text-primary)] invert">
            {isProcessing ? (
              <span className="text-[13px]">
                {isIndonesian ? "Memproses Transaksi..." : "Processing..."}
              </span>
            ) : selectedPlan === "accrual_annual_199k" ? (
              <>
                <span>
                  {isIndonesian
                    ? "Mulai Uji Coba Gratis 7 Hari"
                    : "Start 7-Day Free Trial"}
                </span>
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </>
            ) : (
              <>
                <span>
                  {isIndonesian
                    ? "Lanjutkan Pembelian"
                    : "Continue to Purchase"}
                </span>
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </>
            )}
          </span>
        </button>

        {/* ==============================================================
            APPLE APP STORE COMPLIANCE & RESTORE PURCHASES
        =============================================================== */}
        <div className="flex flex-col items-center text-center mt-4 gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleRestore}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:opacity-75 transition-colors py-1"
          >
            <RotateCcw
              className="w-3 h-3 text-[var(--text-tertiary)]"
              strokeWidth={1.5}
            />
            <span>
              {isIndonesian ? "Pulihkan Pembelian" : "Restore Purchases"}
            </span>
          </button>

          <p className="text-[10px] text-[var(--text-tertiary)] max-w-xs leading-relaxed">
            {isIndonesian
              ? "Langganan diperpanjang secara otomatis melalui Apple ID kecuali dibatalkan minimal 24 jam sebelum masa berakhir."
              : "Subscriptions renew automatically via your Apple ID unless canceled at least 24 hours before expiration."}
          </p>

          <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)] mt-0.5">
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
          zIndex={1250}
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
        zIndex={1250}
      />
    </BottomSheet>
  );
}
