// ======================================================================
// TROUVAILLE RECEIPT & BANK SLIP SCANNER MODAL
// Ultra-minimalist Apple Liquid Glass Edition
// Translucent specular highlights, lens viewfinder & tap-to-inspect
// Strictly compliant with GEMINI.md: Urbanist scale & zero native emojis
// ======================================================================

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ScanLine,
  Camera,
  Image as ImageIcon,
  CreditCard,
  Tag,
  Calendar,
  Pen,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  Sparkles,
  ChevronRight,
  Search,
  Plus,
  AlertCircle,
  Eye,
  FileSpreadsheet,
  Shield,
  Flashlight,
  ArrowRightLeft,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  capturePhotoFromCamera,
  pickPhotoFromGallery,
  requestPhotosPermission,
  requestCameraPermission,
} from "../../lib/mediaPermissions";
import { scanReceiptOrSlip, type OCRScanResult } from "../../lib/ocrEngine";
import type { ParsedSlipResult } from "../../lib/slipParser";
import {
  useWallets,
  useAddWallet,
  getWalletIcon,
} from "../../hooks/useWallets";
import { useCategories, useAddCategory } from "../../hooks/useCategories";
import { useAddTransaction } from "../../hooks/useTransactions";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useQuota } from "../../hooks/useQuota";
import { formatCurrency } from "../../lib/utils";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { format } from "date-fns";
import type { TransactionType } from "../../lib/types";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import { GlassDateTimePickerModal } from "../ui/GlassDateTimePickerModal";
import { saveMerchantMemory } from "../../lib/merchantCategoryMemory";

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImport?: () => void;
  onOpenForm: (initialValues: {
    type: TransactionType;
    amount: number;
    categoryId: string | null;
    walletId: string | null;
    toWalletId: string | null;
    date: Date;
    note: string;
  }) => void;
}

export function ReceiptScanModal({
  isOpen,
  onClose,
  onOpenImport,
  onOpenForm,
}: ReceiptScanModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);

  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();
  const { preferredCurrency, currencyMeta } = useCurrency();
  const isDark = theme !== "light";

  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const addWalletMutation = useAddWallet();
  const addCategoryMutation = useAddCategory();
  const addTx = useAddTransaction();
  const { showToast } = useToast();
  const { isPremium } = useSubscription();
  const { checkOcrLimitAndPrompt, recordOcrUsage, ocrRemaining } = useQuota();

  const [step, setStep] = useState<"idle" | "processing" | "result">("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imagePreviewRef = useRef(imagePreview);
  useEffect(() => {
    imagePreviewRef.current = imagePreview;
  }, [imagePreview]);
  const [inspectPhotoOpen, setInspectPhotoOpen] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStatus, setProgressStatus] = useState(
    isIndonesian ? "Menyiapkan..." : "Preparing...",
  );
  const [errorText, setErrorText] = useState<string | null>(null);

  // Editable parsed fields
  const [parsedSlip, setParsedSlip] = useState<ParsedSlipResult | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [toWalletId, setToWalletId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState<string>(format(new Date(), "HH:mm"));
  const [merchant, setMerchant] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [type, setType] = useState<TransactionType>("expense");
  const [includeAdminFee, setIncludeAdminFee] = useState<boolean>(false);
  const [adminFeeAmount, setAdminFeeAmount] = useState<number>(0);

  // Torch / Flash State
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Detected unmapped institution / category
  const [unregisteredWalletName, setUnregisteredWalletName] = useState<
    string | null
  >(null);
  const [unregisteredCategoryName, setUnregisteredCategoryName] = useState<
    string | null
  >(null);

  // Media permission dialog
  const [permissionPrompt, setPermissionPrompt] = useState<{
    isOpen: boolean;
    type: "photos" | "camera";
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: "photos",
    title: "",
    description: "",
  });

  // BottomSheet Drawers
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [toWalletSheetOpen, setToWalletSheetOpen] = useState(false);
  const [dateTimePickerOpen, setDateTimePickerOpen] = useState(false);
  const [searchCatQuery, setSearchCatQuery] = useState("");
  const [searchWalletQuery, setSearchWalletQuery] = useState("");
  const [searchToWalletQuery, setSearchToWalletQuery] = useState("");

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsLiveCameraActive(false);
    setIsTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities = (
        track.getCapabilities ? track.getCapabilities() : {}
      ) as any;
      if (capabilities.torch) {
        const next = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: next } as any],
        });
        setIsTorchOn(next);
        triggerHaptic("light");
      } else {
        showToast(
          isIndonesian
            ? "Flash tidak didukung di perangkat ini"
            : "Flash is not supported on this device/camera",
          "info",
        );
      }
    } catch (err) {
      console.warn("Error toggling torch:", err);
      showToast(
        isIndonesian
          ? "Gagal mengubah status senter"
          : "Could not toggle flash",
        "delete",
      );
    }
  };

  const startLiveCamera = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    )
      return;

    // On native platforms (iOS/Android), ensure native camera permission is granted first
    if (Capacitor.isNativePlatform()) {
      try {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
          console.warn(
            "[ReceiptScanModal] Native camera permission not granted",
          );
          return;
        }
      } catch (err) {
        console.warn("[ReceiptScanModal] requestCameraPermission error:", err);
      }
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsLiveCameraActive(true);
    } catch (err) {
      console.warn("[ReceiptScanModal] Live camera stream unavailable:", err);
      stopLiveCamera();
    }
  };

  useEffect(() => {
    if (isOpen && step === "idle") {
      startLiveCamera();
    } else {
      stopLiveCamera();
    }
    return () => {
      stopLiveCamera();
    };
  }, [isOpen, step]);

  // Reset state when modal closed
  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
      setStep("idle");
      const currentBlob = imagePreviewRef.current;
      if (currentBlob && currentBlob.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(currentBlob);
        } catch {}
      }
      setImagePreview(null);
      setInspectPhotoOpen(false);
      setProgressPct(0);
      setParsedSlip(null);
      setErrorText(null);
      setMerchant("");
      setNote("");
      setTime(format(new Date(), "HH:mm"));
      setUnregisteredWalletName(null);
      setUnregisteredCategoryName(null);
      setCategorySheetOpen(false);
      setWalletSheetOpen(false);
      setToWalletSheetOpen(false);
      setDateTimePickerOpen(false);
      setSearchCatQuery("");
      setSearchWalletQuery("");
      setSearchToWalletQuery("");
      setToWalletId(null);
      setIncludeAdminFee(false);
      setAdminFeeAmount(0);
      setPermissionPrompt({
        isOpen: false,
        type: "photos",
        title: "",
        description: "",
      });
    }
  }, [isOpen]);

  // Selected item references
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === walletId),
    [wallets, walletId],
  );

  const selectedToWallet = useMemo(
    () => wallets.find((w) => w.id === toWalletId),
    [wallets, toWalletId],
  );

  // Combined Date and Time reference
  const combinedDateTime = useMemo(() => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date);
    if (!isNaN(h) && !isNaN(m)) {
      d.setHours(h, m, 0, 0);
    }
    return d;
  }, [date, time]);

  // Handle switching transaction type with smart category syncing
  const handleSetType = (newType: TransactionType) => {
    triggerHaptic("light");
    setType(newType);
    if (newType === "income") {
      const incomeCats = categories.filter((c) => c.type === "income");
      const currentCat = categories.find((c) => c.id === categoryId);
      if (!currentCat || currentCat.type !== "income") {
        setCategoryId(incomeCats.length > 0 ? incomeCats[0].id : null);
      }
    } else if (newType === "expense") {
      const expenseCats = categories.filter((c) => c.type !== "income");
      const currentCat = categories.find((c) => c.id === categoryId);
      if (!currentCat || currentCat.type === "income") {
        setCategoryId(expenseCats.length > 0 ? expenseCats[0].id : null);
      }
    } else if (newType === "transfer") {
      if (!toWalletId || toWalletId === walletId) {
        const otherWallet = wallets.find((w) => w.id !== walletId);
        if (otherWallet) setToWalletId(otherWallet.id);
      }
    }
  };

  // Filtered lists for sheets
  const filteredCategories = useMemo(() => {
    const q = searchCatQuery.trim().toLowerCase();
    const typeCats = categories.filter((c) =>
      type === "income" ? c.type === "income" : c.type !== "income",
    );
    const pool = typeCats.length > 0 ? typeCats : categories;
    if (!q) return pool;
    return pool.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchCatQuery, type]);

  const filteredWallets = useMemo(() => {
    const q = searchWalletQuery.trim().toLowerCase();
    if (!q) return wallets;
    return wallets.filter((w) => w.name.toLowerCase().includes(q));
  }, [wallets, searchWalletQuery]);

  const filteredToWallets = useMemo(() => {
    const q = searchToWalletQuery.trim().toLowerCase();
    if (!q) return wallets;
    return wallets.filter((w) => w.name.toLowerCase().includes(q));
  }, [wallets, searchToWalletQuery]);


  const handleProcessMedia = async (
    fileOrBlob: Blob | File,
    customPreviewUrl?: string,
  ) => {
    if (!checkOcrLimitAndPrompt()) {
      return;
    }
    triggerHaptic("medium");
    setErrorText(null);
    setUnregisteredWalletName(null);
    setUnregisteredCategoryName(null);
    setStep("processing");
    setProgressPct(5);

    const previewUrl = customPreviewUrl || URL.createObjectURL(fileOrBlob);
    setImagePreview(previewUrl);

    try {
      setProgressPct(8);
      setProgressStatus(
        isIndonesian
          ? "Menganalisis teks struk..."
          : "Analyzing receipt text...",
      );

      const result: OCRScanResult = await scanReceiptOrSlip(
        fileOrBlob,
        wallets,
        categories,
        (pct, status) => {
          setProgressPct(pct);
          setProgressStatus(status);
        },
        isIndonesian ? "id" : "en",
      );

      await recordOcrUsage();
      triggerSuccessHaptic();
      setParsedSlip(result.slip);
      setAmount(result.slip.amount || 0);

      // Check wallet match (never fallback to liabilities/debt)
      const spendableWallets = wallets.filter(
        (w) =>
          !w.name.toLowerCase().includes("liabilit") &&
          !w.name.toLowerCase().includes("hutang") &&
          !w.name.toLowerCase().includes("pinjam") &&
          !w.name.toLowerCase().includes("piutang") &&
          !w.name.toLowerCase().includes("crypto") &&
          !w.name.toLowerCase().includes("saham") &&
          !w.name.toLowerCase().includes("investasi"),
      );
      const fallbackWallet =
        spendableWallets.find((w) => /cash|tunai/i.test(w.name)) ||
        spendableWallets.find((w) => /bca|mandiri|bri|bni/i.test(w.name)) ||
        spendableWallets[0] ||
        wallets[0];

      const matchedWallet = wallets.find(
        (w) => w.id === result.slip.sourceWalletId,
      );
      if (matchedWallet) {
        setWalletId(matchedWallet.id);
        setUnregisteredWalletName(null);
      } else {
        if (result.slip.detectedInstitution) {
          setUnregisteredWalletName(result.slip.detectedInstitution);
        }
        setWalletId(fallbackWallet?.id || null);
      }

      // Check category match (never blind fallback to Admin & Fee, match detected transaction type)
      const targetType = result.slip.type === "income" ? "income" : "expense";
      const typeMatchedCategories = categories.filter((c) => c.type === targetType);
      const categoryPool = typeMatchedCategories.length > 0 ? typeMatchedCategories : categories;

      const cleanCats = categoryPool.filter(
        (c) =>
          !c.name.toLowerCase().includes("admin") &&
          !c.name.toLowerCase().includes("fee") &&
          !c.name.toLowerCase().includes("pajak") &&
          !c.name.toLowerCase().includes("legal") &&
          !c.name.toLowerCase().includes("kerugian"),
      );
      const fallbackCat =
        cleanCats.find((c) => /makanan|kuliner|food|resto/i.test(c.name)) ||
        cleanCats.find((c) => /belanja|groceries/i.test(c.name)) ||
        cleanCats.find((c) => /lainnya|other/i.test(c.name)) ||
        cleanCats[0] ||
        categoryPool[0] ||
        categories[0];

      const matchedCat = categories.find(
        (c) => c.id === result.slip.categoryId,
      );
      if (matchedCat) {
        setCategoryId(matchedCat.id);
        setUnregisteredCategoryName(null);
      } else {
        if (result.slip.detectedCategory) {
          setUnregisteredCategoryName(result.slip.detectedCategory);
        }
        setCategoryId(fallbackCat?.id || null);
      }

      setDate(result.slip.date || new Date());
      if (result.slip.time) {
        setTime(result.slip.time);
      } else {
        setTime(format(result.slip.date || new Date(), "HH:mm"));
      }
      const extractedMerchant = result.slip.merchantOrRecipient || "";
      setMerchant(extractedMerchant);
      setNote(extractedMerchant);
      setType(result.slip.type || "expense");
      setToWalletId(result.slip.destinationWalletId || null);
      if (result.slip.adminFee && result.slip.adminFee > 0) {
        setAdminFeeAmount(result.slip.adminFee);
        setIncludeAdminFee(true);
      } else {
        setAdminFeeAmount(0);
        setIncludeAdminFee(false);
      }
      setStep("result");
    } catch (err: any) {
      console.error("[ReceiptScanModal] Scan failed:", err);
      triggerHaptic("heavy");
      setErrorText(
        err?.message ||
          (isIndonesian
            ? "Gagal memindai struk. Pastikan gambar jelas dan cukup cahaya."
            : "Failed to scan receipt. Please ensure the image is clear and well lit."),
      );
      setStep("idle");
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessMedia(file);
    }
    e.target.value = "";
  };

  const captureLiveSnapshot = (): boolean => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0)
      return false;

    triggerHaptic("heavy");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopLiveCamera();

    canvas.toBlob(
      (blob) => {
        if (blob) {
          handleProcessMedia(blob);
        }
      },
      "image/jpeg",
      0.95,
    );
    return true;
  };

  const handleTakePhotoNative = async () => {
    triggerHaptic("medium");
    setErrorText(null);
    try {
      const result = await capturePhotoFromCamera();
      if (result) {
        await handleProcessMedia(result.blob, result.previewUrl);
      }
    } catch (err: any) {
      if (err?.name === "CameraPermissionError") {
        setPermissionPrompt({
          isOpen: true,
          type: "camera",
          title: isIndonesian
            ? "Akses Kamera Diperlukan"
            : "Camera Access Required",
          description: isIndonesian
            ? "Accrual memerlukan akses kamera untuk memindai struk fisik, tagihan, dan bukti transfer secara langsung."
            : "Accrual requires camera access to scan physical receipts, invoices, and payment slips directly.",
        });
      } else {
        console.error("[ReceiptScanModal] Camera capture error:", err);
        setErrorText(
          err?.message ||
            (isIndonesian
              ? "Gagal membuka kamera."
              : "Failed to launch camera."),
        );
      }
    }
  };

  const handlePickGalleryNative = async () => {
    triggerHaptic("light");
    setErrorText(null);
    try {
      const result = await pickPhotoFromGallery();
      if (result) {
        await handleProcessMedia(result.blob, result.previewUrl);
      }
    } catch (err: any) {
      if (err?.name === "PhotosPermissionError") {
        setPermissionPrompt({
          isOpen: true,
          type: "photos",
          title: isIndonesian
            ? "Akses Galeri Foto Diperlukan"
            : "Photo Library Access Required",
          description: isIndonesian
            ? "Accrual memerlukan akses galeri foto untuk mengimpor struk, tagihan, dan tangkapan layar bukti transfer yang tersimpan."
            : "Accrual requires photo library access to import saved receipts, invoices, and payment screenshots.",
        });
      } else {
        console.error("[ReceiptScanModal] Gallery pick error:", err);
        setErrorText(
          err?.message ||
            (isIndonesian
              ? "Gagal membuka galeri foto."
              : "Failed to open photo library."),
        );
      }
    }
  };

  const handleQuickAddWallet = async () => {
    if (!unregisteredWalletName) return;
    triggerHaptic("medium");
    try {
      addWalletMutation.mutate(
        {
          name: unregisteredWalletName,
          icon: getWalletIcon(unregisteredWalletName),
        },
        {
          onSuccess: (createdWallet: any) => {
            triggerSuccessHaptic();
            if (createdWallet?.id) {
              setWalletId(createdWallet.id);
            }
            setUnregisteredWalletName(null);
            showToast(
              isIndonesian
                ? `Akun "${unregisteredWalletName}" dibuat`
                : `Account "${unregisteredWalletName}" created`,
              "add",
              () => {},
            );
          },
          onError: () => {
            showToast(
              isIndonesian ? "Gagal membuat akun" : "Failed to create account",
              "delete",
              () => {},
            );
          },
        },
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickAddCategory = async () => {
    if (!unregisteredCategoryName) return;
    triggerHaptic("medium");
    try {
      addCategoryMutation.mutate(
        {
          name: unregisteredCategoryName,
          emoji: "tag",
          type: "expense",
        },
        {
          onSuccess: (createdCat: any) => {
            triggerSuccessHaptic();
            if (createdCat?.id) {
              setCategoryId(createdCat.id);
            }
            setUnregisteredCategoryName(null);
            showToast(
              isIndonesian
                ? `Kategori "${unregisteredCategoryName}" dibuat`
                : `Category "${unregisteredCategoryName}" created`,
              "add",
              () => {},
            );
          },
          onError: () => {
            showToast(
              isIndonesian
                ? "Gagal membuat kategori"
                : "Failed to create category",
              "delete",
              () => {},
            );
          },
        },
      );
    } catch (err) {
      console.error(err);
    }
  };

  const lastSaveTriggeredAt = useRef<number>(0);
  const touchHandledRef = useRef<boolean>(false);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const executeSave = () => {
    const now = Date.now();
    if (now - lastSaveTriggeredAt.current < 750) return;
    lastSaveTriggeredAt.current = now;
    handleSaveTransaction();
  };

  const handleSaveTransaction = async () => {
    if (!amount || amount <= 0) {
      showToast(
        isIndonesian
          ? "Silakan masukkan nominal yang valid"
          : "Please enter a valid amount",
        "info",
        null,
        2500,
      );
      return;
    }

    const isUUID = (id?: string | null) =>
      !!id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    const effectiveWallet =
      wallets.find((w) => w.id === walletId) || wallets[0];
    const effectiveToWallet =
      wallets.find((w) => w.id === toWalletId) ||
      (wallets.length > 1
        ? wallets[0].id === effectiveWallet?.id
          ? wallets[1]
          : wallets[0]
        : null);
    const effectiveCategory =
      categories.find((c) => c.id === categoryId) ||
      (categories.length > 0 ? categories[0] : null);

    const effectiveWalletId =
      effectiveWallet?.id && isUUID(effectiveWallet.id)
        ? effectiveWallet.id
        : null;
    const effectiveToWalletId =
      type === "transfer" &&
      effectiveToWallet?.id &&
      isUUID(effectiveToWallet.id)
        ? effectiveToWallet.id
        : null;
    const effectiveCatId =
      effectiveCategory?.id && isUUID(effectiveCategory.id)
        ? effectiveCategory.id
        : null;

    if (
      type === "transfer" &&
      effectiveWalletId &&
      effectiveToWalletId &&
      effectiveWalletId === effectiveToWalletId
    ) {
      showToast(
        isIndonesian
          ? "Akun asal dan akun tujuan harus berbeda"
          : "Source and destination accounts must be different",
        "delete",
      );
      return;
    }

    const rawNote = note.trim();
    const cleanNote = rawNote === "-" || rawNote === "--" ? "" : rawNote;
    const rawMerchant = merchant.trim();
    const cleanMerchant =
      rawMerchant === "-" || rawMerchant === "--" ? "" : rawMerchant;
    const finalDescription = cleanNote || cleanMerchant || null;

    // Build timestamp with selected time
    const [h, m] = time.split(":").map(Number);
    const txDate = new Date(date);
    if (!isNaN(h) && !isNaN(m)) {
      txDate.setHours(h, m, 0, 0);
    }

    const saveAdminFeeIfRequested = async () => {
      if (!includeAdminFee || adminFeeAmount <= 0 || !effectiveWalletId) return;

      // Find or create "Biaya Admin" category
      const adminCat = categories.find((c) => {
        const n = c.name.toLowerCase();
        return (
          n.includes("biaya admin") ||
          n.includes("admin fee") ||
          n.includes("biaya transfer") ||
          n === "admin"
        );
      });

      let adminCatId = adminCat?.id || null;
      if (!adminCatId) {
        try {
          const createdCat = await addCategoryMutation.mutateAsync({
            name: isIndonesian ? "Biaya Admin" : "Admin Fee",
            emoji: "receipt",
            type: "expense",
          });
          if (createdCat?.id) {
            adminCatId = createdCat.id;
          }
        } catch {
          const fallbackCat = categories.find((c) => c.type !== "income") || categories[0];
          adminCatId = fallbackCat?.id || null;
        }
      }

      const adminTxDate = new Date(txDate.getTime() + 1000);
      const feeNote = isIndonesian
        ? `Biaya transfer ${cleanMerchant || ""}`.trim()
        : `Transfer fee ${cleanMerchant || ""}`.trim();

      addTx.mutate({
        type: "expense",
        amount: adminFeeAmount,
        wallet_id: effectiveWalletId,
        to_wallet_id: null,
        category_id: adminCatId,
        note: feeNote,
        occurred_on: format(adminTxDate, "yyyy-MM-dd'T'HH:mm:ss"),
        created_at: adminTxDate.toISOString(),
      });
    };

    triggerSuccessHaptic();

    // Persist learned merchant category to memory (Pilar 1)
    if (cleanMerchant && effectiveCatId && effectiveCategory) {
      saveMerchantMemory(cleanMerchant, effectiveCatId, effectiveCategory.name);
    } else if (finalDescription && effectiveCatId && effectiveCategory) {
      saveMerchantMemory(finalDescription, effectiveCatId, effectiveCategory.name);
    }

    if (includeAdminFee && adminFeeAmount > 0 && effectiveWalletId) {
      await saveAdminFeeIfRequested();
      showToast(
        isIndonesian
          ? "2 transaksi dicatat (pokok & biaya admin)"
          : "2 transactions recorded (principal & admin fee)",
        "add",
        () => {},
      );
    } else {
      showToast(
        isIndonesian
          ? "Transaksi berhasil disimpan"
          : "Transaction saved successfully",
        "add",
        () => {},
      );
    }
    onClose();

    addTx.mutate(
      {
        type,
        amount,
        wallet_id: effectiveWalletId,
        to_wallet_id: type === "transfer" ? effectiveToWalletId : null,
        category_id: type === "transfer" ? null : effectiveCatId,
        note: finalDescription || null,
        occurred_on: format(txDate, "yyyy-MM-dd'T'HH:mm:ss"),
        created_at: txDate.toISOString(),
      },
      {
        onError: () => {
          showToast(
            isIndonesian
              ? "Gagal menyimpan transaksi"
              : "Failed to save transaction",
            "delete",
            () => {},
          );
        },
      },
    );
  };

  const handleOpenInFullForm = () => {
    triggerHaptic("light");
    const rawNote = note.trim();
    const cleanNote = rawNote === "-" || rawNote === "--" ? "" : rawNote;
    const rawMerchant = merchant.trim();
    const cleanMerchant =
      rawMerchant === "-" || rawMerchant === "--" ? "" : rawMerchant;

    const finalDescription = cleanNote
      ? cleanMerchant &&
        cleanMerchant.toLowerCase() !== cleanNote.toLowerCase()
        ? `${cleanMerchant} • ${cleanNote}`
        : cleanNote
      : cleanMerchant ||
        (type === "transfer"
          ? "Transfer"
          : isIndonesian
            ? "Struk Hasil Pindai"
            : "Scanned Receipt");

    // Build timestamp with selected time
    const [h, m] = time.split(":").map(Number);
    const combinedDate = new Date(date);
    if (!isNaN(h) && !isNaN(m)) {
      combinedDate.setHours(h, m, 0, 0);
    }

    const feeSuffix =
      includeAdminFee && adminFeeAmount > 0
        ? isIndonesian
          ? ` (Biaya admin: ${formatCurrency(adminFeeAmount, preferredCurrency)})`
          : ` (Admin fee: ${formatCurrency(adminFeeAmount, preferredCurrency)})`
        : "";

    onOpenForm({
      type,
      amount,
      walletId,
      categoryId: type === "transfer" ? null : categoryId,
      toWalletId: type === "transfer" ? toWalletId : null,
      date: combinedDate,
      note: `${finalDescription}${feeSuffix}`,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-auto">
          {/* ============================================================
          BACKDROP
          ============================================================ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={step === "processing" ? undefined : onClose}
            className="fixed inset-0"
            style={{
              background: isDark ? "rgba(0,0,0,0.76)" : "rgba(15,23,42,0.38)",
              backdropFilter: isDark
                ? "blur(24px) saturate(125%)"
                : "blur(20px) saturate(120%)",
              WebkitBackdropFilter: isDark
                ? "blur(24px) saturate(125%)"
                : "blur(20px) saturate(120%)",
            }}
          />

          {/* ============================================================
          MAIN MODAL
          ============================================================ */}
          <motion.div
            initial={{ y: "100%", opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 35 }}
            className="w-full max-w-md rounded-t-[36px] sm:rounded-[36px] p-5 relative z-10 flex flex-col max-h-[95dvh] overflow-hidden"
            style={{
              background: isDark
                ? "linear-gradient(165deg, rgba(255,255,255,0.085) 0%, rgba(255,255,255,0.032) 40%, rgba(0,0,0,0.62) 100%), var(--bg-canvas)"
                : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,248,252,0.88) 100%)",
              backdropFilter: "blur(36px) saturate(180%)",
              WebkitBackdropFilter: "blur(36px) saturate(180%)",
              border: isDark
                ? "1px solid rgba(255,255,255,0.15)"
                : "1px solid rgba(205,205,205,0.45)",
              boxShadow: isDark
                ? [
                    "inset 0 1px 0 rgba(255,255,255,0.20)",
                    "inset 0 -1px 0 rgba(0,0,0,0.20)",
                    "0 18px 40px -18px rgba(0,0,0,0.55)",
                    "0 36px 90px -24px rgba(0,0,0,0.85)",
                  ].join(", ")
                : [
                    "inset 0 1px 0 rgba(255,255,255,1)",
                    "inset 0 -1px 0 rgba(255,255,255,0.40)",
                    "0 14px 34px -10px rgba(15,23,42,0.12)",
                    "0 36px 90px -20px rgba(15,23,42,0.20)",
                  ].join(", "),
              fontFamily: "Urbanist, -apple-system, sans-serif",
              paddingTop:
                "max(calc(env(safe-area-inset-top, 0px) + 12px), 20px)",
              paddingBottom:
                "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
            }}
          >
            {/* ============================================================
            HEADER
            ============================================================ */}
            <div className="flex items-center justify-between pb-3.5">
              <div className="min-w-0">
                <h3
                  className="text-[17px] font-bold tracking-tight leading-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Pindai Struk" : "Scan Receipt"}
                </h3>

                <p
                  className="text-[11.5px] font-medium mt-0.5 flex items-center gap-1.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span className="truncate">
                    {isIndonesian
                      ? "Struk fisik, QRIS & bukti transfer bank"
                      : "Physical receipts, QRIS & bank transfer slips"}
                  </span>

                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold shrink-0"
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.9)",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.10)"
                        : "1px solid rgba(205,205,205,0.38)",
                      color: "var(--text-secondary)",
                      boxShadow: isDark
                        ? "inset 0 1px 0 rgba(255,255,255,0.10)"
                        : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,0.04)",
                    }}
                  >
                    <Shield size={9.5} strokeWidth={1.75} />
                    {isIndonesian ? "Sementara" : "Ephemeral"}
                  </span>
                </p>
              </div>

              {/* Close */}
              <button
                type="button"
                disabled={step === "processing"}
                onClick={() => {
                  triggerHaptic("light");
                  onClose();
                }}
                className="w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all hover:scale-[1.03] active:scale-90 disabled:opacity-40 cursor-pointer shrink-0 ml-3"
                style={{
                  background: isDark
                    ? "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.045))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,244,248,0.85) 100%)",
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.14)"
                    : "1px solid rgba(205,205,205,0.45)",
                  boxShadow: isDark
                    ? "inset 0 1px 0 rgba(255,255,255,0.18), 0 5px 14px rgba(0,0,0,0.25)"
                    : "inset 0 1px 0 rgba(255,255,255,1), 0 3px 10px rgba(15,23,42,0.08)",
                  color: "var(--text-primary)",
                }}
                title={isIndonesian ? "Tutup" : "Close"}
                aria-label={isIndonesian ? "Tutup" : "Close"}
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>

            {/* ============================================================
            ERROR
            ============================================================ */}
            {errorText && (
              <div
                className="p-3 rounded-2xl text-[12px] font-medium border flex items-center gap-2 mb-2"
                style={{
                  background: isDark
                    ? "rgba(239,68,68,0.09)"
                    : "rgba(239,68,68,0.075)",
                  borderColor: isDark
                    ? "rgba(239,68,68,0.25)"
                    : "rgba(220,38,38,0.18)",
                  color: isDark ? "#f87171" : "#dc2626",
                  boxShadow: isDark
                    ? "inset 0 1px 0 rgba(255,255,255,0.05)"
                    : "inset 0 1px 0 rgba(255,255,255,0.7)",
                }}
              >
                <AlertCircle
                  size={14}
                  strokeWidth={1.75}
                  className="shrink-0"
                />
                <span>{errorText}</span>
              </div>
            )}

            {/* ============================================================
            STEP 1 — IDLE
            ============================================================ */}
            {step === "idle" && (
              <div className="flex-1 flex flex-col items-center justify-start pt-1 pb-2 space-y-3">
                {!isPremium && (
                  <div className="w-full max-w-sm flex items-center justify-between px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-[var(--text-tertiary)] mb-1">
                    <span>
                      {isIndonesian
                        ? "Sisa Pemindaian Bulan Ini"
                        : "Scans Remaining This Month"}
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {ocrRemaining} / 5
                    </span>
                  </div>
                )}
                {/* Viewfinder */}
                <div
                  onClick={
                    isLiveCameraActive ? () => captureLiveSnapshot() : undefined
                  }
                  className={`relative w-full aspect-[3/4] max-h-[58dvh] rounded-[28px] flex flex-col items-center justify-center overflow-hidden transition-all bg-black ${
                    isLiveCameraActive ? "cursor-pointer" : ""
                  }`}
                  style={{
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.15)"
                      : "1px solid rgba(255,255,255,0.24)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.4), 0 18px 40px -12px rgba(15,23,42,0.24)",
                  }}
                >
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    muted
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                      isLiveCameraActive
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    }`}
                  />

                  {/* Live indicator */}
                  {isLiveCameraActive && (
                    <div className="absolute top-3.5 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span className="text-[10px] font-semibold text-white/90 tracking-wide uppercase">
                        {isIndonesian ? "Kamera Langsung" : "Live Camera"}
                      </span>
                    </div>
                  )}

                  {/* Flash */}
                  {isLiveCameraActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTorch();
                      }}
                      className={`absolute top-3.5 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border transition-all active:scale-90 cursor-pointer ${
                        isTorchOn
                          ? "bg-white text-zinc-950 border-white shadow-md shadow-white/20"
                          : "bg-black/60 text-white/90 border-white/15 hover:bg-black/80"
                      }`}
                      title={
                        isTorchOn
                          ? isIndonesian
                            ? "Matikan Lampu Kilat"
                            : "Turn Flash Off"
                          : isIndonesian
                            ? "Nyalakan Lampu Kilat"
                            : "Turn Flash On"
                      }
                      aria-label={
                        isTorchOn
                          ? isIndonesian
                            ? "Matikan Lampu Kilat"
                            : "Turn Flash Off"
                          : isIndonesian
                            ? "Nyalakan Lampu Kilat"
                            : "Turn Flash On"
                      }
                    >
                      <Flashlight size={11} strokeWidth={2} />
                      <span className="text-[10px] font-semibold tracking-wide">
                        {isTorchOn
                          ? isIndonesian
                            ? "Flash Nyala"
                            : "Flash On"
                          : "Flash"}
                      </span>
                    </button>
                  )}

                  {/* Corner brackets */}
                  <div className="absolute top-4 left-4 w-5 h-5 border-t border-l rounded-tl-lg pointer-events-none opacity-50 border-white z-10" />
                  <div className="absolute top-4 right-4 w-5 h-5 border-t border-r rounded-tr-lg pointer-events-none opacity-50 border-white z-10" />
                  <div className="absolute bottom-4 left-4 w-5 h-5 border-b border-l rounded-bl-lg pointer-events-none opacity-50 border-white z-10" />
                  <div className="absolute bottom-4 right-4 w-5 h-5 border-b border-r rounded-br-lg pointer-events-none opacity-50 border-white z-10" />

                  {/* Placeholder */}
                  {!isLiveCameraActive && (
                    <div className="flex flex-col items-center justify-center text-center px-6 pointer-events-none z-10">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5"
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.045))",
                          border: "1px solid rgba(255,255,255,0.16)",
                          boxShadow:
                            "inset 0 1px 0 rgba(255,255,255,0.20), 0 8px 20px rgba(0,0,0,0.22)",
                          color: "rgba(255,255,255,0.78)",
                        }}
                      >
                        <ScanLine size={20} strokeWidth={1.5} />
                      </div>

                      <p className="text-[13px] font-medium text-white/95">
                        {isIndonesian
                          ? "Posisikan struk dalam bingkai"
                          : "Align receipt within frame"}
                      </p>

                      <p className="text-[11px] font-normal mt-0.5 text-white/55">
                        {isIndonesian
                          ? "Struk fisik, QRIS & bukti transfer"
                          : "Physical receipts, QRIS & bank slips"}
                      </p>
                    </div>
                  )}
                </div>

                {/* ========================================================
                CAPTURE CONTROLS
                ======================================================== */}
                <div className="flex items-center justify-center gap-7 pt-2">
                  {/* Gallery */}
                  <div className="flex flex-col items-center gap-1.5 cursor-pointer group relative">
                    <div
                      className="w-13 h-13 rounded-full flex items-center justify-center transition-all group-active:scale-90 relative overflow-hidden"
                      style={{
                        background: isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.035))"
                          : "linear-gradient(180deg, #ffffff 0%, #f4f4f7 100%)",
                        border: isDark
                          ? "1px solid rgba(255,255,255,0.15)"
                          : "1px solid rgba(15,23,42,0.085)",
                        boxShadow: isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.20), 0 8px 20px rgba(0,0,0,0.35)"
                          : "inset 0 1px 0 rgba(255,255,255,1), 0 7px 18px rgba(15,23,42,0.11)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <ImageIcon size={19} strokeWidth={1.5} />

                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileInputChange}
                        onClick={(e) => {
                          triggerHaptic("light");
                          if (Capacitor.isNativePlatform()) {
                            e.preventDefault();
                            handlePickGalleryNative();
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        title={
                          isIndonesian
                            ? "Pilih dari Galeri"
                            : "Choose from Gallery"
                        }
                      />
                    </div>

                    <span
                      className="text-[11px] font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {isIndonesian ? "Galeri" : "Gallery"}
                    </span>
                  </div>

                  {/* Take photo */}
                  <div className="flex flex-col items-center gap-1.5 cursor-pointer group relative">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center transition-all group-active:scale-95 relative overflow-hidden"
                      style={{
                        background: isDark
                          ? "linear-gradient(180deg, #ffffff 0%, #e9e9ed 100%)"
                          : "linear-gradient(180deg, #202024 0%, #09090b 100%)",
                        color: isDark ? "#000000" : "#ffffff",
                        border: isDark
                          ? "1px solid rgba(255,255,255,0.95)"
                          : "1px solid rgba(0,0,0,0.82)",
                        boxShadow: isDark
                          ? "inset 0 1px 0 #ffffff, 0 5px 12px rgba(255,255,255,0.08), 0 14px 30px -6px rgba(0,0,0,0.55)"
                          : "inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 28px -7px rgba(15,23,42,0.40)",
                      }}
                    >
                      <Camera size={23} strokeWidth={1.75} />

                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileInputChange}
                        onClick={(e) => {
                          triggerHaptic("medium");

                          if (isLiveCameraActive) {
                            const snapped = captureLiveSnapshot();

                            if (snapped) {
                              e.preventDefault();
                              return;
                            }
                          }

                          if (Capacitor.isNativePlatform()) {
                            e.preventDefault();
                            handleTakePhotoNative();
                            return;
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        title={isIndonesian ? "Ambil Foto" : "Take Photo"}
                      />
                    </div>

                    <span
                      className="text-[11px] font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isIndonesian ? "Ambil Foto" : "Take Photo"}
                    </span>
                  </div>

                  {/* CSV */}
                  {onOpenImport && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        onOpenImport();
                      }}
                      className="flex flex-col items-center gap-1.5 cursor-pointer group"
                    >
                      <div
                        className="w-13 h-13 rounded-full flex items-center justify-center transition-all group-active:scale-90"
                        style={{
                          background: isDark
                            ? "linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.035))"
                            : "linear-gradient(180deg, #ffffff 0%, #f4f4f7 100%)",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.15)"
                            : "1px solid rgba(15,23,42,0.085)",
                          boxShadow: isDark
                            ? "inset 0 1px 0 rgba(255,255,255,0.20), 0 8px 20px rgba(0,0,0,0.35)"
                            : "inset 0 1px 0 rgba(255,255,255,1), 0 7px 18px rgba(15,23,42,0.11)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <FileSpreadsheet size={19} strokeWidth={1.5} />
                      </div>

                      <span
                        className="text-[11px] font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {isIndonesian ? "CSV / Mutasi" : "CSV / Statement"}
                      </span>
                    </button>
                  )}
                </div>

                {/* Permissions */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");

                    setPermissionPrompt({
                      isOpen: true,
                      type: "photos",
                      title: isIndonesian
                        ? "Izin Media & Kamera"
                        : "Media & Camera Permissions",
                      description: isIndonesian
                        ? "Accrual memerlukan izin untuk mengimpor struk dari galeri foto atau mengambil foto langsung dengan kamera Anda."
                        : "Accrual requires permission to import receipts from your photo gallery or take photos with your camera.",
                    });
                  }}
                  className="text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 pt-1 hover:opacity-80 active:scale-95"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <Shield size={12} strokeWidth={1.5} />
                  {isIndonesian ? "Izin & Akses" : "Permissions & Access"}
                </button>
              </div>
            )}

            {/* ============================================================
            STEP 2 — PROCESSING
            ============================================================ */}
            {step === "processing" && (
              <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-4 text-center">
                {imagePreview && (
                  <div
                    className="relative w-44 h-56 rounded-2xl overflow-hidden"
                    style={{
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.16)"
                        : "1px solid rgba(15,23,42,0.10)",
                      boxShadow: isDark
                        ? "0 16px 36px -8px rgba(0,0,0,0.65)"
                        : "0 16px 36px -10px rgba(15,23,42,0.20)",
                    }}
                  >
                    <img
                      src={imagePreview}
                      alt="Receipt scanning"
                      className="w-full h-full object-cover filter brightness-95 contrast-105"
                    />

                    <motion.div
                      animate={{ top: ["0%", "95%", "0%"] }}
                      transition={{
                        repeat: Infinity,
                        duration: 2.2,
                        ease: "easeInOut",
                      }}
                      className="absolute left-0 right-0 h-[2px] pointer-events-none z-10"
                      style={{
                        background: "var(--accent)",
                        boxShadow:
                          "0 0 10px var(--accent), 0 0 20px var(--accent)",
                      }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 pointer-events-none" />
                  </div>
                )}

                <div className="space-y-1.5 w-full max-w-[220px]">
                  <div className="flex items-center justify-between text-[11px] font-medium px-0.5">
                    <span style={{ color: "var(--text-secondary)" }}>
                      {progressStatus}
                    </span>

                    <span style={{ color: "var(--text-primary)" }}>
                      {progressPct}%
                    </span>
                  </div>

                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden"
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(15,23,42,0.08)",
                      boxShadow: isDark
                        ? "inset 0 1px 1px rgba(0,0,0,0.3)"
                        : "inset 0 1px 1px rgba(15,23,42,0.10)",
                    }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: "var(--accent)",
                        boxShadow: "0 0 8px var(--accent)",
                      }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================
            STEP 3 — RESULT
            ============================================================ */}
            {step === "result" && parsedSlip && (
              <div
                className="flex-1 min-h-0 overflow-y-auto space-y-3 pt-1 no-scrollbar"
                style={{
                  paddingBottom:
                    "max(calc(env(safe-area-inset-bottom, 0px) + 36px), 48px)",
                }}
              >
                {/* ========================================================
                STATUS CAPSULE
                ======================================================== */}
                {unregisteredWalletName ? (
                  <div
                    className="p-2.5 px-3 rounded-2xl flex items-center justify-between gap-2"
                    style={{
                      background: isDark
                        ? "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))"
                        : "linear-gradient(180deg, #ffffff 0%, #f7f7fa 100%)",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.12)"
                        : "1px solid rgba(15,23,42,0.075)",
                      boxShadow: isDark
                        ? "inset 0 1px 0 rgba(255,255,255,0.12)"
                        : "inset 0 1px 0 rgba(255,255,255,0.95), 0 5px 14px rgba(15,23,42,0.055)",
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles
                        size={14}
                        strokeWidth={1.5}
                        className="shrink-0"
                        style={{ color: "var(--text-secondary)" }}
                      />

                      <p
                        className="text-[11px] font-normal truncate"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {isIndonesian ? (
                          <>
                            Akun{" "}
                            <span
                              className="font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {unregisteredWalletName}
                            </span>{" "}
                            belum terdaftar
                          </>
                        ) : (
                          <>
                            Account{" "}
                            <span
                              className="font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {unregisteredWalletName}
                            </span>{" "}
                            is not registered
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={addWalletMutation.isPending}
                      onClick={handleQuickAddWallet}
                      className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      style={{
                        background: "var(--accent)",
                        color: "var(--accent-ink)",
                        boxShadow:
                          "0 3px 10px color-mix(in srgb, var(--accent) 25%, transparent)",
                      }}
                    >
                      {addWalletMutation.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} strokeWidth={2} />
                      )}

                      <span>{isIndonesian ? "Tambah Akun" : "Add Account"}</span>
                    </button>
                  </div>
                ) : unregisteredCategoryName ? (
                  <div
                    className="p-2.5 px-3 rounded-2xl flex items-center justify-between gap-2"
                    style={{
                      background: isDark
                        ? "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))"
                        : "linear-gradient(180deg, #ffffff 0%, #f7f7fa 100%)",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.12)"
                        : "1px solid rgba(15,23,42,0.075)",
                      boxShadow: isDark
                        ? "inset 0 1px 0 rgba(255,255,255,0.12)"
                        : "inset 0 1px 0 rgba(255,255,255,0.95), 0 5px 14px rgba(15,23,42,0.055)",
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles
                        size={14}
                        strokeWidth={1.5}
                        className="shrink-0"
                        style={{ color: "var(--text-secondary)" }}
                      />

                      <p
                        className="text-[11px] font-normal truncate"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {isIndonesian ? (
                          <>
                            Kategori{" "}
                            <span
                              className="font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {unregisteredCategoryName}
                            </span>{" "}
                            belum terdaftar
                          </>
                        ) : (
                          <>
                            Category{" "}
                            <span
                              className="font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {unregisteredCategoryName}
                            </span>{" "}
                            is not registered
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={addCategoryMutation.isPending}
                      onClick={handleQuickAddCategory}
                      className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      style={{
                        background: "var(--accent)",
                        color: "var(--accent-ink)",
                        boxShadow:
                          "0 3px 10px color-mix(in srgb, var(--accent) 25%, transparent)",
                      }}
                    >
                      {addCategoryMutation.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} strokeWidth={2} />
                      )}

                      <span>
                        {isIndonesian ? "Tambah Kategori" : "Add Category"}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div
                    className="py-1 px-3.5 rounded-full flex items-center justify-center gap-1.5 mx-auto w-fit"
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(246,246,250,0.85) 100%)",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.12)"
                        : "1px solid rgba(205,205,205,0.42)",
                      boxShadow: isDark
                        ? "inset 0 1px 0 rgba(255,255,255,0.08)"
                        : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 8px rgba(15,23,42,0.05)",
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.85)" : "rgba(24,24,27,0.85)",
                        boxShadow: isDark
                          ? "0 0 6px rgba(255,255,255,0.5)"
                          : "0 0 6px rgba(0,0,0,0.25)",
                      }}
                    />

                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {isIndonesian
                        ? "Struk terpindai • "
                        : "Receipt scanned • "}
                      {Math.round(parsedSlip.confidence * 100)}%{" "}
                      {isIndonesian ? "kecocokan" : "match"}
                    </span>
                  </div>
                )}

                {/* ========================================================
                HERO RECEIPT CARD (MILKY GLASS)
                ======================================================== */}
                <div
                  className="p-4.5 rounded-[26px] space-y-3.5"
                  style={{
                    background: isDark
                      ? "linear-gradient(165deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)"
                      : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.70) 100%)",
                    backdropFilter: "blur(20px) saturate(160%)",
                    WebkitBackdropFilter: "blur(20px) saturate(160%)",
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.12)"
                      : "1px solid rgba(205,205,205,0.38)",
                    boxShadow: isDark
                      ? "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.15), 0 16px 34px -10px rgba(0,0,0,0.62)"
                      : "inset 0 1px 0 rgba(255,255,255,1), 0 3px 12px rgba(15,23,42,0.145)",
                  }}
                >
                  {/* Merchant */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                          background: isDark
                            ? "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
                            : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,244,248,0.85) 100%)",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.14)"
                            : "1px solid rgba(205,205,205,0.40)",
                          boxShadow: isDark
                            ? "inset 0 1px 0 rgba(255,255,255,0.15), 0 3px 10px rgba(0,0,0,0.18)"
                            : "inset 0 1px 0 rgba(255,255,255,1), 0 3px 10px rgba(15,23,42,0.08)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {selectedCategory ? (
                          <IconRenderer
                            icon={selectedCategory.emoji}
                            size="w-5 h-5"
                          />
                        ) : (
                          <Tag
                            size={18}
                            strokeWidth={1.75}
                            style={{ color: "var(--text-secondary)" }}
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={merchant}
                          onChange={(e) => setMerchant(e.target.value)}
                          placeholder={
                            isIndonesian
                              ? "Merchant / Penerima"
                              : "Merchant / Recipient"
                          }
                          className="w-full text-[15.5px] font-bold bg-transparent outline-none truncate leading-tight p-0"
                          style={{
                            color: "var(--text-primary)",
                            fontFamily: "Urbanist, -apple-system, sans-serif",
                          }}
                        />

                        <p
                          className="text-[11.5px] font-medium mt-0.5 truncate"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {selectedCategory
                            ? selectedCategory.name
                            : isIndonesian
                              ? "Pilih kategori"
                              : "Select category"}
                        </p>
                      </div>
                    </div>

                    {/* Receipt thumbnail */}
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setInspectPhotoOpen(true);
                        }}
                        className="relative w-11 h-14 rounded-xl overflow-hidden shrink-0 group cursor-pointer active:scale-95 transition-all"
                        style={{
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.18)"
                            : "1px solid rgba(205,205,205,0.45)",
                          boxShadow: isDark
                            ? "0 5px 14px rgba(0,0,0,0.30)"
                            : "inset 0 1px 0 rgba(255,255,255,0.8), 0 3px 10px rgba(15,23,42,0.10)",
                        }}
                        title={
                          isIndonesian
                            ? "Ketuk untuk melihat struk asli"
                            : "Tap to inspect original receipt"
                        }
                        aria-label={
                          isIndonesian
                            ? "Ketuk untuk melihat struk asli"
                            : "Tap to inspect original receipt"
                        }
                      >
                        <img
                          src={imagePreview}
                          alt={isIndonesian ? "Struk Asli" : "Original Receipt"}
                          className="w-full h-full object-cover filter brightness-95 group-hover:scale-105 transition-transform duration-300"
                        />

                        <div className="absolute bottom-1 right-1 w-4.5 h-4.5 rounded-full bg-black/65 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <Eye
                            size={10}
                            className="text-white/90"
                            strokeWidth={2}
                          />
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Divider */}
                  <div
                    className="h-[1px] w-full"
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(205,205,205,0.35)",
                    }}
                  />

                  {/* Amount */}
                  <div className="py-1 flex flex-col items-center justify-center">
                    <span
                      className="text-[10px] font-bold tracking-widest uppercase mb-1 select-none"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian ? "Total Nominal" : "Total Amount"}
                    </span>

                    <div className="flex items-baseline justify-center gap-1.5">
                      <span
                        className="text-[19px] font-semibold select-none"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {currencyMeta.symbol}
                      </span>

                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={
                          amount
                            ? amount.toLocaleString(isIndonesian ? "id-ID" : "en-US")
                            : ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setAmount(raw ? Number(raw) : 0);
                        }}
                        placeholder="0"
                        className="text-[34px] font-bold text-center bg-transparent outline-none tracking-tight p-0"
                        style={{
                          color: "var(--text-primary)",
                          fontFamily: "Urbanist, -apple-system, sans-serif",
                          width: `${
                            Math.max(
                              2,
                              (amount
                                ? amount.toLocaleString(
                                    isIndonesian ? "id-ID" : "en-US",
                                  )
                                : "0"
                              ).length,
                            ) *
                              20 +
                            16
                          }px`,
                          maxWidth: "250px",
                        }}
                      />
                    </div>

                    {/* Admin Fee Chip Toggle */}
                    {adminFeeAmount > 0 && (
                      <div
                        onClick={() => {
                          triggerHaptic("light");
                          setIncludeAdminFee(!includeAdminFee);
                        }}
                        className="mt-2.5 w-full p-2.5 px-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.98]"
                        style={{
                          background: includeAdminFee
                            ? isDark
                              ? "rgba(255,255,255,0.065)"
                              : "rgba(15,23,42,0.04)"
                            : isDark
                              ? "rgba(255,255,255,0.02)"
                              : "rgba(15,23,42,0.02)",
                          border: includeAdminFee
                            ? isDark
                              ? "1px solid rgba(255,255,255,0.15)"
                              : "1px solid rgba(15,23,42,0.12)"
                            : isDark
                              ? "1px solid rgba(255,255,255,0.06)"
                              : "1px solid rgba(15,23,42,0.05)",
                          boxShadow: includeAdminFee
                            ? isDark
                              ? "inset 0 1px 0 rgba(255,255,255,0.08)"
                              : "0 2px 8px rgba(15,23,42,0.04)"
                            : "none",
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                            style={{
                              background: includeAdminFee
                                ? isDark
                                  ? "rgba(255,255,255,0.18)"
                                  : "rgba(15,23,42,0.85)"
                                : isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(15,23,42,0.08)",
                              color: includeAdminFee
                                ? "#ffffff"
                                : "transparent",
                            }}
                          >
                            <Check size={12} strokeWidth={2.5} />
                          </div>

                          <div className="min-w-0 text-left">
                            <p
                              className="text-[12px] font-semibold truncate leading-tight"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {isIndonesian
                                ? `Catat Biaya Admin (+${formatCurrency(adminFeeAmount, preferredCurrency)})`
                                : `Record Admin Fee (+${formatCurrency(adminFeeAmount, preferredCurrency)})`}
                            </p>
                            <p
                              className="text-[10px] font-normal truncate mt-0.5"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {isIndonesian
                                ? "Otomatis dicatat sebagai pengeluaran terpisah"
                                : "Auto-recorded as separate expense"}
                            </p>
                          </div>
                        </div>

                        <span
                          className="text-[11px] font-mono font-semibold shrink-0"
                          style={{
                            color: includeAdminFee
                              ? "var(--text-primary)"
                              : "var(--text-tertiary)",
                          }}
                        >
                          +{formatCurrency(adminFeeAmount, preferredCurrency)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ========================================================
                TYPE SEGMENTED CONTROL (MILKY GLASS)
                ======================================================== */}
                <div
                  className="p-1 rounded-2xl flex items-center gap-1"
                  style={{
                    background: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(245,245,248,0.70) 100%)",
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid rgba(205,205,205,0.38)",
                    boxShadow: isDark
                      ? "inset 0 1px 0 rgba(255,255,255,0.07)"
                      : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 8px rgba(15,23,42,0.04)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                  }}
                >
                  {[
                    {
                      id: "expense",
                      label: isIndonesian ? "Pengeluaran" : "Expense",
                    },
                    {
                      id: "income",
                      label: isIndonesian ? "Pemasukan" : "Income",
                    },
                    {
                      id: "transfer",
                      label: "Transfer",
                    },
                  ].map((item) => {
                    const active = type === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          handleSetType(
                            item.id as "expense" | "income" | "transfer",
                          )
                        }
                        className="flex-1 py-1.5 rounded-xl text-[12px] font-semibold transition-all text-center cursor-pointer active:scale-[0.98]"
                        style={{
                          background: active
                            ? isDark
                              ? "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.09))"
                              : "linear-gradient(180deg, #ffffff 0%, #fcfcfe 100%)"
                            : "transparent",
                          color: active
                            ? isDark
                              ? "#ffffff"
                              : "var(--text-primary)"
                            : "var(--text-tertiary)",
                          border: active
                            ? isDark
                              ? "1px solid rgba(255,255,255,0.18)"
                              : "1px solid rgba(205,205,205,0.48)"
                            : "1px solid transparent",
                          boxShadow: active
                            ? isDark
                              ? "inset 0 1px 0 rgba(255,255,255,0.15), 0 3px 10px rgba(0,0,0,0.16)"
                              : "inset 0 1px 0 rgba(255,255,255,1), 0 3px 10px rgba(15,23,42,0.08)"
                            : "none",
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* ========================================================
                DETAILS VESSEL
                ======================================================== */}
                <div
                  className="rounded-[24px] overflow-hidden"
                  style={{
                    background: isDark
                      ? "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)"
                      : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.70) 100%)",
                    backdropFilter: "blur(20px) saturate(160%)",
                    WebkitBackdropFilter: "blur(20px) saturate(160%)",
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.10)"
                      : "1px solid rgba(205,205,205,0.38)",
                    boxShadow: isDark
                      ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 10px rgba(0,0,0,0.12)"
                      : "inset 0 1px 0 rgba(255,255,255,1), 0 3px 12px rgba(15,23,42,0.145)",
                  }}
                >
                  {/* Transfer */}
                  {type === "transfer" ? (
                    <>
                      {/* From */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setWalletSheetOpen(true);
                        }}
                        className="w-full px-3.5 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] hover:bg-black/[0.015] dark:hover:bg-white/[0.025] transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: isDark
                                ? "rgba(255,255,255,0.06)"
                                : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,240,245,0.75) 100%)",
                              border: isDark
                                ? "1px solid rgba(255,255,255,0.10)"
                                : "1px solid rgba(205,205,205,0.38)",
                              boxShadow: isDark
                                ? "inset 0 1px 0 rgba(255,255,255,0.1)"
                                : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,0.04)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <CreditCard size={15} strokeWidth={1.75} />
                          </div>

                          <span
                            className="text-[12.5px] font-semibold"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {isIndonesian ? "Dari Akun" : "From Account"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0 max-w-[65%] justify-end">
                          <span
                            className="text-[12.5px] font-bold truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {selectedWallet
                              ? selectedWallet.name
                              : isIndonesian
                                ? "Pilih Akun"
                                : "Select Account"}
                          </span>

                          <ChevronRight
                            size={14}
                            strokeWidth={2}
                            className="shrink-0"
                            style={{ color: "var(--text-tertiary)" }}
                          />
                        </div>
                      </button>

                      {/* To */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setToWalletSheetOpen(true);
                        }}
                        className="w-full px-3.5 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] hover:bg-black/[0.015] dark:hover:bg-white/[0.025] transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: isDark
                                ? "rgba(255,255,255,0.06)"
                                : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,240,245,0.75) 100%)",
                              border: isDark
                                ? "1px solid rgba(255,255,255,0.10)"
                                : "1px solid rgba(205,205,205,0.38)",
                              boxShadow: isDark
                                ? "inset 0 1px 0 rgba(255,255,255,0.1)"
                                : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,0.04)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <ArrowRightLeft size={15} strokeWidth={1.75} />
                          </div>

                          <span
                            className="text-[12.5px] font-semibold"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {isIndonesian ? "Ke Akun" : "To Account"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0 max-w-[65%] justify-end">
                          <span
                            className="text-[12.5px] font-bold truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {selectedToWallet
                              ? selectedToWallet.name
                              : isIndonesian
                                ? "Pilih Akun Tujuan"
                                : "Select Destination Account"}
                          </span>

                          <ChevronRight
                            size={14}
                            strokeWidth={2}
                            className="shrink-0"
                            style={{ color: "var(--text-tertiary)" }}
                          />
                        </div>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Category */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setCategorySheetOpen(true);
                        }}
                        className="w-full px-3.5 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] hover:bg-black/[0.015] dark:hover:bg-white/[0.025] transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: isDark
                                ? "rgba(255,255,255,0.06)"
                                : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,240,245,0.75) 100%)",
                              border: isDark
                                ? "1px solid rgba(255,255,255,0.10)"
                                : "1px solid rgba(205,205,205,0.38)",
                              boxShadow: isDark
                                ? "inset 0 1px 0 rgba(255,255,255,0.1)"
                                : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,0.04)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <Tag size={15} strokeWidth={1.75} />
                          </div>

                          <span
                            className="text-[12.5px] font-semibold"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {isIndonesian ? "Kategori" : "Category"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0 max-w-[65%] justify-end">
                          <span
                            className="text-[12.5px] font-bold truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {selectedCategory
                              ? selectedCategory.name
                              : isIndonesian
                                ? "Pilih Kategori"
                                : "Select Category"}
                          </span>

                          <ChevronRight
                            size={14}
                            strokeWidth={2}
                            className="shrink-0"
                            style={{ color: "var(--text-tertiary)" }}
                          />
                        </div>
                      </button>

                      {/* Wallet */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setWalletSheetOpen(true);
                        }}
                        className="w-full px-3.5 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] hover:bg-black/[0.015] dark:hover:bg-white/[0.025] transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: isDark
                                ? "rgba(255,255,255,0.06)"
                                : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,240,245,0.75) 100%)",
                              border: isDark
                                ? "1px solid rgba(255,255,255,0.10)"
                                : "1px solid rgba(205,205,205,0.38)",
                              boxShadow: isDark
                                ? "inset 0 1px 0 rgba(255,255,255,0.1)"
                                : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,0.04)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <CreditCard size={15} strokeWidth={1.75} />
                          </div>

                          <span
                            className="text-[12.5px] font-semibold"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {isIndonesian ? "Akun" : "Account"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0 max-w-[65%] justify-end">
                          <span
                            className="text-[12.5px] font-bold truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {selectedWallet
                              ? selectedWallet.name
                              : isIndonesian
                                ? "Pilih Akun"
                                : "Select Account"}
                          </span>

                          <ChevronRight
                            size={14}
                            strokeWidth={2}
                            className="shrink-0"
                            style={{ color: "var(--text-tertiary)" }}
                          />
                        </div>
                      </button>
                    </>
                  )}

                  {/* Date & Time */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setDateTimePickerOpen(true);
                    }}
                    className="w-full px-3.5 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] hover:bg-black/[0.015] dark:hover:bg-white/[0.025] transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,240,245,0.75) 100%)",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.10)"
                            : "1px solid rgba(205,205,205,0.38)",
                          boxShadow: isDark
                            ? "inset 0 1px 0 rgba(255,255,255,0.1)"
                            : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,0.04)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Calendar size={15} strokeWidth={1.75} />
                      </div>

                      <span
                        className="text-[12.5px] font-semibold"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {isIndonesian ? "Tanggal & Waktu" : "Date & Time"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[12.5px] font-bold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {format(combinedDateTime, "d MMM yyyy, HH:mm")}
                      </span>

                      <ChevronRight
                        size={14}
                        strokeWidth={2}
                        className="shrink-0"
                        style={{ color: "var(--text-tertiary)" }}
                      />
                    </div>
                  </button>

                  {/* Note */}
                  <div className="w-full px-3.5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,240,245,0.75) 100%)",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.10)"
                            : "1px solid rgba(205,205,205,0.38)",
                          boxShadow: isDark
                            ? "inset 0 1px 0 rgba(255,255,255,0.1)"
                            : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,0.04)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Pen size={15} strokeWidth={1.75} />
                      </div>

                      <span
                        className="text-[12.5px] font-semibold"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {isIndonesian ? "Catatan" : "Notes"}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={
                        isIndonesian
                          ? "Tambah catatan (opsional)"
                          : "Add a note (optional)"
                      }
                      className="text-[12px] placeholder:text-[12px] font-medium bg-transparent outline-none text-right flex-1 pl-4"
                      style={{
                        color: "var(--text-primary)",
                        fontFamily: "Urbanist, -apple-system, sans-serif",
                      }}
                    />
                  </div>
                </div>

                {/* ========================================================
                ACTIONS
                ======================================================== */}
                <div className="pt-2.5 pb-6 space-y-2">
                  {/* Primary */}
                  <button
                    type="button"
                    disabled={addTx.isPending}
                    onTouchStart={(e) => {
                      // 1. Prevent default immediately suppresses iOS native text selection, magnifying glass, and Paste callout
                      e.preventDefault();
                      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                      }
                      const touch = e.touches[0];
                      if (touch) {
                        touchStartPos.current = { x: touch.clientX, y: touch.clientY };
                      }
                    }}
                    onTouchEnd={(e) => {
                      const touch = e.changedTouches[0];
                      if (touch) {
                        const dx = Math.abs(touch.clientX - touchStartPos.current.x);
                        const dy = Math.abs(touch.clientY - touchStartPos.current.y);
                        // Clean tap (< 14px movement) triggers immediate save
                        if (dx < 14 && dy < 14) {
                          e.preventDefault();
                          touchHandledRef.current = true;
                          setTimeout(() => {
                            touchHandledRef.current = false;
                          }, 600);
                          executeSave();
                        }
                      }
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // If touch already handled save on mobile device, ignore duplicate synthetic click
                      if (touchHandledRef.current) return;
                      executeSave();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="w-full h-12 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 select-none"
                    style={{
                      background: isDark
                        ? "linear-gradient(180deg,#ffffff 0%,#e7e7eb 100%)"
                        : "linear-gradient(180deg,#1d1d20 0%,#08080a 100%)",
                      color: isDark ? "#000000" : "#ffffff",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.92)"
                        : "1px solid rgba(0,0,0,0.85)",
                      boxShadow: isDark
                        ? "inset 0 1px 0 #ffffff, inset 0 -1px 0 rgba(0,0,0,0.08), 0 5px 14px rgba(255,255,255,0.06), 0 14px 30px -8px rgba(0,0,0,0.60)"
                        : "inset 0 1px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(0,0,0,0.18), 0 12px 28px -8px rgba(15,23,42,0.38)",
                      letterSpacing: "-0.01em",
                      touchAction: "manipulation",
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                    }}
                  >
                    {addTx.isPending ? (
                      <Loader2
                        size={16}
                        className="animate-spin pointer-events-none select-none"
                        style={{
                          color: isDark ? "#000000" : "#ffffff",
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center gap-2 select-none pointer-events-none">
                        <Check
                          size={16}
                          strokeWidth={2.25}
                          style={{
                            color: isDark ? "#000000" : "#ffffff",
                          }}
                        />

                        <span
                          className="font-semibold select-none pointer-events-none"
                          style={{
                            color: isDark ? "#000000" : "#ffffff",
                          }}
                        >
                          {isIndonesian ? "Simpan Transaksi" : "Save Transaction"}{" "}
                          {amount > 0 ? `(${formatCurrency(amount, preferredCurrency)})` : ""}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Secondary */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenInFullForm}
                      className="flex-1 h-10 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      style={{
                        background: isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.035))"
                          : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(245,245,250,0.80) 100%)",
                        border: isDark
                          ? "1px solid rgba(255,255,255,0.12)"
                          : "1px solid rgba(205,205,205,0.38)",
                        color: "var(--text-primary)",
                        boxShadow: isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.15)"
                          : "inset 0 1px 0 rgba(255,255,255,1), 0 3px 10px rgba(15,23,42,0.08)",
                      }}
                    >
                      <SlidersHorizontal size={13} strokeWidth={1.75} />
                      <span>{isIndonesian ? "Kustomisasi Formulir" : "Customize Form"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setStep("idle");
                        setImagePreview(null);
                        setParsedSlip(null);
                      }}
                      className="flex-1 h-10 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      style={{
                        background: isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.035))"
                          : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(245,245,250,0.80) 100%)",
                        border: isDark
                          ? "1px solid rgba(255,255,255,0.12)"
                          : "1px solid rgba(205,205,205,0.38)",
                        color: "var(--text-primary)",
                        boxShadow: isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.15)"
                          : "inset 0 1px 0 rgba(255,255,255,1), 0 3px 10px rgba(15,23,42,0.08)",
                      }}
                    >
                      <RotateCcw size={13} strokeWidth={1.75} />
                      <span>{isIndonesian ? "Pindai Ulang" : "Scan Again"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </AnimatePresence>

      {/* ================================================================
      INSPECT ORIGINAL RECEIPT
      ================================================================ */}
      <AnimatePresence>
        {inspectPhotoOpen && imagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
            onClick={() => setInspectPhotoOpen(false)}
          >
            <div className="relative max-w-sm max-h-[85vh] w-full flex flex-col items-center">
              <button
                type="button"
                onClick={() => setInspectPhotoOpen(false)}
                className="absolute -top-12 right-0 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 active:scale-95 transition-all"
                title={isIndonesian ? "Tutup" : "Close"}
                aria-label={isIndonesian ? "Tutup" : "Close"}
              >
                <X size={16} strokeWidth={2} />
              </button>

              <img
                src={imagePreview}
                alt={isIndonesian ? "Struk Asli" : "Original Receipt"}
                className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/15"
              />

              <p className="text-[12px] font-normal text-white/60 mt-3">
                {isIndonesian
                  ? "Ketuk di mana saja untuk menutup"
                  : "Tap anywhere to close"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================
      CATEGORY BOTTOM SHEET — APPLE LIQUID GLASS / 3-COLUMN PILLS
      ================================================================ */}
      <BottomSheet
        isOpen={categorySheetOpen}
        onClose={() => {
          setCategorySheetOpen(false);
          setSearchCatQuery("");
        }}
        title={isIndonesian ? "Pilih Kategori" : "Select Category"}
      >
        <div
          className="px-4 pt-1"
          style={{
            fontFamily: "Urbanist, -apple-system, sans-serif",
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
          }}
        >
          {/* Search */}
          <div className="relative mb-4">
            <Search
              size={15}
              strokeWidth={1.8}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-tertiary)" }}
            />

            <input
              type="text"
              value={searchCatQuery}
              onChange={(e) => setSearchCatQuery(e.target.value)}
              placeholder={
                isIndonesian ? "Cari kategori..." : "Search category..."
              }
              className="w-full h-11 pl-10 pr-9 rounded-[14px] text-[12px] font-medium outline-none"
              style={{
                background: isDark
                  ? "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.035))"
                  : "linear-gradient(180deg, #ffffff 0%, #f6f6f9 100%)",
                border: isDark
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.075)",
                color: "var(--text-primary)",
                fontFamily: "Urbanist, sans-serif",
                boxShadow: isDark
                  ? "inset 0 1px 0 rgba(255,255,255,0.10)"
                  : "inset 0 1px 0 rgba(255,255,255,1), 0 5px 14px rgba(15,23,42,0.055)",
              }}
            />

            {searchCatQuery && (
              <button
                type="button"
                onClick={() => setSearchCatQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(15,23,42,0.055)",
                  color: "var(--text-tertiary)",
                }}
                title={isIndonesian ? "Hapus pencarian" : "Clear search"}
                aria-label={isIndonesian ? "Hapus pencarian" : "Clear search"}
              >
                <X size={12} strokeWidth={2} />
              </button>
            )}
          </div>

          {filteredCategories.length === 0 ? (
            <div className="py-10 text-center">
              <div
                className="mx-auto mb-2.5 w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(15,23,42,0.045)",
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(15,23,42,0.06)",
                  color: "var(--text-tertiary)",
                }}
              >
                <Search size={16} strokeWidth={1.5} />
              </div>

              <p
                className="text-[12px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? `Kategori "${searchCatQuery}" tidak ditemukan`
                  : `No categories found for "${searchCatQuery}"`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-2.5 pr-0.5 pb-6">
              {filteredCategories.map((cat) => {
                const isSelected = categoryId === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setCategoryId(cat.id);
                      setCategorySheetOpen(false);
                      setSearchCatQuery("");
                    }}
                    className="relative min-w-0 w-full h-11 px-2.5 rounded-full flex items-center justify-start gap-1.5 cursor-pointer select-none transition-all duration-150 active:scale-[0.96]"
                    style={{
                      background: isSelected
                        ? isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.09))"
                          : "linear-gradient(180deg, #ffffff 0%, #f0f0f4 100%)"
                        : isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))"
                          : "linear-gradient(180deg, #ffffff 0%, #f5f5f8 100%)",
                      color: isSelected
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                      border: isSelected
                        ? isDark
                          ? "1px solid rgba(255,255,255,0.25)"
                          : "1px solid rgba(15,23,42,0.12)"
                        : isDark
                          ? "1px solid rgba(255,255,255,0.085)"
                          : "1px solid rgba(15,23,42,0.065)",
                      boxShadow: isSelected
                        ? isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.20), 0 5px 14px rgba(0,0,0,0.22)"
                          : "inset 0 1px 0 rgba(255,255,255,1), 0 5px 14px rgba(15,23,42,0.10)"
                        : isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.07)"
                          : "inset 0 1px 0 rgba(255,255,255,0.95), 0 3px 9px rgba(15,23,42,0.045)",
                    }}
                  >
                    {/* Icon */}
                    <span
                      className="w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: isSelected
                          ? isDark
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(15,23,42,0.065)"
                          : isDark
                            ? "rgba(255,255,255,0.055)"
                            : "rgba(15,23,42,0.045)",
                        border: isSelected
                          ? isDark
                            ? "1px solid rgba(255,255,255,0.13)"
                            : "1px solid rgba(15,23,42,0.06)"
                          : isDark
                            ? "1px solid rgba(255,255,255,0.075)"
                            : "1px solid rgba(15,23,42,0.05)",
                        boxShadow: isSelected
                          ? "inset 0 1px 0 rgba(255,255,255,0.10)"
                          : "none",
                      }}
                    >
                      <IconRenderer icon={cat.emoji} size="w-[15px] h-[15px]" />
                    </span>

                    {/* Name */}
                    <span className="min-w-0 text-[10.5px] leading-none font-semibold tracking-[-0.012em] whitespace-nowrap truncate">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* ================================================================
      WALLET BOTTOM SHEET — APPLE LIQUID GLASS / 3-COLUMN PILLS
      ================================================================ */}
      <BottomSheet
        isOpen={walletSheetOpen}
        onClose={() => {
          setWalletSheetOpen(false);
          setSearchWalletQuery("");
        }}
        title={isIndonesian ? "Pilih Akun" : "Select Account"}
      >
        <div
          className="px-4 pt-1"
          style={{
            fontFamily: "Urbanist, -apple-system, sans-serif",
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
          }}
        >
          {/* Search */}
          <div className="relative mb-4">
            <Search
              size={15}
              strokeWidth={1.8}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-tertiary)" }}
            />

            <input
              type="text"
              value={searchWalletQuery}
              onChange={(e) => setSearchWalletQuery(e.target.value)}
              placeholder={
                isIndonesian ? "Cari akun..." : "Search account..."
              }
              className="w-full h-11 pl-10 pr-9 rounded-[14px] text-[12px] font-medium outline-none"
              style={{
                background: isDark
                  ? "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.035))"
                  : "linear-gradient(180deg, #ffffff 0%, #f6f6f9 100%)",
                border: isDark
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.075)",
                color: "var(--text-primary)",
                fontFamily: "Urbanist, sans-serif",
                boxShadow: isDark
                  ? "inset 0 1px 0 rgba(255,255,255,0.10)"
                  : "inset 0 1px 0 rgba(255,255,255,1), 0 5px 14px rgba(15,23,42,0.055)",
              }}
            />

            {searchWalletQuery && (
              <button
                type="button"
                onClick={() => setSearchWalletQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(15,23,42,0.055)",
                  color: "var(--text-tertiary)",
                }}
                title={isIndonesian ? "Hapus pencarian" : "Clear search"}
                aria-label={isIndonesian ? "Hapus pencarian" : "Clear search"}
              >
                <X size={12} strokeWidth={2} />
              </button>
            )}
          </div>

          {filteredWallets.length === 0 ? (
            <div className="py-10 text-center">
              <div
                className="mx-auto mb-2.5 w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(15,23,42,0.045)",
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(15,23,42,0.06)",
                  color: "var(--text-tertiary)",
                }}
              >
                <CreditCard size={16} strokeWidth={1.5} />
              </div>

              <p
                className="text-[12px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? `Akun "${searchWalletQuery}" tidak ditemukan`
                  : `No accounts found for "${searchWalletQuery}"`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-2.5 pr-0.5 pb-6">
              {filteredWallets.map((w) => {
                const isSelected = walletId === w.id;

                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setWalletId(w.id);
                      setWalletSheetOpen(false);
                      setSearchWalletQuery("");
                    }}
                    className="relative min-w-0 w-full h-11 px-2.5 rounded-full flex items-center justify-start gap-1.5 cursor-pointer select-none transition-all duration-150 active:scale-[0.96]"
                    style={{
                      background: isSelected
                        ? isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.09))"
                          : "linear-gradient(180deg, #ffffff 0%, #f0f0f4 100%)"
                        : isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))"
                          : "linear-gradient(180deg, #ffffff 0%, #f5f5f8 100%)",
                      color: isSelected
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                      border: isSelected
                        ? isDark
                          ? "1px solid rgba(255,255,255,0.25)"
                          : "1px solid rgba(15,23,42,0.12)"
                        : isDark
                          ? "1px solid rgba(255,255,255,0.085)"
                          : "1px solid rgba(15,23,42,0.065)",
                      boxShadow: isSelected
                        ? isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.20), 0 5px 14px rgba(0,0,0,0.22)"
                          : "inset 0 1px 0 rgba(255,255,255,1), 0 5px 14px rgba(15,23,42,0.10)"
                        : isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.07)"
                          : "inset 0 1px 0 rgba(255,255,255,0.95), 0 3px 9px rgba(15,23,42,0.045)",
                    }}
                  >
                    {/* Account Icon */}
                    <span
                      className="w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: isSelected
                          ? isDark
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(15,23,42,0.065)"
                          : isDark
                            ? "rgba(255,255,255,0.055)"
                            : "rgba(15,23,42,0.045)",
                        border: isSelected
                          ? isDark
                            ? "1px solid rgba(255,255,255,0.13)"
                            : "1px solid rgba(15,23,42,0.06)"
                          : isDark
                            ? "1px solid rgba(255,255,255,0.075)"
                            : "1px solid rgba(15,23,42,0.05)",
                      }}
                    >
                      <IconRenderer icon={w.icon} size="w-[15px] h-[15px]" />
                    </span>

                    {/* Account Name */}
                    <span className="min-w-0 text-[10.5px] leading-none font-semibold tracking-[-0.012em] whitespace-nowrap truncate">
                      {w.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* ================================================================
      TO WALLET BOTTOM SHEET — APPLE LIQUID GLASS / 3-COLUMN PILLS
      ================================================================ */}
      <BottomSheet
        isOpen={toWalletSheetOpen}
        onClose={() => {
          setToWalletSheetOpen(false);
          setSearchToWalletQuery("");
        }}
        title={
          isIndonesian ? "Pilih Akun Tujuan" : "Select Destination Account"
        }
      >
        <div
          className="px-4 pt-1"
          style={{
            fontFamily: "Urbanist, -apple-system, sans-serif",
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
          }}
        >
          {/* Search */}
          <div className="relative mb-4">
            <Search
              size={15}
              strokeWidth={1.8}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-tertiary)" }}
            />

            <input
              type="text"
              value={searchToWalletQuery}
              onChange={(e) => setSearchToWalletQuery(e.target.value)}
              placeholder={
                isIndonesian ? "Cari akun..." : "Search account..."
              }
              className="w-full h-11 pl-10 pr-9 rounded-[14px] text-[12px] font-medium outline-none"
              style={{
                background: isDark
                  ? "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.035))"
                  : "linear-gradient(180deg, #ffffff 0%, #f6f6f9 100%)",
                border: isDark
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.075)",
                color: "var(--text-primary)",
                fontFamily: "Urbanist, sans-serif",
                boxShadow: isDark
                  ? "inset 0 1px 0 rgba(255,255,255,0.10)"
                  : "inset 0 1px 0 rgba(255,255,255,1), 0 5px 14px rgba(15,23,42,0.055)",
              }}
            />

            {searchToWalletQuery && (
              <button
                type="button"
                onClick={() => setSearchToWalletQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(15,23,42,0.055)",
                  color: "var(--text-tertiary)",
                }}
                title={isIndonesian ? "Hapus pencarian" : "Clear search"}
                aria-label={isIndonesian ? "Hapus pencarian" : "Clear search"}
              >
                <X size={12} strokeWidth={2} />
              </button>
            )}
          </div>

          {filteredToWallets.length === 0 ? (
            <div className="py-10 text-center">
              <div
                className="mx-auto mb-2.5 w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(15,23,42,0.045)",
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(15,23,42,0.06)",
                  color: "var(--text-tertiary)",
                }}
              >
                <ArrowRightLeft size={16} strokeWidth={1.5} />
              </div>

              <p
                className="text-[12px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Akun tidak ditemukan" : "No accounts found"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-2.5 pr-0.5 pb-6">
              {filteredToWallets.map((w) => {
                const isSelected = toWalletId === w.id;
                const isSource = walletId === w.id;

                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={isSource}
                    onClick={() => {
                      triggerHaptic("light");
                      setToWalletId(w.id);
                      setToWalletSheetOpen(false);
                      setSearchToWalletQuery("");
                    }}
                    className={`relative min-w-0 w-full h-11 px-2.5 rounded-full flex items-center justify-start gap-1.5 select-none transition-all duration-150 ${
                      isSource
                        ? "opacity-35 cursor-not-allowed"
                        : "cursor-pointer active:scale-[0.96]"
                    }`}
                    style={{
                      background: isSelected
                        ? isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.09))"
                          : "linear-gradient(180deg, #ffffff 0%, #f0f0f4 100%)"
                        : isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))"
                          : "linear-gradient(180deg, #ffffff 0%, #f5f5f8 100%)",
                      color: isSelected
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                      border: isSelected
                        ? isDark
                          ? "1px solid rgba(255,255,255,0.25)"
                          : "1px solid rgba(15,23,42,0.12)"
                        : isDark
                          ? "1px solid rgba(255,255,255,0.085)"
                          : "1px solid rgba(15,23,42,0.065)",
                      boxShadow: isSelected
                        ? isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.20), 0 5px 14px rgba(0,0,0,0.22)"
                          : "inset 0 1px 0 rgba(255,255,255,1), 0 5px 14px rgba(15,23,42,0.10)"
                        : isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.07)"
                          : "inset 0 1px 0 rgba(255,255,255,0.95), 0 3px 9px rgba(15,23,42,0.045)",
                    }}
                  >
                    {/* Account Icon */}
                    <span
                      className="w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: isSelected
                          ? isDark
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(15,23,42,0.065)"
                          : isDark
                            ? "rgba(255,255,255,0.055)"
                            : "rgba(15,23,42,0.045)",
                        border: isSelected
                          ? isDark
                            ? "1px solid rgba(255,255,255,0.13)"
                            : "1px solid rgba(15,23,42,0.06)"
                          : isDark
                            ? "1px solid rgba(255,255,255,0.075)"
                            : "1px solid rgba(15,23,42,0.05)",
                      }}
                    >
                      <IconRenderer icon={w.icon} size="w-[15px] h-[15px]" />
                    </span>

                    {/* Account Name */}
                    <span className="min-w-0 text-[10.5px] leading-none font-semibold tracking-[-0.012em] whitespace-nowrap truncate">
                      {w.name}
                    </span>

                    {isSource && (
                      <span
                        className="absolute -top-1 right-2 px-1.5 py-0.5 rounded-full text-[7px] font-semibold"
                        style={{
                          background: isDark
                            ? "rgba(255,255,255,0.10)"
                            : "rgba(15,23,42,0.07)",
                          color: "var(--text-tertiary)",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "1px solid rgba(15,23,42,0.05)",
                        }}
                      >
                        {isIndonesian ? "SUMBER" : "SOURCE"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* ================================================================
      DATE / TIME
      ================================================================ */}
      <GlassDateTimePickerModal
        isOpen={dateTimePickerOpen}
        onClose={() => setDateTimePickerOpen(false)}
        value={combinedDateTime}
        onChange={(newDate) => {
          setDate(newDate);
          setTime(format(newDate, "HH:mm"));
        }}
      />

      {/* ================================================================
      MEDIA PERMISSION
      ================================================================ */}
      <BottomSheet
        isOpen={permissionPrompt.isOpen}
        onClose={() =>
          setPermissionPrompt((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
        title={permissionPrompt.title}
      >
        <div
          className="p-4 space-y-4"
          style={{
            fontFamily: "Urbanist, -apple-system, sans-serif",
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
          }}
        >
          {/* Permission header */}
          <div
            className="flex items-center gap-3.5 p-3.5 rounded-2xl"
            style={{
              background: isDark
                ? "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))"
                : "linear-gradient(180deg, #ffffff 0%, #f7f7fa 100%)",
              border: isDark
                ? "1px solid rgba(255,255,255,0.10)"
                : "1px solid rgba(15,23,42,0.075)",
              boxShadow: isDark
                ? "inset 0 1px 0 rgba(255,255,255,0.10)"
                : "inset 0 1px 0 rgba(255,255,255,1), 0 5px 16px rgba(15,23,42,0.065)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isDark
                  ? "rgba(255,255,255,0.055)"
                  : "rgba(15,23,42,0.045)",
                border: isDark
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid rgba(15,23,42,0.06)",
                color: "var(--text-primary)",
                boxShadow: isDark
                  ? "inset 0 1px 0 rgba(255,255,255,0.10)"
                  : "inset 0 1px 0 rgba(255,255,255,0.95)",
              }}
            >
              {permissionPrompt.type === "camera" ? (
                <Camera size={20} strokeWidth={1.5} />
              ) : (
                <ImageIcon size={20} strokeWidth={1.5} />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                {permissionPrompt.type === "camera"
                  ? isIndonesian
                    ? "Perangkat Kamera"
                    : "Camera Hardware"
                  : isIndonesian
                    ? "Galeri Foto"
                    : "Photo Library"}
              </p>

              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
                {permissionPrompt.description}
              </p>
            </div>
          </div>

          {/* Privacy info */}
          <div
            className="p-3 rounded-2xl border"
            style={{
              background: isDark
                ? "rgba(255,255,255,0.025)"
                : "rgba(15,23,42,0.025)",
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(15,23,42,0.065)",
              boxShadow: isDark
                ? "inset 0 1px 0 rgba(255,255,255,0.05)"
                : "inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian
                ? "Accrual memproses semua struk keuangan dan bukti transfer 100% pada perangkat menggunakan pengenalan karakter optik lokal. Foto pribadi Anda tidak pernah meninggalkan perangkat."
                : "Accrual processes all financial receipts and bank slips 100% on-device using local optical character recognition. Your private captures never leave your phone."}
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={async () => {
                triggerHaptic("medium");

                if (permissionPrompt.type === "photos") {
                  const granted = await requestPhotosPermission();

                  setPermissionPrompt((prev) => ({
                    ...prev,
                    isOpen: false,
                  }));

                  if (granted) {
                    showToast(
                      isIndonesian
                        ? "Akses galeri foto diberikan"
                        : "Photo library access granted",
                      "add",
                      () => {},
                    );

                    if (Capacitor.isNativePlatform()) {
                      setTimeout(() => handlePickGalleryNative(), 250);
                    }
                  } else {
                    showToast(
                      isIndonesian
                        ? "Harap izinkan akses Foto di Pengaturan perangkat"
                        : "Please allow Photos access in device Settings",
                      "delete",
                      () => {},
                    );
                  }
                } else {
                  const granted = await requestCameraPermission();

                  setPermissionPrompt((prev) => ({
                    ...prev,
                    isOpen: false,
                  }));

                  if (granted) {
                    showToast(
                      isIndonesian
                        ? "Akses kamera diberikan"
                        : "Camera access granted",
                      "add",
                      () => {},
                    );

                    if (Capacitor.isNativePlatform()) {
                      setTimeout(() => handleTakePhotoNative(), 250);
                    } else {
                      startLiveCamera();
                    }
                  } else {
                    showToast(
                      isIndonesian
                        ? "Harap izinkan akses Kamera di Pengaturan perangkat"
                        : "Please allow Camera access in device Settings",
                      "delete",
                      () => {},
                    );
                  }
                }
              }}
              className="w-full py-3 rounded-2xl font-bold text-[13px] transition-transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              style={{
                background: isDark
                  ? "linear-gradient(180deg, #ffffff 0%, #e8e8ec 100%)"
                  : "linear-gradient(180deg, #19191c 0%, #08080a 100%)",
                color: isDark ? "#000000" : "#ffffff",
                border: isDark
                  ? "1px solid rgba(255,255,255,0.90)"
                  : "1px solid rgba(0,0,0,0.85)",
                boxShadow: isDark
                  ? "inset 0 1px 0 #ffffff, 0 8px 22px -6px rgba(0,0,0,0.55)"
                  : "inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 22px -6px rgba(15,23,42,0.30)",
              }}
            >
              <Check size={16} strokeWidth={2} />
              {isIndonesian ? "Berikan Izin" : "Grant Permission"}
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");

                setPermissionPrompt((prev) => ({
                  ...prev,
                  isOpen: false,
                }));
              }}
              className="w-full py-2.5 rounded-2xl font-semibold text-[12px] transition-colors cursor-pointer"
              style={{
                color: "var(--text-secondary)",
              }}
            >
              {isIndonesian ? "Batal" : "Cancel"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
