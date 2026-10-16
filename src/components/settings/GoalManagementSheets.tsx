import { useState } from "react";
import { Plus, Trash2, Target } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { GlassConfirmationModal } from "../ui/GlassConfirmationModal";
import { IconRenderer } from "../ui/IconRenderer";
import { GoalDetailModal } from "../goals/GoalDetailModal";
import { useGoals } from "../../hooks/useGoals";
import { formatLiveAmountInput } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";

const GOAL_ICONS = [
  "Target",
  "Home",
  "Car",
  "Laptop",
  "Plane",
  "Shield",
  "GraduationCap",
  "Heart",
  "Sparkles",
  "Gem",
  "Landmark",
  "TrendingUp",
] as const;

interface GoalManagementSheetsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GoalManagementSheets({
  isOpen,
  onClose,
}: GoalManagementSheetsProps) {
  const { goals, addGoal, updateGoal, deleteGoal, depositToGoal } = useGoals();
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { preferredCurrency, currencyMeta, convertToIdr, formatWithPreferred } =
    useCurrency();

  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [selectedGoalSetting, setSelectedGoalSetting] = useState<any | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; title: string } | null>(null);

  const [goalTitle, setGoalTitle] = useState("");
  const [rawTarget, setRawTarget] = useState<number>(0);
  const [displayTarget, setDisplayTarget] = useState<string>("");
  const [rawSaved, setRawSaved] = useState<number>(0);
  const [displaySaved, setDisplaySaved] = useState<string>("");
  const [goalIcon, setGoalIcon] = useState<string>("Target");

  const resetForm = () => {
    setGoalTitle("");
    setRawTarget(0);
    setDisplayTarget("");
    setRawSaved(0);
    setDisplaySaved("");
    setGoalIcon("Target");
  };

  const handleSaveGoal = () => {
    if (!goalTitle.trim() || rawTarget <= 0) return;
    const targetInIdr =
      preferredCurrency === "IDR"
        ? Math.round(rawTarget)
        : Math.round(convertToIdr(rawTarget, preferredCurrency));
    const savedInIdr =
      preferredCurrency === "IDR"
        ? Math.round(rawSaved)
        : Math.round(convertToIdr(rawSaved, preferredCurrency));

    addGoal({
      title: goalTitle.trim(),
      targetAmount: targetInIdr,
      currentAmount: savedInIdr,
      icon: goalIcon || "Target",
      color: "#ffffff",
    });
    setAddGoalOpen(false);
    resetForm();
    showToast(
      isIndonesian ? "Target finansial dibuat" : "Financial Goal created",
      "add",
      () => {},
    );
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose}>
        <div
          className="p-5 space-y-4"
          style={{
            paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 16px), 32px)",
          }}
        >
          <div className="flex items-center justify-between sticky top-0 bg-transparent z-10 pb-2">
            <h3
              className="font-semibold text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian ? "Target Finansial" : "Financial Goals"}
            </h3>
            <button
              onClick={() => {
                onClose();
                setTimeout(() => setAddGoalOpen(true), 300);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md active:scale-95 cursor-pointer"
              style={{
                background: "var(--accent)",
                color: "var(--accent-ink)",
              }}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {goals.map((g: any) => (
              <div
                key={g.id}
                onClick={() => {
                  setSelectedGoalSetting(g);
                  triggerHaptic("light");
                }}
                className="p-3 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {g.icon && g.icon !== "dYZ_" ? (
                      <IconRenderer icon={g.icon} size="w-4 h-4" />
                    ) : (
                      <Target size={15} style={{ color: "var(--text-primary)" }} />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[13px]">{g.title}</p>
                    <p
                      className="text-[10px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {formatWithPreferred(g.currentAmount)} /{" "}
                      {formatWithPreferred(g.targetAmount)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic("medium");
                    setGoalToDelete({ id: g.id, title: g.title });
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {goals.length === 0 && (
              <p
                className="text-sm text-center py-4"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Belum ada target finansial."
                  : "No financial goals yet."}
              </p>
            )}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={addGoalOpen}
        onClose={() => {
          setAddGoalOpen(false);
          resetForm();
        }}
      >
        <div
          className="p-5 space-y-4"
          style={{
            paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 16px), 32px)",
          }}
        >
          <h3
            className="font-semibold text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Tambah Target" : "Add Goal"}
          </h3>

          {/* Goal Title & Selected Icon Preview */}
          <div className="flex gap-2">
            <div
              className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 border border-[var(--glass-border)] bg-[var(--bg-elevated)]"
              style={{ color: "var(--text-primary)" }}
            >
              <IconRenderer icon={goalIcon} size="w-6 h-6" />
            </div>
            <input
              type="text"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder={
                isIndonesian
                  ? "Nama Target (misal: MacBook)"
                  : "Goal Name (e.g. MacBook)"
              }
              className="flex-1 px-4 py-3 rounded-2xl outline-none font-semibold text-[14px] border border-[var(--glass-border)] bg-[var(--bg-elevated)]"
              style={{
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Curated Vector Icon Picker (Rule 1 GEMINI.md) */}
          <div className="space-y-1.5">
            <label
              className="text-[10px] font-semibold uppercase tracking-wider block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Pilih Ikon Target" : "Select Goal Icon"}
            </label>
            <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
              {GOAL_ICONS.map((iconName) => {
                const isSelected = goalIcon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setGoalIcon(iconName);
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer border ${
                      isSelected
                        ? "bg-[var(--text-primary)] text-[var(--bg-base)] border-[var(--text-primary)] shadow-sm"
                        : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <IconRenderer icon={iconName} size="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Amount Input */}
          <div className="space-y-1.5">
            <label
              className="text-[10px] font-semibold uppercase tracking-wider block px-1"
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
                value={displayTarget}
                onChange={(e) => {
                  const { raw, formatted } = formatLiveAmountInput(
                    e.target.value,
                    preferredCurrency === "IDR" && isIndonesian,
                    currencyMeta.decimals > 0,
                    currencyMeta.decimals
                  );
                  setRawTarget(raw);
                  setDisplayTarget(formatted);
                }}
                placeholder="0"
                className="w-full bg-transparent outline-none font-semibold text-[14px] amount"
                style={{
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {/* Initial Saved Balance Input */}
          <div className="space-y-1.5">
            <label
              className="text-[10px] font-semibold uppercase tracking-wider block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Dana Terkumpul Saat Ini" : "Already Saved Amount"}
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
                value={displaySaved}
                onChange={(e) => {
                  const { raw, formatted } = formatLiveAmountInput(
                    e.target.value,
                    preferredCurrency === "IDR" && isIndonesian,
                    currencyMeta.decimals > 0,
                    currencyMeta.decimals
                  );
                  setRawSaved(raw);
                  setDisplaySaved(formatted);
                }}
                placeholder="0"
                className="w-full bg-transparent outline-none font-semibold text-[14px] amount"
                style={{
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <button
            onClick={handleSaveGoal}
            disabled={!goalTitle.trim() || rawTarget <= 0}
            className="w-full py-3.5 rounded-[20px] font-semibold text-[14px] active:scale-98 transition-transform cursor-pointer disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {isIndonesian ? "Simpan Target" : "Save Goal"}
          </button>
        </div>
      </BottomSheet>

      <GoalDetailModal
        goal={selectedGoalSetting}
        isOpen={!!selectedGoalSetting}
        onClose={() => setSelectedGoalSetting(null)}
        onDeposit={depositToGoal}
        onUpdate={updateGoal}
        onDelete={deleteGoal}
      />

      <GlassConfirmationModal
        isOpen={goalToDelete !== null}
        onClose={() => setGoalToDelete(null)}
        onConfirm={() => {
          if (goalToDelete) {
            deleteGoal(goalToDelete.id);
            showToast(
              isIndonesian ? "Target finansial dihapus" : "Financial goal deleted",
              "delete",
              () => {},
            );
            setGoalToDelete(null);
          }
        }}
        title={
          isIndonesian
            ? `Hapus Target "${goalToDelete?.title}"?`
            : `Delete Goal "${goalToDelete?.title}"?`
        }
        description={
          isIndonesian
            ? "Target finansial ini akan dihapus dari daftar target Anda."
            : "This financial goal will be removed from your goals list."
        }
        confirmLabel={isIndonesian ? "Hapus Target" : "Delete Goal"}
        isIndonesian={isIndonesian}
      />
    </>
  );
}

