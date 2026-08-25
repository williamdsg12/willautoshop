// ============================================================
// Copilo Live Shop V2 — Automation Module
// Orquestrador de mensagens automáticas, auto-pin e regras de chat
// ============================================================

import { AutomationController } from '@/controllers/AutomationController';
import { StorageManager } from '@/core/StorageManager';
import { StateManager } from '@/core/StateManager';
import { EventBus } from '@/core/EventBus';
import type { ChatMessage, AutoResponse } from '@/shared/types';

export class AutomationModule {
  private autoPinCtrl = new AutomationController();

  /**
   * Inicia a fixação automática de um produto.
   */
  startAutoPin(productId: string, intervalSecs: number): boolean {
    return this.autoPinCtrl.start(productId, intervalSecs);
  }

  /**
   * Encerra a fixação automática.
   */
  stopAutoPin(): void {
    this.autoPinCtrl.stop();
  }

  /**
   * Salva e sincroniza mensagem de chat automática.
   */
  async addChatMessage(text: string): Promise<ChatMessage[]> {
    const current = StateManager.settings.chatMessages || [];
    const newMessage: ChatMessage = {
      id: Date.now(),
      text,
      active: true,
    };
    const updated = [...current, newMessage];
    StateManager.patchSettings({ chatMessages: updated });
    await StorageManager.saveSettings({ chatMessages: updated });
    return updated;
  }

  /**
   * Remove mensagem de chat.
   */
  async removeChatMessage(id: number): Promise<ChatMessage[]> {
    const current = StateManager.settings.chatMessages || [];
    const updated = current.filter(m => m.id !== id);
    StateManager.patchSettings({ chatMessages: updated });
    await StorageManager.saveSettings({ chatMessages: updated });
    return updated;
  }

  /**
   * Salva regra de resposta automática.
   */
  async saveAutoResponse(response: AutoResponse): Promise<AutoResponse[]> {
    const current = StateManager.settings.autoResponses || [];
    const exists = current.some(r => r.id === response.id);
    const updated = exists
      ? current.map(r => (r.id === response.id ? response : r))
      : [...current, response];

    StateManager.patchSettings({ autoResponses: updated });
    await StorageManager.saveSettings({ autoResponses: updated });
    return updated;
  }

  /**
   * Remove regra de resposta automática.
   */
  async removeAutoResponse(id: number): Promise<AutoResponse[]> {
    const current = StateManager.settings.autoResponses || [];
    const updated = current.filter(r => r.id !== id);
    StateManager.patchSettings({ autoResponses: updated });
    await StorageManager.saveSettings({ autoResponses: updated });
    return updated;
  }
}
