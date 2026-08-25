// ============================================================
// Copilo Live Shop V2 — Live Controller
// Gerencia comandos de início, término e consulta da LIVE
// ============================================================

import type { ActionResult, LiveState, LiveStatus } from '@/shared/types';
import { tiktokAdapter } from '@/adapters/tiktok-shop/TikTokShopAdapter';
import { StateManager } from '@/core/StateManager';
import { EventBus } from '@/core/EventBus';
import { Logger } from '@/core/Logger';

const MODULE = 'LiveController';

export class LiveController {
  /**
   * Inicia ou retoma o estado ativo da transmissão local.
   */
  startLive(): ActionResult<{ startedAt: number }> {
    const startedAt = Date.now();
    StateManager.setLiveStatus('LIVE_ACTIVE');
    StateManager.patchLive({ startedAt });

    EventBus.emit('live:started', { startedAt });
    EventBus.emit('toast:show', {
      message: '🔴 Transmissão iniciada no Copilo Live Shop',
      type: 'success',
    });

    Logger.info(MODULE, 'Live iniciada manualmente via controller');
    return {
      success: true,
      data: { startedAt },
    };
  }

  /**
   * Encerra a LIVE no TikTok Shop e no estado local.
   */
  async endLive(): Promise<ActionResult> {
    Logger.info(MODULE, 'Comando de encerramento da LIVE acionado');
    const result = await tiktokAdapter.endLive();

    StateManager.setLiveStatus('LIVE_ENDED');
    EventBus.emit('live:ended');
    EventBus.emit('toast:show', {
      message: '⬛ Transmissão encerrada',
      type: 'info',
    });

    return result;
  }

  /**
   * Obtém o estado atual completo da transmissão.
   */
  getLiveState(): LiveState {
    return StateManager.live;
  }

  /**
   * Consulta se a LIVE está ativa no momento.
   */
  isLiveActive(): boolean {
    return StateManager.live.status === 'LIVE_ACTIVE' || tiktokAdapter.isLiveActive();
  }
}
