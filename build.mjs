// ============================================================
// Copilo Live Shop V2 — Extension Bundler
// Constrói content script como IIFE auto-contido, background worker
// e o controlador nativo do MAIN WORLD
// ============================================================

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function bundleExtension() {
  console.log('🚀 Iniciando build do Copilo Live Shop V2...');

  const distDir = resolve(__dirname, 'dist');
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // 1. Build Background Service Worker (ES Module)
  console.log('📦 [1/3] Compilando Background Service Worker...');
  await build({
    configFile: false,
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
    build: {
      outDir: distDir,
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      target: 'chrome110',
      lib: {
        entry: resolve(__dirname, 'src/background/service-worker.ts'),
        name: 'BackgroundServiceWorker',
        formats: ['es'],
        fileName: () => 'background.js',
      },
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    },
  });

  // 2. Build Content Script (IIFE - Auto-contido sem imports externos)
  console.log('📦 [2/3] Compilando Content Script (IIFE)...');
  await build({
    configFile: false,
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
    build: {
      outDir: distDir,
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      target: 'chrome110',
      lib: {
        entry: resolve(__dirname, 'src/content/bootstrap.ts'),
        name: 'CopiloLiveShopBootstrap',
        formats: ['iife'],
        fileName: () => 'content/bootstrap.js',
      },
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    },
  });

  // 3. Build Main World Controller (IIFE - Executa no contexto JS da página)
  console.log('📦 [3/3] Compilando Main World Controller (IIFE)...');
  const mainWorldDist = resolve(distDir, 'main-world');
  mkdirSync(mainWorldDist, { recursive: true });

  await build({
    configFile: false,
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
    build: {
      outDir: mainWorldDist,
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      target: 'chrome110',
      lib: {
        entry: resolve(__dirname, 'src/main-world/live-remote-controller.ts'),
        name: 'CopiloLiveRemoteController',
        formats: ['iife'],
        fileName: () => 'controller.js',
      },
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    },
  });

  // 4. Copiar manifest.json e ícones
  console.log('📋 Copiando manifest.json e assets...');
  copyFileSync(resolve(__dirname, 'manifest.json'), resolve(distDir, 'manifest.json'));

  const iconsDist = resolve(distDir, 'icons');
  mkdirSync(iconsDist, { recursive: true });
  ['icon16.png', 'icon48.png', 'icon128.png'].forEach(icon => {
    const src = resolve(__dirname, 'icons', icon);
    if (existsSync(src)) {
      copyFileSync(src, resolve(iconsDist, icon));
    }
  });

  console.log('✅ Build concluído com sucesso em dist/!');
}

bundleExtension().catch((err) => {
  console.error('❌ Erro no build da extensão:', err);
  process.exit(1);
});
