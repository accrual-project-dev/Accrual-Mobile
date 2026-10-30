import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export const APP_VERSION = "1.3.27";
export const APP_BUILD_NUMBER = "1327";

export interface AppReleaseInfo {
  currentVersion: string;
  currentBuild: string;
  latestVersion: string;
  latestBuild?: string;
  hasUpdate: boolean;
  releaseDate: string;
  changelogId: string[];
  changelogEn: string[];
  downloads: {
    appStoreUrl: string;
  };
  source: "manifest" | "fallback";
}

/**
 * Compares two semantic version strings (e.g. "1.2.1" vs "1.2.0").
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/i, "").trim();
  const clean2 = v2.replace(/^v/i, "").trim();
  const parts1 = clean1.split(".").map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split(".").map((p) => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export function getPlatformType(): "ios" | "android" | "web" {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === "ios" ? "ios" : "android";
  }
  return "web";
}

export async function openDownloadUrl(url: string): Promise<void> {
  if (!url) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url, windowName: "_system" });
    } else if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (err) {
    console.warn("[AppUpdate] Browser.open failed, falling back to window.open:", err);
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
}

/**
 * Checks for the latest official release notes and version manifest.
 * Strictly compliant with Apple App Store Guideline 2.5.2 & 2.3.10 (zero external sideloading or third-party binary links).
 */
export async function checkForAppUpdate(): Promise<AppReleaseInfo> {
  const officialAppStoreUrl = "https://apps.apple.com/app/id6825272166";

  const fallbackInfo: AppReleaseInfo = {
    currentVersion: APP_VERSION,
    currentBuild: APP_BUILD_NUMBER,
    latestVersion: APP_VERSION,
    latestBuild: APP_BUILD_NUMBER,
    hasUpdate: false,
    releaseDate: "2026-10-30",
    changelogId: [
      "Distribusi rilis resmi Apple App Store & TestFlight",
      "Peningkatan ketahanan sinkronisasi langganan StoreKit 2 & RevenueCat",
      "Antarmuka Pengaturan yang lebih bersih dan minimalis tanpa deskripsi berulang",
      "Integrasi tangkapan layar otomatis untuk alur persetujuan transaksi di Arsip Draft",
    ],
    changelogEn: [
      "Official Apple App Store & TestFlight distribution channel",
      "StoreKit 2 & RevenueCat subscription synchronization hardening",
      "Refined minimalist Settings interface with streamlined row typography",
      "Automated screenshot capture flow for Draft Archive transaction approvals",
    ],
    downloads: {
      appStoreUrl: officialAppStoreUrl,
    },
    source: "fallback",
  };

  try {
    const manifestUrl =
      typeof window !== "undefined" && window.location.origin.startsWith("http")
        ? `${window.location.origin}/version.json?t=${Date.now()}`
        : "https://trouvaille-drab.vercel.app/version.json";

    const res = await fetch(manifestUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      const latestVer = data.version || APP_VERSION;
      const hasUpdate = compareVersions(latestVer, APP_VERSION) > 0;

      return {
        currentVersion: APP_VERSION,
        currentBuild: APP_BUILD_NUMBER,
        latestVersion: latestVer,
        latestBuild: String(data.build || APP_BUILD_NUMBER),
        hasUpdate,
        releaseDate: data.releaseDate || fallbackInfo.releaseDate,
        changelogId: Array.isArray(data.changelog)
          ? data.changelog
          : fallbackInfo.changelogId,
        changelogEn: Array.isArray(data.changelog_en)
          ? data.changelog_en
          : fallbackInfo.changelogEn,
        downloads: {
          appStoreUrl: officialAppStoreUrl,
        },
        source: "manifest",
      };
    }
  } catch (err) {
    console.info("[AppUpdate] Manifest lookup notice:", err);
  }

  return fallbackInfo;
}
