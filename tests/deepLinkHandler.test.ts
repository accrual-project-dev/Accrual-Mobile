import { describe, it, expect } from "vitest";
import { parseDeepLink } from "../src/lib/deepLinkHandler";
import type { Category, Wallet } from "../src/lib/types";

const mockCategories: Category[] = [
  {
    id: "c-coffee",
    user_id: "u1",
    name: "Coffee",
    emoji: "☕",
    type: "expense",
    is_default: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "c-food",
    user_id: "u1",
    name: "Makanan",
    emoji: "🍜",
    type: "expense",
    is_default: false,
    created_at: new Date().toISOString(),
  },
];

const mockWallets: Wallet[] = [
  {
    id: "w-bca",
    user_id: "u1",
    name: "BCA",
    icon: "bca",
    created_at: new Date().toISOString(),
  },
  {
    id: "w-gopay",
    user_id: "u1",
    name: "GoPay",
    icon: "gopay",
    created_at: new Date().toISOString(),
  },
];

describe("DeepLink & iOS Shortcuts URL Scheme Handler", () => {
  it("parses iOS Shortcut Bank Notification OCR string via trouvaille://add?text=...", () => {
    const rawOcr =
      "Pembayaran QRIS Rp 45.000 ke Kopi Kenangan Senopati berhasil via BCA";
    const url = `trouvaille://add?text=${encodeURIComponent(rawOcr)}`;

    const result = parseDeepLink(url, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.prefilledValues).toBeDefined();
    expect(result.prefilledValues?.amount).toBe(45000);
    expect(result.prefilledValues?.type).toBe("expense");
    expect(result.prefilledValues?.wallet_id).toBe("w-bca");
    expect(result.prefilledValues?.note).toContain("Kopi Kenangan");
  });

  it("parses direct structured query parameters via trouvaille://add?amount=75000&note=Lunch", () => {
    const url = "trouvaille://add?amount=75000&note=Lunch%20Padang&category=Makanan&wallet=BCA";
    const result = parseDeepLink(url, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.prefilledValues?.amount).toBe(75000);
    expect(result.prefilledValues?.note).toBe("Lunch Padang");
    expect(result.prefilledValues?.category_id).toBe("c-food");
    expect(result.prefilledValues?.categoryId).toBe("c-food");
    expect(result.prefilledValues?.wallet_id).toBe("w-bca");
    expect(result.prefilledValues?.walletId).toBe("w-bca");
    expect(result.prefilledValues?.type).toBe("expense");
  });

  it("parses full Back Tap structured query with date, time, and account alias", () => {
    const url =
      "trouvaille://add?amount=125000&category=Makanan&account=BCA&date=2026-09-26&time=14:30&note=Sushi%20Tei";
    const result = parseDeepLink(url, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.prefilledValues?.amount).toBe(125000);
    expect(result.prefilledValues?.note).toBe("Sushi Tei");
    expect(result.prefilledValues?.categoryId).toBe("c-food");
    expect(result.prefilledValues?.walletId).toBe("w-bca");
    expect(result.prefilledValues?.date).toBeInstanceOf(Date);
    expect(result.prefilledValues?.time).toBe("14:30");
  });

  it("parses natural language text (e.g. voice or typed text) when not formal bank format", () => {
    const url = `trouvaille://add?text=${encodeURIComponent("Kopi susu tuku 25rb")}`;
    const result = parseDeepLink(url, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.prefilledValues?.amount).toBe(25000);
    expect(result.prefilledValues?.category_id).toBe("c-coffee");
  });

  it("routes modal actions like trouvaille://voice and trouvaille://scan", () => {
    expect(parseDeepLink("trouvaille://voice").action).toBe("voice");
    expect(parseDeepLink("trouvaille://scan").action).toBe("scan");
    expect(parseDeepLink("trouvaille://import").action).toBe("import");
    expect(parseDeepLink("trouvaille://add").action).toBe("transaction");
  });

  it("handles web search parameters seamlessly (e.g. ?text=...)", () => {
    const search = "?text=Transfer%20Rp%20150.000%20ke%20Budi%20BCA%20berhasil";
    const result = parseDeepLink(search, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.prefilledValues?.amount).toBe(150000);
    expect(result.prefilledValues?.wallet_id).toBe("w-bca");
  });

  it("parses structured multi-line shortcut text from iOS Dialog shortcut", () => {
    const dialogText = "Nominal: 50.000\nKategori: Makanan\nAkun: BCA\nCatatan: Makan siang bareng";
    const url = `trouvaille://add?text=${encodeURIComponent(dialogText)}&autosave=true`;
    const result = parseDeepLink(url, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.autoSave).toBe(true);
    expect(result.prefilledValues?.amount).toBe(50000);
    expect(result.prefilledValues?.categoryId).toBe("c-food");
    expect(result.prefilledValues?.walletId).toBe("w-bca");
    expect(result.prefilledValues?.note).toBe("Makan siang bareng");
  });

  it("sanitizes unencoded spaces and & in direct query scheme", () => {
    const rawUrl = "trouvaille://add?category=Makanan & Minuman&amount=50000&wallet=BCA&note=Makan & Minum&autosave=true";
    const result = parseDeepLink(rawUrl, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.autoSave).toBe(true);
    expect(result.prefilledValues?.amount).toBe(50000);
    expect(result.prefilledValues?.categoryId).toBe("c-food");
    expect(result.prefilledValues?.walletId).toBe("w-bca");
  });

  it("handles restore-balance action route", () => {
    expect(parseDeepLink("trouvaille://restore-balance").action).toBe("restore_balance");
    expect(parseDeepLink("trouvaille://clean-sync").action).toBe("restore_balance");
  });

  it("parses structured multi-line shortcut text with Date and Time", () => {
    const dialogText = "Nominal: 75.000\nKategori: Makanan\nAkun: BCA\nTanggal: 28/09/2026, 17:30\nCatatan: Makan malam bersama";
    const url = `trouvaille://add?text=${encodeURIComponent(dialogText)}&autosave=true`;
    const result = parseDeepLink(url, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.autoSave).toBe(true);
    expect(result.prefilledValues?.amount).toBe(75000);
    expect(result.prefilledValues?.categoryId).toBe("c-food");
    expect(result.prefilledValues?.walletId).toBe("w-bca");
    expect(result.prefilledValues?.note).toBe("Makan malam bersama");
    expect(result.prefilledValues?.date).toBeInstanceOf(Date);
    expect(result.prefilledValues?.date?.getFullYear()).toBe(2026);
    expect(result.prefilledValues?.date?.getMonth()).toBe(8); // September is 8
    expect(result.prefilledValues?.date?.getDate()).toBe(28);
    expect(result.prefilledValues?.date?.getHours()).toBe(17);
    expect(result.prefilledValues?.date?.getMinutes()).toBe(30);
    expect(result.prefilledValues?.time).toBe("17:30");
  });

  it("parses structured shortcut text with separate Tanggal and Waktu lines", () => {
    const dialogText = "Nominal: 120.000\nKategori: Makanan\nAkun: BCA\nTanggal: 28 Sep 2026\nWaktu: 19:45\nCatatan: Dinner";
    const url = `trouvaille://add?text=${encodeURIComponent(dialogText)}&autosave=true`;
    const result = parseDeepLink(url, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.autoSave).toBe(true);
    expect(result.prefilledValues?.amount).toBe(120000);
    expect(result.prefilledValues?.date?.getFullYear()).toBe(2026);
    expect(result.prefilledValues?.date?.getMonth()).toBe(8);
    expect(result.prefilledValues?.date?.getDate()).toBe(28);
    expect(result.prefilledValues?.date?.getHours()).toBe(19);
    expect(result.prefilledValues?.date?.getMinutes()).toBe(45);
    expect(result.prefilledValues?.time).toBe("19:45");
  });

  it("parses direct query scheme with date and time", () => {
    const rawUrl = "trouvaille://add?amount=50000&category=Makanan&wallet=BCA&date=2026-09-28&time=14:15&autosave=true";
    const result = parseDeepLink(rawUrl, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.autoSave).toBe(true);
    expect(result.prefilledValues?.amount).toBe(50000);
    expect(result.prefilledValues?.date?.getFullYear()).toBe(2026);
    expect(result.prefilledValues?.date?.getMonth()).toBe(8);
    expect(result.prefilledValues?.date?.getDate()).toBe(28);
    expect(result.prefilledValues?.date?.getHours()).toBe(14);
    expect(result.prefilledValues?.date?.getMinutes()).toBe(15);
    expect(result.prefilledValues?.time).toBe("14:15");
  });

  it("sanitizes single day numbers and prevents year 0028 bug", () => {
    const dialogText = "Nominal: 20.000\nKategori: Makanan\nAkun: BCA\nTanggal: 28";
    const url = `trouvaille://add?text=${encodeURIComponent(dialogText)}&autosave=true`;
    const result = parseDeepLink(url, mockCategories, mockWallets);

    expect(result.action).toBe("transaction");
    expect(result.prefilledValues?.amount).toBe(20000);
    expect(result.prefilledValues?.date).toBeInstanceOf(Date);
    // Year MUST be current year (>= 2024), NEVER year 0028!
    expect(result.prefilledValues?.date?.getFullYear()).toBeGreaterThanOrEqual(2024);
    expect(result.prefilledValues?.date?.getDate()).toBe(28);
  });

  it("handles widget quick-log deep links and tab navigation aliases", () => {
    // Quick log buttons
    expect(parseDeepLink("accrual://log?type=expense", mockCategories, mockWallets)).toEqual({
      action: "transaction",
      prefilledValues: { type: "expense" },
    });
    expect(parseDeepLink("accrual://log?type=income", mockCategories, mockWallets)).toEqual({
      action: "transaction",
      prefilledValues: { type: "income" },
    });
    expect(parseDeepLink("accrual://log?type=transfer", mockCategories, mockWallets)).toEqual({
      action: "transaction",
      prefilledValues: { type: "transfer" },
    });
    expect(parseDeepLink("accrual://log?type=scan", mockCategories, mockWallets)).toEqual({
      action: "scan",
    });

    // Widget navigation aliases
    expect(parseDeepLink("accrual://networth", mockCategories, mockWallets)).toEqual({
      action: "navigate",
      path: "/assets",
    });
    expect(parseDeepLink("accrual://allocation", mockCategories, mockWallets)).toEqual({
      action: "navigate",
      path: "/assets",
    });
    expect(parseDeepLink("accrual://cash", mockCategories, mockWallets)).toEqual({
      action: "navigate",
      path: "/assets",
    });
    expect(parseDeepLink("accrual://savings", mockCategories, mockWallets)).toEqual({
      action: "navigate",
      path: "/statistics",
    });
    expect(parseDeepLink("accrual://cashflow", mockCategories, mockWallets)).toEqual({
      action: "navigate",
      path: "/statistics",
    });
    expect(parseDeepLink("accrual://activity", mockCategories, mockWallets)).toEqual({
      action: "navigate",
      path: "/transactions",
    });
    expect(parseDeepLink("accrual://balance-sheet", mockCategories, mockWallets)).toEqual({
      action: "navigate",
      path: "/transactions?open=export",
    });
  });

  it("returns none action on empty or invalid inputs", () => {
    expect(parseDeepLink("").action).toBe("none");
    expect(parseDeepLink("random-string-without-scheme").action).toBe("none");
  });
});
