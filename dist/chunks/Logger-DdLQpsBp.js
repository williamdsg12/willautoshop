const PANEL_ROOT_ID = "auto-live-shop-root";
const STORAGE_KEYS = {
  LIVE_STATE: "als_live_state",
  PANEL_STATE: "als_panel_state",
  SETTINGS: "als_settings",
  INITIALIZED: "als_initialized"
};
const COMMANDS = {
  HEARTBEAT: "ALS_HEARTBEAT"
};
const ALARMS = {
  AUTO_CLOSE: "als_auto_close"
};
const DEFAULTS = {
  PANEL_WIDTH: 320,
  PANEL_HEIGHT: 560,
  PANEL_X: 16,
  PANEL_Y: 80,
  REPIN_INTERVAL_SECS: 30,
  MSG_MIN_SECS: 60,
  MSG_MAX_SECS: 180,
  HEARTBEAT_INTERVAL: 10,
  // 5s para deduplicação de vendas
  TOAST_DURATION_MS: 3e3,
  MAX_TOASTS: 3
};
const COLORS = {
  debug: "#64748b",
  info: "#14b8a6",
  warn: "#f97316",
  error: "#ef4444"
};
class LoggerClass {
  prefix = "[ALS]";
  enabled = true;
  setEnabled(val) {
    this.enabled = val;
  }
  debug(module, ...args) {
    this._log("debug", module, ...args);
  }
  info(module, ...args) {
    this._log("info", module, ...args);
  }
  warn(module, ...args) {
    this._log("warn", module, ...args);
  }
  error(module, ...args) {
    this._log("error", module, ...args);
  }
  _log(level, module, ...args) {
    if (!this.enabled && level === "debug") return;
    const color = COLORS[level];
    const label = `${this.prefix}[${module}]`;
    console[level === "debug" ? "log" : level](
      `%c${label}`,
      `color:${color};font-weight:bold`,
      ...args
    );
  }
}
const Logger = new LoggerClass();
export {
  ALARMS as A,
  COMMANDS as C,
  DEFAULTS as D,
  Logger as L,
  PANEL_ROOT_ID as P,
  STORAGE_KEYS as S
};
