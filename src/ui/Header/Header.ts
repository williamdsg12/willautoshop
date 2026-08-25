// ============================================================
// Copilo Live Shop V2 — Header Component
// Cabeçalho fixo com logo, status da LIVE e botões de controle
// ============================================================

import { APP_NAME } from '@/shared/constants';
import type { LiveStatus } from '@/shared/types';
import { EventBus } from '@/core/EventBus';

export class Header {
  private container: HTMLElement;
  private statusBadgeEl!: HTMLElement;
  private statusTextEl!: HTMLElement;

  constructor(
    container: HTMLElement,
    onMinimize: () => void,
    onClose: () => void,
  ) {
    this.container = container;
    this._render(onMinimize, onClose);
    this._subscribe();
  }

  private _render(onMinimize: () => void, onClose: () => void): void {
    this.container.innerHTML = `
      <div class="als-header-left">
        <div class="als-logo">▶</div>
        <div class="als-brand">
          <span class="als-brand-name">${APP_NAME.toUpperCase()}</span>
          <span class="als-brand-sub">Copiloto de Lives</span>
        </div>
      </div>
      <div class="als-header-right">
        <div class="als-live-badge detecting" id="als-status-badge">
          <span class="als-live-dot"></span>
          <span id="als-status-text">DETECTANDO</span>
        </div>
        <button class="als-icon-btn" id="als-btn-minimize" title="Minimizar">−</button>
        <button class="als-icon-btn" id="als-btn-close" title="Fechar">✕</button>
      </div>
    `;

    this.statusBadgeEl = this.container.querySelector('#als-status-badge')!;
    this.statusTextEl = this.container.querySelector('#als-status-text')!;

    this.container.querySelector('#als-btn-minimize')?.addEventListener('click', onMinimize);
    this.container.querySelector('#als-btn-close')?.addEventListener('click', onClose);
  }

  private _subscribe(): void {
    EventBus.on('live:status_changed', (status) => this.updateStatus(status));
  }

  updateStatus(status: LiveStatus): void {
    this.statusBadgeEl.className = 'als-live-badge';

    const map: Record<LiveStatus, { cls: string; label: string }> = {
      LIVE_DETECTING: { cls: 'detecting', label: 'DETECTANDO' },
      LIVE_ACTIVE:    { cls: 'active',    label: 'AO VIVO' },
      LIVE_INACTIVE:  { cls: 'inactive',  label: 'AGUARDANDO' },
      LIVE_ENDED:     { cls: 'ended',     label: 'ENCERRADA' },
      LIVE_ERROR:     { cls: 'error',     label: 'ERRO' },
    };

    const config = map[status] || map.LIVE_DETECTING;
    this.statusBadgeEl.classList.add(config.cls);
    this.statusTextEl.textContent = config.label;
  }
}
