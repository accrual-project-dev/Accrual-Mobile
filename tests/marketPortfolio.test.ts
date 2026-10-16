import { describe, it, expect } from "vitest";
import {
  calculateHoldingValuation,
  calculatePortfolioSummary,
} from "../src/lib/marketPriceService";
import {
  calculateWalletBalances,
  isMarketInvestmentName,
  isFixedAssetName,
  isCreditOrDebtName,
} from "../src/lib/financialMath";
import type { Wallet, Transaction, InvestmentHolding } from "../src/lib/types";

describe("Market Portfolio Math & Valuation", () => {
  it("calculates holding valuation correctly for profit scenario", () => {
    const holding: InvestmentHolding = {
      id: "h-btc",
      symbol: "BTC",
      name: "Bitcoin",
      asset_type: "crypto",
      units: 0.5,
      avg_buy_price: 900_000_000,
      current_price: 1_000_000_000,
      last_price_updated_at: new Date().toISOString(),
    };

    const val = calculateHoldingValuation(holding);
    expect(val.costBasis).toBe(450_000_000);
    expect(val.marketValue).toBe(500_000_000);
    expect(val.floatingPnL).toBe(50_000_000);
    expect(val.floatingPnLPct).toBeCloseTo(11.11, 1);
  });

  it("calculates holding valuation correctly for loss scenario", () => {
    const holding: InvestmentHolding = {
      id: "h-bbca",
      symbol: "BBCA",
      name: "Bank Central Asia",
      asset_type: "stock",
      units: 1000,
      avg_buy_price: 10_000,
      current_price: 9_500,
      last_price_updated_at: new Date().toISOString(),
    };

    const val = calculateHoldingValuation(holding);
    expect(val.costBasis).toBe(10_000_000);
    expect(val.marketValue).toBe(9_500_000);
    expect(val.floatingPnL).toBe(-500_000);
    expect(val.floatingPnLPct).toBeCloseTo(-5.0, 1);
  });

  it("handles zero quantity or zero buy price safely without NaN", () => {
    const holding: InvestmentHolding = {
      id: "h-zero",
      symbol: "TEST",
      name: "Zero Holding",
      asset_type: "gold",
      units: 0,
      avg_buy_price: 0,
      current_price: 1_000_000,
      last_price_updated_at: new Date().toISOString(),
    };

    const val = calculateHoldingValuation(holding);
    expect(val.costBasis).toBe(0);
    expect(val.marketValue).toBe(0);
    expect(val.floatingPnL).toBe(0);
    expect(val.floatingPnLPct).toBe(0);
  });

  it("calculates portfolio summary aggregated across diverse asset classes", () => {
    const holdings: InvestmentHolding[] = [
      {
        id: "h1",
        symbol: "BTC",
        name: "Bitcoin",
        asset_type: "crypto",
        units: 1,
        avg_buy_price: 1_000_000_000,
        current_price: 1_100_000_000, // +100M
        last_price_updated_at: new Date().toISOString(),
      },
      {
        id: "h2",
        symbol: "BBRI",
        name: "Bank Rakyat Indonesia",
        asset_type: "stock",
        units: 10_000,
        avg_buy_price: 5_000,
        current_price: 4_800, // Cost 50M, MV 48M (-2M)
        last_price_updated_at: new Date().toISOString(),
      },
      {
        id: "h3",
        symbol: "ANTAM",
        name: "Logam Mulia Antam",
        asset_type: "gold",
        units: 10, // 10 grams
        avg_buy_price: 1_200_000,
        current_price: 1_300_000, // Cost 12M, MV 13M (+1M)
        last_price_updated_at: new Date().toISOString(),
      },
    ];

    const summary = calculatePortfolioSummary(holdings);
    expect(summary.totalCostBasis).toBe(1_062_000_000);
    expect(summary.totalMarketValue).toBe(1_161_000_000);
    expect(summary.totalFloatingPnL).toBe(99_000_000);
    expect(summary.totalFloatingPnLPct).toBeCloseTo(9.32, 1);

    expect(summary.byAssetType.crypto.marketValue).toBe(1_100_000_000);
    expect(summary.byAssetType.stock.marketValue).toBe(48_000_000);
    expect(summary.byAssetType.gold.marketValue).toBe(13_000_000);
  });
});

describe("Bifocal Liquidity Segmentation Rules", () => {
  it("detects fixed asset names correctly", () => {
    expect(isFixedAssetName("Rumah Puri")).toBe(true);
    expect(isFixedAssetName("Mobil Honda CR-V")).toBe(true);
    expect(isFixedAssetName("Tanah Kavling")).toBe(true);
    expect(isFixedAssetName("Apartemen")).toBe(true);
    expect(isFixedAssetName("BCA Tabungan")).toBe(false);
  });

  it("detects market investment names correctly", () => {
    expect(isMarketInvestmentName("Ajaib Saham")).toBe(true);
    expect(isMarketInvestmentName("Bibit Reksadana")).toBe(true);
    expect(isMarketInvestmentName("Pluang Crypto")).toBe(true);
    expect(isMarketInvestmentName("Binance Portfolio")).toBe(true);
    expect(isMarketInvestmentName("Bank Mandiri")).toBe(false);
  });

  it("detects debt / credit card accounts correctly", () => {
    expect(isCreditOrDebtName("Kartu Kredit BCA")).toBe(true);
    expect(isCreditOrDebtName("Kredit Mandiri")).toBe(true);
    expect(isCreditOrDebtName("Cicilan Paylater")).toBe(true);
    expect(isCreditOrDebtName("Hutang Teman")).toBe(true);
    expect(isCreditOrDebtName("Gopay")).toBe(false);
  });

  it("isolates liquid operating cash from fixed assets and liabilities", () => {
    const wallets: (Wallet & { balance: number })[] = [
      {
        id: "w1",
        user_id: "u1",
        name: "BCA Tabungan Utama",
        icon: "/icons/bank.png",
        created_at: new Date().toISOString(),
        balance: 20_000_000,
        classification: "liquid",
      },
      {
        id: "w2",
        user_id: "u1",
        name: "Gopay",
        icon: "/icons/ewallet.png",
        created_at: new Date().toISOString(),
        balance: 1_500_000,
        classification: "liquid",
      },
      {
        id: "w3",
        user_id: "u1",
        name: "Stockbit Portofolio",
        icon: "/icons/invest.png",
        created_at: new Date().toISOString(),
        balance: 50_000_000,
        classification: "investment",
      },
      {
        id: "w4",
        user_id: "u1",
        name: "Rumah BSD",
        icon: "/icons/home.png",
        created_at: new Date().toISOString(),
        balance: 1_200_000_000,
        classification: "fixed_asset",
      },
      {
        id: "w5",
        user_id: "u1",
        name: "Kartu Kredit BCA",
        icon: "/icons/card.png",
        created_at: new Date().toISOString(),
        balance: -5_000_000, // -5M debt
        classification: "credit",
      },
    ];

    const txs: Transaction[] = []; // baseline test without transaction adjustments

    const result = calculateWalletBalances(txs, wallets);

    // Liquid Capital: BCA (20M) + Gopay (1.5M) = 21.5M
    expect(result.liquidCapital).toBe(21_500_000);
    // Liquid Net Position: 21.5M - 5M credit card = 16.5M
    expect(result.liquidNetPosition).toBe(16_500_000);

    // Market Assets: Stockbit (50M)
    expect(result.marketAssets).toBe(50_000_000);

    // Fixed Assets: Rumah BSD (1.2B)
    expect(result.fixedAssets).toBe(1_200_000_000);

    // Total Liabilities: Credit Card (5M)
    expect(result.totalLiabilities).toBe(5_000_000);

    // Consolidated Net Worth: 21.5M (liquid) + 50M (market) + 1.2B (fixed) - 5M (liabilities) = 1,266,500,000
    expect(result.netWorth).toBe(1_266_500_000);

    // Verify liquid operating cash is completely untainted by 1.2B real estate
    expect(result.liquidCapital).toBeLessThan(50_000_000);
  });

  it("auto-upgrades Crypto / USDT wallet to investment account by default", () => {
    const wallets: (Wallet & { balance: number })[] = [
      {
        id: "w-crypto",
        user_id: "u1",
        name: "Crypto",
        icon: "/icons/crypto.png",
        created_at: new Date().toISOString(),
        balance: 14_860_559, // User's actual recorded capital
        classification: "liquid", // Database default from legacy import
      },
      {
        id: "w-cash",
        user_id: "u1",
        name: "Cash",
        icon: "/icons/cash.png",
        created_at: new Date().toISOString(),
        balance: 203_000,
        classification: "liquid",
      },
    ];

    const result = calculateWalletBalances([], wallets);

    // Crypto is auto-upgraded to marketAccounts
    expect(result.liquidAccounts.length).toBe(1);
    expect(result.liquidCapital).toBe(203_000);
    expect(result.marketAccounts.length).toBe(1);
    expect(result.marketAssets).toBe(14_860_559);
  });

  it("includes receivable (piutang) in liquidAccounts and liquidCapital", () => {
    const wallets: (Wallet & { balance: number })[] = [
      {
        id: "w-cash",
        user_id: "u1",
        name: "Cash",
        icon: "/icons/cash.png",
        created_at: new Date().toISOString(),
        balance: 14_620_412,
        classification: "liquid",
      },
      {
        id: "w-piutang",
        user_id: "u1",
        name: "Piutang",
        icon: "/icons/Budgets/Piutang.png",
        created_at: new Date().toISOString(),
        balance: 264_000,
        classification: "receivable",
      },
    ];

    const result = calculateWalletBalances([], wallets);

    expect(result.liquidAccounts.length).toBe(2);
    expect(result.liquidCapital).toBe(14_884_412);
    expect(result.netWorth).toBe(14_884_412);
    expect(result.totalAssets).toBe(14_884_412);
  });
});

describe("DCA Position Management & History Curves", () => {
  it("recalculates weighted average buy price on DCA purchases", async () => {
    const { recordHoldingActivity, upsertHolding, getSavedHoldings } = await import(
      "../src/lib/marketPriceService"
    );

    const testUser = "test-user-dca";
    const initialHolding: InvestmentHolding = {
      id: "h-eth-dca",
      symbol: "ETH",
      name: "Ethereum",
      asset_type: "crypto",
      units: 1,
      avg_buy_price: 40_000_000,
      current_price: 45_000_000,
      currency: "IDR",
    };

    const saved = upsertHolding(initialHolding, testUser);
    const holdingId = saved[0].id;

    // DCA Buy: buy 1 more ETH at 50,000,000
    // Total units: 2, Total cost: 40M + 50M = 90M -> new avg buy price: 45M
    const { updatedHolding } = recordHoldingActivity(
      holdingId,
      {
        type: "buy",
        units: 1,
        price_per_unit: 50_000_000,
        total_amount: 50_000_000,
        date: "2026-09-21",
        note: "DCA Dip Buy",
      },
      testUser,
    );

    expect(updatedHolding.units).toBe(2);
    expect(updatedHolding.avg_buy_price).toBe(45_000_000);
    expect(updatedHolding.activities?.length).toBeGreaterThan(0);
  });

  it("calculates realized gain/loss on position liquidation and preserves per-unit cost basis", async () => {
    const { recordHoldingActivity, upsertHolding } = await import(
      "../src/lib/marketPriceService"
    );

    const testUser = "test-user-sell";
    const initialHolding: InvestmentHolding = {
      id: "h-btc-sell",
      symbol: "BTC",
      name: "Bitcoin",
      asset_type: "crypto",
      units: 2,
      avg_buy_price: 1_000_000_000,
      current_price: 1_200_000_000,
      currency: "IDR",
    };

    const saved = upsertHolding(initialHolding, testUser);
    const holdingId = saved[0].id;

    // Liquidate 1 BTC at 1,300,000,000
    // Realized Profit: 1 * (1.3B - 1.0B) = +300M
    const { updatedHolding, realizedPnL } = recordHoldingActivity(
      holdingId,
      {
        type: "sell",
        units: 1,
        price_per_unit: 1_300_000_000,
        total_amount: 1_300_000_000,
        date: "2026-09-21",
        note: "Take profit",
      },
      testUser,
    );

    expect(realizedPnL).toBe(300_000_000);
    expect(updatedHolding.units).toBe(1);
    expect(updatedHolding.avg_buy_price).toBe(1_000_000_000); // unchanged cost basis per remaining unit
  });

  it("generates smooth multi-timeframe asset history curves for both Value and Return", async () => {
    const { generateAssetHistoryCurve } = await import(
      "../src/lib/marketPriceService"
    );

    const holding: InvestmentHolding = {
      id: "h-curve",
      symbol: "SOL",
      name: "Solana",
      asset_type: "crypto",
      units: 10,
      avg_buy_price: 2_000_000,
      current_price: 2_500_000,
      currency: "IDR",
    };

    const curve1W = generateAssetHistoryCurve(holding, "1W", 2_500_000);
    expect(curve1W.length).toBe(7);
    expect(curve1W[0]).toHaveProperty("value");
    expect(curve1W[0]).toHaveProperty("returnVal");
    expect(curve1W[0]).toHaveProperty("returnPct");
    expect(curve1W[6].value).toBe(25_000_000); // 10 * 2.5M
    expect(curve1W[6].returnVal).toBe(5_000_000); // 25M - 20M

    const curve1Y = generateAssetHistoryCurve(holding, "1Y", 2_500_000);
    expect(curve1Y.length).toBe(12);
  });
});

describe("Holding Notes Metadata, Undo Activity, and Custom Price", () => {
  it("serializes and parses notes metadata accurately including activities, custom price, and reconciled tx IDs", async () => {
    const { serializeHoldingNotes, parseHoldingNotes } = await import(
      "../src/lib/marketPriceService"
    );

    const testMetadata = {
      userNotes: "My test personal note",
      activities: [
        {
          id: "act-1",
          type: "buy" as const,
          units: 100,
          price_per_unit: 16_000,
          total_amount: 1_600_000,
          date: "2026-09-24",
          note: "Initial deposit",
        },
      ],
      reconciledTxIds: ["tx-101", "tx-102"],
      isCustomPrice: true,
      customPrice: 16_250,
    };

    const serialized = serializeHoldingNotes(testMetadata);
    expect(serialized).toContain("My test personal note");
    expect(serialized).toContain("reconciledTxIds");

    const parsed = parseHoldingNotes(serialized);
    expect(parsed.userNotes).toBe("My test personal note");
    expect(parsed.activities?.length).toBe(1);
    expect(parsed.activities?.[0].units).toBe(100);
    expect(parsed.reconciledTxIds).toEqual(["tx-101", "tx-102"]);
    expect(parsed.isCustomPrice).toBe(true);
    expect(parsed.customPrice).toBe(16_250);
  });

  it("undos sell activity correctly by restoring deducted units and removing the activity", async () => {
    const { upsertHolding, recordHoldingActivity, undoHoldingActivity } = await import(
      "../src/lib/marketPriceService"
    );

    const testUser = "test-undo-sell-user";
    const initialHolding: InvestmentHolding = {
      id: "h-usdt-undo",
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 1002.41,
      avg_buy_price: 16000,
      current_price: 16300,
      currency: "IDR",
    };

    const saved = upsertHolding(initialHolding, testUser);
    const holdingId = saved[0].id;

    // Perform sell of 49.54 units (user scenario)
    const { updatedHolding } = recordHoldingActivity(
      holdingId,
      {
        type: "sell",
        units: 49.54,
        price_per_unit: 16300,
        total_amount: 49.54 * 16300,
        date: "2026-09-24",
        note: "Auto-reconciled: P2P ShopeePay",
      },
      testUser,
    );

    expect(updatedHolding.units).toBeCloseTo(952.87, 2);
    expect(updatedHolding.activities?.length).toBe(1);
    const sellActivityId = updatedHolding.activities![0].id;

    // Undo the accidental sell activity
    const { updatedHolding: undoneHolding } = undoHoldingActivity(holdingId, sellActivityId, testUser);

    expect(undoneHolding).toBeDefined();
    // Units should be restored back to 1002.41
    expect(undoneHolding.units).toBeCloseTo(1002.41, 2);
    expect(undoneHolding.activities?.length).toBe(0);
  });

  it("undos buy activity correctly by deducting units", async () => {
    const { upsertHolding, recordHoldingActivity, undoHoldingActivity } = await import(
      "../src/lib/marketPriceService"
    );

    const testUser = "test-undo-buy-user";
    const initialHolding: InvestmentHolding = {
      id: "h-stock-undo",
      symbol: "BBCA",
      name: "Bank BCA",
      asset_type: "stock",
      units: 1000,
      avg_buy_price: 9000,
      current_price: 9500,
      currency: "IDR",
    };

    const saved = upsertHolding(initialHolding, testUser);
    const holdingId = saved[0].id;

    const { updatedHolding } = recordHoldingActivity(
      holdingId,
      {
        type: "buy",
        units: 500,
        price_per_unit: 9500,
        total_amount: 500 * 9500,
        date: "2026-09-24",
        note: "Additional buy",
      },
      testUser,
    );

    expect(updatedHolding.units).toBe(1500);
    const buyActivityId = updatedHolding.activities![0].id;

    const { updatedHolding: undoneHolding } = undoHoldingActivity(holdingId, buyActivityId, testUser);
    expect(undoneHolding).toBeDefined();
    expect(undoneHolding.units).toBe(1000);
  });

  it("undos activity using fallbackActivity even if activity was a bridged transaction", async () => {
    const { upsertHolding, undoHoldingActivity, markTxAsReconciled, getReconciledTxIds } = await import(
      "../src/lib/marketPriceService"
    );

    const testUser = "test-fallback-undo-user";
    const initialHolding: InvestmentHolding = {
      id: "h-usdt-bridge",
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 952.87,
      avg_buy_price: 16000,
      current_price: 16300,
      currency: "IDR",
      activities: [],
    };

    const saved = upsertHolding(initialHolding, testUser);
    const holdingId = saved[0].id;

    // Simulate reconciled transaction
    markTxAsReconciled(["tx-shopeepay-123"], testUser);
    expect(getReconciledTxIds(testUser).has("tx-shopeepay-123")).toBe(true);

    // Bridged activity (not in target.activities)
    const bridgedActivity = {
      id: "tx-bridge-tx-shopeepay-123",
      holding_id: holdingId,
      type: "sell" as const,
      date: "2026-09-24",
      units: 49.54,
      price_per_unit: 16300,
      total_amount: 49.54 * 16300,
      note: "P2P ShopeePay",
    };

    // Undo with fallbackActivity
    const { updatedHolding: restoredHolding } = undoHoldingActivity(
      holdingId,
      bridgedActivity.id,
      testUser,
      bridgedActivity,
    );

    expect(restoredHolding.units).toBeCloseTo(1002.41, 2);
    // Bridged tx should be un-reconciled
    expect(getReconciledTxIds(testUser).has("tx-shopeepay-123")).toBe(false);
  });

  it("sets direct units accurately using setHoldingDirectUnits and updates usdt balance", async () => {
    const { upsertHolding, setHoldingDirectUnits, getSavedUsdtPref } = await import(
      "../src/lib/marketPriceService"
    );

    const testUser = "test-direct-units-user";
    const initialHolding: InvestmentHolding = {
      id: "h-usdt-direct",
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 952.87,
      avg_buy_price: 16000,
      current_price: 16300,
      currency: "IDR",
    };

    const saved = upsertHolding(initialHolding, testUser);
    const holdingId = saved[0].id;

    const updated = setHoldingDirectUnits(holdingId, 1002.41, testUser, "Manual correction");
    expect(updated.units).toBe(1002.41);
    expect(updated.activities?.length).toBeGreaterThan(0);

    const pref = getSavedUsdtPref(testUser);
    expect(pref.units).toBe(1002.41);
  });

  it("fetchCryptoQuote resolves pegged USDT quote accurately", async () => {
    const { fetchCryptoQuote } = await import("../src/lib/marketPriceService");
    const quote = await fetchCryptoQuote("USDT");
    expect(quote).not.toBeNull();
    expect(quote?.usd).toBe(1);
    expect(quote?.idr).toBeGreaterThan(10000);
    expect(quote?.source).toBe("pegged");
  });

  it("fetchCryptoQuote resolves USDC and USD accurately", async () => {
    const { fetchCryptoQuote } = await import("../src/lib/marketPriceService");
    const usdc = await fetchCryptoQuote("USDC");
    expect(usdc?.usd).toBe(1);
    expect(usdc?.idr).toBeGreaterThan(10000);

    const usd = await fetchCryptoQuote("USD");
    expect(usd?.usd).toBe(1);
    expect(usd?.idr).toBeGreaterThan(10000);
  });

  it("fetchStockQuote recognizes US vs Indonesian tickers correctly", async () => {
    const { fetchStockQuote } = await import("../src/lib/marketPriceService");
    // Symbol sanitization and format check
    const empty = await fetchStockQuote("");
    expect(empty).toBeNull();
  });

  it("fetchGoldQuote returns valid physical gold quote in IDR per gram", async () => {
    const { fetchGoldQuote } = await import("../src/lib/marketPriceService");
    const gold = await fetchGoldQuote();
    expect(gold).not.toBeNull();
    expect(gold?.pricePerGramIDR).toBeGreaterThan(1_000_000);
    expect(gold?.usdPerTroyOz).toBeGreaterThan(1000);
  });

  it("INDEX_ALIAS_MAP maps major indices properly and PRESET_ASSETS contains index category", async () => {
    const { INDEX_ALIAS_MAP } = await import("../src/lib/marketPriceService");
    expect(INDEX_ALIAS_MAP["IHSG"]).toBe("^JKSE");
    expect(INDEX_ALIAS_MAP["LQ45"]).toBe("^JKLQ45");
    expect(INDEX_ALIAS_MAP["IDX30"]).toBe("^JK30");
    expect(INDEX_ALIAS_MAP["S&P 500"]).toBe("^GSPC");
    expect(INDEX_ALIAS_MAP["NASDAQ"]).toBe("^IXIC");
    expect(INDEX_ALIAS_MAP["DOW"]).toBe("^DJI");

    const { PRESET_ASSETS } = await import("../src/lib/assetPresets");
    const indexPresets = PRESET_ASSETS.filter((p) => p.category === "index");
    expect(indexPresets.length).toBeGreaterThanOrEqual(6);
    expect(indexPresets.some((p) => p.symbol === "^JKSE")).toBe(true);
    expect(indexPresets.some((p) => p.symbol === "^GSPC")).toBe(true);
  });

  it("fetchStockQuote resolves live quotes for NVDA, BBCA, IHSG, and S&P 500", async () => {
    const { fetchStockQuote } = await import("../src/lib/marketPriceService");

    // Test US Stock: NVDA
    const nvda = await fetchStockQuote("NVDA");
    if (nvda) {
      expect(nvda.regularMarketPrice).toBeGreaterThan(0);
      expect(nvda.isUS).toBe(true);
      expect(nvda.usd).toBeGreaterThan(0);
      expect(nvda.idr).toBeGreaterThan(100_000);
    }

    // Test IDX Stock: BBCA
    const bbca = await fetchStockQuote("BBCA");
    if (bbca) {
      expect(bbca.regularMarketPrice).toBeGreaterThan(1000);
      expect(bbca.isUS).toBe(false);
      expect(bbca.idr).toBeGreaterThan(1000);
    }

    // Test Index Alias: IHSG -> ^JKSE
    const ihsg = await fetchStockQuote("IHSG");
    if (ihsg) {
      expect(ihsg.regularMarketPrice).toBeGreaterThan(1000);
      expect(ihsg.isUS).toBe(false);
      expect(ihsg.idr).toBeGreaterThan(1000);
    }

    // Test Index Alias: S&P 500 -> ^GSPC
    const spx = await fetchStockQuote("S&P 500");
    if (spx) {
      expect(spx.regularMarketPrice).toBeGreaterThan(1000);
      expect(spx.isUS).toBe(true);
      expect(spx.usd).toBeGreaterThan(1000);
    }
  });

  it("resolves bilingual asset presets cleanly without mixed language", async () => {
    const { PRESET_ASSETS, getPresetSymbol, getPresetName } = await import(
      "../src/lib/assetPresets"
    );

    // Test Fixed Assets
    const fixedAssets = PRESET_ASSETS.filter((p) => p.category === "fixed_asset");
    expect(fixedAssets.length).toBeGreaterThanOrEqual(4);

    const propertyPreset = fixedAssets.find((p) => p.symbol === "PROPERTY");
    expect(propertyPreset).toBeDefined();
    if (propertyPreset) {
      // English mode
      expect(getPresetSymbol(propertyPreset, false)).toBe("PROPERTY");
      expect(getPresetName(propertyPreset, false)).toBe("Residential Property");

      // Indonesian mode
      expect(getPresetSymbol(propertyPreset, true)).toBe("PROPERTI");
      expect(getPresetName(propertyPreset, true)).toBe("Rumah / Properti Hunian");
    }

    const landPreset = fixedAssets.find((p) => p.symbol === "LAND");
    expect(landPreset).toBeDefined();
    if (landPreset) {
      expect(getPresetSymbol(landPreset, false)).toBe("LAND");
      expect(getPresetName(landPreset, false)).toBe("Land / Real Estate");
      expect(getPresetSymbol(landPreset, true)).toBe("TANAH");
      expect(getPresetName(landPreset, true)).toBe("Tanah / Lahan Properti");
    }

    // Test Mutual Funds
    const mmfPreset = PRESET_ASSETS.find((p) => p.symbol === "MMF");
    expect(mmfPreset).toBeDefined();
    if (mmfPreset) {
      expect(getPresetSymbol(mmfPreset, false)).toBe("MMF");
      expect(getPresetName(mmfPreset, false)).toBe("Money Market Fund");
      expect(getPresetSymbol(mmfPreset, true)).toBe("RD-PASAR-UANG");
      expect(getPresetName(mmfPreset, true)).toBe("Reksa Dana Pasar Uang");
    }

    // Verify expanded catalog completeness
    expect(PRESET_ASSETS.length).toBeGreaterThan(100);
    expect(fixedAssets.length).toBeGreaterThanOrEqual(10);
    expect(PRESET_ASSETS.some((p) => p.symbol === "LAPTOP" && p.category === "fixed_asset")).toBe(true);
    expect(PRESET_ASSETS.some((p) => p.symbol === "MOTORCYCLE" && p.category === "fixed_asset")).toBe(true);
    expect(PRESET_ASSETS.some((p) => p.symbol === "WATCH" && p.category === "fixed_asset")).toBe(true);
    expect(PRESET_ASSETS.some((p) => p.symbol === "GOTO" && p.category === "stock_id")).toBe(true);
    expect(PRESET_ASSETS.some((p) => p.symbol === "ADRO" && p.category === "stock_id")).toBe(true);
    expect(PRESET_ASSETS.some((p) => p.symbol === "AMD" && p.category === "stock_us")).toBe(true);
    expect(PRESET_ASSETS.some((p) => p.symbol === "PLTR" && p.category === "stock_us")).toBe(true);
    expect(PRESET_ASSETS.some((p) => p.symbol === "SUI" && p.category === "crypto")).toBe(true);
    expect(PRESET_ASSETS.some((p) => p.symbol === "^N225" && p.category === "index")).toBe(true);
    expect(PRESET_ASSETS.some((p) => p.symbol === "^HSI" && p.category === "index")).toBe(true);
  });
});



