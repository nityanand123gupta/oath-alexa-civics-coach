/** A single civics question as published by USCIS. */
export interface CivicsQuestion {
  /** Stable id, e.g. "2025-042" */
  id: string;
  /** Official question number within its bank */
  number: number;
  category: string;
  subcategory: string;
  question: string;
  /** Every officially acceptable answer, verbatim from USCIS (parentheticals preserved). */
  acceptableAnswers: string[];
  /** Designated (asterisked) for applicants 65+ with 20+ years as LPR. */
  senior: boolean;
  /** Answer changes over time or by location (current officials, your state, etc.). */
  dynamic: boolean;
  dynamicNote: string | null;
}

export interface Senior6520Mechanics {
  designatedOnly: boolean;
  questionsAsked: number;
  passAt: number;
}

export interface TestMechanics {
  /** Max questions the officer asks. */
  questionsAsked: number;
  /** Correct answers needed to pass (test stops early when reached). */
  passAt: number;
  /** Incorrect answers that end the test as a fail (stops early when reached). */
  failAt: number;
  earlyStop: boolean;
  senior6520: Senior6520Mechanics;
}

export interface QuestionBank {
  version: "2008" | "2025";
  officialSource: string;
  retrieved: string;
  testMechanics: TestMechanics;
  categories: string[];
  questions: CivicsQuestion[];
}

/** Outcome of matching a spoken/typed answer against official answers. */
export type MatchVerdict =
  | { kind: "correct"; matched: string[]; required: number }
  | { kind: "incorrect"; matched: string[]; required: number }
  | { kind: "self_check"; note: string };

/** Per-question learning state. */
export interface QuestionProgress {
  questionId: string;
  attempts: number;
  correct: number;
  /** Estimated probability of answering correctly (0..1). */
  mastery: number;
  /** SM-2 state */
  easiness: number;
  intervalDays: number;
  repetitions: number;
  /** Epoch ms of next due review. */
  dueAt: number;
  lastSeenAt: number | null;
}

export type SessionMode = "practice" | "mock_interview";

export interface ExamState {
  mode: SessionMode;
  version: "2008" | "2025";
  senior6520: boolean;
  /** Question ids in the order they will be asked. */
  questionIds: string[];
  /** Index of the question currently awaiting an answer. */
  cursor: number;
  correct: number;
  incorrect: number;
  finished: boolean;
  result: "pass" | "fail" | null;
  /** Per-question outcomes recorded so far. */
  record: { questionId: string; correct: boolean }[];
}

export interface ReadinessReport {
  version: "2008" | "2025";
  senior6520: boolean;
  simulations: number;
  passProbability: number;
  /** mean correct answers across simulations */
  expectedCorrect: number;
  byCategory: { category: string; mastery: number; questions: number }[];
  weakest: { questionId: string; question: string; mastery: number }[];
  coverage: { seen: number; total: number };
}
