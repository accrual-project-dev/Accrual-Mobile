#if canImport(AppIntents)
import Foundation
import AppIntents
import SwiftUI

/// ======================================================================
/// ACCRUAL APP INTENTS & SHORTCUTS SUITE (iOS 16.0+)
/// Strictly compliant with GEMINI.md:
/// - Rule 1: No native colored emojis (SF Symbols vector iconography)
/// - Rule 2: Monochrome Apple Luxury Theme (Obsidian & Frosted Glass)
/// - Rule 6: 100% pure localization support
/// ======================================================================

/// 1. Quick Log Expense Intent
/// Parameterized manual entry (Amount, Note, Category, Wallet, Date)
@available(iOS 16.0, *)
struct QuickLogExpenseIntent: AppIntent {
    static var title: LocalizedStringResource = "Catat Pengeluaran"
    static var description = IntentDescription("Catat pengeluaran terstruktur ke Accrual dengan nominal, kategori, dan dompet.")
    
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Nominal (Angka)")
    var amount: Double?

    @Parameter(title: "Catatan atau Keterangan")
    var note: String?

    @Parameter(title: "Kategori")
    var category: String?

    @Parameter(title: "Dompet atau Rekening")
    var wallet: String?

    @Parameter(title: "Tanggal Transaksi")
    var transactionDate: Date?

    static var parameterSummary: some ParameterSummary {
        Summary("Catat \(\.$amount) untuk \(\.$note) di \(\.$category) pakai \(\.$wallet)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let amount = amount else {
            throw $amount.needsValueError("Berapa nominal pengeluaran Anda?")
        }
        
        let dateVal = transactionDate ?? Date()
        let catVal = category ?? "Umum"
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
        
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        var pending = defaults.array(forKey: "pending_backtap_transactions") as? [[String: Any]] ?? []
        pending.append(record)
        defaults.set(pending, forKey: "pending_backtap_transactions")
        
        let formattedAmount = String(format: "%.0f", amount)
        let displayDialog: LocalizedStringResource = "Berhasil mencatat Rp \(formattedAmount) ke Accrual."
        return .result(dialog: IntentDialog(displayDialog))
    }
}

/// 2. Log Transaction from Text Intent
/// Tailor-made for iOS Shortcuts Automations (Bank Notifications, SMS, Clipboard)
@available(iOS 16.0, *)
struct LogTransactionTextIntent: AppIntent {
    static var title: LocalizedStringResource = "Catat Transaksi dari Teks"
    static var description = IntentDescription("Urai dan catat transaksi otomatis dari teks notifikasi bank, SMS, atau papan klip.")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Teks Transaksi atau Notifikasi")
    var text: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Catat transaksi dari teks: \(\.$text)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let text = text, !text.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw $text.needsValueError("Masukkan atau sambungkan teks notifikasi transaksi:")
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
        
        let displayDialog: LocalizedStringResource = "Notifikasi transaksi berhasil diterima Accrual."
        return .result(dialog: IntentDialog(displayDialog))
    }
}

/// 3. Voice Log Expense Intent
/// Spoken transaction logger
@available(iOS 16.0, *)
struct VoiceLogExpenseIntent: AppIntent {
    static var title: LocalizedStringResource = "Dikte Suara Pengeluaran"
    static var description = IntentDescription("Ucapkan transaksi Anda dan kecerdasan Accrual akan mengurainya secara otomatis.")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Ucapan Transaksi")
    var spokenText: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Catat pengeluaran lewat ucapan: \(\.$spokenText)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let text = spokenText, !text.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw $spokenText.needsValueError("Apa yang Anda belanjakan? (Contoh: Kopi 25rb bayar pakai Cash)")
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
        
        let displayDialog: LocalizedStringResource = "Suara berhasil dicatat: \"\(text)\""
        return .result(dialog: IntentDialog(displayDialog))
    }
}

/// 4. Open Quick Add Intent
/// Direct launcher for transaction sheet
@available(iOS 16.0, *)
struct OpenQuickAddIntent: AppIntent {
    static var title: LocalizedStringResource = "Buka Catat Cepat"
    static var description = IntentDescription("Buka formulir pencatatan transaksi Accrual secara langsung.")

    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        defaults.set("add", forKey: "pending_intent_navigation")
        return .result()
    }
}

/// 5. Open Scan Receipt Intent
/// Direct launcher for receipt & invoice scanner
@available(iOS 16.0, *)
struct OpenScanReceiptIntent: AppIntent {
    static var title: LocalizedStringResource = "Pindai Resi & Struk"
    static var description = IntentDescription("Buka kamera pemindai bukti bayar atau mutasi di Accrual.")

    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        defaults.set("scan", forKey: "pending_intent_navigation")
        return .result()
    }
}

/// 6. Get Financial Summary Intent
/// Fast background query of user's net worth and monthly outflow snapshot
@available(iOS 16.0, *)
struct GetFinancialSummaryIntent: AppIntent {
    static var title: LocalizedStringResource = "Cek Ringkasan Keuangan"
    static var description = IntentDescription("Lihat ringkasan saldo, kekayaan bersih, dan pengeluaran di Accrual.")

    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        
        var netWorthText = "Rp 0"
        var expenseText = "Rp 0"
        
        if let snapshotData = defaults.data(forKey: "accrual_widget_snapshot_data"),
           let json = try? JSONSerialization.jsonObject(with: snapshotData) as? [String: Any] {
            if let nw = json["netWorthFormatted"] as? String {
                netWorthText = nw
            }
            if let exp = json["monthlyOutflowFormatted"] as? String {
                expenseText = exp
            }
        } else if let snapshot = defaults.dictionary(forKey: "accrual_widget_snapshot") {
            if let nw = snapshot["netWorthFormatted"] as? String {
                netWorthText = nw
            }
            if let exp = snapshot["monthlyOutflowFormatted"] as? String {
                expenseText = exp
            }
        }

        let summaryDialog: LocalizedStringResource = "Kekayaan Bersih Accrual: \(netWorthText). Pengeluaran: \(expenseText)."
        return .result(dialog: IntentDialog(summaryDialog))
    }
}

/// Central AppShortcutsProvider
/// Automatically indexes Accrual into iOS Shortcuts app on app installation
@available(iOS 16.0, *)
struct AccrualShortcutsProvider: AppShortcutsProvider {
    static var shortcutTileColor: ShortcutTileColor = .gray

    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: QuickLogExpenseIntent(),
            phrases: [
                "Quick log to \(.applicationName)",
                "Log an expense in \(.applicationName)",
                "Catat pengeluaran di \(.applicationName)"
            ],
            shortTitle: "Catat Pengeluaran",
            systemImageName: "plus.circle.fill"
        )
        AppShortcut(
            intent: LogTransactionTextIntent(),
            phrases: [
                "Log text to \(.applicationName)",
                "Log notification in \(.applicationName)",
                "Catat teks di \(.applicationName)",
                "Catat notifikasi di \(.applicationName)"
            ],
            shortTitle: "Catat dari Teks",
            systemImageName: "doc.text.viewfinder"
        )
        AppShortcut(
            intent: VoiceLogExpenseIntent(),
            phrases: [
                "Voice log to \(.applicationName)",
                "Speak expense to \(.applicationName)",
                "Bicara pengeluaran di \(.applicationName)"
            ],
            shortTitle: "Dikte Suara",
            systemImageName: "mic.fill"
        )
        AppShortcut(
            intent: OpenQuickAddIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Open quick add in \(.applicationName)",
                "Buka pencatatan di \(.applicationName)"
            ],
            shortTitle: "Buka Catat Cepat",
            systemImageName: "square.and.pencil"
        )
        AppShortcut(
            intent: OpenScanReceiptIntent(),
            phrases: [
                "Scan receipt in \(.applicationName)",
                "Pindai resi di \(.applicationName)"
            ],
            shortTitle: "Pindai Resi",
            systemImageName: "camera.viewfinder"
        )
        AppShortcut(
            intent: GetFinancialSummaryIntent(),
            phrases: [
                "Financial summary in \(.applicationName)",
                "Get net worth in \(.applicationName)",
                "Ringkasan keuangan di \(.applicationName)",
                "Cek saldo di \(.applicationName)"
            ],
            shortTitle: "Cek Ringkasan",
            systemImageName: "chart.pie.fill"
        )
    }
}
#endif
