import { useState, useEffect } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import type { Bill } from "../../lib/types";
import { useWallets } from "../../hooks/useWallets";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { triggerHaptic } from "../../lib/haptics";
import {
  CheckCircle2,
  Wallet as WalletIcon,
  Users,
  Receipt,
  Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export interface PayBillSettlementParams {
  bill: Bill;
  recordTransaction: boolean;
  walletId?: string;
  occurredOn?: string;
}

interface PayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  onConfirmPaid: (params: PayBillSettlementParams) => void;
  isPending?: boolean;
}

export function PayBillModal({
  isOpen,
  onClose,
  bill,
  onConfirmPaid,
  isPending = false,
}: PayBillModalProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const { data: wallets = [] } = useWallets();
  const { balancesById } = useWalletBalances();

  // Mode: "personal" (record transaction) vs "third_party" (paid by someone else)
  const [paymentMode, setPaymentMode] = useState<"personal" | "third_party">("personal");
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");

  useEffect(() => {
    if (bill && isOpen) {
      setPaymentMode("personal");
      // Preselect bill.wallet_id if defined, otherwise first wallet
      if (bill.wallet_id && wallets.some((w) => w.id === bill.wallet_id)) {
        setSelectedWalletId(bill.wallet_id);
      } else if (wallets.length > 0) {
        setSelectedWalletId(wallets[0].id);
      }
    }
  }, [bill, isOpen, wallets]);

  if (!bill) return null;

  const handleConfirm = () => {
    triggerHaptic("medium");
    onConfirmPaid({
      bill,
      recordTransaction: paymentMode === "personal",
      walletId: paymentMode === "personal" ? selectedWalletId : undefined,
      occurredOn: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
    });
  };

  const formattedDate = bill.due_date
    ? (() => {
        try {
          return format(parseISO(bill.due_date), "dd MMMM yyyy", {
            locale: isIndonesian ? idLocale : undefined,
          });
        } catch {
          return bill.due_date;
        }
      })()
    : "—";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),28px)] space-y-4">
        {/* Header Bar */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Receipt size={18} strokeWidth={1.75} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="font-semibold text-base tracking-tight text-[var(--text-primary)]">
              {isIndonesian ? "Konfirmasi Pembayaran Tagihan" : "Confirm Bill Payment"}
            </h3>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {isIndonesian
                ? "Pilih metode pencatatan arus kas tagihan ini"
                : "Select how to record this bill settlement"}
            </p>
          </div>
        </div>

        {/* Bill Summary Hero Card */}
        <div
          className="p-4 rounded-2xl space-y-2 border border-[var(--glass-border)] bg-[var(--bg-elevated)]"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
                {isIndonesian ? "Tagihan" : "Bill Title"}
              </span>
              <h4 className="text-[15px] font-bold text-[var(--text-primary)] truncate mt-0.5">
                {bill.title}
              </h4>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
                {isIndonesian ? "Nominal" : "Amount"}
              </span>
              <p className="text-[16px] font-bold text-[var(--text-primary)] amount mt-0.5">
                {formatWithPreferred(Number(bill.amount || 0))}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--glass-border)] flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
              <Calendar size={12} strokeWidth={1.5} />
              <span>{isIndonesian ? "Jatuh Tempo" : "Due Date"}</span>
            </span>
            <span className="font-medium text-[var(--text-secondary)]">
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Payment Mode Selection */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] block px-1">
            {isIndonesian ? "Pilihan Sumber Pembayaran" : "Settlement Source"}
          </label>

          {/* Option 1: Personal Account */}
          <div
            onClick={() => {
              triggerHaptic("light");
              setPaymentMode("personal");
            }}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
              paymentMode === "personal"
                ? "border-black/30 dark:border-white/25 bg-black/[0.04] dark:bg-white/[0.06] shadow-xs"
                : "border-[var(--glass-border)] bg-[var(--bg-elevated)] opacity-60 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <WalletIcon size={14} strokeWidth={1.75} className="text-[var(--text-primary)]" />
                </div>
                <div>
                  <h5 className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {isIndonesian ? "Bayar dari Akun Pribadi" : "Pay from Personal Account"}
                  </h5>
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    {isIndonesian
                      ? "Potong saldo akun dan catat transaksi pengeluaran"
                      : "Deduct account balance and record expense transaction"}
                  </p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                  paymentMode === "personal"
                    ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]"
                    : "border-[var(--glass-border)] bg-transparent"
                }`}
              >
                {paymentMode === "personal" && <CheckCircle2 size={13} strokeWidth={2.5} />}
              </div>
            </div>

            {/* Wallet Selector Pills (Visible when personal mode is active) */}
            {paymentMode === "personal" && wallets.length > 0 && (
              <div className="pt-1 border-t border-[var(--glass-border)]">
                <span className="text-[10px] font-medium text-[var(--text-tertiary)] block mb-1.5">
                  {isIndonesian ? "Pilih Akun Sumber:" : "Select Debit Account:"}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {wallets.map((w) => {
                    const isSelected = selectedWalletId === w.id;
                    const bal = balancesById[w.id] ?? (w as any).balance ?? 0;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic("light");
                          setSelectedWalletId(w.id);
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-black/35 dark:border-white/30 bg-black/[0.08] dark:bg-white/[0.12] shadow-xs"
                            : "border-[var(--glass-border)] bg-[var(--glass-fill)] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                        }`}
                      >
                        <IconRenderer icon={w.icon || "Wallet"} size="w-4 h-4" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11.5px] font-semibold text-[var(--text-primary)] truncate">
                            {w.name}
                          </p>
                          <p className="text-[10px] font-medium text-[var(--text-tertiary)] truncate amount">
                            {formatWithPreferred(bal)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {paymentMode === "personal" && wallets.length === 0 && (
              <div className="pt-2 border-t border-[var(--glass-border)] text-center py-2">
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Belum ada akun dompet aktif. Tambahkan akun terlebih dahulu atau gunakan opsi pembayaran pihak ketiga."
                    : "No active accounts found. Please add an account first or settle via third party."}
                </p>
              </div>
            )}
          </div>

          {/* Option 2: Paid by Someone Else */}
          <div
            onClick={() => {
              triggerHaptic("light");
              setPaymentMode("third_party");
            }}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              paymentMode === "third_party"
                ? "border-black/30 dark:border-white/25 bg-black/[0.04] dark:bg-white/[0.06] shadow-xs"
                : "border-[var(--glass-border)] bg-[var(--bg-elevated)] opacity-60 hover:opacity-100"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <Users size={14} strokeWidth={1.75} className="text-[var(--text-primary)]" />
              </div>
              <div>
                <h5 className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian ? "Dibayar oleh Orang Lain / Kantor" : "Paid by Someone Else / Company"}
                </h5>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Tandai lunas tanpa memotong saldo akun & tanpa mencatat transaksi"
                    : "Mark as paid without recording any transaction or debiting funds"}
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                paymentMode === "third_party"
                  ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]"
                  : "border-[var(--glass-border)] bg-transparent"
              }`}
            >
              {paymentMode === "third_party" && <CheckCircle2 size={13} strokeWidth={2.5} />}
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || (paymentMode === "personal" && !selectedWalletId)}
            className="w-full h-12 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 shadow-sm"
            style={{
              background: "var(--text-primary)",
              color: "var(--bg-base)",
            }}
          >
            <CheckCircle2 size={15} strokeWidth={2} />
            <span>
              {isPending
                ? isIndonesian
                  ? "Memproses Pembayaran..."
                  : "Processing Payment..."
                : isIndonesian
                  ? "Tandai Sudah Bayar"
                  : "Confirm Paid"}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-xl font-medium text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-[0.98] transition-all cursor-pointer"
          >
            {isIndonesian ? "Batal" : "Cancel"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
