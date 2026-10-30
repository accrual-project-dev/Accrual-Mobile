import Foundation
import Capacitor
import UserNotifications

public enum GuestCaptureDiscardPolicy {
    public static func permits(owner: String, activeOwner: String?) -> Bool {
        guard owner.hasPrefix("guest:"), UUID(uuidString: String(owner.dropFirst(6))) != nil,
              let activeOwner = activeOwner,
              !activeOwner.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        return activeOwner == owner || !activeOwner.hasPrefix("guest:")
    }
}

@objc(AccrualInboxPlugin)
public class AccrualInboxPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AccrualInboxPlugin"
    public let jsName = "AccrualInbox"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setOwner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "adoptOwner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "discardGuestOwner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ack", returnType: CAPPluginReturnPromise)
    ]

    @objc public func setOwner(_ call: CAPPluginCall) {
        do {
            try DraftInbox.withLock {
                let defaults = try DraftInbox.defaults()
                if let owner = call.getString("ownerId"), !owner.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    defaults.set(owner, forKey: DraftInbox.ownerKey)
                    defaults.synchronize()
                    DraftInbox.updateBadge(forOwner: owner)
                } else if call.options["ownerId"] is NSNull {
                    defaults.removeObject(forKey: DraftInbox.ownerKey)
                    defaults.synchronize()
                    if #available(iOS 16.0, *) {
                        UNUserNotificationCenter.current().setBadgeCount(0) { _ in }
                    }
                } else {
                    call.reject("ownerId must be a nonempty string or null.")
                    return
                }
                call.resolve(["success": true])
            }
        } catch { call.reject(error.localizedDescription) }
    }

    @objc public func drain(_ call: CAPPluginCall) {
        guard let owner = call.getString("ownerId"), !owner.isEmpty else {
            call.reject("ownerId is required.")
            return
        }
        do {
            try DraftInbox.withLock {
                let directory = try DraftInbox.directory()
                let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
                    .filter { $0.pathExtension == "json" }
                var items: [[String: Any]] = []
                for file in files {
                    guard let data = try? Data(contentsOf: file),
                          let item = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                          item["owner_id"] as? String == owner,
                          let id = item["id"] as? String,
                          DraftInbox.validID(id), file.lastPathComponent == "\(id).json" else { continue }
                    items.append(item)
                }
                DraftInbox.updateBadge(forOwner: owner)
                call.resolve(["items": items])
            }
        } catch { call.reject(error.localizedDescription) }
    }

    /// Called only after explicit guest migration consent. Ownerless files are never adopted.
    @objc public func adoptOwner(_ call: CAPPluginCall) {
        guard let fromOwner = call.getString("fromOwnerId"), fromOwner.hasPrefix("guest:"),
              UUID(uuidString: String(fromOwner.dropFirst(6))) != nil,
              let toOwner = call.getString("toOwnerId"), !toOwner.isEmpty,
              !toOwner.hasPrefix("guest:") else {
            call.reject("A guest source and authenticated destination owner are required.")
            return
        }
        do {
            try DraftInbox.withLock {
                guard try DraftInbox.defaults().string(forKey: DraftInbox.ownerKey) == toOwner else {
                    call.reject("Set the destination capture owner before guest migration.")
                    return
                }
                let directory = try DraftInbox.directory()
                let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
                    .filter { $0.pathExtension == "json" }
                for file in files {
                    guard let data = try? Data(contentsOf: file),
                          var item = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                          item["owner_id"] as? String == fromOwner,
                          let id = item["id"] as? String, DraftInbox.validID(id),
                          file.lastPathComponent == "\(id).json" else { continue }
                    item["owner_id"] = toOwner
                    let rewritten = try JSONSerialization.data(withJSONObject: item)
                    try rewritten.write(to: file, options: .atomic)
                }
                DraftInbox.updateBadge(forOwner: toOwner)
                call.resolve(["success": true])
            }
        } catch { call.reject(error.localizedDescription) }
    }

    /// Explicit guest migration decline only; ownerless and other owners' files are retained.
    @objc public func discardGuestOwner(_ call: CAPPluginCall) {
        guard let owner = call.getString("ownerId"), owner.hasPrefix("guest:"),
              UUID(uuidString: String(owner.dropFirst(6))) != nil else {
            call.reject("A valid guest capture owner is required.")
            return
        }
        do {
            try DraftInbox.withLock {
                let activeOwner = try DraftInbox.defaults().string(forKey: DraftInbox.ownerKey)
                guard GuestCaptureDiscardPolicy.permits(owner: owner, activeOwner: activeOwner) else {
                    call.reject("The active session cannot discard this guest capture owner.")
                    return
                }
                let directory = try DraftInbox.directory()
                let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
                    .filter { $0.pathExtension == "json" }
                var matching: [URL] = []
                for file in files {
                    let data = try Data(contentsOf: file)
                    guard let item = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                        throw CocoaError(.fileReadCorruptFile)
                    }
                    guard item["owner_id"] as? String == owner else { continue }
                    guard let id = item["id"] as? String, DraftInbox.validID(id),
                          file.lastPathComponent == "\(id).json" else {
                        throw CaptureError.invalidID
                    }
                    matching.append(file)
                }
                var discarded = 0
                defer { DraftInbox.updateBadge(forOwner: activeOwner) }
                for file in matching {
                    try FileManager.default.removeItem(at: file)
                    discarded += 1
                }
                call.resolve(["success": true, "discarded": discarded])
            }
        } catch { call.reject(error.localizedDescription) }
    }

    @objc public func ack(_ call: CAPPluginCall) {
        guard let owner = call.getString("ownerId"), !owner.isEmpty,
              let ids = call.getArray("ids", String.self) else {
            call.reject("ids and ownerId are required.")
            return
        }
        guard ids.allSatisfy({ DraftInbox.validID($0) }) else {
            call.reject("Invalid capture identifier.")
            return
        }
        do {
            try DraftInbox.withLock {
                let directory = try DraftInbox.directory()
                var removed: [String] = []
                for id in Set(ids) {
                    let file = directory.appendingPathComponent("\(id).json")
                    guard let data = try? Data(contentsOf: file),
                          let item = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                          item["id"] as? String == id, item["owner_id"] as? String == owner else { continue }
                    do {
                        try FileManager.default.removeItem(at: file)
                        removed.append(id)
                    } catch { /* Failed removals remain pending and are not acknowledged. */ }
                }
                DraftInbox.updateBadge(forOwner: owner)
                call.resolve(["success": removed.count == Set(ids).count, "acknowledged": removed.count, "ids": removed])
            }
        } catch { call.reject(error.localizedDescription) }
    }
}
