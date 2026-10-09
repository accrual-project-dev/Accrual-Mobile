// ======================================================================
// TROUVAILLE JOIN SHARED LEDGER MODAL & CONTENT
// Ultra-luxury Apple Monochrome Glassmorphism
// Dual Mode: 6-Character Alphanumeric Code Input & Live In-App Camera QR Scanner (jsQR)
// Strictly compliant with GEMINI.md: Vector Lucide icons only, zero native emojis,
// single unified scroll container, and 100% pure localization.
// ======================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  KeyRound,
  QrCode,
  Camera,
  Upload,
  Check,
  Loader2,
  AlertCircle,
  Users,
  ShieldCheck,
  User,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useSpace } from "../../contexts/SpaceContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useToast } from "../../contexts/ToastContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { normalizeInviteCode } from "../../lib/sharedLedgerService";

export interface JoinLedgerContentProps {
  initialCode?: string;
  onSuccess?: (ledgerName?: string) => void;
  onCancel?: () => void;
  onOpenLogin?: () => void;
  hideHeaderCapsule?: boolean;
}

export function JoinLedgerContent({
  initialCode = "",
  onSuccess,
  onCancel,
  onOpenLogin,
  hideHeaderCapsule = false,
}: JoinLedgerContentProps) {
  const { user, isGuest } = useAuth();
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();
  const { joinSharedSpace } = useSpace();

  const [activeTab, setActiveTab] = useState<"code" | "qr">("code");
  const [inviteCodeInput, setInviteCodeInput] = useState(initialCode);
  const [displayNameInput, setDisplayNameInput] = useState(() => {
    if (!user) return "";
    return (
      (user.user_metadata?.full_name as string) ||
      user.email?.split("@")[0] ||
      ""
    );
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live Camera stream refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Stop camera feed and scan loop
  const stopCameraStream = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (initialCode) {
        setInviteCodeInput(initialCode);
      }
      setErrorMessage(null);
      setCameraError(null);
    });
    return () => {
      active = false;
      stopCameraStream();
    };
  }, [initialCode, stopCameraStream]);

  // Parse raw text extracted from QR — auto-joins immediately on detection
  const processQrText = useCallback(
    async (raw: string) => {
      let codeToJoin = raw.trim();

      // Check if it's a URL (accrual://join?code=..., trouvaille://join?code=... or https://...)
      try {
        if (codeToJoin.includes("code=")) {
          const urlObj = new URL(codeToJoin.replace(/^(?:accrual|trouvaille):\/\//i, "https://accrual.internal/"));
          const extracted = urlObj.searchParams.get("code");
          if (extracted) {
            codeToJoin = extracted;
          }
        }
      } catch {}

      const clean = normalizeInviteCode(codeToJoin);
      if (clean) {
        triggerSuccessHaptic();
        stopCameraStream();
        // Auto-join immediately without requiring manual submit
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
          const result = await joinSharedSpace(
            clean,
            displayNameInput.trim() || undefined,
            "qr",
          );
          if (result.success) {
            showToast(
              isIndonesian
                ? `Berhasil bergabung otomatis ke '${result.ledger_name || "Space Bersama"}'!`
                : `Auto-joined '${result.ledger_name || "Shared Space"}' via QR!`,
              "add",
            );
            if (onSuccess) {
              onSuccess(result.ledger_name);
            }
          } else {
            setErrorMessage(result.message);
            setInviteCodeInput(clean);
            setActiveTab("code");
          }
        } catch (err: any) {
          setErrorMessage(err.message || (isIndonesian ? "Gagal memproses kode." : "Failed to process code."));
          setInviteCodeInput(clean);
          setActiveTab("code");
        } finally {
          setIsSubmitting(false);
        }
      } else {
        setCameraError(
          isIndonesian
            ? "Format kode QR tidak dikenali sebagai space Accrual."
            : "QR code format is not recognized as an Accrual space.",
        );
      }
    },
    [isIndonesian, showToast, stopCameraStream, joinSharedSpace, displayNameInput, onSuccess],
  );

  // Start video stream
  const startCameraStream = useCallback(async () => {
    setCameraError(null);
    stopCameraStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setIsCameraActive(true);

        // Canvas for scanning frames
        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas");
        }

        const { default: jsQR } = await import("jsqr");

        // Loop jsQR at 8 fps (125ms interval) for smooth battery-friendly scanning
        scanIntervalRef.current = window.setInterval(() => {
          if (!videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            processQrText(code.data);
          }
        }, 125);
      }
    } catch (err: any) {
      console.warn("[JoinLedgerModal] Camera start error:", err);
      setIsCameraActive(false);
      setCameraError(
        isIndonesian
          ? "Izin kamera tidak diberikan atau perangkat tidak mendukung."
          : "Camera permission denied or not supported.",
      );
    }
  }, [isIndonesian, processQrText, stopCameraStream]);

  // Handle tab switch
  const handleTabChange = (tab: "code" | "qr") => {
    triggerHaptic("light");
    setActiveTab(tab);
    setErrorMessage(null);
    if (tab === "qr") {
      startCameraStream();
    } else {
      stopCameraStream();
    }
  };

  // Image upload QR detection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { default: jsQR } = await import("jsqr");
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          processQrText(code.data);
        } else {
          setCameraError(
            isIndonesian
              ? "Tidak ditemukan kode QR pada gambar yang diunggah."
              : "No QR code found in uploaded image.",
          );
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit Join Code
  const handleSubmitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeInviteCode(inviteCodeInput);
    if (!clean) {
      setErrorMessage(
        isIndonesian ? "Silakan masukkan kode undangan." : "Please enter an invite code.",
      );
      return;
    }

    triggerHaptic("medium");
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await joinSharedSpace(
        clean,
        displayNameInput.trim() || undefined,
        "code",
      );
      if (result.success) {
        triggerSuccessHaptic();
        showToast(
          result.status === "pending"
            ? isIndonesian
              ? `Permintaan bergabung ke '${result.ledger_name || "Space Bersama"}' terkirim! Menunggu persetujuan pemilik.`
              : `Join request sent to '${result.ledger_name || "Shared Space"}'! Waiting for owner approval.`
            : isIndonesian
              ? `Berhasil bergabung ke '${result.ledger_name || "Space Bersama"}'!`
              : `Joined '${result.ledger_name || "Shared Space"}' successfully!`,
          "add",
        );
        if (onSuccess) {
          onSuccess(result.ledger_name);
        }
      } else {
        setErrorMessage(result.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isIndonesian ? "Gagal memproses kode." : "Failed to process code."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 select-none">
      {/* Header Capsule */}
      {!hideHeaderCapsule && (
        <div className="text-center pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
            <Users size={12} strokeWidth={2} />
            <span>{isIndonesian ? "Kolaborasi Keuangan" : "Financial Collaboration"}</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            {isIndonesian ? "Gabung Space Bersama" : "Join Shared Space"}
          </h2>
          <p className="text-[12px] text-[var(--text-tertiary)] mt-1 max-w-xs mx-auto leading-relaxed">
            {isIndonesian
              ? "Masukkan kode 6-karakter (perlu persetujuan pemilik) atau pindai QR untuk bergabung otomatis."
              : "Enter a 6-character code (requires owner approval) or scan QR to join automatically."}
          </p>
        </div>
      )}

      {/* Guest Guard: Prompt to sign in if local guest */}
      {isGuest || user?.id === "guest_local_user" ? (
        <div
          className="rounded-3xl p-5 border text-center space-y-4"
          style={{
            background: "var(--glass-fill)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--glass-border)] mx-auto flex items-center justify-center text-[var(--text-primary)]">
            <ShieldCheck size={22} strokeWidth={1.75} />
          </div>
          <div className="space-y-1">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {isIndonesian ? "Akun Cloud Diperlukan" : "Cloud Account Required"}
            </h3>
            <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
              {isIndonesian
                ? "Space Bersama disinkronkan secara aman antar-perangkat via cloud. Silakan masuk atau buat akun Accrual untuk melanjutkan."
                : "Shared spaces are securely synchronized across devices via cloud. Please sign in or create an Accrual account to proceed."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onCancel) onCancel();
              if (onOpenLogin) onOpenLogin();
            }}
            className="w-full py-3 px-4 rounded-2xl text-[13px] font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] active:scale-95 transition-all shadow-md cursor-pointer"
          >
            {isIndonesian ? "Masuk atau Daftar Akun" : "Sign In or Register"}
          </button>
        </div>
      ) : (
        <>
          {/* Apple Luxury Segmented Tab Control */}
          <div
            className="flex items-center p-1 rounded-full border"
            style={{
              background: "var(--glass-fill)",
              borderColor: "var(--glass-border)",
            }}
          >
            <button
              type="button"
              onClick={() => handleTabChange("code")}
              className={`flex-1 py-2 px-3 rounded-full text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "code"
                  ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] shadow-md"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <KeyRound size={13} strokeWidth={2} />
              <span>{isIndonesian ? "Ketik Kode" : "Enter Code"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("qr")}
              className={`flex-1 py-2 px-3 rounded-full text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "qr"
                  ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] shadow-md"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <QrCode size={13} strokeWidth={2} />
              <span>{isIndonesian ? "Pindai QR" : "Scan QR"}</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[12px] flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-[var(--text-secondary)]" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Tab 1: Alphanumeric Code Input Form */}
          {activeTab === "code" && (
            <form onSubmit={handleSubmitJoin} className="space-y-4">
              {/* Code Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                  {isIndonesian ? "KODE UNDANGAN" : "INVITE CODE"}
                </label>
                <input
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="TRV-8X2"
                  maxLength={10}
                  className="w-full text-center text-[22px] font-semibold tracking-widest py-3.5 px-4 rounded-2xl border bg-[var(--bg-elevated)] border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--text-primary)] transition-all uppercase"
                />
                <p className="text-[11px] text-[var(--text-tertiary)] px-1 text-center">
                  {isIndonesian
                    ? "Format kode terdiri dari 6 karakter (contoh: TRV-9X2)"
                    : "Standard code contains 6 characters (e.g. TRV-9X2)"}
                </p>
              </div>

              {/* Display Name Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                  {isIndonesian ? "NAMA ANDA DI SPACE INI" : "YOUR DISPLAY NAME"}
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none">
                    <User size={15} strokeWidth={1.75} />
                  </div>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder={isIndonesian ? "Nama panggilan Anda" : "Your nickname"}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border bg-[var(--bg-elevated)] border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-[13px] font-medium focus:outline-none focus:border-[var(--text-primary)] transition-all"
                  />
                </div>
              </div>

              {/* Submit Action */}
              <button
                type="submit"
                disabled={isSubmitting || !inviteCodeInput.trim()}
                className="w-full py-3.5 px-4 rounded-2xl text-[13px] font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] disabled:opacity-40 active:scale-95 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>{isIndonesian ? "Menghubungkan..." : "Connecting..."}</span>
                  </>
                ) : (
                  <>
                    <Check size={15} strokeWidth={2.5} />
                    <span>{isIndonesian ? "Gabung Space" : "Join Shared Space"}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: Live In-App Camera QR Scanner */}
          {activeTab === "qr" && (
            <div className="space-y-4">
              <div
                className="relative w-full aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden border bg-black shadow-2xl flex items-center justify-center"
                style={{ borderColor: "var(--glass-border)" }}
              >
                {/* Video Stream */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />

                {/* Viewfinder Target Overlays (Apple Luxury Corners) */}
                <div className="absolute inset-8 pointer-events-none">
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white rounded-br-xl" />
                </div>

                {/* Camera Offline / Error State */}
                {(!isCameraActive || cameraError) && (
                  <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 text-center space-y-2">
                    <Camera size={28} className="text-white/40" />
                    <p className="text-[12px] text-white/70">
                      {cameraError || (isIndonesian ? "Menyiapkan kamera..." : "Preparing camera...")}
                    </p>
                    <button
                      type="button"
                      onClick={startCameraStream}
                      className="py-1.5 px-3 rounded-full text-[11px] font-semibold bg-white/20 text-white border border-white/20 active:scale-95 transition-all cursor-pointer"
                    >
                      {isIndonesian ? "Coba Lagi" : "Retry"}
                    </button>
                  </div>
                )}
              </div>

              {/* Upload Image Fallback */}
              <div className="text-center pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 py-2 px-4 rounded-full text-[12px] font-semibold border border-[var(--glass-border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer active:scale-95"
                >
                  <Upload size={13} strokeWidth={1.75} />
                  <span>{isIndonesian ? "Pilih Foto QR dari Galeri" : "Pick QR Image from Gallery"}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface JoinLedgerModalProps {
  isOpen: boolean;
  initialCode?: string;
  onClose: () => void;
  onOpenLogin?: () => void;
}

export function JoinLedgerModal({
  isOpen,
  initialCode = "",
  onClose,
  onOpenLogin,
}: JoinLedgerModalProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="px-5 sm:px-6 pb-[calc(env(safe-area-inset-bottom,16px)+24px)] select-none">
        <JoinLedgerContent
          initialCode={initialCode}
          onSuccess={() => onClose()}
          onCancel={onClose}
          onOpenLogin={onOpenLogin}
        />
      </div>
    </BottomSheet>
  );
}
