// Continuous Panorama Engine — Dynamically loaded from resources/story-board.json
import storyBoard from '../resources/story-board.json';

const viewport = document.getElementById('panorama-viewport');
const journeyTrack = document.getElementById('journey-track');
const panoramaWorld = document.getElementById('panorama-world');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const chapterLabel = document.getElementById('chapter-label');
const journeyProgress = document.getElementById('journey-progress');

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
              <span class="scene-badge">${page.text1 || page.badge || 'Special Edition'}</span>
              <h1 class="hero-title">${page.title}</h1>
              <p class="story-subtitle">${page.text2 || page.subtitle || ''}</p>

              <div class="character-spot">
                <div class="character-morph-target" data-index="${i}" title="Tap or scroll to morph">
                  <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} revealed" class="character-img lower-art" />
                  <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} cover" class="character-img upper-art" />
                </div>
              </div>

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
              <p class="end-dedication">${page.text2 || page.narrative || ''}</p>
              <div class="end-tag">${page.text1 || page.ribbon || 'Continuous Story Panorama'}</div>
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
              <span class="chapter-tag">${page.text1 || page.chapterTag || `Chapter ${page.pageNumber}`}</span>
            </div>
            <h2 class="scene-heading">${page.title}</h2>
            <p class="scene-narrative">${page.text2 || page.narrative || ''}</p>

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

// Pronounced scroll-pin budget for each character station (in pixels of scroll delta)
const D_PRE = 260;    // Phase 1: Pronounced pre-morph linger at center (stationary, upper-art registered)
const D_MORPH = 320;  // Phase 2: Gradual deliberate morph while stationary at center (upper-art -> lower-art)
const D_POST = 260;   // Phase 3: Pronounced post-morph linger at center (stationary, lower-art registered)
const D_TOTAL = D_PRE + D_MORPH + D_POST; // 840px total stationary window

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
  if (idx === scenes.length - 1) {
    return maxScroll;
  }
  const scene = scenes[idx];
  const card = scene.querySelector('.station-card') || scene.querySelector('.station-flow');
  const stationWidth = card ? card.offsetWidth : (scene.offsetWidth || 440);
  const natural = Math.round(scene.offsetLeft - (viewport.clientWidth - stationWidth) / 2);
  return Math.min(Math.max(0, natural), maxScroll);
}
window.getScenePinStart = getScenePinStart;

function getSceneCenterScroll(idx) {
  if (idx === 0) return 0;
  if (idx === scenes.length - 1) {
    return Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  }
  // Scroll to scene pin start plus pre-linger so character is centered & ready to morph
  const pinStart = getScenePinStart(idx);
  const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  return Math.min(pinStart + D_PRE, maxScroll);
}
window.getSceneCenterScroll = getSceneCenterScroll;

function getActiveSceneIndex(S) {
  const S0 = getScenePinStart(0);
  const S1 = getScenePinStart(1);
  const S2 = getScenePinStart(2);
  const S3 = getScenePinStart(3);

  const T01 = (S0 + D_TOTAL + S1) / 2;
  const T12 = (S1 + D_TOTAL + S2) / 2;
  const T23 = (S2 + D_TOTAL + S3) / 2;

  if (S < T01) return 0;
  if (S < T12) return 1;
  if (S < T23) return 2;
  return 3;
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
  for (let i = 0; i < scenes.length - 1; i++) {
    const sc = getScenePinStart(i);
    const delta = S - sc;
    if (delta >= 0 && delta <= D_TOTAL) {
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
  for (let i = 0; i < scenes.length - 1; i++) {
    const S_pin = getScenePinStart(i);
    const delta = S - S_pin;
    if (delta <= 0) {
      break;
    } else if (delta < D_TOTAL) {
      shift += delta;
      break;
    } else {
      shift += D_TOTAL;
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

  // Native position:sticky keeps .station-flow pinned smoothly on compositor thread.
  // JS now only drives the character opacity cross-dissolve & phase attributes.
  scenes.forEach((scene, i) => {
    const morphTarget = scene.querySelector('.character-morph-target');
    const upper = scene.querySelector('.character-morph-target .upper-art');
    const lower = scene.querySelector('.character-morph-target .lower-art');

    if (i >= scenes.length - 1) return;

    const S_pin = getScenePinStart(i);
    const delta = S - S_pin;

    let morphProgress = 0;
    let phase = '';

    if (delta < 0) {
      morphProgress = 0;
    } else if (delta < D_PRE) {
      morphProgress = 0;
      phase = 'pre-linger';
    } else if (delta < D_PRE + D_MORPH) {
      const raw = (delta - D_PRE) / D_MORPH;
      morphProgress = Math.sin((raw * Math.PI) / 2);
      phase = 'morphing';
    } else if (delta < D_TOTAL) {
      morphProgress = 1;
      phase = 'post-linger';
    } else {
      morphProgress = 1;
    }

    if (morphTarget) {
      if (phase) morphTarget.setAttribute('data-phase', phase);
      else morphTarget.removeAttribute('data-phase');
    }

    const narrative2 = scene.querySelector('.story-narrative-2');

    if (upper && lower && !morphTarget?.classList.contains('is-pinned')) {
      upper.style.opacity = (1 - morphProgress).toFixed(3);
      upper.style.transform = `translate(-50%, -50%) scale(${(1 + 0.05 * morphProgress).toFixed(3)})`;

      lower.style.opacity = morphProgress.toFixed(3);
      lower.style.transform = `translate(-50%, -50%) scale(${(0.95 + 0.05 * morphProgress).toFixed(3)})`;

      if (narrative2) {
        narrative2.style.opacity = morphProgress.toFixed(3);
        narrative2.style.transform = `translateY(${(6 * (1 - morphProgress)).toFixed(1)}px)`;
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
  const nw = backdropImg.naturalWidth;
  const nh = backdropImg.naturalHeight;
  if (nw && nh) {
    const aspect = nw / nh;
    const computedWidth = Math.round(window.innerHeight * aspect);
    document.documentElement.style.setProperty('--panorama-image-width', `${computedWidth}px`);
    document.documentElement.style.setProperty('--panorama-aspect', `${aspect.toFixed(3)}`);
  }
  const currentSrc = backdropImg.getAttribute('src');
  if (currentSrc && backdropLayer && !backdropLayer.style.backgroundImage) {
    backdropLayer.style.setProperty('--panorama-bg', `url("${currentSrc}")`);
  }
}

if (backdropImg) {
  if (backdropImg.complete) {
    syncPanoramaDimensions();
  } else {
    backdropImg.addEventListener('load', syncPanoramaDimensions);
  }
}

if (viewport) viewport.scrollLeft = 0;
updateSceneUI(0);
syncPanoramaDimensions();
handleScroll();
updateScrollDrivenMorphs();

window.addEventListener('load', () => {
  if (viewport) viewport.scrollLeft = 0;
  syncPanoramaDimensions();
  handleScroll();
  updateScrollDrivenMorphs();
});

window.addEventListener('resize', () => {
  syncPanoramaDimensions();
  handleScroll();
  updateScrollDrivenMorphs();
});
