import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';

// Plugin manual para copiar manifest e ícones para dist/
function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    closeBundle() {
      // Copiar manifest.json
      copyFileSync('manifest.json', 'dist/manifest.json');

      // Copiar ícones
      const iconsDir = 'dist/icons';
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
      ['icon16.png', 'icon48.png', 'icon128.png'].forEach(icon => {
        const src = `icons/${icon}`;
        if (existsSync(src)) copyFileSync(src, `${iconsDir}/${icon}`);
      });

      console.log('[Auto Live Shop] Extension assets copied to dist/');
    },
  };
}

export default defineConfig({
  plugins: [chromeExtensionPlugin()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'chrome110',
    minify: false, // facilita debug no Chrome

    rollupOptions: {
      // Multiple entry points para a extensão
      input: {
        // Background Service Worker
        'background': resolve(__dirname, 'src/background/service-worker.ts'),
        // Content Script
        'content/bootstrap': resolve(__dirname, 'src/content/bootstrap.ts'),
      },

      output: {
        // Mantém estrutura de pastas
        entryFileNames: '[name].js',
        // Chunks compartilhados
        chunkFileNames: 'chunks/[name]-[hash].js',
        // Assets (CSS, imagens)
        assetFileNames: 'assets/[name][extname]',

        // CRÍTICO: Service Workers e Content Scripts não podem ter code splitting
        // Garantir que cada entry seja um arquivo único e self-contained
        manualChunks: undefined,
        inlineDynamicImports: false,
      },
    },
  },

  // Evitar que o Vite tente processar chrome.* APIs
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
