// Story Cards Deck Engine — Dynamically loaded from resources/story-board.json
import storyBoard from '../resources/story-board.json';

const deckStage = document.getElementById('deck-stage');
const progressSegmentsContainer = document.getElementById('progress-segments');
const chapterPill = document.getElementById('chapter-pill');
const cardCounter = document.getElementById('card-counter');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const tapPrev = document.getElementById('tap-prev');
const tapNext = document.getElementById('tap-next');

let currentIndex = 0;
const pages = storyBoard.pages || [];
const totalCards = pages.length;

// Render deck DOM dynamically from story-board.json
function renderDeckDOM() {
  if (!deckStage || !progressSegmentsContainer) return;

  // 1. Render progress segments
  progressSegmentsContainer.innerHTML = pages.map((_, i) => `
    <div class="progress-segment ${i === 0 ? 'is-active' : ''}" data-index="${i}">
      <div class="progress-fill"></div>
    </div>
  `).join('');

  // 2. Render cards
  deckStage.innerHTML = pages.map((page, i) => {
    if (page.type === 'cover') {
      return `
        <section class="story-card card-cover ${i === 0 ? 'is-active' : 'is-next'}" data-index="${i}">
          <div>
            <span class="cover-badge">${page.chapterTag || page.text1 || 'Story Cards'}</span>
            <h1 class="hero-title">${page.title}</h1>
            <p class="story-subtitle">${page.narrative || page.text2 || ''}</p>
          </div>

          <div class="illustration-stage">
            <div class="flap-box" data-card="${i}" title="Tap to lift flap">
              <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} revealed" class="lower-art" />
              <div class="upper-door">
                <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} cover" class="upper-art" />
              </div>
              <div class="flap-hint-pill">Peek inside 👆</div>
            </div>
          </div>

          <div>
            <p class="story-narrative-2">${page.narrative2 || ''}</p>
            <p class="deck-instruction">${page.cue || 'Tap right to flip card • Tap art to lift flap'}</p>
          </div>
        </section>
      `;
    }

    if (page.type === 'divider') {
      return `
        <section class="story-card card-divider ${i === 0 ? 'is-active' : ''}" data-index="${i}">
          <div style="text-align:center;padding:1.5rem 0.5rem;">
            <div style="font-size:2.5rem;margin-bottom:0.75rem;">✨ 🎭 ✨</div>
            <span class="cover-badge" style="background:#ffe4e6;color:#be123c;padding:0.3rem 1rem;border-radius:999px;font-weight:700;">${page.chapterTag || 'Act'}</span>
            <h2 class="card-title" style="font-size:2rem;margin:0.75rem 0;color:#9f1239;">${page.title || page.navLabel}</h2>
            <p class="card-narrative" style="font-size:1.1rem;color:#475569;margin-bottom:0.5rem;">${page.narrative || ''}</p>
            <p class="story-narrative-2" style="font-size:1rem;color:#e11d48;font-style:italic;">${page.narrative2 || ''}</p>
            <p class="deck-instruction" style="margin-top:1rem;">${page.cue || 'Tap right to flip card ➔'}</p>
          </div>
        </section>
      `;
    }

    if (page.type === 'end') {
      return `
        <section class="story-card card-end ${i === 0 ? 'is-active' : ''}" data-index="${i}">
          <div>
            <span class="end-ribbon">${page.chapterTag || page.text1 || 'Special Edition'}</span>
            <h2 class="end-title">${page.title}</h2>
            <p class="end-message">${page.narrative || page.text2 || ''}</p>
          </div>

          <div class="illustration-stage">
            <div class="flap-box" data-card="${i}" title="${page.characterName || 'Hero'}">
              <img src="${page.lowerArt}" alt="Celebration" class="lower-art" />
              <div class="upper-door">
                <img src="${page.upperArt}" alt="Celebration" class="upper-art" />
              </div>
              <div class="flap-hint-pill">Peek inside 👆</div>
            </div>
          </div>

          <div>
            <p class="story-narrative-2">${page.narrative2 || ''}</p>
          </div>

          <div class="end-actions">
            <button class="btn-replay" id="btn-replay">↺ Replay Story Cards</button>
          </div>
        </section>
      `;
    }

    // Standard story card
    return `
      <section class="story-card card-story ${i === 0 ? 'is-active' : (i === 1 ? 'is-next' : 'is-next-2')}" data-index="${i}">
        <div class="card-meta-row">
          <span class="chapter-badge">${page.chapterTag || page.text1 || `Chapter ${page.pageNumber}`}</span>
          <span class="card-num">${String(page.pageNumber || i).padStart(2, '0')}</span>
        </div>

        <div>
          <h2 class="card-heading">${page.title}</h2>
          <p class="card-narrative">${page.narrative || page.text2 || ''}</p>
        </div>

        <div class="illustration-stage">
          <div class="flap-box" data-card="${i}" title="Tap to lift flap">
            <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} inside" class="lower-art" />
            <div class="upper-door">
              <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} outside" class="upper-art" />
            </div>
            <div class="flap-hint-pill">Lift flap 👆</div>
          </div>
        </div>

        <div>
          <p class="story-narrative-2">${page.narrative2 || ''}</p>
          <p class="deck-instruction">${page.cue || 'Tap right to flip card • Tap art to lift flap'}</p>
        </div>
      </section>
    `;
  }).join('');
}

renderDeckDOM();

const cards = Array.from(document.querySelectorAll('.story-card'));
const segments = Array.from(document.querySelectorAll('.progress-segment'));
const flapBoxes = Array.from(document.querySelectorAll('.flap-box'));
const btnReplay = document.getElementById('btn-replay');

function updateDeckState(targetIndex) {
  if (targetIndex < 0 || targetIndex >= totalCards) return;
  currentIndex = targetIndex;

  // 1. Update card stack classes for 3D depth
  cards.forEach((card, idx) => {
    card.classList.remove('is-active', 'is-next', 'is-next-2', 'is-prev');

    if (idx < currentIndex) {
      card.classList.add('is-prev');
    } else if (idx === currentIndex) {
      card.classList.add('is-active');
    } else if (idx === currentIndex + 1) {
      card.classList.add('is-next');
    } else if (idx === currentIndex + 2) {
      card.classList.add('is-next-2');
    }
  });

  // 2. Update segmented progress bars
  segments.forEach((seg, idx) => {
    seg.classList.toggle('is-viewed', idx < currentIndex);
    seg.classList.toggle('is-active', idx === currentIndex);
  });

  // 3. Update top nav pills
  if (chapterPill) {
    chapterPill.textContent = pages[currentIndex]?.navLabel || `Card ${currentIndex + 1}`;
  }
  if (cardCounter) {
    cardCounter.textContent = `${currentIndex + 1} / ${totalCards}`;
  }

  // 4. Update button states
  if (btnPrev) btnPrev.disabled = currentIndex <= 0;
  if (btnNext) btnNext.disabled = currentIndex >= totalCards - 1;
}

window.goToCard = updateDeckState;

function nextCard() {
  if (currentIndex < totalCards - 1) {
    updateDeckState(currentIndex + 1);
  }
}

function prevCard() {
  if (currentIndex > 0) {
    updateDeckState(currentIndex - 1);
  }
}

btnPrev?.addEventListener('click', (e) => {
  e.stopPropagation();
  prevCard();
});

btnNext?.addEventListener('click', (e) => {
  e.stopPropagation();
  nextCard();
});

tapPrev?.addEventListener('click', (e) => {
  e.stopPropagation();
  prevCard();
});

tapNext?.addEventListener('click', (e) => {
  e.stopPropagation();
  nextCard();
});

// Click progress segment to jump directly
segments.forEach((seg, idx) => {
  seg.addEventListener('click', (e) => {
    e.stopPropagation();
    updateDeckState(idx);
  });
});

// Replay button on final card
btnReplay?.addEventListener('click', (e) => {
  e.stopPropagation();
  flapBoxes.forEach((box) => {
    const door = box.querySelector('.upper-door');
    if (door) {
      door.classList.remove('is-lifted');
    }
    box.classList.remove('is-revealed');
    box.closest('.story-card')?.querySelector('.story-narrative-2')?.classList.remove('is-visible');
  });
  updateDeckState(0);
});

// 3D Tactile Flap Lift Interaction
flapBoxes.forEach((box) => {
  box.addEventListener('click', (e) => {
    e.stopPropagation();
    const door = box.querySelector('.upper-door');
    if (!door) return;

    const isLifted = door.classList.toggle('is-lifted');
    box.classList.toggle('is-revealed', isLifted);
    const narrative2 = box.closest('.story-card')?.querySelector('.story-narrative-2');
    if (narrative2) narrative2.classList.toggle('is-visible', isLifted);
  });
});

// Touch Swipe Gestures
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

window.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
}, { passive: true });

window.addEventListener('touchend', (e) => {
  if (e.changedTouches.length === 0) return;
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;
  const timeDiff = Date.now() - touchStartTime;

  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40 && timeDiff < 600) {
    if (diffX < 0) {
      nextCard();
    } else {
      prevCard();
    }
  }
}, { passive: true });

// Keyboard Navigation
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    nextCard();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    prevCard();
  }
});

updateDeckState(0);
