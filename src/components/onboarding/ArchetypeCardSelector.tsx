import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  PieChart,
  Layers,
  TrendingUp,
  Sparkles,
  type LucideIcon,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import type { HomePresetKey } from "../../lib/widgetLayoutTypes";
import { useLanguage } from "../../contexts/LanguageContext";

export interface ArchetypeItem {
  key: string;
  chipLabel: string;
  title: string;
  desc: string;
  badge: string;
  metric: string;
  subMetric: string;
  widgetPreset: HomePresetKey;
  icon: LucideIcon;
  visualType: "voice_flow" | "budget_gauge" | "domain_split" | "wealth_spline" | "executive_grid";
}

export function getArchetypeItems(isIndonesian: boolean): ArchetypeItem[] {
  return [
    {
      key: "expenses",
      chipLabel: isIndonesian ? "Arus Harian" : "Daily Flow",
      title: isIndonesian ? "Arus Kas & Pengeluaran Harian" : "Daily Expenses & Cashflow",
      desc: isIndonesian
        ? "Pencatatan cepat tanpa hambatan untuk memantau pengeluaran harian."
        : "Fast, distraction-free logging to monitor everyday burn rate.",
      badge: isIndonesian ? "Minimalis" : "Minimalist",
      metric: isIndonesian ? "Rp 140 Rb / hari" : "$15 / day",
      subMetric: isIndonesian
        ? "Masukan suara & kamera sub-detik"
        : "Sub-second voice & camera entry",
      widgetPreset: "minimal",
      icon: Zap,
      visualType: "voice_flow",
    },
    {
      key: "budget",
      chipLabel: isIndonesian ? "Disiplin Anggaran" : "Budget Guard",
      title: isIndonesian ? "Anggaran & Disiplin Menabung" : "Budgeting & Savings Discipline",
      desc: isIndonesian
        ? "Terapkan batas pengeluaran kategori dan lindungi dana darurat."
        : "Enforce category spending caps and protect emergency reserve buffers.",
      badge: isIndonesian ? "Pengawas" : "Guardian",
      metric: isIndonesian ? "64% Batas Terpakai" : "64% Cap Used",
      subMetric: isIndonesian
        ? "Peringatan batas & proteksi dana darurat"
        : "Spending limit alerts & buffer protection",
      widgetPreset: "minimal",
      icon: PieChart,
      visualType: "budget_gauge",
    },
    {
      key: "domain",
      chipLabel: isIndonesian ? "Pemisahan Ruang Kas" : "Dual Space",
      title: isIndonesian ? "Pemisahan Ruang Kas Pribadi & Usaha" : "Dual Space Separation",
      desc: isIndonesian
        ? "Pisahkan secara tegas kas pribadi dari pembukuan bisnis dan proyek sampingan."
        : "Strictly partition personal living outlays from venture & side-project books.",
      badge: isIndonesian ? "Terpartisi" : "Partitioned",
      metric: isIndonesian ? "Pribadi ↔ Bisnis" : "Personal ↔ Venture",
      subMetric: isIndonesian
        ? "Isolasi ruang kas tanpa percampuran dana"
        : "Zero co-mingling space isolation",
      widgetPreset: "executive",
      icon: Layers,
      visualType: "domain_split",
    },
    {
      key: "wealth",
      chipLabel: isIndonesian ? "Brankas Aset" : "Wealth Vault",
      title: isIndonesian ? "Kekayaan Bersih & Telemetri Aset" : "Net Worth & Asset Intelligence",
      desc: isIndonesian
        ? "Pantau laju portofolio, alokasi investasi, dan ketahanan finansial."
        : "Monitor portfolio velocity, investment allocation, and financial runway.",
      badge: isIndonesian ? "Kecerdasan" : "Intelligence",
      metric: "+24.8% YoY",
      subMetric: isIndonesian
        ? "Telemetri multivariat & daya tahan dana"
        : "Multi-currency & runway telemetry",
      widgetPreset: "executive",
      icon: TrendingUp,
      visualType: "wealth_spline",
    },
    {
      key: "complete",
      chipLabel: isIndonesian ? "Eksekutif" : "Executive",
      title: isIndonesian ? "Komando Finansial Menyeluruh" : "Complete Financial Command",
      desc: isIndonesian
        ? "Rangkaian dasbor lengkap dengan proyeksi arus kas dan analitik mendalam."
        : "All-in-one comprehensive telemetry suite with forecasting and full analytics.",
      badge: isIndonesian ? "Eksekutif" : "Executive",
      metric: isIndonesian ? "12 Widget Telemetri" : "12 Telemetry Widgets",
      subMetric: isIndonesian
        ? "Sankey, simulasi utang & analitik mendalam"
        : "Sankey, debt simulators & deep analytics",
      widgetPreset: "executive",
      icon: Sparkles,
      visualType: "executive_grid",
    },
  ];
}

export const ARCHETYPE_ITEMS: ArchetypeItem[] = getArchetypeItems(false);

interface ArchetypeCardSelectorProps {
  items?: ArchetypeItem[];
  activeIndex?: number;
  onActiveChange?: (item: ArchetypeItem, index: number) => void;
  className?: string;
}

export function ArchetypeCardSelector({
  items,
  activeIndex = 0,
  onActiveChange,
  className,
}: ArchetypeCardSelectorProps) {
  const { isIndonesian } = useLanguage();
  const activeItems = items || getArchetypeItems(isIndonesian);
  const [currentIndex, setCurrentIndex] = useState(activeIndex);
  const touchStartX = useRef(0);

  const currentItem = activeItems[currentIndex] || activeItems[0]!;

  const handleSelectIndex = (index: number) => {
    if (index === currentIndex) return;
    triggerHaptic("light");
    setCurrentIndex(index);
    onActiveChange?.(activeItems[index]!, index);
  };

  const handleNext = () => {
    if (currentIndex < activeItems.length - 1) {
      handleSelectIndex(currentIndex + 1);
    } else {
      handleSelectIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      handleSelectIndex(currentIndex - 1);
    } else {
      handleSelectIndex(activeItems.length - 1);
    }
  };

  return (
    <div className={cn("w-full flex flex-col select-none space-y-3.5", className)}>
      {/* ============================================================ */}
      {/* 1. HORIZONTAL SEGMENTED PILL SELECTOR                        */}
      {/* ============================================================ */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
        {activeItems.map((item, idx) => {
          const isSelected = idx === currentIndex;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelectIndex(idx)}
              className={cn(
                "relative py-1.5 px-3 rounded-full text-[11.5px] font-medium transition-all duration-200 cursor-pointer shrink-0 flex items-center gap-1.5 border",
                isSelected
                  ? "text-white border-white/30 bg-white/[0.08] shadow-[0_2px_12px_rgba(255,255,255,0.12)]"
                  : "text-white/45 border-transparent hover:text-white/70 hover:bg-white/[0.03]"
              )}
            >
              <Icon
                size={12}
                strokeWidth={isSelected ? 2 : 1.5}
                className={isSelected ? "text-white" : "text-white/40"}
              />
              <span className="whitespace-nowrap">{item.chipLabel}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* 2. FULL-WIDTH LUXURY HERO TELEMETRY CARD (SWIPEABLE)         */}
      {/* ============================================================ */}
      <div
        className="w-full relative"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const deltaX = e.changedTouches[0].clientX - touchStartX.current;
          if (deltaX < -45) handleNext();
          if (deltaX > 45) handlePrev();
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.key}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full rounded-[24px] p-4 sm:p-5 relative overflow-hidden border border-white/16 flex flex-col justify-between"
            style={{
              background: `
                radial-gradient(ellipse 120% 80% at 50% -20%, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 60%, transparent 85%),
                linear-gradient(160deg, rgba(24, 24, 28, 0.92) 0%, rgba(10, 10, 14, 0.98) 100%)
              `,
              boxShadow:
                "0 14px 34px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255, 255, 255, 0.18)",
            }}
          >
            {/* Ambient Corner Accent Bloom */}
            <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-white/[0.04] blur-2xl pointer-events-none" />

            {/* Card Header: Icon & Badge */}
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-[13px] bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-sm">
                  <currentItem.icon size={16} strokeWidth={1.75} />
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold text-white leading-tight">
                    {currentItem.title}
                  </div>
                  <div className="text-[10.5px] text-white/45">
                    {currentItem.subMetric}
                  </div>
                </div>
              </div>

              <span className="text-[9.5px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/15 shrink-0 tracking-wide uppercase">
                {currentItem.badge}
              </span>
            </div>

            {/* Card Visual Telemetry Stage (Spacious High-End Display) */}
            <div className="my-2.5 py-3 px-3 rounded-[18px] bg-white/[0.03] border border-white/[0.08] relative z-10 flex items-center justify-center min-h-[92px]">
              {currentItem.visualType === "voice_flow" && (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-center gap-1.5 h-8">
                    {[8, 14, 24, 12, 28, 18, 10, 22, 16, 26, 12, 18, 9].map((h, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full bg-white/80 animate-pulse"
                        style={{
                          height: `${h}px`,
                          animationDelay: `${i * 70}ms`,
                          animationDuration: "1.2s",
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span className="text-[10px] font-medium text-white/70 tracking-wide">
                      {isIndonesian
                        ? "Pencatatan sub-detik aktif · Sinkronisasi suara & kamera"
                        : "Sub-second capture active · Voice & OCR receipt sync"}
                    </span>
                  </div>
                </div>
              )}

              {currentItem.visualType === "budget_gauge" && (
                <div className="w-full space-y-2.5 px-1">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-white/60 font-medium">
                      {isIndonesian ? "Batas Belanja Kategori" : "Category Spending Cap"}
                    </span>
                    <span className="text-white font-semibold amount">
                      {isIndonesian ? "Rp 3,2 Jt / Rp 5,0 Jt" : "$3.2K / $5.0K"}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                    <div
                      className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                      style={{ width: "64%" }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/45">
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={11} className="text-white/70" />
                      {isIndonesian ? "Cadangan Dana Aman" : "Reserve Buffer Protected"}
                    </span>
                    <span className="text-white/80 font-medium">
                      {isIndonesian ? "36% Belum Terpakai" : "36% Unspent Safe"}
                    </span>
                  </div>
                </div>
              )}

              {currentItem.visualType === "domain_split" && (
                <div className="w-full grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-[13px] bg-white/[0.04] border border-white/10">
                    <span className="text-[9.5px] font-medium text-white/50 block mb-0.5">
                      {isIndonesian ? "Ruang Kas Pribadi" : "Personal Space"}
                    </span>
                    <span className="text-[13px] font-semibold text-white amount block">
                      {isIndonesian ? "Rp 8.450.000" : "$8,450.00"}
                    </span>
                    <span className="text-[8.5px] text-white/40 block mt-0.5">
                      {isIndonesian ? "Kebutuhan & Gaya Hidup" : "Living & Lifestyle"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[13px] bg-white/[0.04] border border-white/10">
                    <span className="text-[9.5px] font-medium text-white/50 block mb-0.5">
                      {isIndonesian ? "Ruang Kas Usaha" : "Business Space"}
                    </span>
                    <span className="text-[13px] font-semibold text-white amount block">
                      {isIndonesian ? "Rp 24.120.000" : "$24,120.00"}
                    </span>
                    <span className="text-[8.5px] text-white/40 block mt-0.5">
                      {isIndonesian ? "Proyek & Operasional" : "Projects & Business"}
                    </span>
                  </div>
                </div>
              )}

              {currentItem.visualType === "wealth_spline" && (
                <div className="w-full space-y-1">
                  <div className="w-full h-10 flex items-center justify-center">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 240 32">
                      <defs>
                        <linearGradient id="splineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 4 28 Q 60 25, 120 16 T 200 8 T 236 4"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle cx="236" cy="4" r="3" fill="#ffffff" />
                      <circle
                        cx="236"
                        cy="4"
                        r="6"
                        fill="#ffffff"
                        className="animate-ping opacity-60"
                      />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/50 px-1">
                    <span>
                      {isIndonesian ? "Laju Portofolio: +24,8% YoY" : "Portfolio Velocity: +24.8% YoY"}
                    </span>
                    <span className="text-white/80 font-medium">
                      {isIndonesian ? "Ketahanan: 18 Bln" : "Runway: 18 Mo"}
                    </span>
                  </div>
                </div>
              )}

              {currentItem.visualType === "executive_grid" && (
                <div className="w-full grid grid-cols-3 gap-1.5">
                  {[
                    { label: isIndonesian ? "Arus Kas" : "Cashflow", val: isIndonesian ? "+14,2 Jt" : "+$1.2K" },
                    { label: isIndonesian ? "Beban Harian" : "Burn Rate", val: isIndonesian ? "140 Rb/hr" : "$15/d" },
                    { label: isIndonesian ? "Aliran Sankey" : "Sankey Flow", val: isIndonesian ? "Aktif" : "Active" },
                    { label: isIndonesian ? "Proteksi Utang" : "Debt Guard", val: isIndonesian ? "0 Risiko" : "0 Risk" },
                    { label: isIndonesian ? "Ketahanan" : "Runway", val: isIndonesian ? "22 Bln" : "22 Mo" },
                    { label: isIndonesian ? "Alokasi" : "Allocation", val: isIndonesian ? "Seimbang" : "Balanced" },
                  ].map((cell, i) => (
                    <div
                      key={i}
                      className="py-1 px-1.5 rounded-lg bg-white/[0.04] border border-white/8 text-center"
                    >
                      <div className="text-[8px] text-white/40 uppercase tracking-tight truncate">
                        {cell.label}
                      </div>
                      <div className="text-[10px] font-semibold text-white amount truncate">
                        {cell.val}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card Footer: Highlight Metric & Value Proposition */}
            <div className="flex items-end justify-between pt-1 relative z-10">
              <div className="space-y-0.5">
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider block">
                  {isIndonesian ? "Target Terkalibrasi" : "Calibrated Target"}
                </span>
                <div className="text-[17px] font-semibold text-white tracking-tight amount">
                  {currentItem.metric}
                </div>
              </div>

              <div className="text-right max-w-[200px]">
                <p className="text-[11px] text-white/55 leading-snug">
                  {currentItem.desc}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
