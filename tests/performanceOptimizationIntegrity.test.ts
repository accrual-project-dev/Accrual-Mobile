import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Performance Optimization & Bundle Integrity Audit (#18)", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("excises static ocrEngine import from sessionCleanup to prevent tesseract leakage into root bundle", () => {
    const sessionCleanupPath = path.join(rootDir, "src/lib/sessionCleanup.ts");
    const content = fs.readFileSync(sessionCleanupPath, "utf-8");

    // Must NOT have static import of terminateOCRWorker
    expect(content).not.toMatch(/import\s+\{[^}]*terminateOCRWorker[^}]*\}\s+from\s+["']\.\/ocrEngine["']/);

    // Must use dynamic import in teardown
    expect(content).toMatch(/import\(["']\.\/ocrEngine["']\)/);
  });

  it("lazy loads secondary modal sheets in App.tsx", () => {
    const appPath = path.join(rootDir, "src/App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");

    // Static imports must not exist
    expect(content).not.toMatch(/import\s+\{[^}]*BatchTransactionReviewSheet[^}]*\}\s+from\s+["']\.\/components\/transactions\/BatchTransactionReviewSheet["']/);
    expect(content).not.toMatch(/import\s+\{[^}]*AccrualPaywallModal[^}]*\}\s+from\s+["']\.\/components\/paywall\/AccrualPaywallModal["']/);

    // Dynamic lazy imports must exist
    expect(content).toMatch(/const\s+BatchTransactionReviewSheet\s*=\s*lazy\(/);
    expect(content).toMatch(/const\s+AccrualPaywallModal\s*=\s*lazy\(/);
  });

  it("lazy loads secondary modal sheets in HomeModalsContainer.tsx and HomePage.tsx", () => {
    const homeModalsPath = path.join(rootDir, "src/components/home/HomeModalsContainer.tsx");
    const homeModalsContent = fs.readFileSync(homeModalsPath, "utf-8");

    // Modals in HomeModalsContainer must be lazily imported
    expect(homeModalsContent).toMatch(/const\s+BillManagementSheets\s*=\s*lazy\(/);
    expect(homeModalsContent).toMatch(/const\s+PayBillModal\s*=\s*lazy\(/);
    expect(homeModalsContent).toMatch(/const\s+ManageLedgersSheet\s*=\s*lazy\(/);
    expect(homeModalsContent).toMatch(/const\s+CategoryManagementSheets\s*=\s*lazy\(/);
    expect(homeModalsContent).toMatch(/const\s+NfcCardReaderModal\s*=\s*lazy\(/);
    expect(homeModalsContent).toMatch(/const\s+ProfileSheet\s*=\s*lazy\(/);
    expect(homeModalsContent).toMatch(/const\s+WebDashboardLinkModal\s*=\s*lazy\(/);
    expect(homeModalsContent).toMatch(/const\s+GoalDetailModal\s*=\s*lazy\(/);

    const homePagePath = path.join(rootDir, "src/pages/HomePage.tsx");
    const homePageContent = fs.readFileSync(homePagePath, "utf-8");
    expect(homePageContent).toMatch(/const\s+DebtReceivablesSheet\s*=\s*lazy\(/);
  });

  it("lazy loads secondary modal sheets in AssetsModalsContainer.tsx and AssetsPage.tsx", () => {
    const assetsModalsPath = path.join(rootDir, "src/components/assets/AssetsModalsContainer.tsx");
    const assetsModalsContent = fs.readFileSync(assetsModalsPath, "utf-8");

    expect(assetsModalsContent).toMatch(/const\s+AddAssetModal\s*=\s*lazy\(/);
    expect(assetsModalsContent).toMatch(/const\s+ConvertWalletToAssetModal\s*=\s*lazy\(/);
    expect(assetsModalsContent).toMatch(/const\s+ConsolidatedBalanceSheetDrawer\s*=\s*lazy\(/);
    expect(assetsModalsContent).toMatch(/const\s+AssetDetailSheet\s*=\s*lazy\(/);
    expect(assetsModalsContent).toMatch(/const\s+StakingYieldModal\s*=\s*lazy\(/);
    expect(assetsModalsContent).toMatch(/const\s+AssetMetricDrillDownSheet\s*=\s*lazy\(/);

    const assetsPagePath = path.join(rootDir, "src/pages/AssetsPage.tsx");
    const assetsPageContent = fs.readFileSync(assetsPagePath, "utf-8");
    expect(assetsPageContent).toMatch(/const\s+CashAccountDetailSheet\s*=\s*lazy\(/);
    expect(assetsPageContent).toMatch(/const\s+WalletManagementSheets\s*=\s*lazy\(/);
  });

  it("memoizes HomeWidgetRenderer with custom shallow prop comparator", () => {
    const widgetRendererPath = path.join(rootDir, "src/components/home/HomeWidgetRenderer.tsx");
    const content = fs.readFileSync(widgetRendererPath, "utf-8");

    expect(content).toMatch(/React\.memo\(\s*HomeWidgetRendererComponent/);
    expect(content).toMatch(/export\s+const\s+HomeWidgetRenderer\s*=\s*Object\.assign\(/);
    expect(content).toContain("prev.cardId !== next.cardId");
    expect(content).toContain("prev.size !== next.size");
    expect(content).toContain("prev.isEditMode !== next.isEditMode");
    expect(content).toContain("prev.hideBalance !== next.hideBalance");
  });

  it("configures long-term vendor chunking and PWA globIgnores in vite.config.ts", () => {
    const viteConfigPath = path.join(rootDir, "vite.config.ts");
    const content = fs.readFileSync(viteConfigPath, "utf-8");

    // Vendor chunks
    expect(content).toContain('"date-vendor"');
    expect(content).toContain('"icons-vendor"');
    expect(content).toContain('"capacitor-vendor"');

    // PWA precache exclusions
    expect(content).toContain('"**/tesseract-*.js"');
  });
});
