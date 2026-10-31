#if canImport(AppIntents)
import Foundation
import AppIntents
import SwiftUI
import Vision
import UIKit
import UserNotifications
import Darwin

/// Raw capture transport. Financial interpretation and duplicate review belong to the app.
public struct DraftPayload: Codable {
    public var schema_version = 2
    public var id = UUID().uuidString
    public var source: String
    public var captured_at = Date()
    public var transaction_date: Date
    public var raw_text: String
    public var owner_id: String
    public var source_app: String?
    public var title: String?
    public var subtitle: String?
    public var amount = 0
    public var currency = "IDR"
    public var direction = "unknown"
    public var confidence = 0.0
}

public enum CaptureError: LocalizedError {
    case unavailable, noOwner, ownerChanged, empty, invalidID
    public var errorDescription: String? {
        switch self {
        case .unavailable: return CaptureLanguage.text("Shared capture storage is unavailable.", "Penyimpanan tangkapan bersama tidak tersedia.")
        case .noOwner: return CaptureLanguage.text("Open Accrual and sign in before capturing.", "Buka Accrual dan masuk sebelum membuat tangkapan.")
        case .ownerChanged: return CaptureLanguage.text("Your session changed. Capture again in the current session.", "Sesi Anda berubah. Buat tangkapan kembali dalam sesi saat ini.")
        case .empty: return CaptureLanguage.text("No readable text was captured.", "Tidak ada teks terbaca yang ditangkap.")
        case .invalidID: return CaptureLanguage.text("Invalid capture identifier.", "Identitas tangkapan tidak valid.")
        }
    }
}

public enum CaptureLanguage {
    public static func text(_ en: String, _ id: String) -> String {
        Locale.preferredLanguages.first?.hasPrefix("id") == true ? id : en
    }
}

public enum DraftInbox {
    public static let group = "group.com.syntheticae.accrual"
    public static let ownerKey = "accrual_capture_owner_id"
    public static let defaultFallbackOwner = "guest_local_user"

    /// Serialize ownership snapshots, migration and acknowledgements across app/intent processes.
    public static func withLock<T>(_ action: () throws -> T) throws -> T {
        let lockFile = try directory().appendingPathComponent(".capture.lock")
        let descriptor = open(lockFile.path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw CaptureError.unavailable }
        defer { close(descriptor) }
        guard flock(descriptor, LOCK_EX) == 0 else { throw CaptureError.unavailable }
        defer { flock(descriptor, LOCK_UN) }
        return try action()
    }

    public static func defaults() throws -> UserDefaults {
        guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) != nil,
              let defaults = UserDefaults(suiteName: group) else { throw CaptureError.unavailable }
        defaults.synchronize()
        return defaults
    }

    public static func directory() throws -> URL {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
            throw CaptureError.unavailable
        }
        let directory = base.appendingPathComponent("inbox", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    public static func validID(_ id: String) -> Bool {
        UUID(uuidString: id) != nil || id.range(of: "^[a-fA-F0-9]{64}$", options: .regularExpression) != nil
    }

    /// Resolves active owner or initializes a safe local fallback owner so background Personal Automations
    /// (Notification & Wallet Tap) never fail silently when run while the app is closed.
    public static func currentOwner() throws -> String {
        try withLock {
            let defs = try defaults()
            if let owner = defs.string(forKey: ownerKey), !owner.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return owner
            }
            defs.set(defaultFallbackOwner, forKey: ownerKey)
            defs.synchronize()
            return defaultFallbackOwner
        }
    }

    /// Foundation-only rule shared by capture transport and the native test harness.
    public static func validOwnerSnapshot(_ snapshot: String, currentOwner: String?) -> Bool {
        guard !snapshot.isEmpty else { return false }
        guard let active = currentOwner, !active.isEmpty else { return true }
        return active == snapshot
    }

    /// Parses Indonesian / international currency strings ("Rp 50.000", "50,000", "50000") into integer amount.
    public static func parseFlexibleAmount(_ raw: String?) -> Int {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return 0 }
        let cleaned = raw.replacingOccurrences(of: "[^0-9.,]", with: "", options: .regularExpression)
        guard !cleaned.isEmpty else { return 0 }

        var normalized = cleaned
        if normalized.contains(".") && normalized.contains(",") {
            if let lastDot = normalized.lastIndex(of: "."), let lastComma = normalized.lastIndex(of: ",") {
                if lastComma > lastDot {
                    normalized = normalized.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
                } else {
                    normalized = normalized.replacingOccurrences(of: ",", with: "")
                }
            }
        } else if normalized.contains(".") {
            let parts = normalized.split(separator: ".")
            if parts.last?.count == 3 || parts.count > 2 {
                normalized = normalized.replacingOccurrences(of: ".", with: "")
            }
        } else if normalized.contains(",") {
            let parts = normalized.split(separator: ",")
            if parts.last?.count == 3 || parts.count > 2 {
                normalized = normalized.replacingOccurrences(of: ",", with: "")
            } else {
                normalized = normalized.replacingOccurrences(of: ",", with: ".")
            }
        }

        if let val = Double(normalized), val > 0 {
            return Int(val.rounded())
        }
        return 0
    }

    public static func capture(
        text: String,
        source: String,
        ownerSnapshot: String,
        at: Date = Date(),
        app: String? = nil,
        title: String? = nil,
        subtitle: String? = nil,
        amount: Int = 0
    ) throws {
        guard ![title, subtitle, text].compactMap({ $0 }).joined().trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || amount > 0 else {
            throw CaptureError.empty
        }
        try withLock {
            let defs = try defaults()
            let activeOwner = defs.string(forKey: ownerKey)
            let resolvedOwner = (activeOwner?.isEmpty == false) ? activeOwner! : ownerSnapshot
            guard validOwnerSnapshot(ownerSnapshot, currentOwner: resolvedOwner) else { throw CaptureError.ownerChanged }
            let payload = DraftPayload(
                source: source,
                transaction_date: at,
                raw_text: text,
                owner_id: resolvedOwner,
                source_app: app,
                title: title,
                subtitle: subtitle,
                amount: amount
            )
            try write(payload)
        }
        updateBadge(forOwner: ownerSnapshot)
    }

    public static func write(_ payload: DraftPayload) throws {
        guard validID(payload.id) else { throw CaptureError.invalidID }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let file = try directory().appendingPathComponent("\(payload.id).json")
        try encoder.encode(payload).write(to: file, options: .atomic)
    }

    public static func updateBadge(forOwner owner: String? = nil) {
        guard let directory = try? directory(),
              let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return }
        let activeOwner = owner ?? (try? defaults().string(forKey: ownerKey))
        var count = 0
        for file in files where file.pathExtension == "json" {
            if let activeOwner = activeOwner, !activeOwner.isEmpty {
                if let data = try? Data(contentsOf: file),
                   let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let fileOwner = obj["owner_id"] as? String,
                   (fileOwner == activeOwner || fileOwner == defaultFallbackOwner) {
                    count += 1
                }
            } else {
                count += 1
            }
        }
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(count) { _ in }
        }
    }

    public static func notifyCapture(title: String, body: String) {
        let center = UNUserNotificationCenter.current()
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.25, repeats: false)
        let req = UNNotificationRequest(identifier: "accrual-shortcut-\(UUID().uuidString)", content: content, trigger: trigger)
        center.add(req, withCompletionHandler: nil)
    }

    public static func navigate(_ target: String) throws {
        try withLock {
            let defaults = try defaults()
            defaults.set(target, forKey: "pending_intent_navigation")
            defaults.synchronize()
        }
    }
}

public enum OCR {
    public static func recognize(data: Data) async throws -> String {
        try await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = false
            let supported = (try? request.supportedRecognitionLanguages()) ?? []
            request.recognitionLanguages = supported.contains("id-ID") ? ["id-ID", "en-US"] : ["en-US"]
            try VNImageRequestHandler(data: data).perform([request])
            return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
        }.value
    }
}

@available(iOS 16.0, *)
public struct LogScreenshotIntent: AppIntent {
    public static var title: LocalizedStringResource = "Scan Payment Screenshot"
    public static var description = IntentDescription("Capture screenshot text for review in Accrual.")
    public static var openAppWhenRun = false
    public static var isDiscoverable = false
    @Parameter(title: "Screenshot Image") public var screenshot: IntentFile
    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let ownerSnapshot = try DraftInbox.currentOwner()
        let text = try await OCR.recognize(data: screenshot.data)
        try DraftInbox.capture(text: text, source: "shortcut_screenshot", ownerSnapshot: ownerSnapshot)
        DraftInbox.notifyCapture(
            title: CaptureLanguage.text("Receipt Captured to Draft", "Struk Masuk ke Draft Accrual"),
            body: CaptureLanguage.text("Open Accrual to review your scanned transaction.", "Buka Accrual untuk meninjau hasil pindai layar Anda.")
        )
        return .result(dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Captured for review in Accrual.", "Tangkapan siap ditinjau di Accrual.")))
    }
}

@available(iOS 16.0, *)
public struct ScanPaymentScreenshotIntent: AppIntent {
    public static var title: LocalizedStringResource = "Scan Payment Screenshot"
    public static var description = IntentDescription("Capture payment screenshot text for review in Accrual.")
    public static var openAppWhenRun = false
    @Parameter(title: "Screenshot Image") public var screenshot: IntentFile?
    @Parameter(title: "Extracted Text") public var extractedText: String?

    public static var parameterSummary: some ParameterSummary {
        Summary("Scan payment from \(\.$extractedText)") {
            \.$screenshot
        }
    }

    public init() {}
    public func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let ownerSnapshot = try DraftInbox.currentOwner()
        var text = (extractedText ?? "").replacingOccurrences(of: "\u{FFFC}", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty, let screenshot = screenshot {
            text = try await OCR.recognize(data: screenshot.data)
        }
        try DraftInbox.capture(text: text, source: "shortcut_screenshot", ownerSnapshot: ownerSnapshot)
        DraftInbox.notifyCapture(
            title: CaptureLanguage.text("Screen Scanned to Draft", "Layar Tercatat ke Draft"),
            body: CaptureLanguage.text("Open Accrual to review and confirm your transaction.", "Buka Accrual untuk meninjau dan menyimpan transaksi.")
        )
        return .result(
            value: "DELETE_SCREENSHOT",
            dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Captured for review in Accrual.", "Tangkapan siap ditinjau di Accrual."))
        )
    }
}

/// Simplified 1-Input Bank Notification Logger:
/// In iOS Personal Automation ("When I receive a notification"), users only need to pass "Shortcut Input" into `notificationText`.
/// Additional metadata fields remain in the expandable drawer for optional advanced mapping.
@available(iOS 16.0, *)
public struct LogNotificationTransactionIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Notification Transaction"
    public static var description = IntentDescription("Auto-capture bank or e-wallet notification text into Accrual Drafts.")
    public static var openAppWhenRun = false
    @Parameter(title: "Shortcut Input / Notification") public var notificationText: String?
    @Parameter(title: "Bank / App Name (Optional)") public var sourceApp: String?
    @Parameter(title: "Title (Optional)") public var title: String?
    @Parameter(title: "Subtitle (Optional)") public var subtitle: String?
    @Parameter(title: "Body (Optional)") public var body: String?
    @Parameter(title: "Notif Title") public var notifTitle: String?
    @Parameter(title: "Notif Subtitle") public var notifSubtitle: String?
    @Parameter(title: "Received At") public var receivedAt: Date?

    public static var parameterSummary: some ParameterSummary {
        Summary("Log bank notification \(\.$notificationText)") {
            \.$sourceApp
            \.$title
            \.$subtitle
            \.$receivedAt
        }
    }

    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let ownerSnapshot = try DraftInbox.currentOwner()
        let combinedText = [notificationText, body]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
        let effectiveTitle = (title ?? notifTitle)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let effectiveSubtitle = (subtitle ?? notifSubtitle)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let effectiveApp = sourceApp?.trimmingCharacters(in: .whitespacesAndNewlines)
        let extractedAmt = DraftInbox.parseFlexibleAmount(combinedText)

        try DraftInbox.capture(
            text: combinedText,
            source: "shortcut_notification",
            ownerSnapshot: ownerSnapshot,
            at: receivedAt ?? Date(),
            app: (effectiveApp?.isEmpty == false) ? effectiveApp : nil,
            title: (effectiveTitle?.isEmpty == false) ? effectiveTitle : nil,
            subtitle: (effectiveSubtitle?.isEmpty == false) ? effectiveSubtitle : nil,
            amount: extractedAmt
        )
        DraftInbox.notifyCapture(
            title: CaptureLanguage.text("Notification Queued to Draft", "Notifikasi Masuk ke Draft"),
            body: combinedText.isEmpty
                ? CaptureLanguage.text("Ready for review in Accrual.", "Siap ditinjau di Accrual.")
                : String(combinedText.prefix(90))
        )
        return .result(
            dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Notification saved to Accrual Drafts.", "Notifikasi disimpan ke Draft Accrual."))
        )
    }
}

/// Dialog Glass Intent: directly recorded into Transactions (does NOT enter Review/Draft),
/// and keeps Note completely empty when user does not type a note.
@available(iOS 16.0, *)
public struct LogQuickDraftIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Quick Draft Transaction"
    public static var description = IntentDescription("Directly record Dialog Glass transaction (amount, category, account, date & time, optional note) into Accrual.")
    public static var openAppWhenRun = false
    @Parameter(title: "Amount") public var amount: Double?
    @Parameter(title: "Category") public var category: String?
    @Parameter(title: "Account / Wallet") public var wallet: String?
    @Parameter(title: "Date & Time") public var transactionDate: Date?
    @Parameter(title: "Note") public var note: String?

    public static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$amount) for \(\.$category) from \(\.$wallet) on \(\.$transactionDate) with note \(\.$note)")
    }

    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let ownerSnapshot = try DraftInbox.currentOwner()
        let cleanAmount = Int(abs((amount ?? 0).rounded()))
        let cleanCategory = (category ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanWallet = (wallet ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanNote = (note ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        try DraftInbox.capture(
            text: cleanNote,
            source: "glass_dialog",
            ownerSnapshot: ownerSnapshot,
            at: transactionDate ?? Date(),
            app: cleanWallet.isEmpty ? nil : cleanWallet,
            title: cleanCategory.isEmpty ? nil : cleanCategory,
            subtitle: cleanNote.isEmpty ? nil : cleanNote,
            amount: cleanAmount
        )

        let formattedAmt = NumberFormatter.localizedString(from: NSNumber(value: cleanAmount), number: .decimal)
        let summaryParts = [
            "Rp\(formattedAmt)",
            cleanCategory.isEmpty ? nil : cleanCategory,
            cleanWallet.isEmpty ? nil : "(\(cleanWallet))",
            cleanNote.isEmpty ? nil : "• \(cleanNote)"
        ].compactMap { $0 }.joined(separator: " ")

        DraftInbox.notifyCapture(
            title: CaptureLanguage.text("Transaction Recorded", "Transaksi Berhasil Dicatat"),
            body: summaryParts
        )

        return .result(dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Transaction recorded in Accrual.", "Transaksi berhasil dicatat di Accrual.")))
    }
}

/// Retained with isDiscoverable = false for legacy saved shortcuts only (Smart Text UI removed).
@available(iOS 16.0, *)
public struct LogSmartTextIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Smart Text Transaction"
    public static var description = IntentDescription("Capture clipboard or transaction text for review in Accrual.")
    public static var openAppWhenRun = false
    public static var isDiscoverable = false
    @Parameter(title: "Transaction Text") public var text: String

    public static var parameterSummary: some ParameterSummary {
        Summary("Log text \(\.$text) to Accrual Draft")
    }

    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let ownerSnapshot = try DraftInbox.currentOwner()
        try DraftInbox.capture(text: text, source: "shortcut_screenshot", ownerSnapshot: ownerSnapshot)
        DraftInbox.notifyCapture(
            title: CaptureLanguage.text("Captured to Draft", "Masuk ke Draft Accrual"),
            body: String(text.prefix(90))
        )
        return .result(dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Captured for review in Accrual.", "Tangkapan siap ditinjau di Accrual.")))
    }
}

@available(iOS 16.0, *)
public struct OpenInboxIntent: AppIntent {
    public static var title: LocalizedStringResource = "Open Draft Inbox"
    public static var description = IntentDescription("Review captured transactions in Accrual.")
    public static var openAppWhenRun = true
    public init() {}
    public func perform() async throws -> some IntentResult {
        try DraftInbox.navigate("review")
        return .result()
    }
}

@available(iOS 16.0, *)
public struct VoiceLogExpenseIntent: AppIntent {
    public static var title: LocalizedStringResource = "Voice Entry"
    public static var description = IntentDescription("Capture spoken text for review in Accrual.")
    public static var openAppWhenRun = true
    @Parameter(title: "Speech") public var spokenText: String?
    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let ownerSnapshot = try DraftInbox.currentOwner()
        guard let text = spokenText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            try DraftInbox.navigate("voice")
            return .result(dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Opening voice entry in Accrual.", "Membuka pencatat suara di Accrual.")))
        }
        try DraftInbox.capture(text: text, source: "voice", ownerSnapshot: ownerSnapshot)
        try DraftInbox.navigate("review")
        return .result(dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Captured for review in Accrual.", "Tangkapan siap ditinjau di Accrual.")))
    }
}

/// Upgraded Wallet Card & NFC Tap Intent:
/// Supports 1-tap `Shortcut Input` (from iOS Wallet Transaction trigger) OR structured `Amount`, `Merchant`, and `Card / Account`.
@available(iOS 16.0, *)
public struct LogCardTransactionIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Card Transaction"
    public static var description = IntentDescription("Capture wallet card-tap or NFC transaction text for review in Accrual.")
    public static var openAppWhenRun = false
    public static var isDiscoverable = true
    @Parameter(title: "Shortcut Input / Transaction Details") public var transactionInput: String?
    @Parameter(title: "Amount (Optional)") public var amount: Double?
    @Parameter(title: "Merchant (Optional)") public var merchant: String?
    @Parameter(title: "Card or Account (Optional)") public var cardName: String?

    public static var parameterSummary: some ParameterSummary {
        Summary("Log card transaction \(\.$transactionInput) at \(\.$merchant) (\(\.$cardName))") {
            \.$amount
        }
    }

    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let ownerSnapshot = try DraftInbox.currentOwner()
        let cleanInput = (transactionInput ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanMerchant = (merchant ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanCard = (cardName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        var resolvedAmount = Int(abs((amount ?? 0).rounded()))
        if resolvedAmount <= 0 {
            resolvedAmount = DraftInbox.parseFlexibleAmount(cleanInput)
        }

        let lines = [
            resolvedAmount > 0 ? String(resolvedAmount) : nil,
            !cleanMerchant.isEmpty ? cleanMerchant : (!cleanInput.isEmpty ? cleanInput : nil),
            !cleanCard.isEmpty ? cleanCard : nil
        ].compactMap { $0 }

        let rawPayloadText = lines.isEmpty ? cleanInput : lines.joined(separator: "\n")

        try DraftInbox.capture(
            text: rawPayloadText,
            source: "card_transaction",
            ownerSnapshot: ownerSnapshot,
            at: Date(),
            app: cleanCard.isEmpty ? nil : cleanCard,
            title: cleanMerchant.isEmpty ? nil : cleanMerchant,
            subtitle: cleanCard.isEmpty ? nil : cleanCard,
            amount: resolvedAmount
        )

        let bodyParts = [
            resolvedAmount > 0 ? "Rp\(NumberFormatter.localizedString(from: NSNumber(value: resolvedAmount), number: .decimal))" : nil,
            !cleanMerchant.isEmpty ? cleanMerchant : (!cleanInput.isEmpty ? String(cleanInput.prefix(40)) : nil),
            !cleanCard.isEmpty ? "(\(cleanCard))" : nil
        ].compactMap { $0 }.joined(separator: " • ")

        DraftInbox.notifyCapture(
            title: CaptureLanguage.text("Card Transaction Captured", "Transaksi Kartu Masuk ke Draft"),
            body: bodyParts.isEmpty
                ? CaptureLanguage.text("Ready for review in Accrual.", "Siap ditinjau di Accrual.")
                : bodyParts
        )
        return .result(dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Captured for review in Accrual.", "Tangkapan siap ditinjau di Accrual.")))
    }
}

@available(iOS 16.0, *)
public struct ScanReceiptCameraIntent: AppIntent {
    public static var title: LocalizedStringResource = "Scan Receipt Camera"
    public static var description = IntentDescription("Open the receipt camera in Accrual.")
    public static var openAppWhenRun = true
    public init() {}
    public func perform() async throws -> some IntentResult {
        try DraftInbox.navigate("scan")
        return .result()
    }
}

@available(iOS 16.0, *)
public struct OpenQuickAddIntent: AppIntent {
    public static var title: LocalizedStringResource = "Quick Add"
    public static var description = IntentDescription("Open transaction entry in Accrual.")
    public static var openAppWhenRun = true
    public init() {}
    public func perform() async throws -> some IntentResult {
        try DraftInbox.navigate("add")
        return .result()
    }
}

@available(iOS 16.0, *)
public struct AccrualShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: OpenInboxIntent(), phrases: ["Open drafts in \(.applicationName)", "Tinjau transaksi di \(.applicationName)"], shortTitle: "Review Captures", systemImageName: "tray.full")
        AppShortcut(intent: ScanPaymentScreenshotIntent(), phrases: ["Scan payment screenshot in \(.applicationName)", "Pindai pembayaran di \(.applicationName)"], shortTitle: "Capture Screenshot", systemImageName: "doc.viewfinder.fill")
        AppShortcut(intent: LogQuickDraftIntent(), phrases: ["Quick draft in \(.applicationName)", "Catat cepat di \(.applicationName)"], shortTitle: "Quick Draft", systemImageName: "plus.rectangle.on.rectangle")
        AppShortcut(intent: LogNotificationTransactionIntent(), phrases: ["Log bank notification in \(.applicationName)", "Catat notifikasi bank di \(.applicationName)"], shortTitle: "Bank Notification", systemImageName: "bell.badge.fill")
        AppShortcut(intent: LogCardTransactionIntent(), phrases: ["Log card tap in \(.applicationName)", "Catat tap kartu di \(.applicationName)"], shortTitle: "Wallet Tap", systemImageName: "creditcard.fill")
    }
}
#endif
