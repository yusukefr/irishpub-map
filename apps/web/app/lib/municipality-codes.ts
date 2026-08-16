import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type MunicipalityCodeRecord = {
  code: string;
  prefectureName: string;
  municipalityName?: string;
  prefectureKana?: string;
  municipalityKana?: string;
};

const MUNICIPALITY_CODE_PATH = resolveMunicipalityCodePath();
const MUNICIPALITY_CODES = loadMunicipalityCodes();

/**
 * 都道府県名と市区町村名に一致する6桁の団体コードを返します。
 * @param {string} prefectureName - 都道府県名。
 * @param {string | null | undefined} municipalityName - 市区町村名。
 * @returns {string | undefined} 一致する市区町村コード、または未解決時のundefined。
 */
export function resolveMunicipalityCode(prefectureName: string, municipalityName?: string | null) {
  if (!municipalityName) return undefined;

  return MUNICIPALITY_CODES.get(createLookupKey(prefectureName, municipalityName))?.code;
}

function loadMunicipalityCodes() {
  const records = parseCsv(readFileSync(MUNICIPALITY_CODE_PATH, "utf8"))
    .slice(1)
    .map(([code, prefectureName, municipalityName, prefectureKana, municipalityKana]) => ({
      code: normalize(code),
      prefectureName: normalize(prefectureName),
      municipalityName: normalize(municipalityName),
      prefectureKana: normalize(prefectureKana),
      municipalityKana: normalize(municipalityKana),
    }))
    .filter((record) => /^\d{6}$/.test(record.code) && Boolean(record.prefectureName));

  const recordsByName = new Map<string, MunicipalityCodeRecord>();
  for (const record of records) {
    if (record.municipalityName)
      recordsByName.set(createLookupKey(record.prefectureName, record.municipalityName), record);
  }

  return recordsByName;
}

function resolveMunicipalityCodePath() {
  const candidates = [
    resolve(process.cwd(), "data", "市区町村コード.csv"),
    resolve(process.cwd(), "../../data", "市区町村コード.csv"),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));

  if (!path) throw new Error("Municipality code CSV was not found.");
  return path;
}

function parseCsv(value: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const nextCharacter = value[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(field);
      if (row.some((item) => item !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((item) => item !== "")) rows.push(row);

  return rows;
}

function normalize(value: string | undefined) {
  return value?.replace(/^\uFEFF/, "").trim() ?? "";
}

function createLookupKey(prefectureName: string, municipalityName: string) {
  return `${prefectureName}\u0000${municipalityName}`;
}
