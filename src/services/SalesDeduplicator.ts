// ============================================================
// Auto Live Shop V2 — Sales Deduplicator
// Prevenção robusta contra eventos de venda duplicados por MutationObserver
// ============================================================

import type { Sale } from '@/shared/types';
import { createUniqueHash } from '@/shared/utils';

export class SalesDeduplicator {
  private recentHashes: Map<string, number> = new Map();
  private ttlMs = 120000; // 2 minutos de proteção contra re-disparos

  /**
   * Gera um hash único e determinístico para a venda.
   */
  generateSaleHash(sale: Partial<Sale>): string {
    if (sale.orderId) {
      return `order_${sale.orderId}`;
    }

    const key = `${sale.productName || ''}_${sale.productId || ''}_${sale.amount || 0}_${Math.floor((sale.timestamp || Date.now()) / 15000)}`;
    return createUniqueHash(key);
  }

  /**
   * Verifica se a venda é inédita ou duplicada.
   */
  isDuplicate(sale: Partial<Sale>): boolean {
    this._cleanup();
    const hash = sale.hash || this.generateSaleHash(sale);

    if (this.recentHashes.has(hash)) {
      return true;
    }

    this.recentHashes.set(hash, Date.now());
    return false;
  }

  /**
   * Remove hashes expirados do cache em memória.
   */
  private _cleanup(): void {
    const now = Date.now();
    for (const [hash, timestamp] of this.recentHashes.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.recentHashes.delete(hash);
      }
    }
  }

  /**
   * Limpa todo o histórico de deduplicação.
   */
  clear(): void {
    this.recentHashes.clear();
  }
}

export const salesDeduplicator = new SalesDeduplicator();
