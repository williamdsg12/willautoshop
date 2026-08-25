// ============================================================
// Copilo Live Shop V2 — Products Module
// Orquestrador de operações de catálogo, fixação e seleção de produtos
// ============================================================

import { ProductController } from '@/controllers/ProductController';
import { StateManager } from '@/core/StateManager';
import type { ActionResult, LiveProduct } from '@/shared/types';

export class ProductsModule {
  private productCtrl = new ProductController();

  /**
   * Recarrega catálogo de produtos da transmissão.
   */
  async refreshCatalog(): Promise<ActionResult<LiveProduct[]>> {
    return this.productCtrl.refreshProducts();
  }

  async refreshProducts(): Promise<ActionResult<LiveProduct[]>> {
    return this.productCtrl.refreshProducts();
  }

  /**
   * Fixa um produto na LIVE.
   */
  async pin(productId: string): Promise<ActionResult> {
    return this.productCtrl.pinProduct(productId);
  }

  /**
   * Desafixa o produto atualmente fixado na LIVE.
   */
  async unpin(): Promise<ActionResult> {
    return this.productCtrl.unpinProduct();
  }

  /**
   * Retorna os produtos listados.
   */
  getProducts(): LiveProduct[] {
    return [...StateManager.products];
  }

  /**
   * Retorna o produto fixado atual.
   */
  getPinnedProduct(): LiveProduct | null {
    return this.productCtrl.getPinnedProduct();
  }
}
