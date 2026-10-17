import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Wallet as WalletIcon } from "lucide-react";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import { useBills } from "../../hooks/useBills";
import { useWallets } from "../../hooks/useWallets";
import { triggerHaptic } from "../../lib/haptics";
import { BottomSheet } from "./BottomSheet";
import { IconRenderer } from "./IconRenderer";
import { CashAccountDetailSheet } from "../assets/CashAccountDetailSheet";
import { WalletManagementSheets } from "../settings/WalletManagementSheets";
import { useTheme } from "../../contexts/ThemeContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useLanguage } from "../../contexts/LanguageContext";
import type { Wallet } from "../../lib/types";
import { cn } from "../../lib/utils";

function getWalletRoleDescription(
  name: string,
  classification?: string,
  isAnchor?: boolean,
  isIndonesian?: boolean,
): string {
  const n = (name || "").toLowerCase();
  if (isAnchor) {
    return isIndonesian ? "Rekening Utama" : "Primary Account";
  }
  if (n.includes("cash") || n.includes("tunai") || n.includes("dompet fisik")) {
    return isIndonesian ? "Kas Tunai" : "Physical Cash";
  }
  if (classification === "investment") {
    return isIndonesian ? "Aset Investasi" : "Investment Asset";
  }
  if (classification === "credit" || classification === "loan") {
    return isIndonesian ? "Liabilitas Lancar" : "Current Liability";
  }
  if (
    n.includes("seabank") ||
    n.includes("jago") ||
    n.includes("blu") ||
    n.includes("krom") ||
    n.includes("superbank") ||
    n.includes("jenius")
  ) {
    return isIndonesian ? "Bank Digital" : "Digital Bank";
  }
  if (
    n.includes("gopay") ||
    n.includes("ovo") ||
    n.includes("dana") ||
    n.includes("shopee") ||
    n.includes("linkaja")
  ) {
    return isIndonesian ? "Dompet Digital" : "Digital Wallet";
  }
  if (
    n.includes("tapcash") ||
    n.includes("flazz") ||
    n.includes("brizzi") ||
    n.includes("emoney") ||
    n.includes("e-money")
  ) {
    return isIndonesian ? "Uang Elektronik" : "Electronic Card";
  }
  return isIndonesian ? "Rekening Bank" : "Bank Account";
}

const SEGMENT_COLORS_DARK = [
  "#FFFFFF",
  "#E4E4E7",
  "#D4D4D8",
  "#A1A1AA",
  "#8E8E93",
  "#71717A",
  "#52525B",
  "#3F3F46",
  "#27272A",
  "#1E1E22",
];
const SEGMENT_COLORS_LIGHT = [
  "#18181B",
  "#27272A",
  "#3F3F46",
  "#52525B",
  "#71717A",
  "#8E8E93",
  "#A1A1AA",
  "#D4D4D8",
  "#E4E4E7",
  "#F4F4F6",
];

interface BalanceCardProps {
  hideBalance?: boolean;
}

export function BalanceCard({ hideBalance = false }: BalanceCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [showDormant, setShowDormant] = useState(false);
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const stealthMask = `${currencyMeta.symbol} ••••••••`;
  const { liquidAccounts, liquidCapital, allTxs } = useWalletBalances();
  const { data: bills = [] } = useBills();
  const { data: wallets = [] } = useWallets();
  const { theme } = useTheme();
  const isDark = theme !== "light";

  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const cardShadow = isDark
    ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
    : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff";

  // Selected cash wallet for detail sheet (unified with Assets page)
  const [selectedCashWallet, setSelectedCashWallet] = useState<Wallet | null>(
    null,
  );
  const [isWalletManagementOpen, setIsWalletManagementOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  const handleOpenWalletModal = (acc: any) => {
    triggerHaptic("light");
    const matched = wallets.find((w) => w.id === acc.id) || {
      id: acc.id,
      user_id: acc.user_id || "",
      name: acc.name,
      icon: acc.icon,
      created_at: acc.created_at || new Date().toISOString(),
      classification: acc.classification,
      balance: acc.balance,
    };
    setSelectedCashWallet(matched);
  };

  const unpaidBills = useMemo(() => bills.filter((b) => !b.is_paid), [bills]);
  const committedAmount = useMemo(
    () => unpaidBills.reduce((s, b) => s + Number(b.amount || 0), 0),
    [unpaidBills],
  );
  const safeToSpend = Math.max(0, liquidCapital - committedAmount);

  const SEGMENT_COLORS = isDark ? SEGMENT_COLORS_DARK : SEGMENT_COLORS_LIGHT;

  const posLiquidAccs = useMemo(
    () => liquidAccounts.filter((a) => a.balance > 0),
    [liquidAccounts],
  );

  const { items, accounts, totalLiquidCapital, isEmpty } = useMemo(() => {
    const effectiveTotal = liquidCapital > 0 ? liquidCapital : 1;

    if (allTxs.length === 0) {
      const emptyAccounts = liquidAccounts.map((acc) => ({
        ...acc,
        percent: 0,
        color: SEGMENT_COLORS[0],
      }));
      return {
        items: [],
        accounts: emptyAccounts,
        totalLiquidCapital: 0,
        isEmpty: true,
      };
    }

    // Largest Remainder Method for exact 100% chart segments
    const rawItems = posLiquidAccs.map((acc, idx) => {
      const raw = (acc.balance / effectiveTotal) * 100;
      const floored = Math.floor(raw);
      return {
        name: acc.name,
        icon: acc.icon,
        balance: acc.balance,
        percent: floored,
        remainder: raw - floored,
        color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
      };
    });

    const totalFloored = rawItems.reduce((acc, item) => acc + item.percent, 0);
    const rem = Math.max(0, 100 - totalFloored);

    const sortedIndices = rawItems
      .map((item, idx) => ({ idx, remainder: item.remainder }))
      .sort((a, b) => b.remainder - a.remainder);

    const bonusMap = new Map<number, number>();
    if (sortedIndices.length > 0) {
      for (let i = 0; i < rem; i++) {
        const targetIdx = sortedIndices[i % sortedIndices.length].idx;
        bonusMap.set(targetIdx, (bonusMap.get(targetIdx) || 0) + 1);
      }
    }

    const chartItems = rawItems
      .map((item, idx) => ({
        name: item.name,
        icon: item.icon,
        balance: item.balance,
        percent: item.percent + (bonusMap.get(idx) || 0),
        remainder: item.remainder,
        color: item.color,
      }))
      .sort((a, b) => b.percent - a.percent);

    // Formatted accounts with percentage
    const formattedAccounts = liquidAccounts.map((acc, idx) => {
      const pct = acc.balance > 0 ? (acc.balance / effectiveTotal) * 100 : 0;
      return {
        ...acc,
        percent: pct,
        color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
      };
    });

    return {
      items: chartItems,
      accounts: formattedAccounts,
      totalLiquidCapital: liquidCapital,
      isEmpty: false,
    };
  }, [liquidAccounts, posLiquidAccs, liquidCapital, allTxs, SEGMENT_COLORS]);

  const sortedPositiveAccounts = useMemo(() => {
    return [...accounts.filter((a) => a.balance > 0)].sort(
      (a, b) => b.balance - a.balance,
    );
  }, [accounts]);

  const zeroAccounts = useMemo(
    () => accounts.filter((a) => a.balance <= 0),
    [accounts],
  );

  return (
    <>
      {/* Compact Main Portfolio Card */}
      <section
        className="p-4 sm:p-5 rounded-[26px] relative overflow-hidden transition-all select-none"
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

        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-[12px] font-semibold tracking-wider text-[var(--text-primary)]">
            {isIndonesian ? "Sumber Likuiditas" : "Liquidity Sources"}
          </span>
          {!isEmpty && (
            <button
              onClick={() => setDetailOpen(true)}
              className="text-[11px] font-semibold flex items-center gap-0.5 active:scale-95 transition-transform cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Semua Detail" : "All Details"}{" "}
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        {isEmpty ? (
          <div
            className="py-5 text-center rounded-2xl"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.03)"
                : "rgba(0, 0, 0, 0.025)",
              border: cardBorder,
            }}
          >
            <div
              className="w-7 h-7 mx-auto rounded-full flex items-center justify-center mb-1.5"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : "rgba(0, 0, 0, 0.04)",
                color: "var(--text-tertiary)",
              }}
            >
              <WalletIcon size={14} />
            </div>
            <p
              className="text-[12px] font-bold"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian
                ? "Belum Ada Aktivitas Akun"
                : "No Account Activity"}
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Catat transaksi untuk melihat alokasi likuiditas"
                : "Record a transaction to see liquidity allocation"}
            </p>
          </div>
        ) : (
          <>
            {/* Multi-segment Allocation Bar */}
            <div
              className="w-full h-2.5 rounded-full overflow-hidden flex gap-[2px] mb-3 p-[1px]"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(0, 0, 0, 0.04)",
                border: cardBorder,
              }}
            >
              {items.map((item) => (
                <div
                  key={item.name}
                  className="h-full rounded-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${item.percent}%`,
                    backgroundColor: item.color,
                    minWidth: item.percent > 0 ? "3px" : "0",
                  }}
                />
              ))}
            </div>

            {/* Compact 1-Row Mini Chips Legend */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {items.slice(0, 5).map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.04)"
                      : "rgba(0, 0, 0, 0.035)",
                    border: cardBorder,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="amount text-[10px] font-semibold"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {item.percent}%
                  </span>
                </div>
              ))}
              {items.length > 5 && (
                <button
                  onClick={() => setDetailOpen(true)}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.05)",
                    border: cardBorder,
                    color: "var(--text-secondary)",
                  }}
                >
                  {isIndonesian ? `+${items.length - 5} lainnya` : `+${items.length - 5} more`}
                </button>
              )}
            </div>

            {/* Balance Safety Buffer (Priority 11) */}
            {committedAmount > 0 && (
              <div
                className="mt-3 pt-2.5 flex items-center justify-between text-[11px]"
                style={{
                  borderTop: isDark
                    ? "1px solid rgba(255, 255, 255, 0.06)"
                    : "1px solid rgba(0, 0, 0, 0.05)",
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "var(--text-primary)" }}
                  />
                  <span
                    className="truncate"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Aman Dibelanjakan:" : "Safe to Spend:"}
                  </span>
                  <span
                    className="amount font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {hideBalance ? stealthMask : formatWithPreferred(safeToSpend)}
                  </span>
                </div>
                <div
                  className="text-right shrink-0"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span>{isIndonesian ? "Komitmen: " : "Committed: "}</span>
                  <span className="amount font-bold text-[var(--text-secondary)]">
                    {hideBalance
                      ? stealthMask
                      : formatWithPreferred(committedAmount)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Refined Executive Streamlined Liquidity Breakdown Bottom Sheet */}
      <BottomSheet isOpen={detailOpen} onClose={() => setDetailOpen(false)}>
        <div className="p-4 sm:p-5 space-y-3 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),20px)] select-none">
          {/* ── 1. Apple Minimalist Header ───────────────────────────────────── */}
          <div className="flex justify-between items-baseline gap-2 pb-0.5">
            <div className="min-w-0">
              <h3
                className="font-bold text-[15px] tracking-tight leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? "Sumber Likuiditas" : "Liquidity Sources"}
              </h3>
              <p
                className="text-[10px] font-medium mt-0.5 truncate"
                style={{ color: "var(--text-tertiary)" }}
              >
                {sortedPositiveAccounts.length}{" "}
                {isIndonesian
                  ? "akun aktif · Posisi Modal Likuid"
                  : "active accounts · Liquid Position"}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span
                className="text-[8.5px] font-semibold uppercase tracking-wider block opacity-60"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Total Kas Likuid" : "Total Liquid"}
              </span>
              <p
                className="amount text-[15px] font-bold leading-tight tabular-nums mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {hideBalance ? stealthMask : formatWithPreferred(totalLiquidCapital)}
              </p>
            </div>
          </div>

          {/* ── 2. Compact Telemetry Strip ──────────────────────────────────── */}
          {committedAmount > 0 && (
            <div
              className="py-1.5 px-2.5 rounded-xl flex items-center justify-between text-[10px] transition-colors"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.03)"
                  : "rgba(0, 0, 0, 0.02)",
                border: cardBorder,
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "var(--text-primary)" }}
                />
                <span
                  className="truncate opacity-75"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Aman Dibelanjakan:" : "Safe to Spend:"}
                </span>
                <span
                  className="amount font-bold tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {hideBalance ? stealthMask : formatWithPreferred(safeToSpend)}
                </span>
              </div>
              <div className="text-right shrink-0 pl-2">
                <span
                  className="opacity-75"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Komitmen: " : "Committed: "}
                </span>
                <span
                  className="amount font-medium tabular-nums"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {hideBalance ? stealthMask : formatWithPreferred(committedAmount)}
                </span>
              </div>
            </div>
          )}

          {/* ── 3. Micro Allocation Spectrum ─────────────────────────────────── */}
          {items.length > 0 && (
            <div className="space-y-1">
              <div
                className="w-full h-1 rounded-full overflow-hidden flex gap-[2px] p-[0.5px]"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.04)",
                  border: cardBorder,
                }}
              >
                {items.map((item) => (
                  <div
                    key={item.name}
                    className="h-full rounded-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                    style={{
                      width: `${Math.max(item.percent, 1)}%`,
                      backgroundColor: item.color,
                    }}
                    title={`${item.name}: ${item.percent}%`}
                  />
                ))}
              </div>
              <div
                className="flex items-center justify-between text-[9px] px-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                <span>
                  {sortedPositiveAccounts.length}{" "}
                  {isIndonesian ? "akun likuid" : "liquid accounts"}
                </span>
                <span>{isIndonesian ? "100% Tercakup" : "100% Accounted"}</span>
              </div>
            </div>
          )}

          {/* ── 4. Compact Apple-Style 2-Column Micro-Grid ───────────────────── */}
          <div className="grid grid-cols-2 gap-1.5 overflow-y-auto no-scrollbar pr-0.5 pt-0.5">
            {sortedPositiveAccounts.map((acc, index) => {
              const isAnchor = index === 0;
              return (
                <div
                  key={acc.id || acc.name}
                  onClick={() => handleOpenWalletModal(acc)}
                  className={cn(
                    "p-2.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer active:scale-[0.98] group relative select-none",
                    isDark
                      ? "bg-white/[0.03] hover:bg-white/[0.05] border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "bg-black/[0.02] hover:bg-black/[0.04] border-black/[0.06] shadow-[inset_0_1px_0_#ffffff]",
                  )}
                >
                  {/* Row 1: Icon + Name + Core Tag & Allocation % */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 opacity-70 text-[var(--text-secondary)]">
                        <IconRenderer icon={acc.icon} size="w-3.5 h-3.5" />
                      </div>
                      <span
                        className="text-[11.5px] font-semibold tracking-tight truncate leading-none"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {acc.name}
                      </span>
                      {isAnchor && (
                        <span
                          className={cn(
                            "text-[7.5px] px-1 py-0.2 rounded font-bold uppercase tracking-wider shrink-0",
                            isDark
                              ? "bg-white/10 text-zinc-300 border border-white/10"
                              : "bg-black/5 text-zinc-700 border border-black/5",
                          )}
                        >
                          {isIndonesian ? "Utama" : "Core"}
                        </span>
                      )}
                    </div>
                    <span className="text-[9.5px] font-medium tabular-nums shrink-0 text-[var(--text-tertiary)]">
                      {acc.percent.toFixed(1)}%
                    </span>
                  </div>

                  {/* Row 2: Balance & Micro Role Subtitle */}
                  <div className="flex items-baseline justify-between gap-1">
                    <p
                      className="amount text-[12.5px] font-bold tabular-nums leading-none truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {hideBalance ? stealthMask : formatWithPreferred(acc.balance)}
                    </p>
                    <span
                      className="text-[8.5px] font-medium truncate opacity-60 max-w-[45%] text-right"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {getWalletRoleDescription(
                        acc.name,
                        acc.classification,
                        isAnchor,
                        isIndonesian,
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 5. Compact Dormant Accounts Pill ─────────────────────────────── */}
          {zeroAccounts.length > 0 && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setShowDormant(!showDormant);
                }}
                className="w-full py-1.5 px-2.5 rounded-xl flex items-center justify-between text-[10.5px] font-medium border transition-all cursor-pointer active:scale-[0.99]"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.02)"
                    : "rgba(0, 0, 0, 0.015)",
                  borderColor: "var(--glass-border)",
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "var(--text-tertiary)", opacity: 0.5 }}
                  />
                  <span
                    className="truncate"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {zeroAccounts.length}{" "}
                    {isIndonesian
                      ? `Akun Dorman (${currencyMeta.symbol} 0)`
                      : `Dormant Accounts (${currencyMeta.symbol} 0)`}
                  </span>
                </div>

                <div
                  className="flex items-center gap-1.5 shrink-0"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span className="text-[9.5px] font-medium opacity-60">
                    {zeroAccounts
                      .slice(0, 2)
                      .map((a) => a.name)
                      .join(", ")}
                    {zeroAccounts.length > 2 ? "..." : ""}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${
                      showDormant ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {showDormant && (
                <div className="grid grid-cols-2 gap-1 pt-1  overflow-y-auto no-scrollbar">
                  {zeroAccounts.map((acc) => (
                    <div
                      key={acc.id || acc.name}
                      onClick={() => handleOpenWalletModal(acc)}
                      className={cn(
                        "p-1.5 px-2 rounded-lg border flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all",
                        isDark
                          ? "bg-white/[0.015] border-white/[0.05] hover:bg-white/[0.03]"
                          : "bg-black/[0.01] border-black/[0.04] hover:bg-black/[0.02]",
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-4 h-4 flex items-center justify-center shrink-0 opacity-60 text-[var(--text-secondary)]">
                          <IconRenderer icon={acc.icon} size="w-3 h-3" />
                        </div>
                        <span
                          className="truncate font-medium text-[10px]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {acc.name}
                        </span>
                      </div>
                      <span
                        className="amount text-[9.5px] font-medium tabular-nums shrink-0 pl-1"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {formatWithPreferred(0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Dedicated Cash Account Detail Sheet (Identical to Assets Page) */}
      <CashAccountDetailSheet
        isOpen={!!selectedCashWallet}
        onClose={() => setSelectedCashWallet(null)}
        wallet={selectedCashWallet}
        onEditWallet={(w) => {
          setEditingWallet(w);
          setIsWalletManagementOpen(true);
        }}
        zIndex={1002}
      />

      {/* Direct Wallet Management Sheet for Account Card Detail */}
      <WalletManagementSheets
        isOpen={isWalletManagementOpen}
        onClose={() => {
          setIsWalletManagementOpen(false);
          setEditingWallet(null);
        }}
        initialWalletToEdit={editingWallet}
        zIndex={1005}
      />
    </>
  );
}
