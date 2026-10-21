/**
 * Answer-matcher evaluation against a labeled set of realistic spoken answers.
 * Reports accuracy, false-accepts (worst failure mode for an exam coach), and
 * false-rejects, split by main vs held-out cases. Run: npm run eval
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getBank, matchAnswer } from "../../src/index.js";

interface EvalCase {
  version: "2008" | "2025";
  number: number;
  answer: string;
  expect: boolean;
  why: string;
  held_out?: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
const { cases } = JSON.parse(readFileSync(join(here, "cases.json"), "utf8")) as { cases: EvalCase[] };

let pass = 0;
let falseAccept = 0;
let falseReject = 0;
const failures: string[] = [];
const buckets = { main: { pass: 0, total: 0 }, held_out: { pass: 0, total: 0 } };

for (const c of cases) {
  const bank = getBank(c.version);
  const q = bank.questions.find((x) => x.number === c.number);
  if (!q) {
    failures.push(`MISSING QUESTION ${c.version}#${c.number}`);
    continue;
  }
  const verdict = matchAnswer(q, c.answer, { dynamicSelfCheck: false });
  const accepted = verdict.kind === "correct";
  const ok = accepted === c.expect;
  const bucket = c.held_out ? buckets.held_out : buckets.main;
  bucket.total++;
  if (ok) {
    pass++;
    bucket.pass++;
  } else {
    if (accepted && !c.expect) falseAccept++;
    else falseReject++;
    failures.push(
      `${ok ? "PASS" : "FAIL"} [${c.held_out ? "held-out" : "main"}] ${c.version}#${c.number} "${c.answer}" expected ${
        c.expect ? "ACCEPT" : "REJECT"
      } got ${accepted ? "ACCEPT" : "REJECT"} (${c.why})`
    );
  }
}

const total = cases.length;
console.log(`\nOath answer-matcher eval — ${total} labeled cases`);
console.log(`  overall accuracy : ${pass}/${total} (${((pass / total) * 100).toFixed(1)}%)`);
console.log(`  main set         : ${buckets.main.pass}/${buckets.main.total}`);
console.log(`  held-out set     : ${buckets.held_out.pass}/${buckets.held_out.total}`);
console.log(`  false accepts    : ${falseAccept}  <- must be 0 for exam integrity`);
console.log(`  false rejects    : ${falseReject}`);
if (failures.length) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  ${f}`);
}
process.exitCode = falseAccept > 0 ? 1 : 0;
