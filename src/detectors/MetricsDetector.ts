// ============================================================
// Copilo Live Shop V2 — Metrics Detector
// Observa alterações nas métricas de GMV, pedidos e espectadores
// ============================================================

import { StateManager } from '@/core/StateManager';
import { Logger } from '@/core/Logger';
import { tiktokAdapter } from '@/adapters/tiktok-shop/TikTokShopAdapter';
import { TikTokSelectors } from '@/adapters/tiktok-shop/TikTokSelectors';
import { debounce } from '@/shared/utils';

const MODULE = 'MetricsDetector';

export class MetricsDetector {
  private observer: MutationObserver | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    Logger.info(MODULE, 'Iniciando detector de métricas do TikTok Shop...');

    this._readMetrics();
    this._startObserver();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    Logger.info(MODULE, 'Detector de métricas finalizado');
  }

  private _readMetrics(): void {
    const metrics = tiktokAdapter.getLiveMetrics();
    if (Object.keys(metrics).length > 2) {
      StateManager.updateMetrics(metrics);
    }
  }

  private _startObserver(): void {
    const debouncedRead = debounce(() => this._readMetrics(), 1500);
    this.observer = new MutationObserver((mutations) => {
      const isMetricsChange = mutations.some(m => {
        const target = m.target as HTMLElement;
        return (
          TikTokSelectors.metrics.gmv.some(s => target.matches?.(s) || target.querySelector?.(s)) ||
          TikTokSelectors.metrics.viewers.some(s => target.matches?.(s) || target.querySelector?.(s)) ||
          TikTokSelectors.metrics.orders.some(s => target.matches?.(s) || target.querySelector?.(s))
        );
      });

      if (isMetricsChange) {
        debouncedRead();
      }
    });

    if (document.body) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }
}
