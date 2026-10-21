import { describe, expect, it } from "vitest";
import { matchAnswer, requiredMatchCount } from "../src/matcher.js";
import { expandOfficialAnswer, canonical } from "../src/normalize.js";
import { FIXTURE_QUESTIONS } from "./fixtures.js";

const byId = (id: string) => FIXTURE_QUESTIONS.find((q) => q.id === id)!;

describe("expandOfficialAnswer", () => {
  it("splits parenthetical numbers into variants", () => {
    const v = expandOfficialAnswer("twenty-seven (27)");
    expect(v).toContain("27");
    expect(v.some((x) => x.includes("27"))).toBe(true);
  });
  it("strips leading articles", () => {
    const v = expandOfficialAnswer("the Constitution");
    expect(v).toContain("constitution");
  });
  it("handles Pacific (Ocean)", () => {
    const v = expandOfficialAnswer("Pacific (Ocean)");
    expect(v).toContain("pacific");
    expect(v).toContain("pacific ocean");
  });
});

describe("matchAnswer — single answer questions", () => {
  it("accepts exact official answer", () => {
    expect(matchAnswer(byId("T-001"), "the Constitution").kind).toBe("correct");
  });
  it("accepts article-free and sentence-embedded answers", () => {
    expect(matchAnswer(byId("T-001"), "constitution").kind).toBe("correct");
    expect(matchAnswer(byId("T-001"), "I think it's the Constitution").kind).toBe("correct");
  });
  it("rejects wrong answers", () => {
    expect(matchAnswer(byId("T-001"), "the Declaration of Independence").kind).toBe("incorrect");
  });
  it("accepts digits or words for numeric answers", () => {
    expect(matchAnswer(byId("T-002"), "27").kind).toBe("correct");
    expect(matchAnswer(byId("T-002"), "twenty seven").kind).toBe("correct");
    expect(matchAnswer(byId("T-002"), "twenty-seven").kind).toBe("correct");
  });
  it("rejects off-by-one numbers (no fuzzy numerics)", () => {
    expect(matchAnswer(byId("T-002"), "26").kind).toBe("incorrect");
    expect(matchAnswer(byId("T-002"), "there are 26 amendments").kind).toBe("incorrect");
  });
  it("accepts any one of several acceptable answers", () => {
    expect(matchAnswer(byId("T-006"), "congress").kind).toBe("correct");
    expect(matchAnswer(byId("T-006"), "the judicial branch").kind).toBe("correct");
  });
  it("word-order tolerant for multi-word answers", () => {
    expect(matchAnswer(byId("T-005"), "economy that is capitalist").kind).toBe("correct");
  });
  it("accepts Washington D.C. with punctuation variants", () => {
    expect(matchAnswer(byId("T-010"), "washington dc").kind).toBe("correct");
  });
});

describe("matchAnswer — multi-answer questions", () => {
  it("requires two distinct rights for 'name two' questions", () => {
    expect(requiredMatchCount(byId("T-003").question)).toBe(2);
    expect(matchAnswer(byId("T-003"), "life").kind).toBe("incorrect");
    expect(matchAnswer(byId("T-003"), "life and liberty").kind).toBe("correct");
  });
  it("requires three states for 'name three' questions", () => {
    expect(requiredMatchCount(byId("T-008").question)).toBe(3);
    expect(matchAnswer(byId("T-008"), "new york and georgia").kind).toBe("incorrect");
    expect(matchAnswer(byId("T-008"), "new york, georgia, and virginia").kind).toBe("correct");
  });
  it("does not double-count the same answer twice", () => {
    expect(matchAnswer(byId("T-003"), "life and life again").kind).toBe("incorrect");
  });
});

describe("matchAnswer — dynamic questions", () => {
  it("returns self_check with the USCIS note", () => {
    const verdict = matchAnswer(byId("T-004"), "anyone");
    expect(verdict.kind).toBe("self_check");
    if (verdict.kind === "self_check") {
      expect(verdict.note).toContain("uscis.gov");
    }
  });
  it("can score dynamically when self-check disabled", () => {
    const verdict = matchAnswer(byId("T-004"), "answers will vary", { dynamicSelfCheck: false });
    expect(verdict.kind).toBe("correct");
  });
});

describe("canonical", () => {
  it("normalizes synonyms and case", () => {
    expect(canonical("U.S.A.")).toBe("united states");
  });
});
