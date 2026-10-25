import { useState, useMemo } from "react";
import {
  Sparkles,
  Mic,
  Camera,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Bell,
  CreditCard,
  Plus,
  ShieldCheck,
  Eye,
  ListFilter,
  Play,
  Search,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";

// Preserved for SettingsPage.tsx backwards compatibility
export type TabType =
  | "back_tap"
  | "action_button"
  | "ways_to_add"
  | "automation"
  | "screen_scan"
  | "notification_reader";

export type NativeActionId =
  | "notif_reader"
  | "card_transaction"
  | "voice_entry"
  | "screen_scanner"
  | "quick_action"
  | "scan_receipt";

interface AppleShortcutsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabType;
}

interface ActionStep {
  labelId: string;
  labelEn: string;
  descId: string;
  descEn: string;
}

interface NativeActionItem {
  id: NativeActionId;
  name: string;
  chipLabelId: string;
  chipLabelEn: string;
  titleId: string;
  titleEn: string;
  shortDescId: string;
  shortDescEn: string;
  badgeId: string;
  badgeEn: string;
  icon: typeof Bell;
  steps: ActionStep[];
  siriPhraseId: string;
  siriPhraseEn: string;
  testScheme?: string;
}

function resolveInitialAction(tab?: TabType): NativeActionId {
  if (tab === "notification_reader" || tab === "automation") return "notif_reader";
  if (tab === "screen_scan" || tab === "back_tap") return "screen_scanner";
  if (tab === "action_button") return "voice_entry";
  return "notif_reader";
}

const NATIVE_ACTIONS: NativeActionItem[] = [
  {
    id: "notif_reader",
    name: "Log Notification Transaction",
    chipLabelId: "Notifikasi Bank",
    chipLabelEn: "Bank Alerts",
    titleId: "Pembaca Notifikasi Bank",
    titleEn: "Bank Notification Reader",
    shortDescId: "Ekstrak otomatis mutasi m-Banking & e-wallet",
    shortDescEn: "Auto extract bank & e-wallet push notifications",
    badgeId: "Automasi",
    badgeEn: "Automation",
    icon: Bell,
    steps: [
      {
        labelId: "01 Pemicu",
        labelEn: "01 Trigger",
        descId: "Aplikasi Pintasan › Automasi › (+) Baru › Notifikasi › Pilih aplikasi bank Anda.",
        descEn: "Shortcuts App › Automation tab › (+) New › Notification › Select banking apps.",
      },
      {
        labelId: "02 Aksi",
        labelEn: "02 Action",
        descId: "Cari 'Accrual' › Pilih 'Log Notification Transaction' › Sambungkan variabel [Notifikasi].",
        descEn: "Search 'Accrual' › Select 'Log Notification Transaction' › Connect [Notification].",
      },
      {
        labelId: "03 Jalankan",
        labelEn: "03 Run",
        descId: "Pilih 'Jalankan Segera' dan matikan 'Beri Tahu Saat Dijalankan' untuk proses latar belakang.",
        descEn: "Select 'Run Immediately' and turn off 'Notify When Run' for silent logging.",
      },
    ],
    siriPhraseId: "Hey Siri, Catat notifikasi di Accrual",
    siriPhraseEn: "Hey Siri, Log notification in Accrual",
  },
  {
    id: "card_transaction",
    name: "Log Card Transaction",
    chipLabelId: "Transaksi Kartu",
    chipLabelEn: "Card Pay",
    titleId: "Sinkronisasi Transaksi Kartu",
    titleEn: "Card & Contactless Payment",
    shortDescId: "Catat transaksi kartu kredit, debit & nirsentuh",
    shortDescEn: "Sync card and contactless transactions directly",
    badgeId: "Automasi",
    badgeEn: "Automation",
    icon: CreditCard,
    steps: [
      {
        labelId: "01 Pemicu",
        labelEn: "01 Trigger",
        descId: "Aplikasi Pintasan › Automasi › (+) Baru › Transaksi › Pilih kartu pembayaran.",
        descEn: "Shortcuts App › Automation tab › (+) New › Transaction › Select payment cards.",
      },
      {
        labelId: "02 Aksi",
        labelEn: "02 Action",
        descId: "Cari 'Accrual' › Pilih 'Log Card Transaction' › Sambungkan Nominal & Merchant.",
        descEn: "Search 'Accrual' › Select 'Log Card Transaction' › Map Amount & Merchant.",
      },
      {
        labelId: "03 Jalankan",
        labelEn: "03 Run",
        descId: "Pilih 'Jalankan Segera' untuk pencatatan otomatis tanpa konfirmasi manual.",
        descEn: "Select 'Run Immediately' for silent background execution without confirmation.",
      },
    ],
    siriPhraseId: "Hey Siri, Catat transaksi kartu di Accrual",
    siriPhraseEn: "Hey Siri, Log card payment in Accrual",
  },
  {
    id: "voice_entry",
    name: "Voice Entry",
    chipLabelId: "Dikte Suara",
    chipLabelEn: "Voice Entry",
    titleId: "Dikte Suara Transaksi",
    titleEn: "Voice Transaction Entry",
    shortDescId: "Catat pengeluaran hanya dengan berbicara santai",
    shortDescEn: "Log transactions by speaking naturally",
    badgeId: "Pintasan",
    badgeEn: "Shortcut",
    icon: Mic,
    steps: [
      {
        labelId: "01 Pemicu",
        labelEn: "01 Trigger",
        descId: "Ucapkan perintah Siri atau tautkan ke Tombol Tindakan / Ketuk Bagian Belakang.",
        descEn: "Say Siri command or assign to Action Button / Back Tap double-tap.",
      },
      {
        labelId: "02 Aksi",
        labelEn: "02 Action",
        descId: "Bicara santai, contoh: 'Kopi susu 25 ribu bayar pakai Cash'.",
        descEn: "Speak naturally, e.g. 'Iced coffee 25 thousand paid with Cash'.",
      },
      {
        labelId: "03 Jalankan",
        labelEn: "03 Run",
        descId: "Mesin AI NLP Accrual otomatis mengurai nominal, akun dompet, dan kategori.",
        descEn: "Accrual AI NLP extracts amount, account, and category hands-free.",
      },
    ],
    siriPhraseId: "Hey Siri, Voice log to Accrual",
    siriPhraseEn: "Hey Siri, Voice log to Accrual",
    testScheme: "accrual://voice",
  },
  {
    id: "screen_scanner",
    name: "Scan Payment Screenshot",
    chipLabelId: "Ketuk Belakang",
    chipLabelEn: "Back Tap OCR",
    titleId: "Pindai Layar Bukti Bayar",
    titleEn: "Scan Payment Screenshot",
    shortDescId: "Ketuk 2x punggung iPhone untuk pindai struk/QRIS",
    shortDescEn: "Double-tap iPhone back to scan receipts or QRIS",
    badgeId: "Ketuk Belakang",
    badgeEn: "Back Tap",
    icon: Smartphone,
    steps: [
      {
        labelId: "01 Pemicu",
        labelEn: "01 Trigger",
        descId: "Pengaturan iOS › Aksesibilitas › Sentuh › Ketuk Bagian Belakang › Ketuk Dua Kali.",
        descEn: "iOS Settings › Accessibility › Touch › Back Tap › Double Tap.",
      },
      {
        labelId: "02 Aksi",
        labelEn: "02 Action",
        descId: "Pilih 'Scan Payment Screenshot' di bawah kelompok aplikasi Accrual.",
        descEn: "Select 'Scan Payment Screenshot' under the Accrual shortcuts section.",
      },
      {
        labelId: "03 Jalankan",
        labelEn: "03 Run",
        descId: "Jepret layar bukti bayar, lalu ketuk 2x bodi belakang iPhone untuk mengurai teks via OCR.",
        descEn: "Take screenshot of any receipt, then double-tap iPhone back for instant OCR extraction.",
      },
    ],
    siriPhraseId: "Hey Siri, Pindai tangkapan layar di Accrual",
    siriPhraseEn: "Hey Siri, Scan payment screenshot with Accrual",
    testScheme: "accrual://scan",
  },
  {
    id: "quick_action",
    name: "Open Accrual Quick Action",
    chipLabelId: "Catat Cepat",
    chipLabelEn: "Quick Add",
    titleId: "Buka Formulir Cepat",
    titleEn: "Instant Quick Action",
    shortDescId: "Langsung ke keypad input nominal 1-ketukan",
    shortDescEn: "Launch directly into the transaction keypad",
    badgeId: "1-Ketukan",
    badgeEn: "1-Tap",
    icon: Plus,
    steps: [
      {
        labelId: "01 Pemicu",
        labelEn: "01 Trigger",
        descId: "Pasang di Layar Utama, Layar Terkunci, atau Pusat Kontrol (iOS 18).",
        descEn: "Place on Home Screen, Lock Screen, or Control Center (iOS 18).",
      },
      {
        labelId: "02 Aksi",
        labelEn: "02 Action",
        descId: "Ketuk ikon pintasan untuk membuka Accrual dengan fokus instan pada angka.",
        descEn: "Tap the shortcut button to launch Accrual with immediate keypad focus.",
      },
      {
        labelId: "03 Jalankan",
        labelEn: "03 Run",
        descId: "Catat transaksi dalam hitungan detik tanpa jeda navigasi antarmuka.",
        descEn: "Log transactions on the go in under 3 seconds with zero friction.",
      },
    ],
    siriPhraseId: "Hey Siri, Buka catat cepat di Accrual",
    siriPhraseEn: "Hey Siri, Open quick action in Accrual",
    testScheme: "accrual://quick-add",
  },
  {
    id: "scan_receipt",
    name: "Scan Receipt",
    chipLabelId: "Pindai Struk",
    chipLabelEn: "Scan Receipt",
    titleId: "Kamera Pemindai Struk",
    titleEn: "Camera Receipt Scanner",
    shortDescId: "Buka pemindai struk fisik & nota belanja",
    shortDescEn: "Instant camera scanner for paper receipts",
    badgeId: "Kamera",
    badgeEn: "Camera",
    icon: Camera,
    steps: [
      {
        labelId: "01 Pemicu",
        labelEn: "01 Trigger",
        descId: "Tambahkan ke Pusat Kontrol atau tombol Layar Terkunci di iOS 18.",
        descEn: "Add to Control Center or Lock Screen buttons in iOS 18.",
      },
      {
        labelId: "02 Aksi",
        labelEn: "02 Action",
        descId: "Pilih 'Scan Receipt' untuk langsung mengaktifkan kamera pemindai nota.",
        descEn: "Select 'Scan Receipt' to activate the camera document scanner directly.",
      },
      {
        labelId: "03 Jalankan",
        labelEn: "03 Run",
        descId: "Mesin OCR lokal membaca nominal total, tanggal, dan nama toko secara instan.",
        descEn: "On-device OCR extracts total amount, date, and merchant automatically.",
      },
    ],
    siriPhraseId: "Hey Siri, Pindai resi di Accrual",
    siriPhraseEn: "Hey Siri, Scan receipt in Accrual",
    testScheme: "accrual://scan",
  },
];

export function AppleShortcutsGuideModal({
  isOpen,
  onClose,
  initialTab,
}: AppleShortcutsGuideModalProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme !== "light";

  const initialActionId = useMemo(() => resolveInitialAction(initialTab), [initialTab]);
  const [selectedActionId, setSelectedActionId] = useState<NativeActionId>(initialActionId);
  const [mockupMode, setMockupMode] = useState<"library" | "card">("library");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedAction = useMemo(
    () => NATIVE_ACTIONS.find((a) => a.id === selectedActionId) || NATIVE_ACTIONS[0],
    [selectedActionId],
  );

  const handleCopy = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      triggerSuccessHaptic();
      showToast(
        isIndonesian
          ? `${label} berhasil disalin ke papan klip`
          : `${label} copied to clipboard`,
        "update",
      );
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      triggerHaptic("heavy");
    }
  };

  const openShortcutsApp = () => {
    triggerHaptic("medium");
    window.location.href = "shortcuts://";
  };

  const handleTestScheme = (scheme?: string) => {
    if (!scheme) return;
    triggerHaptic("medium");
    window.location.href = scheme;
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="">
      <div
        className="px-4 pb-8 space-y-4 font-sans select-none"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
        }}
      >
        {/* Header Hero */}
        <div className="text-center space-y-1 pt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/10 bg-white/[0.04] text-[10.5px] font-medium tracking-wide uppercase text-[var(--text-tertiary)]">
            <Sparkles size={11} strokeWidth={1.75} />
            <span>{isIndonesian ? "Ekosistem iOS" : "Apple Ecosystem"}</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            {isIndonesian ? "Pintasan & Automasi" : "Shortcuts & Automations"}
          </h2>
          <p className="text-[12px] text-[var(--text-tertiary)] max-w-xs mx-auto leading-relaxed">
            {isIndonesian
              ? "Catat pengeluaran instan tanpa membuka aplikasi melalui 6 aksi bawaan dan pemicu cerdas iOS."
              : "Log expenses instantly without opening the app via 6 native actions and smart iOS triggers."}
          </p>
        </div>

        {/* ==================================================================== */}
        {/* TOP: AUTHENTIC REALISTIC IPHONE 16 PRO MOCKUP CHASSIS                */}
        {/* ==================================================================== */}
        <div className="relative w-full py-2 flex flex-col items-center justify-center">
          {/* Subtle Ambient Studio Light Reflection */}
          <div
            className="pointer-events-none absolute -top-4 w-60 h-32 rounded-full"
            style={{
              background: isDark
                ? "radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)"
                : "radial-gradient(ellipse, rgba(0,0,0,0.04) 0%, transparent 70%)",
            }}
          />

          {/* iPhone 16 Pro Mockup Chassis */}
          <div
            className="relative"
            style={{
              width: 224,
              height: 388,
              borderRadius: 40,
              padding: 3,
              background: "linear-gradient(150deg, #3a3a40 0%, #1a1a1d 35%, #18181b 65%, #34343a 100%)",
              boxShadow: isDark
                ? "0 18px 45px -10px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.16), 0 0 0 2px #09090c"
                : "0 16px 36px -10px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12), 0 0 0 2px #d4d4d8",
            }}
          >
            {/* Side Hardware Micro Buttons */}
            {/* Action Button */}
            <div
              style={{
                position: "absolute",
                left: -2.5,
                top: 70,
                width: 2.5,
                height: 18,
                borderRadius: "2px 0 0 2px",
                background: "#2f2f35",
              }}
            />
            {/* Volume Up */}
            <div
              style={{
                position: "absolute",
                left: -2.5,
                top: 98,
                width: 2.5,
                height: 32,
                borderRadius: "2px 0 0 2px",
                background: "#2f2f35",
              }}
            />
            {/* Volume Down */}
            <div
              style={{
                position: "absolute",
                left: -2.5,
                top: 138,
                width: 2.5,
                height: 32,
                borderRadius: "2px 0 0 2px",
                background: "#2f2f35",
              }}
            />
            {/* Power Button */}
            <div
              style={{
                position: "absolute",
                right: -2.5,
                top: 110,
                width: 2.5,
                height: 48,
                borderRadius: "0 2px 2px 0",
                background: "#2f2f35",
              }}
            />

            {/* OLED Screen Surface */}
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
                transform: "translateZ(0)",
              }}
            >
              {/* Dynamic Island */}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 74,
                  height: 19,
                  borderRadius: 999,
                  background: "#000000",
                  border: "0.5px solid rgba(255,255,255,0.1)",
                  zIndex: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 7px",
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0a0a0f" }} />
                <div style={{ width: 7.5, height: 7.5, borderRadius: "50%", background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.12)" }} />
              </div>

              {/* Status Bar */}
              <div className="absolute top-2 left-0 right-0 px-4 flex items-center justify-between text-[9.5px] font-mono text-zinc-300 z-30">
                <span className="font-semibold">09:41</span>
                <div className="flex items-center gap-1.5 text-[8.5px]">
                  <span>5G</span>
                  <div className="w-4 h-2 rounded-[2px] border border-zinc-300 p-0.5 flex items-center">
                    <div className="w-full h-full bg-zinc-200 rounded-[1px]" />
                  </div>
                </div>
              </div>

              {/* Inside Screen Content */}
              <div className="absolute inset-0 pt-9 pb-3 px-2.5 flex flex-col justify-between">
                {/* Search Bar / Shortcuts Nav Header */}
                <div className="space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between px-1 text-zinc-400 text-[10px]">
                    <span className="font-semibold text-white tracking-tight">Accrual</span>
                    <span className="font-mono text-[9px] text-zinc-500">6 Actions</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-white/10 text-zinc-400 text-[9px]">
                    <Search size={10} className="text-zinc-500" />
                    <span>{isIndonesian ? "Cari Tindakan" : "Search Actions"}</span>
                  </div>

                  {/* Mode Segment: Library vs Card */}
                  <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setMockupMode("library");
                      }}
                      className="flex-1 py-0.5 rounded text-[9.5px] font-medium transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                      style={{
                        background: mockupMode === "library" ? "rgba(255,255,255,0.15)" : "transparent",
                        color: mockupMode === "library" ? "#ffffff" : "#71717a",
                      }}
                    >
                      <ListFilter size={10} />
                      <span>{isIndonesian ? "Daftar" : "Library"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setMockupMode("card");
                      }}
                      className="flex-1 py-0.5 rounded text-[9.5px] font-medium transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                      style={{
                        background: mockupMode === "card" ? "rgba(255,255,255,0.15)" : "transparent",
                        color: mockupMode === "card" ? "#ffffff" : "#71717a",
                      }}
                    >
                      <Eye size={10} />
                      <span>{isIndonesian ? "Kartu" : "Flow"}</span>
                    </button>
                  </div>
                </div>

                {/* View 1: Real Action Library List */}
                {mockupMode === "library" && (
                  <div className="space-y-1 my-auto overflow-hidden">
                    {NATIVE_ACTIONS.map((action) => {
                      const Icon = action.icon;
                      const isSelected = action.id === selectedActionId;
                      return (
                        <div
                          key={action.id}
                          onClick={() => {
                            triggerHaptic("light");
                            setSelectedActionId(action.id);
                          }}
                          className="flex items-center justify-between p-1.5 rounded-lg transition-all cursor-pointer border"
                          style={{
                            background: isSelected ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.03)",
                            borderColor: isSelected ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)",
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                              style={{
                                background: isSelected ? "#ffffff" : "rgba(255,255,255,0.08)",
                                color: isSelected ? "#000000" : "#ffffff",
                              }}
                            >
                              <Icon size={10.5} strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-white truncate font-mono">
                                {action.name}
                              </div>
                              <div className="text-[8px] text-zinc-400 truncate">
                                {isIndonesian ? action.chipLabelId : action.chipLabelEn}
                              </div>
                            </div>
                          </div>
                          <div className="w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center text-[7.5px] text-zinc-400 italic">
                            i
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* View 2: Live Action Block Execution */}
                {mockupMode === "card" && (
                  <div className="my-auto space-y-2 p-2 rounded-xl bg-zinc-900/90 border border-white/12 text-left">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-4 h-4 rounded bg-white text-black flex items-center justify-center text-[8px] font-bold">
                          A
                        </div>
                        <span className="text-[10px] font-bold text-white truncate">
                          {selectedAction.name}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                        AppIntent
                      </span>
                    </div>

                    {/* Parameter Syntax with Authentic Blue Variable Tokens */}
                    <div className="text-[10px] leading-relaxed text-zinc-300 font-sans">
                      {selectedAction.id === "notif_reader" && (
                        <div>
                          <span>Log </span>
                          <span className="inline-block px-1 rounded bg-[#007AFF]/30 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[9px] font-semibold">
                            Notification
                          </span>
                          <span> to Accrual automatically</span>
                        </div>
                      )}

                      {selectedAction.id === "card_transaction" && (
                        <div>
                          <span>Log </span>
                          <span className="inline-block px-1 rounded bg-[#007AFF]/30 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[9px] font-semibold">
                            Amount
                          </span>
                          <span> at </span>
                          <span className="inline-block px-1 rounded bg-[#007AFF]/30 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[9px] font-semibold">
                            Merchant
                          </span>
                          <span> with </span>
                          <span className="inline-block px-1 rounded bg-[#007AFF]/30 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[9px] font-semibold">
                            Card
                          </span>
                        </div>
                      )}

                      {selectedAction.id === "voice_entry" && (
                        <div>
                          <div className="flex items-center gap-1 mb-1 text-[#5AC8FA]">
                            <Mic size={10} />
                            <span className="text-[9px] font-semibold font-mono">Siri AI NLP</span>
                          </div>
                          <span>"Kopi 25rb bayar pakai Cash"</span>
                        </div>
                      )}

                      {selectedAction.id === "screen_scanner" && (
                        <div>
                          <span>Extract receipt from </span>
                          <span className="inline-block px-1 rounded bg-[#007AFF]/30 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[9px] font-semibold">
                            Screenshot
                          </span>
                          <span> via Live Text OCR</span>
                        </div>
                      )}

                      {selectedAction.id === "quick_action" && (
                        <div>
                          <span>Open transaction modal with numeric keypad focus</span>
                        </div>
                      )}

                      {selectedAction.id === "scan_receipt" && (
                        <div>
                          <span>Launch document camera scanner with edge detection</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[8px] text-zinc-500 border-t border-white/06 pt-1 flex items-center justify-between">
                      <span>{isIndonesian ? "Eksekusi Hening" : "Silent Execution"}</span>
                      <span className="text-zinc-400">iOS 16+</span>
                    </div>
                  </div>
                )}

                {/* Home Indicator */}
                <div className="w-20 h-1 bg-white/30 rounded-full mx-auto shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* ACTION SELECTOR CHIPS (HORIZONTAL SCROLL)                             */}
        {/* ==================================================================== */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
          {NATIVE_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isSelected = action.id === selectedActionId;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setSelectedActionId(action.id);
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-all cursor-pointer border"
                style={{
                  background: isSelected
                    ? isDark
                      ? "rgba(255, 255, 255, 0.12)"
                      : "#18181b"
                    : isDark
                      ? "rgba(255, 255, 255, 0.04)"
                      : "rgba(0, 0, 0, 0.03)",
                  borderColor: isSelected
                    ? isDark
                      ? "rgba(255, 255, 255, 0.22)"
                      : "#18181b"
                    : isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.05)",
                  color: isSelected ? "#ffffff" : "var(--text-secondary)",
                  boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
                }}
              >
                <Icon size={12} strokeWidth={1.8} />
                <span>{isIndonesian ? action.chipLabelId : action.chipLabelEn}</span>
              </button>
            );
          })}
        </div>

        {/* ==================================================================== */}
        {/* BOTTOM: CONCISE & MODERN 3-STEP HOW-TO RECIPE                         */}
        {/* ==================================================================== */}
        <div
          className="p-3.5 rounded-2xl border space-y-3"
          style={{
            background: isDark
              ? "linear-gradient(160deg, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.015) 100%)"
              : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
            boxShadow: isDark
              ? "0 8px 24px -8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)"
              : "0 4px 14px -4px rgba(31, 36, 48, 0.04), inset 0 1px 0 #ffffff",
          }}
        >
          {/* Action Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/06 pb-2.5">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? selectedAction.badgeId : selectedAction.badgeEn}
              </div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                {isIndonesian ? selectedAction.titleId : selectedAction.titleEn}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedAction.testScheme && (
                <button
                  type="button"
                  onClick={() => handleTestScheme(selectedAction.testScheme)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-medium border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
                >
                  <Play size={10} />
                  <span>{isIndonesian ? "Uji Coba" : "Test Run"}</span>
                </button>
              )}
            </div>
          </div>

          {/* 3 Streamlined Numbered Steps */}
          <div className="space-y-2 text-[11.5px]">
            {selectedAction.steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05"
              >
                <span className="font-mono text-[10px] font-semibold text-[var(--text-tertiary)] px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/08 shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="min-w-0 leading-relaxed text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)] mr-1">
                    {isIndonesian ? step.labelId : step.labelEn}:
                  </span>
                  <span>{isIndonesian ? step.descId : step.descEn}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Helper Bar */}
          {selectedAction.siriPhraseEn && (
            <div className="pt-1 flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/06 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <Mic size={12} className="text-[var(--text-tertiary)] shrink-0" />
                <span className="text-[var(--text-tertiary)] shrink-0 font-medium">Siri:</span>
                <span className="text-[var(--text-primary)] truncate font-mono text-[10.5px]">
                  "{isIndonesian ? selectedAction.siriPhraseId : selectedAction.siriPhraseEn}"
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    isIndonesian ? selectedAction.siriPhraseId : selectedAction.siriPhraseEn,
                    `siri-${selectedAction.id}`,
                    isIndonesian ? "Frasa Siri" : "Siri Phrase",
                  )
                }
                className="p-1 rounded-md border border-white/10 bg-white/[0.04] text-[var(--text-tertiary)] active:text-white transition-colors cursor-pointer shrink-0"
              >
                {copiedKey === `siri-${selectedAction.id}` ? (
                  <Check size={11} className="text-white" />
                ) : (
                  <Copy size={11} />
                )}
              </button>
            </div>
          )}

          {selectedAction.id === "notif_reader" && (
            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/06 flex items-center gap-2 text-[10.5px] text-[var(--text-tertiary)]">
              <ShieldCheck size={12} className="text-white shrink-0" />
              <span>
                {isIndonesian
                  ? "Filter promo aktif: notifikasi voucher dan promo diabaikan otomatis."
                  : "Promo filter active: marketing discounts & coupons are silently ignored."}
              </span>
            </div>
          )}
        </div>

        {/* Bottom CTA Action Bar */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={openShortcutsApp}
            className="flex-1 h-11 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer border"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.09)" : "#18181b",
              borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "#18181b",
              color: "#ffffff",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <ExternalLink size={13} />
            <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            className="h-11 px-6 rounded-2xl font-semibold text-[13px] flex items-center justify-center border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
          >
            <span>{isIndonesian ? "Selesai" : "Done"}</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
