// ======================================================================
// TROUVAILLE SMART DEBT & RECEIVABLES SHEET
// Executive Apple Luxury bottom sheet for tracking loans, payables,
// installment repayments, due date alerts, and wallet reconciliation.
// Strictly compliant with GEMINI.md:
// - Rule 1: Strictly vector outline icons from lucide-react (NO emojis)
// - Rule 2: Monochrome Apple luxury styling (dark obsidian / alabaster)
// - Rule 3: Soft ambient frosted glass and safe-area computed coordinates
// - Rule 5: Single unified scroll container up to 92dvh, zero artificial max-h-[55vh]
// - Rule 6: Strictly non-mixed localization (100% pure ID / pure EN)
// - Rule 7: Zero vibrant rainbow utility classes in UI controls
// ======================================================================

import { useState, useMemo } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  BookOpen,
  Plus,
  Search,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  User,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { useWallets } from "../../hooks/useWallets";
import { useDebtReceivables } from "../../hooks/useDebtReceivables";
import { formatRupiah } from "../../lib/utils";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import type {
  DebtType,
  DebtReceivableRecord,
} from "../../types/debt";
import {
  getDebtDueStatus,
  getDebtDueStatusLabel,
  getDebtTypeLabel,
} from "../../lib/debtReceivableEngine";
import { format } from "date-fns";

export interface DebtReceivablesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: DebtType;
}

type TabFilter = "all" | "receivable" | "debt" | "settled";

export function DebtReceivablesSheet({
  isOpen,
  onClose,
  initialType,
}: DebtReceivablesSheetProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { showToast } = useToast();
  const { data: wallets = [] } = useWallets();

  const {
    records,
    summary,
    createRecord,
    deleteRecord,
    recordRepayment,
    removeRepayment,
  } = useDebtReceivables();

  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState<TabFilter>(
    initialType ? initialType : "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Form Modes
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [repayingRecord, setRepayingRecord] = useState<DebtReceivableRecord | null>(
    null,
  );

  // New Record Form State
  const [formType, setFormType] = useState<DebtType>(initialType || "receivable");
  const [formPersonName, setFormPersonName] = useState("");
  const [formAmountStr, setFormAmountStr] = useState("");
  const [formWalletId, setFormWalletId] = useState<string>("");
  const [formIsAdminOnly, setFormIsAdminOnly] = useState(false);
  const [formDueDate, setFormDueDate] = useState("");
  const [formNote, setFormNote] = useState("");

  // Repayment Form State
  const [repayAmountStr, setRepayAmountStr] = useState("");
  const [repayWalletId, setRepayWalletId] = useState("");
  const [repayIsAdminOnly, setRepayIsAdminOnly] = useState(false);
  const [repayDate, setRepayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [repayNote, setRepayNote] = useState("");

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Tab filter
      if (activeTab === "receivable") {
        if (r.type !== "receivable" || r.status === "settled") return false;
      } else if (activeTab === "debt") {
        if (r.type !== "debt" || r.status === "settled") return false;
      } else if (activeTab === "settled") {
        if (r.status !== "settled") return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.personName.toLowerCase().includes(q);
        const matchNote = r.note ? r.note.toLowerCase().includes(q) : false;
        if (!matchName && !matchNote) return false;
      }

      return true;
    });
  }, [records, activeTab, searchQuery]);

  const handleResetForm = () => {
    setFormPersonName("");
    setFormAmountStr("");
    setFormWalletId(wallets[0]?.id || "");
    setFormIsAdminOnly(false);
    setFormDueDate("");
    setFormNote("");
    setIsAddingRecord(false);
  };

  const handleSaveNewRecord = async () => {
    const rawAmt = Number(formAmountStr.replace(/\D/g, "")) || 0;
    if (!formPersonName.trim()) {
      showToast(
        isIndonesian
          ? "Nama pihak lawan transaksi wajib diisi"
          : "Contact person name is required",
        "info",
      );
      return;
    }
    if (rawAmt <= 0) {
      showToast(
        isIndonesian
          ? "Nominal transaksi harus lebih dari nol"
          : "Transaction amount must be greater than zero",
        "info",
      );
      return;
    }

    const matchedWallet = wallets.find((w) => w.id === formWalletId);

    try {
      await createRecord({
        type: formType,
        personName: formPersonName.trim(),
        totalAmount: rawAmt,
        walletId: formWalletId || null,
        walletName: matchedWallet?.name || null,
        isAdministrativeOnly: formIsAdminOnly,
        dueDate: formDueDate || null,
        note: formNote || null,
      });

      triggerSuccessHaptic();
      showToast(
        isIndonesian
          ? formType === "receivable"
            ? "Catatan piutang berhasil disimpan"
            : "Catatan utang berhasil disimpan"
          : formType === "receivable"
            ? "Receivable record created successfully"
            : "Debt record created successfully",
        "add",
      );
      handleResetForm();
    } catch (e: any) {
      showToast(
        isIndonesian ? "Gagal menyimpan catatan" : "Failed to save record",
        "info",
      );
    }
  };

  const handleOpenRepayModal = (record: DebtReceivableRecord) => {
    triggerHaptic("light");
    setRepayingRecord(record);
    setRepayAmountStr(record.remainingAmount.toString());
    setRepayWalletId(record.walletId || wallets[0]?.id || "");
    setRepayIsAdminOnly(record.isAdministrativeOnly);
    setRepayDate(format(new Date(), "yyyy-MM-dd"));
    setRepayNote("");
  };

  const handleConfirmRepayment = async () => {
    if (!repayingRecord) return;
    const rawAmt = Number(repayAmountStr.replace(/\D/g, "")) || 0;
    if (rawAmt <= 0) {
      showToast(
        isIndonesian ? "Nominal pelunasan tidak valid" : "Invalid repayment amount",
        "info",
      );
      return;
    }

    const matchedWallet = wallets.find((w) => w.id === repayWalletId);

    try {
      await recordRepayment(repayingRecord.id, {
        amount: rawAmt,
        date: repayDate,
        walletId: repayWalletId || null,
        walletName: matchedWallet?.name || null,
        isAdministrativeOnly: repayIsAdminOnly,
        note: repayNote || null,
      });

      triggerSuccessHaptic();
      showToast(
        isIndonesian
          ? "Pembayaran pelunasan berhasil dicatat"
          : "Repayment recorded successfully",
        "update",
      );
      setRepayingRecord(null);
    } catch (e: any) {
      showToast(
        isIndonesian ? "Gagal mencatat pembayaran" : "Failed to record payment",
        "info",
      );
    }
  };

  const handleDeleteRecord = async (record: DebtReceivableRecord) => {
    triggerHaptic("medium");
    const confirmMsg = isIndonesian
      ? `Hapus catatan ${record.personName}?`
      : `Delete record for ${record.personName}?`;
    if (window.confirm(confirmMsg)) {
      await deleteRecord(record.id, { cleanLinkedTransactions: false });
      showToast(
        isIndonesian ? "Catatan berhasil dihapus" : "Record deleted",
        "info",
      );
    }
  };

  const modalTitle = isIndonesian
    ? "Buku Utang & Piutang"
    : "Debt & Receivables Hub";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div
        className="space-y-4 text-left"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
        }}
      >
        {/* ── 1. Top Executive Summary Bento Card ── */}
        <div
          className="p-3.5 rounded-2xl transition-all"
          style={{
            background: isDark
              ? "linear-gradient(160deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%)"
              : "linear-gradient(160deg, rgba(255, 255, 255, 0.95) 0%, rgba(246, 247, 250, 0.90) 100%)",
            border: isDark
              ? "1px solid rgba(255, 255, 255, 0.08)"
              : "1px solid rgba(0, 0, 0, 0.06)",
            boxShadow: isDark
              ? "0 10px 25px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
              : "0 6px 18px -6px rgba(0, 0, 0, 0.04), inset 0 1px 0 #ffffff",
          }}
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Piutang (Receivables to receive) */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
                {isIndonesian ? "Total Piutang" : "Receivables"}
              </span>
              <span className="text-[13px] font-bold tracking-tight text-[var(--text-primary)] block truncate">
                {formatRupiah(summary.totalReceivables)}
              </span>
              <span className="text-[9.5px] font-medium text-[var(--text-secondary)] block">
                {summary.activeReceivablesCount}{" "}
                {isIndonesian ? "Pihak" : "Active"}
              </span>
            </div>

            {/* Utang (Debts to pay) */}
            <div className="space-y-1 border-x border-[var(--glass-border)] px-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
                {isIndonesian ? "Total Utang" : "Payables"}
              </span>
              <span className="text-[13px] font-bold tracking-tight text-[var(--text-secondary)] block truncate">
                {formatRupiah(summary.totalDebts)}
              </span>
              <span className="text-[9.5px] font-medium text-[var(--text-secondary)] block">
                {summary.activeDebtsCount}{" "}
                {isIndonesian ? "Pihak" : "Active"}
              </span>
            </div>

            {/* Net Position */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
                {isIndonesian ? "Posisi Bersih" : "Net Position"}
              </span>
              <span
                className="text-[13px] font-bold tracking-tight block truncate"
                style={{
                  color:
                    summary.netReceivables > 0
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                {summary.netReceivables >= 0 ? "+" : ""}
                {formatRupiah(summary.netReceivables)}
              </span>
              <span className="text-[9.5px] font-medium text-[var(--text-tertiary)] block">
                {summary.settledReceivablesCount + summary.settledDebtsCount}{" "}
                {isIndonesian ? "Lunas" : "Settled"}
              </span>
            </div>
          </div>

          {/* Attention Badges (Overdue / Approaching Due) */}
          {(summary.overdueCount > 0 || summary.approachingDueCount > 0) && (
            <div className="mt-3 pt-2.5 border-t border-[var(--glass-border)] flex items-center justify-between text-[10.5px]">
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <Clock size={12} strokeWidth={1.75} />
                <span>
                  {isIndonesian ? "Status Jatuh Tempo" : "Due Date Status"}:
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {summary.overdueCount > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[9.5px] font-semibold"
                    style={{
                      background: isDark
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.05)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {summary.overdueCount} {isIndonesian ? "Terlewat" : "Overdue"}
                  </span>
                )}
                {summary.approachingDueCount > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[9.5px] font-semibold"
                    style={{
                      background: isDark
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.03)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {summary.approachingDueCount}{" "}
                    {isIndonesian ? "Mendekati Tempo" : "Due Soon"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 2. Action Controls & Creation Form ── */}
        {!isAddingRecord && !repayingRecord && (
          <div className="space-y-3">
            {/* Top Toolbar: Add Button + Search Input */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setIsAddingRecord(true);
                  setFormWalletId(wallets[0]?.id || "");
                }}
                className="h-9 px-3.5 rounded-xl font-semibold text-[11.5px] flex items-center gap-1.5 shrink-0 active:scale-95 transition-all cursor-pointer shadow-xs"
                style={{
                  background: isDark ? "#ffffff" : "#18181b",
                  color: isDark ? "#000000" : "#ffffff",
                }}
              >
                <Plus size={13} strokeWidth={2.2} />
                <span>{isIndonesian ? "Catat Baru" : "Add Record"}</span>
              </button>

              <div
                className="flex-1 h-9 px-3 rounded-xl flex items-center gap-2 transition-all"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.02)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.07)"
                    : "1px solid rgba(0, 0, 0, 0.05)",
                }}
              >
                <Search
                  size={12.5}
                  strokeWidth={1.8}
                  className="text-[var(--text-tertiary)] shrink-0"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isIndonesian ? "Cari kontak atau catatan..." : "Search contact or note..."
                  }
                  className="w-full bg-transparent text-[11.5px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            {/* Segmented Filter Tabs */}
            <div
              className="p-1 rounded-xl flex items-center gap-1"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.03)"
                  : "rgba(0, 0, 0, 0.03)",
                border: isDark
                  ? "1px solid rgba(255, 255, 255, 0.06)"
                  : "1px solid rgba(0, 0, 0, 0.05)",
              }}
            >
              {[
                { id: "all" as const, label: isIndonesian ? "Semua" : "All" },
                {
                  id: "receivable" as const,
                  label: isIndonesian ? "Piutang" : "Receivables",
                },
                {
                  id: "debt" as const,
                  label: isIndonesian ? "Utang" : "Debts",
                },
                {
                  id: "settled" as const,
                  label: isIndonesian ? "Lunas" : "Settled",
                },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setActiveTab(tab.id);
                    }}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center"
                    style={{
                      background: isActive
                        ? isDark
                          ? "rgba(255, 255, 255, 0.09)"
                          : "#ffffff"
                        : "transparent",
                      color: isActive
                        ? "var(--text-primary)"
                        : "var(--text-tertiary)",
                      boxShadow:
                        isActive && !isDark
                          ? "0 1px 3px rgba(0, 0, 0, 0.06)"
                          : "none",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 3. Add New Record Form ── */}
        {isAddingRecord && (
          <div
            className="p-4 rounded-2xl space-y-3.5 transition-all animate-in fade-in"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.03)"
                : "rgba(0, 0, 0, 0.02)",
              border: isDark
                ? "1px solid rgba(255, 255, 255, 0.08)"
                : "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            <div className="flex items-center justify-between pb-1">
              <span className="text-[12.5px] font-bold text-[var(--text-primary)]">
                {isIndonesian ? "Catat Pinjaman Baru" : "Add Loan / Debt"}
              </span>
              <button
                type="button"
                onClick={handleResetForm}
                className="w-7 h-7 rounded-xl flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Type Toggle: Piutang vs Utang */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormType("receivable")}
                className="py-2 px-3 rounded-xl text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                style={{
                  background:
                    formType === "receivable"
                      ? isDark
                        ? "rgba(255, 255, 255, 0.12)"
                        : "#ffffff"
                      : "transparent",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                  color:
                    formType === "receivable"
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                }}
              >
                <ArrowUpRight size={13} strokeWidth={2} />
                <span>{isIndonesian ? "Piutang" : "Receivables"}</span>
              </button>

              <button
                type="button"
                onClick={() => setFormType("debt")}
                className="py-2 px-3 rounded-xl text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                style={{
                  background:
                    formType === "debt"
                      ? isDark
                        ? "rgba(255, 255, 255, 0.12)"
                        : "#ffffff"
                      : "transparent",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                  color:
                    formType === "debt"
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                }}
              >
                <ArrowDownLeft size={13} strokeWidth={2} />
                <span>{isIndonesian ? "Utang" : "Debts"}</span>
              </button>
            </div>

            {/* Person Name Input */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                {isIndonesian ? "Nama Pihak / Lawan Transaksi" : "Contact Person Name"}
              </label>
              <div
                className="h-10 px-3 rounded-xl flex items-center gap-2"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.02)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                <User size={13} strokeWidth={1.8} className="text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={formPersonName}
                  onChange={(e) => setFormPersonName(e.target.value)}
                  placeholder={
                    isIndonesian
                      ? "Contoh: Budi Santoso / Rekan Kantor"
                      : "e.g. Alex / Coworker"
                  }
                  className="w-full bg-transparent text-[12px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none"
                />
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                {isIndonesian ? "Nominal Pinjaman" : "Loan Amount"}
              </label>
              <div
                className="h-10 px-3 rounded-xl flex items-center gap-2"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.02)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    formAmountStr
                      ? Number(formAmountStr.replace(/\D/g, "")).toLocaleString("id-ID")
                      : ""
                  }
                  onChange={(e) => setFormAmountStr(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full bg-transparent text-[13px] font-bold text-[var(--text-primary)] outline-none"
                />
              </div>
            </div>

            {/* Source Wallet (if not administrative only) */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                {isIndonesian ? "Dompet Terkait" : "Linked Account"}
              </label>
              <select
                value={formWalletId}
                onChange={(e) => setFormWalletId(e.target.value)}
                disabled={formIsAdminOnly}
                className="w-full h-10 px-3 rounded-xl text-[12px] text-[var(--text-primary)] outline-none cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.02)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                  opacity: formIsAdminOnly ? 0.5 : 1,
                }}
              >
                {wallets.map((w) => (
                  <option
                    key={w.id}
                    value={w.id}
                    style={{
                      backgroundColor: isDark ? "#18181b" : "#ffffff",
                      color: isDark ? "#ffffff" : "#18181b",
                    }}
                  >
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle: Administrative Only */}
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formIsAdminOnly}
                onChange={(e) => setFormIsAdminOnly(e.target.checked)}
                className="mt-0.5 rounded accent-zinc-500 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-[11.5px] font-semibold text-[var(--text-primary)] block">
                  {isIndonesian
                    ? "Hanya catatan administratif (tanpa mutasi dompet)"
                    : "Administrative record only (no wallet mutation)"}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] block">
                  {isIndonesian
                    ? "Aktifkan jika uang kas sudah diserahkan di luar pencatatan aplikasi."
                    : "Enable if cash was already disbursed outside app tracking."}
                </span>
              </div>
            </label>

            {/* Due Date & Note in 2 columns */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {isIndonesian ? "Jatuh Tempo (Opsional)" : "Due Date (Optional)"}
                </label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl text-[11.5px] text-[var(--text-primary)] outline-none"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.03)"
                      : "rgba(0, 0, 0, 0.02)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid rgba(0, 0, 0, 0.06)",
                    colorScheme: isDark ? "dark" : "light",
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {isIndonesian ? "Catatan Tambahan" : "Note (Optional)"}
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder={isIndonesian ? "Keterangan..." : "Details..."}
                  className="w-full h-10 px-2.5 rounded-xl text-[11.5px] text-[var(--text-primary)] outline-none placeholder-[var(--text-tertiary)]"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.03)"
                      : "rgba(0, 0, 0, 0.02)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid rgba(0, 0, 0, 0.06)",
                  }}
                />
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="flex-1 h-10 rounded-xl text-[11.5px] font-semibold text-[var(--text-secondary)] active:scale-95 transition-all cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.04)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                {isIndonesian ? "Batal" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSaveNewRecord}
                className="flex-1 h-10 rounded-xl text-[11.5px] font-semibold active:scale-95 transition-all cursor-pointer shadow-xs"
                style={{
                  background: isDark ? "#ffffff" : "#18181b",
                  color: isDark ? "#000000" : "#ffffff",
                }}
              >
                {isIndonesian ? "Simpan Catatan" : "Save Record"}
              </button>
            </div>
          </div>
        )}

        {/* ── 4. Repayment Sub-Form ── */}
        {repayingRecord && (
          <div
            className="p-4 rounded-2xl space-y-3.5 transition-all animate-in fade-in"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.03)"
                : "rgba(0, 0, 0, 0.02)",
              border: isDark
                ? "1px solid rgba(255, 255, 255, 0.08)"
                : "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            <div className="flex items-center justify-between pb-1">
              <div>
                <span className="text-[12.5px] font-bold text-[var(--text-primary)] block">
                  {isIndonesian
                    ? `Catat Pelunasan: ${repayingRecord.personName}`
                    : `Record Repayment: ${repayingRecord.personName}`}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] block">
                  {isIndonesian ? "Sisa Kewajiban" : "Outstanding Balance"}:{" "}
                  {formatRupiah(repayingRecord.remainingAmount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRepayingRecord(null)}
                className="w-7 h-7 rounded-xl flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRepayAmountStr(repayingRecord.remainingAmount.toString());
                }}
                className="flex-1 py-1.5 rounded-lg text-[10.5px] font-semibold active:scale-95 transition-all cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                {isIndonesian ? "Pelunasan Penuh (100%)" : "Full Settlement (100%)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const half = Math.floor(repayingRecord.remainingAmount / 2);
                  setRepayAmountStr(half.toString());
                }}
                className="py-1.5 px-3 rounded-lg text-[10.5px] font-semibold active:scale-95 transition-all cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.03)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                50%
              </button>
            </div>

            {/* Amount Input */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                {isIndonesian ? "Nominal Pembayaran" : "Repayment Amount"}
              </label>
              <div
                className="h-10 px-3 rounded-xl flex items-center gap-2"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.02)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    repayAmountStr
                      ? Number(repayAmountStr.replace(/\D/g, "")).toLocaleString("id-ID")
                      : ""
                  }
                  onChange={(e) => setRepayAmountStr(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full bg-transparent text-[13px] font-bold text-[var(--text-primary)] outline-none"
                />
              </div>
            </div>

            {/* Target/Source Wallet */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                {isIndonesian
                  ? repayingRecord.type === "receivable"
                    ? "Dompet Penerima Uang"
                    : "Dompet Sumber Pembayaran"
                  : "Settlement Account"}
              </label>
              <select
                value={repayWalletId}
                onChange={(e) => setRepayWalletId(e.target.value)}
                disabled={repayIsAdminOnly}
                className="w-full h-10 px-3 rounded-xl text-[12px] text-[var(--text-primary)] outline-none cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.02)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                  opacity: repayIsAdminOnly ? 0.5 : 1,
                }}
              >
                {wallets.map((w) => (
                  <option
                    key={w.id}
                    value={w.id}
                    style={{
                      backgroundColor: isDark ? "#18181b" : "#ffffff",
                      color: isDark ? "#ffffff" : "#18181b",
                    }}
                  >
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle: Administrative Only */}
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={repayIsAdminOnly}
                onChange={(e) => setRepayIsAdminOnly(e.target.checked)}
                className="mt-0.5 rounded accent-zinc-500 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-[11.5px] font-semibold text-[var(--text-primary)] block">
                  {isIndonesian
                    ? "Hanya catatan administratif (tanpa mutasi dompet)"
                    : "Administrative record only (no wallet mutation)"}
                </span>
              </div>
            </label>

            {/* Date & Note in 2 columns */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {isIndonesian ? "Tanggal" : "Date"}
                </label>
                <input
                  type="date"
                  value={repayDate}
                  onChange={(e) => setRepayDate(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl text-[11.5px] text-[var(--text-primary)] outline-none"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.03)"
                      : "rgba(0, 0, 0, 0.02)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid rgba(0, 0, 0, 0.06)",
                    colorScheme: isDark ? "dark" : "light",
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {isIndonesian ? "Catatan" : "Note"}
                </label>
                <input
                  type="text"
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  placeholder={isIndonesian ? "Cicilan 1..." : "Installment 1..."}
                  className="w-full h-10 px-2.5 rounded-xl text-[11.5px] text-[var(--text-primary)] outline-none placeholder-[var(--text-tertiary)]"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.03)"
                      : "rgba(0, 0, 0, 0.02)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid rgba(0, 0, 0, 0.06)",
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRepayingRecord(null)}
                className="flex-1 h-10 rounded-xl text-[11.5px] font-semibold text-[var(--text-secondary)] active:scale-95 transition-all cursor-pointer"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.04)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                {isIndonesian ? "Batal" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleConfirmRepayment}
                className="flex-1 h-10 rounded-xl text-[11.5px] font-semibold active:scale-95 transition-all cursor-pointer shadow-xs"
                style={{
                  background: isDark ? "#ffffff" : "#18181b",
                  color: isDark ? "#000000" : "#ffffff",
                }}
              >
                {isIndonesian ? "Simpan Pembayaran" : "Confirm Payment"}
              </button>
            </div>
          </div>
        )}

        {/* ── 5. Record List ── */}
        <div className="space-y-2.5 pt-1">
          {filteredRecords.length === 0 ? (
            <div
              className="py-10 px-4 rounded-2xl text-center space-y-2.5"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(0, 0, 0, 0.015)",
                border: isDark
                  ? "1px dashed rgba(255, 255, 255, 0.08)"
                  : "1px dashed rgba(0, 0, 0, 0.08)",
              }}
            >
              <div
                className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-[var(--text-tertiary)]"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.04)"
                    : "rgba(0, 0, 0, 0.03)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <BookOpen size={16} strokeWidth={1.5} />
              </div>
              <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
                {isIndonesian
                  ? "Tidak ada catatan utang atau piutang"
                  : "No debt or receivable records found"}
              </p>
              <p className="text-[10.5px] text-[var(--text-tertiary)] max-w-xs mx-auto">
                {isIndonesian
                  ? "Gunakan tombol 'Catat Baru' untuk mulai memantau pinjaman, pelunasan bertahap, dan tanggal tempo."
                  : "Tap 'Add Record' to start tracking loans, installments, and due dates."}
              </p>
            </div>
          ) : (
            filteredRecords.map((record) => {
              const dueStatus = getDebtDueStatus(record);
              const dueLabel = getDebtDueStatusLabel(dueStatus, isIndonesian);
              const isSettled = record.status === "settled";
              const isExpanded = expandedRecordId === record.id;
              const repaidPct = Math.round(
                ((record.totalAmount - record.remainingAmount) /
                  (record.totalAmount || 1)) *
                  100,
              );

              return (
                <div
                  key={record.id}
                  className="p-3.5 rounded-2xl transition-all space-y-2.5"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.03)"
                      : "rgba(0, 0, 0, 0.02)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.07)"
                      : "1px solid rgba(0, 0, 0, 0.05)",
                  }}
                >
                  {/* Card Header: Contact Initials + Name + Due Status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Frosted Initials Avatar */}
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[11px] shrink-0"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.06)"
                            : "rgba(0, 0, 0, 0.04)",
                          border: "1px solid var(--glass-border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {record.personName.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-bold text-[var(--text-primary)] truncate">
                            {record.personName}
                          </span>
                          <span
                            className="text-[9.5px] px-1.5 py-0.2 rounded-md font-semibold tracking-wide uppercase shrink-0"
                            style={{
                              background: isDark
                                ? "rgba(255, 255, 255, 0.06)"
                                : "rgba(0, 0, 0, 0.04)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {getDebtTypeLabel(record.type, isIndonesian)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)] pt-0.5">
                          {record.walletName && (
                            <span className="truncate">
                              {record.walletName}
                            </span>
                          )}
                          {record.isAdministrativeOnly && (
                            <span className="italic">
                              • {isIndonesian ? "Catatan Administratif" : "Administrative"}
                            </span>
                          )}
                          {record.dueDate && (
                            <span>
                              • {isIndonesian ? "Jatuh Tempo: " : "Due: "}
                              {record.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="px-2 py-0.5 rounded-full text-[9.5px] font-semibold"
                        style={{
                          background: isSettled
                            ? isDark
                              ? "rgba(255, 255, 255, 0.12)"
                              : "rgba(0, 0, 0, 0.07)"
                            : dueStatus === "overdue"
                              ? isDark
                                ? "rgba(255, 255, 255, 0.08)"
                                : "rgba(0, 0, 0, 0.05)"
                              : isDark
                                ? "rgba(255, 255, 255, 0.05)"
                                : "rgba(0, 0, 0, 0.03)",
                          border: "1px solid var(--glass-border)",
                          color: isSettled
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {dueLabel}
                      </span>
                    </div>
                  </div>

                  {/* Amount & Progress Section */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[var(--text-tertiary)] block">
                          {isSettled
                            ? isIndonesian
                              ? "Telah Lunas"
                              : "Fully Settled"
                            : isIndonesian
                              ? "Sisa Kewajiban"
                              : "Remaining Balance"}
                        </span>
                        <span className="text-[14px] font-extrabold tracking-tight text-[var(--text-primary)]">
                          {formatRupiah(record.remainingAmount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[var(--text-tertiary)] block">
                          {isIndonesian ? "Total Pokok" : "Principal"}
                        </span>
                        <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                          {formatRupiah(record.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                      className="h-1.5 w-full rounded-full overflow-hidden"
                      style={{
                        background: isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : "rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${repaidPct}%`,
                          background: isDark ? "#ffffff" : "#18181b",
                        }}
                      />
                    </div>
                  </div>

                  {/* Card Actions Toolbar */}
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--glass-border)]">
                    <div className="flex items-center gap-2">
                      {!isSettled && (
                        <button
                          type="button"
                          onClick={() => handleOpenRepayModal(record)}
                          className="px-2.5 py-1 rounded-lg text-[10.5px] font-semibold active:scale-95 transition-all cursor-pointer shadow-2xs"
                          style={{
                            background: isDark ? "#ffffff" : "#18181b",
                            color: isDark ? "#000000" : "#ffffff",
                          }}
                        >
                          {isIndonesian ? "Catat Pelunasan" : "Record Repayment"}
                        </button>
                      )}

                      {/* Repayment History Toggle */}
                      {record.repayments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setExpandedRecordId(
                              isExpanded ? null : record.id,
                            );
                          }}
                          className="flex items-center gap-1 text-[10.5px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          <span>
                            {record.repayments.length}{" "}
                            {isIndonesian ? "Cicilan" : "Installments"}
                          </span>
                          {isExpanded ? (
                            <ChevronUp size={12} strokeWidth={2} />
                          ) : (
                            <ChevronDown size={12} strokeWidth={2} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Delete Record Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteRecord(record)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90 transition-all cursor-pointer"
                      title={isIndonesian ? "Hapus catatan" : "Delete record"}
                    >
                      <Trash2 size={12.5} strokeWidth={1.8} />
                    </button>
                  </div>

                  {/* ── Installment History Accordion ── */}
                  {isExpanded && record.repayments.length > 0 && (
                    <div
                      className="mt-2 pt-2 border-t border-[var(--glass-border)] space-y-2 animate-in fade-in"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                        {isIndonesian ? "Riwayat Pembayaran" : "Repayment History"}
                      </span>
                      {record.repayments.map((rep) => (
                        <div
                          key={rep.id}
                          className="flex items-center justify-between text-[11px] p-2 rounded-xl"
                          style={{
                            background: isDark
                              ? "rgba(255, 255, 255, 0.03)"
                              : "rgba(0, 0, 0, 0.02)",
                          }}
                        >
                          <div>
                            <span className="font-semibold text-[var(--text-primary)] block">
                              +{formatRupiah(rep.amount)}
                            </span>
                            <span className="text-[9.5px] text-[var(--text-tertiary)] block">
                              {rep.date}
                              {rep.walletName ? ` • ${rep.walletName}` : ""}
                              {rep.note ? ` • ${rep.note}` : ""}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              triggerHaptic("light");
                              if (
                                window.confirm(
                                  isIndonesian
                                    ? "Hapus pembayaran cicilan ini?"
                                    : "Delete this repayment?",
                                )
                              ) {
                                await removeRepayment(record.id, rep.id, {
                                  cleanLinkedTransactions: false,
                                });
                                showToast(
                                  isIndonesian
                                    ? "Pembayaran dihapus"
                                    : "Repayment deleted",
                                  "info",
                                );
                              }
                            }}
                            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
                          >
                            <Trash2 size={11} strokeWidth={1.8} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── 6. Bottom Completion Button ── */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-2xl font-semibold text-[12.5px] flex items-center justify-center transition-all active:scale-[0.985] cursor-pointer shadow-xs"
            style={{
              background: isDark ? "#ffffff" : "#18181b",
              color: isDark ? "#000000" : "#ffffff",
            }}
          >
            {isIndonesian ? "Selesai" : "Done"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
