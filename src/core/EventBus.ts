// ============================================================
// Copilo Live Shop V2 — EventBus
// Barramento central de eventos tipado e desacoplado
// ============================================================

import type { EventMap } from '@/shared/types';
import { Logger } from './Logger';

const MODULE = 'EventBus';

type EventCallback<T> = (payload: T) => void;

class EventBusClass {
  private listeners = new Map<keyof EventMap, Set<EventCallback<any>>>();
  private onceListeners = new Map<keyof EventMap, Set<EventCallback<any>>>();

  /**
   * Registra um listener para um evento.
   * Retorna uma função de cancelamento (unsubscribe).
   */
  on<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback as EventCallback<any>);

    return () => this.off(event, callback);
  }

  /**
   * Registra um listener que será executado apenas uma única vez.
   */
  once<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
  ): () => void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    const set = this.onceListeners.get(event)!;
    set.add(callback as EventCallback<any>);

    return () => {
      this.onceListeners.get(event)?.delete(callback as EventCallback<any>);
    };
  }

  /**
   * Remove um listener registrado.
   */
  off<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
  ): void {
    this.listeners.get(event)?.delete(callback as EventCallback<any>);
    this.onceListeners.get(event)?.delete(callback as EventCallback<any>);
  }

  /**
   * Emite um evento para todos os listeners cadastrados.
   */
  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [payload: EventMap[K]]
  ): void {
    const payload = args[0];

    // Listeners padrão
    const regular = this.listeners.get(event);
    if (regular) {
      regular.forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          Logger.error(MODULE, `Erro no listener do evento "${String(event)}":`, err);
        }
      });
    }

    // Listeners de execução única (once)
    const once = this.onceListeners.get(event);
    if (once && once.size > 0) {
      const callbacks = Array.from(once);
      this.onceListeners.delete(event);
      callbacks.forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          Logger.error(MODULE, `Erro no once listener do evento "${String(event)}":`, err);
        }
      });
    }
  }

  /**
   * Limpa listeners de um evento ou de todos os eventos.
   */
  clear(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Alias para limpar todos os eventos.
   */
  removeAll(event?: keyof EventMap): void {
    this.clear(event);
  }
}

export const EventBus = new EventBusClass();
