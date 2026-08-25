// ============================================================
// Copilo Live Shop V2 — Main World Injector
// Injeta o live-remote-controller no MAIN WORLD da página
// ============================================================

import { Logger } from '@/core/Logger';

const MODULE = 'MainWorldInjector';

export class MainWorldInjector {
  private static isInjected = false;

  /**
   * Injeta o script do controlador no contexto MAIN WORLD da página.
   */
  static inject(): void {
    if (this.isInjected) return;
    this.isInjected = true;

    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('main-world/controller.js');
      script.id = 'copilo-live-main-world';
      script.async = false;

      (document.head || document.documentElement).appendChild(script);

      script.onload = () => {
        Logger.info(MODULE, '✅ Controlador do MAIN WORLD carregado com sucesso.');
        script.remove(); // Remove a tag script mantendo a execução no window
      };

      script.onerror = (err) => {
        Logger.warn(MODULE, 'Falha ao carregar script do MAIN WORLD:', err);
      };
    } catch (err) {
      Logger.warn(MODULE, 'Erro ao criar elemento de injeção:', err);
    }
  }
}
