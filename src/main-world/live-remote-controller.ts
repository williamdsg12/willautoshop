// ============================================================
// Copilo Live Shop V2 — Live Remote Controller (MAIN WORLD)
// Executa no contexto JavaScript nativo do TikTok Shop LIVE
// Interage com o DOM e componentes React nativos
// ============================================================

import { PlatformBridge, BRIDGE_EVENTS } from '@/bridge/PlatformBridge';
import { TikTokSelectors } from '@/adapters/tiktok-shop/TikTokSelectors';
import { queryWithFallbacks, queryAllWithFallbacks, sleep } from '@/shared/utils';
import type { LiveProduct, ActionResult } from '@/shared/types';

const MODULE = 'LiveRemoteController (MAIN)';
const bridge = new PlatformBridge(true);

console.log(`[Copilo Live Shop][${MODULE}] 🚀 Controlador do Main World inicializado.`);

// ─────────────────────────────────────────────────────────────
// Handlers de Comandos Remotos (LIVE_REMOTE_COMMAND)
// ─────────────────────────────────────────────────────────────

bridge.on(BRIDGE_EVENTS.COMMAND, 'PIN_PRODUCT', async (env): Promise<ActionResult> => {
  const { productId } = (env.payload || {}) as { productId: string };
  console.log(`[Copilo Live Shop][${MODULE}] Comando PIN_PRODUCT recebido para:`, productId);

  const items = queryAllWithFallbacks(TikTokSelectors.products.item);
  let targetItem: HTMLElement | null = null;

  for (const item of items) {
    const el = item as HTMLElement;
    const id = el.dataset['productId'] || el.dataset['id'] || el.dataset['goodsId'];
    if (id === productId) {
      targetItem = el;
      break;
    }
  }

  if (!targetItem) {
    const indexMatch = productId.match(/prod-(\d+)/);
    if (indexMatch && indexMatch[1]) {
      const idx = parseInt(indexMatch[1], 10) - 1;
      if (items[idx]) targetItem = items[idx] as HTMLElement;
    }
  }

  if (!targetItem) {
    return { success: false, error: 'Produto não encontrado no DOM nativo' };
  }

  const pinBtn = queryWithFallbacks(TikTokSelectors.products.pinButton, targetItem) as HTMLButtonElement | null;
  if (!pinBtn) {
    return { success: false, error: 'Botão de fixar não localizado' };
  }

  // Dispara eventos nativos do navegador
  pinBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  pinBtn.click();
  await sleep(600);

  return { success: true };
});

bridge.on(BRIDGE_EVENTS.COMMAND, 'UNPIN_PRODUCT', async (): Promise<ActionResult> => {
  console.log(`[Copilo Live Shop][${MODULE}] Comando UNPIN_PRODUCT recebido`);
  let unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton) as HTMLButtonElement | null;

  if (!unpinBtn) {
    const pinnedContainer = queryWithFallbacks(TikTokSelectors.products.pinnedProduct);
    if (pinnedContainer) {
      unpinBtn = queryWithFallbacks(TikTokSelectors.products.unpinButton, pinnedContainer) as HTMLButtonElement | null;
    }
  }

  if (!unpinBtn) {
    return { success: false, error: 'Botão de desafixar não localizado' };
  }

  unpinBtn.click();
  await sleep(500);
  return { success: true };
});

bridge.on(BRIDGE_EVENTS.COMMAND, 'REFRESH_PRODUCTS', async (): Promise<ActionResult<LiveProduct[]>> => {
  const refreshBtn = queryWithFallbacks(TikTokSelectors.products.refreshButton) as HTMLButtonElement | null;
  if (refreshBtn) {
    refreshBtn.click();
    await sleep(600);
  }

  const items = queryAllWithFallbacks(TikTokSelectors.products.item);
  const products: LiveProduct[] = items.map((item, index) => {
    const nameEl = queryWithFallbacks(TikTokSelectors.products.name, item);
    const priceEl = queryWithFallbacks(TikTokSelectors.products.price, item);
    const isPinned = !!queryWithFallbacks(TikTokSelectors.products.pinnedProduct, item);
    const htmlEl = item as HTMLElement;
    const rawId = htmlEl.dataset['productId'] || htmlEl.dataset['id'] || htmlEl.dataset['goodsId'] || `prod-${index + 1}`;

    const rawPrice = priceEl?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0';
    const price = parseFloat(rawPrice) || 0;

    return {
      id: rawId,
      name: nameEl?.textContent?.trim() || `Produto ${index + 1}`,
      price: price > 0 ? price : undefined,
      position: index + 1,
      isPinned,
    };
  });

  return { success: true, data: products };
});

bridge.on(BRIDGE_EVENTS.COMMAND, 'SEND_CHAT', async (env): Promise<ActionResult> => {
  const { text } = (env.payload || {}) as { text: string };
  if (!text) return { success: false, error: 'Texto não informado' };

  const input = queryWithFallbacks(TikTokSelectors.chat.input) as HTMLInputElement | HTMLElement | null;
  if (!input) return { success: false, error: 'Input de chat não encontrado' };

  if (input instanceof HTMLInputElement) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, text);
    } else {
      input.value = text;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    input.textContent = text;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  }

  await sleep(150);

  const sendBtn = queryWithFallbacks(TikTokSelectors.chat.sendButton) as HTMLButtonElement | null;
  if (sendBtn) {
    sendBtn.click();
    return { success: true };
  }

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
  return { success: true };
});

// ─────────────────────────────────────────────────────────────
// Heartbeat & Sincronização de Estado Nativo
// ─────────────────────────────────────────────────────────────

bridge.on(BRIDGE_EVENTS.HEARTBEAT, () => {
  const badge = queryWithFallbacks(TikTokSelectors.live.liveIndicator);
  const isLive = badge && badge.textContent && /live|ao vivo|gravando/i.test(badge.textContent);

  return {
    isLiveActive: !!isLive,
    url: window.location.href,
    timestamp: Date.now(),
  };
});
