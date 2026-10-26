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
              let initialUrl = URL(string: urlString),
              let scheme = call.getString("callbackScheme") else {
            call.reject("Parameter 'url' dan 'callbackScheme' diperlukan")
            return
        }

        // Pre-resolve 302 redirect so iOS dialog displays provider domain (e.g. google.com)
        // instead of intermediate Supabase project hash, and enforces prompt=select_account
        self.resolveOAuthDestination(initialUrl: initialUrl) { [weak self] resolvedUrl in
            guard let self = self else { return }

            DispatchQueue.main.async {
                self.currentSession = ASWebAuthenticationSession(
                    url: resolvedUrl,
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
                self.currentSession?.prefersEphemeralWebBrowserSession = true
                self.currentSession?.start()
            }
        }
    }

    private func resolveOAuthDestination(initialUrl: URL, completion: @escaping (URL) -> Void) {
        guard initialUrl.host?.contains("supabase.co") == true else {
            completion(initialUrl)
            return
        }

        var request = URLRequest(url: initialUrl)
        request.httpMethod = "GET"
        request.timeoutInterval = 7.0

        let delegate = NonRedirectSessionDelegate()
        let session = URLSession(configuration: .ephemeral, delegate: delegate, delegateQueue: nil)

        let task = session.dataTask(with: request) { _, _, _ in
            if let targetUrl = delegate.redirectLocation {
                var components = URLComponents(url: targetUrl, resolvingAgainstBaseURL: false)
                var queryItems = components?.queryItems ?? []
                if !queryItems.contains(where: { $0.name == "prompt" }) {
                    queryItems.append(URLQueryItem(name: "prompt", value: "select_account"))
                    components?.queryItems = queryItems
                }
                completion(components?.url ?? targetUrl)
            } else {
                completion(initialUrl)
            }
        }
        task.resume()
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

private class NonRedirectSessionDelegate: NSObject, URLSessionTaskDelegate {
    var redirectLocation: URL?

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        if let loc = response.allHeaderFields["Location"] as? String, let url = URL(string: loc) {
            self.redirectLocation = url
        } else if let url = request.url {
            self.redirectLocation = url
        }
        completionHandler(nil)
    }
}
