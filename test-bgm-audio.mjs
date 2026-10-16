// Self-check test for BGM audio player in sidescroll-panorama
// Run with: uv run node test-bgm-audio.mjs
import { spawn } from 'child_process';
import assert from 'assert';

const chrome = spawn('google-chrome-stable', [
  '--headless=new',
  '--remote-debugging-port=9252',
  '--no-sandbox',
  '--disable-gpu',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=1280,800',
  'http://localhost:5173/sidescroll-panorama/'
]);

await new Promise(r => setTimeout(r, 1600));

try {
  const versionRes = await fetch('http://127.0.0.1:9252/json');
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

  // 1. Verify audio element exists
  const hasAudio = await evalExpr("!!document.getElementById('bgm-audio')");
  assert.strictEqual(hasAudio, true, '<audio id="bgm-audio"> element must exist');

  // 2. Verify audio source points to bgm.mp3
  const audioSrc = await evalExpr("document.getElementById('bgm-audio').src");
  assert(audioSrc.includes('bgm.mp3'), `Audio src must reference bgm.mp3 (got: ${audioSrc})`);

  // 3. Verify music button exists
  const hasBtn = await evalExpr("!!document.getElementById('btn-music')");
  assert.strictEqual(hasBtn, true, '<button id="btn-music"> must exist');

  // 4. Toggle BGM to play
  await evalExpr("window.toggleBgm()");
  await new Promise(r => setTimeout(r, 600));

  const isPlaying = await evalExpr("!document.getElementById('bgm-audio').paused");
  const hasPlayingClass = await evalExpr("document.getElementById('btn-music').classList.contains('is-playing')");
  assert.strictEqual(isPlaying, true, 'Audio must be playing after toggleBgm()');
  assert.strictEqual(hasPlayingClass, true, 'btn-music must have is-playing class');

  // 5. Toggle BGM to pause
  await evalExpr("window.toggleBgm()");
  await new Promise(r => setTimeout(r, 400));

  const isPaused = await evalExpr("document.getElementById('bgm-audio').paused");
  const hasPausedClass = await evalExpr("document.getElementById('btn-music').classList.contains('is-paused')");
  assert.strictEqual(isPaused, true, 'Audio must be paused after second toggleBgm()');
  assert.strictEqual(hasPausedClass, true, 'btn-music must have is-paused class');

  assert.strictEqual(consoleErrors.length, 0, `Must have zero console errors (got: ${consoleErrors.join(', ')})`);

  ws.close();
  console.log('✅ test-bgm-audio passed: audio element, src, playback toggle, and UI states verified.');
} finally {
  chrome.kill();
}
