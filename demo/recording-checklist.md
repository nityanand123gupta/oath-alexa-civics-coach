# Recording & Upload Checklist

## Before recording
- [ ] `cd oath && npm run build && npm start` → open http://localhost:3000 in **Chrome** (voice needs Chrome + internet).
- [ ] Grant microphone permission once (click the ring, allow).
- [ ] FIRST-TIME VERIFICATION (one minute, important): run "Am I ready?" once and confirm the ⚡ MCP App dashboard renders inside the frame. If it shows the native card instead, the fallback fired — still fine to record, just skip the MCP-Apps sentence in the script.
- [ ] Delete `server/data/state.json`, restart server, then do the warm-up practice round (seeds readiness data).
- [ ] Quiet room; close other tabs; hide bookmarks bar; OS notifications off; 100% browser zoom.
- [ ] Recorder: OBS / Xbox Game Bar (Win+G) / any screen recorder at 1080p with **system audio + mic**.
- [ ] Do one full dry run with the script open on a phone/second screen.

## During
- [ ] Speak answers naturally — if STT mangles one, say "repeat the question" or just re-take that segment.
- [ ] Keep total under 2:45 raw; judges stop at 3:00.

## After recording
- [ ] Watch it once fully: audio audible? UI readable? Nothing sensitive on screen?
- [ ] Take one clean screenshot of the app (readiness view), save as `docs/screenshot.png`, re-add `![demo](docs/screenshot.png)` under the README title, commit + push.
- [ ] Upload to YouTube: **Public** (not unlisted — rules say public), English title/description. Suggested title: "Oath — Citizenship Interview Coach for Alexa+ (MCP server) | Amazon Developer Hackathon". Description: one-paragraph pitch + repo link.
- [ ] Open the YouTube link in an incognito window to verify it's publicly visible.
- [ ] Paste the final URL into the Devpost form and into README ("Demo video" line under the title).

## Devpost submission (allow 30 min, finish by Oct 23, 10:30 PM IST)
- [ ] All field texts are ready in `C:\Users\p\Desktop\Amazon\submission\` — copy-paste in order: title, short description, full description, track selection, product feedback, feature requests, friction log.
- [ ] Repo URL: https://github.com/nityanand123gupta/oath-alexa-civics-coach (public, MIT — no collaborator invites needed for public repos).
- [ ] Open Source mini fields: contribution URL + repo URL = https://github.com/nityanand123gupta/civics-test-kit · GitHub username: nityanand123gupta.
- [ ] Click through to final confirmation and verify the submission shows as received.
