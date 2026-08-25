// ============================================================
// Copilo Live Shop V2 — Live Remote Agent (ISOLATED WORLD)
// Agente intermediário que envia comandos para o MAIN WORLD
// ============================================================

import { PlatformBridge, BRIDGE_EVENTS } from '@/bridge/PlatformBridge';
import { Logger } from '@/core/Logger';
import type { ActionResult, LiveProduct } from '@/shared/types';

const MODULE = 'LiveRemoteAgent (ISOLATED)';

export class LiveRemoteAgent {
  private bridge = new PlatformBridge(false);

  constructor() {
    Logger.info(MODULE, 'Agente do Isolated World inicializado');
  }

  /**
   * Envia comando de fixar produto para o MAIN WORLD.
   */
  async pinProduct(productId: string): Promise<ActionResult> {
    try {
      return await this.bridge.request<{ productId: string }, ActionResult>(
        BRIDGE_EVENTS.COMMAND,
        'PIN_PRODUCT',
        { productId },
        4000,
      );
    } catch (err) {
      Logger.warn(MODULE, 'Ponte falhou ao fixar produto, usando fallback:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Envia comando de desafixar produto para o MAIN WORLD.
   */
  async unpinProduct(): Promise<ActionResult> {
    try {
      return await this.bridge.request<Record<string, never>, ActionResult>(
        BRIDGE_EVENTS.COMMAND,
        'UNPIN_PRODUCT',
        {},
        3000,
      );
    } catch (err) {
      Logger.warn(MODULE, 'Ponte falhou ao desafixar produto:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Solicita atualização de produtos diretamente ao MAIN WORLD.
   */
  async refreshProducts(): Promise<ActionResult<LiveProduct[]>> {
    try {
      return await this.bridge.request<Record<string, never>, ActionResult<LiveProduct[]>>(
        BRIDGE_EVENTS.COMMAND,
        'REFRESH_PRODUCTS',
        {},
        4000,
      );
    } catch (err) {
      Logger.warn(MODULE, 'Ponte falhou ao recarregar produtos:', err);
      return { success: false, error: String(err), data: [] };
    }
  }

  /**
   * Envia mensagem no chat através do MAIN WORLD.
   */
  async sendChatMessage(text: string): Promise<ActionResult> {
    try {
      return await this.bridge.request<{ text: string }, ActionResult>(
        BRIDGE_EVENTS.COMMAND,
        'SEND_CHAT',
        { text },
        3000,
      );
    } catch (err) {
      Logger.warn(MODULE, 'Ponte falhou ao enviar chat:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Ping de heartbeat para o MAIN WORLD.
   */
  async pingHeartbeat(): Promise<{ isLiveActive: boolean; timestamp: number } | null> {
    try {
      return await this.bridge.request<Record<string, never>, { isLiveActive: boolean; timestamp: number }>(
        BRIDGE_EVENTS.HEARTBEAT,
        '',
        {},
        2000,
      );
    } catch {
      return null;
    }
  }
}

export const liveRemoteAgent = new LiveRemoteAgent();
