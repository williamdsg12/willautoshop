// ============================================================
// Auto Live Shop V2 — Metrics Data Provider
// Captura e normalização de métricas oficiais do TikTok Shop
// ============================================================

import type { LiveMetrics, DataSource } from '@/shared/types';
import { TikTokSelectors } from '@/adapters/tiktok-shop/TikTokSelectors';
import { queryWithFallbacks } from '@/shared/utils';
import { StateManager } from '@/core/StateManager';
import { EventBus } from '@/core/EventBus';
import { Logger } from '@/core/Logger';

const MODULE = 'MetricsDataProvider';

export class MetricsDataProvider {
  /**
   * Extrai e atualiza as métricas da transmissão em andamento.
   */
  public extractMetrics(): LiveMetrics {
    const gmvEl = queryWithFallbacks(TikTokSelectors.metrics.gmv);
    const ordersEl = queryWithFallbacks(TikTokSelectors.metrics.orders);
    const viewersEl = queryWithFallbacks(TikTokSelectors.metrics.viewers);
    const soldItemsEl = queryWithFallbacks(TikTokSelectors.metrics.soldItems);

    let gmv: number | null = null;
    let orders: number | null = null;
    let viewers: number | null = null;
    let soldItems: number | null = null;
    let source: DataSource = 'UNKNOWN';

    // 1. Extração de GMV
    if (gmvEl && gmvEl.textContent) {
      const cleanGmv = gmvEl.textContent.replace(/[^0-9.,]/g, '').replace(',', '.');
      const parsedGmv = parseFloat(cleanGmv);
      if (!isNaN(parsedGmv)) {
        gmv = parsedGmv;
        source = 'DOM';
      }
    }

    // 2. Extração de Pedidos
    if (ordersEl && ordersEl.textContent) {
      const cleanOrders = ordersEl.textContent.replace(/[^0-9]/g, '');
      const parsedOrders = parseInt(cleanOrders, 10);
      if (!isNaN(parsedOrders)) {
        orders = parsedOrders;
        source = 'DOM';
      }
    }

    // 3. Extração de Espectadores
    if (viewersEl && viewersEl.textContent) {
      const cleanViewers = viewersEl.textContent.replace(/[^0-9]/g, '');
      const parsedViewers = parseInt(cleanViewers, 10);
      if (!isNaN(parsedViewers)) {
        viewers = parsedViewers;
      }
    }

    // 4. Extração de Itens Vendidos
    if (soldItemsEl && soldItemsEl.textContent) {
      const cleanItems = soldItemsEl.textContent.replace(/[^0-9]/g, '');
      const parsedItems = parseInt(cleanItems, 10);
      if (!isNaN(parsedItems)) {
        soldItems = parsedItems;
      }
    }

    const currentMetrics = StateManager.metrics;
    const currentSales = StateManager.sales;

    // Se o DOM não fornecer GMV oficial, usa o acumulado das vendas detectadas
    const finalGmv = gmv !== null ? gmv : currentSales.reduce((sum, s) => sum + (s.amount ?? 0), 0);
    const finalSalesCount = currentSales.length;
    const finalOrders = orders !== null ? orders : finalSalesCount;
    const finalSoldItems = soldItems !== null ? soldItems : currentSales.reduce((sum, s) => sum + (s.quantity ?? 1), 0);

    const startedAt = StateManager.live.startedAt || Date.now();
    const elapsedHours = Math.max(0.01, (Date.now() - startedAt) / 3600000);
    const salesPerHour = Number((finalSalesCount / elapsedHours).toFixed(1));

    const updated: LiveMetrics = {
      gmv: finalGmv,
      orders: finalOrders,
      salesCount: finalSalesCount,
      soldItems: finalSoldItems,
      salesPerHour,
      viewers: viewers !== null ? viewers : currentMetrics.viewers,
      startedAt: StateManager.live.startedAt,
      updatedAt: Date.now(),
      source: gmv !== null ? 'DOM' : (currentSales.length > 0 ? 'CALCULATED' : 'UNKNOWN'),
    };

    StateManager.updateMetrics(updated);
    Logger.debug(MODULE, `Métricas atualizadas [GMV: R$ ${updated.gmv}, Pedidos: ${updated.orders}, Fonte: ${updated.source}]`);
    return updated;
  }
}

export const metricsDataProvider = new MetricsDataProvider();
