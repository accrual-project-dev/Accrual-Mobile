import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  Mic,
  SlidersHorizontal,
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
  CheckCircle2,
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
        subtitleId: "Tindakan Asli Accrual • Live Text OCR Lokal",
        subtitleEn: "Accrual Native Intent • On-Device OCR",
        isNativeIntent: true,
      },
      {
        id: "act-3",
        type: "condition_start",
        icon: SlidersHorizontal,
        titleId: "Jika Scan Payment Screenshot berisi DELETE_SCREENSHOT",
        titleEn: "If Scan Payment Screenshot contains DELETE_SCREENSHOT",
        subtitleId: "Kondisi logika otomatis",
        subtitleEn: "Automated logic condition",
      },
      {
        id: "act-4",
        type: "nested_action",
        icon: Trash2,
        titleId: "Hapus Jepretan Layar",
        titleEn: "Delete Screenshot",
        subtitleId: "Pembersihan otomatis agar galeri foto tetap rapi",
        subtitleEn: "Auto cleanup to keep your photo library clean",
      },
      {
        id: "act-5",
        type: "condition_end",
        icon: CheckCircle2,
        titleId: "Akhir Jika",
        titleEn: "End If",
      },
    ],
    hardwareGuide: {
      titleId: "Tautkan ke Ketuk Bagian Belakang (Back Tap)",
      titleEn: "Bind to Back Tap (Double Tap)",
      stepsId: [
        "Buka Pengaturan iOS › Aksesibilitas › Sentuh › Ketuk Bagian Belakang.",
        "Pilih 'Ketuk Dua Kali' › Gulir ke bagian Pintasan › Centang 'Accrual Screen Scanner'.",
        "Kini cukup ketuk 2x bodi belakang iPhone saat melihat bukti transfer atau struk pembayaran.",
      ],
      stepsEn: [
        "Open iOS Settings › Accessibility › Touch › Back Tap.",
        "Select 'Double Tap' › Scroll down to Shortcuts › Choose 'Accrual Screen Scanner'.",
        "Now double-tap the back of your iPhone whenever viewing any transfer confirmation or receipt.",
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

  useEffect(() => {
    if (initialTab) {
      setSelectedPresetId(mapInitialTab(initialTab));
    }
  }, [initialTab]);

  const activePreset =
    SHORTCUT_PRESETS.find((p) => p.id === selectedPresetId) || SHORTCUT_PRESETS[0];

  const handleSelectPreset = (id: PresetId) => {
    triggerHaptic("light");
    setSelectedPresetId(id);
  };

  const handleAddShortcut = () => {
    triggerSuccessHaptic();
    // Open the official iCloud shortcut link which triggers the native iOS "Add Shortcut" sheet
    try {
      window.open(activePreset.icloudUrl, "_system");
    } catch {
      window.location.href = activePreset.icloudUrl;
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
    navigator.clipboard.writeText(activePreset.icloudUrl);
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
              ? "Syntheticae Studio • Pintasan Resmi Accrual v1.3.19"
              : "Syntheticae Studio • Official Accrual Shortcut v1.3.19"}
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
                onClick={handleTestHud}
                className="flex-1 h-10 rounded-xl border flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-all cursor-pointer active:scale-[0.98]"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                <Play size={13} strokeWidth={1.8} />
                <span>{isIndonesian ? "Uji Kapsul HUD" : "Simulate HUD"}</span>
              </button>
            </div>
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
