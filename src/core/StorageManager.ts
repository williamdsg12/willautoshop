// ============================================================
// Copilo Live Shop V2 — StorageManager
// Wrapper tipado sobre chrome.storage.local com fallback seguro
// ============================================================

import { STORAGE_KEYS } from '@/shared/constants';
import type { AppSettings, LiveState, PanelState, LicenseState, Sale } from '@/shared/types';
import { Logger } from './Logger';

const MODULE = 'StorageManager';

class StorageManagerClass {
  private inMemoryFallback = new Map<string, unknown>();

  private isChromeStorageAvailable(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      !!chrome.storage &&
      !!chrome.storage.local
    );
  }

  /**
   * Obtém um valor por chave com valor padrão de fallback.
   */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    if (!this.isChromeStorageAvailable()) {
      return this.inMemoryFallback.has(key)
        ? (this.inMemoryFallback.get(key) as T)
        : defaultValue;
    }

    try {
      const result = await chrome.storage.local.get(key);
      return result[key] !== undefined ? (result[key] as T) : defaultValue;
    } catch (err) {
      Logger.error(MODULE, `Erro ao obter chave "${key}":`, err);
      return defaultValue;
    }
  }

  /**
   * Salva um valor por chave.
   */
  async set<T>(key: string, value: T): Promise<void> {
    if (!this.isChromeStorageAvailable()) {
      this.inMemoryFallback.set(key, value);
      return;
    }

    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (err) {
      Logger.error(MODULE, `Erro ao salvar chave "${key}":`, err);
    }
  }

  /**
   * Remove uma chave do storage.
   */
  async remove(key: string): Promise<void> {
    if (!this.isChromeStorageAvailable()) {
      this.inMemoryFallback.delete(key);
      return;
    }

    try {
      await chrome.storage.local.remove(key);
    } catch (err) {
      Logger.error(MODULE, `Erro ao remover chave "${key}":`, err);
    }
  }

  /**
   * Limpa todo o storage.
   */
  async clear(): Promise<void> {
    if (!this.isChromeStorageAvailable()) {
      this.inMemoryFallback.clear();
      return;
    }

    try {
      await chrome.storage.local.clear();
    } catch (err) {
      Logger.error(MODULE, 'Erro ao limpar storage:', err);
    }
  }

  /**
   * Obtém múltiplos valores de uma só vez.
   */
  async getMany<T extends Record<string, unknown>>(keys: string[]): Promise<Partial<T>> {
    if (!this.isChromeStorageAvailable()) {
      const result: Record<string, unknown> = {};
      keys.forEach(k => {
        if (this.inMemoryFallback.has(k)) {
          result[k] = this.inMemoryFallback.get(k);
        }
      });
      return result as Partial<T>;
    }

    try {
      return (await chrome.storage.local.get(keys)) as Partial<T>;
    } catch (err) {
      Logger.error(MODULE, 'Erro ao ler múltiplas chaves:', err);
      return {};
    }
  }

  /**
   * Salva múltiplos valores de uma só vez.
   */
  async setMany(items: Record<string, unknown>): Promise<void> {
    if (!this.isChromeStorageAvailable()) {
      Object.entries(items).forEach(([k, v]) => this.inMemoryFallback.set(k, v));
      return;
    }

    try {
      await chrome.storage.local.set(items);
    } catch (err) {
      Logger.error(MODULE, 'Erro ao salvar múltiplos itens:', err);
    }
  }

  // ── Métodos de Alto Nível ───────────────────────────────────

  async getSettings(): Promise<Partial<AppSettings>> {
    return this.get<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    await this.set(STORAGE_KEYS.SETTINGS, { ...current, ...settings });
  }

  async getPanelState(): Promise<Partial<PanelState>> {
    return this.get<Partial<PanelState>>(STORAGE_KEYS.PANEL_STATE, {});
  }

  async savePanelState(state: Partial<PanelState>): Promise<void> {
    const current = await this.getPanelState();
    await this.set(STORAGE_KEYS.PANEL_STATE, { ...current, ...state });
  }

  async getLiveState(): Promise<Partial<LiveState>> {
    return this.get<Partial<LiveState>>(STORAGE_KEYS.LIVE_STATE, {});
  }

  async saveLiveState(state: Partial<LiveState>): Promise<void> {
    await this.set(STORAGE_KEYS.LIVE_STATE, state);
  }

  async getLicense(): Promise<Partial<LicenseState>> {
    return this.get<Partial<LicenseState>>(STORAGE_KEYS.LICENSE, { plan: 'FREE', active: false });
  }

  async saveLicense(license: Partial<LicenseState>): Promise<void> {
    const current = await this.getLicense();
    await this.set(STORAGE_KEYS.LICENSE, { ...current, ...license });
  }

  async getSalesHistory(): Promise<Sale[]> {
    return this.get<Sale[]>(STORAGE_KEYS.SALES_HISTORY, []);
  }

  async saveSalesHistory(sales: Sale[]): Promise<void> {
    await this.set(STORAGE_KEYS.SALES_HISTORY, sales);
  }

  async isInitialized(): Promise<boolean> {
    return this.get<boolean>(STORAGE_KEYS.INITIALIZED, false);
  }

  async setInitialized(): Promise<void> {
    await this.set(STORAGE_KEYS.INITIALIZED, true);
  }
}

export const StorageManager = new StorageManagerClass();
