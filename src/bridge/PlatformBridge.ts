// ============================================================
// Copilo Live Shop V2 — Platform Bridge
// Barramento de comunicação bidirecional entre ISOLATED e MAIN WORLD
// ============================================================

import { Logger } from '@/core/Logger';

const MODULE = 'PlatformBridge';

export const BRIDGE_EVENTS = {
  COMMAND:   'LIVE_REMOTE_COMMAND',
  STATE:     'LIVE_REMOTE_STATE',
  HEARTBEAT: 'LIVE_REMOTE_HEARTBEAT',
  SYNC_AUTO: 'LIVE_REMOTE_SYNC_AUTO',
  RESPONSE:  'LIVE_REMOTE_RESPONSE',
} as const;

export type BridgeEventType = typeof BRIDGE_EVENTS[keyof typeof BRIDGE_EVENTS];

export interface BridgeEnvelope<T = unknown> {
  source: 'COPILO_ISOLATED' | 'COPILO_MAIN';
  type: BridgeEventType;
  action?: string;
  correlationId: string;
  payload?: T;
  timestamp: number;
}

export class PlatformBridge {
  private isMainWorld: boolean;
  private sourceTag: 'COPILO_ISOLATED' | 'COPILO_MAIN';
  private targetTag: 'COPILO_ISOLATED' | 'COPILO_MAIN';
  private handlers = new Map<string, (envelope: BridgeEnvelope) => Promise<unknown> | unknown>();
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: ReturnType<typeof setTimeout> }>();

  constructor(isMainWorld: boolean) {
    this.isMainWorld = isMainWorld;
    this.sourceTag = isMainWorld ? 'COPILO_MAIN' : 'COPILO_ISOLATED';
    this.targetTag = isMainWorld ? 'COPILO_ISOLATED' : 'COPILO_MAIN';

    this._initListener();
  }

  private _initListener(): void {
    window.addEventListener('message', async (event: MessageEvent) => {
      // Aceita apenas mensagens vindas da mesma janela
      if (event.source !== window || !event.data || typeof event.data !== 'object') {
        return;
      }

      const envelope = event.data as BridgeEnvelope;
      if (envelope.source !== this.targetTag) {
        return;
      }

      // Trata respostas a requisições pendentes
      if (envelope.type === BRIDGE_EVENTS.RESPONSE && this.pendingRequests.has(envelope.correlationId)) {
        const pending = this.pendingRequests.get(envelope.correlationId)!;
        clearTimeout(pending.timer);
        this.pendingRequests.delete(envelope.correlationId);
        pending.resolve(envelope.payload);
        return;
      }

      // Dispara handlers registrados
      const handlerKey = envelope.action ? `${envelope.type}:${envelope.action}` : envelope.type;
      const handler = this.handlers.get(handlerKey) || this.handlers.get(envelope.type);

      if (handler) {
        try {
          const result = await handler(envelope);
          if (envelope.correlationId) {
            this.sendResponse(envelope.correlationId, result);
          }
        } catch (err) {
          Logger.error(MODULE, `Erro ao processar mensagem da ponte [${envelope.type}]:`, err);
          if (envelope.correlationId) {
            this.sendResponse(envelope.correlationId, { error: String(err) });
          }
        }
      }
    });
  }

  /**
   * Registra um listener para eventos vindos do outro mundo.
   */
  on<T = unknown>(type: BridgeEventType, actionOrHandler: string | ((env: BridgeEnvelope<T>) => any), handler?: (env: BridgeEnvelope<T>) => any): () => void {
    let key: string;
    let fn: (env: BridgeEnvelope<any>) => any;

    if (typeof actionOrHandler === 'string' && handler) {
      key = `${type}:${actionOrHandler}`;
      fn = handler;
    } else {
      key = type;
      fn = actionOrHandler as (env: BridgeEnvelope<any>) => any;
    }

    this.handlers.set(key, fn);
    return () => this.handlers.delete(key);
  }

  /**
   * Envia uma mensagem sem esperar resposta (fire-and-forget).
   */
  post<T = unknown>(type: BridgeEventType, action?: string, payload?: T): void {
    const envelope: BridgeEnvelope<T> = {
      source: this.sourceTag,
      type,
      action,
      correlationId: '',
      payload,
      timestamp: Date.now(),
    };

    window.postMessage(envelope, '*');
  }

  /**
   * Envia um comando e aguarda a resposta assíncrona (Request / Response).
   */
  request<T = unknown, R = unknown>(type: BridgeEventType, action?: string, payload?: T, timeoutMs = 5000): Promise<R> {
    const correlationId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Timeout na comunicação com ${this.targetTag} [${type}:${action || ''}]`));
      }, timeoutMs);

      this.pendingRequests.set(correlationId, { resolve, reject, timer });

      const envelope: BridgeEnvelope<T> = {
        source: this.sourceTag,
        type,
        action,
        correlationId,
        payload,
        timestamp: Date.now(),
      };

      window.postMessage(envelope, '*');
    });
  }

  /**
   * Envia a resposta de uma requisição para o outro mundo.
   */
  sendResponse<T = unknown>(correlationId: string, payload: T): void {
    const envelope: BridgeEnvelope<T> = {
      source: this.sourceTag,
      type: BRIDGE_EVENTS.RESPONSE,
      correlationId,
      payload,
      timestamp: Date.now(),
    };

    window.postMessage(envelope, '*');
  }
}
