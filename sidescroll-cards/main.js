// Horizontal Strip + Lift Flaps Engine — Dynamically loaded from resources/story-board.json
import storyBoard from '../resources/story-board.json';

const stripContainer = document.getElementById('strip-container');
const stripTrack = document.getElementById('strip-track');
const stripProgress = document.getElementById('strip-progress');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const indicatorEl = document.getElementById('page-indicator');

const pages = storyBoard.pages || [];
const labels = pages.map(p => p.navLabel || p.title);

function renderSidescrollCardsDOM() {
  if (!stripTrack || !stripProgress) return;

  // 1. Render progress pills
  stripProgress.innerHTML = pages.map((page, i) => `
    <button class="progress-pill ${i === 0 ? 'is-active' : ''}" data-index="${i}" aria-label="${page.navLabel}">
      <span>${page.navLabel}</span>
    </button>
  `).join('');

  // 2. Render cards
  stripTrack.innerHTML = pages.map((page, i) => {
    if (page.type === 'cover') {
      return `
        <section class="strip-card card-cover card-front-cover is-active" data-index="${i}" id="card-${i}">
          <div class="card-inner cover-inner">
            <span class="cover-badge">${page.chapterTag || page.text1 || 'Special Edition'}</span>
            <h2 class="cover-title">${page.title}</h2>
            <div class="cover-art">
              <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} lower" class="character-hero lower-art" />
              <div class="upper-wrapper" title="Tap to lift flap">
                <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} upper" class="character-hero upper-art" />
              </div>
            </div>
            <p class="cover-author">${page.narrative || page.text2 || ''}</p>
            <p class="story-narrative-2">${page.narrative2 || ''}</p>
            <div class="cover-tap-hint">${page.cue || 'Swipe sideways to explore ➔'}</div>
          </div>
        </section>
      `;
    }

    if (page.type === 'divider') {
      return `
        <section class="strip-card card-divider" data-index="${i}" id="card-${i}">
          <div class="card-inner cover-inner">
            <span class="cover-badge">${page.chapterTag || 'Act'}</span>
            <h2 class="cover-title">${page.title || page.navLabel}</h2>
            <p class="cover-author">${page.narrative || ''}</p>
            <p class="story-narrative-2">${page.narrative2 || ''}</p>
            <div class="cover-tap-hint">${page.cue || 'Swipe sideways to explore ➔'}</div>
          </div>
        </section>
      `;
    }

    if (page.type === 'end') {
      return `
        <section class="strip-card card-cover card-back-cover" data-index="${i}" id="card-${i}">
          <div class="card-inner cover-inner back-inner">
            <div class="back-logo">🌟</div>
            <h2 class="back-title">${page.title}</h2>
            <p class="back-author">${page.narrative || page.text2 || ''}</p>
            <div class="cover-art page-illustration">
              <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} lower" class="character-hero lower-art" />
              <div class="upper-wrapper" title="Tap to lift flap">
                <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} upper" class="character-hero upper-art" />
              </div>
            </div>
            <p class="story-narrative-2">${page.narrative2 || ''}</p>
            <div class="back-footer">
              <span>${page.chapterTag || 'Sidescrolling Storybook'}</span>
            </div>
          </div>
        </section>
      `;
    }

    // Story card
    return `
      <section class="strip-card card-story card-story-${page.id || i}" data-index="${i}" id="card-${i}">
        <div class="card-inner story-content">
          <div class="card-badge-row">
            <span class="card-chapter-tag">${page.chapterTag || page.text1 || `Chapter ${page.pageNumber}`}</span>
          </div>
          <h2 class="story-title">${page.title}</h2>
          <p class="story-narrative">${page.narrative || page.text2 || ''}</p>
          <div class="page-illustration">
            <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} lower" class="story-img lower-art" />
            <div class="upper-wrapper" title="Tap to lift flap">
              <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} upper" class="story-img upper-art" />
            </div>
          </div>
          <p class="story-narrative-2">${page.narrative2 || ''}</p>
        </div>
      </section>
    `;
  }).join('');
}

renderSidescrollCardsDOM();

const cards = Array.from(document.querySelectorAll('.strip-card'));
const pills = Array.from(document.querySelectorAll('.progress-pill'));

let currentIndex = 0;
let isProgrammaticScroll = false;
let scrollSettleTimer = null;
let isTouchSwiping = false;
let touchStartX = 0;
let touchStartY = 0;

function updateIndicator(idx) {
  currentIndex = idx;
  if (indicatorEl) {
    indicatorEl.textContent = labels[idx] || `Page ${idx}`;
  }
  if (prevBtn) prevBtn.disabled = idx <= 0;
  if (nextBtn) nextBtn.disabled = idx >= cards.length - 1;

  pills.forEach((pill, i) => {
    pill.classList.toggle('is-active', i === idx);
  });

  cards.forEach((card, i) => {
    card.classList.toggle('is-active', i === idx);
  });

  syncAllWrappers();
}

function scrollToIndex(idx) {
  if (idx < 0 || idx >= cards.length) return;
  const targetCard = cards[idx];
  if (!targetCard || !stripContainer) return;

  isProgrammaticScroll = true;
  clearTimeout(scrollSettleTimer);

  const targetLeft = targetCard.offsetLeft - (stripContainer.clientWidth - targetCard.offsetWidth) / 2;
  stripContainer.scrollTo({
    left: Math.round(targetLeft),
    behavior: 'smooth'
  });

  updateIndicator(idx);

  scrollSettleTimer = setTimeout(() => {
    isProgrammaticScroll = false;
  }, 450);
}

prevBtn?.addEventListener('click', () => scrollToIndex(currentIndex - 1));
nextBtn?.addEventListener('click', () => scrollToIndex(currentIndex + 1));

pills.forEach((pill, idx) => {
  pill.addEventListener('click', () => scrollToIndex(idx));
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown') scrollToIndex(currentIndex + 1);
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') scrollToIndex(currentIndex - 1);
});

// Wheel stepping
let wheelThrottle = false;
window.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  if (Math.abs(e.deltaY) < 15) return;
  e.preventDefault();

  if (wheelThrottle) return;
  wheelThrottle = true;
  setTimeout(() => { wheelThrottle = false; }, 320);

  if (e.deltaY > 0) {
    scrollToIndex(currentIndex + 1);
  } else {
    scrollToIndex(currentIndex - 1);
  }
}, { passive: false });

function getCenteredCardIndex() {
  if (!stripContainer) return 0;
  const containerCenter = stripContainer.scrollLeft + stripContainer.clientWidth / 2;
  let closestIdx = 0;
  let minDistance = Infinity;

  cards.forEach((card, idx) => {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const dist = Math.abs(containerCenter - cardCenter);
    if (dist < minDistance) {
      minDistance = dist;
      closestIdx = idx;
    }
  });

  return closestIdx;
}

stripContainer?.addEventListener('scroll', () => {
  if (isProgrammaticScroll || isTouchSwiping) return;
  const centered = getCenteredCardIndex();
  if (centered !== currentIndex) {
    updateIndicator(centered);
  }
}, { passive: true });

stripContainer?.addEventListener('touchstart', (e) => {
  isTouchSwiping = true;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

stripContainer?.addEventListener('touchend', (e) => {
  isTouchSwiping = false;
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;

  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
    if (diffX < 0) {
      scrollToIndex(currentIndex + 1);
    } else {
      scrollToIndex(currentIndex - 1);
    }
  } else {
    const centered = getCenteredCardIndex();
    scrollToIndex(centered);
  }
}, { passive: true });

// Sizing alignment between upper & lower art
// ponytail: offsetWidth/Height avoid getBoundingClientRect scale(0.95) distortion, +10px ensures flap fully covers lower art
function syncArtWrapper(lower, wrapper) {
  if (!lower || !wrapper) return;
  const w = lower.offsetWidth || lower.naturalWidth;
  const h = lower.offsetHeight || lower.naturalHeight;

  if (w > 0 && h > 0) {
    wrapper.style.width = `${Math.round(w + 10)}px`;
    wrapper.style.height = `${Math.round(h + 10)}px`;
  }
}

function syncAllWrappers() {
  document.querySelectorAll('.cover-art, .page-illustration').forEach((container) => {
    const lower = container.querySelector('.lower-art');
    const wrapper = container.querySelector('.upper-wrapper');
    syncArtWrapper(lower, wrapper);
  });
}

document.querySelectorAll('.cover-art, .page-illustration').forEach((container) => {
  const lower = container.querySelector('.lower-art');
  const wrapper = container.querySelector('.upper-wrapper');
  if (!lower || !wrapper) return;

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => syncArtWrapper(lower, wrapper));
    ro.observe(lower);
  }

  if (lower.complete) {
    syncArtWrapper(lower, wrapper);
  } else {
    lower.addEventListener('load', () => syncArtWrapper(lower, wrapper), { once: true });
  }

  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.add('is-hidden');
    const card = container.closest('.strip-card');
    card?.querySelector('.story-narrative-2')?.classList.add('is-visible');
  });

  lower.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.remove('is-hidden');
    const card = container.closest('.strip-card');
    card?.querySelector('.story-narrative-2')?.classList.remove('is-visible');
  });
});

updateIndicator(0);
window.addEventListener('load', syncAllWrappers);
window.addEventListener('resize', () => {
  syncAllWrappers();
  scrollToIndex(currentIndex);
});
