import { useState, useMemo } from "react";
import {
  Search,
  X,
  Check,
  RefreshCw,
  ArrowLeftRight,
  TrendingUp,
  Coins,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  useCurrency,
  CURRENCY_METADATA,
  type SupportedCurrency,
  formatCurrencyAmount,
  calculateCrossRate,
  calculateForeignAssetRevaluation,
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

  const [activeTab, setActiveTab] = useState<"list" | "calculator">("list");
  const [searchQuery, setSearchQuery] = useState("");

  // Live Converter State
  const [convertAmount, setConvertAmount] = useState("100");
  const [fromCurrency, setFromCurrency] = useState<SupportedCurrency>("USD");
  const [toCurrency, setToCurrency] = useState<SupportedCurrency>(
    preferredCurrency === "USD" ? "IDR" : preferredCurrency,
  );

  // Foreign Asset Revaluation Simulator State
  const [simUnits, setSimUnits] = useState("10");
  const [simAssetCurrency, setSimAssetCurrency] =
    useState<SupportedCurrency>("USD");
  const [simBuyPrice, setSimBuyPrice] = useState("150");
  const [simCurrentPrice, setSimCurrentPrice] = useState("180");
  const [simHistoricalRate, setSimHistoricalRate] = useState("15000");

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

  const handleSwapCurrencies = () => {
    triggerHaptic("light");
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return isIndonesian ? "Luring" : "Offline";
    const date = new Date(lastUpdated);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastUpdated, isIndonesian]);

  // Converter calculations
  const parsedConvertAmount = Math.max(0, parseFloat(convertAmount) || 0);
  const crossRate = useMemo(
    () => calculateCrossRate(fromCurrency, toCurrency, rates),
    [fromCurrency, toCurrency, rates],
  );
  const reverseCrossRate = useMemo(
    () => calculateCrossRate(toCurrency, fromCurrency, rates),
    [fromCurrency, toCurrency, rates],
  );
  const convertedTotal = useMemo(
    () => parsedConvertAmount * crossRate,
    [parsedConvertAmount, crossRate],
  );

  // Foreign Asset Revaluation Calculation
  const revaluation = useMemo(() => {
    const units = Math.max(0, parseFloat(simUnits) || 0);
    const buyPrice = Math.max(0, parseFloat(simBuyPrice) || 0);
    const curPrice = Math.max(0, parseFloat(simCurrentPrice) || 0);
    const histRate = parseFloat(simHistoricalRate) || 0;

    return calculateForeignAssetRevaluation({
      units,
      nativeCostPrice: buyPrice,
      nativeCurrentPrice: curPrice,
      nativeCurrency: simAssetCurrency,
      baseCurrency: preferredCurrency,
      costExchangeRate: histRate > 0 ? histRate : undefined,
      rates,
      isIndonesian,
    });
  }, [
    simUnits,
    simBuyPrice,
    simCurrentPrice,
    simHistoricalRate,
    simAssetCurrency,
    preferredCurrency,
    rates,
    isIndonesian,
  ]);

  // Quick chips for live converter
  const quickChips = useMemo(() => {
    if (fromCurrency === "IDR") return [100000, 500000, 1000000, 5000000];
    if (fromCurrency === "JPY") return [1000, 5000, 10000, 50000];
    return [10, 50, 100, 500, 1000];
  }, [fromCurrency]);

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
        className="px-5 sm:px-6 pt-1 space-y-3.5 select-none max-w-lg mx-auto"
        style={{
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
        }}
      >
        {/* ── Top Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                {isIndonesian ? "Valas & Nilai Tukar" : "FX & Exchange Rates"}
              </h2>
              <span className="text-[11.5px] text-[var(--text-tertiary)]">
                {isIndonesian
                  ? "Konversi multi-valuta & revaluasi aset asing"
                  : "Multi-currency conversion & foreign asset revaluation"}
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

        {/* ── Segmented Mode Track (Apple Luxury Standard) ─────────── */}
        <div className="p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("list");
              triggerHaptic("light");
            }}
            className={`flex-1 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer text-center ${
              activeTab === "list"
                ? isDark
                  ? "bg-white text-black shadow-xs"
                  : "bg-white text-zinc-900 shadow-xs"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {isIndonesian ? "Pilihan Mata Uang" : "Base Currencies"}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("calculator");
              triggerHaptic("light");
            }}
            className={`flex-1 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer text-center ${
              activeTab === "calculator"
                ? isDark
                  ? "bg-white text-black shadow-xs"
                  : "bg-white text-zinc-900 shadow-xs"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {isIndonesian ? "Kalkulator & Revaluasi" : "Converter & Revaluation"}
          </button>
        </div>

        {/* ── TAB 1: Currency Selection Grid ─────────────────────────── */}
        {activeTab === "list" && (
          <div className="space-y-3">
            {/* Search Input & Live Status */}
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

            {/* 2-Column Minimalist Frosted Glass Currency Grid */}
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
                              ? isIndonesian
                                ? "Dasar (1:1)"
                                : "Base (1:1)"
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
        )}

        {/* ── TAB 2: Live FX Converter & Foreign Asset Revaluation ───── */}
        {activeTab === "calculator" && (
          <div className="space-y-4">
            {/* ── Sub-card 1: Live Interactive FX Converter ───────────── */}
            <div
              className="p-4 rounded-[22px] space-y-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Coins size={14} style={{ color: "var(--text-primary)" }} />
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "Konversi Valas Langsung" : "Live FX Converter"}
                  </span>
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Spot Pasar" : "Live Quotes"}
                </span>
              </div>

              {/* Amount Input */}
              <div
                className="flex items-center gap-2 px-3 h-11 rounded-xl"
                style={{
                  background: controlBg,
                  border: controlBorder,
                }}
              >
                <input
                  type="number"
                  inputMode="decimal"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  placeholder="100"
                  aria-label={isIndonesian ? "Nominal konversi" : "Conversion amount"}
                  className="flex-1 bg-transparent text-[18px] font-bold outline-none text-[var(--text-primary)]"
                />
                <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                  {fromCurrency}
                </span>
              </div>

              {/* Currency Pair Selector with Swap Button */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[9.5px] uppercase font-bold text-[var(--text-tertiary)] block mb-1">
                    {isIndonesian ? "Dari" : "From"}
                  </label>
                  <select
                    value={fromCurrency}
                    onChange={(e) =>
                      setFromCurrency(e.target.value as SupportedCurrency)
                    }
                    className="w-full h-9 px-2 rounded-xl text-[12px] font-semibold outline-none cursor-pointer"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      color: "var(--text-primary)",
                    }}
                  >
                    {Object.keys(CURRENCY_METADATA).map((c) => (
                      <option key={c} value={c} className="bg-zinc-900 text-white">
                        {c} - {CURRENCY_METADATA[c as SupportedCurrency].name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSwapCurrencies}
                  aria-label={isIndonesian ? "Tukar mata uang" : "Swap currencies"}
                  className="w-9 h-9 mt-4 rounded-xl flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-transform"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <ArrowLeftRight size={13} />
                </button>

                <div className="flex-1">
                  <label className="text-[9.5px] uppercase font-bold text-[var(--text-tertiary)] block mb-1">
                    {isIndonesian ? "Ke" : "To"}
                  </label>
                  <select
                    value={toCurrency}
                    onChange={(e) =>
                      setToCurrency(e.target.value as SupportedCurrency)
                    }
                    className="w-full h-9 px-2 rounded-xl text-[12px] font-semibold outline-none cursor-pointer"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      color: "var(--text-primary)",
                    }}
                  >
                    {Object.keys(CURRENCY_METADATA).map((c) => (
                      <option key={c} value={c} className="bg-zinc-900 text-white">
                        {c} - {CURRENCY_METADATA[c as SupportedCurrency].name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Increment Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {quickChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setConvertAmount(String(chip));
                      triggerHaptic("light");
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-semibold shrink-0 cursor-pointer transition-all active:scale-95"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      color: "var(--text-secondary)",
                    }}
                  >
                    +{chip >= 1000 ? formatRupiah(chip) : chip}
                  </button>
                ))}
              </div>

              {/* Conversion Result Hero */}
              <div
                className="p-3.5 rounded-2xl space-y-1 text-center"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  border: controlBorder,
                }}
              >
                <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)] block">
                  {isIndonesian ? "Hasil Konversi" : "Converted Equivalent"}
                </span>
                <span
                  className="amount text-[22px] font-bold block tracking-tight truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatCurrencyAmount(convertedTotal, toCurrency)}
                </span>
                <p className="text-[10.5px] text-[var(--text-tertiary)] pt-0.5">
                  1 {fromCurrency} ≈ {formatCurrencyAmount(crossRate, toCurrency)} · 1 {toCurrency} ≈ {formatCurrencyAmount(reverseCrossRate, fromCurrency)}
                </p>
              </div>
            </div>

            {/* ── Sub-card 2: Foreign Asset Revaluation Simulator ─────── */}
            <div
              className="p-4 rounded-[22px] space-y-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} style={{ color: "var(--text-primary)" }} />
                  <div>
                    <h3
                      className="text-[12px] font-bold leading-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian
                        ? "Simulator Revaluasi Aset Valas"
                        : "Foreign Asset Revaluation Simulator"}
                    </h3>
                  </div>
                </div>
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--glass-fill)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {revaluation.statusBadge}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {isIndonesian
                  ? "Dekomposisi imbal hasil portofolio asing: pisahkan keuntungan apresiasi instrumen dari fluktuasi kurs mata uang (IFRS/IAS 21)."
                  : "Foreign portfolio attribution: decompose total gains into pure instrument appreciation vs foreign exchange movements (IFRS/IAS 21)."}
              </p>

              {/* Grid Inputs for Simulation */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-[var(--text-tertiary)] block mb-1">
                    {isIndonesian ? "Jumlah Unit" : "Units Held"}
                  </label>
                  <input
                    type="number"
                    value={simUnits}
                    onChange={(e) => setSimUnits(e.target.value)}
                    placeholder="10"
                    aria-label={isIndonesian ? "Jumlah unit" : "Units held"}
                    className="w-full h-8 px-2.5 rounded-xl font-semibold outline-none text-[var(--text-primary)]"
                    style={{ background: controlBg, border: controlBorder }}
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-bold uppercase text-[var(--text-tertiary)] block mb-1">
                    {isIndonesian ? "Mata Uang Asing" : "Foreign Currency"}
                  </label>
                  <select
                    value={simAssetCurrency}
                    onChange={(e) =>
                      setSimAssetCurrency(e.target.value as SupportedCurrency)
                    }
                    className="w-full h-8 px-2 rounded-xl font-semibold outline-none cursor-pointer"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      color: "var(--text-primary)",
                    }}
                  >
                    {["USD", "SGD", "EUR", "JPY", "MYR", "USDT"].map((c) => (
                      <option key={c} value={c} className="bg-zinc-900 text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9.5px] font-bold uppercase text-[var(--text-tertiary)] block mb-1">
                    {isIndonesian ? `Harga Beli (${simAssetCurrency})` : `Buy Price (${simAssetCurrency})`}
                  </label>
                  <input
                    type="number"
                    value={simBuyPrice}
                    onChange={(e) => setSimBuyPrice(e.target.value)}
                    placeholder="150"
                    aria-label={isIndonesian ? "Harga beli asing" : "Foreign buy price"}
                    className="w-full h-8 px-2.5 rounded-xl font-semibold outline-none text-[var(--text-primary)]"
                    style={{ background: controlBg, border: controlBorder }}
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-bold uppercase text-[var(--text-tertiary)] block mb-1">
                    {isIndonesian ? `Harga Spot (${simAssetCurrency})` : `Spot Price (${simAssetCurrency})`}
                  </label>
                  <input
                    type="number"
                    value={simCurrentPrice}
                    onChange={(e) => setSimCurrentPrice(e.target.value)}
                    placeholder="180"
                    aria-label={isIndonesian ? "Harga pasar spot" : "Spot market price"}
                    className="w-full h-8 px-2.5 rounded-xl font-semibold outline-none text-[var(--text-primary)]"
                    style={{ background: controlBg, border: controlBorder }}
                  />
                </div>

                <div className="col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9.5px] font-bold uppercase text-[var(--text-tertiary)]">
                      {isIndonesian
                        ? `Kurs Beli Historis (${preferredCurrency} per 1 ${simAssetCurrency})`
                        : `Cost FX Rate (${preferredCurrency} per 1 ${simAssetCurrency})`}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSimHistoricalRate(
                          String(
                            Math.round(
                              calculateCrossRate(
                                simAssetCurrency,
                                preferredCurrency,
                                rates,
                              ),
                            ),
                          ),
                        )
                      }
                      className="text-[9px] font-semibold text-[var(--text-secondary)] underline cursor-pointer"
                    >
                      {isIndonesian ? "Gunakan Spot Sekarang" : "Use Current Spot"}
                    </button>
                  </div>
                  <input
                    type="number"
                    value={simHistoricalRate}
                    onChange={(e) => setSimHistoricalRate(e.target.value)}
                    placeholder="15000"
                    aria-label={isIndonesian ? "Kurs beli historis" : "Historical cost exchange rate"}
                    className="w-full h-8 px-2.5 rounded-xl font-semibold outline-none text-[var(--text-primary)]"
                    style={{ background: controlBg, border: controlBorder }}
                  />
                </div>
              </div>

              {/* Attribution Results Decomposition Grid */}
              <div className="space-y-2 pt-1 border-t border-[var(--glass-border)]">
                {/* Total Value & PnL */}
                <div
                  className="p-3 rounded-2xl flex items-center justify-between"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                  }}
                >
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)] block">
                      {isIndonesian ? "Nilai Pasar Terkonversi" : "Revalued Market Value"}
                    </span>
                    <span
                      className="amount text-[15px] font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatCurrencyAmount(
                        revaluation.baseMarketValue,
                        preferredCurrency,
                      )}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)] block">
                      {isIndonesian ? "Total Laba / Rugi" : "Total Net Return"}
                    </span>
                    <span
                      className="amount text-[14px] font-bold"
                      style={{
                        color:
                          revaluation.totalBaseGain >= 0
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {revaluation.totalBaseGain >= 0 ? "+" : ""}
                      {formatCurrencyAmount(
                        revaluation.totalBaseGain,
                        preferredCurrency,
                      )}{" "}
                      ({revaluation.totalBaseGainPct >= 0 ? "+" : ""}
                      {revaluation.totalBaseGainPct}%)
                    </span>
                  </div>
                </div>

                {/* 2 Decomposition Columns */}
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="p-2.5 rounded-xl text-center"
                    style={{ background: "var(--glass-fill)" }}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
                      {isIndonesian ? "Laba Modal Aset" : "Asset Capital Gain"}
                    </span>
                    <span
                      className="amount text-[13px] font-semibold mt-0.5 block truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {revaluation.assetCapitalGainBase >= 0 ? "+" : ""}
                      {formatCurrencyAmount(
                        revaluation.assetCapitalGainBase,
                        preferredCurrency,
                      )}
                    </span>
                    <span className="text-[9.5px] text-[var(--text-tertiary)] block mt-0.5">
                      {isIndonesian ? "Apresiasi instrumen" : "Pure asset growth"}
                    </span>
                  </div>

                  <div
                    className="p-2.5 rounded-xl text-center"
                    style={{ background: "var(--glass-fill)" }}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
                      {isIndonesian ? "Dampak Kurs (FX)" : "FX Movement (FX)"}
                    </span>
                    <span
                      className="amount text-[13px] font-semibold mt-0.5 block truncate"
                      style={{
                        color:
                          revaluation.currencyFxGainBase >= 0
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {revaluation.currencyFxGainBase >= 0 ? "+" : ""}
                      {formatCurrencyAmount(
                        revaluation.currencyFxGainBase,
                        preferredCurrency,
                      )}
                    </span>
                    <span className="text-[9.5px] text-[var(--text-tertiary)] block mt-0.5">
                      {isIndonesian
                        ? `${revaluation.fxRateChangePct >= 0 ? "+" : ""}${revaluation.fxRateChangePct}% pergeseran kurs`
                        : `${revaluation.fxRateChangePct >= 0 ? "+" : ""}${revaluation.fxRateChangePct}% FX movement`}
                    </span>
                  </div>
                </div>

                {/* Narrative Diagnostic Verdict */}
                <p
                  className="text-[10.5px] leading-relaxed px-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {revaluation.verdict}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
