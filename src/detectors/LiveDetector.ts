// ============================================================
// Copilo Live Shop V2 — Live Detector
// Monitora status da LIVE e mudanças de rota no DOM do TikTok Shop
// ============================================================

import { StateManager } from '@/core/StateManager';
import { Logger } from '@/core/Logger';
import { tiktokAdapter } from '@/adapters/tiktok-shop/TikTokShopAdapter';
import { debounce } from '@/shared/utils';

const MODULE = 'LiveDetector';

export class LiveDetector {
  private observer: MutationObserver | null = null;
  private urlCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastUrl = '';
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    Logger.info(MODULE, 'Iniciando detector de LIVE...');

    this.lastUrl = window.location.href;
    this._check();
    this._startObserver();
    this._startUrlWatcher();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }

    Logger.info(MODULE, 'Detector de LIVE finalizado');
  }

  private _check(): void {
    const status = tiktokAdapter.live.getLiveStatus();
    const currentStatus = StateManager.live.status;

    if (status === 'LIVE_ACTIVE' && currentStatus !== 'LIVE_ACTIVE') {
      StateManager.setLiveStatus('LIVE_ACTIVE');
      Logger.info(MODULE, '🔴 LIVE ATIVA detectada no TikTok Shop');
    } else if (status === 'LIVE_INACTIVE' && currentStatus === 'LIVE_ACTIVE') {
      StateManager.setLiveStatus('LIVE_ENDED');
      Logger.info(MODULE, '⬛ LIVE ENCERRADA detectada');
    } else if (status === 'LIVE_DETECTING' && currentStatus !== 'LIVE_DETECTING') {
      StateManager.setLiveStatus('LIVE_DETECTING');
    }
  }

  private _startObserver(): void {
    const debouncedCheck = debounce(() => this._check(), 1000);
    this.observer = new MutationObserver(debouncedCheck);

    if (document.body) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-status', 'aria-label'],
      });
    }
  }

  private _startUrlWatcher(): void {
    this.urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl) {
        Logger.info(MODULE, `Navegação detectada: ${currentUrl}`);
        this.lastUrl = currentUrl;
        setTimeout(() => this._check(), 1200);
      }
    }, 1000);
  }
}
