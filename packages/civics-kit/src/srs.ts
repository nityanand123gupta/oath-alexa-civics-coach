import type { QuestionProgress } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Prior probability of a correct answer on a never-seen question. */
export const UNSEEN_MASTERY = 0.35;
/** EWMA learning rate for the mastery estimate. */
const MASTERY_ALPHA = 0.35;

export function newProgress(questionId: string, now: number): QuestionProgress {
  return {
    questionId,
    attempts: 0,
    correct: 0,
    mastery: UNSEEN_MASTERY,
    easiness: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: now,
    lastSeenAt: null,
  };
}

/**
 * SM-2 update. We map voice outcomes to SM-2 quality:
 * correct fast = 5, correct = 4, incorrect-but-close (some matches) = 2, incorrect = 1.
 */
export function sm2Quality(correct: boolean, partialMatches: number): number {
  if (correct) return partialMatches > 0 ? 5 : 4;
  return partialMatches > 0 ? 2 : 1;
}

export function recordAttempt(
  prev: QuestionProgress,
  correct: boolean,
  now: number,
  quality?: number
): QuestionProgress {
  const q = quality ?? sm2Quality(correct, 0);
  let { easiness, intervalDays, repetitions } = prev;

  if (q >= 3) {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easiness);
    repetitions += 1;
  } else {
    repetitions = 0;
    intervalDays = 1;
  }
  easiness = Math.max(1.3, easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const mastery = clamp01(prev.mastery + MASTERY_ALPHA * ((correct ? 1 : 0) - prev.mastery));

  return {
    ...prev,
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    mastery,
    easiness,
    intervalDays,
    repetitions,
    dueAt: now + intervalDays * DAY_MS,
    lastSeenAt: now,
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Questions due for review, most overdue first. */
export function dueQuestions(progress: Map<string, QuestionProgress>, now: number): string[] {
  return [...progress.values()]
    .filter((p) => p.dueAt <= now && p.attempts > 0)
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((p) => p.questionId);
}

/**
 * Pick the next questions for a practice session:
 * due reviews first, then unseen, then weakest.
 */
export function pickPracticeQuestions(
  allIds: string[],
  progress: Map<string, QuestionProgress>,
  count: number,
  now: number,
  rng: () => number
): string[] {
  const due = dueQuestions(progress, now);
  const unseen = allIds.filter((id) => !progress.has(id) || progress.get(id)!.attempts === 0);
  const weakest = [...progress.values()]
    .filter((p) => p.attempts > 0)
    .sort((a, b) => a.mastery - b.mastery)
    .map((p) => p.questionId);

  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (!seen.has(id) && allIds.includes(id)) {
      seen.add(id);
      ordered.push(id);
    }
  };
  due.forEach(push);
  shuffle(unseen, rng).forEach(push);
  weakest.forEach(push);
  return ordered.slice(0, count);
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Deterministic PRNG (mulberry32) for reproducible sampling and tests. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
