// Clean up any stale Service Worker or CacheStorage in native Capacitor iOS/Android WebView
if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

import { StrictMode, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { AuthProvider } from './contexts/AuthContext'
import { SecurityLockProvider } from './contexts/SecurityLockContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { PrivacyProvider } from './contexts/PrivacyContext'
import { SpaceProvider } from './contexts/SpaceContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import App from './App.tsx'
import './index.css'

import { AlertCircle, RefreshCw, RotateCcw, Copy, Check } from 'lucide-react'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; showDetails: boolean; copied: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false, copied: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, showDetails: false, copied: false };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Trouvaille] Uncaught runtime exception:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      const savedTheme =
        typeof window !== 'undefined' ? localStorage.getItem('trouvaille_theme') : null;
      const isDark =
        savedTheme === 'light'
          ? false
          : savedTheme === 'dark'
          ? true
          : typeof window !== 'undefined' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;

      const savedLang =
        typeof window !== 'undefined' ? localStorage.getItem('trouvaille_language') : null;
      const isIndonesian =
        savedLang === 'id' ||
        (!savedLang &&
          typeof navigator !== 'undefined' &&
          (navigator.language || '').toLowerCase().startsWith('id'));

      return (
        <div
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center p-6 select-none transition-colors duration-300"
          style={{
            backgroundColor: isDark ? "#09090c" : "#f4f4f7",
            color: isDark ? "#ffffff" : "#09090c",
            fontFamily: "'Urbanist', sans-serif",
          }}
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full blur-[120px] ${
                isDark ? "bg-white/[0.03]" : "bg-black/[0.02]"
              }`}
            />
          </div>

          <div
            className={`w-full max-w-sm p-6 sm:p-7 rounded-[28px] text-center relative z-10 space-y-4 backdrop-blur-2xl transition-all ${
              isDark
                ? "bg-white/[0.04] border border-white/[0.12] shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
                : "bg-white/90 border border-black/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.06)]"
            }`}
          >
            {/* Icon Squircle */}
            <div
              className={`w-13 h-13 rounded-2xl mx-auto flex items-center justify-center transition-colors ${
                isDark
                  ? "bg-white/[0.08] border border-white/[0.14] text-white shadow-inner"
                  : "bg-black/[0.04] border border-black/[0.08] text-zinc-900 shadow-sm"
              }`}
            >
              <AlertCircle size={24} strokeWidth={1.5} />
            </div>

            {/* Title & Description (Strict Non-Mixed Localization) */}
            <div className="space-y-1.5">
              <h2
                className={`text-[17px] font-bold tracking-tight ${
                  isDark ? "text-white" : "text-zinc-950"
                }`}
              >
                {isIndonesian
                  ? "Terjadi Kendala pada Tampilan"
                  : "Encountered an Unexpected Glitch"}
              </h2>
              <p
                className={`text-[12px] leading-relaxed font-normal ${
                  isDark ? "text-zinc-400" : "text-zinc-600"
                }`}
              >
                {isIndonesian
                  ? "Trouvaille mendeteksi galat antarmuka. Catatan keuangan dan brankas lokal Anda tetap aman sepenuhnya."
                  : "Trouvaille caught an interface error. Your financial records and local vault remain completely safe."}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`w-full py-3 px-4 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98] ${
                  isDark
                    ? "bg-white text-zinc-950 hover:bg-zinc-200"
                    : "bg-zinc-950 text-white hover:bg-zinc-800"
                }`}
              >
                <RefreshCw size={15} strokeWidth={2} />
                <span>
                  {isIndonesian ? "Muat Ulang Trouvaille" : "Reload Trouvaille"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('TROUVAILLE_OFFLINE_CACHE_V1');
                  } catch {}
                  window.location.reload();
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-[12px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
                  isDark
                    ? "bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.12]"
                    : "bg-black/[0.04] hover:bg-black/[0.08] text-zinc-700 border border-black/[0.09]"
                }`}
              >
                <RotateCcw size={13} strokeWidth={1.75} />
                <span>
                  {isIndonesian
                    ? "Bersihkan Cache & Mulai Ulang"
                    : "Clear Cache & Restart"}
                </span>
              </button>
            </div>

            {/* Technical Details & Copy Log */}
            {this.state.error && (
              <div className="pt-2 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      this.setState({ showDetails: !this.state.showDetails })
                    }
                    className={`text-[11px] underline cursor-pointer transition-colors ${
                      isDark
                        ? "text-zinc-400 hover:text-zinc-200"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {this.state.showDetails
                      ? isIndonesian
                        ? "Sembunyikan Rincian Teknis"
                        : "Hide Technical Details"
                      : isIndonesian
                      ? "Lihat Rincian Teknis"
                      : "View Technical Details"}
                  </button>

                  {this.state.showDetails && (
                    <button
                      type="button"
                      onClick={() => {
                        const errorText = `${this.state.error?.toString()}\n\n${this.state.error?.stack || ""}`;
                        navigator.clipboard?.writeText(errorText);
                        this.setState({ copied: true });
                        setTimeout(() => this.setState({ copied: false }), 2000);
                      }}
                      className={`text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors ${
                        isDark
                          ? "text-zinc-400 hover:text-zinc-200"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      {this.state.copied ? (
                        <>
                          <Check size={11} strokeWidth={2} />
                          <span>
                            {isIndonesian ? "Tersalin" : "Copied"}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} strokeWidth={1.75} />
                          <span>
                            {isIndonesian ? "Salin Pesan Galat" : "Copy Error"}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {this.state.showDetails && (
                  <pre
                    className={`mt-2.5 p-3 rounded-xl text-left text-[10px] max-h-36 overflow-auto font-mono whitespace-pre-wrap transition-colors ${
                      isDark
                        ? "bg-black/60 border border-white/[0.08] text-zinc-300"
                        : "bg-black/[0.03] border border-black/[0.08] text-zinc-700"
                    }`}
                  >
                    {this.state.error?.toString()}
                    {import.meta.env.DEV && this.state.error?.stack ? `\n\n${this.state.error.stack}` : ""}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 1000 * 60 * 5, // 5 minutes fresh cache
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days persistent storage retention
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

const safeSyncStorage = {
  getItem: (key: string) => {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch (err: any) {
      if (
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22
      ) {
        console.warn('[Trouvaille Cache] Storage quota exceeded. Evicting offline cache key...');
        try {
          window.localStorage.removeItem(key);
        } catch {}
      }
    }
  },
  removeItem: (key: string) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {}
  },
};

const persister = createSyncStoragePersister({
  storage: safeSyncStorage,
  key: 'TROUVAILLE_OFFLINE_CACHE_V1',
  throttleTime: 1000,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              if (query.state.status !== 'success') return false;
              const key = query.queryKey;
              const domain = key[0];
              // Only persist master root datasets to prevent exceeding 5MB localStorage limit
              if (domain === 'categories' || domain === 'wallets' || domain === 'bills' || domain === 'shortcuts') {
                return true;
              }
              if (domain === 'transactions') {
                // Only persist master all-transactions query, not repetitive slice queries (month, day, recent, trend)
                return key[1] === 'all';
              }
              return false;
            },
          },
        }}
      >
        <BrowserRouter>
          <AuthProvider>
            <SecurityLockProvider>
              <ThemeProvider>
                <LanguageProvider>
                  <ToastProvider>
                    <PrivacyProvider>
                      <SpaceProvider>
                        <CurrencyProvider>
                          <SubscriptionProvider>
                            <App />
                          </SubscriptionProvider>
                        </CurrencyProvider>
                      </SpaceProvider>
                    </PrivacyProvider>
                  </ToastProvider>
                </LanguageProvider>
              </ThemeProvider>
            </SecurityLockProvider>
          </AuthProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
