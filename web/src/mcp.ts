import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface ProtocolEvent {
  at: number;
  direction: "request" | "response";
  method?: string;
  sessionId?: string;
  body: unknown;
  status?: number;
}

export interface ToolResult {
  text: string;
  structured: Record<string, unknown> | null;
  isError: boolean;
}

type ProtocolListener = (e: ProtocolEvent) => void;

/**
 * Real MCP client (official SDK, Streamable HTTP, spec 2025-11-25) with a
 * protocol tap: every JSON-RPC request/response to /mcp is logged so the UI
 * can prove the integration is live — exactly the demo format the hackathon
 * FAQ endorses (initialize → tools/list → tools/call).
 */
export class OathMcp {
  private client: Client | null = null;
  private listeners = new Set<ProtocolListener>();
  private _sessionId: string | undefined;
  readonly events: ProtocolEvent[] = [];
  toolNames: string[] = [];
  serverInfo: { name: string; version: string } | null = null;
  protocolVersion: string | null = null;

  onProtocol(fn: ProtocolListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: ProtocolEvent): void {
    this.events.push(e);
    if (this.events.length > 200) this.events.shift();
    for (const fn of this.listeners) fn(e);
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  /** fetch wrapper that taps JSON-RPC traffic for the protocol panel. */
  private tappedFetch: typeof fetch = async (input, init) => {
    let reqBody: unknown = undefined;
    if (init?.body && typeof init.body === "string") {
      try {
        reqBody = JSON.parse(init.body);
      } catch {
        reqBody = init.body;
      }
    }
    if (reqBody) {
      const method = (reqBody as { method?: string }).method;
      this.emit({ at: Date.now(), direction: "request", method, body: reqBody, sessionId: this._sessionId });
    }
    const res = await fetch(input, init);
    const sid = res.headers.get("mcp-session-id");
    if (sid) this._sessionId = sid;

    const clone = res.clone();
    const ctype = res.headers.get("content-type") ?? "";
    (async () => {
      try {
        if (ctype.includes("application/json")) {
          const body = await clone.json();
          this.emit({ at: Date.now(), direction: "response", status: res.status, body, sessionId: this._sessionId });
        } else if (ctype.includes("text/event-stream")) {
          const txt = await clone.text();
          const datas = txt
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => {
              try {
                return JSON.parse(l.slice(5));
              } catch {
                return l.slice(5).trim();
              }
            });
          for (const d of datas) {
            this.emit({ at: Date.now(), direction: "response", status: res.status, body: d, sessionId: this._sessionId });
          }
        }
      } catch {
        /* tap only — never break the real request */
      }
    })();
    return res;
  };

  async connect(): Promise<void> {
    const url = new URL("/mcp", window.location.origin);
    const transport = new StreamableHTTPClientTransport(url, { fetch: this.tappedFetch });
    const client = new Client({ name: "oath-alexa-sim", version: "1.0.0" });
    await client.connect(transport);
    this.client = client;
    const sv = client.getServerVersion();
    this.serverInfo = sv ? { name: sv.name, version: sv.version } : null;
    this.protocolVersion = "2025-11-25";
    const tools = await client.listTools();
    this.toolNames = tools.tools.map((t) => t.name);
  }

  get connected(): boolean {
    return this.client !== null;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.client) throw new Error("Not connected");
    const res = (await this.client.callTool({ name, arguments: args })) as {
      content?: { type: string; text?: string }[];
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };
    return {
      text: (res.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join(" ")
        .trim(),
      structured: res.structuredContent ?? null,
      isError: res.isError ?? false,
    };
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
  }
}
