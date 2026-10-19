// Vertical Storyboard Snap Feed Engine — Dynamically loaded from resources/story-board.json
import storyBoard from '../resources/story-board.json';

const viewport = document.getElementById('feed-viewport');
const verticalTracker = document.getElementById('vertical-tracker');
const chapterPill = document.getElementById('chapter-pill');
const feedCounter = document.getElementById('feed-counter');
const btnPrev = document.getElementById('btn-prev-section');
const btnNext = document.getElementById('btn-next-section');

let currentSectionIndex = 0;
const pages = storyBoard.pages || [];
const totalSections = pages.length;

function renderVerticalFeedDOM() {
  if (!viewport || !verticalTracker) return;

  // 1. Render tracker dots
  verticalTracker.innerHTML = pages.map((page, i) => `
    <button class="tracker-node ${i === 0 ? 'is-active' : ''}" data-index="${i}" aria-label="${page.navLabel || `Section ${i + 1}`}"></button>
  `).join('');

  // 2. Render snap sections
  viewport.innerHTML = pages.map((page, i) => {
    if (page.type === 'cover') {
      return `
        <section class="feed-section section-cover" id="section-${i}" data-index="${i}">
          <div>
            <span class="cover-badge">${page.chapterTag || page.text1 || 'Vertical Feed'}</span>
            <h1 class="hero-title">${page.title}</h1>
            <p class="story-subtitle">${page.narrative || page.text2 || ''}</p>
          </div>

          <div class="illustration-container">
            <div class="flap-box" data-section="${i}" title="Tap to lift flap">
              <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} revealed inside" class="lower-art" />
              <div class="upper-flap">
                <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} cover" class="upper-art" />
              </div>
              <div class="flap-hint-pill">Peek inside 👆</div>
            </div>
          </div>

          <p class="story-narrative-2">${page.narrative2 || ''}</p>

          <div class="section-footer-cue">
            <span>${page.cue || 'Scroll down to begin ▼'}</span>
          </div>
        </section>
      `;
    }

    if (page.type === 'divider') {
      return `
        <section class="feed-section section-divider" id="section-${i}" data-index="${i}">
          <div style="text-align:center;padding:2rem 1rem;">
            <div style="font-size:2.5rem;margin-bottom:0.75rem;">✨ 🎭 ✨</div>
            <span class="cover-badge" style="background:#ffe4e6;color:#be123c;padding:0.3rem 1rem;border-radius:999px;font-weight:700;">${page.chapterTag || 'Act'}</span>
            <h2 class="cover-title" style="font-size:2rem;margin:0.75rem 0;color:#9f1239;">${page.title || page.navLabel}</h2>
            <p class="cover-tagline" style="font-size:1.1rem;color:#475569;margin-bottom:0.5rem;">${page.narrative || ''}</p>
            <p class="story-narrative-2" style="font-size:1rem;color:#e11d48;font-style:italic;">${page.narrative2 || ''}</p>
          </div>
          <div class="section-footer-cue">
            <span>${page.cue || 'Scroll down to continue ▼'}</span>
          </div>
        </section>
      `;
    }

    if (page.type === 'end') {
      return `
        <section class="feed-section section-end" id="section-${i}" data-index="${i}">
          <div>
            <span class="end-ribbon">${page.chapterTag || page.text1 || 'With Love'}</span>
            <h2 class="end-title">${page.title}</h2>
            <p class="end-narrative">${page.narrative || page.text2 || ''}</p>
          </div>

          <div class="illustration-container">
            <div class="flap-box" data-section="${i}" title="${page.characterName || 'Hero'}">
              <img src="${page.lowerArt}" alt="Celebration" class="lower-art" />
              <div class="upper-flap">
                <img src="${page.upperArt}" alt="Celebration" class="upper-art" />
              </div>
              <div class="flap-hint-pill">Peek inside 👆</div>
            </div>
          </div>

          <p class="story-narrative-2">${page.narrative2 || ''}</p>

          <div>
            <button class="btn-restart" id="btn-restart">▲ Scroll Back to Top</button>
          </div>
        </section>
      `;
    }

    // Standard story section
    return `
      <section class="feed-section section-story" id="section-${i}" data-index="${i}">
        <div class="section-meta-row">
          <span class="chapter-tag">${page.chapterTag || page.text1 || `Chapter ${page.pageNumber}`}</span>
          <span class="page-indicator">${String(page.pageNumber || i).padStart(2, '0')}</span>
        </div>

        <div>
          <h2 class="section-heading">${page.title}</h2>
          <p class="section-narrative">${page.narrative || page.text2 || ''}</p>
        </div>

        <div class="illustration-container">
          <div class="flap-box" data-section="${i}" title="Tap to lift flap">
            <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} inside" class="lower-art" />
            <div class="upper-flap">
              <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} outside" class="upper-art" />
            </div>
            <div class="flap-hint-pill">Lift flap 👆</div>
          </div>
        </div>

        <p class="story-narrative-2">${page.narrative2 || ''}</p>

        <div class="section-footer-cue">
          <span>${page.cue || 'Scroll for next chapter ▼'}</span>
        </div>
      </section>
    `;
  }).join('');
}

renderVerticalFeedDOM();

const trackerNodes = Array.from(document.querySelectorAll('.tracker-node'));
const flapBoxes = Array.from(document.querySelectorAll('.flap-box'));
const btnRestart = document.getElementById('btn-restart');

function updateActiveSection(idx) {
  if (idx < 0 || idx >= totalSections) return;
  currentSectionIndex = idx;

  if (chapterPill) {
    chapterPill.textContent = pages[idx]?.navLabel || `Section ${idx + 1}`;
  }
  if (feedCounter) {
    feedCounter.textContent = `${idx + 1} / ${totalSections}`;
  }

  trackerNodes.forEach((node, i) => {
    node.classList.toggle('is-active', i === idx);
  });

  if (btnPrev) btnPrev.disabled = idx <= 0;
  if (btnNext) btnNext.disabled = idx >= totalSections - 1;
}

function scrollToSection(idx) {
  if (!viewport || idx < 0 || idx >= totalSections) return;
  const targetTop = idx * viewport.clientHeight;
  viewport.scrollTo({
    top: targetTop,
    behavior: 'smooth'
  });
  updateActiveSection(idx);
}

window.scrollToSection = scrollToSection;

btnPrev?.addEventListener('click', () => scrollToSection(currentSectionIndex - 1));
btnNext?.addEventListener('click', () => scrollToSection(currentSectionIndex + 1));
btnRestart?.addEventListener('click', () => {
  flapBoxes.forEach((box) => {
    const flap = box.querySelector('.upper-flap');
    if (flap) {
      flap.classList.remove('is-lifted');
    }
    box.classList.remove('is-revealed');
    box.closest('.feed-section')?.querySelector('.story-narrative-2')?.classList.remove('is-visible');
  });
  scrollToSection(0);
});

trackerNodes.forEach((node, idx) => {
  node.addEventListener('click', () => scrollToSection(idx));
});

let ticking = false;

function onScroll() {
  if (!viewport) return;
  const itemHeight = viewport.clientHeight;
  if (itemHeight <= 0) return;

  const scrollMiddle = viewport.scrollTop + itemHeight / 2;
  const closestIdx = Math.min(totalSections - 1, Math.max(0, Math.floor(scrollMiddle / itemHeight)));

  if (closestIdx !== currentSectionIndex) {
    updateActiveSection(closestIdx);
  }
}

viewport?.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      onScroll();
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

flapBoxes.forEach((box) => {
  box.addEventListener('click', (e) => {
    e.stopPropagation();
    const flap = box.querySelector('.upper-flap');
    if (!flap) return;

    const isLifted = flap.classList.toggle('is-lifted');
    box.classList.toggle('is-revealed', isLifted);
    const narrative2 = box.closest('.feed-section')?.querySelector('.story-narrative-2');
    if (narrative2) narrative2.classList.toggle('is-visible', isLifted);
  });
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'PageDown') {
    scrollToSection(currentSectionIndex + 1);
  } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
    scrollToSection(currentSectionIndex - 1);
  }
});

updateActiveSection(0);
