// ======================================================================
// TROUVAILLE DETERMINISTIC CSV & DELIMITED TEXT PARSER
// Wraps PapaParse for robust quote-safe, delimiter-adaptive parsing.
// Handles commas inside quoted strings, semicolon-delimited Indonesian CSVs,
// tab-separated files, and UTF-8 Byte Order Marks (BOM).
// 100% offline & client-side.
// ======================================================================

import Papa from "papaparse";

export interface ParsedCSVResult {
  /** First row treated as headers (trimmed, quotes stripped, BOM removed) */
  headers: string[];
  /** Data rows as string arrays */
  rows: string[][];
  /** Delimiter detected by PapaParse (e.g. ",", ";", "\t") */
  delimiter: string;
  /** Whether the first row looks like a header or pure data */
  hasHeaderRow: boolean;
}

/**
 * Strips UTF-8 Byte Order Mark (BOM) if present at start of text.
 */
function stripBOM(str: string): string {
  if (str.charCodeAt(0) === 0xfeff) {
    return str.slice(1);
  }
  return str;
}

/**
 * Evaluates whether a row looks like a header row (mostly strings/text, not dates/numbers).
 */
function checkIsHeaderRow(firstRow: string[]): boolean {
  if (!firstRow || firstRow.length === 0) return false;
  // A table header row MUST have at least 2 non-empty cells
  const nonEmpty = firstRow.filter((c) => c && c.trim().length > 0);
  if (nonEmpty.length < 2) return false;

  // If first column matches a date pattern (DD/MM/YYYY or YYYY-MM-DD), it's almost certainly data
  const firstCol = nonEmpty[0].trim();
  if (/^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}/.test(firstCol)) return false;
  if (/^\d{1,2}\s+[a-zA-Z]{3}/.test(firstCol)) return false;

  // Check if at least 2 cells contain typical header vocabulary
  const headerTerms = [
    "tanggal", "date", "tgl", "deskripsi", "keterangan", "narasi", "description",
    "debet", "debit", "kredit", "credit", "jumlah", "nominal", "amount", "saldo", "balance",
    "jenis", "tipe", "type", "no", "mutasi", "kategori", "category", "wallet", "akun", "rekening"
  ];

  const lowerJoined = nonEmpty.map((c) => c.toLowerCase().trim()).join(" ");
  const matchCount = headerTerms.filter((term) => lowerJoined.includes(term)).length;
  if (matchCount >= 2) return true;
  if (matchCount >= 1 && nonEmpty.length >= 3) return true;

  // If no date found in col 0 and not all cells are purely numeric, treat as header if it has >= 3 columns
  const numericCount = nonEmpty.filter((c) => /^[\d.,\-+]+$/.test(c.trim())).length;
  return numericCount === 0 && nonEmpty.length >= 3;
}

/**
 * Parses raw CSV, TSV, or semicolon-delimited text into clean rows.
 */
export function parseDelimitedText(rawText: string): ParsedCSVResult {
  const cleanInput = stripBOM(rawText.trim());

  if (!cleanInput) {
    return {
      headers: [],
      rows: [],
      delimiter: ",",
      hasHeaderRow: false,
    };
  }

  const parsed = Papa.parse<string[]>(cleanInput, {
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
  });

  const rawRows: string[][] = (parsed.data || [])
    .map((row) => row.map((cell) => (typeof cell === "string" ? cell.trim() : String(cell || "").trim())))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (rawRows.length === 0) {
    return {
      headers: [],
      rows: [],
      delimiter: parsed.meta.delimiter || ",",
      hasHeaderRow: false,
    };
  }

  // Header row auto-discovery: Scan rows 0 to 10 for table header tokens (Rule 8.1)
  let headerRowIndex = -1;
  const scanLimit = Math.min(10, rawRows.length);
  for (let i = 0; i < scanLimit; i++) {
    if (checkIsHeaderRow(rawRows[i])) {
      headerRowIndex = i;
      break;
    }
  }

  // Fallback: If no header row matched the vocabulary, check if row 0 has >= 2 non-numeric cells
  if (headerRowIndex === -1 && rawRows.length > 0) {
    const row0 = rawRows[0].filter((c) => c.trim().length > 0);
    const firstCol = row0[0]?.trim() || "";
    const isDate = /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}/.test(firstCol) || /^\d{1,2}\s+[a-zA-Z]{3}/.test(firstCol);
    const numericCount = row0.filter((c) => /^[\d.,\-+]+$/.test(c.trim())).length;
    if (row0.length >= 2 && !isDate && numericCount < row0.length / 2) {
      headerRowIndex = 0;
    }
  }

  if (headerRowIndex !== -1) {
    const headers = rawRows[headerRowIndex];
    const rows = rawRows.slice(headerRowIndex + 1);
    return {
      headers,
      rows,
      delimiter: parsed.meta.delimiter || ",",
      hasHeaderRow: true,
    };
  } else {
    // Generate positional fallback headers: Kolom 1, Kolom 2, ...
    const maxCols = Math.max(...rawRows.map((r) => r.length));
    const fallbackHeaders = Array.from({ length: maxCols }, (_, i) => `Kolom ${i + 1}`);
    return {
      headers: fallbackHeaders,
      rows: rawRows,
      delimiter: parsed.meta.delimiter || ",",
      hasHeaderRow: false,
    };
  }
}
