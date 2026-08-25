// ============================================================
// Copilo Live Shop V2 — Product Controller
// Gerencia fixação, catálogo e desafixação de produtos
// ============================================================

import type { ActionResult, LiveProduct } from '@/shared/types';
import { tiktokAdapter } from '@/adapters/tiktok-shop/TikTokShopAdapter';
import { StateManager } from '@/core/StateManager';
import { EventBus } from '@/core/EventBus';
import { Logger } from '@/core/Logger';

const MODULE = 'ProductController';

export class ProductController {
  /**
   * Recarrega a lista de produtos do TikTok Shop.
   */
  async refreshProducts(): Promise<ActionResult<LiveProduct[]>> {
    try {
      const result = await tiktokAdapter.refreshProducts();
      if (result.success && result.data) {
        StateManager.setProducts(result.data);
        Logger.info(MODULE, `${result.data.length} produtos sincronizados`);
        return result;
      }

      const currentProducts = tiktokAdapter.getProducts();
      StateManager.setProducts(currentProducts);
      return { success: true, data: currentProducts };
    } catch (err) {
      Logger.error(MODULE, 'Erro ao atualizar catálogo de produtos:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Fixa um produto e sincroniza o estado.
   */
  async pinProduct(productId: string): Promise<ActionResult> {
    if (!productId) {
      return { success: false, error: 'Identificador do produto é obrigatório' };
    }

    Logger.info(MODULE, `Fixando produto ID: ${productId}`);
    const result = await tiktokAdapter.pinProduct(productId);

    if (result.success) {
      StateManager.setPinnedProduct(productId);
      EventBus.emit('products:pinned', { productId });
      EventBus.emit('product:pinned', { productId });
      EventBus.emit('toast:show', {
        message: '📌 Produto fixado com sucesso',
        type: 'success',
      });
    } else {
      EventBus.emit('products:pin_failed', { error: result.error ?? 'Falha ao fixar' });
      EventBus.emit('toast:show', {
        message: `⚠ ${result.error || 'Ação não confirmada pelo TikTok Shop'}`,
        type: 'warn',
      });
    }

    return result;
  }

  /**
   * Desafixa o produto fixado na LIVE.
   */
  async unpinProduct(): Promise<ActionResult> {
    Logger.info(MODULE, 'Desafixando produto atual');
    const result = await tiktokAdapter.unpinProduct();

    if (result.success) {
      StateManager.setPinnedProduct(undefined);
      EventBus.emit('products:unpinned');
      EventBus.emit('product:unpinned');
      EventBus.emit('toast:show', {
        message: 'Produto desafixado',
        type: 'info',
      });
    } else {
      EventBus.emit('toast:show', {
        message: `⚠ ${result.error || 'Não foi possível desafixar'}`,
        type: 'warn',
      });
    }

    return result;
  }

  /**
   * Retorna os produtos armazenados no estado central.
   */
  getProducts(): LiveProduct[] {
    return [...StateManager.products];
  }

  /**
   * Retorna o produto atualmente fixado.
   */
  getPinnedProduct(): LiveProduct | null {
    const pinnedId = StateManager.live.pinnedProductId;
    if (!pinnedId) return null;
    return StateManager.products.find(p => p.id === pinnedId) || null;
  }
}
