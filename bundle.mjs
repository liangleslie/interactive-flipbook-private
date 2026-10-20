#!/usr/bin/env node
// Bundle dist/ into a single self-contained HTML file for distro distribution.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename, extname, join } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { createHash } from 'crypto';

const DIST = resolve('./dist');
const DEFAULT_OUT = resolve(DIST, 'distro.html');
const CACHE_DIR = resolve('./node_modules/.cache/distro-media');
const mediaMemoryCache = new Map();

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

function detectTools() {
  let magick = null;
  try {
    execSync('magick -version', { stdio: 'ignore' });
    magick = 'magick';
  } catch {
    try {
      execSync('convert -version', { stdio: 'ignore' });
      magick = 'convert';
    } catch {}
  }
  let ffmpeg = false;
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    ffmpeg = true;
  } catch {}
  return { magick, ffmpeg };
}

// ponytail: down-res and compress raster image/audio using ImageMagick/ffmpeg with content-hashed disk cache
function compressAndEncodeMedia(filePath, { maxRes, quality, audioBitrate, format, noCompress, tools }) {
  const ext = extname(filePath).toLowerCase();
  if (!MIME_MAP[ext]) return null;

  const rawBuffer = readFileSync(filePath);
  if (noCompress) {
    return {
      dataUri: `data:${MIME_MAP[ext]};base64,${rawBuffer.toString('base64')}`,
      origSize: rawBuffer.length,
      newSize: rawBuffer.length,
    };
  }

  const hash = createHash('sha256').update(rawBuffer).digest('hex').slice(0, 16);
  const cacheKey = `${hash}_res${maxRes}_q${quality}_f${format}_a${audioBitrate}`;
  if (mediaMemoryCache.has(cacheKey)) {
    return mediaMemoryCache.get(cacheKey);
  }

  mkdirSync(CACHE_DIR, { recursive: true });

  const isRasterImg = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
  const isAudio = ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);

  let targetMime = MIME_MAP[ext];
  let compressedBuffer = null;

  if (isRasterImg && (tools.magick || tools.ffmpeg)) {
    const useWebp = format === 'webp';
    const targetExt = useWebp ? '.webp' : (ext === '.jpeg' ? '.jpg' : ext);
    targetMime = useWebp ? 'image/webp' : (ext === '.jpeg' ? 'image/jpeg' : MIME_MAP[ext]);
    const cacheFile = join(CACHE_DIR, `${hash}_${maxRes}_${quality}${targetExt}`);

    if (existsSync(cacheFile)) {
      compressedBuffer = readFileSync(cacheFile);
    } else {
      try {
        if (tools.magick) {
          const resizeArg = `-resize "${maxRes}x${maxRes}>"`;
          if (useWebp) {
            execSync(`${tools.magick} "${filePath}" ${resizeArg} -quality ${quality} -strip webp:"${cacheFile}"`, { stdio: 'pipe' });
          } else if (targetExt === '.png') {
            execSync(`${tools.magick} "${filePath}" ${resizeArg} -strip png:"${cacheFile}"`, { stdio: 'pipe' });
          } else {
            execSync(`${tools.magick} "${filePath}" ${resizeArg} -quality ${quality} -strip "${cacheFile}"`, { stdio: 'pipe' });
          }
        } else if (tools.ffmpeg) {
          const vfArg = `-vf "scale='min(${maxRes},iw)':'min(${maxRes},ih)':force_original_aspect_ratio=decrease"`;
          if (useWebp) {
            execSync(`ffmpeg -y -i "${filePath}" ${vfArg} -quality ${quality} "${cacheFile}"`, { stdio: 'pipe' });
          } else if (targetExt === '.png') {
            execSync(`ffmpeg -y -i "${filePath}" ${vfArg} "${cacheFile}"`, { stdio: 'pipe' });
          } else {
            execSync(`ffmpeg -y -i "${filePath}" ${vfArg} -q:v 3 "${cacheFile}"`, { stdio: 'pipe' });
          }
        }
        if (existsSync(cacheFile)) {
          compressedBuffer = readFileSync(cacheFile);
        }
      } catch (err) {
        compressedBuffer = rawBuffer;
        targetMime = MIME_MAP[ext];
      }
    }
  } else if (isAudio && tools.ffmpeg) {
    targetMime = 'audio/mpeg';
    const cacheFile = join(CACHE_DIR, `${hash}_${audioBitrate}.mp3`);
    if (existsSync(cacheFile)) {
      compressedBuffer = readFileSync(cacheFile);
    } else {
      try {
        execSync(`ffmpeg -y -i "${filePath}" -b:a ${audioBitrate} "${cacheFile}"`, { stdio: 'pipe' });
        if (existsSync(cacheFile)) {
          compressedBuffer = readFileSync(cacheFile);
        }
      } catch {
        compressedBuffer = rawBuffer;
        targetMime = MIME_MAP[ext];
      }
    }
  }

  if (!compressedBuffer) {
    compressedBuffer = rawBuffer;
    targetMime = MIME_MAP[ext];
  }

  if (compressedBuffer.length > rawBuffer.length && targetMime === MIME_MAP[ext]) {
    compressedBuffer = rawBuffer;
  }

  const dataUri = `data:${targetMime};base64,${compressedBuffer.toString('base64')}`;
  const res = {
    dataUri,
    origSize: rawBuffer.length,
    newSize: compressedBuffer.length,
  };
  mediaMemoryCache.set(cacheKey, res);
  return res;
}

// Vite chunk hashes in dist/assets/ are exactly 8 alphanumeric characters: name-[hash8].ext
function getUnhashedName(filename) {
  const match = filename.match(/^(.+)-([A-Za-z0-9_-]{8})(\.[a-zA-Z0-9]+)$/);
  return match ? `${match[1]}${match[3]}` : null;
}

function getAssetUri(keyOrPath, imageMap) {
  if (!keyOrPath || typeof keyOrPath !== 'string') return null;
  if (imageMap[keyOrPath]) return imageMap[keyOrPath];
  const base = basename(keyOrPath);
  if (imageMap[base]) return imageMap[base];
  const unhashed = getUnhashedName(base);
  if (unhashed && imageMap[unhashed]) return imageMap[unhashed];
  return null;
}

// ponytail: build unified asset map of all images & audio with down-res & compression into base64 data URIs
function buildImageMap(options = {}) {
  const tools = detectTools();
  const imageMap = {};
  const searchDirs = [resolve('./resources'), DIST];
  const seenFiles = new Set();
  let totalOrigBytes = 0;
  let totalCompBytes = 0;
  let fileCount = 0;

  for (const dir of searchDirs) {
    for (const file of findFiles(dir)) {
      const ext = extname(file).toLowerCase();
      if (!MIME_MAP[ext]) continue;

      const name = basename(file);
      const unhashed = getUnhashedName(name);

      // If already mapped exact name, skip
      if (imageMap[name]) continue;

      // If this is a hashed asset from dist/assets/ and we already processed the unhashed original, reuse it
      if (unhashed && imageMap[unhashed]) {
        imageMap[name] = imageMap[unhashed];
        continue;
      }

      const comp = compressAndEncodeMedia(file, { ...options, tools });
      if (!comp) continue;

      imageMap[name] = comp.dataUri;
      if (unhashed) {
        imageMap[unhashed] = comp.dataUri;
      }

      if (!seenFiles.has(name)) {
        seenFiles.add(name);
        totalOrigBytes += comp.origSize;
        totalCompBytes += comp.newSize;
        fileCount++;
      }
    }
  }

  if (fileCount > 0 && !options.noCompress) {
    const origMB = (totalOrigBytes / 1024 / 1024).toFixed(2);
    const compMB = (totalCompBytes / 1024 / 1024).toFixed(2);
    const savedPct = totalOrigBytes > 0 ? (((totalOrigBytes - totalCompBytes) / totalOrigBytes) * 100).toFixed(1) : 0;
    console.log(`  🗜️  Media compressed: ${fileCount} files, ${origMB} MB → ${compMB} MB (${savedPct}% reduction)`);
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
    const uri = getAssetUri(cleanPath, imageMap);
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
      const uri = getAssetUri(val, imageMap);
      return uri || val;
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

// ponytail: deduplicate repeated embedded media (e.g. backgroundArt, repeated character art) into reusable variables
function serializeStoryBoardWithMediaVars(storyBoard, varName) {
  const counts = new Map();
  function countStrings(val) {
    if (typeof val === 'string' && val.startsWith('data:')) {
      counts.set(val, (counts.get(val) || 0) + 1);
    } else if (Array.isArray(val)) {
      val.forEach(countStrings);
    } else if (val && typeof val === 'object') {
      Object.values(val).forEach(countStrings);
    }
  }
  countStrings(storyBoard);

  const reused = new Map();
  let varIdx = 0;
  for (const [str, count] of counts.entries()) {
    if (count > 1) {
      reused.set(str, `__media_${varIdx++}`);
    }
  }

  const varDecls = [];
  for (const [str, varId] of reused.entries()) {
    varDecls.push(`const ${varId} = ${JSON.stringify(str)};`);
  }

  function serialize(val) {
    if (typeof val === 'string') {
      if (reused.has(val)) {
        return reused.get(val);
      }
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) {
      return `[${val.map(serialize).join(',')}]`;
    }
    if (val && typeof val === 'object') {
      const props = Object.entries(val).map(([k, v]) => {
        const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
        return `${key}:${serialize(v)}`;
      });
      return `{${props.join(',')}}`;
    }
    return JSON.stringify(val);
  }

  const objCode = serialize(storyBoard);
  const prefix = varDecls.length > 0 ? `${varDecls.join('\n')}\n` : '';
  return `${prefix}const ${varName} = ${objCode};`;
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
      jsContent = inlineImagesInText(jsContent, imageMap);
      // ponytail: inlined script cannot import external chunk on file://; embed storyboard with deduplicated media variables
      if (storyBoard) {
        jsContent = jsContent.replace(/import\s*\{\s*t\s*as\s*([a-zA-Z0-9_$]+)\s*\}\s*from\s*["'][^"']*story-board[^"']*["'];?/g, (_, varName) => {
          return serializeStoryBoardWithMediaVars(storyBoard, varName);
        });
      }
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
  --ui, -u <name>       Choose UI to package:
                          1) sidescroll-panorama (aliases: panorama, continuous) [default]
                          2) page-flip           (aliases: flip, flipbook)
                          3) sidescroll-cards    (aliases: cards, strip)
                          4) vertical-story      (aliases: vertical, storyboard)
                          5) story-cards         (aliases: deck)
                          6) main                (aliases: hub, menu)
                          7) all                 (packages all UIs)
  --out, -o <file>      Output destination file (default: ./dist/distro.html)
  --max-res <px>        Max image dimension constraint in px (default: 1600)
  --quality, -q <1-100> Image compression quality (default: 82)
  --audio-bitrate <br>  Audio bitrate for ffmpeg (default: 96k)
  --format <type>       Image format: webp (default) or orig
  --no-compress         Skip media downsampling and compression
  --no-build            Skip running "npm run build" before bundling
  --build, -b           Force clean build
  --check, -c           Run integrity test across all UIs
  --help, -h            Show this help message

Short switches:
  --panorama            Shortcut for --ui sidescroll-panorama
  --flip                Shortcut for --ui page-flip
  --cards               Shortcut for --ui sidescroll-cards
  --vertical            Shortcut for --ui vertical-story
  --deck                Shortcut for --ui story-cards
  --all                 Shortcut for --ui all

Examples:
  node bundle.mjs --ui panorama
  node bundle.mjs --flip -o ./distro-flip.html
  node bundle.mjs --max-res 1200 -q 75
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
  let skipBuild = false;
  let runCheck = false;
  let maxRes = 1600;
  let quality = 82;
  let audioBitrate = '96k';
  let format = 'webp';
  let noCompress = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--no-build') {
      skipBuild = true;
    } else if (a === '--build' || a === '-b') {
      skipBuild = false;
    } else if (a === '--check' || a === '-c') {
      runCheck = true;
    } else if (a === '--no-compress') {
      noCompress = true;
    } else if (a === '--max-res' || a === '--res') {
      maxRes = parseInt(args[++i], 10) || 1600;
    } else if (a.startsWith('--max-res=') || a.startsWith('--res=')) {
      maxRes = parseInt(a.split('=')[1], 10) || 1600;
    } else if (a === '--quality' || a === '-q') {
      quality = parseInt(args[++i], 10) || 82;
    } else if (a.startsWith('--quality=') || a.startsWith('-q=')) {
      quality = parseInt(a.split('=')[1], 10) || 82;
    } else if (a === '--audio-bitrate' || a === '--audio') {
      audioBitrate = args[++i];
    } else if (a.startsWith('--audio-bitrate=') || a.startsWith('--audio=')) {
      audioBitrate = a.split('=')[1];
    } else if (a === '--format') {
      format = args[++i];
    } else if (a.startsWith('--format=')) {
      format = a.split('=')[1];
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

  const compressOptions = { maxRes, quality, audioBitrate, format, noCompress };

  // Always build to ensure latest CSS/JS fixes unless explicitly skipped
  if (!skipBuild || !existsSync(DIST)) {
    console.log('📦 Building project via "npm run build"...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  if (runCheck) {
    console.log('🧪 Running packaging integrity check across all UIs...');
    const imageMap = buildImageMap(compressOptions);
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
  const imageMap = buildImageMap(compressOptions);
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
