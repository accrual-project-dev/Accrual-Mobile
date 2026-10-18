import type { Wallet } from "./types";

export interface EmoneyCardData {
  id: string;
  cardType: "flazz" | "emoney" | "tapcash" | "brizzi" | "jakcard";
  issuerName: string;
  productName: string;
  cardUid: string;
  balance: number;
  lastTapLocation: string;
  lastTapTransitType: "mrt" | "toll" | "bus";
  lastTapAmount: number;
  lastTapTimestamp: string;
}

export const INDONESIAN_CARD_PRESETS: EmoneyCardData[] = [
  {
    id: "flazz-bca-1",
    cardType: "flazz",
    issuerName: "Bank Central Asia",
    productName: "Flazz BCA Gen 2",
    cardUid: "6011 8291 0021 8243",
    balance: 142500,
    lastTapLocation: "Stasiun MRT Bundaran HI",
    lastTapTransitType: "mrt",
    lastTapAmount: 4000,
    lastTapTimestamp: "Today, 08:45 WIB",
  },
  {
    id: "mandiri-emoney-1",
    cardType: "emoney",
    issuerName: "Bank Mandiri",
    productName: "Mandiri E-Money",
    cardUid: "6032 1083 4912 7701",
    balance: 87000,
    lastTapLocation: "Gerbang Tol Cilandak Barat",
    lastTapTransitType: "toll",
    lastTapAmount: 17000,
    lastTapTimestamp: "Yesterday, 19:10 WIB",
  },
  {
    id: "bni-tapcash-1",
    cardType: "tapcash",
    issuerName: "Bank Negara Indonesia",
    productName: "BNI TapCash",
    cardUid: "6019 4432 9811 3042",
    balance: 53500,
    lastTapLocation: "Halte TransJakarta Tosari",
    lastTapTransitType: "bus",
    lastTapAmount: 3500,
    lastTapTimestamp: "2 days ago, 12:20 WIB",
  },
  {
    id: "bri-brizzi-1",
    cardType: "brizzi",
    issuerName: "Bank Rakyat Indonesia",
    productName: "BRI Brizzi",
    cardUid: "6023 5519 8203 1194",
    balance: 210000,
    lastTapLocation: "Stasiun LRT Dukuh Atas",
    lastTapTransitType: "mrt",
    lastTapAmount: 5000,
    lastTapTimestamp: "3 days ago, 17:35 WIB",
  },
  {
    id: "jakcard-dki-1",
    cardType: "jakcard",
    issuerName: "Bank DKI",
    productName: "JakCard Commuter",
    cardUid: "6041 9012 3345 8892",
    balance: 34000,
    lastTapLocation: "Monumen Nasional (Monas)",
    lastTapTransitType: "bus",
    lastTapAmount: 3500,
    lastTapTimestamp: "Sep 15, 14:15 WIB",
  },
];

/**
 * Matches an e-money smartcard to the most relevant wallet account
 */
export function matchWalletForEmoneyCard(
  wallets: Wallet[],
  card: EmoneyCardData
): Wallet | null {
  const normalizedCardType = card.cardType.toLowerCase();
  const normalizedIssuer = card.issuerName.toLowerCase().replace("bank ", "");

  // Priority 1: Direct match with specific card type or issuer name
  const specificMatch = wallets.find((w) => {
    const name = w.name.toLowerCase();
    return name.includes(normalizedCardType) || name.includes(normalizedIssuer);
  });
  if (specificMatch) return specificMatch;

  // Priority 2: Generic e-money smartcard keyword match
  return (
    wallets.find((w) => {
      const name = w.name.toLowerCase();
      return (
        name.includes("flazz") ||
        name.includes("e-money") ||
        name.includes("emoney") ||
        name.includes("tapcash") ||
        name.includes("brizzi") ||
        name.includes("jakcard")
      );
    }) || null
  );
}

/**
 * Calculates balance delta between card and current wallet balance
 */
export function calculateNfcSyncDelta(
  cardBalance: number,
  walletBalance: number
): number {
  return cardBalance - walletBalance;
}

/**
 * Formats relative tap timestamp to 100% pure Indonesian or English
 */
export function formatNfcTapTimestamp(
  rawTimestamp: string,
  isIndonesian: boolean
): string {
  if (!isIndonesian) return rawTimestamp;

  let formatted = rawTimestamp
    .replace(/^Today/i, "Hari ini")
    .replace(/^Yesterday/i, "Kemarin")
    .replace(/(\d+)\s+days?\s+ago/i, "$1 hari lalu");

  formatted = formatted.replace(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/i,
    (_, mon, day) => {
      const monthMap: Record<string, string> = {
        jan: "Jan",
        feb: "Feb",
        mar: "Mar",
        apr: "Apr",
        may: "Mei",
        jun: "Jun",
        jul: "Jul",
        aug: "Agu",
        sep: "Sep",
        oct: "Okt",
        nov: "Nov",
        dec: "Des",
      };
      const idMon = monthMap[mon.toLowerCase()] || mon;
      return `${day} ${idMon}`;
    }
  );

  return formatted;
}

/**
 * Checks whether Web NFC NDEFReader is supported in current runtime environment
 */
export function isWebNfcAvailable(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

