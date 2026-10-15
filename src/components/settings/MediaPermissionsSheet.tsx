import { useState, useEffect } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  Camera,
  Image as ImageIcon,
  ShieldCheck,
  Check,
  Bell,
  Mic,
  Lock,
  SlidersHorizontal,
} from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSecurityLock } from "../../contexts/SecurityLockContext";
import {
  checkMediaPermissions,
  requestPhotosPermission,
  requestCameraPermission,
  checkNotificationPermission,
  requestAppNotificationPermission,
  checkMicrophonePermission,
  requestMicrophonePermission,
  openAppSettings,
  type MediaPermissionsState,
} from "../../lib/mediaPermissions";

interface MediaPermissionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MediaPermissionsSheet({
  isOpen,
  onClose,
}: MediaPermissionsSheetProps) {
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const {
    securitySettings,
    isBiometricSupported,
    enrollBiometric,
  } = useSecurityLock();

  const [permissions, setPermissions] = useState<MediaPermissionsState>({
    camera: "prompt",
    photos: "prompt",
  });
  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "prompt">("prompt");
  const [micStatus, setMicStatus] = useState<"granted" | "denied" | "prompt">("prompt");
  const [loading, setLoading] = useState(false);

  const refreshAllPermissions = async () => {
    try {
      const [media, notif, mic] = await Promise.all([
        checkMediaPermissions(),
        checkNotificationPermission(),
        checkMicrophonePermission(),
      ]);
      setPermissions(media);
      setNotifStatus(notif);
      setMicStatus(mic);
    } catch (err) {
      console.warn("Failed to check app permissions:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshAllPermissions();
    }
  }, [isOpen]);

  const handleRequestNotifications = async () => {
    triggerHaptic("medium");
    setLoading(true);
    try {
      const granted = await requestAppNotificationPermission();
      await refreshAllPermissions();
      if (granted) {
        showToast(
          isIndonesian
            ? "Izin pemberitahuan diberikan"
            : "Notification permission granted",
          "add",
          () => {},
        );
      } else {
        showToast(
          isIndonesian
            ? "Harap izinkan Pemberitahuan di Pengaturan iPhone > Accrual"
            : "Please allow Notifications in iPhone Settings > Accrual",
          "delete",
          () => {},
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPhotos = async () => {
    triggerHaptic("medium");
    setLoading(true);
    try {
      const granted = await requestPhotosPermission();
      await refreshAllPermissions();
      if (granted) {
        showToast(
          isIndonesian
            ? "Akses galeri foto diberikan"
            : "Photo library access granted",
          "add",
          () => {},
        );
      } else {
        showToast(
          isIndonesian
            ? "Harap izinkan Foto di Pengaturan iPhone > Accrual"
            : "Please allow Photos in iPhone Settings > Accrual",
          "delete",
          () => {},
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCamera = async () => {
    triggerHaptic("medium");
    setLoading(true);
    try {
      const granted = await requestCameraPermission();
      await refreshAllPermissions();
      if (granted) {
        showToast(
          isIndonesian
            ? "Akses kamera diberikan"
            : "Camera access granted",
          "add",
          () => {},
        );
      } else {
        showToast(
          isIndonesian
            ? "Harap izinkan Kamera di Pengaturan iPhone > Accrual"
            : "Please allow Camera in iPhone Settings > Accrual",
          "delete",
          () => {},
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestMicrophone = async () => {
    triggerHaptic("medium");
    setLoading(true);
    try {
      const granted = await requestMicrophonePermission();
      await refreshAllPermissions();
      if (granted) {
        showToast(
          isIndonesian
            ? "Akses mikrofon diberikan"
            : "Microphone access granted",
          "add",
          () => {},
        );
      } else {
        showToast(
          isIndonesian
            ? "Harap izinkan Mikrofon di Pengaturan iPhone > Accrual"
            : "Please allow Microphone in iPhone Settings > Accrual",
          "delete",
          () => {},
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollBiometric = async () => {
    triggerHaptic("medium");
    setLoading(true);
    try {
      const success = await enrollBiometric();
      if (success) {
        showToast(
          isIndonesian
            ? "Autentikasi biometrik berhasil diaktifkan"
            : "Biometric authentication activated",
          "add",
          () => {},
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSystemSettings = () => {
    triggerHaptic("light");
    openAppSettings();
    showToast(
      isIndonesian
        ? "Membuka Pengaturan iPhone > Accrual..."
        : "Opening iPhone Settings > Accrual...",
      "update",
      () => {},
    );
  };

  const isPhotosGranted =
    permissions.photos === "granted" || permissions.photos === "limited";
  const isCameraGranted = permissions.camera === "granted";
  const isNotifGranted = notifStatus === "granted";
  const isMicGranted = micStatus === "granted";
  const isBiometricActive = securitySettings.hasBiometric;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        isIndonesian
          ? "Izin Perangkat & Privasi"
          : "Device & Privacy Permissions"
      }
    >
      <div
        className="p-4 pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)] space-y-4"
        style={{ fontFamily: "Urbanist, -apple-system, sans-serif" }}
      >
        {/* Header Summary */}
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)]">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-[var(--glass-border)] bg-[var(--glass-fill)]"
            style={{
              color: "var(--text-primary)",
            }}
          >
            <ShieldCheck size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">
              {isIndonesian
                ? "Privasi Perangkat Keras & Sistem"
                : "Hardware & System Privacy"}
            </h4>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
              {isIndonesian
                ? "Accrual memproses semua data finansial, foto struk, dan rekaman suara secara lokal di perangkat tanpa telemetri pihak ketiga."
                : "Accrual processes all financial data, receipt images, and audio locally on-device with zero third-party telemetry."}
            </p>
          </div>
        </div>

        {/* Permissions Items List */}
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] divide-y divide-[var(--glass-border)] overflow-hidden">
          {/* 1. Notifications & Reminders */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-[var(--glass-border)] bg-[var(--glass-fill)]"
                style={{
                  color: "var(--text-primary)",
                }}
              >
                <Bell size={16} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <span className="text-[13px] font-semibold block text-[var(--text-primary)] truncate">
                  {isIndonesian ? "Pemberitahuan & Pengingat" : "Notifications & Reminders"}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)] block mt-0.5">
                  {isIndonesian
                    ? "Jatuh tempo tagihan & ringkasan mingguan"
                    : "Bill due reminders & weekly digest"}
                </span>
              </div>
            </div>

            {isNotifGranted ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shrink-0 bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)]">
                <Check size={11} strokeWidth={2.5} />
                {isIndonesian ? "Diizinkan" : "Granted"}
              </span>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleRequestNotifications}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 cursor-pointer shrink-0 bg-black dark:bg-white text-white dark:text-black shadow-xs"
              >
                {isIndonesian ? "Minta Akses" : "Request Access"}
              </button>
            )}
          </div>

          {/* 2. Photo Library / Gallery */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-[var(--glass-border)] bg-[var(--glass-fill)]"
                style={{
                  color: "var(--text-primary)",
                }}
              >
                <ImageIcon size={16} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <span className="text-[13px] font-semibold block text-[var(--text-primary)] truncate">
                  {isIndonesian ? "Galeri Foto" : "Photo Library"}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)] block mt-0.5">
                  {isIndonesian
                    ? "Impor struk & bukti transaksi QRIS"
                    : "Import receipts & QRIS slips"}
                </span>
              </div>
            </div>

            {isPhotosGranted ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shrink-0 bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)]">
                <Check size={11} strokeWidth={2.5} />
                {isIndonesian ? "Diizinkan" : "Granted"}
              </span>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleRequestPhotos}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 cursor-pointer shrink-0 bg-black dark:bg-white text-white dark:text-black shadow-xs"
              >
                {isIndonesian ? "Minta Akses" : "Request Access"}
              </button>
            )}
          </div>

          {/* 3. Camera Hardware */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-[var(--glass-border)] bg-[var(--glass-fill)]"
                style={{
                  color: "var(--text-primary)",
                }}
              >
                <Camera size={16} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <span className="text-[13px] font-semibold block text-[var(--text-primary)] truncate">
                  {isIndonesian ? "Perangkat Kamera" : "Camera Device"}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)] block mt-0.5">
                  {isIndonesian
                    ? "Pemotretan struk instan & pemindaian"
                    : "Instant receipt photography & scanning"}
                </span>
              </div>
            </div>

            {isCameraGranted ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shrink-0 bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)]">
                <Check size={11} strokeWidth={2.5} />
                {isIndonesian ? "Diizinkan" : "Granted"}
              </span>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleRequestCamera}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 cursor-pointer shrink-0 bg-black dark:bg-white text-white dark:text-black shadow-xs"
              >
                {isIndonesian ? "Minta Akses" : "Request Access"}
              </button>
            )}
          </div>

          {/* 4. Microphone & Voice Input */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-[var(--glass-border)] bg-[var(--glass-fill)]"
                style={{
                  color: "var(--text-primary)",
                }}
              >
                <Mic size={16} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <span className="text-[13px] font-semibold block text-[var(--text-primary)] truncate">
                  {isIndonesian ? "Mikrofon & Suara" : "Microphone & Voice"}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)] block mt-0.5">
                  {isIndonesian
                    ? "Pencatatan transaksi via dikte suara"
                    : "Voice transaction input & transcription"}
                </span>
              </div>
            </div>

            {isMicGranted ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shrink-0 bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)]">
                <Check size={11} strokeWidth={2.5} />
                {isIndonesian ? "Diizinkan" : "Granted"}
              </span>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleRequestMicrophone}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 cursor-pointer shrink-0 bg-black dark:bg-white text-white dark:text-black shadow-xs"
              >
                {isIndonesian ? "Minta Akses" : "Request Access"}
              </button>
            )}
          </div>

          {/* 5. Biometrics / Face ID */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-[var(--glass-border)] bg-[var(--glass-fill)]"
                style={{
                  color: "var(--text-primary)",
                }}
              >
                <Lock size={16} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <span className="text-[13px] font-semibold block text-[var(--text-primary)] truncate">
                  {isIndonesian ? "Biometrik & Face ID" : "Biometrics & Face ID"}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)] block mt-0.5">
                  {isIndonesian
                    ? "Autentikasi brankas & kunci privasi"
                    : "Vault security & instant unlock"}
                </span>
              </div>
            </div>

            {isBiometricActive ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shrink-0 bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)]">
                <Check size={11} strokeWidth={2.5} />
                {isIndonesian ? "Aktif" : "Active"}
              </span>
            ) : isBiometricSupported ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleEnrollBiometric}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 cursor-pointer shrink-0 bg-black dark:bg-white text-white dark:text-black shadow-xs"
              >
                {isIndonesian ? "Aktifkan" : "Enable"}
              </button>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-medium shrink-0 bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-tertiary)]">
                {isIndonesian ? "Tidak Didukung" : "Unsupported"}
              </span>
            )}
          </div>
        </div>

        {/* Guidance Note */}
        <div className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {isIndonesian ? (
            <>
              Jika akses sebelumnya ditolak pada dialog sistem, iOS mengharuskan izin diaktifkan
              kembali melalui{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                Pengaturan iPhone &gt; Accrual
              </span>
              .
            </>
          ) : (
            <>
              If access was previously denied in system prompts, iOS requires permissions to be
              re-enabled under{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                iPhone Settings &gt; Accrual
              </span>
              .
            </>
          )}
        </div>

        {/* Open iPhone Settings Button */}
        <button
          type="button"
          onClick={handleOpenSystemSettings}
          className="w-full py-2.5 rounded-xl font-semibold text-[12.5px] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 border border-[var(--glass-border)] bg-[var(--bg-elevated)] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
          style={{
            color: "var(--text-primary)",
          }}
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} />
          <span>{isIndonesian ? "Buka Pengaturan iPhone" : "Open iPhone Settings"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onClose();
          }}
          className="w-full py-2.5 rounded-xl font-semibold text-[13px] active:scale-98 transition-all cursor-pointer text-center border border-[var(--glass-border)] bg-[var(--glass-fill)] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
          style={{
            color: "var(--text-primary)",
          }}
        >
          {isIndonesian ? "Selesai" : "Done"}
        </button>
      </div>
    </BottomSheet>
  );
}
