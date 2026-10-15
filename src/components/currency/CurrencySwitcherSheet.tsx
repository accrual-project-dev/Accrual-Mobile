import { useState, useMemo } from "react";
import { Search, X, Check, RefreshCw } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  useCurrency,
  CURRENCY_METADATA,
  type SupportedCurrency,
} from "../../contexts/CurrencyContext";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { formatRupiah } from "../../lib/utils";

interface CurrencySwitcherSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CurrencySwitcherSheet({
  isOpen,
  onClose,
}: CurrencySwitcherSheetProps) {
  const {
    preferredCurrency,
    setPreferredCurrency,
    rates,
    lastUpdated,
    isLoading,
    refreshRates,
  } = useCurrency();

  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const currenciesList = useMemo(() => {
    const list = Object.values(CURRENCY_METADATA);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const handleSelect = (code: SupportedCurrency) => {
    triggerHaptic("medium");
    setPreferredCurrency(code);
    showToast(
      isIndonesian
        ? `Mata uang utama diubah ke ${code}`
        : `Base currency changed to ${code}`,
      "update",
      () => {},
    );
    onClose();
  };

  const handleRefresh = async () => {
    triggerHaptic("light");
    try {
      await refreshRates();
      showToast(
        isIndonesian
          ? "Kurs nilai tukar berhasil diperbarui"
          : "Exchange rates updated to latest market quotes",
        "update",
        () => {},
      );
    } catch {
      showToast(
        isIndonesian
          ? "Gagal memperbarui kurs nilai tukar"
          : "Failed to refresh live exchange rates",
        "error",
        () => {},
      );
    }
  };

  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return isIndonesian ? "Luring" : "Offline";
    const date = new Date(lastUpdated);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastUpdated, isIndonesian]);

  // ── Frosted Liquid Glass Materials ───────────────────────────────────────
  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(245, 247, 250, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.09)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 7px rgba(0, 0, 0, 0.22)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.035)";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="px-5 sm:px-6 pt-1 space-y-3 select-none max-w-lg mx-auto"
        style={{
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
        }}
      >
        {/* ── Top Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div>
              <h2 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                {isIndonesian ? "Mata Uang Penilaian" : "Valuation Currency"}
              </h2>
              <span className="text-[12px] text-[var(--text-tertiary)]">
                {isIndonesian
                  ? "Pilih mata uang dasar pembukuan Anda"
                  : "Select your preferred base currency"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync Rates Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 px-3 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer select-none"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-primary)",
              }}
              title={
                isIndonesian
                  ? "Perbarui kurs langsung"
                  : "Refresh live exchange rates"
              }
            >
              <RefreshCw
                size={11.5}
                strokeWidth={1.8}
                className={isLoading ? "animate-spin" : ""}
              />
              <span>
                {isLoading
                  ? isIndonesian
                    ? "Menyelaraskan..."
                    : "Syncing..."
                  : isIndonesian
                    ? "Perbarui Kurs"
                    : "Sync FX"}
              </span>
            </button>

            {/* Close Button */}
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

        {/* ── Search Input & Minimal Telemetry ──────────────────────── */}
        <div className="space-y-2">
          <div
            className="flex items-center gap-2.5 px-3.5 h-10 rounded-2xl transition-all"
            style={{
              background: controlBg,
              border: controlBorder,
              boxShadow: controlShadow,
            }}
          >
            <Search
              size={14}
              className="text-[var(--text-tertiary)] shrink-0"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isIndonesian
                  ? "Cari kode, nama, atau simbol mata uang"
                  : "Search currency code, name, or symbol"
              }
              aria-label={
                isIndonesian
                  ? "Cari mata uang"
                  : "Search currency"
              }
              className="flex-1 bg-transparent text-[16px] sm:text-[13px] font-medium outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label={isIndonesian ? "Hapus pencarian" : "Clear search"}
                className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-1 text-[10.5px] text-[var(--text-tertiary)]">
            <span className="opacity-80">
              {isIndonesian ? "Harga Pasar Langsung" : "Open Exchange Live Quote"}
            </span>
            <span className="opacity-70">
              {isIndonesian ? "Pembaruan:" : "Update:"} {formattedLastUpdated}
            </span>
          </div>
        </div>

        {/* ── 2-Column Minimalist Frosted Glass Currency Grid ───────── */}
        <div className="overflow-y-auto no-scrollbar pr-0.5">
          {currenciesList.length === 0 ? (
            <div className="py-12 text-center space-y-1">
              <p className="text-[13px] font-semibold text-[var(--text-secondary)]">
                {isIndonesian
                  ? "Tidak ada mata uang yang cocok"
                  : "No matching currencies found"}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {isIndonesian
                  ? "Coba gunakan simbol atau kode negara lain."
                  : "Try searching with a different code or symbol."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {currenciesList.map((currency) => {
                const isSelected = preferredCurrency === currency.code;
                const foreignPerIdr = rates[currency.code] || 1;
                const idrPerUnit = foreignPerIdr > 0 ? 1 / foreignPerIdr : 1;

                return (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => handleSelect(currency.code)}
                    className="p-3 rounded-2xl text-left transition-all duration-150 cursor-pointer active:scale-[0.97] flex flex-col justify-between min-h-[82px] relative overflow-hidden select-none group"
                    style={{
                      background: isSelected
                        ? isDark
                          ? "#ffffff"
                          : "#18181b"
                        : isDark
                          ? "linear-gradient(135deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.02) 100%)"
                          : "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(246, 247, 250, 0.75) 100%)",
                      border: isSelected
                        ? isDark
                          ? "1px solid #ffffff"
                          : "1px solid #18181b"
                        : isDark
                          ? "1px solid rgba(255, 255, 255, 0.085)"
                          : "1px solid rgba(0, 0, 0, 0.06)",
                      boxShadow: isSelected
                        ? isDark
                          ? "0 4px 18px rgba(0, 0, 0, 0.35), inset 0 1px 0 #ffffff"
                          : "0 4px 14px rgba(0, 0, 0, 0.16)"
                        : isDark
                          ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.2)"
                          : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.035)",
                      color: isSelected
                        ? isDark
                          ? "#000000"
                          : "#ffffff"
                        : "inherit",
                    }}
                  >
                    {/* Top Row: Code + Symbol & Indicator */}
                    <div className="flex items-center justify-between gap-1 w-full">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-[14.5px] tracking-tight leading-none">
                          {currency.code}
                        </span>
                        <span className="text-[10.5px] font-medium leading-none opacity-60">
                          {currency.symbol}
                        </span>
                      </div>

                      {isSelected ? (
                        <div
                          className="w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 shadow-xs"
                          style={{
                            background: isDark ? "#000000" : "#ffffff",
                            color: isDark ? "#ffffff" : "#000000",
                          }}
                        >
                          <Check size={10.5} strokeWidth={3} />
                        </div>
                      ) : (
                        <span
                          className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0"
                          style={{
                            background: isDark
                              ? "rgba(255, 255, 255, 0.06)"
                              : "rgba(0, 0, 0, 0.04)",
                            color: isDark
                              ? "rgba(255, 255, 255, 0.65)"
                              : "rgba(0, 0, 0, 0.55)",
                            border: isDark
                              ? "1px solid rgba(255, 255, 255, 0.08)"
                              : "1px solid rgba(0, 0, 0, 0.06)",
                          }}
                        >
                          {currency.countryCode}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Name & Live Conversion Rate */}
                    <div className="mt-2.5 w-full">
                      <p className="text-[10px] truncate leading-tight font-medium opacity-65">
                        {currency.name}
                      </p>
                      <p
                        className="text-[11.5px] font-semibold leading-tight mt-1 truncate"
                        style={{
                          color: isSelected
                            ? isDark
                              ? "#000000"
                              : "#ffffff"
                            : "var(--text-primary)",
                        }}
                      >
                        {currency.code === "IDR"
                          ? "Base (1:1)"
                          : `1 ${currency.code} ≈ ${formatRupiah(Math.round(idrPerUnit))}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
