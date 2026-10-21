import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { QuestionBank } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

function loadBank(file: string): QuestionBank {
  const raw = readFileSync(join(here, "..", "data", file), "utf8");
  const bank = JSON.parse(raw) as QuestionBank;
  validateBank(bank);
  return bank;
}

export function validateBank(bank: QuestionBank): void {
  if (bank.version !== "2008" && bank.version !== "2025") {
    throw new Error(`Unknown bank version: ${bank.version}`);
  }
  const expected = bank.version === "2008" ? 100 : 128;
  if (bank.questions.length !== expected) {
    throw new Error(`Bank ${bank.version} has ${bank.questions.length} questions; expected ${expected}`);
  }
  const ids = new Set<string>();
  for (const q of bank.questions) {
    if (ids.has(q.id)) throw new Error(`Duplicate question id ${q.id}`);
    ids.add(q.id);
    if (!q.question.trim()) throw new Error(`Empty question text for ${q.id}`);
    if (q.acceptableAnswers.length === 0) throw new Error(`No acceptable answers for ${q.id}`);
  }
}

let cache: { [v in "2008" | "2025"]?: QuestionBank } = {};

export function getBank(version: "2008" | "2025"): QuestionBank {
  if (!cache[version]) {
    cache[version] = loadBank(version === "2008" ? "bank-2008.json" : "bank-2025.json");
  }
  return cache[version]!;
}

/**
 * Which test version applies, per USCIS policy: N-400 filed on or after
 * Oct 20, 2025 takes the 2025 test; earlier filings take the 2008 test.
 * Source: Federal Register 2025-18050 (Sept 18, 2025); USCIS Policy Manual Vol. 12 Part E Ch. 2.
 */
export const VERSION_CUTOFF_ISO = "2025-10-20";

export function testVersionForFilingDate(filingDateIso: string): "2008" | "2025" {
  return filingDateIso >= VERSION_CUTOFF_ISO ? "2025" : "2008";
}

/**
 * 65/20 special consideration: 65 or older AND lawful permanent resident
 * for 20+ years at filing → designated questions only, in the applicant's
 * language of choice.
 */
export function qualifies6520(dobIso: string, lprSinceIso: string, filingDateIso: string): boolean {
  const years = (a: string, b: string) => {
    const d1 = new Date(a);
    const d2 = new Date(b);
    let y = d2.getUTCFullYear() - d1.getUTCFullYear();
    const anniversary = new Date(Date.UTC(d1.getUTCFullYear() + y, d1.getUTCMonth(), d1.getUTCDate()));
    if (anniversary > d2) y -= 1;
    return y;
  };
  return years(dobIso, filingDateIso) >= 65 && years(lprSinceIso, filingDateIso) >= 20;
}
