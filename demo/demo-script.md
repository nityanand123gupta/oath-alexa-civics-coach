# Demo Video Script — Oath (target 2:30, hard cap 3:00)

Format: screen recording of Chrome at http://localhost:3000 (production build, `npm start`), with live microphone narration AND live voice interaction with the app. Keep the MCP wire panel CLOSED until the tech reveal. 1080p, system audio ON (Oath speaks).

Pre-roll state: fresh `server/data/state.json` deleted, then run the WARM-UP below (so readiness has data), then START RECORDING.

Warm-up (before recording): complete one 5-question practice round answering ~3 correctly. This seeds believable mastery data for the readiness card.

---

**[0:00–0:15 — THE HOOK]**
*Screen: title slide (plain dark slide with "Oath 🗽 — practice the real citizenship interview" and the two test versions side by side), or the app's welcome card.*

> "Every year, hundreds of thousands of people sit the US citizenship interview. It's an **oral exam** — an officer asks, you answer, out loud. And right now America is running **two different versions** of that exam at once, depending on the date you filed your application. Fail twice, and your roughly $750 filing fee is gone."

**[0:15–0:30 — THE PRODUCT]**
*Screen: the Oath app. Click ⚙ Set up; enter filing date 2026-01-15 + interview date; Save. The "2025 test configured — 20 questions, 12 to pass" card appears and Oath says it aloud.*

> "This is Oath — a citizenship coach for Alexa+, built as a real self-hosted MCP server. One fact — your filing date — and it configures the exact exam you'll actually sit."

**[0:30–1:35 — CORE JOURNEY (all by voice)]**
*Click the ring. Say: "Practice five questions."*
*Answer Q1 correctly out loud. Answer Q2 wrong on purpose (or say "I don't know"). The verdict card shows the official answers + explanation. Answer one more correctly. (If time is tight, click "Stop session" after 3 questions.)*

> (let the app's own voice carry this section; add one line over it:)
> "Hands-free spoken drills — spaced repetition picks what I'm forgetting, and every answer is graded **deterministically against USCIS's published acceptable answers**. No AI guessing on a federal exam."

*Say: "Am I ready?" → readiness dashboard renders (MCP App view with ⚡ badge).*

> "And instead of a vague score — Oath simulates my actual exam ten thousand times against my measured mastery. That's my real pass probability."

**[1:35–2:00 — TECH REVEAL]**
*Click "⛓ MCP wire". Scroll the live JSON-RPC: initialize with protocolVersion 2025-11-25, tools/call, mcp-session-id. Point at the ⚡ MCP App badge.*

> "Under the hood this page is a genuine MCP client. Live JSON-RPC over Streamable HTTP, spec 2025-11-25, stateful sessions — and that readiness dashboard isn't part of the web page: the **server ships it as an MCP Apps ui:// resource**, so an Echo Show can render it the day Alexa+ opens to developers. Fifty-three automated tests; an eighty-seven-case answer-matching eval with zero false accepts."

**[2:00–2:25 — THE MOCK INTERVIEW]**
*Say: "Give me a mock interview." Answer confidently (these can be prepared). When the 12th correct answer lands, the exam stops early with the PASS card.*

> "Mock mode is the real thing: up to twenty questions, pass at twelve, fail at nine wrong — and it stops early, exactly like the officer does. …There — twelve correct, and the interview ends on the spot. That's the moment you're rehearsing for."

**[2:25–2:35 — CLOSE]**
*Screen: README hero or the welcome card.*

> "Oath. Rehearse the interview, out loud, with the official questions — and walk in knowing you're ready. Built for the Amazon Alexa+ track; MIT-licensed, with the exam engine open-sourced for anyone to build on."

---

## Timing budget
Hook 15s · product 15s · core journey 65s · tech 25s · mock 25s · close 10s = **2:35**. If over: trim core journey to 3 practice questions and cut the "explain" beat.

## Hard rules
- No music (avoids copyright risk). No third-party logos beyond what's on screen in the app.
- Everything shown is live — no staged screenshots presented as live.
- If STT misfires during recording, say "repeat the question" (handled) or re-take the segment.
