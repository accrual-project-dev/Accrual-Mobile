import { useState, useRef } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  Shield,
  Download,
  Upload,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { useWallets } from "../../hooks/useWallets";
import { useCategories } from "../../hooks/useCategories";
import { useBills } from "../../hooks/useBills";
import { useGoals } from "../../hooks/useGoals";
import { useBudgetTarget } from "../../hooks/useBudgetTarget";
import { useShortcuts } from "../../hooks/useShortcuts";
import {
  fetchAllTransactionsFromSupabase,
  useAllTransactions,
} from "../../hooks/useTransactions";
import {
  encryptVault,
  decryptVault,
  downloadVaultFile,
  parseVaultFile,
  restoreVaultData,
  type EncryptedVaultPayload,
  type TrouvailleVaultData,
  type RestoreProgress,
} from "../../lib/vaultEncryption";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { format } from "date-fns";

interface EncryptedVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "export" | "restore";
}

export function EncryptedVaultModal({
  isOpen,
  onClose,
  defaultTab = "export",
}: EncryptedVaultModalProps) {
  const { session } = useAuth();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const queryClient = useQueryClient();

  const { data: allTransactionsFallback = [] } = useAllTransactions();
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const { data: bills = [] } = useBills();
  const { goals } = useGoals();
  const { budgetTarget } = useBudgetTarget();
  const { shortcuts } = useShortcuts();

  const [activeTab, setActiveTab] = useState<"export" | "restore">(defaultTab);

  // Export State
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportConfirmPassphrase, setExportConfirmPassphrase] = useState("");
  const [showExportPassphrase, setShowExportPassphrase] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Restore State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedPayload, setParsedPayload] =
    useState<EncryptedVaultPayload | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [showRestorePassphrase, setShowRestorePassphrase] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] =
    useState<RestoreProgress | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Reset states when modal is closed
  const handleClose = () => {
    if (isExporting || isRestoring) return;
    setExportPassphrase("");
    setExportConfirmPassphrase("");
    setSelectedFile(null);
    setParsedPayload(null);
    setRestorePassphrase("");
    setRestoreProgress(null);
    setRestoreError(null);
    onClose();
  };

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    try {
      const payload = await parseVaultFile(file);
      setSelectedFile(file);
      setParsedPayload(payload);
      triggerHaptic("light");
    } catch (err: any) {
      triggerHaptic("heavy");
      setRestoreError(
        err.message ||
          (isIndonesian
            ? "Berkas brankas tidak valid atau rusak. Pilih berkas cadangan .accrual atau .trouvaille yang sah."
            : "Invalid or corrupt vault file. Please select a valid .accrual or .trouvaille backup."),
      );
      setSelectedFile(null);
      setParsedPayload(null);
    }
  };

  // Execute Vault Export (Supports both Cloud and Guest/Offline Modes)
  const handleExecuteExport = async () => {
    if (!exportPassphrase || exportPassphrase.length < 4) {
      showToast(
        isIndonesian
          ? "Kata sandi brankas minimal 4 karakter"
          : "Passphrase must be at least 4 characters",
        "delete",
        () => {},
      );
      triggerHaptic("heavy");
      return;
    }

    if (exportPassphrase !== exportConfirmPassphrase) {
      showToast(
        isIndonesian
          ? "Konfirmasi kata sandi tidak cocok"
          : "Passphrases do not match",
        "delete",
        () => {},
      );
      triggerHaptic("heavy");
      return;
    }

    setIsExporting(true);
    try {
      // 1. Fetch complete transactions from Supabase or local Guest/Offline cache
      let allTransactions = allTransactionsFallback;
      try {
        const fetched = await fetchAllTransactionsFromSupabase({
          userId: session?.user?.id || "guest_local_user",
          filterByUserIdOnly: Boolean(session?.user?.id),
        });
        if (fetched.length > 0 || allTransactionsFallback.length === 0) {
          allTransactions = fetched;
        }
      } catch {
        allTransactions = allTransactionsFallback;
      }

      // 2. Package vault data
      const vaultData: TrouvailleVaultData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions: allTransactions,
        wallets,
        categories,
        bills,
        goals,
        budgetTarget,
        shortcuts,
      };

      // 3. Encrypt payload
      const encrypted = await encryptVault(vaultData, exportPassphrase);

      // 4. Download file
      const dateStr = format(new Date(), "yyyyMMdd_HHmm");
      downloadVaultFile(encrypted, `accrual_vault_${dateStr}.accrual`);

      triggerSuccessHaptic();
      showToast(
        isIndonesian
          ? "Brankas terenkripsi berhasil diekspor"
          : "Encrypted vault exported successfully",
        "add",
        () => {},
      );
      handleClose();
    } catch (err: any) {
      console.error("[VaultExport] Failed:", err);
      triggerHaptic("heavy");
      showToast(
        err.message ||
          (isIndonesian
            ? "Gagal mengekspor brankas"
            : "Failed to export vault"),
        "delete",
        () => {},
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Execute Vault Decrypt & Restore
  const handleExecuteRestore = async () => {
    if (!parsedPayload) {
      showToast(
        isIndonesian
          ? "Pilih berkas cadangan brankas terlebih dahulu"
          : "Please choose a vault backup file",
        "delete",
        () => {},
      );
      return;
    }

    if (!restorePassphrase) {
      showToast(
        isIndonesian
          ? "Masukkan kata sandi dekripsi brankas"
          : "Please enter the decryption passphrase",
        "delete",
        () => {},
      );
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);

    try {
      // 1. Decrypt vault
      setRestoreProgress({
        stage: isIndonesian
          ? "Mendekripsi isi brankas..."
          : "Decrypting vault payload...",
        progress: 10,
      });
      const decryptedData = await decryptVault(parsedPayload, restorePassphrase);

      // 2. Restore data into Supabase & localStorage (Cloud & Guest Mode supported)
      const result = await restoreVaultData(decryptedData, {
        mode: restoreMode,
        isIndonesian,
        onProgress: setRestoreProgress,
      });

      // 3. Invalidate React Query caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["wallets"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["bills"] }),
      ]);

      triggerSuccessHaptic();
      showToast(
        isIndonesian
          ? `Dipulihkan: ${result.restoredTransactions} transaksi & ${result.restoredWallets} rekening`
          : `Restored ${result.restoredTransactions} transactions & ${result.restoredWallets} wallets`,
        "add",
        () => {},
      );
      handleClose();
    } catch (err: any) {
      console.error("[VaultRestore] Failed:", err);
      triggerHaptic("heavy");
      setRestoreError(
        err.message ||
          (isIndonesian
            ? "Dekripsi gagal. Periksa kembali kata sandi Anda."
            : "Decryption failed. Please verify your passphrase."),
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose}>
      <div className="p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)] space-y-5 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center space-y-1">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-2"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <Shield size={22} strokeWidth={1.75} />
          </div>
          <h3
            className="text-[18px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Brankas Lokal Terenkripsi" : "Encrypted Local Vault"}
          </h3>
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {isIndonesian
              ? "Pencadangan sisi perangkat AES-GCM-256 dengan enkripsi tanpa pengetahuan"
              : "Client-side AES-GCM-256 backup with zero-knowledge encryption"}
          </p>
        </div>

        {/* Mode Selector Tabs (Rule 3 Compliant: Zero native emojis, Apple segmented glass) */}
        <div
          className="flex p-1 rounded-2xl"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab("export");
              triggerHaptic("light");
            }}
            className="flex-1 py-2 text-[12px] font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            style={{
              background:
                activeTab === "export"
                  ? "var(--bg-elevated)"
                  : "transparent",
              color:
                activeTab === "export"
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              boxShadow:
                activeTab === "export" ? "var(--shadow-card)" : "none",
            }}
          >
            <Download size={14} strokeWidth={1.75} />
            <span>{isIndonesian ? "Ekspor Brankas" : "Export Vault"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("restore");
              triggerHaptic("light");
            }}
            className="flex-1 py-2 text-[12px] font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            style={{
              background:
                activeTab === "restore"
                  ? "var(--bg-elevated)"
                  : "transparent",
              color:
                activeTab === "restore"
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              boxShadow:
                activeTab === "restore" ? "var(--shadow-card)" : "none",
            }}
          >
            <Upload size={14} strokeWidth={1.75} />
            <span>{isIndonesian ? "Pulihkan Brankas" : "Restore Vault"}</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: EXPORT VAULT */}
        {/* ============================================================== */}
        {activeTab === "export" && (
          <div className="space-y-4">
            {/* Telemetry Bento Summary */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Data yang Akan Dienkripsi" : "Records to Encrypt"}
                </span>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  AES-GCM-256
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div
                  className="p-2.5 rounded-xl text-center"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <span
                    className="text-[15px] font-semibold block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {allTransactionsFallback.length}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Transaksi" : "Transactions"}
                  </span>
                </div>
                <div
                  className="p-2.5 rounded-xl text-center"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <span
                    className="text-[15px] font-semibold block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {wallets.length}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Rekening" : "Wallets"}
                  </span>
                </div>
                <div
                  className="p-2.5 rounded-xl text-center"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <span
                    className="text-[15px] font-semibold block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {categories.length}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Kategori" : "Categories"}
                  </span>
                </div>
                <div
                  className="p-2.5 rounded-xl text-center"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <span
                    className="text-[15px] font-semibold block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {bills.length}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Tagihan" : "Bills"}
                  </span>
                </div>
              </div>

              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Seluruh catatan, transaksi, target, dan kategori akan dienkripsi secara lokal di perangkat Anda. Hanya Anda yang memegang kuncinya."
                  : "All records, transactions, goals, and categories will be encrypted locally on your device. Only you possess the key."}
              </p>
            </div>

            {/* Passphrase Input Fields */}
            <div className="space-y-3">
              <div>
                <label
                  className="text-[12px] font-semibold block mb-1.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Atur Kata Sandi Brankas" : "Set Vault Passphrase"}
                </label>
                <div
                  className="flex items-center px-3.5 py-3 rounded-2xl transition-all"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.035)",
                    border: "none",
                  }}
                >
                  <Lock
                    size={16}
                    className="shrink-0 mr-2.5"
                    style={{ color: "var(--text-tertiary)" }}
                  />
                  <input
                    type={showExportPassphrase ? "text" : "password"}
                    placeholder={
                      isIndonesian
                        ? "Masukkan kata sandi atau PIN kuat"
                        : "Enter strong passphrase or PIN"
                    }
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    className="w-full bg-transparent text-[13px] outline-none"
                    style={{ color: "var(--text-primary)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowExportPassphrase(!showExportPassphrase)}
                    className="p-1 cursor-pointer shrink-0"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {showExportPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className="text-[12px] font-semibold block mb-1.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Konfirmasi Kata Sandi" : "Confirm Passphrase"}
                </label>
                <div
                  className="flex items-center px-3.5 py-3 rounded-2xl transition-all"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.035)",
                    border: "none",
                  }}
                >
                  <Lock
                    size={16}
                    className="shrink-0 mr-2.5"
                    style={{ color: "var(--text-tertiary)" }}
                  />
                  <input
                    type={showExportPassphrase ? "text" : "password"}
                    placeholder={
                      isIndonesian ? "Ulangi kata sandi" : "Repeat passphrase"
                    }
                    value={exportConfirmPassphrase}
                    onChange={(e) => setExportConfirmPassphrase(e.target.value)}
                    className="w-full bg-transparent text-[13px] outline-none"
                    style={{ color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            </div>

            {/* Export Action Button */}
            <button
              type="button"
              disabled={isExporting || !exportPassphrase || !exportConfirmPassphrase}
              onClick={handleExecuteExport}
              className="w-full py-3.5 px-4 rounded-2xl text-[13.5px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-0 shadow-[0_2px_8px_rgba(0,0,0,0.18)] active:scale-[0.99]"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-primary)",
              }}
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>
                    {isIndonesian
                      ? "Mengenkripsi & Membuat Brankas..."
                      : "Encrypting & Generating Vault..."}
                  </span>
                </>
              ) : (
                <>
                  <Download size={16} strokeWidth={1.75} />
                  <span>
                    {isIndonesian
                      ? "Unduh Brankas Terenkripsi (.accrual)"
                      : "Download Encrypted Vault (.accrual)"}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: RESTORE VAULT */}
        {/* ============================================================== */}
        {activeTab === "restore" && (
          <div className="space-y-4">
            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".accrual,.trouvaille,.json"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* File Dropzone Card */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-5 rounded-2xl text-center cursor-pointer transition-all border-dashed"
              style={{
                background: "var(--glass-fill)",
                border: "1px dashed var(--glass-border)",
              }}
            >
              {selectedFile && parsedPayload ? (
                <div className="space-y-2">
                  <div
                    className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <CheckCircle2 size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <span
                      className="text-[13px] font-semibold block"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {selectedFile.name}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian ? "Diekspor: " : "Exported: "}
                      {parsedPayload.createdAt
                        ? format(
                            new Date(parsedPayload.createdAt),
                            "dd MMM yyyy, HH:mm",
                          )
                        : isIndonesian
                          ? "Cadangan Terenkripsi"
                          : "Encrypted Backup"}
                    </span>
                  </div>

                  {/* Envelope Item Badges */}
                  <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {parsedPayload.metadata?.itemCounts?.transactions ?? 0}{" "}
                      {isIndonesian ? "transaksi" : "txs"}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {parsedPayload.metadata?.itemCounts?.wallets ?? 0}{" "}
                      {isIndonesian ? "rekening" : "wallets"}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {parsedPayload.metadata?.itemCounts?.categories ?? 0}{" "}
                      {isIndonesian ? "kategori" : "categories"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 py-2">
                  <Upload
                    size={22}
                    strokeWidth={1.75}
                    className="mx-auto"
                    style={{ color: "var(--text-tertiary)" }}
                  />
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian
                      ? "Pilih Berkas Brankas (.accrual)"
                      : "Select Vault File (.accrual)"}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian
                      ? "Ketuk untuk memilih berkas di perangkat Anda"
                      : "Tap to browse files on your device"}
                  </p>
                </div>
              )}
            </div>

            {/* Error Banner if any (Strict Monochrome Rule 7) */}
            {restoreError && (
              <div
                className="p-3 rounded-xl flex items-center gap-2"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <AlertCircle size={16} strokeWidth={1.75} className="shrink-0" />
                <span className="text-[11px] font-medium leading-tight">
                  {restoreError}
                </span>
              </div>
            )}

            {/* Passphrase Input */}
            <div>
              <label
                className="text-[12px] font-semibold block mb-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? "Masukkan Kata Sandi Dekripsi"
                  : "Enter Decryption Passphrase"}
              </label>
              <div
                className="flex items-center px-3.5 py-3 rounded-2xl transition-all"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.035)",
                  border: "none",
                }}
              >
                <Lock
                  size={16}
                  className="shrink-0 mr-2.5"
                  style={{ color: "var(--text-tertiary)" }}
                />
                <input
                  type={showRestorePassphrase ? "text" : "password"}
                  placeholder={
                    isIndonesian
                      ? "Kata sandi yang digunakan saat ekspor"
                      : "Passphrase used during export"
                  }
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  className="w-full bg-transparent text-[13px] outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowRestorePassphrase(!showRestorePassphrase)}
                  className="p-1 cursor-pointer shrink-0"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {showRestorePassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Mode: Merge vs Replace */}
            <div className="space-y-1.5">
              <label
                className="text-[12px] font-semibold block"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? "Strategi Pemulihan" : "Restoration Strategy"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRestoreMode("merge")}
                  className="p-2.5 rounded-xl text-left transition-all cursor-pointer"
                  style={{
                    background:
                      restoreMode === "merge"
                        ? isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : "rgba(0, 0, 0, 0.04)"
                        : "var(--glass-fill)",
                    border:
                      restoreMode === "merge"
                        ? isDark
                          ? "1px solid rgba(255, 255, 255, 0.16)"
                          : "1px solid rgba(0, 0, 0, 0.14)"
                        : "1px solid var(--glass-border)",
                    opacity: restoreMode === "merge" ? 1 : 0.6,
                  }}
                >
                  <span
                    className="text-[12px] font-semibold block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "Gabung Aman" : "Safe Merge"}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian
                      ? "Pertahankan data saat ini, impor item baru"
                      : "Preserves current data, imports new items"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreMode("replace")}
                  className="p-2.5 rounded-xl text-left transition-all cursor-pointer"
                  style={{
                    background:
                      restoreMode === "replace"
                        ? isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : "rgba(0, 0, 0, 0.04)"
                        : "var(--glass-fill)",
                    border:
                      restoreMode === "replace"
                        ? isDark
                          ? "1px solid rgba(255, 255, 255, 0.16)"
                          : "1px solid rgba(0, 0, 0, 0.14)"
                        : "1px solid var(--glass-border)",
                    opacity: restoreMode === "replace" ? 1 : 0.6,
                  }}
                >
                  <span
                    className="text-[12px] font-semibold block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "Ganti Bersih" : "Clean Replace"}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian
                      ? "Bersihkan transaksi lama sebelum mengimpor"
                      : "Purges existing transactions before import"}
                  </span>
                </button>
              </div>
            </div>

            {/* Progress Bar (if restoring) */}
            {isRestoring && restoreProgress && (
              <div className="space-y-1.5 py-1">
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: "var(--text-secondary)" }}>
                    {restoreProgress.stage}
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {restoreProgress.progress}%
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--glass-fill)" }}
                >
                  <div
                    className="h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${restoreProgress.progress}%`,
                      background: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Restore Action Button */}
            <button
              type="button"
              disabled={isRestoring || !parsedPayload || !restorePassphrase}
              onClick={handleExecuteRestore}
              className="w-full py-3.5 px-4 rounded-2xl text-[13.5px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-0 shadow-[0_2px_8px_rgba(0,0,0,0.18)] active:scale-[0.99]"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-primary)",
              }}
            >
              {isRestoring ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>
                    {isIndonesian
                      ? "Mendekripsi & Memulihkan..."
                      : "Decrypting & Restoring..."}
                  </span>
                </>
              ) : (
                <>
                  <Upload size={16} strokeWidth={1.75} />
                  <span>
                    {isIndonesian
                      ? "Dekripsi & Pulihkan Data"
                      : "Decrypt & Restore Data"}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

