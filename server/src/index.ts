import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { buildMcpServer } from "./mcp.js";
import { Store } from "./store.js";

const here = dirname(fileURLToPath(import.meta.url));

export interface OathServer {
  close(): Promise<void>;
  port: number;
}

/**
 * Oath MCP server over Streamable HTTP (MCP spec 2025-11-25).
 * Stateful: each client session gets its own transport + McpServer instance
 * (conversation state), sharing one persistent learner store.
 */
export async function startServer(opts: { port?: number; storeFile?: string } = {}): Promise<OathServer> {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const store = new Store(opts.storeFile);
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport = sessionId ? sessions.get(sessionId) : undefined;

      if (!transport) {
        if (sessionId) {
          res.status(404).json({
            jsonrpc: "2.0",
            error: { code: -32001, message: "Session not found. Re-initialize." },
            id: null,
          });
          return;
        }
        if (!isInitializeRequest(req.body)) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: no session. Send an initialize request first." },
            id: null,
          });
          return;
        }
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            sessions.set(sid, transport!);
          },
        });
        transport.onclose = () => {
          if (transport!.sessionId) sessions.delete(transport!.sessionId);
        };
        const mcpServer = buildMcpServer({ store });
        await mcpServer.connect(transport);
      }

      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error("[mcp] request error:", e);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // GET = server->client SSE notifications stream; DELETE = session teardown
  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? sessions.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transport.handleRequest(req, res);
  };
  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  // Official MCP Apps view runtime (App + PostMessageTransport), served to
  // sandboxed ui:// views. CORS open because sandboxed iframes have an opaque
  // origin ("Origin: null") and ES-module imports are CORS-gated.
  const extAppsBundle = join(here, "..", "..", "node_modules", "@modelcontextprotocol", "ext-apps", "dist", "src", "app-with-deps.js");
  app.get("/vendor/ext-apps.js", (_req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", "text/javascript");
    res.sendFile(extAppsBundle);
  });

  // health + metadata for the demo client
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      server: "oath-civics-coach",
      protocol: "MCP 2025-11-25 (Streamable HTTP)",
      sessions: sessions.size,
    });
  });

  // static web client (built)
  const webDist = join(here, "..", "..", "web", "dist");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!mcp|api).*/, (_req, res) => res.sendFile(join(webDist, "index.html")));
  }

  const port = opts.port ?? Number(process.env.PORT ?? 3000);
  const httpServer = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });
  const actualPort = (httpServer.address() as { port: number }).port;

  return {
    port: actualPort,
    close: async () => {
      for (const t of sessions.values()) {
        try {
          await t.close();
        } catch {
          /* already closed */
        }
      }
      store.flush();
      await new Promise<void>((resolve, reject) =>
        httpServer.close((err) => (err ? reject(err) : resolve()))
      );
    },
  };
}

// Run directly (not under test)
const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href;
if (isMain || process.env.OATH_RUN === "1") {
  const { port } = await startServer();
  console.log(`
  Oath — citizenship interview coach (Alexa+ track)
  MCP endpoint : http://localhost:${port}/mcp   (spec 2025-11-25, Streamable HTTP)
  Web client   : http://localhost:${port}/
  Health       : http://localhost:${port}/api/health
`);
}
