// ============================================================
// Copilo Live Shop V2 — Audio Manager
// Gerenciamento de áudio sintetizado para alertas de venda
// ============================================================

import { Logger } from '@/core/Logger';

const MODULE = 'AudioManager';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private volumeNode: GainNode | null = null;
  private volume = 0.5;
  private unlocked = false;
  private currentOscillator: OscillatorNode | null = null;

  /**
   * Desbloqueia o AudioContext após interação explícita do usuário.
   */
  async unlock(): Promise<boolean> {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
        this.volumeNode = this.ctx.createGain();
        this.volumeNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.volumeNode.connect(this.ctx.destination);
      }

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.unlocked = true;
      Logger.info(MODULE, 'AudioContext desbloqueado com sucesso');
      return true;
    } catch (err) {
      Logger.warn(MODULE, 'Falha ao desbloquear AudioContext:', err);
      return false;
    }
  }

  /**
   * Executa o som de notificação de venda sintetizado (Ding suave).
   */
  async playSaleSound(): Promise<void> {
    if (!this.unlocked || !this.ctx) {
      // Tenta desbloquear caso ainda não tenha sido inicializado
      await this.unlock();
    }

    if (!this.ctx || this.ctx.state !== 'running') {
      Logger.debug(MODULE, 'Áudio bloqueado ou não inicializado');
      return;
    }

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // Nota A5
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6

      noteGain.gain.setValueAtTime(this.volume * 0.4, now);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(noteGain);
      noteGain.connect(this.volumeNode || this.ctx.destination);

      this.currentOscillator = osc;
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (err) {
      Logger.warn(MODULE, 'Erro ao tocar som sintetizado:', err);
    }
  }

  /**
   * Alias de playSaleSound para compatibilidade genérica.
   */
  async play(): Promise<void> {
    return this.playSaleSound();
  }

  /**
   * Interrompe a reprodução atual se houver.
   */
  stop(): void {
    if (this.currentOscillator) {
      try {
        this.currentOscillator.stop();
        this.currentOscillator.disconnect();
      } catch {
        // Ignora erro caso já esteja finalizado
      }
      this.currentOscillator = null;
    }
  }

  /**
   * Ajusta o volume do áudio (0.0 a 1.0).
   */
  setVolume(level: number): void {
    this.volume = Math.max(0, Math.min(1, level));
    if (this.volumeNode && this.ctx) {
      this.volumeNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /**
   * Verifica se o áudio foi desbloqueado pelo usuário.
   */
  isUnlocked(): boolean {
    return this.unlocked && !!this.ctx && this.ctx.state === 'running';
  }

  setEnabled(val: boolean): void {
    this.unlocked = val;
  }

  isEnabled(): boolean {
    return this.unlocked;
  }
}
