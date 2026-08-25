// ============================================================
// Copilo Live Shop V2 — Dashboard Module
// Orquestrador de dados, métricas e ciclo de vida do painel principal
// ============================================================

import { StateManager } from '@/core/StateManager';
import { LiveController } from '@/controllers/LiveController';
import { SalesController } from '@/controllers/SalesController';
import type { LiveMetrics, LiveStatus, Sale } from '@/shared/types';

export class DashboardModule {
  private liveCtrl = new LiveController();
  private salesCtrl = new SalesController();

  /**
   * Inicia a sessão da LIVE manualmente pelo painel.
   */
  startSession() {
    return this.liveCtrl.startLive();
  }

  /**
   * Encerra a sessão da LIVE.
   */
  async endSession() {
    return this.liveCtrl.endLive();
  }

  /**
   * Obtém as métricas consolidadas em tempo real.
   */
  getMetrics(): LiveMetrics {
    return StateManager.metrics;
  }

  /**
   * Obtém o status da LIVE.
   */
  getStatus(): LiveStatus {
    return StateManager.live.status;
  }

  /**
   * Obtém as vendas recentes para exibição no feed.
   */
  getRecentSales(): Sale[] {
    return this.salesCtrl.getRecentSales();
  }

  /**
   * Limpa o feed de vendas.
   */
  clearFeed(): void {
    this.salesCtrl.clearSales();
  }
}
