import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Delete, X } from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";

export interface VaultPinLoginModalProps {
  isOpen: boolean;
  isDark: boolean;
  isIndonesian: boolean;
  pinInput: string;
  pinError: string | null;
  pinVerifying: boolean;
  onClose: () => void;
  onClear: () => void;
  onDigit: (digit: string) => void;
  onDelete: () => void;
}

export function VaultPinLoginModal({
  isOpen,
  isDark,
  isIndonesian,
  pinInput,
  pinError,
  pinVerifying,
  onClose,
  onClear,
  onDigit,
  onDelete,
}: VaultPinLoginModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-end sm:justify-center p-4 bg-black/60 backdrop-blur-xl"
          style={{
            paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 24px)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`w-full max-w-sm rounded-[32px] p-6 border flex flex-col items-center relative shadow-2xl ${
              isDark
                ? "bg-[#121216] border-white/16 text-white"
                : "bg-white border-black/10 text-zinc-950"
            }`}
            style={{
              boxShadow: isDark
                ? "0 20px 48px -12px rgba(0,0,0,0.5)"
                : "0 20px 40px -12px rgba(0,0,0,0.1)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onClose();
              }}
              className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
                isDark
                  ? "text-white/40 hover:text-white bg-white/[0.04]"
                  : "text-zinc-400 hover:text-zinc-800 bg-black/[0.04]"
              }`}
            >
              <X size={16} strokeWidth={2} />
            </button>

            <div
              className={`w-12 h-12 rounded-[18px] flex items-center justify-center border mb-3 mt-1 ${
                isDark ? "bg-white/10 border-white/15" : "bg-black/5 border-black/10"
              }`}
            >
              <KeyRound size={20} strokeWidth={1.75} className={isDark ? "text-white" : "text-zinc-900"} />
            </div>

            <h3 className="text-[17px] font-semibold tracking-tight text-center">
              {isIndonesian ? "Masukkan PIN Brankas" : "Enter Vault PIN"}
            </h3>
            <p
              className={`text-[12px] text-center mt-1 mb-5 max-w-[240px] leading-relaxed ${
                isDark ? "text-white/50" : "text-zinc-500"
              }`}
            >
              {isIndonesian
                ? "Otorisasi pembukaan brankas aset di perangkat ini"
                : "Authorize local vault access on this device"}
            </p>

            <div className="flex items-center justify-center gap-3.5 mb-6">
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const isFilled = i < pinInput.length;
                return (
                  <motion.div
                    key={i}
                    animate={pinError ? { x: [-6, 6, -4, 4, 0] } : {}}
                    transition={{ duration: 0.3 }}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                      isFilled
                        ? isDark
                          ? "bg-white scale-110"
                          : "bg-zinc-950 scale-110"
                        : isDark
                          ? "bg-white/15 border border-white/25"
                          : "bg-black/10 border border-black/15"
                    }`}
                  />
                );
              })}
            </div>

            {pinError && (
              <p
                className={`text-[11.5px] font-medium mb-3 text-center px-2 ${
                  isDark ? "text-zinc-300" : "text-zinc-700"
                }`}
              >
                {pinError}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[270px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={pinVerifying}
                  onClick={() => onDigit(digit)}
                  className={`h-12 rounded-2xl flex items-center justify-center font-bold text-[18px] active:scale-95 transition-all cursor-pointer border select-none ${
                    isDark
                      ? "bg-white/[0.06] border-white/12 text-white hover:bg-white/[0.1]"
                      : "bg-black/[0.04] border-black/8 text-zinc-900 hover:bg-black/[0.07]"
                  }`}
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                disabled={pinVerifying}
                onClick={() => {
                  triggerHaptic("light");
                  onClear();
                }}
                className={`h-12 rounded-2xl flex items-center justify-center text-[11px] font-semibold active:scale-95 transition-all cursor-pointer border ${
                  isDark
                    ? "bg-white/[0.03] border-white/8 text-white/50 hover:text-white"
                    : "bg-black/[0.02] border-black/6 text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {isIndonesian ? "Hapus" : "Clear"}
              </button>

              <button
                type="button"
                disabled={pinVerifying}
                onClick={() => onDigit("0")}
                className={`h-12 rounded-2xl flex items-center justify-center font-bold text-[18px] active:scale-95 transition-all cursor-pointer border select-none ${
                  isDark
                    ? "bg-white/[0.06] border-white/12 text-white hover:bg-white/[0.1]"
                    : "bg-black/[0.04] border-black/8 text-zinc-900 hover:bg-black/[0.07]"
                }`}
              >
                0
              </button>

              <button
                type="button"
                disabled={pinVerifying}
                onClick={onDelete}
                className={`h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-all cursor-pointer border ${
                  isDark
                    ? "bg-white/[0.03] border-white/8 text-white/60 hover:text-white"
                    : "bg-black/[0.02] border-black/6 text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Delete size={17} strokeWidth={1.75} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
