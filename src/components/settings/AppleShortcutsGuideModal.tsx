import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Smartphone,
  Bell,
  ScanLine,
  Play,
  ListFilter,
  CreditCard,
  FileText,
  ShieldCheck,
  Link2,
  Layers,
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
  ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY,
} from "../../lib/shortcutsConfig";
import { saveDraftBatch, resolveActiveDraftSpaceId } from "../../lib/draftTransactionService";
import { showNativeLocalNotification, formatNotificationCurrency } from "../../lib/notifications";
import { format } from "date-fns";

export { isValidICloudLink, getSavedICloudLinks, saveICloudLink, ACCRUAL_SHORTCUT_ICLOUD_LINKS_KEY };

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
  | "notification_reader"
  | "glass_dialog"
  | "wallet_tap"
  | "smart_text"
  | "voice_entry"
  | "receipt_scan";

function mapInitialTab(t?: TabType): PresetId {
  if (t === "notification_reader" || t === "automation") return "notification_reader";
  if (t === "glass_dialog") return "glass_dialog";
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
  showCopyScheme?: boolean;
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
  isPersonalAutomation: boolean;
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
    titleId: "Minta Masukan Nominal",
    titleEn: "Ask for Input (Amount)",
    subtitleId: "Tipe: Angka • Pertanyaan: 'Berapa nominal transaksi?'",
    subtitleEn: "Type: Number • Prompt: 'What is the amount?'",
  },
  {
    id: "act-g2",
    type: "standard",
    icon: ListFilter,
    titleId: "Pilih Kategori Transaksi",
    titleEn: "Choose Category from List",
    subtitleId: "Daftar kategori pengeluaran Anda (Makanan, Transportasi, Belanja, dll.)",
    subtitleEn: "Your expense categories list (Food, Transport, Shopping, etc.)",
  },
  {
    id: "act-g3",
    type: "standard",
    icon: CreditCard,
    titleId: "Pilih Akun atau Dompet",
    titleEn: "Choose Account or Wallet",
    subtitleId: "Daftar akun & dompet Anda (BCA, Mandiri, GoPay, Tunai, dll.)",
    subtitleEn: "Your bank & wallet accounts list (BCA, Mandiri, GoPay, Cash, etc.)",
  },
  {
    id: "act-g4",
    type: "standard",
    icon: Smartphone,
    titleId: "Pilih Tanggal dan Waktu",
    titleEn: "Ask for Date and Time",
    subtitleId: "Tipe: Tanggal & Waktu • Standar: Tanggal & jam saat ini",
    subtitleEn: "Type: Date & Time • Default: Current date and time",
  },
  {
    id: "act-g5",
    type: "standard",
    icon: FileText,
    titleId: "Catatan Transaksi (Opsional)",
    titleEn: "Ask for Note (Optional)",
    subtitleId: "Tipe: Teks • Kosongkan jika tidak perlu catatan",
    subtitleEn: "Type: Text • Leave blank if no note is needed",
  },
  {
    id: "act-g6",
    type: "standard",
    icon: Sparkles,
    titleId: "Kirim ke Draft Space Aktif & Notifikasi",
    titleEn: "Queue to Active Space Draft & Notify",
    subtitleId:
      "accrual://glass-dialog?amount=[Nominal]&category=[Kategori]&wallet=[Akun]&datetime=[Tanggal]&note=[Catatan]&draft=true",
    subtitleEn:
      "accrual://glass-dialog?amount=[Amount]&category=[Category]&wallet=[Account]&datetime=[Date]&note=[Note]&draft=true",
    isNativeIntent: true,
  },
];

export const SHORTCUT_PRESETS: ShortcutPreset[] = [
  {
    id: "screen_scan",
    icon: ScanLine,
    tabLabelId: "Pindai Layar",
    tabLabelEn: "Screen Scanner",
    titleId: "Accrual Screen Scanner",
    titleEn: "Accrual Screen Scanner",
    categoryBadgeId: "Tanpa Simpan ke Galeri",
    categoryBadgeEn: "Zero Gallery Clutter",
    summaryId:
      "Pindai layar bukti transfer atau mutasi rekening dengan Ketuk Belakang 2x tanpa mengotori Galeri Foto. Tangkapan layar diekstrak langsung di memori sementara (RAM) dan masuk ke Draft pada Space Aktif.",
    summaryEn:
      "Scan payment receipts or mutation screens via Double Back Tap without cluttering your Photo Gallery. Screen text is extracted directly in volatile RAM and queued into Drafts on your Active Space.",
    icloudUrl: "",
    directScheme: "accrual://scan-screen?text=[Teks dari Gambar]&draft=true",
    isPersonalAutomation: false,
    metadata: {
      siriPhraseId: "Katakan 'Siri, Accrual Screen Scanner' untuk menjalankan",
      siriPhraseEn: "Say 'Siri, Accrual Screen Scanner' to run",
      watchSupported: false,
      lockScreenSupported: true,
      hardwareBindingId: "Ketuk Bagian Belakang / Tombol Tindakan",
      hardwareBindingEn: "Back Tap / Action Button",
    },
    actions: [
      {
        id: "act-s1",
        type: "standard",
        icon: ScanLine,
        titleId: "Ambil Tangkapan Layar (Di Memori RAM)",
        titleEn: "Take Screenshot (In-Memory RAM)",
        subtitleId: "Tidak disimpan ke Album Foto sehingga galeri tetap bersih",
        subtitleEn: "Never saved to Photo Album so your gallery stays clean",
      },
      {
        id: "act-s2",
        type: "standard",
        icon: FileText,
        titleId: "Kutip Teks dari Gambar",
        titleEn: "Extract Text from Image",
        subtitleId: "Membaca nominal, merchant, rekening & waktu via Live Text OCR",
        subtitleEn: "Extracts amount, merchant, account & timestamp via Live Text OCR",
      },
      {
        id: "act-s3",
        type: "standard",
        icon: Sparkles,
        titleId: "Kirim ke Draft Space Aktif Accrual",
        titleEn: "Send to Accrual Active Space Draft",
        subtitleId: "Buka URL accrual://scan-screen?text=[Teks]&draft=true",
        subtitleEn: "Open URL accrual://scan-screen?text=[Text]&draft=true",
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Ketuk Pasang Pintasan",
        titleEn: "Tap Add Shortcut",
        bodyId:
          "Buka tautan pintasan Accrual Screen Scanner, atau buat pintasan 3 tindakan (Ambil Tangkapan Layar › Kutip Teks dari Gambar › Buka URL Skema) tanpa tindakan Simpan ke Album Foto agar hasil jepretan tidak menumpuk di galeri.",
        bodyEn:
          "Open the Accrual Screen Scanner shortcut link, or assemble the 3-action flow (Take Screenshot › Extract Text from Image › Open Scheme URL) without Save to Photo Album so screenshots never pile up in your gallery.",
        primaryButton: {
          labelId: "Pasang",
          labelEn: "Add",
          action: "install_or_open",
        },
        showCopyScheme: true,
      },
      {
        number: 2,
        titleId: "Atur Ketuk Belakang / Tombol Tindakan",
        titleEn: "Setup Back Tap / Action Button",
        bodyId:
          "Untuk Ketuk Belakang: buka Pengaturan › Aksesibilitas › Sentuh › Ketuk Bagian Belakang, pilih Ketuk Dua Kali atau Ketuk Tiga Kali, lalu pilih Accrual Screen Scanner. Untuk Tombol Tindakan: pilih Pintasan, lalu pilih Accrual Screen Scanner.",
        bodyEn:
          "For Back Tap: open Settings › Accessibility › Touch › Back Tap, choose Double Tap or Triple Tap, then pick Accrual Screen Scanner. For the Action Button: choose Shortcut, then pick Accrual Screen Scanner.",
      },
      {
        number: 3,
        titleId: "Gunakan di Mana Saja ke Space Aktif",
        titleEn: "Use Anywhere into Active Space",
        bodyId:
          "Gunakan saat layar menampilkan struk transfer atau riwayat mutasi. Accrual membaca layar Anda, memasukkannya ke Draft pada Space Aktif saat ini, dan mengirimkan notifikasi.",
        bodyEn:
          "Trigger it while viewing any transfer receipt or transaction history. Accrual reads your screen, stages the record into Drafts on your Active Space, and sends a confirmation notification.",
      },
    ],
    hardwareGuide: {
      titleId: "Cara Memasang ke Ketuk Bagian Belakang",
      titleEn: "How to Bind to Back Tap",
      stepsId: [
        "Pasang pintasan Accrual Screen Scanner di aplikasi Pintasan iOS.",
        "Buka Pengaturan › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › Ketuk Dua Kali.",
        "Ketuk 2x bodi belakang iPhone saat melihat bukti transfer untuk mengirimnya ke Draft Space Aktif.",
      ],
      stepsEn: [
        "Install the Accrual Screen Scanner shortcut in iOS Shortcuts.",
        "Open Settings › Accessibility › Touch › Back Tap › Double Tap.",
        "Double-tap the back of your iPhone while viewing any receipt to queue it into your Active Space Drafts.",
      ],
    },
  },
  {
    id: "notification_reader",
    icon: Bell,
    tabLabelId: "Notifikasi Bank",
    tabLabelEn: "Notification Reader",
    titleId: "Smart Notification Reader",
    titleEn: "Smart Notification Reader",
    categoryBadgeId: "Filter Anti-Promo Cerdas",
    categoryBadgeEn: "Smart Anti-Promo Shield",
    summaryId:
      "Mencatat notifikasi transaksi dari m-Banking & e-Wallet secara otomatis ke Draft Space Aktif, sekaligus mengenali dan membuang notifikasi promosi, diskon, voucher, cashback, maupun kode OTP.",
    summaryEn:
      "Automatically logs m-Banking and e-Wallet transaction notifications into your Active Space Drafts while intelligently filtering out promos, discounts, vouchers, cashback offers, and OTP codes.",
    icloudUrl: "",
    directScheme:
      "accrual://notify?text=[Teks]&title=[Judul]&subtitle=[Subjudul]&app=[Aplikasi]&at=[Tanggal]&draft=true",
    isPersonalAutomation: true,
    metadata: {
      siriPhraseId: "Berjalan otomatis saat notifikasi bank masuk",
      siriPhraseEn: "Runs automatically when a bank notification arrives",
      watchSupported: false,
      lockScreenSupported: true,
      hardwareBindingId: "Automasi Pribadi Pintasan iOS",
      hardwareBindingEn: "iOS Shortcuts Personal Automation",
    },
    actions: [
      {
        id: "act-n1",
        type: "standard",
        icon: Bell,
        titleId: "Saat Menerima Pemberitahuan dari Aplikasi Bank",
        titleEn: "When I Receive Notification from Bank Apps",
        subtitleId: "Pemicu Automasi Pribadi iOS • Jalankan Segera",
        subtitleEn: "iOS Personal Automation Trigger • Run Immediately",
      },
      {
        id: "act-n2",
        type: "standard",
        icon: ShieldCheck,
        titleId: "Log Notification Transaction ke Accrual",
        titleEn: "Log Notification Transaction to Accrual",
        subtitleId:
          "Petakan Teks, Judul, Subjudul, Aplikasi Sumber & Waktu • Otomatis Blokir Promo & OTP",
        subtitleEn:
          "Maps Text, Title, Subtitle, Source App & Received At • Auto-Blocks Promos & OTPs",
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Pilih Automasi",
        titleEn: "Choose Automation",
        bodyId:
          "Buka aplikasi Pintasan iOS, masuk ke tab Automasi di bagian bawah, lalu ketuk Automasi Baru (+).",
        bodyEn:
          "Open the Shortcuts app, go to the Automation tab, then tap New Automation (+).",
        primaryButton: {
          labelId: "Buka",
          labelEn: "Open",
          action: "open_shortcuts",
        },
      },
      {
        number: 2,
        titleId: "Pilih Saat Menerima Pemberitahuan",
        titleEn: "Choose When I Receive Notification",
        bodyId:
          "Pilih pemicu 'Saat Saya Menerima Pemberitahuan' (When I Receive Notification) dan aktifkan opsi 'Jalankan Segera' (Run Immediately).",
        bodyEn:
          "Choose the 'When I Receive Notification' trigger and set it to 'Run Immediately'.",
      },
      {
        number: 3,
        titleId: "Pilih Aplikasi Sumber Bank & E-Wallet",
        titleEn: "Choose Source Apps",
        bodyId:
          "Pilih aplikasi bank atau dompet digital yang ingin dibaca, seperti BCA mobile, myBCA, Livin' by Mandiri, BRImo, wondr by BNI, SeaBank, Bank Jago, blu, GoPay, DANA, OVO, atau ShopeePay.",
        bodyEn:
          "Pick the bank or e-wallet apps you want to read, such as GoPay, DANA, OVO, BCA, Livin', BRImo, wondr, SeaBank, Jago, or ShopeePay.",
      },
      {
        number: 4,
        titleId: "Tambahkan Tindakan Accrual",
        titleEn: "Add the Accrual Action",
        bodyId:
          "Ketuk Buat Pintasan Kosong Baru, cari 'Accrual' lalu pilih 'Log Notification Transaction', atau tambahkan tindakan 'Buka URL' dan tempelkan skema URL notifikasi di bawah.",
        bodyEn:
          "Tap Create New Blank Shortcut, search for 'Accrual' and choose 'Log Notification Transaction', or add 'Open URLs' and paste the notification scheme below.",
        showCopyScheme: true,
      },
      {
        number: 5,
        titleId: "Petakan Variabel Notifikasi",
        titleEn: "Map Variables",
        bodyId:
          "Atur teks notifikasi ke Notification (Isi), berjudul ke Title (Judul), subjudul ke Subtitle, dari ke App (Aplikasi Sumber), dan pada ke Current Date (Tanggal Saat Ini).",
        bodyEn:
          "Set Log notification to Notification, titled to Title, subtitled to Subtitle, from to App, and at to Current Date.",
      },
      {
        number: 6,
        titleId: "Perisai Anti-Promo & OTP Otomatis",
        titleEn: "Avoid Promo Keywords (Auto-Filtered)",
        bodyId:
          "Jangan gunakan kata promo sebagai pemicu. Accrual secara otomatis mengabaikan draft apabila teks mengandung kata diskon, cashback, voucher, promo, reward, kupon, flash sale, paylater, atau kode OTP.",
        bodyEn:
          "Do not use promo notifications as triggers. Accrual automatically ignores drafts when the text contains diskon, cashback, voucher, promo, reward, kupon, flash sale, paylater, or OTP codes.",
      },
    ],
    hardwareGuide: {
      titleId: "Panduan Automasi Pemberitahuan",
      titleEn: "Notification Automation Setup",
      stepsId: [
        "Buka aplikasi Pintasan iOS › ketuk tab Automasi › ketuk tanda (+).",
        "Pilih 'Saat Saya Menerima Pemberitahuan' dan pilih aplikasi bank/e-wallet Anda.",
        "Pasang tindakan 'Log Notification Transaction' atau skema URL Accrual.",
      ],
      stepsEn: [
        "Open Shortcuts app › tap Automation tab › tap (+).",
        "Select 'When I Receive Notification' and pick your banking/e-wallet apps.",
        "Attach 'Log Notification Transaction' or the Accrual URL scheme.",
      ],
    },
  },
  {
    id: "glass_dialog",
    icon: Sparkles,
    tabLabelId: "Dialog Kaca",
    tabLabelEn: "Glass Dialog",
    titleId: "Accrual Glass Dialog",
    titleEn: "Accrual Glass Dialog",
    categoryBadgeId: "Dialog Ketuk Belakang",
    categoryBadgeEn: "Back Tap Glass Dialog",
    summaryId:
      "Buka dialog kaca interaktif lewat Ketuk Belakang (Back Tap): isi nominal, pilih kategori transaksi, pilih akun, pilih tanggal & waktu, dan catatan opsional. Transaksi langsung masuk ke Draft pada Space Aktif dan memicu notifikasi.",
    summaryEn:
      "Open an interactive glass dialog via Back Tap: enter amount, pick category, pick account, confirm date & time, and optional note. The transaction is queued directly into your Active Space Drafts with a notification.",
    icloudUrl: "",
    directScheme:
      "accrual://glass-dialog?amount=[Nominal]&category=[Kategori]&wallet=[Akun]&datetime=[Tanggal]&note=[Catatan]&draft=true",
    isPersonalAutomation: false,
    metadata: {
      siriPhraseId: "Katakan 'Siri, Accrual Glass Dialog' atau ketuk belakang iPhone",
      siriPhraseEn: "Say 'Siri, Accrual Glass Dialog' or double-tap the back of iPhone",
      watchSupported: true,
      lockScreenSupported: true,
      hardwareBindingId: "Ketuk Bagian Belakang (Ketuk 2x)",
      hardwareBindingEn: "Back Tap (Double Tap)",
    },
    actions: GLASS_DIALOG_ACTIONS,
    steps: [
      {
        number: 1,
        titleId: "Pasang Pintasan Dialog Kaca",
        titleEn: "Add Glass Dialog Shortcut",
        bodyId:
          "Pasang pintasan Accrual Glass Dialog di aplikasi Pintasan iOS atau salin skema URL dialog terstruktur di bawah ini.",
        bodyEn:
          "Install the Accrual Glass Dialog shortcut in the iOS Shortcuts app or copy the structured dialog URL scheme below.",
        primaryButton: {
          labelId: "Pasang",
          labelEn: "Add",
          action: "install_or_open",
        },
        showCopyScheme: true,
      },
      {
        number: 2,
        titleId: "Salin Kategori & Akun Anda (1-Ketuk)",
        titleEn: "Copy Your Categories & Accounts (1-Tap)",
        bodyId:
          "Salin daftar kategori dan akun asli Anda di bawah ini untuk ditempelkan ke tindakan 'Pilih dari Daftar' (Choose from List) di dalam pintasan.",
        bodyEn:
          "Copy your actual categories and accounts below to paste directly into the 'Choose from List' actions inside your shortcut.",
        showCopyLists: true,
      },
      {
        number: 3,
        titleId: "Urutan 5 Masukan Dialog Kaca",
        titleEn: "5-Step Glass Dialog Sequence",
        bodyId:
          "Susunan alur: (1) Minta Masukan Angka (Nominal) › (2) Pilih Kategori Transaksi › (3) Pilih Akun › (4) Minta Tanggal & Waktu (Standar: Tanggal Saat Ini) › (5) Minta Teks Catatan (Opsional) › Buka URL Skema Accrual.",
        bodyEn:
          "Dialog order: (1) Ask for Number (Amount) › (2) Choose Category › (3) Choose Account › (4) Ask for Date & Time (Default: Current Date) › (5) Ask for Note (Optional) › Open Accrual Scheme URL.",
      },
      {
        number: 4,
        titleId: "Tautkan ke Ketuk Bagian Belakang",
        titleEn: "Bind to Back Tap",
        bodyId:
          "Buka Pengaturan › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › Ketuk Dua Kali, lalu pilih Accrual Glass Dialog. Setiap input otomatis masuk ke Draft pada Space Aktif Anda dan memicu notifikasi.",
        bodyEn:
          "Open Settings › Accessibility › Touch › Back Tap › Double Tap, then pick Accrual Glass Dialog. Every entry automatically queues into Drafts on your Active Space and fires a notification.",
      },
    ],
    hardwareGuide: {
      titleId: "Panduan Memasang Dialog Kaca ke Ketuk Belakang",
      titleEn: "How to Bind Glass Dialog to Back Tap",
      stepsId: [
        "Pasang atau susun pintasan 'Accrual Glass Dialog' di aplikasi Pintasan iOS.",
        "Buka Pengaturan › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › Ketuk Dua Kali.",
        "Ketuk 2x bodi belakang iPhone kapan saja untuk mengisi transaksi tunai/cepat ke Draft Space Aktif.",
      ],
      stepsEn: [
        "Install or build 'Accrual Glass Dialog' in the iOS Shortcuts app.",
        "Open Settings › Accessibility › Touch › Back Tap › Double Tap.",
        "Double-tap the back of your iPhone anytime to log cash or quick expenses into Active Space Drafts.",
      ],
    },
  },
  {
    id: "wallet_tap",
    icon: CreditCard,
    tabLabelId: "Tap Kartu",
    tabLabelEn: "Card Tap",
    titleId: "Wallet Card & NFC Tap Logger",
    titleEn: "Wallet Card & NFC Tap Logger",
    categoryBadgeId: "Otomasi Kartu & Apple Pay",
    categoryBadgeEn: "Card & Apple Pay Automation",
    summaryId:
      "Otomatis menangkap nominal, nama merchant, dan kartu setiap kali Anda melakukan pembayaran nirsentuh (Tap Kartu / Apple Pay), lalu memasukkannya ke Draft pada Space Aktif beserta klasifikasi kategori otomatis.",
    summaryEn:
      "Automatically captures the amount, merchant name, and card whenever you make a contactless payment (Wallet Card Tap / Apple Pay), staging it into your Active Space Drafts with automatic category classification.",
    icloudUrl: "",
    directScheme:
      "accrual://wallet-tap?amount=[Jumlah]&merchant=[Merchant]&wallet=[Kartu atau Akun]&datetime=[Tanggal]&draft=true",
    isPersonalAutomation: true,
    metadata: {
      siriPhraseId: "Aktif otomatis saat mengetuk kartu pembayaran",
      siriPhraseEn: "Triggers automatically when tapping a payment card",
      watchSupported: true,
      lockScreenSupported: true,
      hardwareBindingId: "Pemicu Transaksi Kartu iOS",
      hardwareBindingEn: "iOS Transaction Trigger",
    },
    actions: [
      {
        id: "act-w1",
        type: "standard",
        icon: CreditCard,
        titleId: "Saat Saya Mengetuk Kartu Dompet (Transaction)",
        titleEn: "When I Tap a Wallet Card (Transaction)",
        subtitleId: "Mengekstrak Merchant, Jumlah, dan Nama Kartu dari chip NFC",
        subtitleEn: "Extracts Merchant, Amount, and Card Name from the NFC tap",
      },
      {
        id: "act-w2",
        type: "standard",
        icon: Sparkles,
        titleId: "Kirim ke Draft Space Aktif Accrual",
        titleEn: "Queue to Accrual Active Space Draft",
        subtitleId:
          "accrual://wallet-tap?amount=[Amount]&merchant=[Merchant]&wallet=[Card]&draft=true",
        subtitleEn:
          "accrual://wallet-tap?amount=[Amount]&merchant=[Merchant]&wallet=[Card]&draft=true",
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Buka Tab Automasi Pintasan",
        titleEn: "Open Shortcuts Automation Tab",
        bodyId:
          "Buka aplikasi Pintasan iOS, masuk ke tab Automasi, lalu ketuk Automasi Baru (+).",
        bodyEn:
          "Open the Shortcuts app, go to the Automation tab, then tap New Automation (+).",
        primaryButton: {
          labelId: "Buka",
          labelEn: "Open",
          action: "open_shortcuts",
        },
      },
      {
        number: 2,
        titleId: "Pilih Pemicu Transaksi (Transaction)",
        titleEn: "Choose Transaction Trigger",
        bodyId:
          "Pilih pemicu 'Transaksi' (Saat Saya Mengetuk Kartu Dompet), pilih kartu pembayaran Anda, dan aktifkan 'Jalankan Segera'.",
        bodyEn:
          "Select the 'Transaction' (When I Tap a Wallet Card) trigger, choose your payment cards, and enable 'Run Immediately'.",
      },
      {
        number: 3,
        titleId: "Hubungkan Skema URL Kartu Accrual",
        titleEn: "Attach Accrual Card URL Scheme",
        bodyId:
          "Tambahkan tindakan 'Buka URL' dengan skema di bawah. Accrual otomatis mencocokkan nama merchant ke kategori pengeluaran dan menyimpannya di Draft Space Aktif.",
        bodyEn:
          "Add the 'Open URLs' action with the scheme below. Accrual automatically maps the merchant to your expense category and saves it into your Active Space Drafts.",
        showCopyScheme: true,
      },
    ],
    hardwareGuide: {
      titleId: "Panduan Otomasi Tap Kartu",
      titleEn: "Card Tap Automation Guide",
      stepsId: [
        "Buka aplikasi Pintasan › Automasi › pilih pemicu 'Transaksi'.",
        "Tempelkan skema URL Kartu Accrual pada tindakan Buka URL.",
        "Setiap tap pembayaran otomatis tercatat ke Draft pada Space Aktif Anda.",
      ],
      stepsEn: [
        "Open Shortcuts › Automation › select 'Transaction' trigger.",
        "Paste the Accrual Card URL scheme into an Open URLs action.",
        "Every contactless card tap automatically queues into your Active Space Drafts.",
      ],
    },
  },
  {
    id: "smart_text",
    icon: Layers,
    tabLabelId: "Teks & Klip",
    tabLabelEn: "Smart Text",
    titleId: "Smart Clipboard & Multi-Text NLP",
    titleEn: "Smart Clipboard & Multi-Text NLP",
    categoryBadgeId: "Ekstraksi Multi-Transaksi",
    categoryBadgeEn: "Multi-Transaction NLP",
    summaryId:
      "Salin pesan chat WhatsApp berisi daftar pengeluaran (contoh: 'Kopi 25rb, makan siang 50rb, parkir 5rb pakai BCA') atau diktekan kalimat majemuk. Accrual otomatis memecahnya menjadi beberapa draft transaksi sekaligus di Space Aktif tanpa pop-up izin Paste yang mengganggu.",
    summaryEn:
      "Copy a WhatsApp message containing multiple expenses (e.g. 'Coffee 25k, lunch 50k, parking 5k with BCA') or dictate a compound phrase. Accrual decomposes all items simultaneously into your Active Space Drafts without intrusive iOS Paste prompts.",
    icloudUrl: "",
    directScheme: "accrual://smart-text?text=[Isi Papan Klip]&draft=true",
    isPersonalAutomation: false,
    metadata: {
      siriPhraseId: "Katakan 'Siri, Catat Salinan ke Accrual'",
      siriPhraseEn: "Say 'Siri, Log Clipboard to Accrual'",
      watchSupported: true,
      lockScreenSupported: true,
      hardwareBindingId: "Tombol Tindakan / Pusat Kontrol / Bagikan",
      hardwareBindingEn: "Action Button / Control Center / Share Sheet",
    },
    actions: [
      {
        id: "act-t1",
        type: "standard",
        icon: FileText,
        titleId: "Ambil Papan Klip atau Teks Masukan",
        titleEn: "Get Clipboard or Input Text",
        subtitleId: "Membaca teks chat yang baru Anda salin atau diktekan",
        subtitleEn: "Reads the chat message you just copied or dictated",
      },
      {
        id: "act-t2",
        type: "standard",
        icon: Layers,
        titleId: "Urai Multi-Transaksi ke Draft Space Aktif",
        titleEn: "Decompose Multi-Transactions to Active Space Draft",
        subtitleId: "Buka URL accrual://smart-text?text=[Clipboard]&draft=true",
        subtitleEn: "Open URL accrual://smart-text?text=[Clipboard]&draft=true",
        isNativeIntent: true,
      },
    ],
    steps: [
      {
        number: 1,
        titleId: "Pasang Pintasan Smart Text",
        titleEn: "Add Smart Text Shortcut",
        bodyId:
          "Pasang pintasan atau buat pintasan 2 langkah (Ambil Papan Klip › Enkode URL › Buka URL Skema di bawah).",
        bodyEn:
          "Install the shortcut or create a 2-step flow (Get Clipboard › URL Encode › Open Scheme URL below).",
        primaryButton: {
          labelId: "Pasang",
          labelEn: "Add",
          action: "install_or_open",
        },
        showCopyScheme: true,
      },
      {
        number: 2,
        titleId: "Salin Chat atau Catatan Pengeluaran",
        titleEn: "Copy Any Expense Chat or Note",
        bodyId:
          "Salin teks rincian pengeluaran dari WhatsApp, SMS, atau catatan (bisa berisi 1 transaksi maupun banyak transaksi sekaligus dalam satu kalimat).",
        bodyEn:
          "Copy any expense message from WhatsApp, SMS, or Notes (supports both single expenses and multiple expenses in one sentence).",
      },
      {
        number: 3,
        titleId: "Jalankan dari Pusat Kontrol atau Tombol Tindakan",
        titleEn: "Trigger from Control Center or Action Button",
        bodyId:
          "Jalankan pintasan: seluruh item pengeluaran langsung diurai otomatis ke dalam Draft pada Space Aktif Anda disertai notifikasi.",
        bodyEn:
          "Run the shortcut: all expense items are automatically decomposed into Drafts on your Active Space with a notification.",
      },
    ],
    hardwareGuide: {
      titleId: "Cara Menggunakan Pencatat Teks & Papan Klip",
      titleEn: "How to Use Smart Text & Clipboard Logger",
      stepsId: [
        "Pasang pintasan Smart Text di aplikasi Pintasan iOS.",
        "Salin pesan berisi daftar belanja atau pengeluaran dari chat.",
        "Jalankan pintasan untuk memecah seluruh item ke Draft Space Aktif.",
      ],
      stepsEn: [
        "Install the Smart Text shortcut in iOS Shortcuts.",
        "Copy any message containing one or more expenses from chat.",
        "Run the shortcut to decompose all items into your Active Space Drafts.",
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
  const { activeSpaceId, activeSpace, defaultSpaceId } = useSpace();
  const isDark = theme === "dark";

  const [selectedPresetId, setSelectedPresetId] = useState<PresetId>(() =>
    mapInitialTab(initialTab),
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customLinks, setCustomLinks] = useState<Record<string, string>>(() =>
    getSavedICloudLinks(),
  );
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configInputUrl, setConfigInputUrl] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: wallets = [] } = useWallets();

  useEffect(() => {
    if (initialTab) {
      setSelectedPresetId(mapInitialTab(initialTab));
    }
  }, [initialTab]);

  const activePreset =
    SHORTCUT_PRESETS.find((p) => p.id === selectedPresetId) || SHORTCUT_PRESETS[0];

  const effectiveICloudUrl = customLinks[activePreset.id] || activePreset.icloudUrl;
  const isUrlValid = isValidICloudLink(effectiveICloudUrl);

  const activeSpaceLabel =
    activeSpace?.id !== "all" && activeSpace?.name
      ? activeSpace.name
      : isIndonesian
      ? "Space Pribadi"
      : "Personal Space";

  const handleSelectPreset = (id: PresetId) => {
    triggerHaptic("light");
    setSelectedPresetId(id);
    setIsConfigOpen(false);
    setConfigError(null);
  };

  const handlePrimaryStepAction = (actionType: "install_or_open" | "open_shortcuts") => {
    triggerSuccessHaptic();
    if (actionType === "install_or_open" && isUrlValid) {
      try {
        window.open(effectiveICloudUrl, "_system");
      } catch {
        window.location.href = effectiveICloudUrl;
      }
      showToast(
        isIndonesian
          ? "Membuka pintasan iCloud di Apple Shortcuts..."
          : "Opening iCloud shortcut in Apple Shortcuts...",
        "info",
        () => {},
      );
      return;
    }

    // Automatically copy the direct scheme to clipboard before opening Shortcuts so user can paste immediately
    try {
      navigator.clipboard.writeText(activePreset.directScheme);
    } catch {}

    window.location.href = "shortcuts://";
    showToast(
      isIndonesian
        ? "Membuka Pintasan iOS (Skema URL telah disalin otomatis)"
        : "Opening iOS Shortcuts (URL scheme auto-copied to clipboard)",
      "info",
      () => {},
    );
  };

  const handleCopyDirectScheme = () => {
    triggerSuccessHaptic();
    const scheme = activePreset.directScheme;
    navigator.clipboard.writeText(scheme);
    setCopiedKey(activePreset.id + "-scheme");
    showToast(
      isIndonesian
        ? "Skema URL pintasan berhasil disalin"
        : "Shortcut URL scheme copied to clipboard",
      "info",
      () => {},
    );
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const copyCategoryList = () => {
    triggerSuccessHaptic();
    const list = categories
      .filter((c) => c.type !== "income")
      .map((c) => c.name)
      .join("\n");
    const fallbackList =
      "Makanan & Minuman\nTransportasi\nBelanja\nTagihan\nHiburan\nKesehatan\nLainnya";
    const textToCopy = list || fallbackList;
    navigator.clipboard.writeText(textToCopy);
    setCopiedKey("categories-list");
    showToast(
      isIndonesian
        ? "Daftar kategori berhasil disalin"
        : "Category list copied to clipboard",
      "info",
      () => {},
    );
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const copyWalletList = () => {
    triggerSuccessHaptic();
    const list = wallets.map((w) => w.name).join("\n");
    const fallbackList = "BCA\nMandiri\nGoPay\nTunai";
    const textToCopy = list || fallbackList;
    navigator.clipboard.writeText(textToCopy);
    setCopiedKey("wallets-list");
    showToast(
      isIndonesian
        ? "Daftar akun berhasil disalin"
        : "Account list copied to clipboard",
      "info",
      () => {},
    );
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleSimulateDraftFlow = () => {
    triggerSuccessHaptic();
    const targetSpaceId = resolveActiveDraftSpaceId(
      activeSpaceId !== "all" ? activeSpaceId : defaultSpaceId,
    );
    const defaultCat =
      categories.find((c) => c.type !== "income") || categories[0];
    const defaultWal = wallets[0];
    const now = new Date();
    const simAmount =
      activePreset.id === "screen_scan"
        ? 85000
        : activePreset.id === "notification_reader"
        ? 45000
        : activePreset.id === "glass_dialog"
        ? 35000
        : activePreset.id === "wallet_tap"
        ? 120000
        : 65000;

    const simDesc =
      activePreset.id === "screen_scan"
        ? isIndonesian
          ? "QRIS Kopi Kenangan (Hasil Pindai Layar)"
          : "QRIS Coffee Shop (Screen Scan)"
        : activePreset.id === "notification_reader"
        ? isIndonesian
          ? "Pembayaran GoPay • makan siang"
          : "GoPay Payment • lunch"
        : activePreset.id === "glass_dialog"
        ? isIndonesian
          ? "Parkir & Kopi (Dialog Kaca)"
          : "Parking & Coffee (Glass Dialog)"
        : activePreset.id === "wallet_tap"
        ? isIndonesian
          ? "Transaksi Tap Kartu • Supermarket"
          : "Card Tap • Supermarket"
        : isIndonesian
        ? "Ekstraksi Teks Cerdas"
        : "Smart Text Extraction";

    const simItem = {
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: format(now, "yyyy-MM-dd"),
      time: format(now, "HH:mm"),
      description: simDesc,
      cleanDescription: simDesc,
      amount: simAmount,
      type: "expense" as const,
      walletId: defaultWal?.id || null,
      walletName: defaultWal?.name || "BCA",
      suggestedCategoryId: defaultCat?.id || null,
      suggestedCategoryName:
        defaultCat?.name || (isIndonesian ? "Makanan & Minuman" : "Food & Beverage"),
      suggestedCategoryEmoji: defaultCat?.emoji || null,
      isDuplicate: false,
      selected: true,
      raw: simDesc,
      confidence: 0.95,
      needsReview: false,
      spaceId: targetSpaceId,
      spaceName: activeSpaceLabel,
    };

    saveDraftBatch(
      [simItem],
      isIndonesian ? activePreset.titleId : activePreset.titleEn,
      activePreset.id === "notification_reader"
        ? "notification"
        : activePreset.id === "glass_dialog"
        ? "glass_dialog"
        : activePreset.id === "wallet_tap"
        ? "wallet_tap"
        : activePreset.id === "smart_text"
        ? "smart_text"
        : "screen_scan",
      targetSpaceId,
    );

    void showNativeLocalNotification({
      title: isIndonesian
        ? `Draft Masuk • ${activeSpaceLabel}`
        : `Draft Queued • ${activeSpaceLabel}`,
      body: `-${formatNotificationCurrency(simAmount)} • ${
        simItem.suggestedCategoryName
      } (${simItem.walletName})`,
    });

    window.dispatchEvent(
      new CustomEvent("trouvaille:test-hud", {
        detail: {
          amount: simAmount,
          type: "expense",
          categoryName: simItem.suggestedCategoryName,
          walletName: simItem.walletName,
          note: simDesc,
        },
      }),
    );

    showToast(
      isIndonesian
        ? `Draft berhasil masuk ke ${activeSpaceLabel}!`
        : `Draft queued into ${activeSpaceLabel}!`,
      "add",
      () => {},
    );
  };

  const pillSurface = isDark
    ? "rgba(255, 255, 255, 0.06)"
    : "rgba(0, 0, 0, 0.05)";

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isIndonesian ? activePreset.titleId : activePreset.titleEn}
    >
      <div
        className="flex flex-col gap-4 px-4 pt-1 select-none"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)",
        }}
      >
        {/* 1. Segmented 5-Shortcut Switcher Bar */}
        <div
          className="flex items-center gap-1.5 p-1 rounded-2xl border overflow-x-auto no-scrollbar scroll-smooth"
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
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? isDark
                      ? "bg-white/[0.09] text-white border border-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "bg-black/[0.07] text-black border border-black/10 shadow-xs"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-transparent"
                }`}
              >
                <TabIcon size={13.5} strokeWidth={isSelected ? 2 : 1.65} />
                <span>{isIndonesian ? preset.tabLabelId : preset.tabLabelEn}</span>
              </button>
            );
          })}
        </div>

        {/* 2. Top Interactive Schematic Preview Card (Monveo Photo 1 & Photo 3 Style) */}
        <div
          className="rounded-3xl p-4 border relative overflow-hidden flex flex-col justify-between gap-3.5"
          style={{
            background: isDark
              ? "radial-gradient(ellipse at top, rgba(255,255,255,0.055) 0%, rgba(12,12,16,0.96) 100%)"
              : "radial-gradient(ellipse at top, rgba(0,0,0,0.025) 0%, rgba(255,255,255,0.96) 100%)",
            borderColor: "var(--glass-border)",
          }}
        >
          {/* Header Meta Row: Active Space Target Badge + Category Pill */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5"
              style={{
                background: pillSurface,
                borderColor: "var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <Sparkles size={11} strokeWidth={2} />
              <span>
                {isIndonesian
                  ? `Target Otomatis: Draft (${activeSpaceLabel})`
                  : `Auto Target: Draft (${activeSpaceLabel})`}
              </span>
            </span>

            <span
              className="text-[10.5px] font-medium px-2.5 py-1 rounded-full border"
              style={{
                background: "transparent",
                borderColor: "var(--glass-border)",
                color: "var(--text-tertiary)",
              }}
            >
              {isIndonesian
                ? activePreset.categoryBadgeId
                : activePreset.categoryBadgeEn}
            </span>
          </div>

          {/* Visual Action / Parameter Slot Representation (Monveo Photo 3 Parity) */}
          {activePreset.id === "notification_reader" ? (
            <div
              className="rounded-2xl p-3.5 border text-left space-y-2"
              style={{
                background: isDark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.03)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center border shrink-0"
                  style={{
                    background: isDark ? "#ffffff" : "#09090c",
                    color: isDark ? "#09090c" : "#ffffff",
                    borderColor: "var(--glass-border)",
                  }}
                >
                  <Bell size={12} strokeWidth={2.2} />
                </div>
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Log Notification Transaction
                </span>
              </div>

              <div className="text-[12px] leading-relaxed flex flex-wrap items-center gap-1.5 font-medium">
                <span style={{ color: "var(--text-primary)" }}>
                  {isIndonesian ? "Catat notifikasi" : "Log notification"}
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg border text-[11px] font-semibold"
                  style={{
                    background: pillSurface,
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {isIndonesian ? "Teks Notifikasi" : "Notification Text"}
                </span>
                <span style={{ color: "var(--text-primary)" }}>
                  {isIndonesian ? "berjudul" : "titled"}
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg border text-[11px] font-semibold"
                  style={{
                    background: pillSurface,
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {isIndonesian ? "Judul Notifikasi" : "Notification Title"}
                </span>
                <span style={{ color: "var(--text-primary)" }}>
                  {isIndonesian ? "subjudul" : "subtitled"}
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg border text-[11px] font-semibold"
                  style={{
                    background: pillSurface,
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {isIndonesian ? "Subjudul Notifikasi" : "Notification Subtitle"}
                </span>
                <span style={{ color: "var(--text-primary)" }}>
                  {isIndonesian ? "dari" : "from"}
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg border text-[11px] font-semibold"
                  style={{
                    background: pillSurface,
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {isIndonesian ? "Aplikasi Sumber" : "Source App"}
                </span>
                <span style={{ color: "var(--text-primary)" }}>
                  {isIndonesian ? "pada" : "at"}
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg border text-[11px] font-semibold"
                  style={{
                    background: pillSurface,
                    borderColor: "var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {isIndonesian ? "Waktu Diterima" : "Received At"}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl p-3 border flex flex-col gap-2"
              style={{
                background: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)",
                borderColor: "var(--glass-border)",
              }}
            >
              {activePreset.actions.map((act, idx) => {
                const ActIcon = act.icon;
                return (
                  <div key={act.id} className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border text-[11px] font-bold"
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
                          : "var(--text-primary)",
                        borderColor: "var(--glass-border)",
                      }}
                    >
                      <ActIcon size={13.5} strokeWidth={1.85} />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {idx + 1}. {isIndonesian ? act.titleId : act.titleEn}
                      </div>
                      {act.subtitleId && (
                        <div className="text-[10.5px] truncate" style={{ color: "var(--text-tertiary)" }}>
                          {isIndonesian ? act.subtitleId : act.subtitleEn}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Concise Summary */}
          <p
            className="text-[11.5px] leading-relaxed text-left"
            style={{ color: "var(--text-secondary)" }}
          >
            {isIndonesian ? activePreset.summaryId : activePreset.summaryEn}
          </p>
        </div>

        {/* 3. Monveo-Style Unified "Step by step" Card (Photo 1 & Photo 2 Parity) */}
        <div
          className="rounded-3xl border overflow-hidden"
          style={{
            background: isDark ? "rgba(20, 20, 24, 0.85)" : "rgba(255, 255, 255, 0.92)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "var(--glass-border)" }}
          >
            <span
              className="text-[13px] font-semibold tracking-tight"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Langkah demi langkah" : "Step by step"}
            </span>
            <span
              className="text-[10.5px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {activePreset.steps.length}{" "}
              {isIndonesian ? "langkah" : "steps"}
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
            {activePreset.steps.map((step) => (
              <div
                key={step.number}
                className="p-4 flex items-start gap-3.5 text-left"
                style={{ borderColor: "var(--glass-border)" }}
              >
                {/* Numbered Circle Badge */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-semibold mt-0.5"
                  style={{
                    background: pillSurface,
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {step.number}
                </div>

                {/* Step Content & Contextual Pills */}
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div>
                    <h4
                      className="text-[14px] font-semibold leading-snug"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian ? step.titleId : step.titleEn}
                    </h4>
                    <p
                      className="text-[12px] leading-relaxed mt-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {isIndonesian ? step.bodyId : step.bodyEn}
                    </p>
                  </div>

                  {/* Inline Action Pills (Monveo "[↗ Add]" / "[↗ Open]" Parity) */}
                  {(step.primaryButton || step.showCopyScheme) && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {step.primaryButton && (
                        <button
                          type="button"
                          onClick={() =>
                            handlePrimaryStepAction(step.primaryButton!.action)
                          }
                          className="h-8.5 px-4 rounded-full font-semibold text-[12px] inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
                          style={{
                            background: isDark ? "#ffffff" : "#09090c",
                            color: isDark ? "#09090c" : "#ffffff",
                          }}
                        >
                          <ExternalLink size={13} strokeWidth={2.2} />
                          <span>
                            {isIndonesian
                              ? step.primaryButton.labelId
                              : step.primaryButton.labelEn}
                          </span>
                        </button>
                      )}

                      {step.showCopyScheme && (
                        <button
                          type="button"
                          onClick={handleCopyDirectScheme}
                          className="h-8.5 px-3.5 rounded-full border font-semibold text-[11.5px] inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                          style={{
                            background: pillSurface,
                            borderColor: "var(--glass-border)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {copiedKey === activePreset.id + "-scheme" ? (
                            <>
                              <Check size={12.5} strokeWidth={2.2} />
                              <span>
                                {isIndonesian ? "Skema Tersalin" : "Scheme Copied"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy size={12.5} strokeWidth={1.8} />
                              <span>
                                {isIndonesian ? "Salin Skema URL" : "Copy URL Scheme"}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Fast 1-Tap Category & Account Copy Pills for Glass Dialog */}
                  {step.showCopyLists && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={copyCategoryList}
                        className="h-8.5 px-3.5 rounded-full border font-semibold text-[11.5px] inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                        style={{
                          background: pillSurface,
                          borderColor: "var(--glass-border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {copiedKey === "categories-list" ? (
                          <>
                            <Check size={12.5} strokeWidth={2.2} />
                            <span>
                              {isIndonesian ? "Kategori Tersalin" : "Categories Copied"}
                            </span>
                          </>
                        ) : (
                          <>
                            <ListFilter size={12.5} strokeWidth={1.8} />
                            <span>
                              {isIndonesian ? "Salin Kategori" : "Copy Categories"}
                            </span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={copyWalletList}
                        className="h-8.5 px-3.5 rounded-full border font-semibold text-[11.5px] inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                        style={{
                          background: pillSurface,
                          borderColor: "var(--glass-border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {copiedKey === "wallets-list" ? (
                          <>
                            <Check size={12.5} strokeWidth={2.2} />
                            <span>
                              {isIndonesian ? "Akun Tersalin" : "Accounts Copied"}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy size={12.5} strokeWidth={1.8} />
                            <span>
                              {isIndonesian ? "Salin Akun" : "Copy Accounts"}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Simulation & Custom iCloud Link Toolbar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSimulateDraftFlow}
            className="flex-1 h-10 rounded-2xl border flex items-center justify-center gap-1.5 text-[12px] font-semibold cursor-pointer active:scale-[0.98] transition-all"
            style={{
              background: pillSurface,
              borderColor: "var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <Play size={13} strokeWidth={2} />
            <span>
              {isIndonesian
                ? "Uji Simulasi Masuk Draft"
                : "Test Draft Simulation"}
            </span>
          </button>

          {!activePreset.isPersonalAutomation && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setConfigInputUrl(effectiveICloudUrl || "");
                setConfigError(null);
                setIsConfigOpen((prev) => !prev);
              }}
              className="h-10 px-3.5 rounded-2xl border flex items-center justify-center gap-1.5 text-[12px] font-semibold cursor-pointer active:scale-[0.98] transition-all"
              style={{
                background: pillSurface,
                borderColor: "var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              <Link2 size={13.5} strokeWidth={1.8} />
              <span>{isIndonesian ? "Tautan iCloud" : "iCloud Link"}</span>
            </button>
          )}
        </div>

        {/* Optional Custom iCloud Link Drawer */}
        {isConfigOpen && (
          <div
            className="rounded-2xl p-4 border space-y-3 text-left"
            style={{
              background: isDark ? "rgba(18, 18, 22, 0.95)" : "rgba(245, 245, 247, 0.95)",
              borderColor: "var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[12.5px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? "Tautan iCloud Pintasan Resmi"
                  : "Official Shortcut iCloud Link"}
              </span>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="text-[11px] font-medium cursor-pointer"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Tutup" : "Close"}
              </button>
            </div>

            <p
              className="text-[11.5px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian
                ? "Tempelkan tautan iCloud resmi (https://www.icloud.com/shortcuts/...) agar tombol Pasang langsung mengunduh pintasan jadi."
                : "Paste a verified iCloud link (https://www.icloud.com/shortcuts/...) so the Add button directly installs the pre-built shortcut."}
            </p>

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
                background: pillSurface,
                borderColor: "var(--glass-border)",
                color: "var(--text-primary)",
              }}
            />

            {configError && (
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {configError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const trimmed = configInputUrl.trim();
                  if (trimmed && !isValidICloudLink(trimmed)) {
                    setConfigError(
                      isIndonesian
                        ? "Format tautan harus https://www.icloud.com/shortcuts/[32 karakter heksadesimal asli]"
                        : "Format must be https://www.icloud.com/shortcuts/[32 valid hex characters]",
                    );
                    triggerHaptic("heavy");
                    return;
                  }
                  saveICloudLink(activePreset.id, trimmed);
                  setCustomLinks(getSavedICloudLinks());
                  setIsConfigOpen(false);
                  triggerSuccessHaptic();
                  showToast(
                    isIndonesian
                      ? "Tautan iCloud berhasil disimpan"
                      : "iCloud link saved",
                    "add",
                    () => {},
                  );
                }}
                className="flex-1 h-9.5 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-1.5 cursor-pointer"
                style={{
                  background: isDark ? "#ffffff" : "#09090c",
                  color: isDark ? "#09090c" : "#ffffff",
                }}
              >
                <Check size={13.5} strokeWidth={2.5} />
                <span>{isIndonesian ? "Simpan Tautan" : "Save Link"}</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. Full-Width High-Contrast Done Button (Monveo Photo 1 & 2 Parity) */}
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 rounded-2xl flex items-center justify-center font-semibold text-[14px] cursor-pointer active:scale-[0.98] transition-all shadow-md"
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
