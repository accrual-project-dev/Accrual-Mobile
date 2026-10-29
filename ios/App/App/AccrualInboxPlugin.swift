import Foundation
import Capacitor

@objc(AccrualInboxPlugin)
public class AccrualInboxPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AccrualInboxPlugin"
    public let jsName = "AccrualInbox"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "drain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ack", returnType: CAPPluginReturnPromise)
    ]

    @objc public func drain(_ call: CAPPluginCall) {
        let fm = FileManager.default
        let dir = DraftInbox.dir
        let files = ((try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? [])
            .filter { $0.pathExtension == "json" }
        var items: [Any] = []
        for f in files {
            if let data = try? Data(contentsOf: f), let obj = try? JSONSerialization.jsonObject(with: data) {
                items.append(obj)
            } else {
                // Corrupted file: isolate to failed/ to avoid infinite loops
                let failed = dir.appendingPathComponent("failed", isDirectory: true)
                try? fm.createDirectory(at: failed, withIntermediateDirectories: true)
                try? fm.moveItem(at: f, to: failed.appendingPathComponent(f.lastPathComponent))
            }
        }
        call.resolve(["items": items])
    }

    @objc public func ack(_ call: CAPPluginCall) {
        guard let ids = call.getArray("ids", String.self) else {
            call.resolve(["success": true, "acknowledged": 0])
            return
        }
        let fm = FileManager.default
        let dir = DraftInbox.dir
        var removedCount = 0
        for id in ids {
            let fileUrl = dir.appendingPathComponent("\(id).json")
            if (try? fm.removeItem(at: fileUrl)) != nil {
                removedCount += 1
            }
        }
        DraftInbox.updateBadge()
        call.resolve(["success": true, "acknowledged": removedCount])
    }
}
