import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  X,
  CreditCard,
  Tag,
  Calendar,
  Coins,
  Layers,
} from "lucide-react";
import type { Category, Wallet } from "../../lib/types";
import {
  parseNaturalTransaction,
  parseMultiNaturalTransactions,
  type ParsedTransactionResult,
} from "../../lib/nlpParser";
import { formatCurrency } from "../../lib/utils";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";

interface SmartQuickAddBarProps {
  categories: Category[];
  wallets: Wallet[];
  onApply: (parsed: ParsedTransactionResult) => void;
  onBatchApply?: (parsedList: ParsedTransactionResult[]) => void;
}

export function SmartQuickAddBar({
  categories,
  wallets,
  onApply,
  onBatchApply,
}: SmartQuickAddBarProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { isIndonesian } = useLanguage();
  const { preferredCurrency } = useCurrency();

  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      setSpeechSupported(true);
      try {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = isIndonesian ? "id-ID" : "en-US";

        rec.onstart = () => {
          setIsListening(true);
          triggerHaptic("medium");
        };

        rec.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setInput(transcript);
          }
        };

        rec.onerror = (e: any) => {
          console.warn("Speech recognition error:", e);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      } catch (err) {
        console.warn("Speech init failed:", err);
      }
    }
  }, [isIndonesian]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      triggerHaptic("light");
    } else {
      try {
        recognitionRef.current.lang = isIndonesian ? "id-ID" : "en-US";
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            if (recognitionRef.current) {
              recognitionRef.current.lang = isIndonesian ? "id-ID" : "en-US";
              recognitionRef.current.start();
            }
          } catch {}
        }, 150);
      }
    }
  };

  const parsedList = useMemo(() => {
    return parseMultiNaturalTransactions(input, categories, wallets, new Date());
  }, [input, categories, wallets]);

  const isMulti = parsedList.length > 1;
  const parsed =
    parsedList[0] ||
    parseNaturalTransaction("", categories, wallets, new Date());

  const totalBatchAmount = useMemo(() => {
    return parsedList.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [parsedList]);

  const hasMatches =
    parsedList.some(
      (p) =>
        (p.amount !== null && p.amount > 0) ||
        p.categoryId !== null ||
        p.walletId !== null,
    );

  const handleApply = () => {
    if (!hasMatches) return;
    triggerSuccessHaptic();
    if (isMulti && onBatchApply) {
      onBatchApply(parsedList);
    } else {
      onApply(parsed);
    }
    setInput("");
  };

  return (
    <div className="mb-3">
      {/* Input container - Apple Monochrome Glassmorphic Bar */}
      <div
        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl transition-all duration-300 ${
          isListening
            ? "ring-1 ring-[var(--text-primary)]/30 bg-white/[0.08]"
            : hasMatches
            ? isDark
              ? "border border-white/20 bg-white/[0.04]"
              : "border border-black/15 bg-black/[0.03]"
            : "border border-[var(--glass-border)] bg-[var(--bg-elevated)]"
        }`}
        style={{
          boxShadow: isListening
            ? isDark
              ? "0 0 16px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.06)"
              : "0 0 12px rgba(0, 0, 0, 0.06), inset 0 1px 0 #ffffff"
            : isDark
            ? "0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
            : "0 1px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02), inset 0 1px 0 #ffffff",
        }}
      >
        {/* Leading Sparkle or Pulse Icon */}
        <div className="shrink-0 flex items-center justify-center">
          {isListening ? (
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                background: "var(--text-primary)",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--accent-ink)" }}
              />
            </motion.div>
          ) : (
            <Sparkles
              size={14}
              strokeWidth={1.5}
              style={{
                color: hasMatches
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              }}
            />
          )}
        </div>

        {/* Natural Language Text Field */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hasMatches) {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder={
            isListening
              ? isIndonesian
                ? "Mendengarkan... (cth. Kopi 35rb BCA)"
                : "Listening... (e.g. Coffee 35k BCA)"
              : isIndonesian
                ? "Tambah cepat: cth. Kopi 35rb BCA atau Makan Siang 50rb..."
                : "Quick add: e.g. Coffee 35k BCA or 50k Lunch..."
          }
          className="flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-[var(--text-tertiary)] placeholder:font-normal"
          style={{ color: "var(--text-primary)" }}
        />

        {/* Clear Button */}
        {input.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setInput("");
              triggerHaptic("light");
            }}
            className="p-1 rounded-full active:scale-90 transition-transform cursor-pointer"
            style={{ color: "var(--text-tertiary)" }}
            title={
              isIndonesian ? "Hapus teks tambah cepat" : "Clear quick add"
            }
            aria-label={
              isIndonesian ? "Hapus teks tambah cepat" : "Clear quick add"
            }
          >
            <X size={13} strokeWidth={1.75} />
          </button>
        )}

        {/* Voice Dictation Button - Strictly Apple Monochrome (No Green) */}
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className={`p-1.5 rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center ${
              isListening
                ? "shadow-sm"
                : "hover:bg-white/[0.08]"
            }`}
            style={{
              background: isListening
                ? "var(--accent)"
                : "var(--glass-fill)",
              color: isListening
                ? "var(--accent-ink)"
                : "var(--text-secondary)",
              border: `1px solid ${
                isListening ? "transparent" : "var(--glass-border)"
              }`,
            }}
            title={
              isListening
                ? isIndonesian
                  ? "Berhenti mendengarkan"
                  : "Stop listening"
                : isIndonesian
                  ? "Dikte dengan suara"
                  : "Dictate with voice"
            }
            aria-label={
              isListening
                ? isIndonesian
                  ? "Berhenti mendengarkan"
                  : "Stop listening"
                : isIndonesian
                  ? "Dikte dengan suara"
                  : "Dictate with voice"
            }
          >
            {isListening ? (
              <MicOff size={14} strokeWidth={1.75} />
            ) : (
              <Mic size={14} strokeWidth={1.75} />
            )}
          </button>
        )}

        {/* Apply Action Button - Clean Apple Glass Pill */}
        {hasMatches && (
          <button
            type="button"
            onClick={handleApply}
            className="px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
            style={{
              background: "var(--accent)",
              color: "var(--accent-ink)",
            }}
            title={
              isMulti && onBatchApply
                ? isIndonesian
                  ? `Simpan Semua (${parsedList.length})`
                  : `Save All (${parsedList.length})`
                : isIndonesian
                  ? "Isi formulir transaksi"
                  : "Fill transaction form"
            }
            aria-label={
              isMulti && onBatchApply
                ? isIndonesian
                  ? `Simpan Semua (${parsedList.length})`
                  : `Save All (${parsedList.length})`
                : isIndonesian
                  ? "Isi formulir transaksi"
                  : "Fill transaction form"
            }
          >
            <Check size={12} strokeWidth={2} />
            {isMulti && onBatchApply
              ? isIndonesian
                ? `Simpan Semua (${parsedList.length})`
                : `Save All (${parsedList.length})`
              : isIndonesian
                ? "Isi"
                : "Fill"}
          </button>
        )}
      </div>

      {/* Real-time Parsed Tokens Preview Chips */}
      <AnimatePresence>
        {hasMatches && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-1.5 flex-wrap mt-2 px-1 overflow-hidden"
          >
            {isMulti ? (
              <>
                <span
                  className="px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Layers size={10.5} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
                  {parsedList.length} {isIndonesian ? "Item • Total" : "Items • Total"} {formatCurrency(totalBatchAmount, preferredCurrency)}
                </span>
                {parsedList.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    #{idx + 1} {item.note || item.categoryName}: {item.amount ? formatCurrency(item.amount, preferredCurrency) : formatCurrency(0, preferredCurrency)}
                  </span>
                ))}
              </>
            ) : (
              <>
                {parsed.amount !== null && (
                  <span
                    className="px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Coins size={10.5} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
                    {formatCurrency(parsed.amount, preferredCurrency)}
                  </span>
                )}

                {parsed.categoryName && (
                  <span
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium flex items-center gap-1"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Tag size={10.5} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
                    {parsed.categoryName}
                  </span>
                )}

                {parsed.walletName && (
                  <span
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium flex items-center gap-1"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <CreditCard size={10.5} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
                    {parsed.type === "transfer" && parsed.toWalletName
                      ? `${parsed.walletName} → ${parsed.toWalletName}`
                      : parsed.walletName}
                  </span>
                )}

                {parsed.dateLabel &&
                  parsed.dateLabel !== "Today" &&
                  parsed.dateLabel !== "Hari Ini" &&
                  parsed.dateLabel !== "Hari ini" && (
                    <span
                      className="px-2 py-0.5 rounded-lg text-[11px] font-medium flex items-center gap-1"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      <Calendar size={10.5} strokeWidth={1.5} />
                      {parsed.dateLabel === "Yesterday" ||
                      parsed.dateLabel === "Kemarin"
                        ? isIndonesian
                          ? "Kemarin"
                          : "Yesterday"
                        : parsed.dateLabel.endsWith("d ago")
                          ? isIndonesian
                            ? `${parsed.dateLabel.replace("d ago", "")} hari lalu`
                            : parsed.dateLabel
                          : parsed.dateLabel}
                    </span>
                  )}
              </>
            )}

            <span
              className="text-[10px] font-medium ml-auto"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? `Tekan Enter atau ketuk ${
                    isMulti && onBatchApply ? "Simpan Semua" : "Isi"
                  }`
                : `Press Enter or tap ${
                    isMulti && onBatchApply ? "Save All" : "Fill"
                  }`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
