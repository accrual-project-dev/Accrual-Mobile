import { useState, useEffect, useMemo } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { GlassConfirmationModal } from "../ui/GlassConfirmationModal";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import type { Goal } from "../../hooks/useGoals";
import { formatLiveAmountInput } from "../../lib/utils";
import { Plus, Trash2, CheckCircle2, TrendingUp, Compass, Flag, Target, Wallet as WalletIcon } from "lucide-react";
import { IconRenderer } from "../ui/IconRenderer";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useAllTransactions, useAddTransaction } from "../../hooks/useTransactions";
import { useWallets, useAddWallet } from "../../hooks/useWallets";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { format } from "date-fns";
import {
  calculatePersonalBaselines,
  calculateGoalPlanning,
  calculateGoalScenario,
  calculateDynamicGoalMilestones,
} from "../../lib/financialMath";

interface GoalDetailModalProps {
  goal: Goal | null;
  isOpen: boolean;
  onClose: () => void;
  onDeposit: (id: string, amount: number) => void;
  onUpdate: (id: string, updates: Partial<Goal>) => void;
  onDelete: (id: string) => void;
}

export function GoalDetailModal({
  goal,
  isOpen,
  onClose,
  onDeposit,
  onUpdate,
  onDelete,
}: GoalDetailModalProps) {
  const { isIndonesian } = useLanguage();
  const {
    preferredCurrency,
    currencyMeta,
    convertToIdr,
    convertFromIdr,
    formatWithPreferred,
  } = useCurrency();

  const [rawDeposit, setRawDeposit] = useState<number>(0);
  const [displayDeposit, setDisplayDeposit] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [rawEditTarget, setRawEditTarget] = useState<number>(0);
  const [displayEditTarget, setDisplayEditTarget] = useState("");
  const [rawEditCurrent, setRawEditCurrent] = useState<number>(0);
  const [displayEditCurrent, setDisplayEditCurrent] = useState("");
  const [rawScenario, setRawScenario] = useState<number>(1500000);
  const [displayScenario, setDisplayScenario] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (goal) {
      setEditTitle(goal.title);
      const prefTarget = Math.round(convertFromIdr(goal.targetAmount) * 100) / 100;
      const prefCurrent = Math.round(convertFromIdr(goal.currentAmount) * 100) / 100;
      setRawEditTarget(prefTarget);
      setDisplayEditTarget(
        prefTarget > 0
          ? prefTarget.toLocaleString(isIndonesian && preferredCurrency === "IDR" ? "id-ID" : "en-US")
          : ""
      );
      setRawEditCurrent(prefCurrent);
      setDisplayEditCurrent(
        prefCurrent > 0
          ? prefCurrent.toLocaleString(isIndonesian && preferredCurrency === "IDR" ? "id-ID" : "en-US")
          : ""
      );
      setRawDeposit(0);
      setDisplayDeposit("");

      const scAmt = preferredCurrency === "IDR" ? 1500000 : preferredCurrency === "JPY" ? 15000 : 100;
      setRawScenario(scAmt);
      setDisplayScenario(
        scAmt.toLocaleString(isIndonesian && preferredCurrency === "IDR" ? "id-ID" : "en-US")
      );

      setIsEditing(false);
      setIsSubmitting(false);
    }
  }, [goal, isOpen, preferredCurrency, convertFromIdr, isIndonesian]);

  const { data: allTxs = [] } = useAllTransactions();

  const [velocitySpeed, setVelocitySpeed] = useState<
    "conservative" | "current" | "accelerated"
  >("current");

  const { data: wallets = [] } = useWallets();
  const addWallet = useAddWallet();
  const addTransaction = useAddTransaction();
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [recordInLedger, setRecordInLedger] = useState(true);

  const sourceWallets = useMemo(
    () => wallets.filter((w) => w.name.trim().toLowerCase() !== "manifesting"),
    [wallets],
  );

  const activeWalletId = useMemo(() => {
    if (selectedWalletId && sourceWallets.some((w) => w.id === selectedWalletId)) {
      return selectedWalletId;
    }
    return sourceWallets[0]?.id || "";
  }, [selectedWalletId, sourceWallets]);

  const progress = useMemo(() => {
    if (!goal || goal.targetAmount <= 0) return 0;
    return Math.min(
      100,
      Math.round((goal.currentAmount / goal.targetAmount) * 100)
    );
  }, [goal]);

  const baselines = useMemo(() => {
    return calculatePersonalBaselines(allTxs, undefined, undefined, isIndonesian ? "id" : "en");
  }, [allTxs, isIndonesian]);

  const planning = useMemo(() => {
    if (!goal) return null;
    return calculateGoalPlanning(
      goal,
      baselines,
      undefined,
      isIndonesian ? "id" : "en",
      formatWithPreferred,
    );
  }, [goal, baselines, isIndonesian, formatWithPreferred]);

  const dynamicMilestones = useMemo(() => {
    if (!goal) return null;
    return calculateDynamicGoalMilestones(goal, baselines, undefined, isIndonesian ? "id" : "en");
  }, [goal, baselines, isIndonesian]);

  const scenarioPresets = useMemo(() => {
    if (!goal) return [];
    const baseContribution = planning?.requiredMonthlyContribution || 1000000;
    const amounts = [
      Math.round(baseContribution * 0.75),
      Math.round(baseContribution),
      Math.round(baseContribution * 1.5),
    ].filter((v, i, arr) => arr.indexOf(v) === i && v > 0);

    return amounts.map((amt) => ({
      amount: amt,
      result: calculateGoalScenario(goal, amt, undefined, isIndonesian ? "id" : "en"),
    }));
  }, [goal, planning, isIndonesian]);

  const customScenario = useMemo(() => {
    if (!goal) return null;
    const amtIdr = convertToIdr(rawScenario);
    return calculateGoalScenario(goal, amtIdr, undefined, isIndonesian ? "id" : "en");
  }, [goal, rawScenario, convertToIdr, isIndonesian]);

  const quickPresets = useMemo(() => {
    if (preferredCurrency === "IDR") {
      return [
        { val: 100000, label: "+100k" },
        { val: 250000, label: "+250k" },
        { val: 500000, label: "+500k" },
        { val: 1000000, label: isIndonesian ? "+1Jt" : "+1M" },
      ];
    }
    if (preferredCurrency === "JPY") {
      return [
        { val: 1000, label: "+¥1k" },
        { val: 2500, label: "+¥2.5k" },
        { val: 5000, label: "+¥5k" },
        { val: 10000, label: "+¥10k" },
      ];
    }
    const sym = currencyMeta.symbol;
    return [
      { val: 10, label: `+${sym}10` },
      { val: 25, label: `+${sym}25` },
      { val: 50, label: `+${sym}50` },
      { val: 100, label: `+${sym}100` },
    ];
  }, [preferredCurrency, currencyMeta.symbol, isIndonesian]);

  if (!goal) return null;

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  const formatScenarioDuration = (months: number) => {
    if (months <= 0) return isIndonesian ? "Sekarang" : "Now";
    const years = Math.floor(months / 12);
    const extraMonths = months % 12;
    if (years === 0) return isIndonesian ? `${extraMonths} bln` : `${extraMonths} mo`;
    if (extraMonths === 0) return isIndonesian ? `${years} thn` : `${years} yr`;
    return isIndonesian ? `${years} thn ${extraMonths} bln` : `${years} yr ${extraMonths} mo`;
  };

  const handleQuickDeposit = async (addInPrefCurrency: number) => {
    if (!goal || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const depositIdr = convertToIdr(addInPrefCurrency);
      onDeposit(goal.id, depositIdr);
      if (recordInLedger && activeWalletId) {
        let targetWallet = wallets.find(
          (w) => w.name.trim().toLowerCase() === "manifesting",
        );
        if (!targetWallet) {
          targetWallet = await addWallet.mutateAsync({
            name: "Manifesting",
            icon: "Sparkles",
            classification: "liquid",
          });
        }
        await addTransaction.mutateAsync({
          amount: depositIdr,
          type: "transfer",
          category_id: null,
          wallet_id: activeWalletId,
          to_wallet_id: targetWallet.id,
          occurred_on: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
          note: isIndonesian
            ? `Alokasi Tabungan: ${goal.title} #goal_${goal.id}`
            : `Savings Allocation: ${goal.title} #goal_${goal.id}`,
        });
      }
      triggerHaptic("medium");
      showToast(
        isIndonesian
          ? `+${formatWithPreferred(depositIdr)} dialokasikan ke ${goal.title}`
          : `+${formatWithPreferred(depositIdr)} allocated to ${goal.title}`,
        "add",
        () => {},
      );
      onClose();
    } catch (err) {
      console.warn("Failed to deposit to goal:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomDeposit = async () => {
    if (!goal || rawDeposit <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const depositIdr = convertToIdr(rawDeposit);
      onDeposit(goal.id, depositIdr);
      if (recordInLedger && activeWalletId) {
        let targetWallet = wallets.find(
          (w) => w.name.trim().toLowerCase() === "manifesting",
        );
        if (!targetWallet) {
          targetWallet = await addWallet.mutateAsync({
            name: "Manifesting",
            icon: "Sparkles",
            classification: "liquid",
          });
        }
        await addTransaction.mutateAsync({
          amount: depositIdr,
          type: "transfer",
          category_id: null,
          wallet_id: activeWalletId,
          to_wallet_id: targetWallet.id,
          occurred_on: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
          note: isIndonesian
            ? `Alokasi Tabungan: ${goal.title} #goal_${goal.id}`
            : `Savings Allocation: ${goal.title} #goal_${goal.id}`,
        });
      }
      triggerHaptic("medium");
      showToast(
        isIndonesian
          ? `+${formatWithPreferred(depositIdr)} dialokasikan ke ${goal.title}`
          : `+${formatWithPreferred(depositIdr)} allocated to ${goal.title}`,
        "add",
        () => {},
      );
      onClose();
    } catch (err) {
      console.warn("Failed to deposit to goal:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim() || rawEditTarget <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    const targetIdr = convertToIdr(rawEditTarget);
    const currentIdr = convertToIdr(rawEditCurrent);

    onUpdate(goal.id, {
      title: editTitle.trim(),
      targetAmount: targetIdr,
      currentAmount: currentIdr,
    });
    triggerHaptic("medium");
    showToast(
      isIndonesian ? "Target finansial diperbarui" : "Financial goal updated",
      "update",
      () => {},
    );
    setIsEditing(false);
    setIsSubmitting(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="p-5 space-y-4"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 16px), 32px)",
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              {goal.icon ? (
                <IconRenderer icon={goal.icon} size="w-6 h-6" />
              ) : (
                <Target size={22} style={{ color: "var(--text-primary)" }} />
              )}
            </div>
            <div>
              <h3
                className="font-semibold text-[18px] leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {goal.title}
              </h3>
              <p
                className="text-[12px] font-semibold mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {progress >= 100
                  ? isIndonesian
                    ? "Target Tercapai!"
                    : "Goal Reached!"
                  : isIndonesian
                    ? `Sisa ${formatWithPreferred(remaining)}`
                    : `${formatWithPreferred(remaining)} remaining`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-full cursor-pointer"
            style={{
              background: isEditing ? "var(--accent)" : "var(--glass-fill)",
              color: isEditing ? "var(--accent-ink)" : "var(--text-secondary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {isEditing
              ? isIndonesian
                ? "Batal"
                : "Cancel"
              : isIndonesian
                ? "Ubah"
                : "Edit"}
          </button>
        </div>

        {/* Normal Mode: Progress & Top-Up */}
        {!isEditing ? (
          <>
            {/* Progress Card */}
            <div
              className="p-4 rounded-[22px] glass-surface space-y-2.5"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex justify-between items-baseline">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Terkumpul" : "Collected"}
                </span>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {progress}%
                </span>
              </div>

              <div className="flex justify-between items-baseline">
                <span
                  className="amount text-[22px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatWithPreferred(goal.currentAmount)}
                </span>
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "dari " : "of "}
                  {formatWithPreferred(goal.targetAmount)}
                </span>
              </div>

              {/* Progress Bar */}
              <div
                className="h-2.5 w-full rounded-full overflow-hidden"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Planning Trajectory Card (Phase II) */}
            {planning && (
              <div
                className="p-3.5 rounded-[22px] space-y-2.5"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <Compass
                      size={13}
                      style={{ color: "var(--text-tertiary)" }}
                    />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian ? "Lintasan Perencanaan" : "Planning Trajectory"}
                    </span>
                  </div>
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        planning.trajectoryStatus === "ON TRACK" ||
                        planning.trajectoryStatus === "AHEAD OF TARGET"
                          ? "var(--glass-fill-strong)"
                          : "var(--glass-fill)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {isIndonesian
                      ? planning.trajectoryStatus === "ON TRACK"
                        ? "SESUAI JALUR"
                        : planning.trajectoryStatus === "AHEAD OF TARGET"
                          ? "MELAMPAUI TARGET"
                          : "DI BAWAH TARGET"
                      : planning.trajectoryStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div
                    className="p-2 rounded-xl"
                    style={{ background: "var(--glass-fill)" }}
                  >
                    <p
                      className="text-[9px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian ? "Laju Dibutuhkan" : "Required Pace"}
                    </p>
                    <p
                      className="amount font-semibold text-[13px] mt-0.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatWithPreferred(planning.requiredMonthlyContribution)}{" "}
                      <span
                        className="text-[9px] font-normal"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {isIndonesian ? "/ bln" : "/ mo"}
                      </span>
                    </p>
                  </div>
                  <div
                    className="p-2 rounded-xl"
                    style={{ background: "var(--glass-fill)" }}
                  >
                    <p
                      className="text-[9px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian ? "Kas Tersisa" : "Retained Cash"}
                    </p>
                    <p
                      className="amount font-semibold text-[13px] mt-0.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatWithPreferred(planning.historicalRetainedCash)}{" "}
                      <span
                        className="text-[9px] font-normal"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {isIndonesian ? "/ bln" : "/ mo"}
                      </span>
                    </p>
                  </div>
                </div>

                <p
                  className="text-[11px] leading-relaxed pt-1 border-t border-[var(--glass-border)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {planning.trajectoryExplanation}
                </p>
              </div>
            )}

            {/* Dynamic Milestone Roadmap & Velocity (Innovation 10) */}
            {dynamicMilestones && (
              <div
                className="p-3.5 rounded-[22px] space-y-3 glass-surface"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <Flag size={13} style={{ color: "var(--text-tertiary)" }} />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian ? "Peta Pencapaian" : "Milestone Roadmap"}
                    </span>
                  </div>
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--glass-fill)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {isIndonesian ? "Kecepatan: " : "Velocity: "}
                    {formatWithPreferred(dynamicMilestones.currentVelocityMonthly)}
                    {isIndonesian ? "/bln" : "/mo"}
                  </span>
                </div>

                {/* 4-node roadmap track */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {dynamicMilestones.milestones.map((m) => (
                    <div
                      key={m.percentage}
                      className="p-2 rounded-xl text-center space-y-1 transition-all"
                      style={{
                        background: m.isReached
                          ? "var(--glass-fill-strong)"
                          : "var(--glass-fill)",
                        border: m.isReached
                          ? "1px solid var(--accent)"
                          : "1px solid var(--glass-border)",
                      }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {m.isReached ? (
                          <CheckCircle2
                            size={11}
                            style={{ color: "var(--accent)" }}
                          />
                        ) : (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: "var(--text-tertiary)" }}
                          />
                        )}
                        <span
                          className="text-[11px] font-semibold"
                          style={{
                            color: m.isReached
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                          }}
                        >
                          {m.percentage}%
                        </span>
                      </div>
                      <p
                        className="text-[9px] font-bold amount truncate"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {formatWithPreferred(m.targetAmount)}
                      </p>
                      <p
                        className="text-[9px] font-semibold truncate"
                        style={{
                          color: m.isReached
                            ? "var(--accent)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {m.projectedDate || (isIndonesian ? "Dalam proses" : "In progress")}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Velocity Pace Selector */}
                <div className="pt-2 border-t border-[var(--glass-border)] space-y-2">
                  <div className="flex justify-between items-center">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian ? "Kecepatan Tabungan" : "Savings Velocity Pace"}
                    </span>
                    <span
                      className="text-[11px] font-semibold amount"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {dynamicMilestones.velocityPaces[velocitySpeed]
                        .projectedCompletion
                        ? `Est. ${dynamicMilestones.velocityPaces[velocitySpeed].projectedCompletion}`
                        : isIndonesian
                          ? "Memerlukan arus kas positif"
                          : "Requires positive cashflow"}
                    </span>
                  </div>

                  <div
                    className="flex p-1 rounded-xl glass-surface"
                    style={{ background: "var(--glass-fill)" }}
                  >
                    {(
                      [
                        {
                          id: "conservative",
                          label: isIndonesian ? "Konservatif" : "Conservative",
                          pct: "60%",
                        },
                        {
                          id: "current",
                          label: isIndonesian ? "Laju Saat Ini" : "Current Pace",
                          pct: "100%",
                        },
                        {
                          id: "accelerated",
                          label: isIndonesian ? "Dipercepat" : "Accelerated",
                          pct: "140%",
                        },
                      ] as const
                    ).map((tier) => {
                      const isSelected = velocitySpeed === tier.id;
                      const pace = dynamicMilestones.velocityPaces[tier.id];
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => {
                            setVelocitySpeed(tier.id);
                            triggerHaptic("light");
                          }}
                          className="flex-1 py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer"
                          style={{
                            background: isSelected
                              ? "var(--bg-elevated)"
                              : "transparent",
                            color: isSelected
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                            boxShadow: isSelected
                              ? "var(--shadow-card)"
                              : "none",
                          }}
                        >
                          <p className="text-[10px] font-semibold truncate">
                            {tier.label}
                          </p>
                          <p className="text-[9px] font-semibold amount opacity-70 truncate">
                            {formatWithPreferred(pace.monthly)}{isIndonesian ? "/bln" : "/mo"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Goal Scenario Simulator */}
            <div
              className="p-3.5 rounded-[22px] space-y-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Compass size={13} style={{ color: "var(--text-tertiary)" }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Skenario Target" : "Goal Scenario"}
                </span>
              </div>

              <div className="space-y-2">
                {scenarioPresets.map(({ amount, result }) => (
                  <div
                    key={amount}
                    className="p-3 rounded-2xl flex items-center justify-between gap-3"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <div>
                      <p
                        className="text-[12px] font-bold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatWithPreferred(amount)} {isIndonesian ? "/ bulan" : "/ month"}
                      </p>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {result.isAlreadyCompleted
                          ? isIndonesian
                            ? "Target sudah tercapai"
                            : "Goal already completed"
                          : result.isFeasible
                            ? isIndonesian
                              ? `Target sekitar ${result.projectedCompletionLabel}`
                              : `Target around ${result.projectedCompletionLabel}`
                            : isIndonesian
                              ? "Tentukan kontribusi bulanan positif"
                              : "Set a positive monthly amount"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-[12px] font-semibold amount"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatScenarioDuration(result.monthsToTarget)}
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {isIndonesian ? "tersisa" : "to finish"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-1 space-y-1.5">
                <label
                  className="text-[10px] font-bold uppercase tracking-wider block px-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Kontribusi bulanan kustom" : "Custom monthly contribution"}
                </label>
                <div className="flex items-center px-3.5 py-2.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] focus-within:border-[var(--text-primary)] transition-colors">
                  <span
                    className="text-[14px] font-semibold mr-1.5 select-none"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {currencyMeta.symbol}
                  </span>
                  <input
                    type="text"
                    inputMode={currencyMeta.decimals > 0 ? "decimal" : "numeric"}
                    value={displayScenario}
                    onChange={(e) => {
                      const { raw, formatted } = formatLiveAmountInput(
                        e.target.value,
                        preferredCurrency === "IDR" && isIndonesian,
                        currencyMeta.decimals > 0,
                        currencyMeta.decimals,
                      );
                      setRawScenario(raw);
                      setDisplayScenario(formatted);
                    }}
                    placeholder="0"
                    className="w-full bg-transparent outline-none font-semibold text-[13px] amount"
                    style={{
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              {customScenario && (
                <div
                  className="p-3 rounded-2xl"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <p
                    className="text-[11px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {customScenario.isAlreadyCompleted
                      ? isIndonesian
                        ? "Target sudah tercapai"
                        : "Goal already completed"
                      : customScenario.isFeasible
                        ? isIndonesian
                          ? `Dengan ${formatWithPreferred(customScenario.monthlyContribution)}/bulan, target diproyeksikan selesai ${customScenario.projectedCompletionLabel}`
                          : `At ${formatWithPreferred(customScenario.monthlyContribution)}/month, target projects to ${customScenario.projectedCompletionLabel}`
                        : isIndonesian
                          ? "Masukkan kontribusi bulanan positif untuk simulasi target."
                          : "Enter a positive monthly contribution to simulate your goal."}
                  </p>
                  <p
                    className="text-[10px] mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {isIndonesian ? "Sisa " : "Remaining "}
                    {formatWithPreferred(customScenario.remainingAmount)} · ETA{" "}
                    {formatScenarioDuration(customScenario.monthsToTarget)}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Top-Up Section */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 px-1">
                <TrendingUp
                  size={13}
                  style={{ color: "var(--text-tertiary)" }}
                />
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Tambah Dana Celengan" : "Add Funds (Top Up)"}
                </span>
              </div>

              {/* Source Account & Ledger Sync Selector */}
              {sourceWallets.length > 0 && (
                <div
                  className="p-3 rounded-2xl space-y-2 glass-surface"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <WalletIcon size={12} style={{ color: "var(--text-tertiary)" }} />
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {isIndonesian
                          ? "Transfer Saldo ke Akun Manifesting"
                          : "Record Transfer to Manifesting Account"}
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ToggleSwitch
                        checked={recordInLedger}
                        onChange={(val) => setRecordInLedger(val)}
                        size="sm"
                        ariaLabel="Transfer to Manifesting"
                      />
                    </div>
                  </div>

                  {recordInLedger && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                      {sourceWallets.map((w) => {
                        const isSelected = activeWalletId === w.id;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWalletId(w.id)}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap active:scale-95 transition-all cursor-pointer"
                            style={{
                              background: isSelected
                                ? "var(--text-primary)"
                                : "var(--glass-fill)",
                              color: isSelected
                                ? "var(--bg-base)"
                                : "var(--text-secondary)",
                              border: isSelected
                                ? "1px solid var(--text-primary)"
                                : "1px solid var(--glass-border)",
                            }}
                          >
                            {w.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Preset Buttons (Adaptive to Preferred Currency) */}
              <div className="grid grid-cols-4 gap-2">
                {quickPresets.map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => handleQuickDeposit(preset.val)}
                    className="py-2.5 px-2 rounded-2xl text-[11px] font-semibold active:scale-95 transition-all text-center cursor-pointer"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex gap-2 pt-1">
                <div className="flex-1 flex items-center px-3.5 py-2.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] focus-within:border-[var(--text-primary)] transition-colors">
                  <span
                    className="text-[14px] font-semibold mr-1.5 select-none"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {currencyMeta.symbol}
                  </span>
                  <input
                    type="text"
                    inputMode={currencyMeta.decimals > 0 ? "decimal" : "numeric"}
                    value={displayDeposit}
                    onChange={(e) => {
                      const { raw, formatted } = formatLiveAmountInput(
                        e.target.value,
                        preferredCurrency === "IDR" && isIndonesian,
                        currencyMeta.decimals > 0,
                        currencyMeta.decimals,
                      );
                      setRawDeposit(raw);
                      setDisplayDeposit(formatted);
                    }}
                    placeholder="0"
                    className="w-full bg-transparent outline-none font-semibold text-[13px] amount"
                    style={{
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={rawDeposit <= 0 || isSubmitting}
                  onClick={handleCustomDeposit}
                  className="px-5 py-2.5 rounded-2xl font-semibold text-[13px] flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                  style={{
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
                  }}
                >
                  <Plus size={15} /> {isIndonesian ? "Simpan" : "Save"}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Edit Mode */
          <div className="space-y-3 pt-1">
            <div>
              <label
                className="text-[11px] font-bold uppercase tracking-wider block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Nama Target" : "Goal Name"}
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full p-3.5 rounded-2xl outline-none font-semibold text-[13px] border border-[var(--glass-border)] bg-[var(--bg-elevated)]"
                style={{
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[11px] font-bold uppercase tracking-wider block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Nominal Target" : "Target Amount"}
              </label>
              <div className="flex items-center px-3.5 py-2.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] focus-within:border-[var(--text-primary)] transition-colors">
                <span
                  className="text-[14px] font-semibold mr-1.5 select-none"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {currencyMeta.symbol}
                </span>
                <input
                  type="text"
                  inputMode={currencyMeta.decimals > 0 ? "decimal" : "numeric"}
                  value={displayEditTarget}
                  onChange={(e) => {
                    const { raw, formatted } = formatLiveAmountInput(
                      e.target.value,
                      preferredCurrency === "IDR" && isIndonesian,
                      currencyMeta.decimals > 0,
                      currencyMeta.decimals,
                    );
                    setRawEditTarget(raw);
                    setDisplayEditTarget(formatted);
                  }}
                  placeholder="0"
                  className="w-full bg-transparent outline-none font-semibold text-[13px] amount"
                  style={{
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[11px] font-bold uppercase tracking-wider block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Saldo Terkumpul Saat Ini" : "Current Saved Balance"}
              </label>
              <div className="flex items-center px-3.5 py-2.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] focus-within:border-[var(--text-primary)] transition-colors">
                <span
                  className="text-[14px] font-semibold mr-1.5 select-none"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {currencyMeta.symbol}
                </span>
                <input
                  type="text"
                  inputMode={currencyMeta.decimals > 0 ? "decimal" : "numeric"}
                  value={displayEditCurrent}
                  onChange={(e) => {
                    const { raw, formatted } = formatLiveAmountInput(
                      e.target.value,
                      preferredCurrency === "IDR" && isIndonesian,
                      currencyMeta.decimals > 0,
                      currencyMeta.decimals,
                    );
                    setRawEditCurrent(raw);
                    setDisplayEditCurrent(formatted);
                  }}
                  placeholder="0"
                  className="w-full bg-transparent outline-none font-semibold text-[13px] amount"
                  style={{
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  setIsDeleteConfirmOpen(true);
                }}
                className="p-3.5 rounded-2xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
                title={isIndonesian ? "Hapus Target" : "Delete Goal"}
              >
                <Trash2 size={16} />
              </button>

              <button
                type="button"
                disabled={!editTitle.trim() || rawEditTarget <= 0 || isSubmitting}
                onClick={handleSaveEdit}
                className="flex-1 py-3.5 rounded-2xl font-semibold text-[14px] flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-ink)",
                }}
              >
                <CheckCircle2 size={16} /> {isIndonesian ? "Simpan Perubahan" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>

      <GlassConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (!goal) return;
          onDelete(goal.id);
          triggerHaptic("medium");
          showToast(
            isIndonesian ? "Target finansial dihapus" : "Financial goal deleted",
            "delete",
            () => {},
          );
          onClose();
        }}
        title={isIndonesian ? `Hapus Target "${goal?.title}"?` : `Delete Goal "${goal?.title}"?`}
        description={
          isIndonesian
            ? "Target finansial ini akan dihapus. Anda dapat membuat target baru kapan saja."
            : "This financial goal will be removed. You can create a new goal at any time."
        }
        confirmLabel={isIndonesian ? "Hapus Target" : "Delete Goal"}
        isIndonesian={isIndonesian}
      />
    </BottomSheet>
  );
}
