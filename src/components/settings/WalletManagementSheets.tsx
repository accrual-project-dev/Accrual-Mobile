import { useState, useMemo, useEffect, Fragment } from "react";
import { Plus, Trash2, Scale, Check, ChevronRight, Search, X, AlertCircle } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { GlassConfirmationModal } from "../ui/GlassConfirmationModal";
import { IconRenderer } from "../ui/IconRenderer";
import { MonochromeIconPickerModal } from "../ui/MonochromeIconPickerModal";
import {
  useWallets,
  useAddWallet,
  useUpdateWallet,
  useDeleteWallet,
  WALLET_PRESETS,
  getWalletIcon,
  resolveWalletClassification,
} from "../../hooks/useWallets";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import { useCategories } from "../../hooks/useCategories";
import { useAddTransaction } from "../../hooks/useTransactions";
import { formatLiveAmountInput } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { format } from "date-fns";
import type { Wallet, AccountClassification } from "../../lib/types";

interface WalletManagementSheetsProps {
  isOpen: boolean;
  onClose: () => void;
  initialWalletToEdit?: Wallet | null;
  zIndex?: number;
}

export function WalletManagementSheets({
  isOpen,
  onClose,
  initialWalletToEdit,
  zIndex,
}: WalletManagementSheetsProps) {
  const { data: wallets = [] } = useWallets();
  const addWallet = useAddWallet();
  const updateWallet = useUpdateWallet();
  const deleteWallet = useDeleteWallet();
  const { balancesById, balancesByName, totalAssets } = useWalletBalances();
  const { data: categories = [] } = useCategories();
  const addTx = useAddTransaction();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();
  const {
    preferredCurrency,
    currencyMeta,
    convertToIdr,
    convertFromIdr,
    formatWithPreferred,
  } = useCurrency();
  const allowDecimals = currencyMeta.decimals > 0;
  const maxDecimals = currencyMeta.decimals;
  const isDark = theme !== "light";
  const dividerGradient = isDark
    ? "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 20%, rgba(255, 255, 255, 0.06) 80%, transparent 100%)"
    : "linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.04) 20%, rgba(0, 0, 0, 0.04) 80%, transparent 100%)";

  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [walletName, setWalletName] = useState("");
  const [walletIcon, setWalletIcon] = useState("Wallet");
  const [initialBalanceRaw, setInitialBalanceRaw] = useState("");
  const [initialBalanceDisplay, setInitialBalanceDisplay] = useState("");
  const [hasCustomPickedWalletIcon, setHasCustomPickedWalletIcon] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<"add" | "edit" | null>(null);

  const [walletSearch, setWalletSearch] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<
    "all" | "liquid" | "investment" | "debt"
  >("all");
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const [editWallet, setEditWallet] = useState<{
    id: string;
    name: string;
    icon: string;
    classification?: AccountClassification;
  } | null>(null);

  useEffect(() => {
    if (initialWalletToEdit && isOpen) {
      setEditWallet({
        id: initialWalletToEdit.id,
        name: initialWalletToEdit.name,
        icon: initialWalletToEdit.icon || "Wallet",
        classification: resolveWalletClassification(initialWalletToEdit),
      });
    }
  }, [initialWalletToEdit, isOpen]);

  const handleCloseEditWallet = () => {
    setEditWallet(null);
    if (initialWalletToEdit) {
      onClose();
    }
  };

  const [correctWallet, setCorrectWallet] = useState<{
    id: string;
    name: string;
    icon: string;
    currentBalance: number;
  } | null>(null);
  const [correctTargetBalance, setCorrectTargetBalance] = useState("");
  const [correctTargetDisplay, setCorrectTargetDisplay] = useState("");
  const [correctNote, setCorrectNote] = useState("");
  const [correctEffectiveDate, setCorrectEffectiveDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);

  const [presetFilter, setPresetFilter] = useState<"all" | "local" | "global" | "invest">("all");

  const activeWalletNames = useMemo(
    () => new Set(wallets.map((w) => w.name.trim().toLowerCase())),
    [wallets],
  );

  const isDuplicateWalletName = useMemo(() => {
    const trimmed = walletName.trim().toLowerCase();
    if (!trimmed) return false;
    return activeWalletNames.has(trimmed);
  }, [walletName, activeWalletNames]);

  const isDuplicateEditWalletName = useMemo(() => {
    if (!editWallet) return false;
    const trimmed = editWallet.name.trim().toLowerCase();
    if (!trimmed) return false;
    return wallets.some(
      (w) => w.id !== editWallet.id && w.name.trim().toLowerCase() === trimmed,
    );
  }, [editWallet, wallets]);

  const availableDefaultWallets = useMemo(
    () =>
      WALLET_PRESETS.filter(
        (name) => !activeWalletNames.has(name.toLowerCase()),
      ),
    [activeWalletNames],
  );

  const filteredPresets = useMemo(() => {
    return availableDefaultWallets.filter((name) => {
      if (presetFilter === "all") return true;
      const lower = name.toLowerCase();
      if (presetFilter === "global") {
        return lower === "paypal" || lower === "wise" || lower === "revolut";
      }
      if (presetFilter === "invest") {
        return (
          lower.includes("brokerage") ||
          lower.includes("crypto") ||
          lower.includes("saham") ||
          lower.includes("reksa") ||
          lower.includes("usdt")
        );
      }
      if (presetFilter === "local") {
        return !(
          lower === "paypal" ||
          lower === "wise" ||
          lower === "revolut" ||
          lower.includes("brokerage") ||
          lower.includes("crypto") ||
          lower.includes("saham") ||
          lower.includes("reksa") ||
          lower.includes("usdt")
        );
      }
      return true;
    });
  }, [availableDefaultWallets, presetFilter]);

  const unusedZeroWallets = useMemo(() => {
    return wallets.filter((w) => {
      const bal = balancesById[w.id] ?? balancesByName[w.name.toLowerCase()] ?? 0;
      return bal === 0;
    });
  }, [wallets, balancesById, balancesByName]);

  const filteredWallets = useMemo(() => {
    return wallets
      .filter((w) => {
        const cls = w.classification || resolveWalletClassification(w);
        const matchesClassification =
          classificationFilter === "all" ||
          (classificationFilter === "debt"
            ? cls === "credit" || cls === "loan"
            : cls === classificationFilter);
        const matchesSearch =
          !walletSearch.trim() ||
          w.name.toLowerCase().includes(walletSearch.toLowerCase().trim());
        return matchesClassification && matchesSearch;
      })
      .sort((a, b) => {
        const balA = balancesById[a.id] ?? balancesByName[a.name.toLowerCase()] ?? 0;
        const balB = balancesById[b.id] ?? balancesByName[b.name.toLowerCase()] ?? 0;
        if (balB !== balA) {
          return balB - balA;
        }
        return a.name.localeCompare(b.name);
      });
  }, [wallets, classificationFilter, walletSearch, balancesById, balancesByName]);

  const handleSaveWallet = () => {
    if (!walletName.trim() || isDuplicateWalletName) return;
    const name = walletName.trim();
    const chosenIcon = walletIcon || getWalletIcon(name) || "Wallet";
    const initVal = Number(initialBalanceRaw || 0);
    const initAmountIdr =
      initVal > 0
        ? preferredCurrency === "IDR"
          ? Math.round(initVal)
          : Math.round(convertToIdr(initVal, preferredCurrency))
        : 0;

    addWallet.mutate(
      { name, icon: chosenIcon },
      {
        onSuccess: (createdWallet: any) => {
          if (initAmountIdr > 0 && createdWallet?.id) {
            const otherCat =
              categories.find((c) => c.name.toLowerCase() === "lainnya") ||
              categories[0];
            const todayStr = format(new Date(), "yyyy-MM-dd");
            addTx.mutate({
              type: "income",
              amount: initAmountIdr,
              wallet_id: createdWallet.id,
              note: isIndonesian ? `Saldo Awal (${name})` : `Initial Balance (${name})`,
              occurred_on: todayStr,
              created_at: new Date().toISOString(),
              category_id: otherCat?.id || null,
            });
          }
          setAddWalletOpen(false);
          setWalletName("");
          setWalletIcon("Wallet");
          setInitialBalanceRaw("");
          setInitialBalanceDisplay("");
          setHasCustomPickedWalletIcon(false);
          showToast(isIndonesian ? "Akun ditambahkan" : "Account added", "add", () => {});
        },
      },
    );
  };

  const targetBalanceIdr = useMemo(() => {
    const rawNum = Number(correctTargetBalance || 0);
    if (isNaN(rawNum)) return 0;
    return preferredCurrency === "IDR"
      ? Math.round(rawNum)
      : Math.round(convertToIdr(rawNum, preferredCurrency));
  }, [correctTargetBalance, preferredCurrency, convertToIdr]);

  const handleSaveCorrection = () => {
    if (!correctWallet || isSavingCorrection) return;
    const target = targetBalanceIdr;
    const diff = target - correctWallet.currentBalance;
    if (diff === 0) {
      setCorrectWallet(null);
      showToast(isIndonesian ? "Tidak ada perubahan saldo" : "No balance change", "update", () => {});
      return;
    }

    setIsSavingCorrection(true);
    const matchingWallet = wallets.find(
      (w) =>
        w.id === correctWallet.id ||
        w.name.toLowerCase() === correctWallet.name.toLowerCase(),
    );
    const isValidUuid = (id?: string | null) =>
      !!id && id.trim().length > 0;
    const walletIdToSave = isValidUuid(matchingWallet?.id)
      ? matchingWallet!.id
      : null;

    const isPositive = diff > 0;
    const noteToSave = correctNote.trim()
      ? (isIndonesian
          ? `Penyesuaian (${isPositive ? "+" : "-"}) ${correctWallet.name}: ${correctNote.trim()}`
          : `Correction (${isPositive ? "+" : "-"}) ${correctWallet.name}: ${correctNote.trim()}`)
      : (isIndonesian
          ? `Penyesuaian (${isPositive ? "+" : "-"}) ${correctWallet.name}`
          : `Correction (${isPositive ? "+" : "-"}) ${correctWallet.name}`);

    const otherCat =
      categories.find((c) => c.name.toLowerCase() === "lainnya") ||
      categories[0];
    const catIdToSave = isValidUuid(otherCat?.id) ? otherCat.id : null;

    const txDate =
      correctEffectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(correctEffectiveDate)
        ? correctEffectiveDate
        : format(new Date(), "yyyy-MM-dd");

    const timePart = format(new Date(), "HH:mm:ss");
    const fullOccurredOn = `${txDate}T${timePart}`;

    addTx.mutate(
      {
        type: isPositive ? "income" : "expense",
        amount: Math.abs(diff),
        wallet_id: walletIdToSave,
        note: noteToSave,
        occurred_on: fullOccurredOn,
        created_at: new Date(`${txDate}T${timePart}`).toISOString(),
        category_id: catIdToSave,
      },
      {
        onSuccess: () => {
          setIsSavingCorrection(false);
          setCorrectWallet(null);
          setCorrectEffectiveDate(format(new Date(), "yyyy-MM-dd"));
          showToast(
            isIndonesian
              ? `Saldo disesuaikan ke ${formatWithPreferred(target)}`
              : `Balance corrected to ${formatWithPreferred(target)}`,
            "update",
          );
        },
        onError: (err: any) => {
          setIsSavingCorrection(false);
          console.error("Balance correction error:", err);
          showToast(
            err?.message ||
              (isIndonesian
                ? "Gagal menyesuaikan saldo"
                : "Failed to adjust balance"),
            "delete",
          );
        },
      },
    );
  };

  return (
    <>
      {/* Manage Accounts & Wallets Sheet */}
      <BottomSheet
        isOpen={isOpen && !initialWalletToEdit}
        onClose={onClose}
        zIndex={zIndex}
      >
        <div
          className="p-5 space-y-4"
          style={{
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)",
          }}
        >
          {/* Apple-style Typographic Hero Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Akun Saya" : "My Accounts"}
              </p>
              <h2 className="amount  text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight mt-0.5">
                {formatWithPreferred(totalAssets)}
              </h2>
              <p className="text-[11px] font-medium text-[var(--text-tertiary)] mt-0.5">
                {wallets.length} {isIndonesian ? "akun terdaftar · Rekapitulasi Neraca" : "registered accounts · Balance Summary"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                setTimeout(() => setAddWalletOpen(true), 300);
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold shadow-md active:scale-95 shrink-0 cursor-pointer transition-transform"
              style={{
                background: "var(--accent)",
                color: "var(--accent-ink)",
              }}
              title={isIndonesian ? "Tambah Akun Baru" : "Add New Account"}
            >
              <Plus size={18} strokeWidth={2.25} />
            </button>
          </div>

          {/* Minimalist Search & Floating Filter Strip */}
          <div className="space-y-2.5">
            {/* Quick Search - Frameless Ambient Bar */}
            <div
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.035)",
              }}
            >
              <Search size={14} style={{ color: "var(--text-tertiary)" }} />
              <input
                type="text"
                value={walletSearch}
                onChange={(e) => setWalletSearch(e.target.value)}
                placeholder={isIndonesian ? "Cari akun (cth. BCA, GoPay, Tunai)..." : "Search accounts (e.g. BCA, GoPay, Cash)..."}
                className="bg-transparent text-[12.5px] font-medium flex-1 outline-none min-w-0"
                style={{ color: "var(--text-primary)" }}
              />
              {walletSearch && (
                <button
                  type="button"
                  onClick={() => setWalletSearch("")}
                  className="w-4 h-4 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Floating Filter Chips - Individual Apple-Style Frosted Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {(
                [
                  { id: "all", label: `${isIndonesian ? "Semua" : "All"} (${wallets.length})` },
                  {
                    id: "liquid",
                    label: `${isIndonesian ? "Likuid" : "Liquid"} (${
                      wallets.filter(
                        (w) =>
                          (w.classification || resolveWalletClassification(w)) ===
                          "liquid",
                      ).length
                    })`,
                  },
                  {
                    id: "investment",
                    label: `${isIndonesian ? "Investasi" : "Invest"} (${
                      wallets.filter(
                        (w) =>
                          (w.classification || resolveWalletClassification(w)) ===
                          "investment",
                      ).length
                    })`,
                  },
                  {
                    id: "debt",
                    label: `${isIndonesian ? "Utang" : "Debt"} (${
                      wallets.filter((w) => {
                        const cls =
                          w.classification || resolveWalletClassification(w);
                        return cls === "credit" || cls === "loan";
                      }).length
                    })`,
                  },
                ] as const
              ).map((tab) => {
                const isActive = classificationFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setClassificationFilter(tab.id);
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-[var(--text-primary)] text-[var(--bg-base)] font-semibold shadow-sm"
                        : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    }`}
                    style={
                      !isActive
                        ? {
                            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
                            border: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.04)",
                          }
                        : undefined
                    }
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2-Column Luxury Pill Grid */}
          <div className="pb-8">
            {filteredWallets.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p
                  className="text-[12px] font-medium"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {walletSearch.trim()
                    ? (isIndonesian
                        ? `Tidak ada akun yang cocok dengan "${walletSearch}"`
                        : `No accounts matching "${walletSearch}"`)
                    : (isIndonesian
                        ? "Tidak ada akun dalam kategori ini"
                        : "No accounts found in this category")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setTimeout(() => setAddWalletOpen(true), 300);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-all cursor-pointer"
                >
                  <Plus size={13} strokeWidth={2} />
                  <span>{isIndonesian ? "Tambah Akun Baru" : "Add New Account"}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                <div
                  className="h-[1px] w-full shrink-0"
                  style={{ background: dividerGradient }}
                />
                {filteredWallets.map((w, index) => {
                  const bal =
                    balancesById[w.id] ?? balancesByName[w.name.toLowerCase()] ?? 0;
                  const isZero = bal === 0;
                  const cls =
                    w.classification || resolveWalletClassification(w);
                  const isInvest = cls === "investment";
                  const isLiability = cls === "credit" || cls === "loan";

                  return (
                    <Fragment key={w.id}>
                      {index > 0 && (
                        <div
                          className="h-[1px] w-full shrink-0"
                          style={{ background: dividerGradient }}
                        />
                      )}
                      <div
                        onClick={() =>
                          setEditWallet({
                            id: w.id,
                            name: w.name,
                            icon: w.icon || getWalletIcon(w.name),
                            classification: cls,
                          })
                        }
                        className="py-3.5 flex items-center justify-between group cursor-pointer active:opacity-70 transition-opacity"
                      >
                        {/* Left Column: Clean Unboxed Icon + Name with Chevron + Subtitle */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 flex items-center justify-center shrink-0 text-[var(--text-secondary)]">
                            <IconRenderer
                              icon={w.icon || getWalletIcon(w.name)}
                              size="w-5 h-5"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-[14.5px] font-semibold tracking-tight truncate"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {w.name}
                              </span>
                              <ChevronRight
                                size={13}
                                className="text-[var(--text-tertiary)] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0"
                              />
                            </div>
                            <p
                              className="text-[11px] font-medium mt-0.5 truncate"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              <span>
                                {isInvest
                                  ? (isIndonesian ? "Aset Investasi" : "Investment")
                                  : isLiability
                                  ? (isIndonesian ? "Liabilitas / Utang" : "Liability / Debt")
                                  : (isIndonesian ? "Kas Likuid" : "Liquid Cash")}
                              </span>
                              {" · "}
                              <span>
                                {isZero
                                  ? (isIndonesian ? "Akun Dorman (Rp 0)" : "Dormant Account (Rp 0)")
                                  : (isIndonesian ? "Akun Aktif" : "Active Account")}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Right Column: Untruncated Tabular Balance + Quick Adjust Button */}
                        <div className="flex items-center gap-3 shrink-0 pl-2">
                          <div className="text-right">
                            <p
                              className={`amount  text-[15px] font-bold leading-tight ${
                                isZero ? "opacity-40" : ""
                              }`}
                              style={{
                                color: isZero ? "var(--text-tertiary)" : "var(--text-primary)",
                              }}
                            >
                              {formatWithPreferred(bal)}
                            </p>
                            <p
                              className="text-[10px] mt-0.5 font-medium"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {isIndonesian ? "Saldo Riil" : "Real Balance"}
                            </p>
                          </div>

                          {/* Quick Balance Adjustment Button (Scale Icon) - Unboxed Apple Style */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic("light");
                              onClose();
                              const initDisplayAmt =
                                preferredCurrency === "IDR"
                                  ? bal
                                  : Number(
                                      convertFromIdr(bal).toFixed(maxDecimals),
                                    );
                              const { raw, formatted } = formatLiveAmountInput(
                                initDisplayAmt > 0 ? String(initDisplayAmt) : "",
                                isIndonesian && !allowDecimals,
                                allowDecimals,
                                maxDecimals,
                              );
                              setTimeout(() => {
                                setCorrectWallet({
                                  id: w.id,
                                  name: w.name,
                                  icon: w.icon || getWalletIcon(w.name),
                                  currentBalance: bal,
                                });
                                setCorrectTargetBalance(raw ? String(raw) : "0");
                                setCorrectTargetDisplay(formatted);
                                setCorrectNote("");
                                setCorrectEffectiveDate(format(new Date(), "yyyy-MM-dd"));
                              }, 300);
                            }}
                            className="w-8 h-8 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90 transition-all cursor-pointer shrink-0"
                            title={isIndonesian ? "Sesuaikan Saldo" : "Adjust Balance"}
                          >
                            <Scale size={15} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
                <div
                  className="h-[1px] w-full shrink-0"
                  style={{ background: dividerGradient }}
                />
              </div>
            )}

            {/* Bottom Footnote: Purge Unused Rp 0 Wallets */}
            {unusedZeroWallets.length >= 2 && wallets.length > 1 && (
              <div
                className="mt-4 p-3 rounded-2xl border flex items-center justify-between text-[11px] transition-all"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.02)",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] opacity-60 shrink-0" />
                  <span className="truncate" style={{ color: "var(--text-tertiary)" }}>
                    <strong className="font-semibold text-[var(--text-secondary)]">
                      {unusedZeroWallets.length} {isIndonesian ? "akun" : "accounts"}
                    </strong>{" "}
                    {isIndonesian ? "bersaldo 0" : "with 0 balance"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("medium");
                    setConfirmModalConfig({
                      isOpen: true,
                      title: isIndonesian
                        ? `Hapus ${unusedZeroWallets.length} Akun Kosong?`
                        : `Delete ${unusedZeroWallets.length} Empty Accounts?`,
                      description: isIndonesian
                        ? "Akun bersaldo 0 akan dihapus dari daftar akun. Akun aktif dengan saldo atau riwayat tidak akan terpengaruh."
                        : "Accounts with 0 balance will be removed. Active accounts with positive balances will not be touched.",
                      confirmLabel: isIndonesian ? "Hapus Akun Kosong" : "Delete Empty Accounts",
                      onConfirm: () => {
                        unusedZeroWallets.forEach((w) => deleteWallet.mutate(w.id));
                        showToast(
                          isIndonesian
                            ? `${unusedZeroWallets.length} akun kosong dihapus`
                            : `${unusedZeroWallets.length} empty accounts removed`,
                          "delete",
                        );
                      },
                    });
                  }}
                  className="font-semibold hover:underline shrink-0 pl-2 transition-all cursor-pointer text-[var(--text-primary)]"
                >
                  {isIndonesian ? "Bersihkan Akun Kosong" : "Purge Unused Accounts"}
                </button>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Balance Correction Sheet */}
      <BottomSheet
        isOpen={!!correctWallet}
        onClose={() => {
          if (!isSavingCorrection) setCorrectWallet(null);
        }}
        zIndex={zIndex ? zIndex + 2 : undefined}
      >
        <div className="p-5 pb-10 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <IconRenderer
                icon={correctWallet?.icon || "/icons/wallet.png"}
                size="w-6 h-6"
              />
            </div>
            <div>
              <h3
                className="font-semibold text-lg leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? "Sesuaikan Saldo" : "Adjust Balance"} ({correctWallet?.name})
              </h3>
              <p
                className="text-[11px] font-semibold mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Saldo Saat Ini: " : "Current Balance: "}
                <span className="amount font-bold text-[var(--text-primary)]">
                  {formatWithPreferred(correctWallet?.currentBalance || 0)}
                </span>
              </p>
            </div>
          </div>

          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? `Saldo Sebenarnya / Saldo Baru (${currencyMeta.code})`
                : `Actual / Correct Balance (${currencyMeta.code})`}
            </label>
            <div
              className="w-full p-3.5 rounded-2xl flex items-center gap-2.5"
              style={{
                background: "var(--bg-elevated)",
                border: "none",
              }}
            >
              <span
                className="text-[15px] font-bold select-none shrink-0"
                style={{ color: "var(--text-tertiary)" }}
              >
                {currencyMeta.symbol}
              </span>
              <input
                type="text"
                inputMode={allowDecimals ? "decimal" : "numeric"}
                value={correctTargetDisplay}
                onChange={(e) => {
                  const { raw, formatted } = formatLiveAmountInput(
                    e.target.value,
                    isIndonesian && !allowDecimals,
                    allowDecimals,
                    maxDecimals,
                  );
                  setCorrectTargetBalance(raw ? String(raw) : "0");
                  setCorrectTargetDisplay(formatted);
                }}
                placeholder="0"
                className="w-full bg-transparent outline-none font-bold text-[16px] amount"
                style={{
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {/* Difference Preview */}
          {correctWallet && (
            <div
              className="p-3.5 rounded-2xl flex items-center justify-between"
              style={{
                background: "var(--bg-elevated)",
                border: "none",
              }}
            >
              <span
                className="text-[12px] font-bold"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Selisih Penyesuaian:" : "Adjustment Delta:"}
              </span>
              <span
                className="amount text-[13px] font-semibold"
                style={{
                  color:
                    targetBalanceIdr - correctWallet.currentBalance > 0
                      ? "var(--text-primary)"
                      : targetBalanceIdr - correctWallet.currentBalance < 0
                        ? "var(--text-secondary)"
                        : "var(--text-tertiary)",
                }}
              >
                {targetBalanceIdr - correctWallet.currentBalance > 0 ? "+" : ""}
                {formatWithPreferred(targetBalanceIdr - correctWallet.currentBalance)}{" "}
                <span className="text-[10px] font-bold uppercase">
                  {targetBalanceIdr - correctWallet.currentBalance > 0
                    ? "(+)"
                    : targetBalanceIdr - correctWallet.currentBalance < 0
                      ? "(-)"
                      : isIndonesian
                        ? "(Tidak Ada Perubahan)"
                        : "(No Change)"}
                </span>
              </span>
            </div>
          )}

          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Tanggal Efektif" : "Effective Date"}
            </label>
            <input
              type="date"
              value={correctEffectiveDate}
              onChange={(e) => setCorrectEffectiveDate(e.target.value)}
              className="w-full p-3.5 rounded-2xl outline-none font-semibold text-[14px]"
              style={{
                background: "var(--bg-elevated)",
                border: "none",
                color: "var(--text-primary)",
              }}
            />
            <p
              className="text-[10.5px] mt-1 px-1 leading-relaxed"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Pilih tanggal lampau (cth. 2025-01-01) jika mengatur saldo awal untuk laporan historis."
                : "Select a past date (e.g. 2025-01-01) if setting an opening balance for historical statements."}
            </p>
          </div>

          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Alasan / Catatan (Opsional)" : "Reason / Note (Optional)"}
            </label>
            <input
              type="text"
              value={correctNote}
              onChange={(e) => setCorrectNote(e.target.value)}
              placeholder={isIndonesian ? "cth. Koreksi saldo" : "e.g. Balance correction"}
              className="w-full p-3.5 rounded-2xl outline-none font-semibold text-[14px]"
              style={{
                background: "var(--bg-elevated)",
                border: "none",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <button
            disabled={isSavingCorrection}
            onClick={handleSaveCorrection}
            className="w-full py-4 rounded-[20px] font-semibold text-[15px] active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {isSavingCorrection
              ? (isIndonesian ? "Menyimpan Penyesuaian..." : "Saving Correction...")
              : (isIndonesian ? "Simpan Penyesuaian" : "Save Correction")}
          </button>
        </div>
      </BottomSheet>

      {/* Edit Wallet Modal */}
      <BottomSheet
        isOpen={!!editWallet}
        onClose={handleCloseEditWallet}
        zIndex={zIndex ? zIndex + 2 : 1001}
      >
        <div className="p-5 pb-12 space-y-4">
          <div className="flex items-center justify-between">
            <h3
              className="font-semibold text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian ? "Edit Akun" : "Edit Account"}
            </h3>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setIconPickerTarget("edit");
              }}
              className="w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
              title={isIndonesian ? "Ketuk untuk mengubah ikon" : "Tap to change icon"}
            >
              <IconRenderer
                icon={editWallet?.icon || getWalletIcon(editWallet?.name || "")}
                size="w-5 h-5"
              />
              <span className="text-[8px] font-bold mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                {isIndonesian ? "Ubah" : "Change"}
              </span>
            </button>
          </div>
          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Nama Akun" : "Account Name"}
            </label>
            <input
              type="text"
              value={editWallet?.name || ""}
              onChange={(e) =>
                setEditWallet((prev) =>
                  prev ? { ...prev, name: e.target.value } : null,
                )
              }
              placeholder={isIndonesian ? "Nama Akun" : "Account Name"}
              className="w-full p-3.5 rounded-2xl outline-none font-semibold text-[14px]"
              style={{
                background: "var(--bg-elevated)",
                border: "none",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label
              className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Klasifikasi Neraca Akun" : "Account Balance Sheet Classification"}
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {(
                [
                  {
                    key: "liquid",
                    label: isIndonesian ? "Kas & Bank Likuid" : "Liquid Cash & Bank",
                    desc: isIndonesian ? "Uang tunai, tabungan bank, dan saldo e-wallet (Aset Lancar)" : "Cash, checking, savings, and liquid balances (Liquid Assets)",
                  },
                  {
                    key: "investment",
                    label: isIndonesian ? "Portofolio Investasi" : "Investment Portfolio",
                    desc: isIndonesian ? "Saham, kripto, reksa dana, dan emas (Aset Investasi)" : "Stocks, crypto, mutual funds, and gold (Invested Assets)",
                  },
                  {
                    key: "receivable",
                    label: isIndonesian ? "Piutang" : "Receivables",
                    desc: isIndonesian ? "Dana yang dipinjamkan ke pihak lain (Aset Piutang)" : "Money lent out to third parties (Receivable Assets)",
                  },
                  {
                    key: "credit",
                    label: isIndonesian ? "Kartu Kredit & PayLater" : "Credit Card & PayLater",
                    desc: isIndonesian ? "Kredit bergulir dan limit terpakai (Liabilitas Lancar)" : "Revolving lines of credit and paylater (Current Liabilities)",
                  },
                  {
                    key: "loan",
                    label: isIndonesian ? "Pinjaman & Utang Berjangka" : "Term Loans & Debt",
                    desc: isIndonesian ? "Utang jangka panjang, KPR, dan pinjaman bank (Liabilitas Jangka Panjang)" : "Long-term debt, mortgages, and bank loans (Long-term Liabilities)",
                  },
                ] as const
              ).map((opt) => {
                const isSelected =
                  (editWallet?.classification || "liquid") === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setEditWallet((prev) =>
                        prev ? { ...prev, classification: opt.key } : null,
                      );
                      triggerHaptic("light");
                    }}
                    className={`p-2.5 rounded-xl text-left transition-all active:scale-98 cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? "bg-black/[0.04] dark:bg-white/[0.08] border-black/15 dark:border-white/15"
                        : "bg-[var(--glass-fill)] border-[var(--glass-border)] hover:border-black/15 dark:hover:border-white/15"
                    }`}
                  >
                    <div>
                      <div
                        className="text-[12px] font-bold"
                        style={{
                          color: isSelected
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {opt.label}
                      </div>
                      <div
                        className="text-[10px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {opt.desc}
                      </div>
                    </div>
                    {isSelected && (
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: "var(--text-primary)",
                          color: "var(--bg-card)",
                        }}
                      >
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duplicate Edit Wallet Warning Pill */}
          {isDuplicateEditWalletName && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[11px] text-[var(--text-secondary)]">
              <AlertCircle size={14} className="shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.75} />
              <span>
                {isIndonesian
                  ? "Akun dengan nama ini sudah ada. Pilih nama lain agar tidak ganda."
                  : "An account with this name already exists. Choose a different name."}
              </span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (!editWallet?.name.trim() || isDuplicateEditWalletName) return;
                updateWallet.mutate(
                  {
                    id: editWallet.id,
                    name: editWallet.name.trim(),
                    icon: editWallet.icon || getWalletIcon(editWallet.name),
                    classification: editWallet.classification,
                  },
                  {
                    onSuccess: () => {
                      handleCloseEditWallet();
                      showToast(isIndonesian ? "Akun diperbarui" : "Account updated", "update", () => {});
                    },
                  },
                );
              }}
              disabled={!editWallet?.name.trim() || isDuplicateEditWalletName}
              className="w-full py-4 rounded-[20px] font-semibold text-[15px] active:scale-95 shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              {isIndonesian ? "Simpan Perubahan" : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!editWallet) return;
                triggerHaptic("medium");
                setConfirmModalConfig({
                  isOpen: true,
                  title: isIndonesian
                    ? `Hapus Akun "${editWallet.name}"?`
                    : `Delete Account "${editWallet.name}"?`,
                  description: isIndonesian
                    ? "Akun ini akan dihapus dari daftar akun Anda. Riwayat transaksi yang terkait akan tetap tersimpan."
                    : "This account will be removed from your accounts list. Associated transaction history remains preserved.",
                  confirmLabel: isIndonesian ? "Hapus Akun" : "Delete Account",
                  onConfirm: () => {
                    deleteWallet.mutate(editWallet.id, {
                      onSuccess: () => {
                        handleCloseEditWallet();
                        showToast(
                          isIndonesian ? "Akun dihapus" : "Account deleted",
                          "delete",
                          () => {},
                        );
                      },
                      onError: (error: any) => {
                        showToast(
                          error?.message ||
                            (isIndonesian
                              ? "Gagal menghapus akun"
                              : "Failed to delete account"),
                          "error",
                          () => {},
                        );
                      },
                    });
                  },
                });
              }}
              className="w-full py-3 rounded-2xl font-semibold text-[13px] border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>{isIndonesian ? "Hapus Akun Ini" : "Delete Account"}</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Add Wallet Modal with Available Defaults & Custom Creator */}
      <BottomSheet
        isOpen={addWalletOpen}
        onClose={() => setAddWalletOpen(false)}
        zIndex={zIndex ? zIndex + 2 : undefined}
      >
        <div className="p-5 pb-12 space-y-4">
          <div className="flex items-center justify-between">
            <h3
              className="font-semibold text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian ? "Tambah Akun" : "Add Account"}
            </h3>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setIconPickerTarget("add");
              }}
              className="w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
              title={isIndonesian ? "Ketuk untuk mengubah ikon" : "Tap to change icon"}
            >
              <IconRenderer
                icon={walletIcon}
                size="w-5 h-5"
              />
              <span className="text-[8px] font-bold mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                {isIndonesian ? "Ubah" : "Change"}
              </span>
            </button>
          </div>

          {/* Section 1: Quick Add Available Default Accounts */}
          {availableDefaultWallets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label
                  className="text-[11px] font-bold uppercase tracking-wider block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Pilihan Akun Siap Pakai" : "Preset Accounts"} ({availableDefaultWallets.length})
                </label>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { id: "all", label: isIndonesian ? "Semua" : "All" },
                  { id: "local", label: isIndonesian ? "Lokal (IDR)" : "Local (IDR)" },
                  { id: "global", label: isIndonesian ? "Global (USD/EUR)" : "Global (USD/EUR)" },
                  { id: "invest", label: isIndonesian ? "Investasi & Brankas" : "Invest & Vault" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setPresetFilter(tab.id as any);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all shrink-0 cursor-pointer ${
                      presetFilter === tab.id
                        ? "bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm"
                        : "bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredPresets.length === 0 ? (
                <div className="p-3 text-center rounded-xl bg-[var(--bg-elevated)] border border-[var(--glass-border)]">
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    {isIndonesian
                      ? "Semua akun dalam kategori ini sudah ditambahkan."
                      : "All accounts in this category have been added."}
                  </p>
                </div>
              ) : (
                <div
                  className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {filteredPresets.map((name) => {
                    const icon = getWalletIcon(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          addWallet.mutate(
                            { name, icon },
                            {
                              onSuccess: () => {
                                setAddWalletOpen(false);
                                showToast(
                                  isIndonesian
                                    ? `${name} ditambahkan`
                                    : `${name} added`,
                                  "add",
                                  () => {},
                                );
                              },
                            },
                          );
                          triggerHaptic("medium");
                        }}
                        className="flex items-center gap-2 p-2 rounded-xl active:scale-95 transition-all text-left cursor-pointer"
                        style={{
                          background: "var(--glass-fill)",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "var(--bg-elevated)" }}
                        >
                          <IconRenderer icon={icon} size="w-4 h-4" />
                        </div>
                        <span
                          className="text-[11px] font-bold truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Create Custom Wallet */}
          <div className="pt-2 border-t border-[var(--glass-border)] space-y-3">
            <label
              className="text-[11px] font-bold uppercase tracking-wider block px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Atau Buat Akun Kustom" : "Or Create Custom Account"}
            </label>
            <div
              className="flex items-center gap-3 p-3 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "none",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setIconPickerTarget("add");
                }}
                className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
                title={isIndonesian ? "Ketuk untuk mengubah ikon" : "Tap to change icon"}
              >
                <IconRenderer icon={walletIcon} size="w-5 h-5" />
                <span className="text-[8px] font-bold mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  {isIndonesian ? "Ubah" : "Change"}
                </span>
              </button>
              <input
                type="text"
                value={walletName}
                onChange={(e) => {
                  const val = e.target.value;
                  setWalletName(val);
                  if (!hasCustomPickedWalletIcon) {
                    setWalletIcon(getWalletIcon(val));
                  }
                }}
                placeholder={isIndonesian ? "Nama Akun (cth. BCA, GoPay, Tunai)" : "Account Name (e.g. Checking, Savings, Cash)"}
                className="w-full bg-transparent outline-none font-semibold text-[14px]"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            <div
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "none",
              }}
            >
              <span
                className="text-[13px] font-bold select-none shrink-0"
                style={{ color: "var(--text-tertiary)" }}
              >
                {currencyMeta.symbol}
              </span>
              <input
                type="text"
                inputMode={allowDecimals ? "decimal" : "numeric"}
                value={initialBalanceDisplay}
                onChange={(e) => {
                  const { raw, formatted } = formatLiveAmountInput(
                    e.target.value,
                    isIndonesian && !allowDecimals,
                    allowDecimals,
                    maxDecimals,
                  );
                  setInitialBalanceRaw(raw ? String(raw) : "");
                  setInitialBalanceDisplay(formatted);
                }}
                placeholder={
                  isIndonesian
                    ? `Saldo Awal Opsional (${currencyMeta.code})`
                    : `Optional Initial Balance (${currencyMeta.code})`
                }
                className="w-full bg-transparent outline-none font-semibold text-[13.5px] amount"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            {/* Duplicate Wallet Realtime Warning Pill */}
            {isDuplicateWalletName && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[11px] text-[var(--text-secondary)]">
                <AlertCircle size={14} className="shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.75} />
                <span>
                  {isIndonesian
                    ? "Akun dengan nama ini sudah ada. Pilih nama lain agar tidak ganda."
                    : "An account with this name already exists. Choose a different name."}
                </span>
              </div>
            )}

            <button
              onClick={handleSaveWallet}
              disabled={!walletName.trim() || isDuplicateWalletName}
              className="w-full py-4 rounded-[20px] font-semibold text-[15px] active:scale-95 shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
              style={{
                background: "var(--accent)",
                color: "var(--accent-ink)",
              }}
            >
              {isIndonesian ? "Simpan Akun Kustom" : "Save Custom Account"}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Universal Monochrome Icon Picker Modal */}
      <MonochromeIconPickerModal
        isOpen={iconPickerTarget !== null}
        onClose={() => setIconPickerTarget(null)}
        selectedIcon={
          iconPickerTarget === "add" ? walletIcon : editWallet?.icon || "Wallet"
        }
        onSelectIcon={(iconName) => {
          if (iconPickerTarget === "add") {
            setWalletIcon(iconName);
            setHasCustomPickedWalletIcon(true);
          } else if (iconPickerTarget === "edit") {
            setEditWallet((prev) =>
              prev ? { ...prev, icon: iconName } : null,
            );
          }
        }}
        title={
          iconPickerTarget === "add"
            ? (isIndonesian ? "Pilih Ikon Akun" : "Choose Account Icon")
            : (isIndonesian ? "Edit Ikon Akun" : "Edit Account Icon")
        }
      />

      <GlassConfirmationModal
        isOpen={confirmModalConfig.isOpen}
        onClose={() =>
          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        description={confirmModalConfig.description}
        confirmLabel={confirmModalConfig.confirmLabel}
        isIndonesian={isIndonesian}
        isDark={isDark}
      />
    </>
  );
}
