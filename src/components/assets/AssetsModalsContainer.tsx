import { lazy, Suspense } from "react";
import type { MetricDrillDownData } from "./AssetMetricDrillDownSheet";
import {
  getSavedHoldings,
  getSavedUsdtPref,
  saveUsdtPref,
  upsertHolding,
  type UsdtValuationPref,
} from "../../lib/marketPriceService";
import type { InvestmentHolding, Wallet } from "../../lib/types";

const AddAssetModal = lazy(() =>
  import("./AddAssetModal").then((m) => ({
    default: m.AddAssetModal,
  })),
);
const ConvertWalletToAssetModal = lazy(() =>
  import("./ConvertWalletToAssetModal").then((m) => ({
    default: m.ConvertWalletToAssetModal,
  })),
);
const ConsolidatedBalanceSheetDrawer = lazy(() =>
  import("./ConsolidatedBalanceSheetDrawer").then((m) => ({
    default: m.ConsolidatedBalanceSheetDrawer,
  })),
);
const AssetDetailSheet = lazy(() =>
  import("../settings/AssetDetailSheet").then((m) => ({
    default: m.AssetDetailSheet,
  })),
);
const StakingYieldModal = lazy(() =>
  import("../settings/StakingYieldModal").then((m) => ({
    default: m.StakingYieldModal,
  })),
);
const AssetMetricDrillDownSheet = lazy(() =>
  import("./AssetMetricDrillDownSheet").then((m) => ({
    default: m.AssetMetricDrillDownSheet,
  })),
);

interface AssetsModalsContainerProps {
  userId?: string;
  isAddAssetModalOpen: boolean;
  onCloseAddAssetModal: () => void;
  isConvertModalOpen: boolean;
  onCloseConvertModal: () => void;
  unlinkedCryptoWallet: Wallet | null;
  selectedDetailHolding: InvestmentHolding | null;
  onSelectDetailHolding: (holding: InvestmentHolding | null) => void;
  onDeleteHolding: (id: string, name: string) => void;
  isStakingModalOpen: boolean;
  onCloseStakingModal: () => void;
  isConsolidatedDrawerOpen: boolean;
  onCloseConsolidatedDrawer: () => void;
  selectedMetricDrillDown: MetricDrillDownData | null;
  onCloseMetricDrillDown: () => void;
  holdings: InvestmentHolding[];
  onHoldingsChange: (holdings: InvestmentHolding[]) => void;
  usdtPref: UsdtValuationPref;
  onUsdtPrefChange: (pref: UsdtValuationPref) => void;
  usdtUnits: number;
  usdtRate: number;
  usdtCostBasis: number;
  usdtMarketValue: number;
  usdtFloatingPnLPct: number;
  suggestedUsdtUnits: number;
  recordedCryptoBalance: number;
  netWorth: number;
  totalGrossAssets: number;
  liabilitiesTotal: number;
  liquidAssetsTotal: number;
  growthAssetsTotal: number;
  fixedAssetsTotal: number;
  wallets: Wallet[];
  balancesById: Record<string, number>;
  liquidHoldings: InvestmentHolding[];
  fixedHoldings: InvestmentHolding[];
  onOpenUsdtDetail: () => void;
  onOpenHoldingDetail: (holding: InvestmentHolding) => void;
  isStealthMode: boolean;
  isIndonesian: boolean;
  isDark: boolean;
}

export function AssetsModalsContainer({
  userId,
  isAddAssetModalOpen,
  onCloseAddAssetModal,
  isConvertModalOpen,
  onCloseConvertModal,
  unlinkedCryptoWallet,
  selectedDetailHolding,
  onSelectDetailHolding,
  onDeleteHolding,
  isStakingModalOpen,
  onCloseStakingModal,
  isConsolidatedDrawerOpen,
  onCloseConsolidatedDrawer,
  selectedMetricDrillDown,
  onCloseMetricDrillDown,
  holdings,
  onHoldingsChange,
  usdtPref,
  onUsdtPrefChange,
  usdtUnits,
  usdtRate,
  usdtCostBasis,
  usdtMarketValue,
  usdtFloatingPnLPct,
  suggestedUsdtUnits,
  recordedCryptoBalance,
  netWorth,
  totalGrossAssets,
  liabilitiesTotal,
  liquidAssetsTotal,
  growthAssetsTotal,
  fixedAssetsTotal,
  wallets,
  balancesById,
  liquidHoldings,
  fixedHoldings,
  onOpenUsdtDetail,
  onOpenHoldingDetail,
  isStealthMode,
  isIndonesian,
  isDark,
}: AssetsModalsContainerProps) {
  return (
    <>
      {/* ── Add Asset Modal (Modular iOS 27 Fluid Glass) ──────────────── */}
      {isAddAssetModalOpen && (
        <Suspense fallback={null}>
          <AddAssetModal
            isOpen={isAddAssetModalOpen}
            onClose={onCloseAddAssetModal}
            onSaveHolding={(newH) => {
              const updated = upsertHolding(newH, userId);
              onHoldingsChange(updated);
            }}
            onSaveUsdtPref={(newPref) => {
              onUsdtPrefChange(newPref);
              saveUsdtPref(newPref, userId);
            }}
            usdtRate={usdtPref.rate}
            userId={userId}
          />
        </Suspense>
      )}

      {/* ── Convert / Link Legacy Wallet to Asset Modal ──────────────────── */}
      {isConvertModalOpen && (
        <Suspense fallback={null}>
          <ConvertWalletToAssetModal
            isOpen={isConvertModalOpen}
            onClose={onCloseConvertModal}
            wallet={unlinkedCryptoWallet}
            liveRate={usdtPref.rate}
            userId={userId}
            onSuccess={(_h, pref) => {
              onUsdtPrefChange(pref);
              onHoldingsChange(getSavedHoldings(userId));
            }}
          />
        </Suspense>
      )}

      {/* ── Asset Detail Sheet with Transaction Bridge ──────────────────── */}
      {selectedDetailHolding && (
        <Suspense fallback={null}>
          <AssetDetailSheet
            isOpen={!!selectedDetailHolding}
            onClose={() => onSelectDetailHolding(null)}
            holding={selectedDetailHolding}
            onHoldingUpdated={() => {
              const freshHoldings = getSavedHoldings(userId);
              onHoldingsChange(freshHoldings);
              const freshUsdt = getSavedUsdtPref(userId);
              onUsdtPrefChange(freshUsdt);
              if (selectedDetailHolding) {
                const refreshed = freshHoldings.find(
                  (x) =>
                    x.id === selectedDetailHolding.id ||
                    (x.symbol &&
                      x.symbol.toUpperCase() ===
                        selectedDetailHolding.symbol?.toUpperCase()),
                );
                if (refreshed) onSelectDetailHolding(refreshed);
              }
            }}
            onDeleteHolding={(id, name) => {
              onDeleteHolding(id, name);
              onSelectDetailHolding(null);
            }}
          />
        </Suspense>
      )}

      {/* ── Passive Yield & Dividends Modal ─────────────────────────────── */}
      {isStakingModalOpen && (
        <Suspense fallback={null}>
          <StakingYieldModal
            isOpen={isStakingModalOpen}
            onClose={onCloseStakingModal}
            holdingUnits={usdtUnits}
            liveRate={usdtRate}
            wallets={wallets}
            holdings={holdings}
            userId={userId}
            onSuccess={() => {
              onUsdtPrefChange(getSavedUsdtPref(userId));
              onHoldingsChange(getSavedHoldings(userId));
            }}
          />
        </Suspense>
      )}

      {/* ── Consolidated Balance Sheet Drawer (All Assets & Liabilities) ── */}
      {isConsolidatedDrawerOpen && (
        <Suspense fallback={null}>
          <ConsolidatedBalanceSheetDrawer
            isOpen={isConsolidatedDrawerOpen}
            onClose={onCloseConsolidatedDrawer}
            netWorth={netWorth}
            totalGrossAssets={totalGrossAssets}
            liabilitiesTotal={liabilitiesTotal}
            liquidAssetsTotal={liquidAssetsTotal}
            growthAssetsTotal={growthAssetsTotal}
            fixedAssetsTotal={fixedAssetsTotal}
            usdtPref={{
              units: usdtUnits,
              rate: usdtRate,
              costBasis: usdtCostBasis,
            }}
            usdtMarketValue={usdtMarketValue}
            usdtFloatingPnLPct={usdtFloatingPnLPct}
            suggestedUsdtUnits={suggestedUsdtUnits}
            recordedCryptoBalance={recordedCryptoBalance}
            wallets={wallets}
            balancesById={balancesById}
            liquidHoldings={liquidHoldings}
            fixedHoldings={fixedHoldings}
            onOpenUsdtDetail={onOpenUsdtDetail}
            onOpenHoldingDetail={onOpenHoldingDetail}
            isStealthMode={isStealthMode}
            isIndonesian={isIndonesian}
            isDark={isDark}
          />
        </Suspense>
      )}

      {/* ── Metric Telemetry Drill-Down Sheet (6 Half-Cards) ── */}
      {selectedMetricDrillDown && (
        <Suspense fallback={null}>
          <AssetMetricDrillDownSheet
            data={selectedMetricDrillDown}
            onClose={onCloseMetricDrillDown}
            isStealthMode={isStealthMode}
            isIndonesian={isIndonesian}
          />
        </Suspense>
      )}
    </>
  );
}
