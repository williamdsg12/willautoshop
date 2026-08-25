// ============================================================
// Auto Live Shop V2 — Product Discovery Service
// Serviço de descoberta e sincronização real de produtos da LIVE
// ============================================================

import type { LiveProduct, ActionResult } from '@/shared/types';
import { TikTokSelectors } from '@/adapters/tiktok-shop/TikTokSelectors';
import { queryWithFallbacks, queryAllWithFallbacks } from '@/shared/utils';
import { liveRemoteAgent } from '@/isolated/live-remote-agent';
import { productRepository } from './ProductRepository';
import { Logger } from '@/core/Logger';

const MODULE = 'ProductDiscoveryService';

export class ProductDiscoveryService {
  private isScanning = false;

  /**
   * Executa a varredura e descoberta de produtos no TikTok Shop LIVE.
   */
  async discoverProducts(): Promise<ActionResult<LiveProduct[]>> {
    if (this.isScanning) {
      return { success: false, error: 'Varredura já em andamento', data: productRepository.getAll() };
    }

    this.isScanning = true;
    Logger.info(MODULE, '🔍 Iniciando descoberta real de produtos no TikTok Shop...');

    try {
      // 1. Tenta obter produtos via MAIN WORLD Agent
      const remoteRes = await liveRemoteAgent.refreshProducts();
      if (remoteRes.success && remoteRes.data && remoteRes.data.length > 0) {
        const normalized = remoteRes.data.map(p => ({
          ...p,
          source: 'PAGE_STATE' as const,
          updatedAt: Date.now(),
        }));

        productRepository.setProducts(normalized);
        Logger.info(MODULE, `✅ ${normalized.length} produtos descobertos via MAIN WORLD`);
        return { success: true, data: normalized, source: 'PAGE_STATE' };
      }

      // 2. Fallback: Varredura estruturada no DOM
      Logger.info(MODULE, 'Buscando produtos diretamente na árvore DOM...');
      const domProducts = this._scanDomProducts();

      if (domProducts.length > 0) {
        productRepository.setProducts(domProducts);
        Logger.info(MODULE, `✅ ${domProducts.length} produtos descobertos via DOM`);
        return { success: true, data: domProducts, source: 'DOM' };
      }

      Logger.warn(MODULE, '⚠️ Nenhum produto localizado no painel do TikTok Shop');
      return {
        success: false,
        error: 'Nenhum produto detectado na vitrine da LIVE.',
        data: [],
        source: 'UNKNOWN',
      };
    } catch (err) {
      Logger.error(MODULE, 'Erro fatal durante descoberta de produtos:', err);
      return { success: false, error: String(err), data: [], source: 'UNKNOWN' };
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Extração de produtos inspecionando containers e nós de produto no DOM.
   */
  private _scanDomProducts(): LiveProduct[] {
    const items = queryAllWithFallbacks(TikTokSelectors.products.item);
    const products: LiveProduct[] = [];

    items.forEach((item, index) => {
      const el = item as HTMLElement;
      const nameEl = queryWithFallbacks(TikTokSelectors.products.name, el);
      const priceEl = queryWithFallbacks(TikTokSelectors.products.price, el);
      const imgEl = el.querySelector('img') as HTMLImageElement | null;
      const isPinned = !!queryWithFallbacks(TikTokSelectors.products.pinnedProduct, el);

      const rawId = el.dataset['productId'] || el.dataset['id'] || el.dataset['goodsId'] || `prod-${index + 1}`;
      const name = nameEl?.textContent?.trim() || `Produto ${index + 1}`;

      const rawPrice = priceEl?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0';
      const price = parseFloat(rawPrice) || 0;

      products.push({
        id: rawId,
        name,
        price: price > 0 ? price : undefined,
        image: imgEl?.src || undefined,
        position: index + 1,
        isPinned,
        source: 'DOM',
        updatedAt: Date.now(),
      });
    });

    return products;
  }
}

export const productDiscoveryService = new ProductDiscoveryService();
