// Self-check test for flipbook boundary guards and layer transitions
// Run with: uv run node test-check.mjs
import { spawn } from 'child_process';
import assert from 'assert';
import storyBoard from './resources/story-board.json' with { type: 'json' };

const chrome = spawn('google-chrome-stable', [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--no-sandbox',
  '--disable-gpu',
  'http://localhost:5173/page-flip/'
]);

await new Promise(r => setTimeout(r, 1200));

try {
  const versionRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await versionRes.json();
  const pageTarget = targets.find(t => t.type === 'page');
  assert(pageTarget, 'Page target must exist');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
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

  const getIndicator = () => evalExpr(`document.getElementById('page-indicator').textContent.trim()`);
  const getActiveCount = () => evalExpr(`document.querySelectorAll('.c-flipbook__page.is-active').length`);

  const innerPages = storyBoard.pages.slice(1, -1);
  const numSpreads = Math.ceil(innerPages.length / 2);

  // Check initial state
  assert.strictEqual(await getIndicator(), 'Cover', 'Initial page must be Cover');
  assert.strictEqual(await getActiveCount(), 1, 'Only Cover must be active initially');

  // Turn through all spreads
  for (let s = 1; s <= numSpreads; s++) {
    const pLeft = (s - 1) * 2 + 1;
    const pRight = pLeft + 1;
    const expected = `Pages ${pLeft}-${pRight}`;
    await evalExpr(`document.getElementById('btn-next').click()`);
    await new Promise(r => setTimeout(r, 1100));
    assert.strictEqual(await getIndicator(), expected, `Should be at ${expected}`);
    assert.strictEqual(await getActiveCount(), 2, 'Two pages must be active on spread');
  }

  // Turn to End
  await evalExpr(`document.getElementById('btn-next').click()`);
  await new Promise(r => setTimeout(r, 1100));
  assert.strictEqual(await getIndicator(), 'The End', 'Should be at The End');
  assert.strictEqual(await getActiveCount(), 1, 'Only Back Cover must be active');

  // Forward at End: must NOT overflow
  await evalExpr(`document.getElementById('btn-next').click()`);
  await new Promise(r => setTimeout(r, 200));
  await evalExpr(`document.getElementById('btn-next').click()`);
  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(await getIndicator(), 'The End', 'Must not overflow past The End');
  assert.strictEqual(await getActiveCount(), 1, 'Back Cover must remain active');

  // Turn back to Cover through all spreads
  for (let s = 0; s <= numSpreads; s++) {
    await evalExpr(`document.getElementById('btn-prev').click()`);
    await new Promise(r => setTimeout(r, 1100));
  }
  assert.strictEqual(await getIndicator(), 'Cover', 'Must return to Cover');
  assert.strictEqual(await getActiveCount(), 1, 'Cover must be active');

  // Back at Cover: must NOT underflow
  await evalExpr(`document.getElementById('btn-prev').click()`);
  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(await getIndicator(), 'Cover', 'Must remain at Cover');

  ws.close();
  console.log('✅ Self-check passed: All boundary conditions and active layers verified.');
} finally {
  chrome.kill();
}
