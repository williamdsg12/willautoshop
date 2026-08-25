// ============================================================
// Auto Live Shop V2 — TikTok Live Adapter
// ============================================================
import type { ActionResult, LiveMetrics } from '@/shared/types';
import { TikTokSelectors } from './TikTokSelectors';
import { queryWithFallbacks, queryAllWithFallbacks } from '@/shared/utils';
import { Logger } from '@/core/Logger';

const MODULE = 'TikTokLiveAdapter';

export class TikTokLiveAdapter {

  /** Verifica se a LIVE está ativa observando o DOM */
  isLiveActive(): boolean {
    // Verifica indicador de live no DOM
    const badge = queryWithFallbacks(TikTokSelectors.live.liveIndicator);
    if (badge) {
      Logger.debug(MODULE, 'Badge de live encontrado:', badge);
      return true;
    }

    // Verifica container do streamer
    const container = queryWithFallbacks(TikTokSelectors.live.streamerContainer);
    if (container) {
      Logger.debug(MODULE, 'Container de streamer encontrado');
      return true;
    }

    // Fallback: verificar URL
    const url = window.location.href;
    const isLiveUrl = url.includes('streamer') || url.includes('live-studio') || url.includes('creator/live');
    Logger.debug(MODULE, 'isLiveActive por URL:', isLiveUrl);
    return isLiveUrl;
  }

  /** Tenta ler métricas do DOM */
  getLiveMetrics(): Partial<LiveMetrics> {
    const metrics: Partial<LiveMetrics> = {
      updatedAt: Date.now(),
      source: 'tiktok',
    };

    try {
      const gmvEl = queryWithFallbacks(TikTokSelectors.metrics.gmv);
      if (gmvEl) {
        const raw = gmvEl.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '';
        const val = parseFloat(raw);
        if (!isNaN(val)) metrics.gmv = val;
      }

      const viewersEl = queryWithFallbacks(TikTokSelectors.metrics.viewers);
      if (viewersEl) {
        const raw = viewersEl.textContent?.replace(/[^0-9]/g, '') ?? '';
        const val = parseInt(raw);
        if (!isNaN(val)) metrics.viewers = val;
      }

      const ordersEl = queryWithFallbacks(TikTokSelectors.metrics.orders);
      if (ordersEl) {
        const raw = ordersEl.textContent?.replace(/[^0-9]/g, '') ?? '';
        const val = parseInt(raw);
        if (!isNaN(val)) metrics.salesCount = val;
      }

      const soldEl = queryWithFallbacks(TikTokSelectors.metrics.soldItems);
      if (soldEl) {
        const raw = soldEl.textContent?.replace(/[^0-9]/g, '') ?? '';
        const val = parseInt(raw);
        if (!isNaN(val)) metrics.soldItems = val;
      }
    } catch (err) {
      Logger.warn(MODULE, 'Erro ao ler métricas:', err);
      metrics.source = 'unknown';
    }

    return metrics;
  }

  /** Tenta encerrar a live clicando no botão */
  async endLive(): Promise<ActionResult> {
    try {
      const btn = queryWithFallbacks(TikTokSelectors.live.endLiveButton) as HTMLButtonElement | null;
      if (!btn) {
        return { success: false, error: 'Botão de encerrar não encontrado no DOM' };
      }
      btn.click();
      Logger.info(MODULE, 'Botão de encerrar live clicado');
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
