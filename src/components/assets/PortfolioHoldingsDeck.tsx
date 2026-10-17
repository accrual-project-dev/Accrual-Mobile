import { useState, useMemo } from "react";
import {
  Layers,
  Plus,
  ChevronRight,
  Search,
  X,
  Coins,
} from "lucide-react";
import { formatRupiah, formatHoldingUnits } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { IconRenderer } from "../ui/IconRenderer";
import { useTheme } from "../../contexts/ThemeContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import type { InvestmentHolding } from "../../lib/types";
import type { UsdtValuationPref } from "../../lib/marketPriceService";
import { calculateHoldingValuation } from "../../lib/marketPriceService";

export interface DisplayHoldingItem extends InvestmentHolding {
  valuation: {
    marketValue: number;
    floatingPnLPct: number;
    costBasis?: number;
    floatingPnL?: number;
  };
  isUsdt?: boolean;
}

type PresetCategory =
  | "all"
  | "crypto"
  | "stock_us"
  | "stock_id"
  | "gold"
  | "fixed_asset";

interface PortfolioHoldingsDeckProps {
  holdings: InvestmentHolding[];
  displayHoldings?: DisplayHoldingItem[];
  usdtPref: UsdtValuationPref;
  recordedCryptoBalance: number;
  suggestedUsdtUnits: number;
  usdtMarketValue: number;
  usdtFloatingPnLPct: number;
  totalGrossAssets: number;
  isStealthMode: boolean;
  isIndonesian: boolean;
  onOpenAddAsset: () => void;
  onOpenUsdtDetail: () => void;
  onOpenHoldingDetail: (holding: InvestmentHolding) => void;
  onOpenConsolidatedDrawer: () => void;
}

function formatNativeQuote(
  h: InvestmentHolding,
  formatFn?: (val: number) => string,
): string {
  const isGold =
    h.asset_type === "gold" ||
    h.symbol?.toUpperCase() === "ANTAM" ||
    h.symbol?.toUpperCase() === "XAU" ||
    h.symbol?.toUpperCase() === "GOLD" ||
    h.symbol?.toUpperCase() === "EMAS";

  const fallback = formatFn || formatRupiah;

  if (isGold) {
    const p = h.native_price || h.current_price || 0;
    return `${fallback(p)}/g`;
  }
  if (h.native_currency === "USD" || h.currency === "USD") {
    const val =
      h.native_price || (h.current_price ? h.current_price / 16300 : 0);
    return `$${val >= 100 ? val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val.toFixed(2)}`;
  }
  if (h.native_currency === "USDT") {
    const val = h.native_price || 1;
    return `${val.toFixed(2)} USDT`;
  }
  return fallback(h.native_price || h.current_price || 0);
}

function getCategoryBadgeLabel(
  h: InvestmentHolding,
  isIndonesian: boolean,
): string {
  if (h.symbol?.toUpperCase() === "USDT") {
    return "STABLECOIN";
  }
  const aType = h.asset_type || "stock";
  if (aType === "crypto") return isIndonesian ? "KRIPTO" : "CRYPTO";
  if (aType === "stock") {
    const isUs = h.currency === "USD" || h.native_currency === "USD";
    if (isUs) return isIndonesian ? "SAHAM AS" : "US EQUITY";
    return isIndonesian ? "SAHAM IDX" : "IDX EQUITY";
  }
  if (aType === "gold") return isIndonesian ? "LOGAM MULIA" : "GOLD";
  if (aType === "mutual_fund") return isIndonesian ? "REKSA DANA" : "FUND";
  if (aType === "bond") return isIndonesian ? "OBLIGASI" : "BOND";
  return isIndonesian ? "ASET TETAP" : "FIXED ASSET";
}

export function PortfolioHoldingsDeck({
  holdings,
  usdtPref,
  recordedCryptoBalance,
  suggestedUsdtUnits,
  usdtMarketValue,
  usdtFloatingPnLPct,
  totalGrossAssets,
  isStealthMode,
  isIndonesian,
  onOpenAddAsset,
  onOpenUsdtDetail,
  onOpenHoldingDetail,
  onOpenConsolidatedDrawer,
}: PortfolioHoldingsDeckProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { formatWithPreferred, currencyMeta } = useCurrency();

  const [categoryFilter, setCategoryFilter] = useState<PresetCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Synthesize Unified Holdings
  const unifiedHoldings = useMemo<DisplayHoldingItem[]>(() => {
    const items: DisplayHoldingItem[] = [];

    const hasExplicitUsdt = holdings.some(
      (h) => h.symbol?.toUpperCase() === "USDT" || h.id.startsWith("usdt-"),
    );

    if (!hasExplicitUsdt && (usdtPref.units > 0 || recordedCryptoBalance > 0)) {
      const units = usdtPref.units > 0 ? usdtPref.units : suggestedUsdtUnits;
      const rate = usdtPref.rate || 16300;
      const costBasis =
        usdtPref.costBasis && usdtPref.costBasis > 0
          ? usdtPref.costBasis
          : recordedCryptoBalance > 0
            ? recordedCryptoBalance
            : units * rate;
      const buyPrice = units > 0 ? Math.round(costBasis / units) : rate;

      items.push({
        id: "usdt-core-holding",
        symbol: "USDT",
        name: "Tether USD",
        asset_type: "crypto",
        units,
        avg_buy_price: buyPrice,
        current_price: rate,
        native_price: 1.0,
        native_currency: "USDT",
        currency: "IDR",
        icon: "Coins",
        price_source: "coingecko",
        valuation: {
          marketValue: usdtMarketValue,
          floatingPnLPct: usdtFloatingPnLPct,
          costBasis,
          floatingPnL: usdtMarketValue - costBasis,
        },
        isUsdt: true,
      });
    }

    for (const h of holdings) {
      const isUsdtItem =
        h.symbol?.toUpperCase() === "USDT" || h.id.startsWith("usdt-");
      const val = calculateHoldingValuation(h);
      items.push({
        ...h,
        valuation: {
          marketValue:
            isUsdtItem && usdtMarketValue > 0
              ? usdtMarketValue
              : val.marketValue,
          floatingPnLPct:
            isUsdtItem && usdtFloatingPnLPct !== 0
              ? usdtFloatingPnLPct
              : val.floatingPnLPct,
          costBasis: val.costBasis,
          floatingPnL: val.floatingPnL,
        },
        isUsdt: isUsdtItem,
      });
    }

    return items.sort(
      (a, b) => b.valuation.marketValue - a.valuation.marketValue,
    );
  }, [
    holdings,
    usdtPref,
    recordedCryptoBalance,
    suggestedUsdtUnits,
    usdtMarketValue,
    usdtFloatingPnLPct,
  ]);

  // Filter Holdings
  const filteredHoldings = useMemo(() => {
    return unifiedHoldings.filter((h) => {
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchName = (h.name || "").toLowerCase().includes(query);
        const matchSymbol = (h.symbol || "").toLowerCase().includes(query);
        if (!matchName && !matchSymbol) return false;
      }

      if (categoryFilter === "all") return true;

      const aType = h.asset_type || "stock";
      if (categoryFilter === "crypto") {
        return aType === "crypto" || h.symbol?.toUpperCase() === "USDT";
      }
      if (categoryFilter === "stock_us") {
        return (
          aType === "stock" &&
          (h.currency === "USD" || h.native_currency === "USD")
        );
      }
      if (categoryFilter === "stock_id") {
        return (
          aType === "stock" &&
          h.currency !== "USD" &&
          h.native_currency !== "USD"
        );
      }
      if (categoryFilter === "gold") {
        return (
          aType === "gold" ||
          h.symbol?.toUpperCase() === "ANTAM" ||
          h.symbol?.toUpperCase() === "XAU" ||
          h.symbol?.toUpperCase() === "GOLD" ||
          h.symbol?.toUpperCase() === "EMAS"
        );
      }
      if (categoryFilter === "fixed_asset") {
        return (
          aType === "fixed_asset" || aType === "bond" || aType === "mutual_fund"
        );
      }
      return true;
    });
  }, [unifiedHoldings, searchQuery, categoryFilter]);

  const totalAssetCount = unifiedHoldings.length;

  const categoryTabs: { id: PresetCategory; label: string }[] = [
    { id: "all", label: isIndonesian ? "Semua" : "All" },
    { id: "crypto", label: isIndonesian ? "Kripto" : "Crypto" },
    { id: "stock_us", label: isIndonesian ? "Saham AS" : "US Equities" },
    { id: "stock_id", label: isIndonesian ? "Saham IDX" : "IDX Equities" },
    { id: "gold", label: isIndonesian ? "Emas" : "Gold" },
    { id: "fixed_asset", label: isIndonesian ? "Aset Tetap" : "Fixed Assets" },
  ];

  // ── Tactile Liquid Glass Tokens ──
  const shellBg = isDark
    ? "linear-gradient(145deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%)"
    : "linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.88) 100%)";

  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.028) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 247, 250, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 2px 6px rgba(0, 0, 0, 0.2)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.03)";

  return (
    <section
      id="holdings-deck"
      className="relative rounded-[24px] sm:rounded-[28px] p-3.5 sm:p-4 overflow-hidden transition-all select-none space-y-2.5"
      style={{
        background: shellBg,
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.11)"
          : "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow: isDark
          ? "0 16px 40px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.15)"
          : "0 10px 28px -6px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      {/* Specular Rim Light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[10%] right-[10%] top-[1px] h-[1.5px] rounded-full"
        style={{
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
            : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
        }}
      />

      {/* ── 1. Compact Header Bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: controlBg,
              border: controlBorder,
              boxShadow: controlShadow,
            }}
          >
            <Layers
              size={13.5}
              strokeWidth={1.8}
              className="text-[var(--text-primary)]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)] leading-none">
              {isIndonesian ? "Portofolio Aset" : "Portfolio Holdings"}
            </h3>
            <span
              className="text-[9.5px] font-semibold px-2 py-0.2 rounded-full border leading-none"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(0, 0, 0, 0.04)",
                borderColor: "var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              {totalAssetCount}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("medium");
            onOpenAddAsset();
          }}
          className="w-6.5 h-6.5 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer shadow-xs select-none"
          style={{
            background: isDark ? "#ffffff" : "#18181b",
            color: isDark ? "#000000" : "#ffffff",
          }}
          title={isIndonesian ? "Tambah Aset" : "Add Asset"}
          aria-label="Add Asset"
        >
          <Plus size={13} strokeWidth={2.8} />
        </button>
      </div>

      {/* ── 2. Compact Search & Filter ── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {categoryTabs.map((tab) => {
            const isActive = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setCategoryFilter(tab.id);
                }}
                className="h-6.5 px-2.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 active:scale-[0.96] flex items-center"
                style={{
                  background: isActive
                    ? isDark
                      ? "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.84) 48%, rgba(244,245,247,0.90) 100%)"
                      : "#18181b"
                    : controlBg,
                  color: isActive
                    ? isDark
                      ? "#000000"
                      : "#ffffff"
                    : "var(--text-tertiary)",
                  border: isActive
                    ? isDark
                      ? "1px solid rgba(255, 255, 255, 0.95)"
                      : "1px solid #18181b"
                    : controlBorder,
                  boxShadow: isActive
                    ? isDark
                      ? "inset 0 1px 0 #ffffff, 0 2px 6px rgba(0, 0, 0, 0.25)"
                      : "0 2px 6px rgba(0, 0, 0, 0.14)"
                    : "none",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          className="flex items-center gap-2 px-3 h-8 rounded-xl transition-all"
          style={{
            background: controlBg,
            border: controlBorder,
            boxShadow: controlShadow,
          }}
        >
          <Search
            size={12.5}
            className="text-[var(--text-tertiary)] shrink-0"
            strokeWidth={1.8}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isIndonesian ? "Cari ticker, aset..." : "Filter ticker, name..."
            }
            className="flex-1 bg-transparent text-[11px] font-medium outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setSearchQuery("");
              }}
              className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5"
              title={isIndonesian ? "Hapus pencarian" : "Clear search"}
              aria-label="Clear Search"
            >
              <X size={11} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Ultra-Sleek Holdings Cards (Dengan Metrik Lengkap) ── */}
      {filteredHoldings.length === 0 ? (
        <div
          className="py-8 px-4 text-center rounded-2xl space-y-1.5"
          style={{
            background: controlBg,
            border: controlBorder,
            boxShadow: controlShadow,
          }}
        >
          <Coins className="w-5 h-5 mx-auto text-[var(--text-tertiary)] stroke-[1.6]" />
          <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
            {searchQuery
              ? isIndonesian
                ? "Tidak ada aset yang cocok"
                : "No matching assets found"
              : isIndonesian
                ? "Belum ada aset di kategori ini"
                : "No holdings in this category"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Mobile Sleek Single-Deck Cards (< md) */}
          <div className="space-y-1.5 md:hidden">
            {filteredHoldings.map((h) => {
              const currentPrice = h.current_price || h.avg_buy_price || 0;
              const buyPrice = h.avg_buy_price || currentPrice;
              const totalVal = h.valuation.marketValue;
              const totalCost = (h.units || 0) * buyPrice;
              const pnl = h.valuation.floatingPnL ?? totalVal - totalCost;
              const pnlPct = h.valuation.floatingPnLPct;
              const categoryBadge = getCategoryBadgeLabel(h, isIndonesian);
              const weightPct =
                totalGrossAssets > 0
                  ? Math.min(
                      Math.round((totalVal / totalGrossAssets) * 100),
                      100,
                    )
                  : 0;

              return (
                <div
                  key={h.id}
                  onClick={() => {
                    triggerHaptic("light");
                    if (h.isUsdt) {
                      onOpenUsdtDetail();
                    } else {
                      onOpenHoldingDetail(h);
                    }
                  }}
                  className="px-3 py-2 rounded-2xl flex flex-col justify-between gap-1.5 cursor-pointer active:scale-[0.985] transition-all select-none relative overflow-hidden group"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                  }}
                >
                  {/* Baris 1: Header (Ikon, Ticker, Badge, Nilai Pasar, & Harga Terkini) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.06)"
                            : "rgba(0, 0, 0, 0.04)",
                          border: controlBorder,
                          color: "var(--text-primary)",
                        }}
                      >
                        {h.isUsdt ? (
                          <span>₮</span>
                        ) : (
                          <IconRenderer
                            icon={h.icon || "TrendingUp"}
                            size="w-3.5 h-3.5"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 pr-1">
                        <div className="flex items-center gap-1.5 leading-none">
                          <span className="font-bold text-[12.5px] text-[var(--text-primary)] font-mono">
                            {h.symbol}
                          </span>
                          <span
                            className="px-1 py-0.2 rounded text-[7.5px] font-semibold uppercase tracking-wider border leading-none"
                            style={{
                              background: isDark
                                ? "rgba(255, 255, 255, 0.04)"
                                : "rgba(0, 0, 0, 0.03)",
                              borderColor: "var(--glass-border)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {categoryBadge}
                          </span>
                          {/* Freshness Status Badge */}
                          {h.is_custom_price || h.price_source === "manual" ? (
                            <span
                              className="px-1 py-0.2 rounded text-[7.5px] font-semibold uppercase tracking-wider border leading-none"
                              style={{
                                background: isDark
                                  ? "rgba(255, 255, 255, 0.06)"
                                  : "rgba(0, 0, 0, 0.04)",
                                borderColor: "var(--glass-border)",
                                color: "var(--text-secondary)",
                              }}
                              title={isIndonesian ? "Harga kustom/manual" : "Custom/manual price"}
                            >
                              {isIndonesian ? "Manual" : "Custom"}
                            </span>
                          ) : h.price_source === "live" ? (
                            <span
                              className="px-1 py-0.2 rounded text-[7.5px] font-semibold uppercase tracking-wider border leading-none flex items-center gap-0.5"
                              style={{
                                background: isDark
                                  ? "rgba(255, 255, 255, 0.04)"
                                  : "rgba(0, 0, 0, 0.03)",
                                borderColor: "var(--glass-border)",
                                color: "var(--text-tertiary)",
                              }}
                              title={isIndonesian ? "Harga pasar live" : "Live market price"}
                            >
                              <span className="w-1 h-1 rounded-full bg-[var(--text-primary)] opacity-70" />
                              Live
                            </span>
                          ) : h.price_source === "cache" ? (
                            <span
                              className="px-1 py-0.2 rounded text-[7.5px] font-semibold uppercase tracking-wider border leading-none"
                              style={{
                                background: isDark
                                  ? "rgba(255, 255, 255, 0.04)"
                                  : "rgba(0, 0, 0, 0.03)",
                                borderColor: "var(--glass-border)",
                                color: "var(--text-tertiary)",
                              }}
                              title={isIndonesian ? "Harga offline/tersimpan" : "Cached offline price"}
                            >
                              {isIndonesian ? "Offline" : "Cached"}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-1 leading-none font-medium">
                          {h.name}
                        </p>
                      </div>
                    </div>

                    {/* Sisi Kanan Atas: Nilai Pasar & Harga Saat Ini */}
                    <div className="text-right shrink-0">
                      <div className="font-bold text-[13px] text-[var(--text-primary)] tabular-nums leading-none">
                        {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(totalVal)}
                      </div>
                      <div className="text-[9.5px] text-[var(--text-secondary)] font-medium tabular-nums mt-1 leading-none">
                        {formatNativeQuote(h, formatWithPreferred)}
                      </div>
                    </div>
                  </div>

                  {/* Baris 2: Micro-Telemetry Lengkap (Unit, DCA Beli, Floating PnL, & Bobot) */}
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] pt-0.5 leading-none">
                    {/* Metrik Kiri: Jumlah Unit & Harga Beli Rata-Rata (DCA) */}
                    <div className="flex items-center gap-1.5 tabular-nums">
                      <span>
                        {isIndonesian ? "Jml:" : "Qty:"}{" "}
                        <strong className="font-semibold text-[var(--text-secondary)]">
                          {formatHoldingUnits(h.units)}
                        </strong>
                      </span>
                      <span className="opacity-30">·</span>
                      <span>
                        {isIndonesian ? "Beli:" : "DCA:"}{" "}
                        <strong className="font-medium text-[var(--text-secondary)]">
                          {formatWithPreferred(buyPrice)}
                        </strong>
                      </span>
                    </div>

                    {/* Metrik Kanan: Nominal PnL, Persentase PnL, & Bobot Portofolio */}
                    <div className="flex items-center gap-1 tabular-nums justify-end">
                      <span
                        className="font-medium"
                        style={{
                          color:
                            pnlPct >= 0
                              ? "var(--text-primary)"
                              : "var(--text-tertiary)",
                        }}
                      >
                        {pnl >= 0 ? "+" : "−"}
                        {formatWithPreferred(Math.abs(pnl))} ({pnlPct >= 0 ? "+" : ""}
                        {pnlPct.toFixed(1)}%)
                      </span>
                      <span className="opacity-30">·</span>
                      <span className="font-semibold text-[var(--text-secondary)]">
                        {weightPct}%
                      </span>
                    </div>
                  </div>

                  {/* Allocation Hairline Indicator */}
                  <div className="w-full h-[1.5px] rounded-full bg-black/[0.04] dark:bg-white/[0.05] overflow-hidden -mb-0.5">
                    <div
                      style={{ width: `${Math.max(weightPct, 2)}%` }}
                      className="h-full rounded-full bg-[var(--text-primary)] transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop/Tablet Responsive Table (>= md) */}
          <div
            className="hidden md:block overflow-x-auto rounded-2xl transition-all"
            style={{
              background: controlBg,
              border: controlBorder,
              boxShadow: controlShadow,
            }}
          >
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--glass-border)]/50 text-[9px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">
                  <th className="py-2 px-3">
                    {isIndonesian ? "Aset" : "Asset"}
                  </th>
                  <th className="py-2 px-2.5">
                    {isIndonesian ? "Kategori" : "Category"}
                  </th>
                  <th className="py-2 px-2.5 text-right">
                    {isIndonesian ? "Kepemilikan" : "Units"}
                  </th>
                  <th className="py-2 px-2.5 text-right">
                    {isIndonesian ? "Harga Beli" : "Buy Price"}
                  </th>
                  <th className="py-2 px-2.5 text-right">
                    {isIndonesian ? "Harga Terkini" : "Live Price"}
                  </th>
                  <th className="py-2 px-2.5 text-right">
                    {isIndonesian ? "Nilai Pasar" : "Market Value"}
                  </th>
                  <th className="py-2 px-2.5 text-right">Floating PnL</th>
                  <th className="py-2 px-2.5 w-24">
                    {isIndonesian ? "Bobot" : "Weight"}
                  </th>
                  <th className="py-2 px-3 text-center">
                    {isIndonesian ? "Aksi" : "Action"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]/40">
                {filteredHoldings.map((h) => {
                  const currentPrice = h.current_price || h.avg_buy_price || 0;
                  const buyPrice = h.avg_buy_price || currentPrice;
                  const totalVal = h.valuation.marketValue;
                  const totalCost = (h.units || 0) * buyPrice;
                  const pnl = h.valuation.floatingPnL ?? totalVal - totalCost;
                  const pnlPct = h.valuation.floatingPnLPct;
                  const categoryBadge = getCategoryBadgeLabel(h, isIndonesian);
                  const weightPct =
                    totalGrossAssets > 0
                      ? Math.min(
                          Math.round((totalVal / totalGrossAssets) * 100),
                          100,
                        )
                      : 0;

                  return (
                    <tr
                      key={h.id}
                      onClick={() => {
                        triggerHaptic("light");
                        if (h.isUsdt) {
                          onOpenUsdtDetail();
                        } else {
                          onOpenHoldingDetail(h);
                        }
                      }}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer select-none"
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[11.5px] text-[var(--text-primary)] font-mono">
                            {h.symbol}
                          </span>
                          {h.price_source === "manual" ? (
                            <span
                              className="px-1 py-0.2 rounded text-[7.5px] font-semibold uppercase tracking-wider border leading-none"
                              style={{
                                background: isDark
                                  ? "rgba(255, 255, 255, 0.04)"
                                  : "rgba(0, 0, 0, 0.03)",
                                borderColor: "var(--glass-border)",
                                color: "var(--text-tertiary)",
                              }}
                              title={isIndonesian ? "Harga manual / terkunci" : "Manual custom price"}
                            >
                              {isIndonesian ? "Manual" : "Custom"}
                            </span>
                          ) : h.price_source === "live" ? (
                            <span
                              className="px-1 py-0.2 rounded text-[7.5px] font-semibold uppercase tracking-wider border leading-none flex items-center gap-0.5"
                              style={{
                                background: isDark
                                  ? "rgba(255, 255, 255, 0.04)"
                                  : "rgba(0, 0, 0, 0.03)",
                                borderColor: "var(--glass-border)",
                                color: "var(--text-tertiary)",
                              }}
                              title={isIndonesian ? "Harga pasar live" : "Live market price"}
                            >
                              <span className="w-1 h-1 rounded-full bg-[var(--text-primary)] opacity-70" />
                              Live
                            </span>
                          ) : h.price_source === "cache" ? (
                            <span
                              className="px-1 py-0.2 rounded text-[7.5px] font-semibold uppercase tracking-wider border leading-none"
                              style={{
                                background: isDark
                                  ? "rgba(255, 255, 255, 0.04)"
                                  : "rgba(0, 0, 0, 0.03)",
                                borderColor: "var(--glass-border)",
                                color: "var(--text-tertiary)",
                              }}
                              title={isIndonesian ? "Harga offline/tersimpan" : "Cached offline price"}
                            >
                              {isIndonesian ? "Offline" : "Cached"}
                            </span>
                          ) : null}
                          <span className="text-[9.5px] text-[var(--text-tertiary)] truncate max-w-[90px]">
                            {h.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-2 px-2.5">
                        <span
                          className="px-1.5 py-0.2 rounded text-[7.5px] font-semibold uppercase tracking-wider border"
                          style={{
                            background: isDark
                              ? "rgba(255, 255, 255, 0.04)"
                              : "rgba(0, 0, 0, 0.03)",
                            borderColor: "var(--glass-border)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {categoryBadge}
                        </span>
                      </td>

                      <td className="py-2 px-2.5 text-right font-medium text-[var(--text-primary)] tabular-nums">
                        {formatHoldingUnits(h.units)}
                      </td>

                      <td className="py-2 px-2.5 text-right text-[var(--text-secondary)] tabular-nums text-[10px]">
                        {formatWithPreferred(buyPrice)}
                      </td>

                      <td className="py-2 px-2.5 text-right">
                        <div className="tabular-nums font-semibold text-[var(--text-primary)]">
                          {formatNativeQuote(h, formatWithPreferred)}
                        </div>
                      </td>

                      <td className="py-2 px-2.5 text-right font-bold text-[var(--text-primary)] tabular-nums">
                        {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(totalVal)}
                      </td>

                      <td className="py-2 px-2.5 text-right tabular-nums">
                        <span
                          className="font-medium text-[10px]"
                          style={{
                            color:
                              pnlPct >= 0
                                ? "var(--text-primary)"
                                : "var(--text-tertiary)",
                          }}
                        >
                          {pnl >= 0 ? "+" : "−"}
                          {Math.abs(pnlPct).toFixed(1)}%
                        </span>
                      </td>

                      <td className="py-2 px-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden">
                            <div
                              style={{ width: `${Math.max(weightPct, 2)}%` }}
                              className="h-full rounded-full bg-[var(--text-primary)]"
                            />
                          </div>
                          <span className="text-[8.5px] font-semibold text-[var(--text-tertiary)] w-5 text-right">
                            {weightPct}%
                          </span>
                        </div>
                      </td>

                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic("light");
                            if (h.isUsdt) {
                              onOpenUsdtDetail();
                            } else {
                              onOpenHoldingDetail(h);
                            }
                          }}
                          className="px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all cursor-pointer active:scale-95"
                          style={{
                            background: controlBg,
                            border: controlBorder,
                            color: "var(--text-primary)",
                          }}
                        >
                          {isIndonesian ? "Buka" : "Open"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. Compact Consolidated Balance Sheet Pill Button ── */}
      {totalAssetCount > 0 && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onOpenConsolidatedDrawer();
          }}
          className="w-full h-8.5 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-semibold active:scale-[0.985] transition-all cursor-pointer"
          style={{
            background: controlBg,
            border: controlBorder,
            boxShadow: controlShadow,
            color: "var(--text-secondary)",
          }}
        >
          <Layers size={12} strokeWidth={1.8} />
          <span>
            {isIndonesian
              ? `Neraca Lengkap (${totalAssetCount} Aset & Liabilitas)`
              : `Consolidated Balance Sheet (${totalAssetCount})`}
          </span>
          <ChevronRight size={12} strokeWidth={2} className="opacity-60" />
        </button>
      )}
    </section>
  );
}
