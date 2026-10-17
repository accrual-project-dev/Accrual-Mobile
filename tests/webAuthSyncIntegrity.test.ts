import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Polyfill localStorage in test environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k in store) {
      delete store[k];
    }
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() {
    return Object.keys(store).length;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

import {
  parseWebDashboardQr,
  authorizeWebDashboardSession,
  getLinkedWebSessions,
  saveLinkedWebSession,
  removeLinkedWebSession,
  clearAllLinkedWebSessions,
  type LinkedWebSession,
} from "../src/lib/webAuthSync";
import { supabase } from "../src/lib/supabase";

vi.mock("../src/lib/supabase", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        refreshSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
      channel: vi.fn(),
      removeChannel: vi.fn(),
    },
  };
});

describe("Web Link Gateway & Multi-Device Pairing Ecosystem Integrity (Audit #26)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("Dual-Brand & Channel Compatibility", () => {
    it("handles modern Accrual QR payloads with correct default channel", () => {
      const payload = {
        app: "accrual",
        version: "1.0",
        action: "login",
        sessionId: "sess-modern-456",
        origin: "https://accrual.finance",
      };

      const result = parseWebDashboardQr(JSON.stringify(payload), false);
      expect(result.valid).toBe(true);
      expect(result.payload?.app).toBe("accrual");
      expect(result.payload?.channel).toBe("accrual-qr-sess-modern-456");
      expect(result.payload?.origin).toBe("https://accrual.finance");
    });

    it("handles legacy Trouvaille QR payloads with correct default channel", () => {
      const payload = {
        app: "trouvaille",
        version: "1.0",
        action: "login",
        sessionId: "sess-legacy-789",
        origin: "https://trouvaille.app",
      };

      const result = parseWebDashboardQr(JSON.stringify(payload), false);
      expect(result.valid).toBe(true);
      expect(result.payload?.app).toBe("trouvaille");
      expect(result.payload?.channel).toBe("trouvaille-qr-sess-legacy-789");
    });
  });

  describe("Strict 100% Non-Mixed Localization (Rule 6)", () => {
    it("returns pure English error messages when isIndonesian is false", () => {
      // Empty content
      expect(parseWebDashboardQr("", false).error).toBe("QR code content is empty");

      // App mismatch
      const wrongApp = JSON.stringify({ app: "unknown", action: "login", sessionId: "1" });
      expect(parseWebDashboardQr(wrongApp, false).error).toBe("This QR code is not for Accrual application");

      // Corrupted action
      const badAction = JSON.stringify({ app: "accrual", action: "other", sessionId: "1" });
      expect(parseWebDashboardQr(badAction, false).error).toBe("Invalid QR code payload or corrupted session");

      // Expired
      const expired = JSON.stringify({
        app: "accrual",
        action: "login",
        sessionId: "1",
        createdAt: Date.now() - 700000,
      });
      expect(parseWebDashboardQr(expired, false).error).toBe("QR code has expired. Please refresh on the Web Dashboard");

      // Non-JSON
      expect(parseWebDashboardQr("bad json", false).error).toBe("Unrecognized QR code format (not Accrual JSON)");
    });

    it("returns pure Indonesian error messages when isIndonesian is true", () => {
      // Empty content
      expect(parseWebDashboardQr("", true).error).toBe("Isi QR Code kosong");

      // App mismatch
      const wrongApp = JSON.stringify({ app: "unknown", action: "login", sessionId: "1" });
      expect(parseWebDashboardQr(wrongApp, true).error).toBe("QR Code ini bukan untuk aplikasi Accrual");

      // Corrupted action
      const badAction = JSON.stringify({ app: "accrual", action: "other", sessionId: "1" });
      expect(parseWebDashboardQr(badAction, true).error).toBe("Payload QR Code tidak valid atau format sesi rusak");

      // Expired
      const expired = JSON.stringify({
        app: "accrual",
        action: "login",
        sessionId: "1",
        createdAt: Date.now() - 700000,
      });
      expect(parseWebDashboardQr(expired, true).error).toBe("QR Code telah kedaluwarsa. Silakan muat ulang di Web Dashboard");

      // Non-JSON
      expect(parseWebDashboardQr("bad json", true).error).toBe("Format QR Code tidak dikenali (bukan JSON Accrual)");
    });

    it("authorizes session with pure English errors when isIndonesian is false", async () => {
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
      });

      const qr = JSON.stringify({
        app: "accrual",
        action: "login",
        sessionId: "sess-en-1",
      });

      const res = await authorizeWebDashboardSession(qr, { isIndonesian: false });
      expect(res.success).toBe(false);
      expect(res.error).toBe("You are not logged in on mobile. Please sign in first.");
    });
  });

  describe("Modal Architecture & Safe-Area Inspection", () => {
    it("verifies WebDashboardLinkModal adheres to Rule 5 & 6 (no mixed localization, safe-area inset)", () => {
      const modalPath = path.resolve(__dirname, "../src/components/settings/WebDashboardLinkModal.tsx");
      const modalCode = fs.readFileSync(modalPath, "utf-8");

      // Must use pure Indonesian for step 1 instruction
      expect(modalCode).toContain('Pindai dengan Aplikasi');
      expect(modalCode).not.toContain("pilih tab 'Scan with App'");

      // Must not use English 'via' inside Indonesian text
      expect(modalCode).toContain("melalui Supabase Realtime");
      expect(modalCode).not.toContain("terenkripsi via Supabase Realtime");

      // Must comply with safe-area bottom inset
      expect(modalCode).toContain("pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)]");

      // Must nullify videoRef.current.srcObject on teardown
      expect(modalCode).toContain("videoRef.current.srcObject = null");
    });
  });

  describe("Session Management Storage Lifecycle", () => {
    it("correctly manages linked web sessions with FIFO bounds", () => {
      clearAllLinkedWebSessions();
      expect(getLinkedWebSessions()).toHaveLength(0);

      // Add 12 sessions, verify capped at 10
      for (let i = 1; i <= 12; i++) {
        saveLinkedWebSession({
          sessionId: `sess-${i}`,
          origin: "https://accrual.finance",
          channel: `accrual-qr-sess-${i}`,
          linkedAt: Date.now() + i * 10,
          userEmail: "auditor@accrual.com",
        });
      }

      const sessions = getLinkedWebSessions();
      expect(sessions).toHaveLength(10);
      expect(sessions[0].sessionId).toBe("sess-12"); // Most recent first

      removeLinkedWebSession("sess-12");
      expect(getLinkedWebSessions()).toHaveLength(9);

      clearAllLinkedWebSessions();
      expect(getLinkedWebSessions()).toHaveLength(0);
    });
  });
});
