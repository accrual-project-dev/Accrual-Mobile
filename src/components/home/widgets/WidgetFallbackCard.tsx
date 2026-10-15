// ======================================================================
// TROUVAILLE WIDGET FALLBACK & LUXURY EMPTY STATE CARD
// Elegant monochrome placeholder for cards with no data or unconfigured state
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme, Rule 1, Rule 2, Rule 6
// ======================================================================

import {
  SlidersHorizontal,
  Sparkles,
  Target,
  Bell,
  Scale,
  Clock,
  PieChart,
  Layers,
  HelpCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { CompactShell } from "./CompactShell";

export interface WidgetFallbackCardProps {
  cardId: string;
  size?: "full" | "half";
  isEditMode?: boolean;
  isIndonesian?: boolean;
  isDark?: boolean;
  onAction?: () => void;
  customTitle?: string;
  customReason?: string;
}

const WIDGET_METADATA: Record<
  string,
  {
    icon: LucideIcon;
    titleId: string;
    titleEn: string;
    reasonId: string;
    reasonEn: string;
  }
> = {
  spending_stability: {
    icon: SlidersHorizontal,
    titleId: "Stabilitas Pengeluaran",
    titleEn: "Spending Stability",
    reasonId: "Belum cukup data transaksi untuk menghitung variansi",
    reasonEn: "Not enough transaction data to calculate variance",
  },
  ai_insights: {
    icon: Sparkles,
    titleId: "Wawasan Finansial",
    titleEn: "Financial Insights",
    reasonId: "Pola pengeluaran normal, tidak ada anomali terdeteksi",
    reasonEn: "Spending patterns normal, no anomalies detected",
  },
  financial_goals: {
    icon: Target,
    titleId: "Target Finansial",
    titleEn: "Financial Goals",
    reasonId: "Belum ada target tabungan yang dibuat",
    reasonEn: "No savings goals configured yet",
  },
  upcoming_bills: {
    icon: Bell,
    titleId: "Tagihan Mendatang",
    titleEn: "Upcoming Bills",
    reasonId: "Semua tagihan lunas atau belum ada tagihan terdaftar",
    reasonEn: "All bills settled or no recurring bills registered",
  },
  debt_receivables: {
    icon: Scale,
    titleId: "Buku Utang & Piutang",
    titleEn: "Debt & Receivables",
    reasonId: "Belum ada catatan pinjaman atau utang aktif",
    reasonEn: "No active debts or receivables recorded",
  },
  recent_transactions: {
    icon: Clock,
    titleId: "Transaksi Terkini",
    titleEn: "Recent Transactions",
    reasonId: "Belum ada transaksi tercatat pada akun ini",
    reasonEn: "No transaction activity recorded yet",
  },
  top_categories: {
    icon: PieChart,
    titleId: "Kategori Pengeluaran",
    titleEn: "Top Spending Categories",
    reasonId: "Belum ada pengeluaran pada periode berjalan",
    reasonEn: "No expense recorded for the current period",
  },
  category_budgets: {
    icon: Layers,
    titleId: "Amplop Anggaran",
    titleEn: "Category Budgets",
    reasonId: "Batas kuota belanja belum dikonfigurasi",
    reasonEn: "Category envelopes have not been configured",
  },
  financial_health_gauge: {
    icon: ShieldCheck,
    titleId: "Kesehatan Modal",
    titleEn: "Capital Health",
    reasonId: "Membutuhkan data transaksi untuk menghitung indeks kesehatan modal",
    reasonEn: "Requires transaction data to calculate capital health score",
  },
};

export function WidgetFallbackCard({
  cardId,
  size = "full",
  isEditMode = false,
  isIndonesian = false,
  isDark = true,
  onAction,
  customTitle,
  customReason,
}: WidgetFallbackCardProps) {
  const meta = WIDGET_METADATA[cardId] || {
    icon: HelpCircle,
    titleId: "Widget",
    titleEn: "Widget",
    reasonId: "Belum ada data tersedia",
    reasonEn: "No data available yet",
  };

  const Icon = meta.icon;
  const title =
    customTitle || (isIndonesian ? meta.titleId : meta.titleEn);
  const reason =
    customReason || (isIndonesian ? meta.reasonId : meta.reasonEn);

  if (size === "half") {
    return (
      <CompactShell title={title} onOpenDetail={onAction}>
        <div className="flex-1 flex flex-col justify-between py-1 min-h-0 select-none">
          <div className="flex items-center gap-2 pt-0.5">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <Icon size={13} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[11.5px] font-semibold text-[var(--text-primary)] truncate">
                {isIndonesian ? "Data Kosong" : "No Data"}
              </p>
              <p className="text-[9.5px] text-[var(--text-tertiary)] truncate">
                {reason}
              </p>
            </div>
          </div>

          <div className="text-[10px] text-[var(--text-tertiary)] flex items-center justify-between pt-1 border-t border-[var(--glass-border)]">
            <span>{isIndonesian ? "Status" : "Status"}</span>
            <span className="font-medium text-[var(--text-secondary)]">
              {isEditMode
                ? isIndonesian
                  ? "Mode Edit"
                  : "Edit Mode"
                : isIndonesian
                  ? "Kosong"
                  : "Empty"}
            </span>
          </div>
        </div>
      </CompactShell>
    );
  }

  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const cardShadow = isDark
    ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
    : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff";

  return (
    <div
      className="p-4 rounded-[24px] flex flex-col justify-between min-h-[140px] relative overflow-hidden select-none box-border"
      style={{
        background: cardBg,
        border: cardBorder,
        boxShadow: cardShadow,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      {/* Specular Rim Light Reflection */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
        style={{
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
            : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <Icon size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight truncate">
              {title}
            </h4>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">
              {reason}
            </p>
          </div>
        </div>

        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-secondary)",
          }}
        >
          {isIndonesian ? "Data Kosong" : "No Data"}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] pt-2.5 border-t border-[var(--glass-border)] mt-3">
        <span className="truncate">
          {isIndonesian
            ? "Widget aktif di tata letak beranda"
            : "Widget active in home layout"}
        </span>
        {isEditMode && (
          <span className="text-[10px] text-[var(--text-secondary)] font-medium shrink-0 ml-2">
            {isIndonesian ? "Atur ukuran atau sembunyikan" : "Resize or hide card"}
          </span>
        )}
      </div>
    </div>
  );
}
