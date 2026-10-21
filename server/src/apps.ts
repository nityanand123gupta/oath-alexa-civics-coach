import { registerAppResource, RESOURCE_URI_META_KEY } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const READINESS_VIEW_URI = "ui://oath/readiness.html";
export { RESOURCE_URI_META_KEY };

/**
 * MCP Apps (SEP-1865) view: the server ships its own readiness dashboard as a
 * `ui://` resource. Any MCP Apps-capable host — our web client today, an Echo
 * Show the day Alexa+ exposes MCP Apps to third parties — can render it in a
 * sandboxed iframe and stream tool results into it via the app bridge.
 *
 * The view imports the official @modelcontextprotocol/ext-apps App class from
 * /vendor/ext-apps.js (served by this same server with CORS enabled, since
 * sandboxed views have an opaque origin).
 */
const READINESS_VIEW_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 18px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: linear-gradient(160deg, #0d1326, #131b33); color: #e9eef8; min-height: 200px;
  }
  h3 { margin: 0 0 14px; font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; color: #9aa7bf; font-weight: 600; }
  .wrap { display: flex; gap: 22px; align-items: center; }
  .gauge { position: relative; width: 128px; height: 128px; flex: none; }
  .gauge svg { transform: rotate(-90deg); }
  .val { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .val b { font-size: 27px; } .val span { font-size: 10px; color: #9aa7bf; letter-spacing: 1px; }
  .bars { flex: 1; display: flex; flex-direction: column; gap: 9px; min-width: 200px; }
  .bar .row { display: flex; justify-content: space-between; color: #9aa7bf; font-size: 12px; margin-bottom: 4px; }
  .bar .track { height: 7px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden; }
  .bar .fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #38bdf8, #6366f1); }
  .pills { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .pill { font-size: 11.5px; padding: 4px 11px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12); color: #9aa7bf; }
  .pill.accent { color: #38bdf8; border-color: rgba(56,189,248,0.4); }
  .weak { margin: 12px 0 0; padding: 0; list-style: none; }
  .weak li { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 6px 0; border-top: 1px solid rgba(255,255,255,0.07); }
  .weak .pct { color: #fb7185; font-family: monospace; }
  .badge { margin-top: 14px; font-size: 10.5px; color: #9aa7bf; }
  .badge b { color: #38bdf8; font-weight: 600; }
  #status { color: #9aa7bf; font-size: 13px; }
</style>
</head>
<body>
  <h3>Interview readiness</h3>
  <div id="status">Waiting for tool result…</div>
  <div id="content" style="display:none">
    <div class="wrap">
      <div class="gauge">
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="11"/>
          <circle id="arc" cx="64" cy="64" r="54" fill="none" stroke="#38bdf8" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 340"/>
        </svg>
        <div class="val"><b id="pct">–</b><span>PASS CHANCE</span></div>
      </div>
      <div class="bars" id="bars"></div>
    </div>
    <div class="pills" id="pills"></div>
    <ul class="weak" id="weak"></ul>
    <div class="badge">Rendered by the <b>Oath MCP server</b> via MCP Apps (ui:// resource + app bridge)</div>
  </div>
  <script type="module">
    import { App, PostMessageTransport } from "/vendor/ext-apps.js";

    function render(d) {
      if (!d || typeof d.passProbability !== "number") return;
      document.getElementById("status").style.display = "none";
      document.getElementById("content").style.display = "block";
      const pct = Math.round(d.passProbability * 100);
      const arc = document.getElementById("arc");
      const circ = 2 * Math.PI * 54;
      arc.setAttribute("stroke-dasharray", (pct / 100) * circ + " " + circ);
      arc.setAttribute("stroke", pct >= 90 ? "#34d399" : pct >= 70 ? "#38bdf8" : "#fb7185");
      document.getElementById("pct").textContent = pct + "%";
      document.getElementById("bars").innerHTML = (d.byCategory || []).map(c =>
        '<div class="bar"><div class="row"><span>' + c.category + '</span><span>' +
        Math.round(c.mastery * 100) + '%</span></div><div class="track"><div class="fill" style="width:' +
        Math.round(c.mastery * 100) + '%"></div></div></div>').join("");
      document.getElementById("pills").innerHTML =
        '<span class="pill">' + d.simulations.toLocaleString() + ' simulated ' + d.version + ' exams</span>' +
        '<span class="pill">avg ' + Number(d.expectedCorrect).toFixed(1) + ' correct</span>' +
        '<span class="pill accent">' + d.coverage.seen + '/' + d.coverage.total + ' practiced</span>' +
        (d.senior6520 ? '<span class="pill accent">65/20 designated test</span>' : '');
      document.getElementById("weak").innerHTML = (d.weakest || []).slice(0, 4).map(w =>
        '<li><span>' + w.question + '</span><span class="pct">' + Math.round(w.mastery * 100) + '%</span></li>').join("");
      requestAnimationFrame(() => {
        app.sendSizeChanged({ height: document.documentElement.scrollHeight + 8 });
      });
    }

    const app = new App({ name: "oath-readiness-view", version: "1.0.0" });
    app.ontoolresult = (result) => render(result.structuredContent);
    await app.connect(new PostMessageTransport(window.parent, window.parent));
  </script>
</body>
</html>`;

export function registerAppViews(server: McpServer): void {
  registerAppResource(
    server,
    "Oath Readiness Dashboard",
    READINESS_VIEW_URI,
    { description: "Interactive readiness dashboard rendered from get_readiness results" },
    async () => ({
      contents: [
        {
          uri: READINESS_VIEW_URI,
          mimeType: "text/html;profile=mcp-app",
          text: READINESS_VIEW_HTML,
        },
      ],
    })
  );
}
