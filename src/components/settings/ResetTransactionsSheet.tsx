import { useState, useMemo } from "react";
import { AlertTriangle, Trash2, RotateCcw } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  useResetTransactions,
  doesTransactionMatchResetPeriod,
  type ResetPeriod,
} from "../../hooks/useResetTransactions";
import { useAllTransactions } from "../../hooks/useTransactions";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { format } from "date-fns";
import { id as idLocale, enUS } from "date-fns/locale";

interface ResetTransactionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResetTransactionsSheet({ isOpen, onClose }: ResetTransactionsSheetProps) {
  const { mutate: resetTxs, isPending } = useResetTransactions();
  const { data: allTxs = [] } = useAllTransactions();
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();

  const [selectedPeriod, setSelectedPeriod] = useState<ResetPeriod>("today");
  const [confirmStep, setConfirmStep] = useState(false);

  // Calculate count of transactions that will be deleted per period (Rule 8.1 Full ISO timestamp aware)
  const { periodCounts, formattedToday, formattedMonth, currentYear } = useMemo(() => {
    const now = new Date();
    const dateLocale = isIndonesian ? idLocale : enUS;
    let today = 0;
    let week = 0;
    let month = 0;
    let year = 0;
    const all = allTxs.length;

    allTxs.forEach((t) => {
      if (!t.occurred_on) return;
      if (doesTransactionMatchResetPeriod(t.occurred_on, "today", now)) today++;
      if (doesTransactionMatchResetPeriod(t.occurred_on, "week", now)) week++;
      if (doesTransactionMatchResetPeriod(t.occurred_on, "month", now)) month++;
      if (doesTransactionMatchResetPeriod(t.occurred_on, "year", now)) year++;
    });

    return {
      periodCounts: { today, week, month, year, all },
      formattedToday: format(now, "dd MMMM yyyy", { locale: dateLocale }),
      formattedMonth: format(now, "MMMM yyyy", { locale: dateLocale }),
      currentYear: now.getFullYear(),
    };
  }, [allTxs, isIndonesian]);

  const periodOptions: { key: ResetPeriod; title: string; subtitle: string; count: number }[] = [
    {
      key: "today",
      title: isIndonesian ? "Hari Ini" : "Today",
      subtitle: formattedToday,
      count: periodCounts.today,
    },
    {
      key: "week",
      title: isIndonesian ? "Minggu Ini" : "This Week",
      subtitle: isIndonesian ? "7 hari terakhir" : "Past 7 days",
      count: periodCounts.week,
    },
    {
      key: "month",
      title: isIndonesian ? "Bulan Ini" : "This Month",
      subtitle: formattedMonth,
      count: periodCounts.month,
    },
    {
      key: "year",
      title: isIndonesian ? "Tahun Ini" : "This Year",
      subtitle: isIndonesian ? `Tahun ${currentYear}` : `Year ${currentYear}`,
      count: periodCounts.year,
    },
    {
      key: "all",
      title: isIndonesian ? "Semua Transaksi" : "All Transactions",
      subtitle: isIndonesian ? "Seluruh riwayat transaksi" : "Full transaction history",
      count: periodCounts.all,
    },
  ];

  const handleExecuteReset = () => {
    resetTxs(selectedPeriod, {
      onSuccess: () => {
        const opt = periodOptions.find((o) => o.key === selectedPeriod);
        showToast(
          isIndonesian
            ? `Transaksi (${opt?.title}) berhasil direset`
            : `Transactions (${opt?.title}) reset successfully`,
          "delete",
          () => {},
        );
        setConfirmStep(false);
        onClose();
      },
      onError: (err: any) => {
        showToast(
          err.message ||
            (isIndonesian ? "Gagal me-reset transaksi" : "Failed to reset transactions"),
          "delete",
          () => {},
        );
      },
    });
  };

  const handleClose = () => {
    if (isPending) return;
    setConfirmStep(false);
    onClose();
  };

  const activeOption = periodOptions.find((o) => o.key === selectedPeriod);

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose}>
      <div className="p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)] space-y-5">
        <div className="text-center">
          <div
            className="w-14 h-14 mx-auto rounded-3xl flex items-center justify-center mb-3 shadow-lg"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <RotateCcw size={24} strokeWidth={1.75} style={{ color: "var(--text-primary)" }} />
          </div>
          <h3 className="font-semibold text-[20px] tracking-tight" style={{ color: "var(--text-primary)" }}>
            {isIndonesian ? "Reset Data Transaksi" : "Reset Transaction Data"}
          </h3>
          <p className="text-[12px] font-medium mt-1" style={{ color: "var(--text-tertiary)" }}>
            {isIndonesian
              ? "Pilih rentang waktu transaksi yang ingin Anda bersihkan"
              : "Select the timeframe of transactions you wish to purge"}
          </p>
        </div>

        {!confirmStep ? (
          <>
            {/* Period Selection */}
            <div className="space-y-2.5">
              {periodOptions.map((opt) => {
                const isSelected = selectedPeriod === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedPeriod(opt.key)}
                    className="w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all active:scale-98 cursor-pointer"
                    style={{
                      background: isSelected ? "var(--bg-elevated-2)" : "var(--bg-elevated)",
                      border: `1px solid ${isSelected ? "var(--text-primary)" : "var(--glass-border)"}`,
                      boxShadow: isSelected ? "0 4px 16px var(--shadow-strength)" : "none",
                    }}
                  >
                    <div>
                      <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>
                        {opt.title}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        {opt.subtitle}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className="amount font-semibold text-[14px]"
                        style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}
                      >
                        {opt.count} {isIndonesian ? "data" : "txs"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setConfirmStep(true)}
              disabled={activeOption?.count === 0}
              className="w-full py-4 rounded-[20px] font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl disabled:opacity-40 cursor-pointer"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-primary)",
              }}
            >
              <Trash2 size={16} strokeWidth={1.75} />
              <span>
                {isIndonesian
                  ? `Lanjutkan Hapus (${activeOption?.count ?? 0} Transaksi)`
                  : `Proceed to Delete (${activeOption?.count ?? 0} Transactions)`}
              </span>
            </button>
          </>
        ) : (
          /* Confirmation Step */
          <div className="space-y-5">
            <div
              className="p-4 rounded-2xl flex items-start gap-3"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <AlertTriangle
                size={20}
                strokeWidth={1.75}
                className="shrink-0 mt-0.5"
                style={{ color: "var(--text-primary)" }}
              />
              <div>
                <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>
                  {isIndonesian ? "Konfirmasi Penghapusan" : "Confirm Deletion"}
                </p>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian ? (
                    <>
                      Sebanyak <strong>{activeOption?.count} transaksi</strong> pada periode{" "}
                      <strong>{activeOption?.title}</strong> ({activeOption?.subtitle}) akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
                    </>
                  ) : (
                    <>
                      A total of <strong>{activeOption?.count} transactions</strong> in{" "}
                      <strong>{activeOption?.title}</strong> ({activeOption?.subtitle}) will be permanently deleted. This action cannot be undone.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmStep(false)}
                disabled={isPending}
                className="flex-1 py-3.5 rounded-[18px] font-semibold text-[14px] active:scale-95 transition-all cursor-pointer"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                {isIndonesian ? "Batal" : "Cancel"}
              </button>
              <button
                onClick={handleExecuteReset}
                disabled={isPending}
                className="flex-1 py-3.5 rounded-[18px] font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-primary)",
                }}
              >
                <Trash2 size={16} strokeWidth={1.75} />
                <span>
                  {isPending
                    ? isIndonesian
                      ? "Menghapus..."
                      : "Deleting..."
                    : isIndonesian
                      ? "Ya, Hapus"
                      : "Yes, Delete"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

