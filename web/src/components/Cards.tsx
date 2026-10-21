import type { JSX } from "react";

type S = Record<string, any>;

function Pills({ items }: { items: { label: string; tone?: "good" | "bad" | "accent" }[] }) {
  return (
    <div className="pills">
      {items.map((p, i) => (
        <span key={i} className={`pill ${p.tone ?? ""}`}>{p.label}</span>
      ))}
    </div>
  );
}

export function QuestionCard({ c }: { c: S }) {
  const history: boolean[] = c.history ?? [];
  const dots: JSX.Element[] = [];
  for (let i = 0; i < c.totalPlanned; i++) {
    let cls = "pdot";
    if (i < history.length) cls += history[i] ? " ok" : " no";
    else if (i === history.length) cls += " cur";
    dots.push(<span key={i} className={cls} />);
  }
  return (
    <div className="card">
      <h3>
        {c.mode === "mock_interview" ? `Mock interview · ${c.version} test` : `Practice · ${c.version} test`}
      </h3>
      <div className="big">{c.question}</div>
      <div className="dim">
        Question {c.asked} of {c.totalPlanned} · {c.category}
      </div>
      {c.mode === "mock_interview" && (
        <Pills
          items={[
            { label: `${c.correctSoFar} correct`, tone: "good" },
            { label: `${c.incorrectSoFar} wrong`, tone: "bad" },
            { label: `pass at ${c.passAt}`, tone: "accent" },
            { label: `fail at ${c.failAt}` },
          ]}
        />
      )}
      <div className="progressdots">{dots}</div>
    </div>
  );
}

export function VerdictCard({ c }: { c: S }) {
  const banner =
    c.correct === null ? (
      <div className="verdict-banner check">⚠ Not scored — answer changes over time</div>
    ) : c.correct ? (
      <div className="verdict-banner ok">✓ Correct</div>
    ) : (
      <div className="verdict-banner no">✕ Not quite</div>
    );
  const matched = new Set((c.matched ?? []).map((m: string) => m.toLowerCase()));
  return (
    <div className="card">
      <h3>Answer check · deterministic match vs official USCIS answers</h3>
      {banner}
      {c.selfCheckNote && <p className="dim">{c.selfCheckNote}</p>}
      {c.officialAnswers?.length > 0 && (
        <>
          <div className="dim" style={{ marginTop: 10 }}>
            Official acceptable answer{c.officialAnswers.length > 1 ? "s" : ""}
            {c.required > 1 ? ` (give ${c.required})` : ""}:
          </div>
          <ul className="answers">
            {c.officialAnswers.slice(0, 8).map((a: string, i: number) => (
              <li key={i} className={matched.has(a.toLowerCase()) ? "hit" : ""}>
                {a} {matched.has(a.toLowerCase()) ? "✓" : ""}
              </li>
            ))}
            {c.officialAnswers.length > 8 && (
              <li className="dim">…and {c.officialAnswers.length - 8} more</li>
            )}
          </ul>
        </>
      )}
      {c.explanation && <p className="dim" style={{ marginTop: 10 }}>{c.explanation}</p>}
    </div>
  );
}

export function SummaryCard({ c }: { c: S }) {
  return (
    <div className="card">
      <h3>{c.mode === "mock_interview" ? "Mock interview result" : "Drill complete"}</h3>
      {c.result && (
        <div className={`verdict-banner ${c.result === "pass" ? "ok" : "no"}`}>
          {c.result === "pass" ? "✓ PASSED" : "✕ Not this time"}
        </div>
      )}
      <Pills
        items={[
          { label: `${c.asked} asked` },
          { label: `${c.correct} correct`, tone: "good" },
          { label: `${c.incorrect} wrong`, tone: c.incorrect > 0 ? "bad" : undefined },
          ...(c.result === "pass" && c.asked < 20 ? [{ label: "stopped early — like the real exam", tone: "accent" as const }] : []),
        ]}
      />
      {c.missed?.length > 0 && (
        <>
          <div className="dim" style={{ marginTop: 14 }}>Review these:</div>
          <ul className="weaklist">
            {c.missed.slice(0, 6).map((m: S, i: number) => (
              <li key={i}>
                <span>
                  <b>Q{m.number}.</b> {m.question}
                  <div className="dim">{m.officialAnswers.slice(0, 3).join("; ")}</div>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function ReadinessCard({ c }: { c: S }) {
  const pct = Math.round(c.passProbability * 100);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const color = pct >= 90 ? "var(--good)" : pct >= 70 ? "var(--accent)" : "var(--bad)";
  return (
    <div className="card">
      <h3>
        Readiness · {c.simulations.toLocaleString()} simulated {c.version} exams (seeded Monte Carlo)
      </h3>
      <div className="readiness">
        <div className="gauge">
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
            <circle
              cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * circ} ${circ}`}
            />
          </svg>
          <div className="val">
            <b>{pct}%</b>
            <span>PASS CHANCE</span>
          </div>
        </div>
        <div className="catbars">
          {c.byCategory.map((cat: S, i: number) => (
            <div key={i} className="catbar">
              <div className="row">
                <span>{cat.category}</span>
                <span>{Math.round(cat.mastery * 100)}%</span>
              </div>
              <div className="track">
                <div className="fill" style={{ width: `${Math.round(cat.mastery * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Pills
        items={[
          { label: `avg ${Number(c.expectedCorrect).toFixed(1)} correct` },
          { label: `${c.coverage.seen}/${c.coverage.total} questions practiced`, tone: "accent" },
          ...(c.senior6520 ? [{ label: "65/20 designated test", tone: "good" as const }] : []),
        ]}
      />
      {c.weakest?.length > 0 && (
        <ul className="weaklist">
          {c.weakest.map((w: S, i: number) => (
            <li key={i}>
              <span>{w.question}</span>
              <span className="pct">{Math.round(w.mastery * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlanCard({ c }: { c: S }) {
  return (
    <div className="card">
      <h3>Today's study plan</h3>
      <Pills
        items={[
          { label: `${c.dueNow} reviews due`, tone: c.dueNow > 0 ? "accent" : undefined },
          { label: `${c.unseen} new remaining` },
          { label: `${c.suggestedNewToday} new today`, tone: "good" },
          ...(c.daysToInterview != null ? [{ label: `${c.daysToInterview} days to interview`, tone: (c.paceOk ? "good" : "bad") as "good" | "bad" }] : []),
        ]}
      />
      <p className="dim" style={{ marginTop: 12 }}>{c.message}</p>
    </div>
  );
}

export function WatchlistCard({ c }: { c: S }) {
  return (
    <div className="card">
      <h3>Dynamic answers · never scored, always flagged</h3>
      <p className="dim">
        These {c.items.length} answers change with elections or depend on your state. Verify each at{" "}
        <a href={c.checkUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
          uscis.gov/citizenship/testupdates
        </a>{" "}
        before interview day.
      </p>
      <table className="watch">
        <tbody>
          {c.items.map((it: S, i: number) => (
            <tr key={i}>
              <td className="n">{it.number}</td>
              <td>
                {it.question}
                <div className="note">{it.note}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProfileCard({ c }: { c: S }) {
  return (
    <div className="card">
      <h3>Your profile</h3>
      <div className="big">
        {c.testVersion} civics test
        {c.senior6520 ? " · 65/20 designated questions" : ""}
      </div>
      <Pills
        items={[
          { label: c.filingDate ? `N-400 filed ${c.filingDate}` : "filing date not set", tone: c.filingDate ? "accent" : "bad" },
          ...(c.daysToInterview != null ? [{ label: `interview in ${c.daysToInterview} days` }] : []),
          { label: `${c.questionsSeen}/${c.bankSize} practiced`, tone: "good" },
          { label: `explanations: ${({ en: "English", es: "Español", hi: "हिन्दी" } as S)[c.explanationLanguage] ?? c.explanationLanguage}` },
        ]}
      />
      {c.lastMock && (
        <p className="dim" style={{ marginTop: 10 }}>
          Last mock interview: {c.lastMock.result === "pass" ? "passed" : "failed"} ({c.lastMock.correct} correct,{" "}
          {c.lastMock.incorrect} wrong)
        </p>
      )}
    </div>
  );
}

export function ExplanationCard({ c }: { c: S }) {
  return (
    <div className="card">
      <h3>Question {c.questionNumber} · {c.category}</h3>
      <div className="big">{c.question}</div>
      <ul className="answers">
        {c.officialAnswers.slice(0, 10).map((a: string, i: number) => (
          <li key={i}>{a}</li>
        ))}
        {c.officialAnswers.length > 10 && <li className="dim">…and {c.officialAnswers.length - 10} more</li>}
      </ul>
      <p className="dim">{c.explanation}</p>
      <Pills
        items={[
          ...(c.dynamic ? [{ label: "answer changes over time", tone: "bad" as const }] : []),
          ...(c.senior ? [{ label: "65/20 designated", tone: "accent" as const }] : []),
        ]}
      />
    </div>
  );
}

/** Renders the right card(s) for a tool's structuredContent. */
export function CardStack({ structured }: { structured: S | null }) {
  if (!structured) return null;
  const t = structured.type as string | undefined;
  switch (t) {
    case "profile":
      return <ProfileCard c={structured} />;
    case "readiness":
      return <ReadinessCard c={structured} />;
    case "study_plan":
      return <PlanCard c={structured} />;
    case "watchlist":
      return <WatchlistCard c={structured} />;
    case "explanation":
      return <ExplanationCard c={structured} />;
    case "session_summary":
      return <SummaryCard c={structured} />;
    case "verdict":
      return (
        <>
          {structured.summary ? <SummaryCard c={structured.summary} /> : null}
          <VerdictCard c={structured} />
          {structured.nextCard ? <QuestionCard c={structured.nextCard} /> : null}
        </>
      );
    default:
      if (structured.card) {
        // start_practice result
        return <QuestionCard c={structured.card} />;
      }
      if (t === "profile_updated") {
        return (
          <div className="card">
            <h3>Profile updated</h3>
            <div className="big">{structured.testVersion} test configured</div>
            <Pills
              items={[
                ...(structured.senior6520 ? [{ label: "65/20 designated questions", tone: "good" as const }] : []),
                ...(structured.daysToInterview != null ? [{ label: `${structured.daysToInterview} days to interview`, tone: "accent" as const }] : []),
              ]}
            />
          </div>
        );
      }
      return null;
  }
}
