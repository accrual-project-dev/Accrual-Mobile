// ======================================================================
// TROUVAILLE PROFILE DYNAMIC ISLAND
// Premium Floating Full-Width Glass Capsule
// ======================================================================

import { Bell, Layers, Laptop, X, HardDrive, CloudCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { useSpace } from "../../contexts/SpaceContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useUpcomingBills } from "../../hooks/useBills";
import { triggerHaptic } from "../../lib/haptics";

interface ProfileMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfileSettings: () => void;
  onOpenManageLedgers: () => void;
  onOpenWebDashboard?: () => void;
  onOpenNotifications?: () => void;
  displayName?: string;
  avatarUrl?: string;
}

export function ProfileMenuModal({
  isOpen,
  onClose,
  onOpenProfileSettings,
  onOpenManageLedgers,
  onOpenWebDashboard,
  onOpenNotifications,
  displayName: propDisplayName,
  avatarUrl: propAvatarUrl,
}: ProfileMenuModalProps) {
  const { session, isGuest } = useAuth();
  const { activeSpace } = useSpace();
  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();

  const isDark = theme !== "light";

  const upcomingBills = useUpcomingBills();
  const hasNotifications = upcomingBills.length > 0;

  const displayName =
    propDisplayName ||
    session?.user?.user_metadata?.display_name ||
    session?.user?.email?.split("@")[0] ||
    "User";

  const avatarUrl =
    propAvatarUrl ||
    session?.user?.user_metadata?.avatar_url ||
    localStorage.getItem("trouvaille_avatar") ||
    "";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ============================================================
              FLOATING BACKDROP
              ============================================================ */}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.18,
              ease: "easeOut",
            }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{
              background: isDark ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.14)",

              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
          />

          {/* ============================================================
              FLOATING CAPSULE

              IMPORTANT:
              fixed = independent from parent width
              top/left/right = still floating
              margin from viewport = preserved
              ============================================================ */}

          <motion.div
            initial={{
              opacity: 0,
              scaleX: 0.94,
              scaleY: 0.9,
              y: -10,
              filter: "blur(3px)",
            }}
            animate={{
              opacity: 1,
              scaleX: 1,
              scaleY: 1,
              y: 0,
              filter: "blur(0px)",
            }}
            exit={{
              opacity: 0,
              scaleX: 0.94,
              scaleY: 0.9,
              y: -8,
              filter: "blur(2px)",
            }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 30,
              mass: 0.72,
            }}
            className="
              fixed
              left-[16px]
              right-[16px]
              z-50

              h-[48px]

              rounded-full

              px-[7px]

              flex
              items-center
              gap-[5px]

              overflow-hidden
              select-none
              box-border

              max-w-none
            "
            style={{
              top: "max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)",
              background: isDark
                ? `
                  linear-gradient(
                    180deg,
                    rgba(43,43,48,0.94) 0%,
                    rgba(23,23,27,0.97) 48%,
                    rgba(13,13,16,0.985) 100%
                  )
                `
                : `
                  linear-gradient(
                    180deg,
                    rgba(255,255,255,0.985) 0%,
                    rgba(248,248,250,0.975) 50%,
                    rgba(240,240,243,0.97) 100%
                  )
                `,

              /*
               * Reduced blur.
               * Still enough to create glass,
               * but much sharper than the previous version.
               */
              backdropFilter: "blur(18px) saturate(150%)",
              WebkitBackdropFilter: "blur(18px) saturate(150%)",

              border: isDark
                ? "1px solid rgba(255,255,255,0.15)"
                : "1px solid rgba(0,0,0,0.095)",

              boxShadow: isDark
                ? `
                  0 24px 60px rgba(0,0,0,0.42),
                  0 8px 24px rgba(0,0,0,0.22),
                  inset 0 1px 0 rgba(255,255,255,0.15),
                  inset 0 -1px 0 rgba(0,0,0,0.40)
                `
                : `
                  0 20px 50px rgba(0,0,0,0.14),
                  0 7px 18px rgba(0,0,0,0.07),
                  inset 0 1px 0 rgba(255,255,255,0.96)
                `,
            }}
          >
            {/* ==========================================================
                SUBTLE TOP REFLECTION
                ========================================================== */}

            <div
              className="
                absolute
                left-[18px]
                right-[18px]
                top-[1px]
                h-[11px]
                rounded-full
                pointer-events-none
              "
              style={{
                background: isDark
                  ? "linear-gradient(180deg, rgba(255,255,255,0.075), transparent)"
                  : "linear-gradient(180deg, rgba(255,255,255,0.70), transparent)",

                opacity: 0.72,
              }}
            />

            {/* ==========================================================
                LEFT GROUP
                ========================================================== */}

            <div
              className="
                relative
                z-[1]

                flex
                items-center
                gap-[5px]

                flex-1
                min-w-0
                overflow-hidden
              "
            >
              {/* ========================================================
                  PROFILE
                  ======================================================== */}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onClose();

                  setTimeout(() => {
                    onOpenProfileSettings();
                  }, 80);
                }}
                className="
                  group

                  flex
                  items-center
                  gap-[8px]

                  pl-[4px]
                  pr-[10px]
                  py-[5px]

                  rounded-full

                  hover:bg-white/[0.055]
                  active:scale-[0.97]

                  transition-all
                  duration-200

                  cursor-pointer
                  min-w-0
                  shrink

                  max-w-[135px]
                  sm:max-w-[180px]
                "
                title={isIndonesian ? "Profil Pengguna" : "User Profile"}
              >
                {/* Avatar */}

                <div
                  className="
                    relative
                    w-[32px]
                    h-[32px]

                    rounded-full
                    overflow-hidden

                    flex
                    items-center
                    justify-center

                    shrink-0
                  "
                  style={{
                    background: isDark
                      ? "linear-gradient(145deg, #36363C, #111114)"
                      : "linear-gradient(145deg, #FFFFFF, #E8E8EB)",

                    border: isDark
                      ? "1px solid rgba(255,255,255,0.18)"
                      : "1px solid rgba(0,0,0,0.09)",

                    boxShadow: isDark
                      ? `
                        inset 0 1px 0 rgba(255,255,255,0.12),
                        0 2px 7px rgba(0,0,0,0.28)
                      `
                      : `
                        inset 0 1px 0 rgba(255,255,255,0.9),
                        0 2px 7px rgba(0,0,0,0.08)
                      `,
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="
                        w-full
                        h-full
                        object-cover
                      "
                    />
                  ) : (
                    <span
                      className="
                        font-semibold
                        text-[11px]
                        tracking-[-0.02em]
                        text-[var(--text-primary)]
                      "
                    >
                      {displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}

                  {/* Sync status */}

                  <span
                    className="
                      absolute
                      bottom-[1px]
                      right-[1px]

                      w-[6px]
                      h-[6px]

                      rounded-full
                    "
                    style={{
                      background: isGuest
                        ? "#8A8A8F"
                        : isDark
                          ? "#D9D9DD"
                          : "#55555A",

                      border: isDark ? "1px solid #111114" : "1px solid white",

                      boxShadow: isDark
                        ? "0 0 0 1px rgba(255,255,255,0.12)"
                        : "0 0 0 1px rgba(0,0,0,0.08)",
                    }}
                  />
                </div>

                {/* Identity */}

                <div className="min-w-0 text-left">
                  <p
                    className="
                      font-semibold
                      text-[13px]

                      truncate

                      leading-[14px]
                      tracking-[-0.015em]

                      text-[var(--text-primary)]
                    "
                  >
                    {displayName}
                  </p>

                  <div
                    className="
                      flex
                      items-center
                      gap-[3px]

                      mt-[3px]

                      opacity-55
                    "
                  >
                    {isGuest ? (
                      <HardDrive size={9} strokeWidth={1.8} />
                    ) : (
                      <CloudCheck size={9} strokeWidth={1.8} />
                    )}

                    <span
                      className="
                        text-[9px]
                        font-medium
                        leading-none
                      "
                    >
                      {isGuest
                        ? isIndonesian
                          ? "Lokal"
                          : "Local"
                        : isIndonesian
                          ? "Sinkron"
                          : "Sync"}
                    </span>
                  </div>
                </div>
              </button>

              {/* ========================================================
                  DIVIDER
                  ======================================================== */}

              <div
                className="
                  h-[20px]
                  w-[1px]
                  shrink-0
                "
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.11)"
                    : "rgba(0,0,0,0.09)",
                }}
              />

              {/* ========================================================
                  ACTIVE LEDGER
                  ======================================================== */}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onClose();

                  setTimeout(() => {
                    onOpenManageLedgers();
                  }, 80);
                }}
                className="
                  flex
                  items-center
                  gap-[6px]

                  px-[11px]
                  py-[7px]

                  rounded-full

                  text-left

                  transition-all
                  duration-200

                  active:scale-[0.97]
                  hover:bg-white/[0.075]

                  cursor-pointer
                  min-w-0
                  shrink

                  max-w-[120px]
                  sm:max-w-[180px]
                "
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.055)"
                    : "rgba(0,0,0,0.035)",

                  border: isDark
                    ? "1px solid rgba(255,255,255,0.095)"
                    : "1px solid rgba(0,0,0,0.07)",

                  boxShadow: isDark
                    ? "inset 0 1px 0 rgba(255,255,255,0.05)"
                    : "inset 0 1px 0 rgba(255,255,255,0.72)",
                }}
                title={isIndonesian ? "Ganti Ruang" : "Switch Space"}
              >
                <Layers
                  size={12}
                  strokeWidth={1.65}
                  className="
                    shrink-0
                    opacity-65
                  "
                />

                <span
                  className="
                    font-medium
                    text-[12px]
                    tracking-[-0.01em]

                    text-[var(--text-primary)]

                    truncate
                  "
                >
                  {activeSpace.name}
                </span>
              </button>
            </div>

            {/* ==========================================================
                RIGHT GROUP
                ========================================================== */}

            <div
              className="
                relative
                z-[1]

                flex
                items-center
                gap-[5px]

                shrink-0
              "
            >
              {/* ========================================================
                  NOTIFICATIONS
                  ======================================================== */}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onClose();

                  if (onOpenNotifications) {
                    setTimeout(() => {
                      onOpenNotifications();
                    }, 80);
                  }
                }}
                className="
                  w-[32px]
                  h-[32px]

                  rounded-full

                  flex
                  items-center
                  justify-center

                  relative
                  shrink-0

                  cursor-pointer

                  transition-all
                  duration-200

                  hover:scale-[1.03]
                  hover:bg-white/[0.075]

                  active:scale-[0.92]
                "
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.055)"
                    : "rgba(0,0,0,0.035)",

                  border: isDark
                    ? "1px solid rgba(255,255,255,0.10)"
                    : "1px solid rgba(0,0,0,0.075)",

                  color: "var(--text-primary)",

                  boxShadow: isDark
                    ? "inset 0 1px 0 rgba(255,255,255,0.06)"
                    : "inset 0 1px 0 rgba(255,255,255,0.75)",
                }}
                title={isIndonesian ? "Pemberitahuan" : "Notifications"}
              >
                <Bell size={13} strokeWidth={1.65} />

                {hasNotifications && (
                  <span
                    className="
                      absolute
                      top-[5px]
                      right-[5px]

                      w-[5px]
                      h-[5px]

                      rounded-full
                    "
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(0,0,0,0.72)",

                      boxShadow: isDark
                        ? "0 0 0 1px rgba(10,10,12,0.9)"
                        : "0 0 0 1px rgba(255,255,255,0.9)",
                    }}
                  />
                )}
              </button>

              {/* ========================================================
                  WEB DASHBOARD
                  ======================================================== */}

              {onOpenWebDashboard && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onClose();

                    setTimeout(() => {
                      onOpenWebDashboard();
                    }, 80);
                  }}
                  className="
                    w-[32px]
                    h-[32px]

                    rounded-full

                    flex
                    items-center
                    justify-center

                    shrink-0

                    cursor-pointer

                    transition-all
                    duration-200

                    hover:scale-[1.03]
                    hover:bg-white/[0.075]

                    active:scale-[0.92]
                  "
                  style={{
                    background: isDark
                      ? "rgba(255,255,255,0.055)"
                      : "rgba(0,0,0,0.035)",

                    border: isDark
                      ? "1px solid rgba(255,255,255,0.10)"
                      : "1px solid rgba(0,0,0,0.075)",

                    color: "var(--text-primary)",

                    boxShadow: isDark
                      ? "inset 0 1px 0 rgba(255,255,255,0.06)"
                      : "inset 0 1px 0 rgba(255,255,255,0.75)",
                  }}
                  title={isIndonesian ? "Web Dashboard" : "Web Dashboard"}
                >
                  <Laptop size={13} strokeWidth={1.65} />
                </button>
              )}

              {/* ========================================================
                  CLOSE
                  ======================================================== */}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onClose();
                }}
                className="
                  w-[30px]
                  h-[30px]

                  rounded-full

                  flex
                  items-center
                  justify-center

                  shrink-0
                  ml-[1px]

                  cursor-pointer

                  transition-all
                  duration-200

                  hover:scale-[1.03]
                  active:scale-[0.90]
                "
                style={{
                  background: isDark ? "rgba(0,0,0,0.24)" : "rgba(0,0,0,0.045)",

                  border: isDark
                    ? "1px solid rgba(255,255,255,0.07)"
                    : "1px solid rgba(0,0,0,0.06)",

                  color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.48)",
                }}
                title={isIndonesian ? "Tutup" : "Close"}
                aria-label="Close"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
