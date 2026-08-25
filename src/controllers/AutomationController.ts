// ============================================================
// Copilo Live Shop V2 — Automation Controller
// Gerencia fixação automática e renovação periódica de produtos
// ============================================================

import { StateManager } from '@/core/StateManager';
import { EventBus } from '@/core/EventBus';
import { Logger } from '@/core/Logger';
import { ProductController } from './ProductController';
import { DEFAULTS } from '@/shared/constants';

const MODULE = 'AutomationController';

export class AutomationController {
  private repinTimer: ReturnType<typeof setInterval> | null = null;
  private productCtrl = new ProductController();
  private lastActionTimestamp = 0;
  private isProcessing = false;

  constructor() {
    // Para automações caso a LIVE seja finalizada
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

    if (StateManager.live.status !== 'LIVE_ACTIVE') {
      Logger.warn(MODULE, 'Tentativa de iniciar automação sem LIVE ativa');
    }

    this.stop();

    const intervalMs = Math.max(10, intervalSecs) * 1000;
    Logger.info(MODULE, `Iniciando automação: Produto ${productId}, Intervalo ${intervalSecs}s`);

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
      },
    });

    EventBus.emit('automation:started', { productId, intervalSecs });
    EventBus.emit('toast:show', {
      message: `▶ Automação ativada (${intervalSecs}s)`,
      type: 'success',
    });

    // Fixa imediatamente no início
    this._executeRepin(productId);

    this.repinTimer = setInterval(() => {
      this._executeRepin(productId);
    }, intervalMs);

    return true;
  }

  /**
   * Encerra o timer de automação.
   */
  stop(): void {
    if (this.repinTimer) {
      clearInterval(this.repinTimer);
      this.repinTimer = null;
    }

    StateManager.patchLive({ automationEnabled: false });
    StateManager.patchSettings({
      automation: {
        ...StateManager.settings.automation,
        enabled: false,
      },
    });

    EventBus.emit('automation:stopped');
    Logger.info(MODULE, 'Automação parada');
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
    if (now - this.lastActionTimestamp < DEFAULTS.AUTO_COOLDOWN_MS) {
      Logger.debug(MODULE, 'Cooldown ativo — ignorando ciclo de renovação');
      return;
    }

    if (StateManager.live.status === 'LIVE_ENDED' || StateManager.live.status === 'LIVE_INACTIVE') {
      this.stop();
      return;
    }

    this.isProcessing = true;
    this.lastActionTimestamp = now;

    try {
      Logger.debug(MODULE, `Executando renovação de fixação para produto: ${productId}`);
      EventBus.emit('automation:repin', { productId });
      await this.productCtrl.pinProduct(productId);
    } catch (err) {
      Logger.error(MODULE, 'Erro durante renovação automática de produto:', err);
    } finally {
      this.isProcessing = false;
    }
  }
}
