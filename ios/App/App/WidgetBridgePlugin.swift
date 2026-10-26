import Foundation
import Capacitor
import WidgetKit
import AuthenticationServices

/**
 * WidgetBridgePlugin
 * Capacitor native bridge between the web application (React) and the native iOS
 * ecosystem: App Group UserDefaults, WidgetKit timelines, and offline Siri/Back Tap AppIntents.
 *
 * App Group: group.com.syntheticae.accrual
 */
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPendingIngestion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingIngestion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWidgets", returnType: CAPPluginReturnPromise)
    ]

    private let appGroupIdentifier = "group.com.syntheticae.accrual"

    private var sharedDefaults: UserDefaults {
        return UserDefaults(suiteName: appGroupIdentifier) ?? UserDefaults.standard
    }

    /**
     * Updates the financial snapshot stored in App Group UserDefaults.
     * This snapshot is directly read by SwiftUI WidgetKit widgets on the Home Screen & Lock Screen.
     */
    @objc public func updateSnapshot(_ call: CAPPluginCall) {
        guard let snapshot = call.getObject("snapshot") else {
            call.reject("Data snapshot tidak valid")
            return
        }

        sharedDefaults.set(snapshot, forKey: "accrual_widget_snapshot")
        if let jsonData = try? JSONSerialization.data(withJSONObject: snapshot, options: []) {
            sharedDefaults.set(jsonData, forKey: "accrual_widget_snapshot_data")
        }
        sharedDefaults.set(Date().timeIntervalSince1970, forKey: "accrual_widget_last_synced")
        sharedDefaults.synchronize()

        // Request WidgetKit to refresh all widget timelines immediately
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve(["success": true])
    }

    /**
     * Retrieves any quick log or voice transactions queued by Siri or iPhone Back Tap (AppIntents)
     * while the app was closed or backgrounded.
     */
    @objc public func getPendingIngestion(_ call: CAPPluginCall) {
        let transactions = sharedDefaults.array(forKey: "pending_backtap_transactions") as? [[String: Any]] ?? []
        let voiceLogs = sharedDefaults.array(forKey: "pending_backtap_voice") as? [[String: Any]] ?? []
        let navAction = sharedDefaults.string(forKey: "pending_intent_navigation")

        call.resolve([
            "transactions": transactions,
            "voiceLogs": voiceLogs,
            "navigation": navAction as Any
        ])
    }

    /**
     * Clears processed Siri / Back Tap transactions from the queue.
     */
    @objc public func clearPendingIngestion(_ call: CAPPluginCall) {
        sharedDefaults.removeObject(forKey: "pending_backtap_transactions")
        sharedDefaults.removeObject(forKey: "pending_backtap_voice")
        sharedDefaults.removeObject(forKey: "pending_intent_navigation")
        sharedDefaults.synchronize()

        call.resolve(["success": true])
    }

    /**
     * Forces WidgetKit to reload all timelines.
     */
    @objc public func reloadWidgets(_ call: CAPPluginCall) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve(["success": true])
    }
}

/**
 * OAuthSessionPlugin
 * Native iOS system-level OAuth session using ASWebAuthenticationSession.
 * Eliminates standard full Safari in-app browser with address bars,
 * intercepts custom callback schemes instantly, and auto-dismisses upon login.
 */
@objc(OAuthSessionPlugin)
public class OAuthSessionPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "OAuthSessionPlugin"
    public let jsName = "OAuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startSession", returnType: CAPPluginReturnPromise)
    ]

    private var currentSession: ASWebAuthenticationSession?

    @objc public func startSession(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString),
              let scheme = call.getString("callbackScheme") else {
            call.reject("Parameter 'url' dan 'callbackScheme' diperlukan")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.currentSession = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: scheme
            ) { [weak self] callbackURL, error in
                self?.currentSession = nil

                if let error = error {
                    let nsError = error as NSError
                    if nsError.domain == ASWebAuthenticationSessionErrorDomain &&
                       nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        call.reject("User cancelled", "CANCELLED")
                    } else {
                        call.reject(error.localizedDescription, "AUTH_ERROR")
                    }
                    return
                }

                guard let callbackURL = callbackURL else {
                    call.reject("Tidak ada URL callback yang diterima", "NO_CALLBACK")
                    return
                }

                call.resolve([
                    "url": callbackURL.absoluteString
                ])
            }

            self.currentSession?.presentationContextProvider = self
            self.currentSession?.prefersEphemeralWebBrowserSession = false
            self.currentSession?.start()
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let window = self.bridge?.webView?.window {
            return window
        }
        if let keyWindow = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) {
            return keyWindow
        }
        return ASPresentationAnchor()
    }
}
