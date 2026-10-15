import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Profile Sheet, Settings, and Dynamic Island Revisions Invariants", () => {
  const profileSheetPath = path.resolve(__dirname, "../src/components/settings/ProfileSheet.tsx");
  const profileMenuModalPath = path.resolve(__dirname, "../src/components/home/ProfileMenuModal.tsx");
  const settingsPagePath = path.resolve(__dirname, "../src/pages/SettingsPage.tsx");

  it("verifies Re-run Customization and Preview Sync Screen are completely removed from ProfileSheet", () => {
    const content = fs.readFileSync(profileSheetPath, "utf-8");

    // Must NOT contain dev buttons
    expect(content).not.toContain("Re-run Customization");
    expect(content).not.toContain("Jalankan Panduan Awal");
    expect(content).not.toContain("Preview Sync Screen");
    expect(content).not.toContain("Pratinjau Layar Sinkronisasi");
    expect(content).not.toContain("preview-initial-sync");

    // Must still retain production vault actions
    expect(content).toContain("Reset Transaction Data");
    expect(content).toContain("Atur Ulang Transaksi");
    expect(content).toContain("Delete Account & Wipe");
    expect(content).toContain("Hapus Akun & Reset Brankas");
  });

  it("verifies Accrual Pro membership card is housed inside ProfileSheet with luxury styling tokens", () => {
    const content = fs.readFileSync(profileSheetPath, "utf-8");

    expect(content).toContain("Accrual Pro");
    expect(content).toContain("openPaywall({ feature: \"settings_manual\" })");
    expect(content).toContain("controlBg");
    expect(content).toContain("controlBorder");
    expect(content).toContain("controlShadow");
    expect(content).toContain("UPGRADE");
    expect(content).toContain("AKTIF");
  });

  it("verifies Upgrade button is removed from Dynamic Island ProfileMenuModal to prevent crowding", () => {
    const content = fs.readFileSync(profileMenuModalPath, "utf-8");

    expect(content).not.toContain("ACCRUAL PRO MEMBERSHIP");
    expect(content).not.toContain("title=\"Accrual Pro\"");
    expect(content).not.toContain("isPremium ? \"PRO\" : \"UPGRADE\"");
    expect(content).not.toContain("openPaywall");

    // Essential Dynamic Island elements remain intact
    expect(content).toContain("<Bell");
    expect(content).toContain("<Laptop");
    expect(content).toContain("<X");
  });

  it("verifies Accrual Pro card is removed from SettingsPage main view", () => {
    const content = fs.readFileSync(settingsPagePath, "utf-8");

    expect(content).not.toContain("3.1 Accrual Pro Membership Card");
    expect(content).not.toContain("openPaywall({ feature: \"settings_manual\" })");
  });

  it("verifies AccrualPaywallModal has high zIndex (1100) to immediately stack above ProfileSheet (999)", () => {
    const paywallPath = path.resolve(__dirname, "../src/components/paywall/AccrualPaywallModal.tsx");
    const content = fs.readFileSync(paywallPath, "utf-8");

    // Must be zIndex={1100} to stack above ProfileSheet's 999
    expect(content).toContain("<BottomSheet isOpen={isOpen} onClose={onClose} zIndex={1100}>");
    expect(content).not.toContain("zIndex={110}>");
  });
});
