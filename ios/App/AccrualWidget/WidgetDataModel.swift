import Foundation

/**
 * AccrualWidgetSnapshot
 * Data model matching the JSON payload sent from the React application via WidgetBridgePlugin.
 * Decoded directly from App Group UserDefaults: group.com.syntheticae.accrual
 */
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
    public let lastUpdated: String
    public let sparkline: [Int]

    public static var preview: AccrualWidgetSnapshot {
        AccrualWidgetSnapshot(
            netWorthFormatted: "Rp 124.500.000",
            netWorthRaw: 124500000,
            currencySymbol: "Rp",
            change24hPercentage: 2.4,
            change24hFormatted: "+2.4%",
            isPositive24h: true,
            totalAssetsFormatted: "Rp 150.000.000",
            totalDebtsFormatted: "Rp 25.500.000",
            isPrivacyMode: false,
            lastUpdated: ISO8601DateFormatter().string(from: Date()),
            sparkline: [20, 35, 40, 55, 50, 75, 100]
        )
    }

    public static func loadFromAppGroup() -> AccrualWidgetSnapshot {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard

        guard let dict = defaults.dictionary(forKey: "accrual_widget_snapshot") else {
            return .preview
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: dict, options: [])
            let decoded = try JSONDecoder().decode(AccrualWidgetSnapshot.self, from: data)
            return decoded
        } catch {
            return .preview
        }
    }
}
