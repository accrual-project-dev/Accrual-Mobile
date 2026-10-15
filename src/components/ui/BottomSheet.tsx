import {
  motion,
  AnimatePresence,
  type PanInfo,
  useDragControls,
} from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  zIndex?: number;
  resetHeightKey?: any;
  disableHeightLock?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  zIndex,
  resetHeightKey,
  disableHeightLock,
}: BottomSheetProps) {
  const dragControls = useDragControls();
  const sheetContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [lockedMinHeight, setLockedMinHeight] = useState<number | undefined>(undefined);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  /**
   * Reset lockedMinHeight whenever resetHeightKey changes (e.g. on-screen keypad closed/opened),
   * allowing the modal to immediately remeasure its natural content height and auto-shrink smoothly.
   */
  useEffect(() => {
    if (resetHeightKey !== undefined || disableHeightLock) {
      setLockedMinHeight(undefined);
      if (resetHeightKey === false && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [resetHeightKey, disableHeightLock]);

  /**
   * Track virtual keyboard visibility & mobile viewport changes via window.visualViewport.
   * On iOS Safari & mobile Chrome, when the virtual keyboard opens, visualViewport.height drops.
   * This anchors the sheet securely above the keyboard so search inputs and results remain visible.
   */
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || !window.visualViewport) {
      setKeyboardOffset(0);
      setViewportHeight(null);
      return;
    }

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      const isKeyboardActive = offset > 80;
      setKeyboardOffset(isKeyboardActive ? Math.max(0, Math.round(offset)) : 0);
      setViewportHeight(Math.round(vv.height));
    };

    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [isOpen]);

  /**
   * Keep track of the maximum height the sheet achieves while open.
   * This prevents the sheet from collapsing/shrinking when the user searches or filters
   * items inside, ensuring it doesn't get obscured or jump behind the mobile virtual keyboard.
   */
  useEffect(() => {
    if (!isOpen || disableHeightLock) {
      const timer = setTimeout(() => {
        setLockedMinHeight(undefined);
      }, 300);
      return () => clearTimeout(timer);
    }

    if (typeof ResizeObserver === "undefined") return;

    const el = sheetContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.round(entry.contentRect.height);
        if (height > 0) {
          setLockedMinHeight((prev) => {
            if (!prev || height > prev) {
              return height;
            }
            return prev;
          });
        }
      }
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [isOpen, disableHeightLock]);

  /**
   * Lock the underlying page while the sheet is open.
   * Keep the existing app-scroll-container behavior so the sheet
   * does not cause the background page to move underneath it.
   */
  useEffect(() => {
    const scrollEl = document.getElementById("app-scroll-container");

    if (isOpen) {
      document.body.style.overflow = "hidden";

      if (scrollEl) {
        scrollEl.style.overflow = "hidden";
      }
    } else {
      document.body.style.overflow = "";

      if (scrollEl) {
        scrollEl.style.overflow = "";
      }
    }

    return () => {
      document.body.style.overflow = "";

      if (scrollEl) {
        scrollEl.style.overflow = "";
      }
    };
  }, [isOpen]);

  /**
   * Dismiss when user presses the Escape key on physical keyboard.
   */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  /**
   * Dismiss when the sheet is pulled down far enough
   * or released with a strong downward velocity.
   */
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 350) {
      onClose();
    }
  };

  /**
   * Automatically scroll focused input/textarea into view inside the sheet
   * when mobile software keyboard opens.
   */
  useEffect(() => {
    if (!isOpen || keyboardOffset === 0) return;

    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      const timer = setTimeout(() => {
        activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, keyboardOffset]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence mode="sync">
      {isOpen && (
        <>
          {/* =========================================================
              BACKDROP
              ========================================================= */}
          <motion.div
            className="fixed inset-0"
            style={{
              zIndex: zIndex ? zIndex - 1 : 998,
              background: "rgba(0, 0, 0, 0.64)",
              backdropFilter: "blur(7px)",
              WebkitBackdropFilter: "blur(7px)",
              willChange: "opacity, backdrop-filter",
            }}
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.24,
              ease: [0.22, 1, 0.36, 1],
            }}
            onClick={onClose}
          />

          {/* =========================================================
              BOTTOM SHEET
              ========================================================= */}
          <motion.div
            ref={sheetContainerRef}
            role="dialog"
            aria-modal="true"
            aria-label={title || "Dialog"}
            className="
              fixed
              bottom-0
              left-0
              right-0
              flex
              flex-col
              overflow-hidden
              shadow-2xl
            "
            style={{
              zIndex: zIndex || 999,
              background: "var(--sheet-bg, var(--bg-base))",

              borderTop: "var(--sheet-border, 1px solid var(--glass-border))",
              borderLeft: "var(--sheet-border, 1px solid var(--glass-border))",
              borderRight: "var(--sheet-border, 1px solid var(--glass-border))",

              boxShadow: "var(--sheet-shadow, none)",

              borderRadius: "28px 28px 0 0",

              bottom: `${keyboardOffset}px`,

              minHeight: lockedMinHeight
                ? `${Math.min(
                    lockedMinHeight,
                    keyboardOffset > 0 && viewportHeight
                      ? Math.round(viewportHeight * 0.85)
                      : typeof window !== "undefined"
                        ? window.innerHeight * 0.92
                        : 800,
                  )}px`
                : undefined,

              /*
               * Important:
               * Keep the height constraint on the sheet itself,
               * while allowing the inner scroll area to shrink.
               * When software keyboard opens, clamp against the visual viewport.
               */
              maxHeight:
                keyboardOffset > 0 && viewportHeight
                  ? `${Math.round(viewportHeight * 0.94)}px`
                  : "92dvh",

              transition:
                "bottom 0.22s cubic-bezier(0.16, 1, 0.3, 1), max-height 0.22s cubic-bezier(0.16, 1, 0.3, 1), min-height 0.28s cubic-bezier(0.22, 1, 0.36, 1), height 0.28s cubic-bezier(0.22, 1, 0.36, 1)",

              /*
               * Prevent browser from trying to repaint the entire
               * application during the sheet animation.
               */
              willChange: "transform, opacity",
            }}
            initial={{
              y: "100%",
              opacity: 0,
              scale: 0.985,
            }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{
              y: "100%",
              opacity: 0,
              scale: 0.985,
            }}
            transition={{
              y: {
                type: "spring",
                stiffness: 380,
                damping: 34,
                mass: 0.78,
              },
              opacity: {
                duration: 0.2,
                ease: [0.22, 1, 0.36, 1],
              },
              scale: {
                duration: 0.26,
                ease: [0.22, 1, 0.36, 1],
              },
            }}
            drag={keyboardOffset > 0 ? false : "y"}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{
              top: 0,
            }}
            dragElastic={{
              top: 0.035,
              bottom: 0.72,
            }}
            dragSnapToOrigin
            onDragEnd={handleDragEnd}
          >
            {/* =======================================================
                SUBTLE TOP GLASS HIGHLIGHT
                ======================================================= */}
            <div
              className="
                absolute
                top-0
                left-6
                right-6
                h-12
                rounded-full
                pointer-events-none
                z-0
              "
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.045), transparent 75%)",
              }}
            />

            {/* =======================================================
                HEADER / DRAG HANDLE
                ======================================================= */}
            <div
              className="
                relative
                z-10
                flex
                flex-col
                shrink-0
                w-full
                select-none
                touch-none
                cursor-grab
                active:cursor-grabbing
              "
              onPointerDown={(e) => {
                dragControls.start(e);
              }}
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2.5 w-full">
                <motion.div
                  initial={{
                    opacity: 0,
                    scaleX: 0.65,
                  }}
                  animate={{
                    opacity: 1,
                    scaleX: 1,
                  }}
                  transition={{
                    delay: 0.06,
                    duration: 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
                    width: 40,
                    height: 5,
                    borderRadius: 999,
                    background: "var(--text-tertiary)",
                    opacity: 0.45,
                    transformOrigin: "center",
                  }}
                />
              </div>

              {/* Title */}
              {title && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 5,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: 0.055,
                    duration: 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="
                    flex
                    items-center
                    justify-between
                    px-5
                    pb-4
                  "
                >
                  <h2
                    className="text-xl font-semibold pointer-events-none"
                    style={{
                      color: "var(--text-primary)",
                    }}
                  >
                    {title}
                  </h2>

                  <motion.button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    whileHover={{
                      scale: 1.035,
                    }}
                    whileTap={{
                      scale: 0.9,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 550,
                      damping: 28,
                    }}
                    style={{
                      color: "var(--text-tertiary)",
                    }}
                    className="
                      p-1.5
                      rounded-full
                      active:scale-90
                      cursor-pointer
                      pointer-events-auto
                    "
                    aria-label="Close"
                  >
                    <X size={20} />
                  </motion.button>
                </motion.div>
              )}
            </div>

            {/* =======================================================
                SCROLLABLE CONTENT
                =======================================================

                `min-h-0` is important here.

                Without it, a flex child can preserve the minimum
                height dictated by its content and cause the lower
                portion of large grids to appear clipped.

                Bottom safe-area padding lives INSIDE the scroll area
                so the final row can actually scroll above it.
                ======================================================= */}
            <div
              ref={scrollContainerRef}
              className="
                relative
                z-10
                min-h-0
                flex-1
                overflow-y-auto
                overscroll-contain
              "
              style={{
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                overscrollBehaviorY: "contain",
              }}
            >
              <div
                className="min-h-full"
                style={{
                  paddingBottom:
                    keyboardOffset > 0
                      ? "16px"
                      : "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 24px)",
                }}
              >
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
