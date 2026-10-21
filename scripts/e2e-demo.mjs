#!/usr/bin/env node
/**
 * End-to-end proof script: drives the Oath MCP server through the official
 * MCP TypeScript SDK client over Streamable HTTP — the exact journey the demo
 * video shows. Run `npm start` in another terminal first, then:
 *
 *   node scripts/e2e-demo.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = process.env.OATH_URL ?? "http://localhost:3000/mcp";

const client = new Client({ name: "e2e-proof", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(BASE)));
console.log(`connected to ${BASE}`);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const t = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  const text = (r.content ?? []).map((c) => c.text).join(" ");
  console.log(`\n== ${name} ${JSON.stringify(args)}`);
  console.log("  ", text.slice(0, 260));
  return r;
};

await t("update_profile", { filingDate: "2026-01-15", interviewDate: "2026-12-15", displayName: "Maria", explanationLanguage: "es" });
await t("start_practice", { mode: "practice", count: 3 });
await t("answer_question", { answer: "the Constitution" });
await t("answer_question", { answer: "I don't know" });
await t("answer_question", { answer: "freedom of speech and freedom of religion" });
await t("get_readiness", { simulations: 2000 });
await t("get_study_plan", {});
await t("dynamic_watchlist", {});
await t("start_practice", { mode: "mock_interview" });
await t("answer_question", { answer: "I don't know" });

await client.close();
console.log("\nE2E COMPLETE ✓");
