import { resolve } from 'path';
import { cpSync } from 'fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.mp3', '**/*.wav', '**/*.ogg'],
  build: {
    rollupOptions: {
      input: {
        portal: resolve(import.meta.dirname, 'portal/index.html'),
        pageFlip: resolve(import.meta.dirname, 'page-flip/index.html'),
        sidescrollCards: resolve(import.meta.dirname, 'sidescroll-cards/index.html'),
        sidescrollPanorama: resolve(import.meta.dirname, 'sidescroll-panorama/index.html'),
        verticalStory: resolve(import.meta.dirname, 'vertical-story/index.html'),
        storyCards: resolve(import.meta.dirname, 'story-cards/index.html'),
      },
    },
  },
  plugins: [
    // ponytail: redirect root requests to /portal/ and copy static resources/ on build
    {
      name: 'storybook-portal-and-resources',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            res.writeHead(302, { Location: '/portal/' });
            res.end();
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            res.writeHead(302, { Location: '/portal/' });
            res.end();
            return;
          }
          next();
        });
      },
      closeBundle() {
        cpSync(resolve(import.meta.dirname, 'resources'), resolve(import.meta.dirname, 'dist/resources'), { recursive: true });
      },
    },
  ],
});

