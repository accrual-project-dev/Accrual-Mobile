export interface ShowcaseSlide {
  title: string;
  tagline: string;
  visual: "chart" | "voice" | "vault" | "domain" | "runway";
}

export function formatAuthError(msg: string, isIndonesian: boolean): string {
  if (!msg) {
    return isIndonesian
      ? "Terjadi kesalahan tak terduga. Silakan coba lagi."
      : "An unexpected error occurred. Please try again.";
  }
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return isIndonesian
      ? "Surel atau kata sandi tidak cocok. Silakan periksa kembali."
      : "Incorrect email or password. Please check your credentials.";
  }
  if (lower.includes("email not confirmed")) {
    return isIndonesian
      ? "Silakan verifikasi surel Anda sebelum masuk, atau periksa folder spam."
      : "Please verify your email before signing in, or check your spam folder.";
  }
  if (lower.includes("user already registered")) {
    return isIndonesian
      ? "Akun dengan surel ini sudah terdaftar. Silakan masuk."
      : "An account with this email already exists. Please sign in instead.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return isIndonesian
      ? "Terlalu banyak percobaan. Harap tunggu sejenak lalu coba lagi."
      : "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("password should be at least")) {
    return isIndonesian
      ? "Kata sandi harus terdiri dari minimal 6 karakter."
      : "Password must contain at least 6 characters.";
  }
  if (
    lower.includes("network connection was lost") ||
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("timeout") ||
    lower.includes("koneksi")
  ) {
    return isIndonesian
      ? "Koneksi jaringan terputus. Pastikan perangkat Anda terhubung ke internet."
      : "Network connection lost. Please check your internet connection.";
  }
  return msg;
}

export function getPasswordStrength(
  pwd: string,
  isIndonesian: boolean,
): { score: number; label: string } {
  if (!pwd) return { score: 0, label: "" };
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 8) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  const labelsEn = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const labelsId = ["Terlalu pendek", "Lemah", "Cukup", "Kuat", "Sangat Kuat"];
  const labels = isIndonesian ? labelsId : labelsEn;
  return { score, label: labels[score] || (isIndonesian ? "Lemah" : "Weak") };
}

export function getShowcaseSlides(isIndonesian: boolean): ShowcaseSlide[] {
  return [
    {
      title: isIndonesian ? "Trajektori Arus Kas" : "Cashflow Trajectory",
      tagline: isIndonesian
        ? "Seluruh keuangan Anda dalam satu tempat.\nCatat, pantau, dan raih kejelasan finansial sejati."
        : "Your money in one place.\nTrack, plan, and build lasting financial clarity.",
      visual: "chart",
    },
    {
      title: isIndonesian ? "Pencatatan Seketika" : "Frictionless Capture",
      tagline: isIndonesian
        ? "Catat pengeluaran dalam hitungan detik\ndengan suara percakapan atau pemindaian kamera."
        : "Log expenses in seconds\nwith conversational voice or camera receipt scanning.",
      visual: "voice",
    },
    {
      title: isIndonesian ? "Brankas Privasi Nol" : "Zero-Knowledge Vault",
      tagline: isIndonesian
        ? "Catatan keuangan Anda dienkripsi penuh\ndan sepenuhnya privat di perangkat Anda."
        : "Your financial records stay encrypted\nand strictly private on your device.",
      visual: "vault",
    },
    {
      title: isIndonesian ? "Pemisahan Domain" : "Domain Isolation",
      tagline: isIndonesian
        ? "Pisahkan pengeluaran pribadi\ndari arus kas bisnis dan proyek sampingan secara tegas."
        : "Strictly separate personal outlays\nfrom professional and side-hustle cashflow.",
      visual: "domain",
    },
    {
      title: isIndonesian ? "Ketahanan Finansial" : "Runway & Independence",
      tagline: isIndonesian
        ? "Telemetri arus kas proaktif\ndan metrik ketahanan dana darurat yang cerdas."
        : "Proactive cashflow telemetry\nand intelligent financial runway metrics.",
      visual: "runway",
    },
  ];
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
