import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), snapshot: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let snapshot = AccrualWidgetSnapshot.loadFromAppGroup()
        let entry = SimpleEntry(date: Date(), snapshot: snapshot)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let snapshot = AccrualWidgetSnapshot.loadFromAppGroup()
        let currentDate = Date()
        // Refresh every 15 minutes or when triggered by WidgetCenter.reloadAllTimelines()
        let nextUpdateDate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate) ?? currentDate
        let entry = SimpleEntry(date: currentDate, snapshot: snapshot)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdateDate))
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let snapshot: AccrualWidgetSnapshot
}

struct NetWorthWidgetEntryView : View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(snapshot: entry.snapshot)
        case .systemMedium:
            MediumWidgetView(snapshot: entry.snapshot)
        case .accessoryRectangular:
            LockScreenRectangularView(snapshot: entry.snapshot)
        case .accessoryCircular:
            LockScreenCircularView(snapshot: entry.snapshot)
        default:
            SmallWidgetView(snapshot: entry.snapshot)
        }
    }
}

// MARK: - Small Widget (SystemSmall)
struct SmallWidgetView: View {
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        ZStack {
            // Obsidian Luxury Background
            Color(red: 9/255, green: 9/255, blue: 12/255)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Header: Logo / Title + Privacy Lock Indicator
                HStack {
                    Text("NET WORTH")
                        .font(.system(size: 10, weight: .semibold, design: .default))
                        .tracking(1.2)
                        .foregroundColor(Color.white.opacity(0.5))

                    Spacer()

                    if snapshot.isPrivacyMode {
                        Image(systemName: "eye.slash.fill")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.4))
                    } else {
                        Image(systemName: "sparkles")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.4))
                    }
                }

                Spacer()

                // Main Metric: Formatted Net Worth or Masked
                if snapshot.isPrivacyMode {
                    Text("••••••••")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .tracking(1)
                } else {
                    Text(snapshot.netWorthFormatted)
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }

                Spacer()

                // Bottom: 24h Delta Badge + Sparkline Micro-Indicator
                HStack(alignment: .center, spacing: 6) {
                    HStack(spacing: 3) {
                        Image(systemName: snapshot.isPositive24h ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 9, weight: .bold))
                        Text(snapshot.change24hFormatted)
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color.white.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.white.opacity(0.12), lineWidth: 0.5)
                    )
                    .cornerRadius(6)
                    .foregroundColor(snapshot.isPositive24h ? .white : Color.white.opacity(0.7))

                    Spacer()

                    // Mini sparkline (last 5 points)
                    MiniSparkline(points: snapshot.sparkline)
                        .frame(width: 38, height: 14)
                }
            }
            .padding(14)
        }
        .widgetURL(URL(string: "accrual://home"))
    }
}

// MARK: - Medium Widget (SystemMedium)
struct MediumWidgetView: View {
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        ZStack {
            Color(red: 9/255, green: 9/255, blue: 12/255)
                .ignoresSafeArea()

            HStack(spacing: 16) {
                // Left Column: Net Worth & Financial Health
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("TOTAL KEKAYAAN BERSIH")
                            .font(.system(size: 9, weight: .semibold))
                            .tracking(1.0)
                            .foregroundColor(Color.white.opacity(0.45))

                        if snapshot.isPrivacyMode {
                            Image(systemName: "eye.slash.fill")
                                .font(.system(size: 9))
                                .foregroundColor(Color.white.opacity(0.4))
                        }
                    }

                    if snapshot.isPrivacyMode {
                        Text("••••••••")
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    } else {
                        Text(snapshot.netWorthFormatted)
                            .font(.system(size: 21, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }

                    HStack(spacing: 4) {
                        Image(systemName: snapshot.isPositive24h ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 9, weight: .bold))
                        Text("\(snapshot.change24hFormatted) dalam 24 jam")
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundColor(Color.white.opacity(0.7))

                    Spacer()

                    // Assets vs Debts summary
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Aset")
                                .font(.system(size: 9))
                                .foregroundColor(Color.white.opacity(0.4))
                            Text(snapshot.isPrivacyMode ? "••••" : snapshot.totalAssetsFormatted)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.white)
                        }

                        VStack(alignment: .leading, spacing: 1) {
                            Text("Kewajiban")
                                .font(.system(size: 9))
                                .foregroundColor(Color.white.opacity(0.4))
                            Text(snapshot.isPrivacyMode ? "••••" : snapshot.totalDebtsFormatted)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(Color.white.opacity(0.7))
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Right Column: Interactive 1-Tap Quick Action Buttons
                VStack(spacing: 8) {
                    Link(destination: URL(string: "accrual://add")!) {
                        HStack(spacing: 6) {
                            Image(systemName: "plus")
                                .font(.system(size: 11, weight: .semibold))
                            Text("Catat Cepat")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.08))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.14), lineWidth: 0.75)
                        )
                        .cornerRadius(12)
                        .foregroundColor(.white)
                    }

                    Link(destination: URL(string: "accrual://voice")!) {
                        HStack(spacing: 6) {
                            Image(systemName: "mic.fill")
                                .font(.system(size: 11, weight: .semibold))
                            Text("Dikte Suara")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.04))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.1), lineWidth: 0.75)
                        )
                        .cornerRadius(12)
                        .foregroundColor(Color.white.opacity(0.85))
                    }

                    // 7-day sparkline trend
                    MiniSparkline(points: snapshot.sparkline)
                        .frame(height: 24)
                        .padding(.top, 2)
                }
                .frame(width: 125)
            }
            .padding(16)
        }
    }
}

// MARK: - Lock Screen Widgets (iOS 16+)
struct LockScreenRectangularView: View {
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "chart.pie.fill")
                    .font(.system(size: 9))
                Text("ACCRUAL NET WORTH")
                    .font(.system(size: 9, weight: .semibold))
            }
            Text(snapshot.isPrivacyMode ? "••••••••" : snapshot.netWorthFormatted)
                .font(.system(size: 14, weight: .bold))
            Text("\(snapshot.isPositive24h ? "+" : "")\(snapshot.change24hFormatted) 24j")
                .font(.system(size: 10))
                .foregroundColor(.secondary)
        }
    }
}

struct LockScreenCircularView: View {
    let snapshot: AccrualWidgetSnapshot

    var body: some View {
        Gauge(value: max(0, min(100, Double(snapshot.sparkline.last ?? 50))), in: 0...100) {
            Image(systemName: "chart.line.uptrend.xyaxis")
        } currentValueLabel: {
            Text("\(Int(snapshot.change24hPercentage))%")
                .font(.system(size: 10, weight: .bold))
        }
        .gaugeStyle(.accessoryCircular)
    }
}

// MARK: - Mini Sparkline Component
struct MiniSparkline: View {
    let points: [Int]

    var body: some View {
        GeometryReader { geo in
            if points.count > 1 {
                Path { path in
                    let step = geo.size.width / CGFloat(points.count - 1)
                    let height = geo.size.height

                    for (index, point) in points.enumerated() {
                        let x = CGFloat(index) * step
                        let y = height - (CGFloat(point) / 100.0 * height)
                        if index == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                }
                .stroke(
                    Color.white.opacity(0.6),
                    style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round)
                )
            }
        }
    }
}

struct NetWorthWidget: Widget {
    let kind: String = "NetWorthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            NetWorthWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Accrual: Net Worth")
        .description("Pantau kekayaan bersih dan ringkasan portofolio Anda secara langsung dari Layar Utama.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}
