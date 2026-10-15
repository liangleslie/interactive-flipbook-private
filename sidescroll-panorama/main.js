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

// 4-Phase Animation Budget (in pixels of scroll delta)
const D_APPROACH = 280; // Phase 0: Approach to center (upper-art 50% -> 100%, backing/text 0 -> 1)
const D_LINGER_1 = 140; // Phase 1: Center in-focus linger (upper-art 100%, backing/text 1, narrative2 0)
const D_MORPH = 320;    // Phase 2: Morph upper-art -> lower-art & reveal story-narrative-2
const D_LINGER_2 = 140; // Phase 3: Post-morph linger (lower-art 100%, story-narrative-2 1)
const D_OUTRO = 260;    // Phase 4: Backing & text fade out (1 -> 0), lower-art scales down to 50% (1.0 -> 0.5)
const D_TOTAL = D_LINGER_1 + D_MORPH + D_LINGER_2 + D_OUTRO; // 860px total pinned window

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
  // Scroll to scene pin start plus pre-linger so character is centered in focus & ready to morph
  const pinStart = getScenePinStart(idx);
  const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  return Math.min(pinStart + Math.round(D_LINGER_1 / 2), maxScroll);
}
window.getSceneCenterScroll = getSceneCenterScroll;

function getActiveSceneIndex(S) {
  if (scenes.length <= 1) return 0;
  for (let i = 0; i < scenes.length - 1; i++) {
    const Si = getScenePinStart(i);
    const Snext = getScenePinStart(i + 1);
    const midpoint = (Si + D_TOTAL + Snext) / 2;
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

    // For end scene (no morph target, dedication card)
    if (i === scenes.length - 1) {
      let endOpacity = 1;
      if (delta < -D_APPROACH) {
        endOpacity = 0;
      } else if (delta < 0) {
        const p = (delta + D_APPROACH) / D_APPROACH;
        endOpacity = Math.sin((p * Math.PI) / 2);
      } else {
        endOpacity = 1;
      }
      scene.style.setProperty('--backing-opacity', endOpacity.toFixed(3));
      scene.style.setProperty('--text-opacity', endOpacity.toFixed(3));
      return;
    }

    let backingOpacity = 1;
    let textOpacity = 1;
    let charScale = 1;
    let upperOpacity = 1;
    let lowerOpacity = 0;
    let narrative2Opacity = 0;
    let phase = '';

    if (i === 0 && delta <= 0) {
      // Cover starts already centered in focus
      backingOpacity = 1;
      textOpacity = 1;
      charScale = 1;
      upperOpacity = 1;
      lowerOpacity = 0;
      narrative2Opacity = 0;
      phase = 'cover-focus';
    } else if (delta < -D_APPROACH) {
      // 1) Prior to page coming into focus: upper-art at 50%, backing & text hidden
      backingOpacity = 0;
      textOpacity = 0;
      charScale = 0.5;
      upperOpacity = 1;
      lowerOpacity = 0;
      narrative2Opacity = 0;
      phase = 'approaching-distant';
    } else if (delta < 0) {
      // 2a) Approaching center: upper-art scales to full size, backing & text fade in
      const progressIn = (delta + D_APPROACH) / D_APPROACH;
      const smoothIn = Math.sin((progressIn * Math.PI) / 2);
      backingOpacity = smoothIn;
      textOpacity = smoothIn;
      charScale = 0.5 + 0.5 * smoothIn;
      upperOpacity = 1;
      lowerOpacity = 0;
      narrative2Opacity = 0;
      phase = 'approaching';
    } else if (delta < D_LINGER_1) {
      // 2b) Scrolled to center in focus: upper-art 100%, backing 1.0, text 1.0
      backingOpacity = 1;
      textOpacity = 1;
      charScale = 1;
      upperOpacity = 1;
      lowerOpacity = 0;
      narrative2Opacity = 0;
      phase = 'pre-linger';
    } else if (delta < D_LINGER_1 + D_MORPH) {
      // 3a) Morph upper-art to lower-art and reveal story-narrative-2
      const rawMorph = (delta - D_LINGER_1) / D_MORPH;
      const smoothMorph = Math.sin((rawMorph * Math.PI) / 2);
      backingOpacity = 1;
      textOpacity = 1;
      charScale = 1;
      upperOpacity = 1 - smoothMorph;
      lowerOpacity = smoothMorph;
      narrative2Opacity = smoothMorph;
      phase = 'morphing';
    } else if (delta < D_LINGER_1 + D_MORPH + D_LINGER_2) {
      // 3b) Lower-art & story-narrative-2 registered in full focus
      backingOpacity = 1;
      textOpacity = 1;
      charScale = 1;
      upperOpacity = 0;
      lowerOpacity = 1;
      narrative2Opacity = 1;
      phase = 'post-linger';
    } else if (delta < D_TOTAL) {
      // 4) Backing & text fade out, lower-art scales down to 50%
      const rawOutro = (delta - (D_LINGER_1 + D_MORPH + D_LINGER_2)) / D_OUTRO;
      const smoothOutro = Math.sin((rawOutro * Math.PI) / 2);
      backingOpacity = 1 - smoothOutro;
      textOpacity = 1 - smoothOutro;
      charScale = 1.0 - 0.5 * smoothOutro;
      upperOpacity = 0;
      lowerOpacity = 1;
      narrative2Opacity = 1 - smoothOutro;
      phase = 'outro';
    } else {
      // Page pinning lifted to move on: 50% lower-art avatar moving along landscape
      backingOpacity = 0;
      textOpacity = 0;
      charScale = 0.5;
      upperOpacity = 0;
      lowerOpacity = 1;
      narrative2Opacity = 0;
      phase = 'unpinned';
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
