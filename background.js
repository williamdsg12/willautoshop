// ============================================================
// AutoLiveShop — Background Service Worker
// ============================================================

// ── Side Panel: abrir ao clicar no ícone da extensão ─────────
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ── Estado em memória (complementa chrome.storage) ──────────
let liveTabsState = {}; // tabId → { liveStartTime, automationsActive }

// ── Mensagem handler ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const { action } = msg;

  // ---- Iniciar cronômetro da live ----
  if (action === 'START_LIVE_TIMER') {
    const startTime = msg.startTime || Date.now();
    chrome.storage.local.set({ liveStartTime: startTime });
    sendResponse({ ok: true, startTime });
  }

  // ---- Parar cronômetro da live ----
  if (action === 'STOP_LIVE_TIMER') {
    chrome.storage.local.remove('liveStartTime');
    sendResponse({ ok: true });
  }

  // ---- Agendar encerramento automático ----
  if (action === 'SCHEDULE_AUTO_CLOSE') {
    const { delayMs } = msg;
    chrome.alarms.create('autoCloseLive', { when: Date.now() + delayMs });
    sendResponse({ ok: true });
  }

  // ---- Cancelar encerramento automático ----
  if (action === 'CANCEL_AUTO_CLOSE') {
    chrome.alarms.clear('autoCloseLive');
    sendResponse({ ok: true });
  }

  // ---- Iniciar refixar produto ----
  if (action === 'START_REPIN') {
    const { intervalSecs } = msg;
    chrome.alarms.create('repinProduct', { periodInMinutes: intervalSecs / 60 });
    sendResponse({ ok: true });
  }

  // ---- Parar refixar produto ----
  if (action === 'STOP_REPIN') {
    chrome.alarms.clear('repinProduct');
    sendResponse({ ok: true });
  }

  // ---- Iniciar mensagens automáticas ----
  if (action === 'START_AUTO_MESSAGES') {
    const { minSecs, maxSecs } = msg;
    const avgMins = ((minSecs + maxSecs) / 2) / 60;
    chrome.alarms.create('autoMessage', { periodInMinutes: Math.max(avgMins, 1 / 60) });
    chrome.storage.local.set({ autoMsgConfig: { minSecs, maxSecs } });
    sendResponse({ ok: true });
  }

  // ---- Parar mensagens automáticas ----
  if (action === 'STOP_AUTO_MESSAGES') {
    chrome.alarms.clear('autoMessage');
    sendResponse({ ok: true });
  }

  // ---- Disparar notificação Chrome ----
  if (action === 'SEND_NOTIFICATION') {
    const { title, message, type } = msg;
    _sendNotification(type || 'generic', title, message);
    sendResponse({ ok: true });
  }

  return true; // keep channel open for async
});

// ── Alarm handler ─────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoCloseLive') {
    // Notifica o side panel para exibir aviso de encerramento
    chrome.runtime.sendMessage({ action: 'AUTO_CLOSE_TRIGGERED' }).catch(() => {});
    _sendNotification('guardian', '⚠️ AutoLiveShop', 'Encerramento automático iniciado!');
  }

  if (alarm.name === 'repinProduct') {
    chrome.runtime.sendMessage({ action: 'REPIN_TRIGGERED' }).catch(() => {});
    // Fase 2: enviar comando ao content script da aba ativa
    _dispatchToContentScript('REPIN_PRODUCT', {});
  }

  if (alarm.name === 'autoMessage') {
    const data = await chrome.storage.local.get(['autoMsgConfig', 'chatMessages']);
    const messages = data.chatMessages || [];
    const config = data.autoMsgConfig || { minSecs: 60, maxSecs: 180 };
    const activeMessages = messages.filter(m => m.active);

    if (activeMessages.length > 0) {
      const msg = activeMessages[Math.floor(Math.random() * activeMessages.length)];
      chrome.runtime.sendMessage({ action: 'SEND_CHAT_MESSAGE', text: msg.text }).catch(() => {});
      _dispatchToContentScript('SEND_CHAT_MESSAGE', { text: msg.text });
    }

    // Reagendar com intervalo aleatório dentro do range
    chrome.alarms.clear('autoMessage');
    const rangeSecs = config.maxSecs - config.minSecs;
    const delaySecs = config.minSecs + Math.random() * rangeSecs;
    chrome.alarms.create('autoMessage', { when: Date.now() + delaySecs * 1000 });
  }
});

// ── Helpers ───────────────────────────────────────────────────
async function _getNotificationSettings() {
  const data = await chrome.storage.local.get('notificationSettings');
  return data.notificationSettings || {
    productPinned: true,
    stageAlerts: true,
    guardianAlerts: true,
    chatResponse: true,
  };
}

async function _sendNotification(type, title, message) {
  const settings = await _getNotificationSettings();

  const typeMap = {
    productPinned: 'productPinned',
    stage: 'stageAlerts',
    guardian: 'guardianAlerts',
    chat: 'chatResponse',
    generic: null, // always show
  };

  const settingKey = typeMap[type];
  if (settingKey && !settings[settingKey]) return;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
    priority: 1,
  });
}

async function _dispatchToContentScript(action, data) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action, ...data }).catch(() => {});
    }
  } catch (e) {
    // Fase 2: content script pode não estar ativo em todas as abas
  }
}

// ── Inicialização ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('initialized', (data) => {
    if (!data.initialized) {
      chrome.storage.local.set({
        initialized: true,
        chatMessages: [],
        autoResponses: [],
        cartAlertMessages: [],
        notificationSettings: {
          productPinned: true,
          stageAlerts: true,
          guardianAlerts: true,
          chatResponse: true,
        },
        licenseKey: '',
        licenseActive: true, // mockado como ativo na Fase 1
      });
    }
  });
});
