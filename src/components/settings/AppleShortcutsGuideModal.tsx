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
  ChevronLeft,
  CreditCard,
  Plus,
  ArrowUpRight,
  ShieldCheck,
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

export type DetailViewType =
  | "voice_entry"
  | "screen_scanner"
  | "quick_action"
  | "scan_receipt"
  | "notification_reader"
  | "apple_pay";

interface AppleShortcutsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabType;
}

function resolveInitialDetail(tab?: TabType): DetailViewType | null {
  if (tab === "notification_reader" || tab === "automation") return "notification_reader";
  if (tab === "screen_scan" || tab === "back_tap") return "screen_scanner";
  if (tab === "action_button") return "voice_entry";
  return null;
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

  const [detailView, setDetailView] = useState<DetailViewType | null>(() =>
    resolveInitialDetail(initialTab),
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  // 6 Native Actions Catalog
  const nativeActionsCatalog = useMemo(
    () => [
      {
        id: "card_transaction",
        name: "Log Card Transaction",
        descId: "Sinkronkan transaksi kartu nirsentuh otomatis",
        descEn: "Sync card and contactless payments directly",
        icon: CreditCard,
      },
      {
        id: "notif_reader",
        name: "Log Notification Transaction",
        descId: "Urai mutasi notifikasi bank & e-wallet",
        descEn: "Extract bank & wallet push notifications",
        icon: Bell,
      },
      {
        id: "quick_action",
        name: "Open Accrual Quick Action",
        descId: "Buka formulir catat transaksi baru sekejap",
        descEn: "Instantly open transaction keypad sheet",
        icon: Plus,
      },
      {
        id: "screen_scanner",
        name: "Scan Payment Screenshot",
        descId: "Pindai tangkapan layar bukti transfer / QRIS",
        descEn: "Process screenshot of transfer or QRIS receipt",
        icon: Smartphone,
      },
      {
        id: "scan_receipt",
        name: "Scan Receipt",
        descId: "Buka kamera pemindai struk fisik & faktur",
        descEn: "Open camera scanner for receipts & invoices",
        icon: Camera,
      },
      {
        id: "voice_entry",
        name: "Voice Entry",
        descId: "Dikte suara alami tanpa sentuh tombol",
        descEn: "Hands-free natural speech entry",
        icon: Mic,
      },
    ],
    [],
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="">
      <div
        className="px-4 pb-8 space-y-5"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
        }}
      >
        {/* ==================================================================== */}
        {/* ACCRUAL SHORTCUTS HUB                                                */}
        {/* ==================================================================== */}
        {!detailView && (
          <div className="space-y-6 pt-1">
            {/* Header Hero */}
            <div className="space-y-1.5 select-none">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/10 bg-white/[0.04] text-[10.5px] font-medium tracking-wide uppercase text-[var(--text-tertiary)]">
                <Sparkles size={11} strokeWidth={1.75} />
                <span>
                  {isIndonesian ? "Pusat Integrasi iOS" : "Apple Ecosystem Suite"}
                </span>
              </div>
              <h2 className="text-[22px] font-semibold text-[var(--text-primary)] tracking-tight">
                {isIndonesian ? "Pintasan Apple" : "Apple Shortcuts"}
              </h2>
              <p className="text-[12.5px] text-[var(--text-tertiary)] leading-relaxed">
                {isIndonesian
                  ? "Catat transaksi secara instan tanpa perlu membuka aplikasi Accrual."
                  : "Quickly log new transactions without opening Accrual."}
              </p>
            </div>

            {/* SEKSI 1: SHORTCUTS (PINTASAN CEPAT) */}
            <div className="space-y-2.5">
              <div className="space-y-0.5 px-0.5">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian ? "Pintasan" : "Shortcuts"}
                </h3>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Tersedia untuk Pintasan, Siri, Tombol Tindakan & Ketukan Belakang."
                    : "Available for Shortcuts, Siri, Action Button and Back Tap."}
                </p>
              </div>

              <div className="space-y-2">
                {/* Voice Entry Item */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                  style={{
                    background: groupBg,
                    border: groupBorder,
                    boxShadow: groupShadow,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: iconBg, border: iconBorder }}
                    >
                      <Mic size={16} strokeWidth={1.8} className="text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {isIndonesian ? "Dikte Suara" : "Voice Entry"}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {isIndonesian
                          ? "Catat transaksi dengan berbicara santai"
                          : "Add a transaction by speaking"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setDetailView("voice_entry");
                    }}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border border-white/10 bg-white/[0.06] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus size={12} strokeWidth={2} />
                    <span>{isIndonesian ? "Tambah" : "Add"}</span>
                  </button>
                </div>

                {/* Screen Scanner Item */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                  style={{
                    background: groupBg,
                    border: groupBorder,
                    boxShadow: groupShadow,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: iconBg, border: iconBorder }}
                    >
                      <Smartphone size={16} strokeWidth={1.8} className="text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {isIndonesian ? "Pindai Tangkapan Layar" : "Screen Scanner"}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {isIndonesian
                          ? "Catat transaksi dari screenshot atau QRIS"
                          : "Add a transaction from screenshot"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setDetailView("screen_scanner");
                    }}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border border-white/10 bg-white/[0.06] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus size={12} strokeWidth={2} />
                    <span>{isIndonesian ? "Tambah" : "Add"}</span>
                  </button>
                </div>

                {/* Quick Action Item */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                  style={{
                    background: groupBg,
                    border: groupBorder,
                    boxShadow: groupShadow,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: iconBg, border: iconBorder }}
                    >
                      <Plus size={16} strokeWidth={1.8} className="text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {isIndonesian ? "Buka Catat Cepat" : "Quick Action"}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {isIndonesian
                          ? "Buka formulir pencatatan secepat kilat"
                          : "Instantly open the transaction keypad"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setDetailView("quick_action");
                    }}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border border-white/10 bg-white/[0.06] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus size={12} strokeWidth={2} />
                    <span>{isIndonesian ? "Tambah" : "Add"}</span>
                  </button>
                </div>

                {/* Scan Receipt Item */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                  style={{
                    background: groupBg,
                    border: groupBorder,
                    boxShadow: groupShadow,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: iconBg, border: iconBorder }}
                    >
                      <Camera size={16} strokeWidth={1.8} className="text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {isIndonesian ? "Pindai Resi & Struk" : "Scan Receipt"}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {isIndonesian
                          ? "Pindai bukti bayar atau struk belanjaan"
                          : "Scan physical receipts and invoices"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setDetailView("scan_receipt");
                    }}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border border-white/10 bg-white/[0.06] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus size={12} strokeWidth={2} />
                    <span>{isIndonesian ? "Tambah" : "Add"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SEKSI 2: AUTOMATIONS (AUTOMASI LATAR BELAKANG) */}
            <div className="space-y-2.5">
              <div className="space-y-0.5 px-0.5">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian ? "Automasi" : "Automations"}
                </h3>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Sinkronisasi mutasi transaksi secara otomatis di latar belakang."
                    : "Automatically sync your transactions in the background."}
                </p>
              </div>

              <div className="space-y-2">
                {/* Notification Reader Item */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                  style={{
                    background: groupBg,
                    border: groupBorder,
                    boxShadow: groupShadow,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: iconBg, border: iconBorder }}
                    >
                      <Bell size={16} strokeWidth={1.8} className="text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {isIndonesian ? "Pembaca Notifikasi Bank" : "Notification Reader"}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {isIndonesian
                          ? "Catat otomatis dari notifikasi bank & e-wallet"
                          : "Log transactions from notifications of your bank app"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setDetailView("notification_reader");
                    }}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border border-white/10 bg-white/[0.06] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
                  >
                    <ArrowUpRight size={12} strokeWidth={2} />
                    <span>{isIndonesian ? "Atur" : "Setup"}</span>
                  </button>
                </div>

                {/* Apple Pay Sync Item */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                  style={{
                    background: groupBg,
                    border: groupBorder,
                    boxShadow: groupShadow,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: iconBg, border: iconBorder }}
                    >
                      <Zap size={16} strokeWidth={1.8} className="text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {isIndonesian ? "Sinkronisasi Transaksi Kartu" : "Card Transaction Sync"}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {isIndonesian
                          ? "Sinkronkan transaksi kartu nirsentuh & dompet digital"
                          : "Sync card and contactless transactions directly"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setDetailView("apple_pay");
                    }}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border border-white/10 bg-white/[0.06] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
                  >
                    <ArrowUpRight size={12} strokeWidth={2} />
                    <span>{isIndonesian ? "Atur" : "Setup"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SEKSI 3: CATALOG OF 6 NATIVE SHORTCUT ACTIONS */}
            <div
              className="p-4 rounded-2xl border space-y-3"
              style={{
                background: isDark
                  ? "radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.06) 0%, rgba(18,18,20,0.98) 75%)"
                  : "radial-gradient(ellipse at 50% -20%, rgba(0,0,0,0.03) 0%, #ffffff 85%)",
                border: groupBorder,
                boxShadow: groupShadow,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                    {isIndonesian
                      ? "6 Aksi Bawaan di Aplikasi Pintasan"
                      : "6 Native Actions in Shortcuts App"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openShortcutsApp}
                  className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                >
                  <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
                  <ExternalLink size={11} />
                </button>
              </div>

              <div className="space-y-1.5">
                {nativeActionsCatalog.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/06"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: iconBg, border: iconBorder }}
                        >
                          <ItemIcon size={13} className="text-[var(--text-primary)]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-[var(--text-primary)] truncate font-mono">
                            {item.name}
                          </div>
                          <div className="text-[10.5px] text-[var(--text-tertiary)] truncate">
                            {isIndonesian ? item.descId : item.descEn}
                          </div>
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center shrink-0 text-[10px] text-[var(--text-tertiary)] font-serif italic">
                        i
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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
        )}

        {/* ==================================================================== */}
        {/* DETAIL VIEW: NOTIFICATION READER                                     */}
        {/* ==================================================================== */}
        {detailView === "notification_reader" && (
          <div className="space-y-5 pt-1">
            {/* Top Back Navigation Bar */}
            <div className="flex items-center justify-between select-none">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setDetailView(null);
                }}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer py-1"
              >
                <ChevronLeft size={16} />
                <span>{isIndonesian ? "Pusat Pintasan" : "Shortcuts"}</span>
              </button>

              <button
                type="button"
                onClick={openShortcutsApp}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <ExternalLink size={11} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
                {isIndonesian ? "Pembaca Notifikasi Bank" : "Notification Reader"}
              </h2>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                {isIndonesian
                  ? "Catat transaksi otomatis saat ponsel menerima notifikasi mutasi perbankan atau dompet digital."
                  : "Log transactions automatically from push notifications of your banking and e-wallet apps."}
              </p>
            </div>

            {/* HERO VISUAL MOCKUP: SHORTCUTS ACTION CARD */}
            <div
              className="p-4 rounded-2xl border space-y-3 select-none"
              style={{
                background: isDark
                  ? "linear-gradient(180deg, #18181d 0%, #121215 100%)"
                  : "linear-gradient(180deg, #ffffff 0%, #f4f4f7 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: groupShadow,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-black border border-white/20 flex items-center justify-center text-[9px] font-bold text-white">
                    A
                  </div>
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                    Log Notification Transaction
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)]">
                  AppIntent
                </span>
              </div>

              {/* Exact Parameter Representation with Blue Variable Pills */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-[12.5px] leading-relaxed text-zinc-300 font-sans">
                <span>Log notification </span>
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[11px] font-semibold">
                  Notification
                </span>
                <span> titled </span>
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[11px] font-semibold">
                  Title
                </span>
                <span> subtitled </span>
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[11px] font-semibold">
                  Subtitle
                </span>
                <span> from </span>
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[11px] font-semibold">
                  App
                </span>
                <span> at </span>
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[11px] font-semibold">
                  Received At
                </span>
              </div>
            </div>

            {/* STEP BY STEP STEPPER */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                {isIndonesian ? "Langkah Pengaturan" : "Setup Instructions"}
              </h3>

              <div className="space-y-2.5 text-[12px]">
                {/* Step 1 */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {isIndonesian ? "Pilih Tab Automasi" : "Choose Automation"}
                    </div>
                    <div className="text-[var(--text-secondary)] leading-relaxed">
                      {isIndonesian
                        ? "Buka aplikasi Pintasan, pilih tab 'Automasi' di bilah bawah, lalu ketuk (+) untuk membuat Automasi Pribadi."
                        : "In the Shortcuts app, select the 'Automation' tab at the bottom, then tap (+) to create a Personal Automation."}
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {isIndonesian
                        ? "Pilih Pemicu Notifikasi"
                        : "Choose When I Receive Notification"}
                    </div>
                    <div className="text-[var(--text-secondary)] leading-relaxed">
                      {isIndonesian
                        ? "Pilih pemicu 'Saat Menerima Notifikasi' (When I Receive Notification)."
                        : "Select 'When I Receive Notification' as the automation trigger."}
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {isIndonesian
                        ? "Pilih Aplikasi Finansial Anda"
                        : "Choose Source Apps"}
                    </div>
                    <div className="text-[var(--text-secondary)] leading-relaxed">
                      {isIndonesian
                        ? "Pilih aplikasi perbankan atau e-wallet (misal: BCA, Livin by Mandiri, BRImo, GoPay, DANA, OVO, ShopeePay, Seabank)."
                        : "Select your banking or wallet apps (e.g. BCA, Livin by Mandiri, BRImo, GoPay, DANA, OVO, ShopeePay, Seabank)."}
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {isIndonesian ? "Tambahkan Aksi Accrual" : "Add the Accrual Action"}
                    </div>
                    <div className="text-[var(--text-secondary)] leading-relaxed">
                      {isIndonesian
                        ? "Cari 'Accrual', lalu pilih aksi 'Log Notification Transaction'."
                        : "Search for 'Accrual', then select the 'Log Notification Transaction' action."}
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </span>
                  <div className="space-y-1.5 w-full">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {isIndonesian ? "Petakan Variabel Pintasan" : "Map Variables"}
                    </div>
                    <div className="text-[var(--text-secondary)] leading-relaxed">
                      {isIndonesian
                        ? "Ketuk setiap parameter aksi dan sambungkan variabel bawaan notifikasi iOS:"
                        : "Tap each parameter and connect the corresponding notification variable token:"}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-mono">
                      <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-zinc-300">
                        Notification → <span className="text-[#5AC8FA]">Notification</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-zinc-300">
                        Title → <span className="text-[#5AC8FA]">Title</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-zinc-300">
                        Subtitle → <span className="text-[#5AC8FA]">Subtitle</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-zinc-300">
                        App → <span className="text-[#5AC8FA]">App</span>
                      </div>
                      <div className="col-span-2 p-1.5 rounded-lg bg-black/40 border border-white/10 text-zinc-300">
                        Received At → <span className="text-[#5AC8FA]">Current Date</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                    6
                  </span>
                  <div className="space-y-1">
                    <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-white" />
                      <span>
                        {isIndonesian
                          ? "Filter Promo Otomatis & Eksekusi Hening"
                          : "Smart Promo Filter & Silent Execution"}
                      </span>
                    </div>
                    <div className="text-[var(--text-secondary)] leading-relaxed">
                      {isIndonesian
                        ? "Pilih 'Jalankan Segera' (Run Immediately) dan matikan 'Beri Tahu Saat Dijalankan'. Accrual otomatis menyaring dan mengabaikan notifikasi promosi belanja, diskon, cashback, atau kupon voucher."
                        : "Select 'Run Immediately' and turn off 'Notify When Run'. Accrual automatically detects and ignores marketing promotions, vouchers, discounts, and spam pushes."}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={openShortcutsApp}
                className="flex-1 h-11 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer border"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.09)" : "#18181b",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "#18181b",
                  color: "#ffffff",
                  boxShadow: groupShadow,
                }}
              >
                <ExternalLink size={13} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailView(null)}
                className="h-11 px-5 rounded-2xl font-semibold text-[13px] flex items-center justify-center border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <span>{isIndonesian ? "Selesai" : "Done"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DETAIL VIEW: SCREEN SCANNER                                         */}
        {/* ==================================================================== */}
        {detailView === "screen_scanner" && (
          <div className="space-y-5 pt-1">
            {/* Top Back Navigation Bar */}
            <div className="flex items-center justify-between select-none">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setDetailView(null);
                }}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer py-1"
              >
                <ChevronLeft size={16} />
                <span>{isIndonesian ? "Pusat Pintasan" : "Shortcuts"}</span>
              </button>

              <button
                type="button"
                onClick={openShortcutsApp}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <ExternalLink size={11} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
                {isIndonesian ? "Pindai Tangkapan Layar" : "Screen Scanner"}
              </h2>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                {isIndonesian
                  ? "Catat transaksi dengan memindai tangkapan layar bukti bayar, QRIS, atau slip perbankan."
                  : "Add a transaction by scanning a payment screenshot, QRIS slip, or bank confirmation."}
              </p>
            </div>

            {/* HERO PHONE MOCKUP */}
            <div
              className="p-5 rounded-3xl border relative overflow-hidden select-none"
              style={{
                background: isDark
                  ? "radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.08) 0%, rgba(18,18,20,0.98) 75%)"
                  : "radial-gradient(ellipse at 50% -20%, rgba(0,0,0,0.03) 0%, #ffffff 85%)",
                border: groupBorder,
                boxShadow: groupShadow,
              }}
            >
              <div className="w-36 mx-auto p-3 rounded-2xl bg-black/60 border border-white/15 space-y-2 shadow-2xl">
                <div className="w-8 h-1 bg-white/20 rounded-full mx-auto" />
                <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-center space-y-1">
                  <Camera size={18} className="mx-auto text-white/80" />
                  <div className="text-[9px] font-semibold text-white">QRIS / Slip Scan</div>
                  <div className="text-[8px] font-mono text-[#5AC8FA]">Rp 150.000</div>
                </div>
                <div className="text-[8px] text-center text-zinc-400 font-mono">
                  Scan Payment Screenshot
                </div>
              </div>
            </div>

            {/* STEP BY STEP */}
            <div className="space-y-2.5 text-[12px]">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Buka Aplikasi Pintasan" : "Open Shortcuts"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Buka aplikasi Pintasan › Buat pintasan baru atau cari 'Scan Payment Screenshot' dari Accrual."
                      : "Open Shortcuts app › Create a new shortcut or find 'Scan Payment Screenshot' from Accrual."}
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian
                      ? "Atur Ketukan Belakang atau Tombol Tindakan"
                      : "Setup Back Tap or Action Button"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Buka Pengaturan iPhone › Aksesibilitas › Sentuh › Ketuk Bagian Belakang (pilih Ketuk Dua Kali atau Tiga Kali) dan arahkan ke aksi Accrual, atau atur pada Pengaturan › Tombol Tindakan."
                      : "Go to iPhone Settings › Accessibility › Touch › Back Tap (assign to Double Tap or Triple Tap) and select the Accrual action, or configure under Settings › Action Button."}
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Gunakan di Mana Saja" : "Use it Anywhere"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Saat berada di aplikasi bank atau bukti transfer, ambil tangkapan layar lalu ketuk punggung iPhone Anda. Transaksi langsung dipindai dan dicatat."
                      : "Whenever you complete a payment or view a bank slip, take a screenshot and tap your iPhone back. The transaction is instantly extracted and logged."}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={openShortcutsApp}
                className="flex-1 h-11 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer border"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.09)" : "#18181b",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "#18181b",
                  color: "#ffffff",
                  boxShadow: groupShadow,
                }}
              >
                <ExternalLink size={13} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailView(null)}
                className="h-11 px-5 rounded-2xl font-semibold text-[13px] flex items-center justify-center border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <span>{isIndonesian ? "Selesai" : "Done"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DETAIL VIEW: APPLE PAY SYNC                                         */}
        {/* ==================================================================== */}
        {detailView === "apple_pay" && (
          <div className="space-y-5 pt-1">
            {/* Top Back Navigation Bar */}
            <div className="flex items-center justify-between select-none">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setDetailView(null);
                }}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer py-1"
              >
                <ChevronLeft size={16} />
                <span>{isIndonesian ? "Pusat Pintasan" : "Shortcuts"}</span>
              </button>

              <button
                type="button"
                onClick={openShortcutsApp}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <ExternalLink size={11} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
                {isIndonesian ? "Sinkronisasi Transaksi Kartu" : "Card Transaction Sync"}
              </h2>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                {isIndonesian
                  ? "Sinkronkan setiap pembayaran kartu nirsentuh langsung ke catatan buku kas Accrual."
                  : "Automatically sync every card and contactless transaction directly into your Accrual ledger."}
              </p>
            </div>

            {/* Action Card Mockup */}
            <div
              className="p-4 rounded-2xl border space-y-3 select-none"
              style={{
                background: isDark
                  ? "linear-gradient(180deg, #18181d 0%, #121215 100%)"
                  : "linear-gradient(180deg, #ffffff 0%, #f4f4f7 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: groupShadow,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-black border border-white/20 flex items-center justify-center text-[9px] font-bold text-white">
                    A
                  </div>
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                    Log Card Transaction
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)]">
                  AppIntent
                </span>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-[12.5px] leading-relaxed text-zinc-300 font-sans">
                <span>Log card transaction </span>
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[11px] font-semibold">
                  Amount
                </span>
                <span> at </span>
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[11px] font-semibold">
                  Merchant
                </span>
                <span> with </span>
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#007AFF]/25 text-[#5AC8FA] border border-[#007AFF]/40 font-mono text-[11px] font-semibold">
                  Card
                </span>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2.5 text-[12px]">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Buat Automasi Transaksi" : "Create Transaction Automation"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Di aplikasi Pintasan › Automasi › (+) Automasi Baru › Pilih 'Transaksi'."
                      : "In Shortcuts app › Automation › (+) New Automation › Select 'Transaction'."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Pilih Kartu & Jalankan Segera" : "Choose Card & Run Immediately"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Pilih 'Kartu Apa Pun' atau kartu tertentu, lalu centang 'Jalankan Segera' (Run Immediately)."
                      : "Select 'Any Card' or a specific card, and check 'Run Immediately'."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Hubungkan Aksi Accrual" : "Connect Accrual Action"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Pilih aksi 'Log Card Transaction' dan sambungkan variabel Amount, Merchant, dan Card."
                      : "Select 'Log Card Transaction' and map Amount, Merchant, and Card variables."}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={openShortcutsApp}
                className="flex-1 h-11 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer border"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.09)" : "#18181b",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "#18181b",
                  color: "#ffffff",
                  boxShadow: groupShadow,
                }}
              >
                <ExternalLink size={13} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailView(null)}
                className="h-11 px-5 rounded-2xl font-semibold text-[13px] flex items-center justify-center border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <span>{isIndonesian ? "Selesai" : "Done"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DETAIL VIEW: VOICE ENTRY                                            */}
        {/* ==================================================================== */}
        {detailView === "voice_entry" && (
          <div className="space-y-5 pt-1">
            {/* Top Back Navigation Bar */}
            <div className="flex items-center justify-between select-none">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setDetailView(null);
                }}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer py-1"
              >
                <ChevronLeft size={16} />
                <span>{isIndonesian ? "Pusat Pintasan" : "Shortcuts"}</span>
              </button>

              <button
                type="button"
                onClick={openShortcutsApp}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <ExternalLink size={11} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
                {isIndonesian ? "Dikte Suara Transaksi" : "Voice Entry"}
              </h2>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                {isIndonesian
                  ? "Ucapkan belanja Anda secara alami dan biarkan AI NLP Accrual mengurainya otomatis."
                  : "Speak your expense naturally and let Accrual's AI NLP parse amount, category, and wallet."}
              </p>
            </div>

            {/* Siri Phrases Card */}
            <div
              className="p-4 rounded-2xl border space-y-3"
              style={{
                background: groupBg,
                border: groupBorder,
                boxShadow: groupShadow,
              }}
            >
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[13px]">
                <Mic size={15} strokeWidth={1.8} />
                <span>
                  {isIndonesian ? "Frasa Perintah Suara Siri" : "Siri Voice Phrases"}
                </span>
              </div>
              <div className="space-y-2">
                {[
                  {
                    phrase: isIndonesian
                      ? "Hey Siri, Voice log to Accrual"
                      : "Hey Siri, Voice log to Accrual",
                    desc: isIndonesian
                      ? "Memulai dikte transaksi secara langsung"
                      : "Starts hands-free expense dictation",
                  },
                  {
                    phrase: isIndonesian
                      ? "Hey Siri, Catat pengeluaran di Accrual"
                      : "Hey Siri, Quick log to Accrual",
                    desc: isIndonesian
                      ? "Membuka dialog pencatatan interaktif"
                      : "Prompts native interactive entry dialog",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/06"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-[12px] font-mono font-semibold text-[var(--text-primary)] truncate">
                        "{item.phrase}"
                      </div>
                      <div className="text-[10.5px] text-[var(--text-tertiary)] truncate">
                        {item.desc}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.phrase, `siri-${idx}`, "Frasa Siri")}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-[var(--text-tertiary)] active:text-white transition-colors cursor-pointer shrink-0"
                    >
                      {copiedKey === `siri-${idx}` ? (
                        <Check size={12} className="text-white" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2.5 text-[12px]">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Pasang ke Tombol Tindakan" : "Assign to Action Button"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Buka Pengaturan iPhone › Tombol Tindakan › Pilih 'Pintasan' › Arahkan ke 'Voice Entry' Accrual."
                      : "Go to iPhone Settings › Action Button › Choose 'Shortcut' › Select Accrual's 'Voice Entry'."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Bicara Secara Santai" : "Speak Naturally"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Cukup katakan: 'Kopi susu 25 ribu bayar pakai BCA' atau 'Beli bensin 50rb Cash'. Data langsung rapi di pembukuan."
                      : "Simply say: 'Coffee 25 thousand paid with BCA' or 'Gasoline 50k Cash'. Parsed seamlessly."}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={openShortcutsApp}
                className="flex-1 h-11 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer border"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.09)" : "#18181b",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "#18181b",
                  color: "#ffffff",
                  boxShadow: groupShadow,
                }}
              >
                <ExternalLink size={13} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailView(null)}
                className="h-11 px-5 rounded-2xl font-semibold text-[13px] flex items-center justify-center border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <span>{isIndonesian ? "Selesai" : "Done"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DETAIL VIEW: QUICK ACTION & SCAN RECEIPT                            */}
        {/* ==================================================================== */}
        {(detailView === "quick_action" || detailView === "scan_receipt") && (
          <div className="space-y-5 pt-1">
            {/* Top Back Navigation Bar */}
            <div className="flex items-center justify-between select-none">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setDetailView(null);
                }}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer py-1"
              >
                <ChevronLeft size={16} />
                <span>{isIndonesian ? "Pusat Pintasan" : "Shortcuts"}</span>
              </button>

              <button
                type="button"
                onClick={openShortcutsApp}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <ExternalLink size={11} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
                {detailView === "quick_action"
                  ? isIndonesian
                    ? "Buka Catat Cepat"
                    : "Open Quick Action"
                  : isIndonesian
                    ? "Pindai Resi & Struk"
                    : "Scan Receipt"}
              </h2>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                {detailView === "quick_action"
                  ? isIndonesian
                    ? "Langsung membuka formulir transaksi dengan fokus instan pada keypad angka."
                    : "Instantly launches the transaction entry modal with direct keypad focus."
                  : isIndonesian
                    ? "Langsung membuka kamera pemindai struk fisik, nota, dan bukti bayar via OCR lokal."
                    : "Instantly activates the camera scanner for physical receipts and invoices via high-speed on-device OCR."}
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-2.5 text-[12px]">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Tambahkan ke Layar Utama" : "Add to Home Screen"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Buka aplikasi Pintasan › Tekan lama pintasan Accrual › Pilih 'Tambahkan ke Layar Utama'."
                      : "Open Shortcuts app › Long-press the Accrual action › Select 'Add to Home Screen'."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/06">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isIndonesian
                      ? "Tautkan ke Pusat Kontrol (iOS 18)"
                      : "Link to Control Center (iOS 18)"}
                  </div>
                  <div className="text-[var(--text-secondary)] leading-relaxed">
                    {isIndonesian
                      ? "Di iOS 18, Anda dapat meletakkan tombol pintasan langsung di Pusat Kontrol atau Layar Terkunci untuk akses 1-ketukan."
                      : "In iOS 18, place this action directly on your Control Center or Lock Screen for instant 1-tap capture."}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={openShortcutsApp}
                className="flex-1 h-11 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer border"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.09)" : "#18181b",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "#18181b",
                  color: "#ffffff",
                  boxShadow: groupShadow,
                }}
              >
                <ExternalLink size={13} />
                <span>{isIndonesian ? "Buka Pintasan" : "Open Shortcuts"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailView(null)}
                className="h-11 px-5 rounded-2xl font-semibold text-[13px] flex items-center justify-center border border-white/10 bg-white/[0.04] text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <span>{isIndonesian ? "Selesai" : "Done"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
