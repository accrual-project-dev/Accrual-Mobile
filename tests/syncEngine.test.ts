import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueuePendingMutation,
  getPendingMutations,
  savePendingMutations,
  clearPendingMutations,
  removePendingMutation,
  getDeadMutations,
  clearDeadMutations,
  isNetworkOrTransientError,
  getMutationBackoffMs,
  flushPendingMutations,
  type PendingMutation,
} from "../src/lib/syncEngine";
import { supabase } from "../src/lib/supabase";

// Polyfill localStorage for Node test environment
let store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    store = {};
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe("Offline Sync Engine & Mutation Queue Resilience Suite", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    clearPendingMutations();
    clearDeadMutations();
    vi.restoreAllMocks();
  });

  describe("isNetworkOrTransientError classification", () => {
    it("Identifies browser offline state as transient network error", () => {
      const originalNavigator = global.navigator;
      try {
        Object.defineProperty(global, "navigator", {
          value: { onLine: false },
          configurable: true,
        });
        expect(isNetworkOrTransientError(new Error("Any error"))).toBe(true);
      } finally {
        Object.defineProperty(global, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("Identifies TypeError Failed to fetch and NetworkError as transient", () => {
      expect(isNetworkOrTransientError(new TypeError("Failed to fetch"))).toBe(true);
      expect(isNetworkOrTransientError(new Error("NetworkError when attempting to fetch resource"))).toBe(true);
      expect(isNetworkOrTransientError({ name: "AbortError", message: "The operation was aborted" })).toBe(true);
      expect(isNetworkOrTransientError({ name: "TimeoutError", message: "Request timed out" })).toBe(true);
    });

    it("Identifies HTTP transient status codes (0, 408, 429, 500, 502, 503, 504)", () => {
      expect(isNetworkOrTransientError({ status: 0, message: "" })).toBe(true);
      expect(isNetworkOrTransientError({ status: 408, message: "Request Timeout" })).toBe(true);
      expect(isNetworkOrTransientError({ status: 429, message: "Too Many Requests" })).toBe(true);
      expect(isNetworkOrTransientError({ status: 500, message: "Internal Server Error" })).toBe(true);
      expect(isNetworkOrTransientError({ status: 502, message: "Bad Gateway" })).toBe(true);
      expect(isNetworkOrTransientError({ status: 503, message: "Service Unavailable" })).toBe(true);
      expect(isNetworkOrTransientError({ status: 504, message: "Gateway Timeout" })).toBe(true);
    });

    it("Identifies PostgreSQL connection failure codes (08xxx, 53xxx, 57xxx, PGRST0xx)", () => {
      expect(isNetworkOrTransientError({ code: "08006", message: "connection_failure" })).toBe(true);
      expect(isNetworkOrTransientError({ code: "53300", message: "too_many_connections" })).toBe(true);
      expect(isNetworkOrTransientError({ code: "57P01", message: "admin_shutdown" })).toBe(true);
      expect(isNetworkOrTransientError({ code: "PGRST000", message: "PostgREST connection issue" })).toBe(true);
    });

    it("Correctly flags permanent client errors as non-transient", () => {
      expect(isNetworkOrTransientError({ status: 400, message: "invalid input syntax for type uuid" })).toBe(false);
      expect(isNetworkOrTransientError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
      expect(isNetworkOrTransientError({ code: "23503", message: "foreign key violation" })).toBe(false);
      expect(isNetworkOrTransientError({ status: 422, message: "Unprocessable entity" })).toBe(false);
    });
  });

  describe("getMutationBackoffMs", () => {
    it("Calculates exponential backoff progression", () => {
      expect(getMutationBackoffMs(0)).toBe(0);
      expect(getMutationBackoffMs(1)).toBe(1000);
      expect(getMutationBackoffMs(2)).toBe(2000);
      expect(getMutationBackoffMs(3)).toBe(4000);
      expect(getMutationBackoffMs(4)).toBe(8000);
      expect(getMutationBackoffMs(5)).toBe(16000);
      expect(getMutationBackoffMs(6)).toBe(30000);
      expect(getMutationBackoffMs(10)).toBe(30000);
    });
  });

  describe("enqueuePendingMutation & merge mechanics", () => {
    it("Enqueues an insert mutation and persists in localStorage", () => {
      const mut = enqueuePendingMutation("insert", {
        id: "tx-123",
        amount: 50000,
        type: "expense",
      });

      expect(mut.id).toMatch(/^mut-/);
      expect(mut.type).toBe("insert");
      expect(mut.retryCount).toBe(0);

      const stored = getPendingMutations();
      expect(stored.length).toBe(1);
      expect(stored[0].payload.id).toBe("tx-123");
    });

    it("Merges subsequent offline updates into existing mutation without duplicate queue entries", () => {
      enqueuePendingMutation("insert", {
        id: "tx-123",
        amount: 50000,
        note: "Initial Note",
      });

      enqueuePendingMutation("update", {
        id: "tx-123",
        amount: 75000,
        note: "Updated Note",
      });

      const stored = getPendingMutations();
      expect(stored.length).toBe(1);
      expect(stored[0].payload.amount).toBe(75000);
      expect(stored[0].payload.note).toBe("Updated Note");
    });
  });

  describe("flushPendingMutations resilience & 100% preservation", () => {
    it("NEVER drops mutations when network errors persist, even after 10+ failed attempts", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: { session: { user: { id: "test-user-uuid" } } as any },
        error: null,
      });

      // Simulate a network failure on upsert
      vi.spyOn(supabase, "from").mockReturnValue({
        upsert: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      } as any);

      const mut = enqueuePendingMutation("insert", {
        id: "tx-test-resilient",
        amount: 25000,
        type: "expense",
      });

      // Run flush 10 times with force: true
      for (let i = 0; i < 10; i++) {
        const res = await flushPendingMutations({ force: true });
        expect(res.flushedCount).toBe(0);
        expect(res.remainingCount).toBe(1);
      }

      const pending = getPendingMutations();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(mut.id);
      expect(pending[0].retryCount).toBe(10);
      expect(pending[0].lastError?.toLowerCase()).toContain("failed to fetch");

      // Verify it was NOT quarantined or dropped
      expect(getDeadMutations().length).toBe(0);
    });

    it("Breaks out early on network error to preserve battery and maintain FIFO order", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: { session: { user: { id: "test-user-uuid" } } as any },
        error: null,
      });

      const upsertMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      vi.spyOn(supabase, "from").mockReturnValue({
        upsert: upsertMock,
      } as any);

      enqueuePendingMutation("insert", { id: "tx-1", amount: 10000 });
      enqueuePendingMutation("insert", { id: "tx-2", amount: 20000 });
      enqueuePendingMutation("insert", { id: "tx-3", amount: 30000 });

      const res = await flushPendingMutations({ force: true });
      expect(res.flushedCount).toBe(0);
      expect(res.remainingCount).toBe(3);

      // Only tx-1 was attempted before breaking out early
      expect(upsertMock).toHaveBeenCalledTimes(1);

      const pending = getPendingMutations();
      expect(pending.length).toBe(3);
      expect(pending[0].retryCount).toBe(1); // Failed on attempt
      expect(pending[1].retryCount).toBe(0); // Untouched to preserve queue
      expect(pending[2].retryCount).toBe(0); // Untouched to preserve queue
    });

    it("Quarantines permanent client validation errors after 5 failed attempts without losing the record", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: { session: { user: { id: "test-user-uuid" } } as any },
        error: null,
      });

      // Simulate a permanent 400 Bad Request error
      vi.spyOn(supabase, "from").mockReturnValue({
        upsert: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: "invalid input syntax for type uuid: 'bad-id'",
            code: "22P02",
            status: 400,
          },
        }),
      } as any);

      enqueuePendingMutation("insert", { id: "bad-id", amount: 15000 });

      // Run flush 5 times
      for (let i = 0; i < 5; i++) {
        await flushPendingMutations({ force: true });
      }

      // Pending queue is now empty
      const pending = getPendingMutations();
      expect(pending.length).toBe(0);

      // Record is safely preserved in dead mutations quarantine
      const dead = getDeadMutations();
      expect(dead.length).toBe(1);
      expect(dead[0].payload.id).toBe("bad-id");
      expect(dead[0].lastError).toContain("invalid input syntax");
    });

    it("Guarantees concurrency safety: mutations enqueued during active flush are NEVER overwritten", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: { session: { user: { id: "test-user-uuid" } } as any },
        error: null,
      });

      // Simulate an async delay on upsert
      vi.spyOn(supabase, "from").mockReturnValue({
        upsert: vi.fn().mockImplementation(async () => {
          // Concurrently add a new mutation while this upsert is awaiting
          enqueuePendingMutation("insert", { id: "tx-concurrent-new", amount: 99000 });
          return { data: [{ id: "tx-initial" }], error: null };
        }),
      } as any);

      enqueuePendingMutation("insert", { id: "tx-initial", amount: 10000 });

      const res = await flushPendingMutations({ force: true });
      expect(res.flushedCount).toBe(1);

      // tx-concurrent-new MUST still be in the queue!
      const pending = getPendingMutations();
      expect(pending.length).toBe(1);
      expect(pending[0].payload.id).toBe("tx-concurrent-new");
      expect(pending[0].payload.amount).toBe(99000);
    });

    it("Skips network requests when browser reports completely offline", async () => {
      const originalNavigator = global.navigator;
      try {
        Object.defineProperty(global, "navigator", {
          value: { onLine: false },
          configurable: true,
        });

        const getSessionMock = vi.spyOn(supabase.auth, "getSession");

        enqueuePendingMutation("insert", { id: "tx-offline", amount: 50000 });

        const res = await flushPendingMutations({ force: true });
        expect(res.flushedCount).toBe(0);
        expect(res.remainingCount).toBe(1);
        expect(res.errors[0]).toBe("Device is currently offline");

        // getSession was never called because navigator.onLine was false
        expect(getSessionMock).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(global, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("Successfully flushes and removes synced mutations when network is healthy", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: { session: { user: { id: "test-user-uuid" } } as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ data: [{ id: "tx-healthy" }], error: null }),
      } as any);

      enqueuePendingMutation("insert", { id: "tx-healthy", amount: 80000 });

      const res = await flushPendingMutations({ force: true });
      expect(res.flushedCount).toBe(1);
      expect(res.remainingCount).toBe(0);

      const pending = getPendingMutations();
      expect(pending.length).toBe(0);
    });
  });
});
