import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  LogOut,
  Delete,
} from "lucide-react";
import { useSecurityLock } from "../../contexts/SecurityLockContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getPinLockoutState } from "../../lib/biometricAuth";
import { triggerHaptic } from "../../lib/haptics";

export function BiometricLockOverlay() {
  const {
    isLocked,
    unlockWithPin,
  } = useSecurityLock();
  const { signOut } = useAuth();
  const { isIndonesian } = useLanguage();

  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const handlePinDigit = async (digit: string) => {
    const lockout = getPinLockoutState();
    if (lockout.isLocked) {
      setLockoutSeconds(lockout.remainingSeconds);
      setPinError(true);
      triggerHaptic("heavy");
      return;
    }
    if (pinInput.length >= 6) return;
    triggerHaptic("light");
    const nextPin = pinInput + digit;
    setPinInput(nextPin);
    setPinError(false);
    setLockoutSeconds(0);

    // Auto-check on 4+ digits
    if (nextPin.length >= 4) {
      const ok = await unlockWithPin(nextPin);
      if (!ok && nextPin.length >= 6) {
        setPinError(true);
        const nextLockout = getPinLockoutState();
        if (nextLockout.isLocked) {
          setLockoutSeconds(nextLockout.remainingSeconds);
        }
        triggerHaptic("heavy");
        setTimeout(() => setPinInput(""), 600);
      }
    }
  };

  const handlePinDelete = () => {
    triggerHaptic("light");
    setPinInput((p) => p.slice(0, -1));
    setPinError(false);
  };

  if (!isLocked) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="fixed inset-0 z-[999999] flex flex-col items-center justify-between p-6 select-none"
        style={{
          background: "var(--bg-canvas)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 24px), 32px)",
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)",
        }}
      >
        {/* Top Minimal Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2 pt-8">
          <div
            className="w-16 h-16 rounded-[22px] flex items-center justify-center shadow-2xl relative"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Lock size={26} strokeWidth={1.5} style={{ color: "var(--text-primary)" }} />
          </div>

          <h2
            className="text-[24px] font-semibold tracking-tight mt-2"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Accrual Terkunci" : "Accrual Locked"}
          </h2>
          <p
            className="text-[12px] font-medium max-w-[260px] leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            {lockoutSeconds > 0
              ? isIndonesian
                ? `Terlalu banyak percobaan salah. Coba lagi dalam ${lockoutSeconds} detik.`
                : `Too many failed attempts. Try again in ${lockoutSeconds}s.`
              : isIndonesian
              ? "Masukkan PIN keamanan 6-digit Anda untuk membuka brankas"
              : "Enter your 6-digit security PIN to unlock the vault"}
          </p>
        </div>

        {/* Middle Interactive Zone: PIN Numeric Keypad */}
        <div className="w-full max-w-xs flex flex-col items-center justify-center my-auto">
          <div className="w-full space-y-6">
            {/* PIN Dots Indicator (Strict Monochrome Rule 7) */}
            <div className="flex items-center justify-center gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const isFilled = i < pinInput.length;
                return (
                  <motion.div
                    key={i}
                    animate={pinError ? { x: [-6, 6, -4, 4, 0] } : {}}
                    transition={{ duration: 0.3 }}
                    className="w-3.5 h-3.5 rounded-full transition-all duration-200"
                    style={{
                      background: pinError
                        ? "var(--text-tertiary)"
                        : isFilled
                        ? "var(--text-primary)"
                        : "var(--glass-fill)",
                      border: pinError
                        ? "1px solid var(--text-primary)"
                        : isFilled
                        ? "none"
                        : "1px solid var(--glass-border)",
                    }}
                  />
                );
              })}
            </div>

            {/* Number Keypad Grid */}
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinDigit(digit)}
                  className="h-14 rounded-2xl flex items-center justify-center font-semibold text-[19px] active:scale-92 transition-all cursor-pointer select-none"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setPinInput("");
                  setPinError(false);
                  triggerHaptic("light");
                }}
                className="h-14 rounded-2xl flex items-center justify-center text-[11px] font-semibold active:scale-92 transition-all cursor-pointer"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Hapus" : "Clear"}
              </button>

              <button
                type="button"
                onClick={() => handlePinDigit("0")}
                className="h-14 rounded-2xl flex items-center justify-center font-semibold text-[19px] active:scale-92 transition-all cursor-pointer select-none"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                0
              </button>

              <button
                type="button"
                onClick={handlePinDelete}
                className="h-14 rounded-2xl flex items-center justify-center active:scale-92 transition-all cursor-pointer"
                style={{ color: "var(--text-secondary)" }}
              >
                <Delete size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Emergency Sign Out */}
        <div className="pt-4 flex items-center justify-center">
          <button
            type="button"
            onClick={async () => {
              triggerHaptic("medium");
              await signOut();
            }}
            className="flex items-center gap-1.5 text-[11px] font-semibold py-2 px-3 rounded-full transition-opacity opacity-70 hover:opacity-100 cursor-pointer"
            style={{
              color: "var(--text-tertiary)",
            }}
          >
            <LogOut size={13} strokeWidth={1.75} />
            <span>
              {isIndonesian
                ? "Keluar dari Perangkat Ini"
                : "Sign Out from this Device"}
            </span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
