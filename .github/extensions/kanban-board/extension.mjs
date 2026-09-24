// Extension: kanban-board
// Kanban triage board showing top-3 priority issues and a second section for the rest

import { createServer } from "node:http";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";

const servers = new Map(); // instanceId -> { server, url }

// Sample issue set. In a later iteration this can be sourced from GitHub,
// a project board, or the workspace. Each issue has a small "score" used to
// rank triage priority; higher is more urgent.
const SAMPLE_ISSUES = [
  { id: 101, title: "Build failing on main: missing env var", description: "CI job fails because SECRET_KEY is missing from workflow; multiple recent deploys blocked.", score: 98, meta: "failing-ci,needs-investigation" },
  { id: 102, title: "Crash on level load in VR goggles", description: "NullRef when loading textures on older GPUs; reproducer attached.", score: 92, meta: "regression,high-impact" },
  { id: 103, title: "Payment provider 502 errors", description: "Intermittent 502s when submitting payments; reported by multiple customers.", score: 89, meta: "customer-facing,urgent" },
  { id: 104, title: "Accessibility: missing alt text on product images", description: "A11y audit flagged missing alt attributes on many product images.", score: 45, meta: "a11y,low-risk" },
  { id: 105, title: "Update docs for new pricing tiers", description: "Docs need pricing tables updated before next release.", score: 30, meta: "docs" },
  { id: 106, title: "Refactor payment form into component", description: "Technical debt item to simplify testing and reuse.", score: 20, meta: "tech-debt" },
];

function pickTopThree(issues) {
  const copy = [...issues];
  copy.sort((a,b) => b.score - a.score);
  const top = copy.slice(0,3);
  const rest = copy.slice(3);
  return { top, rest };
}

function justify(issue) {
  // Simple heuristics for justification text.
  if (issue.meta.includes("failing-ci")) return "CI failing and blocking deploys — high urgency.";
  if (issue.meta.includes("customer-facing")) return "Reported by customers; immediate impact for users.";
  if (issue.meta.includes("regression")) return "Recent regression affecting core functionality.";
  if (issue.score > 80) return "High priority based on score and recent reports.";
  return "Lower priority; schedule when convenient.";
}

function renderHtml(instanceId, issues) {
  const { top, rest } = pickTopThree(issues);
  const topHtml = top.map(issue => `
    <div class="card top">
      <h3>${escapeHtml(issue.title)} <small>#${issue.id}</small></h3>
      <p>${escapeHtml(issue.description)}</p>
      <p class="justification"><strong>Why now:</strong> ${escapeHtml(justify(issue))}</p>
      <button onclick="addToContext(${issue.id})">Add to current session context</button>
    </div>
  `).join("\n");

  const restHtml = rest.map(issue => `
    <div class="card rest">
      <h4>${escapeHtml(issue.title)} <small>#${issue.id}</small></h4>
      <p>${escapeHtml(issue.description)}</p>
      <button onclick="addToContext(${issue.id})">Add to current session context</button>
    </div>
  `).join("\n");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Kanban — Triage</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      :root { color-scheme: dark; }
      body { margin:0; padding:16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; background: var(--background-color-default, #0b1220); color: var(--text-color-default, #e6eef8); }
      h1 { margin:0 0 12px 0; font-size:20px }
      .section { margin-bottom:18px }
      .cards { display:flex; gap:12px; flex-wrap:wrap }
      .card { background: rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.04); padding:12px; border-radius:8px; width:320px; box-sizing:border-box }
      .card.top { box-shadow: 0 6px 18px rgba(0,0,0,0.5); border-color: rgba(255,200,100,0.12) }
      .card h3, .card h4 { margin:0 0 8px 0 }
      .card p { margin:6px 0 }
      .justification { color: var(--text-color-muted, #9fb0c9); font-size:13px }
      button { background: linear-gradient(180deg, var(--true-color-blue, #2563EB), #1E40AF); color:white; border:0; padding:8px 10px; border-radius:6px; cursor:pointer }
      button:active { transform:translateY(1px) }
      .muted { color:var(--text-color-muted, #9fb0c9); font-size:13px }
    </style>
  </head>
  <body>
    <h1>Kanban — Triage</h1>
    <div class="section">
      <h2>Top 3 — Need attention now</h2>
      <div class="cards">${topHtml}</div>
    </div>
    <div class="section">
      <h2>Other issues</h2>
      <div class="cards">${restHtml}</div>
    </div>

    <div id="status" class="muted">Ready.</div>

    <script>
      async function addToContext(issueId) {
        setStatus('Adding issue ' + issueId + ' to session...');
        try {
          const res = await fetch('/add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issueId })
          });
          const json = await res.json();
          if (json.ok) setStatus('Added to session: ' + issueId);
          else setStatus('Failed: ' + (json.error || 'unknown'));
        } catch (err) { setStatus('Error: ' + err.message); }
      }
      function setStatus(t){ document.getElementById('status').textContent = t }
    </script>
  </body>
</html>`;
}

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function startServer(instanceId) {
  const server = createServer(async (req, res) => {
    try {
      if (req.url === '/' && req.method === 'GET') {
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end(renderHtml(instanceId, SAMPLE_ISSUES));
        return;
      }

      if (req.url === '/issues' && req.method === 'GET') {
        res.setHeader('Content-Type','application/json; charset=utf-8');
        res.end(JSON.stringify(SAMPLE_ISSUES));
        return;
      }

      if (req.url === '/add' && req.method === 'POST') {
        // read body
        let body = '';
        for await (const chunk of req) body += chunk;
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch(e) { parsed = {}; }
        const issueId = parsed.issueId;
        const issue = SAMPLE_ISSUES.find(i => i.id === Number(issueId));
        if (!issue) {
          res.statusCode = 400; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ ok:false, error:'issue not found' }));
          return;
        }

        // Inject the issue into the current session's context by sending a user message
        // describing the issue so the agent can act on it. Use session.send where
        // available. This is best-effort; surface errors back to the caller.
        try {
          // Send a concise message into the session to bring the issue into context.
          await session.send({ text: `Working on issue #${issue.id}: ${issue.title}\n\n${issue.description}` });
          res.setHeader('Content-Type','application/json');
          res.end(JSON.stringify({ ok:true }));
          return;
        } catch (err) {
          // session.send may not be available in some host configs; return an error.
          res.statusCode = 500; res.setHeader('Content-Type','application/json');
          res.end(JSON.stringify({ ok:false, error: String(err && err.message ? err.message : err) }));
          return;
        }
      }

      // not found
      res.statusCode = 404; res.end('Not found');
    } catch (e) {
      res.statusCode = 500; res.end('Server error');
    }
  });

  await new Promise((resolve)=> server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { server, url: `http://127.0.0.1:${port}/` };
}

const session = await joinSession({
  canvases: [
    createCanvas({
      id: 'kanban-board',
      displayName: 'Kanban Triage Board',
      description: 'Quick triage: top-3 issues that need attention and a list of others; add any to the current session context',
      actions: [
        {
          name: 'refresh',
          description: 'Refresh the canvas data (recompute top issues)',
          handler: async (ctx) => {
            // no-op for now; the iframe reads server-side sample data on load
            return { ok:true };
          }
        },
        {
          name: 'add_to_context',
          description: 'Add the given issue to the current session context',
          inputSchema: { type: 'object', properties: { issueId: { type: 'number' } }, required: ['issueId'] },
          handler: async (ctx) => {
            const issueId = ctx.input && ctx.input.issueId;
            const issue = SAMPLE_ISSUES.find(i => i.id === Number(issueId));
            if (!issue) throw new CanvasError('not_found', 'Issue not found');
            await session.send({ text: `Working on issue #${issue.id}: ${issue.title}\n\n${issue.description}` });
            return { ok:true };
          }
        }
      ],
      open: async (ctx) => {
        let entry = servers.get(ctx.instanceId);
        if (!entry) {
          entry = await startServer(ctx.instanceId);
          servers.set(ctx.instanceId, entry);
        }
        return { title: 'Kanban — Triage', url: entry.url };
      },
      onClose: async (ctx) => {
        const entry = servers.get(ctx.instanceId);
        if (entry) {
          servers.delete(ctx.instanceId);
          await new Promise((r)=> entry.server.close(()=> r()));
        }
      }
    })
  ]
});
