import { describe, expect, it } from "vitest";
import { parseDeepLink } from "../src/lib/deepLinkHandler";
import { DEFAULT_SHORTCUTS_MANIFEST } from "../src/lib/shortcutsConfig";

describe("Capture and manual navigation integration", () => {
  it.each(["accrual://inbox", "accrual://review", "trouvaille://drafts"])("opens review for %s", url => {
    expect(parseDeepLink(url, [], []).action).toBe("batch_review");
  });
  it("keeps the explicit camera route separate from capture review", () => {
    expect(parseDeepLink("accrual://scan", [], []).action).toBe("scan");
    expect(parseDeepLink("accrual://inbox", [], []).action).toBe("batch_review");
    expect(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.screen_scan.direct_scheme).toContain("draft=true");
  });
  it("opens Quick Add without requesting automatic persistence", () => {
    const result = parseDeepLink("accrual://add", [], []);
    expect(result).toMatchObject({ action: "transaction", spaceId: "personal" });
    expect(result.autoSave).not.toBe(true);
  });
  it("opens voice capture directly without requiring an installation link", () => {
    expect(parseDeepLink("accrual://voice", [], []).action).toBe("voice");
  });
});
