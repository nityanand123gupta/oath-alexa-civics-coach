import { describe, expect, it } from "vitest";
import { getBank, testVersionForFilingDate, qualifies6520 } from "../src/banks.js";
import { matchAnswer } from "../src/matcher.js";

describe("official banks load and validate", () => {
  it("2008 bank: 100 questions, 20 senior-designated", () => {
    const bank = getBank("2008");
    expect(bank.questions.length).toBe(100);
    expect(bank.questions.filter((q) => q.senior).length).toBe(20);
    expect(bank.testMechanics).toMatchObject({ questionsAsked: 10, passAt: 6, failAt: 5 });
  });
  it("2025 bank: 128 questions, 20 senior-designated", () => {
    const bank = getBank("2025");
    expect(bank.questions.length).toBe(128);
    expect(bank.questions.filter((q) => q.senior).length).toBe(20);
    expect(bank.testMechanics).toMatchObject({ questionsAsked: 20, passAt: 12, failAt: 9 });
  });
  it("every question has answers and sequential numbering", () => {
    for (const v of ["2008", "2025"] as const) {
      const bank = getBank(v);
      bank.questions.forEach((q, i) => {
        expect(q.number).toBe(i + 1);
        expect(q.acceptableAnswers.length).toBeGreaterThan(0);
        expect(bank.categories).toContain(q.category);
      });
    }
  });
});

describe("matching against real official answers", () => {
  const b2025 = getBank("2025");
  const b2008 = getBank("2008");

  it("2025 Q1 form of government", () => {
    const q = b2025.questions[0]!;
    expect(matchAnswer(q, "a republic").kind).toBe("correct");
    expect(matchAnswer(q, "representative democracy").kind).toBe("correct");
    expect(matchAnswer(q, "monarchy").kind).toBe("incorrect");
  });

  it("2008 amendments question accepts 27 in words or digits", () => {
    const q = b2008.questions.find((x) => /how many amendments/i.test(x.question))!;
    expect(matchAnswer(q, "twenty seven").kind).toBe("correct");
    expect(matchAnswer(q, "27").kind).toBe("correct");
    expect(matchAnswer(q, "26").kind).toBe("incorrect");
  });

  it("dynamic questions self-check (President)", () => {
    const q = b2008.questions.find((x) => /president of the united states now/i.test(x.question));
    if (q) {
      expect(q.dynamic).toBe(true);
      expect(matchAnswer(q, "anyone").kind).toBe("self_check");
    }
  });

  it("supreme law of the land", () => {
    const q = b2008.questions.find((x) => /supreme law of the land/i.test(x.question))!;
    expect(matchAnswer(q, "the constitution").kind).toBe("correct");
    expect(matchAnswer(q, "the declaration of independence").kind).toBe("incorrect");
  });
});

describe("version + 65/20 policy helpers", () => {
  it("filing-date cutoff Oct 20 2025", () => {
    expect(testVersionForFilingDate("2025-10-19")).toBe("2008");
    expect(testVersionForFilingDate("2025-10-20")).toBe("2025");
    expect(testVersionForFilingDate("2026-01-05")).toBe("2025");
  });
  it("65/20 boundary math", () => {
    expect(qualifies6520("1960-01-01", "2005-06-01", "2026-01-01")).toBe(true); // 66yo, 20.5y LPR
    expect(qualifies6520("1960-01-01", "2007-06-01", "2026-01-01")).toBe(false); // only 18.5y LPR
    expect(qualifies6520("1962-06-01", "2000-01-01", "2026-01-01")).toBe(false); // 63yo
  });
});
