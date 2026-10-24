import WidgetKit
import SwiftUI

// MARK: - Shared Timeline Provider
struct AccrualTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> AccrualEntry {
        AccrualEntry(date: Date(), snapshot: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (AccrualEntry) -> ()) {
        let snapshot = AccrualWidgetSnapshot.loadFromAppGroup()
        completion(AccrualEntry(date: Date(), snapshot: snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AccrualEntry>) -> ()) {
        let snapshot = AccrualWidgetSnapshot.loadFromAppGroup()
        let currentDate = Date()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate) ?? currentDate
        let timeline = Timeline(entries: [AccrualEntry(date: currentDate, snapshot: snapshot)], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct AccrualEntry: TimelineEntry {
    let date: Date
    let snapshot: AccrualWidgetSnapshot
}

// MARK: - Container Background & Rim Light Wrapper
struct AccrualWidgetShell<Content: View>: View {
    @Environment(\.colorScheme) var colorScheme
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var isDark: Bool {
        colorScheme == .dark
    }

    var body: some View {
        ZStack(alignment: .top) {
            content
                .padding(14)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Specular Rim Light Reflection
            SpecularRimLight(isDark: isDark)
                .allowsHitTesting(false)
        }
        .widgetBackground(isDark: isDark)
    }
}

extension View {
    @ViewBuilder
    func widgetBackground(isDark: Bool) -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) {
                AccrualTheme.surfaceBackground(isDark: isDark)
            }
        } else {
            self.background(AccrualTheme.surfaceBackground(isDark: isDark))
        }
    }
}

// ======================================================================
// MARK: - 1. NET WORTH HORIZON (Medium: 329x155)
// ======================================================================
struct NetWorthHorizonMediumView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(snapshot.isIndo ? "KEKAYAAN BERSIH" : "NET WORTH")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.0)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                Spacer()

                HStack(spacing: 4) {
                    Image(systemName: snapshot.isPositive24h ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 9, weight: .bold))
                    Text(snapshot.change24hFormatted)
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                }
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(6)
            }

            Spacer()

            // Main Metric
            if snapshot.isPrivacyMode {
                Text("••••••••")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
            } else {
                Text(snapshot.netWorthFormatted)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            Spacer()

            // Smooth Vector Area Horizon Sparkline
            ZStack(alignment: .bottomTrailing) {
                HorizonAreaShape(points: snapshot.sparkline)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                (isDark ? Color.white : Color.black).opacity(0.18),
                                (isDark ? Color.white : Color.black).opacity(0.01)
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: 38)

                HorizonLineShape(points: snapshot.sparkline)
                    .stroke(
                        isDark ? Color.white.opacity(0.85) : Color.black.opacity(0.85),
                        style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round)
                    )
                    .frame(height: 38)

                // Glowing Node at endpoint
                Circle()
                    .fill(isDark ? Color.white : Color.black)
                    .frame(width: 5, height: 5)
                    .offset(x: -1, y: -2)
            }

            // Subtitle
            HStack {
                Text(snapshot.isIndo ? "Tren 30 Hari Terakhir" : "Last 30 Days Trend")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                Spacer()
                Text(snapshot.safeNetCashflow)
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
            }
            .padding(.top, 4)
        }
    }
}

// ======================================================================
// MARK: - 2. ALOKASI PORTOFOLIO (Medium: 329x155)
// ======================================================================
struct PortfolioAllocationMediumView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header
            HStack {
                Text(snapshot.isIndo ? "ALOKASI PORTOFOLIO" : "PORTFOLIO ALLOCATION")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.0)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                Spacer()

                Text(snapshot.safeGrossAssets)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
            }

            Spacer()

            // 2-Column Donut + Breakdown
            HStack(spacing: 16) {
                // Left: 3-Segment Donut
                ZStack {
                    Circle()
                        .stroke(AccrualTheme.fillSubtle(isDark: isDark), lineWidth: 8)
                        .frame(width: 72, height: 72)

                    Circle()
                        .trim(from: 0, to: CGFloat(snapshot.safeLiquidPct / 100))
                        .stroke(isDark ? Color.white : Color.black, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 72, height: 72)

                    Circle()
                        .trim(from: CGFloat(snapshot.safeLiquidPct / 100), to: CGFloat((snapshot.safeLiquidPct + snapshot.safeGrowthPct) / 100))
                        .stroke((isDark ? Color.white : Color.black).opacity(0.55), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 72, height: 72)

                    Circle()
                        .trim(from: CGFloat((snapshot.safeLiquidPct + snapshot.safeGrowthPct) / 100), to: 1.0)
                        .stroke((isDark ? Color.white : Color.black).opacity(0.25), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 72, height: 72)

                    VStack(spacing: 1) {
                        Text("\(Int(snapshot.safeLiquidPct))%")
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        Text(snapshot.isIndo ? "Kas" : "Cash")
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    }
                }

                // Right: 3 Asset Class Rows
                VStack(alignment: .leading, spacing: 5) {
                    AssetClassLegendRow(
                        title: snapshot.isIndo ? "Aset Lancar & Kas" : "Liquid & Cash",
                        pct: snapshot.safeLiquidPct,
                        opacity: 1.0,
                        isDark: isDark
                    )
                    AssetClassLegendRow(
                        title: snapshot.isIndo ? "Investasi & Efek" : "Investments",
                        pct: snapshot.safeGrowthPct,
                        opacity: 0.55,
                        isDark: isDark
                    )
                    AssetClassLegendRow(
                        title: snapshot.isIndo ? "Aset Riil & Fisik" : "Real Assets",
                        pct: snapshot.safeFixedPct,
                        opacity: 0.25,
                        isDark: isDark
                    )
                }
                .frame(maxWidth: .infinity)
            }

            Spacer()
        }
    }
}

struct AssetClassLegendRow: View {
    let title: String
    let pct: Double
    let opacity: Double
    let isDark: Bool

    var body: some View {
        HStack {
            Circle()
                .fill(isDark ? Color.white.opacity(opacity) : Color.black.opacity(opacity))
                .frame(width: 6, height: 6)

            Text(title)
                .font(.system(size: 9.5, weight: .medium))
                .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                .lineLimit(1)

            Spacer()

            Text("\(String(format: "%.0f", pct))%")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
        }
    }
}

// ======================================================================
// MARK: - 3. POSISI KAS LIKUID & RUNWAY (Small: 155x155)
// ======================================================================
struct LiquidCashRunwaySmallView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header + Runway Pill
            HStack {
                Text(snapshot.isIndo ? "KAS LIKUID" : "LIQUID CASH")
                    .font(.system(size: 9.5, weight: .semibold))
                    .tracking(0.8)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                Spacer()

                Text("\(String(format: "%.1f", snapshot.safeRunwayMonths)) \(snapshot.isIndo ? "Bln" : "Mo")")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(AccrualTheme.fillSubtle(isDark: isDark))
                    .cornerRadius(6)
            }

            Spacer()

            // Main Metric
            if snapshot.isPrivacyMode {
                Text("••••••••")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
            } else {
                Text(snapshot.totalAssetsFormatted)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }

            Spacer()

            // Footer
            VStack(alignment: .leading, spacing: 4) {
                // Runway Bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(AccrualTheme.fillSubtle(isDark: isDark))
                            .frame(height: 4)

                        Capsule()
                            .fill(isDark ? Color.white : Color.black)
                            .frame(width: min(geo.size.width, geo.size.width * CGFloat(snapshot.safeRunwayMonths / 12.0)), height: 4)
                    }
                }
                .frame(height: 4)

                HStack {
                    Text(snapshot.isIndo ? "Bakar/hr:" : "Burn/d:")
                        .font(.system(size: 8.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    Spacer()
                    Text(snapshot.safeDailyBurn)
                        .font(.system(size: 8.5, weight: .semibold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                }
            }
        }
    }
}

// ======================================================================
// MARK: - 4. RASIO TABUNGAN RING (Small: 155x155)
// ======================================================================
struct SavingsRateRingSmallView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    var body: some View {
        VStack(alignment: .center, spacing: 0) {
            // Header
            HStack {
                Text(snapshot.isIndo ? "RASIO TABUNGAN" : "SAVINGS RATE")
                    .font(.system(size: 9.5, weight: .semibold))
                    .tracking(0.8)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                Spacer()
            }

            Spacer()

            // Ring Gauge
            ZStack {
                Circle()
                    .stroke(AccrualTheme.fillSubtle(isDark: isDark), lineWidth: 7)
                    .frame(width: 68, height: 68)

                Circle()
                    .trim(from: 0, to: min(1.0, CGFloat(snapshot.safeSavingsRate) / 100.0))
                    .stroke(isDark ? Color.white : Color.black, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 68, height: 68)

                VStack(spacing: 0) {
                    Text("\(snapshot.safeSavingsRate)%")
                        .font(.system(size: 15, weight: .bold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    Text("Target \(snapshot.safeSavingsTarget)%")
                        .font(.system(size: 7.5, weight: .semibold))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                }
            }

            Spacer()

            // Footer
            HStack {
                Text(snapshot.isIndo ? "Terkumpul:" : "Saved:")
                    .font(.system(size: 8.5, weight: .medium))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                Spacer()
                Text(snapshot.safeMonthlySavings)
                    .font(.system(size: 8.5, weight: .semibold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
            }
        }
    }
}

// ======================================================================
// MARK: - 5. ARUS KAS BULANAN BATANG TICK (Medium: 329x155)
// ======================================================================
struct MonthlyCashflowBarMediumView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    private func barColor(val: Int, isDark: Bool) -> Color {
        let base = isDark ? Color.white : Color.black
        let opacity = val > 50 ? 0.9 : 0.3
        return base.opacity(opacity)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(snapshot.isIndo ? "ARUS KAS BULANAN" : "MONTHLY CASHFLOW")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.0)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                Spacer()

                Text(snapshot.safeNetCashflow)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(AccrualTheme.fillSubtle(isDark: isDark))
                    .cornerRadius(6)
            }

            Spacer()

            // Inflow vs Outflow Pillars
            HStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(snapshot.isIndo ? "Pemasukan" : "Inflow")
                        .font(.system(size: 8.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    Text(snapshot.safeMonthlyInflow)
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(snapshot.isIndo ? "Pengeluaran" : "Outflow")
                        .font(.system(size: 8.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    Text(snapshot.safeMonthlyOutflow)
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                }
            }

            Spacer()

            // 12 Vertical Activity Bar Ticks
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(0..<min(12, snapshot.safeCashflowBars.count)), id: \.self) { idx in
                    let val = snapshot.safeCashflowBars[idx]
                    RoundedRectangle(cornerRadius: 2)
                        .fill(barColor(val: val, isDark: isDark))
                        .frame(maxWidth: .infinity, height: max(6, CGFloat(val) * 0.28))
                }
            }
            .frame(height: 32)
        }
    }
}

// ======================================================================
// MARK: - 6. STASIUN CATAT CEPAT 1-KETUKAN (Small: 155x155)
// ======================================================================
struct QuickLogStationSmallView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(snapshot.isIndo ? "CATAT CEPAT" : "QUICK LOG")
                .font(.system(size: 9.5, weight: .semibold))
                .tracking(0.8)
                .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

            Spacer()

            VStack(spacing: 6) {
                Link(destination: URL(string: "accrual://log?type=expense")!) {
                    QuickActionTile(
                        iconName: "minus.circle.fill",
                        label: snapshot.isIndo ? "Pengeluaran" : "Expense",
                        isDark: isDark
                    )
                }

                Link(destination: URL(string: "accrual://log?type=income")!) {
                    QuickActionTile(
                        iconName: "plus.circle.fill",
                        label: snapshot.isIndo ? "Pemasukan" : "Income",
                        isDark: isDark
                    )
                }

                Link(destination: URL(string: "accrual://log?type=transfer")!) {
                    QuickActionTile(
                        iconName: "arrow.left.arrow.right.circle.fill",
                        label: snapshot.isIndo ? "Transfer" : "Transfer",
                        isDark: isDark
                    )
                }
            }
        }
    }
}

struct QuickActionTile: View {
    let iconName: String
    let label: String
    let isDark: Bool

    var body: some View {
        HStack {
            Image(systemName: iconName)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))

            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .background(AccrualTheme.fillSubtle(isDark: isDark))
        .cornerRadius(8)
    }
}

// ======================================================================
// MARK: - 7. KESEHATAN MODAL / CAPITAL HEALTH (Small: 155x155)
// ======================================================================
struct CapitalHealthSmallView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(snapshot.isIndo ? "KESEHATAN MODAL" : "CAPITAL HEALTH")
                    .font(.system(size: 9.5, weight: .semibold))
                    .tracking(0.8)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                Spacer()
            }

            Spacer()

            // Main Score Indicator
            VStack(alignment: .leading, spacing: 2) {
                Text("\(snapshot.safeCapitalHealthScore)")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .lineLimit(1)

                Text(snapshot.isIndo ? "/ 100 Indeks Ketahanan" : "/ 100 Resilience Index")
                    .font(.system(size: 8.5, weight: .medium))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
            }

            Spacer()

            // Footer Status
            VStack(spacing: 4) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(AccrualTheme.fillSubtle(isDark: isDark))
                            .frame(height: 4)

                        Capsule()
                            .fill(isDark ? Color.white : Color.black)
                            .frame(width: min(geo.size.width, geo.size.width * CGFloat(snapshot.safeCapitalHealthScore) / 100.0), height: 4)
                    }
                }
                .frame(height: 4)

                HStack {
                    Text("Status:")
                        .font(.system(size: 8.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    Spacer()
                    Text(snapshot.safeCapitalHealthTier)
                        .font(.system(size: 8.5, weight: .bold))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                }
            }
        }
    }
}

// ======================================================================
// MARK: - 8. MATRIKS AKTIVITAS BULANAN / HALF CARD (Small: 155x155)
// ======================================================================
struct ActivityMatrixSmallView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    private func dotColor(dot: WidgetHeatmapDot, isDark: Bool) -> Color {
        let base = isDark ? Color.white : Color.black
        if dot.intensity > 0.6 {
            return base
        } else if dot.intensity > 0.2 {
            return base.opacity(isDark ? 0.45 : 0.40)
        } else if dot.hasSpend {
            return base.opacity(isDark ? 0.20 : 0.18)
        } else {
            return base.opacity(0.06)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(snapshot.isIndo ? "MATRIKS AKTIVITAS" : "ACTIVITY MATRIX")
                    .font(.system(size: 9.5, weight: .semibold))
                    .tracking(0.8)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                Spacer()
            }

            Spacer()

            // 7x4 28-day Activity Dot Grid
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(Array(0..<min(28, snapshot.safeHeatmapDots.count)), id: \.self) { idx in
                    let dot = snapshot.safeHeatmapDots[idx]
                    Circle()
                        .fill(dotColor(dot: dot, isDark: isDark))
                        .frame(width: 10, height: 10)
                }
            }
            .frame(maxWidth: 130)
            .frame(maxWidth: .infinity, alignment: .center)

            Spacer()

            // Footer
            VStack(spacing: 3) {
                Divider()
                    .background(AccrualTheme.cardBorder(isDark: isDark))

                HStack {
                    Text(snapshot.isIndo ? "Hari Aktif" : "Active Days")
                        .font(.system(size: 8.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))

                    Spacer()

                    Text("\(snapshot.safeActiveDaysCount) \(snapshot.isIndo ? "dari 28 hr" : "of 28 d")")
                        .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                }
            }
        }
    }
}

// ======================================================================
// MARK: - 9. STRUKTUR NERACA DENGAN CHART SOLVENSI (Medium: 329x155)
// ======================================================================
struct BalanceSheetMediumView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(snapshot.isIndo ? "STRUKTUR NERACA" : "BALANCE SHEET")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.0)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                Spacer()

                Text("\(snapshot.isIndo ? "Rasio Utang" : "Debt Ratio"): \(String(format: "%.1f", snapshot.safeDebtRatio))%")
                    .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
            }

            Spacer()

            // 2-Column: Left Concentric Solvency Rings, Right Balance Pillars
            HStack(spacing: 16) {
                // Left: Concentric Solvency Rings
                ZStack {
                    // Outer Ring: Liquid
                    Circle()
                        .stroke(AccrualTheme.fillSubtle(isDark: isDark), lineWidth: 4.5)
                        .frame(width: 80, height: 80)
                    Circle()
                        .trim(from: 0, to: CGFloat(snapshot.safeLiquidPct / 100))
                        .stroke(isDark ? Color.white : Color.black, style: StrokeStyle(lineWidth: 4.5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 80, height: 80)

                    // Middle Ring: Investments
                    Circle()
                        .stroke(AccrualTheme.fillSubtle(isDark: isDark), lineWidth: 4.5)
                        .frame(width: 64, height: 64)
                    Circle()
                        .trim(from: 0, to: CGFloat(snapshot.safeGrowthPct / 100))
                        .stroke((isDark ? Color.white : Color.black).opacity(0.65), style: StrokeStyle(lineWidth: 4.5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 64, height: 64)

                    // Inner Ring: Debt
                    Circle()
                        .stroke(AccrualTheme.fillSubtle(isDark: isDark), lineWidth: 4)
                        .frame(width: 48, height: 48)
                    Circle()
                        .trim(from: 0, to: CGFloat(snapshot.safeDebtRatio / 100))
                        .stroke((isDark ? Color.white : Color.black).opacity(0.35), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 48, height: 48)

                    // Center: Solvency %
                    VStack(spacing: 0) {
                        Text("\(snapshot.safeSolvencyScore)%")
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        Text(snapshot.isIndo ? "Solvensi" : "Solvency")
                            .font(.system(size: 7, weight: .semibold))
                            .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    }
                }

                // Right: 3 Financial Pillars
                VStack(alignment: .leading, spacing: 6) {
                    BalanceMetricRow(
                        label: snapshot.isIndo ? "Aset Kotor" : "Gross Assets",
                        value: snapshot.safeGrossAssets,
                        isDark: isDark
                    )
                    BalanceMetricRow(
                        label: snapshot.isIndo ? "Liabilitas" : "Liabilities",
                        value: snapshot.safeLiabilities,
                        isDark: isDark
                    )
                    Divider()
                        .background(AccrualTheme.cardBorder(isDark: isDark))
                    BalanceMetricRow(
                        label: snapshot.isIndo ? "Ekuitas Bersih" : "Net Equity",
                        value: snapshot.safeNetEquity,
                        isDark: isDark,
                        isBold: true
                    )
                }
                .frame(maxWidth: .infinity)
            }

            Spacer()
        }
    }
}

struct BalanceMetricRow: View {
    let label: String
    let value: String
    let isDark: Bool
    var isBold: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 9.5, weight: isBold ? .semibold : .medium))
                .foregroundColor(isBold ? AccrualTheme.textPrimary(isDark: isDark) : AccrualTheme.textSecondary(isDark: isDark))

            Spacer()

            Text(value)
                .font(.system(size: 10, weight: isBold ? .bold : .medium, design: .monospaced))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
        }
    }
}

// ======================================================================
// MARK: - 10. STABILITAS PENGELUARAN (Small: 155x155)
// ======================================================================
struct SpendingStabilitySmallView: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var isDark: Bool { colorScheme == .dark }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header + Status Pill
            HStack {
                Text(snapshot.isIndo ? "STABILITAS" : "STABILITY")
                    .font(.system(size: 9.5, weight: .semibold))
                    .tracking(0.8)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                Spacer()

                Text(snapshot.safeSpendingStatus)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(AccrualTheme.fillSubtle(isDark: isDark))
                    .cornerRadius(6)
            }

            Spacer()

            // Main Metric
            VStack(alignment: .leading, spacing: 2) {
                Text(snapshot.safeDailyAverage)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                Text(snapshot.isIndo ? "Rata-rata Harian" : "Daily Average")
                    .font(.system(size: 8.5, weight: .medium))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
            }

            Spacer()

            // Pulse Activity Wave
            HStack {
                Text("\(snapshot.safeVolatilityVariance)% \(snapshot.isIndo ? "Variansi" : "Variance")")
                    .font(.system(size: 8.5, weight: .medium))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                Spacer()
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
            }
        }
    }
}

// ======================================================================
// MARK: - 5 LOCK SCREEN ACCESSORIES
// ======================================================================

// 1. Lock Screen: Net Worth Horizon (Rectangular 155x68)
struct LockScreenNetWorthRectView: View {
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(snapshot.isIndo ? "Kekayaan Bersih" : "Net Worth")
                    .font(.system(size: 9, weight: .medium))
                    .textCase(.uppercase)
                Spacer()
                Text(snapshot.change24hFormatted)
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
            }

            Text(snapshot.netWorthFormatted)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            HorizonLineShape(points: snapshot.sparkline)
                .stroke(Color.primary, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                .frame(height: 12)
        }
    }
}

// 2. Lock Screen: Alokasi Portofolio (Rectangular 155x68)
struct LockScreenPortfolioRectView: View {
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .stroke(Color.primary.opacity(0.2), lineWidth: 4)
                    .frame(width: 36, height: 36)
                Circle()
                    .trim(from: 0, to: CGFloat(snapshot.safeLiquidPct / 100))
                    .stroke(Color.primary, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 36, height: 36)
                Text("\(Int(snapshot.safeLiquidPct))%")
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(snapshot.isIndo ? "Alokasi" : "Allocation")
                    .font(.system(size: 8.5, weight: .bold))
                    .textCase(.uppercase)
                Text("Kas: \(Int(snapshot.safeLiquidPct))%")
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                Text("Inv: \(Int(snapshot.safeGrowthPct))%")
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .opacity(0.8)
                Text("Riil: \(Int(snapshot.safeFixedPct))%")
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .opacity(0.6)
            }
        }
    }
}

// 3. Lock Screen: Pill Card Savings Runway (Rectangular 155x68)
struct LockScreenSavingsRunwayRectView: View {
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("Savings Runway")
                    .font(.system(size: 9, weight: .medium))
                    .textCase(.uppercase)
                Spacer()
                Text(snapshot.safeRunwayMonths >= 6 ? (snapshot.isIndo ? "Aman" : "Safe") : (snapshot.isIndo ? "Waspada" : "Caution"))
                    .font(.system(size: 8, weight: .bold))
            }

            Text("\(String(format: "%.1f", snapshot.safeRunwayMonths)) \(snapshot.isIndo ? "Bulan" : "Months")")
                .font(.system(size: 14, weight: .bold, design: .rounded))

            ProgressView(value: min(1.0, snapshot.safeRunwayMonths / 12.0))
                .progressViewStyle(.linear)
        }
    }
}

// 4. Lock Screen: Pill Card Spending Stability (Rectangular 155x68)
struct LockScreenSpendingStabilityRectView: View {
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(snapshot.isIndo ? "Stabilitas" : "Stability")
                    .font(.system(size: 9, weight: .medium))
                    .textCase(.uppercase)
                Spacer()
                Text(snapshot.safeSpendingStatus)
                    .font(.system(size: 8, weight: .bold))
            }

            Text(snapshot.safeDailyAverage)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .lineLimit(1)

            HStack {
                Text("\(snapshot.safeVolatilityVariance)% \(snapshot.isIndo ? "Variansi" : "Variance")")
                    .font(.system(size: 7.5, weight: .medium))
                    .opacity(0.7)
                Spacer()
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 8, weight: .semibold))
            }
        }
    }
}

// 5. Lock Screen: Catat Cepat 1-Tap Launcher (Circular 68x68)
// STRICT REQUIREMENT: Only the App Logo Icon, NO TEXT!
struct LockScreenQuickLogCircularView: View {
    var body: some View {
        Link(destination: URL(string: "accrual://log")!) {
            ZStack {
                // Outer Circular Gauge Track
                Circle()
                    .stroke(Color.primary.opacity(0.2), lineWidth: 2.5)

                // Accrual 3-Pebble Zen Logo Icon Centered
                AccrualZenLogoIcon(size: 26)
                    .foregroundColor(.primary)
            }
        }
    }
}

// Lock Screen Inline Accessory (Above Clock)
struct LockScreenInlineView: View {
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        Text("Accrual: \(snapshot.netWorthFormatted) (\(snapshot.change24hFormatted))")
    }
}

// MARK: - Horizon Vector Paths
struct HorizonLineShape: Shape {
    let points: [Int]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard points.count > 1 else { return path }
        let step = rect.width / CGFloat(points.count - 1)

        for (index, point) in points.enumerated() {
            let x = CGFloat(index) * step
            let y = rect.height - (CGFloat(point) / 100.0 * (rect.height - 4)) - 2
            if index == 0 {
                path.move(to: CGPoint(x: x, y: y))
            } else {
                path.addLine(to: CGPoint(x: x, y: y))
            }
        }
        return path
    }
}

struct HorizonAreaShape: Shape {
    let points: [Int]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard points.count > 1 else { return path }
        let step = rect.width / CGFloat(points.count - 1)

        path.move(to: CGPoint(x: 0, y: rect.height))
        for (index, point) in points.enumerated() {
            let x = CGFloat(index) * step
            let y = rect.height - (CGFloat(point) / 100.0 * (rect.height - 4)) - 2
            path.addLine(to: CGPoint(x: x, y: y))
        }
        path.addLine(to: CGPoint(x: rect.width, y: rect.height))
        path.closeSubpath()
        return path
    }
}

// ======================================================================
// MARK: - WIDGET DEFINITIONS
// ======================================================================

// 1. Net Worth Horizon
struct NetWorthHorizonWidget: Widget {
    let kind: String = "NetWorthHorizonWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                NetWorthHorizonMediumView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Net Worth Horizon")
        .description("Grafik kurva kekayaan bersih dengan titik simpul bersinar dan tren.")
        .supportedFamilies([.systemMedium])
    }
}

// 2. Alokasi Portofolio
struct PortfolioAllocationWidget: Widget {
    let kind: String = "PortfolioAllocationWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                PortfolioAllocationMediumView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Alokasi Portofolio")
        .description("Diagram Donut alokasi aset kas, investasi, dan fisik.")
        .supportedFamilies([.systemMedium])
    }
}

// 3. Posisi Kas Likuid & Runway
struct LiquidCashRunwayWidget: Widget {
    let kind: String = "LiquidCashRunwayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                LiquidCashRunwaySmallView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Kas Likuid & Runway")
        .description("Saldo kas likuid darurat dan ketahanan cadangan hidup.")
        .supportedFamilies([.systemSmall])
    }
}

// 4. Rasio Tabungan Ring
struct SavingsRateRingWidget: Widget {
    let kind: String = "SavingsRateRingWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                SavingsRateRingSmallView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Rasio Tabungan")
        .description("Cincin rasio tabungan bulanan terhadap target.")
        .supportedFamilies([.systemSmall])
    }
}

// 5. Arus Kas Bulanan Batang Tick
struct MonthlyCashflowBarWidget: Widget {
    let kind: String = "MonthlyCashflowBarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                MonthlyCashflowBarMediumView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Arus Kas Bulanan")
        .description("Perbandingan arus masuk vs keluar dengan bilah tempo aktivitas.")
        .supportedFamilies([.systemMedium])
    }
}

// 6. Stasiun Catat Cepat 1-Ketukan
struct QuickLogStationWidget: Widget {
    let kind: String = "QuickLogStationWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                QuickLogStationSmallView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Stasiun Catat Cepat")
        .description("Tombol 1-ketukan untuk mencatat pengeluaran, pemasukan, atau transfer.")
        .supportedFamilies([.systemSmall])
    }
}

// 7. Kesehatan Modal (Capital Health)
struct CapitalHealthWidget: Widget {
    let kind: String = "CapitalHealthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                CapitalHealthSmallView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Kesehatan Modal")
        .description("Skor kesehatan finansial dan indeks ketahanan portofolio.")
        .supportedFamilies([.systemSmall])
    }
}

// 8. Matriks Aktivitas Bulanan (Activity Matrix - Small Half Card)
struct ActivityMatrixWidget: Widget {
    let kind: String = "ActivityMatrixWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                ActivityMatrixSmallView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Matriks Aktivitas")
        .description("Kisi 28 titik frekuensi dan intensitas transaksi harian.")
        .supportedFamilies([.systemSmall])
    }
}

// 9. Struktur Neraca Portofolio (Balance Sheet)
struct BalanceSheetWidget: Widget {
    let kind: String = "BalanceSheetWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                BalanceSheetMediumView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Struktur Neraca")
        .description("Neraca portofolio dengan chart pengukur cincin solvensi konsentris.")
        .supportedFamilies([.systemMedium])
    }
}

// 10. Stabilitas Pengeluaran (Spending Stability)
struct SpendingStabilityWidget: Widget {
    let kind: String = "SpendingStabilityWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell {
                SpendingStabilitySmallView(snapshot: entry.snapshot)
            }
        }
        .configurationDisplayName("Stabilitas Pengeluaran")
        .description("Indeks variansi dan rata-rata pengeluaran harian.")
        .supportedFamilies([.systemSmall])
    }
}

// ======================================================================
// MARK: - LOCK SCREEN ACCESSORIES WIDGET
// ======================================================================
struct LockScreenAccessoriesWidget: Widget {
    let kind: String = "LockScreenAccessoriesWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            LockScreenAccessoryEntryView(entry: entry)
        }
        .configurationDisplayName("Accrual Lock Screen")
        .description("Widget aksesoris layar kunci monokrom.")
        .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

struct LockScreenAccessoryEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: AccrualTimelineProvider.Entry

    var body: some View {
        switch family {
        case .accessoryRectangular:
            LockScreenNetWorthRectView(snapshot: entry.snapshot)
        case .accessoryCircular:
            LockScreenQuickLogCircularView()
        case .accessoryInline:
            LockScreenInlineView(snapshot: entry.snapshot)
        default:
            LockScreenQuickLogCircularView()
        }
    }
}
