import * as XLSX from "xlsx";

export type ParsedRow = {
  /** Row number in the original sheet, for error messages. */
  row: number;
  name: string;
  position: string;
  baseSalary: number;
};

export type ParseResult = {
  sheetName: string;
  rows: ParsedRow[];
  /** Rows that were blank or had no usable name. */
  skipped: number;
  /** Which columns were treated as what — shown back to the user. */
  columns: { name: string; position: string; salary: string };
};

const NAME_RE = /(name|employee|pangalan|empleyado)/i;
const POSITION_RE = /(position|designation|role|title|trabaho)/i;
const SALARY_RE = /(salary|rate|basic|sahod|sweldo|pay)/i;
const TOTAL_RE = /^(total|grand total|subtotal|overall)/i;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function cellNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  const cleaned = cellText(value).replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/**
 * Reads the first sheet of an .xlsx / .xls / .csv file and pulls out employee
 * rows. Headers are detected by name, but a sheet with no recognisable header
 * still works: the first column is taken as the name.
 */
export async function parseEmployeeSheet(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("That file has no sheets in it.");

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  if (matrix.length === 0) throw new Error("That sheet is empty.");

  /* --------------------------- find the header -------------------------- */
  let headerIndex = -1;
  let nameIndex = 0;
  let positionIndex = 1;
  let salaryIndex = 2;

  // A sheet often has a title row above the real header ("Employee Master
  // List"). Both match NAME_RE, so pick the row that recognises the most
  // distinct columns instead of simply the first match.
  const searchLimit = Math.min(matrix.length, 10);
  let bestScore = 0;

  for (let r = 0; r < searchLimit; r++) {
    const row = matrix[r] ?? [];
    const texts = row.map(cellText);
    const nameAt = texts.findIndex((t) => t.length > 0 && t.length < 30 && NAME_RE.test(t));
    if (nameAt < 0) continue;

    const posAt = texts.findIndex((t) => t.length > 0 && t.length < 30 && POSITION_RE.test(t));
    const salAt = texts.findIndex((t) => t.length > 0 && t.length < 30 && SALARY_RE.test(t));
    const score = 1 + (posAt >= 0 ? 1 : 0) + (salAt >= 0 ? 1 : 0);

    if (score > bestScore) {
      bestScore = score;
      headerIndex = r;
      nameIndex = nameAt;
      positionIndex = posAt >= 0 ? posAt : nameAt === 0 ? 1 : 0;
      salaryIndex = salAt >= 0 ? salAt : Math.max(nameIndex, positionIndex) + 1;
    }
    if (score === 3) break;
  }

  const headerRow = headerIndex >= 0 ? (matrix[headerIndex] ?? []).map(cellText) : [];
  const columnLabel = (index: number, fallback: string) =>
    headerRow[index] && headerRow[index].length > 0 ? headerRow[index] : fallback;

  /* ----------------------------- read the rows --------------------------- */
  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (let r = headerIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const name = cellText(row[nameIndex]);

    if (!name) {
      skipped += 1;
      continue;
    }
    // A repeated header somewhere down the sheet, or a totals row.
    if (NAME_RE.test(name) && name.length < 24) {
      skipped += 1;
      continue;
    }
    if (TOTAL_RE.test(name)) {
      skipped += 1;
      continue;
    }

    rows.push({
      row: r + 1,
      name,
      position: cellText(row[positionIndex]) || "—",
      baseSalary: cellNumber(row[salaryIndex]),
    });
  }

  return {
    sheetName,
    rows,
    skipped,
    columns: {
      name: columnLabel(nameIndex, "Column A"),
      position: columnLabel(positionIndex, "Column B"),
      salary: columnLabel(salaryIndex, "Column C"),
    },
  };
}

/** A blank template so the user knows what the sheet should look like. */
export function downloadEmployeeTemplate(): void {
  const rows = [
    { Name: "Dela Cruz, Juan", Position: "Production Operator", "Monthly salary": 18500 },
    { Name: "Santos, Maria", Position: "QC Inspector", "Monthly salary": 22000 },
    { Name: "Reyes, Pedro", Position: "Warehouse Clerk", "Monthly salary": 16800 },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 26 }, { wch: 24 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Employees");
  XLSX.writeFile(wb, "payroll-klassic-employee-template.xlsx");
}
