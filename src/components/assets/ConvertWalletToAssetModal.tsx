import { useState, useEffect, useMemo } from "react";
import {
  Coins,
  ShieldCheck,
  Check,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  formatHoldingUnits,
  formatLiveAmountInput,
} from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import type { Wallet, InvestmentHolding } from "../../lib/types";
import {
  getStandardUsdtHoldingId,
  saveUsdtPref,
  upsertHolding,
  type UsdtValuationPref,
} from "../../lib/marketPriceService";
import { useUpdateWallet } from "../../hooks/useWallets";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import { useAllTransactions } from "../../hooks/useTransactions";
import { estimateHistoricalUsdtBuyRate } from "../../lib/holdingSyncEngine";

export interface ConvertWalletToAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: Wallet | null;
  liveRate: number;
  userId?: string;
  onSuccess: (holding: InvestmentHolding, pref: UsdtValuationPref) => void;
}

export function ConvertWalletToAssetModal({
  isOpen,
  onClose,
  wallet,
  liveRate,
  userId,
  onSuccess,
}: ConvertWalletToAssetModalProps) {
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const updateWallet = useUpdateWallet();
  const { formatWithPreferred } = useCurrency();

  const { balancesById } = useWalletBalances();
  const { data: allTxs = [] } = useAllTransactions();
  const effectiveRate = liveRate > 5000 && liveRate < 50000 ? liveRate : 16415;
  const walletBalance = wallet ? (balancesById[wallet.id] ?? Number(wallet?.balance || 0)) : 0;

  // Estimate weighted historical buy rate from the wallet's inflow transactions
  const estimatedHistoricalBuyRate = useMemo(() => {
    if (!wallet?.id || !allTxs.length) return 15950;
    let totalInflowIdr = 0;
    let totalInflowImpliedUnits = 0;
    for (const tx of allTxs) {
      const amt = Number(tx.amount) || 0;
      if (amt <= 0) continue;
      const isFrom = tx.wallet_id === wallet.id;
      const isTo = tx.to_wallet_id === wallet.id;
      if (!isFrom && !isTo) continue;
      const txDate = (tx.occurred_on || tx.created_at || "").slice(0, 10);
      const rateAtTx = estimateHistoricalUsdtBuyRate(txDate, tx.note, Math.abs(amt));
      if (
        (tx.type === "income" && isFrom) ||
        (tx.type === "transfer" && isTo && !isFrom) ||
        (tx.type === "adjustment" && isFrom && amt > 0)
      ) {
        totalInflowIdr += amt;
        totalInflowImpliedUnits += amt / rateAtTx;
      }
    }
    return totalInflowImpliedUnits > 0
      ? Math.round(totalInflowIdr / totalInflowImpliedUnits)
      : 15950;
  }, [wallet, allTxs]);

  // Form State
  const [rateInput, setRateInput] = useState<string>(String(effectiveRate));
  const [costBasisRateInput, setCostBasisRateInput] = useState<string>(
    String(estimatedHistoricalBuyRate),
  );
  const [integrationMode, setIntegrationMode] = useState<"linked" | "standalone">(
    "linked",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initCurrentRate = effectiveRate.toLocaleString(
        isIndonesian ? "id-ID" : "en-US",
      );
      const initCostBasisRate = estimatedHistoricalBuyRate.toLocaleString(
        isIndonesian ? "id-ID" : "en-US",
      );
      setRateInput(initCurrentRate);
      setCostBasisRateInput(initCostBasisRate);
    }
  }, [isOpen, effectiveRate, estimatedHistoricalBuyRate, isIndonesian]);

  // Derived numeric conversion (walletBalance is Historical Cost Basis IDR)
  const parsedCurrentRate = useMemo(() => {
    const clean = rateInput.replace(/\D/g, "");
    const val = parseInt(clean, 10);
    return isNaN(val) || val <= 0 ? effectiveRate : val;
  }, [rateInput, effectiveRate]);

  const parsedCostBasisRate = useMemo(() => {
    const clean = costBasisRateInput.replace(/\D/g, "");
    const val = parseInt(clean, 10);
    return isNaN(val) || val <= 0 ? estimatedHistoricalBuyRate : val;
  }, [costBasisRateInput, estimatedHistoricalBuyRate]);

  const computedUnits = useMemo(() => {
    if (parsedCostBasisRate <= 0 || walletBalance <= 0) return 0;
    return parseFloat((walletBalance / parsedCostBasisRate).toFixed(4));
  }, [walletBalance, parsedCostBasisRate]);

  const totalCostBasis = walletBalance;
  const marketValuation = Math.round(computedUnits * parsedCurrentRate);
  const unrealizedPnL = marketValuation - totalCostBasis;
  const unrealizedPnLPct =
    totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0;

  const handleSaveConversion = async () => {
    if (!wallet || computedUnits <= 0) {
      showToast(
        isIndonesian ? "Saldo dompet tidak valid" : "Invalid wallet balance",
        "delete",
        () => {},
      );
      return;
    }

    triggerHaptic("medium");
    setIsSubmitting(true);

    try {
      // 1. Setup USDT Valuation Preference
      const pref: UsdtValuationPref = {
        units: computedUnits,
        rate: parsedCurrentRate,
        costBasis: Math.round(totalCostBasis),
      };
      saveUsdtPref(pref, userId);

      // 2. Setup Sovereign Investment Holding Row
      const holdingId = getStandardUsdtHoldingId(userId);
      const newHolding: InvestmentHolding = {
        id: holdingId,
        user_id: userId,
        symbol: "USDT",
        name: "Tether USD",
        asset_type: "crypto",
        units: computedUnits,
        avg_buy_price: parsedCostBasisRate,
        current_price: parsedCurrentRate,
        currency: "IDR",
        icon: "Coins",
        wallet_id: integrationMode === "linked" ? wallet.id : undefined,
        notes: `Platform: ${wallet.name} (Terkonversi)`,
        purchase_date: new Date().toISOString().split("T")[0],
        last_price_updated_at: new Date().toISOString(),
      };
      upsertHolding(newHolding, userId);

      // 3. Update Wallet Classification to 'investment' if linked
      if (integrationMode === "linked" && wallet.classification !== "investment") {
        await updateWallet.mutateAsync({
          id: wallet.id,
          name: wallet.name,
          classification: "investment",
        });
      }

      showToast(
        isIndonesian
          ? `Dompet ${wallet.name} berhasil ditautkan sebagai ${formatHoldingUnits(computedUnits)} USDT`
          : `Wallet ${wallet.name} linked as ${formatHoldingUnits(computedUnits)} USDT`,
        "add",
        () => {},
      );

      onSuccess(newHolding, pref);
      onClose();
    } catch {
      showToast(
        isIndonesian ? "Gagal menautkan aset" : "Failed to link asset",
        "delete",
        () => {},
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        isIndonesian
          ? "Tautkan Akun ke Portofolio Aset"
          : "Link Account to Portfolio Asset"
      }
    >
      <div className="p-4 sm:p-5 space-y-4 select-none">
        {/* Detected Legacy Account Banner */}
        <div
          className="p-3.5 rounded-2xl border border-[var(--glass-border)] flex items-center justify-between gap-3"
          style={{
            background: "var(--glass-fill)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0 border border-[var(--glass-border)]">
              <Coins size={18} className="text-[var(--text-primary)]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)] tracking-wider block">
                {isIndonesian ? "Dompet Terdeteksi" : "Detected Wallet"}
              </span>
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">
                {wallet?.name || "USDT"}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] amount">
                {isIndonesian ? "Saldo: " : "Balance: "}{formatWithPreferred(walletBalance)}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[9.5px] uppercase font-semibold text-[var(--text-tertiary)] block">
              {isIndonesian ? "Estimasi Unit" : "Estimated Units"}
            </span>
            <span className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums">
              {formatHoldingUnits(computedUnits)}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] ml-1">USDT</span>
          </div>
        </div>

        {/* Informational Guidance */}
        <div className="p-3 rounded-2xl bg-white/[0.03] border border-[var(--glass-border)] flex items-start gap-2.5 text-[11px] text-[var(--text-secondary)] leading-relaxed">
          <HelpCircle size={15} className="shrink-0 text-[var(--text-tertiary)] mt-0.5" />
          <p>
            {isIndonesian
              ? "Akun Anda sebelumnya mencatat saldo USDT sebagai nominal Rupiah kas biasa. Fitur ini menautkannya menjadi posisi Holding Aset resmi sehingga harga live, PnL pergerakan kurs, dan imbal hasil staking dapat terpantau secara presisi."
              : "Your account previously tracked USDT as plain fiat balance. This converts it into a sovereign holding position for live pricing, currency PnL, and staking yields."}
          </p>
        </div>

        {/* Rate & Cost Basis Controls */}
        <div className="space-y-3">
          {/* 1. Live Exchange Rate */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between">
              <span>{isIndonesian ? "Kurs Valuasi Saat Ini (IDR / USDT)" : "Current Valuation Rate"}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {isIndonesian ? "Live API: " : "Live API: "}@{formatWithPreferred(effectiveRate)}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)] font-semibold">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={rateInput}
                  onChange={(e) => {
                    const { display } = formatLiveAmountInput(
                      e.target.value,
                      isIndonesian,
                      false,
                    );
                    setRateInput(display);
                  }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--glass-border)] text-[13px] font-semibold text-[var(--text-primary)] outline-none focus:border-white/40 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  const r = effectiveRate.toLocaleString(
                    isIndonesian ? "id-ID" : "en-US",
                  );
                  setRateInput(r);
                }}
                className="px-3 py-2.5 rounded-xl bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                title={isIndonesian ? "Gunakan Kurs Live" : "Use Live Rate"}
              >
                <RefreshCw size={12} />
                <span>{isIndonesian ? "Live" : "Live"}</span>
              </button>
            </div>
          </div>

          {/* 2. Purchase Cost Basis */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between">
              <span>{isIndonesian ? "Kurs Beli Rata-Rata (Harga Masuk Modal)" : "Average Buy Rate (Cost Basis)"}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {isIndonesian ? "Untuk kalkulasi PnL" : "For PnL calculation"}
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)] font-semibold">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={costBasisRateInput}
                onChange={(e) => {
                  const { display } = formatLiveAmountInput(
                    e.target.value,
                    isIndonesian,
                    false,
                  );
                  setCostBasisRateInput(display);
                }}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--glass-border)] text-[13px] font-semibold text-[var(--text-primary)] outline-none focus:border-white/40 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Real-time PnL Preview Tile */}
        <div
          className="p-3.5 rounded-2xl border border-[var(--glass-border)] flex items-center justify-between"
          style={{ background: "var(--glass-fill)" }}
        >
          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)] block">
              {isIndonesian ? "Valuasi Portofolio" : "Portfolio Valuation"}
            </span>
            <p className="text-[14px] font-bold text-[var(--text-primary)] amount mt-0.5">
              {formatWithPreferred(marketValuation)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)] block">
              {isIndonesian ? "Imbal Hasil Belum Terealisasi" : "Floating PnL"}
            </span>
            <p
              className="text-[12.5px] font-semibold amount mt-0.5"
              style={{
                color:
                  unrealizedPnL >= 0 ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {unrealizedPnL >= 0 ? "+" : "−"}
              {formatWithPreferred(Math.abs(unrealizedPnL))} ({unrealizedPnLPct >= 0 ? "+" : ""}
              {unrealizedPnLPct.toFixed(1)}%)
            </p>
          </div>
        </div>

        {/* Integration Mode Radio Selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
            {isIndonesian ? "Metode Tautan Akun:" : "Account Linking Mode:"}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setIntegrationMode("linked");
              }}
              className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                integrationMode === "linked"
                  ? "bg-white/[0.08] border-white/30 text-white"
                  : "bg-white/[0.02] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-70"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11.5px] font-bold text-[var(--text-primary)]">
                  {isIndonesian ? "Akun Kustodi" : "Custody Account"}
                </span>
                {integrationMode === "linked" && (
                  <Check size={13} className="text-[var(--text-primary)]" />
                )}
              </div>
              <p className="text-[9.5px] text-[var(--text-tertiary)] leading-tight">
                {isIndonesian
                  ? "Dompet tetap ada untuk mutasi pencairan/setoran, terklasifikasi sebagai investasi."
                  : "Wallet remains for liquidation/deposit txs, classified as investment."}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setIntegrationMode("standalone");
              }}
              className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                integrationMode === "standalone"
                  ? "bg-white/[0.08] border-white/30 text-white"
                  : "bg-white/[0.02] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-70"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11.5px] font-bold text-[var(--text-primary)]">
                  {isIndonesian ? "Holding Mandiri" : "Standalone Holding"}
                </span>
                {integrationMode === "standalone" && (
                  <Check size={13} className="text-[var(--text-primary)]" />
                )}
              </div>
              <p className="text-[9.5px] text-[var(--text-tertiary)] leading-tight">
                {isIndonesian
                  ? "Aset dicatat murni sebagai portofolio tanpa terikat dompet kas."
                  : "Asset tracked purely in portfolio without linked cash wallet."}
              </p>
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSaveConversion}
            disabled={isSubmitting || computedUnits <= 0}
            className="w-full py-3.5 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer shadow-lg disabled:opacity-50"
            style={{
              background: "var(--text-primary)",
              color: "var(--bg-base)",
            }}
          >
            <ShieldCheck size={16} strokeWidth={2.2} />
            <span>
              {isIndonesian
                ? `Tautkan Sebagai ${formatHoldingUnits(computedUnits)} USDT`
                : `Link As ${formatHoldingUnits(computedUnits)} USDT`}
            </span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
