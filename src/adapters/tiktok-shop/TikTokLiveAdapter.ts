// ============================================================
// Copilo Live Shop V2 — TikTok Live Adapter
// Adaptador de ciclo de vida e métricas da LIVE no DOM do TikTok Shop
// ============================================================

import type { ActionResult, LiveMetrics, LiveStatus } from '@/shared/types';
import { TikTokSelectors } from './TikTokSelectors';
import { queryWithFallbacks, isTikTokShopUrl } from '@/shared/utils';
import { Logger } from '@/core/Logger';

const MODULE = 'TikTokLiveAdapter';

export class TikTokLiveAdapter {
  /**
   * Verifica no DOM se existe uma transmissão ativa.
   * Não retorna sucesso falso caso a LIVE não esteja ativa.
   */
  isLiveActive(): boolean {
    if (!isTikTokShopUrl()) {
      return false;
    }

    // 1. Verifica presença de badge ou indicador de status de transmissão no DOM
    const badge = queryWithFallbacks(TikTokSelectors.live.liveIndicator);
    if (badge && badge.textContent && /live|ao vivo|gravando/i.test(badge.textContent)) {
      Logger.debug(MODULE, 'Badge ativo encontrado no DOM');
      return true;
    }

    // 2. Verifica presença do container de estúdio ativo
    const container = queryWithFallbacks(TikTokSelectors.live.streamerContainer);
    if (container) {
      const endBtn = queryWithFallbacks(TikTokSelectors.live.endLiveButton, container);
      if (endBtn) {
        Logger.debug(MODULE, 'Container de estúdio com botão de encerrar encontrado');
        return true;
      }
    }

    // 3. Verifica timer de live em andamento no DOM
    const timer = queryWithFallbacks(TikTokSelectors.live.liveTimer);
    if (timer && timer.textContent && timer.textContent.trim().length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Tenta extrair o identificador único da LIVE se disponível no DOM ou URL.
   */
  getLiveId(): string | undefined {
    try {
      const roomEl = queryWithFallbacks(TikTokSelectors.live.roomInfo);
      if (roomEl) {
        const id = (roomEl as HTMLElement).dataset['roomId'] ||
          roomEl.getAttribute('content') ||
          roomEl.getAttribute('data-room-id');
        if (id) return id;
      }

      // Tenta extrair da URL
      const match = window.location.href.match(/streamer\/(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (err) {
      Logger.debug(MODULE, 'Não foi possível extrair liveId:', err);
    }
    return undefined;
  }

  /**
   * Retorna o status detalhado atual da LIVE.
   */
  getLiveStatus(): LiveStatus {
    if (!isTikTokShopUrl()) {
      return 'LIVE_INACTIVE';
    }

    const active = this.isLiveActive();
    if (active) {
      return 'LIVE_ACTIVE';
    }

    // Se estiver na URL de transmissão mas sem indicadores ativos
    if (window.location.href.includes('streamer') || window.location.href.includes('live-studio')) {
      return 'LIVE_DETECTING';
    }

    return 'LIVE_INACTIVE';
  }

  /**
   * Extrai métricas reais do DOM do TikTok Shop.
   * Não inventa dados fictícios.
   */
  getLiveMetrics(): Partial<LiveMetrics> {
    const metrics: Partial<LiveMetrics> = {
      updatedAt: Date.now(),
      source: 'tiktok',
    };

    try {
      const gmvEl = queryWithFallbacks(TikTokSelectors.metrics.gmv);
      if (gmvEl && gmvEl.textContent) {
        const raw = gmvEl.textContent.replace(/[^0-9.,]/g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val)) metrics.gmv = val;
      }

      const viewersEl = queryWithFallbacks(TikTokSelectors.metrics.viewers);
      if (viewersEl && viewersEl.textContent) {
        const raw = viewersEl.textContent.replace(/[^0-9]/g, '');
        const val = parseInt(raw, 10);
        if (!isNaN(val)) metrics.viewers = val;
      }

      const ordersEl = queryWithFallbacks(TikTokSelectors.metrics.orders);
      if (ordersEl && ordersEl.textContent) {
        const raw = ordersEl.textContent.replace(/[^0-9]/g, '');
        const val = parseInt(raw, 10);
        if (!isNaN(val)) metrics.salesCount = val;
      }

      const soldEl = queryWithFallbacks(TikTokSelectors.metrics.soldItems);
      if (soldEl && soldEl.textContent) {
        const raw = soldEl.textContent.replace(/[^0-9]/g, '');
        const val = parseInt(raw, 10);
        if (!isNaN(val)) metrics.soldItems = val;
      }
    } catch (err) {
      Logger.warn(MODULE, 'Erro ao extrair métricas do DOM:', err);
      metrics.source = 'unknown';
    }

    return metrics;
  }

  /**
   * Dispara o encerramento da LIVE interagindo com o botão do TikTok Shop.
   */
  async endLive(): Promise<ActionResult> {
    try {
      const btn = queryWithFallbacks(TikTokSelectors.live.endLiveButton) as HTMLButtonElement | null;
      if (!btn) {
        return {
          success: false,
          error: 'Botão de encerrar live não encontrado no DOM',
        };
      }

      btn.click();
      Logger.info(MODULE, 'Clique no botão de encerrar live executado');
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Falha ao encerrar live: ${String(err)}`,
      };
    }
  }
}
