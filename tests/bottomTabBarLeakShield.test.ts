import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("BottomTabBar Ambient Bottom Shield & Viewport Leak Prevention Suite", () => {
  const filePath = path.resolve(__dirname, "../src/components/layout/BottomTabBar.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("includes the ambient bottom shield with test id 'bottom-tab-bar-ambient-shield'", () => {
    expect(content).toContain('data-testid="bottom-tab-bar-ambient-shield"');
  });

  it("enforces pointer-events-none on the shield so it never intercepts clicks or scroll gestures", () => {
    expect(content).toMatch(/data-testid="bottom-tab-bar-ambient-shield"[\s\S]*?pointer-events-none/);
  });

  it("places the shield at z-40 so it stays beneath the floating pill (z-50)", () => {
    expect(content).toMatch(/data-testid="bottom-tab-bar-ambient-shield"[\s\S]*?z-40/);
    expect(content).toMatch(/z-50\s+px-5\s+pb-\[calc\(10px\+env\(safe-area-inset-bottom\)\)\]/);
  });

  it("uses dynamic safe area calculation for shield height rather than a hardcoded pixel value", () => {
    expect(content).toContain('height: "calc(env(safe-area-inset-bottom, 0px) + 84px)"');
  });

  it("implements dual-mode gradient dissolving to var(--bg-base) to prevent bottom leak", () => {
    expect(content).toContain("var(--bg-base) 82%, var(--bg-base) 100%");
    expect(content).toContain("rgba(10,10,13,0)");
    expect(content).toContain("rgba(240,240,242,0)");
  });

  it("preserves liquid glass styling on the floating dock without killing backdrop blur", () => {
    expect(content).toContain('backdropFilter: "blur(28px) saturate(190%)"');
    expect(content).toContain('WebkitBackdropFilter: "blur(28px) saturate(190%)"');
  });
});
