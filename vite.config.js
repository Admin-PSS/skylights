import { defineConfig } from 'vite';
import fs from 'node:fs';

/** Generates dist/sw.js with the exact list of built files, so the installed app works offline. */
function serviceWorker() {
  return {
    name: 'skylights-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter((f) => f !== 'index.html');
      const source = fs
        .readFileSync('src/pwa/sw.template.js', 'utf8')
        .replace('__VERSION__', Date.now().toString(36))
        .replace('__ASSETS__', JSON.stringify(assets));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // relative paths: the built app works from any folder or sub-path (GitHub Pages, Netlify, a USB stick server…)
  base: './',
  plugins: [serviceWorker()],
  build: { chunkSizeWarningLimit: 900 },
});
