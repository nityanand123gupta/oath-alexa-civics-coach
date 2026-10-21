# Product Brief — Oath

**One-liner:** Oath is a citizenship-interview coach for Alexa+ — a self-hosted MCP server that lets anyone rehearse the real, oral US naturalization civics test by voice, with authentic exam rules, spaced repetition, and an honest readiness score.

## Primary user
Lawful permanent residents preparing for the US naturalization interview — millions in the pipeline, spanning every language community. Secondary: family members helping a parent or spouse practice; teachers of citizenship classes.

## Problem statement
The naturalization civics test is an **oral exam**: a USCIS officer asks questions aloud and the applicant answers aloud. Since **October 20, 2025**, two versions run simultaneously — which one you take depends on your N-400 filing date (2008 test: 100-question bank, 10 asked, 6 to pass; 2025 test: 128-question bank, 20 asked, 12 to pass, fail at 9 wrong, early stop both ways). Getting it wrong is expensive: the N-400 filing fee (~$710–760) buys two attempts; a second failure means denial and refiling. Existing prep tools are silent flashcard apps: single-version, reading-based, nothing like the interview, and they can't tell you whether you're actually ready.

## Core value proposition
Practice the way you'll be tested. Oath turns the assistant already in your kitchen into a patient examiner: hands-free spoken drills that prioritize what you're forgetting, mock interviews that follow the *exact* stopping rules of the real exam for *your* test version, and a readiness probability computed by simulating the real exam thousands of times against your measured mastery.

## Major user journey
1. "Alexa, I want to practice for my citizenship test." → one-time setup: filing date (determines test version), interview date, 65/20 check, preferred explanation language.
2. Daily 5-minute voice drills while cooking/commuting — spaced repetition picks the questions; wrong answers get the official answers plus a plain-language explanation (optionally in the user's language).
3. "Am I ready?" → readiness card: pass probability, category breakdown, weakest questions, plan to interview day.
4. "Give me a mock interview." → authentic simulation: questions asked aloud, early stop at pass/fail thresholds, verdict + debrief.
5. Dynamic-answer watchlist: questions whose answers change (President, governor, etc.) are flagged with USCIS's own "check current answers" guidance — never taught as stale facts.

## Required functionality (P0/P1)
- Both official question banks (2008 + 2025) with official acceptable answers, categories, 65/20 designations, dynamic flags — built from USCIS sources.
- Deterministic answer matching against official acceptable answers (normalization + aliases + tolerance), with a labeled eval set and a reported accuracy number.
- SM-2 spaced repetition + per-question mastery model.
- Authentic mock-interview engine (version-correct sampling, thresholds, early stop).
- Seeded Monte Carlo readiness simulation.
- MCP server: spec 2025-11-25, Streamable HTTP, stateful sessions, ~8 tools with validated schemas and structured outputs.
- Alexa+-style web client that is a **real MCP client** (official SDK over Streamable HTTP): voice in/out (Web Speech API), cards, and a live protocol panel showing initialize/tools-list/tools-call.

## Non-goals
- Not legal advice; no N-400 form help; no English reading/writing test modules (mentioned as future work); no claim of USCIS affiliation; no real Alexa+ device integration (impossible for all entrants — FAQ-verified); no account system/multi-tenant auth.

## Key differentiator
The only observed entry where the platform's modality *is* the exam's modality — plus authentic exam mechanics nobody else models (dual-version rules, early stopping, 65/20, dynamic-answer safety), all deterministic and testable.

## Design principles
Calm, confidence-building, zero shame on wrong answers; voice-first with glanceable cards; honest labeling (simulation badge, data-source citations, dynamic-answer warnings); demo value in under 60 seconds.

## Demo scenario (<3 min)
Hook (stakes + two-tests fact) → voice drill with one wrong answer → explanation card → "Am I ready?" readiness card → mock interview early-stop moment → protocol panel showing live MCP traffic → close with impact.

## Success criteria
- Full voice loop works end-to-end on this machine with the server's real MCP responses.
- Mock interview reproduces official stopping rules exactly (tested).
- Answer matcher ≥ target accuracy on the labeled eval set with zero false-accepts on the held-out set.
- `git clone && npm install && npm start` → working demo.

## Known constraints
Web Speech API requires Chrome and an internet connection for STT; voice layer is a simulated Alexa+ surface (labeled); readiness is an estimate, not a guarantee (labeled); current-officeholder answers are flagged for self-verification rather than asserted.
