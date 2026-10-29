import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  SHORTCUT_PRESETS,
  GLASS_DIALOG_ACTIONS,
  GLASS_DIALOG_HARDWARE_GUIDE,
  isValidICloudLink,
  getSavedICloudLinks,
  saveICloudLink,
  ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY,
} from "../src/components/settings/AppleShortcutsGuideModal";

if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    length: 0,
    key: () => null,
  };
}

describe("Apple Shortcuts & Automations Suite (Photo 4 & 5 Parity)", () => {
  describe("1. Preset Registry Completeness & Architecture", () => {
    it("provides exactly 4 ready-made presets in the catalog", () => {
      expect(SHORTCUT_PRESETS).toHaveLength(4);
      const presetIds = SHORTCUT_PRESETS.map((p) => p.id);
      expect(presetIds).toEqual([
        "screen_scan",
        "voice_entry",
        "receipt_scan",
        "notification_reader",
      ]);
    });

    it("verifies Screen Scanner is configured as the Back Tap hero preset", () => {
      const screenScan = SHORTCUT_PRESETS.find((p) => p.id === "screen_scan");
      expect(screenScan).toBeDefined();
      expect(screenScan?.titleEn).toBe("Accrual Screen Scanner");
      expect(screenScan?.categoryBadgeEn).toContain("Back Tap");
      expect(screenScan?.categoryBadgeId).toContain("Ketuk Bagian Belakang");
      expect(screenScan?.icloudUrl).toMatch(/^https:\/\/www\.icloud\.com\/shortcuts\//);
      expect(screenScan?.metadata.watchSupported).toBe(true);
      expect(screenScan?.metadata.lockScreenSupported).toBe(true);
      expect(screenScan?.metadata.hardwareBindingEn).toContain("Back Tap");
    });

    it("verifies Voice Entry is configured for Action Button and Siri", () => {
      const voice = SHORTCUT_PRESETS.find((p) => p.id === "voice_entry");
      expect(voice).toBeDefined();
      expect(voice?.titleEn).toBe("Accrual Voice Entry");
      expect(voice?.metadata.siriPhraseEn).toContain("Voice entry in Accrual");
      expect(voice?.metadata.hardwareBindingEn).toContain("Action Button");
      expect(voice?.directScheme).toBe("accrual://voice");
    });

    it("verifies Bank Notification Reader is configured for Personal Automations", () => {
      const notif = SHORTCUT_PRESETS.find((p) => p.id === "notification_reader");
      expect(notif).toBeDefined();
      expect(notif?.titleId).toBe("Pembaca Notifikasi Bank Otomatis");
      expect(notif?.metadata.hardwareBindingEn).toContain("Personal Automations");
      expect(notif?.directScheme).toBe("shortcuts://");
    });
  });

  describe("2. Visual Action Graph Pipeline (Photo 5 Parity)", () => {
    it("verifies the Screen Scanner action pipeline matches Photo 5 reference", () => {
      const screenScan = SHORTCUT_PRESETS.find((p) => p.id === "screen_scan")!;
      const actions = screenScan.actions;

      // Streamlined 3-step pipeline: Take screenshot -> Scan payment (Native Intent) -> Delete Screenshot
      expect(actions).toHaveLength(3);

      // Node 1: Take screenshot
      expect(actions[0].type).toBe("standard");
      expect(actions[0].titleEn).toBe("Take screenshot");
      expect(actions[0].titleId).toBe("Ambil jepretan layar");

      // Node 2: Scan payment from Screenshot (Native Intent)
      expect(actions[1].type).toBe("standard");
      expect(actions[1].isNativeIntent).toBe(true);
      expect(actions[1].titleEn).toBe("Scan payment from Screenshot");

      // Node 3: Delete Photo (Screenshot)
      expect(actions[2].type).toBe("standard");
      expect(actions[2].titleEn).toContain("Delete Photo");
      expect(actions[2].titleId).toContain("Hapus Foto");
    });
  });

  describe("3. Rule 1 & Rule 6 Strict Compliance", () => {
    const modalPath = path.resolve(
      __dirname,
      "../src/components/settings/AppleShortcutsGuideModal.tsx"
    );
    const content = fs.readFileSync(modalPath, "utf-8");

    it("verifies zero colored native system emojis in AppleShortcutsGuideModal.tsx (Rule 1)", () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(content).not.toMatch(emojiRegex);
    });

    it("verifies no parenthetical mixed translations exist in preset texts (Rule 6)", () => {
      SHORTCUT_PRESETS.forEach((preset) => {
        expect(preset.titleId).not.toContain("(");
        expect(preset.metadata.siriPhraseId).not.toContain("(");
        preset.actions.forEach((act) => {
          expect(act.titleId).not.toMatch(/\([A-Za-z]+\)/);
        });
      });
    });

    it("verifies SettingsPage badge displays '4 Preset Siap Pakai' / '4 Ready Presets'", () => {
      const settingsPath = path.resolve(__dirname, "../src/pages/SettingsPage.tsx");
      const settingsContent = fs.readFileSync(settingsPath, "utf-8");
      expect(settingsContent).toContain(
        '{isIndonesian ? "4 Preset Siap Pakai" : "4 Ready Presets"}'
      );
    });
  });

  describe("4. Official iCloud Link Validation & 404 Error Protection", () => {
    beforeEach(() => {
      localStorage.removeItem(ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY);
    });

    it("accepts valid 32-character hexadecimal Apple iCloud URLs", () => {
      const validLinks = [
        "https://www.icloud.com/shortcuts/670d8a5b28e44ca6a3371900388d01d4",
        "https://www.icloud.com/shortcuts/670d8a5b28e44ca6a3371900388d01d4/",
        "https://www.icloud.com/shortcuts/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef",
      ];
      validLinks.forEach((link) => {
        expect(isValidICloudLink(link)).toBe(true);
      });
    });

    it("rejects non-hexadecimal placeholder slugs to prevent Apple 'Shortcut Not Found' error", () => {
      const invalidLinks = [
        "https://www.icloud.com/shortcuts/accrual-screen-scanner",
        "https://www.icloud.com/shortcuts/accrual-voice-entry",
        "https://www.icloud.com/shortcuts/short-hash",
        "https://example.com/shortcuts/670d8a5b28e44ca6a3371900388d01d4",
        "",
        undefined,
      ];
      invalidLinks.forEach((link) => {
        expect(isValidICloudLink(link)).toBe(false);
      });
    });

    it("persists custom iCloud links per preset in localStorage", () => {
      expect(getSavedICloudLinks()).toEqual({});

      saveICloudLink("screen_scan", "https://www.icloud.com/shortcuts/670d8a5b28e44ca6a3371900388d01d4");
      const saved = getSavedICloudLinks();
      expect(saved["screen_scan"]).toBe("https://www.icloud.com/shortcuts/670d8a5b28e44ca6a3371900388d01d4");
    });
  });

  describe("5. Support & Feedback Section and Web Dashboard Parity", () => {
    it("verifies SettingsPage includes the dedicated Support & Feedback section with What's New, Rate Accrual, and Feedback", () => {
      const settingsPath = path.resolve(__dirname, "../src/pages/SettingsPage.tsx");
      const settingsContent = fs.readFileSync(settingsPath, "utf-8");

      // Header
      expect(settingsContent).toContain(
        '{isIndonesian ? "Bantuan & Dukungan" : "Support & Feedback"}'
      );

      // What's New
      expect(settingsContent).toContain(
        '{isIndonesian ? "Yang Baru" : "What\'s New"}'
      );

      // Rate Accrual
      expect(settingsContent).toContain(
        '{isIndonesian ? "Beri Nilai Accrual" : "Rate Accrual"}'
      );
      expect(settingsContent).toContain("https://apps.apple.com/app/id6825272166?action=write-review");

      // Feedback & Requests
      expect(settingsContent).toContain('"Feedback & Requests"');
      expect(settingsContent).toContain('"Saran & Masukan"');
      expect(settingsContent).toContain("mailto:support@syntheticae.studio");
    });

    it("verifies Web Dashboard modal displays official Cloudflare Workers domain and settings has Link Web Dashboard", () => {
      const modalPath = path.resolve(
        __dirname,
        "../src/components/settings/WebDashboardLinkModal.tsx"
      );
      const modalContent = fs.readFileSync(modalPath, "utf-8");
      expect(modalContent).toContain(
        "https://accrual-dashboard.accrual-project-app.workers.dev"
      );

      const dataVaultPath = path.resolve(
        __dirname,
        "../src/components/settings/SettingsDataVaultSection.tsx"
      );
      const dataVaultContent = fs.readFileSync(dataVaultPath, "utf-8");
      expect(dataVaultContent).toContain(
        '{isIndonesian\n                        ? "Tautkan Web Dashboard"\n                        : "Link Web Dashboard"}'
      );
    });

    it("verifies QuickLogIntent.swift routes screenshot OCR to review navigation instead of scan", () => {
      const swiftPath = path.resolve(
        __dirname,
        "../ios/App/App/QuickLogIntent.swift"
      );
      const swiftContent = fs.readFileSync(swiftPath, "utf-8");
      expect(swiftContent).toContain('defaults.set("review", forKey: "pending_intent_navigation")');
      expect(swiftContent).not.toContain('defaults.set("scan", forKey: "pending_intent_navigation")\n            defaults.synchronize()\n            return .result(dialog: IntentDialog("Tangkapan layar');
    });

    it("verifies Glass Dialog (Dialog Kaca) action pipeline matches the requested 7-step sequence", () => {
      expect(GLASS_DIALOG_ACTIONS).toHaveLength(7);

      // Step 1: Masukkan nominal transaksi
      expect(GLASS_DIALOG_ACTIONS[0].titleId).toBe("Minta Masukan Nominal");
      expect(GLASS_DIALOG_ACTIONS[0].titleEn).toBe("Ask for Input (Amount)");

      // Step 2: Pilih kategori transaksi
      expect(GLASS_DIALOG_ACTIONS[1].titleId).toBe("Pilih Kategori Transaksi");
      expect(GLASS_DIALOG_ACTIONS[1].titleEn).toBe("Choose Category from List");

      // Step 3: Pilih akun / rekening
      expect(GLASS_DIALOG_ACTIONS[2].titleId).toBe("Pilih Akun atau Rekening");
      expect(GLASS_DIALOG_ACTIONS[2].titleEn).toBe("Choose Account or Wallet");

      // Step 4: Pilih tanggal dan waktu
      expect(GLASS_DIALOG_ACTIONS[3].titleId).toBe("Minta Tanggal dan Waktu");
      expect(GLASS_DIALOG_ACTIONS[3].titleEn).toBe("Ask for Date and Time");

      // Step 5: Keterangan / catatan (opsional)
      expect(GLASS_DIALOG_ACTIONS[4].titleId).toBe("Minta Catatan (Opsional)");
      expect(GLASS_DIALOG_ACTIONS[4].titleEn).toBe("Ask for Note (Optional)");

      // Step 6: Buka URL Simpan Otomatis
      expect(GLASS_DIALOG_ACTIONS[5].titleId).toBe("Buka URL & Catat ke Sistem");
      expect(GLASS_DIALOG_ACTIONS[5].isNativeIntent).toBe(true);
      expect(GLASS_DIALOG_ACTIONS[5].subtitleId).toContain("autosave=true");

      // Step 7: Notifikasi transaksi tercatat
      expect(GLASS_DIALOG_ACTIONS[6].titleId).toBe("Tampilkan Pemberitahuan");
      expect(GLASS_DIALOG_ACTIONS[6].titleEn).toBe("Show Notification");

      // Hardware guide
      expect(GLASS_DIALOG_HARDWARE_GUIDE.stepsId).toHaveLength(4);
      expect(GLASS_DIALOG_HARDWARE_GUIDE.titleId).toContain("Ketuk Bagian Belakang");
    });
  });
});
