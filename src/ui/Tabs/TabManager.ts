// ============================================================
// Copilo Live Shop V2 — Tab Manager
// Gerencia a navegação entre abas sem recriar estado ou DOM
// ============================================================

import { EventBus } from '@/core/EventBus';

export class TabManager {
  private navContainer: HTMLElement;
  private contentContainer: HTMLElement;
  private currentTab = 'painel';

  constructor(navContainer: HTMLElement, contentContainer: HTMLElement) {
    this.navContainer = navContainer;
    this.contentContainer = contentContainer;
    this._bindEvents();
  }

  private _bindEvents(): void {
    const buttons = this.navContainer.querySelectorAll<HTMLButtonElement>('.als-tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset['tab'];
        if (tab) {
          this.switchTab(tab);
        }
      });
    });
  }

  switchTab(tabId: string): void {
    this.currentTab = tabId;

    // Atualiza botões
    const buttons = this.navContainer.querySelectorAll<HTMLButtonElement>('.als-tab-btn');
    buttons.forEach(b => {
      b.classList.toggle('active', b.dataset['tab'] === tabId);
    });

    // Atualiza painéis de conteúdo
    const panes = this.contentContainer.querySelectorAll<HTMLElement>('.als-pane');
    panes.forEach(p => {
      p.classList.toggle('active', p.id === `als-pane-${tabId}`);
    });

    EventBus.emit('panel:tab_changed', tabId);
  }

  getActiveTab(): string {
    return this.currentTab;
  }
}
