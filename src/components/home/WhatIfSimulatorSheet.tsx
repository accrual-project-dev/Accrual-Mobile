import { useState, useMemo, useEffect } from "react";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { BottomSheet } from "../ui/BottomSheet";
import { formatLiveAmountInput } from "../../lib/utils";
import {
  calculateWhatIfScenario,
  type WhatIfScenarioType,
} from "../../lib/financialMath";
import {
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export interface WhatIfSimulatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  monthlyIncome: number;
  monthlyExpense: number;
  netWorth?: number;
  hideBalance?: boolean;
}

export function WhatIfSimulatorSheet({
  isOpen,
  onClose,
  monthlyIncome,
  monthlyExpense,
  netWorth = 0,
  hideBalance = false,
}: WhatIfSimulatorSheetProps) {
  const { language } = useLanguage();
  const {
    preferredCurrency,
    currencyMeta,
    convertToIdr,
    formatWithPreferred,
  } = useCurrency();
  const isIndonesian = language === "id";

  const scenarios: Array<{
    type: WhatIfScenarioType;
    label: string;
    description: string;
    inputTitle: string;
    unit: string;
    presets: number[];
    presetLabels?: Record<number, string>;
  }> = useMemo(() => {
    const symbol = currencyMeta.symbol;
    const prefix = symbol === "Rp" ? "Rp " : symbol;

    if (preferredCurrency === "IDR") {
      return [
        {
          type: "expense_cut",
          label: isIndonesian ? "Pangkas Beban" : "Cut Expense",
          description: isIndonesian
            ? "Simulasi pemangkasan pengeluaran rutin bulanan untuk memperbesar sisa kas bebas."
            : "Simulate cutting monthly recurring expenses to expand retained cashflow.",
          inputTitle: isIndonesian
            ? "Nominal Pemangkasan Beban Bulanan"
            : "Monthly Expense Cut Amount",
          unit: "Rp",
          presets: [250000, 500000, 1000000, 2000000],
          presetLabels: isIndonesian
            ? {
                250000: "Rp 250k",
                500000: "Rp 500k",
                1000000: "Rp 1 Jt",
                2000000: "Rp 2 Jt",
              }
            : {
                250000: "Rp 250k",
                500000: "Rp 500k",
                1000000: "Rp 1M",
                2000000: "Rp 2M",
              },
        },
        {
          type: "income_boost",
          label: isIndonesian ? "Tambah Pemasukan" : "Boost Income",
          description: isIndonesian
            ? "Simulasi peningkatan penghasilan aktif atau side hustle bulanan."
            : "Simulate scaling active monthly earnings or secondary cashflow streams.",
          inputTitle: isIndonesian
            ? "Nominal Penambahan Pemasukan Bulanan"
            : "Monthly Income Boost Amount",
          unit: "Rp",
          presets: [500000, 1000000, 2500000, 5000000],
          presetLabels: isIndonesian
            ? {
                500000: "Rp 500k",
                1000000: "Rp 1 Jt",
                2500000: "Rp 2.5 Jt",
                5000000: "Rp 5 Jt",
              }
            : {
                500000: "Rp 500k",
                1000000: "Rp 1M",
                2500000: "Rp 2.5M",
                5000000: "Rp 5M",
              },
        },
        {
          type: "expense_change_pct",
          label: isIndonesian ? "Variasi Beban %" : "Expense % Shock",
          description: isIndonesian
            ? "Uji stres inflasi biaya hidup atau kenaikan/penurunan persentase pengeluaran."
            : "Stress-test lifestyle inflation, shocks, or percentage spending shifts.",
          inputTitle: isIndonesian
            ? "Persentase Perubahan Beban"
            : "Expense Change Percentage",
          unit: "%",
          presets: [-15, -10, 10, 20],
          presetLabels: {
            [-15]: "-15%",
            [-10]: "-10%",
            10: "+10%",
            20: "+20%",
          },
        },
        {
          type: "saving_plan",
          label: isIndonesian ? "Rencana Tabungan" : "Target Savings",
          description: isIndonesian
            ? "Alokasi tabungan berdisiplin bulanan sebelum membelanjakan sisa kas."
            : "Disciplined monthly savings allocation committed before variable spending.",
          inputTitle: isIndonesian
            ? "Target Tabungan / Investasi Bulanan"
            : "Target Monthly Savings / Investment",
          unit: "Rp",
          presets: [500000, 1500000, 3000000, 5000000],
          presetLabels: isIndonesian
            ? {
                500000: "Rp 500k",
                1500000: "Rp 1.5 Jt",
                3000000: "Rp 3 Jt",
                5000000: "Rp 5 Jt",
              }
            : {
                500000: "Rp 500k",
                1500000: "Rp 1.5M",
                3000000: "Rp 3M",
                5000000: "Rp 5M",
              },
        },
      ];
    }

    // Foreign currency unit tiers
    let cutUnits = [20, 50, 100, 200];
    let boostUnits = [30, 75, 150, 300];
    let saveUnits = [30, 100, 200, 350];
    const cutUnitLabels: Record<number, string> = {};
    const boostUnitLabels: Record<number, string> = {};
    const saveUnitLabels: Record<number, string> = {};

    if (preferredCurrency === "JPY") {
      cutUnits = [2500, 5000, 10000, 20000];
      boostUnits = [5000, 10000, 25000, 50000];
      saveUnits = [5000, 15000, 30000, 50000];
    } else if (preferredCurrency === "THB") {
      cutUnits = [500, 1000, 2000, 4000];
      boostUnits = [1000, 2000, 5000, 10000];
      saveUnits = [1000, 3000, 6000, 10000];
    }

    const cutPresets = cutUnits.map((u) => Math.round(convertToIdr(u, preferredCurrency)));
    const boostPresets = boostUnits.map((u) => Math.round(convertToIdr(u, preferredCurrency)));
    const savePresets = saveUnits.map((u) => Math.round(convertToIdr(u, preferredCurrency)));

    cutPresets.forEach((p, i) => {
      cutUnitLabels[p] = `${prefix}${cutUnits[i] >= 1000 ? `${(cutUnits[i] / 1000).toFixed(0)}k` : cutUnits[i]}`;
    });
    boostPresets.forEach((p, i) => {
      boostUnitLabels[p] = `${prefix}${boostUnits[i] >= 1000 ? `${(boostUnits[i] / 1000).toFixed(0)}k` : boostUnits[i]}`;
    });
    savePresets.forEach((p, i) => {
      saveUnitLabels[p] = `${prefix}${saveUnits[i] >= 1000 ? `${(saveUnits[i] / 1000).toFixed(0)}k` : saveUnits[i]}`;
    });

    return [
      {
        type: "expense_cut",
        label: isIndonesian ? "Pangkas Beban" : "Cut Expense",
        description: isIndonesian
          ? "Simulasi pemangkasan pengeluaran rutin bulanan untuk memperbesar sisa kas bebas."
          : "Simulate cutting monthly recurring expenses to expand retained cashflow.",
        inputTitle: isIndonesian
          ? "Nominal Pemangkasan Beban Bulanan"
          : "Monthly Expense Cut Amount",
        unit: prefix.trim(),
        presets: cutPresets,
        presetLabels: cutUnitLabels,
      },
      {
        type: "income_boost",
        label: isIndonesian ? "Tambah Pemasukan" : "Boost Income",
        description: isIndonesian
          ? "Simulasi peningkatan penghasilan aktif atau side hustle bulanan."
          : "Simulate scaling active monthly earnings or secondary cashflow streams.",
        inputTitle: isIndonesian
          ? "Nominal Penambahan Pemasukan Bulanan"
          : "Monthly Income Boost Amount",
        unit: prefix.trim(),
        presets: boostPresets,
        presetLabels: boostUnitLabels,
      },
      {
        type: "expense_change_pct",
        label: isIndonesian ? "Variasi Beban %" : "Expense % Shock",
        description: isIndonesian
          ? "Uji stres inflasi biaya hidup atau kenaikan/penurunan persentase pengeluaran."
          : "Stress-test lifestyle inflation, shocks, or percentage spending shifts.",
        inputTitle: isIndonesian
          ? "Persentase Perubahan Beban"
          : "Expense Change Percentage",
        unit: "%",
        presets: [-15, -10, 10, 20],
        presetLabels: {
          [-15]: "-15%",
          [-10]: "-10%",
          10: "+10%",
          20: "+20%",
        },
      },
      {
        type: "saving_plan",
        label: isIndonesian ? "Rencana Tabungan" : "Target Savings",
        description: isIndonesian
          ? "Alokasi tabungan berdisiplin bulanan sebelum membelanjakan sisa kas."
          : "Disciplined monthly savings allocation committed before variable spending.",
        inputTitle: isIndonesian
          ? "Target Tabungan / Investasi Bulanan"
          : "Target Monthly Savings / Investment",
        unit: prefix.trim(),
        presets: savePresets,
        presetLabels: saveUnitLabels,
      },
    ];
  }, [preferredCurrency, currencyMeta.symbol, convertToIdr, isIndonesian]);

  const [scenarioType, setScenarioType] =
    useState<WhatIfScenarioType>("expense_cut");
  const [numericValue, setNumericValue] = useState<number>(() => scenarios[0]?.presets[1] ?? 500000);
  const [customInput, setCustomInput] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);

  useEffect(() => {
    if (!isCustom) {
      const cur = scenarios.find((s) => s.type === scenarioType);
      if (cur && !cur.presets.includes(numericValue)) {
        setNumericValue(cur.presets[1]);
      }
    }
  }, [scenarios, scenarioType, isCustom, numericValue]);

  const activeScenario =
    scenarios.find((s) => s.type === scenarioType) ?? scenarios[0];

  const effectiveValue = useMemo(() => {
    if (!isCustom) return numericValue;
    const thousandSep = isIndonesian ? "." : ",";
    const decimalSep = isIndonesian ? "," : ".";
    const clean = customInput
      .split(thousandSep)
      .join("")
      .replace(decimalSep, ".");
    const rawNum = parseFloat(clean) || 0;
    if (scenarioType === "expense_change_pct") return rawNum;
    return convertToIdr(rawNum, preferredCurrency);
  }, [isCustom, customInput, isIndonesian, scenarioType, convertToIdr, preferredCurrency, numericValue]);

  const result = useMemo(
    () =>
      calculateWhatIfScenario({
        monthlyIncome,
        monthlyExpense,
        type: scenarioType,
        value: effectiveValue,
      }),
    [monthlyIncome, monthlyExpense, effectiveValue, scenarioType],
  );

  // Runway Resilience impact calculation
  const runwayData = useMemo(() => {
    if (!netWorth || netWorth <= 0) return null;
    const baseRunway =
      monthlyExpense > 0 ? Number((netWorth / monthlyExpense).toFixed(1)) : 99;
    const adjustedMonthlyBurn = Math.max(
      1,
      result.adjustedMonthlyExpense + result.suggestedMonthlySavings,
    );
    const adjustedRunway = Number(
      (netWorth / adjustedMonthlyBurn).toFixed(1),
    );
    const runwayDelta = Number((adjustedRunway - baseRunway).toFixed(1));

    return {
      baseRunway,
      adjustedRunway,
      runwayDelta,
    };
  }, [netWorth, monthlyExpense, result.adjustedMonthlyExpense, result.suggestedMonthlySavings]);

  // Sensitivity Matrix for the current scenario
  const sensitivityRows = useMemo(() => {
    const intensityLevels = [
      {
        tier: isIndonesian ? "Ringan" : "Light",
        val: activeScenario.presets[0],
      },
      {
        tier: isIndonesian ? "Moderat" : "Moderate",
        val: activeScenario.presets[1],
      },
      {
        tier: isIndonesian ? "Agresif" : "Aggressive",
        val: activeScenario.presets[2],
      },
      {
        tier: isIndonesian ? "Ekstrem" : "Maximum",
        val: activeScenario.presets[3],
      },
    ];

    return intensityLevels.map(({ tier, val }) => {
      const calc = calculateWhatIfScenario({
        monthlyIncome,
        monthlyExpense,
        type: scenarioType,
        value: val,
      });

      return {
        tier,
        val,
        adjustedExpense: calc.adjustedMonthlyExpense,
        adjustedRetainedMonthly: calc.adjustedMonthlyIncome - calc.adjustedMonthlyExpense - calc.suggestedMonthlySavings,
        annualDiff: calc.annualDifference,
        isOvercommitted: calc.isOvercommitted,
        isSelected: !isCustom && numericValue === val,
      };
    });
  }, [activeScenario.presets, monthlyIncome, monthlyExpense, scenarioType, isCustom, numericValue, isIndonesian]);

  const handleReset = () => {
    setScenarioType("expense_cut");
    setNumericValue(scenarios[0]?.presets[1] ?? 500000);
    setIsCustom(false);
    setCustomInput("");
    triggerHaptic("light");
  };

  const amountDisplay = (val: number, forceSign = false) => {
    if (hideBalance) return "••••••";
    if (forceSign) {
      return `${val >= 0 ? "+" : "-"}${formatWithPreferred(Math.abs(val))}`;
    }
    return formatWithPreferred(val);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-4 sm:p-6 space-y-4 pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),28px)] select-none">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <SlidersHorizontal size={17} strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3
                  className="font-semibold text-[15px] sm:text-[16px] tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian
                    ? "Analisis Skenario What-If Lanjutan"
                    : "Detailed What-If Scenario Stress Test"}
                </h3>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    background: "var(--glass-fill-strong)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {isIndonesian ? "Deterministik" : "Deterministic"}
                </span>
              </div>
              <p
                className="text-[11px] font-medium leading-tight mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Eksplorasi shock finansial, penyesuaian beban & sensitivitas arus kas"
                  : "Explore financial shocks, expense variation & cashflow sensitivity"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer shrink-0"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-tertiary)",
            }}
            title={isIndonesian ? "Reset Skenario" : "Reset Scenario"}
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* 4-Tab Scenario Segmented Control */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
          }}
        >
          {scenarios.map((s) => {
            const isActive = s.type === scenarioType;
            return (
              <button
                key={s.type}
                type="button"
                onClick={() => {
                  setScenarioType(s.type);
                  setNumericValue(s.presets[1]);
                  setIsCustom(false);
                  setCustomInput("");
                  triggerHaptic("light");
                }}
                className="py-1.5 px-2 rounded-xl text-[11px] font-semibold transition-all cursor-pointer text-center truncate"
                style={{
                  background: isActive ? "var(--text-primary)" : "transparent",
                  color: isActive
                    ? "var(--bg-base)"
                    : "var(--text-secondary)",
                  boxShadow: isActive ? "0 1px 4px var(--shadow-strength)" : "none",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Scenario Description Pill */}
        <div
          className="p-3 rounded-2xl text-[11.5px] leading-relaxed flex items-start gap-2.5"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-secondary)",
          }}
        >
          <Sparkles size={14} className="shrink-0 mt-0.5 text-[var(--text-primary)]" />
          <span>{activeScenario.description}</span>
        </div>

        {/* Value Controls: Presets & Custom Input */}
        <div
          className="p-3.5 rounded-2xl space-y-3"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span
              className="text-[11.5px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {activeScenario.inputTitle}:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeScenario.presets.map((preset) => {
                const isSelected = !isCustom && numericValue === preset;
                const label =
                  activeScenario.presetLabels?.[preset] ??
                  (scenarioType === "expense_change_pct"
                    ? `${preset > 0 ? "+" : ""}${preset}%`
                    : formatWithPreferred(preset));

                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setIsCustom(false);
                      setNumericValue(preset);
                      triggerHaptic("light");
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-semibold cursor-pointer transition-all tabular-nums"
                    style={{
                      background: isSelected
                        ? "var(--text-primary)"
                        : "var(--glass-fill)",
                      color: isSelected
                        ? "var(--bg-base)"
                        : "var(--text-secondary)",
                      border: isSelected
                        ? "1px solid transparent"
                        : "1px solid var(--glass-border)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setIsCustom(true);
                  if (!customInput) {
                    const fallbackAmt =
                      scenarioType === "expense_change_pct"
                        ? "10"
                        : preferredCurrency === "IDR"
                          ? "500000"
                          : preferredCurrency === "JPY"
                            ? "5000"
                            : preferredCurrency === "THB"
                              ? "1000"
                              : "50";
                    const initialVal =
                      scenarioType === "expense_change_pct"
                        ? fallbackAmt
                        : formatLiveAmountInput(
                            fallbackAmt,
                            isIndonesian,
                            currencyMeta.decimals > 0,
                            currencyMeta.decimals,
                          ).display;
                    setCustomInput(initialVal);
                  }
                  triggerHaptic("light");
                }}
                className="px-2.5 py-1 rounded-lg text-[10.5px] font-semibold cursor-pointer transition-all"
                style={{
                  background: isCustom
                    ? "var(--text-primary)"
                    : "var(--glass-fill)",
                  color: isCustom
                    ? "var(--bg-base)"
                    : "var(--text-secondary)",
                  border: isCustom
                    ? "1px solid transparent"
                    : "1px solid var(--glass-border)",
                }}
              >
                {isIndonesian ? "Kustom" : "Custom"}
              </button>
            </div>
          </div>

          {/* Custom Input Field (Shows when Custom is active) */}
          {isCustom && (
            <div className="flex items-center gap-2 pt-1">
              <span
                className="text-[12px] font-bold shrink-0"
                style={{ color: "var(--text-tertiary)" }}
              >
                {scenarioType === "expense_change_pct" ? "%" : currencyMeta.symbol}
              </span>
              <input
                type="text"
                inputMode={
                  scenarioType === "expense_change_pct" || currencyMeta.decimals > 0
                    ? "decimal"
                    : "numeric"
                }
                value={customInput}
                onChange={(e) => {
                  if (scenarioType === "expense_change_pct") {
                    setCustomInput(e.target.value.replace(/[^0-9.]/g, ""));
                  } else {
                    const { display } = formatLiveAmountInput(
                      e.target.value,
                      isIndonesian,
                      currencyMeta.decimals > 0,
                      currencyMeta.decimals,
                    );
                    setCustomInput(display);
                  }
                }}
                placeholder={
                  scenarioType === "expense_change_pct"
                    ? "15"
                    : preferredCurrency === "IDR"
                      ? "750.000"
                      : preferredCurrency === "JPY"
                        ? "5.000"
                        : preferredCurrency === "THB"
                          ? "1.000"
                          : "50"
                }
                className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold outline-none tabular-nums"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              />
              <span
                className="text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {scenarioType === "expense_change_pct"
                  ? isIndonesian ? "persen" : "percent"
                  : isIndonesian ? "per bulan" : "per month"}
              </span>
            </div>
          )}
        </div>

        {/* Hero Impact Banner */}
        <div
          className="p-4 rounded-2xl space-y-3"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span
                className="text-[10px] uppercase font-semibold tracking-wider block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Dampak Akumulasi Kas Tahunan"
                  : "Annual Capital Trajectory Impact"}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span
                  className="text-[20px] font-bold tabular-nums"
                  style={{
                    color:
                      result.annualDifference >= 0
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                  }}
                >
                  {amountDisplay(result.annualDifference, true)}
                </span>
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "/ tahun" : "/ year"}
                </span>
              </div>
            </div>

            <div className="sm:text-right">
              <span
                className="text-[10px] uppercase font-semibold tracking-wider block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Delta Sisa Kas Bulanan" : "Monthly Delta"}
              </span>
              <span
                className="text-[14px] font-bold tabular-nums block mt-0.5"
                style={{
                  color:
                    result.monthlyDifference >= 0
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                {amountDisplay(result.monthlyDifference, true)}{" "}
                <span className="text-[10px] font-normal opacity-70">
                  {isIndonesian ? "/ bln" : "/ mo"}
                </span>
              </span>
            </div>
          </div>

          {/* Verdict Banner */}
          <div
            className="flex items-center gap-2 p-2.5 rounded-xl text-[11px] leading-relaxed"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
              color: result.isOvercommitted
                ? "var(--text-secondary)"
                : "var(--text-primary)",
            }}
          >
            {result.isOvercommitted ? (
              <AlertCircle size={15} className="shrink-0 text-[var(--text-secondary)]" />
            ) : (
              <CheckCircle2 size={15} className="shrink-0 text-[var(--text-primary)]" />
            )}
            <span>
              {result.isOvercommitted
                ? isIndonesian
                  ? "Peringatan: Skenario ini menyebabkan defisit arus kas bulanan. Pertimbangkan memperkecil komitmen atau memangkas pos beban lain."
                  : "Warning: This scenario results in negative monthly cashflow. Consider reducing target or trimming other expense buckets."
                : isIndonesian
                ? "Optimal: Skenario ini sepenuhnya layak dan aman dalam batas kapasitas arus kas bulanan Anda."
                : "Optimal: This scenario is fully sustainable and stays safely within your monthly cashflow headroom."}
            </span>
          </div>
        </div>

        {/* 4 Bento Flow Comparison Cards */}
        <div className="grid grid-cols-2 gap-2">
          {/* Tile 1: Monthly Income */}
          <div
            className="p-3 rounded-2xl space-y-1.5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[9.5px] uppercase font-semibold tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Pemasukan Bulanan" : "Monthly Income"}
              </span>
              <TrendingUp size={12} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div className="flex items-baseline gap-1.5 tabular-nums">
              <span
                className="text-[13px] font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {amountDisplay(result.adjustedMonthlyIncome)}
              </span>
            </div>
            <div
              className="text-[10px] flex items-center gap-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span>{isIndonesian ? "Dasar:" : "Base:"}</span>
              <span className="tabular-nums">
                {amountDisplay(monthlyIncome)}
              </span>
            </div>
          </div>

          {/* Tile 2: Monthly Expense */}
          <div
            className="p-3 rounded-2xl space-y-1.5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[9.5px] uppercase font-semibold tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Pengeluaran Bulanan" : "Monthly Expense"}
              </span>
              <TrendingDown size={12} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div className="flex items-baseline gap-1.5 tabular-nums">
              <span
                className="text-[13px] font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {amountDisplay(result.adjustedMonthlyExpense)}
              </span>
            </div>
            <div
              className="text-[10px] flex items-center gap-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span>{isIndonesian ? "Dasar:" : "Base:"}</span>
              <span className="tabular-nums">
                {amountDisplay(monthlyExpense)}
              </span>
            </div>
          </div>

          {/* Tile 3: Dedicated Savings */}
          <div
            className="p-3 rounded-2xl space-y-1.5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[9.5px] uppercase font-semibold tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Alokasi Tabungan" : "Savings Allocation"}
              </span>
              <ShieldCheck size={12} style={{ color: "var(--text-primary)" }} />
            </div>
            <div className="flex items-baseline gap-1.5 tabular-nums">
              <span
                className="text-[13px] font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {amountDisplay(result.suggestedMonthlySavings)}
              </span>
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {result.suggestedMonthlySavings > 0
                ? isIndonesian
                  ? "Ditargetkan per bulan"
                  : "Targeted per month"
                : isIndonesian
                  ? "Belum dialokasikan"
                  : "Not allocated"}
            </div>
          </div>

          {/* Tile 4: Free Cashflow */}
          <div
            className="p-3 rounded-2xl space-y-1.5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[9.5px] uppercase font-semibold tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Sisa Kas Bebas" : "Net Free Cashflow"}
              </span>
              <ArrowRight size={12} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div className="flex items-baseline gap-1.5 tabular-nums">
              <span
                className="text-[13px] font-bold"
                style={{
                  color:
                    result.remainingFreeCashAfterSavings >= 0
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                {amountDisplay(result.remainingFreeCashAfterSavings)}
              </span>
            </div>
            <div
              className="text-[10px] flex items-center gap-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span>{isIndonesian ? "Dasar:" : "Base:"}</span>
              <span className="tabular-nums">
                {amountDisplay(monthlyIncome - monthlyExpense)}
              </span>
            </div>
          </div>
        </div>

        {/* Runway Resilience Telemetry (if netWorth available) */}
        {runwayData && (
          <div
            className="p-3.5 rounded-2xl space-y-2.5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Dampak Horizon Runway Likuiditas"
                  : "Liquidity Runway Resilience Impact"}
              </span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background:
                    runwayData.runwayDelta >= 0
                      ? "var(--glass-fill-strong)"
                      : "var(--glass-fill)",
                  color:
                    runwayData.runwayDelta >= 0
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {runwayData.runwayDelta >= 0
                  ? `+${runwayData.runwayDelta} ${isIndonesian ? "Bulan" : "Months"}`
                  : `${runwayData.runwayDelta} ${isIndonesian ? "Bulan" : "Months"}`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div
                className="p-2 rounded-xl"
                style={{ background: "var(--glass-fill)" }}
              >
                <span
                  className="text-[9px] uppercase font-semibold block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Runway Saat Ini" : "Current Runway"}
                </span>
                <span
                  className="text-[13px] font-bold block mt-0.5 tabular-nums"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {runwayData.baseRunway} {isIndonesian ? "Bulan" : "Months"}
                </span>
              </div>
              <div
                className="p-2 rounded-xl"
                style={{ background: "var(--glass-fill-strong)" }}
              >
                <span
                  className="text-[9px] uppercase font-semibold block"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Runway Disesuaikan" : "Adjusted Runway"}
                </span>
                <span
                  className="text-[13px] font-bold block mt-0.5 tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {runwayData.adjustedRunway} {isIndonesian ? "Bulan" : "Months"}
                </span>
              </div>
            </div>

            <p
              className="text-[10.5px] leading-tight"
              style={{ color: "var(--text-tertiary)" }}
            >
              {runwayData.runwayDelta >= 0
                ? isIndonesian
                  ? `Dengan skenario ini, cadangan likuiditas bertahan ${Math.abs(runwayData.runwayDelta)} bulan lebih lama menghadapi risiko finansial.`
                  : `With this scenario, your cash buffer survives ${Math.abs(runwayData.runwayDelta)} months longer under financial disruption.`
                : isIndonesian
                  ? `Skenario ini memperpendek horizon likuiditas sebesar ${Math.abs(runwayData.runwayDelta)} bulan dari pengeluaran yang meningkat.`
                  : `This scenario compresses your liquidity horizon by ${Math.abs(runwayData.runwayDelta)} months due to elevated burn rate.`}
            </p>
          </div>
        )}

        {/* Sensitivity Stress-Test Matrix Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid var(--glass-border)",
            background: "var(--bg-elevated)",
          }}
        >
          <div
            className="p-3 border-b"
            style={{
              borderColor: "var(--glass-border)",
              background: "var(--glass-fill)",
            }}
          >
            <h4
              className="text-[11.5px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian
                ? "Matriks Sensitivitas Multi-Tingkat"
                : "Multi-Tier Sensitivity Matrix"}
            </h4>
            <p
              className="text-[10px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Perbandingan efek antar level intensitas skenario"
                : "Comparative effect across scenario intensity tiers"}
            </p>
          </div>

          <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
            {sensitivityRows.map((row) => (
              <div
                key={row.tier}
                onClick={() => {
                  setIsCustom(false);
                  setNumericValue(row.val);
                  triggerHaptic("light");
                }}
                className="p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-white/[0.03] transition-colors"
                style={{
                  background: row.isSelected ? "var(--glass-fill-strong)" : "transparent",
                }}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {row.tier}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.2 rounded font-semibold tabular-nums"
                      style={{
                        background: "var(--glass-fill)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      {scenarioType === "expense_change_pct"
                        ? `${row.val > 0 ? "+" : ""}${row.val}%`
                        : formatWithPreferred(row.val)}
                    </span>
                    {row.isSelected && (
                      <span
                        className="text-[9px] font-bold px-1.5 rounded-full"
                        style={{
                          background: "var(--text-primary)",
                          color: "var(--bg-base)",
                        }}
                      >
                        {isIndonesian ? "Aktif" : "Active"}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[10px] block mt-0.5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Pengeluaran baru: " : "New burn: "}
                    <strong className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {amountDisplay(row.adjustedExpense)}
                    </strong>
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className="text-[11.5px] font-bold block tabular-nums"
                    style={{
                      color:
                        row.annualDiff >= 0
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {amountDisplay(row.annualDiff, true)}
                    <span className="text-[9px] font-normal opacity-70">
                      {isIndonesian ? " /thn" : " /yr"}
                    </span>
                  </span>
                  <span
                    className="text-[9.5px] block mt-0.5"
                    style={{
                      color: row.isOvercommitted
                        ? "var(--text-secondary)"
                        : "var(--text-tertiary)",
                    }}
                  >
                    {row.isOvercommitted
                      ? isIndonesian ? "Defisit Kas" : "Deficit"
                      : isIndonesian ? "Aman Terkendali" : "Sustainable"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onClose();
          }}
          className="w-full py-2.5 rounded-xl font-semibold text-xs active:scale-[0.99] transition-transform cursor-pointer select-none"
          style={{
            background: "var(--text-primary)",
            color: "var(--bg-base)",
          }}
        >
          {isIndonesian ? "Selesai & Tutup" : "Done & Close"}
        </button>
      </div>
    </BottomSheet>
  );
}
