import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHORTCUTS_MANIFEST, ACCRUAL_SHORTCUTS_STORAGE_KEY, getShortcutsConfig, setShortcutICloudUrl, isValidICloudLink, OFFICIAL_SCREEN_SCAN_ICLOUD_URL, OFFICIAL_GLASS_DIALOG_ICLOUD_URL } from "../src/lib/shortcutsConfig";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe("Documented five-route Shortcuts catalog", () => {
  it("provides the five canonical routes with backwards-compatible aliases", () => {
    const routes = DEFAULT_SHORTCUTS_MANIFEST.shortcuts;
    expect([...new Set(Object.values(routes).map(route => route.id))].sort()).toEqual(["glass_dialog", "notification_reader", "screen_scan", "smart_text", "wallet_tap"]);
    expect(routes.screenshot).toBe(routes.screen_scan);
    expect(routes.notification).toBe(routes.notification_reader);
  });
  it("keeps automatic capture routes in review and manual dialog entry separate", () => {
    const routes = DEFAULT_SHORTCUTS_MANIFEST.shortcuts;
    for (const id of ["screen_scan", "notification_reader", "wallet_tap", "smart_text"] as const) {
      expect(routes[id].direct_scheme).toContain("draft=true");
    }
    expect(routes.glass_dialog.direct_scheme.startsWith("accrual://glass-dialog?")).toBe(true);
    expect(routes.notification_reader.requires_personal_automation).toBe(true);
    expect(routes.wallet_tap.requires_personal_automation).toBe(true);
  });
  it("distributes only the configured team iCloud templates and no raw binaries", () => {
    expect(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.screen_scan.icloud_url).toBe(OFFICIAL_SCREEN_SCAN_ICLOUD_URL);
    expect(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.glass_dialog.icloud_url).toBe(OFFICIAL_GLASS_DIALOG_ICLOUD_URL);
    for (const item of Object.values(DEFAULT_SHORTCUTS_MANIFEST.shortcuts)) {
      expect(item).not.toHaveProperty("file_url");
      if (item.icloud_url) expect(isValidICloudLink(item.icloud_url)).toBe(true);
    }
    expect(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.notification_reader.icloud_url).toBe("");
  });
  it("validates syntax and persists a custom link without mutating defaults", () => {
    const url = "https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef";
    expect(isValidICloudLink(url)).toBe(true);
    expect(isValidICloudLink("https://example.com/shortcuts/0123456789abcdef0123456789abcdef")).toBe(false);
    setShortcutICloudUrl("screenshot", ` ${url} `);
    expect(getShortcutsConfig().shortcuts.screenshot.icloud_url).toBe(url);
    expect(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.screenshot.icloud_url).toBe(OFFICIAL_SCREEN_SCAN_ICLOUD_URL);
  });
  it("ignores stale configuration metadata and raw file download overrides", () => {
    store.set(ACCRUAL_SHORTCUTS_STORAGE_KEY, JSON.stringify({ shortcuts: { notification: { min_ios: "17.0", file_url: "/unsafe.shortcut", icloud_url: "javascript:alert(1)" } } }));
    expect(getShortcutsConfig().shortcuts.notification).toEqual(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.notification);
    store.set(ACCRUAL_SHORTCUTS_STORAGE_KEY, "{");
    expect(getShortcutsConfig()).toEqual(DEFAULT_SHORTCUTS_MANIFEST);
  });
});
