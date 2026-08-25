// ============================================================
// Copilo Live Shop V2 — Content Script Bootstrap
// Ponto de entrada injetado em páginas do TikTok Shop
// ============================================================

import { PANEL_FLAG, APP_NAME } from '@/shared/constants';
import { sleep } from '@/shared/utils';
import { Logger } from '@/core/Logger';
import { StateManager } from '@/core/StateManager';
import { StorageManager } from '@/core/StorageManager';
import { MessageBus } from '@/core/MessageBus';
import { EventBus } from '@/core/EventBus';

// Detectores e Injetores
import { PageDetector } from './page-detector';
import { PanelInjector } from './panel-injector';
import { LiveDetector } from '@/detectors/LiveDetector';
import { SalesDetector } from '@/detectors/SalesDetector';
import { ProductDetector } from '@/detectors/ProductDetector';
import { MetricsDetector } from '@/detectors/MetricsDetector';
import { LiveHeartbeatService } from '@/services/LiveHeartbeatService';

const MODULE = 'Bootstrap';

// ─────────────────────────────────────────────────────────────
// Proteção contra duplicação de execução de scripts
// ─────────────────────────────────────────────────────────────
declare global {
  interface Window {
    __AUTO_LIVE_SHOP_INITIALIZED__?: boolean;
  }
}

if (window.__AUTO_LIVE_SHOP_INITIALIZED__) {
  Logger.warn(MODULE, `${APP_NAME} já inicializado nesta página — cancelando execução redundante`);
} else {
  window.__AUTO_LIVE_SHOP_INITIALIZED__ = true;
  startBootstrap();
}

// ─────────────────────────────────────────────────────────────
// Fluxo de Inicialização
// ─────────────────────────────────────────────────────────────
async function startBootstrap(): Promise<void> {
  Logger.info(MODULE, `🚀 Inicializando ${APP_NAME}...`);
  Logger.info(MODULE, `URL atual: ${window.location.href}`);

  const pageDetector = new PageDetector();
  const panelInjector = new PanelInjector();

  // 1. Hidrata o estado a partir do Storage
  const [panelState, settings, license] = await Promise.all([
    StorageManager.getPanelState(),
    StorageManager.getSettings(),
    StorageManager.getLicense(),
  ]);

  StateManager.hydrate({
    panel: panelState,
    settings,
    license,
  });

  await StorageManager.setInitialized();

  // 2. Configura o barramento de mensagens entre content e background
  setupMessageBus(panelInjector);

  // 3. Se não for página de TikTok Shop, apenas observa navegações
  if (!pageDetector.isTargetPage()) {
    Logger.info(MODULE, 'Página não elegível para inicialização imediata — aguardando navegação...');
    const unwatch = pageDetector.watchNavigation(async () => {
      if (pageDetector.isTargetPage()) {
        unwatch();
        await initializeSession(panelInjector);
      }
    });
    return;
  }

  // 4. Inicializa a sessão completa
  await initializeSession(panelInjector);

  // 5. Monitora navegação SPA permanente
  pageDetector.watchNavigation(async () => {
    if (pageDetector.isTargetPage() && !panelInjector.isAlreadyInjected()) {
      await initializeSession(panelInjector);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Inicialização dos Serviços e Painel da Sessão
// ─────────────────────────────────────────────────────────────
let liveDetector: LiveDetector | null = null;
let salesDetector: SalesDetector | null = null;
let productDetector: ProductDetector | null = null;
let metricsDetector: MetricsDetector | null = null;
let heartbeatService: LiveHeartbeatService | null = null;

async function initializeSession(injector: PanelInjector): Promise<void> {
  Logger.info(MODULE, '🔴 Inicializando sessão e detectores...');

  // Aguarda body estar disponível no DOM
  if (!document.body && document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
      setTimeout(resolve, 1000);
    });
  }
  await sleep(600);

  // 1. Injeta o painel flutuante
  await injector.inject();

  // 2. Inicializa os detectores de DOM
  liveDetector = new LiveDetector();
  liveDetector.start();

  salesDetector = new SalesDetector();
  salesDetector.start();

  productDetector = new ProductDetector();
  productDetector.start();

  metricsDetector = new MetricsDetector();
  metricsDetector.start();

  // 3. Inicializa serviço de heartbeat
  heartbeatService = new LiveHeartbeatService(10);
  heartbeatService.start();

  // 4. Cleanup ao encerrar live
  EventBus.on('live:ended', () => {
    Logger.info(MODULE, 'Sessão finalizada pelo evento live:ended');
  });

  Logger.info(MODULE, `✅ Sessão do ${APP_NAME} ativa e monitorando`);
}

// ─────────────────────────────────────────────────────────────
// MessageBus Handlers
// ─────────────────────────────────────────────────────────────
function setupMessageBus(injector: PanelInjector): void {
  MessageBus.listen();

  MessageBus.on('ALS_PING', () => ({
    ok: true,
    name: APP_NAME,
    url: window.location.href,
    status: StateManager.live.status,
    isInjected: injector.isAlreadyInjected(),
  }));

  MessageBus.on('ALS_GET_STATE', () => ({
    state: StateManager.getState(),
  }));

  MessageBus.on('ALS_HEARTBEAT', () => {
    StateManager.heartbeat();
    return { ok: true, timestamp: Date.now() };
  });
}
