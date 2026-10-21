import { useEffect, useRef } from "react";
import type { ProtocolEvent } from "../mcp";

export function ProtocolPanel({ events, sessionId }: { events: ProtocolEvent[]; sessionId?: string }) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [events.length]);

  return (
    <div className="protocol">
      <header>
        <b>MCP wire</b> · Streamable HTTP · spec 2025-11-25
        {sessionId && <span style={{ marginLeft: "auto" }}>session {sessionId.slice(0, 8)}…</span>}
      </header>
      <div className="plog" ref={logRef}>
        {events.length === 0 && <div className="pevent">Waiting for traffic…</div>}
        {events.map((e, i) => {
          const method =
            e.method ??
            (typeof e.body === "object" && e.body !== null && "result" in (e.body as object)
              ? "result"
              : "message");
          return (
            <div key={i} className="pevent">
              <div className="meta">
                <span className={e.direction === "request" ? "dir-req" : "dir-res"}>
                  {e.direction === "request" ? "→ POST /mcp" : `← ${e.status ?? ""}`}
                </span>
                <span>{method}</span>
                <span>{new Date(e.at).toLocaleTimeString()}</span>
              </div>
              <pre>{JSON.stringify(e.body, null, 1)}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
