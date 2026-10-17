import { motion, AnimatePresence } from "framer-motion";
import { TrendingDown, Coins, ShieldCheck } from "lucide-react";
import { format, parseISO, type Locale } from "date-fns";
import type { MonthRunwayTelemetry } from "../../lib/calendarForecasting";

interface CalendarRunwayBentoProps {
  viewMode: "activity" | "runway";
  runwayTelemetry: MonthRunwayTelemetry;
  isIndonesian: boolean;
  dateLocale?: Locale;
  displayCurrency?: (val: number) => string;
  displayRupiah?: (val: number) => string;
}

export function CalendarRunwayBento({
  viewMode,
  runwayTelemetry,
  isIndonesian,
  dateLocale,
  displayCurrency,
  displayRupiah,
}: CalendarRunwayBentoProps) {
  const formatAmount = displayCurrency || displayRupiah || ((v: number) => String(v));
  return (
    <AnimatePresence>
      {viewMode === "runway" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="overflow-hidden"
        >
          <div className="grid grid-cols-3 gap-2.5">
            {/* Card 1: Runway Floor / Lowest Dip */}
            <div
              className="glass-surface p-3.5 rounded-2xl flex flex-col justify-between"
              style={{ border: "1px solid var(--glass-border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Titik Terendah" : "Runway Floor"}
                </span>
                <TrendingDown
                  size={13}
                  style={{ color: "var(--text-secondary)" }}
                />
              </div>
              <div>
                <p
                  className="text-[14px] font-semibold tracking-tight truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatAmount(runwayTelemetry.lowestDipAmount)}
                </p>
                <p
                  className="text-[10px] mt-0.5 truncate"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {runwayTelemetry.lowestDipDate
                    ? isIndonesian
                      ? `Terendah ${format(parseISO(runwayTelemetry.lowestDipDate), "dd MMM", { locale: dateLocale })}`
                      : `Dip on ${format(parseISO(runwayTelemetry.lowestDipDate), "dd MMM")}`
                    : isIndonesian
                      ? "Likuiditas stabil"
                      : "Stable runway"}
                </p>
              </div>
            </div>

            {/* Card 2: Payday Horizon */}
            <div
              className="glass-surface p-3.5 rounded-2xl flex flex-col justify-between"
              style={{ border: "1px solid var(--glass-border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Horizon Gajian" : "Payday Horizon"}
                </span>
                <Coins size={13} style={{ color: "var(--text-secondary)" }} />
              </div>
              <div>
                <p
                  className="text-[14px] font-semibold tracking-tight truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {runwayTelemetry.daysUntilPayday !== null
                    ? runwayTelemetry.daysUntilPayday === 0
                      ? isIndonesian
                        ? "Gajian Hari Ini"
                        : "Payday Today"
                      : isIndonesian
                        ? `${runwayTelemetry.daysUntilPayday} hr ke Gajian`
                        : `${runwayTelemetry.daysUntilPayday}d to Payday`
                    : isIndonesian
                      ? "Tanpa Jadwal Gajian"
                      : "No Payday"}
                </p>
                <p
                  className="text-[10px] mt-0.5 truncate"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {runwayTelemetry.nextPaydayAmount > 0
                    ? `+${formatAmount(runwayTelemetry.nextPaydayAmount)}`
                    : isIndonesian
                      ? "Cek transaksi rutin"
                      : "Check recurring"}
                </p>
              </div>
            </div>

            {/* Card 3: No-Spend Days */}
            <div
              className="glass-surface p-3.5 rounded-2xl flex flex-col justify-between"
              style={{ border: "1px solid var(--glass-border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Hari Bebas Belanja" : "No-Spend Days"}
                </span>
                <ShieldCheck
                  size={13}
                  style={{ color: "var(--text-secondary)" }}
                />
              </div>
              <div>
                <p
                  className="text-[14px] font-semibold tracking-tight truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {runwayTelemetry.noSpendDaysCount}{" "}
                  {isIndonesian ? "Hari" : "Days"}
                </p>
                <p
                  className="text-[10px] mt-0.5 truncate"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {runwayTelemetry.noSpendRatioPct}%{" "}
                  {isIndonesian ? "hari berjalan" : "of elapsed days"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
