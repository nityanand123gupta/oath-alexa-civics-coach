import { describe, expect, it } from "vitest";
import { advanceExam, createExam, currentQuestionId, examThresholds } from "../src/exam.js";
import { estimateReadiness } from "../src/readiness.js";
import { newProgress, recordAttempt, seededRng } from "../src/srs.js";
import type { QuestionProgress } from "../src/types.js";
import { fixtureBank, fixtureBank2025 } from "./fixtures.js";

describe("exam thresholds", () => {
  it("2008: 10 asked, pass 6, fail 5", () => {
    expect(examThresholds(fixtureBank(), false)).toEqual({ passAt: 6, failAt: 5, asked: 10 });
  });
  it("2025: 20 asked, pass 12, fail 9", () => {
    expect(examThresholds(fixtureBank2025(), false)).toEqual({ passAt: 12, failAt: 9, asked: 20 });
  });
  it("65/20: 10 asked, pass 6", () => {
    expect(examThresholds(fixtureBank2025(), true)).toEqual({ passAt: 6, failAt: 5, asked: 10 });
  });
});

describe("mock interview early stop", () => {
  it("stops as PASS the moment passAt is reached (2008: 6 correct)", () => {
    const bank = fixtureBank();
    let s = createExam(bank, "mock_interview", { rng: seededRng(1) });
    for (let i = 0; i < 6; i++) {
      expect(s.finished).toBe(false);
      s = advanceExam(s, bank, true);
    }
    expect(s.finished).toBe(true);
    expect(s.result).toBe("pass");
    expect(s.correct).toBe(6);
    expect(s.record.length).toBe(6); // early stop — not all 10 asked
  });

  it("stops as FAIL at failAt incorrect (2008: 5 wrong)", () => {
    const bank = fixtureBank();
    let s = createExam(bank, "mock_interview", { rng: seededRng(2) });
    for (let i = 0; i < 5; i++) s = advanceExam(s, bank, false);
    expect(s.finished).toBe(true);
    expect(s.result).toBe("fail");
    expect(s.incorrect).toBe(5);
  });

  it("2025 rules: pass at 12 correct, fail at 9 incorrect", () => {
    const bank = fixtureBank2025();
    let pass = createExam(bank, "mock_interview", { rng: seededRng(3) });
    for (let i = 0; i < 12; i++) pass = advanceExam(pass, bank, true);
    expect(pass.result).toBe("pass");
    expect(pass.record.length).toBe(12);

    let fail = createExam(bank, "mock_interview", { rng: seededRng(4) });
    for (let i = 0; i < 9; i++) fail = advanceExam(fail, bank, false);
    expect(fail.result).toBe("fail");
    expect(fail.record.length).toBe(9);
  });

  it("mixed path: 11 correct + 8 wrong then one more decides", () => {
    const bank = fixtureBank2025();
    let s = createExam(bank, "mock_interview", { rng: seededRng(5) });
    for (let i = 0; i < 11; i++) s = advanceExam(s, bank, true);
    for (let i = 0; i < 8; i++) s = advanceExam(s, bank, false);
    expect(s.finished).toBe(false); // 19 asked, 11/8 — one question left
    s = advanceExam(s, bank, true);
    expect(s.result).toBe("pass");
  });

  it("senior mode samples only designated questions", () => {
    const bank = fixtureBank();
    const s = createExam(bank, "mock_interview", { senior6520: true, rng: seededRng(6) });
    const seniorIds = new Set(bank.questions.filter((q) => q.senior && !q.dynamic).map((q) => q.id));
    expect(s.questionIds.length).toBeGreaterThan(0);
    for (const id of s.questionIds) expect(seniorIds.has(id)).toBe(true);
  });

  it("excludes dynamic questions from mock sampling by default", () => {
    const bank = fixtureBank();
    const s = createExam(bank, "mock_interview", { rng: seededRng(7) });
    expect(s.questionIds).not.toContain("T-004");
  });
});

describe("practice sessions", () => {
  it("creates requested count and advances without result", () => {
    const bank = fixtureBank();
    let s = createExam(bank, "practice", { count: 3, rng: seededRng(8) });
    expect(s.questionIds.length).toBe(3);
    expect(currentQuestionId(s)).toBe(s.questionIds[0]);
    s = advanceExam(s, bank, false);
    s = advanceExam(s, bank, true);
    s = advanceExam(s, bank, true);
    expect(s.finished).toBe(true);
    expect(s.result).toBeNull();
    expect(s.correct).toBe(2);
  });
});

describe("SM-2 progress", () => {
  it("increases interval on success, resets on failure", () => {
    const now = 1_700_000_000_000;
    let p = newProgress("T-001", now);
    p = recordAttempt(p, true, now);
    expect(p.intervalDays).toBe(1);
    p = recordAttempt(p, true, now);
    expect(p.intervalDays).toBe(6);
    p = recordAttempt(p, true, now);
    expect(p.intervalDays).toBeGreaterThan(6);
    const before = p.intervalDays;
    p = recordAttempt(p, false, now);
    expect(p.intervalDays).toBe(1);
    expect(p.repetitions).toBe(0);
    expect(before).toBeGreaterThan(1);
  });
  it("mastery moves toward outcomes", () => {
    const now = 0;
    let p = newProgress("T-001", now);
    const start = p.mastery;
    p = recordAttempt(p, true, now);
    expect(p.mastery).toBeGreaterThan(start);
    p = recordAttempt(p, false, now);
    p = recordAttempt(p, false, now);
    expect(p.mastery).toBeLessThan(start + 0.3);
  });
});

describe("readiness Monte Carlo", () => {
  const mastered = (bank = fixtureBank2025()) => {
    const progress = new Map<string, QuestionProgress>();
    for (const q of bank.questions) {
      progress.set(q.id, { ...newProgress(q.id, 0), attempts: 5, correct: 5, mastery: 0.99 });
    }
    return progress;
  };

  it("is deterministic for a fixed seed", () => {
    const bank = fixtureBank2025();
    const a = estimateReadiness(bank, new Map(), { seed: 42, simulations: 2000 });
    const b = estimateReadiness(bank, new Map(), { seed: 42, simulations: 2000 });
    expect(a.passProbability).toBe(b.passProbability);
    expect(a.expectedCorrect).toBe(b.expectedCorrect);
  });

  it("near-1 when fully mastered, low when unseen", () => {
    const bank = fixtureBank2025();
    const high = estimateReadiness(bank, mastered(bank), { seed: 7, simulations: 3000 });
    expect(high.passProbability).toBeGreaterThan(0.95);
    const low = estimateReadiness(bank, new Map(), { seed: 7, simulations: 3000 });
    expect(low.passProbability).toBeLessThan(0.2); // prior mastery 0.35 vs pass 12/20
  });

  it("reports coverage and weakest questions", () => {
    const bank = fixtureBank2025();
    const progress = new Map<string, QuestionProgress>();
    const q0 = bank.questions[0]!;
    progress.set(q0.id, { ...newProgress(q0.id, 0), attempts: 2, correct: 0, mastery: 0.05 });
    const r = estimateReadiness(bank, progress, { seed: 9, simulations: 500 });
    expect(r.coverage.seen).toBe(1);
    expect(r.weakest[0]!.questionId).toBe(q0.id);
  });
});
