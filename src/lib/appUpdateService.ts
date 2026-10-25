import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export const APP_VERSION = "1.3.1";
export const APP_BUILD_NUMBER = "131";

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
    androidApk: string;
    iosIpa: string;
    sideStoreSourceUrl: string;
  };
  source: "manifest" | "github" | "fallback";
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
 * Checks for the latest application update from version manifest or GitHub API.
 */
export async function checkForAppUpdate(): Promise<AppReleaseInfo> {
  const fallbackInfo: AppReleaseInfo = {
    currentVersion: APP_VERSION,
    currentBuild: APP_BUILD_NUMBER,
    latestVersion: APP_VERSION,
    latestBuild: APP_BUILD_NUMBER,
    hasUpdate: false,
    releaseDate: "2026-10-25",
    changelogId: [
      "Integrasi resmi Apple Shortcuts & App Intents langsung di aplikasi Pintasan iOS",
      "Suite 10 Widget Layar Utama & 5 Widget Kunci Layar WidgetKit dengan sinkronisasi tema adaptif",
      "Ketahanan Paywall RevenueCat StoreKit 2 dan resolusi harga otomatis",
      "Pemeriksa pembaruan aplikasi otomatis di dalam Pengaturan",
    ],
    changelogEn: [
      "Native Apple Shortcuts & App Intents integration in iOS Shortcuts app",
      "10 Home Screen & 5 Lock Screen WidgetKit suite with adaptive theme sync",
      "RevenueCat StoreKit 2 paywall resilience and automatic package price resolution",
      "In-app automatic update checker in Settings",
    ],
    downloads: {
      androidApk:
        "https://iqjcmqkgrfmopznrfikx.supabase.co/storage/v1/object/public/app-releases/Accrual-latest.apk",
      iosIpa:
        "https://github.com/syntheticae/Trouvaille/releases/download/latest/Accrual.ipa",
      sideStoreSourceUrl: "https://trouvaille-drab.vercel.app/sidestore.json",
    },
    source: "fallback",
  };

  try {
    // 1. Primary source: version.json hosted on the web deployment or Supabase
    const manifestUrl =
      typeof window !== "undefined"
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
        latestBuild: String(data.build || ""),
        hasUpdate,
        releaseDate: data.releaseDate || fallbackInfo.releaseDate,
        changelogId: Array.isArray(data.changelog)
          ? data.changelog
          : fallbackInfo.changelogId,
        changelogEn: Array.isArray(data.changelog_en)
          ? data.changelog_en
          : fallbackInfo.changelogEn,
        downloads: {
          androidApk:
            data.downloads?.androidApk || fallbackInfo.downloads.androidApk,
          iosIpa: data.downloads?.iosIpa || fallbackInfo.downloads.iosIpa,
          sideStoreSourceUrl:
            data.downloads?.sideStoreSourceUrl ||
            fallbackInfo.downloads.sideStoreSourceUrl,
        },
        source: "manifest",
      };
    }
  } catch (err) {
    console.info("[AppUpdate] Manifest lookup notice:", err);
  }

  // 2. Secondary source: GitHub Releases API
  try {
    const ghRes = await fetch(
      "https://api.github.com/repos/syntheticae/Trouvaille/releases/latest",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
      },
    );

    if (ghRes.ok) {
      const ghData = await ghRes.json();
      const tagVer = (ghData.tag_name || "").replace(/^v/i, "");
      const hasUpdate = tagVer ? compareVersions(tagVer, APP_VERSION) > 0 : false;

      let ipaUrl = fallbackInfo.downloads.iosIpa;
      let apkUrl = fallbackInfo.downloads.androidApk;

      if (Array.isArray(ghData.assets)) {
        const ipaAsset = ghData.assets.find((a: any) =>
          (a.name || "").endsWith(".ipa"),
        );
        const apkAsset = ghData.assets.find((a: any) =>
          (a.name || "").endsWith(".apk"),
        );
        if (ipaAsset?.browser_download_url) {
          ipaUrl = ipaAsset.browser_download_url;
        }
        if (apkAsset?.browser_download_url) {
          apkUrl = apkAsset.browser_download_url;
        }
      }

      return {
        currentVersion: APP_VERSION,
        currentBuild: APP_BUILD_NUMBER,
        latestVersion: tagVer || APP_VERSION,
        hasUpdate,
        releaseDate: ghData.published_at
          ? ghData.published_at.substring(0, 10)
          : fallbackInfo.releaseDate,
        changelogId: fallbackInfo.changelogId,
        changelogEn: fallbackInfo.changelogEn,
        downloads: {
          androidApk: apkUrl,
          iosIpa: ipaUrl,
          sideStoreSourceUrl: fallbackInfo.downloads.sideStoreSourceUrl,
        },
        source: "github",
      };
    }
  } catch (ghErr) {
    console.info("[AppUpdate] GitHub release lookup notice:", ghErr);
  }

  return fallbackInfo;
}
