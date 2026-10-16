import { resolve } from 'path';
import { cpSync } from 'fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.mp3', '**/*.wav', '**/*.ogg'],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        pageFlip: resolve(import.meta.dirname, 'page-flip/index.html'),
        sidescrollCards: resolve(import.meta.dirname, 'sidescroll-cards/index.html'),
        sidescrollPanorama: resolve(import.meta.dirname, 'sidescroll-panorama/index.html'),
        verticalStory: resolve(import.meta.dirname, 'vertical-story/index.html'),
        storyCards: resolve(import.meta.dirname, 'story-cards/index.html'),
      },
    },
  },
  plugins: [
    // ponytail: copy static resources/ directly into dist/resources/ so dynamic runtime URLs resolve
    {
      name: 'copy-resources',
      closeBundle() {
        cpSync(resolve(import.meta.dirname, 'resources'), resolve(import.meta.dirname, 'dist/resources'), { recursive: true });
      },
    },
  ],
});

