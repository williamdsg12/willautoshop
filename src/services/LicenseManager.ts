// ============================================================
// Copilo Live Shop V2 — License Manager
// Gerenciamento de planos, recursos e validação de licença
// ============================================================

import type { LicensePlan, LicenseState } from '@/shared/types';
import { StateManager } from '@/core/StateManager';
import { StorageManager } from '@/core/StorageManager';
import { Logger } from '@/core/Logger';

const MODULE = 'LicenseManager';

export class LicenseManager {
  /**
   * Valida uma chave de ativação localmente ou via backend futuro.
   */
  async validate(key: string): Promise<{ status: LicensePlan; valid: boolean; message: string }> {
    const cleanKey = key.trim().toUpperCase();

    if (!cleanKey) {
      this._updatePlan('FREE', false);
      return { status: 'FREE', valid: false, message: 'Chave não informada' };
    }

    // Regras de validação mockadas para desenvolvimento
    if (cleanKey.startsWith('PRO-') && cleanKey.length >= 10) {
      this._updatePlan('PRO', true, cleanKey);
      Logger.info(MODULE, 'Plano PRO ativado com sucesso');
      return { status: 'PRO', valid: true, message: 'Licença PRO ativada com sucesso!' };
    }

    if (cleanKey.startsWith('PREMIUM-') && cleanKey.length >= 14) {
      this._updatePlan('PREMIUM', true, cleanKey);
      Logger.info(MODULE, 'Plano PREMIUM ativado com sucesso');
      return { status: 'PREMIUM', valid: true, message: 'Licença PREMIUM ativada com sucesso!' };
    }

    this._updatePlan('FREE', false);
    return { status: 'FREE', valid: false, message: 'Chave de licença inválida' };
  }

  /**
   * Retorna os dados completos do estado da licença.
   */
  getLicense(): LicenseState {
    return StateManager.license;
  }

  /**
   * Retorna o plano atual.
   */
  getPlan(): LicensePlan {
    return StateManager.license.plan;
  }

  /**
   * Retorna se a licença está ativa e válida.
   */
  isActive(): boolean {
    return StateManager.license.active;
  }

  /**
   * Verifica se o plano atual tem acesso a determinada funcionalidade.
   */
  hasFeature(feature: 'automation' | 'unlimited_messages' | 'analytics' | 'goals'): boolean {
    const plan = this.getPlan();
    if (plan === 'PREMIUM') return true;
    if (plan === 'PRO') {
      return feature !== 'analytics';
    }
    // No FREE, possui acesso básico
    return feature === 'goals';
  }

  private _updatePlan(plan: LicensePlan, active: boolean, key?: string): void {
    const licenseState: LicenseState = { plan, active, key };
    StateManager.patchLicense(licenseState);
    StateManager.patchSettings({
      licenseStatus: plan,
      licenseKey: key || '',
    });
    StorageManager.saveLicense(licenseState).catch(() => {});
  }
}
