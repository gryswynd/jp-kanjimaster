// Node-only smoke test for the local memory-store server. Writes a single clean
// JSON result to ./smoke-result.json (avoids shell output corruption).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = 8790;
const base = `http://localhost:${PORT}`;
const dev = 'smoke-' + Math.floor(Math.random() * 1e9);
const results = [];
const rec = (name, ok, detail) => results.push({ name, ok, detail });

const srv = spawn('node', ['index.js'], {
  env: { ...process.env, TUTOR_STORE: 'memory', ATTEST_BYPASS: 'true', PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
srv.stdout.on('data', (d) => (log += d));
srv.stderr.on('data', (d) => (log += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jget(path, headers) {
  const r = await fetch(base + path, { headers });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function jpost(path, headers, body) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

try {
  await sleep(2500);

  const h = await jget('/healthz');
  rec('health ok', h.body.ok === true, h.body);

  const q = await jget('/v1/quota', { 'X-Device-Id': dev });
  rec('free tier remaining=5', q.body.remaining === 5 && q.body.tier === 'free', q.body);

  const nodev = await jget('/v1/quota');
  rec('no device → 400 missing_device_id', nodev.status === 400 && nodev.body.reason === 'missing_device_id', nodev);

  const empty = await jpost('/v1/press-to-ask', { 'X-Device-Id': dev }, {});
  rec('empty body → 400 missing_input', empty.status === 400 && empty.body.reason === 'missing_input', empty);

  if (process.env.ANTHROPIC_API_KEY) {
    const a = await jpost('/v1/press-to-ask', { 'X-Device-Id': dev }, { text: 'How do I say I want to eat sushi?', hint: 'The student is on a lesson. Lesson id: N4.1.' });
    rec('live answer returned', a.status === 200 && !!a.body.answer, a.body);
  } else {
    rec('live answer (skipped — no ANTHROPIC_API_KEY)', true, 'skipped');
  }
} catch (e) {
  rec('threw', false, String(e));
} finally {
  srv.kill('SIGKILL');
  const passed = results.filter((r) => r.ok).length;
  writeFileSync(new URL('./smoke-result.json', import.meta.url), JSON.stringify({
    passed, total: results.length, allPass: passed === results.length, results, serverLog: log.slice(-1500),
  }, null, 2));
}
