import { useState, useMemo } from "react";
import {
  Sparkles,
  Zap,
  Mic,
  Camera,
  FileText,
  PieChart,
  PlusCircle,
  Edit3,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Search,
  Bell,
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

type ActiveTab =
  | "native_actions"
  | "bank_notif"
  | "back_tap"
  | "action_button"
  | "siri";

interface AppleShortcutsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabType;
}

interface NativeActionItem {
  id: string;
  titleId: string;
  titleEn: string;
  shortDescId: string;
  shortDescEn: string;
  fullDescId: string;
  fullDescEn: string;
  icon: typeof PlusCircle;
  siriPhraseId: string;
  siriPhraseEn: string;
  previewType: "dialog" | "text" | "voice" | "add" | "scan" | "summary";
  testScheme?: string;
}

const NATIVE_ACTIONS: NativeActionItem[] = [
  {
    id: "quick_log",
    titleId: "Catat Pengeluaran Cepat",
    titleEn: "Quick Log Expense",
    shortDescId: "Dialog input bawaan iOS untuk nominal, kategori & dompet",
    shortDescEn: "Native iOS input dialog for amount, category & wallet",
    fullDescId:
      "Aksi pintar yang otomatis memunculkan dialog input nomor, pilihan kategori, dan dompet tanpa perlu membuka aplikasi Accrual. Transaksi langsung tercatat secara hening di latar belakang.",
    fullDescEn:
      "Smart action that triggers native iOS dialogs for numeric amount, category, and wallet selection without launching the app. Transactions are silently recorded in the background.",
    icon: PlusCircle,
    siriPhraseId: "Hey Siri, Catat pengeluaran di Accrual",
    siriPhraseEn: "Hey Siri, Quick log to Accrual",
    previewType: "dialog",
  },
  {
    id: "log_text",
    titleId: "Catat Transaksi dari Teks",
    titleEn: "Log Transaction from Text",
    shortDescId: "Otomasi notifikasi mutasi bank & SMS transaksi",
    shortDescEn: "Automate bank notification & SMS transaction parsing",
    fullDescId:
      "Dirancang khusus untuk automasi iOS saat menerima SMS atau notifikasi mutasi bank (BCA, Mandiri, BRI, BNI, GoPay, Grab). Mesin AI NLP Accrual otomatis mengurai nominal, merchant, dan kategori.",
    fullDescEn:
      "Engineered for iOS Automations triggered by incoming SMS or bank push notifications (BCA, Mandiri, BRI, BNI, GoPay, Grab). Accrual's AI NLP automatically extracts amount, merchant, and category.",
    icon: FileText,
    siriPhraseId: "Hey Siri, Catat teks di Accrual",
    siriPhraseEn: "Hey Siri, Log notification in Accrual",
    previewType: "text",
  },
  {
    id: "voice_log",
    titleId: "Dikte Suara Pengeluaran",
    titleEn: "Voice Log Expense",
    shortDescId: "Ucapkan transaksi natural, AI mengurai otomatis",
    shortDescEn: "Speak transaction naturally, AI parses automatically",
    fullDescId:
      "Cukup ucapkan transaksi belanja Anda (contoh: \"Kopi susu 25 ribu bayar pakai Cash\"). Sangat pas untuk Tombol Tindakan (Action Button) atau pintasan hands-free saat berkendara.",
    fullDescEn:
      "Simply speak your expense (e.g. \"Iced coffee 25 thousand paid with Cash\"). Perfectly suited for the Action Button or hands-free logging while commuting.",
    icon: Mic,
    siriPhraseId: "Hey Siri, Bicara pengeluaran di Accrual",
    siriPhraseEn: "Hey Siri, Voice log to Accrual",
    previewType: "voice",
    testScheme: "accrual://voice",
  },
  {
    id: "quick_add",
    titleId: "Buka Catat Cepat",
    titleEn: "Open Quick Add",
    shortDescId: "1-ketukan langsung membuka lembar transaksi baru",
    shortDescEn: "1-tap launcher directly to new transaction sheet",
    fullDescId:
      "Membuka aplikasi Accrual dan langsung menampilkan lembar pencatatan transaksi dengan fokus pada keypad angka untuk pencatatan secepat kilat.",
    fullDescEn:
      "Launches Accrual directly into the transaction input sheet with instant focus on the numeric keypad for rapid entry.",
    icon: Edit3,
    siriPhraseId: "Hey Siri, Buka pencatatan di Accrual",
    siriPhraseEn: "Hey Siri, Open quick add in Accrual",
    previewType: "add",
    testScheme: "accrual://quick-add",
  },
  {
    id: "scan_receipt",
    titleId: "Pindai Resi & Struk",
    titleEn: "Open Scan Receipt",
    shortDescId: "1-ketukan langsung membuka kamera pemindai OCR",
    shortDescEn: "1-tap camera launcher for instant receipt OCR",
    fullDescId:
      "Langsung mengaktifkan kamera pemindai struk, faktur, dan bukti transfer fisik untuk diekstrak secara otomatis oleh mesin OCR lokal berkecepatan tinggi.",
    fullDescEn:
      "Instantly launches the receipt camera scanner to extract physical receipts, invoices, and payment confirmations via high-speed on-device OCR.",
    icon: Camera,
    siriPhraseId: "Hey Siri, Pindai resi di Accrual",
    siriPhraseEn: "Hey Siri, Scan receipt in Accrual",
    previewType: "scan",
    testScheme: "accrual://scan",
  },
  {
    id: "financial_summary",
    titleId: "Cek Ringkasan Keuangan",
    titleEn: "Get Financial Summary",
    shortDescId: "Cek kekayaan bersih & pengeluaran via Siri/Pintasan",
    shortDescEn: "Check net worth & outflow snapshot via Siri/Shortcuts",
    fullDescId:
      "Mengambil snapshot kekayaan bersih, saldo likuid, dan total pengeluaran bulan ini langsung dari widget App Group tanpa perlu membuka aplikasi.",
    fullDescEn:
      "Retrieves your latest net worth, liquid balance, and monthly outflow snapshot directly from the widget App Group cache without opening the app.",
    icon: PieChart,
    siriPhraseId: "Hey Siri, Ringkasan keuangan di Accrual",
    siriPhraseEn: "Hey Siri, Financial summary in Accrual",
    previewType: "summary",
  },
];

function mapInitialTab(t?: TabType): ActiveTab {
  if (t === "back_tap") return "back_tap";
  if (t === "action_button") return "action_button";
  if (t === "automation" || t === "notification_reader") return "bank_notif";
  return "native_actions";
}

export function AppleShortcutsGuideModal({
  isOpen,
  onClose,
  initialTab,
}: AppleShortcutsGuideModalProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme !== "light";

  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    mapInitialTab(initialTab),
  );
  const [selectedActionId, setSelectedActionId] = useState<string>("quick_log");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedAction = useMemo(
    () =>
      NATIVE_ACTIONS.find((a) => a.id === selectedActionId) ||
      NATIVE_ACTIONS[0],
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

  const handleTestUrl = (scheme?: string) => {
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
        <div className="text-center pt-1 space-y-1 select-none">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/10 bg-white/[0.04] text-[10.5px] font-medium tracking-wide uppercase text-[var(--text-tertiary)]">
            <Sparkles size={11} strokeWidth={1.75} />
            <span>{isIndonesian ? "Integrasi Pintasan Asli iOS" : "Native iOS Shortcuts"}</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            {isIndonesian ? "Automasi Pintasan Accrual" : "Automated Shortcuts Logging"}
          </h2>
          <p className="text-[12px] text-[var(--text-tertiary)] max-w-sm mx-auto leading-relaxed">
            {isIndonesian
              ? "Accrual menyediakan 6 aksi native siap pakai di aplikasi Pintasan iPhone tanpa perlu menyusun alur rumit secara manual."
              : "Accrual provides 6 pre-built native actions in the iPhone Shortcuts app with zero manual block chaining required."}
          </p>
        </div>

        {/* Top Category Tabs */}
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
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-all cursor-pointer border"
                style={{
                  background: isActive ? (isDark ? "rgba(255, 255, 255, 0.12)" : "#18181b") : iconBg,
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

        {/* ── REALISTIC IPHONE SHORTCUTS MOCKUP ── */}
        <div
          className="rounded-3xl p-4 relative overflow-hidden select-none border transition-all"
          style={{
            background: isDark
              ? "radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.08) 0%, rgba(18,18,20,0.98) 75%)"
              : "radial-gradient(ellipse at 50% -20%, rgba(0,0,0,0.03) 0%, #ffffff 85%)",
            borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
            boxShadow: groupShadow,
          }}
        >
          {/* Hardware Notch / Island Representation */}
          <div className="flex items-center justify-between mb-3 px-1 text-[11px] font-mono text-[var(--text-tertiary)]">
            <span>09:20</span>
            <div className="w-16 h-3.5 bg-black rounded-full mx-auto border border-white/10" />
            <div className="flex items-center gap-1">
              <span>5G</span>
              <span>62%</span>
            </div>
          </div>

          {/* Search App Header in iOS Shortcuts (Matching Screenshot 1) */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10">
              <Search size={13} className="text-[var(--text-tertiary)] shrink-0" />
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[11px] font-semibold text-[var(--text-primary)]">
                <span className="w-3.5 h-3.5 rounded-sm bg-black border border-white/20 flex items-center justify-center text-[8px] font-bold">
                  A
                </span>
                <span>Accrual</span>
              </div>
              <span className="text-[11px] text-[var(--text-tertiary)] ml-auto font-mono">
                {NATIVE_ACTIONS.length} {isIndonesian ? "Aksi" : "Actions"}
              </span>
            </div>

            {/* Simulated Native Actions List inside Shortcuts App */}
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
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: isSelected
                            ? "var(--text-primary)"
                            : iconBg,
                          color: isSelected
                            ? isDark
                              ? "#09090c"
                              : "#ffffff"
                            : "var(--text-primary)",
                          border: iconBorder,
                        }}
                      >
                        <ActionIcon size={14} strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                          {isIndonesian ? action.titleId : action.titleEn}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                          {isIndonesian ? action.shortDescId : action.shortDescEn}
                        </div>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center shrink-0 text-[10px] text-[var(--text-tertiary)] font-serif italic">
                      i
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── DETAIL CARD FOR THE SELECTED ACTION ── */}
        <div
          className="p-4 rounded-2xl border space-y-3"
          style={{
            background: groupBg,
            border: groupBorder,
            boxShadow: groupShadow,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Detail Aksi Terpilih" : "Selected Action Details"}
              </span>
              <h3 className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                {isIndonesian ? selectedAction.titleId : selectedAction.titleEn}
              </h3>
            </div>
            {selectedAction.testScheme && (
              <button
                type="button"
                onClick={() => handleTestUrl(selectedAction.testScheme)}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-medium border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <ExternalLink size={11} />
                <span>{isIndonesian ? "Uji Buka" : "Test Run"}</span>
              </button>
            )}
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
                  {isIndonesian ? "Frasa Suara Siri Bawaan" : "Siri Voice Trigger"}
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
              className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-[var(--text-tertiary)] active:text-white transition-colors cursor-pointer"
            >
              {copiedKey === `siri-${selectedAction.id}` ? (
                <Check size={12} className="text-white" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>
        </div>

        {/* ── STEP-BY-STEP RECIPES ACCORDING TO ACTIVE TAB ── */}
        {activeTab === "bank_notif" && (
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{
              background: groupBg,
              border: groupBorder,
              boxShadow: groupShadow,
            }}
          >
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[13.5px]">
              <Bell size={15} strokeWidth={1.8} />
              <span>
                {isIndonesian
                  ? "Resep: Automasi SMS & Notifikasi Bank"
                  : "Recipe: Bank SMS & Notification Automation"}
              </span>
            </div>
            <div className="space-y-2 text-[11.5px] text-[var(--text-secondary)]">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Buka Tab Automasi di Pintasan" : "Open Automation Tab in Shortcuts"}
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
                    {isIndonesian ? "Pilih Pemicu Pesan / Notifikasi" : "Select Message / Notification Trigger"}
                  </div>
                  <div>
                    {isIndonesian
                      ? "Pilih 'Pesan' › Pengirim: Nama Bank (contoh: BCA, Bank Mandiri) › Centang 'Jalankan Segera' (Run Immediately)."
                      : "Select 'Message' › Sender: Your Bank (e.g. BCA, Mandiri) › Check 'Run Immediately'."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Pilih Aksi 'Catat Transaksi dari Teks'" : "Choose Action 'Log Transaction from Text'"}
                  </div>
                  <div>
                    {isIndonesian
                      ? "Cari 'Accrual' › Pilih aksi 'Catat Transaksi dari Teks' › Sambungkan isi pesan bank ke parameter teks. Transaksi otomatis dicatat!"
                      : "Search 'Accrual' › Select 'Log Transaction from Text' › Connect incoming message text to the parameter. Transacted automatically!"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                  ? "Resep: Tautkan ke Ketuk Bagian Belakang (Back Tap)"
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
                    ? "Pilih 'Ketuk Dua Kali' atau 'Ketuk Tiga Kali' › Gulir ke bawah ke bagian Pintasan."
                    : "Select 'Double Tap' or 'Triple Tap' › Scroll down to the Shortcuts section."}
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/05">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  {isIndonesian
                    ? "Pilih 'Catat Pengeluaran' atau 'Dikte Suara'. Kini mengetuk punggung iPhone langsung memicu dialog pencatatan!"
                    : "Choose 'Quick Log Expense' or 'Voice Log Expense'. Tapping your iPhone's back immediately prompts entry!"}
                </div>
              </div>
            </div>
          </div>
        )}

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
                    ? "Pilih aksi Accrual seperti 'Dikte Suara Pengeluaran' atau 'Pindai Resi'. Satu tekanan tombol langsung siap bekerja!"
                    : "Pick an Accrual action such as 'Voice Log Expense' or 'Scan Receipt'. Press once to log instantly!"}
                </div>
              </div>
            </div>
          </div>
        )}

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
                "Hey Siri, Quick log to Accrual",
                "Hey Siri, Catat pengeluaran di Accrual",
                "Hey Siri, Voice log to Accrual",
                "Hey Siri, Financial summary in Accrual",
              ].map((phrase, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/06 text-[var(--text-primary)]"
                >
                  <span>"{phrase}"</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(phrase, `phrase-${idx}`, "Frasa Siri")}
                    className="p-1 rounded text-[var(--text-tertiary)] active:text-white"
                  >
                    {copiedKey === `phrase-${idx}` ? (
                      <Check size={11} className="text-white" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                </div>
              ))}
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
            className="w-full h-11 rounded-2xl font-semibold text-[12.5px] flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer border"
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
