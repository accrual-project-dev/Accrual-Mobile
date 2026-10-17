import { useState } from "react";
import {
  Zap,
  Plus,
  Trash2,
  PenLine,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  X,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import { useShortcuts, type Shortcut } from "../../hooks/useShortcuts";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useToast } from "../../contexts/ToastContext";
import { formatLiveAmountInput, generateUUID } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";

interface ShortcutManagementSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutManagementSheet({
  isOpen,
  onClose,
}: ShortcutManagementSheetProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { isIndonesian } = useLanguage();
  const { preferredCurrency, currencyMeta, convertToIdr, convertFromIdr, formatWithPreferred } = useCurrency();
  const { showToast } = useToast();
  const { shortcuts, saveShortcut, deleteShortcut } = useShortcuts();
  const { data: categories = [] } = useCategories();
  const { data: wallets = [] } = useWallets();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amountInput, setAmountInput] = useState("");
  const [amountRaw, setAmountRaw] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<string>("");
  const [walletId, setWalletId] = useState<string>("");
  const [note, setNote] = useState("");

  const allowDecimals = currencyMeta.decimals > 0;
  const maxDecimals = currencyMeta.decimals || 2;

  const filteredCategories = categories.filter((c) => c.type === type);

  const openNewForm = () => {
    triggerHaptic("light");
    setEditingId(null);
    setTitle("");
    setType("expense");
    setAmountInput("");
    setAmountRaw(0);
    const firstExpenseCat = categories.find((c) => c.type === "expense");
    setCategoryId(firstExpenseCat?.id || "");
    setWalletId(wallets[0]?.id || "");
    setNote("");
    setIsFormOpen(true);
  };

  const openEditForm = (s: Shortcut) => {
    triggerHaptic("light");
    setEditingId(s.id);
    setTitle(s.title);
    setType(s.type);
    const displayAmt =
      preferredCurrency === "IDR"
        ? s.amount
        : Number(convertFromIdr(s.amount).toFixed(maxDecimals));
    const formatted =
      displayAmt > 0
        ? formatLiveAmountInput(
            String(displayAmt),
            isIndonesian && !allowDecimals,
            allowDecimals,
            maxDecimals,
          )
        : { display: "", rawNumber: 0 };
    setAmountInput(formatted.display);
    setAmountRaw(formatted.rawNumber);
    setCategoryId(s.category_id || "");
    setWalletId(s.wallet_id || "");
    setNote(s.note || "");
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) {
      showToast(
        isIndonesian ? "Masukkan nama preset" : "Enter a preset title",
        "delete",
      );
      return;
    }
    const baseIdrAmount =
      amountRaw > 0
        ? Math.round(convertToIdr(amountRaw, preferredCurrency))
        : 0;

    saveShortcut({
      id: editingId || generateUUID(),
      title: title.trim(),
      type,
      amount: baseIdrAmount,
      category_id: categoryId,
      wallet_id: walletId,
      note: note.trim() || title.trim(),
    });
    triggerHaptic("medium");
    setIsFormOpen(false);
    showToast(
      editingId
        ? isIndonesian
          ? "Preset diperbarui"
          : "Preset updated"
        : isIndonesian
          ? "Preset ditambahkan"
          : "Preset added",
      editingId ? "update" : "add",
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="px-5 pt-2 pb-10 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <Zap size={16} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h3
                className="text-[16px] font-semibold tracking-tight truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? "Preset Transaksi Cepat"
                  : "Quick Transaction Presets"}
              </h3>
              <p
                className="text-[11px] font-medium truncate"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Isi otomatis nominal, kategori & akun dalam 1 ketukan"
                  : "Auto-fill amount, category & account in 1 tap"}
              </p>
            </div>
          </div>

          {!isFormOpen && (
            <button
              type="button"
              onClick={openNewForm}
              className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-base)",
              }}
            >
              <Plus size={13} strokeWidth={2.25} />
              <span>{isIndonesian ? "Tambah" : "Add"}</span>
            </button>
          )}
        </div>

        {isFormOpen ? (
          /* Preset Editor Form */
          <div
            className="p-4 rounded-2xl space-y-3.5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[12px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {editingId
                  ? isIndonesian
                    ? "Ubah Preset"
                    : "Edit Preset"
                  : isIndonesian
                    ? "Preset Baru"
                    : "New Preset"}
              </span>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
                style={{
                  background: "var(--glass-fill)",
                  color: "var(--text-tertiary)",
                }}
              >
                <X size={13} />
              </button>
            </div>

            {/* Type Toggle */}
            <div
              className="flex p-1 rounded-xl"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
            >
              {(
                [
                  {
                    key: "expense" as const,
                    label: isIndonesian ? "Pengeluaran" : "Expense",
                    icon: <ArrowDownCircle size={13} strokeWidth={1.75} />,
                  },
                  {
                    key: "income" as const,
                    label: isIndonesian ? "Pemasukan" : "Income",
                    icon: <ArrowUpCircle size={13} strokeWidth={1.75} />,
                  },
                ]
              ).map((t) => {
                const active = type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setType(t.key);
                      const firstCat = categories.find((c) => c.type === t.key);
                      setCategoryId(firstCat?.id || "");
                    }}
                    className="flex-1 py-1.5 rounded-lg text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    style={{
                      background: active ? "var(--text-primary)" : "transparent",
                      color: active ? "var(--bg-base)" : "var(--text-secondary)",
                    }}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Title */}
            <div>
              <label
                className="text-[10.5px] font-semibold uppercase tracking-wider mb-1 block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Nama Preset" : "Preset Name"}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isIndonesian
                    ? "cth. Kopi Pagi, Parkir, Bensin"
                    : "e.g. Morning Coffee, Parking, Fuel"
                }
                className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium outline-none"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {/* Nominal Amount */}
            <div>
              <label
                className="text-[10.5px] font-semibold uppercase tracking-wider mb-1 block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? `Nominal (${currencyMeta.code})`
                  : `Amount (${currencyMeta.code})`}
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <span
                  className="text-[13px] font-semibold shrink-0"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {currencyMeta.symbol}
                </span>
                <input
                  type="text"
                  inputMode={allowDecimals ? "decimal" : "numeric"}
                  value={amountInput}
                  onChange={(e) => {
                    const parsed = formatLiveAmountInput(
                      e.target.value,
                      isIndonesian && !allowDecimals,
                      allowDecimals,
                      maxDecimals,
                    );
                    setAmountInput(parsed.display);
                    setAmountRaw(parsed.rawNumber);
                  }}
                  placeholder="0"
                  className="w-full bg-transparent outline-none text-[14px] font-semibold amount"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </div>

            {/* Category & Account Selectors */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  className="text-[10.5px] font-semibold uppercase tracking-wider mb-1 block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Kategori" : "Category"}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-xl text-[12px] font-medium outline-none"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">
                    {isIndonesian ? "Otomatis" : "Default"}
                  </option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="text-[10.5px] font-semibold uppercase tracking-wider mb-1 block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Akun" : "Account"}
                </label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-xl text-[12px] font-medium outline-none"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">
                    {isIndonesian ? "Otomatis" : "Default"}
                  </option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note */}
            <div>
              <label
                className="text-[10.5px] font-semibold uppercase tracking-wider mb-1 block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Catatan (Opsional)" : "Note (Optional)"}
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isIndonesian
                    ? "Catatan transaksi..."
                    : "Transaction note..."
                }
                className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium outline-none"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-base)",
              }}
            >
              <Check size={15} strokeWidth={2.25} />
              <span>
                {editingId
                  ? isIndonesian
                    ? "Simpan Perubahan"
                    : "Save Changes"
                  : isIndonesian
                    ? "Simpan Preset"
                    : "Save Preset"}
              </span>
            </button>
          </div>
        ) : shortcuts.length === 0 ? (
          /* Empty State */
          <div
            className="p-6 rounded-2xl text-center space-y-2.5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-tertiary)",
              }}
            >
              <Zap size={18} strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p
                className="text-[13px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? "Belum ada preset tersimpan"
                  : "No saved presets yet"}
              </p>
              <p
                className="text-[11.5px] max-w-[260px] mx-auto leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Buat tombol cepat untuk transaksi rutin seperti kopi, parkir, atau langganan agar pencatatan lebih instan."
                  : "Create 1-tap chips for frequent transactions like coffee, parking, or transit for instant logging."}
              </p>
            </div>
            <button
              type="button"
              onClick={openNewForm}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold active:scale-95 transition-all cursor-pointer mt-1"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <Plus size={13} strokeWidth={2} />
              <span>
                {isIndonesian ? "Buat Preset Pertama" : "Create First Preset"}
              </span>
            </button>
          </div>
        ) : (
          /* List of Saved Shortcuts */
          <div className="space-y-2">
            {shortcuts.map((s) => {
              const cat = categories.find((c) => c.id === s.category_id);
              const wal = wallets.find((w) => w.id === s.wallet_id);
              return (
                <div
                  key={s.id}
                  className="p-3 rounded-2xl flex items-center justify-between gap-3"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <div
                    onClick={() => openEditForm(s)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: "var(--glass-fill)",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      {cat?.emoji ? (
                        <IconRenderer icon={cat.emoji} size="w-4 h-4" />
                      ) : (
                        <Zap
                          size={15}
                          strokeWidth={1.75}
                          style={{ color: "var(--text-secondary)" }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[13px] font-semibold truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {s.title}
                        </span>
                        <span
                          className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                          style={{
                            background: isDark
                              ? "rgba(255,255,255,0.06)"
                              : "rgba(0,0,0,0.05)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {s.type === "income"
                            ? isIndonesian
                              ? "Pemasukan"
                              : "Income"
                            : isIndonesian
                              ? "Pengeluaran"
                              : "Expense"}
                        </span>
                      </div>
                      <div
                        className="text-[11px] truncate mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        <span
                          className="font-semibold amount"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {s.amount > 0
                            ? formatWithPreferred(s.amount)
                            : isIndonesian
                              ? "Nominal fleksibel"
                              : "Flexible amount"}
                        </span>
                        {cat ? ` · ${cat.name}` : ""}
                        {wal ? ` · ${wal.name}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(s)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                      style={{
                        background: "var(--glass-fill)",
                        color: "var(--text-secondary)",
                      }}
                      title={isIndonesian ? "Ubah" : "Edit"}
                    >
                      <PenLine size={13.5} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        deleteShortcut(s.id);
                        showToast(
                          isIndonesian ? "Preset dihapus" : "Preset removed",
                          "delete",
                        );
                      }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                      style={{
                        background: "var(--glass-fill)",
                        color: "var(--text-tertiary)",
                      }}
                      title={isIndonesian ? "Hapus" : "Delete"}
                    >
                      <Trash2 size={13.5} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
