// ============================================================
// Auto Live Shop V2 — Shared Constants
// ============================================================

// ── URLs alvo ─────────────────────────────────────────────────
export const TIKTOK_LIVE_URLS = [
  'shop.tiktok.com/streamer',
  'seller.tiktok.com',
  'tiktok.com/live',
] as const;

// ── Identificadores do painel ─────────────────────────────────
export const PANEL_ROOT_ID = 'auto-live-shop-root';
export const PANEL_HOST_ID = 'auto-live-shop-host';
export const PANEL_FLAG    = '__AUTO_LIVE_SHOP_INITIALIZED__';

// ── Storage keys ──────────────────────────────────────────────
export const STORAGE_KEYS = {
  LIVE_STATE:       'als_live_state',
  PANEL_STATE:      'als_panel_state',
  SETTINGS:         'als_settings',
  SALES_HISTORY:    'als_sales_history',
  METRICS_HISTORY:  'als_metrics_history',
  GMV_GOAL:         'als_gmv_goal',
  LICENSE:          'als_license',
  INITIALIZED:      'als_initialized',
} as const;

// ── Comandos ──────────────────────────────────────────────────
export const COMMANDS = {
  PIN_PRODUCT:       'ALS_PIN_PRODUCT',
  UNPIN_PRODUCT:     'ALS_UNPIN_PRODUCT',
  REFRESH_PRODUCTS:  'ALS_REFRESH_PRODUCTS',
  START_AUTOMATION:  'ALS_START_AUTOMATION',
  STOP_AUTOMATION:   'ALS_STOP_AUTOMATION',
  GET_STATE:         'ALS_GET_STATE',
  END_LIVE:          'ALS_END_LIVE',
  SEND_CHAT:         'ALS_SEND_CHAT',
  HEARTBEAT:         'ALS_HEARTBEAT',
  LIVE_DETECTED:     'ALS_LIVE_DETECTED',
  LIVE_ENDED:        'ALS_LIVE_ENDED',
  SALE_DETECTED:     'ALS_SALE_DETECTED',
  METRICS_UPDATE:    'ALS_METRICS_UPDATE',
  PANEL_COMMAND:     'ALS_PANEL_COMMAND',
} as const;

// ── Eventos do window (ISOLATED ↔ MAIN world) ─────────────────
export const WINDOW_EVENTS = {
  COMMAND:    'ALS_COMMAND',
  RESPONSE:   'ALS_RESPONSE',
  STATE:      'ALS_STATE',
} as const;

// ── Alarm names ───────────────────────────────────────────────
export const ALARMS = {
  HEARTBEAT:    'als_heartbeat',
  REPIN:        'als_repin',
  AUTO_MSG:     'als_auto_msg',
  AUTO_CLOSE:   'als_auto_close',
} as const;

// ── Defaults ──────────────────────────────────────────────────
export const DEFAULTS = {
  PANEL_WIDTH:          320,
  PANEL_HEIGHT:         560,
  PANEL_X:              16,
  PANEL_Y:              80,
  REPIN_INTERVAL_SECS:  30,
  MSG_MIN_SECS:         60,
  MSG_MAX_SECS:         180,
  HEARTBEAT_INTERVAL:   10,      // segundos
  DEDUP_WINDOW_MS:      5_000,   // 5s para deduplicação de vendas
  TOAST_DURATION_MS:    3_000,
  MAX_SALES_HISTORY:    100,
  MAX_TOASTS:           3,
} as const;

// ── Versão ────────────────────────────────────────────────────
export const VERSION = '2.0.0';
export const EXTENSION_NAME = 'Auto Live Shop';
