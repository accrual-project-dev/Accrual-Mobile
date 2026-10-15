import { describe, it, expect, vi } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { WidgetFallbackCard } from "../src/components/home/widgets/WidgetFallbackCard";
import { HomeWidgetRenderer } from "../src/components/home/HomeWidgetRenderer";

// Mock subscription context for HomeWidgetRenderer testing
vi.mock("../src/contexts/SubscriptionContext", () => ({
  useSubscription: () => ({
    isPremium: true,
    openPaywall: vi.fn(),
  }),
}));

vi.mock("../src/contexts/CurrencyContext", () => ({
  useCurrency: () => ({
    preferredCurrency: "IDR",
    formatCurrency: (val: number) => `Rp ${val}`,
  }),
}));

vi.mock("../src/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "id",
    isIndonesian: true,
  }),
}));

vi.mock("../src/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
  }),
}));

describe("Widget Edit Mode & Fallback Architecture Suite", () => {
  const homeWidgetRendererPath = path.resolve(
    __dirname,
    "../src/components/home/HomeWidgetRenderer.tsx",
  );
  const homePagePath = path.resolve(__dirname, "../src/pages/HomePage.tsx");
  const categoryBudgetDeckPath = path.resolve(
    __dirname,
    "../src/components/home/CategoryBudgetDeck.tsx",
  );
  const debtReceivablesCardPath = path.resolve(
    __dirname,
    "../src/components/debt/DebtReceivablesCard.tsx",
  );
  const widgetCardWrapperPath = path.resolve(
    __dirname,
    "../src/components/common/WidgetCardWrapper.tsx",
  );
  const widgetFallbackCardPath = path.resolve(
    __dirname,
    "../src/components/home/widgets/WidgetFallbackCard.tsx",
  );

  it("WidgetFallbackCard exists and provides full and half size luxury layouts", () => {
    expect(fs.existsSync(widgetFallbackCardPath)).toBe(true);

    // Full-size test
    const fullElement = WidgetFallbackCard({
      cardId: "financial_goals",
      size: "full",
      isEditMode: true,
      isIndonesian: true,
      isDark: true,
    });
    expect(fullElement).toBeDefined();
    expect(fullElement.props.className).toContain("min-h-[140px]");

    // Half-size test
    const halfElement = WidgetFallbackCard({
      cardId: "upcoming_bills",
      size: "half",
      isEditMode: true,
      isIndonesian: true,
      isDark: true,
    });
    expect(halfElement).toBeDefined();
  });

  it("HomeWidgetRenderer returns WidgetFallbackCard during isEditMode when data is empty", () => {
    const defaultProps: any = {
      size: "full",
      isEditMode: true,
      intel: {},
      hideBalance: false,
      isDark: true,
      isIndonesian: true,
      allTxs: [],
      monthTxs: [],
      categories: [],
      goals: [],
      goalMilestonesMap: new Map(),
      upcomingBills: [],
      markBillPaid: { isPending: false },
      dailyAverage: 0,
      daysInMonth: 30,
      totalExpense: 0,
      liquidAssets: 0,
      currentMonthStats: { income: 0, expense: 0, topExpenseCategories: [] },
      categoryDonutData: [],
      last7DaysOutlays: [],
      heatmapDaysData: [],
      activeSpendDaysCount: 0,
      healthScore: 80,
      runwayMonths: 0,
      calendarExpanded: false,
      setCalendarExpanded: () => {},
      calPad: 0,
      calDays: [],
      compactDays: [],
      renderCalendarDay: () => null,
      onOpenMetricDrillDown: () => {},
      onOpenGoalDetail: () => {},
      onOpenBillManagement: () => {},
      onOpenPayBill: () => {},
      onOpenCategoryManagement: () => {},
      assetData: { netWorth: 0, delta: 0, isPositive: true, sparkline: [] },
      stockRange: "1M",
      onRangeChange: () => {},
      stockRangeLabels: {},
      onToggleHideBalance: () => {},
      navigate: () => {},
    };

    // When isEditMode is true and data is empty: renders WidgetFallbackCard
    const goalsEditMode = HomeWidgetRenderer({
      ...defaultProps,
      cardId: "financial_goals",
      isEditMode: true,
    });
    expect(goalsEditMode).not.toBeNull();
    expect(goalsEditMode?.type).toBe(WidgetFallbackCard);

    const billsEditMode = HomeWidgetRenderer({
      ...defaultProps,
      cardId: "upcoming_bills",
      isEditMode: true,
    });
    expect(billsEditMode).not.toBeNull();
    expect(billsEditMode?.type).toBe(WidgetFallbackCard);

    const recentTxEditMode = HomeWidgetRenderer({
      ...defaultProps,
      cardId: "recent_transactions",
      isEditMode: true,
    });
    expect(recentTxEditMode).not.toBeNull();
    expect(recentTxEditMode?.type).toBe(WidgetFallbackCard);

    const topCategoriesEditMode = HomeWidgetRenderer({
      ...defaultProps,
      cardId: "top_categories",
      isEditMode: true,
    });
    expect(topCategoriesEditMode).not.toBeNull();
    expect(topCategoriesEditMode?.type).toBe(WidgetFallbackCard);
  });

  it("HomeWidgetRenderer returns null in normal mode (!isEditMode) when data is empty", () => {
    const defaultProps: any = {
      size: "full",
      isEditMode: false,
      intel: {},
      hideBalance: false,
      isDark: true,
      isIndonesian: true,
      allTxs: [],
      monthTxs: [],
      categories: [],
      goals: [],
      goalMilestonesMap: new Map(),
      upcomingBills: [],
      markBillPaid: { isPending: false },
      dailyAverage: 0,
      daysInMonth: 30,
      totalExpense: 0,
      liquidAssets: 0,
      currentMonthStats: { income: 0, expense: 0, topExpenseCategories: [] },
      categoryDonutData: [],
      last7DaysOutlays: [],
      heatmapDaysData: [],
      activeSpendDaysCount: 0,
      healthScore: 80,
      runwayMonths: 0,
      calendarExpanded: false,
      setCalendarExpanded: () => {},
      calPad: 0,
      calDays: [],
      compactDays: [],
      renderCalendarDay: () => null,
      onOpenMetricDrillDown: () => {},
      onOpenGoalDetail: () => {},
      onOpenBillManagement: () => {},
      onOpenPayBill: () => {},
      onOpenCategoryManagement: () => {},
      assetData: { netWorth: 0, delta: 0, isPositive: true, sparkline: [] },
      stockRange: "1M",
      onRangeChange: () => {},
      stockRangeLabels: {},
      onToggleHideBalance: () => {},
      navigate: () => {},
    };

    expect(
      HomeWidgetRenderer({
        ...defaultProps,
        cardId: "financial_goals",
        isEditMode: false,
      }),
    ).toBeNull();

    expect(
      HomeWidgetRenderer({
        ...defaultProps,
        cardId: "upcoming_bills",
        isEditMode: false,
      }),
    ).toBeNull();

    expect(
      HomeWidgetRenderer({
        ...defaultProps,
        cardId: "recent_transactions",
        isEditMode: false,
      }),
    ).toBeNull();

    expect(
      HomeWidgetRenderer({
        ...defaultProps,
        cardId: "top_categories",
        isEditMode: false,
      }),
    ).toBeNull();
  });

  it("HomePage filters out empty widgets in normal mode before passing to ReorderableWidgetGrid", () => {
    const homePageContent = fs.readFileSync(homePagePath, "utf-8");
    expect(homePageContent).toContain("if (!isEditMode) {");
    expect(homePageContent).toContain('cardId === "spending_stability"');
    expect(homePageContent).toContain('cardId === "financial_goals"');
    expect(homePageContent).toContain('cardId === "upcoming_bills"');
    expect(homePageContent).toContain('cardId === "recent_transactions"');
    expect(homePageContent).toContain('cardId === "top_categories"');
    expect(homePageContent).toContain("isEditMode={isEditMode}");
  });

  it("CategoryBudgetDeck hides header action controls in edit mode to prevent badge collisions", () => {
    const deckContent = fs.readFileSync(categoryBudgetDeckPath, "utf-8");
    expect(deckContent).toContain("isEditMode?: boolean;");
    expect(deckContent).toContain("!isEditMode && (");
    expect(deckContent).toContain("onOpenManageCategories");
  });

  it("DebtReceivablesCard hides header action button in edit mode to prevent badge collisions", () => {
    const debtContent = fs.readFileSync(debtReceivablesCardPath, "utf-8");
    expect(debtContent).toContain("isEditMode?: boolean;");
    expect(debtContent).toContain("!isEditMode && (");
    expect(debtContent).toContain("Kelola");
  });

  it("WidgetCardWrapper enforces min-h-[140px] in edit mode to prevent flat horizontal 0px lines", () => {
    const wrapperContent = fs.readFileSync(widgetCardWrapperPath, "utf-8");
    expect(wrapperContent).toContain('isEditMode ? "min-h-[140px]" : ""');
    expect(wrapperContent).toContain("effectiveSize?: WidgetSize;");
  });

  it("Capital Health widget is registered with pure Indonesian & English labels and ShieldCheck vector icon", () => {
    const fallbackElement = WidgetFallbackCard({
      cardId: "financial_health_gauge",
      size: "half",
      isEditMode: true,
      isIndonesian: true,
      isDark: true,
    });
    expect(fallbackElement).toBeDefined();

    const widgetLayoutContent = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/widgetLayoutTypes.ts"),
      "utf-8"
    );
    expect(widgetLayoutContent).toContain('title: "Capital Health"');
    expect(widgetLayoutContent).toContain('title: "Kesehatan Modal"');
    expect(widgetLayoutContent).not.toContain("Executive Health Meter");
    expect(widgetLayoutContent).not.toContain("Meter Kesehatan Eksekutif");
  });

  it("CompactAIInsightsHalf uses line-clamp-2 to prevent 3-line text wrapping and layout collisions", () => {
    const compactCardsContent = fs.readFileSync(
      path.resolve(__dirname, "../src/components/home/widgets/CompactHalfCards.tsx"),
      "utf-8"
    );
    expect(compactCardsContent).toContain("line-clamp-2");
    expect(compactCardsContent).not.toContain("line-clamp-3");
  });

  it("HomeWidgetRenderer does not render ugly locked cards on Home dashboard", () => {
    const rendererContent = fs.readFileSync(homeWidgetRendererPath, "utf-8");
    expect(rendererContent).not.toContain("Buka dengan Accrual Pro");
    expect(rendererContent).not.toContain("This executive telemetry card is exclusively available for Accrual Pro members");
  });
});
