import { registerPlugin } from "@capacitor/core";

export interface InboxDraft {
  schema_version: number;
  id: string;
  owner_id?: string;
  source: "shortcut_screenshot" | "shortcut_notification" | "card_transaction" | "share_extension";
  source_app?: string | null;
  allow_auto?: boolean;
  title?: string | null;
  subtitle?: string | null;
  captured_at: string;
  amount: number;
  currency: "IDR" | string;
  merchant: string | null;
  transaction_date: string;
  wallet_hint: string | null;
  direction: "expense" | "income" | "unknown";
  confidence?: number;
  raw_text: string;
}

export interface AccrualInboxPlugin {
  drain(options?: { ownerId?: string }): Promise<{ items: InboxDraft[] }>;
  ack(options: { ids: string[]; ownerId?: string }): Promise<{ success: boolean; acknowledged: number }>;
}

export const AccrualInbox = registerPlugin<AccrualInboxPlugin>("AccrualInbox", {
  web: {
    drain: async () => ({ items: [] }),
    ack: async () => ({ success: true, acknowledged: 0 }),
  },
});
