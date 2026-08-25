// ============================================================
// Auto Live Shop V2 — TikTok Product Adapter
// ============================================================
import type { ActionResult, LiveProduct } from '@/shared/types';
import { TikTokSelectors } from './TikTokSelectors';
import { queryWithFallbacks, queryAllWithFallbacks, sleep } from '@/shared/utils';
import { Logger } from '@/core/Logger';

const MODULE = 'TikTokProductAdapter';

export class TikTokProductAdapter {

  /** Lê a lista de produtos disponíveis na live */
  getProducts(): LiveProduct[] {
    const items = queryAllWithFallbacks(TikTokSelectors.products.item);
    if (!items.length) {
      Logger.warn(MODULE, 'Nenhum produto encontrado no DOM');
      return [];
    }

    const products: LiveProduct[] = items.map((item, index) => {
      const nameEl = queryWithFallbacks(TikTokSelectors.products.name, item);
      const priceEl = queryWithFallbacks(TikTokSelectors.products.price, item);
      const isPinned = !!queryWithFallbacks(TikTokSelectors.products.pinnedProduct, item);

      const rawId = (item as HTMLElement).dataset['productId']
        || (item as HTMLElement).dataset['id']
        || `product-${index}`;

      const rawPrice = priceEl?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0';
      const price = parseFloat(rawPrice) || 0;

      return {
        id: rawId,
        name: nameEl?.textContent?.trim() || `Produto ${index + 1}`,
        price: price > 0 ? price : undefined,
        position: index,
        isPinned,
      };
    });

    Logger.info(MODULE, `${products.length} produtos lidos do DOM`);
    return products;
  }

  /** Retorna o produto atualmente fixado */
  getPinnedProduct(): LiveProduct | null {
    const products = this.getProducts();
    return products.find(p => p.isPinned) ?? null;
  }

  /** Fixa um produto pelo ID */
  async pinProduct(productId: string): Promise<ActionResult<{ product: LiveProduct }>> {
    try {
      const items = queryAllWithFallbacks(TikTokSelectors.products.item);

      for (const item of items) {
        const el = item as HTMLElement;
        const id = el.dataset['productId'] || el.dataset['id'];
        if (id !== productId) continue;

        const pinBtn = queryWithFallbacks(TikTokSelectors.products.pinButton, item) as HTMLButtonElement | null;
        if (!pinBtn) {
          return { success: false, error: 'Botão de fixar não encontrado para este produto' };
        }

        pinBtn.click();
        Logger.info(MODULE, `Produto ${productId} — clique em Fixar`);

        // Aguarda e confirma
        await sleep(800);
        const confirmed = this._confirmPinned(productId);
        if (!confirmed) {
          Logger.warn(MODULE, 'TikTok não confirmou a fixação');
          return { success: false, error: 'TikTok não confirmou a fixação do produto' };
        }

        const products = this.getProducts();
        const product = products.find(p => p.id === productId);
        return { success: true, data: { product: product! } };
      }

      return { success: false, error: `Produto "${productId}" não encontrado na lista` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** Desafixa o produto atual */
  async unpinProduct(): Promise<ActionResult> {
    try {
      const unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton) as HTMLButtonElement | null;
      if (!unpinBtn) {
        // Tenta clicar no produto fixado
        const pinned = queryWithFallbacks(TikTokSelectors.products.pinnedProduct) as HTMLButtonElement | null;
        if (!pinned) {
          return { success: false, error: 'Nenhum produto fixado encontrado' };
        }
        const unpinInPinned = queryWithFallbacks(TikTokSelectors.products.unpinButton, pinned) as HTMLButtonElement | null;
        unpinInPinned?.click();
      } else {
        unpinBtn.click();
      }

      await sleep(600);
      Logger.info(MODULE, 'Produto desafixado');
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** Verifica se um produto foi realmente fixado */
  private _confirmPinned(productId: string): boolean {
    const products = this.getProducts();
    return products.some(p => p.id === productId && p.isPinned);
  }
}
