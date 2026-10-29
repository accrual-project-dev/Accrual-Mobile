import { Camera, Bell, Mic, ScanLine, Plus, Inbox, type LucideIcon } from "lucide-react";

export type PresetId = "screen_scan" | "notification_reader" | "quick_add" | "voice_entry" | "receipt_scan" | "review_inbox";
export interface ShortcutActionNode {
  id: string;
  type: "standard";
  icon: LucideIcon;
  titleId: string;
  titleEn: string;
  subtitleId?: string;
  subtitleEn?: string;
  intent?: string;
  parameters?: string[];
  isNativeIntent?: boolean;
}
export interface ShortcutPreset {
  id: PresetId;
  icon: LucideIcon;
  titleId: string;
  titleEn: string;
  summaryId: string;
  summaryEn: string;
  primary: boolean;
  minIos: number;
  directScheme?: string;
  actions: ShortcutActionNode[];
  stepsId: string[];
  stepsEn: string[];
}

// The catalog is the single source for the guide and compatibility manifest.
// No published shortcut has been verified; manual setup remains available.
export const SHORTCUT_PRESETS: ShortcutPreset[] = [
  {
    id: "screen_scan", icon: ScanLine, titleId: "Pindai layar pembayaran", titleEn: "Capture payment screen", primary: true, minIos: 16,
    summaryId: "Ambil tangkapan layar lalu kirim gambar ke tindakan bawaan Accrual di latar belakang. Hasil yang perlu diperiksa masuk ke kotak tinjauan.",
    summaryEn: "Take a screenshot and pass the image to Accrual’s native background action. Captures needing attention go to the review inbox.",
    actions: [
      { id: "take_screenshot", type: "standard", icon: Camera, titleId: "Ambil tangkapan layar", titleEn: "Take Screenshot" },
      { id: "scan_payment", type: "standard", icon: ScanLine, titleId: "Pindai pembayaran dari tangkapan layar", titleEn: "Scan payment from Screenshot", intent: "ScanPaymentScreenshotIntent", parameters: ["screenshot"], isNativeIntent: true,
        subtitleId: "Masukan gambar: hasil tindakan sebelumnya. Pemrosesan berlangsung di perangkat.", subtitleEn: "Image input: output from the previous action. Processing stays on device." },
    ],
    stepsId: ["Di aplikasi Pintasan, buat pintasan baru dengan dua tindakan di atas. Hubungkan hasil tangkapan layar ke masukan gambar Accrual.", "iOS 16 ke atas: buka Pengaturan › Aksesibilitas › Sentuh › Ketuk Bagian Belakang, lalu pilih pintasan. Pada iPhone yang mendukung, pintasan juga dapat ditautkan ke Tombol Tindakan. iOS 27 menyediakan pemicu tangkapan layar sebagai pilihan tambahan.", "Uji saat bukti pembayaran terlihat. Jalankan pintasan lalu buka kotak tinjauan untuk memeriksa hasil. Tangkapan layar tidak dihapus."],
    stepsEn: ["In Shortcuts, create a new shortcut with the two actions above. Connect the screenshot output to Accrual’s image input.", "On iOS 16 and later, open Settings › Accessibility › Touch › Back Tap and select the shortcut. Supported iPhones can also bind it to the Action Button. An iOS 27 screenshot automation is an optional trigger.", "Test with a payment confirmation visible. Run the shortcut, then open the review inbox to check the result. Screenshots are kept."],
  },
  {
    id: "notification_reader", icon: Bell, titleId: "Notifikasi bank", titleEn: "Bank notifications", primary: true, minIos: 27,
    summaryId: "Memerlukan iOS 27 dan pemicu notifikasi aplikasi yang tersedia di perangkat. Pemicu ini belum tersedia di iOS 16–26. Teruskan isi notifikasi ke tindakan bawaan Accrual.",
    summaryEn: "Requires iOS 27 and the app notification trigger on your device. This trigger is unavailable on iOS 16–26. Pass notification details to Accrual’s native action.",
    actions: [{ id: "log_notification", type: "standard", icon: Bell, titleId: "Catat transaksi dari notifikasi", titleEn: "Log Notification Transaction", intent: "LogNotificationTransactionIntent", parameters: ["notificationText", "title", "subtitle", "sourceApp", "receivedAt"], isNativeIntent: true,
      subtitleId: "Hubungkan teks, judul, subjudul, aplikasi sumber, dan waktu diterima dari pemicu. Jangan isi teks contoh sebagai masukan tetap.", subtitleEn: "Map text, title, subtitle, source app, and received time from the trigger. Do not replace these with fixed sample text." }],
    stepsId: ["Buka Pintasan dan buat tindakan Catat transaksi dari notifikasi milik Accrual. Tidak ada tautan pemasangan resmi yang telah diverifikasi.", "Pada iOS 27, buat automasi notifikasi aplikasi untuk bank atau dompet digital Anda. Hubungkan kelima nilai pemicu ke masukan tindakan Accrual dan pilih Jalankan Segera jika tersedia.", "Uji dengan notifikasi transaksi sungguhan. Periksa kotak tinjauan dan buku transaksi. Kode sekali pakai dan promosi tidak boleh menjadi transaksi."],
    stepsEn: ["Open Shortcuts and add Accrual’s Log Notification Transaction action. No official installation link has been verified.", "On iOS 27, create an app notification automation for your bank or wallet. Connect all five trigger values to Accrual’s action inputs and choose Run Immediately if available.", "Test with a real transaction notification. Check the review inbox and ledger. One-time codes and promotions must not become transactions."],
  },
  {
    id: "quick_add", icon: Plus, titleId: "Tambah cepat", titleEn: "Quick Add", primary: false, minIos: 16, directScheme: "accrual://add", actions: [],
    summaryId: "Buka formulir transaksi Accrual. Simpan pola transaksi berulang melalui pintasan transaksi cepat di Pengaturan.", summaryEn: "Open Accrual’s transaction form. Manage repeat transaction presets in Settings.", stepsId: [], stepsEn: [],
  },
  { id: "voice_entry", icon: Mic, titleId: "Catat dengan suara", titleEn: "Voice entry", primary: false, minIos: 16, directScheme: "accrual://voice", actions: [], summaryId: "Buka pencatatan suara di Accrual.", summaryEn: "Open voice entry in Accrual.", stepsId: [], stepsEn: [] },
  { id: "receipt_scan", icon: Camera, titleId: "Pindai struk", titleEn: "Scan receipt", primary: false, minIos: 16, directScheme: "accrual://scan", actions: [], summaryId: "Buka pemindai struk di Accrual.", summaryEn: "Open Accrual’s receipt scanner.", stepsId: [], stepsEn: [] },
  { id: "review_inbox", icon: Inbox, titleId: "Tinjau tangkapan", titleEn: "Review captures", primary: false, minIos: 16, directScheme: "accrual://inbox", actions: [], summaryId: "Periksa hasil tangkapan yang perlu dilengkapi sebelum disimpan.", summaryEn: "Review captures that need attention before saving.", stepsId: [], stepsEn: [] },
];

export interface ShortcutItemConfig { version: number; icloud_url: string; file_url: string; min_ios: string }
export interface ShortcutsManifest { shortcuts: { screenshot: ShortcutItemConfig; notification: ShortcutItemConfig }; updated_at: string }
export const ACCRUAL_SHORTCUTS_STORAGE_KEY = "accrual_shortcuts_custom_icloud_v2";
export const ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY = ACCRUAL_SHORTCUTS_STORAGE_KEY;
export const DEFAULT_SHORTCUTS_MANIFEST: ShortcutsManifest = {
  shortcuts: {
    screenshot: { version: 2, icloud_url: "", file_url: "", min_ios: `${SHORTCUT_PRESETS[0].minIos}.0` },
    notification: { version: 2, icloud_url: "", file_url: "", min_ios: `${SHORTCUT_PRESETS[1].minIos}.0` },
  }, updated_at: "2026-10-29",
};
/** Syntax validation only. This does not verify availability, contents, or installation. */
export function isValidICloudLink(url?: string | null): boolean {
  return typeof url === "string" && /^https:\/\/(?:www\.)?icloud\.com\/shortcuts\/[a-f0-9]{32}\/?$/i.test(url.trim());
}
export function getShortcutsConfig(): ShortcutsManifest {
  const result = structuredClone(DEFAULT_SHORTCUTS_MANIFEST);
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCRUAL_SHORTCUTS_STORAGE_KEY) || "{}");
    for (const channel of ["screenshot", "notification"] as const) {
      const url = parsed.shortcuts?.[channel]?.icloud_url;
      if (isValidICloudLink(url)) result.shortcuts[channel].icloud_url = url.trim();
    }
  } catch { /* Manual setup also works without storage. */ }
  return result;
}
export function setShortcutICloudUrl(type: "screenshot" | "notification", url: string): void {
  if (url && !isValidICloudLink(url)) return;
  const current = getShortcutsConfig();
  current.shortcuts[type].icloud_url = url.trim();
  try { localStorage.setItem(ACCRUAL_SHORTCUTS_STORAGE_KEY, JSON.stringify(current)); } catch { /* Optional local preference. */ }
}
