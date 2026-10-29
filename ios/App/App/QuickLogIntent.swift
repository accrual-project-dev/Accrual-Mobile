#if canImport(AppIntents)
import Foundation
import AppIntents
import SwiftUI
import Vision
import UIKit
import CryptoKit
import UserNotifications

/// ======================================================================
/// ACCRUAL APP INTENTS & INGESTION ARCHITECTURE (iOS 16.0+)
/// Background Auto-Ingestion Suite (Screenshot & Notification Channels)
/// - Jalur A (Screenshot): Back Tap / Action Button -> Vision OCR -> DraftInbox
/// - Jalur B (Notification): iOS Automation -> Notification Parser -> DraftInbox
/// - Background execution: openAppWhenRun = false (Zero UI / Camera disruption)
/// - File-based atomic transport in App Group: group.com.syntheticae.accrual/inbox/
/// ======================================================================

// MARK: - 1. Shared Ingestion Domain Models

public struct DraftPayload: Codable {
    public var schema_version: Int = 1
    public var id: String                 // dedupe_key (SHA256)
    public var source: String             // shortcut_screenshot | shortcut_notification | share_extension
    public var captured_at: Date
    public var amount: Int                // Rupiah integer
    public var currency: String = "IDR"
    public var merchant: String?
    public var transaction_date: Date
    public var wallet_hint: String?
    public var direction: String          // expense | income | unknown
    public var confidence: Double
    public var raw_text: String

    public init(
        schema_version: Int = 1,
        id: String,
        source: String,
        captured_at: Date = Date(),
        amount: Int,
        currency: String = "IDR",
        merchant: String? = nil,
        transaction_date: Date = Date(),
        wallet_hint: String? = nil,
        direction: String = "expense",
        confidence: Double = 0.8,
        raw_text: String
    ) {
        self.schema_version = schema_version
        self.id = id
        self.source = source
        self.captured_at = captured_at
        self.amount = amount
        self.currency = currency
        self.merchant = merchant
        self.transaction_date = transaction_date
        self.wallet_hint = wallet_hint
        self.direction = direction
        self.confidence = confidence
        self.raw_text = raw_text
    }
}

public enum DraftInbox {
    public static let group = "group.com.syntheticae.accrual"

    public static var dir: URL {
        let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
            ?? FileManager.default.temporaryDirectory
        let d = base.appendingPathComponent("inbox", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    public static func write(_ d: DraftPayload) throws {
        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .iso8601
        let fileUrl = dir.appendingPathComponent("\(d.id).json")
        try enc.encode(d).write(to: fileUrl, options: .atomic)
    }

    public static func pendingCount() -> Int {
        ((try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [])
            .filter { $0.hasSuffix(".json") }.count
    }

    public static func updateBadge() {
        let count = pendingCount()
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(count) { _ in }
        } else {
            DispatchQueue.main.async {
                UIApplication.shared.applicationIconBadgeNumber = count
            }
        }
    }
}

// MARK: - 2. On-Device Vision OCR

public enum OCR {
    public static func recognize(data: Data) async throws -> String {
        try await Task.detached(priority: .userInitiated) {
            let req = VNRecognizeTextRequest()
            req.recognitionLevel = .accurate
            req.usesLanguageCorrection = false
            let supported = (try? req.supportedRecognitionLanguages()) ?? []
            req.recognitionLanguages = supported.contains("id-ID") ? ["id-ID", "en-US"] : ["en-US"]
            try VNImageRequestHandler(data: data).perform([req])
            return (req.results ?? [])
                .compactMap { $0.topCandidates(1).first?.string }
                .joined(separator: "\n")
        }.value
    }
}

// MARK: - 3. Transaction Parser & Deduplication Engine

public enum DraftParser {
    public static let promoWords = [
        "diskon", "cashback", "voucher", "promo", "reward", "kupon", "poin",
        "hadiah", "hemat", "sale", "discount", "offer", "bonus", "spesial",
        "berhadiah", "gratis ongkir", "special deal"
    ]
    public static let otpWords = ["otp", "kode verifikasi", "jangan berikan", "security code", "one-time password"]
    public static let expenseWords = [
        "pembayaran", "dibayar", "transfer ke", "berhasil membayar", "keluar",
        "pembelian", "debit", "debet", "terbayar", "paid", "sent", "payment", "spent"
    ]
    public static let incomeWords = [
        "diterima", "menerima", "dana masuk", "top up berhasil", "masuk",
        "kredit", "setor tunai", "received", "top-up"
    ]
    public static let walletMap = [
        "gopay": "gopay", "dana": "dana", "ovo": "ovo", "mybca": "bca", "bca": "bca",
        "livin": "mandiri", "mandiri": "mandiri", "brimo": "bri", "bri": "bri",
        "bni": "bni", "wondr": "bni", "shopeepay": "shopeepay", "seabank": "seabank",
        "jago": "jago", "jenius": "jenius"
    ]

    public static func parse(
        text: String,
        title: String? = nil,
        subtitle: String? = nil,
        app: String? = nil,
        source: String,
        at: Date
    ) -> DraftPayload? {
        let blob = [title, subtitle, text].compactMap { $0 }.joined(separator: "\n")
        let low = blob.lowercased()
        let hasExpense = expenseWords.contains { low.contains($0) }
        let hasIncome = incomeWords.contains { low.contains($0) }

        if source == "shortcut_notification" {
            if otpWords.contains(where: { low.contains($0) }) { return nil }
            // Filter out purely promotional notifications unless explicit transaction verb exists
            if promoWords.contains(where: { low.contains($0) }) && !(hasExpense || hasIncome) { return nil }
        }

        guard let amount = firstRupiah(in: blob) else { return nil }

        let dir = hasExpense ? "expense" : (hasIncome ? "income" : "unknown")
        let appKey = (app ?? "").lowercased().replacingOccurrences(of: " ", with: "")
        let wallet = walletMap.first { appKey.contains($0.key) }?.value
        let merch = merchant(in: blob)

        var conf = 0.5
        if dir != "unknown" { conf += 0.2 }
        if merch != nil { conf += 0.1 }
        if wallet != nil { conf += 0.1 }

        let minute = Int(at.timeIntervalSince1970 / 60)
        let key = sha("\(appKey)|\(amount)|\(minute)|\(dir)")
        return DraftPayload(
            id: key,
            source: source,
            captured_at: Date(),
            amount: amount,
            merchant: merch,
            transaction_date: at,
            wallet_hint: wallet,
            direction: dir,
            confidence: conf,
            raw_text: blob
        )
    }

    public static func firstRupiah(in s: String) -> Int? {
        guard let r = s.range(of: "Rp", options: .caseInsensitive) else { return nil }
        var digits = ""
        var seenComma = false
        for ch in s[r.upperBound...] {
            if ch.isNumber {
                if !seenComma { digits.append(ch) }
            } else if ch == "." || (ch == " " && digits.isEmpty) {
                continue
            } else if ch == "," {
                seenComma = true
            } else {
                break
            }
        }
        return Int(digits)
    }

    public static func merchant(in s: String) -> String? {
        for marker in [" ke ", " di ", " kepada "] {
            guard let r = s.range(of: marker, options: .caseInsensitive) else { continue }
            var name = String(s[r.upperBound...].prefix(while: { $0 != "\n" && $0 != "," }))
            for stop in [" berhasil", " pada ", " sebesar", " Rp", " senilai"] {
                if let sr = name.range(of: stop, options: .caseInsensitive) {
                    name = String(name[..<sr.lowerBound])
                }
            }
            name = name.trimmingCharacters(in: .whitespaces)
            if (2...40).contains(name.count) { return name }
        }
        return nil
    }

    public static func sha(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - 4. App Intents

/// Jalur A: Catat dari Layar (Screenshot Ingestion via Back Tap / Action Button)
/// Kept for backward compatibility, marked non-discoverable to avoid duplicate listing
@available(iOS 16.0, *)
public struct LogScreenshotIntent: AppIntent {
    public static var title: LocalizedStringResource = "Scan Payment Screenshot"
    public static var description = IntentDescription("Scan payment screenshot and save as draft into Accrual.")
    public static var openAppWhenRun: Bool = false
    public static var isDiscoverable: Bool = false

    @Parameter(title: "Screenshot Image", description: "Payment screenshot image to parse")
    public var screenshot: IntentFile

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        do {
            let text = try await OCR.recognize(data: screenshot.data)
            guard let draft = DraftParser.parse(text: text, source: "shortcut_screenshot", at: Date()) else {
                return .result(dialog: IntentDialog("Nominal tidak terbaca. Pastikan bukti transaksi terlihat jelas."))
            }
            try DraftInbox.write(draft)
            DraftInbox.updateBadge()
            return .result(dialog: IntentDialog("Tercatat ke Accrual. \(DraftInbox.pendingCount()) draft menunggu persetujuan."))
        } catch {
            return .result(dialog: IntentDialog("Gagal membaca tangkapan layar. Silakan coba lagi."))
        }
    }
}

/// Jalur B: Catat Notifikasi Bank / E-Wallet (iOS Personal Automations)
@available(iOS 16.0, *)
public struct LogNotificationTransactionIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Notification Transaction"
    public static var description = IntentDescription("Log bank or e-wallet notification into Accrual draft queue.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Notification")
    public var notificationText: String?

    @Parameter(title: "Body")
    public var body: String?

    @Parameter(title: "Title")
    public var title: String?

    @Parameter(title: "Notif Title")
    public var notifTitle: String?

    @Parameter(title: "Subtitle")
    public var subtitle: String?

    @Parameter(title: "Notif Subtitle")
    public var notifSubtitle: String?

    @Parameter(title: "App")
    public var sourceApp: String?

    @Parameter(title: "Received At")
    public var receivedAt: Date?

    public static var parameterSummary: some ParameterSummary {
        Summary("Log notification \(\.$notificationText) titled \(\.$title) subtitled \(\.$subtitle) from \(\.$sourceApp) at \(\.$receivedAt)")
    }

    public init() {}

    public func perform() async throws -> some IntentResult {
        let rawText = (notificationText ?? body ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawText.isEmpty else { return .result() }

        let rawTitle = (title ?? notifTitle)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let rawSubtitle = (subtitle ?? notifSubtitle)?.trimmingCharacters(in: .whitespacesAndNewlines)

        if let draft = DraftParser.parse(
            text: rawText,
            title: rawTitle,
            subtitle: rawSubtitle,
            app: sourceApp,
            source: "shortcut_notification",
            at: receivedAt ?? Date()
        ) {
            try? DraftInbox.write(draft)
            DraftInbox.updateBadge()
        }
        return .result() // Silent execution in background
    }
}

/// Buka Draft Accrual Intent
@available(iOS 16.0, *)
public struct OpenInboxIntent: AppIntent {
    public static var title: LocalizedStringResource = "Open Draft Inbox"
    public static var description = IntentDescription("Open and review pending draft transactions in Accrual.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    public func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: DraftInbox.group) ?? UserDefaults.standard
        defaults.set("review", forKey: "pending_intent_navigation")
        defaults.synchronize()
        // Deep-link target: accrual://inbox
        return .result()
    }
}

/// Canonical: Scan Payment Screenshot Intent (routes to DraftInbox)
@available(iOS 16.0, *)
public struct ScanPaymentScreenshotIntent: AppIntent {
    public static var title: LocalizedStringResource = "Scan Payment Screenshot"
    public static var description = IntentDescription("Add a transaction by scanning a payment screenshot or QRIS confirmation.")
    public static var openAppWhenRun: Bool = true

    @Parameter(title: "Screenshot Image", description: "Payment screenshot image to parse")
    public var screenshot: IntentFile?

    @Parameter(title: "Extracted Text", description: "Optional pre-extracted text from image")
    public var extractedText: String?

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        var recognizedText = (extractedText ?? "")
            .replacingOccurrences(of: "\u{FFFC}", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let hasAlphanumerics = recognizedText.rangeOfCharacter(from: .alphanumerics) != nil
        if (!hasAlphanumerics || recognizedText.count < 4), let file = screenshot {
            recognizedText = (try? await OCR.recognize(data: file.data)) ?? ""
        }

        if !recognizedText.isEmpty,
           let draft = DraftParser.parse(text: recognizedText, source: "shortcut_screenshot", at: Date()) {
            try? DraftInbox.write(draft)
            DraftInbox.updateBadge()
            return .result(dialog: IntentDialog("Tercatat ke Accrual. \(DraftInbox.pendingCount()) draft menunggu persetujuan."))
        }

        return .result(dialog: IntentDialog("Tangkapan layar belum dapat diproses. Coba lagi dari layar bukti transfer."))
    }
}

/// Voice Entry Intent (Siri / Action Button)
@available(iOS 16.0, *)
public struct VoiceLogExpenseIntent: AppIntent {
    public static var title: LocalizedStringResource = "Voice Entry"
    public static var description = IntentDescription("Add a transaction by speaking naturally.")
    public static var openAppWhenRun: Bool = true

    @Parameter(title: "Speech")
    public var spokenText: String?

    public static var parameterSummary: some ParameterSummary {
        Summary("Log expense with speech: \(\.$spokenText)")
    }

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let text = spokenText, !text.trimmingCharacters(in: .whitespaces).isEmpty else {
            let defaults = UserDefaults(suiteName: DraftInbox.group) ?? UserDefaults.standard
            defaults.set("voice", forKey: "pending_intent_navigation")
            defaults.synchronize()
            return .result(dialog: IntentDialog("Membuka pencatat suara Accrual."))
        }

        let record: [String: Any] = [
            "id": UUID().uuidString,
            "text": text,
            "source": "voice",
            "createdAt": Date().timeIntervalSince1970
        ]

        let defaults = UserDefaults(suiteName: DraftInbox.group) ?? UserDefaults.standard
        var pending = defaults.array(forKey: "pending_backtap_voice") as? [[String: Any]] ?? []
        pending.append(record)
        defaults.set(pending, forKey: "pending_backtap_voice")
        defaults.set("voice", forKey: "pending_intent_navigation")
        defaults.synchronize()

        return .result(dialog: IntentDialog("Suara berhasil dicatat: \"\(text)\""))
    }
}

/// Log Card Transaction Intent (Card / contactless tap)
@available(iOS 16.0, *)
public struct LogCardTransactionIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Card Transaction"
    public static var description = IntentDescription("Sync card and contactless transactions directly to Accrual.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Amount")
    public var amount: Double?

    @Parameter(title: "Merchant")
    public var merchant: String?

    @Parameter(title: "Card")
    public var cardName: String?

    public static var parameterSummary: some ParameterSummary {
        Summary("Log card transaction \(\.$amount) at \(\.$merchant) with \(\.$cardName)")
    }

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let amount = amount, amount > 0 else {
            throw $amount.needsValueError("Please specify the transaction amount.")
        }

        let merchantVal = merchant?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Kartu"
        let cardVal = cardName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Kartu"

        let draft = DraftPayload(
            id: DraftParser.sha("\(cardVal)|\(Int(amount))|\(Int(Date().timeIntervalSince1970 / 60))|expense"),
            source: "card_transaction",
            captured_at: Date(),
            amount: Int(amount),
            merchant: merchantVal,
            transaction_date: Date(),
            wallet_hint: cardVal,
            direction: "expense",
            confidence: 0.9,
            raw_text: "Card: \(cardVal) - \(merchantVal) - Rp \(Int(amount))"
        )
        try? DraftInbox.write(draft)
        DraftInbox.updateBadge()

        let formattedAmount = String(format: "%.0f", amount)
        return .result(dialog: IntentDialog("Transaksi kartu Rp \(formattedAmount) di \(merchantVal) berhasil dicatat."))
    }
}

/// Camera Scanner Manual Intent (Used when user explicitly triggers receipt camera)
@available(iOS 16.0, *)
public struct ScanReceiptCameraIntent: AppIntent {
    public static var title: LocalizedStringResource = "Scan Receipt Camera"
    public static var description = IntentDescription("Open physical receipt camera scanner in Accrual.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    public func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: DraftInbox.group) ?? UserDefaults.standard
        defaults.set("scan", forKey: "pending_intent_navigation")
        defaults.synchronize()
        // Deep-link target: accrual://scan
        return .result()
    }
}

/// Quick Add Intent (Direct keypad entry modal)
@available(iOS 16.0, *)
public struct OpenQuickAddIntent: AppIntent {
    public static var title: LocalizedStringResource = "Quick Add"
    public static var description = IntentDescription("Open Accrual transaction entry keypad.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    public func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: DraftInbox.group) ?? UserDefaults.standard
        defaults.set("add", forKey: "pending_intent_navigation")
        defaults.synchronize()
        // Deep-link target: accrual://add
        return .result()
    }
}

// MARK: - 5. Accrual AppShortcutsProvider

@available(iOS 16.0, *)
public struct AccrualShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenInboxIntent(),
            phrases: [
                "Buka draft di \(.applicationName)",
                "Open drafts in \(.applicationName)",
                "Tinjau transaksi di \(.applicationName)"
            ],
            shortTitle: "Draft",
            systemImageName: "tray.full"
        )
        AppShortcut(
            intent: VoiceLogExpenseIntent(),
            phrases: [
                "Voice entry in \(.applicationName)",
                "Catat suara di \(.applicationName)"
            ],
            shortTitle: "Voice Entry",
            systemImageName: "mic.fill"
        )
        AppShortcut(
            intent: ScanPaymentScreenshotIntent(),
            phrases: [
                "Scan payment screenshot in \(.applicationName)",
                "Pindai pembayaran di \(.applicationName)"
            ],
            shortTitle: "Scan Payment",
            systemImageName: "doc.viewfinder.fill"
        )
    }
}

#endif
