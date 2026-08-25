import { L as Logger, D as DEFAULTS, S as STORAGE_KEYS, P as PANEL_ROOT_ID } from "../chunks/Logger-DdLQpsBp.js";
function formatBRL(value) {
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
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function isTikTokLivePage(url = window.location.href) {
  return url.includes("shop.tiktok.com/streamer") || url.includes("/live-studio") || url.includes("/creator/live") || url.includes("tiktokshop") && url.includes("live");
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
class EventBusClass {
  listeners = /* @__PURE__ */ new Map();
  /** Subscreve a um evento */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    const cb = callback;
    this.listeners.get(event).add(cb);
    return () => this.off(event, callback);
  }
  /** Cancela subscrição */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }
  /** Emite um evento */
  emit(event, ...args) {
    const payload = args[0];
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[EventBus] Erro no handler de "${event}":`, err);
      }
    });
  }
  /** Remove todos os listeners de um evento */
  removeAll(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
const EventBus = new EventBusClass();
const MODULE$b = "StateManager";
function defaultMetrics() {
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
function defaultLiveState() {
  return {
    status: "LIVE_DETECTING",
    products: [],
    automationEnabled: false,
    automationIntervalSecs: DEFAULTS.REPIN_INTERVAL_SECS,
    lastHeartbeat: 0,
    metrics: defaultMetrics(),
    sales: []
  };
}
function defaultPanelState() {
  return {
    visible: true,
    minimized: false,
    x: DEFAULTS.PANEL_X,
    y: DEFAULTS.PANEL_Y,
    width: DEFAULTS.PANEL_WIDTH,
    height: DEFAULTS.PANEL_HEIGHT
  };
}
function defaultSettings() {
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
    guardianAction: "alert",
    licenseKey: "",
    licenseStatus: "FREE"
  };
}
class StateManagerClass {
  _state = {
    live: defaultLiveState(),
    panel: defaultPanelState(),
    settings: defaultSettings()
  };
  get state() {
    return this._state;
  }
  get live() {
    return this._state.live;
  }
  get panel() {
    return this._state.panel;
  }
  get settings() {
    return this._state.settings;
  }
  // ── Patch de estado (imutável) ───────────────────────────────
  patchLive(patch) {
    const prev = this._state.live;
    this._state = {
      ...this._state,
      live: { ...prev, ...patch }
    };
    Logger.debug(MODULE$b, "live patched:", patch);
  }
  patchPanel(patch) {
    this._state = {
      ...this._state,
      panel: { ...this._state.panel, ...patch }
    };
  }
  patchSettings(patch) {
    this._state = {
      ...this._state,
      settings: { ...this._state.settings, ...patch }
    };
    EventBus.emit("settings:changed", patch);
  }
  // ── Helpers de live ──────────────────────────────────────────
  setLiveStatus(status) {
    if (this._state.live.status === status) return;
    this.patchLive({ status });
    EventBus.emit("live:status_changed", status);
    if (status === "LIVE_ACTIVE" && !this._state.live.startedAt) {
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
    const existing = this._state.live.sales.some((s) => s.id === sale.id);
    if (existing) {
      Logger.debug(MODULE$b, "Venda duplicada ignorada:", sale.id);
      return;
    }
    const sales = [sale, ...this._state.live.sales].slice(0, 100);
    this.patchLive({ sales });
    EventBus.emit("sale:detected", sale);
    EventBus.emit("sales:updated", sales);
    const gmv = sales.reduce((sum, s) => sum + (s.amount ?? 0), 0);
    const soldItems = sales.reduce((sum, s) => sum + (s.quantity ?? 1), 0);
    const elapsed = this._state.live.startedAt ? (Date.now() - this._state.live.startedAt) / 36e5 : 1;
    this.updateMetrics({
      gmv,
      soldItems,
      salesCount: sales.length,
      salesPerHour: elapsed > 0 ? sales.length / elapsed : 0,
      source: "calculated"
    });
  }
  setProducts(products) {
    this.patchLive({ products });
    EventBus.emit("products:loaded", products);
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
  // ── Hidrate do storage ────────────────────────────────────────
  hydrate(partial) {
    if (partial.panel) this._state.panel = { ...defaultPanelState(), ...partial.panel };
    if (partial.settings) this._state.settings = { ...defaultSettings(), ...partial.settings };
    Logger.info(MODULE$b, "Estado hidratado do storage");
  }
  reset() {
    this._state = {
      live: defaultLiveState(),
      panel: this._state.panel,
      // preserva posição do painel
      settings: this._state.settings
    };
  }
}
const StateManager = new StateManagerClass();
const MODULE$a = "StorageManager";
class StorageManagerClass {
  async get(key, defaultValue) {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] !== void 0 ? result[key] : defaultValue;
    } catch (err) {
      Logger.error(MODULE$a, `Erro ao ler "${key}":`, err);
      return defaultValue;
    }
  }
  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (err) {
      Logger.error(MODULE$a, `Erro ao salvar "${key}":`, err);
    }
  }
  async remove(key) {
    try {
      await chrome.storage.local.remove(key);
    } catch (err) {
      Logger.error(MODULE$a, `Erro ao remover "${key}":`, err);
    }
  }
  // ── Métodos de alto nível ──────────────────────────────────
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
  async isInitialized() {
    return this.get(STORAGE_KEYS.INITIALIZED, false);
  }
  async setInitialized() {
    await this.set(STORAGE_KEYS.INITIALIZED, true);
  }
}
const StorageManager = new StorageManagerClass();
const MODULE$9 = "MessageBus";
class MessageBusClass {
  handlers = /* @__PURE__ */ new Map();
  /** Registra handler para um tipo de mensagem */
  on(type, handler) {
    this.handlers.set(type, handler);
  }
  /** Envia mensagem para o background */
  async send(type, payload) {
    const msg = { type, payload, timestamp: Date.now() };
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (err) {
      Logger.warn(MODULE$9, `Erro ao enviar "${type}":`, err);
      return null;
    }
  }
  /** Envia mensagem para uma aba específica (do background) */
  async sendToTab(tabId, type, payload) {
    const msg = { type, payload, tabId, timestamp: Date.now() };
    try {
      return await chrome.tabs.sendMessage(tabId, msg);
    } catch (err) {
      Logger.warn(MODULE$9, `Erro ao enviar para tab ${tabId} "${type}":`, err);
      return null;
    }
  }
  /** Inicializa o listener global (chamar uma vez) */
  listen() {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      const handler = this.handlers.get(msg.type);
      if (!handler) return false;
      const result = handler(msg, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch((err) => {
          Logger.error(MODULE$9, `Erro no handler "${msg.type}":`, err);
          sendResponse({ error: String(err) });
        });
        return true;
      }
      sendResponse(result);
      return false;
    });
  }
}
const MessageBus = new MessageBusClass();
const TikTokSelectors = {
  // ── Página / Detecção de live ───────────────────────────────
  live: {
    /** Indicador de que a live está ativa (badge "AO VIVO") */
    liveIndicator: [
      '[class*="live-status"]',
      '[class*="living-badge"]',
      '[class*="streaming-badge"]',
      '[data-testid="live-badge"]',
      ".live-indicator"
    ],
    /** Container principal do streamer */
    streamerContainer: [
      '[class*="streamer-container"]',
      '[class*="live-studio"]',
      "#live-studio-root",
      ".streamer-main"
    ],
    /** Botão de encerrar live */
    endLiveButton: [
      '[class*="end-live"]',
      '[data-testid="end-live-btn"]',
      'button[class*="end"]'
    ],
    /** Timer/cronômetro da live */
    liveTimer: [
      '[class*="live-timer"]',
      '[class*="stream-duration"]',
      '[data-testid="live-timer"]'
    ]
  },
  // ── Produtos ────────────────────────────────────────────────
  products: {
    /** Container da lista de produtos */
    list: [
      '[class*="product-list"]',
      '[class*="product-showcase"]',
      '[data-testid="product-list"]'
    ],
    /** Item individual de produto */
    item: [
      '[class*="product-item"]',
      '[class*="product-card"]',
      '[data-testid="product-item"]'
    ],
    /** Nome do produto */
    name: [
      '[class*="product-name"]',
      '[class*="product-title"]',
      '[data-testid="product-name"]'
    ],
    /** Preço do produto */
    price: [
      '[class*="product-price"]',
      '[class*="price-text"]',
      '[data-testid="product-price"]'
    ],
    /** Botão "Fixar" produto */
    pinButton: [
      '[class*="pin-btn"]',
      '[class*="pin-product"]',
      '[data-testid="pin-btn"]',
      'button[class*="pin"]'
    ],
    /** Botão "Desafixar" produto */
    unpinButton: [
      '[class*="unpin-btn"]',
      '[class*="unpin-product"]',
      '[data-testid="unpin-btn"]',
      'button[class*="unpin"]'
    ],
    /** Produto atualmente fixado */
    pinnedProduct: [
      '[class*="pinned-product"]',
      '[class*="product-pinned"]',
      '[data-testid="pinned-product"]'
    ]
  },
  // ── Chat ─────────────────────────────────────────────────────
  chat: {
    /** Container das mensagens */
    container: [
      '[class*="chat-container"]',
      '[class*="comment-list"]',
      '[data-testid="chat-list"]'
    ],
    /** Item de mensagem */
    message: [
      '[class*="chat-message"]',
      '[class*="comment-item"]',
      '[data-testid="chat-message"]'
    ],
    /** Autor da mensagem */
    author: [
      '[class*="chat-author"]',
      '[class*="comment-user"]',
      '[class*="username"]'
    ],
    /** Texto da mensagem */
    text: [
      '[class*="chat-text"]',
      '[class*="comment-text"]',
      '[class*="message-content"]'
    ],
    /** Input de novo comentário */
    input: [
      'input[class*="chat-input"]',
      'input[placeholder*="coment"]',
      'input[placeholder*="message"]',
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
      '[data-testid="gmv"]'
    ],
    /** Número de pedidos */
    orders: [
      '[class*="order-count"]',
      '[class*="orders-value"]',
      '[data-testid="orders"]'
    ],
    /** Espectadores simultâneos */
    viewers: [
      '[class*="viewer-count"]',
      '[class*="online-count"]',
      '[data-testid="viewers"]'
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
      '[class*="purchase-notification"]'
    ],
    /** Container de vendas recentes */
    container: [
      '[class*="recent-sales"]',
      '[class*="order-list"]'
    ]
  }
};
const MODULE$8 = "TikTokLiveAdapter";
class TikTokLiveAdapter {
  /** Verifica se a LIVE está ativa observando o DOM */
  isLiveActive() {
    const badge = queryWithFallbacks(TikTokSelectors.live.liveIndicator);
    if (badge) {
      Logger.debug(MODULE$8, "Badge de live encontrado:", badge);
      return true;
    }
    const container = queryWithFallbacks(TikTokSelectors.live.streamerContainer);
    if (container) {
      Logger.debug(MODULE$8, "Container de streamer encontrado");
      return true;
    }
    const url = window.location.href;
    const isLiveUrl = url.includes("streamer") || url.includes("live-studio") || url.includes("creator/live");
    Logger.debug(MODULE$8, "isLiveActive por URL:", isLiveUrl);
    return isLiveUrl;
  }
  /** Tenta ler métricas do DOM */
  getLiveMetrics() {
    const metrics = {
      updatedAt: Date.now(),
      source: "tiktok"
    };
    try {
      const gmvEl = queryWithFallbacks(TikTokSelectors.metrics.gmv);
      if (gmvEl) {
        const raw = gmvEl.textContent?.replace(/[^0-9.,]/g, "").replace(",", ".") ?? "";
        const val = parseFloat(raw);
        if (!isNaN(val)) metrics.gmv = val;
      }
      const viewersEl = queryWithFallbacks(TikTokSelectors.metrics.viewers);
      if (viewersEl) {
        const raw = viewersEl.textContent?.replace(/[^0-9]/g, "") ?? "";
        const val = parseInt(raw);
        if (!isNaN(val)) metrics.viewers = val;
      }
      const ordersEl = queryWithFallbacks(TikTokSelectors.metrics.orders);
      if (ordersEl) {
        const raw = ordersEl.textContent?.replace(/[^0-9]/g, "") ?? "";
        const val = parseInt(raw);
        if (!isNaN(val)) metrics.salesCount = val;
      }
      const soldEl = queryWithFallbacks(TikTokSelectors.metrics.soldItems);
      if (soldEl) {
        const raw = soldEl.textContent?.replace(/[^0-9]/g, "") ?? "";
        const val = parseInt(raw);
        if (!isNaN(val)) metrics.soldItems = val;
      }
    } catch (err) {
      Logger.warn(MODULE$8, "Erro ao ler métricas:", err);
      metrics.source = "unknown";
    }
    return metrics;
  }
  /** Tenta encerrar a live clicando no botão */
  async endLive() {
    try {
      const btn = queryWithFallbacks(TikTokSelectors.live.endLiveButton);
      if (!btn) {
        return { success: false, error: "Botão de encerrar não encontrado no DOM" };
      }
      btn.click();
      Logger.info(MODULE$8, "Botão de encerrar live clicado");
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
const MODULE$7 = "TikTokProductAdapter";
class TikTokProductAdapter {
  /** Lê a lista de produtos disponíveis na live */
  getProducts() {
    const items = queryAllWithFallbacks(TikTokSelectors.products.item);
    if (!items.length) {
      Logger.warn(MODULE$7, "Nenhum produto encontrado no DOM");
      return [];
    }
    const products = items.map((item, index) => {
      const nameEl = queryWithFallbacks(TikTokSelectors.products.name, item);
      const priceEl = queryWithFallbacks(TikTokSelectors.products.price, item);
      const isPinned = !!queryWithFallbacks(TikTokSelectors.products.pinnedProduct, item);
      const rawId = item.dataset["productId"] || item.dataset["id"] || `product-${index}`;
      const rawPrice = priceEl?.textContent?.replace(/[^0-9.,]/g, "").replace(",", ".") ?? "0";
      const price = parseFloat(rawPrice) || 0;
      return {
        id: rawId,
        name: nameEl?.textContent?.trim() || `Produto ${index + 1}`,
        price: price > 0 ? price : void 0,
        position: index,
        isPinned
      };
    });
    Logger.info(MODULE$7, `${products.length} produtos lidos do DOM`);
    return products;
  }
  /** Retorna o produto atualmente fixado */
  getPinnedProduct() {
    const products = this.getProducts();
    return products.find((p) => p.isPinned) ?? null;
  }
  /** Fixa um produto pelo ID */
  async pinProduct(productId) {
    try {
      const items = queryAllWithFallbacks(TikTokSelectors.products.item);
      for (const item of items) {
        const el = item;
        const id = el.dataset["productId"] || el.dataset["id"];
        if (id !== productId) continue;
        const pinBtn = queryWithFallbacks(TikTokSelectors.products.pinButton, item);
        if (!pinBtn) {
          return { success: false, error: "Botão de fixar não encontrado para este produto" };
        }
        pinBtn.click();
        Logger.info(MODULE$7, `Produto ${productId} — clique em Fixar`);
        await sleep(800);
        const confirmed = this._confirmPinned(productId);
        if (!confirmed) {
          Logger.warn(MODULE$7, "TikTok não confirmou a fixação");
          return { success: false, error: "TikTok não confirmou a fixação do produto" };
        }
        const products = this.getProducts();
        const product = products.find((p) => p.id === productId);
        return { success: true, data: { product } };
      }
      return { success: false, error: `Produto "${productId}" não encontrado na lista` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
  /** Desafixa o produto atual */
  async unpinProduct() {
    try {
      const unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton);
      if (!unpinBtn) {
        const pinned = queryWithFallbacks(TikTokSelectors.products.pinnedProduct);
        if (!pinned) {
          return { success: false, error: "Nenhum produto fixado encontrado" };
        }
        const unpinInPinned = queryWithFallbacks(TikTokSelectors.products.unpinButton, pinned);
        unpinInPinned?.click();
      } else {
        unpinBtn.click();
      }
      await sleep(600);
      Logger.info(MODULE$7, "Produto desafixado");
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
  /** Verifica se um produto foi realmente fixado */
  _confirmPinned(productId) {
    const products = this.getProducts();
    return products.some((p) => p.id === productId && p.isPinned);
  }
}
const MODULE$6 = "TikTokShopAdapter";
class TikTokShopAdapter {
  live = new TikTokLiveAdapter();
  products = new TikTokProductAdapter();
  isLiveActive() {
    return this.live.isLiveActive();
  }
  getProducts() {
    return this.products.getProducts();
  }
  getPinnedProduct() {
    return this.products.getPinnedProduct();
  }
  async pinProduct(productId) {
    Logger.info(MODULE$6, "pinProduct:", productId);
    return this.products.pinProduct(productId);
  }
  async unpinProduct() {
    Logger.info(MODULE$6, "unpinProduct");
    return this.products.unpinProduct();
  }
  getLiveMetrics() {
    return this.live.getLiveMetrics();
  }
  async sendChatMessage(text) {
    try {
      const selectors = [
        'input[class*="chat-input"]',
        'input[placeholder*="coment"]',
        'input[placeholder*="message"]',
        '[contenteditable="true"]'
      ];
      let input = null;
      for (const sel of selectors) {
        input = document.querySelector(sel);
        if (input) break;
      }
      if (!input) {
        return { success: false, error: "Input do chat não encontrado" };
      }
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      if (nativeInputValueSetter && input instanceof HTMLInputElement) {
        nativeInputValueSetter.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        input.textContent = text;
        input.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      }
      await new Promise((r) => setTimeout(r, 200));
      const sendSelectors = [
        '[class*="send-btn"]',
        'button[class*="send"]',
        '[data-testid="send-btn"]'
      ];
      let sendBtn = null;
      for (const sel of sendSelectors) {
        sendBtn = document.querySelector(sel);
        if (sendBtn) break;
      }
      if (sendBtn) {
        sendBtn.click();
        Logger.info(MODULE$6, "Mensagem enviada:", text.substring(0, 30));
        return { success: true };
      }
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
  async endLive() {
    return this.live.endLive();
  }
}
const tiktokAdapter = new TikTokShopAdapter();
const MODULE$5 = "LiveDetector";
class LiveDetector {
  observer = null;
  urlCheckInterval = null;
  lastUrl = "";
  start() {
    Logger.info(MODULE$5, "Iniciando...");
    this.lastUrl = window.location.href;
    this._check();
    this._startObserver();
    this._startUrlWatcher();
  }
  stop() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.urlCheckInterval) clearInterval(this.urlCheckInterval);
    this.urlCheckInterval = null;
    Logger.info(MODULE$5, "Parado");
  }
  _check() {
    const isActive = tiktokAdapter.isLiveActive();
    const currentStatus = StateManager.live.status;
    if (isActive && currentStatus !== "LIVE_ACTIVE") {
      StateManager.setLiveStatus("LIVE_ACTIVE");
      Logger.info(MODULE$5, "🔴 LIVE ATIVA detectada");
    } else if (!isActive && currentStatus === "LIVE_ACTIVE") {
      StateManager.setLiveStatus("LIVE_ENDED");
      Logger.info(MODULE$5, "⬛ Live encerrada");
    } else if (!isActive && currentStatus === "LIVE_DETECTING") {
      Logger.debug(MODULE$5, "Aguardando live...");
    }
  }
  _startObserver() {
    const debouncedCheck = debounce(() => this._check(), 1e3);
    this.observer = new MutationObserver(debouncedCheck);
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-status"]
    });
  }
  _startUrlWatcher() {
    this.urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl) {
        Logger.info(MODULE$5, "Navegação SPA detectada:", currentUrl);
        this.lastUrl = currentUrl;
        setTimeout(() => this._check(), 1500);
      }
    }, 1e3);
  }
}
const MODULE$4 = "SalesDetector";
class SalesDetector {
  observer = null;
  seenIds = /* @__PURE__ */ new Set();
  start() {
    Logger.info(MODULE$4, "Iniciando observer de vendas...");
    this._startObserver();
  }
  stop() {
    this.observer?.disconnect();
    this.observer = null;
    Logger.info(MODULE$4, "Parado");
  }
  _startObserver() {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          this._checkForSale(node);
        }
      }
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  _checkForSale(node) {
    const isSaleNode = TikTokSelectors.sales.notification.some((sel) => {
      try {
        return node.matches(sel) || node.querySelector(sel);
      } catch {
        return false;
      }
    });
    if (!isSaleNode) return;
    const sale = this._extractSale(node);
    if (!sale) return;
    if (this.seenIds.has(sale.id)) return;
    this.seenIds.add(sale.id);
    if (this.seenIds.size > 500) {
      const arr = Array.from(this.seenIds);
      this.seenIds = new Set(arr.slice(arr.length - 200));
    }
    Logger.info(MODULE$4, "Nova venda detectada:", sale);
    StateManager.addSale(sale);
  }
  _extractSale(node) {
    try {
      const text = node.textContent?.trim() || "";
      const priceMatch = text.match(/R\$\s*([\d.,]+)/);
      const amount = priceMatch ? parseFloat(priceMatch[1].replace(".", "").replace(",", ".")) : void 0;
      const productNameEl = node.querySelector('[class*="product-name"], [class*="product-title"]');
      const productName = productNameEl?.textContent?.trim() || void 0;
      const contentHash = `${text.substring(0, 50)}_${Date.now()}`;
      const id = btoa(contentHash).substring(0, 16);
      return {
        id,
        productName,
        amount,
        quantity: 1,
        timestamp: Date.now()
      };
    } catch {
      return null;
    }
  }
}
const MODULE$3 = "ProductController";
class ProductController {
  /** Busca e atualiza lista de produtos */
  refreshProducts() {
    try {
      const products = tiktokAdapter.getProducts();
      StateManager.setProducts(products);
      Logger.info(MODULE$3, `${products.length} produtos carregados`);
      return { success: true, data: products };
    } catch (err) {
      Logger.error(MODULE$3, "Erro ao buscar produtos:", err);
      return { success: false, error: String(err) };
    }
  }
  /** Fixa um produto */
  async pinProduct(productId) {
    const result = await tiktokAdapter.pinProduct(productId);
    if (result.success) {
      StateManager.setPinnedProduct(productId);
      EventBus.emit("products:pinned", { productId });
      EventBus.emit("toast:show", { message: "📌 Produto fixado", type: "success" });
    } else {
      EventBus.emit("products:pin_failed", { error: result.error ?? "Erro desconhecido" });
      EventBus.emit("toast:show", {
        message: `⚠ ${result.error || "TikTok não confirmou a fixação"}`,
        type: "warn"
      });
    }
    return result;
  }
  /** Desafixa o produto */
  async unpinProduct() {
    const result = await tiktokAdapter.unpinProduct();
    if (result.success) {
      StateManager.setPinnedProduct(void 0);
      EventBus.emit("products:unpinned");
      EventBus.emit("toast:show", { message: "Produto desafixado", type: "info" });
    } else {
      EventBus.emit("toast:show", { message: `⚠ ${result.error}`, type: "warn" });
    }
    return result;
  }
}
const AUTO_MODULE = "AutomationController";
class AutomationController {
  repinTimer = null;
  productController = new ProductController();
  start(productId, intervalSecs) {
    this.stop();
    Logger.info(AUTO_MODULE, `Automação iniciada — produto: ${productId}, intervalo: ${intervalSecs}s`);
    StateManager.patchLive({
      automationEnabled: true,
      automationProductId: productId,
      automationIntervalSecs: intervalSecs
    });
    EventBus.emit("automation:started", { productId, intervalSecs });
    EventBus.emit("toast:show", { message: "▶ Automação de fixação iniciada", type: "success" });
    this.repinTimer = setInterval(async () => {
      if (StateManager.live.status !== "LIVE_ACTIVE") {
        this.stop();
        return;
      }
      Logger.debug(AUTO_MODULE, "Refixando produto:", productId);
      EventBus.emit("automation:repin", { productId });
      await this.productController.pinProduct(productId);
    }, intervalSecs * 1e3);
  }
  stop() {
    if (this.repinTimer) {
      clearInterval(this.repinTimer);
      this.repinTimer = null;
    }
    StateManager.patchLive({ automationEnabled: false });
    EventBus.emit("automation:stopped");
  }
  isRunning() {
    return this.repinTimer !== null;
  }
}
const MODULE$2 = "LiveHeartbeatService";
class LiveHeartbeatService {
  interval = null;
  intervalSecs;
  constructor(intervalSecs = DEFAULTS.HEARTBEAT_INTERVAL) {
    this.intervalSecs = intervalSecs;
  }
  start() {
    if (this.interval) return;
    Logger.info(MODULE$2, `Heartbeat iniciado (${this.intervalSecs}s)`);
    this._tick();
    this.interval = setInterval(() => this._tick(), this.intervalSecs * 1e3);
  }
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    Logger.info(MODULE$2, "Heartbeat parado");
  }
  _tick() {
    StateManager.heartbeat();
    const isActive = tiktokAdapter.isLiveActive();
    const currentStatus = StateManager.live.status;
    if (!isActive && currentStatus === "LIVE_ACTIVE") {
      Logger.info(MODULE$2, "Live encerrada pelo heartbeat");
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
const AUDIO_MODULE = "AudioManager";
class AudioManager {
  ctx = null;
  enabled = false;
  async unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      this.enabled = true;
      Logger.info(AUDIO_MODULE, "AudioContext desbloqueado");
    } catch (err) {
      Logger.warn(AUDIO_MODULE, "Não foi possível desbloquear áudio:", err);
    }
  }
  async playSaleSound() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1e-3, this.ctx.currentTime + 0.5);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.5);
    } catch (err) {
      Logger.warn(AUDIO_MODULE, "Erro ao tocar som:", err);
    }
  }
  setEnabled(val) {
    this.enabled = val;
  }
  isEnabled() {
    return this.enabled;
  }
}
const LICENSE_MODULE = "LicenseManager";
class LicenseManager {
  status = "FREE";
  async validate(key) {
    if (key.startsWith("PRO-") && key.length >= 12) {
      this.status = "PRO";
      Logger.info(LICENSE_MODULE, "Licença PRO ativada (modo demo)");
      return { status: "PRO", valid: true };
    }
    if (key.startsWith("PREMIUM-") && key.length >= 16) {
      this.status = "PREMIUM";
      Logger.info(LICENSE_MODULE, "Licença PREMIUM ativada (modo demo)");
      return { status: "PREMIUM", valid: true };
    }
    this.status = "FREE";
    return { status: "FREE", valid: false };
  }
  getStatus() {
    return this.status;
  }
  hasFeature(feature) {
    if (this.status === "PREMIUM") return true;
    if (this.status === "PRO") return feature !== "analytics";
    return false;
  }
}
const panelCss = "\n@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');\n/* ============================================================\n   Auto Live Shop V2 — Estilos do Floating Panel\n   Injetado via Shadow DOM — isolado do TikTok\n   ============================================================ */\n\n/* ── Fonte ────────────────────────────────────────────────── */\n\n/* ── Tokens de design ────────────────────────────────────────*/\n:host {\n  --bg:          #080d1a;\n  --bg-card:     #0d1525;\n  --bg-card-alt: #111c30;\n  --bg-sub:      #0a1220;\n  --border:      #1e2d47;\n  --border-light:#2a3f5c;\n  --green:       #22c55e;\n  --green-dim:   #16a34a;\n  --green-glow:  rgba(34,197,94,0.18);\n  --teal:        #14b8a6;\n  --teal-dim:    #0d8a7c;\n  --teal-glow:   rgba(20,184,166,0.15);\n  --teal-light:  #5eead4;\n  --red:         #ef4444;\n  --red-dim:     #b91c1c;\n  --orange:      #f97316;\n  --yellow:      #eab308;\n  --text-1:      #f0f6ff;\n  --text-2:      #94a3b8;\n  --text-3:      #64748b;\n  --shadow:      0 8px 32px rgba(0,0,0,0.7);\n  --radius:      12px;\n  --radius-sm:   8px;\n  --radius-xs:   5px;\n  --transition:  0.18s ease;\n  --font:        'Inter', system-ui, -apple-system, sans-serif;\n  all: initial;\n}\n\n*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n\n/* ── Painel raiz ──────────────────────────────────────────── */\n.als-panel {\n  position: fixed;\n  top: var(--als-y, 80px);\n  left: var(--als-x, 16px);\n  width: var(--als-w, 320px);\n  height: var(--als-h, 560px);\n  z-index: 2147483647;\n  display: flex;\n  flex-direction: column;\n  background: var(--bg);\n  border: 1px solid var(--border-light);\n  border-radius: var(--radius);\n  box-shadow: var(--shadow);\n  font-family: var(--font);\n  font-size: 13px;\n  color: var(--text-1);\n  overflow: hidden;\n  user-select: none;\n  -webkit-font-smoothing: antialiased;\n  transition: box-shadow var(--transition);\n}\n.als-panel:hover { box-shadow: 0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px var(--border-light); }\n.als-panel.minimized { height: 48px !important; overflow: hidden; }\n.als-panel.hidden { display: none !important; }\n\n/* ── Scrollbar ────────────────────────────────────────────── */\n::-webkit-scrollbar { width: 3px; }\n::-webkit-scrollbar-track { background: transparent; }\n::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 3px; }\n\n/* ── Header / Drag handle ─────────────────────────────────── */\n.als-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0 10px;\n  height: 48px;\n  min-height: 48px;\n  background: linear-gradient(135deg, #0d1525, #111c30);\n  border-bottom: 1px solid var(--border);\n  cursor: grab;\n  flex-shrink: 0;\n}\n.als-header:active { cursor: grabbing; }\n\n.als-header-left { display: flex; align-items: center; gap: 8px; }\n\n.als-logo {\n  width: 26px;\n  height: 26px;\n  background: linear-gradient(135deg, var(--teal), var(--teal-dim));\n  border-radius: 7px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 14px;\n  flex-shrink: 0;\n  box-shadow: 0 0 10px var(--teal-glow);\n}\n\n.als-brand { display: flex; flex-direction: column; line-height: 1.2; }\n.als-brand-name { font-size: 12px; font-weight: 800; color: var(--text-1); letter-spacing: -0.2px; }\n.als-brand-sub  { font-size: 9px; color: var(--teal); font-weight: 600; }\n\n.als-header-right { display: flex; align-items: center; gap: 4px; }\n\n/* Status badge no header */\n.als-live-badge {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 3px 8px;\n  border-radius: 12px;\n  font-size: 9px;\n  font-weight: 800;\n  letter-spacing: 0.5px;\n  margin-right: 4px;\n}\n.als-live-badge.detecting { background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.4); color: var(--text-3); }\n.als-live-badge.active    { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fc8181; }\n.als-live-badge.inactive  { background: rgba(100,116,139,0.15); border: 1px solid rgba(100,116,139,0.3); color: var(--text-3); }\n.als-live-badge.ended     { background: rgba(100,116,139,0.15); border: 1px solid rgba(100,116,139,0.3); color: var(--text-3); }\n.als-live-badge.error     { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fc8181; }\n\n.als-live-dot {\n  width: 7px; height: 7px;\n  border-radius: 50%;\n  background: var(--red);\n  animation: als-pulse 1.4s infinite;\n  flex-shrink: 0;\n}\n@keyframes als-pulse {\n  0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }\n  50%      { box-shadow: 0 0 0 5px rgba(239,68,68,0); }\n}\n.als-live-badge:not(.active) .als-live-dot { animation: none; background: var(--text-3); }\n\n.als-icon-btn {\n  background: none; border: none;\n  color: var(--text-3); cursor: pointer;\n  width: 26px; height: 26px;\n  border-radius: var(--radius-xs);\n  display: flex; align-items: center; justify-content: center;\n  font-size: 14px;\n  transition: color var(--transition), background var(--transition);\n}\n.als-icon-btn:hover { color: var(--text-1); background: rgba(255,255,255,0.06); }\n\n/* ── Tab Nav ──────────────────────────────────────────────── */\n.als-tab-nav {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  background: var(--bg-card);\n  border-bottom: 1px solid var(--border);\n  flex-shrink: 0;\n}\n.als-tab-btn {\n  display: flex; flex-direction: column; align-items: center; justify-content: center;\n  gap: 2px; padding: 7px 4px;\n  background: none; border: none;\n  border-bottom: 2px solid transparent;\n  color: var(--text-3); cursor: pointer;\n  font-family: var(--font);\n  transition: color var(--transition), border-color var(--transition), background var(--transition);\n}\n.als-tab-btn:hover { color: var(--text-2); background: rgba(255,255,255,0.02); }\n.als-tab-btn.active { color: var(--green); border-bottom-color: var(--green); background: rgba(34,197,94,0.04); }\n.als-tab-icon  { font-size: 13px; }\n.als-tab-label { font-size: 8.5px; font-weight: 700; letter-spacing: 0.3px; }\n\n/* ── Conteúdo ─────────────────────────────────────────────── */\n.als-content {\n  flex: 1;\n  overflow-y: auto;\n  overflow-x: hidden;\n  padding: 10px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n/* ── Abas ─────────────────────────────────────────────────── */\n.als-pane { display: none; flex-direction: column; gap: 8px; animation: als-fadeIn 0.18s ease; }\n.als-pane.active { display: flex; }\n@keyframes als-fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }\n\n/* ── Cards ─────────────────────────────────────────────────── */\n.als-card {\n  background: var(--bg-card);\n  border: 1px solid var(--border);\n  border-radius: var(--radius-sm);\n  padding: 12px;\n  transition: border-color var(--transition);\n}\n.als-card:hover { border-color: var(--border-light); }\n.als-card-sub {\n  background: var(--bg-sub);\n  border: 1px solid var(--border);\n  border-radius: var(--radius-xs);\n  padding: 9px;\n  margin-top: 8px;\n}\n\n.als-card-header {\n  display: flex; align-items: flex-start; justify-content: space-between; gap: 6px;\n}\n.als-card-title { font-size: 12px; font-weight: 700; color: var(--text-1); line-height: 1.3; }\n.als-card-desc  { font-size: 10px; color: var(--text-2); margin-top: 2px; line-height: 1.4; }\n\n/* ── Status cards ─────────────────────────────────────────── */\n.als-status-card {\n  background: linear-gradient(135deg, #0d1525, #0f1e35);\n  border-color: var(--border-light);\n  box-shadow: 0 0 20px rgba(20,184,166,0.12);\n}\n.als-empty-state {\n  text-align: center; color: var(--text-3);\n  padding: 20px 0; font-size: 11px; line-height: 1.6;\n}\n.als-empty-icon { font-size: 28px; margin-bottom: 8px; }\n\n/* ── Section label ────────────────────────────────────────── */\n.als-section-label {\n  font-size: 8.5px; font-weight: 800; color: var(--text-3);\n  letter-spacing: 1.2px; text-transform: uppercase;\n  padding: 2px 0;\n}\n\n/* ── Metrics grid ─────────────────────────────────────────── */\n.als-metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }\n.als-metric {\n  background: var(--bg-card);\n  border: 1px solid var(--border);\n  border-radius: var(--radius-sm);\n  padding: 10px 8px; text-align: center;\n  transition: border-color var(--transition), box-shadow var(--transition);\n}\n.als-metric:hover { border-color: var(--green-dim); box-shadow: 0 0 10px var(--green-glow); }\n.als-metric-label { font-size: 8.5px; font-weight: 700; color: var(--text-3); letter-spacing: 0.8px; text-transform: uppercase; }\n.als-metric-value { font-size: 20px; font-weight: 900; color: var(--teal-light); line-height: 1.2; margin: 2px 0; font-variant-numeric: tabular-nums; }\n.als-metric-sub   { font-size: 9px; color: var(--text-3); }\n\n/* ── GMV hero ─────────────────────────────────────────────── */\n.als-gmv-hero { text-align: center; padding: 4px 0; }\n.als-gmv-label { font-size: 9px; font-weight: 700; color: var(--text-3); letter-spacing: 1px; text-transform: uppercase; }\n.als-gmv-value { font-size: 28px; font-weight: 900; color: var(--green); font-variant-numeric: tabular-nums; letter-spacing: -1px; line-height: 1.1; margin: 4px 0; text-shadow: 0 0 20px rgba(34,197,94,0.4); }\n.als-gmv-sub   { font-size: 10px; color: var(--text-2); }\n\n/* ── Progress bar (meta) ──────────────────────────────────── */\n.als-progress-wrap { margin-top: 8px; }\n.als-progress-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-2); margin-bottom: 4px; }\n.als-progress-track { background: var(--border); border-radius: 4px; height: 6px; overflow: hidden; }\n.als-progress-fill  { height: 100%; background: linear-gradient(90deg, var(--green-dim), var(--green)); border-radius: 4px; transition: width 0.5s ease; }\n\n/* ── Sales feed ───────────────────────────────────────────── */\n.als-sales-feed { max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }\n.als-sale-item {\n  display: flex; justify-content: space-between; align-items: center;\n  background: rgba(34,197,94,0.05); border: 1px solid rgba(34,197,94,0.15);\n  border-radius: 6px; padding: 6px 10px;\n  animation: als-slideIn 0.25s ease;\n}\n@keyframes als-slideIn { from { opacity:0; transform: translateX(-6px); } to { opacity:1; transform:none; } }\n.als-sale-name { font-size: 11px; font-weight: 600; color: var(--text-1); }\n.als-sale-meta { font-size: 10px; color: var(--text-3); }\n.als-sale-amount { font-size: 11px; font-weight: 700; color: var(--green); }\n\n/* ── Buttons ──────────────────────────────────────────────── */\n.als-btn {\n  display: inline-flex; align-items: center; gap: 4px;\n  border: none; border-radius: var(--radius-sm);\n  font-family: var(--font); font-weight: 600; cursor: pointer;\n  transition: all var(--transition); white-space: nowrap;\n}\n.als-btn-sm { padding: 6px 12px; font-size: 11px; }\n.als-btn-xs { padding: 4px 8px; font-size: 10px; }\n.als-btn-full { width: 100%; justify-content: center; }\n\n.als-btn-green {\n  background: linear-gradient(135deg, var(--green), var(--green-dim));\n  color: #fff; box-shadow: 0 2px 8px rgba(34,197,94,0.3);\n}\n.als-btn-green:hover { box-shadow: 0 4px 14px rgba(34,197,94,0.5); transform: translateY(-1px); }\n\n.als-btn-teal {\n  background: linear-gradient(135deg, var(--teal), var(--teal-dim));\n  color: #fff; box-shadow: 0 2px 8px rgba(20,184,166,0.3);\n}\n.als-btn-teal:hover { box-shadow: 0 4px 14px rgba(20,184,166,0.5); transform: translateY(-1px); }\n\n.als-btn-ghost {\n  background: var(--bg-card-alt); color: var(--text-2);\n  border: 1px solid var(--border);\n}\n.als-btn-ghost:hover { background: var(--border); color: var(--text-1); }\n\n.als-btn-danger {\n  background: linear-gradient(135deg, var(--red), var(--red-dim));\n  color: #fff; box-shadow: 0 2px 8px rgba(239,68,68,0.3);\n}\n.als-btn-danger:hover { box-shadow: 0 4px 14px rgba(239,68,68,0.5); transform: translateY(-1px); }\n\n/* ── Toggle switch ────────────────────────────────────────── */\n.als-toggle { position: relative; display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0; }\n.als-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }\n.als-toggle-slider {\n  width: 38px; height: 21px;\n  background: var(--border); border-radius: 11px;\n  position: relative; transition: background var(--transition); flex-shrink: 0;\n}\n.als-toggle-slider::after {\n  content: ''; position: absolute; top: 2.5px; left: 2.5px;\n  width: 16px; height: 16px; background: var(--text-3);\n  border-radius: 50%; transition: transform var(--transition), background var(--transition);\n}\n.als-toggle input:checked + .als-toggle-slider { background: var(--green); }\n.als-toggle input:checked + .als-toggle-slider::after { transform: translateX(17px); background: #fff; }\n\n.als-toggle-sm .als-toggle-slider { width: 30px; height: 17px; }\n.als-toggle-sm .als-toggle-slider::after { width: 13px; height: 13px; }\n.als-toggle-sm input:checked + .als-toggle-slider::after { transform: translateX(13px); }\n\n/* ── Toggle row ───────────────────────────────────────────── */\n.als-toggle-row {\n  display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 5px 0;\n}\n.als-toggle-row-label { font-size: 12px; font-weight: 600; color: var(--text-1); }\n.als-toggle-row-desc  { font-size: 10px; color: var(--text-2); margin-top: 1px; }\n\n/* ── Forms ────────────────────────────────────────────────── */\n.als-form-group { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }\n.als-form-label { font-size: 10px; font-weight: 600; color: var(--text-2); }\n.als-form-hint  { font-size: 9.5px; color: var(--text-3); }\n\n.als-input, .als-select, .als-textarea {\n  background: var(--bg-sub); border: 1px solid var(--border);\n  border-radius: var(--radius-xs); color: var(--text-1);\n  font-family: var(--font); font-size: 12px; padding: 6px 9px;\n  width: 100%; outline: none;\n  transition: border-color var(--transition), box-shadow var(--transition);\n}\n.als-input:focus, .als-select:focus, .als-textarea:focus {\n  border-color: var(--green); box-shadow: 0 0 0 2px var(--green-glow);\n}\n.als-select { appearance: none; cursor: pointer; padding-right: 24px; }\n.als-textarea { resize: vertical; min-height: 52px; }\n\n.als-select-wrap { position: relative; }\n.als-select-wrap::after { content:'▾'; position:absolute; right:8px; top:50%; transform:translateY(-50%); color:var(--text-3); pointer-events:none; font-size:11px; }\n\n.als-num-input {\n  background: var(--bg-sub); border: 1px solid var(--border);\n  border-radius: var(--radius-xs); color: var(--teal-light);\n  font-family: var(--font); font-size: 15px; font-weight: 700;\n  padding: 5px; text-align: center; width: 56px; outline: none;\n}\n.als-num-input:focus { border-color: var(--green); }\n\n.als-input-row { display: flex; align-items: center; gap: 6px; }\n.als-input-label { font-size: 10px; color: var(--text-2); white-space: nowrap; }\n\n/* ── Product list ─────────────────────────────────────────── */\n.als-product-list { display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto; }\n.als-product-item {\n  display: flex; align-items: center; gap: 8px;\n  background: var(--bg-sub); border: 1px solid var(--border);\n  border-radius: var(--radius-xs); padding: 7px 9px;\n  transition: border-color var(--transition);\n}\n.als-product-item:hover { border-color: var(--border-light); }\n.als-product-item.pinned { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.04); }\n.als-product-pin-badge { font-size: 10px; color: var(--green); font-weight: 700; }\n.als-product-info { flex: 1; min-width: 0; }\n.als-product-name { font-size: 11px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.als-product-price { font-size: 10px; color: var(--text-3); }\n.als-product-actions { display: flex; gap: 4px; flex-shrink: 0; }\n\n/* ── Message / reply list ─────────────────────────────────── */\n.als-msg-list { display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto; }\n.als-msg-item {\n  display: flex; align-items: center; gap: 6px;\n  background: var(--bg-sub); border: 1px solid var(--border);\n  border-radius: var(--radius-xs); padding: 7px 9px;\n}\n.als-msg-item.active-item { border-color: rgba(34,197,94,0.25); }\n.als-msg-text { flex: 1; font-size: 11px; color: var(--text-1); line-height: 1.4; }\n.als-msg-actions { display: flex; gap: 4px; flex-shrink: 0; }\n\n.als-icon-btn-xs {\n  background: none; border: none; color: var(--text-3); cursor: pointer;\n  font-size: 12px; padding: 2px 4px; border-radius: 4px;\n  transition: color var(--transition), background var(--transition);\n}\n.als-icon-btn-xs:hover { color: var(--text-1); background: var(--border); }\n.als-icon-btn-xs.danger:hover { color: var(--red); }\n\n/* ── Trigger tags ─────────────────────────────────────────── */\n.als-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }\n.als-tag {\n  background: rgba(20,184,166,0.12); border: 1px solid rgba(20,184,166,0.25);\n  color: var(--teal-light); border-radius: 10px;\n  padding: 2px 7px; font-size: 9.5px; font-weight: 600;\n}\n\n/* ── Checkbox ─────────────────────────────────────────────── */\n.als-checkbox-list { display: flex; flex-direction: column; gap: 7px; }\n.als-checkbox-item { display: flex; align-items: center; gap: 9px; cursor: pointer; font-size: 12px; color: var(--text-1); }\n.als-checkbox-item input { display: none; }\n.als-checkbox-custom {\n  width: 17px; height: 17px; border: 2px solid var(--border-light);\n  border-radius: 4px; background: var(--bg-sub); flex-shrink: 0;\n  position: relative; transition: all var(--transition);\n}\n.als-checkbox-custom::after {\n  content:''; position:absolute; top:2px; left:5px;\n  width:4px; height:8px; border: 2px solid #fff; border-top:none; border-left:none;\n  transform:rotate(45deg); opacity:0; transition: opacity var(--transition);\n}\n.als-checkbox-item input:checked + .als-checkbox-custom { background: var(--green); border-color: var(--green); }\n.als-checkbox-item input:checked + .als-checkbox-custom::after { opacity:1; }\n\n/* ── License card ─────────────────────────────────────────── */\n.als-license-card { background: linear-gradient(135deg, #0d1525, #101f38); border-color: rgba(34,197,94,0.25); }\n.als-badge { border-radius: 10px; padding: 2px 8px; font-size: 9.5px; font-weight: 700; }\n.als-badge-free    { background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.4); color: var(--text-3); }\n.als-badge-pro     { background: rgba(20,184,166,0.15); border: 1px solid rgba(20,184,166,0.4); color: var(--teal-light); }\n.als-badge-premium { background: rgba(234,179,8,0.15); border: 1px solid rgba(234,179,8,0.4); color: var(--yellow); }\n.als-badge-active  { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.4); color: var(--green); }\n\n.als-input-eye-wrap { position: relative; }\n.als-input-eye-wrap .als-input { padding-right: 32px; }\n.als-eye-btn {\n  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);\n  background: none; border: none; color: var(--text-3); cursor: pointer; font-size: 14px;\n}\n\n.als-link { font-size: 10px; color: var(--teal); text-decoration: none; border-bottom: 1px dashed var(--teal-dim); }\n.als-link:hover { color: var(--teal-light); }\n\n/* ── Collapsible ──────────────────────────────────────────── */\n.als-collapsible { display: none; }\n.als-collapsible.open { display: block; }\n\n/* ── Sliders ──────────────────────────────────────────────── */\n.als-range {\n  width: 100%; appearance: none; height: 3px;\n  background: var(--border); border-radius: 2px; outline: none; cursor: pointer;\n}\n.als-range::-webkit-slider-thumb {\n  appearance: none; width: 14px; height: 14px; border-radius: 50%;\n  background: var(--green); cursor: pointer; box-shadow: 0 0 5px rgba(34,197,94,0.5);\n}\n\n/* ── Toasts ───────────────────────────────────────────────── */\n.als-toasts {\n  position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);\n  display: flex; flex-direction: column; gap: 5px;\n  width: calc(100% - 20px); z-index: 10; pointer-events: none;\n}\n.als-toast {\n  background: var(--bg-card-alt); border: 1px solid var(--border-light);\n  color: var(--text-1); padding: 7px 14px;\n  border-radius: 20px; font-size: 11px; font-weight: 600;\n  box-shadow: 0 4px 16px rgba(0,0,0,0.5);\n  animation: als-toastIn 0.25s ease;\n  text-align: center; pointer-events: none;\n}\n.als-toast.success { border-color: rgba(34,197,94,0.4); }\n.als-toast.warn    { border-color: rgba(239,68,68,0.4); }\n.als-toast.error   { border-color: rgba(239,68,68,0.6); background: rgba(239,68,68,0.1); }\n.als-toast.info    { border-color: rgba(20,184,166,0.4); }\n@keyframes als-toastIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform:none; } }\n@keyframes als-toastOut { to { opacity:0; transform: translateY(6px); } }\n\n/* ── Footer ───────────────────────────────────────────────── */\n.als-footer { text-align: center; color: var(--text-3); font-size: 9px; padding: 8px 0 2px; }\n\n/* ── Utilities ────────────────────────────────────────────── */\n.mt4  { margin-top: 4px; }\n.mt6  { margin-top: 6px; }\n.mt8  { margin-top: 8px; }\n.mb4  { margin-bottom: 4px; }\n.flex-row { display: flex; gap: 6px; align-items: center; }\n.flex-between { display: flex; justify-content: space-between; align-items: center; gap: 6px; }\n.text-green { color: var(--green); }\n.text-red   { color: var(--red); }\n.text-teal  { color: var(--teal); }\n.text-muted { color: var(--text-3); font-size: 10px; }\n.bold       { font-weight: 700; }\n.w-full     { width: 100%; }\n";
const MODULE$1 = "FloatingPanel";
class FloatingPanel {
  host;
  shadow;
  panel;
  productCtrl = new ProductController();
  automationCtrl = new AutomationController();
  audioMgr = new AudioManager();
  licenseMgr = new LicenseManager();
  drag = { dragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 };
  activeTab = "painel";
  timerInterval = null;
  editingReplyId = null;
  // ── Montagem ──────────────────────────────────────────────
  async mount() {
    Logger.info(MODULE$1, "Montando painel...");
    this.host = document.createElement("div");
    this.host.id = PANEL_ROOT_ID;
    this.host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;";
    document.body.appendChild(this.host);
    this.shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = panelCss;
    this.shadow.appendChild(style);
    const panelState = await StorageManager.getPanelState();
    this.panel = document.createElement("div");
    this.panel.className = "als-panel";
    this.panel.style.setProperty("--als-x", `${panelState.x ?? DEFAULTS.PANEL_X}px`);
    this.panel.style.setProperty("--als-y", `${panelState.y ?? DEFAULTS.PANEL_Y}px`);
    this.panel.style.setProperty("--als-w", `${panelState.width ?? DEFAULTS.PANEL_WIDTH}px`);
    this.panel.style.setProperty("--als-h", `${panelState.height ?? DEFAULTS.PANEL_HEIGHT}px`);
    if (panelState.minimized) this.panel.classList.add("minimized");
    this.panel.innerHTML = this._buildHTML();
    this.shadow.appendChild(this.panel);
    this._bindEvents();
    this._bindDrag();
    this._subscribeToState();
    this._hydrateSettings();
    this._startTimer();
    Logger.info(MODULE$1, "✅ Painel montado");
  }
  unmount() {
    this._stopTimer();
    this.host.remove();
    EventBus.removeAll();
  }
  // ── HTML do painel ───────────────────────────────────────
  _buildHTML() {
    return `
      <!-- HEADER -->
      <div class="als-header" id="als-drag-handle">
        <div class="als-header-left">
          <div class="als-logo">▶</div>
          <div class="als-brand">
            <span class="als-brand-name">AUTO LIVE SHOP</span>
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
      </div>

      <!-- TABS -->
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

      <!-- CONTENT -->
      <div class="als-content">

        <!-- ─── ABA PAINEL ─── -->
        <div class="als-pane active" id="als-pane-painel">

          <!-- Status da live -->
          <div class="als-card als-status-card">
            <div class="als-gmv-hero">
              <div class="als-gmv-label">FATURAMENTO DA LIVE</div>
              <div class="als-gmv-value" id="als-gmv-value">R$ 0,00</div>
              <div class="als-gmv-sub" id="als-gmv-sub">Aguardando métricas do TikTok...</div>
            </div>
            <!-- Timer -->
            <div class="als-section-label mt8">TEMPO EM LIVE</div>
            <div class="flex-row mt4" style="justify-content:center;gap:2px;">
              <div style="text-align:center">
                <div style="font-size:26px;font-weight:900;color:#5eead4;font-variant-numeric:tabular-nums" id="als-timer-h">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">H</div>
              </div>
              <div style="font-size:22px;font-weight:900;color:#2a3f5c;margin-bottom:8px">:</div>
              <div style="text-align:center">
                <div style="font-size:26px;font-weight:900;color:#5eead4;font-variant-numeric:tabular-nums" id="als-timer-m">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">MIN</div>
              </div>
              <div style="font-size:22px;font-weight:900;color:#2a3f5c;margin-bottom:8px">:</div>
              <div style="text-align:center">
                <div style="font-size:26px;font-weight:900;color:#5eead4;font-variant-numeric:tabular-nums" id="als-timer-s">00</div>
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
              <div class="als-empty-state" style="padding:8px 0">
                <div>Sem meta definida</div>
                <button class="als-btn als-btn-teal als-btn-xs mt6" id="als-btn-set-goal">+ Definir meta</button>
              </div>
            </div>
          </div>

          <!-- Métricas -->
          <div class="als-section-label">MÉTRICAS</div>
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
              <div class="als-metric-value" id="als-metric-sph">0</div>
              <div class="als-metric-sub">por hora</div>
            </div>
            <div class="als-metric">
              <div class="als-metric-label">ASSISTINDO</div>
              <div class="als-metric-value" id="als-metric-viewers">—</div>
              <div class="als-metric-sub">ao vivo</div>
            </div>
          </div>

          <!-- Feed de vendas -->
          <div class="als-card">
            <div class="flex-between mb4">
              <div class="als-card-title">🛍 Vendas recentes</div>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-clear-sales">Limpar</button>
            </div>
            <div class="als-sales-feed" id="als-sales-feed">
              <div class="als-empty-state">
                <div class="als-empty-icon">🛒</div>
                <div>Aguardando vendas...</div>
                <div class="text-muted">As vendas aparecerão aqui</div>
              </div>
            </div>
          </div>

        </div>

        <!-- ─── ABA AUTOMAÇÃO ─── -->
        <div class="als-pane" id="als-pane-automacao">

          <!-- Fixação automática -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">📌 Fixação automática</div>
                <div class="als-card-desc">Mantém o produto fixado na live automaticamente.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-pin" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-auto-pin-form">
              <div class="als-form-group mt6">
                <label class="als-form-label">Produto</label>
                <div class="als-select-wrap">
                  <select class="als-select" id="als-pin-product-select">
                    <option value="">Selecionar produto...</option>
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

          <!-- Mensagens automáticas -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">💬 Mensagens automáticas</div>
                <div class="als-card-desc">Posta suas mensagens no chat de tempo em tempo.</div>
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
                    <input type="checkbox" id="als-toggle-msg-random" />
                    <span class="als-toggle-slider"></span>
                  </label>
                </div>
                <input type="range" class="als-range" id="als-msg-min-slider" min="10" max="600" value="60" step="5" />
                <input type="range" class="als-range mt4" id="als-msg-max-slider" min="10" max="600" value="180" step="5" />
              </div>
              <div class="als-input-row mt6">
                <input type="text" class="als-input" id="als-chat-msg-input" placeholder="Escreva uma mensagem…" maxlength="150" style="flex:1" />
                <button class="als-btn als-btn-teal als-btn-xs" id="als-btn-save-msg">+</button>
              </div>
              <div class="als-msg-list mt6" id="als-msg-list"></div>
            </div>
          </div>

          <!-- Respostas automáticas -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">🤖 Respostas automáticas</div>
                <div class="als-card-desc">Chat → responde sozinho por palavras-chave.</div>
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
                  <div class="als-toggle-row-desc">Inclui o @nome de quem perguntou</div>
                </div>
                <label class="als-toggle als-toggle-sm">
                  <input type="checkbox" id="als-toggle-reply-name" />
                  <span class="als-toggle-slider"></span>
                </label>
              </div>
              <button class="als-btn als-btn-teal als-btn-sm w-full mt6" id="als-btn-new-reply">+ Nova regra</button>
              <div id="als-reply-form-wrap" style="display:none" class="als-card-sub">
                <div class="als-form-group">
                  <label class="als-form-label">Gatilhos (palavras-chave)</label>
                  <input type="text" class="als-input" id="als-reply-triggers" placeholder="ex: cor, tamanho, preço" />
                  <div class="als-form-hint">Separe por vírgula</div>
                </div>
                <div class="als-form-group">
                  <label class="als-form-label">Resposta</label>
                  <textarea class="als-textarea" id="als-reply-text" placeholder="ex: Disponível em P, M e G"></textarea>
                </div>
                <div class="flex-row mt6" style="justify-content:flex-end">
                  <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-cancel-reply">Cancelar</button>
                  <button class="als-btn als-btn-green als-btn-xs" id="als-btn-save-reply">Salvar</button>
                </div>
              </div>
              <div class="als-msg-list mt6" id="als-reply-list"></div>
            </div>
          </div>

          <!-- Oferta relâmpago -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">⚡ Oferta relâmpago automática</div>
                <div class="als-card-desc">Recria a oferta relâmpago quando expira.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-flash-deal" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
          </div>

        </div>

        <!-- ─── ABA PRODUTOS ─── -->
        <div class="als-pane" id="als-pane-produtos">

          <div class="als-card">
            <div class="flex-between mb6">
              <div class="als-card-title">📦 Produtos da live</div>
              <button class="als-btn als-btn-teal als-btn-xs" id="als-btn-refresh-products">🔄 Atualizar</button>
            </div>
            <div id="als-product-list-wrap">
              <div class="als-empty-state">
                <div class="als-empty-icon">📦</div>
                <div>Nenhum produto carregado</div>
                <div class="text-muted">Clique em Atualizar</div>
              </div>
            </div>
          </div>

          <!-- Fixar produto manual -->
          <div class="als-card">
            <div class="als-card-title mb4">📌 Fixar produto</div>
            <div class="als-form-group">
              <div class="als-select-wrap">
                <select class="als-select" id="als-manual-pin-select">
                  <option value="">Selecionar produto...</option>
                </select>
              </div>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-green als-btn-sm" style="flex:1" id="als-btn-pin-now">📌 Fixar agora</button>
              <button class="als-btn als-btn-ghost als-btn-sm" id="als-btn-unpin">Desafixar</button>
            </div>
            <div class="text-muted mt4" id="als-pin-status"></div>
          </div>

          <!-- Produto fixado atual -->
          <div class="als-card" id="als-pinned-card" style="display:none">
            <div class="als-card-title mb4 text-green">✅ Produto fixado agora</div>
            <div id="als-pinned-info"></div>
          </div>

        </div>

        <!-- ─── ABA AJUSTES ─── -->
        <div class="als-pane" id="als-pane-ajustes">

          <!-- Licença -->
          <div class="als-card als-license-card">
            <div class="flex-between mb6">
              <div class="als-card-title">🔑 Licença</div>
              <span class="als-badge als-badge-free" id="als-license-badge">FREE</span>
            </div>
            <div class="als-input-eye-wrap">
              <input type="password" class="als-input" id="als-license-key" placeholder="XXXX-XXXX-XXXX-XXXX" />
              <button class="als-eye-btn" id="als-btn-eye">👁</button>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-green als-btn-sm" id="als-btn-activate-license">✓ Ativar</button>
              <a href="https://autolive.shop" class="als-link" target="_blank">Assinar Pro — R$49/mês</a>
            </div>
          </div>

          <!-- Som de venda -->
          <div class="als-card">
            <div class="als-toggle-row">
              <div>
                <div class="als-toggle-row-label">🔊 Som de venda</div>
                <div class="als-toggle-row-desc">Toca um som a cada nova venda detectada</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-sound" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible open" id="als-sound-form">
              <button class="als-btn als-btn-ghost als-btn-xs mt6" id="als-btn-unlock-audio">🔔 Ativar áudio</button>
              <button class="als-btn als-btn-ghost als-btn-xs mt4" id="als-btn-test-sound">▶ Testar som</button>
            </div>
          </div>

          <!-- Guardião anti-ban -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">🛡 Guardião anti-ban</div>
                <div class="als-card-desc">Protege a conta ao detectar violação.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-guardian" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-guardian-form">
              <div class="als-form-group mt6">
                <label class="als-form-label">Ação ao detectar violação</label>
                <div class="als-select-wrap">
                  <select class="als-select" id="als-guardian-action">
                    <option value="alert">Apenas alertar</option>
                    <option value="pause">Pausar automações</option>
                    <option value="end">Encerrar a live</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Notificações -->
          <div class="als-card">
            <div class="als-card-title mb6">🔔 Notificações Chrome</div>
            <div class="als-checkbox-list">
              <label class="als-checkbox-item">
                <input type="checkbox" class="als-notif-cb" id="als-notif-sales" checked />
                <span class="als-checkbox-custom"></span>
                <span>Nova venda detectada</span>
              </label>
              <label class="als-checkbox-item">
                <input type="checkbox" class="als-notif-cb" id="als-notif-pin" checked />
                <span class="als-checkbox-custom"></span>
                <span>Produto fixado</span>
              </label>
              <label class="als-checkbox-item">
                <input type="checkbox" class="als-notif-cb" id="als-notif-guardian" checked />
                <span class="als-checkbox-custom"></span>
                <span>Alertas do guardião</span>
              </label>
            </div>
          </div>

          <!-- Posição do painel -->
          <div class="als-card">
            <div class="als-card-title mb6">📐 Painel</div>
            <div class="flex-row">
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-reset-pos">Restaurar posição</button>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-reset-size">Restaurar tamanho</button>
            </div>
          </div>

          <div class="als-footer">Auto Live Shop v2.0.0 · Copiloto de Lives</div>

        </div>

      </div>

      <!-- TOASTS -->
      <div class="als-toasts" id="als-toasts"></div>
    `;
  }
  // ── Bind de eventos ──────────────────────────────────────
  _bindEvents() {
    const $ = (id) => this.shadow.getElementById(id);
    $("als-btn-minimize")?.addEventListener("click", () => this._toggleMinimize());
    $("als-btn-close")?.addEventListener("click", () => this._close());
    this.shadow.querySelectorAll(".als-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset["tab"];
        this._switchTab(tab);
      });
    });
    $("als-btn-start-live")?.addEventListener("click", () => {
      if (!StateManager.live.startedAt) {
        StateManager.setLiveStatus("LIVE_ACTIVE");
        this._startTimer();
      }
    });
    $("als-btn-stop-live")?.addEventListener("click", () => {
      StateManager.setLiveStatus("LIVE_ENDED");
      this._stopTimer();
    });
    $("als-btn-clear-sales")?.addEventListener("click", () => {
      const feed = $("als-sales-feed");
      feed.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">🛒</div><div>Aguardando vendas...</div></div>`;
    });
    $("als-btn-set-goal")?.addEventListener("click", () => this._showGoalEditor());
    $("als-btn-edit-goal")?.addEventListener("click", () => this._showGoalEditor());
    $("als-toggle-auto-pin")?.addEventListener("change", async (e) => {
      const on = e.target.checked;
      this._toggleCollapsible("als-auto-pin-form", on);
      await StorageManager.saveSettings({ repinInterval: parseInt($("als-repin-interval")?.value || "30") });
      if (on) {
        const productId = $("als-pin-product-select")?.value;
        const interval = parseInt($("als-repin-interval")?.value || "30");
        if (productId) this.automationCtrl.start(productId, interval);
        else this._showToast("⚠ Selecione um produto primeiro", "warn");
      } else {
        this.automationCtrl.stop();
      }
    });
    $("als-toggle-auto-msg")?.addEventListener("change", async (e) => {
      const on = e.target.checked;
      this._toggleCollapsible("als-auto-msg-form", on);
      await StorageManager.saveSettings({
        /* autoMsgEnabled */
      });
    });
    $("als-msg-min-slider")?.addEventListener("input", () => this._updateMsgIntervalLabel());
    $("als-msg-max-slider")?.addEventListener("input", () => this._updateMsgIntervalLabel());
    $("als-btn-save-msg")?.addEventListener("click", () => this._saveChatMessage());
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
    $("als-btn-save-reply")?.addEventListener("click", () => this._saveReply());
    $("als-btn-refresh-products")?.addEventListener("click", () => this._refreshProducts());
    $("als-btn-pin-now")?.addEventListener("click", async () => {
      const select = $("als-manual-pin-select");
      if (!select.value) {
        this._showToast("⚠ Selecione um produto", "warn");
        return;
      }
      $("als-pin-status").textContent = "Fixando...";
      const result = await this.productCtrl.pinProduct(select.value);
      $("als-pin-status").textContent = result.success ? "✅ Produto fixado com sucesso" : `⚠ ${result.error || "Erro ao fixar"}`;
    });
    $("als-btn-unpin")?.addEventListener("click", async () => {
      const result = await this.productCtrl.unpinProduct();
      $("als-pin-status").textContent = result.success ? "Produto desafixado" : `⚠ ${result.error}`;
    });
    $("als-toggle-sound")?.addEventListener("change", async (e) => {
      const on = e.target.checked;
      this.audioMgr.setEnabled(on);
      await StorageManager.saveSettings({ soundEnabled: on });
    });
    $("als-btn-unlock-audio")?.addEventListener("click", async () => {
      await this.audioMgr.unlock();
      this._showToast("🔊 Áudio ativado!", "success");
    });
    $("als-btn-test-sound")?.addEventListener("click", () => this.audioMgr.playSaleSound());
    $("als-toggle-guardian")?.addEventListener("change", (e) => {
      this._toggleCollapsible("als-guardian-form", e.target.checked);
    });
    $("als-btn-activate-license")?.addEventListener("click", () => this._activateLicense());
    $("als-btn-eye")?.addEventListener("click", () => {
      const input = $("als-license-key");
      input.type = input.type === "password" ? "text" : "password";
    });
    $("als-btn-reset-pos")?.addEventListener("click", () => {
      this.panel.style.setProperty("--als-x", `${DEFAULTS.PANEL_X}px`);
      this.panel.style.setProperty("--als-y", `${DEFAULTS.PANEL_Y}px`);
      StorageManager.savePanelState({ x: DEFAULTS.PANEL_X, y: DEFAULTS.PANEL_Y });
    });
    $("als-btn-reset-size")?.addEventListener("click", () => {
      this.panel.style.setProperty("--als-w", `${DEFAULTS.PANEL_WIDTH}px`);
      this.panel.style.setProperty("--als-h", `${DEFAULTS.PANEL_HEIGHT}px`);
      StorageManager.savePanelState({ width: DEFAULTS.PANEL_WIDTH, height: DEFAULTS.PANEL_HEIGHT });
    });
    this.shadow.querySelectorAll(".als-notif-cb").forEach((cb) => {
      cb.addEventListener("change", () => this._saveNotificationSettings());
    });
  }
  // ── Drag ─────────────────────────────────────────────────
  _bindDrag() {
    const handle = this.shadow.getElementById("als-drag-handle");
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".als-icon-btn")) return;
      const rect = this.panel.getBoundingClientRect();
      this.drag = { dragging: true, startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };
      document.addEventListener("mousemove", this._onDragMove);
      document.addEventListener("mouseup", this._onDragEnd);
    });
  }
  _onDragMove = (e) => {
    if (!this.drag.dragging) return;
    const dx = e.clientX - this.drag.startX;
    const dy = e.clientY - this.drag.startY;
    const x = clamp(this.drag.startLeft + dx, 0, window.innerWidth - 100);
    const y = clamp(this.drag.startTop + dy, 0, window.innerHeight - 48);
    this.panel.style.setProperty("--als-x", `${x}px`);
    this.panel.style.setProperty("--als-y", `${y}px`);
  };
  _onDragEnd = () => {
    this.drag.dragging = false;
    document.removeEventListener("mousemove", this._onDragMove);
    document.removeEventListener("mouseup", this._onDragEnd);
    const x = parseFloat(this.panel.style.getPropertyValue("--als-x"));
    const y = parseFloat(this.panel.style.getPropertyValue("--als-y"));
    StorageManager.savePanelState({ x, y });
  };
  // ── Subscriptions ao estado ──────────────────────────────
  _subscribeToState() {
    EventBus.on("live:status_changed", (status) => this._updateStatusBadge(status));
    EventBus.on("metrics:updated", (metrics) => this._renderMetrics(metrics));
    EventBus.on("sale:detected", (sale) => this._addSaleToFeed(sale));
    EventBus.on("products:loaded", (products) => this._renderProductList(products));
    EventBus.on("products:pinned", ({ productId }) => this._updatePinnedDisplay(productId));
    EventBus.on("products:unpinned", () => {
      this.shadow.getElementById("als-pinned-card").style.display = "none";
    });
    EventBus.on("toast:show", ({ message, type }) => this._showToast(message, type));
    EventBus.on("automation:started", () => {
      this.shadow.getElementById("als-toggle-auto-pin").checked = true;
    });
    EventBus.on("automation:stopped", () => {
      this.shadow.getElementById("als-toggle-auto-pin").checked = false;
      this._toggleCollapsible("als-auto-pin-form", false);
    });
  }
  // ── Status badge ─────────────────────────────────────────
  _updateStatusBadge(status) {
    const badge = this.shadow.getElementById("als-status-badge");
    const text = this.shadow.getElementById("als-status-text");
    badge.className = "als-live-badge";
    const map = {
      LIVE_DETECTING: { cls: "detecting", label: "DETECTANDO" },
      LIVE_ACTIVE: { cls: "active", label: "AO VIVO" },
      LIVE_INACTIVE: { cls: "inactive", label: "AGUARDANDO" },
      LIVE_ENDED: { cls: "ended", label: "ENCERRADA" },
      LIVE_ERROR: { cls: "error", label: "ERRO" }
    };
    badge.classList.add(map[status].cls);
    text.textContent = map[status].label;
  }
  // ── Métricas ─────────────────────────────────────────────
  _renderMetrics(metrics) {
    const $ = (id) => this.shadow.getElementById(id);
    $("als-gmv-value").textContent = formatBRL(metrics.gmv);
    $("als-gmv-sub").textContent = metrics.source === "tiktok" ? `Atualizado: ${new Date(metrics.updatedAt).toLocaleTimeString("pt-BR")}` : "Calculado localmente";
    $("als-metric-sales").textContent = String(metrics.salesCount);
    $("als-metric-items").textContent = String(metrics.soldItems);
    $("als-metric-sph").textContent = metrics.salesPerHour.toFixed(1);
    if (metrics.viewers > 0) $("als-metric-viewers").textContent = String(metrics.viewers);
    const goal = StateManager.settings.gmvGoal;
    if (goal) this._updateGoalProgress(metrics.gmv, goal);
  }
  // ── Feed de vendas ────────────────────────────────────────
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
      <div class="als-sale-amount">${sale.amount ? formatBRL(sale.amount) : "—"}</div>
    `;
    feed.insertBefore(item, feed.firstChild);
    if (this.audioMgr.isEnabled()) this.audioMgr.playSaleSound();
  }
  // ── Produtos ──────────────────────────────────────────────
  _refreshProducts() {
    const result = this.productCtrl.refreshProducts();
    if (!result.success) {
      this._showToast("⚠ " + result.error, "warn");
    }
  }
  _renderProductList(products) {
    const wrap = this.shadow.getElementById("als-product-list-wrap");
    const manualSelect = this.shadow.getElementById("als-manual-pin-select");
    const autoPinSelect = this.shadow.getElementById("als-pin-product-select");
    if (!products.length) {
      wrap.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">📦</div><div>Nenhum produto encontrado</div><div class="text-muted">Verifique se a live está ativa</div></div>`;
      return;
    }
    const list = document.createElement("div");
    list.className = "als-product-list";
    products.forEach((p) => {
      const item = document.createElement("div");
      item.className = "als-product-item" + (p.isPinned ? " pinned" : "");
      item.innerHTML = `
        ${p.isPinned ? '<span class="als-product-pin-badge">📌</span>' : ""}
        <div class="als-product-info">
          <div class="als-product-name">${escHtml(p.name)}</div>
          <div class="als-product-price">${p.price ? formatBRL(p.price) : "—"}</div>
        </div>
        <div class="als-product-actions">
          <button class="als-btn als-btn-xs ${p.isPinned ? "als-btn-ghost" : "als-btn-green"}" data-pin-id="${p.id}">
            ${p.isPinned ? "Fixado" : "Fixar"}
          </button>
        </div>
      `;
      item.querySelector(`[data-pin-id]`)?.addEventListener("click", async () => {
        if (p.isPinned) {
          await this.productCtrl.unpinProduct();
        } else {
          await this.productCtrl.pinProduct(p.id);
        }
      });
      list.appendChild(item);
    });
    wrap.innerHTML = "";
    wrap.appendChild(list);
    const opts = `<option value="">Selecionar...</option>` + products.map((p) => `<option value="${p.id}">${escHtml(p.name)}</option>`).join("");
    manualSelect.innerHTML = opts;
    autoPinSelect.innerHTML = opts;
  }
  _updatePinnedDisplay(productId) {
    const card = this.shadow.getElementById("als-pinned-card");
    const info = this.shadow.getElementById("als-pinned-info");
    const product = StateManager.live.products.find((p) => p.id === productId);
    if (product) {
      card.style.display = "block";
      info.innerHTML = `
        <div class="als-product-name">${escHtml(product.name)}</div>
        ${product.price ? `<div class="als-product-price">${formatBRL(product.price)}</div>` : ""}
      `;
    }
  }
  // ── Timer ─────────────────────────────────────────────────
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
      const $ = (id) => this.shadow.getElementById(id);
      const hEl = $("als-timer-h");
      if (hEl) hEl.textContent = pad(h);
      const mEl = $("als-timer-m");
      if (mEl) mEl.textContent = pad(m);
      const sEl = $("als-timer-s");
      if (sEl) sEl.textContent = pad(sec);
    }, 1e3);
  }
  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  // ── Mensagens / Respostas ─────────────────────────────────
  async _saveChatMessage() {
    const input = this.shadow.getElementById("als-chat-msg-input");
    const text = input.value.trim();
    if (!text) {
      this._showToast("⚠ Escreva uma mensagem", "warn");
      return;
    }
    const settings = await StorageManager.getSettings();
    const messages = settings.chatMessages || [];
    messages.push({ id: Date.now(), text, active: true });
    await StorageManager.saveSettings({ chatMessages: messages });
    input.value = "";
    this._renderMsgList(messages);
    this._showToast("✓ Mensagem salva", "success");
  }
  _renderMsgList(messages) {
    const list = this.shadow.getElementById("als-msg-list");
    list.innerHTML = "";
    if (!messages.length) {
      list.innerHTML = '<div class="text-muted" style="text-align:center;padding:8px 0">Nenhuma mensagem</div>';
      return;
    }
    messages.forEach((msg) => {
      const item = document.createElement("div");
      item.className = "als-msg-item" + (msg.active ? " active-item" : "");
      item.innerHTML = `
        <span class="als-msg-text">${escHtml(msg.text)}</span>
        <div class="als-msg-actions">
          <label class="als-toggle als-toggle-sm"><input type="checkbox" ${msg.active ? "checked" : ""} /><span class="als-toggle-slider"></span></label>
          <button class="als-icon-btn-xs danger" data-del-id="${msg.id}">🗑</button>
        </div>
      `;
      item.querySelector(`[data-del-id]`)?.addEventListener("click", async () => {
        const s = await StorageManager.getSettings();
        const msgs = (s.chatMessages || []).filter((m) => m.id !== msg.id);
        await StorageManager.saveSettings({ chatMessages: msgs });
        this._renderMsgList(msgs);
      });
      list.appendChild(item);
    });
  }
  async _saveReply() {
    const triggers = this.shadow.getElementById("als-reply-triggers").value.split(",").map((t) => t.trim()).filter(Boolean);
    const text = this.shadow.getElementById("als-reply-text").value.trim();
    if (!triggers.length || !text) {
      this._showToast("⚠ Preencha gatilhos e resposta", "warn");
      return;
    }
    const settings = await StorageManager.getSettings();
    let replies = settings.autoResponses || [];
    if (this.editingReplyId) {
      replies = replies.map((r) => r.id === this.editingReplyId ? { ...r, triggers, text } : r);
    } else {
      replies.push({ id: Date.now(), triggers, text, scope: "all", active: true });
    }
    await StorageManager.saveSettings({ autoResponses: replies });
    this.shadow.getElementById("als-reply-form-wrap").style.display = "none";
    this.editingReplyId = null;
    this._renderReplyList(replies);
    this._showToast("✓ Regra salva", "success");
  }
  _renderReplyList(replies) {
    const list = this.shadow.getElementById("als-reply-list");
    list.innerHTML = "";
    if (!replies.length) {
      list.innerHTML = '<div class="text-muted" style="text-align:center;padding:8px 0">Nenhuma regra</div>';
      return;
    }
    replies.forEach((r) => {
      const item = document.createElement("div");
      item.className = "als-msg-item" + (r.active ? " active-item" : "");
      item.innerHTML = `
        <div style="flex:1;min-width:0">
          <div class="als-tags">${r.triggers.map((t) => `<span class="als-tag">${escHtml(t)}</span>`).join("")}</div>
          <div class="als-msg-text mt4">"${escHtml(r.text)}"</div>
        </div>
        <div class="als-msg-actions">
          <label class="als-toggle als-toggle-sm"><input type="checkbox" ${r.active ? "checked" : ""} /><span class="als-toggle-slider"></span></label>
          <button class="als-icon-btn-xs danger" data-del-reply="${r.id}">🗑</button>
        </div>
      `;
      item.querySelector(`[data-del-reply]`)?.addEventListener("click", async () => {
        const s = await StorageManager.getSettings();
        const rs = (s.autoResponses || []).filter((x) => x.id !== r.id);
        await StorageManager.saveSettings({ autoResponses: rs });
        this._renderReplyList(rs);
      });
      list.appendChild(item);
    });
  }
  // ── Meta de GMV ───────────────────────────────────────────
  async _showGoalEditor() {
    const goal = window.prompt("Digite a meta de GMV (R$):", String(StateManager.settings.gmvGoal || ""));
    if (goal === null) return;
    const value = parseFloat(goal.replace(",", "."));
    if (isNaN(value) || value <= 0) {
      this._showToast("⚠ Meta inválida", "warn");
      return;
    }
    StateManager.patchSettings({ gmvGoal: value });
    await StorageManager.saveSettings({ gmvGoal: value });
    this._updateGoalProgress(StateManager.live.metrics.gmv, value);
    this._showToast(`🎯 Meta: ${formatBRL(value)}`, "success");
  }
  _updateGoalProgress(current, goal) {
    const pct = Math.min(100, Math.round(current / goal * 100));
    const remaining = Math.max(0, goal - current);
    const content = this.shadow.getElementById("als-goal-content");
    content.innerHTML = `
      <div class="als-progress-wrap">
        <div class="als-progress-labels">
          <span class="text-green bold">${formatBRL(current)}</span>
          <span class="text-muted">${formatBRL(goal)}</span>
        </div>
        <div class="als-progress-track">
          <div class="als-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="flex-between mt4">
          <span class="text-muted">${pct}% atingido</span>
          <span class="text-muted">Faltam ${formatBRL(remaining)}</span>
        </div>
      </div>
    `;
    if (pct >= 100) {
      this._showToast("🏆 Meta de GMV atingida!", "success");
    }
  }
  // ── License ───────────────────────────────────────────────
  async _activateLicense() {
    const key = this.shadow.getElementById("als-license-key").value.trim();
    if (!key) {
      this._showToast("⚠ Digite a chave", "warn");
      return;
    }
    const result = await this.licenseMgr.validate(key);
    const badge = this.shadow.getElementById("als-license-badge");
    badge.className = `als-badge als-badge-${result.status.toLowerCase()}`;
    badge.textContent = result.status;
    await StorageManager.saveSettings({ licenseKey: key, licenseStatus: result.status });
    this._showToast(result.valid ? `✓ Licença ${result.status} ativada` : "⚠ Chave inválida (modo FREE)", result.valid ? "success" : "warn");
  }
  // ── Hydrate ───────────────────────────────────────────────
  async _hydrateSettings() {
    const settings = await StorageManager.getSettings();
    if (settings.chatMessages) this._renderMsgList(settings.chatMessages);
    if (settings.autoResponses) this._renderReplyList(settings.autoResponses);
    if (settings.soundEnabled) {
      this.shadow.getElementById("als-toggle-sound").checked = true;
      this.audioMgr.setEnabled(true);
    }
    if (settings.guardianEnabled) {
      this.shadow.getElementById("als-toggle-guardian").checked = true;
      this._toggleCollapsible("als-guardian-form", true);
    }
    if (settings.licenseKey) {
      this.shadow.getElementById("als-license-key").value = settings.licenseKey;
    }
    if (settings.licenseStatus) {
      const badge = this.shadow.getElementById("als-license-badge");
      badge.className = `als-badge als-badge-${settings.licenseStatus.toLowerCase()}`;
      badge.textContent = settings.licenseStatus;
    }
    if (settings.gmvGoal) {
      StateManager.patchSettings({ gmvGoal: settings.gmvGoal });
    }
  }
  // ── Helpers ───────────────────────────────────────────────
  _switchTab(tab) {
    this.activeTab = tab;
    this.shadow.querySelectorAll(".als-tab-btn").forEach((b) => b.classList.remove("active"));
    this.shadow.querySelectorAll(".als-pane").forEach((p) => p.classList.remove("active"));
    this.shadow.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");
    this.shadow.getElementById(`als-pane-${tab}`)?.classList.add("active");
    EventBus.emit("panel:tab_changed", tab);
  }
  _toggleMinimize() {
    const minimized = this.panel.classList.toggle("minimized");
    const btn = this.shadow.getElementById("als-btn-minimize");
    btn.textContent = minimized ? "+" : "−";
    StorageManager.savePanelState({ minimized });
  }
  _close() {
    this.panel.classList.add("hidden");
    StorageManager.savePanelState({ visible: false });
  }
  _toggleCollapsible(id, open) {
    const el = this.shadow.getElementById(id);
    el?.classList.toggle("open", open);
  }
  _updateMsgIntervalLabel() {
    const min = this.shadow.getElementById("als-msg-min-slider")?.value;
    const max = this.shadow.getElementById("als-msg-max-slider")?.value;
    const label = this.shadow.getElementById("als-msg-interval-label");
    if (label) label.textContent = `${min}s – ${max}s`;
  }
  _saveNotificationSettings() {
    StorageManager.saveSettings({});
  }
  // ── Toast system ──────────────────────────────────────────
  _showToast(message, type = "success") {
    const container = this.shadow.getElementById("als-toasts");
    const toast = document.createElement("div");
    toast.className = `als-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "als-toastOut 0.25s ease forwards";
      setTimeout(() => toast.remove(), 280);
    }, DEFAULTS.TOAST_DURATION_MS);
    while (container.children.length > DEFAULTS.MAX_TOASTS) {
      container.firstChild?.remove();
    }
  }
}
const MODULE = "Bootstrap";
if (window.__AUTO_LIVE_SHOP_INITIALIZED__) {
  Logger.warn(MODULE, "Já inicializado — ignorando");
} else {
  window.__AUTO_LIVE_SHOP_INITIALIZED__ = true;
  init();
}
async function init() {
  Logger.info(MODULE, "🚀 Auto Live Shop V2 inicializando...");
  Logger.info(MODULE, "URL:", window.location.href);
  const [panelState, settings] = await Promise.all([
    StorageManager.getPanelState(),
    StorageManager.getSettings()
  ]);
  StateManager.hydrate({ panel: panelState, settings });
  await StorageManager.setInitialized();
  setupMessageBus();
  if (!isTikTokLivePage()) {
    Logger.info(MODULE, "Não é página de live — monitorando navegação...");
    watchForLivePage();
    return;
  }
  await startLiveSession();
}
let panel = null;
let liveDetector = null;
let salesDetector = null;
let heartbeat = null;
async function startLiveSession() {
  Logger.info(MODULE, "🔴 Iniciando sessão de live...");
  if (document.readyState !== "complete") {
    await new Promise((r) => window.addEventListener("load", r, { once: true }));
  }
  await sleep(1500);
  if (document.getElementById(PANEL_ROOT_ID)) {
    Logger.warn(MODULE, "Painel já existe no DOM — ignorando");
    return;
  }
  panel = new FloatingPanel();
  await panel.mount();
  liveDetector = new LiveDetector();
  liveDetector.start();
  salesDetector = new SalesDetector();
  salesDetector.start();
  heartbeat = new LiveHeartbeatService(10);
  heartbeat.start();
  EventBus.on("live:ended", () => {
    Logger.info(MODULE, "Live encerrada — parando serviços");
    heartbeat?.stop();
    salesDetector?.stop();
  });
  Logger.info(MODULE, "✅ Sessão de live ativa");
}
function watchForLivePage() {
  let lastUrl = window.location.href;
  const interval = setInterval(async () => {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;
    Logger.info(MODULE, "SPA navigation:", currentUrl);
    if (isTikTokLivePage(currentUrl) && !document.getElementById(PANEL_ROOT_ID)) {
      clearInterval(interval);
      await startLiveSession();
    }
  }, 1e3);
}
function setupMessageBus() {
  MessageBus.listen();
  MessageBus.on("ALS_PING", () => ({
    ok: true,
    url: window.location.href,
    isLivePage: isTikTokLivePage(),
    liveStatus: StateManager.live.status
  }));
  MessageBus.on("ALS_GET_STATE", () => ({
    live: StateManager.live,
    panel: StateManager.panel
  }));
  MessageBus.on("ALS_HEARTBEAT", () => {
    StateManager.heartbeat();
    return { ok: true };
  });
}
