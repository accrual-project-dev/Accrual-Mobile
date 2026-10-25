import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Mic,
  Camera,
  KeyRound,
  Sparkles,
  Shield,
  Lock,
  Check,
  Layers,
  User,
  Activity,
} from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import type { ShowcaseSlide } from "./loginAuthHelpers";
import { cn } from "../../lib/utils";

export interface DynamicShowcaseCapsuleProps {
  currentSlide: ShowcaseSlide;
  isDark: boolean;
  isIndonesian: boolean;
  chartGradientId: string;
  onNext: () => void;
  onPrev: () => void;
}

export function DynamicShowcaseCapsule({
  currentSlide,
  isDark,
  isIndonesian,
  chartGradientId,
  onNext,
  onPrev,
}: DynamicShowcaseCapsuleProps) {
  const [isInteracted, setIsInteracted] = useState(false);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      onDragEnd={(_, info) => {
        if (info.offset.x < -40) {
          triggerHaptic("light");
          onNext();
        } else if (info.offset.x > 40) {
          triggerHaptic("light");
          onPrev();
        }
      }}
      onClick={() => {
        triggerHaptic("light");
        setIsInteracted((prev) => !prev);
      }}
      className="relative w-full max-w-[355px] sm:max-w-[380px] min-h-[195px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
    >
      <AnimatePresence mode="wait">
        {/* ── SLIDE 0: MINIMALIST LIQUID GLASS HORIZON & LIVE SPLINE ── */}
        {currentSlide.visual === "chart" && (
          <motion.div
            key="chart"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "w-full rounded-[26px] p-4 sm:p-4.5 border flex flex-col gap-2.5 transition-colors relative overflow-hidden",
              isDark
                ? "bg-[#141418]/70 border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                : "bg-white/75 border-black/[0.06] shadow-[inset_0_1.5px_0_#ffffff,0_2px_12px_rgba(0,0,0,0.03)]",
            )}
            style={{
              backdropFilter: "blur(32px) saturate(180%)",
              WebkitBackdropFilter: "blur(32px) saturate(180%)",
            }}
          >
            {/* Header: Label + Pill Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center border",
                    isDark
                      ? "bg-white/10 border-white/15"
                      : "bg-black/[0.04] border-black/8",
                  )}
                >
                  <TrendingUp
                    size={11}
                    strokeWidth={2}
                    className={isDark ? "text-white" : "text-zinc-900"}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11.5px] font-semibold tracking-tight",
                    isDark ? "text-white/85" : "text-zinc-800",
                  )}
                >
                  {isIndonesian ? "Trajektori Arus Kas" : "Cashflow Trajectory"}
                </span>
              </div>

              <div
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight border",
                  isDark
                    ? "bg-white/[0.08] border-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                    : "bg-black/[0.04] border-black/8 text-zinc-900 shadow-[inset_0_1px_0_#ffffff]",
                )}
              >
                {isIndonesian ? "+28.4% Bersih" : "+28.4% Net Inflow"}
              </div>
            </div>

            {/* Spline Curve Visualizer */}
            <div className="relative h-24 w-full flex items-center justify-center overflow-hidden rounded-xl">
              <svg
                viewBox="0 0 320 95"
                className="w-full h-full overflow-visible select-none"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient
                    id={`${chartGradientId}-spline`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={isDark ? "#ffffff" : "#09090b"}
                      stopOpacity={isDark ? 0.2 : 0.08}
                    />
                    <stop
                      offset="100%"
                      stopColor={isDark ? "#ffffff" : "#09090b"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <path
                  d="M 0 76 Q 40 54, 80 58 T 160 36 T 240 20 T 320 32 L 320 95 L 0 95 Z"
                  fill={`url(#${chartGradientId}-spline)`}
                />
                <path
                  d="M 0 76 Q 40 54, 80 58 T 160 36 T 240 20 T 320 32"
                  fill="none"
                  stroke={isDark ? "#ffffff" : "#09090b"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Focus Target Dot */}
                <circle
                  cx="240"
                  cy="20"
                  r="7.5"
                  fill={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)"}
                />
                <circle
                  cx="240"
                  cy="20"
                  r="4"
                  fill={isDark ? "#ffffff" : "#09090b"}
                />
              </svg>
            </div>

            {/* Scale Timeline */}
            <div
              className={cn(
                "flex items-center justify-between text-[9.5px] font-semibold tracking-wider px-1 pt-1.5 border-t",
                isDark
                  ? "border-white/[0.06] text-white/40"
                  : "border-black/[0.05] text-zinc-400",
              )}
            >
              <span>{isIndonesian ? "Jan" : "Jan"}</span>
              <span>{isIndonesian ? "Apr" : "Apr"}</span>
              <span>{isIndonesian ? "Jul" : "Jul"}</span>
              <span>{isIndonesian ? "Okt" : "Oct"}</span>
              <span>{isIndonesian ? "Des" : "Dec"}</span>
            </div>
          </motion.div>
        )}

        {/* ── SLIDE 1: 3 CASCADING LIQUID GLASS PILLS ── */}
        {currentSlide.visual === "voice" && (
          <motion.div
            key="voice"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col gap-2 items-center justify-center py-1"
          >
            {/* Pill 1: Dikte Suara */}
            <motion.div
              animate={{
                x: isInteracted ? -12 : -8,
                y: isInteracted ? -2 : 0,
              }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className={cn(
                "w-[94%] rounded-full py-2 px-3.5 border flex items-center justify-between transition-colors",
                isDark
                  ? "bg-white/[0.05] border-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                  : "bg-white/80 border-black/[0.06] text-zinc-900 shadow-[inset_0_1.5px_0_#ffffff]",
              )}
              style={{
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center border",
                    isDark
                      ? "bg-white/10 border-white/15"
                      : "bg-black/[0.04] border-black/8",
                  )}
                >
                  <Mic size={11} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold tracking-tight">
                  {isIndonesian ? "Dikte Suara" : "Voice Dictation"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {[10, 16, 22, 14, 20, 12].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: isInteracted
                        ? [h * 0.6, h * 1.3, h]
                        : [h * 0.8, h, h * 0.9],
                    }}
                    transition={{
                      repeat: Infinity,
                      repeatType: "reverse",
                      duration: 0.6 + i * 0.1,
                    }}
                    className={cn(
                      "w-0.5 rounded-full",
                      isDark ? "bg-white/70" : "bg-zinc-800",
                    )}
                    style={{ height: `${h}px` }}
                  />
                ))}
                <span
                  className={cn(
                    "text-[9px] font-mono ml-1.5 px-1.5 py-0.5 rounded-md",
                    isDark
                      ? "bg-white/10 text-white/80"
                      : "bg-black/5 text-zinc-700",
                  )}
                >
                  {isIndonesian ? '"Kopi 35rb"' : '"$4.50 Coffee"'}
                </span>
              </div>
            </motion.div>

            {/* Pill 2: Pindai Bukti Bayar */}
            <motion.div
              animate={{
                x: isInteracted ? 14 : 8,
                scale: isInteracted ? 1.01 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 360,
                damping: 28,
                delay: 0.03,
              }}
              className={cn(
                "w-[98%] rounded-full py-2.5 px-4 border flex items-center justify-between z-10 transition-colors",
                isDark
                  ? "bg-[#18181d]/85 border-white/[0.16] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : "bg-white border-black/[0.08] text-zinc-950 shadow-[inset_0_1.5px_0_#ffffff,0_2px_8px_rgba(0,0,0,0.03)]",
              )}
              style={{
                backdropFilter: "blur(28px)",
                WebkitBackdropFilter: "blur(28px)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center border",
                    isDark
                      ? "bg-white/12 border-white/20"
                      : "bg-black/5 border-black/10",
                  )}
                >
                  <Camera size={12} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[11.5px] font-bold tracking-tight leading-none">
                    {isIndonesian
                      ? "Pindai Bukti Bayar"
                      : "Receipt Camera Scan"}
                  </div>
                  <div
                    className={cn(
                      "text-[8.5px] mt-0.5 font-medium",
                      isDark ? "text-white/50" : "text-zinc-500",
                    )}
                  >
                    {isIndonesian
                      ? "Ekstraksi OCR Otomatis"
                      : "Instant OCR Engine"}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide border",
                  isDark
                    ? "bg-white/10 border-white/15 text-white"
                    : "bg-black/5 border-black/10 text-zinc-900",
                )}
              >
                {isIndonesian ? "< 1 Detik" : "< 1s Engine"}
              </div>
            </motion.div>

            {/* Pill 3: Preset Cepat */}
            <motion.div
              animate={{
                x: isInteracted ? -6 : -2,
                y: isInteracted ? 2 : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 360,
                damping: 28,
                delay: 0.06,
              }}
              className={cn(
                "w-[90%] rounded-full py-1.5 px-3.5 border flex items-center justify-between transition-colors",
                isDark
                  ? "bg-white/[0.03] border-white/[0.08] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                  : "bg-white/70 border-black/[0.05] text-zinc-800 shadow-[inset_0_1px_0_#ffffff]",
              )}
              style={{
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-4.5 h-4.5 rounded-full flex items-center justify-center border",
                    isDark
                      ? "bg-white/8 border-white/10"
                      : "bg-black/4 border-black/6",
                  )}
                >
                  <Sparkles size={9} strokeWidth={2} />
                </div>
                <span className="text-[10px] font-medium">
                  {isIndonesian ? "Preset 1-Ketuk" : "1-Tap Preset"}
                </span>
              </div>

              <span className="text-[10.5px] font-bold tabular-nums">
                {isIndonesian ? "Rp 50.000" : "$50.00"}
              </span>
            </motion.div>
          </motion.div>
        )}

        {/* ── SLIDE 2: CRYPTOGRAPHIC CRYSTALLINE PLATE WITH 3 DIES ── */}
        {currentSlide.visual === "vault" && (
          <motion.div
            key="vault"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "w-full rounded-[26px] p-4 sm:p-4.5 border flex flex-col gap-3 transition-colors relative overflow-hidden",
              isDark
                ? "bg-[#141418]/70 border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                : "bg-white/75 border-black/[0.06] shadow-[inset_0_1.5px_0_#ffffff,0_2px_12px_rgba(0,0,0,0.03)]",
            )}
            style={{
              backdropFilter: "blur(32px) saturate(180%)",
              WebkitBackdropFilter: "blur(32px) saturate(180%)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center border",
                    isDark
                      ? "bg-white/10 border-white/15"
                      : "bg-black/[0.04] border-black/8",
                  )}
                >
                  <Shield
                    size={11}
                    strokeWidth={2}
                    className={isDark ? "text-white" : "text-zinc-900"}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-tight",
                    isDark ? "text-white/85" : "text-zinc-800",
                  )}
                >
                  {isIndonesian
                    ? "Brankas Kriptografi Klien"
                    : "Client Cryptographic Vault"}
                </span>
              </div>

              <div
                className={cn(
                  "px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-tight border",
                  isDark
                    ? "bg-white/[0.08] border-white/15 text-white"
                    : "bg-black/[0.04] border-black/8 text-zinc-900",
                )}
              >
                {isIndonesian ? "Terkunci" : "Sealed"}
              </div>
            </div>

            {/* 3 Translucent Frosted Dies */}
            <div className="grid grid-cols-3 gap-2 py-0.5">
              {[
                {
                  icon: Lock,
                  title: "AES-256",
                  desc: isIndonesian ? "Klien GCM" : "Client GCM",
                },
                {
                  icon: Check,
                  title: "Zero-Log",
                  desc: isIndonesian ? "Privasi Nol" : "Zero Trace",
                },
                {
                  icon: KeyRound,
                  title: "Enclave",
                  desc: isIndonesian ? "Kunci Lokal" : "Device Key",
                },
              ].map((die, idx) => {
                const Icon = die.icon;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "p-2.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-1 transition-colors",
                      isDark
                        ? "bg-white/[0.035] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "bg-white/80 border-black/[0.06] shadow-[inset_0_1px_0_#ffffff]",
                    )}
                  >
                    <Icon
                      size={12}
                      className={isDark ? "text-white/85" : "text-zinc-850"}
                    />
                    <span className="text-[10px] font-bold tracking-tight leading-tight">
                      {die.title}
                    </span>
                    <span
                      className={cn(
                        "text-[8.5px] leading-tight",
                        isDark ? "text-white/50" : "text-zinc-500",
                      )}
                    >
                      {die.desc}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Micro Caption */}
            <div
              className={cn(
                "text-center py-1 rounded-xl text-[9px] font-medium border",
                isDark
                  ? "border-white/[0.06] text-white/45"
                  : "border-black/[0.05] text-zinc-500",
              )}
            >
              {isIndonesian
                ? "Kunci dekripsi tidak pernah meninggalkan memori perangkat"
                : "Decryption keys strictly confined to local device memory"}
            </div>
          </motion.div>
        )}

        {/* ── SLIDE 3: SPACE ISOLATION SPLIT TILES ── */}
        {currentSlide.visual === "domain" && (
          <motion.div
            key="domain"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col gap-2 items-center"
          >
            {/* Header */}
            <div className="w-full flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center border",
                    isDark
                      ? "bg-white/10 border-white/15"
                      : "bg-black/[0.04] border-black/8",
                  )}
                >
                  <Layers
                    size={11}
                    strokeWidth={2}
                    className={isDark ? "text-white" : "text-zinc-900"}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-tight",
                    isDark ? "text-white/85" : "text-zinc-800",
                  )}
                >
                  {isIndonesian ? "Pemisahan Space" : "Space Isolation"}
                </span>
              </div>

              <div
                className={cn(
                  "px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-tight border",
                  isDark
                    ? "bg-white/[0.08] border-white/15 text-white"
                    : "bg-black/[0.04] border-black/8 text-zinc-900",
                )}
              >
                {isIndonesian ? "Partisi Tegas" : "Strict Partition"}
              </div>
            </div>

            {/* Split Bento Slabs */}
            <div className="w-full flex items-center justify-between gap-2.5 pt-0.5">
              {/* Personal Slab */}
              <motion.div
                animate={{ y: isInteracted ? -3 : 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className={cn(
                  "flex-1 rounded-[20px] p-3 border flex flex-col justify-between transition-colors",
                  isDark
                    ? "bg-[#141418]/70 border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                    : "bg-white/80 border-black/[0.06] shadow-[inset_0_1.5px_0_#ffffff]",
                )}
                style={{
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center border",
                      isDark
                        ? "bg-white/10 border-white/12"
                        : "bg-black/[0.04] border-black/6",
                    )}
                  >
                    <User
                      size={9}
                      className={isDark ? "text-white/80" : "text-zinc-800"}
                    />
                  </div>
                  <span className="text-[10.5px] font-semibold tracking-tight">
                    {isIndonesian ? "Pribadi" : "Personal"}
                  </span>
                </div>
                <div className="text-[13.5px] font-bold tabular-nums tracking-tight">
                  {isIndonesian ? "Rp 64,5 Jt" : "$4,250.00"}
                </div>
                <span
                  className={cn(
                    "text-[8.5px] mt-0.5 font-medium",
                    isDark ? "text-white/45" : "text-zinc-500",
                  )}
                >
                  {isIndonesian
                    ? "Gaya hidup & keluarga"
                    : "Household & Living"}
                </span>
              </motion.div>

              {/* Venture Slab */}
              <motion.div
                animate={{ y: isInteracted ? 3 : 0 }}
                transition={{
                  type: "spring",
                  stiffness: 360,
                  damping: 28,
                  delay: 0.03,
                }}
                className={cn(
                  "flex-1 rounded-[20px] p-3 border flex flex-col justify-between transition-colors",
                  isDark
                    ? "bg-[#18181d]/85 border-white/[0.15] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                    : "bg-white border-black/[0.08] shadow-[inset_0_1.5px_0_#ffffff,0_2px_8px_rgba(0,0,0,0.03)]",
                )}
                style={{
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center border",
                      isDark
                        ? "bg-white/10 border-white/12"
                        : "bg-black/[0.04] border-black/6",
                    )}
                  >
                    <Activity
                      size={9}
                      className={isDark ? "text-white/80" : "text-zinc-800"}
                    />
                  </div>
                  <span className="text-[10.5px] font-semibold tracking-tight">
                    {isIndonesian ? "Usaha" : "Venture"}
                  </span>
                </div>
                <div className="text-[13.5px] font-bold tabular-nums tracking-tight">
                  {isIndonesian ? "Rp 285 Jt" : "$18,920.00"}
                </div>
                <span
                  className={cn(
                    "text-[8.5px] mt-0.5 font-medium",
                    isDark ? "text-white/45" : "text-zinc-500",
                  )}
                >
                  {isIndonesian
                    ? "Operasional & faktur"
                    : "Operations & Invoices"}
                </span>
              </motion.div>
            </div>

            {/* Micro Caption */}
            <div
              className={cn(
                "w-full text-center py-1 rounded-xl text-[9px] font-medium border",
                isDark
                  ? "border-white/[0.06] text-white/40"
                  : "border-black/[0.05] text-zinc-500",
              )}
            >
              {isIndonesian
                ? "Batas isolasi mencegah kontaminasi saldo antar space"
                : "Strict firewall prevents cross-space contamination"}
            </div>
          </motion.div>
        )}

        {/* ── SLIDE 4: TELEMETRY RUNWAY PROGRESS TILE ── */}
        {currentSlide.visual === "runway" && (
          <motion.div
            key="runway"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "w-full rounded-[26px] p-4 sm:p-4.5 border flex flex-col gap-3 transition-colors relative overflow-hidden",
              isDark
                ? "bg-[#141418]/70 border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                : "bg-white/75 border-black/[0.06] shadow-[inset_0_1.5px_0_#ffffff,0_2px_12px_rgba(0,0,0,0.03)]",
            )}
            style={{
              backdropFilter: "blur(32px) saturate(180%)",
              WebkitBackdropFilter: "blur(32px) saturate(180%)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center border",
                    isDark
                      ? "bg-white/10 border-white/15"
                      : "bg-black/[0.04] border-black/8",
                  )}
                >
                  <Sparkles
                    size={11}
                    strokeWidth={2}
                    className={isDark ? "text-white" : "text-zinc-900"}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-tight",
                    isDark ? "text-white/85" : "text-zinc-800",
                  )}
                >
                  {isIndonesian ? "Ketahanan Finansial" : "Runway Telemetry"}
                </span>
              </div>

              <div
                className={cn(
                  "px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-tight border",
                  isDark
                    ? "bg-white/[0.08] border-white/15 text-white"
                    : "bg-black/[0.04] border-black/8 text-zinc-900",
                )}
              >
                {isIndonesian ? "Aman" : "Safe Zone"}
              </div>
            </div>

            {/* Progress Container */}
            <div
              className={cn(
                "p-3 rounded-xl border flex flex-col gap-2",
                isDark
                  ? "bg-white/[0.03] border-white/[0.08]"
                  : "bg-black/[0.025] border-black/6",
              )}
            >
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[24px] font-bold tracking-tight leading-none tabular-nums">
                    8.4
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isDark ? "text-white/60" : "text-zinc-600",
                    )}
                  >
                    {isIndonesian ? "bulan cadangan" : "months runway"}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-mono",
                    isDark ? "text-white/45" : "text-zinc-500",
                  )}
                >
                  {isIndonesian ? "Target: 6 Bln" : "Target: 6 Mo"}
                </span>
              </div>

              {/* Minimal Progress Bar */}
              <div
                className={cn(
                  "h-2 w-full rounded-full overflow-hidden p-[0.5px] border",
                  isDark
                    ? "bg-black/30 border-white/10"
                    : "bg-zinc-200 border-black/8",
                )}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "70%" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    isDark ? "bg-white" : "bg-zinc-950",
                  )}
                />
              </div>
            </div>

            {/* Dual Micro Metrics */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div
                className={cn(
                  "flex-1 text-center py-1.5 rounded-xl text-[10px] font-semibold border",
                  isDark
                    ? "bg-white/[0.03] border-white/8 text-white/60"
                    : "bg-black/[0.02] border-black/6 text-zinc-600",
                )}
              >
                {isIndonesian ? "Pengeluaran: Aman" : "Burn Rate: Stable"}
              </div>
              <div
                className={cn(
                  "flex-1 text-center py-1.5 rounded-xl text-[10px] font-semibold border",
                  isDark
                    ? "bg-white/[0.03] border-white/8 text-white/60"
                    : "bg-black/[0.02] border-black/6 text-zinc-600",
                )}
              >
                {isIndonesian
                  ? "Dana Darurat: 140%"
                  : "Emergency Reserve: 140%"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
