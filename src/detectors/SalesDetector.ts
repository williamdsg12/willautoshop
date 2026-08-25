// ============================================================
// Copilo Live Shop V2 — Sales Detector
// Observa eventos de nova venda no DOM e extrai dados com deduplicação
// ============================================================

import { StateManager } from '@/core/StateManager';
import { Logger } from '@/core/Logger';
import { TikTokSelectors } from '@/adapters/tiktok-shop/TikTokSelectors';
import { createUniqueHash } from '@/shared/utils';
import type { Sale } from '@/shared/types';

const MODULE = 'SalesDetector';

export class SalesDetector {
  private observer: MutationObserver | null = null;
  private seenHashes = new Set<string>();
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    Logger.info(MODULE, 'Iniciando detector de vendas no DOM...');
    this._startObserver();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    Logger.info(MODULE, 'Detector de vendas finalizado');
  }

  private _startObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          this._processNode(node as Element);
        }
      }
    });

    if (document.body) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  private _processNode(node: Element): void {
    const isSaleNotification = TikTokSelectors.sales.notification.some(selector => {
      try {
        return node.matches(selector) || !!node.querySelector(selector);
      } catch {
        return false;
      }
    });

    if (!isSaleNotification) return;

    const sale = this._extractSaleInfo(node);
    if (!sale) return;

    const hash = createUniqueHash(sale.id);
    if (this.seenHashes.has(hash)) return;

    this.seenHashes.add(hash);

    // Evita crescimento indefinido do conjunto de hashes
    if (this.seenHashes.size > 500) {
      const arr = Array.from(this.seenHashes);
      this.seenHashes = new Set(arr.slice(arr.length - 250));
    }

    Logger.info(MODULE, `🛍 Nova venda detectada: ${sale.productName || 'Produto'} - R$ ${sale.amount ?? 0}`);
    StateManager.addSale(sale);
  }

  private _extractSaleInfo(node: Element): Sale | null {
    try {
      const text = node.textContent?.trim() || '';
      if (!text) return null;

      const priceMatch = text.match(/R\$\s*([\d.,]+)/i);
      const amount = priceMatch
        ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'))
        : undefined;

      const productNameEl = node.querySelector(
        '[class*="product-name"], [class*="product-title"], [class*="goods-name"]'
      );
      const productName = productNameEl?.textContent?.trim() || undefined;

      const contentSignature = `${text.substring(0, 40)}_${Date.now()}`;
      const id = createUniqueHash(contentSignature);

      return {
        id,
        productName,
        amount,
        quantity: 1,
        timestamp: Date.now(),
      };
    } catch (err) {
      Logger.debug(MODULE, 'Erro ao extrair informações de venda:', err);
      return null;
    }
  }
}
