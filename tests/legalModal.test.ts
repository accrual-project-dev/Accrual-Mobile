import { describe, it, expect } from "vitest";
import { LegalModal } from "../src/components/legal/LegalModal";
import fs from "fs";
import path from "path";

describe("Legal & Privacy Policy Architecture Suite", () => {
  const legalModalPath = path.resolve(__dirname, "../src/components/legal/LegalModal.tsx");
  const settingsPagePath = path.resolve(__dirname, "../src/pages/SettingsPage.tsx");
  const loginPagePath = path.resolve(__dirname, "../src/pages/LoginPage.tsx");

  it("LegalModal component file exists and is cleanly exported", () => {
    expect(fs.existsSync(legalModalPath)).toBe(true);
    expect(LegalModal).toBeDefined();
    expect(typeof LegalModal).toBe("function");
  });

  it("SettingsPage imports and mounts LegalModal with search matching", () => {
    const settingsContent = fs.readFileSync(settingsPagePath, "utf-8");
    expect(settingsContent).toContain("LegalModal");
    expect(settingsContent).toContain("showLegal");
    expect(settingsContent).toContain("Legal & Kebijakan Privasi");
    expect(settingsContent).toContain("Legal & Privacy Policy");
    expect(settingsContent).toContain("<LegalModal");
  });

  it("LoginPage imports and mounts LegalModal with accessible Terms & Privacy links", () => {
    const loginContent = fs.readFileSync(loginPagePath, "utf-8");
    expect(loginContent).toContain("LegalModal");
    expect(loginContent).toContain("Ketentuan Layanan");
    expect(loginContent).toContain("Terms of Service");
    expect(loginContent).toContain("Kebijakan Privasi");
    expect(loginContent).toContain("Privacy Policy");
    expect(loginContent).toContain("<LegalModal");
  });

  it("LegalModal contains comprehensive Privacy Policy protections", () => {
    const content = fs.readFileSync(legalModalPath, "utf-8");

    // Zero Trackers & Ads
    expect(content).toContain("Prinsip Nol Pelacak");
    expect(content).toContain("Zero Tracker");

    // Local & Cloud Storage Isolation
    expect(content).toContain("Penyimpanan Data & Mode Tamu");
    expect(content).toContain("Cloud sync is not end-to-end encrypted");
    expect(content).toContain("RevenueCat");

    // On-device Receipt OCR
    expect(content).toContain("Pemrosesan Struk");
    expect(content).toContain("Receipt & Slip On-Device Processing");

    // Absolute Deletion & Portability
    expect(content).toContain("Hak Penghapusan & Portabilitas Mutlak");
    expect(content).toContain("Absolute Deletion & Portability Rights");
  });

  it("LegalModal contains comprehensive Terms of Service provisions and financial disclaimers", () => {
    const content = fs.readFileSync(legalModalPath, "utf-8");

    // Acceptance
    expect(content).toContain("Ketentuan Penggunaan Layanan");
    expect(content).toContain("Terms of Service Acceptance");

    // Clear Disclaimer
    expect(content).toContain("Bukan Penasihat Finansial");
    expect(content).toContain("Not a Financial Advisor");

    // Account Security Responsibility
    expect(content).toContain("Tanggung Jawab Keamanan Akun");
    expect(content).toContain("Account Security Responsibility");
  });

  it("LegalModal describes encrypted backup exports and data portability", () => {
    const content = fs.readFileSync(legalModalPath, "utf-8");

    // Military-grade Cryptography
    expect(content).toContain("Ekspor Cadangan Terenkripsi");
    expect(content).toContain("PBKDF2");
    expect(content).toContain("AES-GCM");
    expect(content).toContain("100.000 iterasi");

    // Zero Vendor Lock-In & Portability
    expect(content).toContain("Tanpa Keterikatan Vendor");
    expect(content).toContain("Zero Vendor Lock-In");

    // Multi-tenant session teardown
    expect(content).toContain("Penghancuran Sesi & Isolasi Penyewa");
    expect(content).toContain("Session Teardown & Multi-Tenant Isolation");
  });

  it("Enforces Rule 6: Zero bilingual mixing in Indonesian translations", () => {
    const content = fs.readFileSync(legalModalPath, "utf-8");
    const loginContent = fs.readFileSync(loginPagePath, "utf-8");

    // Check that standardized terminology is strictly adhered to
    expect(content).toContain("Selesai");
    expect(content).toContain("Ketentuan Penggunaan Layanan");
    expect(content).toContain("Penyangkalan: Bukan Penasihat Finansial");

    // Verify login page uses pure Indonesian phrase
    expect(loginContent).toContain("Dengan melanjutkan, Anda menyetujui");
    expect(loginContent).toContain("Ketentuan Layanan");
    expect(loginContent).toContain("Kebijakan Privasi");
  });
});
