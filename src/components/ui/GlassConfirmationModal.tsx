import type { ComponentType, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { triggerHaptic } from "../../lib/haptics";

export interface GlassConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  isIndonesian?: boolean;
  isDark?: boolean;
  zIndex?: number;
  children?: ReactNode;
}

export function GlassConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  icon: Icon = AlertCircle,
  isIndonesian = true,
  isDark = true,
  zIndex,
  children,
}: GlassConfirmationModalProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="" zIndex={zIndex}>
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <Icon size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">
              {title}
            </h4>
            <p className="text-[12px] text-[var(--text-tertiary)] mt-1 leading-relaxed">
              {description}
            </p>
            {children && <div className="mt-3">{children}</div>}
          </div>
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            className="flex-1 h-11 rounded-full font-semibold text-[13px] active:scale-[0.98] transition-all cursor-pointer"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            {cancelLabel || (isIndonesian ? "Batal" : "Cancel")}
          </button>
          <button
            type="button"
            onClick={async () => {
              triggerHaptic("medium");
              onClose();
              await onConfirm();
            }}
            className="flex-1 h-11 rounded-full font-semibold text-[13px] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
            style={{
              background: isDark ? "#ffffff" : "#18181b",
              color: isDark ? "#000000" : "#ffffff",
            }}
          >
            {confirmLabel || (isIndonesian ? "Lanjutkan" : "Continue")}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
