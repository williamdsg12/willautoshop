// ============================================================
// Auto Live Shop V2 — Floating Panel
// Injetado no DOM do TikTok Shop via Shadow DOM
// ============================================================
import { EventBus } from '@/core/EventBus';
import { StateManager } from '@/core/StateManager';
import { StorageManager } from '@/core/StorageManager';
import { Logger } from '@/core/Logger';
import { ProductController, AutomationController } from '@/controllers/ProductController';
import { tiktokAdapter } from '@/adapters/tiktok-shop/TikTokShopAdapter';
import { AudioManager, LicenseManager } from '@/services/index';
import { PANEL_ROOT_ID, DEFAULTS } from '@/shared/constants';
import { formatBRL, formatRelativeTime, formatDuration, escHtml, clamp } from '@/shared/utils';
import type { LiveStatus, LiveMetrics, Sale, LiveProduct, AppSettings } from '@/shared/types';

// CSS inlined via Vite ?inline
import panelCss from '@/styles/panel.css?inline';

const MODULE = 'FloatingPanel';

// ── Drag State ────────────────────────────────────────────────
interface DragState { dragging: boolean; startX: number; startY: number; startLeft: number; startTop: number; }

export class FloatingPanel {
  private host!: HTMLElement;
  private shadow!: ShadowRoot;
  private panel!: HTMLElement;
  private productCtrl = new ProductController();
  private automationCtrl = new AutomationController();
  private audioMgr = new AudioManager();
  private licenseMgr = new LicenseManager();
  private drag: DragState = { dragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 };
  private activeTab = 'painel';
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private editingReplyId: number | null = null;

  // ── Montagem ──────────────────────────────────────────────
  async mount(): Promise<void> {
    Logger.info(MODULE, 'Montando painel...');

    // Criar host + shadow root
    this.host = document.createElement('div');
    this.host.id = PANEL_ROOT_ID;
    this.host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;';
    document.body.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Injetar CSS
    const style = document.createElement('style');
    style.textContent = panelCss;
    this.shadow.appendChild(style);

    // Restaurar posição
    const panelState = await StorageManager.getPanelState();

    // Criar painel
    this.panel = document.createElement('div');
    this.panel.className = 'als-panel';
    this.panel.style.setProperty('--als-x', `${panelState.x ?? DEFAULTS.PANEL_X}px`);
    this.panel.style.setProperty('--als-y', `${panelState.y ?? DEFAULTS.PANEL_Y}px`);
    this.panel.style.setProperty('--als-w', `${panelState.width ?? DEFAULTS.PANEL_WIDTH}px`);
    this.panel.style.setProperty('--als-h', `${panelState.height ?? DEFAULTS.PANEL_HEIGHT}px`);
    if (panelState.minimized) this.panel.classList.add('minimized');

    this.panel.innerHTML = this._buildHTML();
    this.shadow.appendChild(this.panel);

    this._bindEvents();
    this._bindDrag();
    this._subscribeToState();
    this._hydrateSettings();
    this._startTimer();

    Logger.info(MODULE, '✅ Painel montado');
  }

  unmount(): void {
    this._stopTimer();
    this.host.remove();
    EventBus.removeAll();
  }

  // ── HTML do painel ───────────────────────────────────────
  private _buildHTML(): string {
    return `
      <!-- HEADER -->
      <div class="als-header" id="als-drag-handle">
        <div class="als-header-left">
          <div class="als-logo">▶</div>
          <div class="als-brand">
            <span class="als-brand-name">AUTO LIVE SHOP</span>
            <span class="als-brand-sub">Copiloto de Lives</span>
          </div>
        </div>
        <div class="als-header-right">
          <div class="als-live-badge detecting" id="als-status-badge">
            <span class="als-live-dot"></span>
            <span id="als-status-text">DETECTANDO</span>
          </div>
          <button class="als-icon-btn" id="als-btn-minimize" title="Minimizar">−</button>
          <button class="als-icon-btn" id="als-btn-close" title="Fechar">✕</button>
        </div>
      </div>

      <!-- TABS -->
      <nav class="als-tab-nav">
        <button class="als-tab-btn active" data-tab="painel">
          <span class="als-tab-icon">📊</span>
          <span class="als-tab-label">PAINEL</span>
        </button>
        <button class="als-tab-btn" data-tab="automacao">
          <span class="als-tab-icon">⚡</span>
          <span class="als-tab-label">AUTOMAÇÃO</span>
        </button>
        <button class="als-tab-btn" data-tab="produtos">
          <span class="als-tab-icon">📦</span>
          <span class="als-tab-label">PRODUTOS</span>
        </button>
        <button class="als-tab-btn" data-tab="ajustes">
          <span class="als-tab-icon">⚙️</span>
          <span class="als-tab-label">AJUSTES</span>
        </button>
      </nav>

      <!-- CONTENT -->
      <div class="als-content">

        <!-- ─── ABA PAINEL ─── -->
        <div class="als-pane active" id="als-pane-painel">

          <!-- Status da live -->
          <div class="als-card als-status-card">
            <div class="als-gmv-hero">
              <div class="als-gmv-label">FATURAMENTO DA LIVE</div>
              <div class="als-gmv-value" id="als-gmv-value">R$ 0,00</div>
              <div class="als-gmv-sub" id="als-gmv-sub">Aguardando métricas do TikTok...</div>
            </div>
            <!-- Timer -->
            <div class="als-section-label mt8">TEMPO EM LIVE</div>
            <div class="flex-row mt4" style="justify-content:center;gap:2px;">
              <div style="text-align:center">
                <div style="font-size:26px;font-weight:900;color:#5eead4;font-variant-numeric:tabular-nums" id="als-timer-h">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">H</div>
              </div>
              <div style="font-size:22px;font-weight:900;color:#2a3f5c;margin-bottom:8px">:</div>
              <div style="text-align:center">
                <div style="font-size:26px;font-weight:900;color:#5eead4;font-variant-numeric:tabular-nums" id="als-timer-m">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">MIN</div>
              </div>
              <div style="font-size:22px;font-weight:900;color:#2a3f5c;margin-bottom:8px">:</div>
              <div style="text-align:center">
                <div style="font-size:26px;font-weight:900;color:#5eead4;font-variant-numeric:tabular-nums" id="als-timer-s">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">SEG</div>
              </div>
            </div>
            <div class="flex-row mt6" style="justify-content:center">
              <button class="als-btn als-btn-green als-btn-xs" id="als-btn-start-live">▶ Iniciar</button>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-stop-live">■ Parar</button>
            </div>
          </div>

          <!-- Meta de GMV -->
          <div class="als-card" id="als-goal-card">
            <div class="flex-between mb4">
              <div class="als-card-title">🎯 Meta de GMV</div>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-edit-goal">Editar</button>
            </div>
            <div id="als-goal-content">
              <div class="als-empty-state" style="padding:8px 0">
                <div>Sem meta definida</div>
                <button class="als-btn als-btn-teal als-btn-xs mt6" id="als-btn-set-goal">+ Definir meta</button>
              </div>
            </div>
          </div>

          <!-- Métricas -->
          <div class="als-section-label">MÉTRICAS</div>
          <div class="als-metrics-grid">
            <div class="als-metric">
              <div class="als-metric-label">VENDAS</div>
              <div class="als-metric-value" id="als-metric-sales">0</div>
              <div class="als-metric-sub">pedidos</div>
            </div>
            <div class="als-metric">
              <div class="als-metric-label">ITENS</div>
              <div class="als-metric-value" id="als-metric-items">0</div>
              <div class="als-metric-sub">unidades</div>
            </div>
            <div class="als-metric">
              <div class="als-metric-label">VENDAS/H</div>
              <div class="als-metric-value" id="als-metric-sph">0</div>
              <div class="als-metric-sub">por hora</div>
            </div>
            <div class="als-metric">
              <div class="als-metric-label">ASSISTINDO</div>
              <div class="als-metric-value" id="als-metric-viewers">—</div>
              <div class="als-metric-sub">ao vivo</div>
            </div>
          </div>

          <!-- Feed de vendas -->
          <div class="als-card">
            <div class="flex-between mb4">
              <div class="als-card-title">🛍 Vendas recentes</div>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-clear-sales">Limpar</button>
            </div>
            <div class="als-sales-feed" id="als-sales-feed">
              <div class="als-empty-state">
                <div class="als-empty-icon">🛒</div>
                <div>Aguardando vendas...</div>
                <div class="text-muted">As vendas aparecerão aqui</div>
              </div>
            </div>
          </div>

        </div>

        <!-- ─── ABA AUTOMAÇÃO ─── -->
        <div class="als-pane" id="als-pane-automacao">

          <!-- Fixação automática -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">📌 Fixação automática</div>
                <div class="als-card-desc">Mantém o produto fixado na live automaticamente.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-pin" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-auto-pin-form">
              <div class="als-form-group mt6">
                <label class="als-form-label">Produto</label>
                <div class="als-select-wrap">
                  <select class="als-select" id="als-pin-product-select">
                    <option value="">Selecionar produto...</option>
                  </select>
                </div>
              </div>
              <div class="als-form-group">
                <label class="als-form-label">Renovar a cada</label>
                <div class="als-input-row">
                  <input type="number" class="als-num-input" id="als-repin-interval" min="10" max="300" value="30" />
                  <span class="als-input-label">segundos</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Mensagens automáticas -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">💬 Mensagens automáticas</div>
                <div class="als-card-desc">Posta suas mensagens no chat de tempo em tempo.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-msg" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-auto-msg-form">
              <div class="als-form-group mt6">
                <div class="flex-between mb4">
                  <label class="als-form-label">Intervalo: <strong id="als-msg-interval-label">60s – 180s</strong></label>
                  <label class="als-toggle als-toggle-sm" title="Ordem aleatória">
                    <input type="checkbox" id="als-toggle-msg-random" />
                    <span class="als-toggle-slider"></span>
                  </label>
                </div>
                <input type="range" class="als-range" id="als-msg-min-slider" min="10" max="600" value="60" step="5" />
                <input type="range" class="als-range mt4" id="als-msg-max-slider" min="10" max="600" value="180" step="5" />
              </div>
              <div class="als-input-row mt6">
                <input type="text" class="als-input" id="als-chat-msg-input" placeholder="Escreva uma mensagem…" maxlength="150" style="flex:1" />
                <button class="als-btn als-btn-teal als-btn-xs" id="als-btn-save-msg">+</button>
              </div>
              <div class="als-msg-list mt6" id="als-msg-list"></div>
            </div>
          </div>

          <!-- Respostas automáticas -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">🤖 Respostas automáticas</div>
                <div class="als-card-desc">Chat → responde sozinho por palavras-chave.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-reply" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-auto-reply-form">
              <div class="als-toggle-row mt4">
                <div>
                  <div class="als-toggle-row-label">Chamar pelo nome</div>
                  <div class="als-toggle-row-desc">Inclui o @nome de quem perguntou</div>
                </div>
                <label class="als-toggle als-toggle-sm">
                  <input type="checkbox" id="als-toggle-reply-name" />
                  <span class="als-toggle-slider"></span>
                </label>
              </div>
              <button class="als-btn als-btn-teal als-btn-sm w-full mt6" id="als-btn-new-reply">+ Nova regra</button>
              <div id="als-reply-form-wrap" style="display:none" class="als-card-sub">
                <div class="als-form-group">
                  <label class="als-form-label">Gatilhos (palavras-chave)</label>
                  <input type="text" class="als-input" id="als-reply-triggers" placeholder="ex: cor, tamanho, preço" />
                  <div class="als-form-hint">Separe por vírgula</div>
                </div>
                <div class="als-form-group">
                  <label class="als-form-label">Resposta</label>
                  <textarea class="als-textarea" id="als-reply-text" placeholder="ex: Disponível em P, M e G"></textarea>
                </div>
                <div class="flex-row mt6" style="justify-content:flex-end">
                  <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-cancel-reply">Cancelar</button>
                  <button class="als-btn als-btn-green als-btn-xs" id="als-btn-save-reply">Salvar</button>
                </div>
              </div>
              <div class="als-msg-list mt6" id="als-reply-list"></div>
            </div>
          </div>

          <!-- Oferta relâmpago -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">⚡ Oferta relâmpago automática</div>
                <div class="als-card-desc">Recria a oferta relâmpago quando expira.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-flash-deal" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
          </div>

        </div>

        <!-- ─── ABA PRODUTOS ─── -->
        <div class="als-pane" id="als-pane-produtos">

          <div class="als-card">
            <div class="flex-between mb6">
              <div class="als-card-title">📦 Produtos da live</div>
              <button class="als-btn als-btn-teal als-btn-xs" id="als-btn-refresh-products">🔄 Atualizar</button>
            </div>
            <div id="als-product-list-wrap">
              <div class="als-empty-state">
                <div class="als-empty-icon">📦</div>
                <div>Nenhum produto carregado</div>
                <div class="text-muted">Clique em Atualizar</div>
              </div>
            </div>
          </div>

          <!-- Fixar produto manual -->
          <div class="als-card">
            <div class="als-card-title mb4">📌 Fixar produto</div>
            <div class="als-form-group">
              <div class="als-select-wrap">
                <select class="als-select" id="als-manual-pin-select">
                  <option value="">Selecionar produto...</option>
                </select>
              </div>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-green als-btn-sm" style="flex:1" id="als-btn-pin-now">📌 Fixar agora</button>
              <button class="als-btn als-btn-ghost als-btn-sm" id="als-btn-unpin">Desafixar</button>
            </div>
            <div class="text-muted mt4" id="als-pin-status"></div>
          </div>

          <!-- Produto fixado atual -->
          <div class="als-card" id="als-pinned-card" style="display:none">
            <div class="als-card-title mb4 text-green">✅ Produto fixado agora</div>
            <div id="als-pinned-info"></div>
          </div>

        </div>

        <!-- ─── ABA AJUSTES ─── -->
        <div class="als-pane" id="als-pane-ajustes">

          <!-- Licença -->
          <div class="als-card als-license-card">
            <div class="flex-between mb6">
              <div class="als-card-title">🔑 Licença</div>
              <span class="als-badge als-badge-free" id="als-license-badge">FREE</span>
            </div>
            <div class="als-input-eye-wrap">
              <input type="password" class="als-input" id="als-license-key" placeholder="XXXX-XXXX-XXXX-XXXX" />
              <button class="als-eye-btn" id="als-btn-eye">👁</button>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-green als-btn-sm" id="als-btn-activate-license">✓ Ativar</button>
              <a href="https://autolive.shop" class="als-link" target="_blank">Assinar Pro — R$49/mês</a>
            </div>
          </div>

          <!-- Som de venda -->
          <div class="als-card">
            <div class="als-toggle-row">
              <div>
                <div class="als-toggle-row-label">🔊 Som de venda</div>
                <div class="als-toggle-row-desc">Toca um som a cada nova venda detectada</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-sound" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible open" id="als-sound-form">
              <button class="als-btn als-btn-ghost als-btn-xs mt6" id="als-btn-unlock-audio">🔔 Ativar áudio</button>
              <button class="als-btn als-btn-ghost als-btn-xs mt4" id="als-btn-test-sound">▶ Testar som</button>
            </div>
          </div>

          <!-- Guardião anti-ban -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">🛡 Guardião anti-ban</div>
                <div class="als-card-desc">Protege a conta ao detectar violação.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-guardian" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-guardian-form">
              <div class="als-form-group mt6">
                <label class="als-form-label">Ação ao detectar violação</label>
                <div class="als-select-wrap">
                  <select class="als-select" id="als-guardian-action">
                    <option value="alert">Apenas alertar</option>
                    <option value="pause">Pausar automações</option>
                    <option value="end">Encerrar a live</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Notificações -->
          <div class="als-card">
            <div class="als-card-title mb6">🔔 Notificações Chrome</div>
            <div class="als-checkbox-list">
              <label class="als-checkbox-item">
                <input type="checkbox" class="als-notif-cb" id="als-notif-sales" checked />
                <span class="als-checkbox-custom"></span>
                <span>Nova venda detectada</span>
              </label>
              <label class="als-checkbox-item">
                <input type="checkbox" class="als-notif-cb" id="als-notif-pin" checked />
                <span class="als-checkbox-custom"></span>
                <span>Produto fixado</span>
              </label>
              <label class="als-checkbox-item">
                <input type="checkbox" class="als-notif-cb" id="als-notif-guardian" checked />
                <span class="als-checkbox-custom"></span>
                <span>Alertas do guardião</span>
              </label>
            </div>
          </div>

          <!-- Posição do painel -->
          <div class="als-card">
            <div class="als-card-title mb6">📐 Painel</div>
            <div class="flex-row">
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-reset-pos">Restaurar posição</button>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-reset-size">Restaurar tamanho</button>
            </div>
          </div>

          <div class="als-footer">Auto Live Shop v2.0.0 · Copiloto de Lives</div>

        </div>

      </div>

      <!-- TOASTS -->
      <div class="als-toasts" id="als-toasts"></div>
    `;
  }

  // ── Bind de eventos ──────────────────────────────────────
  private _bindEvents(): void {
    const $ = (id: string) => this.shadow.getElementById(id);

    // Header
    $('als-btn-minimize')?.addEventListener('click', () => this._toggleMinimize());
    $('als-btn-close')?.addEventListener('click', () => this._close());

    // Tabs
    this.shadow.querySelectorAll('.als-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset['tab']!;
        this._switchTab(tab);
      });
    });

    // ── Painel tab ─────────────────────────────────────────
    $('als-btn-start-live')?.addEventListener('click', () => {
      if (!StateManager.live.startedAt) {
        StateManager.setLiveStatus('LIVE_ACTIVE');
        this._startTimer();
      }
    });
    $('als-btn-stop-live')?.addEventListener('click', () => {
      StateManager.setLiveStatus('LIVE_ENDED');
      this._stopTimer();
    });
    $('als-btn-clear-sales')?.addEventListener('click', () => {
      const feed = $('als-sales-feed')!;
      feed.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">🛒</div><div>Aguardando vendas...</div></div>`;
    });
    $('als-btn-set-goal')?.addEventListener('click', () => this._showGoalEditor());
    $('als-btn-edit-goal')?.addEventListener('click', () => this._showGoalEditor());

    // ── Automação tab ──────────────────────────────────────
    $('als-toggle-auto-pin')?.addEventListener('change', async (e) => {
      const on = (e.target as HTMLInputElement).checked;
      this._toggleCollapsible('als-auto-pin-form', on);
      await StorageManager.saveSettings({ repinInterval: parseInt(($('als-repin-interval') as HTMLInputElement)?.value || '30') });
      if (on) {
        const productId = ($('als-pin-product-select') as HTMLSelectElement)?.value;
        const interval = parseInt(($('als-repin-interval') as HTMLInputElement)?.value || '30');
        if (productId) this.automationCtrl.start(productId, interval);
        else this._showToast('⚠ Selecione um produto primeiro', 'warn');
      } else {
        this.automationCtrl.stop();
      }
    });

    $('als-toggle-auto-msg')?.addEventListener('change', async (e) => {
      const on = (e.target as HTMLInputElement).checked;
      this._toggleCollapsible('als-auto-msg-form', on);
      await StorageManager.saveSettings({ /* autoMsgEnabled */ });
    });

    $('als-msg-min-slider')?.addEventListener('input', () => this._updateMsgIntervalLabel());
    $('als-msg-max-slider')?.addEventListener('input', () => this._updateMsgIntervalLabel());

    $('als-btn-save-msg')?.addEventListener('click', () => this._saveChatMessage());

    $('als-toggle-auto-reply')?.addEventListener('change', (e) => {
      this._toggleCollapsible('als-auto-reply-form', (e.target as HTMLInputElement).checked);
    });
    $('als-btn-new-reply')?.addEventListener('click', () => {
      ($('als-reply-form-wrap') as HTMLElement).style.display = 'block';
    });
    $('als-btn-cancel-reply')?.addEventListener('click', () => {
      ($('als-reply-form-wrap') as HTMLElement).style.display = 'none';
      this.editingReplyId = null;
    });
    $('als-btn-save-reply')?.addEventListener('click', () => this._saveReply());

    // ── Produtos tab ───────────────────────────────────────
    $('als-btn-refresh-products')?.addEventListener('click', () => this._refreshProducts());
    $('als-btn-pin-now')?.addEventListener('click', async () => {
      const select = $('als-manual-pin-select') as HTMLSelectElement;
      if (!select.value) { this._showToast('⚠ Selecione um produto', 'warn'); return; }
      ($('als-pin-status') as HTMLElement).textContent = 'Fixando...';
      const result = await this.productCtrl.pinProduct(select.value);
      ($('als-pin-status') as HTMLElement).textContent = result.success
        ? '✅ Produto fixado com sucesso'
        : `⚠ ${result.error || 'Erro ao fixar'}`;
    });
    $('als-btn-unpin')?.addEventListener('click', async () => {
      const result = await this.productCtrl.unpinProduct();
      ($('als-pin-status') as HTMLElement).textContent = result.success
        ? 'Produto desafixado'
        : `⚠ ${result.error}`;
    });

    // ── Ajustes tab ────────────────────────────────────────
    $('als-toggle-sound')?.addEventListener('change', async (e) => {
      const on = (e.target as HTMLInputElement).checked;
      this.audioMgr.setEnabled(on);
      await StorageManager.saveSettings({ soundEnabled: on });
    });
    $('als-btn-unlock-audio')?.addEventListener('click', async () => {
      await this.audioMgr.unlock();
      this._showToast('🔊 Áudio ativado!', 'success');
    });
    $('als-btn-test-sound')?.addEventListener('click', () => this.audioMgr.playSaleSound());

    $('als-toggle-guardian')?.addEventListener('change', (e) => {
      this._toggleCollapsible('als-guardian-form', (e.target as HTMLInputElement).checked);
    });

    $('als-btn-activate-license')?.addEventListener('click', () => this._activateLicense());

    $('als-btn-eye')?.addEventListener('click', () => {
      const input = $('als-license-key') as HTMLInputElement;
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    $('als-btn-reset-pos')?.addEventListener('click', () => {
      this.panel.style.setProperty('--als-x', `${DEFAULTS.PANEL_X}px`);
      this.panel.style.setProperty('--als-y', `${DEFAULTS.PANEL_Y}px`);
      StorageManager.savePanelState({ x: DEFAULTS.PANEL_X, y: DEFAULTS.PANEL_Y });
    });
    $('als-btn-reset-size')?.addEventListener('click', () => {
      this.panel.style.setProperty('--als-w', `${DEFAULTS.PANEL_WIDTH}px`);
      this.panel.style.setProperty('--als-h', `${DEFAULTS.PANEL_HEIGHT}px`);
      StorageManager.savePanelState({ width: DEFAULTS.PANEL_WIDTH, height: DEFAULTS.PANEL_HEIGHT });
    });

    // Salvar config de notificações
    this.shadow.querySelectorAll('.als-notif-cb').forEach(cb => {
      cb.addEventListener('change', () => this._saveNotificationSettings());
    });
  }

  // ── Drag ─────────────────────────────────────────────────
  private _bindDrag(): void {
    const handle = this.shadow.getElementById('als-drag-handle')!;

    handle.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.als-icon-btn')) return;
      const rect = this.panel.getBoundingClientRect();
      this.drag = { dragging: true, startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };
      document.addEventListener('mousemove', this._onDragMove);
      document.addEventListener('mouseup', this._onDragEnd);
    });
  }

  private _onDragMove = (e: MouseEvent) => {
    if (!this.drag.dragging) return;
    const dx = e.clientX - this.drag.startX;
    const dy = e.clientY - this.drag.startY;
    const x = clamp(this.drag.startLeft + dx, 0, window.innerWidth - 100);
    const y = clamp(this.drag.startTop + dy, 0, window.innerHeight - 48);
    this.panel.style.setProperty('--als-x', `${x}px`);
    this.panel.style.setProperty('--als-y', `${y}px`);
  };

  private _onDragEnd = () => {
    this.drag.dragging = false;
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
    const x = parseFloat(this.panel.style.getPropertyValue('--als-x'));
    const y = parseFloat(this.panel.style.getPropertyValue('--als-y'));
    StorageManager.savePanelState({ x, y });
  };

  // ── Subscriptions ao estado ──────────────────────────────
  private _subscribeToState(): void {
    EventBus.on('live:status_changed', (status) => this._updateStatusBadge(status));
    EventBus.on('metrics:updated', (metrics) => this._renderMetrics(metrics));
    EventBus.on('sale:detected', (sale) => this._addSaleToFeed(sale));
    EventBus.on('products:loaded', (products) => this._renderProductList(products));
    EventBus.on('products:pinned', ({ productId }) => this._updatePinnedDisplay(productId));
    EventBus.on('products:unpinned', () => {
      (this.shadow.getElementById('als-pinned-card') as HTMLElement).style.display = 'none';
    });
    EventBus.on('toast:show', ({ message, type }) => this._showToast(message, type));
    EventBus.on('automation:started', () => {
      (this.shadow.getElementById('als-toggle-auto-pin') as HTMLInputElement).checked = true;
    });
    EventBus.on('automation:stopped', () => {
      (this.shadow.getElementById('als-toggle-auto-pin') as HTMLInputElement).checked = false;
      this._toggleCollapsible('als-auto-pin-form', false);
    });
  }

  // ── Status badge ─────────────────────────────────────────
  private _updateStatusBadge(status: LiveStatus): void {
    const badge = this.shadow.getElementById('als-status-badge')!;
    const text  = this.shadow.getElementById('als-status-text')!;
    badge.className = 'als-live-badge';
    const map: Record<LiveStatus, { cls: string; label: string }> = {
      LIVE_DETECTING: { cls: 'detecting', label: 'DETECTANDO' },
      LIVE_ACTIVE:    { cls: 'active',    label: 'AO VIVO' },
      LIVE_INACTIVE:  { cls: 'inactive',  label: 'AGUARDANDO' },
      LIVE_ENDED:     { cls: 'ended',     label: 'ENCERRADA' },
      LIVE_ERROR:     { cls: 'error',     label: 'ERRO' },
    };
    badge.classList.add(map[status].cls);
    text.textContent = map[status].label;
  }

  // ── Métricas ─────────────────────────────────────────────
  private _renderMetrics(metrics: LiveMetrics): void {
    const $ = (id: string) => this.shadow.getElementById(id);
    ($('als-gmv-value') as HTMLElement).textContent = formatBRL(metrics.gmv);
    ($('als-gmv-sub') as HTMLElement).textContent = metrics.source === 'tiktok'
      ? `Atualizado: ${new Date(metrics.updatedAt).toLocaleTimeString('pt-BR')}`
      : 'Calculado localmente';
    ($('als-metric-sales') as HTMLElement).textContent = String(metrics.salesCount);
    ($('als-metric-items') as HTMLElement).textContent = String(metrics.soldItems);
    ($('als-metric-sph') as HTMLElement).textContent = metrics.salesPerHour.toFixed(1);
    if (metrics.viewers > 0) ($('als-metric-viewers') as HTMLElement).textContent = String(metrics.viewers);

    // Meta de GMV
    const goal = StateManager.settings.gmvGoal;
    if (goal) this._updateGoalProgress(metrics.gmv, goal);
  }

  // ── Feed de vendas ────────────────────────────────────────
  private _addSaleToFeed(sale: Sale): void {
    const feed = this.shadow.getElementById('als-sales-feed')!;
    const empty = feed.querySelector('.als-empty-state');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'als-sale-item';
    item.innerHTML = `
      <div>
        <div class="als-sale-name">🛍 ${escHtml(sale.productName || 'Produto')}</div>
        <div class="als-sale-meta">${formatRelativeTime(sale.timestamp)}</div>
      </div>
      <div class="als-sale-amount">${sale.amount ? formatBRL(sale.amount) : '—'}</div>
    `;
    feed.insertBefore(item, feed.firstChild);

    if (this.audioMgr.isEnabled()) this.audioMgr.playSaleSound();
  }

  // ── Produtos ──────────────────────────────────────────────
  private _refreshProducts(): void {
    const result = this.productCtrl.refreshProducts();
    if (!result.success) {
      this._showToast('⚠ ' + result.error, 'warn');
    }
  }

  private _renderProductList(products: LiveProduct[]): void {
    const wrap = this.shadow.getElementById('als-product-list-wrap')!;
    const manualSelect = this.shadow.getElementById('als-manual-pin-select') as HTMLSelectElement;
    const autoPinSelect = this.shadow.getElementById('als-pin-product-select') as HTMLSelectElement;

    if (!products.length) {
      wrap.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">📦</div><div>Nenhum produto encontrado</div><div class="text-muted">Verifique se a live está ativa</div></div>`;
      return;
    }

    // Lista visual
    const list = document.createElement('div');
    list.className = 'als-product-list';
    products.forEach(p => {
      const item = document.createElement('div');
      item.className = 'als-product-item' + (p.isPinned ? ' pinned' : '');
      item.innerHTML = `
        ${p.isPinned ? '<span class="als-product-pin-badge">📌</span>' : ''}
        <div class="als-product-info">
          <div class="als-product-name">${escHtml(p.name)}</div>
          <div class="als-product-price">${p.price ? formatBRL(p.price) : '—'}</div>
        </div>
        <div class="als-product-actions">
          <button class="als-btn als-btn-xs ${p.isPinned ? 'als-btn-ghost' : 'als-btn-green'}" data-pin-id="${p.id}">
            ${p.isPinned ? 'Fixado' : 'Fixar'}
          </button>
        </div>
      `;
      item.querySelector(`[data-pin-id]`)?.addEventListener('click', async () => {
        if (p.isPinned) { await this.productCtrl.unpinProduct(); }
        else            { await this.productCtrl.pinProduct(p.id); }
      });
      list.appendChild(item);
    });
    wrap.innerHTML = '';
    wrap.appendChild(list);

    // Selects
    const opts = `<option value="">Selecionar...</option>` +
      products.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
    manualSelect.innerHTML = opts;
    autoPinSelect.innerHTML = opts;
  }

  private _updatePinnedDisplay(productId: string): void {
    const card = this.shadow.getElementById('als-pinned-card') as HTMLElement;
    const info = this.shadow.getElementById('als-pinned-info')!;
    const product = StateManager.live.products.find(p => p.id === productId);
    if (product) {
      card.style.display = 'block';
      info.innerHTML = `
        <div class="als-product-name">${escHtml(product.name)}</div>
        ${product.price ? `<div class="als-product-price">${formatBRL(product.price)}</div>` : ''}
      `;
    }
  }

  // ── Timer ─────────────────────────────────────────────────
  private _startTimer(): void {
    if (this.timerInterval) return;
    this.timerInterval = setInterval(() => {
      const startedAt = StateManager.live.startedAt;
      if (!startedAt) return;
      const ms = Date.now() - startedAt;
      const s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      const $ = (id: string) => this.shadow.getElementById(id);
      const hEl = $('als-timer-h'); if (hEl) hEl.textContent = pad(h);
      const mEl = $('als-timer-m'); if (mEl) mEl.textContent = pad(m);
      const sEl = $('als-timer-s'); if (sEl) sEl.textContent = pad(sec);
    }, 1000);
  }

  private _stopTimer(): void {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  // ── Mensagens / Respostas ─────────────────────────────────
  private async _saveChatMessage(): Promise<void> {
    const input = this.shadow.getElementById('als-chat-msg-input') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) { this._showToast('⚠ Escreva uma mensagem', 'warn'); return; }
    const settings = await StorageManager.getSettings();
    const messages = settings.chatMessages || [];
    messages.push({ id: Date.now(), text, active: true });
    await StorageManager.saveSettings({ chatMessages: messages });
    input.value = '';
    this._renderMsgList(messages);
    this._showToast('✓ Mensagem salva', 'success');
  }

  private _renderMsgList(messages: { id: number; text: string; active: boolean }[]): void {
    const list = this.shadow.getElementById('als-msg-list')!;
    list.innerHTML = '';
    if (!messages.length) { list.innerHTML = '<div class="text-muted" style="text-align:center;padding:8px 0">Nenhuma mensagem</div>'; return; }
    messages.forEach(msg => {
      const item = document.createElement('div');
      item.className = 'als-msg-item' + (msg.active ? ' active-item' : '');
      item.innerHTML = `
        <span class="als-msg-text">${escHtml(msg.text)}</span>
        <div class="als-msg-actions">
          <label class="als-toggle als-toggle-sm"><input type="checkbox" ${msg.active ? 'checked' : ''} /><span class="als-toggle-slider"></span></label>
          <button class="als-icon-btn-xs danger" data-del-id="${msg.id}">🗑</button>
        </div>
      `;
      item.querySelector(`[data-del-id]`)?.addEventListener('click', async () => {
        const s = await StorageManager.getSettings();
        const msgs = (s.chatMessages || []).filter(m => m.id !== msg.id);
        await StorageManager.saveSettings({ chatMessages: msgs });
        this._renderMsgList(msgs);
      });
      list.appendChild(item);
    });
  }

  private async _saveReply(): Promise<void> {
    const triggers = (this.shadow.getElementById('als-reply-triggers') as HTMLInputElement).value
      .split(',').map(t => t.trim()).filter(Boolean);
    const text = (this.shadow.getElementById('als-reply-text') as HTMLTextAreaElement).value.trim();
    if (!triggers.length || !text) { this._showToast('⚠ Preencha gatilhos e resposta', 'warn'); return; }
    const settings = await StorageManager.getSettings();
    let replies = settings.autoResponses || [];
    if (this.editingReplyId) {
      replies = replies.map(r => r.id === this.editingReplyId ? { ...r, triggers, text } : r);
    } else {
      replies.push({ id: Date.now(), triggers, text, scope: 'all', active: true });
    }
    await StorageManager.saveSettings({ autoResponses: replies });
    (this.shadow.getElementById('als-reply-form-wrap') as HTMLElement).style.display = 'none';
    this.editingReplyId = null;
    this._renderReplyList(replies);
    this._showToast('✓ Regra salva', 'success');
  }

  private _renderReplyList(replies: { id: number; triggers: string[]; text: string; active: boolean }[]): void {
    const list = this.shadow.getElementById('als-reply-list')!;
    list.innerHTML = '';
    if (!replies.length) { list.innerHTML = '<div class="text-muted" style="text-align:center;padding:8px 0">Nenhuma regra</div>'; return; }
    replies.forEach(r => {
      const item = document.createElement('div');
      item.className = 'als-msg-item' + (r.active ? ' active-item' : '');
      item.innerHTML = `
        <div style="flex:1;min-width:0">
          <div class="als-tags">${r.triggers.map(t => `<span class="als-tag">${escHtml(t)}</span>`).join('')}</div>
          <div class="als-msg-text mt4">"${escHtml(r.text)}"</div>
        </div>
        <div class="als-msg-actions">
          <label class="als-toggle als-toggle-sm"><input type="checkbox" ${r.active ? 'checked' : ''} /><span class="als-toggle-slider"></span></label>
          <button class="als-icon-btn-xs danger" data-del-reply="${r.id}">🗑</button>
        </div>
      `;
      item.querySelector(`[data-del-reply]`)?.addEventListener('click', async () => {
        const s = await StorageManager.getSettings();
        const rs = (s.autoResponses || []).filter(x => x.id !== r.id);
        await StorageManager.saveSettings({ autoResponses: rs });
        this._renderReplyList(rs);
      });
      list.appendChild(item);
    });
  }

  // ── Meta de GMV ───────────────────────────────────────────
  private async _showGoalEditor(): Promise<void> {
    const goal = window.prompt('Digite a meta de GMV (R$):', String(StateManager.settings.gmvGoal || ''));
    if (goal === null) return;
    const value = parseFloat(goal.replace(',', '.'));
    if (isNaN(value) || value <= 0) { this._showToast('⚠ Meta inválida', 'warn'); return; }
    StateManager.patchSettings({ gmvGoal: value });
    await StorageManager.saveSettings({ gmvGoal: value });
    this._updateGoalProgress(StateManager.live.metrics.gmv, value);
    this._showToast(`🎯 Meta: ${formatBRL(value)}`, 'success');
  }

  private _updateGoalProgress(current: number, goal: number): void {
    const pct = Math.min(100, Math.round((current / goal) * 100));
    const remaining = Math.max(0, goal - current);
    const content = this.shadow.getElementById('als-goal-content')!;
    content.innerHTML = `
      <div class="als-progress-wrap">
        <div class="als-progress-labels">
          <span class="text-green bold">${formatBRL(current)}</span>
          <span class="text-muted">${formatBRL(goal)}</span>
        </div>
        <div class="als-progress-track">
          <div class="als-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="flex-between mt4">
          <span class="text-muted">${pct}% atingido</span>
          <span class="text-muted">Faltam ${formatBRL(remaining)}</span>
        </div>
      </div>
    `;
    if (pct >= 100) {
      this._showToast('🏆 Meta de GMV atingida!', 'success');
    }
  }

  // ── License ───────────────────────────────────────────────
  private async _activateLicense(): Promise<void> {
    const key = (this.shadow.getElementById('als-license-key') as HTMLInputElement).value.trim();
    if (!key) { this._showToast('⚠ Digite a chave', 'warn'); return; }
    const result = await this.licenseMgr.validate(key);
    const badge = this.shadow.getElementById('als-license-badge')!;
    badge.className = `als-badge als-badge-${result.status.toLowerCase()}`;
    badge.textContent = result.status;
    await StorageManager.saveSettings({ licenseKey: key, licenseStatus: result.status });
    this._showToast(result.valid ? `✓ Licença ${result.status} ativada` : '⚠ Chave inválida (modo FREE)', result.valid ? 'success' : 'warn');
  }

  // ── Hydrate ───────────────────────────────────────────────
  private async _hydrateSettings(): Promise<void> {
    const settings = await StorageManager.getSettings();
    if (settings.chatMessages) this._renderMsgList(settings.chatMessages);
    if (settings.autoResponses) this._renderReplyList(settings.autoResponses);
    if (settings.soundEnabled) {
      (this.shadow.getElementById('als-toggle-sound') as HTMLInputElement).checked = true;
      this.audioMgr.setEnabled(true);
    }
    if (settings.guardianEnabled) {
      (this.shadow.getElementById('als-toggle-guardian') as HTMLInputElement).checked = true;
      this._toggleCollapsible('als-guardian-form', true);
    }
    if (settings.licenseKey) {
      (this.shadow.getElementById('als-license-key') as HTMLInputElement).value = settings.licenseKey;
    }
    if (settings.licenseStatus) {
      const badge = this.shadow.getElementById('als-license-badge')!;
      badge.className = `als-badge als-badge-${settings.licenseStatus.toLowerCase()}`;
      badge.textContent = settings.licenseStatus;
    }
    if (settings.gmvGoal) {
      StateManager.patchSettings({ gmvGoal: settings.gmvGoal });
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  private _switchTab(tab: string): void {
    this.activeTab = tab;
    this.shadow.querySelectorAll('.als-tab-btn').forEach(b => b.classList.remove('active'));
    this.shadow.querySelectorAll('.als-pane').forEach(p => p.classList.remove('active'));
    this.shadow.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    this.shadow.getElementById(`als-pane-${tab}`)?.classList.add('active');
    EventBus.emit('panel:tab_changed', tab);
  }

  private _toggleMinimize(): void {
    const minimized = this.panel.classList.toggle('minimized');
    const btn = this.shadow.getElementById('als-btn-minimize')!;
    btn.textContent = minimized ? '+' : '−';
    StorageManager.savePanelState({ minimized });
  }

  private _close(): void {
    this.panel.classList.add('hidden');
    StorageManager.savePanelState({ visible: false });
  }

  private _toggleCollapsible(id: string, open: boolean): void {
    const el = this.shadow.getElementById(id);
    el?.classList.toggle('open', open);
  }

  private _updateMsgIntervalLabel(): void {
    const min = (this.shadow.getElementById('als-msg-min-slider') as HTMLInputElement)?.value;
    const max = (this.shadow.getElementById('als-msg-max-slider') as HTMLInputElement)?.value;
    const label = this.shadow.getElementById('als-msg-interval-label');
    if (label) label.textContent = `${min}s – ${max}s`;
  }

  private _saveNotificationSettings(): void {
    // persist notification preferences
    StorageManager.saveSettings({});
  }

  // ── Toast system ──────────────────────────────────────────
  private _showToast(message: string, type: 'success' | 'warn' | 'error' | 'info' = 'success'): void {
    const container = this.shadow.getElementById('als-toasts')!;
    const toast = document.createElement('div');
    toast.className = `als-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'als-toastOut 0.25s ease forwards';
      setTimeout(() => toast.remove(), 280);
    }, DEFAULTS.TOAST_DURATION_MS);

    // Limitar toasts
    while (container.children.length > DEFAULTS.MAX_TOASTS) {
      container.firstChild?.remove();
    }
  }
}
