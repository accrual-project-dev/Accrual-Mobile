import { createClient } from "@supabase/supabase-js"

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://iqjcmqkgrfmopznrfikx.supabase.co"
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxamNtcWtncmZtb3B6bnJmaWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyODA0NzcsImV4cCI6MjEwMjg1NjQ3N30.ujfATs0huUkR9tCNB0Rs8JlqJG3dkz13EKtkr-eFiDg"

// Resilient fetch wrapper with 7s timeout, cache-bypass, and progressive auto-retry for spotty WiFi and mobile connections
const resilientFetch: typeof fetch = async (input, init) => {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    let isTimedOut = false;
    const timeoutId = setTimeout(() => {
      isTimedOut = true;
      controller.abort();
    }, 7000);

    if (init?.signal) {
      if (init.signal.aborted) {
        clearTimeout(timeoutId);
        controller.abort();
      } else {
        init.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    // On subsequent retries, inject cache-busting headers and no-store to force WebKit to abandon dead TCP sockets
    const requestInit: RequestInit = {
      ...init,
      signal: controller.signal,
    };

    if (attempt > 0) {
      requestInit.cache = "no-store";
      const headers = new Headers(requestInit.headers || {});
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      requestInit.headers = headers;
    }

    try {
      const response = await fetch(input, requestInit);
      return response;
    } catch (err: any) {
      lastError = err;
      const msg = typeof err?.message === "string" ? err.message.toLowerCase() : "";
      const isTransient =
        isTimedOut ||
        err?.name === "TypeError" ||
        msg.includes("network connection was lost") ||
        msg.includes("failed to fetch") ||
        msg.includes("load failed") ||
        msg.includes("-1005") ||
        msg.includes("-1009") ||
        msg.includes("network") ||
        msg.includes("timeout") ||
        (err?.name === "AbortError" && isTimedOut);

      if (isTransient && attempt < maxRetries && !init?.signal?.aborted) {
        const backoffMs = attempt === 0 ? 300 : attempt === 1 ? 800 : 1500;
        console.warn(`[Supabase:fetch] Transient network issue on attempt ${attempt + 1}/${maxRetries}. Retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      if (isTimedOut) {
        throw new Error("Koneksi jaringan melebihi batas waktu (timeout). Periksa koneksi internet Anda.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("Koneksi jaringan terputus. Pastikan perangkat Anda terhubung ke internet.");
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: resilientFetch },
})
