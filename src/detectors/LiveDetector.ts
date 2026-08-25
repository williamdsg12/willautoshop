// ============================================================
// Auto Live Shop V2 — Live Detector
// Detecta mudanças de estado da live via DOM + URL
// ============================================================
import { EventBus } from '@/core/EventBus';
import { StateManager } from '@/core/StateManager';
import { Logger } from '@/core/Logger';
import { tiktokAdapter } from '@/adapters/tiktok-shop/TikTokShopAdapter';
import { debounce } from '@/shared/utils';

const MODULE = 'LiveDetector';

export class LiveDetector {
  private observer: MutationObserver | null = null;
  private urlCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastUrl = '';

  start(): void {
    Logger.info(MODULE, 'Iniciando...');
    this.lastUrl = window.location.href;
    this._check();
    this._startObserver();
    this._startUrlWatcher();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.urlCheckInterval) clearInterval(this.urlCheckInterval);
    this.urlCheckInterval = null;
    Logger.info(MODULE, 'Parado');
  }

  private _check(): void {
    const isActive = tiktokAdapter.isLiveActive();
    const currentStatus = StateManager.live.status;

    if (isActive && currentStatus !== 'LIVE_ACTIVE') {
      StateManager.setLiveStatus('LIVE_ACTIVE');
      Logger.info(MODULE, '🔴 LIVE ATIVA detectada');
    } else if (!isActive && currentStatus === 'LIVE_ACTIVE') {
      StateManager.setLiveStatus('LIVE_ENDED');
      Logger.info(MODULE, '⬛ Live encerrada');
    } else if (!isActive && currentStatus === 'LIVE_DETECTING') {
      Logger.debug(MODULE, 'Aguardando live...');
    }
  }

  private _startObserver(): void {
    const debouncedCheck = debounce(() => this._check(), 1000);
    this.observer = new MutationObserver(debouncedCheck);
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-status'],
    });
  }

  private _startUrlWatcher(): void {
    // Detecta SPA navigation (sem reload)
    this.urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl) {
        Logger.info(MODULE, 'Navegação SPA detectada:', currentUrl);
        this.lastUrl = currentUrl;
        setTimeout(() => this._check(), 1500); // Aguarda DOM estabilizar
      }
    }, 1000);
  }
}
