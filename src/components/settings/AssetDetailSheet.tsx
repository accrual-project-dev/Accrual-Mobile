import React, { useState, useMemo } from "react";
import {
  Plus,
  Minus,
  Edit3,
  Trash2,
  Check,
  X,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import { GlassSelect, type GlassSelectOption } from "../ui/GlassSelect";
import { formatHoldingUnits } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useWallets } from "../../hooks/useWallets";
import {
  useAddTransaction,
  useAllTransactions,
} from "../../hooks/useTransactions";
import {
  isInvestmentOrCryptoWallet,
  estimateHistoricalAssetPrice,
} from "../../lib/holdingSyncEngine";
import {
  recordHoldingActivity,
  undoHoldingActivity,
  setHoldingDirectUnits,
  getHoldingActivities,
  generateAssetHistoryCurve,
  calculateHoldingValuation,
  upsertHolding,
} from "../../lib/marketPriceService";
import type {
  InvestmentHolding,
  HoldingActivity,
  AssetType,
} from "../../types";
import { format } from "date-fns";

interface AssetDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  holding: InvestmentHolding | null;
  onHoldingUpdated: () => void;
  onDeleteHolding: (id: string, name: string) => void;
  onStartEditHolding?: (holding: InvestmentHolding) => void;
}

const getTypeBadge = (type: AssetType, isIndonesian: boolean): string => {
  const badges: Record<AssetType, { en: string; id: string }> = {
    crypto: { en: "Crypto", id: "Kripto" },
    stock: { en: "Equities", id: "Saham" },
    gold: { en: "Gold 24K", id: "Emas 24K" },
    mutual_fund: { en: "Mutual Fund", id: "Reksa Dana" },
    bond: { en: "Government Bond", id: "SBN" },
    fixed_asset: { en: "Fixed Asset", id: "Aset Tetap" },
  };
  return isIndonesian ? badges[type]?.id || type : badges[type]?.en || type;
};

const getStockRangeLabel = (range: string, isIndonesian: boolean): string => {
  const labels: Record<string, { en: string; id: string }> = {
    "1D": { en: "Past Day", id: "1 Hari" },
    "1W": { en: "Past Week", id: "1 Minggu" },
    "1M": { en: "Past Month", id: "1 Bulan" },
    "6M": { en: "Past 6 Months", id: "6 Bulan" },
    YTD: { en: "Year to Date", id: "YTD" },
    "1Y": { en: "Past 1 Year", id: "1 Tahun" },
    ALL: { en: "All Time", id: "Semua" },
  };
  return isIndonesian ? labels[range]?.id || range : labels[range]?.en || range;
};

const GlassTooltip = ({ active, payload, label, formatFn }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div
      className="px-2.5 py-1.5 rounded-xl text-left select-none shadow-xl border"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--glass-border)",
      }}
    >
      <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="text-[12.5px] font-bold text-[var(--text-primary)] tabular-nums">
        {formatFn ? formatFn(val) : String(val)}
      </p>
    </div>
  );
};

function formatAxisY(val: number): string {
  if (Math.abs(val) >= 1000000000) return (val / 1000000000).toFixed(1) + "B";
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + "M";
  if (Math.abs(val) >= 1000) return (val / 1000).toFixed(0) + "K";
  return String(val);
}

export function AssetDetailSheet({
  isOpen,
  onClose,
  holding,
  onHoldingUpdated,
  onDeleteHolding,
  onStartEditHolding,
}: AssetDetailSheetProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const { data: wallets = [] } = useWallets();
  const addTx = useAddTransaction();
  const { data: allTxs = [] } = useAllTransactions();

  const [timeframe, setTimeframe] = useState<
    "1D" | "1W" | "1M" | "6M" | "YTD" | "1Y" | "ALL"
  >("1M");

  // Buy / Sell action modal states
  const [actionModal, setActionModal] = useState<"none" | "buy" | "sell">(
    "none",
  );
  const [modalPriceMode, setModalPriceMode] = useState<"auto" | "custom">(
    "auto",
  );
  const [inputNominal, setInputNominal] = useState<string>("");
  const [inputUnits, setInputUnits] = useState<string>("");
  const [inputPrice, setInputPrice] = useState<string>("");
  const [inputDate, setInputDate] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [inputNote, setInputNote] = useState<string>("");
  const [linkToWallet, setLinkToWallet] = useState<boolean>(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");

  // Direct Unit Balance Correction modal states
  const [isEditingDirectUnits, setIsEditingDirectUnits] =
    useState<boolean>(false);
  const [directUnitsInput, setDirectUnitsInput] = useState<string>("");

  // Custom Broker Price modal states
  const [isEditingCustomPrice, setIsEditingCustomPrice] =
    useState<boolean>(false);
  const [isCustomPriceEnabled, setIsCustomPriceEnabled] =
    useState<boolean>(false);
  const [customPriceInput, setCustomPriceInput] = useState<string>("");

  // Valuation computations
  const valuation = useMemo(() => {
    if (!holding) return null;
    return calculateHoldingValuation(holding);
  }, [holding]);

  // Position history activities with smart transaction bridge
  const activities: HoldingActivity[] = useMemo(() => {
    if (!holding) return [];
    const directActivities = getHoldingActivities(holding);
    const isUsdt =
      holding.symbol?.toUpperCase() === "USDT" ||
      holding.id.startsWith("usdt-");

    const cryptoWallets = wallets.filter(isInvestmentOrCryptoWallet);
    const cryptoWalletIds = new Set(cryptoWallets.map((w) => w.id));

    const linkedTxActivities: HoldingActivity[] = [];
    allTxs.forEach((tx) => {
      let isMatch = false;
      let actType: "buy" | "sell" = "buy";
      let note = tx.note || "";

      if (isUsdt) {
        if (
          tx.type === "income" &&
          tx.wallet_id &&
          cryptoWalletIds.has(tx.wallet_id)
        ) {
          isMatch = true;
          actType = "buy";
          note = tx.note || "Staking Yield / Bunga";
        } else if (tx.to_wallet_id && cryptoWalletIds.has(tx.to_wallet_id)) {
          isMatch = true;
          actType = "buy";
          const fromW = wallets.find((w) => w.id === tx.wallet_id);
          note =
            tx.note ||
            (fromW ? `Deposit dari ${fromW.name}` : "P2P Purchase / Deposit");
        } else if (tx.wallet_id && cryptoWalletIds.has(tx.wallet_id)) {
          isMatch = true;
          actType = "sell";
          const toW = wallets.find((w) => w.id === tx.to_wallet_id);
          note =
            tx.note ||
            (toW ? `Transfer ke ${toW.name}` : "P2P Withdrawal / Penarikan");
        }
      } else if (holding.symbol) {
        const sym = holding.symbol.toUpperCase();
        if (tx.note && tx.note.toUpperCase().includes(sym)) {
          isMatch = true;
          actType = tx.type === "expense" ? "sell" : "buy";
        }
      }

      if (isMatch) {
        const txDateStr = (tx.occurred_on || "").slice(0, 10);
        let rate: number | undefined = (tx as any).customPrice;
        if (!rate && tx.note) {
          const match = tx.note.match(/(?:rate|kurs|@)\s*[:=]?\s*([0-9.,]+)/i);
          if (match && match[1]) {
            const parsed = parseFloat(
              match[1].replace(/\./g, "").replace(",", "."),
            );
            if (!isNaN(parsed) && parsed > 1000) {
              rate = parsed;
            }
          }
        }
        if (!rate) {
          const matchingDirect = directActivities.find(
            (d) =>
              (d.date || "").slice(0, 10) === txDateStr &&
              Math.abs((d.total_amount || 0) - tx.amount) < 100,
          );
          if (matchingDirect && matchingDirect.price_per_unit > 0) {
            rate = matchingDirect.price_per_unit;
          }
        }
        if (!rate) {
          rate = estimateHistoricalAssetPrice(
            holding,
            txDateStr,
            tx.note,
            tx.amount,
          );
        }

        const units =
          (tx as any).customUnits ||
          (rate > 0 ? Number((tx.amount / rate).toFixed(4)) : 0);

        linkedTxActivities.push({
          id: `tx-bridge-${tx.id}`,
          holding_id: holding.id,
          type: actType,
          date: tx.occurred_on,
          units: Math.abs(units),
          price_per_unit: rate,
          total_amount: tx.amount,
          note,
          created_at: tx.created_at || new Date().toISOString(),
        });
      }
    });

    const merged = [...directActivities];
    linkedTxActivities.forEach((linked) => {
      const alreadyHas = merged.some(
        (m) =>
          m.id === linked.id ||
          ((m.date || "").slice(0, 10) === (linked.date || "").slice(0, 10) &&
            Math.abs(m.total_amount - linked.total_amount) < 100),
      );
      if (!alreadyHas) {
        merged.push(linked);
      }
    });

    const nonInitial = merged.filter((a) => !a.id.startsWith("act-initial-"));
    const finalActivities = nonInitial.length > 0 ? nonInitial : merged;
    return finalActivities.sort((a, b) =>
      (b.date || "").localeCompare(a.date || ""),
    );
  }, [holding, allTxs, wallets]);

  // Chart data points
  const chartData = useMemo(() => {
    if (!holding) return [];
    return generateAssetHistoryCurve(holding, timeframe, holding.current_price);
  }, [holding, timeframe]);

  // Wallet options for custom luxury GlassSelect
  const walletOptions: GlassSelectOption[] = useMemo(() => {
    return wallets.map((w) => ({
      value: w.id,
      label: w.name,
      sublabel: w.classification || "wallet",
      icon: w.icon,
      badge: w.name.toUpperCase().includes("USDT") ? "Crypto" : undefined,
    }));
  }, [wallets]);

  // Early return setelah seluruh hook dipanggil
  if (!holding || !valuation) return null;

  const currentPrice = holding.current_price || holding.avg_buy_price;
  const isProfitable = valuation.floatingPnL >= 0;

  // Handlers
  const handleOpenBuy = () => {
    triggerHaptic("light");
    setInputNominal("");
    setInputUnits("");
    setInputPrice(String(currentPrice));
    setModalPriceMode("auto");
    setInputDate(format(new Date(), "yyyy-MM-dd"));
    setInputNote("DCA Purchase");
    setLinkToWallet(false);
    setSelectedWalletId(wallets[0]?.id || "");
    setActionModal("buy");
  };

  const handleOpenSell = () => {
    triggerHaptic("light");
    setInputNominal("");
    setInputUnits("");
    setInputPrice(String(currentPrice));
    setModalPriceMode("auto");
    setInputDate(format(new Date(), "yyyy-MM-dd"));
    setInputNote("Position Sell");
    setLinkToWallet(false);
    setSelectedWalletId(wallets[0]?.id || "");
    setActionModal("sell");
  };

  // Dual-Input Smart Handler: Otomatis memformat titik pemisah ribuan saat mengetik Rupiah
  const handleNominalChange = (valStr: string) => {
    const cleanDigits = valStr.replace(/\D/g, "");
    const formattedDisplay = cleanDigits
      ? Number(cleanDigits).toLocaleString("id-ID")
      : "";
    setInputNominal(formattedDisplay);

    const nominal = cleanDigits ? parseFloat(cleanDigits) : 0;
    const cleanPrice =
      parseFloat(inputPrice.replace(/\./g, "")) || currentPrice;
    if (nominal > 0 && cleanPrice > 0) {
      const computedUnits = nominal / cleanPrice;
      const decimals =
        holding.asset_type === "crypto"
          ? 8
          : holding.asset_type === "gold"
            ? 4
            : 2;
      setInputUnits(Number(computedUnits.toFixed(decimals)).toString());
    } else {
      setInputUnits("");
    }
  };

  // Dual-Input Smart Handler: Ketika user mengetik Unit
  const handleUnitsChange = (valStr: string) => {
    setInputUnits(valStr);
    const units = parseFloat(valStr.replace(/,/g, "."));
    const cleanPrice =
      parseFloat(inputPrice.replace(/\./g, "")) || currentPrice;
    if (!isNaN(units) && units > 0 && cleanPrice > 0) {
      const computedNominal = Math.round(units * cleanPrice);
      setInputNominal(computedNominal.toLocaleString("id-ID"));
    } else {
      setInputNominal("");
    }
  };

  const handlePriceChange = (valStr: string) => {
    setInputPrice(valStr);
    const price = parseFloat(valStr.replace(/\./g, ""));
    const units = parseFloat(inputUnits.replace(/,/g, "."));
    if (!isNaN(price) && price > 0 && !isNaN(units) && units > 0) {
      const computedNominal = Math.round(units * price);
      setInputNominal(computedNominal.toLocaleString("id-ID"));
    }
  };

  const handleDateChange = (newDate: string) => {
    setInputDate(newDate);
    if (modalPriceMode === "auto" && holding) {
      const estimatedRate = estimateHistoricalAssetPrice(holding, newDate);
      setInputPrice(String(estimatedRate));
      const units = parseFloat(inputUnits.replace(/,/g, "."));
      if (!isNaN(units) && units > 0) {
        const computedNominal = Math.round(units * estimatedRate);
        setInputNominal(computedNominal.toLocaleString("id-ID"));
      }
    }
  };

  const handleConfirmAction = (e: React.FormEvent) => {
    e.preventDefault();
    const units = parseFloat(inputUnits.replace(/,/g, "."));
    const price = parseFloat(inputPrice.replace(/\./g, "")) || currentPrice;
    const cleanNominal = parseFloat(inputNominal.replace(/\./g, ""));
    const totalAmount =
      !isNaN(cleanNominal) && cleanNominal > 0 ? cleanNominal : units * price;

    if (isNaN(units) || units <= 0) {
      showToast(
        isIndonesian
          ? "Jumlah unit harus lebih dari 0"
          : "Units must be greater than 0",
        "delete",
        () => {},
      );
      return;
    }

    if (actionModal === "sell" && units > holding.units) {
      showToast(
        isIndonesian
          ? `Unit melebihi kepemilikan (${formatHoldingUnits(holding.units)} ${holding.symbol})`
          : `Units exceed current holding (${formatHoldingUnits(holding.units)} ${holding.symbol})`,
        "delete",
        () => {},
      );
      return;
    }

    triggerHaptic("medium");

    const now = new Date();
    const timePart = format(now, "HH:mm:ss");
    const occurredOnWithTime = inputDate.includes("T")
      ? inputDate
      : `${inputDate}T${timePart}`;

    const costBasis = (holding.avg_buy_price || 0) * units;
    const realizedPnL = actionModal === "sell" ? totalAmount - costBasis : undefined;

    const result = recordHoldingActivity(holding.id, {
      type: actionModal === "buy" ? "buy" : "sell",
      units,
      price_per_unit: price,
      total_amount: totalAmount,
      date: occurredOnWithTime,
      realized_pnl: realizedPnL,
      note:
        inputNote ||
        (actionModal === "buy"
          ? (isIndonesian ? `Beli ${holding.symbol}` : `Buy ${holding.symbol}`)
          : (isIndonesian ? `Jual ${holding.symbol}` : `Sell ${holding.symbol}`)),
    });

    if (linkToWallet && selectedWalletId) {
      const pnlSign = (realizedPnL ?? 0) >= 0 ? "+" : "−";
      const txNote =
        inputNote ||
        (actionModal === "buy"
          ? (isIndonesian
              ? `Beli ${formatHoldingUnits(units)} ${holding.symbol} @ ${formatWithPreferred(price)}`
              : `Buy ${formatHoldingUnits(units)} ${holding.symbol} @ ${formatWithPreferred(price)}`)
          : (isIndonesian
              ? `Likuidasi ${formatHoldingUnits(units)} ${holding.symbol} (Pokok: ${formatWithPreferred(costBasis)}, Realized P&L: ${pnlSign}${formatWithPreferred(Math.abs(realizedPnL ?? 0))})`
              : `Liquidate ${formatHoldingUnits(units)} ${holding.symbol} (Principal: ${formatWithPreferred(costBasis)}, Realized P&L: ${pnlSign}${formatWithPreferred(Math.abs(realizedPnL ?? 0))})`));

      addTx.mutate({
        type: actionModal === "buy" ? "expense" : "income",
        amount: totalAmount,
        category_id: null,
        wallet_id: selectedWalletId,
        occurred_on: occurredOnWithTime,
        note: txNote,
      });
    }

    setActionModal("none");
    onHoldingUpdated();

    if (actionModal === "buy") {
      showToast(
        isIndonesian
          ? `Berhasil membeli ${formatHoldingUnits(units)} ${holding.symbol}`
          : `Successfully bought ${formatHoldingUnits(units)} ${holding.symbol}`,
        "add",
        () => {},
      );
    } else {
      const pnlMsg =
        result.realizedPnL >= 0
          ? `+${formatWithPreferred(result.realizedPnL)}`
          : `-${formatWithPreferred(Math.abs(result.realizedPnL))}`;
      showToast(
        isIndonesian
          ? `Berhasil menjual ${formatHoldingUnits(units)} ${holding.symbol} (Realized P&L: ${pnlMsg})`
          : `Successfully sold ${formatHoldingUnits(units)} ${holding.symbol} (Realized P&L: ${pnlMsg})`,
        "update",
        () => {},
      );
    }
  };

  const handleSaveCustomPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holding) return;
    triggerHaptic("medium");
    const parsedPrice = parseFloat(customPriceInput.replace(/,/g, "."));
    if (isCustomPriceEnabled && (isNaN(parsedPrice) || parsedPrice <= 0)) {
      showToast(
        isIndonesian ? "Harga manual tidak valid" : "Invalid custom price",
        "delete",
        () => {},
      );
      return;
    }

    const updatedHolding: InvestmentHolding = {
      ...holding,
      is_custom_price: isCustomPriceEnabled,
      custom_price: isCustomPriceEnabled ? parsedPrice : undefined,
      current_price: isCustomPriceEnabled ? parsedPrice : (holding.current_price || holding.avg_buy_price),
      price_source: isCustomPriceEnabled ? "manual" : (holding.price_source === "manual" ? "cache" : holding.price_source),
      last_price_updated_at: new Date().toISOString(),
    };

    upsertHolding(updatedHolding, user?.id);
    setIsEditingCustomPrice(false);
    onHoldingUpdated();
    showToast(
      isIndonesian
        ? isCustomPriceEnabled
          ? `Harga manual dikunci pada ${formatWithPreferred(parsedPrice)}`
          : "Kunci harga manual dinonaktifkan (mengikuti pasar live)"
        : isCustomPriceEnabled
          ? `Custom price locked at ${formatWithPreferred(parsedPrice)}`
          : "Custom price unlocked (resuming market feed)",
      "update",
      () => {},
    );
  };

  const handleSaveDirectUnits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holding) return;
    const parsed = parseFloat(directUnitsInput.replace(/,/g, "."));
    if (isNaN(parsed) || parsed < 0) {
      showToast(
        isIndonesian ? "Jumlah unit tidak valid" : "Invalid unit amount",
        "delete",
        () => {},
      );
      return;
    }
    triggerHaptic("medium");
    try {
      setHoldingDirectUnits(
        holding.id,
        parsed,
        user?.id,
        isIndonesian ? "Koreksi Saldo Manual" : "Manual Balance Correction",
      );
      setIsEditingDirectUnits(false);
      onHoldingUpdated();
      showToast(
        isIndonesian
          ? `Saldo unit berhasil disesuaikan: ${formatHoldingUnits(parsed)} ${holding.symbol}`
          : `Unit balance restored to ${formatHoldingUnits(parsed)} ${holding.symbol}`,
        "update",
        () => {},
      );
    } catch (err: any) {
      showToast(err?.message || "Failed to update units", "delete", () => {});
    }
  };

  const handleUndoActivity = (act: HoldingActivity) => {
    if (!holding) return;
    triggerHaptic("medium");
    try {
      undoHoldingActivity(holding.id, act.id, user?.id, act);
      onHoldingUpdated();
      showToast(
        isIndonesian
          ? "Aktivitas berhasil dibatalkan. Saldo unit dipulihkan."
          : "Activity reverted. Unit balance restored.",
        "update",
        () => {},
      );
    } catch (err: any) {
      showToast(
        err?.message || "Failed to revert activity",
        "delete",
        () => {},
      );
    }
  };

  // ── Liquid Glass Tactile Materials ──
  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 247, 250, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.085)"
    : "1px solid rgba(0, 0, 0, 0.065)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.22)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.035)";

  // Hairline Gradient Divider (Menggantikan border putih solid dengan gradasi transparan halus)
  const gradientDivider = {
    background: isDark
      ? "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.075) 15%, rgba(255, 255, 255, 0.075) 85%, transparent 100%)"
      : "linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.06) 15%, rgba(0, 0, 0, 0.06) 85%, transparent 100%)",
    height: "1px",
    width: "100%",
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={holding.name}>
      <div className="px-5 sm:px-6 space-y-3.5 pb-[calc(env(safe-area-inset-bottom,16px)+28px)] pt-1 select-none max-w-lg mx-auto">
        {/* ============================================================ */}
        {/* 1. HERO & BALANCE (Apple Stocks Parity)                     */}
        {/* ============================================================ */}
        <div
          className="p-4 sm:p-5 rounded-3xl space-y-3 relative overflow-hidden transition-all"
          style={{
            background: controlBg,
            border: controlBorder,
            boxShadow: controlShadow,
          }}
        >
          {/* Specular Rim Light */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[10%] right-[10%] top-[1px] h-[1.5px] rounded-full"
            style={{
              background: isDark
                ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), rgba(255,255,255,0.5), rgba(255,255,255,0.3), transparent)"
                : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
            }}
          />

          {/* Header Row: Symbol, Category & Edit/Delete Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 font-bold"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                  border: controlBorder,
                }}
              >
                <IconRenderer
                  icon={holding.icon || "TrendingUp"}
                  size="w-4.5 h-4.5"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-[14px] font-bold text-[var(--text-primary)] font-mono truncate">
                    {holding.symbol}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider border leading-none"
                    style={{
                      background: isDark
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.04)",
                      borderColor: "var(--glass-border)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {getTypeBadge(holding.asset_type, isIndonesian)}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-1 leading-none">
                  {holding.name}
                </p>
              </div>
            </div>

            {/* Edit / Delete Buttons */}
            <div className="flex items-center gap-1">
              {onStartEditHolding && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onStartEditHolding(holding);
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90 transition-all cursor-pointer"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.04)",
                  }}
                  title={isIndonesian ? "Ubah Aset" : "Edit Asset"}
                >
                  <Edit3 size={13} strokeWidth={1.8} />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("heavy");
                  onDeleteHolding(holding.id, holding.name);
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-rose-400 active:scale-90 transition-all cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.06)"
                    : "rgba(0, 0, 0, 0.04)",
                }}
                title={isIndonesian ? "Hapus Aset" : "Delete Asset"}
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Big Balance & Floating PnL Display */}
          <div className="pt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
              {isIndonesian ? "Total Nilai Pasar" : "Total Market Value"}
            </span>
            <div className="flex items-baseline justify-between flex-wrap gap-2 mt-0.5">
              <h2 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[var(--text-primary)] tabular-nums leading-none">
                {formatWithPreferred(valuation.marketValue)}
              </h2>
              <div
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 shrink-0 tabular-nums border"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.06)"
                    : "rgba(0, 0, 0, 0.04)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                {isProfitable ? (
                  <ArrowUpRight size={13} strokeWidth={2.2} />
                ) : (
                  <ArrowDownRight size={13} strokeWidth={2.2} />
                )}
                <span>
                  {isProfitable ? "+" : "−"}
                  {formatWithPreferred(Math.abs(valuation.floatingPnL))} (
                  {isProfitable ? "+" : ""}
                  {valuation.floatingPnLPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Chart Header & Segmented Pill Range Selector */}
          <div className="pt-2 border-t border-[var(--glass-border)]/50 space-y-2">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="font-semibold text-[var(--text-tertiary)]">
                {getStockRangeLabel(timeframe, isIndonesian)} ·{" "}
                {holding.currency || "IDR"}
              </span>
              <span className="text-[var(--text-secondary)] font-medium tabular-nums">
                {isIndonesian ? "Spot:" : "Live:"}{" "}
                {holding.native_currency && holding.native_currency !== "IDR" && holding.native_price
                  ? `${holding.native_currency} ${holding.native_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${formatWithPreferred(currentPrice)})`
                  : formatWithPreferred(currentPrice)}{" "}
                / unit
              </span>
            </div>

            {/* Apple Stock Segmented Pill Track */}
            <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5">
              {(["1D", "1W", "1M", "6M", "YTD", "1Y", "ALL"] as const).map(
                (r) => {
                  const isActive = timeframe === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setTimeframe(r);
                        triggerHaptic("light");
                      }}
                      className="h-6 px-2.5 rounded-full text-[10px] font-semibold shrink-0 transition-all cursor-pointer select-none active:scale-95"
                      style={{
                        background: isActive
                          ? isDark
                            ? "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.84) 48%, rgba(244,245,247,0.90) 100%)"
                            : "#18181b"
                          : "transparent",
                        color: isActive
                          ? isDark
                            ? "#000000"
                            : "#ffffff"
                          : "var(--text-tertiary)",
                        border: isActive
                          ? isDark
                            ? "1px solid rgba(255, 255, 255, 0.95)"
                            : "1px solid #18181b"
                          : "1px solid transparent",
                        boxShadow: isActive
                          ? isDark
                            ? "inset 0 1px 0 #ffffff, 0 2px 6px rgba(0, 0, 0, 0.25)"
                            : "0 2px 6px rgba(0, 0, 0, 0.14)"
                          : "none",
                      }}
                    >
                      {r}
                    </button>
                  );
                },
              )}
            </div>

            {/* Interactive Area Chart */}
            <div className="h-[120px] w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 4, right: 0, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="assetHeroGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={isDark ? "#FFFFFF" : "#18181b"}
                        stopOpacity={isDark ? 0.22 : 0.1}
                      />
                      <stop
                        offset="100%"
                        stopColor={isDark ? "#FFFFFF" : "#18181b"}
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="2 3"
                    stroke={
                      isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"
                    }
                    vertical={false}
                    horizontal={true}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 9,
                      fill: isDark ? "rgba(255,255,255,0.4)" : "#71717a",
                      fontFamily: "Urbanist",
                      fontWeight: 600,
                    }}
                    axisLine={false}
                    tickLine={false}
                    dy={3}
                  />
                  <YAxis
                    orientation="right"
                    width={34}
                    domain={["auto", "auto"]}
                    tick={{
                      fontSize: 9,
                      fill: isDark ? "rgba(255,255,255,0.4)" : "#71717a",
                      fontFamily: "Urbanist",
                      fontWeight: 700,
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatAxisY}
                    dx={-2}
                  />
                  <Tooltip content={<GlassTooltip formatFn={formatWithPreferred} />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={isDark ? "#FFFFFF" : "#18181b"}
                    strokeWidth={1.8}
                    fill="url(#assetHeroGradient)"
                    dot={false}
                    activeDot={{
                      r: 3.5,
                      fill: isDark ? "#FFFFFF" : "#18181b",
                      stroke: isDark
                        ? "rgba(0,0,0,0.5)"
                        : "rgba(255,255,255,0.9)",
                      strokeWidth: 1.5,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. GROUPED METRICS: 5 ROWS DENGAN GRADASI HALUS              */}
        {/* ============================================================ */}
        <div
          className="rounded-2xl overflow-hidden transition-all"
          style={{
            background: controlBg,
            border: controlBorder,
            boxShadow: controlShadow,
          }}
        >
          {/* Row 1: Units Owned */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-medium text-[var(--text-tertiary)]">
                {isIndonesian ? "Unit Dimiliki" : "Units Owned"}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setDirectUnitsInput(String(holding.units));
                  setIsEditingDirectUnits(true);
                }}
                className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title={
                  isIndonesian ? "Koreksi Saldo Unit" : "Correct Unit Balance"
                }
              >
                <Edit3 size={11} strokeWidth={1.8} />
              </button>
            </div>
            <div className="text-right">
              <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums block leading-tight">
                {formatHoldingUnits(holding.units)} {holding.symbol}
              </span>
            </div>
          </div>

          {/* Gradient Divider 1 */}
          <div style={gradientDivider} />

          {/* Row 2: Cost Basis (Baris Mandiri) */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[12px] font-medium text-[var(--text-tertiary)]">
              {isIndonesian ? "Basis Biaya (Modal)" : "Cost Basis"}
            </span>
            <div className="text-right">
              <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums block leading-tight">
                {formatWithPreferred(valuation.costBasis)}
              </span>
            </div>
          </div>

          {/* Gradient Divider 2 */}
          <div style={gradientDivider} />

          {/* Row 3: Average Buy Price (DCA) */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[12px] font-medium text-[var(--text-tertiary)]">
              {isIndonesian ? "Harga Rata-rata (DCA)" : "Average Price"}
            </span>
            <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">
              {formatWithPreferred(holding.avg_buy_price)}
            </span>
          </div>

          {/* Gradient Divider 3 */}
          <div style={gradientDivider} />

          {/* Row 4: Current Market Price with Custom Broker Price Lock */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-medium text-[var(--text-tertiary)]">
                {isIndonesian ? "Harga Pasar Terkini" : "Market Price"}
              </span>
              {holding.is_custom_price ? (
                <span
                  className="px-1.5 py-0.2 rounded text-[7.5px] font-semibold uppercase tracking-wider border leading-none"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.04)",
                    borderColor: "var(--glass-border)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {isIndonesian ? "Manual" : "Custom"}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setIsCustomPriceEnabled(holding.is_custom_price || false);
                  setCustomPriceInput(
                    holding.custom_price
                      ? String(holding.custom_price)
                      : String(holding.current_price || holding.avg_buy_price || ""),
                  );
                  setIsEditingCustomPrice(true);
                }}
                className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title={
                  isIndonesian ? "Kunci Harga Manual" : "Lock Custom Price"
                }
              >
                <Edit3 size={11} strokeWidth={1.8} />
              </button>
            </div>
            <div className="text-right">
              <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums block leading-tight">
                {formatWithPreferred(currentPrice)}
              </span>
              <span className="text-[9.5px] text-[var(--text-tertiary)] block mt-0.5">
                {holding.is_custom_price
                  ? (isIndonesian ? "Harga Manual Broker" : "Custom Broker Price")
                  : (holding.price_source === "live"
                      ? "Live Open Market API"
                      : (isIndonesian ? "Harga Tersimpan (Offline)" : "Cached Offline Price"))}
              </span>
            </div>
          </div>

          {/* Gradient Divider 4 */}
          <div style={gradientDivider} />

          {/* Row 5: Unrealized Profit / Loss */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[12px] font-medium text-[var(--text-tertiary)]">
              {isIndonesian ? "P&L Belum Terealisasi" : "Unrealized P&L"}
            </span>
            <div className="text-right">
              <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums block leading-tight">
                {isProfitable ? "+" : "−"}
                {formatWithPreferred(Math.abs(valuation.floatingPnL))}
              </span>
              <span className="text-[9.5px] text-[var(--text-tertiary)] tabular-nums mt-0.5 block">
                {isProfitable ? "+" : ""}
                {valuation.floatingPnLPct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. PRIMARY ACTIONS: Add & Reduce Units                      */}
        {/* ============================================================ */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleOpenBuy}
            className="flex-1 h-10 px-4 rounded-2xl flex items-center justify-center gap-1.5 font-semibold text-[12.5px] active:scale-[0.98] transition-all cursor-pointer shadow-sm select-none"
            style={{
              background: isDark ? "#ffffff" : "#18181b",
              color: isDark ? "#000000" : "#ffffff",
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>{isIndonesian ? "Tambah Unit" : "Add Units"}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenSell}
            className="flex-1 h-10 px-4 rounded-2xl flex items-center justify-center gap-1.5 font-semibold text-[12.5px] active:scale-[0.98] transition-all cursor-pointer select-none"
            style={{
              background: controlBg,
              border: controlBorder,
              boxShadow: controlShadow,
              color: "var(--text-primary)",
            }}
          >
            <Minus size={14} strokeWidth={2.5} />
            <span>{isIndonesian ? "Kurangi Unit" : "Reduce Units"}</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* 4. ACTIVITY HISTORY (Clean Telemetry Log)                   */}
        {/* ============================================================ */}
        <div className="space-y-2 pt-1.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {isIndonesian ? "Riwayat Aktivitas" : "Activity History"}
            </h3>
            <span className="text-[10px] font-mono text-[var(--text-tertiary)] opacity-80">
              {activities.length}{" "}
              {isIndonesian
                ? "entri"
                : activities.length === 1
                  ? "entry"
                  : "entries"}
            </span>
          </div>

          <div className="space-y-1.5 overflow-y-auto no-scrollbar pr-0.5">
            {activities.length === 0 ? (
              <div
                className="p-4 rounded-2xl text-center text-[11px] text-[var(--text-tertiary)]"
                style={{
                  background: controlBg,
                  border: controlBorder,
                }}
              >
                {isIndonesian
                  ? "Belum ada riwayat aktivitas"
                  : "No activity recorded yet"}
              </div>
            ) : (
              activities.map((act) => {
                const isBuy = act.type === "buy" || act.type === "initial";
                return (
                  <div
                    key={act.id}
                    className="p-2.5 px-3 rounded-2xl flex items-center justify-between gap-3 transition-all"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      boxShadow: controlShadow,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-bold"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)",
                          border: controlBorder,
                          color: "var(--text-primary)",
                        }}
                      >
                        {isBuy ? "+" : "−"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 leading-none">
                          <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                            {act.type === "initial"
                              ? isIndonesian
                                ? "Saldo Awal"
                                : "Initial Position"
                              : act.type === "buy"
                                ? isIndonesian
                                  ? "Beli Unit"
                                  : "Add Units"
                                : isIndonesian
                                  ? "Jual Unit"
                                  : "Reduce Units"}
                          </span>
                          <span className="text-[9.5px] font-mono text-[var(--text-tertiary)] opacity-75">
                            {act.date}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-1 leading-none">
                          @ {formatWithPreferred(act.price_per_unit)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums leading-none">
                          {formatWithPreferred(act.total_amount)}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] tabular-nums mt-1 leading-none">
                          {isBuy ? "+" : "−"}
                          {act.units.toLocaleString()} {holding.symbol}
                        </p>
                        {act.type === "sell" && typeof act.realized_pnl === "number" && (
                          <p className="text-[9px] font-mono text-[var(--text-tertiary)] tabular-nums mt-0.5 leading-none">
                            P&L: {act.realized_pnl >= 0 ? "+" : "−"}{formatWithPreferred(Math.abs(act.realized_pnl))}
                          </p>
                        )}
                      </div>

                      {act.type !== "initial" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUndoActivity(act);
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90 transition-all cursor-pointer"
                          style={{
                            background: isDark
                              ? "rgba(255, 255, 255, 0.06)"
                              : "rgba(0, 0, 0, 0.04)",
                            border: controlBorder,
                          }}
                          title={
                            isIndonesian
                              ? "Batalkan aktivitas (Undo)"
                              : "Revert activity"
                          }
                        >
                          <RotateCcw size={12} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* 5. MODAL: SMART DCA BUY / SELL FORM                         */}
        {/* ============================================================ */}
        {actionModal !== "none" && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
            <form
              onSubmit={handleConfirmAction}
              className="w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl p-5 space-y-3.5 shadow-2xl animate-in slide-in-from-bottom-5 duration-200"
              style={{
                background: isDark
                  ? "linear-gradient(160deg, rgba(26, 26, 32, 0.98) 0%, rgba(14, 14, 18, 0.99) 100%)"
                  : "linear-gradient(160deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 247, 250, 0.98) 100%)",
                border: controlBorder,
              }}
            >
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                    }}
                  >
                    <IconRenderer
                      icon={holding.icon || "TrendingUp"}
                      size="w-4 h-4"
                    />
                  </div>
                  <div>
                    <h3 className="text-[13.5px] font-bold text-[var(--text-primary)] leading-tight">
                      {actionModal === "buy"
                        ? isIndonesian
                          ? `Tambah Unit ${holding.symbol}`
                          : `Add ${holding.symbol} Units`
                        : isIndonesian
                          ? `Kurangi Unit ${holding.symbol}`
                          : `Reduce ${holding.symbol} Units`}
                    </h3>
                    <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5 leading-none">
                      {actionModal === "buy"
                        ? isIndonesian
                          ? "Eksekusi alokasi investasi"
                          : "Execute asset allocation"
                        : isIndonesian
                          ? "Likuidasi posisi portofolio"
                          : "Liquidate asset position"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActionModal("none")}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer active:scale-90 transition-all"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>

              {/* Input 1: Nominal IDR (Format Titik Otomatis) */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-0.5 block">
                  {actionModal === "buy"
                    ? isIndonesian
                      ? "Nominal Investasi (IDR)"
                      : "Investment Amount (IDR)"
                    : isIndonesian
                      ? "Nominal Likuidasi (IDR)"
                      : "Liquidated Amount (IDR)"}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputNominal}
                  onChange={(e) => handleNominalChange(e.target.value)}
                  placeholder={isIndonesian ? "misal: 500.000" : "e.g. 500,000"}
                  className="w-full px-3.5 h-10 rounded-2xl text-[12.5px] font-medium outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                  }}
                />
              </div>

              {/* Input 2: Units */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-0.5">
                  <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {actionModal === "buy"
                      ? isIndonesian
                        ? "Unit yang Ditambah"
                        : "Units to Add"
                      : isIndonesian
                        ? "Unit yang Dikurangi"
                        : "Units to Reduce"}
                  </label>
                  {actionModal === "sell" ? (
                    <button
                      type="button"
                      onClick={() => handleUnitsChange(String(holding.units))}
                      className="text-[9.5px] text-[var(--text-primary)] hover:underline cursor-pointer font-bold"
                    >
                      {isIndonesian
                        ? `Maks: ${holding.units.toLocaleString()} (Semua)`
                        : `Max: ${holding.units.toLocaleString()}`}
                    </button>
                  ) : (
                    <span className="text-[9.5px] text-[var(--text-tertiary)]">
                      {isIndonesian ? "Saat ini:" : "Hold:"}{" "}
                      {holding.units.toLocaleString()}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputUnits}
                  onChange={(e) => handleUnitsChange(e.target.value)}
                  placeholder={
                    isIndonesian
                      ? `Jumlah unit dalam ${holding.symbol}`
                      : `Units in ${holding.symbol}`
                  }
                  className="w-full px-3.5 h-10 rounded-2xl text-[12.5px] font-medium outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                  }}
                />
              </div>

              {/* Input 3: Price Per Unit with Auto / Custom Broker */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-0.5">
                  <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {isIndonesian
                      ? "Harga Eksekusi per Unit"
                      : "Price per Unit"}
                  </label>
                  <div
                    className="flex items-center p-0.5 rounded-full border"
                    style={{
                      background: controlBg,
                      borderColor: "var(--glass-border)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setModalPriceMode("auto");
                        handlePriceChange(String(currentPrice));
                      }}
                      className="h-5 px-2 rounded-full text-[9px] font-semibold transition-all cursor-pointer"
                      style={{
                        background:
                          modalPriceMode === "auto"
                            ? isDark
                              ? "#ffffff"
                              : "#18181b"
                            : "transparent",
                        color:
                          modalPriceMode === "auto"
                            ? isDark
                              ? "#000000"
                              : "#ffffff"
                            : "var(--text-tertiary)",
                      }}
                    >
                      {isIndonesian ? "Otomatis" : "Auto API"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setModalPriceMode("custom");
                      }}
                      className="h-5 px-2 rounded-full text-[9px] font-semibold transition-all cursor-pointer"
                      style={{
                        background:
                          modalPriceMode === "custom"
                            ? isDark
                              ? "#ffffff"
                              : "#18181b"
                            : "transparent",
                        color:
                          modalPriceMode === "custom"
                            ? isDark
                              ? "#000000"
                              : "#ffffff"
                            : "var(--text-tertiary)",
                      }}
                    >
                      {isIndonesian ? "Kustom" : "Custom"}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputPrice}
                    onChange={(e) => {
                      setModalPriceMode("custom");
                      handlePriceChange(e.target.value);
                    }}
                    placeholder={
                      modalPriceMode === "auto"
                        ? isIndonesian
                          ? "Harga pasar"
                          : "Market price"
                        : "cth. 16350"
                    }
                    className="w-full px-3.5 h-10 rounded-2xl text-[12.5px] font-medium outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      boxShadow: controlShadow,
                    }}
                  />
                  {modalPriceMode === "auto" && (
                    <span
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[8.5px] px-1.5 py-0.5 rounded-md border text-[var(--text-secondary)] pointer-events-none"
                      style={{
                        background: isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.05)",
                        borderColor: "var(--glass-border)",
                      }}
                    >
                      {isIndonesian ? "Pasar Langsung" : "Live Spot"}
                    </span>
                  )}
                </div>
              </div>

              {/* Input 4: Execution Date */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-0.5 block">
                  {isIndonesian ? "Tanggal Transaksi" : "Execution Date"}
                </label>
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3.5 h-10 rounded-2xl text-[12.5px] font-medium outline-none text-[var(--text-primary)] transition-colors cursor-pointer"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                    colorScheme: isDark ? "dark" : "light",
                  }}
                />
              </div>

              {/* Optional Wallet Synchronization */}
              {wallets.length > 0 && (
                <div className="pt-0.5">
                  <div
                    onClick={() => setLinkToWallet(!linkToWallet)}
                    className="px-3.5 py-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                    }}
                  >
                    <span className="text-[11.5px] font-medium text-[var(--text-primary)]">
                      {actionModal === "buy"
                        ? isIndonesian
                          ? "Potong dari Saldo Akun"
                          : "Deduct from Account"
                        : isIndonesian
                          ? "Setor ke Saldo Akun"
                          : "Deposit to Account"}
                    </span>
                    <div
                      className="w-4 h-4 rounded-md flex items-center justify-center border transition-all"
                      style={{
                        background: linkToWallet
                          ? isDark
                            ? "#ffffff"
                            : "#18181b"
                          : "transparent",
                        color: linkToWallet
                          ? isDark
                            ? "#000000"
                            : "#ffffff"
                          : "transparent",
                        borderColor: linkToWallet
                          ? isDark
                            ? "#ffffff"
                            : "#18181b"
                          : "var(--glass-border)",
                      }}
                    >
                      {linkToWallet && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>

                  {linkToWallet && (
                    <GlassSelect
                      value={selectedWalletId}
                      onChange={setSelectedWalletId}
                      options={walletOptions}
                      placeholder={
                        isIndonesian
                          ? "Pilih akun dompet..."
                          : "Select wallet account..."
                      }
                      className="mt-2"
                    />
                  )}
                </div>
              )}

              {/* Action Submit Buttons */}
              <div className="flex items-center gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setActionModal("none")}
                  className="flex-1 h-10 rounded-2xl text-[12px] font-semibold active:scale-[0.98] transition-all cursor-pointer"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-secondary)",
                  }}
                >
                  {isIndonesian ? "Batal" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-2xl text-[12px] font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-sm select-none"
                  style={{
                    background: isDark ? "#ffffff" : "#18181b",
                    color: isDark ? "#000000" : "#ffffff",
                  }}
                >
                  {actionModal === "buy"
                    ? isIndonesian
                      ? "Konfirmasi Beli"
                      : "Confirm Add"
                    : isIndonesian
                      ? "Konfirmasi Jual"
                      : "Confirm Reduce"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* 6. MODAL: DIRECT UNIT BALANCE CORRECTION                    */}
        {/* ============================================================ */}
        {isEditingDirectUnits && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
            <form
              onSubmit={handleSaveDirectUnits}
              className="w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl p-5 space-y-3.5 shadow-2xl animate-in slide-in-from-bottom-5 duration-200"
              style={{
                background: isDark
                  ? "linear-gradient(160deg, rgba(26, 26, 32, 0.98) 0%, rgba(14, 14, 18, 0.99) 100%)"
                  : "linear-gradient(160deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 247, 250, 0.98) 100%)",
                border: controlBorder,
              }}
            >
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                    }}
                  >
                    <Edit3 size={14} className="text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-[13.5px] font-bold text-[var(--text-primary)] leading-tight">
                      {isIndonesian
                        ? `Koreksi Saldo ${holding.symbol}`
                        : `Correct ${holding.symbol} Balance`}
                    </h3>
                    <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5 leading-none">
                      {isIndonesian
                        ? "Sesuaikan total unit ke saldo riil"
                        : "Align units with actual portfolio"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingDirectUnits(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer active:scale-90 transition-all"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between px-0.5">
                  <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {isIndonesian ? "Total Unit Riil Baru" : "New Total Units"}
                  </label>
                  <span className="text-[9.5px] font-mono text-[var(--text-tertiary)]">
                    {isIndonesian ? "Saat ini:" : "Current:"}{" "}
                    {holding.units.toLocaleString()} {holding.symbol}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={directUnitsInput}
                  onChange={(e) => setDirectUnitsInput(e.target.value)}
                  placeholder="e.g. 1002.41"
                  className="w-full px-3.5 h-10 rounded-2xl text-[13px] font-semibold outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                  }}
                />
                <p className="text-[10px] text-[var(--text-tertiary)] px-0.5 pt-0.5">
                  {isIndonesian
                    ? "Saldo unit akan langsung diperbarui dan disinkronkan ke cloud."
                    : "The unit balance will be immediately synchronized to cloud storage."}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingDirectUnits(false)}
                  className="flex-1 h-10 rounded-2xl text-[12px] font-semibold active:scale-[0.98] transition-all cursor-pointer"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-secondary)",
                  }}
                >
                  {isIndonesian ? "Batal" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-2xl text-[12px] font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-sm select-none"
                  style={{
                    background: isDark ? "#ffffff" : "#18181b",
                    color: isDark ? "#000000" : "#ffffff",
                  }}
                >
                  {isIndonesian ? "Simpan Saldo" : "Save Balance"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* 7. MODAL: MANUAL / CUSTOM BROKER PRICE CONFIGURATION         */}
        {/* ============================================================ */}
        {isEditingCustomPrice && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
            <form
              onSubmit={handleSaveCustomPrice}
              className="w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl p-5 space-y-3.5 shadow-2xl animate-in slide-in-from-bottom-5 duration-200"
              style={{
                background: isDark
                  ? "linear-gradient(160deg, rgba(26, 26, 32, 0.98) 0%, rgba(14, 14, 18, 0.99) 100%)"
                  : "linear-gradient(160deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 247, 250, 0.98) 100%)",
                border: controlBorder,
              }}
            >
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                    }}
                  >
                    <Edit3 size={14} className="text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-[13.5px] font-bold text-[var(--text-primary)] leading-tight">
                      {isIndonesian
                        ? `Harga Broker ${holding.symbol}`
                        : `Broker Price: ${holding.symbol}`}
                    </h3>
                    <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5 leading-none">
                      {isIndonesian
                        ? "Kunci harga khusus atau ikuti pasar live"
                        : "Lock custom price or follow live market"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingCustomPrice(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer active:scale-90 transition-all"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>

              {/* iOS Toggle Switch: Hierarchy Structure per Rule 3 */}
              <div
                className="p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all"
                style={{
                  background: controlBg,
                  border: controlBorder,
                }}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug">
                    {isIndonesian ? "Kunci Harga Manual" : "Lock Custom Price"}
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-normal">
                    {isIndonesian
                      ? "Abaikan feed pasar live dan gunakan harga broker Anda"
                      : "Bypass live market feed and use your broker price"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isCustomPriceEnabled}
                  onClick={() => {
                    triggerHaptic("light");
                    setIsCustomPriceEnabled(!isCustomPriceEnabled);
                  }}
                  className={`relative shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none ${
                    isCustomPriceEnabled
                      ? isDark ? "bg-white" : "bg-zinc-900"
                      : isDark ? "bg-white/20" : "bg-black/20"
                  }`}
                >
                  <span
                    className={`inline-block w-4.5 h-4.5 rounded-full shadow-md transition-transform duration-200 ${
                      isCustomPriceEnabled
                        ? `translate-x-[19px] ${isDark ? "bg-black" : "bg-white"}`
                        : `translate-x-[2px] ${isDark ? "bg-zinc-300" : "bg-white"}`
                    }`}
                  />
                </button>
              </div>

              {/* Input: Custom Price when enabled */}
              {isCustomPriceEnabled && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-0.5">
                    <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {isIndonesian ? "Harga Unit Kustom" : "Custom Unit Price"}
                    </label>
                    <span className="text-[9.5px] font-mono text-[var(--text-tertiary)]">
                      {isIndonesian ? "Spot live:" : "Live spot:"} {formatWithPreferred(holding.current_price || holding.avg_buy_price || 0)}
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customPriceInput}
                    onChange={(e) => setCustomPriceInput(e.target.value)}
                    placeholder="e.g. 16500"
                    className="w-full px-3.5 h-10 rounded-2xl text-[13px] font-semibold outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      boxShadow: controlShadow,
                    }}
                    autoFocus
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)] px-0.5 pt-0.5">
                    {isIndonesian
                      ? "Valuasi portofolio akan dihitung berdasarkan harga kustom ini."
                      : "Portfolio valuation will be computed based on this custom price."}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingCustomPrice(false)}
                  className="flex-1 h-10 rounded-2xl text-[12px] font-semibold active:scale-[0.98] transition-all cursor-pointer"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-secondary)",
                  }}
                >
                  {isIndonesian ? "Batal" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-2xl text-[12px] font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-sm select-none"
                  style={{
                    background: isDark ? "#ffffff" : "#18181b",
                    color: isDark ? "#000000" : "#ffffff",
                  }}
                >
                  {isIndonesian ? "Simpan Harga" : "Save Price"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
