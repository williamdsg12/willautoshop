// ============================================================
// Copilo Live Shop V2 — StateManager
// Gerenciador central de estado único e reativo
// ============================================================

import type {
  AppState,
  AppSettings,
  LiveState,
  PanelState,
  LiveMetrics,
  Sale,
  LiveProduct,
  LiveStatus,
  LicenseState,
} from '@/shared/types';
import { DEFAULTS, PANEL_DEFAULTS } from '@/shared/constants';
import { EventBus } from './EventBus';
import { Logger } from './Logger';

const MODULE = 'StateManager';

// ── Funções de Estado Padrão ──────────────────────────────────
export function createDefaultMetrics(): LiveMetrics {
  return {
    gmv: 0,
    orders: 0,
    soldItems: 0,
    salesCount: 0,
    salesPerHour: 0,
    viewers: 0,
    updatedAt: Date.now(),
    source: 'unknown',
  };
}

export function createDefaultLiveState(): LiveState {
  return {
    status: 'LIVE_DETECTING',
    active: false,
    products: [],
    automationEnabled: false,
    automationIntervalSecs: DEFAULTS.REPIN_INTERVAL_SECS,
    lastHeartbeat: 0,
    metrics: createDefaultMetrics(),
    sales: [],
  };
}

export function createDefaultPanelState(): PanelState {
  return {
    visible: true,
    minimized: false,
    position: { x: PANEL_DEFAULTS.DEFAULT_X, y: PANEL_DEFAULTS.DEFAULT_Y },
    size: { width: PANEL_DEFAULTS.WIDTH, height: PANEL_DEFAULTS.HEIGHT },
    x: PANEL_DEFAULTS.DEFAULT_X,
    y: PANEL_DEFAULTS.DEFAULT_Y,
    width: PANEL_DEFAULTS.WIDTH,
    height: PANEL_DEFAULTS.HEIGHT,
  };
}

export function createDefaultSettings(): AppSettings {
  return {
    salesSoundEnabled: false,
    soundEnabled: false,
    notificationsEnabled: true,
    gmvGoal: null,
    automation: {
      enabled: false,
      renewalIntervalMs: DEFAULTS.REPIN_INTERVAL_MS,
      cooldownMs: DEFAULTS.AUTO_COOLDOWN_MS,
    },
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

export function createDefaultLicenseState(): LicenseState {
  return {
    plan: 'FREE',
    active: false,
  };
}

export function createDefaultAppState(): AppState {
  return {
    live: createDefaultLiveState(),
    panel: createDefaultPanelState(),
    settings: createDefaultSettings(),
    license: createDefaultLicenseState(),
  };
}

type StateSubscriber = (state: Readonly<AppState>) => void;

class StateManagerClass {
  private _state: AppState = createDefaultAppState();
  private subscribers = new Set<StateSubscriber>();

  // ── Getters públicos ─────────────────────────────────────────
  get state(): Readonly<AppState> { return this._state; }
  get live(): Readonly<LiveState> { return this._state.live; }
  get metrics(): Readonly<LiveMetrics> { return this._state.live.metrics; }
  get sales(): Readonly<Sale[]> { return this._state.live.sales; }
  get products(): Readonly<LiveProduct[]> { return this._state.live.products; }
  get panel(): Readonly<PanelState> { return this._state.panel; }
  get settings(): Readonly<AppSettings> { return this._state.settings; }
  get license(): Readonly<LicenseState> { return this._state.license; }

  getState(): Readonly<AppState> {
    return this._state;
  }

  // ── Setters e Atualizações Imutáveis ─────────────────────────
  setState(newState: AppState): void {
    this._state = { ...newState };
    this._notify();
  }

  updateState(updater: (current: AppState) => Partial<AppState>): void {
    const patch = updater(this._state);
    this._state = { ...this._state, ...patch };
    this._notify();
  }

  subscribe(callback: StateSubscriber): () => void {
    this.subscribers.add(callback);
    callback(this._state);
    return () => this.subscribers.delete(callback);
  }

  private _notify(): void {
    this.subscribers.forEach(sub => {
      try {
        sub(this._state);
      } catch (err) {
        Logger.error(MODULE, 'Erro ao notificar subscriber de estado:', err);
      }
    });
  }

  // ── Métodos Específicos por Camada ───────────────────────────

  patchLive(patch: Partial<LiveState>): void {
    this._state = {
      ...this._state,
      live: { ...this._state.live, ...patch },
    };
    this._notify();
  }

  patchPanel(patch: Partial<PanelState>): void {
    const position = patch.position || {
      x: patch.x ?? this._state.panel.position.x,
      y: patch.y ?? this._state.panel.position.y,
    };
    const size = patch.size || {
      width: patch.width ?? this._state.panel.size.width,
      height: patch.height ?? this._state.panel.size.height,
    };

    this._state = {
      ...this._state,
      panel: {
        ...this._state.panel,
        ...patch,
        position,
        size,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      },
    };
    this._notify();
  }

  patchSettings(patch: Partial<AppSettings>): void {
    this._state = {
      ...this._state,
      settings: { ...this._state.settings, ...patch },
    };
    EventBus.emit('settings:changed', patch);
    this._notify();
  }

  patchLicense(patch: Partial<LicenseState>): void {
    const updated = { ...this._state.license, ...patch };
    this._state = {
      ...this._state,
      license: updated,
    };
    EventBus.emit('license:updated', updated);
    this._notify();
  }

  setLiveStatus(status: LiveStatus): void {
    const isActive = status === 'LIVE_ACTIVE';
    if (this._state.live.status === status && this._state.live.active === isActive) return;

    this.patchLive({ status, active: isActive });
    EventBus.emit('live:status_changed', status);
    EventBus.emit('live:status-changed', status);

    if (isActive && !this._state.live.startedAt) {
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
    const isDuplicate = this._state.live.sales.some(s => s.id === sale.id);
    if (isDuplicate) {
      Logger.debug(MODULE, `Venda duplicada ignorada [ID: ${sale.id}]`);
      return;
    }

    const sales = [sale, ...this._state.live.sales].slice(0, DEFAULTS.MAX_SALES_HISTORY);
    this.patchLive({ sales });
    EventBus.emit('sale:detected', sale);
    EventBus.emit('sales:updated', sales);

    // Recalcular GMV e itens vendidos
    const gmv = sales.reduce((sum, s) => sum + (s.amount ?? 0), 0);
    const soldItems = sales.reduce((sum, s) => sum + (s.quantity ?? 1), 0);
    const elapsedHours = this._state.live.startedAt
      ? (Date.now() - this._state.live.startedAt) / 3_600_000
      : 1;

    this.updateMetrics({
      gmv,
      soldItems,
      salesCount: sales.length,
      salesPerHour: elapsedHours > 0 ? Number((sales.length / elapsedHours).toFixed(1)) : 0,
      source: 'calculated',
    });
  }

  setProducts(products: LiveProduct[]): void {
    this.patchLive({ products });
    EventBus.emit('products:loaded', products);
    EventBus.emit('products:updated', products);
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

  hydrate(partial: {
    panel?: Partial<PanelState>;
    settings?: Partial<AppSettings>;
    license?: Partial<LicenseState>;
  }): void {
    if (partial.panel) {
      this.patchPanel(partial.panel);
    }
    if (partial.settings) {
      this._state.settings = { ...createDefaultSettings(), ...partial.settings };
    }
    if (partial.license) {
      this._state.license = { ...createDefaultLicenseState(), ...partial.license };
    }
    this._notify();
    Logger.info(MODULE, 'Estado central hidratado com sucesso.');
  }

  reset(): void {
    this._state = {
      live: createDefaultLiveState(),
      panel: this._state.panel, // Preserva layout do painel
      settings: this._state.settings,
      license: this._state.license,
    };
    this._notify();
  }
}

export const StateManager = new StateManagerClass();
