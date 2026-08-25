// ============================================================
// Copilo Live Shop V2 — Panel Injector
// Injeta e gerencia o ciclo de vida do painel flutuante no DOM
// ============================================================

import { PANEL_ROOT_ID, PANEL_FLAG } from '@/shared/constants';
import { FloatingPanel } from '@/ui/FloatingPanel/FloatingPanel';
import { Logger } from '@/core/Logger';

const MODULE = 'PanelInjector';

export class PanelInjector {
  private activePanel: FloatingPanel | null = null;

  /**
   * Garante que apenas uma instância do painel flutuante seja injetada.
   */
  async inject(): Promise<FloatingPanel | null> {
    if (this.isAlreadyInjected()) {
      Logger.warn(MODULE, 'Painel já existente no DOM — injeção cancelada');
      return this.activePanel;
    }

    try {
      this.activePanel = new FloatingPanel();
      await this.activePanel.mount();
      Logger.info(MODULE, 'Painel injetado com sucesso no DOM');
      return this.activePanel;
    } catch (err) {
      Logger.error(MODULE, 'Erro fatal durante a injeção do painel:', err);
      return null;
    }
  }

  /**
   * Remove o painel do DOM caso exista.
   */
  destroy(): void {
    if (this.activePanel) {
      this.activePanel.unmount();
      this.activePanel = null;
    }
    const root = document.getElementById(PANEL_ROOT_ID);
    root?.remove();
  }

  /**
   * Verifica se o elemento root já está anexado ao documento.
   */
  isAlreadyInjected(): boolean {
    return !!document.getElementById(PANEL_ROOT_ID);
  }
}
