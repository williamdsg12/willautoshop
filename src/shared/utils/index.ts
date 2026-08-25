// ============================================================
// Auto Live Shop V2 — Shared Utilities
// ============================================================

/** Formata ms em HH:MM:SS */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** Pad number com zero à esquerda */
export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Formata valor em BRL */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata tempo relativo (agora, há Xs, há X min) */
export function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5)  return 'agora';
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  return `há ${Math.floor(diff / 3600)}h`;
}

/** Escapa HTML para evitar XSS */
export function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Debounce */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Throttle */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      fn(...args);
    }
  };
}

/** Gera ID único simples */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Sleep */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Verifica se URL é uma página de live do TikTok Shop */
export function isTikTokLivePage(url: string = window.location.href): boolean {
  return (
    url.includes('shop.tiktok.com/streamer') ||
    url.includes('/live-studio') ||
    url.includes('/creator/live') ||
    url.includes('tiktokshop') && url.includes('live')
  );
}

/** Tenta encontrar elemento no DOM com múltiplos seletores (fallback) */
export function queryWithFallbacks(
  selectors: string[],
  context: Document | Element = document,
): Element | null {
  for (const selector of selectors) {
    try {
      const el = context.querySelector(selector);
      if (el) return el;
    } catch {
      // seletor inválido — ignorar
    }
  }
  return null;
}

/** Tenta encontrar múltiplos elementos no DOM com fallbacks */
export function queryAllWithFallbacks(
  selectors: string[],
  context: Document | Element = document,
): Element[] {
  for (const selector of selectors) {
    try {
      const els = Array.from(context.querySelectorAll(selector));
      if (els.length > 0) return els;
    } catch {
      // seletor inválido — ignorar
    }
  }
  return [];
}

/** Aguarda um elemento aparecer no DOM */
export function waitForElement(
  selectors: string[],
  timeout = 10_000,
): Promise<Element | null> {
  return new Promise(resolve => {
    const check = () => queryWithFallbacks(selectors);
    const existing = check();
    if (existing) { resolve(existing); return; }

    const observer = new MutationObserver(() => {
      const el = check();
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}
