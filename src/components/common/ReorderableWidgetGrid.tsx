// ======================================================================
// TROUVAILLE REORDERABLE WIDGET GRID
// 2D Drag-to-Reorder Grid with Apple Springboard physics
// Supports fluid vertical and horizontal swapping without button clutter
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// ======================================================================

import React, { useRef, useCallback, useMemo } from "react";
import { motion, type PanInfo } from "framer-motion";
import type { CardWidgetConfig } from "../../lib/widgetLayoutTypes";
import { swapWidgetPosition } from "../../lib/widgetLayoutEngine";
import { triggerHaptic } from "../../lib/haptics";
import { WidgetCardWrapper } from "./WidgetCardWrapper";

interface ReorderableWidgetGridProps {
  cards: CardWidgetConfig[];
  isEditMode: boolean;
  onReorder: (newOrder: string[]) => void;
  onEnterEditMode: () => void;
  onCycleSize: (id: string) => void;
  onHide: (id: string) => void;
  renderCard: (card: CardWidgetConfig) => React.ReactNode;
  className?: string;
}

export function ReorderableWidgetGrid({
  cards,
  isEditMode,
  onReorder,
  onEnterEditMode,
  onCycleSize,
  onHide,
  renderCard,
  className = "grid grid-cols-2 gap-4 pb-4 w-full max-w-full overflow-x-clip relative",
}: ReorderableWidgetGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSwapTimeRef = useRef<number>(0);
  const activeDragIdRef = useRef<string | null>(null);

  const renderedItems = useMemo(() => {
    return cards
      .map((card) => ({
        card,
        content: renderCard(card),
      }))
      .filter(
        (item): item is { card: CardWidgetConfig; content: React.ReactNode } =>
          Boolean(item.content),
      );
  }, [cards, renderCard]);

  const handleDrag = useCallback(
    (draggedId: string, info: PanInfo) => {
      if (!isEditMode || !containerRef.current) return;

      const now = Date.now();
      // 220ms cooldown to allow FLIP animation and avoid rapid thrashing
      if (now - lastSwapTimeRef.current < 220) return;

      const draggedIndex = renderedItems.findIndex(
        (item) => item.card.id === draggedId,
      );
      if (draggedIndex === -1) return;

      const elements = containerRef.current.querySelectorAll<HTMLElement>(
        "[data-widget-card-id]",
      );
      let bestTargetId: string | null = null;
      let minDistance = Infinity;

      const padX = 14;
      const padY = 20;

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const targetId = el.getAttribute("data-widget-card-id");
        if (!targetId || targetId === draggedId) continue;

        const rect = el.getBoundingClientRect();
        const isInside =
          info.point.x >= rect.left - padX &&
          info.point.x <= rect.right + padX &&
          info.point.y >= rect.top - padY &&
          info.point.y <= rect.bottom + padY;

        if (isInside) {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dist = Math.hypot(
            info.point.x - centerX,
            info.point.y - centerY,
          );
          if (dist < minDistance) {
            minDistance = dist;
            bestTargetId = targetId;
          }
        }
      }

      if (bestTargetId) {
        const targetIndex = renderedItems.findIndex(
          (item) => item.card.id === bestTargetId,
        );
        if (targetIndex !== -1 && targetIndex !== draggedIndex) {
          const newItems = [...renderedItems];
          const [moved] = newItems.splice(draggedIndex, 1);
          newItems.splice(targetIndex, 0, moved);

          lastSwapTimeRef.current = now;
          triggerHaptic("light");
          onReorder(newItems.map((item) => item.card.id));
        }
      }
    },
    [isEditMode, renderedItems, onReorder],
  );

  const handleDragEnd = useCallback(
    (draggedId: string, info: PanInfo) => {
      activeDragIdRef.current = null;
      const draggedCard = cards.find((c) => c.id === draggedId);
      if (draggedCard && draggedCard.size === "half") {
        const dx = info.offset.x;
        const dy = info.offset.y;
        // Fast horizontal flick with dominant X vector
        if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          const now = Date.now();
          if (now - lastSwapTimeRef.current > 160) {
            const swapped = swapWidgetPosition(
              cards,
              draggedId,
              dx > 0 ? "right" : "left",
            );
            if (swapped !== cards) {
              lastSwapTimeRef.current = now;
              triggerHaptic("light");
              onReorder(swapped.map((c) => c.id));
            }
          }
        }
      }
    },
    [cards, onReorder],
  );

  if (renderedItems.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className={className}>
      {renderedItems.map(({ card, content }, index) => {
        let isHalf = card.size === "half";
        if (isHalf) {
          // Count preceding half cards in the current contiguous half block
          let precedingHalvesInCurrentBlock = 0;
          for (let i = index - 1; i >= 0; i--) {
            if (renderedItems[i].card.size === "full") break;
            precedingHalvesInCurrentBlock++;
          }
          const isSecondInPair = precedingHalvesInCurrentBlock % 2 === 1;
          if (!isSecondInPair) {
            // First half of potential pair: verify if next item is also a half card
            const nextItem = renderedItems[index + 1];
            const hasPartner = nextItem && nextItem.card.size === "half";
            if (!hasPartner) {
              // Orphan half card! Auto-expand to col-span-2 so no empty space appears
              isHalf = false;
            }
          }
        }
        return (
          <motion.div
            key={card.id}
            data-widget-card-id={card.id}
            layout={isEditMode ? "position" : false}
            transition={
              isEditMode
                ? { layout: { type: "spring", stiffness: 350, damping: 28 } }
                : undefined
            }
            className={`w-full max-w-full select-none ${
              isHalf ? "col-span-1 h-[154px]" : "col-span-2"
            }`}
            style={{
              touchAction: isEditMode ? "none" : "auto",
              maxWidth: "100%",
              boxSizing: "border-box",
            }}
            drag={isEditMode}
            dragSnapToOrigin={true}
            dragElastic={0.12}
            dragMomentum={false}
            whileDrag={{
              scale: 1.03,
              zIndex: 50,
              boxShadow: "0 20px 35px -10px rgba(0, 0, 0, 0.65)",
              cursor: "grabbing",
            }}
            onDragStart={() => {
              activeDragIdRef.current = card.id;
            }}
            onDrag={(_event, info) => {
              handleDrag(card.id, info);
            }}
            onDragEnd={(_event, info) => {
              handleDragEnd(card.id, info);
            }}
          >
            <WidgetCardWrapper
              card={card}
              effectiveSize={isHalf ? "half" : "full"}
              isEditMode={isEditMode}
              onEnterEditMode={onEnterEditMode}
              onCycleSize={onCycleSize}
              onHide={onHide}
            >
              {content}
            </WidgetCardWrapper>
          </motion.div>
        );
      })}
    </div>
  );
}
