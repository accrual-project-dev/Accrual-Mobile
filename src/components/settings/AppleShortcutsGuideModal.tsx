import { useState, useMemo } from "react";
import {
  Sparkles,
  Zap,
  Mic,
  Camera,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Search,
  Bell,
  CreditCard,
  Plus,
  ShieldCheck,
  Eye,
  Sliders,
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

export type ActiveTab =
  | "native_actions"
  | "bank_notif"
  | "card_tx"
  | "back_tap"
  | "action_button"
  | "siri";

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

interface NativeActionItem {
  id: NativeActionId;
  name: string;
  titleId: string;
  titleEn: string;
  shortDescId: string;
  shortDescEn: string;
  fullDescId: string;
  fullDescEn: string;
  icon: typeof Bell;
  siriPhraseId: string;
  siriPhraseEn: string;
  testScheme?: string;
  category: "automation" | "shortcut";
}

function resolveInitialSelection(tab?: TabType): { tab: ActiveTab; action: NativeActionId } {
  if (tab === "notification_reader" || tab === "automation") {
    return { tab: "bank_notif", action: "notif_reader" };
  }
  if (tab === "screen_scan" || tab === "back_tap") {
    return { tab: "back_tap", action: "screen_scanner" };
  }
  if (tab === "action_button") {
    return { tab: "action_button", action: "voice_entry" };
  }
  return { tab: "native_actions", action: "notif_reader" };
}

const NATIVE_ACTIONS: NativeActionItem[] = [
  {
    id: "notif_reader",
    name: "Log Notification Transaction",
    titleId: "Pembaca Notifikasi Bank",
    titleEn: "Log Notification Transaction",
    shortDescId: "Urai mutasi notifikasi bank & e-wallet otomatis",
    shortDescEn: "Auto extract bank & e-wallet push notifications",
    fullDescId:
      "Aksi automasi latar belakang cerdas yang menerima parameter notifikasi (Notification, Title, Subtitle, App, Received At) dari pemicu iOS. Dilengkapi filter promo otomatis untuk menyaring kupon atau voucher belanja secara hening.",
    fullDescEn:
      "Smart background automation action that receives notification parameters (Notification, Title, Subtitle, App, Received At) from iOS triggers. Includes an intelligent promo filter to silently discard marketing vouchers.",
    icon: Bell,
    siriPhraseId: "Hey Siri, Catat notifikasi di Accrual",
    siriPhraseEn: "Hey Siri, Log notification in Accrual",
    category: "automation",
  },
  {
    id: "card_transaction",
    name: "Log Card Transaction",
    titleId: "Sinkronisasi Transaksi Kartu",
    titleEn: "Log Card Transaction",
    shortDescId: "Sinkronkan transaksi kartu nirsentuh & dompet digital",
    shortDescEn: "Sync card and contactless transactions directly",
    fullDescId:
      "Dirancang untuk pemicu automasi transaksi kartu iOS. Menerima nominal, nama merchant, dan kartu pembayaran dengan proteksi anti-duplikasi 10 menit untuk menjaga keakuratan buku kas.",
    fullDescEn:
      "Built for iOS card payment automation triggers. Receives amount, merchant name, and card details with a 10-minute duplicate guard to safeguard ledger integrity.",
    icon: CreditCard,
    siriPhraseId: "Hey Siri, Catat transaksi kartu di Accrual",
    siriPhraseEn: "Hey Siri, Log card payment in Accrual",
    category: "automation",
  },
  {
    id: "voice_entry",
    name: "Voice Entry",
    titleId: "Dikte Suara Transaksi",
    titleEn: "Voice Entry",
    shortDescId: "Catat transaksi dengan berbicara santai",
    shortDescEn: "Add a transaction by speaking naturally",
    fullDescId:
      "Cukup ucapkan pengeluaran Anda (misal: 'Kopi susu 25 ribu bayar pakai Cash'). Mesin AI NLP Accrual otomatis mengurai nominal, kategori, dan dompet tanpa perlu menyentuh layar.",
    fullDescEn:
      "Simply speak your expense (e.g. 'Coffee 25 thousand paid with Cash'). Accrual's AI NLP automatically extracts amount, category, and wallet hands-free.",
    icon: Mic,
    siriPhraseId: "Hey Siri, Voice log to Accrual",
    siriPhraseEn: "Hey Siri, Voice log to Accrual",
    testScheme: "accrual://voice",
    category: "shortcut",
  },
  {
    id: "screen_scanner",
    name: "Scan Payment Screenshot",
    titleId: "Pindai Tangkapan Layar",
    titleEn: "Scan Payment Screenshot",
    shortDescId: "Catat transaksi dari screenshot atau bukti QRIS",
    shortDescEn: "Add a transaction by scanning a screenshot or QRIS",
    fullDescId:
      "Sangat pas ditautkan ke Ketukan Belakang (Back Tap). Ambil tangkapan layar bukti transfer atau struk, lalu ketuk punggung iPhone Anda untuk memproses transaksi secara instan.",
    fullDescEn:
      "Perfect for iPhone Back Tap. Take a screenshot of any payment confirmation or bank slip, then tap your iPhone's back to process the transaction instantly.",
    icon: Smartphone,
    siriPhraseId: "Hey Siri, Pindai tangkapan layar di Accrual",
    siriPhraseEn: "Hey Siri, Scan payment screenshot with Accrual",
    testScheme: "accrual://scan",
    category: "shortcut",
  },
  {
    id: "quick_action",
    name: "Open Accrual Quick Action",
    titleId: "Buka Catat Cepat",
    titleEn: "Open Accrual Quick Action",
    shortDescId: "Buka formulir pencatatan secepat kilat",
    shortDescEn: "Instantly launch into the transaction keypad",
    fullDescId:
      "Membuka aplikasi Accrual dan langsung memunculkan lembar pencatatan transaksi baru dengan fokus langsung pada keypad angka.",
    fullDescEn:
      "Launches Accrual directly into the new transaction modal with immediate focus on the numeric keypad.",
    icon: Plus,
    siriPhraseId: "Hey Siri, Buka catat cepat di Accrual",
    siriPhraseEn: "Hey Siri, Open quick action in Accrual",
    testScheme: "accrual://quick-add",
    category: "shortcut",
  },
  {
    id: "scan_receipt",
    name: "Scan Receipt",
    titleId: "Pindai Resi & Struk",
    titleEn: "Scan Receipt",
    shortDescId: "Buka kamera pemindai struk fisik & faktur",
    shortDescEn: "Open camera scanner for receipts & invoices",
    fullDescId:
      "Langsung mengaktifkan kamera pemindai struk belanja fisik, nota makan, dan faktur untuk diekstrak otomatis oleh mesin OCR berkecepatan tinggi.",
    fullDescEn:
      "Instantly launches the camera scanner for physical shopping receipts, dining slips, and invoices via high-speed on-device OCR.",
    icon: Camera,
    siriPhraseId: "Hey Siri, Pindai resi di Accrual",
    siriPhraseEn: "Hey Siri, Scan receipt in Accrual",
    testScheme: "accrual://scan",
    category: "shortcut",
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

  const initial = useMemo(() => resolveInitialSelection(initialTab), [initialTab]);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initial.tab);
  const [selectedActionId, setSelectedActionId] = useState<NativeActionId>(initial.action);
  const [mockupMode, setMockupMode] = useState<"picker" | "action_card">("picker");
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

  // ── Clean Monochrome Luxury Glass Tokens ──
  const groupBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.02) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const groupBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const groupShadow = isDark
    ? "0 10px 28px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
    : "0 4px 14px -4px rgba(31, 36, 48, 0.04), inset 0 1px 0 #ffffff";

  const iconBg = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)";
  const iconBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.05)";

  const tabList: { key: ActiveTab; labelId: string; labelEn: string; icon: typeof Zap }[] = [
    { key: "native_actions", labelId: "6 Aksi Bawaan", labelEn: "6 Native Actions", icon: Sparkles },
    { key: "bank_notif", labelId: "Notifikasi Bank", labelEn: "Bank Automation", icon: Bell },
    { key: "card_tx", labelId: "Transaksi Kartu", labelEn: "Card Transactions", icon: CreditCard },
    { key: "back_tap", labelId: "Ketuk Belakang", labelEn: "Back Tap", icon: Smartphone },
    { key: "action_button", labelId: "Tombol Tindakan", labelEn: "Action Button", icon: Sliders },
    { key: "siri", labelId: "Perintah Siri", labelEn: "Siri Voice", icon: Mic },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="">
      <div
        className="px-4 pb-8 space-y-5"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
        }}
      >
        {/* Header Hero */}
        <div className="space-y-1.5 select-none pt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/10 bg-white/[0.04] text-[10.5px] font-medium tracking-wide uppercase text-[var(--text-tertiary)]">
            <Sparkles size={11} strokeWidth={1.75} />
            <span>
              {isIndonesian ? "Pusat Integrasi iOS" : "Apple Ecosystem Suite"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[22px] font-semibold text-[var(--text-primary)] tracking-tight">
              {isIndonesian ? "Pintasan & Automasi" : "Shortcuts & Automations"}
            </h2>
            <button
              type="button"
              onClick={openShortcutsApp}
              className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10 bg-white/[0.04] text-[var(--text-primary)] hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
            >
              <ExternalLink size={11} />
              <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
            </button>
          </div>
          <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
            {isIndonesian
              ? "Catat transaksi secara instan tanpa perlu membuka aplikasi Accrual melalui 6 aksi bawaan dan pemicu automasi iOS."
              : "Quickly log new transactions without opening Accrual via 6 native actions and iOS automation triggers."}
          </p>
        </div>

        {/* Top Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 select-none">
          {tabList.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setActiveTab(tab.key);
                  if (tab.key === "bank_notif") setSelectedActionId("notif_reader");
                  else if (tab.key === "card_tx") setSelectedActionId("card_transaction");
                  else if (tab.key === "back_tap") setSelectedActionId("screen_scanner");
                  else if (tab.key === "action_button") setSelectedActionId("voice_entry");
                  else if (tab.key === "siri") setSelectedActionId("voice_entry");
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-all cursor-pointer border"
                style={{
                  background: isActive
                    ? isDark
                      ? "rgba(255, 255, 255, 0.12)"
                      : "#18181b"
                    : iconBg,
                  borderColor: isActive
                    ? isDark
                      ? "rgba(255, 255, 255, 0.22)"
                      : "#18181b"
                    : isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.05)",
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                  boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
                }}
              >
                <Icon size={12.5} strokeWidth={1.8} />
                <span>{isIndonesian ? tab.labelId : tab.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* ==================================================================== */}
        {/* INTERACTIVE REALISTIC IPHONE DEVICE MOCKUP (FRONT-AND-CENTER)        */}
        {/* ==================================================================== */}
        <div
          className="rounded-3xl p-4 relative overflow-hidden select-none border transition-all"
          style={{
            background: isDark
              ? "radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.08) 0%, rgba(18,18,20,0.98) 75%)"
              : "radial-gradient(ellipse at 50% -20%, rgba(0,0,0,0.03) 0%, #ffffff 85%)",
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
            boxShadow: groupShadow,
          }}
        >
          {/* Hardware Status Bar (Clock, Dynamic Island, 5G, Battery) */}
          <div className="flex items-center justify-between mb-3 px-1 text-[11px] font-mono text-[var(--text-tertiary)]">
            <span>09:20</span>
            <div className="w-16 h-3.5 bg-black rounded-full mx-auto border border-white/10 shadow-inner flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20 ml-auto mr-1.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <span className="text-[10px]">62%</span>
            </div>
          </div>

          {/* Search App Header in iOS Shortcuts & Screen Mode Switcher */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <Search size={13} className="text-[var(--text-tertiary)] shrink-0" />
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[11px] font-semibold text-[var(--text-primary)]">
                  <span className="w-3.5 h-3.5 rounded-sm bg-black border border-white/20 flex items-center justify-center text-[8.5px] font-bold text-white">
                    A
                  </span>
                  <span>Accrual</span>
                </div>
              </div>

              {/* In-device View Mode Toggle */}
              <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setMockupMode("picker");
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer"
                  style={{
                    background: mockupMode === "picker" ? "rgba(255,255,255,0.14)" : "transparent",
                    color: mockupMode === "picker" ? "#ffffff" : "var(--text-tertiary)",
                  }}
                >
                  {isIndonesian ? "Daftar Aksi" : "Action Picker"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setMockupMode("action_card");
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1"
                  style={{
                    background: mockupMode === "action_card" ? "rgba(255,255,255,0.14)" : "transparent",
                    color: mockupMode === "action_card" ? "#ffffff" : "var(--text-tertiary)",
                  }}
                >
                  <Eye size={10} />
                  <span>{isIndonesian ? "Kartu Aksi" : "Action Card"}</span>
                </button>
              </div>
            </div>

            {/* MODE 1: Interactive Native Actions List inside Shortcuts App */}
            {mockupMode === "picker" && (
              <div className="space-y-1.5">
                {NATIVE_ACTIONS.map((action) => {
                  const ActionIcon = action.icon;
                  const isSelected = selectedActionId === action.id;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setSelectedActionId(action.id);
                        if (action.id === "notif_reader") setActiveTab("bank_notif");
                        else if (action.id === "card_transaction") setActiveTab("card_tx");
                        else if (action.id === "screen_scanner") setActiveTab("back_tap");
                        else if (action.id === "voice_entry") setActiveTab("action_button");
                        else setActiveTab("native_actions");
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer text-left border"
                      style={{
                        background: isSelected
                          ? isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)"
                          : "transparent",
                        borderColor: isSelected
                          ? isDark
                            ? "rgba(255, 255, 255, 0.16)"
                            : "rgba(0, 0, 0, 0.12)"
                          : "transparent",
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform"
                          style={{
                            background: isSelected ? "var(--text-primary)" : iconBg,
                            color: isSelected
                              ? isDark
                                ? "#09090c"
                                : "#ffffff"
                              : "var(--text-primary)",
                            border: iconBorder,
                            transform: isSelected ? "scale(1.05)" : "scale(1)",
                          }}
                        >
                          <ActionIcon size={14} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-[var(--text-primary)] truncate font-mono">
                            {action.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                            {isIndonesian ? action.shortDescId : action.shortDescEn}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {action.category === "automation" && (
                          <span className="text-[8.5px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-[var(--text-tertiary)] border border-white/08">
                            Auto
                          </span>
                        )}
                        <div
                          className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-serif italic transition-colors"
                          style={{
                            borderColor: isSelected ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
                            color: isSelected ? "#ffffff" : "var(--text-tertiary)",
                          }}
                        >
                          i
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* MODE 2: Realistic iOS Shortcuts Action Card Simulation with Blue Variable Tokens */}
            {mockupMode === "action_card" && (
              <div className="space-y-2 pt-1 animate-fadeIn">
                <div
                  className="p-3.5 rounded-2xl border space-y-2.5"
                  style={{
                    background: isDark
                      ? "linear-gradient(180deg, #18181d 0%, #121215 100%)"
                      : "linear-gradient(180deg, #ffffff 0%, #f4f4f7 100%)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    boxShadow: "0 8px 24px -6px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-black border border-white/20 flex items-center justify-center text-[9px] font-bold text-white">
                        A
                      </div>
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                        {selectedAction.name}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)] border border-white/10">
                      AppIntent
                    </span>
                  </div>

                  {/* Dynamic Parameter Syntax with Authentic Blue Variable Tokens */}
                  {selectedAction.id === "notif_reader" && (
                    <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[12px] leading-relaxed text-zinc-300 font-sans">
                      <span>Log notification </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        Notification
                      </span>
                      <span> titled </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        Title
                      </span>
                      <span> subtitled </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        Subtitle
                      </span>
                      <span> from </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        App
                      </span>
                      <span> at </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        Received At
                      </span>
                    </div>
                  )}

                  {selectedAction.id === "card_transaction" && (
                    <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[12px] leading-relaxed text-zinc-300 font-sans">
                      <span>Log card transaction </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        Amount
                      </span>
                      <span> at </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        Merchant
                      </span>
                      <span> with </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        Card
                      </span>
                    </div>
                  )}

                  {selectedAction.id === "voice_entry" && (
                    <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[12px] leading-relaxed text-zinc-300 font-sans">
                      <span>Voice entry: </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        Spoken Text
                      </span>
                      <div className="pt-2 text-[11px] text-[var(--text-tertiary)] italic">
                        {isIndonesian
                          ? "Kecerdasan AI NLP otomatis mengurai nominal, kategori, dan dompet secara bebas genggam."
                          : "AI NLP intelligence automatically parses amount, category, and wallet hands-free."}
                      </div>
                    </div>
                  )}

                  {selectedAction.id === "screen_scanner" && (
                    <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[12px] leading-relaxed text-zinc-300 font-sans">
                      <span>Scan payment screenshot from </span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[10.5px] font-semibold">
                        Screenshot File
                      </span>
                      <div className="pt-2 text-[11px] text-[var(--text-tertiary)] italic">
                        {isIndonesian
                          ? "Mengekstraksi slip transfer dan QRIS via mesin OCR lokal."
                          : "Extracts transfer slips and QRIS confirmations via on-device OCR."}
                      </div>
                    </div>
                  )}

                  {selectedAction.id === "quick_action" && (
                    <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[12px] leading-relaxed text-zinc-300 font-sans">
                      <span>Open quick transaction entry keypad in Accrual</span>
                    </div>
                  )}

                  {selectedAction.id === "scan_receipt" && (
                    <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[12px] leading-relaxed text-zinc-300 font-sans">
                      <span>Open camera scanner for receipts and invoices</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* DETAIL WORKSTATION FOR THE CURRENTLY SELECTED ACTION                 */}
        {/* ==================================================================== */}
        <div
          className="p-4 rounded-2xl border space-y-3.5"
          style={{
            background: groupBg,
            border: groupBorder,
            boxShadow: groupShadow,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Aksi Terpilih" : "Selected Action"}
              </span>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                {isIndonesian ? selectedAction.titleId : selectedAction.titleEn}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedAction.testScheme && (
                <button
                  type="button"
                  onClick={() => handleTestScheme(selectedAction.testScheme)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-medium border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
                >
                  <ExternalLink size={11} />
                  <span>{isIndonesian ? "Uji Buka" : "Test Run"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={openShortcutsApp}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-medium border border-white/10 bg-white/[0.06] text-white active:scale-95 transition-all cursor-pointer"
              >
                <span>{isIndonesian ? "Atur" : "Setup"}</span>
              </button>
            </div>
          </div>

          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
            {isIndonesian ? selectedAction.fullDescId : selectedAction.fullDescEn}
          </p>

          {/* Siri Trigger Pill */}
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/08 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Mic size={13} className="text-[var(--text-tertiary)] shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-[var(--text-tertiary)] font-medium">
                  {isIndonesian ? "Frasa Perintah Siri" : "Siri Voice Trigger"}
                </div>
                <div className="text-[11.5px] font-semibold text-[var(--text-primary)] truncate font-mono">
                  {isIndonesian ? selectedAction.siriPhraseId : selectedAction.siriPhraseEn}
                </div>
              </div>
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
              className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-[var(--text-tertiary)] active:text-white transition-colors cursor-pointer shrink-0"
            >
              {copiedKey === `siri-${selectedAction.id}` ? (
                <Check size={12} className="text-white" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>

          {/* Variable Mapping Token Table (Specifically for Notification Reader) */}
          {selectedAction.id === "notif_reader" && (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/06 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian ? "Pemetaan Variabel Pintasan" : "Shortcuts Variable Mapping"}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                  5 Parameters
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10.5px] font-mono">
                <div className="p-1.5 rounded bg-black/40 border border-white/08 text-zinc-300">
                  Notification → <span className="text-[#5AC8FA]">Notification</span>
                </div>
                <div className="p-1.5 rounded bg-black/40 border border-white/08 text-zinc-300">
                  Title → <span className="text-[#5AC8FA]">Title</span>
                </div>
                <div className="p-1.5 rounded bg-black/40 border border-white/08 text-zinc-300">
                  Subtitle → <span className="text-[#5AC8FA]">Subtitle</span>
                </div>
                <div className="p-1.5 rounded bg-black/40 border border-white/08 text-zinc-300">
                  App → <span className="text-[#5AC8FA]">App</span>
                </div>
                <div className="col-span-2 p-1.5 rounded bg-black/40 border border-white/08 text-zinc-300">
                  Received At → <span className="text-[#5AC8FA]">Current Date</span>
                </div>
              </div>
            </div>
          )}

          {/* Smart Promo Filtering Safety Notice */}
          {selectedAction.id === "notif_reader" && (
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/06 flex items-start gap-2.5 text-[11px] text-[var(--text-secondary)]">
              <ShieldCheck size={14} className="text-white shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-[var(--text-primary)]">
                  {isIndonesian ? "Filter Promo Otomatis: " : "Smart Promo Filter: "}
                </span>
                {isIndonesian
                  ? "Accrual otomatis menyaring dan mengabaikan notifikasi belanja diskon, cashback, voucher, atau kupon tanpa mutasi finansial nyata agar buku kas Anda tetap bersih."
                  : "Accrual automatically detects and ignores marketing promotions, discount vouchers, and cashback push notifications without valid transaction mutations."}
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* CONTEXTUAL STEP-BY-STEP RECIPE GUIDES                                */}
        {/* ==================================================================== */}

        {/* 1. BANK NOTIFICATION AUTOMATION RECIPE */}
        {activeTab === "bank_notif" && (
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{
              background: groupBg,
              border: groupBorder,
              boxShadow: groupShadow,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[13.5px]">
                <Bell size={15} strokeWidth={1.8} />
                <span>
                  {isIndonesian
                    ? "Resep: Automasi Notifikasi Bank"
                    : "Recipe: Bank Notification Automation"}
                </span>
              </div>
              <button
                type="button"
                onClick={openShortcutsApp}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
              >
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
                <ExternalLink size={10} />
              </button>
            </div>

            <div className="space-y-2 text-[11.5px] text-[var(--text-secondary)]">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Pilih Tab Automasi di Pintasan" : "Select Automation Tab in Shortcuts"}
                  </div>
                  <div>
                    {isIndonesian
                      ? "Buka aplikasi Pintasan › Ketuk tab 'Automasi' di bawah › Ketuk (+) Automasi Baru."
                      : "Open Shortcuts app › Tap 'Automation' tab at the bottom › Tap (+) New Automation."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Pilih Pemicu Notifikasi" : "Choose Notification Trigger"}
                  </div>
                  <div>
                    {isIndonesian
                      ? "Pilih pemicu 'Saat Menerima Notifikasi' (When I Receive Notification)."
                      : "Select 'When I Receive Notification' as the automation trigger."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Pilih Aplikasi Finansial Anda" : "Select Your Financial Apps"}
                  </div>
                  <div>
                    {isIndonesian
                      ? "Pilih satu atau beberapa aplikasi bank & e-wallet (BCA, Livin by Mandiri, BRImo, GoPay, DANA, OVO, ShopeePay, SeaBank)."
                      : "Select your banking & wallet apps (e.g. BCA, Livin by Mandiri, BRImo, GoPay, DANA, OVO, ShopeePay, SeaBank)."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  4
                </span>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Tambahkan Aksi Accrual" : "Add Accrual Action"}
                  </div>
                  <div>
                    {isIndonesian
                      ? "Cari 'Accrual' › Pilih aksi 'Log Notification Transaction'."
                      : "Search 'Accrual' › Select 'Log Notification Transaction' action."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  5
                </span>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Jalankan Segera Secara Hening" : "Run Immediately & Silently"}
                  </div>
                  <div>
                    {isIndonesian
                      ? "Centang 'Jalankan Segera' (Run Immediately) dan matikan 'Beri Tahu Saat Dijalankan' agar pencatatan hening di latar belakang."
                      : "Check 'Run Immediately' and disable 'Notify When Run' for silent background entry."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. CARD TRANSACTION AUTOMATION RECIPE */}
        {activeTab === "card_tx" && (
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{
              background: groupBg,
              border: groupBorder,
              boxShadow: groupShadow,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[13.5px]">
                <CreditCard size={15} strokeWidth={1.8} />
                <span>
                  {isIndonesian
                    ? "Resep: Sinkronisasi Transaksi Kartu"
                    : "Recipe: Card Transaction Sync"}
                </span>
              </div>
              <button
                type="button"
                onClick={openShortcutsApp}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
              >
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
                <ExternalLink size={10} />
              </button>
            </div>

            <div className="space-y-2 text-[11.5px] text-[var(--text-secondary)]">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  {isIndonesian
                    ? "Buka aplikasi Pintasan › Tab Automasi › (+) Automasi Baru › Pilih 'Transaksi'."
                    : "Open Shortcuts app › Automation tab › (+) New Automation › Select 'Transaction'."}
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  {isIndonesian
                    ? "Pilih kartu Anda (atau Semua Kartu) dan centang 'Jalankan Segera' (Run Immediately)."
                    : "Choose your card (or Any Card) and check 'Run Immediately'."}
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  {isIndonesian
                    ? "Pilih aksi 'Log Card Transaction' dari Accrual dan hubungkan variabel Amount, Merchant, dan Card."
                    : "Select Accrual's 'Log Card Transaction' and map Amount, Merchant, and Card variables."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. BACK TAP RECIPE */}
        {activeTab === "back_tap" && (
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{
              background: groupBg,
              border: groupBorder,
              boxShadow: groupShadow,
            }}
          >
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[13.5px]">
              <Smartphone size={15} strokeWidth={1.8} />
              <span>
                {isIndonesian
                  ? "Resep: Ketuk Bagian Belakang iPhone (Back Tap)"
                  : "Recipe: Link to iPhone Back Tap"}
              </span>
            </div>
            <div className="space-y-2 text-[11.5px] text-[var(--text-secondary)]">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  {isIndonesian
                    ? "Buka Pengaturan iPhone › Aksesibilitas › Sentuh › Ketuk Bagian Belakang."
                    : "Open iPhone Settings › Accessibility › Touch › Back Tap."}
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  {isIndonesian
                    ? "Pilih 'Ketuk Dua Kali' atau 'Ketuk Tiga Kali' › Gulir ke bagian Pintasan."
                    : "Select 'Double Tap' or 'Triple Tap' › Scroll down to Shortcuts."}
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  {isIndonesian
                    ? "Pilih 'Scan Payment Screenshot' atau 'Voice Entry'. Mengetuk punggung iPhone langsung mengekstrak slip atau mencatat suara!"
                    : "Choose 'Scan Payment Screenshot' or 'Voice Entry'. Tapping your iPhone's back immediately prompts entry!"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. ACTION BUTTON RECIPE */}
        {activeTab === "action_button" && (
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{
              background: groupBg,
              border: groupBorder,
              boxShadow: groupShadow,
            }}
          >
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[13.5px]">
              <Sliders size={15} strokeWidth={1.8} />
              <span>
                {isIndonesian
                  ? "Resep: Tombol Tindakan (iPhone 15 Pro / 16)"
                  : "Recipe: Action Button (iPhone 15 Pro / 16)"}
              </span>
            </div>
            <div className="space-y-2 text-[11.5px] text-[var(--text-secondary)]">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  {isIndonesian
                    ? "Buka Pengaturan iPhone › Tombol Tindakan."
                    : "Open iPhone Settings › Action Button."}
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  {isIndonesian
                    ? "Geser ke opsi 'Pintasan' › Ketuk tombol pemilih pintasan."
                    : "Swipe to 'Shortcut' › Tap the shortcut picker button."}
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  {isIndonesian
                    ? "Pilih aksi Accrual seperti 'Voice Entry' atau 'Scan Receipt'. Satu tekanan tombol fisik langsung siap mencatat!"
                    : "Pick an Accrual action such as 'Voice Entry' or 'Scan Receipt'. Press the physical button to log instantly!"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. SIRI COMMANDS RECIPE */}
        {activeTab === "siri" && (
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{
              background: groupBg,
              border: groupBorder,
              boxShadow: groupShadow,
            }}
          >
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[13.5px]">
              <Mic size={15} strokeWidth={1.8} />
              <span>
                {isIndonesian
                  ? "Resep: Perintah Suara Bebas Genggam Siri"
                  : "Recipe: Hands-free Siri Voice Commands"}
              </span>
            </div>
            <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
              {isIndonesian
                ? "Sistem AppShortcutsProvider otomatis mendaftarkan frasa Siri ke iOS saat aplikasi terpasang. Anda cukup memanggil Siri dengan kalimat berikut:"
                : "AppShortcutsProvider automatically indexes Siri phrases into iOS on install. Simply invoke Siri with any of these phrases:"}
            </p>
            <div className="space-y-1.5 font-mono text-[11px]">
              {[
                { en: "Hey Siri, Voice log to Accrual", id: "Hey Siri, Voice log to Accrual" },
                { en: "Hey Siri, Log notification in Accrual", id: "Hey Siri, Catat notifikasi di Accrual" },
                { en: "Hey Siri, Log card payment in Accrual", id: "Hey Siri, Catat transaksi kartu di Accrual" },
                { en: "Hey Siri, Open quick action in Accrual", id: "Hey Siri, Buka catat cepat di Accrual" },
              ].map((item, idx) => {
                const phrase = isIndonesian ? item.id : item.en;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/06 text-[var(--text-primary)]"
                  >
                    <span>"{phrase}"</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(phrase, `phrase-${idx}`, "Frasa Siri")}
                      className="p-1 rounded text-[var(--text-tertiary)] active:text-white cursor-pointer"
                    >
                      {copiedKey === `phrase-${idx}` ? (
                        <Check size={11} className="text-white" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Done Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            className="w-full h-11 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer border"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.09)" : "#18181b",
              borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "#18181b",
              color: "#ffffff",
              boxShadow: groupShadow,
            }}
          >
            <span>{isIndonesian ? "Selesai" : "Done"}</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
