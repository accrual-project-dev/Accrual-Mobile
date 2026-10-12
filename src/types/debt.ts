// ======================================================================
// TROUVAILLE DEBT & RECEIVABLES DOMAIN TYPES
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// Strictly Non-Mixed Localization (100% Pure Indonesian / Pure English)
// ======================================================================

export type DebtType = "receivable" | "debt"; // receivable = piutang (dipinjamkan), debt = utang (dipinjam)
export type DebtStatus = "unpaid" | "partial" | "settled";

export type DebtDueStatus =
  | "settled"
  | "overdue"
  | "due_today"
  | "approaching"
  | "on_track"
  | "no_due_date";

export interface DebtRepayment {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  walletId?: string | null;
  walletName?: string | null;
  txId?: string | null;
  note?: string | null;
  createdAt: string; // ISO 8601
}

export interface DebtReceivableRecord {
  id: string;
  userId?: string | null;
  type: DebtType;
  personName: string;
  totalAmount: number;
  remainingAmount: number;
  dueDate?: string | null; // YYYY-MM-DD
  createdDate: string; // YYYY-MM-DD
  note?: string | null;
  status: DebtStatus;
  walletId?: string | null;
  walletName?: string | null;
  disbursementTxId?: string | null;
  isAdministrativeOnly: boolean;
  repayments: DebtRepayment[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface DebtReceivableSummary {
  totalReceivables: number;
  totalDebts: number;
  netReceivables: number;
  activeReceivablesCount: number;
  activeDebtsCount: number;
  settledReceivablesCount: number;
  settledDebtsCount: number;
  overdueCount: number;
  approachingDueCount: number;
}
