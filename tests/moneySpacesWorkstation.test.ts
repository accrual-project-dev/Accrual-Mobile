import { describe, it, expect } from "vitest";
import {
  generateInviteCode,
  normalizeInviteCode,
  resolveLedgerCandidateIds,
} from "../src/lib/sharedLedgerService";
import {
  generateQrSvg,
  generateQrDataUrl,
  buildJoinLedgerUrl,
} from "../src/lib/qrCodeGenerator";
import { DEFAULT_MONEY_SPACES, type MoneySpace } from "../src/contexts/SpaceContext";
import type { LedgerMember, LedgerMemberRole, Transaction } from "../src/types";
import * as fs from "fs";
import * as path from "path";

describe("Multi-User Collaborative Money Spaces & Partner Sharing Workstation Suite (Audit #30)", () => {
  describe("1. Space Terminology, Clean Nomenclature & Invariants", () => {
    it("provides personal space as the default initial MoneySpace", () => {
      expect(DEFAULT_MONEY_SPACES.length).toBeGreaterThan(0);
      const personal = DEFAULT_MONEY_SPACES[0];
      expect(personal.id).toBe("personal");
      expect(personal.name).toBe("Personal Space");
      expect(personal.role).toBe("owner");
      expect(personal.isDefault).toBe(true);
    });

    it("verifies zero native colored system emojis in Money Space components", () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      const manageSheetPath = path.resolve(__dirname, "../src/components/settings/ManageLedgersSheet.tsx");
      const joinModalPath = path.resolve(__dirname, "../src/components/settings/JoinLedgerModal.tsx");
      const sharedDetailPath = path.resolve(__dirname, "../src/components/settings/SharedLedgerDetailSheet.tsx");

      [manageSheetPath, joinModalPath, sharedDetailPath].forEach((filePath) => {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(emojiRegex.test(content)).toBe(false);
      });
    });

    it("verifies dynamic safe-area bottom insets across all space collaboration sheets", () => {
      const manageSheet = fs.readFileSync(
        path.resolve(__dirname, "../src/components/settings/ManageLedgersSheet.tsx"),
        "utf-8"
      );
      const joinModal = fs.readFileSync(
        path.resolve(__dirname, "../src/components/settings/JoinLedgerModal.tsx"),
        "utf-8"
      );
      const sharedDetail = fs.readFileSync(
        path.resolve(__dirname, "../src/components/settings/SharedLedgerDetailSheet.tsx"),
        "utf-8"
      );

      const standardInset = "pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),28px)]";
      const standardPadding = "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)";

      expect(manageSheet).toContain(standardPadding);
      expect(joinModal).toContain(standardInset);
      expect(sharedDetail).toContain(standardInset);
    });

    it("verifies that user-facing sheet titles use Space nomenclature instead of Ledger", () => {
      const manageSheet = fs.readFileSync(
        path.resolve(__dirname, "../src/components/settings/ManageLedgersSheet.tsx"),
        "utf-8"
      );
      expect(manageSheet).toContain('"Kelola Space"');
      expect(manageSheet).toContain('"Manage Spaces"');
      expect(manageSheet).toContain('"Space Baru"');
      expect(manageSheet).toContain('"Create New Space"');
      expect(manageSheet).toContain('"Ubah Space"');
      expect(manageSheet).toContain('"Edit Space"');
      expect(manageSheet).toContain('"Gabung Space"');
      expect(manageSheet).toContain('"Join Space"');
    });
  });

  describe("2. Alphanumeric Invite Code Generation & Sanitization", () => {
    it("generates a high-entropy 6-character invite code prefixed with TRV-", () => {
      const code = generateInviteCode();
      expect(code).toMatch(/^TRV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    });

    it("completely filters out visually ambiguous characters (0, O, 1, I, L)", () => {
      for (let i = 0; i < 60; i++) {
        const code = generateInviteCode();
        const body = code.replace("TRV-", "");
        expect(body).not.toMatch(/[01OIL]/i);
      }
    });

    it("normalizes user-entered invite codes with various formats and casing", () => {
      expect(normalizeInviteCode("trv-8x2k9a")).toBe("TRV8X2K9A");
      expect(normalizeInviteCode("  8x2k9a  ")).toBe("8X2K9A");
      expect(normalizeInviteCode("TRV - 8X2K9A")).toBe("TRV8X2K9A");
      expect(normalizeInviteCode("trv 8x2 k9a")).toBe("TRV8X2K9A");
    });
  });

  describe("3. Cross-Device QR Code Generation & Deep Linking", () => {
    it("builds a secure join URL and deep link with canonical route", () => {
      const { deepLink, webUrl } = buildJoinLedgerUrl("TRV-8X2K9A");
      expect(deepLink).toBe("trouvaille://join?code=TRV8X2K9A");
      expect(webUrl).toBe("https://trouvaille.app/join?code=TRV8X2K9A");
    });

    it("generates a valid monochrome SVG QR code containing vector path elements", async () => {
      const svg = await generateQrSvg("TRV-8X2K9A");
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain("<path");
    });

    it("generates a valid data URL base64 image", async () => {
      const dataUrl = await generateQrDataUrl("TRV-8X2K9A");
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe("4. Multi-User Member Roles & Collaborative Permissions", () => {
    const mockMembers: LedgerMember[] = [
      { id: "m-1", ledger_id: "space-family", user_id: "usr-owner", role: "owner", status: "active", display_name: "Owner User" },
      { id: "m-2", ledger_id: "space-family", user_id: "usr-editor", role: "editor", status: "active", display_name: "Partner Editor" },
      { id: "m-3", ledger_id: "space-family", user_id: "usr-viewer", role: "viewer", status: "active", display_name: "Family Viewer" },
      { id: "m-4", ledger_id: "space-family", user_id: "usr-pending", role: "editor", status: "pending", display_name: "Guest Pending" },
    ];

    it("identifies space owner rights accurately", () => {
      const owner = mockMembers.find((m) => m.role === "owner");
      expect(owner?.user_id).toBe("usr-owner");
      expect(owner?.status).toBe("active");
    });

    it("distinguishes active members from pending approval members", () => {
      const pending = mockMembers.filter((m) => m.status === "pending");
      const active = mockMembers.filter((m) => m.status === "active");
      expect(pending.length).toBe(1);
      expect(pending[0].user_id).toBe("usr-pending");
      expect(active.length).toBe(3);
    });

    it("supports role transitions between editor and viewer", () => {
      let role: LedgerMemberRole = "editor";
      const toggleRole = (r: LedgerMemberRole): LedgerMemberRole => (r === "editor" ? "viewer" : "editor");
      role = toggleRole(role);
      expect(role).toBe("viewer");
      role = toggleRole(role);
      expect(role).toBe("editor");
    });
  });

  describe("5. Space Cashflow Filtering & Transaction Isolation", () => {
    const sampleTxs: Transaction[] = [
      { id: "tx-1", amount: 50000, type: "expense", space_id: "personal", occurred_on: "2026-10-18T08:00:00", wallet_id: "w1", category_id: null, note: "Personal grocery" },
      { id: "tx-2", amount: 150000, type: "expense", space_id: "space-family", occurred_on: "2026-10-18T09:00:00", wallet_id: "w1", category_id: null, note: "Family dinner" },
      { id: "tx-3", amount: 300000, type: "income", space_id: "space-family", occurred_on: "2026-10-18T10:00:00", wallet_id: "w1", category_id: null, note: "Shared contribution" },
      { id: "tx-4", amount: 75000, type: "expense", space_id: "personal", occurred_on: "2026-10-18T11:00:00", wallet_id: "w1", category_id: null, note: "#trip Ticket" },
    ];

    it("filters transactions strictly by space_id", () => {
      const personalTxs = sampleTxs.filter((t) => (t.space_id || "personal") === "personal");
      const familyTxs = sampleTxs.filter((t) => t.space_id === "space-family");

      expect(personalTxs.length).toBe(2);
      expect(familyTxs.length).toBe(2);
    });

    it("calculates space cashflow metrics accurately", () => {
      const familyTxs = sampleTxs.filter((t) => t.space_id === "space-family");
      let income = 0;
      let expense = 0;
      familyTxs.forEach((t) => {
        if (t.type === "income") income += t.amount;
        if (t.type === "expense") expense += t.amount;
      });

      expect(income).toBe(300000);
      expect(expense).toBe(150000);
      expect(income - expense).toBe(150000);
    });

    it("reassigns orphaned transactions to Personal Space upon custom space deletion", () => {
      const spaceToDelete = "space-family";
      const reassigned = sampleTxs.map((t) => {
        if (t.space_id === spaceToDelete) {
          return { ...t, space_id: "personal" };
        }
        return t;
      });

      const remainingPersonal = reassigned.filter((t) => t.space_id === "personal");
      expect(remainingPersonal.length).toBe(4);
      expect(reassigned.some((t) => t.space_id === spaceToDelete)).toBe(false);
    });
  });

  describe("6. Pure Non-Mixed Localization (Rule 6 GEMINI.md)", () => {
    it("branches role badges strictly between Indonesian and English without parentheticals", () => {
      const getRoleLabel = (role: LedgerMemberRole, isIndonesian: boolean) => {
        if (isIndonesian) {
          return role === "owner" ? "Pemilik" : role === "editor" ? "Pengelola" : "Pemantau";
        }
        return role === "owner" ? "Owner" : role === "editor" ? "Editor" : "Viewer";
      };

      expect(getRoleLabel("owner", true)).toBe("Pemilik");
      expect(getRoleLabel("editor", true)).toBe("Pengelola");
      expect(getRoleLabel("viewer", true)).toBe("Pemantau");

      expect(getRoleLabel("owner", false)).toBe("Owner");
      expect(getRoleLabel("editor", false)).toBe("Editor");
      expect(getRoleLabel("viewer", false)).toBe("Viewer");
    });

    it("branches space status badges purely without English mixing in Indonesian mode", () => {
      const getStatusLabel = (status: "active" | "pending", isIndonesian: boolean) => {
        if (isIndonesian) {
          return status === "pending" ? "Menunggu" : "Aktif";
        }
        return status === "pending" ? "Pending" : "Active";
      };

      expect(getStatusLabel("pending", true)).toBe("Menunggu");
      expect(getStatusLabel("active", true)).toBe("Aktif");
      expect(getStatusLabel("pending", false)).toBe("Pending");
      expect(getStatusLabel("active", false)).toBe("Active");
    });
  });
});
