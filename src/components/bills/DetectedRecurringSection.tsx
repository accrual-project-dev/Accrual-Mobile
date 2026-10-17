import { Check, Clock3, MinusCircle } from "lucide-react"
import { useLanguage } from "../../contexts/LanguageContext"
import { useCurrency } from "../../contexts/CurrencyContext"
import type { DetectedRecurringItem } from "../../hooks/useFinancialIntelligence"

interface DetectedRecurringSectionProps {
  items: DetectedRecurringItem[]
  confirmingId?: string | null
  onConfirm: (item: DetectedRecurringItem) => void
  onIgnore: (item: DetectedRecurringItem) => void
}

const SUPPORTED_REPEAT = new Set(["weekly", "monthly", "yearly"])

export function DetectedRecurringSection({ items, confirmingId = null, onConfirm, onIgnore }: DetectedRecurringSectionProps) {
  const { isIndonesian } = useLanguage()
  const { formatWithPreferred } = useCurrency()

  if (items.length === 0) return null

  const getConfidenceLabel = (conf: string) => {
    if (isIndonesian) {
      if (conf === "high") return "tinggi"
      if (conf === "medium") return "sedang"
      if (conf === "low") return "rendah"
    }
    return conf
  }

  const getFrequencyLabel = (freq: string) => {
    if (isIndonesian) {
      if (freq === "weekly") return "mingguan"
      if (freq === "monthly") return "bulanan"
      if (freq === "quarterly") return "triwulanan"
      if (freq === "yearly") return "tahunan"
    }
    return freq
  }

  return (
    <div className="space-y-2.5">
      <div className="px-1">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          {isIndonesian ? "Pola Berulang Terdeteksi" : "Detected Recurring"}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {isIndonesian
            ? "Tinjau pola transaksi berulang yang ditemukan dari riwayat transaksi."
            : "Review recurring patterns found from transaction history."}
        </p>
      </div>

      {items.map(item => {
        const requiresManualCadence = !SUPPORTED_REPEAT.has(item.frequency)
        return (
          <div key={item.id} className="glass-surface p-3.5 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[14px] truncate" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
                    style={{ background: "var(--glass-fill)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}>
                    {getConfidenceLabel(item.confidence)}
                  </span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
                    style={{ background: "var(--glass-fill-strong)", color: "var(--text-primary)", border: "1px solid var(--glass-border)" }}>
                    {getFrequencyLabel(item.frequency)}
                  </span>
                </div>
                <p className="text-[11px] font-medium mt-1" style={{ color: "var(--text-tertiary)" }}>
                  {item.categoryName} · {item.occurrencesCount} {isIndonesian ? "kali terjadi · berikutnya" : "occurrences · next"} {item.nextExpectedDate}
                </p>
                <p className="amount text-[15px] font-semibold mt-2" style={{ color: "var(--text-primary)" }}>
                  {formatWithPreferred(item.typicalAmount)}
                </p>
                <div className="flex items-start gap-2 mt-2">
                  <Clock3 size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {requiresManualCadence
                      ? (isIndonesian
                          ? "Frekuensi ini belum didukung langsung oleh aturan pengulangan tagihan, sehingga konfirmasi akan membuat item jatuh tempo berikutnya dengan catatan tinjauan manual."
                          : "This cadence is not directly supported by the bill repeat rule yet, so confirmation will create the next due item with a manual review note.")
                      : item.explanation}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onConfirm(item)}
                disabled={confirmingId === item.id}
                className="flex-1 text-[11px] font-semibold px-3 py-2 rounded-full flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-60 cursor-pointer shadow-xs"
                style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}
              >
                <Check size={12} strokeWidth={2} />
                <span>
                  {confirmingId === item.id
                    ? (isIndonesian ? "Mengonfirmasi..." : "Confirming...")
                    : (isIndonesian ? "Konfirmasi" : "Confirm")}
                </span>
              </button>
              <button
                onClick={() => onIgnore(item)}
                className="text-[11px] font-semibold px-3 py-2 rounded-full flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                style={{ background: "var(--glass-fill)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
              >
                <MinusCircle size={12} />
                <span>{isIndonesian ? "Abaikan" : "Ignore"}</span>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
