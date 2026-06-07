/**
 * Tiny, dependency-free barcode generator for loyalty cards. Produces a vector
 * model (module-unit bar positions) that a Vue component scales to pixels — no
 * canvas, no <img>, no external lib, CSP-clean. Two symbologies:
 *   - EAN-13  (13 numeric digits, or 12 + computed check digit),
 *   - Code128 (anything else: alphanumeric, variable length).
 *
 * "auto" picks EAN-13 for 12/13-digit numeric codes, Code128 otherwise.
 */

export type BarcodeFormat = "ean13" | "code128";

export interface Barcode {
  format: BarcodeFormat;
  /** Human-readable text rendered under the bars. */
  text: string;
  /** Total width in module units (quiet zones included). */
  width: number;
  /** Black bars, positioned in module units. */
  bars: { x: number; w: number }[];
}

const QUIET = 10; // quiet zone, in modules, each side

// ── EAN-13 encoding tables ────────────────────────────────────────────────────
const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const EAN_PARITY = ["OOOOOO", "OOEOEE", "OOEEOE", "OOEEEO", "OEOOEE", "OEEOOE", "OEEEOO", "OEOEOE", "OEOEEO", "OEEOEO"];

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = twelve.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Normalize a numeric code to a valid 13-digit EAN-13 string, or null. */
function toEan13(code: string): string | null {
  if (/^\d{13}$/.test(code)) return code;
  if (/^\d{12}$/.test(code)) return code + String(ean13CheckDigit(code));
  return null;
}

function ean13Modules(thirteen: string): string {
  const first = thirteen.charCodeAt(0) - 48;
  const parity = EAN_PARITY[first] as string;
  let mod = "101"; // start guard
  for (let i = 0; i < 6; i++) {
    const d = thirteen.charCodeAt(i + 1) - 48;
    mod += parity[i] === "O" ? (EAN_L[d] as string) : (EAN_G[d] as string);
  }
  mod += "01010"; // center guard
  for (let i = 0; i < 6; i++) mod += EAN_R[thirteen.charCodeAt(i + 7) - 48] as string;
  mod += "101"; // end guard
  return mod;
}

// ── Code128 encoding (subset B, with subset C for even-length digit strings) ──
// 107 width patterns (values 0..106); each starts with a bar, widths sum to 11
// (the stop value 106 is 13 modules). Concatenation yields a scannable symbol.
const CODE128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const START_B = 104;
const START_C = 105;
const STOP = 106;

function code128Symbols(code: string): number[] {
  const useC = /^\d+$/.test(code) && code.length >= 2 && code.length % 2 === 0;
  const values: number[] = [];
  let start: number;
  if (useC) {
    start = START_C;
    for (let i = 0; i < code.length; i += 2) values.push(Number(code.slice(i, i + 2)));
  } else {
    start = START_B;
    for (let i = 0; i < code.length; i++) {
      const v = code.charCodeAt(i) - 32;
      values.push(v >= 0 && v <= 95 ? v : 0); // clamp non-Latin to space
    }
  }
  let sum = start;
  values.forEach((v, i) => (sum += v * (i + 1)));
  return [start, ...values, sum % 103, STOP];
}

function code128Modules(code: string): string {
  let mod = "";
  for (const sym of code128Symbols(code)) {
    const pattern = CODE128[sym] as string;
    let bar = true;
    for (const w of pattern) {
      mod += (bar ? "1" : "0").repeat(Number(w));
      bar = !bar;
    }
  }
  return mod;
}

/** Convert a module bit-string ("1" = bar) into positioned bars (quiet zone offset). */
function modulesToBars(modules: string): { x: number; w: number }[] {
  const bars: { x: number; w: number }[] = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "1") {
      let j = i + 1;
      while (j < modules.length && modules[j] === "1") j++;
      bars.push({ x: QUIET + i, w: j - i });
      i = j;
    } else {
      i++;
    }
  }
  return bars;
}

/** Resolve "auto" (or an explicit format) to the symbology that will actually be drawn. */
export function resolveFormat(code: string, format: string): BarcodeFormat {
  if (format === "ean13") return toEan13(code) ? "ean13" : "code128";
  if (format === "code128") return "code128";
  // auto
  return /^\d{12}$|^\d{13}$/.test(code) ? "ean13" : "code128";
}

/** Build the vector barcode model, or null when the code is empty. */
export function buildBarcode(code: string, format = "auto"): Barcode | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const resolved = resolveFormat(trimmed, format);

  if (resolved === "ean13") {
    const ean = toEan13(trimmed);
    if (ean) {
      const modules = ean13Modules(ean);
      return { format: "ean13", text: ean, width: modules.length + QUIET * 2, bars: modulesToBars(modules) };
    }
    // Fall through to Code128 if a non-EAN slipped past (e.g. explicit ean13 on text).
  }

  const modules = code128Modules(trimmed);
  return { format: "code128", text: trimmed, width: modules.length + QUIET * 2, bars: modulesToBars(modules) };
}
