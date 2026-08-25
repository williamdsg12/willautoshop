// ============================================================
// Copilo Live Shop V2 — Shared Types
// ============================================================

// ── Status da LIVE ───────────────────────────────────────────
export type LiveStatus =
  | 'LIVE_DETECTING'
  | 'LIVE_ACTIVE'
  | 'LIVE_INACTIVE'
  | 'LIVE_ENDED'
  | 'LIVE_ERROR';

// ── Resultado de Ações ────────────────────────────────────────
export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

// ── Produto da Live ───────────────────────────────────────────
export interface LiveProduct {
  id: string;
  name: string;
  price?: number;
  image?: string;
  position?: number;
  isPinned?: boolean;
  stock?: number;
}

// ── Venda Detectada ───────────────────────────────────────────
export interface Sale {
  id: string;
  productId?: string;
  productName?: string;
  amount?: number;
  quantity?: number;
  timestamp: number;
}

// ── Métricas da Live ──────────────────────────────────────────
export interface LiveMetrics {
  gmv: number;
  soldItems: number;
  salesCount: number;
  salesPerHour: number;
  viewers: number;
  startedAt?: number;
  updatedAt: number;
  source: 'tiktok' | 'calculated' | 'unknown';
}

// ── Estado Central da Live ────────────────────────────────────
export interface LiveState {
  status: LiveStatus;
  active: boolean;
  liveId?: string;
  startedAt?: number;
  products: LiveProduct[];
  pinnedProductId?: string;
  automationEnabled: boolean;
  automationProductId?: string;
  automationIntervalSecs?: number;
  lastHeartbeat: number;
  metrics: LiveMetrics;
  sales: Sale[];
}

// ── Dimensões e Posição do Painel ─────────────────────────────
export interface PanelPosition {
  x: number;
  y: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelState {
  visible: boolean;
  minimized: boolean;
  position: PanelPosition;
  size: PanelSize;
  // Compatibilidade com acesso direto
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

// ── Configurações de Automação ────────────────────────────────
export interface AutomationSettings {
  enabled: boolean;
  selectedProductId?: string;
  renewalIntervalMs: number;
  cooldownMs: number;
}

// ── Mensagens e Respostas Automáticas ─────────────────────────
export interface ChatMessage {
  id: number;
  text: string;
  active: boolean;
}

export interface AutoResponse {
  id: number;
  triggers: string[];
  text: string;
  scope: 'all' | string;
  active: boolean;
  lastUsed?: number;
}

export interface CartAlertMessage {
  id: number;
  text: string;
  active: boolean;
}

// ── Configurações Gerais da Aplicação ─────────────────────────
export interface AppSettings {
  salesSoundEnabled: boolean;
  notificationsEnabled: boolean;
  soundEnabled?: boolean; // alias de compatibilidade
  gmvGoal: number | null;
  automation: AutomationSettings;
  chatMessages: ChatMessage[];
  autoResponses: AutoResponse[];
  cartAlertMessages: CartAlertMessage[];
  repinInterval: number;
  autoMsgMin: number;
  autoMsgMax: number;
  autoMsgRandom: boolean;
  guardianEnabled: boolean;
  guardianAction: 'end' | 'pause' | 'alert';
  licenseKey: string;
  licenseStatus: LicensePlan;
}

// ── Licença ───────────────────────────────────────────────────
export type LicensePlan = 'FREE' | 'PRO' | 'PREMIUM';

export interface LicenseState {
  plan: LicensePlan;
  active: boolean;
  expiresAt?: number;
  key?: string;
}

// ── Toast Notification ────────────────────────────────────────
export type ToastType = 'success' | 'warn' | 'error' | 'info';

export interface ToastPayload {
  message: string;
  type: ToastType;
  duration?: number;
}

// ── Meta de GMV ───────────────────────────────────────────────
export interface GmvGoal {
  target: number;
  reached: boolean;
  reachedAt?: number;
}

// ── Comandos do Sistema ───────────────────────────────────────
export type AutoLiveCommand =
  | 'pin'
  | 'unpin'
  | 'refresh_products'
  | 'start_automation'
  | 'stop_automation'
  | 'get_state'
  | 'end_live'
  | 'send_chat';

// ── Mensagens do MessageBus ───────────────────────────────────
export interface BusMessage<T = unknown> {
  type: string;
  payload?: T;
  tabId?: number;
  timestamp: number;
}

// ── Estado Completo da Aplicação ──────────────────────────────
export interface AppState {
  live: LiveState;
  panel: PanelState;
  settings: AppSettings;
  license: LicenseState;
}

// ── Event Map do EventBus ─────────────────────────────────────
export type EventMap = {
  // Live
  'live:status_changed': LiveStatus;
  'live:status-changed': LiveStatus;
  'live:started': { startedAt: number };
  'live:ended': void;
  'live:heartbeat': { timestamp: number };
  'live:error': { message: string };

  // Métricas
  'metrics:updated': LiveMetrics;

  // Produtos
  'products:loaded': LiveProduct[];
  'products:updated': LiveProduct[];
  'products:pinned': { productId: string };
  'product:pinned': { productId: string };
  'products:unpinned': void;
  'product:unpinned': void;
  'products:pin_failed': { error: string };

  // Vendas
  'sale:detected': Sale;
  'sales:updated': Sale[];
  'sale:updated': Sale;

  // Automação
  'automation:started': { productId: string; intervalSecs: number };
  'automation:stopped': void;
  'automation:repin': { productId: string };

  // Painel
  'panel:toggle_minimize': void;
  'panel:minimized': boolean;
  'panel:restored': void;
  'panel:close': void;
  'panel:tab_changed': string;

  // Toast
  'toast:show': ToastPayload;

  // Configurações e Licença
  'settings:changed': Partial<AppSettings>;
  'license:updated': LicenseState;
};
