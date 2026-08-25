// ============================================================
// Copilo Live Shop V2 — MessageBus
// Camada central de comunicação entre UI, Content Script e Background
// ============================================================

import type { BusMessage } from '@/shared/types';
import { Logger } from './Logger';

const MODULE = 'MessageBus';

export type MessageHandler<T = unknown, R = unknown> = (
  msg: BusMessage<T>,
  sender: chrome.runtime.MessageSender,
) => Promise<R> | R;

class MessageBusClass {
  private handlers = new Map<string, MessageHandler<any, any>>();
  private isListening = false;

  /**
   * Registra um handler para um tipo específico de mensagem.
   */
  on<T = unknown, R = unknown>(type: string, handler: MessageHandler<T, R>): () => void {
    this.handlers.set(type, handler);
    return () => {
      this.handlers.delete(type);
    };
  }

  /**
   * Envia uma mensagem para o background script ou receptor ativo.
   */
  async send<T = unknown, R = unknown>(type: string, payload?: T): Promise<R | null> {
    const msg: BusMessage<T> = {
      type,
      payload,
      timestamp: Date.now(),
    };

    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      Logger.warn(MODULE, `Ambiente Chrome não disponível para envio da mensagem "${type}"`);
      return null;
    }

    try {
      return (await chrome.runtime.sendMessage(msg)) as R;
    } catch (err) {
      Logger.warn(MODULE, `Erro ao enviar mensagem "${type}":`, err);
      return null;
    }
  }

  /**
   * Envia uma mensagem para uma aba específica.
   */
  async sendToTab<T = unknown, R = unknown>(tabId: number, type: string, payload?: T): Promise<R | null> {
    const msg: BusMessage<T> = {
      type,
      payload,
      tabId,
      timestamp: Date.now(),
    };

    if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
      return null;
    }

    try {
      return (await chrome.tabs.sendMessage(tabId, msg)) as R;
    } catch (err) {
      Logger.warn(MODULE, `Erro ao enviar para tab ${tabId} "${type}":`, err);
      return null;
    }
  }

  /**
   * Envia mensagem em broadcast para todas as abas abertas.
   */
  async broadcast<T = unknown>(type: string, payload?: T): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return;
    }

    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          this.sendToTab(tab.id, type, payload).catch(() => {});
        }
      }
    } catch (err) {
      Logger.error(MODULE, `Erro ao disparar broadcast de "${type}":`, err);
    }
  }

  /**
   * Helper para responder uma mensagem.
   */
  respond<T>(sendResponse: (response?: T) => void, data: T): void {
    try {
      sendResponse(data);
    } catch (err) {
      Logger.error(MODULE, 'Erro ao responder mensagem:', err);
    }
  }

  /**
   * Inicializa o listener de runtime do Chrome.
   */
  listen(): void {
    if (this.isListening) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      Logger.warn(MODULE, 'chrome.runtime.onMessage indisponível no ambiente atual.');
      return;
    }

    this.isListening = true;
    chrome.runtime.onMessage.addListener((msg: BusMessage, sender, sendResponse) => {
      if (!msg || !msg.type) return false;

      const handler = this.handlers.get(msg.type);
      if (!handler) return false;

      try {
        const result = handler(msg, sender);
        if (result instanceof Promise) {
          result
            .then(res => sendResponse(res))
            .catch(err => {
              Logger.error(MODULE, `Erro assíncrono no handler "${msg.type}":`, err);
              sendResponse({ error: String(err) });
            });
          return true; // Mantém o canal aberto para resposta assíncrona
        }
        sendResponse(result);
        return false;
      } catch (err) {
        Logger.error(MODULE, `Erro no handler síncrono "${msg.type}":`, err);
        sendResponse({ error: String(err) });
        return false;
      }
    });

    Logger.info(MODULE, 'Listener do MessageBus ativo');
  }
}

export const MessageBus = new MessageBusClass();
