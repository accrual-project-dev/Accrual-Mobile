import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth, GUEST_USER_ID } from "../contexts/AuthContext";

export interface Shortcut {
  id: string;
  title: string;
  amount: number;
  wallet_id: string;
  category_id: string;
  type: "expense" | "income";
  note: string;
  space_id?: string | null;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [];
const SHORTCUTS_STORAGE_KEY = "trouvaille_shortcuts";
const SHORTCUTS_SYNC_EVENT = "trouvaille_shortcuts_updated";

function isLegacyDefaultShortcut(s: Shortcut): boolean {
  return (
    (s.id === "s1" && s.title === "Coffee" && s.amount === 25000 && !s.wallet_id && !s.category_id) ||
    (s.id === "s2" && s.title === "Fuel & Gas" && s.amount === 30000 && !s.wallet_id && !s.category_id) ||
    (s.id === "s3" && s.title === "Parking" && s.amount === 5000 && !s.wallet_id && !s.category_id)
  );
}

function readSavedShortcuts(): Shortcut[] {
  try {
    const saved = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (!saved) return DEFAULT_SHORTCUTS;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_SHORTCUTS;
    const cleaned = parsed.filter((s: Shortcut) => s && !isLegacyDefaultShortcut(s));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export function useShortcuts() {
  const { user, isGuest } = useAuth();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => readSavedShortcuts());

  const persistShortcuts = useCallback((next: Shortcut[]) => {
    setShortcuts(next);
    try {
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(SHORTCUTS_SYNC_EVENT));
    } catch {}
  }, []);

  // Listen to cross-tab / cross-component sync events and session teardown
  useEffect(() => {
    const handleSync = () => {
      setShortcuts(readSavedShortcuts());
    };
    const handleTeardown = () => {
      setShortcuts([]);
    };
    window.addEventListener(SHORTCUTS_SYNC_EVENT, handleSync);
    window.addEventListener("storage", handleSync);
    window.addEventListener("trouvaille_session_teardown", handleTeardown);
    return () => {
      window.removeEventListener(SHORTCUTS_SYNC_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("trouvaille_session_teardown", handleTeardown);
    };
  }, []);

  // Cloud hydration from `public.user_shortcuts` when authenticated
  useEffect(() => {
    if (!user?.id || isGuest || user.id === GUEST_USER_ID) return;
    let isMounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_shortcuts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (!error && Array.isArray(data) && isMounted) {
          const localList = readSavedShortcuts();
          if (data.length > 0) {
            const cloudMapped: Shortcut[] = data.map((row: any) => ({
              id: row.id,
              title: row.title || "",
              amount: Number(row.amount || 0),
              wallet_id: row.wallet_id || "",
              category_id: row.category_id || "",
              type: row.type === "income" ? "income" : "expense",
              note: row.note || "",
            }));
            persistShortcuts(cloudMapped);
          } else if (localList.length > 0) {
            // Push existing local presets to cloud if cloud table is empty
            for (const s of localList) {
              await supabase.from("user_shortcuts").upsert({
                id: s.id,
                user_id: user.id,
                title: s.title,
                amount: s.amount,
                type: s.type,
                category_id: s.category_id || null,
                wallet_id: s.wallet_id || null,
                note: s.note || null,
              });
            }
          }
        }
      } catch {
        // Offline fallback preserves localStorage
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.id, isGuest, persistShortcuts]);

  const saveShortcut = useCallback(
    (shortcut: Shortcut) => {
      const current = readSavedShortcuts();
      const exists = current.some((s) => s.id === shortcut.id);
      const next = exists
        ? current.map((s) => (s.id === shortcut.id ? shortcut : s))
        : [...current, shortcut];
      persistShortcuts(next);

      if (user?.id && !isGuest && user.id !== GUEST_USER_ID) {
        void supabase
          .from("user_shortcuts")
          .upsert({
            id: shortcut.id,
            user_id: user.id,
            title: shortcut.title,
            amount: shortcut.amount,
            type: shortcut.type,
            category_id: shortcut.category_id || null,
            wallet_id: shortcut.wallet_id || null,
            note: shortcut.note || null,
          })
          .then(() => {});
      }
    },
    [persistShortcuts, user?.id, isGuest],
  );

  const deleteShortcut = useCallback(
    (id: string) => {
      const current = readSavedShortcuts();
      const next = current.filter((s) => s.id !== id);
      persistShortcuts(next);

      if (user?.id && !isGuest && user.id !== GUEST_USER_ID) {
        void supabase
          .from("user_shortcuts")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id)
          .then(() => {});
      }
    },
    [persistShortcuts, user?.id, isGuest],
  );

  return { shortcuts, saveShortcut, deleteShortcut };
}
