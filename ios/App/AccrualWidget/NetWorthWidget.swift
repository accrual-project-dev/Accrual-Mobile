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
    let snapshot: AccrualWidgetSnapshot
    let content: (Bool) -> Content

    init(snapshot: AccrualWidgetSnapshot, @ViewBuilder content: @escaping (Bool) -> Content) {
        self.snapshot = snapshot
        self.content = content
    }

    var isDark: Bool {
        snapshot.forcedDark ?? (colorScheme == .dark)
    }

    var body: some View {
        ZStack(alignment: .top) {
            content(isDark)
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
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

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
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

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
// MARK: - 3. POSISI KAS LIKUID (Small: 155x155 - Foto 1 Style)
// ======================================================================
struct LiquidCashRunwaySmallView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header: Icon + Label
            HStack(spacing: 5) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                Text(snapshot.isIndo ? "Kas likuid" : "Liquid cash")
                    .font(.system(size: 10.5, weight: .medium))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                Spacer()
            }

            Spacer(minLength: 4)

            // Main Metric: Real Liquid Cash (not net worth)
            VStack(alignment: .leading, spacing: 3) {
                if snapshot.isPrivacyMode {
                    Text("••••••••")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                } else {
                    Text(snapshot.safeLiquidCash)
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }

                // Trend Badge: ↗ 0.7% vs Sep
                HStack(spacing: 3) {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 7.5, weight: .bold))
                    Text(snapshot.safeLiquidCashChange)
                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                }
                .foregroundColor(isDark ? Color.white : Color.black)
                .padding(.horizontal, 6)
                .padding(.vertical, 2.5)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(6)
            }

            Spacer(minLength: 6)

            // Smooth Sparkline with end-point dot
            ZStack(alignment: .bottomTrailing) {
                HorizonAreaShape(points: snapshot.safeLiquidCashSparkline)
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
                    .frame(height: 32)

                HorizonLineShape(points: snapshot.safeLiquidCashSparkline)
                    .stroke(
                        isDark ? Color.white.opacity(0.85) : Color.black.opacity(0.85),
                        style: StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round)
                    )
                    .frame(height: 32)

                Circle()
                    .fill(isDark ? Color.white : Color.black)
                    .frame(width: 5, height: 5)
                    .offset(x: -1, y: -2)
            }
        }
    }
}

// ======================================================================
// MARK: - 4. RASIO TABUNGAN RING (Small: 155x155)
// ======================================================================
struct SavingsRateRingSmallView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

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
// MARK: - 5. ARUS KAS BULANAN & HEATMAP (Medium: 329x155 - Foto 2 Style)
// ======================================================================
struct MonthlyCashflowBarMediumView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    private func heatmapColor(dot: WidgetHeatmapDot) -> Color {
        guard dot.hasSpend else {
            return isDark ? Color.white.opacity(0.06) : Color.black.opacity(0.05)
        }
        let alpha = max(0.25, min(1.0, dot.intensity))
        return (isDark ? Color.white : Color.black).opacity(alpha)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Left Column: Hero Delta + Subtitles
            VStack(alignment: .leading, spacing: 0) {
                // Header: Icon + Title
                HStack(spacing: 5) {
                    Image(systemName: "arrow.left.arrow.right")
                        .font(.system(size: 9.5, weight: .semibold))
                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                    Text(snapshot.isIndo ? "Arus kas bulan ini" : "Cashflow this month")
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                }

                Spacer()

                // Hero Delta Nominal (Inflow - Outflow)
                if snapshot.isPrivacyMode {
                    Text("••••••••")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                } else {
                    Text(snapshot.safeNetCashflow)
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                // Delta vs Last Month Pill
                HStack(spacing: 3) {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 7.5, weight: .bold))
                    Text(snapshot.safeCashflowDeltaVsLastMonth)
                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                }
                .foregroundColor(isDark ? Color.white : Color.black)
                .padding(.horizontal, 6)
                .padding(.vertical, 2.5)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(6)
                .padding(.top, 4)

                Spacer()

                // Subtitle: Inflow & Outflow breakdown
                Text("\(snapshot.isIndo ? "Masuk" : "In"): \(snapshot.safeMonthlyInflow) • \(snapshot.isIndo ? "Keluar" : "Out"): \(snapshot.safeMonthlyOutflow)")
                    .font(.system(size: 8.5, weight: .medium, design: .monospaced))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            Spacer(minLength: 4)

            // Right Column: Month Header + Calendar Heatmap Matrix + M T W T F S S
            VStack(alignment: .trailing, spacing: 6) {
                Text(snapshot.safeMonthShortName)
                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    .padding(.trailing, 14)

                HStack(spacing: 5) {
                    // 4 Columns of 7 Day Squares
                    HStack(spacing: 3.5) {
                        ForEach(0..<4, id: \.self) { col in
                            VStack(spacing: 3.5) {
                                ForEach(0..<7, id: \.self) { row in
                                    let idx = col * 7 + row
                                    let dot = idx < snapshot.safeHeatmapDots.count
                                        ? snapshot.safeHeatmapDots[idx]
                                        : WidgetHeatmapDot(intensity: 0, hasSpend: false)
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(heatmapColor(dot: dot))
                                        .frame(width: 10, height: 10)
                                }
                            }
                        }
                    }

                    // Weekday Labels M T W T F S S
                    VStack(spacing: 3.5) {
                        ForEach(["M", "T", "W", "T", "F", "S", "S"], id: \.self) { day in
                            Text(day)
                                .font(.system(size: 7, weight: .bold, design: .monospaced))
                                .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                                .frame(height: 10)
                        }
                    }
                }
            }
        }
    }
}

// ======================================================================
// MARK: - 6. STASIUN CATAT CEPAT 1-KETUKAN (Small: 155x155)
// ======================================================================
struct QuickLogStationSmallView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

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
// MARK: - 7. KESEHATAN MODAL (Small: 155x155 - Semicircle Rainbow Arc)
// ======================================================================
struct RainbowArcShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addArc(
            center: CGPoint(x: rect.midX, y: rect.maxY),
            radius: min(rect.width / 2, rect.height),
            startAngle: .degrees(180),
            endAngle: .degrees(360),
            clockwise: false
        )
        return path
    }
}

struct CapitalHealthSmallView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        VStack(alignment: .center, spacing: 0) {
            // Header
            HStack {
                Text(snapshot.isIndo ? "KESEHATAN MODAL" : "CAPITAL HEALTH")
                    .font(.system(size: 9.5, weight: .semibold))
                    .tracking(0.8)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                Spacer()
            }

            Spacer()

            // 180° Rainbow Arc Gauge
            ZStack {
                // Background Track Arc
                RainbowArcShape()
                    .stroke(
                        isDark ? Color.white.opacity(0.12) : Color.black.opacity(0.08),
                        style: StrokeStyle(lineWidth: 7.5, lineCap: .round)
                    )

                // Foreground Progress Arc
                RainbowArcShape()
                    .trim(from: 0.0, to: CGFloat(snapshot.safeCapitalHealthScore) / 100.0)
                    .stroke(
                        isDark ? Color.white : Color.black,
                        style: StrokeStyle(lineWidth: 7.5, lineCap: .round)
                    )

                // Central Score Content
                VStack(spacing: 0) {
                    Text("\(snapshot.safeCapitalHealthScore)")
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))

                    Text(snapshot.safeCapitalHealthTier)
                        .font(.system(size: 9.5, weight: .bold))
                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                }
                .offset(y: 8)
            }
            .frame(width: 106, height: 55)

            Spacer()

            // Footer Solvency
            HStack {
                Text(snapshot.isIndo ? "Solvabilitas" : "Solvency")
                    .font(.system(size: 8.5, weight: .medium))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                Spacer()
                Text("\(snapshot.safeSolvencyScore)/100")
                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
            }
        }
    }
}

// ======================================================================
// MARK: - SAFE TO SPEND (Medium: 329x155 - Foto 3 Style)
// ======================================================================
struct SafeToSpendMediumView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        VStack(spacing: 10) {
            // Top Row: Gauge + Left to spend
            HStack(spacing: 16) {
                // Left 180° Gauge
                ZStack {
                    RainbowArcShape()
                        .stroke(
                            isDark ? Color.white.opacity(0.12) : Color.black.opacity(0.08),
                            style: StrokeStyle(lineWidth: 7, lineCap: .round)
                        )

                    RainbowArcShape()
                        .trim(from: 0.0, to: CGFloat(snapshot.safeSafeToSpendPercent) / 100.0)
                        .stroke(
                            isDark ? Color.white : Color.black,
                            style: StrokeStyle(lineWidth: 7, lineCap: .round)
                        )

                    VStack(spacing: 0) {
                        Text("\(snapshot.safeSafeToSpendPercent)%")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        Text(snapshot.isIndo ? "Terpakai" : "Spent")
                            .font(.system(size: 7.5, weight: .medium))
                            .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    }
                    .offset(y: 7)
                }
                .frame(width: 80, height: 42)

                // Right: Left to spend info
                VStack(alignment: .leading, spacing: 2) {
                    Text(snapshot.isIndo ? "Sisa Anggaran" : "Left to spend")
                        .font(.system(size: 9.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))

                    if snapshot.isPrivacyMode {
                        Text("••••••••")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    } else {
                        Text(snapshot.safeSafeToSpendRemaining)
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }

                    Text("\(snapshot.isIndo ? "dari" : "of") \(snapshot.safeSafeToSpendBudget)")
                        .font(.system(size: 8.5, weight: .medium, design: .monospaced))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                }

                Spacer()
            }

            // Bottom Row: Safe to spend capsule + Days left block
            HStack(spacing: 8) {
                // Safe to spend daily capsule
                VStack(alignment: .leading, spacing: 1.5) {
                    Text(snapshot.isIndo ? "Aman dibelanjakan" : "Safe to spend")
                        .font(.system(size: 8.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))

                    Text(snapshot.safeSafeToSpendDaily)
                        .font(.system(size: 12.5, weight: .bold, design: .rounded))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        .lineLimit(1)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(10)

                // Days left block
                VStack(alignment: .center, spacing: 1.5) {
                    Text(snapshot.isIndo ? "Sisa hari" : "Days left")
                        .font(.system(size: 8.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))

                    Text("\(snapshot.safeDaysLeftInMonth)")
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(10)
            }
        }
    }
}

// ======================================================================
// MARK: - 8. MATRIKS AKTIVITAS BULANAN / HALF CARD (Small: 155x155)
// ======================================================================
struct ActivityMatrixSmallView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

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

    private var displayDots: [(offset: Int, element: WidgetHeatmapDot)] {
        Array(snapshot.safeHeatmapDots.prefix(28).enumerated())
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
                ForEach(displayDots, id: \.offset) { _, dot in
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
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

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
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header + Status Pill
            HStack {
                Text(snapshot.isIndo ? "STABILITAS" : "STABILITY")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(0.5)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
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
                Text(snapshot.isIndo ? "Cadangan Hidup" : "Savings Runway")
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
        ZStack {
            // Outer Circular Gauge Track
            Circle()
                .stroke(Color.primary.opacity(0.2), lineWidth: 2.5)

            // Accrual 3-Pebble Zen Logo Icon Centered
            AccrualZenLogoIcon(size: 26)
                .foregroundColor(.primary)
        }
        .widgetURL(URL(string: "accrual://add"))
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
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                NetWorthHorizonMediumView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Net Worth Horizon")
        .description("Net worth trajectory curve with glowing node and velocity trend.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// 2. Alokasi Portofolio
struct PortfolioAllocationWidget: Widget {
    let kind: String = "PortfolioAllocationWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                PortfolioAllocationMediumView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Portfolio Allocation")
        .description("Asset allocation donut chart: liquid cash, growth, and real assets.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// 3. Posisi Kas Likuid (Foto 1 Style)
struct LiquidCashRunwayWidget: Widget {
    let kind: String = "LiquidCashRunwayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                LiquidCashRunwaySmallView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Liquid Cash")
        .description("Real liquid cash reserves and velocity trend.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// 4. Rasio Tabungan Ring
struct SavingsRateRingWidget: Widget {
    let kind: String = "SavingsRateRingWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                SavingsRateRingSmallView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Savings Rate")
        .description("Monthly savings rate concentric progress ring against target.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// 5. Arus Kas Bulanan & Heatmap (Foto 2 Style)
struct MonthlyCashflowBarWidget: Widget {
    let kind: String = "MonthlyCashflowBarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                MonthlyCashflowBarMediumView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Monthly Cashflow")
        .description("Net cashflow delta with monthly daily activity heatmap.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// 5B. Aman Dibelanjakan / Safe to Spend (Foto 3 Style)
struct SafeToSpendWidget: Widget {
    let kind: String = "SafeToSpendWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                SafeToSpendMediumView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Safe to Spend")
        .description("Monthly budget pacing, remaining allowance, and daily safe-to-spend limit.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// 6. Stasiun Catat Cepat 1-Ketukan
struct QuickLogStationWidget: Widget {
    let kind: String = "QuickLogStationWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                QuickLogStationSmallView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://log?type=expense"))
        }
        .configurationDisplayName("Quick Log Station")
        .description("1-tap action buttons to log expense, income, or transfer.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// 7. Kesehatan Modal (Capital Health)
struct CapitalHealthWidget: Widget {
    let kind: String = "CapitalHealthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                CapitalHealthSmallView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Capital Health")
        .description("Financial health score and portfolio resilience index.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// 8. Matriks Aktivitas Bulanan (Activity Matrix - Small Half Card)
struct ActivityMatrixWidget: Widget {
    let kind: String = "ActivityMatrixWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                ActivityMatrixSmallView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://transactions"))
        }
        .configurationDisplayName("Activity Matrix")
        .description("28-day frequency and intensity transaction cadence matrix.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// 9. Struktur Neraca Portofolio (Balance Sheet)
struct BalanceSheetWidget: Widget {
    let kind: String = "BalanceSheetWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                BalanceSheetMediumView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://reports"))
        }
        .configurationDisplayName("Balance Sheet")
        .description("Portfolio solvency concentric gauge, gross assets, and net equity.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// 10. Stabilitas Pengeluaran (Spending Stability)
struct SpendingStabilityWidget: Widget {
    let kind: String = "SpendingStabilityWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                SpendingStabilitySmallView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Spending Stability")
        .description("Expense volatility variance index and daily burn average.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// ======================================================================
// MARK: - 5 LOCK SCREEN ACCESSORIES WIDGETS
// ======================================================================

// 1. Lock Screen: Net Worth Horizon & Inline
struct LockScreenNetWorthWidget: Widget {
    let kind: String = "LockScreenNetWorthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            LockScreenNetWorthEntryView(snapshot: entry.snapshot)
                .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Net Worth (Lock Screen)")
        .description("Smooth net worth curve and 24-hour delta percentage.")
        .supportedFamilies([.accessoryRectangular, .accessoryInline])
    }
}

struct LockScreenNetWorthEntryView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        if family == .accessoryInline {
            LockScreenInlineView(snapshot: snapshot)
        } else {
            LockScreenNetWorthRectView(snapshot: snapshot)
        }
    }
}

// 2. Lock Screen: Alokasi Portofolio
struct LockScreenPortfolioWidget: Widget {
    let kind: String = "LockScreenPortfolioWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            LockScreenPortfolioRectView(snapshot: entry.snapshot)
                .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Portfolio Allocation (Lock Screen)")
        .description("Concentric allocation ring: cash, investments, and physical assets.")
        .supportedFamilies([.accessoryRectangular])
    }
}

// 3. Lock Screen: Pill Card Savings Runway
struct LockScreenSavingsRunwayWidget: Widget {
    let kind: String = "LockScreenSavingsRunwayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            LockScreenSavingsRunwayRectView(snapshot: entry.snapshot)
                .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Savings Runway (Lock Screen)")
        .description("Emergency survival runway months indicator.")
        .supportedFamilies([.accessoryRectangular])
    }
}

// 4. Lock Screen: Pill Card Spending Stability
struct LockScreenSpendingStabilityWidget: Widget {
    let kind: String = "LockScreenSpendingStabilityWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            LockScreenSpendingStabilityRectView(snapshot: entry.snapshot)
                .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Spending Stability (Lock Screen)")
        .description("Daily expense average and volatility variance.")
        .supportedFamilies([.accessoryRectangular])
    }
}

// 5. Lock Screen: Catat Cepat (Pure Logo Icon)
struct LockScreenQuickLogWidget: Widget {
    let kind: String = "LockScreenQuickLogWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { _ in
            LockScreenQuickLogCircularView()
                .widgetURL(URL(string: "accrual://add"))
        }
        .configurationDisplayName("Quick Log (Lock Screen)")
        .description("1-tap pebble logo button for instant transaction entry.")
        .supportedFamilies([.accessoryCircular])
    }
}

// ======================================================================
// MARK: - iOS 18 LOCK SCREEN & CONTROL CENTER CONTROLS (Foto 4 & 5)
// ======================================================================
#if canImport(AppIntents)
import AppIntents

@available(iOS 18.0, *)
struct VoiceEntryControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Voice Entry"
    static var description = IntentDescription("Open Accrual voice recording modal")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        defaults.set("voice", forKey: "pending_intent_navigation")
        defaults.synchronize()
        return .result(opensIntent: OpenURLIntent(URL(string: "accrual://voice")!))
    }
}

@available(iOS 18.0, *)
struct ScanReceiptControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Scan Receipt"
    static var description = IntentDescription("Open Accrual camera scanner for receipts and invoices")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        defaults.set("scan", forKey: "pending_intent_navigation")
        defaults.synchronize()
        return .result(opensIntent: OpenURLIntent(URL(string: "accrual://scan")!))
    }
}

@available(iOS 18.0, *)
struct QuickAddControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Quick Add"
    static var description = IntentDescription("Open Accrual transaction entry keypad")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        defaults.set("add", forKey: "pending_intent_navigation")
        defaults.synchronize()
        return .result(opensIntent: OpenURLIntent(URL(string: "accrual://add")!))
    }
}

@available(iOS 18.0, *)
struct AccrualVoiceControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.syntheticae.accrual.control.voice") {
            ControlWidgetButton(action: VoiceEntryControlIntent()) {
                Label("Voice Entry", systemImage: "mic.fill")
            }
        }
        .displayName("Voice Entry")
        .description("Quickly dictate a transaction into Accrual.")
    }
}

@available(iOS 18.0, *)
struct AccrualScanControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.syntheticae.accrual.control.scan") {
            ControlWidgetButton(action: ScanReceiptControlIntent()) {
                Label("Scan Receipt", systemImage: "doc.viewfinder.fill")
            }
        }
        .displayName("Scan Receipt")
        .description("Instantly activate receipt camera scanner.")
    }
}

@available(iOS 18.0, *)
struct AccrualQuickAddControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.syntheticae.accrual.control.quickadd") {
            ControlWidgetButton(action: QuickAddControlIntent()) {
                Label("Quick Add", systemImage: "plus")
            }
        }
        .displayName("Quick Add")
        .description("Instantly open new transaction keypad in Accrual.")
    }
}
#endif
