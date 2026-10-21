import type { ExamState, QuestionBank, SessionMode } from "./types.js";
import { shuffle } from "./srs.js";

/**
 * Create an exam/practice session.
 *
 * Mock interviews follow the authentic USCIS mechanics encoded in the bank:
 *  - 2008 test: up to 10 questions, pass at 6 correct, fail at 5 incorrect, early stop.
 *  - 2025 test: 20 questions, pass at 12 correct, fail at 9 incorrect, early stop.
 *  - 65/20 special consideration: designated questions only, 10 asked, pass at 6.
 * Dynamic questions (current officials etc.) are excluded from mock scoring by
 * default — the product surfaces them separately via the dynamic watchlist.
 */
export function createExam(
  bank: QuestionBank,
  mode: SessionMode,
  opts: {
    senior6520?: boolean;
    category?: string;
    count?: number;
    includeDynamic?: boolean;
    orderedIds?: string[];
    rng: () => number;
  }
): ExamState {
  const senior = opts.senior6520 ?? false;
  const mech = bank.testMechanics;

  let pool = bank.questions;
  if (senior) pool = pool.filter((q) => q.senior);
  if (opts.category) pool = pool.filter((q) => q.category === opts.category);
  if (!(opts.includeDynamic ?? false)) pool = pool.filter((q) => !q.dynamic);

  let questionIds: string[];
  if (opts.orderedIds && opts.orderedIds.length > 0) {
    questionIds = opts.orderedIds;
  } else if (mode === "mock_interview") {
    const asked = senior ? mech.senior6520.questionsAsked : mech.questionsAsked;
    questionIds = shuffle(pool.map((q) => q.id), opts.rng).slice(0, asked);
  } else {
    const count = opts.count ?? 5;
    questionIds = shuffle(pool.map((q) => q.id), opts.rng).slice(0, count);
  }

  return {
    mode,
    version: bank.version,
    senior6520: senior,
    questionIds,
    cursor: 0,
    correct: 0,
    incorrect: 0,
    finished: questionIds.length === 0,
    result: null,
    record: [],
  };
}

export function examThresholds(bank: QuestionBank, senior: boolean): { passAt: number; failAt: number; asked: number } {
  const mech = bank.testMechanics;
  if (senior) {
    const { questionsAsked, passAt } = mech.senior6520;
    return { passAt, failAt: questionsAsked - passAt + 1, asked: questionsAsked };
  }
  return { passAt: mech.passAt, failAt: mech.failAt, asked: mech.questionsAsked };
}

export function currentQuestionId(state: ExamState): string | null {
  if (state.finished || state.cursor >= state.questionIds.length) return null;
  return state.questionIds[state.cursor] ?? null;
}

/**
 * Record an answer outcome and advance the session.
 * In mock mode, applies the authentic early-stop rules.
 */
export function advanceExam(state: ExamState, bank: QuestionBank, wasCorrect: boolean): ExamState {
  if (state.finished) return state;
  const qid = currentQuestionId(state);
  if (!qid) return { ...state, finished: true };

  const next: ExamState = {
    ...state,
    correct: state.correct + (wasCorrect ? 1 : 0),
    incorrect: state.incorrect + (wasCorrect ? 0 : 1),
    cursor: state.cursor + 1,
    record: [...state.record, { questionId: qid, correct: wasCorrect }],
  };

  if (state.mode === "mock_interview") {
    const { passAt, failAt } = examThresholds(bank, state.senior6520);
    if (next.correct >= passAt) {
      next.finished = true;
      next.result = "pass";
      return next;
    }
    if (next.incorrect >= failAt) {
      next.finished = true;
      next.result = "fail";
      return next;
    }
  }

  if (next.cursor >= next.questionIds.length) {
    next.finished = true;
    if (state.mode === "mock_interview") {
      const { passAt } = examThresholds(bank, state.senior6520);
      next.result = next.correct >= passAt ? "pass" : "fail";
    }
  }
  return next;
}
