// ============================================================
// Auto Live Shop V2 — Background Service Worker
// Entry point de segundo plano para Manifest V3
// ============================================================

import { COMMANDS, STORAGE_KEYS, APP_NAME, TIKTOK_LIVE_URLS } from '@/shared/constants';
import { Logger } from '@/core/Logger';
import { LiveBackgroundService } from './LiveBackgroundService';

const MODULE = 'ServiceWorker';
const liveBgService = new LiveBackgroundService();

// Inicializa serviços de background
liveBgService.init();

// ── Instalação e Atualização ──────────────────────────────────
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  Logger.info(MODULE, `Extensão ${APP_NAME} instalada/atualizada [Razão: ${reason}]`);

  if (reason === 'install') {
    await chrome.storage.local.set({
      [STORAGE_KEYS.INITIALIZED]: false,
    });
    Logger.info(MODULE, 'Storage inicializado para primeiro uso');
  }
});

// ── Roteador Central de Mensagens ─────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  const { type, payload } = msg;

  switch (type) {
    case COMMANDS.HEARTBEAT:
    case 'ALS_HEARTBEAT':
      sendResponse({ ok: true, timestamp: Date.now() });
      return false;

    case 'ALS_NOTIFY': {
      const data = payload as { title?: string; message?: string; priority?: number };
      liveBgService.sendNotification(
        data.title || APP_NAME,
        data.message || '',
        data.priority || 1,
      );
      sendResponse({ ok: true });
      return false;
    }

    case 'ALS_SCHEDULE_CLOSE': {
      const { delayMs } = (payload || {}) as { delayMs?: number };
      if (delayMs && delayMs > 0) {
        liveBgService.scheduleAutoClose(delayMs);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'Intervalo inválido' });
      }
      return false;
    }

    case 'ALS_CANCEL_ALARM': {
      const { name } = (payload || {}) as { name?: string };
      if (name) {
        liveBgService.cancelAlarm(name);
        sendResponse({ ok: true });
      }
      return false;
    }

    default:
      return false;
  }
});

// ── Clique no Ícone da Extensão ───────────────────────────────
// Alterna visibilidade ou injeta o painel flutuante na aba ativa
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const currentUrl = tab.url || '';
  Logger.info(MODULE, `Ação disparada pelo ícone na aba ${tab.id} [URL: ${currentUrl}]`);

  const isTikTokShop = TIKTOK_LIVE_URLS.some((target) => currentUrl.includes(target));

  if (!isTikTokShop) {
    liveBgService.sendNotification(
      APP_NAME,
      'Abra uma transmissão ou painel do TikTok Shop (shop.tiktok.com/streamer) para utilizar o Copiloto de Lives.',
      2,
    );
    return;
  }

  try {
    // 1. Tenta enviar comando TOGGLE_PANEL para o content script existente
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_PANEL',
      timestamp: Date.now(),
    }).catch(() => null);

    // 2. Se o content script ainda não estiver ativo na página, faz a injeção sob demanda
    if (!response) {
      Logger.info(MODULE, 'Content script não respondeu — injetando bootstrap na página...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/bootstrap.js'],
      });
    }
  } catch (err) {
    Logger.warn(MODULE, 'Erro ao acionar painel na aba ativa:', err);
  }
});

Logger.info(MODULE, `✅ Service Worker do ${APP_NAME} ativo`);
