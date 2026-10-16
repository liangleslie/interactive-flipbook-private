#!/usr/bin/env node
// Bundle dist/ into a single self-contained HTML file for distro distribution.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, basename, extname, join } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

const DIST = resolve('./dist');
const DEFAULT_OUT = resolve(DIST, 'distro.html');

const UI_CONFIGS = {
  'sidescroll-panorama': {
    name: 'Continuous Panorama',
    html: 'sidescroll-panorama/index.html',
    aliases: ['panorama', 'continuous', 'sidescroll-panorama', '1'],
  },
  'page-flip': {
    name: 'Responsive Flipbook',
    html: 'page-flip/index.html',
    aliases: ['flip', 'page-flip', 'flipbook', '2'],
  },
  'sidescroll-cards': {
    name: 'Sidescroll Card Strip',
    html: 'sidescroll-cards/index.html',
    aliases: ['cards', 'sidescroll-cards', 'strip', '3'],
  },
  'vertical-story': {
    name: 'Vertical Storyboard',
    html: 'vertical-story/index.html',
    aliases: ['vertical', 'vertical-story', 'storyboard', '4'],
  },
  'story-cards': {
    name: 'Story Cards Deck',
    html: 'story-cards/index.html',
    aliases: ['deck', 'story-cards', '5'],
  },
  'main': {
    name: 'Prototype Hub / Menu',
    html: 'index.html',
    aliases: ['main', 'hub', 'menu', 'index', '6'],
  },
};

const MIME_MAP = {
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

function findFiles(dir, list = []) {
  if (!existsSync(dir)) return list;
  for (const item of readdirSync(dir)) {
    const full = join(dir, item);
    if (statSync(full).isDirectory()) findFiles(full, list);
    else list.push(full);
  }
  return list;
}

// ponytail: build unified asset map of all images & audio in dist/ and resources/ into base64 data URIs
function buildImageMap() {
  const imageMap = {};
  const searchDirs = [DIST, resolve('./resources')];
  for (const dir of searchDirs) {
    for (const file of findFiles(dir)) {
      const ext = extname(file).toLowerCase();
      if (MIME_MAP[ext]) {
        const b64 = readFileSync(file).toString('base64');
        const dataUri = `data:${MIME_MAP[ext]};base64,${b64}`;
        const name = basename(file);
        imageMap[name] = dataUri;
        // Map unhashed name if Vite appended chunk hash (e.g. panorama_backdrop-DcKJwTAE.jpg -> panorama_backdrop.jpg)
        const unhashed = name.replace(/-[A-Za-z0-9_-]+(\.[a-z]+)$/, '$1');
        imageMap[unhashed] = dataUri;
      }
    }
  }
  return imageMap;
}

// ponytail: replace CSS url() with valid data URI, stripping any relative ./ or ../ prefix
function inlineImagesInCss(css, imageMap) {
  return css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, urlPath) => {
    const cleanPath = urlPath.trim().replace(/^['"]|['"]$/g, '');
    if (cleanPath.startsWith('data:') || cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      return match;
    }
    const base = basename(cleanPath);
    const unhashed = base.replace(/-[A-Za-z0-9_-]+(\.[a-z]+)$/, '$1');
    const uri = imageMap[cleanPath] || imageMap[base] || imageMap[unhashed];
    if (uri) {
      return `url("${uri}")`;
    }
    return match;
  });
}

function inlineImagesInText(text, imageMap) {
  // Replace longer keys first to avoid partial replacements
  const sortedKeys = Object.keys(imageMap).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace any quoted path ending with key: e.g. "path/to/key" -> "dataUri"
    const quotedPathRegex = new RegExp(`(['"])(?:[\\w.-]+\\/)*${escaped}\\1`, 'g');
    text = text.replace(quotedPathRegex, `$1${imageMap[key]}$1`);
    // Fallback: replace any remaining bare occurrences of key
    text = text.replaceAll(key, imageMap[key]);
  }
  // Safety cleanup: strip any accidental path prefix before data: URIs (e.g. ../assets/data: -> data:)
  text = text.replace(/(['"(])(?:(?:\.\.|\.)\/|[a-zA-Z0-9_\-.]+\/)+(data:[^'")\s]+)/g, '$1$2');
  return text;
}

function prepareInlinedStoryBoard(imageMap) {
  const sbPath = resolve(DIST, 'resources/story-board.json');
  if (!existsSync(sbPath)) return null;
  const raw = JSON.parse(readFileSync(sbPath, 'utf-8'));
  function walk(val) {
    if (typeof val === 'string') {
      const base = basename(val);
      const unhashed = base.replace(/-[A-Za-z0-9_-]+(\.[a-z]+)$/, '$1');
      return imageMap[val] || imageMap[base] || imageMap[unhashed] || val;
    }
    if (Array.isArray(val)) return val.map(walk);
    if (val && typeof val === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(val)) out[k] = walk(v);
      return out;
    }
    return val;
  }
  return walk(raw);
}

function bundleUI(uiKey, { isAll = false, imageMap, storyBoard } = {}) {
  const config = UI_CONFIGS[uiKey];
  if (!config) throw new Error(`Unknown UI key: "${uiKey}"`);

  const htmlPath = resolve(DIST, config.html);
  if (!existsSync(htmlPath)) {
    throw new Error(`Target file missing: ${htmlPath}. Ensure project is built with "npm run build".`);
  }

  let html = readFileSync(htmlPath, 'utf-8');

  // Strip modulepreload and image preload links (redundant in self-contained distro)
  html = html.replace(/<link[^>]*rel=["'](?:modulepreload|preload)["'][^>]*>\s*/gi, '');

  // Inline CSS stylesheets
  const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>|<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  html = html.replace(linkRegex, (match, h1, h2) => {
    const href = h1 || h2;
    if (href.startsWith('http://') || href.startsWith('https://')) return match;
    const cssPath = resolve(dirname(htmlPath), href);
    if (existsSync(cssPath)) {
      let cssContent = readFileSync(cssPath, 'utf-8');
      cssContent = inlineImagesInCss(cssContent, imageMap);
      cssContent = inlineImagesInText(cssContent, imageMap);
      return `<style>\n${cssContent}\n</style>`;
    }
    return match;
  });

  // Inline JavaScript modules
  const scriptRegex = /<script\s+([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi;
  html = html.replace(scriptRegex, (match, before, src, after) => {
    if (src.startsWith('http://') || src.startsWith('https://')) return match;
    const jsPath = resolve(dirname(htmlPath), src);
    if (existsSync(jsPath)) {
      let jsContent = readFileSync(jsPath, 'utf-8');
      // ponytail: inlined script cannot import external chunk on file://; embed storyboard JSON directly
      if (storyBoard) {
        jsContent = jsContent.replace(/import\s*\{\s*t\s*as\s*([a-zA-Z0-9_$]+)\s*\}\s*from\s*["'][^"']*story-board[^"']*["'];?/g, (_, varName) => {
          return `const ${varName} = ${JSON.stringify(storyBoard)};`;
        });
      }
      jsContent = inlineImagesInText(jsContent, imageMap);
      return `<script type="module">\n${jsContent}\n</script>`;
    }
    return match;
  });

  // Inline any remaining image references in HTML
  html = inlineImagesInText(html, imageMap);

  // Handle navigation links in distro output
  if (isAll) {
    html = html.replace(/<a[^>]*\bback-link\b[^>]*>[\s\S]*?<\/a>/gi, (match) => {
      return match.replace(/href=["']\.\.\/?["']/, 'href="./distro.html"');
    });
    if (uiKey === 'main') {
      for (const [key] of Object.entries(UI_CONFIGS)) {
        if (key === 'main') continue;
        html = html.replaceAll(`./${key}/`, `./distro-${key}.html`);
      }
    }
  } else if (uiKey !== 'main') {
    // Standalone single UI distro: remove back-link badge completely
    html = html.replace(/<a[^>]*\bback-link\b[^>]*>[\s\S]*?<\/a>\s*/gi, '');
  }

  return html;
}

function resolveUI(input) {
  if (!input) return null;
  const lower = input.toLowerCase().trim().replace(/^--?/, '');
  if (lower === 'all' || lower === '7') return 'all';
  for (const [key, conf] of Object.entries(UI_CONFIGS)) {
    if (key === lower || conf.aliases.includes(lower)) {
      return key;
    }
  }
  return null;
}

function printUsage() {
  console.log(`
Usage: node bundle.mjs [options] [ui]

Options:
  --ui, -u <name>     Choose UI to package:
                        1) sidescroll-panorama (aliases: panorama, continuous) [default]
                        2) page-flip           (aliases: flip, flipbook)
                        3) sidescroll-cards    (aliases: cards, strip)
                        4) vertical-story      (aliases: vertical, storyboard)
                        5) story-cards         (aliases: deck)
                        6) main                (aliases: hub, menu)
                        7) all                 (packages all UIs)
  --out, -o <file>    Output destination file (default: ./dist/distro.html)
  --build, -b         Run "npm run build" before bundling
  --check, -c         Run integrity test across all UIs
  --help, -h          Show this help message

Short switches:
  --panorama          Shortcut for --ui sidescroll-panorama
  --flip              Shortcut for --ui page-flip
  --cards             Shortcut for --ui sidescroll-cards
  --vertical          Shortcut for --ui vertical-story
  --deck              Shortcut for --ui story-cards
  --all               Shortcut for --ui all

Examples:
  node bundle.mjs --ui panorama
  node bundle.mjs --flip -o ./distro-flip.html
  node bundle.mjs --all
  node bundle.mjs
`);
}

async function promptUserChoice() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\nSelect UI to package for distro:');
  const entries = Object.entries(UI_CONFIGS);
  entries.forEach(([key, conf], idx) => {
    console.log(`  ${idx + 1}) ${key.padEnd(21)} (${conf.name})${idx === 0 ? ' [default]' : ''}`);
  });
  console.log(`  7) all                   (Package all UIs)`);

  return new Promise((res) => {
    rl.question('\nEnter choice [1-7, default 1]: ', (answer) => {
      rl.close();
      const choice = answer.trim() || '1';
      res(resolveUI(choice) || 'sidescroll-panorama');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Parse arguments
  let uiArg = null;
  let outArg = null;
  let forceBuild = false;
  let runCheck = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--build' || a === '-b') {
      forceBuild = true;
    } else if (a === '--check' || a === '-c') {
      runCheck = true;
    } else if (a === '--ui' || a === '-u') {
      uiArg = args[++i];
    } else if (a.startsWith('--ui=')) {
      uiArg = a.slice(5);
    } else if (a === '--out' || a === '-o') {
      outArg = args[++i];
    } else if (a.startsWith('--out=')) {
      outArg = a.slice(6);
    } else if (a === '--all') {
      uiArg = 'all';
    } else if (a.startsWith('--') && resolveUI(a)) {
      uiArg = resolveUI(a);
    } else if (!uiArg && !a.startsWith('-')) {
      uiArg = a;
    }
  }

  // Auto-build if dist is missing or requested
  if (!existsSync(DIST) || forceBuild) {
    console.log('📦 Building project via "npm run build"...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  if (runCheck) {
    console.log('🧪 Running packaging integrity check across all UIs...');
    const imageMap = buildImageMap();
    const storyBoard = prepareInlinedStoryBoard(imageMap);
    for (const key of Object.keys(UI_CONFIGS)) {
      const bundled = bundleUI(key, { isAll: true, imageMap, storyBoard });
      const sizeMB = (Buffer.byteLength(bundled, 'utf-8') / 1024 / 1024).toFixed(2);
      if (bundled.includes('src="../') || bundled.includes('href="../assets/')) {
        throw new Error(`Integrity check failed: Uninlined assets found in UI ${key}`);
      }
      console.log(`  ✓ ${key.padEnd(21)}: ${sizeMB} MB`);
    }
    console.log('✅ Integrity check passed for all UIs.');
    return;
  }

  // Resolve UI choice
  let selectedUI = resolveUI(uiArg);
  if (!selectedUI) {
    if (process.stdin.isTTY) {
      selectedUI = await promptUserChoice();
    } else {
      selectedUI = 'sidescroll-panorama';
    }
  }

  console.log(`🔧 Packaging UI: ${selectedUI === 'all' ? 'All Prototypes' : selectedUI}...`);
  const imageMap = buildImageMap();
  const storyBoard = prepareInlinedStoryBoard(imageMap);

  if (selectedUI === 'all') {
    // 1. Package individual UIs
    for (const key of Object.keys(UI_CONFIGS)) {
      if (key === 'main') continue;
      const html = bundleUI(key, { isAll: true, imageMap, storyBoard });
      const outFile = resolve(DIST, `distro-${key}.html`);
      writeFileSync(outFile, html, 'utf-8');
      const mb = (Buffer.byteLength(html, 'utf-8') / 1024 / 1024).toFixed(2);
      console.log(`  ✓ Created ${outFile} (${mb} MB) [${UI_CONFIGS[key].name}]`);
    }

    // 2. Package Hub as distro.html
    const hubHtml = bundleUI('main', { isAll: true, imageMap, storyBoard });
    const hubOut = outArg ? resolve(outArg) : DEFAULT_OUT;
    writeFileSync(hubOut, hubHtml, 'utf-8');
    const hubMB = (Buffer.byteLength(hubHtml, 'utf-8') / 1024 / 1024).toFixed(2);
    console.log(`✅ Created Hub: ${hubOut} (${hubMB} MB)`);
  } else {
    const outFile = outArg ? resolve(outArg) : DEFAULT_OUT;
    const html = bundleUI(selectedUI, { isAll: false, imageMap, storyBoard });
    writeFileSync(outFile, html, 'utf-8');
    const mb = (Buffer.byteLength(html, 'utf-8') / 1024 / 1024).toFixed(2);
    console.log(`✅ Created ${outFile} (${mb} MB) [UI: ${selectedUI} — ${UI_CONFIGS[selectedUI].name}]`);
    if (selectedUI !== 'main') {
      const aliasOut = resolve(DIST, `distro-${selectedUI}.html`);
      if (outFile !== aliasOut) {
        writeFileSync(aliasOut, html, 'utf-8');
        console.log(`  ✓ Also updated ${aliasOut}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(`❌ Packaging error: ${err.message}`);
  process.exit(1);
});
