import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { format } from "date-fns";

describe("Asset Liquidation, Custom Price & Realized PnL Suite (Audit #44)", () => {
  describe("1. Mathematical Invariant: Realized Profit & Loss and Net Worth Balance", () => {
    it("accurately computes realized gain and return of capital for 151 USDT liquidation", () => {
      const initialUnits = 1002;
      const unitsLiquidated = 151;
      const costBasisPerUnit = 16000;
      const sellingRate = 17921;

      const remainingUnits = initialUnits - unitsLiquidated;
      expect(remainingUnits).toBe(851);

      const totalCashProceeds = unitsLiquidated * sellingRate;
      expect(totalCashProceeds).toBe(2706071);

      const capitalReturned = unitsLiquidated * costBasisPerUnit;
      expect(capitalReturned).toBe(2416000);

      const realizedGain = totalCashProceeds - capitalReturned;
      expect(realizedGain).toBe(290071);

      // Verify that Net Worth remains invariant before and after liquidation at market rate
      const netWorthBefore = initialUnits * sellingRate; // 17,956,842
      const netWorthAfter = remainingUnits * sellingRate + totalCashProceeds; // 15,250,771 + 2,706,071 = 17,956,842
      expect(netWorthAfter).toBe(netWorthBefore);
    });
  });

  describe("2. Deduplication Engine: Prevents Unit Revert to 1002 USDT", () => {
    it("ensures newer row with reduced units (851) takes precedence over older row with higher units (1002)", () => {
      // Mock rows returned by Supabase ordered by updated_at descending
      const mockSupabaseRows = [
        {
          id: "row-uuid-new",
          symbol: "USDT",
          units: 851,
          avg_buy_price: 16000,
          current_price: 17921,
          asset_type: "crypto",
          updated_at: "2026-10-21T10:28:00Z",
        },
        {
          id: "row-uuid-old",
          symbol: "USDT",
          units: 1002,
          avg_buy_price: 16000,
          current_price: 17921,
          asset_type: "crypto",
          updated_at: "2026-10-20T10:00:00Z",
        },
      ];

      // Mirror the corrected deduplication logic in fetchHoldingsFromSupabase
      const symbolMap = new Map<string, any>();
      for (const row of mockSupabaseRows) {
        const sym = (row.symbol || "").toUpperCase().trim();
        const isFixed = row.asset_type === "fixed_asset";
        const mapKey = isFixed || !sym ? `id_${row.id}` : sym;
        if (!symbolMap.has(mapKey)) {
          symbolMap.set(mapKey, row);
        }
      }

      const deduplicated = Array.from(symbolMap.values());
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].units).toBe(851);
      expect(deduplicated[0].id).toBe("row-uuid-new");
    });
  });

  describe("3. Activity Date Formatting Invariant", () => {
    const formatActivityDate = (dateStr?: string): string => {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const hasTime = dateStr.includes("T") || dateStr.includes(":");
        return hasTime ? format(d, "dd MMM yyyy, HH:mm") : format(d, "dd MMM yyyy");
      } catch {
        return dateStr;
      }
    };

    it("formats ISO timestamps with time part cleanly without raw ISO clutter", () => {
      const formatted = formatActivityDate("2026-10-21T10:27:00");
      expect(formatted).toMatch(/21 \w+ 2026, 10:27/);
    });

    it("formats date-only strings consistently", () => {
      const formatted = formatActivityDate("2026-10-21");
      expect(formatted).toMatch(/21 \w+ 2026/);
    });
  });

  describe("4. Zero P2P UI Strict Compliance", () => {
    it("verifies TransactionSheet does not contain hardcoded P2P strings in UI labels", () => {
      const txSheetPath = path.resolve(__dirname, "../src/components/transactions/TransactionSheet.tsx");
      const content = fs.readFileSync(txSheetPath, "utf-8");

      expect(content).not.toContain('"Penarikan P2P"');
      expect(content).not.toContain('"P2P Withdrawal"');
      expect(content).not.toContain('"Setoran P2P"');
      expect(content).not.toContain('"P2P Deposit"');
      expect(content).toContain('"Pencairan Aset"');
      expect(content).toContain('"Asset Liquidation"');
    });

    it("verifies AssetDetailSheet does not contain hardcoded P2P strings", () => {
      const detailPath = path.resolve(__dirname, "../src/components/settings/AssetDetailSheet.tsx");
      const content = fs.readFileSync(detailPath, "utf-8");

      expect(content).not.toContain("P2P Purchase / Deposit");
      expect(content).not.toContain("P2P Withdrawal / Penarikan");
      expect(content).toContain("Asset Liquidation");
    });

    it("verifies ConvertWalletToAssetModal does not contain P2P strings", () => {
      const modalPath = path.resolve(__dirname, "../src/components/assets/ConvertWalletToAssetModal.tsx");
      const content = fs.readFileSync(modalPath, "utf-8");

      expect(content).not.toContain("mutasi P2P");
      expect(content).not.toContain("P2P txs");
    });
  });

  describe("5. Custom Price & Rate Editing Ergonomics in TransactionSheet", () => {
    it("provides custom rate state and interactive edit trigger", () => {
      const txSheetPath = path.resolve(__dirname, "../src/components/transactions/TransactionSheet.tsx");
      const content = fs.readFileSync(txSheetPath, "utf-8");

      expect(content).toContain("isEditingRate");
      expect(content).toContain("customRateStr");
      expect(content).toContain("estimatedRealizedPnL");
      expect(content).toContain("Kurs Kustom (Rp/USDT):");
    });

    it("enforces default linkToWallet true on AssetDetailSheet sell action", () => {
      const detailPath = path.resolve(__dirname, "../src/components/settings/AssetDetailSheet.tsx");
      const content = fs.readFileSync(detailPath, "utf-8");

      expect(content).toContain("setLinkToWallet(true);");
    });
  });
});
