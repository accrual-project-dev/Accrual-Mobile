import { useState, useEffect, useRef } from "react";
import {
  Copy,
  Check,
  Zap,
  Mic,
  SlidersHorizontal,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  List,
  MessageSquare,
  Link as LinkIcon,
  FileText,
  Search,
  RotateCcw,
  Play,
  Scissors,
  ScanLine,
  Bell,
  Camera,
  Coffee,
  Calendar,
  Smartphone,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { BottomSheet } from "../ui/BottomSheet";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";

// Legacy TabType preserved for SettingsPage.tsx compatibility
export type TabType =
  | "back_tap"
  | "action_button"
  | "ways_to_add"
  | "automation"
  | "screen_scan"
  | "notification_reader";

type InternalTab = "pindai" | "notifikasi" | "instan" | "suara" | "dialog";

function mapTab(t: TabType): InternalTab {
  if (t === "screen_scan") return "pindai";
  if (t === "notification_reader" || t === "automation") return "notifikasi";
  if (t === "ways_to_add") return "suara";
  if (t === "action_button") return "instan";
  if (t === "back_tap") return "pindai";
  return "pindai";
}

interface AppleShortcutsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabType;
}

interface SlideData {
  isHero?: boolean;
  stepNum?: number;
  title: string;
  desc: string;
  actionType?: "test_url" | "copy" | "info" | "test_hud";
  scheme?: string;
  copyText?: string;
  copyLabel?: string;
  btnText?: string;
  noteText?: string;
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

  const { session } = useAuth();
  const userToken = session?.user?.id || "";
  const { data: categories = [] } = useCategories();
  const { data: wallets = [] } = useWallets();

  const [platform, setPlatform] = useState<"ios" | "android">(() =>
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" ? "android" : "ios"
  );
  const [activeTab, setActiveTab] = useState<InternalTab>(() => mapTab(initialTab));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Touch swipe tracking
  const touchStartXRef = useRef<number>(0);
  const touchEndXRef = useRef<number>(0);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(mapTab(initialTab));
      setCurrentSlide(0);
    }
  }, [initialTab]);

  const handlePlatformChange = (p: "ios" | "android") => {
    triggerHaptic("light");
    setPlatform(p);
    setCurrentSlide(0);
  };

  const handleTabChange = (tab: InternalTab) => {
    triggerHaptic("light");
    setActiveTab(tab);
    setCurrentSlide(0);
  };

  const copyToClipboard = (text: string, label: string) => {
    triggerSuccessHaptic();
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(
      `${label} ${isIndonesian ? "berhasil disalin" : "copied to clipboard"}`,
      "add",
      () => {},
    );
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestDeepLink = (scheme: string) => {
    triggerHaptic("medium");
    window.location.href = scheme;
  };

  const handleTestHud = () => {
    triggerHaptic("medium");
    window.dispatchEvent(
      new CustomEvent("trouvaille:test-hud", {
        detail: {
          amount: 75000,
          type: "expense",
          categoryName: isIndonesian ? "Makanan" : "Food",
          walletName: "BCA",
          note: isIndonesian ? "Kopi Kenangan" : "Coffee",
        },
      })
    );
    showToast(
      isIndonesian ? "Simulasi Dynamic Island HUD aktif!" : "Dynamic Island HUD simulated!",
      "add",
      () => {},
    );
  };

  const categoryListText =
    categories
      .filter((c) => c.type !== "income")
      .map((c) => c.name)
      .join("\n") ||
    (isIndonesian
      ? "Makanan\nTransportasi\nBelanja\nHiburan\nTagihan\nLainnya"
      : "Food\nTransport\nShopping\nEntertainment\nBills\nOther");

  const walletListText =
    wallets.map((w) => w.name).join("\n") ||
    (isIndonesian
      ? "Cash\nBCA\nMandiri\nGoPay\nOVO\nShopeePay"
      : "Cash\nChecking\nCredit Card\nSavings");

  const userIdText = userToken || "00000000-0000-0000-0000-000000000000";

  // Slide content matrix with pure non-mixed localization
  const slides: Record<InternalTab, SlideData[]> = {
    pindai: [
      {
        isHero: true,
        title: isIndonesian ? "Pindai Layar Resi & Riwayat" : "Auto Screen & History Scanner (Back Tap)",
        desc: isIndonesian
          ? "Saat berada di layar bukti pembayaran tunggal atau layar riwayat transaksi (GoPay, Shopee, BCA, dll.), ketuk 2x bodi belakang iPhone Anda. Pintasan otomatis membaca layar via Live Text OCR. Jika terdeteksi banyak transaksi, Accrual otomatis membuka lembar daftar periksa cerdas untuk Anda tinjau sebelum disimpan."
          : "While viewing any payment receipt or transaction history list (GoPay, Shopee, BCA, etc.), double tap the back of your iPhone. Shortcuts reads the screen via Live Text. If multiple transactions are detected, Accrual automatically opens an interactive checklist review sheet before saving.",
        actionType: "test_hud",
        btnText: isIndonesian ? "Uji Kapsul Notifikasi" : "Test Dynamic Island HUD",
      },
      {
        stepNum: 1,
        title: isIndonesian ? "Langkah 1: Jepret Layar & Ekstrak Teks" : "Step 1: Take Screenshot & Extract Text",
        desc: isIndonesian
          ? "Buka aplikasi Pintasan › Ketuk (+) › Ganti nama menjadi 'Pindai Resi'.\n1. Tambah tindakan 'Ambil Jepretan Layar'.\n2. Tambah tindakan 'Ekstrak Teks dari Gambar' (otomatis terhubung ke Jepretan Layar)."
          : "Open Shortcuts app › Tap (+) › Rename to 'Scan Receipt'.\n1. Add 'Take Screenshot' action.\n2. Add 'Extract Text from Image' action (automatically connects to Screenshot).",
        actionType: "info",
        noteText: isIndonesian
          ? "Fitur Live Text OCR iOS berjalan 100% lokal di perangkat tanpa internet."
          : "iOS Live Text OCR runs 100% on-device for total privacy.",
      },
      {
        stepNum: 2,
        title: isIndonesian ? "Langkah 2: Enkode URL & Buka Accrual" : "Step 2: URL Encode & Open Accrual",
        desc: isIndonesian
          ? "1. Tambah tindakan 'Enkode URL' untuk variabel 'Teks dari Gambar'.\n2. Tambah tindakan 'Buka URL' dan tempel skema di bawah, lalu ganti [Teks Terenkode] dengan variabel biru:"
          : "1. Add 'URL Encode' action for 'Text from Image' variable.\n2. Add 'Open URLs' action and paste the scheme below, replacing [URL Encoded Text] with the blue variable token:",
        actionType: "copy",
        copyText: isIndonesian
          ? "accrual://capture?text=[Teks Terenkode]&autosave=true"
          : "accrual://capture?text=[URL Encoded Text]&autosave=true",
        copyLabel: isIndonesian ? "Skema Pindai Layar" : "Screen Scan Scheme",
        btnText: isIndonesian ? "Salin Skema Pindai Layar" : "Copy Screen Scan Scheme",
      },
      {
        stepNum: 3,
        title: isIndonesian ? "Langkah 3: Tautkan ke Ketuk Bagian Belakang" : "Step 3: Link to Back Tap",
        desc: isIndonesian
          ? "Buka Pengaturan iOS › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › Ketuk Dua Kali › Gulir ke bagian Pintasan dan pilih 'Pindai Resi'.\n\nTips: Pengguna iPhone 15 Pro / 16 juga dapat menautkannya langsung ke Tombol Tindakan."
          : "Open iOS Settings › Accessibility › Touch › Back Tap › Double Tap › Scroll to Shortcuts and select 'Scan Receipt'.\n\nTip: iPhone 15 Pro / 16 users can also link this directly to the Action Button.",
        actionType: "info",
        noteText: isIndonesian
          ? "Kini cukup ketuk 2x bodi belakang iPhone saat melihat struk atau resi transfer."
          : "Now simply double-tap your iPhone back whenever viewing any receipt or payment confirmation.",
      },
    ],
    notifikasi: [
      {
        isHero: true,
        title: isIndonesian ? "Pembaca Notifikasi Bank Otomatis" : "Auto Bank Notification Reader",
        desc: isIndonesian
          ? "Setiap kali notifikasi transaksi masuk dari m-Banking atau dompet digital (BCA, Livin Mandiri, GoPay, OVO, ShopeePay, DANA, dll.), iPhone otomatis membaca teks notifikasi dan langsung menyimpannya ke Accrual di latar belakang tanpa sentuhan manual."
          : "Whenever a transaction notification arrives from your banking or e-wallet app (BCA, Livin Mandiri, GoPay, OVO, ShopeePay, DANA, etc.), your iPhone automatically reads the notification text and saves it directly to Accrual in the background without manual touch.",
        actionType: "test_hud",
        btnText: isIndonesian ? "Uji Kapsul Notifikasi" : "Test Dynamic Island HUD",
      },
      {
        stepNum: 1,
        title: isIndonesian ? "Langkah 1: Buat Automasi Pemberitahuan" : "Step 1: Create Notification Automation",
        desc: isIndonesian
          ? "1. Buka aplikasi Pintasan › Ketuk tab 'Automasi' di bagian bawah.\n2. Ketuk (+) › Pilih 'Pemberitahuan'.\n3. Pilih aplikasi bank/dompet digital Anda (BCA, Livin, GoPay, dll.).\n4. Centang 'Jalankan Segera'."
          : "1. Open Shortcuts app › Tap 'Automation' tab at the bottom.\n2. Tap (+) › Choose 'Notification'.\n3. Select your banking/e-wallet apps (BCA, Livin, GoPay, etc.).\n4. Check 'Run Immediately'.",
        actionType: "info",
        noteText: isIndonesian
          ? "'Jalankan Segera' memastikan automasi bekerja hening tanpa meminta izin berulang."
          : "'Run Immediately' ensures the automation runs silently without asking permission every time.",
      },
      {
        stepNum: 2,
        title: isIndonesian ? "Langkah 2: Sambungkan Teks ke Accrual" : "Step 2: Connect Text to Accrual",
        desc: isIndonesian
          ? "1. Tambah tindakan 'Enkode URL' untuk variabel 'Masukan Pintasan'.\n2. Tambah tindakan 'Buka URL' dan masukkan skema di bawah, lalu ganti [Teks Terenkode] dengan variabel biru:"
          : "1. Add 'URL Encode' action for 'Shortcut Input' variable.\n2. Add 'Open URLs' action and paste the scheme below, replacing [URL Encoded Text] with the blue variable token:",
        actionType: "copy",
        copyText: isIndonesian
          ? "accrual://add?text=[Teks Terenkode]&autosave=true"
          : "accrual://add?text=[URL Encoded Text]&autosave=true",
        copyLabel: isIndonesian ? "Skema Automasi" : "Automation Scheme",
        btnText: isIndonesian ? "Salin Skema Automasi" : "Copy Automation Scheme",
      },
      {
        stepNum: 3,
        title: isIndonesian ? "Langkah 3: Jalankan Tanpa Gangguan" : "Step 3: Run Silently Without Interruption",
        desc: isIndonesian
          ? "Pastikan opsi 'Beri Tahu Saat Dijalankan' dinonaktifkan. Sekarang, setiap kali Anda bertransaksi atau menerima transfer, data pengeluaran langsung tercatat secara otomatis!"
          : "Make sure 'Notify When Run' is toggled OFF. Now, whenever you pay at a merchant or receive a transfer, the transaction is automatically recorded!",
        actionType: "info",
        noteText: isIndonesian
          ? "Pengurai pintar Accrual otomatis memisahkan nominal, toko, dan akun pembayaran."
          : "Accrual's smart parser automatically extracts amount, merchant, and payment account.",
      },
    ],
    instan: [
      {
        isHero: true,
        title: isIndonesian ? "Pencatatan 1-Ketukan Instan" : "Instant 1-Tap Logging",
        desc: isIndonesian
          ? "Ketuk 2x bodi belakang iPhone Anda untuk langsung membuka lembar masukan nominal Accrual secara instan dari aplikasi apa pun tanpa jeda."
          : "Double tap the back of your iPhone (Back Tap) to instantly open the Accrual amount sheet from anywhere without opening the full app.",
        actionType: "test_url",
        scheme: "accrual://add",
        btnText: isIndonesian ? "Uji Buka URL Sekarang" : "Test Open URL Now",
      },
      {
        stepNum: 1,
        title: isIndonesian ? "Buat Tindakan 'Buka URL'" : "Add 'Open URLs' Action",
        desc: isIndonesian
          ? "Buka aplikasi Pintasan > Ketuk tanda (+) > Ganti nama pintasan menjadi 'Catat Pengeluaran' > Tambahkan tindakan 'Buka URL' dan tempel alamat skema berikut:"
          : "Open Shortcuts > Tap (+) > Rename shortcut to 'Log Expense' > Add 'Open URLs' action and paste the scheme below:",
        actionType: "copy",
        copyText: "accrual://add",
        copyLabel: isIndonesian ? "Skema URL" : "URL Scheme",
        btnText: isIndonesian ? "Salin Skema URL" : "Copy URL Scheme",
      },
      {
        stepNum: 2,
        title: isIndonesian ? "Tautkan ke Ketuk Bagian Belakang" : "Link to Back Tap",
        desc: isIndonesian
          ? "Buka Pengaturan iOS › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › Ketuk Dua Kali › Gulir ke bagian Pintasan dan pilih 'Catat Pengeluaran'.\n\nTips: Pengguna iPhone 15 Pro / 16 juga dapat menautkannya langsung ke Tombol Tindakan."
          : "Open iOS Settings › Accessibility › Touch › Back Tap › Double Tap › Scroll to Shortcuts and select 'Log Expense'.\n\nTip: iPhone 15 Pro / 16 users can also link this directly to the Action Button.",
        actionType: "info",
        noteText: isIndonesian
          ? "Pengaturan selesai, siap digunakan kapan saja."
          : "Setup complete, ready to use anytime.",
      },
    ],
    suara: [
      {
        isHero: true,
        title: isIndonesian ? "Pencatatan Suara 1-Ketukan" : "Instant 1-Tap Voice Logging",
        desc: isIndonesian
          ? "Buka perekam suara cerdas Accrual secara instan dengan satu ketukan tombol atau pintasan. Cukup ucapkan transaksi Anda (contoh: \"Kopi susu 25 ribu bayar pakai BCA\") tanpa perlu mengetik manual."
          : "Open Accrual's intelligent voice recorder instantly with a single button tap or shortcut. Speak your transaction naturally (e.g. \"Iced coffee 25 thousand paid with BCA\") without manual typing.",
        actionType: "test_url",
        scheme: "accrual://voice",
        btnText: isIndonesian ? "Uji Buka Suara Sekarang" : "Test Open Voice Now",
      },
      {
        stepNum: 1,
        title: isIndonesian ? "Langkah 1: Tambah Tindakan 'Buka URL'" : "Step 1: Add 'Open URLs' Action",
        desc: isIndonesian
          ? "Buka aplikasi Pintasan › Ketuk (+) › Ganti nama menjadi 'Catat Suara' › Tambahkan tindakan 'Buka URL' dan tempel alamat skema berikut:"
          : "Open Shortcuts › Tap (+) › Rename shortcut to 'Log Voice' › Add 'Open URLs' action and paste the scheme below:",
        actionType: "copy",
        copyText: "accrual://voice",
        copyLabel: isIndonesian ? "Skema URL Suara" : "Voice URL Scheme",
        btnText: isIndonesian ? "Salin Skema Suara" : "Copy Voice Scheme",
      },
      {
        stepNum: 2,
        title: isIndonesian ? "Langkah 2: Tautkan ke Tombol Tindakan / Ketuk Belakang" : "Step 2: Link to Action Button / Back Tap",
        desc: isIndonesian
          ? "Buka Pengaturan iOS › Tombol Tindakan (atau Aksesibilitas › Sentuh › Ketuk Bagian Belakang) › Pilih Pintasan 'Catat Suara'. Saat ditekan, modal perekam suara Accrual langsung aktif mendengarkan ucapan Anda!"
          : "Open iOS Settings › Action Button (or Accessibility › Touch › Back Tap) › Select 'Log Voice' shortcut. When pressed, Accrual's voice modal immediately starts listening!",
        actionType: "info",
        noteText: isIndonesian
          ? "Mikrofon langsung aktif otomatis mendengarkan pengucapan Anda."
          : "The microphone automatically starts listening immediately.",
      },
    ],
    dialog: [
      {
        isHero: true,
        title: isIndonesian ? "Pencatatan Dialog Pop-up Asli iOS" : "Native iOS Dialog Logging",
        desc: isIndonesian
          ? "Input transaksi melalui rentetan pop-up dialog resmi iOS satu demi satu. Seluruh data terkirim hening dan tersimpan rapi ke cloud Accrual tanpa perlu berpindah aplikasi."
          : "Log expenses through sequential native iOS dialog pop-ups. All data is silently transmitted and saved to your Accrual cloud without opening the app.",
        actionType: "copy",
        copyText: userIdText,
        copyLabel: isIndonesian ? "ID Pengguna" : "User ID",
        btnText: isIndonesian ? "Salin ID Pengguna" : "Copy User ID",
      },
      {
        stepNum: 1,
        title: isIndonesian ? "Langkah 1: Minta Masukan Nominal" : "Step 1: Ask for Number (Amount)",
        desc: isIndonesian
          ? "Tambah tindakan 'Minta Masukan' › Ubah tipe ke 'Angka' › Pertanyaan: 'Berapa nominalnya?'. Ketuk variabel biru di atas papan ketik lalu ganti nama menjadi 'Nominal'."
          : "Add 'Ask for Input' › Change type to 'Number' › Prompt: 'How much was it?'. Tap the blue variable above the keyboard and rename it to 'Nominal'.",
        actionType: "info",
        noteText: isIndonesian
          ? "Tipe Angka memastikan papan tombol numerik iOS langsung muncul."
          : "Number type ensures the native iOS numeric keypad appears immediately.",
      },
      {
        stepNum: 2,
        title: isIndonesian ? "Langkah 2: Pilihan Kategori Saya" : "Step 2: Category Selection List",
        desc: isIndonesian
          ? "1. Tambah tindakan 'Teks' dan tempel daftar kategori di bawah.\n2. Tambah tindakan 'Pisahkan Teks' dengan pemisah 'Baris Baru'.\n3. Tambah tindakan 'Pilih dari Daftar' lalu ganti nama variabel menjadi 'Kategori'."
          : "1. Add 'Text' action and paste your category list below.\n2. Add 'Split Text' action by 'New Lines'.\n3. Add 'Choose from List' action and rename the variable to 'Category'.",
        actionType: "copy",
        copyText: categoryListText,
        copyLabel: isIndonesian ? "Daftar Kategori" : "Categories",
        btnText: isIndonesian ? "Salin Daftar Kategori" : "Copy Categories",
      },
      {
        stepNum: 3,
        title: isIndonesian ? "Langkah 3: Pilihan Akun" : "Step 3: Account Selection",
        desc: isIndonesian
          ? "1. Tambah tindakan 'Teks' dan tempel daftar akun di bawah.\n2. Tambah tindakan 'Pisahkan Teks' dengan pemisah 'Baris Baru'.\n3. Tambah tindakan 'Pilih dari Daftar' lalu ganti nama variabel menjadi 'Akun'."
          : "1. Add 'Text' action and paste your account list below.\n2. Add 'Split Text' action by 'New Lines'.\n3. Add 'Choose from List' action and rename the variable to 'Account'.",
        actionType: "copy",
        copyText: walletListText,
        copyLabel: isIndonesian ? "Daftar Akun" : "Accounts",
        btnText: isIndonesian ? "Salin Daftar Akun" : "Copy Accounts",
      },
      {
        stepNum: 4,
        title: isIndonesian ? "Langkah 4: Minta Masukan Tanggal & Waktu" : "Step 4: Ask for Date and Time",
        desc: isIndonesian
          ? "Tambah tindakan 'Minta Masukan' › Ubah tipe ke 'Tanggal dan Waktu' › Pertanyaan: 'Kapan transaksi dilakukan?'. Ketuk variabel biru di atas papan ketik lalu ganti nama menjadi 'Tanggal'."
          : "Add 'Ask for Input' › Change type to 'Date and Time' › Prompt: 'When was this transaction?'. Tap the blue variable above the keyboard and rename it to 'Date'.",
        actionType: "info",
        noteText: isIndonesian
          ? "Tipe Tanggal dan Waktu memunculkan pemilih kalender dan jam asli iOS secara otomatis."
          : "Date and Time type brings up the native iOS calendar and time picker automatically.",
      },
      {
        stepNum: 5,
        title: isIndonesian ? "Langkah 5: Masukan Catatan & Rangkai Teks" : "Step 5: Notes & Assemble Text",
        desc: isIndonesian
          ? "1. Tambah tindakan 'Minta Masukan' Teks dengan pertanyaan: 'Catatan tambahan?' (opsional, ganti nama variabel menjadi 'Catatan').\n2. Tambah tindakan 'Teks', lalu tempel templat 5 baris di bawah dan sisipkan variabel biru ke masing-masing baris:"
          : "1. Add 'Ask for Input' Text: 'Any notes?' (optional, rename variable to 'Notes').\n2. Add 'Text' action, paste the 5-line template below and place your blue variables on each line:",
        actionType: "copy",
        copyText: isIndonesian
          ? "Nominal: [Nominal]\nKategori: [Kategori]\nAkun: [Akun]\nTanggal: [Tanggal]\nCatatan: [Catatan]"
          : "Nominal: [Amount]\nKategori: [Category]\nAkun: [Account]\nTanggal: [Date]\nCatatan: [Notes]",
        copyLabel: isIndonesian ? "Format Teks Transaksi" : "Transaction Text Format",
        btnText: isIndonesian ? "Salin Format Teks" : "Copy Text Format",
      },
      {
        stepNum: 6,
        title: isIndonesian ? "Langkah 6: Enkode URL & Buka Accrual" : "Step 6: URL Encode & Open Accrual",
        desc: isIndonesian
          ? "1. Tambah tindakan 'Enkode URL' untuk variabel 'Teks' dari Langkah 5.\n2. Tambah tindakan 'Buka URL' di urutan paling akhir dan tempel templat di bawah, lalu ganti [Teks Terenkode] dengan variabel biru 'Teks Terenkode URL':"
          : "1. Add 'URL Encode' action for the 'Text' variable from Step 5.\n2. Add 'Open URLs' action at the end and paste the template below, replacing [URL Encoded Text] with the blue 'URL Encoded Text' variable:",
        actionType: "copy",
        copyText: isIndonesian
          ? "accrual://add?text=[Teks Terenkode]&autosave=true"
          : "accrual://add?text=[URL Encoded Text]&autosave=true",
        copyLabel: isIndonesian ? "Skema Buka URL" : "Open URLs Scheme",
        btnText: isIndonesian ? "Salin Skema Buka URL" : "Copy Open URLs Scheme",
      },
    ],
  };

  const androidSlides: SlideData[] = [
    {
      isHero: true,
      title: isIndonesian ? "Pembaca Notifikasi Bank Android" : "Android Bank Notification Reader",
      desc: isIndonesian
        ? "Setiap kali notifikasi transaksi masuk dari m-Banking atau dompet digital (BCA, Livin Mandiri, BRImo, Bank Jago, wondr by BNI, SeaBank, Superbank, GoPay, ShopeePay, DANA, dll.), aplikasi MacroDroid atau Tasker otomatis menangkap teks notifikasi dan membukanya ke Accrual via tautan langsung tanpa sentuhan manual."
        : "Whenever a transaction notification arrives from your banking or e-wallet app (BCA, Livin Mandiri, BRImo, Bank Jago, wondr by BNI, SeaBank, Superbank, GoPay, ShopeePay, DANA, etc.), MacroDroid or Tasker automatically captures the notification text and opens it in Accrual via deep link without manual touch.",
      actionType: "test_hud",
      btnText: isIndonesian ? "Uji Kapsul Notifikasi" : "Test Notification HUD",
    },
    {
      stepNum: 1,
      title: isIndonesian ? "Langkah 1: Pasang MacroDroid & Buat Pemicu" : "Step 1: Install MacroDroid & Add Trigger",
      desc: isIndonesian
        ? "1. Unduh aplikasi MacroDroid (atau Tasker) dari Google Play Store.\n2. Buat Makro Baru › Tambah Pemicu › 'Perangkat & Notifikasi' › 'Notifikasi Diterima'.\n3. Centang 'Pilih Aplikasi' dan pilih bank/dompet digital Anda (BCA, Livin, BRImo, Jago, wondr, GoPay, ShopeePay, dll.)."
        : "1. Install MacroDroid (or Tasker) from Google Play Store.\n2. Create New Macro › Add Trigger › 'Device & Notifications' › 'Notification Received'.\n3. Check 'Select Applications' and pick your bank or e-wallet apps (BCA, Livin, BRImo, Jago, wondr, GoPay, ShopeePay, etc.).",
      actionType: "info",
      noteText: isIndonesian
        ? "MacroDroid berjalan lokal di perangkat Android Anda tanpa memerlukan akses root."
        : "MacroDroid runs 100% on-device without requiring root permissions.",
    },
    {
      stepNum: 2,
      title: isIndonesian ? "Langkah 2: Tambahkan Tindakan Buka URL" : "Step 2: Add Open URL Action",
      desc: isIndonesian
        ? "1. Tambah Tindakan › 'Aplikasi' › 'Buka Situs Web / URL'.\n2. Masukkan skema di bawah, lalu ganti [teks_notifikasi] dengan token variabel teks notifikasi MacroDroid ({not_body}):"
        : "1. Add Action › 'Applications' › 'Open Website / URL'.\n2. Enter the scheme below, replacing [notification_text] with MacroDroid's notification body token ({not_body}):",
      actionType: "copy",
      copyText: isIndonesian
        ? "accrual://add?text=[teks_notifikasi]&autosave=true"
        : "accrual://add?text=[notification_text]&autosave=true",
      copyLabel: isIndonesian ? "Skema Otomasi Android" : "Android Automation Scheme",
      btnText: isIndonesian ? "Salin Skema Otomasi Android" : "Copy Android Automation Scheme",
    },
    {
      stepNum: 3,
      title: isIndonesian ? "Langkah 3: Berikan Izin Akses Notifikasi" : "Step 3: Grant Notification Access",
      desc: isIndonesian
        ? "Buka Pengaturan Android › Aplikasi › Akses Khusus › Akses Notifikasi › Aktifkan untuk MacroDroid. Simpan makro Anda. Setiap notifikasi bank masuk, transaksi otomatis dibuka di lembar tinjau Accrual untuk dikonfirmasi dengan 1 ketukan!"
        : "Open Android Settings › Apps › Special App Access › Notification Access › Enable for MacroDroid. Save your macro. Every incoming bank notification will automatically open in Accrual's review sheet for instant 1-tap confirmation!",
      actionType: "info",
      noteText: isIndonesian
        ? "Pencatatan siap bekerja otomatis di latar belakang ponsel Android Anda."
        : "Automations are now ready to run in the background on your Android device.",
    },
  ];

  const currentTabSlides =
    platform === "android"
      ? androidSlides
      : slides[activeTab] || slides.pindai;
  const activeSlide = currentTabSlides[currentSlide] || currentTabSlides[0];

  const handleNextSlide = () => {
    if (currentSlide < currentTabSlides.length - 1) {
      triggerHaptic("light");
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      triggerHaptic("light");
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndXRef.current = e.changedTouches[0].screenX;
    const diff = touchEndXRef.current - touchStartXRef.current;
    if (Math.abs(diff) > 40) {
      if (diff < 0) handleNextSlide();
      else handlePrevSlide();
    }
  };

  const tabs: { id: InternalTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "pindai",
      label: isIndonesian ? "Pindai" : "Scan",
      icon: <ScanLine size={12} strokeWidth={2} />,
    },
    {
      id: "notifikasi",
      label: "Notif",
      icon: <Bell size={12} strokeWidth={2} />,
    },
    {
      id: "instan",
      label: isIndonesian ? "Instan" : "Instant",
      icon: <Zap size={12} strokeWidth={2} />,
    },
    {
      id: "suara",
      label: isIndonesian ? "Suara" : "Voice",
      icon: <Mic size={12} strokeWidth={2} />,
    },
    {
      id: "dialog",
      label: "Dialog",
      icon: <SlidersHorizontal size={12} strokeWidth={2} />,
    },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="px-4 pt-4 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)] max-w-[392px] mx-auto select-none font-sans">
        
        {/* Header Title with proper top clearance */}
        <div className="text-center mt-1 mb-3">
          <p
            className="text-[10px] font-semibold tracking-wider uppercase mb-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "INTEGRASI OTOMASI SISTEM" : "SYSTEM AUTOMATION INTEGRATION"}
          </p>
          <h3
            className="text-[17px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Pencatatan Otomatis Pintasan" : "Automated Shortcuts Logging"}
          </h3>
        </div>

        {/* Platform Selector Pill (iOS vs Android) */}
        <div
          className="w-full flex items-center gap-1 p-1 rounded-full mb-3 border transition-colors"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
          }}
        >
          <button
            type="button"
            onClick={() => handlePlatformChange("ios")}
            className="flex-1 py-1.5 px-3 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            style={{
              background:
                platform === "ios"
                  ? isDark
                    ? "rgba(255, 255, 255, 0.14)"
                    : "#ffffff"
                  : "transparent",
              color:
                platform === "ios"
                  ? "var(--text-primary)"
                  : isDark
                  ? "rgba(255, 255, 255, 0.45)"
                  : "rgba(0, 0, 0, 0.45)",
              boxShadow:
                platform === "ios"
                  ? isDark
                    ? "0 2px 8px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.2)"
                    : "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)"
                  : "none",
            }}
          >
            <Smartphone size={12} strokeWidth={2} />
            <span>{isIndonesian ? "iOS (Pintasan Apple)" : "iOS (Apple Shortcuts)"}</span>
          </button>
          <button
            type="button"
            onClick={() => handlePlatformChange("android")}
            className="flex-1 py-1.5 px-3 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            style={{
              background:
                platform === "android"
                  ? isDark
                    ? "rgba(255, 255, 255, 0.14)"
                    : "#ffffff"
                  : "transparent",
              color:
                platform === "android"
                  ? "var(--text-primary)"
                  : isDark
                  ? "rgba(255, 255, 255, 0.45)"
                  : "rgba(0, 0, 0, 0.45)",
              boxShadow:
                platform === "android"
                  ? isDark
                    ? "0 2px 8px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.2)"
                    : "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)"
                  : "none",
            }}
          >
            <Zap size={12} strokeWidth={2} />
            <span>{isIndonesian ? "Android (MacroDroid)" : "Android (MacroDroid)"}</span>
          </button>
        </div>

        {/* iOS Sub-modes Segmented Control */}
        {platform === "ios" ? (
          <div
            className="w-full flex items-center gap-1 p-1 rounded-full mb-3.5 border transition-colors overflow-x-auto no-scrollbar"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
            }}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className="flex-1 min-w-[58px] py-1.5 px-2 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    background: isActive
                      ? isDark
                        ? "rgba(255, 255, 255, 0.14)"
                        : "#ffffff"
                      : "transparent",
                    color: isActive
                      ? "var(--text-primary)"
                      : isDark
                      ? "rgba(255, 255, 255, 0.45)"
                      : "rgba(0, 0, 0, 0.45)",
                    boxShadow: isActive
                      ? isDark
                        ? "0 2px 8px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.2)"
                        : "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)"
                      : "none",
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className="w-full py-1.5 px-3 rounded-full mb-3.5 border text-center text-[11px] font-medium transition-colors"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)",
              color: "var(--text-secondary)",
            }}
          >
            {isIndonesian
              ? "Pembaca Notifikasi m-Banking & E-Wallet Otomatis"
              : "Automated Bank & E-Wallet Notification Reader"}
          </div>
        )}

        {/* 1. Apple Studio Stage (Luxury Phone Carousel - Light & Dark adaptive) */}
        <div
          className="relative w-full rounded-[26px] p-3.5 flex flex-col items-center justify-center mb-3 overflow-hidden border transition-all"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            touchAction: "pan-y",
            background: isDark
              ? "linear-gradient(180deg, #18181c 0%, #121215 50%, #0c0c0f 100%)"
              : "linear-gradient(180deg, #f5f5f7 0%, #ebebef 50%, #e2e2e7 100%)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
            boxShadow: isDark
              ? "inset 0 1px 1px rgba(255,255,255,0.1), 0 12px 32px rgba(0,0,0,0.6)"
              : "inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          {/* Ambient Studio Light Reflection */}
          <div
            style={{
              position: "absolute",
              top: -50,
              left: "50%",
              transform: "translateX(-50%)",
              width: 240,
              height: 130,
              background: isDark
                ? "radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)"
                : "radial-gradient(ellipse, rgba(255,255,255,0.85) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* iPhone 16 Pro Mockup Chassis */}
          <div
            style={{
              width: 204,
              height: 380,
              borderRadius: 40,
              padding: 3,
              background: "linear-gradient(150deg, #3a3a40 0%, #1a1a1d 35%, #18181b 65%, #34343a 100%)",
              boxShadow: isDark
                ? "0 16px 40px -10px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.15), 0 0 0 2px #09090c"
                : "0 18px 38px -10px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.15), 0 0 0 2px #d4d4d8",
              position: "relative",
            }}
          >
            {/* Flush Micro Side Buttons */}
            <div style={{ position: "absolute", left: -2.5, top: 68, width: 2.5, height: 18, borderRadius: "2px 0 0 2px", background: "#2f2f35" }} />
            <div style={{ position: "absolute", left: -2.5, top: 96, width: 2.5, height: 32, borderRadius: "2px 0 0 2px", background: "#2f2f35" }} />
            <div style={{ position: "absolute", left: -2.5, top: 136, width: 2.5, height: 32, borderRadius: "2px 0 0 2px", background: "#2f2f35" }} />
            <div style={{ position: "absolute", right: -2.5, top: 108, width: 2.5, height: 48, borderRadius: "0 2px 2px 0", background: "#2f2f35" }} />

            {/* OLED Screen Surface - With Strict Radial Hardware Mask to prevent any corner leak */}
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 37,
                background: "#000000",
                overflow: "hidden",
                position: "relative",
                WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                maskImage: "radial-gradient(white, black)",
                isolation: "isolate",
                contain: "paint",
                transform: "translateZ(0)",
              }}
            >
              {/* Dynamic Island / Android Punch Hole */}
              {platform === "ios" ? (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 72,
                    height: 20,
                    borderRadius: 999,
                    background: "#000000",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                    zIndex: 35,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 6px",
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#08080a" }} />
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#090e1c", border: "0.5px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#020408" }} />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    position: "absolute",
                    top: 7,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#050508",
                    border: "0.5px solid rgba(255,255,255,0.12)",
                    zIndex: 35,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#000000" }} />
                </div>
              )}

              {/* Status Bar */}
              <div
                style={{
                  position: "absolute",
                  top: 9,
                  left: 0,
                  right: 0,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 15px",
                  zIndex: 30,
                  fontSize: 9,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                <span>09.33</span>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 8 }}>
                    <div style={{ width: 1.5, height: 2.5, background: "white", borderRadius: 0.5 }} />
                    <div style={{ width: 1.5, height: 4.5, background: "white", borderRadius: 0.5 }} />
                    <div style={{ width: 1.5, height: 6.5, background: "white", borderRadius: 0.5 }} />
                    <div style={{ width: 1.5, height: 8, background: "white", borderRadius: 0.5 }} />
                  </div>
                  <svg width="9" height="7" viewBox="0 0 24 24" fill="white">
                    <path d="M1.3 5.1A19.5 19.5 0 0 1 22.7 5.1M5.5 9.4A13 13 0 0 1 18.5 9.4M9.7 13.7A6.5 6.5 0 0 1 14.3 13.7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <circle cx="12" cy="18" r="1.5" fill="white" />
                  </svg>
                  <div style={{ width: 16, height: 8.5, borderRadius: 2.5, border: "1px solid rgba(255,255,255,0.45)", padding: 1, display: "flex" }}>
                    <div style={{ width: "75%", height: "100%", background: "#ffffff", borderRadius: 1 }} />
                  </div>
                </div>
              </div>

              {/* ================= SLIDE SCREENS ================= */}
              {platform === "ios" ? (
                <>

              {/* --- TAB 1: PINDAI LAYAR (SCREEN SCANNER OCR) --- */}

              {/* PINDAI - SLIDE 0: PAYMENT RECEIPT SHOWCASE + BACK TAP OCR */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "36px 9px 12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 37,
                  overflow: "hidden",
                  background: "radial-gradient(circle at 50% 20%, #1e1b2e 0%, #09090d 80%)",
                  opacity: activeTab === "pindai" && currentSlide === 0 ? 1 : 0,
                  pointerEvents: activeTab === "pindai" && currentSlide === 0 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "pindai" && currentSlide === 0 ? "scale(1)" : "scale(0.97)",
                }}
              >
                {/* Back Tap Toast Capsule */}
                <div
                  style={{
                    padding: "4.5px 8px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={7.5} className="text-black fill-black" />
                    </div>
                    <span style={{ fontSize: 7, fontWeight: 600, color: "white" }}>
                      {isIndonesian ? "Ketuk 2x Belakang Terdeteksi" : "Back Tap Detected"}
                    </span>
                  </div>
                  <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>Live Text OCR</span>
                </div>

                {/* Realistic Payment Receipt Card */}
                <div
                  style={{
                    background: "rgba(24,24,30,0.85)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 16,
                    padding: "10px 10px 8px",
                    textAlign: "center",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.1)", margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Coffee size={14} className="text-white" />
                  </div>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: "white", marginBottom: 1 }}>
                    Kopi Kenangan
                  </p>
                  <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
                    {isIndonesian ? "Pembayaran QRIS Berhasil" : "QRIS Payment Successful"}
                  </p>

                  <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", letterSpacing: -0.5, marginBottom: 6 }}>
                    Rp 75.000
                  </div>

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 5, display: "flex", flexDirection: "column", gap: 2.5, textAlign: "left", fontSize: 6.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>{isIndonesian ? "Waktu" : "Time"}</span>
                      <span style={{ color: "white", fontWeight: 600 }}>09:33</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>{isIndonesian ? "Rekening" : "Account"}</span>
                      <span style={{ color: "white", fontWeight: 600 }}>BCA - 8820****</span>
                    </div>
                  </div>
                </div>

                {/* Trouvaille Auto-Save Toast Banner */}
                <div
                  style={{
                    background: "rgba(18,18,22,0.96)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    borderRadius: 14,
                    padding: "6px 8px",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <Sparkles size={8} className="text-white" />
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: "white" }}>
                      Accrual • {isIndonesian ? "Tercatat Otomatis ✓" : "Auto Logged ✓"}
                    </span>
                  </div>
                  <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.6)" }}>
                    Rp 75.000 • {isIndonesian ? "Makanan • BCA" : "Food • BCA"}
                  </p>
                </div>
              </div>

              {/* PINDAI - SLIDE 1: SCREENSHOT & LIVE TEXT OCR ACTIONS */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "pindai" && currentSlide === 1 ? 1 : 0,
                  pointerEvents: activeTab === "pindai" && currentSlide === 1 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "pindai" && currentSlide === 1 ? "scale(1)" : "scale(0.97)",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={10} strokeWidth={2.5} />
                  </div>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ScanLine size={9} className="text-white" />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Pindai Resi" : "Scan Receipt"}
                  </span>
                  <div style={{ marginLeft: "auto", width: 14, height: 14, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "rgba(255,255,255,0.6)" }}>
                    •••
                  </div>
                </div>

                {/* Action 1: Take Screenshot */}
                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "6px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 15, height: 15, borderRadius: 4, background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Camera size={8} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 600, color: "white" }}>Take Screenshot</span>
                    <span style={{ marginLeft: "auto", fontSize: 6.5, color: "rgba(255,255,255,0.4)" }}>➔ Screenshot</span>
                  </div>
                </div>

                {/* Connection Line */}
                <div style={{ width: 1.5, height: 6, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Action 2: Extract Text from Image */}
                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "7px 8px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 15, height: 15, borderRadius: 4, background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={8} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7.5, fontWeight: 600, color: "white" }}>Extract Text from</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 4, padding: "1px 4px", fontSize: 7, fontWeight: 600 }}>
                      Screenshot
                    </span>
                  </div>
                </div>

                {/* Shortcuts Bottom Search Dock */}
                <div style={{ marginTop: "auto", background: "rgba(28,28,32,0.95)", borderRadius: 18, padding: "6px 9px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 8 }}>
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "3px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.45)" }}>{isIndonesian ? "Cari Tindakan" : "Search Actions"}</span>
                    <Search size={8} strokeWidth={2} className="text-white/45" />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-around", fontSize: 8, color: "rgba(255,255,255,0.65)" }}>
                    <RotateCcw size={9} strokeWidth={2} />
                    <span style={{ transform: "scaleX(-1)", display: "inline-block" }}><RotateCcw size={9} strokeWidth={2} /></span>
                    <span style={{ fontSize: 8 }}>ⓘ</span>
                    <Play size={9} strokeWidth={2.5} className="text-[#007aff] fill-[#007aff]" />
                  </div>
                </div>
              </div>

              {/* PINDAI - SLIDE 2: URL ENCODE & OPEN URLS */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "pindai" && currentSlide === 2 ? 1 : 0,
                  pointerEvents: activeTab === "pindai" && currentSlide === 2 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "pindai" && currentSlide === 2 ? "scale(1)" : "scale(0.97)",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={10} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Pindai Resi" : "Scan Receipt"}
                  </span>
                </div>

                {/* Preceding Actions (Dimmed Chain) */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", padding: "4px 7px", opacity: 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={6.5} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7, fontWeight: 600, color: "white" }}>Extract Text</span>
                    <span style={{ marginLeft: "auto", fontSize: 6, color: "rgba(255,255,255,0.4)" }}>➔ Text</span>
                  </div>
                </div>

                {/* Connection Line */}
                <div style={{ width: 1.5, height: 6, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Action 3: URL Encode */}
                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "6px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3.5 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <LinkIcon size={7} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7.5, fontWeight: 600, color: "white" }}>URL Encode</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 4, padding: "1px 4px", fontSize: 7, fontWeight: 600 }}>
                      Text
                    </span>
                  </div>
                </div>

                {/* Connection Line */}
                <div style={{ width: 1.5, height: 6, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Action 4: Open URLs */}
                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "6px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}>
                    <div style={{ width: 13, height: 13, borderRadius: 3, background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ExternalLink size={7} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7.5, fontWeight: 600, color: "white" }}>Open</span>
                  </div>
                  <div style={{ background: "#18181a", borderRadius: 6, padding: "4px 6px", fontSize: 6.5, lineHeight: 1.5, wordBreak: "break-all" }}>
                    <span style={{ color: "#2997ff" }}>accrual://add?text=</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 3, padding: "0 3px" }}>
                      URL Encoded Text
                    </span>
                    <span style={{ color: "#2997ff" }}>&autosave=true</span>
                  </div>
                </div>

                {/* Shortcuts Bottom Search Dock */}
                <div style={{ marginTop: "auto", background: "rgba(28,28,32,0.95)", borderRadius: 18, padding: "6px 9px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 8 }}>
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "3px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.45)" }}>{isIndonesian ? "Cari Tindakan" : "Search Actions"}</span>
                    <Search size={8} strokeWidth={2} className="text-white/45" />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-around", fontSize: 8, color: "rgba(255,255,255,0.65)" }}>
                    <RotateCcw size={9} strokeWidth={2} />
                    <span style={{ transform: "scaleX(-1)", display: "inline-block" }}><RotateCcw size={9} strokeWidth={2} /></span>
                    <span style={{ fontSize: 8 }}>ⓘ</span>
                    <Play size={9} strokeWidth={2.5} className="text-[#007aff] fill-[#007aff]" />
                  </div>
                </div>
              </div>

              {/* PINDAI - SLIDE 3: SETTINGS LINK TO BACK TAP */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "pindai" && currentSlide === 3 ? 1 : 0,
                  pointerEvents: activeTab === "pindai" && currentSlide === 3 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "pindai" && currentSlide === 3 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 4 }}>
                  <span style={{ fontSize: 8, color: "#007aff", fontWeight: 500 }}>
                    {isIndonesian ? "‹ Sentuh" : "‹ Touch"}
                  </span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: "white", marginLeft: "auto", marginRight: "auto" }}>
                    {isIndonesian ? "Ketuk Dua Kali" : "Double Tap"}
                  </span>
                </div>

                <div style={{ background: "#1c1c1e", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 6.5, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                    {isIndonesian ? "Sistem" : "System"}
                  </div>
                  <div style={{ padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 7.5, color: "rgba(255,255,255,0.7)" }}>
                    {isIndonesian ? "Jepretan Layar" : "Screenshot"}
                  </div>
                  <div style={{ padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 6.5, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginTop: 2 }}>
                    Shortcuts
                  </div>
                  <div style={{ padding: "6px 8px", background: "rgba(0,122,255,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: "#60a5fa" }}>
                      {isIndonesian ? "Pindai Resi" : "Scan Receipt"}
                    </span>
                    <Check size={9} strokeWidth={3} className="text-[#007aff]" />
                  </div>
                </div>
              </div>

              {/* --- TAB 2: NOTIFIKASI BANK (NOTIFICATION READER) --- */}

              {/* NOTIFIKASI - SLIDE 0: LOCK SCREEN PUSH + AUTO LOG SHOWCASE */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "36px 9px 12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 37,
                  overflow: "hidden",
                  background: "radial-gradient(circle at 50% 25%, #182236 0%, #080a0f 85%)",
                  opacity: activeTab === "notifikasi" && currentSlide === 0 ? 1 : 0,
                  pointerEvents: activeTab === "notifikasi" && currentSlide === 0 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "notifikasi" && currentSlide === 0 ? "scale(1)" : "scale(0.97)",
                }}
              >
                {/* Big Lockscreen Clock */}
                <div style={{ textAlign: "center", marginTop: 2 }}>
                  <p style={{ fontSize: 7, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                    {isIndonesian ? "Kamis, 27 September" : "Thursday, September 27"}
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 300, color: "white", letterSpacing: -1, lineHeight: 1.1 }}>
                    09:33
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                  {/* Bank Notification Banner */}
                  <div
                    style={{
                      background: "rgba(28,28,34,0.92)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 14,
                      padding: "7px 8px",
                      backdropFilter: "blur(20px)",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 13, height: 13, borderRadius: 3, background: "#0056b3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 6.5, fontWeight: 800, color: "white" }}>B</span>
                        </div>
                        <span style={{ fontSize: 7.5, fontWeight: 700, color: "white" }}>BCA Mobile</span>
                      </div>
                      <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>
                        {isIndonesian ? "Sekarang" : "Now"}
                      </span>
                    </div>
                    <p style={{ fontSize: 7, color: "rgba(255,255,255,0.85)", lineHeight: 1.3 }}>
                      {isIndonesian
                        ? "Pembayaran QRIS Rp 45.000 di RM Padang Sederhana berhasil."
                        : "QRIS Payment Rp 45,000 at RM Sederhana successful."}
                    </p>
                  </div>

                  {/* Trouvaille Auto-Log Capsule */}
                  <div
                    style={{
                      background: "rgba(18,18,22,0.96)",
                      border: "1px solid rgba(255,255,255,0.16)",
                      borderRadius: 13,
                      padding: "6px 8px",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 3.5, marginBottom: 2 }}>
                      <Sparkles size={8} className="text-white" />
                      <span style={{ fontSize: 7.5, fontWeight: 700, color: "white" }}>
                        Accrual • {isIndonesian ? "Notifikasi Terproses ✓" : "Notification Processed ✓"}
                      </span>
                    </div>
                    <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.6)" }}>
                      {isIndonesian ? "Tercatat: Rp 45.000 • Makanan • BCA" : "Logged: Rp 45,000 • Food • BCA"}
                    </p>
                  </div>
                </div>
              </div>

              {/* NOTIFIKASI - SLIDE 1: AUTOMATIONS TRIGGER */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "notifikasi" && currentSlide === 1 ? 1 : 0,
                  pointerEvents: activeTab === "notifikasi" && currentSlide === 1 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "notifikasi" && currentSlide === 1 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 4 }}>
                  <span style={{ fontSize: 8, color: "#007aff", fontWeight: 500 }}>‹ Automasi</span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: "white", marginLeft: "auto", marginRight: "auto" }}>
                    {isIndonesian ? "Automasi Baru" : "New Automation"}
                  </span>
                </div>

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "7px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Bell size={10} className="text-white" />
                    </div>
                    <div>
                      <p style={{ fontSize: 8, fontWeight: 700, color: "white" }}>
                        {isIndonesian ? "Ketika Menerima Notifikasi" : "When Receiving Notification"}
                      </p>
                      <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>
                        BCA, Livin, GoPay
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ background: "#1c1c1e", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "6px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 7.5, color: "white", fontWeight: 600 }}>
                      {isIndonesian ? "Jalankan Segera" : "Run Immediately"}
                    </span>
                    <div style={{ width: 22, height: 12, borderRadius: 999, background: "#34c759", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: 1.5 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: "white" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.6)" }}>
                      {isIndonesian ? "Beri Tahu Saat Dijalankan" : "Notify When Run"}
                    </span>
                    <div style={{ width: 22, height: 12, borderRadius: 999, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", padding: 1.5 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: "white" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* NOTIFIKASI - SLIDE 2: AUTOMATION ACTIONS */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "notifikasi" && currentSlide === 2 ? 1 : 0,
                  pointerEvents: activeTab === "notifikasi" && currentSlide === 2 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "notifikasi" && currentSlide === 2 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={10} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Tindakan Automasi" : "Automation Actions"}
                  </span>
                </div>

                {/* Preceding Trigger (Dimmed Chain) */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", padding: "4px 7px", opacity: 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3.5 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Bell size={6.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7, fontWeight: 600, color: "white" }}>
                      {isIndonesian ? "Notifikasi Diterima" : "Notification Received"}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 6, color: "rgba(255,255,255,0.4)" }}>➔ Input</span>
                  </div>
                </div>

                {/* Connection Line */}
                <div style={{ width: 1.5, height: 6, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Action 1: URL Encode */}
                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "6px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3.5 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <LinkIcon size={7} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7.5, fontWeight: 600, color: "white" }}>URL Encode</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 4, padding: "1px 4px", fontSize: 7, fontWeight: 600 }}>
                      Shortcut Input
                    </span>
                  </div>
                </div>

                {/* Connection Line */}
                <div style={{ width: 1.5, height: 6, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Action 2: Open URLs */}
                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "6px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}>
                    <div style={{ width: 13, height: 13, borderRadius: 3, background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ExternalLink size={7} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7.5, fontWeight: 600, color: "white" }}>Open</span>
                  </div>
                  <div style={{ background: "#18181a", borderRadius: 6, padding: "4px 6px", fontSize: 6.5, lineHeight: 1.5, wordBreak: "break-all" }}>
                    <span style={{ color: "#2997ff" }}>accrual://add?text=</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 3, padding: "0 3px" }}>
                      URL Encoded Text
                    </span>
                    <span style={{ color: "#2997ff" }}>&autosave=true</span>
                  </div>
                </div>
              </div>

              {/* NOTIFIKASI - SLIDE 3: ACTIVE SILENT AUTOMATION */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "notifikasi" && currentSlide === 3 ? 1 : 0,
                  pointerEvents: activeTab === "notifikasi" && currentSlide === 3 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "notifikasi" && currentSlide === 3 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Automasi" : "Automation"}
                  </span>
                  <span style={{ fontSize: 11, color: "#007aff", fontWeight: 600 }}>+</span>
                </div>

                <div style={{ background: "#1c1c1e", borderRadius: 13, border: "1px solid rgba(255,255,255,0.08)", padding: "8px 9px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Bell size={10} className="text-white" />
                    </div>
                    <div>
                      <p style={{ fontSize: 8, fontWeight: 700, color: "white" }}>
                        {isIndonesian ? "Saat Notifikasi Bank Masuk" : "When Bank Notification Arrives"}
                      </p>
                      <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>
                        {isIndonesian ? "Buka URL di Accrual" : "Open URLs in Accrual"}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.18)" }}>
                    <Check size={7} className="text-white" />
                    <span style={{ fontSize: 6.5, fontWeight: 600, color: "white" }}>
                      {isIndonesian ? "Jalankan Segera • Aktif" : "Run Immediately • Active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* --- TAB 3: INSTAN (QUICK ADD KEYPAD SHEET) --- */}

              {/* INSTAN - SLIDE 0: QUICK ADD SHEET SHOWCASE */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "36px 0 0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  height: "100%",
                  borderRadius: 37,
                  overflow: "hidden",
                  background: "radial-gradient(circle at 50% 25%, #1d1d24 0%, #08080a 75%)",
                  opacity: activeTab === "instan" && currentSlide === 0 ? 1 : 0,
                  pointerEvents: activeTab === "instan" && currentSlide === 0 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "instan" && currentSlide === 0 ? "scale(1)" : "scale(0.97)",
                }}
              >
                {/* Back Tap Capsule Toast */}
                <div
                  style={{
                    margin: "0 14px 6px",
                    padding: "4.5px 8px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.07)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={7.5} className="text-black fill-black" />
                    </div>
                    <span style={{ fontSize: 7, fontWeight: 600, color: "white" }}>
                      {isIndonesian ? "Ketuk 2x Belakang Terdeteksi" : "Back Tap Detected"}
                    </span>
                  </div>
                  <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>Accrual</span>
                </div>

                {/* Bottom Keypad Sheet */}
                <div
                  style={{
                    background: "rgba(18,18,22,0.98)",
                    borderTop: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: "18px 18px 34px 34px",
                    padding: "5px 12px 14px",
                    boxShadow: "0 -8px 25px rgba(0,0,0,0.8)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ width: 20, height: 2, background: "rgba(255,255,255,0.25)", borderRadius: 999, margin: "0 auto 4px" }} />
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                      {isIndonesian ? "PENGELUARAN" : "EXPENSE"}
                    </span>
                    <span style={{ fontSize: 6.5, fontWeight: 600, color: "white", background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 4 }}>
                      Cash
                    </span>
                  </div>

                  <div style={{ marginBottom: 3, textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                      <span style={{ fontSize: 8.5, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>Rp</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.5px" }}>50.000</span>
                      <span style={{ width: 1.5, height: 12, background: "#ffffff", display: "inline-block", marginLeft: 2 }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 3, marginBottom: 5 }}>
                    <span style={{ fontSize: 6.5, padding: "1.5px 5px", borderRadius: 4, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.25)", color: "white", fontWeight: 600 }}>
                      Makanan
                    </span>
                    <span style={{ fontSize: 6.5, padding: "1.5px 5px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)" }}>
                      Transport
                    </span>
                    <span style={{ fontSize: 6.5, padding: "1.5px 5px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)" }}>
                      Kopi
                    </span>
                  </div>

                  {/* Compact keypad */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", justifyItems: "center", gap: "3px 4px", marginBottom: 5 }}>
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
                      <div
                        key={k}
                        style={{
                          width: 25,
                          height: 25,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.09)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: k === "." ? 11 : k === "⌫" ? 8 : 10,
                          fontWeight: 600,
                          color: "#ffffff",
                        }}
                      >
                        {k}
                      </div>
                    ))}
                  </div>

                  <div style={{ background: "#ffffff", color: "#000000", borderRadius: 7, padding: "4px 0", textAlign: "center", fontSize: 7.5, fontWeight: 700, marginBottom: 3 }}>
                    {isIndonesian ? "Simpan Transaksi" : "Save Transaction"}
                  </div>
                </div>
              </div>

              {/* INSTAN - SLIDE 1: SHORTCUTS 'OPEN URL' SCREEN */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "instan" && currentSlide === 1 ? 1 : 0,
                  pointerEvents: activeTab === "instan" && currentSlide === 1 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "instan" && currentSlide === 1 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={10} strokeWidth={2.5} />
                  </div>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: "#3d7af5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sparkles size={9} className="text-white fill-white" />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white", letterSpacing: -0.2 }}>
                    {isIndonesian ? "Catat Pengeluaran" : "Log Expense"}
                  </span>
                  <div style={{ marginLeft: "auto", width: 14, height: 14, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "rgba(255,255,255,0.6)" }}>
                    •••
                  </div>
                </div>

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "7px 9px", boxShadow: "0 3px 10px rgba(0,0,0,0.35)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 15, height: 15, borderRadius: 4, background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ExternalLink size={9} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 8.5, fontWeight: 600, color: "white" }}>Open</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 5, padding: "1.5px 5px", fontSize: 8, fontWeight: 600 }}>
                      accrual://add
                    </span>
                    <div style={{ marginLeft: "auto", width: 13, height: 13, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "rgba(255,255,255,0.5)" }}>
                      ✕
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "auto", background: "rgba(28,28,32,0.95)", borderRadius: 18, padding: "6px 9px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 10 }}>
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "3px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.45)" }}>{isIndonesian ? "Cari Tindakan" : "Search Actions"}</span>
                    <Search size={8} strokeWidth={2} className="text-white/45" />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-around", fontSize: 8, color: "rgba(255,255,255,0.65)" }}>
                    <RotateCcw size={9} strokeWidth={2} />
                    <span style={{ transform: "scaleX(-1)", display: "inline-block" }}><RotateCcw size={9} strokeWidth={2} /></span>
                    <span style={{ fontSize: 8 }}>ⓘ</span>
                    <Play size={9} strokeWidth={2.5} className="text-[#007aff] fill-[#007aff]" />
                  </div>
                </div>
              </div>

              {/* INSTAN - SLIDE 2: SETTINGS BACK TAP SCREEN */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "instan" && currentSlide === 2 ? 1 : 0,
                  pointerEvents: activeTab === "instan" && currentSlide === 2 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "instan" && currentSlide === 2 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 4 }}>
                  <span style={{ fontSize: 8, color: "#007aff", fontWeight: 500 }}>
                    {isIndonesian ? "‹ Sentuh" : "‹ Touch"}
                  </span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: "white", marginLeft: "auto", marginRight: "auto" }}>
                    {isIndonesian ? "Ketuk Dua Kali" : "Double Tap"}
                  </span>
                </div>

                <div style={{ background: "#1c1c1e", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 6.5, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                    {isIndonesian ? "Sistem" : "System"}
                  </div>
                  <div style={{ padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 7.5, color: "rgba(255,255,255,0.7)" }}>
                    {isIndonesian ? "Jepretan Layar" : "Screenshot"}
                  </div>
                  <div style={{ padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 6.5, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginTop: 3 }}>
                    Shortcuts
                  </div>
                  <div style={{ padding: "6px 8px", background: "rgba(0,122,255,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: "#60a5fa" }}>
                      {isIndonesian ? "Catat Pengeluaran" : "Log Expense"}
                    </span>
                    <Check size={9} strokeWidth={3} className="text-[#007aff]" />
                  </div>
                </div>
              </div>

              {/* --- TAB 4: SUARA (1-TAP VOICE QUICK ADD) --- */}

              {/* SUARA - SLIDE 0: VOICE QUICK ADD SHOWCASE */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "36px 9px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "suara" && currentSlide === 0 ? 1 : 0,
                  pointerEvents: activeTab === "suara" && currentSlide === 0 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "suara" && currentSlide === 0 ? "scale(1)" : "scale(0.97)",
                }}
              >
                {/* Voice Listening Waveform Card */}
                <div style={{ background: "rgba(28,28,34,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "8px 9px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Mic size={8} strokeWidth={2.5} className="text-black" />
                      </div>
                      <span style={{ fontSize: 7.5, fontWeight: 700, color: "white" }}>
                        {isIndonesian ? "Mendengarkan..." : "Listening..."}
                      </span>
                    </div>
                    <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>Accrual Voice</span>
                  </div>
                  <p style={{ fontSize: 8.5, fontStyle: "italic", color: "white", fontWeight: 500, lineHeight: 1.3 }}>
                    "{isIndonesian ? "Kopi susu 25 ribu bayar pakai BCA" : "Iced coffee 25 thousand paid with BCA"}"
                  </p>
                </div>

                {/* Parsed Result Capsule */}
                <div style={{ background: "rgba(18,18,22,0.96)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: "white", display: "block", marginBottom: 4 }}>
                    Accrual NLP
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5px 5px", borderRadius: 4, background: "rgba(255,255,255,0.04)", fontSize: 7 }}>
                      <span style={{ color: "rgba(255,255,255,0.45)" }}>{isIndonesian ? "Nominal" : "Amount"}</span>
                      <span style={{ fontWeight: 700, color: "white" }}>Rp 25.000</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5px 5px", borderRadius: 4, background: "rgba(255,255,255,0.04)", fontSize: 7 }}>
                      <span style={{ color: "rgba(255,255,255,0.45)" }}>{isIndonesian ? "Kategori" : "Category"}</span>
                      <span style={{ fontWeight: 700, color: "white" }}>Makanan</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5px 5px", borderRadius: 4, background: "rgba(255,255,255,0.04)", fontSize: 7 }}>
                      <span style={{ color: "rgba(255,255,255,0.45)" }}>{isIndonesian ? "Akun" : "Account"}</span>
                      <span style={{ fontWeight: 700, color: "white" }}>BCA</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 5, padding: 3.5, borderRadius: 6, background: "rgba(255,255,255,0.1)", textAlign: "center", fontSize: 7, fontWeight: 600, color: "white" }}>
                    {isIndonesian ? "Tersimpan Otomatis ✓" : "Saved Automatically ✓"}
                  </div>
                </div>
              </div>

              {/* SUARA - SLIDE 1: SHORTCUTS 'OPEN URL' SCREEN */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "suara" && currentSlide === 1 ? 1 : 0,
                  pointerEvents: activeTab === "suara" && currentSlide === 1 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "suara" && currentSlide === 1 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={10} strokeWidth={2.5} />
                  </div>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Mic size={9} className="text-white" />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white", letterSpacing: -0.2 }}>
                    {isIndonesian ? "Catat Suara" : "Log Voice"}
                  </span>
                  <div style={{ marginLeft: "auto", width: 14, height: 14, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "rgba(255,255,255,0.6)" }}>
                    •••
                  </div>
                </div>

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "7px 9px", boxShadow: "0 3px 10px rgba(0,0,0,0.35)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 15, height: 15, borderRadius: 4, background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ExternalLink size={9} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 8.5, fontWeight: 600, color: "white" }}>Open</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 5, padding: "1.5px 5px", fontSize: 8, fontWeight: 600 }}>
                      accrual://voice
                    </span>
                    <div style={{ marginLeft: "auto", width: 13, height: 13, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "rgba(255,255,255,0.5)" }}>
                      ✕
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "auto", background: "rgba(28,28,32,0.95)", borderRadius: 18, padding: "6px 9px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 10 }}>
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "3px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.45)" }}>{isIndonesian ? "Cari Tindakan" : "Search Actions"}</span>
                    <Search size={8} strokeWidth={2} className="text-white/45" />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-around", fontSize: 8, color: "rgba(255,255,255,0.65)" }}>
                    <RotateCcw size={9} strokeWidth={2} />
                    <span style={{ transform: "scaleX(-1)", display: "inline-block" }}><RotateCcw size={9} strokeWidth={2} /></span>
                    <span style={{ fontSize: 8 }}>ⓘ</span>
                    <Play size={9} strokeWidth={2.5} className="text-[#007aff] fill-[#007aff]" />
                  </div>
                </div>
              </div>

              {/* SUARA - SLIDE 2: SETTINGS BACK TAP / ACTION BUTTON SCREEN */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "suara" && currentSlide === 2 ? 1 : 0,
                  pointerEvents: activeTab === "suara" && currentSlide === 2 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "suara" && currentSlide === 2 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 4 }}>
                  <span style={{ fontSize: 8, color: "#007aff", fontWeight: 500 }}>
                    {isIndonesian ? "‹ Tindakan" : "‹ Action"}
                  </span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: "white", marginLeft: "auto", marginRight: "auto" }}>
                    {isIndonesian ? "Tombol Tindakan" : "Action Button"}
                  </span>
                </div>

                <div style={{ background: "#1c1c1e", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 6.5, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                    Shortcuts
                  </div>
                  <div style={{ padding: "6px 8px", background: "rgba(0,122,255,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: "#60a5fa" }}>
                      {isIndonesian ? "Catat Suara" : "Log Voice"}
                    </span>
                    <Check size={9} strokeWidth={3} className="text-[#007aff]" />
                  </div>
                  <div style={{ padding: "5px 8px", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 7.5, color: "rgba(255,255,255,0.5)" }}>
                    {isIndonesian ? "Catat Pengeluaran" : "Log Expense"}
                  </div>
                </div>
              </div>

              {/* --- TAB 5: DIALOG POP-UPS ASLI IOS --- */}

              {/* DIALOG - SLIDE 0: NATIVE DIALOG SHOWCASE */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "36px 9px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "dialog" && currentSlide === 0 ? 1 : 0,
                  pointerEvents: activeTab === "dialog" && currentSlide === 0 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "dialog" && currentSlide === 0 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ background: "rgba(36,36,42,0.96)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 15, padding: 9 }}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: "white", marginBottom: 2 }}>
                    {isIndonesian ? "Berapa nominalnya?" : "How much was it?"}
                  </p>
                  <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>
                    {isIndonesian ? "Minta Masukan • Angka" : "Ask for Input • Number"}
                  </p>
                  <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "4px 7px", fontSize: 10, fontWeight: 700, color: "white", marginBottom: 6 }}>
                    50000
                  </div>
                  <div style={{ display: "flex", gap: 3.5 }}>
                    <div style={{ flex: 1, padding: "3.5px 0", borderRadius: 5, background: "rgba(255,255,255,0.08)", fontSize: 7.5, fontWeight: 600, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>
                      {isIndonesian ? "Batal" : "Cancel"}
                    </div>
                    <div style={{ flex: 1, padding: "3.5px 0", borderRadius: 5, background: "white", fontSize: 7.5, fontWeight: 700, color: "black", textAlign: "center" }}>
                      {isIndonesian ? "Selesai" : "Done"}
                    </div>
                  </div>
                </div>
                <div style={{ background: "rgba(24,24,28,0.92)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "6px 8px", marginBottom: 4 }}>
                  <p style={{ fontSize: 7.5, fontWeight: 700, color: "white" }}>
                    Accrual • {isIndonesian ? "Berhasil Disimpan" : "Saved Successfully"}
                  </p>
                  <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>
                    {isIndonesian ? "Rp 50.000 tersimpan hening" : "Rp 50,000 silently logged"}
                  </p>
                </div>
              </div>

              {/* DIALOG - SLIDE 1: NOMINAL */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "dialog" && currentSlide === 1 ? 1 : 0,
                  pointerEvents: activeTab === "dialog" && currentSlide === 1 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "dialog" && currentSlide === 1 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={10} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>Accrual Dialog</span>
                </div>

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "7px 9px", boxShadow: "0 3px 10px rgba(0,0,0,0.35)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3.5, fontSize: 8 }}>
                    <div style={{ width: 15, height: 15, borderRadius: 4, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MessageSquare size={7} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ color: "white", fontWeight: 600 }}>Ask for</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 5, padding: "1.5px 5px", fontSize: 8, fontWeight: 600 }}>
                      Number
                    </span>
                    <span style={{ color: "white", fontWeight: 600 }}>with</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 5, padding: "1.5px 5px", fontSize: 8, fontWeight: 600 }}>
                      {isIndonesian ? "Berapa nominalnya?" : "How much was it?"}
                    </span>
                  </div>
                  <p style={{ fontSize: 6.5, color: "#60a5fa", marginTop: 4, fontWeight: 600 }}>
                    ➔ Rename: <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 4, padding: "1px 4px", fontSize: 6.5 }}>Nominal</span>
                  </p>
                </div>
              </div>

              {/* DIALOG - SLIDE 2: KATEGORI */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "dialog" && currentSlide === 2 ? 1 : 0,
                  pointerEvents: activeTab === "dialog" && currentSlide === 2 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "dialog" && currentSlide === 2 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={9} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Pilihan Kategori" : "Categories"}
                  </span>
                </div>

                {/* Preceding Step 1: Nominal (Dimmed Chain) */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", padding: "3.5px 7px", opacity: 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2.5, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MessageSquare size={5.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 6.5, color: "white" }}>Ask for Number</span>
                    <span style={{ marginLeft: "auto", fontSize: 6, color: "#60a5fa" }}>➔ Nominal</span>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 5, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "5px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7.5, marginBottom: 2 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={6} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ color: "white", fontWeight: 600 }}>Text</span>
                  </div>
                  <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.2 }}>
                    {isIndonesian ? "Makanan\nTransport\nBelanja..." : "Food\nTransport\nShopping..."}
                  </p>
                </div>

                <div style={{ width: 1.5, height: 7, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "4px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Scissors size={6} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ color: "white" }}>Split</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 4, padding: "1px 3px", fontSize: 6.5 }}>Text</span>
                    <span style={{ color: "white" }}>by</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 4, padding: "1px 3px", fontSize: 6.5 }}>New Lines</span>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 7, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "4px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <List size={6} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ color: "white" }}>Choose from</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 4, padding: "1px 3px", fontSize: 6.5 }}>
                      {isIndonesian ? "Kategori" : "Category"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DIALOG - SLIDE 3: REKENING */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "dialog" && currentSlide === 3 ? 1 : 0,
                  pointerEvents: activeTab === "dialog" && currentSlide === 3 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "dialog" && currentSlide === 3 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={9} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Pilihan Akun" : "Account"}
                  </span>
                </div>

                {/* Preceding Step 2: Category (Dimmed Chain) */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", padding: "3.5px 7px", opacity: 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2.5, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <List size={5.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 6.5, color: "white" }}>Choose Category</span>
                    <span style={{ marginLeft: "auto", fontSize: 6, color: "#60a5fa" }}>➔ Kategori</span>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 5, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "5px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7.5, marginBottom: 2 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={6} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ color: "white", fontWeight: 600 }}>Text</span>
                  </div>
                  <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.2 }}>
                    {isIndonesian ? "Cash\nBCA\nMandiri..." : "Cash\nChecking\nCredit Card..."}
                  </p>
                </div>

                <div style={{ width: 1.5, height: 7, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "4px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <List size={6} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ color: "white" }}>Choose from</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 4, padding: "1px 3px", fontSize: 6.5 }}>
                      {isIndonesian ? "Akun" : "Account"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DIALOG - SLIDE 4: TANGGAL & WAKTU */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "dialog" && currentSlide === 4 ? 1 : 0,
                  pointerEvents: activeTab === "dialog" && currentSlide === 4 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "dialog" && currentSlide === 4 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={9} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Tanggal & Waktu Transaksi" : "Transaction Date & Time"}
                  </span>
                </div>

                {/* Preceding Step 3: Wallet (Dimmed Chain) */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", padding: "3.5px 7px", opacity: 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2.5, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <List size={5.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 6.5, color: "white" }}>{isIndonesian ? "Pilih Akun" : "Choose Account"}</span>
                    <span style={{ marginLeft: "auto", fontSize: 6, color: "#60a5fa" }}>➔ {isIndonesian ? "Akun" : "Account"}</span>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 6, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Ask for Input: Date and Time Action Card */}
                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "5px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7.5, marginBottom: 3 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Calendar size={7} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ color: "white", fontWeight: 600 }}>
                      {isIndonesian ? "Minta Masukan" : "Ask for Input"}
                    </span>
                    <span style={{ background: "#2e1065", border: "1px solid rgba(139,92,246,0.45)", color: "#c4b5fd", borderRadius: 4, padding: "1px 3px", fontSize: 6 }}>
                      {isIndonesian ? "Tanggal dan Waktu" : "Date and Time"}
                    </span>
                  </div>
                  <div style={{ background: "#18181a", borderRadius: 6, padding: "4px 6px", fontSize: 6.5, color: "rgba(255,255,255,0.85)" }}>
                    <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 1 }}>{isIndonesian ? "Pertanyaan" : "Prompt"}:</div>
                    <div style={{ fontStyle: "italic", color: "white" }}>"{isIndonesian ? "Kapan transaksi dilakukan?" : "When was this transaction?"}"</div>
                    <div style={{ marginTop: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 6 }}>{isIndonesian ? "Variabel" : "Variable"}:</span>
                      <span style={{ background: "#0f274a", color: "#2997ff", borderRadius: 3, padding: "0.5px 3px", fontSize: 6, fontWeight: 600 }}>➔ {isIndonesian ? "Tanggal" : "Date"}</span>
                    </div>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 6, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Next preview badge */}
                <div style={{ background: "#1c1c1e", borderRadius: 8, padding: "3.5px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.7 }}>
                  <span style={{ fontSize: 6, color: "rgba(255,255,255,0.7)" }}>{isIndonesian ? "Lanjut ke Catatan & Rangkai Teks" : "Proceed to Notes & Text Assembly"}</span>
                  <ChevronRight size={8} className="text-zinc-400" />
                </div>
              </div>

              {/* DIALOG - SLIDE 5: CATATAN & RANGKAI TEKS */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "dialog" && currentSlide === 5 ? 1 : 0,
                  pointerEvents: activeTab === "dialog" && currentSlide === 5 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "dialog" && currentSlide === 5 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={9} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Catatan & Format Teks" : "Notes & Format Text"}
                  </span>
                </div>

                {/* Preceding Step 4: Date & Time (Dimmed Chain) */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", padding: "3px 6px", opacity: 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Calendar size={5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 6, color: "white" }}>{isIndonesian ? "Tanggal & Waktu" : "Date & Time"}</span>
                    <span style={{ marginLeft: "auto", fontSize: 6, color: "#60a5fa" }}>➔ {isIndonesian ? "Tanggal" : "Date"}</span>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 4, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Ask for Input Text (Notes) */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: "4px 6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2.5, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MessageSquare size={5.5} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ color: "white" }}>Ask for Text</span>
                    <span style={{ color: "white", opacity: 0.6, fontSize: 6.5 }}>
                      {isIndonesian ? "(Catatan)" : "(Notes)"}
                    </span>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 4, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Text Block Assembling 5 Variables */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: "4px 6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2.5, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={5.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7, fontWeight: 600, color: "white" }}>Text</span>
                  </div>
                  <div style={{ background: "#18181a", borderRadius: 4, padding: "3px 4px", fontSize: 5.5, lineHeight: 1.35, color: "rgba(255,255,255,0.85)" }}>
                    <div>Nominal: <span style={{ background: "#0f274a", color: "#2997ff", borderRadius: 2, padding: "0 1.5px" }}>Nominal</span></div>
                    <div>{isIndonesian ? "Kategori" : "Category"}: <span style={{ background: "#0f274a", color: "#2997ff", borderRadius: 2, padding: "0 1.5px" }}>{isIndonesian ? "Kategori" : "Category"}</span></div>
                    <div>{isIndonesian ? "Akun" : "Account"}: <span style={{ background: "#0f274a", color: "#2997ff", borderRadius: 2, padding: "0 1.5px" }}>{isIndonesian ? "Akun" : "Account"}</span></div>
                    <div>{isIndonesian ? "Tanggal" : "Date"}: <span style={{ background: "#0f274a", color: "#2997ff", borderRadius: 2, padding: "0 1.5px" }}>{isIndonesian ? "Tanggal" : "Date"}</span></div>
                    <div>{isIndonesian ? "Catatan" : "Note"}: <span style={{ background: "#0f274a", color: "#2997ff", borderRadius: 2, padding: "0 1.5px" }}>{isIndonesian ? "Catatan" : "Notes"}</span></div>
                  </div>
                </div>
              </div>

              {/* DIALOG - SLIDE 6: URL SCHEME LENGKAP */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: activeTab === "dialog" && currentSlide === 6 ? 1 : 0,
                  pointerEvents: activeTab === "dialog" && currentSlide === 6 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: activeTab === "dialog" && currentSlide === 6 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={9} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Enkode URL & Buka Accrual" : "URL Encode & Open Accrual"}
                  </span>
                </div>

                {/* Preceding Text Chain (Dimmed) */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", padding: "3.5px 6px", opacity: 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 6 }}>
                    <span style={{ color: "rgba(255,255,255,0.7)" }}>{isIndonesian ? "Teks Transaksi Siap" : "Transaction Text Ready"}</span>
                    <span style={{ background: "#0f274a", color: "#2997ff", borderRadius: 2, padding: "0.5px 2px" }}>Text</span>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 4, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* URL Encode Action Block */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: "4px 6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2.5, background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <LinkIcon size={5.5} className="text-white" />
                    </div>
                    <span style={{ color: "white", fontWeight: 600 }}>URL Encode</span>
                    <span style={{ background: "#0f274a", color: "#2997ff", borderRadius: 2, padding: "0.5px 2px", fontSize: 6 }}>
                      {isIndonesian ? "Teks" : "Text"}
                    </span>
                  </div>
                </div>

                <div style={{ width: 1.5, height: 4, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Open URLs Action Block */}
                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "5px 6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2.5, background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ExternalLink size={5.5} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7, fontWeight: 600, color: "white" }}>Open</span>
                    <span style={{ fontSize: 6.5, color: "#2997ff" }}>accrual://add?</span>
                  </div>
                  
                  <div style={{ background: "#18181a", borderRadius: 4, padding: "3.5px 5px", fontSize: 6, lineHeight: 1.4, wordBreak: "break-all" }}>
                    <span style={{ color: "#2997ff" }}>text=</span><span style={{ background: "#0f274a", color: "#2997ff", borderRadius: 2, padding: "0 2px" }}>{isIndonesian ? "Teks Terenkode" : "URL Encoded Text"}</span>
                    <span style={{ color: "#2997ff" }}>&autosave=true</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* --- ANDROID SLIDE SCREENS --- */}
              {/* ANDROID - SLIDE 0: HERO BANK NOTIFICATION SHOWCASE */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "36px 9px 12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 37,
                  overflow: "hidden",
                  background: "radial-gradient(circle at 50% 20%, #151a24 0%, #090b10 80%)",
                  opacity: currentSlide === 0 ? 1 : 0,
                  pointerEvents: currentSlide === 0 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: currentSlide === 0 ? "scale(1)" : "scale(0.97)",
                }}
              >
                {/* MacroDroid Trigger Badge */}
                <div
                  style={{
                    padding: "4.5px 8px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={7.5} className="text-black fill-black" />
                    </div>
                    <span style={{ fontSize: 7, fontWeight: 600, color: "white" }}>
                      {isIndonesian ? "MacroDroid • Otomasi Aktif" : "MacroDroid • Active"}
                    </span>
                  </div>
                  <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>Android Intent</span>
                </div>

                {/* Realistic Android Bank Notification Card */}
                <div
                  style={{
                    background: "rgba(24,26,32,0.92)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 16,
                    padding: "10px 10px 8px",
                    textAlign: "left",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, background: "#0056b3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 7, fontWeight: 800, color: "white" }}>B</span>
                      </div>
                      <span style={{ fontSize: 8, fontWeight: 700, color: "white" }}>m-BCA</span>
                    </div>
                    <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>09:33</span>
                  </div>
                  <p style={{ fontSize: 7.5, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, marginBottom: 6 }}>
                    {isIndonesian
                      ? "Transfer berhasil ke REK 123456 Rp 50.000 untuk Kopi Kenangan"
                      : "Transfer Rp 50,000 to REK 123456 for Kopi Kenangan successful"}
                  </p>
                  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "3px 6px", fontSize: 6.5, color: "rgba(255,255,255,0.7)" }}>
                    {isIndonesian ? "Pemicu MacroDroid: Notifikasi Diterima" : "MacroDroid Trigger: Notification Received"}
                  </div>
                </div>

                {/* Accrual Auto-Review Banner */}
                <div
                  style={{
                    background: "rgba(18,18,22,0.96)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    borderRadius: 14,
                    padding: "6px 8px",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <Sparkles size={8} className="text-white" />
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: "white" }}>
                      Accrual • {isIndonesian ? "Siap Ditinjau 1-Ketukan ✓" : "1-Tap Review Ready ✓"}
                    </span>
                  </div>
                  <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.6)" }}>
                    Rp 50.000 • {isIndonesian ? "Kopi Kenangan • BCA" : "Kopi Kenangan • BCA"}
                  </p>
                </div>
              </div>

              {/* ANDROID - SLIDE 1: STEP 1 TRIGGER */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: currentSlide === 1 ? 1 : 0,
                  pointerEvents: currentSlide === 1 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: currentSlide === 1 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 4 }}>
                  <span style={{ fontSize: 8, color: "#38bdf8", fontWeight: 500 }}>‹ MacroDroid</span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: "white", marginLeft: "auto", marginRight: "auto" }}>
                    {isIndonesian ? "Makro Baru" : "New Macro"}
                  </span>
                </div>

                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "7px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Bell size={10} className="text-white" />
                    </div>
                    <div>
                      <p style={{ fontSize: 8, fontWeight: 700, color: "white" }}>
                        {isIndonesian ? "Pemicu: Notifikasi Diterima" : "Trigger: Notification Received"}
                      </p>
                      <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>
                        BCA, Livin, BRImo, Jago, wondr, GoPay
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ background: "#1c1c1e", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "6px 8px" }}>
                  <p style={{ fontSize: 7, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>
                    {isIndonesian
                      ? "Pilih aplikasi perbankan atau dompet digital yang ingin dipantau transaksinya."
                      : "Select the banking or e-wallet apps you want to monitor transactions from."}
                  </p>
                </div>
              </div>

              {/* ANDROID - SLIDE 2: STEP 2 OPEN URL ACTION */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: currentSlide === 2 ? 1 : 0,
                  pointerEvents: currentSlide === 2 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: currentSlide === 2 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <ChevronLeft size={10} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Tindakan Buka URL" : "Open URL Action"}
                  </span>
                </div>

                {/* Preceding Trigger (Dimmed Chain) */}
                <div style={{ background: "#242426", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", padding: "4px 7px", opacity: 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3.5 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Bell size={6.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7, fontWeight: 600, color: "white" }}>
                      {isIndonesian ? "Notifikasi Diterima" : "Notification Received"}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 6, color: "rgba(255,255,255,0.4)" }}>➔ Input</span>
                  </div>
                </div>

                {/* Connection Line */}
                <div style={{ width: 1.5, height: 6, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />

                {/* Action Block */}
                <div style={{ background: "#242426", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "6px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}>
                    <div style={{ width: 13, height: 13, borderRadius: 3, background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ExternalLink size={7} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span style={{ fontSize: 7.5, fontWeight: 600, color: "white" }}>Open Website / URL</span>
                  </div>
                  <div style={{ background: "#18181a", borderRadius: 6, padding: "4px 6px", fontSize: 6.5, lineHeight: 1.5, wordBreak: "break-all" }}>
                    <span style={{ color: "#2997ff" }}>accrual://add?text=</span>
                    <span style={{ background: "#0f274a", border: "1px solid rgba(41,151,255,0.45)", color: "#2997ff", borderRadius: 3, padding: "0 3px" }}>
                      {`{not_body}`}
                    </span>
                    <span style={{ color: "#2997ff" }}>&autosave=true</span>
                  </div>
                </div>
              </div>

              {/* ANDROID - SLIDE 3: STEP 3 ACTIVE */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "34px 8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 37,
                  overflow: "hidden",
                  opacity: currentSlide === 3 ? 1 : 0,
                  pointerEvents: currentSlide === 3 ? "auto" : "none",
                  transition: "opacity 0.28s ease, transform 0.28s ease",
                  transform: currentSlide === 3 ? "scale(1)" : "scale(0.97)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>
                    {isIndonesian ? "Otomasi Siap" : "Automation Ready"}
                  </span>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={8} className="text-black" strokeWidth={3} />
                  </div>
                </div>

                <div style={{ background: "#1c1c1e", borderRadius: 13, border: "1px solid rgba(255,255,255,0.08)", padding: "8px 9px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={10} className="text-black fill-black" />
                    </div>
                    <div>
                      <p style={{ fontSize: 8, fontWeight: 700, color: "white" }}>
                        {isIndonesian ? "Makro Berjalan Aktif" : "Macro Active & Running"}
                      </p>
                      <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)" }}>
                        {isIndonesian ? "Akses Notifikasi Diizinkan" : "Notification Access Granted"}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.18)" }}>
                    <Check size={7} className="text-white" />
                    <span style={{ fontSize: 6.5, fontWeight: 600, color: "white" }}>
                      {isIndonesian ? "1-Ketukan Tinjau Aktif" : "1-Tap Review Ready"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

              {/* Home Indicator Bar */}
              {platform === "ios" && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 5,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 60,
                    height: 3,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.35)",
                    zIndex: 40,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* 2. Minimalist Apple Pagination Dots - Light & Dark adaptive */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          {currentTabSlides.map((_, idx) => {
            const isActive = idx === currentSlide;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setCurrentSlide(idx);
                }}
                className="h-1.5 rounded-full transition-all cursor-pointer"
                style={{
                  width: isActive ? 20 : 6,
                  background: isActive
                    ? "var(--text-primary)"
                    : isDark
                    ? "rgba(255, 255, 255, 0.2)"
                    : "rgba(0, 0, 0, 0.18)",
                  boxShadow: isActive
                    ? isDark
                      ? "0 0 10px rgba(255,255,255,0.45)"
                      : "0 1px 4px rgba(0,0,0,0.2)"
                    : "none",
                }}
                aria-label={`Slide ${idx + 1}`}
              />
            );
          })}
        </div>

        {/* 3. Focused Step Card (Monveo-Style Apple Luxury - Light & Dark adaptive) */}
        <div
          className="w-full rounded-[22px] p-4 mb-3 border transition-colors"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            background: isDark ? "rgba(20, 20, 24, 0.9)" : "var(--bg-elevated)",
            borderColor: "var(--glass-border)",
            boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-start gap-3">
            {/* Step Number or Showcase Icon Badge */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 mt-0.5 border transition-colors"
              style={{
                background: isDark
                  ? activeSlide.isHero
                    ? "rgba(255, 255, 255, 0.15)"
                    : "rgba(255, 255, 255, 0.1)"
                  : activeSlide.isHero
                  ? "rgba(0, 0, 0, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.08)",
                color: "var(--text-primary)",
              }}
            >
              {activeSlide.isHero ? (
                <Sparkles size={13} strokeWidth={2.5} style={{ color: "var(--text-primary)" }} />
              ) : (
                activeSlide.stepNum
              )}
            </div>

            {/* Step Text & Action */}
            <div className="flex-1 min-w-0">
              <h4
                className="text-[14px] font-semibold tracking-tight leading-snug"
                style={{ color: "var(--text-primary)" }}
              >
                {activeSlide.title}
              </h4>
              <p
                className="text-[12px] font-normal leading-relaxed mt-1 whitespace-pre-line"
                style={{ color: "var(--text-tertiary)" }}
              >
                {activeSlide.desc}
              </p>

              {/* Action Button: Apple High-Contrast Capsule Pill */}
              {activeSlide.actionType === "test_url" && activeSlide.scheme && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => handleTestDeepLink(activeSlide.scheme!)}
                    className="font-semibold text-[12.5px] px-4 py-2 rounded-full inline-flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                    style={{
                      background: isDark ? "#ffffff" : "#000000",
                      color: isDark ? "#000000" : "#ffffff",
                    }}
                  >
                    <ExternalLink size={12} strokeWidth={2.5} />
                    <span>{activeSlide.btnText}</span>
                  </button>
                </div>
              )}

              {activeSlide.actionType === "test_hud" && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleTestHud}
                    className="font-semibold text-[12.5px] px-4 py-2 rounded-full inline-flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                    style={{
                      background: isDark ? "#ffffff" : "#000000",
                      color: isDark ? "#000000" : "#ffffff",
                    }}
                  >
                    <Sparkles size={12} strokeWidth={2} />
                    <span>{activeSlide.btnText}</span>
                  </button>
                </div>
              )}

              {activeSlide.actionType === "copy" && activeSlide.copyText && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activeSlide.copyText!, activeSlide.copyLabel || "Data")}
                    className="font-semibold text-[12.5px] px-4 py-2 rounded-full inline-flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                    style={{
                      background: isDark ? "#ffffff" : "#000000",
                      color: isDark ? "#000000" : "#ffffff",
                    }}
                  >
                    {copiedKey === (activeSlide.copyLabel || "Data") ? (
                      <>
                        <Check size={12} strokeWidth={3} />
                        <span>{isIndonesian ? "Tersalin!" : "Copied!"}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} strokeWidth={2.5} />
                        <span>{activeSlide.btnText}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {activeSlide.noteText && (
                <p
                  className="text-[11.5px] font-normal opacity-85 mt-2.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {activeSlide.noteText}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 4. Slide Navigation & Final Done Button - Light & Dark adaptive */}
        <div className="w-full flex items-center justify-between px-1">
          {currentSlide === currentTabSlides.length - 1 ? (
            <>
              <button
                type="button"
                onClick={handlePrevSlide}
                className="text-[13px] font-semibold transition-colors cursor-pointer py-1.5 flex items-center gap-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
                <span>{isIndonesian ? "Sebelumnya" : "Previous"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="font-semibold text-[13px] px-5 py-2.5 rounded-full cursor-pointer shadow-md active:scale-95 transition-all"
                style={{
                  background: isDark ? "#ffffff" : "#000000",
                  color: isDark ? "#000000" : "#ffffff",
                }}
              >
                {isIndonesian ? "Selesai" : "Done"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePrevSlide}
                className={`text-[13px] font-semibold transition-colors cursor-pointer py-1.5 flex items-center gap-1 ${
                  currentSlide === 0 ? "invisible pointer-events-none" : ""
                }`}
                style={{ color: "var(--text-tertiary)" }}
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
                <span>{isIndonesian ? "Sebelumnya" : "Previous"}</span>
              </button>
              <button
                type="button"
                onClick={handleNextSlide}
                className="text-[13px] font-semibold transition-colors cursor-pointer py-1.5 flex items-center gap-1"
                style={{ color: "var(--text-primary)" }}
              >
                <span>{isIndonesian ? "Berikutnya" : "Next"}</span>
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>

      </div>
    </BottomSheet>
  );
}
