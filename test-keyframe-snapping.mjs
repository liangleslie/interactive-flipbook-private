// Self-check test for keyframe snapping engine in sidescroll-panorama
// Run with: uv run node test-keyframe-snapping.mjs
import { spawn } from 'child_process';
import assert from 'assert';

const chrome = spawn('google-chrome-stable', [
  '--headless=new',
  '--remote-debugging-port=9250',
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1280,800',
  'http://localhost:5173/sidescroll-panorama/'
]);

await new Promise(r => setTimeout(r, 1600));

try {
  const versionRes = await fetch('http://127.0.0.1:9250/json');
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

  // 1. Verify keyframes (2 per page: upper and lower)
  const sceneCount = await evalExpr("document.querySelectorAll('.scene-station').length");
  const kfCount = await evalExpr("window.getKeyframes().length");
  assert.strictEqual(kfCount, sceneCount * 2, `Must have exactly ${sceneCount * 2} keyframes for ${sceneCount} story scenes (2 per scene)`);

  // 2. Initial state: keyframe 0, upper art 100%, prevBtn disabled
  const initialIdx = await evalExpr("window.currentKeyframeIndex");
  const prevDisabled = await evalExpr("document.getElementById('btn-prev').disabled");
  const nextDisabled = await evalExpr("document.getElementById('btn-next').disabled");
  assert.strictEqual(initialIdx, 0, 'Initial keyframe must be 0');
  assert.strictEqual(prevDisabled, true, 'Prev button must be disabled at keyframe 0');
  assert.strictEqual(nextDisabled, false, 'Next button must be enabled at keyframe 0');

  // 3. Click Next once -> Keyframe 1 (Scene 0 Lower-Art morph complete)
  await evalExpr("document.getElementById('btn-next').click()");
  await new Promise(r => setTimeout(r, 600));

  const kf1Idx = await evalExpr("window.currentKeyframeIndex");
  const kf1PrevDisabled = await evalExpr("document.getElementById('btn-prev').disabled");
  assert.strictEqual(kf1Idx, 1, '1st click must advance to keyframe 1 (lower-art morph)');
  assert.strictEqual(kf1PrevDisabled, false, 'Prev button must be enabled at keyframe 1');

  // Check scene 0 morph state at keyframe 1: lower-art opacity is 1, upper is 0
  const coverUpperOp = parseFloat(await evalExpr("document.querySelector('#scene-0 .upper-art').style.opacity"));
  const coverLowerOp = parseFloat(await evalExpr("document.querySelector('#scene-0 .lower-art').style.opacity"));
  assert(coverUpperOp < 0.1, 'At keyframe 1, upper-art opacity must be ~0');
  assert(coverLowerOp > 0.9, 'At keyframe 1, lower-art opacity must be ~1');

  // 4. Click Next 2nd time -> Keyframe 2 (Scene 1 Upper-Art 100% - Meet Ed)
  await evalExpr("document.getElementById('btn-next').click()");
  await new Promise(r => setTimeout(r, 1200));

  const kf2Idx = await evalExpr("window.currentKeyframeIndex");
  const scene1Label = await evalExpr("document.getElementById('chapter-label').textContent.trim()");
  assert.strictEqual(kf2Idx, 2, '2nd click must transition to keyframe 2 (Scene 1 Upper-art)');
  assert.strictEqual(scene1Label, '1: Ed', 'Chapter label must be 1: Ed');

  const edUpperOp = parseFloat(await evalExpr("document.querySelector('#scene-1 .upper-art').style.opacity"));
  const edLowerOp = parseFloat(await evalExpr("document.querySelector('#scene-1 .lower-art').style.opacity"));
  assert(edUpperOp > 0.9, 'At keyframe 2, Scene 1 upper-art opacity must be ~1');
  assert(edLowerOp < 0.1, 'At keyframe 2, Scene 1 lower-art opacity must be ~0');

  // 5. Click Next 3rd time -> Keyframe 3 (Scene 1 Lower-Art complete - Ranger Ed)
  await evalExpr("document.getElementById('btn-next').click()");
  await new Promise(r => setTimeout(r, 600));

  const kf3Idx = await evalExpr("window.currentKeyframeIndex");
  assert.strictEqual(kf3Idx, 3, '3rd click must advance to keyframe 3 (Scene 1 lower-art)');

  const edLowerMorphedOp = parseFloat(await evalExpr("document.querySelector('#scene-1 .lower-art').style.opacity"));
  assert(edLowerMorphedOp > 0.9, 'At keyframe 3, lower-art must be 100%');

  // 6. Click Prev -> returns to Keyframe 2 (Scene 1 Upper-Art)
  await evalExpr("document.getElementById('btn-prev').click()");
  await new Promise(r => setTimeout(r, 600));

  const kfPrevIdx = await evalExpr("window.currentKeyframeIndex");
  assert.strictEqual(kfPrevIdx, 2, 'Clicking prev must toggle back to keyframe 2');

  // 7. Verify wheel event triggers next keyframe
  await evalExpr("window.dispatchEvent(new WheelEvent('wheel', { deltaY: 50, cancelable: true }))");
  await new Promise(r => setTimeout(r, 600));

  const kfWheelIdx = await evalExpr("window.currentKeyframeIndex");
  assert.strictEqual(kfWheelIdx, 3, 'Wheel forward must trigger snapping to next keyframe');

  // 8. Verify no scaling in morphing animation (transforms must be pure translate without scale)
  const scene1UpperTransform = await evalExpr("document.querySelector('#scene-1 .upper-art').style.transform");
  const scene1LowerTransform = await evalExpr("document.querySelector('#scene-1 .lower-art').style.transform");
  assert(!scene1UpperTransform.includes('scale'), 'upperArt transform must not include scale during morph');
  assert(!scene1LowerTransform.includes('scale'), 'lowerArt transform must not include scale during morph');

  // 9. Verify same-art behavior (Scene 7: Sabrina, upperArt === lowerArt)
  // Jump to Sabrina upper-art keyframe (kf 14)
  await evalExpr("window.goToKeyframe(14)");
  await new Promise(r => setTimeout(r, 1200));

  const sabrinaUpperOpKf14 = parseFloat(await evalExpr("document.querySelector('#scene-7 .upper-art').style.opacity"));
  const sabrinaLowerOpKf14 = parseFloat(await evalExpr("document.querySelector('#scene-7 .lower-art').style.opacity"));
  assert(sabrinaUpperOpKf14 > 0.9, 'Sabrina upper-art must be 100% visible at keyframe 14');
  assert.strictEqual(sabrinaLowerOpKf14, 0, 'Sabrina lower-art must have 0 opacity to prevent duplicate layer');

  // Jump to Sabrina lower-art morph keyframe (kf 15)
  await evalExpr("window.goToKeyframe(15)");
  await new Promise(r => setTimeout(r, 600));

  const sabrinaUpperOpKf15 = parseFloat(await evalExpr("document.querySelector('#scene-7 .upper-art').style.opacity"));
  const sabrinaLowerOpKf15 = parseFloat(await evalExpr("document.querySelector('#scene-7 .lower-art').style.opacity"));
  const sabrinaNarrative2Op = parseFloat(await evalExpr("document.querySelector('#scene-7 .story-narrative-2').style.opacity"));
  assert(sabrinaUpperOpKf15 > 0.9, 'Sabrina upper-art must remain 100% solid through morph (no opacity dip/stutter)');
  assert.strictEqual(sabrinaLowerOpKf15, 0, 'Sabrina lower-art must remain 0 to prevent layer fighting');
  assert(sabrinaNarrative2Op > 0.9, 'Sabrina narrative2 must appear at keyframe 15');

  // Verify halfway scroll position between kf 14 and kf 15 has ZERO opacity dip
  const sPin7 = await evalExpr("window.getScenePinStart(7)");
  const midScroll = sPin7 + 450 + 250; // D_FADE_IN + D_MORPH/2
  await evalExpr(`document.getElementById('panorama-viewport').scrollLeft = ${midScroll}; window.updateScrollDrivenMorphs();`);
  const sabrinaMidUpperOp = parseFloat(await evalExpr("document.querySelector('#scene-7 .upper-art').style.opacity"));
  assert.strictEqual(sabrinaMidUpperOp, 1, 'Same-art upper-art opacity must stay rock-solid 1.0 mid-morph without 75% dip');

  assert.strictEqual(consoleErrors.length, 0, 'Must have zero runtime console errors');

  ws.close();
  console.log('✅ test-keyframe-snapping passed: zero-scale morph and same-art stutter elimination verified.');
} finally {
  chrome.kill();
}
