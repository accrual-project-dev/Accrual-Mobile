// ======================================================================
// TROUVAILLE EXCEL (.xlsx) PARSER
// Lazy-loads SheetJS xlsx via dynamic import for code-splitting.
// Converts first worksheet to rows of strings for the statementParser.
// 100% client-side — no data ever leaves the device.
// ======================================================================

import { sanitizeTransferArrowText } from "./statementParser";

export interface ParsedSpreadsheet {
  /** Raw header row strings */
  headers: string[];
  /** All data rows as string arrays (same length as headers) */
  rows: string[][];
  /** Number of sheets in the workbook */
  sheetCount: number;
  /** Name of the sheet that was parsed */
  sheetName: string;
}

/**
 * Parses a .xlsx or .xls file using SheetJS (xlsx) and returns
 * the first worksheet as structured string rows.
 *
 * Dynamically imports xlsx to keep it out of the main bundle.
 */
export async function parseExcelFile(file: File): Promise<ParsedSpreadsheet> {
  // Dynamic import — xlsx is ~800 KB raw, not included in initial bundle
  const XLSX = await import("xlsx");

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error("Excel file contains no sheets");
  }

  // Find the most likely data sheet:
  // Prefer sheets with names like "Mutasi", "Transaksi", "Data", Sheet1
  const preferredOrder = ["mutasi", "transaksi", "data", "sheet1", "statement", "rekening"];
  let targetSheetName = sheetNames[0];
  for (const preferred of preferredOrder) {
    const found = sheetNames.find((n) => n.toLowerCase().includes(preferred));
    if (found) {
      targetSheetName = found;
      break;
    }
  }

  const sheet = workbook.Sheets[targetSheetName];

  // Convert to array-of-arrays (AOA) with defval "" for empty cells
  const rawMatrix: (string | number | boolean | null | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as (string | number | boolean | null | undefined)[][];

  if (rawMatrix.length === 0) {
    throw new Error("Sheet is empty");
  }

  // Normalise all cells to string
  const stringMatrix = rawMatrix.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return "";
      if (typeof cell === "number") {
        // Excel date serial numbers are common — detect them
        if (cell > 25569 && cell < 60000) {
          // Could be a date (days since 1900-01-01)
          const jsDate = XLSX.SSF.parse_date_code(cell);
          if (jsDate) {
            const { y, m, d } = jsDate;
            const dateStr = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            // If fractional day contains time, preserve full ISO timestamp YYYY-MM-DDTHH:mm:ss (Rule 8.1)
            if (jsDate.H || jsDate.M || jsDate.S || (cell % 1 > 0.00001)) {
              const H = String(jsDate.H || 0).padStart(2, "0");
              const M = String(jsDate.M || 0).padStart(2, "0");
              const S = String(Math.floor(jsDate.S || 0)).padStart(2, "0");
              return `${dateStr}T${H}:${M}:${S}`;
            }
            return dateStr;
          }
        }
        // Excel time fraction numbers (0 < cell < 1)
        if (cell > 0 && cell < 1) {
          const jsDate = XLSX.SSF.parse_date_code(cell);
          if (jsDate && (jsDate.H !== undefined || jsDate.M !== undefined)) {
            const H = String(jsDate.H || 0).padStart(2, "0");
            const M = String(jsDate.M || 0).padStart(2, "0");
            const S = String(Math.floor(jsDate.S || 0)).padStart(2, "0");
            return `${H}:${M}:${S}`;
          }
        }
        return String(cell);
      }
      return sanitizeTransferArrowText(String(cell));
    })
  );

  // Find first non-empty, non-metadata row as header row.
  // Skip lines that look like bank metadata (no delimiter, very long single string)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, stringMatrix.length); i++) {
    const row = stringMatrix[i];
    const nonEmpty = row.filter((c) => c.trim() !== "");
    // A valid header row should have ≥ 3 non-empty cells
    if (nonEmpty.length >= 3) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = stringMatrix[headerRowIdx].map((h) => h.trim());
  const rows = stringMatrix.slice(headerRowIdx + 1).filter(
    (row) => row.some((c) => c.trim() !== "")
  );

  return {
    headers,
    rows,
    sheetCount: sheetNames.length,
    sheetName: targetSheetName,
  };
}

/**
 * Converts ParsedSpreadsheet rows to a flat TSV string that can be fed
 * directly into statementParser.parseStatementText() as a generic_csv format.
 *
 * Uses tab separator to avoid conflicts with comma-formatted numbers.
 */
export function spreadsheetToTSV(spreadsheet: ParsedSpreadsheet): string {
  const allRows = [spreadsheet.headers, ...spreadsheet.rows];
  return allRows.map((row) => row.join("\t")).join("\n");
}
