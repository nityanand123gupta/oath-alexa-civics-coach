# 🗽 Oath — the citizenship interview coach for Alexa+

**Track: Alexa+** (self-hosted MCP server, spec **2025-11-25**, Streamable HTTP) · Mini-challenge: **Open Source**
*Build, Ship, Shape: Amazon Developer Hackathon 2026*

> The US naturalization civics test is an **oral exam**: a USCIS officer asks questions aloud, you answer aloud, and the test stops early the moment you pass — or fail. Since **October 20, 2025, two different versions of that exam are running at the same time**, and which one *you* get depends on the date you filed your N-400. Flashcard apps are silent, single-version, and can't tell you if you're ready. A voice agent can literally **rehearse the real thing** — that's Oath.

Oath is a self-hosted **MCP server** that gives Alexa+ (or any MCP client) everything it needs to be a patient, honest examiner: both official USCIS question banks, deterministic answer checking against the officially published acceptable answers, spaced repetition, **mock interviews with the real stopping rules**, and a readiness score computed by simulating your actual upcoming exam 10,000 times.

## Why this matters

- The N-400 filing fee is a real bet (~$710–760) and you get one re-examination before denial.
- The 2008 test (filed before Oct 20, 2025): officer asks up to **10** of 100 questions, **6** correct passes, test stops at 6 correct or 5 wrong.
- The 2025 test (filed on/after): up to **20** of 128 questions, **12** to pass, ends at 12 correct or **9 wrong** — early stop in both directions ([Federal Register 2025-18050](https://www.federalregister.gov/documents/2025/09/18/2025-18050/notice-of-implementation-of-2025-naturalization-civics-test)).
- Applicants 65+ with 20+ years as permanent residents get a designated 20-question subset (10 asked, 6 to pass) — Oath detects and handles this automatically.
- Some answers **change with elections** ("Who is the President?"). Oath never scores those — it maintains a watchlist with USCIS's own verify-before-your-interview guidance.

Tell Oath one fact — your filing date — and every drill, mock, and readiness estimate is configured to the exam *you* will actually sit.

## What's real vs simulated (honest up front)

- ✅ **Real**: the MCP server (spec 2025-11-25, Streamable HTTP, stateful sessions, 8 tools, resources, MCP Apps view), both official question banks transcribed and machine-verified from USCIS PDFs, all exam mechanics, the deterministic matcher (87-case eval, **0 false-accepts**), the web client's MCP traffic (official SDK client — watch it live in the "MCP wire" panel).
- 🟡 **Simulated**: the Alexa+ *surface*. No hackathon participant can connect to real Alexa+ (the add-on tools are partner-preview only — confirmed in the official hackathon FAQ, which endorses exactly this demo format: *"a web page that acts as an actual MCP client … satisfies the requirement"*). Voice in/out uses Chrome's Web Speech API and is labeled as a simulation in the UI.
- ❌ **No LLM anywhere in scoring or routing.** Where the stakes are a federal exam, grading is deterministic against official answers — and the whole server works identically with Claude, MCP Inspector, or Alexa+ the day it opens to developers.

## Quick start (judges: ~60 seconds)

```bash
git clone https://github.com/nityanand123gupta/oath-alexa-civics-coach.git
cd oath-alexa-civics-coach
npm install
npm run build
npm start          # → http://localhost:3000  (Chrome recommended for voice)
```

No environment variables. No API keys. No accounts. Everything runs locally.

Try saying (or clicking): **"Practice five questions"** → answer out loud → **"Am I ready?"** → **"Give me a mock interview."**

### Prove the MCP server independently

```bash
# official inspector CLI against the running server
npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp --transport http --method tools/list
npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp --transport http \
  --method tools/call --tool-name start_practice --tool-arg mode=mock_interview

# or the one-command scripted journey (second terminal, server running)
node scripts/e2e-demo.mjs
```

Full captured transcripts: [`docs/compliance-evidence.md`](docs/compliance-evidence.md).

### Use it from any MCP client

Oath is assistant-agnostic. For example, from Claude Code:

```bash
claude mcp add --transport http oath http://localhost:3000/mcp
```

…then ask Claude to quiz you. Remote exposure for a real device someday: `cloudflared tunnel --url http://localhost:3000`.

## The 8 tools

| Tool | What it does |
|---|---|
| `update_profile` / `get_profile` | Filing date → test version (2008/2025); interview date; 65/20 detection from DOB + green-card date; explanation language (en/es/hi) |
| `start_practice` | `practice` = spaced-repetition drill (due → new → weakest); `mock_interview` = authentic simulation with the real thresholds and early stopping |
| `answer_question` | Deterministic verdict vs official acceptable answers; multi-answer questions ("Name three…") require distinct matches; practice teaches immediately, mock behaves like the officer (no mid-exam reveals; full debrief at the end) |
| `get_readiness` | Seeded Monte Carlo of *your* exam (10k runs): pass probability, expected correct, category mastery, weakest questions, coverage — ships an **MCP Apps** dashboard view |
| `get_study_plan` | Due reviews now, new-questions-per-day pacing to your interview date |
| `explain_question` | All official answers + localized explanation; **refuses during a live mock** (exam integrity) |
| `dynamic_watchlist` | Every election/state-dependent question + USCIS's verify-current-answers link |

## Architecture

```
Browser (Chrome) — "simulated Alexa+" client (React/Vite)
  Web Speech STT/TTS → deterministic intent router → REAL MCP client (official SDK)
  cards UI + live MCP-wire panel + MCP Apps host (AppBridge + sandboxed iframe)
        │  Streamable HTTP · MCP 2025-11-25 · Mcp-Session-Id
Node 24 + Express — self-hosted MCP server (@modelcontextprotocol/sdk 1.32)
  8 zod-validated tools · stateful sessions · ui:// MCP Apps resource · JSON store
        │  pure function calls
@oath/civics-kit — dependency-free TS engine (also a standalone OSS package)
  official banks (100 + 128 Qs) · matcher · SM-2 · exam state machines · Monte Carlo
```

More: [`docs/architecture.md`](docs/architecture.md) · [`docs/product-brief.md`](docs/product-brief.md)

## Engineering receipts

- **53 automated tests** (`npx vitest run`): exam-rule boundary cases (pass-at-6/12, fail-at-5/9, 65/20), matcher adversarial cases, Monte Carlo seed determinism, full MCP integration via the official SDK client, two-session isolation, MCP Apps resource + metadata, mid-mock explain refusal.
- **87-case labeled matcher eval** (`npm run eval`): 100% accuracy, **0 false-accepts** including opposite-meaning attacks ("to spread communism" vs "to stop the spread of communism"). Two held-out labels were revised when we adopted the strict-coach policy (stricter than the officer, never looser) — the eval is a regression suite encoding that policy.
- **Data provenance**: both banks machine-verified against the official USCIS PDFs (answer-count asserted per question, senior/dynamic flags cross-checked against USCIS's 65/20 documents and the Federal Register) — see [`docs/data-provenance/`](docs/data-provenance/).
- **MCP Apps (SEP-1865)**: the server ships its own readiness dashboard as a `ui://` resource via the official `@modelcontextprotocol/ext-apps` package; the web client hosts it through the real app bridge, with automatic fallback to native cards.

## Open Source mini-challenge

The exam engine is extracted as a standalone MIT package created during the hackathon window: **[civics-test-kit](https://github.com/nityanand123gupta/civics-test-kit)** — official banks + matcher + SRS + exam mechanics + readiness simulation, dependency-free, reusable by any citizenship-prep tool.

## Known limitations

Voice needs Chrome + internet (text input always works) · single learner profile per server · en/es/hi explanation templates only · browser-side MCP Apps bridge is verified manually, not in CI · covers the civics portion, not the English reading/writing tests.

## Disclaimers

Not affiliated with Amazon or USCIS. Study aid, not legal advice. Civics questions and answers are US-government works (public domain), transcribed verbatim from uscis.gov; dynamic answers must be verified at [uscis.gov/citizenship/testupdates](https://www.uscis.gov/citizenship/testupdates).

## License

[MIT](LICENSE)
