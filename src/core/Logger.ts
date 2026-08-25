// ============================================================
// Auto Live Shop V2 — Logger
// ============================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<LogLevel, string> = {
  debug: '#64748b',
  info:  '#14b8a6',
  warn:  '#f97316',
  error: '#ef4444',
};

class LoggerClass {
  private prefix = '[ALS]';
  private enabled = true;

  setEnabled(val: boolean) { this.enabled = val; }

  debug(module: string, ...args: unknown[]) {
    this._log('debug', module, ...args);
  }
  info(module: string, ...args: unknown[]) {
    this._log('info', module, ...args);
  }
  warn(module: string, ...args: unknown[]) {
    this._log('warn', module, ...args);
  }
  error(module: string, ...args: unknown[]) {
    this._log('error', module, ...args);
  }

  private _log(level: LogLevel, module: string, ...args: unknown[]) {
    if (!this.enabled && level === 'debug') return;
    const color = COLORS[level];
    const label = `${this.prefix}[${module}]`;
    console[level === 'debug' ? 'log' : level](
      `%c${label}`,
      `color:${color};font-weight:bold`,
      ...args,
    );
  }
}

export const Logger = new LoggerClass();
