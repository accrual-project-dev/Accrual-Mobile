import { useState } from "react";
import { Plus, Trash2, Target } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { GlassConfirmationModal } from "../ui/GlassConfirmationModal";
import { IconRenderer } from "../ui/IconRenderer";
import { GoalDetailModal } from "../goals/GoalDetailModal";
import { useGoals } from "../../hooks/useGoals";
import { formatRupiah } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";

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

  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [selectedGoalSetting, setSelectedGoalSetting] = useState<any | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; title: string } | null>(null);

  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalSaved, setGoalSaved] = useState("");
  const [goalIcon, setGoalIcon] = useState("");

  const handleSaveGoal = () => {
    if (!goalTitle || !goalTarget) return;
    addGoal({
      title: goalTitle,
      targetAmount: Number(goalTarget),
      currentAmount: Number(goalSaved || 0),
      icon: goalIcon,
      color: "#ffffff",
    });
    setAddGoalOpen(false);
    setGoalTitle("");
    setGoalTarget("");
    setGoalSaved("");
    setGoalIcon("");
    showToast(
      isIndonesian ? "Target finansial dibuat" : "Financial Goal created",
      "add",
      () => {},
    );
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose}>
        <div className="p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)] space-y-4">
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
                      {formatRupiah(g.currentAmount)} /{" "}
                      {formatRupiah(g.targetAmount)}
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

      <BottomSheet isOpen={addGoalOpen} onClose={() => setAddGoalOpen(false)}>
        <div className="p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)] space-y-4">
          <h3
            className="font-semibold text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Tambah Target" : "Add Goal"}
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={goalIcon}
              onChange={(e) => setGoalIcon(e.target.value)}
              className="w-14 p-3.5 rounded-2xl text-center text-xl outline-none"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            />
            <input
              type="text"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder={
                isIndonesian
                  ? "Nama Target (misal: MacBook)"
                  : "Goal Name (e.g. MacBook)"
              }
              className="flex-1 p-3.5 rounded-2xl outline-none font-semibold"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            placeholder={
              isIndonesian ? "Nominal Target (IDR)" : "Target Amount (IDR)"
            }
            className="w-full p-3.5 rounded-2xl outline-none font-semibold"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          />
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={goalSaved}
            onChange={(e) => setGoalSaved(e.target.value)}
            placeholder={
              isIndonesian ? "Dana Terkumpul (IDR)" : "Already Saved (IDR)"
            }
            className="w-full p-3.5 rounded-2xl outline-none font-semibold"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={handleSaveGoal}
            className="w-full py-4 rounded-[20px] font-semibold text-[15px] active:scale-95 cursor-pointer"
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
