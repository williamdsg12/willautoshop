(function() {
  "use strict";
  const APP_NAME = "Copilo Live Shop";
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
  const MODULE$1 = "PlatformBridge";
  const BRIDGE_EVENTS = {
    COMMAND: "LIVE_REMOTE_COMMAND",
    HEARTBEAT: "LIVE_REMOTE_HEARTBEAT",
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
            Logger.error(MODULE$1, `Erro ao processar mensagem da ponte [${envelope.type}]:`, err);
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
      ]
    },
    // ── Produtos ────────────────────────────────────────────────
    products: {
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
    // ── Chat ─────────────────────────────────────────────────────
    chat: {
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
    }
  };
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
  const MODULE = "LiveRemoteController (MAIN)";
  const bridge = new PlatformBridge(true);
  console.log(`[Copilo Live Shop][${MODULE}] 🚀 Controlador do Main World inicializado.`);
  bridge.on(BRIDGE_EVENTS.COMMAND, "PIN_PRODUCT", async (env) => {
    const { productId } = env.payload || {};
    console.log(`[Copilo Live Shop][${MODULE}] Comando PIN_PRODUCT recebido para:`, productId);
    const items = queryAllWithFallbacks(TikTokSelectors.products.item);
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
        if (items[idx]) targetItem = items[idx];
      }
    }
    if (!targetItem) {
      return { success: false, error: "Produto não encontrado no DOM nativo" };
    }
    const pinBtn = queryWithFallbacks(TikTokSelectors.products.pinButton, targetItem);
    if (!pinBtn) {
      return { success: false, error: "Botão de fixar não localizado" };
    }
    pinBtn.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    pinBtn.click();
    await sleep(600);
    return { success: true };
  });
  bridge.on(BRIDGE_EVENTS.COMMAND, "UNPIN_PRODUCT", async () => {
    console.log(`[Copilo Live Shop][${MODULE}] Comando UNPIN_PRODUCT recebido`);
    let unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton);
    if (!unpinBtn) {
      const pinnedContainer = queryWithFallbacks(TikTokSelectors.products.pinnedProduct);
      if (pinnedContainer) {
        unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton, pinnedContainer);
      }
    }
    if (!unpinBtn) {
      return { success: false, error: "Botão de desafixar não localizado" };
    }
    unpinBtn.click();
    await sleep(500);
    return { success: true };
  });
  bridge.on(BRIDGE_EVENTS.COMMAND, "REFRESH_PRODUCTS", async () => {
    const refreshBtn = queryWithFallbacks(TikTokSelectors.products.refreshButton);
    if (refreshBtn) {
      refreshBtn.click();
      await sleep(600);
    }
    const items = queryAllWithFallbacks(TikTokSelectors.products.item);
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
    return { success: true, data: products };
  });
  bridge.on(BRIDGE_EVENTS.COMMAND, "SEND_CHAT", async (env) => {
    const { text } = env.payload || {};
    if (!text) return { success: false, error: "Texto não informado" };
    const input = queryWithFallbacks(TikTokSelectors.chat.input);
    if (!input) return { success: false, error: "Input de chat não encontrado" };
    if (input instanceof HTMLInputElement) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, text);
      } else {
        input.value = text;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      input.textContent = text;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
    }
    await sleep(150);
    const sendBtn = queryWithFallbacks(TikTokSelectors.chat.sendButton);
    if (sendBtn) {
      sendBtn.click();
      return { success: true };
    }
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
    return { success: true };
  });
  bridge.on(BRIDGE_EVENTS.HEARTBEAT, () => {
    const badge = queryWithFallbacks(TikTokSelectors.live.liveIndicator);
    const isLive = badge && badge.textContent && /live|ao vivo|gravando/i.test(badge.textContent);
    return {
      isLiveActive: !!isLive,
      url: window.location.href,
      timestamp: Date.now()
    };
  });
})();
