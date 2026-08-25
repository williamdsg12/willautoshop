// ============================================================
// Copilo Live Shop V2 — Panel Position Manager
// Gerencia dimensões, posicionamento e persistência do painel flutuante
// ============================================================

import { StorageManager } from '@/core/StorageManager';
import { StateManager } from '@/core/StateManager';
import { PANEL_DEFAULTS } from '@/shared/constants';
import { clamp } from '@/shared/utils';
import type { PanelPosition, PanelSize } from '@/shared/types';

export class PanelPositionManager {
  private panelEl: HTMLElement;

  constructor(panelElement: HTMLElement) {
    this.panelEl = panelElement;
  }

  /**
   * Aplica a posição na tela respeitando os limites da viewport.
   */
  setPosition(x: number, y: number): void {
    const maxX = Math.max(0, window.innerWidth - 100);
    const maxY = Math.max(0, window.innerHeight - 48);

    const clampedX = clamp(x, 0, maxX);
    const clampedY = clamp(y, 0, maxY);

    this.panelEl.style.setProperty('--als-x', `${clampedX}px`);
    this.panelEl.style.setProperty('--als-y', `${clampedY}px`);

    StateManager.patchPanel({
      position: { x: clampedX, y: clampedY },
      x: clampedX,
      y: clampedY,
    });
  }

  /**
   * Salva a posição atual no storage.
   */
  async savePosition(): Promise<void> {
    const x = parseFloat(this.panelEl.style.getPropertyValue('--als-x')) || PANEL_DEFAULTS.DEFAULT_X;
    const y = parseFloat(this.panelEl.style.getPropertyValue('--als-y')) || PANEL_DEFAULTS.DEFAULT_Y;

    await StorageManager.savePanelState({
      position: { x, y },
      x,
      y,
    });
  }

  /**
   * Redefine as coordenadas para o padrão.
   */
  async resetPosition(): Promise<void> {
    this.setPosition(PANEL_DEFAULTS.DEFAULT_X, PANEL_DEFAULTS.DEFAULT_Y);
    await this.savePosition();
  }

  /**
   * Redefine a largura e altura para os padrões.
   */
  async resetSize(): Promise<void> {
    this.panelEl.style.setProperty('--als-w', `${PANEL_DEFAULTS.WIDTH}px`);
    this.panelEl.style.setProperty('--als-h', `${PANEL_DEFAULTS.HEIGHT}px`);

    StateManager.patchPanel({
      size: { width: PANEL_DEFAULTS.WIDTH, height: PANEL_DEFAULTS.HEIGHT },
      width: PANEL_DEFAULTS.WIDTH,
      height: PANEL_DEFAULTS.HEIGHT,
    });

    await StorageManager.savePanelState({
      size: { width: PANEL_DEFAULTS.WIDTH, height: PANEL_DEFAULTS.HEIGHT },
      width: PANEL_DEFAULTS.WIDTH,
      height: PANEL_DEFAULTS.HEIGHT,
    });
  }
}
