// Continuous Panorama Engine — Dynamically loaded from resources/story-board.json
import storyBoard from '../resources/story-board.json';
import lyricsData from '../resources/lyrics.json';

const viewport = document.getElementById('panorama-viewport');
const journeyTrack = document.getElementById('journey-track');
const panoramaWorld = document.getElementById('panorama-world');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const chapterLabel = document.getElementById('chapter-label');
const journeyProgress = document.getElementById('journey-progress');
const lyricsLayerDeep = document.getElementById('lyrics-layer-deep');
const lyricsLayerMid = document.getElementById('lyrics-layer-mid');
const lyricsLayerForeground = document.getElementById('lyrics-layer-foreground');

const pages = storyBoard.pages || [];
const sceneNames = pages.map(p => p.navLabel || p.title);

// Render stations and landmarks dynamically
function renderPanoramaDOM() {
  if (!panoramaWorld || !journeyTrack) return;

  // 1. Render landmark nodes inside #journey-track (keep existing journey-line)
  const journeyInner = journeyTrack.querySelector('.journey-inner') || journeyTrack;
  const existingLine = journeyTrack.querySelector('.journey-line');
  journeyInner.innerHTML = '';
  if (existingLine) journeyInner.appendChild(existingLine);

  pages.forEach((page, i) => {
    const node = document.createElement('button');
    node.className = `landmark-node ${i === 0 ? 'is-active' : ''}`;
    node.setAttribute('data-scene', i);
    node.setAttribute('aria-label', page.navLabel || `Scene ${i + 1}`);
    node.innerHTML = `
      <span class="node-dot"></span>
      <span class="node-label">${page.navLabel || `Scene ${i + 1}`}</span>
    `;
    journeyInner.appendChild(node);
  });

  // 2. Render scene stations in #panorama-world
  panoramaWorld.innerHTML = pages.map((page, i) => {
    if (page.type === 'cover') {
      return `
        <section class="scene-station scene-start" id="scene-${i}" data-index="${i}">
          <div class="station-card">
            <div class="station-flow">
              <span class="scene-badge">${page.chapterTag || page.text1 || 'Special Edition'}</span>
              <h1 class="hero-title">${page.title}</h1>
              <p class="story-subtitle">${page.narrative || page.text2 || ''}</p>

              <div class="character-spot">
                <div class="character-morph-target" data-index="${i}" title="Tap or scroll to morph">
                  <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} revealed" class="character-img lower-art" />
                  <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} cover" class="character-img upper-art" />
                </div>
              </div>

              <p class="story-narrative-2">${page.narrative2 || page.caption || ''}</p>

              <div class="scroll-cue">
                <span>${page.cue || 'Scroll along the path ➔'}</span>
              </div>
            </div>
          </div>
        </section>
      `;
    }

    if (page.type === 'end') {
      return `
        <section class="scene-station scene-end" id="scene-${i}" data-index="${i}">
          <div class="station-card">
            <div class="station-flow end-flow">
              <div class="end-star">🌟</div>
              <h2 class="end-heading">${page.title}</h2>
              <p class="end-dedication">${page.narrative || page.text2 || ''}</p>

              <div class="character-spot">
                <div class="character-morph-target" data-index="${i}" title="Tap or scroll to morph">
                  <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} finale" class="character-img lower-art" />
                  <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} climax" class="character-img upper-art" />
                </div>
              </div>

              <p class="story-narrative-2">${page.narrative2 || page.caption || ''}</p>
              <div class="end-tag">${page.chapterTag || page.text1 || 'Continuous Story Panorama'}</div>
            </div>
          </div>
        </section>
      `;
    }

    // Story station
    return `
      <section class="scene-station scene-${page.id || i}" id="scene-${i}" data-index="${i}">
        <div class="station-card">
          <div class="station-flow">
            <div class="chapter-badge-row">
              <span class="page-number">${page.pageNumber || i}</span>
              <span class="chapter-tag">${page.chapterTag || page.text1 || `Chapter ${page.pageNumber}`}</span>
            </div>
            <h2 class="scene-heading">${page.title}</h2>
            <p class="scene-narrative">${page.narrative || page.text2 || ''}</p>

            <div class="character-spot">
              <div class="character-morph-target" data-index="${i}" title="Tap or scroll to morph">
                <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} inside" class="character-img lower-art" />
                <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} outside" class="character-img upper-art" />
              </div>
            </div>

            <p class="story-narrative-2">${page.narrative2 || page.caption || ''}</p>
          </div>
        </div>
      </section>
    `;
  }).join('');
}

renderPanoramaDOM();

const scenes = Array.from(document.querySelectorAll('.scene-station'));
const landmarkNodes = Array.from(document.querySelectorAll('.landmark-node'));
const morphTargets = Array.from(document.querySelectorAll('.character-morph-target'));

let currentSceneIndex = 0;

// Responsive 5-Phase Animation Budget (scaled dynamically based on viewport width)
let D_FADE_IN = 200;
let D_MORPH = 320;
let D_LINGER = 140;
let D_FADE_OUT = 200;
let D_TOTAL = 860;

let D_COVER_PRE_LINGER = 140;
let D_COVER_MORPH = 320;
let D_COVER_POST_LINGER = 140;
let D_COVER_FADE_OUT = 200;
let D_COVER_TOTAL = 800;

let D_END_PRE_LINGER = 100;
let D_END_MORPH = 320;
let D_END_POST_LINGER = 120;
let D_END_TOTAL = 540;

function updateResponsiveBudgets() {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    D_FADE_IN = 120;
    D_MORPH = 200;
    D_LINGER = 80;
    D_FADE_OUT = 120;
    D_TOTAL = D_FADE_IN + D_MORPH + D_LINGER + D_FADE_OUT; // 520px

    D_COVER_PRE_LINGER = 90;
    D_COVER_MORPH = 200;
    D_COVER_POST_LINGER = 90;
    D_COVER_FADE_OUT = 120;
    D_COVER_TOTAL = D_COVER_PRE_LINGER + D_COVER_MORPH + D_COVER_POST_LINGER + D_COVER_FADE_OUT; // 500px

    D_END_PRE_LINGER = 80;
    D_END_MORPH = 200;
    D_END_POST_LINGER = 100;
    D_END_TOTAL = D_END_PRE_LINGER + D_END_MORPH + D_END_POST_LINGER; // 380px
  } else {
    D_FADE_IN = 200;
    D_MORPH = 320;
    D_LINGER = 140;
    D_FADE_OUT = 200;
    D_TOTAL = D_FADE_IN + D_MORPH + D_LINGER + D_FADE_OUT; // 860px

    D_COVER_PRE_LINGER = 140;
    D_COVER_MORPH = 320;
    D_COVER_POST_LINGER = 140;
    D_COVER_FADE_OUT = 200;
    D_COVER_TOTAL = D_COVER_PRE_LINGER + D_COVER_MORPH + D_COVER_POST_LINGER + D_COVER_FADE_OUT; // 800px

    D_END_PRE_LINGER = 100;
    D_END_MORPH = 320;
    D_END_POST_LINGER = 120;
    D_END_TOTAL = D_END_PRE_LINGER + D_END_MORPH + D_END_POST_LINGER; // 540px
  }
}
updateResponsiveBudgets();

function updateSceneUI(idx) {
  currentSceneIndex = idx;
  if (chapterLabel) {
    chapterLabel.textContent = sceneNames[idx] || `Scene ${idx + 1}`;
  }
  if (prevBtn) prevBtn.disabled = idx <= 0;
  if (nextBtn) nextBtn.disabled = idx >= scenes.length - 1;

  landmarkNodes.forEach((node, i) => {
    const isActive = i === idx;
    node.classList.toggle('is-active', isActive);
    if (isActive) {
      node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });
}

// Native Compositor Pinning: calculate scroll offsets where sticky pinning begins
function getScenePinStart(idx) {
  if (!viewport || !scenes[idx]) return 0;
  if (idx === 0) return 0;
  const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const scene = scenes[idx];
  const card = scene.querySelector('.station-card') || scene.querySelector('.station-flow');
  const stationWidth = card ? card.offsetWidth : (scene.offsetWidth || 440);
  const natural = Math.round(scene.offsetLeft - (viewport.clientWidth - stationWidth) / 2);
  return Math.min(Math.max(0, natural), maxScroll);
}
window.getScenePinStart = getScenePinStart;

function getSceneCenterScroll(idx) {
  if (idx === 0) return 0;
  const pinStart = getScenePinStart(idx);
  const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  if (idx === scenes.length - 1) {
    return Math.min(pinStart + D_END_PRE_LINGER + D_END_MORPH, maxScroll);
  }
  // Scroll to scene pin start plus fade-in window so card is fully solid white & ready to morph
  return Math.min(pinStart + D_FADE_IN, maxScroll);
}
window.getSceneCenterScroll = getSceneCenterScroll;

function getActiveSceneIndex(S) {
  if (scenes.length <= 1) return 0;
  for (let i = 0; i < scenes.length - 1; i++) {
    const Si = getScenePinStart(i);
    const Snext = getScenePinStart(i + 1);
    const pinDist = i === 0 ? D_COVER_TOTAL : (i === scenes.length - 1 ? D_END_TOTAL : D_TOTAL);
    const midpoint = (Si + pinDist + Snext) / 2;
    if (S < midpoint) return i;
  }
  return scenes.length - 1;
}
window.getActiveSceneIndex = getActiveSceneIndex;

function scrollToScene(idx) {
  if (idx < 0 || idx >= scenes.length) return;
  if (!viewport) return;

  const targetS = getSceneCenterScroll(idx);
  viewport.scrollTo({
    left: targetS,
    behavior: 'smooth'
  });

  updateSceneUI(idx);
}
window.scrollToScene = scrollToScene;

prevBtn?.addEventListener('click', () => scrollToScene(currentSceneIndex - 1));
nextBtn?.addEventListener('click', () => scrollToScene(currentSceneIndex + 1));

landmarkNodes.forEach((node, idx) => {
  node.addEventListener('click', () => scrollToScene(idx));
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown') scrollToScene(currentSceneIndex + 1);
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') scrollToScene(currentSceneIndex - 1);
});

function getCenterFriction() {
  const S = viewport.scrollLeft;
  for (let i = 0; i < scenes.length; i++) {
    const sc = getScenePinStart(i);
    const pinDist = i === 0 ? D_COVER_TOTAL : (i === scenes.length - 1 ? D_END_TOTAL : D_TOTAL);
    const delta = S - sc;
    if (delta >= 0 && delta <= pinDist) {
      return 0.85;
    }
  }
  return 1.05;
}

window.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  if (Math.abs(e.deltaY) < 4) return;
  e.preventDefault();

  const friction = getCenterFriction();
  viewport.scrollLeft += e.deltaY * friction;
}, { passive: false });

function getBackgroundShift(S) {
  let shift = 0;
  for (let i = 0; i < scenes.length; i++) {
    const S_pin = getScenePinStart(i);
    const pinDist = i === 0 ? D_COVER_TOTAL : (i === scenes.length - 1 ? D_END_TOTAL : D_TOTAL);
    const delta = S - S_pin;
    if (delta <= 0) {
      break;
    } else if (delta < pinDist) {
      shift += delta;
      break;
    } else {
      shift += pinDist;
    }
  }
  return shift;
}
window.getBackgroundShift = getBackgroundShift;

function updateScrollDrivenMorphs() {
  if (!viewport) return;
  const S = viewport.scrollLeft;

  const bgShift = getBackgroundShift(S);
  const visualBgX = Math.round(bgShift - S);

  const backdrop = document.querySelector('.panorama-backdrop-layer');
  if (backdrop) {
    backdrop.style.backgroundPositionX = `${visualBgX}px`;
  }
  const spriteLayer = document.querySelector('.sprite-track-layer');
  if (spriteLayer) {
    spriteLayer.style.transform = `translateX(${visualBgX}px)`;
  }

  // Drive 4-phase animations:
  // 1) Prior to focus: upper-art at 50%, backing & text hidden
  // 2) Scrolled to center in focus: upper-art 100%, backing & text fade in (1.0)
  // 3) Continue scrolling: upper-art morphs to lower-art, story-narrative-2 appears
  // 4) Continue scrolling: backing & text fade out, lower-art scales down to 50%, pinning lifted
  scenes.forEach((scene, i) => {
    const morphTarget = scene.querySelector('.character-morph-target');
    const upper = scene.querySelector('.character-morph-target .upper-art');
    const lower = scene.querySelector('.character-morph-target .lower-art');
    const narrative2 = scene.querySelector('.story-narrative-2');

    const S_pin = getScenePinStart(i);
    const delta = S - S_pin;

    // For end scene: upperArt fade in, centers and pins, morphs into lowerArt and shows narrative2
    if (i === scenes.length - 1) {
      let backingOpacity = 1;
      let textOpacity = 1;
      let charScale = 1;
      let upperOpacity = 1;
      let lowerOpacity = 0;
      let narrative2Opacity = 0;
      let phase = '';

      if (delta < -D_FADE_IN) {
        // Approaching from far away: hidden
        backingOpacity = 0;
        textOpacity = 0;
        charScale = 0.5;
        upperOpacity = 0;
        lowerOpacity = 0;
        narrative2Opacity = 0;
        phase = 'intro';
      } else if (delta < 0) {
        // Approach: backing, text, and upperArt fade in together (0 -> 1), char scales (0.5 -> 1.0)
        const p = (delta + D_FADE_IN) / D_FADE_IN;
        const smoothIn = Math.sin((p * Math.PI) / 2);
        backingOpacity = smoothIn;
        textOpacity = smoothIn;
        charScale = 0.5 + 0.5 * smoothIn;
        upperOpacity = smoothIn;
        lowerOpacity = 0;
        narrative2Opacity = 0;
        phase = 'backing-fade-in';
      } else if (delta < D_END_PRE_LINGER) {
        // Centered & pinned: upper-art full size and solid backing
        backingOpacity = 1;
        textOpacity = 1;
        charScale = 1;
        upperOpacity = 1;
        lowerOpacity = 0;
        narrative2Opacity = 0;
        phase = 'pre-linger';
      } else if (delta < D_END_PRE_LINGER + D_END_MORPH) {
        // Morph: upperArt morphs into lowerArt, narrative2 appears
        const rawMorph = (delta - D_END_PRE_LINGER) / D_END_MORPH;
        const smoothMorph = Math.sin((rawMorph * Math.PI) / 2);
        backingOpacity = 1;
        textOpacity = 1;
        charScale = 1;
        upperOpacity = 1 - smoothMorph;
        lowerOpacity = smoothMorph;
        narrative2Opacity = smoothMorph;
        phase = 'morphing';
      } else {
        // Final celebration: lowerArt in full glory, narrative2 visible, holds to maxScroll
        backingOpacity = 1;
        textOpacity = 1;
        charScale = 1;
        upperOpacity = 0;
        lowerOpacity = 1;
        narrative2Opacity = 1;
        phase = 'post-linger';
      }

      scene.style.setProperty('--backing-opacity', backingOpacity.toFixed(3));
      scene.style.setProperty('--text-opacity', textOpacity.toFixed(3));
      scene.style.setProperty('--char-scale', charScale.toFixed(3));

      if (morphTarget) {
        if (phase) morphTarget.setAttribute('data-phase', phase);
        else morphTarget.removeAttribute('data-phase');
      }

      if (upper && lower && !morphTarget?.classList.contains('is-pinned')) {
        upper.style.opacity = upperOpacity.toFixed(3);
        upper.style.transform = `translate(-50%, -50%) scale(${(1 + 0.05 * (1 - upperOpacity)).toFixed(3)})`;
        upper.style.pointerEvents = upperOpacity > 0.5 ? 'auto' : 'none';

        lower.style.opacity = lowerOpacity.toFixed(3);
        lower.style.transform = `translate(-50%, -50%) scale(${(0.95 + 0.05 * lowerOpacity).toFixed(3)})`;
        lower.style.pointerEvents = lowerOpacity > 0.5 ? 'auto' : 'none';

        if (narrative2) {
          narrative2.style.opacity = narrative2Opacity.toFixed(3);
          narrative2.style.transform = `translateY(${(6 * (1 - narrative2Opacity)).toFixed(1)}px)`;
        }
      }
      return;
    }

    let backingOpacity = 1;
    let textOpacity = 1;
    let charScale = 1;
    let upperOpacity = 1;
    let lowerOpacity = 0;
    let narrative2Opacity = 0;
    let phase = '';

    // Cover page: starts with backing fade-in already complete; morphs to lower-art and shows narrative2, then fades out into outro
    if (i === 0) {
      if (delta <= D_COVER_PRE_LINGER) {
        // Starts with backing solid white, text visible, upper-art full size (no intro, no scale up)
        backingOpacity = 1;
        textOpacity = 1;
        charScale = 1;
        upperOpacity = 1;
        lowerOpacity = 0;
        narrative2Opacity = 0;
        phase = 'cover-in-focus';
      } else if (delta < D_COVER_PRE_LINGER + D_COVER_MORPH) {
        // Morph: upper-art morphs to lower-art, narrative2 appears
        const rawMorph = (delta - D_COVER_PRE_LINGER) / D_COVER_MORPH;
        const smoothMorph = Math.sin((rawMorph * Math.PI) / 2);
        backingOpacity = 1;
        textOpacity = 1;
        charScale = 1;
        upperOpacity = 1 - smoothMorph;
        lowerOpacity = smoothMorph;
        narrative2Opacity = smoothMorph;
        phase = 'morphing';
      } else if (delta < D_COVER_PRE_LINGER + D_COVER_MORPH + D_COVER_POST_LINGER) {
        // Post-morph linger: lower-art and narrative2 in full focus
        backingOpacity = 1;
        textOpacity = 1;
        charScale = 1;
        upperOpacity = 0;
        lowerOpacity = 1;
        narrative2Opacity = 1;
        phase = 'post-linger';
      } else if (delta < D_COVER_TOTAL) {
        // Backing fade-out (backing & narrative2/text fade out, lower-art scales to 50%)
        const rawOutro = (delta - (D_COVER_PRE_LINGER + D_COVER_MORPH + D_COVER_POST_LINGER)) / D_COVER_FADE_OUT;
        const smoothOutro = Math.sin((rawOutro * Math.PI) / 2);
        backingOpacity = 1 - smoothOutro;
        textOpacity = 1 - smoothOutro;
        charScale = 1.0 - 0.5 * smoothOutro;
        upperOpacity = 0;
        lowerOpacity = 1;
        narrative2Opacity = 1 - smoothOutro;
        phase = 'cover-fade-out';
      } else {
        // Outro (pinning released at D_COVER_TOTAL, lower-art at 50% miniature scrolls out of view)
        backingOpacity = 0;
        textOpacity = 0;
        charScale = 0.5;
        upperOpacity = 0;
        lowerOpacity = 1;
        narrative2Opacity = 0;
        phase = 'outro';
      }

      scene.style.setProperty('--backing-opacity', backingOpacity.toFixed(3));
      scene.style.setProperty('--text-opacity', textOpacity.toFixed(3));
      scene.style.setProperty('--char-scale', charScale.toFixed(3));

      if (morphTarget) {
        if (phase) morphTarget.setAttribute('data-phase', phase);
        else morphTarget.removeAttribute('data-phase');
      }

      if (upper && lower && !morphTarget?.classList.contains('is-pinned')) {
        upper.style.opacity = upperOpacity.toFixed(3);
        upper.style.transform = `translate(-50%, -50%) scale(${(1 + 0.05 * (1 - upperOpacity)).toFixed(3)})`;
        upper.style.pointerEvents = upperOpacity > 0.5 ? 'auto' : 'none';

        lower.style.opacity = lowerOpacity.toFixed(3);
        lower.style.transform = `translate(-50%, -50%) scale(${(0.95 + 0.05 * lowerOpacity).toFixed(3)})`;
        lower.style.pointerEvents = lowerOpacity > 0.5 ? 'auto' : 'none';

        if (narrative2) {
          narrative2.style.opacity = narrative2Opacity.toFixed(3);
          narrative2.style.transform = `translateY(${(6 * (1 - narrative2Opacity)).toFixed(1)}px)`;
        }
      }
      return;
    }

    if (delta < 0) {
      // 1) Intro: upper-art is at 50% as it is scrolled to the centre of the screen
      backingOpacity = 0;
      textOpacity = 0;
      charScale = 0.5;
      upperOpacity = 1;
      lowerOpacity = 0;
      narrative2Opacity = 0;
      phase = 'intro';
    } else if (delta < D_FADE_IN) {
      // 2) Backing fade-in: backing fades in, once centred, page is pinned
      const p = delta / D_FADE_IN;
      const smoothIn = Math.sin((p * Math.PI) / 2);
      backingOpacity = smoothIn;
      textOpacity = smoothIn;
      charScale = 0.5 + 0.5 * smoothIn;
      upperOpacity = 1;
      lowerOpacity = 0;
      narrative2Opacity = 0;
      phase = 'backing-fade-in';
    } else if (delta < D_FADE_IN + D_MORPH) {
      // 3) Morph: once backing is fully solid, morph to lower-art and show narrative2
      const rawMorph = (delta - D_FADE_IN) / D_MORPH;
      const smoothMorph = Math.sin((rawMorph * Math.PI) / 2);
      backingOpacity = 1;
      textOpacity = 1;
      charScale = 1;
      upperOpacity = 1 - smoothMorph;
      lowerOpacity = smoothMorph;
      narrative2Opacity = smoothMorph;
      phase = 'morphing';
    } else if (delta < D_FADE_IN + D_MORPH + D_LINGER) {
      // 3b) Lower-art & narrative2 registered in full focus
      backingOpacity = 1;
      textOpacity = 1;
      charScale = 1;
      upperOpacity = 0;
      lowerOpacity = 1;
      narrative2Opacity = 1;
      phase = 'post-linger';
    } else if (delta < D_TOTAL) {
      // 4) Backing fade-out: backing fades out, pinning released
      const rawOutro = (delta - (D_FADE_IN + D_MORPH + D_LINGER)) / D_FADE_OUT;
      const smoothOutro = Math.sin((rawOutro * Math.PI) / 2);
      backingOpacity = 1 - smoothOutro;
      textOpacity = 1 - smoothOutro;
      charScale = 1.0 - 0.5 * smoothOutro;
      upperOpacity = 0;
      lowerOpacity = 1;
      narrative2Opacity = 1 - smoothOutro;
      phase = 'backing-fade-out';
    } else {
      // 5) Outro: lower-art scales down to 50% and scrolls out of view
      backingOpacity = 0;
      textOpacity = 0;
      charScale = 0.5;
      upperOpacity = 0;
      lowerOpacity = 1;
      narrative2Opacity = 0;
      phase = 'outro';
    }

    scene.style.setProperty('--backing-opacity', backingOpacity.toFixed(3));
    scene.style.setProperty('--text-opacity', textOpacity.toFixed(3));
    scene.style.setProperty('--char-scale', charScale.toFixed(3));

    if (morphTarget) {
      if (phase) morphTarget.setAttribute('data-phase', phase);
      else morphTarget.removeAttribute('data-phase');
    }

    if (upper && lower && !morphTarget?.classList.contains('is-pinned')) {
      upper.style.opacity = upperOpacity.toFixed(3);
      upper.style.transform = `translate(-50%, -50%) scale(${(1 + 0.05 * (1 - upperOpacity)).toFixed(3)})`;
      upper.style.pointerEvents = upperOpacity > 0.5 ? 'auto' : 'none';

      lower.style.opacity = lowerOpacity.toFixed(3);
      lower.style.transform = `translate(-50%, -50%) scale(${(0.95 + 0.05 * lowerOpacity).toFixed(3)})`;
      lower.style.pointerEvents = lowerOpacity > 0.5 ? 'auto' : 'none';

      if (narrative2) {
        narrative2.style.opacity = narrative2Opacity.toFixed(3);
        narrative2.style.transform = `translateY(${(6 * (1 - narrative2Opacity)).toFixed(1)}px)`;
      }
    }
  });
}
window.updateScrollDrivenMorphs = updateScrollDrivenMorphs;

morphTargets.forEach((target) => {
  target.addEventListener('click', (e) => {
    e.stopPropagation();
    const isPinned = target.classList.toggle('is-pinned');
    const upper = target.querySelector('.upper-art');
    const lower = target.querySelector('.lower-art');
    const scene = target.closest('.scene-station');
    const narrative2 = scene?.querySelector('.story-narrative-2');
    if (!upper || !lower) return;

    if (isPinned) {
      upper.style.opacity = '0';
      upper.style.transform = 'translate(-50%, -50%) scale(1.05)';
      lower.style.opacity = '1';
      lower.style.transform = 'translate(-50%, -50%) scale(1)';
      if (narrative2) {
        narrative2.style.opacity = '1';
        narrative2.style.transform = 'translateY(0)';
      }
    } else {
      updateScrollDrivenMorphs();
    }
  });
});

// Dynamic Music-Video Lyrics Parallax Engine
const LYRIC_PRESETS = [
  // Scene 0 (Cover): Lines 0-3
  // 0: "Happiness hit her like a train on a track" -> Left side sky
  { depth: 'mid', size: 'large', style: 'style-gradient', laneX: 22, laneY: 20, tilt: -2.5, sweepDistance: 320, maxBlur: 6 },
  // 1: "Coming towards her, stuck still, no turning back" -> Right side meadow
  { depth: 'foreground', size: 'medium', style: 'style-kinetic-italic', laneX: 78, laneY: 74, tilt: 2.5, sweepDistance: 360, maxBlur: 8 },
  // 2: "She hid around corners and she hid under beds" -> Center high sky
  { depth: 'deep', size: 'medium', style: 'style-dreamy', laneX: 50, laneY: 12, tilt: -1, sweepDistance: 240, maxBlur: 4 },
  // 3: "She killed it with kisses and from it she fled" -> Left side lower
  { depth: 'mid', size: 'large', style: 'style-neon', laneX: 24, laneY: 68, tilt: 3, sweepDistance: 300, maxBlur: 6 },

  // Scene 1 (Ed): Lines 4-7
  // 4: "With every bubble, she sank with a drink" -> Right side high
  { depth: 'deep', size: 'medium', style: 'style-dreamy', laneX: 80, laneY: 22, tilt: -2, sweepDistance: 260, maxBlur: 4 },
  // 5: "And washed it away down the kitchen sink" -> Center low meadow
  { depth: 'mid', size: 'medium', style: 'style-gradient', laneX: 50, laneY: 86, tilt: 1.5, sweepDistance: -300, maxBlur: 6 },
  // 6: "The dog days are over" -> Left side dramatic
  { depth: 'foreground', size: 'massive', style: 'style-kinetic-italic', laneX: 20, laneY: 18, tilt: -3.5, sweepDistance: 400, maxBlur: 9 },
  // 7: "The dog days are done" -> Right side meadow
  { depth: 'mid', size: 'large', style: 'style-stroke', laneX: 78, laneY: 72, tilt: 2, sweepDistance: 320, maxBlur: 6 },

  // Scene 2 (Leslie): Lines 8-11
  // 8: "The horses are coming" -> Center high sky
  { depth: 'foreground', size: 'large', style: 'style-neon', laneX: 52, laneY: 13, tilt: -2, sweepDistance: 350, maxBlur: 8 },
  // 9: "So you better run" -> Left side lower meadow
  { depth: 'foreground', size: 'massive', style: 'style-kinetic-italic', laneX: 22, laneY: 76, tilt: 3.5, sweepDistance: 420, maxBlur: 9 },
  // 10: "Run fast for your mother, run fast for your father" -> Right side high
  { depth: 'mid', size: 'large', style: 'style-gradient', laneX: 78, laneY: 20, tilt: -2.5, sweepDistance: 320, maxBlur: 6 },
  // 11: "Run for your children, for your sisters and brothers" -> Left side mid
  { depth: 'foreground', size: 'large', style: 'style-kinetic-italic', laneX: 24, laneY: 66, tilt: 2, sweepDistance: 340, maxBlur: 8 },

  // Scene 3 (Anna): Lines 12-15
  // 12: "Leave all your love and your longing behind" -> Right side sky
  { depth: 'deep', size: 'medium', style: 'style-dreamy', laneX: 82, laneY: 18, tilt: -1.5, sweepDistance: 240, maxBlur: 4 },
  // 13: "You can't carry it with you if you want to survive" -> Center low meadow
  { depth: 'mid', size: 'large', style: 'style-stroke', laneX: 48, laneY: 86, tilt: 2.5, sweepDistance: -300, maxBlur: 6 },
  // 14: "The dog days are over" -> Left side sky
  { depth: 'foreground', size: 'massive', style: 'style-gradient', laneX: 18, laneY: 22, tilt: -3, sweepDistance: 380, maxBlur: 9 },
  // 15: "The dog days are done" -> Right side meadow
  { depth: 'mid', size: 'large', style: 'style-neon', laneX: 80, laneY: 72, tilt: 2, sweepDistance: 300, maxBlur: 6 },

  // Scene 4 (Jeremy): Lines 16-19
  // 16: "Can you hear the horses?" -> Center high sky
  { depth: 'deep', size: 'large', style: 'style-stroke', laneX: 50, laneY: 14, tilt: -2, sweepDistance: 280, maxBlur: 5 },
  // 17: "'Cause here they come" -> Left side meadow
  { depth: 'foreground', size: 'massive', style: 'style-kinetic-italic', laneX: 22, laneY: 70, tilt: 3.5, sweepDistance: 400, maxBlur: 9 },
  // 18: "And I never wanted anything from you" -> Right side sky
  { depth: 'deep', size: 'medium', style: 'style-dreamy', laneX: 80, laneY: 24, tilt: -1, sweepDistance: 240, maxBlur: 4 },
  // 19: "Except everything you had" -> Left side lower
  { depth: 'mid', size: 'large', style: 'style-gradient', laneX: 24, laneY: 76, tilt: 2, sweepDistance: 320, maxBlur: 6 },

  // Scene 5 (Kirill): Lines 20-23
  // 20: "And what was left after that too, oh" -> Center high sky
  { depth: 'deep', size: 'medium', style: 'style-dreamy', laneX: 52, laneY: 12, tilt: -2, sweepDistance: 250, maxBlur: 4 },
  // 21: "Happiness hit her like a bullet in the back" -> Right side meadow
  { depth: 'foreground', size: 'large', style: 'style-kinetic-italic', laneX: 78, laneY: 74, tilt: 2.5, sweepDistance: 360, maxBlur: 8 },
  // 22: "Struck from a great height" -> Left side sky
  { depth: 'mid', size: 'medium', style: 'style-stroke', laneX: 20, laneY: 24, tilt: -1.5, sweepDistance: 280, maxBlur: 6 },
  // 23: "By someone who should have known better than that" -> Center low meadow
  { depth: 'deep', size: 'medium', style: 'style-dreamy', laneX: 50, laneY: 87, tilt: 1.5, sweepDistance: -280, maxBlur: 4 },

  // Scene 6 (Mich): Lines 24-27
  // 24: "The dog days are over" -> Right side sky
  { depth: 'foreground', size: 'massive', style: 'style-neon', laneX: 80, laneY: 18, tilt: -3, sweepDistance: 400, maxBlur: 9 },
  // 25: "The dog days are done" -> Left side meadow
  { depth: 'mid', size: 'large', style: 'style-gradient', laneX: 22, laneY: 75, tilt: 2, sweepDistance: 320, maxBlur: 6 },
  // 26: "Can you hear the horses?" -> Center high sky
  { depth: 'deep', size: 'large', style: 'style-stroke', laneX: 50, laneY: 13, tilt: -2, sweepDistance: 280, maxBlur: 5 },
  // 27: "'Cause here they come" -> Right side meadow
  { depth: 'foreground', size: 'massive', style: 'style-kinetic-italic', laneX: 78, laneY: 70, tilt: 3.5, sweepDistance: 420, maxBlur: 9 },

  // Scene 7 (Sabrina): Lines 28-31
  // 28: "Run fast for your mother, run fast for your father" -> Left side sky
  { depth: 'foreground', size: 'large', style: 'style-gradient', laneX: 22, laneY: 20, tilt: -2.5, sweepDistance: 360, maxBlur: 8 },
  // 29: "Run for your children, for your sisters and brothers" -> Right side meadow
  { depth: 'mid', size: 'large', style: 'style-stroke', laneX: 80, laneY: 76, tilt: 2.5, sweepDistance: 320, maxBlur: 6 },
  // 30: "Leave all your love and your longing behind" -> Center high sky
  { depth: 'deep', size: 'medium', style: 'style-dreamy', laneX: 48, laneY: 12, tilt: -1.5, sweepDistance: 240, maxBlur: 4 },
  // 31: "You can't carry it with you if you want to survive" -> Left side meadow
  { depth: 'foreground', size: 'large', style: 'style-kinetic-italic', laneX: 20, laneY: 68, tilt: 2, sweepDistance: 380, maxBlur: 8 },

  // Scene 8 (Steph): Lines 32-35
  // 32: "The dog days are over" -> Right side sky
  { depth: 'foreground', size: 'massive', style: 'style-neon', laneX: 80, laneY: 18, tilt: -3, sweepDistance: 400, maxBlur: 9 },
  // 33: "The dog days are done" -> Left side meadow
  { depth: 'mid', size: 'large', style: 'style-gradient', laneX: 22, laneY: 74, tilt: 2, sweepDistance: 320, maxBlur: 6 },
  // 34: "Can you hear the horses?" -> Center high sky
  { depth: 'deep', size: 'large', style: 'style-stroke', laneX: 52, laneY: 13, tilt: -2, sweepDistance: 280, maxBlur: 5 },
  // 35: "'Cause here they come" -> Right side meadow
  { depth: 'foreground', size: 'massive', style: 'style-kinetic-italic', laneX: 78, laneY: 70, tilt: 3.5, sweepDistance: 420, maxBlur: 9 },

  // Scene 9 (Tag): Lines 36-39
  // 36: "The dog days are over" -> Left side sky
  { depth: 'foreground', size: 'large', style: 'style-gradient', laneX: 20, laneY: 18, tilt: -2, sweepDistance: 360, maxBlur: 8 },
  // 37: "The dog days are done (Here they come)" -> Right side meadow
  { depth: 'mid', size: 'large', style: 'style-echo', laneX: 78, laneY: 72, tilt: 2, sweepDistance: 320, maxBlur: 6 },
  // 38: "The horses are coming" -> Center high sky
  { depth: 'deep', size: 'large', style: 'style-stroke', laneX: 50, laneY: 14, tilt: -2.5, sweepDistance: 300, maxBlur: 5 },
  // 39: "So you better run (Here they come)" -> Left side lower
  { depth: 'foreground', size: 'massive', style: 'style-echo', laneX: 24, laneY: 76, tilt: 3, sweepDistance: 400, maxBlur: 9 },

  // Scene 10 (End): Lines 40-43
  // 40: "The dog days are over" -> Right side sky
  { depth: 'foreground', size: 'massive', style: 'style-neon', laneX: 80, laneY: 16, tilt: -3, sweepDistance: 420, maxBlur: 9 },
  // 41: "The dog days are done (Here they come)" -> Left side meadow
  { depth: 'mid', size: 'large', style: 'style-echo', laneX: 22, laneY: 68, tilt: 2, sweepDistance: 340, maxBlur: 6 },
  // 42: "The horses are coming" -> Center high sky
  { depth: 'mid', size: 'large', style: 'style-stroke', laneX: 52, laneY: 12, tilt: -2, sweepDistance: 350, maxBlur: 6 },
  // 43: "So you better run" -> Right side meadow
  { depth: 'foreground', size: 'massive', style: 'style-kinetic-italic', laneX: 78, laneY: 78, tilt: 3.5, sweepDistance: 450, maxBlur: 9 },
];

let lyricItems = [];

function initLyricsEngine() {
  if (!lyricsLayerDeep || !lyricsLayerMid || !lyricsLayerForeground) return;

  lyricsLayerDeep.innerHTML = '';
  lyricsLayerMid.innerHTML = '';
  lyricsLayerForeground.innerHTML = '';
  lyricItems = [];

  lyricsData.forEach((text, i) => {
    const preset = LYRIC_PRESETS[i] || {
      depth: 'mid',
      size: 'medium',
      style: 'style-gradient',
      laneX: (i % 2 === 0 ? 22 : 78),
      laneY: 25,
      tilt: 0,
      sweepDistance: 320,
      maxBlur: 6,
    };

    const el = document.createElement('div');
    el.className = `lyric-item depth-${preset.depth} size-${preset.size} ${preset.style}`;
    el.style.setProperty('--lane-x', `${preset.laneX}%`);
    el.style.setProperty('--lane-y', `${preset.laneY}%`);
    el.style.display = 'none';

    const inner = document.createElement('span');
    inner.className = 'lyric-inner';

    if (text.includes('(Here they come)')) {
      inner.innerHTML = text.replace(
        '(Here they come)',
        '<span class="lyric-echo-badge">(Here they come)</span>'
      );
    } else {
      inner.textContent = text;
    }

    el.appendChild(inner);

    if (preset.depth === 'deep') {
      lyricsLayerDeep.appendChild(el);
    } else if (preset.depth === 'foreground') {
      lyricsLayerForeground.appendChild(el);
    } else {
      lyricsLayerMid.appendChild(el);
    }

    lyricItems.push({
      el,
      index: i,
      text,
      depth: preset.depth,
      laneX: preset.laneX,
      laneY: preset.laneY,
      tilt: preset.tilt,
      sweepDistance: preset.sweepDistance || 320,
      maxBlur: preset.maxBlur,
      targetS: 0,
      windowSpan: preset.depth === 'deep' ? 1400 : (preset.depth === 'foreground' ? 1050 : 1200),
      peakOpacity: preset.depth === 'deep' ? 0.65 : (preset.depth === 'foreground' ? 1.0 : 0.95),
      isActive: false,
    });
  });

  recalculateLyricAnchors();
}

function recalculateLyricAnchors() {
  if (!viewport || !scenes.length || !lyricItems.length) return;

  const maxScroll = Math.max(1, viewport.scrollWidth - viewport.clientWidth);

  for (let s = 0; s < scenes.length; s++) {
    const Spin = getScenePinStart(s);
    const pinDist = s === 0 ? D_COVER_TOTAL : (s === scenes.length - 1 ? D_END_TOTAL : D_TOTAL);
    const Snext = s < scenes.length - 1 ? getScenePinStart(s + 1) : maxScroll;
    const travelGap = Math.max(0, Snext - (Spin + pinDist));

    const line0 = s * 4;
    const line1 = s * 4 + 1;
    const line2 = s * 4 + 2;
    const line3 = s * 4 + 3;

    if (lyricItems[line0]) {
      lyricItems[line0].targetS = Math.max(0, s === 0 ? 0 : Spin - 120);
    }
    if (lyricItems[line1]) {
      lyricItems[line1].targetS = Spin + pinDist * 0.45;
    }
    if (lyricItems[line2]) {
      lyricItems[line2].targetS = s === scenes.length - 1
        ? Spin + pinDist * 0.75
        : Spin + pinDist + travelGap * 0.35;
    }
    if (lyricItems[line3]) {
      lyricItems[line3].targetS = s === scenes.length - 1
        ? maxScroll
        : Spin + pinDist + travelGap * 0.75;
    }
  }
}
window.recalculateLyricAnchors = recalculateLyricAnchors;

function updateLyricsParallax(S) {
  if (!lyricItems.length) return;

  const isMobile = window.innerWidth <= 768;

  for (let i = 0; i < lyricItems.length; i++) {
    const item = lyricItems[i];
    const delta = S - item.targetS;
    const halfSpan = (isMobile ? item.windowSpan * 0.75 : item.windowSpan) / 2;

    if (Math.abs(delta) > halfSpan) {
      if (item.isActive || item.el.style.display !== 'none') {
        item.el.style.display = 'none';
        item.isActive = false;
      }
      continue;
    }

    if (!item.isActive) {
      item.el.style.display = 'flex';
      item.isActive = true;
    }

    const progress = delta / halfSpan;
    const envelope = Math.cos((progress * Math.PI) / 2);
    const opacity = Math.pow(Math.max(0, envelope), 1.25) * item.peakOpacity;

    // Dynamic lateral translation across the screen (scaled for mobile screen width):
    const effectiveSweep = isMobile ? item.sweepDistance * 0.28 : item.sweepDistance;
    const sweepX = -progress * effectiveSweep;
    const arcY = -Math.sin(envelope * (Math.PI / 2)) * (isMobile ? 8 : 16);
    const blur = (1 - envelope) * (isMobile ? Math.min(item.maxBlur, 3.5) : item.maxBlur);
    const rotZ = item.tilt + progress * (isMobile ? 1.5 : 3);
    const rotY = progress * (isMobile ? 6 : 14);
    const scale = (0.86 + 0.22 * envelope);

    item.el.style.opacity = opacity.toFixed(3);
    item.el.style.filter = blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : 'none';
    item.el.style.transform = `translate3d(calc(-50% + ${sweepX.toFixed(1)}px), calc(-50% + ${arcY.toFixed(1)}px), 0) scale(${scale.toFixed(3)}) rotateZ(${rotZ.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
  }
}
window.updateLyricsParallax = updateLyricsParallax;

let ticking = false;

function handleScroll() {
  if (!viewport) return;

  const maxScroll = Math.max(1, viewport.scrollWidth - viewport.clientWidth);
  if (journeyProgress) {
    const pct = (viewport.scrollLeft / maxScroll) * 100;
    journeyProgress.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  const S = viewport.scrollLeft;
  const activeIdx = getActiveSceneIndex(S);

  if (activeIdx !== currentSceneIndex) {
    updateSceneUI(activeIdx);
  }

  updateScrollDrivenMorphs();
  updateLyricsParallax(S);
}
window.handleScroll = handleScroll;

viewport?.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      handleScroll();
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

// Sync panorama dimensions with the image in index.html (adapting to any image width / aspect ratio)
const backdropImg = document.getElementById('panorama-backdrop-img');
const backdropLayer = document.querySelector('.panorama-backdrop-layer');

function syncPanoramaDimensions() {
  if (!backdropImg) return;
  let currentSrc = backdropImg.getAttribute('src') || '';
  if (currentSrc.includes('data:image/')) {
    currentSrc = currentSrc.slice(currentSrc.indexOf('data:image/'));
    if (backdropImg.getAttribute('src') !== currentSrc) {
      backdropImg.src = currentSrc;
    }
  }

  const nw = backdropImg.naturalWidth;
  const nh = backdropImg.naturalHeight;
  if (nw && nh) {
    const aspect = nw / nh;
    const computedWidth = Math.round(window.innerHeight * aspect);
    document.documentElement.style.setProperty('--panorama-image-width', `${computedWidth}px`);
    document.documentElement.style.setProperty('--panorama-aspect', `${aspect.toFixed(3)}`);
  }
  if (currentSrc && backdropLayer) {
    backdropLayer.style.setProperty('--panorama-bg', `url("${currentSrc}")`);
    backdropLayer.style.backgroundImage = `url("${currentSrc}")`;
  }

  updateResponsiveBudgets();
  recalculateLyricAnchors();
  if (viewport) updateLyricsParallax(viewport.scrollLeft);
}

if (backdropImg) {
  if (backdropImg.complete) {
    syncPanoramaDimensions();
  } else {
    backdropImg.addEventListener('load', syncPanoramaDimensions);
  }
}

updateResponsiveBudgets();
initLyricsEngine();

if (viewport) viewport.scrollLeft = 0;
updateSceneUI(0);
syncPanoramaDimensions();
handleScroll();
updateScrollDrivenMorphs();
updateLyricsParallax(0);

window.addEventListener('load', () => {
  if (viewport) viewport.scrollLeft = 0;
  updateResponsiveBudgets();
  syncPanoramaDimensions();
  recalculateLyricAnchors();
  handleScroll();
  updateScrollDrivenMorphs();
  updateLyricsParallax(0);
});

window.addEventListener('resize', () => {
  updateResponsiveBudgets();
  syncPanoramaDimensions();
  recalculateLyricAnchors();
  handleScroll();
  updateScrollDrivenMorphs();
  if (viewport) updateLyricsParallax(viewport.scrollLeft);
});
