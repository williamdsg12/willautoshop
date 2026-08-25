// ============================================================
// AutoLiveShop — Content Script (Fase 1: Stub)
// Fase 2: integração real com DOM do TikTok Shop Live Studio
// ============================================================

console.log('[AutoLiveShop] Content script carregado em:', window.location.href);

// ── Detectar se é uma página de live ─────────────────────────
const isLivePage = () => {
  const url = window.location.href;
  return (
    url.includes('/live') ||
    url.includes('/creator') ||
    url.includes('seller') ||
    url.includes('studio')
  );
};

// ── Estado local do content script ───────────────────────────
let chatObserver = null;
let lastChatMessages = [];

// ── API de funções (Fase 2: implementar com seletores reais) ──

/**
 * Lê as mensagens recentes do chat da live.
 * Fase 2: usar MutationObserver no container de chat do TikTok.
 */
function readChat() {
  // TODO Fase 2: selecionar o container de mensagens do chat
  // Ex: document.querySelectorAll('[data-testid="chat-message"]')
  console.log('[AutoLiveShop] readChat() chamado — integração Fase 2');
  return [];
}

/**
 * Envia uma mensagem no chat da live.
 * Fase 2: localizar o input do chat, injetar texto e disparar envio.
 */
function sendChatMessage(text) {
  // TODO Fase 2:
  // const input = document.querySelector('input[placeholder*="comentário"]');
  // if (input) { input.value = text; input.dispatchEvent(new Event('input', {bubbles:true})); }
  // const sendBtn = document.querySelector('[data-testid="send-btn"]');
  // if (sendBtn) sendBtn.click();
  console.log('[AutoLiveShop] sendChatMessage():', text, '— integração Fase 2');
  return false;
}

/**
 * Fixa um produto na vitrine da live.
 * Fase 2: clicar no botão "Fixar" do produto correto no painel.
 */
function pinProduct(productId) {
  // TODO Fase 2: interagir com os cards de produto do Live Studio
  console.log('[AutoLiveShop] pinProduct():', productId, '— integração Fase 2');
  return false;
}

/**
 * Lê métricas da live (GMV, vendas, espectadores).
 * Fase 2: parsear os elementos de métricas ou interceptar XHR/fetch.
 */
function readMetrics() {
  // TODO Fase 2: selecionar elementos de métricas ou interceptar API calls
  console.log('[AutoLiveShop] readMetrics() chamado — integração Fase 2');
  return { gmv: 0, sales: 0, avgTicket: 0, viewers: 0 };
}

/**
 * Inicia o observer do chat para detectar novas mensagens em tempo real.
 * Fase 2: usar MutationObserver no container de chat.
 */
function startChatObserver(onNewMessage) {
  if (chatObserver) chatObserver.disconnect();
  // TODO Fase 2: conectar MutationObserver ao chat container real
  console.log('[AutoLiveShop] startChatObserver() — integração Fase 2');
}

function stopChatObserver() {
  if (chatObserver) {
    chatObserver.disconnect();
    chatObserver = null;
  }
}

// ── Listener de mensagens do background/side panel ────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const { action } = msg;

  if (action === 'PING') {
    sendResponse({ ok: true, url: window.location.href, isLivePage: isLivePage() });
  }

  if (action === 'READ_CHAT') {
    sendResponse({ messages: readChat() });
  }

  if (action === 'SEND_CHAT_MESSAGE') {
    const success = sendChatMessage(msg.text);
    sendResponse({ ok: success });
  }

  if (action === 'REPIN_PRODUCT') {
    const success = pinProduct(msg.productId);
    sendResponse({ ok: success });
  }

  if (action === 'READ_METRICS') {
    sendResponse({ metrics: readMetrics() });
  }

  if (action === 'START_CHAT_OBSERVER') {
    startChatObserver((newMsg) => {
      chrome.runtime.sendMessage({ action: 'NEW_CHAT_MESSAGE', message: newMsg });
    });
    sendResponse({ ok: true });
  }

  if (action === 'STOP_CHAT_OBSERVER') {
    stopChatObserver();
    sendResponse({ ok: true });
  }

  return true;
});

// ── Auto-inicialização em páginas de live ─────────────────────
if (isLivePage()) {
  console.log('[AutoLiveShop] Página de live detectada — pronto para Fase 2');
  chrome.runtime.sendMessage({ action: 'LIVE_PAGE_DETECTED', url: window.location.href })
    .catch(() => {}); // side panel pode não estar aberto
}
