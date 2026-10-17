import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { getArchetypeItems } from "../src/components/onboarding/ArchetypeCardSelector";
import { TOUR_STEPS } from "../src/components/onboarding/ProductTourOverlay";
import { seedOnboardingWallets } from "../src/hooks/useWallets";
import { TX_BACKUP_STORAGE_KEY } from "../src/hooks/useTransactions";

describe("Onboarding Flow, Product Tour & Authentication Gate Workstation (Audit #22)", () => {
  const rootDir = path.resolve(__dirname, "..");

  beforeEach(() => {
    if (typeof globalThis.localStorage === "undefined") {
      const store: Record<string, string> = {};
      (globalThis as any).localStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = String(v);
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          for (const k of Object.keys(store)) delete store[k];
        },
      };
    } else {
      globalThis.localStorage.clear();
    }
  });

  describe("1. Initial Starting Balance & Seeding Integrity", () => {
    it("seeds starting balance with full ISO timestamp format and Indonesian note", async () => {
      localStorage.setItem("trouvaille_guest_mode", "true");

      const wallets = await seedOnboardingWallets(
        undefined,
        [
          {
            name: "Uang Tunai",
            icon: "Banknote",
            classification: "liquid",
          },
        ],
        500000,
        true, // isIndonesian
      );

      expect(wallets.length).toBe(1);
      const rawTxs = localStorage.getItem(TX_BACKUP_STORAGE_KEY);
      expect(rawTxs).toBeTruthy();
      const txs = JSON.parse(rawTxs!);
      expect(txs.length).toBe(1);

      const initTx = txs[0];
      expect(initTx.amount).toBe(500000);
      expect(initTx.note).toBe("Saldo Awal Pembukaan Akun");
      // Must match full ISO timestamp format yyyy-MM-ddTHH:mm:ss
      expect(initTx.occurred_on).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("seeds starting balance with English note when isIndonesian is false", async () => {
      localStorage.setItem("trouvaille_guest_mode", "true");

      await seedOnboardingWallets(
        undefined,
        [
          {
            name: "Physical Cash",
            icon: "Banknote",
            classification: "liquid",
          },
        ],
        1000000,
        false, // English
      );

      const rawTxs = localStorage.getItem(TX_BACKUP_STORAGE_KEY);
      const txs = JSON.parse(rawTxs!);
      const initTx = txs[0];
      expect(initTx.amount).toBe(1000000);
      expect(initTx.note).toBe("Initial Starting Balance");
      expect(initTx.occurred_on).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("2. ArchetypeCardSelector Localization & Adaptive Currency Telemetry", () => {
    it("returns pure Indonesian terminology without mixed English 'Space'", () => {
      const itemsId = getArchetypeItems(true);
      const domainItem = itemsId.find((i) => i.key === "domain");
      expect(domainItem).toBeDefined();
      expect(domainItem?.chipLabel).toBe("Pemisahan Ruang Kas");
      expect(domainItem?.title).toBe("Pemisahan Ruang Kas Pribadi & Usaha");
      expect(domainItem?.subMetric).toContain("ruang kas");
      expect(domainItem?.subMetric).not.toContain("space");

      const expensesItem = itemsId.find((i) => i.key === "expenses");
      expect(expensesItem?.metric).toBe("Rp 140 Rb / hari");
    });

    it("returns adaptive global/USD currency metrics in English mode", () => {
      const itemsEn = getArchetypeItems(false);
      const expensesItem = itemsEn.find((i) => i.key === "expenses");
      expect(expensesItem).toBeDefined();
      expect(expensesItem?.metric).toBe("$15 / day");
      expect(expensesItem?.metric).not.toContain("Rp");

      const domainItem = itemsEn.find((i) => i.key === "domain");
      expect(domainItem?.chipLabel).toBe("Dual Space");
    });
  });

  describe("3. Product Tour Dynamic Island & Zero Gado-Gado Localization", () => {
    it("enforces dynamic notch / Dynamic Island safe-area rule in ProductTourOverlay", () => {
      const overlayPath = path.join(
        rootDir,
        "src/components/onboarding/ProductTourOverlay.tsx",
      );
      const content = fs.readFileSync(overlayPath, "utf-8");
      expect(content).toContain(
        'max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)',
      );
    });

    it("verifies zero mixed bilingual parentheticals in TOUR_STEPS", () => {
      for (const step of TOUR_STEPS) {
        // Zero (Spaces)
        expect(step.highlightsId.join(" ")).not.toContain("(Spaces)");
        expect(step.descId).not.toContain("(Spaces)");

        // Zero (Tier 1), (Tier 2), (Tier 3)
        expect(step.descId).not.toContain("(Tier 1)");
        expect(step.descId).not.toContain("(Tier 2)");
        expect(step.descId).not.toContain("(Tier 3)");

        // Zero (Wrapped)
        expect(step.descId).not.toContain("(Wrapped)");
        expect(step.highlightsId.join(" ")).not.toContain("(Wrapped)");
        expect(step.proTipId).not.toContain("(Wrapped)");

        // Zero (PDF/Excel)
        expect(step.highlightsId.join(" ")).not.toContain("(PDF/Excel)");
      }
    });
  });

  describe("4. OnboardingModal Static Component Invariants", () => {
    it("ensures Wise wallet has pure non-mixed label", () => {
      const modalPath = path.join(
        rootDir,
        "src/components/onboarding/OnboardingModal.tsx",
      );
      const content = fs.readFileSync(modalPath, "utf-8");
      expect(content).toContain('"Dompet Digital Wise" : "Wise Digital Wallet"');
      expect(content).not.toContain('"Dompet Digital (Wise)"');
    });

    it("ensures account region tabs use pure localized text", () => {
      const modalPath = path.join(
        rootDir,
        "src/components/onboarding/OnboardingModal.tsx",
      );
      const content = fs.readFileSync(modalPath, "utf-8");
      expect(content).toContain('{isIndonesian ? "Lokal" : "Domestic"}');
      expect(content).toContain('{isIndonesian ? "Internasional" : "Global"}');
      expect(content).not.toContain("Lokal (IDR)");
      expect(content).not.toContain("Global (USD/EUR)");
    });
  });
});
