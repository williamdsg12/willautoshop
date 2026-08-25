// ============================================================
// Copilo Live Shop V2 — Settings Module
// Orquestrador de preferências, licença e configurações persistidas
// ============================================================

import { StateManager } from '@/core/StateManager';
import { StorageManager } from '@/core/StorageManager';
import { LicenseManager } from '@/services/LicenseManager';
import type { AppSettings, LicenseState } from '@/shared/types';

export class SettingsModule {
  private licenseMgr = new LicenseManager();

  /**
   * Obtém as configurações atuais.
   */
  getSettings(): AppSettings {
    return StateManager.settings;
  }

  /**
   * Atualiza preferências gerais.
   */
  async updateSettings(patch: Partial<AppSettings>): Promise<void> {
    StateManager.patchSettings(patch);
    await StorageManager.saveSettings(patch);
  }

  /**
   * Ativa e valida chave de licença.
   */
  async activateLicense(key: string) {
    return this.licenseMgr.validate(key);
  }

  /**
   * Obtém status atual da licença.
   */
  getLicense(): LicenseState {
    return this.licenseMgr.getLicense();
  }
}
