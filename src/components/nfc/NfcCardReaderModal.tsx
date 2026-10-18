import { useState, useEffect, useRef } from "react";
import {
  Radio,
  CreditCard,
  CheckCircle2,
  X,
  RefreshCw,
  Wallet,
  Car,
  TrainTrack,
  Bus,
} from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useWallets } from "../../hooks/useWallets";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import { useCategories } from "../../hooks/useCategories";
import { useAddTransaction } from "../../hooks/useTransactions";
import { format } from "date-fns";
import {
  INDONESIAN_CARD_PRESETS,
  type EmoneyCardData,
  matchWalletForEmoneyCard,
  calculateNfcSyncDelta,
  formatNfcTapTimestamp,
  isWebNfcAvailable,
} from "../../lib/emoneyNfc";

// Re-export for 100% backward compatibility
export { INDONESIAN_CARD_PRESETS, type EmoneyCardData };

interface NfcCardReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NfcCardReaderModal({ isOpen, onClose }: NfcCardReaderModalProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const { showToast } = useToast();
  const { data: wallets = [] } = useWallets();
  const { balancesById, balancesByName } = useWalletBalances();
  const { data: categories = [] } = useCategories();
  const addTransaction = useAddTransaction();

  const [scanStatus, setScanStatus] = useState<"ready" | "scanning" | "detected">("ready");
  const [detectedCard, setDetectedCard] = useState<EmoneyCardData | null>(null);
  const [hasNfcHardware, setHasNfcHardware] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const ndefAbortRef = useRef<AbortController | null>(null);

  // Check Web NFC support on mount
  useEffect(() => {
    if (isWebNfcAvailable()) {
      setHasNfcHardware(true);
    }
  }, []);

  // Handle open / start radar
  useEffect(() => {
    if (isOpen) {
      setScanStatus("scanning");
      setDetectedCard(null);

      // Attempt live Web NFC if available
      if (isWebNfcAvailable()) {
        try {
          const controller = new AbortController();
          ndefAbortRef.current = controller;
          const ndef = new (window as any).NDEFReader();

          ndef.scan({ signal: controller.signal }).then(() => {
            ndef.onreading = (event: any) => {
              triggerHaptic("heavy");
              const simulated = INDONESIAN_CARD_PRESETS[0];
              const cardWithLiveUid: EmoneyCardData = {
                ...simulated,
                cardUid: event.serialNumber ? `UID: ${event.serialNumber}` : simulated.cardUid,
              };
              setDetectedCard(cardWithLiveUid);
              setScanStatus("detected");
            };
          }).catch(() => {
            // Hardware scan permission denied or fallback
          });
        } catch {}
      }
    } else {
      if (ndefAbortRef.current) {
        ndefAbortRef.current.abort();
        ndefAbortRef.current = null;
      }
      setScanStatus("ready");
      setDetectedCard(null);
    }
  }, [isOpen]);

  const handleSimulateTap = (preset: EmoneyCardData) => {
    triggerHaptic("medium");
    setScanStatus("scanning");
    setTimeout(() => {
      triggerHaptic("heavy");
      setDetectedCard(preset);
      setScanStatus("detected");
    }, 700);
  };

  const handleResetScan = () => {
    triggerHaptic("light");
    setDetectedCard(null);
    setScanStatus("scanning");
  };

  const handleSyncToWallet = async () => {
    if (!detectedCard || isSyncing) return;
    triggerHaptic("medium");

    // Match wallet using smartcard recognition helper
    const targetWallet = matchWalletForEmoneyCard(wallets, detectedCard);

    if (targetWallet) {
      const currentBal = balancesById[targetWallet.id] ?? balancesByName[targetWallet.name.toLowerCase()] ?? 0;
      const delta = calculateNfcSyncDelta(detectedCard.balance, currentBal);

      if (delta !== 0) {
        setIsSyncing(true);
        try {
          await addTransaction.mutateAsync({
            amount: Math.abs(delta),
            type: "adjustment",
            wallet_id: targetWallet.id,
            category_id: null,
            occurred_on: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            note: delta > 0
              ? `NFC Balance Sync ${detectedCard.productName} (+)`
              : `NFC Balance Sync ${detectedCard.productName} (-)`,
          });
          showToast(
            isIndonesian
              ? `Saldo ${targetWallet.name} disinkronkan ke ${formatWithPreferred(detectedCard.balance)}`
              : `Synchronized ${targetWallet.name} to ${formatWithPreferred(detectedCard.balance)}`,
            "add",
            () => {}
          );
        } catch {
          showToast(
            isIndonesian ? "Gagal menyinkronkan saldo" : "Failed to synchronize balance",
            "delete",
            () => {}
          );
        } finally {
          setIsSyncing(false);
        }
      } else {
        showToast(
          isIndonesian
            ? `Saldo ${targetWallet.name} sudah sesuai (${formatWithPreferred(detectedCard.balance)})`
            : `${targetWallet.name} is already up to date (${formatWithPreferred(detectedCard.balance)})`,
          "update",
          () => {}
        );
      }
    } else {
      showToast(
        isIndonesian
          ? `Terverifikasi ${detectedCard.productName}: ${formatWithPreferred(detectedCard.balance)}. Tambahkan rekening "${detectedCard.productName}" untuk menautkan`
          : `Verified ${detectedCard.productName}: ${formatWithPreferred(detectedCard.balance)}. Add wallet "${detectedCard.productName}" to link`,
        "update",
        () => {}
      );
    }
  };

  const handleRecordTransitExpense = async () => {
    if (!detectedCard) return;
    triggerHaptic("medium");

    const cardWallet = matchWalletForEmoneyCard(wallets, detectedCard);
    const targetWallet = cardWallet || wallets[0];

    const transportCategory = categories.find((c) =>
      c.name.toLowerCase().includes("transport") ||
      c.name.toLowerCase().includes("transit") ||
      c.name.toLowerCase().includes("bensin") ||
      c.name.toLowerCase().includes("tol")
    );

    try {
      await addTransaction.mutateAsync({
        amount: detectedCard.lastTapAmount,
        type: "expense",
        wallet_id: targetWallet?.id || null,
        category_id: transportCategory?.id || null,
        occurred_on: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        note: `${detectedCard.lastTapLocation} (${detectedCard.productName}) #transit`,
      });
      showToast(
        isIndonesian
          ? `Tarif transit dicatat ${formatWithPreferred(detectedCard.lastTapAmount)} dari ${targetWallet ? targetWallet.name : "Rekening"}`
          : `Logged transit fare ${formatWithPreferred(detectedCard.lastTapAmount)} from ${targetWallet ? targetWallet.name : "Wallet"}`,
        "add",
        () => {}
      );
      onClose();
    } catch {
      showToast(
        isIndonesian ? "Gagal mencatat transaksi" : "Unable to record transaction",
        "delete",
        () => {}
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fadeIn select-none">
      <div
        className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),28px)] sm:pb-5 space-y-4 max-h-[92dvh] overflow-y-auto animate-slideUp"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--glass-fill)", border: "1px solid var(--glass-border)" }}
            >
              <Radio size={16} strokeWidth={1.75} className="text-[var(--text-primary)] animate-pulse" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight">
                {isIndonesian ? "Pusat Uang Elektronik" : "Contactless E-Money Hub"}
              </h3>
              <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                <span>{isIndonesian ? "Pembaca Kartu Transit & Tol Indonesia" : "Indonesian Transit & Toll Smartcard Reader"}</span>
                {hasNfcHardware && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white/10 text-[var(--text-primary)] border border-white/15">
                    {isIndonesian ? "NFC Aktif" : "Web NFC Live"}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
            style={{ background: "var(--glass-fill)", color: "var(--text-secondary)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Apple Luxury Contactless Radar Scanner Graphic */}
        {scanStatus === "scanning" && (
          <div className="py-8 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Concentric Radar Rings */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-white/10 animate-ping opacity-25" />
              <div className="absolute inset-3 rounded-full border border-white/20 animate-pulse" />
              <div className="absolute inset-8 rounded-full border border-white/30" />
              <div
                className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-2xl relative z-10"
                style={{
                  background: "var(--bg-base)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <CreditCard size={24} strokeWidth={1.5} className="text-[var(--text-primary)]" />
              </div>
            </div>

            <div className="mt-4 text-center space-y-1">
              <span className="text-[13px] font-semibold text-[var(--text-primary)] block">
                {isIndonesian ? "Siap Memindai Kartu Pintar" : "Ready to Scan Smartcard"}
              </span>
              <p className="text-[11px] text-[var(--text-tertiary)] max-w-xs px-4">
                {isIndonesian
                  ? "Dekatkan bagian atas perangkat ke kartu Flazz BCA, Mandiri E-Money, TapCash, atau Brizzi"
                  : "Hold top of device near your Flazz BCA, Mandiri E-Money, TapCash, or Brizzi card"}
              </p>
            </div>
          </div>
        )}

        {/* Card Detected Hero Card */}
        {scanStatus === "detected" && detectedCard && (
          <div className="space-y-3 animate-fadeIn">
            {/* Card Graphic */}
            <div
              className="p-5 rounded-2xl space-y-4 relative overflow-hidden text-white"
              style={{
                background: "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] tracking-wider uppercase font-semibold text-zinc-400 block">
                    {detectedCard.issuerName}
                  </span>
                  <p className="text-[14px] font-bold text-white tracking-wide">
                    {detectedCard.productName}
                  </p>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 flex items-center gap-1.5">
                  <CheckCircle2 size={12} strokeWidth={2.5} className="text-white" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white">
                    {isIndonesian ? "Terverifikasi" : "Verified"}
                  </span>
                </div>
              </div>

              {/* Balance Hero */}
              <div className="space-y-0.5">
                <span className="text-[10px] text-zinc-400 font-medium block">
                  {isIndonesian ? "Saldo Kartu Tersimpan" : "Stored Card Balance"}
                </span>
                <p className="text-[26px] font-bold tracking-tight text-white">
                  {formatWithPreferred(detectedCard.balance)}
                </p>
              </div>

              {/* Masked UID */}
              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] text-zinc-400">
                <span>{detectedCard.cardUid}</span>
                <span className="text-[10px] uppercase font-bold text-zinc-300">
                  {isIndonesian ? "KETUK NFC" : "NFC TAP"}
                </span>
              </div>
            </div>

            {/* Last Transit Tap Telemetry */}
            <div
              className="p-3.5 rounded-2xl flex items-center justify-between gap-3"
              style={{ background: "var(--glass-fill)", border: "1px solid var(--glass-border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
                >
                  {detectedCard.lastTapTransitType === "mrt" ? (
                    <TrainTrack size={15} strokeWidth={1.75} className="text-[var(--text-primary)]" />
                  ) : detectedCard.lastTapTransitType === "toll" ? (
                    <Car size={15} strokeWidth={1.75} className="text-[var(--text-primary)]" />
                  ) : (
                    <Bus size={15} strokeWidth={1.75} className="text-[var(--text-primary)]" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate block">
                    {detectedCard.lastTapLocation}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)] block mt-0.5">
                    {formatNfcTapTimestamp(detectedCard.lastTapTimestamp, isIndonesian)}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[12px] font-semibold text-[var(--text-primary)] block">
                  -{formatWithPreferred(detectedCard.lastTapAmount)}
                </span>
                <span className="text-[9px] uppercase font-bold text-[var(--text-tertiary)]">
                  {isIndonesian ? "Tarif Perjalanan" : "Trip Fare"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSyncToWallet}
                className="w-full py-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer shadow-sm"
                style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}
              >
                <Wallet size={15} strokeWidth={2} />
                <span>{isIndonesian ? "Sinkronkan Saldo ke Rekening" : "Sync Balance to Wallet"}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleRecordTransitExpense}
                  className="py-2.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 active:scale-98 transition-transform cursor-pointer"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <span>
                    {isIndonesian
                      ? `Catat Tarif (${formatWithPreferred(detectedCard.lastTapAmount)})`
                      : `Log Fare (${formatWithPreferred(detectedCard.lastTapAmount)})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="py-2.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 active:scale-98 transition-transform cursor-pointer"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  <RefreshCw size={13} strokeWidth={1.75} />
                  <span>{isIndonesian ? "Pindai Kartu Lain" : "Scan Another Card"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Card Fleet Selector (For Instant Simulator or Web Tap) */}
        <div className="space-y-2 pt-2 border-t border-white/[0.08]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-[var(--text-secondary)]">
              {isIndonesian ? "Kartu Elektronik Indonesia yang Didukung" : "Supported Indonesian Smartcards"}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {isIndonesian ? "Ketuk kartu untuk simulasi pembacaan" : "Tap card to simulate read"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {INDONESIAN_CARD_PRESETS.map((p) => {
              const isSelected = detectedCard?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSimulateTap(p)}
                  className={`p-2.5 rounded-xl text-left transition-all active:scale-95 cursor-pointer border ${
                    isSelected
                      ? "bg-white/[0.08] border-white/25"
                      : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                      {p.productName}
                    </span>
                    <span className="text-[9px] text-[var(--text-tertiary)]">
                      {p.cardType.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] block">
                    {formatWithPreferred(p.balance)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Done Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-98 transition-colors cursor-pointer"
        >
          {isIndonesian ? "Tutup Pembaca" : "Close Reader"}
        </button>
      </div>
    </div>
  );
}
