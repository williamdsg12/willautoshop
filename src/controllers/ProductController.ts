// ============================================================
// Auto Live Shop V2 — Product Controller
// ============================================================
import type { ActionResult, LiveProduct } from '@/shared/types';
import { tiktokAdapter } from '@/adapters/tiktok-shop/TikTokShopAdapter';
import { StateManager } from '@/core/StateManager';
import { EventBus } from '@/core/EventBus';
import { Logger } from '@/core/Logger';

const MODULE = 'ProductController';

export class ProductController {

  /** Busca e atualiza lista de produtos */
  refreshProducts(): ActionResult<LiveProduct[]> {
    try {
      const products = tiktokAdapter.getProducts();
      StateManager.setProducts(products);
      Logger.info(MODULE, `${products.length} produtos carregados`);
      return { success: true, data: products };
    } catch (err) {
      Logger.error(MODULE, 'Erro ao buscar produtos:', err);
      return { success: false, error: String(err) };
    }
  }

  /** Fixa um produto */
  async pinProduct(productId: string): Promise<ActionResult> {
    const result = await tiktokAdapter.pinProduct(productId);
    if (result.success) {
      StateManager.setPinnedProduct(productId);
      EventBus.emit('products:pinned', { productId });
      EventBus.emit('toast:show', { message: '📌 Produto fixado', type: 'success' });
    } else {
      EventBus.emit('products:pin_failed', { error: result.error ?? 'Erro desconhecido' });
      EventBus.emit('toast:show', {
        message: `⚠ ${result.error || 'TikTok não confirmou a fixação'}`,
        type: 'warn',
      });
    }
    return result;
  }

  /** Desafixa o produto */
  async unpinProduct(): Promise<ActionResult> {
    const result = await tiktokAdapter.unpinProduct();
    if (result.success) {
      StateManager.setPinnedProduct(undefined);
      EventBus.emit('products:unpinned');
      EventBus.emit('toast:show', { message: 'Produto desafixado', type: 'info' });
    } else {
      EventBus.emit('toast:show', { message: `⚠ ${result.error}`, type: 'warn' });
    }
    return result;
  }
}

// ============================================================
// Auto Live Shop V2 — Automation Controller
// ============================================================
import { ALARMS } from '@/shared/constants';

const AUTO_MODULE = 'AutomationController';

export class AutomationController {
  private repinTimer: ReturnType<typeof setInterval> | null = null;
  private productController = new ProductController();

  start(productId: string, intervalSecs: number): void {
    this.stop();
    Logger.info(AUTO_MODULE, `Automação iniciada — produto: ${productId}, intervalo: ${intervalSecs}s`);
    StateManager.patchLive({
      automationEnabled: true,
      automationProductId: productId,
      automationIntervalSecs: intervalSecs,
    });

    EventBus.emit('automation:started', { productId, intervalSecs });
    EventBus.emit('toast:show', { message: '▶ Automação de fixação iniciada', type: 'success' });

    this.repinTimer = setInterval(async () => {
      if (StateManager.live.status !== 'LIVE_ACTIVE') {
        this.stop();
        return;
      }
      Logger.debug(AUTO_MODULE, 'Refixando produto:', productId);
      EventBus.emit('automation:repin', { productId });
      await this.productController.pinProduct(productId);
    }, intervalSecs * 1000);
  }

  stop(): void {
    if (this.repinTimer) {
      clearInterval(this.repinTimer);
      this.repinTimer = null;
    }
    StateManager.patchLive({ automationEnabled: false });
    EventBus.emit('automation:stopped');
  }

  isRunning(): boolean {
    return this.repinTimer !== null;
  }
}
