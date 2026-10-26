import { createClient } from "@supabase/supabase-js"

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://iqjcmqkgrfmopznrfikx.supabase.co"
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxamNtcWtncmZtb3B6bnJmaWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyODA0NzcsImV4cCI6MjEwMjg1NjQ3N30.ujfATs0huUkR9tCNB0Rs8JlqJG3dkz13EKtkr-eFiDg"

// Resilient fetch wrapper with Promise.race safe timeout and auto-retry for spotty WiFi and 4G connections
const resilientFetch: typeof fetch = async (input, init) => {
  const maxRetries = 2;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Koneksi jaringan melebihi batas waktu (timeout). Periksa koneksi internet Anda."));
      }, 20000);
    });

    try {
      const response = await Promise.race([
        fetch(input, init),
        timeoutPromise,
      ]);
      return response;
    } catch (err: any) {
      lastError = err;
      const msg = typeof err?.message === "string" ? err.message.toLowerCase() : "";
      const isTransient =
        msg.includes("network connection was lost") ||
        msg.includes("failed to fetch") ||
        msg.includes("load failed") ||
        msg.includes("-1005") ||
        msg.includes("timeout") ||
        err?.name === "AbortError";

      if (isTransient && attempt < maxRetries) {
        console.warn(`[Supabase:fetch] Transient network issue on attempt ${attempt + 1}/${maxRetries}. Retrying in 800ms...`);
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }

      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw lastError || new Error("Koneksi jaringan terputus. Periksa koneksi internet Anda.");
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: resilientFetch },
})
