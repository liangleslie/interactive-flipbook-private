import { resolve, dirname } from 'path';
import { cpSync, writeFileSync, mkdirSync, readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { defineConfig } from 'vite';

function buildRedirectHtml(target) {
  return `<!DOCTYPE html><html><head><meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/><meta http-equiv="Pragma" content="no-cache"/><meta http-equiv="Expires" content="0"/><meta name="robots" content="noindex, nofollow, noarchive, nosnippet"><meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet"><meta http-equiv="refresh" content="0; url=${target}"><script>window.location.replace("${target}");</script></head><body><p><a href="${target}">Redirecting to Continuous Story Panorama...</a></p></body></html>\n`;
}

// ponytail: copy only story-board.json, lyrics.json, and referenced character art to avoid duplicating bundled backdrops/bgm
function copyReferencedResources(rootDir, distDir) {
  const resSrc = resolve(rootDir, 'resources');
  const resDist = resolve(distDir, 'resources');
  mkdirSync(resDist, { recursive: true });

  const mediaUrls = [];
  const sbSrc = resolve(resSrc, 'story-board.json');
  cpSync(sbSrc, resolve(resDist, 'story-board.json'));

  const lyricsSrc = resolve(resSrc, 'lyrics.json');
  if (existsSync(lyricsSrc)) {
    cpSync(lyricsSrc, resolve(resDist, 'lyrics.json'));
  }

  const sb = JSON.parse(readFileSync(sbSrc, 'utf-8'));
  const copied = new Set();
  for (const page of sb.pages || []) {
    for (const key of ['upperArt', 'lowerArt']) {
      const ref = page[key];
      if (!ref || !ref.startsWith('../resources/')) continue;
      const rel = ref.slice('../resources/'.length);
      if (copied.has(rel)) continue;
      copied.add(rel);
      const srcFile = resolve(resSrc, rel);
      const dstFile = resolve(resDist, rel);
      if (existsSync(srcFile)) {
        mkdirSync(dirname(dstFile), { recursive: true });
        cpSync(srcFile, dstFile);
        mediaUrls.push(`./resources/${rel}`);
      }
    }
  }
  return mediaUrls;
}

function generateServiceWorker(distDir, resourceMediaUrls) {
  const assetsDir = resolve(distDir, 'assets');
  const coreAssets = [];
  const mediaAssets = [...resourceMediaUrls];

  if (existsSync(assetsDir)) {
    for (const file of readdirSync(assetsDir).sort()) {
      const url = `./assets/${file}`;
      if (file.endsWith('.js') || file.endsWith('.css')) {
        coreAssets.push(url);
      } else {
        mediaAssets.push(url);
      }
    }
  }

  const coreUrls = [
    './sidescroll-panorama/index.html',
    './sidescroll-panorama/manifest.webmanifest',
    './sidescroll-panorama/icons/icon-180.png',
    './sidescroll-panorama/icons/icon-192.png',
    './sidescroll-panorama/icons/icon-512.png',
    './resources/story-board.json',
    './resources/lyrics.json',
    ...coreAssets,
  ];

  const hash = createHash('sha256');
  const htmlPath = resolve(distDir, 'sidescroll-panorama/index.html');
  if (existsSync(htmlPath)) hash.update(readFileSync(htmlPath));
  hash.update(readFileSync(resolve(distDir, 'resources/story-board.json')));
  for (const url of [...coreUrls, ...mediaAssets]) {
    const fp = resolve(distDir, url.slice(2));
    hash.update(url);
    if (existsSync(fp)) hash.update(String(statSync(fp).size));
  }
  const cacheName = `sherry-panorama-${hash.digest('hex').slice(0, 10)}`;

  const swSource = `// Auto-generated offline-first Service Worker for Continuous Story Panorama
const CACHE_NAME = ${JSON.stringify(cacheName)};
const FONT_CACHE_NAME = 'sherry-panorama-fonts-v1';
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Nunito:wght@400;600;800;900&family=Outfit:wght@600;800;900&display=swap';
const CORE_URLS = ${JSON.stringify(coreUrls, null, 2)};
const MEDIA_URLS = ${JSON.stringify(mediaAssets, null, 2)};
const ALL_URLS = [...CORE_URLS, ...MEDIA_URLS];

let warmPromise = null;

function resolveUrl(rel) {
  return new URL(rel, self.location.href).href;
}

async function broadcastProgress(cached, total, failed = 0) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const msg = { type: 'PRECACHE_PROGRESS', cached, total, failed, done: cached + failed >= total };
  for (const client of clients) client.postMessage(msg);
}

async function warmGoogleFonts() {
  try {
    const fontCache = await caches.open(FONT_CACHE_NAME);
    let cssRes = await fontCache.match(FONT_CSS_URL);
    if (!cssRes) {
      cssRes = await fetch(FONT_CSS_URL);
      if (cssRes.ok) await fontCache.put(FONT_CSS_URL, cssRes.clone());
    }
    if (cssRes && cssRes.ok) {
      const cssText = await cssRes.text();
      const urls = [...new Set([...cssText.matchAll(/url\\((https:\\/\\/fonts\\.gstatic\\.com[^)]+)\\)/g)].map((m) => m[1]))];
      await Promise.all(urls.map(async (u) => {
        if (await fontCache.match(u)) return;
        const res = await fetch(u);
        if (res.ok) await fontCache.put(u, res);
      }));
    }
  } catch {
    // Non-fatal: system fallback fonts render cleanly offline
  }
}

async function ensureAllMediaCached() {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    const cache = await caches.open(CACHE_NAME);
    const total = ALL_URLS.length;
    let cached = 0;
    let failed = 0;
    const missing = [];

    for (const rel of ALL_URLS) {
      const abs = resolveUrl(rel);
      const hit = await cache.match(abs);
      if (hit) cached++;
      else missing.push(abs);
    }
    await broadcastProgress(cached, total, failed);

    const queue = [...missing];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok && res.status === 200 && !res.redirected) {
            await cache.put(url, res);
            cached++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        await broadcastProgress(cached, total, failed);
      }
    });

    await Promise.all([...workers, warmGoogleFonts()]);
    const result = { cached, total, failed, done: failed === 0 && cached === total };
    if (failed > 0) warmPromise = null;
    return result;
  })();
  return warmPromise;
}

async function getCacheStatus() {
  const cache = await caches.open(CACHE_NAME);
  let cached = 0;
  for (const rel of ALL_URLS) {
    if (await cache.match(resolveUrl(rel))) cached++;
  }
  return { cached, total: ALL_URLS.length, done: cached === ALL_URLS.length };
}

async function handleRangeRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  let fullRes = await cache.match(request.url, { ignoreSearch: true });
  if (!fullRes) {
    const netRes = await fetch(request.url);
    if (netRes.ok && netRes.status === 200) {
      await cache.put(request.url, netRes.clone());
      fullRes = netRes;
    } else {
      return fetch(request);
    }
  }

  const buf = await fullRes.arrayBuffer();
  const rangeHeader = request.headers.get('range') || '';
  const match = /bytes=(\\d*)-(\\d*)/.exec(rangeHeader);
  if (!match) {
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': fullRes.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Length': String(buf.byteLength),
        'Accept-Ranges': 'bytes',
      },
    });
  }

  const total = buf.byteLength;
  let start = match[1] === '' ? total - Number(match[2]) : Number(match[1]);
  let end = match[1] === '' || match[2] === '' ? total - 1 : Number(match[2]);
  start = Math.max(0, start);
  end = Math.min(total - 1, end);

  if (start >= total || start > end) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': \`bytes */\${total}\` },
    });
  }

  const sliced = buf.slice(start, end + 1);
  return new Response(sliced, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': fullRes.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': \`bytes \${start}-\${end}/\${total}\`,
      'Content-Length': String(sliced.byteLength),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE_URLS.map(async (rel) => {
      const abs = resolveUrl(rel);
      const res = await fetch(abs, { cache: 'no-cache' });
      if (res.ok && res.status === 200 && !res.redirected) {
        await cache.put(abs, res);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE_NAME && k !== FONT_CACHE_NAME)
        .map((k) => caches.delete(k)),
    );
    await self.clients.claim();
    // Kick off background warmup without blocking activation
    ensureAllMediaCached();
  })());
});

self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'PRECACHE_ALL') {
    const p = ensureAllMediaCached().then((res) => {
      event.ports?.[0]?.postMessage(res);
    });
    event.waitUntil(p);
  } else if (type === 'GET_CACHE_STATUS') {
    event.waitUntil(getCacheStatus().then((res) => {
      event.ports?.[0]?.postMessage(res);
    }));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith((async () => {
      const fontCache = await caches.open(FONT_CACHE_NAME);
      const cached = await fontCache.match(request);
      if (cached) return cached;
      try {
        const net = await fetch(request);
        if (net.ok) await fontCache.put(request, net.clone());
        return net;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.headers.has('range')) {
    event.respondWith(handleRangeRequest(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const entry = await cache.match(resolveUrl('./sidescroll-panorama/index.html'));
      if (entry) return entry;
      return fetch(request);
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const net = await fetch(request);
    if (net.ok && net.status === 200 && !net.redirected) {
      await cache.put(request, net.clone());
    }
    return net;
  })());
});
`;

  writeFileSync(resolve(distDir, 'sw.js'), swSource, 'utf-8');
}

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.mp3', '**/*.wav', '**/*.ogg'],
  build: {
    rollupOptions: {
      input: {
        sidescrollPanorama: resolve(import.meta.dirname, 'sidescroll-panorama/index.html'),
      },
    },
  },
  plugins: [
    // ponytail: redirect root/portal requests to /sidescroll-panorama/, copy referenced resources, and emit offline SW
    {
      name: 'storybook-panorama-and-resources',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html' || req.url.startsWith('/portal')) {
            res.writeHead(302, { Location: '/sidescroll-panorama/' });
            res.end();
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html' || req.url.startsWith('/portal')) {
            res.writeHead(302, { Location: '/sidescroll-panorama/' });
            res.end();
            return;
          }
          next();
        });
      },
      closeBundle() {
        const distDir = resolve(import.meta.dirname, 'dist');
        const mediaResourceUrls = copyReferencedResources(import.meta.dirname, distDir);
        writeFileSync(resolve(distDir, 'index.html'), buildRedirectHtml('./sidescroll-panorama/'));
        mkdirSync(resolve(distDir, 'portal'), { recursive: true });
        writeFileSync(resolve(distDir, 'portal/index.html'), buildRedirectHtml('../sidescroll-panorama/'));
        generateServiceWorker(distDir, mediaResourceUrls);
      },
    },
  ],
});

