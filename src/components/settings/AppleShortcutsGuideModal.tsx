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
  subtitleId?: string;
  subtitleEn?: string;
  isNativeIntent?: boolean;
}

export interface StepItem {
  number: number;
  titleId: string;
  titleEn: string;
  bodyId: string;
  bodyEn: string;
  primaryButton?: {
    labelId: string;
    labelEn: string;
    action: "install_or_open" | "open_shortcuts";
  };
  showCopyLists?: boolean;
}

export interface ShortcutPreset {
  id: PresetId;
  icon: typeof ScanLine;
  tabLabelId: string;
  tabLabelEn: string;
  titleId: string;
  titleEn: string;
  categoryBadgeId: string;
  categoryBadgeEn: string;
  summaryId: string;
  summaryEn: string;
  icloudUrl: string;
  directScheme: string;
  hasICloudLink: boolean;
  isPersonalAutomation: boolean;
  nativeActionSummaryId: string;
  nativeActionSummaryEn: string;
  metadata: {
    siriPhraseId: string;
    siriPhraseEn: string;
    watchSupported: boolean;
    lockScreenSupported: boolean;
    hardwareBindingId: string;
    hardwareBindingEn: string;
  };
  actions: ShortcutActionNode[];
  steps: StepItem[];
  hardwareGuide: {
    titleId: string;
    titleEn: string;
    stepsId: string[];
    stepsEn: string[];
  };
}

export const GLASS_DIALOG_ACTIONS: ShortcutActionNode[] = [
  {
    id: "act-g1",
    type: "standard",
    icon: Smartphone,
    titleId: "Ask for Number (Nominal)",
    titleEn: "Ask for Number (Amount)",
  },
  {
    id: "act-g2",
    type: "standard",
    icon: ListFilter,
    titleId: "Text › Split by New Lines › Choose from Split Text (Kategori)",
    titleEn: "Text › Split by New Lines › Choose from Split Text (Category)",
  },
  {
    id: "act-g3",
    type: "standard",
    icon: CreditCard,
    titleId: "Text › Split by New Lines › Choose from Split Text (Akun/Wallet)",
    titleEn: "Text › Split by New Lines › Choose from Split Text (Account/Wallet)",
  },
  {
    id: "act-g4",
    type: "standard",
    icon: Smartphone,
    titleId: "Ask for Date and Time (Tanggal & Waktu)",
    titleEn: "Ask for Date and Time",
  },
  {
    id: "act-g5",
    type: "standard",
    icon: FileText,
    titleId: "Ask for Text (Catatan Opsional)",
    titleEn: "Ask for Text (Optional Note)",
  },
  {
    id: "act-g6",
    type: "standard",
    icon: Sparkles,
    titleId: "Log [Amount] for [Category] from [Account] on [Date] with note [Note]",
    titleEn: "Log [Amount] for [Category] from [Account] on [Date] with note [Note]",
    isNativeIntent: true,
  },
];

export const SHORTCUT_PRESETS: ShortcutPreset[] = [
  // 1. SCREEN SCANNER (Official iCloud Link #1)
  {
    id: "screen_scan",
    icon: ScanLine,
    tabLabelId: "Screen Scanner",
    tabLabelEn: "Screen Scanner",
    titleId: "Screen Scanner",
    titleEn: "Screen Scanner",
    categoryBadgeId: " Pintasan Siap Pakai",
    categoryBadgeEn: "Ready-to-Add Shortcut",
    summaryId:
      "Pindai bukti transfer atau mutasi di layar dengan Back Tap 2x tanpa mengotori Galeri Foto. Otomatis masuk ke Draft pada Space Aktif.",
    summaryEn:
      "Scan transfer receipts or mutation screens via Double Back Tap without saving screenshots to your Photo Gallery. Queued straight to Active Space Drafts.",
    icloudUrl: "",
    directScheme: "accrual://scan-screen?text=[Teks dari Gambar]&draft=true",
    hasICloudLink: true,
    isPersonalAutomation: false,
    nativeActionSummaryId: "Scan payment from [Extracted Text]",
    nativeActionSummaryEn: "Scan payment from [Extracted Text]",
    metadata: {
      siriPhraseId: "Screen Scanner",
      siriPhraseEn: "Screen Scanner",
      watchSupported: false,
      lockScreenSupported: true,
      hardwareBindingId: "Back Tap / Action Button",
      hardwareBindingEn: "Back Tap / Action Button",
    },
    actions: [
      {
        id: "act-s1",
        type: "standard",
        icon: ScanLine,
        titleId: "Take screenshot",
        titleEn: "Take screenshot",
      },
      {
        id: "act-s2",
        type: "standard",
        icon: FileText,
        titleId: "Extract Text from Screenshot",
        titleEn: "Extract Text from Screenshot",
      },
      {
        id: "act-s3",
        type: "standard",
        icon: Sparkles,
        titleId: "Scan payment from [Extracted Text]",
        titleEn: "Scan payment from [Extracted Text]",
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Tambahkan Pintasan Screen Scanner",
        titleEn: "Add Screen Scanner Shortcut",
        bodyId:
          "Ketuk tombol di bawah untuk menambahkan pintasan resmi Screen Scanner ke aplikasi Pintasan iOS Anda.",
        bodyEn:
          "Tap the button below to add the official Screen Scanner shortcut to your iOS Shortcuts app.",
        primaryButton: {
          labelId: "Tambah Pintasan",
          labelEn: "Add Shortcut",
          action: "install_or_open",
        },
      },
      {
        number: 2,
        titleId: "Hubungkan ke Ketuk Belakang (Back Tap)",
        titleEn: "Bind to Back Tap",
        bodyId:
          "Buka Pengaturan iPhone › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › Ketuk Dua Kali, lalu pilih Screen Scanner.",
        bodyEn:
          "Open iPhone Settings › Accessibility › Touch › Back Tap › Double Tap, then select Screen Scanner.",
      },
      {
        number: 3,
        titleId: "Ketuk 2x Saat Melihat Struk",
        titleEn: "Double-Tap on Any Receipt",
        bodyId:
          "Ketuk 2x bodi belakang iPhone saat melihat bukti transfer. Teks otomatis masuk ke Draft Space Aktif tanpa meninggalkan foto di galeri.",
        bodyEn:
          "Double-tap the back of your iPhone while viewing a receipt. It queues into your Active Space Drafts without saving photos to your gallery.",
      },
    ],
    hardwareGuide: {
      titleId: "Ketuk Bagian Belakang",
      titleEn: "Back Tap",
      stepsId: [],
      stepsEn: [],
    },
  },

  // 2. DIALOG GLASS (Official iCloud Link #2 + Custom User Category & Wallet Paste)
  {
    id: "glass_dialog",
    icon: Sparkles,
    tabLabelId: "Dialog Glass",
    tabLabelEn: "Dialog Glass",
    titleId: "Dialog Glass",
    titleEn: "Dialog Glass",
    categoryBadgeId: "Pintasan Siap Pakai",
    categoryBadgeEn: "Ready-to-Add Shortcut",
    summaryId:
      "Input cepat lewat Back Tap: isi Nominal › pilih Kategori › pilih Akun/Wallet › pilih Tanggal & Waktu › isi Catatan. Langsung masuk ke Draft Space Aktif.",
    summaryEn:
      "Quick input via Back Tap: enter Amount › pick Category › pick Account/Wallet › select Date & Time › add Note. Saved straight to Active Space Drafts.",
    icloudUrl: "",
    directScheme:
      "accrual://glass-dialog?amount=[Nominal]&category=[Kategori]&wallet=[Akun]&datetime=[Tanggal]&note=[Catatan]&draft=true",
    hasICloudLink: true,
    isPersonalAutomation: false,
    nativeActionSummaryId:
      "Log [Amount] for [Category] from [Account / Wallet] on [Date & Time] with note [Note]",
    nativeActionSummaryEn:
      "Log [Amount] for [Category] from [Account / Wallet] on [Date & Time] with note [Note]",
    metadata: {
      siriPhraseId: "Dialog Glass",
      siriPhraseEn: "Dialog Glass",
      watchSupported: true,
      lockScreenSupported: true,
      hardwareBindingId: "Back Tap",
      hardwareBindingEn: "Back Tap",
    },
    actions: GLASS_DIALOG_ACTIONS,
    steps: [
      {
        number: 1,
        titleId: "Tambahkan Pintasan Dialog Glass",
        titleEn: "Add Dialog Glass Shortcut",
        bodyId:
          "Ketuk tombol di bawah untuk menambahkan template pintasan Dialog Glass ke aplikasi Pintasan iOS Anda.",
        bodyEn:
          "Tap the button below to add the Dialog Glass shortcut template to your iOS Shortcuts app.",
        primaryButton: {
          labelId: "Tambah Pintasan",
          labelEn: "Add Shortcut",
          action: "install_or_open",
        },
      },
      {
        number: 2,
        titleId: "Tempel Daftar Kategori & Akun Milik Anda",
        titleEn: "Paste Your Own Categories & Accounts",
        bodyId:
          "Karena setiap pengguna memiliki Kategori dan Akun/Wallet yang berbeda, buka pintasan Dialog Glass (ketuk ikon •••), lalu salin dan tempel daftar di bawah ini ke kotak Text ke-1 (Kategori) dan kotak Text ke-2 (Akun/Wallet):",
        bodyEn:
          "Because every user has different Categories and Accounts/Wallets, edit the Dialog Glass shortcut (tap •••), then copy and paste the vertical lists below into the 1st Text box (Categories) and 2nd Text box (Accounts/Wallets):",
        showCopyLists: true,
      },
      {
        number: 3,
        titleId: "Hubungkan ke Back Tap / Action Button",
        titleEn: "Bind to Back Tap / Action Button",
        bodyId:
          "Pasang Dialog Glass pada Pengaturan › Aksesibilitas › Sentuh › Ketuk Bagian Belakang (Ketuk 2x atau 3x) untuk mencatat transaksi dari layar mana pun.",
        bodyEn:
          "Bind Dialog Glass in Settings › Accessibility › Touch › Back Tap (Double or Triple Tap) to log transactions from any screen.",
      },
    ],
    hardwareGuide: {
      titleId: "Ketuk Bagian Belakang",
      titleEn: "Back Tap",
      stepsId: [],
      stepsEn: [],
    },
  },

  // 3. NOTIFICATION READER (User Self-Setup in Personal Automation)
  {
    id: "notification_reader",
    icon: Bell,
    tabLabelId: "Notifikasi",
    tabLabelEn: "Notifications",
    titleId: "Log Notifikasi Bank",
    titleEn: "Bank Notification Logger",
    categoryBadgeId: "Automasi Pribadi",
    categoryBadgeEn: "Personal Automation",
    summaryId:
      "Otomatis menangkap notifikasi transaksi m-Banking & e-Wallet ke Draft Space Aktif, sekaligus memblokir notifikasi promo, diskon, voucher, dan OTP.",
    summaryEn:
      "Automatically captures m-Banking and e-Wallet notifications into Active Space Drafts while filtering out promos, vouchers, and OTPs.",
    icloudUrl: "",
    directScheme:
      "accrual://notify?text=[Teks]&title=[Judul]&subtitle=[Subjudul]&app=[Aplikasi]&at=[Tanggal]&draft=true",
    hasICloudLink: false,
    isPersonalAutomation: true,
    nativeActionSummaryId:
      "Log notification [Body] titled [Title] subtitled [Subtitle] from [App] at [Received At]",
    nativeActionSummaryEn:
      "Log notification [Body] titled [Title] subtitled [Subtitle] from [App] at [Received At]",
    metadata: {
      siriPhraseId: "Otomatis saat notifikasi masuk",
      siriPhraseEn: "Runs on notification",
      watchSupported: false,
      lockScreenSupported: true,
      hardwareBindingId: "Tab Automasi Pintasan",
      hardwareBindingEn: "Shortcuts Automation Tab",
    },
    actions: [
      {
        id: "act-n1",
        type: "standard",
        icon: Bell,
        titleId: "When I Receive Notification ( Aplikasi Bank / E-Wallet )",
        titleEn: "When I Receive Notification ( Bank / E-Wallet Apps )",
      },
      {
        id: "act-n2",
        type: "standard",
        icon: ShieldCheck,
        titleId:
          "Log notification [Body] titled [Title] subtitled [Subtitle] from [App] at [Received At]",
        titleEn:
          "Log notification [Body] titled [Title] subtitled [Subtitle] from [App] at [Received At]",
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Buat Automasi Pribadi Baru",
        titleEn: "Create New Personal Automation",
        bodyId:
          "Buka aplikasi Pintasan iOS › masuk ke tab Automasi di bawah › ketuk (+), lalu pilih 'Saat Saya Menerima Pemberitahuan' (When I Receive Notification).",
        bodyEn:
          "Open iOS Shortcuts › go to the Automation tab › tap (+), then select 'When I Receive Notification'.",
        primaryButton: {
          labelId: "Buka Pintasan",
          labelEn: "Open Shortcuts",
          action: "open_shortcuts",
        },
      },
      {
        number: 2,
        titleId: "Pilih Aplikasi Bank & Jalankan Segera",
        titleEn: "Select Bank Apps & Run Immediately",
        bodyId:
          "Pilih aplikasi bank/e-wallet Anda (BCA, Livin', BRImo, BNI, SeaBank, Jago, GoPay, DANA, OVO, ShopeePay) dan pilih 'Jalankan Segera' (Run Immediately).",
        bodyEn:
          "Select your bank/e-wallet apps (BCA, Livin', BRImo, SeaBank, Jago, GoPay, DANA, OVO, ShopeePay) and set to 'Run Immediately'.",
      },
      {
        number: 3,
        titleId: "Tambahkan Aksi Accrual 'Log Notification Transaction'",
        titleEn: "Add Accrual 'Log Notification Transaction' Action",
        bodyId:
          "Pilih Buat Pintasan Kosong Baru › cari aplikasi Accrual › pilih 'Log Notification Transaction', lalu isi parameter dengan variabel notifikasi yang sesuai.",
        bodyEn:
          "Tap Create New Blank Shortcut › search for Accrual › select 'Log Notification Transaction' and map the notification variables.",
      },
    ],
    hardwareGuide: {
      titleId: "Automasi Pribadi",
      titleEn: "Personal Automation",
      stepsId: [],
      stepsEn: [],
    },
  },

  // 4. SMART TEXT (User Self-Setup)
  {
    id: "smart_text",
    icon: FileText,
    tabLabelId: "Smart Text",
    tabLabelEn: "Smart Text",
    titleId: "Smart Clipboard Text",
    titleEn: "Smart Clipboard Text",
    categoryBadgeId: "Susun Mandiri",
    categoryBadgeEn: "Self-Setup",
    summaryId:
      "Membaca teks mutasi atau pesan transaksi yang baru Anda salin (Copy) di papan klip dan memasukkannya langsung ke Draft Space Aktif.",
    summaryEn:
      "Reads copied transaction text from your clipboard and queues it directly into your Active Space Drafts.",
    icloudUrl: "",
    directScheme: "accrual://smart-text?text=[Papan Klip]&draft=true",
    hasICloudLink: false,
    isPersonalAutomation: false,
    nativeActionSummaryId: "Log text [Clipboard] to Accrual Draft",
    nativeActionSummaryEn: "Log text [Clipboard] to Accrual Draft",
    metadata: {
      siriPhraseId: "Smart Text",
      siriPhraseEn: "Smart Text",
      watchSupported: false,
      lockScreenSupported: true,
      hardwareBindingId: "Pintasan iOS",
      hardwareBindingEn: "iOS Shortcuts",
    },
    actions: [
      {
        id: "act-st1",
        type: "standard",
        icon: Copy,
        titleId: "Get Clipboard (Dapatkan Papan Klip)",
        titleEn: "Get Clipboard",
      },
      {
        id: "act-st2",
        type: "standard",
        icon: Sparkles,
        titleId: "Log text [Clipboard] to Accrual Draft",
        titleEn: "Log text [Clipboard] to Accrual Draft",
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Buat Pintasan Baru di Aplikasi Pintasan",
        titleEn: "Create New Shortcut in Shortcuts App",
        bodyId:
          "Buka aplikasi Pintasan iOS, lalu ketuk tombol (+) di kanan atas untuk membuat pintasan baru.",
        bodyEn:
          "Open the iOS Shortcuts app and tap (+) in the top right to create a new shortcut.",
        primaryButton: {
          labelId: "Buka Pintasan",
          labelEn: "Open Shortcuts",
          action: "open_shortcuts",
        },
      },
      {
        number: 2,
        titleId: "Tambahkan 'Get Clipboard'",
        titleEn: "Add 'Get Clipboard'",
        bodyId:
          "Cari dan tambahkan aksi bawaan iOS 'Dapatkan Papan Klip' (Get Clipboard) pada urutan pertama.",
        bodyEn:
          "Search for and add the built-in 'Get Clipboard' action as the first step.",
      },
      {
        number: 3,
        titleId: "Tambahkan Aksi Accrual 'Log Smart Text Transaction'",
        titleEn: "Add Accrual 'Log Smart Text Transaction'",
        bodyId:
          "Cari aplikasi Accrual, pilih 'Log Smart Text Transaction', lalu masukkan variabel [Clipboard] ke kolom teks.",
        bodyEn:
          "Search for Accrual, select 'Log Smart Text Transaction', and pass [Clipboard] into the text field.",
      },
    ],
    hardwareGuide: {
      titleId: "Papan Klip Pintar",
      titleEn: "Smart Clipboard",
      stepsId: [],
      stepsEn: [],
    },
  },

  // 5. WALLET TAP (User Self-Setup in Personal Automation)
  {
    id: "wallet_tap",
    icon: CreditCard,
    tabLabelId: "Wallet Tap",
    tabLabelEn: "Wallet Tap",
    titleId: "Wallet & NFC Card Tap",
    titleEn: "Wallet & NFC Card Tap",
    categoryBadgeId: "Automasi Pribadi",
    categoryBadgeEn: "Personal Automation",
    summaryId:
      "Otomatis mencatat pembayaran saat Anda tap kartu Apple Pay / Wallet atau tag NFC ke dalam Draft Space Aktif.",
    summaryEn:
      "Automatically logs payments when you tap an Apple Pay / Wallet card or NFC tag into Active Space Drafts.",
    icloudUrl: "",
    directScheme:
      "accrual://wallet-tap?amount=[Jumlah]&merchant=[Merchant]&wallet=[Kartu]&datetime=[Tanggal]&draft=true",
    hasICloudLink: false,
    isPersonalAutomation: true,
    nativeActionSummaryId: "Log card transaction [Amount] at [Merchant] ([Card])",
    nativeActionSummaryEn: "Log card transaction [Amount] at [Merchant] ([Card])",
    metadata: {
      siriPhraseId: "Otomatis saat tap kartu",
      siriPhraseEn: "Runs on Card Tap",
      watchSupported: false,
      lockScreenSupported: true,
      hardwareBindingId: "Tab Automasi Pintasan",
      hardwareBindingEn: "Shortcuts Automation Tab",
    },
    actions: [
      {
        id: "act-w1",
        type: "standard",
        icon: CreditCard,
        titleId: "When I Tap Wallet Card / NFC (Transaksi)",
        titleEn: "When I Tap Wallet Card / NFC (Transaction)",
      },
      {
        id: "act-w2",
        type: "standard",
        icon: Sparkles,
        titleId: "Log card transaction [Amount] at [Merchant] ([Card])",
        titleEn: "Log card transaction [Amount] at [Merchant] ([Card])",
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Buka Tab Automasi di Pintasan iOS",
        titleEn: "Open Automation Tab in iOS Shortcuts",
        bodyId:
          "Buka aplikasi Pintasan iOS › tab Automasi › ketuk (+), lalu pilih pemicu 'Transaksi' (Transaction) atau 'NFC'.",
        bodyEn:
          "Open iOS Shortcuts › Automation tab › tap (+), then choose the 'Transaction' or 'NFC' trigger.",
        primaryButton: {
          labelId: "Buka Pintasan",
          labelEn: "Open Shortcuts",
          action: "open_shortcuts",
        },
      },
      {
        number: 2,
        titleId: "Tambahkan Aksi Accrual 'Log Card Transaction'",
        titleEn: "Add Accrual 'Log Card Transaction' Action",
        bodyId:
          "Pilih Buat Pintasan Kosong Baru › cari Accrual › pilih 'Log Card Transaction', lalu petakan Amount, Merchant, dan Card.",
        bodyEn:
          "Select Create New Blank Shortcut › search for Accrual › choose 'Log Card Transaction', and map Amount, Merchant, and Card.",
      },
    ],
    hardwareGuide: {
      titleId: "Automasi Kartu",
      titleEn: "Card Automation",
      stepsId: [],
      stepsEn: [],
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
  const [customLinks, setCustomLinks] = useState<Record<string, string>>(() =>
    getSavedICloudLinks(),
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedId(mapInitialTab(initialTab));
      setCustomLinks(getSavedICloudLinks());
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
      ? "Makanan & Minuman\nBensin\nTransportasi\nBelanja\nTagihan"
      : "Food\nFuel\nTransport\nShopping\nBills";
  }, [categories, isIndonesian]);

  const userWalletLines = useMemo(() => {
    const names = Array.from(
      new Set(wallets.map((w) => w.name.trim()).filter(Boolean)),
    );
    if (names.length > 0) return names.join("\n");
    return isIndonesian ? "BCA\nMandiri\nGoPay\nTunai" : "BCA\nMandiri\nGoPay\nCash";
  }, [wallets, isIndonesian]);

  const configManifest = getShortcutsConfig();
  const manifestLink =
    activePreset.id === "screen_scan"
      ? configManifest.shortcuts.screen_scan?.icloud_url
      : activePreset.id === "glass_dialog"
      ? configManifest.shortcuts.glass_dialog?.icloud_url
      : "";

  const effectiveICloudUrl =
    customLinks[activePreset.id] ||
    (isValidICloudLink(manifestLink) ? manifestLink : "") ||
    (isValidICloudLink(activePreset.icloudUrl) ? activePreset.icloudUrl : "");

  const handleSelectPreset = (id: PresetId) => {
    triggerHaptic("light");
    setSelectedId(id);
  };

  const openShortcutsApp = () => {
    triggerHaptic("medium");
    window.location.href = "shortcuts://";
  };

  const handlePrimaryStepAction = (
    actionType: "install_or_open" | "open_shortcuts",
  ) => {
    if (actionType === "open_shortcuts" || !activePreset.hasICloudLink) {
      openShortcutsApp();
      return;
    }
    if (effectiveICloudUrl) {
      triggerSuccessHaptic();
      window.open(effectiveICloudUrl, "_blank", "noopener,noreferrer");
      return;
    }
    openShortcutsApp();
  };

  const copyCategoryList = () => {
    triggerSuccessHaptic();
    navigator.clipboard.writeText(userCategoryLines);
    setCopiedKey("categories-list");
    showToast(
      isIndonesian
        ? "Daftar kategori berhasil disalin"
        : "Category list copied",
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
      isIndonesian
        ? "Daftar akun/wallet berhasil disalin"
        : "Account/wallet list copied",
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
      title={isIndonesian ? "Pintasan & Otomatisasi" : "Shortcuts & Automations"}
    >
      <div
        className="flex flex-col gap-3.5 px-4 pt-1 select-none"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
        }}
      >
        {/* 1. Minimalist Segmented Switcher */}
        <div
          className="flex items-center gap-1 p-1 rounded-2xl border overflow-x-auto no-scrollbar scroll-smooth"
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? isDark
                      ? "bg-white/[0.1] text-white border border-white/15"
                      : "bg-black/[0.08] text-black border border-black/10"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-transparent"
                }`}
              >
                <TabIcon size={13} strokeWidth={isSelected ? 2 : 1.7} />
                <span>{isIndonesian ? preset.tabLabelId : preset.tabLabelEn}</span>
              </button>
            );
          })}
        </div>

        {/* 2. Compact Overview & Native Action Preview Card */}
        <div
          className="rounded-2xl p-3.5 border space-y-2.5 text-left"
          style={{
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-[14px] font-bold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? activePreset.titleId : activePreset.titleEn}
              </span>
            </div>
            <span
              className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0"
              style={{
                background: pillSurface,
                borderColor: "var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              Draft • {activeSpaceLabel}
            </span>
          </div>

          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {isIndonesian ? activePreset.summaryId : activePreset.summaryEn}
          </p>

          {/* Compact Visual Flow List */}
          <div
            className="rounded-xl p-2.5 border space-y-1.5"
            style={{
              background: isDark ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.7)",
              borderColor: "var(--glass-border)",
            }}
          >
            {activePreset.actions.map((act, idx) => {
              const ActIcon = act.icon;
              return (
                <div key={act.id} className="flex items-center gap-2 text-[11.5px]">
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold border"
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
                      <ActIcon size={11.5} strokeWidth={2.2} />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span
                    className={`truncate ${
                      act.isNativeIntent ? "font-semibold" : "font-medium"
                    }`}
                    style={{
                      color: act.isNativeIntent
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {isIndonesian ? act.titleId : act.titleEn}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Minimalist Step-by-Step Card */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            background: isDark ? "rgba(18, 18, 22, 0.85)" : "rgba(255, 255, 255, 0.94)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div
            className="px-3.5 py-2.5 border-b flex items-center justify-between"
            style={{ borderColor: "var(--glass-border)" }}
          >
            <span
              className="text-[12px] font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Cara Pasang" : "How to Setup"}
            </span>
            <span
              className="text-[10.5px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {activePreset.steps.length} {isIndonesian ? "langkah" : "steps"}
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
            {activePreset.steps.map((step) => (
              <div
                key={step.number}
                className="p-3.5 flex items-start gap-3 text-left"
                style={{ borderColor: "var(--glass-border)" }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5"
                  style={{
                    background: pillSurface,
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {step.number}
                </div>

                <div className="min-w-0 flex-1 space-y-2.5">
                  <div>
                    <h4
                      className="text-[13px] font-semibold leading-snug"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian ? step.titleId : step.titleEn}
                    </h4>
                    <p
                      className="text-[11.5px] leading-relaxed mt-0.5"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {isIndonesian ? step.bodyId : step.bodyEn}
                    </p>
                  </div>

                  {step.primaryButton && (
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          handlePrimaryStepAction(step.primaryButton!.action)
                        }
                        className="h-8.5 px-4 rounded-full font-semibold text-[11.5px] inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                        style={{
                          background: isDark ? "#ffffff" : "#09090c",
                          color: isDark ? "#09090c" : "#ffffff",
                        }}
                      >
                        <ExternalLink size={12.5} strokeWidth={2.2} />
                        <span>
                          {isIndonesian
                            ? step.primaryButton.labelId
                            : step.primaryButton.labelEn}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Vertical Ready Copy-Paste Boxes for User's Categories & Accounts/Wallets */}
                  {step.showCopyLists && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {/* Box 1: User Categories */}
                      <div
                        className="rounded-xl p-2.5 border flex flex-col justify-between gap-2"
                        style={{
                          background: isDark
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(0,0,0,0.025)",
                          borderColor: "var(--glass-border)",
                        }}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="text-[10.5px] font-bold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {isIndonesian ? "1. Text Kategori" : "1. Category Text"}
                            </span>
                          </div>
                          <pre
                            className="text-[10.5px] leading-snug font-mono whitespace-pre-wrap max-h-24 overflow-y-auto no-scrollbar py-1 px-1.5 rounded-lg border"
                            style={{
                              background: isDark
                                ? "rgba(0,0,0,0.35)"
                                : "rgba(255,255,255,0.8)",
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
                          className="w-full h-7.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                          style={{
                            background: pillSurface,
                            borderColor: "var(--glass-border)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {copiedKey === "categories-list" ? (
                            <>
                              <Check size={12} strokeWidth={2.3} />
                              <span>{isIndonesian ? "Tersalin" : "Copied"}</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11.5} strokeWidth={1.9} />
                              <span>
                                {isIndonesian ? "Salin Kategori" : "Copy Categories"}
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Box 2: User Accounts / Wallets */}
                      <div
                        className="rounded-xl p-2.5 border flex flex-col justify-between gap-2"
                        style={{
                          background: isDark
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(0,0,0,0.025)",
                          borderColor: "var(--glass-border)",
                        }}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="text-[10.5px] font-bold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {isIndonesian ? "2. Text Akun" : "2. Account Text"}
                            </span>
                          </div>
                          <pre
                            className="text-[10.5px] leading-snug font-mono whitespace-pre-wrap max-h-24 overflow-y-auto no-scrollbar py-1 px-1.5 rounded-lg border"
                            style={{
                              background: isDark
                                ? "rgba(0,0,0,0.35)"
                                : "rgba(255,255,255,0.8)",
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
                          className="w-full h-7.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                          style={{
                            background: pillSurface,
                            borderColor: "var(--glass-border)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {copiedKey === "wallets-list" ? (
                            <>
                              <Check size={12} strokeWidth={2.3} />
                              <span>{isIndonesian ? "Tersalin" : "Copied"}</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11.5} strokeWidth={1.9} />
                              <span>
                                {isIndonesian ? "Salin Akun" : "Copy Accounts"}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Clean Done Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-2xl flex items-center justify-center font-semibold text-[13.5px] cursor-pointer active:scale-[0.98] transition-all"
          style={{
            background: isDark ? "#ffffff" : "#09090c",
            color: isDark ? "#09090c" : "#ffffff",
          }}
        >
          {isIndonesian ? "Selesai" : "Done"}
        </button>
      </div>
    </BottomSheet>
  );
}
