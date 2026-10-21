import type { QuestionBank, CivicsQuestion } from "../src/types.js";

function q(partial: Partial<CivicsQuestion> & Pick<CivicsQuestion, "id" | "number" | "question" | "acceptableAnswers">): CivicsQuestion {
  return {
    category: "American Government",
    subcategory: "Principles",
    senior: false,
    dynamic: false,
    dynamicNote: null,
    ...partial,
  };
}

export const FIXTURE_QUESTIONS: CivicsQuestion[] = [
  q({
    id: "T-001", number: 1,
    question: "What is the supreme law of the land?",
    acceptableAnswers: ["the Constitution"],
    senior: true,
  }),
  q({
    id: "T-002", number: 2,
    question: "How many amendments does the Constitution have?",
    acceptableAnswers: ["twenty-seven (27)"],
  }),
  q({
    id: "T-003", number: 3,
    question: "What are two rights in the Declaration of Independence?",
    acceptableAnswers: ["life", "liberty", "pursuit of happiness"],
  }),
  q({
    id: "T-004", number: 4,
    question: "Who is the President of the United States now?",
    acceptableAnswers: ["Answers will vary."],
    dynamic: true,
    dynamicNote: "Visit uscis.gov/citizenship/testupdates for the current answer.",
    senior: true,
  }),
  q({
    id: "T-005", number: 5,
    question: "What is the economic system in the United States?",
    acceptableAnswers: ["capitalist economy", "market economy"],
    senior: true,
    category: "American History",
  }),
  q({
    id: "T-006", number: 6,
    question: "Name one branch or part of the government.",
    acceptableAnswers: ["Congress", "legislative", "President", "executive", "the courts", "judicial"],
    senior: true,
  }),
  q({
    id: "T-007", number: 7,
    question: "What ocean is on the West Coast of the United States?",
    acceptableAnswers: ["Pacific (Ocean)"],
    senior: true,
    category: "Integrated Civics",
  }),
  q({
    id: "T-008", number: 8,
    question: "There were 13 original states. Name three.",
    acceptableAnswers: ["New Hampshire", "Massachusetts", "Rhode Island", "Connecticut", "New York", "New Jersey", "Pennsylvania", "Delaware", "Maryland", "Virginia", "North Carolina", "South Carolina", "Georgia"],
    category: "American History",
  }),
  q({
    id: "T-009", number: 9,
    question: "When do all men must register for the Selective Service?",
    acceptableAnswers: ["at age eighteen (18)", "between eighteen (18) and twenty-six (26)"],
  }),
  q({
    id: "T-010", number: 10,
    question: "What is the capital of the United States?",
    acceptableAnswers: ["Washington, D.C."],
    senior: true,
  }),
];

export function fixtureBank(overrides: Partial<QuestionBank> = {}): QuestionBank {
  return {
    version: "2008",
    officialSource: "fixture",
    retrieved: "2026-10-21",
    testMechanics: {
      questionsAsked: 10,
      passAt: 6,
      failAt: 5,
      earlyStop: true,
      senior6520: { designatedOnly: true, questionsAsked: 10, passAt: 6 },
    },
    categories: ["American Government", "American History", "Integrated Civics"],
    questions: FIXTURE_QUESTIONS,
    ...overrides,
  };
}

export function fixtureBank2025(): QuestionBank {
  // 20 asked / pass 12 / fail 9 — mechanics of the 2025 test with a larger synthetic pool
  const questions: CivicsQuestion[] = [];
  for (let i = 1; i <= 30; i++) {
    questions.push(
      q({
        id: `F25-${String(i).padStart(3, "0")}`,
        number: i,
        question: `Synthetic question ${i}?`,
        acceptableAnswers: [`answer ${i}`],
        senior: i <= 12,
      })
    );
  }
  return {
    version: "2025",
    officialSource: "fixture",
    retrieved: "2026-10-21",
    testMechanics: {
      questionsAsked: 20,
      passAt: 12,
      failAt: 9,
      earlyStop: true,
      senior6520: { designatedOnly: true, questionsAsked: 10, passAt: 6 },
    },
    categories: ["American Government"],
    questions,
  };
}
