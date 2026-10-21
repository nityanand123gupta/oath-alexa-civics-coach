import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OathMcp, type ProtocolEvent } from "./mcp";
import { createRecognizer, speak, sttSupported, stopSpeaking } from "./voice";
import { route, HELP_TEXT } from "./router";
import { CardStack } from "./components/Cards";
import { AppFrame } from "./components/AppFrame";
import { ProtocolPanel } from "./components/ProtocolPanel";
import { SetupModal, type SetupValues } from "./components/SetupModal";

interface AppView {
  uri: string;
  html: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

type AssistantState = "idle" | "listening" | "thinking" | "speaking";
interface Turn {
  role: "user" | "assistant";
  text: string;
  error?: boolean;
}

export function App() {
  const mcpRef = useRef<OathMcp>();
  if (!mcpRef.current) mcpRef.current = new OathMcp();
  const mcp = mcpRef.current;

  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [state, setState] = useState<AssistantState>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [card, setCard] = useState<Record<string, unknown> | null>(null);
  const [inSession, setInSession] = useState(false);
  const [events, setEvents] = useState<ProtocolEvent[]>([]);
  const [protocolOpen, setProtocolOpen] = useState(true);
  const [appView, setAppView] = useState<AppView | null>(null);
  const [appViewReady, setAppViewReady] = useState(false);
  const [appViewFailed, setAppViewFailed] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [textInput, setTextInput] = useState("");
  const convoRef = useRef<HTMLDivElement>(null);
  const inSessionRef = useRef(false);
  inSessionRef.current = inSession;
  const voiceOnRef = useRef(true);
  voiceOnRef.current = voiceOn;

  // ----- connection -----
  useEffect(() => {
    let cancelled = false;
    const off = mcp.onProtocol(() => setEvents([...mcp.events]));
    (async () => {
      try {
        await mcp.connect();
        if (cancelled) return;
        setConnected(true);
        const first: Turn = {
          role: "assistant",
          text:
            "Hi — I'm Oath, your citizenship interview coach. The real civics test is an oral exam, so we practice out loud. Say \"practice five questions\", \"give me a mock interview\", or \"am I ready?\" First time? Open Set up to tell me when you filed your N-400.",
        };
        setTurns([first]);
      } catch (e) {
        if (!cancelled) setConnError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    convoRef.current?.scrollTo({ top: convoRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  // ----- voice -----
  const recognizerRef = useRef<ReturnType<typeof createRecognizer>>(null);
  const handleUtteranceRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    recognizerRef.current = createRecognizer(
      (final) => handleUtteranceRef.current(final),
      (listening) => setState((s) => (listening ? "listening" : s === "listening" ? "idle" : s)),
      (err) =>
        setTurns((t) => [...t, { role: "assistant", text: `Mic error: ${err}. You can type instead.`, error: true }])
    );
  }, []);

  const say = useCallback((text: string, thenListen: boolean) => {
    if (!voiceOnRef.current) {
      setState("idle");
      if (thenListen) recognizerRef.current?.start();
      return;
    }
    setState("speaking");
    speak(
      text,
      () => {
        setState("idle");
        if (thenListen && inSessionRef.current) recognizerRef.current?.start();
      },
      () => setState("speaking")
    );
  }, []);

  // ----- core turn handler -----
  const handleUtterance = useCallback(
    async (utterance: string) => {
      const text = utterance.trim();
      if (!text) return;
      stopSpeaking();
      setTurns((t) => [...t, { role: "user", text }]);

      const routed = route(text, inSessionRef.current);

      if (routed.kind === "local") {
        if (routed.action === "setup") {
          setSetupOpen(true);
          return;
        }
        if (routed.action === "protocol") {
          setProtocolOpen((p) => !p);
          return;
        }
        if (routed.action === "stop") {
          setInSession(false);
          const bye = "Okay, session ended. Ask for your readiness anytime.";
          setTurns((t) => [...t, { role: "assistant", text: bye }]);
          say(bye, false);
          return;
        }
        setTurns((t) => [...t, { role: "assistant", text: HELP_TEXT }]);
        say(HELP_TEXT, false);
        return;
      }

      const call =
        routed.kind === "answer"
          ? { name: "answer_question", args: { answer: routed.answer } }
          : { name: routed.name, args: routed.args };

      setState("thinking");
      try {
        const res = await mcp.callTool(call.name, call.args);
        if (res.isError) {
          setTurns((t) => [...t, { role: "assistant", text: res.text, error: true }]);
          say(res.text, false);
          return;
        }
        if (res.structured) setCard(res.structured);

        // MCP Apps: if this tool declares a ui:// view, fetch it from the server
        // and render it through the app bridge (native card is the fallback).
        const viewUri = mcp.toolViewUris[call.name];
        if (viewUri && res.structured) {
          try {
            const resource = await mcp.readResource(viewUri);
            if (resource) {
              setAppViewReady(false);
              setAppViewFailed(false);
              setAppView({
                uri: viewUri,
                html: resource.text,
                args: call.args,
                result: { content: [{ type: "text", text: res.text }], structuredContent: res.structured },
              });
            }
          } catch {
            setAppView(null);
          }
        } else {
          setAppView(null);
        }

        const s = res.structured as { started?: boolean; finished?: boolean } | null;
        let nowInSession = inSessionRef.current;
        if (s?.started) nowInSession = true;
        if (s?.finished) nowInSession = false;
        setInSession(nowInSession);
        inSessionRef.current = nowInSession;

        setTurns((t) => [...t, { role: "assistant", text: res.text }]);
        say(res.text, nowInSession);
      } catch (e) {
        const msg = `Something went wrong talking to the MCP server: ${(e as Error).message}`;
        setTurns((t) => [...t, { role: "assistant", text: msg, error: true }]);
        setState("idle");
      }
    },
    [mcp, say]
  );
  handleUtteranceRef.current = handleUtterance;

  const saveSetup = useCallback(
    async (v: SetupValues) => {
      setSetupOpen(false);
      const args = Object.fromEntries(Object.entries(v).filter(([, val]) => val));
      if (Object.keys(args).length === 0) return;
      setState("thinking");
      const res = await mcp.callTool("update_profile", args);
      if (res.structured) setCard(res.structured);
      setTurns((t) => [...t, { role: "assistant", text: res.text, error: res.isError }]);
      say(res.text, false);
    },
    [mcp, say]
  );

  const chips = useMemo(
    () =>
      inSession
        ? ["I don't know", "Explain", "Stop session"]
        : ["Practice 5 questions", "Give me a mock interview", "Am I ready?", "Study plan", "Watchlist"],
    [inSession]
  );

  const hint =
    state === "listening"
      ? "Listening…"
      : state === "thinking"
        ? "Calling MCP tool…"
        : state === "speaking"
          ? "Speaking — click the ring to interrupt"
          : sttSupported()
            ? inSession
              ? "Click the ring and say your answer"
              : "Click the ring to talk"
            : "Voice needs Chrome — type below";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="torch">🗽</span>
          <h1>Oath</h1>
          <p>Citizenship interview coach · Alexa+ simulated experience</p>
        </div>
        <div className="spacer" />
        <div className="conn">
          <span className={`dot ${connected ? "ok" : ""}`} />
          {connected ? (
            <>
              <span>
                {mcp.serverInfo?.name} · MCP <code>{mcp.protocolVersion}</code>
              </span>
            </>
          ) : connError ? (
            <span>server unreachable</span>
          ) : (
            <span>connecting…</span>
          )}
        </div>
        <button className="iconbtn" onClick={() => setSetupOpen(true)}>
          ⚙ Set up
        </button>
        <button className={`iconbtn ${voiceOn ? "active" : ""}`} onClick={() => { setVoiceOn((v) => !v); stopSpeaking(); }}>
          {voiceOn ? "🔊 Voice on" : "🔇 Voice off"}
        </button>
        <button className={`iconbtn ${protocolOpen ? "active" : ""}`} onClick={() => setProtocolOpen((p) => !p)}>
          ⛓ MCP wire
        </button>
      </header>

      <main className={`main ${protocolOpen ? "with-protocol" : ""}`}>
        <section className="col">
          <div className="convo" ref={convoRef}>
            {connError && (
              <div className="bubble assistant error">
                Can't reach the Oath MCP server at /mcp — start it with <code>npm start</code> and reload. ({connError})
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`bubble ${t.role} ${t.error ? "error" : ""}`}>
                {t.text}
              </div>
            ))}
          </div>

          <div className="dock">
            <div
              className={`ring-wrap ${state}`}
              onClick={() => {
                if (state === "speaking") {
                  stopSpeaking();
                  setState("idle");
                } else if (state === "listening") {
                  recognizerRef.current?.stop();
                } else {
                  recognizerRef.current?.start();
                }
              }}
              title="Talk to Oath"
            >
              <div className="ring">
                <span className="mic">{state === "listening" ? "🎙" : state === "thinking" ? "⋯" : "🎤"}</span>
              </div>
            </div>
            <div className="hint">{hint}</div>
            <div className="chips">
              {chips.map((c) => (
                <button key={c} className="chip" onClick={() => handleUtterance(c)}>
                  {c}
                </button>
              ))}
            </div>
            <form
              className="textrow"
              onSubmit={(e) => {
                e.preventDefault();
                handleUtterance(textInput);
                setTextInput("");
              }}
            >
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={inSession ? "…or type your answer" : '…or type: "practice 5 questions"'}
              />
              <button type="submit">Send</button>
            </form>
          </div>
        </section>

        <section className="col">
          <div className="cardcol">
            {appView && !appViewFailed && (
              <div>
                <div className="mcpapp-badge">
                  ⚡ MCP App — server-shipped view <code>{appView.uri}</code> rendered via the app bridge
                </div>
                <AppFrame
                  html={appView.html}
                  client={mcp.sdkClient}
                  toolArgs={appView.args}
                  toolResult={appView.result}
                  onReady={() => setAppViewReady(true)}
                  onFail={() => setAppViewFailed(true)}
                />
              </div>
            )}
            {(!appView || appViewFailed || !appViewReady) && <CardStack structured={card} />}
            {!card && (
              <div className="card">
                <h3>Welcome</h3>
                <div className="big">Practice the real oral exam — out loud.</div>
                <p className="dim">
                  The USCIS civics test is spoken: an officer asks, you answer. Oath drills you with the official
                  question bank for <b>your</b> test version (2008 or 2025, set by your N-400 filing date), runs
                  authentic mock interviews with the real early-stop rules, and tells you your pass probability from
                  10,000 simulated exams.
                </p>
                <p className="dim">
                  Every answer is checked deterministically against USCIS's published acceptable answers — no AI
                  guessing on scoring.
                </p>
              </div>
            )}
          </div>
        </section>

        {protocolOpen && (
          <section className="col">
            <ProtocolPanel events={events} sessionId={mcp.sessionId} />
          </section>
        )}
      </main>

      <footer className="footer">
        <span>
          Simulated Alexa+ experience over a real self-hosted MCP server (spec 2025-11-25, Streamable HTTP) — the
          hackathon-sanctioned demo path.
        </span>
        <span className="sep">·</span>
        <span>Not affiliated with Amazon or USCIS. Study aid, not legal advice.</span>
      </footer>

      {setupOpen && <SetupModal onSave={saveSetup} onClose={() => setSetupOpen(false)} />}
    </div>
  );
}
