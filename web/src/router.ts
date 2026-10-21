/**
 * Deterministic intent router for the simulated Alexa+ surface.
 * Maps utterances to MCP tool calls — reproducible and offline-safe, the way
 * a production assistant front-end would gate a regulated study tool.
 */

export type Routed =
  | { kind: "tool"; name: string; args: Record<string, unknown>; local?: undefined }
  | { kind: "local"; action: "setup" | "protocol" | "stop" | "help" | "repeat" }
  | { kind: "answer"; answer: string };

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

export function parseSpokenDate(text: string): string | null {
  const t = text.toLowerCase();
  // ISO already
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0]!;
  // "january 15 2026" / "january 15th, 2026"
  const mdy = t.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (mdy) {
    const mm = MONTHS[mdy[1]!]!;
    return `${mdy[3]}-${mm}-${String(parseInt(mdy[2]!, 10)).padStart(2, "0")}`;
  }
  // "15 january 2026"
  const dmy = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december),?\s+(\d{4})/);
  if (dmy) {
    const mm = MONTHS[dmy[2]!]!;
    return `${dmy[3]}-${mm}-${String(parseInt(dmy[1]!, 10)).padStart(2, "0")}`;
  }
  // "january 2026" -> first of month
  const my = t.match(/(january|february|march|april|may|june|july|august|september|october|november|december),?\s+(\d{4})/);
  if (my) return `${my[2]}-${MONTHS[my[1]!]}-01`;
  return null;
}

export function route(utterance: string, inSession: boolean): Routed {
  const t = utterance.toLowerCase().trim();

  // global commands work even mid-session
  if (/^(stop|cancel|end|quit|finish)( the)?( session| practice| interview| quiz)?$/.test(t)) {
    return { kind: "local", action: "stop" };
  }
  if (/protocol|show.*(traffic|json|rpc)/.test(t)) return { kind: "local", action: "protocol" };

  if (!inSession) {
    if (/mock|interview me|real test|simulate|like the officer|officer/.test(t)) {
      return { kind: "tool", name: "start_practice", args: { mode: "mock_interview" } };
    }
    if (/practice|drill|quiz|study session|let'?s (go|study|train)|ask me/.test(t)) {
      const n = t.match(/(\d{1,2})\s+questions?/);
      const args: Record<string, unknown> = { mode: "practice" };
      if (n) args.count = Math.min(20, Math.max(1, parseInt(n[1]!, 10)));
      return { kind: "tool", name: "start_practice", args };
    }
    if (/ready|readiness|pass probability|chances|how (am i|likely)/.test(t)) {
      return { kind: "tool", name: "get_readiness", args: {} };
    }
    if (/plan|what should i study|today'?s (work|study)|schedule/.test(t)) {
      return { kind: "tool", name: "get_study_plan", args: {} };
    }
    if (/watch ?list|dynamic|changes? over time|current (officials?|president)/.test(t)) {
      return { kind: "tool", name: "dynamic_watchlist", args: {} };
    }
    const explain = t.match(/(?:explain|about|tell me about)\s+(?:question\s+)?(?:number\s+)?(\d{1,3})/);
    if (explain) {
      return { kind: "tool", name: "explain_question", args: { questionNumber: parseInt(explain[1]!, 10) } };
    }
    if (/profile|my (info|settings|progress|status)|who am i/.test(t)) {
      return { kind: "tool", name: "get_profile", args: {} };
    }
    if (/spanish|español/.test(t)) return { kind: "tool", name: "update_profile", args: { explanationLanguage: "es" } };
    if (/hindi|हिन्दी/.test(t)) return { kind: "tool", name: "update_profile", args: { explanationLanguage: "hi" } };
    if (/english explanations?/.test(t)) return { kind: "tool", name: "update_profile", args: { explanationLanguage: "en" } };

    if (/i filed|filing date|my n-?400/.test(t)) {
      const date = parseSpokenDate(t);
      if (date) return { kind: "tool", name: "update_profile", args: { filingDate: date } };
      return { kind: "local", action: "setup" };
    }
    if (/my interview is|interview date/.test(t)) {
      const date = parseSpokenDate(t);
      if (date) return { kind: "tool", name: "update_profile", args: { interviewDate: date } };
      return { kind: "local", action: "setup" };
    }
    if (/set ?up|settings|configure|get started|onboard/.test(t)) return { kind: "local", action: "setup" };
    if (/help|what can you do/.test(t)) return { kind: "local", action: "help" };

    // Unrecognized outside a session → help
    return { kind: "local", action: "help" };
  }

  // In-session: repeats and explanation requests pass through,
  // everything else is treated as the learner's answer.
  if (/^(repeat( the question)?|say (that |it )?again|pardon( me)?|one more time)$/.test(t)) {
    return { kind: "local", action: "repeat" };
  }
  const explainNow = t.match(/^explain(?: that| this| it)?$/);
  if (explainNow) return { kind: "tool", name: "explain_question", args: {} };
  return { kind: "answer", answer: utterance };
}

export const HELP_TEXT =
  'Here\'s what you can say: "practice five questions" for a spaced-repetition drill, "give me a mock interview" for the real exam simulation, "am I ready?" for your pass probability, "study plan" for today\'s pacing, "watchlist" for answers that change with elections, "explain question 27", or "Spanish explanations". During a session, just say your answer out loud.';
