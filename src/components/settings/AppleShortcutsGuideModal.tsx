import { useState, useEffect, useMemo } from "react";
import {
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Smartphone,
  Bell,
  ScanLine,
  ListFilter,
  CreditCard,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSpace } from "../../contexts/SpaceContext";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import {
  isValidICloudLink,
  getSavedICloudLinks,
  saveICloudLink,
  getShortcutsConfig,
  OFFICIAL_SCREEN_SCAN_ICLOUD_URL,
  OFFICIAL_GLASS_DIALOG_ICLOUD_URL,
  ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY,
} from "../../lib/shortcutsConfig";

export {
  isValidICloudLink,
  getSavedICloudLinks,
  saveICloudLink,
  ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY,
};

export type TabType =
  | "back_tap"
  | "action_button"
  | "ways_to_add"
  | "automation"
  | "screen_scan"
  | "notification_reader"
  | "glass_dialog"
  | "wallet_tap"
  | "smart_text"
  | "receipt_scan";

export type PresetId =
  | "screen_scan"
  | "glass_dialog"
  | "notification_reader"
  | "smart_text"
  | "wallet_tap"
  | "voice_entry"
  | "receipt_scan";

function mapInitialTab(t?: TabType): PresetId {
  if (t === "glass_dialog") return "glass_dialog";
  if (t === "notification_reader" || t === "automation") return "notification_reader";
  if (t === "wallet_tap") return "wallet_tap";
  if (t === "smart_text" || t === "action_button" || t === "ways_to_add") return "smart_text";
  return "screen_scan";
}

export interface ShortcutActionNode {
  id: string;
  type: "standard" | "condition_start" | "nested_action" | "condition_end";
  icon: typeof ScanLine;
  titleId: string;
  titleEn: string;
  pills?: string[];
  isNativeIntent?: boolean;
}

export interface StepItem {
  number: number;
  titleId: string;
  titleEn: string;
  bodyId: string;
  bodyEn: string;
}

export interface ShortcutPreset {
  id: PresetId;
  icon: typeof ScanLine;
  tabLabelId: string;
  tabLabelEn: string;
  titleId: string;
  titleEn: string;
  taglineId: string;
  taglineEn: string;
  targetBadgeId: string;
  targetBadgeEn: string;
  icloudUrl: string;
  directScheme: string;
  hasICloudLink: boolean;
  isPersonalAutomation: boolean;
  actions: ShortcutActionNode[];
  steps: StepItem[];
}

export const GLASS_DIALOG_ACTIONS: ShortcutActionNode[] = [
  {
    id: "act-g1",
    type: "standard",
    icon: Smartphone,
    titleId: "Ask for Number",
    titleEn: "Ask for Number",
    pills: ["Nominal"],
  },
  {
    id: "act-g2",
    type: "standard",
    icon: ListFilter,
    titleId: "Text › Split › Choose from List",
    titleEn: "Text › Split › Choose from List",
    pills: ["Kategori"],
  },
  {
    id: "act-g3",
    type: "standard",
    icon: CreditCard,
    titleId: "Text › Split › Choose from List",
    titleEn: "Text › Split › Choose from List",
    pills: ["Akun / Wallet"],
  },
  {
    id: "act-g4",
    type: "standard",
    icon: Smartphone,
    titleId: "Ask for Date & Time • Ask for Text",
    titleEn: "Ask for Date & Time • Ask for Text",
    pills: ["Tanggal & Jam", "Catatan"],
  },
  {
    id: "act-g5",
    type: "standard",
    icon: Sparkles,
    titleId: "Log Quick Draft Transaction",
    titleEn: "Log Quick Draft Transaction",
    pills: ["Amount", "Category", "Account", "Date & Time", "Note"],
    isNativeIntent: true,
  },
];

export const SHORTCUT_PRESETS: ShortcutPreset[] = [
  // 1. SCREEN SCANNER (Official iCloud Link #1)
  {
    id: "screen_scan",
    icon: ScanLine,
    tabLabelId: "Screen Scan",
    tabLabelEn: "Screen Scan",
    titleId: "Screen Scanner",
    titleEn: "Screen Scanner",
    taglineId: "Scan struk di layar via Back Tap 2x tanpa simpan foto ke galeri.",
    taglineEn: "Scan receipts on screen via Back Tap without saving photos to gallery.",
    targetBadgeId: "Masuk ke Draft",
    targetBadgeEn: "Saves to Draft",
    icloudUrl: OFFICIAL_SCREEN_SCAN_ICLOUD_URL,
    directScheme: "accrual://scan-screen?text=[Teks dari Gambar]&draft=true",
    hasICloudLink: true,
    isPersonalAutomation: false,
    actions: [
      {
        id: "act-s1",
        type: "standard",
        icon: ScanLine,
        titleId: "Take screenshot",
        titleEn: "Take screenshot",
        pills: ["RAM Only"],
      },
      {
        id: "act-s2",
        type: "standard",
        icon: FileText,
        titleId: "Extract Text from",
        titleEn: "Extract Text from",
        pills: ["Screenshot"],
      },
      {
        id: "act-s3",
        type: "standard",
        icon: Sparkles,
        titleId: "Scan payment from",
        titleEn: "Scan payment from",
        pills: ["Extracted Text"],
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Ketuk tombol Pasang Pintasan di atas",
        titleEn: "Tap the Install Shortcut button above",
        bodyId: "Pintasan otomatis masuk ke aplikasi Pintasan iPhone Anda.",
        bodyEn: "The shortcut will be added directly to your iPhone Shortcuts app.",
      },
      {
        number: 2,
        titleId: "Hubungkan ke Ketuk Belakang (Back Tap)",
        titleEn: "Bind to iPhone Back Tap",
        bodyId: "Pengaturan › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › pilih Screen Scanner.",
        bodyEn: "Settings › Accessibility › Touch › Back Tap › select Screen Scanner.",
      },
    ],
  },

  // 2. DIALOG GLASS (Official iCloud Link #2 + Direct to Transactions)
  {
    id: "glass_dialog",
    icon: Sparkles,
    tabLabelId: "Dialog Glass",
    tabLabelEn: "Dialog Glass",
    titleId: "Dialog Glass",
    titleEn: "Dialog Glass",
    taglineId: "Input kilat 5 langkah via Back Tap, langsung tercatat ke Transaksi.",
    taglineEn: "5-step quick input via Back Tap, directly recorded into Transactions.",
    targetBadgeId: "Langsung Tercatat",
    targetBadgeEn: "Direct Record",
    icloudUrl: OFFICIAL_GLASS_DIALOG_ICLOUD_URL,
    directScheme:
      "accrual://glass-dialog?amount=[Nominal]&category=[Kategori]&wallet=[Akun]&datetime=[Tanggal]&note=[Catatan]",
    hasICloudLink: true,
    isPersonalAutomation: false,
    actions: GLASS_DIALOG_ACTIONS,
    steps: [
      {
        number: 1,
        titleId: "Ketuk Pasang Pintasan Dialog Glass di atas",
        titleEn: "Tap Install Dialog Glass Shortcut above",
        bodyId: "Tambahkan template pintasan ke iPhone Anda.",
        bodyEn: "Add the shortcut template to your iPhone.",
      },
      {
        number: 2,
        titleId: "Tempel Kategori & Akun Milik Anda",
        titleEn: "Paste Your Categories & Accounts",
        bodyId: "Buka pintasan Dialog Glass (ketuk •••) › tempel daftar di atas ke kotak Text ke-1 (Kategori) & Text ke-2 (Akun).",
        bodyEn: "Edit Dialog Glass (tap •••) › paste the lists above into the 1st Text box (Categories) & 2nd Text box (Accounts).",
      },
      {
        number: 3,
        titleId: "Pasang ke Back Tap",
        titleEn: "Bind to Back Tap",
        bodyId: "Pengaturan › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › pilih Dialog Glass.",
        bodyEn: "Settings › Accessibility › Touch › Back Tap › select Dialog Glass.",
      },
    ],
  },

  // 3. NOTIFICATION READER (Self-Setup)
  {
    id: "notification_reader",
    icon: Bell,
    tabLabelId: "Notifikasi",
    tabLabelEn: "Notifications",
    titleId: "Log Notifikasi Bank",
    titleEn: "Bank Notification Logger",
    taglineId: "Otomatis tangkap mutasi bank/e-wallet & saring promo/OTP.",
    taglineEn: "Auto-capture bank/e-wallet alerts & filter out promos/OTPs.",
    targetBadgeId: "Masuk ke Draft",
    targetBadgeEn: "Saves to Draft",
    icloudUrl: "",
    directScheme:
      "accrual://notify?text=[Teks]&title=[Judul]&subtitle=[Subjudul]&app=[Aplikasi]&at=[Tanggal]&draft=true",
    hasICloudLink: false,
    isPersonalAutomation: true,
    actions: [
      {
        id: "act-n1",
        type: "standard",
        icon: Bell,
        titleId: "When I Receive Notification",
        titleEn: "When I Receive Notification",
        pills: ["BCA, Mandiri, GoPay, DANA..."],
      },
      {
        id: "act-n2",
        type: "standard",
        icon: ShieldCheck,
        titleId: "Log Notification Transaction",
        titleEn: "Log Notification Transaction",
        pills: ["Notification", "Title", "Subtitle", "App", "Received At"],
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Buka Tab Automasi di Pintasan iOS",
        titleEn: "Open Automation Tab in iOS Shortcuts",
        bodyId: "Ketuk (+) › pilih 'Saat Saya Menerima Pemberitahuan' › aktifkan 'Jalankan Segera'.",
        bodyEn: "Tap (+) › select 'When I Receive Notification' › enable 'Run Immediately'.",
      },
      {
        number: 2,
        titleId: "Pilih Aplikasi Bank & E-Wallet",
        titleEn: "Select Bank & E-Wallet Apps",
        bodyId: "Pilih BCA, Livin', BRImo, BNI, SeaBank, Jago, GoPay, DANA, OVO, atau ShopeePay.",
        bodyEn: "Pick BCA, Livin', BRImo, BNI, SeaBank, Jago, GoPay, DANA, OVO, or ShopeePay.",
      },
      {
        number: 3,
        titleId: "Pilih Aksi Accrual 'Log Notification Transaction'",
        titleEn: "Select Accrual 'Log Notification Transaction'",
        bodyId: "Buat Pintasan Kosong Baru › cari Accrual › pilih Log Notification Transaction.",
        bodyEn: "Create Blank Shortcut › search Accrual › select Log Notification Transaction.",
      },
    ],
  },

  // 4. SMART TEXT (Self-Setup)
  {
    id: "smart_text",
    icon: FileText,
    tabLabelId: "Smart Text",
    tabLabelEn: "Smart Text",
    titleId: "Smart Clipboard",
    titleEn: "Smart Clipboard",
    taglineId: "Ekstrak teks mutasi yang baru disalin di papan klip ke Draft.",
    taglineEn: "Extract copied transaction text from clipboard into Drafts.",
    targetBadgeId: "Masuk ke Draft",
    targetBadgeEn: "Saves to Draft",
    icloudUrl: "",
    directScheme: "accrual://smart-text?text=[Papan Klip]&draft=true",
    hasICloudLink: false,
    isPersonalAutomation: false,
    actions: [
      {
        id: "act-st1",
        type: "standard",
        icon: Copy,
        titleId: "Get Clipboard",
        titleEn: "Get Clipboard",
        pills: ["Papan Klip"],
      },
      {
        id: "act-st2",
        type: "standard",
        icon: Sparkles,
        titleId: "Log Smart Text Transaction",
        titleEn: "Log Smart Text Transaction",
        pills: ["Clipboard"],
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Buat Pintasan Baru (+)",
        titleEn: "Create New Shortcut (+)",
        bodyId: "Tambahkan aksi bawaan 'Get Clipboard' (Dapatkan Papan Klip).",
        bodyEn: "Add the built-in 'Get Clipboard' action.",
      },
      {
        number: 2,
        titleId: "Tambahkan Aksi Accrual 'Log Smart Text Transaction'",
        titleEn: "Add Accrual 'Log Smart Text Transaction'",
        bodyId: "Cari Accrual › pilih Log Smart Text Transaction › hubungkan ke [Clipboard].",
        bodyEn: "Search Accrual › select Log Smart Text Transaction › pass [Clipboard].",
      },
    ],
  },

  // 5. WALLET TAP (Self-Setup)
  {
    id: "wallet_tap",
    icon: CreditCard,
    tabLabelId: "Wallet Tap",
    tabLabelEn: "Wallet Tap",
    titleId: "Wallet & NFC Tap",
    titleEn: "Wallet & NFC Tap",
    taglineId: "Otomatis catat saat tap kartu Apple Pay atau tag NFC.",
    taglineEn: "Auto-log when tapping an Apple Pay card or NFC tag.",
    targetBadgeId: "Masuk ke Draft",
    targetBadgeEn: "Saves to Draft",
    icloudUrl: "",
    directScheme:
      "accrual://wallet-tap?amount=[Jumlah]&merchant=[Merchant]&wallet=[Kartu]&datetime=[Tanggal]&draft=true",
    hasICloudLink: false,
    isPersonalAutomation: true,
    actions: [
      {
        id: "act-w1",
        type: "standard",
        icon: CreditCard,
        titleId: "When I Tap Wallet Card / NFC",
        titleEn: "When I Tap Wallet Card / NFC",
        pills: ["Trigger"],
      },
      {
        id: "act-w2",
        type: "standard",
        icon: Sparkles,
        titleId: "Log Card Transaction",
        titleEn: "Log Card Transaction",
        pills: ["Amount", "Merchant", "Card"],
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Buka Tab Automasi › Transaksi / NFC",
        titleEn: "Open Automation Tab › Transaction / NFC",
        bodyId: "Pilih kartu Apple Pay atau scan stiker NFC Anda.",
        bodyEn: "Select your Apple Pay card or scan your NFC tag.",
      },
      {
        number: 2,
        titleId: "Tambahkan Aksi Accrual 'Log Card Transaction'",
        titleEn: "Add Accrual 'Log Card Transaction'",
        bodyId: "Cari Accrual › pilih Log Card Transaction › petakan Amount, Merchant, dan Card.",
        bodyEn: "Search Accrual › select Log Card Transaction › map Amount, Merchant, and Card.",
      },
    ],
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
  initialTab = "screen_scan",
}: AppleShortcutsGuideModalProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { showToast } = useToast();
  const { activeSpace } = useSpace();
  const { data: categories = [] } = useCategories();
  const { data: wallets = [] } = useWallets();

  const [selectedId, setSelectedId] = useState<PresetId>(() =>
    mapInitialTab(initialTab),
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedId(mapInitialTab(initialTab));
      setShowSteps(false);
    }
  }, [isOpen, initialTab]);

  const activePreset =
    SHORTCUT_PRESETS.find((p) => p.id === selectedId) || SHORTCUT_PRESETS[0];

  const activeSpaceLabel =
    activeSpace?.id !== "all" && activeSpace?.name
      ? activeSpace.name
      : isIndonesian
      ? "Space Pribadi"
      : "Personal Space";

  // Build vertical newline-separated lists directly from the user's real Categories and Wallets
  const userCategoryLines = useMemo(() => {
    const expenseCats = categories
      .filter((c) => c.type !== "income")
      .map((c) => c.name.trim())
      .filter(Boolean);
    const allCats =
      expenseCats.length > 0
        ? expenseCats
        : categories.map((c) => c.name.trim()).filter(Boolean);
    const unique = Array.from(new Set(allCats));
    if (unique.length > 0) return unique.join("\n");
    return isIndonesian
      ? "Makanan\nBensin\nTransportasi\nBelanja\nTagihan"
      : "Food\nFuel\nTransport\nShopping\nBills";
  }, [categories, isIndonesian]);

  const userWalletLines = useMemo(() => {
    const names = Array.from(
      new Set(wallets.map((w) => w.name.trim()).filter(Boolean)),
    );
    if (names.length > 0) return names.join("\n");
    return isIndonesian ? "BCA\nMandiri\nBNI\nGoPay\nCash" : "BCA\nMandiri\nBNI\nGoPay\nCash";
  }, [wallets, isIndonesian]);

  const configManifest = getShortcutsConfig();
  const effectiveICloudUrl =
    activePreset.id === "screen_scan"
      ? configManifest.shortcuts.screen_scan.icloud_url
      : activePreset.id === "glass_dialog"
      ? configManifest.shortcuts.glass_dialog.icloud_url
      : "";

  const handleSelectPreset = (id: PresetId) => {
    triggerHaptic("light");
    setSelectedId(id);
  };

  const handlePrimaryAction = () => {
    if (activePreset.hasICloudLink && effectiveICloudUrl) {
      triggerSuccessHaptic();
      window.open(effectiveICloudUrl, "_blank", "noopener,noreferrer");
      return;
    }
    triggerHaptic("medium");
    window.location.href = "shortcuts://";
  };

  const copyCategoryList = () => {
    triggerSuccessHaptic();
    navigator.clipboard.writeText(userCategoryLines);
    setCopiedKey("categories-list");
    showToast(
      isIndonesian ? "Daftar kategori disalin" : "Categories copied",
      "info",
      () => {},
    );
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const copyWalletList = () => {
    triggerSuccessHaptic();
    navigator.clipboard.writeText(userWalletLines);
    setCopiedKey("wallets-list");
    showToast(
      isIndonesian ? "Daftar akun/wallet disalin" : "Accounts copied",
      "info",
      () => {},
    );
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const pillSurface = isDark
    ? "rgba(255, 255, 255, 0.06)"
    : "rgba(0, 0, 0, 0.045)";

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isIndonesian ? "Pintasan iOS" : "iOS Shortcuts"}
    >
      <div
        className="flex flex-col gap-3 px-4 pt-1 select-none"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 18px), 24px)",
        }}
      >
        {/* 1. Interactive Icon Pill Switcher */}
        <div
          className="grid grid-cols-5 gap-1 p-1 rounded-2xl border"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)",
            borderColor: "var(--glass-border)",
          }}
        >
          {SHORTCUT_PRESETS.map((preset) => {
            const isSelected = preset.id === activePreset.id;
            const TabIcon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? isDark
                      ? "bg-white/[0.11] text-white border border-white/15"
                      : "bg-black/[0.08] text-black border border-black/10"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-transparent"
                }`}
              >
                <TabIcon size={14} strokeWidth={isSelected ? 2.1 : 1.7} />
                <span className="text-[10px] font-semibold truncate max-w-full">
                  {isIndonesian ? preset.tabLabelId : preset.tabLabelEn}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. Hero Card + Instant CTA + Visual Block Recipe */}
        <div
          className="rounded-2xl p-3.5 border space-y-3 text-left"
          style={{
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="text-[15px] font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? activePreset.titleId : activePreset.titleEn}
                </h3>
                <span
                  className="text-[9.5px] font-semibold px-2 py-0.5 rounded-full border"
                  style={{
                    background: pillSurface,
                    borderColor: "var(--glass-border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {isIndonesian
                    ? activePreset.targetBadgeId
                    : activePreset.targetBadgeEn}{" "}
                  • {activeSpaceLabel}
                </span>
              </div>
              <p
                className="text-[11.5px] mt-0.5 leading-snug"
                style={{ color: "var(--text-secondary)" }}
              >
                {isIndonesian ? activePreset.taglineId : activePreset.taglineEn}
              </p>
            </div>
          </div>

          {/* Primary 1-Tap Install / Open Button RIGHT AT THE TOP */}
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="w-full h-10.5 rounded-xl font-semibold text-[12.5px] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all shadow-sm"
            style={{
              background: isDark ? "#ffffff" : "#09090c",
              color: isDark ? "#09090c" : "#ffffff",
            }}
          >
            {activePreset.hasICloudLink ? (
              <>
                <Download size={14} strokeWidth={2.3} />
                <span>
                  {isIndonesian
                    ? `Pasang Pintasan ${activePreset.titleId}`
                    : `Install ${activePreset.titleEn} Shortcut`}
                </span>
              </>
            ) : (
              <>
                <ExternalLink size={14} strokeWidth={2.2} />
                <span>
                  {isIndonesian
                    ? "Buka Aplikasi Pintasan iOS"
                    : "Open iOS Shortcuts App"}
                </span>
              </>
            )}
          </button>

          {/* Visual iOS Shortcut Action Nodes */}
          <div className="space-y-1.5 pt-0.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider block"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Susunan Blok Aksi" : "Action Blocks"}
            </span>
            <div className="space-y-1.5">
              {activePreset.actions.map((act, idx) => {
                const ActIcon = act.icon;
                return (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                    style={{
                      background: act.isNativeIntent
                        ? isDark
                          ? "rgba(255,255,255,0.07)"
                          : "rgba(0,0,0,0.05)"
                        : isDark
                        ? "rgba(0,0,0,0.28)"
                        : "rgba(255,255,255,0.75)",
                      borderColor: "var(--glass-border)",
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-5.5 h-5.5 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold border"
                        style={{
                          background: act.isNativeIntent
                            ? isDark
                              ? "#ffffff"
                              : "#09090c"
                            : pillSurface,
                          color: act.isNativeIntent
                            ? isDark
                              ? "#09090c"
                              : "#ffffff"
                            : "var(--text-secondary)",
                          borderColor: "var(--glass-border)",
                        }}
                      >
                        {act.isNativeIntent ? (
                          <ActIcon size={11.5} strokeWidth={2.3} />
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <span
                        className="text-[11.5px] font-semibold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {isIndonesian ? act.titleId : act.titleEn}
                      </span>
                    </div>

                    {act.pills && act.pills.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        {act.pills.slice(0, 3).map((pill) => (
                          <span
                            key={pill}
                            className="px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold border"
                            style={{
                              background: pillSurface,
                              borderColor: "var(--glass-border)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {pill}
                          </span>
                        ))}
                        {act.pills.length > 3 && (
                          <span
                            className="px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            +{act.pills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Interactive Ready Copy-Paste Boxes ONLY for Dialog Glass */}
        {activePreset.id === "glass_dialog" && (
          <div
            className="rounded-2xl p-3.5 border space-y-2.5 text-left"
            style={{
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              borderColor: "var(--glass-border)",
            }}
          >
            <div>
              <h4
                className="text-[12.5px] font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? "Sesuaikan Kategori & Akun Anda (1-Tap Copy)"
                  : "Customize Your Categories & Accounts (1-Tap Copy)"}
              </h4>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                {isIndonesian
                  ? "Buka pintasan Dialog Glass (ketuk •••), lalu tempel daftar milik Anda di bawah ini ke kotak Text ke-1 dan Text ke-2:"
                  : "Edit Dialog Glass (tap •••) and paste your lists below into the 1st and 2nd Text boxes:"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Box 1: User Categories */}
              <div
                className="rounded-xl p-2.5 border flex flex-col justify-between gap-2"
                style={{
                  background: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
                  borderColor: "var(--glass-border)",
                }}
              >
                <div className="space-y-1">
                  <span
                    className="text-[10.5px] font-bold block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "1. Kotak Text Kategori" : "1. Category Text Box"}
                  </span>
                  <pre
                    className="text-[10.5px] leading-snug font-mono whitespace-pre-wrap max-h-24 overflow-y-auto no-scrollbar py-1 px-1.5 rounded-lg border"
                    style={{
                      background: pillSurface,
                      borderColor: "var(--glass-border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {userCategoryLines}
                  </pre>
                </div>
                <button
                  type="button"
                  onClick={copyCategoryList}
                  className="w-full h-8 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  style={{
                    background:
                      copiedKey === "categories-list"
                        ? isDark
                          ? "#ffffff"
                          : "#09090c"
                        : pillSurface,
                    color:
                      copiedKey === "categories-list"
                        ? isDark
                          ? "#09090c"
                          : "#ffffff"
                        : "var(--text-primary)",
                    borderColor: "var(--glass-border)",
                  }}
                >
                  {copiedKey === "categories-list" ? (
                    <>
                      <Check size={12} strokeWidth={2.5} />
                      <span>{isIndonesian ? "Tersalin" : "Copied"}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11.5} strokeWidth={2} />
                      <span>{isIndonesian ? "Salin Kategori" : "Copy Categories"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Box 2: User Accounts */}
              <div
                className="rounded-xl p-2.5 border flex flex-col justify-between gap-2"
                style={{
                  background: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
                  borderColor: "var(--glass-border)",
                }}
              >
                <div className="space-y-1">
                  <span
                    className="text-[10.5px] font-bold block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "2. Kotak Text Akun" : "2. Account Text Box"}
                  </span>
                  <pre
                    className="text-[10.5px] leading-snug font-mono whitespace-pre-wrap max-h-24 overflow-y-auto no-scrollbar py-1 px-1.5 rounded-lg border"
                    style={{
                      background: pillSurface,
                      borderColor: "var(--glass-border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {userWalletLines}
                  </pre>
                </div>
                <button
                  type="button"
                  onClick={copyWalletList}
                  className="w-full h-8 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  style={{
                    background:
                      copiedKey === "wallets-list"
                        ? isDark
                          ? "#ffffff"
                          : "#09090c"
                        : pillSurface,
                    color:
                      copiedKey === "wallets-list"
                        ? isDark
                          ? "#09090c"
                          : "#ffffff"
                        : "var(--text-primary)",
                    borderColor: "var(--glass-border)",
                  }}
                >
                  {copiedKey === "wallets-list" ? (
                    <>
                      <Check size={12} strokeWidth={2.5} />
                      <span>{isIndonesian ? "Tersalin" : "Copied"}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11.5} strokeWidth={2} />
                      <span>{isIndonesian ? "Salin Akun" : "Copy Accounts"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Collapsible / Interactive Setup Steps Accordion (Zero Overwhelm) */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            background: isDark ? "rgba(18, 18, 22, 0.85)" : "rgba(255, 255, 255, 0.94)",
            borderColor: "var(--glass-border)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setShowSteps((prev) => !prev);
            }}
            className="w-full px-3.5 py-3 flex items-center justify-between cursor-pointer text-left"
          >
            <span
              className="text-[12.5px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian
                ? `Panduan Singkat (${activePreset.steps.length} Langkah)`
                : `Quick Guide (${activePreset.steps.length} Steps)`}
            </span>
            {showSteps || !activePreset.hasICloudLink ? (
              <ChevronUp size={15} style={{ color: "var(--text-tertiary)" }} />
            ) : (
              <ChevronDown size={15} style={{ color: "var(--text-tertiary)" }} />
            )}
          </button>

          {(showSteps || !activePreset.hasICloudLink) && (
            <div
              className="divide-y border-t"
              style={{ borderColor: "var(--glass-border)" }}
            >
              {activePreset.steps.map((step) => (
                <div
                  key={step.number}
                  className="px-3.5 py-2.5 flex items-start gap-2.5 text-left"
                  style={{ borderColor: "var(--glass-border)" }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10.5px] font-bold mt-0.5"
                    style={{
                      background: pillSurface,
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {step.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[12px] font-semibold leading-snug"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian ? step.titleId : step.titleEn}
                    </p>
                    <p
                      className="text-[11px] leading-relaxed mt-0.5"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {isIndonesian ? step.bodyId : step.bodyEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
