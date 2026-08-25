// ============================================================
// Auto Live Shop V2 — Product Repository
// Gerenciamento e armazenamento em memória de catálogo com deduplicação
// ============================================================

import type { LiveProduct } from '@/shared/types';
import { EventBus } from '@/core/EventBus';
import { StateManager } from '@/core/StateManager';
import { Logger } from '@/core/Logger';

const MODULE = 'ProductRepository';

export class ProductRepository {
  private products: Map<string, LiveProduct> = new Map();
  private pinnedProductId: string | null = null;
  private lastSyncedAt = 0;

  /**
   * Atualiza ou substitui o catálogo completo de produtos.
   */
  setProducts(items: LiveProduct[]): void {
    this.products.clear();
    this.pinnedProductId = null;

    items.forEach((item, index) => {
      const normalized: LiveProduct = {
        ...item,
        position: item.position ?? index + 1,
        updatedAt: item.updatedAt ?? Date.now(),
      };

      this.products.set(normalized.id, normalized);

      if (normalized.isPinned) {
        this.pinnedProductId = normalized.id;
      }
    });

    this.lastSyncedAt = Date.now();
    const productList = this.getAll();

    StateManager.setProducts(productList);
    if (this.pinnedProductId) {
      StateManager.setPinnedProduct(this.pinnedProductId);
    }

    Logger.info(MODULE, `Catálogo atualizado: ${productList.length} produtos em memória`);
    EventBus.emit('products:updated', productList);
  }

  /**
   * Retorna todos os produtos ordenados pela posição na vitrine.
   */
  getAll(): LiveProduct[] {
    return Array.from(this.products.values()).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  /**
   * Busca um produto por ID.
   */
  getById(id: string): LiveProduct | null {
    return this.products.get(id) || null;
  }

  /**
   * Define o produto atualmente fixado na LIVE.
   */
  setPinned(productId: string | null): void {
    this.pinnedProductId = productId;

    for (const [id, prod] of this.products.entries()) {
      prod.isPinned = id === productId;
    }

    if (productId) {
      StateManager.setPinnedProduct(productId);
      EventBus.emit('products:pinned', { productId });
    } else {
      EventBus.emit('products:unpinned');
    }
  }

  /**
   * Retorna o produto atualmente fixado.
   */
  getPinned(): LiveProduct | null {
    if (!this.pinnedProductId) return null;
    return this.getById(this.pinnedProductId);
  }

  /**
   * Retorna timestamp da última sincronização.
   */
  getLastSyncedAt(): number {
    return this.lastSyncedAt;
  }
}

export const productRepository = new ProductRepository();
