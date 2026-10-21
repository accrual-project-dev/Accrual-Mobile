const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', '@capacitor', 'local-notifications', 'ios', 'Sources', 'LocalNotificationsPlugin', 'LocalNotificationsPlugin.swift');

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix generic overload type inference for Swift 6 / Xcode 16
  if (content.includes('call.getArray("notifications", JSObject.self)')) {
    content = content.replaceAll('call.getArray("notifications", JSObject.self)', 'call.getArray("notifications") as? [JSObject]');
    modified = true;
  }
  if (content.includes('call.getArray("types", JSObject.self)')) {
    content = content.replaceAll('call.getArray("types", JSObject.self)', 'call.getArray("types") as? [JSObject]');
    modified = true;
  }
  if (content.includes('call.getArray("ids")')) {
    content = content.replaceAll('call.getArray("ids")', 'call.getArray("ids", []) as? [Any]');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-local-notifications] Successfully patched LocalNotificationsPlugin.swift for Xcode 16 / Swift 6.');
  } else {
    console.log('[patch-local-notifications] LocalNotificationsPlugin.swift is already patched.');
  }
} else {
  console.log('[patch-local-notifications] LocalNotificationsPlugin.swift not found, skipping patch.');
}
