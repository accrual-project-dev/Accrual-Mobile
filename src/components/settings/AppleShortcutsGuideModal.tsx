import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  Mic,
  Sparkles,
  ExternalLink,
  Camera,
  Smartphone,
  Bell,
  ScanLine,
  Watch,
  Lock,
  Plus,
  Trash2,
  Play,
  Link as LinkIcon,
  AlertCircle,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";

export type TabType =
  | "back_tap"
  | "action_button"
  | "ways_to_add"
  | "automation"
  | "screen_scan"
  | "notification_reader"
  | "receipt_scan";

export type PresetId = "screen_scan" | "voice_entry" | "receipt_scan" | "notification_reader";

function mapInitialTab(t?: TabType): PresetId {
  if (t === "notification_reader" || t === "automation") return "notification_reader";
  if (t === "screen_scan" || t === "back_tap") return "screen_scan";
  if (t === "action_button" || t === "ways_to_add") return "voice_entry";
  if (t === "receipt_scan") return "receipt_scan";
  return "screen_scan";
}

export interface ShortcutActionNode {
  id: string;
  type: "standard" | "condition_start" | "nested_action" | "condition_end";
  icon: typeof Camera;
  titleId: string;
  titleEn: string;
  subtitleId?: string;
  subtitleEn?: string;
  isNativeIntent?: boolean;
}

export interface ShortcutPreset {
  id: PresetId;
  icon: typeof ScanLine;
  titleId: string;
  titleEn: string;
  categoryBadgeId: string;
  categoryBadgeEn: string;
  summaryId: string;
  summaryEn: string;
  icloudUrl: string;
  directScheme: string;
  metadata: {
    siriPhraseId: string;
    siriPhraseEn: string;
    watchSupported: boolean;
    lockScreenSupported: boolean;
    hardwareBindingId: string;
    hardwareBindingEn: string;
  };
  actions: ShortcutActionNode[];
  hardwareGuide: {
    titleId: string;
    titleEn: string;
    stepsId: string[];
    stepsEn: string[];
  };
}

export const ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY = "ACCRUAL_SHORTCUT_ICLOUD_LINKS_V1";

/**
 * Validates whether a URL is a real Apple Shortcuts public iCloud link.
 * Apple requires a 32-character hexadecimal UUID hash.
 */
export function isValidICloudLink(url?: string): boolean {
  if (!url || typeof url !== "string") return false;
  const regex = /^https:\/\/www\.icloud\.com\/shortcuts\/[a-fA-F0-9]{32}(?:\/|\?.*)?$/;
  return regex.test(url.trim());
}

export function getSavedICloudLinks(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveICloudLink(presetId: PresetId, url: string): void {
  try {
    const current = getSavedICloudLinks();
    current[presetId] = url.trim();
    localStorage.setItem(ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY, JSON.stringify(current));
  } catch {}
}

export const SHORTCUT_PRESETS: ShortcutPreset[] = [
  {
    id: "screen_scan",
    icon: ScanLine,
    titleId: "Accrual Screen Scanner",
    titleEn: "Accrual Screen Scanner",
    categoryBadgeId: "Ketuk Bagian Belakang • Back Tap",
    categoryBadgeEn: "Back Tap Optimized",
    summaryId:
      "Pindai layar pembayaran atau struk transfer secara instan hanya dengan mengetuk 2x bodi belakang iPhone. Accrual membaca data secara lokal via OCR dan otomatis membersihkan tangkapan layar dari galeri.",
    summaryEn:
      "Instantly scan payment confirmation screens or transfer receipts by double-tapping the back of your iPhone. Accrual parses transaction details locally via OCR and auto-deletes the screenshot from your photo library.",
    icloudUrl: "https://www.icloud.com/shortcuts/accrual-screen-scanner",
    directScheme: "accrual://scan",
    metadata: {
      siriPhraseId: "Katakan 'Siri, Accrual Screen Scanner' untuk menjalankan",
      siriPhraseEn: "Say 'Siri, Accrual Screen Scanner' to run",
      watchSupported: true,
      lockScreenSupported: true,
      hardwareBindingId: "Ketuk Bagian Belakang (Back Tap) • Ketuk 2x",
      hardwareBindingEn: "Back Tap • Double Tap",
    },
    actions: [
      {
        id: "act-1",
        type: "standard",
        icon: Camera,
        titleId: "Ambil jepretan layar",
        titleEn: "Take screenshot",
        subtitleId: "Tangkapan layar resolusi penuh tanpa bilah status",
        subtitleEn: "Full-resolution on-screen capture",
      },
      {
        id: "act-2",
        type: "standard",
        icon: ScanLine,
        titleId: "Scan payment from Screenshot",
        titleEn: "Scan payment from Screenshot",
        subtitleId: "Tindakan Asli Accrual • Vision OCR & Buka Aplikasi Otomatis",
        subtitleEn: "Accrual Native Intent • Vision OCR & Instant App Launch",
        isNativeIntent: true,
      },
      {
        id: "act-3",
        type: "standard",
        icon: Trash2,
        titleId: "Hapus Foto (Jepretan Layar)",
        titleEn: "Delete Photo (Screenshot)",
        subtitleId: "Pembersihan otomatis agar galeri foto tetap rapi",
        subtitleEn: "Auto cleanup to keep your photo library clean",
      },
    ],
    hardwareGuide: {
      titleId: "Cara Paling Mudah: Tautkan ke Ketuk Bagian Belakang (Back Tap)",
      titleEn: "Easiest Way: Bind to Back Tap (Double Tap)",
      stepsId: [
        "Metode 1 (Rekomendasi 0-Setup): Buka Pengaturan iOS › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › Ketuk Dua Kali › langsung pilih tindakan resmi 'Scan Payment Screenshot' dari Accrual.",
        "Metode 2 (Pintasan 3-Langkah): Di aplikasi Pintasan, buat pintasan baru dengan 3 tindakan di atas (Ambil Tangkapan Layar › Scan payment with Accrual › Hapus Foto), lalu tautkan ke Ketuk Dua Kali.",
        "Kini cukup ketuk 2x bodi belakang iPhone saat melihat bukti transfer atau struk. Accrual langsung terbuka dan membaca transaksi secara otomatis.",
      ],
      stepsEn: [
        "Method 1 (Recommended 0-Setup): Open iOS Settings › Accessibility › Touch › Back Tap › Double Tap › choose Accrual's official 'Scan Payment Screenshot' action directly.",
        "Method 2 (3-Step Pipeline): In Shortcuts app, create a new shortcut with the 3 actions above (Take screenshot › Scan payment with Accrual › Delete photo), then bind it to Double Tap.",
        "Now simply double-tap the back of your iPhone whenever viewing any transfer receipt. Accrual opens instantly and parses details automatically.",
      ],
    },
  },
  {
    id: "voice_entry",
    icon: Mic,
    titleId: "Accrual Voice Entry",
    titleEn: "Accrual Voice Entry",
    categoryBadgeId: "Tombol Tindakan • Action Button",
    categoryBadgeEn: "Action Button Ready",
    summaryId:
      "Catat pengeluaran hanya dengan berbicara secara alami. Pintasan merekam ucapan Anda dan Accrual otomatis mengekstrak nominal, kategori, serta dompet tanpa perlu mengetik manual.",
    summaryEn:
      "Log expenses simply by speaking naturally. The shortcut captures your speech and Accrual automatically parses amount, category, and wallet without manual typing.",
    icloudUrl: "https://www.icloud.com/shortcuts/accrual-voice-entry",
    directScheme: "accrual://voice",
    metadata: {
      siriPhraseId: "Katakan 'Siri, Voice entry in Accrual'",
      siriPhraseEn: "Say 'Siri, Voice entry in Accrual'",
      watchSupported: true,
      lockScreenSupported: true,
      hardwareBindingId: "Tombol Tindakan (Action Button) atau Kunci Layar",
      hardwareBindingEn: "Action Button or Lock Screen Widget",
    },
    actions: [
      {
        id: "act-v1",
        type: "standard",
        icon: Mic,
        titleId: "Diktekan teks pengeluaran",
        titleEn: "Dictate transaction audio",
        subtitleId: "Mendeteksi masukan suara secara langsung",
        subtitleEn: "Captures speech naturally",
      },
      {
        id: "act-v2",
        type: "standard",
        icon: Sparkles,
        titleId: "Voice Entry ke Accrual",
        titleEn: "Voice Entry to Accrual",
        subtitleId: "Tindakan Asli Accrual • Pemrosesan Bahasa Alami",
        subtitleEn: "Accrual Native Intent • Natural Language Engine",
        isNativeIntent: true,
      },
    ],
    hardwareGuide: {
      titleId: "Tautkan ke Tombol Tindakan (Action Button)",
      titleEn: "Bind to Action Button",
      stepsId: [
        "Buka Pengaturan iOS › Tombol Tindakan › Geser ke opsi 'Pintasan'.",
        "Pilih 'Accrual Voice Entry' sebagai pintasan tombol.",
        "Tekan tahan tombol tindakan di iPhone 15 Pro / 16 kapan pun untuk mendikte pengeluaran.",
      ],
      stepsEn: [
        "Open iOS Settings › Action Button › Swipe to 'Shortcut' option.",
        "Choose 'Accrual Voice Entry' as your button action.",
        "Press and hold the Action Button on iPhone 15 Pro / 16 anytime to dictate an expense.",
      ],
    },
  },
  {
    id: "receipt_scan",
    icon: Camera,
    titleId: "Accrual Receipt Scanner",
    titleEn: "Accrual Receipt Scanner",
    categoryBadgeId: "Kamera Resi • 1-Ketukan",
    categoryBadgeEn: "1-Tap Camera Scanner",
    summaryId:
      "Buka pemindai kamera struk fisik atau faktur kasir Accrual dalam 1 ketukan langsung dari Layar Utama, Pusat Kontrol, atau Widget Kunci Layar.",
    summaryEn:
      "Launch Accrual's physical receipt camera scanner in 1 tap directly from the Home Screen, Control Center, or Lock Screen Widget.",
    icloudUrl: "https://www.icloud.com/shortcuts/accrual-receipt-scanner",
    directScheme: "accrual://scan",
    metadata: {
      siriPhraseId: "Katakan 'Siri, Scan receipt in Accrual'",
      siriPhraseEn: "Say 'Siri, Scan receipt in Accrual'",
      watchSupported: false,
      lockScreenSupported: true,
      hardwareBindingId: "Pusat Kontrol iOS 18 / Widget Kunci Layar",
      hardwareBindingEn: "iOS 18 Control Center / Lock Screen Widget",
    },
    actions: [
      {
        id: "act-r1",
        type: "standard",
        icon: Camera,
        titleId: "Buka Pemindai Resi Accrual",
        titleEn: "Open Accrual Receipt Scanner",
        subtitleId: "Tindakan Asli Accrual • Deteksi Tepi Resi Otomatis",
        subtitleEn: "Accrual Native Intent • Automatic Receipt Edge Detection",
        isNativeIntent: true,
      },
    ],
    hardwareGuide: {
      titleId: "Pasang di Pusat Kontrol atau Layar Kunci",
      titleEn: "Add to Control Center or Lock Screen",
      stepsId: [
        "Di iOS 18: Buka Pusat Kontrol › Ketuk tanda (+) di pojok kiri atas.",
        "Pilih Kontrol Accrual 'Pindai Resi' atau pasang pintasan ke Layar Terkunci.",
        "Kini Anda dapat langsung memindai struk belanja fisik dalam 1 ketukan cepat.",
      ],
      stepsEn: [
        "On iOS 18: Open Control Center › Tap the (+) icon at the top-left.",
        "Select Accrual's 'Scan Receipt' control or add the shortcut to your Lock Screen.",
        "Now you can launch the physical receipt scanner in a single instant tap.",
      ],
    },
  },
  {
    id: "notification_reader",
    icon: Bell,
    titleId: "Pembaca Notifikasi Bank Otomatis",
    titleEn: "Auto Bank Notification Reader",
    categoryBadgeId: "Automasi Latar Belakang",
    categoryBadgeEn: "Background Automation",
    summaryId:
      "Setiap kali notifikasi transaksi masuk dari m-Banking atau dompet digital (BCA, Livin Mandiri, GoPay, OVO, ShopeePay, DANA), iPhone otomatis membaca teks notifikasi dan langsung menyimpannya ke Accrual di latar belakang tanpa sentuhan manual.",
    summaryEn:
      "Whenever a transaction notification arrives from your bank or e-wallet app (BCA, Livin Mandiri, GoPay, OVO, ShopeePay, DANA), your iPhone automatically parses the text and logs it directly to Accrual in the background without manual interaction.",
    icloudUrl: "https://www.icloud.com/shortcuts/accrual-notification-reader",
    directScheme: "shortcuts://",
    metadata: {
      siriPhraseId: "Berjalan hening di latar belakang tanpa suara",
      siriPhraseEn: "Runs silently in the background without voice trigger",
      watchSupported: false,
      lockScreenSupported: true,
      hardwareBindingId: "Automasi Pribadi Pintasan iOS (Personal Automations)",
      hardwareBindingEn: "iOS Shortcuts Personal Automations",
    },
    actions: [
      {
        id: "act-n1",
        type: "standard",
        icon: Bell,
        titleId: "Saat menerima pemberitahuan dari [Aplikasi Bank]",
        titleEn: "When I receive a notification from [Bank Apps]",
        subtitleId: "Pemicu Automasi Pribadi iOS • Jalankan Segera",
        subtitleEn: "iOS Personal Automation Trigger • Run Immediately",
      },
      {
        id: "act-n2",
        type: "standard",
        icon: Sparkles,
        titleId: "Log Notification Transaction ke Accrual",
        titleEn: "Log Notification Transaction to Accrual",
        subtitleId: "Tindakan Asli Accrual • Pemfilter Promo & Spam Otomatis",
        subtitleEn: "Accrual Native Intent • Smart Promo & Spam Guard",
        isNativeIntent: true,
      },
    ],
    hardwareGuide: {
      titleId: "Konfigurasi Automasi Pemberitahuan",
      titleEn: "Configure Notification Automation",
      stepsId: [
        "Buka aplikasi Pintasan iOS › Ketuk tab 'Automasi' di bagian bawah › Ketuk (+).",
        "Pilih 'Pemberitahuan' › Pilih aplikasi bank Anda (BCA, Livin, GoPay, OVO) › Centang 'Jalankan Segera'.",
        "Tambahkan tindakan 'Log Notification Transaction' dari Accrual dan tautkan Masukan Pintasan.",
      ],
      stepsEn: [
        "Open iOS Shortcuts app › Tap 'Automation' tab at the bottom › Tap (+).",
        "Select 'Notification' › Choose your banking apps (BCA, Livin, GoPay, OVO) › Check 'Run Immediately'.",
        "Add Accrual's 'Log Notification Transaction' action and connect Shortcut Input.",
      ],
    },
  },
];

interface AppleShortcutsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabType;
}

export function AppleShortcutsGuideModal({
  isOpen,
  onClose,
  initialTab = "back_tap",
}: AppleShortcutsGuideModalProps) {
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [selectedPresetId, setSelectedPresetId] = useState<PresetId>(() =>
    mapInitialTab(initialTab)
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customLinks, setCustomLinks] = useState<Record<string, string>>(() =>
    getSavedICloudLinks()
  );
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configInputUrl, setConfigInputUrl] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setSelectedPresetId(mapInitialTab(initialTab));
    }
  }, [initialTab]);

  const activePreset =
    SHORTCUT_PRESETS.find((p) => p.id === selectedPresetId) || SHORTCUT_PRESETS[0];

  const effectiveICloudUrl = customLinks[selectedPresetId] || activePreset.icloudUrl;
  const isUrlValid = isValidICloudLink(effectiveICloudUrl);

  const handleSelectPreset = (id: PresetId) => {
    triggerHaptic("light");
    setSelectedPresetId(id);
    setIsConfigOpen(false);
  };

  const handleAddShortcut = () => {
    if (!isUrlValid) {
      triggerHaptic("medium");
      setConfigInputUrl(customLinks[selectedPresetId] || "");
      setConfigError(null);
      setIsConfigOpen(true);
      showToast(
        isIndonesian
          ? "Tautan iCloud resmi diperlukan untuk pemasangan 1-ketukan."
          : "Official iCloud link required for 1-tap installation.",
        "info",
        () => {}
      );
      return;
    }

    triggerSuccessHaptic();
    // Open the official iCloud shortcut link which triggers the native iOS "Add Shortcut" sheet
    try {
      window.open(effectiveICloudUrl, "_system");
    } catch {
      window.location.href = effectiveICloudUrl;
    }
    showToast(
      isIndonesian
        ? "Membuka pintasan di Apple Shortcuts..."
        : "Opening shortcut in Apple Shortcuts...",
      "add",
      () => {}
    );
  };

  const handleCopyLink = () => {
    triggerSuccessHaptic();
    navigator.clipboard.writeText(effectiveICloudUrl);
    setCopiedKey(activePreset.id);
    showToast(
      isIndonesian
        ? "Tautan pintasan berhasil disalin ke papan klip"
        : "Shortcut link copied to clipboard",
      "add",
      () => {}
    );
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleOpenShortcutsApp = () => {
    triggerHaptic("medium");
    window.location.href = "shortcuts://";
  };

  const handleDirectLaunch = () => {
    triggerHaptic("medium");
    try {
      window.location.href = activePreset.directScheme;
    } catch {
      window.open(activePreset.directScheme, "_system");
    }
    showToast(
      isIndonesian ? "Memicu tindakan langsung Accrual..." : "Triggering Accrual action...",
      "info",
      () => {}
    );
  };

  const handleTestHud = () => {
    triggerHaptic("medium");
    window.dispatchEvent(
      new CustomEvent("accrual:test-hud", {
        detail: {
          amount: 85000,
          type: "expense",
          categoryName: isIndonesian ? "Makanan & Minuman" : "Food & Beverage",
          walletName: "BCA",
          note: isIndonesian ? "Simulasi Back Tap OCR" : "Back Tap OCR Simulation",
        },
      })
    );
    showToast(
      isIndonesian ? "Simulasi Dynamic Island HUD aktif" : "Dynamic Island HUD simulated",
      "add",
      () => {}
    );
  };

  const IconComponent = activePreset.icon;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isIndonesian ? "Pintasan & Otomatisasi Siap Pakai" : "Ready-Made Shortcuts & Automations"}
    >
      <div
        className="flex flex-col gap-6 px-4 pt-1"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)",
        }}
      >
        {/* 1. Segmented Preset Switcher Pills */}
        <div
          className="flex items-center gap-1.5 p-1 rounded-2xl border overflow-x-auto no-scrollbar"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)",
            borderColor: "var(--glass-border)",
          }}
        >
          {SHORTCUT_PRESETS.map((preset) => {
            const isSelected = preset.id === selectedPresetId;
            const TabIcon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? isDark
                      ? "bg-white/[0.08] text-white border border-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "bg-black/[0.06] text-black border border-black/10 shadow-sm"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-transparent"
                }`}
              >
                <TabIcon size={14} strokeWidth={isSelected ? 2 : 1.6} />
                <span>
                  {preset.id === "screen_scan"
                    ? isIndonesian
                      ? "Pindai Layar"
                      : "Screen Scanner"
                    : preset.id === "voice_entry"
                    ? isIndonesian
                      ? "Dikte Suara"
                      : "Voice Entry"
                    : preset.id === "receipt_scan"
                    ? isIndonesian
                      ? "Pindai Struk"
                      : "Receipt Scanner"
                    : isIndonesian
                    ? "Notifikasi Bank"
                    : "Bank Notification"}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. Apple Native 1-Tap Preset Hero Card (Photo 4 Parity) */}
        <div
          className="rounded-3xl p-5 border relative overflow-hidden flex flex-col items-center text-center shadow-xl transition-all"
          style={{
            background: isDark
              ? "radial-gradient(ellipse at top, rgba(255,255,255,0.06) 0%, rgba(12,12,16,0.95) 100%)"
              : "radial-gradient(ellipse at top, rgba(0,0,0,0.03) 0%, rgba(255,255,255,0.95) 100%)",
            borderColor: "var(--glass-border)",
          }}
        >
          {/* Subtle Ambient Glow */}
          <div
            className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full pointer-events-none blur-3xl opacity-20"
            style={{
              background: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)",
            }}
          />

          {/* Squircle App & Preset Hero Icon */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border shadow-lg mb-3.5 relative z-10"
            style={{
              background: isDark ? "#141418" : "#ffffff",
              borderColor: "var(--glass-border)",
              boxShadow: isDark
                ? "0 10px 25px -5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)"
                : "0 10px 25px -5px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            <IconComponent
              size={28}
              strokeWidth={1.75}
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          {/* Preset Title & Release Meta */}
          <h2
            className="text-[17px] font-semibold tracking-tight leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? activePreset.titleId : activePreset.titleEn}
          </h2>
          <p
            className="text-[11.5px] font-medium mt-1 mb-3"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian
              ? "Syntheticae Studio • Pintasan Resmi Accrual v1.3.20"
              : "Syntheticae Studio • Official Accrual Shortcut v1.3.20"}
          </p>

          {/* Description */}
          <p
            className="text-[12.5px] font-normal leading-relaxed max-w-sm px-1 mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            {isIndonesian ? activePreset.summaryId : activePreset.summaryEn}
          </p>

          {/* "About This Shortcut" Metadata Grid (Photo 4 Parity) */}
          <div
            className="w-full rounded-2xl p-3 border mb-5 flex flex-col gap-2.5 text-left text-[11.5px]"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
              borderColor: "var(--glass-border)",
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <Mic size={13} strokeWidth={1.8} />
              </div>
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                {isIndonesian
                  ? activePreset.metadata.siriPhraseId
                  : activePreset.metadata.siriPhraseEn}
              </span>
            </div>

            {activePreset.metadata.watchSupported && (
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Watch size={13} strokeWidth={1.8} />
                </div>
                <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian ? "Mendukung Apple Watch" : "Appears on Apple Watch"}
                </span>
              </div>
            )}

            {activePreset.metadata.lockScreenSupported && (
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Lock size={13} strokeWidth={1.8} />
                </div>
                <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian ? "Dapat Berjalan Saat Layar Terkunci" : "Can Run When Locked"}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <Smartphone size={13} strokeWidth={1.8} />
              </div>
              <span className="truncate font-medium" style={{ color: "var(--text-primary)" }}>
                {isIndonesian
                  ? activePreset.metadata.hardwareBindingId
                  : activePreset.metadata.hardwareBindingEn}
              </span>
            </div>
          </div>

          {/* Primary Action Button: + Add Shortcut */}
          <div className="w-full flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleAddShortcut}
              className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[13.5px] cursor-pointer shadow-lg active:scale-[0.98] transition-all"
              style={{
                background: isDark ? "#ffffff" : "#09090c",
                color: isDark ? "#09090c" : "#ffffff",
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>
                {isIndonesian ? "Tambah ke Pintasan" : "Add Shortcut"}
              </span>
            </button>

            {!isUrlValid && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] leading-tight text-center justify-center"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-tertiary)",
                }}
              >
                <AlertCircle size={12} strokeWidth={1.8} />
                <span>
                  {isIndonesian
                    ? "Tautan iCloud resmi diperlukan untuk instalasi 1-ketukan"
                    : "Official iCloud link required for 1-tap install"}
                </span>
              </div>
            )}

            {/* Auxiliary actions row */}
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 h-10 rounded-xl border flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-all cursor-pointer active:scale-[0.98]"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                {copiedKey === activePreset.id ? (
                  <>
                    <Check size={14} strokeWidth={2} />
                    <span>{isIndonesian ? "Tautan Tersalin" : "Link Copied"}</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} strokeWidth={1.8} />
                    <span>{isIndonesian ? "Salin Tautan" : "Copy Link"}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setConfigInputUrl(customLinks[selectedPresetId] || "");
                  setConfigError(null);
                  setIsConfigOpen((prev) => !prev);
                }}
                className="flex-1 h-10 rounded-xl border flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-all cursor-pointer active:scale-[0.98]"
                style={{
                  background: isConfigOpen
                    ? isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.08)"
                    : isDark
                    ? "rgba(255, 255, 255, 0.04)"
                    : "rgba(0, 0, 0, 0.04)",
                  borderColor: isUrlValid ? "var(--glass-border)" : "rgba(255, 255, 255, 0.2)",
                  color: "var(--text-primary)",
                }}
              >
                <LinkIcon size={13} strokeWidth={1.8} />
                <span>
                  {isUrlValid
                    ? isIndonesian
                      ? "Ubah Tautan"
                      : "Edit Link"
                    : isIndonesian
                    ? "Atur Tautan"
                    : "Set Link"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleTestHud}
                className="flex-1 h-10 rounded-xl border flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-all cursor-pointer active:scale-[0.98]"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                <Play size={13} strokeWidth={1.8} />
                <span>{isIndonesian ? "Uji HUD" : "Test HUD"}</span>
              </button>
            </div>
          </div>

          {/* In-App iCloud Link Configurator Card */}
          {isConfigOpen && (
            <div
              className="w-full rounded-2xl p-4 border mt-4 flex flex-col gap-3.5 text-left transition-all"
              style={{
                background: isDark ? "rgba(18, 18, 22, 0.95)" : "rgba(245, 245, 247, 0.95)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {isIndonesian ? "Konfigurasi Tautan iCloud Resmi" : "Official Shortcut iCloud Link"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="text-[11.5px] font-medium cursor-pointer"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Tutup" : "Close"}
                </button>
              </div>

              <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {isIndonesian
                  ? "Server Apple hanya menerima tautan resmi yang dibuat langsung dari aplikasi Pintasan di iOS/Mac. Buat pintasan sekali, lalu salin tautan iCloud-nya ke sini."
                  : "Apple servers only recognize official links generated directly from the Shortcuts app on iOS/Mac. Create the shortcut once, then paste its iCloud link here."}
              </p>

              <div
                className="rounded-xl p-2.5 border flex flex-col gap-1.5 text-[11px]"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                  borderColor: "var(--glass-border)",
                }}
              >
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {isIndonesian ? "Cara Mendapatkan Tautan (30 Detik):" : "How to Get the Link (30 Seconds):"}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian
                    ? "1. Buka aplikasi Pintasan › buat pintasan dengan tindakan di bawah."
                    : "1. Open Shortcuts app › build shortcut using actions listed below."}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian
                    ? "2. Ketuk ikon Bagikan (kotak panah ke atas) › pilih 'Salin Tautan iCloud'."
                    : "2. Tap the Share icon (square with arrow) › select 'Copy iCloud Link'."}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian
                    ? "3. Tempelkan tautan yang disalin ke kolom di bawah ini."
                    : "3. Paste the copied link into the field below."}
                </span>

                <button
                  type="button"
                  onClick={handleOpenShortcutsApp}
                  className="w-full h-8 mt-1 rounded-lg border flex items-center justify-center gap-1.5 font-semibold text-[11px] cursor-pointer"
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <span>{isIndonesian ? "Buka Aplikasi Pintasan" : "Open Shortcuts App"}</span>
                  <ExternalLink size={12} strokeWidth={1.8} />
                </button>
              </div>

              {/* Input field */}
              <div className="flex flex-col gap-1">
                <input
                  type="url"
                  value={configInputUrl}
                  onChange={(e) => {
                    setConfigInputUrl(e.target.value);
                    setConfigError(null);
                  }}
                  placeholder="https://www.icloud.com/shortcuts/..."
                  className="w-full h-10 px-3 rounded-xl border text-[12px] outline-none font-mono"
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
                    borderColor: configError ? "#ef4444" : "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                />
                {configError && (
                  <span className="text-[10.5px] text-red-400 pl-1 font-medium">
                    {configError}
                  </span>
                )}
              </div>

              {/* Save & Install CTA */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = configInputUrl.trim();
                    if (!isValidICloudLink(trimmed)) {
                      setConfigError(
                        isIndonesian
                          ? "Format tautan harus: https://www.icloud.com/shortcuts/[32 karakter heksadesimal]"
                          : "Format must be: https://www.icloud.com/shortcuts/[32 hex characters]"
                      );
                      triggerHaptic("heavy");
                      return;
                    }
                    saveICloudLink(selectedPresetId, trimmed);
                    setCustomLinks((prev) => ({ ...prev, [selectedPresetId]: trimmed }));
                    setIsConfigOpen(false);
                    triggerSuccessHaptic();
                    showToast(
                      isIndonesian
                        ? "Tautan iCloud berhasil disimpan!"
                        : "iCloud link saved successfully!",
                      "add",
                      () => {}
                    );
                    // Automatically trigger native install!
                    try {
                      window.open(trimmed, "_system");
                    } catch {
                      window.location.href = trimmed;
                    }
                  }}
                  className="flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-[12px] cursor-pointer shadow-md"
                  style={{
                    background: isDark ? "#ffffff" : "#09090c",
                    color: isDark ? "#09090c" : "#ffffff",
                  }}
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>{isIndonesian ? "Simpan & Pasang Pintasan" : "Save & Install"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-3.5 h-10 rounded-xl border flex items-center justify-center font-semibold text-[11.5px] cursor-pointer"
                  style={{
                    borderColor: "var(--glass-border)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {isIndonesian ? "Batal" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2.5 Apple Official Icon & Native Shortcuts Insight Card */}
        <div
          className="rounded-3xl p-4.5 border relative overflow-hidden flex flex-col gap-3 text-left transition-all"
          style={{
            background: isDark
              ? "radial-gradient(ellipse at top left, rgba(255,255,255,0.04) 0%, rgba(14,14,18,0.98) 100%)"
              : "radial-gradient(ellipse at top left, rgba(0,0,0,0.02) 0%, rgba(248,248,250,0.98) 100%)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
                borderColor: "var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <Sparkles size={14} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {isIndonesian
                  ? "Pintasan Resmi Berlogo Accrual Asli"
                  : "Official Shortcuts with Accrual Logo"}
              </h3>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {isIndonesian ? "Pintasan Bawaan Otomatis (0-Setup)" : "Zero-Setup Native App Shortcuts"}
              </p>
            </div>
          </div>

          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {isIndonesian
              ? "Di iOS, Apple secara otomatis menyematkan logo resmi Accrual pada Pintasan Bawaan (App Shortcuts). Pintasan kustom buatan manual dibatasi oleh iOS hanya menggunakan simbol bawaan. Semua tindakan resmi Accrual sudah otomatis tersedia di aplikasi Pintasan iPhone Anda."
              : "On iOS, Apple automatically embeds the authentic Accrual app logo on Native App Shortcuts. User-assembled custom shortcuts are restricted by iOS to system symbols. All official Accrual actions are already pre-loaded inside your iPhone Shortcuts app."}
          </p>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleOpenShortcutsApp}
              className="flex-1 h-9.5 rounded-xl border flex items-center justify-center gap-1.5 text-[11.5px] font-semibold transition-all cursor-pointer active:scale-[0.98]"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
                borderColor: "var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <ExternalLink size={13} strokeWidth={1.8} />
              <span>
                {isIndonesian ? "Buka Aplikasi Pintasan" : "Open Shortcuts App"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDirectLaunch}
              className="flex-1 h-9.5 rounded-xl border flex items-center justify-center gap-1.5 text-[11.5px] font-semibold transition-all cursor-pointer active:scale-[0.98]"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
                borderColor: "var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              <Play size={13} strokeWidth={1.8} />
              <span>
                {isIndonesian ? "Jalankan Langsung" : "Direct Launch"}
              </span>
            </button>
          </div>
        </div>

        {/* 3. Action Sequence Graph (Photo 5 Parity) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span
              className="text-[12px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Alur Tindakan Pintasan" : "Shortcut Action Pipeline"}
            </span>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
              style={{
                borderColor: "var(--glass-border)",
                color: "var(--text-tertiary)",
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
              }}
            >
              {activePreset.actions.length} {isIndonesian ? "Tindakan" : "Actions"}
            </span>
          </div>

          <div
            className="rounded-3xl p-4 border flex flex-col gap-0"
            style={{
              background: isDark ? "rgba(18, 18, 22, 0.6)" : "rgba(255, 255, 255, 0.6)",
              borderColor: "var(--glass-border)",
            }}
          >
            {activePreset.actions.map((act, index) => {
              const ActionIcon = act.icon;
              const isLast = index === activePreset.actions.length - 1;
              const isNested = act.type === "nested_action";

              return (
                <div key={act.id} className="flex flex-col">
                  {/* Action Node Row */}
                  <div
                    className={`flex items-start gap-3 py-2.5 px-3 rounded-2xl transition-colors ${
                      isNested ? "ml-5 border-l-2 pl-3 my-0.5" : ""
                    }`}
                    style={{
                      borderColor: isNested ? "var(--glass-border)" : undefined,
                      background: isNested
                        ? isDark
                          ? "rgba(255, 255, 255, 0.02)"
                          : "rgba(0, 0, 0, 0.02)"
                        : "transparent",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5"
                      style={{
                        background: act.isNativeIntent
                          ? isDark
                            ? "#ffffff"
                            : "#000000"
                          : isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : "rgba(0, 0, 0, 0.05)",
                        borderColor: "var(--glass-border)",
                        color: act.isNativeIntent
                          ? isDark
                            ? "#000000"
                            : "#ffffff"
                          : "var(--text-primary)",
                      }}
                    >
                      <ActionIcon size={15} strokeWidth={1.8} />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[13px] font-semibold leading-snug"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {isIndonesian ? act.titleId : act.titleEn}
                        </span>
                        {act.isNativeIntent && (
                          <span
                            className="text-[9.5px] font-bold px-1.5 py-0.2 rounded border"
                            style={{
                              borderColor: "var(--glass-border)",
                              background: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(0,0,0,0.06)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {isIndonesian ? "App Intent Asli" : "Native Intent"}
                          </span>
                        )}
                      </div>

                      {act.subtitleId && (
                        <span
                          className="text-[11px] leading-tight mt-0.5"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {isIndonesian ? act.subtitleId : act.subtitleEn}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Connecting Line between nodes */}
                  {!isLast && (
                    <div className="flex items-center pl-7 py-0.5">
                      <div
                        className="w-0.5 h-3.5 rounded-full"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.12)"
                            : "rgba(0, 0, 0, 0.12)",
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Hardware Setup Guide Card */}
        <div
          className="rounded-3xl p-4 border flex flex-col gap-3"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[12.5px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian
                ? activePreset.hardwareGuide.titleId
                : activePreset.hardwareGuide.titleEn}
            </span>
            <button
              type="button"
              onClick={handleOpenShortcutsApp}
              className="text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              <ExternalLink size={12} strokeWidth={1.8} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {(isIndonesian
              ? activePreset.hardwareGuide.stepsId
              : activePreset.hardwareGuide.stepsEn
            ).map((stepText, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-[11.5px] leading-relaxed">
                <div
                  className="w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border mt-0.5"
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {idx + 1}
                </div>
                <span style={{ color: "var(--text-secondary)" }}>{stepText}</span>
              </div>
            ))}
          </div>

          {/* Search tip in Shortcuts App */}
          <div
            className="flex items-center gap-1.5 pt-1 text-[11px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span>{isIndonesian ? "Tips pencarian:" : "Search tip:"}</span>
            <span
              className="font-medium px-1.5 py-0.5 rounded border"
              style={{
                borderColor: "var(--glass-border)",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                color: "var(--text-secondary)",
              }}
            >
              {isIndonesian ? "Cari Tindakan" : "Search Actions"}
            </span>
            <span>› Accrual</span>
          </div>
        </div>

        {/* 5. Done Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-2xl flex items-center justify-center font-semibold text-[13px] border cursor-pointer active:scale-[0.98] transition-all"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
            borderColor: "var(--glass-border)",
            color: "var(--text-primary)",
          }}
        >
          {isIndonesian ? "Selesai" : "Done"}
        </button>
      </div>
    </BottomSheet>
  );
}
