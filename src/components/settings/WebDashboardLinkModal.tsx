// ======================================================================
// TROUVAILLE WEB DASHBOARD LINKING & QR SCANNER MODAL
// Ultra-luxury Apple Monochrome Glassmorphism
// Handshake with Trouvaille Web Workstation via Supabase Realtime
// Strictly compliant with GEMINI.md: Vector Lucide icons only & no native emojis
// ======================================================================

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Laptop,
  QrCode,
  Image as ImageIcon,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { BottomSheet } from "../ui/BottomSheet";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useToast } from "../../contexts/ToastContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { requestCameraPermission } from "../../lib/mediaPermissions";
import {
  parseWebDashboardQr,
  authorizeWebDashboardSession,
  getLinkedWebSessions,
  removeLinkedWebSession,
  clearAllLinkedWebSessions,
  type WebDashboardQrPayload,
  type LinkedWebSession,
} from "../../lib/webAuthSync";
import { format } from "date-fns";

interface WebDashboardLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebDashboardLinkModal({
  isOpen,
  onClose,
}: WebDashboardLinkModalProps) {
  const { session, isGuest } = useAuth();
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();

  // Mode: "overview" | "scanner" | "confirm" | "authorizing" | "success"
  const [viewMode, setViewMode] = useState<
    "overview" | "scanner" | "confirm" | "authorizing" | "success"
  >("overview");

  // Scanned QR payload waiting for user confirmation
  const [scannedPayload, setScannedPayload] =
    useState<WebDashboardQrPayload | null>(null);
  const [rawScannedQr, setRawScannedQr] = useState<string>("");
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);

  // Linked sessions history
  const [linkedSessions, setLinkedSessions] = useState<LinkedWebSession[]>([]);

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

  // Load linked sessions on modal open
  useEffect(() => {
    if (isOpen) {
      setLinkedSessions(getLinkedWebSessions());
      setViewMode("overview");
      setScannedPayload(null);
      setScanErrorMessage(null);
    } else {
      stopCameraStream();
    }
  }, [isOpen, stopCameraStream]);

  // Process a raw QR string
  const handleProcessQrData = useCallback(
    (qrString: string) => {
      const parsed = parseWebDashboardQr(qrString);
      if (parsed.valid && parsed.payload) {
        triggerSuccessHaptic();
        stopCameraStream();
        setRawScannedQr(qrString);
        setScannedPayload(parsed.payload);
        setScanErrorMessage(null);
        setViewMode("confirm");
      } else {
        triggerHaptic("medium");
        setScanErrorMessage(
          parsed.error ||
            (isIndonesian
              ? "QR Code bukan untuk Accrual Web Dashboard"
              : "QR Code is not valid for Accrual Web Dashboard")
        );
      }
    },
    [isIndonesian, stopCameraStream]
  );

  // Frame decoding loop via offscreen canvas
  const startQrDecodingLoop = useCallback(async () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { default: jsQR } = await import("jsqr");

    scanIntervalRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA || !ctx) return;

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width === 0 || height === 0) return;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);

      try {
        const imageData = ctx.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          handleProcessQrData(code.data);
        }
      } catch {}
    }, 160);
  }, [handleProcessQrData]);

  // Start live camera stream
  const startCameraStream = useCallback(async () => {
    setCameraError(null);
    setScanErrorMessage(null);

    // If native iOS/Android, request camera permission
    if (Capacitor.isNativePlatform()) {
      try {
        const granted = await requestCameraPermission();
        if (!granted) {
          setCameraError(
            isIndonesian
              ? "Izin kamera diperlukan untuk memindai QR Code."
              : "Camera permission is required to scan QR codes."
          );
          return;
        }
      } catch (err: any) {
        setCameraError(err?.message || "Permission error");
        return;
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        isIndonesian
          ? "Kamera tidak didukung di browser ini. Silakan pilih foto QR dari galeri."
          : "Camera not supported in this browser. Please upload a QR image from gallery."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      startQrDecodingLoop();
    } catch (err: any) {
      console.warn("[WebDashboardLinkModal] getUserMedia error:", err);
      setCameraError(
        isIndonesian
          ? "Tidak dapat mengakses kamera. Pastikan izin kamera aktif atau gunakan tombol unggah gambar."
          : "Unable to access camera. Please allow camera access or upload an image."
      );
      stopCameraStream();
    }
  }, [isIndonesian, startQrDecodingLoop, stopCameraStream]);

  // Handle opening scanner view
  const handleOpenScanner = () => {
    triggerHaptic("light");
    setViewMode("scanner");
    setTimeout(() => {
      startCameraStream();
    }, 100);
  };

  // Upload/Pick QR code image file
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic("light");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const { default: jsQR } = await import("jsqr");
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code && code.data) {
          handleProcessQrData(code.data);
        } else {
          triggerHaptic("medium");
          showToast(
            isIndonesian
              ? "Tidak ditemukan QR Code yang valid pada gambar tersebut"
              : "No valid QR code detected in the selected image",
            "delete",
            () => {}
          );
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input value so same file can be re-picked
    if (e.target) e.target.value = "";
  };

  // Authorize session button
  const handleAuthorizeSession = async () => {
    if (!rawScannedQr) return;

    triggerHaptic("medium");
    setViewMode("authorizing");

    const result = await authorizeWebDashboardSession(rawScannedQr, { session });

    if (result.success) {
      triggerSuccessHaptic();
      setLinkedSessions(getLinkedWebSessions());
      setViewMode("success");
      showToast(
        isIndonesian
          ? "Web Dashboard berhasil ditautkan!"
          : "Web Dashboard linked successfully!",
        "add",
        () => {}
      );
    } else {
      triggerHaptic("heavy");
      setViewMode("confirm");
      showToast(
        result.error ||
          (isIndonesian
            ? "Gagal mengotorisasi sesi Web Dashboard"
            : "Failed to authorize Web Dashboard session"),
        "delete",
        () => {}
      );
    }
  };

  const handleRemoveSession = (sessionId: string) => {
    triggerHaptic("light");
    removeLinkedWebSession(sessionId);
    setLinkedSessions(getLinkedWebSessions());
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        stopCameraStream();
        onClose();
      }}
      title={
        viewMode === "scanner"
          ? isIndonesian
            ? "Pindai QR Dashboard"
            : "Scan Dashboard QR"
          : viewMode === "confirm"
            ? isIndonesian
              ? "Konfirmasi Tautan"
              : "Confirm Link"
            : isIndonesian
              ? "Tautkan Web Dashboard"
              : "Link Web Dashboard"
      }
    >
      <div className="px-5 sm:px-6 space-y-4 pb-[calc(env(safe-area-inset-bottom,16px)+24px)] pt-1 select-none">
        {/* Hidden file input for gallery upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFilePicked}
        />

        {/* ============================================================ */}
        {/* 1. OVERVIEW VIEW */}
        {/* ============================================================ */}
        {viewMode === "overview" && (
          <div className="space-y-4 animate-fadeIn">
            {/* Hero Card */}
            <div
              className="p-4 rounded-2xl flex items-center gap-3.5 border relative overflow-hidden"
              style={{
                background: "var(--glass-fill)",
                borderColor: "var(--glass-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <Laptop size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3
                    className="text-[14px] font-semibold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Accrual Web Workstation
                  </h3>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)]">
                    PRO
                  </span>
                </div>
                <p
                  className="text-[11px] font-medium leading-relaxed mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian
                    ? "Buka workstation finansial Anda di Mac, PC, atau iPad dengan instan tanpa password."
                    : "Access your financial workstation on Mac, PC, or iPad seamlessly without passwords."}
                </p>
              </div>
            </div>

            {/* Scan Button CTA */}
            <button
              type="button"
              disabled={isGuest}
              onClick={handleOpenScanner}
              className="w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 font-semibold text-[13px] active:scale-[0.99] transition-transform cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-base)",
              }}
            >
              <QrCode size={16} strokeWidth={2} />
              <span>
                {isIndonesian ? "Pindai QR Code Web" : "Scan Web QR Code"}
              </span>
            </button>

            {/* Guest Warning if not logged in */}
            {isGuest && (
              <div
                className="p-3 rounded-xl border flex items-start gap-2.5 text-left"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "var(--glass-border)",
                }}
              >
                <AlertCircle
                  size={15}
                  className="shrink-0 mt-0.5 text-[var(--text-tertiary)]"
                />
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian
                    ? "Anda sedang menggunakan mode Tamu Lokal. Masuk dengan akun Supabase Anda di menu profil untuk mengaktifkan sinkronisasi Web Dashboard."
                    : "You are in Local Guest mode. Sign in with your Supabase account to sync with the Web Dashboard."}
                </p>
              </div>
            )}

            {/* How to use steps */}
            <div
              className="p-3.5 rounded-2xl border space-y-2.5"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider block"
                style={{ color: "var(--text-secondary)" }}
              >
                {isIndonesian ? "Cara Menautkan:" : "How to Connect:"}
              </span>
              <div className="space-y-2 text-[11.5px] leading-snug">
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    1
                  </span>
                  <p style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian
                      ? "Buka Accrual Web di browser laptop Anda dan pilih tab 'Scan with App'."
                      : "Open Accrual Web on your desktop browser and select 'Scan with App'."}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    2
                  </span>
                  <p style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian
                      ? "Ketuk tombol 'Pindai QR Code Web' di atas lalu arahkan kamera ke layar komputer."
                      : "Tap 'Scan Web QR Code' above and point your camera at the screen."}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    3
                  </span>
                  <p style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian
                      ? "Konfirmasi sesi dan browser desktop Anda akan otomatis masuk seketika."
                      : "Confirm the session and your desktop browser will sign in immediately."}
                  </p>
                </div>
              </div>
            </div>

            {/* Linked Sessions History */}
            {linkedSessions.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between px-1">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {isIndonesian ? "Riwayat Sesi Tertaut" : "Linked Sessions"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      clearAllLinkedWebSessions();
                      setLinkedSessions([]);
                    }}
                    className="text-[10px] font-medium hover:underline cursor-pointer"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Hapus Semua" : "Clear All"}
                  </button>
                </div>

                <div className="glass-surface rounded-2xl overflow-hidden border border-[var(--glass-border)] divide-y divide-[var(--glass-border)]">
                  {linkedSessions.map((s) => (
                    <div
                      key={s.sessionId}
                      className="p-3 flex items-center justify-between gap-3 text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--glass-border)",
                            color: "var(--text-primary)",
                          }}
                        >
                          <Laptop size={14} strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-[12px] font-semibold truncate leading-tight"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {s.origin || "Accrual Web Dashboard"}
                          </p>
                          <p
                            className="text-[10px]  truncate mt-0.5"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {format(
                              new Date(s.linkedAt),
                              "dd MMM yyyy · HH:mm"
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSession(s.sessionId)}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90 transition-all cursor-pointer shrink-0"
                        title={isIndonesian ? "Hapus sesi" : "Remove session"}
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. CAMERA SCANNER VIEW */}
        {/* ============================================================ */}
        {viewMode === "scanner" && (
          <div className="space-y-3.5 animate-fadeIn">
            {/* Viewfinder Container */}
            <div className="relative w-full aspect-square max-h-[340px] mx-auto rounded-3xl overflow-hidden bg-black flex items-center justify-center border border-white/10 shadow-2xl">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />

              {/* Active Camera Live Badge */}
              {isCameraActive && (
                <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5 text-[10px] text-white/90 z-10 pointer-events-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="font-medium tracking-wide">
                    {isIndonesian ? "Pindai Langsung" : "Live Scan"}
                  </span>
                </div>
              )}

              {/* Frosted Viewfinder Overlay with Apple Luxury Targeting Brackets */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Target Box */}
                <div className="relative w-52 h-52 rounded-2xl border-2 border-white/40 flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Glowing Corner Accents */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-white rounded-br-lg" />

                  {/* Laser line animation */}
                  <div className="absolute w-44 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_12px_rgba(255,255,255,0.8)] animate-pulse" />
                </div>
              </div>

              {/* Camera Error Display */}
              {cameraError && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <AlertCircle size={24} className="text-neutral-400" />
                  <p className="text-[12px] font-medium text-neutral-200 leading-relaxed">
                    {cameraError}
                  </p>
                </div>
              )}
            </div>

            {/* Error badge if scanning non-matching QR */}
            {scanErrorMessage && (
              <div
                className="p-2.5 rounded-xl border flex items-center gap-2 text-left animate-fadeIn"
                style={{
                  background: "var(--glass-fill)",
                  borderColor: "var(--glass-border)",
                }}
              >
                <AlertCircle
                  size={14}
                  className="text-[var(--text-primary)] shrink-0"
                />
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                  {scanErrorMessage}
                </p>
              </div>
            )}

            {/* Bottom Actions: Upload QR from gallery & Cancel */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-[12px] active:scale-95 transition-transform cursor-pointer border"
                style={{
                  background: "var(--glass-fill)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <ImageIcon size={14} strokeWidth={1.75} />
                <span>
                  {isIndonesian ? "Pilih Gambar QR" : "Upload QR Image"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  stopCameraStream();
                  setViewMode("overview");
                }}
                className="py-2.5 px-4 rounded-xl font-semibold text-[12px] active:scale-95 transition-transform cursor-pointer border"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                {isIndonesian ? "Kembali" : "Back"}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. CONFIRMATION HANDSHAKE VIEW */}
        {/* ============================================================ */}
        {viewMode === "confirm" && scannedPayload && (
          <div className="space-y-4 animate-fadeIn">
            {/* Device Identity Card */}
            <div
              className="p-4 rounded-2xl border space-y-3.5 text-center"
              style={{
                background: "var(--glass-fill)",
                borderColor: "var(--glass-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <Laptop size={22} strokeWidth={1.75} />
              </div>

              <div>
                <h3
                  className="text-[15px] font-bold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian
                    ? "Tautkan Perangkat Ini?"
                    : "Link This Device?"}
                </h3>
                <p
                  className="text-[12px] font-medium mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {scannedPayload.origin || "Accrual Web Dashboard"}
                </p>
              </div>

              {/* Details table */}
              <div
                className="p-3 rounded-xl border text-left space-y-2 text-[11px]"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--glass-border)",
                }}
              >
                <div className="flex justify-between items-center">
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian ? "Akun Mobile:" : "Account:"}
                  </span>
                  <span
                    className="font-semibold truncate max-w-[180px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {session?.user?.email ||
                      (isIndonesian ? "Pengguna masuk" : "Signed in user")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian ? "ID Sesi:" : "Session ID:"}
                  </span>
                  <span
                    className=""
                    style={{ color: "var(--text-secondary)" }}
                  >
                    •••• {scannedPayload.sessionId.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian ? "Waktu Deteksi:" : "Detected:"}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {isIndonesian ? "Baru saja" : "Just now"}
                  </span>
                </div>
              </div>

              {/* Security advice */}
              <div className="flex items-start gap-2 text-left pt-0.5">
                <ShieldCheck
                  size={14}
                  className="shrink-0 mt-0.5 text-[var(--text-secondary)]"
                />
                <p
                  className="text-[10.5px] leading-relaxed"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian
                    ? "Hanya konfirmasi jika QR Code ini ditampilkan pada layar komputer milik Anda sendiri. Jangan pernah memindai QR milik orang lain."
                    : "Only confirm if this QR code is displayed on your own trusted computer screen. Never scan someone else's QR code."}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setViewMode("overview");
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-[12.5px] active:scale-95 transition-transform cursor-pointer border"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                {isIndonesian ? "Batalkan" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleAuthorizeSession}
                className="flex-1 py-3 rounded-xl font-semibold text-[12.5px] active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-1.5"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-base)",
                }}
              >
                <CheckCircle2 size={15} strokeWidth={2} />
                <span>
                  {isIndonesian ? "Otorisasi & Masuk" : "Authorize Session"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 4. AUTHORIZING STATE */}
        {/* ============================================================ */}
        {viewMode === "authorizing" && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 animate-fadeIn">
            <Loader2
              size={32}
              className="animate-spin text-[var(--text-primary)]"
            />
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian
                ? "Menghubungkan ke Web Dashboard..."
                : "Synchronizing with Web Dashboard..."}
            </p>
            <p
              className="text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Memancarkan token sesi terenkripsi via Supabase Realtime"
                : "Broadcasting encrypted session token via Supabase Realtime"}
            </p>
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. SUCCESS STATE */}
        {/* ============================================================ */}
        {viewMode === "success" && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 animate-fadeIn">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-base)",
              }}
            >
              <CheckCircle2 size={26} strokeWidth={2} />
            </div>

            <div>
              <h3
                className="text-[16px] font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? "Web Dashboard Terhubung!"
                  : "Web Dashboard Connected!"}
              </h3>
              <p
                className="text-[12px] mt-1 max-w-[260px] mx-auto leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Browser desktop Anda telah berhasil masuk dan sekarang siap digunakan."
                  : "Your desktop browser has been signed in and is now ready to use."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onClose();
              }}
              className="w-full mt-3 py-3 rounded-xl font-semibold text-[13px] active:scale-95 transition-transform cursor-pointer"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-base)",
              }}
            >
              {isIndonesian ? "Selesai" : "Done"}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
