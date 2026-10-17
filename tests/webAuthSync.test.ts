import { describe, it, expect, vi, beforeEach } from "vitest";

// Polyfill localStorage in node test environment
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

// Mock Supabase
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

describe("webAuthSync - Web Dashboard Handshake Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("QR Parsing & Validation", () => {
    it("successfully parses valid Accrual Web Dashboard QR JSON", () => {
      const payload = {
        app: "accrual",
        version: "1.0",
        action: "login",
        sessionId: "sess-accrual-123",
        channel: "accrual-qr-sess-accrual-123",
        origin: "https://accrual.app",
        createdAt: Date.now(),
      };

      const result = parseWebDashboardQr(JSON.stringify(payload));
      expect(result.valid).toBe(true);
      expect(result.payload?.sessionId).toBe("sess-accrual-123");
      expect(result.payload?.origin).toBe("https://accrual.app");
      expect(result.payload?.channel).toBe("accrual-qr-sess-accrual-123");
    });

    it("successfully parses valid legacy Trouvaille Web Dashboard QR JSON", () => {
      const payload = {
        app: "trouvaille",
        version: "1.0",
        action: "login",
        sessionId: "sess-abc-123",
        channel: "trouvaille-qr-sess-abc-123",
        origin: "https://trouvaille.app",
        createdAt: Date.now(),
      };

      const result = parseWebDashboardQr(JSON.stringify(payload));
      expect(result.valid).toBe(true);
      expect(result.payload?.sessionId).toBe("sess-abc-123");
      expect(result.payload?.origin).toBe("https://trouvaille.app");
      expect(result.payload?.channel).toBe("trouvaille-qr-sess-abc-123");
    });

    it("rejects non-accrual/non-trouvaille QR codes", () => {
      const payload = {
        app: "otherapp",
        action: "login",
        sessionId: "123",
      };

      const result = parseWebDashboardQr(JSON.stringify(payload));
      expect(result.valid).toBe(false);
      expect(result.error).toContain("bukan untuk aplikasi Accrual");
    });

    it("rejects payload with missing sessionId or wrong action", () => {
      const payload = {
        app: "trouvaille",
        action: "view",
      };

      const result = parseWebDashboardQr(JSON.stringify(payload));
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Payload QR Code tidak valid");
    });

    it("rejects expired QR codes (>10 minutes old)", () => {
      const payload = {
        app: "trouvaille",
        version: "1.0",
        action: "login",
        sessionId: "sess-old-999",
        createdAt: Date.now() - 700000, // ~11 minutes ago
      };

      const result = parseWebDashboardQr(JSON.stringify(payload));
      expect(result.valid).toBe(false);
      expect(result.error).toContain("kedaluwarsa");
    });

    it("handles malformed non-JSON strings gracefully", () => {
      const result = parseWebDashboardQr("not a json string");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Format QR Code tidak dikenali");
    });
  });

  describe("Linked Sessions Local Storage", () => {
    it("saves and retrieves linked sessions correctly", () => {
      expect(getLinkedWebSessions()).toEqual([]);

      const session1: LinkedWebSession = {
        sessionId: "s1",
        origin: "https://app.trouvaille.com",
        channel: "trouvaille-qr-s1",
        linkedAt: Date.now(),
        userEmail: "user@example.com",
      };

      saveLinkedWebSession(session1);
      const retrieved = getLinkedWebSessions();
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].sessionId).toBe("s1");

      const session2: LinkedWebSession = {
        sessionId: "s2",
        origin: "http://localhost:5173",
        channel: "trouvaille-qr-s2",
        linkedAt: Date.now() + 100,
        userEmail: "user@example.com",
      };

      saveLinkedWebSession(session2);
      expect(getLinkedWebSessions().length).toBe(2);

      removeLinkedWebSession("s1");
      expect(getLinkedWebSessions().length).toBe(1);
      expect(getLinkedWebSessions()[0].sessionId).toBe("s2");

      clearAllLinkedWebSessions();
      expect(getLinkedWebSessions()).toEqual([]);
    });
  });

  describe("Session Authorization Handshake", () => {
    it("returns error if mobile user is not logged in", async () => {
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
      });

      const qr = JSON.stringify({
        app: "trouvaille",
        version: "1.0",
        action: "login",
        sessionId: "sess-1",
        createdAt: Date.now(),
      });

      const res = await authorizeWebDashboardSession(qr);
      expect(res.success).toBe(false);
      expect(res.error).toContain("belum login di aplikasi mobile");
    });

    it("successfully broadcasts session tokens and resolves upon session-confirmed", async () => {
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: {
          session: {
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            user: { email: "test@trouvaille.com" },
          },
        },
      });

      const mockSend = vi.fn().mockResolvedValue("ok");
      let confirmedCb: any = null;

      const mockChannel = {
        on: vi.fn((_type: string, filter: any, callback: any) => {
          if (filter?.event === "session-confirmed") {
            confirmedCb = callback;
          }
          return mockChannel;
        }),
        subscribe: vi.fn((callback: (status: string) => void) => {
          setTimeout(() => {
            callback("SUBSCRIBED");
            // Simulate Web Dashboard ACK
            setTimeout(() => {
              if (confirmedCb) confirmedCb({ payload: { email: "test@trouvaille.com" } });
            }, 10);
          }, 10);
          return mockChannel;
        }),
        send: mockSend,
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      const qr = JSON.stringify({
        app: "trouvaille",
        version: "1.0",
        action: "login",
        sessionId: "sess-valid-123",
        channel: "trouvaille-qr-sess-valid-123",
        origin: "https://trouvaille.app",
        createdAt: Date.now(),
      });

      const res = await authorizeWebDashboardSession(qr, { timeoutMs: 5000 });
      expect(res.success).toBe(true);
      expect(res.sessionInfo?.sessionId).toBe("sess-valid-123");
      expect(mockSend).toHaveBeenCalledWith({
        type: "broadcast",
        event: "session-granted",
        payload: {
          session: {
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
          },
          user: { email: "test@trouvaille.com" },
        },
      });

      // Verify recorded in local storage
      const sessions = getLinkedWebSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].sessionId).toBe("sess-valid-123");
    });

    it("rejects gracefully when web dashboard rejects session", async () => {
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: {
          session: {
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            user: { email: "test@trouvaille.com" },
          },
        },
      });

      let rejectedCb: any = null;
      const mockChannel = {
        on: vi.fn((_type: string, filter: any, callback: any) => {
          if (filter?.event === "session-rejected") {
            rejectedCb = callback;
          }
          return mockChannel;
        }),
        subscribe: vi.fn((callback: (status: string) => void) => {
          setTimeout(() => {
            callback("SUBSCRIBED");
            setTimeout(() => {
              if (rejectedCb) rejectedCb({ payload: { error: "Token expired" } });
            }, 10);
          }, 10);
          return mockChannel;
        }),
        send: vi.fn().mockResolvedValue("ok"),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      const qr = JSON.stringify({
        app: "trouvaille",
        version: "1.0",
        action: "login",
        sessionId: "sess-rej-123",
        channel: "trouvaille-qr-sess-rej-123",
        createdAt: Date.now(),
      });

      const res = await authorizeWebDashboardSession(qr, { timeoutMs: 3000 });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Token expired");
      // Must not be saved to local storage
      expect(getLinkedWebSessions()).toEqual([]);
    });

    it("rejects gracefully when channel connection fails", async () => {
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: {
          session: {
            access_token: "tok",
            refresh_token: "ref",
            user: { email: "test@trouvaille.com" },
          },
        },
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback: (status: string) => void) => {
          setTimeout(() => callback("CHANNEL_ERROR"), 10);
          return mockChannel;
        }),
        send: vi.fn(),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      const qr = JSON.stringify({
        app: "trouvaille",
        version: "1.0",
        action: "login",
        sessionId: "sess-error",
        createdAt: Date.now(),
      });

      const res = await authorizeWebDashboardSession(qr, { timeoutMs: 2000 });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Gagal terhubung ke saluran sinkronisasi");
    });
  });
});
