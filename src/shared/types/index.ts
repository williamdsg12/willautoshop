// ============================================================
// Auto Live Shop V2 — Shared Types
// ============================================================

// ── Status da LIVE ───────────────────────────────────────────
export type LiveStatus =
  | 'LIVE_DETECTING'
  | 'LIVE_ACTIVE'
  | 'LIVE_INACTIVE'
  | 'LIVE_ENDED'
  | 'LIVE_ERROR';

// ── Resultado de ações ────────────────────────────────────────
export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

// ── Produto da live ───────────────────────────────────────────
export interface LiveProduct {
  id: string;
  name: string;
  price?: number;
  image?: string;
  position?: number;
  isPinned?: boolean;
  stock?: number;
}

// ── Venda detectada ───────────────────────────────────────────
export interface Sale {
  id: string;
  productId?: string;
  productName?: string;
  amount?: number;
  quantity?: number;
  timestamp: number;
}

// ── Métricas da live ──────────────────────────────────────────
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

// ── Estado central da live ────────────────────────────────────
export interface LiveState {
  status: LiveStatus;
  liveId?: string;
  startedAt?: number;
  products: LiveProduct[];
  pinnedProductId?: string;
  automationEnabled: boolean;
  automationProductId?: string;
  automationIntervalSecs: number;
  lastHeartbeat: number;
  metrics: LiveMetrics;
  sales: Sale[];
}

// ── Configurações do painel ───────────────────────────────────
export interface PanelState {
  visible: boolean;
  minimized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Configurações gerais ──────────────────────────────────────
export interface AppSettings {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  gmvGoal: number | null;
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
  licenseStatus: 'FREE' | 'PRO' | 'PREMIUM';
}

// ── Mensagem do chat ──────────────────────────────────────────
export interface ChatMessage {
  id: number;
  text: string;
  active: boolean;
}

// ── Regra de resposta automática ──────────────────────────────
export interface AutoResponse {
  id: number;
  triggers: string[];
  text: string;
  scope: 'all' | string;
  active: boolean;
  lastUsed?: number;
}

// ── Mensagem de alerta de carrinho ────────────────────────────
export interface CartAlertMessage {
  id: number;
  text: string;
  active: boolean;
}

// ── Comandos do sistema ───────────────────────────────────────
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
export interface BusMessage {
  type: string;
  payload?: unknown;
  tabId?: number;
  timestamp: number;
}

// ── Estado completo da aplicação ──────────────────────────────
export interface AppState {
  live: LiveState;
  panel: PanelState;
  settings: AppSettings;
}

// ── Eventos do EventBus ───────────────────────────────────────
export type EventMap = {
  // Live
  'live:status_changed': LiveStatus;
  'live:started': { startedAt: number };
  'live:ended': void;
  'live:heartbeat': { timestamp: number };
  'live:error': { message: string };

  // Métricas
  'metrics:updated': LiveMetrics;

  // Produtos
  'products:loaded': LiveProduct[];
  'products:pinned': { productId: string };
  'products:unpinned': void;
  'products:pin_failed': { error: string };

  // Vendas
  'sale:detected': Sale;
  'sales:updated': Sale[];

  // Automação
  'automation:started': { productId: string; intervalSecs: number };
  'automation:stopped': void;
  'automation:repin': { productId: string };

  // Painel
  'panel:toggle_minimize': void;
  'panel:close': void;
  'panel:tab_changed': string;

  // Toast
  'toast:show': { message: string; type: 'success' | 'warn' | 'error' | 'info' };

  // Configurações
  'settings:changed': Partial<AppSettings>;
};
