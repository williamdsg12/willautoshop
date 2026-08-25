// ============================================================
// Copilo Live Shop V2 — Product Detector
// Observa mudanças no catálogo de produtos e produtos fixados no DOM
// ============================================================

import { StateManager } from '@/core/StateManager';
import { Logger } from '@/core/Logger';
import { tiktokAdapter } from '@/adapters/tiktok-shop/TikTokShopAdapter';
import { TikTokSelectors } from '@/adapters/tiktok-shop/TikTokSelectors';
import { debounce } from '@/shared/utils';

const MODULE = 'ProductDetector';

export class ProductDetector {
  private observer: MutationObserver | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    Logger.info(MODULE, 'Iniciando detector de produtos...');

    this._syncProducts();
    this._startObserver();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    Logger.info(MODULE, 'Detector de produtos finalizado');
  }

  private _syncProducts(): void {
    const products = tiktokAdapter.getProducts();
    if (products.length > 0) {
      StateManager.setProducts(products);
      const pinned = tiktokAdapter.getPinnedProduct();
      if (pinned) {
        StateManager.setPinnedProduct(pinned.id);
      }
    }
  }

  private _startObserver(): void {
    const debouncedSync = debounce(() => this._syncProducts(), 1200);
    this.observer = new MutationObserver((mutations) => {
      const isProductMutation = mutations.some(m => {
        const target = m.target as HTMLElement;
        return (
          TikTokSelectors.products.list.some(s => target.matches?.(s) || target.querySelector?.(s)) ||
          TikTokSelectors.products.item.some(s => target.matches?.(s))
        );
      });

      if (isProductMutation) {
        debouncedSync();
      }
    });

    if (document.body) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-product-id', 'data-goods-id'],
      });
    }
  }
}
