import {
  Zap,
  User as UserIcon,
  ChevronRight,
  Cloud,
  Loader2,
  Check,
  RotateCcw,
  Trash2,
  Laptop,
  QrCode,
  FileSpreadsheet,
  LogOut,
} from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { useTheme } from "../../contexts/ThemeContext";

export interface SettingsProfileCardProps {
  isGuest: boolean;
  avatarUrl: string;
  displayName: string;
  email?: string;
  isIndonesian: boolean;
  onOpenProfile: () => void;
  onExitGuestMode: () => void;
}

export function SettingsProfileCard({
  isGuest,
  avatarUrl,
  displayName,
  email,
  isIndonesian,
  onOpenProfile,
  onExitGuestMode,
}: SettingsProfileCardProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";

  // ── Clean Apple Inset Grouped Tokens (Zero Glow) ──
  const groupBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.02) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const groupBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const groupShadow = isDark
    ? "0 10px 28px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
    : "0 4px 14px -4px rgba(31, 36, 48, 0.04), inset 0 1px 0 #ffffff";

  const iconBg = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)";

  const iconBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.05)";

  return (
    <div className="space-y-2 select-none">
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          onOpenProfile();
        }}
        className="w-full p-3.5 rounded-2xl flex items-center justify-between active:scale-[0.99] transition-all cursor-pointer text-left"
        style={{
          background: groupBg,
          border: groupBorder,
          boxShadow: groupShadow,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center relative shrink-0"
            style={{
              background: iconBg,
              border: iconBorder,
            }}
          >
            {isGuest ? (
              <Zap
                size={18}
                strokeWidth={1.8}
                style={{ color: "var(--text-secondary)" }}
              />
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon
                size={18}
                strokeWidth={1.8}
                style={{ color: "var(--text-secondary)" }}
              />
            )}
          </div>
          <div className="min-w-0">
            <p
              className="font-bold text-[14px] truncate leading-tight tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {isGuest
                ? isIndonesian
                  ? "Tamu Lokal"
                  : "Local Guest"
                : displayName}
            </p>
            <p
              className="text-[11px] font-medium truncate mt-0.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isGuest
                ? isIndonesian
                  ? "Brankas Perangkat Offline"
                  : "Offline Device Vault"
                : email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full border"
            style={{
              background: iconBg,
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.06)",
              color: "var(--text-secondary)",
            }}
          >
            {isIndonesian ? "Ubah" : "Edit"}
          </span>
          <ChevronRight
            size={14}
            strokeWidth={2}
            style={{ color: "var(--text-tertiary)" }}
          />
        </div>
      </button>

      {/* Guest Mode Cloud Connect Banner */}
      {isGuest && (
        <div
          className="px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all"
          style={{
            background: groupBg,
            border: groupBorder,
            boxShadow: groupShadow,
          }}
        >
          <p className="text-[11px] font-medium text-[var(--text-tertiary)] truncate">
            {isIndonesian
              ? "Data tersimpan offline · Hubungkan untuk cadangkan"
              : "Data stored offline · Connect to backup"}
          </p>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("medium");
              onExitGuestMode();
            }}
            className="h-7 px-3 rounded-full text-[11px] font-semibold shrink-0 active:scale-95 transition-all cursor-pointer shadow-xs select-none"
            style={{
              background: isDark ? "#ffffff" : "#18181b",
              color: isDark ? "#000000" : "#ffffff",
            }}
          >
            {isIndonesian ? "Hubungkan Cloud" : "Connect Cloud"}
          </button>
        </div>
      )}
    </div>
  );
}

export interface SettingsDataVaultSectionProps {
  hasDataVault: boolean;
  showCloudSync: boolean;
  showWebDashboard: boolean;
  showExportVault: boolean;
  searchQuery: string;
  isIndonesian: boolean;
  isGuest: boolean;
  hasAuthenticatedUser: boolean;
  syncStatus: "idle" | "syncing" | "success" | "error";
  lastSyncedTime: string;
  pendingMutationsCount: number;
  onSafeSync: () => void;
  onDiscardPendingAndRestore: () => void;
  onOpenWebDashboard: () => void;
  onOpenDataExportVault: () => void;
  onOpenImport?: () => void;
  onSignOut: () => void;
}

export function SettingsDataVaultSection({
  hasDataVault,
  showCloudSync,
  showWebDashboard,
  showExportVault,
  searchQuery,
  isIndonesian,
  isGuest,
  hasAuthenticatedUser,
  syncStatus,
  lastSyncedTime,
  pendingMutationsCount,
  onSafeSync,
  onDiscardPendingAndRestore,
  onOpenWebDashboard,
  onOpenDataExportVault,
  onOpenImport,
  onSignOut,
}: SettingsDataVaultSectionProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";

  // ── Clean Apple Inset Grouped Tokens (Zero Glow) ──
  const groupBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.02) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const groupBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const groupShadow = isDark
    ? "0 10px 28px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
    : "0 4px 14px -4px rgba(31, 36, 48, 0.04), inset 0 1px 0 #ffffff";

  const iconBg = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)";

  const iconBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.05)";

  const gradientDivider = {
    background: isDark
      ? "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 12%, rgba(255, 255, 255, 0.06) 88%, transparent 100%)"
      : "linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.05) 12%, rgba(0, 0, 0, 0.05) 88%, transparent 100%)",
    height: "1px",
    width: "100%",
  };

  return (
    <>
      {/* ── 7. DATA & VAULT SECTION ── */}
      {hasDataVault && (
        <section className="space-y-1 select-none">
          <h2
            className="text-[10px] font-semibold uppercase tracking-[0.1em] px-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Data & Brankas" : "Data & Vault"}
          </h2>

          <div
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: groupBg,
              border: groupBorder,
              boxShadow: groupShadow,
            }}
          >
            {/* Cloud Sync Row */}
            {showCloudSync && (
              <div className="flex items-center justify-between py-2.5 px-3.5 min-h-[46px]">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: iconBg,
                      border: iconBorder,
                      color: "var(--text-primary)",
                    }}
                  >
                    <Cloud size={13.5} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <span
                      className="text-[12.5px] font-semibold block truncate leading-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian ? "Sinkronisasi Cloud" : "Cloud Sync"}
                    </span>
                    <span
                      className="text-[9.5px] font-medium block truncate mt-0.5"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {syncStatus === "syncing"
                        ? isIndonesian
                          ? "Menyinkronkan..."
                          : "Syncing..."
                        : syncStatus === "error"
                          ? isIndonesian
                            ? "Offline · Tersimpan lokal"
                            : "Offline · Local preserved"
                          : isIndonesian
                            ? `Tersinkron ${lastSyncedTime}`
                            : `Synced ${lastSyncedTime}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={onSafeSync}
                    disabled={syncStatus === "syncing"}
                    className="h-7 px-3 rounded-full text-[10.5px] font-semibold active:scale-95 transition-all flex items-center gap-1 disabled:opacity-60 cursor-pointer shrink-0 border select-none"
                    style={{
                      background:
                        syncStatus === "success"
                          ? isDark
                            ? "#ffffff"
                            : "#18181b"
                          : iconBg,
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.06)",
                      color:
                        syncStatus === "success"
                          ? isDark
                            ? "#000000"
                            : "#ffffff"
                          : "var(--text-secondary)",
                    }}
                  >
                    {syncStatus === "syncing" && (
                      <Loader2 size={11} className="animate-spin" />
                    )}
                    {syncStatus === "success" && (
                      <Check size={11} strokeWidth={2.8} />
                    )}
                    <span>
                      {syncStatus === "syncing"
                        ? isIndonesian
                          ? "Sinkron"
                          : "Syncing"
                        : syncStatus === "success"
                          ? isIndonesian
                            ? "Selesai"
                            : "Synced"
                          : syncStatus === "error"
                            ? isIndonesian
                              ? "Coba Lagi"
                              : "Retry"
                            : isIndonesian
                              ? "Sinkronkan"
                              : "Sync Now"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Pending Offline Mutations Banner */}
            {hasAuthenticatedUser && pendingMutationsCount > 0 && (
              <>
                <div style={gradientDivider} />
                <div
                  className="p-3 m-2.5 rounded-xl flex flex-col gap-2 transition-all"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.03)"
                      : "rgba(0, 0, 0, 0.025)",
                    border: groupBorder,
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: iconBg,
                        border: iconBorder,
                        color: "var(--text-primary)",
                      }}
                    >
                      <RotateCcw size={12} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[12px] font-semibold block truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {isIndonesian
                            ? "Antrean Mutasi Tertunda"
                            : "Pending Offline Mutations"}
                        </span>
                        <span
                          className="text-[9.5px] font-mono px-1.5 py-0.2 rounded border"
                          style={{
                            background: iconBg,
                            borderColor: isDark
                              ? "rgba(255, 255, 255, 0.08)"
                              : "rgba(0, 0, 0, 0.06)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {pendingMutationsCount}
                        </span>
                      </div>
                      <p
                        className="text-[10.5px] font-normal leading-relaxed mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {isIndonesian
                          ? "Ada transaksi uji coba atau mutasi lokal yang belum tersimpan di cloud dan sedang memotong saldo Anda. Anda dapat membatalkannya untuk memulihkan saldo dompet seketika."
                          : "There are local test transactions not saved to cloud that deducted your balance. Discard them to restore your wallet balance immediately."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={onDiscardPendingAndRestore}
                      disabled={syncStatus === "syncing"}
                      className="flex-1 h-7.5 px-2.5 rounded-lg text-[10.5px] font-semibold border flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      style={{
                        background: iconBg,
                        borderColor: isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.06)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <Trash2 size={11.5} strokeWidth={1.8} />
                      <span>
                        {isIndonesian
                          ? "Buang & Reset Saldo"
                          : "Discard & Reset"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={onSafeSync}
                      disabled={syncStatus === "syncing"}
                      className="h-7.5 px-3 rounded-lg text-[10.5px] font-semibold border flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      style={{
                        background: isDark ? "#ffffff" : "#18181b",
                        borderColor: isDark ? "#ffffff" : "#18181b",
                        color: isDark ? "#000000" : "#ffffff",
                      }}
                    >
                      <Cloud size={11.5} strokeWidth={1.8} />
                      <span>
                        {isIndonesian ? "Kirim ke Cloud" : "Push to Cloud"}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Link Web Dashboard */}
            {showWebDashboard && (
              <>
                <div style={gradientDivider} />
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onOpenWebDashboard();
                  }}
                  className="flex items-center justify-between py-2.5 px-3.5 min-h-[46px] active:bg-white/[0.04] transition-colors cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: iconBg,
                        border: iconBorder,
                        color: "var(--text-primary)",
                      }}
                    >
                      <Laptop size={13.5} strokeWidth={1.8} />
                    </div>
                    <span
                      className="text-[12.5px] font-semibold block truncate leading-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian
                        ? "Tautkan Web Dashboard"
                        : "Link Web Dashboard"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[10.5px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1"
                      style={{
                        background: iconBg,
                        borderColor: isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.06)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <QrCode size={11} strokeWidth={1.8} />
                      <span>{isIndonesian ? "Pindai" : "Scan"}</span>
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      style={{ color: "var(--text-tertiary)" }}
                    />
                  </div>
                </button>
              </>
            )}

            {/* Unified Report Export & Encrypted Vault */}
            {showExportVault && (
              <>
                <div style={gradientDivider} />
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onOpenDataExportVault();
                  }}
                  className="flex items-center justify-between py-2.5 px-3.5 min-h-[46px] active:bg-white/[0.04] transition-colors cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: iconBg,
                        border: iconBorder,
                        color: "var(--text-primary)",
                      }}
                    >
                      <FileSpreadsheet size={13.5} strokeWidth={1.8} />
                    </div>
                    <span
                      className="text-[12.5px] font-semibold block truncate leading-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian
                        ? "Laporan & Cadangan Vault"
                        : "Report & Data Vault"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span
                      className="text-[10.5px] font-medium px-2 py-0.5 rounded-full border"
                      style={{
                        borderColor: isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.06)",
                        color: "var(--text-secondary)",
                        background: iconBg,
                      }}
                    >
                      {isIndonesian ? "Ekspor & Cadangan" : "Export & Backup"}
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      style={{ color: "var(--text-tertiary)" }}
                    />
                  </div>
                </button>
              </>
            )}

            {/* Bank Statement Ingestion */}
            {onOpenImport && (
              <>
                <div style={gradientDivider} />
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onOpenImport();
                  }}
                  className="flex items-center justify-between py-2.5 px-3.5 min-h-[46px] active:bg-white/[0.04] transition-colors cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: iconBg,
                        border: iconBorder,
                        color: "var(--text-primary)",
                      }}
                    >
                      <FileSpreadsheet size={13.5} strokeWidth={1.8} />
                    </div>
                    <span
                      className="text-[12.5px] font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian
                        ? "Impor Rekening Koran"
                        : "Import Bank Statement"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[11.5px] font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {isIndonesian ? "Bank / Mutasi" : "Bank / CSV"}
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      style={{ color: "var(--text-tertiary)" }}
                    />
                  </div>
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* ── 8. SIGN OUT / EXIT GUEST ── */}
      {!searchQuery.trim() && (
        <div className="pt-1 select-none">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full h-11 rounded-2xl font-semibold text-[12.5px] flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer"
            style={{
              background: groupBg,
              border: groupBorder,
              boxShadow: groupShadow,
              color: "var(--text-primary)",
            }}
          >
            <LogOut size={14} strokeWidth={1.8} />
            <span>
              {isGuest
                ? isIndonesian
                  ? "Keluar Mode Tamu"
                  : "Exit Guest Mode"
                : isIndonesian
                  ? "Keluar Akun"
                  : "Log Out"}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
