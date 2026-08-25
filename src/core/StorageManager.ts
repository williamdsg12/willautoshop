// ============================================================
// Auto Live Shop V2 — StorageManager
// Wrapper tipado sobre chrome.storage.local
// ============================================================
import { STORAGE_KEYS } from '@/shared/constants';
import type { AppSettings, LiveState, PanelState } from '@/shared/types';
import { Logger } from './Logger';

const MODULE = 'StorageManager';

class StorageManagerClass {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] !== undefined ? (result[key] as T) : defaultValue;
    } catch (err) {
      Logger.error(MODULE, `Erro ao ler "${key}":`, err);
      return defaultValue;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (err) {
      Logger.error(MODULE, `Erro ao salvar "${key}":`, err);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (err) {
      Logger.error(MODULE, `Erro ao remover "${key}":`, err);
    }
  }

  // ── Métodos de alto nível ──────────────────────────────────

  async getSettings(): Promise<Partial<AppSettings>> {
    return this.get(STORAGE_KEYS.SETTINGS, {});
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    await this.set(STORAGE_KEYS.SETTINGS, { ...current, ...settings });
  }

  async getPanelState(): Promise<Partial<PanelState>> {
    return this.get(STORAGE_KEYS.PANEL_STATE, {});
  }

  async savePanelState(state: Partial<PanelState>): Promise<void> {
    const current = await this.getPanelState();
    await this.set(STORAGE_KEYS.PANEL_STATE, { ...current, ...state });
  }

  async getLiveState(): Promise<Partial<LiveState>> {
    return this.get(STORAGE_KEYS.LIVE_STATE, {});
  }

  async saveLiveState(state: Partial<LiveState>): Promise<void> {
    await this.set(STORAGE_KEYS.LIVE_STATE, state);
  }

  async isInitialized(): Promise<boolean> {
    return this.get(STORAGE_KEYS.INITIALIZED, false);
  }

  async setInitialized(): Promise<void> {
    await this.set(STORAGE_KEYS.INITIALIZED, true);
  }
}

export const StorageManager = new StorageManagerClass();
