import { useState, useRef, useEffect, useCallback } from "react";
import { triggerHaptic } from "../../lib/haptics";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  History,
  Plus,
  PieChart,
  Landmark,
  Mic,
  Camera,
  FileText,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";

interface BottomTabBarProps {
  onOpenAdd?: () => void;
  onOpenVoiceAdd?: () => void;
  onOpenScan?: () => void;
}

type HoldOption = "manual" | "voice" | "scan";

export function BottomTabBar({
  onOpenAdd,
  onOpenVoiceAdd,
  onOpenScan,
}: BottomTabBarProps) {
  const { t, isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const location = useLocation();

  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<HoldOption | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const selectedOptionRef = useRef<HoldOption | null>(null);

  // Keep ref in sync for event callbacks
  useEffect(() => {
    selectedOptionRef.current = selectedOption;
  }, [selectedOption]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isLongPressRef.current = false;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };

    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsFlyoutOpen(true);
      setSelectedOption("voice"); // Default center (1)
      triggerHaptic("heavy");
    }, 320);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartPosRef.current) return;

    const deltaX = e.clientX - pointerStartPosRef.current.x;
    const deltaY = e.clientY - pointerStartPosRef.current.y;

    if (!isLongPressRef.current) {
      if (Math.hypot(deltaX, deltaY) > 20) {
        clearLongPress();
      }
      return;
    }

    const dist = Math.hypot(deltaX, deltaY);

    if (deltaY > 60 || dist > 180) {
      if (selectedOptionRef.current !== null) {
        setSelectedOption(null);
      }
      return;
    }

    let newOption: HoldOption;
    if (dist < 15) {
      newOption = "voice";
    } else {
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      if (angle < -112) {
        newOption = "manual";
      } else if (angle > -68 && angle < 0) {
        newOption = "scan";
      } else {
        newOption = "voice";
      }
    }

    if (newOption !== selectedOptionRef.current) {
      triggerHaptic("light");
      setSelectedOption(newOption);
    }
  };

  const executeOption = (option: HoldOption) => {
    triggerHaptic("medium");
    if (option === "manual") {
      onOpenAdd?.();
    } else if (option === "voice") {
      onOpenVoiceAdd?.();
    } else if (option === "scan") {
      onOpenScan?.();
    }
  };

  const handlePointerUp = () => {
    clearLongPress();

    if (isLongPressRef.current) {
      const chosen = selectedOptionRef.current;
      setIsFlyoutOpen(false);
      setSelectedOption(null);
      pointerStartPosRef.current = null;

      if (chosen) {
        executeOption(chosen);
      }
      return;
    }

    pointerStartPosRef.current = null;
  };

  const handleAddClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    triggerHaptic("medium");
    if (onOpenAdd) onOpenAdd();
  };

  const arcOptions: {
    id: HoldOption;
    numLabel: string;
    icon: any;
    label: string;
    x: number;
    y: number;
    iconSize: number;
  }[] = [
    {
      id: "manual",
      numLabel: "2",
      icon: FileText,
      label: isIndonesian ? "Transaksi Manual" : "Manual Transaction",
      x: -54,
      y: -46,
      iconSize: 18,
    },
    {
      id: "voice",
      numLabel: "1",
      icon: Mic,
      label: isIndonesian ? "Input Suara" : "Voice Quick-Add",
      x: 0,
      y: -76,
      iconSize: 20,
    },
    {
      id: "scan",
      numLabel: "3",
      icon: Camera,
      label: isIndonesian ? "Pindai Struk" : "Scan Receipt",
      x: 54,
      y: -46,
      iconSize: 18,
    },
  ];

  const tabs = [
    { path: "/", icon: Home, label: t("nav.home", "Home") },
    { path: "/assets", icon: Landmark, label: t("nav.assets", "Assets") },
    { action: "add", icon: Plus, label: t("nav.add", "Add") },
    {
      path: "/transactions",
      icon: History,
      label: t("nav.transactions", "Transactions"),
    },
    {
      path: "/statistics",
      icon: PieChart,
      label: t("nav.analytics", "Analytics"),
    },
  ];

  // ── Clean Apple Frosted Liquid Glass Tokens (Zero Glow Shadow) ──
  const dockBg = isDark
    ? "linear-gradient(180deg, rgba(22, 22, 26, 0.88) 0%, rgba(12, 12, 15, 0.94) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const dockBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.12)"
    : "1px solid rgba(0, 0, 0, 0.08)";

  const dockShadow = isDark
    ? "0 18px 44px -8px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.16)"
    : "0 12px 32px -8px rgba(31, 36, 48, 0.12), inset 0 1px 0 #ffffff";

  return (
    <>
      {/* Backdrop for Flyout Dismissal */}
      <AnimatePresence>
        {isFlyoutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsFlyoutOpen(false);
              setSelectedOption(null);
            }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[4px] pointer-events-auto"
          />
        )}
      </AnimatePresence>

      {/* ── Apple Ambient Bottom Shield: Eliminates bottom leakage beneath the floating pill ── */}
      <div
        aria-hidden="true"
        data-testid="bottom-tab-bar-ambient-shield"
        className="fixed bottom-0 left-0 right-0 pointer-events-none z-40 transition-colors duration-200"
        style={{
          height: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
          background: isDark
            ? "linear-gradient(to bottom, rgba(10,10,13,0) 0%, rgba(10,10,13,0.3) 28%, rgba(10,10,13,0.85) 60%, var(--bg-base) 82%, var(--bg-base) 100%)"
            : "linear-gradient(to bottom, rgba(240,240,242,0) 0%, rgba(240,240,242,0.3) 28%, rgba(240,240,242,0.85) 60%, var(--bg-base) 82%, var(--bg-base) 100%)",
        }}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 px-5 pb-[calc(10px+env(safe-area-inset-bottom))] pointer-events-none flex justify-center">
        <div
          className="w-full max-w-[360px] rounded-full p-1.5 flex items-center justify-between pointer-events-auto transition-all relative select-none"
          style={{
            background: dockBg,
            border: dockBorder,
            boxShadow: dockShadow,
            backdropFilter: "blur(28px) saturate(190%)",
            WebkitBackdropFilter: "blur(28px) saturate(190%)",
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;

            if (tab.action === "add") {
              return (
                <div
                  key="add"
                  className="relative flex items-center justify-center"
                >
                  {/* Radial Arc Fan Menu */}
                  <AnimatePresence>
                    {isFlyoutOpen && (
                      <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                        {/* Dynamic Action Floating Title Pill */}
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.92 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.92 }}
                          transition={{ duration: 0.16 }}
                          className="absolute -top-[104px] left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap pointer-events-none select-none z-20"
                          style={{
                            background: isDark
                              ? "rgba(18, 18, 22, 0.95)"
                              : "rgba(255, 255, 255, 0.96)",
                            color: "var(--text-primary)",
                            border: isDark
                              ? "1px solid rgba(255, 255, 255, 0.12)"
                              : "1px solid rgba(0, 0, 0, 0.08)",
                            boxShadow: isDark
                              ? "0 8px 24px -4px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.14)"
                              : "0 6px 18px -4px rgba(31, 36, 48, 0.1), inset 0 1px 0 #ffffff",
                            backdropFilter: "blur(24px) saturate(180%)",
                            WebkitBackdropFilter: "blur(24px) saturate(180%)",
                          }}
                        >
                          {selectedOption === "manual" &&
                            (isIndonesian ? "Transaksi Manual" : "Manual Add")}
                          {selectedOption === "voice" &&
                            (isIndonesian ? "Input Suara" : "Voice Quick-Add")}
                          {selectedOption === "scan" &&
                            (isIndonesian ? "Pindai Struk" : "Scan Receipt")}
                          {!selectedOption &&
                            (isIndonesian ? "Arahkan Jari" : "Glide to Select")}
                        </motion.div>

                        {/* Arc Floating Buttons (2, 1, 3) */}
                        {arcOptions.map((item) => {
                          const ItemIcon = item.icon;
                          const isSelected = selectedOption === item.id;

                          return (
                            <motion.button
                              key={item.id}
                              type="button"
                              initial={{
                                opacity: 0,
                                scale: 0.2,
                                x: 0,
                                y: 0,
                              }}
                              animate={{
                                opacity: 1,
                                scale: isSelected ? 1.15 : 1,
                                x: item.x,
                                y: item.y,
                              }}
                              exit={{
                                opacity: 0,
                                scale: 0.2,
                                x: 0,
                                y: 0,
                              }}
                              transition={{
                                type: "spring",
                                stiffness: 460,
                                damping: 26,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsFlyoutOpen(false);
                                executeOption(item.id);
                              }}
                              className="w-11 h-11 rounded-full flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-all cursor-pointer select-none"
                              style={{
                                background: isSelected
                                  ? isDark
                                    ? "#ffffff"
                                    : "#18181b"
                                  : isDark
                                    ? "linear-gradient(160deg, rgba(28, 28, 34, 0.95) 0%, rgba(16, 16, 20, 0.98) 100%)"
                                    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.92) 100%)",
                                color: isSelected
                                  ? isDark
                                    ? "#000000"
                                    : "#ffffff"
                                  : "var(--text-primary)",
                                border: isSelected
                                  ? isDark
                                    ? "1px solid #ffffff"
                                    : "1px solid #18181b"
                                  : isDark
                                    ? "1px solid rgba(255, 255, 255, 0.12)"
                                    : "1px solid rgba(0, 0, 0, 0.08)",
                                boxShadow: isSelected
                                  ? isDark
                                    ? "0 10px 26px -4px rgba(0, 0, 0, 0.9), inset 0 1px 0 #ffffff"
                                    : "0 8px 20px -4px rgba(0, 0, 0, 0.25)"
                                  : isDark
                                    ? "0 8px 22px -4px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.14)"
                                    : "0 6px 16px -4px rgba(31, 36, 48, 0.08), inset 0 1px 0 #ffffff",
                                backdropFilter: "blur(24px) saturate(180%)",
                                WebkitBackdropFilter:
                                  "blur(24px) saturate(180%)",
                                zIndex: isSelected ? 10 : 0,
                              }}
                              title={item.label}
                              aria-label={item.label}
                            >
                              <ItemIcon
                                size={item.iconSize}
                                strokeWidth={isSelected ? 2.2 : 1.85}
                              />
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Center Add Button [C] */}
                  <button
                    data-tour="quick-add"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={clearLongPress}
                    onPointerCancel={clearLongPress}
                    onClick={handleAddClick}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label={
                      isIndonesian
                        ? "Tambah Transaksi (Tahan & Geser untuk Suara atau Pindai)"
                        : "Add Transaction (Hold & Glide for Voice or Scan)"
                    }
                    title={
                      isIndonesian
                        ? "Ketuk untuk Tambah, Tahan & Geser: Manual, Suara, Pindai"
                        : "Tap to Add, Hold & Glide: Manual, Voice, Scan"
                    }
                    className={`w-10 h-10 flex items-center justify-center relative rounded-full active:scale-95 transition-all select-none touch-manipulation cursor-pointer ${
                      isFlyoutOpen ? "scale-105" : ""
                    }`}
                    style={{
                      background: isDark ? "#ffffff" : "#18181b",
                      color: isDark ? "#000000" : "#ffffff",
                      boxShadow: isDark
                        ? "0 4px 14px -2px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.25)"
                        : "0 3px 10px -2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
                    }}
                  >
                    <Icon
                      size={20}
                      strokeWidth={2.4}
                      className={`transition-transform duration-200 ${
                        isFlyoutOpen ? "rotate-45" : ""
                      }`}
                    />
                  </button>
                </div>
              );
            }

            const isActive =
              tab.path === "/"
                ? location.pathname === "/" || location.pathname === "/calendar"
                : location.pathname === tab.path;

            return (
              <NavLink
                key={tab.path}
                to={tab.path!}
                data-tour={
                  tab.path === "/"
                    ? "nav-home"
                    : tab.path === "/assets"
                      ? "nav-assets"
                      : tab.path === "/transactions"
                        ? "nav-transactions"
                        : tab.path === "/statistics"
                          ? "nav-statistics"
                          : undefined
                }
                onClick={() => triggerHaptic("light")}
                title={tab.label}
                aria-label={tab.label}
                className="w-10 h-10 flex items-center justify-center relative rounded-full active:scale-95 transition-transform"
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: isDark
                        ? "rgba(255, 255, 255, 0.12)"
                        : "rgba(0, 0, 0, 0.08)",
                      border: isDark
                        ? "1px solid rgba(255, 255, 255, 0.14)"
                        : "1px solid rgba(0, 0, 0, 0.06)",
                      boxShadow: isDark
                        ? "inset 0 1px 0 rgba(255, 255, 255, 0.12)"
                        : "inset 0 1px 0 #ffffff",
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.2 : 1.85}
                  className="relative z-10 transition-colors duration-200"
                  style={{
                    color: isActive
                      ? isDark
                        ? "#ffffff"
                        : "#09090b"
                      : "var(--text-tertiary)",
                  }}
                />
              </NavLink>
            );
          })}
        </div>
      </div>
    </>
  );
}
