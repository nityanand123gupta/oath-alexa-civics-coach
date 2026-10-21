import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startServer, type OathServer } from "../src/index.js";

let server: OathServer;
let tmpDir: string;

function url(): URL {
  return new URL(`http://localhost:${server.port}/mcp`);
}

async function connect(): Promise<Client> {
  const client = new Client({ name: "oath-test-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(url());
  await client.connect(transport);
  return client;
}

type ToolResult = {
  content?: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function text(r: ToolResult): string {
  return (r.content ?? []).map((c) => c.text ?? "").join(" ");
}

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "oath-test-"));
  server = await startServer({ port: 0, storeFile: join(tmpDir, "state.json") });
});

afterAll(async () => {
  await server.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("MCP protocol compliance", () => {
  it("initializes and lists all 8 tools", async () => {
    const client = await connect();
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "answer_question",
      "dynamic_watchlist",
      "explain_question",
      "get_profile",
      "get_readiness",
      "get_study_plan",
      "start_practice",
      "update_profile",
    ]);
    for (const t of tools.tools) {
      expect(t.description && t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema).toBeTruthy();
    }
    await client.close();
  });

  it("rejects tool calls with invalid arguments", async () => {
    const client = await connect();
    const res = (await client.callTool({
      name: "update_profile",
      arguments: { filingDate: "20th October" },
    })) as ToolResult;
    expect(res.isError).toBe(true);
    await client.close();
  });

  it("rejects POST without a session (except initialize)", async () => {
    const res = await fetch(`http://localhost:${server.port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("end-to-end practice journey", () => {
  it("profile → filing date sets version → practice loop updates mastery", async () => {
    const client = await connect();

    // 1. filing date AFTER cutoff -> 2025 test
    const upd = (await client.callTool({
      name: "update_profile",
      arguments: { filingDate: "2026-01-15", displayName: "Maria" },
    })) as ToolResult;
    expect(text(upd)).toContain("2025");
    expect(upd.structuredContent).toMatchObject({ testVersion: "2025" });

    // 2. start practice
    const start = (await client.callTool({
      name: "start_practice",
      arguments: { mode: "practice", count: 3 },
    })) as ToolResult;
    expect(start.structuredContent).toMatchObject({ started: true, mode: "practice", version: "2025" });
    const card = start.structuredContent!.card as { question: string; asked: number };
    expect(card.asked).toBe(1);
    expect(card.question.length).toBeGreaterThan(5);

    // 3. answer wrong on purpose -> verdict with official answers + explanation
    const wrong = (await client.callTool({
      name: "answer_question",
      arguments: { answer: "the moon landing of 1969" },
    })) as ToolResult;
    const v1 = wrong.structuredContent as { correct: boolean; officialAnswers: string[]; explanation: string | null; nextCard: unknown };
    expect(v1.correct).toBe(false);
    expect(v1.officialAnswers.length).toBeGreaterThan(0);
    expect(v1.explanation).toBeTruthy();

    // 4. answer remaining questions (give up) to finish
    const second = (await client.callTool({ name: "answer_question", arguments: { answer: "I don't know" } })) as ToolResult;
    expect((second.structuredContent as { correct: boolean }).correct).toBe(false);
    const third = (await client.callTool({ name: "answer_question", arguments: { answer: "I don't know" } })) as ToolResult;
    const v3 = third.structuredContent as { finished: boolean; summary: { asked: number; missed: unknown[] } };
    expect(v3.finished).toBe(true);
    expect(v3.summary.asked).toBe(3);
    expect(v3.summary.missed.length).toBe(3);

    // 5. readiness reflects practice
    const ready = (await client.callTool({ name: "get_readiness", arguments: { simulations: 500 } })) as ToolResult;
    const r = ready.structuredContent as { passProbability: number; coverage: { seen: number } };
    expect(r.coverage.seen).toBeGreaterThanOrEqual(3);
    expect(r.passProbability).toBeGreaterThanOrEqual(0);
    expect(r.passProbability).toBeLessThanOrEqual(1);

    // 6. profile shows progress
    const prof = (await client.callTool({ name: "get_profile", arguments: {} })) as ToolResult;
    expect((prof.structuredContent as { questionsSeen: number }).questionsSeen).toBeGreaterThanOrEqual(3);

    await client.close();
  });

  it("mock interview follows authentic 2025 early-stop rules", async () => {
    const client = await connect();
    await client.callTool({ name: "update_profile", arguments: { filingDate: "2026-01-15" } });
    const start = (await client.callTool({
      name: "start_practice",
      arguments: { mode: "mock_interview" },
    })) as ToolResult;
    expect(start.structuredContent).toMatchObject({ mode: "mock_interview", totalPlanned: 20 });
    expect(text(start)).toContain("12");

    // answer "I don't know" until early-stop fail at 9 incorrect
    let finished = false;
    let answers = 0;
    let last: ToolResult | null = null;
    while (!finished && answers < 25) {
      last = (await client.callTool({ name: "answer_question", arguments: { answer: "I don't know" } })) as ToolResult;
      answers++;
      finished = (last.structuredContent as { finished: boolean }).finished;
    }
    expect(answers).toBe(9); // authentic early stop at 9 incorrect
    const sc = last!.structuredContent as { result: string; summary: { incorrect: number } };
    expect(sc.result).toBe("fail");
    expect(sc.summary.incorrect).toBe(9);
    await client.close();
  });

  it("isolates conversation state between two concurrent sessions", async () => {
    const a = await connect();
    const b = await connect();
    await a.callTool({ name: "start_practice", arguments: { mode: "practice", count: 2 } });
    // session B has no active exam -> answer_question errors
    const resB = (await b.callTool({ name: "answer_question", arguments: { answer: "the constitution" } })) as ToolResult;
    expect(resB.isError).toBe(true);
    // session A can answer fine
    const resA = (await a.callTool({ name: "answer_question", arguments: { answer: "I don't know" } })) as ToolResult;
    expect(resA.isError ?? false).toBe(false);
    await a.close();
    await b.close();
  });

  it("65/20 profile → senior mock uses designated questions and 10/6 rules", async () => {
    const client = await connect();
    await client.callTool({
      name: "update_profile",
      arguments: { filingDate: "2026-01-15", dateOfBirth: "1955-03-10", lprSince: "2001-02-01" },
    });
    const prof = (await client.callTool({ name: "get_profile", arguments: {} })) as ToolResult;
    expect((prof.structuredContent as { senior6520: boolean }).senior6520).toBe(true);

    const start = (await client.callTool({ name: "start_practice", arguments: { mode: "mock_interview" } })) as ToolResult;
    expect((start.structuredContent as { totalPlanned: number }).totalPlanned).toBe(10);
    // pass by answering 6 correctly: read each card's official answer via explain loop is cheating;
    // instead we use the watchlist-free guarantee: answer with all acceptable answers is impossible here,
    // so simply verify fail-at-5 behavior for senior mode.
    let finished = false;
    let answers = 0;
    let last: ToolResult | null = null;
    while (!finished && answers < 15) {
      last = (await client.callTool({ name: "answer_question", arguments: { answer: "I don't know" } })) as ToolResult;
      answers++;
      finished = (last.structuredContent as { finished: boolean }).finished;
    }
    expect(answers).toBe(5); // 10 asked, pass at 6 -> fail locks at 5 wrong
    expect((last!.structuredContent as { result: string }).result).toBe("fail");
    await client.close();
  });

  it("dynamic watchlist lists election-dependent questions with USCIS link", async () => {
    const client = await connect();
    const res = (await client.callTool({ name: "dynamic_watchlist", arguments: {} })) as ToolResult;
    const sc = res.structuredContent as { items: { question: string }[]; checkUrl: string };
    expect(sc.items.length).toBeGreaterThanOrEqual(5);
    expect(sc.checkUrl).toContain("uscis.gov");
    await client.close();
  });

  it("refuses to explain the current question mid-mock (exam integrity)", async () => {
    const client = await connect();
    await client.callTool({ name: "update_profile", arguments: { filingDate: "2026-01-15" } });
    await client.callTool({ name: "start_practice", arguments: { mode: "mock_interview" } });
    const res = (await client.callTool({ name: "explain_question", arguments: {} })) as ToolResult;
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("debrief");
    // but a different, non-current question is fine to look up after the session;
    // finishing the mock restores explanations
    await client.close();
  });

  it("MCP Apps: get_readiness declares a ui:// view and the resource serves HTML", async () => {
    const client = await connect();
    const tools = await client.listTools();
    const readiness = tools.tools.find((t) => t.name === "get_readiness")!;
    const meta = (readiness as { _meta?: Record<string, unknown> })._meta ?? {};
    expect(meta["ui/resourceUri"]).toBe("ui://oath/readiness.html");

    const resources = await client.listResources();
    const uris = resources.resources.map((r) => r.uri);
    expect(uris).toContain("ui://oath/readiness.html");

    const read = await client.readResource({ uri: "ui://oath/readiness.html" });
    const first = read.contents[0] as { mimeType?: string; text?: string };
    expect(first.mimeType).toBe("text/html;profile=mcp-app");
    expect(first.text).toContain("PostMessageTransport");
    expect(first.text).toContain("ontoolresult");
    await client.close();
  });

  it("serves the ext-apps view runtime with CORS for sandboxed views", async () => {
    const res = await fetch(`http://localhost:${server.port}/vendor/ext-apps.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = await res.text();
    expect(body.length).toBeGreaterThan(100000);
  });

  it("explain_question localizes to Spanish", async () => {
    const client = await connect();
    await client.callTool({ name: "update_profile", arguments: { explanationLanguage: "es" } });
    const res = (await client.callTool({ name: "explain_question", arguments: { questionNumber: 1 } })) as ToolResult;
    const sc = res.structuredContent as { explanation: string };
    expect(sc.explanation).toMatch(/respuesta|oficial/i);
    await client.close();
  });
});
