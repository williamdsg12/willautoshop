// ============================================================
// Copilo Live Shop V2 — Sales Controller
// Gerencia histórico de vendas, rankings e cálculo de métricas
// ============================================================

import type { Sale, LiveMetrics } from '@/shared/types';
import { StateManager } from '@/core/StateManager';
import { EventBus } from '@/core/EventBus';
import { StorageManager } from '@/core/StorageManager';
import { Logger } from '@/core/Logger';

const MODULE = 'SalesController';

export interface ProductSalesSummary {
  productId?: string;
  productName: string;
  totalSales: number;
  totalGmv: number;
  percentage: number;
}

export class SalesController {
  /**
   * Registra manualmente uma nova venda ou dispara processamento de venda.
   */
  registerSale(sale: Sale): void {
    Logger.info(MODULE, `Registrando venda: ${sale.productName} (R$ ${sale.amount})`);
    StateManager.addSale(sale);
    StorageManager.saveSalesHistory([...StateManager.sales]).catch(() => {});
  }

  /**
   * Retorna a lista de vendas recentes.
   */
  getRecentSales(): Sale[] {
    return [...StateManager.sales];
  }

  /**
   * Limpa o histórico de vendas da sessão.
   */
  clearSales(): void {
    StateManager.patchLive({ sales: [] });
    StateManager.updateMetrics({
      gmv: 0,
      soldItems: 0,
      salesCount: 0,
      salesPerHour: 0,
    });
    StorageManager.saveSalesHistory([]).catch(() => {});
    EventBus.emit('sales:updated', []);
    EventBus.emit('toast:show', {
      message: 'Histórico de vendas limpo',
      type: 'info',
    });
  }

  /**
   * Calcula o resumo de vendas agrupado por produto com ranking e GMV.
   */
  getProductSalesSummary(): ProductSalesSummary[] {
    const sales = StateManager.sales;
    const totalGmv = sales.reduce((acc, s) => acc + (s.amount ?? 0), 0);
    const map = new Map<string, { count: number; gmv: number; name: string; id?: string }>();

    sales.forEach(sale => {
      const key = sale.productId || sale.productName || 'Outros';
      const current = map.get(key) || {
        count: 0,
        gmv: 0,
        name: sale.productName || 'Produto',
        id: sale.productId,
      };

      current.count += sale.quantity || 1;
      current.gmv += sale.amount || 0;
      map.set(key, current);
    });

    const summaries: ProductSalesSummary[] = Array.from(map.values()).map(item => ({
      productId: item.id,
      productName: item.name,
      totalSales: item.count,
      totalGmv: item.gmv,
      percentage: totalGmv > 0 ? Number(((item.gmv / totalGmv) * 100).toFixed(1)) : 0,
    }));

    // Ordena do maior GMV para o menor
    return summaries.sort((a, b) => b.totalGmv - a.totalGmv);
  }

  /**
   * Retorna as métricas de vendas atuais.
   */
  getMetrics(): LiveMetrics {
    return StateManager.metrics;
  }
}
