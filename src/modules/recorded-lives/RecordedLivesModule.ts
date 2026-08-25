// ============================================================
// Auto Live Shop V2 — Recorded Lives Module
// Orquestrador de exibição, filtragem e detalhes de transmissões gravadas
// ============================================================

import type { RecordedLive } from '@/shared/types';
import { recordedLivesProvider } from '@/services/RecordedLivesProvider';
import { EventBus } from '@/core/EventBus';
import { Logger } from '@/core/Logger';

const MODULE = 'RecordedLivesModule';

export class RecordedLivesModule {
  private lives: RecordedLive[] = [];
  private selectedLive: RecordedLive | null = null;

  async loadRecordedLives(): Promise<RecordedLive[]> {
    Logger.info(MODULE, 'Carregando lista de lives gravadas...');
    const result = await recordedLivesProvider.fetchRecordedLives();

    this.lives = result.data || [];
    EventBus.emit('recorded_lives:loaded', this.lives);
    return this.lives;
  }

  getLives(): RecordedLive[] {
    return this.lives;
  }

  filterLives(query: string): RecordedLive[] {
    if (!query) return this.lives;
    const lower = query.toLowerCase();
    return this.lives.filter(live => live.title.toLowerCase().includes(lower));
  }

  selectLive(id: string): RecordedLive | null {
    this.selectedLive = this.lives.find(l => l.id === id) || null;
    return this.selectedLive;
  }

  getSelectedLive(): RecordedLive | null {
    return this.selectedLive;
  }
}

export const recordedLivesModule = new RecordedLivesModule();
