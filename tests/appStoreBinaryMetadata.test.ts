import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

describe("App Store binary submission metadata", () => {
  it("does not include Apple's reserved brand in Siri intent descriptions (ITMS-90626)", () => {
    const swift = fs.readFileSync(path.join(root, "ios/App/App/QuickLogIntent.swift"), "utf8");
    const descriptions = [...swift.matchAll(/IntentDescription\("([^"\n]*)"\)/g)].map(match => match[1]);
    expect(descriptions.length).toBeGreaterThan(0);
    expect(descriptions.filter(description => /apple/i.test(description))).toEqual([]);
  });

  it("targets iPhone only for the initial release, including the embedded widget", () => {
    const project = fs.readFileSync(path.join(root, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
    const families = [...project.matchAll(/TARGETED_DEVICE_FAMILY\s*=\s*([^;]+);/g)].map(match => match[1].replaceAll('"', "").trim());
    expect(families).toHaveLength(4);
    expect(families.every(family => family === "1")).toBe(true);
  });
});
