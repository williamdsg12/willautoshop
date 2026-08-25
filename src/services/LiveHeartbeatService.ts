// ============================================================
// Copilo Live Shop V2 — Live Heartbeat Service
// Monitora a saúde e persistência da LIVE em tempo real
// ============================================================

import { StateManager } from '@/core/StateManager';
import { Logger } from '@/core/Logger';
import { tiktokAdapter } from '@/adapters/tiktok-shop/TikTokShopAdapter';
import { DEFAULTS } from '@/shared/constants';

const MODULE = 'LiveHeartbeatService';

export class LiveHeartbeatService {
  private interval: ReturnType<typeof setInterval> | null = null;
  private intervalSecs: number;

  constructor(intervalSecs = DEFAULTS.HEARTBEAT_INTERVAL) {
    this.intervalSecs = intervalSecs;
  }

  start(): void {
    if (this.interval) return;
    Logger.info(MODULE, `Heartbeat iniciado (a cada ${this.intervalSecs}s)`);
    this._tick();
    this.interval = setInterval(() => this._tick(), this.intervalSecs * 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    Logger.info(MODULE, 'Heartbeat finalizado');
  }

  private _tick(): void {
    StateManager.heartbeat();
    const isActive = tiktokAdapter.isLiveActive();
    const currentStatus = StateManager.live.status;

    if (!isActive && currentStatus === 'LIVE_ACTIVE') {
      Logger.info(MODULE, 'Transmissão encerrada detectada pelo heartbeat');
      StateManager.setLiveStatus('LIVE_ENDED');
    }

    if (isActive && currentStatus !== 'LIVE_ACTIVE') {
      StateManager.setLiveStatus('LIVE_ACTIVE');
    }

    // Atualiza métricas reais se estiver ao vivo
    if (isActive) {
      const metrics = tiktokAdapter.getLiveMetrics();
      if (Object.keys(metrics).length > 1) {
        StateManager.updateMetrics(metrics);
      }
    }
  }
}
