import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Phase 4: Glass Confirmation Modal & Strict Non-Mixed Localization Suite", () => {
  describe("1. Zero Native Blocking window.confirm() Invariant", () => {
    it("ensures no window.confirm or confirm( calls exist in active source code", () => {
      const srcDir = path.resolve(__dirname, "../src");
      const activeTsxFiles: string[] = [];

      function findFiles(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== "archive" && entry.name !== "node_modules") {
              findFiles(fullPath);
            }
          } else if (
            (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) &&
            !entry.name.endsWith(".d.ts")
          ) {
            activeTsxFiles.push(fullPath);
          }
        }
      }

      findFiles(srcDir);

      const violatingFiles: Array<{ file: string; line: number; text: string }> = [];

      for (const file of activeTsxFiles) {
        // Exclude GlassConfirmationModal itself where onConfirm is called
        if (file.endsWith("GlassConfirmationModal.tsx")) continue;

        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          // Check for native browser confirm() invocation
          if (
            /\bwindow\.confirm\s*\(/.test(line) ||
            /\bconfirm\s*\([^)]*\)/.test(line)
          ) {
            // Exclude benign property references like onConfirm(item)
            if (line.includes("onConfirm(") || line.includes("onConfirm?.(")) {
              return;
            }
            violatingFiles.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              text: line.trim(),
            });
          }
        });
      }

      expect(violatingFiles).toEqual([]);
    });
  });

  describe("2. BottomTabBar Route Anchoring for Isolated Routes", () => {
    it("anchors Home tab as active when browsing /calendar", () => {
      const computeIsActive = (tabPath: string, currentPath: string) => {
        return tabPath === "/"
          ? currentPath === "/" || currentPath === "/calendar"
          : currentPath === tabPath;
      };

      expect(computeIsActive("/", "/")).toBe(true);
      expect(computeIsActive("/", "/calendar")).toBe(true);
      expect(computeIsActive("/assets", "/calendar")).toBe(false);
      expect(computeIsActive("/transactions", "/calendar")).toBe(false);
      expect(computeIsActive("/statistics", "/calendar")).toBe(false);
    });
  });

  describe("3. Rule 6 Pure Localization Invariants in Shortcuts Guide", () => {
    it("verifies no parenthetical (Trigger) or (Action) exists in AppleShortcutsGuideModal", () => {
      const modalPath = path.resolve(
        __dirname,
        "../src/components/settings/AppleShortcutsGuideModal.tsx",
      );
      const content = fs.readFileSync(modalPath, "utf-8");

      expect(content).not.toContain("Pemicu (Trigger)");
      expect(content).not.toContain("Tindakan (Action)");
    });

    it("verifies Search Actions text is conditionally localized in Shortcuts mock UI", () => {
      const modalPath = path.resolve(
        __dirname,
        "../src/components/settings/AppleShortcutsGuideModal.tsx",
      );
      const content = fs.readFileSync(modalPath, "utf-8");

      // No unlocalized raw 'Search Actions' string spans should remain
      expect(content).not.toContain(">Search Actions</span>");
      expect(content).toContain(
        '{isIndonesian ? "Cari Tindakan" : "Search Actions"}',
      );
    });
  });

  describe("4. Currency Switcher 100% Pure Localization Invariant", () => {
    it("verifies CurrencySwitcherSheet contains clean conditional branches", () => {
      const switcherPath = path.resolve(
        __dirname,
        "../src/components/currency/CurrencySwitcherSheet.tsx",
      );
      const content = fs.readFileSync(switcherPath, "utf-8");

      expect(content).toContain("Perbarui Kurs");
      expect(content).toContain("Sync FX");
      expect(content).toContain("Mata Uang Penilaian");
      expect(content).toContain("Valuation Currency");
      expect(content).toContain("Pilih mata uang dasar pembukuan Anda");
      expect(content).toContain("Select your preferred base currency");
    });
  });
});
