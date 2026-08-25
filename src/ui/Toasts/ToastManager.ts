// ============================================================
// Copilo Live Shop V2 — Toast Manager
// Sistema visual de notificações e alertas in-panel
// ============================================================

import { DEFAULTS } from '@/shared/constants';
import type { ToastPayload, ToastType } from '@/shared/types';
import { EventBus } from '@/core/EventBus';

export class ToastManager {
  private container: HTMLElement;

  constructor(containerElement: HTMLElement) {
    this.container = containerElement;
    this._subscribe();
  }

  private _subscribe(): void {
    EventBus.on('toast:show', (payload: ToastPayload) => {
      this.show(payload.message, payload.type, payload.duration);
    });
  }

  /**
   * Exibe um toast visual no painel.
   */
  show(
    message: string,
    type: ToastType = 'info',
    duration: number = DEFAULTS.TOAST_DURATION_MS,
  ): void {
    const toast = document.createElement('div');
    toast.className = `als-toast ${type}`;
    toast.textContent = message;

    this.container.appendChild(toast);

    // Limita quantidade simultânea
    while (this.container.children.length > DEFAULTS.MAX_TOASTS) {
      this.container.firstChild?.remove();
    }

    setTimeout(() => {
      toast.style.animation = 'als-toastOut 0.25s ease forwards';
      setTimeout(() => toast.remove(), 260);
    }, duration);
  }
}
