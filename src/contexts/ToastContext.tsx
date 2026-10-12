import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw, Trash2, Plus, Sparkles, X } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { triggerHaptic } from "../lib/haptics";

export type ToastActionType = "add" | "update" | "delete" | "info";

interface Toast {
  id: string;
  message: string;
  actionType: ToastActionType;
  onUndo?: () => void;
}

interface ToastContextType {
  showToast: (
    message: string,
    actionType?: ToastActionType,
    onExecuteOrUndo?: (() => void) | null,
    delayMs?: number,
    onCancel?: () => void
  ) => void;
  isToastActive: boolean;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { isIndonesian } = useLanguage();
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Broadcast toast activity so SyncStatusPill never overlaps
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("trouvaille:toast-active", {
          detail: { active: !!toast },
        })
      );
    }
  }, [toast]);

  const showToast = useCallback(
    (
      message: string,
      actionType: ToastActionType = "info",
      onExecuteOrUndo?: (() => void) | null,
      delayMs = 3800,
      onCancel?: () => void
    ) => {
      const id = Math.random().toString(36).slice(2, 9);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      triggerHaptic(actionType === "delete" ? "medium" : "light");

      timerRef.current = setTimeout(() => {
        if (onCancel && typeof onExecuteOrUndo === "function") {
          onExecuteOrUndo();
        }
        setToast(null);
      }, delayMs);

      let onUndo: (() => void) | undefined;
      if (onCancel) {
        onUndo = () => {
          if (timerRef.current) clearTimeout(timerRef.current);
          triggerHaptic("medium");
          onCancel();
          setToast(null);
        };
      } else if (
        typeof onExecuteOrUndo === "function" &&
        onExecuteOrUndo.length === 0 &&
        onExecuteOrUndo.toString() !== "() => {}" &&
        onExecuteOrUndo.toString() !== "()=>{}"
      ) {
        onUndo = () => {
          if (timerRef.current) clearTimeout(timerRef.current);
          triggerHaptic("medium");
          onExecuteOrUndo();
          setToast(null);
        };
      }

      setToast({ id, message, actionType, onUndo });
    },
    []
  );

  const getActionIcon = (type: ToastActionType) => {
    switch (type) {
      case "add":
        return <Plus size={13} strokeWidth={2.5} />;
      case "update":
        return <Check size={13} strokeWidth={2.5} />;
      case "delete":
        return <Trash2 size={13} strokeWidth={1.8} />;
      default:
        return <Sparkles size={13} strokeWidth={1.8} />;
    }
  };

  const getIconStyles = (type: ToastActionType) => {
    switch (type) {
      case "delete":
        return {
          background: "rgba(239, 68, 68, 0.16)",
          color: "#f87171",
          border: "1px solid rgba(239, 68, 68, 0.28)",
        };
      case "add":
      case "update":
        return {
          background: "var(--glass-fill)",
          color: "var(--text-primary)",
          border: "1px solid var(--glass-border)",
        };
      default:
        return {
          background: "var(--glass-fill)",
          color: "var(--text-secondary)",
          border: "1px solid var(--glass-border)",
        };
    }
  };

  const toastContent = (
    <AnimatePresence>
      {toast && (
        <aside
          key={toast.id}
          aria-live="polite"
          aria-atomic="true"
          className="fixed left-4 right-4 z-[999999] max-w-md mx-auto pointer-events-none select-none font-sans"
          style={{
            top: "max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {/* Subtle Ambient Island Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-2.5 rounded-full opacity-40 blur-xl"
            style={{
              background:
                toast.actionType === "delete"
                  ? "rgba(239, 68, 68, 0.12)"
                  : "rgba(255, 255, 255, 0.05)",
            }}
          />

          {/* Liquid Glass HUD Island Capsule */}
          <motion.div
            initial={{ opacity: 0, y: -26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.94 }}
            transition={{ type: "spring", damping: 28, stiffness: 420 }}
            className="pointer-events-auto relative flex items-center justify-between gap-3 p-2.5 px-3.5 rounded-[26px]"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
              boxShadow:
                "0 18px 40px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)",
              backdropFilter: "blur(28px) saturate(190%)",
              WebkitBackdropFilter: "blur(28px) saturate(190%)",
            }}
          >
            {/* Left Section: Action Icon & Message */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={getIconStyles(toast.actionType)}
              >
                {getActionIcon(toast.actionType)}
              </div>
              <p
                className="text-[12.5px] font-semibold truncate leading-tight tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {toast.message}
              </p>
            </div>

            {/* Right Section: Undo or Close Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {toast.onUndo ? (
                <button
                  type="button"
                  onClick={toast.onUndo}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-primary)] hover:border-white/20"
                >
                  <RotateCcw size={11} strokeWidth={2.2} />
                  <span>{isIndonesian ? "Urungkan" : "Undo"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    if (timerRef.current) clearTimeout(timerRef.current);
                    setToast(null);
                  }}
                  className="w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </div>
          </motion.div>
        </aside>
      )}
    </AnimatePresence>
  );

  const value = useMemo(
    () => ({ showToast, isToastActive: !!toast }),
    [showToast, toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" ? createPortal(toastContent, document.body) : toastContent}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
