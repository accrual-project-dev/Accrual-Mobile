import { describe, it, expect } from "vitest";
import {
  extractCryptoMetadataFromTx,
  appendCryptoMetadataToNote,
  estimateHistoricalUsdtBuyRate,
} from "../src/lib/holdingSyncEngine";
import type { Transaction, HoldingActivity } from "../src/lib/types";

describe("Historical Crypto Rate & Price Transparency", () => {
  describe("extractCryptoMetadataFromTx", () => {
    it("extracts empirical rate and units from structured note tags", () => {
      const tx: Partial<Transaction> = {
        id: "tx-1",
        amount: 1650000,
        note: "Pencairan USDT ke Seabank [Kurs: Rp 16.500 | 100 USDT]",
      };

      const meta = extractCryptoMetadataFromTx(tx as Transaction);
      expect(meta.rate).toBe(16500);
      expect(meta.units).toBe(100);
      expect(meta.source).toBe("note_tag");
      expect(meta.isEmpirical).toBe(true);
    });

    it("extracts empirical rate with decimal formatted note tags", () => {
      const tx: Partial<Transaction> = {
        id: "tx-2",
        amount: 2717486,
        note: "Liquidation [Kurs: Rp 16.480,50 | 164.896 USDT]",
      };

      const meta = extractCryptoMetadataFromTx(tx as Transaction);
      expect(meta.rate).toBe(16480.5);
      expect(meta.units).toBe(164.896);
      expect(meta.source).toBe("note_tag");
      expect(meta.isEmpirical).toBe(true);
    });

    it("extracts empirical rate from linked holding activities if tx note lacks tag", () => {
      const tx: Partial<Transaction> = {
        id: "tx-uuid-1234",
        amount: 2717486,
        occurred_on: "2026-10-19T10:00:00",
        note: "Transfer to BCA",
      };

      const activities: HoldingActivity[] = [
        {
          id: "act-1",
          holding_id: "holding-usdt",
          type: "sell",
          date: "2026-10-19",
          units: 164.896,
          price_per_unit: 16480,
          total_amount: 2717486,
          note: "Auto-synced from tx tx-uuid-1234 [Kurs: Rp 16.480 | 164.896 USDT]",
        },
      ];

      const meta = extractCryptoMetadataFromTx(tx as Transaction, activities);
      expect(meta.rate).toBe(16480);
      expect(meta.units).toBe(164.896);
      expect(meta.source).toBe("holding_activity");
      expect(meta.isEmpirical).toBe(true);
    });

    it("extracts simple text rate fallback when no structured tag exists", () => {
      const tx: Partial<Transaction> = {
        id: "tx-3",
        amount: 1650000,
        note: "Beli USDT p2p rate: 16.500",
      };

      const meta = extractCryptoMetadataFromTx(tx as Transaction);
      expect(meta.rate).toBe(16500);
      expect(meta.source).toBe("note_simple");
      expect(meta.isEmpirical).toBe(false);
    });

    it("returns none source and isEmpirical false when no rate information exists", () => {
      const tx: Partial<Transaction> = {
        id: "tx-4",
        amount: 50000,
        note: "Makan siang",
      };

      const meta = extractCryptoMetadataFromTx(tx as Transaction);
      expect(meta.rate).toBeUndefined();
      expect(meta.source).toBe("none");
      expect(meta.isEmpirical).toBe(false);
    });
  });

  describe("appendCryptoMetadataToNote", () => {
    it("appends tag cleanly to an empty note", () => {
      const note = appendCryptoMetadataToNote("", 16500, 100, "USDT");
      expect(note).toBe("[Kurs: Rp 16.500 | 100 USDT]");
    });

    it("appends tag cleanly to an existing note without duplicate spaces", () => {
      const note = appendCryptoMetadataToNote("Pencairan dana", 16500, 100, "USDT");
      expect(note).toBe("Pencairan dana [Kurs: Rp 16.500 | 100 USDT]");
    });

    it("replaces existing tag without duplicating tags", () => {
      const existing = "Pencairan dana [Kurs: Rp 16.000 | 90 USDT]";
      const updated = appendCryptoMetadataToNote(existing, 16500, 100, "USDT");
      expect(updated).toBe("Pencairan dana [Kurs: Rp 16.500 | 100 USDT]");
      expect(updated.match(/\[Kurs:/g)?.length).toBe(1);
    });

    it("formats rate only when units is undefined", () => {
      const note = appendCryptoMetadataToNote("Beli koin", 16500, undefined, "USDT");
      expect(note).toBe("Beli koin [Kurs: Rp 16.500]");
    });
  });

  describe("estimateHistoricalUsdtBuyRate", () => {
    it("returns dynamic non-flat rates across different months and days in 2026", () => {
      const rateAug1 = estimateHistoricalUsdtBuyRate("2026-08-01");
      const rateAug20 = estimateHistoricalUsdtBuyRate("2026-08-20");
      const rateSep15 = estimateHistoricalUsdtBuyRate("2026-09-15");
      const rateOct19 = estimateHistoricalUsdtBuyRate("2026-10-19");

      // Verify that rates are not all flat 16480
      const rates = [rateAug1, rateAug20, rateSep15, rateOct19];
      const uniqueRates = new Set(rates);
      expect(uniqueRates.size).toBeGreaterThan(1);

      // Verify realistic bounds for USD/IDR
      for (const r of rates) {
        expect(r).toBeGreaterThanOrEqual(15000);
        expect(r).toBeLessThanOrEqual(18000);
      }
    });

    it("is strictly deterministic for identical dates", () => {
      const rate1 = estimateHistoricalUsdtBuyRate("2026-10-19T14:30:00");
      const rate2 = estimateHistoricalUsdtBuyRate("2026-10-19T22:15:00");
      expect(rate1).toBe(rate2);
    });
  });
});
