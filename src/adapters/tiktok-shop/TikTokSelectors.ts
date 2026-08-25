// ============================================================
// Copilo Live Shop V2 — TikTok Selectors
// Centralização de todos os seletores DOM do TikTok Shop
// com suporte a múltiplos seletores de fallback
// ============================================================

export const TikTokSelectors = {
  // ── Página / Detecção de live ───────────────────────────────
  live: {
    /** Indicador de que a live está ativa (badge "AO VIVO") */
    liveIndicator: [
      '[class*="live-status"]',
      '[class*="living-badge"]',
      '[class*="streaming-badge"]',
      '[data-testid="live-badge"]',
      '.live-indicator',
      '[aria-label*="LIVE"]',
      '[aria-label*="Ao vivo"]',
    ],

    /** Container principal do streamer */
    streamerContainer: [
      '[class*="streamer-container"]',
      '[class*="live-studio"]',
      '#live-studio-root',
      '.streamer-main',
      '[class*="live-room-container"]',
    ],

    /** Botão de encerrar live */
    endLiveButton: [
      '[class*="end-live"]',
      '[data-testid="end-live-btn"]',
      'button[class*="end"]',
      'button[aria-label*="End"]',
      'button[aria-label*="Encerrar"]',
    ],

    /** Timer/cronômetro da live */
    liveTimer: [
      '[class*="live-timer"]',
      '[class*="stream-duration"]',
      '[data-testid="live-timer"]',
      '[class*="duration-text"]',
    ],

    /** ID da transmissão */
    roomInfo: [
      '[data-room-id]',
      '[class*="room-info"]',
      'meta[name="live-room-id"]',
    ],
  },

  // ── Produtos ────────────────────────────────────────────────
  products: {
    /** Container da lista de produtos */
    list: [
      '[class*="product-list"]',
      '[class*="product-showcase"]',
      '[data-testid="product-list"]',
      '[class*="goods-list"]',
    ],

    /** Item individual de produto */
    item: [
      '[class*="product-item"]',
      '[class*="product-card"]',
      '[data-testid="product-item"]',
      '[class*="goods-item"]',
    ],

    /** Nome do produto */
    name: [
      '[class*="product-name"]',
      '[class*="product-title"]',
      '[data-testid="product-name"]',
      '[class*="goods-title"]',
    ],

    /** Preço do produto */
    price: [
      '[class*="product-price"]',
      '[class*="price-text"]',
      '[data-testid="product-price"]',
      '[class*="goods-price"]',
    ],

    /** Botão "Fixar" produto */
    pinButton: [
      '[class*="pin-btn"]',
      '[class*="pin-product"]',
      '[data-testid="pin-btn"]',
      'button[class*="pin"]',
      'button[aria-label*="Pin"]',
      'button[aria-label*="Fixar"]',
    ],

    /** Botão "Desafixar" produto */
    unpinButton: [
      '[class*="unpin-btn"]',
      '[class*="unpin-product"]',
      '[data-testid="unpin-btn"]',
      'button[class*="unpin"]',
      'button[aria-label*="Unpin"]',
      'button[aria-label*="Desafixar"]',
    ],

    /** Produto atualmente fixado */
    pinnedProduct: [
      '[class*="pinned-product"]',
      '[class*="product-pinned"]',
      '[data-testid="pinned-product"]',
      '[class*="is-pinned"]',
    ],

    /** Botão de atualizar lista de produtos */
    refreshButton: [
      '[class*="refresh-products"]',
      '[data-testid="refresh-goods"]',
      'button[aria-label*="Refresh"]',
    ],
  },

  // ── Botões de Ação Gerais ────────────────────────────────────
  buttons: {
    pin: [
      '[class*="pin-btn"]',
      '[class*="pin-product"]',
      '[data-testid="pin-btn"]',
      'button[class*="pin"]',
    ],
    unpin: [
      '[class*="unpin-btn"]',
      '[class*="unpin-product"]',
      '[data-testid="unpin-btn"]',
      'button[class*="unpin"]',
    ],
    refresh: [
      '[class*="refresh-btn"]',
      '[class*="refresh-products"]',
      'button[class*="refresh"]',
    ],
    endLive: [
      '[class*="end-live"]',
      '[data-testid="end-live-btn"]',
      'button[class*="end"]',
    ],
  },

  // ── Chat ─────────────────────────────────────────────────────
  chat: {
    /** Container das mensagens */
    container: [
      '[class*="chat-container"]',
      '[class*="comment-list"]',
      '[data-testid="chat-list"]',
      '[class*="message-list"]',
    ],

    /** Item de mensagem */
    message: [
      '[class*="chat-message"]',
      '[class*="comment-item"]',
      '[data-testid="chat-message"]',
      '[class*="message-item"]',
    ],

    /** Autor da mensagem */
    author: [
      '[class*="chat-author"]',
      '[class*="comment-user"]',
      '[class*="username"]',
      '[class*="nickname"]',
    ],

    /** Texto da mensagem */
    text: [
      '[class*="chat-text"]',
      '[class*="comment-text"]',
      '[class*="message-content"]',
      '[class*="content-text"]',
    ],

    /** Input de novo comentário */
    input: [
      'input[class*="chat-input"]',
      'input[placeholder*="coment"]',
      'input[placeholder*="message"]',
      'input[placeholder*="chat"]',
      '[class*="chat-input"] input',
      '[contenteditable="true"][class*="chat"]',
    ],

    /** Botão enviar comentário */
    sendButton: [
      '[class*="send-btn"]',
      '[class*="chat-send"]',
      'button[class*="send"]',
      '[data-testid="send-btn"]',
    ],
  },

  // ── Métricas ─────────────────────────────────────────────────
  metrics: {
    /** GMV total da live */
    gmv: [
      '[class*="gmv-value"]',
      '[class*="revenue-value"]',
      '[data-testid="gmv"]',
      '[class*="total-sales"]',
    ],

    /** Número de pedidos */
    orders: [
      '[class*="order-count"]',
      '[class*="orders-value"]',
      '[data-testid="orders"]',
      '[class*="total-orders"]',
    ],

    /** Espectadores simultâneos */
    viewers: [
      '[class*="viewer-count"]',
      '[class*="online-count"]',
      '[data-testid="viewers"]',
      '[class*="watch-count"]',
    ],

    /** Itens vendidos */
    soldItems: [
      '[class*="sold-count"]',
      '[class*="items-sold"]',
      '[data-testid="sold-items"]',
    ],
  },

  // ── Vendas / Notificações de venda ───────────────────────────
  sales: {
    /** Notificação de nova venda */
    notification: [
      '[class*="sale-notification"]',
      '[class*="order-notification"]',
      '[class*="purchase-notification"]',
      '[class*="sold-tip"]',
    ],

    /** Container de vendas recentes */
    container: [
      '[class*="recent-sales"]',
      '[class*="order-list"]',
    ],
  },
};
