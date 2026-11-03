# Magic Storybook ✨

Interactive mobile reading prototypes exploring modern UI and interaction paradigms for illustrated children's storybooks, featuring tactile peek-a-boo flaps and progressive layer reveals.

## Overview

This repository explores 5 distinct reading experiences for mobile and desktop web, demonstrating how children's lift-the-flap picture books can be reimagined digitally:

1. **Responsive 3D Flipbook** (`/page-flip/`)  
   Realistic 3D page turns (`flipbook-js` + custom CSS 3D transforms), dual-page spread on desktop, single-page touch-step navigation on mobile, and 3D flap-lift interactions.

2. **Horizontal Story Strip** (`/sidescroll-cards/`)  
   Horizontal landscape scroll with pill progress tracking, snap positioning, and interactive peek-a-boo flaps.

3. **Continuous Story Panorama** (`/sidescroll-panorama/`)  
   Continuous side-scrolling panoramic world with an infinite looping illustrated backdrop, scripted animated sprites (butterflies, soaring songbirds, hot air balloons), and scroll-anchored morphing transitions between character layers.

4. **Vertical Storyboard** (`/vertical-story/`)  
   Modern full-screen vertical snap-scroll (social story / feed style) with right-edge chapter progress dots and tap-to-reveal flaps.

5. **Story Cards Deck** (`/story-cards/`)  
   Full-screen tap-to-advance card deck with segmented top progress bars (Instagram Stories / Tinder deck style) for focused, distraction-free illustration display.

---

## Shared Architecture

All 5 prototypes dynamically render from a single centralized story specification:

- **Source of Truth**: [`resources/story-board.json`](file:///home/leslie/Downloads/photos/For%20sherry/resources/story-board.json) defines all chapters, titles, narrative text, character attributes, and layer asset paths.
- **Visual Assets**: Contained in `resources/png/` and `resources/jpg/`, featuring stylized fictional storybook characters (**Aria**, **Leo**, and **Felix**) with upper/lower flap layers.
- **Silent & Accessible**: Built without external audio/sound effects for a clean, peaceful reading experience across all devices.

---

## Getting Started

### Prerequisites
- Node.js (v20+) or [`uv`](https://github.com/astral-sh/uv).

### Development Server
```bash
# Install dependencies
uv run npm install

# Start Vite dev server
uv run npm run dev
```

The dev server will redirect `http://localhost:5173/` to `/portal/` (or navigate directly to any prototype route).

### Production Build
```bash
uv run npm run build
```

Compiled bundles for all 5 prototypes and the portal are output to `dist/`.

### Standalone Distribution Bundle (Single HTML)

To package a prototype into a completely self-contained, offline-ready single HTML file with all images, stylesheets, scripts, and storyboard data inlined:

```bash
# Package continuous panorama (default) -> dist/distro.html
uv run node bundle.mjs --panorama
# or via npm script:
uv run npm run bundle -- --panorama

# Package responsive 3D flipbook -> dist/distro.html
uv run node bundle.mjs --flip

# Package horizontal story strip -> dist/distro.html
uv run node bundle.mjs --cards

# Package vertical storyboard -> dist/distro.html
uv run node bundle.mjs --vertical

# Package story cards deck -> dist/distro.html
uv run node bundle.mjs --deck

# Package prototype portal -> dist/distro.html
uv run node bundle.mjs --portal

# Package all prototypes + portal into dist/
uv run node bundle.mjs --all

# Custom output file
uv run node bundle.mjs --ui panorama -o ./dist/sherry-storybook.html

# Run packaging integrity check across all prototypes
uv run node bundle.mjs --check
```

Output files and `pages.csv` are saved directly to `dist/` (e.g. `dist/distro.html`) and can be distributed or opened directly via `file://` in any browser without needing a web server.

---

## Automated Verification

Run test suite via root runner:

```bash
# Run all tests
uv run npm test
# or
uv run node test.mjs

# Run a specific test
uv run node test.mjs snapping
uv run node test.mjs check
```
