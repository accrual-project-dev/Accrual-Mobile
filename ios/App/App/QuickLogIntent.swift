#if canImport(AppIntents)
import Foundation
import AppIntents
import SwiftUI

/// ======================================================================
/// ACCRUAL APP INTENTS & SHORTCUTS SUITE (iOS 16.0+)
/// Advanced Native iOS Financial Automation Architecture:
/// - Rule 1: No native colored emojis (SF Symbols vector iconography)
/// - Rule 2: Monochrome Apple Luxury Theme (Obsidian & Frosted Glass)
/// - Rule 6: 100% pure localization support
///
/// 6 Native Actions:
/// 1. Log Notification Transaction (Automations: "When I receive a notification from [Apps]")
/// 2. Log Apple Pay Transaction (Automations: "When an Apple Pay transaction occurs")
/// 3. Voice Entry (Shortcuts: Siri, Action Button, Voice Entry)
/// 4. Scan Payment Screenshot (Shortcuts: Back Tap, Screenshot OCR)
/// 5. Open Accrual Quick Action (Shortcuts: 1-Tap Entry)
/// 6. Scan Receipt (Shortcuts: Receipt / Invoice Camera)
/// ======================================================================

/// 1. Log Notification Transaction Intent
/// Specially built for iOS Shortcuts Personal Automations (Screenshot 3 & 4)
/// Parameter Summary: "Log notification [Notification] titled [Title] subtitled [Subtitle] from [App] at [Received At]"
@available(iOS 16.0, *)
struct LogNotificationTransactionIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Notification Transaction"
    static var description = IntentDescription("Log transactions from notifications of your bank or e-wallet apps.")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Notification")
    var notificationText: String?

    @Parameter(title: "Title")
    var title: String?

    @Parameter(title: "Subtitle")
    var subtitle: String?

    @Parameter(title: "App")
    var sourceApp: String?

    @Parameter(title: "Received At")
    var receivedAt: Date?

    static var parameterSummary: some ParameterSummary {
        Summary("Log notification \(\.$notificationText) titled \(\.$title) subtitled \(\.$subtitle) from \(\.$sourceApp) at \(\.$receivedAt)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let combined = [sourceApp, title, subtitle, notificationText]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " - ")

        guard !combined.isEmpty else {
            return .result(dialog: IntentDialog("Notifikasi kosong diabaikan."))
        }

        let lower = combined.lowercased()

        // Smart Promo & Spam Filtering Engine
        let promoKeywords = [
            "diskon", "cashback", "voucher", "promo", "reward", "kupon", "poin",
            "hadiah", "hemat", "sale", "discount", "offer", "bonus", "spesial",
            "berhadiah", "gratis ongkir", "special deal"
        ]
        let financeKeywords = [
            "transfer", "debit", "kredit", "pembayaran", "berhasil", "sukses",
            "rp", "idr", "keluar", "masuk", "paid", "received", "sent", "payment",
            "spent", "qris", "top up", "top-up", "va ", "rekening", "saldo",
            "tarik tunai", "setor tunai"
        ]

        let isPromo = promoKeywords.contains { lower.contains($0) }
        let hasFinance = financeKeywords.contains { lower.contains($0) }

        if isPromo && !hasFinance {
            return .result(dialog: IntentDialog("Notifikasi promo diabaikan."))
        }

        let record: [String: Any] = [
            "id": UUID().uuidString,
            "text": combined,
            "sourceApp": sourceApp ?? "",
            "title": title ?? "",
            "createdAt": Date().timeIntervalSince1970
        ]

        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        var pending = defaults.array(forKey: "pending_backtap_voice") as? [[String: Any]] ?? []
        pending.append(record)
        defaults.set(pending, forKey: "pending_backtap_voice")

        let appName = sourceApp ?? "Bank"
        let displayDialog: LocalizedStringResource = "Notifikasi \(appName) berhasil dicatat ke Accrual."
        return .result(dialog: IntentDialog(displayDialog))
    }
}

/// 2. Log Apple Pay Transaction Intent
/// Parameter Summary: "Log Apple Pay [Amount] at [Merchant] with [Card]"
@available(iOS 16.0, *)
struct LogApplePayTransactionIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Apple Pay Transaction"
    static var description = IntentDescription("Sync Apple Pay transactions directly to Accrual.")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Amount")
    var amount: Double?

    @Parameter(title: "Merchant")
    var merchant: String?

    @Parameter(title: "Card")
    var cardName: String?

    @Parameter(title: "Currency")
    var currency: String?

    @Parameter(title: "Date")
    var transactionDate: Date?

    static var parameterSummary: some ParameterSummary {
        Summary("Log Apple Pay \(\.$amount) at \(\.$merchant) with \(\.$cardName)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let amount = amount, amount > 0 else {
            throw $amount.needsValueError("Berapa nominal transaksi Apple Pay?")
        }

        let dateVal = transactionDate ?? Date()
        let merchantVal = merchant?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Apple Pay"
        let cardVal = cardName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Apple Pay"

        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard

        // Deduplication guard: ignore duplicate Apple Pay events within 10 minutes
        let lastLoggedKey = "last_apple_pay_hash"
        let lastLoggedTimeKey = "last_apple_pay_time"
        let currentHash = "\(amount)_\(merchantVal)_\(cardVal)"
        let currentTime = Date().timeIntervalSince1970

        if let prevHash = defaults.string(forKey: lastLoggedKey),
           prevHash == currentHash {
            let prevTime = defaults.double(forKey: lastLoggedTimeKey)
            if currentTime - prevTime < 600 {
                return .result(dialog: IntentDialog("Transaksi duplikat diabaikan."))
            }
        }

        defaults.set(currentHash, forKey: lastLoggedKey)
        defaults.set(currentTime, forKey: lastLoggedTimeKey)

        let record: [String: Any] = [
            "id": UUID().uuidString,
            "amount": amount,
            "category": "Umum",
            "wallet": cardVal,
            "date": ISO8601DateFormatter().string(from: dateVal),
            "note": "Apple Pay: \(merchantVal)",
            "createdAt": currentTime
        ]

        var pending = defaults.array(forKey: "pending_backtap_transactions") as? [[String: Any]] ?? []
        pending.append(record)
        defaults.set(pending, forKey: "pending_backtap_transactions")

        let formattedAmount = String(format: "%.0f", amount)
        let displayDialog: LocalizedStringResource = "Apple Pay \(formattedAmount) di \(merchantVal) berhasil dicatat."
        return .result(dialog: IntentDialog(displayDialog))
    }
}

/// 3. Voice Entry Intent
/// Spoken transaction logger for Siri, Action Button, and Shortcuts
@available(iOS 16.0, *)
struct VoiceLogExpenseIntent: AppIntent {
    static var title: LocalizedStringResource = "Voice Entry"
    static var description = IntentDescription("Add a transaction by speaking naturally.")

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
            "source": "voice",
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

/// 4. Scan Payment Screenshot Intent (Screen Scanner)
/// Parameter Summary: "Pindai tangkapan layar transaksi [Extracted Text]"
@available(iOS 16.0, *)
struct ScanPaymentScreenshotIntent: AppIntent {
    static var title: LocalizedStringResource = "Scan Payment Screenshot"
    static var description = IntentDescription("Add a transaction by scanning a payment screenshot or QRIS confirmation.")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Teks dari Gambar")
    var extractedText: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Pindai tangkapan layar transaksi \(\.$extractedText)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard

        if let text = extractedText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let record: [String: Any] = [
                "id": UUID().uuidString,
                "text": text,
                "source": "screenshot_ocr",
                "createdAt": Date().timeIntervalSince1970
            ]
            var pending = defaults.array(forKey: "pending_backtap_voice") as? [[String: Any]] ?? []
            pending.append(record)
            defaults.set(pending, forKey: "pending_backtap_voice")
            return .result(dialog: IntentDialog("Tangkapan layar berhasil diproses ke Accrual."))
        }

        defaults.set("scan", forKey: "pending_intent_navigation")
        return .result(dialog: IntentDialog("Membuka pemindai Accrual."))
    }
}

/// 5. Open Accrual Quick Action Intent
/// Direct launcher for new transaction keypad sheet
@available(iOS 16.0, *)
struct OpenQuickAddIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Accrual Quick Action"
    static var description = IntentDescription("Instantly launch into the new transaction keypad sheet.")

    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        defaults.set("add", forKey: "pending_intent_navigation")
        return .result()
    }
}

/// 6. Scan Receipt Intent
/// Direct launcher for receipt & invoice camera
@available(iOS 16.0, *)
struct OpenScanReceiptIntent: AppIntent {
    static var title: LocalizedStringResource = "Scan Receipt"
    static var description = IntentDescription("Open the camera scanner for receipts and invoices in Accrual.")

    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        let suiteName = "group.com.syntheticae.accrual"
        let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        defaults.set("scan", forKey: "pending_intent_navigation")
        return .result()
    }
}

/// 7. Quick Log Expense Intent (Backward-Compatibility)
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

/// 8. Log Transaction from Text Intent (Backward-Compatibility)
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

/// 9. Get Financial Summary Intent (Backward-Compatibility)
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
/// Automatically registers 6 native actions into iOS Shortcuts App
@available(iOS 16.0, *)
struct AccrualShortcutsProvider: AppShortcutsProvider {
    static var shortcutTileColor: ShortcutTileColor = .grayBlue

    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogNotificationTransactionIntent(),
            phrases: [
                "Log notification to \(.applicationName)",
                "Catat notifikasi di \(.applicationName)"
            ],
            shortTitle: "Log Notification Transaction",
            systemImageName: "bell.badge.fill"
        )
        AppShortcut(
            intent: LogApplePayTransactionIntent(),
            phrases: [
                "Log Apple Pay in \(.applicationName)",
                "Catat Apple Pay di \(.applicationName)"
            ],
            shortTitle: "Log Apple Pay Transaction",
            systemImageName: "creditcard.fill"
        )
        AppShortcut(
            intent: VoiceLogExpenseIntent(),
            phrases: [
                "Voice entry in \(.applicationName)",
                "Voice log to \(.applicationName)",
                "Dikte pengeluaran di \(.applicationName)"
            ],
            shortTitle: "Voice Entry",
            systemImageName: "mic.fill"
        )
        AppShortcut(
            intent: ScanPaymentScreenshotIntent(),
            phrases: [
                "Scan payment screenshot with \(.applicationName)",
                "Pindai tangkapan layar di \(.applicationName)"
            ],
            shortTitle: "Scan Payment Screenshot",
            systemImageName: "camera.viewfinder"
        )
        AppShortcut(
            intent: OpenQuickAddIntent(),
            phrases: [
                "Open \(.applicationName) quick action",
                "Open quick action in \(.applicationName)",
                "Buka catat cepat di \(.applicationName)"
            ],
            shortTitle: "Open Accrual Quick Action",
            systemImageName: "square.and.pencil"
        )
        AppShortcut(
            intent: OpenScanReceiptIntent(),
            phrases: [
                "Scan receipt in \(.applicationName)",
                "Pindai resi di \(.applicationName)"
            ],
            shortTitle: "Scan Receipt",
            systemImageName: "doc.viewfinder.fill"
        )
    }
}
#endif
