// ============================================================
// Copilo Live Shop V2 — Goals Module
// Gerenciamento de metas de GMV, progresso e celebrações
// ============================================================

import { StateManager } from '@/core/StateManager';
import { StorageManager } from '@/core/StorageManager';
import { EventBus } from '@/core/EventBus';
import type { GmvGoal } from '@/shared/types';
import { formatCurrency } from '@/shared/utils';

export class GoalsModule {
  private hasCelebrated = false;

  /**
   * Define uma nova meta de GMV.
   */
  async setGoal(targetAmount: number): Promise<void> {
    if (targetAmount <= 0) return;
    this.hasCelebrated = false;

    StateManager.patchSettings({ gmvGoal: targetAmount });
    await StorageManager.saveSettings({ gmvGoal: targetAmount });

    EventBus.emit('toast:show', {
      message: `🎯 Meta definida: ${formatCurrency(targetAmount)}`,
      type: 'success',
    });
  }

  /**
   * Remove a meta atual.
   */
  async removeGoal(): Promise<void> {
    StateManager.patchSettings({ gmvGoal: null });
    await StorageManager.saveSettings({ gmvGoal: null });
    this.hasCelebrated = false;
  }

  /**
   * Obtém os dados e status da meta atual.
   */
  getGoalStatus(): {
    goal: number | null;
    currentGmv: number;
    percentage: number;
    remaining: number;
    isReached: boolean;
  } {
    const goal = StateManager.settings.gmvGoal;
    const currentGmv = StateManager.metrics.gmv;

    if (!goal || goal <= 0) {
      return {
        goal: null,
        currentGmv,
        percentage: 0,
        remaining: 0,
        isReached: false,
      };
    }

    const percentage = Math.min(100, Math.round((currentGmv / goal) * 100));
    const remaining = Math.max(0, goal - currentGmv);
    const isReached = currentGmv >= goal;

    if (isReached && !this.hasCelebrated) {
      this.hasCelebrated = true;
      EventBus.emit('toast:show', {
        message: '🏆 Parabéns! Meta de GMV atingida!',
        type: 'success',
      });
    }

    return {
      goal,
      currentGmv,
      percentage,
      remaining,
      isReached,
    };
  }
}
