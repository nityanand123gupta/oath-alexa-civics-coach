import type { CivicsQuestion, MatchVerdict } from "./types.js";
import { canonical, contentTokens, expandOfficialAnswer } from "./normalize.js";

/** Dice coefficient over token sets. */
function tokenSetSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let overlap = 0;
  for (const t of setA) if (setB.has(t)) overlap++;
  return (2 * overlap) / (setA.size + setB.size);
}

function hasDigit(s: string): boolean {
  return /\d/.test(s);
}

function digitsOf(s: string): string[] {
  return s.match(/\d+/g) ?? [];
}

/**
 * How many questions does the question text require?
 * USCIS phrasing: "Name one ...", "Name two ...", "Name three ...", "What are two rights ..."
 */
export function requiredMatchCount(questionText: string): number {
  const t = questionText.toLowerCase();
  const m = t.match(/\b(?:name|describe|give|what are|list)\s+(one|two|three|1|2|3)\b/);
  if (!m) return 1;
  const word = m[1]!;
  return word === "two" || word === "2" ? 2 : word === "three" || word === "3" ? 3 : 1;
}

/**
 * Does a user's utterance contain a specific official answer variant?
 * Deterministic: exact match, containment (with guards), or token-set similarity.
 */
export function matchesVariant(userCanonical: string, userTokens: string[], variant: string): boolean {
  if (!variant) return false;
  if (userCanonical === variant) return true;

  const variantTokens = contentTokens(variant);

  // Numeric answers: require the exact number to appear (prevents fuzzy "26"≈"27").
  if (hasDigit(variant)) {
    const need = digitsOf(variant);
    const have = new Set(digitsOf(userCanonical));
    if (need.length > 0 && !need.every((d) => have.has(d))) return false;
    // number present; if the variant is essentially just the number, accept
    if (variantTokens.every((t) => hasDigit(t))) return true;
  }

  // Containment: the full variant phrase appears inside the utterance.
  if (variant.length >= 3 && userCanonical.includes(variant)) return true;

  // Token-set: all content tokens of the variant are present (handles word-order).
  if (variantTokens.length > 0 && variantTokens.every((t) => userTokens.includes(t))) return true;

  // Fuzzy fallback for multi-word answers only (≥2 content tokens): Dice ≥ 0.8
  if (variantTokens.length >= 2 && !hasDigit(variant)) {
    if (tokenSetSimilarity(userTokens, variantTokens) >= 0.8) return true;
  }
  return false;
}

export interface MatchOptions {
  /** Treat dynamic questions as self-check instead of scoring. Default true. */
  dynamicSelfCheck?: boolean;
}

/**
 * Match a user's answer against a question's official acceptable answers.
 * Returns which distinct official answers were matched and whether enough were
 * provided (questions like "Name two rights…" need two distinct answers).
 */
export function matchAnswer(
  question: CivicsQuestion,
  userAnswer: string,
  opts: MatchOptions = {}
): MatchVerdict {
  const dynamicSelfCheck = opts.dynamicSelfCheck ?? true;
  if (question.dynamic && dynamicSelfCheck) {
    return {
      kind: "self_check",
      note:
        question.dynamicNote ??
        "This answer changes over time or depends on where you live. Verify the current answer at uscis.gov/citizenship/testupdates.",
    };
  }

  const userCanonical = canonical(userAnswer);
  const userTokens = contentTokens(userAnswer);
  const required = requiredMatchCount(question.question);

  const matched: string[] = [];
  const matchedCanonicals = new Set<string>();
  for (const official of question.acceptableAnswers) {
    const variants = expandOfficialAnswer(official);
    if (variants.some((v) => matchesVariant(userCanonical, userTokens, v))) {
      // Deduplicate officially-distinct answers that normalize identically
      const key = variants[0] ?? official;
      if (!matchedCanonicals.has(key)) {
        matchedCanonicals.add(key);
        matched.push(official);
      }
    }
  }

  if (matched.length >= required) {
    return { kind: "correct", matched, required };
  }
  return { kind: "incorrect", matched, required };
}
