import { supabase } from "./supabase";

export interface WebDashboardQrPayload {
  app: string;
  version: string;
  action: string;
  sessionId: string;
  channel: string;
  origin: string;
  createdAt: number;
}

export interface LinkedWebSession {
  sessionId: string;
  origin: string;
  channel: string;
  linkedAt: number;
  userEmail: string;
}

const LINKED_SESSIONS_STORAGE_KEY = "trouvaille_linked_web_sessions";

function getSafeStorage(): Storage | null {
  if (typeof localStorage !== "undefined") return localStorage;
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return null;
}

/**
 * Validates and parses the QR Code string emitted by Accrual/Trouvaille Web Dashboard.
 */
export function parseWebDashboardQr(
  qrContent: string,
  isIndonesian: boolean = true,
): {
  valid: boolean;
  payload?: WebDashboardQrPayload;
  error?: string;
} {
  try {
    if (!qrContent || typeof qrContent !== "string") {
      return {
        valid: false,
        error: isIndonesian ? "Isi QR Code kosong" : "QR code content is empty",
      };
    }

    const data = JSON.parse(qrContent.trim());

    if (data.app !== "accrual" && data.app !== "trouvaille") {
      return {
        valid: false,
        error: isIndonesian
          ? "QR Code ini bukan untuk aplikasi Accrual"
          : "This QR code is not for Accrual application",
      };
    }

    if (data.action !== "login" || !data.sessionId) {
      return {
        valid: false,
        error: isIndonesian
          ? "Payload QR Code tidak valid atau format sesi rusak"
          : "Invalid QR code payload or corrupted session",
      };
    }

    // Check expiration: reject QR codes older than 10 minutes (600,000 ms)
    if (data.createdAt && Date.now() - data.createdAt > 600000) {
      return {
        valid: false,
        error: isIndonesian
          ? "QR Code telah kedaluwarsa. Silakan muat ulang di Web Dashboard"
          : "QR code has expired. Please refresh on the Web Dashboard",
      };
    }

    return {
      valid: true,
      payload: {
        app: data.app,
        version: data.version || "1.0",
        action: data.action,
        sessionId: data.sessionId,
        channel: data.channel || `${data.app || "accrual"}-qr-${data.sessionId}`,
        origin: data.origin || "",
        createdAt: data.createdAt || Date.now(),
      },
    };
  } catch {
    return {
      valid: false,
      error: isIndonesian
        ? "Format QR Code tidak dikenali (bukan JSON Accrual)"
        : "Unrecognized QR code format (not Accrual JSON)",
    };
  }
}

/**
 * Authorizes an Accrual Web Dashboard session via Supabase Realtime broadcast.
 * Sends the active user's access & refresh tokens to the channel.
 */
export async function authorizeWebDashboardSession(
  qrContent: string,
  options?: {
    session?: any;
    timeoutMs?: number;
    requireConfirmation?: boolean;
    isIndonesian?: boolean;
  }
): Promise<{ success: boolean; error?: string; sessionInfo?: LinkedWebSession }> {
  const isIndonesian = options?.isIndonesian ?? true;
  try {
    const parseResult = parseWebDashboardQr(qrContent, isIndonesian);
    if (!parseResult.valid || !parseResult.payload) {
      return {
        success: false,
        error: parseResult.error || (isIndonesian ? "QR Code tidak valid" : "Invalid QR code"),
      };
    }

    const { sessionId, channel: channelName, origin } = parseResult.payload;

    // 1. Resolve active session from: passed options, refresh, getSession, or vault
    let activeSession: any = options?.session || null;

    if (!activeSession || !activeSession.refresh_token) {
      try {
        const { data: refreshData, error: refreshErr } =
          await supabase.auth.refreshSession();
        if (!refreshErr && refreshData?.session) {
          activeSession = refreshData.session;
        }
      } catch {
        // Fallback silently
      }
    }

    if (!activeSession || !activeSession.access_token) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        activeSession = {
          ...sessionData.session,
          refresh_token: sessionData.session.refresh_token || activeSession?.refresh_token,
        };
      }
    }

    // Check persistent session vault fallback for refresh_token
    if (!activeSession?.refresh_token) {
      try {
        const rawVault = localStorage.getItem("trouvaille_session_vault_v1");
        if (rawVault) {
          const parsed = JSON.parse(rawVault);
          if (parsed?.session) {
            activeSession = {
              ...parsed.session,
              ...activeSession,
              refresh_token: parsed.session.refresh_token || activeSession?.refresh_token,
            };
          }
        }
      } catch {}
    }

    // Check Supabase SDK localStorage token key for refresh_token
    if (!activeSession?.refresh_token && typeof localStorage !== "undefined") {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.refresh_token) {
                activeSession = {
                  ...activeSession,
                  refresh_token: parsed.refresh_token,
                  access_token: activeSession?.access_token || parsed.access_token,
                };
                break;
              }
            }
          }
        }
      } catch {}
    }

    if (!activeSession || !activeSession.access_token) {
      return {
        success: false,
        error: isIndonesian
          ? "Anda belum login di aplikasi mobile. Silakan masuk terlebih dahulu."
          : "You are not logged in on mobile. Please sign in first.",
      };
    }

    // Ensure tokens are non-undefined strings
    const resolvedAccessToken = String(activeSession.access_token);
    const resolvedRefreshToken = String(activeSession.refresh_token || "");

    // 2. Connect to the ephemeral Realtime broadcast channel
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    const timeoutLimit = options?.timeoutMs || 10000;
    const requireConfirmation = options?.requireConfirmation ?? true;

    await new Promise<void>((resolve, reject) => {
      let isSettled = false;
      let isConfirmed = false;
      let pulseTimer: any = null;

      const timeoutTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          if (pulseTimer) clearInterval(pulseTimer);
          try {
            supabase.removeChannel(channel);
          } catch {}
          reject(
            new Error(
              isIndonesian
                ? "Web Dashboard tidak merespons konfirmasi. Pastikan layar QR Web Dashboard tetap aktif dan tidak kedaluwarsa."
                : "Web Dashboard did not respond to confirmation. Ensure the QR screen remains active and has not expired."
            )
          );
        }
      }, timeoutLimit);

      // Listen for Web Dashboard confirmation (Handshake ACK)
      channel.on("broadcast", { event: "session-confirmed" }, () => {
        if (!isSettled) {
          isConfirmed = true;
          isSettled = true;
          if (pulseTimer) clearInterval(pulseTimer);
          clearTimeout(timeoutTimer);
          resolve();
        }
      });

      // Listen for Web Dashboard rejection
      channel.on("broadcast", { event: "session-rejected" }, ({ payload }) => {
        if (!isSettled) {
          isSettled = true;
          if (pulseTimer) clearInterval(pulseTimer);
          clearTimeout(timeoutTimer);
          reject(
            new Error(
              payload?.error ||
                (isIndonesian
                  ? "Otorisasi sesi ditolak oleh Web Dashboard"
                  : "Session authorization rejected by Web Dashboard")
            )
          );
        }
      });

      const sendBroadcastPulse = async () => {
        if (isConfirmed || isSettled) return;
        try {
          const sendStatus = await channel.send({
            type: "broadcast",
            event: "session-granted",
            payload: {
              session: {
                access_token: resolvedAccessToken,
                refresh_token: resolvedRefreshToken,
              },
              user: activeSession.user,
            },
          });

          // If confirmation is explicitly disabled, settle on successful send
          if (!requireConfirmation && sendStatus === "ok" && !isSettled) {
            isSettled = true;
            if (pulseTimer) clearInterval(pulseTimer);
            clearTimeout(timeoutTimer);
            resolve();
          }
        } catch (sendErr: any) {
          console.warn("[webAuthSync] Pulse send error:", sendErr);
        }
      };

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Send first pulse immediately
          await sendBroadcastPulse();

          // Send up to 3 follow-up pulses spaced by 450ms to prevent packet drops
          let pulsesCount = 1;
          pulseTimer = setInterval(async () => {
            if (isConfirmed || isSettled || pulsesCount >= 4) {
              if (pulseTimer) clearInterval(pulseTimer);
              return;
            }
            pulsesCount++;
            await sendBroadcastPulse();
          }, 450);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!isSettled) {
            isSettled = true;
            if (pulseTimer) clearInterval(pulseTimer);
            clearTimeout(timeoutTimer);
            reject(
              new Error(
                isIndonesian
                  ? "Gagal terhubung ke saluran sinkronisasi Supabase Realtime"
                  : "Failed to connect to Supabase Realtime sync channel"
              )
            );
          }
        }
      });
    });

    // 3. Clean up the Realtime channel after handshake completes
    setTimeout(() => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    }, 2000);

    // 4. Record linked session history locally ONLY after successful verification
    const linkedSession: LinkedWebSession = {
      sessionId,
      origin: origin || "Accrual Web Dashboard",
      channel: channelName,
      linkedAt: Date.now(),
      userEmail: activeSession.user?.email || "Unknown User",
    };
    saveLinkedWebSession(linkedSession);

    return {
      success: true,
      sessionInfo: linkedSession,
    };
  } catch (err: any) {
    return {
      success: false,
      error:
        err?.message ||
        (isIndonesian
          ? "Gagal memproses otorisasi Web Dashboard"
          : "Failed to process Web Dashboard authorization"),
    };
  }
}

/**
 * Retrieves the list of historically linked web dashboard sessions.
 */
export function getLinkedWebSessions(): LinkedWebSession[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LINKED_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists a new linked web session to local storage.
 */
export function saveLinkedWebSession(session: LinkedWebSession): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const current = getLinkedWebSessions();
    const filtered = current.filter((s) => s.sessionId !== session.sessionId);
    const updated = [session, ...filtered].slice(0, 10); // keep last 10
    storage.setItem(LINKED_SESSIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("[webAuthSync] Failed to save linked web session:", e);
  }
}

/**
 * Removes a linked web session from history.
 */
export function removeLinkedWebSession(sessionId: string): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const current = getLinkedWebSessions();
    const updated = current.filter((s) => s.sessionId !== sessionId);
    storage.setItem(LINKED_SESSIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("[webAuthSync] Failed to remove linked web session:", e);
  }
}

/**
 * Clears all linked web sessions from history.
 */
export function clearAllLinkedWebSessions(): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(LINKED_SESSIONS_STORAGE_KEY);
  } catch (e) {
    console.warn("[webAuthSync] Failed to clear linked web sessions:", e);
  }
}
