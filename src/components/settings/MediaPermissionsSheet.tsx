import { useState, useEffect } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { Camera, Image as ImageIcon, ShieldCheck, Check } from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  checkMediaPermissions,
  requestPhotosPermission,
  requestCameraPermission,
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
  const [permissions, setPermissions] = useState<MediaPermissionsState>({
    camera: "prompt",
    photos: "prompt",
  });
  const [loading, setLoading] = useState(false);

  const refreshPermissions = async () => {
    try {
      const state = await checkMediaPermissions();
      setPermissions(state);
    } catch (err) {
      console.warn("Failed to check media permissions:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshPermissions();
    }
  }, [isOpen]);

  const handleRequestPhotos = async () => {
    triggerHaptic("medium");
    setLoading(true);
    try {
      const granted = await requestPhotosPermission();
      await refreshPermissions();
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
      await refreshPermissions();
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

  const isPhotosGranted = permissions.photos === "granted" || permissions.photos === "limited";
  const isCameraGranted = permissions.camera === "granted";

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        isIndonesian ? "Akses Kamera & Galeri" : "Camera & Gallery Access"
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
                ? "Privasi Perangkat Keras & Media"
                : "Hardware & Media Privacy"}
            </h4>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
              {isIndonesian
                ? "Accrual memproses semua foto struk secara lokal di perangkat tanpa telemetri cloud."
                : "Accrual processes all receipt images on-device with zero cloud telemetry."}
            </p>
          </div>
        </div>

        {/* Permissions Items List */}
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] divide-y divide-[var(--glass-border)] overflow-hidden">
          {/* Photo Library / Gallery */}
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

          {/* Camera Hardware */}
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
                    ? "Pemotretan struk instan"
                    : "Instant receipt photography"}
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
        </div>

        {/* Guidance Note */}
        <div className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {isIndonesian ? (
            <>
              Jika akses sebelumnya ditolak, iOS mengharuskan izin diaktifkan
              kembali melalui{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                Pengaturan &gt; Accrual &gt; Foto &amp; Kamera
              </span>
              .
            </>
          ) : (
            <>
              If access was previously denied, iOS requires permissions to be
              re-enabled under{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                Settings &gt; Accrual &gt; Photos &amp; Camera
              </span>
              .
            </>
          )}
        </div>

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
