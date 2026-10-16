import React, { useState, useMemo } from "react";
import {
  BookOpen,
  User,
  Briefcase,
  Store,
  Plane,
  Building2,
  Sparkles,
  Layers,
  Wallet,
  Landmark,
  TrendingUp,
  Coins,
  Plus,
  Check,
  Trash2,
  Edit3,
  AlertTriangle,
  ArrowRightLeft,
  Users,
  QrCode,
  Share2,
  Star,
  ArrowLeft,
  Clock,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { SharedLedgerDetailSheet } from "./SharedLedgerDetailSheet";
import { JoinLedgerContent } from "./JoinLedgerModal";
import { useSpace, type MoneySpace } from "../../contexts/SpaceContext";
import { useAllTransactions } from "../../hooks/useTransactions";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useQuota } from "../../hooks/useQuota";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useCurrency } from "../../contexts/CurrencyContext";

interface ManageLedgersSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin?: () => void;
}

const LEDGER_ICONS = [
  {
    name: "BookOpen",
    label: "General Book",
    labelId: "Buku Kas Umum",
    icon: BookOpen,
  },
  {
    name: "Users",
    label: "Shared / Family",
    labelId: "Bersama / Keluarga",
    icon: Users,
  },
  { name: "User", label: "Personal", labelId: "Pribadi", icon: User },
  {
    name: "Briefcase",
    label: "Business",
    labelId: "Bisnis / Kantor",
    icon: Briefcase,
  },
  {
    name: "Store",
    label: "Merchant / Shop",
    labelId: "Toko / Usaha",
    icon: Store,
  },
  {
    name: "Building2",
    label: "Corporate / Real Estate",
    labelId: "Properti / Korporasi",
    icon: Building2,
  },
  {
    name: "Plane",
    label: "Travel / Trip",
    labelId: "Perjalanan / Liburan",
    icon: Plane,
  },
  {
    name: "Sparkles",
    label: "Lifestyle / Luxury",
    labelId: "Gaya Hidup",
    icon: Sparkles,
  },
  {
    name: "Layers",
    label: "Consolidated",
    labelId: "Terkonsolidasi",
    icon: Layers,
  },
  { name: "Wallet", label: "Savings", labelId: "Tabungan", icon: Wallet },
  {
    name: "Landmark",
    label: "Tax / Treasury",
    labelId: "Pajak / Kas Negara",
    icon: Landmark,
  },
  {
    name: "TrendingUp",
    label: "Investments",
    labelId: "Investasi",
    icon: TrendingUp,
  },
  {
    name: "Coins",
    label: "Crypto / Capital",
    labelId: "Kripto / Modal",
    icon: Coins,
  },
];

const SPACE_CURRENCIES = [
  "IDR",
  "USD",
  "SGD",
  "EUR",
  "JPY",
  "MYR",
  "AUD",
] as const;

export function ManageLedgersSheet({
  isOpen,
  onClose,
  onOpenLogin,
}: ManageLedgersSheetProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const {
    activeSpaceId,
    spaces,
    defaultSpaceId,
    setActiveSpaceId,
    setDefaultLedger,
    addCustomSpace,
    updateCustomSpace,
    deleteCustomSpace,
    filterTransactionsBySpace,
  } = useSpace();

  const { preferredCurrency } = useCurrency();
  const { data: transactions = [] } = useAllTransactions();
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { checkLedgerAndPrompt, canCreateLedger } = useQuota();
  const { isPremium } = useSubscription();

  const userLedgersCount = useMemo(
    () => spaces.filter((s) => s.id !== "all").length,
    [spaces],
  );

  const [viewState, setViewState] = useState<
    "list" | "create" | "edit" | "delete_confirm" | "join"
  >("list");
  const [selectedLedger, setSelectedLedger] = useState<MoneySpace | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIcon, setFormIcon] = useState("BookOpen");
  const [formCurrency, setFormCurrency] = useState<string>(preferredCurrency || "IDR");
  const [formIsShared, setFormIsShared] = useState(false);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [reassignToPersonal, setReassignToPersonal] = useState(true);

  // Collaboration sheets state
  const [sharedDetailOpen, setSharedDetailOpen] = useState(false);
  const [targetSharedLedger, setTargetSharedLedger] =
    useState<MoneySpace | null>(null);

  // Calculate transaction count per ledger using single source of truth filterTransactionsBySpace
  const transactionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    spaces.forEach((s) => {
      counts[s.id] = filterTransactionsBySpace(transactions, s.id).length;
    });

    return counts;
  }, [spaces, transactions, filterTransactionsBySpace]);

  const renderIcon = (iconName: string, size = 16) => {
    const matched = LEDGER_ICONS.find(
      (item) => item.name.toLowerCase() === (iconName || "").toLowerCase(),
    );
    const IconComp = matched ? matched.icon : BookOpen;
    return <IconComp size={size} strokeWidth={1.8} />;
  };

  const handleOpenCreate = () => {
    triggerHaptic("light");
    if (!checkLedgerAndPrompt(userLedgersCount)) {
      return;
    }
    setFormName("");
    setFormDescription("");
    setFormIcon("Briefcase");
    setFormCurrency(preferredCurrency || "IDR");
    setFormIsShared(false);
    setFormIsDefault(false);
    setViewState("create");
  };

  const handleOpenEdit = (ledger: MoneySpace, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");
    setSelectedLedger(ledger);
    setFormName(ledger.name);
    setFormDescription(ledger.description || "");
    setFormIcon(ledger.icon || "BookOpen");
    setFormCurrency(ledger.currency || "IDR");
    setFormIsShared(Boolean(ledger.is_shared));
    setFormIsDefault(ledger.id === defaultSpaceId);
    setViewState("edit");
  };

  const handleSetDefault = async (
    ledgerId: string,
    ledgerName: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    triggerHaptic("medium");
    await setDefaultLedger(ledgerId);
    showToast(
      isIndonesian
        ? `"${ledgerName}" dijadikan space utama bawaan.`
        : `"${ledgerName}" set as default space.`,
      "update",
      () => {},
    );
  };

  const handleOpenDelete = (ledger: MoneySpace, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("heavy");
    setSelectedLedger(ledger);
    setReassignToPersonal(true);
    setViewState("delete_confirm");
  };

  const handleSelectLedger = (id: string) => {
    const selected = spaces.find((s) => s.id === id);
    if (selected?.member_status === "pending") {
      triggerHaptic("heavy");
      showToast(
        isIndonesian
          ? `Space "${selected.name}" masih menunggu persetujuan dari pemilik.`
          : `Space "${selected.name}" is awaiting owner approval.`,
        "delete",
        () => {},
      );
      return;
    }

    triggerHaptic("medium");
    setActiveSpaceId(id);
    showToast(
      isIndonesian
        ? `Space aktif: ${selected?.name || "Space"}`
        : `Active space: ${selected?.name || "Space"}`,
      "update",
      () => {},
    );
    onClose();
  };

  const handleShareLedger = (ledger: MoneySpace, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");
    if (!ledger.is_shared) {
      updateCustomSpace(ledger.id, { is_shared: true });
      const updated = { ...ledger, is_shared: true };
      setTargetSharedLedger(updated);
    } else {
      setTargetSharedLedger(ledger);
    }
    setSharedDetailOpen(true);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast(
        isIndonesian ? "Nama space wajib diisi" : "Space name is required",
        "delete",
        () => {},
      );
      return;
    }

    triggerHaptic("medium");
    const created = addCustomSpace({
      name: formName.trim(),
      description: formDescription.trim(),
      icon: formIcon,
      currency: formCurrency,
      is_shared: formIsShared,
    });

    if (formIsDefault) {
      await setDefaultLedger(created.id);
    }

    setActiveSpaceId(created.id);
    setViewState("list");
    showToast(
      isIndonesian
        ? `Space "${created.name}" berhasil dibuat`
        : `Space "${created.name}" created successfully`,
      "add",
      () => {},
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLedger || !formName.trim()) return;

    triggerHaptic("medium");
    updateCustomSpace(selectedLedger.id, {
      name: formName.trim(),
      description: formDescription.trim(),
      icon: formIcon,
      currency: formCurrency,
      is_shared: formIsShared,
    });

    if (formIsDefault && selectedLedger.id !== defaultSpaceId) {
      await setDefaultLedger(selectedLedger.id);
    } else if (!formIsDefault && selectedLedger.id === defaultSpaceId) {
      await setDefaultLedger("personal");
    }

    setViewState("list");
    setSelectedLedger(null);
    showToast(
      isIndonesian ? "Space berhasil diperbarui" : "Space updated successfully",
      "update",
      () => {},
    );
  };

  const handleConfirmDelete = () => {
    if (!selectedLedger) return;

    triggerHaptic("medium");
    const deletedName = selectedLedger.name;
    const reassignTarget = reassignToPersonal ? "personal" : "";

    deleteCustomSpace(selectedLedger.id, reassignTarget);
    setViewState("list");
    setSelectedLedger(null);

    showToast(
      isIndonesian
        ? `Space "${deletedName}" dihapus`
        : `Space "${deletedName}" deleted`,
      "delete",
      () => {},
    );
  };

  const handleBackToList = () => {
    triggerHaptic("light");
    setViewState("list");
    setSelectedLedger(null);
  };

  // ── Liquid Glass Tactile Materials ───────────────────────────────────────
  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.085)"
    : "1px solid rgba(0, 0, 0, 0.065)";

  const controlShadow = isDark
    ? "0 2px 8px rgba(0, 0, 0, 0.22)"
    : "0 1px 4px rgba(30, 35, 50, 0.04)";

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={() => {
          setViewState("list");
          onClose();
        }}
        title={
          viewState === "create"
            ? isIndonesian
              ? "Space Baru"
              : "Create New Space"
            : viewState === "edit"
              ? isIndonesian
                ? "Ubah Space"
                : "Edit Space"
              : viewState === "join"
                ? isIndonesian
                  ? "Gabung Space Bersama"
                  : "Join Shared Space"
                : viewState === "delete_confirm"
                  ? isIndonesian
                    ? "Konfirmasi Hapus"
                    : "Delete Confirmation"
                  : isIndonesian
                    ? "Kelola Space"
                    : "Manage Spaces"
        }
      >
        <div
          className="px-5 sm:px-6 space-y-4 pt-1 select-none max-w-lg mx-auto"
          style={{
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
          }}
        >
          {/* ============================================================ */}
          {/* VIEW 1: LIST VIEW */}
          {/* ============================================================ */}
          {viewState === "list" && (
            <div className="space-y-3.5">
              {/* Header Subtitle */}
              <p className="text-[11.5px] text-[var(--text-tertiary)] leading-relaxed px-0.5">
                {isIndonesian
                  ? "Isolasi pencatatan arus kas, akun, dan laporan keuangan ke dalam space mandiri."
                  : "Isolate cashflows, accounts, and reports into independent financial spaces."}
              </p>

              {/* Ledgers List */}
              <div className="space-y-2 pr-0.5">
                {spaces.map((ledger) => {
                  const isActive = ledger.id === activeSpaceId;
                  const isDefault = ledger.id === defaultSpaceId;
                  const isConsolidated = ledger.id === "all";
                  const txCount = isConsolidated
                    ? transactions.length
                    : transactionCounts[ledger.id] || 0;

                  const displayLedgerName =
                    isConsolidated && ledger.name === "All Ledgers"
                      ? isIndonesian
                        ? "Semua Space"
                        : "All Spaces"
                      : ledger.id === "personal" &&
                          ledger.name === "Personal Space"
                        ? isIndonesian
                          ? "Space Pribadi"
                          : "Personal Space"
                        : ledger.name;

                  const displayLedgerDesc =
                    isConsolidated &&
                    (!ledger.description ||
                      ledger.description ===
                        "Consolidated balance sheet across all financial ledgers")
                      ? isIndonesian
                        ? "Seluruh space aktif terkonsolidasi"
                        : "All active spaces consolidated"
                      : ledger.id === "personal" &&
                          (!ledger.description ||
                            ledger.description ===
                              "Daily personal cashflow, necessities, shopping & personal savings")
                        ? isIndonesian
                          ? "Arus kas harian, belanja & tabungan personal"
                          : "Daily personal cashflow, shopping & savings"
                        : ledger.description ||
                          (isIndonesian
                            ? "Space finansial mandiri"
                            : "Independent financial space");

                  return (
                    <div
                      key={ledger.id}
                      onClick={() => handleSelectLedger(ledger.id)}
                      className="p-3 rounded-2xl flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.985] transition-all select-none"
                      style={{
                        background: isActive
                          ? isDark
                            ? "linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.05) 100%)"
                            : "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 242, 246, 0.88) 100%)"
                          : controlBg,
                        border: isActive
                          ? isDark
                            ? "1px solid rgba(255, 255, 255, 0.22)"
                            : "1px solid rgba(0, 0, 0, 0.16)"
                          : controlBorder,
                        boxShadow: isActive
                          ? isDark
                            ? "0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.18)"
                            : "0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 #ffffff"
                          : controlShadow,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Squircle Vector Icon */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
                          style={{
                            background: isActive
                              ? isDark
                                ? "#ffffff"
                                : "#18181b"
                              : isDark
                                ? "rgba(255, 255, 255, 0.06)"
                                : "rgba(0, 0, 0, 0.04)",
                            color: isActive
                              ? isDark
                                ? "#000000"
                                : "#ffffff"
                              : "var(--text-secondary)",
                            border: isActive
                              ? "none"
                              : isDark
                                ? "1px solid rgba(255, 255, 255, 0.1)"
                                : "1px solid rgba(0, 0, 0, 0.07)",
                          }}
                        >
                          {renderIcon(ledger.icon, 16)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                            <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                              {displayLedgerName}
                            </span>

                            {!isConsolidated && ledger.currency && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-white/[0.05] text-[var(--text-tertiary)] border border-[var(--glass-border)] shrink-0">
                                {ledger.currency}
                              </span>
                            )}

                            {isDefault && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-white/[0.08] text-[var(--text-primary)] border border-[var(--glass-border)] inline-flex items-center gap-1 shrink-0">
                                <Star size={8.5} className="fill-current" />
                                <span>
                                  {isIndonesian ? "Bawaan" : "Default"}
                                </span>
                              </span>
                            )}

                            {ledger.is_shared && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-white/[0.06] text-[var(--text-secondary)] border border-[var(--glass-border)] inline-flex items-center gap-1 shrink-0">
                                <Users size={8.5} strokeWidth={2} />
                                <span>
                                  {isIndonesian ? "Bersama" : "Shared"}
                                </span>
                              </span>
                            )}

                            {ledger.member_status === "pending" && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-white/[0.08] text-[var(--text-secondary)] border border-[var(--glass-border)] inline-flex items-center gap-1 shrink-0">
                                <Clock size={8.5} strokeWidth={2} />
                                <span>
                                  {isIndonesian ? "Menunggu" : "Pending"}
                                </span>
                              </span>
                            )}

                            {isConsolidated && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)] shrink-0">
                                {isIndonesian
                                  ? "Terkonsolidasi"
                                  : "Consolidated"}
                              </span>
                            )}
                          </div>

                          <p className="text-[10.5px] text-[var(--text-tertiary)] truncate mt-0.5 leading-tight">
                            {displayLedgerDesc}
                          </p>

                          <span className="text-[9.5px] font-mono text-[var(--text-tertiary)] opacity-75 mt-0.5 inline-block">
                            {txCount}{" "}
                            {isIndonesian ? "transaksi" : "transactions"}
                          </span>
                        </div>
                      </div>

                      {/* Actions Cluster */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {!isConsolidated && (
                          <>
                            {/* Set Default */}
                            <button
                              type="button"
                              onClick={(e) =>
                                handleSetDefault(
                                  ledger.id,
                                  displayLedgerName,
                                  e,
                                )
                              }
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                                isDefault
                                  ? "text-[var(--text-primary)]"
                                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              }`}
                              title={
                                isDefault
                                  ? isIndonesian
                                    ? "Space Bawaan Utama"
                                    : "Default Space"
                                  : isIndonesian
                                    ? "Jadikan Space Bawaan"
                                    : "Set as Default Space"
                              }
                            >
                              <Star
                                size={13}
                                className={isDefault ? "fill-current" : ""}
                                strokeWidth={1.8}
                              />
                            </button>

                            {/* Share */}
                            <button
                              type="button"
                              onClick={(e) => handleShareLedger(ledger, e)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                              title={
                                isIndonesian ? "Bagikan Space" : "Share Space"
                              }
                            >
                              <Share2 size={13} strokeWidth={1.8} />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(ledger, e)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                              title={isIndonesian ? "Ubah Space" : "Edit Space"}
                            >
                              <Edit3 size={13} strokeWidth={1.8} />
                            </button>

                            {/* Delete */}
                            {!isDefault && ledger.id !== "personal" && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenDelete(ledger, e)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                title={
                                  isIndonesian ? "Hapus Space" : "Delete Space"
                                }
                              >
                                <Trash2 size={13} strokeWidth={1.8} />
                              </button>
                            )}
                          </>
                        )}

                        {/* Active Radio/Check Indicator */}
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center border transition-all ml-1 shrink-0"
                          style={{
                            background: isActive
                              ? isDark
                                ? "#ffffff"
                                : "#18181b"
                              : "transparent",
                            color: isActive
                              ? isDark
                                ? "#000000"
                                : "#ffffff"
                              : "transparent",
                            borderColor: isActive
                              ? isDark
                                ? "#ffffff"
                                : "#18181b"
                              : "var(--glass-border)",
                          }}
                        >
                          {isActive && <Check size={11} strokeWidth={2.5} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions: New Space & Join */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="h-10 rounded-xl flex items-center justify-center gap-1.5 text-[12px] font-semibold active:scale-[0.98] transition-all cursor-pointer"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                    color: "var(--text-secondary)",
                  }}
                >
                  <Plus size={14} strokeWidth={2} />
                  <span>{isIndonesian ? "Space Baru" : "New Space"}</span>
                  {!isPremium && !canCreateLedger(userLedgersCount) && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.08] border border-white/10 text-[var(--text-secondary)] uppercase tracking-wider">
                      PRO
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setViewState("join");
                  }}
                  className="h-10 rounded-xl flex items-center justify-center gap-1.5 text-[12px] font-semibold active:scale-[0.98] transition-all cursor-pointer"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                    color: "var(--text-primary)",
                  }}
                >
                  <QrCode size={14} strokeWidth={2} />
                  <span>{isIndonesian ? "Gabung Space" : "Join Space"}</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 2 & 3: CREATE / EDIT VIEW */}
          {/* ============================================================ */}
          {(viewState === "create" || viewState === "edit") && (
            <form
              onSubmit={
                viewState === "create" ? handleSaveCreate : handleSaveEdit
              }
              className="space-y-3.5 pt-0.5"
            >
              {/* Ledger Name */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1 block">
                  {isIndonesian ? "Nama Space" : "Space Name"}
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={
                    isIndonesian
                      ? "Misal: Bisnis Kopi, Freelance, Tabungan..."
                      : "e.g. Business, Side Project, Vacation..."
                  }
                  className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold border-0 border-none outline-none focus:outline-none appearance-none transition-all placeholder:text-[var(--text-tertiary)]"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.035)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1 block">
                  {isIndonesian
                    ? "Deskripsi (Opsional)"
                    : "Description (Optional)"}
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={
                    isIndonesian
                      ? "Tujuan atau lingkup pencatatan space"
                      : "Scope or purpose of this space"
                  }
                  className="w-full h-11 px-3.5 rounded-2xl text-[12.5px] font-medium border-0 border-none outline-none focus:outline-none appearance-none transition-all placeholder:text-[var(--text-tertiary)]"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.035)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Icon Picker (Compact Tactile Squircles) */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1 block">
                  {isIndonesian ? "Ikon Representasi" : "Representation Icon"}
                </label>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {LEDGER_ICONS.map((item) => {
                    const isSelected =
                      formIcon.toLowerCase() === item.name.toLowerCase();
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setFormIcon(item.name);
                        }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95"
                        style={{
                          background: isSelected
                            ? isDark
                              ? "#ffffff"
                              : "#18181b"
                            : controlBg,
                          color: isSelected
                            ? isDark
                              ? "#000000"
                              : "#ffffff"
                            : "var(--text-secondary)",
                          border: isSelected
                            ? isDark
                              ? "1px solid #ffffff"
                              : "1px solid #18181b"
                            : controlBorder,
                          boxShadow: isSelected
                            ? "0 3px 10px rgba(0,0,0,0.25)"
                            : controlShadow,
                        }}
                        title={isIndonesian ? item.labelId : item.label}
                      >
                        <IconComponent size={15} strokeWidth={1.8} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Currency Selector */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1 block">
                  {isIndonesian ? "Mata Uang Dasar" : "Base Currency"}
                </label>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                  {SPACE_CURRENCIES.map((curr) => {
                    const isSelected = formCurrency === curr;
                    return (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setFormCurrency(curr);
                        }}
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold font-mono transition-all cursor-pointer select-none shrink-0"
                        style={{
                          background: isSelected
                            ? isDark
                              ? "#ffffff"
                              : "#18181b"
                            : controlBg,
                          color: isSelected
                            ? isDark
                              ? "#000000"
                              : "#ffffff"
                            : "var(--text-tertiary)",
                          border: isSelected
                            ? isDark
                              ? "1px solid #ffffff"
                              : "1px solid #18181b"
                            : controlBorder,
                          boxShadow: isSelected
                            ? "0 2px 8px rgba(0,0,0,0.2)"
                            : controlShadow,
                        }}
                      >
                        {curr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grouped Inset Control (Toggles) */}
              <div
                className="rounded-2xl overflow-hidden divide-y"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.06)",
                }}
              >
                {/* Default Ledger Toggle */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-primary)]">
                      <Star
                        size={13}
                        className={formIsDefault ? "fill-current" : ""}
                        strokeWidth={1.8}
                      />
                      <span>
                        {isIndonesian ? "Space Bawaan Utama" : "Default Space"}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-[var(--text-tertiary)] leading-tight">
                      {isIndonesian
                        ? "Buka space ini secara otomatis saat aplikasi dimuat."
                        : "Automatically open this space when app loads."}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={formIsDefault}
                    onChange={(val) => {
                      setFormIsDefault(val);
                    }}
                  />
                </div>

                {/* Shared Ledger Toggle */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-primary)]">
                      <Users size={13} strokeWidth={1.8} />
                      <span>
                        {isIndonesian ? "Space Bersama" : "Shared Space"}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-[var(--text-tertiary)] leading-tight">
                      {isIndonesian
                        ? "Kelola keuangan bersama keluarga, pasangan, atau mitra."
                        : "Collaborate on finances with partners or family."}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={formIsShared}
                    onChange={(val) => {
                      setFormIsShared(val);
                      if (val && formIcon === "BookOpen") {
                        setFormIcon("Users");
                      }
                    }}
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="flex-1 h-11 rounded-full text-[12.5px] font-semibold active:scale-95 transition-all cursor-pointer text-center"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-secondary)",
                  }}
                >
                  {isIndonesian ? "Batal" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-full text-[13px] font-semibold active:scale-95 transition-all cursor-pointer text-center shadow-sm"
                  style={{
                    background: isDark ? "#ffffff" : "#18181b",
                    color: isDark ? "#000000" : "#ffffff",
                  }}
                >
                  {viewState === "create"
                    ? isIndonesian
                      ? "Buat Space"
                      : "Create Space"
                    : isIndonesian
                      ? "Simpan Perubahan"
                      : "Save Changes"}
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* VIEW 4: DELETE CONFIRMATION */}
          {/* ============================================================ */}
          {viewState === "delete_confirm" && selectedLedger && (
            <div className="space-y-3.5 pt-0.5">
              <div
                className="p-4 rounded-2xl flex items-start gap-3"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.05)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <AlertTriangle size={15} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {isIndonesian
                      ? `Hapus "${selectedLedger.name}"?`
                      : `Delete "${selectedLedger.name}"?`}
                  </h4>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1 leading-relaxed">
                    {isIndonesian
                      ? "Space ini akan dihapus dari sistem. Pilih bagaimana transaksi di dalamnya diperlakukan:"
                      : "This space will be removed. Choose how transactions inside this space should be handled:"}
                  </p>
                </div>
              </div>

              {/* Reassign Option */}
              <div
                onClick={() => setReassignToPersonal(!reassignToPersonal)}
                className="p-3.5 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ArrowRightLeft
                    size={15}
                    strokeWidth={1.8}
                    className="text-[var(--text-secondary)] shrink-0"
                  />
                  <div>
                    <span className="text-[12.5px] font-semibold text-[var(--text-primary)] block">
                      {isIndonesian
                        ? "Pindahkan ke Space Pribadi"
                        : "Reassign to Personal Space"}
                    </span>
                    <span className="text-[10.5px] text-[var(--text-tertiary)] block mt-0.5">
                      {isIndonesian
                        ? "Transaksi tidak dihapus, hanya dialihkan ke Space Pribadi."
                        : "Transactions will be preserved in your Personal Space."}
                    </span>
                  </div>
                </div>

                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center border transition-all shrink-0 ml-2"
                  style={{
                    background: reassignToPersonal
                      ? isDark
                        ? "#ffffff"
                        : "#18181b"
                      : "transparent",
                    color: reassignToPersonal
                      ? isDark
                        ? "#000000"
                        : "#ffffff"
                      : "transparent",
                    borderColor: reassignToPersonal
                      ? isDark
                        ? "#ffffff"
                        : "#18181b"
                      : "var(--glass-border)",
                  }}
                >
                  {reassignToPersonal && <Check size={11} strokeWidth={2.5} />}
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="flex-1 h-11 rounded-full text-[12.5px] font-semibold active:scale-95 transition-all cursor-pointer text-center"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    color: "var(--text-secondary)",
                  }}
                >
                  {isIndonesian ? "Batal" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 h-11 rounded-full text-[13px] font-semibold active:scale-95 transition-all cursor-pointer text-center shadow-sm"
                  style={{
                    background: isDark ? "#ffffff" : "#18181b",
                    color: isDark ? "#000000" : "#ffffff",
                  }}
                >
                  {isIndonesian ? "Hapus Sekarang" : "Confirm Delete"}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 5: JOIN SHARED LEDGER VIEW */}
          {/* ============================================================ */}
          {viewState === "join" && (
            <div className="space-y-3.5 pt-0.5">
              <button
                type="button"
                onClick={handleBackToList}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                style={{
                  background: controlBg,
                  border: controlBorder,
                }}
              >
                <ArrowLeft size={13} strokeWidth={2} />
                <span>
                  {isIndonesian
                    ? "Kembali ke Daftar Space"
                    : "Back to Spaces List"}
                </span>
              </button>
              <JoinLedgerContent
                onSuccess={() => {
                  setViewState("list");
                }}
                onCancel={handleBackToList}
                onOpenLogin={onOpenLogin}
                hideHeaderCapsule
              />
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Shared Ledger Detail Sheet */}
      <SharedLedgerDetailSheet
        isOpen={sharedDetailOpen}
        ledger={targetSharedLedger}
        onClose={() => {
          setSharedDetailOpen(false);
          setTargetSharedLedger(null);
        }}
        onEditLedger={(l: MoneySpace) => {
          setSharedDetailOpen(false);
          setSelectedLedger(l);
          setFormName(l.name);
          setFormDescription(l.description || "");
          setFormIcon(l.icon || "BookOpen");
          setFormCurrency(l.currency || "IDR");
          setFormIsShared(Boolean(l.is_shared));
          setFormIsDefault(l.id === defaultSpaceId);
          setViewState("edit");
        }}
      />
    </>
  );
}
