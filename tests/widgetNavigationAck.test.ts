import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ clearPendingIngestion: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  registerPlugin: () => native,
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" },
}));
import { widgetSyncService } from "../src/lib/widgetSyncService";

describe("Widget navigation acknowledgements", () => {
  beforeEach(() => {
    native.clearPendingIngestion.mockReset();
    native.clearPendingIngestion.mockResolvedValue({ success: true });
  });

  it("acknowledges navigation without authorizing removal of pending money records", async () => {
    await expect(widgetSyncService.clearPendingIngestion({ navigation: "review" })).resolves.toBe(true);
    expect(native.clearPendingIngestion).toHaveBeenCalledExactlyOnceWith({ navigation: "review" });
  });

  it("passes only explicitly acknowledged IDs to native storage", async () => {
    await widgetSyncService.clearPendingIngestion({ transactionIds: ["completed-id"] });
    expect(native.clearPendingIngestion).toHaveBeenCalledExactlyOnceWith({ transactionIds: ["completed-id"] });
  });

  it("preserves a failed acknowledgement result for retry", async () => {
    native.clearPendingIngestion.mockResolvedValue({ success: false });
    await expect(widgetSyncService.clearPendingIngestion({ navigation: "voice" })).resolves.toBe(false);
  });
});
