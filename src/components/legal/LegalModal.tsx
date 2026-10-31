import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  ShieldCheck,
  FileText,
  Lock,
  Database,
  AlertCircle,
  Trash2,
  Download,
  Key,
  Scale,
  Sparkles,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { triggerHaptic } from "../../lib/haptics";

export interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "privacy" | "terms" | "security";
  zIndex?: number;
}

export function LegalModal({
  isOpen,
  onClose,
  initialTab = "privacy",
  zIndex = 1250,
}: LegalModalProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const [activeTab, setActiveTab] = useState<"privacy" | "terms" | "security">(
    initialTab,
  );

  const handleTabChange = (tab: "privacy" | "terms" | "security") => {
    triggerHaptic("light");
    setActiveTab(tab);
  };

  const modalTitle = isIndonesian
    ? "Informasi Hukum & Privasi"
    : "Legal & Privacy Information";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={modalTitle} zIndex={zIndex}>
      <div
        className="px-5 space-y-4 text-left max-w-lg mx-auto"
        style={{
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
        }}
      >
        {/* Top Header Card */}
        <div
          className="p-3.5 rounded-2xl flex items-center gap-3 border transition-colors"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: "var(--glass-fill)",
              borderColor: "var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <Scale size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
              Accrual Legal & Privacy
            </h3>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
              {isIndonesian
                ? "Komitmen kedaulatan data, transparansi mutlak, dan keamanan brankas finansial."
                : "Commitment to data sovereignty, absolute transparency, and financial vault security."}
            </p>
          </div>
        </div>

        {/* Apple Segmented Control Tab Switcher */}
        <div
          className="grid grid-cols-3 p-1 rounded-xl border select-none"
          style={{
            background: isDark
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(0, 0, 0, 0.04)",
            borderColor: "var(--glass-border)",
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange("privacy")}
            className={`py-2 px-1 text-center rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "privacy"
                ? isDark
                  ? "bg-white/[0.08] text-white border border-white/10 shadow-xs"
                  : "bg-white text-zinc-950 border border-black/[0.06] shadow-xs"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <ShieldCheck size={12.5} strokeWidth={1.8} />
            <span className="truncate">
              {isIndonesian ? "Privasi" : "Privacy"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("terms")}
            className={`py-2 px-1 text-center rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "terms"
                ? isDark
                  ? "bg-white/[0.08] text-white border border-white/10 shadow-xs"
                  : "bg-white text-zinc-950 border border-black/[0.06] shadow-xs"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <FileText size={12.5} strokeWidth={1.8} />
            <span className="truncate">
              {isIndonesian ? "Ketentuan" : "Terms"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("security")}
            className={`py-2 px-1 text-center rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "security"
                ? isDark
                  ? "bg-white/[0.08] text-white border border-white/10 shadow-xs"
                  : "bg-white text-zinc-950 border border-black/[0.06] shadow-xs"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Lock size={12.5} strokeWidth={1.8} />
            <span className="truncate">
              {isIndonesian ? "Kedaulatan" : "Security"}
            </span>
          </button>
        </div>

        {/* ── TAB CONTENT ── */}
        {activeTab === "privacy" && (
          <div className="space-y-3.5">
            {/* Section 1: Zero Tracker */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "1. Prinsip Nol Pelacak & Tanpa Iklan"
                    : "1. Zero Tracker & No Advertising Principle"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Accrual tidak menggunakan iklan atau pelacakan lintas aplikasi untuk iklan. RevenueCat memproses pengenal pengguna dan data pembelian untuk validasi, pemulihan, dan analitik pembelian."
                  : "Accrual does not use advertising or cross-app advertising tracking. RevenueCat processes user identifiers and purchase information for validation, restoration, and purchase analytics."}
              </p>
            </div>

            {/* Section 2: Data Storage & Sovereignty */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <Database
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "2. Penyimpanan Data & Mode Tamu"
                    : "2. Data Storage & Guest Mode"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Dalam Mode Tamu, catatan disimpan pada perangkat. Jika Anda masuk, data dapat disinkronkan ke Supabase; anggota yang diundang dapat mengakses buku bersama sesuai perannya. Sinkronisasi awan tidak menggunakan enkripsi ujung ke ujung."
                  : "In Guest Mode, records are stored on your device. If you sign in, data can sync to Supabase; invited members can access shared ledgers according to their roles. Cloud sync is not end-to-end encrypted."}
              </p>
            </div>

            {/* Section 3: On-Device Receipt & Slip Processing */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "3. Pemrosesan Struk & Bukti Transfer"
                    : "3. Receipt & Slip On-Device Processing"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Pemindaian struk pembayaran belanja dan bukti transfer perbankan diproses secara lokal pada perangkat keras gawai Anda. Gambar tidak dikirimkan ke model kecerdasan buatan publik atau peladen eksternal."
                  : "Scanning of payment receipts and bank transfer slips is processed locally on your device hardware. Images are never submitted to public artificial intelligence models or external servers."}
              </p>
            </div>

            {/* Section 4: Data Rights & Deletion */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <Trash2
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "4. Hak Penghapusan & Portabilitas Mutlak"
                    : "4. Absolute Deletion & Portability Rights"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Anda memiliki hak kapan saja untuk mengekspor seluruh catatan transaksi dalam format berkas terbuka, mereset riwayat transaksi, atau menghapus akun secara permanen yang akan melenyapkan seluruh data di peladen dan gawai seketika."
                  : "You maintain the right at any time to export all transaction records in open formats, reset transaction history, or permanently delete your account which immediately purges all server and device data."}
              </p>
            </div>

            {/* Section 5: Official Support & Privacy Contact */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <Mail
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "5. Narahubung & Bantuan Privasi"
                    : "5. Privacy & Support Contact"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Untuk pertanyaan teknis, kendala sinkronisasi, atau permohonan audit data, Anda dapat menghubungi tim kami di accrual.project.app@gmail.com."
                  : "For technical inquiries, sync support, or data audit requests, reach our team at accrual.project.app@gmail.com."}
              </p>
            </div>
          </div>
        )}

        {activeTab === "terms" && (
          <div className="space-y-3.5">
            {/* Section 1: Acceptance */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <FileText
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "1. Ketentuan Penggunaan Layanan"
                    : "1. Terms of Service Acceptance"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Dengan memasang, mengakses, atau menggunakan aplikasi Accrual, Anda menyatakan setuju untuk terikat oleh syarat dan ketentuan ini. Layanan ini disediakan untuk pencatatan keuangan pribadi dan pengelolaan kekayaan mandiri."
                  : "By installing, accessing, or using Accrual, you agree to be bound by these terms. This service is provided for personal financial record-keeping and self-directed wealth management."}
              </p>
            </div>

            {/* Section 2: Non-Financial Advisor Disclaimer */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "2. Penyangkalan: Bukan Penasihat Finansial"
                    : "2. Disclaimer: Not a Financial Advisor"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Accrual adalah aplikasi piranti lunak pembukuan dan visualisasi matematika. Informasi di dalam aplikasi, termasuk grafik peramalan, simulasi Monte Carlo, dan valuasi aset, bukan merupakan nasihat finansial, hukum, pajak, atau rekomendasi investasi resmi."
                  : "Accrual is bookkeeping and mathematical visualization software. Information within the app, including forecasting charts, Monte Carlo simulations, and asset valuations, does not constitute financial, legal, tax, or official investment advice."}
              </p>
            </div>

            {/* Section 3: User Responsibility */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <Key
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "3. Tanggung Jawab Keamanan Akun"
                    : "3. Account Security Responsibility"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Pengguna bertanggung jawab penuh atas keamanan gawai, kerahasiaan kata sandi, kode sandi brankas lokal, dan penguncian biometrik. Kehilangan akses akibat kelalaian penyimpanan kunci enkripsi lokal berada di luar wewenang pemulihan peladen."
                  : "Users are solely responsible for device security, password confidentiality, local vault passcodes, and biometric locks. Loss of access resulting from lost local encryption keys cannot be unilaterally recovered by the server."}
              </p>
            </div>

            {/* Section 4: Service Availability */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "4. Pembaruan & Ketersediaan Layanan"
                    : "4. Updates & Service Availability"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Kami berhak memperbarui, memelihara, dan menyempurnakan fitur aplikasi demi stabilitas serta keamanan berkala. Accrual dirancang mengutamakan ketahanan luring agar tetap dapat diakses tanpa koneksi internet."
                  : "We reserve the right to update, maintain, and refine application features for ongoing stability and security. Accrual is architected with an offline-first priority to remain accessible without internet connectivity."}
              </p>
            </div>

            {/* Section 5: Apple Standard EULA */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <Scale
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "5. Perjanjian Lisensi Pengguna Akhir (Apple Standard EULA)"
                    : "5. Licensed Application End User License Agreement (EULA)"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Langganan perpanjangan otomatis Accrual Pro di iOS tunduk pada Perjanjian Lisensi Pengguna Akhir Aplikasi Berlisensi Standar Apple (Apple Standard EULA)."
                  : "Accrual Pro auto-renewable subscriptions on iOS are governed by the Apple Standard Licensed Application End User License Agreement (EULA)."}
              </p>
              <a
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => triggerHaptic("light")}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold underline text-[var(--text-primary)] pt-0.5"
              >
                <span>
                  {isIndonesian
                    ? "Baca Apple Standard EULA Resmi"
                    : "Read Official Apple Standard EULA"}
                </span>
              </a>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-3.5">
            {/* Section 1: Military-Grade Vault Encryption */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <Lock
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "1. Ekspor Cadangan Terenkripsi"
                    : "1. Encrypted Backup Export"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Ekspor cadangan terenkripsi Accrual menggunakan WebCrypto: derivasi kunci sandi PBKDF2 dengan 100.000 iterasi hash SHA-256 yang dipadukan dengan enkripsi simetris autentikasi AES-GCM 256-bit."
                  : "Accrual's encrypted backup export uses WebCrypto: PBKDF2 key derivation with 100,000 SHA-256 iterations paired with authenticated AES-GCM 256-bit symmetric encryption."}
              </p>
            </div>

            {/* Section 2: Zero Vendor Lock-In */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <Download
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "2. Kedaulatan Berkas & Tanpa Keterikatan Vendor"
                    : "2. File Sovereignty & Zero Vendor Lock-In"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Kedaulatan data berarti Anda dapat memindahkan data Anda kapan saja. Accrual menyediakan ekspor lengkap dalam format CSV terstruktur, lembar sebar Excel (.xlsx), dan dokumen Neraca Keuangan PDF berstandar akuntansi profesional."
                  : "Data sovereignty guarantees you can migrate your data at any time. Accrual provides full exports in structured CSV, Excel spreadsheets (.xlsx), and accounting-grade PDF Balance Sheet documents."}
              </p>
            </div>

            {/* Section 3: Session Teardown & Multi-Tenant Isolation */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--text-primary)]"
                />
                <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {isIndonesian
                    ? "3. Penghancuran Sesi & Isolasi Penyewa"
                    : "3. Session Teardown & Multi-Tenant Isolation"}
                </h4>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {isIndonesian
                  ? "Protokol keamanan Accrual menjamin bahwa ketika Anda keluar dari sesi akun atau beralih akun, seluruh penyimpanan kuotasi harga, aset portofolio, dan brankas lokal dibersihkan secara menyeluruh untuk mencegah kebocoran data antar pengguna gawai bersama."
                  : "Accrual's security protocol ensures that upon signing out or switching accounts, all local storage market quotes, portfolio assets, and cache vaults are purged instantly to prevent data leakage across shared devices."}
              </p>
            </div>
          </div>
        )}

        {/* Bottom Close Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-2xl font-semibold text-[12.5px] flex items-center justify-center transition-all active:scale-[0.985] cursor-pointer shadow-xs"
            style={{
              background: isDark ? "#ffffff" : "#18181b",
              color: isDark ? "#000000" : "#ffffff",
            }}
          >
            {isIndonesian ? "Selesai" : "Done"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
