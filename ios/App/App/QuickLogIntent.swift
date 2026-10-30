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
    // Compatibility only: v2 captures never infer money on the native side.
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

    public static func currentOwner() throws -> String {
        try withLock {
            guard let owner = try defaults().string(forKey: ownerKey), !owner.isEmpty else { throw CaptureError.noOwner }
            return owner
        }
    }

    /// Foundation-only rule shared by capture transport and the native test harness.
    public static func validOwnerSnapshot(_ snapshot: String, currentOwner: String?) -> Bool {
        !snapshot.isEmpty && currentOwner == snapshot
    }

    public static func capture(text: String, source: String, ownerSnapshot: String, at: Date = Date(), app: String? = nil,
                               title: String? = nil, subtitle: String? = nil) throws {
        guard ![title, subtitle, text].compactMap({ $0 }).joined().trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw CaptureError.empty
        }
        try withLock {
            let activeOwner = try defaults().string(forKey: ownerKey)
            guard validOwnerSnapshot(ownerSnapshot, currentOwner: activeOwner) else { throw CaptureError.ownerChanged }
            let payload = DraftPayload(source: source, transaction_date: at, raw_text: text,
                                       owner_id: ownerSnapshot, source_app: app, title: title, subtitle: subtitle)
            try write(payload)
        }
        updateBadge()
    }

    public static func write(_ payload: DraftPayload) throws {
        guard validID(payload.id) else { throw CaptureError.invalidID }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let file = try directory().appendingPathComponent("\(payload.id).json")
        try encoder.encode(payload).write(to: file, options: .atomic)
    }

    public static func updateBadge() {
        guard let directory = try? directory(),
              let files = try? FileManager.default.contentsOfDirectory(atPath: directory.path) else { return }
        let count = files.filter { $0.hasSuffix(".json") }.count
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(count) { _ in }
        }
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
        return .result(
            value: "DELETE_SCREENSHOT",
            dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Captured for review in Accrual.", "Tangkapan siap ditinjau di Accrual."))
        )
    }
}

@available(iOS 16.0, *)
public struct LogNotificationTransactionIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Notification Transaction"
    public static var description = IntentDescription("Capture notification text for review in Accrual.")
    public static var openAppWhenRun = false
    @Parameter(title: "Notification") public var notificationText: String?
    @Parameter(title: "Body") public var body: String?
    @Parameter(title: "Title") public var title: String?
    @Parameter(title: "Notif Title") public var notifTitle: String?
    @Parameter(title: "Subtitle") public var subtitle: String?
    @Parameter(title: "Notif Subtitle") public var notifSubtitle: String?
    @Parameter(title: "App") public var sourceApp: String?
    @Parameter(title: "Received At") public var receivedAt: Date?

    public static var parameterSummary: some ParameterSummary {
        Summary("Log notification \(\.$notificationText) titled \(\.$title) subtitled \(\.$subtitle) from \(\.$sourceApp) at \(\.$receivedAt)")
    }

    public init() {}
    public func perform() async throws -> some IntentResult {
        let ownerSnapshot = try DraftInbox.currentOwner()
        try DraftInbox.capture(text: notificationText ?? body ?? "", source: "shortcut_notification",
                               ownerSnapshot: ownerSnapshot, at: receivedAt ?? Date(), app: sourceApp, title: title ?? notifTitle,
                               subtitle: subtitle ?? notifSubtitle)
        return .result()
    }
}

@available(iOS 16.0, *)
public struct LogQuickDraftIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Quick Draft Transaction"
    public static var description = IntentDescription("Save quick dialog input (amount, category, account, date & time, note) to Accrual Drafts.")
    public static var openAppWhenRun = false
    @Parameter(title: "Amount") public var amount: Double?
    @Parameter(title: "Category") public var category: String?
    @Parameter(title: "Account / Wallet") public var wallet: String?
    @Parameter(title: "Date & Time") public var transactionDate: Date?
    @Parameter(title: "Note") public var note: String?

    /// All 5 parameters are placed directly inside Summary so none are hidden behind the (>) disclosure toggle
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
        let text = [
            "Rp \(cleanAmount)",
            cleanNote.isEmpty ? nil : cleanNote,
            cleanCategory.isEmpty ? nil : cleanCategory,
            cleanWallet.isEmpty ? nil : cleanWallet
        ].compactMap { $0 }.joined(separator: "\n")
        try DraftInbox.capture(
            text: text,
            source: "shortcut_notification",
            ownerSnapshot: ownerSnapshot,
            at: transactionDate ?? Date(),
            app: cleanWallet.isEmpty ? nil : cleanWallet,
            title: cleanCategory.isEmpty ? nil : cleanCategory,
            subtitle: cleanNote.isEmpty ? nil : cleanNote
        )
        return .result(dialog: IntentDialog(stringLiteral: CaptureLanguage.text("Captured for review in Accrual.", "Tangkapan siap ditinjau di Accrual.")))
    }
}

@available(iOS 16.0, *)
public struct LogSmartTextIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Smart Text Transaction"
    public static var description = IntentDescription("Capture clipboard or transaction text for review in Accrual.")
    public static var openAppWhenRun = false
    @Parameter(title: "Transaction Text") public var text: String

    public static var parameterSummary: some ParameterSummary {
        Summary("Log text \(\.$text) to Accrual Draft")
    }

    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let ownerSnapshot = try DraftInbox.currentOwner()
        try DraftInbox.capture(text: text, source: "shortcut_screenshot", ownerSnapshot: ownerSnapshot)
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

/// Retained for personal automations & Wallet Card Tap. Values are captured as raw text only.
@available(iOS 16.0, *)
public struct LogCardTransactionIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Card Transaction"
    public static var description = IntentDescription("Capture card transaction details for review.")
    public static var openAppWhenRun = false
    public static var isDiscoverable = true
    @Parameter(title: "Amount") public var amount: Double?
    @Parameter(title: "Merchant") public var merchant: String?
    @Parameter(title: "Card") public var cardName: String?

    public static var parameterSummary: some ParameterSummary {
        Summary("Log card transaction \(\.$amount) at \(\.$merchant) (\(\.$cardName))")
    }

    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let ownerSnapshot = try DraftInbox.currentOwner()
        let text = [amount.map { String($0) }, merchant, cardName].compactMap { $0 }.joined(separator: "\n")
        try DraftInbox.capture(text: text, source: "card_transaction", ownerSnapshot: ownerSnapshot)
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
        AppShortcut(intent: LogSmartTextIntent(), phrases: ["Log clipboard text in \(.applicationName)", "Catat teks di \(.applicationName)"], shortTitle: "Smart Text", systemImageName: "doc.on.clipboard")
    }
}
#endif
