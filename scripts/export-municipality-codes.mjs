import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

const xlsx = XLSX.default ?? XLSX;

export const TARGET_SHEET_NAME = "R6.1.1現在の団体";
export const DEFAULT_INPUT_PATH = "data/市区町村コード.xlsx";
export const DEFAULT_OUTPUT_PATH = "data/市区町村コード_R6.1.1現在の団体.csv";

/**
 * Excelブックの対象シートだけをCSVへ書き出します。
 * @param {string} inputPath - 入力するExcelファイルのパス。
 * @param {string} outputPath - 出力するCSVファイルのパス。
 * @returns {Promise<{inputPath: string; outputPath: string; rowCount: number}>} 出力結果。
 */
export async function exportMunicipalitySheet(inputPath = DEFAULT_INPUT_PATH, outputPath = DEFAULT_OUTPUT_PATH) {
  const workbook = xlsx.readFile(inputPath, { cellDates: false });
  if (!workbook.SheetNames.includes(TARGET_SHEET_NAME)) {
    throw new Error("Sheet not found: " + TARGET_SHEET_NAME + ". Available sheets: " + workbook.SheetNames.join(", "));
  }

  const worksheet = workbook.Sheets[TARGET_SHEET_NAME];
  const rows = xlsx.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  const csv = xlsx.utils.sheet_to_csv(worksheet, {
    FS: ",",
    RS: String.fromCharCode(13, 10),
    blankrows: false,
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "\ufeff" + csv, "utf8");

  return {
    inputPath,
    outputPath,
    rowCount: Math.max(0, rows.length - 1),
  };
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMainModule) {
  const [inputPath = DEFAULT_INPUT_PATH, outputPath = DEFAULT_OUTPUT_PATH] = process.argv.slice(2);
  const result = await exportMunicipalitySheet(inputPath, outputPath);
  console.log("Exported " + result.rowCount + " data rows from " + TARGET_SHEET_NAME + " to " + result.outputPath);
}
