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
  Play,
  Search,
  ArrowDown,
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
        {/* 1. HORIZONTAL ACTION SELECTOR CHIPS                                  */}
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
                      ? "rgba(255, 255, 255, 0.24)"
                      : "#18181b"
                    : isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.05)",
                  color: isSelected ? "#ffffff" : "var(--text-secondary)",
                  boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
                }}
              >
                <Icon size={12} strokeWidth={1.8} />
                <span>{isIndonesian ? action.chipLabelId : action.chipLabelEn}</span>
              </button>
            );
          })}
        </div>

        {/* ==================================================================== */}
        {/* 2. DYNAMIC IPHONE PREVIEW (SYNCS TO SELECTED SHORTCUT)               */}
        {/* ==================================================================== */}
        <div className="relative w-full flex flex-col items-center justify-center py-1">
          {/* Subtle Ambient Glow */}
          <div
            className="pointer-events-none absolute -top-2 w-56 h-28 rounded-full"
            style={{
              background: isDark
                ? "radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)"
                : "radial-gradient(ellipse, rgba(0,0,0,0.03) 0%, transparent 70%)",
            }}
          />

          {/* Compact iPhone Frame */}
          <div
            className="relative w-full max-w-[280px]"
            style={{
              borderRadius: 28,
              padding: 2.5,
              background: "linear-gradient(150deg, #38383e 0%, #1c1c1f 35%, #18181b 65%, #303036 100%)",
              boxShadow: isDark
                ? "0 14px 34px -8px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.14), 0 0 0 2px #09090c"
                : "0 10px 24px -8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 2px #d4d4d8",
            }}
          >
            {/* Side Hardware Micro Accents */}
            <div
              style={{
                position: "absolute",
                left: -2,
                top: 45,
                width: 2,
                height: 14,
                borderRadius: "2px 0 0 2px",
                background: "#2f2f35",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: -2,
                top: 66,
                width: 2,
                height: 24,
                borderRadius: "2px 0 0 2px",
                background: "#2f2f35",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: -2,
                top: 72,
                width: 2,
                height: 36,
                borderRadius: "0 2px 2px 0",
                background: "#2f2f35",
              }}
            />

            {/* OLED Screen Surface */}
            <div
              className="relative w-full overflow-hidden bg-black flex flex-col justify-between"
              style={{
                height: 192,
                borderRadius: 25.5,
                padding: "8px 10px 6px 10px",
              }}
            >
              {/* Dynamic Island Pill */}
              <div
                style={{
                  position: "absolute",
                  top: 5,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 58,
                  height: 14,
                  borderRadius: 999,
                  background: "#000000",
                  border: "0.5px solid rgba(255,255,255,0.1)",
                  zIndex: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 5px",
                }}
              >
                <div style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "#0a0a0f" }} />
                <div style={{ width: 5.5, height: 5.5, borderRadius: "50%", background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.12)" }} />
              </div>

              {/* Status Header */}
              <div className="pt-3.5 pb-1 flex items-center justify-between border-b border-white/[0.08] shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-white text-black flex items-center justify-center text-[7px] font-bold">
                    A
                  </div>
                  <span className="text-[9.5px] font-bold text-white tracking-tight">Accrual</span>
                </div>
                <div className="flex items-center gap-1 text-[8.5px] text-zinc-400">
                  <Search size={9} className="text-zinc-500" />
                  <span>{isIndonesian ? "Cari Tindakan" : "Search Actions"}</span>
                </div>
              </div>

              {/* Dynamic Action Execution Flow Tailored to selectedAction */}
              <div className="flex-1 flex flex-col justify-center py-1">
                {selectedAction.id === "notif_reader" && (
                  <div className="space-y-1.5">
                    {/* Trigger Event Block */}
                    <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/08 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center shrink-0">
                          <Bell size={9} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[7.5px] text-zinc-400 font-medium leading-none">
                            {isIndonesian ? "Pemicu Automasi Pribadi" : "Personal Automation Trigger"}
                          </div>
                          <div className="text-[9px] font-semibold text-white truncate mt-0.5">
                            {isIndonesian ? "Notifikasi: BCA, Mandiri, Jenius, GoPay..." : "Notification: BCA, Mandiri, Jenius..."}
                          </div>
                        </div>
                      </div>
                      <span className="text-[7.5px] font-mono px-1 py-0.5 rounded bg-white/10 text-zinc-300 shrink-0">
                        Auto
                      </span>
                    </div>

                    <div className="flex justify-center -my-0.5">
                      <ArrowDown size={9} className="text-zinc-600" />
                    </div>

                    {/* Action Execution Block */}
                    <div className="p-1.5 rounded-lg bg-white/[0.08] border border-white/14 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-semibold text-white">Log Notification Transaction</span>
                        <span className="text-[7.5px] font-mono text-zinc-400">AppIntent</span>
                      </div>
                      <div className="text-[9.5px] text-zinc-200">
                        <span>{isIndonesian ? "Catat " : "Log "}</span>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[8.5px] font-semibold">
                          {isIndonesian ? "Notifikasi" : "Notification"}
                        </span>
                        <span>{isIndonesian ? " ke Accrual" : " to Accrual"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[7.5px] text-zinc-400 px-0.5">
                      <span className="flex items-center gap-1">
                        <ShieldCheck size={8} className="text-white" />
                        <span>{isIndonesian ? "Filter promo aktif" : "Anti-promo filter active"}</span>
                      </span>
                      <span>{isIndonesian ? "Latar belakang" : "Background"}</span>
                    </div>
                  </div>
                )}

                {selectedAction.id === "card_transaction" && (
                  <div className="space-y-1.5">
                    <div className="p-2 rounded-xl bg-white/[0.08] border border-white/14 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={10} className="text-white" />
                          <span className="text-[9.5px] font-semibold text-white">Log Card Transaction</span>
                        </div>
                        <span className="text-[7.5px] font-mono px-1 py-0.5 rounded bg-white/10 text-zinc-300">
                          AppIntent
                        </span>
                      </div>
                      <div className="text-[9.5px] leading-relaxed text-zinc-200 font-sans">
                        <span>{isIndonesian ? "Catat " : "Log "}</span>
                        <span className="inline-block px-1 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[8px] font-semibold">
                          {isIndonesian ? "Nominal" : "Amount"}
                        </span>
                        <span>{isIndonesian ? " di " : " at "}</span>
                        <span className="inline-block px-1 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[8px] font-semibold">
                          {isIndonesian ? "Toko" : "Merchant"}
                        </span>
                        <span>{isIndonesian ? " via " : " with "}</span>
                        <span className="inline-block px-1 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[8px] font-semibold">
                          {isIndonesian ? "Kartu" : "Card"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[7.5px] text-zinc-400 px-0.5">
                      <span className="flex items-center gap-1">
                        <Check size={8} className="text-white" />
                        <span>{isIndonesian ? "Sinkronisasi instan ke buku kas" : "Instant ledger sync"}</span>
                      </span>
                      <span>iOS 16+</span>
                    </div>
                  </div>
                )}

                {selectedAction.id === "voice_entry" && (
                  <div className="space-y-1.5">
                    <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/08 flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-[#5AC8FA]/20 border border-[#5AC8FA]/30 flex items-center justify-center shrink-0">
                        <Mic size={9} className="text-[#5AC8FA]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[7.5px] text-zinc-400 font-mono">Siri AI NLP</div>
                        <div className="text-[9px] font-semibold text-white truncate">
                          "{isIndonesian ? "Kopi 25rb bayar pakai Cash" : "Coffee 25k paid with Cash"}"
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center -my-0.5">
                      <ArrowDown size={9} className="text-zinc-600" />
                    </div>

                    <div className="p-1.5 rounded-lg bg-white/[0.08] border border-white/14 space-y-1">
                      <div className="text-[7.5px] text-zinc-400 font-medium">
                        {isIndonesian ? "Hasil Deteksi Otomatis:" : "Auto-Parsed Result:"}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-1 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[8px] font-semibold">
                          Rp 25.000
                        </span>
                        <span className="px-1 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[8px] font-semibold">
                          {isIndonesian ? "Makanan" : "Food"}
                        </span>
                        <span className="px-1 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[8px] font-semibold">
                          Cash
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[7.5px] text-zinc-400 px-0.5">
                      <span>{isIndonesian ? "Pemrosesan lokal on-device" : "On-device processing"}</span>
                      <span>Siri AI</span>
                    </div>
                  </div>
                )}

                {selectedAction.id === "screen_scanner" && (
                  <div className="space-y-1.5">
                    <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/08 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center shrink-0">
                          <Smartphone size={9} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[7.5px] text-zinc-400 font-medium leading-none">
                            {isIndonesian ? "Ketuk Bagian Belakang" : "Back Tap Trigger"}
                          </div>
                          <div className="text-[9px] font-semibold text-white truncate mt-0.5">
                            {isIndonesian ? "Ketuk 2x Bodi iPhone" : "Double Tap Back of iPhone"}
                          </div>
                        </div>
                      </div>
                      <span className="text-[7.5px] font-mono px-1 py-0.5 rounded bg-white/10 text-zinc-300 shrink-0">
                        2x Tap
                      </span>
                    </div>

                    <div className="flex justify-center -my-0.5">
                      <ArrowDown size={9} className="text-zinc-600" />
                    </div>

                    <div className="p-1.5 rounded-lg bg-white/[0.08] border border-white/14 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-semibold text-white">Apple Live Text OCR</span>
                        <span className="text-[7.5px] font-mono text-zinc-400">Extract</span>
                      </div>
                      <div className="text-[9px] text-zinc-200 truncate">
                        <span>{isIndonesian ? "Ekstrak struk: " : "Extract: "}</span>
                        <span className="inline-block px-1 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[8px] font-semibold">
                          {isIndonesian ? "Tangkapan Layar" : "Screenshot"}
                        </span>
                      </div>
                      <div className="text-[7.5px] text-zinc-400 font-mono truncate">
                        ➔ Rp 85.000 • Kopi Toko Djawa
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[7.5px] text-zinc-400 px-0.5">
                      <span>{isIndonesian ? "Ekstraksi OCR instan" : "Instant OCR extraction"}</span>
                      <span>Live Text</span>
                    </div>
                  </div>
                )}

                {selectedAction.id === "quick_action" && (
                  <div className="space-y-1.5">
                    <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/08 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-4 h-4 rounded bg-white text-black flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[7.5px] text-zinc-400 font-medium leading-none">
                            {isIndonesian ? "Pusat Kontrol & Layar Terkunci" : "Control Center & Lock Screen"}
                          </div>
                          <div className="text-[9px] font-semibold text-white truncate mt-0.5">
                            Accrual Quick Add
                          </div>
                        </div>
                      </div>
                      <span className="text-[7.5px] font-mono px-1 py-0.5 rounded bg-white/10 text-zinc-300 shrink-0">
                        iOS 18
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-white/[0.08] border border-white/14 space-y-1">
                      <div className="flex items-center justify-between text-[8px] text-zinc-400">
                        <span>{isIndonesian ? "Fokus Keypad Langsung" : "Instant Keypad Focus"}</span>
                        <span className="font-mono text-white text-[10px] font-bold">Rp 0<span className="animate-pulse">|</span></span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-0.5 text-center font-mono text-[8px] text-zinc-300">
                        <div className="py-0.5 rounded bg-white/[0.06]">1</div>
                        <div className="py-0.5 rounded bg-white/[0.06]">2</div>
                        <div className="py-0.5 rounded bg-white/[0.06]">3</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[7.5px] text-zinc-400 px-0.5">
                      <span>{isIndonesian ? "Input cepat dalam 3 detik" : "1-Tap fast logging in 3s"}</span>
                      <span>1-Tap</span>
                    </div>
                  </div>
                )}

                {selectedAction.id === "scan_receipt" && (
                  <div className="space-y-1.5">
                    <div className="p-1.5 rounded-lg bg-white/[0.08] border border-white/14 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Camera size={9} className="text-white" />
                          <span className="text-[9px] font-semibold text-white">
                            {isIndonesian ? "Kamera Pemindai Nota" : "Camera Document Scanner"}
                          </span>
                        </div>
                        <span className="text-[7.5px] font-mono px-1 py-0.5 rounded bg-white/10 text-zinc-300">
                          VisionKit
                        </span>
                      </div>

                      {/* Viewfinder Reticle */}
                      <div className="relative h-12 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden">
                        <div className="absolute top-1 left-1 text-white/50 text-[8px] font-mono leading-none">⌜</div>
                        <div className="absolute top-1 right-1 text-white/50 text-[8px] font-mono leading-none">⌝</div>
                        <div className="absolute bottom-1 left-1 text-white/50 text-[8px] font-mono leading-none">⌞</div>
                        <div className="absolute bottom-1 right-1 text-white/50 text-[8px] font-mono leading-none">⌟</div>
                        <div className="text-center">
                          <div className="text-[8.5px] font-semibold text-zinc-200">
                            {isIndonesian ? "Arahkan Kamera ke Struk" : "Point Camera at Receipt"}
                          </div>
                          <div className="text-[7px] text-zinc-400 font-mono">
                            {isIndonesian ? "Deteksi batas nota otomatis" : "Auto edge detection & total"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[7.5px] text-zinc-400 px-0.5">
                      <span>{isIndonesian ? "Pemindaian struk & nota fisik" : "Instant paper receipt scanner"}</span>
                      <span>OCR</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Home Indicator */}
              <div className="w-16 h-0.5 bg-white/25 rounded-full mx-auto shrink-0 mt-0.5" />
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 3. CONCISE 3-STEP HOW-TO RECIPE                                      */}
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

          {/* 3 Streamlined Numbered Steps (Clean, no redundant [1] 01) */}
          <div className="space-y-2 text-[11.5px]">
            {selectedAction.steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05"
              >
                <span className="font-mono text-[10.5px] font-bold text-white px-2 py-0.5 rounded-md bg-white/[0.07] border border-white/10 shrink-0 mt-0.5">
                  0{idx + 1}
                </span>
                <div className="min-w-0 leading-relaxed text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)] mr-1">
                    {isIndonesian ? step.labelId.replace(/^\d+\s*/, "") : step.labelEn.replace(/^\d+\s*/, "")}:
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

        {/* ==================================================================== */}
        {/* 4. BOTTOM CTA ACTION BAR                                             */}
        {/* ==================================================================== */}
        <div className="pt-1 flex items-center gap-2">
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
