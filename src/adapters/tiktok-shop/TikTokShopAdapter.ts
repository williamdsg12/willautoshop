// ============================================================
// Copilo Live Shop V2 — TikTok Shop Adapter (Fachada)
// Ponto unificado e seguro de interação com o TikTok Shop
// ============================================================

import type { ActionResult, LiveProduct, LiveMetrics } from '@/shared/types';
import { TikTokLiveAdapter } from './TikTokLiveAdapter';
import { TikTokProductAdapter } from './TikTokProductAdapter';
import { TikTokSelectors } from './TikTokSelectors';
import { queryWithFallbacks, sleep } from '@/shared/utils';
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
    return this.products.pinProduct(productId);
  }

  async unpinProduct(): Promise<ActionResult> {
    Logger.info(MODULE, 'unpinProduct chamado');
    return this.products.unpinProduct();
  }

  async refreshProducts(): Promise<ActionResult<LiveProduct[]>> {
    return this.products.refreshProducts();
  }

  async sendChatMessage(text: string): Promise<ActionResult> {
    try {
      const input = queryWithFallbacks(TikTokSelectors.chat.input) as HTMLInputElement | HTMLElement | null;

      if (!input) {
        return {
          success: false,
          error: 'Input de comentário do chat não encontrado no DOM',
        };
      }

      // Injeta o texto simulando digitação real e eventos sintéticos
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

      // Fallback para envio com tecla Enter
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
