import { useState } from "react";
import {
  Search,
  X,
  Wallet,
  TrendingUp,
  Landmark,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import { formatHoldingUnits } from "../../lib/utils";
import { calculateHoldingValuation } from "../../lib/marketPriceService";
import { triggerHaptic } from "../../lib/haptics";
import { useCurrency } from "../../contexts/CurrencyContext";
import type { InvestmentHolding, Wallet as WalletType } from "../../types";

export interface ConsolidatedBalanceSheetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  netWorth: number;
  totalGrossAssets: number;
  liabilitiesTotal: number;
  liquidAssetsTotal: number;
  growthAssetsTotal: number;
  fixedAssetsTotal: number;
  usdtPref: { units: number; rate: number; costBasis: number };
  usdtMarketValue: number;
  usdtFloatingPnLPct: number;
  suggestedUsdtUnits: number;
  recordedCryptoBalance: number;
  wallets: WalletType[];
  balancesById?: Record<string, number>;
  liquidHoldings: InvestmentHolding[];
  fixedHoldings: InvestmentHolding[];
  onOpenUsdtDetail: () => void;
  onOpenHoldingDetail: (holding: InvestmentHolding) => void;
  isStealthMode: boolean;
  isIndonesian: boolean;
  isDark: boolean;
}

export function ConsolidatedBalanceSheetDrawer({
  isOpen,
  onClose,
  netWorth,
  totalGrossAssets,
  liabilitiesTotal,
  liquidAssetsTotal,
  growthAssetsTotal,
  fixedAssetsTotal,
  usdtPref,
  usdtMarketValue,
  usdtFloatingPnLPct,
  suggestedUsdtUnits,
  recordedCryptoBalance,
  wallets,
  balancesById,
  liquidHoldings,
  fixedHoldings,
  onOpenUsdtDetail,
  onOpenHoldingDetail,
  isStealthMode,
  isIndonesian,
  isDark,
}: ConsolidatedBalanceSheetDrawerProps) {
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<
    "all" | "tier1" | "tier2" | "tier3" | "liabilities"
  >("all");

  const handleClose = () => {
    onClose();
    setSearch("");
    setTierFilter("all");
  };

  const query = search.trim().toLowerCase();

  // Determine if crypto/USDT wallet is classified as investment
  const isCryptoClassifiedAsInvestment = wallets.some(
    (w) =>
      (w.name.toLowerCase().includes("usdt") ||
        w.name.toLowerCase().includes("crypto") ||
        w.name.toLowerCase().includes("tether") ||
        w.name.toLowerCase().includes("binance") ||
        w.name.toLowerCase().includes("tokocrypto") ||
        w.name.toLowerCase().includes("bybit") ||
        w.name.toLowerCase().includes("indodax") ||
        w.name.toLowerCase().includes("pintu")) &&
      w.classification === "investment",
  );

  // Tier 1 items
  const showUsdtInTier1 =
    !isCryptoClassifiedAsInvestment &&
    (usdtPref.units > 0 || recordedCryptoBalance > 0) &&
    (!query || "usdt".includes(query) || "tether".includes(query));

  // Tier 2 items
  const showUsdtInTier2 =
    isCryptoClassifiedAsInvestment &&
    (usdtPref.units > 0 || recordedCryptoBalance > 0) &&
    (!query || "usdt".includes(query) || "tether".includes(query));

  const showUsdt = showUsdtInTier1 || showUsdtInTier2;

  const cashWallets = wallets.filter((w) => {
    const bal = balancesById ? (balancesById[w.id] ?? 0) : Number(w.balance || 0);
    const isCrypto =
      w.name.toLowerCase().includes("crypto") ||
      w.name.toLowerCase().includes("usdt") ||
      w.name.toLowerCase().includes("tether") ||
      w.name.toLowerCase().includes("binance") ||
      w.name.toLowerCase().includes("tokocrypto") ||
      w.name.toLowerCase().includes("bybit") ||
      w.name.toLowerCase().includes("indodax") ||
      w.name.toLowerCase().includes("pintu");
    return (
      bal > 0 &&
      w.classification !== "credit" &&
      w.classification !== "loan" &&
      !isCrypto &&
      (!query || w.name.toLowerCase().includes(query))
    );
  });
  const hasTier1 = showUsdtInTier1 || cashWallets.length > 0;

  // Tier 2 items
  const growthItems = liquidHoldings.filter(
    (h) =>
      (h.asset_type === "stock" ||
        (h.asset_type === "crypto" && h.symbol?.toUpperCase() !== "USDT") ||
        h.asset_type === "mutual_fund" ||
        h.asset_type === "bond") &&
      (!query ||
        h.name.toLowerCase().includes(query) ||
        h.symbol.toLowerCase().includes(query)),
  );
  const hasTier2 = showUsdtInTier2 || growthItems.length > 0;

  // Tier 3 items
  const fixedItems = fixedHoldings
    .concat(liquidHoldings.filter((h) => h.asset_type === "gold"))
    .filter(
      (h) =>
        !query ||
        h.name.toLowerCase().includes(query) ||
        h.symbol.toLowerCase().includes(query),
    );
  const hasTier3 = fixedItems.length > 0;

  // Liabilities (strictly debtAmt > 0)
  const liabilityWallets = wallets
    .map((w) => {
      const bal = balancesById ? (balancesById[w.id] ?? 0) : Number(w.balance || 0);
      const debtAmt = Math.abs(
        bal < 0
          ? bal
          : w.classification === "credit" || w.classification === "loan"
            ? bal
            : 0,
      );
      return { wallet: w, debtAmt };
    })
    .filter(
      (item) =>
        item.debtAmt > 0 &&
        (!query || item.wallet.name.toLowerCase().includes(query)),
    );
  const hasLiabilities = liabilityWallets.length > 0;

  const isSearching = Boolean(query);
  const totalVisibleCount =
    (showUsdt ? 1 : 0) +
    cashWallets.length +
    growthItems.length +
    fixedItems.length +
    liabilityWallets.length;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={
        isIndonesian
          ? "Neraca Aset & Liabilitas Lengkap"
          : "Consolidated Balance Sheet"
      }
    >
      <div className="p-4 sm:p-5 space-y-4 select-none">
        {/* Executive Net Worth Summary Banner */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border border-[var(--glass-border)] flex items-center justify-between"
          style={{
            background: "var(--glass-fill)",
            boxShadow: isDark
              ? "inset 0 1px 0 rgba(255, 255, 255, 0.05)"
              : "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div>
            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider block">
              {isIndonesian
                ? "Kekayaan Bersih Konsolidasi"
                : "Consolidated Net Worth"}
            </span>
            <p className=" text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mt-0.5 tracking-tight">
              {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(netWorth)}
            </p>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
              {isIndonesian ? "Total Aset Kotor" : "Total Gross Assets"}
            </span>
            <span className=" text-[12.5px] font-semibold text-[var(--text-primary)] mt-0.5">
              {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(totalGrossAssets)}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
              {isIndonesian ? "Liabilitas: " : "Debt: "}
              <span className=" font-medium text-[var(--text-secondary)]">
                {isStealthMode ? "••••" : formatWithPreferred(liabilitiesTotal)}
              </span>
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border border-[var(--glass-border)] transition-colors"
          style={{
            background: "var(--glass-fill)",
            boxShadow: isDark
              ? "inset 0 1px 0 rgba(255, 255, 255, 0.03)"
              : undefined,
          }}
        >
          <Search size={15} className="text-[var(--text-tertiary)] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isIndonesian
                ? "Cari aset atau liabilitas (USDT, Kas, Saham, Utang)..."
                : "Search assets or debt (USDT, Cash, Stock, Loan)..."
            }
            className="bg-transparent text-[12.5px] font-sans font-medium text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none w-full"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tier Filter Tabs (Monochrome Frosted Glass Rule 3 Compliant) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { key: "all", label: isIndonesian ? "Semua Tier" : "All Tiers" },
            {
              key: "tier1",
              label: isIndonesian ? "Tier 1: Likuid" : "Tier 1: Liquid",
            },
            {
              key: "tier2",
              label: isIndonesian ? "Tier 2: Pasar" : "Tier 2: Growth",
            },
            {
              key: "tier3",
              label: isIndonesian ? "Tier 3: Riil" : "Tier 3: Fixed",
            },
            {
              key: "liabilities",
              label: isIndonesian ? "Liabilitas" : "Liabilities",
            },
          ].map((t) => {
            const isActive = tierFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setTierFilter(t.key as any);
                }}
                style={
                  isActive
                    ? {
                        background: isDark
                          ? "rgba(255, 255, 255, 0.10)"
                          : "rgba(0, 0, 0, 0.08)",
                        borderColor: isDark
                          ? "rgba(255, 255, 255, 0.18)"
                          : "rgba(0, 0, 0, 0.14)",
                        boxShadow: isDark
                          ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.25)"
                          : "0 1px 2px rgba(0, 0, 0, 0.05)",
                        color: "var(--text-primary)",
                      }
                    : {
                        background: "var(--glass-fill)",
                        borderColor: "var(--glass-border)",
                        color: "var(--text-tertiary)",
                        opacity: 0.7,
                      }
                }
                className="px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer border hover:opacity-100 hover:text-[var(--text-primary)]"
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Grouped Content */}
        <div className="space-y-4">
          {/* Search Zero Results State */}
          {isSearching && totalVisibleCount === 0 && (
            <div className="py-8 px-4 text-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] space-y-1.5">
              <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                {isIndonesian ? "Tidak Ada Hasil" : "No Results Found"}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)] max-w-xs mx-auto">
                {isIndonesian
                  ? `Tidak ada aset atau liabilitas yang cocok dengan "${search}".`
                  : `No assets or debt matched "${search}".`}
              </p>
            </div>
          )}

          {/* TIER 1 SECTION */}
          {((tierFilter === "all" && hasTier1) || tierFilter === "tier1") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Tier 1 · Aset Lancar & Kas"
                    : "Tier 1 · Liquid & Current"}
                </span>
                <span className=" text-[11px] font-bold text-[var(--text-primary)]">
                  {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(liquidAssetsTotal)}
                </span>
              </div>

              {/* USDT Row */}
              {showUsdtInTier1 && (
                <div
                  onClick={() => {
                    handleClose();
                    onOpenUsdtDetail();
                  }}
                  className="p-3 sm:p-3.5 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform border border-[var(--glass-border)] hover:bg-[var(--glass-fill-strong)]"
                  style={{ background: "var(--glass-fill)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)] shrink-0  font-bold text-sm">
                      ₮
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[13px] text-[var(--text-primary)]">
                          USDT (Tether)
                        </span>
                        <span className="text-[8.5px] px-1.5 py-0.5 rounded font-sans font-semibold tracking-wider bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)] uppercase">
                          STABLECOIN
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5 font-sans">
                        {usdtPref.units > 0
                          ? `${formatHoldingUnits(usdtPref.units)} USDT · @${formatWithPreferred(usdtPref.rate)}`
                          : `Wallet linked · ${formatHoldingUnits(suggestedUsdtUnits)} USDT`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-[13px]  font-bold text-[var(--text-primary)] block leading-tight">
                      {isStealthMode
                        ? `${currencyMeta.symbol} ••••••••`
                        : formatWithPreferred(usdtMarketValue)}
                    </span>
                    <div className="flex items-center justify-end gap-1.5 text-[10px] mt-0.5 font-sans">
                      <span
                        className=" font-medium"
                        style={{
                          color:
                            usdtFloatingPnLPct >= 0
                              ? "var(--text-primary)"
                              : "var(--text-tertiary)",
                        }}
                      >
                        {usdtFloatingPnLPct >= 0 ? "+" : ""}
                        {usdtFloatingPnLPct.toFixed(1)}%
                      </span>
                      <span className="text-[var(--text-tertiary)] opacity-40">
                        ·
                      </span>
                      <span className="text-[var(--text-tertiary)] ">
                        {(
                          (usdtMarketValue / (totalGrossAssets || 1)) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cash Wallets */}
              {cashWallets.map((w) => (
                <div
                  key={w.id}
                  className="p-3 sm:p-3.5 rounded-2xl flex items-center justify-between border border-[var(--glass-border)]"
                  style={{ background: "var(--glass-fill)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)] shrink-0">
                      <Wallet size={16} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[13px] text-[var(--text-primary)] truncate">
                        {w.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)] truncate font-sans">
                        {w.classification === "investment" ||
                        w.name.toLowerCase().includes("rdn") ||
                        w.name.toLowerCase().includes("ajaib") ||
                        w.name.toLowerCase().includes("stockbit") ||
                        w.name.toLowerCase().includes("bibit") ||
                        w.name.toLowerCase().includes("pluang")
                          ? isIndonesian
                            ? "Kas RDN / Kustodi Broker"
                            : "Uninvested Broker Cash"
                          : isIndonesian
                            ? "Kas / Rekening Bank"
                            : "Cash / Bank"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right  shrink-0 pl-2">
                    <span className="text-[13px] font-bold text-[var(--text-primary)]">
                      {isStealthMode
                        ? `${currencyMeta.symbol} ••••••••`
                        : formatWithPreferred(
                            balancesById
                              ? balancesById[w.id] ?? 0
                              : Number(w.balance || 0),
                          )}
                    </span>
                  </div>
                </div>
              ))}

              {/* Tier 1 Empty State */}
              {tierFilter === "tier1" && !hasTier1 && (
                <div className="py-6 px-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] text-center space-y-1.5">
                  <div className="w-9 h-9 rounded-xl mx-auto flex items-center justify-center bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-tertiary)]">
                    <Wallet size={16} strokeWidth={1.5} />
                  </div>
                  <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
                    {isIndonesian
                      ? "Belum ada saldo kas atau USDT"
                      : "No cash or USDT balance registered"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TIER 2 SECTION */}
          {((tierFilter === "all" && hasTier2) || tierFilter === "tier2") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Tier 2 · Pasar & Pertumbuhan"
                    : "Tier 2 · Market & Growth"}
                </span>
                <span className=" text-[11px] font-bold text-[var(--text-primary)]">
                  {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(growthAssetsTotal)}
                </span>
              </div>

              {/* USDT Row when classified as Investment */}
              {showUsdtInTier2 && (
                <div
                  onClick={() => {
                    handleClose();
                    onOpenUsdtDetail();
                  }}
                  className="p-3 sm:p-3.5 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform border border-[var(--glass-border)] hover:bg-[var(--glass-fill-strong)]"
                  style={{ background: "var(--glass-fill)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)] shrink-0  font-bold text-sm">
                      ₮
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[13px] text-[var(--text-primary)]">
                          USDT (Tether)
                        </span>
                        <span className="text-[8.5px] px-1.5 py-0.5 rounded font-sans font-semibold tracking-wider bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)] uppercase">
                          INVESTMENT
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5 font-sans">
                        {usdtPref.units > 0
                          ? `${formatHoldingUnits(usdtPref.units)} USDT · @${formatWithPreferred(usdtPref.rate)}`
                          : `Wallet linked · ${formatHoldingUnits(suggestedUsdtUnits)} USDT`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-[13px]  font-bold text-[var(--text-primary)] block leading-tight">
                      {isStealthMode
                        ? `${currencyMeta.symbol} ••••••••`
                        : formatWithPreferred(usdtMarketValue)}
                    </span>
                  </div>
                </div>
              )}

              {growthItems.map((h) => {
                const val = calculateHoldingValuation(h);
                const weight =
                  totalGrossAssets > 0
                    ? (val.marketValue / totalGrossAssets) * 100
                    : 0;
                return (
                  <div
                    key={h.id}
                    onClick={() => {
                      handleClose();
                      onOpenHoldingDetail(h);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform border border-[var(--glass-border)] hover:bg-[var(--glass-fill-strong)]"
                    style={{ background: "var(--glass-fill)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)] shrink-0">
                        <IconRenderer
                          icon={h.icon || "TrendingUp"}
                          size="w-4.5 h-4.5"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-[13px] text-[var(--text-primary)] truncate">
                            {h.symbol}
                          </span>
                          <span className="text-[8.5px] px-1.5 py-0.5 rounded font-sans font-semibold tracking-wider bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)] uppercase">
                            {h.asset_type.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5 font-sans">
                          {h.name} · {formatHoldingUnits(h.units)}{" "}
                          {isIndonesian ? "unit" : "units"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <span className="text-[13px]  font-bold text-[var(--text-primary)] block leading-tight">
                        {isStealthMode
                          ? `${currencyMeta.symbol} ••••••••`
                          : formatWithPreferred(val.marketValue)}
                      </span>
                      <div className="flex items-center justify-end gap-1.5 text-[10px] mt-0.5 font-sans">
                        <span
                          className=" font-medium"
                          style={{
                            color:
                              val.floatingPnLPct >= 0
                                ? "var(--text-primary)"
                                : "var(--text-tertiary)",
                          }}
                        >
                          {val.floatingPnLPct >= 0 ? "+" : ""}
                          {val.floatingPnLPct.toFixed(1)}%
                        </span>
                        <span className="text-[var(--text-tertiary)] opacity-40">
                          ·
                        </span>
                        <span className="text-[var(--text-tertiary)] ">
                          {weight.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Tier 2 Empty State */}
              {tierFilter === "tier2" && !hasTier2 && (
                <div className="py-6 px-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] text-center space-y-1.5">
                  <div className="w-9 h-9 rounded-xl mx-auto flex items-center justify-center bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-tertiary)]">
                    <TrendingUp size={16} strokeWidth={1.5} />
                  </div>
                  <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
                    {isIndonesian
                      ? "Belum ada aset pasar atau saham terdaftar"
                      : "No market equities or crypto registered"}
                  </p>
                  <p className="text-[10.5px] text-[var(--text-tertiary)]">
                    {isIndonesian
                      ? "Tambahkan saham, reksa dana, obligasi, atau kripto melalui tombol (+)."
                      : "Add stocks, funds, bonds, or crypto via the (+) button."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TIER 3 SECTION */}
          {((tierFilter === "all" && hasTier3) || tierFilter === "tier3") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Tier 3 · Aset Tetap & Riil"
                    : "Tier 3 · Fixed & Tangibles"}
                </span>
                <span className=" text-[11px] font-bold text-[var(--text-primary)]">
                  {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(fixedAssetsTotal)}
                </span>
              </div>

              {fixedItems.map((h) => {
                const val = calculateHoldingValuation(h);
                return (
                  <div
                    key={h.id}
                    onClick={() => {
                      handleClose();
                      onOpenHoldingDetail(h);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform border border-[var(--glass-border)] hover:bg-[var(--glass-fill-strong)]"
                    style={{ background: "var(--glass-fill)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)] shrink-0">
                        <IconRenderer
                          icon={h.icon || "Landmark"}
                          size="w-4.5 h-4.5"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[13px] text-[var(--text-primary)] truncate">
                          {h.name}
                        </p>
                        <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5 font-sans">
                          {h.symbol} ·{" "}
                          {h.asset_type.replace("_", " ").toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right  shrink-0 pl-2">
                      <span className="text-[13px] font-bold text-[var(--text-primary)]">
                        {isStealthMode
                          ? `${currencyMeta.symbol} ••••••••`
                          : formatWithPreferred(val.marketValue)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Tier 3 Empty State */}
              {tierFilter === "tier3" && !hasTier3 && (
                <div className="py-6 px-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] text-center space-y-1.5">
                  <div className="w-9 h-9 rounded-xl mx-auto flex items-center justify-center bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-tertiary)]">
                    <Landmark size={16} strokeWidth={1.5} />
                  </div>
                  <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
                    {isIndonesian
                      ? "Belum ada emas fisik atau aset tetap terdaftar"
                      : "No tangible assets or precious metals registered"}
                  </p>
                  <p className="text-[10.5px] text-[var(--text-tertiary)]">
                    {isIndonesian
                      ? "Tambahkan properti, emas fisik, atau aset riil lainnya."
                      : "Add property, physical gold, or tangible assets."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* LIABILITIES SECTION */}
          {(tierFilter === "all" || tierFilter === "liabilities") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Liabilitas & Kewajiban Utang"
                    : "Liabilities & Debt"}
                </span>
                <span className=" text-[11px] font-bold text-[var(--text-primary)]">
                  {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(liabilitiesTotal)}
                </span>
              </div>

              {liabilityWallets.map(({ wallet: w, debtAmt }) => (
                <div
                  key={w.id}
                  className="p-3 sm:p-3.5 rounded-2xl flex items-center justify-between border border-[var(--glass-border)]"
                  style={{ background: "var(--glass-fill)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)] shrink-0">
                      <ShieldAlert size={16} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[13px] text-[var(--text-primary)] truncate">
                        {w.name}
                      </p>
                      <p className="text-[10.5px] text-[var(--text-tertiary)] uppercase font-semibold tracking-wider font-sans">
                        {w.classification}
                      </p>
                    </div>
                  </div>
                  <div className="text-right  shrink-0 pl-2">
                    <span className="text-[13px] font-bold text-[var(--text-primary)]">
                      {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(debtAmt)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Zero Liabilities State */}
              {!hasLiabilities && !isSearching && (
                <div
                  className="p-3.5 rounded-2xl border border-[var(--glass-border)] flex items-center justify-between"
                  style={{ background: "var(--glass-fill)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.04] text-[var(--text-secondary)] border border-[var(--glass-border)] shrink-0">
                      <ShieldCheck size={16} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                        {isIndonesian
                          ? "Bebas Kewajiban Utang"
                          : "Zero Debt Obligations"}
                      </p>
                      <p className="text-[10.5px] text-[var(--text-tertiary)] font-sans">
                        {isIndonesian
                          ? "Solvabilitas 100% · Portofolio bersih"
                          : "100% Solvency · No active liabilities"}
                      </p>
                    </div>
                  </div>
                  <span className=" text-[11.5px] font-semibold text-[var(--text-tertiary)]">
                    {formatWithPreferred(0)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            handleClose();
          }}
          className="w-full py-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] hover:bg-[var(--glass-fill-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[12px] font-semibold tracking-wide active:scale-[0.99] transition-all cursor-pointer mt-2"
        >
          {isIndonesian ? "Tutup Neraca" : "Close Sheet"}
        </button>
      </div>
    </BottomSheet>
  );
}
