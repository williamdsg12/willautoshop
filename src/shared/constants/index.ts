// ============================================================
// Copilo Live Shop V2 — Shared Constants
// ============================================================

// ── Identidade da Aplicação ──────────────────────────────────
export const APP_NAME = 'Copilo Live Shop';
export const APP_VERSION = '2.0.0';
export const EXTENSION_NAME = APP_NAME;
export const VERSION = APP_VERSION;

// ── Identificadores do DOM / Painel ───────────────────────────
export const PANEL_ROOT_ID = 'auto-live-shop-root';
export const PANEL_HOST_ID = 'auto-live-shop-host';
export const PANEL_FLAG    = '__AUTO_LIVE_SHOP_INITIALIZED__';
export const PANEL_Z_INDEX = 2147483647;

// ── URLs Alvo ─────────────────────────────────────────────────
export const TIKTOK_LIVE_URLS = [
  'shop.tiktok.com/streamer',
  'seller.tiktok.com',
  'seller-us.tiktok.com',
  'tiktok.com/live',
  'tiktok.com/creator/live',
] as const;

// ── Storage Keys ──────────────────────────────────────────────
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

// ── Comandos do Sistema ───────────────────────────────────────
export const COMMANDS = {
  PIN_PRODUCT:              'ALS_PIN_PRODUCT',
  UNPIN_PRODUCT:            'ALS_UNPIN_PRODUCT',
  REFRESH_PRODUCTS:         'ALS_REFRESH_PRODUCTS',
  START_AUTOMATION:         'ALS_START_AUTOMATION',
  STOP_AUTOMATION:          'ALS_STOP_AUTOMATION',
  GET_STATE:                'ALS_GET_STATE',
  END_LIVE:                 'ALS_END_LIVE',
  SEND_CHAT:                'ALS_SEND_CHAT',
  HEARTBEAT:                'ALS_HEARTBEAT',
  LIVE_DETECTED:            'ALS_LIVE_DETECTED',
  LIVE_ENDED:               'ALS_LIVE_ENDED',
  SALE_DETECTED:            'ALS_SALE_DETECTED',
  METRICS_UPDATE:           'ALS_METRICS_UPDATE',
  PANEL_COMMAND:            'ALS_PANEL_COMMAND',
  AUTO_LIVE_COMMAND:        'AUTO_LIVE_COMMAND',
  AUTO_LIVE_STATE:          'AUTO_LIVE_STATE',
  AUTO_LIVE_HEARTBEAT:      'AUTO_LIVE_HEARTBEAT',
  AUTO_LIVE_AUTOMATION_SYNC:'AUTO_LIVE_AUTOMATION_SYNC',
} as const;

// ── Eventos do Window (ISOLATED ↔ MAIN world) ─────────────────
export const WINDOW_EVENTS = {
  COMMAND:    'ALS_COMMAND',
  RESPONSE:   'ALS_RESPONSE',
  STATE:      'ALS_STATE',
} as const;

// ── Alarm Names ───────────────────────────────────────────────
export const ALARMS = {
  HEARTBEAT:    'als_heartbeat',
  REPIN:        'als_repin',
  AUTO_MSG:     'als_auto_msg',
  AUTO_CLOSE:   'als_auto_close',
} as const;

// ── Dimensões e Posições Padrão ───────────────────────────────
export const PANEL_DEFAULTS = {
  WIDTH:        320,
  HEIGHT:       560,
  MIN_WIDTH:    280,
  MIN_HEIGHT:   400,
  MAX_WIDTH:    480,
  MAX_HEIGHT:   800,
  DEFAULT_X:    16,
  DEFAULT_Y:    80,
} as const;

// ── Intervalos e Limites ──────────────────────────────────────
export const DEFAULTS = {
  PANEL_WIDTH:          PANEL_DEFAULTS.WIDTH,
  PANEL_HEIGHT:         PANEL_DEFAULTS.HEIGHT,
  PANEL_X:              PANEL_DEFAULTS.DEFAULT_X,
  PANEL_Y:              PANEL_DEFAULTS.DEFAULT_Y,
  REPIN_INTERVAL_SECS:  30,
  REPIN_INTERVAL_MS:    30_000,
  AUTO_COOLDOWN_MS:     5_000,
  MSG_MIN_SECS:         60,
  MSG_MAX_SECS:         180,
  HEARTBEAT_INTERVAL:   10,      // segundos
  HEARTBEAT_INTERVAL_MS:10_000,
  DEDUP_WINDOW_MS:      5_000,   // 5s para deduplicação de vendas
  TOAST_DURATION_MS:    3_000,
  MAX_SALES_HISTORY:    100,
  MAX_TOASTS:           3,
} as const;

// ── Planos de Licença ─────────────────────────────────────────
export const LICENSE_PLANS = {
  FREE:    'FREE',
  PRO:     'PRO',
  PREMIUM: 'PREMIUM',
} as const;
