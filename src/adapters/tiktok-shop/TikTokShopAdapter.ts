// ============================================================
// Copilo Live Shop V2 — TikTok Shop Adapter (Fachada)
// Ponto unificado e seguro de interação com o TikTok Shop
// ============================================================

import type { ActionResult, LiveProduct, LiveMetrics } from '@/shared/types';
import { TikTokLiveAdapter } from './TikTokLiveAdapter';
import { TikTokProductAdapter } from './TikTokProductAdapter';
import { TikTokSelectors } from './TikTokSelectors';
import { queryWithFallbacks, sleep } from '@/shared/utils';
import { liveRemoteAgent } from '@/isolated/live-remote-agent';
import { Logger } from '@/core/Logger';

const MODULE = 'TikTokShopAdapter';

export interface ITikTokShopAdapter {
  live: TikTokLiveAdapter;
  products: TikTokProductAdapter;
  isLiveActive(): boolean;
  getLiveMetrics(): Partial<LiveMetrics>;
  getProducts(): LiveProduct[];
  getPinnedProduct(): LiveProduct | null;
  pinProduct(productId: string): Promise<ActionResult>;
  unpinProduct(): Promise<ActionResult>;
  refreshProducts(): Promise<ActionResult<LiveProduct[]>>;
  sendChatMessage(text: string): Promise<ActionResult>;
  endLive(): Promise<ActionResult>;
}

export class TikTokShopAdapter implements ITikTokShopAdapter {
  public live = new TikTokLiveAdapter();
  public products = new TikTokProductAdapter();

  isLiveActive(): boolean {
    return this.live.isLiveActive();
  }

  getLiveMetrics(): Partial<LiveMetrics> {
    return this.live.getLiveMetrics();
  }

  getProducts(): LiveProduct[] {
    return this.products.getProducts();
  }

  getPinnedProduct(): LiveProduct | null {
    return this.products.getPinnedProduct();
  }

  async pinProduct(productId: string): Promise<ActionResult> {
    Logger.info(MODULE, `pinProduct chamado para ID: ${productId}`);

    // 1. Tenta fixar através do MAIN WORLD Controller
    const remoteRes = await liveRemoteAgent.pinProduct(productId);
    if (remoteRes.success) {
      return remoteRes;
    }

    // 2. Fallback para execução direta no DOM isolado
    Logger.info(MODULE, 'Tentando fixação via fallback no DOM local...');
    return this.products.pinProduct(productId);
  }

  async unpinProduct(): Promise<ActionResult> {
    Logger.info(MODULE, 'unpinProduct chamado');

    // 1. Tenta desafixar via MAIN WORLD
    const remoteRes = await liveRemoteAgent.unpinProduct();
    if (remoteRes.success) {
      return remoteRes;
    }

    // 2. Fallback para DOM local
    return this.products.unpinProduct();
  }

  async refreshProducts(): Promise<ActionResult<LiveProduct[]>> {
    // 1. Tenta via MAIN WORLD
    const remoteRes = await liveRemoteAgent.refreshProducts();
    if (remoteRes.success && remoteRes.data && remoteRes.data.length > 0) {
      return remoteRes;
    }

    // 2. Fallback para leitura do DOM local
    return this.products.refreshProducts();
  }

  async sendChatMessage(text: string): Promise<ActionResult> {
    // 1. Tenta via MAIN WORLD
    const remoteRes = await liveRemoteAgent.sendChatMessage(text);
    if (remoteRes.success) {
      return remoteRes;
    }

    // 2. Fallback para DOM local
    try {
      const input = queryWithFallbacks(TikTokSelectors.chat.input) as HTMLInputElement | HTMLElement | null;

      if (!input) {
        return {
          success: false,
          error: 'Input de comentário do chat não encontrado no DOM',
        };
      }

      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;

      if (nativeSetter && input instanceof HTMLInputElement) {
        nativeSetter.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        input.textContent = text;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
      }

      await sleep(200);

      const sendBtn = queryWithFallbacks(TikTokSelectors.chat.sendButton) as HTMLButtonElement | null;
      if (sendBtn) {
        sendBtn.click();
        Logger.info(MODULE, `Mensagem enviada no chat: "${text.substring(0, 30)}..."`);
        return { success: true };
      }

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Falha ao enviar mensagem no chat: ${String(err)}`,
      };
    }
  }

  async endLive(): Promise<ActionResult> {
    return this.live.endLive();
  }
}

// Instância singleton
export const tiktokAdapter = new TikTokShopAdapter();
