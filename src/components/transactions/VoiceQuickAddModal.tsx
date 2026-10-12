import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  ScanLine,
  X,
  Check,
  SlidersHorizontal,
  Tag,
  CreditCard,
  Calendar,
  Layers,
  Pen,
  AlertCircle,
} from "lucide-react";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import {
  useAddTransaction,
  useBatchAddTransactions,
  useAllTransactions,
} from "../../hooks/useTransactions";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { formatRupiah } from "../../lib/utils";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import {
  parseNaturalTransaction,
  parseMultiNaturalTransactions,
  type ParsedTransactionResult,
} from "../../lib/nlpParser";
import { format } from "date-fns";
import type { TransactionType } from "../../lib/types";

export interface VoiceQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScan?: () => void;
  onOpenForm: (initialValues: {
    type: TransactionType;
    amount: number;
    categoryId: string | null;
    walletId: string | null;
    toWalletId: string | null;
    date: Date;
    note: string;
  }) => void;
}

// Cardinal spline helper for ultra-smooth wave curvature
function pointsToSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Multi-harmonic flowing gradient line wave visualizer
function GradientLineWave({
  isListening,
  isDark,
}: {
  isListening: boolean;
  isDark: boolean;
}) {
  const pathRef1 = useRef<SVGPathElement>(null);
  const pathRef2 = useRef<SVGPathElement>(null);
  const pathRef3 = useRef<SVGPathElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);

  const phaseRef = useRef({ p1: 0, p2: 1.4, p3: 2.8 });
  const ampRef = useRef({ a1: 4, a2: 2.5, a3: 1.5 });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const W = 400;
    const H = 90;
    const centerY = H / 2;
    const stepCount = 50;

    const render = () => {
      // Smooth amplitude target interpolation
      const targetA1 = isListening ? 26 : 4;
      const targetA2 = isListening ? 18 : 2.5;
      const targetA3 = isListening ? 12 : 1.5;

      ampRef.current.a1 += (targetA1 - ampRef.current.a1) * 0.08;
      ampRef.current.a2 += (targetA2 - ampRef.current.a2) * 0.08;
      ampRef.current.a3 += (targetA3 - ampRef.current.a3) * 0.08;

      // Phase step
      const speed = isListening ? 1 : 0.35;
      phaseRef.current.p1 += 0.065 * speed;
      phaseRef.current.p2 -= 0.048 * speed;
      phaseRef.current.p3 += 0.082 * speed;

      const pts1: Array<{ x: number; y: number }> = [];
      const pts2: Array<{ x: number; y: number }> = [];
      const pts3: Array<{ x: number; y: number }> = [];

      for (let i = 0; i <= stepCount; i++) {
        const x = (i / stepCount) * W;
        // Bell-shaped envelope: zero at boundaries, 1 in center
        const norm = i / stepCount;
        const envelope = Math.sin(Math.PI * norm);

        const y1 =
          centerY +
          Math.sin(norm * Math.PI * 3 + phaseRef.current.p1) *
            ampRef.current.a1 *
            envelope;
        const y2 =
          centerY +
          Math.sin(norm * Math.PI * 4 + phaseRef.current.p2) *
            ampRef.current.a2 *
            envelope;
        const y3 =
          centerY +
          Math.sin(norm * Math.PI * 5 + phaseRef.current.p3) *
            ampRef.current.a3 *
            envelope;

        pts1.push({ x, y: y1 });
        pts2.push({ x, y: y2 });
        pts3.push({ x, y: y3 });
      }

      const d1 = pointsToSmoothPath(pts1);
      const d2 = pointsToSmoothPath(pts2);
      const d3 = pointsToSmoothPath(pts3);

      if (pathRef1.current) pathRef1.current.setAttribute("d", d1);
      if (glowPathRef.current) glowPathRef.current.setAttribute("d", d1);
      if (pathRef2.current) pathRef2.current.setAttribute("d", d2);
      if (pathRef3.current) pathRef3.current.setAttribute("d", d3);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isListening]);

  return (
    <div className="w-full max-w-[420px] h-[90px] flex items-center justify-center relative overflow-hidden select-none pointer-events-none mx-auto">
      <svg
        viewBox="0 0 400 90"
        className="w-full h-full overflow-visible"
        fill="none"
      >
        <defs>
          {/* Main high-contrast wave gradient */}
          <linearGradient id="waveGradPrimary" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop
              offset="0%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0"
            />
            <stop
              offset="22%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0.3"
            />
            <stop
              offset="50%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0.95"
            />
            <stop
              offset="78%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0.3"
            />
            <stop
              offset="100%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0"
            />
          </linearGradient>

          {/* Secondary wave gradient */}
          <linearGradient
            id="waveGradSecondary"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0"
            />
            <stop
              offset="30%"
              stopColor={isDark ? "#c0c0d0" : "#454550"}
              stopOpacity="0.3"
            />
            <stop
              offset="50%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0.65"
            />
            <stop
              offset="70%"
              stopColor={isDark ? "#c0c0d0" : "#454550"}
              stopOpacity="0.3"
            />
            <stop
              offset="100%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0"
            />
          </linearGradient>

          {/* Tertiary hairline wave gradient */}
          <linearGradient id="waveGradTertiary" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop
              offset="0%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0"
            />
            <stop
              offset="50%"
              stopColor={isDark ? "#888899" : "#606070"}
              stopOpacity="0.4"
            />
            <stop
              offset="100%"
              stopColor={isDark ? "#ffffff" : "#121214"}
              stopOpacity="0"
            />
          </linearGradient>

          {/* Glow filter */}
          <filter id="waveGlowFilter" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation={isListening ? "5" : "1.5"} />
          </filter>
        </defs>

        {/* Ambient Glow behind primary line */}
        <path
          ref={glowPathRef}
          stroke="url(#waveGradPrimary)"
          strokeWidth={isListening ? 7 : 2.5}
          strokeLinecap="round"
          filter="url(#waveGlowFilter)"
          opacity={isDark ? 0.6 : 0.25}
        />

        {/* Harmonic Line 3 (hairline) */}
        <path
          ref={pathRef3}
          stroke="url(#waveGradTertiary)"
          strokeWidth={1}
          strokeLinecap="round"
          opacity={0.65}
        />

        {/* Harmonic Line 2 (secondary) */}
        <path
          ref={pathRef2}
          stroke="url(#waveGradSecondary)"
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.8}
        />

        {/* Primary Line 1 (solid crisp center) */}
        <path
          ref={pathRef1}
          stroke="url(#waveGradPrimary)"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function VoiceQuickAddModal({
  isOpen,
  onClose,
  onOpenScan,
  onOpenForm,
}: VoiceQuickAddModalProps) {
  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();
  const isDark = theme !== "light";

  const { data: categories = [] } = useCategories();
  const { data: wallets = [] } = useWallets();
  const { data: allTxs = [] } = useAllTransactions();
  const addTx = useAddTransaction();
  const batchAddTx = useBatchAddTransactions();
  const { showToast } = useToast();

  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const recognitionRef = useRef<any>(null);
  const userExplicitlyStoppedRef = useRef(false);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Track virtual keyboard visibility via visualViewport
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || !window.visualViewport) {
      setKeyboardOffset(0);
      return;
    }

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      setKeyboardOffset(Math.max(0, Math.round(offset)));
    };

    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener(
        "resize",
        handleViewportChange,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        handleViewportChange,
      );
    };
  }, [isOpen]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startRecognition = useCallback(() => {
    stopRecognition();
    userExplicitlyStoppedRef.current = false;

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setSpeechSupported(false);
      showToast(
        isIndonesian
          ? "Pengenalan suara tidak didukung di browser ini. Anda dapat mengetik langsung."
          : "Speech recognition is not supported on this browser. You can type directly.",
        "info",
        null,
        2500,
      );
      return;
    }

    setSpeechSupported(true);

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = isIndonesian ? "id-ID" : "en-US";

      rec.onstart = () => {
        setIsListening(true);
        triggerHaptic("medium");
      };

      rec.onresult = (event: any) => {
        let current = "";
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript + " ";
        }
        const cleaned = current.trim();
        if (cleaned) {
          setTranscript(cleaned);
        }
      };

      rec.onerror = (e: any) => {
        console.warn("[VoiceQuickAdd] speech error:", e?.error || e);
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          userExplicitlyStoppedRef.current = true;
          showToast(
            isIndonesian
              ? "Izin mikrofon diperlukan. Harap izinkan akses di pengaturan perangkat."
              : "Microphone permission is required. Please allow access in browser or app settings.",
            "delete",
            null,
            3000,
          );
          setIsListening(false);
        } else if (e?.error === "no-speech") {
          // Keep listening; silence is normal during user pauses
        } else if (e?.error !== "aborted") {
          // Gracefully let onend recover if still open
        }
      };

      rec.onend = () => {
        if (isOpenRef.current && !userExplicitlyStoppedRef.current) {
          // Auto-restart if mobile browser closed speech due to silence pause
          try {
            rec.start();
            return;
          } catch {}
        }
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch (err) {
      console.warn("[VoiceQuickAdd] Failed to start speech recognition:", err);
      stopRecognition();
    }
  }, [stopRecognition, showToast, isIndonesian]);

  // Speech Recognition lifecycle
  useEffect(() => {
    if (!isOpen) {
      userExplicitlyStoppedRef.current = true;
      stopRecognition();
      setTranscript("");
      return;
    }

    userExplicitlyStoppedRef.current = false;
    // Automatically initiate listening with fresh instance when opened
    startRecognition();

    return () => {
      userExplicitlyStoppedRef.current = true;
      stopRecognition();
    };
  }, [isOpen, startRecognition, stopRecognition]);

  const toggleListening = () => {
    if (isListening) {
      userExplicitlyStoppedRef.current = true;
      stopRecognition();
      triggerHaptic("light");
    } else {
      userExplicitlyStoppedRef.current = false;
      startRecognition();
    }
  };

  // User requested: Cancel button that cancels/stops speech WITHOUT closing the modal/page
  const handleCancelVoice = () => {
    triggerHaptic("light");
    userExplicitlyStoppedRef.current = true;
    stopRecognition();
    setTranscript("");
  };

  const handleScanClick = () => {
    triggerHaptic("medium");
    stopRecognition();
    if (onOpenScan) onOpenScan();
  };

  // Real-time NLP parsing (multi-transaction intelligent detection)
  const parsedList: ParsedTransactionResult[] = useMemo(() => {
    return parseMultiNaturalTransactions(
      transcript,
      categories,
      wallets,
      new Date(),
    );
  }, [transcript, categories, wallets]);

  const isMulti = parsedList.length > 1;
  const parsed: ParsedTransactionResult =
    parsedList[0] ||
    parseNaturalTransaction("", categories, wallets, new Date());

  const totalBatchAmount = useMemo(() => {
    return parsedList.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [parsedList]);

  const hasAmount = parsed.amount !== null && parsed.amount > 0;
  const hasMatches =
    parsedList.some(
      (p) =>
        (p.amount !== null && p.amount > 0) ||
        p.categoryId !== null ||
        p.walletId !== null,
    );

  const resolvedType = parsed.type || "expense";
  const resolvedCategory =
    categories.find((c) => c.id === parsed.categoryId) ||
    (categories.filter((c) => c.type === resolvedType).length > 0
      ? categories.filter((c) => c.type === resolvedType)[0]
      : categories[0] || null);
  const resolvedWallet =
    wallets.find((w) => w.id === parsed.walletId) ||
    (wallets.length > 0 ? wallets[0] : null);
  const resolvedToWallet =
    resolvedType === "transfer"
      ? wallets.find((w) => w.id === parsed.toWalletId) ||
        wallets.find((w) => w.id !== resolvedWallet?.id) ||
        null
      : null;

  const isDuplicateDetected = useMemo(() => {
    if (!parsed.amount || parsed.amount <= 0 || allTxs.length === 0) return false;
    const now = Date.now();
    return allTxs.some((tx) => {
      if (tx.amount !== parsed.amount) return false;
      if (parsed.categoryId && tx.category_id !== parsed.categoryId) return false;
      const txTime = new Date(tx.created_at || tx.occurred_on).getTime();
      const diffMinutes = Math.abs(now - txTime) / (1000 * 60);
      return diffMinutes <= 15;
    });
  }, [allTxs, parsed]);

  const handleDirectSave = () => {
    if (!hasAmount || !parsed.amount || isSubmitting) return;

    setIsSubmitting(true);
    userExplicitlyStoppedRef.current = true;
    stopRecognition();
    triggerSuccessHaptic();

    const txDate = parsed.date || new Date();
    const payload = {
      type: resolvedType,
      amount: parsed.amount,
      note: parsed.note || (transcript.trim() ? transcript.trim() : null),
      occurred_on: format(txDate, "yyyy-MM-dd"),
      created_at: txDate.toISOString(),
      category_id:
        resolvedType === "transfer" ? null : resolvedCategory?.id || null,
      wallet_id: resolvedWallet?.id || null,
      to_wallet_id:
        resolvedType === "transfer" ? resolvedToWallet?.id || null : null,
    };

    showToast(
      isIndonesian
        ? "Transaksi berhasil dicatat via suara"
        : "Transaction recorded via voice",
      "add",
      () => {},
    );
    onClose();

    addTx.mutate(payload, {
      onError: (err: any) => {
        showToast(
          err?.message ||
            (isIndonesian
              ? "Gagal menyimpan transaksi"
              : "Failed to save transaction"),
          "delete",
          () => {},
        );
      },
    });
  };

  const handleBatchSave = () => {
    if (parsedList.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    userExplicitlyStoppedRef.current = true;
    stopRecognition();
    triggerSuccessHaptic();

    const payloads = parsedList.map((item) => {
      const itemType = item.type || "expense";
      const itemCat =
        categories.find((c) => c.id === item.categoryId) ||
        (categories.filter((c) => c.type === itemType).length > 0
          ? categories.filter((c) => c.type === itemType)[0]
          : categories[0] || null);
      const itemWallet =
        wallets.find((w) => w.id === item.walletId) ||
        (wallets.length > 0 ? wallets[0] : null);
      const itemToWallet =
        itemType === "transfer"
          ? wallets.find((w) => w.id === item.toWalletId) ||
            wallets.find((w) => w.id !== itemWallet?.id) ||
            null
          : null;
      const txDate = item.date || new Date();

      return {
        type: itemType,
        amount: item.amount || 0,
        note:
          item.note ||
          item.categoryName ||
          (transcript.trim() ? transcript.trim() : null),
        occurred_on: format(txDate, "yyyy-MM-dd"),
        created_at: txDate.toISOString(),
        category_id: itemType === "transfer" ? null : itemCat?.id || null,
        wallet_id: itemWallet?.id || null,
        to_wallet_id: itemType === "transfer" ? itemToWallet?.id || null : null,
      };
    });

    showToast(
      isIndonesian
        ? `${payloads.length} transaksi berhasil dicatat via suara`
        : `${payloads.length} transactions recorded via voice`,
      "add",
      () => {},
    );
    onClose();

    batchAddTx.mutate(payloads, {
      onError: (err: any) => {
        showToast(
          err?.message ||
            (isIndonesian
              ? "Gagal menyimpan transaksi"
              : "Failed to save transactions"),
          "delete",
          () => {},
        );
      },
    });
  };

  const handleOpenForm = (index = 0) => {
    const targetItem = parsedList[index] || parsed;
    triggerHaptic("medium");

    const itemType = targetItem.type || "expense";
    const itemCat =
      categories.find((c) => c.id === targetItem.categoryId) ||
      (categories.filter((c) => c.type === itemType).length > 0
        ? categories.filter((c) => c.type === itemType)[0]
        : categories[0] || null);
    const itemWallet =
      wallets.find((w) => w.id === targetItem.walletId) ||
      (wallets.length > 0 ? wallets[0] : null);
    const itemToWallet =
      itemType === "transfer"
        ? wallets.find((w) => w.id === targetItem.toWalletId) ||
          wallets.find((w) => w.id !== itemWallet?.id) ||
          null
        : null;

    onOpenForm({
      type: itemType,
      amount: targetItem.amount || 0,
      categoryId: itemCat?.id || null,
      walletId: itemWallet?.id || null,
      toWalletId: itemToWallet?.id || null,
      date: targetItem.date || new Date(),
      note: targetItem.note || transcript.trim(),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* ══════════════════════════════════════════════════════════════════════
          BORDERLESS LUXURY AMBIENT OVERLAY (NO CARD CONTAINER)
          ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        key="voice-ambient-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="fixed inset-0 z-[60] flex flex-col justify-between select-none overflow-hidden"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at top, rgba(22, 22, 28, 0.96), rgba(9, 9, 12, 0.98))"
            : "radial-gradient(ellipse at top, rgba(255, 255, 255, 0.96), rgba(244, 244, 248, 0.98))",
          backdropFilter: "blur(40px) saturate(190%)",
          WebkitBackdropFilter: "blur(40px) saturate(190%)",
          paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 16px), 24px)",
          paddingBottom:
            keyboardOffset > 0
              ? `${keyboardOffset + 14}px`
              : "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
          transition: "padding-bottom 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Top Header: Status Indicator & Minimal Close Button */}
        <div className="w-full max-w-lg mx-auto px-6 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isListening
                  ? "bg-[var(--accent)] animate-pulse"
                  : "bg-[var(--text-tertiary)]"
              }`}
            />
            <span
              className="text-[12px] font-semibold tracking-wider uppercase"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isListening ? "Listening..." : "Voice Quick Add"}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.05)",
              color: "var(--text-secondary)",
              border: isDark
                ? "1px solid rgba(255, 255, 255, 0.12)"
                : "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            <X size={17} strokeWidth={1.8} />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            CENTER CONTENT: WAVE VISUALIZER + SPOKEN TRANSCRIPT + DETECTED TRANSACTIONS
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="w-full max-w-lg mx-auto px-6 flex-1 flex flex-col items-center justify-center gap-5 my-auto overflow-y-auto no-scrollbar">
          {/* 1. Center-Top Modern Gradient Line Wave */}
          <div className="w-full flex flex-col items-center justify-center">
            <GradientLineWave isListening={isListening} isDark={isDark} />
          </div>

          {/* 2. Interactive Live Spoken Transcript */}
          <div className="w-full flex flex-col items-center text-center px-2">
            {transcript ? (
              <div className="w-full max-w-md">
                <textarea
                  rows={2}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-[20px] sm:text-[23px] font-medium text-center tracking-tight leading-snug resize-none"
                  style={{ color: "var(--text-primary)" }}
                  placeholder="Type or speak your transaction..."
                />
                {/* Live Recognized Token Badges */}
                {hasMatches && (
                  <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
                    {parsedList.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1 animate-fadeIn">
                        {item.amountFormatted && (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                            style={{
                              background: "var(--accent)",
                              color: "var(--accent-ink)",
                            }}
                          >
                            {item.amountFormatted}
                          </span>
                        )}
                        {item.categoryName && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                            style={{
                              background: isDark
                                ? "rgba(255, 255, 255, 0.08)"
                                : "rgba(0, 0, 0, 0.05)",
                              color: "var(--text-secondary)",
                              border: isDark
                                ? "1px solid rgba(255, 255, 255, 0.12)"
                                : "1px solid rgba(0, 0, 0, 0.06)",
                            }}
                          >
                            <Tag size={9.5} strokeWidth={1.5} />
                            {item.categoryName}
                          </span>
                        )}
                        {item.walletName && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                            style={{
                              background: isDark
                                ? "rgba(255, 255, 255, 0.08)"
                                : "rgba(0, 0, 0, 0.05)",
                              color: "var(--text-secondary)",
                              border: isDark
                                ? "1px solid rgba(255, 255, 255, 0.12)"
                                : "1px solid rgba(0, 0, 0, 0.06)",
                            }}
                          >
                            <CreditCard size={9.5} strokeWidth={1.5} />
                            {item.walletName}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p
                className="text-[15px] sm:text-[16px] text-center font-normal tracking-tight max-w-sm leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                {!speechSupported
                  ? "Speech is not supported in this browser. Tap to type directly."
                  : isListening
                    ? "Speak naturally, e.g. 'Coffee 25k BCA, then Fuel 50k Cash'..."
                    : "Tap the microphone below to start speaking..."}
              </p>
            )}
          </div>

          {/* 3. Real-Time Detected Transactions Preview */}
          <div className="w-full flex flex-col items-center justify-center min-h-[100px]">
            {hasMatches ? (
              isMulti ? (
                /* ── MULTI-TRANSACTION DECK ── */
                <div className="w-full flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5">
                      <Layers
                        size={13}
                        strokeWidth={1.75}
                        style={{ color: "var(--text-secondary)" }}
                      />
                      <span
                        className="text-[12px] font-bold tracking-tight"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {parsedList.length} Transactions Detected
                      </span>
                    </div>
                    <span
                      className="text-[13px] font-semibold amount"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Total {formatRupiah(totalBatchAmount)}
                    </span>
                  </div>

                  <div className="w-full max-h-[min(32vh,240px)] overflow-y-auto no-scrollbar space-y-2 pr-0.5">
                    {parsedList.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleOpenForm(idx)}
                        className="flex items-center justify-between px-4 py-3 rounded-2xl transition-all cursor-pointer active:scale-[0.98] group"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.05)"
                            : "rgba(0, 0, 0, 0.03)",
                          border: isDark
                            ? "1px solid rgba(255, 255, 255, 0.10)"
                            : "1px solid rgba(0, 0, 0, 0.06)",
                          boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span
                            className="w-5.5 h-5.5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                            style={{
                              background: isDark
                                ? "rgba(255, 255, 255, 0.10)"
                                : "rgba(0, 0, 0, 0.06)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-[13px] font-semibold truncate leading-tight"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {item.note ||
                                item.categoryName ||
                                `Item ${idx + 1}`}
                            </p>
                            <div
                              className="flex items-center gap-2.5 text-[11px] mt-0.5 truncate"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {item.categoryName && (
                                <span className="flex items-center gap-1 truncate">
                                  <Tag size={10} strokeWidth={1.5} />
                                  {item.categoryName}
                                </span>
                              )}
                              {item.walletName && (
                                <span className="flex items-center gap-1 truncate">
                                  <CreditCard size={10} strokeWidth={1.5} />
                                  {item.type === "transfer" && item.toWalletName
                                    ? `${item.walletName} → ${item.toWalletName}`
                                    : item.walletName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 pl-3 flex items-center gap-2">
                          <span
                            className="text-[14px] font-semibold amount"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {item.amount !== null
                              ? formatRupiah(item.amount)
                              : "Rp 0"}
                          </span>
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity"
                            style={{
                              background: isDark
                                ? "rgba(255, 255, 255, 0.08)"
                                : "rgba(0, 0, 0, 0.05)",
                              color: "var(--text-secondary)",
                            }}
                            title="Edit this transaction"
                          >
                            <Pen size={12} strokeWidth={1.8} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── SINGLE TRANSACTION HERO CARD ── */
                <div
                  onClick={() => handleOpenForm(0)}
                  className="w-full flex flex-col items-center gap-3 cursor-pointer active:scale-[0.98] transition-all p-2 rounded-2xl"
                  title="Click to edit transaction"
                >
                  {/* Hero Amount */}
                  <div className="text-center">
                    <span
                      className="text-[34px] sm:text-[40px] font-semibold amount tracking-tight leading-none"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {parsed.amount !== null && parsed.amount > 0
                        ? formatRupiah(parsed.amount)
                        : "Rp 0"}
                    </span>
                  </div>

                  {/* Metadata Badges: Category, Account, Date, Note */}
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {parsed.categoryName && (
                      <span
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)",
                          color: "var(--text-primary)",
                          border: isDark
                            ? "1px solid rgba(255, 255, 255, 0.12)"
                            : "1px solid rgba(0, 0, 0, 0.08)",
                        }}
                      >
                        <Tag
                          size={11.5}
                          strokeWidth={1.75}
                          style={{ color: "var(--text-secondary)" }}
                        />
                        {parsed.categoryName}
                      </span>
                    )}

                    {parsed.walletName && (
                      <span
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)",
                          color: "var(--text-primary)",
                          border: isDark
                            ? "1px solid rgba(255, 255, 255, 0.12)"
                            : "1px solid rgba(0, 0, 0, 0.08)",
                        }}
                      >
                        <CreditCard
                          size={11.5}
                          strokeWidth={1.75}
                          style={{ color: "var(--text-secondary)" }}
                        />
                        {parsed.type === "transfer" && parsed.toWalletName
                          ? `${parsed.walletName} → ${parsed.toWalletName}`
                          : parsed.walletName}
                      </span>
                    )}

                    {parsed.dateLabel &&
                      parsed.dateLabel !== "Today" &&
                      parsed.dateLabel !== "Hari ini" && (
                        <span
                          className="px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5"
                          style={{
                            background: isDark
                              ? "rgba(255, 255, 255, 0.05)"
                              : "rgba(0, 0, 0, 0.04)",
                            color: "var(--text-tertiary)",
                            border: isDark
                              ? "1px solid rgba(255, 255, 255, 0.08)"
                              : "1px solid rgba(0, 0, 0, 0.06)",
                          }}
                        >
                          <Calendar size={11.5} strokeWidth={1.75} />
                          {parsed.dateLabel === "Hari ini"
                            ? "Today"
                            : parsed.dateLabel === "Kemarin"
                              ? "Yesterday"
                              : parsed.dateLabel}
                        </span>
                      )}

                    {parsed.note && parsed.note !== parsed.categoryName && (
                      <span
                        className="px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 truncate max-w-[200px]"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.05)"
                            : "rgba(0, 0, 0, 0.04)",
                          color: "var(--text-tertiary)",
                          border: isDark
                            ? "1px solid rgba(255, 255, 255, 0.08)"
                            : "1px solid rgba(0, 0, 0, 0.06)",
                        }}
                      >
                        <Pen size={10.5} strokeWidth={1.5} />
                        <span className="truncate">{parsed.note}</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            ) : null}
          </div>

          {/* Duplicate Detection Warning */}
          {hasMatches && isDuplicateDetected && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-sm px-3.5 py-2 rounded-xl flex items-center gap-2 text-[12px] font-medium"
              style={{
                background: isDark
                  ? "rgba(239, 68, 68, 0.1)"
                  : "rgba(239, 68, 68, 0.08)",
                color: isDark ? "#fca5a5" : "#dc2626",
                border: isDark
                  ? "1px solid rgba(239, 68, 68, 0.2)"
                  : "1px solid rgba(239, 68, 68, 0.2)",
              }}
            >
              <AlertCircle size={14} className="shrink-0" strokeWidth={2} />
              <span>A similar transaction was recorded in the last 15 minutes</span>
            </motion.div>
          )}

          {/* 4. Action Buttons (Elevated directly above dock) */}
          {hasMatches && (
            <div className="w-full max-w-sm pt-1 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenForm(0)}
                className="h-12 px-5 rounded-full flex items-center justify-center gap-2 text-[13px] font-semibold active:scale-95 transition-all cursor-pointer shrink-0"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                  color: "var(--text-primary)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.14)"
                    : "1px solid rgba(0, 0, 0, 0.08)",
                }}
                title="Edit in form"
              >
                <Pen size={14} strokeWidth={1.8} />
                Edit
              </button>

              {isMulti ? (
                <button
                  type="button"
                  onClick={handleBatchSave}
                  disabled={isSubmitting}
                  className="flex-1 h-12 rounded-full flex items-center justify-center gap-2 text-[13px] font-bold active:scale-98 transition-all cursor-pointer disabled:opacity-50 shadow-lg"
                  style={{
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
                  }}
                >
                  <Check size={16} strokeWidth={2.5} />
                  {isSubmitting
                    ? "Saving All..."
                    : `Save All (${formatRupiah(totalBatchAmount)})`}
                </button>
              ) : hasAmount ? (
                <button
                  type="button"
                  onClick={handleDirectSave}
                  disabled={isSubmitting}
                  className="flex-1 h-12 rounded-full flex items-center justify-center gap-2 text-[13px] font-bold active:scale-98 transition-all cursor-pointer disabled:opacity-50 shadow-lg"
                  style={{
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
                  }}
                >
                  <Check size={16} strokeWidth={2.5} />
                  {isSubmitting
                    ? "Saving..."
                    : `Save (${formatRupiah(parsed.amount!)})`}
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            BOTTOM DOCK:
            - LEFT: SCAN BUTTON
            - CENTER: MICROPHONE (TAP TO SPEAK)
            - RIGHT: MANUAL FORM / CANCEL (DOES NOT CLOSE MODAL)
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="w-full max-w-lg mx-auto px-8 flex items-center justify-around z-10 shrink-0">
          {/* Left: Scan Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleScanClick}
              aria-label="Scan Receipt"
              className="w-13 h-13 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
                color: "var(--text-primary)",
                border: isDark
                  ? "1px solid rgba(255, 255, 255, 0.14)"
                  : "1px solid rgba(0, 0, 0, 0.07)",
                boxShadow: isDark
                  ? "0 4px 16px rgba(0,0,0,0.3)"
                  : "0 4px 16px rgba(0,0,0,0.06)",
              }}
              title="Scan Receipt"
            >
              <ScanLine size={21} strokeWidth={1.75} />
            </button>
            <span
              className="text-[11px] font-medium tracking-tight"
              style={{ color: "var(--text-tertiary)" }}
            >
              Scan
            </span>
          </div>

          {/* Center: Microphone Button (Tap to Speak) */}
          <div className="flex flex-col items-center gap-1.5 relative">
            {/* Pulsating ambient wave ring when listening */}
            {isListening && (
              <motion.div
                animate={{
                  scale: [1, 1.35, 1],
                  opacity: [0.55, 0, 0.55],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.6,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-full pointer-events-none -m-2"
                style={{
                  border: isDark
                    ? "2px solid rgba(255, 255, 255, 0.45)"
                    : "2px solid rgba(0, 0, 0, 0.25)",
                }}
              />
            )}

            <button
              type="button"
              onClick={toggleListening}
              aria-label={
                isListening ? "Stop listening" : "Start voice recognition"
              }
              className="w-17 h-17 rounded-full flex items-center justify-center active:scale-92 transition-all cursor-pointer relative shadow-2xl"
              style={{
                background: isListening
                  ? isDark
                    ? "rgba(255, 255, 255, 0.96)"
                    : "rgba(18, 18, 22, 0.96)"
                  : isDark
                    ? "rgba(255, 255, 255, 0.16)"
                    : "rgba(18, 18, 22, 0.92)",
                color: isListening
                  ? isDark
                    ? "#09090c"
                    : "#ffffff"
                  : "#ffffff",
                border: isDark
                  ? "1px solid rgba(255, 255, 255, 0.28)"
                  : "1px solid rgba(0, 0, 0, 0.12)",
                boxShadow: isListening
                  ? isDark
                    ? "0 0 32px rgba(255, 255, 255, 0.35)"
                    : "0 0 32px rgba(0, 0, 0, 0.2)"
                  : isDark
                    ? "0 8px 24px rgba(0,0,0,0.5)"
                    : "0 8px 24px rgba(0,0,0,0.15)",
              }}
              title={isListening ? "Stop listening" : "Tap to speak"}
            >
              <Mic size={27} strokeWidth={isListening ? 2.2 : 1.9} />
            </button>
            <span
              className="text-[11px] font-semibold tracking-tight"
              style={{
                color: isListening
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              }}
            >
              {isListening ? "Listening..." : "Tap to speak"}
            </span>
          </div>

          {/* Right: Manual Form Button (remains as requested) or Cancel when listening/transcript active */}
          <div className="flex flex-col items-center gap-1.5">
            {isListening || transcript.length > 0 ? (
              /* Cancel button: stops speaking and clears voice WITHOUT leaving the modal */
              <button
                type="button"
                onClick={handleCancelVoice}
                aria-label="Cancel speaking"
                className="w-13 h-13 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                  color: "var(--text-primary)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.14)"
                    : "1px solid rgba(0, 0, 0, 0.07)",
                  boxShadow: isDark
                    ? "0 4px 16px rgba(0,0,0,0.3)"
                    : "0 4px 16px rgba(0,0,0,0.06)",
                }}
                title="Cancel voice recording"
              >
                <X size={21} strokeWidth={2} />
              </button>
            ) : (
              /* Manual Form Edit button (kept as requested by user) */
              <button
                type="button"
                onClick={() => handleOpenForm(0)}
                aria-label="Manual Form"
                className="w-13 h-13 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                  color: "var(--text-primary)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.14)"
                    : "1px solid rgba(0, 0, 0, 0.07)",
                  boxShadow: isDark
                    ? "0 4px 16px rgba(0,0,0,0.3)"
                    : "0 4px 16px rgba(0,0,0,0.06)",
                }}
                title="Open Manual Form"
              >
                <SlidersHorizontal size={20} strokeWidth={1.75} />
              </button>
            )}
            <span
              className="text-[11px] font-medium tracking-tight"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isListening || transcript.length > 0 ? "Cancel" : "Manual"}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
