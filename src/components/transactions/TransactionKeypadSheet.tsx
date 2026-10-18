import { motion, AnimatePresence } from "framer-motion";
import { Delete, Check, Equal } from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { applyKeypadInput } from "../../lib/keypadHelper";
import { evaluateMathSafe } from "../../lib/evaluateMathSafe";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  useCurrency,
  formatCurrencyAmount,
} from "../../contexts/CurrencyContext";

interface TransactionKeypadSheetProps {
  isOpen: boolean;
  onClose: () => void;
  expression: string;
  onExpressionChange: (newExpr: string, numericVal: number) => void;
  onDone?: () => void;
}

export function TransactionKeypadSheet({
  isOpen,
  onClose,
  expression,
  onExpressionChange,
  onDone,
}: TransactionKeypadSheetProps) {
  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();
  const { preferredCurrency, currencyMeta } = useCurrency();
  const isDark = theme !== "light";
  const allowDecimals = true;
  const maxDecimals = Math.max(currencyMeta.decimals, 2);

  const currentVal = evaluateMathSafe(expression);
  const isExpression = /[+\-*/×÷−]/.test(expression);

  const handleKey = (key: string) => {
    triggerHaptic("light");
    const res = applyKeypadInput(expression, key, {
      allowDecimals,
      maxDecimals,
      isIndonesian,
    });
    onExpressionChange(res.expression, res.numericValue);
  };

  // ── Logika Mandiri Tombol Persen (%) ──────────────────────────────────────
  const handlePercent = () => {
    triggerHaptic("light");
    if (!expression || expression === "0") return;

    // Periksa apakah terdapat ekspresi bertingkat: [prefix][operator][angka_terakhir]
    const match = expression.match(/^(.*?)([+\-−×÷*/])(\d+(?:\.\d+)?)$/);

    if (match) {
      const prefix = match[1];
      const operator = match[2];
      const lastNumStr = match[3];
      const lastNum = parseFloat(lastNumStr);

      if (isNaN(lastNum)) return;

      const baseVal = evaluateMathSafe(prefix);
      let calculatedVal = 0;

      // Jika penjumlahan/pengurangan (+ / -), hitung X% dari nilai awal
      if (operator === "+" || operator === "-" || operator === "−") {
        calculatedVal = (baseVal * lastNum) / 100;
      } else {
        // Jika perkalian/pembagian (× / ÷), ubah angka menjadi desimal (10% -> 0.1)
        calculatedVal = lastNum / 100;
      }

      const formattedVal = allowDecimals
        ? parseFloat(calculatedVal.toFixed(maxDecimals))
        : Math.round(calculatedVal);

      const newExpr = `${prefix}${operator}${formattedVal}`;
      const evaluated = evaluateMathSafe(newExpr);
      onExpressionChange(newExpr, evaluated);
    } else {
      // Angka tunggal murni: langsung bagi 100
      const val = evaluateMathSafe(expression);
      if (val > 0) {
        const result = allowDecimals
          ? parseFloat((val / 100).toFixed(maxDecimals))
          : Math.round(val / 100);
        onExpressionChange(String(result), result);
      }
    }
  };

  const handleDone = () => {
    triggerHaptic("medium");
    const res = applyKeypadInput(expression, "=", {
      allowDecimals,
      maxDecimals,
      isIndonesian,
    });
    onExpressionChange(res.expression, res.numericValue);
    if (onDone) {
      onDone();
    } else {
      onClose();
    }
  };

  const handleClear = () => {
    triggerHaptic("medium");
    const res = applyKeypadInput(expression, "clear", {
      allowDecimals,
      maxDecimals,
      isIndonesian,
    });
    onExpressionChange(res.expression, res.numericValue);
  };

  // ── Frosted Liquid Glass Materials ───────────────────────────────────────
  const shellBg = isDark
    ? "linear-gradient(180deg, rgba(26, 26, 32, 0.94) 0%, rgba(14, 14, 18, 0.98) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 247, 250, 0.98) 100%)";

  const shellBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.14)"
    : "1px solid rgba(0, 0, 0, 0.08)";

  const keyNumBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 249, 252, 0.9) 100%)";

  const keyNumBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.085)"
    : "1px solid rgba(0, 0, 0, 0.065)";

  const keyNumShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.085), 0 2px 6px rgba(0, 0, 0, 0.22)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.04)";

  const keyOpBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.065) 100%)"
    : "linear-gradient(180deg, rgba(0, 0, 0, 0.06) 0%, rgba(0, 0, 0, 0.03) 100%)";

  const keyOpBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.12)"
    : "1px solid rgba(0, 0, 0, 0.07)";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="transaction-keypad-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[1000] flex items-end justify-center pointer-events-none"
        >
          <motion.div
            key="transaction-keypad-panel"
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 390 }}
            className="relative w-full max-w-[430px] rounded-t-[30px] sm:rounded-t-[34px] overflow-hidden select-none pointer-events-auto transition-all"
          style={{
            background: shellBg,
            backdropFilter: "blur(32px) saturate(190%)",
            WebkitBackdropFilter: "blur(32px) saturate(190%)",
            borderTop: shellBorder,
            borderLeft: shellBorder,
            borderRight: shellBorder,
            boxShadow: isDark
              ? "0 -16px 44px -8px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
              : "0 -12px 36px -6px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 16px), 24px)",
          }}
        >
          {/* Top Specular Rim Lighting Reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[8%] right-[8%] top-[1px] h-[2px] rounded-full"
            style={{
              background: isDark
                ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.5), rgba(255,255,255,0.25), transparent)"
                : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
            }}
          />

          {/* ── Area Atas Keypad: Ketuk untuk Menutup ── */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                triggerHaptic("light");
                onClose();
              }
            }}
            className="w-full pt-2.5 pb-2 flex flex-col items-center justify-center cursor-pointer group active:opacity-60 transition-opacity"
            title={
              isIndonesian ? "Ketuk untuk sembunyikan keypad" : "Tap to dismiss"
            }
            aria-label={
              isIndonesian ? "Sembunyikan keypad" : "Dismiss keypad"
            }
          >
            <div
              className="w-10 h-1 rounded-full transition-transform group-hover:scale-105"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.28)"
                  : "rgba(0, 0, 0, 0.20)",
              }}
            />

            {/* Live Expression Result Badge */}
            {isExpression && (
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleKey("=");
                }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 px-3 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(0, 0, 0, 0.06)",
                  color: "var(--text-primary)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.16)"
                    : "1px solid rgba(0, 0, 0, 0.08)",
                }}
                title={
                  isIndonesian
                    ? "Terapkan hasil perhitungan"
                    : "Apply evaluated result"
                }
                aria-label={
                  isIndonesian
                    ? "Terapkan hasil perhitungan"
                    : "Apply evaluated result"
                }
              >
                <Equal size={10} strokeWidth={2.5} />
                <span>
                  {formatCurrencyAmount(currentVal, preferredCurrency)}
                </span>
              </motion.button>
            )}
          </div>

          {/* ── Symmetrical 4-Column Grid (5 Baris x 4 Kolom) ── */}
          <div className="grid grid-cols-4 gap-2 px-3.5 pt-0.5 pb-1">
            {/* Baris 1: AC, ⌫, %, Selesai */}
            <button
              type="button"
              onClick={handleClear}
              className="h-11 rounded-2xl text-[14px] font-bold flex items-center justify-center active:scale-[0.93] transition-all cursor-pointer"
              style={{
                background: keyOpBg,
                border: keyOpBorder,
                boxShadow: keyNumShadow,
                color: isDark ? "#ffffff" : "#18181b",
              }}
              title={isIndonesian ? "Hapus Semua" : "All Clear"}
              aria-label={isIndonesian ? "Hapus Semua" : "All Clear"}
            >
              AC
            </button>
            <button
              type="button"
              onClick={() => handleKey("backspace")}
              className="h-11 rounded-2xl flex items-center justify-center active:scale-[0.93] transition-all cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              style={{
                background: keyOpBg,
                border: keyOpBorder,
                boxShadow: keyNumShadow,
              }}
              title={isIndonesian ? "Hapus satu digit" : "Backspace"}
              aria-label={isIndonesian ? "Hapus satu digit" : "Backspace"}
            >
              <Delete size={18} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={handlePercent}
              className="h-11 rounded-2xl text-[17px] font-semibold flex items-center justify-center active:scale-[0.93] transition-all cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              style={{
                background: keyOpBg,
                border: keyOpBorder,
                boxShadow: keyNumShadow,
              }}
              title={isIndonesian ? "Persen (%)" : "Percent (%)"}
              aria-label={isIndonesian ? "Persen" : "Percent"}
            >
              %
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="h-11 rounded-2xl text-[13px] font-semibold flex items-center justify-center gap-1 active:scale-[0.93] transition-all cursor-pointer shadow-sm select-none"
              style={{
                background: isDark ? "#ffffff" : "#18181b",
                color: isDark ? "#000000" : "#ffffff",
                boxShadow: isDark
                  ? "0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 #ffffff"
                  : "0 2px 8px rgba(0,0,0,0.15)",
              }}
              title={isIndonesian ? "Selesai" : "Done"}
              aria-label={isIndonesian ? "Selesai" : "Done"}
            >
              <Check size={13} strokeWidth={3} />
              <span>{isIndonesian ? "Selesai" : "Done"}</span>
            </button>

            {/* Baris 2: 1, 2, 3, ÷ */}
            <button
              type="button"
              onClick={() => handleKey("1")}
              aria-label="1"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              1
            </button>
            <button
              type="button"
              onClick={() => handleKey("2")}
              aria-label="2"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              2
            </button>
            <button
              type="button"
              onClick={() => handleKey("3")}
              aria-label="3"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              3
            </button>
            <button
              type="button"
              onClick={() => handleKey("÷")}
              aria-label={isIndonesian ? "Bagi" : "Divide"}
              className="h-11 rounded-2xl text-[19px] font-semibold flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyOpBg,
                border: keyOpBorder,
                boxShadow: keyNumShadow,
              }}
            >
              ÷
            </button>

            {/* Baris 3: 4, 5, 6, × */}
            <button
              type="button"
              onClick={() => handleKey("4")}
              aria-label="4"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              4
            </button>
            <button
              type="button"
              onClick={() => handleKey("5")}
              aria-label="5"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              5
            </button>
            <button
              type="button"
              onClick={() => handleKey("6")}
              aria-label="6"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              6
            </button>
            <button
              type="button"
              onClick={() => handleKey("×")}
              aria-label={isIndonesian ? "Kali" : "Multiply"}
              className="h-11 rounded-2xl text-[19px] font-semibold flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyOpBg,
                border: keyOpBorder,
                boxShadow: keyNumShadow,
              }}
            >
              ×
            </button>

            {/* Baris 4: 7, 8, 9, − */}
            <button
              type="button"
              onClick={() => handleKey("7")}
              aria-label="7"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              7
            </button>
            <button
              type="button"
              onClick={() => handleKey("8")}
              aria-label="8"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              8
            </button>
            <button
              type="button"
              onClick={() => handleKey("9")}
              aria-label="9"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              9
            </button>
            <button
              type="button"
              onClick={() => handleKey("-")}
              aria-label={isIndonesian ? "Kurang" : "Subtract"}
              className="h-11 rounded-2xl text-[19px] font-semibold flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyOpBg,
                border: keyOpBorder,
                boxShadow: keyNumShadow,
              }}
            >
              −
            </button>

            {/* Baris 5: 000, 0, ,, + */}
            <button
              type="button"
              onClick={() => handleKey("000")}
              aria-label="000"
              className="h-11 rounded-2xl text-[16px] font-semibold flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              000
            </button>
            <button
              type="button"
              onClick={() => handleKey("0")}
              aria-label="0"
              className="h-11 rounded-2xl text-[20px] font-medium flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleKey(isIndonesian ? "," : ".")}
              aria-label={isIndonesian ? "Koma" : "Decimal point"}
              className="h-11 rounded-2xl text-[20px] font-bold flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyNumBg,
                border: keyNumBorder,
                boxShadow: keyNumShadow,
              }}
            >
              {isIndonesian ? "," : "."}
            </button>
            <button
              type="button"
              onClick={() => handleKey("+")}
              aria-label={isIndonesian ? "Tambah" : "Add"}
              className="h-11 rounded-2xl text-[19px] font-semibold flex items-center justify-center active:scale-[0.93] transition-all text-[var(--text-primary)] cursor-pointer"
              style={{
                background: keyOpBg,
                border: keyOpBorder,
                boxShadow: keyNumShadow,
              }}
            >
              +
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  );
}
