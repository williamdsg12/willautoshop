// ============================================================
// Auto Live Shop V2 — Automation Controller
// Gerencia fixação automática e renovação periódica com feedback em tempo real
// ============================================================

import { StateManager } from '@/core/StateManager';
import { EventBus } from '@/core/EventBus';
import { Logger } from '@/core/Logger';
import { ProductController } from './ProductController';
import { DEFAULTS } from '@/shared/constants';

const MODULE = 'AutomationController';

export class AutomationController {
  private repinTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private productCtrl = new ProductController();
  private lastActionTimestamp = 0;
  private nextActionTimestamp = 0;
  private executionCount = 0;
  private isProcessing = false;

  constructor() {
    EventBus.on('live:ended', () => {
      if (this.isRunning()) {
        Logger.info(MODULE, 'LIVE encerrada — desligando renovação automática de produto');
        this.stop();
        EventBus.emit('toast:show', {
          message: 'LIVE encerrada — renovação de produto desligada',
          type: 'info',
        });
      }
    });
  }

  /**
   * Inicia a automação de fixação para um produto específico.
   */
  start(productId: string, intervalSecs: number = DEFAULTS.REPIN_INTERVAL_SECS): boolean {
    if (!productId) {
      EventBus.emit('toast:show', {
        message: '⚠ Selecione um produto para iniciar a automação',
        type: 'warn',
      });
      return false;
    }

    this.stop();

    const intervalMs = Math.max(10, intervalSecs) * 1000;
    Logger.info(MODULE, `Iniciando automação: Produto ${productId}, Intervalo ${intervalSecs}s`);

    this.executionCount = 0;
    this.nextActionTimestamp = Date.now() + intervalMs;

    StateManager.patchLive({
      automationEnabled: true,
      automationProductId: productId,
      automationIntervalSecs: intervalSecs,
    });

    StateManager.patchSettings({
      automation: {
        enabled: true,
        selectedProductId: productId,
        renewalIntervalMs: intervalMs,
        cooldownMs: DEFAULTS.AUTO_COOLDOWN_MS,
        lastExecution: Date.now(),
        nextExecution: this.nextActionTimestamp,
        executionCount: 0,
        lastStatus: 'Ativo',
      },
    });

    EventBus.emit('automation:started', { productId, intervalSecs });
    EventBus.emit('toast:show', {
      message: `▶ Automação ativada (${intervalSecs}s)`,
      type: 'success',
    });

    // Fixa imediatamente na ativação
    this._executeRepin(productId);

    // Timer de ciclo principal
    this.repinTimer = setInterval(() => {
      this.nextActionTimestamp = Date.now() + intervalMs;
      this._executeRepin(productId);
    }, intervalMs);

    // Timer de contagem regressiva para a UI (1s)
    this.tickTimer = setInterval(() => {
      const remainingSecs = Math.max(0, Math.ceil((this.nextActionTimestamp - Date.now()) / 1000));
      EventBus.emit('automation:tick', { nextSecs: remainingSecs });
    }, 1000);

    return true;
  }

  /**
   * Encerra a automação.
   */
  stop(): void {
    if (this.repinTimer) {
      clearInterval(this.repinTimer);
      this.repinTimer = null;
    }

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    StateManager.patchLive({ automationEnabled: false });
    StateManager.patchSettings({
      automation: {
        ...StateManager.settings.automation,
        enabled: false,
        lastStatus: 'Parado',
      },
    });

    EventBus.emit('automation:stopped');
    Logger.info(MODULE, 'Automação parada com sucesso');
  }

  /**
   * Verifica se a automação está rodando.
   */
  isRunning(): boolean {
    return this.repinTimer !== null;
  }

  private async _executeRepin(productId: string): Promise<void> {
    if (this.isProcessing) return;

    const now = Date.now();
    if (now - this.lastActionTimestamp < DEFAULTS.AUTO_COOLDOWN_MS && this.executionCount > 0) {
      Logger.debug(MODULE, 'Cooldown ativo — aguardando próximo ciclo');
      return;
    }

    if (StateManager.live.status === 'LIVE_ENDED' || StateManager.live.status === 'LIVE_INACTIVE') {
      this.stop();
      return;
    }

    this.isProcessing = true;
    this.lastActionTimestamp = now;
    this.executionCount++;

    try {
      Logger.debug(MODULE, `[#${this.executionCount}] Renovando fixação do produto: ${productId}`);
      EventBus.emit('automation:repin', { productId });
      await this.productCtrl.pinProduct(productId);

      StateManager.patchSettings({
        automation: {
          ...StateManager.settings.automation,
          lastExecution: now,
          executionCount: this.executionCount,
          lastStatus: 'Sucesso',
        },
      });
    } catch (err) {
      Logger.error(MODULE, 'Erro durante renovação automática de produto:', err);
    } finally {
      this.isProcessing = false;
    }
  }
}
