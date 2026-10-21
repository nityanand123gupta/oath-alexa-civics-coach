import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  advanceExam,
  createExam,
  currentQuestionId,
  estimateReadiness,
  examThresholds,
  getBank,
  matchAnswer,
  newProgress,
  pickPracticeQuestions,
  qualifies6520,
  recordAttempt,
  requiredMatchCount,
  seededRng,
  sm2Quality,
  testVersionForFilingDate,
  dueQuestions,
  type CivicsQuestion,
  type ExamState,
  type QuestionBank,
} from "@oath/civics-kit";
import type { Store } from "./store.js";
import { explainQuestion } from "./explanation.js";
import { READINESS_VIEW_URI, RESOURCE_URI_META_KEY, registerAppViews } from "./apps.js";

export interface McpDeps {
  store: Store;
  now?: () => number;
  seed?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Build one Oath MCP server instance. One instance is created per MCP session. */
export function buildMcpServer(deps: McpDeps): McpServer {
  const { store } = deps;
  const now = deps.now ?? (() => Date.now());
  const rng = seededRng(deps.seed ?? (now() % 2147483647));

  // -------- per-session conversation state --------
  let activeExam: ExamState | null = null;
  let lastQuestionId: string | null = null;

  const server = new McpServer(
    { name: "oath-civics-coach", version: "1.0.0" },
    {
      instructions:
        "Oath is a US naturalization (citizenship) interview coach. Use start_practice to begin a spoken drill or an authentic mock interview, answer_question to submit the user's spoken answer, get_readiness for an evidence-based pass-probability estimate, and update_profile to set the N-400 filing date (which determines whether the 2008 or 2025 civics test applies), interview date, and 65/20 eligibility. Dynamic questions (current officials) are never scored — surface dynamic_watchlist before the interview. Oath is a study tool, not legal advice.",
    }
  );

  // -------- helpers --------
  function profileContext() {
    const p = store.profile;
    const version = p.filingDate ? testVersionForFilingDate(p.filingDate) : "2025";
    const senior =
      p.dateOfBirth && p.lprSince && p.filingDate
        ? qualifies6520(p.dateOfBirth, p.lprSince, p.filingDate)
        : false;
    const daysToInterview = p.interviewDate
      ? Math.ceil((Date.parse(p.interviewDate) - now()) / DAY_MS)
      : null;
    return { profile: p, version, senior, daysToInterview } as const;
  }

  function bankFor(version: "2008" | "2025"): QuestionBank {
    return getBank(version);
  }

  function questionById(bank: QuestionBank, id: string): CivicsQuestion {
    const q = bank.questions.find((x) => x.id === id);
    if (!q) throw new Error(`Unknown question id ${id}`);
    return q;
  }

  function questionCard(bank: QuestionBank, state: ExamState) {
    const qid = currentQuestionId(state);
    if (!qid) return null;
    const q = questionById(bank, qid);
    const thresholds =
      state.mode === "mock_interview" ? examThresholds(bank, state.senior6520) : null;
    return {
      type: "question" as const,
      mode: state.mode,
      version: state.version,
      questionNumber: q.number,
      question: q.question,
      category: q.category,
      asked: state.cursor + 1,
      totalPlanned: state.questionIds.length,
      correctSoFar: state.correct,
      incorrectSoFar: state.incorrect,
      history: state.record.map((r) => r.correct),
      passAt: thresholds?.passAt ?? null,
      failAt: thresholds?.failAt ?? null,
    };
  }

  function speakQuestion(bank: QuestionBank, state: ExamState): string {
    const card = questionCard(bank, state);
    if (!card) return "";
    return `Question ${card.asked} of ${card.totalPlanned}: ${card.question}`;
  }

  function finishSummary(bank: QuestionBank, state: ExamState) {
    const missed = state.record
      .filter((r) => !r.correct)
      .map((r) => {
        const q = questionById(bank, r.questionId);
        return { number: q.number, question: q.question, officialAnswers: q.acceptableAnswers };
      });
    return {
      type: "session_summary" as const,
      mode: state.mode,
      version: state.version,
      result: state.result,
      asked: state.record.length,
      correct: state.correct,
      incorrect: state.incorrect,
      missed,
    };
  }

  const sessionSummaryShape = {
    type: z.literal("session_summary"),
    mode: z.enum(["practice", "mock_interview"]),
    version: z.string(),
    result: z.enum(["pass", "fail"]).nullable(),
    asked: z.number(),
    correct: z.number(),
    incorrect: z.number(),
    missed: z.array(
      z.object({ number: z.number(), question: z.string(), officialAnswers: z.array(z.string()) })
    ),
  };

  const questionCardSchema = z
    .object({
      type: z.literal("question"),
      mode: z.enum(["practice", "mock_interview"]),
      version: z.string(),
      questionNumber: z.number(),
      question: z.string(),
      category: z.string(),
      asked: z.number(),
      totalPlanned: z.number(),
      correctSoFar: z.number(),
      incorrectSoFar: z.number(),
      history: z.array(z.boolean()),
      passAt: z.number().nullable(),
      failAt: z.number().nullable(),
    })
    .nullable();

  // -------- tools --------

  server.registerTool(
    "get_profile",
    {
      title: "Get learner profile & progress",
      description:
        "Returns the learner's profile (N-400 filing date, interview date, 65/20 status), which civics test version applies (2008 vs 2025), and overall study progress.",
      inputSchema: {},
      outputSchema: {
        type: z.literal("profile"),
        displayName: z.string(),
        filingDate: z.string().nullable(),
        interviewDate: z.string().nullable(),
        daysToInterview: z.number().nullable(),
        testVersion: z.enum(["2008", "2025"]),
        senior6520: z.boolean(),
        explanationLanguage: z.string(),
        questionsSeen: z.number(),
        bankSize: z.number(),
        lastMock: z
          .object({ result: z.enum(["pass", "fail"]), correct: z.number(), incorrect: z.number(), at: z.number() })
          .nullable(),
      },
    },
    async () => {
      const { profile, version, senior, daysToInterview } = profileContext();
      const bank = bankFor(version);
      const progress = store.progressMap();
      const seen = bank.questions.filter((q) => (progress.get(q.id)?.attempts ?? 0) > 0).length;
      const lastMockRaw = store.mockResults.at(-1) ?? null;
      const lastMock = lastMockRaw
        ? { result: lastMockRaw.result, correct: lastMockRaw.correct, incorrect: lastMockRaw.incorrect, at: lastMockRaw.at }
        : null;
      const structured = {
        type: "profile" as const,
        displayName: profile.displayName,
        filingDate: profile.filingDate,
        interviewDate: profile.interviewDate,
        daysToInterview,
        testVersion: version,
        senior6520: senior,
        explanationLanguage: profile.explanationLanguage,
        questionsSeen: seen,
        bankSize: bank.questions.length,
        lastMock,
      };
      const versionLine = profile.filingDate
        ? `Because your N-400 was filed ${profile.filingDate}, the ${version} civics test applies (${bank.testMechanics.questionsAsked} questions asked, ${bank.testMechanics.passAt} correct to pass).`
        : `No filing date set yet — defaulting to the ${version} test. Tell me when you filed (or will file) your N-400 and I'll configure the right exam.`;
      return {
        content: [
          {
            type: "text",
            text: `${versionLine} You've practiced ${seen} of ${bank.questions.length} questions.${
              daysToInterview != null ? ` Your interview is in ${daysToInterview} days.` : ""
            }${senior ? " You qualify for the 65/20 designated-questions test." : ""}`,
          },
        ],
        structuredContent: structured,
      };
    }
  );

  server.registerTool(
    "update_profile",
    {
      title: "Update learner profile",
      description:
        "Set the N-400 filing date (determines 2008 vs 2025 test version — cutoff Oct 20, 2025), interview date, date of birth and green-card date (for 65/20 eligibility), preferred explanation language (en, es, hi), or display name.",
      inputSchema: {
        filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("ISO date the N-400 was or will be filed"),
        interviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        lprSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Date the user became a lawful permanent resident"),
        explanationLanguage: z.enum(["en", "es", "hi"]).optional(),
        displayName: z.string().max(60).optional(),
      },
      outputSchema: {
        type: z.literal("profile_updated"),
        testVersion: z.enum(["2008", "2025"]),
        senior6520: z.boolean(),
        daysToInterview: z.number().nullable(),
      },
    },
    async (args) => {
      store.updateProfile(args);
      const { version, senior, daysToInterview } = profileContext();
      const bank = bankFor(version);
      return {
        content: [
          {
            type: "text",
            text: `Got it. You'll take the ${version} civics test: ${bank.testMechanics.questionsAsked} questions, ${bank.testMechanics.passAt} correct to pass${
              senior ? ", and you qualify for the 65/20 designated questions" : ""
            }.${daysToInterview != null ? ` ${daysToInterview} days until your interview.` : ""}`,
          },
        ],
        structuredContent: { type: "profile_updated" as const, testVersion: version, senior6520: senior, daysToInterview },
      };
    }
  );

  server.registerTool(
    "start_practice",
    {
      title: "Start practice or mock interview",
      description:
        "Starts a spoken civics session. mode 'practice' = spaced-repetition drill (due reviews first, then new, then weakest). mode 'mock_interview' = authentic USCIS simulation with the real stopping rules for the learner's test version (2008: up to 10 asked, pass at 6; 2025: up to 20 asked, pass at 12, fail at 9).",
      inputSchema: {
        mode: z.enum(["practice", "mock_interview"]).default("practice"),
        count: z.number().int().min(1).max(20).optional().describe("Practice-mode question count (default 5)"),
        category: z.string().optional().describe("Limit practice to one official category"),
      },
      outputSchema: {
        started: z.literal(true),
        mode: z.enum(["practice", "mock_interview"]),
        version: z.string(),
        senior6520: z.boolean(),
        totalPlanned: z.number(),
        card: questionCardSchema,
      },
    },
    async ({ mode, count, category }) => {
      const { version, senior } = profileContext();
      const bank = bankFor(version);

      if (category && !bank.categories.includes(category)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `"${category}" isn't an official category. The ${version} test categories are: ${bank.categories.join(", ")}.`,
            },
          ],
        };
      }

      let orderedIds: string[] | undefined;
      if (mode === "practice") {
        let pool = bank.questions.filter((q) => !q.dynamic);
        if (senior) pool = pool.filter((q) => q.senior);
        if (category) pool = pool.filter((q) => q.category === category);
        orderedIds = pickPracticeQuestions(
          pool.map((q) => q.id),
          store.progressMap(),
          count ?? 5,
          now(),
          rng
        );
      }

      activeExam = createExam(bank, mode, { senior6520: senior, category, count, orderedIds, rng });
      lastQuestionId = currentQuestionId(activeExam);

      if (activeExam.finished) {
        return {
          isError: true,
          content: [{ type: "text", text: "No questions available for that selection." }],
        };
      }

      const card = questionCard(bank, activeExam);
      const intro =
        mode === "mock_interview"
          ? senior
            ? `Starting your 65/20 mock interview: up to ${activeExam.questionIds.length} designated questions, ${examThresholds(bank, true).passAt} correct to pass. Just like the real thing, we stop early once you pass or fail. `
            : `Starting a ${version} mock interview: I'll ask up to ${activeExam.questionIds.length} questions. ${examThresholds(bank, false).passAt} correct passes; ${examThresholds(bank, false).failAt} wrong ends it — exactly like the real interview. `
          : `Let's practice. ${activeExam.questionIds.length} questions, weakest and due topics first. `;
      return {
        content: [{ type: "text", text: `${intro}${speakQuestion(bank, activeExam)}` }],
        structuredContent: {
          started: true as const,
          mode,
          version,
          senior6520: senior,
          totalPlanned: activeExam.questionIds.length,
          card,
        },
      };
    }
  );

  server.registerTool(
    "answer_question",
    {
      title: "Submit a spoken answer",
      description:
        "Scores the learner's answer to the current question against the official USCIS acceptable answers (deterministic matching — no AI guessing). In practice mode, returns the verdict, official answers and an explanation, then the next question. In mock-interview mode, behaves like the real officer: records the result, stops early at the pass/fail thresholds, and saves the debrief for the end. Say 'I don't know' to pass on a question.",
      inputSchema: {
        answer: z.string().min(1).max(500).describe("The learner's spoken answer, transcribed"),
      },
      outputSchema: {
        type: z.literal("verdict"),
        correct: z.boolean().nullable(),
        matched: z.array(z.string()),
        required: z.number(),
        officialAnswers: z.array(z.string()),
        explanation: z.string().nullable(),
        selfCheckNote: z.string().nullable(),
        finished: z.boolean(),
        result: z.enum(["pass", "fail"]).nullable(),
        nextCard: questionCardSchema,
        summary: z.object(sessionSummaryShape).nullable(),
      },
    },
    async ({ answer }) => {
      if (!activeExam || activeExam.finished) {
        return {
          isError: true,
          content: [
            { type: "text", text: "There's no active session. Say 'start practice' or 'give me a mock interview' first." },
          ],
        };
      }
      const bank = bankFor(activeExam.version as "2008" | "2025");
      const qid = currentQuestionId(activeExam)!;
      const q = questionById(bank, qid);
      lastQuestionId = qid;

      const gaveUp = /^(i\s*)?(don'?t|do not)\s*know|^no\s*idea|^pass$|^skip/i.test(answer.trim());
      const verdict = gaveUp
        ? ({ kind: "incorrect", matched: [], required: requiredMatchCount(q.question) } as const)
        : matchAnswer(q, answer);

      // Dynamic questions are presented in practice flows only via watchlist; if one
      // slipped in (includeDynamic), treat as self-check and don't score.
      if (verdict.kind === "self_check") {
        activeExam = advanceExam(activeExam, bank, true); // advance without penalty
        const nextCard = activeExam.finished ? null : questionCard(bank, activeExam);
        return {
          content: [
            {
              type: "text",
              text: `That one changes over time, so I won't score it. ${verdict.note} ${
                activeExam.finished ? "" : speakQuestion(bank, activeExam)
              }`,
            },
          ],
          structuredContent: {
            type: "verdict" as const,
            correct: null,
            matched: [],
            required: 1,
            officialAnswers: q.acceptableAnswers,
            explanation: null,
            selfCheckNote: verdict.note,
            finished: activeExam.finished,
            result: activeExam.result,
            nextCard,
            summary: activeExam.finished ? finishSummary(bank, activeExam) : null,
          },
        };
      }

      const wasCorrect = verdict.kind === "correct";

      // learning state updates in both modes
      const prev = store.getProgress(qid) ?? newProgress(qid, now());
      store.setProgress(recordAttempt(prev, wasCorrect, now(), sm2Quality(wasCorrect, verdict.matched.length)));

      activeExam = advanceExam(activeExam, bank, wasCorrect);
      const finished = activeExam.finished;
      const summary = finished ? finishSummary(bank, activeExam) : null;

      if (finished && activeExam.mode === "mock_interview" && activeExam.result) {
        store.recordMockResult({
          at: now(),
          version: activeExam.version,
          result: activeExam.result,
          correct: activeExam.correct,
          incorrect: activeExam.incorrect,
        });
      }

      const isMock = activeExam.mode === "mock_interview";
      let spoken: string;
      if (isMock) {
        const ack = wasCorrect ? "Okay." : "Okay, noted.";
        if (finished) {
          const r = activeExam.result;
          spoken =
            r === "pass"
              ? `${ack} That's ${activeExam.correct} correct — you've passed this mock interview! In the real interview the officer stops right here. You answered ${activeExam.record.length} questions; I've saved your debrief.`
              : `${ack} That's ${activeExam.incorrect} incorrect, which ends this mock — same as the real interview. Don't worry: the debrief shows exactly what to review.`;
        } else {
          spoken = `${ack} ${speakQuestion(bank, activeExam)}`;
        }
        return {
          content: [{ type: "text", text: spoken }],
          structuredContent: {
            type: "verdict" as const,
            correct: wasCorrect,
            matched: verdict.matched,
            required: verdict.required,
            officialAnswers: finished ? q.acceptableAnswers : [], // officers don't correct you mid-exam
            explanation: null,
            selfCheckNote: null,
            finished,
            result: activeExam.result,
            nextCard: finished ? null : questionCard(bank, activeExam),
            summary,
          },
        };
      }

      // practice mode: teach immediately
      const explanation = explainQuestion(q, store.profile.explanationLanguage, verdict.required);
      const praise = wasCorrect
        ? verdict.matched.length > 1
          ? `Yes — "${verdict.matched.join('" and "')}" are both right.`
          : `Correct.`
        : gaveUp
          ? `No problem — this is exactly what practice is for.`
          : `Not quite.`;
      const teach = wasCorrect ? "" : ` The official answer${q.acceptableAnswers.length > 1 ? "s are" : " is"}: ${q.acceptableAnswers.slice(0, 4).join("; ")}${q.acceptableAnswers.length > 4 ? "; and more" : ""}.`;
      const next = finished
        ? ` That's the end of this drill: ${activeExam.correct} of ${activeExam.record.length} correct. Ask me "am I ready?" to see your pass probability.`
        : ` ${speakQuestion(bank, activeExam)}`;

      return {
        content: [{ type: "text", text: `${praise}${teach}${next}` }],
        structuredContent: {
          type: "verdict" as const,
          correct: wasCorrect,
          matched: verdict.matched,
          required: verdict.required,
          officialAnswers: q.acceptableAnswers,
          explanation,
          selfCheckNote: null,
          finished,
          result: null,
          nextCard: finished ? null : questionCard(bank, activeExam),
          summary,
        },
      };
    }
  );

  server.registerTool(
    "get_readiness",
    {
      title: "Estimate interview readiness",
      description:
        "Runs a seeded Monte Carlo simulation (default 10,000 runs) of the learner's actual upcoming exam — correct version, question counts, and early-stop rules — against their measured per-question mastery. Returns pass probability, category breakdown, weakest questions, and coverage.",
      // MCP Apps (SEP-1865): hosts that support ui:// views render the
      // server-shipped readiness dashboard for this tool's results.
      _meta: { [RESOURCE_URI_META_KEY]: READINESS_VIEW_URI },
      inputSchema: {
        simulations: z.number().int().min(100).max(50000).optional(),
      },
      outputSchema: {
        type: z.literal("readiness"),
        version: z.string(),
        senior6520: z.boolean(),
        passProbability: z.number(),
        expectedCorrect: z.number(),
        simulations: z.number(),
        coverage: z.object({ seen: z.number(), total: z.number() }),
        byCategory: z.array(z.object({ category: z.string(), mastery: z.number(), questions: z.number() })),
        weakest: z.array(z.object({ questionId: z.string(), question: z.string(), mastery: z.number() })),
      },
    },
    async ({ simulations }) => {
      const { version, senior } = profileContext();
      const bank = bankFor(version);
      const report = estimateReadiness(bank, store.progressMap(), {
        senior6520: senior,
        simulations: simulations ?? 10000,
      });
      const { passAt, asked } = examThresholds(bank, senior);
      const verdictLine =
        report.passProbability >= 0.9
          ? "You're in great shape."
          : report.passProbability >= 0.7
            ? "You're close — keep drilling the weak spots."
            : report.coverage.seen < report.coverage.total / 4
              ? "Too early to tell — we've only covered a small part of the bank, so this estimate assumes typical knowledge of the rest."
              : "Not ready yet — but the plan below targets exactly what's weak.";
      return {
        content: [
          {
            type: "text",
            text: `I simulated your real ${version} exam ${report.simulations.toLocaleString()} times (${asked} asked, ${passAt} to pass, with early stopping). You pass ${fmtPct(report.passProbability)} of the time, averaging ${report.expectedCorrect.toFixed(1)} correct. ${verdictLine} You've practiced ${report.coverage.seen} of ${report.coverage.total} scoreable questions.`,
          },
        ],
        structuredContent: { type: "readiness" as const, ...report },
      };
    }
  );

  server.registerTool(
    "get_study_plan",
    {
      title: "Get today's study plan",
      description:
        "Spaced-repetition plan: how many reviews are due now, how many new questions to introduce, and the pace needed to cover the full bank before the interview date.",
      inputSchema: {},
      outputSchema: {
        type: z.literal("study_plan"),
        dueNow: z.number(),
        unseen: z.number(),
        suggestedNewToday: z.number(),
        daysToInterview: z.number().nullable(),
        paceOk: z.boolean().nullable(),
        message: z.string(),
      },
    },
    async () => {
      const { version, senior, daysToInterview } = profileContext();
      const bank = bankFor(version);
      let pool = bank.questions.filter((q) => !q.dynamic);
      if (senior) pool = pool.filter((q) => q.senior);
      const progress = store.progressMap();
      const due = dueQuestions(progress, now()).filter((id) => pool.some((q) => q.id === id));
      const unseen = pool.filter((q) => (progress.get(q.id)?.attempts ?? 0) === 0).length;

      let suggestedNewToday = Math.min(unseen, 10);
      let paceOk: boolean | null = null;
      if (daysToInterview != null && daysToInterview > 0) {
        const needed = Math.ceil(unseen / daysToInterview);
        suggestedNewToday = Math.min(unseen, Math.max(needed, 5));
        paceOk = needed <= 15;
      }
      const message =
        daysToInterview != null
          ? paceOk
            ? `With ${daysToInterview} days left, ${suggestedNewToday} new questions a day plus your reviews covers everything in time.`
            : `With ${daysToInterview} days left you'd need ${suggestedNewToday} new questions a day — tight, but doable with two short sessions daily.`
          : `No interview date set — tell me when it is and I'll pace you. For now: clear your ${due.length} due reviews, then ${suggestedNewToday} new questions.`;
      return {
        content: [
          {
            type: "text",
            text: `${due.length} reviews are due now and ${unseen} questions are still new. ${message}`,
          },
        ],
        structuredContent: {
          type: "study_plan" as const,
          dueNow: due.length,
          unseen,
          suggestedNewToday,
          daysToInterview,
          paceOk,
          message,
        },
      };
    }
  );

  server.registerTool(
    "explain_question",
    {
      title: "Explain a question",
      description:
        "Explains a civics question: all official acceptable answers, how many are required, dynamic-answer warnings, and category context — localized to the learner's explanation language (en/es/hi). Defaults to the most recent question if no number given.",
      inputSchema: {
        questionNumber: z.number().int().min(1).max(128).optional(),
      },
      outputSchema: {
        type: z.literal("explanation"),
        questionNumber: z.number(),
        question: z.string(),
        officialAnswers: z.array(z.string()),
        explanation: z.string(),
        dynamic: z.boolean(),
        senior: z.boolean(),
        category: z.string(),
      },
    },
    async ({ questionNumber }) => {
      const { version } = profileContext();
      const bank = bankFor(version);
      // Exam integrity: never reveal the current question's answers mid-mock.
      if (
        activeExam &&
        activeExam.mode === "mock_interview" &&
        !activeExam.finished &&
        (questionNumber == null ||
          bank.questions.find((x) => x.number === questionNumber)?.id === currentQuestionId(activeExam))
      ) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Not during a mock interview — the real officer won't explain either! Answer as best you can; you'll get a full debrief with every official answer when we finish.",
            },
          ],
        };
      }
      let q: CivicsQuestion | undefined;
      if (questionNumber != null) {
        q = bank.questions.find((x) => x.number === questionNumber);
      } else if (lastQuestionId) {
        q = bank.questions.find((x) => x.id === lastQuestionId);
      }
      if (!q) {
        return {
          isError: true,
          content: [
            { type: "text", text: questionNumber != null ? `The ${version} test has no question ${questionNumber}.` : "No recent question to explain — ask me about a specific question number." },
          ],
        };
      }
      const required = requiredMatchCount(q.question);
      const explanation = explainQuestion(q, store.profile.explanationLanguage, required);
      return {
        content: [{ type: "text", text: `Question ${q.number}: ${q.question} ${explanation}` }],
        structuredContent: {
          type: "explanation" as const,
          questionNumber: q.number,
          question: q.question,
          officialAnswers: q.acceptableAnswers,
          explanation,
          dynamic: q.dynamic,
          senior: q.senior,
          category: q.category,
        },
      };
    }
  );

  server.registerTool(
    "dynamic_watchlist",
    {
      title: "Dynamic-answer watchlist",
      description:
        "Lists the questions whose answers change over time or depend on where the learner lives (current President, governor, senators, state capital…). Oath never scores these — instead it tells the learner exactly what to verify on uscis.gov before interview day.",
      inputSchema: {},
      outputSchema: {
        type: z.literal("watchlist"),
        version: z.string(),
        items: z.array(
          z.object({
            number: z.number(),
            question: z.string(),
            note: z.string(),
          })
        ),
        checkUrl: z.string(),
      },
    },
    async () => {
      const { version } = profileContext();
      const bank = bankFor(version);
      const items = bank.questions
        .filter((q) => q.dynamic)
        .map((q) => ({
          number: q.number,
          question: q.question,
          note: q.dynamicNote ?? "Verify the current answer before your interview.",
        }));
      return {
        content: [
          {
            type: "text",
            text: `${items.length} questions on the ${version} test have answers that change with elections or depend on your state. I never score these in practice — before your interview, check each one at uscis.gov/citizenship/testupdates. The big ones: ${items.slice(0, 4).map((i) => `"${i.question}"`).join(" ")}`,
          },
        ],
        structuredContent: {
          type: "watchlist" as const,
          version,
          items,
          checkUrl: "https://www.uscis.gov/citizenship/testupdates",
        },
      };
    }
  );

  registerAppViews(server);

  return server;
}
