// ======================================================================
// TROUVAILLE WIDGET CARD WRAPPER
// iOS-Style Springboard Widget Wrapper with Jiggle, Resize, and Hide Controls
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// ======================================================================

import React, { useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Minus, Maximize2, Minimize2, GripVertical } from "lucide-react";
import type { CardWidgetConfig, WidgetSize } from "../../lib/widgetLayoutTypes";
import { triggerHaptic } from "../../lib/haptics";

interface WidgetCardWrapperProps {
  card: CardWidgetConfig;
  isEditMode: boolean;
  onEnterEditMode?: () => void;
  onCycleSize?: (id: string) => void;
  onHide?: (id: string) => void;
  children: React.ReactNode;
  effectiveSize?: WidgetSize;
}

export function WidgetCardWrapper({
  card,
  isEditMode,
  onEnterEditMode,
  onCycleSize,
  onHide,
  children,
  effectiveSize,
}: WidgetCardWrapperProps) {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handle long-press on mobile touch or desktop pointer to enter Jiggle Edit Mode
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isEditMode) return;
      // Ignore right click
      if (e.button !== 0 && e.pointerType === "mouse") return;
      
      // Do not trigger edit mode long-press when tapping buttons, inputs or links inside the widget
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, select, textarea, [role='button']")) {
        return;
      }

      startPosRef.current = { x: e.clientX, y: e.clientY };

      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }

      holdTimerRef.current = setTimeout(() => {
        triggerHaptic("heavy");
        onEnterEditMode?.();
        holdTimerRef.current = null;
      }, 650);
    },
    [isEditMode, onEnterEditMode],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!holdTimerRef.current) return;
    const dist = Math.hypot(
      e.clientX - startPosRef.current.x,
      e.clientY - startPosRef.current.y,
    );
    // If movement exceeds 8px, treat as scroll or drag and cancel long-press
    if (dist > 8) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handlePointerUpOrCancel = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const isHalf = (effectiveSize || card.size) === "half";

  return (
    <motion.div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onContextMenu={(e) => {
        // Prevent browser context menu when holding down
        if (!isEditMode) {
          e.preventDefault();
        }
      }}
      animate={
        isEditMode
          ? {
              rotate: [-0.4, 0.4, -0.4],
              transition: {
                repeat: Infinity,
                duration: 0.26 + (card.order % 3) * 0.03, // slightly desynchronize jiggles for natural iOS feel
                ease: "easeInOut",
              },
            }
          : { rotate: 0 }
      }
      className={`relative select-none w-full ${
        isHalf ? "h-full" : ""
      }`}
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      {/* Edit Mode Controls Overlay */}
      {isEditMode && (
        <div className="absolute -top-2.5 -right-1.5 z-30 flex items-center gap-1.5">
          {/* Size Cycle Button (Full vs Half) */}
          {card.supportedSizes.length > 1 && onCycleSize && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCycleSize(card.id);
              }}
              className="px-2 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 shadow-lg active:scale-90 transition-transform cursor-pointer"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
                backdropFilter: "blur(16px)",
              }}
              title={`Switch size (Currently ${card.size})`}
            >
              {isHalf ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
              <span>{isHalf ? "Full" : "Half"}</span>
            </button>
          )}

          {/* Hide Card Button */}
          {onHide && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onHide(card.id);
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer"
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
                backdropFilter: "blur(16px)",
              }}
              title="Hide card"
            >
              <Minus size={11} strokeWidth={2.5} />
            </button>
          )}

          {/* Drag Grip Indicator */}
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center opacity-70"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            <GripVertical size={11} />
          </div>
        </div>
      )}

      {/* Edit Mode Specular Border Ring */}
      <div
        className={`rounded-[26px] ${
          isHalf ? "h-full min-h-0 overflow-hidden" : isEditMode ? "min-h-[140px]" : ""
        } ${
          isEditMode
            ? "ring-2 ring-white/20 ring-offset-2 ring-offset-black/50 transition-shadow duration-200"
            : ""
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}
