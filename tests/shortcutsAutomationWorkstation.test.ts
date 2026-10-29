import { beforeEach, describe, expect, it, vi } from "vitest";
import { SHORTCUT_PRESETS, DEFAULT_SHORTCUTS_MANIFEST, ACCRUAL_SHORTCUTS_STORAGE_KEY, getShortcutsConfig, setShortcutICloudUrl, isValidICloudLink } from "../src/lib/shortcutsConfig";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
beforeEach(() => store.clear());

describe("Shortcuts capture catalog", () => {
  it("offers exactly two primary capture routes with native input contracts", () => {
    expect(SHORTCUT_PRESETS.filter(p => p.primary).map(p => p.id)).toEqual(["screen_scan", "notification_reader"]);
    const screen = SHORTCUT_PRESETS.find(p => p.id === "screen_scan")!;
    expect(screen.minIos).toBe(16);
    expect(screen.actions.map(a => a.id)).toEqual(["take_screenshot", "scan_payment"]);
    expect(screen.actions[1]).toMatchObject({ intent: "ScanPaymentScreenshotIntent", parameters: ["screenshot"] });
    expect(screen.directScheme).toBeUndefined();
    const notification = SHORTCUT_PRESETS.find(p => p.id === "notification_reader")!;
    expect(notification.minIos).toBe(27);
    expect(notification.actions[0]).toMatchObject({ intent: "LogNotificationTransactionIntent", parameters: ["notificationText", "title", "subtitle", "sourceApp", "receivedAt"] });
    expect(notification.directScheme).toBeUndefined();
  });
  it("keeps direct entry and review routes separate from capture ingestion", () => {
    expect(SHORTCUT_PRESETS.filter(p => !p.primary).map(p => p.directScheme)).toEqual(["accrual://add", "accrual://voice", "accrual://scan", "accrual://inbox"]);
    expect(SHORTCUT_PRESETS.some(p => p.id === ("glass_dialog" as string))).toBe(false);
  });
  it("ships no invented installation links or raw binaries", () => {
    for (const item of Object.values(DEFAULT_SHORTCUTS_MANIFEST.shortcuts)) {
      expect(item.icloud_url).toBe("");
      expect(item.file_url).toBe("");
    }
    expect(getShortcutsConfig().shortcuts.notification.min_ios).toBe("27.0");
  });
  it("validates syntax without treating it as proof of a published shortcut", () => {
    const url = "https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef";
    expect(isValidICloudLink(url)).toBe(true);
    expect(isValidICloudLink("https://example.com/shortcuts/0123456789abcdef0123456789abcdef")).toBe(false);
    setShortcutICloudUrl("screenshot", ` ${url} `);
    expect(getShortcutsConfig().shortcuts.screenshot.icloud_url).toBe(url);
    expect(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.screenshot.icloud_url).toBe("");
  });
  it("ignores stale configuration metadata and raw file download overrides", () => {
    store.set(ACCRUAL_SHORTCUTS_STORAGE_KEY, JSON.stringify({ shortcuts: { notification: { min_ios: "17.0", file_url: "/unsafe.shortcut", icloud_url: "javascript:alert(1)" } } }));
    expect(getShortcutsConfig().shortcuts.notification).toEqual(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.notification);
    store.set(ACCRUAL_SHORTCUTS_STORAGE_KEY, "{");
    expect(getShortcutsConfig()).toEqual(DEFAULT_SHORTCUTS_MANIFEST);
  });
});
