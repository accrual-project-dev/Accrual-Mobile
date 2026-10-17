import { Bell, CheckCircle2, Clock, Plus, Settings2 } from "lucide-react";
import { format, parseISO, type Locale } from "date-fns";
import { DetectedRecurringSection } from "./DetectedRecurringSection";
import { getBillDueStatusLabel } from "../../hooks/useBills";
import { triggerHaptic } from "../../lib/haptics";
import type { Bill } from "../../lib/types";
import type { DetectedRecurringItem } from "../../lib/financialMath";

interface CalendarUpcomingBillsSectionProps {
  bills: Bill[];
  detectedRecurringItems: DetectedRecurringItem[];
  confirmingRecurringId: string | null;
  onConfirmRecurring: (item: DetectedRecurringItem) => void;
  onIgnoreRecurring: (item: DetectedRecurringItem) => void;
  onPayBill: (bill: Bill) => void;
  onOpenManageBills: () => void;
  onOpenReminderSettings: () => void;
  isIndonesian: boolean;
  dateLocale?: Locale;
  displayCurrency?: (val: number) => string;
  displayRupiah?: (val: number) => string;
}

export function CalendarUpcomingBillsSection({
  bills,
  detectedRecurringItems,
  confirmingRecurringId,
  onConfirmRecurring,
  onIgnoreRecurring,
  onPayBill,
  onOpenManageBills,
  onOpenReminderSettings,
  isIndonesian,
  dateLocale,
  displayCurrency,
  displayRupiah,
}: CalendarUpcomingBillsSectionProps) {
  const formatAmount = displayCurrency || displayRupiah || ((v: number) => String(v));
  const unpaidBills = bills.filter((b) => !b.is_paid);
  const paidBillsCount = bills.filter((b) => b.is_paid).length;

  return (
    <section className="space-y-4">
      {/* Detected Recurring Patterns from Historical Transactions */}
      {detectedRecurringItems.length > 0 && (
        <DetectedRecurringSection
          items={detectedRecurringItems}
          confirmingId={confirmingRecurringId}
          onConfirm={onConfirmRecurring}
          onIgnore={onIgnoreRecurring}
        />
      )}

      {/* Subscription & Recurring Bill Tracker */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 gap-2">
          <div className="min-w-0">
            <p
              className="text-[13px] font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian
                ? "Tagihan & Langganan Rutin"
                : "Subscriptions & Recurring Bills"}
            </p>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? `${unpaidBills.length} tertunda · ${paidBillsCount} lunas`
                : `${unpaidBills.length} pending · ${paidBillsCount} paid`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenReminderSettings();
              }}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold glass-surface flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              style={{
                border: "1px solid var(--glass-border)",
                color: "var(--text-secondary)",
              }}
              title={
                isIndonesian ? "Pengaturan Pengingat" : "Reminder Settings"
              }
            >
              <Clock size={12} strokeWidth={1.75} />
              <span>{isIndonesian ? "Pengingat" : "Alerts"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenManageBills();
              }}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold glass-surface flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              style={{
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
              title={isIndonesian ? "Kelola Tagihan" : "Manage Bills"}
            >
              <Settings2 size={12} strokeWidth={1.75} />
              <span>{isIndonesian ? "Kelola" : "Manage"}</span>
            </button>
          </div>
        </div>

        {unpaidBills.length > 0 ? (
          <div className="space-y-2">
            {unpaidBills.slice(0, 6).map((b) => {
              const dueStatus = getBillDueStatusLabel(
                b.due_date,
                isIndonesian,
              );
              const formattedDue = (() => {
                try {
                  return format(parseISO(b.due_date), "dd MMM yyyy", {
                    locale: dateLocale,
                  });
                } catch {
                  return b.due_date;
                }
              })();

              return (
                <div
                  key={b.id}
                  className="glass-surface flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl transition-all"
                  style={{ border: "1px solid var(--glass-border)" }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: "var(--glass-fill)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <Bell size={14} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[13px] font-semibold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {b.title}
                      </p>
                      <p
                        className="text-[11px] truncate"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {formattedDue} · {dueStatus}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {b.amount && (
                      <span
                        className="amount text-[13px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatAmount(Number(b.amount))}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        onPayBill(b);
                      }}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-semibold active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                      style={{
                        background: "var(--text-primary)",
                        color: "var(--bg-base)",
                      }}
                    >
                      <CheckCircle2 size={12} strokeWidth={2} />
                      <span>{isIndonesian ? "Bayar" : "Pay"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="glass-surface p-4 rounded-2xl flex items-center justify-between gap-3"
            style={{ border: "1px solid var(--glass-border)" }}
          >
            <div className="min-w-0">
              <p
                className="text-[12.5px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {bills.length > 0
                  ? isIndonesian
                    ? "Seluruh tagihan terjadwal telah lunas"
                    : "All scheduled bills are settled"
                  : isIndonesian
                    ? "Belum ada tagihan rutin terdaftar"
                    : "No recurring bills registered yet"}
              </p>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Tambahkan langganan atau tagihan bulanan untuk proyeksi otomatis."
                  : "Add subscriptions or monthly bills for automated cashflow projection."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenManageBills();
              }}
              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-base)",
              }}
            >
              <Plus size={12} strokeWidth={2.2} />
              <span>{isIndonesian ? "Tambah" : "Add"}</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
