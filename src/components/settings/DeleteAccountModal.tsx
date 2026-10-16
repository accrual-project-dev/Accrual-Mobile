import { useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { supabase } from "../../lib/supabase";
import { clearAllLocalUserSessionData } from "../../lib/sessionCleanup";
import { triggerHaptic } from "../../lib/haptics";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const { session, isGuest, signOut, exitGuestMode } = useAuth();
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const normalizedConfirm = confirmText.trim().toUpperCase();
  const expectedWord = isIndonesian ? "HAPUS" : "DELETE";
  const isConfirmed =
    normalizedConfirm === "DELETE" || normalizedConfirm === "HAPUS";

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    setIsDeleting(true);
    triggerHaptic("heavy");

    try {
      // 1. If connected to Supabase account, attempt server-side record cleanup
      if (session?.user?.id && !isGuest) {
        const userId = session.user.id;
        try {
          // Attempt atomic server-side full account & data wipe via RPC
          const { error: rpcErr } = await supabase.rpc("delete_user_account");
          if (rpcErr) {
            // Fallback: manual wipe across all tables including holdings, budgets, and ledgers
            await Promise.allSettled([
              supabase.from("transactions").delete().eq("user_id", userId),
              supabase.from("wallets").delete().eq("user_id", userId),
              supabase.from("categories").delete().eq("user_id", userId),
              supabase.from("bills").delete().eq("user_id", userId),
              supabase.from("goals").delete().eq("user_id", userId),
              supabase.from("holdings").delete().eq("user_id", userId),
              supabase.from("user_budgets").delete().eq("user_id", userId),
              supabase.from("user_shortcuts").delete().eq("user_id", userId),
              supabase.from("ledger_members").delete().eq("user_id", userId),
              supabase.from("ledgers").delete().eq("user_id", userId),
            ]);
          }
        } catch (serverErr) {
          console.warn("[DeleteAccount] Server wipe warning:", serverErr);
        }
      }

      // 2. Wipe all multi-tenant local storage, IndexedDB vault, biometric credentials & emit teardown event (Rule 8.2)
      await clearAllLocalUserSessionData();
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (storageErr) {
        console.warn("[DeleteAccount] LocalStorage clear error:", storageErr);
      }

      // 3. Clear auth session
      if (isGuest) {
        exitGuestMode();
      } else {
        await signOut();
      }

      showToast(
        isIndonesian
          ? "Akun dan brankas lokal berhasil dihapus."
          : "Account and local vault deleted.",
        "delete",
        () => {},
      );

      // 4. Force clean page reload to fresh welcome/login screen
      setTimeout(() => {
        window.location.href = "/";
      }, 300);
    } catch (err: any) {
      console.error("[DeleteAccount] Deletion failed:", err);
      showToast(
        err?.message ||
          (isIndonesian
            ? "Gagal menyelesaikan penghapusan akun."
            : "Failed to complete account deletion."),
        "delete",
        () => {},
      );
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmText("");
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose}>
      <div className="p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)] space-y-5">
        {/* Header Icon */}
        <div className="text-center">
          <div
            className="w-14 h-14 mx-auto rounded-3xl flex items-center justify-center mb-3 shadow-lg"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Trash2
              size={24}
              strokeWidth={1.75}
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <h3
            className="font-semibold text-[20px] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian
              ? "Hapus Akun & Reset Brankas"
              : "Delete Account & Reset Vault"}
          </h3>
          <p
            className="text-[12px] font-normal mt-1 max-w-xs mx-auto leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian
              ? "Tindakan ini akan menghapus seluruh transaksi, rekening, kategori kustom, dan kunci keamanan secara permanen."
              : "This will permanently wipe all transactions, accounts, custom categories, and security keys."}
          </p>
        </div>

        {/* Warning Callout */}
        <div
          className="p-4 rounded-[20px] space-y-2 border"
          style={{
            background: "var(--glass-fill)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <AlertTriangle size={16} strokeWidth={1.75} />
            <span className="text-[12px] font-semibold">
              {isIndonesian ? "Tindakan Permanen" : "Irreversible Action"}
            </span>
          </div>
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {isIndonesian
              ? "Setelah dihapus, brankas lokal terenkripsi Anda tidak dapat dipulihkan. Pastikan Anda telah mengekspor cadangan terlebih dahulu jika ingin menyimpan data."
              : "Once deleted, your encrypted local vault cannot be recovered. Ensure you have exported a backup if you wish to preserve your data."}
          </p>
        </div>

        {/* Confirmation Input */}
        <div className="space-y-2">
          <label
            className="text-[11px] font-semibold tracking-wide uppercase block"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? (
              <>
                Ketik{" "}
                <span
                  className="font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {expectedWord}
                </span>{" "}
                untuk mengonfirmasi
              </>
            ) : (
              <>
                Type{" "}
                <span
                  className="font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {expectedWord}
                </span>{" "}
                to confirm
              </>
            )}
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expectedWord}
            disabled={isDeleting}
            className="w-full px-4 py-3 rounded-xl text-[14px] font-semibold outline-none tracking-wider text-center"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            disabled={!isConfirmed || isDeleting}
            onClick={handleDelete}
            className="w-full py-3.5 px-4 rounded-[22px] font-semibold text-[13.5px] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{
              background:
                isConfirmed && !isDeleting
                  ? "var(--text-primary)"
                  : "var(--bg-elevated)",
              color:
                isConfirmed && !isDeleting
                  ? "var(--bg-primary)"
                  : "var(--text-tertiary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>
                  {isIndonesian
                    ? "Menghapus Brankas & Akun..."
                    : "Purging Vault & Account..."}
                </span>
              </>
            ) : (
              <>
                <Trash2 size={16} strokeWidth={1.75} />
                <span>
                  {isIndonesian
                    ? "Hapus Akun Secara Permanen"
                    : "Permanently Delete Account"}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={handleClose}
            className="w-full py-3 px-4 rounded-[22px] font-medium text-[13px] transition-all cursor-pointer text-center"
            style={{
              color: "var(--text-tertiary)",
            }}
          >
            {isIndonesian ? "Batal" : "Cancel"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

