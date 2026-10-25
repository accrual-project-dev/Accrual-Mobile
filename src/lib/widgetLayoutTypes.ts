// ======================================================================
// TROUVAILLE WIDGET & CARD CUSTOMIZATION ENGINE TYPES
// iOS-Style Springboard Widget Hierarchy & Sizing
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// ======================================================================

export type WidgetSize = "full" | "half" | "expanded";

export interface CardWidgetConfig {
  id: string;
  title: string;
  subtitle: string;
  page: "home" | "statistics";
  category: "portfolio" | "telemetry" | "ledger" | "planning" | "social";
  size: WidgetSize;
  supportedSizes: WidgetSize[];
  order: number;
  isVisible: boolean;
}

export const DEFAULT_HOME_WIDGETS: CardWidgetConfig[] = [
  {
    id: "net_portfolio",
    title: "Liquid Position",
    subtitle: "Total liquid capital & cash reserves",
    page: "home",
    category: "portfolio",
    size: "full",
    supportedSizes: ["full"],
    order: 0,
    isVisible: true,
  },
  {
    id: "portfolio_account",
    title: "Liquidity Sources",
    subtitle: "Bank accounts, cash & liquid reserves",
    page: "home",
    category: "portfolio",
    size: "full",
    supportedSizes: ["full"],
    order: 1,
    isVisible: true,
  },
  {
    id: "cashflow_pulse",
    title: "Cashflow Pulse & Budget",
    subtitle: "Monthly income, expenses & spending pacing",
    page: "home",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 2,
    isVisible: true,
  },
  {
    id: "spending_stability",
    title: "Spending Stability",
    subtitle: "Daily variance & consistency telemetry",
    page: "home",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 3,
    isVisible: true,
  },
  {
    id: "ai_insights",
    title: "Financial Insights",
    subtitle: "Smart diagnostics & anomalous alerts",
    page: "home",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 5,
    isVisible: true,
  },
  {
    id: "activity_heatmap",
    title: "Activity Heatmap",
    subtitle: "Daily transaction density & frequency",
    page: "home",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full"],
    order: 6,
    isVisible: true,
  },
  {
    id: "financial_goals",
    title: "Financial Goals",
    subtitle: "Savings targets & milestone achievement",
    page: "home",
    category: "planning",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 7,
    isVisible: true,
  },
  {
    id: "upcoming_bills",
    title: "Upcoming Bills",
    subtitle: "Subscriptions & recurring bill schedule",
    page: "home",
    category: "planning",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 8,
    isVisible: true,
  },
  {
    id: "debt_receivables",
    title: "Debt & Receivables",
    subtitle: "Loans, receivables & due date tracking",
    page: "home",
    category: "ledger",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 9,
    isVisible: true,
  },
  {
    id: "category_budgets",
    title: "Category Budgets",
    subtitle: "Monthly category envelopes & spending limits",
    page: "home",
    category: "planning",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 9,
    isVisible: true,
  },
  {
    id: "recent_transactions",
    title: "Recent Transactions",
    subtitle: "Quick transaction feed of latest activity",
    page: "home",
    category: "ledger",
    size: "full",
    supportedSizes: ["full"],
    order: 10,
    isVisible: true,
  },
  {
    id: "top_categories",
    title: "Top Spending Categories",
    subtitle: "Monthly breakdown of largest drivers",
    page: "home",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 11,
    isVisible: true,
  },
  {
    id: "savings_rate_velocity",
    title: "Savings Rate & Velocity",
    subtitle: "Net capital retention & daily runway",
    page: "home",
    category: "planning",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 12,
    isVisible: true,
  },
  {
    id: "savings_ring",
    title: "Savings Rate Ring",
    subtitle: "Circular capital retention progress",
    page: "home",
    category: "planning",
    size: "half",
    supportedSizes: ["full", "half"],
    order: 14,
    isVisible: true,
  },
  {
    id: "spending_velocity_bar",
    title: "7-Day Velocity Bar",
    subtitle: "Daily outflow pace vs safe allowance",
    page: "home",
    category: "telemetry",
    size: "half",
    supportedSizes: ["full", "half"],
    order: 15,
    isVisible: true,
  },
  {
    id: "category_donut",
    title: "Category Donut Chart",
    subtitle: "Top expense allocation distribution",
    page: "home",
    category: "telemetry",
    size: "half",
    supportedSizes: ["full", "half"],
    order: 16,
    isVisible: true,
  },
  {
    id: "mini_heatmap",
    title: "Activity Dot Heatmap",
    subtitle: "28-day transaction density matrix",
    page: "home",
    category: "telemetry",
    size: "half",
    supportedSizes: ["full", "half"],
    order: 17,
    isVisible: true,
  },
  {
    id: "financial_health_gauge",
    title: "Capital Health",
    subtitle: "Capital health score & liquidity grade",
    page: "home",
    category: "telemetry",
    size: "half",
    supportedSizes: ["full", "half"],
    order: 18,
    isVisible: true,
  },
  {
    id: "calendar_activity",
    title: "Calendar Activity",
    subtitle: "Daily transaction schedule & monthly entries",
    page: "home",
    category: "planning",
    size: "full",
    supportedSizes: ["full", "half"],
    order: 19,
    isVisible: true,
  },
  {
    id: "liquid_runway",
    title: "Cashflow Runway",
    subtitle: "Survival buffer & emergency reserve runway",
    page: "home",
    category: "planning",
    size: "half",
    supportedSizes: ["full", "half"],
    order: 19,
    isVisible: true,
  },
  {
    id: "investment_pulse",
    title: "Investment Pulse",
    subtitle: "Investment portfolio valuation teaser",
    page: "home",
    category: "portfolio",
    size: "full",
    supportedSizes: ["full"],
    order: 20,
    isVisible: false,
  },
  {
    id: "safe_to_spend",
    title: "Safe to Spend",
    subtitle: "Pacing allowance, daily budget & remaining days",
    page: "home",
    category: "planning",
    size: "half",
    supportedSizes: ["full", "half"],
    order: 21,
    isVisible: true,
  },
];

export const WIDGET_LOCALIZED_META: Record<
  string,
  { en: { title: string; subtitle: string }; id: { title: string; subtitle: string } }
> = {
  net_portfolio: {
    en: { title: "Liquid Position", subtitle: "Total liquid capital & cash reserves" },
    id: { title: "Posisi Kas Likuid", subtitle: "Total modal likuid & cadangan kas" },
  },
  portfolio_account: {
    en: { title: "Liquidity Sources", subtitle: "Bank accounts, cash & liquid reserves" },
    id: { title: "Sumber Likuiditas", subtitle: "Rekening bank, tunai & dana likuid" },
  },
  cashflow_pulse: {
    en: { title: "Cashflow Pulse & Budget", subtitle: "Monthly income, expenses & spending pacing" },
    id: { title: "Arus Kas & Anggaran", subtitle: "Pemasukan, pengeluaran & laju anggaran bulanan" },
  },
  spending_stability: {
    en: { title: "Spending Stability", subtitle: "Daily variance & consistency telemetry" },
    id: { title: "Stabilitas Pengeluaran", subtitle: "Variansi harian & telemetri konsistensi" },
  },
  ai_insights: {
    en: { title: "Financial Insights", subtitle: "Smart diagnostics & anomalous alerts" },
    id: { title: "Wawasan Finansial", subtitle: "Diagnostik pintar & peringatan anomali" },
  },
  activity_heatmap: {
    en: { title: "Activity Heatmap", subtitle: "Daily transaction density & frequency" },
    id: { title: "Peta Aktivitas Transaksi", subtitle: "Kerapatan & frekuensi transaksi harian" },
  },
  financial_goals: {
    en: { title: "Financial Goals", subtitle: "Savings targets & milestone achievement" },
    id: { title: "Target Finansial", subtitle: "Target tabungan & pencapaian milestone" },
  },
  upcoming_bills: {
    en: { title: "Upcoming Bills", subtitle: "Subscriptions & recurring bill schedule" },
    id: { title: "Tagihan Mendatang", subtitle: "Langganan & jadwal tagihan berulang" },
  },
  debt_receivables: {
    en: { title: "Debt & Receivables", subtitle: "Loans, receivables & due date tracking" },
    id: { title: "Buku Utang & Piutang", subtitle: "Pelacakan pinjaman, pelunasan & jatuh tempo" },
  },
  category_budgets: {
    en: { title: "Category Budgets", subtitle: "Monthly category envelopes & spending limits" },
    id: { title: "Anggaran Kategori", subtitle: "Amplop kategori bulanan & batas pengeluaran" },
  },
  recent_transactions: {
    en: { title: "Recent Transactions", subtitle: "Quick transaction feed of latest activity" },
    id: { title: "Transaksi Terkini", subtitle: "Pencatatan langsung aktivitas terbaru" },
  },
  top_categories: {
    en: { title: "Top Spending Categories", subtitle: "Monthly breakdown of largest drivers" },
    id: { title: "Kategori Pengeluaran Terbesar", subtitle: "Rincian pendorong pengeluaran terbesar" },
  },
  savings_rate_velocity: {
    en: { title: "Savings Rate & Velocity", subtitle: "Net capital retention & daily runway" },
    id: { title: "Rasio & Laju Tabungan", subtitle: "Retensi modal bersih & runway harian" },
  },
  savings_ring: {
    en: { title: "Savings Rate Ring", subtitle: "Circular capital retention progress" },
    id: { title: "Ring Rasio Tabungan", subtitle: "Kemajuan retensi modal sirkular" },
  },
  spending_velocity_bar: {
    en: { title: "7-Day Velocity Bar", subtitle: "Daily outflow pace vs safe allowance" },
    id: { title: "Batang Laju 7-Hari", subtitle: "Laju pengeluaran harian vs batas aman" },
  },
  category_donut: {
    en: { title: "Category Donut Chart", subtitle: "Top expense allocation distribution" },
    id: { title: "Grafik Donat Kategori", subtitle: "Distribusi alokasi pengeluaran teratas" },
  },
  mini_heatmap: {
    en: { title: "Activity Dot Heatmap", subtitle: "28-day transaction density matrix" },
    id: { title: "Matriks Aktivitas Titik", subtitle: "Matriks kerapatan transaksi 28 hari" },
  },
  financial_health_gauge: {
    en: { title: "Capital Health", subtitle: "Capital health score & liquidity grade" },
    id: { title: "Kesehatan Modal", subtitle: "Skor kesehatan modal & peringkat likuiditas" },
  },
  calendar_activity: {
    en: { title: "Calendar Activity", subtitle: "Daily transaction schedule & monthly entries" },
    id: { title: "Aktivitas Kalender", subtitle: "Jadwal transaksi harian & entri bulanan" },
  },
  liquid_runway: {
    en: { title: "Cashflow Runway", subtitle: "Survival buffer & emergency reserve runway" },
    id: { title: "Ketahanan Arus Kas", subtitle: "Bantalan bertahan & runway cadangan darurat" },
  },
  investment_pulse: {
    en: { title: "Investment Pulse", subtitle: "Investment portfolio valuation teaser" },
    id: { title: "Denyut Investasi", subtitle: "Pratinjau valuasi portofolio investasi" },
  },
  financial_report: {
    en: { title: "Financial Report", subtitle: "Balance Sheet, Cash Flows & Disclosures" },
    id: { title: "Laporan Finansial", subtitle: "Neraca Keuangan, Arus Kas & Pengungkapan" },
  },
  health_score: {
    en: { title: "Financial Health Diagnostic Index", subtitle: "Composite health score, diagnostic pillars & performance rating" },
    id: { title: "Indeks Diagnostik Kesehatan Finansial", subtitle: "Skor kesehatan komposit, pilar diagnostik & rating kinerja" },
  },
  monthly_review: {
    en: { title: "Monthly Financial Review", subtitle: "Period performance review & significant category shifts" },
    id: { title: "Tinjauan Finansial Bulanan", subtitle: "Evaluasi performa periode & pergeseran kategori signifikan" },
  },
  expense_structure: {
    en: { title: "Expense Structure Analysis", subtitle: "Essential baseline vs discretionary monthly commitments" },
    id: { title: "Analisis Struktur Pengeluaran", subtitle: "Beban pokok kebutuhan vs komitmen diskresioner bulanan" },
  },
  spending_patterns: {
    en: { title: "Spending Patterns & Cycles", subtitle: "Temporal spending cadence & weekday vs weekend pacing" },
    id: { title: "Pola & Siklus Pengeluaran", subtitle: "Irama pengeluaran temporal & laju hari kerja vs akhir pekan" },
  },
  cashflow_summary: {
    en: { title: "Period Cashflow Summary", subtitle: "Net cash retention, total turnover & operational runway" },
    id: { title: "Ringkasan Arus Kas Periode", subtitle: "Retensi kas bersih, perputaran total & runway operasional" },
  },
  sankey_distribution: {
    en: { title: "Cashflow Distribution Flow", subtitle: "Visual node mapping of inflows to expenses & savings" },
    id: { title: "Diagram Aliran Arus Kas", subtitle: "Visualisasi pemetaan arus masuk ke pengeluaran & tabungan" },
  },
  whatif_simulator: {
    en: { title: "What-If Scenario Simulator", subtitle: "Stress-test income changes and expense reduction scenarios" },
    id: { title: "Simulasi Skenario Finansial", subtitle: "Uji stres skenario perubahan pendapatan dan efisiensi pengeluaran" },
  },
  fire_planner: {
    en: { title: "F.I.R.E. Retirement Planner", subtitle: "Calculate your Financial Independence number & timeline" },
    id: { title: "Proyeksi Kemandirian Finansial", subtitle: "Kalkulasi angka F.I.R.E. & estimasi garis waktu pensiun dini" },
  },
  category_spending: {
    en: { title: "Category Spending Breakdown", subtitle: "Sector distribution & expense intensity per category" },
    id: { title: "Rincian Kategori Pengeluaran", subtitle: "Distribusi sektoral & intensitas alokasi dana per kategori" },
  },
  personal_baselines: {
    en: { title: "Personal Baseline Spending", subtitle: "Minimum survival benchmark & expense tolerance boundaries" },
    id: { title: "Batas Dasar Beban Pribadi", subtitle: "Benchmark pengeluaran minimum & batas toleransi beban" },
  },
  safe_to_spend: {
    en: { title: "Safe to Spend", subtitle: "Pacing allowance, daily budget & remaining days" },
    id: { title: "Aman Belanja", subtitle: "Laju aman belanja, anggaran harian & sisa hari" },
  },
};

export function getLocalizedWidgetMeta(
  widgetId: string,
  isIndonesian: boolean,
  fallbackTitle = "",
  fallbackSubtitle = "",
): { title: string; subtitle: string } {
  const meta = WIDGET_LOCALIZED_META[widgetId];
  if (!meta) {
    return { title: fallbackTitle, subtitle: fallbackSubtitle };
  }
  const langKey = isIndonesian ? "id" : "en";
  return {
    title: meta[langKey]?.title || meta.en.title || fallbackTitle,
    subtitle: meta[langKey]?.subtitle || meta.en.subtitle || fallbackSubtitle,
  };
}

export type HomePresetKey =
  | "minimal"
  | "pulse"
  | "horizon"
  | "executive"
  | "simple"
  | "balanced"
  | "advanced";

export interface HomePresetDefinition {
  key: HomePresetKey;
  label: string;
  description: string;
  cardConfigs: { id: string; size: WidgetSize; isVisible: boolean; order: number }[];
}

export const HOME_PRESETS: HomePresetDefinition[] = [
  {
    key: "minimal",
    label: "Minimal",
    description: "Pure distraction-free: liquid position, accounts, savings ring, dots, insights, heatmap, bills & budgets",
    cardConfigs: [
      { id: "net_portfolio", size: "full", isVisible: true, order: 0 },
      { id: "portfolio_account", size: "full", isVisible: true, order: 1 },
      { id: "savings_ring", size: "half", isVisible: true, order: 2 },
      { id: "mini_heatmap", size: "half", isVisible: true, order: 3 },
      { id: "ai_insights", size: "full", isVisible: true, order: 4 },
      { id: "activity_heatmap", size: "full", isVisible: true, order: 5 },
      { id: "upcoming_bills", size: "full", isVisible: true, order: 6 },
      { id: "category_budgets", size: "full", isVisible: true, order: 7 },
      { id: "cashflow_pulse", size: "full", isVisible: false, order: 8 },
      { id: "recent_transactions", size: "full", isVisible: false, order: 9 },
      { id: "spending_velocity_bar", size: "half", isVisible: false, order: 10 },
      { id: "category_donut", size: "half", isVisible: false, order: 11 },
      { id: "financial_health_gauge", size: "half", isVisible: false, order: 12 },
      { id: "liquid_runway", size: "half", isVisible: false, order: 13 },
      { id: "spending_stability", size: "full", isVisible: false, order: 14 },
      { id: "financial_goals", size: "full", isVisible: false, order: 15 },
      { id: "top_categories", size: "full", isVisible: false, order: 16 },
      { id: "calendar_activity", size: "full", isVisible: false, order: 17 },
      { id: "savings_rate_velocity", size: "full", isVisible: false, order: 18 },
      { id: "investment_pulse", size: "full", isVisible: false, order: 19 },
    ],
  },
  {
    key: "pulse",
    label: "Balanced",
    description: "Daily operational rhythm: liquid position, accounts, runway, health score, insights, cashflow, heatmap, bills & budgets",
    cardConfigs: [
      { id: "net_portfolio", size: "full", isVisible: true, order: 0 },
      { id: "portfolio_account", size: "full", isVisible: true, order: 1 },
      { id: "liquid_runway", size: "half", isVisible: true, order: 2 },
      { id: "financial_health_gauge", size: "half", isVisible: true, order: 3 },
      { id: "ai_insights", size: "full", isVisible: true, order: 4 },
      { id: "cashflow_pulse", size: "full", isVisible: true, order: 5 },
      { id: "activity_heatmap", size: "full", isVisible: true, order: 6 },
      { id: "upcoming_bills", size: "full", isVisible: true, order: 7 },
      { id: "category_budgets", size: "full", isVisible: true, order: 8 },
      { id: "savings_ring", size: "half", isVisible: false, order: 9 },
      { id: "mini_heatmap", size: "half", isVisible: false, order: 10 },
      { id: "spending_velocity_bar", size: "half", isVisible: false, order: 11 },
      { id: "category_donut", size: "half", isVisible: false, order: 12 },
      { id: "recent_transactions", size: "full", isVisible: false, order: 13 },
      { id: "spending_stability", size: "full", isVisible: false, order: 14 },
      { id: "financial_goals", size: "full", isVisible: false, order: 15 },
      { id: "top_categories", size: "full", isVisible: false, order: 16 },
      { id: "calendar_activity", size: "full", isVisible: false, order: 17 },
      { id: "savings_rate_velocity", size: "full", isVisible: false, order: 18 },
      { id: "investment_pulse", size: "full", isVisible: false, order: 19 },
    ],
  },
  {
    key: "horizon",
    label: "Horizon",
    description: "Narrative horizon: alternating rhythm of liquid capital, emergency runway, velocity, goals & budget envelopes",
    cardConfigs: [
      { id: "net_portfolio", size: "full", isVisible: true, order: 0 },
      { id: "liquid_runway", size: "half", isVisible: true, order: 1 },
      { id: "financial_health_gauge", size: "half", isVisible: true, order: 2 },
      { id: "portfolio_account", size: "full", isVisible: true, order: 3 },
      { id: "savings_ring", size: "half", isVisible: true, order: 4 },
      { id: "spending_velocity_bar", size: "half", isVisible: true, order: 5 },
      { id: "cashflow_pulse", size: "full", isVisible: true, order: 6 },
      { id: "category_donut", size: "half", isVisible: true, order: 7 },
      { id: "mini_heatmap", size: "half", isVisible: true, order: 8 },
      { id: "financial_goals", size: "full", isVisible: true, order: 9 },
      { id: "upcoming_bills", size: "half", isVisible: true, order: 10 },
      { id: "top_categories", size: "half", isVisible: true, order: 11 },
      { id: "category_budgets", size: "full", isVisible: true, order: 12 },
      { id: "ai_insights", size: "full", isVisible: false, order: 13 },
      { id: "spending_stability", size: "full", isVisible: false, order: 14 },
      { id: "recent_transactions", size: "full", isVisible: false, order: 15 },
      { id: "activity_heatmap", size: "full", isVisible: false, order: 16 },
      { id: "calendar_activity", size: "full", isVisible: false, order: 17 },
      { id: "savings_rate_velocity", size: "full", isVisible: false, order: 18 },
      { id: "investment_pulse", size: "full", isVisible: false, order: 19 },
    ],
  },
  {
    key: "executive",
    label: "Executive",
    description: "Executive command center: balanced alternating sequence of full telemetry and paired visual micro-widgets",
    cardConfigs: [
      { id: "net_portfolio", size: "full", isVisible: true, order: 0 },
      { id: "savings_ring", size: "half", isVisible: true, order: 1 },
      { id: "financial_health_gauge", size: "half", isVisible: true, order: 2 },
      { id: "portfolio_account", size: "full", isVisible: true, order: 3 },
      { id: "liquid_runway", size: "half", isVisible: true, order: 4 },
      { id: "spending_velocity_bar", size: "half", isVisible: true, order: 5 },
      { id: "cashflow_pulse", size: "full", isVisible: true, order: 6 },
      { id: "category_donut", size: "half", isVisible: true, order: 7 },
      { id: "mini_heatmap", size: "half", isVisible: true, order: 8 },
      { id: "ai_insights", size: "full", isVisible: true, order: 9 },
      { id: "top_categories", size: "half", isVisible: true, order: 10 },
      { id: "financial_goals", size: "full", isVisible: true, order: 11 },
      { id: "upcoming_bills", size: "half", isVisible: true, order: 12 },
      { id: "savings_rate_velocity", size: "half", isVisible: true, order: 13 },
      { id: "category_budgets", size: "full", isVisible: true, order: 14 },
      { id: "spending_stability", size: "full", isVisible: false, order: 15 },
      { id: "recent_transactions", size: "full", isVisible: false, order: 16 },
      { id: "activity_heatmap", size: "full", isVisible: false, order: 17 },
      { id: "calendar_activity", size: "full", isVisible: false, order: 18 },
      { id: "investment_pulse", size: "full", isVisible: false, order: 19 },
    ],
  },
];

export const DEFAULT_STATISTICS_WIDGETS: CardWidgetConfig[] = [
  // --- SECTION 1: REPORT ---
  {
    id: "financial_report",
    title: "Financial Report",
    subtitle: "Balance Sheet, Cash Flows & Disclosures",
    page: "statistics",
    category: "ledger",
    size: "full",
    supportedSizes: ["full"],
    order: 0,
    isVisible: true,
  },

  // --- SECTION 2: INTELLIGENCE ---
  {
    id: "health_score",
    title: "Financial Health Diagnostic Index",
    subtitle: "Composite health score, diagnostic pillars & performance rating",
    page: "statistics",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full"],
    order: 1,
    isVisible: true,
  },
  {
    id: "monthly_review",
    title: "Monthly Financial Review",
    subtitle: "Period performance review & significant category shifts",
    page: "statistics",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full"],
    order: 2,
    isVisible: true,
  },
  {
    id: "expense_structure",
    title: "Expense Structure Analysis",
    subtitle: "Essential baseline vs discretionary monthly commitments",
    page: "statistics",
    category: "planning",
    size: "full",
    supportedSizes: ["full"],
    order: 3,
    isVisible: true,
  },
  {
    id: "spending_patterns",
    title: "Spending Patterns & Cycles",
    subtitle: "Temporal spending cadence & weekday vs weekend pacing",
    page: "statistics",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full"],
    order: 4,
    isVisible: true,
  },

  // --- SECTION 3: CASHFLOW ---
  {
    id: "cashflow_summary",
    title: "Period Cashflow Summary",
    subtitle: "Net cash retention, total turnover & operational runway",
    page: "statistics",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full"],
    order: 5,
    isVisible: true,
  },
  {
    id: "inflow_outflow_trend",
    title: "Inflow vs Outflow Trend",
    subtitle: "Multi-period historical cash movement comparison",
    page: "statistics",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full"],
    order: 6,
    isVisible: true,
  },
  {
    id: "category_breakdown",
    title: "Category Expense Breakdown",
    subtitle: "Hierarchical category distribution and share of wallet",
    page: "statistics",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full"],
    order: 7,
    isVisible: true,
  },
  {
    id: "cashflow_velocity",
    title: "Cashflow Velocity & Pacing",
    subtitle: "Daily burn rate & moving average expenditure curve",
    page: "statistics",
    category: "telemetry",
    size: "full",
    supportedSizes: ["full"],
    order: 8,
    isVisible: true,
  },

  // --- SECTION 4: SIMULATION ---
  {
    id: "fire_planner",
    title: "FIRE Independence Planner",
    subtitle: "Retirement velocity & target capital runway",
    page: "statistics",
    category: "planning",
    size: "full",
    supportedSizes: ["full"],
    order: 9,
    isVisible: true,
  },
  {
    id: "monte_carlo",
    title: "Monte Carlo Wealth Projection",
    subtitle: "Stochastic probability dispersion across market conditions",
    page: "statistics",
    category: "planning",
    size: "full",
    supportedSizes: ["full"],
    order: 10,
    isVisible: true,
  },
  {
    id: "what_if_simulator",
    title: "What-If Simulator",
    subtitle: "Interactive shock scenarios & liquidity stress test",
    page: "statistics",
    category: "planning",
    size: "full",
    supportedSizes: ["full"],
    order: 11,
    isVisible: true,
  },
  {
    id: "personal_financial_model",
    title: "Personal Financial Model",
    subtitle: "Baseline trajectory, structural runway & liquidity horizon",
    page: "statistics",
    category: "planning",
    size: "full",
    supportedSizes: ["full"],
    order: 12,
    isVisible: true,
  },
];

export type StatisticsPresetKey =
  | "executive"
  | "telemetry"
  | "planning"
  | "essential";

export interface StatisticsPresetDefinition {
  key: StatisticsPresetKey;
  label: string;
  description: string;
  cardConfigs: { id: string; size: WidgetSize; isVisible: boolean; order: number }[];
}

export const STATISTICS_PRESETS: StatisticsPresetDefinition[] = [
  {
    key: "executive",
    label: "Executive",
    description: "Complete command center: health score, wealth projection & scenario modeling",
    cardConfigs: [
      { id: "financial_report", size: "full", isVisible: true, order: 0 },
      { id: "health_score", size: "full", isVisible: true, order: 1 },
      { id: "monthly_review", size: "full", isVisible: true, order: 2 },
      { id: "expense_structure", size: "full", isVisible: true, order: 3 },
      { id: "spending_patterns", size: "full", isVisible: true, order: 4 },
      { id: "cashflow_summary", size: "full", isVisible: true, order: 5 },
      { id: "inflow_outflow_trend", size: "full", isVisible: true, order: 6 },
      { id: "category_breakdown", size: "full", isVisible: true, order: 7 },
      { id: "cashflow_velocity", size: "full", isVisible: true, order: 8 },
      { id: "fire_planner", size: "full", isVisible: true, order: 9 },
      { id: "monte_carlo", size: "full", isVisible: true, order: 10 },
      { id: "what_if_simulator", size: "full", isVisible: true, order: 11 },
      { id: "personal_financial_model", size: "full", isVisible: true, order: 12 },
    ],
  },
  {
    key: "telemetry",
    label: "Telemetry",
    description: "Operational cashflow, cyclical spending trends & daily expenditure pacing",
    cardConfigs: [
      { id: "financial_report", size: "full", isVisible: true, order: 0 },
      { id: "health_score", size: "full", isVisible: true, order: 1 },
      { id: "monthly_review", size: "full", isVisible: true, order: 2 },
      { id: "expense_structure", size: "full", isVisible: true, order: 3 },
      { id: "spending_patterns", size: "full", isVisible: true, order: 4 },
      { id: "cashflow_summary", size: "full", isVisible: true, order: 5 },
      { id: "inflow_outflow_trend", size: "full", isVisible: true, order: 6 },
      { id: "category_breakdown", size: "full", isVisible: true, order: 7 },
      { id: "cashflow_velocity", size: "full", isVisible: true, order: 8 },
      { id: "fire_planner", size: "full", isVisible: false, order: 9 },
      { id: "monte_carlo", size: "full", isVisible: false, order: 10 },
      { id: "what_if_simulator", size: "full", isVisible: true, order: 11 },
      { id: "personal_financial_model", size: "full", isVisible: false, order: 12 },
    ],
  },
  {
    key: "planning",
    label: "Planning",
    description: "Long-term wealth accumulation, FIRE retirement & scenario projections",
    cardConfigs: [
      { id: "financial_report", size: "full", isVisible: true, order: 0 },
      { id: "health_score", size: "full", isVisible: true, order: 1 },
      { id: "monthly_review", size: "full", isVisible: false, order: 2 },
      { id: "expense_structure", size: "full", isVisible: true, order: 3 },
      { id: "spending_patterns", size: "full", isVisible: false, order: 4 },
      { id: "cashflow_summary", size: "full", isVisible: true, order: 5 },
      { id: "inflow_outflow_trend", size: "full", isVisible: false, order: 6 },
      { id: "category_breakdown", size: "full", isVisible: false, order: 7 },
      { id: "cashflow_velocity", size: "full", isVisible: false, order: 8 },
      { id: "fire_planner", size: "full", isVisible: true, order: 9 },
      { id: "monte_carlo", size: "full", isVisible: true, order: 10 },
      { id: "what_if_simulator", size: "full", isVisible: true, order: 11 },
      { id: "personal_financial_model", size: "full", isVisible: true, order: 12 },
    ],
  },
  {
    key: "essential",
    label: "Essential",
    description: "Distraction-free baseline: key diagnostic score, report & core cashflow",
    cardConfigs: [
      { id: "financial_report", size: "full", isVisible: true, order: 0 },
      { id: "health_score", size: "full", isVisible: true, order: 1 },
      { id: "monthly_review", size: "full", isVisible: false, order: 2 },
      { id: "expense_structure", size: "full", isVisible: false, order: 3 },
      { id: "spending_patterns", size: "full", isVisible: false, order: 4 },
      { id: "cashflow_summary", size: "full", isVisible: true, order: 5 },
      { id: "inflow_outflow_trend", size: "full", isVisible: false, order: 6 },
      { id: "category_breakdown", size: "full", isVisible: false, order: 7 },
      { id: "cashflow_velocity", size: "full", isVisible: false, order: 8 },
      { id: "fire_planner", size: "full", isVisible: true, order: 9 },
      { id: "monte_carlo", size: "full", isVisible: false, order: 10 },
      { id: "what_if_simulator", size: "full", isVisible: false, order: 11 },
      { id: "personal_financial_model", size: "full", isVisible: false, order: 12 },
    ],
  },
];
