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
  Logger.warn(MODULE, `${APP_NAME} já inicializado nesta aba — cancelando execução redundante`);
} else {
  window.__AUTO_LIVE_SHOP_INITIALIZED__ = true;
  startBootstrap().catch((err) => {
    Logger.error(MODULE, 'Exceção não tratada no startBootstrap:', err);
  });
}

// ─────────────────────────────────────────────────────────────
// Fluxo de Inicialização
// ─────────────────────────────────────────────────────────────
async function startBootstrap(): Promise<void> {
  Logger.info(MODULE, `🚀 [INÍCIO] Inicializando ${APP_NAME}...`);
  Logger.info(MODULE, `URL detectada: ${window.location.href}`);

  const pageDetector = new PageDetector();
  const panelInjector = new PanelInjector();

  try {
    // 1. Hidrata o estado a partir do Storage
    const [panelState, settings, license] = await Promise.all([
      StorageManager.getPanelState().catch(() => ({})),
      StorageManager.getSettings().catch(() => ({})),
      StorageManager.getLicense().catch(() => ({})),
    ]);

    StateManager.hydrate({
      panel: panelState,
      settings,
      license,
    });

    await StorageManager.setInitialized().catch(() => {});
    Logger.info(MODULE, 'Estado central e storage sincronizados com sucesso.');
  } catch (err) {
    Logger.warn(MODULE, 'Aviso durante hidratação do storage (utilizando valores padrão):', err);
  }

  // 2. Configura o barramento de mensagens entre content e background
  try {
    setupMessageBus(panelInjector);
  } catch (err) {
    Logger.warn(MODULE, 'Aviso ao configurar MessageBus:', err);
  }

  // 3. Se não for página de TikTok Shop, apenas observa navegações
  const isTarget = pageDetector.isTargetPage();
  Logger.info(MODULE, `Página alvo detectada? ${isTarget ? 'SIM (iniciando montagem)' : 'NÃO (aguardando navegação SPA)'}`);

  if (!isTarget) {
    const unwatch = pageDetector.watchNavigation(async () => {
      if (pageDetector.isTargetPage() && !panelInjector.isAlreadyInjected()) {
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
      Logger.info(MODULE, 'Nova rota do TikTok Shop detectada via SPA — montando painel...');
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
  Logger.info(MODULE, '🔴 [ETAPA 1/3] Verificando disponibilidade do DOM...');

  // Aguarda body estar disponível no DOM
  if (!document.body && document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
      setTimeout(resolve, 1000);
    });
  }
  await sleep(400);

  // 1. Injeta o painel flutuante
  Logger.info(MODULE, '🔴 [ETAPA 2/3] Injetando painel flutuante via Shadow DOM...');
  try {
    const mounted = await injector.inject();
    if (mounted) {
      Logger.info(MODULE, '✅ [ETAPA 2/3] Painel flutuante anexado ao DOM com sucesso.');
    } else {
      Logger.warn(MODULE, '⚠️ [ETAPA 2/3] Injetor retornou nulo (painel já existia ou falhou).');
    }
  } catch (err) {
    Logger.error(MODULE, '❌ Erro crítico ao injetar painel:', err);
  }

  // 2. Inicializa os detectores de DOM
  Logger.info(MODULE, '🔴 [ETAPA 3/3] Iniciando detectores de LIVE, vitrine e métricas...');
  try {
    if (!liveDetector) {
      liveDetector = new LiveDetector();
      liveDetector.start();
    }

    if (!salesDetector) {
      salesDetector = new SalesDetector();
      salesDetector.start();
    }

    if (!productDetector) {
      productDetector = new ProductDetector();
      productDetector.start();
    }

    if (!metricsDetector) {
      metricsDetector = new MetricsDetector();
      metricsDetector.start();
    }

    if (!heartbeatService) {
      heartbeatService = new LiveHeartbeatService(10);
      heartbeatService.start();
    }
  } catch (err) {
    Logger.error(MODULE, 'Erro ao inicializar detectores de sessão:', err);
  }

  // 4. Cleanup ao encerrar live
  EventBus.on('live:ended', () => {
    Logger.info(MODULE, 'Sessão finalizada pelo evento live:ended');
  });

  Logger.info(MODULE, `🚀 ✅ Inicialização concluída com sucesso! ${APP_NAME} pronto.`);
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
