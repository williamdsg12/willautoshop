// ============================================================
// Auto Live Shop V2 — TikTok Shop Adapter (façade)
// Ponto único de acesso a todas as operações do TikTok Shop
// ============================================================
import type { ActionResult, LiveProduct, LiveMetrics } from '@/shared/types';
import { TikTokLiveAdapter } from './TikTokLiveAdapter';
import { TikTokProductAdapter } from './TikTokProductAdapter';
import { Logger } from '@/core/Logger';

const MODULE = 'TikTokShopAdapter';

export interface ITikTokShopAdapter {
  isLiveActive(): boolean;
  getProducts(): LiveProduct[];
  getPinnedProduct(): LiveProduct | null;
  pinProduct(productId: string): Promise<ActionResult>;
  unpinProduct(): Promise<ActionResult>;
  getLiveMetrics(): Partial<LiveMetrics>;
  sendChatMessage(text: string): Promise<ActionResult>;
  endLive(): Promise<ActionResult>;
}

export class TikTokShopAdapter implements ITikTokShopAdapter {
  private live = new TikTokLiveAdapter();
  private products = new TikTokProductAdapter();

  isLiveActive(): boolean {
    return this.live.isLiveActive();
  }

  getProducts(): LiveProduct[] {
    return this.products.getProducts();
  }

  getPinnedProduct(): LiveProduct | null {
    return this.products.getPinnedProduct();
  }

  async pinProduct(productId: string): Promise<ActionResult> {
    Logger.info(MODULE, 'pinProduct:', productId);
    return this.products.pinProduct(productId);
  }

  async unpinProduct(): Promise<ActionResult> {
    Logger.info(MODULE, 'unpinProduct');
    return this.products.unpinProduct();
  }

  getLiveMetrics(): Partial<LiveMetrics> {
    return this.live.getLiveMetrics();
  }

  async sendChatMessage(text: string): Promise<ActionResult> {
    try {
      // Localizar input do chat
      const selectors = [
        'input[class*="chat-input"]',
        'input[placeholder*="coment"]',
        'input[placeholder*="message"]',
        '[contenteditable="true"]',
      ];
      let input: HTMLInputElement | HTMLElement | null = null;
      for (const sel of selectors) {
        input = document.querySelector(sel);
        if (input) break;
      }

      if (!input) {
        return { success: false, error: 'Input do chat não encontrado' };
      }

      // Injetar texto
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;

      if (nativeInputValueSetter && input instanceof HTMLInputElement) {
        nativeInputValueSetter.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        (input as HTMLElement).textContent = text;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
      }

      await new Promise(r => setTimeout(r, 200));

      // Clicar em enviar
      const sendSelectors = [
        '[class*="send-btn"]',
        'button[class*="send"]',
        '[data-testid="send-btn"]',
      ];
      let sendBtn: HTMLButtonElement | null = null;
      for (const sel of sendSelectors) {
        sendBtn = document.querySelector(sel);
        if (sendBtn) break;
      }

      if (sendBtn) {
        sendBtn.click();
        Logger.info(MODULE, 'Mensagem enviada:', text.substring(0, 30));
        return { success: true };
      }

      // Tentar Enter como fallback
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async endLive(): Promise<ActionResult> {
    return this.live.endLive();
  }
}

// Singleton
export const tiktokAdapter = new TikTokShopAdapter();
