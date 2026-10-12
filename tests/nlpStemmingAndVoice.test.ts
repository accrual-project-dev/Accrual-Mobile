import { describe, it, expect } from "vitest";
import {
  parseNaturalTransaction,
  parseMultiNaturalTransactions,
  stemIndonesianCategoryWord,
  normalizeSpokenIndonesianNumbers,
} from "../src/lib/nlpParser";
import type { Category, Wallet } from "../src/lib/types";

describe("Indonesian NLP Stemming & Conversational Voice Test Suite", () => {
  const mockCategories: Category[] = [
    {
      id: "c-makanan",
      user_id: "u1",
      name: "Makanan",
      emoji: "Utensils",
      type: "expense",
      is_default: true,
      created_at: "",
    },
    {
      id: "c-minuman",
      user_id: "u1",
      name: "Minuman",
      emoji: "CupSoda",
      type: "expense",
      is_default: true,
      created_at: "",
    },
    {
      id: "c-kopi",
      user_id: "u1",
      name: "Kopi",
      emoji: "Coffee",
      type: "expense",
      is_default: true,
      created_at: "",
    },
    {
      id: "c-transport",
      user_id: "u1",
      name: "Transportasi",
      emoji: "Car",
      type: "expense",
      is_default: true,
      created_at: "",
    },
    {
      id: "c-bensin",
      user_id: "u1",
      name: "Bensin",
      emoji: "Fuel",
      type: "expense",
      is_default: true,
      created_at: "",
    },
    {
      id: "c-gaji",
      user_id: "u1",
      name: "Gaji",
      emoji: "Briefcase",
      type: "income",
      is_default: true,
      created_at: "",
    },
  ];

  const mockWallets: Wallet[] = [
    {
      id: "w-bca",
      user_id: "u1",
      name: "BCA",
      icon: "/icons/Budgets/BCA.png",
      created_at: "",
    },
    {
      id: "w-jago",
      user_id: "u1",
      name: "Jago",
      icon: "/icons/Budgets/Jago.png",
      created_at: "",
    },
    {
      id: "w-cash",
      user_id: "u1",
      name: "Cash",
      icon: "/icons/Budgets/Cash.png",
      created_at: "",
    },
  ];

  const refDate = new Date("2026-09-20T12:00:00Z");

  describe("Indonesian Morphological Stemming", () => {
    it("stems suffixes and slang to roots accurately", () => {
      expect(stemIndonesianCategoryWord("makanan")).toBe("makan");
      expect(stemIndonesianCategoryWord("makannya")).toBe("makan");
      expect(stemIndonesianCategoryWord("ngopi")).toBe("kopi");
      expect(stemIndonesianCategoryWord("minuman")).toBe("minum");
      expect(stemIndonesianCategoryWord("gajian")).toBe("gaji");
      expect(stemIndonesianCategoryWord("ngemil")).toBe("makan");
      expect(stemIndonesianCategoryWord("bensin")).toBe("bensin");
    });

    it("notices 'makan' immediately as 'Makanan' category even without amount", () => {
      const result = parseNaturalTransaction("makan", mockCategories, mockWallets, refDate);
      expect(result.categoryId).toBe("c-makanan");
      expect(result.categoryName).toBe("Makanan");
      expect(result.type).toBe("expense");
    });

    it("notices 'makan 50rb' as 50.000 and 'Makanan'", () => {
      const result = parseNaturalTransaction("makan 50rb", mockCategories, mockWallets, refDate);
      expect(result.amount).toBe(50000);
      expect(result.categoryId).toBe("c-makanan");
      expect(result.categoryName).toBe("Makanan");
    });

    it("notices 'beli makan' as 'Makanan'", () => {
      const result = parseNaturalTransaction("beli makan", mockCategories, mockWallets, refDate);
      expect(result.categoryId).toBe("c-makanan");
      expect(result.categoryName).toBe("Makanan");
    });

    it("notices 'ngopi 25k' as 'Kopi'", () => {
      const result = parseNaturalTransaction("ngopi 25k", mockCategories, mockWallets, refDate);
      expect(result.amount).toBe(25000);
      expect(result.categoryId).toBe("c-kopi");
      expect(result.categoryName).toBe("Kopi");
    });

    it("notices 'minum es teh 12rb' as 'Minuman'", () => {
      const result = parseNaturalTransaction("minum es teh 12rb", mockCategories, mockWallets, refDate);
      expect(result.amount).toBe(12000);
      expect(result.categoryId).toBe("c-minuman");
      expect(result.categoryName).toBe("Minuman");
    });

    it("matches specific category 'Bensin' over general 'Transportasi'", () => {
      const result = parseNaturalTransaction("isi bensin 100k bca", mockCategories, mockWallets, refDate);
      expect(result.amount).toBe(100000);
      expect(result.categoryId).toBe("c-bensin");
      expect(result.categoryName).toBe("Bensin");
      expect(result.walletName).toBe("BCA");
    });

    it("matches categories named in English or alternate concepts (Food / Kuliner)", () => {
      const customCats: Category[] = [
        {
          id: "c-food",
          user_id: "u1",
          name: "Food & Beverage",
          emoji: "Utensils",
          type: "expense",
          is_default: true,
          created_at: "",
        },
      ];
      const result = parseNaturalTransaction("makan 45rb", customCats, mockWallets, refDate);
      expect(result.amount).toBe(45000);
      expect(result.categoryId).toBe("c-food");
      expect(result.categoryName).toBe("Food & Beverage");
    });
  });

  describe("Spoken Indonesian Numbers Normalizer", () => {
    it("converts spoken Indonesian number phrases into numeric digits", () => {
      expect(normalizeSpokenIndonesianNumbers("makan lima puluh ribu")).toBe("makan 50000");
      expect(normalizeSpokenIndonesianNumbers("kopi dua puluh lima ribu")).toBe("kopi 25000");
      expect(normalizeSpokenIndonesianNumbers("bensin seratus ribu")).toBe("bensin 100000");
      expect(normalizeSpokenIndonesianNumbers("gaji lima juta")).toBe("gaji 5000000");
      expect(normalizeSpokenIndonesianNumbers("beli makan 50 ribu")).toBe("beli makan 50000");
      expect(normalizeSpokenIndonesianNumbers("servis motor 1,5 juta")).toBe("servis motor 1500000");
      expect(normalizeSpokenIndonesianNumbers("laptop dua koma lima juta")).toBe("laptop 2500000");
    });

    it("parses transaction with fractional and decimal millions: 'gaji 1.5 juta bca'", () => {
      const result = parseNaturalTransaction("gaji 1.5 juta bca", mockCategories, mockWallets, refDate);
      expect(result.amount).toBe(1500000);
      expect(result.type).toBe("income");
      expect(result.walletName).toBe("BCA");
    });

    it("parses spoken fractional million: 'gaji satu koma lima juta bca'", () => {
      const result = parseNaturalTransaction("gaji satu koma lima juta bca", mockCategories, mockWallets, refDate);
      expect(result.amount).toBe(1500000);
      expect(result.type).toBe("income");
      expect(result.walletName).toBe("BCA");
    });

    it("parses vernacular slang numerals: 'goban', 'noban', 'nopek', 'pego'", () => {
      const rGoban = parseNaturalTransaction("kopi goban bca", mockCategories, mockWallets, refDate);
      expect(rGoban.amount).toBe(50000);

      const rNoban = parseNaturalTransaction("bensin noban cash", mockCategories, mockWallets, refDate);
      expect(rNoban.amount).toBe(20000);

      const rNopek = parseNaturalTransaction("baju nopek bca", mockCategories, mockWallets, refDate);
      expect(rNopek.amount).toBe(200000);

      const rPego = parseNaturalTransaction("sepatu pego bca", mockCategories, mockWallets, refDate);
      expect(rPego.amount).toBe(150000);
    });

    it("parses transaction with spoken Indonesian numbers: 'makan lima puluh ribu jago'", () => {
      const result = parseNaturalTransaction("makan lima puluh ribu jago", mockCategories, mockWallets, refDate);
      expect(result.amount).toBe(50000);
      expect(result.categoryId).toBe("c-makanan");
      expect(result.walletName).toBe("Jago");
    });

    it("parses transaction with spoken compound number: 'kopi dua puluh lima ribu bca'", () => {
      const result = parseNaturalTransaction("kopi dua puluh lima ribu bca", mockCategories, mockWallets, refDate);
      expect(result.amount).toBe(25000);
      expect(result.categoryId).toBe("c-kopi");
      expect(result.walletName).toBe("BCA");
    });
  });

  describe("Multi-Transaction Conversational Voice Engine", () => {
    it("splits clauses on Indonesian conjunction 'dan': 'makan 50rb dan ngopi 25rb'", () => {
      const results = parseMultiNaturalTransactions("makan 50rb dan ngopi 25rb", mockCategories, mockWallets, refDate);
      expect(results.length).toBe(2);
      expect(results[0].amount).toBe(50000);
      expect(results[0].categoryName).toBe("Makanan");
      expect(results[1].amount).toBe(25000);
      expect(results[1].categoryName).toBe("Kopi");
    });

    it("splits clauses with commas and 'terus': 'makan 35k, bensin 20k terus beli kopi 25k'", () => {
      const results = parseMultiNaturalTransactions(
        "makan 35k, bensin 20k terus beli kopi 25k",
        mockCategories,
        mockWallets,
        refDate,
      );
      expect(results.length).toBe(3);
      expect(results[0].amount).toBe(35000);
      expect(results[0].categoryName).toBe("Makanan");
      expect(results[1].amount).toBe(20000);
      expect(results[1].categoryName).toBe("Bensin");
      expect(results[2].amount).toBe(25000);
      expect(results[2].categoryName).toBe("Kopi");
    });

    it("inherits single mentioned wallet across multiple transactions: 'makan 50rb dan ngopi 25rb pake bca'", () => {
      const results = parseMultiNaturalTransactions(
        "makan 50rb dan ngopi 25rb pake bca",
        mockCategories,
        mockWallets,
        refDate,
      );
      expect(results.length).toBe(2);
      expect(results[0].walletName).toBe("BCA");
      expect(results[1].walletName).toBe("BCA");
    });
  });
});
