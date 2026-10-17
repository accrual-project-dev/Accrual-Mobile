import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import type { CategoryMoMShift } from "../../lib/financialMath";
import { IconRenderer } from "../ui/IconRenderer";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { usePrivacy } from "../../contexts/PrivacyContext";

interface CategoryDrillDownSheetProps {
  isOpen: boolean;
  onClose: () => void;
  shift: CategoryMoMShift | null;
}

export function CategoryDrillDownSheet({
  isOpen,
  onClose,
  shift,
}: CategoryDrillDownSheetProps) {
  const navigate = useNavigate();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const { isStealthMode } = usePrivacy();

  if (!shift) return null;

  const handleViewTransactions = () => {
    onClose();
    navigate(`/history?category=${encodeURIComponent(shift.categoryId)}`);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isIndonesian ? `Penyebab Perubahan ${shift.name}` : `Why ${shift.name} Changed`}
    >
      <div className="px-5 space-y-4 pb-6 select-none">
        {/* Category Header Card */}
        <div
          className="p-4 rounded-2xl flex items-center justify-between"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--glass-fill)" }}
            >
              <IconRenderer
                icon={shift.emoji}
                size="w-6 h-6"
                className="object-contain"
              />
            </div>
            <div>
              <h4
                className="font-semibold text-[15px]"
                style={{ color: "var(--text-primary)" }}
              >
                {shift.name}
              </h4>
              <p
                className="text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? `${shift.isIncrease ? "Meningkat" : "Menurun"} dibanding bulan lalu`
                  : `${shift.isIncrease ? "Increased" : "Decreased"} vs last month`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p
              className="amount text-[15px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {shift.isIncrease ? "+" : ""}
              {isStealthMode ? "••••••••" : formatWithPreferred(shift.deltaAmount)}
            </p>
            <p
              className="text-[11px] font-bold"
              style={{ color: "var(--text-secondary)" }}
            >
              {shift.isIncrease ? "↑" : "↓"} {shift.pctChange}% MoM
            </p>
          </div>
        </div>

        {/* Breakdown comparison */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="p-3 rounded-xl"
            style={{ background: "var(--glass-fill)" }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Bulan Terpilih" : "Selected Month"}
            </p>
            <p
              className="amount text-[14px] font-semibold mt-0.5"
              style={{ color: "var(--text-primary)" }}
            >
              {isStealthMode ? "••••••••" : formatWithPreferred(shift.currentTotal)}
            </p>
          </div>
          <div
            className="p-3 rounded-xl"
            style={{ background: "var(--glass-fill)" }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Bulan Sebelumnya" : "Previous Month"}
            </p>
            <p
              className="amount text-[14px] font-semibold mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {isStealthMode ? "••••••••" : formatWithPreferred(shift.previousTotal)}
            </p>
          </div>
        </div>

        {/* Contributing Sub-Items / Notes */}
        {shift.contributors && shift.contributors.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-[var(--glass-border)]">
            <p
              className="text-[11px] font-bold uppercase tracking-wider px-0.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Kontributor Pengeluaran Terbesar" : "Top Outflow Contributors"}
            </p>
            <div className="space-y-1.5">
              {shift.contributors.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl flex items-center justify-between"
                  style={{ background: "var(--glass-fill)" }}
                >
                  <div>
                    <p
                      className="font-bold text-[12px]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {c.note}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {c.count} {isIndonesian ? "transaksi" : c.count === 1 ? "transaction" : "transactions"}
                    </p>
                  </div>
                  <p
                    className="amount font-semibold text-[13px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isStealthMode ? "••••••••" : formatWithPreferred(c.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleViewTransactions}
            className="w-full py-3.5 rounded-2xl text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer select-none"
            style={{
              background: "var(--accent)",
              color: "var(--accent-ink)",
            }}
          >
            <span>
              {isIndonesian
                ? `Lihat Transaksi ${shift.name}`
                : `View ${shift.name} Transactions`}
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
