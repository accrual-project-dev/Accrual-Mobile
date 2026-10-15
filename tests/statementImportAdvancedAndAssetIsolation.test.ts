import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseStatementText } from "../src/lib/statementParser";
import { detectColumns } from "../src/lib/csvColumnDetector";
import { resolveCategoryVectorIcon } from "../src/lib/iconRegistry";
import { getWalletIcon } from "../src/hooks/useWallets";
import { clearAllLocalUserSessionData } from "../src/lib/sessionCleanup";
import {
  getSavedUsdtPref,
  getSavedHoldings,
  saveUsdtPref,
  saveHoldings,
} from "../src/lib/marketPriceService";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

describe("Statement Import Advanced & Asset Isolation Suite", () => {
  beforeEach(async () => {
    let store: Record<string, string> = {};
    const mockStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
      key: (i: number) => Object.keys(store)[i] || null,
      get length() {
        return Object.keys(store).length;
      },
    };

    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).window = {
      ...globalThis,
      dispatchEvent: vi.fn(),
    };
    mockStorage.clear();
    await clearAllLocalUserSessionData(null);
  });

  describe("1. Real-World User Excel Mutasi Ingestion", () => {
    it("correctly parses user Excel file with separate Date and Time columns and arrow transfers", () => {
      const excelPath = "C:/Users/afa/.gemini/antigravity/brain/16b7e437-d034-4106-b7f7-9dd8555f05ad/.user_uploaded/media_1790643836876.xlsx";
      let wb: XLSX.WorkBook;
      if (fs.existsSync(excelPath)) {
        const fileBuf = fs.readFileSync(excelPath);
        wb = XLSX.read(fileBuf, { type: "buffer" });
      } else {
        const rows: any[][] = [
          ["Tanggal", "Jam", "Rekening", "Kategori", "Judul", "Jumlah", "Jenis Transaksi"],
          [45748, 0.188194444444444, "BNI", "Biaya admin", "-", 5000, "Pengeluaran"],
          [45748, 0.740972222222222, "BNI → Blu", "Transfer", "Transfer", 500000, "Transfer"],
          [45748, 0.5, "ShopeePay → Cash", "Transfer", "-", 50000, "Transfer"],
          [45748, 0.5, "BNI → Investasi", "Transfer", "-", 300000, "Transfer"],
          [45748, 0.5, "Dana", "Makanan", "Makan", 25000, "Pengeluaran"],
        ];
        for (let i = 0; i < 100; i++) {
          rows.push([45748, 0.5, "BNI", "Makanan", `Item ${i}`, 10000, "Pengeluaran"]);
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mutasi");
      }
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawMatrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      }) as (string | number)[][];

      // Convert cells to string with time/date normalizer matching excelParser.ts
      const stringMatrix = rawMatrix.map((row) =>
        row.map((cell) => {
          if (cell === null || cell === undefined) return "";
          if (typeof cell === "number") {
            if (cell > 25569 && cell < 60000) {
              const jsDate = XLSX.SSF.parse_date_code(cell);
              if (jsDate) {
                const { y, m, d } = jsDate;
                return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              }
            }
            if (cell > 0 && cell < 1) {
              const jsDate = XLSX.SSF.parse_date_code(cell);
              if (jsDate && (jsDate.H !== undefined || jsDate.M !== undefined)) {
                const H = String(jsDate.H || 0).padStart(2, "0");
                const M = String(jsDate.M || 0).padStart(2, "0");
                const S = String(Math.floor(jsDate.S || 0)).padStart(2, "0");
                return `${H}:${M}:${S}`;
              }
            }
            return String(cell);
          }
          return String(cell).trim();
        })
      );

      // Find header row (>= 3 non-empty cells)
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(10, stringMatrix.length); i++) {
        const row = stringMatrix[i];
        const nonEmpty = row.filter((c) => c.trim() !== "");
        if (nonEmpty.length >= 3) {
          headerRowIdx = i;
          break;
        }
      }

      const headers = stringMatrix[headerRowIdx].map((h) => h.trim());
      const dataRows = stringMatrix.slice(headerRowIdx + 1).filter((r) => r.some((c) => c.trim() !== ""));

      // 1. Column detection test
      const colMap = detectColumns(headers, dataRows);
      expect(colMap.dateCol).toBe(0); // Tanggal
      expect(colMap.timeCol).toBe(1); // Jam
      expect(colMap.walletCol).toBe(2); // Rekening
      expect(colMap.categoryCol).toBe(3); // Kategori
      expect(colMap.descCol).toBe(4); // Judul
      expect(colMap.amountCol).toBe(5); // Jumlah
      expect(colMap.typeCol).toBe(6); // Jenis Transaksi

      // 2. Format TSV text and parse with parseStatementText
      const tsvText = [headers.join("\t"), ...dataRows.map((r) => r.join("\t"))].join("\n");
      const result = parseStatementText(tsvText, [], [], colMap, []);

      expect(result.items.length).toBeGreaterThan(100);

      // 3. New Wallets must be cleanly separated, NOT contain arrows!
      expect(result.newWalletsDetected).toContain("BNI");
      expect(result.newWalletsDetected).toContain("Blu");
      expect(result.newWalletsDetected).toContain("Cash");
      expect(result.newWalletsDetected).toContain("Dana");
      expect(result.newWalletsDetected).toContain("ShopeePay");
      expect(result.newWalletsDetected).toContain("Investasi");

      // Verify no arrow strings in newWalletsDetected
      const hasArrowInWallets = result.newWalletsDetected.some((w) => w.includes("→") || w.includes("->"));
      expect(hasArrowInWallets).toBe(false);

      // 4. Test row 0: Biaya admin expense with time
      const item0 = result.items[0];
      expect(item0.date).toBe("2025-04-01");
      expect(item0.time).toBe("04:31:00");
      expect(item0.walletName).toBe("BNI");
      expect(item0.suggestedCategoryName).toBe("Biaya admin");
      expect(item0.amount).toBe(5000);
      expect(item0.type).toBe("expense");
      // Judul was "-" so it should be sanitized to empty string
      expect(item0.description).toBe("");

      // 5. Test transfer rows: "BNI → Blu"
      const transferItem = result.items.find(
        (it) => it.type === "transfer" && it.walletName === "BNI" && it.destinationWalletName === "Blu"
      );
      expect(transferItem).toBeDefined();
      expect(transferItem?.amount).toBe(500000);
      expect(transferItem?.time).toBe("17:47:00");

      // 6. Test transfer rows: "ShopeePay → Cash"
      const spayToCash = result.items.find(
        (it) => it.type === "transfer" && it.walletName === "ShopeePay" && it.destinationWalletName === "Cash"
      );
      expect(spayToCash).toBeDefined();

      // 7. Test transfer rows: "BNI → Investasi"
      const bniToInvestasi = result.items.find(
        (it) => it.type === "transfer" && it.walletName === "BNI" && it.destinationWalletName === "Investasi"
      );
      expect(bniToInvestasi).toBeDefined();
      expect(bniToInvestasi?.amount).toBe(300000);
    });
  });

  describe("2. Strict Monochrome Vector Icon Resolver for Categories & Wallets", () => {
    it("maps all imported categories to pure Lucide vector icon names (zero colored emojis)", () => {
      const testCategories = [
        { name: "Biaya admin", expected: "CreditCard" },
        { name: "Bensin", expected: "Fuel" },
        { name: "Makanan", expected: "Utensils" },
        { name: "Minuman", expected: "Coffee" },
        { name: "Medicine", expected: "Pill" },
        { name: "Mini market", expected: "ShoppingCart" },
        { name: "Tagihan", expected: "Receipt" },
        { name: "Laundry", expected: "Sparkles" },
        { name: "Gadget", expected: "Smartphone" },
        { name: "Internet", expected: "Wifi" },
        { name: "Kendaraan", expected: "Car" },
        { name: "Hiburan", expected: "Gamepad2" },
        { name: "Hobi", expected: "Music" },
        { name: "Liburan", expected: "Plane" },
        { name: "Gift", expected: "Gift" },
        { name: "Fashion", expected: "Shirt" },
        { name: "Uang bulanan", expected: "Banknote" },
        { name: "Sampingan", expected: "Briefcase" },
        { name: "Pindah Saldo", expected: "ArrowRightLeft" },
        { name: "Koreksi Saldo", expected: "Scale" },
      ];

      for (const item of testCategories) {
        const icon = resolveCategoryVectorIcon(item.name);
        expect(icon).toBe(item.expected);
        // Strict invariant: Must NOT be an emoji character (ASCII alphanumeric only)
        expect(/^[A-Za-z0-9]+$/.test(icon)).toBe(true);
      }
    });

    it("maps wallet names to pure Lucide vector icon names", () => {
      expect(getWalletIcon("BNI")).toBe("Landmark");
      expect(getWalletIcon("Blu")).toBe("Landmark");
      expect(getWalletIcon("Cash")).toBe("Banknote");
      expect(getWalletIcon("Dana")).toBe("Smartphone");
      expect(getWalletIcon("ShopeePay")).toBe("Smartphone");
      expect(getWalletIcon("Investasi")).toBe("TrendingUp");
    });
  });

  describe("3. Strict Asset & USDT Session Isolation", () => {
    it("does not leak previous user USDT or holdings into guest mode or clean session", async () => {
      // User 1 saves USDT and a stock holding
      saveUsdtPref({ units: 1002.316, rate: 16300, costBasis: 16000000 }, "user-123");
      saveHoldings(
        [
          {
            id: "holding-1",
            symbol: "BBCA",
            name: "Bank Central Asia",
            asset_type: "stock",
            units: 100,
            avg_buy_price: 10000,
            current_price: 10500,
            currency: "IDR",
          },
        ],
        "user-123"
      );

      // Verify User 1 has USDT
      expect(getSavedUsdtPref("user-123").units).toBe(1002.316);
      expect(getSavedHoldings("user-123").length).toBe(1);

      // Guest mode or a new account MUST NOT adopt user 1's USDT
      const guestPref = getSavedUsdtPref("guest_local_user");
      expect(guestPref.units).toBe(0);

      const newAccountPref = getSavedUsdtPref("new-user-456");
      expect(newAccountPref.units).toBe(0);

      const guestHoldings = getSavedHoldings("guest_local_user");
      expect(guestHoldings.length).toBe(0);

      const newAccountHoldings = getSavedHoldings("new-user-456");
      expect(newAccountHoldings.length).toBe(0);

      // Now perform complete logout / session cleanup
      await clearAllLocalUserSessionData(null);

      // Verify User 1's local cache is also completely wiped
      expect(getSavedUsdtPref("user-123").units).toBe(0);
      expect(getSavedHoldings("user-123").length).toBe(0);
    });
  });
});
