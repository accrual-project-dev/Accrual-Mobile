import { describe, it, expect } from "vitest";
import { parseBankNotification } from "../src/lib/bankNotificationParser";
import type { Category, Wallet } from "../src/lib/types";

describe("Bank & E-Wallet Notification Parser Suite", () => {
  const mockCategories: Category[] = [
    { id: "c-food", name: "Makanan", type: "expense", emoji: "🍜" },
    { id: "c-coffee", name: "Kopi", type: "expense", emoji: "☕" },
    { id: "c-transport", name: "Transport", type: "expense", emoji: "🚗" },
    { id: "c-bills", name: "Tagihan", type: "expense", emoji: "💡" },
  ];

  const mockWallets: Wallet[] = [
    { id: "w-bca", name: "BCA", type: "bank", balance: 1000000 },
    { id: "w-gopay", name: "GoPay", type: "ewallet", balance: 500000 },
    { id: "w-livin", name: "Mandiri Livin", type: "bank", balance: 750000 },
    { id: "w-jago", name: "Bank Jago", type: "bank", balance: 300000 },
    { id: "w-bni", name: "wondr BNI", type: "bank", balance: 400000 },
    { id: "w-brimo", name: "BRImo", type: "bank", balance: 600000 },
    { id: "w-shopeepay", name: "ShopeePay", type: "ewallet", balance: 250000 },
    { id: "w-seabank", name: "SeaBank", type: "bank", balance: 800000 },
    { id: "w-superbank", name: "Superbank", type: "bank", balance: 200000 },
  ];

  it("parses BCA transfer notification successfully", () => {
    const raw = "BCA: Transfer berhasil ke REK 123456 Rp 50.000 untuk Kopi Kenangan";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("BCA");
    expect(res?.amount).toBe(50000);
    expect(res?.suggestedWalletId).toBe("w-bca");
    expect(res?.type).toBe("expense");
  });

  it("parses QRIS payment notification successfully", () => {
    const raw = "Pembayaran QRIS Rp 35.000 di Alfamart berhasil";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("QRIS");
    expect(res?.amount).toBe(35000);
    expect(res?.type).toBe("expense");
  });

  it("parses GoPay notification with coffee merchant", () => {
    const raw = "Kamu telah bayar Rp 45.000 ke Fore Coffee via GoPay";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("GoPay");
    expect(res?.amount).toBe(45000);
    expect(res?.suggestedWalletId).toBe("w-gopay");
    expect(res?.type).toBe("expense");
    expect(res?.merchantOrNote).toBe("Fore Coffee");
  });

  it("parses Mandiri Livin bill payment", () => {
    const raw = "Livin by Mandiri: Pembayaran sukses Rp 150.000 PLN Listrik";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("Mandiri Livin");
    expect(res?.amount).toBe(150000);
    expect(res?.suggestedWalletId).toBe("w-livin");
  });

  it("parses Bank Jago payment with Kantong Utama", () => {
    const raw = "Bank Jago: Transaksi Rp 45.000 di Kopi Kenangan dari Kantong Utama berhasil";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("Bank Jago");
    expect(res?.amount).toBe(45000);
    expect(res?.suggestedWalletId).toBe("w-jago");
    expect(res?.merchantOrNote).toBe("Kopi Kenangan");
  });

  it("parses wondr by BNI QRIS payment", () => {
    const raw = "wondr by BNI: Pembayaran QRIS Rp 55.000 ke Fore Coffee berhasil";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("wondr by BNI");
    expect(res?.amount).toBe(55000);
    expect(res?.suggestedWalletId).toBe("w-bni");
    expect(res?.merchantOrNote).toBe("Fore Coffee");
  });

  it("parses BRImo debit payment", () => {
    const raw = "BRImo: Transaksi debit Rp 120.000 di Alfamart sukses";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("BRImo");
    expect(res?.amount).toBe(120000);
    expect(res?.suggestedWalletId).toBe("w-brimo");
  });

  it("parses internal wallet transfer (BCA to ShopeePay)", () => {
    const raw = "BCA: Transfer ke ShopeePay berhasil sebesar Rp 200.000";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("BCA");
    expect(res?.amount).toBe(200000);
    expect(res?.type).toBe("transfer");
    expect(res?.suggestedWalletId).toBe("w-bca");
    expect(res?.suggestedToWalletId).toBe("w-shopeepay");
    expect(res?.suggestedCategoryId).toBeUndefined();
  });

  it("parses SeaBank payment to known merchant", () => {
    const raw = "SeaBank: Pembayaran Rp 70.000 ke Mie Gacoan berhasil";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("SeaBank");
    expect(res?.amount).toBe(70000);
    expect(res?.suggestedWalletId).toBe("w-seabank");
    expect(res?.merchantOrNote).toBe("Mie Gacoan");
  });

  it("parses incoming transfer as income", () => {
    const raw = "BCA: Transfer masuk sebesar Rp 500.000 dari BUDI";
    const res = parseBankNotification(raw, mockCategories, mockWallets);

    expect(res).not.toBeNull();
    expect(res?.sourceApp).toBe("BCA");
    expect(res?.amount).toBe(500000);
    expect(res?.type).toBe("income");
    expect(res?.suggestedWalletId).toBe("w-bca");
  });

  it("ignores non-financial text", () => {
    const raw = "Halo apa kabar besok kita ketemu ya";
    const res = parseBankNotification(raw, mockCategories, mockWallets);
    expect(res).toBeNull();
  });
});
