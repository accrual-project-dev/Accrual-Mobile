import {
  ArrowUpCircle,
  ArrowDownCircle,
  Bell,
  CheckCircle2,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { format, type Locale } from "date-fns";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import { triggerHaptic } from "../../lib/haptics";
import type { CalendarDayForecast } from "../../lib/calendarForecasting";
import type { Bill, Transaction } from "../../lib/types";

interface CalendarDayDetailSheetProps {
  selectedDay: Date | null;
  selectedDayForecast: CalendarDayForecast | null;
  selectedDayTxs: Transaction[];
  bills: Bill[];
  onClose: () => void;
  onPayBill: (bill: Bill) => void;
  isIndonesian: boolean;
  dateLocale?: Locale;
  displayCurrency?: (val: number) => string;
  displayRupiah?: (val: number) => string;
}

export function CalendarDayDetailSheet({
  selectedDay,
  selectedDayForecast,
  selectedDayTxs,
  bills,
  onClose,
  onPayBill,
  isIndonesian,
  dateLocale,
  displayCurrency,
  displayRupiah,
}: CalendarDayDetailSheetProps) {
  const formatAmount = displayCurrency || displayRupiah || ((v: number) => String(v));
  return (
    <BottomSheet isOpen={!!selectedDay} onClose={onClose}>
      <div
        className="px-5"
        style={{
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom, 0px) + 16px), 28px)",
        }}
      >
        {selectedDay && selectedDayForecast && (
          <>
            {/* Sheet Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-[20px] font-semibold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {format(selectedDay, "EEEE, dd MMMM yyyy", {
                    locale: dateLocale,
                  })}
                </h2>
                <p
                  className="text-[12px] font-medium"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {selectedDayForecast.isToday
                    ? isIndonesian
                      ? "Hari Ini"
                      : "Today"
                    : selectedDayForecast.isFuture
                      ? isIndonesian
                        ? "Proyeksi Masa Depan"
                        : "Future Projection"
                      : isIndonesian
                        ? "Transaksi Lampau"
                        : "Past Transactions"}
                </p>
              </div>

              {/* No-Spend Day Celebration Badge */}
              {selectedDayForecast.isNoSpendDay && (
                <div
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <ShieldCheck size={12} />
                  {isIndonesian ? "Hari Bebas Belanja" : "No-Spend Day"}
                </div>
              )}
            </div>

            {/* Future Forecast Breakdown */}
            {selectedDayForecast.isFuture ? (
              <div className="space-y-4 mb-2">
                {/* Projected Closing Balance Card */}
                <div
                  className="glass-surface p-4 rounded-2xl"
                  style={{ border: "1px solid var(--glass-border)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian
                        ? "Proyeksi Saldo Likuid"
                        : "Projected Liquid Balance"}
                    </span>
                    {selectedDayForecast.isLowestDip && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--glass-fill)",
                          border: "1px solid var(--glass-border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {isIndonesian ? "Titik Terendah" : "Lowest Dip Floor"}
                      </span>
                    )}
                  </div>
                  <p
                    className="amount text-[22px] tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatAmount(selectedDayForecast.projectedBalance)}
                  </p>
                  <p
                    className="text-[11px] mt-1"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian
                      ? "Estimasi likuiditas berbasis tagihan terjadwal, pendapatan rutin, dan rata-rata pengeluaran harian."
                      : "Expected liquidity based on scheduled bills, recurring income, and daily burn."}
                  </p>
                </div>

                {/* Projected Inflows & Outflows for this day */}
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="glass-surface p-3.5 rounded-2xl"
                    style={{ border: "1px solid var(--glass-border)" }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowUpCircle
                        size={14}
                        style={{ color: "var(--text-secondary)" }}
                      />
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {isIndonesian
                          ? "Pemasukan Diharapkan"
                          : "Expected Inflow"}
                      </span>
                    </div>
                    <p
                      className="amount text-[16px] font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatAmount(selectedDayForecast.expectedInflowsTotal)}
                    </p>
                  </div>

                  <div
                    className="glass-surface p-3.5 rounded-2xl"
                    style={{ border: "1px solid var(--glass-border)" }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowDownCircle
                        size={14}
                        style={{ color: "var(--text-tertiary)" }}
                      />
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {isIndonesian
                          ? "Tagihan & Estimasi Beban"
                          : "Bills & Est. Burn"}
                      </span>
                    </div>
                    <p
                      className="amount text-[16px] font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatAmount(
                        selectedDayForecast.billsTotal +
                          selectedDayForecast.estimatedBurn,
                      )}
                    </p>
                  </div>
                </div>

                {/* Scheduled Bills for this specific future date */}
                {selectedDayForecast.scheduledBills.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p
                      className="text-[12px] font-semibold px-1"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian
                        ? "Kewajiban Terjadwal"
                        : "Scheduled Obligations"}
                    </p>
                    {selectedDayForecast.scheduledBills.map((b) => (
                      <div
                        key={b.id}
                        className="glass-surface p-3.5 rounded-2xl flex items-center justify-between"
                        style={{ border: "1px solid var(--glass-border)" }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{
                              background: "var(--bg-elevated)",
                              border: "1px solid var(--glass-border)",
                            }}
                          >
                            <Bell size={14} />
                          </div>
                          <div>
                            <p
                              className="text-[13px] font-semibold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {b.title}
                            </p>
                            <span
                              className="text-[11px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {b.isPaid
                                ? isIndonesian
                                  ? "Lunas"
                                  : "Paid"
                                : isIndonesian
                                  ? "Jatuh Tempo"
                                  : "Due"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className="text-[13px] font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {formatAmount(b.amount)}
                          </span>
                          {!b.isPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                const originalBill = bills.find(
                                  (item) => item.id === b.id,
                                );
                                if (originalBill) {
                                  onPayBill(originalBill);
                                  triggerHaptic("light");
                                }
                              }}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold glass-surface active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              style={{
                                border: "1px solid var(--glass-border)",
                                color: "var(--text-primary)",
                              }}
                            >
                              <CheckCircle2 size={12} strokeWidth={2} />
                              {isIndonesian ? "Bayar" : "Pay"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expected Inflows (e.g. Salary / Payday) */}
                {selectedDayForecast.expectedInflows.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p
                      className="text-[12px] font-semibold px-1"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian
                        ? "Pemasukan Pendapatan Diharapkan"
                        : "Expected Income Inflow"}
                    </p>
                    {selectedDayForecast.expectedInflows.map((inf, idx) => (
                      <div
                        key={idx}
                        className="glass-surface p-3.5 rounded-2xl flex items-center justify-between"
                        style={{ border: "1px solid var(--glass-border)" }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-primary)]"
                            style={{
                              background: "var(--glass-fill)",
                              border: "1px solid var(--glass-border)",
                            }}
                          >
                            <Coins size={14} />
                          </div>
                          <div>
                            <p
                              className="text-[13px] font-semibold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {inf.title}
                            </p>
                            <span className="text-[11px] text-[var(--text-secondary)] font-semibold">
                              {isIndonesian
                                ? "Jadwal Gajian"
                                : "Scheduled Payday"}
                            </span>
                          </div>
                        </div>
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                          +{formatAmount(inf.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Past Days & Today Actual Cashflow */
              <>
                <div className="flex gap-3 mb-5">
                  <div
                    className="flex-1 glass-surface p-4 rounded-2xl"
                    style={{ border: "1px solid var(--glass-border)" }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <ArrowUpCircle
                        size={14}
                        style={{ color: "var(--text-primary)" }}
                      />
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {isIndonesian ? "Pemasukan" : "Inflow"}
                      </p>
                    </div>
                    <p
                      className="amount text-[17px] font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatAmount(selectedDayForecast.actualInflow)}
                    </p>
                  </div>

                  <div
                    className="flex-1 glass-surface p-4 rounded-2xl"
                    style={{ border: "1px solid var(--glass-border)" }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <ArrowDownCircle
                        size={14}
                        style={{ color: "var(--text-tertiary)" }}
                      />
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {isIndonesian ? "Pengeluaran" : "Outflow"}
                      </p>
                    </div>
                    <p
                      className="amount text-[17px] font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatAmount(selectedDayForecast.actualOutflow)}
                    </p>
                  </div>
                </div>

                {/* Scheduled Obligations for Today */}
                {selectedDayForecast.scheduledBills.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p
                      className="text-[12px] font-semibold px-1"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian
                        ? "Tagihan Hari Ini"
                        : "Today's Scheduled Bills"}
                    </p>
                    {selectedDayForecast.scheduledBills.map((b) => (
                      <div
                        key={b.id}
                        className="glass-surface p-3.5 rounded-2xl flex items-center justify-between"
                        style={{ border: "1px solid var(--glass-border)" }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{
                              background: "var(--bg-elevated)",
                              border: "1px solid var(--glass-border)",
                            }}
                          >
                            <Bell size={14} />
                          </div>
                          <div>
                            <p
                              className="text-[13px] font-semibold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {b.title}
                            </p>
                            <span
                              className="text-[11px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {b.isPaid
                                ? isIndonesian
                                  ? "Lunas"
                                  : "Paid"
                                : isIndonesian
                                  ? "Jatuh Tempo Hari Ini"
                                  : "Due Today"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className="text-[13px] font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {formatAmount(b.amount)}
                          </span>
                          {!b.isPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                const originalBill = bills.find(
                                  (item) => item.id === b.id,
                                );
                                if (originalBill) {
                                  onPayBill(originalBill);
                                  triggerHaptic("light");
                                }
                              }}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold glass-surface active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              style={{
                                border: "1px solid var(--glass-border)",
                                color: "var(--text-primary)",
                              }}
                            >
                              <CheckCircle2 size={12} strokeWidth={2} />
                              {isIndonesian ? "Bayar" : "Pay"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Transactions List */}
                <div className="space-y-2">
                  {selectedDayTxs.length === 0 ? (
                    <div
                      className="glass-surface p-6 text-center rounded-2xl"
                      style={{ border: "1px solid var(--glass-border)" }}
                    >
                      <p
                        className="text-[13px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {selectedDayForecast.isNoSpendDay
                          ? isIndonesian
                            ? "Hari bebas belanja! Tidak ada pengeluaran tercatat."
                            : "Zero spend day! No expenses recorded."
                          : isIndonesian
                            ? "Tidak ada transaksi pada tanggal ini."
                            : "No transactions on this date."}
                      </p>
                    </div>
                  ) : (
                    selectedDayTxs.map((tx) => (
                      <div
                        key={tx.id}
                        className="glass-surface px-4 py-3 flex items-center gap-3 rounded-2xl"
                        style={{ border: "1px solid var(--glass-border)" }}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                          style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--glass-border)",
                          }}
                        >
                          <IconRenderer icon={tx.categories?.emoji ?? "??"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[14px] font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {tx.categories?.name ??
                              (isIndonesian ? "Umum" : "General")}
                          </p>
                          {tx.note && (
                            <p
                              className="text-[11px] truncate"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {tx.note}
                            </p>
                          )}
                        </div>
                        <span
                          className="amount text-[14px] font-semibold"
                          style={{
                            color:
                              tx.type === "income"
                                ? "var(--accent)"
                                : "var(--text-primary)",
                          }}
                        >
                          {tx.type === "income" ? "+" : "-"}
                          {formatAmount(Number(tx.amount))}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
