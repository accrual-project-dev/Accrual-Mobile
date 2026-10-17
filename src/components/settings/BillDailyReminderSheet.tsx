import { useState, useEffect } from "react";
import { Bell, Clock, Check } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "../../contexts/LanguageContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  getDailyStreakReminderTime,
  setDailyStreakReminderTime,
  syncDailyStreakReminder,
  cancelDailyStreakReminder,
  getBillReminderLeadDays,
  setBillReminderLeadDays,
  syncBillNotifications,
  cancelAllBillNotifications,
} from "../../lib/notifications";
import type { Bill } from "../../types";

interface BillDailyReminderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  bills?: Bill[];
  onSaved?: (enabled: boolean, time: string, leadDays: number) => void;
}

export function BillDailyReminderSheet({
  isOpen,
  onClose,
  bills = [],
  onSaved,
}: BillDailyReminderSheetProps) {
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();

  const [dailyEnabled, setDailyEnabled] = useState<boolean>(() => {
    return localStorage.getItem("trouvaille_daily_reminder_enabled") !== "false";
  });
  const [billEnabled, setBillEnabled] = useState<boolean>(() => {
    return localStorage.getItem("trouvaille_bill_reminders_enabled") !== "false";
  });
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    return getDailyStreakReminderTime();
  });
  const [selectedLeadDays, setSelectedLeadDays] = useState<number>(() => {
    return getBillReminderLeadDays();
  });

  // Keep state in sync whenever opened
  useEffect(() => {
    if (isOpen) {
      setDailyEnabled(
        localStorage.getItem("trouvaille_daily_reminder_enabled") !== "false",
      );
      setBillEnabled(
        localStorage.getItem("trouvaille_bill_reminders_enabled") !== "false",
      );
      setSelectedTime(getDailyStreakReminderTime());
      setSelectedLeadDays(getBillReminderLeadDays());
    }
  }, [isOpen]);

  const presets = [
    { time: "08:00", label: isIndonesian ? "Pagi 08:00" : "08:00 AM" },
    { time: "12:30", label: isIndonesian ? "Siang 12:30" : "12:30 PM" },
    { time: "20:00", label: isIndonesian ? "Standar 20:00" : "08:00 PM" },
    { time: "21:30", label: isIndonesian ? "Larut 21:30" : "09:30 PM" },
  ];

  const leadOptions = [
    {
      days: 0,
      title: isIndonesian ? "Hari H" : "On Due Date",
      desc: isIndonesian ? "Saat jatuh tempo" : "Day of due date",
    },
    {
      days: 1,
      title: isIndonesian ? "H-1" : "1 Day Before",
      desc: isIndonesian ? "1 hari sebelumnya" : "1 day in advance",
    },
    {
      days: 3,
      title: isIndonesian ? "H-3" : "3 Days Before",
      desc: isIndonesian ? "3 hari sebelumnya" : "3 days in advance",
    },
  ];

  const handleSave = async () => {
    triggerSuccessHaptic();
    try {
      localStorage.setItem(
        "trouvaille_daily_reminder_enabled",
        dailyEnabled ? "true" : "false",
      );
      localStorage.setItem(
        "trouvaille_bill_reminders_enabled",
        billEnabled ? "true" : "false",
      );
      setDailyStreakReminderTime(selectedTime);
      setBillReminderLeadDays(selectedLeadDays);

      if (dailyEnabled) {
        await syncDailyStreakReminder(false, isIndonesian);
      } else {
        await cancelDailyStreakReminder();
      }

      if (billEnabled) {
        await syncBillNotifications(bills, isIndonesian);
      } else {
        await cancelAllBillNotifications();
      }

      showToast(
        isIndonesian
          ? "Pengaturan pengingat berhasil disimpan"
          : "Reminder preferences saved",
        "update",
        () => {},
      );

      if (onSaved) {
        onSaved(dailyEnabled || billEnabled, selectedTime, selectedLeadDays);
      }
      onClose();
    } catch (err) {
      console.warn("Failed to save reminder preferences:", err);
      onClose();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="p-5 space-y-4 font-sans select-none"
        style={{
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom, 0px) + 16px), 28px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <Bell size={16} strokeWidth={1.75} />
          </div>
          <div>
            <h2
              className="text-[16px] font-semibold tracking-tight leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian
                ? "Pengingat Tagihan & Catat Harian"
                : "Bill & Daily Log Reminders"}
            </h2>
            <p
              className="text-[11px] font-medium mt-0.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Atur jam pengingat harian dan jarak hari peringatan tagihan"
                : "Configure daily streak reminder time and bill due date advance alerts"}
            </p>
          </div>
        </div>

        {/* Section 1: Daily Streak Reminder */}
        <div
          className="p-4 rounded-2xl border space-y-3.5 transition-all"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div className="flex items-center justify-between min-h-[44px]">
            <div className="space-y-0.5 pr-2">
              <span
                className="text-[13px] font-semibold block"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? "Pengingat Catat Kas Harian"
                  : "Daily Logging Reminder"}
              </span>
              <span
                className="text-[11px] block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Pemberitahuan lembut jika belum mencatat hari ini"
                  : "Gentle alert if no transactions logged today"}
              </span>
            </div>
            <ToggleSwitch
              checked={dailyEnabled}
              onChange={() => {
                triggerHaptic("light");
                setDailyEnabled((prev) => !prev);
              }}
              ariaLabel="Toggle daily streak reminder"
            />
          </div>

          {dailyEnabled && (
            <div className="space-y-3 pt-2 border-t border-[var(--glass-border)]">
              {/* Digital Clock Display & Native Time Picker Trigger */}
              <div className="flex flex-col items-center justify-center py-1.5 space-y-1">
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Jam Pengingat" : "Reminder Time"}
                </span>

                <label
                  className="relative inline-flex items-center gap-2.5 px-5 py-2 rounded-2xl border cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
                  style={{
                    background: "var(--glass-fill)",
                    borderColor: "var(--glass-border)",
                  }}
                >
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => {
                      if (e.target.value) {
                        triggerHaptic("light");
                        setSelectedTime(e.target.value);
                      }
                    }}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                    aria-label={
                      isIndonesian
                        ? "Pilih Jam Pengingat"
                        : "Select Reminder Time"
                    }
                  />
                  <Clock
                    size={17}
                    strokeWidth={1.75}
                    className="text-[var(--text-tertiary)]"
                  />
                  <span
                    className="text-2xl font-semibold tracking-wider tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {selectedTime}
                  </span>
                </label>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => {
                  const isSelected = selectedTime === preset.time;
                  return (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setSelectedTime(preset.time);
                      }}
                      className="py-2 px-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-between"
                      style={{
                        background: isSelected
                          ? "rgba(255, 255, 255, 0.08)"
                          : "var(--glass-fill)",
                        borderColor: isSelected
                          ? "var(--text-primary)"
                          : "var(--glass-border)",
                      }}
                    >
                      <span
                        className="text-[12px] font-medium"
                        style={{
                          color: isSelected
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {preset.label}
                      </span>
                      {isSelected && (
                        <Check
                          size={13}
                          strokeWidth={2.4}
                          style={{ color: "var(--text-primary)" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Bill Due Date Reminders */}
        <div
          className="p-4 rounded-2xl border space-y-3.5 transition-all"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div className="flex items-center justify-between min-h-[44px]">
            <div className="space-y-0.5 pr-2">
              <span
                className="text-[13px] font-semibold block"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? "Peringatan Jatuh Tempo Tagihan"
                  : "Bill Due Date Alerts"}
              </span>
              <span
                className="text-[11px] block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Notifikasi sebelum tanggal jatuh tempo tagihan rutin"
                  : "Notifications prior to recurring bill due dates"}
              </span>
            </div>
            <ToggleSwitch
              checked={billEnabled}
              onChange={() => {
                triggerHaptic("light");
                setBillEnabled((prev) => !prev);
              }}
              ariaLabel="Toggle bill due date reminders"
            />
          </div>

          {billEnabled && (
            <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
              <span
                className="text-[10px] uppercase tracking-wider font-semibold block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Waktu Peringatan Sebelum Jatuh Tempo"
                  : "Alert Timing Before Due Date"}
              </span>

              <div className="grid grid-cols-3 gap-2">
                {leadOptions.map((opt) => {
                  const isSelected = selectedLeadDays === opt.days;
                  return (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setSelectedLeadDays(opt.days);
                      }}
                      className="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between"
                      style={{
                        background: isSelected
                          ? "rgba(255, 255, 255, 0.08)"
                          : "var(--glass-fill)",
                        borderColor: isSelected
                          ? "var(--text-primary)"
                          : "var(--glass-border)",
                      }}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span
                          className="text-[12px] font-semibold"
                          style={{
                            color: isSelected
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                          }}
                        >
                          {opt.title}
                        </span>
                        {isSelected && (
                          <Check
                            size={12}
                            strokeWidth={2.4}
                            style={{ color: "var(--text-primary)" }}
                          />
                        )}
                      </div>
                      <span
                        className="text-[10px] leading-tight"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border text-[13px] font-semibold active:scale-95 transition-all cursor-pointer text-center"
            style={{
              background: "var(--glass-fill)",
              borderColor: "var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            {isIndonesian ? "Batal" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 rounded-xl text-[13px] font-semibold active:scale-95 transition-all cursor-pointer text-center border"
            style={{
              background: "var(--text-primary)",
              color: "var(--bg-base)",
              borderColor: "var(--text-primary)",
            }}
          >
            {isIndonesian ? "Simpan Preferensi" : "Save Preferences"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
