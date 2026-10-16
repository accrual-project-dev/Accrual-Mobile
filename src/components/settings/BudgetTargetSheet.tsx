import { useState, useEffect, useMemo } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { formatLiveAmountInput } from "../../lib/utils";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { getBudgetPeriodInterval } from "../../lib/financialMath";
import { Calendar } from "lucide-react";

interface BudgetTargetSheetProps {
  isOpen: boolean;
  onClose: () => void;
  budgetTarget: number;
  setBudgetTarget: (amount: number) => void;
  budgetPeriodStart?: number;
  setBudgetPeriodStart?: (day: number) => void;
}

export function BudgetTargetSheet({
  isOpen,
  onClose,
  budgetTarget,
  setBudgetTarget,
  budgetPeriodStart = 1,
  setBudgetPeriodStart,
}: BudgetTargetSheetProps) {
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();
  const { preferredCurrency, currencyMeta, convertToIdr, convertFromIdr } =
    useCurrency();

  const [rawAmount, setRawAmount] = useState<number>(0);
  const [displayAmount, setDisplayAmount] = useState<string>("");
  const [tempPeriodStart, setTempPeriodStart] = useState<number>(budgetPeriodStart);
  const [isCustomDay, setIsCustomDay] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (budgetTarget > 0) {
        if (preferredCurrency === "IDR") {
          setRawAmount(budgetTarget);
          setDisplayAmount(budgetTarget.toLocaleString("id-ID"));
        } else {
          const inPreferred = convertFromIdr(budgetTarget, preferredCurrency);
          const rounded =
            currencyMeta.decimals === 0
              ? Math.round(inPreferred)
              : Math.round(inPreferred * 100) / 100;
          setRawAmount(rounded);
          setDisplayAmount(
            currencyMeta.decimals === 0
              ? rounded.toLocaleString("ja-JP")
              : rounded.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: currencyMeta.decimals,
                })
          );
        }
      } else {
        setRawAmount(0);
        setDisplayAmount("");
      }
      setTempPeriodStart(budgetPeriodStart);
      setIsCustomDay(![1, 25, 27].includes(budgetPeriodStart));
    }
  }, [
    isOpen,
    budgetTarget,
    budgetPeriodStart,
    preferredCurrency,
    convertFromIdr,
    currencyMeta.decimals,
  ]);

  const previewInterval = useMemo(() => {
    return getBudgetPeriodInterval(new Date(), tempPeriodStart);
  }, [tempPeriodStart]);

  const handleSave = () => {
    let targetInIdr = 0;
    if (rawAmount > 0) {
      targetInIdr =
        preferredCurrency === "IDR"
          ? Math.round(rawAmount)
          : Math.round(convertToIdr(rawAmount, preferredCurrency));
    }
    setBudgetTarget(targetInIdr);
    if (setBudgetPeriodStart) {
      setBudgetPeriodStart(tempPeriodStart);
    }
    onClose();
    showToast(
      isIndonesian
        ? "Pengaturan anggaran berhasil disimpan"
        : "Budget settings saved successfully",
      "add",
      () => {},
    );
  };

  const presetDays = [
    {
      day: 1,
      label: isIndonesian ? "Tgl 1" : "Day 1",
      desc: isIndonesian ? "Awal Bulan" : "Calendar",
    },
    {
      day: 25,
      label: isIndonesian ? "Tgl 25" : "Day 25",
      desc: isIndonesian ? "Gajian" : "Payroll",
    },
    {
      day: 27,
      label: isIndonesian ? "Tgl 27" : "Day 27",
      desc: isIndonesian ? "Gajian" : "Payroll",
    },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="p-5 space-y-5"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 16px), 32px)",
        }}
      >
        <div>
          <h3
            className="font-semibold text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Anggaran & Siklus Belanja" : "Budget & Spending Cycle"}
          </h3>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
            {isIndonesian
              ? "Atur batas maksimal belanja bulanan dan sinkronkan siklus pembukuan dengan tanggal gajian Anda."
              : "Set your monthly spending limit and synchronize the cycle with your salary date."}
          </p>
        </div>

        {/* Target Amount */}
        <div>
          <label
            className="text-[10px] font-semibold uppercase tracking-wider mb-1 block px-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Batas Anggaran Bulanan" : "Monthly Spending Limit"}
          </label>
          <div className="flex items-center px-3.5 py-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] focus-within:border-[var(--text-primary)] transition-colors">
            <span
              className="text-[15px] font-semibold mr-1.5 select-none"
              style={{ color: "var(--text-secondary)" }}
            >
              {currencyMeta.symbol}
            </span>
            <input
              type="text"
              inputMode={currencyMeta.decimals > 0 ? "decimal" : "numeric"}
              value={displayAmount}
              onChange={(e) => {
                const { raw, formatted } = formatLiveAmountInput(
                  e.target.value,
                  preferredCurrency === "IDR" && isIndonesian,
                  currencyMeta.decimals > 0,
                  currencyMeta.decimals
                );
                setRawAmount(raw);
                setDisplayAmount(formatted);
              }}
              placeholder="0"
              className="w-full bg-transparent outline-none font-semibold text-[16px] amount"
              style={{
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* Budget Period Start Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <label
              className="text-[10px] font-semibold uppercase tracking-wider block"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Awal Siklus Anggaran" : "Budget Period Start"}
            </label>
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian
                ? `Siklus dimulai tanggal ${tempPeriodStart}`
                : `Cycle begins Day ${tempPeriodStart}`}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {presetDays.map((preset) => {
              const active = !isCustomDay && tempPeriodStart === preset.day;
              return (
                <button
                  key={preset.day}
                  type="button"
                  onClick={() => {
                    setTempPeriodStart(preset.day);
                    setIsCustomDay(false);
                  }}
                  className={`py-2 px-2 rounded-xl text-center transition-all active:scale-95 cursor-pointer border ${
                    active
                      ? "bg-black/[0.08] dark:bg-white/[0.12] border-black/15 dark:border-white/25 shadow-xs"
                      : "bg-black/[0.02] dark:bg-white/[0.03] border-black/6 dark:border-white/8 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <div
                    className={`text-[12px] font-semibold ${
                      active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {preset.label}
                  </div>
                  <div className="text-[9.5px] text-[var(--text-tertiary)] truncate">
                    {preset.desc}
                  </div>
                </button>
              );
            })}

            {/* Custom Day Option */}
            <button
              type="button"
              onClick={() => setIsCustomDay(true)}
              className={`py-2 px-2 rounded-xl text-center transition-all active:scale-95 cursor-pointer border ${
                isCustomDay
                  ? "bg-black/[0.08] dark:bg-white/[0.12] border-black/15 dark:border-white/25 shadow-xs"
                  : "bg-black/[0.02] dark:bg-white/[0.03] border-black/6 dark:border-white/8 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              }`}
            >
              <div
                className={`text-[12px] font-semibold ${
                  isCustomDay ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                {isIndonesian ? "Kustom" : "Custom"}
              </div>
              <div className="text-[9.5px] text-[var(--text-tertiary)] truncate">
                {isIndonesian ? "Tgl 1–28" : "Day 1–28"}
              </div>
            </button>
          </div>

          {/* Custom Day Input */}
          {isCustomDay && (
            <div className="pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                  max="28"
                  value={tempPeriodStart}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setTempPeriodStart(Math.max(1, Math.min(28, val)));
                    }
                  }}
                  className="w-20 py-1.5 px-2.5 rounded-xl outline-none font-semibold text-center text-[13px] border border-[var(--glass-border)] bg-[var(--bg-elevated)]"
                  style={{
                    color: "var(--text-primary)",
                  }}
                />
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Tanggal setiap bulan (1 hingga 28)"
                    : "Day of every month (1 to 28)"}
                </span>
              </div>
            </div>
          )}

          {/* Interval Preview Card */}
          <div
            className="p-3 rounded-xl flex items-center gap-2.5 border border-[var(--glass-border)] bg-[var(--glass-fill)]"
          >
            <Calendar size={14} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Rentang Siklus Aktif" : "Active Cycle Range"}
              </div>
              <div className="text-[11.5px] font-medium text-[var(--text-primary)] mt-0.5">
                {previewInterval.label}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl font-semibold text-[13px] active:scale-98 transition-transform cursor-pointer"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {isIndonesian ? "Simpan Pengaturan Anggaran" : "Save Budget Settings"}
        </button>
      </div>
    </BottomSheet>
  );
}
