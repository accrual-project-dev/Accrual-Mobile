import Foundation

func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    precondition(condition(), message)
}

let date = Date(timeIntervalSince1970: 1_793_248_200)
let guestOwner = "guest:11111111-1111-4111-8111-111111111111"
check(GuestCaptureDiscardPolicy.permits(owner: guestOwner, activeOwner: guestOwner), "Guest may explicitly discard its own captures")
check(GuestCaptureDiscardPolicy.permits(owner: guestOwner, activeOwner: "authenticated-owner"), "Signed-in migration decline may discard the specified guest")
check(!GuestCaptureDiscardPolicy.permits(owner: guestOwner, activeOwner: "guest:22222222-2222-4222-8222-222222222222"), "A different guest must not discard captures")
check(!GuestCaptureDiscardPolicy.permits(owner: guestOwner, activeOwner: nil), "Signed-out state must not discard captures")
check(!GuestCaptureDiscardPolicy.permits(owner: "guest:invalid", activeOwner: "authenticated-owner"), "Malformed guest IDs must be rejected")
check(!GuestCaptureDiscardPolicy.permits(owner: "authenticated-owner", activeOwner: "authenticated-owner"), "Authenticated capture owners must never use guest discard")
check(DraftInbox.validOwnerSnapshot("owner-a", currentOwner: "owner-a"), "Unchanged owner must permit capture")
check(!DraftInbox.validOwnerSnapshot("owner-a", currentOwner: "owner-b"), "Account switch during OCR must reject capture")
check(!DraftInbox.validOwnerSnapshot("owner-a", currentOwner: nil), "Logout during OCR must reject capture")
check(!DraftInbox.validOwnerSnapshot("", currentOwner: ""), "Ownerless capture must be rejected")
let first = DraftPayload(source: "shortcut_screenshot", transaction_date: date,
                         raw_text: "Balance 900.000\nPaid 25.000\nNo currency decision",
                         owner_id: "guest:11111111-1111-4111-8111-111111111111")
let second = DraftPayload(source: first.source, transaction_date: date,
                          raw_text: first.raw_text, owner_id: first.owner_id)
check(first.id != second.id, "Separate captures must have separate IDs even when text and minute match")
check(DraftInbox.validID(first.id), "Generated UUID must be a safe filename")
check(DraftInbox.validID(String(repeating: "a", count: 64)), "Legacy SHA IDs remain acknowledgeable")
for unsafe in ["../file", "/tmp/file", "a/b", "a\\b", "", "file.json", String(repeating: "a", count: 65)] {
    check(!DraftInbox.validID(unsafe), "Unsafe identifier accepted: \(unsafe)")
}
let encoder = JSONEncoder()
encoder.dateEncodingStrategy = .iso8601
let data = try encoder.encode(first)
let object = try JSONSerialization.jsonObject(with: data) as! [String: Any]
check(object["schema_version"] as? Int == 2, "Capture schema must be v2")
check(object["raw_text"] as? String == first.raw_text, "Ambiguous raw text must survive unchanged")
check(object["owner_id"] as? String == first.owner_id, "Capture must retain the owner snapshot")
check(object["amount"] as? Int == 0 && object["direction"] as? String == "unknown", "Native capture must not decide money")
check(ISO8601DateFormatter().date(from: object["transaction_date"] as! String) != nil, "Transaction date must be full ISO")
check(ISO8601DateFormatter().date(from: object["captured_at"] as! String) != nil, "Capture date must be full ISO")
let notification = DraftPayload(source: "shortcut_notification", transaction_date: date,
                                raw_text: "Unrecognized transaction text", owner_id: "owner-a",
                                source_app: "Bank", title: "Title", subtitle: "Subtitle")
let notificationObject = try JSONSerialization.jsonObject(with: encoder.encode(notification)) as! [String: Any]
check(notificationObject["source_app"] as? String == "Bank", "Source app must survive capture")
check(notificationObject["title"] as? String == "Title", "Notification title must survive capture")
check(notificationObject["subtitle"] as? String == "Subtitle", "Notification subtitle must survive capture")
print("Native capture payload and safe identifier tests passed.")
