/** Text normalization for deterministic answer matching. */

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7",
  eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13",
  fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18",
  nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50",
  sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100",
};

// Compound numbers commonly needed by the banks ("twenty-seven", "sixty-five", "four hundred thirty-five")
const COMPOUND_RE = /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/g;

const SYNONYMS: Record<string, string> = {
  "usa": "united states",
  "us": "united states",
  "america": "united states",
  "potus": "president",
};

/** Lowercase, strip punctuation/diacritics, collapse spaces. */
export function basicNormalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Convert compound and simple number words to digits: "twenty-seven" -> "27". */
export function numbersToDigits(text: string): string {
  let out = text.replace(COMPOUND_RE, (_, tens: string, ones: string) => {
    const t = parseInt(NUMBER_WORDS[tens]!, 10);
    const o = parseInt(NUMBER_WORDS[ones]!, 10);
    return String(t + o);
  });
  // "four hundred thirty five" -> handled loosely: "hundred" word mapping only when standalone
  out = out
    .split(" ")
    .map((w) => NUMBER_WORDS[w] ?? w)
    .join(" ");
  return out;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "and", "or", "is", "are", "was", "were", "it",
  "its", "in", "on", "for", "we", "our", "they", "their", "that", "this",
  "i", "think", "its", "maybe", "um", "uh", "answer",
]);

/** Full normalization pipeline producing comparable token strings. */
export function canonical(input: string): string {
  let text = basicNormalize(input);
  text = numbersToDigits(text);
  // Collapse runs of single letters (initialisms): "d c" -> "dc", "u s a" -> "usa"
  text = text.replace(/\b(?:[a-z] )+[a-z]\b/g, (m) => m.replace(/ /g, ""));
  for (const [from, to] of Object.entries(SYNONYMS)) {
    text = text.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  }
  return text;
}

/** Tokens with stopwords removed (keeps digits). */
export function contentTokens(input: string): string[] {
  return canonical(input)
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/**
 * Expand an official answer string into match variants.
 * USCIS writes answers like "twenty-seven (27)" or "the Constitution" or
 * "freedom of expression". We generate: full string, parenthetical-free,
 * parenthetical-only, article-stripped.
 */
export function expandOfficialAnswer(answer: string): string[] {
  const variants = new Set<string>();
  const raw = answer.trim();
  variants.add(raw);

  // Split parentheticals: "twenty-seven (27)" -> "twenty-seven", "27"
  const paren = raw.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/);
  if (paren) {
    const [, before, inside, after] = paren;
    const outside = `${before} ${after ?? ""}`.trim();
    if (outside) variants.add(outside);
    if (inside) {
      variants.add(inside.trim());
      // inside may itself contain alternatives like "(USA)"
      if (outside) variants.add(`${outside} ${inside}`.trim());
    }
  }

  // Bracketed optional segments: "[U.S.] Constitution"
  const bracket = raw.replace(/\[[^\]]*\]/g, " ").trim();
  if (bracket && bracket !== raw) variants.add(bracket);
  const bracketKept = raw.replace(/[\[\]]/g, " ").trim();
  if (bracketKept !== raw) variants.add(bracketKept);

  const expanded = new Set<string>();
  for (const v of variants) {
    const c = canonical(v);
    if (!c) continue;
    expanded.add(c);
    // article-stripped version
    const stripped = c.replace(/^(the|a|an) /, "");
    if (stripped) expanded.add(stripped);
  }
  return [...expanded];
}
