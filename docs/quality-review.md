# Quality Review — three adversarial passes (2026-10-21/22)

Method: the project was reviewed from three personas before freeze; every HIGH finding was fixed and regression-tested. Statuses are honest — anything not fixed is listed as a known limitation.

## Reviewer A — Amazon platform engineer

| # | Finding | Severity | Resolution |
|---|---|---|---|
| A1 | Spec/transport compliance needed independent proof, not self-claims | HIGH | `docs/compliance-evidence.md`: raw initialize transcript (protocolVersion 2025-11-25, mcp-session-id), official MCP Inspector CLI transcripts (tools/list, tools/call, resources/list), 53 automated tests incl. two-session isolation |
| A2 | Stateless-looking tools but session-scoped conversation state | — | By design: stateful Streamable HTTP sessions (per-session `McpServer`), long-term learner state in a shared store; verified by the concurrent-session isolation test |
| A3 | Learner store is single-household (two clients share progress) | LOW | Documented in README limitations; appropriate for a kitchen-device product; per-voice profiles listed as future work |
| A4 | MCP Apps view runtime served cross-origin to sandboxed iframes | MED | `/vendor/ext-apps.js` served with explicit CORS; covered by a test |
| A5 | Reproducibility | HIGH | `npm install && npm run build && npm start` → everything local, zero config, zero secrets; `scripts/e2e-demo.mjs` one-command journey |

## Reviewer B — product & design judge

| # | Finding | Severity | Resolution |
|---|---|---|---|
| B1 | First-run: user must understand what to say | MED | Welcome card, suggestion chips per state, assistant's opening line, help intent |
| B2 | Mock interview gives no mid-exam feedback — could feel broken | LOW | Intentional (authentic). The spoken ack ("Okay, noted.") + progress dots signal recording; end-of-exam debrief explains everything |
| B3 | Mic failures would kill a voice-first demo | HIGH | Text input fallback always visible; chips make every journey clickable; mic errors surface as a bubble with guidance |
| B4 | "Repeat the question" was scored as a wrong answer | HIGH | **Fixed**: repeat/pardon/say-again intents re-speak without scoring (regression-safe via router) |
| B5 | Keyboard/accessibility | MED | Voice ring has role=button, aria-label, keyboard activation; color choices maintain contrast on dark bg; captions always shown for spoken text |
| B6 | Readiness with near-zero practice could mislead | MED | Coverage-aware phrasing ("too early to tell — estimate assumes typical knowledge of the rest") + practiced-count pill |

## Reviewer C — skeptical hackathon judge

| # | Finding | Severity | Resolution |
|---|---|---|---|
| C1 | "Is the Alexa+ connection real?" | HIGH | Impossible for every entrant (partner-preview; verified in official FAQ). We ship the FAQ-endorsed format — a real MCP client web page — and label the simulated surface in the UI footer, README, and video |
| C2 | Saying "explain" mid-mock leaked the answer | HIGH | **Fixed**: server refuses to explain the live mock question ("the real officer won't explain either"); regression test added |
| C3 | "No LLM — is this just a quiz app?" | MED | The moat is deliberate determinism where stakes are real: official banks, authentic early-stop mechanics, dual-version policy, seeded Monte Carlo readiness, 87-case eval with zero false-accepts. The MCP server is assistant-agnostic — any MCP client (Claude, Inspector, future Alexa+) gets the same coach |
| C4 | Template translations (en/es/hi) are thin | LOW | Honestly labeled; question text intentionally stays English (the real exam is in English except 65/20 accommodations) |
| C5 | Could the matcher accept wrong answers? | HIGH | Asymmetric coverage matching (no symmetric fuzz), numeric exact-match guard, multi-answer counting; eval includes opposite-meaning attacks ("to spread communism") — 0 false-accepts |
| C6 | Dynamic questions (current President etc.) could teach stale facts | HIGH | Never scored; self-check flow + watchlist tool with USCIS's own verification URL |
| C7 | Browser-side MCP Apps bridge untested in CI | MED | Known limitation: server side fully tested; host falls back to native cards automatically if the view fails to initialize (2.5s timeout). Verified visually before demo recording |
| C8 | Eval labels were revised during development | — | Disclosed: 2 held-out labels were re-labeled when we adopted the strict-coach policy (stricter than the officer, never looser). The eval is a regression suite encoding that policy, not an independent benchmark |

## Open limitations (shipped as documented)

1. Voice layer = Chrome Web Speech API (needs internet; Chrome-only) — text input works everywhere.
2. Single learner profile per server instance.
3. English/Spanish/Hindi explanation templates only.
4. MCP Apps host verified manually in-browser, not in CI.
5. Readiness is an estimate of civics-test performance only — not the English reading/writing portions (clearly stated in-product).
