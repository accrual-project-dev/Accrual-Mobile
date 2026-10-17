import { BottomSheet } from "../ui/BottomSheet";
import {
  FileSpreadsheet,
  FileLock2,
  ChevronRight,
  Download,
  Upload,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { triggerHaptic } from "../../lib/haptics";

interface DataExportVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReportExport: () => void;
  onOpenVaultExport: () => void;
  onOpenVaultRestore: () => void;
}

export function DataExportVaultModal({
  isOpen,
  onClose,
  onOpenReportExport,
  onOpenVaultExport,
  onOpenVaultRestore,
}: DataExportVaultModalProps) {
  const { isIndonesian } = useLanguage();

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6 pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)] space-y-5 max-w-lg mx-auto">
        {/* Header */}
        <div className="space-y-1 text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.04] text-[11px] font-medium tracking-wide text-[var(--text-secondary)] mb-1">
            <Sparkles size={13} strokeWidth={1.5} />
            <span>
              {isIndonesian
                ? "Ekspor & Cadangan Data"
                : "Data Export & Vault Backup"}
            </span>
          </div>
          <h3
            className="text-xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian
              ? "Ekspor Laporan & Cadangan Brankas"
              : "Report Export & Data Vault"}
          </h3>
          <p
            className="text-[13px] leading-relaxed font-normal"
            style={{ color: "var(--text-secondary)" }}
          >
            {isIndonesian
              ? "Pusat ekspor laporan finansial profesional (PDF, CSV, JSON) dan pencadangan brankas terenkripsi militer AES-256."
              : "Unified hub for professional financial reporting (PDF, CSV, JSON) and AES-256 military-grade encrypted backups."}
          </p>
        </div>

        {/* Options Stack */}
        <div className="space-y-3 pt-1">
          {/* Card 1: Luxury Report Export */}
          <div
            className="p-4 rounded-2xl border space-y-3 transition-all"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--glass-border)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  background: "var(--bg-base)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <FileSpreadsheet size={18} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {isIndonesian
                      ? "Ekspor Laporan Keuangan"
                      : "Financial Report Export"}
                  </h4>
                  <span className="text-[10px]  px-2 py-0.5 rounded border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] font-medium">
                    PDF / CSV
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {isIndonesian
                    ? "Cetak posisi keuangan, arus kas, neraca, dan catatan transaksi dalam format PDF eksekutif, berkas CSV, atau arsip JSON."
                    : "Generate official executive statements, cash flows, balance sheets, CSV records, or JSON vault archives."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onClose();
                onOpenReportExport();
              }}
              className="w-full py-2.5 px-3.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] active:scale-[0.99] text-[12px] font-semibold text-[var(--text-primary)] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>
                {isIndonesian
                  ? "Buka Pengaturan Ekspor Laporan"
                  : "Configure Report Export"}
              </span>
              <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Card 2: Encrypted Vault Backup & Restore */}
          <div
            className="p-4 rounded-2xl border space-y-3 transition-all"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--glass-border)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  background: "var(--bg-base)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <FileLock2 size={18} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {isIndonesian
                      ? "Brankas Terenkripsi AES-256"
                      : "AES-256 Encrypted Vault"}
                  </h4>
                  <span className="text-[10px]  px-2 py-0.5 rounded border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] font-medium">
                    {isIndonesian ? "Basis Data" : "Database"}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {isIndonesian
                    ? "Cadangkan seluruh basis data (transaksi, rekening, tagihan) ke dalam berkas terenkripsi sandi atau pulihkan data kapan saja."
                    : "Backup entire database (transactions, accounts, bills) to a password-encrypted offline vault or restore anytime."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onClose();
                  onOpenVaultExport();
                }}
                className="py-2.5 px-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] active:scale-[0.99] text-[12px] font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download size={13} strokeWidth={1.75} />
                <span>
                  {isIndonesian ? "Cadangkan Berkas" : "Backup Vault"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onClose();
                  onOpenVaultRestore();
                }}
                className="py-2.5 px-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] active:scale-[0.99] text-[12px] font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Upload size={13} strokeWidth={1.75} />
                <span>{isIndonesian ? "Pulihkan Data" : "Restore Data"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Dismiss */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onClose();
          }}
          className="w-full py-3 rounded-2xl font-semibold text-[13px] border border-[var(--glass-border)] bg-[var(--bg-elevated)] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[var(--text-secondary)] transition-all cursor-pointer"
        >
          {isIndonesian ? "Tutup" : "Close"}
        </button>
      </div>
    </BottomSheet>
  );
}
