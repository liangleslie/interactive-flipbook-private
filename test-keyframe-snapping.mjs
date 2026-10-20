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

  // 1. Verify keyframes (2 per story/cover/end scene, 1 per divider)
  const sceneCount = await evalExpr("document.querySelectorAll('.scene-station').length");
  const kfCount = await evalExpr("window.getKeyframes().length");
  assert.strictEqual(sceneCount, 23, 'Must have exactly 23 scenes');
  assert.strictEqual(kfCount, 44, 'Must have exactly 44 keyframes (21 scenes * 2 + 2 dividers * 1)');

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

  // 4. Click Next 2nd time -> Keyframe 2 (Scene 1 Act I Divider focus)
  await evalExpr("document.getElementById('btn-next').click()");
  await new Promise(r => setTimeout(r, 1200));

  const kf2Idx = await evalExpr("window.currentKeyframeIndex");
  const scene1Label = await evalExpr("document.getElementById('chapter-label').textContent.trim()");
  assert.strictEqual(kf2Idx, 2, '2nd click must transition to keyframe 2 (Scene 1 Act I Divider)');
  assert.strictEqual(scene1Label, 'Act I: NECF', 'Chapter label must be Act I: NECF');

  // 5. Click Next 3rd time -> Keyframe 3 (Scene 2 Upper-Art complete - Meet Anna & Pretzel)
  await evalExpr("document.getElementById('btn-next').click()");
  await new Promise(r => setTimeout(r, 1200));

  const kf3Idx = await evalExpr("window.currentKeyframeIndex");
  assert.strictEqual(kf3Idx, 3, '3rd click must advance to keyframe 3 (Scene 2 upper-art Anna)');

  const annaUpperOp = parseFloat(await evalExpr("document.querySelector('#scene-2 .upper-art').style.opacity"));
  const annaLowerOp = parseFloat(await evalExpr("document.querySelector('#scene-2 .lower-art').style.opacity"));
  assert(annaUpperOp > 0.9, 'At keyframe 3, Scene 2 upper-art opacity must be ~1');
  assert(annaLowerOp < 0.1, 'At keyframe 3, Scene 2 lower-art opacity must be ~0');

  // 6. Click Prev -> returns to Keyframe 2 (Act I Divider)
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
  const scene2UpperTransform = await evalExpr("document.querySelector('#scene-2 .upper-art').style.transform");
  const scene2LowerTransform = await evalExpr("document.querySelector('#scene-2 .lower-art').style.transform");
  assert(!scene2UpperTransform.includes('scale'), 'upperArt transform must not include scale during morph');
  assert(!scene2LowerTransform.includes('scale'), 'lowerArt transform must not include scale during morph');

  // 9. Verify same-art behavior (Scene 18: Sabrina, upperArt === lowerArt)
  // Sabrina is Scene 18, keyframes 34 and 35
  await evalExpr("window.goToKeyframe(34)");
  await new Promise(r => setTimeout(r, 1200));

  const sabrinaUpperOpKf34 = parseFloat(await evalExpr("document.querySelector('#scene-18 .upper-art').style.opacity"));
  const sabrinaLowerOpKf34 = parseFloat(await evalExpr("document.querySelector('#scene-18 .lower-art').style.opacity"));
  assert(sabrinaUpperOpKf34 > 0.9, 'Sabrina upper-art must be 100% visible at keyframe 34');
  assert.strictEqual(sabrinaLowerOpKf34, 0, 'Sabrina lower-art must have 0 opacity to prevent duplicate layer');

  // Jump to Sabrina lower-art morph keyframe (kf 35)
  await evalExpr("window.goToKeyframe(35)");
  await new Promise(r => setTimeout(r, 600));

  const sabrinaUpperOpKf35 = parseFloat(await evalExpr("document.querySelector('#scene-18 .upper-art').style.opacity"));
  const sabrinaLowerOpKf35 = parseFloat(await evalExpr("document.querySelector('#scene-18 .lower-art').style.opacity"));
  const sabrinaNarrative2Op = parseFloat(await evalExpr("document.querySelector('#scene-18 .story-narrative-2').style.opacity"));
  assert(sabrinaUpperOpKf35 > 0.9, 'Sabrina upper-art must remain 100% solid through morph (no opacity dip/stutter)');
  assert.strictEqual(sabrinaLowerOpKf35, 0, 'Sabrina lower-art must remain 0 to prevent layer fighting');
  assert(sabrinaNarrative2Op > 0.9, 'Sabrina narrative2 must appear at keyframe 35');

  // 10. Verify clicking landmark-nodes navigates to exact scene (testing Chapter 8 and all others)
  const nodeCount = await evalExpr("document.querySelectorAll('.landmark-node').length");
  for (let i = 0; i < nodeCount; i++) {
    await evalExpr(`document.querySelectorAll('.landmark-node')[${i}].click()`);
    await new Promise(r => setTimeout(r, 200));
    const activeScene = await evalExpr("window.currentKeyframeIndex");
    const kfs = await evalExpr("window.getKeyframes()");
    const targetKf = kfs[activeScene];
    assert.strictEqual(targetKf.sceneIndex, i, `Clicking landmark-node ${i} must activate scene ${i}, but got scene ${targetKf.sceneIndex}`);
  }

  // Specifically check Ed (Scene 10: 8: Ed)
  await evalExpr("document.querySelectorAll('.landmark-node')[10].click()");
  await new Promise(r => setTimeout(r, 400));
  const edLabel = await evalExpr("document.getElementById('chapter-label').textContent.trim()");
  assert.strictEqual(edLabel, '8: Ed', `Clicking Chapter 8 node must show '8: Ed', got '${edLabel}'`);

  assert.strictEqual(consoleErrors.length, 0, 'Must have zero runtime console errors');

  ws.close();
  console.log('✅ test-keyframe-snapping passed: landmark navigation, zero-scale morph and same-art stutter elimination verified.');
} finally {
  chrome.kill();
}
