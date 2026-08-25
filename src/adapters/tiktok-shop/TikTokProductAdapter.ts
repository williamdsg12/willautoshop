// ============================================================
// Copilo Live Shop V2 — TikTok Product Adapter
// Adaptador para catálogo, fixação e renovação de produtos no TikTok Shop
// ============================================================

import type { ActionResult, LiveProduct } from '@/shared/types';
import { TikTokSelectors } from './TikTokSelectors';
import { queryWithFallbacks, queryAllWithFallbacks, sleep } from '@/shared/utils';
import { Logger } from '@/core/Logger';

const MODULE = 'TikTokProductAdapter';

export class TikTokProductAdapter {
  /**
   * Lê a lista de produtos disponíveis atualmente no DOM do TikTok Shop.
   */
  getProducts(): LiveProduct[] {
    const items = queryAllWithFallbacks(TikTokSelectors.products.item);
    if (!items.length) {
      Logger.debug(MODULE, 'Nenhum item de produto encontrado no DOM');
      return [];
    }

    const products: LiveProduct[] = items.map((item, index) => {
      const nameEl = queryWithFallbacks(TikTokSelectors.products.name, item);
      const priceEl = queryWithFallbacks(TikTokSelectors.products.price, item);
      const isPinned = !!queryWithFallbacks(TikTokSelectors.products.pinnedProduct, item);

      const htmlEl = item as HTMLElement;
      const rawId =
        htmlEl.dataset['productId'] ||
        htmlEl.dataset['id'] ||
        htmlEl.dataset['goodsId'] ||
        `prod-${index + 1}`;

      const rawPrice = priceEl?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0';
      const price = parseFloat(rawPrice) || 0;

      return {
        id: rawId,
        name: nameEl?.textContent?.trim() || `Produto ${index + 1}`,
        price: price > 0 ? price : undefined,
        position: index + 1,
        isPinned,
      };
    });

    Logger.debug(MODULE, `${products.length} produtos mapeados do DOM`);
    return products;
  }

  /**
   * Obtém o produto atualmente fixado no topo da transmissão.
   */
  getPinnedProduct(): LiveProduct | null {
    const products = this.getProducts();
    return products.find(p => p.isPinned) ?? null;
  }

  /**
   * Atualiza e retorna a lista de produtos acionando o botão de recarga caso exista.
   */
  async refreshProducts(): Promise<ActionResult<LiveProduct[]>> {
    try {
      const refreshBtn = queryWithFallbacks(TikTokSelectors.products.refreshButton) as HTMLButtonElement | null;
      if (refreshBtn) {
        refreshBtn.click();
        await sleep(600);
      }

      const products = this.getProducts();
      return {
        success: true,
        data: products,
      };
    } catch (err) {
      return {
        success: false,
        error: `Falha ao recarregar produtos: ${String(err)}`,
        data: [],
      };
    }
  }

  /**
   * Fixa um produto pelo seu ID com verificação de confirmação no DOM.
   */
  async pinProduct(productId: string): Promise<ActionResult<{ product: LiveProduct }>> {
    try {
      const items = queryAllWithFallbacks(TikTokSelectors.products.item);
      if (!items.length) {
        return {
          success: false,
          error: 'Lista de produtos não disponível no DOM do TikTok',
        };
      }

      let targetItem: HTMLElement | null = null;

      for (const item of items) {
        const el = item as HTMLElement;
        const id = el.dataset['productId'] || el.dataset['id'] || el.dataset['goodsId'];
        if (id === productId) {
          targetItem = el;
          break;
        }
      }

      // Se não encontrou por data-id, busca pelo índice se o ID contiver número
      if (!targetItem) {
        const indexMatch = productId.match(/prod-(\d+)/);
        if (indexMatch && indexMatch[1]) {
          const idx = parseInt(indexMatch[1], 10) - 1;
          if (items[idx]) {
            targetItem = items[idx] as HTMLElement;
          }
        }
      }

      if (!targetItem) {
        return {
          success: false,
          error: `Produto com identificador "${productId}" não foi localizado no DOM`,
        };
      }

      const pinBtn = queryWithFallbacks(TikTokSelectors.products.pinButton, targetItem) as HTMLButtonElement | null;
      if (!pinBtn) {
        return {
          success: false,
          error: 'Botão de fixar não encontrado para o produto selecionado',
        };
      }

      pinBtn.click();
      Logger.info(MODULE, `Comando de fixação disparado para produto "${productId}"`);

      // Aguarda o DOM processar a mutação
      await sleep(750);

      const isConfirmed = this._verifyPinnedState(productId);
      if (!isConfirmed) {
        Logger.warn(MODULE, `Ação de fixação do produto "${productId}" não confirmada pelo TikTok Shop`);
        return {
          success: false,
          error: 'Ação não confirmada pelo TikTok Shop',
        };
      }

      const updatedProducts = this.getProducts();
      const pinnedProduct = updatedProducts.find(p => p.id === productId) || {
        id: productId,
        name: 'Produto Fixado',
        isPinned: true,
      };

      return {
        success: true,
        data: { product: pinnedProduct },
      };
    } catch (err) {
      return {
        success: false,
        error: `Erro ao fixar produto: ${String(err)}`,
      };
    }
  }

  /**
   * Desafixa o produto atualmente fixado no topo da transmissão.
   */
  async unpinProduct(): Promise<ActionResult> {
    try {
      let unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton) as HTMLButtonElement | null;

      if (!unpinBtn) {
        const pinnedContainer = queryWithFallbacks(TikTokSelectors.products.pinnedProduct);
        if (pinnedContainer) {
          unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton, pinnedContainer) as HTMLButtonElement | null;
        }
      }

      if (!unpinBtn) {
        return {
          success: false,
          error: 'Nenhum produto fixado ou botão de desafixar encontrado',
        };
      }

      unpinBtn.click();
      await sleep(600);

      const stillPinned = this.getPinnedProduct();
      if (stillPinned) {
        return {
          success: false,
          error: 'Ação não confirmada pelo TikTok Shop',
        };
      }

      Logger.info(MODULE, 'Produto desafixado com sucesso');
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Erro ao desafixar produto: ${String(err)}`,
      };
    }
  }

  private _verifyPinnedState(productId: string): boolean {
    const products = this.getProducts();
    const product = products.find(p => p.id === productId);
    if (product?.isPinned) return true;

    const pinnedBadge = queryWithFallbacks(TikTokSelectors.products.pinnedProduct);
    return !!pinnedBadge;
  }
}
