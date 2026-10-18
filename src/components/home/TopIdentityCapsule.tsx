import { Moon, Sun, SlidersHorizontal, Settings } from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";

interface TopIdentityCapsuleProps {
  displayName: string;
  avatarUrl?: string;
  upcomingBillsCount: number;
  greetingTitle: string;
  onOpenProfileMenu: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenCustomize: () => void;
  onNavigateSettings: () => void;
  activeSpace: { id?: string; name?: string; tag?: string };
  activeSpaceId: string;
  defaultSpaceId?: string;
  onResetActiveSpace: () => void;
  isIndonesian: boolean;
  t: (key: string, fallback: string) => string;
}

export function TopIdentityCapsule({
  displayName,
  avatarUrl,
  upcomingBillsCount,
  greetingTitle,
  onOpenProfileMenu,
  theme,
  onToggleTheme,
  onOpenCustomize,
  onNavigateSettings,
  activeSpace,
  activeSpaceId,
  defaultSpaceId,
  onResetActiveSpace,
  isIndonesian,
  t,
}: TopIdentityCapsuleProps) {
  return (
    <div className="space-y-2">
      {/* HEADER CAPSULE */}
      <header className="flex justify-between items-center relative z-40 gap-3">
        <div className="relative flex-1 min-w-0 mr-2">
          <button
            type="button"
            data-tour="space-capsule"
            onClick={() => {
              triggerHaptic("light");
              onOpenProfileMenu();
            }}
            className="flex items-center gap-3 group text-left cursor-pointer select-none transition-transform active:scale-[0.98] min-w-0 max-w-full"
          >
            <div className="relative shrink-0">
              <div
                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center relative transition-shadow group-hover:shadow-md"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                  boxShadow: "0 2px 8px var(--shadow-strength)",
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className="font-semibold text-[14px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              {upcomingBillsCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center text-[9.5px] font-bold border pointer-events-none transition-transform shadow-sm"
                  style={{
                    background: "var(--text-primary)",
                    color: "var(--bg-base)",
                    borderColor: "var(--bg-base)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                  }}
                >
                  {upcomingBillsCount > 9 ? "9+" : upcomingBillsCount}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                <h1 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight truncate">
                  {greetingTitle}
                </h1>
                <span className="text-[10px] text-[var(--text-tertiary)] opacity-60 shrink-0">
                  ▾
                </span>
              </div>
              <p className="text-[11px] font-normal text-[var(--text-tertiary)] leading-none mt-1 truncate">
                {t("home.financialOverview", isIndonesian ? "Ringkasan Finansial" : "Financial Overview")}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onToggleTheme();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center glass-surface border border-[var(--glass-border)] active:scale-95 transition-transform cursor-pointer select-none"
            title={
              theme === "light"
                ? isIndonesian
                  ? "Beralih ke Mode Gelap"
                  : "Switch to Dark Mode"
                : isIndonesian
                  ? "Beralih ke Mode Terang"
                  : "Switch to Light Mode"
            }
            aria-label={
              theme === "light"
                ? isIndonesian
                  ? "Beralih ke Mode Gelap"
                  : "Switch to Dark Mode"
                : isIndonesian
                  ? "Beralih ke Mode Terang"
                  : "Switch to Light Mode"
            }
          >
            {theme === "light" ? (
              <Moon
                size={14}
                strokeWidth={1.75}
                style={{ color: "var(--text-primary)" }}
              />
            ) : (
              <Sun
                size={14}
                strokeWidth={1.75}
                style={{ color: "var(--text-primary)" }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onOpenCustomize();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center glass-surface border border-[var(--glass-border)] active:scale-95 transition-transform cursor-pointer select-none"
            title={
              isIndonesian
                ? "Kustomisasi Widget Dashboard"
                : "Customize Dashboard Widgets"
            }
            aria-label={
              isIndonesian
                ? "Kustomisasi Widget Dashboard"
                : "Customize Dashboard Widgets"
            }
          >
            <SlidersHorizontal
              size={14}
              strokeWidth={1.75}
              style={{ color: "var(--text-primary)" }}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onNavigateSettings();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center glass-surface border border-[var(--glass-border)] active:scale-95 transition-transform cursor-pointer select-none"
            title={t("settings.title", isIndonesian ? "Pengaturan" : "Settings")}
            aria-label={t("settings.title", isIndonesian ? "Pengaturan" : "Settings")}
          >
            <Settings
              size={14}
              strokeWidth={1.75}
              style={{ color: "var(--text-primary)" }}
            />
          </button>
        </div>
      </header>

      {/* Active Space Segregation Notice */}
      {activeSpaceId !== "all" &&
        activeSpaceId !== (defaultSpaceId || "personal") && (
          <div
            className="px-3.5 py-2 rounded-2xl flex items-center justify-between text-[11px] font-medium animate-fadeIn"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>
                {isIndonesian ? "Ruang Aktif: " : "Active Space: "}
                <strong className="text-[var(--text-primary)]">
                  {activeSpace.name}
                </strong>
                {activeSpace.tag ? ` (${activeSpace.tag})` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={onResetActiveSpace}
              className="text-[10px] font-semibold text-[var(--text-primary)] hover:underline cursor-pointer"
            >
              {isIndonesian ? "Kembali ke Utama" : "Return to Default"}
            </button>
          </div>
        )}
    </div>
  );
}
