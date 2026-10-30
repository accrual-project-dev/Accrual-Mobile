import { useState, useMemo } from "react";
import {
  Zap,
  Plus,
  Trash2,
  PenLine,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  X,
  Link2,
  Play,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { GlassSelect } from "../ui/GlassSelect";
import { IconRenderer } from "../ui/IconRenderer";
import { useShortcuts, type Shortcut } from "../../hooks/useShortcuts";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import { useSpace } from "../../contexts/SpaceContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useToast } from "../../contexts/ToastContext";
import { formatLiveAmountInput, generateUUID } from "../../lib/utils";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { saveDraftBatch, resolveActiveDraftSpaceId } from "../../lib/draftTransactionService";
import { showNativeLocalNotification, formatNotificationCurrency } from "../../lib/notifications";
import { format } from "date-fns";

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
  const {
    preferredCurrency,
    currencyMeta,
    convertToIdr,
    convertFromIdr,
    formatWithPreferred,
  } = useCurrency();
  const { showToast } = useToast();
  const { shortcuts, saveShortcut, deleteShortcut } = useShortcuts();
  const { data: categories = [] } = useCategories();
  const { data: wallets = [] } = useWallets();
  const { activeSpaceId, activeSpace, defaultSpaceId } = useSpace();

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

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );

  const categoryOptions = useMemo(
    () => [
      {
        value: "",
        label: isIndonesian ? "Otomatis" : "Default",
      },
      ...filteredCategories.map((c) => ({
        value: c.id,
        label: c.name,
        icon: c.emoji,
      })),
    ],
    [filteredCategories, isIndonesian],
  );

  const walletOptions = useMemo(
    () => [
      {
        value: "",
        label: isIndonesian ? "Otomatis" : "Default",
      },
      ...wallets.map((w) => ({
        value: w.id,
        label: w.name,
        icon: w.icon,
      })),
    ],
    [wallets, isIndonesian],
  );

  const activeSpaceLabel =
    activeSpace?.id !== "all" && activeSpace?.name
      ? activeSpace.name
      : isIndonesian
      ? "Space Pribadi"
      : "Personal Space";

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
        "error",
      );
      return;
    }
    const baseIdrAmount =
      amountRaw > 0
        ? Math.round(convertToIdr(amountRaw, preferredCurrency))
        : 0;

    const trimmedNote = note.trim();
    const finalNote =
      trimmedNote === "-" || trimmedNote === "--"
        ? ""
        : trimmedNote || title.trim();

    saveShortcut({
      id: editingId || generateUUID(),
      title: title.trim(),
      type,
      amount: baseIdrAmount,
      category_id: categoryId,
      wallet_id: walletId,
      note: finalNote,
    });
    triggerHaptic("medium");
    setIsFormOpen(false);
    showToast(
      editingId
        ? isIndonesian
          ? "Preset diperbarui & disinkronkan"
          : "Preset updated & synced"
        : isIndonesian
        ? "Preset ditambahkan & disinkronkan"
        : "Preset added & synced",
      editingId ? "update" : "add",
    );
  };

  const handleCopyScheme = (s: Shortcut) => {
    triggerHaptic("light");
    const cat = categories.find((c) => c.id === s.category_id);
    const wal = wallets.find((w) => w.id === s.wallet_id);
    const params = new URLSearchParams();
    if (s.amount > 0) params.append("amount", String(s.amount));
    params.append("type", s.type);
    if (cat?.name) params.append("category", cat.name);
    if (wal?.name) params.append("wallet", wal.name);
    if (s.note || s.title) params.append("note", s.note || s.title);
    params.append("draft", "true");

    const scheme = `accrual://add?${params.toString()}`;
    navigator.clipboard.writeText(scheme);
    showToast(
      isIndonesian ? "Skema URL pintasan disalin" : "Shortcut scheme URL copied",
      "add",
    );
  };

  const handleQueuePresetToDraft = (s: Shortcut) => {
    triggerSuccessHaptic();
    const targetSpaceId = resolveActiveDraftSpaceId(
      activeSpaceId !== "all" ? activeSpaceId : defaultSpaceId,
    );
    const cat =
      categories.find((c) => c.id === s.category_id) ||
      categories.find((c) => c.type === s.type) ||
      categories[0];
    const wal = wallets.find((w) => w.id === s.wallet_id) || wallets[0];
    const now = new Date();
    const effectiveAmount = s.amount > 0 ? s.amount : 25000;

    const draftItem = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: format(now, "yyyy-MM-dd"),
      time: format(now, "HH:mm"),
      description: s.note || s.title,
      cleanDescription: s.note || s.title,
      amount: effectiveAmount,
      type: s.type,
      walletId: wal?.id || null,
      walletName: wal?.name || "BCA",
      suggestedCategoryId: cat?.id || null,
      suggestedCategoryName: cat?.name || s.title,
      suggestedCategoryEmoji: cat?.emoji || null,
      isDuplicate: false,
      selected: true,
      raw: s.title,
      confidence: 0.98,
      needsReview: false,
      spaceId: targetSpaceId,
      spaceName: activeSpaceLabel,
    };

    saveDraftBatch([draftItem], s.title, "manual", targetSpaceId);

    void showNativeLocalNotification({
      title: isIndonesian
        ? `Draft Masuk • ${activeSpaceLabel}`
        : `Draft Queued • ${activeSpaceLabel}`,
      body: `${s.type === "expense" ? "-" : "+"}${formatNotificationCurrency(
        effectiveAmount,
      )} • ${s.title}${wal?.name ? ` (${wal.name})` : ""}`,
    });

    showToast(
      isIndonesian
        ? `"${s.title}" masuk ke Draft (${activeSpaceLabel})`
        : `"${s.title}" queued in Draft (${activeSpaceLabel})`,
      "add",
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="px-5 pt-2 space-y-4 select-none"
        style={{
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
        }}
      >
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
                  ? `Tersinkronisasi ke Cloud · Target: ${activeSpaceLabel}`
                  : `Cloud Synced · Target: ${activeSpaceLabel}`}
              </p>
            </div>
          </div>

          {!isFormOpen && (
            <button
              type="button"
              onClick={openNewForm}
              aria-label={isIndonesian ? "Tambah preset baru" : "Add new preset"}
              title={isIndonesian ? "Tambah preset baru" : "Add new preset"}
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
          /* Preset Editor Form — Unified Liquid Glass Styling */
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
                aria-label={
                  isIndonesian ? "Tutup formulir preset" : "Close preset form"
                }
                title={isIndonesian ? "Tutup" : "Close"}
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

            {/* Category & Account Glass Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <GlassSelect
                label={isIndonesian ? "Kategori" : "Category"}
                value={categoryId}
                onChange={setCategoryId}
                options={categoryOptions}
                placeholder={isIndonesian ? "Otomatis" : "Default"}
              />

              <GlassSelect
                label={isIndonesian ? "Akun" : "Account"}
                value={walletId}
                onChange={setWalletId}
                options={walletOptions}
                placeholder={isIndonesian ? "Otomatis" : "Default"}
              />
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
                  isIndonesian ? "Catatan transaksi..." : "Transaction note..."
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
                  ? "Buat tombol cepat untuk transaksi rutin seperti kopi, parkir, atau bensin agar pencatatan ke Space Aktif lebih instan."
                  : "Create 1-tap chips for frequent transactions like coffee, parking, or transit for instant logging into your Active Space."}
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
                  <button
                    type="button"
                    onClick={() => openEditForm(s)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer bg-transparent border-0 p-0"
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
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {s.amount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleQueuePresetToDraft(s)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                        style={{
                          background: "var(--glass-fill)",
                          color: "var(--text-primary)",
                        }}
                        aria-label={
                          isIndonesian
                            ? `Masukkan ${s.title} ke Draft`
                            : `Queue ${s.title} to Draft`
                        }
                        title={
                          isIndonesian
                            ? "Masukkan ke Draft Space Aktif"
                            : "Queue to Active Space Draft"
                        }
                      >
                        <Play size={13} strokeWidth={2} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyScheme(s)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                      style={{
                        background: "var(--glass-fill)",
                        color: "var(--text-secondary)",
                      }}
                      aria-label={
                        isIndonesian
                          ? `Salin skema URL ${s.title}`
                          : `Copy URL scheme ${s.title}`
                      }
                      title={isIndonesian ? "Salin Skema" : "Copy Scheme"}
                    >
                      <Link2 size={13.5} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditForm(s)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                      style={{
                        background: "var(--glass-fill)",
                        color: "var(--text-secondary)",
                      }}
                      aria-label={
                        isIndonesian
                          ? `Ubah preset ${s.title}`
                          : `Edit preset ${s.title}`
                      }
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
                      aria-label={
                        isIndonesian
                          ? `Hapus preset ${s.title}`
                          : `Delete preset ${s.title}`
                      }
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
