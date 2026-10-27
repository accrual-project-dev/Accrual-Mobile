import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { SHORTCUT_PRESETS } from "../src/components/settings/AppleShortcutsGuideModal";

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

      // Must have 5 sequence nodes: Screenshot -> Scan -> If -> Delete -> End If
      expect(actions).toHaveLength(5);

      // Node 1: Take screenshot
      expect(actions[0].type).toBe("standard");
      expect(actions[0].titleEn).toBe("Take screenshot");
      expect(actions[0].titleId).toBe("Ambil jepretan layar");

      // Node 2: Scan payment from Screenshot (Native Intent)
      expect(actions[1].type).toBe("standard");
      expect(actions[1].isNativeIntent).toBe(true);
      expect(actions[1].titleEn).toBe("Scan payment from Screenshot");

      // Node 3: If Scan Payment Screenshot contains DELETE_SCREENSHOT
      expect(actions[2].type).toBe("condition_start");
      expect(actions[2].titleEn).toContain("If Scan Payment Screenshot contains DELETE_SCREENSHOT");
      expect(actions[2].titleId).toContain("Jika Scan Payment Screenshot berisi DELETE_SCREENSHOT");

      // Node 4: Nested Delete Screenshot
      expect(actions[3].type).toBe("nested_action");
      expect(actions[3].titleEn).toBe("Delete Screenshot");
      expect(actions[3].titleId).toBe("Hapus Jepretan Layar");

      // Node 5: End If
      expect(actions[4].type).toBe("condition_end");
      expect(actions[4].titleEn).toBe("End If");
      expect(actions[4].titleId).toBe("Akhir Jika");
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
});
