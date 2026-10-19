import { spawn } from 'child_process';
import assert from 'assert';

async function testViewport(width, height) {
  const chrome = spawn('google-chrome-stable', [
    '--headless=new',
    '--remote-debugging-port=9258',
    '--no-sandbox',
    '--disable-gpu',
    `--window-size=${width},${height}`,
    'http://localhost:5173/sidescroll-panorama/'
  ]);

  await new Promise(r => setTimeout(r, 1800));

  try {
    const versionRes = await fetch('http://127.0.0.1:9258/json');
    const targets = await versionRes.json();
    const pageTarget = targets.find(t => t.type === 'page');
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
      const res = await new Promise(resolve => {
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
      });
      return res.result?.result?.value;
    };

    const metrics = await evalExpr(`(() => {
      const vp = document.getElementById("panorama-viewport");
      const line = document.querySelector(".journey-line");
      const prog = document.getElementById("journey-progress");
      const nodes = Array.from(document.querySelectorAll(".landmark-node"));
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      const firstDot = firstNode.querySelector(".node-dot");
      const lastDot = lastNode.querySelector(".node-dot");

      const firstDotCenter = firstNode.offsetLeft + firstDot.offsetLeft + firstDot.offsetWidth / 2;
      const lastDotCenter = lastNode.offsetLeft + lastDot.offsetLeft + lastDot.offsetWidth / 2;
      const lineLeft = line.offsetLeft;
      const lineRight = line.offsetLeft + line.offsetWidth;

      // Measure dot centers and gaps
      const dotCenters = nodes.map(n => {
        const d = n.querySelector(".node-dot");
        return n.offsetLeft + d.offsetLeft + d.offsetWidth / 2;
      });
      const gaps = [];
      for (let i = 1; i < dotCenters.length; i++) {
        gaps.push(Math.round(dotCenters[i] - dotCenters[i - 1]));
      }

      // Start position
      vp.scrollLeft = 0;
      window.handleScroll();
      const startProg = prog.style.width;

      // Finale keyframe
      const kfs = window.getKeyframes();
      const lastKf = kfs[kfs.length - 1];
      vp.scrollLeft = lastKf.s;
      window.handleScroll();
      const endProg = prog.style.width;

      // Check alignment at every station
      const N = nodes.length;
      const stationAlignments = [];
      for (let i = 0; i < N; i++) {
        const sceneKfs = kfs.filter(k => k.sceneIndex === i);
        const s = i === 0 ? 0 : (i === N - 1 ? lastKf.s : (sceneKfs.length === 1 ? sceneKfs[0].s : (sceneKfs[0].s + sceneKfs[sceneKfs.length - 1].s) / 2));
        vp.scrollLeft = s;
        window.handleScroll();
        const pctNum = parseFloat(prog.style.width);
        const progPx = lineLeft + (pctNum / 100) * line.offsetWidth;
        stationAlignments.push({
          scene: i,
          diff: Math.abs(progPx - dotCenters[i])
        });
      }

      return {
        firstDotCenter,
        lastDotCenter,
        lineLeft,
        lineRight,
        lineWidth: line.offsetWidth,
        gaps,
        allGapsEqual: gaps.every(g => g === gaps[0]),
        gapValue: gaps[0],
        startProg,
        endProg,
        stationAlignments
      };
    })()`);

    // Verification 1: All gaps between consecutive dots are strictly equal
    assert.strictEqual(
      metrics.allGapsEqual,
      true,
      `All gaps between dots must be equal. Got: ${JSON.stringify(metrics.gaps)}`
    );

    // Verification 2: Journey track line starts at first dot center
    assert.strictEqual(
      Math.abs(metrics.lineLeft - metrics.firstDotCenter) <= 1,
      true,
      `Line start (${metrics.lineLeft}) should match first dot center (${metrics.firstDotCenter})`
    );

    // Verification 3: Journey track line ends at last dot center (The End)
    assert.strictEqual(
      Math.abs(metrics.lineRight - metrics.lastDotCenter) <= 1,
      true,
      `Line end (${metrics.lineRight}) should reach last dot center (${metrics.lastDotCenter})`
    );

    // Verification 4: At start, progress is 0%
    assert.strictEqual(metrics.startProg, '0%', 'Progress at start should be 0%');

    // Verification 5: At finale keyframe, progress is 100%
    assert.strictEqual(metrics.endProg, '100%', 'Progress at finale keyframe should reach 100%');

    // Verification 6: Progress line hits each dot center within 1px at every station
    metrics.stationAlignments.forEach(a => {
      assert.strictEqual(
        a.diff <= 1,
        true,
        `Station ${a.scene} progress offset (${a.diff}px) should be <= 1px from dot center`
      );
    });

    ws.close();
  } finally {
    chrome.kill();
  }
}

console.log('Testing desktop viewport (1920x953)...');
await testViewport(1920, 953);

console.log('Testing mobile viewport (390x844)...');
await testViewport(390, 844);

console.log('✅ test-journey-line passed: constant dot gaps and exact 0px station dot alignment verified on desktop and mobile.');
