// ============================================================
// Auto Live Shop V2 — TikTok Selectors
// Todos os seletores do DOM do TikTok Shop centralizados.
// ATENÇÃO: O TikTok altera o DOM com frequência.
// Atualizar APENAS este arquivo quando os seletores mudarem.
// Última verificação: 2026-08
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
    ],

    /** Container principal do streamer */
    streamerContainer: [
      '[class*="streamer-container"]',
      '[class*="live-studio"]',
      '#live-studio-root',
      '.streamer-main',
    ],

    /** Botão de encerrar live */
    endLiveButton: [
      '[class*="end-live"]',
      '[data-testid="end-live-btn"]',
      'button[class*="end"]',
    ],

    /** Timer/cronômetro da live */
    liveTimer: [
      '[class*="live-timer"]',
      '[class*="stream-duration"]',
      '[data-testid="live-timer"]',
    ],
  },

  // ── Produtos ────────────────────────────────────────────────
  products: {
    /** Container da lista de produtos */
    list: [
      '[class*="product-list"]',
      '[class*="product-showcase"]',
      '[data-testid="product-list"]',
    ],

    /** Item individual de produto */
    item: [
      '[class*="product-item"]',
      '[class*="product-card"]',
      '[data-testid="product-item"]',
    ],

    /** Nome do produto */
    name: [
      '[class*="product-name"]',
      '[class*="product-title"]',
      '[data-testid="product-name"]',
    ],

    /** Preço do produto */
    price: [
      '[class*="product-price"]',
      '[class*="price-text"]',
      '[data-testid="product-price"]',
    ],

    /** Botão "Fixar" produto */
    pinButton: [
      '[class*="pin-btn"]',
      '[class*="pin-product"]',
      '[data-testid="pin-btn"]',
      'button[class*="pin"]',
    ],

    /** Botão "Desafixar" produto */
    unpinButton: [
      '[class*="unpin-btn"]',
      '[class*="unpin-product"]',
      '[data-testid="unpin-btn"]',
      'button[class*="unpin"]',
    ],

    /** Produto atualmente fixado */
    pinnedProduct: [
      '[class*="pinned-product"]',
      '[class*="product-pinned"]',
      '[data-testid="pinned-product"]',
    ],
  },

  // ── Chat ─────────────────────────────────────────────────────
  chat: {
    /** Container das mensagens */
    container: [
      '[class*="chat-container"]',
      '[class*="comment-list"]',
      '[data-testid="chat-list"]',
    ],

    /** Item de mensagem */
    message: [
      '[class*="chat-message"]',
      '[class*="comment-item"]',
      '[data-testid="chat-message"]',
    ],

    /** Autor da mensagem */
    author: [
      '[class*="chat-author"]',
      '[class*="comment-user"]',
      '[class*="username"]',
    ],

    /** Texto da mensagem */
    text: [
      '[class*="chat-text"]',
      '[class*="comment-text"]',
      '[class*="message-content"]',
    ],

    /** Input de novo comentário */
    input: [
      'input[class*="chat-input"]',
      'input[placeholder*="coment"]',
      'input[placeholder*="message"]',
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
    ],

    /** Número de pedidos */
    orders: [
      '[class*="order-count"]',
      '[class*="orders-value"]',
      '[data-testid="orders"]',
    ],

    /** Espectadores simultâneos */
    viewers: [
      '[class*="viewer-count"]',
      '[class*="online-count"]',
      '[data-testid="viewers"]',
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
    ],

    /** Container de vendas recentes */
    container: [
      '[class*="recent-sales"]',
      '[class*="order-list"]',
    ],
  },
};
