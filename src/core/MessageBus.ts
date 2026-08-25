// ============================================================
// Auto Live Shop V2 — MessageBus
// Comunicação tipada entre content script e background
// ============================================================
import type { BusMessage } from '@/shared/types';
import { Logger } from './Logger';

const MODULE = 'MessageBus';

export type MessageHandler = (msg: BusMessage, sender: chrome.runtime.MessageSender) => Promise<unknown> | unknown;

class MessageBusClass {
  private handlers = new Map<string, MessageHandler>();

  /** Registra handler para um tipo de mensagem */
  on(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /** Envia mensagem para o background */
  async send(type: string, payload?: unknown): Promise<unknown> {
    const msg: BusMessage = { type, payload, timestamp: Date.now() };
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (err) {
      Logger.warn(MODULE, `Erro ao enviar "${type}":`, err);
      return null;
    }
  }

  /** Envia mensagem para uma aba específica (do background) */
  async sendToTab(tabId: number, type: string, payload?: unknown): Promise<unknown> {
    const msg: BusMessage = { type, payload, tabId, timestamp: Date.now() };
    try {
      return await chrome.tabs.sendMessage(tabId, msg);
    } catch (err) {
      Logger.warn(MODULE, `Erro ao enviar para tab ${tabId} "${type}":`, err);
      return null;
    }
  }

  /** Inicializa o listener global (chamar uma vez) */
  listen(): void {
    chrome.runtime.onMessage.addListener((msg: BusMessage, sender, sendResponse) => {
      const handler = this.handlers.get(msg.type);
      if (!handler) return false;

      const result = handler(msg, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch(err => {
          Logger.error(MODULE, `Erro no handler "${msg.type}":`, err);
          sendResponse({ error: String(err) });
        });
        return true; // keep channel open
      }
      sendResponse(result);
      return false;
    });
  }
}

export const MessageBus = new MessageBusClass();
