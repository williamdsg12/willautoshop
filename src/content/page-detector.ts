// ============================================================
// Copilo Live Shop V2 — Page Detector
// Detecta páginas do TikTok Shop, estúdio de live e rotas SPA
// ============================================================

import { isTikTokShopUrl, getCurrentRoute } from '@/shared/utils';
import { Logger } from '@/core/Logger';

const MODULE = 'PageDetector';

export class PageDetector {
  private lastRoute = '';

  /**
   * Verifica se a página atual é elegível para execução da extensão.
   */
  isTargetPage(): boolean {
    return isTikTokShopUrl();
  }

  /**
   * Monitora alterações de navegação interna (SPA) sem recarregamento de página.
   */
  watchNavigation(onNavigate: (route: string) => void): () => void {
    this.lastRoute = getCurrentRoute();

    const interval = setInterval(() => {
      const currentRoute = getCurrentRoute();
      if (currentRoute !== this.lastRoute) {
        Logger.info(MODULE, `Navegação detectada: ${currentRoute}`);
        this.lastRoute = currentRoute;
        onNavigate(currentRoute);
      }
    }, 1000);

    return () => clearInterval(interval);
  }
}
