import { useState, useRef } from "react";
import {
  User as UserIcon,
  Camera,
  CloudCheck,
  Trash2,
  ArrowRight,
  HardDrive,
  Copy,
  Check,
  MoreVertical,
  RotateCcw,
  Sparkles,
  Shield,
  ChevronRight,
  Mail,
  Key,
  X,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { triggerHaptic } from "../../lib/haptics";

interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  onOpenDeleteAccount: () => void;
  onOpenResetTransactions?: () => void;
  onReRunCustomization?: () => void;
}

export function ProfileSheet({
  isOpen,
  onClose,
  avatarUrl,
  setAvatarUrl,
  displayName,
  setDisplayName,
  onOpenDeleteAccount,
  onOpenResetTransactions,
  onReRunCustomization: _onReRunCustomization,
}: ProfileSheetProps) {
  const { session, isGuest, exitGuestMode } = useAuth();
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const { isPremium, openPaywall } = useSubscription();
  const isDark = theme !== "light";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isDangerMenuOpen, setIsDangerMenuOpen] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.7);
        setAvatarUrl(compressed);
        setIsUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async () => {
    try {
      setIsSaving(true);
      localStorage.setItem("trouvaille_avatar", avatarUrl);
      if (session?.user?.id && !isGuest) {
        const { error } = await supabase.auth.updateUser({
          data: { display_name: displayName, avatar_url: avatarUrl },
        });
        if (error) throw error;
      }
      triggerHaptic("medium");
      onClose();
      showToast(
        isIndonesian
          ? "Profil berhasil diperbarui"
          : "Profile updated successfully",
        "update",
        () => {},
      );
    } catch (e: any) {
      showToast(
        e.message ||
          (isIndonesian
            ? "Gagal memperbarui profil"
            : "Failed to update profile"),
        "delete",
        () => {},
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyId = () => {
    if (!session?.user?.id) return;
    navigator.clipboard.writeText(session.user.id);
    setCopiedId(true);
    triggerHaptic("light");
    showToast(
      isIndonesian
        ? "ID Pengguna disalin ke papan klip"
        : "User ID copied to clipboard",
      "update",
      () => {},
    );
    setTimeout(() => setCopiedId(false), 2500);
  };

  // ── Liquid Glass Tactile Materials ───────────────────────────────────────
  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.085)"
    : "1px solid rgba(0, 0, 0, 0.065)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.085), 0 2px 6px rgba(0, 0, 0, 0.22)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.035)";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="px-5 sm:px-6 pt-1 space-y-4 select-none max-w-lg mx-auto"
        style={{
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
        }}
      >
        {/* ── Top Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90 animate-pulse" />
            <div>
              <h3 className="text-[16.5px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                {isIndonesian ? "Profil Pengguna" : "Personal Profile"}
              </h3>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                {isIndonesian
                  ? "Identitas, sinkronisasi cloud & brankas keamanan"
                  : "Identity, cloud sync & vault security"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 3-Action Danger Menu Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setIsDangerMenuOpen((prev) => !prev);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95"
                style={{
                  background: isDangerMenuOpen
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : controlBg,
                  color: isDangerMenuOpen
                    ? isDark
                      ? "#000000"
                      : "#ffffff"
                    : "var(--text-secondary)",
                  border: isDangerMenuOpen
                    ? isDark
                      ? "1px solid #ffffff"
                      : "1px solid #18181b"
                    : controlBorder,
                  boxShadow: controlShadow,
                }}
                title={
                  isIndonesian
                    ? "Tindakan Data & Brankas"
                    : "Data & Vault Actions"
                }
                aria-label="Vault Actions"
              >
                <MoreVertical size={15} strokeWidth={1.8} />
              </button>

              {/* Liquid Glass Frosted Popover Menu */}
              {isDangerMenuOpen && (
                <div
                  className="absolute right-0 top-10 w-72 rounded-3xl p-1.5 shadow-2xl z-50 border backdrop-blur-3xl space-y-1 transition-all"
                  style={{
                    background: isDark
                      ? "linear-gradient(180deg, rgba(32,32,38,0.96) 0%, rgba(20,20,24,0.98) 100%)"
                      : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,247,250,0.98) 100%)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.14)"
                      : "rgba(0,0,0,0.08)",
                    boxShadow: isDark
                      ? "0 20px 50px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.15)"
                      : "0 16px 36px rgba(0,0,0,0.12), inset 0 1px 0 #ffffff",
                  }}
                >
                  <div className="px-3 py-1.5 border-b border-[var(--glass-border)]/40 mb-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {isIndonesian ? "Tindakan Lanjutan" : "Vault Operations"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("medium");
                      setIsDangerMenuOpen(false);
                      onClose();
                      onOpenResetTransactions?.();
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-2xl text-left transition-colors cursor-pointer hover:bg-white/[0.06] active:scale-[0.98]"
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: controlBg,
                        border: controlBorder,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <RotateCcw size={13} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">
                        {isIndonesian
                          ? "Atur Ulang Transaksi"
                          : "Reset Transaction Data"}
                      </p>
                      <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">
                        {isIndonesian
                          ? "Kosongkan transaksi pada ruang aktif"
                          : "Wipe transactions in active space"}
                      </p>
                    </div>
                  </button>

                  <div className="border-t border-[var(--glass-border)]/40 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("heavy");
                      setIsDangerMenuOpen(false);
                      onClose();
                      onOpenDeleteAccount();
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-2xl text-left transition-colors cursor-pointer hover:bg-white/[0.06] active:scale-[0.98]"
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: controlBg,
                        border: controlBorder,
                        color: "var(--text-primary)",
                      }}
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">
                        {isIndonesian
                          ? "Hapus Akun & Reset Brankas"
                          : "Delete Account & Wipe"}
                      </p>
                      <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">
                        {isIndonesian
                          ? "Hapus permanen akun & seluruh data"
                          : "Permanently wipe account & data"}
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Close Sheet Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={isIndonesian ? "Tutup" : "Close"}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
              }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* 1. Centered Apple macOS ID Avatar Halo */}
        <div className="flex flex-col items-center justify-center py-1">
          <div className="relative">
            {/* Halo Double Glass Rim */}
            <div
              className="w-20 h-20 rounded-full p-1 flex items-center justify-center shadow-lg transition-all"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%)"
                  : "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(0,0,0,0.06) 100%)",
                boxShadow: isDark
                  ? "0 8px 24px -4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.3)"
                  : "0 6px 18px -3px rgba(0,0,0,0.08), inset 0 1px 0 #ffffff",
              }}
            >
              <div
                className="w-full h-full rounded-full overflow-hidden flex items-center justify-center relative"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.03)",
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon
                    size={34}
                    style={{ color: "var(--text-secondary)" }}
                  />
                )}

                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs rounded-full">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Quick Camera Action Knob */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer border-2"
              style={{
                background: isDark ? "#ffffff" : "#18181b",
                color: isDark ? "#000000" : "#ffffff",
                borderColor: isDark ? "#1c1c21" : "#ffffff",
              }}
              title={isIndonesian ? "Ubah Foto" : "Change Photo"}
            >
              <Camera size={13} strokeWidth={2} />
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <span className="text-[11px] text-[var(--text-tertiary)] mt-2 font-medium">
            {isIndonesian
              ? "Ketuk kamera untuk memperbarui avatar"
              : "Tap camera to change avatar"}
          </span>
        </div>

        {/* 2. Grouped Inset Card: Identity & Display Name */}
        <div
          className="rounded-2xl p-3.5 space-y-2.5 transition-all"
          style={{
            background: controlBg,
            border: controlBorder,
            boxShadow: controlShadow,
          }}
        >
          <div className="space-y-1">
            <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1 block">
              {isIndonesian ? "Nama Tampilan" : "Display Name"}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={
                isIndonesian ? "misal: Alex Morgan" : "e.g. Alex Morgan"
              }
              className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold outline-none transition-all placeholder:text-[var(--text-tertiary)]"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(0, 0, 0, 0.03)",
                border: isDark
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(0, 0, 0, 0.06)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Guest Link Account Banner */}
          {isGuest && (
            <div className="pt-2 border-t border-[var(--glass-border)]/40 space-y-2">
              <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)] px-0.5">
                {isIndonesian
                  ? "Data tersimpan lokal di perangkat ini. Hubungkan akun Google atau Email untuk mengaktifkan sinkronisasi brankas cloud."
                  : "Your data is stored locally. Connect an email or Google account to seamlessly sync your records to the private cloud vault."}
              </p>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  exitGuestMode();
                }}
                className="w-full h-10 px-3 rounded-xl font-semibold text-[11.5px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <span>
                  {isIndonesian
                    ? "Hubungkan Akun Google atau Email"
                    : "Connect Google or Email Account"}
                </span>
                <ArrowRight size={13} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {/* 3. Primary Action: Save Profile Changes */}
        <button
          type="button"
          onClick={handleUpdateProfile}
          disabled={isSaving}
          className="w-full h-11 rounded-full font-semibold text-[13px] active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center disabled:opacity-50 select-none"
          style={{
            background: isDark ? "#ffffff" : "#18181b",
            color: isDark ? "#000000" : "#ffffff",
          }}
        >
          {isSaving
            ? isIndonesian
              ? "Menyimpan Perubahan..."
              : "Saving Changes..."
            : isIndonesian
              ? "Simpan Perubahan Profil"
              : "Save Profile Changes"}
        </button>

        {/* 3.1 Accrual Pro Membership Card */}
        <div
          onClick={() => {
            triggerHaptic("light");
            openPaywall({ feature: "settings_manual" });
          }}
          className="rounded-2xl p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all select-none"
          style={{
            background: controlBg,
            border: controlBorder,
            boxShadow: controlShadow,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : "rgba(0, 0, 0, 0.04)",
                border: isDark
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(0, 0, 0, 0.05)",
                color: "var(--text-primary)",
              }}
            >
              <Sparkles size={17} strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-[var(--text-primary)] tracking-tight">
                  Accrual Pro
                </span>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.06)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.12)"
                      : "1px solid rgba(0, 0, 0, 0.08)",
                    color: "var(--text-primary)",
                  }}
                >
                  {isPremium
                    ? isIndonesian
                      ? "AKTIF"
                      : "ACTIVE"
                    : isIndonesian
                      ? "UPGRADE"
                      : "UPGRADE"}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-snug truncate">
                {isPremium
                  ? isIndonesian
                    ? "Keanggotaan aktif • Fitur eksekutif terbuka"
                    : "Membership active • Executive features unlocked"
                  : isIndonesian
                    ? "Buka kuota OCR tak terbatas, analitik penuh, & multi-space"
                    : "Unlock unlimited OCR, executive telemetry, & multi-space"}
              </p>
            </div>
          </div>
          <ChevronRight
            size={15}
            strokeWidth={1.8}
            className="text-[var(--text-tertiary)] shrink-0 ml-2"
          />
        </div>

        {/* 4. Grouped Inset Card: Security & Vault Info */}
        <div
          className="rounded-2xl p-4 space-y-3 transition-all"
          style={{
            background: controlBg,
            border: controlBorder,
            boxShadow: controlShadow,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield
                size={14}
                strokeWidth={1.8}
                className="text-[var(--text-secondary)]"
              />
              <span className="text-[12px] font-semibold text-[var(--text-primary)] tracking-tight">
                {isIndonesian
                  ? "Informasi Akun & Keamanan"
                  : "Account & Security Vault"}
              </span>
            </div>

            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-[var(--glass-border)] bg-white/[0.04] text-[var(--text-secondary)] flex items-center gap-1.5">
              {isGuest ? (
                <>
                  <HardDrive size={11} strokeWidth={1.8} />
                  <span>
                    {isIndonesian ? "Brankas Lokal" : "Local Vault (Offline)"}
                  </span>
                </>
              ) : (
                <>
                  <CloudCheck size={11} strokeWidth={1.8} />
                  <span>
                    {isIndonesian ? "Tersinkronisasi Cloud" : "Cloud Synced"}
                  </span>
                </>
              )}
            </span>
          </div>

          <div className="space-y-2 text-[12px] pt-1">
            <div className="flex items-center justify-between py-1 border-b border-[var(--glass-border)]/40">
              <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
                <Mail size={12} strokeWidth={1.75} />
                <span>Email</span>
              </span>
              <span className="font-medium text-[var(--text-primary)] truncate max-w-[210px]">
                {session?.user?.email ||
                  (isIndonesian ? "Pengguna Tamu" : "Guest User (Offline)")}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-[var(--glass-border)]/40">
              <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
                <Key size={12} strokeWidth={1.75} />
                <span>{isIndonesian ? "ID Pengguna" : "User ID"}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                disabled={!session?.user?.id}
                className="flex items-center gap-1.5 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full border border-[var(--glass-border)] bg-white/[0.04] active:scale-95 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-all"
              >
                <span>
                  {session?.user?.id
                    ? `${session.user.id.slice(0, 8)}...`
                    : isIndonesian
                      ? "Lokal"
                      : "Local"}
                </span>
                {copiedId ? (
                  <Check size={11} className="text-[var(--text-primary)]" />
                ) : (
                  <Copy size={11} />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
                <Shield size={12} strokeWidth={1.75} />
                <span>
                  {isIndonesian ? "Protokol Brankas" : "Vault Protocol"}
                </span>
              </span>
              <span className="text-[11px] font-mono font-medium text-[var(--text-secondary)]">
                {isGuest
                  ? "IndexedDB + LocalStorage"
                  : "Supabase RLS + AES-GCM"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
