import Foundation
import SwiftUI

// MARK: - Heatmap Dot Data
public struct WidgetHeatmapDot: Codable {
    public let intensity: Double
    public let hasSpend: Bool

    public init(intensity: Double, hasSpend: Bool) {
        self.intensity = intensity
        self.hasSpend = hasSpend
    }
}

// MARK: - Financial Snapshot Model
public struct AccrualWidgetSnapshot: Codable {
    public let netWorthFormatted: String
    public let netWorthRaw: Double
    public let currencySymbol: String
    public let change24hPercentage: Double
    public let change24hFormatted: String
    public let isPositive24h: Bool
    public let totalAssetsFormatted: String
    public let totalDebtsFormatted: String
    public let isPrivacyMode: Bool
    public let isIndonesian: Bool?
    public let theme: String?
    public let lastUpdated: String
    public let sparkline: [Int]

    // Expanded Data Suite
    public let savingsRate: Int?
    public let savingsTarget: Int?
    public let monthlySavingsFormatted: String?
    public let runwayMonths: Double?
    public let dailyBurnFormatted: String?
    public let monthlyInflowFormatted: String?
    public let monthlyOutflowFormatted: String?
    public let netCashflowFormatted: String?
    public let cashflowBars: [Int]?
    public let capitalHealthScore: Int?
    public let capitalHealthTier: String?
    public let heatmapDots: [WidgetHeatmapDot]?
    public let activeDaysCount: Int?
    public let solvencyScore: Int?
    public let debtRatio: Double?
    public let liquidPct: Double?
    public let growthPct: Double?
    public let fixedPct: Double?
    public let grossAssetsFormatted: String?
    public let liabilitiesFormatted: String?
    public let netEquityFormatted: String?
    public let spendingVolatilityStatus: String?
    public let dailyAverageFormatted: String?
    public let volatilityVariance: Int?

    // MARK: - Safe Property Resolvers
    public var isIndo: Bool {
        return isIndonesian ?? false
    }

    public var forcedDark: Bool? {
        guard let t = theme?.lowercased() else { return nil }
        if t == "light" { return false }
        if t == "dark" { return true }
        return nil
    }

    public var safeSavingsRate: Int {
        return savingsRate ?? 38
    }

    public var safeSavingsTarget: Int {
        return savingsTarget ?? 40
    }

    public var safeMonthlySavings: String {
        return monthlySavingsFormatted ?? "\(currencySymbol) 15.200.000"
    }

    public var safeRunwayMonths: Double {
        return runwayMonths ?? 6.4
    }

    public var safeDailyBurn: String {
        return dailyBurnFormatted ?? "\(currencySymbol) 326.000"
    }

    public var safeMonthlyInflow: String {
        return monthlyInflowFormatted ?? "\(currencySymbol) 42.500.000"
    }

    public var safeMonthlyOutflow: String {
        return monthlyOutflowFormatted ?? "\(currencySymbol) 18.200.000"
    }

    public var safeNetCashflow: String {
        return netCashflowFormatted ?? "+\(currencySymbol) 24.300.000"
    }

    public var safeCashflowBars: [Int] {
        return cashflowBars ?? [30, 45, 20, 60, 40, 85, 30, 70, 50, 40, 65, 90]
    }

    public var safeCapitalHealthScore: Int {
        return capitalHealthScore ?? 88
    }

    public var safeCapitalHealthTier: String {
        return capitalHealthTier ?? (isIndo ? "Prima" : "Optimal")
    }

    public var safeActiveDaysCount: Int {
        return activeDaysCount ?? 18
    }

    public var safeHeatmapDots: [WidgetHeatmapDot] {
        if let dots = heatmapDots, !dots.isEmpty {
            return dots
        }
        // Fallback 28-day matrix pattern
        let mockIntensities: [Double] = [
            0.8, 0.0, 0.4, 0.9, 0.0, 0.2, 0.7,
            0.0, 0.5, 0.8, 0.0, 0.3, 0.6, 0.0,
            0.9, 0.0, 0.0, 0.4, 0.7, 0.0, 0.5,
            0.0, 0.8, 0.6, 0.3, 0.0, 0.7, 0.9
        ]
        return mockIntensities.map { WidgetHeatmapDot(intensity: $0, hasSpend: $0 > 0) }
    }

    public var safeSolvencyScore: Int {
        return solvencyScore ?? 94
    }

    public var safeDebtRatio: Double {
        return debtRatio ?? 6.0
    }

    public var safeLiquidPct: Double {
        return liquidPct ?? 42.0
    }

    public var safeGrowthPct: Double {
        return growthPct ?? 38.0
    }

    public var safeFixedPct: Double {
        return fixedPct ?? 20.0
    }

    public var safeGrossAssets: String {
        return grossAssetsFormatted ?? "\(currencySymbol) 150.000.000"
    }

    public var safeLiabilities: String {
        return liabilitiesFormatted ?? "\(currencySymbol) 9.000.000"
    }

    public var safeNetEquity: String {
        return netEquityFormatted ?? "\(currencySymbol) 141.000.000"
    }

    public var safeSpendingStatus: String {
        return spendingVolatilityStatus ?? (isIndo ? "Stabil" : "Stable")
    }

    public var safeDailyAverage: String {
        return dailyAverageFormatted ?? "\(currencySymbol) 326.000\(isIndo ? "/hr" : "/d")"
    }

    public var safeVolatilityVariance: Int {
        return volatilityVariance ?? 14
    }

    // MARK: - Preview Mock Factory
    public static var preview: AccrualWidgetSnapshot {
        AccrualWidgetSnapshot(
            netWorthFormatted: "Rp 124.500.000",
            netWorthRaw: 124500000,
            currencySymbol: "Rp",
            change24hPercentage: 2.4,
            change24hFormatted: "+2.4%",
            isPositive24h: true,
            totalAssetsFormatted: "Rp 150.000.000",
            totalDebtsFormatted: "Rp 9.000.000",
            isPrivacyMode: false,
            isIndonesian: false,
            theme: nil,
            lastUpdated: ISO8601DateFormatter().string(from: Date()),
            sparkline: [20, 35, 40, 55, 50, 75, 100],
            savingsRate: 38,
            savingsTarget: 40,
            monthlySavingsFormatted: "Rp 15.200.000",
            runwayMonths: 6.4,
            dailyBurnFormatted: "Rp 326.000",
            monthlyInflowFormatted: "Rp 42.500.000",
            monthlyOutflowFormatted: "Rp 18.200.000",
            netCashflowFormatted: "+Rp 24.300.000",
            cashflowBars: [30, 45, 20, 60, 40, 85, 30, 70, 50, 40, 65, 90],
            capitalHealthScore: 88,
            capitalHealthTier: "Optimal",
            heatmapDots: nil,
            activeDaysCount: 18,
            solvencyScore: 94,
            debtRatio: 6.0,
            liquidPct: 42.0,
            growthPct: 38.0,
            fixedPct: 20.0,
            grossAssetsFormatted: "Rp 150.000.000",
            liabilitiesFormatted: "Rp 9.000.000",
            netEquityFormatted: "Rp 141.000.000",
            spendingVolatilityStatus: "Stable",
            dailyAverageFormatted: "Rp 326.000/d",
            volatilityVariance: 14
        )
    }

    // MARK: - App Group Loader
    public static func loadFromAppGroup() -> AccrualWidgetSnapshot {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard

        if let data = defaults.data(forKey: "accrual_widget_snapshot_data") {
            if let decoded = try? JSONDecoder().decode(AccrualWidgetSnapshot.self, from: data) {
                return decoded
            }
        }

        if let dict = defaults.dictionary(forKey: "accrual_widget_snapshot") {
            if let data = try? JSONSerialization.data(withJSONObject: dict, options: []),
               let decoded = try? JSONDecoder().decode(AccrualWidgetSnapshot.self, from: data) {
                return decoded
            }
        }

        return .preview
    }
}

// MARK: - Monochrome Apple Luxury Design Tokens
public struct AccrualTheme {
    public static func surfaceBackground(isDark: Bool) -> some View {
        LinearGradient(
            gradient: Gradient(colors: isDark
                ? [Color(red: 16/255, green: 16/255, blue: 21/255), Color(red: 10/255, green: 10/255, blue: 13/255)]
                : [Color.white, Color(red: 244/255, green: 244/255, blue: 247/255)]
            ),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    public static func cardBorder(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.08) : Color.black.opacity(0.06)
    }

    public static func textPrimary(isDark: Bool) -> Color {
        isDark ? Color.white : Color(red: 9/255, green: 9/255, blue: 11/255)
    }

    public static func textSecondary(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.7) : Color(red: 82/255, green: 82/255, blue: 91/255)
    }

    public static func textTertiary(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.4) : Color(red: 161/255, green: 161/255, blue: 170/255)
    }

    public static func fillSubtle(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.06) : Color.black.opacity(0.045)
    }
}

// MARK: - Specular Rim Light Modifier
public struct SpecularRimLight: View {
    let isDark: Bool

    public var body: some View {
        LinearGradient(
            gradient: Gradient(colors: [
                Color.clear,
                isDark ? Color.white.opacity(0.35) : Color.black.opacity(0.08),
                Color.clear
            ]),
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(height: 1.5)
        .padding(.horizontal, 24)
    }
}

// MARK: - Zen Pebbles App Logo Icon (Used for Lock Screen Circular Quick Log)
public struct AccrualZenLogoIcon: View {
    var size: CGFloat = 36

    public var body: some View {
        VStack(spacing: size * 0.08) {
            // Top pebble
            Capsule()
                .frame(width: size * 0.42, height: size * 0.22)
                .opacity(0.95)
            // Middle pebble
            Capsule()
                .frame(width: size * 0.70, height: size * 0.25)
                .opacity(0.85)
            // Bottom pebble
            Capsule()
                .frame(width: size * 0.92, height: size * 0.28)
                .opacity(0.70)
        }
    }
}
