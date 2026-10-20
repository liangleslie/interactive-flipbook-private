import FlipBook from 'flipbook-js';
import storyBoard from '../resources/story-board.json';

const rawPages = storyBoard.pages || [];
// ponytail: flipbooks require even inner page count for 2-page spreads so back cover closes properly
const pages = [...rawPages];
if (pages.length % 2 === 1 && pages.length >= 2) {
  const endPage = pages.pop();
  pages.push({
    id: 'page-autograph',
    type: 'autograph',
    pageNumber: pages.length,
    navLabel: 'Memories',
    chapterTag: 'Autographs & Memories',
    title: 'Warm Wishes for Sherry! 💖',
    narrative: 'Wishing our favourite Sherry endless joy, laughter, and sunny adventures on your next chapter!',
    narrative2: 'Signed with love from all your friends & teammates! ✨',
    upperArt: '',
    lowerArt: '',
    characterName: '',
    backgroundArt: '',
    cue: 'Flip to close ➔'
  });
  pages.push(endPage);
}
const mobilePillsContainer = document.getElementById('mobile-pills');
const flipbookContainer = document.getElementById('flipbook');

if (mobilePillsContainer) {
  mobilePillsContainer.innerHTML = pages.map((_, idx) => `
    <span class="pill-dot ${idx === 0 ? 'is-active' : ''}" data-step="${idx}"></span>
  `).join('');
}

if (flipbookContainer) {
  flipbookContainer.innerHTML = pages.map((page, idx) => {
    if (page.type === 'cover') {
      return `
        <div class="c-flipbook__page page-cover page-front-cover">
          <div class="cover-inner">
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
            <div class="cover-tap-hint">${page.cue || 'Tap to open ➔'}</div>
          </div>
        </div>
      `;
    }

    if (page.type === 'autograph') {
      const sideClass = (idx % 2 === 1) ? 'page-left' : 'page-right';
      return `
        <div class="c-flipbook__page page-story ${sideClass} page-autograph">
          <div class="story-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:2rem;">
            <div style="font-size:3rem;margin-bottom:1rem;">💖 📝 🐾</div>
            <span class="card-chapter-tag">${page.chapterTag}</span>
            <h3 style="font-size:1.6rem;margin:0.5rem 0;">${page.title}</h3>
            <p style="font-size:1.1rem;margin:0.5rem 0;line-height:1.6;">${page.narrative}</p>
            <p class="story-narrative-2" style="font-size:1rem;color:#e11d48;font-style:italic;margin-top:1rem;">${page.narrative2}</p>
          </div>
        </div>
      `;
    }

    if (page.type === 'divider') {
      const sideClass = (idx % 2 === 1) ? 'page-left' : 'page-right';
      return `
        <div class="c-flipbook__page page-divider ${sideClass}">
          <div class="story-inner" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:2rem;">
            <div style="font-size:2.5rem;margin-bottom:1rem;">✨ 🎭 ✨</div>
            <span class="card-chapter-tag">${page.chapterTag || 'Act'}</span>
            <h2 class="page-title" style="font-size:1.8rem;margin:0.5rem 0;">${page.title || page.navLabel}</h2>
            <p class="page-story-text" style="font-size:1.1rem;margin:0.5rem 0;">${page.narrative || ''}</p>
            <p class="story-narrative-2" style="font-size:1rem;color:#e11d48;font-style:italic;">${page.narrative2 || ''}</p>
          </div>
        </div>
      `;
    }

    if (page.type === 'end') {
      return `
        <div class="c-flipbook__page page-cover page-back-cover">
          <div class="cover-inner back-inner">
            <div class="back-logo">🌟</div>
            <h2>${page.title}</h2>
            <p>${page.narrative || page.text2 || ''}</p>
            <div class="cover-art page-illustration">
              <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} lower" class="character-hero lower-art" />
              <div class="upper-wrapper" title="Tap to lift flap">
                <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} upper" class="character-hero upper-art" />
              </div>
            </div>
            <p class="story-narrative-2">${page.narrative2 || ''}</p>
            <div class="back-footer">
              <span>${page.chapterTag || 'flipbook-js'}</span>
            </div>
          </div>
        </div>
      `;
    }

    const sideClass = (idx % 2 === 1) ? 'page-left' : 'page-right';
    return `
      <div class="c-flipbook__page page-story ${sideClass}">
        <div class="story-content">
          <span class="card-chapter-tag">${page.chapterTag || `Chapter ${idx}`}</span>
          <h3>${page.title}</h3>
          <p>${page.narrative || page.text2 || ''}</p>
          <div class="page-illustration">
            <img src="${page.lowerArt}" alt="${page.characterName || 'Hero'} lower" class="story-img lower-art" />
            <div class="upper-wrapper" title="Tap to lift flap">
              <img src="${page.upperArt}" alt="${page.characterName || 'Hero'} upper" class="story-img upper-art" />
            </div>
          </div>
          <p class="story-narrative-2">${page.narrative2 || ''}</p>
        </div>
      </div>
    `;
  }).join('');
}

// UI elements
const bookContainer = document.getElementById('book-container');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const indicatorEl = document.getElementById('page-indicator');
const pills = Array.from(document.querySelectorAll('.pill-dot'));

// ponytail: patch library bugs in flipbook-js:
// 1. Prevents forward turn overflow past the last page when canClose: true
// 2. Ensures the cover element (r[0]) receives .is-animating when opening so z-index layering is correct
// 3. Guards against multiple concurrent animations during rapid clicks
// 4. Filters transitionend to target element to prevent premature animation termination
FlipBook.prototype.turnPage = function (dir) {
  const { el: t, options: i, classNames: a, Modernizr: o } = this;
  if (!t) return;

  if (t.querySelector(`.${a.page}.${a.isAnimating}`)) return;
  if (dir === 'forward' && this.isLastPage()) return;
  if (dir === 'back' && this.isFirstPage()) return;

  const r = t.querySelectorAll(`.${a.page}.${a.isActive}`);
  const l = t.querySelectorAll(`.${a.page}, .${a.hiddenCover}`);
  const c = this.getActivePages()[0];
  const d = c + 1;
  const isBackAtStart = c === (i.canClose ? 0 : 1) && 'back' === dir;
  const isForwardAtEnd = (d >= (i.canClose ? this.pages.length - 1 : this.pages.length - 2) || this.isLastPage()) && 'forward' === dir;
  if (isBackAtStart || isForwardAtEnd) return;

  let p, v;
  if (typeof dir === 'number') {
    const s = 1 & dir, target = (i.canClose ? s : !s) ? dir : dir + 1, prev = target - 1;
    if (prev === c) return;
    prev > d ? (dir = 'forward', p = prev, v = p + 1) : (dir = 'back', p = target, v = p - 1);
  } else {
    p = 'forward' === dir ? d + 1 : c - 1;
    v = 'forward' === dir ? d + 2 : c - 2;
  }
  if ('forward' === dir && 2 === p) {
    p = 1;
    v = 2;
  }

  const u = 'back' === dir ? r.item(0) : (r.item(1) || r.item(0));
  const f = l.item(p);
  let m = [f];
  if (-1 !== v) {
    m = [...m, l.item(v)];
  }
  const n = [f, u].filter(Boolean);

  r.forEach(e => {
    e.classList.remove(a.isActive);
    e.classList.add(a.wasActive);
  });
  m.forEach(e => {
    e && e.classList.add(a.isActive);
  });
  if (o.csstransforms3d) {
    n.forEach(e => {
      e && e.classList.add(a.isAnimating);
    });
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    n.forEach(e => e && e.classList.remove(a.isAnimating));
    r.forEach(e => e && e.classList.remove(a.wasActive));
  };
  n.forEach(el => {
    const onEnd = (e) => {
      if (e.target !== el || e.propertyName !== 'transform') return;
      el.removeEventListener('transitionend', onEnd);
      cleanup();
    };
    el.addEventListener('transitionend', onEnd);
  });
  setTimeout(cleanup, 950);

  if (i.canClose) {
    const lastEl = m[m.length - 1];
    const isAtEnd = m[0] && m[0].classList.contains(a.lastPage);
    const isAtStart = lastEl && lastEl.classList.contains(a.firstPage);
    if ('back' === dir && isAtStart) {
      t.classList.remove(a.atBackCover);
      t.classList.add(a.atFrontCover);
    } else if ('forward' === dir && isAtEnd) {
      t.classList.remove(a.atFrontCover);
      t.classList.add(a.atBackCover);
    } else {
      t.classList.remove(a.atBackCover);
      t.classList.remove(a.atFrontCover);
    }
  }

  i.onPageTurn(t, { pagesActive: r, children: l });
};

// --- Mobile Step Management (0: Cover, 1: Page 1, 2: Page 2, 3: The End) ---
let mobileStep = 0;

function isMobile() {
  return window.innerWidth <= 768;
}

function updateMobileStepClass() {
  if (!bookContainer) return;
  bookContainer.classList.remove('mobile-step-0', 'mobile-step-1', 'mobile-step-2', 'mobile-step-3');
  if (isMobile()) {
    bookContainer.classList.add(`mobile-step-${mobileStep}`);
  }
  pills.forEach((p, idx) => {
    p.classList.toggle('is-active', idx === mobileStep);
  });
}

function updateIndicator(book) {
  if (isMobile()) {
    indicatorEl.textContent = pages[mobileStep]?.navLabel || (mobileStep === 0 ? 'Cover' : (mobileStep === pages.length - 1 ? 'The End' : `Page ${mobileStep}`));

    if (prevBtn) prevBtn.disabled = mobileStep <= 0;
    if (nextBtn) nextBtn.disabled = mobileStep >= pages.length - 1;
    return;
  }

  // Desktop indicator
  const activePages = book.getActivePages();
  const total = book.pages.length;

  if (activePages.length === 1 && activePages[0] === 0) {
    indicatorEl.textContent = 'Cover';
  } else if (activePages.length === 1 && activePages[0] === total - 1) {
    indicatorEl.textContent = 'The End';
  } else if (activePages.length >= 2) {
    indicatorEl.textContent = `Pages ${activePages[0]}-${activePages[1]}`;
  } else if (activePages.length === 1) {
    indicatorEl.textContent = `Page ${activePages[0]}`;
  }

  if (prevBtn) prevBtn.disabled = book.isFirstPage();
  if (nextBtn) nextBtn.disabled = book.isLastPage();
}

// Initialize FlipBook
const flipbook = new FlipBook('flipbook', {
  nextButton: null, // Custom handler below supports both desktop & mobile
  previousButton: null,
  canClose: true,
  arrowKeys: true,
  initialActivePage: 0,
  width: '100%',
  height: '100%',
  onPageTurn: () => {
    setTimeout(() => {
      updateIndicator(flipbook);
      syncAllWrappers();
    }, 50);
  }
});

function handleNext() {
  if (isMobile()) {
    if (mobileStep === 0) {
      mobileStep = 1;
      flipbook.turnPage('forward');
    } else if (mobileStep === 1) {
      mobileStep = 2;
    } else if (mobileStep === 2) {
      mobileStep = 3;
      flipbook.turnPage('forward');
    }
    updateMobileStepClass();
    updateIndicator(flipbook);
    setTimeout(syncAllWrappers, 80);
    return;
  }

  flipbook.turnPage('forward');
}

function handlePrev() {
  if (isMobile()) {
    if (mobileStep === 3) {
      mobileStep = 2;
      flipbook.turnPage('back');
    } else if (mobileStep === 2) {
      mobileStep = 1;
    } else if (mobileStep === 1) {
      mobileStep = 0;
      flipbook.turnPage('back');
    }
    updateMobileStepClass();
    updateIndicator(flipbook);
    setTimeout(syncAllWrappers, 80);
    return;
  }

  flipbook.turnPage('back');
}

if (nextBtn) nextBtn.addEventListener('click', handleNext);
if (prevBtn) prevBtn.addEventListener('click', handlePrev);

let wasSwiped = false;

// Tap anywhere on book to navigate (left half = prev, right half = next)
if (bookContainer) {
  bookContainer.addEventListener('click', (e) => {
    if (wasSwiped) {
      e.stopPropagation();
      return;
    }
    // If clicking on flap or revealed lower art, let flap handlers process it
    if (e.target.closest('.upper-wrapper') || e.target.closest('.lower-art')) {
      return;
    }

    // Stop propagation so flipbook-js internal page click listeners never fire
    e.stopPropagation();

    const rect = bookContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // On cover, tapping anywhere opens forward; otherwise left half = prev, right half = next
    const atCover = isMobile() ? mobileStep === 0 : flipbook.isFirstPage();
    if (atCover || clickX > rect.width / 2) {
      handleNext();
    } else {
      handlePrev();
    }
  }, true); // Capture phase intercepts before children
}

// Touch Swipe for mobile navigation
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

window.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
}, { passive: true });

window.addEventListener('touchend', (e) => {
  const deltaX = e.changedTouches[0].clientX - touchStartX;
  const deltaY = e.changedTouches[0].clientY - touchStartY;
  const elapsed = Date.now() - touchStartTime;

  if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) && elapsed < 800) {
    wasSwiped = true;
    setTimeout(() => { wasSwiped = false; }, 350);
    if (deltaX < 0) {
      handleNext();
    } else {
      handlePrev();
    }
  }
});

window.addEventListener('resize', () => {
  updateMobileStepClass();
  updateIndicator(flipbook);
  syncAllWrappers();
});


// Interactive art toggle: upper-wrapper (solid white div) is sized 10px larger than lower-art
// ponytail: ResizeObserver + image load listeners ensure wrapper covers lower-art with exact +10px border
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

  // Observe size changes
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => syncArtWrapper(lower, wrapper));
    ro.observe(lower);
  }

  if (lower.complete) {
    syncArtWrapper(lower, wrapper);
  } else {
    lower.addEventListener('load', () => syncArtWrapper(lower, wrapper), { once: true });
  }

  // Click wrapper -> hides whole div (including upper-art), revealing lower-art & narrative2
  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.add('is-hidden');
    const page = container.closest('.c-flipbook__page');
    page?.querySelector('.story-narrative-2')?.classList.add('is-visible');
  });

  // Click lower-art -> restores whole div (including upper-art) & hides narrative2
  lower.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.remove('is-hidden');
    const page = container.closest('.c-flipbook__page');
    page?.querySelector('.story-narrative-2')?.classList.remove('is-visible');
  });

  container.addEventListener('click', (e) => {
    e.stopPropagation();
  });
});

// Initial boot
updateMobileStepClass();
updateIndicator(flipbook);
window.addEventListener('load', syncAllWrappers);
window.addEventListener('resize', syncAllWrappers);
