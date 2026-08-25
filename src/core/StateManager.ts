// ============================================================
// Auto Live Shop V2 — StateManager (estado central imutável)
// ============================================================
import type { AppState, AppSettings, LiveState, PanelState, LiveMetrics, Sale, LiveProduct, LiveStatus } from '@/shared/types';
import { DEFAULTS } from '@/shared/constants';
import { EventBus } from './EventBus';
import { Logger } from './Logger';

const MODULE = 'StateManager';

// ── Estado padrão ─────────────────────────────────────────────
function defaultMetrics(): LiveMetrics {
  return {
    gmv: 0,
    soldItems: 0,
    salesCount: 0,
    salesPerHour: 0,
    viewers: 0,
    updatedAt: Date.now(),
    source: 'unknown',
  };
}

function defaultLiveState(): LiveState {
  return {
    status: 'LIVE_DETECTING',
    products: [],
    automationEnabled: false,
    automationIntervalSecs: DEFAULTS.REPIN_INTERVAL_SECS,
    lastHeartbeat: 0,
    metrics: defaultMetrics(),
    sales: [],
  };
}

function defaultPanelState(): PanelState {
  return {
    visible: true,
    minimized: false,
    x: DEFAULTS.PANEL_X,
    y: DEFAULTS.PANEL_Y,
    width: DEFAULTS.PANEL_WIDTH,
    height: DEFAULTS.PANEL_HEIGHT,
  };
}

function defaultSettings(): AppSettings {
  return {
    soundEnabled: false,
    notificationsEnabled: true,
    gmvGoal: null,
    chatMessages: [],
    autoResponses: [],
    cartAlertMessages: [],
    repinInterval: DEFAULTS.REPIN_INTERVAL_SECS,
    autoMsgMin: DEFAULTS.MSG_MIN_SECS,
    autoMsgMax: DEFAULTS.MSG_MAX_SECS,
    autoMsgRandom: true,
    guardianEnabled: false,
    guardianAction: 'alert',
    licenseKey: '',
    licenseStatus: 'FREE',
  };
}

// ── StateManager ──────────────────────────────────────────────
class StateManagerClass {
  private _state: AppState = {
    live: defaultLiveState(),
    panel: defaultPanelState(),
    settings: defaultSettings(),
  };

  get state(): Readonly<AppState> { return this._state; }
  get live(): Readonly<LiveState> { return this._state.live; }
  get panel(): Readonly<PanelState> { return this._state.panel; }
  get settings(): Readonly<AppSettings> { return this._state.settings; }

  // ── Patch de estado (imutável) ───────────────────────────────
  patchLive(patch: Partial<LiveState>): void {
    const prev = this._state.live;
    this._state = {
      ...this._state,
      live: { ...prev, ...patch },
    };
    Logger.debug(MODULE, 'live patched:', patch);
  }

  patchPanel(patch: Partial<PanelState>): void {
    this._state = {
      ...this._state,
      panel: { ...this._state.panel, ...patch },
    };
  }

  patchSettings(patch: Partial<AppSettings>): void {
    this._state = {
      ...this._state,
      settings: { ...this._state.settings, ...patch },
    };
    EventBus.emit('settings:changed', patch);
  }

  // ── Helpers de live ──────────────────────────────────────────
  setLiveStatus(status: LiveStatus): void {
    if (this._state.live.status === status) return;
    this.patchLive({ status });
    EventBus.emit('live:status_changed', status);

    if (status === 'LIVE_ACTIVE' && !this._state.live.startedAt) {
      const startedAt = Date.now();
      this.patchLive({ startedAt });
      EventBus.emit('live:started', { startedAt });
    }
    if (status === 'LIVE_ENDED' || status === 'LIVE_INACTIVE') {
      EventBus.emit('live:ended');
    }
  }

  updateMetrics(metrics: Partial<LiveMetrics>): void {
    const updated: LiveMetrics = {
      ...this._state.live.metrics,
      ...metrics,
      updatedAt: Date.now(),
    };
    this.patchLive({ metrics: updated });
    EventBus.emit('metrics:updated', updated);
  }

  addSale(sale: Sale): void {
    const existing = this._state.live.sales.some(s => s.id === sale.id);
    if (existing) { Logger.debug(MODULE, 'Venda duplicada ignorada:', sale.id); return; }

    const sales = [sale, ...this._state.live.sales].slice(0, 100);
    this.patchLive({ sales });
    EventBus.emit('sale:detected', sale);
    EventBus.emit('sales:updated', sales);

    // Atualizar métricas calculadas
    const gmv = sales.reduce((sum, s) => sum + (s.amount ?? 0), 0);
    const soldItems = sales.reduce((sum, s) => sum + (s.quantity ?? 1), 0);
    const elapsed = this._state.live.startedAt
      ? (Date.now() - this._state.live.startedAt) / 3_600_000
      : 1;
    this.updateMetrics({
      gmv,
      soldItems,
      salesCount: sales.length,
      salesPerHour: elapsed > 0 ? sales.length / elapsed : 0,
      source: 'calculated',
    });
  }

  setProducts(products: LiveProduct[]): void {
    this.patchLive({ products });
    EventBus.emit('products:loaded', products);
  }

  setPinnedProduct(productId: string | undefined): void {
    this.patchLive({ pinnedProductId: productId });
    const products = this._state.live.products.map(p => ({
      ...p,
      isPinned: p.id === productId,
    }));
    this.patchLive({ products });
  }

  heartbeat(): void {
    const timestamp = Date.now();
    this.patchLive({ lastHeartbeat: timestamp });
    EventBus.emit('live:heartbeat', { timestamp });
  }

  // ── Hidrate do storage ────────────────────────────────────────
  hydrate(partial: { panel?: Partial<PanelState>; settings?: Partial<AppSettings> }): void {
    if (partial.panel) this._state.panel = { ...defaultPanelState(), ...partial.panel };
    if (partial.settings) this._state.settings = { ...defaultSettings(), ...partial.settings };
    Logger.info(MODULE, 'Estado hidratado do storage');
  }

  reset(): void {
    this._state = {
      live: defaultLiveState(),
      panel: this._state.panel,   // preserva posição do painel
      settings: this._state.settings,
    };
  }
}

export const StateManager = new StateManagerClass();
