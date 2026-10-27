import { describe, it, expect } from "vitest";
import {
  loadStoredWidgets,
  reorderWidgets,
  cycleWidgetSize,
  setWidgetSize,
  toggleWidgetVisibility,
  filterVisibleWidgets,
  swapWidgetPosition,
  moveWidgetUp,
  moveWidgetDown,
  applyPresetToWidgets,
  detectMatchingHomePreset,
} from "../src/lib/widgetLayoutEngine";
import {
  DEFAULT_HOME_WIDGETS,
  DEFAULT_STATISTICS_WIDGETS,
  CardWidgetConfig,
} from "../src/lib/widgetLayoutTypes";

describe("Widget Layout Engine", () => {
  it("loads default widgets when storage JSON is null or empty", () => {
    const loaded = loadStoredWidgets(null);
    expect(loaded.length).toBe(DEFAULT_HOME_WIDGETS.length);
    expect(loaded[0].id).toBe(DEFAULT_HOME_WIDGETS[0].id);
  });

  it("merges stored layout and preserves new default widgets", () => {
    const custom = JSON.stringify([
      { id: "net_portfolio", size: "full", order: 2, isVisible: true },
      { id: "spending_stability", size: "half", order: 0, isVisible: false },
    ]);
    const loaded = loadStoredWidgets(custom);
    expect(loaded.length).toBe(DEFAULT_HOME_WIDGETS.length);
    
    const spending = loaded.find((w) => w.id === "spending_stability");
    expect(spending?.size).toBe("half");
    expect(spending?.isVisible).toBe(false);
  });

  it("cycles widget size between supported sizes correctly", () => {
    const widgets: CardWidgetConfig[] = [
      {
        id: "spending_stability",
        title: "Stability",
        subtitle: "Variance",
        page: "home",
        category: "telemetry",
        size: "full",
        supportedSizes: ["full", "half"],
        order: 0,
        isVisible: true,
      },
    ];

    const cycled = cycleWidgetSize(widgets, "spending_stability");
    expect(cycled[0].size).toBe("half");

    const cycledBack = cycleWidgetSize(cycled, "spending_stability");
    expect(cycledBack[0].size).toBe("full");
  });

  it("does not change size if card only supports full size", () => {
    const widgets: CardWidgetConfig[] = [
      {
        id: "net_portfolio",
        title: "Net Portfolio",
        subtitle: "Wealth",
        page: "home",
        category: "portfolio",
        size: "full",
        supportedSizes: ["full"],
        order: 0,
        isVisible: true,
      },
    ];

    const cycled = cycleWidgetSize(widgets, "net_portfolio");
    expect(cycled[0].size).toBe("full");
  });

  it("sets widget size explicitly when supported", () => {
    const widgets = [...DEFAULT_HOME_WIDGETS];
    const updated = setWidgetSize(widgets, "spending_stability", "half");
    expect(updated.find((w) => w.id === "spending_stability")?.size).toBe("half");
  });

  it("toggles widget visibility and filters visible list", () => {
    const widgets = [...DEFAULT_HOME_WIDGETS];
    const initialVisible = filterVisibleWidgets(widgets).length;
    const cardId = "activity_heatmap";
    
    const toggled = toggleWidgetVisibility(widgets, cardId);
    expect(toggled.find((w) => w.id === cardId)?.isVisible).toBe(false);

    const visible = filterVisibleWidgets(toggled);
    expect(visible.length).toBe(initialVisible - 1);
    expect(visible.some((w) => w.id === cardId)).toBe(false);
  });

  it("reorders widgets accurately based on id sequence", () => {
    const widgets = [...DEFAULT_HOME_WIDGETS];
    const newOrder = ["savings_ring", "upcoming_bills", "net_portfolio"];
    
    const reordered = reorderWidgets(widgets, newOrder);
    expect(reordered[0].id).toBe("savings_ring");
    expect(reordered[1].id).toBe("upcoming_bills");
    expect(reordered[2].id).toBe("net_portfolio");
  });

  it("swaps horizontal position between adjacent half widgets correctly", () => {
    const widgets: CardWidgetConfig[] = [
      {
        id: "hero",
        title: "Hero",
        subtitle: "",
        page: "home",
        category: "telemetry",
        size: "full",
        supportedSizes: ["full"],
        order: 0,
        isVisible: true,
      },
      {
        id: "half_a",
        title: "Half A",
        subtitle: "",
        page: "home",
        category: "telemetry",
        size: "half",
        supportedSizes: ["half", "full"],
        order: 1,
        isVisible: true,
      },
      {
        id: "half_b",
        title: "Half B",
        subtitle: "",
        page: "home",
        category: "telemetry",
        size: "half",
        supportedSizes: ["half", "full"],
        order: 2,
        isVisible: true,
      },
    ];

    // Swapping half_a (which is in left column, col 0) with direction "right"
    const swappedRight = swapWidgetPosition(widgets, "half_a", "right");
    const visible = filterVisibleWidgets(swappedRight);
    expect(visible[1].id).toBe("half_b");
    expect(visible[2].id).toBe("half_a");

    // Toggle swap on half_b when it is in left column (col 0)
    const toggled = swapWidgetPosition(swappedRight, "half_b", "toggle");
    const visibleToggled = filterVisibleWidgets(toggled);
    expect(visibleToggled[1].id).toBe("half_a");
    expect(visibleToggled[2].id).toBe("half_b");
  });

  describe("Statistics Presets & Layout Engine", () => {
    it("loads default statistics widgets properly", () => {
      const loaded = loadStoredWidgets(null, DEFAULT_STATISTICS_WIDGETS);
      expect(loaded.length).toBe(DEFAULT_STATISTICS_WIDGETS.length);
      expect(loaded.map((w) => w.id)).toContain("health_score");
      expect(loaded.map((w) => w.id)).toContain("monte_carlo");
      expect(loaded.map((w) => w.id)).toContain("fire_planner");
    });

    it("applies 'executive' preset to statistics widgets correctly", () => {
      const updated = applyPresetToWidgets(DEFAULT_STATISTICS_WIDGETS, "executive");
      const visible = filterVisibleWidgets(updated);

      expect(visible.length).toBe(13);
      expect(visible.some((w) => w.id === "financial_report")).toBe(true);
      expect(visible.some((w) => w.id === "health_score")).toBe(true);
      expect(visible.some((w) => w.id === "monthly_review")).toBe(true);
      expect(visible.some((w) => w.id === "expense_structure")).toBe(true);
      expect(visible.some((w) => w.id === "spending_patterns")).toBe(true);
      expect(visible.some((w) => w.id === "cashflow_summary")).toBe(true);
      expect(visible.some((w) => w.id === "inflow_outflow_trend")).toBe(true);
      expect(visible.some((w) => w.id === "category_breakdown")).toBe(true);
      expect(visible.some((w) => w.id === "cashflow_velocity")).toBe(true);
      expect(visible.some((w) => w.id === "fire_planner")).toBe(true);
      expect(visible.some((w) => w.id === "monte_carlo")).toBe(true);
      expect(visible.some((w) => w.id === "what_if_simulator")).toBe(true);
      expect(visible.some((w) => w.id === "personal_financial_model")).toBe(true);
    });

    it("applies 'telemetry' preset with operational focus", () => {
      const updated = applyPresetToWidgets(DEFAULT_STATISTICS_WIDGETS, "telemetry");
      const visible = filterVisibleWidgets(updated);

      // Report & Intelligence active
      expect(visible.some((w) => w.id === "financial_report")).toBe(true);
      expect(visible.some((w) => w.id === "health_score")).toBe(true);
      expect(visible.some((w) => w.id === "monthly_review")).toBe(true);
      expect(visible.some((w) => w.id === "expense_structure")).toBe(true);
      expect(visible.some((w) => w.id === "spending_patterns")).toBe(true);

      // Operational cashflow all active
      expect(visible.some((w) => w.id === "cashflow_summary")).toBe(true);
      expect(visible.some((w) => w.id === "inflow_outflow_trend")).toBe(true);
      expect(visible.some((w) => w.id === "category_breakdown")).toBe(true);
      expect(visible.some((w) => w.id === "cashflow_velocity")).toBe(true);

      // Simulation: What-If stress test active, long-term models hidden
      expect(visible.some((w) => w.id === "what_if_simulator")).toBe(true);
      expect(visible.some((w) => w.id === "monte_carlo")).toBe(false);
      expect(visible.some((w) => w.id === "fire_planner")).toBe(false);
      expect(visible.some((w) => w.id === "personal_financial_model")).toBe(false);
    });

    it("applies 'planning' preset with wealth and retirement focus", () => {
      const updated = applyPresetToWidgets(DEFAULT_STATISTICS_WIDGETS, "planning");
      const visible = filterVisibleWidgets(updated);

      // Simulation models all active
      expect(visible.some((w) => w.id === "fire_planner")).toBe(true);
      expect(visible.some((w) => w.id === "monte_carlo")).toBe(true);
      expect(visible.some((w) => w.id === "personal_financial_model")).toBe(true);
      expect(visible.some((w) => w.id === "what_if_simulator")).toBe(true);

      // Baseline report and structure active
      expect(visible.some((w) => w.id === "financial_report")).toBe(true);
      expect(visible.some((w) => w.id === "health_score")).toBe(true);
      expect(visible.some((w) => w.id === "expense_structure")).toBe(true);
      expect(visible.some((w) => w.id === "cashflow_summary")).toBe(true);

      // Granular operational cashflow & pacing hidden
      expect(visible.some((w) => w.id === "monthly_review")).toBe(false);
      expect(visible.some((w) => w.id === "spending_patterns")).toBe(false);
      expect(visible.some((w) => w.id === "inflow_outflow_trend")).toBe(false);
      expect(visible.some((w) => w.id === "category_breakdown")).toBe(false);
      expect(visible.some((w) => w.id === "cashflow_velocity")).toBe(false);
    });

    it("applies 'essential' preset with minimal cards across all sections", () => {
      const updated = applyPresetToWidgets(DEFAULT_STATISTICS_WIDGETS, "essential");
      const visible = filterVisibleWidgets(updated);

      expect(visible.length).toBe(4);
      expect(visible.map((w) => w.id)).toEqual([
        "financial_report",
        "health_score",
        "cashflow_summary",
        "fire_planner",
      ]);
      // Verify every section has at least one card
      expect(visible.some((w) => ["financial_report"].includes(w.id))).toBe(true);
      expect(visible.some((w) => ["health_score", "monthly_review", "expense_structure", "spending_patterns"].includes(w.id))).toBe(true);
      expect(visible.some((w) => ["cashflow_summary", "inflow_outflow_trend", "category_breakdown", "cashflow_velocity"].includes(w.id))).toBe(true);
      expect(visible.some((w) => ["fire_planner", "monte_carlo", "what_if_simulator", "personal_financial_model"].includes(w.id))).toBe(true);
    });

    it("ensures every preset has at least one card in each of the 4 analytics sections", () => {
      const presets = ["executive", "telemetry", "planning", "essential"] as const;
      const reportCards = ["financial_report"];
      const intelligenceCards = ["health_score", "monthly_review", "expense_structure", "spending_patterns"];
      const cashflowCards = ["cashflow_summary", "inflow_outflow_trend", "category_breakdown", "cashflow_velocity"];
      const simulationCards = ["fire_planner", "monte_carlo", "what_if_simulator", "personal_financial_model"];

      for (const presetKey of presets) {
        const updated = applyPresetToWidgets(DEFAULT_STATISTICS_WIDGETS, presetKey);
        const visible = filterVisibleWidgets(updated);

        const hasReport = visible.some((w) => reportCards.includes(w.id));
        const hasIntel = visible.some((w) => intelligenceCards.includes(w.id));
        const hasCashflow = visible.some((w) => cashflowCards.includes(w.id));
        const hasSimulation = visible.some((w) => simulationCards.includes(w.id));

        expect(hasReport, `Preset ${presetKey} must have at least one report card`).toBe(true);
        expect(hasIntel, `Preset ${presetKey} must have at least one intelligence card`).toBe(true);
        expect(hasCashflow, `Preset ${presetKey} must have at least one cashflow card`).toBe(true);
        expect(hasSimulation, `Preset ${presetKey} must have at least one simulation card`).toBe(true);
      }
    });
  });

  describe("Home Presets & Layout Engine", () => {
    it("applies 'minimal' home preset and includes savings_ring and mini_heatmap as half cards", () => {
      const updated = applyPresetToWidgets(DEFAULT_HOME_WIDGETS, "minimal", "home");
      const visible = filterVisibleWidgets(updated);

      expect(visible.some((w) => w.id === "net_portfolio")).toBe(true);
      expect(visible.some((w) => w.id === "portfolio_account")).toBe(true);
      expect(visible.some((w) => w.id === "ai_insights")).toBe(true);
      expect(visible.some((w) => w.id === "activity_heatmap")).toBe(true);
      expect(visible.some((w) => w.id === "upcoming_bills")).toBe(true);
      expect(visible.some((w) => w.id === "category_budgets")).toBe(true);

      // Newly added half-cards in minimal preset positioned under portfolio_account (Liquidity Sources)
      const savingsRing = visible.find((w) => w.id === "savings_ring");
      expect(savingsRing).toBeDefined();
      expect(savingsRing?.size).toBe("half");

      const miniHeatmap = visible.find((w) => w.id === "mini_heatmap");
      expect(miniHeatmap).toBeDefined();
      expect(miniHeatmap?.size).toBe("half");

      // Verify sequence: net_portfolio -> portfolio_account -> savings_ring / mini_heatmap -> ai_insights -> activity_heatmap -> upcoming_bills -> category_budgets
      const visibleIds = visible.map((w) => w.id);
      const portAccountIdx = visibleIds.indexOf("portfolio_account");
      const savingsRingIdx = visibleIds.indexOf("savings_ring");
      const miniHeatmapIdx = visibleIds.indexOf("mini_heatmap");
      const aiInsightsIdx = visibleIds.indexOf("ai_insights");
      const activityHeatmapIdx = visibleIds.indexOf("activity_heatmap");
      const billsIdx = visibleIds.indexOf("upcoming_bills");
      const budgetsIdx = visibleIds.indexOf("category_budgets");

      expect(savingsRingIdx).toBe(portAccountIdx + 1);
      expect(miniHeatmapIdx).toBe(portAccountIdx + 2);
      expect(aiInsightsIdx).toBe(miniHeatmapIdx + 1);
      expect(activityHeatmapIdx).toBe(aiInsightsIdx + 1);
      expect(billsIdx).toBe(activityHeatmapIdx + 1);
      expect(budgetsIdx).toBe(billsIdx + 1);

      // Verify other widgets are hidden in minimal
      expect(visible.some((w) => w.id === "cashflow_pulse")).toBe(false);
      expect(visible.some((w) => w.id === "recent_transactions")).toBe(false);
      expect(visible.some((w) => w.id === "spending_stability")).toBe(false);
      expect(visible.some((w) => w.id === "financial_goals")).toBe(false);
    });

    it("detects matching home preset correctly", () => {
      const minimalWidgets = applyPresetToWidgets(DEFAULT_HOME_WIDGETS, "minimal", "home");
      expect(detectMatchingHomePreset(minimalWidgets)).toBe("minimal");

      const pulseWidgets = applyPresetToWidgets(DEFAULT_HOME_WIDGETS, "pulse", "home");
      expect(detectMatchingHomePreset(pulseWidgets)).toBe("pulse");

      const executiveWidgets = applyPresetToWidgets(DEFAULT_HOME_WIDGETS, "executive", "home");
      expect(detectMatchingHomePreset(executiveWidgets)).toBe("executive");
    });

    it("moves widget up and down sequentially with normalized order", () => {
      const widgets = [
        { ...DEFAULT_HOME_WIDGETS[0], id: "card_a", order: 0 },
        { ...DEFAULT_HOME_WIDGETS[1], id: "card_b", order: 1 },
        { ...DEFAULT_HOME_WIDGETS[2], id: "card_c", order: 2 },
      ];

      // Move card_b up
      const movedUp = moveWidgetUp(widgets, "card_b");
      expect(movedUp.map((w) => w.id)).toEqual(["card_b", "card_a", "card_c"]);
      expect(movedUp.map((w) => w.order)).toEqual([0, 1, 2]);

      // Move top card up (no-op boundary)
      const topBoundary = moveWidgetUp(movedUp, "card_b");
      expect(topBoundary.map((w) => w.id)).toEqual(["card_b", "card_a", "card_c"]);

      // Move card_a down
      const movedDown = moveWidgetDown(movedUp, "card_a");
      expect(movedDown.map((w) => w.id)).toEqual(["card_b", "card_c", "card_a"]);
      expect(movedDown.map((w) => w.order)).toEqual([0, 1, 2]);

      // Move bottom card down (no-op boundary)
      const bottomBoundary = moveWidgetDown(movedDown, "card_a");
      expect(bottomBoundary.map((w) => w.id)).toEqual(["card_b", "card_c", "card_a"]);
    });
  });
});
