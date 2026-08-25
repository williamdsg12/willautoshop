// ============================================================
// Copilo Live Shop V2 — Shared Utilities
// ============================================================

import { TIKTOK_LIVE_URLS } from '../constants';

/**
 * Gera um identificador único alfanumérico.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Cria um hash único determinístico simples a partir de uma string ou objeto
 * para deduplicação de vendas e eventos.
 */
export function createUniqueHash(input: string | object): string {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `hash_${Math.abs(hash).toString(36)}_${str.length}`;
}

/**
 * Pausa a execução de forma assíncrona por X milissegundos.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce genérico e tipado.
 */
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

/**
 * Throttle genérico e tipado.
 */
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

/**
 * Limita um número entre min e max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Formata um valor numérico em moeda BRL (R$).
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Alias de formatCurrency para retrocompatibilidade.
 */
export const formatBRL = formatCurrency;

/**
 * Formata números com separador de milhar.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

/**
 * Formata milissegundos no formato HH:MM:SS.
 */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Adiciona zero à esquerda para números menores que 10.
 */
export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Formata tempo relativo amigável (agora, há Xs, há X min, há Xh).
 */
export function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5) return 'agora';
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  return `há ${Math.floor(diff / 3600)}h`;
}

/**
 * Parse seguro de JSON com valor de fallback em caso de falha.
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Escapa HTML para prevenir injeção XSS.
 */
export function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Verifica se a URL informada pertence ao ambiente do TikTok Shop.
 */
export function isTikTokShopUrl(url: string = window.location.href): boolean {
  return TIKTOK_LIVE_URLS.some(target => url.includes(target));
}

/**
 * Alias para verificação de página de Live do TikTok Shop.
 */
export const isTikTokLivePage = isTikTokShopUrl;

/**
 * Obtém a rota / pathname atual do navegador.
 */
export function getCurrentRoute(): string {
  return window.location.pathname + window.location.search;
}

/**
 * Tenta encontrar elemento no DOM com múltiplos seletores (fallback).
 */
export function queryWithFallbacks(
  selectors: string[],
  context: Document | Element = document,
): Element | null {
  for (const selector of selectors) {
    try {
      const el = context.querySelector(selector);
      if (el) return el;
    } catch {
      // Ignora erro de seletor inválido
    }
  }
  return null;
}

/**
 * Tenta encontrar múltiplos elementos no DOM com lista de fallbacks.
 */
export function queryAllWithFallbacks(
  selectors: string[],
  context: Document | Element = document,
): Element[] {
  for (const selector of selectors) {
    try {
      const els = Array.from(context.querySelectorAll(selector));
      if (els.length > 0) return els;
    } catch {
      // Ignora erro de seletor inválido
    }
  }
  return [];
}

/**
 * Aguarda um elemento aparecer no DOM via MutationObserver com timeout.
 */
export function waitForElement(
  selectors: string[],
  timeout = 10_000,
): Promise<Element | null> {
  return new Promise(resolve => {
    const check = () => queryWithFallbacks(selectors);
    const existing = check();
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = check();
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}
