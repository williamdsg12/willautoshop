// ============================================================
// Auto Live Shop V2 — Recorded Lives Provider
// Provedor para descoberta e extração de lives anteriores do TikTok Shop
// ============================================================

import type { RecordedLive, ActionResult } from '@/shared/types';
import { queryAllWithFallbacks, queryWithFallbacks } from '@/shared/utils';
import { Logger } from '@/core/Logger';

const MODULE = 'RecordedLivesProvider';

export class RecordedLivesProvider {
  /**
   * Varre o DOM em busca de cards ou listas de lives gravadas/anteriores.
   */
  async fetchRecordedLives(): Promise<ActionResult<RecordedLive[]>> {
    Logger.info(MODULE, 'Buscando histórico de transmissões e lives gravadas...');

    try {
      const records = this._scanDomRecordedLives();

      if (records.length > 0) {
        Logger.info(MODULE, `✅ ${records.length} lives gravadas localizadas`);
        return { success: true, data: records, source: 'DOM' };
      }

      Logger.info(MODULE, 'Nenhuma live gravada visível no painel atual');
      return {
        success: true,
        data: [],
        error: 'Nenhuma transmissão gravada localizada nesta página.',
        source: 'UNKNOWN',
      };
    } catch (err) {
      Logger.error(MODULE, 'Erro ao obter lives gravadas:', err);
      return { success: false, error: String(err), data: [], source: 'UNKNOWN' };
    }
  }

  /**
   * Extração de dados a partir de listas de histórico de live.
   */
  private _scanDomRecordedLives(): RecordedLive[] {
    const selectors = [
      '[class*="live-record-item"]',
      '[class*="live-history-item"]',
      '[class*="stream-history-row"]',
      '[data-testid="live-record-card"]',
      '.live-record-card',
    ];

    const nodes = queryAllWithFallbacks(selectors);
    const lives: RecordedLive[] = [];

    nodes.forEach((node, index) => {
      const el = node as HTMLElement;
      const titleEl = queryWithFallbacks(['[class*="title"]', 'h3', 'h4'], el);
      const dateEl = queryWithFallbacks(['[class*="date"]', '[class*="time"]'], el);
      const gmvEl = queryWithFallbacks(['[class*="gmv"]', '[class*="revenue"]', '[class*="amount"]'], el);
      const ordersEl = queryWithFallbacks(['[class*="order"]', '[class*="sales"]'], el);
      const imgEl = el.querySelector('img') as HTMLImageElement | null;

      const rawGmv = gmvEl?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0';
      const gmv = parseFloat(rawGmv) || undefined;

      const rawOrders = ordersEl?.textContent?.replace(/[^0-9]/g, '') || '0';
      const orders = parseInt(rawOrders, 10) || undefined;

      lives.push({
        id: el.dataset['id'] || `live-rec-${index + 1}`,
        title: titleEl?.textContent?.trim() || `Transmissão ${index + 1}`,
        coverUrl: imgEl?.src || undefined,
        startedAt: Date.now() - (index + 1) * 86400000,
        gmv,
        ordersCount: orders,
        status: 'recorded',
        source: 'DOM',
      });
    });

    return lives;
  }
}

export const recordedLivesProvider = new RecordedLivesProvider();
