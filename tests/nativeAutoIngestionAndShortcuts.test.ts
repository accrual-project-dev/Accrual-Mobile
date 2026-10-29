import { describe, expect, it } from "vitest";
import { parseDeepLink } from "../src/lib/deepLinkHandler";
import { SHORTCUT_PRESETS } from "../src/lib/shortcutsConfig";

describe("Capture catalog navigation integration", () => {
  it.each(["accrual://inbox", "accrual://review", "trouvaille://drafts"])("opens review for %s", url => {
    expect(parseDeepLink(url, [], []).action).toBe("batch_review");
  });
  it("opens the camera only for the explicit receipt route", () => {
    const receipt = SHORTCUT_PRESETS.find(p => p.id === "receipt_scan")!;
    expect(parseDeepLink(receipt.directScheme!, [], []).action).toBe("scan");
    const review = SHORTCUT_PRESETS.find(p => p.id === "review_inbox")!;
    expect(parseDeepLink(review.directScheme!, [], []).action).toBe("batch_review");
  });
  it("opens Quick Add without requesting automatic persistence", () => {
    const quickAdd = SHORTCUT_PRESETS.find(p => p.id === "quick_add")!;
    const result = parseDeepLink(quickAdd.directScheme!, [], []);
    expect(result.action).toBe("transaction");
    expect(result.autoSave).not.toBe(true);
  });
  it("opens voice capture directly without an installation link", () => {
    const voice = SHORTCUT_PRESETS.find(p => p.id === "voice_entry")!;
    expect(parseDeepLink(voice.directScheme!, [], []).action).toBe("voice");
  });
});
