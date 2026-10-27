import { useState, useMemo, useRef } from "react";
import { Plus, Trash2, Check, Bell, Calendar as CalendarIcon } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { GlassDatePicker } from "../ui/GlassDatePicker";
import { IconRenderer } from "../ui/IconRenderer";
import { GlassConfirmationModal } from "../ui/GlassConfirmationModal";
import { DetectedRecurringSection } from "../bills/DetectedRecurringSection";
import { PayBillModal } from "../bills/PayBillModal";
import {
  useBills,
  useBillObligations,
  useAddBill,
  useUpdateBill,
  useDeleteBill,
  useMarkBillPaid,
} from "../../hooks/useBills";
import { useAllTransactions } from "../../hooks/useTransactions";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  detectRecurringTransactions,
  type DetectedRecurringItem,
} from "../../lib/financialMath";
import type { RepeatRule } from "../../lib/types";
import { useCurrency } from "../../contexts/CurrencyContext";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { formatLiveAmountInput } from "../../lib/utils";
import { format, parseISO } from "date-fns";

function parseRawCleanAmount(str: string, isIndo: boolean): number {
  if (!str) return 0;
  const thousandSep = isIndo ? "." : ",";
  const decimalSep = isIndo ? "," : ".";
  const clean = str.split(thousandSep).join("").replace(decimalSep, ".");
  return parseFloat(clean) || 0;
}

interface BillManagementSheetsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BillManagementSheets({
  isOpen,
  onClose,
}: BillManagementSheetsProps) {
  const { isIndonesian } = useLanguage();
  const {
    preferredCurrency,
    currencyMeta,
    formatWithPreferred,
    convertToIdr,
    convertFromIdr,
  } = useCurrency();
  const isSubmittingRef = useRef(false);
  const parseCleanAmount = (str: string, isIndo: boolean) =>
    parseRawCleanAmount(str, isIndo && currencyMeta.decimals === 0);
  const { data: bills = [] } = useBills();
  const { data: wallets = [] } = useWallets();
  const addBill = useAddBill();
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();
  const markBillPaid = useMarkBillPaid();
  const { data: allTxs = [] } = useAllTransactions();
  const { data: categories = [] } = useCategories();
  const { showToast } = useToast();

  const obligations = useBillObligations();
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense" || !c.type),
    [categories],
  );

  const [billSheetOpen, setBillSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [payingBill, setPayingBill] = useState<any | null>(null);

  const [billTitle, setBillTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDate, setBillDate] = useState<Date>(new Date());
  const [billRepeat, setBillRepeat] = useState<
    "none" | "weekly" | "monthly" | "yearly"
  >("monthly");
  const [billIsPaid, setBillIsPaid] = useState(false);
  const [billWalletId, setBillWalletId] = useState<string>("");
  const [billCategoryId, setBillCategoryId] = useState<string>("");
  const [billToDelete, setBillToDelete] = useState<any | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [ignoredRecurringIds, setIgnoredRecurringIds] = useState<string[]>(
    () => {
      try {
        const raw = localStorage.getItem("trouvaille_ignored_recurring_ids");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
  );
  const [confirmingRecurringId, setConfirmingRecurringId] = useState<
    string | null
  >(null);

  const persistIgnoredRecurringIds = (nextIds: string[]) => {
    setIgnoredRecurringIds(nextIds);
    localStorage.setItem(
      "trouvaille_ignored_recurring_ids",
      JSON.stringify(nextIds),
    );
  };

  const detectedRecurringItems = useMemo(() => {
    return detectRecurringTransactions(
      allTxs,
      bills,
      categories,
      new Date(),
    ).filter(
      (item) =>
        item.type === "expense" &&
        item.status === "detected" &&
        !ignoredRecurringIds.includes(item.id),
    );
  }, [allTxs, bills, categories, ignoredRecurringIds]);

  const handleIgnoreRecurring = (item: DetectedRecurringItem) => {
    if (ignoredRecurringIds.includes(item.id)) return;
    persistIgnoredRecurringIds([...ignoredRecurringIds, item.id]);
    triggerHaptic("light");
    showToast(
      isIndonesian
        ? `${item.title} disembunyikan dari saran tagihan rutin`
        : `${item.title} hidden from recurring suggestions`,
      "update",
      () => {},
    );
  };

  const mapRecurringFrequencyToBillRule = (
    frequency: DetectedRecurringItem["frequency"],
  ): RepeatRule => {
    if (frequency === "weekly") return "weekly";
    if (frequency === "monthly") return "monthly";
    if (frequency === "yearly") return "yearly";
    return "none";
  };

  const handleConfirmRecurring = (item: DetectedRecurringItem) => {
    const repeatRule = mapRecurringFrequencyToBillRule(item.frequency);
    const freqLabelId =
      item.frequency === "weekly"
        ? "mingguan"
        : item.frequency === "monthly"
          ? "bulanan"
          : item.frequency === "yearly"
            ? "tahunan"
            : item.frequency;
    const note = isIndonesian
      ? repeatRule === "none"
        ? `Pola transaksi berulang ${freqLabelId} terdeteksi dari riwayat. Tinjau jadwal pembayaran secara manual setelah konfirmasi.`
        : `Dikonfirmasi dari pola transaksi berulang ${freqLabelId} yang terdeteksi.`
      : repeatRule === "none"
        ? `Detected ${item.frequency} recurring pattern from transaction history. Review cadence manually after confirmation.`
        : `Confirmed from detected ${item.frequency} recurring transaction pattern.`;

    setConfirmingRecurringId(item.id);
    addBill.mutate(
      {
        title: item.title,
        amount: Math.round(item.typicalAmount),
        due_date: item.nextExpectedDate,
        repeat_rule: repeatRule,
        note,
        is_paid: false,
      },
      {
        onSuccess: () => {
          setConfirmingRecurringId(null);
          triggerHaptic("medium");
          showToast(
            isIndonesian
              ? `${item.title} ditambahkan ke tagihan rutin`
              : `${item.title} added to recurring bills`,
            "add",
            () => {},
          );
        },
        onError: () => {
          setConfirmingRecurringId(null);
          showToast(
            isIndonesian
              ? "Gagal mengonfirmasi transaksi rutin yang terdeteksi"
              : "Failed to confirm detected recurring item",
            "delete",
            () => {},
          );
        },
      },
    );
  };

  const handleOpenAddBill = () => {
    setEditingBill(null);
    setBillTitle("");
    setBillAmount("");
    setBillDate(new Date());
    setBillRepeat("monthly");
    setBillIsPaid(false);
    setBillWalletId(wallets[0]?.id || "");
    setBillCategoryId("");
    setBillSheetOpen(true);
  };

  const handleOpenEditBill = (b: any) => {
    setEditingBill(b);
    setBillTitle(b.title || "");
    const displayAmt = b.amount
      ? preferredCurrency === "IDR"
        ? Math.round(Number(b.amount))
        : Math.round(
            convertFromIdr(Number(b.amount), preferredCurrency) * 100,
          ) / 100
      : 0;
    setBillAmount(
      displayAmt > 0
        ? formatLiveAmountInput(
            String(displayAmt),
            isIndonesian && currencyMeta.decimals === 0,
            currencyMeta.decimals > 0,
            currencyMeta.decimals,
          ).display
        : "",
    );
    setBillDate(b.due_date ? parseISO(b.due_date) : new Date());
    setBillRepeat(b.repeat_rule || "monthly");
    setBillIsPaid(!!b.is_paid);
    setBillWalletId(b.wallet_id || "");
    setBillCategoryId(b.category_id || "");
    setBillSheetOpen(true);
  };

  const handleRequestDeleteBill = (b: any) => {
    setBillToDelete(b);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!billToDelete) return;
    const toDelete = { ...billToDelete };
    setConfirmDeleteOpen(false);
    setBillToDelete(null);
    if (billSheetOpen && editingBill?.id === toDelete.id) {
      setBillSheetOpen(false);
      setEditingBill(null);
    }

    deleteBill.mutate(toDelete.id, {
      onSuccess: () => {
        triggerHaptic("medium");
        showToast(
          isIndonesian
            ? `Tagihan "${toDelete.title}" dihapus`
            : `Bill "${toDelete.title}" deleted`,
          "delete",
          () => {
            // Undo restore
            addBill.mutate({
              title: toDelete.title,
              amount: toDelete.amount,
              due_date: toDelete.due_date,
              repeat_rule: toDelete.repeat_rule,
              is_paid: toDelete.is_paid,
              note: toDelete.note,
              wallet_id: toDelete.wallet_id,
              category_id: toDelete.category_id,
            });
          },
        );
      },
      onError: (err: any) => {
        showToast(
          err?.message ||
            (isIndonesian ? "Gagal menghapus tagihan" : "Failed to delete bill"),
          "delete",
          () => {},
        );
      },
    });
  };

  const handleSaveBill = () => {
    if (isSubmittingRef.current) return;
    if (!billTitle.trim()) {
      showToast(
        isIndonesian ? "Nama tagihan wajib diisi" : "Bill title is required",
        "delete",
        () => {},
      );
      return;
    }
    const num = parseCleanAmount(billAmount, isIndonesian);
    const idrAmount =
      num > 0 ? Math.round(convertToIdr(num, preferredCurrency)) : null;
    const payload = {
      title: billTitle.trim(),
      amount: idrAmount,
      due_date: format(billDate, "yyyy-MM-dd"),
      repeat_rule: billRepeat,
      is_paid: billIsPaid,
      wallet_id: billWalletId || null,
      category_id: billCategoryId || null,
    };
    isSubmittingRef.current = true;
    if (editingBill) {
      updateBill.mutate(
        { id: editingBill.id, ...payload },
        {
          onSuccess: () => {
            setBillSheetOpen(false);
            setEditingBill(null);
            setBillTitle("");
            setBillAmount("");
            setBillWalletId("");
            setBillCategoryId("");
            showToast(
              isIndonesian ? "Tagihan berhasil diperbarui" : "Bill updated",
              "update",
              () => {},
            );
          },
          onSettled: () => {
            isSubmittingRef.current = false;
          },
        },
      );
    } else {
      addBill.mutate(payload, {
        onSuccess: () => {
          setBillSheetOpen(false);
          setBillTitle("");
          setBillAmount("");
          setBillWalletId("");
          setBillCategoryId("");
          showToast(
            isIndonesian ? "Tagihan berhasil ditambahkan" : "Bill created",
            "add",
            () => {},
          );
        },
        onSettled: () => {
          isSubmittingRef.current = false;
        },
      });
    }
  };

  return (
    <>
      {/* Bill List Sheet */}
      <BottomSheet isOpen={isOpen} onClose={onClose}>
        <div
          className="p-5 space-y-4 font-sans select-none"
          style={{
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
          }}
        >
          <div className="flex items-center justify-between sticky top-0 bg-transparent z-10 pb-1">
            <div>
              <h3
                className="font-semibold text-lg"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? "Tagihan & Langganan Rutin" : "Recurring Bills & Subscriptions"}
              </h3>
              <p
                className="text-[11px] font-medium mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? `${obligations.totalPendingCount} belum bayar · ${obligations.totalPaidCount} lunas`
                  : `${obligations.totalPendingCount} unpaid · ${obligations.totalPaidCount} paid`}
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                setTimeout(() => handleOpenAddBill(), 300);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md active:scale-95 cursor-pointer"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-base)",
              }}
              title={isIndonesian ? "Tambah Tagihan" : "Add Bill"}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Cashflow Obligation Executive Metrics Card */}
          {bills.length > 0 && (
            <div
              className="p-3.5 rounded-2xl border space-y-2.5 transition-all"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {isIndonesian ? "Kewajiban Arus Kas Bulanan" : "Monthly Cashflow Obligation"}
                </span>
                {obligations.overdueCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-semibold border border-white/20 bg-white/10 text-[var(--text-primary)]">
                    {isIndonesian
                      ? `${obligations.overdueCount} Lewat Tempo`
                      : `${obligations.overdueCount} Overdue`}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div
                  className="p-2.5 rounded-xl border flex flex-col justify-center"
                  style={{
                    background: "var(--glass-fill)",
                    borderColor: "var(--glass-border)",
                  }}
                >
                  <span className="text-[10px] text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Komitmen / Bln" : "Run-Rate"}
                  </span>
                  <span className="text-[12.5px] font-bold text-[var(--text-primary)] mt-0.5 truncate amount">
                    {formatWithPreferred(obligations.totalMonthlyCommitment)}
                  </span>
                </div>

                <div
                  className="p-2.5 rounded-xl border flex flex-col justify-center"
                  style={{
                    background: "var(--glass-fill)",
                    borderColor: "var(--glass-border)",
                  }}
                >
                  <span className="text-[10px] text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Tertunda" : "Pending"}
                  </span>
                  <span className="text-[12.5px] font-bold text-[var(--text-primary)] mt-0.5 truncate amount">
                    {formatWithPreferred(obligations.totalPendingAmount)}
                  </span>
                </div>

                <div
                  className="p-2.5 rounded-xl border flex flex-col justify-center"
                  style={{
                    background: "var(--glass-fill)",
                    borderColor: "var(--glass-border)",
                  }}
                >
                  <span className="text-[10px] text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Lunas" : "Settled"}
                  </span>
                  <span className="text-[12.5px] font-bold text-[var(--text-primary)] mt-0.5 truncate amount">
                    {formatWithPreferred(obligations.totalPaidAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2 pb-6">
            <DetectedRecurringSection
              items={detectedRecurringItems}
              confirmingId={confirmingRecurringId}
              onConfirm={handleConfirmRecurring}
              onIgnore={handleIgnoreRecurring}
            />
            {bills.map((b: any) => {
              const isPaid = !!b.is_paid;
              const isTogglingBill =
                markBillPaid.isPending &&
                markBillPaid.variables?.bill.id === b.id;
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    onClose();
                    setTimeout(() => handleOpenEditBill(b), 300);
                  }}
                  className="glass-surface p-3.5 rounded-2xl flex items-center justify-between cursor-pointer active:scale-98 transition-all"
                  style={{ opacity: isPaid ? 0.75 : 1 }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: isPaid
                          ? "var(--glass-fill-strong)"
                          : "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: isPaid ? "var(--text-primary)" : "var(--text-tertiary)",
                      }}
                    >
                      {isPaid ? <Check size={18} strokeWidth={2} /> : <Bell size={18} strokeWidth={1.75} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-bold text-[14px] truncate ${isPaid ? "line-through text-neutral-400" : ""}`}
                          style={{
                            color: isPaid
                              ? "var(--text-tertiary)"
                              : "var(--text-primary)",
                          }}
                        >
                          {b.title}
                        </p>
                        {isPaid && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase bg-white/10 dark:bg-white/10 text-[var(--text-secondary)] border border-[var(--glass-border)]">
                            {isIndonesian ? "Lunas" : "Paid"}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-[11px] font-medium mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        <span className="capitalize">
                          {b.repeat_rule === "none"
                            ? isIndonesian ? "Sekali" : "None"
                            : b.repeat_rule === "weekly"
                              ? isIndonesian ? "Mingguan" : "Weekly"
                              : b.repeat_rule === "monthly"
                                ? isIndonesian ? "Bulanan" : "Monthly"
                                : isIndonesian ? "Tahunan" : "Yearly"}
                        </span>{" "}
                        · {isIndonesian ? `Jatuh tempo ${b.due_date}` : `Due ${b.due_date}`} ·{" "}
                        <span className="amount">{formatWithPreferred(Number(b.amount || 0))}</span>
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 shrink-0 ml-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        if (!isPaid) {
                          setPayingBill(b);
                          triggerHaptic("light");
                        } else {
                          markBillPaid.mutate(
                            { bill: b, paid: false },
                            {
                              onSuccess: () => {
                                showToast(
                                  isIndonesian
                                    ? `${b.title} ditandai belum lunas`
                                    : `Marked ${b.title} as unpaid`,
                                  "update",
                                  () => {},
                                );
                              },
                              onError: (error: any) => {
                                showToast(
                                  error?.message ||
                                    (isIndonesian
                                      ? `Gagal memperbarui ${b.title}`
                                      : `Failed to update ${b.title}`),
                                  "delete",
                                  () => {},
                                );
                              },
                            },
                          );
                          triggerHaptic("medium");
                        }
                      }}
                      disabled={isTogglingBill}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      style={{
                        background: isPaid
                          ? "var(--glass-fill-strong)"
                          : "var(--text-primary)",
                        color: isPaid
                          ? "var(--text-secondary)"
                          : "var(--bg-base)",
                        border: isPaid
                          ? "1px solid var(--glass-border)"
                          : "none",
                      }}
                      title={
                        isPaid
                          ? isIndonesian ? "Tandai Belum Bayar" : "Mark as Unpaid"
                          : isIndonesian ? "Tandai Sudah Bayar" : "Mark as Paid"
                      }
                    >
                      <Check size={12} strokeWidth={2} />
                      <span>
                        {isTogglingBill
                          ? isIndonesian ? "Menyimpan..." : "Saving..."
                          : isPaid
                            ? isIndonesian ? "Batal" : "Unmark"
                            : isIndonesian ? "Bayar" : "Pay"}
                      </span>
                    </button>
                    <button
                      onClick={() => handleRequestDeleteBill(b)}
                      className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 cursor-pointer transition-colors"
                      style={{
                        background: "var(--glass-fill)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                      }}
                      title={isIndonesian ? "Hapus Tagihan" : "Delete Bill"}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
            {bills.length === 0 && (
              <p
                className="text-sm text-center py-4"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Belum ada tagihan rutin terdaftar." : "No recurring bills registered."}
              </p>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Add/Edit Bill Sheet */}
      <BottomSheet
        isOpen={billSheetOpen}
        onClose={() => setBillSheetOpen(false)}
      >
        <div
          className="p-5 space-y-4"
          style={{
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 36px)",
          }}
        >
          <h3
            className="font-semibold text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {editingBill
              ? isIndonesian
                ? "Ubah Tagihan Rutin"
                : "Edit Recurring Bill"
              : isIndonesian
                ? "Tambah Tagihan Rutin"
                : "Add Recurring Bill"}
          </h3>
          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Nama Tagihan" : "Bill Title"}
            </label>
            <input
              type="text"
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              placeholder={
                isIndonesian
                  ? "Misal: Netflix, Listrik, Internet"
                  : "e.g. Netflix, Gym, Internet"
              }
              className="w-full p-3.5 rounded-2xl outline-none font-semibold text-[15px]"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? `Nominal Tagihan (${preferredCurrency})` : `Nominal Amount (${preferredCurrency})`}
            </label>
            <div
              className="flex items-center px-3.5 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <span className="text-[14px] font-bold text-[var(--text-tertiary)] mr-2 select-none">
                {currencyMeta.symbol}
              </span>
              <input
                type="text"
                inputMode={currencyMeta.decimals > 0 ? "decimal" : "numeric"}
                value={
                  billAmount
                    ? formatLiveAmountInput(
                        billAmount,
                        isIndonesian && currencyMeta.decimals === 0,
                        currencyMeta.decimals > 0,
                        currencyMeta.decimals,
                      ).display
                    : ""
                }
                onChange={(e) => {
                  const useIndoSep = isIndonesian && currencyMeta.decimals === 0;
                  const thousandSep = useIndoSep ? "." : ",";
                  const decimalSep = useIndoSep ? "," : ".";
                  const clean = e.target.value
                    .split(thousandSep)
                    .join("")
                    .replace(decimalSep, ".");
                  const numericOnly = clean.replace(/[^0-9.]/g, "");
                  setBillAmount(numericOnly);
                }}
                placeholder="0"
                className="w-full py-3.5 bg-transparent outline-none font-bold text-[16px] amount text-[var(--text-primary)]"
              />
            </div>
          </div>
          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Status Pembayaran" : "Payment Status"}
            </label>
            <div
              className="flex p-1 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <button
                type="button"
                onClick={() => setBillIsPaid(false)}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                style={{
                  background: !billIsPaid ? "var(--text-primary)" : "transparent",
                  color: !billIsPaid
                    ? "var(--bg-base)"
                    : "var(--text-tertiary)",
                }}
              >
                {isIndonesian ? "Belum Bayar" : "Unpaid"}
              </button>
              <button
                type="button"
                onClick={() => setBillIsPaid(true)}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                style={{
                  background: billIsPaid ? "var(--text-primary)" : "transparent",
                  color: billIsPaid
                    ? "var(--bg-base)"
                    : "var(--text-tertiary)",
                }}
              >
                <Check size={12} strokeWidth={2} />
                <span>{isIndonesian ? "Sudah Bayar" : "Paid"}</span>
              </button>
            </div>
          </div>

          {/* Default Account Picker */}
          {wallets.length > 0 && (
            <div>
              <label
                className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Akun Pembayaran Default" : "Default Payment Account"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {wallets.map((w: any) => {
                  const isSelected = billWalletId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setBillWalletId(isSelected ? "" : w.id)}
                      className="p-2.5 rounded-2xl flex items-center gap-2 transition-all text-left cursor-pointer"
                      style={{
                        background: isSelected
                          ? "var(--glass-fill-strong)"
                          : "var(--bg-elevated)",
                        border: isSelected
                          ? "1px solid var(--text-primary)"
                          : "1px solid var(--glass-border)",
                      }}
                    >
                      <IconRenderer icon={w.icon || "Wallet"} size="w-4 h-4" />
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[11.5px] font-semibold truncate"
                          style={{
                            color: isSelected
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                          }}
                        >
                          {w.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Picker */}
          {expenseCategories.length > 0 && (
            <div>
              <label
                className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Kategori Tagihan (Opsional)" : "Bill Category (Optional)"}
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar scroll-smooth">
                <button
                  type="button"
                  onClick={() => setBillCategoryId("")}
                  className={`px-3 py-2 rounded-xl text-[11px] font-semibold shrink-0 transition-all cursor-pointer border ${
                    !billCategoryId
                      ? "bg-white/[0.12] dark:bg-white/[0.16] border-[var(--text-primary)] text-[var(--text-primary)]"
                      : "bg-[var(--bg-elevated)] border-[var(--glass-border)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {isIndonesian ? "Tanpa Kategori" : "No Category"}
                </button>
                {expenseCategories.map((c) => {
                  const isSelected = billCategoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setBillCategoryId(isSelected ? "" : c.id)}
                      className={`px-3 py-2 rounded-xl text-[11px] font-semibold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-white/[0.12] dark:bg-white/[0.16] border-[var(--text-primary)] text-[var(--text-primary)]"
                          : "bg-[var(--bg-elevated)] border-[var(--glass-border)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <IconRenderer icon={c.emoji || "Tag"} size="w-3.5 h-3.5" />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Tanggal Jatuh Tempo" : "Due Date"}
            </label>
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full p-3.5 rounded-2xl flex justify-between items-center cursor-pointer"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <span className="font-medium text-sm">
                {isIndonesian
                  ? `Jatuh tempo: ${format(billDate, "dd MMM yyyy")}`
                  : `Due Date: ${format(billDate, "dd MMM yyyy")}`}
              </span>
              <CalendarIcon size={18} style={{ color: "var(--text-primary)" }} />
            </button>
          </div>
          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Frekuensi Berulang" : "Repeat Frequency"}
            </label>
            <div
              className="flex p-1 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              {(["none", "weekly", "monthly", "yearly"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setBillRepeat(r)}
                  className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                  style={{
                    background:
                      billRepeat === r ? "var(--text-primary)" : "transparent",
                    color:
                      billRepeat === r
                        ? "var(--bg-base)"
                        : "var(--text-tertiary)",
                  }}
                >
                  {r === "none"
                    ? isIndonesian ? "Sekali" : "None"
                    : r === "weekly"
                      ? isIndonesian ? "Mingguan" : "Weekly"
                      : r === "monthly"
                        ? isIndonesian ? "Bulanan" : "Monthly"
                        : isIndonesian ? "Tahunan" : "Yearly"}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleSaveBill}
            className="w-full py-4 rounded-[20px] font-semibold text-[15px] shadow-lg active:scale-95 cursor-pointer"
            style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}
          >
            {editingBill
              ? isIndonesian
                ? "Perbarui Tagihan"
                : "Update Bill"
              : isIndonesian
                ? "Simpan Tagihan"
                : "Save Bill"}
          </button>
          {editingBill && (
            <button
              type="button"
              onClick={() => handleRequestDeleteBill(editingBill)}
              className="w-full py-3.5 rounded-[20px] font-semibold text-[13px] border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              style={{
                background: "var(--glass-fill)",
                borderColor: "var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              <Trash2 size={15} strokeWidth={1.75} />
              <span>{isIndonesian ? "Hapus Tagihan Ini" : "Delete This Bill"}</span>
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Date Picker Sheet for Bills */}
      <BottomSheet isOpen={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div className="p-5 pb-10 flex flex-col items-center">
          <h3
            className="font-semibold text-lg mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Pilih Tanggal Jatuh Tempo" : "Select Due Date"}
          </h3>
          <GlassDatePicker
            date={billDate}
            onChange={(d) => {
              setBillDate(d);
              setPickerOpen(false);
            }}
          />
        </div>
      </BottomSheet>

      {/* Pay Bill Settlement Modal */}
      {payingBill && (
        <PayBillModal
          isOpen={!!payingBill}
          bill={payingBill}
          onClose={() => setPayingBill(null)}
          isPending={markBillPaid.isPending}
          onConfirmPaid={({ bill, recordTransaction, walletId, occurredOn }) => {
            markBillPaid.mutate(
              { bill, paid: true, recordTransaction, walletId, isIndonesian, occurredOn },
              {
                onSuccess: () => {
                  setPayingBill(null);
                  showToast(
                    isIndonesian
                      ? `${bill.title} berhasil ditandai lunas`
                      : `${bill.title} marked as paid`,
                    "add",
                    () => {},
                  );
                },
                onError: (error: any) => {
                  showToast(
                    error?.message ||
                      (isIndonesian
                        ? `Gagal menandai ${bill.title}`
                        : `Failed to mark ${bill.title} as paid`),
                    "delete",
                    () => {},
                  );
                },
              },
            );
          }}
        />
      )}

      {/* Confirmation Modal for Deleting Bill */}
      {confirmDeleteOpen && billToDelete && (
        <GlassConfirmationModal
          isOpen={confirmDeleteOpen}
          onClose={() => {
            setConfirmDeleteOpen(false);
            setBillToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title={isIndonesian ? "Hapus Tagihan Rutin?" : "Delete Recurring Bill?"}
          description={
            isIndonesian
              ? `Apakah Anda yakin ingin menghapus "${billToDelete.title}"? Tindakan ini dapat diurungkan sesaat setelah dihapus.`
              : `Are you sure you want to delete "${billToDelete.title}"? You can undo this action immediately after deleting.`
          }
          confirmLabel={isIndonesian ? "Hapus Tagihan" : "Delete Bill"}
          cancelLabel={isIndonesian ? "Batal" : "Cancel"}
          isIndonesian={isIndonesian}
        />
      )}
    </>
  );
}
