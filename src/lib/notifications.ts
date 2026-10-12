import { LocalNotifications } from '@capacitor/local-notifications'
import type { Bill, Category, Transaction, DebtReceivableRecord } from './types'
import { parseISO, subDays, endOfMonth, addMonths, startOfMonth, format } from 'date-fns'
import { formatRupiah } from './utils'

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const status = await LocalNotifications.checkPermissions()
    if (status.display === 'granted') return true
    const res = await LocalNotifications.requestPermissions()
    return res.display === 'granted'
  } catch (e) {
    console.warn('LocalNotifications not supported on this platform:', e)
    return false
  }
}

export async function cancelAllBillNotifications(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch (e) {
    console.warn('Failed to cancel bill notifications:', e)
  }
}

export const BILL_REMINDER_LEAD_DAYS_KEY = "trouvaille_bill_reminder_lead_days";

export function getBillReminderLeadDays(): number {
  try {
    const val = localStorage.getItem(BILL_REMINDER_LEAD_DAYS_KEY);
    return val !== null ? parseInt(val, 10) : 1; // default 1 day before
  } catch {
    return 1;
  }
}

export function setBillReminderLeadDays(days: number): void {
  try {
    localStorage.setItem(BILL_REMINDER_LEAD_DAYS_KEY, String(days));
  } catch (e) {
    console.warn("Failed to set bill reminder lead days:", e);
  }
}

export async function syncBillNotifications(
  bills: Bill[],
  isIndonesian: boolean = true,
): Promise<void> {
  try {
    // Check if user disabled bill reminders in settings
    if (localStorage.getItem("trouvaille_bill_reminders_enabled") === "false") {
      await cancelAllBillNotifications();
      return;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Cancel previously scheduled bill notifications
    await cancelAllBillNotifications();

    const notificationsToSchedule = [];
    const now = new Date();
    const leadDays = getBillReminderLeadDays();

    for (let i = 0; i < bills.length; i++) {
      const bill = bills[i];
      if (bill.is_paid) continue;

      const dueDate = parseISO(bill.due_date);
      if (isNaN(dueDate.getTime())) continue;

      const amtFormatted = bill.amount
        ? "Rp " + Number(bill.amount).toLocaleString("id-ID")
        : "";

      // 1. Advance notification (if leadDays > 0)
      if (leadDays > 0) {
        const advanceDate = subDays(dueDate, leadDays);
        advanceDate.setHours(9, 0, 0, 0);
        if (advanceDate > now) {
          const leadTitle = isIndonesian
            ? leadDays === 1
              ? `Pengingat Tagihan Besok: ${bill.title}`
              : `Pengingat Tagihan H-${leadDays}: ${bill.title}`
            : leadDays === 1
              ? `Upcoming Bill Tomorrow: ${bill.title}`
              : `Upcoming Bill in ${leadDays} Days: ${bill.title}`;

          const leadBody = isIndonesian
            ? `Tagihan ${bill.title} (${amtFormatted}) jatuh tempo ${leadDays === 1 ? "besok" : `${leadDays} hari lagi`}.`
            : `Bill ${bill.title} (${amtFormatted}) is due in ${leadDays} day${leadDays > 1 ? "s" : ""}!`;

          notificationsToSchedule.push({
            id: i * 2 + 1,
            title: leadTitle,
            body: leadBody,
            schedule: { at: advanceDate },
            sound: "default",
          });
        }
      }

      // 2. Notification on the Due Date at 09:00 AM
      const onDueDate = parseISO(bill.due_date);
      onDueDate.setHours(9, 0, 0, 0);
      if (onDueDate > now) {
        const dueTitle = isIndonesian
          ? `Tagihan Jatuh Tempo Hari Ini: ${bill.title}`
          : `Bill Due Today: ${bill.title}`;

        const dueBody = isIndonesian
          ? `Ingat untuk melunasi tagihan ${bill.title} (${amtFormatted}) hari ini.`
          : `Remember to pay ${bill.title} (${amtFormatted}) today.`;

        notificationsToSchedule.push({
          id: i * 2 + 2,
          title: dueTitle,
          body: dueBody,
          schedule: { at: onDueDate },
          sound: "default",
        });
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      });
    }
  } catch (e) {
    console.warn("Failed to sync bill notifications:", e);
  }
}

export const DAILY_REMINDER_NOTIFICATION_ID = 99999;
export const DAILY_REMINDER_TIME_KEY = "trouvaille_daily_reminder_time";

export function getDailyStreakReminderTime(): string {
  try {
    return localStorage.getItem(DAILY_REMINDER_TIME_KEY) || "20:00";
  } catch {
    return "20:00";
  }
}

export function setDailyStreakReminderTime(timeStr: string): void {
  try {
    localStorage.setItem(DAILY_REMINDER_TIME_KEY, timeStr);
  } catch (e) {
    console.warn("Failed to set daily streak reminder time:", e);
  }
}

export async function cancelDailyStreakReminder(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    const exists = pending.notifications.some(
      (n) => n.id === DAILY_REMINDER_NOTIFICATION_ID,
    );
    if (exists) {
      await LocalNotifications.cancel({
        notifications: [{ id: DAILY_REMINDER_NOTIFICATION_ID }],
      });
    }
  } catch (e) {
    console.warn("Failed to cancel daily streak reminder:", e);
  }
}

export async function syncDailyStreakReminder(
  hasLoggedToday: boolean = false,
): Promise<void> {
  try {
    // Check if user disabled daily streak reminders in settings (default true)
    if (localStorage.getItem("trouvaille_daily_reminder_enabled") === "false") {
      await cancelDailyStreakReminder();
      return;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Parse customized reminder hour and minute (defaults to 20:00)
    const timeStr = getDailyStreakReminderTime();
    const [hStr, mStr] = timeStr.split(":");
    const hour = parseInt(hStr, 10) || 20;
    const minute = parseInt(mStr, 10) || 0;

    await cancelDailyStreakReminder();

    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    // If already logged today or if time has already passed today, start from tomorrow
    if (hasLoggedToday || scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_REMINDER_NOTIFICATION_ID,
          title: "Maintain Your Financial Streak",
          body: "No transactions recorded today. Log your expenses now to keep your consistency streak active!",
          schedule: {
            at: scheduledTime,
            every: "day",
            allowWhileIdle: true,
          },
          sound: "default",
        },
      ],
    });
  } catch (e) {
    console.warn("Failed to sync daily streak reminder:", e);
  }
}

/**
 * Triggers an immediate native local notification on device (Lock Screen, Notification Center, Banner).
 * Used when Apple Shortcuts automations (Bank notification reader, Back Tap receipt scanner, Dialog input) complete.
 */
export async function showNativeLocalNotification({
  title,
  body,
  id,
}: {
  title: string;
  body: string;
  id?: number;
}): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const notifId = id || Math.floor(Math.random() * 800000) + 100000;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          sound: "default",
        },
      ],
    });
  } catch (e) {
    console.warn("Failed to fire native local notification:", e);
  }
}

export const WEEKLY_DIGEST_NOTIFICATION_ID = 88888;
export const WEEKLY_DIGEST_ENABLED_KEY = "trouvaille_weekly_digest_enabled";
export const WEEKLY_DIGEST_DAY_KEY = "trouvaille_weekly_digest_day";
export const WEEKLY_DIGEST_TIME_KEY = "trouvaille_weekly_digest_time";

export type DigestDay = "sunday" | "friday" | "monday";

export function getWeeklyDigestDay(): DigestDay {
  try {
    const val = localStorage.getItem(WEEKLY_DIGEST_DAY_KEY);
    if (val === "friday" || val === "monday" || val === "sunday") return val;
    return "sunday";
  } catch {
    return "sunday";
  }
}

export function setWeeklyDigestDay(day: DigestDay): void {
  try {
    localStorage.setItem(WEEKLY_DIGEST_DAY_KEY, day);
  } catch (e) {
    console.warn("Failed to set weekly digest day:", e);
  }
}

export function getWeeklyDigestTime(): string {
  try {
    return localStorage.getItem(WEEKLY_DIGEST_TIME_KEY) || "19:30";
  } catch {
    return "19:30";
  }
}

export function setWeeklyDigestTime(timeStr: string): void {
  try {
    localStorage.setItem(WEEKLY_DIGEST_TIME_KEY, timeStr);
  } catch (e) {
    console.warn("Failed to set weekly digest time:", e);
  }
}

export async function cancelWeeklyDigestNotification(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    const exists = pending.notifications.some(
      (n) => n.id === WEEKLY_DIGEST_NOTIFICATION_ID,
    );
    if (exists) {
      await LocalNotifications.cancel({
        notifications: [{ id: WEEKLY_DIGEST_NOTIFICATION_ID }],
      });
    }
  } catch (e) {
    console.warn("Failed to cancel weekly digest notification:", e);
  }
}

export async function syncWeeklyDigestNotification(
  transactions: Transaction[] = [],
  isIndonesian: boolean = true,
): Promise<void> {
  try {
    if (localStorage.getItem(WEEKLY_DIGEST_ENABLED_KEY) === "false") {
      await cancelWeeklyDigestNotification();
      return;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return;

    await cancelWeeklyDigestNotification();

    const selectedDay = getWeeklyDigestDay();
    const targetDayIndex = selectedDay === "friday" ? 5 : selectedDay === "monday" ? 1 : 0; // 0 = Sunday

    const timeStr = getWeeklyDigestTime();
    const [hStr, mStr] = timeStr.split(":");
    const hour = parseInt(hStr, 10) || 19;
    const minute = parseInt(mStr, 10) || 30;

    const now = new Date();
    const nextTargetDate = new Date();
    const currentDay = now.getDay();
    const daysUntilTarget = (targetDayIndex - currentDay + 7) % 7;

    nextTargetDate.setDate(now.getDate() + daysUntilTarget);
    nextTargetDate.setHours(hour, minute, 0, 0);

    // If today is the target day and the time has already passed, schedule for next week
    if (nextTargetDate <= now) {
      nextTargetDate.setDate(nextTargetDate.getDate() + 7);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    const weekExpense = transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          (t.occurred_on || t.created_at || "").slice(0, 10) >= sevenDaysAgo,
      )
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const spendText = weekExpense > 0 ? formatRupiah(weekExpense) : "Rp 0";
    const notifTitle = isIndonesian
      ? "Rekap Finansial Mingguan"
      : "Weekly Financial Digest";
    const notifBody = isIndonesian
      ? `Pengeluaran 7 hari terakhir: ${spendText}. Ketuk untuk evaluasi performa dan alokasi kas Anda.`
      : `Total spend over the last 7 days: ${spendText}. Tap to review your performance.`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: WEEKLY_DIGEST_NOTIFICATION_ID,
          title: notifTitle,
          body: notifBody,
          schedule: {
            at: nextTargetDate,
            every: "week",
            allowWhileIdle: true,
          },
          sound: "default",
        },
      ],
    });
  } catch (e) {
    console.warn("Failed to sync weekly digest notification:", e);
  }
}

export const MONTH_END_NOTIFICATION_ID = 77777;
export const MONTH_END_REVIEW_ENABLED_KEY = "trouvaille_month_end_review_enabled";
export const MONTH_END_REVIEW_TIME_KEY = "trouvaille_month_end_review_time";

export function getMonthEndReviewTime(): string {
  try {
    return localStorage.getItem(MONTH_END_REVIEW_TIME_KEY) || "20:00";
  } catch {
    return "20:00";
  }
}

export function setMonthEndReviewTime(timeStr: string): void {
  try {
    localStorage.setItem(MONTH_END_REVIEW_TIME_KEY, timeStr);
  } catch (e) {
    console.warn("Failed to set month-end review time:", e);
  }
}

export async function cancelMonthEndReviewNotification(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    const exists = pending.notifications.some(
      (n) => n.id === MONTH_END_NOTIFICATION_ID,
    );
    if (exists) {
      await LocalNotifications.cancel({
        notifications: [{ id: MONTH_END_NOTIFICATION_ID }],
      });
    }
  } catch (e) {
    console.warn("Failed to cancel month-end review notification:", e);
  }
}

export async function syncMonthEndReviewNotification(
  isIndonesian: boolean = true,
): Promise<void> {
  try {
    if (localStorage.getItem(MONTH_END_REVIEW_ENABLED_KEY) === "false") {
      await cancelMonthEndReviewNotification();
      return;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return;

    await cancelMonthEndReviewNotification();

    const timeStr = getMonthEndReviewTime();
    const [hStr, mStr] = timeStr.split(":");
    const hour = parseInt(hStr, 10) || 20;
    const minute = parseInt(mStr, 10) || 0;

    const now = new Date();
    let targetDate = endOfMonth(now);
    targetDate.setHours(hour, minute, 0, 0);

    if (targetDate <= now) {
      targetDate = endOfMonth(addMonths(now, 1));
      targetDate.setHours(hour, minute, 0, 0);
    }

    const notifTitle = isIndonesian
      ? "Evaluasi Akhir Bulan Siap"
      : "Month-End Wealth Review";
    const notifBody = isIndonesian
      ? "Bulan ini telah berakhir. Neraca Keuangan dan Laporan Arus Kas Anda siap ditinjau."
      : "This month has concluded. Your Balance Sheet and Cash Flow reports are ready.";

    await LocalNotifications.schedule({
      notifications: [
        {
          id: MONTH_END_NOTIFICATION_ID,
          title: notifTitle,
          body: notifBody,
          schedule: {
            at: targetDate,
            allowWhileIdle: true,
          },
          sound: "default",
        },
      ],
    });
  } catch (e) {
    console.warn("Failed to sync month-end review notification:", e);
  }
}

export const BUDGET_ALERTS_ENABLED_KEY = "trouvaille_budget_alerts_enabled";

export async function checkBudgetThresholdAlerts(
  transactions: Transaction[],
  categories: Category[],
  isIndonesian: boolean = true,
): Promise<void> {
  try {
    if (localStorage.getItem(BUDGET_ALERTS_ENABLED_KEY) === "false") return;

    const monthKey = format(new Date(), "yyyy-MM");
    const storageKey = `trouvaille_budget_alert_history_${monthKey}`;
    let alertHistory: Record<string, { reached80?: boolean; reached100?: boolean }> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) alertHistory = JSON.parse(raw);
    } catch {}

    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const currentMonthExpenses = transactions.filter(
      (t) => t.type === "expense" && (t.occurred_on || t.created_at || "").slice(0, 10) >= monthStart,
    );

    const spendByCategory: Record<string, number> = {};
    currentMonthExpenses.forEach((t) => {
      if (t.category_id) {
        spendByCategory[t.category_id] = (spendByCategory[t.category_id] || 0) + Number(t.amount || 0);
      }
    });

    let updated = false;

    for (const cat of categories) {
      if (!cat.budget_amount || cat.budget_amount <= 0) continue;
      const spent = spendByCategory[cat.id] || 0;
      const pct = (spent / cat.budget_amount) * 100;
      const catRecord = alertHistory[cat.id] || {};

      if (pct >= 100 && !catRecord.reached100) {
        catRecord.reached100 = true;
        catRecord.reached80 = true;
        alertHistory[cat.id] = catRecord;
        updated = true;

        const title = isIndonesian ? `Batas Anggaran Tercapai: ${cat.name}` : `Budget Exceeded: ${cat.name}`;
        const body = isIndonesian
          ? `Pengeluaran telah mencapai 100% (${formatRupiah(spent)} dari anggaran ${formatRupiah(cat.budget_amount)}).`
          : `Spending reached 100% (${formatRupiah(spent)} of ${formatRupiah(cat.budget_amount)} budget).`;

        await showNativeLocalNotification({ title, body });
      } else if (pct >= 80 && !catRecord.reached80 && !catRecord.reached100) {
        catRecord.reached80 = true;
        alertHistory[cat.id] = catRecord;
        updated = true;

        const title = isIndonesian ? `Peringatan Anggaran (80%): ${cat.name}` : `Budget Alert (80%): ${cat.name}`;
        const body = isIndonesian
          ? `Pengeluaran mencapai ${Math.round(pct)}% (${formatRupiah(spent)} dari anggaran ${formatRupiah(cat.budget_amount)}). Sisa: ${formatRupiah(cat.budget_amount - spent)}.`
          : `Spending reached ${Math.round(pct)}% (${formatRupiah(spent)} of ${formatRupiah(cat.budget_amount)}). Remaining: ${formatRupiah(cat.budget_amount - spent)}.`;

        await showNativeLocalNotification({ title, body });
      }
    }

    if (updated) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(alertHistory));
      } catch {}
    }
  } catch (e) {
    console.warn("Failed to check budget threshold alerts:", e);
  }
}

export const DEBT_NOTIFICATION_BASE_ID = 50000;

export async function cancelDebtReceivableNotifications(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications.filter(
      (n) => n.id >= DEBT_NOTIFICATION_BASE_ID && n.id < DEBT_NOTIFICATION_BASE_ID + 10000,
    );
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }
  } catch (e) {
    console.warn("Failed to cancel debt notifications:", e);
  }
}

export async function syncDebtReceivableNotifications(
  records: DebtReceivableRecord[],
  isIndonesian: boolean = true,
): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await cancelDebtReceivableNotifications();

    const notificationsToSchedule = [];
    const now = new Date();

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (record.status === "settled" || !record.dueDate) continue;

      const dueDate = parseISO(record.dueDate);
      if (isNaN(dueDate.getTime())) continue;

      const amtFormatted = formatRupiah(record.remainingAmount);
      const isReceivable = record.type === "receivable";

      // 1. Advance notification (1 day before) at 09:00 AM
      const advanceDate = subDays(dueDate, 1);
      advanceDate.setHours(9, 0, 0, 0);
      if (advanceDate > now) {
        const leadTitle = isIndonesian
          ? isReceivable
            ? `Pengingat Jatuh Tempo Piutang: ${record.personName}`
            : `Pengingat Jatuh Tempo Utang: ${record.personName}`
          : isReceivable
            ? `Receivable Due Tomorrow: ${record.personName}`
            : `Debt Due Tomorrow: ${record.personName}`;

        const leadBody = isIndonesian
          ? isReceivable
            ? `Piutang kepada ${record.personName} (${amtFormatted}) jatuh tempo besok.`
            : `Kewajiban utang kepada ${record.personName} (${amtFormatted}) jatuh tempo besok.`
          : isReceivable
            ? `Receivable from ${record.personName} (${amtFormatted}) is due tomorrow.`
            : `Debt to ${record.personName} (${amtFormatted}) is due tomorrow.`;

        notificationsToSchedule.push({
          id: DEBT_NOTIFICATION_BASE_ID + i * 2 + 1,
          title: leadTitle,
          body: leadBody,
          schedule: { at: advanceDate },
          sound: "default",
        });
      }

      // 2. Notification on the Due Date at 09:00 AM
      const onDueDate = parseISO(record.dueDate);
      onDueDate.setHours(9, 0, 0, 0);
      if (onDueDate > now) {
        const dueTitle = isIndonesian
          ? isReceivable
            ? `Piutang Jatuh Tempo Hari Ini: ${record.personName}`
            : `Utang Jatuh Tempo Hari Ini: ${record.personName}`
          : isReceivable
            ? `Receivable Due Today: ${record.personName}`
            : `Debt Due Today: ${record.personName}`;

        const dueBody = isIndonesian
          ? isReceivable
            ? `Tagihan piutang dari ${record.personName} (${amtFormatted}) jatuh tempo hari ini.`
            : `Kewajiban pelunasan utang kepada ${record.personName} (${amtFormatted}) jatuh tempo hari ini.`
          : isReceivable
            ? `Receivable payment from ${record.personName} (${amtFormatted}) is due today.`
            : `Debt repayment to ${record.personName} (${amtFormatted}) is due today.`;

        notificationsToSchedule.push({
          id: DEBT_NOTIFICATION_BASE_ID + i * 2 + 2,
          title: dueTitle,
          body: dueBody,
          schedule: { at: onDueDate },
          sound: "default",
        });
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      });
    }
  } catch (e) {
    console.warn("Failed to sync debt notifications:", e);
  }
}


