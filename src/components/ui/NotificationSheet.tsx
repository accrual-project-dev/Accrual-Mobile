import { BottomSheet } from "./BottomSheet";
import {
  Bell,
  CheckCircle2,
  Calendar,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useUpcomingBills, getBillDueStatusLabel } from "../../hooks/useBills";
import { format } from "date-fns";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { usePrivacy } from "../../contexts/PrivacyContext";
import { useSpace } from "../../contexts/SpaceContext";
import { useDraftTransactions } from "../../lib/draftTransactionService";
import { triggerHaptic } from "../../lib/haptics";
import {
  WEEKLY_DIGEST_ENABLED_KEY,
  MONTH_END_REVIEW_ENABLED_KEY,
  BUDGET_ALERTS_ENABLED_KEY,
  getWeeklyDigestDay,
  getWeeklyDigestTime,
  getMonthEndReviewTime,
} from "../../lib/notifications";

interface NotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationSheet({ isOpen, onClose }: NotificationSheetProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const { maskAmount } = usePrivacy();
  const { activeSpaceId, activeSpace, defaultSpaceId } = useSpace();
  const effectiveSpaceId =
    activeSpaceId && activeSpaceId !== "all"
      ? activeSpaceId
      : defaultSpaceId || "personal";
  const { items: draftItems } = useDraftTransactions(effectiveSpaceId);
  const upcomingBills = useUpcomingBills();

  const lastSyncedAt = localStorage.getItem("trouvaille_last_synced");
  const syncLabel = lastSyncedAt
    ? format(
        new Date(lastSyncedAt),
        isIndonesian ? "dd MMM yyyy, HH:mm" : "MMM dd, yyyy, HH:mm",
      )
    : null;

  const weeklyDigestEnabled =
    localStorage.getItem(WEEKLY_DIGEST_ENABLED_KEY) !== "false";
  const monthEndEnabled =
    localStorage.getItem(MONTH_END_REVIEW_ENABLED_KEY) !== "false";
  const budgetAlertsEnabled =
    localStorage.getItem(BUDGET_ALERTS_ENABLED_KEY) !== "false";

  const weeklyDay = getWeeklyDigestDay();
  const weeklyTime = getWeeklyDigestTime();
  const monthEndTime = getMonthEndReviewTime();

  const weeklyDayLabel = isIndonesian
    ? weeklyDay === "friday"
      ? "Jumat"
      : weeklyDay === "monday"
      ? "Senin"
      : "Minggu"
    : weeklyDay === "friday"
    ? "Fri"
    : weeklyDay === "monday"
    ? "Mon"
    : "Sun";

  const weeklyBadgeText = `${weeklyDayLabel} ${weeklyTime}`;
  const monthEndBadgeText = isIndonesian
    ? `Akhir Bulan ${monthEndTime}`
    : `Month-End ${monthEndTime}`;

  const actionableCount = draftItems.length + upcomingBills.length;

  const handleOpenDraftReview = () => {
    if (draftItems.length === 0) return;
    triggerHaptic("light");
    onClose();
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("trouvaille:open-draft-review", {
          detail: {
            items: draftItems,
            title: isIndonesian
              ? `Draft Transaksi · ${activeSpace?.name || "Space Aktif"}`
              : `Transaction Drafts · ${activeSpace?.name || "Active Space"}`,
          },
        }),
      );
    }, 120);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-5 pb-28 space-y-5">
        <div
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: "1px solid var(--glass-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: "var(--glass-fill-strong)",
                color: "var(--text-primary)",
              }}
            >
              <Bell size={16} strokeWidth={1.75} />
            </div>
            <div>
              <h3
                className="font-semibold text-[16px]"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? "Notifikasi & Pengingat"
                  : "Notifications & Alerts"}
              </h3>
              <p
                className="text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Pantau draft pintasan, tagihan, dan jadwal keuangan Anda"
                  : "Stay on top of shortcut drafts, bills, and schedules"}
              </p>
            </div>
          </div>
          <span
            className="text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{
              background: "var(--glass-fill)",
              color: "var(--text-secondary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {actionableCount > 0
              ? isIndonesian
                ? `${actionableCount} Perlu Tindakan`
                : `${actionableCount} Actionable`
              : isIndonesian
              ? "Semua Terkendali"
              : "All Clear"}
          </span>
        </div>

        {/* Pending Shortcut Drafts */}
        {draftItems.length > 0 && (
          <div className="space-y-2.5">
            <span
              className="text-[12px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Draft Pintasan Menunggu Tinjauan"
                : "Shortcut Drafts Pending Review"}
            </span>
            <button
              type="button"
              onClick={handleOpenDraftReview}
              className="w-full p-3.5 rounded-2xl flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.98] transition-all"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--glass-fill-strong)",
                    color: "var(--text-primary)",
                  }}
                >
                  <FileText size={15} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian
                      ? `${draftItems.length} Transaksi Siap Ditinjau`
                      : `${draftItems.length} Transactions Ready for Review`}
                  </p>
                  <p
                    className="text-[11px] truncate"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian
                      ? "Ketuk untuk mengedit dan mencatat ke transaksi"
                      : "Tap to edit and record into your transactions"}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={15}
                strokeWidth={2}
                style={{ color: "var(--text-tertiary)" }}
              />
            </button>
          </div>
        )}

        {/* Bill Reminders */}
        {upcomingBills.length > 0 && (
          <div className="space-y-2.5">
            <span
              className="text-[12px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Tagihan Mendatang" : "Upcoming Bills"}
            </span>
            {upcomingBills.map((bill: any) => {
              const dueStatusLabel = getBillDueStatusLabel(bill.due_date);
              return (
                <div
                  key={bill.id}
                  className="p-3.5 rounded-2xl flex items-start gap-3"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: "var(--glass-fill-strong)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Calendar size={15} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {bill.title}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {dueStatusLabel} ·{" "}
                      {maskAmount(formatWithPreferred(Number(bill.amount)))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Smart Insights & Automations */}
        <div className="space-y-2.5">
          <span
            className="text-[12px] font-semibold"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Pemberitahuan Otomatis" : "Automated Insights"}
          </span>

          <div
            className="p-3.5 rounded-2xl flex items-start gap-3"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: "var(--glass-fill-strong)",
                color: "var(--text-primary)",
              }}
            >
              <Sparkles size={15} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian
                    ? "Ringkasan Finansial Mingguan"
                    : "Weekly Financial Digest"}
                </p>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--glass-fill)",
                    color: weeklyDigestEnabled
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {weeklyDigestEnabled
                    ? weeklyBadgeText
                    : isIndonesian
                    ? "Nonaktif"
                    : "Disabled"}
                </span>
              </div>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Rangkuman total pengeluaran dan pemasukan selama sepekan secara otomatis."
                  : "Automatic recap of total expenses and cash inflow for the past week."}
              </p>
            </div>
          </div>

          <div
            className="p-3.5 rounded-2xl flex items-start gap-3"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: "var(--glass-fill-strong)",
                color: "var(--text-primary)",
              }}
            >
              <TrendingUp size={15} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian
                    ? "Evaluasi Kekayaan Akhir Bulan"
                    : "Month-End Wealth Review"}
                </p>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--glass-fill)",
                    color: monthEndEnabled
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {monthEndEnabled
                    ? monthEndBadgeText
                    : isIndonesian
                    ? "Nonaktif"
                    : "Disabled"}
                </span>
              </div>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Pemberitahuan kesiapan neraca keuangan dan arus kas saat bulan berganti."
                  : "Notification when your balance sheet and cash flow reports are finalized."}
              </p>
            </div>
          </div>

          <div
            className="p-3.5 rounded-2xl flex items-start gap-3"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: "var(--glass-fill-strong)",
                color: "var(--text-primary)",
              }}
            >
              <ShieldAlert size={15} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian
                    ? "Peringatan Ambang Anggaran"
                    : "Budget Threshold Alerts"}
                </p>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--glass-fill)",
                    color: budgetAlertsEnabled
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {budgetAlertsEnabled
                    ? "80% & 100%"
                    : isIndonesian
                    ? "Nonaktif"
                    : "Disabled"}
                </span>
              </div>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Peringatan proaktif instan saat alokasi anggaran kategori mendekati atau melewati batas."
                  : "Proactive instant alerts when category spending approaches or exceeds limit."}
              </p>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        <div className="space-y-2.5">
          <span
            className="text-[12px] font-semibold"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Status Sinkronisasi" : "Sync Status"}
          </span>

          <div
            className="p-3.5 rounded-2xl flex items-start gap-3"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: "var(--glass-fill-strong)",
                color: "var(--text-secondary)",
              }}
            >
              <CheckCircle2 size={15} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? "Sinkronisasi Cloud" : "Cloud Sync"}
              </p>
              <p
                className="text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {syncLabel
                  ? isIndonesian
                    ? `Terakhir disinkronkan pada ${syncLabel}.`
                    : `Last synchronized on ${syncLabel}.`
                  : isIndonesian
                  ? "Belum ada catatan waktu sinkronisasi."
                  : "No recorded sync timestamp yet."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
