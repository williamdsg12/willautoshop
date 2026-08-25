const APP_NAME = "Copilo Live Shop";
const APP_VERSION = "2.0.0";
const PANEL_ROOT_ID = "auto-live-shop-root";
const TIKTOK_LIVE_URLS = [
  "shop.tiktok.com/streamer",
  "seller.tiktok.com",
  "seller-us.tiktok.com",
  "tiktok.com/live",
  "tiktok.com/creator/live"
];
const STORAGE_KEYS = {
  LIVE_STATE: "als_live_state",
  PANEL_STATE: "als_panel_state",
  SETTINGS: "als_settings",
  SALES_HISTORY: "als_sales_history",
  LICENSE: "als_license",
  INITIALIZED: "als_initialized"
};
const COMMANDS = {
  HEARTBEAT: "ALS_HEARTBEAT"
};
const ALARMS = {
  AUTO_CLOSE: "als_auto_close"
};
const PANEL_DEFAULTS = {
  WIDTH: 320,
  HEIGHT: 560,
  DEFAULT_X: 16,
  DEFAULT_Y: 80
};
const DEFAULTS = {
  REPIN_INTERVAL_SECS: 30,
  REPIN_INTERVAL_MS: 3e4,
  AUTO_COOLDOWN_MS: 5e3,
  MSG_MIN_SECS: 60,
  MSG_MAX_SECS: 180,
  HEARTBEAT_INTERVAL: 10,
  // 5s para deduplicação de vendas
  TOAST_DURATION_MS: 3e3,
  MAX_SALES_HISTORY: 100,
  MAX_TOASTS: 3
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
export {
  ALARMS as A,
  COMMANDS as C,
  DEFAULTS as D,
  Logger as L,
  PANEL_DEFAULTS as P,
  STORAGE_KEYS as S,
  TIKTOK_LIVE_URLS as T,
  APP_NAME as a,
  PANEL_ROOT_ID as b,
  APP_VERSION as c
};
