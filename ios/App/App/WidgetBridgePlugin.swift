import Foundation
import Capacitor
import WidgetKit

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

        call.resolve([
            "transactions": transactions,
            "voiceLogs": voiceLogs
        ])
    }

    /**
     * Clears processed Siri / Back Tap transactions from the queue.
     */
    @objc public func clearPendingIngestion(_ call: CAPPluginCall) {
        sharedDefaults.removeObject(forKey: "pending_backtap_transactions")
        sharedDefaults.removeObject(forKey: "pending_backtap_voice")
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
