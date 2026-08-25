// ============================================================
// Copilo Live Shop V2 — Panel Visibility Manager
// Controla minimização, visibilidade e fechamento do painel
// ============================================================

import { StorageManager } from '@/core/StorageManager';
import { StateManager } from '@/core/StateManager';
import { EventBus } from '@/core/EventBus';

export class PanelVisibilityManager {
  private panelEl: HTMLElement;
  private minimizeBtnEl?: HTMLElement;

  constructor(panelElement: HTMLElement, minimizeButton?: HTMLElement) {
    this.panelEl = panelElement;
    this.minimizeBtnEl = minimizeButton;
  }

  /**
   * Define o botão de minimizar após renderização.
   */
  setMinimizeButton(minimizeButton: HTMLElement): void {
    this.minimizeBtnEl = minimizeButton;
  }

  /**
   * Alterna estado minimizado do painel flutuante.
   */
  toggleMinimize(): boolean {
    const isMinimized = this.panelEl.classList.toggle('minimized');

    if (this.minimizeBtnEl) {
      this.minimizeBtnEl.textContent = isMinimized ? '+' : '−';
    }

    StateManager.patchPanel({ minimized: isMinimized });
    StorageManager.savePanelState({ minimized: isMinimized }).catch(() => {});

    if (isMinimized) {
      EventBus.emit('panel:minimized', true);
    } else {
      EventBus.emit('panel:restored');
    }

    return isMinimized;
  }

  /**
   * Oculta o painel.
   */
  close(): void {
    this.panelEl.classList.add('hidden');
    StateManager.patchPanel({ visible: false });
    StorageManager.savePanelState({ visible: false }).catch(() => {});
    EventBus.emit('panel:close');
  }

  /**
   * Torna o painel visível na tela.
   */
  show(): void {
    this.panelEl.classList.remove('hidden');
    StateManager.patchPanel({ visible: true });
    StorageManager.savePanelState({ visible: true }).catch(() => {});
  }

  /**
   * Retorna se o painel está visível.
   */
  isVisible(): boolean {
    return !this.panelEl.classList.contains('hidden');
  }

  /**
   * Retorna se o painel está minimizado.
   */
  isMinimized(): boolean {
    return this.panelEl.classList.contains('minimized');
  }
}
