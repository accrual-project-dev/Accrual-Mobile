import WidgetKit
import SwiftUI

// MARK: - Shared Timeline Provider
struct AccrualTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> AccrualEntry {
        AccrualEntry(date: Date(), snapshot: .emptyZero)
    }

    func getSnapshot(in context: Context, completion: @escaping (AccrualEntry) -> ()) {
        completion(AccrualEntry(date: Date(), snapshot: AccrualWidgetSnapshot.loadFromAppGroup()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AccrualEntry>) -> ()) {
        let snapshot = AccrualWidgetSnapshot.loadFromAppGroup()
        let now = Date()
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now
        completion(Timeline(entries: [AccrualEntry(date: now, snapshot: snapshot)], policy: .after(next)))
    }
}

struct AccrualEntry: TimelineEntry {
    let date: Date
    let snapshot: AccrualWidgetSnapshot
}

// MARK: - Adaptive Monochrome Shell
struct AccrualWidgetShell<Content: View>: View {
    @Environment(\.colorScheme) var colorScheme
    let snapshot: AccrualWidgetSnapshot
    var zeroPadding: Bool = false
    let content: (Bool) -> Content

    init(snapshot: AccrualWidgetSnapshot, zeroPadding: Bool = false, @ViewBuilder content: @escaping (Bool) -> Content) {
        self.snapshot = snapshot
        self.zeroPadding = zeroPadding
        self.content = content
    }

    var isDark: Bool {
        snapshot.forcedDark ?? (colorScheme == .dark)
    }

    var body: some View {
        ZStack(alignment: .top) {
            content(isDark)
                .padding(zeroPadding ? 0 : 14)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

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

// MARK: - Vector Shapes
struct FullBleedHorizonArcShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let start = CGPoint(x: 0, y: rect.height * 0.88)
        let end = CGPoint(x: rect.width, y: rect.height * 0.88)
        let control = CGPoint(x: rect.width * 0.5, y: -rect.height * 0.32)
        path.move(to: start)
        path.addQuadCurve(to: end, control: control)
        return path
    }

    static func pointOnQuadBezier(t: CGFloat, rect: CGRect) -> CGPoint {
        let p0 = CGPoint(x: 0, y: rect.height * 0.88)
        let p1 = CGPoint(x: rect.width * 0.5, y: -rect.height * 0.32)
        let p2 = CGPoint(x: rect.width, y: rect.height * 0.88)
        let mt = 1 - t
        let x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x
        let y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
        return CGPoint(x: x, y: y)
    }
}

struct SmoothAreaShape: Shape {
    let points: [Int]
    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard points.count > 1 else { return path }
        let step = rect.width / CGFloat(points.count - 1)
        let coords: [CGPoint] = points.enumerated().map { idx, val in
            CGPoint(
                x: CGFloat(idx) * step,
                y: rect.height - (CGFloat(val) / 100.0 * (rect.height - 8)) - 4
            )
        }
        path.move(to: CGPoint(x: 0, y: rect.height))
        path.addLine(to: coords[0])
        for i in 1..<coords.count {
            let prev = coords[i - 1]
            let curr = coords[i]
            let midX = (prev.x + curr.x) / 2
            path.addCurve(to: curr, control1: CGPoint(x: midX, y: prev.y), control2: CGPoint(x: midX, y: curr.y))
        }
        path.addLine(to: CGPoint(x: rect.width, y: rect.height))
        path.closeSubpath()
        return path
    }
}

struct SmoothLineShape: Shape {
    let points: [Int]
    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard points.count > 1 else { return path }
        let step = rect.width / CGFloat(points.count - 1)
        let coords: [CGPoint] = points.enumerated().map { idx, val in
            CGPoint(
                x: CGFloat(idx) * step,
                y: rect.height - (CGFloat(val) / 100.0 * (rect.height - 8)) - 4
            )
        }
        path.move(to: coords[0])
        for i in 1..<coords.count {
            let prev = coords[i - 1]
            let curr = coords[i]
            let midX = (prev.x + curr.x) / 2
            path.addCurve(to: curr, control1: CGPoint(x: midX, y: prev.y), control2: CGPoint(x: midX, y: curr.y))
        }
        return path
    }
}

// ======================================================================
// MARK: - 1. DAILY BURN PACE / SAFE TO SPEND (Full-Bleed Horizon Arc - S/M/L)
// ======================================================================
struct SafeToSpendAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var t: CGFloat {
        min(0.94, max(0.06, CGFloat(snapshot.safeDailyBurnPacePercent) / 100.0))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                HStack(spacing: 6) {
                    Circle()
                        .fill(AccrualTheme.fillSubtle(isDark: isDark))
                        .frame(width: 20, height: 20)
                        .overlay(
                            Image(systemName: "flame.fill")
                                .font(.system(size: 9.5, weight: .bold))
                                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        )
                    Text(snapshot.isIndo ? "Ritme Harian" : "Burn Pace")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)

            Spacer(minLength: 2)

            GeometryReader { geo in
                let orbPt = FullBleedHorizonArcShape.pointOnQuadBezier(t: t, rect: geo.frame(in: .local))
                ZStack {
                    FullBleedHorizonArcShape()
                        .stroke(
                            (isDark ? Color.white : Color.black).opacity(0.14),
                            style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                        )

                    FullBleedHorizonArcShape()
                        .trim(from: 0, to: t)
                        .stroke(
                            isDark ? Color.white : Color.black,
                            style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                        )

                    Circle()
                        .fill((isDark ? Color.white : Color.black).opacity(0.24))
                        .frame(width: 18, height: 18)
                        .position(orbPt)

                    Circle()
                        .fill(isDark ? Color.white : Color.black)
                        .frame(width: 9, height: 9)
                        .position(orbPt)

                    VStack(spacing: 2) {
                        Text(snapshot.isIndo ? "Kuota harian terpakai" : "Your daily burn level")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))

                        Text("\(snapshot.safeDailyBurnPacePercent)%")
                            .font(.system(size: family == .systemSmall ? 24 : 30, weight: .bold, design: .rounded))
                            .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))

                        Text(snapshot.safeDailyBurnPaceStatus)
                            .font(.system(size: 9.5, weight: .semibold))
                            .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 2.5)
                            .background(AccrualTheme.fillSubtle(isDark: isDark))
                            .cornerRadius(99)
                    }
                    .offset(y: 12)
                }
            }
            .frame(height: family == .systemSmall ? 84 : 96)

            if family == .systemLarge {
                VStack(spacing: 8) {
                    HStack(spacing: 6) {
                        LargeKpiTile(label: snapshot.isIndo ? "KUOTA HARI INI" : "DAILY QUOTA", value: snapshot.safeDailyQuota, isDark: isDark)
                        LargeKpiTile(label: snapshot.isIndo ? "TERPAKAI" : "SPENT TODAY", value: snapshot.safeSpentToday, isDark: isDark)
                        LargeKpiTile(label: snapshot.isIndo ? "SISA AMAN" : "SAFE LEFT", value: snapshot.safeSafeToSpendDaily, isDark: isDark)
                    }
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(snapshot.isIndo ? "Sisa Anggaran Bulan Ini" : "Monthly Budget Remaining")
                                .font(.system(size: 9.5, weight: .medium))
                                .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                            Text("\(snapshot.safeSafeToSpendRemaining) / \(snapshot.safeSafeToSpendBudget)")
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        }
                        Spacer()
                        Text("\(snapshot.safeDaysLeftInMonth) \(snapshot.isIndo ? "hr tersisa" : "days left")")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(AccrualTheme.fillSubtle(isDark: isDark))
                            .cornerRadius(8)
                    }
                    .padding(10)
                    .background(AccrualTheme.fillSubtle(isDark: isDark))
                    .cornerRadius(12)
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 12)
            } else {
                HStack {
                    Text("\(snapshot.isIndo ? "Sisa" : "Left"): \(snapshot.safeSafeToSpendDaily)")
                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                    Spacer()
                    Text("\(snapshot.safeDaysLeftInMonth) \(snapshot.isIndo ? "hr" : "d")")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 10)
            }
        }
    }
}

struct LargeKpiTile: View {
    let label: String
    let value: String
    let isDark: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 7.5, weight: .bold))
                .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                .lineLimit(1)
            Text(value)
                .font(.system(size: 10.5, weight: .bold, design: .rounded))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AccrualTheme.fillSubtle(isDark: isDark))
        .cornerRadius(10)
    }
}

// ======================================================================
// MARK: - 2. TOTAL BALANCE / NET WORTH HORIZON (Full-Bleed Area Curve - S/M/L)
// ======================================================================
struct NetWorthHorizonAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(snapshot.isIndo ? "Total kekayaan" : "Total balance")
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                    Spacer()
                    Text(snapshot.currencySymbol)
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(AccrualTheme.fillSubtle(isDark: isDark))
                        .cornerRadius(99)
                }

                Text(snapshot.netWorthFormatted)
                    .font(.system(size: family == .systemSmall ? 19 : 25, weight: .bold, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                HStack(spacing: 6) {
                    Text(snapshot.safeNetCashflow)
                        .font(.system(size: 9.5, weight: .semibold, design: .rounded))
                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                    HStack(spacing: 2.5) {
                        Image(systemName: snapshot.isPositive24h ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 7.5, weight: .bold))
                        Text(snapshot.change24hFormatted)
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                    }
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(AccrualTheme.fillSubtle(isDark: isDark))
                    .cornerRadius(99)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)

            if family == .systemLarge {
                HStack(spacing: 6) {
                    LargeKpiTile(label: snapshot.isIndo ? "KAS LIKUID" : "LIQUID CASH", value: snapshot.safeLiquidCash, isDark: isDark)
                    LargeKpiTile(label: snapshot.isIndo ? "PEMASUKAN" : "INFLOW", value: snapshot.safeMonthlyInflow, isDark: isDark)
                    LargeKpiTile(label: snapshot.isIndo ? "PENGELUARAN" : "OUTFLOW", value: snapshot.safeMonthlyOutflow, isDark: isDark)
                }
                .padding(.horizontal, 14)
                .padding(.top, 10)
            }

            Spacer(minLength: 4)

            ZStack(alignment: .bottom) {
                SmoothAreaShape(points: snapshot.sparkline)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                (isDark ? Color.white : Color.black).opacity(0.24),
                                (isDark ? Color.white : Color.black).opacity(0.02)
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: family == .systemLarge ? 120 : 64)

                SmoothLineShape(points: snapshot.sparkline)
                    .stroke(
                        isDark ? Color.white : Color.black,
                        style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round)
                    )
                    .frame(height: family == .systemLarge ? 120 : 64)

                HStack(spacing: 14) {
                    Text("24H")
                        .font(.system(size: 8.5, weight: .semibold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    Text("7D")
                        .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background((isDark ? Color.black : Color.white).opacity(0.75))
                        .cornerRadius(99)
                    Text("30D")
                        .font(.system(size: 8.5, weight: .semibold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                }
                .padding(.bottom, 8)
            }
        }
    }
}

// ======================================================================
// MARK: - 3. SINGLE-TRACK GAPPED DONUT (Zero Dummy Slices - S/M/L)
// ======================================================================
struct PortfolioAllocationAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        let cats = snapshot.safeTopCategories
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(snapshot.isIndo ? "PENGELUARAN" : "EXPENSES")
                    .font(.system(size: 8.5, weight: .bold))
                    .tracking(0.8)
                    .foregroundColor(isDark ? Color.black : Color.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(isDark ? Color.white : Color.black)
                    .cornerRadius(99)
                Spacer()
                Text(snapshot.safeMonthShortName)
                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
            }

            Spacer(minLength: 0)

            HStack(spacing: 14) {
                ZStack {
                    if cats.isEmpty {
                        Circle()
                            .stroke(AccrualTheme.fillSubtle(isDark: isDark), lineWidth: 8.5)
                    } else {
                        let gap: Double = cats.count > 1 ? 0.03 : 0.0
                        let p0 = Double(cats.indices.contains(0) ? cats[0].pct : 0) / 100.0
                        let p1 = Double(cats.indices.contains(1) ? cats[1].pct : 0) / 100.0
                        let p2 = Double(cats.indices.contains(2) ? cats[2].pct : 0) / 100.0

                        Circle()
                            .stroke(AccrualTheme.fillSubtle(isDark: isDark), lineWidth: 8.5)

                        if p0 > 0 {
                            Circle()
                                .trim(from: 0, to: max(0.02, p0 - gap))
                                .stroke(isDark ? Color.white : Color.black, style: StrokeStyle(lineWidth: 8.5, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                        }
                        if p1 > 0 {
                            Circle()
                                .trim(from: p0, to: max(p0 + 0.02, p0 + p1 - gap))
                                .stroke((isDark ? Color.white : Color.black).opacity(0.62), style: StrokeStyle(lineWidth: 8.5, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                        }
                        if p2 > 0 {
                            Circle()
                                .trim(from: p0 + p1, to: max(p0 + p1 + 0.02, p0 + p1 + p2 - gap))
                                .stroke((isDark ? Color.white : Color.black).opacity(0.36), style: StrokeStyle(lineWidth: 8.5, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                        }
                        if cats.count > 3 {
                            Circle()
                                .trim(from: p0 + p1 + p2, to: max(p0 + p1 + p2 + 0.02, 1.0 - gap))
                                .stroke((isDark ? Color.white : Color.black).opacity(0.18), style: StrokeStyle(lineWidth: 8.5, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                        }
                    }

                    VStack(spacing: 1) {
                        Text(snapshot.safeMonthlyOutflow)
                            .font(.system(size: 10.5, weight: .bold, design: .rounded))
                            .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .padding(.horizontal, 6)
                        Text("Total")
                            .font(.system(size: 7.5, weight: .medium))
                            .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    }
                }
                .frame(width: family == .systemLarge ? 105 : 76, height: family == .systemLarge ? 105 : 76)

                if family != .systemSmall {
                    if cats.isEmpty {
                        Text(snapshot.isIndo ? "Belum ada pengeluaran bulan ini" : "No expenses recorded this month")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        VStack(alignment: .leading, spacing: 5) {
                            ForEach(Array(cats.prefix(4).enumerated()), id: \.offset) { idx, item in
                                let opacities: [Double] = [1.0, 0.65, 0.40, 0.22]
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill((isDark ? Color.white : Color.black).opacity(opacities[idx % 4]))
                                        .frame(width: 6, height: 6)
                                    Text(item.name)
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                                        .lineLimit(1)
                                    Spacer()
                                    Text("\(item.pct)%")
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                                }
                            }
                        }
                    }
                }
            }

            if family == .systemLarge && !cats.isEmpty {
                VStack(spacing: 5) {
                    ForEach(Array(cats.prefix(3).enumerated()), id: \.offset) { _, item in
                        HStack {
                            Text(item.name)
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                            Spacer()
                            Text(item.amountFormatted)
                                .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(AccrualTheme.fillSubtle(isDark: isDark))
                        .cornerRadius(8)
                    }
                }
            }

            Spacer(minLength: 0)
        }
    }
}

// ======================================================================
// MARK: - 4. LIQUID CASH RUNWAY (Full-Bleed Sparkline - S/M/L)
// ======================================================================
struct LiquidCashAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 5) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.system(size: 9.5, weight: .semibold))
                    Text(snapshot.isIndo ? "Kas Likuid" : "Liquid Cash")
                        .font(.system(size: 10.5, weight: .semibold))
                    Spacer()
                }
                .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                Text(snapshot.safeLiquidCash)
                    .font(.system(size: family == .systemSmall ? 18 : 22, weight: .bold, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                HStack(spacing: 3) {
                    Image(systemName: snapshot.safeIsLiquidCashPositive ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 7.5, weight: .bold))
                    Text(snapshot.safeLiquidCashChange)
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                }
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                .padding(.horizontal, 6)
                .padding(.vertical, 2.5)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(6)
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)

            if family == .systemLarge {
                HStack(spacing: 6) {
                    LargeKpiTile(label: snapshot.isIndo ? "RUNWAY KAS" : "CASH RUNWAY", value: "\(String(format: "%.1f", snapshot.safeRunwayMonths)) bln", isDark: isDark)
                    LargeKpiTile(label: snapshot.isIndo ? "BURN HARIAN" : "DAILY BURN", value: snapshot.safeDailyBurn, isDark: isDark)
                }
                .padding(.horizontal, 14)
                .padding(.top, 10)
            }

            Spacer(minLength: 4)

            ZStack(alignment: .bottomTrailing) {
                SmoothAreaShape(points: snapshot.safeLiquidCashSparkline)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                (isDark ? Color.white : Color.black).opacity(0.20),
                                (isDark ? Color.white : Color.black).opacity(0.01)
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: family == .systemLarge ? 110 : 44)

                SmoothLineShape(points: snapshot.safeLiquidCashSparkline)
                    .stroke(
                        isDark ? Color.white : Color.black,
                        style: StrokeStyle(lineWidth: 2.0, lineCap: .round, lineJoin: .round)
                    )
                    .frame(height: family == .systemLarge ? 110 : 44)
            }
        }
    }
}

// ======================================================================
// MARK: - 5. MONTHLY CASHFLOW & 28-DAY HEATMAP MATRIX (S/M/L)
// ======================================================================
struct MonthlyCashflowHeatmapAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    private func cellColor(dot: WidgetHeatmapDot) -> Color {
        let base = isDark ? Color.white : Color.black
        guard dot.hasSpend else { return base.opacity(0.07) }
        return base.opacity(max(0.28, min(1.0, dot.intensity)))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.left.arrow.right")
                            .font(.system(size: 9, weight: .bold))
                        Text(snapshot.isIndo ? "Arus Kas" : "Cashflow")
                            .font(.system(size: 10.5, weight: .semibold))
                    }
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

                    Text(snapshot.safeNetCashflow)
                        .font(.system(size: family == .systemSmall ? 17 : 21, weight: .bold, design: .rounded))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)

                    HStack(spacing: 3) {
                        Image(systemName: snapshot.safeIsCashflowDeltaPositive ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 7.5, weight: .bold))
                        Text(snapshot.safeCashflowDeltaVsLastMonth)
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                    }
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(AccrualTheme.fillSubtle(isDark: isDark))
                    .cornerRadius(6)

                    if family != .systemSmall {
                        Spacer(minLength: 2)
                        Text("\(snapshot.isIndo ? "Masuk" : "In"): \(snapshot.safeMonthlyInflow) • \(snapshot.isIndo ? "Keluar" : "Out"): \(snapshot.safeMonthlyOutflow)")
                            .font(.system(size: 8.5, weight: .medium, design: .monospaced))
                            .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                }

                if family != .systemSmall {
                    Spacer(minLength: 2)
                    VStack(alignment: .trailing, spacing: 4) {
                        Text(snapshot.safeMonthShortName)
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))

                        HStack(spacing: 3.5) {
                            ForEach(0..<4, id: \.self) { col in
                                VStack(spacing: 3.5) {
                                    ForEach(0..<7, id: \.self) { row in
                                        let idx = col * 7 + row
                                        let dot = idx < snapshot.safeHeatmapDots.count
                                            ? snapshot.safeHeatmapDots[idx]
                                            : WidgetHeatmapDot(intensity: 0, hasSpend: false)
                                        RoundedRectangle(cornerRadius: 2.5)
                                            .fill(cellColor(dot: dot))
                                            .frame(width: 10, height: 10)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 2.5)
                                                    .stroke(isDark ? Color.white : Color.black, lineWidth: (dot.isToday ?? false) ? 1.2 : 0)
                                            )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if family == .systemLarge {
                Divider().background(AccrualTheme.cardBorder(isDark: isDark))
                HStack(spacing: 6) {
                    LargeKpiTile(label: snapshot.isIndo ? "HARI AKTIF" : "ACTIVE DAYS", value: "\(snapshot.safeActiveDaysCount) / 28 hr", isDark: isDark)
                    LargeKpiTile(label: snapshot.isIndo ? "BEBAS BELANJA" : "NO-SPEND DAYS", value: "\(snapshot.safeNoSpendDaysCount) hr", isDark: isDark)
                    LargeKpiTile(label: snapshot.isIndo ? "RATA-RATA" : "DAILY AVG", value: snapshot.safeDailyAverage, isDark: isDark)
                }
            }
        }
    }
}

// ======================================================================
// MARK: - 6. CAPPED VERTICAL PILLAR BARS (S/M/L)
// ======================================================================
struct CapitalHealthPillarAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        let bars = snapshot.safeCashflowBars
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(snapshot.isIndo ? "PERFORMA MODAL" : "PERFORMANCE")
                    .font(.system(size: 8.5, weight: .bold))
                    .tracking(0.8)
                    .foregroundColor(isDark ? Color.black : Color.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2.5)
                    .background(isDark ? Color.white : Color.black)
                    .cornerRadius(99)
                Spacer()
                Text("\(snapshot.safeCapitalHealthScore)/100")
                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
            }

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(snapshot.safeCapitalHealthTier)
                    .font(.system(size: family == .systemSmall ? 20 : 24, weight: .bold, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                Text("\(snapshot.isIndo ? "Solvensi" : "Solvency") \(snapshot.safeSolvencyScore)%")
                    .font(.system(size: 9.5, weight: .medium))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
            }

            Spacer(minLength: 2)

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(bars.prefix(6).enumerated()), id: \.offset) { _, val in
                    VStack(spacing: 2) {
                        Capsule()
                            .fill(isDark ? Color.white : Color.black)
                            .frame(height: 3)
                        RoundedRectangle(cornerRadius: 4)
                            .fill((isDark ? Color.white : Color.black).opacity(val >= 80 ? 0.55 : 0.25))
                            .frame(height: max(8, CGFloat(val) * (family == .systemLarge ? 1.1 : 0.52)))
                    }
                    .frame(maxWidth: .infinity)
                }
            }

            if family == .systemLarge {
                HStack(spacing: 6) {
                    LargeKpiTile(label: snapshot.isIndo ? "RASIO TABUNGAN" : "SAVINGS RATE", value: "\(snapshot.safeSavingsRate)%", isDark: isDark)
                    LargeKpiTile(label: snapshot.isIndo ? "RUNWAY LIKUID" : "LIQUID RUNWAY", value: "\(String(format: "%.1f", snapshot.safeRunwayMonths)) bln", isDark: isDark)
                }
                .padding(.top, 4)
            }
        }
    }
}

// ======================================================================
// MARK: - 7. BALANCE SHEET PROPORTION BAR (S/M/L)
// ======================================================================
struct BalanceSheetProportionAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(snapshot.isIndo ? "STRUKTUR NERACA" : "BALANCE SHEET")
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.8)
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                Spacer()
                Text("\(snapshot.isIndo ? "Solvensi" : "Solvency") \(snapshot.safeSolvencyScore)%")
                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
            }

            GeometryReader { geo in
                let w = geo.size.width
                let lW = max(8, w * CGFloat(snapshot.safeLiquidPct / 100.0))
                let gW = max(8, w * CGFloat(snapshot.safeGrowthPct / 100.0))
                HStack(spacing: 3) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(isDark ? Color.white : Color.black)
                        .frame(width: lW)
                    RoundedRectangle(cornerRadius: 4)
                        .fill((isDark ? Color.white : Color.black).opacity(0.48))
                        .frame(width: gW)
                    RoundedRectangle(cornerRadius: 4)
                        .fill((isDark ? Color.white : Color.black).opacity(0.18))
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 10)

            Spacer(minLength: 0)

            VStack(spacing: 5) {
                BalanceMetricRow(label: snapshot.isIndo ? "Aset Kotor" : "Gross Assets", value: snapshot.safeGrossAssets, isDark: isDark)
                BalanceMetricRow(label: snapshot.isIndo ? "Liabilitas" : "Liabilities", value: snapshot.safeLiabilities, isDark: isDark)
                Divider().background(AccrualTheme.cardBorder(isDark: isDark))
                BalanceMetricRow(label: snapshot.isIndo ? "Ekuitas Bersih" : "Net Equity", value: snapshot.safeNetEquity, isDark: isDark, isBold: true)
            }
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
                .font(.system(size: 10, weight: isBold ? .bold : .semibold, design: .monospaced))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                .lineLimit(1)
        }
    }
}

// ======================================================================
// MARK: - 8. DUAL WAVE COMPARISON (S/M/L)
// ======================================================================
struct DualWaveStabilityAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(snapshot.isIndo ? "Komparasi Ritme" : "Pace Comparison")
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    Spacer()
                    Text(snapshot.safeSpendingStatus)
                        .font(.system(size: 8.5, weight: .bold))
                        .foregroundColor(isDark ? Color.black : Color.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(isDark ? Color.white : Color.black)
                        .cornerRadius(99)
                }

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(snapshot.safeWeekDelta)
                        .font(.system(size: family == .systemSmall ? 22 : 26, weight: .bold, design: .rounded))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                    Text(snapshot.isIndo ? "vs pekan lalu" : "vs last week")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)

            Spacer(minLength: 4)

            ZStack {
                SmoothLineShape(points: snapshot.safeLastWeekWave)
                    .stroke(
                        (isDark ? Color.white : Color.black).opacity(0.32),
                        style: StrokeStyle(lineWidth: 1.6, lineCap: .round, dash: [4, 4])
                    )
                    .frame(height: family == .systemLarge ? 110 : 52)

                SmoothLineShape(points: snapshot.safeThisWeekWave)
                    .stroke(
                        isDark ? Color.white : Color.black,
                        style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round)
                    )
                    .frame(height: family == .systemLarge ? 110 : 52)
            }
            .padding(.bottom, 10)
        }
    }
}

// ======================================================================
// MARK: - 9. EDITORIAL VELOCITY INSIGHT (S/M/L)
// ======================================================================
struct VelocityInsightAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(isDark ? Color.white : Color.black)
                        .frame(width: 18, height: 18)
                        .overlay(
                            Image(systemName: "sparkles")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(isDark ? Color.black : Color.white)
                        )
                    Text("Insight")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                }
                Spacer()
                Text(snapshot.safeSpaceName)
                    .font(.system(size: 8.5, weight: .semibold))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2.5)
                    .background(AccrualTheme.fillSubtle(isDark: isDark))
                    .cornerRadius(99)
            }

            Spacer(minLength: 2)

            HStack(alignment: .top, spacing: 4) {
                Text(snapshot.safeInsightPct)
                    .font(.system(size: family == .systemSmall ? 34 : 42, weight: .light, design: .rounded))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                    .padding(.top, 6)
            }

            Text(snapshot.safeInsightTitle)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                .lineLimit(2)

            if family != .systemSmall && !snapshot.safeInsightSubtitle.isEmpty {
                Text(snapshot.safeInsightSubtitle)
                    .font(.system(size: 9.5, weight: .regular))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    .lineLimit(2)
            }

            Spacer(minLength: 2)

            HStack(spacing: 5) {
                ForEach(0..<5, id: \.self) { idx in
                    Capsule()
                        .fill((isDark ? Color.white : Color.black).opacity(idx == 1 ? 1.0 : 0.22))
                        .frame(height: 3)
                }
            }
        }
    }
}

// ======================================================================
// MARK: - 10. SUBSCRIPTION & DRAFT RADAR (Zero Dummy Bills - S/M/L)
// ======================================================================
struct SubscriptionRadarAdaptiveView: View {
    @Environment(\.widgetFamily) var family
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool

    var body: some View {
        let bills = snapshot.safeUpcomingBills
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(snapshot.isIndo ? "TAGIHAN & DRAFT" : "BILLS & DRAFTS")
                    .font(.system(size: 8.5, weight: .bold))
                    .tracking(0.8)
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                Spacer()
                if snapshot.safeDraftCount > 0 {
                    Text("\(snapshot.safeDraftCount) Draft")
                        .font(.system(size: 8.5, weight: .bold))
                        .foregroundColor(isDark ? Color.black : Color.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(isDark ? Color.white : Color.black)
                        .cornerRadius(99)
                }
            }

            Text("\(snapshot.safeActiveSubsCount) \(snapshot.isIndo ? "tagihan aktif" : "active bills")")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))

            Text(snapshot.safeActiveSubsTotal)
                .font(.system(size: family == .systemSmall ? 20 : 24, weight: .bold, design: .rounded))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            Spacer(minLength: 2)

            if let first = bills.first {
                HStack {
                    Text("\(first.title) • \(first.amountFormatted)")
                        .font(.system(size: 9.5, weight: .semibold))
                        .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                        .lineLimit(1)
                    Spacer()
                    Text(first.dueLabel)
                        .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                        .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
                }
                .padding(8)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(8)
            } else {
                HStack {
                    Text(snapshot.isIndo ? "Tidak ada tagihan jatuh tempo" : "No upcoming bills due")
                        .font(.system(size: 9.5, weight: .medium))
                        .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                    Spacer()
                }
                .padding(8)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(8)
            }
        }
    }
}

// ======================================================================
// MARK: - 11. SAVINGS RATE, 28-DAY MATRIX & QUICK LOG STATION
// ======================================================================
struct SavingsRateRingSmallView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "arrow.up.right.circle.fill")
                    .font(.system(size: 12, weight: .bold))
                Spacer()
                Text("Target \(snapshot.safeSavingsTarget)%")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
            }
            Spacer()
            Text("↗ \(snapshot.safeSavingsRate)%")
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
            Text(snapshot.isIndo ? "Rasio Tabungan" : "Savings Rate")
                .font(.system(size: 9.5, weight: .medium))
                .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
            Spacer()
            Text(snapshot.safeMonthlySavings)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(99)
        }
    }
}

struct ActivityMatrixSmallView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool
    let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(snapshot.isIndo ? "MATRIKS 28 HARI" : "28-DAY MATRIX")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.8)
                .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
            Spacer()
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(Array(snapshot.safeHeatmapDots.prefix(28).enumerated()), id: \.offset) { _, dot in
                    RoundedRectangle(cornerRadius: 2.5)
                        .fill((isDark ? Color.white : Color.black).opacity(dot.hasSpend ? max(0.3, dot.intensity) : 0.08))
                        .frame(width: 10, height: 10)
                }
            }
            Spacer()
            HStack {
                Text(snapshot.isIndo ? "Bebas Belanja" : "No-Spend")
                    .font(.system(size: 8.5, weight: .medium))
                    .foregroundColor(AccrualTheme.textTertiary(isDark: isDark))
                Spacer()
                Text("\(snapshot.safeNoSpendDaysCount)/28 hr")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
            }
        }
    }
}

struct QuickLogStationSmallView: View {
    let snapshot: AccrualWidgetSnapshot
    let isDark: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(snapshot.isIndo ? "AKSI 1-KETUKAN" : "1-TAP ACTIONS")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.8)
                .foregroundColor(AccrualTheme.textSecondary(isDark: isDark))
            Spacer()
            Link(destination: URL(string: "accrual://add")!) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text(snapshot.isIndo ? "Catat Cepat" : "Quick Add")
                        .font(.system(size: 10, weight: .semibold))
                    Spacer()
                }
                .foregroundColor(isDark ? Color.black : Color.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(isDark ? Color.white : Color.black)
                .cornerRadius(8)
            }
            Link(destination: URL(string: "accrual://scan")!) {
                HStack {
                    Image(systemName: "doc.viewfinder.fill")
                    Text(snapshot.isIndo ? "Pindai Struk" : "Scan Receipt")
                        .font(.system(size: 10, weight: .semibold))
                    Spacer()
                }
                .foregroundColor(AccrualTheme.textPrimary(isDark: isDark))
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(AccrualTheme.fillSubtle(isDark: isDark))
                .cornerRadius(8)
            }
        }
    }
}

// ======================================================================
// MARK: - LOCK SCREEN ACCESSORIES (Text + Micro-Chart + Contextual Insight)
// ======================================================================
struct LockScreenInlineView: View {
    let snapshot: AccrualWidgetSnapshot
    var body: some View {
        Text("\(snapshot.isIndo ? "Sisa Hari Ini" : "Safe Today"): \(snapshot.safeSafeToSpendDaily) (\(snapshot.safeDailyBurnPacePercent)%)")
    }
}

struct LockScreenNetWorthRectView: View {
    let snapshot: AccrualWidgetSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(snapshot.isIndo ? "SISA AMAN HARI INI" : "SAFE TO SPEND TODAY")
                    .font(.system(size: 8.5, weight: .bold))
                Spacer()
                Text("\(snapshot.safeDailyBurnPacePercent)%")
                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
            }
            Text(snapshot.safeSafeToSpendDaily)
                .font(.system(size: 14.5, weight: .bold, design: .rounded))
                .lineLimit(1)
            ProgressView(value: min(1.0, Double(snapshot.safeDailyBurnPacePercent) / 100.0))
                .progressViewStyle(.linear)
            Text("✦ \(snapshot.safeLockInsightLine)")
                .font(.system(size: 8, weight: .medium))
                .lineLimit(1)
                .opacity(0.85)
        }
    }
}

struct LockScreenPortfolioRectView: View {
    let snapshot: AccrualWidgetSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(snapshot.isIndo ? "ARUS KAS & RITME" : "CASHFLOW & PACE")
                    .font(.system(size: 8.5, weight: .bold))
                Spacer()
                Text(snapshot.safeCashflowDeltaVsLastMonth)
                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
            }
            Text(snapshot.safeNetCashflow)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .lineLimit(1)
            SmoothLineShape(points: snapshot.sparkline)
                .stroke(Color.primary, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                .frame(height: 10)
            Text("✦ \(snapshot.safeInsightSubtitle)")
                .font(.system(size: 8, weight: .medium))
                .lineLimit(1)
                .opacity(0.85)
        }
    }
}

struct LockScreenSavingsRunwayRectView: View {
    let snapshot: AccrualWidgetSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(snapshot.isIndo ? "KETAHANAN KAS" : "CASH RUNWAY")
                    .font(.system(size: 8.5, weight: .bold))
                Spacer()
                Text("\(snapshot.safeSolvencyScore)% Solv")
                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
            }
            Text("\(String(format: "%.1f", snapshot.safeRunwayMonths)) \(snapshot.isIndo ? "Bulan" : "Months") • \(snapshot.safeLiquidCash)")
                .font(.system(size: 12.5, weight: .bold, design: .rounded))
                .lineLimit(1)
            ProgressView(value: min(1.0, snapshot.safeRunwayMonths / 12.0))
                .progressViewStyle(.linear)
            Text("✦ \(snapshot.isIndo ? "Rata-rata" : "Avg") \(snapshot.safeDailyAverage)")
                .font(.system(size: 8, weight: .medium))
                .lineLimit(1)
                .opacity(0.85)
        }
    }
}

struct LockScreenSpendingStabilityRectView: View {
    let snapshot: AccrualWidgetSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(snapshot.isIndo ? "RADAR TAGIHAN & DRAFT" : "BILLS & DRAFTS")
                    .font(.system(size: 8.5, weight: .bold))
                Spacer()
                Text("\(snapshot.safeDraftCount) Draft")
                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
            }
            Text("\(snapshot.safeActiveSubsCount) \(snapshot.isIndo ? "Tagihan" : "Bills") • \(snapshot.safeActiveSubsTotal)")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .lineLimit(1)
            if let first = snapshot.safeUpcomingBills.first {
                Text("✦ \(first.title) (\(first.dueLabel)) • \(first.amountFormatted)")
                    .font(.system(size: 8, weight: .medium))
                    .lineLimit(1)
                    .opacity(0.85)
            } else {
                Text("✦ \(snapshot.isIndo ? "Tidak ada tagihan jatuh tempo" : "No upcoming bills due")")
                    .font(.system(size: 8, weight: .medium))
                    .lineLimit(1)
                    .opacity(0.85)
            }
        }
    }
}

struct LockScreenQuickLogCircularView: View {
    var body: some View {
        ZStack {
            Circle().stroke(Color.primary.opacity(0.22), lineWidth: 2.5)
            AccrualZenLogoIcon(size: 26).foregroundColor(.primary)
        }
        .widgetURL(URL(string: "accrual://add"))
    }
}

// ======================================================================
// MARK: - WIDGET CONFIGURATIONS (All Support Small, Medium, Large)
// ======================================================================
struct SafeToSpendWidget: Widget {
    let kind: String = "SafeToSpendWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot, zeroPadding: true) { isDark in
                SafeToSpendAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Daily Burn Pace")
        .description("Full-bleed horizon arc with glowing orb and daily safe-to-spend telemetry.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct NetWorthHorizonWidget: Widget {
    let kind: String = "NetWorthHorizonWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot, zeroPadding: true) { isDark in
                NetWorthHorizonAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Total Balance Curve")
        .description("Edge-to-edge monochrome area curve with net worth and cashflow telemetry.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct PortfolioAllocationWidget: Widget {
    let kind: String = "PortfolioAllocationWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                PortfolioAllocationAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Expense Donut")
        .description("Single-track gapped monochrome donut with top spending categories.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct LiquidCashRunwayWidget: Widget {
    let kind: String = "LiquidCashRunwayWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot, zeroPadding: true) { isDark in
                LiquidCashAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Liquid Cash Curve")
        .description("Real liquid cash position with full-bleed 7-day curve.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct MonthlyCashflowBarWidget: Widget {
    let kind: String = "MonthlyCashflowBarWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                MonthlyCashflowHeatmapAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Cashflow & Heatmap")
        .description("Monthly net cashflow delta paired with 28-day spend heatmap matrix.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct CapitalHealthWidget: Widget {
    let kind: String = "CapitalHealthWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                CapitalHealthPillarAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Capital Performance Pillars")
        .description("Capped vertical pillar bars with capital health and solvency score.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct BalanceSheetWidget: Widget {
    let kind: String = "BalanceSheetWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                BalanceSheetProportionAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Balance Sheet Bar")
        .description("Segmented proportion bar with gross assets, liabilities, and net equity.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct SpendingStabilityWidget: Widget {
    let kind: String = "SpendingStabilityWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot, zeroPadding: true) { isDark in
                DualWaveStabilityAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Dual Wave Pace")
        .description("Full-bleed solid vs dashed dual wave comparing this week against last week.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct VelocityInsightWidget: Widget {
    let kind: String = "VelocityInsightWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                VelocityInsightAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Executive Forecast Insight")
        .description("Editorial typography forecast card with monochrome spotlight and stepper.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct SubscriptionRadarWidget: Widget {
    let kind: String = "SubscriptionRadarWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                SubscriptionRadarAdaptiveView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://bills"))
        }
        .configurationDisplayName("Bills & Draft Radar")
        .description("Upcoming recurring bills countdown and pending shortcut draft counter.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct SavingsRateRingWidget: Widget {
    let kind: String = "SavingsRateRingWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                SavingsRateRingSmallView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Savings Velocity")
        .description("Monthly savings rate velocity card.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

struct ActivityMatrixWidget: Widget {
    let kind: String = "ActivityMatrixWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                ActivityMatrixSmallView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://transactions"))
        }
        .configurationDisplayName("28-Day Heatmap")
        .description("28-day spending intensity matrix and no-spend day counter.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

struct QuickLogStationWidget: Widget {
    let kind: String = "QuickLogStationWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            AccrualWidgetShell(snapshot: entry.snapshot) { isDark in
                QuickLogStationSmallView(snapshot: entry.snapshot, isDark: isDark)
            }
            .widgetURL(URL(string: "accrual://add"))
        }
        .configurationDisplayName("Quick Action Station")
        .description("1-tap launcher for quick entry and receipt scanner.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// MARK: - Lock Screen Widgets
struct LockScreenNetWorthWidget: Widget {
    let kind: String = "LockScreenNetWorthWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            LockScreenNetWorthEntryView(snapshot: entry.snapshot)
                .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Safe to Spend & Insight")
        .description("Daily safe-to-spend limit, progress bar, and contextual insight.")
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

struct LockScreenPortfolioWidget: Widget {
    let kind: String = "LockScreenPortfolioWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            LockScreenPortfolioRectView(snapshot: entry.snapshot)
                .widgetURL(URL(string: "accrual://statistics"))
        }
        .configurationDisplayName("Cashflow & Curve")
        .description("Monthly net cashflow, sparkline curve, and efficiency insight.")
        .supportedFamilies([.accessoryRectangular])
    }
}

struct LockScreenSavingsRunwayWidget: Widget {
    let kind: String = "LockScreenSavingsRunwayWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            LockScreenSavingsRunwayRectView(snapshot: entry.snapshot)
                .widgetURL(URL(string: "accrual://assets"))
        }
        .configurationDisplayName("Runway & Daily Burn")
        .description("Cash survival runway months, gauge bar, and daily average.")
        .supportedFamilies([.accessoryRectangular])
    }
}

struct LockScreenSpendingStabilityWidget: Widget {
    let kind: String = "LockScreenSpendingStabilityWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { entry in
            LockScreenSpendingStabilityRectView(snapshot: entry.snapshot)
                .widgetURL(URL(string: "accrual://bills"))
        }
        .configurationDisplayName("Bills & Drafts Radar")
        .description("Upcoming recurring bills countdown and pending shortcut drafts.")
        .supportedFamilies([.accessoryRectangular])
    }
}

struct LockScreenQuickLogWidget: Widget {
    let kind: String = "LockScreenQuickLogWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AccrualTimelineProvider()) { _ in
            LockScreenQuickLogCircularView()
                .widgetURL(URL(string: "accrual://add"))
        }
        .configurationDisplayName("1-Tap Quick Log")
        .description("Instant transaction entry launcher from Lock Screen.")
        .supportedFamilies([.accessoryCircular])
    }
}

// MARK: - iOS 18 Control Center Controls
#if canImport(AppIntents)
import AppIntents

@available(iOS 18.0, *)
struct VoiceEntryControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Voice Entry"
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool { false }
    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        let defaults = UserDefaults(suiteName: "group.com.syntheticae.accrual") ?? .standard
        defaults.set("voice", forKey: "pending_intent_navigation")
        defaults.synchronize()
        return .result(opensIntent: OpenURLIntent(URL(string: "accrual://voice")!))
    }
}

@available(iOS 18.0, *)
struct ScanReceiptControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Scan Receipt"
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool { false }
    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        let defaults = UserDefaults(suiteName: "group.com.syntheticae.accrual") ?? .standard
        defaults.set("scan", forKey: "pending_intent_navigation")
        defaults.synchronize()
        return .result(opensIntent: OpenURLIntent(URL(string: "accrual://scan")!))
    }
}

@available(iOS 18.0, *)
struct QuickAddControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Quick Add"
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool { false }
    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        let defaults = UserDefaults(suiteName: "group.com.syntheticae.accrual") ?? .standard
        defaults.set("add", forKey: "pending_intent_navigation")
        defaults.synchronize()
        return .result(opensIntent: OpenURLIntent(URL(string: "accrual://add")!))
    }
}

@available(iOS 18.0, *)
struct DraftReviewControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Review Drafts"
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool { false }
    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        let defaults = UserDefaults(suiteName: "group.com.syntheticae.accrual") ?? .standard
        defaults.set("review", forKey: "pending_intent_navigation")
        defaults.synchronize()
        return .result(opensIntent: OpenURLIntent(URL(string: "accrual://transactions")!))
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
    }
}

@available(iOS 18.0, *)
struct AccrualDraftReviewControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.syntheticae.accrual.control.drafts") {
            ControlWidgetButton(action: DraftReviewControlIntent()) {
                Label("Review Drafts", systemImage: "tray.full.fill")
            }
        }
        .displayName("Review Drafts")
    }
}
#endif
