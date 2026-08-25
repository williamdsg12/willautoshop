// ============================================================
// Auto Live Shop V2 — Sales Detector
// Detecta novas vendas via MutationObserver no DOM
// ============================================================
import { StateManager } from '@/core/StateManager';
import { Logger } from '@/core/Logger';
import { TikTokSelectors } from '@/adapters/tiktok-shop/TikTokSelectors';
import { queryWithFallbacks, queryAllWithFallbacks, generateId } from '@/shared/utils';
import { DEFAULTS } from '@/shared/constants';
import type { Sale } from '@/shared/types';

const MODULE = 'SalesDetector';

export class SalesDetector {
  private observer: MutationObserver | null = null;
  private seenIds = new Set<string>();

  start(): void {
    Logger.info(MODULE, 'Iniciando observer de vendas...');
    this._startObserver();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    Logger.info(MODULE, 'Parado');
  }

  private _startObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          this._checkForSale(node as Element);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private _checkForSale(node: Element): void {
    // Verifica se o nó adicionado é uma notificação de venda
    const isSaleNode = TikTokSelectors.sales.notification.some(sel => {
      try { return node.matches(sel) || node.querySelector(sel); }
      catch { return false; }
    });

    if (!isSaleNode) return;

    const sale = this._extractSale(node);
    if (!sale) return;

    // Deduplicação
    if (this.seenIds.has(sale.id)) return;
    this.seenIds.add(sale.id);

    // Limpar IDs antigos para não vazar memória
    if (this.seenIds.size > 500) {
      const arr = Array.from(this.seenIds);
      this.seenIds = new Set(arr.slice(arr.length - 200));
    }

    Logger.info(MODULE, 'Nova venda detectada:', sale);
    StateManager.addSale(sale);
  }

  private _extractSale(node: Element): Sale | null {
    try {
      const text = node.textContent?.trim() || '';
      const priceMatch = text.match(/R\$\s*([\d.,]+)/);
      const amount = priceMatch
        ? parseFloat(priceMatch[1].replace('.', '').replace(',', '.'))
        : undefined;

      const productNameEl = node.querySelector('[class*="product-name"], [class*="product-title"]');
      const productName = productNameEl?.textContent?.trim() || undefined;

      // ID baseado em conteúdo + timestamp para deduplicação
      const contentHash = `${text.substring(0, 50)}_${Date.now()}`;
      const id = btoa(contentHash).substring(0, 16);

      return {
        id,
        productName,
        amount,
        quantity: 1,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }
}
