import { L as Logger, S as STORAGE_KEYS, C as COMMANDS, A as ALARMS } from "./chunks/Logger-DdLQpsBp.js";
const MODULE = "ServiceWorker";
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  Logger.info(MODULE, "onInstalled:", reason);
  if (reason === "install") {
    await chrome.storage.local.set({
      [STORAGE_KEYS.INITIALIZED]: false
    });
    Logger.info(MODULE, "Storage inicializado");
  }
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const { type } = msg;
  if (type === COMMANDS.HEARTBEAT) {
    sendResponse({ ok: true, ts: Date.now() });
    return false;
  }
  if (type === "ALS_NOTIFY") {
    const { title, message } = msg.payload;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: title || "Auto Live Shop",
      message: message || "",
      priority: 1
    });
    sendResponse({ ok: true });
    return false;
  }
  if (type === "ALS_SCHEDULE_CLOSE") {
    const { delayMs } = msg.payload;
    chrome.alarms.create(ALARMS.AUTO_CLOSE, { when: Date.now() + delayMs });
    sendResponse({ ok: true });
    return false;
  }
  if (type === "ALS_CANCEL_ALARM") {
    const { name } = msg.payload;
    chrome.alarms.clear(name);
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  Logger.info(MODULE, "Alarm:", alarm.name);
  if (alarm.name === ALARMS.AUTO_CLOSE) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "ALS_AUTO_CLOSE_TRIGGERED" }).catch(() => {
      });
    }
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "⚠️ Auto Live Shop",
      message: "Encerramento automático acionado!",
      priority: 2
    });
  }
});
chrome.action.onClicked.addListener(async (tab) => {
  Logger.info(MODULE, "Ícone clicado — tab:", tab.id);
  if (!tab.id) return;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "ALS_PING" }).catch(() => null);
    if (!response) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/bootstrap.js"]
      }).catch((err) => Logger.warn(MODULE, "Erro ao injetar script:", err));
    }
  } catch (err) {
    Logger.warn(MODULE, "Erro ao comunicar com tab:", err);
  }
});
Logger.info(MODULE, "✅ Service Worker ativo");
