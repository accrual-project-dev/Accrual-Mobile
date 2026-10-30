// ======================================================================
// ACCRUAL SHORTCUTS REMOTE & LOCAL CONFIGURATION
// Zero-Bug Hybrid Distribution Architecture:
// 1. Native iOS AppShortcutsProvider & AppIntents (0-Setup auto-registered on iOS)
// 2. Verified iCloud Link (When published from real Apple device / remote config)
// 3. Direct URL Scheme & Step-by-Step Guided Setup (Always 100% functional)
// ======================================================================

export type CanonicalShortcutId =
  | "screen_scan"
  | "notification_reader"
  | "glass_dialog"
  | "wallet_tap"
  | "smart_text";

export interface ShortcutItemConfig {
  id: CanonicalShortcutId;
  version: number;
  icloud_url: string;
  direct_scheme: string;
  min_ios: string;
  requires_personal_automation: boolean;
}

export interface ShortcutsManifest {
  shortcuts: {
    screen_scan: ShortcutItemConfig;
    notification_reader: ShortcutItemConfig;
    glass_dialog: ShortcutItemConfig;
    wallet_tap: ShortcutItemConfig;
    smart_text: ShortcutItemConfig;
    // Backward-compatible legacy keys
    screenshot: ShortcutItemConfig;
    notification: ShortcutItemConfig;
  };
  updated_at: string;
}

export const ACCRUAL_SHORTCUTS_STORAGE_KEY = "accrual_shortcuts_custom_icloud_v3";
export const ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY = "ACCRUAL_SHORTCUT_ICLOUD_LINKS_V2";

/**
 * Known synthetic placeholder hashes that were previously hardcoded and must be rejected
 * so users never hit an Apple iCloud 404 "Shortcut Not Found" error.
 */
const KNOWN_FAKE_PLACEHOLDER_HASHES = new Set([
  "b01a608a4e0d4207970945a8f8c45f3f",
  "c01a608a4e0d4207970945a8f8c45f3f",
  "e01a608a4e0d4207970945a8f8c45f3f",
  "f01a608a4e0d4207970945a8f8c45f3f",
  "00000000000000000000000000000000",
]);

const SCREEN_SCAN_CONFIG: ShortcutItemConfig = {
  id: "screen_scan",
  version: 2,
  icloud_url: "", // Populated via verified iCloud share link or Native AppShortcutsProvider
  direct_scheme: "accrual://scan-screen?text=[Teks Layar]&draft=true",
  min_ios: "16.0",
  requires_personal_automation: false,
};

const NOTIFICATION_READER_CONFIG: ShortcutItemConfig = {
  id: "notification_reader",
  version: 2,
  icloud_url: "", // Personal Automations run natively inside iOS Shortcuts Automation tab
  direct_scheme:
    "accrual://notify?text=[Teks]&title=[Judul]&subtitle=[Subjudul]&app=[Aplikasi]&at=[Tanggal]&draft=true",
  min_ios: "17.0",
  requires_personal_automation: true,
};

const GLASS_DIALOG_CONFIG: ShortcutItemConfig = {
  id: "glass_dialog",
  version: 2,
  icloud_url: "",
  direct_scheme:
    "accrual://glass-dialog?amount=[Nominal]&category=[Kategori]&wallet=[Akun]&datetime=[Tanggal]&note=[Catatan]&draft=true",
  min_ios: "16.0",
  requires_personal_automation: false,
};

const WALLET_TAP_CONFIG: ShortcutItemConfig = {
  id: "wallet_tap",
  version: 2,
  icloud_url: "",
  direct_scheme:
    "accrual://wallet-tap?amount=[Jumlah]&merchant=[Merchant]&wallet=[Kartu atau Akun]&datetime=[Tanggal]&draft=true",
  min_ios: "17.0",
  requires_personal_automation: true,
};

const SMART_TEXT_CONFIG: ShortcutItemConfig = {
  id: "smart_text",
  version: 2,
  icloud_url: "",
  direct_scheme: "accrual://smart-text?text=[Salinan Papan Klip atau Teks]&draft=true",
  min_ios: "16.0",
  requires_personal_automation: false,
};

export const DEFAULT_SHORTCUTS_MANIFEST: ShortcutsManifest = {
  shortcuts: {
    screen_scan: SCREEN_SCAN_CONFIG,
    notification_reader: NOTIFICATION_READER_CONFIG,
    glass_dialog: GLASS_DIALOG_CONFIG,
    wallet_tap: WALLET_TAP_CONFIG,
    smart_text: SMART_TEXT_CONFIG,
    screenshot: SCREEN_SCAN_CONFIG,
    notification: NOTIFICATION_READER_CONFIG,
  },
  updated_at: "2026-10-30T04:00:00Z",
};

/**
 * Validates whether an iCloud link has the real 32-character hex slug format
 * AND is not one of the legacy synthetic dummy hashes.
 */
export function isValidICloudLink(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const match = url
    .trim()
    .match(/^https:\/\/(?:www\.)?icloud\.com\/shortcuts\/([a-f0-9]{32})(?:\/|\?.*)?$/i);
  if (!match || !match[1]) return false;
  const hash = match[1].toLowerCase();
  if (KNOWN_FAKE_PLACEHOLDER_HASHES.has(hash)) return false;
  return true;
}

export function getSavedICloudLinks(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && isValidICloudLink(v)) {
        cleaned[k] = v.trim();
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function saveICloudLink(presetId: string, url: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSavedICloudLinks();
    if (!url.trim()) {
      delete current[presetId];
    } else if (isValidICloudLink(url)) {
      current[presetId] = url.trim();
    }
    localStorage.setItem(ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY, JSON.stringify(current));
  } catch {}
}

/**
 * Retrieves the current shortcuts configuration from localStorage with manifest fallback.
 */
export function getShortcutsConfig(): ShortcutsManifest {
  if (typeof window === "undefined") return DEFAULT_SHORTCUTS_MANIFEST;
  try {
    const savedLinks = getSavedICloudLinks();
    const raw = localStorage.getItem(ACCRUAL_SHORTCUTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_SHORTCUTS_MANIFEST,
      ...parsed,
      shortcuts: {
        screen_scan: {
          ...SCREEN_SCAN_CONFIG,
          ...(parsed.shortcuts?.screen_scan || {}),
          icloud_url:
            savedLinks.screen_scan ||
            (isValidICloudLink(parsed.shortcuts?.screen_scan?.icloud_url)
              ? parsed.shortcuts.screen_scan.icloud_url
              : ""),
        },
        notification_reader: {
          ...NOTIFICATION_READER_CONFIG,
          ...(parsed.shortcuts?.notification_reader || {}),
          icloud_url:
            savedLinks.notification_reader ||
            (isValidICloudLink(parsed.shortcuts?.notification_reader?.icloud_url)
              ? parsed.shortcuts.notification_reader.icloud_url
              : ""),
        },
        glass_dialog: {
          ...GLASS_DIALOG_CONFIG,
          ...(parsed.shortcuts?.glass_dialog || {}),
          icloud_url:
            savedLinks.glass_dialog ||
            (isValidICloudLink(parsed.shortcuts?.glass_dialog?.icloud_url)
              ? parsed.shortcuts.glass_dialog.icloud_url
              : ""),
        },
        wallet_tap: {
          ...WALLET_TAP_CONFIG,
          ...(parsed.shortcuts?.wallet_tap || {}),
          icloud_url:
            savedLinks.wallet_tap ||
            (isValidICloudLink(parsed.shortcuts?.wallet_tap?.icloud_url)
              ? parsed.shortcuts.wallet_tap.icloud_url
              : ""),
        },
        smart_text: {
          ...SMART_TEXT_CONFIG,
          ...(parsed.shortcuts?.smart_text || {}),
          icloud_url:
            savedLinks.smart_text ||
            (isValidICloudLink(parsed.shortcuts?.smart_text?.icloud_url)
              ? parsed.shortcuts.smart_text.icloud_url
              : ""),
        },
        screenshot: {
          ...SCREEN_SCAN_CONFIG,
          ...(parsed.shortcuts?.screenshot || {}),
        },
        notification: {
          ...NOTIFICATION_READER_CONFIG,
          ...(parsed.shortcuts?.notification || {}),
        },
      },
    };
  } catch {
    return DEFAULT_SHORTCUTS_MANIFEST;
  }
}

/**
 * Saves a custom iCloud link override for a specific shortcut channel.
 */
export function setShortcutICloudUrl(
  type: CanonicalShortcutId | "screenshot" | "notification",
  url: string,
): void {
  if (typeof window === "undefined") return;
  const canonicalKey: CanonicalShortcutId =
    type === "screenshot"
      ? "screen_scan"
      : type === "notification"
      ? "notification_reader"
      : type;
  saveICloudLink(canonicalKey, url);
}
