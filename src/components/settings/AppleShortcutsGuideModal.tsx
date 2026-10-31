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
  Play,
} from "lucide-react";
import { format } from "date-fns";
import { BottomSheet } from "../ui/BottomSheet";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSpace } from "../../contexts/SpaceContext";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import {
  saveDraftBatch,
  resolveActiveDraftSpaceId,
} from "../../lib/draftTransactionService";
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
  | "receipt_scan";

export type PresetId =
  | "screen_scan"
  | "glass_dialog"
  | "notification_reader"
  | "wallet_tap"
  | "voice_entry"
  | "receipt_scan";

function mapInitialTab(t?: TabType): PresetId {
  if (t === "glass_dialog" || t === "action_button" || t === "ways_to_add") {
    return "glass_dialog";
  }
  if (t === "notification_reader" || t === "automation") {
    return "notification_reader";
  }
  if (t === "wallet_tap") {
    return "wallet_tap";
  }
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

  // 3. NOTIFICATION READER (1-Step Input Automation)
  {
    id: "notification_reader",
    icon: Bell,
    tabLabelId: "Notifikasi",
    tabLabelEn: "Notifications",
    titleId: "Log Notifikasi Bank",
    titleEn: "Bank Notification Logger",
    taglineId: "Otomatis tangkap mutasi bank/e-wallet hanya dengan 1 input (Shortcut Input) & saring promo/OTP.",
    taglineEn: "Auto-capture bank/e-wallet alerts with 1 input (Shortcut Input) & filter out promos/OTPs.",
    targetBadgeId: "Masuk ke Draft",
    targetBadgeEn: "Saves to Draft",
    icloudUrl: "",
    directScheme: "accrual://notify?text=[Shortcut Input]&draft=true",
    hasICloudLink: false,
    isPersonalAutomation: true,
    actions: [
      {
        id: "act-n1",
        type: "standard",
        icon: Bell,
        titleId: "When I Receive Notification",
        titleEn: "When I Receive Notification",
        pills: ["BCA, Livin', GoPay, DANA..."],
      },
      {
        id: "act-n2",
        type: "standard",
        icon: ShieldCheck,
        titleId: "Log bank notification",
        titleEn: "Log bank notification",
        pills: ["Shortcut Input"],
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Buka Tab Automasi di Pintasan iOS",
        titleEn: "Open Automation Tab in iOS Shortcuts",
        bodyId: "Ketuk (+) › pilih 'Saat Saya Menerima Pemberitahuan' (When I Receive Notification) › pilih 'Jalankan Segera' (Run Immediately).",
        bodyEn: "Tap (+) › select 'When I Receive Notification' › enable 'Run Immediately'.",
      },
      {
        number: 2,
        titleId: "Pilih Aplikasi Bank / E-Wallet",
        titleEn: "Select Bank / E-Wallet Apps",
        bodyId: "Pilih aplikasi seperti myBCA, BCA mobile, Livin', BRImo, wondr, SeaBank, Jago, GoPay, DANA, OVO, atau ShopeePay.",
        bodyEn: "Pick apps like myBCA, BCA mobile, Livin', BRImo, wondr, SeaBank, Jago, GoPay, DANA, OVO, or ShopeePay.",
      },
      {
        number: 3,
        titleId: "Hubungkan ke 'Shortcut Input' (1 Klik)",
        titleEn: "Connect to 'Shortcut Input' (1 Tap)",
        bodyId: "Pilih 'Buat Pintasan Kosong Baru' › cari Accrual › pilih 'Log Notification Transaction' › isi kolom Notification dengan 'Shortcut Input'.",
        bodyEn: "Select 'Create Blank Shortcut' › search Accrual › pick 'Log Notification Transaction' › set Notification to 'Shortcut Input'.",
      },
    ],
  },

  // 4. WALLET TAP (1-Step Input Automation)
  {
    id: "wallet_tap",
    icon: CreditCard,
    tabLabelId: "Wallet Tap",
    tabLabelEn: "Wallet Tap",
    titleId: "Wallet & NFC Tap",
    titleEn: "Wallet & NFC Tap",
    taglineId: "Otomatis catat transaksi saat tap kartu Apple Pay atau tag NFC hanya dengan 1 variabel.",
    taglineEn: "Auto-log transactions when tapping an Apple Pay card or NFC tag with a single variable.",
    targetBadgeId: "Masuk ke Draft",
    targetBadgeEn: "Saves to Draft",
    icloudUrl: "",
    directScheme:
      "accrual://wallet-tap?text=[Shortcut Input]&draft=true",
    hasICloudLink: false,
    isPersonalAutomation: true,
    actions: [
      {
        id: "act-w1",
        type: "standard",
        icon: CreditCard,
        titleId: "When I Tap Wallet Card / NFC",
        titleEn: "When I Tap Wallet Card / NFC",
        pills: ["Transaction / NFC"],
      },
      {
        id: "act-w2",
        type: "standard",
        icon: Sparkles,
        titleId: "Log card transaction",
        titleEn: "Log card transaction",
        pills: ["Shortcut Input"],
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Buka Tab Automasi › Transaksi atau NFC",
        titleEn: "Open Automation Tab › Transaction or NFC",
        bodyId: "Ketuk (+) di tab Automasi › pilih pemicu 'Transaksi' (Kartu Dompet) atau 'NFC' › pilih 'Jalankan Segera'.",
        bodyEn: "Tap (+) in Automation › choose 'Transaction' (Wallet Card) or 'NFC' trigger › select 'Run Immediately'.",
      },
      {
        number: 2,
        titleId: "Pilih Kartu atau Scan Tag NFC",
        titleEn: "Select Card or Scan NFC Tag",
        bodyId: "Pilih kartu pembayaran Anda atau tempelkan stiker NFC.",
        bodyEn: "Select your payment card or scan your NFC sticker.",
      },
      {
        number: 3,
        titleId: "Tambahkan 'Log Card Transaction'",
        titleEn: "Add 'Log Card Transaction'",
        bodyId: "Pilih 'Buat Pintasan Kosong Baru' › cari Accrual › pilih 'Log Card Transaction' › hubungkan langsung ke 'Shortcut Input' (atau isi Merchant & Kartu di opsi tambahan).",
        bodyEn: "Select 'Create Blank Shortcut' › search Accrual › pick 'Log Card Transaction' › pass 'Shortcut Input' directly (or fill Merchant & Card in optional fields).",
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
  const { activeSpace, activeSpaceId, defaultSpaceId } = useSpace();
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

  const copySchemeTemplate = (schemeText: string, keyName: string) => {
    triggerSuccessHaptic();
    navigator.clipboard.writeText(schemeText);
    setCopiedKey(keyName);
    showToast(
      isIndonesian
        ? "URL skema berhasil disalin"
        : "Shortcut URL scheme copied",
      "info",
      () => {},
    );
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleSimulateAutomation = (presetId: "notification_reader" | "wallet_tap") => {
    triggerSuccessHaptic();
    const targetSpaceId = resolveActiveDraftSpaceId(
      activeSpaceId !== "all" ? activeSpaceId : defaultSpaceId,
    );
    const defaultCat =
      categories.find((c) => c.type !== "income") || categories[0];
    const defaultWal = wallets[0];
    const now = new Date();

    if (presetId === "notification_reader") {
      saveDraftBatch(
        [
          {
            id: `sim-notif-${Date.now()}`,
            date: format(now, "yyyy-MM-dd"),
            time: format(now, "HH:mm"),
            description: "Kopi Kenangan (QRIS)",
            cleanDescription: "Kopi Kenangan (QRIS)",
            amount: 38500,
            type: "expense",
            walletId: defaultWal?.id || null,
            walletName: defaultWal?.name || "BCA",
            suggestedCategoryId: defaultCat?.id || null,
            suggestedCategoryName:
              defaultCat?.name || (isIndonesian ? "Makanan & Minuman" : "Food & Drink"),
            suggestedCategoryEmoji: defaultCat?.emoji || "Utensils",
            isDuplicate: false,
            selected: true,
            raw: "Pembayaran QRIS sebesar Rp 38.500 di Kopi Kenangan berhasil.",
            confidence: 0.96,
            needsReview: false,
            spaceId: targetSpaceId,
            spaceName: activeSpaceLabel,
          },
        ],
        isIndonesian ? "Notifikasi Bank" : "Bank Notification",
        "notification",
        targetSpaceId,
      );
      showToast(
        isIndonesian
          ? "Simulasi Notifikasi Bank berhasil masuk ke Draft"
          : "Simulated Bank Notification staged to Drafts",
        "info",
        null,
        3000,
      );
    } else {
      saveDraftBatch(
        [
          {
            id: `sim-wallet-${Date.now()}`,
            date: format(now, "yyyy-MM-dd"),
            time: format(now, "HH:mm"),
            description: "Apple Pay • Starbucks",
            cleanDescription: "Apple Pay • Starbucks",
            amount: 55000,
            type: "expense",
            walletId: defaultWal?.id || null,
            walletName: defaultWal?.name || "Apple Pay",
            suggestedCategoryId: defaultCat?.id || null,
            suggestedCategoryName:
              defaultCat?.name || (isIndonesian ? "Makanan & Minuman" : "Food & Drink"),
            suggestedCategoryEmoji: defaultCat?.emoji || "Utensils",
            isDuplicate: false,
            selected: true,
            raw: "Wallet Tap Rp 55.000 Starbucks",
            confidence: 0.95,
            needsReview: false,
            spaceId: targetSpaceId,
            spaceName: activeSpaceLabel,
          },
        ],
        isIndonesian ? "Transaksi Kartu / Dompet" : "Wallet Card Tap",
        "wallet_tap",
        targetSpaceId,
      );
      showToast(
        isIndonesian
          ? "Simulasi Wallet Tap berhasil masuk ke Draft"
          : "Simulated Wallet Tap staged to Drafts",
        "info",
        null,
        3000,
      );
    }
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
        {/* 1. Interactive 4-Tab Icon Pill Switcher (Smart Text removed) */}
        <div
          className="grid grid-cols-4 gap-1 p-1 rounded-2xl border"
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
                <span className="text-[10.5px] font-semibold truncate max-w-full">
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
              <div className="flex items-center gap-2 flex-wrap">
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
            className="w-full h-10.5 rounded-xl font-semibold text-[12.5px] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
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
                    ? "Buka Tab Automasi di Pintasan iOS"
                    : "Open Automation in iOS Shortcuts"}
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

        {/* 3A. Quick Helper & Instant Simulation for Notification Reader & Wallet Tap */}
        {(activePreset.id === "notification_reader" ||
          activePreset.id === "wallet_tap") && (
          <div
            className="rounded-2xl p-3.5 border space-y-2.5 text-left"
            style={{
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              borderColor: "var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4
                  className="text-[12.5px] font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian
                    ? "Opsi Cepat & Uji Coba"
                    : "Quick Fallback & Live Test"}
                </h4>
                <p
                  className="text-[11px] mt-0.5 leading-snug"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {activePreset.id === "notification_reader"
                    ? isIndonesian
                      ? "Cukup hubungkan 'Shortcut Input' ke blok Accrual, atau gunakan aksi 'Open URLs' dengan skema di bawah ini:"
                      : "Simply pass 'Shortcut Input' into the Accrual action, or use 'Open URLs' with the scheme below:"
                    : isIndonesian
                    ? "Cukup hubungkan 'Shortcut Input' ke blok Accrual, atau gunakan aksi 'Open URLs' saat kartu di-tap:"
                    : "Simply pass 'Shortcut Input' into the Accrual action, or use 'Open URLs' when your card is tapped:"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  copySchemeTemplate(
                    activePreset.id === "notification_reader"
                      ? "accrual://notify?text="
                      : "accrual://wallet-tap?text=",
                    `scheme-${activePreset.id}`,
                  )
                }
                className="h-9 px-3 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                style={{
                  background:
                    copiedKey === `scheme-${activePreset.id}`
                      ? isDark
                        ? "#ffffff"
                        : "#09090c"
                      : pillSurface,
                  color:
                    copiedKey === `scheme-${activePreset.id}`
                      ? isDark
                        ? "#09090c"
                        : "#ffffff"
                      : "var(--text-primary)",
                  borderColor: "var(--glass-border)",
                }}
              >
                {copiedKey === `scheme-${activePreset.id}` ? (
                  <>
                    <Check size={12} strokeWidth={2.5} />
                    <span>{isIndonesian ? "URL Tersalin" : "URL Copied"}</span>
                  </>
                ) : (
                  <>
                    <Copy size={11.5} strokeWidth={2} />
                    <span>
                      {isIndonesian ? "Salin URL Skema" : "Copy URL Scheme"}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSimulateAutomation(
                    activePreset.id as "notification_reader" | "wallet_tap",
                  )
                }
                className="h-9 px-3 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                style={{
                  background: pillSurface,
                  color: "var(--text-primary)",
                  borderColor: "var(--glass-border)",
                }}
              >
                <Play size={11.5} strokeWidth={2.2} />
                <span>
                  {isIndonesian ? "Uji Coba ke Draft" : "Test to Draft"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 3B. Interactive Ready Copy-Paste Boxes ONLY for Dialog Glass */}
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
                    className="text-[10.5px] leading-snug font-medium whitespace-pre-wrap max-h-24 overflow-y-auto no-scrollbar py-1 px-1.5 rounded-lg border"
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
                    className="text-[10.5px] leading-snug font-medium whitespace-pre-wrap max-h-24 overflow-y-auto no-scrollbar py-1 px-1.5 rounded-lg border"
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

        {/* 4. Collapsible / Interactive Setup Steps Accordion */}
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
