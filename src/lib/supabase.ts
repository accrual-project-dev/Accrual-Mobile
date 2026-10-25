import { createClient } from "@supabase/supabase-js"

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://iqjcmqkgrfmopznrfikx.supabase.co"
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxamNtcWtncmZtb3B6bnJmaWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyODA0NzcsImV4cCI6MjEwMjg1NjQ3N30.ujfATs0huUkR9tCNB0Rs8JlqJG3dkz13EKtkr-eFiDg"

// Resilient fetch wrapper with 12s timeout for spotty WiFi and mobile connections
const resilientFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  if (init?.signal) {
    init.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === "AbortError" && !init?.signal?.aborted) {
      throw new Error("Koneksi jaringan terputus atau batas waktu terlampaui. Periksa koneksi internet Anda.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: resilientFetch },
})
