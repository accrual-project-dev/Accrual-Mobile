// ======================================================================
// ACCRUAL SHORTCUTS REMOTE & LOCAL CONFIGURATION
// Zero-Bug Hybrid Distribution Architecture:
// 1. Official Verified iCloud Links for Screen Scanner & Dialog Glass
// 2. Native iOS AppShortcutsProvider & AppIntents (QuickLogIntent.swift)
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
    screenshot: ShortcutItemConfig;
    notification: ShortcutItemConfig;
  };
  updated_at: string;
}

export const ACCRUAL_SHORTCUTS_STORAGE_KEY = "accrual_shortcuts_custom_icloud_v4";
export const ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY = "ACCRUAL_SHORTCUT_ICLOUD_LINKS_V4";

/**
 * Official verified iCloud Shortcut URLs created and shared by the Accrual team.
 */
export const OFFICIAL_SCREEN_SCAN_ICLOUD_URL =
  "https://www.icloud.com/shortcuts/b507114cd8d64e59a00f5382dd17a022";
export const OFFICIAL_GLASS_DIALOG_ICLOUD_URL =
  "https://www.icloud.com/shortcuts/be141afff1244015b691ca4a46676944";

const KNOWN_FAKE_PLACEHOLDER_HASHES = new Set([
  "b01a608a4e0d4207970945a8f8c45f3f",
  "c01a608a4e0d4207970945a8f8c45f3f",
  "e01a608a4e0d4207970945a8f8c45f3f",
  "f01a608a4e0d4207970945a8f8c45f3f",
  "00000000000000000000000000000000",
]);

const SCREEN_SCAN_CONFIG: ShortcutItemConfig = {
  id: "screen_scan",
  version: 4,
  icloud_url: OFFICIAL_SCREEN_SCAN_ICLOUD_URL,
  direct_scheme: "accrual://scan-screen?text=[Teks Layar]&draft=true",
  min_ios: "16.0",
  requires_personal_automation: false,
};

const GLASS_DIALOG_CONFIG: ShortcutItemConfig = {
  id: "glass_dialog",
  version: 4,
  icloud_url: OFFICIAL_GLASS_DIALOG_ICLOUD_URL,
  direct_scheme:
    "accrual://glass-dialog?amount=[Nominal]&category=[Kategori]&wallet=[Akun]&datetime=[Tanggal]&note=[Catatan]",
  min_ios: "16.0",
  requires_personal_automation: false,
};

const NOTIFICATION_READER_CONFIG: ShortcutItemConfig = {
  id: "notification_reader",
  version: 4,
  icloud_url: "",
  direct_scheme:
    "accrual://notify?text=[Teks]&title=[Judul]&subtitle=[Subjudul]&app=[Aplikasi]&at=[Tanggal]&draft=true",
  min_ios: "17.0",
  requires_personal_automation: true,
};

const WALLET_TAP_CONFIG: ShortcutItemConfig = {
  id: "wallet_tap",
  version: 4,
  icloud_url: "",
  direct_scheme:
    "accrual://wallet-tap?amount=[Jumlah]&merchant=[Merchant]&wallet=[Kartu atau Akun]&datetime=[Tanggal]&draft=true",
  min_ios: "17.0",
  requires_personal_automation: true,
};

const SMART_TEXT_CONFIG: ShortcutItemConfig = {
  id: "smart_text",
  version: 4,
  icloud_url: "",
  direct_scheme: "accrual://smart-text?text=[Salinan Papan Klip atau Teks]&draft=true",
  min_ios: "16.0",
  requires_personal_automation: false,
};

export const DEFAULT_SHORTCUTS_MANIFEST: ShortcutsManifest = {
  shortcuts: {
    screen_scan: SCREEN_SCAN_CONFIG,
    glass_dialog: GLASS_DIALOG_CONFIG,
    notification_reader: NOTIFICATION_READER_CONFIG,
    wallet_tap: WALLET_TAP_CONFIG,
    smart_text: SMART_TEXT_CONFIG,
    screenshot: SCREEN_SCAN_CONFIG,
    notification: NOTIFICATION_READER_CONFIG,
  },
  updated_at: "2026-10-30T21:00:00Z",
};

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

export function getShortcutsConfig(): ShortcutsManifest {
  if (typeof window === "undefined") return DEFAULT_SHORTCUTS_MANIFEST;
  try {
    const savedLinks = getSavedICloudLinks();
    return {
      ...DEFAULT_SHORTCUTS_MANIFEST,
      shortcuts: {
        screen_scan: {
          ...SCREEN_SCAN_CONFIG,
          icloud_url: savedLinks.screen_scan || OFFICIAL_SCREEN_SCAN_ICLOUD_URL,
        },
        glass_dialog: {
          ...GLASS_DIALOG_CONFIG,
          icloud_url: savedLinks.glass_dialog || OFFICIAL_GLASS_DIALOG_ICLOUD_URL,
        },
        notification_reader: {
          ...NOTIFICATION_READER_CONFIG,
          icloud_url: savedLinks.notification_reader || "",
        },
        wallet_tap: {
          ...WALLET_TAP_CONFIG,
          icloud_url: savedLinks.wallet_tap || "",
        },
        smart_text: {
          ...SMART_TEXT_CONFIG,
          icloud_url: savedLinks.smart_text || "",
        },
        screenshot: {
          ...SCREEN_SCAN_CONFIG,
          icloud_url: savedLinks.screen_scan || OFFICIAL_SCREEN_SCAN_ICLOUD_URL,
        },
        notification: {
          ...NOTIFICATION_READER_CONFIG,
        },
      },
    };
  } catch {
    return DEFAULT_SHORTCUTS_MANIFEST;
  }
}

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
