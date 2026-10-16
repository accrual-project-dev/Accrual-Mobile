import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Transaction, FinancialDomain, FinancialLedger, LedgerMemberRole, LedgerMember } from "../types";
import { supabase } from "../lib/supabase";
import {
  generateInviteCode,
  joinLedgerWithCode,
  leaveSharedLedger,
  type JoinLedgerResult,
} from "../lib/sharedLedgerService";

export type { FinancialDomain, FinancialLedger, LedgerMemberRole, LedgerMember };
export type MoneySpace = FinancialDomain;

export const DEFAULT_MONEY_SPACES: FinancialDomain[] = [
  {
    id: "personal",
    name: "Personal Space",
    description: "Daily personal cashflow, necessities, shopping & personal savings",
    icon: "User",
    currency: "IDR",
    isDefault: true,
    is_default: true,
    is_shared: false,
    role: "owner",
  },
];

const ACTIVE_SPACE_KEY = "trouvaille_active_space_id";
const CUSTOM_SPACES_KEY = "trouvaille_custom_spaces_v1";
const LEDGERS_STORAGE_KEY = "trouvaille_ledgers_v1";

interface CreateSpaceInput {
  name: string;
  description?: string;
  tag?: string;
  icon?: string;
  currency?: string;
  is_shared?: boolean;
  invite_code?: string | null;
}

interface SpaceContextValue {
  activeSpaceId: string;
  activeSpace: MoneySpace;
  spaces: MoneySpace[];
  ledgers: MoneySpace[];
  defaultSpaceId: string;
  isSharedSpace: boolean;
  currentUserRole: LedgerMemberRole;
  setActiveSpaceId: (id: string) => void;
  setDefaultLedger: (id: string) => Promise<void>;
  addCustomSpace: (space: CreateSpaceInput) => MoneySpace;
  updateCustomSpace: (id: string, space: Partial<CreateSpaceInput>) => void;
  deleteCustomSpace: (id: string, reassignToId?: string) => void;
  createLedger: (space: CreateSpaceInput) => MoneySpace;
  updateLedger: (id: string, space: Partial<CreateSpaceInput>) => void;
  deleteLedger: (id: string, reassignToId?: string) => void;
  joinSharedSpace: (
    code: string,
    displayName?: string,
    joinMethod?: "code" | "qr",
  ) => Promise<JoinLedgerResult>;
  leaveSharedSpace: (ledgerId: string) => Promise<boolean>;
  refreshLedgers: () => Promise<void>;
  filterTransactionsBySpace: (transactions: Transaction[], targetSpaceId?: string) => Transaction[];
  calculateSpaceCashflow: (transactions: Transaction[], targetSpaceId?: string) => { income: number; expense: number; net: number };
}

const SpaceContext = createContext<SpaceContextValue | undefined>(undefined);

const DEFAULT_LEDGER_KEY = "trouvaille_default_ledger_id";

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const [defaultSpaceId, setDefaultSpaceIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(DEFAULT_LEDGER_KEY) || "personal";
    } catch {
      return "personal";
    }
  });

  const [activeSpaceId, setActiveSpaceIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_SPACE_KEY);
      const def = localStorage.getItem(DEFAULT_LEDGER_KEY);
      return saved || def || "personal";
    } catch {
      return "personal";
    }
  });

  const [customSpaces, setCustomSpaces] = useState<MoneySpace[]>(() => {
    try {
      const savedLedgers = localStorage.getItem(LEDGERS_STORAGE_KEY);
      if (savedLedgers) {
        const parsed = JSON.parse(savedLedgers);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const savedSpaces = localStorage.getItem(CUSTOM_SPACES_KEY);
      return savedSpaces ? JSON.parse(savedSpaces) : [];
    } catch {
      return [];
    }
  });

  const [personalOverride, setPersonalOverride] = useState<Partial<MoneySpace>>(() => {
    try {
      const saved = localStorage.getItem("trouvaille_personal_ledger_override_v1");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const personalOverrideRef = useRef<Partial<MoneySpace>>(personalOverride);
  useEffect(() => {
    personalOverrideRef.current = personalOverride;
  }, [personalOverride]);

  const resetInMemorySpaces = useCallback(() => {
    setDefaultSpaceIdState("personal");
    setActiveSpaceIdState("personal");
    setCustomSpaces([]);
    setPersonalOverride({});
    personalOverrideRef.current = {};
  }, []);

  // Attempt to sync custom and shared ledgers from Supabase cloud
  const syncFromCloud = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || session.user.id === "guest_local_user") return;

      // First try fetching with ledger_members relation (including status)
      let rawData: any[] = [];
      const resWithStatus = await supabase
        .from("ledgers")
        .select("*, ledger_members(role, status, user_id, display_name)")
        .order("created_at", { ascending: true });

      if (!resWithStatus.error && resWithStatus.data) {
        rawData = resWithStatus.data;
      } else {
        const resWithMembers = await supabase
          .from("ledgers")
          .select("*, ledger_members(role, user_id, display_name)")
          .order("created_at", { ascending: true });

        if (!resWithMembers.error && resWithMembers.data) {
          rawData = resWithMembers.data;
        } else {
          // Fallback if ledger_members join isn't established yet
          const resSimple = await supabase
            .from("ledgers")
            .select("*")
            .order("created_at", { ascending: true });
          if (!resSimple.error && resSimple.data) {
            rawData = resSimple.data;
          }
        }
      }

      if (rawData.length > 0) {
        // Extract default ledger from cloud if designated
        const defaultRow = rawData.find((row: any) => Boolean(row.is_default));
        if (defaultRow) {
          setDefaultSpaceIdState(defaultRow.id);
          try {
            localStorage.setItem(DEFAULT_LEDGER_KEY, defaultRow.id);
          } catch {}
        }

        const myPersonalRow = rawData.find(
          (row: any) =>
            row.user_id === session.user.id &&
            (row.id === "personal" || row.id === `personal-${session.user.id}`),
        );
        if (myPersonalRow) {
          const pOverride: Partial<MoneySpace> = {
            name: myPersonalRow.name,
            description: myPersonalRow.description,
            icon: myPersonalRow.icon,
            currency: myPersonalRow.currency,
            is_shared: Boolean(myPersonalRow.is_shared),
            invite_code: myPersonalRow.invite_code,
            role: "owner",
            member_status: "active",
          };
          setPersonalOverride(pOverride);
          personalOverrideRef.current = pOverride;
          try {
            localStorage.setItem(
              "trouvaille_personal_ledger_override_v1",
              JSON.stringify(pOverride),
            );
          } catch {}
        }

        const cloudSpaces: MoneySpace[] = rawData
          .filter(
            (row: any) =>
              !(
                row.user_id === session.user.id &&
                (row.id === "personal" || row.id === `personal-${session.user.id}`)
              ) && row.id !== "all",
          )
          .map((row: any) => {
            const isOwner = row.user_id === session.user.id;
            const myMembership = Array.isArray(row.ledger_members)
              ? row.ledger_members.find((m: any) => m.user_id === session.user.id)
              : null;
            const role: LedgerMemberRole = isOwner ? "owner" : (myMembership?.role || "editor");
            const memberStatus: "active" | "pending" = isOwner
              ? "active"
              : myMembership?.status === "pending"
                ? "pending"
                : "active";
            const isDef = Boolean(row.is_default);

            return {
              id: row.id,
              user_id: row.user_id,
              name: row.name,
              description: row.description || "",
              icon: row.icon || (row.is_shared ? "Users" : "BookOpen"),
              currency: row.currency || "IDR",
              isDefault: isDef,
              is_default: isDef,
              is_shared: Boolean(row.is_shared),
              invite_code: row.invite_code || null,
              role,
              member_status: memberStatus,
              tag: `#${row.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
              created_at: row.created_at,
            };
          });

        if (cloudSpaces.length > 0) {
          setCustomSpaces((prev) => {
            const mergedMap = new Map<string, MoneySpace>();
            prev.forEach((s) => {
              // Rule 8.2 Multi-Tenant Isolation: only preserve local offline spaces created by this user
              // or pending join requests; drop foreign/kicked spaces not returned by cloud
              if (!s.user_id || s.user_id === session.user.id || s.member_status === "pending") {
                mergedMap.set(s.id, s);
              }
            });
            cloudSpaces.forEach((s) => {
              const prevSpace = mergedMap.get(s.id);
              mergedMap.set(s.id, {
                ...prevSpace,
                ...s,
                member_status:
                  s.member_status || prevSpace?.member_status || "active",
              });
            });
            const merged = Array.from(mergedMap.values());
            try {
              localStorage.setItem(LEDGERS_STORAGE_KEY, JSON.stringify(merged));
              localStorage.setItem(CUSTOM_SPACES_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
          // Re-validate activeSpaceId: if it points to a now-loaded active space, confirm it;
          // otherwise auto-heal back to defaultSpaceId or "personal"
          setActiveSpaceIdState((curr) => {
            const savedActive = (() => {
              try { return localStorage.getItem(ACTIVE_SPACE_KEY) || ""; } catch { return ""; }
            })();
            const targetId = savedActive || curr;
            if (targetId === "personal" || targetId === "all") {
              return targetId;
            }
            const matchedSpace = cloudSpaces.find((s) => s.id === targetId);
            if (
              matchedSpace &&
              matchedSpace.member_status !== "pending"
            ) {
              return targetId;
            }
            // Auto-heal orphaned / revoked space: fallback to defaultSpaceId or "personal"
            const fallbackId = (() => {
              try { return localStorage.getItem(DEFAULT_LEDGER_KEY) || "personal"; } catch { return "personal"; }
            })();
            try {
              localStorage.setItem(ACTIVE_SPACE_KEY, fallbackId);
            } catch {}
            return fallbackId;
          });
        }
      }
    } catch {
      // Silently catch in case network is offline
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    void Promise.resolve().then(() => {
      if (isMounted) {
        void syncFromCloud();
      }
    });

    const handleSessionTeardown = () => {
      if (isMounted) {
        resetInMemorySpaces();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("trouvaille_session_teardown", handleSessionTeardown);
    }

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "SIGNED_OUT") {
        resetInMemorySpaces();
      } else if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user?.id && session.user.id !== "guest_local_user") {
        void syncFromCloud();
      }
    });

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("trouvaille_session_teardown", handleSessionTeardown);
      }
      authSubscription?.subscription?.unsubscribe();
    };
  }, [syncFromCloud, resetInMemorySpaces]);

  const spaces = useMemo(() => {
    const isPersonalDefault = defaultSpaceId === "personal";
    const defaultPersonal: MoneySpace = {
      ...DEFAULT_MONEY_SPACES[0],
      isDefault: isPersonalDefault,
      is_default: isPersonalDefault,
      ...personalOverride,
    };
    const cleanCustom = customSpaces
      .filter((s) => s.id !== "personal" && s.id !== "all")
      .map((s) => ({
        ...s,
        isDefault: s.id === defaultSpaceId,
        is_default: s.id === defaultSpaceId,
      }));
    const list: MoneySpace[] = [defaultPersonal, ...cleanCustom];
    if (cleanCustom.length > 0 && !list.some((s) => s.id === "all")) {
      list.push({
        id: "all",
        name: "All Ledgers",
        description: "Consolidated balance sheet across all financial ledgers",
        icon: "Layers",
        isDefault: false,
        is_default: false,
      });
    }
    return list;
  }, [customSpaces, personalOverride, defaultSpaceId]);

  const activeSpace = useMemo(() => {
    return spaces.find((s) => s.id === activeSpaceId) || DEFAULT_MONEY_SPACES[0];
  }, [spaces, activeSpaceId]);

  const setDefaultLedger = useCallback(async (targetId: string) => {
    setDefaultSpaceIdState(targetId);
    // Also switch to this space immediately
    setActiveSpaceIdState(targetId);
    try {
      localStorage.setItem(DEFAULT_LEDGER_KEY, targetId);
      localStorage.setItem(ACTIVE_SPACE_KEY, targetId);
    } catch {}

    setCustomSpaces((prev) => {
      const updated = prev.map((s) => ({
        ...s,
        isDefault: s.id === targetId,
        is_default: s.id === targetId,
      }));
      try {
        localStorage.setItem(CUSTOM_SPACES_KEY, JSON.stringify(updated));
        localStorage.setItem(LEDGERS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setPersonalOverride((prev) => {
      const updated = {
        ...prev,
        isDefault: targetId === "personal",
        is_default: targetId === "personal",
      };
      personalOverrideRef.current = updated;
      try {
        localStorage.setItem("trouvaille_personal_ledger_override_v1", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id && session.user.id !== "guest_local_user") {
        await supabase
          .from("ledgers")
          .update({ is_default: false })
          .eq("user_id", session.user.id);

        await supabase
          .from("ledgers")
          .update({ is_default: true })
          .eq("id", targetId)
          .eq("user_id", session.user.id);
      }
    } catch (err) {
      console.warn("[setDefaultLedger] Cloud sync failed, local copy preserved:", err);
    }
  }, []);

  const setActiveSpaceId = useCallback((id: string) => {
    setActiveSpaceIdState(id);
    try {
      localStorage.setItem(ACTIVE_SPACE_KEY, id);
    } catch {}
  }, []);

  const addCustomSpace = useCallback((spaceData: CreateSpaceInput) => {
    const rawTag = spaceData.tag?.trim() || `#${spaceData.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const formattedTag = rawTag.startsWith("#") ? rawTag.toLowerCase() : `#${rawTag.toLowerCase()}`;
    const isShared = Boolean(spaceData.is_shared);
    const inviteCode = isShared ? generateInviteCode() : undefined;

    const newSpace: MoneySpace = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? `ledger-${crypto.randomUUID()}` : `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: spaceData.name.trim(),
      description: spaceData.description?.trim() || "",
      tag: formattedTag,
      icon: spaceData.icon || (isShared ? "Users" : "BookOpen"),
      currency: spaceData.currency || "IDR",
      isDefault: false,
      is_default: false,
      is_shared: isShared,
      invite_code: inviteCode,
      role: "owner",
      created_at: new Date().toISOString(),
    };

    setCustomSpaces((prev) => {
      const updated = [...prev, newSpace];
      try {
        localStorage.setItem(CUSTOM_SPACES_KEY, JSON.stringify(updated));
        localStorage.setItem(LEDGERS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Asynchronously synchronize to Supabase cloud if table exists
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id && session.user.id !== "guest_local_user") {
          await supabase
            .from("ledgers")
            .upsert({
              id: newSpace.id,
              user_id: session.user.id,
              name: newSpace.name,
              description: newSpace.description,
              icon: newSpace.icon,
              currency: newSpace.currency || "IDR",
              is_default: false,
              is_shared: isShared,
              invite_code: inviteCode,
              created_at: newSpace.created_at,
            });

          if (isShared) {
            await supabase.from("ledger_members").upsert({
              ledger_id: newSpace.id,
              user_id: session.user.id,
              role: "owner",
              display_name: session.user.email?.split("@")[0] || "Owner",
              email: session.user.email,
            });
          }
        }
      } catch {}
    })();

    try {
      window.dispatchEvent(new CustomEvent("trouvaille_ledgers_updated"));
    } catch {}

    return newSpace;
  }, []);

  const updateCustomSpace = useCallback((id: string, spaceData: Partial<CreateSpaceInput>) => {
    if (id === "personal") {
      const currOverride = personalOverrideRef.current;
      const willBeShared = spaceData.is_shared !== undefined ? Boolean(spaceData.is_shared) : Boolean(currOverride.is_shared);
      const inviteCode = willBeShared
        ? (spaceData.invite_code || currOverride.invite_code || generateInviteCode())
        : undefined;
      const updated: Partial<MoneySpace> = {
        ...currOverride,
        name: spaceData.name ? spaceData.name.trim() : (currOverride.name || "Personal Space"),
        description: spaceData.description !== undefined ? spaceData.description.trim() : currOverride.description,
        icon: spaceData.icon || currOverride.icon || "User",
        currency: spaceData.currency || currOverride.currency || "IDR",
        is_shared: willBeShared,
        invite_code: inviteCode,
      };
      personalOverrideRef.current = updated;
      setPersonalOverride(updated);
      try {
        localStorage.setItem("trouvaille_personal_ledger_override_v1", JSON.stringify(updated));
      } catch {}

      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id && session.user.id !== "guest_local_user") {
            const cloudLedgerId = willBeShared ? `personal-${session.user.id}` : "personal";
            await supabase.from("ledgers").upsert({
              id: cloudLedgerId,
              user_id: session.user.id,
              name: updated.name || "Personal Space",
              description: updated.description || "",
              icon: updated.icon || "User",
              currency: updated.currency || "IDR",
              is_default: true,
              is_shared: willBeShared,
              invite_code: inviteCode,
              updated_at: new Date().toISOString(),
            });

            if (willBeShared) {
              await supabase.from("ledger_members").upsert({
                ledger_id: cloudLedgerId,
                user_id: session.user.id,
                role: "owner",
                display_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Owner",
                email: session.user.email,
              }, { onConflict: "ledger_id,user_id" });
            }
          }
        } catch {}
      })();

      try {
        window.dispatchEvent(new CustomEvent("trouvaille_ledgers_updated"));
      } catch {}
      return;
    }

    const rawTag = spaceData.tag?.trim() || (spaceData.name ? `#${spaceData.name.toLowerCase().replace(/[^a-z0-9]/g, "")}` : undefined);
    const formattedTag = rawTag ? (rawTag.startsWith("#") ? rawTag.toLowerCase() : `#${rawTag.toLowerCase()}`) : undefined;
    let generatedInviteCode: string | undefined;

    setCustomSpaces((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        const willBeShared = spaceData.is_shared !== undefined ? Boolean(spaceData.is_shared) : Boolean(s.is_shared);
        const inviteCode = willBeShared
          ? (spaceData.invite_code || s.invite_code || generateInviteCode())
          : undefined;
        if (willBeShared && (spaceData.invite_code || !s.invite_code)) {
          generatedInviteCode = inviteCode;
        }
        return {
          ...s,
          name: spaceData.name ? spaceData.name.trim() : s.name,
          description: spaceData.description !== undefined ? spaceData.description.trim() : s.description,
          tag: formattedTag || s.tag,
          icon: spaceData.icon || s.icon,
          currency: spaceData.currency || s.currency || "IDR",
          is_shared: willBeShared,
          invite_code: inviteCode,
        };
      });

      try {
        localStorage.setItem(CUSTOM_SPACES_KEY, JSON.stringify(updated));
        localStorage.setItem(LEDGERS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Cloud update
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id && session.user.id !== "guest_local_user") {
          const payload: any = {
            updated_at: new Date().toISOString(),
          };
          if (spaceData.name) payload.name = spaceData.name.trim();
          if (spaceData.description !== undefined) payload.description = spaceData.description.trim();
          if (spaceData.icon) payload.icon = spaceData.icon;
          if (spaceData.currency) payload.currency = spaceData.currency;
          if (spaceData.invite_code) payload.invite_code = spaceData.invite_code;
          if (spaceData.is_shared !== undefined) {
            payload.is_shared = spaceData.is_shared;
            if (spaceData.is_shared && generatedInviteCode) {
              payload.invite_code = generatedInviteCode;
            }
          }

          await supabase
            .from("ledgers")
            .update(payload)
            .eq("id", id)
            .eq("user_id", session.user.id);

          if (spaceData.is_shared) {
            await supabase.from("ledger_members").upsert({
              ledger_id: id,
              user_id: session.user.id,
              role: "owner",
              display_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Owner",
              email: session.user.email,
            }, { onConflict: "ledger_id,user_id" });
          }
        }
      } catch {}
    })();

    try {
      window.dispatchEvent(new CustomEvent("trouvaille_ledgers_updated"));
    } catch {}
  }, []);

  const deleteCustomSpace = useCallback((id: string, reassignToId: string = "personal") => {
    setCustomSpaces((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem(CUSTOM_SPACES_KEY, JSON.stringify(updated));
        localStorage.setItem(LEDGERS_STORAGE_KEY, JSON.stringify(updated));
        localStorage.removeItem(`trouvaille_shared_members_${id}`);
      } catch {}
      return updated;
    });

    // If active space was deleted, revert to personal (in state & localStorage)
    setActiveSpaceIdState((curr) => {
      if (curr === id) {
        const nextActive = reassignToId || "personal";
        try {
          localStorage.setItem(ACTIVE_SPACE_KEY, nextActive);
        } catch {}
        return nextActive;
      }
      return curr;
    });

    // If default space was deleted, revert default to personal
    setDefaultSpaceIdState((curr) => {
      if (curr === id) {
        try {
          localStorage.setItem(DEFAULT_LEDGER_KEY, "personal");
        } catch {}
        return "personal";
      }
      return curr;
    });

    // Cloud delete
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id && session.user.id !== "guest_local_user") {
          await supabase
            .from("ledgers")
            .delete()
            .eq("id", id)
            .eq("user_id", session.user.id);

          // Reassign transactions in cloud if reassignToId is provided
          if (reassignToId) {
            await supabase
              .from("transactions")
              .update({ ledger_id: reassignToId, space_id: reassignToId })
              .eq("ledger_id", id)
              .eq("user_id", session.user.id);
          }
        }
      } catch {}
    })();

    try {
      window.dispatchEvent(new CustomEvent("trouvaille_ledgers_updated", { detail: { deletedId: id, reassignToId } }));
    } catch {}
  }, []);

  /**
   * Filter transactions belonging to a specific Money Space / Ledger.
   * Priority:
   * 1. If target is 'all', returns all transactions.
   * 2. Checks explicit `ledger_id` or `space_id`.
   * 3. Backward-compatible fallback: inspects hashtags in notes (#business, #kantor, #travel, #liburan, etc.)
   */
  const filterTransactionsBySpace = useCallback(
    (transactions: Transaction[], targetSpaceId?: string): Transaction[] => {
      const spaceId = targetSpaceId || activeSpaceId;

      if (spaceId === "all") {
        return transactions;
      }

      // If space is pending owner approval, lock data access
      if (spaceId !== "personal") {
        const targetSpace = customSpaces.find((s) => s.id === spaceId);
        if (targetSpace?.member_status === "pending") {
          return [];
        }
      }

      return transactions.filter((t) => {
        // 1. Explicit native ledger_id match
        if (t.ledger_id) {
          return t.ledger_id === spaceId;
        }

        // 2. Explicit legacy space_id match
        if (t.space_id) {
          return t.space_id === spaceId;
        }

        // 3. Fallback for legacy transactions without ledger_id
        const note = (t.note || "").toLowerCase();

        if (spaceId === "business") {
          return (
            note.includes("#business") ||
            note.includes("#kantor") ||
            note.includes("#proyek") ||
            note.includes("#freelance") ||
            note.includes("#work")
          );
        }

        if (spaceId === "travel") {
          return (
            note.includes("#travel") ||
            note.includes("#liburan") ||
            note.includes("#holiday") ||
            note.includes("#trip") ||
            note.includes("#vacation")
          );
        }

        if (spaceId === "personal") {
          // Personal space shows transactions that are NOT designated to business or travel
          const isBusiness =
            note.includes("#business") ||
            note.includes("#kantor") ||
            note.includes("#proyek") ||
            note.includes("#freelance") ||
            note.includes("#work");
          const isTravel =
            note.includes("#travel") ||
            note.includes("#liburan") ||
            note.includes("#holiday") ||
            note.includes("#trip") ||
            note.includes("#vacation");

          // Also check if matches any custom space tag
          const matchesAnyCustom = customSpaces.some(
            (cs) => cs.tag && note.includes(cs.tag.toLowerCase()),
          );

          return !isBusiness && !isTravel && !matchesAnyCustom;
        }

        // Check custom space by its specific tag
        const custom = customSpaces.find((s) => s.id === spaceId);
        if (custom && custom.tag) {
          return note.includes(custom.tag.toLowerCase());
        }

        return false;
      });
    },
    [activeSpaceId, customSpaces]
  );

  const calculateSpaceCashflow = useCallback(
    (transactions: Transaction[], targetSpaceId?: string) => {
      const filtered = filterTransactionsBySpace(transactions, targetSpaceId);
      let income = 0;
      let expense = 0;

      filtered.forEach((t) => {
        if (t.type === "income") income += Number(t.amount || 0);
        else if (t.type === "expense") expense += Number(t.amount || 0);
      });

      return {
        income,
        expense,
        net: income - expense,
      };
    },
    [filterTransactionsBySpace]
  );

  const isSharedSpace = Boolean(activeSpace?.is_shared);
  const currentUserRole: LedgerMemberRole =
    (activeSpace?.role as LedgerMemberRole) || (activeSpace?.id === "personal" ? "owner" : "editor");

  const joinSharedSpace = useCallback(
    async (
      code: string,
      displayName?: string,
      joinMethod: "code" | "qr" = "code",
    ): Promise<JoinLedgerResult> => {
      const result = await joinLedgerWithCode(code, displayName, joinMethod);
      if (result.success && result.ledger_id) {
        await syncFromCloud();
        if (result.status === "pending") {
          // Ensure pending space is listed in customSpaces with 'pending' status while awaiting owner approval
          setCustomSpaces((prev) => {
            const exists = prev.some((s) => s.id === result.ledger_id);
            const updated = exists
              ? prev.map((s) =>
                  s.id === result.ledger_id
                    ? { ...s, member_status: "pending" as const }
                    : s,
                )
              : [
                  ...prev,
                  {
                    id: result.ledger_id!,
                    name: result.ledger_name || "Shared Space",
                    description: "",
                    icon: "Users",
                    currency: "IDR",
                    is_shared: true,
                    role: result.role || "editor",
                    member_status: "pending" as const,
                  },
                ];
            try {
              localStorage.setItem(CUSTOM_SPACES_KEY, JSON.stringify(updated));
              localStorage.setItem(LEDGERS_STORAGE_KEY, JSON.stringify(updated));
            } catch {}
            return updated;
          });
        } else {
          setActiveSpaceId(result.ledger_id);
        }
      }
      return result;
    },
    [syncFromCloud, setActiveSpaceId],
  );

  const leaveSharedSpace = useCallback(
    async (ledgerId: string): Promise<boolean> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;
      const success = await leaveSharedLedger(ledgerId, session.user.id);
      if (success) {
        setCustomSpaces((prev) => prev.filter((s) => s.id !== ledgerId));
        if (activeSpaceId === ledgerId) {
          setActiveSpaceId("personal");
        }
        await syncFromCloud();
      }
      return success;
    },
    [activeSpaceId, setActiveSpaceId, syncFromCloud],
  );

  const contextValue = useMemo<SpaceContextValue>(
    () => ({
      activeSpaceId,
      activeSpace,
      spaces,
      ledgers: spaces,
      isSharedSpace,
      currentUserRole,
      defaultSpaceId,
      setActiveSpaceId,
      setDefaultLedger,
      addCustomSpace,
      updateCustomSpace,
      deleteCustomSpace,
      createLedger: addCustomSpace,
      updateLedger: updateCustomSpace,
      deleteLedger: deleteCustomSpace,
      joinSharedSpace,
      leaveSharedSpace,
      refreshLedgers: syncFromCloud,
      filterTransactionsBySpace,
      calculateSpaceCashflow,
    }),
    [
      activeSpaceId,
      activeSpace,
      spaces,
      isSharedSpace,
      currentUserRole,
      defaultSpaceId,
      setActiveSpaceId,
      setDefaultLedger,
      addCustomSpace,
      updateCustomSpace,
      deleteCustomSpace,
      joinSharedSpace,
      leaveSharedSpace,
      syncFromCloud,
      filterTransactionsBySpace,
      calculateSpaceCashflow,
    ],
  );

  return (
    <SpaceContext.Provider value={contextValue}>
      {children}
    </SpaceContext.Provider>
  );
}

export function useOptionalSpace(): SpaceContextValue | null {
  return useContext(SpaceContext) || null;
}

export function useSpace(): SpaceContextValue {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error("useSpace must be used within a SpaceProvider");
  }
  return context;
}

export const useDomain = useSpace;
export const useLedger = useSpace;

