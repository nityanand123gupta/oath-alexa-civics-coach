# Architecture — Oath

## Overview

```
┌────────────────────────────── Browser (Chrome) ──────────────────────────────┐
│  web/ — "Alexa+ simulated experience" client (React + Vite)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────────────┐   │
│  │ Voice layer │  │ Intent router │  │ Real MCP client                    │   │
│  │ Web Speech  │→ │ deterministic │→ │ @modelcontextprotocol/sdk          │   │
│  │ STT + TTS   │  │ (+opt. LLM)   │  │ StreamableHTTPClientTransport      │   │
│  └─────────────┘  └──────────────┘  └───────────────┬────────────────────┘   │
│        Cards UI (question/verdict/readiness/plan)   │  Protocol panel        │
└─────────────────────────────────────────────────────┼────────────────────────┘
                                   Streamable HTTP (POST/GET/DELETE /mcp)
                                   MCP spec 2025-11-25, Mcp-Session-Id
┌─────────────────────────────────────────────────────▼────────────────────────┐
│  server/ — self-hosted MCP server (Node 24 + Express)                        │
│  McpServer + StreamableHTTPServerTransport (STATEFUL: session per client)    │
│  8 tools (zod-validated) → exam/session logic → JSON state store (atomic)    │
│  also serves the built web client statically (single-process demo)           │
└─────────────────────────────────────────────────────┬────────────────────────┘
                                                      │ pure function calls
┌─────────────────────────────────────────────────────▼────────────────────────┐
│  packages/civics-kit/ — dependency-free TS library (OSS mini-challenge)      │
│  banks (2008/2025 JSON) · answer matcher · SM-2 SRS · mastery model          │
│  exam engine (early-stop state machines) · seeded Monte Carlo readiness      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Responsibilities
- **civics-kit** (pure, no I/O, no deps): all domain logic. Unit-tested heavily. Extracted to its own MIT repo at the end of the window (Open Source mini entry); vendored copy stays in the main repo so judges run everything from one clone.
- **server**: MCP protocol surface + persistence + session management. The track's required technology **called at runtime**: `McpServer`, `StreamableHTTPServerTransport`, `registerTool` — imports and entry point visible in `server/src/index.ts`.
- **web**: honest "simulated Alexa+ experience" (per the rules' sanctioned path) that doubles as proof the server is a real MCP server: it speaks genuine JSON-RPC over Streamable HTTP via the official SDK client and exposes the live traffic in a protocol panel.

## MCP integration detail
- Spec: 2025-11-25 (SDK 1.32.1 `LATEST_PROTOCOL_VERSION`; verified locally by smoke test).
- Transport: Streamable HTTP, **stateful** (`sessionIdGenerator: randomUUID`): POST /mcp (requests), GET /mcp (SSE notifications), DELETE /mcp (session teardown). One transport per session, cleaned on close.
- Tools (final set may add/trim one):
  1. `get_profile` — profile + computed test version (from filing date), 65/20 eligibility, days to interview.
  2. `update_profile` — filing date / interview date / DOB / LPR-since / explanation language.
  3. `start_practice` — mode `practice` (SRS-weighted) or `mock_interview` (authentic rules); optional category.
  4. `answer_question` — match spoken answer → verdict + official answers + explanation; advances session; early-stop handling; updates mastery/SRS.
  5. `get_readiness` — seeded Monte Carlo (10k sims) pass probability + category mastery + weakest items.
  6. `get_study_plan` — due reviews, pacing to interview date.
  7. `explain_question` — official answers + curated explanation (+ translation when language set).
  8. `dynamic_watchlist` — questions whose answers change + USCIS self-check guidance.
- Every tool returns human-readable `content` + `structuredContent` (typed card payloads the client renders). Zod input schemas; invalid input → MCP validation errors (tested).
- Session state (active quiz) lives with the MCP session; long-term learning state persists in `server/data/state.json` (atomic write-temp-rename, debounced).

## Client agent layer
Deterministic intent router (utterance → tool call + slots) as default — reproducible, offline-safe, demoable. Optional LLM mode behind an env flag (OpenAI-compatible endpoint) that does tool-selection via the same MCP tools; clearly labeled in UI and README. No LLM is in the scoring path of answers — answer matching is deterministic civics-kit code with a reported eval accuracy.

## Error handling
- Server: malformed JSON-RPC → protocol error; unknown session → 404 + client re-initialize; tool exceptions → MCP error result (never crash); store write failures → in-memory continue + surfaced warning.
- Client: mic permission denied → text input fallback; STT error → retry chip; server unreachable → connection banner + auto-retry; TTS unavailable → captions only.

## Testing strategy
- Unit (vitest): matcher (incl. adversarial paraphrases), SM-2, mastery, exam early-stop boundaries (6/10 and 12-or-9/20 and 65/20), Monte Carlo seed determinism + sanity bounds, store atomicity.
- Integration: real HTTP server + official SDK client — initialize (expect protocolVersion 2025-11-25), tools/list, full practice loop, mock-interview loop, two concurrent sessions isolation, invalid-args error shape, DELETE teardown.
- Eval: labeled answer-matching set (accept/reject pairs incl. held-out tricky set); `npm run eval` prints accuracy + zero-false-accept check; number quoted in README honestly.

## Security & privacy
No accounts, no PII beyond locally stored practice stats + optional dates; no secrets in repo (.env.example only); LLM mode off by default; CORS restricted to same origin (demo). Not legal advice — disclaimer in UI + README.

## Run & deploy
- Dev: `npm run dev` (server :3000 with tsx watch + Vite :5173 proxying /mcp).
- Judge path: `npm install && npm run build && npm start` → http://localhost:3000 (client + MCP endpoint same origin). Node ≥ 20.
- Optional remote demo: `cloudflared tunnel --url http://localhost:3000` (documented; not required — rules don't require hosting post-deadline).

## Costs
Zero. No paid services in the default path.
