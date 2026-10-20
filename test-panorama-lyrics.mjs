// Self-check test for dynamic background lyrics in sidescroll-panorama
// Run with: uv run node test-panorama-lyrics.mjs
import { spawn } from 'child_process';
import assert from 'assert';
import lyricsData from './resources/lyrics.json' with { type: 'json' };

assert.strictEqual(lyricsData.length, 44, 'lyrics.json must contain 44 lines');

const chrome = spawn('google-chrome-stable', [
  '--headless=new',
  '--remote-debugging-port=9230',
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1600,900',
  'http://localhost:5173/sidescroll-panorama/'
]);

await new Promise(r => setTimeout(r, 1600));

try {
  const versionRes = await fetch('http://127.0.0.1:9230/json');
  const targets = await versionRes.json();
  const pageTarget = targets.find(t => t.type === 'page');
  assert(pageTarget, 'Panorama page target must exist');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  const consoleErrors = [];

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      consoleErrors.push(data.params.args.map(a => a.value).join(' '));
    }
    if (data.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('EXCEPTION: ' + JSON.stringify(data.params.exceptionDetails));
    }
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };
  await new Promise(r => ws.onopen = r);

  const evalExpr = async (expr) => {
    const msgId = id++;
    const res = await new Promise(res => {
      pending.set(msgId, res);
      ws.send(JSON.stringify({ id: msgId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    });
    return res.result?.result?.value;
  };

  // 1. Verify 44 lyric elements rendered
  const count = await evalExpr("document.querySelectorAll('.lyric-item').length");
  assert.strictEqual(count, 44, 'Must render exactly 44 lyric elements');

  // 2. Verify 3 depth layers exist
  const deepCount = await evalExpr("document.querySelectorAll('.lyrics-layer-deep .lyric-item').length");
  const midCount = await evalExpr("document.querySelectorAll('.lyrics-layer-mid .lyric-item').length");
  const foreCount = await evalExpr("document.querySelectorAll('.lyrics-layer-foreground .lyric-item').length");
  assert(deepCount > 0, 'Deep layer must contain elements');
  assert(midCount > 0, 'Mid layer must contain elements');
  assert(foreCount > 0, 'Foreground layer must contain elements');
  assert.strictEqual(deepCount + midCount + foreCount, 44, 'Sum of layers must equal 44');

  // 3. Verify initial visible lyrics at S = 0
  const initialActive = JSON.parse(await evalExpr(
    'JSON.stringify(Array.from(document.querySelectorAll(\".lyric-item\")).filter(el => el.style.display !== \"none\").map(el => el.textContent.trim()))'
  ));
  assert(initialActive.includes('Happiness hit her like a train on a track'), 'Initial active lyrics must include first line');
  assert(!initialActive.some(t => t.includes('(Here they come)')), 'Finale echo lines must not appear at start');

  // 4. Verify scrolling transitions to new lyrics and hides previous
  await evalExpr("window.scrollToScene(2)");
  await new Promise(r => setTimeout(r, 1100));
  await evalExpr("window.handleScroll()");

  const scene2Active = JSON.parse(await evalExpr(
    'JSON.stringify(Array.from(document.querySelectorAll(\".lyric-item\")).filter(el => el.style.display !== \"none\").map(el => el.textContent.trim()))'
  ));
  assert(scene2Active.length >= 1, 'Scene 2 must have active lyrics');
  assert(!scene2Active.includes('Happiness hit her like a train on a track'), 'Scene 1/0 lyrics must be culled');

  // 5. Verify maxScroll contains song finale
  await evalExpr("const vp = document.getElementById('panorama-viewport'); vp.scrollLeft = vp.scrollWidth - vp.clientWidth;");
  await evalExpr("window.handleScroll()");
  const finaleActive = JSON.parse(await evalExpr(
    'JSON.stringify(Array.from(document.querySelectorAll(\".lyric-item\")).filter(el => el.style.display !== \"none\").map(el => el.textContent.trim()))'
  ));
  assert(finaleActive.some(t => t.includes('better run')), 'Finale must include ending run lines');

  assert.strictEqual(consoleErrors.length, 0, 'Must have zero runtime console errors');

  ws.close();
  console.log('✅ test-panorama-lyrics passed: 44 lines, 3 depth planes, culling, and transitions verified.');
} finally {
  chrome.kill();
}
