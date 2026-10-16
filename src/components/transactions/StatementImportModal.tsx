// ======================================================================
// TROUVAILLE STATEMENT IMPORT MODAL v2.2 — Production Grade Edition
// Supports: CSV, Excel (.xlsx), PDF Mutasi, Paste Text
// Features:
// - Privacy-first 100% on-device processing
// - Quote-safe PapaParse integration
// - Smart column auto-detection with data-row heuristics
// - Interactive column confirmation step
// - Chunked batch ingestion (50 tx/chunk) via useBatchAddTransactions
// - Review controls: toggle Type (Masuk/Keluar/Transfer) & set Destination Wallet
// - Hide/Show duplicate filter toggle chip
// - Full active ledger (SpaceContext) integration
// Strictly compliant with GEMINI.md: Monochrome luxury, lucide-react only,
// 100% pure localization (isIndonesian), no artificial height caps.
// ======================================================================

import { useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileSpreadsheet,
  Clipboard,
  Check,
  CheckSquare,
  Square,
  CreditCard,
  Tag,
  ChevronDown,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
  Table2,
  ArrowLeftRight,
  Eye,
  EyeOff,
  UploadCloud,
  Search,
  Landmark,
  Smartphone,
  Coins,
  Building2,
  TrendingUp,
} from "lucide-react";
import { parseStatementText, sanitizeNote, type ParsedStatementItem, type StatementFormat } from "../../lib/statementParser";
import {
  detectColumns,
  columnRoleLabel,
  CORE_COLUMN_ROLES,
  type DetectedColumnMap,
  type ColumnRole,
} from "../../lib/csvColumnDetector";
import { parseDelimitedText } from "../../lib/csvParser";
import { useWallets, useAddWallet, getWalletIcon } from "../../hooks/useWallets";
import { useCategories, useAddCategory } from "../../hooks/useCategories";
import { useAllTransactions, useBatchAddTransactions } from "../../hooks/useTransactions";
import { useSpace } from "../../contexts/SpaceContext";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useQuota } from "../../hooks/useQuota";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import { resolveCategoryVectorIcon } from "../../lib/iconRegistry";
import type { Category, TransactionType, Wallet } from "../../lib/types";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportStep = "input" | "column_map" | "review" | "importing";
type ImportMethod = "csv" | "excel" | "pdf" | "paste";

interface ColumnAssignment {
  roles: ColumnRole[];
  userModified: boolean;
}

// -----------------------------------------------------------------------
// Constants & Localization Helpers
// -----------------------------------------------------------------------

function getFormatLabel(format: StatementFormat, isIndo: boolean): string {
  const map: Record<StatementFormat, [string, string]> = {
    bca: ["Mutasi BCA", "BCA Statement"],
    mandiri: ["Mutasi Mandiri Livin", "Mandiri Livin Statement"],
    jenius: ["Mutasi Jenius BTPN", "Jenius BTPN Statement"],
    gopay: ["CSV GoPay", "GoPay CSV"],
    seabank: ["Mutasi SeaBank", "SeaBank Statement"],
    ovo: ["CSV OVO", "OVO CSV"],
    dana: ["CSV DANA", "DANA CSV"],
    bri: ["Mutasi BRI BRImo", "BRI BRImo Statement"],
    bni: ["Mutasi BNI wondr", "BNI wondr Statement"],
    permata: ["Mutasi PermataNet", "PermataNet Statement"],
    cimb: ["Mutasi CIMB OCTO", "CIMB OCTO Statement"],
    shopeepay: ["CSV ShopeePay", "ShopeePay CSV"],
    generic_csv: ["Berkas CSV / TSV", "CSV / TSV File"],
    generic_pdf: ["Berkas PDF Mutasi", "PDF Statement File"],
  };
  return map[format] ? map[format][isIndo ? 0 : 1] : format;
}

// Helper — build ColumnAssignment from DetectedColumnMap (strictly core schema roles)
function buildColumnAssignment(map: DetectedColumnMap, headerCount: number): ColumnAssignment {
  const roles: ColumnRole[] = Array(headerCount).fill("ignore");
  if (map.dateCol >= 0 && map.dateCol < headerCount) roles[map.dateCol] = "date";
  if (map.timeCol !== null && map.timeCol !== undefined && map.timeCol >= 0 && map.timeCol < headerCount) {
    roles[map.timeCol] = "time";
  }
  if (map.descCol >= 0 && map.descCol < headerCount) roles[map.descCol] = "description";
  if (map.amountCol !== null && map.amountCol < headerCount) {
    roles[map.amountCol] = "amount";
  } else if (map.debitCol !== null && map.debitCol < headerCount) {
    roles[map.debitCol] = "amount";
  }
  if (map.typeCol !== null && map.typeCol < headerCount) roles[map.typeCol] = "type";
  if (map.walletCol !== null && map.walletCol !== undefined && map.walletCol < headerCount) {
    roles[map.walletCol] = "wallet";
  }
  if (map.categoryCol !== null && map.categoryCol !== undefined && map.categoryCol < headerCount) {
    roles[map.categoryCol] = "category";
  }
  return { roles, userModified: false };
}

// Convert ColumnAssignment back to DetectedColumnMap
function assignmentToColumnMap(assignment: ColumnAssignment): DetectedColumnMap {
  const { roles } = assignment;
  return {
    dateCol: roles.indexOf("date"),
    timeCol: roles.includes("time") ? roles.indexOf("time") : null,
    descCol: roles.indexOf("description"),
    debitCol: roles.includes("debit") ? roles.indexOf("debit") : null,
    creditCol: roles.includes("credit") ? roles.indexOf("credit") : null,
    amountCol: roles.includes("amount") ? roles.indexOf("amount") : null,
    typeCol: roles.includes("type") ? roles.indexOf("type") : null,
    walletCol: roles.includes("wallet") ? roles.indexOf("wallet") : null,
    categoryCol: roles.includes("category") ? roles.indexOf("category") : null,
    balanceCol: roles.includes("balance") ? roles.indexOf("balance") : null,
    confidence: 1.0,
  };
}

const WALLET_ICON_MAP: Record<string, React.ElementType> = {
  Landmark,
  CreditCard,
  Smartphone,
  Coins,
  TrendingUp,
  Building2,
  Wallet: CreditCard,
};

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------

export function StatementImportModal({ isOpen, onClose }: StatementImportModalProps) {
  const { isIndonesian } = useLanguage();
  const { activeSpaceId } = useSpace();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const { data: allTxs = [] } = useAllTransactions();
  const batchAddTx = useBatchAddTransactions();
  const addWallet = useAddWallet();
  const addCategory = useAddCategory();
  const { showToast } = useToast();
  const { isPremium } = useSubscription();
  const { formatWithPreferred } = useCurrency();
  const { checkOcrLimitAndPrompt, recordOcrUsage, ocrRemaining } = useQuota();

  // --- Step & Navigation State ---
  const [step, setStep] = useState<ImportStep>("input");
  const [inputTab, setInputTab] = useState<"file" | "paste">("file");
  const [importMethod, setImportMethod] = useState<ImportMethod | null>(null);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");

  // Target wallet selection is optional: null represents "Otomatis dari File / Auto-Detect"
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [walletSearchQuery, setWalletSearchQuery] = useState("");

  // Detected entities for auto-creation
  const [newWallets, setNewWallets] = useState<string[]>([]);
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [autoCreateNewEntities, setAutoCreateNewEntities] = useState(true);

  // --- Parsed Results ---
  const [parsedFormat, setParsedFormat] = useState<StatementFormat>("generic_csv");
  const [parsedItems, setParsedItems] = useState<ParsedStatementItem[]>([]);
  const [importProgress, setImportProgress] = useState(0);

  // --- Filter Duplicates ---
  const [hideDuplicates, setHideDuplicates] = useState(false);

  // --- Column Mapping State (CSV / Excel) ---
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);
  const [columnAssignment, setColumnAssignment] = useState<ColumnAssignment | null>(null);
  const [rawTextForParsing, setRawTextForParsing] = useState("");

  // --- Drawer States ---
  const [activeItemForCategory, setActiveItemForCategory] = useState<string | null>(null);
  const [activeItemForDestWallet, setActiveItemForDestWallet] = useState<string | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [destWalletSheetOpen, setDestWalletSheetOpen] = useState(false);

  const activeWallet = useMemo(
    () => (selectedWalletId ? wallets.find((w) => w.id === selectedWalletId) || null : null),
    [wallets, selectedWalletId]
  );

  const filteredWallets = useMemo(() => {
    if (!walletSearchQuery.trim()) return wallets;
    const q = walletSearchQuery.toLowerCase().trim();
    return wallets.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.classification && w.classification.toLowerCase().includes(q))
    );
  }, [wallets, walletSearchQuery]);

  // --- Filtered and Metric Calculations ---
  const visibleItems = useMemo(
    () => (hideDuplicates ? parsedItems.filter((it) => !it.isDuplicate) : parsedItems),
    [parsedItems, hideDuplicates]
  );

  const selectedItems = useMemo(
    () => parsedItems.filter((it) => it.selected),
    [parsedItems]
  );

  const totalInflow = useMemo(
    () => selectedItems.filter((it) => it.type === "income").reduce((s, it) => s + it.amount, 0),
    [selectedItems]
  );

  const totalOutflow = useMemo(
    () => selectedItems.filter((it) => it.type === "expense").reduce((s, it) => s + it.amount, 0),
    [selectedItems]
  );

  const totalTransfer = useMemo(
    () => selectedItems.filter((it) => it.type === "transfer").reduce((s, it) => s + it.amount, 0),
    [selectedItems]
  );

  const duplicateCount = useMemo(
    () => parsedItems.filter((it) => it.isDuplicate).length,
    [parsedItems]
  );

  // -----------------------------------------------------------------------
  // File Handling — CSV, Excel, PDF
  // -----------------------------------------------------------------------

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!checkOcrLimitAndPrompt()) {
        e.target.value = "";
        return;
      }

      triggerHaptic("light");

      const ext = file.name.split(".").pop()?.toLowerCase() || "";

      if (ext === "xlsx" || ext === "xls") {
        await handleExcelFile(file);
      } else if (ext === "pdf") {
        await handlePDFFile(file);
      } else {
        // CSV / TXT / TSV
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          if (content) {
            setImportMethod("csv");
            processRawText(content, "csv");
          }
        };
        reader.readAsText(file, "UTF-8");
      }

      e.target.value = "";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTxs, categories, wallets]
  );

  const handleExcelFile = async (file: File) => {
    setIsProcessing(true);
    setProcessingMsg(isIndonesian ? "Membaca file Excel…" : "Reading Excel file…");
    try {
      const { parseExcelFile, spreadsheetToTSV } = await import("../../lib/excelParser");
      const spreadsheet = await parseExcelFile(file);

      if (spreadsheet.headers.length > 0) {
        const detectedMap = detectColumns(spreadsheet.headers, spreadsheet.rows);
        const assignment = buildColumnAssignment(detectedMap, spreadsheet.headers.length);
        setCsvHeaders(spreadsheet.headers);
        setCsvPreviewRows(spreadsheet.rows.slice(0, 4));
        setColumnAssignment(assignment);
        setRawTextForParsing(spreadsheetToTSV(spreadsheet));
        setImportMethod("excel");
        setStep("column_map");
        triggerHaptic("medium");
      } else {
        showToast(
          isIndonesian ? "File Excel tidak memiliki kolom yang dapat dibaca" : "Excel file has no readable columns",
          "delete",
          null,
          3000
        );
      }
    } catch (err) {
      console.error("[StatementImport] Excel parse error:", err);
      showToast(
        isIndonesian ? "Gagal membaca file Excel. Coba format .csv" : "Failed to read Excel file. Try .csv format",
        "delete",
        null,
        3000
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePDFFile = async (file: File) => {
    setIsProcessing(true);
    setProcessingMsg(isIndonesian ? "Mengekstrak teks dari PDF…" : "Extracting text from PDF…");
    try {
      const { extractTextFromPDF } = await import("../../lib/pdfParser");
      const result = await extractTextFromPDF(file);

      if (result.text.trim().length < 50) {
        showToast(
          isIndonesian
            ? "PDF tidak bisa dibaca sebagai teks. Coba upload CSV dari m-banking."
            : "PDF could not be read as text. Try uploading CSV from m-banking.",
          "delete",
          null,
          4000
        );
        return;
      }

      setImportMethod("pdf");
      processRawText(result.text, "pdf");
    } catch (err) {
      console.error("[StatementImport] PDF parse error:", err);
      showToast(
        isIndonesian
          ? "Gagal membaca PDF. Pastikan PDF tidak terenkripsi kata sandi."
          : "Failed to read PDF. Make sure it is not password protected.",
        "delete",
        null,
        3500
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      triggerHaptic("light");
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
      } else {
        showToast(isIndonesian ? "Papan klip kosong" : "Clipboard is empty", "info", null, 2000);
      }
    } catch {
      showToast(
        isIndonesian ? "Tempel teks secara manual di kotak di bawah" : "Please paste text manually into the box below",
        "info",
        null,
        2500
      );
    }
  };

  // -----------------------------------------------------------------------
  // Parsing Core
  // -----------------------------------------------------------------------

  const processRawText = useCallback(
    (text: string, method?: ImportMethod, colMap?: DetectedColumnMap) => {
      if (!text.trim()) {
        showToast(
          isIndonesian ? "Teks kosong. Masukkan data mutasi dulu." : "Empty text. Please provide statement data.",
          "info",
          null,
          2500
        );
        return;
      }

      // If CSV/Excel and no explicit column map provided, check if we should show column map confirmation
      if (!colMap && (method === "csv" || method === "excel")) {
        const parsedCSV = parseDelimitedText(text);
        if (parsedCSV.headers.length >= 2 && parsedCSV.rows.length > 0) {
          const detectedMap = detectColumns(parsedCSV.headers, parsedCSV.rows);
          const assignment = buildColumnAssignment(detectedMap, parsedCSV.headers.length);
          setCsvHeaders(parsedCSV.headers);
          setCsvPreviewRows(parsedCSV.rows.slice(0, 4));
          setColumnAssignment(assignment);
          setRawTextForParsing(text);
          setInputText(text);
          setStep("column_map");
          triggerHaptic("medium");
          return;
        }
      }

      const result = parseStatementText(text, allTxs, categories, colMap, wallets);
      if (result.items.length === 0) {
        showToast(
          isIndonesian
            ? "Tidak ada transaksi ditemukan. Periksa format data."
            : "No transactions found. Check data format.",
          "delete",
          null,
          3500
        );
        return;
      }

      setParsedFormat(result.detectedFormat);
      setParsedItems(result.items);
      setNewWallets(result.newWalletsDetected || []);
      setNewCategories(result.newCategoriesDetected || []);
      setStep("review");
      triggerHaptic("medium");
    },
    [allTxs, categories, wallets, isIndonesian, showToast]
  );

  const handleColumnMapConfirm = () => {
    if (!columnAssignment) return;
    triggerHaptic("medium");
    const colMap = assignmentToColumnMap(columnAssignment);
    processRawText(rawTextForParsing, importMethod || "csv", colMap);
  };

  // -----------------------------------------------------------------------
  // Review Row Actions
  // -----------------------------------------------------------------------

  const toggleRow = (id: string) => {
    triggerHaptic("light");
    setParsedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const toggleAll = () => {
    triggerHaptic("medium");
    const anyUnselected = visibleItems.some((it) => !it.selected);
    const visibleIds = new Set(visibleItems.map((v) => v.id));
    setParsedItems((prev) =>
      prev.map((it) => (visibleIds.has(it.id) ? { ...it, selected: anyUnselected } : it))
    );
  };

  // Cycle type: expense -> income -> transfer -> expense
  const cycleRowType = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");
    setParsedItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        let nextType: TransactionType = "expense";
        let nextDestId = it.destinationWalletId;
        let nextDestName = it.destinationWalletName;

        if (it.type === "expense") {
          nextType = "income";
          nextDestId = null;
          nextDestName = null;
        } else if (it.type === "income") {
          nextType = "transfer";
          // Auto suggest another wallet as destination if not already set
          if (!nextDestId && wallets.length > 1) {
            const other = wallets.find((w) => w.id !== selectedWalletId) || wallets[1];
            nextDestId = other.id;
            nextDestName = other.name;
          }
        } else {
          nextType = "expense";
          nextDestId = null;
          nextDestName = null;
        }

        return {
          ...it,
          type: nextType,
          destinationWalletId: nextDestId,
          destinationWalletName: nextDestName,
        };
      })
    );
  };

  const handleSelectCategory = (cat: Category) => {
    if (!activeItemForCategory) return;
    triggerHaptic("light");
    setParsedItems((prev) =>
      prev.map((it) =>
        it.id === activeItemForCategory
          ? {
              ...it,
              suggestedCategoryId: cat.id,
              suggestedCategoryName: cat.name,
              suggestedCategoryEmoji: cat.emoji,
            }
          : it
      )
    );
    setCategorySheetOpen(false);
    setActiveItemForCategory(null);
  };

  const handleSelectDestWallet = (w: Wallet) => {
    if (!activeItemForDestWallet) return;
    triggerHaptic("light");
    setParsedItems((prev) =>
      prev.map((it) =>
        it.id === activeItemForDestWallet
          ? {
              ...it,
              destinationWalletId: w.id,
              destinationWalletName: w.name,
            }
          : it
      )
    );
    setDestWalletSheetOpen(false);
    setActiveItemForDestWallet(null);
  };

  // -----------------------------------------------------------------------
  // Batch Execution (50 items per chunk)
  // -----------------------------------------------------------------------

  const handleExecuteImport = async () => {
    if (selectedItems.length === 0) {
      showToast(
        isIndonesian ? "Tidak ada transaksi yang dipilih" : "No transactions selected",
        "info",
        null,
        2500
      );
      return;
    }

    setStep("importing");
    triggerHaptic("heavy");

    // 1. Auto-create new wallets & categories if enabled
    const newWalletMap: Record<string, string> = {};
    const newCategoryMap: Record<string, string> = {};

    if (autoCreateNewEntities) {
      // Auto-create missing wallets
      for (const name of newWallets) {
        const normName = name.trim().toLowerCase();
        const existing = wallets.find((w) => w.name.trim().toLowerCase() === normName);
        if (existing) {
          newWalletMap[normName] = existing.id;
        } else {
          try {
            const created = await addWallet.mutateAsync({
              name: name.trim(),
              icon: getWalletIcon(name.trim()),
              classification: "liquid",
            });
            if (created?.id) {
              newWalletMap[normName] = created.id;
            }
          } catch (err) {
            console.warn("[StatementImport] Auto-create wallet failed:", name, err);
          }
        }
      }

      // Auto-create missing categories with pure Lucide monochrome vector icons (Rule 1)
      for (const name of newCategories) {
        const normName = name.trim().toLowerCase();
        const existing = categories.find((c) => c.name.trim().toLowerCase() === normName);
        if (existing) {
          newCategoryMap[normName] = existing.id;
        } else {
          try {
            const vectorIcon = resolveCategoryVectorIcon(name.trim());
            const created = await addCategory.mutateAsync({
              name: name.trim(),
              emoji: vectorIcon,
              type: "expense",
            });
            if (created?.id) {
              newCategoryMap[normName] = created.id;
            }
          } catch (err) {
            console.warn("[StatementImport] Auto-create category failed:", name, err);
          }
        }
      }
    }

    const CHUNK_SIZE = 50;
    const total = selectedItems.length;
    let imported = 0;

    for (let i = 0; i < selectedItems.length; i += CHUNK_SIZE) {
      const chunk = selectedItems.slice(i, i + CHUNK_SIZE);

      const payload = chunk.map((item, chunkIdx) => {
        // Resolve wallet
        let finalWalletId: string | null = selectedWalletId;
        if (!finalWalletId) {
          if (item.walletId) {
            finalWalletId = item.walletId;
          } else if (item.walletName && newWalletMap[item.walletName.trim().toLowerCase()]) {
            finalWalletId = newWalletMap[item.walletName.trim().toLowerCase()];
          } else if (item.walletName) {
            const matched = wallets.find(
              (w) => w.name.trim().toLowerCase() === item.walletName!.trim().toLowerCase()
            );
            finalWalletId = matched ? matched.id : wallets[0]?.id || null;
          } else {
            finalWalletId = wallets[0]?.id || null;
          }
        }

        // Resolve destination wallet for transfer transactions
        let finalToWalletId: string | null = null;
        if (item.type === "transfer") {
          if (item.destinationWalletId) {
            finalToWalletId = item.destinationWalletId;
          } else if (item.destinationWalletName && newWalletMap[item.destinationWalletName.trim().toLowerCase()]) {
            finalToWalletId = newWalletMap[item.destinationWalletName.trim().toLowerCase()];
          } else if (item.destinationWalletName) {
            const matchedDst = wallets.find(
              (w) => w.name.trim().toLowerCase() === item.destinationWalletName!.trim().toLowerCase()
            );
            if (matchedDst) finalToWalletId = matchedDst.id;
          }
        }

        // Resolve category
        let finalCategoryId: string | null = item.suggestedCategoryId || null;
        if (!finalCategoryId && item.suggestedCategoryName) {
          if (newCategoryMap[item.suggestedCategoryName.trim().toLowerCase()]) {
            finalCategoryId = newCategoryMap[item.suggestedCategoryName.trim().toLowerCase()];
          } else {
            const matchedCat = categories.find(
              (c) => c.name.trim().toLowerCase() === item.suggestedCategoryName!.trim().toLowerCase()
            );
            if (matchedCat) finalCategoryId = matchedCat.id;
          }
        }

        // Include time in occurred_on ISO timestamp (Rule 8.1: full ISO timestamps YYYY-MM-DDTHH:mm:ss)
        let occurredOn = item.date;
        if (item.time) {
          const timeParts = item.time.split(":");
          const hh = (timeParts[0] || "00").padStart(2, "0");
          const mm = (timeParts[1] || "00").padStart(2, "0");
          const ss = (timeParts[2] || "00").padStart(2, "0");
          occurredOn = `${item.date}T${hh}:${mm}:${ss}`;
        } else {
          // If no time provided, synthesize chronological micro-offset from statement row index
          // so same-day transactions maintain statement sequence and don't collide at 00:00:00
          const globalIdx = i + chunkIdx;
          const totalMinutes = Math.min(globalIdx, 1439);
          const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
          const mm = String(totalMinutes % 60).padStart(2, "0");
          const ss = String(globalIdx % 60).padStart(2, "0");
          occurredOn = `${item.date}T${hh}:${mm}:${ss}`;
        }

        return {
          amount: item.amount,
          type: item.type,
          category_id: finalCategoryId,
          wallet_id: finalWalletId,
          to_wallet_id: finalToWalletId,
          occurred_on: occurredOn,
          note: sanitizeNote(item.cleanDescription || item.description || ""),
          ledger_id: activeSpaceId !== "all" ? activeSpaceId : "personal",
          space_id: activeSpaceId !== "all" ? activeSpaceId : null,
        };
      });

      try {
        await batchAddTx.mutateAsync(payload);
        imported += chunk.length;
        setImportProgress(Math.round((imported / total) * 100));
      } catch (err) {
        console.warn("[StatementImport] Batch chunk error:", err);
      }
    }

    if (imported > 0) {
      await recordOcrUsage();
    }

    triggerSuccessHaptic();
    showToast(
      isIndonesian
        ? `${imported} transaksi berhasil dicatat ke buku kas`
        : `Successfully imported ${imported} transactions`,
      "add",
      null,
      3000
    );
    handleClose();
  };

  const handleClose = () => {
    setStep("input");
    setImportMethod(null);
    setInputText("");
    setParsedItems([]);
    setColumnAssignment(null);
    setCsvHeaders([]);
    setCsvPreviewRows([]);
    setRawTextForParsing("");
    setImportProgress(0);
    setHideDuplicates(false);
    setInputTab("file");
    setNewWallets([]);
    setNewCategories([]);
    setWalletSearchQuery("");
    setAutoCreateNewEntities(true);
    setSelectedWalletId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
      {/* Liquid Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={step === "importing" ? undefined : handleClose}
        className="absolute inset-0 backdrop-blur-xl bg-black/60"
      />

      {/* Main Glass Card */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative w-full max-w-lg max-h-[92dvh] flex flex-col rounded-t-[32px] sm:rounded-[32px] overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--glass-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <FileSpreadsheet size={15} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {isIndonesian ? "Impor Mutasi Bank" : "Import Bank Statement"}
              </h2>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {step === "input"
                  ? isIndonesian
                    ? "CSV, Excel, PDF atau tempel teks"
                    : "CSV, Excel, PDF or paste text"
                  : step === "column_map"
                  ? isIndonesian
                    ? "Konfirmasi pemetaan kolom"
                    : "Confirm column mapping"
                  : `${getFormatLabel(parsedFormat, isIndonesian)} · ${parsedItems.length} ${
                      isIndonesian ? "transaksi" : "transactions"
                    }`}
              </p>
            </div>
          </div>

          {step !== "importing" && (
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* STEP 1: INPUT                                                       */}
        {/* ------------------------------------------------------------------ */}
        <AnimatePresence mode="wait">
          {step === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {/* Compact Inset Bar: Destination Wallet + Compact Privacy Badge */}
              <div
                className="p-1.5 rounded-2xl flex items-center justify-between gap-2"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {/* Left: Destination Wallet Selector Button */}
                <button
                  type="button"
                  onClick={() => setWalletSheetOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {selectedWalletId ? (
                    <CreditCard size={14} style={{ color: "var(--text-secondary)" }} />
                  ) : (
                    <Sparkles size={14} style={{ color: "var(--accent)" }} />
                  )}
                  <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {selectedWalletId
                      ? activeWallet?.name || (isIndonesian ? "Pilih Akun" : "Select Account")
                      : isIndonesian
                      ? "Otomatis dari File"
                      : "Auto-Detect"}
                  </span>
                  <ChevronDown size={12} style={{ color: "var(--text-tertiary)" }} />
                </button>

                {/* Right: Compact Privacy Badge */}
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <ShieldCheck size={14} strokeWidth={1.75} style={{ color: "var(--text-primary)" }} />
                  <span className="text-[11px] font-medium tracking-tight">
                    {isIndonesian ? "100% Di Perangkat" : "100% On-Device"}
                  </span>
                </div>
              </div>

              {/* Apple iOS Segmented Control Switcher */}
              <div
                className="grid grid-cols-2 p-1 rounded-2xl relative"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setInputTab("file");
                  }}
                  className={`py-2 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    inputTab === "file"
                      ? "bg-white text-black shadow-sm font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Table2 size={14} strokeWidth={1.75} />
                  <span>{isIndonesian ? "Unggah Berkas" : "Upload File"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setInputTab("paste");
                  }}
                  className={`py-2 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    inputTab === "paste"
                      ? "bg-white text-black shadow-sm font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Clipboard size={14} strokeWidth={1.75} />
                  <span>{isIndonesian ? "Tempel Teks" : "Paste Text"}</span>
                </button>
              </div>

              {/* Hidden universal file input */}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

              {!isPremium && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-white/[0.04] border border-white/10 text-[11px] text-[var(--text-tertiary)] mb-3">
                  <span>
                    {isIndonesian
                      ? "Kuota Pemindaian Mutasi Bulan Ini"
                      : "Statement Scans Remaining This Month"}
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {ocrRemaining} / 5
                  </span>
                </div>
              )}

              {/* TAB 1: UPLOAD FILE */}
              {inputTab === "file" && (
                <div className="space-y-4">
                  {/* Apple Liquid Dropzone Card */}
                  <div
                    onClick={() => {
                      if (!checkOcrLimitAndPrompt()) return;
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = ".csv,.txt,.tsv,.xlsx,.xls,.pdf";
                        fileInputRef.current.click();
                      }
                    }}
                    className="border-2 border-dashed rounded-3xl p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-[0.99] group"
                    style={{
                      borderColor: "var(--glass-border)",
                      background: "var(--glass-fill)",
                    }}
                  >
                    <div
                      className="w-14 h-14 rounded-3xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <UploadCloud size={24} strokeWidth={1.5} />
                    </div>

                    <p className="text-[14px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                      {isIndonesian ? "Pilih Dokumen Mutasi" : "Choose Statement Document"}
                    </p>
                    <p
                      className="text-[11px] mt-1 max-w-[260px] leading-relaxed"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian
                        ? "Ketuk untuk memilih berkas. Berkas diproses di perangkat tanpa diunggah ke server."
                        : "Tap to choose file. Files are processed locally without server upload."}
                    </p>

                    {/* Format Chips */}
                    <div className="flex items-center gap-1.5 mt-4">
                      {([".CSV", ".XLSX", ".PDF", ".TSV"] as const).map((ext) => (
                        <span
                          key={ext}
                          className="px-2.5 py-1 rounded-full text-[10px] font-semibold font-mono"
                          style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--glass-border)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {ext}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bank Compatibility Footnote */}
                  <div
                    className="px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-[11px]"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <span>{isIndonesian ? "Format Bank yang Dikenali:" : "Recognized Banks:"}</span>
                    <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                      BCA, Mandiri, SeaBank, BRI, BNI + 7
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 2: TEMPEL TEKS */}
              {inputTab === "paste" && (
                <div className="space-y-4">
                  <div
                    className="rounded-3xl p-4 space-y-3"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                        {isIndonesian
                          ? "Salin dari m-banking atau web e-statement"
                          : "Copy from m-banking or web e-statement"}
                      </span>
                      <button
                        type="button"
                        onClick={handlePasteClipboard}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border active:scale-95 transition-transform cursor-pointer"
                        style={{
                          background: "var(--bg-elevated)",
                          borderColor: "var(--glass-border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <Clipboard size={12} />
                        <span>{isIndonesian ? "Tempel dari Papan Klip" : "Paste Clipboard"}</span>
                      </button>
                    </div>

                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={
                        isIndonesian
                          ? "05/09 TRSF E-BANKING CR GAJI 15.000.000,00\n12/09 QRIS KOPI KENANGAN 45.000,00 DB\n..."
                          : "05/09 TRSF E-BANKING CR SALARY 15.000.000,00\n12/09 QRIS KOPI KENANGAN 45.000,00 DB\n..."
                      }
                      rows={5}
                      className="w-full rounded-2xl p-3 text-[12px] font-mono outline-none resize-none transition-all"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>

                  {/* Primary Action Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!checkOcrLimitAndPrompt()) return;
                      setImportMethod("paste");
                      processRawText(inputText, "paste");
                    }}
                    disabled={!inputText.trim() || isProcessing}
                    className="w-full py-3.5 rounded-full text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98 disabled:opacity-40 shadow-lg"
                    style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                  >
                    <Sparkles size={15} />
                    <span>
                      {isIndonesian ? "Ekstrak & Tinjau Transaksi" : "Extract & Review Transactions"}
                    </span>
                  </button>
                </div>
              )}

              {/* Processing Loader */}
              {isProcessing && (
                <div className="flex items-center gap-2 py-2" style={{ color: "var(--text-secondary)" }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[12px] font-medium">{processingMsg}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* STEP 2: COLUMN MAP CONFIRMATION                                   */}
          {/* ---------------------------------------------------------------- */}
          {step === "column_map" && columnAssignment && (
            <motion.div
              key="column_map"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div
                  className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <AlertCircle
                    size={14}
                    strokeWidth={1.5}
                    className="shrink-0 mt-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  />
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {isIndonesian
                      ? "Kolom terdeteksi otomatis dari struktur data Anda. Pilih peran kolom agar sesuai skema transaksi."
                      : "Columns detected automatically from your data structure. Select each column role to match our transaction schema."}
                  </p>
                </div>

                {/* Column Table */}
                <div className="space-y-2">
                  {csvHeaders.map((header, colIdx) => {
                    const currentRole = columnAssignment.roles[colIdx];
                    return (
                      <div
                        key={colIdx}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl"
                        style={{
                          background: "var(--glass-fill)",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[12px] font-semibold truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {header}
                          </p>
                          {csvPreviewRows[0] && (
                            <p
                              className="text-[10px] truncate mt-0.5 font-mono"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {csvPreviewRows[0][colIdx] || "—"}
                            </p>
                          )}
                        </div>

                        <ArrowRight size={12} style={{ color: "var(--text-tertiary)" }} className="shrink-0" />

                        <select
                          value={currentRole}
                          onChange={(e) => {
                            const newRole = e.target.value as ColumnRole;
                            setColumnAssignment((prev) => {
                              if (!prev) return prev;
                              const newRoles = [...prev.roles];
                              if (newRole !== "ignore") {
                                for (let i = 0; i < newRoles.length; i++) {
                                  if (i !== colIdx && newRoles[i] === newRole) {
                                    newRoles[i] = "ignore";
                                  }
                                }
                              }
                              newRoles[colIdx] = newRole;
                              return { roles: newRoles, userModified: true };
                            });
                          }}
                          className="text-[11px] font-bold rounded-xl px-2 py-1.5 outline-none cursor-pointer"
                          style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--glass-border)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {CORE_COLUMN_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {columnRoleLabel(role, isIndonesian)}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                {/* Sample Data Preview (Luxury Horizontal Scrollable Table) */}
                {csvPreviewRows.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {isIndonesian ? "Pratinjau Data Sampel" : "Sample Data Preview"}
                      </p>
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {isIndonesian ? "Geser menyamping untuk kolom lain" : "Scroll horizontally for more columns"}
                      </span>
                    </div>

                    <div
                      className="rounded-2xl overflow-hidden"
                      style={{
                        border: "1px solid var(--glass-border)",
                        background: "var(--bg-elevated)",
                      }}
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-max">
                          <thead>
                            <tr
                              style={{
                                background: "var(--glass-fill)",
                                borderBottom: "1px solid var(--glass-border)",
                              }}
                            >
                              {csvHeaders.map((header, ci) => {
                                const assignedRole = columnAssignment.roles[ci] || "ignore";
                                return (
                                  <th
                                    key={ci}
                                    className="px-3 py-2 text-[11px] font-semibold whitespace-nowrap"
                                    style={{
                                      borderRight:
                                        ci < csvHeaders.length - 1
                                          ? "1px solid var(--glass-border)"
                                          : undefined,
                                    }}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="text-[9px] font-mono font-medium opacity-60"
                                        style={{ color: "var(--text-tertiary)" }}
                                      >
                                        #{ci + 1}
                                      </span>
                                      <span style={{ color: "var(--text-primary)" }}>{header}</span>
                                      <span
                                        className="text-[9px] px-1.5 py-0.5 rounded-full font-sans font-medium"
                                        style={{
                                          background:
                                            assignedRole === "ignore"
                                              ? "rgba(255,255,255,0.06)"
                                              : "var(--glass-border)",
                                          color:
                                            assignedRole === "ignore"
                                              ? "var(--text-tertiary)"
                                              : "var(--text-primary)",
                                        }}
                                      >
                                        {columnRoleLabel(assignedRole, isIndonesian)}
                                      </span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreviewRows.slice(0, 4).map((row, ri) => (
                              <tr
                                key={ri}
                                style={{
                                  background:
                                    ri % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                                  borderBottom:
                                    ri < Math.min(csvPreviewRows.length, 4) - 1
                                      ? "1px solid var(--glass-border)"
                                      : undefined,
                                }}
                              >
                                {csvHeaders.map((_, ci) => (
                                  <td
                                    key={ci}
                                    className="px-3 py-2 text-[10px] font-mono whitespace-nowrap"
                                    style={{
                                      color: "var(--text-secondary)",
                                      borderRight:
                                        ci < csvHeaders.length - 1
                                          ? "1px solid var(--glass-border)"
                                          : undefined,
                                    }}
                                  >
                                    {row[ci] || "—"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Column Map Action Bar */}
              <div
                className="p-4 border-t border-[var(--glass-border)] shrink-0 flex items-center gap-2"
                style={{
                  paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 20px)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep("input")}
                  className="px-4 py-3 rounded-full text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <RotateCcw size={14} />
                  <span>{isIndonesian ? "Kembali" : "Back"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleColumnMapConfirm}
                  disabled={
                    columnAssignment.roles.indexOf("date") === -1 ||
                    (columnAssignment.roles.indexOf("amount") === -1 &&
                      columnAssignment.roles.indexOf("debit") === -1 &&
                      columnAssignment.roles.indexOf("credit") === -1)
                  }
                  className="flex-1 py-3 rounded-full text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98 disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  <Sparkles size={15} />
                  <span>{isIndonesian ? "Lanjut Tinjau Transaksi" : "Proceed to Review"}</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* STEP 3: REVIEW                                                    */}
          {/* ---------------------------------------------------------------- */}
          {step === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* KPI & Filter Ribbon */}
              <div
                className="px-5 py-3 border-b border-[var(--glass-border)] flex items-center justify-between text-[11px] font-bold shrink-0"
                style={{ background: "var(--glass-fill)" }}
              >
                <div className="flex items-center gap-3">
                  {totalInflow > 0 && (
                    <span style={{ color: "var(--accent)" }}>+{formatWithPreferred(totalInflow)}</span>
                  )}
                  {totalOutflow > 0 && (
                    <span style={{ color: "var(--text-primary)" }}>−{formatWithPreferred(totalOutflow)}</span>
                  )}
                  {totalTransfer > 0 && (
                    <span style={{ color: "var(--text-secondary)" }}>⇄ {formatWithPreferred(totalTransfer)}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setHideDuplicates(!hideDuplicates)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold active:scale-95 transition-transform cursor-pointer"
                      style={{
                        background: hideDuplicates ? "var(--glass-fill-strong)" : "var(--glass-fill)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {hideDuplicates ? <Eye size={10} /> : <EyeOff size={10} />}
                      <span>
                        {hideDuplicates
                          ? isIndonesian
                            ? "Lihat Duplikat"
                            : "Show Duplicates"
                          : `${duplicateCount} ${isIndonesian ? "Duplikat" : "Duplicates"}`}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleAll}
                    className="flex items-center gap-1 active:scale-95 transition-transform"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {visibleItems.length > 0 && visibleItems.every((it) => it.selected) ? (
                      <CheckSquare size={13} />
                    ) : (
                      <Square size={13} />
                    )}
                    <span>
                      {selectedItems.length}/{parsedItems.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Auto-detected Entities Badge & Toggle */}
              {(newWallets.length > 0 || newCategories.length > 0) && (
                <div
                  className="mx-4 mt-3 p-3 rounded-2xl flex items-center justify-between gap-3 shrink-0"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--accent)",
                      }}
                    >
                      <Sparkles size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {[
                          newWallets.length > 0
                            ? `${newWallets.length} ${isIndonesian ? "Akun Baru" : "New Accounts"}`
                            : null,
                          newCategories.length > 0
                            ? `${newCategories.length} ${isIndonesian ? "Kategori Baru" : "New Categories"}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="text-[10px] truncate font-mono mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {[
                          newWallets.length > 0
                            ? `${isIndonesian ? "Akun" : "Accounts"}: ${newWallets.join(", ")}`
                            : null,
                          newCategories.length > 0
                            ? `${isIndonesian ? "Kategori" : "Categories"}: ${newCategories.join(", ")}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setAutoCreateNewEntities(!autoCreateNewEntities);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold shrink-0 cursor-pointer active:scale-95 transition-all"
                    style={{
                      background: autoCreateNewEntities ? "var(--accent)" : "var(--bg-elevated)",
                      borderColor: autoCreateNewEntities ? "transparent" : "var(--glass-border)",
                      color: autoCreateNewEntities ? "var(--accent-ink)" : "var(--text-secondary)",
                    }}
                  >
                    {autoCreateNewEntities && <Check size={11} strokeWidth={2.5} />}
                    <span>
                      {autoCreateNewEntities
                        ? isIndonesian
                          ? "Buat Otomatis"
                          : "Auto-Create"
                        : isIndonesian
                        ? "Lewati"
                        : "Skip"}
                    </span>
                  </button>
                </div>
              )}

              {/* Transactions List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {visibleItems.map((item) => {
                  const isIncome = item.type === "income";
                  const isTransfer = item.type === "transfer";

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleRow(item.id)}
                      className={`p-3 rounded-2xl flex items-center gap-3 transition-all cursor-pointer border ${
                        item.selected
                          ? "border-[var(--glass-border)] bg-[var(--glass-fill)]"
                          : "border-transparent opacity-50 bg-transparent"
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className="shrink-0"
                        style={{
                          color: item.selected ? "var(--text-primary)" : "var(--text-tertiary)",
                        }}
                      >
                        {item.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>

                      {/* Middle Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="text-[11px] font-semibold"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {item.date}
                          </span>

                          {/* Type toggle chip */}
                          <button
                            type="button"
                            onClick={(e) => cycleRowType(item.id, e)}
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold border active:scale-95 transition-transform cursor-pointer"
                            style={{
                              background: "var(--bg-elevated)",
                              borderColor: "var(--glass-border)",
                              color: isIncome
                                ? "var(--accent)"
                                : isTransfer
                                ? "var(--text-secondary)"
                                : "var(--text-primary)",
                            }}
                          >
                            {isIncome
                              ? isIndonesian
                                ? "Pemasukan"
                                : "Income"
                              : isTransfer
                              ? isIndonesian
                                ? "Transfer"
                                : "Transfer"
                              : isIndonesian
                              ? "Pengeluaran"
                              : "Expense"}
                          </button>

                          {/* Duplicate badge */}
                          {item.isDuplicate && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                              style={{
                                background: "var(--glass-fill)",
                                border: "1px solid var(--glass-border)",
                                color: "var(--text-tertiary)",
                              }}
                            >
                              {isIndonesian ? "Duplikat" : "Duplicate"}
                            </span>
                          )}
                        </div>

                        <p
                          className="text-[13px] font-bold truncate mt-1"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {item.cleanDescription}
                        </p>

                        {/* Badges: Wallet, Category & Destination Wallet */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {/* Wallet badge */}
                          {(item.walletName || (!selectedWalletId && item.walletId)) && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold truncate max-w-[130px]"
                              style={{
                                background: "var(--bg-elevated)",
                                borderColor: "var(--glass-border)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              <CreditCard size={10} />
                              <span className="truncate">
                                {item.walletName ||
                                  wallets.find((w) => w.id === item.walletId)?.name ||
                                  (isIndonesian ? "Akun" : "Account")}
                              </span>
                            </span>
                          )}

                          {/* Category pill */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveItemForCategory(item.id);
                              setCategorySheetOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border active:scale-95 transition-transform"
                            style={{
                              background: "var(--bg-elevated)",
                              borderColor: "var(--glass-border)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <Tag size={10} />
                            <span className="text-[10px] font-bold">
                              {item.suggestedCategoryName || (isIndonesian ? "Umum" : "General")}
                            </span>
                          </button>

                          {/* Destination wallet pill if transfer */}
                          {isTransfer && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveItemForDestWallet(item.id);
                                setDestWalletSheetOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border active:scale-95 transition-transform"
                              style={{
                                background: "var(--bg-elevated)",
                                borderColor: "var(--glass-border)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              <ArrowLeftRight size={10} />
                              <span className="text-[10px] font-bold truncate max-w-[120px]">
                                {item.destinationWalletName || (isIndonesian ? "Pilih Tujuan" : "Select Target")}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <span
                          className="text-[13px] font-semibold block"
                          style={{
                            color: isIncome
                              ? "var(--accent)"
                              : isTransfer
                              ? "var(--text-secondary)"
                              : "var(--text-primary)",
                          }}
                        >
                          {isIncome ? "+" : isTransfer ? "⇄" : "−"}
                          {formatWithPreferred(item.amount)}
                        </span>
                        <span
                          className="text-[9px] font-semibold uppercase tracking-wider"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {isIncome
                            ? isIndonesian
                              ? "Masuk"
                              : "Inflow"
                            : isTransfer
                            ? isIndonesian
                              ? "Transfer"
                              : "Transfer"
                            : isIndonesian
                            ? "Keluar"
                              : "Outflow"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Commit Dock */}
              <div
                className="p-4 border-t border-[var(--glass-border)] shrink-0 flex items-center gap-2"
                style={{
                  paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 20px)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep("input")}
                  className="px-4 py-3 rounded-full text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <RotateCcw size={14} />
                  <span>{isIndonesian ? "Kembali" : "Back"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={selectedItems.length === 0}
                  className="flex-1 py-3 rounded-full text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98 disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  <Check size={15} strokeWidth={2.5} />
                  <span>
                    {isIndonesian
                      ? `Simpan ${selectedItems.length} Transaksi`
                      : `Import ${selectedItems.length} Transactions`}
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* STEP 4: IMPORTING PROGRESS                                        */}
          {/* ---------------------------------------------------------------- */}
          {step === "importing" && (
            <motion.div
              key="importing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--accent)",
                }}
              >
                <FileSpreadsheet size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {isIndonesian ? "Mengimpor Data…" : "Importing Records…"}
                </h3>
                <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                  {isIndonesian
                    ? "Menyimpan batch transaksi ke vault lokal & Supabase"
                    : "Committing batch transactions to local vault & Supabase"}
                </p>
              </div>
              <div className="w-full max-w-xs h-2 rounded-full overflow-hidden bg-white/10">
                <div
                  className="h-full transition-all duration-200"
                  style={{ width: `${importProgress}%`, background: "var(--accent)" }}
                />
              </div>
              <span className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
                {importProgress}%
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Category Selection Drawer */}
      <BottomSheet
        isOpen={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        title={isIndonesian ? "Pilih Kategori" : "Assign Category"}
      >
        <div
          className="grid grid-cols-3 gap-2.5 p-2"
          style={{
            paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 24px)",
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelectCategory(cat)}
              className="p-3 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer active:scale-95"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-1.5 bg-white/5">
                <IconRenderer icon={cat.emoji || "??"} />
              </div>
              <span
                className="text-[11px] font-bold truncate max-w-full"
                style={{ color: "var(--text-primary)" }}
              >
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Target Ingestion Wallet Drawer */}
      <BottomSheet
        isOpen={walletSheetOpen}
        onClose={() => {
          setWalletSheetOpen(false);
          setWalletSearchQuery("");
        }}
        title={isIndonesian ? "Pilih Akun" : "Select Account"}
      >
        <div
          className="space-y-3 p-2"
          style={{
            paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 24px)",
          }}
        >
          {/* Search Box */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-2xl"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Search size={14} style={{ color: "var(--text-tertiary)" }} />
            <input
              type="text"
              value={walletSearchQuery}
              onChange={(e) => setWalletSearchQuery(e.target.value)}
              placeholder={isIndonesian ? "Cari akun…" : "Search accounts…"}
              className="bg-transparent flex-1 text-[12px] outline-none placeholder:text-zinc-500"
              style={{ color: "var(--text-primary)" }}
            />
            {walletSearchQuery && (
              <button
                type="button"
                onClick={() => setWalletSearchQuery("")}
                className="text-[11px] p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Option 1: Otomatis dari File (Multi-Akun) */}
          {!walletSearchQuery && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setSelectedWalletId(null);
                setWalletSheetOpen(false);
                setWalletSearchQuery("");
              }}
              className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-98 border ${
                selectedWalletId === null
                  ? "border-white/20 bg-white/[0.08] shadow-sm"
                  : "border-[var(--glass-border)] bg-[var(--glass-fill)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--accent)",
                  }}
                >
                  <Sparkles size={16} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                      {isIndonesian ? "Otomatis dari File (Multi-Akun)" : "Auto-Detect from File"}
                    </span>
                    <span
                      className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        background: "var(--glass-fill)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--accent)",
                      }}
                    >
                      {isIndonesian ? "Rekomendasi" : "Recommended"}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian
                      ? "Gunakan kolom akun dari file untuk memetakan tiap transaksi"
                      : "Route transactions to respective accounts specified in the file"}
                  </p>
                </div>
              </div>
              {selectedWalletId === null && <Check size={16} style={{ color: "var(--accent)" }} />}
            </button>
          )}

          {/* Wallet List */}
          <div className="space-y-2">
            {filteredWallets.map((w) => {
              const isSelected = selectedWalletId === w.id;
              const IconComp = WALLET_ICON_MAP[w.icon || ""] || CreditCard;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedWalletId(w.id);
                    setWalletSheetOpen(false);
                    setWalletSearchQuery("");
                  }}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-98 border ${
                    isSelected
                      ? "border-white/20 bg-white/[0.08] shadow-sm"
                      : "border-[var(--glass-border)] bg-[var(--glass-fill)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <IconComp size={16} strokeWidth={1.75} />
                    </div>
                    <div className="text-left">
                      <span className="text-[13px] font-bold block" style={{ color: "var(--text-primary)" }}>
                        {w.name}
                      </span>
                      <span
                        className="text-[9px] font-mono uppercase tracking-wider"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {w.classification || "liquid"}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check size={16} style={{ color: "var(--accent)" }} />}
                </button>
              );
            })}
            {filteredWallets.length === 0 && (
              <div className="py-8 text-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {isIndonesian ? "Tidak ada akun ditemukan" : "No accounts found"}
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Per-row Transfer Destination Wallet Drawer */}
      <BottomSheet
        isOpen={destWalletSheetOpen}
        onClose={() => setDestWalletSheetOpen(false)}
        title={isIndonesian ? "Pilih Akun Penerima Transfer" : "Select Transfer Target Account"}
      >
        <div
          className="space-y-2 p-2"
          style={{
            paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 24px)",
          }}
        >
          {wallets
            .filter((w) => w.id !== selectedWalletId)
            .map((w) => {
              const IconComp = WALLET_ICON_MAP[w.icon || ""] || CreditCard;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => handleSelectDestWallet(w)}
                  className="w-full p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-98"
                  style={{
                    background: "var(--glass-fill)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <IconComp size={16} strokeWidth={1.75} />
                    </div>
                    <div className="text-left">
                      <span className="text-[13px] font-bold block" style={{ color: "var(--text-primary)" }}>
                        {w.name}
                      </span>
                      <span
                        className="text-[9px] font-mono uppercase tracking-wider"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {w.classification || "liquid"}
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--text-tertiary)" }} />
                </button>
              );
            })}
        </div>
      </BottomSheet>
    </div>
  );
}
