// ======================================================================
// TROUVAILLE — DYNAMIC ISLAND HUD
// Physical Liquid Glass Capsule
// ======================================================================

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Pencil, X, Users, ArrowRight } from "lucide-react";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { TransactionType } from "../../types";
import { triggerHaptic } from "../../lib/haptics";

export interface DynamicIslandHUDData {
  amount: number;
  type?: TransactionType;
  categoryName?: string;
  walletName?: string;
  date?: string;
  note?: string;
  source?: "shortcut" | "shortcut_draft" | "partner_sync";
  partnerName?: string;
  ledgerId?: string;
  ledgerName?: string;
  spaceName?: string;
  draftCount?: number;
}

export type ShortcutRecordedTxData = DynamicIslandHUDData;

interface DynamicIslandHUDProps {
  data: DynamicIslandHUDData | null;
  onClose: () => void;
  onEdit?: () => void;
  onViewLedger?: (ledgerId: string) => void;
}

export function DynamicIslandHUD({
  data,
  onClose,
  onEdit,
  onViewLedger,
}: DynamicIslandHUDProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const { formatWithPreferred } = useCurrency();

  const isDark = theme !== "light";
  const isPartnerSync = data?.source === "partner_sync";

  // ====================================================================
  // AUTO DISMISS — ORIGINAL LOGIC
  // ====================================================================

  useEffect(() => {
    if (!data) return;

    triggerHaptic("medium");

    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [data, onClose]);

  // ====================================================================
  // CLICK BEHAVIOR — ORIGINAL LOGIC
  // ====================================================================

  const handleCardClick = () => {
    if (isPartnerSync && data?.ledgerId && onViewLedger) {
      triggerHaptic("light");
      onViewLedger(data.ledgerId);
      onClose();
    } else if (!isPartnerSync && onEdit) {
      triggerHaptic("light");
      onEdit();
    }
  };

  // ====================================================================
  // MATERIAL SYSTEM
  // ====================================================================

  const outerBackground = isDark
    ? `
      linear-gradient(
        135deg,
        rgba(255,255,255,0.115) 0%,
        rgba(255,255,255,0.055) 22%,
        rgba(30,30,34,0.58) 48%,
        rgba(14,14,18,0.72) 100%
      )
    `
    : `
      linear-gradient(
        135deg,
        rgba(255,255,255,0.76) 0%,
        rgba(255,255,255,0.43) 28%,
        rgba(238,240,244,0.52) 55%,
        rgba(218,221,228,0.58) 100%
      )
    `;

  const innerBackground = isDark
    ? `
      linear-gradient(
        180deg,
        rgba(255,255,255,0.075) 0%,
        rgba(255,255,255,0.035) 48%,
        rgba(0,0,0,0.075) 100%
      )
    `
    : `
      linear-gradient(
        180deg,
        rgba(255,255,255,0.66) 0%,
        rgba(255,255,255,0.38) 52%,
        rgba(230,232,237,0.34) 100%
      )
    `;

  const outerBorder = isDark
    ? "1px solid rgba(255,255,255,0.16)"
    : "1px solid rgba(255,255,255,0.88)";

  const innerBorder = isDark
    ? "1px solid rgba(255,255,255,0.09)"
    : "1px solid rgba(255,255,255,0.72)";

  const outerShadow = isDark
    ? `
      0 20px 50px -22px rgba(0,0,0,0.88),
      0 7px 18px -8px rgba(0,0,0,0.48),
      inset 0 1px 0 rgba(255,255,255,0.18),
      inset 0 -1px 0 rgba(0,0,0,0.24)
    `
    : `
      0 20px 48px -24px rgba(31,36,48,0.32),
      0 7px 16px -8px rgba(31,36,48,0.12),
      inset 0 1px 0 rgba(255,255,255,1),
      inset 0 -1px 0 rgba(30,35,45,0.07)
    `;

  const innerShadow = isDark
    ? `
      inset 0 1px 0 rgba(255,255,255,0.095),
      inset 0 -1px 0 rgba(0,0,0,0.12)
    `
    : `
      inset 0 1px 0 rgba(255,255,255,0.95),
      inset 0 -1px 0 rgba(30,35,45,0.045)
    `;

  const controlBackground = isDark
    ? `
      linear-gradient(
        180deg,
        rgba(255,255,255,0.105),
        rgba(255,255,255,0.045)
      )
    `
    : `
      linear-gradient(
        180deg,
        rgba(255,255,255,0.72),
        rgba(255,255,255,0.42)
      )
    `;

  const controlBorder = isDark
    ? "1px solid rgba(255,255,255,0.10)"
    : "1px solid rgba(255,255,255,0.72)";

  const controlShadow = isDark
    ? `
      inset 0 1px 0 rgba(255,255,255,0.09),
      0 2px 5px rgba(0,0,0,0.10)
    `
    : `
      inset 0 1px 0 rgba(255,255,255,0.98),
      0 2px 5px rgba(30,35,50,0.055)
    `;

  const mutedText = isDark ? "rgba(255,255,255,0.43)" : "rgba(22,24,29,0.44)";

  const secondaryText = isDark
    ? "rgba(255,255,255,0.60)"
    : "rgba(22,24,29,0.60)";

  const amountPrefix =
    data?.type === "expense" ? "-" : data?.type === "income" ? "+" : "";

  // ====================================================================
  // RENDER
  // ====================================================================

  return (
    <AnimatePresence>
      {data && (
        <aside
          aria-label={
            isPartnerSync
              ? isIndonesian
                ? "Pemberitahuan Transaksi Space Bersama"
                : "Shared Space Activity Notification"
              : isIndonesian
                ? "Pemberitahuan Pencatatan Transaksi"
                : "Transaction Recorded Notification"
          }
          className="
            fixed
            left-4
            right-4
            z-[100000]
            mx-auto
            max-w-md
            pointer-events-none
            select-none
            font-sans
          "
          style={{
            top: "max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {/* ============================================================
              AMBIENT LIQUID GLOW
             ============================================================ */}

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -inset-3
              rounded-full
              opacity-50
              blur-xl
            "
            style={{
              background: isDark
                ? "rgba(255,255,255,0.035)"
                : "rgba(255,255,255,0.55)",
            }}
          />

          {/* ============================================================
              OUTER GLASS SHELL
             ============================================================ */}

          <motion.div
            initial={{
              opacity: 0,
              scale: 0.88,
              y: -14,
              filter: "blur(7px)",
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              filter: "blur(0px)",
            }}
            exit={{
              opacity: 0,
              scale: 0.94,
              y: -8,
              filter: "blur(4px)",
            }}
            transition={{
              type: "spring",
              stiffness: 430,
              damping: 30,
              mass: 0.72,
            }}
            drag="y"
            dragConstraints={{
              top: -60,
              bottom: 0,
            }}
            dragElastic={0.14}
            onDragEnd={(_, info) => {
              if (info.offset.y < -20 || info.velocity.y < -120) {
                triggerHaptic("light");
                onClose();
              }
            }}
            className="
              group
              relative
              pointer-events-auto
              h-[60px]
              w-full
              overflow-hidden
              rounded-full
              p-[4px]
              cursor-grab
              active:cursor-grabbing
              sm:h-[62px]
              sm:p-[4px]
            "
            style={{
              background: outerBackground,
              border: outerBorder,
              backdropFilter: "blur(34px) saturate(190%)",
              WebkitBackdropFilter: "blur(34px) saturate(190%)",
              boxShadow: outerShadow,
              isolation: "isolate",
              transformOrigin: "top center",
            }}
          >
            {/* ========================================================
                OUTER SPECULAR HIGHLIGHT
               ======================================================== */}

            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                inset-0
                rounded-full
              "
              style={{
                background: isDark
                  ? `
                    linear-gradient(
                      125deg,
                      rgba(255,255,255,0.12) 0%,
                      rgba(255,255,255,0.035) 18%,
                      transparent 43%,
                      transparent 72%,
                      rgba(255,255,255,0.035) 100%
                    )
                  `
                  : `
                    linear-gradient(
                      125deg,
                      rgba(255,255,255,0.90) 0%,
                      rgba(255,255,255,0.40) 18%,
                      transparent 44%,
                      transparent 72%,
                      rgba(255,255,255,0.28) 100%
                    )
                  `,
              }}
            />

            {/* ========================================================
                TOP GLASS RIM
               ======================================================== */}

            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                left-[7%]
                right-[7%]
                top-[1px]
                h-[2px]
                rounded-full
              "
              style={{
                background: isDark
                  ? `
                    linear-gradient(
                      90deg,
                      transparent,
                      rgba(255,255,255,0.24),
                      rgba(255,255,255,0.38),
                      rgba(255,255,255,0.24),
                      transparent
                    )
                  `
                  : `
                    linear-gradient(
                      90deg,
                      transparent,
                      rgba(255,255,255,0.72),
                      rgba(255,255,255,1),
                      rgba(255,255,255,0.72),
                      transparent
                    )
                  `,
              }}
            />

            {/* ========================================================
                BOTTOM REFRACTION
               ======================================================== */}

            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                bottom-0
                left-[10%]
                right-[10%]
                h-[11px]
                rounded-full
                blur-[7px]
              "
              style={{
                background: isDark
                  ? "rgba(255,255,255,0.035)"
                  : "rgba(255,255,255,0.32)",
              }}
            />

            {/* ========================================================
                INNER GLASS ISLAND
               ======================================================== */}

            <div
              className="
                relative
                flex
                h-full
                min-w-0
                items-center
                overflow-hidden
                rounded-full
              "
              style={{
                background: innerBackground,
                border: innerBorder,
                boxShadow: innerShadow,
              }}
            >
              {/* Inner top reflection */}
              <div
                aria-hidden="true"
                className="
                  pointer-events-none
                  absolute
                  left-[8%]
                  right-[8%]
                  top-0
                  h-px
                "
                style={{
                  background: isDark
                    ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)"
                    : "linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)",
                }}
              />

              {/* ======================================================
                  MAIN CONTENT
                 ====================================================== */}

              <div
                className="
                  relative
                  flex
                  w-full
                  min-w-0
                  items-center
                  gap-2
                  px-1.5
                  sm:gap-2.5
                  sm:px-2
                "
              >
                {/* ====================================================
                    STATUS / AVATAR GLASS
                   ==================================================== */}

                <div
                  className="
                    relative
                    flex
                    h-[43px]
                    w-[43px]
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-full
                  "
                  style={{
                    background: controlBackground,
                    border: controlBorder,
                    boxShadow: controlShadow,
                    color: "var(--text-primary)",
                  }}
                >
                  {/* Tiny lens highlight */}
                  <div
                    aria-hidden="true"
                    className="
                      absolute
                      left-[20%]
                      right-[20%]
                      top-[2px]
                      h-px
                    "
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.20)"
                        : "rgba(255,255,255,0.95)",
                    }}
                  />

                  {isPartnerSync ? (
                    <Users size={15} strokeWidth={1.75} />
                  ) : (
                    <Check size={16} strokeWidth={2.15} />
                  )}
                </div>

                {/* ====================================================
                    TRANSACTION CONTENT
                   ==================================================== */}

                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleCardClick}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleCardClick();
                    }
                  }}
                  className="
                    min-w-0
                    flex-1
                    cursor-pointer
                    overflow-hidden
                    outline-none
                  "
                >
                  {/* TOP META */}
                  <div
                    className="
                      flex
                      min-w-0
                      items-center
                      gap-1.5
                      leading-none
                    "
                  >
                    <span
                      className="
                        min-w-0
                        truncate
                        text-[8px]
                        font-semibold
                        uppercase
                        tracking-[0.10em]
                        sm:text-[9px]
                      "
                      style={{
                        color: mutedText,
                      }}
                    >
                      {isPartnerSync
                        ? data.partnerName ||
                          (isIndonesian ? "Rekan" : "Partner")
                        : data.source === "shortcut_draft"
                          ? isIndonesian
                            ? `Masuk Draft · ${data.spaceName || data.ledgerName || "Space Aktif"}`
                            : `Draft Queued · ${data.spaceName || data.ledgerName || "Active Space"}`
                          : isIndonesian
                            ? "Pencatatan Otomatis"
                            : "Auto Logged"}
                    </span>

                    {!isPartnerSync && (
                      <Sparkles
                        size={8}
                        strokeWidth={1.7}
                        className="shrink-0 opacity-60"
                        style={{
                          color: secondaryText,
                        }}
                      />
                    )}

                    {isPartnerSync && data.ledgerName && (
                      <>
                        <span
                          className="shrink-0 text-[8px] opacity-35"
                          style={{
                            color: secondaryText,
                          }}
                        >
                          /
                        </span>

                        <span
                          className="
                              min-w-0
                              truncate
                              text-[8px]
                              font-medium
                              sm:text-[9px]
                            "
                          style={{
                            color: secondaryText,
                          }}
                        >
                          {data.ledgerName}
                        </span>
                      </>
                    )}
                  </div>

                  {/* AMOUNT + METADATA */}
                  <div
                    className="
                      mt-[4px]
                      flex
                      min-w-0
                      items-baseline
                      gap-1.5
                      leading-none
                    "
                  >
                    <span
                      className="
                        shrink-0
                        text-[15px]
                        font-semibold
                        tracking-[-0.045em]
                        tabular-nums
                        sm:text-[16px]
                      "
                      style={{
                        color: "var(--text-primary)",
                      }}
                    >
                      {amountPrefix}
                      {formatWithPreferred(data.amount)}
                    </span>

                    {(data.categoryName || data.walletName || data.note) && (
                      <div
                        className="
                          min-w-0
                          flex
                          items-center
                          gap-1
                          overflow-hidden
                          text-[8px]
                          sm:text-[9px]
                        "
                        style={{
                          color: mutedText,
                        }}
                      >
                        {data.categoryName && (
                          <span
                            className="truncate"
                            style={{
                              color: secondaryText,
                            }}
                          >
                            {data.categoryName}
                          </span>
                        )}

                        {data.walletName && (
                          <>
                            {data.categoryName && (
                              <span className="shrink-0 opacity-35">·</span>
                            )}

                            <span className="truncate">{data.walletName}</span>
                          </>
                        )}

                        {data.note && (
                          <>
                            {(data.categoryName || data.walletName) && (
                              <span className="shrink-0 opacity-35">·</span>
                            )}

                            <span className="truncate italic">{data.note}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ====================================================
                    ACTION LENSES
                   ==================================================== */}

                <div
                  className="
                    relative
                    flex
                    shrink-0
                    items-center
                    gap-1
                  "
                >
                  {/* View ledger */}
                  {isPartnerSync && data.ledgerId && onViewLedger && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        triggerHaptic("light");
                        onViewLedger(data.ledgerId!);
                        onClose();
                      }}
                      className="
                          flex
                          h-[34px]
                          w-[34px]
                          items-center
                          justify-center
                          rounded-full
                          transition-transform
                          duration-200
                          active:scale-[0.86]
                        "
                      style={{
                        background: controlBackground,
                        border: controlBorder,
                        boxShadow: controlShadow,
                        color: "var(--text-primary)",
                      }}
                      title={isIndonesian ? "Buka Space" : "Open Space"}
                      aria-label={isIndonesian ? "Buka Space" : "Open Space"}
                    >
                      <ArrowRight size={13} strokeWidth={1.8} />
                    </button>
                  )}

                  {/* Edit */}
                  {!isPartnerSync && onEdit && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        triggerHaptic("light");
                        onEdit();
                      }}
                      className="
                          flex
                          h-[34px]
                          w-[34px]
                          items-center
                          justify-center
                          rounded-full
                          transition-transform
                          duration-200
                          active:scale-[0.86]
                        "
                      style={{
                        background: controlBackground,
                        border: controlBorder,
                        boxShadow: controlShadow,
                        color: "var(--text-secondary)",
                      }}
                      title={isIndonesian ? "Ubah Rincian" : "Edit Details"}
                      aria-label={
                        isIndonesian ? "Ubah Rincian" : "Edit Details"
                      }
                    >
                      <Pencil size={12} strokeWidth={1.8} />
                    </button>
                  )}

                  {/* Close */}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      triggerHaptic("light");
                      onClose();
                    }}
                    className="
                      flex
                      h-[34px]
                      w-[34px]
                      items-center
                      justify-center
                      rounded-full
                      transition-transform
                      duration-200
                      active:scale-[0.86]
                    "
                    style={{
                      background: controlBackground,
                      border: controlBorder,
                      boxShadow: controlShadow,
                      color: mutedText,
                    }}
                    title={isIndonesian ? "Tutup" : "Dismiss"}
                    aria-label={isIndonesian ? "Tutup" : "Dismiss"}
                  >
                    <X size={12} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================================
                BOTTOM LIQUID LIGHT
               ======================================================== */}

            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                bottom-[1px]
                left-[20%]
                right-[20%]
                h-[2px]
                rounded-full
                blur-[1px]
              "
              style={{
                background: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.55)",
              }}
            />

            {/* ========================================================
                AUTO DISMISS PROGRESS
               ======================================================== */}

            <motion.div
              aria-hidden="true"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{
                duration: 5,
                ease: "linear",
              }}
              className="
                absolute
                bottom-[1px]
                left-[15%]
                right-[15%]
                h-[1px]
                origin-left
                rounded-full
              "
              style={{
                background: isDark
                  ? "rgba(255,255,255,0.22)"
                  : "rgba(20,25,35,0.14)",
              }}
            />
          </motion.div>
        </aside>
      )}
    </AnimatePresence>
  );
}

// ======================================================================
// BACKWARD COMPATIBILITY
// ======================================================================

export { DynamicIslandHUD as ShortcutSuccessDialog };
