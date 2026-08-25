// ============================================================
// Copilo Live Shop V2 — Live Background Service
// Gerenciamento de ciclo de vida em segundo plano, alarmes e persistência
// ============================================================

import { ALARMS, STORAGE_KEYS, APP_NAME } from '@/shared/constants';
import { Logger } from '@/core/Logger';

const MODULE = 'LiveBackgroundService';

export class LiveBackgroundService {
  /**
   * Inicializa handlers de ciclo de vida e alarmes no Service Worker.
   */
  init(): void {
    Logger.info(MODULE, 'Inicializando LiveBackgroundService...');
    this._registerAlarmsListener();
  }

  /**
   * Agenda alarme de encerramento programado.
   */
  scheduleAutoClose(delayMs: number): void {
    chrome.alarms.create(ALARMS.AUTO_CLOSE, { when: Date.now() + delayMs });
    Logger.info(MODULE, `Encerramento programado para daqui a ${Math.round(delayMs / 1000)}s`);
  }

  /**
   * Cancela qualquer alarme ativo pelo nome.
   */
  cancelAlarm(alarmName: string): void {
    chrome.alarms.clear(alarmName);
    Logger.info(MODULE, `Alarme "${alarmName}" cancelado`);
  }

  /**
   * Emite uma notificação nativa do Chrome.
   */
  sendNotification(title: string, message: string, priority = 1): void {
    if (typeof chrome === 'undefined' || !chrome.notifications) return;

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: title || APP_NAME,
      message: message || '',
      priority,
    });
  }

  private _registerAlarmsListener(): void {
    if (typeof chrome === 'undefined' || !chrome.alarms) return;

    chrome.alarms.onAlarm.addListener(async (alarm) => {
      Logger.info(MODULE, `Alarme disparado: ${alarm.name}`);

      if (alarm.name === ALARMS.AUTO_CLOSE) {
        this.sendNotification(
          `⚠️ ${APP_NAME}`,
          'Tempo limite atingido! Encerramento automático disparado.',
          2,
        );

        // Notifica as abas ativas
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ALS_AUTO_CLOSE_TRIGGERED',
            timestamp: Date.now(),
          }).catch(() => {});
        }
      }
    });
  }
}
