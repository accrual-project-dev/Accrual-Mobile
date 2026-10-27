// ======================================================================
// TROUVAILLE WIDGET LAYOUT ENGINE
// Pure state calculation engine for widget ordering, sizing, and persistence
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// ======================================================================

import type {
  CardWidgetConfig,
  WidgetSize,
  HomePresetKey,
  StatisticsPresetKey,
} from "./widgetLayoutTypes";
import {
  DEFAULT_HOME_WIDGETS,
  HOME_PRESETS,
  STATISTICS_PRESETS,
} from "./widgetLayoutTypes";

export const HOME_STORAGE_KEY = "trouvaille_home_widget_layout_v1";
export const STATS_STORAGE_KEY = "trouvaille_statistics_widget_layout_v1";
export const STORAGE_KEY = HOME_STORAGE_KEY;

export const HOME_PRESET_STORAGE_KEY = "trouvaille_home_active_preset_key";
export const STATS_PRESET_STORAGE_KEY = "trouvaille_stats_active_preset_key";

export function loadStoredWidgets(
  storedJson: string | null,
  defaultWidgets: CardWidgetConfig[] = DEFAULT_HOME_WIDGETS,
): CardWidgetConfig[] {
  if (!storedJson) return defaultWidgets;
  try {
    const parsed: CardWidgetConfig[] = JSON.parse(storedJson);
    if (!Array.isArray(parsed)) return defaultWidgets;

    // Merge stored items with defaultWidgets to ensure forward compatibility
    const merged = defaultWidgets.map((def) => {
      const found = parsed.find((p) => p.id === def.id);
      if (!found) return def;

      let isVisible = typeof found.isVisible === "boolean" ? found.isVisible : def.isVisible;
      // Retire legacy investment_pulse from Home screen for existing cached users
      if (def.id === "investment_pulse" && (found.order === 2 || found.order === undefined)) {
        isVisible = false;
      }

      return {
        ...def,
        size: (found.size && def.supportedSizes.includes(found.size) ? found.size : def.size),
        order: typeof found.order === "number" ? (def.id === "investment_pulse" && found.order === 2 ? def.order : found.order) : def.order,
        isVisible,
      };
    });

    return merged.sort((a, b) => a.order - b.order);
  } catch {
    return defaultWidgets;
  }
}

export function reorderWidgets(
  widgets: CardWidgetConfig[],
  newOrderIds: string[]
): CardWidgetConfig[] {
  const map = new Map(newOrderIds.map((id, index) => [id, index]));
  let nextIdx = newOrderIds.length;
  return [...widgets]
    .map((w) => {
      if (map.has(w.id)) {
        return { ...w, order: map.get(w.id)! };
      }
      return { ...w, order: nextIdx++ };
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Move a widget up (earlier in order) in the widgets array.
 */
export function moveWidgetUp(
  widgets: CardWidgetConfig[],
  cardId: string
): CardWidgetConfig[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((w) => w.id === cardId);
  if (idx <= 0) return sorted;

  const temp = sorted[idx];
  sorted[idx] = sorted[idx - 1];
  sorted[idx - 1] = temp;

  return sorted.map((w, i) => ({ ...w, order: i }));
}

/**
 * Move a widget down (later in order) in the widgets array.
 */
export function moveWidgetDown(
  widgets: CardWidgetConfig[],
  cardId: string
): CardWidgetConfig[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((w) => w.id === cardId);
  if (idx === -1 || idx >= sorted.length - 1) return sorted;

  const temp = sorted[idx];
  sorted[idx] = sorted[idx + 1];
  sorted[idx + 1] = temp;

  return sorted.map((w, i) => ({ ...w, order: i }));
}

export function cycleWidgetSize(
  widgets: CardWidgetConfig[],
  cardId: string
): CardWidgetConfig[] {
  return widgets.map((w) => {
    if (w.id !== cardId) return w;
    if (w.supportedSizes.length <= 1) return w;
    const currentIdx = w.supportedSizes.indexOf(w.size);
    const nextIdx = (currentIdx + 1) % w.supportedSizes.length;
    return {
      ...w,
      size: w.supportedSizes[nextIdx],
    };
  });
}

export function setWidgetSize(
  widgets: CardWidgetConfig[],
  cardId: string,
  size: WidgetSize
): CardWidgetConfig[] {
  return widgets.map((w) => {
    if (w.id !== cardId) return w;
    if (!w.supportedSizes.includes(size)) return w;
    return { ...w, size };
  });
}

export function toggleWidgetVisibility(
  widgets: CardWidgetConfig[],
  cardId: string
): CardWidgetConfig[] {
  return widgets.map((w) => {
    if (w.id !== cardId) return w;
    return { ...w, isVisible: !w.isVisible };
  });
}

export function filterVisibleWidgets(
  widgets: CardWidgetConfig[]
): CardWidgetConfig[] {
  return [...widgets]
    .filter((w) => w.isVisible)
    .sort((a, b) => a.order - b.order);
}

export function applyPresetToWidgets(
  currentWidgets: CardWidgetConfig[],
  presetKey: HomePresetKey | StatisticsPresetKey,
  targetPage?: "home" | "statistics"
): CardWidgetConfig[] {
  const isStats =
    targetPage === "statistics" ||
    (!targetPage && currentWidgets.some((w) => w.page === "statistics"));

  if (isStats) {
    const preset = STATISTICS_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return currentWidgets;

    const configMap = new Map(preset.cardConfigs.map((c) => [c.id, c]));
    let fallbackOrder = preset.cardConfigs.length;

    return currentWidgets
      .map((w) => {
        const target = configMap.get(w.id);
        if (target) {
          return {
            ...w,
            size: w.supportedSizes.includes(target.size) ? target.size : w.size,
            isVisible: target.isVisible,
            order: target.order,
          };
        }
        return {
          ...w,
          order: fallbackOrder++,
        };
      })
      .sort((a, b) => a.order - b.order);
  }

  const normalizedKey =
    presetKey === "simple"
      ? "minimal"
      : presetKey === "balanced"
        ? "pulse"
        : presetKey === "advanced"
          ? "executive"
          : presetKey;

  const preset = HOME_PRESETS.find((p) => p.key === normalizedKey);
  if (!preset) return currentWidgets;

  const configMap = new Map(preset.cardConfigs.map((c) => [c.id, c]));
  let fallbackOrder = preset.cardConfigs.length;

  return currentWidgets
    .map((w) => {
      const target = configMap.get(w.id);
      if (target) {
        return {
          ...w,
          size: w.supportedSizes.includes(target.size) ? target.size : w.size,
          isVisible: target.isVisible,
          order: target.order,
        };
      }
      return {
        ...w,
        order: fallbackOrder++,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Detects if the current widget visibility configuration matches any defined Home preset.
 */
export function detectMatchingHomePreset(
  widgets: CardWidgetConfig[]
): HomePresetKey | null {
  for (const preset of HOME_PRESETS) {
    const isMatch = preset.cardConfigs.every((cfg) => {
      const w = widgets.find((item) => item.id === cfg.id);
      if (!w) return false;
      return w.isVisible === cfg.isVisible;
    });
    if (isMatch) return preset.key;
  }
  return null;
}

/**
 * Detects if the current widget visibility configuration matches any defined Statistics preset.
 */
export function detectMatchingStatsPreset(
  widgets: CardWidgetConfig[]
): StatisticsPresetKey | null {
  for (const preset of STATISTICS_PRESETS) {
    const isMatch = preset.cardConfigs.every((cfg) => {
      const w = widgets.find((item) => item.id === cfg.id);
      if (!w) return false;
      return w.isVisible === cfg.isVisible;
    });
    if (isMatch) return preset.key;
  }
  return null;
}

/**
 * Swaps a half-sized widget's horizontal position with its row partner or adjacent half widget
 */
export function swapWidgetPosition(
  widgets: CardWidgetConfig[],
  cardId: string,
  direction: "left" | "right" | "toggle" = "toggle",
): CardWidgetConfig[] {
  const visible = filterVisibleWidgets(widgets);
  const currentIndex = visible.findIndex((c) => c.id === cardId);
  if (currentIndex === -1) return widgets;

  const currentCard = visible[currentIndex];
  if (currentCard.size !== "half") return widgets;

  // Determine which column (0 = left, 1 = right) each half card occupies
  let col = 0;
  const colMap = new Map<string, number>();
  for (const c of visible) {
    if (c.size === "full") {
      col = 0;
    } else {
      colMap.set(c.id, col);
      col = col === 0 ? 1 : 0;
    }
  }

  const currentCol = colMap.get(cardId) ?? 0;
  let targetIndex = -1;

  if (direction === "right") {
    if (currentCol === 0 && currentIndex + 1 < visible.length) {
      targetIndex = currentIndex + 1;
    }
  } else if (direction === "left") {
    if (currentCol === 1 && currentIndex - 1 >= 0) {
      targetIndex = currentIndex - 1;
    }
  } else {
    // "toggle": swap with sibling on the same row if possible, otherwise adjacent item
    if (
      currentCol === 0 &&
      currentIndex + 1 < visible.length &&
      visible[currentIndex + 1].size === "half"
    ) {
      targetIndex = currentIndex + 1;
    } else if (
      currentCol === 1 &&
      currentIndex - 1 >= 0 &&
      visible[currentIndex - 1].size === "half"
    ) {
      targetIndex = currentIndex - 1;
    } else if (currentIndex + 1 < visible.length) {
      targetIndex = currentIndex + 1;
    } else if (currentIndex - 1 >= 0) {
      targetIndex = currentIndex - 1;
    }
  }

  if (targetIndex === -1 || targetIndex === currentIndex) {
    return widgets;
  }

  const visibleIds = visible.map((c) => c.id);
  const temp = visibleIds[currentIndex];
  visibleIds[currentIndex] = visibleIds[targetIndex];
  visibleIds[targetIndex] = temp;

  return reorderWidgets(widgets, visibleIds);
}
