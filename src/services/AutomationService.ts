// ============================================================
// Copilo Live Shop V2 — Automation Service
// Engine de automação para renovação de produtos e tarefas periódicas
// ============================================================

import { AutomationController } from '@/controllers/AutomationController';
import { StateManager } from '@/core/StateManager';
import { Logger } from '@/core/Logger';

const MODULE = 'AutomationService';

export class AutomationService {
  private controller = new AutomationController();

  /**
   * Inicia o ciclo de renovação automática do produto selecionado.
   */
  startProductRenewal(productId: string, intervalSecs: number): boolean {
    Logger.info(MODULE, `Iniciando serviço de renovação para produto "${productId}"`);
    return this.controller.start(productId, intervalSecs);
  }

  /**
   * Para imediatamente o ciclo de automação.
   */
  stopProductRenewal(): void {
    Logger.info(MODULE, 'Interrompendo serviço de renovação');
    this.controller.stop();
  }

  /**
   * Retorna se a automação está ativa.
   */
  isAutoPinActive(): boolean {
    return this.controller.isRunning();
  }

  /**
   * Obtém as configurações atuais de automação.
   */
  getSettings() {
    return StateManager.settings.automation;
  }
}
