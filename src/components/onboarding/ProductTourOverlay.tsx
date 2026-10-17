// ======================================================================
// TROUVAILLE ESSENTIAL CROSS-PAGE PRODUCT TOUR OVERLAY
// Ultra-luxury Apple Monochrome Liquid Glass
// Dynamic Smart-Flipping Card & Precision Minimalist Spotlight Cutout
// ======================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  PlusCircle,
  Landmark,
  History,
  Calendar,
  PieChart,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Eye,
  Compass,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";

export interface ProductTourOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface TourStep {
  id: string;
  path: string;
  selector: string;
  badgeId: string;
  badgeEn: string;
  titleId: string;
  titleEn: string;
  descId: string;
  descEn: string;
  icon: typeof Home;
  highlightsId: string[];
  highlightsEn: string[];
  proTipId: string;
  proTipEn: string;
  actionLabelId: string;
  actionLabelEn: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "home",
    path: "/",
    selector: '[data-tour="nav-home"]',
    badgeId: "KOKPIT UTAMA",
    badgeEn: "EXECUTIVE COCKPIT",
    titleId: "Kendali Likuiditas & Aset",
    titleEn: "Liquidity & Wealth Pacing",
    descId:
      "Pantau posisi keuangan secara komprehensif. Lacak modal kas likuid, estimasi kekayaan bersih, dan ritme pengeluaran bulanan dalam satu dasbor eksekutif.",
    descEn:
      "Comprehensive wealth overview. Monitor liquid operating cash, net worth trajectory, and monthly spending pacing in a unified executive cockpit.",
    icon: Home,
    highlightsId: [
      "Modal Likuid Operasional",
      "Plafon Belanja Aman",
      "Ruang Kas Bersama",
    ],
    highlightsEn: [
      "Liquid Operating Capital",
      "Safe Spending Velocity",
      "Shared Money Spaces",
    ],
    proTipId:
      "Tarik ke bawah untuk sinkronisasi kurs live. Ketuk kartu saldo untuk rincian dompet.",
    proTipEn:
      "Pull down to sync live rates. Tap any balance card to inspect account details.",
    actionLabelId: "Lihat Dasbor Kokpit",
    actionLabelEn: "Inspect Cockpit View",
  },
  {
    id: "quick-add",
    path: "/",
    selector: '[data-tour="quick-add"]',
    badgeId: "1-KETUKAN",
    badgeEn: "INSTANT CAPTURE",
    titleId: "Tambah Cepat: Suara & Kamera",
    titleEn: "Quick Add: Voice & Receipt Scan",
    descId:
      "Catat mutasi dalam hitungan detik. Gunakan Liquid Keypad dengan evaluasi matematika instan, dikte suara natural bebas format, atau pindai struk belanja otomatis.",
    descEn:
      "Capture transactions effortlessly within seconds. Use the arithmetic Liquid Keypad, natural voice logging, or automated camera receipt scanning.",
    icon: PlusCircle,
    highlightsId: [
      "Keypad Hitung Cepat",
      "Pencatatan Suara Natural",
      "Pemindai Struk & Bukti Transfer",
    ],
    highlightsEn: [
      "Arithmetic Liquid Keypad",
      "Natural Voice Logging",
      "Receipt & Slip Camera Scan",
    ],
    proTipId:
      "Tekan tombol mikrofon untuk mendikte mutasi, atau pindai struk fisik dengan kamera.",
    proTipEn:
      "Tap the mic icon to dictate transactions naturally, or scan paper receipts.",
    actionLabelId: "Coba Intip Pencatatan",
    actionLabelEn: "Peek Instant Capture",
  },
  {
    id: "assets",
    path: "/assets",
    selector: '[data-tour="nav-assets"]',
    badgeId: "NERACA 4 PILAR",
    badgeEn: "4-PILLAR CAPITAL",
    titleId: "Aset: Struktur Modal & Valuasi",
    titleEn: "Assets: Capital Solvency & USDT",
    descId:
      "Evaluasi neraca 4 pilar: Kas Likuid Utama, Portofolio Investasi, Aset Riil Berwujud, dan Liabilitas Utang dengan valuasi kurs kripto USDT live.",
    descEn:
      "Comprehensive 4-pillar balance sheet: Liquid Cash (Tier 1), Investment Holdings (Tier 2), Real Tangibles (Tier 3), and Liabilities with live USDT pricing.",
    icon: Landmark,
    highlightsId: [
      "Valuasi Kripto USDT & Emas Live",
      "Solvabilitas 100% Bebas Utang",
      "Sinkronisasi Mutasi Otomatis",
    ],
    highlightsEn: [
      "Live USDT & Gold Valuation",
      "100% Debt-Free Solvency Score",
      "Auto-Reconciliation Engine",
    ],
    proTipId:
      "Pantau rasio solvabilitas utang vs aset. Aset kripto USDT dan emas terkonversi otomatis ke Rupiah.",
    proTipEn:
      "Monitor your debt vs liquid capital ratio. USDT crypto and gold convert automatically to Rupiah.",
    actionLabelId: "Jelajahi Neraca Aset",
    actionLabelEn: "Explore Balance Sheet",
  },
  {
    id: "transactions",
    path: "/transactions",
    selector: '[data-tour="nav-transactions"]',
    badgeId: "BUKU BESAR",
    badgeEn: "FINANCIAL LEDGER",
    titleId: "Transaksi: Mutasi & Impor Bank",
    titleEn: "Transactions: Ledger & Statement Import",
    descId:
      "Audit mutasi keuangan tak terbatas. Telusuri riwayat belanja dengan multi-filter kategori dan rekening, serta impor mutasi rekening koran BCA, Mandiri via file.",
    descEn:
      "Infinite cashflow audit trail. Filter spending across categories or accounts, and import bank statements seamlessly via Excel, CSV, or PDF.",
    icon: History,
    highlightsId: [
      "Pencarian Instan & Multi-Filter",
      "Impor Rekening Koran Bank",
      "Kategori Kustom & Ikon Vektor",
    ],
    highlightsEn: [
      "Instant Search & Multi-Filters",
      "Bank Statement Importer",
      "Custom Categories & Vector Icons",
    ],
    proTipId:
      "Geser item mutasi ke kiri untuk ubah atau hapus. Gunakan Impor Rekening untuk unggah mutasi.",
    proTipEn:
      "Swipe any transaction row to edit or delete. Use Bank Statement Import to upload bank statements.",
    actionLabelId: "Periksa Buku Besar",
    actionLabelEn: "Audit Ledger Entries",
  },
  {
    id: "calendar",
    path: "/calendar",
    selector: '[data-tour="calendar-header"]',
    badgeId: "JADWAL KOMITMEN",
    badgeEn: "CASHFLOW CALENDAR",
    titleId: "Kalender: Arus Kas & Tagihan",
    titleEn: "Calendar: Cashflow Schedule & Bills",
    descId:
      "Peta komitmen harian dan tagihan rutin berulang. Antisipasi tanggal jatuh tempo komitmen finansial agar cadangan likuiditas bulanan Anda senantiasa aman terkendali.",
    descEn:
      "Daily cashflow runway map and recurring bill commitments. Anticipate upcoming due dates so your liquidity reserves remain safeguarded.",
    icon: Calendar,
    highlightsId: [
      "Kalender Arus Kas Harian",
      "Pengingat Tagihan Berulang",
      "Proyeksi Likuiditas Runway",
    ],
    highlightsEn: [
      "Daily Cashflow Matrix",
      "Recurring Bill Reminders",
      "Liquidity Runway Forecasting",
    ],
    proTipId:
      "Titik pada tanggal menandai jadwal tagihan. Ketuk tanggal untuk proyeksi sisa uang kas.",
    proTipEn:
      "Calendar dots mark bill due dates. Tap any date to view projected cash runway.",
    actionLabelId: "Buka Jadwal Arus Kas",
    actionLabelEn: "Open Cashflow Schedule",
  },
  {
    id: "statistics",
    path: "/statistics",
    selector: '[data-tour="nav-statistics"]',
    badgeId: "DIAGNOSTIK EKSEKUTIF",
    badgeEn: "EXECUTIVE DIAGNOSTICS",
    titleId: "Statistik: Analitik & Laporan",
    titleEn: "Statistics: Diagnostics & Reports",
    descId:
      "Diagnostik mendalam rasio tabungan, laju konsumsi kas harian, kilas balik tahunan, serta ekspor laporan Neraca Keuangan resmi format Excel dan PDF.",
    descEn:
      "Deep diagnostics of savings velocity, burn rate, cashflow trajectory, annual Wrapped review, and official Balance Sheet export to Excel and PDF.",
    icon: PieChart,
    highlightsId: [
      "Laju Konsumsi Kas & Pengeluaran",
      "Ekspor Laporan Neraca Resmi",
      "Kilas Balik Finansial Tahunan",
    ],
    highlightsEn: [
      "Spending Velocity & Burn Rate",
      "Official Report Export",
      "Annual Financial Wrapped Review",
    ],
    proTipId:
      "Buka Kilas Balik Finansial Tahunan untuk analisis menyeluruh dan unduh laporan resmi.",
    proTipEn:
      "Open Financial Wrapped for a multi-slide dossier and download your official report.",
    actionLabelId: "Mulai Eksplorasi Analisis",
    actionLabelEn: "Explore Diagnostics",
  },
];

export function ProductTourOverlay({
  isOpen,
  onClose,
  onComplete,
}: ProductTourOverlayProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const navigate = useNavigate();
  const location = useLocation();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isPeekMode, setIsPeekMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const step = useMemo(() => TOUR_STEPS[currentStepIndex], [currentStepIndex]);

  // Navigate to step page whenever currentStepIndex updates
  useEffect(() => {
    if (!isOpen || !step) return;
    if (location.pathname !== step.path) {
      navigate(step.path);
    }
  }, [isOpen, currentStepIndex, step, location.pathname, navigate]);

  // Measure target DOM element bounding rectangle
  const measureTarget = useCallback(() => {
    if (!isOpen || !step) return;
    const el = document.querySelector(step.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      setTargetRect(r);
    } else {
      setTargetRect(null);
    }
  }, [isOpen, step]);

  const prevIsOpen = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setCurrentStepIndex(0);
      setIsPeekMode(false);
      setTargetRect(null);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setIsPeekMode(false);
      measureTarget();
      const timers = [60, 160, 320, 600, 1000].map((delay) =>
        setTimeout(() => {
          measureTarget();
        }, delay),
      );
      const handleResize = () => measureTarget();
      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleResize, true);
      return () => {
        timers.forEach(clearTimeout);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleResize, true);
      };
    } else {
      setCurrentStepIndex(0);
      setTargetRect(null);
      setIsPeekMode(false);
    }
  }, [isOpen, currentStepIndex, measureTarget, location.pathname]);

  // ── Penempatan Posisi Kartu (Wajib dipanggil SEBELUM return conditional) ──
  const isTargetAtBottom = useMemo(() => {
    if (!targetRect) return true;
    return targetRect.top > window.innerHeight * 0.5;
  }, [targetRect]);

  const highlights = useMemo(() => {
    if (!step) return [];
    return isIndonesian ? step.highlightsId : step.highlightsEn;
  }, [step, isIndonesian]);

  const handleNext = useCallback(() => {
    triggerHaptic("medium");
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      triggerSuccessHaptic();
      try {
        localStorage.setItem("trouvaille_tour_completed", "true");
        localStorage.removeItem("trouvaille_tour_pending");
      } catch {}
      navigate("/");
      if (onComplete) onComplete();
      onClose();
    }
  }, [currentStepIndex, navigate, onComplete, onClose]);

  const handlePrev = useCallback(() => {
    triggerHaptic("light");
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const handleSkip = useCallback(() => {
    triggerHaptic("light");
    try {
      localStorage.setItem("trouvaille_tour_completed", "true");
      localStorage.removeItem("trouvaille_tour_pending");
    } catch {}
    navigate("/");
    onClose();
  }, [navigate, onClose]);

  // ── Early Return Aman: Semua hook telah dipanggil di atas ──
  if (!isOpen || !step) return null;

  const IconComp = step.icon;

  // ── Material Liquid Glass Apple ──
  const shellBg = isDark
    ? "linear-gradient(160deg, rgba(26, 26, 32, 0.95) 0%, rgba(14, 14, 18, 0.98) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.96) 100%)";

  const shellBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.14)"
    : "1px solid rgba(0, 0, 0, 0.08)";

  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 247, 250, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.09)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.22)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.035)";

  const paddingSpotlight = 6;
  const spotWidth = targetRect ? targetRect.width + paddingSpotlight * 2 : 0;
  const spotHeight = targetRect ? targetRect.height + paddingSpotlight * 2 : 0;
  const spotTop = targetRect ? targetRect.top - paddingSpotlight : 0;
  const spotLeft = targetRect ? targetRect.left - paddingSpotlight : 0;
  const spotRadius = targetRect && targetRect.width > 60 ? 18 : spotHeight / 2;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] overflow-hidden select-none font-sans pointer-events-auto"
      style={{ touchAction: isPeekMode ? "auto" : "none" }}
    >
      {/* ── 1. Cutout Masking SVG (Jernih & Tanpa Glow Berlebih) ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300"
        style={{ opacity: isPeekMode ? 0.04 : 1 }}
      >
        <defs>
          <mask id="tour-spotlight-cutout">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && !isPeekMode && (
              <rect
                x={spotLeft}
                y={spotTop}
                width={spotWidth}
                height={spotHeight}
                rx={spotRadius}
                fill="black"
              />
            )}
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.58)"
          mask="url(#tour-spotlight-cutout)"
        />
      </svg>

      {/* Background Click Handler */}
      <div
        className="absolute inset-0 z-10"
        onClick={() => {
          if (isPeekMode) {
            setIsPeekMode(false);
          } else {
            handleSkip();
          }
        }}
      />

      {/* ── 2. Minimalist Apple Spotlight Frame (Tanpa Glow Berlebih) ── */}
      {targetRect && !isPeekMode && (
        <motion.div
          key={`spotlight-frame-${currentStepIndex}`}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 28, stiffness: 380 }}
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute z-30 cursor-pointer active:scale-95 transition-transform"
          style={{
            top: spotTop,
            left: spotLeft,
            width: spotWidth,
            height: spotHeight,
            borderRadius: spotRadius,
            border: isDark
              ? "1.5px solid rgba(255, 255, 255, 0.85)"
              : "1.5px solid rgba(0, 0, 0, 0.85)",
            boxShadow: isDark
              ? "inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 8px rgba(0, 0, 0, 0.4)"
              : "inset 0 1px 0 #ffffff, 0 2px 8px rgba(0, 0, 0, 0.15)",
          }}
          title={isIndonesian ? "Ketuk untuk lanjut" : "Tap to continue"}
        />
      )}

      {/* ── 3. Peek Mode Minimized Island ── */}
      {isPeekMode && (
        <motion.button
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          type="button"
          onClick={() => {
            triggerHaptic("medium");
            setIsPeekMode(false);
          }}
          className="fixed left-4 right-4 z-[100000] max-w-xs mx-auto h-11 px-4 rounded-full flex items-center justify-between shadow-2xl active:scale-95 transition-all cursor-pointer"
          style={{
            bottom: "max(calc(env(safe-area-inset-bottom, 0px) + 84px), 96px)",
            background: shellBg,
            border: shellBorder,
            color: "var(--text-primary)",
            boxShadow: isDark
              ? "0 16px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.18)"
              : "0 12px 28px rgba(0,0,0,0.12), inset 0 1px 0 #ffffff",
          }}
        >
          <div className="flex items-center gap-2">
            <Eye
              size={15}
              strokeWidth={2}
              className="text-[var(--text-primary)]"
            />
            <span className="text-[12px] font-semibold tracking-tight">
              {isIndonesian ? "Lanjutkan Panduan" : "Resume Tour"}
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/[0.08] border border-[var(--glass-border)] text-[var(--text-secondary)]">
            {currentStepIndex + 1}/{TOUR_STEPS.length}
          </span>
        </motion.button>
      )}

      {/* ── 4. Main Dialog Card (Smart Top/Bottom Positioning) ── */}
      {!isPeekMode && (
        <div
          className="fixed left-4 right-4 z-40 max-w-[380px] mx-auto pointer-events-auto transition-all duration-300"
          style={{
            top: isTargetAtBottom
              ? "max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)"
              : "auto",
            bottom: !isTargetAtBottom
              ? "max(calc(env(safe-area-inset-bottom, 0px) + 84px), 96px)"
              : "auto",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`tour-card-${currentStepIndex}-${isTargetAtBottom ? "top" : "bottom"}`}
              initial={{
                opacity: 0,
                y: isTargetAtBottom ? -16 : 16,
                scale: 0.96,
              }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isTargetAtBottom ? -12 : 12, scale: 0.96 }}
              transition={{ type: "spring", damping: 30, stiffness: 380 }}
              className="p-4 sm:p-4.5 rounded-[26px] overflow-hidden relative space-y-2.5"
              style={{
                background: shellBg,
                border: shellBorder,
                boxShadow: isDark
                  ? "0 24px 60px -12px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.16)"
                  : "0 16px 40px -8px rgba(31,36,48,0.14), inset 0 1px 0 #ffffff",
                backdropFilter: "blur(28px) saturate(180%)",
                WebkitBackdropFilter: "blur(28px) saturate(180%)",
              }}
            >
              {/* Specular Rim Light */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
                style={{
                  background: isDark
                    ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), rgba(255,255,255,0.5), rgba(255,255,255,0.3), transparent)"
                    : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
                }}
              />

              {/* Top Bar: Counter, Badge & Dismiss */}
              <div className="flex items-center justify-between pb-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      color: "var(--text-primary)",
                    }}
                  >
                    0{currentStepIndex + 1} / 0{TOUR_STEPS.length}
                  </span>
                  <span
                    className="text-[9px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full"
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.03)",
                      border: controlBorder,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {isIndonesian ? step.badgeId : step.badgeEn}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setIsPeekMode(true);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      color: "var(--text-secondary)",
                    }}
                    title={isIndonesian ? "Intip Layar" : "Peek View"}
                    aria-label="Peek View"
                  >
                    <Eye size={12.5} strokeWidth={2} />
                  </button>

                  <button
                    type="button"
                    onClick={handleSkip}
                    className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      color: "var(--text-tertiary)",
                    }}
                    title={isIndonesian ? "Lewati Tur" : "Skip Tour"}
                    aria-label="Skip Tour"
                  >
                    <X size={12.5} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Title Header with Icon */}
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                    color: "var(--text-primary)",
                  }}
                >
                  <IconComp size={14} strokeWidth={1.8} />
                </div>
                <h3
                  className="text-[14px] font-bold tracking-tight leading-snug"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? step.titleId : step.titleEn}
                </h3>
              </div>

              {/* Description Body */}
              <p
                className="text-[11.5px] leading-relaxed font-normal"
                style={{ color: "var(--text-secondary)" }}
              >
                {isIndonesian ? step.descId : step.descEn}
              </p>

              {/* Micro Feature Chips */}
              <div className="flex flex-wrap gap-1 pt-0.5">
                {highlights.map((highlight, hIdx) => (
                  <div
                    key={hIdx}
                    className="px-2 py-0.5 rounded-lg text-[9.5px] font-medium flex items-center gap-1 select-none"
                    style={{
                      background: isDark
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.03)",
                      border: controlBorder,
                      color: "var(--text-primary)",
                    }}
                  >
                    <Sparkles
                      size={9}
                      strokeWidth={2}
                      className="text-[var(--text-tertiary)] shrink-0"
                    />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>

              {/* Gesture / Tip Box */}
              <div
                className="p-2 rounded-xl text-[10px] leading-relaxed flex items-start gap-1.5 select-none"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.035)"
                    : "rgba(0, 0, 0, 0.02)",
                  border: controlBorder,
                  color: "var(--text-secondary)",
                }}
              >
                <Compass
                  size={12}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)] shrink-0 mt-0.5"
                />
                <div className="leading-tight">
                  <span className="font-semibold text-[var(--text-primary)] mr-1">
                    {isIndonesian ? "Tips Gestur:" : "Gesture Tip:"}
                  </span>
                  <span>{isIndonesian ? step.proTipId : step.proTipEn}</span>
                </div>
              </div>

              {/* Step Controls Footer */}
              <div className="flex items-center justify-between pt-1.5 border-t border-[var(--glass-border)]/40">
                {/* Dots Indicator */}
                <div className="flex items-center gap-1">
                  {TOUR_STEPS.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setCurrentStepIndex(idx);
                      }}
                      className="h-1 rounded-full transition-all duration-200 cursor-pointer p-0 border-0"
                      style={{
                        width: idx === currentStepIndex ? "14px" : "4px",
                        background:
                          idx === currentStepIndex
                            ? "var(--text-primary)"
                            : "var(--glass-border)",
                      }}
                      aria-label={`Step ${idx + 1}`}
                    />
                  ))}
                </div>

                {/* Back / Next Buttons */}
                <div className="flex items-center gap-1.5">
                  {currentStepIndex > 0 && (
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="h-7 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-0.5 active:scale-95 transition-transform cursor-pointer"
                      style={{
                        background: controlBg,
                        border: controlBorder,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <ChevronLeft size={12} strokeWidth={2} />
                      <span>{isIndonesian ? "Kembali" : "Back"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleNext}
                    className="h-7 px-3 rounded-full text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-transform cursor-pointer shadow-sm select-none"
                    style={{
                      background: isDark ? "#ffffff" : "#18181b",
                      color: isDark ? "#000000" : "#ffffff",
                    }}
                  >
                    {currentStepIndex === TOUR_STEPS.length - 1 ? (
                      <>
                        <Check size={11.5} strokeWidth={2.8} />
                        <span>{isIndonesian ? "Selesai" : "Done"}</span>
                      </>
                    ) : (
                      <>
                        <span>{isIndonesian ? "Lanjut" : "Next"}</span>
                        <ChevronRight size={12} strokeWidth={2} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
