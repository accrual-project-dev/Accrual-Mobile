#if canImport(AppIntents)
import Foundation
import AppIntents
import SwiftUI

/// Accrual Quick Log App Intent for iOS 16+
/// Enables the interactive floating frosted glass modal triggered via iPhone Back Tap,
/// Siri, or Action Button without launching the full application.
@available(iOS 16.0, *)
struct QuickLogExpenseIntent: AppIntent {
    static var title: LocalizedStringResource = "Accrual Quick Log"
    static var description = IntentDescription("Log an expense via native iOS frosted glass modal.")
    
    // Crucial: Executes in background without launching the webview
    static var openAppWhenRun: Bool = false

    @Parameter(title: "How much was it?")
    var amount: Double?

    @Parameter(title: "What kind of expense is it?")
    var category: String?

    @Parameter(title: "Which account or wallet?")
    var wallet: String?

    @Parameter(title: "What day was it?")
    var transactionDate: Date?

    @Parameter(title: "What did you buy?")
    var note: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$amount) for \(\.$note) in \(\.$category) using \(\.$wallet)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let amount = amount else {
            throw $amount.needsValueError("How much was it?")
        }
        
        let dateVal = transactionDate ?? Date()
        let catVal = category ?? "General"
        let walVal = wallet ?? "Default"
        let noteVal = note ?? ""
        
        let record: [String: Any] = [
            "id": UUID().uuidString,
            "amount": amount,
            "category": catVal,
            "wallet": walVal,
            "date": ISO8601DateFormatter().string(from: dateVal),
            "note": noteVal,
            "createdAt": Date().timeIntervalSince1970
        ]
        
        // Save to App Group UserDefaults so the Capacitor app can ingest it upon opening
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        var pending = defaults.array(forKey: "pending_backtap_transactions") as? [[String: Any]] ?? []
        pending.append(record)
        defaults.set(pending, forKey: "pending_backtap_transactions")
        
        let formattedAmount = String(format: "%.0f", amount)
        let displayDialog: LocalizedStringResource = "Logged \(formattedAmount) to Accrual."
        return .result(dialog: IntentDialog(displayDialog))
    }
}

/// Accrual Voice / Speak App Intent for iOS 16+
/// Allows users to speak a transaction naturally (e.g. "Coffee 35k with Cash")
/// and have Accrual parse it in the background or upon launch.
@available(iOS 16.0, *)
struct VoiceLogExpenseIntent: AppIntent {
    static var title: LocalizedStringResource = "Accrual Voice Log"
    static var description = IntentDescription("Speak your transaction and Accrual will parse it.")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "What did you spend?")
    var spokenText: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Log expense by speaking: \(\.$spokenText)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let text = spokenText, !text.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw $spokenText.needsValueError("What did you spend? (e.g. Kopi 25rb pakai Cash)")
        }
        
        let record: [String: Any] = [
            "id": UUID().uuidString,
            "text": text,
            "createdAt": Date().timeIntervalSince1970
        ]
        
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        var pending = defaults.array(forKey: "pending_backtap_voice") as? [[String: Any]] ?? []
        pending.append(record)
        defaults.set(pending, forKey: "pending_backtap_voice")
        
        let displayDialog: LocalizedStringResource = "Voice captured: \"\(text)\""
        return .result(dialog: IntentDialog(displayDialog))
    }
}

/// Automatically registers Accrual Shortcuts into iOS Shortcuts app on app installation
@available(iOS 16.0, *)
struct AccrualShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: QuickLogExpenseIntent(),
            phrases: [
                "Quick log to \(.applicationName)",
                "Log an expense in \(.applicationName)",
                "Catat pengeluaran di \(.applicationName)"
            ],
            shortTitle: "Quick Log",
            systemImageName: "creditcard.and.123"
        )
        AppShortcut(
            intent: VoiceLogExpenseIntent(),
            phrases: [
                "Voice log to \(.applicationName)",
                "Speak expense to \(.applicationName)",
                "Bicara pengeluaran di \(.applicationName)"
            ],
            shortTitle: "Voice Log",
            systemImageName: "mic.fill"
        )
    }
}
#endif
