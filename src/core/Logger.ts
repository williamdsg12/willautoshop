// ============================================================
// Copilo Live Shop V2 — Logger
// Sistema de logging estruturado e configurável
// ============================================================

import { APP_NAME } from '@/shared/constants';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_COLORS: Record<LogLevel, string> = {
  DEBUG: '#64748b',
  INFO:  '#22c55e',
  WARN:  '#f97316',
  ERROR: '#ef4444',
};

class LoggerClass {
  private prefix = APP_NAME;
  private debugEnabled = true;

  /** Ativa ou desativa logs de nível DEBUG */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  debug(module: string, message: string, ...args: unknown[]): void {
    if (!this.debugEnabled) return;
    this._log('DEBUG', module, message, ...args);
  }

  info(module: string, message: string, ...args: unknown[]): void {
    this._log('INFO', module, message, ...args);
  }

  warn(module: string, message: string, ...args: unknown[]): void {
    this._log('WARN', module, message, ...args);
  }

  error(module: string, message: string, ...args: unknown[]): void {
    this._log('ERROR', module, message, ...args);
  }

  private _log(level: LogLevel, module: string, message: string, ...args: unknown[]): void {
    const color = LOG_COLORS[level];
    const tag = `[${this.prefix}][${module}]`;
    const fullMessage = `${tag} ${message}`;

    switch (level) {
      case 'DEBUG':
        console.log(`%c${tag}`, `color:${color};font-weight:600;`, message, ...args);
        break;
      case 'INFO':
        console.info(`%c${tag}`, `color:${color};font-weight:bold;`, message, ...args);
        break;
      case 'WARN':
        console.warn(`%c${tag}`, `color:${color};font-weight:bold;`, message, ...args);
        break;
      case 'ERROR':
        console.error(`%c${tag}`, `color:${color};font-weight:bold;`, message, ...args);
        break;
    }
  }
}

export const Logger = new LoggerClass();
