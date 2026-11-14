// End-to-end verification for PWA manifest, last-page install button, Service Worker precaching, and full offline playback
// Run with: node test/test-pwa-offline.mjs
import { spawn } from 'child_process';
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import assert from 'assert';

const DIST = resolve('dist');
const PORT = 4179;
const CDP_PORT = 9261;

// 1. Static verification of generated PWA artifacts & SW asset list
assert(existsSync(resolve(DIST, 'sw.js')), 'dist/sw.js must exist');
assert(existsSync(resolve(DIST, 'sidescroll-panorama/manifest.webmanifest')), 'manifest.webmanifest must exist');
for (const icon of ['icon-180.png', 'icon-192.png', 'icon-512.png']) {
  assert(existsSync(resolve(DIST, 'sidescroll-panorama/icons', icon)), `Icon ${icon} must exist`);
}

const swText = readFileSync(resolve(DIST, 'sw.js'), 'utf-8');
const coreMatch = swText.match(/const CORE_URLS = (\[[\s\S]*?\]);/);
const mediaMatch = swText.match(/const MEDIA_URLS = (\[[\s\S]*?\]);/);
assert(coreMatch && mediaMatch, 'CORE_URLS and MEDIA_URLS must be present in sw.js');
const allUrls = [...JSON.parse(coreMatch[1]), ...JSON.parse(mediaMatch[1])];
for (const rel of allUrls) {
  const filePath = resolve(DIST, rel.slice(2));
  assert(existsSync(filePath), `Precached asset missing on disk: ${rel}`);
}
console.log(`✓ Verified ${allUrls.length} precache URLs exist in dist/`);

// 2. Start preview server + clean headless Chrome profile to verify runtime SW caching & offline reload
const userDataDir = mkdtempSync(resolve(tmpdir(), 'pwa-chrome-'));
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});

await new Promise(r => setTimeout(r, 1500));

const chrome = spawn('google-chrome-stable', [
  '--headless=new',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${userDataDir}`,
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=412,915',
  `http://localhost:${PORT}/sidescroll-panorama/`,
]);

await new Promise(r => setTimeout(r, 2000));

try {
  const versionRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
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
      consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
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

  const sendCdp = (method, params = {}) => new Promise((res) => {
    const msgId = id++;
    pending.set(msgId, res);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  const evalExpr = async (expr) => {
    const res = await sendCdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.result?.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`);
    }
    return res.result?.result?.value;
  };

  await sendCdp('Runtime.enable');
  await sendCdp('Page.enable');
  await sendCdp('Network.enable');

  // Verify install button on last page
  const btnText = await evalExpr(`document.querySelector('#scene-' + (document.querySelectorAll('.scene-station').length - 1) + ' #btn-install-pwa .pwa-btn-label')?.textContent.trim()`);
  assert.strictEqual(btnText, 'Click to install this on your device', 'Last page must contain the install button');

  // Wait for SW registration and full asset caching
  const cacheResult = await evalExpr(`(async () => {
    const reg = await navigator.serviceWorker.ready;
    const worker = reg.active;
    if (!worker) throw new Error('No active SW');
    return await new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => resolve(e.data);
      worker.postMessage({ type: 'PRECACHE_ALL' }, [ch.port2]);
    });
  })()`);
  assert(cacheResult && cacheResult.done && cacheResult.failed === 0, `SW precache failed: ${JSON.stringify(cacheResult)}`);
  assert.strictEqual(cacheResult.cached, allUrls.length, 'Every SW URL must be cached');
  console.log(`✓ Service Worker cached ${cacheResult.cached}/${cacheResult.total} assets`);

  // Verify clicking install button opens fallback modal (when native prompt is blocked/absent)
  await evalExpr(`document.getElementById('btn-install-pwa').click()`);
  await new Promise(r => setTimeout(r, 300));
  const dialogOpen = await evalExpr(`document.getElementById('pwa-install-dialog').open`);
  assert.strictEqual(dialogOpen, true, 'Install guide dialog must open on click when native prompt cannot show');
  await evalExpr(`document.getElementById('pwa-install-dialog').close()`);

  // Enable offline mode and reload page
  await sendCdp('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });

  await sendCdp('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 2000));

  const offlineState = await evalExpr(`(async () => {
    const imgs = Array.from(document.querySelectorAll('.character-img, .panorama-backdrop-img'));
    await Promise.all(imgs.map(img => img.complete ? null : new Promise(r => { img.onload = r; img.onerror = r; })));
    const brokenImgs = imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
    const audioSrc = document.getElementById('bgm-audio').src;
    const rangeRes = await fetch(audioSrc, { headers: { Range: 'bytes=0-1023' } });
    return {
      title: document.title,
      hasBtn: !!document.getElementById('btn-install-pwa'),
      imgCount: imgs.length,
      brokenImgs,
      audioStatus: rangeRes.status,
      contentRange: rangeRes.headers.get('Content-Range'),
    };
  })()`);

  assert.strictEqual(offlineState.hasBtn, true, 'Install button must render offline');
  assert(offlineState.imgCount > 45, `Expected all story images offline, got ${offlineState.imgCount}`);
  assert.deepStrictEqual(offlineState.brokenImgs, [], `Broken images offline: ${offlineState.brokenImgs.join(', ')}`);
  assert.strictEqual(offlineState.audioStatus, 206, `Offline Range request for bgm.mp3 must return 206, got ${offlineState.audioStatus}`);
  assert(offlineState.contentRange?.startsWith('bytes 0-1023/'), `Unexpected Content-Range: ${offlineState.contentRange}`);
  assert.deepStrictEqual(consoleErrors, [], `Unexpected console errors: ${consoleErrors.join('; ')}`);

  console.log(`✓ Offline reload passed: ${offlineState.imgCount} images + 206 audio range (${offlineState.contentRange}) + 0 console errors`);
  ws.close();
} finally {
  chrome.kill();
  preview.kill();
  rmSync(userDataDir, { recursive: true, force: true });
}
