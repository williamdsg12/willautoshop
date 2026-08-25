// ============================================================
// Auto Live Shop V2 — Content Script Bootstrap
// Entry point injetado em todas as páginas do TikTok
// ============================================================
import { PANEL_ROOT_ID, PANEL_FLAG } from '@/shared/constants';
import { isTikTokLivePage, sleep } from '@/shared/utils';
import { Logger } from '@/core/Logger';
import { StateManager } from '@/core/StateManager';
import { StorageManager } from '@/core/StorageManager';
import { MessageBus } from '@/core/MessageBus';
import { EventBus } from '@/core/EventBus';
import { LiveDetector } from '@/detectors/LiveDetector';
import { SalesDetector } from '@/detectors/SalesDetector';
import { FloatingPanel } from '@/ui/FloatingPanel/FloatingPanel';
import { LiveHeartbeatService } from '@/services/index';

const MODULE = 'Bootstrap';

// ─────────────────────────────────────────────────────────────
// Anti-duplicação: garantir que só um painel exista
// ─────────────────────────────────────────────────────────────
declare global {
  interface Window {
    __AUTO_LIVE_SHOP_INITIALIZED__?: boolean;
  }
}

if (window.__AUTO_LIVE_SHOP_INITIALIZED__) {
  Logger.warn(MODULE, 'Já inicializado — ignorando');
} else {
  window.__AUTO_LIVE_SHOP_INITIALIZED__ = true;
  init();
}

// ─────────────────────────────────────────────────────────────
// Inicialização principal
// ─────────────────────────────────────────────────────────────
async function init() {
  Logger.info(MODULE, '🚀 Auto Live Shop V2 inicializando...');
  Logger.info(MODULE, 'URL:', window.location.href);

  // Hidratar estado do storage
  const [panelState, settings] = await Promise.all([
    StorageManager.getPanelState(),
    StorageManager.getSettings(),
  ]);
  StateManager.hydrate({ panel: panelState, settings });

  // Marcar como inicializado no storage
  await StorageManager.setInitialized();

  // Configurar MessageBus
  setupMessageBus();

  // Verificar se é página de live
  if (!isTikTokLivePage()) {
    Logger.info(MODULE, 'Não é página de live — monitorando navegação...');
    watchForLivePage();
    return;
  }

  await startLiveSession();
}

// ─────────────────────────────────────────────────────────────
// Sessão de live
// ─────────────────────────────────────────────────────────────
let panel: FloatingPanel | null = null;
let liveDetector: LiveDetector | null = null;
let salesDetector: SalesDetector | null = null;
let heartbeat: LiveHeartbeatService | null = null;

async function startLiveSession() {
  Logger.info(MODULE, '🔴 Iniciando sessão de live...');

  // Aguardar DOM carregar completamente
  if (document.readyState !== 'complete') {
    await new Promise(r => window.addEventListener('load', r, { once: true }));
  }
  await sleep(1500); // Aguarda SPA renderizar

  // Verificar se já existe painel
  if (document.getElementById(PANEL_ROOT_ID)) {
    Logger.warn(MODULE, 'Painel já existe no DOM — ignorando');
    return;
  }

  // Montar painel flutuante
  panel = new FloatingPanel();
  await panel.mount();

  // Iniciar detectores
  liveDetector = new LiveDetector();
  liveDetector.start();

  salesDetector = new SalesDetector();
  salesDetector.start();

  // Iniciar heartbeat
  heartbeat = new LiveHeartbeatService(10);
  heartbeat.start();

  // Parar automações quando live encerrar
  EventBus.on('live:ended', () => {
    Logger.info(MODULE, 'Live encerrada — parando serviços');
    heartbeat?.stop();
    salesDetector?.stop();
  });

  Logger.info(MODULE, '✅ Sessão de live ativa');
}

// ─────────────────────────────────────────────────────────────
// Watcher de navegação SPA
// ─────────────────────────────────────────────────────────────
function watchForLivePage() {
  let lastUrl = window.location.href;
  const interval = setInterval(async () => {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;
    Logger.info(MODULE, 'SPA navigation:', currentUrl);

    if (isTikTokLivePage(currentUrl) && !document.getElementById(PANEL_ROOT_ID)) {
      clearInterval(interval);
      await startLiveSession();
    }
  }, 1000);
}

// ─────────────────────────────────────────────────────────────
// MessageBus handlers (recebe comandos do background)
// ─────────────────────────────────────────────────────────────
function setupMessageBus() {
  MessageBus.listen();

  MessageBus.on('ALS_PING', () => ({
    ok: true,
    url: window.location.href,
    isLivePage: isTikTokLivePage(),
    liveStatus: StateManager.live.status,
  }));

  MessageBus.on('ALS_GET_STATE', () => ({
    live: StateManager.live,
    panel: StateManager.panel,
  }));

  MessageBus.on('ALS_HEARTBEAT', () => {
    StateManager.heartbeat();
    return { ok: true };
  });
}
