// ======================================================================
// ACCRUAL SHORTCUTS REMOTE & LOCAL CONFIGURATION
// Multi-layer distribution:
// 1. iCloud Link (Primary when published by developer)
// 2. Self-hosted .shortcut file (Backup via HTTPS)
// 3. Guided manual steps (Monveo-style fallback, always available)
// ======================================================================

export interface ShortcutItemConfig {
  version: number;
  icloud_url: string; // Left empty until verified iCloud share link is created on iOS device
  file_url: string;
  min_ios: string;
}

export interface ShortcutsManifest {
  shortcuts: {
    screenshot: ShortcutItemConfig;
    notification: ShortcutItemConfig;
  };
  updated_at: string;
}

export const ACCRUAL_SHORTCUTS_STORAGE_KEY = "accrual_shortcuts_custom_icloud_v2";

export const DEFAULT_SHORTCUTS_MANIFEST: ShortcutsManifest = {
  shortcuts: {
    screenshot: {
      version: 1,
      icloud_url: "https://www.icloud.com/shortcuts/d2d7e25405124de886a4824e976a5104", // Accrual Screen Scanner (Back Tap)
      file_url: "/shortcuts/Accrual-Capture-Transaction.shortcut",
      min_ios: "16.0",
    },
    notification: {
      version: 1,
      icloud_url: "https://www.icloud.com/shortcuts/b01a608a4e0d4207970945a8f8c45f3f", // Log Notification Transaction (Personal Automations)
      file_url: "",
      min_ios: "17.0",
    },
  },
  updated_at: "2026-10-29T11:55:00Z",
};

/**
 * Validates whether an iCloud link has the real 32-character hex slug format.
 * Rejects placeholder text like "accrual-screen-scanner" which causes 404 on Apple servers.
 */
export function isValidICloudLink(url: string | null | undefined): boolean {
  if (!url) return false;
  const match = url.trim().match(/^https:\/\/(?:www\.)?icloud\.com\/shortcuts\/([a-f0-9]{32})\/?$/i);
  return Boolean(match && match[1]);
}

/**
 * Retrieves the current shortcuts configuration from localStorage with manifest fallback.
 */
export function getShortcutsConfig(): ShortcutsManifest {
  if (typeof window === "undefined") return DEFAULT_SHORTCUTS_MANIFEST;
  try {
    const raw = localStorage.getItem(ACCRUAL_SHORTCUTS_STORAGE_KEY);
    if (!raw) return DEFAULT_SHORTCUTS_MANIFEST;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SHORTCUTS_MANIFEST,
      ...parsed,
      shortcuts: {
        screenshot: {
          ...DEFAULT_SHORTCUTS_MANIFEST.shortcuts.screenshot,
          ...(parsed.shortcuts?.screenshot || {}),
        },
        notification: {
          ...DEFAULT_SHORTCUTS_MANIFEST.shortcuts.notification,
          ...(parsed.shortcuts?.notification || {}),
        },
      },
    };
  } catch {
    return DEFAULT_SHORTCUTS_MANIFEST;
  }
}

/**
 * Saves a custom iCloud link override for a specific channel (screenshot or notification).
 */
export function setShortcutICloudUrl(type: "screenshot" | "notification", url: string): void {
  if (typeof window === "undefined") return;
  const current = getShortcutsConfig();
  current.shortcuts[type].icloud_url = url.trim();
  current.updated_at = new Date().toISOString();
  localStorage.setItem(ACCRUAL_SHORTCUTS_STORAGE_KEY, JSON.stringify(current));
}
