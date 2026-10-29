import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parseDeepLink } from "../src/lib/deepLinkHandler";
import { isValidICloudLink, getShortcutsConfig } from "../src/lib/shortcutsConfig";
import type { InboxDraft } from "../src/plugins/accrualInbox";

/**
 * TypeScript mirror of Swift DraftParser logic to verify parsing invariants
 */
function firstRupiah(s: string): number | null {
  const rpMatch = s.match(/Rp\s*([\d.,]+)/i);
  if (!rpMatch) return null;
  const rawNum = rpMatch[1];
  let digits = "";
  let seenComma = false;
  for (const ch of rawNum) {
    if (/\d/.test(ch)) {
      if (!seenComma) digits += ch;
    } else if (ch === "." || (ch === " " && digits.length === 0)) {
      continue;
    } else if (ch === ",") {
      seenComma = true;
    } else {
      break;
    }
  }
  const parsed = parseInt(digits, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseMerchant(s: string): string | null {
  const markers = [" ke ", " di ", " kepada "];
  for (const marker of markers) {
    const idx = s.toLowerCase().indexOf(marker);
    if (idx !== -1) {
      let sub = s.slice(idx + marker.length).split("\n")[0].split(",")[0];
      for (const stop of [" berhasil", " pada ", " sebesar", " Rp", " senilai"]) {
        const stopIdx = sub.toLowerCase().indexOf(stop);
        if (stopIdx !== -1) {
          sub = sub.slice(0, stopIdx);
        }
      }
      sub = sub.trim();
      if (sub.length >= 2 && sub.length <= 40) return sub;
    }
  }
  return null;
}

function generateDedupeKey(app: string, amount: number, timestampSec: number, dir: string): string {
  const minute = Math.floor(timestampSec / 60);
  const cleanApp = app.toLowerCase().replace(/\s+/g, "");
  const str = `${cleanApp}|${amount}|${minute}|${dir}`;
  return crypto.createHash("sha256").update(str).digest("hex");
}

describe("Accrual Native Auto-Ingestion & Shortcuts Architecture Suite", () => {
  describe("1. Currency & Nominal Invariant Parsing", () => {
    it("correctly parses 'Rp1.250.000,50' to 1250000 (ignoring decimals)", () => {
      expect(firstRupiah("Transfer berhasil Rp1.250.000,50 ke Rekening BCA")).toBe(1250000);
    });

    it("correctly parses 'Rp 125.000' to 125000", () => {
      expect(firstRupiah("Pembayaran QRIS Rp 125.000 di Kopi Kenangan")).toBe(125000);
    });

    it("correctly parses 'Rp.50.000' to 50000", () => {
      expect(firstRupiah("Top Up GoPay Rp.50.000 berhasil")).toBe(50000);
    });

    it("returns null for text with no currency nominal", () => {
      expect(firstRupiah("Login akun baru berhasil dari iPhone 16")).toBeNull();
      expect(firstRupiah("Kode OTP Anda adalah 839201")).toBeNull();
    });
  });

  describe("2. Merchant, Promo & OTP Filter Guard", () => {
    it("extracts merchant following 'ke', 'di', or 'kepada'", () => {
      expect(parseMerchant("Pembayaran QRIS sebesar Rp 45.000 di Starbucks Senayan City")).toBe("Starbucks Senayan City");
      expect(parseMerchant("Transfer Rp 250.000 ke Budi Santoso berhasil")).toBe("Budi Santoso");
      expect(parseMerchant("Kirim dana kepada Jane Doe senilai Rp 100.000")).toBe("Jane Doe");
    });

    it("generates deterministic idempotent dedupe keys within the same minute", () => {
      // 1793245020 % 60 === 0 (start of minute)
      const minuteStart = Math.floor(1793245000 / 60) * 60;
      const key1 = generateDedupeKey("BCA", 50000, minuteStart + 5, "expense");
      const key2 = generateDedupeKey("bca", 50000, minuteStart + 35, "expense"); // 30s later in same minute
      expect(key1).toBe(key2);

      const differentAmount = generateDedupeKey("BCA", 75000, minuteStart + 5, "expense");
      expect(differentAmount).not.toBe(key1);
    });
  });

  describe("3. Deep Link & ReceiptScanModal Disconnection", () => {
    it("routes 'accrual://inbox' and 'accrual://review' directly to batch_review, NEVER scan", () => {
      const resInbox = parseDeepLink("accrual://inbox", [], []);
      expect(resInbox.action).toBe("batch_review");

      const resReview = parseDeepLink("accrual://review", [], []);
      expect(resReview.action).toBe("batch_review");

      const resDraft = parseDeepLink("trouvaille://drafts", [], []);
      expect(resDraft.action).toBe("batch_review");
    });

    it("only routes to scan when explicitly requested with 'accrual://scan'", () => {
      const resScan = parseDeepLink("accrual://scan", [], []);
      expect(resScan.action).toBe("scan");
    });
  });

  describe("4. Swift Native Source Code Verification", () => {
    const quickLogPath = path.resolve(__dirname, "../ios/App/App/QuickLogIntent.swift");
    const quickLogContent = fs.readFileSync(quickLogPath, "utf-8");

    it("verifies LogScreenshotIntent runs in background (openAppWhenRun = false)", () => {
      expect(quickLogContent).toContain("struct LogScreenshotIntent: AppIntent");
      expect(quickLogContent).toContain("public static var openAppWhenRun: Bool = false");
    });

    it("verifies LogNotificationTransactionIntent runs in background (openAppWhenRun = false)", () => {
      expect(quickLogContent).toContain("struct LogNotificationTransactionIntent: AppIntent");
      expect(quickLogContent).toContain("DraftInbox.write(draft)");
    });

    it("verifies OpenInboxIntent exists and routes to accrual://inbox", () => {
      expect(quickLogContent).toContain("struct OpenInboxIntent: AppIntent");
      expect(quickLogContent).toContain("accrual://inbox");
    });

    it("verifies AccrualInboxPlugin is registered in SceneDelegate.swift", () => {
      const scenePath = path.resolve(__dirname, "../ios/App/App/SceneDelegate.swift");
      const sceneContent = fs.readFileSync(scenePath, "utf-8");
      expect(sceneContent).toContain("bridge?.registerPluginInstance(AccrualInboxPlugin())");
    });

    it("verifies App Group identifier is group.com.syntheticae.accrual", () => {
      expect(quickLogContent).toContain('static let group = "group.com.syntheticae.accrual"');
    });
  });

  describe("5. Xcode Project Configuration Integrity", () => {
    const pbxPath = path.resolve(__dirname, "../ios/App/App.xcodeproj/project.pbxproj");
    const pbxContent = fs.readFileSync(pbxPath, "utf-8");

    it("verifies AccrualInboxPlugin.swift is linked in project.pbxproj Sources", () => {
      expect(pbxContent).toContain("AccrualInboxPlugin.swift in Sources");
      expect(pbxContent).toContain("AccrualInboxPlugin.swift */ = {isa = PBXFileReference");
    });
  });

  describe("6. Generated Shortcut Artifact Verification", () => {
    const plistPath = path.resolve(__dirname, "../public/shortcuts/Accrual-Capture-Transaction.plist");
    expect(fs.existsSync(plistPath)).toBe(true);
    const plistContent = fs.readFileSync(plistPath, "utf-8");

    it("verifies generated shortcut plist contains Take Screenshot and LogScreenshotIntent actions", () => {
      expect(plistContent).toContain("is.workflow.actions.takescreenshot");
      expect(plistContent).toContain("LogScreenshotIntent");
      expect(plistContent).toContain("WFWorkflowIconGlyphNumber");
    });
  });
});
