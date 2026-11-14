import { resolve } from 'path';
import { cpSync, writeFileSync } from 'fs';
import { defineConfig } from 'vite';

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
    // ponytail: redirect root requests to /sidescroll-panorama/ and copy static resources/ on build
    {
      name: 'storybook-panorama-and-resources',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            res.writeHead(302, { Location: '/sidescroll-panorama/' });
            res.end();
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            res.writeHead(302, { Location: '/sidescroll-panorama/' });
            res.end();
            return;
          }
          next();
        });
      },
      closeBundle() {
        cpSync(resolve(import.meta.dirname, 'resources'), resolve(import.meta.dirname, 'dist/resources'), { recursive: true });
        writeFileSync(
          resolve(import.meta.dirname, 'dist/index.html'),
          '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=./sidescroll-panorama/"><script>window.location.replace("./sidescroll-panorama/");</script></head><body><p><a href="./sidescroll-panorama/">Redirecting to Continuous Story Panorama...</a></p></body></html>\n',
        );
      },
    },
  ],
});

