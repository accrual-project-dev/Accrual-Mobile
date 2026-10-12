import { useMemo, useState, useEffect } from "react";
import { useWallets } from "./useWallets";
import { useAllTransactions } from "./useTransactions";
import { useOptionalSpace } from "../contexts/SpaceContext";
import { useAuth } from "../contexts/AuthContext";
import { getSavedUsdtPref, getSavedHoldings } from "../lib/marketPriceService";
import { bridgeCryptoAccountToHolding } from "../lib/holdingSyncEngine";
import {
  calculateWalletBalances,
  getIncludeReceivableInLiquid,
  type AccountBalanceItem,
  type WalletBalancesResult,
} from "../lib/financialMath";

export type { AccountBalanceItem, WalletBalancesResult };

export function useWalletBalances(targetSpaceId?: string) {
  const { data: wallets = [] } = useWallets();
  const { data: allTxs = [] } = useAllTransactions();
  const spaceCtx = useOptionalSpace();
  const { user } = useAuth();
  const [holdingsTick, setHoldingsTick] = useState(0);
  const [prefTick, setPrefTick] = useState(0);

  useEffect(() => {
    const handleHoldingsUpdated = () => setHoldingsTick((t) => t + 1);
    const handlePrefChanged = () => setPrefTick((t) => t + 1);
    window.addEventListener("trouvaille_holdings_updated", handleHoldingsUpdated);
    window.addEventListener("trouvaille:receivable-liquid-pref-changed", handlePrefChanged);
    return () => {
      window.removeEventListener("trouvaille_holdings_updated", handleHoldingsUpdated);
      window.removeEventListener("trouvaille:receivable-liquid-pref-changed", handlePrefChanged);
    };
  }, []);

  useEffect(() => {
    if (wallets.length > 0 && allTxs.length > 0) {
      bridgeCryptoAccountToHolding(wallets, allTxs, user?.id);
    }
  }, [wallets, allTxs, user?.id, holdingsTick]);

  const activeSpaceId = targetSpaceId || spaceCtx?.activeSpaceId || "personal";
  const filterTransactionsBySpace = spaceCtx?.filterTransactionsBySpace;

  return useMemo(() => {
    // 1. Filter transactions according to active space
    const scopedTxs = filterTransactionsBySpace
      ? filterTransactionsBySpace(allTxs, activeSpaceId)
      : allTxs;

    // 2. In custom ledgers (not 'personal' and not 'all'), wallets start cleanly from Rp 0
    const isCustomLedger =
      activeSpaceId !== "personal" && activeSpaceId !== "all";
    const scopedWallets = isCustomLedger
      ? wallets.map((w) => ({
          ...w,
          balance: 0,
          initial_balance: 0,
        }))
      : wallets;

    const includeReceivable = getIncludeReceivableInLiquid();
    const result = calculateWalletBalances(scopedTxs, scopedWallets, includeReceivable);

    // Identify crypto / USDT wallet to derive recorded crypto cost-basis balance
    const cryptoWallet = scopedWallets.find(
      (w) =>
        w.name.toLowerCase().includes("usdt") ||
        w.name.toLowerCase().includes("tether") ||
        w.name.toLowerCase().includes("crypto"),
    );
    const recordedCryptoBalance = cryptoWallet
      ? (result.balancesById[cryptoWallet.id] ?? 0)
      : 0;

    const usdtPref = getSavedUsdtPref(user?.id);
    const holdings = getSavedHoldings(user?.id);
    const usdtHolding = holdings.find((h) => h.symbol?.toUpperCase() === "USDT");

    const usdtUnits = usdtHolding?.units || usdtPref.units || 0;
    const usdtRate = usdtHolding?.current_price || usdtPref.rate || 16300;
    const usdtReserve = isCustomLedger
      ? recordedCryptoBalance
      : usdtUnits > 0
        ? Math.round(usdtUnits * usdtRate)
        : recordedCryptoBalance;

    // Non-USDT holdings market value
    const otherHoldingsMarketVal = isCustomLedger
      ? 0
      : holdings
          .filter((h) => h.symbol?.toUpperCase() !== "USDT")
          .reduce(
            (sum, h) =>
              sum +
              Math.round(
                (h.units || 0) * (h.current_price || h.avg_buy_price || 0),
              ),
            0,
          );

    // Replace static ledger balance of USDT wallet with live market value in marketAccounts/allAccounts
    const adjustedMarketAssets = Math.max(
      0,
      result.marketAssets -
        Math.max(0, recordedCryptoBalance) +
        Math.max(0, usdtReserve) +
        otherHoldingsMarketVal,
    );

    const enrichedAllAccounts = result.allAccounts.map((acc) => {
      if (cryptoWallet && acc.id === cryptoWallet.id && usdtReserve > 0) {
        return {
          ...acc,
          classification: "investment" as const,
          balance: usdtReserve,
        };
      }
      return acc;
    });

    const enrichedMarketAccounts = result.marketAccounts.map((acc) => {
      if (cryptoWallet && acc.id === cryptoWallet.id && usdtReserve > 0) {
        return {
          ...acc,
          classification: "investment" as const,
          balance: usdtReserve,
        };
      }
      return acc;
    });

    // Operating Liquid Position = Operating Bank & Cash ONLY (USDT is in Investment Portfolio)
    const operatingLiquidCash = result.liquidCapital;
    const updatedTotalAssets =
      operatingLiquidCash + adjustedMarketAssets + result.fixedAssets;
    const updatedNetWorth = updatedTotalAssets - result.totalLiabilities;

    return {
      ...result,
      allAccounts: enrichedAllAccounts,
      marketAccounts: enrichedMarketAccounts,
      totalAssets: updatedTotalAssets,
      netWorth: updatedNetWorth,
      liquidCapital: operatingLiquidCash,
      liquidWalletCash: operatingLiquidCash,
      usdtReserve,
      usdtMarketValue: usdtReserve,
      recordedCryptoBalance,
      totalLiquidPosition: operatingLiquidCash,
      liquidAssets: operatingLiquidCash,
      investmentAssets: adjustedMarketAssets,
      marketAssets: adjustedMarketAssets,
      liabilities: result.totalLiabilities,
      wallets: scopedWallets,
      allTxs: scopedTxs,
    };
  }, [wallets, allTxs, activeSpaceId, filterTransactionsBySpace, user?.id, holdingsTick, prefTick]);
}


