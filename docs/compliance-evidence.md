# Track Compliance Evidence — Alexa+ (MCP server path)

All transcripts below are real outputs captured on 2026-10-21 against the production build (`npm run build && npm start`) on Windows 11 / Node 24. Reproduce any of them in under a minute with the commands shown.

## Rule requirement → where it's satisfied

| Official requirement (rules page) | Evidence |
|---|---|
| "self-hosted MCP server, implementing MCP spec version 2025-11-25 … over Streamable HTTP" | Initialize handshake below: server negotiates `"protocolVersion":"2025-11-25"`; transport is Streamable HTTP (`POST/GET/DELETE /mcp`, `mcp-session-id` header). SDK: `@modelcontextprotocol/sdk` 1.32.1. |
| Repo "must demonstrate use of your track's required technology at runtime … imported and actually called" | `server/src/index.ts` imports `StreamableHTTPServerTransport` and serves it; `server/src/mcp.ts` builds `McpServer` and registers 8 tools. The web client calls them at runtime through the official SDK's `StreamableHTTPClientTransport` (`web/src/mcp.ts`). |
| Demo shows the MCP server "in action" | Web client is a real MCP client (FAQ-endorsed format: initialize → tools/list → tools/call, visible live in the UI's "MCP wire" panel), plus the independent Inspector CLI transcripts below. |

## 1. Initialize handshake (raw Streamable HTTP)

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"compliance-check","version":"1.0.0"}}}' -D -
```

Captured response (abridged):

```
mcp-session-id: f5b705c6-854e-48ee-aaaa-7e0371a043ed
data: {"result":{"protocolVersion":"2025-11-25","capabilities":{"tools":{"listChanged":true},
"resources":{"listChanged":true}},"serverInfo":{"name":"oath-civics-coach","version":"1.0.0"}, ...}
```

## 2. Independent verification — official MCP Inspector CLI (third-party tool)

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp --transport http --method tools/list
```
→ returns all 8 tools with full JSON input/output schemas (get_profile, update_profile, start_practice, answer_question, get_readiness, get_study_plan, explain_question, dynamic_watchlist).

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp --transport http \
  --method tools/call --tool-name start_practice --tool-arg mode=mock_interview
```
→ captured result: `"Starting a 2025 mock interview: I'll ask up to 20 questions. 12 correct passes; 9 wrong ends it — exactly like the real interview. Question 1 of 20: Name one power of the president."` with full structured card payload.

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp --transport http --method resources/list
```
→ `ui://oath/readiness.html` (`text/html;profile=mcp-app`) — the MCP Apps view the server ships for readiness results.

## 3. SDK-client end-to-end journey

`node scripts/e2e-demo.mjs` (repo root, server running) drives the full journey through the official TypeScript SDK client: profile → version-aware configuration → 3-question practice with real verdicts → readiness Monte Carlo → study plan → dynamic watchlist → authentic mock interview. Captured run preserved in the repo README's "Proof it works" section.

## 4. Automated integration tests

`npx vitest run` — 52 tests, including: protocol handshake, 8-tool listing, invalid-argument rejection, session isolation across two concurrent clients, authentic early-stop rules (2008: fail locks at 5 wrong; 2025: fail at 9 wrong; 65/20: 10 asked/pass 6), MCP Apps resource + `_meta["ui/resourceUri"]`, and CORS on the view runtime.

## 5. What is simulated vs real (honest labeling)

- **Real**: the MCP server, the protocol, the transport, both official question banks, all exam logic, the web client's MCP traffic, the MCP Apps resource + bridge.
- **Simulated**: the Alexa+ *surface* (voice ring UI, Web Speech API speech-to-text/text-to-speech). No hackathon participant can connect to real Alexa+ — Amazon's add-on tools are partner-preview only (verified in the official hackathon FAQ), which explicitly endorses this exact demo format ("a web page that acts as an actual MCP client … satisfies the requirement").
- **Out of scope**: no LLM anywhere in the scoring or routing path — answer checking is deterministic against USCIS's published acceptable answers (eval: 87/87, zero false-accepts).
