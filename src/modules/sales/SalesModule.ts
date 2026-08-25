// ============================================================
// Copilo Live Shop V2 — Sales Module
// Orquestrador de eventos de vendas, ranking de produtos e deduplicação
// ============================================================

import { SalesController, type ProductSalesSummary } from '@/controllers/SalesController';
import { StateManager } from '@/core/StateManager';
import type { Sale } from '@/shared/types';

export class SalesModule {
  private salesCtrl = new SalesController();

  /**
   * Adiciona uma venda processada.
   */
  recordSale(sale: Sale): void {
    this.salesCtrl.registerSale(sale);
  }

  /**
   * Obtém histórico de vendas.
   */
  getHistory(): Sale[] {
    return this.salesCtrl.getRecentSales();
  }

  /**
   * Obtém ranking de produtos mais vendidos.
   */
  getProductRanking(): ProductSalesSummary[] {
    return this.salesCtrl.getProductSalesSummary();
  }

  /**
   * Limpa histórico.
   */
  clear(): void {
    this.salesCtrl.clearSales();
  }

  /**
   * Obtém faturamento acumulado total.
   */
  getTotalGmv(): number {
    return StateManager.metrics.gmv;
  }
}
