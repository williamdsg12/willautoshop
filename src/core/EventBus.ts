// ============================================================
// Auto Live Shop V2 — EventBus (pub/sub centralizado)
// ============================================================
import type { EventMap } from '@/shared/types';

type EventCallback<T> = (payload: T) => void;

class EventBusClass {
  private listeners = new Map<string, Set<EventCallback<unknown>>>();

  /** Subscreve a um evento */
  on<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const cb = callback as EventCallback<unknown>;
    this.listeners.get(event)!.add(cb);

    // Retorna função de cancelamento
    return () => this.off(event, callback);
  }

  /** Cancela subscrição */
  off<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
  ): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  /** Emite um evento */
  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [payload: EventMap[K]]
  ): void {
    const payload = args[0];
    this.listeners.get(event)?.forEach(cb => {
      try {
        cb(payload as unknown);
      } catch (err) {
        console.error(`[EventBus] Erro no handler de "${event}":`, err);
      }
    });
  }

  /** Remove todos os listeners de um evento */
  removeAll(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const EventBus = new EventBusClass();
