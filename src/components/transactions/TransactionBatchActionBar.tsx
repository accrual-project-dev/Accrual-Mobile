import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";

export interface TransactionBatchActionBarProps {
  isSelectMode: boolean;
  selectedCount: number;
  totalVisibleCount: number;
  onSelectAllOrNone: () => void;
  onBulkDelete: () => void;
  onExitSelectMode: () => void;
  isIndonesian: boolean;
}

export const TransactionBatchActionBar = memo(function TransactionBatchActionBar({
  isSelectMode,
  selectedCount,
  totalVisibleCount,
  onSelectAllOrNone,
  onBulkDelete,
  onExitSelectMode,
  isIndonesian,
}: TransactionBatchActionBarProps) {
  return (
    <AnimatePresence>
      {isSelectMode && (
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 35, scale: 0.96 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="fixed bottom-[max(calc(env(safe-area-inset-bottom,0px)+80px),92px)] left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-[9999] p-3 rounded-[24px] flex items-center justify-between pointer-events-auto"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-card), 0 16px 40px rgba(0,0,0,0.35)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-bold px-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              {selectedCount} {isIndonesian ? "Dipilih" : "Selected"}
            </span>
            <button
              type="button"
              onClick={onSelectAllOrNone}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-xl active:scale-95 transition-all cursor-pointer select-none"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              {selectedCount === totalVisibleCount && totalVisibleCount > 0
                ? (isIndonesian ? "Batalkan Pilihan" : "Deselect All")
                : (isIndonesian ? "Pilih Semua" : "Select All")}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold active:scale-95 transition-all cursor-pointer"
                style={{
                  background: "rgba(239, 68, 68, 0.14)",
                  color: "#fca5a5",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                }}
              >
                <Trash2 size={13} strokeWidth={2} />
                <span>{isIndonesian ? `Hapus (${selectedCount})` : `Delete (${selectedCount})`}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onExitSelectMode}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold active:scale-95 transition-all cursor-pointer"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-base)",
              }}
            >
              {isIndonesian ? "Selesai" : "Done"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
