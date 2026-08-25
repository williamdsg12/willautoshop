// ============================================================
// Auto Live Shop V2 — Live Heartbeat Service
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
    Logger.info(MODULE, `Heartbeat iniciado (${this.intervalSecs}s)`);
    this._tick();
    this.interval = setInterval(() => this._tick(), this.intervalSecs * 1000);
  }

  stop(): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    Logger.info(MODULE, 'Heartbeat parado');
  }

  private _tick(): void {
    StateManager.heartbeat();
    const isActive = tiktokAdapter.isLiveActive();
    const currentStatus = StateManager.live.status;

    if (!isActive && currentStatus === 'LIVE_ACTIVE') {
      Logger.info(MODULE, 'Live encerrada pelo heartbeat');
      StateManager.setLiveStatus('LIVE_ENDED');
    }

    if (isActive && currentStatus !== 'LIVE_ACTIVE') {
      StateManager.setLiveStatus('LIVE_ACTIVE');
    }

    // Atualizar métricas TikTok
    if (isActive) {
      const metrics = tiktokAdapter.getLiveMetrics();
      if (Object.keys(metrics).length > 1) {
        StateManager.updateMetrics(metrics);
      }
    }
  }
}

// ============================================================
// Auto Live Shop V2 — Audio Manager
// ============================================================
const AUDIO_MODULE = 'AudioManager';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = false;

  async unlock(): Promise<void> {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.enabled = true;
      Logger.info(AUDIO_MODULE, 'AudioContext desbloqueado');
    } catch (err) {
      Logger.warn(AUDIO_MODULE, 'Não foi possível desbloquear áudio:', err);
    }
  }

  async playSaleSound(): Promise<void> {
    if (!this.enabled || !this.ctx) return;
    try {
      // Tom sintético de "ding" (sem arquivo externo)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.5);
    } catch (err) {
      Logger.warn(AUDIO_MODULE, 'Erro ao tocar som:', err);
    }
  }

  setEnabled(val: boolean): void { this.enabled = val; }
  isEnabled(): boolean { return this.enabled; }
}

// ============================================================
// Auto Live Shop V2 — License Manager
// ============================================================
const LICENSE_MODULE = 'LicenseManager';

export type LicenseStatus = 'FREE' | 'PRO' | 'PREMIUM';

export class LicenseManager {
  private status: LicenseStatus = 'FREE';

  async validate(key: string): Promise<{ status: LicenseStatus; valid: boolean }> {
    // Fase 1: validação local mockada
    // Fase 2: implementar chamada ao backend próprio da Auto Live Shop
    if (key.startsWith('PRO-') && key.length >= 12) {
      this.status = 'PRO';
      Logger.info(LICENSE_MODULE, 'Licença PRO ativada (modo demo)');
      return { status: 'PRO', valid: true };
    }
    if (key.startsWith('PREMIUM-') && key.length >= 16) {
      this.status = 'PREMIUM';
      Logger.info(LICENSE_MODULE, 'Licença PREMIUM ativada (modo demo)');
      return { status: 'PREMIUM', valid: true };
    }
    this.status = 'FREE';
    return { status: 'FREE', valid: false };
  }

  getStatus(): LicenseStatus { return this.status; }

  hasFeature(feature: 'automation' | 'unlimited_messages' | 'analytics'): boolean {
    if (this.status === 'PREMIUM') return true;
    if (this.status === 'PRO') return feature !== 'analytics';
    return false;
  }
}
