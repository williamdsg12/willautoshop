(function() {
  "use strict";
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
  function createUniqueHash(input) {
    const str = typeof input === "string" ? input : JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `hash_${Math.abs(hash).toString(36)}_${str.length}`;
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function formatCurrency(value) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function formatRelativeTime(timestamp) {
    const diff = Math.floor((Date.now() - timestamp) / 1e3);
    if (diff < 5) return "agora";
    if (diff < 60) return `há ${diff}s`;
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    return `há ${Math.floor(diff / 3600)}h`;
  }
  function escHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function isTikTokShopUrl(url = window.location.href) {
    return TIKTOK_LIVE_URLS.some((target) => url.includes(target));
  }
  function getCurrentRoute() {
    return window.location.pathname + window.location.search;
  }
  function queryWithFallbacks(selectors, context = document) {
    for (const selector of selectors) {
      try {
        const el = context.querySelector(selector);
        if (el) return el;
      } catch {
      }
    }
    return null;
  }
  function queryAllWithFallbacks(selectors, context = document) {
    for (const selector of selectors) {
      try {
        const els = Array.from(context.querySelectorAll(selector));
        if (els.length > 0) return els;
      } catch {
      }
    }
    return [];
  }
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
  const MODULE$o = "EventBus";
  class EventBusClass {
    listeners = /* @__PURE__ */ new Map();
    onceListeners = /* @__PURE__ */ new Map();
    /**
     * Registra um listener para um evento.
     * Retorna uma função de cancelamento (unsubscribe).
     */
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, /* @__PURE__ */ new Set());
      }
      const set = this.listeners.get(event);
      set.add(callback);
      return () => this.off(event, callback);
    }
    /**
     * Registra um listener que será executado apenas uma única vez.
     */
    once(event, callback) {
      if (!this.onceListeners.has(event)) {
        this.onceListeners.set(event, /* @__PURE__ */ new Set());
      }
      const set = this.onceListeners.get(event);
      set.add(callback);
      return () => {
        this.onceListeners.get(event)?.delete(callback);
      };
    }
    /**
     * Remove um listener registrado.
     */
    off(event, callback) {
      this.listeners.get(event)?.delete(callback);
      this.onceListeners.get(event)?.delete(callback);
    }
    /**
     * Emite um evento para todos os listeners cadastrados.
     */
    emit(event, ...args) {
      const payload = args[0];
      const regular = this.listeners.get(event);
      if (regular) {
        regular.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            Logger.error(MODULE$o, `Erro no listener do evento "${String(event)}":`, err);
          }
        });
      }
      const once = this.onceListeners.get(event);
      if (once && once.size > 0) {
        const callbacks = Array.from(once);
        this.onceListeners.delete(event);
        callbacks.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            Logger.error(MODULE$o, `Erro no once listener do evento "${String(event)}":`, err);
          }
        });
      }
    }
    /**
     * Limpa listeners de um evento ou de todos os eventos.
     */
    clear(event) {
      if (event) {
        this.listeners.delete(event);
        this.onceListeners.delete(event);
      } else {
        this.listeners.clear();
        this.onceListeners.clear();
      }
    }
    /**
     * Alias para limpar todos os eventos.
     */
    removeAll(event) {
      this.clear(event);
    }
  }
  const EventBus = new EventBusClass();
  const MODULE$n = "StateManager";
  function createDefaultMetrics() {
    return {
      gmv: 0,
      soldItems: 0,
      salesCount: 0,
      salesPerHour: 0,
      viewers: 0,
      updatedAt: Date.now(),
      source: "unknown"
    };
  }
  function createDefaultLiveState() {
    return {
      status: "LIVE_DETECTING",
      active: false,
      products: [],
      automationEnabled: false,
      automationIntervalSecs: DEFAULTS.REPIN_INTERVAL_SECS,
      lastHeartbeat: 0,
      metrics: createDefaultMetrics(),
      sales: []
    };
  }
  function createDefaultPanelState() {
    return {
      visible: true,
      minimized: false,
      position: { x: PANEL_DEFAULTS.DEFAULT_X, y: PANEL_DEFAULTS.DEFAULT_Y },
      size: { width: PANEL_DEFAULTS.WIDTH, height: PANEL_DEFAULTS.HEIGHT },
      x: PANEL_DEFAULTS.DEFAULT_X,
      y: PANEL_DEFAULTS.DEFAULT_Y,
      width: PANEL_DEFAULTS.WIDTH,
      height: PANEL_DEFAULTS.HEIGHT
    };
  }
  function createDefaultSettings() {
    return {
      salesSoundEnabled: false,
      soundEnabled: false,
      notificationsEnabled: true,
      gmvGoal: null,
      automation: {
        enabled: false,
        renewalIntervalMs: DEFAULTS.REPIN_INTERVAL_MS,
        cooldownMs: DEFAULTS.AUTO_COOLDOWN_MS
      },
      chatMessages: [],
      autoResponses: [],
      cartAlertMessages: [],
      repinInterval: DEFAULTS.REPIN_INTERVAL_SECS,
      autoMsgMin: DEFAULTS.MSG_MIN_SECS,
      autoMsgMax: DEFAULTS.MSG_MAX_SECS,
      autoMsgRandom: true,
      guardianEnabled: false,
      guardianAction: "alert",
      licenseKey: "",
      licenseStatus: "FREE"
    };
  }
  function createDefaultLicenseState() {
    return {
      plan: "FREE",
      active: false
    };
  }
  function createDefaultAppState() {
    return {
      live: createDefaultLiveState(),
      panel: createDefaultPanelState(),
      settings: createDefaultSettings(),
      license: createDefaultLicenseState()
    };
  }
  class StateManagerClass {
    _state = createDefaultAppState();
    subscribers = /* @__PURE__ */ new Set();
    // ── Getters públicos ─────────────────────────────────────────
    get state() {
      return this._state;
    }
    get live() {
      return this._state.live;
    }
    get metrics() {
      return this._state.live.metrics;
    }
    get sales() {
      return this._state.live.sales;
    }
    get products() {
      return this._state.live.products;
    }
    get panel() {
      return this._state.panel;
    }
    get settings() {
      return this._state.settings;
    }
    get license() {
      return this._state.license;
    }
    getState() {
      return this._state;
    }
    // ── Setters e Atualizações Imutáveis ─────────────────────────
    setState(newState) {
      this._state = { ...newState };
      this._notify();
    }
    updateState(updater) {
      const patch = updater(this._state);
      this._state = { ...this._state, ...patch };
      this._notify();
    }
    subscribe(callback) {
      this.subscribers.add(callback);
      callback(this._state);
      return () => this.subscribers.delete(callback);
    }
    _notify() {
      this.subscribers.forEach((sub) => {
        try {
          sub(this._state);
        } catch (err) {
          Logger.error(MODULE$n, "Erro ao notificar subscriber de estado:", err);
        }
      });
    }
    // ── Métodos Específicos por Camada ───────────────────────────
    patchLive(patch) {
      this._state = {
        ...this._state,
        live: { ...this._state.live, ...patch }
      };
      this._notify();
    }
    patchPanel(patch) {
      const position = patch.position || {
        x: patch.x ?? this._state.panel.position.x,
        y: patch.y ?? this._state.panel.position.y
      };
      const size = patch.size || {
        width: patch.width ?? this._state.panel.size.width,
        height: patch.height ?? this._state.panel.size.height
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
          height: size.height
        }
      };
      this._notify();
    }
    patchSettings(patch) {
      this._state = {
        ...this._state,
        settings: { ...this._state.settings, ...patch }
      };
      EventBus.emit("settings:changed", patch);
      this._notify();
    }
    patchLicense(patch) {
      const updated = { ...this._state.license, ...patch };
      this._state = {
        ...this._state,
        license: updated
      };
      EventBus.emit("license:updated", updated);
      this._notify();
    }
    setLiveStatus(status) {
      const isActive = status === "LIVE_ACTIVE";
      if (this._state.live.status === status && this._state.live.active === isActive) return;
      this.patchLive({ status, active: isActive });
      EventBus.emit("live:status_changed", status);
      EventBus.emit("live:status-changed", status);
      if (isActive && !this._state.live.startedAt) {
        const startedAt = Date.now();
        this.patchLive({ startedAt });
        EventBus.emit("live:started", { startedAt });
      }
      if (status === "LIVE_ENDED" || status === "LIVE_INACTIVE") {
        EventBus.emit("live:ended");
      }
    }
    updateMetrics(metrics) {
      const updated = {
        ...this._state.live.metrics,
        ...metrics,
        updatedAt: Date.now()
      };
      this.patchLive({ metrics: updated });
      EventBus.emit("metrics:updated", updated);
    }
    addSale(sale) {
      const isDuplicate = this._state.live.sales.some((s) => s.id === sale.id);
      if (isDuplicate) {
        Logger.debug(MODULE$n, `Venda duplicada ignorada [ID: ${sale.id}]`);
        return;
      }
      const sales = [sale, ...this._state.live.sales].slice(0, DEFAULTS.MAX_SALES_HISTORY);
      this.patchLive({ sales });
      EventBus.emit("sale:detected", sale);
      EventBus.emit("sales:updated", sales);
      const gmv = sales.reduce((sum, s) => sum + (s.amount ?? 0), 0);
      const soldItems = sales.reduce((sum, s) => sum + (s.quantity ?? 1), 0);
      const elapsedHours = this._state.live.startedAt ? (Date.now() - this._state.live.startedAt) / 36e5 : 1;
      this.updateMetrics({
        gmv,
        soldItems,
        salesCount: sales.length,
        salesPerHour: elapsedHours > 0 ? Number((sales.length / elapsedHours).toFixed(1)) : 0,
        source: "calculated"
      });
    }
    setProducts(products) {
      this.patchLive({ products });
      EventBus.emit("products:loaded", products);
      EventBus.emit("products:updated", products);
    }
    setPinnedProduct(productId) {
      this.patchLive({ pinnedProductId: productId });
      const products = this._state.live.products.map((p) => ({
        ...p,
        isPinned: p.id === productId
      }));
      this.patchLive({ products });
    }
    heartbeat() {
      const timestamp = Date.now();
      this.patchLive({ lastHeartbeat: timestamp });
      EventBus.emit("live:heartbeat", { timestamp });
    }
    hydrate(partial) {
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
      Logger.info(MODULE$n, "Estado central hidratado com sucesso.");
    }
    reset() {
      this._state = {
        live: createDefaultLiveState(),
        panel: this._state.panel,
        // Preserva layout do painel
        settings: this._state.settings,
        license: this._state.license
      };
      this._notify();
    }
  }
  const StateManager = new StateManagerClass();
  const MODULE$m = "StorageManager";
  class StorageManagerClass {
    inMemoryFallback = /* @__PURE__ */ new Map();
    isChromeStorageAvailable() {
      return typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local;
    }
    /**
     * Obtém um valor por chave com valor padrão de fallback.
     */
    async get(key, defaultValue) {
      if (!this.isChromeStorageAvailable()) {
        return this.inMemoryFallback.has(key) ? this.inMemoryFallback.get(key) : defaultValue;
      }
      try {
        const result = await chrome.storage.local.get(key);
        return result[key] !== void 0 ? result[key] : defaultValue;
      } catch (err) {
        Logger.error(MODULE$m, `Erro ao obter chave "${key}":`, err);
        return defaultValue;
      }
    }
    /**
     * Salva um valor por chave.
     */
    async set(key, value) {
      if (!this.isChromeStorageAvailable()) {
        this.inMemoryFallback.set(key, value);
        return;
      }
      try {
        await chrome.storage.local.set({ [key]: value });
      } catch (err) {
        Logger.error(MODULE$m, `Erro ao salvar chave "${key}":`, err);
      }
    }
    /**
     * Remove uma chave do storage.
     */
    async remove(key) {
      if (!this.isChromeStorageAvailable()) {
        this.inMemoryFallback.delete(key);
        return;
      }
      try {
        await chrome.storage.local.remove(key);
      } catch (err) {
        Logger.error(MODULE$m, `Erro ao remover chave "${key}":`, err);
      }
    }
    /**
     * Limpa todo o storage.
     */
    async clear() {
      if (!this.isChromeStorageAvailable()) {
        this.inMemoryFallback.clear();
        return;
      }
      try {
        await chrome.storage.local.clear();
      } catch (err) {
        Logger.error(MODULE$m, "Erro ao limpar storage:", err);
      }
    }
    /**
     * Obtém múltiplos valores de uma só vez.
     */
    async getMany(keys) {
      if (!this.isChromeStorageAvailable()) {
        const result = {};
        keys.forEach((k) => {
          if (this.inMemoryFallback.has(k)) {
            result[k] = this.inMemoryFallback.get(k);
          }
        });
        return result;
      }
      try {
        return await chrome.storage.local.get(keys);
      } catch (err) {
        Logger.error(MODULE$m, "Erro ao ler múltiplas chaves:", err);
        return {};
      }
    }
    /**
     * Salva múltiplos valores de uma só vez.
     */
    async setMany(items) {
      if (!this.isChromeStorageAvailable()) {
        Object.entries(items).forEach(([k, v]) => this.inMemoryFallback.set(k, v));
        return;
      }
      try {
        await chrome.storage.local.set(items);
      } catch (err) {
        Logger.error(MODULE$m, "Erro ao salvar múltiplos itens:", err);
      }
    }
    // ── Métodos de Alto Nível ───────────────────────────────────
    async getSettings() {
      return this.get(STORAGE_KEYS.SETTINGS, {});
    }
    async saveSettings(settings) {
      const current = await this.getSettings();
      await this.set(STORAGE_KEYS.SETTINGS, { ...current, ...settings });
    }
    async getPanelState() {
      return this.get(STORAGE_KEYS.PANEL_STATE, {});
    }
    async savePanelState(state) {
      const current = await this.getPanelState();
      await this.set(STORAGE_KEYS.PANEL_STATE, { ...current, ...state });
    }
    async getLiveState() {
      return this.get(STORAGE_KEYS.LIVE_STATE, {});
    }
    async saveLiveState(state) {
      await this.set(STORAGE_KEYS.LIVE_STATE, state);
    }
    async getLicense() {
      return this.get(STORAGE_KEYS.LICENSE, { plan: "FREE", active: false });
    }
    async saveLicense(license) {
      const current = await this.getLicense();
      await this.set(STORAGE_KEYS.LICENSE, { ...current, ...license });
    }
    async getSalesHistory() {
      return this.get(STORAGE_KEYS.SALES_HISTORY, []);
    }
    async saveSalesHistory(sales) {
      await this.set(STORAGE_KEYS.SALES_HISTORY, sales);
    }
    async isInitialized() {
      return this.get(STORAGE_KEYS.INITIALIZED, false);
    }
    async setInitialized() {
      await this.set(STORAGE_KEYS.INITIALIZED, true);
    }
  }
  const StorageManager = new StorageManagerClass();
  const MODULE$l = "MessageBus";
  class MessageBusClass {
    handlers = /* @__PURE__ */ new Map();
    isListening = false;
    /**
     * Registra um handler para um tipo específico de mensagem.
     */
    on(type, handler) {
      this.handlers.set(type, handler);
      return () => {
        this.handlers.delete(type);
      };
    }
    /**
     * Envia uma mensagem para o background script ou receptor ativo.
     */
    async send(type, payload) {
      const msg = {
        type,
        payload,
        timestamp: Date.now()
      };
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        Logger.warn(MODULE$l, `Ambiente Chrome não disponível para envio da mensagem "${type}"`);
        return null;
      }
      try {
        return await chrome.runtime.sendMessage(msg);
      } catch (err) {
        Logger.warn(MODULE$l, `Erro ao enviar mensagem "${type}":`, err);
        return null;
      }
    }
    /**
     * Envia uma mensagem para uma aba específica.
     */
    async sendToTab(tabId, type, payload) {
      const msg = {
        type,
        payload,
        tabId,
        timestamp: Date.now()
      };
      if (typeof chrome === "undefined" || !chrome.tabs?.sendMessage) {
        return null;
      }
      try {
        return await chrome.tabs.sendMessage(tabId, msg);
      } catch (err) {
        Logger.warn(MODULE$l, `Erro ao enviar para tab ${tabId} "${type}":`, err);
        return null;
      }
    }
    /**
     * Envia mensagem em broadcast para todas as abas abertas.
     */
    async broadcast(type, payload) {
      if (typeof chrome === "undefined" || !chrome.tabs?.query) {
        return;
      }
      try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id) {
            this.sendToTab(tab.id, type, payload).catch(() => {
            });
          }
        }
      } catch (err) {
        Logger.error(MODULE$l, `Erro ao disparar broadcast de "${type}":`, err);
      }
    }
    /**
     * Helper para responder uma mensagem.
     */
    respond(sendResponse, data) {
      try {
        sendResponse(data);
      } catch (err) {
        Logger.error(MODULE$l, "Erro ao responder mensagem:", err);
      }
    }
    /**
     * Inicializa o listener de runtime do Chrome.
     */
    listen() {
      if (this.isListening) return;
      if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
        Logger.warn(MODULE$l, "chrome.runtime.onMessage indisponível no ambiente atual.");
        return;
      }
      this.isListening = true;
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!msg || !msg.type) return false;
        const handler = this.handlers.get(msg.type);
        if (!handler) return false;
        try {
          const result = handler(msg, sender);
          if (result instanceof Promise) {
            result.then((res) => sendResponse(res)).catch((err) => {
              Logger.error(MODULE$l, `Erro assíncrono no handler "${msg.type}":`, err);
              sendResponse({ error: String(err) });
            });
            return true;
          }
          sendResponse(result);
          return false;
        } catch (err) {
          Logger.error(MODULE$l, `Erro no handler síncrono "${msg.type}":`, err);
          sendResponse({ error: String(err) });
          return false;
        }
      });
      Logger.info(MODULE$l, "Listener do MessageBus ativo");
    }
  }
  const MessageBus = new MessageBusClass();
  const MODULE$k = "PageDetector";
  class PageDetector {
    lastRoute = "";
    /**
     * Verifica se a página atual é elegível para execução da extensão.
     */
    isTargetPage() {
      return isTikTokShopUrl();
    }
    /**
     * Monitora alterações de navegação interna (SPA) sem recarregamento de página.
     */
    watchNavigation(onNavigate) {
      this.lastRoute = getCurrentRoute();
      const interval = setInterval(() => {
        const currentRoute = getCurrentRoute();
        if (currentRoute !== this.lastRoute) {
          Logger.info(MODULE$k, `Navegação detectada: ${currentRoute}`);
          this.lastRoute = currentRoute;
          onNavigate(currentRoute);
        }
      }, 1e3);
      return () => clearInterval(interval);
    }
  }
  class PanelPositionManager {
    panelEl;
    constructor(panelElement) {
      this.panelEl = panelElement;
    }
    /**
     * Aplica a posição na tela respeitando os limites da viewport.
     */
    setPosition(x, y) {
      const maxX = Math.max(0, window.innerWidth - 100);
      const maxY = Math.max(0, window.innerHeight - 48);
      const clampedX = clamp(x, 0, maxX);
      const clampedY = clamp(y, 0, maxY);
      this.panelEl.style.setProperty("--als-x", `${clampedX}px`);
      this.panelEl.style.setProperty("--als-y", `${clampedY}px`);
      StateManager.patchPanel({
        position: { x: clampedX, y: clampedY },
        x: clampedX,
        y: clampedY
      });
    }
    /**
     * Salva a posição atual no storage.
     */
    async savePosition() {
      const x = parseFloat(this.panelEl.style.getPropertyValue("--als-x")) || PANEL_DEFAULTS.DEFAULT_X;
      const y = parseFloat(this.panelEl.style.getPropertyValue("--als-y")) || PANEL_DEFAULTS.DEFAULT_Y;
      await StorageManager.savePanelState({
        position: { x, y },
        x,
        y
      });
    }
    /**
     * Redefine as coordenadas para o padrão.
     */
    async resetPosition() {
      this.setPosition(PANEL_DEFAULTS.DEFAULT_X, PANEL_DEFAULTS.DEFAULT_Y);
      await this.savePosition();
    }
    /**
     * Redefine a largura e altura para os padrões.
     */
    async resetSize() {
      this.panelEl.style.setProperty("--als-w", `${PANEL_DEFAULTS.WIDTH}px`);
      this.panelEl.style.setProperty("--als-h", `${PANEL_DEFAULTS.HEIGHT}px`);
      StateManager.patchPanel({
        size: { width: PANEL_DEFAULTS.WIDTH, height: PANEL_DEFAULTS.HEIGHT },
        width: PANEL_DEFAULTS.WIDTH,
        height: PANEL_DEFAULTS.HEIGHT
      });
      await StorageManager.savePanelState({
        size: { width: PANEL_DEFAULTS.WIDTH, height: PANEL_DEFAULTS.HEIGHT },
        width: PANEL_DEFAULTS.WIDTH,
        height: PANEL_DEFAULTS.HEIGHT
      });
    }
  }
  class PanelDragManager {
    panelEl;
    handleEl;
    positionMgr;
    dragCtx = {
      isDragging: false,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0
    };
    constructor(panelElement, handleElement, positionManager) {
      this.panelEl = panelElement;
      this.handleEl = handleElement;
      this.positionMgr = positionManager;
      this._bindEvents();
    }
    _bindEvents() {
      this.handleEl.addEventListener("mousedown", this._onMouseDown);
    }
    _onMouseDown = (e) => {
      if (e.target.closest(".als-icon-btn")) {
        return;
      }
      const rect = this.panelEl.getBoundingClientRect();
      this.dragCtx = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: rect.left,
        startTop: rect.top
      };
      document.addEventListener("mousemove", this._onMouseMove);
      document.addEventListener("mouseup", this._onMouseUp);
    };
    _onMouseMove = (e) => {
      if (!this.dragCtx.isDragging) return;
      const deltaX = e.clientX - this.dragCtx.startX;
      const deltaY = e.clientY - this.dragCtx.startY;
      const newX = this.dragCtx.startLeft + deltaX;
      const newY = this.dragCtx.startTop + deltaY;
      this.positionMgr.setPosition(newX, newY);
    };
    _onMouseUp = () => {
      if (!this.dragCtx.isDragging) return;
      this.dragCtx.isDragging = false;
      document.removeEventListener("mousemove", this._onMouseMove);
      document.removeEventListener("mouseup", this._onMouseUp);
      this.positionMgr.savePosition().catch(() => {
      });
    };
    destroy() {
      this.handleEl.removeEventListener("mousedown", this._onMouseDown);
      document.removeEventListener("mousemove", this._onMouseMove);
      document.removeEventListener("mouseup", this._onMouseUp);
    }
  }
  class PanelVisibilityManager {
    panelEl;
    minimizeBtnEl;
    constructor(panelElement, minimizeButton) {
      this.panelEl = panelElement;
      this.minimizeBtnEl = minimizeButton;
    }
    /**
     * Define o botão de minimizar após renderização.
     */
    setMinimizeButton(minimizeButton) {
      this.minimizeBtnEl = minimizeButton;
    }
    /**
     * Alterna estado minimizado do painel flutuante.
     */
    toggleMinimize() {
      const isMinimized = this.panelEl.classList.toggle("minimized");
      if (this.minimizeBtnEl) {
        this.minimizeBtnEl.textContent = isMinimized ? "+" : "−";
      }
      StateManager.patchPanel({ minimized: isMinimized });
      StorageManager.savePanelState({ minimized: isMinimized }).catch(() => {
      });
      if (isMinimized) {
        EventBus.emit("panel:minimized", true);
      } else {
        EventBus.emit("panel:restored");
      }
      return isMinimized;
    }
    /**
     * Oculta o painel.
     */
    close() {
      this.panelEl.classList.add("hidden");
      StateManager.patchPanel({ visible: false });
      StorageManager.savePanelState({ visible: false }).catch(() => {
      });
      EventBus.emit("panel:close");
    }
    /**
     * Torna o painel visível na tela.
     */
    show() {
      this.panelEl.classList.remove("hidden");
      StateManager.patchPanel({ visible: true });
      StorageManager.savePanelState({ visible: true }).catch(() => {
      });
    }
    /**
     * Retorna se o painel está visível.
     */
    isVisible() {
      return !this.panelEl.classList.contains("hidden");
    }
    /**
     * Retorna se o painel está minimizado.
     */
    isMinimized() {
      return this.panelEl.classList.contains("minimized");
    }
  }
  class Header {
    container;
    statusBadgeEl;
    statusTextEl;
    constructor(container, onMinimize, onClose) {
      this.container = container;
      this._render(onMinimize, onClose);
      this._subscribe();
    }
    _render(onMinimize, onClose) {
      this.container.innerHTML = `
      <div class="als-header-left">
        <div class="als-logo">▶</div>
        <div class="als-brand">
          <span class="als-brand-name">${APP_NAME.toUpperCase()}</span>
          <span class="als-brand-sub">Copiloto de Lives</span>
        </div>
      </div>
      <div class="als-header-right">
        <div class="als-live-badge detecting" id="als-status-badge">
          <span class="als-live-dot"></span>
          <span id="als-status-text">DETECTANDO</span>
        </div>
        <button class="als-icon-btn" id="als-btn-minimize" title="Minimizar">−</button>
        <button class="als-icon-btn" id="als-btn-close" title="Fechar">✕</button>
      </div>
    `;
      this.statusBadgeEl = this.container.querySelector("#als-status-badge");
      this.statusTextEl = this.container.querySelector("#als-status-text");
      this.container.querySelector("#als-btn-minimize")?.addEventListener("click", onMinimize);
      this.container.querySelector("#als-btn-close")?.addEventListener("click", onClose);
    }
    _subscribe() {
      EventBus.on("live:status_changed", (status) => this.updateStatus(status));
    }
    updateStatus(status) {
      this.statusBadgeEl.className = "als-live-badge";
      const map = {
        LIVE_DETECTING: { cls: "detecting", label: "DETECTANDO" },
        LIVE_ACTIVE: { cls: "active", label: "AO VIVO" },
        LIVE_INACTIVE: { cls: "inactive", label: "AGUARDANDO" },
        LIVE_ENDED: { cls: "ended", label: "ENCERRADA" },
        LIVE_ERROR: { cls: "error", label: "ERRO" }
      };
      const config = map[status] || map.LIVE_DETECTING;
      this.statusBadgeEl.classList.add(config.cls);
      this.statusTextEl.textContent = config.label;
    }
  }
  class TabManager {
    navContainer;
    contentContainer;
    currentTab = "painel";
    constructor(navContainer, contentContainer) {
      this.navContainer = navContainer;
      this.contentContainer = contentContainer;
      this._bindEvents();
    }
    _bindEvents() {
      const buttons = this.navContainer.querySelectorAll(".als-tab-btn");
      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.dataset["tab"];
          if (tab) {
            this.switchTab(tab);
          }
        });
      });
    }
    switchTab(tabId) {
      this.currentTab = tabId;
      const buttons = this.navContainer.querySelectorAll(".als-tab-btn");
      buttons.forEach((b) => {
        b.classList.toggle("active", b.dataset["tab"] === tabId);
      });
      const panes = this.contentContainer.querySelectorAll(".als-pane");
      panes.forEach((p) => {
        p.classList.toggle("active", p.id === `als-pane-${tabId}`);
      });
      EventBus.emit("panel:tab_changed", tabId);
    }
    getActiveTab() {
      return this.currentTab;
    }
  }
  class ToastManager {
    container;
    constructor(containerElement) {
      this.container = containerElement;
      this._subscribe();
    }
    _subscribe() {
      EventBus.on("toast:show", (payload) => {
        this.show(payload.message, payload.type, payload.duration);
      });
    }
    /**
     * Exibe um toast visual no painel.
     */
    show(message, type = "info", duration = DEFAULTS.TOAST_DURATION_MS) {
      const toast = document.createElement("div");
      toast.className = `als-toast ${type}`;
      toast.textContent = message;
      this.container.appendChild(toast);
      while (this.container.children.length > DEFAULTS.MAX_TOASTS) {
        this.container.firstChild?.remove();
      }
      setTimeout(() => {
        toast.style.animation = "als-toastOut 0.25s ease forwards";
        setTimeout(() => toast.remove(), 260);
      }, duration);
    }
  }
  const TikTokSelectors = {
    // ── Página / Detecção de live ───────────────────────────────
    live: {
      /** Indicador de que a live está ativa (badge "AO VIVO") */
      liveIndicator: [
        '[class*="live-status"]',
        '[class*="living-badge"]',
        '[class*="streaming-badge"]',
        '[data-testid="live-badge"]',
        ".live-indicator",
        '[aria-label*="LIVE"]',
        '[aria-label*="Ao vivo"]'
      ],
      /** Container principal do streamer */
      streamerContainer: [
        '[class*="streamer-container"]',
        '[class*="live-studio"]',
        "#live-studio-root",
        ".streamer-main",
        '[class*="live-room-container"]'
      ],
      /** Botão de encerrar live */
      endLiveButton: [
        '[class*="end-live"]',
        '[data-testid="end-live-btn"]',
        'button[class*="end"]',
        'button[aria-label*="End"]',
        'button[aria-label*="Encerrar"]'
      ],
      /** Timer/cronômetro da live */
      liveTimer: [
        '[class*="live-timer"]',
        '[class*="stream-duration"]',
        '[data-testid="live-timer"]',
        '[class*="duration-text"]'
      ],
      /** ID da transmissão */
      roomInfo: [
        "[data-room-id]",
        '[class*="room-info"]',
        'meta[name="live-room-id"]'
      ]
    },
    // ── Produtos ────────────────────────────────────────────────
    products: {
      /** Container da lista de produtos */
      list: [
        '[class*="product-list"]',
        '[class*="product-showcase"]',
        '[data-testid="product-list"]',
        '[class*="goods-list"]'
      ],
      /** Item individual de produto */
      item: [
        '[class*="product-item"]',
        '[class*="product-card"]',
        '[data-testid="product-item"]',
        '[class*="goods-item"]'
      ],
      /** Nome do produto */
      name: [
        '[class*="product-name"]',
        '[class*="product-title"]',
        '[data-testid="product-name"]',
        '[class*="goods-title"]'
      ],
      /** Preço do produto */
      price: [
        '[class*="product-price"]',
        '[class*="price-text"]',
        '[data-testid="product-price"]',
        '[class*="goods-price"]'
      ],
      /** Botão "Fixar" produto */
      pinButton: [
        '[class*="pin-btn"]',
        '[class*="pin-product"]',
        '[data-testid="pin-btn"]',
        'button[class*="pin"]',
        'button[aria-label*="Pin"]',
        'button[aria-label*="Fixar"]'
      ],
      /** Botão "Desafixar" produto */
      unpinButton: [
        '[class*="unpin-btn"]',
        '[class*="unpin-product"]',
        '[data-testid="unpin-btn"]',
        'button[class*="unpin"]',
        'button[aria-label*="Unpin"]',
        'button[aria-label*="Desafixar"]'
      ],
      /** Produto atualmente fixado */
      pinnedProduct: [
        '[class*="pinned-product"]',
        '[class*="product-pinned"]',
        '[data-testid="pinned-product"]',
        '[class*="is-pinned"]'
      ],
      /** Botão de atualizar lista de produtos */
      refreshButton: [
        '[class*="refresh-products"]',
        '[data-testid="refresh-goods"]',
        'button[aria-label*="Refresh"]'
      ]
    },
    // ── Botões de Ação Gerais ────────────────────────────────────
    buttons: {
      pin: [
        '[class*="pin-btn"]',
        '[class*="pin-product"]',
        '[data-testid="pin-btn"]',
        'button[class*="pin"]'
      ],
      unpin: [
        '[class*="unpin-btn"]',
        '[class*="unpin-product"]',
        '[data-testid="unpin-btn"]',
        'button[class*="unpin"]'
      ],
      refresh: [
        '[class*="refresh-btn"]',
        '[class*="refresh-products"]',
        'button[class*="refresh"]'
      ],
      endLive: [
        '[class*="end-live"]',
        '[data-testid="end-live-btn"]',
        'button[class*="end"]'
      ]
    },
    // ── Chat ─────────────────────────────────────────────────────
    chat: {
      /** Container das mensagens */
      container: [
        '[class*="chat-container"]',
        '[class*="comment-list"]',
        '[data-testid="chat-list"]',
        '[class*="message-list"]'
      ],
      /** Item de mensagem */
      message: [
        '[class*="chat-message"]',
        '[class*="comment-item"]',
        '[data-testid="chat-message"]',
        '[class*="message-item"]'
      ],
      /** Autor da mensagem */
      author: [
        '[class*="chat-author"]',
        '[class*="comment-user"]',
        '[class*="username"]',
        '[class*="nickname"]'
      ],
      /** Texto da mensagem */
      text: [
        '[class*="chat-text"]',
        '[class*="comment-text"]',
        '[class*="message-content"]',
        '[class*="content-text"]'
      ],
      /** Input de novo comentário */
      input: [
        'input[class*="chat-input"]',
        'input[placeholder*="coment"]',
        'input[placeholder*="message"]',
        'input[placeholder*="chat"]',
        '[class*="chat-input"] input',
        '[contenteditable="true"][class*="chat"]'
      ],
      /** Botão enviar comentário */
      sendButton: [
        '[class*="send-btn"]',
        '[class*="chat-send"]',
        'button[class*="send"]',
        '[data-testid="send-btn"]'
      ]
    },
    // ── Métricas ─────────────────────────────────────────────────
    metrics: {
      /** GMV total da live */
      gmv: [
        '[class*="gmv-value"]',
        '[class*="revenue-value"]',
        '[data-testid="gmv"]',
        '[class*="total-sales"]'
      ],
      /** Número de pedidos */
      orders: [
        '[class*="order-count"]',
        '[class*="orders-value"]',
        '[data-testid="orders"]',
        '[class*="total-orders"]'
      ],
      /** Espectadores simultâneos */
      viewers: [
        '[class*="viewer-count"]',
        '[class*="online-count"]',
        '[data-testid="viewers"]',
        '[class*="watch-count"]'
      ],
      /** Itens vendidos */
      soldItems: [
        '[class*="sold-count"]',
        '[class*="items-sold"]',
        '[data-testid="sold-items"]'
      ]
    },
    // ── Vendas / Notificações de venda ───────────────────────────
    sales: {
      /** Notificação de nova venda */
      notification: [
        '[class*="sale-notification"]',
        '[class*="order-notification"]',
        '[class*="purchase-notification"]',
        '[class*="sold-tip"]'
      ],
      /** Container de vendas recentes */
      container: [
        '[class*="recent-sales"]',
        '[class*="order-list"]'
      ]
    }
  };
  const MODULE$j = "TikTokLiveAdapter";
  class TikTokLiveAdapter {
    /**
     * Verifica no DOM se existe uma transmissão ativa.
     * Não retorna sucesso falso caso a LIVE não esteja ativa.
     */
    isLiveActive() {
      if (!isTikTokShopUrl()) {
        return false;
      }
      const badge = queryWithFallbacks(TikTokSelectors.live.liveIndicator);
      if (badge && badge.textContent && /live|ao vivo|gravando/i.test(badge.textContent)) {
        Logger.debug(MODULE$j, "Badge ativo encontrado no DOM");
        return true;
      }
      const container = queryWithFallbacks(TikTokSelectors.live.streamerContainer);
      if (container) {
        const endBtn = queryWithFallbacks(TikTokSelectors.live.endLiveButton, container);
        if (endBtn) {
          Logger.debug(MODULE$j, "Container de estúdio com botão de encerrar encontrado");
          return true;
        }
      }
      const timer = queryWithFallbacks(TikTokSelectors.live.liveTimer);
      if (timer && timer.textContent && timer.textContent.trim().length > 0) {
        return true;
      }
      return false;
    }
    /**
     * Tenta extrair o identificador único da LIVE se disponível no DOM ou URL.
     */
    getLiveId() {
      try {
        const roomEl = queryWithFallbacks(TikTokSelectors.live.roomInfo);
        if (roomEl) {
          const id = roomEl.dataset["roomId"] || roomEl.getAttribute("content") || roomEl.getAttribute("data-room-id");
          if (id) return id;
        }
        const match = window.location.href.match(/streamer\/(\d+)/);
        if (match && match[1]) {
          return match[1];
        }
      } catch (err) {
        Logger.debug(MODULE$j, "Não foi possível extrair liveId:", err);
      }
      return void 0;
    }
    /**
     * Retorna o status detalhado atual da LIVE.
     */
    getLiveStatus() {
      if (!isTikTokShopUrl()) {
        return "LIVE_INACTIVE";
      }
      const active = this.isLiveActive();
      if (active) {
        return "LIVE_ACTIVE";
      }
      if (window.location.href.includes("streamer") || window.location.href.includes("live-studio")) {
        return "LIVE_DETECTING";
      }
      return "LIVE_INACTIVE";
    }
    /**
     * Extrai métricas reais do DOM do TikTok Shop.
     * Não inventa dados fictícios.
     */
    getLiveMetrics() {
      const metrics = {
        updatedAt: Date.now(),
        source: "tiktok"
      };
      try {
        const gmvEl = queryWithFallbacks(TikTokSelectors.metrics.gmv);
        if (gmvEl && gmvEl.textContent) {
          const raw = gmvEl.textContent.replace(/[^0-9.,]/g, "").replace(",", ".");
          const val = parseFloat(raw);
          if (!isNaN(val)) metrics.gmv = val;
        }
        const viewersEl = queryWithFallbacks(TikTokSelectors.metrics.viewers);
        if (viewersEl && viewersEl.textContent) {
          const raw = viewersEl.textContent.replace(/[^0-9]/g, "");
          const val = parseInt(raw, 10);
          if (!isNaN(val)) metrics.viewers = val;
        }
        const ordersEl = queryWithFallbacks(TikTokSelectors.metrics.orders);
        if (ordersEl && ordersEl.textContent) {
          const raw = ordersEl.textContent.replace(/[^0-9]/g, "");
          const val = parseInt(raw, 10);
          if (!isNaN(val)) metrics.salesCount = val;
        }
        const soldEl = queryWithFallbacks(TikTokSelectors.metrics.soldItems);
        if (soldEl && soldEl.textContent) {
          const raw = soldEl.textContent.replace(/[^0-9]/g, "");
          const val = parseInt(raw, 10);
          if (!isNaN(val)) metrics.soldItems = val;
        }
      } catch (err) {
        Logger.warn(MODULE$j, "Erro ao extrair métricas do DOM:", err);
        metrics.source = "unknown";
      }
      return metrics;
    }
    /**
     * Dispara o encerramento da LIVE interagindo com o botão do TikTok Shop.
     */
    async endLive() {
      try {
        const btn = queryWithFallbacks(TikTokSelectors.live.endLiveButton);
        if (!btn) {
          return {
            success: false,
            error: "Botão de encerrar live não encontrado no DOM"
          };
        }
        btn.click();
        Logger.info(MODULE$j, "Clique no botão de encerrar live executado");
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: `Falha ao encerrar live: ${String(err)}`
        };
      }
    }
  }
  const MODULE$i = "TikTokProductAdapter";
  class TikTokProductAdapter {
    /**
     * Lê a lista de produtos disponíveis atualmente no DOM do TikTok Shop.
     */
    getProducts() {
      const items = queryAllWithFallbacks(TikTokSelectors.products.item);
      if (!items.length) {
        Logger.debug(MODULE$i, "Nenhum item de produto encontrado no DOM");
        return [];
      }
      const products = items.map((item, index) => {
        const nameEl = queryWithFallbacks(TikTokSelectors.products.name, item);
        const priceEl = queryWithFallbacks(TikTokSelectors.products.price, item);
        const isPinned = !!queryWithFallbacks(TikTokSelectors.products.pinnedProduct, item);
        const htmlEl = item;
        const rawId = htmlEl.dataset["productId"] || htmlEl.dataset["id"] || htmlEl.dataset["goodsId"] || `prod-${index + 1}`;
        const rawPrice = priceEl?.textContent?.replace(/[^0-9.,]/g, "").replace(",", ".") ?? "0";
        const price = parseFloat(rawPrice) || 0;
        return {
          id: rawId,
          name: nameEl?.textContent?.trim() || `Produto ${index + 1}`,
          price: price > 0 ? price : void 0,
          position: index + 1,
          isPinned
        };
      });
      Logger.debug(MODULE$i, `${products.length} produtos mapeados do DOM`);
      return products;
    }
    /**
     * Obtém o produto atualmente fixado no topo da transmissão.
     */
    getPinnedProduct() {
      const products = this.getProducts();
      return products.find((p) => p.isPinned) ?? null;
    }
    /**
     * Atualiza e retorna a lista de produtos acionando o botão de recarga caso exista.
     */
    async refreshProducts() {
      try {
        const refreshBtn = queryWithFallbacks(TikTokSelectors.products.refreshButton);
        if (refreshBtn) {
          refreshBtn.click();
          await sleep(600);
        }
        const products = this.getProducts();
        return {
          success: true,
          data: products
        };
      } catch (err) {
        return {
          success: false,
          error: `Falha ao recarregar produtos: ${String(err)}`,
          data: []
        };
      }
    }
    /**
     * Fixa um produto pelo seu ID com verificação de confirmação no DOM.
     */
    async pinProduct(productId) {
      try {
        const items = queryAllWithFallbacks(TikTokSelectors.products.item);
        if (!items.length) {
          return {
            success: false,
            error: "Lista de produtos não disponível no DOM do TikTok"
          };
        }
        let targetItem = null;
        for (const item of items) {
          const el = item;
          const id = el.dataset["productId"] || el.dataset["id"] || el.dataset["goodsId"];
          if (id === productId) {
            targetItem = el;
            break;
          }
        }
        if (!targetItem) {
          const indexMatch = productId.match(/prod-(\d+)/);
          if (indexMatch && indexMatch[1]) {
            const idx = parseInt(indexMatch[1], 10) - 1;
            if (items[idx]) {
              targetItem = items[idx];
            }
          }
        }
        if (!targetItem) {
          return {
            success: false,
            error: `Produto com identificador "${productId}" não foi localizado no DOM`
          };
        }
        const pinBtn = queryWithFallbacks(TikTokSelectors.products.pinButton, targetItem);
        if (!pinBtn) {
          return {
            success: false,
            error: "Botão de fixar não encontrado para o produto selecionado"
          };
        }
        pinBtn.click();
        Logger.info(MODULE$i, `Comando de fixação disparado para produto "${productId}"`);
        await sleep(750);
        const isConfirmed = this._verifyPinnedState(productId);
        if (!isConfirmed) {
          Logger.warn(MODULE$i, `Ação de fixação do produto "${productId}" não confirmada pelo TikTok Shop`);
          return {
            success: false,
            error: "Ação não confirmada pelo TikTok Shop"
          };
        }
        const updatedProducts = this.getProducts();
        const pinnedProduct = updatedProducts.find((p) => p.id === productId) || {
          id: productId,
          name: "Produto Fixado",
          isPinned: true
        };
        return {
          success: true,
          data: { product: pinnedProduct }
        };
      } catch (err) {
        return {
          success: false,
          error: `Erro ao fixar produto: ${String(err)}`
        };
      }
    }
    /**
     * Desafixa o produto atualmente fixado no topo da transmissão.
     */
    async unpinProduct() {
      try {
        let unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton);
        if (!unpinBtn) {
          const pinnedContainer = queryWithFallbacks(TikTokSelectors.products.pinnedProduct);
          if (pinnedContainer) {
            unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton, pinnedContainer);
          }
        }
        if (!unpinBtn) {
          return {
            success: false,
            error: "Nenhum produto fixado ou botão de desafixar encontrado"
          };
        }
        unpinBtn.click();
        await sleep(600);
        const stillPinned = this.getPinnedProduct();
        if (stillPinned) {
          return {
            success: false,
            error: "Ação não confirmada pelo TikTok Shop"
          };
        }
        Logger.info(MODULE$i, "Produto desafixado com sucesso");
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: `Erro ao desafixar produto: ${String(err)}`
        };
      }
    }
    _verifyPinnedState(productId) {
      const products = this.getProducts();
      const product = products.find((p) => p.id === productId);
      if (product?.isPinned) return true;
      const pinnedBadge = queryWithFallbacks(TikTokSelectors.products.pinnedProduct);
      return !!pinnedBadge;
    }
  }
  const MODULE$h = "PlatformBridge";
  const BRIDGE_EVENTS = {
    COMMAND: "LIVE_REMOTE_COMMAND",
    STATE: "LIVE_REMOTE_STATE",
    HEARTBEAT: "LIVE_REMOTE_HEARTBEAT",
    SYNC_AUTO: "LIVE_REMOTE_SYNC_AUTO",
    RESPONSE: "LIVE_REMOTE_RESPONSE"
  };
  class PlatformBridge {
    isMainWorld;
    sourceTag;
    targetTag;
    handlers = /* @__PURE__ */ new Map();
    pendingRequests = /* @__PURE__ */ new Map();
    constructor(isMainWorld) {
      this.isMainWorld = isMainWorld;
      this.sourceTag = isMainWorld ? "COPILO_MAIN" : "COPILO_ISOLATED";
      this.targetTag = isMainWorld ? "COPILO_ISOLATED" : "COPILO_MAIN";
      this._initListener();
    }
    _initListener() {
      window.addEventListener("message", async (event) => {
        if (event.source !== window || !event.data || typeof event.data !== "object") {
          return;
        }
        const envelope = event.data;
        if (envelope.source !== this.targetTag) {
          return;
        }
        if (envelope.type === BRIDGE_EVENTS.RESPONSE && this.pendingRequests.has(envelope.correlationId)) {
          const pending = this.pendingRequests.get(envelope.correlationId);
          clearTimeout(pending.timer);
          this.pendingRequests.delete(envelope.correlationId);
          pending.resolve(envelope.payload);
          return;
        }
        const handlerKey = envelope.action ? `${envelope.type}:${envelope.action}` : envelope.type;
        const handler = this.handlers.get(handlerKey) || this.handlers.get(envelope.type);
        if (handler) {
          try {
            const result = await handler(envelope);
            if (envelope.correlationId) {
              this.sendResponse(envelope.correlationId, result);
            }
          } catch (err) {
            Logger.error(MODULE$h, `Erro ao processar mensagem da ponte [${envelope.type}]:`, err);
            if (envelope.correlationId) {
              this.sendResponse(envelope.correlationId, { error: String(err) });
            }
          }
        }
      });
    }
    /**
     * Registra um listener para eventos vindos do outro mundo.
     */
    on(type, actionOrHandler, handler) {
      let key;
      let fn;
      if (typeof actionOrHandler === "string" && handler) {
        key = `${type}:${actionOrHandler}`;
        fn = handler;
      } else {
        key = type;
        fn = actionOrHandler;
      }
      this.handlers.set(key, fn);
      return () => this.handlers.delete(key);
    }
    /**
     * Envia uma mensagem sem esperar resposta (fire-and-forget).
     */
    post(type, action, payload) {
      const envelope = {
        source: this.sourceTag,
        type,
        action,
        correlationId: "",
        payload,
        timestamp: Date.now()
      };
      window.postMessage(envelope, "*");
    }
    /**
     * Envia um comando e aguarda a resposta assíncrona (Request / Response).
     */
    request(type, action, payload, timeoutMs = 5e3) {
      const correlationId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(correlationId);
          reject(new Error(`Timeout na comunicação com ${this.targetTag} [${type}:${action || ""}]`));
        }, timeoutMs);
        this.pendingRequests.set(correlationId, { resolve, reject, timer });
        const envelope = {
          source: this.sourceTag,
          type,
          action,
          correlationId,
          payload,
          timestamp: Date.now()
        };
        window.postMessage(envelope, "*");
      });
    }
    /**
     * Envia a resposta de uma requisição para o outro mundo.
     */
    sendResponse(correlationId, payload) {
      const envelope = {
        source: this.sourceTag,
        type: BRIDGE_EVENTS.RESPONSE,
        correlationId,
        payload,
        timestamp: Date.now()
      };
      window.postMessage(envelope, "*");
    }
  }
  const MODULE$g = "LiveRemoteAgent (ISOLATED)";
  class LiveRemoteAgent {
    bridge = new PlatformBridge(false);
    constructor() {
      Logger.info(MODULE$g, "Agente do Isolated World inicializado");
    }
    /**
     * Envia comando de fixar produto para o MAIN WORLD.
     */
    async pinProduct(productId) {
      try {
        return await this.bridge.request(
          BRIDGE_EVENTS.COMMAND,
          "PIN_PRODUCT",
          { productId },
          4e3
        );
      } catch (err) {
        Logger.warn(MODULE$g, "Ponte falhou ao fixar produto, usando fallback:", err);
        return { success: false, error: String(err) };
      }
    }
    /**
     * Envia comando de desafixar produto para o MAIN WORLD.
     */
    async unpinProduct() {
      try {
        return await this.bridge.request(
          BRIDGE_EVENTS.COMMAND,
          "UNPIN_PRODUCT",
          {},
          3e3
        );
      } catch (err) {
        Logger.warn(MODULE$g, "Ponte falhou ao desafixar produto:", err);
        return { success: false, error: String(err) };
      }
    }
    /**
     * Solicita atualização de produtos diretamente ao MAIN WORLD.
     */
    async refreshProducts() {
      try {
        return await this.bridge.request(
          BRIDGE_EVENTS.COMMAND,
          "REFRESH_PRODUCTS",
          {},
          4e3
        );
      } catch (err) {
        Logger.warn(MODULE$g, "Ponte falhou ao recarregar produtos:", err);
        return { success: false, error: String(err), data: [] };
      }
    }
    /**
     * Envia mensagem no chat através do MAIN WORLD.
     */
    async sendChatMessage(text) {
      try {
        return await this.bridge.request(
          BRIDGE_EVENTS.COMMAND,
          "SEND_CHAT",
          { text },
          3e3
        );
      } catch (err) {
        Logger.warn(MODULE$g, "Ponte falhou ao enviar chat:", err);
        return { success: false, error: String(err) };
      }
    }
    /**
     * Ping de heartbeat para o MAIN WORLD.
     */
    async pingHeartbeat() {
      try {
        return await this.bridge.request(
          BRIDGE_EVENTS.HEARTBEAT,
          "",
          {},
          2e3
        );
      } catch {
        return null;
      }
    }
  }
  const liveRemoteAgent = new LiveRemoteAgent();
  const MODULE$f = "TikTokShopAdapter";
  class TikTokShopAdapter {
    live = new TikTokLiveAdapter();
    products = new TikTokProductAdapter();
    isLiveActive() {
      return this.live.isLiveActive();
    }
    getLiveMetrics() {
      return this.live.getLiveMetrics();
    }
    getProducts() {
      return this.products.getProducts();
    }
    getPinnedProduct() {
      return this.products.getPinnedProduct();
    }
    async pinProduct(productId) {
      Logger.info(MODULE$f, `pinProduct chamado para ID: ${productId}`);
      const remoteRes = await liveRemoteAgent.pinProduct(productId);
      if (remoteRes.success) {
        return remoteRes;
      }
      Logger.info(MODULE$f, "Tentando fixação via fallback no DOM local...");
      return this.products.pinProduct(productId);
    }
    async unpinProduct() {
      Logger.info(MODULE$f, "unpinProduct chamado");
      const remoteRes = await liveRemoteAgent.unpinProduct();
      if (remoteRes.success) {
        return remoteRes;
      }
      return this.products.unpinProduct();
    }
    async refreshProducts() {
      const remoteRes = await liveRemoteAgent.refreshProducts();
      if (remoteRes.success && remoteRes.data && remoteRes.data.length > 0) {
        return remoteRes;
      }
      return this.products.refreshProducts();
    }
    async sendChatMessage(text) {
      const remoteRes = await liveRemoteAgent.sendChatMessage(text);
      if (remoteRes.success) {
        return remoteRes;
      }
      try {
        const input = queryWithFallbacks(TikTokSelectors.chat.input);
        if (!input) {
          return {
            success: false,
            error: "Input de comentário do chat não encontrado no DOM"
          };
        }
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        if (nativeSetter && input instanceof HTMLInputElement) {
          nativeSetter.call(input, text);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          input.textContent = text;
          input.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
        }
        await sleep(200);
        const sendBtn = queryWithFallbacks(TikTokSelectors.chat.sendButton);
        if (sendBtn) {
          sendBtn.click();
          Logger.info(MODULE$f, `Mensagem enviada no chat: "${text.substring(0, 30)}..."`);
          return { success: true };
        }
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: `Falha ao enviar mensagem no chat: ${String(err)}`
        };
      }
    }
    async endLive() {
      return this.live.endLive();
    }
  }
  const tiktokAdapter = new TikTokShopAdapter();
  const MODULE$e = "LiveController";
  class LiveController {
    /**
     * Inicia ou retoma o estado ativo da transmissão local.
     */
    startLive() {
      const startedAt = Date.now();
      StateManager.setLiveStatus("LIVE_ACTIVE");
      StateManager.patchLive({ startedAt });
      EventBus.emit("live:started", { startedAt });
      EventBus.emit("toast:show", {
        message: "🔴 Transmissão iniciada no Copilo Live Shop",
        type: "success"
      });
      Logger.info(MODULE$e, "Live iniciada manualmente via controller");
      return {
        success: true,
        data: { startedAt }
      };
    }
    /**
     * Encerra a LIVE no TikTok Shop e no estado local.
     */
    async endLive() {
      Logger.info(MODULE$e, "Comando de encerramento da LIVE acionado");
      const result = await tiktokAdapter.endLive();
      StateManager.setLiveStatus("LIVE_ENDED");
      EventBus.emit("live:ended");
      EventBus.emit("toast:show", {
        message: "⬛ Transmissão encerrada",
        type: "info"
      });
      return result;
    }
    /**
     * Obtém o estado atual completo da transmissão.
     */
    getLiveState() {
      return StateManager.live;
    }
    /**
     * Consulta se a LIVE está ativa no momento.
     */
    isLiveActive() {
      return StateManager.live.status === "LIVE_ACTIVE" || tiktokAdapter.isLiveActive();
    }
  }
  const MODULE$d = "SalesController";
  class SalesController {
    /**
     * Registra manualmente uma nova venda ou dispara processamento de venda.
     */
    registerSale(sale) {
      Logger.info(MODULE$d, `Registrando venda: ${sale.productName} (R$ ${sale.amount})`);
      StateManager.addSale(sale);
      StorageManager.saveSalesHistory([...StateManager.sales]).catch(() => {
      });
    }
    /**
     * Retorna a lista de vendas recentes.
     */
    getRecentSales() {
      return [...StateManager.sales];
    }
    /**
     * Limpa o histórico de vendas da sessão.
     */
    clearSales() {
      StateManager.patchLive({ sales: [] });
      StateManager.updateMetrics({
        gmv: 0,
        soldItems: 0,
        salesCount: 0,
        salesPerHour: 0
      });
      StorageManager.saveSalesHistory([]).catch(() => {
      });
      EventBus.emit("sales:updated", []);
      EventBus.emit("toast:show", {
        message: "Histórico de vendas limpo",
        type: "info"
      });
    }
    /**
     * Calcula o resumo de vendas agrupado por produto com ranking e GMV.
     */
    getProductSalesSummary() {
      const sales = StateManager.sales;
      const totalGmv = sales.reduce((acc, s) => acc + (s.amount ?? 0), 0);
      const map = /* @__PURE__ */ new Map();
      sales.forEach((sale) => {
        const key = sale.productId || sale.productName || "Outros";
        const current = map.get(key) || {
          count: 0,
          gmv: 0,
          name: sale.productName || "Produto",
          id: sale.productId
        };
        current.count += sale.quantity || 1;
        current.gmv += sale.amount || 0;
        map.set(key, current);
      });
      const summaries = Array.from(map.values()).map((item) => ({
        productId: item.id,
        productName: item.name,
        totalSales: item.count,
        totalGmv: item.gmv,
        percentage: totalGmv > 0 ? Number((item.gmv / totalGmv * 100).toFixed(1)) : 0
      }));
      return summaries.sort((a, b) => b.totalGmv - a.totalGmv);
    }
    /**
     * Retorna as métricas de vendas atuais.
     */
    getMetrics() {
      return StateManager.metrics;
    }
  }
  class DashboardModule {
    liveCtrl = new LiveController();
    salesCtrl = new SalesController();
    /**
     * Inicia a sessão da LIVE manualmente pelo painel.
     */
    startSession() {
      return this.liveCtrl.startLive();
    }
    /**
     * Encerra a sessão da LIVE.
     */
    async endSession() {
      return this.liveCtrl.endLive();
    }
    /**
     * Obtém as métricas consolidadas em tempo real.
     */
    getMetrics() {
      return StateManager.metrics;
    }
    /**
     * Obtém o status da LIVE.
     */
    getStatus() {
      return StateManager.live.status;
    }
    /**
     * Obtém as vendas recentes para exibição no feed.
     */
    getRecentSales() {
      return this.salesCtrl.getRecentSales();
    }
    /**
     * Limpa o feed de vendas.
     */
    clearFeed() {
      this.salesCtrl.clearSales();
    }
  }
  const MODULE$c = "ProductController";
  class ProductController {
    /**
     * Recarrega a lista de produtos do TikTok Shop.
     */
    async refreshProducts() {
      try {
        const result = await tiktokAdapter.refreshProducts();
        if (result.success && result.data) {
          StateManager.setProducts(result.data);
          Logger.info(MODULE$c, `${result.data.length} produtos sincronizados`);
          return result;
        }
        const currentProducts = tiktokAdapter.getProducts();
        StateManager.setProducts(currentProducts);
        return { success: true, data: currentProducts };
      } catch (err) {
        Logger.error(MODULE$c, "Erro ao atualizar catálogo de produtos:", err);
        return { success: false, error: String(err) };
      }
    }
    /**
     * Fixa um produto e sincroniza o estado.
     */
    async pinProduct(productId) {
      if (!productId) {
        return { success: false, error: "Identificador do produto é obrigatório" };
      }
      Logger.info(MODULE$c, `Fixando produto ID: ${productId}`);
      const result = await tiktokAdapter.pinProduct(productId);
      if (result.success) {
        StateManager.setPinnedProduct(productId);
        EventBus.emit("products:pinned", { productId });
        EventBus.emit("product:pinned", { productId });
        EventBus.emit("toast:show", {
          message: "📌 Produto fixado com sucesso",
          type: "success"
        });
      } else {
        EventBus.emit("products:pin_failed", { error: result.error ?? "Falha ao fixar" });
        EventBus.emit("toast:show", {
          message: `⚠ ${result.error || "Ação não confirmada pelo TikTok Shop"}`,
          type: "warn"
        });
      }
      return result;
    }
    /**
     * Desafixa o produto fixado na LIVE.
     */
    async unpinProduct() {
      Logger.info(MODULE$c, "Desafixando produto atual");
      const result = await tiktokAdapter.unpinProduct();
      if (result.success) {
        StateManager.setPinnedProduct(void 0);
        EventBus.emit("products:unpinned");
        EventBus.emit("product:unpinned");
        EventBus.emit("toast:show", {
          message: "Produto desafixado",
          type: "info"
        });
      } else {
        EventBus.emit("toast:show", {
          message: `⚠ ${result.error || "Não foi possível desafixar"}`,
          type: "warn"
        });
      }
      return result;
    }
    /**
     * Retorna os produtos armazenados no estado central.
     */
    getProducts() {
      return [...StateManager.products];
    }
    /**
     * Retorna o produto atualmente fixado.
     */
    getPinnedProduct() {
      const pinnedId = StateManager.live.pinnedProductId;
      if (!pinnedId) return null;
      return StateManager.products.find((p) => p.id === pinnedId) || null;
    }
  }
  class ProductsModule {
    productCtrl = new ProductController();
    /**
     * Recarrega catálogo de produtos da transmissão.
     */
    async refreshCatalog() {
      return this.productCtrl.refreshProducts();
    }
    /**
     * Fixa um produto na LIVE.
     */
    async pin(productId) {
      return this.productCtrl.pinProduct(productId);
    }
    /**
     * Desafixa o produto atualmente fixado na LIVE.
     */
    async unpin() {
      return this.productCtrl.unpinProduct();
    }
    /**
     * Retorna os produtos listados.
     */
    getProducts() {
      return [...StateManager.products];
    }
    /**
     * Retorna o produto fixado atual.
     */
    getPinnedProduct() {
      return this.productCtrl.getPinnedProduct();
    }
  }
  class SalesModule {
    salesCtrl = new SalesController();
    /**
     * Adiciona uma venda processada.
     */
    recordSale(sale) {
      this.salesCtrl.registerSale(sale);
    }
    /**
     * Obtém histórico de vendas.
     */
    getHistory() {
      return this.salesCtrl.getRecentSales();
    }
    /**
     * Obtém ranking de produtos mais vendidos.
     */
    getProductRanking() {
      return this.salesCtrl.getProductSalesSummary();
    }
    /**
     * Limpa histórico.
     */
    clear() {
      this.salesCtrl.clearSales();
    }
    /**
     * Obtém faturamento acumulado total.
     */
    getTotalGmv() {
      return StateManager.metrics.gmv;
    }
  }
  class GoalsModule {
    hasCelebrated = false;
    /**
     * Define uma nova meta de GMV.
     */
    async setGoal(targetAmount) {
      if (targetAmount <= 0) return;
      this.hasCelebrated = false;
      StateManager.patchSettings({ gmvGoal: targetAmount });
      await StorageManager.saveSettings({ gmvGoal: targetAmount });
      EventBus.emit("toast:show", {
        message: `🎯 Meta definida: ${formatCurrency(targetAmount)}`,
        type: "success"
      });
    }
    /**
     * Remove a meta atual.
     */
    async removeGoal() {
      StateManager.patchSettings({ gmvGoal: null });
      await StorageManager.saveSettings({ gmvGoal: null });
      this.hasCelebrated = false;
    }
    /**
     * Obtém os dados e status da meta atual.
     */
    getGoalStatus() {
      const goal = StateManager.settings.gmvGoal;
      const currentGmv = StateManager.metrics.gmv;
      if (!goal || goal <= 0) {
        return {
          goal: null,
          currentGmv,
          percentage: 0,
          remaining: 0,
          isReached: false
        };
      }
      const percentage = Math.min(100, Math.round(currentGmv / goal * 100));
      const remaining = Math.max(0, goal - currentGmv);
      const isReached = currentGmv >= goal;
      if (isReached && !this.hasCelebrated) {
        this.hasCelebrated = true;
        EventBus.emit("toast:show", {
          message: "🏆 Parabéns! Meta de GMV atingida!",
          type: "success"
        });
      }
      return {
        goal,
        currentGmv,
        percentage,
        remaining,
        isReached
      };
    }
  }
  const MODULE$b = "AutomationController";
  class AutomationController {
    repinTimer = null;
    productCtrl = new ProductController();
    lastActionTimestamp = 0;
    isProcessing = false;
    constructor() {
      EventBus.on("live:ended", () => {
        if (this.isRunning()) {
          Logger.info(MODULE$b, "LIVE encerrada — desligando renovação automática de produto");
          this.stop();
          EventBus.emit("toast:show", {
            message: "LIVE encerrada — renovação de produto desligada",
            type: "info"
          });
        }
      });
    }
    /**
     * Inicia a automação de fixação para um produto específico.
     */
    start(productId, intervalSecs = DEFAULTS.REPIN_INTERVAL_SECS) {
      if (!productId) {
        EventBus.emit("toast:show", {
          message: "⚠ Selecione um produto para iniciar a automação",
          type: "warn"
        });
        return false;
      }
      if (StateManager.live.status !== "LIVE_ACTIVE") {
        Logger.warn(MODULE$b, "Tentativa de iniciar automação sem LIVE ativa");
      }
      this.stop();
      const intervalMs = Math.max(10, intervalSecs) * 1e3;
      Logger.info(MODULE$b, `Iniciando automação: Produto ${productId}, Intervalo ${intervalSecs}s`);
      StateManager.patchLive({
        automationEnabled: true,
        automationProductId: productId,
        automationIntervalSecs: intervalSecs
      });
      StateManager.patchSettings({
        automation: {
          enabled: true,
          selectedProductId: productId,
          renewalIntervalMs: intervalMs,
          cooldownMs: DEFAULTS.AUTO_COOLDOWN_MS
        }
      });
      EventBus.emit("automation:started", { productId, intervalSecs });
      EventBus.emit("toast:show", {
        message: `▶ Automação ativada (${intervalSecs}s)`,
        type: "success"
      });
      this._executeRepin(productId);
      this.repinTimer = setInterval(() => {
        this._executeRepin(productId);
      }, intervalMs);
      return true;
    }
    /**
     * Encerra o timer de automação.
     */
    stop() {
      if (this.repinTimer) {
        clearInterval(this.repinTimer);
        this.repinTimer = null;
      }
      StateManager.patchLive({ automationEnabled: false });
      StateManager.patchSettings({
        automation: {
          ...StateManager.settings.automation,
          enabled: false
        }
      });
      EventBus.emit("automation:stopped");
      Logger.info(MODULE$b, "Automação parada");
    }
    /**
     * Verifica se a automação está rodando.
     */
    isRunning() {
      return this.repinTimer !== null;
    }
    async _executeRepin(productId) {
      if (this.isProcessing) return;
      const now = Date.now();
      if (now - this.lastActionTimestamp < DEFAULTS.AUTO_COOLDOWN_MS) {
        Logger.debug(MODULE$b, "Cooldown ativo — ignorando ciclo de renovação");
        return;
      }
      if (StateManager.live.status === "LIVE_ENDED" || StateManager.live.status === "LIVE_INACTIVE") {
        this.stop();
        return;
      }
      this.isProcessing = true;
      this.lastActionTimestamp = now;
      try {
        Logger.debug(MODULE$b, `Executando renovação de fixação para produto: ${productId}`);
        EventBus.emit("automation:repin", { productId });
        await this.productCtrl.pinProduct(productId);
      } catch (err) {
        Logger.error(MODULE$b, "Erro durante renovação automática de produto:", err);
      } finally {
        this.isProcessing = false;
      }
    }
  }
  class AutomationModule {
    autoPinCtrl = new AutomationController();
    /**
     * Inicia a fixação automática de um produto.
     */
    startAutoPin(productId, intervalSecs) {
      return this.autoPinCtrl.start(productId, intervalSecs);
    }
    /**
     * Encerra a fixação automática.
     */
    stopAutoPin() {
      this.autoPinCtrl.stop();
    }
    /**
     * Salva e sincroniza mensagem de chat automática.
     */
    async addChatMessage(text) {
      const current = StateManager.settings.chatMessages || [];
      const newMessage = {
        id: Date.now(),
        text,
        active: true
      };
      const updated = [...current, newMessage];
      StateManager.patchSettings({ chatMessages: updated });
      await StorageManager.saveSettings({ chatMessages: updated });
      return updated;
    }
    /**
     * Remove mensagem de chat.
     */
    async removeChatMessage(id) {
      const current = StateManager.settings.chatMessages || [];
      const updated = current.filter((m) => m.id !== id);
      StateManager.patchSettings({ chatMessages: updated });
      await StorageManager.saveSettings({ chatMessages: updated });
      return updated;
    }
    /**
     * Salva regra de resposta automática.
     */
    async saveAutoResponse(response) {
      const current = StateManager.settings.autoResponses || [];
      const exists = current.some((r) => r.id === response.id);
      const updated = exists ? current.map((r) => r.id === response.id ? response : r) : [...current, response];
      StateManager.patchSettings({ autoResponses: updated });
      await StorageManager.saveSettings({ autoResponses: updated });
      return updated;
    }
    /**
     * Remove regra de resposta automática.
     */
    async removeAutoResponse(id) {
      const current = StateManager.settings.autoResponses || [];
      const updated = current.filter((r) => r.id !== id);
      StateManager.patchSettings({ autoResponses: updated });
      await StorageManager.saveSettings({ autoResponses: updated });
      return updated;
    }
  }
  const MODULE$a = "LicenseManager";
  class LicenseManager {
    /**
     * Valida uma chave de ativação localmente ou via backend futuro.
     */
    async validate(key) {
      const cleanKey = key.trim().toUpperCase();
      if (!cleanKey) {
        this._updatePlan("FREE", false);
        return { status: "FREE", valid: false, message: "Chave não informada" };
      }
      if (cleanKey.startsWith("PRO-") && cleanKey.length >= 10) {
        this._updatePlan("PRO", true, cleanKey);
        Logger.info(MODULE$a, "Plano PRO ativado com sucesso");
        return { status: "PRO", valid: true, message: "Licença PRO ativada com sucesso!" };
      }
      if (cleanKey.startsWith("PREMIUM-") && cleanKey.length >= 14) {
        this._updatePlan("PREMIUM", true, cleanKey);
        Logger.info(MODULE$a, "Plano PREMIUM ativado com sucesso");
        return { status: "PREMIUM", valid: true, message: "Licença PREMIUM ativada com sucesso!" };
      }
      this._updatePlan("FREE", false);
      return { status: "FREE", valid: false, message: "Chave de licença inválida" };
    }
    /**
     * Retorna os dados completos do estado da licença.
     */
    getLicense() {
      return StateManager.license;
    }
    /**
     * Retorna o plano atual.
     */
    getPlan() {
      return StateManager.license.plan;
    }
    /**
     * Retorna se a licença está ativa e válida.
     */
    isActive() {
      return StateManager.license.active;
    }
    /**
     * Verifica se o plano atual tem acesso a determinada funcionalidade.
     */
    hasFeature(feature) {
      const plan = this.getPlan();
      if (plan === "PREMIUM") return true;
      if (plan === "PRO") {
        return feature !== "analytics";
      }
      return feature === "goals";
    }
    _updatePlan(plan, active, key) {
      const licenseState = { plan, active, key };
      StateManager.patchLicense(licenseState);
      StateManager.patchSettings({
        licenseStatus: plan,
        licenseKey: key || ""
      });
      StorageManager.saveLicense(licenseState).catch(() => {
      });
    }
  }
  class SettingsModule {
    licenseMgr = new LicenseManager();
    /**
     * Obtém as configurações atuais.
     */
    getSettings() {
      return StateManager.settings;
    }
    /**
     * Atualiza preferências gerais.
     */
    async updateSettings(patch) {
      StateManager.patchSettings(patch);
      await StorageManager.saveSettings(patch);
    }
    /**
     * Ativa e valida chave de licença.
     */
    async activateLicense(key) {
      return this.licenseMgr.validate(key);
    }
    /**
     * Obtém status atual da licença.
     */
    getLicense() {
      return this.licenseMgr.getLicense();
    }
  }
  const MODULE$9 = "AudioManager";
  class AudioManager {
    ctx = null;
    volumeNode = null;
    volume = 0.5;
    unlocked = false;
    currentOscillator = null;
    /**
     * Desbloqueia o AudioContext após interação explícita do usuário.
     */
    async unlock() {
      try {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioCtx();
          this.volumeNode = this.ctx.createGain();
          this.volumeNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
          this.volumeNode.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") {
          await this.ctx.resume();
        }
        this.unlocked = true;
        Logger.info(MODULE$9, "AudioContext desbloqueado com sucesso");
        return true;
      } catch (err) {
        Logger.warn(MODULE$9, "Falha ao desbloquear AudioContext:", err);
        return false;
      }
    }
    /**
     * Executa o som de notificação de venda sintetizado (Ding suave).
     */
    async playSaleSound() {
      if (!this.unlocked || !this.ctx) {
        await this.unlock();
      }
      if (!this.ctx || this.ctx.state !== "running") {
        Logger.debug(MODULE$9, "Áudio bloqueado ou não inicializado");
        return;
      }
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
        noteGain.gain.setValueAtTime(this.volume * 0.4, now);
        noteGain.gain.exponentialRampToValueAtTime(1e-4, now + 0.45);
        osc.connect(noteGain);
        noteGain.connect(this.volumeNode || this.ctx.destination);
        this.currentOscillator = osc;
        osc.start(now);
        osc.stop(now + 0.45);
      } catch (err) {
        Logger.warn(MODULE$9, "Erro ao tocar som sintetizado:", err);
      }
    }
    /**
     * Alias de playSaleSound para compatibilidade genérica.
     */
    async play() {
      return this.playSaleSound();
    }
    /**
     * Interrompe a reprodução atual se houver.
     */
    stop() {
      if (this.currentOscillator) {
        try {
          this.currentOscillator.stop();
          this.currentOscillator.disconnect();
        } catch {
        }
        this.currentOscillator = null;
      }
    }
    /**
     * Ajusta o volume do áudio (0.0 a 1.0).
     */
    setVolume(level) {
      this.volume = Math.max(0, Math.min(1, level));
      if (this.volumeNode && this.ctx) {
        this.volumeNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      }
    }
    /**
     * Verifica se o áudio foi desbloqueado pelo usuário.
     */
    isUnlocked() {
      return this.unlocked && !!this.ctx && this.ctx.state === "running";
    }
    setEnabled(val) {
      this.unlocked = val;
    }
    isEnabled() {
      return this.unlocked;
    }
  }
  const panelCss = "\n@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');\n/* ============================================================\n   Auto Live Shop V2 — Estilos do Floating Panel\n   Injetado via Shadow DOM — isolado do TikTok\n   ============================================================ */\n\n/* ── Fonte ────────────────────────────────────────────────── */\n\n/* ── Tokens de design ────────────────────────────────────────*/\n:host {\n  display: block;\n  position: fixed;\n  top: 0;\n  left: 0;\n  width: 0;\n  height: 0;\n  z-index: 2147483647;\n  pointer-events: none;\n  --bg:          #080d1a;\n  --bg-card:     #0d1525;\n  --bg-card-alt: #111c30;\n  --bg-sub:      #0a1220;\n  --border:      #1e2d47;\n  --border-light:#2a3f5c;\n  --green:       #22c55e;\n  --green-dim:   #16a34a;\n  --green-glow:  rgba(34,197,94,0.18);\n  --teal:        #14b8a6;\n  --teal-dim:    #0d8a7c;\n  --teal-glow:   rgba(20,184,166,0.15);\n  --teal-light:  #5eead4;\n  --red:         #ef4444;\n  --red-dim:     #b91c1c;\n  --orange:      #f97316;\n  --yellow:      #eab308;\n  --text-1:      #f0f6ff;\n  --text-2:      #94a3b8;\n  --text-3:      #64748b;\n  --shadow:      0 8px 32px rgba(0,0,0,0.7);\n  --radius:      12px;\n  --radius-sm:   8px;\n  --radius-xs:   5px;\n  --transition:  0.18s ease;\n  --font:        'Inter', system-ui, -apple-system, sans-serif;\n}\n\n*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n\n/* ── Painel raiz ──────────────────────────────────────────── */\n.als-panel {\n  position: fixed;\n  top: var(--als-y, 80px);\n  left: var(--als-x, 16px);\n  width: var(--als-w, 320px);\n  height: var(--als-h, 560px);\n  z-index: 2147483647;\n  pointer-events: auto;\n  display: flex;\n  flex-direction: column;\n  background: var(--bg);\n  border: 1px solid var(--border-light);\n  border-radius: var(--radius);\n  box-shadow: var(--shadow);\n  font-family: var(--font);\n  font-size: 13px;\n  color: var(--text-1);\n  overflow: hidden;\n  user-select: none;\n  -webkit-font-smoothing: antialiased;\n  transition: box-shadow var(--transition);\n}\n.als-panel:hover { box-shadow: 0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px var(--border-light); }\n.als-panel.minimized { height: 48px !important; overflow: hidden; }\n.als-panel.hidden { display: none !important; }\n\n/* ── Scrollbar ────────────────────────────────────────────── */\n::-webkit-scrollbar { width: 3px; }\n::-webkit-scrollbar-track { background: transparent; }\n::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 3px; }\n\n/* ── Header / Drag handle ─────────────────────────────────── */\n.als-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0 10px;\n  height: 48px;\n  min-height: 48px;\n  background: linear-gradient(135deg, #0d1525, #111c30);\n  border-bottom: 1px solid var(--border);\n  cursor: grab;\n  flex-shrink: 0;\n}\n.als-header:active { cursor: grabbing; }\n\n.als-header-left { display: flex; align-items: center; gap: 8px; }\n\n.als-logo {\n  width: 26px;\n  height: 26px;\n  background: linear-gradient(135deg, var(--teal), var(--teal-dim));\n  border-radius: 7px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 14px;\n  flex-shrink: 0;\n  box-shadow: 0 0 10px var(--teal-glow);\n}\n\n.als-brand { display: flex; flex-direction: column; line-height: 1.2; }\n.als-brand-name { font-size: 12px; font-weight: 800; color: var(--text-1); letter-spacing: -0.2px; }\n.als-brand-sub  { font-size: 9px; color: var(--teal); font-weight: 600; }\n\n.als-header-right { display: flex; align-items: center; gap: 4px; }\n\n/* Status badge no header */\n.als-live-badge {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 3px 8px;\n  border-radius: 12px;\n  font-size: 9px;\n  font-weight: 800;\n  letter-spacing: 0.5px;\n  margin-right: 4px;\n}\n.als-live-badge.detecting { background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.4); color: var(--text-3); }\n.als-live-badge.active    { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fc8181; }\n.als-live-badge.inactive  { background: rgba(100,116,139,0.15); border: 1px solid rgba(100,116,139,0.3); color: var(--text-3); }\n.als-live-badge.ended     { background: rgba(100,116,139,0.15); border: 1px solid rgba(100,116,139,0.3); color: var(--text-3); }\n.als-live-badge.error     { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fc8181; }\n\n.als-live-dot {\n  width: 7px; height: 7px;\n  border-radius: 50%;\n  background: var(--red);\n  animation: als-pulse 1.4s infinite;\n  flex-shrink: 0;\n}\n@keyframes als-pulse {\n  0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }\n  50%      { box-shadow: 0 0 0 5px rgba(239,68,68,0); }\n}\n.als-live-badge:not(.active) .als-live-dot { animation: none; background: var(--text-3); }\n\n.als-icon-btn {\n  background: none; border: none;\n  color: var(--text-3); cursor: pointer;\n  width: 26px; height: 26px;\n  border-radius: var(--radius-xs);\n  display: flex; align-items: center; justify-content: center;\n  font-size: 14px;\n  transition: color var(--transition), background var(--transition);\n}\n.als-icon-btn:hover { color: var(--text-1); background: rgba(255,255,255,0.06); }\n\n/* ── Tab Nav ──────────────────────────────────────────────── */\n.als-tab-nav {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  background: var(--bg-card);\n  border-bottom: 1px solid var(--border);\n  flex-shrink: 0;\n}\n.als-tab-btn {\n  display: flex; flex-direction: column; align-items: center; justify-content: center;\n  gap: 2px; padding: 7px 4px;\n  background: none; border: none;\n  border-bottom: 2px solid transparent;\n  color: var(--text-3); cursor: pointer;\n  font-family: var(--font);\n  transition: color var(--transition), border-color var(--transition), background var(--transition);\n}\n.als-tab-btn:hover { color: var(--text-2); background: rgba(255,255,255,0.02); }\n.als-tab-btn.active { color: var(--green); border-bottom-color: var(--green); background: rgba(34,197,94,0.04); }\n.als-tab-icon  { font-size: 13px; }\n.als-tab-label { font-size: 8.5px; font-weight: 700; letter-spacing: 0.3px; }\n\n/* ── Conteúdo ─────────────────────────────────────────────── */\n.als-content {\n  flex: 1;\n  overflow-y: auto;\n  overflow-x: hidden;\n  padding: 10px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n/* ── Abas ─────────────────────────────────────────────────── */\n.als-pane { display: none; flex-direction: column; gap: 8px; animation: als-fadeIn 0.18s ease; }\n.als-pane.active { display: flex; }\n@keyframes als-fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }\n\n/* ── Cards ─────────────────────────────────────────────────── */\n.als-card {\n  background: var(--bg-card);\n  border: 1px solid var(--border);\n  border-radius: var(--radius-sm);\n  padding: 12px;\n  transition: border-color var(--transition);\n}\n.als-card:hover { border-color: var(--border-light); }\n.als-card-sub {\n  background: var(--bg-sub);\n  border: 1px solid var(--border);\n  border-radius: var(--radius-xs);\n  padding: 9px;\n  margin-top: 8px;\n}\n\n.als-card-header {\n  display: flex; align-items: flex-start; justify-content: space-between; gap: 6px;\n}\n.als-card-title { font-size: 12px; font-weight: 700; color: var(--text-1); line-height: 1.3; }\n.als-card-desc  { font-size: 10px; color: var(--text-2); margin-top: 2px; line-height: 1.4; }\n\n/* ── Status cards ─────────────────────────────────────────── */\n.als-status-card {\n  background: linear-gradient(135deg, #0d1525, #0f1e35);\n  border-color: var(--border-light);\n  box-shadow: 0 0 20px rgba(20,184,166,0.12);\n}\n.als-empty-state {\n  text-align: center; color: var(--text-3);\n  padding: 20px 0; font-size: 11px; line-height: 1.6;\n}\n.als-empty-icon { font-size: 28px; margin-bottom: 8px; }\n\n/* ── Section label ────────────────────────────────────────── */\n.als-section-label {\n  font-size: 8.5px; font-weight: 800; color: var(--text-3);\n  letter-spacing: 1.2px; text-transform: uppercase;\n  padding: 2px 0;\n}\n\n/* ── Metrics grid ─────────────────────────────────────────── */\n.als-metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }\n.als-metric {\n  background: var(--bg-card);\n  border: 1px solid var(--border);\n  border-radius: var(--radius-sm);\n  padding: 10px 8px; text-align: center;\n  transition: border-color var(--transition), box-shadow var(--transition);\n}\n.als-metric:hover { border-color: var(--green-dim); box-shadow: 0 0 10px var(--green-glow); }\n.als-metric-label { font-size: 8.5px; font-weight: 700; color: var(--text-3); letter-spacing: 0.8px; text-transform: uppercase; }\n.als-metric-value { font-size: 20px; font-weight: 900; color: var(--teal-light); line-height: 1.2; margin: 2px 0; font-variant-numeric: tabular-nums; }\n.als-metric-sub   { font-size: 9px; color: var(--text-3); }\n\n/* ── GMV hero ─────────────────────────────────────────────── */\n.als-gmv-hero { text-align: center; padding: 4px 0; }\n.als-gmv-label { font-size: 9px; font-weight: 700; color: var(--text-3); letter-spacing: 1px; text-transform: uppercase; }\n.als-gmv-value { font-size: 28px; font-weight: 900; color: var(--green); font-variant-numeric: tabular-nums; letter-spacing: -1px; line-height: 1.1; margin: 4px 0; text-shadow: 0 0 20px rgba(34,197,94,0.4); }\n.als-gmv-sub   { font-size: 10px; color: var(--text-2); }\n\n/* ── Progress bar (meta) ──────────────────────────────────── */\n.als-progress-wrap { margin-top: 8px; }\n.als-progress-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-2); margin-bottom: 4px; }\n.als-progress-track { background: var(--border); border-radius: 4px; height: 6px; overflow: hidden; }\n.als-progress-fill  { height: 100%; background: linear-gradient(90deg, var(--green-dim), var(--green)); border-radius: 4px; transition: width 0.5s ease; }\n\n/* ── Sales feed ───────────────────────────────────────────── */\n.als-sales-feed { max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }\n.als-sale-item {\n  display: flex; justify-content: space-between; align-items: center;\n  background: rgba(34,197,94,0.05); border: 1px solid rgba(34,197,94,0.15);\n  border-radius: 6px; padding: 6px 10px;\n  animation: als-slideIn 0.25s ease;\n}\n@keyframes als-slideIn { from { opacity:0; transform: translateX(-6px); } to { opacity:1; transform:none; } }\n.als-sale-name { font-size: 11px; font-weight: 600; color: var(--text-1); }\n.als-sale-meta { font-size: 10px; color: var(--text-3); }\n.als-sale-amount { font-size: 11px; font-weight: 700; color: var(--green); }\n\n/* ── Buttons ──────────────────────────────────────────────── */\n.als-btn {\n  display: inline-flex; align-items: center; gap: 4px;\n  border: none; border-radius: var(--radius-sm);\n  font-family: var(--font); font-weight: 600; cursor: pointer;\n  transition: all var(--transition); white-space: nowrap;\n}\n.als-btn-sm { padding: 6px 12px; font-size: 11px; }\n.als-btn-xs { padding: 4px 8px; font-size: 10px; }\n.als-btn-full { width: 100%; justify-content: center; }\n\n.als-btn-green {\n  background: linear-gradient(135deg, var(--green), var(--green-dim));\n  color: #fff; box-shadow: 0 2px 8px rgba(34,197,94,0.3);\n}\n.als-btn-green:hover { box-shadow: 0 4px 14px rgba(34,197,94,0.5); transform: translateY(-1px); }\n\n.als-btn-teal {\n  background: linear-gradient(135deg, var(--teal), var(--teal-dim));\n  color: #fff; box-shadow: 0 2px 8px rgba(20,184,166,0.3);\n}\n.als-btn-teal:hover { box-shadow: 0 4px 14px rgba(20,184,166,0.5); transform: translateY(-1px); }\n\n.als-btn-ghost {\n  background: var(--bg-card-alt); color: var(--text-2);\n  border: 1px solid var(--border);\n}\n.als-btn-ghost:hover { background: var(--border); color: var(--text-1); }\n\n.als-btn-danger {\n  background: linear-gradient(135deg, var(--red), var(--red-dim));\n  color: #fff; box-shadow: 0 2px 8px rgba(239,68,68,0.3);\n}\n.als-btn-danger:hover { box-shadow: 0 4px 14px rgba(239,68,68,0.5); transform: translateY(-1px); }\n\n/* ── Toggle switch ────────────────────────────────────────── */\n.als-toggle { position: relative; display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0; }\n.als-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }\n.als-toggle-slider {\n  width: 38px; height: 21px;\n  background: var(--border); border-radius: 11px;\n  position: relative; transition: background var(--transition); flex-shrink: 0;\n}\n.als-toggle-slider::after {\n  content: ''; position: absolute; top: 2.5px; left: 2.5px;\n  width: 16px; height: 16px; background: var(--text-3);\n  border-radius: 50%; transition: transform var(--transition), background var(--transition);\n}\n.als-toggle input:checked + .als-toggle-slider { background: var(--green); }\n.als-toggle input:checked + .als-toggle-slider::after { transform: translateX(17px); background: #fff; }\n\n.als-toggle-sm .als-toggle-slider { width: 30px; height: 17px; }\n.als-toggle-sm .als-toggle-slider::after { width: 13px; height: 13px; }\n.als-toggle-sm input:checked + .als-toggle-slider::after { transform: translateX(13px); }\n\n/* ── Toggle row ───────────────────────────────────────────── */\n.als-toggle-row {\n  display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 5px 0;\n}\n.als-toggle-row-label { font-size: 12px; font-weight: 600; color: var(--text-1); }\n.als-toggle-row-desc  { font-size: 10px; color: var(--text-2); margin-top: 1px; }\n\n/* ── Forms ────────────────────────────────────────────────── */\n.als-form-group { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }\n.als-form-label { font-size: 10px; font-weight: 600; color: var(--text-2); }\n.als-form-hint  { font-size: 9.5px; color: var(--text-3); }\n\n.als-input, .als-select, .als-textarea {\n  background: var(--bg-sub); border: 1px solid var(--border);\n  border-radius: var(--radius-xs); color: var(--text-1);\n  font-family: var(--font); font-size: 12px; padding: 6px 9px;\n  width: 100%; outline: none;\n  transition: border-color var(--transition), box-shadow var(--transition);\n}\n.als-input:focus, .als-select:focus, .als-textarea:focus {\n  border-color: var(--green); box-shadow: 0 0 0 2px var(--green-glow);\n}\n.als-select { appearance: none; cursor: pointer; padding-right: 24px; }\n.als-textarea { resize: vertical; min-height: 52px; }\n\n.als-select-wrap { position: relative; }\n.als-select-wrap::after { content:'▾'; position:absolute; right:8px; top:50%; transform:translateY(-50%); color:var(--text-3); pointer-events:none; font-size:11px; }\n\n.als-num-input {\n  background: var(--bg-sub); border: 1px solid var(--border);\n  border-radius: var(--radius-xs); color: var(--teal-light);\n  font-family: var(--font); font-size: 15px; font-weight: 700;\n  padding: 5px; text-align: center; width: 56px; outline: none;\n}\n.als-num-input:focus { border-color: var(--green); }\n\n.als-input-row { display: flex; align-items: center; gap: 6px; }\n.als-input-label { font-size: 10px; color: var(--text-2); white-space: nowrap; }\n\n/* ── Product list ─────────────────────────────────────────── */\n.als-product-list { display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto; }\n.als-product-item {\n  display: flex; align-items: center; gap: 8px;\n  background: var(--bg-sub); border: 1px solid var(--border);\n  border-radius: var(--radius-xs); padding: 7px 9px;\n  transition: border-color var(--transition);\n}\n.als-product-item:hover { border-color: var(--border-light); }\n.als-product-item.pinned { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.04); }\n.als-product-pin-badge { font-size: 10px; color: var(--green); font-weight: 700; }\n.als-product-info { flex: 1; min-width: 0; }\n.als-product-name { font-size: 11px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.als-product-price { font-size: 10px; color: var(--text-3); }\n.als-product-actions { display: flex; gap: 4px; flex-shrink: 0; }\n\n/* ── Message / reply list ─────────────────────────────────── */\n.als-msg-list { display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto; }\n.als-msg-item {\n  display: flex; align-items: center; gap: 6px;\n  background: var(--bg-sub); border: 1px solid var(--border);\n  border-radius: var(--radius-xs); padding: 7px 9px;\n}\n.als-msg-item.active-item { border-color: rgba(34,197,94,0.25); }\n.als-msg-text { flex: 1; font-size: 11px; color: var(--text-1); line-height: 1.4; }\n.als-msg-actions { display: flex; gap: 4px; flex-shrink: 0; }\n\n.als-icon-btn-xs {\n  background: none; border: none; color: var(--text-3); cursor: pointer;\n  font-size: 12px; padding: 2px 4px; border-radius: 4px;\n  transition: color var(--transition), background var(--transition);\n}\n.als-icon-btn-xs:hover { color: var(--text-1); background: var(--border); }\n.als-icon-btn-xs.danger:hover { color: var(--red); }\n\n/* ── Trigger tags ─────────────────────────────────────────── */\n.als-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }\n.als-tag {\n  background: rgba(20,184,166,0.12); border: 1px solid rgba(20,184,166,0.25);\n  color: var(--teal-light); border-radius: 10px;\n  padding: 2px 7px; font-size: 9.5px; font-weight: 600;\n}\n\n/* ── Checkbox ─────────────────────────────────────────────── */\n.als-checkbox-list { display: flex; flex-direction: column; gap: 7px; }\n.als-checkbox-item { display: flex; align-items: center; gap: 9px; cursor: pointer; font-size: 12px; color: var(--text-1); }\n.als-checkbox-item input { display: none; }\n.als-checkbox-custom {\n  width: 17px; height: 17px; border: 2px solid var(--border-light);\n  border-radius: 4px; background: var(--bg-sub); flex-shrink: 0;\n  position: relative; transition: all var(--transition);\n}\n.als-checkbox-custom::after {\n  content:''; position:absolute; top:2px; left:5px;\n  width:4px; height:8px; border: 2px solid #fff; border-top:none; border-left:none;\n  transform:rotate(45deg); opacity:0; transition: opacity var(--transition);\n}\n.als-checkbox-item input:checked + .als-checkbox-custom { background: var(--green); border-color: var(--green); }\n.als-checkbox-item input:checked + .als-checkbox-custom::after { opacity:1; }\n\n/* ── License card ─────────────────────────────────────────── */\n.als-license-card { background: linear-gradient(135deg, #0d1525, #101f38); border-color: rgba(34,197,94,0.25); }\n.als-badge { border-radius: 10px; padding: 2px 8px; font-size: 9.5px; font-weight: 700; }\n.als-badge-free    { background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.4); color: var(--text-3); }\n.als-badge-pro     { background: rgba(20,184,166,0.15); border: 1px solid rgba(20,184,166,0.4); color: var(--teal-light); }\n.als-badge-premium { background: rgba(234,179,8,0.15); border: 1px solid rgba(234,179,8,0.4); color: var(--yellow); }\n.als-badge-active  { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.4); color: var(--green); }\n\n.als-input-eye-wrap { position: relative; }\n.als-input-eye-wrap .als-input { padding-right: 32px; }\n.als-eye-btn {\n  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);\n  background: none; border: none; color: var(--text-3); cursor: pointer; font-size: 14px;\n}\n\n.als-link { font-size: 10px; color: var(--teal); text-decoration: none; border-bottom: 1px dashed var(--teal-dim); }\n.als-link:hover { color: var(--teal-light); }\n\n/* ── Collapsible ──────────────────────────────────────────── */\n.als-collapsible { display: none; }\n.als-collapsible.open { display: block; }\n\n/* ── Sliders ──────────────────────────────────────────────── */\n.als-range {\n  width: 100%; appearance: none; height: 3px;\n  background: var(--border); border-radius: 2px; outline: none; cursor: pointer;\n}\n.als-range::-webkit-slider-thumb {\n  appearance: none; width: 14px; height: 14px; border-radius: 50%;\n  background: var(--green); cursor: pointer; box-shadow: 0 0 5px rgba(34,197,94,0.5);\n}\n\n/* ── Toasts ───────────────────────────────────────────────── */\n.als-toasts {\n  position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);\n  display: flex; flex-direction: column; gap: 5px;\n  width: calc(100% - 20px); z-index: 10; pointer-events: none;\n}\n.als-toast {\n  background: var(--bg-card-alt); border: 1px solid var(--border-light);\n  color: var(--text-1); padding: 7px 14px;\n  border-radius: 20px; font-size: 11px; font-weight: 600;\n  box-shadow: 0 4px 16px rgba(0,0,0,0.5);\n  animation: als-toastIn 0.25s ease;\n  text-align: center; pointer-events: none;\n}\n.als-toast.success { border-color: rgba(34,197,94,0.4); }\n.als-toast.warn    { border-color: rgba(239,68,68,0.4); }\n.als-toast.error   { border-color: rgba(239,68,68,0.6); background: rgba(239,68,68,0.1); }\n.als-toast.info    { border-color: rgba(20,184,166,0.4); }\n@keyframes als-toastIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform:none; } }\n@keyframes als-toastOut { to { opacity:0; transform: translateY(6px); } }\n\n/* ── Footer ───────────────────────────────────────────────── */\n.als-footer { text-align: center; color: var(--text-3); font-size: 9px; padding: 8px 0 2px; }\n\n/* ── Utilities ────────────────────────────────────────────── */\n.mt4  { margin-top: 4px; }\n.mt6  { margin-top: 6px; }\n.mt8  { margin-top: 8px; }\n.mb4  { margin-bottom: 4px; }\n.flex-row { display: flex; gap: 6px; align-items: center; }\n.flex-between { display: flex; justify-content: space-between; align-items: center; gap: 6px; }\n.text-green { color: var(--green); }\n.text-red   { color: var(--red); }\n.text-teal  { color: var(--teal); }\n.text-muted { color: var(--text-3); font-size: 10px; }\n.bold       { font-weight: 700; }\n.w-full     { width: 100%; }\n";
  const MODULE$8 = "FloatingPanel";
  class FloatingPanel {
    host;
    shadow;
    panelEl;
    // Gerenciadores de UI
    positionMgr;
    dragMgr;
    visibilityMgr;
    headerComp;
    tabMgr;
    toastMgr;
    // Módulos
    dashboardMod = new DashboardModule();
    productsMod = new ProductsModule();
    salesMod = new SalesModule();
    goalsMod = new GoalsModule();
    automationMod = new AutomationModule();
    settingsMod = new SettingsModule();
    audioMgr = new AudioManager();
    timerInterval = null;
    editingReplyId = null;
    async mount() {
      Logger.info(MODULE$8, `Montando ${APP_NAME}...`);
      const targetParent = document.body || document.documentElement;
      if (!targetParent) {
        Logger.error(MODULE$8, "document.body não disponível para montagem do painel");
        return;
      }
      this.host = document.createElement("div");
      this.host.id = PANEL_ROOT_ID;
      this.host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;";
      targetParent.appendChild(this.host);
      this.shadow = this.host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = panelCss;
      this.shadow.appendChild(style);
      const panelState = await StorageManager.getPanelState();
      this.panelEl = document.createElement("div");
      this.panelEl.className = "als-panel";
      const initX = panelState.position?.x ?? panelState.x ?? PANEL_DEFAULTS.DEFAULT_X;
      const initY = panelState.position?.y ?? panelState.y ?? PANEL_DEFAULTS.DEFAULT_Y;
      const initW = panelState.size?.width ?? panelState.width ?? PANEL_DEFAULTS.WIDTH;
      const initH = panelState.size?.height ?? panelState.height ?? PANEL_DEFAULTS.HEIGHT;
      this.panelEl.style.setProperty("--als-x", `${initX}px`);
      this.panelEl.style.setProperty("--als-y", `${initY}px`);
      this.panelEl.style.setProperty("--als-w", `${initW}px`);
      this.panelEl.style.setProperty("--als-h", `${initH}px`);
      if (panelState.minimized) {
        this.panelEl.classList.add("minimized");
      }
      this.panelEl.innerHTML = this._buildHTML();
      this.shadow.appendChild(this.panelEl);
      this._initializeComponents();
      this._bindEvents();
      this._subscribeEvents();
      await this._hydrate();
      this._startTimer();
      Logger.info(MODULE$8, `✅ ${APP_NAME} montado com sucesso`);
    }
    unmount() {
      this._stopTimer();
      this.dragMgr?.destroy();
      this.host.remove();
      EventBus.clear();
    }
    _initializeComponents() {
      const headerContainer = this.shadow.querySelector("#als-header-container");
      this.positionMgr = new PanelPositionManager(this.panelEl);
      this.dragMgr = new PanelDragManager(this.panelEl, headerContainer, this.positionMgr);
      this.visibilityMgr = new PanelVisibilityManager(this.panelEl);
      this.headerComp = new Header(
        headerContainer,
        () => this.visibilityMgr.toggleMinimize(),
        () => this.visibilityMgr.close()
      );
      const minimizeBtn = this.shadow.querySelector("#als-btn-minimize");
      if (minimizeBtn) {
        this.visibilityMgr.setMinimizeButton(minimizeBtn);
      }
      const nav = this.shadow.querySelector(".als-tab-nav");
      const content = this.shadow.querySelector(".als-content");
      this.tabMgr = new TabManager(nav, content);
      const toastContainer = this.shadow.querySelector("#als-toasts");
      this.toastMgr = new ToastManager(toastContainer);
    }
    _buildHTML() {
      return `
      <!-- HEADER COMPONENT CONTAINER -->
      <div class="als-header" id="als-header-container"></div>

      <!-- TABS NAVIGATION -->
      <nav class="als-tab-nav">
        <button class="als-tab-btn active" data-tab="painel">
          <span class="als-tab-icon">📊</span>
          <span class="als-tab-label">PAINEL</span>
        </button>
        <button class="als-tab-btn" data-tab="automacao">
          <span class="als-tab-icon">⚡</span>
          <span class="als-tab-label">AUTOMAÇÃO</span>
        </button>
        <button class="als-tab-btn" data-tab="produtos">
          <span class="als-tab-icon">📦</span>
          <span class="als-tab-label">PRODUTOS</span>
        </button>
        <button class="als-tab-btn" data-tab="ajustes">
          <span class="als-tab-icon">⚙️</span>
          <span class="als-tab-label">AJUSTES</span>
        </button>
      </nav>

      <!-- CONTENT CONTAINER -->
      <div class="als-content">

        <!-- ─── ABA PAINEL ─── -->
        <div class="als-pane active" id="als-pane-painel">

          <!-- Card de Faturamento e Timer -->
          <div class="als-card als-status-card">
            <div class="als-gmv-hero">
              <div class="als-gmv-label">FATURAMENTO DA LIVE</div>
              <div class="als-gmv-value" id="als-gmv-value">R$ 0,00</div>
              <div class="als-gmv-sub" id="als-gmv-sub">Aguardando métricas do TikTok Shop...</div>
            </div>

            <div class="als-section-label mt8">TEMPO EM TRANSMISSÃO</div>
            <div class="flex-row mt4" style="justify-content:center;gap:2px;">
              <div style="text-align:center">
                <div style="font-size:24px;font-weight:900;color:#22c55e;font-variant-numeric:tabular-nums" id="als-timer-h">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">H</div>
              </div>
              <div style="font-size:20px;font-weight:900;color:#2a3f5c;margin-bottom:8px">:</div>
              <div style="text-align:center">
                <div style="font-size:24px;font-weight:900;color:#22c55e;font-variant-numeric:tabular-nums" id="als-timer-m">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">MIN</div>
              </div>
              <div style="font-size:20px;font-weight:900;color:#2a3f5c;margin-bottom:8px">:</div>
              <div style="text-align:center">
                <div style="font-size:24px;font-weight:900;color:#22c55e;font-variant-numeric:tabular-nums" id="als-timer-s">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">SEG</div>
              </div>
            </div>
            <div class="flex-row mt6" style="justify-content:center">
              <button class="als-btn als-btn-green als-btn-xs" id="als-btn-start-live">▶ Iniciar</button>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-stop-live">■ Parar</button>
            </div>
          </div>

          <!-- Meta de GMV -->
          <div class="als-card" id="als-goal-card">
            <div class="flex-between mb4">
              <div class="als-card-title">🎯 Meta de GMV</div>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-edit-goal">Editar</button>
            </div>
            <div id="als-goal-content">
              <div class="als-empty-state" style="padding:6px 0">
                <div>Sem meta definida</div>
                <button class="als-btn als-btn-green als-btn-xs mt6" id="als-btn-set-goal">+ Definir meta</button>
              </div>
            </div>
          </div>

          <!-- Grid de Métricas -->
          <div class="als-section-label">MÉTRICAS DA SESSÃO</div>
          <div class="als-metrics-grid">
            <div class="als-metric">
              <div class="als-metric-label">VENDAS</div>
              <div class="als-metric-value" id="als-metric-sales">0</div>
              <div class="als-metric-sub">pedidos</div>
            </div>
            <div class="als-metric">
              <div class="als-metric-label">ITENS</div>
              <div class="als-metric-value" id="als-metric-items">0</div>
              <div class="als-metric-sub">unidades</div>
            </div>
            <div class="als-metric">
              <div class="als-metric-label">VENDAS/H</div>
              <div class="als-metric-value" id="als-metric-sph">0.0</div>
              <div class="als-metric-sub">por hora</div>
            </div>
            <div class="als-metric">
              <div class="als-metric-label">ESPECTADORES</div>
              <div class="als-metric-value" id="als-metric-viewers">—</div>
              <div class="als-metric-sub">ao vivo</div>
            </div>
          </div>

          <!-- Feed de Vendas Recentes -->
          <div class="als-card">
            <div class="flex-between mb4">
              <div class="als-card-title">🛍 Vendas Recentes</div>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-clear-sales">Limpar</button>
            </div>
            <div class="als-sales-feed" id="als-sales-feed">
              <div class="als-empty-state">
                <div class="als-empty-icon">🛒</div>
                <div>Aguardando vendas do TikTok...</div>
              </div>
            </div>
          </div>

        </div>

        <!-- ─── ABA AUTOMAÇÃO ─── -->
        <div class="als-pane" id="als-pane-automacao">

          <!-- Fixação Automática -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">📌 Fixação Automática</div>
                <div class="als-card-desc">Mantém o produto selecionado fixado no topo da transmissão.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-pin" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-auto-pin-form">
              <div class="als-form-group mt6">
                <label class="als-form-label">Produto para fixar</label>
                <div class="als-select-wrap">
                  <select class="als-select" id="als-pin-product-select">
                    <option value="">Selecione um produto...</option>
                  </select>
                </div>
              </div>
              <div class="als-form-group">
                <label class="als-form-label">Renovar a cada</label>
                <div class="als-input-row">
                  <input type="number" class="als-num-input" id="als-repin-interval" min="10" max="300" value="30" />
                  <span class="als-input-label">segundos</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Mensagens Automáticas -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">💬 Mensagens Automáticas</div>
                <div class="als-card-desc">Dispara comentários no chat da LIVE periodicamente.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-msg" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-auto-msg-form">
              <div class="als-form-group mt6">
                <div class="flex-between mb4">
                  <label class="als-form-label">Intervalo: <strong id="als-msg-interval-label">60s – 180s</strong></label>
                  <label class="als-toggle als-toggle-sm" title="Ordem aleatória">
                    <input type="checkbox" id="als-toggle-msg-random" checked />
                    <span class="als-toggle-slider"></span>
                  </label>
                </div>
                <input type="range" class="als-range" id="als-msg-min-slider" min="10" max="600" value="60" step="5" />
                <input type="range" class="als-range mt4" id="als-msg-max-slider" min="10" max="600" value="180" step="5" />
              </div>
              <div class="als-input-row mt6">
                <input type="text" class="als-input" id="als-chat-msg-input" placeholder="Digite uma mensagem para o chat…" maxlength="150" style="flex:1" />
                <button class="als-btn als-btn-green als-btn-xs" id="als-btn-save-msg">+</button>
              </div>
              <div class="als-msg-list mt6" id="als-msg-list"></div>
            </div>
          </div>

          <!-- Respostas Automáticas -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">🤖 Respostas Automáticas</div>
                <div class="als-card-desc">Responde perguntas do chat por palavras-chave.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-reply" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-auto-reply-form">
              <div class="als-toggle-row mt4">
                <div>
                  <div class="als-toggle-row-label">Chamar pelo nome</div>
                  <div class="als-toggle-row-desc">Menciona o usuário que fez a pergunta</div>
                </div>
                <label class="als-toggle als-toggle-sm">
                  <input type="checkbox" id="als-toggle-reply-name" checked />
                  <span class="als-toggle-slider"></span>
                </label>
              </div>
              <button class="als-btn als-btn-green als-btn-sm w-full mt6" id="als-btn-new-reply">+ Nova Regra</button>
              <div id="als-reply-form-wrap" style="display:none" class="als-card-sub">
                <div class="als-form-group">
                  <label class="als-form-label">Gatilhos (palavras-chave)</label>
                  <input type="text" class="als-input" id="als-reply-triggers" placeholder="ex: tamanho, pronta entrega, frete" />
                  <div class="als-form-hint">Separe por vírgula</div>
                </div>
                <div class="als-form-group">
                  <label class="als-form-label">Resposta</label>
                  <textarea class="als-textarea" id="als-reply-text" placeholder="ex: Sim! Temos todos os tamanhos disponíveis na sacola."></textarea>
                </div>
                <div class="flex-row mt6" style="justify-content:flex-end">
                  <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-cancel-reply">Cancelar</button>
                  <button class="als-btn als-btn-green als-btn-xs" id="als-btn-save-reply">Salvar</button>
                </div>
              </div>
              <div class="als-msg-list mt6" id="als-reply-list"></div>
            </div>
          </div>

        </div>

        <!-- ─── ABA PRODUTOS ─── -->
        <div class="als-pane" id="als-pane-produtos">

          <div class="als-card">
            <div class="flex-between mb6">
              <div class="als-card-title">📦 Catálogo da LIVE</div>
              <button class="als-btn als-btn-green als-btn-xs" id="als-btn-refresh-products">🔄 Atualizar</button>
            </div>
            <div id="als-product-list-wrap">
              <div class="als-empty-state">
                <div class="als-empty-icon">📦</div>
                <div>Nenhum produto sincronizado</div>
                <div class="text-muted">Clique em Atualizar para ler os produtos da LIVE</div>
              </div>
            </div>
          </div>

          <!-- Fixação Manual -->
          <div class="als-card">
            <div class="als-card-title mb4">📌 Fixação Manual</div>
            <div class="als-form-group">
              <div class="als-select-wrap">
                <select class="als-select" id="als-manual-pin-select">
                  <option value="">Selecione o produto...</option>
                </select>
              </div>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-green als-btn-sm" style="flex:1" id="als-btn-pin-now">📌 Fixar Agora</button>
              <button class="als-btn als-btn-ghost als-btn-sm" id="als-btn-unpin">Desafixar</button>
            </div>
            <div class="text-muted mt4" id="als-pin-status"></div>
          </div>

          <!-- Produto Fixado Atual -->
          <div class="als-card" id="als-pinned-card" style="display:none">
            <div class="als-card-title mb4 text-green">✅ Produto Fixado na LIVE</div>
            <div id="als-pinned-info"></div>
          </div>

        </div>

        <!-- ─── ABA AJUSTES ─── -->
        <div class="als-pane" id="als-pane-ajustes">

          <!-- Licença -->
          <div class="als-card als-license-card">
            <div class="flex-between mb6">
              <div class="als-card-title">🔑 Plano & Licença</div>
              <span class="als-badge als-badge-free" id="als-license-badge">FREE</span>
            </div>
            <div class="als-input-eye-wrap">
              <input type="password" class="als-input" id="als-license-key" placeholder="CHAVE-LICENCA" />
              <button class="als-eye-btn" id="als-btn-eye">👁</button>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-green als-btn-sm" id="als-btn-activate-license">✓ Ativar</button>
            </div>
          </div>

          <!-- Som de Venda -->
          <div class="als-card">
            <div class="als-toggle-row">
              <div>
                <div class="als-toggle-row-label">🔊 Alerta Sonoro de Venda</div>
                <div class="als-toggle-row-desc">Toca som a cada venda identificada</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-sound" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-unlock-audio">🔔 Ativar Áudio</button>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-test-sound">▶ Testar Som</button>
            </div>
          </div>

          <!-- Posição e Dimensões do Painel -->
          <div class="als-card">
            <div class="als-card-title mb6">📐 Painel Flutuante</div>
            <div class="flex-row">
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-reset-pos">Restaurar Posição</button>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-reset-size">Restaurar Tamanho</button>
            </div>
          </div>

          <div class="als-footer">${APP_NAME} v${APP_VERSION} · Copiloto de Lives</div>

        </div>

      </div>

      <!-- TOAST NOTIFICATIONS WRAPPER -->
      <div class="als-toasts" id="als-toasts"></div>
    `;
    }
    _bindEvents() {
      const $ = (id) => this.shadow.getElementById(id);
      $("als-btn-start-live")?.addEventListener("click", () => {
        this.dashboardMod.startSession();
        this._startTimer();
      });
      $("als-btn-stop-live")?.addEventListener("click", () => {
        this.dashboardMod.endSession();
        this._stopTimer();
      });
      $("als-btn-clear-sales")?.addEventListener("click", () => {
        this.dashboardMod.clearFeed();
        const feed = $("als-sales-feed");
        feed.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">🛒</div><div>Aguardando vendas do TikTok...</div></div>`;
      });
      $("als-btn-set-goal")?.addEventListener("click", () => this._promptGoal());
      $("als-btn-edit-goal")?.addEventListener("click", () => this._promptGoal());
      $("als-toggle-auto-pin")?.addEventListener("change", async (e) => {
        const on = e.target.checked;
        this._toggleCollapsible("als-auto-pin-form", on);
        if (on) {
          const select = $("als-pin-product-select");
          const intervalInput = $("als-repin-interval");
          const interval = parseInt(intervalInput.value || "30", 10);
          if (select.value) {
            this.automationMod.startAutoPin(select.value, interval);
          } else {
            EventBus.emit("toast:show", { message: "⚠ Selecione um produto na lista", type: "warn" });
            e.target.checked = false;
            this._toggleCollapsible("als-auto-pin-form", false);
          }
        } else {
          this.automationMod.stopAutoPin();
        }
      });
      $("als-toggle-auto-msg")?.addEventListener("change", (e) => {
        this._toggleCollapsible("als-auto-msg-form", e.target.checked);
      });
      $("als-btn-save-msg")?.addEventListener("click", async () => {
        const input = $("als-chat-msg-input");
        const text = input.value.trim();
        if (!text) return;
        const messages = await this.automationMod.addChatMessage(text);
        input.value = "";
        this._renderMessages(messages);
      });
      $("als-toggle-auto-reply")?.addEventListener("change", (e) => {
        this._toggleCollapsible("als-auto-reply-form", e.target.checked);
      });
      $("als-btn-new-reply")?.addEventListener("click", () => {
        $("als-reply-form-wrap").style.display = "block";
      });
      $("als-btn-cancel-reply")?.addEventListener("click", () => {
        $("als-reply-form-wrap").style.display = "none";
        this.editingReplyId = null;
      });
      $("als-btn-save-reply")?.addEventListener("click", async () => {
        const triggersInput = $("als-reply-triggers");
        const textInput = $("als-reply-text");
        const triggers = triggersInput.value.split(",").map((t) => t.trim()).filter(Boolean);
        const text = textInput.value.trim();
        if (!triggers.length || !text) {
          EventBus.emit("toast:show", { message: "⚠ Preencha gatilhos e resposta", type: "warn" });
          return;
        }
        const replies = await this.automationMod.saveAutoResponse({
          id: this.editingReplyId || Date.now(),
          triggers,
          text,
          scope: "all",
          active: true
        });
        triggersInput.value = "";
        textInput.value = "";
        $("als-reply-form-wrap").style.display = "none";
        this.editingReplyId = null;
        this._renderReplies(replies);
      });
      $("als-btn-refresh-products")?.addEventListener("click", async () => {
        const res = await this.productsMod.refreshCatalog();
        if (!res.success) {
          EventBus.emit("toast:show", { message: `⚠ ${res.error}`, type: "warn" });
        }
      });
      $("als-btn-pin-now")?.addEventListener("click", async () => {
        const select = $("als-manual-pin-select");
        if (!select.value) {
          EventBus.emit("toast:show", { message: "⚠ Selecione um produto", type: "warn" });
          return;
        }
        $("als-pin-status").textContent = "Fixando produto...";
        const res = await this.productsMod.pin(select.value);
        $("als-pin-status").textContent = res.success ? "✅ Fixado com sucesso" : `⚠ ${res.error || "Falha ao fixar"}`;
      });
      $("als-btn-unpin")?.addEventListener("click", async () => {
        const res = await this.productsMod.unpin();
        $("als-pin-status").textContent = res.success ? "Produto desafixado" : `⚠ ${res.error}`;
      });
      $("als-toggle-sound")?.addEventListener("change", (e) => {
        const on = e.target.checked;
        this.audioMgr.setEnabled(on);
        this.settingsMod.updateSettings({ salesSoundEnabled: on, soundEnabled: on });
      });
      $("als-btn-unlock-audio")?.addEventListener("click", async () => {
        await this.audioMgr.unlock();
        EventBus.emit("toast:show", { message: "🔊 Áudio desbloqueado", type: "success" });
      });
      $("als-btn-test-sound")?.addEventListener("click", () => this.audioMgr.playSaleSound());
      $("als-btn-reset-pos")?.addEventListener("click", () => this.positionMgr.resetPosition());
      $("als-btn-reset-size")?.addEventListener("click", () => this.positionMgr.resetSize());
      $("als-btn-activate-license")?.addEventListener("click", async () => {
        const key = $("als-license-key").value.trim();
        const res = await this.settingsMod.activateLicense(key);
        const badge = $("als-license-badge");
        badge.className = `als-badge als-badge-${res.status.toLowerCase()}`;
        badge.textContent = res.status;
        EventBus.emit("toast:show", {
          message: res.message,
          type: res.valid ? "success" : "warn"
        });
      });
      $("als-btn-eye")?.addEventListener("click", () => {
        const input = $("als-license-key");
        input.type = input.type === "password" ? "text" : "password";
      });
    }
    _subscribeEvents() {
      EventBus.on("metrics:updated", (metrics) => this._renderMetrics(metrics));
      EventBus.on("sale:detected", (sale) => this._addSaleToFeed(sale));
      EventBus.on("products:loaded", (products) => this._renderProductList(products));
      EventBus.on("products:updated", (products) => this._renderProductList(products));
      EventBus.on("products:pinned", ({ productId }) => this._updatePinnedDisplay(productId));
      EventBus.on("products:unpinned", () => {
        this.shadow.getElementById("als-pinned-card").style.display = "none";
      });
      EventBus.on("automation:stopped", () => {
        const toggle = this.shadow.getElementById("als-toggle-auto-pin");
        if (toggle) toggle.checked = false;
        this._toggleCollapsible("als-auto-pin-form", false);
      });
    }
    _renderMetrics(metrics) {
      const $ = (id) => this.shadow.getElementById(id);
      const gmvEl = $("als-gmv-value");
      if (gmvEl) gmvEl.textContent = formatCurrency(metrics.gmv);
      const subEl = $("als-gmv-sub");
      if (subEl) {
        subEl.textContent = metrics.source === "tiktok" ? `Atualizado: ${new Date(metrics.updatedAt).toLocaleTimeString("pt-BR")}` : "Calculado localmente";
      }
      const salesEl = $("als-metric-sales");
      if (salesEl) salesEl.textContent = String(metrics.salesCount);
      const itemsEl = $("als-metric-items");
      if (itemsEl) itemsEl.textContent = String(metrics.soldItems);
      const sphEl = $("als-metric-sph");
      if (sphEl) sphEl.textContent = metrics.salesPerHour.toFixed(1);
      const viewersEl = $("als-metric-viewers");
      if (viewersEl && metrics.viewers > 0) viewersEl.textContent = String(metrics.viewers);
      this._renderGoal();
    }
    _addSaleToFeed(sale) {
      const feed = this.shadow.getElementById("als-sales-feed");
      const empty = feed.querySelector(".als-empty-state");
      if (empty) empty.remove();
      const item = document.createElement("div");
      item.className = "als-sale-item";
      item.innerHTML = `
      <div>
        <div class="als-sale-name">🛍 ${escHtml(sale.productName || "Produto")}</div>
        <div class="als-sale-meta">${formatRelativeTime(sale.timestamp)}</div>
      </div>
      <div class="als-sale-amount">${sale.amount ? formatCurrency(sale.amount) : "—"}</div>
    `;
      feed.insertBefore(item, feed.firstChild);
      if (this.audioMgr.isEnabled()) {
        this.audioMgr.playSaleSound();
      }
    }
    _renderProductList(products) {
      const wrap = this.shadow.getElementById("als-product-list-wrap");
      const manualSelect = this.shadow.getElementById("als-manual-pin-select");
      const autoPinSelect = this.shadow.getElementById("als-pin-product-select");
      if (!products.length) {
        wrap.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">📦</div><div>Nenhum produto encontrado</div></div>`;
        return;
      }
      const list = document.createElement("div");
      list.className = "als-product-list";
      products.forEach((p) => {
        const item = document.createElement("div");
        item.className = `als-product-item ${p.isPinned ? "pinned" : ""}`;
        item.innerHTML = `
        ${p.isPinned ? '<span class="als-product-pin-badge">📌</span>' : ""}
        <div class="als-product-info">
          <div class="als-product-name">${escHtml(p.name)}</div>
          <div class="als-product-price">${p.price ? formatCurrency(p.price) : "—"}</div>
        </div>
        <div class="als-product-actions">
          <button class="als-btn als-btn-xs ${p.isPinned ? "als-btn-ghost" : "als-btn-green"}" data-pin-id="${p.id}">
            ${p.isPinned ? "Fixado" : "Fixar"}
          </button>
        </div>
      `;
        item.querySelector(`[data-pin-id]`)?.addEventListener("click", async () => {
          if (p.isPinned) await this.productsMod.unpin();
          else await this.productsMod.pin(p.id);
        });
        list.appendChild(item);
      });
      wrap.innerHTML = "";
      wrap.appendChild(list);
      const optionsHtml = '<option value="">Selecione o produto...</option>' + products.map((p) => `<option value="${p.id}">${escHtml(p.name)}</option>`).join("");
      manualSelect.innerHTML = optionsHtml;
      autoPinSelect.innerHTML = optionsHtml;
    }
    _updatePinnedDisplay(productId) {
      const card = this.shadow.getElementById("als-pinned-card");
      const info = this.shadow.getElementById("als-pinned-info");
      const product = StateManager.products.find((p) => p.id === productId);
      if (product) {
        card.style.display = "block";
        info.innerHTML = `
        <div class="als-product-name">${escHtml(product.name)}</div>
        ${product.price ? `<div class="als-product-price">${formatCurrency(product.price)}</div>` : ""}
      `;
      }
    }
    async _promptGoal() {
      const current = StateManager.settings.gmvGoal;
      const input = window.prompt("Definir Meta de GMV (R$):", current ? String(current) : "");
      if (input === null) return;
      const amount = parseFloat(input.replace(/\./g, "").replace(",", "."));
      if (isNaN(amount) || amount <= 0) {
        EventBus.emit("toast:show", { message: "⚠ Valor de meta inválido", type: "warn" });
        return;
      }
      await this.goalsMod.setGoal(amount);
      this._renderGoal();
    }
    _renderGoal() {
      const status = this.goalsMod.getGoalStatus();
      const content = this.shadow.getElementById("als-goal-content");
      if (!status.goal) {
        content.innerHTML = `
        <div class="als-empty-state" style="padding:6px 0">
          <div>Sem meta definida</div>
          <button class="als-btn als-btn-green als-btn-xs mt6" id="als-btn-set-goal">+ Definir meta</button>
        </div>
      `;
        content.querySelector("#als-btn-set-goal")?.addEventListener("click", () => this._promptGoal());
        return;
      }
      content.innerHTML = `
      <div class="als-progress-wrap">
        <div class="als-progress-labels">
          <span class="text-green bold">${formatCurrency(status.currentGmv)}</span>
          <span class="text-muted">${formatCurrency(status.goal)}</span>
        </div>
        <div class="als-progress-track">
          <div class="als-progress-fill" style="width: ${status.percentage}%"></div>
        </div>
        <div class="flex-between mt4">
          <span class="text-muted">${status.percentage}% atingido</span>
          <span class="text-muted">Faltam ${formatCurrency(status.remaining)}</span>
        </div>
      </div>
    `;
    }
    _renderMessages(messages) {
      const list = this.shadow.getElementById("als-msg-list");
      list.innerHTML = "";
      messages.forEach((m) => {
        const div = document.createElement("div");
        div.className = `als-msg-item ${m.active ? "active-item" : ""}`;
        div.innerHTML = `
        <span class="als-msg-text">${escHtml(m.text)}</span>
        <div class="als-msg-actions">
          <button class="als-icon-btn-xs danger" data-del-msg="${m.id}">🗑</button>
        </div>
      `;
        div.querySelector("[data-del-msg]")?.addEventListener("click", async () => {
          const updated = await this.automationMod.removeChatMessage(m.id);
          this._renderMessages(updated);
        });
        list.appendChild(div);
      });
    }
    _renderReplies(replies) {
      const list = this.shadow.getElementById("als-reply-list");
      list.innerHTML = "";
      replies.forEach((r) => {
        const div = document.createElement("div");
        div.className = `als-msg-item ${r.active ? "active-item" : ""}`;
        div.innerHTML = `
        <div style="flex:1;min-width:0">
          <div class="als-tags">${r.triggers.map((t) => `<span class="als-tag">${escHtml(t)}</span>`).join("")}</div>
          <div class="als-msg-text mt4">"${escHtml(r.text)}"</div>
        </div>
        <div class="als-msg-actions">
          <button class="als-icon-btn-xs danger" data-del-reply="${r.id}">🗑</button>
        </div>
      `;
        div.querySelector("[data-del-reply]")?.addEventListener("click", async () => {
          const updated = await this.automationMod.removeAutoResponse(r.id);
          this._renderReplies(updated);
        });
        list.appendChild(div);
      });
    }
    _startTimer() {
      if (this.timerInterval) return;
      this.timerInterval = setInterval(() => {
        const startedAt = StateManager.live.startedAt;
        if (!startedAt) return;
        const ms = Date.now() - startedAt;
        const s = Math.floor(ms / 1e3);
        const h = Math.floor(s / 3600);
        const m = Math.floor(s % 3600 / 60);
        const sec = s % 60;
        const pad = (n) => String(n).padStart(2, "0");
        const hEl = this.shadow.getElementById("als-timer-h");
        const mEl = this.shadow.getElementById("als-timer-m");
        const sEl = this.shadow.getElementById("als-timer-s");
        if (hEl) hEl.textContent = pad(h);
        if (mEl) mEl.textContent = pad(m);
        if (sEl) sEl.textContent = pad(sec);
      }, 1e3);
    }
    _stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }
    _toggleCollapsible(id, open) {
      this.shadow.getElementById(id)?.classList.toggle("open", open);
    }
    async _hydrate() {
      const settings = await StorageManager.getSettings();
      if (settings.chatMessages) this._renderMessages(settings.chatMessages);
      if (settings.autoResponses) this._renderReplies(settings.autoResponses);
      if (settings.salesSoundEnabled || settings.soundEnabled) {
        const toggle = this.shadow.getElementById("als-toggle-sound");
        if (toggle) toggle.checked = true;
        this.audioMgr.setEnabled(true);
      }
      if (settings.licenseKey) {
        const input = this.shadow.getElementById("als-license-key");
        if (input) input.value = settings.licenseKey;
      }
      if (settings.licenseStatus) {
        const badge = this.shadow.getElementById("als-license-badge");
        if (badge) {
          badge.className = `als-badge als-badge-${settings.licenseStatus.toLowerCase()}`;
          badge.textContent = settings.licenseStatus;
        }
      }
      this._renderGoal();
    }
  }
  const MODULE$7 = "PanelInjector";
  class PanelInjector {
    activePanel = null;
    /**
     * Garante que apenas uma instância do painel flutuante seja injetada.
     */
    async inject() {
      if (this.isAlreadyInjected()) {
        Logger.warn(MODULE$7, "Painel já existente no DOM — injeção cancelada");
        return this.activePanel;
      }
      try {
        this.activePanel = new FloatingPanel();
        await this.activePanel.mount();
        Logger.info(MODULE$7, "Painel injetado com sucesso no DOM");
        return this.activePanel;
      } catch (err) {
        Logger.error(MODULE$7, "Erro fatal durante a injeção do painel:", err);
        return null;
      }
    }
    /**
     * Remove o painel do DOM caso exista.
     */
    destroy() {
      if (this.activePanel) {
        this.activePanel.unmount();
        this.activePanel = null;
      }
      const root = document.getElementById(PANEL_ROOT_ID);
      root?.remove();
    }
    /**
     * Verifica se o elemento root já está anexado ao documento.
     */
    isAlreadyInjected() {
      return !!document.getElementById(PANEL_ROOT_ID);
    }
  }
  const MODULE$6 = "MainWorldInjector";
  class MainWorldInjector {
    static isInjected = false;
    /**
     * Injeta o script do controlador no contexto MAIN WORLD da página.
     */
    static inject() {
      if (this.isInjected) return;
      this.isInjected = true;
      try {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("main-world/controller.js");
        script.id = "copilo-live-main-world";
        script.async = false;
        (document.head || document.documentElement).appendChild(script);
        script.onload = () => {
          Logger.info(MODULE$6, "✅ Controlador do MAIN WORLD carregado com sucesso.");
          script.remove();
        };
        script.onerror = (err) => {
          Logger.warn(MODULE$6, "Falha ao carregar script do MAIN WORLD:", err);
        };
      } catch (err) {
        Logger.warn(MODULE$6, "Erro ao criar elemento de injeção:", err);
      }
    }
  }
  const MODULE$5 = "LiveDetector";
  class LiveDetector {
    observer = null;
    urlCheckInterval = null;
    lastUrl = "";
    isRunning = false;
    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      Logger.info(MODULE$5, "Iniciando detector de LIVE...");
      this.lastUrl = window.location.href;
      this._check();
      this._startObserver();
      this._startUrlWatcher();
    }
    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.urlCheckInterval) {
        clearInterval(this.urlCheckInterval);
        this.urlCheckInterval = null;
      }
      Logger.info(MODULE$5, "Detector de LIVE finalizado");
    }
    _check() {
      const status = tiktokAdapter.live.getLiveStatus();
      const currentStatus = StateManager.live.status;
      if (status === "LIVE_ACTIVE" && currentStatus !== "LIVE_ACTIVE") {
        StateManager.setLiveStatus("LIVE_ACTIVE");
        Logger.info(MODULE$5, "🔴 LIVE ATIVA detectada no TikTok Shop");
      } else if (status === "LIVE_INACTIVE" && currentStatus === "LIVE_ACTIVE") {
        StateManager.setLiveStatus("LIVE_ENDED");
        Logger.info(MODULE$5, "⬛ LIVE ENCERRADA detectada");
      } else if (status === "LIVE_DETECTING" && currentStatus !== "LIVE_DETECTING") {
        StateManager.setLiveStatus("LIVE_DETECTING");
      }
    }
    _startObserver() {
      const debouncedCheck = debounce(() => this._check(), 1e3);
      this.observer = new MutationObserver(debouncedCheck);
      if (document.body) {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "data-status", "aria-label"]
        });
      }
    }
    _startUrlWatcher() {
      this.urlCheckInterval = setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== this.lastUrl) {
          Logger.info(MODULE$5, `Navegação detectada: ${currentUrl}`);
          this.lastUrl = currentUrl;
          setTimeout(() => this._check(), 1200);
        }
      }, 1e3);
    }
  }
  const MODULE$4 = "SalesDetector";
  class SalesDetector {
    observer = null;
    seenHashes = /* @__PURE__ */ new Set();
    isRunning = false;
    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      Logger.info(MODULE$4, "Iniciando detector de vendas no DOM...");
      this._startObserver();
    }
    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      Logger.info(MODULE$4, "Detector de vendas finalizado");
    }
    _startObserver() {
      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            this._processNode(node);
          }
        }
      });
      if (document.body) {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    }
    _processNode(node) {
      const isSaleNotification = TikTokSelectors.sales.notification.some((selector) => {
        try {
          return node.matches(selector) || !!node.querySelector(selector);
        } catch {
          return false;
        }
      });
      if (!isSaleNotification) return;
      const sale = this._extractSaleInfo(node);
      if (!sale) return;
      const hash = createUniqueHash(sale.id);
      if (this.seenHashes.has(hash)) return;
      this.seenHashes.add(hash);
      if (this.seenHashes.size > 500) {
        const arr = Array.from(this.seenHashes);
        this.seenHashes = new Set(arr.slice(arr.length - 250));
      }
      Logger.info(MODULE$4, `🛍 Nova venda detectada: ${sale.productName || "Produto"} - R$ ${sale.amount ?? 0}`);
      StateManager.addSale(sale);
    }
    _extractSaleInfo(node) {
      try {
        const text = node.textContent?.trim() || "";
        if (!text) return null;
        const priceMatch = text.match(/R\$\s*([\d.,]+)/i);
        const amount = priceMatch ? parseFloat(priceMatch[1].replace(/\./g, "").replace(",", ".")) : void 0;
        const productNameEl = node.querySelector(
          '[class*="product-name"], [class*="product-title"], [class*="goods-name"]'
        );
        const productName = productNameEl?.textContent?.trim() || void 0;
        const contentSignature = `${text.substring(0, 40)}_${Date.now()}`;
        const id = createUniqueHash(contentSignature);
        return {
          id,
          productName,
          amount,
          quantity: 1,
          timestamp: Date.now()
        };
      } catch (err) {
        Logger.debug(MODULE$4, "Erro ao extrair informações de venda:", err);
        return null;
      }
    }
  }
  const MODULE$3 = "ProductDetector";
  class ProductDetector {
    observer = null;
    isRunning = false;
    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      Logger.info(MODULE$3, "Iniciando detector de produtos...");
      this._syncProducts();
      this._startObserver();
    }
    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      Logger.info(MODULE$3, "Detector de produtos finalizado");
    }
    _syncProducts() {
      const products = tiktokAdapter.getProducts();
      if (products.length > 0) {
        StateManager.setProducts(products);
        const pinned = tiktokAdapter.getPinnedProduct();
        if (pinned) {
          StateManager.setPinnedProduct(pinned.id);
        }
      }
    }
    _startObserver() {
      const debouncedSync = debounce(() => this._syncProducts(), 1200);
      this.observer = new MutationObserver((mutations) => {
        const isProductMutation = mutations.some((m) => {
          const target = m.target;
          return TikTokSelectors.products.list.some((s) => target.matches?.(s) || target.querySelector?.(s)) || TikTokSelectors.products.item.some((s) => target.matches?.(s));
        });
        if (isProductMutation) {
          debouncedSync();
        }
      });
      if (document.body) {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "data-product-id", "data-goods-id"]
        });
      }
    }
  }
  const MODULE$2 = "MetricsDetector";
  class MetricsDetector {
    observer = null;
    isRunning = false;
    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      Logger.info(MODULE$2, "Iniciando detector de métricas do TikTok Shop...");
      this._readMetrics();
      this._startObserver();
    }
    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      Logger.info(MODULE$2, "Detector de métricas finalizado");
    }
    _readMetrics() {
      const metrics = tiktokAdapter.getLiveMetrics();
      if (Object.keys(metrics).length > 2) {
        StateManager.updateMetrics(metrics);
      }
    }
    _startObserver() {
      const debouncedRead = debounce(() => this._readMetrics(), 1500);
      this.observer = new MutationObserver((mutations) => {
        const isMetricsChange = mutations.some((m) => {
          const target = m.target;
          return TikTokSelectors.metrics.gmv.some((s) => target.matches?.(s) || target.querySelector?.(s)) || TikTokSelectors.metrics.viewers.some((s) => target.matches?.(s) || target.querySelector?.(s)) || TikTokSelectors.metrics.orders.some((s) => target.matches?.(s) || target.querySelector?.(s));
        });
        if (isMetricsChange) {
          debouncedRead();
        }
      });
      if (document.body) {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    }
  }
  const MODULE$1 = "LiveHeartbeatService";
  class LiveHeartbeatService {
    interval = null;
    intervalSecs;
    constructor(intervalSecs = DEFAULTS.HEARTBEAT_INTERVAL) {
      this.intervalSecs = intervalSecs;
    }
    start() {
      if (this.interval) return;
      Logger.info(MODULE$1, `Heartbeat iniciado (a cada ${this.intervalSecs}s)`);
      this._tick();
      this.interval = setInterval(() => this._tick(), this.intervalSecs * 1e3);
    }
    stop() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      Logger.info(MODULE$1, "Heartbeat finalizado");
    }
    _tick() {
      StateManager.heartbeat();
      const isActive = tiktokAdapter.isLiveActive();
      const currentStatus = StateManager.live.status;
      if (!isActive && currentStatus === "LIVE_ACTIVE") {
        Logger.info(MODULE$1, "Transmissão encerrada detectada pelo heartbeat");
        StateManager.setLiveStatus("LIVE_ENDED");
      }
      if (isActive && currentStatus !== "LIVE_ACTIVE") {
        StateManager.setLiveStatus("LIVE_ACTIVE");
      }
      if (isActive) {
        const metrics = tiktokAdapter.getLiveMetrics();
        if (Object.keys(metrics).length > 1) {
          StateManager.updateMetrics(metrics);
        }
      }
    }
  }
  const MODULE = "Bootstrap";
  if (window.__AUTO_LIVE_SHOP_INITIALIZED__) {
    Logger.warn(MODULE, `${APP_NAME} já inicializado nesta aba — cancelando execução redundante`);
  } else {
    window.__AUTO_LIVE_SHOP_INITIALIZED__ = true;
    startBootstrap().catch((err) => {
      Logger.error(MODULE, "Exceção não tratada no startBootstrap:", err);
    });
  }
  async function startBootstrap() {
    Logger.info(MODULE, `🚀 [INÍCIO] Inicializando ${APP_NAME}...`);
    Logger.info(MODULE, `URL detectada: ${window.location.href}`);
    const pageDetector = new PageDetector();
    const panelInjector = new PanelInjector();
    try {
      const [panelState, settings, license] = await Promise.all([
        StorageManager.getPanelState().catch(() => ({})),
        StorageManager.getSettings().catch(() => ({})),
        StorageManager.getLicense().catch(() => ({}))
      ]);
      StateManager.hydrate({
        panel: panelState,
        settings,
        license
      });
      await StorageManager.setInitialized().catch(() => {
      });
      Logger.info(MODULE, "Estado central e storage sincronizados com sucesso.");
    } catch (err) {
      Logger.warn(MODULE, "Aviso durante hidratação do storage (utilizando valores padrão):", err);
    }
    try {
      setupMessageBus(panelInjector);
    } catch (err) {
      Logger.warn(MODULE, "Aviso ao configurar MessageBus:", err);
    }
    const isTarget = pageDetector.isTargetPage();
    Logger.info(MODULE, `Página alvo detectada? ${isTarget ? "SIM (iniciando montagem)" : "NÃO (aguardando navegação SPA)"}`);
    if (isTarget) {
      MainWorldInjector.inject();
    }
    if (!isTarget) {
      const unwatch = pageDetector.watchNavigation(async () => {
        if (pageDetector.isTargetPage() && !panelInjector.isAlreadyInjected()) {
          unwatch();
          MainWorldInjector.inject();
          await initializeSession(panelInjector);
        }
      });
      return;
    }
    await initializeSession(panelInjector);
    pageDetector.watchNavigation(async () => {
      if (pageDetector.isTargetPage() && !panelInjector.isAlreadyInjected()) {
        Logger.info(MODULE, "Nova rota do TikTok Shop detectada via SPA — montando painel...");
        MainWorldInjector.inject();
        await initializeSession(panelInjector);
      }
    });
  }
  let liveDetector = null;
  let salesDetector = null;
  let productDetector = null;
  let metricsDetector = null;
  let heartbeatService = null;
  async function initializeSession(injector) {
    Logger.info(MODULE, "🔴 [ETAPA 1/3] Verificando disponibilidade do DOM...");
    if (!document.body && document.readyState === "loading") {
      await new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve, { once: true });
        setTimeout(resolve, 1e3);
      });
    }
    await sleep(400);
    Logger.info(MODULE, "🔴 [ETAPA 2/3] Injetando painel flutuante via Shadow DOM...");
    try {
      const mounted = await injector.inject();
      if (mounted) {
        Logger.info(MODULE, "✅ [ETAPA 2/3] Painel flutuante anexado ao DOM com sucesso.");
      } else {
        Logger.warn(MODULE, "⚠️ [ETAPA 2/3] Injetor retornou nulo (painel já existia ou falhou).");
      }
    } catch (err) {
      Logger.error(MODULE, "❌ Erro crítico ao injetar painel:", err);
    }
    Logger.info(MODULE, "🔴 [ETAPA 3/3] Iniciando detectores de LIVE, vitrine e métricas...");
    try {
      if (!liveDetector) {
        liveDetector = new LiveDetector();
        liveDetector.start();
      }
      if (!salesDetector) {
        salesDetector = new SalesDetector();
        salesDetector.start();
      }
      if (!productDetector) {
        productDetector = new ProductDetector();
        productDetector.start();
      }
      if (!metricsDetector) {
        metricsDetector = new MetricsDetector();
        metricsDetector.start();
      }
      if (!heartbeatService) {
        heartbeatService = new LiveHeartbeatService(10);
        heartbeatService.start();
      }
    } catch (err) {
      Logger.error(MODULE, "Erro ao inicializar detectores de sessão:", err);
    }
    EventBus.on("live:ended", () => {
      Logger.info(MODULE, "Sessão finalizada pelo evento live:ended");
    });
    Logger.info(MODULE, `🚀 ✅ Inicialização concluída com sucesso! ${APP_NAME} pronto.`);
  }
  function setupMessageBus(injector) {
    MessageBus.listen();
    MessageBus.on("ALS_PING", () => ({
      ok: true,
      name: APP_NAME,
      url: window.location.href,
      status: StateManager.live.status,
      isInjected: injector.isAlreadyInjected()
    }));
    MessageBus.on("ALS_GET_STATE", () => ({
      state: StateManager.getState()
    }));
    MessageBus.on("ALS_HEARTBEAT", () => {
      StateManager.heartbeat();
      return { ok: true, timestamp: Date.now() };
    });
  }
})();
