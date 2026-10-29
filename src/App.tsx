import { lazy, Suspense, useEffect, useRef, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { BottomTabBar } from "./components/layout/BottomTabBar";
import { useAuth } from "./contexts/AuthContext";
import {
  useEnsureDefaultCategories,
  useCategories,
  categoryKeys,
} from "./hooks/useCategories";
import {
  useEnsureDefaultWallets,
  useWallets,
  walletKeys,
} from "./hooks/useWallets";
import {
  useAllTransactions,
  useAddTransaction,
  useBatchAddTransactions,
  transactionKeys,
  purgePendingMutationsAndSync,
} from "./hooks/useTransactions";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import { InitialSyncScreen } from "./components/ui/InitialSyncScreen";
import { SyncStatusPill } from "./components/ui/SyncStatusPill";
import { ClipboardTransactionBanner } from "./components/common/ClipboardTransactionBanner";
import { saveDraftBatch, getAllDraftItems, removeDraftItem, setCaptureDraftOwner, adoptCaptureDrafts, discardCaptureDrafts } from "./lib/draftTransactionService";
import { useInboxDrain } from "./features/inbox/useInboxDrain";
import type { ParsedStatementItem } from "./lib/statementParser";
import { App as CapApp } from "@capacitor/app";
import { parseDeepLink } from "./lib/deepLinkHandler";
import { shouldDeferShortcut } from "./lib/shortcutReadiness";
import { enqueueLocalCapture, adoptLocalCaptures, readLocalCaptures, ackLocalCaptures } from "./features/inbox/localCaptureQueue";
import { getCaptureOwner } from "./features/inbox/captureOwner";
import { generateUUID } from "./lib/utils";
import { AccrualInbox } from "./plugins/accrualInbox";
import { GUEST_CAPTURE_OWNER_KEY } from "./features/inbox/captureOwner";
import { Capacitor } from "@capacitor/core";
import { useSecurityLock } from "./contexts/SecurityLockContext";
import { useLanguage } from "./contexts/LanguageContext";
import { useToast } from "./contexts/ToastContext";
import { triggerSuccessHaptic, triggerHaptic } from "./lib/haptics";
import { format } from "date-fns";
import {
  syncWeeklyDigestNotification,
  syncMonthEndReviewNotification,
  checkBudgetThresholdAlerts,
} from "./lib/notifications";
import {
  DynamicIslandHUD,
  type ShortcutRecordedTxData,
} from "./components/transactions/DynamicIslandHUD";
import { useQueryClient } from "@tanstack/react-query";
import { fetchAllTransactionsFromSupabase } from "./hooks/useTransactions";
import { supabase } from "./lib/supabase";
import { flushPendingMutations } from "./lib/syncEngine";
import {
  migrateGuestDataToCloud,
  hasGuestData,
  discardGuestData,
} from "./lib/guestMigration";
import { fetchHoldingsFromSupabase } from "./lib/marketPriceService";
import { autoDeduplicateCategories, autoDeduplicateWallets } from "./lib/deduplicationEngine";
import { useRealtimeSync } from "./hooks/useRealtimeSync";
import { useWidgetSync } from "./hooks/useWidgetSync";
import { usePrivacy } from "./contexts/PrivacyContext";
import { useSpace } from "./contexts/SpaceContext";
import { useSubscription } from "./contexts/SubscriptionContext";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({
    default: module.HomePage,
  })),
);
const TransactionsPage = lazy(() =>
  import("./pages/TransactionsPage").then((module) => ({
    default: module.TransactionsPage,
  })),
);
const CalendarPage = lazy(() =>
  import("./pages/CalendarPage").then((module) => ({
    default: module.CalendarPage,
  })),
);
const StatisticsPage = lazy(() =>
  import("./pages/StatisticsPage").then((module) => ({
    default: module.StatisticsPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const AssetsPage = lazy(() =>
  import("./pages/AssetsPage").then((module) => ({
    default: module.AssetsPage,
  })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const TransactionSheet = lazy(() =>
  import("./components/transactions/TransactionSheet").then((module) => ({
    default: module.TransactionSheet,
  })),
);
const VoiceQuickAddModal = lazy(() =>
  import("./components/transactions/VoiceQuickAddModal").then((module) => ({
    default: module.VoiceQuickAddModal,
  })),
);
const ReceiptScanModal = lazy(() =>
  import("./components/transactions/ReceiptScanModal").then((module) => ({
    default: module.ReceiptScanModal,
  })),
);
const StatementImportModal = lazy(() =>
  import("./components/transactions/StatementImportModal").then((module) => ({
    default: module.StatementImportModal,
  })),
);
const OnboardingModal = lazy(() =>
  import("./components/onboarding/OnboardingModal").then((module) => ({
    default: module.OnboardingModal,
  })),
);
const JoinLedgerModal = lazy(() =>
  import("./components/settings/JoinLedgerModal").then((module) => ({
    default: module.JoinLedgerModal,
  })),
);
const ResetPasswordModal = lazy(() =>
  import("./components/auth/ResetPasswordModal").then((module) => ({
    default: module.ResetPasswordModal,
  })),
);
const ProductTourOverlay = lazy(() =>
  import("./components/onboarding/ProductTourOverlay").then((module) => ({
    default: module.ProductTourOverlay,
  })),
);
const BatchTransactionReviewSheet = lazy(() =>
  import("./components/transactions/BatchTransactionReviewSheet").then((module) => ({
    default: module.BatchTransactionReviewSheet,
  })),
);
const AccrualPaywallModal = lazy(() =>
  import("./components/paywall/AccrualPaywallModal").then((module) => ({
    default: module.AccrualPaywallModal,
  })),
);
const SubscriptionSuccessModal = lazy(() =>
  import("./components/paywall/SubscriptionSuccessModal").then((module) => ({
    default: module.SubscriptionSuccessModal,
  })),
);
const CancelSubscriptionModal = lazy(() =>
  import("./components/paywall/CancelSubscriptionModal").then((module) => ({
    default: module.CancelSubscriptionModal,
  })),
);

import { useTheme } from "./contexts/ThemeContext";

function AppShell() {
  const { user, isGuest, exitGuestMode } = useAuth();
  const { isLocked } = useSecurityLock();
  let draftOwner: string | null = null;
  try { draftOwner=getCaptureOwner(user?.id); } catch { /* No capture processing without persistent session storage. */ }
  setCaptureDraftOwner(draftOwner);
  useEffect(()=>{window.dispatchEvent(new CustomEvent("trouvaille:drafts-updated"));},[draftOwner]);
  const { activeSpaceId, setActiveSpaceId, currentUserRole, spaces } = useSpace();
  const navigate = useNavigate();

  useWidgetSync();
  useInboxDrain();
  useRealtimeSync(user?.id, {
    onPartnerTransaction: (data) => {
      setRecordedShortcutTx(data);
    },
  });

  const { theme } = useTheme();
  const isDark = theme !== "light";
  const queryClient = useQueryClient();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [receiptScanOpen, setReceiptScanOpen] = useState(false);
  const [statementImportOpen, setStatementImportOpen] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(() => {
    if (isGuest) {
      return (
        localStorage.getItem("trouvaille_onboarded_guest") === "true" &&
        localStorage.getItem("trouvaille_onboarding_focus") !== null
      );
    }
    if (user?.id) {
      if (user.user_metadata?.onboarded === true) return true;
      return (
        localStorage.getItem(`trouvaille_onboarded_${user.id}`) === "true" &&
        localStorage.getItem("trouvaille_onboarding_focus") !== null
      );
    }
    return false;
  });

  useEffect(() => {
    if (user?.id) {
      const onboarded =
        user.user_metadata?.onboarded === true ||
        (localStorage.getItem(`trouvaille_onboarded_${user.id}`) === "true" &&
          localStorage.getItem("trouvaille_onboarding_focus") !== null);
      if (onboarded && !isOnboarded) {
        setIsOnboarded(true);
      }
    }
  }, [user?.id, user?.user_metadata?.onboarded, isOnboarded]);
  const [isTourOpen, setIsTourOpen] = useState(() => {
    try {
      return localStorage.getItem("trouvaille_tour_pending") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleStartTour = () => {
      try {
        localStorage.setItem("trouvaille_tour_pending", "true");
      } catch {}
      setIsTourOpen(true);
    };
    window.addEventListener("trouvaille:start-tour", handleStartTour);
    return () => window.removeEventListener("trouvaille:start-tour", handleStartTour);
  }, []);

  useEffect(() => {
    // Preload ProductTourOverlay chunk in background idle time
    const timer = setTimeout(() => {
      import("./components/onboarding/ProductTourOverlay");
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const [prefilledValues, setPrefilledValues] = useState<any>(null);
  const syncStorageKey = user
    ? `trouvaille_initial_synced:${user.id}`
    : "trouvaille_initial_synced";
  const [hasInitialSynced, setHasInitialSynced] = useState(() => {
    return localStorage.getItem(syncStorageKey) === "true";
  });
  const { data: allTxs = [] } = useAllTransactions(undefined, {
    enabled: hasInitialSynced,
  });
  const [isInitDone, setIsInitDone] = useState(false);
  const [syncProgress, setSyncProgress] = useState(8);
  const [syncStatusText, setSyncStatusText] = useState(
    "Preparing financial categories & wallets...",
  );
  const [syncedTxCount, setSyncedTxCount] = useState(0);
  const { isPrivacyShieldEnabled, isPrivacyShieldActive, setIsPrivacyShieldActive } =
    usePrivacy();
  const { data: categories = [], isSuccess: categoriesReady } = useCategories();
  const { data: wallets = [], isSuccess: walletsReady } = useWallets();
  const addTxMutation = useAddTransaction();
  const batchAddTx = useBatchAddTransactions();
  const [batchReviewOpen, setBatchReviewOpen] = useState(false);
  const [batchReviewItems, setBatchReviewItems] = useState<ParsedStatementItem[]>([]);
  const [batchSourceTitle, setBatchSourceTitle] = useState("");
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();
  const {
    isPaywallOpen,
    closePaywall,
    isSuccessModalOpen,
    successModalSub,
    closeSuccessModal,
    isCancelModalOpen,
    openCancelModal,
    closeCancelModal,
    subscription,
  } = useSubscription();
  const [recordedShortcutTx, setRecordedShortcutTx] = useState<ShortcutRecordedTxData | null>(null);
  const [editingCaptureTx, setEditingCaptureTx] = useState<import("./lib/types").Transaction | null>(null);
  const [savedCaptureTx, setSavedCaptureTx] = useState<import("./lib/types").Transaction | null>(null);
  useEffect(()=>{setBatchReviewOpen(false);setBatchReviewItems([]);setAddSheetOpen(false);setRecordedShortcutTx(null);setEditingCaptureTx(null);setSavedCaptureTx(null);},[draftOwner]);
  useEffect(() => {
    const saved=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.transaction){setSavedCaptureTx(detail.transaction);setRecordedShortcutTx({...detail.transaction,transactionId:detail.transaction.id,categoryName:detail.categoryName,walletName:detail.walletName,source:"shortcut"});}};
    window.addEventListener("accrual:capture-saved",saved);return()=>window.removeEventListener("accrual:capture-saved",saved);
  }, []);
  const [joinLedgerOpen, setJoinLedgerOpen] = useState(false);
  const [joinLedgerCode, setJoinLedgerCode] = useState("");



  const handleConfirmBatchReview = async (selectedItems: ParsedStatementItem[]) => {
    if (selectedItems.some(item=>"captureLedgerId" in item)) {
      const key=`accrual_capture_review_ids:${user?.id}`;
      const ids:Record<string,string>=JSON.parse(localStorage.getItem(key)||"{}");
      for(const item of selectedItems.filter(item=>"captureLedgerId" in item)){
        if(item.captureOwnerId!==getCaptureOwner(user?.id)) throw new Error("Capture owner changed before review approval");
        const ledger=item.captureLedgerId;
        if(!user?.id || !ledger || !spaces.some(s=>s.id===ledger && s.role!=="viewer") || !item.walletId || !wallets.some(w=>w.id===item.walletId)) throw new Error("Select capture account and ledger");
        const id=ids[item.id] || (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)?item.id:generateUUID());
        ids[item.id]=id;localStorage.setItem(key,JSON.stringify(ids));
        await addTxMutation.mutateAsync({id,expectedUserId:user.id,amount:item.amount,type:item.type,category_id:item.type==='transfer'?null:item.suggestedCategoryId,wallet_id:item.walletId,to_wallet_id:item.destinationWalletId||null,occurred_on:item.date+'T'+(item.time?.length===5?item.time+':00':item.time||'00:00:00'),note:item.cleanDescription||item.description,ledger_id:ledger,space_id:ledger});
        removeDraftItem(item.id);
      }
      selectedItems=selectedItems.filter(item=>!("captureLedgerId" in item));
      if(!selectedItems.length){showToast(isIndonesian?'Tangkapan tersimpan di perangkat.':'Captures saved on device.','add');return;}
    }
    const payload = selectedItems.map((item) => ({
      amount: item.amount,
      type: item.type,
      category_id: item.type === "transfer" ? null : (item.suggestedCategoryId || null),
      wallet_id: item.walletId || null,
      to_wallet_id: item.type === "transfer" ? (item.destinationWalletId || null) : null,
      occurred_on: item.date,
      note: item.cleanDescription || item.description,
      ledger_id: activeSpaceId !== "all" ? activeSpaceId : "personal",
      space_id: activeSpaceId !== "all" ? activeSpaceId : null,
    }));

    await batchAddTx.mutateAsync(payload);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["wallets"] });

    showToast(
      isIndonesian
        ? `${selectedItems.length} transaksi berhasil dicatat!`
        : `${selectedItems.length} transactions recorded!`,
      "add",
      null,
      3000
    );
  };

  const handleSaveDraftReview = (itemsToDraft: ParsedStatementItem[]) => {
    saveDraftBatch(
      itemsToDraft,
      batchSourceTitle || (isIndonesian ? "Tangkapan Layar" : "Screenshot"),
      "back_tap"
    );
    showToast(
      isIndonesian
        ? `${itemsToDraft.length} transaksi disimpan ke antrean draft`
        : `${itemsToDraft.length} transactions saved to draft inbox`,
      "info",
      null,
      3000
    );
  };
  // Queue for deep links that arrive before categories/wallets have loaded (cold-launch race condition fix)
  const pendingDeepLinkRef = useRef<string[]>([]);
  const hasHandledColdLaunchUrlRef = useRef(false);
  const lastHandledUrlRef = useRef<string | null>(null);
  const lastHandledTimeRef = useRef<number>(0);
  const [showGuestMigrationModal, setShowGuestMigrationModal] = useState(false);
  const [isPreviewingInitialSync, setIsPreviewingInitialSync] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("preview") === "initial-sync" || params.get("preview") === "sync";
  });

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("join") || searchParams.get("code");
      if (code) {
        setJoinLedgerCode(code);
        setJoinLedgerOpen(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleTriggerPreview = () => {
      setIsPreviewingInitialSync(true);
    };
    window.addEventListener("trouvaille:preview-initial-sync", handleTriggerPreview);
    return () => {
      window.removeEventListener("trouvaille:preview-initial-sync", handleTriggerPreview);
    };
  }, []);

  useEffect(() => {
    const handleTestHud = (e: any) => {
      const detail = e?.detail;
      setRecordedShortcutTx({
        amount: detail?.amount || 75000,
        type: detail?.type || "expense",
        categoryName: detail?.categoryName || (isIndonesian ? "Makanan" : "Food"),
        walletName: detail?.walletName || "BCA",
        date: format(new Date(), "d MMM yyyy"),
        note: detail?.note || (isIndonesian ? "Kopi Kenangan" : "Coffee"),
      });
    };
    window.addEventListener("trouvaille:test-hud", handleTestHud);
    return () => {
      window.removeEventListener("trouvaille:test-hud", handleTestHud);
    };
  }, [isIndonesian]);


  // Handle iOS Custom URL Scheme (trouvaille://...), Back Tap Shortcuts, and Web Share Target
  // Two-stage design to fix cold-launch race condition:
  //   Stage 1 (this effect): register listeners, queue URL if categories/wallets not yet loaded
  // Handle iOS Custom URL Scheme (trouvaille://...), Back Tap Shortcuts, and Web Share Target
  // Listener for native iOS App Intents / Shortcuts foreground triggers
  useEffect(() => {
    const handleOpenQuickAdd = () => {
      setPrefilledValues(null);
      setAddSheetOpen(true);
    };
    const handleOpenScanner = () => {
      setReceiptScanOpen(true);
    };
    const handleOpenVoice = () => {
      setVoiceModalOpen(true);
    };
    const handleOpenDraftReview = (e: any) => {
      const items = e?.detail?.items;
      if (Array.isArray(items) && items.length > 0) {
        setBatchReviewItems(items);
        setBatchSourceTitle(e?.detail?.title || (isIndonesian ? "Tangkapan Layar" : "Screenshot"));
        setBatchReviewOpen(true);
      }
    };
    window.addEventListener("trouvaille:open-quick-add", handleOpenQuickAdd);
    window.addEventListener("trouvaille:open-scanner", handleOpenScanner);
    window.addEventListener("trouvaille:open-voice", handleOpenVoice);
    window.addEventListener("trouvaille:open-draft-review", handleOpenDraftReview);
    return () => {
      window.removeEventListener("trouvaille:open-quick-add", handleOpenQuickAdd);
      window.removeEventListener("trouvaille:open-scanner", handleOpenScanner);
      window.removeEventListener("trouvaille:open-voice", handleOpenVoice);
      window.removeEventListener("trouvaille:open-draft-review", handleOpenDraftReview);
    };
  }, []);

  const handleUrlDispatch = useRef<((rawUrl: string) => void) | null>(null);

  useEffect(() => {
    // Keep the dispatch function up-to-date with fresh categories/wallets/state closures
    handleUrlDispatch.current = (rawUrl: string) => {
      if (!rawUrl) return;

      if (rawUrl.includes("join") || rawUrl.includes("code=")) {
        try {
          const urlObj = new URL(rawUrl.replace(/^(?:accrual|trouvaille):\/\//i, "https://accrual.internal/"));
          const code = urlObj.searchParams.get("code") || urlObj.searchParams.get("join");
          if (code) {
            setJoinLedgerCode(code);
            setJoinLedgerOpen(true);
            return;
          }
        } catch {}
      }

      const res = parseDeepLink(rawUrl, categories, wallets, allTxs);

      if (res.action === "batch_review" && res.batchItems && res.batchItems.length > 0) {
        const ownerId=getCaptureOwner(user?.id);
        if(ownerId){
          const query = new URL(rawUrl.replace(/^(?:accrual|trouvaille):\/\//i,"https://accrual.internal/")).searchParams;
          enqueueLocalCapture({schema_version:2,id:generateUUID(),owner_id:ownerId,source:"url",captured_at:new Date().toISOString(),transaction_date:new Date().toISOString(),raw_text:query.get("text")||query.get("content")||query.get("ocr")||"",allow_auto:false});return;
        }
        triggerHaptic("medium");
        setBatchReviewItems(res.batchItems);
        setBatchSourceTitle(res.matchedWalletName || (isIndonesian ? "Riwayat Layar" : "Screen History"));
        setBatchReviewOpen(true);
        return;
      }

      // Direct tab navigation routing (e.g. trouvaille://reports, trouvaille://bills)
      if (res.action === "navigate" && res.path) {
        triggerHaptic("light");
        navigate(res.path);
        return;
      }

      if (res.action === "transaction") {
        try {
          const normalized = rawUrl.startsWith("?") ? `https://accrual.internal/${rawUrl}` : rawUrl.replace(/^(?:accrual|trouvaille):\/\//i, "https://accrual.internal/");
          const params = new URL(normalized).searchParams;
          const rawText = params.get("text") || params.get("teks") || params.get("content") || params.get("ocr") || params.get("q") || params.get("title");
          const amount = params.get("amount") || params.get("nominal");
          if (!rawText && !amount) { setPrefilledValues(res.prefilledValues || null); setAddSheetOpen(true); return; }
          const ownerId = getCaptureOwner(user?.id);
          if (!ownerId) throw new Error("Capture requires an active session");
          const wallet = params.get("wallet") || params.get("account") || params.get("rekening") || params.get("akun") || params.get("dompet") || params.get("wallet_id");
          const text = rawText || [
            `Nominal: ${amount}`,
            `Tipe: ${params.get("type") || params.get("tipe") || "expense"}`,
            `Kategori: ${params.get("category") || params.get("kategori") || params.get("category_id") || ""}`,
            `Akun: ${wallet || ""}`,
            `Tujuan: ${params.get("to_wallet") || params.get("to_wallet_id") || params.get("ke") || ""}`,
            `Catatan: ${params.get("note") || params.get("catatan") || ""}`,
          ].join("\n");
          enqueueLocalCapture({ schema_version: 2, id: generateUUID(), owner_id: ownerId, source: "url", source_app: wallet || undefined,
            captured_at: new Date().toISOString(), transaction_date: (res.prefilledValues?.date || new Date()).toISOString(), raw_text: text,
            allow_auto: /^(true|1|ya)$/i.test(params.get("autosave") || params.get("auto") || params.get("otomatis") || "") });
        } catch (error) {
          console.error("[CaptureURL]", error);
          showToast(isIndonesian ? "Tangkapan belum tersimpan. Jalankan Pintasan kembali." : "Capture was not saved. Run the shortcut again.", "error");
        }
      } else if (res.action === "restore_balance") {
        triggerSuccessHaptic();
        showToast(
          isIndonesian
            ? "Memulihkan saldo dari Cloud..."
            : "Restoring wallet balance from Cloud...",
          "info",
          null,
          2000
        );
        (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const cleanTxs = await purgePendingMutationsAndSync(session?.user?.id);
            queryClient.setQueryData(transactionKeys.all(session?.user?.id), cleanTxs);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["transactions"] }),
              queryClient.invalidateQueries({ queryKey: ["wallets"] }),
              queryClient.invalidateQueries({ queryKey: ["monthSummary"] }),
            ]);
            showToast(
              isIndonesian
                ? "Saldo dompet berhasil dipulihkan dari Cloud!"
                : "Wallet balance restored from Cloud!",
              "update",
              null,
              4000
            );
          } catch (err) {
            console.error("[restore_balance] Failed to restore balance:", err);
            showToast(
              isIndonesian
                ? "Gagal memulihkan saldo dari Cloud"
                : "Failed to restore balance from Cloud",
              "delete",
              null,
              3000
            );
          }
        })();
      } else if (res.action === "voice") {
        setVoiceModalOpen(true);
      } else if (res.action === "scan") {
        setReceiptScanOpen(true);
      } else if (res.action === "import") {
        setStatementImportOpen(true);
      } else if (res.action === "batch_review") {
        const items = res.batchItems || getAllDraftItems();
        if (items.length > 0) {
          setBatchReviewItems(items);
          setBatchSourceTitle(isIndonesian ? "Arsip Draft" : "Draft Archive");
          setBatchReviewOpen(true);
        } else {
          showToast(
            isIndonesian ? "Tidak ada draft yang perlu persetujuan" : "No pending drafts to review",
            "info"
          );
        }
      }
    };
  }, [
    categories,
    wallets,
    addTxMutation,
    isIndonesian,
    activeSpaceId,
    navigate,
    queryClient,
    showToast,
  ]);

  const tryDispatch = useCallback((rawUrl: string) => {
    if (!rawUrl) return;

    // Deduplicate identical URL dispatches within 1500ms
    const now = Date.now();
    if (lastHandledUrlRef.current === rawUrl && now - lastHandledTimeRef.current < 1500) {
      return;
    }
    lastHandledUrlRef.current = rawUrl;
    lastHandledTimeRef.current = now;

    if (shouldDeferShortcut(rawUrl, { userReady: !!user?.id, locked: isLocked, categoriesReady, walletsReady })) {
      pendingDeepLinkRef.current.push(rawUrl);
      return;
    }
    handleUrlDispatch.current?.(rawUrl);
  }, [user?.id, isLocked, categoriesReady, walletsReady]);
  const tryDispatchRef = useRef(tryDispatch);
  tryDispatchRef.current = tryDispatch;

  // Stage 1: Register Capacitor URL listener + cold-launch URL inspection
  useEffect(() => {
    let isSubscribed = true;
    let urlListenerHandle: { remove: () => void } | null = null;

    // 1. Cold launch URL capture via CapApp.getLaunchUrl() (Critical for iOS Shortcuts from terminated state)
    // Run ONCE per app process to prevent re-triggering during in-app cache invalidations (e.g. Settings Sync)
    if (!hasHandledColdLaunchUrlRef.current) {
      hasHandledColdLaunchUrlRef.current = true;
      CapApp.getLaunchUrl()
        .then((launch) => {
          if (isSubscribed && launch?.url) {
            tryDispatchRef.current(launch.url);
          }
        })
        .catch(() => {});
    }

    // 2. Web / PWA URL params on load (e.g. ?text=...)
    if (typeof window !== "undefined" && window.location.search) {
      tryDispatchRef.current(window.location.href);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 3. Warm launch / running background URL scheme events
    CapApp.addListener("appUrlOpen", (event) => {
      if (isSubscribed && event?.url) {
        tryDispatchRef.current(event.url);
      }
    })
      .then((handle) => {
        urlListenerHandle = handle;
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
      if (urlListenerHandle) {
        urlListenerHandle.remove();
      }
    };
  }, []);

  // Dedicated Android Hardware/Gesture Back Button listener (isolated from URL listeners)
  useEffect(() => {
    let isSubscribed = true;
    let backListenerHandle: { remove: () => void } | null = null;

    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (!isSubscribed) return;

      // Priority 1: Close active modal or bottom sheet first
      if (statementImportOpen) {
        setStatementImportOpen(false);
        triggerHaptic("light");
        return;
      }
      if (receiptScanOpen) {
        setReceiptScanOpen(false);
        triggerHaptic("light");
        return;
      }
      if (voiceModalOpen) {
        setVoiceModalOpen(false);
        triggerHaptic("light");
        return;
      }
      if (addSheetOpen) {
        setAddSheetOpen(false);
        triggerHaptic("light");
        return;
      }
      if (recordedShortcutTx) {
        setRecordedShortcutTx(null);
        triggerHaptic("light");
        return;
      }
      if (showGuestMigrationModal) {
        setShowGuestMigrationModal(false);
        triggerHaptic("light");
        return;
      }
      if (isPreviewingInitialSync) {
        setIsPreviewingInitialSync(false);
        triggerHaptic("light");
        return;
      }

      // Priority 2: Navigate back in history if not at root
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    })
      .then((handle) => {
        backListenerHandle = handle;
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
      if (backListenerHandle) {
        backListenerHandle.remove();
      }
    };
  }, [
    statementImportOpen,
    receiptScanOpen,
    voiceModalOpen,
    addSheetOpen,
    recordedShortcutTx,
    showGuestMigrationModal,
    isPreviewingInitialSync,
  ]);

  // Stage 2: Drain queued deep link once categories/wallets have loaded
  useEffect(() => {
    if (!user?.id || isLocked || !categoriesReady || !walletsReady) return;
    const queued = pendingDeepLinkRef.current.splice(0);
    queued.forEach(url => handleUrlDispatch.current?.(url));
  }, [user?.id, isLocked, categoriesReady, walletsReady]);

  // Sync smart notifications (Weekly Financial Digest, Month-End Wealth Review, Budget Threshold Alerts)
  useEffect(() => {
    if (allTxs.length > 0) {
      syncWeeklyDigestNotification(allTxs, isIndonesian).catch(() => {});
      syncMonthEndReviewNotification(isIndonesian).catch(() => {});
      if (categories.length > 0) {
        checkBudgetThresholdAlerts(allTxs, categories, isIndonesian).catch(() => {});
      }
    }
  }, [allTxs, categories, isIndonesian]);



  // Flush pending offline mutations when user returns to active app from privacy shield
  useEffect(() => {
    if (!isPrivacyShieldActive && user?.id) {
      flushPendingMutations().catch(() => {});
    }
  }, [isPrivacyShieldActive, user?.id]);

  const ensureCategories = useEnsureDefaultCategories();
  const ensureWallets = useEnsureDefaultWallets();

  useEffect(() => {
    const isAlreadySynced = localStorage.getItem(syncStorageKey) === "true";
    setHasInitialSynced(isAlreadySynced);
    if (isAlreadySynced) {
      setIsInitDone(true);
    }
    if (user?.id && !isGuest) {
      fetchHoldingsFromSupabase(user.id).catch((e) =>
        console.warn("[App] Cloud holdings fetch error:", e),
      );

      const migrationKey = `trouvaille_migrated_guest_${user.id}`;
      const isAlreadyHandled = localStorage.getItem(migrationKey) === "true";
      if ((!isAlreadyHandled && hasGuestData()) || localStorage.getItem(GUEST_CAPTURE_OWNER_KEY)) {
        setShowGuestMigrationModal(true);
      } else if (!isAlreadyHandled) {
        localStorage.setItem(migrationKey, "true");
      }

      flushPendingMutations().catch((e) =>
        console.warn("[App] Background flush warning:", e),
      );
    }
  }, [syncStorageKey, user?.id, isGuest, queryClient]);

  // Auto-bypass onboarding trap if user already has synced transactions from cloud
  useEffect(() => {
    if (
      user &&
      !isGuest &&
      !isOnboarded &&
      (syncedTxCount > 0 || user.user_metadata?.onboarded === true)
    ) {
      localStorage.setItem(`trouvaille_onboarded_${user.id}`, "true");
      localStorage.setItem("trouvaille_onboarded", "true");
      if (!localStorage.getItem("trouvaille_onboarding_focus")) {
        localStorage.setItem("trouvaille_onboarding_focus", "expenses");
      }
      setIsOnboarded(true);
    }
  }, [user, isGuest, isOnboarded, syncedTxCount]);

  useEffect(() => {
    const handleOnline = () => {
      if (user?.id) {
        flushPendingMutations({ force: true })
          .then((res) => {
            if (res.flushedCount > 0) {
              queryClient.invalidateQueries({ queryKey: ["transactions"] });
              queryClient.invalidateQueries({ queryKey: ["wallets"] });
            }
          })
          .catch((e) => console.warn("[App] Online reconnect flush warning:", e));
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user?.id, queryClient]);

  useEffect(() => {
    async function init() {
      if (hasInitialSynced) {
        setIsInitDone(true);
        return;
      }

      // Guest / Offline local mode: smooth fluid progression without Supabase calls
      if (isGuest || user?.id === "guest_local_user") {
        setSyncStatusText("Initializing private encryption vault...");
        setSyncProgress(35);
        await new Promise((r) => setTimeout(r, 220));

        setSyncStatusText("Configuring offline intelligence engine...");
        setSyncProgress(75);
        await new Promise((r) => setTimeout(r, 280));

        setSyncStatusText("Vault ready. Welcome to Accrual.");
        setSyncProgress(100);
        await new Promise((r) => setTimeout(r, 300));

        setIsInitDone(true);
        setHasInitialSynced(true);
        try {
          localStorage.setItem(syncStorageKey, "true");
        } catch {}
        return;
      }

      if (!user?.id) {
        setIsInitDone(true);
        return;
      }

      try {
        if (user) {
          let transactionsReady = false;

          setSyncStatusText("Fetching authoritative transactions & accounts...");
          setSyncProgress(25);

          try {
            const [freshTxs, walletsRes, categoriesRes, billsRes] = await Promise.all([
              fetchAllTransactionsFromSupabase(
                { userId: user.id },
                (current, total) => {
                  setSyncedTxCount(current);
                  if (total && total > 0) {
                    const pct = Math.round(25 + (current / total) * 60);
                    setSyncProgress(Math.min(88, pct));
                    setSyncStatusText(
                      `Loading ${current} of ${total} transactions...`,
                    );
                  } else {
                    const pct = Math.min(88, 25 + Math.round(current / 10));
                    setSyncProgress(pct);
                    setSyncStatusText(`Loading ${current} transactions...`);
                  }
                },
              ),
              supabase
                .from("wallets")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: true }),
              supabase
                .from("categories")
                .select("*")
                .eq("user_id", user.id)
                .order("name"),
              supabase
                .from("bills")
                .select("*")
                .eq("user_id", user.id)
                .order("due_date", { ascending: true }),
              fetchHoldingsFromSupabase(user.id),
            ]);

            setSyncedTxCount(freshTxs.length);
            queryClient.setQueryData(transactionKeys.all(user.id), freshTxs);

            if (!walletsRes.error) {
              const walletsData = walletsRes.data ?? [];
              queryClient.setQueryData(walletKeys.all(user.id), walletsData);
              if (walletsData.length === 0 && isOnboarded) {
                ensureWallets.mutate();
              }
            }
            if (!categoriesRes.error) {
              const categoriesData = categoriesRes.data ?? [];
              queryClient.setQueryData(categoryKeys.all(user.id), categoriesData);
              if (categoriesData.length === 0 && isOnboarded) {
                ensureCategories.mutate();
              }
            }
            if (!billsRes.error) {
              queryClient.setQueryData(["bills", user.id], billsRes.data ?? []);
            }

            // Proactively auto-consolidate any duplicate categories or wallets in the background
            if (user?.id && !isGuest) {
              const currentWallets = walletsRes.data ?? [];
              const currentCats = categoriesRes.data ?? [];
              if (currentCats.length > 0) {
                autoDeduplicateCategories(user.id, currentCats, freshTxs, queryClient).catch(() => {});
              }
              if (currentWallets.length > 0) {
                autoDeduplicateWallets(user.id, currentWallets, freshTxs, queryClient).catch(() => {});
              }
            }

            transactionsReady = true;
            setSyncProgress(98);

            // Cloud Data Detection & Auto-Onboard Bypass:
            // Existing cloud users with transaction history should not be forced through onboarding modal
            const hasCloudLedger =
              freshTxs.length > 0 ||
              user?.user_metadata?.onboarded === true ||
              (walletsRes.data &&
                walletsRes.data.length > 0 &&
                categoriesRes.data &&
                categoriesRes.data.length > 0 &&
                localStorage.getItem(`trouvaille_onboarded_${user.id}`) === "true");
            if (hasCloudLedger) {
              localStorage.setItem(`trouvaille_onboarded_${user.id}`, "true");
              localStorage.setItem("trouvaille_onboarded", "true");
              if (!localStorage.getItem("trouvaille_onboarding_focus")) {
                localStorage.setItem("trouvaille_onboarding_focus", "expenses");
              }
              setIsOnboarded(true);
            }
          } catch (e) {
            console.warn("Hydrate queries error:", e);
            const cachedTxs = queryClient.getQueryData(
              transactionKeys.all(user.id),
            ) as unknown;
            if (Array.isArray(cachedTxs)) {
              transactionsReady = true;
              setSyncedTxCount(cachedTxs.length);
              setSyncStatusText(
                "Using cached transactions while background sync recovers...",
              );
              setSyncProgress(96);
            }
          }

          setSyncProgress(100);
          setSyncStatusText(
            transactionsReady
              ? "Ready! Welcome to Accrual..."
              : "Opening with limited data...",
          );
          await new Promise((r) => setTimeout(r, 500));
          setIsInitDone(true);
        } else {
          setIsInitDone(true);
        }
      } catch (err) {
        console.warn("Init error:", err);
        setIsInitDone(true);
        setSyncProgress(100);
        setSyncStatusText("Unable to complete full sync. Opening app...");
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hasInitialSynced]);

  if (isPreviewingInitialSync) {
    return (
      <InitialSyncScreen
        isPreview={true}
        totalCount={syncedTxCount || allTxs.length || 24}
        isDataReady={true}
        onComplete={() => {
          setIsPreviewingInitialSync(false);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("preview");
            window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
          }
        }}
      />
    );
  }

  if (!hasInitialSynced) {
    return (
      <InitialSyncScreen
        totalCount={syncedTxCount || allTxs.length}
        progress={syncProgress}
        statusText={syncStatusText}
        isDataReady={isInitDone}
        onComplete={() => {
          localStorage.setItem(syncStorageKey, "true");
          setHasInitialSynced(true);
        }}
      />
    );
  }

  // Guest Data Migration Intercept Dialog
  if (showGuestMigrationModal && user?.id) {
    return (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4 select-none"
        style={{
          background: isDark ? "rgba(6, 6, 8, 0.85)" : "rgba(244, 244, 247, 0.85)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`w-full max-w-sm rounded-[32px] p-6 border flex flex-col items-center text-center shadow-2xl relative ${
            isDark
              ? "bg-[#121216] border-white/16 text-white"
              : "bg-white border-black/10 text-zinc-950"
          }`}
          style={{
            boxShadow: isDark
              ? "0 20px 48px -12px rgba(0,0,0,0.5)"
              : "0 20px 40px -12px rgba(0,0,0,0.1)",
          }}
        >
          <div
            className={`w-12 h-12 rounded-[18px] flex items-center justify-center border mb-3.5 ${
              isDark ? "bg-white/10 border-white/15" : "bg-black/5 border-black/10"
            }`}
          >
            <ArrowRight size={20} strokeWidth={1.75} className={isDark ? "text-white" : "text-zinc-900"} />
          </div>

          <h3 className="text-[17px] font-semibold tracking-tight">
            {isIndonesian ? "Pindahkan Data Tamu?" : "Migrate Guest Data?"}
          </h3>
          <p
            className={`text-[12.5px] mt-1.5 mb-6 leading-relaxed ${
              isDark ? "text-white/60" : "text-zinc-600"
            }`}
          >
            {isIndonesian
              ? "Ditemukan catatan transaksi lokal dari sesi tamu. Apakah Anda ingin menyinkronkannya ke akun baru Anda atau memulai dari awal?"
              : "Found local ledger records from your guest session. Would you like to sync them into your authenticated account or start fresh?"}
          </p>

          <div className="w-full space-y-2.5">
            <button
              type="button"
              onClick={async () => {
                triggerSuccessHaptic();
                try {
                const guestOwner = localStorage.getItem(GUEST_CAPTURE_OWNER_KEY);
                if (guestOwner && Capacitor.getPlatform() === "ios") {
                  await AccrualInbox.setOwner({ ownerId: user.id });
                  await AccrualInbox.adoptOwner({ fromOwnerId: guestOwner, toOwnerId: user.id });
                }
                if(guestOwner){adoptLocalCaptures(guestOwner,user.id);adoptCaptureDrafts(guestOwner,user.id);}
                await migrateGuestDataToCloud(user.id);
                localStorage.removeItem(GUEST_CAPTURE_OWNER_KEY);
                window.dispatchEvent(new CustomEvent("accrual:capture-settings"));
                localStorage.setItem(`trouvaille_onboarded_${user.id}`, "true");
                localStorage.setItem("trouvaille_onboarded", "true");
                setIsOnboarded(true);
                setShowGuestMigrationModal(false);
                queryClient.invalidateQueries({ queryKey: ["wallets"] });
                queryClient.invalidateQueries({ queryKey: ["transactions"] });
                queryClient.invalidateQueries({ queryKey: ["categories"] });
                } catch (error) {
                  console.error("[CaptureMigration]", error);
                  showToast(isIndonesian ? "Pemindahan belum selesai. Data tamu tetap disimpan. Coba lagi." : "Migration is incomplete. Guest data is retained. Please retry.", "info");
                }
              }}
              className={`w-full py-3.5 rounded-[22px] font-semibold text-[13.5px] active:scale-[0.98] transition-all cursor-pointer ${
                isDark
                  ? "bg-white text-zinc-950 hover:bg-zinc-100 shadow-md"
                  : "bg-zinc-950 text-white hover:bg-zinc-900 shadow-md"
              }`}
            >
              {isIndonesian ? "Pindahkan ke Akun" : "Transfer to Account"}
            </button>

            <button
              type="button"
              onClick={async () => {
                triggerHaptic("light");
                try {
                const guestOwner=localStorage.getItem(GUEST_CAPTURE_OWNER_KEY);
                if(guestOwner && Capacitor.getPlatform()==="ios") await AccrualInbox.discardGuestOwner({ownerId:guestOwner});
                if(guestOwner){discardCaptureDrafts(guestOwner);ackLocalCaptures(guestOwner,readLocalCaptures(guestOwner).map(item=>item.id));}
                discardGuestData(user.id);
                localStorage.removeItem(GUEST_CAPTURE_OWNER_KEY);
                setShowGuestMigrationModal(false);
                queryClient.invalidateQueries({ queryKey: ["categories"] });
                queryClient.invalidateQueries({ queryKey: ["wallets"] });
                queryClient.invalidateQueries({ queryKey: ["transactions"] });
                } catch (error) {
                  console.error("[CaptureDiscard]", error);
                  showToast(isIndonesian ? "Penghapusan data tamu belum selesai. Coba lagi." : "Guest data removal is incomplete. Please retry.", "info");
                }
              }}
              className={`w-full py-3 rounded-[22px] font-medium text-[12.5px] active:scale-[0.98] transition-all cursor-pointer ${
                isDark ? "text-white/50 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {isIndonesian ? "Mulai dari Awal (Hapus Data Tamu)" : "Start Fresh (Discard Guest Data)"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Dedicated Full-Screen Customization Step:
  // User MUST complete customization before Home is ever rendered.
  if (!isOnboarded) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <OnboardingModal
          isOpen={true}
          onComplete={() => {
            if (user?.id) {
              localStorage.setItem(`trouvaille_onboarded_${user.id}`, "true");
              supabase.auth.updateUser({ data: { onboarded: true } }).catch(() => {});
            } else if (isGuest) {
              localStorage.setItem("trouvaille_onboarded_guest", "true");
            }
            localStorage.setItem("trouvaille_onboarded", "true");
            setIsOnboarded(true);
            setIsTourOpen(true);
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            queryClient.invalidateQueries({ queryKey: ["wallets"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            navigate("/", { replace: true });
          }}
        />
      </Suspense>
    );
  }

  return (
    <div
      className="h-[100dvh] w-full relative overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Floating Smart Clipboard Notification Sniffer */}
      <div
        className="fixed left-4 right-4 z-[75] max-w-md mx-auto pointer-events-none"
        style={{ top: "max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)" }}
      >
        <ClipboardTransactionBanner
          categories={categories}
          wallets={wallets}
          existingTransactions={allTxs}
          onAddTransaction={(detected) => {
            setPrefilledValues({
              amount: detected.amount,
              type: detected.type,
              note: detected.merchantOrNote,
              category_id: detected.suggestedCategoryId || "",
              wallet_id: detected.suggestedWalletId || "",
            });
            setAddSheetOpen(true);
          }}
          onReviewBatch={(items, appName) => {
            setBatchReviewItems(items);
            setBatchSourceTitle(appName);
            setBatchReviewOpen(true);
          }}
        />
      </div>

      <div
        id="app-scroll-container"
        className="h-full overflow-y-auto overflow-x-hidden safe-area-top pb-[80px] overscroll-y-contain"
      >
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  onOpenAdd={() => setAddSheetOpen(true)}
                  onOpenScan={() => setReceiptScanOpen(true)}
                  onOpenBatchReview={(items, appName) => {
                    setBatchReviewItems(items);
                    setBatchSourceTitle(appName || (isIndonesian ? "Draft Transaksi" : "Draft Inbox"));
                    setBatchReviewOpen(true);
                  }}
                />
              }
            />
            <Route
              path="/transactions"
              element={
                <TransactionsPage
                  onOpenScan={() => setReceiptScanOpen(true)}
                  onOpenImport={() => setStatementImportOpen(true)}
                  onOpenVoiceAdd={() => setVoiceModalOpen(true)}
                  onOpenBatchReview={(items, appName) => {
                    setBatchReviewItems(items);
                    setBatchSourceTitle(appName || (isIndonesian ? "Draft Transaksi" : "Draft Inbox"));
                    setBatchReviewOpen(true);
                  }}
                />
              }
            />
            <Route
              path="/history"
              element={
                <TransactionsPage
                  onOpenScan={() => setReceiptScanOpen(true)}
                  onOpenImport={() => setStatementImportOpen(true)}
                  onOpenVoiceAdd={() => setVoiceModalOpen(true)}
                  onOpenBatchReview={(items, appName) => {
                    setBatchReviewItems(items);
                    setBatchSourceTitle(appName || (isIndonesian ? "Draft Transaksi" : "Draft Inbox"));
                    setBatchReviewOpen(true);
                  }}
                />
              }
            />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/bills" element={<CalendarPage />} />
            <Route path="/statistics" element={<StatisticsPage />} />
            <Route path="/stats" element={<StatisticsPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/investments" element={<AssetsPage />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  onOpenImport={() => setStatementImportOpen(true)}
                  onStartTour={() => {
                    try {
                      localStorage.setItem("trouvaille_tour_pending", "true");
                    } catch {}
                    setIsTourOpen(true);
                  }}
                />
              }
            />
            <Route path="/categories" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>

      {!addSheetOpen && (
        <BottomTabBar
          onOpenAdd={() => {
            if (currentUserRole === "viewer") {
              showToast(
                isIndonesian
                  ? "Anda hanya dapat melihat sebagai anggota Viewer."
                  : "You can only view as a Viewer member.",
                "info",
              );
              return;
            }
            setPrefilledValues(null);
            setAddSheetOpen(true);
          }}
          onOpenVoiceAdd={() => {
            if (currentUserRole === "viewer") {
              showToast(
                isIndonesian
                  ? "Anda hanya dapat melihat sebagai anggota Viewer."
                  : "You can only view as a Viewer member.",
                "info",
              );
              return;
            }
            setVoiceModalOpen(true);
          }}
          onOpenScan={() => {
            if (currentUserRole === "viewer") {
              showToast(
                isIndonesian
                  ? "Anda hanya dapat melihat sebagai anggota Viewer."
                  : "You can only view as a Viewer member.",
                "info",
              );
              return;
            }
            setReceiptScanOpen(true);
          }}
        />
      )}

      {voiceModalOpen && (
        <Suspense fallback={null}>
          <VoiceQuickAddModal
            isOpen={voiceModalOpen}
            onClose={() => setVoiceModalOpen(false)}
            onOpenScan={() => {
              setVoiceModalOpen(false);
              setReceiptScanOpen(true);
            }}
            onOpenForm={(values) => {
              setPrefilledValues(values);
              setVoiceModalOpen(false);
              setAddSheetOpen(true);
            }}
          />
        </Suspense>
      )}

      {receiptScanOpen && (
        <Suspense fallback={null}>
          <ReceiptScanModal
            isOpen={receiptScanOpen}
            onClose={() => setReceiptScanOpen(false)}
            onOpenImport={() => {
              setReceiptScanOpen(false);
              setStatementImportOpen(true);
            }}
            onOpenForm={(values) => {
              setPrefilledValues(values);
              setReceiptScanOpen(false);
              setAddSheetOpen(true);
            }}
          />
        </Suspense>
      )}

      {statementImportOpen && (
        <Suspense fallback={null}>
          <StatementImportModal
            isOpen={statementImportOpen}
            onClose={() => setStatementImportOpen(false)}
          />
        </Suspense>
      )}

      {batchReviewOpen && (
        <Suspense fallback={null}>
          <BatchTransactionReviewSheet
            isOpen={batchReviewOpen}
            onClose={() => setBatchReviewOpen(false)}
            items={batchReviewItems}
            categories={categories}
            wallets={wallets}
            sourceTitle={batchSourceTitle}
            onConfirmBatch={handleConfirmBatchReview}
            onSaveDraft={handleSaveDraftReview}
          />
        </Suspense>
      )}

      {addSheetOpen && (
        <Suspense fallback={<LoadingScreen />}>
          <TransactionSheet
            isOpen={addSheetOpen}
            onClose={() => {
              setAddSheetOpen(false);
              setPrefilledValues(null);
              setEditingCaptureTx(null);
            }}
            transaction={editingCaptureTx}
            initialValues={prefilledValues}
            onOpenScan={() => {
              setAddSheetOpen(false);
              setReceiptScanOpen(true);
            }}
            onOpenVoiceAdd={() => {
              setAddSheetOpen(false);
              setVoiceModalOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Dynamic Notch Subtle Floating Frosted Glass Background Sync Status Indicator */}
      <SyncStatusPill isBlocked={!!recordedShortcutTx} />

      {/* Dynamic Island Floating Glass HUD Capsule for Auto-saved Shortcut & Live Partner Transactions */}
      <DynamicIslandHUD
        data={recordedShortcutTx}
        onClose={() => {setRecordedShortcutTx(null);setSavedCaptureTx(null);}}
        onEdit={() => {
          if (savedCaptureTx && recordedShortcutTx?.transactionId===savedCaptureTx.id) {
            setEditingCaptureTx(savedCaptureTx);setSavedCaptureTx(null);setPrefilledValues(null);setRecordedShortcutTx(null);setAddSheetOpen(true);
          } else {setRecordedShortcutTx(null);navigate('/transactions');}
        }}
        onViewLedger={(ledgerId) => {
          setActiveSpaceId(ledgerId);
        }}
      />

      {/* Join Shared Ledger Modal */}
      {joinLedgerOpen && (
        <Suspense fallback={null}>
          <JoinLedgerModal
            isOpen={joinLedgerOpen}
            initialCode={joinLedgerCode}
            onClose={() => {
              setJoinLedgerOpen(false);
              setJoinLedgerCode("");
            }}
            onOpenLogin={exitGuestMode}
          />
        </Suspense>
      )}

      {/* Global Cross-Page Essential Feature & Product Tour */}
      <Suspense fallback={null}>
        <ProductTourOverlay
          isOpen={isTourOpen}
          onClose={() => setIsTourOpen(false)}
        />
      </Suspense>

      {/* Accrual Pro Membership Paywall Modal */}
      {isPaywallOpen && (
        <Suspense fallback={null}>
          <AccrualPaywallModal
            isOpen={isPaywallOpen}
            onClose={closePaywall}
          />
        </Suspense>
      )}

      {/* Accrual Pro Membership Success & Privileges Modal */}
      {isSuccessModalOpen && (
        <Suspense fallback={null}>
          <SubscriptionSuccessModal
            isOpen={isSuccessModalOpen}
            onClose={closeSuccessModal}
            subscription={successModalSub || subscription}
            onOpenCancelModal={openCancelModal}
          />
        </Suspense>
      )}

      {/* Accrual Pro Cancel / Manage Auto-Renewal Modal */}
      {isCancelModalOpen && (
        <Suspense fallback={null}>
          <CancelSubscriptionModal
            isOpen={isCancelModalOpen}
            onClose={closeCancelModal}
            subscription={subscription}
          />
        </Suspense>
      )}


      {/* iOS App Switcher / Multitasking Privacy Screen Shield */}
      {isPrivacyShieldEnabled && isPrivacyShieldActive && (
        <div
          onClick={() => setIsPrivacyShieldActive(false)}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-between p-8 sm:p-12 overflow-hidden cursor-pointer select-none transition-colors duration-300"
          style={{
            fontFamily: "'Urbanist', sans-serif",
            backgroundColor: isDark ? "#09090c" : "#f4f4f7",
          }}
        >
          {/* 3-4 Color Monochrome Fluid Mesh Gradient Layer */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute inset-0 transition-all duration-500"
              style={{
                background: isDark
                  ? "radial-gradient(ellipse at 50% 40%, #15161c 0%, #09090c 85%)"
                  : "radial-gradient(ellipse at 50% 40%, #ffffff 0%, #e5e5ea 85%)",
              }}
            />
            {/* Color 1: Cool Mist (Top Right) */}
            <div
              className={`absolute -top-16 -right-16 w-[420px] h-[420px] rounded-full blur-[110px] ${
                isDark ? "bg-white/[0.08]" : "bg-white/90"
              }`}
            />
            {/* Color 2: Graphite / Platinum Slate (Center Left) */}
            <div
              className={`absolute top-1/3 -left-28 w-[450px] h-[450px] rounded-full blur-[130px] ${
                isDark ? "bg-zinc-600/[0.22]" : "bg-zinc-300/[0.45]"
              }`}
            />
            {/* Color 3: Soft Pearl Glow (Bottom Center) */}
            <div
              className={`absolute -bottom-20 left-1/4 w-[480px] h-[480px] rounded-full blur-[120px] ${
                isDark ? "bg-zinc-400/[0.12]" : "bg-zinc-200/[0.6]"
              }`}
            />
            {/* Color 4: Charcoal Shadow / Accent (Bottom Right) */}
            <div
              className={`absolute bottom-10 -right-20 w-[380px] h-[380px] rounded-full blur-[100px] ${
                isDark ? "bg-black/70" : "bg-zinc-400/[0.25]"
              }`}
            />

            {/* Apple Fractal Glass Fine Ribbed Slat Texture */}
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage: isDark
                  ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 38px)"
                  : "repeating-linear-gradient(90deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 38px)",
              }}
            />
          </div>

          {/* Spacer top (logo removed per user request) */}
          <div className="h-6" />

          {/* Center: Apple Staggered Typography (Reference Matching) */}
          <div className="relative z-10 text-center max-w-sm mx-auto space-y-3 px-4 my-auto">
            <h1 className="text-[34px] sm:text-[40px] leading-[1.14] tracking-tight">
              <span
                className={`font-semibold ${
                  isDark ? "text-white" : "text-zinc-950"
                }`}
              >
                {isIndonesian ? "Kekayaan Anda" : "Your wealth"}
              </span>{" "}
              <span
                className={`font-light ${
                  isDark ? "text-white/35" : "text-zinc-950/35"
                }`}
              >
                {isIndonesian ? "terlindungi" : "is"}
              </span>
              <br />
              <span
                className={`font-light ${
                  isDark ? "text-white/35" : "text-zinc-950/35"
                }`}
              >
                {isIndonesian ? "dari sorotan" : "camera shy"}
              </span>{" "}
              <span
                className={`font-semibold ${
                  isDark ? "text-white" : "text-zinc-950"
                }`}
              >
                {isIndonesian ? "kamera" : "for you"}
              </span>
            </h1>
            <p
              className={`text-[13px] tracking-wide font-normal ${
                isDark ? "text-white/50" : "text-zinc-950/50"
              }`}
            >
              {isIndonesian
                ? "Khusus untuk mata Anda · Privasi aktif secara otomatis"
                : "Eyes on your own screen · Private by default"}
            </p>
          </div>

          {/* Bottom: Minimalist Apple Privacy Pill */}
          <div className="relative z-10 pb-4">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] ${
                isDark
                  ? "bg-white/[0.06] border border-white/10 text-white/70"
                  : "bg-black/[0.05] border border-black/10 text-zinc-900/70"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  isDark ? "bg-white/90" : "bg-zinc-900/90"
                }`}
              />
              <span className="text-[11px] font-medium tracking-wide">
                {isIndonesian ? "Layar Privasi Aktif" : "Privacy Shield Active"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { BiometricLockOverlay } from "./components/security/BiometricLockOverlay";

export default function App() {
  const { session, loading, isGuest, isPasswordRecovery, setIsPasswordRecovery } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session && !isGuest) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <LoginPage />
        <ResetPasswordModal
          isOpen={isPasswordRecovery}
          onClose={() => setIsPasswordRecovery(false)}
        />
      </Suspense>
    );
  }
  return (
    <>
      <AppShell />
      <BiometricLockOverlay />
      <Suspense fallback={null}>
        <ResetPasswordModal
          isOpen={isPasswordRecovery}
          onClose={() => setIsPasswordRecovery(false)}
        />
      </Suspense>
    </>
  );
}
