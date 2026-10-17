import { lazy, Suspense } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { NotificationSheet } from "../ui/NotificationSheet";
import { MetricDrillDownSheet } from "./MetricDrillDownSheet";
import { WidgetCustomizationBar } from "../common";
import type { Goal } from "../../hooks/useGoals";
import { HOME_PRESETS, getLocalizedWidgetMeta } from "../../lib/widgetLayoutTypes";
import { useCurrency } from "../../contexts/CurrencyContext";
import { triggerHaptic } from "../../lib/haptics";

const BillManagementSheets = lazy(() =>
  import("../settings/BillManagementSheets").then((m) => ({
    default: m.BillManagementSheets,
  })),
);
const PayBillModal = lazy(() =>
  import("../bills/PayBillModal").then((m) => ({
    default: m.PayBillModal,
  })),
);
const ManageLedgersSheet = lazy(() =>
  import("../settings/ManageLedgersSheet").then((m) => ({
    default: m.ManageLedgersSheet,
  })),
);
const CategoryManagementSheets = lazy(() =>
  import("../settings/CategoryManagementSheets").then((m) => ({
    default: m.CategoryManagementSheets,
  })),
);
const NfcCardReaderModal = lazy(() =>
  import("../nfc/NfcCardReaderModal").then((m) => ({
    default: m.NfcCardReaderModal,
  })),
);
const ProfileSheet = lazy(() =>
  import("../settings/ProfileSheet").then((m) => ({
    default: m.ProfileSheet,
  })),
);
const WebDashboardLinkModal = lazy(() =>
  import("../settings/WebDashboardLinkModal").then((m) => ({
    default: m.WebDashboardLinkModal,
  })),
);
const GoalDetailModal = lazy(() =>
  import("../goals/GoalDetailModal").then((m) => ({
    default: m.GoalDetailModal,
  })),
);

export interface HomeModalsContainerProps {
  selectedDate: Date | null;
  onCloseDayTransactions: () => void;
  selectedDayTxs: any[];
  categories: any[];
  isIndonesian: boolean;
  isDark: boolean;
  t: (key: string, fallback: string) => string;

  notifOpen: boolean;
  onCloseNotif: () => void;

  selectedGoal: any | null;
  onCloseGoal: () => void;
  depositToGoal: (id: string, amount: number) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  metricDrillDown: any;
  onCloseMetricDrillDown: () => void;

  billManagementOpen: boolean;
  onCloseBillManagement: () => void;

  payingBill: any;
  onClosePayingBill: () => void;
  markBillPaid: any;
  showToast: (msg: string, type: "add" | "delete", undo?: () => void) => void;

  spaceSwitcherOpen: boolean;
  onCloseSpaceSwitcher: () => void;

  categoryManagementOpen: boolean;
  onCloseCategoryManagement: () => void;

  nfcModalOpen: boolean;
  onCloseNfcModal: () => void;

  customizeHomeOpen: boolean;
  onCloseCustomizeHome: () => void;
  widgets: any[];
  toggleCardVisibility: (id: string) => void;
  activePresetKey: string;
  setActivePresetKey: (key: any) => void;
  applyPreset: (key: any) => void;
  resetLayout: () => void;

  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
  hiddenCards: any[];

  profileSheetOpen: boolean;
  onCloseProfileSheet: () => void;
  avatarUrl: string;
  setCustomAvatarUrl: (url: string) => void;
  displayName: string;
  setCustomDisplayName: (name: string) => void;
  onOpenDeleteAccount: () => void;

  webDashboardOpen: boolean;
  onCloseWebDashboard: () => void;

  isTourOpen: boolean;
  onCloseTour: () => void;
}

export function HomeModalsContainer({
  selectedDate,
  onCloseDayTransactions,
  selectedDayTxs,
  categories,
  isIndonesian,
  isDark,
  t,
  notifOpen,
  onCloseNotif,
  selectedGoal,
  onCloseGoal,
  depositToGoal,
  updateGoal,
  deleteGoal,
  metricDrillDown,
  onCloseMetricDrillDown,
  billManagementOpen,
  onCloseBillManagement,
  payingBill,
  onClosePayingBill,
  markBillPaid,
  showToast,
  spaceSwitcherOpen,
  onCloseSpaceSwitcher,
  categoryManagementOpen,
  onCloseCategoryManagement,
  nfcModalOpen,
  onCloseNfcModal,
  customizeHomeOpen,
  onCloseCustomizeHome,
  widgets,
  toggleCardVisibility,
  activePresetKey,
  setActivePresetKey,
  applyPreset,
  resetLayout,
  isEditMode,
  setIsEditMode,
  hiddenCards,
  profileSheetOpen,
  onCloseProfileSheet,
  avatarUrl,
  setCustomAvatarUrl,
  displayName,
  setCustomDisplayName,
  onOpenDeleteAccount,
  webDashboardOpen,
  onCloseWebDashboard,
  isTourOpen: _isTourOpen,
  onCloseTour: _onCloseTour,
}: HomeModalsContainerProps) {
  const { formatWithPreferred } = useCurrency();
  return (
    <>
      {/* Day Transactions Sheet */}
      <BottomSheet
        isOpen={!!selectedDate}
        onClose={onCloseDayTransactions}
      >
        <div className="px-5 pb-10">
          <h3
            className="font-semibold text-base mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            {selectedDate
              ? format(selectedDate, "dd MMMM yyyy", {
                  locale: isIndonesian ? idLocale : undefined,
                })
              : ""}
          </h3>
          {selectedDayTxs.length === 0 ? (
            <p
              className="text-sm text-center py-6"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Tidak ada transaksi pada tanggal ini."
                : "No transactions on this date."}
            </p>
          ) : (
            <div className="space-y-2.5">
              {selectedDayTxs.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex justify-between items-center p-3.5 rounded-2xl"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: "var(--glass-fill)",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      <IconRenderer
                        icon={
                          tx.categories?.emoji ||
                          categories.find((c: any) => c.id === tx.category_id)
                            ?.emoji ||
                          "/icons/lainnya.png"
                        }
                        size="w-6 h-6"
                      />
                    </div>
                    <div>
                      <p
                        className="font-semibold text-[13px]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {tx.categories?.name ||
                          categories.find((c: any) => c.id === tx.category_id)
                            ?.name ||
                          "Transfer"}
                      </p>
                      <p
                        className="text-[11px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {tx.note || (isIndonesian ? "Tanpa catatan" : "No note")}
                      </p>
                    </div>
                  </div>
                  <span
                    className="amount text-[13px]"
                    style={{
                      color:
                        tx.type === "income"
                          ? "var(--accent)"
                          : "var(--text-primary)",
                    }}
                  >
                    {tx.type === "income"
                      ? "+"
                      : tx.type === "expense"
                        ? "-"
                        : ""}
                    {formatWithPreferred(Number(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      {notifOpen && (
        <NotificationSheet
          isOpen={notifOpen}
          onClose={onCloseNotif}
        />
      )}

      {selectedGoal && (
        <Suspense fallback={null}>
          <GoalDetailModal
            goal={selectedGoal}
            isOpen={!!selectedGoal}
            onClose={onCloseGoal}
            onDeposit={depositToGoal}
            onUpdate={updateGoal}
            onDelete={deleteGoal}
          />
        </Suspense>
      )}

      {metricDrillDown && (
        <MetricDrillDownSheet
          isOpen={!!metricDrillDown}
          onClose={onCloseMetricDrillDown}
          type={metricDrillDown?.type || null}
          data={metricDrillDown?.data || null}
        />
      )}

      {billManagementOpen && (
        <Suspense fallback={null}>
          <BillManagementSheets
            isOpen={billManagementOpen}
            onClose={onCloseBillManagement}
          />
        </Suspense>
      )}

      {payingBill && (
        <Suspense fallback={null}>
          <PayBillModal
            isOpen={!!payingBill}
            bill={payingBill}
            onClose={onClosePayingBill}
            isPending={markBillPaid.isPending}
            onConfirmPaid={({ bill, recordTransaction, walletId }) => {
              markBillPaid.mutate(
                { bill, paid: true, recordTransaction, walletId },
                {
                  onSuccess: () => {
                    onClosePayingBill();
                    showToast(
                      isIndonesian
                        ? `${bill.title} berhasil ditandai lunas`
                        : `${bill.title} marked as paid`,
                      "add",
                      () => {},
                    );
                  },
                  onError: (error: any) => {
                    showToast(
                      error?.message ||
                        (isIndonesian
                          ? `Gagal menandai ${bill.title}`
                          : `Failed to mark ${bill.title} as paid`),
                      "delete",
                      () => {},
                    );
                  },
                },
              );
            }}
          />
        </Suspense>
      )}

      {spaceSwitcherOpen && (
        <Suspense fallback={null}>
          <ManageLedgersSheet
            isOpen={spaceSwitcherOpen}
            onClose={onCloseSpaceSwitcher}
          />
        </Suspense>
      )}

      {categoryManagementOpen && (
        <Suspense fallback={null}>
          <CategoryManagementSheets
            isOpen={categoryManagementOpen}
            onClose={onCloseCategoryManagement}
          />
        </Suspense>
      )}

      {nfcModalOpen && (
        <Suspense fallback={null}>
          <NfcCardReaderModal
            isOpen={nfcModalOpen}
            onClose={onCloseNfcModal}
          />
        </Suspense>
      )}

      {/* CUSTOMIZE HOME WIDGETS MODAL */}
      {customizeHomeOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div
            className="w-full max-w-md rounded-t-[28px] sm:rounded-3xl p-5 space-y-3.5 text-left transition-all max-h-[88dvh] flex flex-col pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)] sm:pb-5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
              boxShadow: "0 20px 50px var(--shadow-strength)",
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--glass-border)]">
              <div>
                <h3
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Kustomisasi Dashboard" : "Customize Dashboard"}
                </h3>
                <p
                  className="text-[11px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian
                    ? "Aktifkan atau nonaktifkan kartu Bento di Beranda"
                    : "Toggle Bento cards on your Home screen"}
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseCustomizeHome}
                className="w-7 h-7 rounded-full flex items-center justify-center glass-surface active:scale-90 cursor-pointer"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <X size={14} style={{ color: "var(--text-primary)" }} />
              </button>
            </div>

            {/* Quick Layout Preset Segment Control */}
            <div className="space-y-1.5 pt-0.5 pb-1">
              <div className="flex items-center justify-between px-1">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Preset Dashboard" : "Dashboard Presets"}
                </span>
                <span className="text-[10px] font-medium text-[var(--text-tertiary)] truncate max-w-[200px]">
                  {t(
                    `home.presets.${activePresetKey}Desc`,
                    HOME_PRESETS.find((p) => p.key === activePresetKey)
                      ?.description || "",
                  )}
                </span>
              </div>

              <div
                className="flex items-center p-1 rounded-full w-full"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.04)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {HOME_PRESETS.map((preset) => {
                  const isActive = activePresetKey === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        triggerHaptic("medium");
                        setActivePresetKey(preset.key);
                        applyPreset(preset.key);
                      }}
                      className={`flex-1 py-1.5 px-1 text-center rounded-full text-[12px] transition-all duration-200 cursor-pointer select-none ${
                        isActive
                          ? isDark
                            ? "bg-white text-zinc-950 font-semibold shadow-sm"
                            : "bg-black text-white font-semibold shadow-sm"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                      }`}
                    >
                      {t(`home.presets.${preset.key}`, preset.label)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grouped Feature Rows for All Dashboard Cards */}
            <div className="space-y-2 flex-1 min-h-0 overflow-y-auto no-scrollbar pr-0.5">
              {widgets.map((w: any) => {
                const isEnabled = w.isVisible;
                const locMeta = getLocalizedWidgetMeta(
                  w.id,
                  isIndonesian,
                  w.title,
                  w.subtitle,
                );
                return (
                  <div
                    key={w.id}
                    onClick={() => toggleCardVisibility(w.id)}
                    className="flex items-center justify-between p-3.5 rounded-2xl cursor-pointer active:scale-[0.99] transition-all duration-200 select-none"
                    style={{
                      background: isEnabled
                        ? isDark
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(0, 0, 0, 0.035)"
                        : "var(--glass-fill)",
                      border: isEnabled
                        ? isDark
                          ? "1px solid rgba(255, 255, 255, 0.14)"
                          : "1px solid rgba(0, 0, 0, 0.12)"
                        : "1px solid var(--glass-border)",
                      boxShadow: isEnabled
                        ? isDark
                          ? "0 4px 20px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
                          : "0 2px 10px rgba(0, 0, 0, 0.04)"
                        : "none",
                      opacity: isEnabled ? 1 : 0.6,
                    }}
                  >
                    <div className="min-w-0 pr-3 text-left">
                      <div className="flex items-center gap-2">
                        <p
                          className="text-[13px] font-semibold leading-snug"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {locMeta.title}
                        </p>
                        <span
                          className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
                          style={{
                            background: "var(--glass-fill)",
                            color: "var(--text-tertiary)",
                            border: "1px solid var(--glass-border)",
                          }}
                        >
                          {w.size}
                        </span>
                      </div>
                      <p
                        className="text-[11px] leading-relaxed mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {locMeta.subtitle}
                      </p>
                    </div>
                    <div
                      className="shrink-0 ml-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ToggleSwitch
                        checked={isEnabled}
                        onChange={() => toggleCardVisibility(w.id)}
                        size="sm"
                        ariaLabel={
                          isIndonesian
                            ? `Alihkan ${locMeta.title}`
                            : `Toggle ${locMeta.title}`
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  resetLayout();
                }}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold glass-surface active:scale-95 transition-transform cursor-pointer"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                {isIndonesian ? "Atur Ulang Bawaan" : "Reset Defaults"}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onCloseCustomizeHome();
                }}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold active:scale-95 transition-transform cursor-pointer"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-base)",
                }}
              >
                {isIndonesian ? "Selesai" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating iOS Springboard Customization Pill */}
      <WidgetCustomizationBar
        isEditMode={isEditMode}
        onDone={() => setIsEditMode(false)}
        onReset={resetLayout}
        hiddenCards={hiddenCards}
        onUnhideCard={toggleCardVisibility}
        activeCardsCount={widgets.filter((w) => w.isVisible).length}
      />

      {/* Profile Sheet */}
      {profileSheetOpen && (
        <Suspense fallback={null}>
          <ProfileSheet
            isOpen={profileSheetOpen}
            onClose={onCloseProfileSheet}
            avatarUrl={avatarUrl}
            setAvatarUrl={(url) => setCustomAvatarUrl(url)}
            displayName={displayName}
            setDisplayName={(name) => setCustomDisplayName(name)}
            onOpenDeleteAccount={onOpenDeleteAccount}
          />
        </Suspense>
      )}

      {webDashboardOpen && (
        <Suspense fallback={null}>
          <WebDashboardLinkModal
            isOpen={webDashboardOpen}
            onClose={onCloseWebDashboard}
          />
        </Suspense>
      )}
    </>
  );
}
