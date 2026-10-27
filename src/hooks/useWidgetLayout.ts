// ======================================================================
// TROUVAILLE WIDGET LAYOUT HOOK
// Reactive iOS Springboard layout management with LocalStorage persistence
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// ======================================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  CardWidgetConfig,
  WidgetSize,
  HomePresetKey,
  StatisticsPresetKey,
} from "../lib/widgetLayoutTypes";
import { DEFAULT_HOME_WIDGETS } from "../lib/widgetLayoutTypes";
import {
  STORAGE_KEY,
  STATS_STORAGE_KEY,
  HOME_PRESET_STORAGE_KEY,
  STATS_PRESET_STORAGE_KEY,
  loadStoredWidgets,
  reorderWidgets,
  cycleWidgetSize,
  setWidgetSize,
  toggleWidgetVisibility,
  filterVisibleWidgets,
  applyPresetToWidgets,
  swapWidgetPosition,
  moveWidgetUp,
  moveWidgetDown,
  detectMatchingHomePreset,
  detectMatchingStatsPreset,
} from "../lib/widgetLayoutEngine";
import { triggerHaptic } from "../lib/haptics";

interface UseWidgetLayoutOptions {
  storageKey?: string;
  defaultWidgets?: CardWidgetConfig[];
  presetStorageKey?: string;
  page?: "home" | "statistics";
}

export function useWidgetLayout(options?: UseWidgetLayoutOptions) {
  const storageKey = options?.storageKey || STORAGE_KEY;
  const defaultWidgets = options?.defaultWidgets || DEFAULT_HOME_WIDGETS;
  const page = options?.page || (storageKey === STATS_STORAGE_KEY ? "statistics" : "home");
  const presetStorageKey =
    options?.presetStorageKey ||
    (page === "statistics" ? STATS_PRESET_STORAGE_KEY : HOME_PRESET_STORAGE_KEY);

  const [isEditMode, setIsEditModeState] = useState(false);
  const [widgets, setWidgets] = useState<CardWidgetConfig[]>(() => {
    return loadStoredWidgets(
      typeof window !== "undefined" ? localStorage.getItem(storageKey) : null,
      defaultWidgets
    );
  });

  const [activePresetKey, setActivePresetKeyState] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(presetStorageKey);
      if (saved) return saved;
      const initialWidgets = loadStoredWidgets(
        localStorage.getItem(storageKey),
        defaultWidgets
      );
      if (page === "home") {
        const detected = detectMatchingHomePreset(initialWidgets);
        if (detected) return detected;
      } else {
        const detected = detectMatchingStatsPreset(initialWidgets);
        if (detected) return detected;
      }
    }
    return page === "home" ? "minimal" : "executive";
  });

  const setActivePresetKey = useCallback(
    (key: any) => {
      setActivePresetKeyState(key);
      if (typeof window !== "undefined") {
        try {
          if (key) {
            localStorage.setItem(presetStorageKey, key);
          } else {
            localStorage.removeItem(presetStorageKey);
          }
        } catch (e) {
          console.warn("[useWidgetLayout] Failed to save preset key:", e);
        }
      }
    },
    [presetStorageKey]
  );

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widgets));
    } catch (e) {
      console.warn("[useWidgetLayout] Failed to write layout to storage:", e);
    }
  }, [storageKey, widgets]);

  // Sync active preset key if widgets match a specific preset
  useEffect(() => {
    if (page === "home") {
      const matched = detectMatchingHomePreset(widgets);
      if (matched && matched !== activePresetKey) {
        setActivePresetKeyState(matched);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(presetStorageKey, matched);
          } catch {}
        }
      }
    } else {
      const matched = detectMatchingStatsPreset(widgets);
      if (matched && matched !== activePresetKey) {
        setActivePresetKeyState(matched);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(presetStorageKey, matched);
          } catch {}
        }
      }
    }
  }, [widgets, page, activePresetKey, presetStorageKey]);

  const setIsEditMode = useCallback((active: boolean) => {
    triggerHaptic("medium");
    setIsEditModeState(active);
  }, []);

  const reorderCards = useCallback((newOrderedIds: string[]) => {
    setWidgets((prev) => reorderWidgets(prev, newOrderedIds));
  }, []);

  const cycleCardSizeHandler = useCallback((cardId: string) => {
    triggerHaptic("light");
    setWidgets((prev) => cycleWidgetSize(prev, cardId));
  }, []);

  const setCardSizeHandler = useCallback((cardId: string, size: WidgetSize) => {
    triggerHaptic("light");
    setWidgets((prev) => setWidgetSize(prev, cardId, size));
  }, []);

  const toggleCardVisibilityHandler = useCallback((cardId: string) => {
    triggerHaptic("medium");
    setWidgets((prev) => toggleWidgetVisibility(prev, cardId));
  }, []);

  const resetLayout = useCallback(() => {
    triggerHaptic("heavy");
    setActivePresetKey(page === "home" ? "minimal" : "executive");
    setWidgets(defaultWidgets);
  }, [defaultWidgets, setActivePresetKey, page]);

  const applyPreset = useCallback(
    (presetKey: HomePresetKey | StatisticsPresetKey) => {
      triggerHaptic("medium");
      setActivePresetKey(presetKey);
      setWidgets((prev) => applyPresetToWidgets(prev, presetKey, page));
    },
    [page, setActivePresetKey]
  );

  const swapCardPositionHandler = useCallback(
    (cardId: string, direction: "left" | "right" | "toggle" = "toggle") => {
      triggerHaptic("medium");
      setWidgets((prev) => swapWidgetPosition(prev, cardId, direction));
    },
    [],
  );

  const moveCardUpHandler = useCallback((cardId: string) => {
    triggerHaptic("light");
    setWidgets((prev) => moveWidgetUp(prev, cardId));
  }, []);

  const moveCardDownHandler = useCallback((cardId: string) => {
    triggerHaptic("light");
    setWidgets((prev) => moveWidgetDown(prev, cardId));
  }, []);

  const visibleCards = useMemo(() => {
    return filterVisibleWidgets(widgets);
  }, [widgets]);

  const hiddenCards = useMemo(() => {
    return widgets.filter((w) => !w.isVisible);
  }, [widgets]);

  return {
    widgets,
    visibleCards,
    hiddenCards,
    isEditMode,
    setIsEditMode,
    reorderCards,
    swapCardPosition: swapCardPositionHandler,
    moveCardUp: moveCardUpHandler,
    moveCardDown: moveCardDownHandler,
    cycleCardSize: cycleCardSizeHandler,
    setCardSize: setCardSizeHandler,
    toggleCardVisibility: toggleCardVisibilityHandler,
    resetLayout,
    applyPreset,
    activePresetKey,
    setActivePresetKey,
  };
}
