// ======================================================================
// TROUVAILLE SMART RECURRING & BILL MATCHING ENGINE (PILAR 2)
// Automatically correlates incoming transactions/mutations with active
// unpaid bills and proposes auto-settlement with explicit user confirmation.
// ======================================================================

import type { Bill } from "./types";

export interface MatchedBillResult {
  bill: Bill;
  confidence: number;
  matchReason: string;
  exactAmountMatch: boolean;
}

function cleanString(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Synonyms and common Indonesian utility & subscription aliases
const BILL_ALIAS_GROUPS: string[][] = [
  ["pln", "listrik", "token pln", "tagihan listrik"],
  ["pdam", "air", "tagihan air", "tirtanadi", "aetra", "palyja"],
  ["bpjs", "bpjs kesehatan", "bpjs ketenagakerjaan"],
  ["indihome", "telkom", "wifi", "internet", "biznet", "myrepublic", "first media", "cbn"],
  ["telkomsel", "by u", "by.u", "indosat", "im3", "xl", "tri", "three", "smartfren", "pulsa", "paket data"],
  ["netflix", "spotify", "youtube", "youtube premium", "disney", "disney+", "hbo", "vidio", "prime video", "apple music", "apple tv", "deezer"],
  ["chatgpt", "openai", "midjourney", "claude", "anthropic", "icloud", "google one", "google storage", "dropbox", "github", "cursor", "copilot", "vercel", "aws"],
  ["kost", "kos", "kontrakan", "sewa kos", "sewa rumah", "ipl", "maintenance fee", "service charge", "apartemen"],
  ["gym", "fitness", "celebrity fitness", "fitness first", "gold's gym", "refit", "f45"],
  ["asuransi", "prudential", "allianz", "manulife", "axa", "sinarmas", "aia", "sequis"],
  ["pbb", "samsat", "stnk", "pajak", "pbb p2"],
];

function areTitlesRelated(txTitle: string, billTitle: string): boolean {
  const cleanTx = cleanString(txTitle);
  const cleanBill = cleanString(billTitle);

  if (!cleanTx || !cleanBill) return false;

  // Direct substring
  if (cleanTx.includes(cleanBill) || cleanBill.includes(cleanTx)) {
    return true;
  }

  // Token overlap (at least one word >= 3 letters matches)
  const txTokens = cleanTx.split(" ").filter((t) => t.length >= 3);
  const billTokens = cleanBill.split(" ").filter((t) => t.length >= 3);

  for (const bt of billTokens) {
    if (txTokens.includes(bt)) return true;
  }

  // Check alias groups
  for (const group of BILL_ALIAS_GROUPS) {
    const billHasAlias = group.some((alias) => cleanBill.includes(alias));
    const txHasAlias = group.some((alias) => cleanTx.includes(alias));
    if (billHasAlias && txHasAlias) return true;
  }

  return false;
}

/**
 * Evaluates whether an incoming transaction matches any active unpaid bill.
 * Only returns a match if title or alias correlates and amount is within reasonable threshold.
 */
export function findBestMatchingBill(
  txTitle: string,
  txAmount: number,
  bills: Bill[],
  isIndonesian: boolean = true,
  currency: string = "IDR",
): MatchedBillResult | null {
  if (!txTitle || !bills || bills.length === 0 || txAmount <= 0) {
    return null;
  }

  // Filter only unpaid bills (or bills due for current cycle)
  const candidateBills = bills.filter((b) => !b.is_paid);
  if (candidateBills.length === 0) return null;

  const isForeign = currency !== "IDR";
  const maxAdminFeeTolerance = isForeign ? 2 : 5000;

  let bestMatch: MatchedBillResult | null = null;

  for (const bill of candidateBills) {
    const titleMatch = areTitlesRelated(txTitle, bill.title);
    if (!titleMatch) continue;

    const billAmt = Number(bill.amount) || 0;
    let confidence = 0.5;
    let matchReason = isIndonesian ? "Nama tagihan sesuai" : "Matching bill title";
    let exactAmountMatch = false;

    if (billAmt > 0) {
      const diff = Math.abs(txAmount - billAmt);

      if (diff === 0) {
        // Exact amount match
        confidence = 0.95;
        matchReason = isIndonesian
          ? "Nama & nominal tagihan cocok persis"
          : "Exact bill title & amount match";
        exactAmountMatch = true;
      } else if (diff <= maxAdminFeeTolerance) {
        // Common admin fee discrepancy
        confidence = 0.85;
        matchReason = isIndonesian
          ? "Nama cocok, selisih nominal wajar (biaya admin)"
          : "Matching title with typical admin fee variance";
      } else {
        // Variable bill (e.g. PLN pascabayar / PAM / Pulsa / Utilities)
        confidence = 0.65;
        matchReason = isIndonesian
          ? "Nama tagihan cocok (nominal bervariasi)"
          : "Matching bill title (variable amount)";
      }
    } else {
      // Bill with zero or unset nominal (variable amount bill)
      confidence = 0.75;
      matchReason = isIndonesian ? "Nama tagihan cocok" : "Matching bill title";
    }

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = {
        bill,
        confidence,
        matchReason,
        exactAmountMatch,
      };
    }
  }

  return bestMatch;
}
