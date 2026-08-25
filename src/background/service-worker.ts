// ============================================================
// Auto Live Shop V2 — Background Service Worker
// ============================================================
import { COMMANDS, ALARMS, STORAGE_KEYS } from '@/shared/constants';
import { Logger } from '@/core/Logger';

const MODULE = 'ServiceWorker';

// ── Instalação ────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  Logger.info(MODULE, 'onInstalled:', reason);

  if (reason === 'install') {
    await chrome.storage.local.set({
      [STORAGE_KEYS.INITIALIZED]: false,
    });
    Logger.info(MODULE, 'Storage inicializado');
  }
});

// ── Message handler ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const { type } = msg;

  // ─ Agendar encerramento automático ──────────────────────
  if (type === COMMANDS.HEARTBEAT) {
    sendResponse({ ok: true, ts: Date.now() });
    return false;
  }

  // ─ Notificação Chrome ────────────────────────────────────
  if (type === 'ALS_NOTIFY') {
    const { title, message } = msg.payload as { title: string; message: string };
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: title || 'Auto Live Shop',
      message: message || '',
      priority: 1,
    });
    sendResponse({ ok: true });
    return false;
  }

  // ─ Schedule auto-close alarm ────────────────────────────
  if (type === 'ALS_SCHEDULE_CLOSE') {
    const { delayMs } = msg.payload as { delayMs: number };
    chrome.alarms.create(ALARMS.AUTO_CLOSE, { when: Date.now() + delayMs });
    sendResponse({ ok: true });
    return false;
  }

  // ─ Cancel alarm ─────────────────────────────────────────
  if (type === 'ALS_CANCEL_ALARM') {
    const { name } = msg.payload as { name: string };
    chrome.alarms.clear(name);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

// ── Alarm handler ─────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  Logger.info(MODULE, 'Alarm:', alarm.name);

  if (alarm.name === ALARMS.AUTO_CLOSE) {
    // Enviar para a aba ativa
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'ALS_AUTO_CLOSE_TRIGGERED' }).catch(() => {});
    }
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '⚠️ Auto Live Shop',
      message: 'Encerramento automático acionado!',
      priority: 2,
    });
  }
});

// ── Ação do ícone ─────────────────────────────────────────────
// Ao clicar no ícone da extensão, não há popup —
// o painel é injetado diretamente na página pelo content script
chrome.action.onClicked.addListener(async (tab) => {
  Logger.info(MODULE, 'Ícone clicado — tab:', tab.id);
  if (!tab.id) return;

  try {
    // Verificar se o painel está visível
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'ALS_PING' }).catch(() => null);
    if (!response) {
      // Tentar injetar content script manualmente (para páginas já abertas)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/bootstrap.js'],
      }).catch(err => Logger.warn(MODULE, 'Erro ao injetar script:', err));
    }
  } catch (err) {
    Logger.warn(MODULE, 'Erro ao comunicar com tab:', err);
  }
});

Logger.info(MODULE, '✅ Service Worker ativo');
