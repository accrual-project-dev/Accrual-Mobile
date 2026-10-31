import Foundation
import SwiftUI

public struct WidgetHeatmapDot: Codable {
    public let intensity: Double
    public let hasSpend: Bool
    public let isToday: Bool?

    public init(intensity: Double, hasSpend: Bool, isToday: Bool? = false) {
        self.intensity = intensity
        self.hasSpend = hasSpend
        self.isToday = isToday
    }
}

public struct WidgetCategorySlice: Codable {
    public let name: String
    public let pct: Int
    public let amountFormatted: String
}

public struct WidgetBillItem: Codable {
    public let title: String
    public let amountFormatted: String
    public let dueLabel: String
}

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
    public let spaceName: String?

    public let savingsRate: Int?
    public let savingsTarget: Int?
    public let monthlySavingsFormatted: String?
    public let runwayMonths: Double?
    public let dailyBurnFormatted: String?
    public let monthlyInflowFormatted: String?
    public let monthlyOutflowFormatted: String?
    public let netCashflowFormatted: String?
    public let isPositiveCashflow: Bool?
    public let cashflowBars: [Int]?
    public let capitalHealthScore: Int?
    public let capitalHealthTier: String?
    public let heatmapDots: [WidgetHeatmapDot]?
    public let activeDaysCount: Int?
    public let noSpendDaysCount: Int?
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

    public let liquidCashFormatted: String?
    public let liquidCashRaw: Double?
    public let liquidCashChangeFormatted: String?
    public let isLiquidCashPositive: Bool?
    public let liquidCashSparkline: [Int]?
    public let safeToSpendDailyFormatted: String?
    public let safeToSpendRemainingFormatted: String?
    public let safeToSpendBudgetFormatted: String?
    public let safeToSpendSpentTodayFormatted: String?
    public let safeToSpendDailyQuotaFormatted: String?
    public let safeToSpendPercent: Int?
    public let dailyBurnPacePercent: Int?
    public let dailyBurnPaceStatus: String?
    public let daysLeftInMonth: Int?
    public let cashflowDeltaVsLastMonth: String?
    public let isCashflowDeltaPositive: Bool?
    public let monthShortName: String?

    public let topCategories: [WidgetCategorySlice]?
    public let upcomingBills: [WidgetBillItem]?
    public let activeSubsCount: Int?
    public let activeSubsTotalFormatted: String?
    public let draftPendingCount: Int?
    public let thisWeekWave: [Int]?
    public let lastWeekWave: [Int]?
    public let weekDeltaFormatted: String?
    public let isWeekDeltaPositive: Bool?
    public let insightHeadlinePct: String?
    public let insightTitle: String?
    public let insightSubtitle: String?
    public let lockInsightLine: String?

    public var isIndo: Bool { isIndonesian ?? true }
    public var forcedDark: Bool? {
        guard let t = theme?.lowercased() else { return nil }
        return t == "light" ? false : (t == "dark" ? true : nil)
    }
    public var safeSpaceName: String { spaceName ?? (isIndo ? "Space Pribadi" : "Personal Space") }
    public var safeSavingsRate: Int { savingsRate ?? 0 }
    public var safeSavingsTarget: Int { savingsTarget ?? 40 }
    public var safeMonthlySavings: String { monthlySavingsFormatted ?? "\(currencySymbol) 0" }
    public var safeRunwayMonths: Double { runwayMonths ?? 0.0 }
    public var safeDailyBurn: String { dailyBurnFormatted ?? "\(currencySymbol) 0" }
    public var safeMonthlyInflow: String { monthlyInflowFormatted ?? "\(currencySymbol) 0" }
    public var safeMonthlyOutflow: String { monthlyOutflowFormatted ?? "\(currencySymbol) 0" }
    public var safeNetCashflow: String { netCashflowFormatted ?? "\(currencySymbol) 0" }
    public var safeIsPositiveCashflow: Bool { isPositiveCashflow ?? !safeNetCashflow.hasPrefix("-") }
    public var safeCashflowBars: [Int] { cashflowBars ?? [0, 0, 0, 0, 0, 0] }
    public var safeCapitalHealthScore: Int { capitalHealthScore ?? 0 }
    public var safeCapitalHealthTier: String { capitalHealthTier ?? (isIndo ? "Belum Ada Data" : "No Data") }
    public var safeActiveDaysCount: Int { activeDaysCount ?? 0 }
    public var safeNoSpendDaysCount: Int { noSpendDaysCount ?? (28 - safeActiveDaysCount) }
    public var safeHeatmapDots: [WidgetHeatmapDot] {
        if let dots = heatmapDots, !dots.isEmpty { return dots }
        return (0..<28).map { WidgetHeatmapDot(intensity: 0.0, hasSpend: false, isToday: $0 == 27) }
    }
    public var safeSolvencyScore: Int { solvencyScore ?? 100 }
    public var safeDebtRatio: Double { debtRatio ?? 0.0 }
    public var safeLiquidPct: Double { liquidPct ?? 0.0 }
    public var safeGrowthPct: Double { growthPct ?? 0.0 }
    public var safeFixedPct: Double { fixedPct ?? 0.0 }
    public var safeGrossAssets: String { grossAssetsFormatted ?? netWorthFormatted }
    public var safeLiabilities: String { liabilitiesFormatted ?? "\(currencySymbol) 0" }
    public var safeNetEquity: String { netEquityFormatted ?? netWorthFormatted }
    public var safeSpendingStatus: String { spendingVolatilityStatus ?? (isIndo ? "Stabil" : "Stable") }
    public var safeDailyAverage: String { dailyAverageFormatted ?? "\(currencySymbol) 0" }
    public var safeVolatilityVariance: Int { volatilityVariance ?? 0 }
    public var safeLiquidCash: String { liquidCashFormatted ?? "\(currencySymbol) 0" }
    public var safeLiquidCashChange: String { liquidCashChangeFormatted ?? "0%" }
    public var safeIsLiquidCashPositive: Bool { isLiquidCashPositive ?? !safeLiquidCashChange.hasPrefix("-") }
    public var safeLiquidCashSparkline: [Int] { liquidCashSparkline ?? sparkline }
    public var safeSafeToSpendDaily: String { safeToSpendDailyFormatted ?? "\(currencySymbol) 0" }
    public var safeSafeToSpendRemaining: String { safeToSpendRemainingFormatted ?? "\(currencySymbol) 0" }
    public var safeSafeToSpendBudget: String { safeToSpendBudgetFormatted ?? "\(currencySymbol) 0" }
    public var safeSpentToday: String { safeToSpendSpentTodayFormatted ?? "\(currencySymbol) 0" }
    public var safeDailyQuota: String { safeToSpendDailyQuotaFormatted ?? "\(currencySymbol) 0" }
    public var safeSafeToSpendPercent: Int { safeToSpendPercent ?? 0 }
    public var safeDailyBurnPacePercent: Int { dailyBurnPacePercent ?? 0 }
    public var safeDailyBurnPaceStatus: String { dailyBurnPaceStatus ?? (isIndo ? "Rendah" : "Low") }
    public var safeDaysLeftInMonth: Int { daysLeftInMonth ?? 1 }
    public var safeCashflowDeltaVsLastMonth: String { cashflowDeltaVsLastMonth ?? "0%" }
    public var safeIsCashflowDeltaPositive: Bool { isCashflowDeltaPositive ?? !safeCashflowDeltaVsLastMonth.hasPrefix("-") }
    public var safeMonthShortName: String { monthShortName ?? "" }

    public var safeTopCategories: [WidgetCategorySlice] { topCategories ?? [] }
    public var safeUpcomingBills: [WidgetBillItem] { upcomingBills ?? [] }
    public var safeActiveSubsCount: Int { activeSubsCount ?? safeUpcomingBills.count }
    public var safeActiveSubsTotal: String { activeSubsTotalFormatted ?? "\(currencySymbol) 0" }
    public var safeDraftCount: Int { draftPendingCount ?? 0 }
    public var safeThisWeekWave: [Int] { thisWeekWave ?? [0, 0, 0, 0, 0, 0, 0] }
    public var safeLastWeekWave: [Int] { lastWeekWave ?? [0, 0, 0, 0, 0, 0, 0] }
    public var safeWeekDelta: String { weekDeltaFormatted ?? "0%" }
    public var safeInsightPct: String { insightHeadlinePct ?? "0%" }
    public var safeInsightTitle: String { insightTitle ?? (isIndo ? "Buka Accrual untuk menyinkronkan data." : "Open Accrual to sync financial telemetry.") }
    public var safeInsightSubtitle: String { insightSubtitle ?? "" }
    public var safeLockInsightLine: String { lockInsightLine ?? "\(safeSafeToSpendDaily) • \(safeNoSpendDaysCount) \(isIndo ? "hr tanpa belanja" : "no-spend days")" }

    public static var emptyZero: AccrualWidgetSnapshot {
        AccrualWidgetSnapshot(
            netWorthFormatted: "Rp 0",
            netWorthRaw: 0,
            currencySymbol: "Rp",
            change24hPercentage: 0.0,
            change24hFormatted: "0%",
            isPositive24h: true,
            totalAssetsFormatted: "Rp 0",
            totalDebtsFormatted: "Rp 0",
            isPrivacyMode: false,
            isIndonesian: true,
            theme: "dark",
            lastUpdated: ISO8601DateFormatter().string(from: Date()),
            sparkline: [0, 0, 0, 0, 0, 0, 0],
            spaceName: "Space Pribadi",
            savingsRate: 0,
            savingsTarget: 40,
            monthlySavingsFormatted: "Rp 0",
            runwayMonths: 0.0,
            dailyBurnFormatted: "Rp 0",
            monthlyInflowFormatted: "Rp 0",
            monthlyOutflowFormatted: "Rp 0",
            netCashflowFormatted: "Rp 0",
            isPositiveCashflow: true,
            cashflowBars: [0, 0, 0, 0, 0, 0],
            capitalHealthScore: 0,
            capitalHealthTier: "Belum Ada Data",
            heatmapDots: nil,
            activeDaysCount: 0,
            noSpendDaysCount: 28,
            solvencyScore: 100,
            debtRatio: 0.0,
            liquidPct: 0.0,
            growthPct: 0.0,
            fixedPct: 0.0,
            grossAssetsFormatted: "Rp 0",
            liabilitiesFormatted: "Rp 0",
            netEquityFormatted: "Rp 0",
            spendingVolatilityStatus: "Stabil",
            dailyAverageFormatted: "Rp 0/hr",
            volatilityVariance: 0,
            liquidCashFormatted: "Rp 0",
            liquidCashRaw: 0,
            liquidCashChangeFormatted: "0%",
            isLiquidCashPositive: true,
            liquidCashSparkline: [0, 0, 0, 0, 0, 0, 0],
            safeToSpendDailyFormatted: "Rp 0",
            safeToSpendRemainingFormatted: "Rp 0",
            safeToSpendBudgetFormatted: "Rp 0",
            safeToSpendSpentTodayFormatted: "Rp 0",
            safeToSpendDailyQuotaFormatted: "Rp 0",
            safeToSpendPercent: 0,
            dailyBurnPacePercent: 0,
            dailyBurnPaceStatus: "Rendah",
            daysLeftInMonth: 30,
            cashflowDeltaVsLastMonth: "0%",
            isCashflowDeltaPositive: true,
            monthShortName: "",
            topCategories: [],
            upcomingBills: [],
            activeSubsCount: 0,
            activeSubsTotalFormatted: "Rp 0",
            draftPendingCount: 0,
            thisWeekWave: [0, 0, 0, 0, 0, 0, 0],
            lastWeekWave: [0, 0, 0, 0, 0, 0, 0],
            weekDeltaFormatted: "0%",
            isWeekDeltaPositive: true,
            insightHeadlinePct: "0%",
            insightTitle: "Buka Accrual untuk menyinkronkan data.",
            insightSubtitle: "",
            lockInsightLine: "Rp 0"
        )
    }

    public static var preview: AccrualWidgetSnapshot { emptyZero }

    public static func loadFromAppGroup() -> AccrualWidgetSnapshot {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        if let data = defaults.data(forKey: "accrual_widget_snapshot_data"),
           let decoded = try? JSONDecoder().decode(AccrualWidgetSnapshot.self, from: data) {
            return decoded
        }
        if let dict = defaults.dictionary(forKey: "accrual_widget_snapshot"),
           let data = try? JSONSerialization.data(withJSONObject: dict, options: []),
           let decoded = try? JSONDecoder().decode(AccrualWidgetSnapshot.self, from: data) {
            return decoded
        }
        return .emptyZero
    }
}

public struct AccrualTheme {
    public static func surfaceBackground(isDark: Bool) -> some View {
        LinearGradient(
            gradient: Gradient(colors: isDark
                ? [Color(red: 18/255, green: 18/255, blue: 22/255), Color(red: 9/255, green: 9/255, blue: 12/255)]
                : [Color.white, Color(red: 244/255, green: 244/255, blue: 247/255)]
            ),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    public static func cardBorder(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.09) : Color.black.opacity(0.07)
    }

    public static func textPrimary(isDark: Bool) -> Color {
        isDark ? Color.white : Color(red: 9/255, green: 9/255, blue: 11/255)
    }

    public static func textSecondary(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.68) : Color(red: 72/255, green: 72/255, blue: 80/255)
    }

    public static func textTertiary(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.42) : Color(red: 140/255, green: 140/255, blue: 150/255)
    }

    public static func fillSubtle(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.06) : Color.black.opacity(0.045)
    }
}

public struct SpecularRimLight: View {
    let isDark: Bool
    public var body: some View {
        LinearGradient(
            gradient: Gradient(colors: [
                Color.clear,
                isDark ? Color.white.opacity(0.32) : Color.white.opacity(0.75),
                Color.clear
            ]),
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(height: 1.2)
        .padding(.horizontal, 22)
    }
}

public struct AccrualZenLogoIcon: View {
    var size: CGFloat = 36
    public var body: some View {
        VStack(spacing: size * 0.08) {
            Capsule().frame(width: size * 0.42, height: size * 0.22).opacity(0.95)
            Capsule().frame(width: size * 0.70, height: size * 0.25).opacity(0.85)
            Capsule().frame(width: size * 0.92, height: size * 0.28).opacity(0.70)
        }
    }
}
