import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveDraftBatch, getDraftBatches, getAllDraftItems } from "../src/lib/draftTransactionService";
import { parseDeepLink } from "../src/lib/deepLinkHandler";
import type { ParsedStatementItem } from "../src/lib/statementParser";
const store = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
vi.stubGlobal("window", { dispatchEvent: vi.fn() });
vi.stubGlobal("CustomEvent", class { constructor(public type: string, public detail: unknown) {} });
beforeEach(() => store.clear());

describe("Capture review persistence", () => {
  it("keeps unresolved captures in a recoverable review batch", () => {
    const capture: ParsedStatementItem = { id: "capture-1", date: "2026-10-29", time: "11:30", description: "Kopi Kenangan", cleanDescription: "Kopi Kenangan", amount: 45000, type: "expense", walletName: null, suggestedCategoryId: null, suggestedCategoryName: null, suggestedCategoryEmoji: null, isDuplicate: false, selected: true, raw: "QRIS Rp 45.000 Kopi Kenangan", confidence: 0.9, needsReview: true };
    expect(saveDraftBatch([capture], "BCA", "back_tap")).toBeTruthy();
    expect(getDraftBatches()[0]).toMatchObject({ appName: "BCA", source: "back_tap" });
    expect(getAllDraftItems()[0]).toMatchObject({ amount: 45000, needsReview: true, walletName: null });
    expect(parseDeepLink("accrual://inbox", [], []).action).toBe("batch_review");
  });
  it("does not create a batch for an empty capture", () => {
    expect(saveDraftBatch([], "BCA", "back_tap")).toBe("");
    expect(getAllDraftItems()).toEqual([]);
  });
});
