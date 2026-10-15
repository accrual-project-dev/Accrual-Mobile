// ======================================================================
// TROUVAILLE WIDGET CUSTOMIZATION BAR
// Apple Minimal / Luxury Floating Editing Control
//
// Theme rules:
// - Light and dark mode must use the existing CSS variable system
// - No hardcoded white/black UI surfaces
// - Monochrome Apple-style interaction
// - Frosted glass without excessive contrast
// - Compact floating Springboard-style control
// ======================================================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw, Plus, Sparkles } from "lucide-react";

import type { CardWidgetConfig } from "../../lib/widgetLayoutTypes";
import { getLocalizedWidgetMeta } from "../../lib/widgetLayoutTypes";
import { BottomSheet } from "../ui/BottomSheet";
import { GlassConfirmationModal } from "../ui/GlassConfirmationModal";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useQuota } from "../../hooks/useQuota";

interface WidgetCustomizationBarProps {
  isEditMode: boolean;
  onDone: () => void;
  onReset: () => void;
  hiddenCards: CardWidgetConfig[];
  onUnhideCard: (id: string) => void;
  activeCardsCount?: number;
}

export function WidgetCustomizationBar({
  isEditMode,
  onDone,
  onReset,
  hiddenCards,
  onUnhideCard,
  activeCardsCount,
}: WidgetCustomizationBarProps) {
  const { isIndonesian } = useLanguage();
  const { isWidgetProOnly, checkWidgetAndPrompt } = useQuota();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  return (
    <>
      {/* ================================================================
          FLOATING EDITING BAR
      ================================================================= */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{
              y: 50,
              opacity: 0,
              scale: 0.96,
            }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{
              y: 50,
              opacity: 0,
              scale: 0.96,
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 350,
            }}
            className="
              fixed
              bottom-24
              left-0
              right-0
              z-40
              flex
              justify-center
              px-4
              pointer-events-none
            "
          >
            <div
              className="
                pointer-events-auto
                flex
                items-center
                gap-1.5
                p-1.5
                pl-3
                rounded-full
                backdrop-blur-2xl
                supports-[backdrop-filter]:bg-[var(--bg-elevated)]
              "
              style={{
                background:
                  "color-mix(in srgb, var(--bg-elevated) 88%, transparent)",
                border: "1px solid var(--glass-border)",
                boxShadow:
                  "0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
              }}
            >
              {/* ========================================================
                  EDITING LABEL
              ========================================================= */}
              <div
                className="
                  flex
                  items-center
                  gap-1.5
                  pr-1.5
                  pl-0.5
                  shrink-0
                "
              >
                <Sparkles
                  size={12}
                  strokeWidth={1.8}
                  className="
                    text-[var(--text-secondary)]
                    opacity-80
                    animate-pulse
                  "
                />

                <span
                  className="
                    text-[11px]
                    font-semibold
                    whitespace-nowrap
                  "
                  style={{
                    color: "var(--text-primary)",
                  }}
                >
                  {isIndonesian ? "Mengedit Tata Letak" : "Editing Layout"}
                </span>
              </div>

              {/* ========================================================
                  ADD / UNHIDE
              ========================================================= */}
              {hiddenCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setAddSheetOpen(true);
                  }}
                  className="
                    px-2.5
                    py-1.5
                    rounded-full
                    text-[11px]
                    font-semibold
                    flex
                    items-center
                    gap-1
                    whitespace-nowrap
                    cursor-pointer
                    active:scale-95
                    transition-all
                    duration-150
                  "
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Plus size={12} strokeWidth={2} />

                  <span>
                    {isIndonesian
                      ? `Tambah (${hiddenCards.length})`
                      : `Add (${hiddenCards.length})`}
                  </span>
                </button>
              )}

              {/* ========================================================
                  RESET
              ========================================================= */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  setIsResetConfirmOpen(true);
                }}
                className="
                  w-8
                  h-8
                  rounded-full
                  flex
                  items-center
                  justify-center
                  shrink-0
                  cursor-pointer
                  active:scale-90
                  transition-all
                  duration-150
                "
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
                title={
                  isIndonesian
                    ? "Atur ulang tata letak ke bawaan"
                    : "Reset layout to default"
                }
                aria-label={
                  isIndonesian
                    ? "Atur ulang tata letak ke bawaan"
                    : "Reset layout to default"
                }
              >
                <RotateCcw size={12} strokeWidth={1.8} />
              </button>

              {/* ========================================================
                  DONE
              ========================================================= */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  onDone();
                }}
                className="
                  px-3.5
                  py-1.5
                  rounded-full
                  text-[12px]
                  font-semibold
                  flex
                  items-center
                  justify-center
                  gap-1
                  whitespace-nowrap
                  cursor-pointer
                  active:scale-95
                  transition-all
                  duration-150
                "
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-base)",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.14)",
                }}
              >
                <Check size={13} strokeWidth={2.5} />

                <span>{isIndonesian ? "Selesai" : "Done"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================
          HIDDEN CARDS BOTTOM SHEET
      ================================================================= */}
      <BottomSheet
        isOpen={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        title={isIndonesian ? "Tambah Kartu Tersembunyi" : "Add Hidden Cards"}
      >
        <div
          className="
            px-4
            pt-1
            pb-8
            space-y-2.5
          "
        >
          {/* ============================================================
              DESCRIPTION
          ============================================================= */}
          <p
            className="
              text-[11px]
              leading-relaxed
              px-1
              mb-2
            "
            style={{
              color: "var(--text-tertiary)",
            }}
          >
            {isIndonesian
              ? "Ketuk kartu di bawah untuk menampilkannya kembali di dasbor aktif."
              : "Tap any card below to restore it to your active dashboard."}
          </p>

          {/* ============================================================
              HIDDEN CARD LIST
          ============================================================= */}
          {hiddenCards.map((card) => {
            const meta = getLocalizedWidgetMeta(
              card.id,
              isIndonesian,
              card.title,
              card.subtitle,
            );
            return (
              <div
                key={card.id}
                className="
                  p-3.5
                  rounded-2xl
                  flex
                  items-center
                  justify-between
                  gap-3
                "
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)",
                }}
              >
                {/* ======================================================
                    CARD INFORMATION
                ======================================================= */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4
                      className="
                        text-[13px]
                        font-semibold
                        leading-snug
                        truncate
                      "
                      style={{
                        color: "var(--text-primary)",
                      }}
                    >
                      {meta.title}
                    </h4>
                    {isWidgetProOnly(card.id) && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.08] border border-white/10 text-[var(--text-secondary)] uppercase tracking-wider shrink-0">
                        PRO
                      </span>
                    )}
                  </div>

                  <p
                    className="
                      text-[11px]
                      leading-relaxed
                      mt-0.5
                      line-clamp-1
                    "
                    style={{
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {meta.subtitle}
                  </p>
                </div>

                {/* ======================================================
                    ADD BUTTON
                ======================================================= */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    const allowed = checkWidgetAndPrompt(card.id, activeCardsCount ?? 0);
                    if (!allowed) {
                      setAddSheetOpen(false);
                      return;
                    }

                    onUnhideCard(card.id);

                    if (hiddenCards.length <= 1) {
                      setAddSheetOpen(false);
                    }
                  }}
                  className="
                    shrink-0
                    px-3
                    py-1.5
                    rounded-full
                    text-[11px]
                    font-semibold
                    flex
                    items-center
                    gap-1
                    cursor-pointer
                    active:scale-95
                    transition-all
                    duration-150
                  "
                  style={{
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
                    border:
                      "1px solid color-mix(in srgb, var(--accent) 70%, transparent)",
                  }}
                >
                  <Plus size={12} strokeWidth={2} />

                  <span>{isIndonesian ? "Tambah" : "Add"}</span>
                </button>
              </div>
            );
          })}
        </div>
      </BottomSheet>

      <GlassConfirmationModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={() => {
          onReset();
          setIsResetConfirmOpen(false);
        }}
        title={
          isIndonesian
            ? "Atur Ulang Tata Letak Kartu?"
            : "Reset Card Layout?"
        }
        description={
          isIndonesian
            ? "Tata letak, urutan, dan ukuran kartu beranda akan dikembalikan ke pengaturan bawaan."
            : "Card layouts, orders, and sizes will be restored to their default state."
        }
        confirmLabel={isIndonesian ? "Atur Ulang" : "Reset Layout"}
        isIndonesian={isIndonesian}
      />
    </>
  );
}
