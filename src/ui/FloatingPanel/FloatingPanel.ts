// ============================================================
// Copilo Live Shop V2 — Floating Panel
// Painel flutuante injetado via Shadow DOM no DOM do TikTok Shop
// ============================================================

import { EventBus } from '@/core/EventBus';
import { StateManager } from '@/core/StateManager';
import { StorageManager } from '@/core/StorageManager';
import { Logger } from '@/core/Logger';
import { PANEL_ROOT_ID, PANEL_DEFAULTS, APP_NAME, APP_VERSION } from '@/shared/constants';
import { formatCurrency, formatRelativeTime, escHtml } from '@/shared/utils';
import type { LiveStatus, LiveMetrics, Sale, LiveProduct } from '@/shared/types';

// Managers e Componentes UI
import { PanelPositionManager } from './PanelPositionManager';
import { PanelDragManager } from './PanelDragManager';
import { PanelVisibilityManager } from './PanelVisibilityManager';
import { Header } from '../Header/Header';
import { TabManager } from '../Tabs/TabManager';
import { ToastManager } from '../Toasts/ToastManager';

// Módulos de Domínio
import { DashboardModule } from '@/modules/dashboard/DashboardModule';
import { ProductsModule } from '@/modules/products/ProductsModule';
import { SalesModule } from '@/modules/sales/SalesModule';
import { GoalsModule } from '@/modules/goals/GoalsModule';
import { AutomationModule } from '@/modules/automation/AutomationModule';
import { SettingsModule } from '@/modules/settings/SettingsModule';
import { AudioManager } from '@/services/AudioManager';

// CSS do painel injetado via Vite
import panelCss from '@/styles/panel.css?inline';

const MODULE = 'FloatingPanel';

export class FloatingPanel {
  private host!: HTMLElement;
  private shadow!: ShadowRoot;
  private panelEl!: HTMLElement;

  // Gerenciadores de UI
  private positionMgr!: PanelPositionManager;
  private dragMgr!: PanelDragManager;
  private visibilityMgr!: PanelVisibilityManager;
  private headerComp!: Header;
  private tabMgr!: TabManager;
  private toastMgr!: ToastManager;

  // Módulos
  private dashboardMod = new DashboardModule();
  private productsMod = new ProductsModule();
  private salesMod = new SalesModule();
  private goalsMod = new GoalsModule();
  private automationMod = new AutomationModule();
  private settingsMod = new SettingsModule();
  private audioMgr = new AudioManager();

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private editingReplyId: number | null = null;

  async mount(): Promise<void> {
    Logger.info(MODULE, `Montando ${APP_NAME}...`);

    const targetParent = document.body || document.documentElement;
    if (!targetParent) {
      Logger.error(MODULE, 'document.body não disponível para montagem do painel');
      return;
    }

    // 1. Cria container host
    this.host = document.createElement('div');
    this.host.id = PANEL_ROOT_ID;
    this.host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;';
    targetParent.appendChild(this.host);

    // 2. Cria Shadow DOM para isolar CSS do TikTok
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // 3. Injeta folha de estilos
    const style = document.createElement('style');
    style.textContent = panelCss;
    this.shadow.appendChild(style);

    // 4. Carrega estado inicial do storage
    const panelState = await StorageManager.getPanelState();

    // 5. Monta estrutura do painel
    this.panelEl = document.createElement('div');
    this.panelEl.className = 'als-panel';
    const initX = panelState.position?.x ?? panelState.x ?? PANEL_DEFAULTS.DEFAULT_X;
    const initY = panelState.position?.y ?? panelState.y ?? PANEL_DEFAULTS.DEFAULT_Y;
    const initW = panelState.size?.width ?? panelState.width ?? PANEL_DEFAULTS.WIDTH;
    const initH = panelState.size?.height ?? panelState.height ?? PANEL_DEFAULTS.HEIGHT;

    this.panelEl.style.setProperty('--als-x', `${initX}px`);
    this.panelEl.style.setProperty('--als-y', `${initY}px`);
    this.panelEl.style.setProperty('--als-w', `${initW}px`);
    this.panelEl.style.setProperty('--als-h', `${initH}px`);

    if (panelState.minimized) {
      this.panelEl.classList.add('minimized');
    }

    this.panelEl.innerHTML = this._buildHTML();
    this.shadow.appendChild(this.panelEl);

    // 6. Instancia gerenciadores e componentes
    this._initializeComponents();
    this._bindEvents();
    this._subscribeEvents();
    await this._hydrate();
    this._startTimer();

    Logger.info(MODULE, `✅ ${APP_NAME} montado com sucesso`);
  }

  unmount(): void {
    this._stopTimer();
    this.dragMgr?.destroy();
    this.host.remove();
    EventBus.clear();
  }

  private _initializeComponents(): void {
    const headerContainer = this.shadow.querySelector<HTMLElement>('#als-header-container')!;

    this.positionMgr = new PanelPositionManager(this.panelEl);
    this.dragMgr = new PanelDragManager(this.panelEl, headerContainer, this.positionMgr);
    this.visibilityMgr = new PanelVisibilityManager(this.panelEl);

    this.headerComp = new Header(
      headerContainer,
      () => this.visibilityMgr.toggleMinimize(),
      () => this.visibilityMgr.close(),
    );

    const minimizeBtn = this.shadow.querySelector<HTMLElement>('#als-btn-minimize');
    if (minimizeBtn) {
      this.visibilityMgr.setMinimizeButton(minimizeBtn);
    }

    const nav = this.shadow.querySelector<HTMLElement>('.als-tab-nav')!;
    const content = this.shadow.querySelector<HTMLElement>('.als-content')!;
    this.tabMgr = new TabManager(nav, content);

    const toastContainer = this.shadow.querySelector<HTMLElement>('#als-toasts')!;
    this.toastMgr = new ToastManager(toastContainer);
  }

  private _buildHTML(): string {
    return `
      <!-- HEADER COMPONENT CONTAINER -->
      <div class="als-header" id="als-header-container"></div>

      <!-- TABS NAVIGATION -->
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

      <!-- CONTENT CONTAINER -->
      <div class="als-content">

        <!-- ─── ABA PAINEL ─── -->
        <div class="als-pane active" id="als-pane-painel">

          <!-- Card de Faturamento e Timer -->
          <div class="als-card als-status-card">
            <div class="als-gmv-hero">
              <div class="als-gmv-label">FATURAMENTO DA LIVE</div>
              <div class="als-gmv-value" id="als-gmv-value">R$ 0,00</div>
              <div class="als-gmv-sub" id="als-gmv-sub">Aguardando métricas do TikTok Shop...</div>
            </div>

            <div class="als-section-label mt8">TEMPO EM TRANSMISSÃO</div>
            <div class="flex-row mt4" style="justify-content:center;gap:2px;">
              <div style="text-align:center">
                <div style="font-size:24px;font-weight:900;color:#22c55e;font-variant-numeric:tabular-nums" id="als-timer-h">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">H</div>
              </div>
              <div style="font-size:20px;font-weight:900;color:#2a3f5c;margin-bottom:8px">:</div>
              <div style="text-align:center">
                <div style="font-size:24px;font-weight:900;color:#22c55e;font-variant-numeric:tabular-nums" id="als-timer-m">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">MIN</div>
              </div>
              <div style="font-size:20px;font-weight:900;color:#2a3f5c;margin-bottom:8px">:</div>
              <div style="text-align:center">
                <div style="font-size:24px;font-weight:900;color:#22c55e;font-variant-numeric:tabular-nums" id="als-timer-s">00</div>
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
              <div class="als-empty-state" style="padding:6px 0">
                <div>Sem meta definida</div>
                <button class="als-btn als-btn-green als-btn-xs mt6" id="als-btn-set-goal">+ Definir meta</button>
              </div>
            </div>
          </div>

          <!-- Grid de Métricas -->
          <div class="als-section-label">MÉTRICAS DA SESSÃO</div>
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
              <div class="als-metric-value" id="als-metric-sph">0.0</div>
              <div class="als-metric-sub">por hora</div>
            </div>
            <div class="als-metric">
              <div class="als-metric-label">ESPECTADORES</div>
              <div class="als-metric-value" id="als-metric-viewers">—</div>
              <div class="als-metric-sub">ao vivo</div>
            </div>
          </div>

          <!-- Feed de Vendas Recentes -->
          <div class="als-card">
            <div class="flex-between mb4">
              <div class="als-card-title">🛍 Vendas Recentes</div>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-clear-sales">Limpar</button>
            </div>
            <div class="als-sales-feed" id="als-sales-feed">
              <div class="als-empty-state">
                <div class="als-empty-icon">🛒</div>
                <div>Aguardando vendas do TikTok...</div>
              </div>
            </div>
          </div>

        </div>

        <!-- ─── ABA AUTOMAÇÃO ─── -->
        <div class="als-pane" id="als-pane-automacao">

          <!-- Fixação Automática -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">📌 Fixação Automática</div>
                <div class="als-card-desc">Mantém o produto selecionado fixado no topo da transmissão.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-pin" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-auto-pin-form">
              <div class="als-form-group mt6">
                <label class="als-form-label">Produto para fixar</label>
                <div class="als-select-wrap">
                  <select class="als-select" id="als-pin-product-select">
                    <option value="">Selecione um produto...</option>
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

          <!-- Mensagens Automáticas -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">💬 Mensagens Automáticas</div>
                <div class="als-card-desc">Dispara comentários no chat da LIVE periodicamente.</div>
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
                    <input type="checkbox" id="als-toggle-msg-random" checked />
                    <span class="als-toggle-slider"></span>
                  </label>
                </div>
                <input type="range" class="als-range" id="als-msg-min-slider" min="10" max="600" value="60" step="5" />
                <input type="range" class="als-range mt4" id="als-msg-max-slider" min="10" max="600" value="180" step="5" />
              </div>
              <div class="als-input-row mt6">
                <input type="text" class="als-input" id="als-chat-msg-input" placeholder="Digite uma mensagem para o chat…" maxlength="150" style="flex:1" />
                <button class="als-btn als-btn-green als-btn-xs" id="als-btn-save-msg">+</button>
              </div>
              <div class="als-msg-list mt6" id="als-msg-list"></div>
            </div>
          </div>

          <!-- Respostas Automáticas -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">🤖 Respostas Automáticas</div>
                <div class="als-card-desc">Responde perguntas do chat por palavras-chave.</div>
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
                  <div class="als-toggle-row-desc">Menciona o usuário que fez a pergunta</div>
                </div>
                <label class="als-toggle als-toggle-sm">
                  <input type="checkbox" id="als-toggle-reply-name" checked />
                  <span class="als-toggle-slider"></span>
                </label>
              </div>
              <button class="als-btn als-btn-green als-btn-sm w-full mt6" id="als-btn-new-reply">+ Nova Regra</button>
              <div id="als-reply-form-wrap" style="display:none" class="als-card-sub">
                <div class="als-form-group">
                  <label class="als-form-label">Gatilhos (palavras-chave)</label>
                  <input type="text" class="als-input" id="als-reply-triggers" placeholder="ex: tamanho, pronta entrega, frete" />
                  <div class="als-form-hint">Separe por vírgula</div>
                </div>
                <div class="als-form-group">
                  <label class="als-form-label">Resposta</label>
                  <textarea class="als-textarea" id="als-reply-text" placeholder="ex: Sim! Temos todos os tamanhos disponíveis na sacola."></textarea>
                </div>
                <div class="flex-row mt6" style="justify-content:flex-end">
                  <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-cancel-reply">Cancelar</button>
                  <button class="als-btn als-btn-green als-btn-xs" id="als-btn-save-reply">Salvar</button>
                </div>
              </div>
              <div class="als-msg-list mt6" id="als-reply-list"></div>
            </div>
          </div>

        </div>

        <!-- ─── ABA PRODUTOS ─── -->
        <div class="als-pane" id="als-pane-produtos">

          <div class="als-card">
            <div class="flex-between mb6">
              <div class="als-card-title">📦 Catálogo da LIVE</div>
              <button class="als-btn als-btn-green als-btn-xs" id="als-btn-refresh-products">🔄 Atualizar</button>
            </div>
            <div id="als-product-list-wrap">
              <div class="als-empty-state">
                <div class="als-empty-icon">📦</div>
                <div>Nenhum produto sincronizado</div>
                <div class="text-muted">Clique em Atualizar para ler os produtos da LIVE</div>
              </div>
            </div>
          </div>

          <!-- Fixação Manual -->
          <div class="als-card">
            <div class="als-card-title mb4">📌 Fixação Manual</div>
            <div class="als-form-group">
              <div class="als-select-wrap">
                <select class="als-select" id="als-manual-pin-select">
                  <option value="">Selecione o produto...</option>
                </select>
              </div>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-green als-btn-sm" style="flex:1" id="als-btn-pin-now">📌 Fixar Agora</button>
              <button class="als-btn als-btn-ghost als-btn-sm" id="als-btn-unpin">Desafixar</button>
            </div>
            <div class="text-muted mt4" id="als-pin-status"></div>
          </div>

          <!-- Produto Fixado Atual -->
          <div class="als-card" id="als-pinned-card" style="display:none">
            <div class="als-card-title mb4 text-green">✅ Produto Fixado na LIVE</div>
            <div id="als-pinned-info"></div>
          </div>

        </div>

        <!-- ─── ABA AJUSTES ─── -->
        <div class="als-pane" id="als-pane-ajustes">

          <!-- Licença -->
          <div class="als-card als-license-card">
            <div class="flex-between mb6">
              <div class="als-card-title">🔑 Plano & Licença</div>
              <span class="als-badge als-badge-free" id="als-license-badge">FREE</span>
            </div>
            <div class="als-input-eye-wrap">
              <input type="password" class="als-input" id="als-license-key" placeholder="CHAVE-LICENCA" />
              <button class="als-eye-btn" id="als-btn-eye">👁</button>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-green als-btn-sm" id="als-btn-activate-license">✓ Ativar</button>
            </div>
          </div>

          <!-- Som de Venda -->
          <div class="als-card">
            <div class="als-toggle-row">
              <div>
                <div class="als-toggle-row-label">🔊 Alerta Sonoro de Venda</div>
                <div class="als-toggle-row-desc">Toca som a cada venda identificada</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-sound" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="flex-row mt6">
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-unlock-audio">🔔 Ativar Áudio</button>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-test-sound">▶ Testar Som</button>
            </div>
          </div>

          <!-- Posição e Dimensões do Painel -->
          <div class="als-card">
            <div class="als-card-title mb6">📐 Painel Flutuante</div>
            <div class="flex-row">
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-reset-pos">Restaurar Posição</button>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-reset-size">Restaurar Tamanho</button>
            </div>
          </div>

          <div class="als-footer">${APP_NAME} v${APP_VERSION} · Copiloto de Lives</div>

        </div>

      </div>

      <!-- TOAST NOTIFICATIONS WRAPPER -->
      <div class="als-toasts" id="als-toasts"></div>
    `;
  }

  private _bindEvents(): void {
    const $ = (id: string) => this.shadow.getElementById(id);

    // Live controls
    $('als-btn-start-live')?.addEventListener('click', () => {
      this.dashboardMod.startSession();
      this._startTimer();
    });

    $('als-btn-stop-live')?.addEventListener('click', () => {
      this.dashboardMod.endSession();
      this._stopTimer();
    });

    $('als-btn-clear-sales')?.addEventListener('click', () => {
      this.dashboardMod.clearFeed();
      const feed = $('als-sales-feed')!;
      feed.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">🛒</div><div>Aguardando vendas do TikTok...</div></div>`;
    });

    // Goals
    $('als-btn-set-goal')?.addEventListener('click', () => this._promptGoal());
    $('als-btn-edit-goal')?.addEventListener('click', () => this._promptGoal());

    // Auto pin
    $('als-toggle-auto-pin')?.addEventListener('change', async (e) => {
      const on = (e.target as HTMLInputElement).checked;
      this._toggleCollapsible('als-auto-pin-form', on);

      if (on) {
        const select = $('als-pin-product-select') as HTMLSelectElement;
        const intervalInput = $('als-repin-interval') as HTMLInputElement;
        const interval = parseInt(intervalInput.value || '30', 10);
        if (select.value) {
          this.automationMod.startAutoPin(select.value, interval);
        } else {
          EventBus.emit('toast:show', { message: '⚠ Selecione um produto na lista', type: 'warn' });
          (e.target as HTMLInputElement).checked = false;
          this._toggleCollapsible('als-auto-pin-form', false);
        }
      } else {
        this.automationMod.stopAutoPin();
      }
    });

    // Auto messages
    $('als-toggle-auto-msg')?.addEventListener('change', (e) => {
      this._toggleCollapsible('als-auto-msg-form', (e.target as HTMLInputElement).checked);
    });

    $('als-btn-save-msg')?.addEventListener('click', async () => {
      const input = $('als-chat-msg-input') as HTMLInputElement;
      const text = input.value.trim();
      if (!text) return;
      const messages = await this.automationMod.addChatMessage(text);
      input.value = '';
      this._renderMessages(messages);
    });

    // Auto replies
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

    $('als-btn-save-reply')?.addEventListener('click', async () => {
      const triggersInput = $('als-reply-triggers') as HTMLInputElement;
      const textInput = $('als-reply-text') as HTMLTextAreaElement;

      const triggers = triggersInput.value.split(',').map(t => t.trim()).filter(Boolean);
      const text = textInput.value.trim();

      if (!triggers.length || !text) {
        EventBus.emit('toast:show', { message: '⚠ Preencha gatilhos e resposta', type: 'warn' });
        return;
      }

      const replies = await this.automationMod.saveAutoResponse({
        id: this.editingReplyId || Date.now(),
        triggers,
        text,
        scope: 'all',
        active: true,
      });

      triggersInput.value = '';
      textInput.value = '';
      ($('als-reply-form-wrap') as HTMLElement).style.display = 'none';
      this.editingReplyId = null;
      this._renderReplies(replies);
    });

    // Products
    $('als-btn-refresh-products')?.addEventListener('click', async () => {
      const res = await this.productsMod.refreshCatalog();
      if (!res.success) {
        EventBus.emit('toast:show', { message: `⚠ ${res.error}`, type: 'warn' });
      }
    });

    $('als-btn-pin-now')?.addEventListener('click', async () => {
      const select = $('als-manual-pin-select') as HTMLSelectElement;
      if (!select.value) {
        EventBus.emit('toast:show', { message: '⚠ Selecione um produto', type: 'warn' });
        return;
      }
      ($('als-pin-status') as HTMLElement).textContent = 'Fixando produto...';
      const res = await this.productsMod.pin(select.value);
      ($('als-pin-status') as HTMLElement).textContent = res.success
        ? '✅ Fixado com sucesso'
        : `⚠ ${res.error || 'Falha ao fixar'}`;
    });

    $('als-btn-unpin')?.addEventListener('click', async () => {
      const res = await this.productsMod.unpin();
      ($('als-pin-status') as HTMLElement).textContent = res.success
        ? 'Produto desafixado'
        : `⚠ ${res.error}`;
    });

    // Audio & Settings
    $('als-toggle-sound')?.addEventListener('change', (e) => {
      const on = (e.target as HTMLInputElement).checked;
      this.audioMgr.setEnabled(on);
      this.settingsMod.updateSettings({ salesSoundEnabled: on, soundEnabled: on });
    });

    $('als-btn-unlock-audio')?.addEventListener('click', async () => {
      await this.audioMgr.unlock();
      EventBus.emit('toast:show', { message: '🔊 Áudio desbloqueado', type: 'success' });
    });

    $('als-btn-test-sound')?.addEventListener('click', () => this.audioMgr.playSaleSound());

    $('als-btn-reset-pos')?.addEventListener('click', () => this.positionMgr.resetPosition());
    $('als-btn-reset-size')?.addEventListener('click', () => this.positionMgr.resetSize());

    // License
    $('als-btn-activate-license')?.addEventListener('click', async () => {
      const key = ($('als-license-key') as HTMLInputElement).value.trim();
      const res = await this.settingsMod.activateLicense(key);
      const badge = $('als-license-badge')!;
      badge.className = `als-badge als-badge-${res.status.toLowerCase()}`;
      badge.textContent = res.status;
      EventBus.emit('toast:show', {
        message: res.message,
        type: res.valid ? 'success' : 'warn',
      });
    });

    $('als-btn-eye')?.addEventListener('click', () => {
      const input = $('als-license-key') as HTMLInputElement;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }

  private _subscribeEvents(): void {
    EventBus.on('metrics:updated', (metrics: LiveMetrics) => this._renderMetrics(metrics));
    EventBus.on('sale:detected', (sale: Sale) => this._addSaleToFeed(sale));
    EventBus.on('products:loaded', (products: LiveProduct[]) => this._renderProductList(products));
    EventBus.on('products:updated', (products: LiveProduct[]) => this._renderProductList(products));
    EventBus.on('products:pinned', ({ productId }) => this._updatePinnedDisplay(productId));
    EventBus.on('products:unpinned', () => {
      (this.shadow.getElementById('als-pinned-card') as HTMLElement).style.display = 'none';
    });
    EventBus.on('automation:stopped', () => {
      const toggle = this.shadow.getElementById('als-toggle-auto-pin') as HTMLInputElement;
      if (toggle) toggle.checked = false;
      this._toggleCollapsible('als-auto-pin-form', false);
    });
  }

  private _renderMetrics(metrics: LiveMetrics): void {
    const $ = (id: string) => this.shadow.getElementById(id);
    const gmvEl = $('als-gmv-value');
    if (gmvEl) gmvEl.textContent = formatCurrency(metrics.gmv);

    const subEl = $('als-gmv-sub');
    if (subEl) {
      subEl.textContent = metrics.source === 'tiktok'
        ? `Atualizado: ${new Date(metrics.updatedAt).toLocaleTimeString('pt-BR')}`
        : 'Calculado localmente';
    }

    const salesEl = $('als-metric-sales'); if (salesEl) salesEl.textContent = String(metrics.salesCount);
    const itemsEl = $('als-metric-items'); if (itemsEl) itemsEl.textContent = String(metrics.soldItems);
    const sphEl = $('als-metric-sph'); if (sphEl) sphEl.textContent = metrics.salesPerHour.toFixed(1);
    const viewersEl = $('als-metric-viewers');
    if (viewersEl && metrics.viewers > 0) viewersEl.textContent = String(metrics.viewers);

    // Atualiza progresso da meta
    this._renderGoal();
  }

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
      <div class="als-sale-amount">${sale.amount ? formatCurrency(sale.amount) : '—'}</div>
    `;

    feed.insertBefore(item, feed.firstChild);

    if (this.audioMgr.isEnabled()) {
      this.audioMgr.playSaleSound();
    }
  }

  private _renderProductList(products: LiveProduct[]): void {
    const wrap = this.shadow.getElementById('als-product-list-wrap')!;
    const manualSelect = this.shadow.getElementById('als-manual-pin-select') as HTMLSelectElement;
    const autoPinSelect = this.shadow.getElementById('als-pin-product-select') as HTMLSelectElement;

    if (!products.length) {
      wrap.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">📦</div><div>Nenhum produto encontrado</div></div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'als-product-list';

    products.forEach(p => {
      const item = document.createElement('div');
      item.className = `als-product-item ${p.isPinned ? 'pinned' : ''}`;
      item.innerHTML = `
        ${p.isPinned ? '<span class="als-product-pin-badge">📌</span>' : ''}
        <div class="als-product-info">
          <div class="als-product-name">${escHtml(p.name)}</div>
          <div class="als-product-price">${p.price ? formatCurrency(p.price) : '—'}</div>
        </div>
        <div class="als-product-actions">
          <button class="als-btn als-btn-xs ${p.isPinned ? 'als-btn-ghost' : 'als-btn-green'}" data-pin-id="${p.id}">
            ${p.isPinned ? 'Fixado' : 'Fixar'}
          </button>
        </div>
      `;

      item.querySelector(`[data-pin-id]`)?.addEventListener('click', async () => {
        if (p.isPinned) await this.productsMod.unpin();
        else await this.productsMod.pin(p.id);
      });

      list.appendChild(item);
    });

    wrap.innerHTML = '';
    wrap.appendChild(list);

    const optionsHtml = '<option value="">Selecione o produto...</option>' +
      products.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

    manualSelect.innerHTML = optionsHtml;
    autoPinSelect.innerHTML = optionsHtml;
  }

  private _updatePinnedDisplay(productId: string): void {
    const card = this.shadow.getElementById('als-pinned-card') as HTMLElement;
    const info = this.shadow.getElementById('als-pinned-info')!;
    const product = StateManager.products.find(p => p.id === productId);

    if (product) {
      card.style.display = 'block';
      info.innerHTML = `
        <div class="als-product-name">${escHtml(product.name)}</div>
        ${product.price ? `<div class="als-product-price">${formatCurrency(product.price)}</div>` : ''}
      `;
    }
  }

  private async _promptGoal(): Promise<void> {
    const current = StateManager.settings.gmvGoal;
    const input = window.prompt('Definir Meta de GMV (R$):', current ? String(current) : '');
    if (input === null) return;

    const amount = parseFloat(input.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      EventBus.emit('toast:show', { message: '⚠ Valor de meta inválido', type: 'warn' });
      return;
    }

    await this.goalsMod.setGoal(amount);
    this._renderGoal();
  }

  private _renderGoal(): void {
    const status = this.goalsMod.getGoalStatus();
    const content = this.shadow.getElementById('als-goal-content')!;

    if (!status.goal) {
      content.innerHTML = `
        <div class="als-empty-state" style="padding:6px 0">
          <div>Sem meta definida</div>
          <button class="als-btn als-btn-green als-btn-xs mt6" id="als-btn-set-goal">+ Definir meta</button>
        </div>
      `;
      content.querySelector('#als-btn-set-goal')?.addEventListener('click', () => this._promptGoal());
      return;
    }

    content.innerHTML = `
      <div class="als-progress-wrap">
        <div class="als-progress-labels">
          <span class="text-green bold">${formatCurrency(status.currentGmv)}</span>
          <span class="text-muted">${formatCurrency(status.goal)}</span>
        </div>
        <div class="als-progress-track">
          <div class="als-progress-fill" style="width: ${status.percentage}%"></div>
        </div>
        <div class="flex-between mt4">
          <span class="text-muted">${status.percentage}% atingido</span>
          <span class="text-muted">Faltam ${formatCurrency(status.remaining)}</span>
        </div>
      </div>
    `;
  }

  private _renderMessages(messages: { id: number; text: string; active: boolean }[]): void {
    const list = this.shadow.getElementById('als-msg-list')!;
    list.innerHTML = '';
    messages.forEach(m => {
      const div = document.createElement('div');
      div.className = `als-msg-item ${m.active ? 'active-item' : ''}`;
      div.innerHTML = `
        <span class="als-msg-text">${escHtml(m.text)}</span>
        <div class="als-msg-actions">
          <button class="als-icon-btn-xs danger" data-del-msg="${m.id}">🗑</button>
        </div>
      `;
      div.querySelector('[data-del-msg]')?.addEventListener('click', async () => {
        const updated = await this.automationMod.removeChatMessage(m.id);
        this._renderMessages(updated);
      });
      list.appendChild(div);
    });
  }

  private _renderReplies(replies: { id: number; triggers: string[]; text: string; active: boolean }[]): void {
    const list = this.shadow.getElementById('als-reply-list')!;
    list.innerHTML = '';
    replies.forEach(r => {
      const div = document.createElement('div');
      div.className = `als-msg-item ${r.active ? 'active-item' : ''}`;
      div.innerHTML = `
        <div style="flex:1;min-width:0">
          <div class="als-tags">${r.triggers.map(t => `<span class="als-tag">${escHtml(t)}</span>`).join('')}</div>
          <div class="als-msg-text mt4">"${escHtml(r.text)}"</div>
        </div>
        <div class="als-msg-actions">
          <button class="als-icon-btn-xs danger" data-del-reply="${r.id}">🗑</button>
        </div>
      `;
      div.querySelector('[data-del-reply]')?.addEventListener('click', async () => {
        const updated = await this.automationMod.removeAutoResponse(r.id);
        this._renderReplies(updated);
      });
      list.appendChild(div);
    });
  }

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

      const hEl = this.shadow.getElementById('als-timer-h');
      const mEl = this.shadow.getElementById('als-timer-m');
      const sEl = this.shadow.getElementById('als-timer-s');

      if (hEl) hEl.textContent = pad(h);
      if (mEl) mEl.textContent = pad(m);
      if (sEl) sEl.textContent = pad(sec);
    }, 1000);
  }

  private _stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private _toggleCollapsible(id: string, open: boolean): void {
    this.shadow.getElementById(id)?.classList.toggle('open', open);
  }

  private async _hydrate(): Promise<void> {
    const settings = await StorageManager.getSettings();
    if (settings.chatMessages) this._renderMessages(settings.chatMessages);
    if (settings.autoResponses) this._renderReplies(settings.autoResponses);
    if (settings.salesSoundEnabled || settings.soundEnabled) {
      const toggle = this.shadow.getElementById('als-toggle-sound') as HTMLInputElement;
      if (toggle) toggle.checked = true;
      this.audioMgr.setEnabled(true);
    }
    if (settings.licenseKey) {
      const input = this.shadow.getElementById('als-license-key') as HTMLInputElement;
      if (input) input.value = settings.licenseKey;
    }
    if (settings.licenseStatus) {
      const badge = this.shadow.getElementById('als-license-badge');
      if (badge) {
        badge.className = `als-badge als-badge-${settings.licenseStatus.toLowerCase()}`;
        badge.textContent = settings.licenseStatus;
      }
    }
    this._renderGoal();
  }
}
