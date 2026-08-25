const APP_NAME = "Copilo Live Shop";
const STORAGE_KEYS = {
  INITIALIZED: "als_initialized"
};
const COMMANDS = {
  HEARTBEAT: "ALS_HEARTBEAT"
};
const ALARMS = {
  AUTO_CLOSE: "als_auto_close"
};
const LOG_COLORS = {
  DEBUG: "#64748b",
  INFO: "#22c55e",
  WARN: "#f97316",
  ERROR: "#ef4444"
};
class LoggerClass {
  prefix = APP_NAME;
  debugEnabled = true;
  /** Ativa ou desativa logs de nível DEBUG */
  setDebugEnabled(enabled) {
    this.debugEnabled = enabled;
  }
  debug(module, message, ...args) {
    if (!this.debugEnabled) return;
    this._log("DEBUG", module, message, ...args);
  }
  info(module, message, ...args) {
    this._log("INFO", module, message, ...args);
  }
  warn(module, message, ...args) {
    this._log("WARN", module, message, ...args);
  }
  error(module, message, ...args) {
    this._log("ERROR", module, message, ...args);
  }
  _log(level, module, message, ...args) {
    const color = LOG_COLORS[level];
    const tag = `[${this.prefix}][${module}]`;
    switch (level) {
      case "DEBUG":
        console.log(`%c${tag}`, `color:${color};font-weight:600;`, message, ...args);
        break;
      case "INFO":
        console.info(`%c${tag}`, `color:${color};font-weight:bold;`, message, ...args);
        break;
      case "WARN":
        console.warn(`%c${tag}`, `color:${color};font-weight:bold;`, message, ...args);
        break;
      case "ERROR":
        console.error(`%c${tag}`, `color:${color};font-weight:bold;`, message, ...args);
        break;
    }
  }
}
const Logger = new LoggerClass();
const MODULE$1 = "LiveBackgroundService";
class LiveBackgroundService {
  /**
   * Inicializa handlers de ciclo de vida e alarmes no Service Worker.
   */
  init() {
    Logger.info(MODULE$1, "Inicializando LiveBackgroundService...");
    this._registerAlarmsListener();
  }
  /**
   * Agenda alarme de encerramento programado.
   */
  scheduleAutoClose(delayMs) {
    chrome.alarms.create(ALARMS.AUTO_CLOSE, { when: Date.now() + delayMs });
    Logger.info(MODULE$1, `Encerramento programado para daqui a ${Math.round(delayMs / 1e3)}s`);
  }
  /**
   * Cancela qualquer alarme ativo pelo nome.
   */
  cancelAlarm(alarmName) {
    chrome.alarms.clear(alarmName);
    Logger.info(MODULE$1, `Alarme "${alarmName}" cancelado`);
  }
  /**
   * Emite uma notificação nativa do Chrome.
   */
  sendNotification(title, message, priority = 1) {
    if (typeof chrome === "undefined" || !chrome.notifications) return;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: title || APP_NAME,
      message: message || "",
      priority
    });
  }
  _registerAlarmsListener() {
    if (typeof chrome === "undefined" || !chrome.alarms) return;
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      Logger.info(MODULE$1, `Alarme disparado: ${alarm.name}`);
      if (alarm.name === ALARMS.AUTO_CLOSE) {
        this.sendNotification(
          `⚠️ ${APP_NAME}`,
          "Tempo limite atingido! Encerramento automático disparado.",
          2
        );
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "ALS_AUTO_CLOSE_TRIGGERED",
            timestamp: Date.now()
          }).catch(() => {
          });
        }
      }
    });
  }
}
const MODULE = "ServiceWorker";
const liveBgService = new LiveBackgroundService();
liveBgService.init();
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  Logger.info(MODULE, `Extensão ${APP_NAME} instalada/atualizada [Razão: ${reason}]`);
  if (reason === "install") {
    await chrome.storage.local.set({
      [STORAGE_KEYS.INITIALIZED]: false
    });
    Logger.info(MODULE, "Storage inicializado para primeiro uso");
  }
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return false;
  const { type, payload } = msg;
  switch (type) {
    case COMMANDS.HEARTBEAT:
    case "ALS_HEARTBEAT":
      sendResponse({ ok: true, timestamp: Date.now() });
      return false;
    case "ALS_NOTIFY": {
      const data = payload;
      liveBgService.sendNotification(
        data.title || APP_NAME,
        data.message || "",
        data.priority || 1
      );
      sendResponse({ ok: true });
      return false;
    }
    case "ALS_SCHEDULE_CLOSE": {
      const { delayMs } = payload || {};
      if (delayMs && delayMs > 0) {
        liveBgService.scheduleAutoClose(delayMs);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "Intervalo inválido" });
      }
      return false;
    }
    case "ALS_CANCEL_ALARM": {
      const { name } = payload || {};
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
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  Logger.info(MODULE, `Ação disparada pelo ícone na aba ${tab.id}`);
  try {
    const pingResponse = await chrome.tabs.sendMessage(tab.id, {
      type: "ALS_PING",
      timestamp: Date.now()
    }).catch(() => null);
    if (!pingResponse) {
      Logger.info(MODULE, "Injetando content script na página...");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/bootstrap.js"]
      }).catch((err) => Logger.warn(MODULE, "Injeção direta falhou:", err));
    }
  } catch (err) {
    Logger.warn(MODULE, "Erro ao comunicar com a aba ativa:", err);
  }
});
Logger.info(MODULE, `✅ Service Worker do ${APP_NAME} ativo`);
