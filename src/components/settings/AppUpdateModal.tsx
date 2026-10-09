import { useState } from "react";
import {
  Download,
  Check,
  Copy,
  Smartphone,
  Sparkles,
  RefreshCw,
  Clock,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "../../contexts/LanguageContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import {
  type AppReleaseInfo,
  getPlatformType,
  openDownloadUrl,
} from "../../lib/appUpdateService";

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  releaseInfo: AppReleaseInfo | null;
  checking: boolean;
  onCheckAgain: () => Promise<void>;
}

export function AppUpdateModal({
  isOpen,
  onClose,
  releaseInfo,
  checking,
  onCheckAgain,
}: AppUpdateModalProps) {
  const { isIndonesian } = useLanguage();
  const [copied, setCopied] = useState(false);
  const platform = getPlatformType();

  const handleCopySource = async () => {
    if (!releaseInfo?.downloads.sideStoreSourceUrl) return;
    try {
      await navigator.clipboard.writeText(releaseInfo.downloads.sideStoreSourceUrl);
      setCopied(true);
      triggerSuccessHaptic();
      setTimeout(() => setCopied(false), 2500);
    } catch {
      triggerHaptic("heavy");
    }
  };

  const handleDownloadIpa = () => {
    if (!releaseInfo?.downloads.iosIpa) return;
    triggerHaptic("medium");
    openDownloadUrl(releaseInfo.downloads.iosIpa);
  };

  const handleDownloadApk = () => {
    if (!releaseInfo?.downloads.androidApk) return;
    triggerHaptic("medium");
    openDownloadUrl(releaseInfo.downloads.androidApk);
  };

  const changelog =
    isIndonesian && releaseInfo?.changelogId
      ? releaseInfo.changelogId
      : releaseInfo?.changelogEn || [];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)] space-y-5">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 mx-auto rounded-3xl flex items-center justify-center shadow-lg transition-transform"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Sparkles size={24} strokeWidth={1.75} style={{ color: "var(--text-primary)" }} />
          </div>

          <div>
            <h3
              className="text-[19px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian ? "Pembaruan Aplikasi" : "App Updates"}
            </h3>
            <p
              className="text-[12px] font-normal mt-0.5 leading-relaxed"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Informasi versi rilis dan distribusi resmi Accrual"
                : "Official release versions and installation packages"}
            </p>
          </div>

          {/* Version Pill Status */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium backdrop-blur-md shadow-sm"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              <span>{isIndonesian ? "Versi Terpasang:" : "Installed:"}</span>
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                v{releaseInfo?.currentVersion || "1.2.0"}
              </span>
            </div>

            {releaseInfo?.hasUpdate ? (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-sm"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-primary)",
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span>
                  {isIndonesian ? "Tersedia:" : "Available:"} v{releaseInfo.latestVersion}
                </span>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium backdrop-blur-md shadow-sm"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                <Check size={12} strokeWidth={2} />
                <span>{isIndonesian ? "Versi Terbaru" : "Latest Version"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Changelog Highlights */}
        {changelog.length > 0 && (
          <div
            className="p-4 rounded-2xl space-y-2.5 backdrop-blur-md shadow-sm"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={13} strokeWidth={1.75} style={{ color: "var(--text-tertiary)" }} />
                <span
                  className="text-[11.5px] font-semibold tracking-wide uppercase"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {isIndonesian ? "Catatan Rilis" : "Release Notes"}
                </span>
              </div>
              {releaseInfo?.releaseDate && (
                <span className="text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
                  {releaseInfo.releaseDate}
                </span>
              )}
            </div>

            <div className="space-y-2 pt-0.5">
              {changelog.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-[12px] leading-relaxed">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: "var(--text-tertiary)" }}
                  />
                  <span style={{ color: "var(--text-primary)" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform-Specific Download & Installation Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Paket Instalasi" : "Installation Packages"}
            </span>
            <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              {platform === "ios"
                ? "Apple iOS (SideStore / AltStore)"
                : platform === "android"
                  ? isIndonesian
                    ? "Android (APK Langsung)"
                    : "Android (Direct APK)"
                  : isIndonesian
                    ? "Peramban Web / Desktop"
                    : "Web / Desktop Browser"}
            </span>
          </div>

          {/* CASE A: iOS (SideStore / AltStore) */}
          {(platform === "ios" || platform === "web") && (
            <div
              className="p-3.5 rounded-2xl space-y-3 backdrop-blur-md shadow-sm"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Smartphone size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian ? "Berkas iOS (.ipa)" : "iOS Package (.ipa)"}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      SideStore / AltStore / Sideloadly
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadIpa}
                  className="px-3 py-1.5 rounded-xl font-semibold text-[11.5px] flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
                  style={{
                    background: "var(--text-primary)",
                    color: "var(--bg-primary)",
                  }}
                >
                  <Download size={13} strokeWidth={2} />
                  <span>{isIndonesian ? "Unduh .IPA" : "Get .IPA"}</span>
                </button>
              </div>

              {/* SideStore Community Source Section */}
              <div
                className="p-2.5 rounded-xl flex items-center justify-between gap-2"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px dashed var(--glass-border)",
                }}
              >
                <div className="min-w-0 pr-2">
                  <div
                    className="text-[11px] font-medium truncate"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {isIndonesian ? "Sumber SideStore Resmi:" : "Official SideStore Source:"}
                  </div>
                  <div
                    className="text-[10px]  truncate"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {releaseInfo?.downloads.sideStoreSourceUrl}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopySource}
                  className="px-2.5 py-1.5 rounded-lg text-[10.5px] font-semibold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {copied ? (
                    <>
                      <Check size={12} strokeWidth={2} />
                      <span>{isIndonesian ? "Tersalin" : "Copied"}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} strokeWidth={1.75} />
                      <span>{isIndonesian ? "Salin" : "Copy"}</span>
                    </>
                  )}
                </button>
              </div>

              {platform === "ios" && (
                <p
                  className="text-[10.5px] leading-relaxed px-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian
                    ? "Tip: Tempelkan tautan sumber di atas ke tab 'Sources' pada aplikasi SideStore Anda untuk mendapatkan pembaruan otomatis di masa mendatang."
                    : "Tip: Add the source URL above to the 'Sources' tab in your SideStore app for seamless one-tap updates."}
                </p>
              )}
            </div>
          )}

          {/* CASE B: Android (APK) */}
          {(platform === "android" || platform === "web") && (
            <div
              className="p-3.5 rounded-2xl flex items-center justify-between backdrop-blur-md shadow-sm"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Download size={16} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "Berkas Android (.apk)" : "Android Package (.apk)"}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian
                      ? "Pemasangan langsung via Supabase CDN"
                      : "Direct installer from Supabase CDN"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadApk}
                className="px-3 py-1.5 rounded-xl font-semibold text-[11.5px] flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0 shadow-sm"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-primary)",
                }}
              >
                <Download size={13} strokeWidth={2} />
                <span>{isIndonesian ? "Unduh .APK" : "Get .APK"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Actions: Check Again & Close */}
        <div className="pt-2 flex items-center gap-2.5">
          <button
            type="button"
            disabled={checking}
            onClick={onCheckAgain}
            className="flex-1 py-3 px-3 rounded-2xl font-semibold text-[12.5px] flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} strokeWidth={1.75} />
            <span>{isIndonesian ? "Periksa Ulang" : "Check Again"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-3 rounded-2xl font-semibold text-[12.5px] flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-sm"
            style={{
              background: "var(--text-primary)",
              color: "var(--bg-primary)",
            }}
          >
            <span>{isIndonesian ? "Selesai" : "Done"}</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
