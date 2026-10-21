import type { QuestionBank, QuestionProgress, ReadinessReport } from "./types.js";
import { UNSEEN_MASTERY, seededRng, shuffle } from "./srs.js";
import { examThresholds } from "./exam.js";

/**
 * Estimate pass probability by simulating the authentic exam many times:
 * each simulation samples the version-correct number of questions from the
 * eligible pool and plays them as Bernoulli trials at the learner's current
 * per-question mastery, applying the real early-stop thresholds.
 * Seeded for reproducibility.
 */
export function estimateReadiness(
  bank: QuestionBank,
  progress: Map<string, QuestionProgress>,
  opts: { senior6520?: boolean; simulations?: number; seed?: number } = {}
): ReadinessReport {
  const senior = opts.senior6520 ?? false;
  const simulations = opts.simulations ?? 10_000;
  const rng = seededRng(opts.seed ?? 20261023);

  let pool = bank.questions.filter((q) => !q.dynamic);
  if (senior) pool = pool.filter((q) => q.senior);
  const { passAt, failAt, asked } = examThresholds(bank, senior);

  const masteryOf = (qid: string): number =>
    progress.get(qid)?.attempts ? progress.get(qid)!.mastery : UNSEEN_MASTERY;

  let passes = 0;
  let totalCorrect = 0;
  const ids = pool.map((q) => q.id);
  for (let s = 0; s < simulations; s++) {
    const sample = shuffle(ids, rng).slice(0, Math.min(asked, ids.length));
    let correct = 0;
    let incorrect = 0;
    for (const qid of sample) {
      if (rng() < masteryOf(qid)) correct++;
      else incorrect++;
      if (correct >= passAt || incorrect >= failAt) break;
    }
    if (correct >= passAt) passes++;
    totalCorrect += correct;
  }

  const byCategoryMap = new Map<string, { sum: number; n: number }>();
  for (const q of pool) {
    const entry = byCategoryMap.get(q.category) ?? { sum: 0, n: 0 };
    entry.sum += masteryOf(q.id);
    entry.n += 1;
    byCategoryMap.set(q.category, entry);
  }

  const weakest = [...pool]
    .map((q) => ({ questionId: q.id, question: q.question, mastery: masteryOf(q.id) }))
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 5);

  const seen = pool.filter((q) => (progress.get(q.id)?.attempts ?? 0) > 0).length;

  return {
    version: bank.version,
    senior6520: senior,
    simulations,
    passProbability: passes / simulations,
    expectedCorrect: totalCorrect / simulations,
    byCategory: [...byCategoryMap.entries()].map(([category, { sum, n }]) => ({
      category,
      mastery: sum / n,
      questions: n,
    })),
    weakest,
    coverage: { seen, total: pool.length },
  };
}
