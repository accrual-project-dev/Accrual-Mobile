import { useMemo } from "react";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Edit3,
  ExternalLink,
  Percent,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { usePrivacy } from "../../contexts/PrivacyContext";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import { useAllTransactions } from "../../hooks/useTransactions";
import { resolveWalletClassification } from "../../hooks/useWallets";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { Wallet } from "../../lib/types";

interface CashAccountDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: Wallet | null;
  onEditWallet?: (wallet: Wallet) => void;
  zIndex?: number;
}

export function CashAccountDetailSheet({
  isOpen,
  onClose,
  wallet,
  onEditWallet,
  zIndex,
}: CashAccountDetailSheetProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { isStealthMode } = usePrivacy();
  const navigate = useNavigate();
  const { balancesById, liquidAssets } = useWalletBalances();
  const { data: allTxs = [] } = useAllTransactions();

  // Current balance of this wallet
  const currentBalance = useMemo(() => {
    if (!wallet) return 0;
    return balancesById ? (balancesById[wallet.id] ?? Number(wallet.balance || 0)) : Number(wallet.balance || 0);
  }, [wallet, balancesById]);

  // Share of liquid portfolio
  const liquidShare = useMemo(() => {
    if (!liquidAssets || liquidAssets <= 0 || currentBalance <= 0) return 0;
    return Math.min(100, Math.round((currentBalance / liquidAssets) * 100));
  }, [currentBalance, liquidAssets]);

  // Recent transactions associated with this wallet
  const recentTransactions = useMemo(() => {
    if (!wallet) return [];
    return allTxs
      .filter((tx) => tx.wallet_id === wallet.id || tx.to_wallet_id === wallet.id)
      .sort((a, b) => (b.occurred_on || "").localeCompare(a.occurred_on || ""))
      .slice(0, 10);
  }, [wallet, allTxs]);

  if (!wallet) return null;

  const classification = resolveWalletClassification(wallet);
  const classificationLabel = (() => {
    if (classification === "receivable") {
      return isIndonesian ? "Piutang Tertunda" : "Pending Receivable";
    }
    if (classification === "credit") {
      return isIndonesian ? "Kartu Kredit" : "Credit Card";
    }
    if (classification === "loan") {
      return isIndonesian ? "Kewajiban / Pinjaman" : "Loan / Liability";
    }
    if (classification === "investment") {
      return isIndonesian ? "Kas Sekuritas / RDN" : "Brokerage / RDN Cash";
    }
    return isIndonesian ? "Kas & Rekening Bank" : "Cash & Bank Account";
  })();

  const handleNavigateToTransactions = () => {
    triggerHaptic("light");
    onClose();
    navigate(`/transactions?wallet=${wallet.id}`);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      <div
        className="px-5 space-y-6"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
        }}
      >
        {/* ── 1. Header: Account Icon & Identity ── */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              {wallet.icon ? (
                <IconRenderer icon={wallet.icon} size="text-xl" />
              ) : (
                <WalletIcon size={20} strokeWidth={1.75} />
              )}
            </div>
            <div className="min-w-0">
              <h2
                className="text-[17px] font-bold tracking-tight truncate leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {wallet.name}
              </h2>
              <span
                className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                {classificationLabel}
              </span>
            </div>
          </div>

          {onEditWallet && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onClose();
                onEditWallet(wallet);
              }}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-primary)]"
            >
              <Edit3 size={12} strokeWidth={2} />
              <span>{isIndonesian ? "Ubah" : "Edit"}</span>
            </button>
          )}
        </div>

        {/* ── 2. Hero Valuation Card: Current Balance & Liquid Share ── */}
        <div
          className="p-5 rounded-2xl relative overflow-hidden"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Saldo Terverifikasi" : "Verified Balance"}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
              <CheckCircle2 size={12} strokeWidth={2} className="text-[var(--text-primary)]" />
              <span>{isIndonesian ? "Aktif" : "Active"}</span>
            </div>
          </div>

          <div
            className="text-[26px] font-bold tracking-tight leading-tight mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            {isStealthMode
              ? `${currencyMeta?.symbol || "Rp"} ••••••••`
              : formatWithPreferred(currentBalance)}
          </div>

          {/* Allocation Metric Bar */}
          <div className="pt-3 border-t border-[var(--glass-border)] flex items-center justify-between text-[11.5px]">
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <Percent size={13} strokeWidth={2} />
              <span>{isIndonesian ? "Porsi Kas Likuid" : "Liquid Asset Share"}</span>
            </div>
            <span className="font-bold text-[var(--text-primary)]">
              {liquidShare}% {isIndonesian ? "dari total kas" : "of total cash"}
            </span>
          </div>
        </div>

        {/* ── 3. Quick Action Button ── */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleNavigateToTransactions}
            className="flex-1 py-3 px-4 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-primary)] hover:border-white/20"
          >
            <ExternalLink size={14} strokeWidth={2} />
            <span>{isIndonesian ? "Lihat Semua Mutasi Akun Ini" : "View All Mutations"}</span>
          </button>
        </div>

        {/* ── 4. Recent Transactions List ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock size={13} strokeWidth={2} className="text-[var(--text-tertiary)]" />
              <h3
                className="text-[12px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Mutasi Rekening Terakhir" : "Recent Mutations"}
              </h3>
            </div>
            <span className="text-[10.5px] text-[var(--text-tertiary)]">
              {recentTransactions.length} {isIndonesian ? "tercatat" : "recorded"}
            </span>
          </div>

          {recentTransactions.length === 0 ? (
            <div
              className="p-6 rounded-2xl text-center border border-dashed border-[var(--glass-border)]"
              style={{ background: "var(--glass-fill)" }}
            >
              <p className="text-[12px] text-[var(--text-secondary)]">
                {isIndonesian
                  ? "Belum ada transaksi yang tercatat pada rekening ini."
                  : "No transactions recorded for this account yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentTransactions.map((tx) => {
                const isIncoming =
                  tx.type === "income" ||
                  (tx.type === "transfer" && tx.to_wallet_id === wallet.id);
                const isTransfer = tx.type === "transfer";
                const displayDate = tx.occurred_on
                  ? format(new Date(tx.occurred_on), "dd MMM yyyy", {
                      locale: isIndonesian ? idLocale : undefined,
                    })
                  : "";

                return (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl flex items-center justify-between gap-3 transition-colors"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: isIncoming ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.03)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        {isTransfer ? (
                          <ArrowLeftRight size={12} strokeWidth={2} />
                        ) : isIncoming ? (
                          <ArrowDownRight size={13} strokeWidth={2.2} />
                        ) : (
                          <ArrowUpRight size={13} strokeWidth={2.2} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-[12.5px] font-semibold truncate leading-tight"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {(tx.note && tx.note.trim() !== "-" && tx.note.trim() !== "--" ? tx.note.trim() : null) || (isTransfer ? (isIndonesian ? "Transfer Saldo" : "Balance Transfer") : (isIndonesian ? "Mutasi Keuangan" : "Financial Mutation"))}
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                          {displayDate}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className="text-[12.5px] font-bold tracking-tight"
                        style={{
                          color: isIncoming ? "var(--text-primary)" : "var(--text-secondary)",
                        }}
                      >
                        {isIncoming ? "+" : "—"}{" "}
                        {isStealthMode
                          ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                          : formatWithPreferred(Number(tx.amount || 0))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
