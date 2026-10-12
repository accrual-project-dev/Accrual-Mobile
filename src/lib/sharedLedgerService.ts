// ======================================================================
// TROUVAILLE SHARED LEDGER SERVICE
// Backend integration, RPC invocation, and resilient offline caching
// ======================================================================

import { supabase } from "./supabase";
import type { LedgerMember, LedgerMemberRole } from "../types";

const SHARED_MEMBERS_CACHE_PREFIX = "trouvaille_shared_members_";

/**
 * Generates an Apple-style, easily readable 6-character alphanumeric invite code.
 * Excludes ambiguous characters (0, O, 1, I, L) for voice dictation and visual clarity.
 */
export function generateInviteCode(): string {
  // Excludes 0, 1, I, O, L to prevent any ambiguity
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let result = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const randomBytes = new Uint8Array(6);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(randomBytes[i] % chars.length);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  // Format as TRV-XXX or XXX-XXX
  return `TRV-${result.slice(0, 3)}${result.slice(3)}`;
}

/**
 * Normalizes an invite code: removes hyphens, spaces, and forces uppercase.
 */
export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Resolves candidate ledger IDs for queries/mutations.
 * When a user shares their Personal Space, it may be stored in Supabase as either
 * "personal" or "personal-${userId}".
 */
export function resolveLedgerCandidateIds(ledgerId: string, userId?: string | null): string[] {
  if (ledgerId === "personal" && userId) {
    return ["personal", `personal-${userId}`];
  }
  return [ledgerId];
}

function isIndonesianLocale(explicitFlag?: boolean): boolean {
  if (typeof explicitFlag === "boolean") return explicitFlag;
  try {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("trouvaille_language") : null;
    return saved !== "en";
  } catch {
    return true;
  }
}

/**
 * Fetches members belonging to a specific ledger from Supabase with offline fallback.
 */
export async function fetchLedgerMembers(ledgerId: string): Promise<LedgerMember[]> {
  const cacheKey = `${SHARED_MEMBERS_CACHE_PREFIX}${ledgerId}`;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id || session.user.id === "guest_local_user") {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    }

    const candidateIds = resolveLedgerCandidateIds(ledgerId, session.user.id);

    // Try selecting with status column first, fallback if migration not yet applied
    let rows: any[] | null = null;
    const withStatus = await supabase
      .from("ledger_members")
      .select("id, ledger_id, user_id, role, status, display_name, email, joined_at")
      .in("ledger_id", candidateIds)
      .order("joined_at", { ascending: true });

    if (!withStatus.error && withStatus.data) {
      rows = withStatus.data;
    } else {
      const withoutStatus = await supabase
        .from("ledger_members")
        .select("id, ledger_id, user_id, role, display_name, email, joined_at")
        .in("ledger_id", candidateIds)
        .order("joined_at", { ascending: true });

      if (withoutStatus.error) {
        console.warn("[fetchLedgerMembers] Supabase warning:", withoutStatus.error.message);
        const cached = localStorage.getItem(cacheKey);
        return cached ? JSON.parse(cached) : [];
      }
      rows = withoutStatus.data;
    }

    const members: LedgerMember[] = (rows || []).map((row) => ({
      id: row.id,
      ledger_id: row.ledger_id,
      user_id: row.user_id,
      role: row.role as LedgerMemberRole,
      status: row.status === "pending" ? "pending" : "active",
      display_name: row.display_name,
      email: row.email,
      joined_at: row.joined_at,
    }));

    try {
      localStorage.setItem(cacheKey, JSON.stringify(members));
    } catch {}

    return members;
  } catch (err) {
    console.error("[fetchLedgerMembers] Error fetching members:", err);
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
}

export interface JoinLedgerResult {
  success: boolean;
  ledger_id?: string;
  ledger_name?: string;
  role?: LedgerMemberRole;
  status?: "active" | "pending";
  message: string;
}

/**
 * Joins a shared ledger using its unique invite code.
 * - joinMethod === "qr": auto-approved ('active')
 * - joinMethod === "code": requires owner approval ('pending')
 */
export async function joinLedgerWithCode(
  rawCode: string,
  displayName?: string,
  joinMethod: "code" | "qr" = "code",
  isIndonesian?: boolean,
): Promise<JoinLedgerResult> {
  const isId = isIndonesianLocale(isIndonesian);
  const cleanCode = normalizeInviteCode(rawCode);
  if (!cleanCode) {
    return {
      success: false,
      message: isId ? "Kode undangan tidak boleh kosong." : "Invite code cannot be empty.",
    };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id || session.user.id === "guest_local_user") {
      return {
        success: false,
        message: isId
          ? "Silakan masuk ke akun Accrual terlebih dahulu untuk bergabung ke space bersama."
          : "Please sign in to your Accrual account first to join a shared space.",
      };
    }

    const resolvedName =
      displayName ||
      (session.user.user_metadata?.full_name as string) ||
      session.user.email?.split("@")[0] ||
      (isId ? "Anggota" : "Member");

    // Attempt 3-parameter RPC (with p_join_method)
    let rpcData: any = null;
    let rpcError: any = null;

    const res3 = await supabase.rpc("join_ledger_by_invite_code", {
      p_invite_code: cleanCode,
      p_display_name: resolvedName,
      p_join_method: joinMethod,
    });

    if (!res3.error) {
      rpcData = res3.data;
    } else {
      // Fallback to 2-parameter RPC if SQL migration hasn't been executed yet
      const res2 = await supabase.rpc("join_ledger_by_invite_code", {
        p_invite_code: cleanCode,
        p_display_name: resolvedName,
      });
      rpcData = res2.data;
      rpcError = res2.error;

      if (!rpcError && rpcData?.success && rpcData?.ledger_id && joinMethod === "code") {
        // Best-effort update status to 'pending' if column exists
        try {
          await supabase
            .from("ledger_members")
            .update({ status: "pending" })
            .eq("ledger_id", rpcData.ledger_id)
            .eq("user_id", session.user.id);
        } catch {}
      }
    }

    if (rpcError) {
      console.warn("[joinLedgerWithCode] RPC error:", rpcError.message);
      return {
        success: false,
        message:
          rpcError.message ||
          (isId ? "Gagal memproses kode undangan." : "Failed to process invite code."),
      };
    }

    const memberStatus: "active" | "pending" =
      rpcData?.status === "pending" || rpcData?.status === "active"
        ? rpcData.status
        : joinMethod === "qr"
          ? "active"
          : "pending";

    return {
      success: Boolean(rpcData?.success),
      ledger_id: rpcData?.ledger_id,
      ledger_name: rpcData?.ledger_name,
      role: rpcData?.role as LedgerMemberRole,
      status: memberStatus,
      message:
        rpcData?.message ||
        (rpcData?.success
          ? memberStatus === "pending"
            ? isId
              ? "Permintaan bergabung terkirim. Menunggu persetujuan pemilik space."
              : "Join request sent. Awaiting space owner approval."
            : isId
              ? "Berhasil bergabung!"
              : "Joined shared space successfully!"
          : isId
            ? "Kode undangan tidak ditemukan atau sudah kedaluwarsa."
            : "Invite code not found or has expired."),
    };
  } catch (err: any) {
    console.error("[joinLedgerWithCode] Unexpected error:", err);
    return {
      success: false,
      message:
        err.message ||
        (isId
          ? "Terjadi kesalahan saat memproses permintaan bergabung."
          : "An unexpected error occurred while joining the space."),
    };
  }
}

/**
 * Approves a pending member in a shared ledger (Owner only).
 */
export async function approveLedgerMember(
  ledgerId: string,
  targetUserId: string,
): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const candidateIds = resolveLedgerCandidateIds(ledgerId, session?.user?.id);

    const { error } = await supabase
      .from("ledger_members")
      .update({ status: "active" })
      .in("ledger_id", candidateIds)
      .eq("user_id", targetUserId);

    if (error) {
      console.error("[approveLedgerMember] Supabase error:", error);
      return false;
    }

    const cacheKey = `${SHARED_MEMBERS_CACHE_PREFIX}${ledgerId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed: LedgerMember[] = JSON.parse(cached);
        const updated = parsed.map((m) =>
          m.user_id === targetUserId ? { ...m, status: "active" as const } : m,
        );
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      }
    } catch {}

    return true;
  } catch (err) {
    console.error("[approveLedgerMember] Error:", err);
    return false;
  }
}

/**
 * Updates a member's role (Owner only).
 */
export async function updateMemberRole(
  ledgerId: string,
  targetUserId: string,
  newRole: LedgerMemberRole,
): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const candidateIds = resolveLedgerCandidateIds(ledgerId, session?.user?.id);

    const { error } = await supabase
      .from("ledger_members")
      .update({ role: newRole })
      .in("ledger_id", candidateIds)
      .eq("user_id", targetUserId);

    if (error) {
      console.error("[updateMemberRole] Supabase error:", error);
      return false;
    }

    // Invalidate local cache
    const cacheKey = `${SHARED_MEMBERS_CACHE_PREFIX}${ledgerId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed: LedgerMember[] = JSON.parse(cached);
        const updated = parsed.map((m) =>
          m.user_id === targetUserId ? { ...m, role: newRole } : m,
        );
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      }
    } catch {}

    return true;
  } catch (err) {
    console.error("[updateMemberRole] Error:", err);
    return false;
  }
}

/**
 * Removes a member from a shared ledger (Owner only).
 */
export async function removeMemberFromLedger(
  ledgerId: string,
  targetUserId: string,
): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const candidateIds = resolveLedgerCandidateIds(ledgerId, session?.user?.id);

    const { error } = await supabase
      .from("ledger_members")
      .delete()
      .in("ledger_id", candidateIds)
      .eq("user_id", targetUserId);

    if (error) {
      console.error("[removeMemberFromLedger] Supabase error:", error);
      return false;
    }

    // Invalidate local cache
    const cacheKey = `${SHARED_MEMBERS_CACHE_PREFIX}${ledgerId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed: LedgerMember[] = JSON.parse(cached);
        const updated = parsed.filter((m) => m.user_id !== targetUserId);
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      }
    } catch {}

    return true;
  } catch (err) {
    console.error("[removeMemberFromLedger] Error:", err);
    return false;
  }
}

/**
 * Leaves a shared ledger (Member action).
 */
export async function leaveSharedLedger(
  ledgerId: string,
  currentUserId: string,
): Promise<boolean> {
  return removeMemberFromLedger(ledgerId, currentUserId);
}

/**
 * Regenerates an invite code for a shared ledger (Owner only).
 */
export async function regenerateInviteCode(ledgerId: string): Promise<string | null> {
  const newCode = generateInviteCode();
  try {
    const { data, error } = await supabase.rpc("regenerate_ledger_invite_code", {
      p_ledger_id: ledgerId,
      p_new_code: newCode,
    });

    if (error) {
      // Fallback: direct update ONLY if user is the authenticated owner
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.error("[regenerateInviteCode] Unauthorized:", error);
        return null;
      }

      const candidateIds = resolveLedgerCandidateIds(ledgerId, session.user.id);
      const { error: updateError } = await supabase
        .from("ledgers")
        .update({ invite_code: newCode, updated_at: new Date().toISOString() })
        .in("id", candidateIds)
        .eq("user_id", session.user.id);

      if (updateError) {
        console.error("[regenerateInviteCode] Fallback error:", updateError);
        return null;
      }
      return newCode;
    }

    return data?.invite_code || newCode;
  } catch (err) {
    console.error("[regenerateInviteCode] Unexpected error:", err);
    return null;
  }
}

