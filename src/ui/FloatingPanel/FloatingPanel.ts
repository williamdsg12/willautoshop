// ============================================================
// Auto Live Shop V2 — FloatingPanel Component
// Painel flutuante ultra-compacto injetado via Shadow DOM
// 6 Abas: Painel, Produtos, Automação, Vendas, Lives Gravadas, Ajustes
// ============================================================

import {
  APP_NAME,
  APP_VERSION,
  PANEL_ROOT_ID,
  PANEL_DEFAULTS,
  DEFAULTS,
} from '@/shared/constants';

import type {
  LiveMetrics,
  LiveProduct,
  Sale,
  ChatMessage,
  AutoResponse,
  RecordedLive,
} from '@/shared/types';

import {
  formatCurrency,
  formatRelativeTime,
  escHtml,
  sleep,
} from '@/shared/utils';

import { StateManager } from '@/core/StateManager';
import { StorageManager } from '@/core/StorageManager';
import { EventBus } from '@/core/EventBus';
import { Logger } from '@/core/Logger';

import { Header } from '@/ui/Header/Header';
import { TabManager } from '@/ui/Tabs/TabManager';
import { ToastManager } from '@/ui/Toasts/ToastManager';
import { PanelPositionManager } from './PanelPositionManager';
import { PanelDragManager } from './PanelDragManager';
import { PanelVisibilityManager } from './PanelVisibilityManager';

// Módulos de Domínio
import { DashboardModule } from '@/modules/dashboard/DashboardModule';
import { ProductsModule } from '@/modules/products/ProductsModule';
import { SalesModule } from '@/modules/sales/SalesModule';
import { GoalsModule } from '@/modules/goals/GoalsModule';
import { AutomationModule } from '@/modules/automation/AutomationModule';
import { SettingsModule } from '@/modules/settings/SettingsModule';
import { RecordedLivesModule } from '@/modules/recorded-lives/RecordedLivesModule';
import { AudioManager } from '@/services/AudioManager';

// Folha de estilo embutida
import panelCss from '@/styles/panel.css?inline';

const MODULE = 'FloatingPanel';

export class FloatingPanel {
  private host!: HTMLDivElement;
  private shadow!: ShadowRoot;
  private panelEl!: HTMLDivElement;

  // Gerenciadores de Painel
  public positionMgr!: PanelPositionManager;
  public dragMgr!: PanelDragManager;
  public visibilityMgr!: PanelVisibilityManager;
  public tabMgr!: TabManager;
  public toastMgr!: ToastManager;
  public headerComp!: Header;

  // Módulos de Negócio
  public dashboardMod = new DashboardModule();
  public productsMod = new ProductsModule();
  public salesMod = new SalesModule();
  public goalsMod = new GoalsModule();
  public automationMod = new AutomationModule();
  public settingsMod = new SettingsModule();
  public recordedLivesMod = new RecordedLivesModule();
  public audioMgr = new AudioManager();

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private elapsedSeconds = 0;

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

    // 3. Injeta estilos CSS
    const styleEl = document.createElement('style');
    styleEl.textContent = panelCss;
    this.shadow.appendChild(styleEl);

    // 4. Carrega estado prévio do storage
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

  toggleVisibility(): boolean {
    if (this.visibilityMgr.isVisible()) {
      this.visibilityMgr.close();
      return false;
    } else {
      this.visibilityMgr.show();
      return true;
    }
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

      <!-- TABS NAVIGATION (6 ABAS) -->
      <nav class="als-tab-nav">
        <button class="als-tab-btn active" data-tab="painel" title="Painel Geral">
          <span class="als-tab-icon">📊</span>
          <span class="als-tab-label">PAINEL</span>
        </button>
        <button class="als-tab-btn" data-tab="produtos" title="Catálogo de Produtos">
          <span class="als-tab-icon">📦</span>
          <span class="als-tab-label">PRODUTOS</span>
        </button>
        <button class="als-tab-btn" data-tab="automacao" title="Automação e Chat">
          <span class="als-tab-icon">⚡</span>
          <span class="als-tab-label">AUTOMAÇÃO</span>
        </button>
        <button class="als-tab-btn" data-tab="vendas" title="Feed de Vendas">
          <span class="als-tab-icon">🛒</span>
          <span class="als-tab-label">VENDAS</span>
        </button>
        <button class="als-tab-btn" data-tab="gravadas" title="Lives Anteriores">
          <span class="als-tab-icon">📼</span>
          <span class="als-tab-label">GRAVADAS</span>
        </button>
        <button class="als-tab-btn" data-tab="ajustes" title="Configurações">
          <span class="als-tab-icon">⚙️</span>
          <span class="als-tab-label">AJUSTES</span>
        </button>
      </nav>

      <!-- CONTENT CONTAINER -->
      <div class="als-content">

        <!-- ─── ABA 1: PAINEL ─── -->
        <div class="als-pane active" id="als-pane-painel">

          <!-- Card de Faturamento e Timer -->
          <div class="als-card als-status-card">
            <div class="als-gmv-hero">
              <div class="als-gmv-label">FATURAMENTO DA LIVE</div>
              <div class="als-gmv-value" id="als-gmv-value">R$ 0,00</div>
              <div class="als-gmv-sub" id="als-gmv-sub">Aguardando dados da LIVE...</div>
            </div>

            <div class="als-section-label mt8">TEMPO EM TRANSMISSÃO</div>
            <div class="flex-row mt4" style="justify-content:center;gap:2px;">
              <div style="text-align:center">
                <div style="font-size:22px;font-weight:900;color:#22c55e;font-variant-numeric:tabular-nums" id="als-timer-h">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">H</div>
              </div>
              <div style="font-size:18px;font-weight:900;color:#2a3f5c;margin-bottom:6px">:</div>
              <div style="text-align:center">
                <div style="font-size:22px;font-weight:900;color:#22c55e;font-variant-numeric:tabular-nums" id="als-timer-m">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">MIN</div>
              </div>
              <div style="font-size:18px;font-weight:900;color:#2a3f5c;margin-bottom:6px">:</div>
              <div style="text-align:center">
                <div style="font-size:22px;font-weight:900;color:#22c55e;font-variant-numeric:tabular-nums" id="als-timer-s">00</div>
                <div style="font-size:8px;color:#64748b;font-weight:700">SEG</div>
              </div>
            </div>
            <div class="flex-row mt6" style="justify-content:center">
              <button class="als-btn als-btn-green als-btn-xs" id="als-btn-start-live">▶ Iniciar Sessão</button>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-stop-live">■ Parar</button>
            </div>
          </div>

          <!-- Meta de GMV -->
          <div class="als-card" id="als-goal-card">
            <div class="flex-between mb4">
              <div class="als-card-title">🎯 Meta de Faturamento</div>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-edit-goal">Editar</button>
            </div>
            <div id="als-goal-content">
              <div class="als-empty-state" style="padding:6px 0">
                <div>Sem meta definida</div>
                <button class="als-btn als-btn-green als-btn-xs mt6" id="als-btn-set-goal">+ Definir meta</button>
              </div>
            </div>
          </div>

          <!-- Grid de Métricas 2x2 -->
          <div class="als-section-label">INDICADORES EM TEMPO REAL</div>
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
              <div class="als-metric-sub">velocidade</div>
            </div>
            <div class="als-metric">
              <div class="als-metric-label">ESPECTADORES</div>
              <div class="als-metric-value" id="als-metric-viewers">—</div>
              <div class="als-metric-sub">ao vivo</div>
            </div>
          </div>

          <!-- Destaque de Produto Fixado -->
          <div class="als-card" id="als-main-pinned-card" style="display:none">
            <div class="flex-between mb4">
              <div class="als-card-title text-green">📌 Produto Fixado na LIVE</div>
              <button class="als-btn als-btn-ghost als-btn-xs" id="als-btn-main-unpin">Desafixar</button>
            </div>
            <div id="als-main-pinned-info"></div>
          </div>

        </div>

        <!-- ─── ABA 2: PRODUTOS ─── -->
        <div class="als-pane" id="als-pane-produtos">
          <div class="als-card">
            <div class="flex-between mb6">
              <div>
                <div class="als-card-title">📦 Vitrine da LIVE</div>
                <div class="text-muted" id="als-product-count-label">0 produtos detectados</div>
              </div>
              <button class="als-btn als-btn-green als-btn-xs" id="als-btn-refresh-products">🔄 Atualizar</button>
            </div>
            <div id="als-product-list-wrap">
              <div class="als-empty-state">
                <div class="als-empty-icon">📦</div>
                <div>Nenhum produto sincronizado</div>
                <div class="text-muted">Clique em Atualizar para ler a vitrine da LIVE</div>
              </div>
            </div>
          </div>

          <!-- Fixação Manual Direta -->
          <div class="als-card">
            <div class="als-card-title mb4">📌 Fixação Rápida</div>
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
        </div>

        <!-- ─── ABA 3: AUTOMAÇÃO ─── -->
        <div class="als-pane" id="als-pane-automacao">

          <!-- Auto-Pin / Renovação Automática -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">⚡ Autofixar Produto</div>
                <div class="als-card-desc">Refixa o produto automaticamente para mantê-lo no topo.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-pin" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>

            <div class="als-collapsible" id="als-auto-pin-form">
              <div class="als-form-group mt6">
                <label class="als-form-label">Produto para fixação contínua</label>
                <div class="als-select-wrap">
                  <select class="als-select" id="als-pin-product-select">
                    <option value="">Selecione um produto...</option>
                  </select>
                </div>
              </div>

              <div class="als-form-group">
                <label class="als-form-label">Intervalo de renovação</label>
                <div class="als-input-row">
                  <input type="number" class="als-num-input" id="als-repin-interval" min="10" max="300" value="30" />
                  <span class="als-input-label">segundos</span>
                </div>
              </div>

              <div class="als-card-sub mt6" id="als-auto-pin-status-box">
                <div class="flex-between">
                  <span class="text-muted">Status:</span>
                  <strong id="als-auto-status-label" class="text-green">Aguardando ativação</strong>
                </div>
                <div class="flex-between mt2">
                  <span class="text-muted">Próxima execução:</span>
                  <span id="als-auto-countdown-label">—</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Mensagens Automáticas no Chat -->
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
                <input type="text" class="als-input" id="als-chat-msg-input" placeholder="Mensagem para o chat…" maxlength="150" style="flex:1" />
                <button class="als-btn als-btn-green als-btn-xs" id="als-btn-save-msg">+</button>
              </div>
              <div class="als-msg-list mt6" id="als-msg-list"></div>
            </div>
          </div>

          <!-- Respostas Automáticas por Gatilhos -->
          <div class="als-card">
            <div class="als-card-header">
              <div>
                <div class="als-card-title">🤖 Respostas Automáticas</div>
                <div class="als-card-desc">Responde dúvidas frequentes no chat por palavras-chave.</div>
              </div>
              <label class="als-toggle">
                <input type="checkbox" id="als-toggle-auto-reply" />
                <span class="als-toggle-slider"></span>
              </label>
            </div>
            <div class="als-collapsible" id="als-auto-reply-form">
              <button class="als-btn als-btn-green als-btn-sm w-full mt6" id="als-btn-new-reply">+ Nova Regra</button>
              <div id="als-reply-form-wrap" style="display:none" class="als-card-sub">
                <div class="als-form-group">
                  <label class="als-form-label">Gatilhos (palavras-chave)</label>
                  <input type="text" class="als-input" id="als-reply-triggers" placeholder="ex: tamanho, pronta entrega, frete" />
                  <div class="als-form-hint">Separe por vírgula</div>
                </div>
                <div class="als-form-group">
                  <label class="als-form-label">Resposta</label>
                  <textarea class="als-textarea" id="als-reply-text" placeholder="ex: Sim! Temos todos os tamanhos na sacola."></textarea>
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

        <!-- ─── ABA 4: VENDAS ─── -->
        <div class="als-pane" id="als-pane-vendas">
          <div class="als-card">
            <div class="flex-between mb4">
              <div>
                <div class="als-card-title">🛍 Vendas em Tempo Real</div>
                <div class="text-muted" id="als-vendas-summary">Acompanhamento contínuo da LIVE</div>
              </div>
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

        <!-- ─── ABA 5: LIVES GRAVADAS ─── -->
        <div class="als-pane" id="als-pane-gravadas">
          <div class="als-card">
            <div class="flex-between mb4">
              <div class="als-card-title">📼 Histórico de Transmissões</div>
              <button class="als-btn als-btn-green als-btn-xs" id="als-btn-load-recorded">🔄 Carregar</button>
            </div>
            <input type="text" class="als-input mt4 mb6" id="als-search-recorded" placeholder="Buscar por título ou data…" />
            <div id="als-recorded-lives-list">
              <div class="als-empty-state">
                <div class="als-empty-icon">📼</div>
                <div>Nenhuma gravação carregada</div>
                <div class="text-muted">Clique em Carregar para buscar as transmissões anteriores</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── ABA 6: AJUSTES & DEBUG ─── -->
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

          <!-- Alerta Sonoro -->
          <div class="als-card">
            <div class="als-toggle-row">
              <div>
                <div class="als-toggle-row-label">🔊 Alerta Sonoro de Venda</div>
                <div class="als-toggle-row-desc">Toca som a cada venda confirmada</div>
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

          <!-- Painel de Diagnóstico / Modo Debug -->
          <div class="als-card">
            <div class="als-card-title mb4 text-teal">🛠 Painel de Diagnóstico (Debug)</div>
            <div class="als-card-sub" style="font-size:11px;font-family:monospace;line-height:1.6">
              <div>URL: <span id="als-dbg-url" class="text-green">—</span></div>
              <div>Status LIVE: <span id="als-dbg-status" class="text-teal">—</span></div>
              <div>Produtos em Memória: <span id="als-dbg-prod-count">0</span></div>
              <div>Produto Fixado: <span id="als-dbg-pinned">—</span></div>
              <div>Fonte das Métricas: <span id="als-dbg-source">—</span></div>
              <div>Automação Ativa: <span id="als-dbg-auto">Não</span></div>
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
      const feed = $('als-sales-feed');
      if (feed) {
        feed.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">🛒</div><div>Aguardando vendas do TikTok...</div></div>`;
      }
    });

    // Goals
    $('als-btn-set-goal')?.addEventListener('click', () => this._promptGoal());
    $('als-btn-edit-goal')?.addEventListener('click', () => this._promptGoal());

    // Auto pin toggle
    $('als-toggle-auto-pin')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const select = $('als-pin-product-select') as HTMLSelectElement;
      const intervalInput = $('als-repin-interval') as HTMLInputElement;

      if (checked) {
        const prodId = select?.value;
        const interval = parseInt(intervalInput?.value || '30', 10);
        if (!prodId) {
          (e.target as HTMLInputElement).checked = false;
          EventBus.emit('toast:show', { message: 'Selecione um produto na lista', type: 'warn' });
          return;
        }
        this.automationMod.startAutoPin(prodId, interval);
        this._toggleCollapsible('als-auto-pin-form', true);
      } else {
        this.automationMod.stopAutoPin();
        this._toggleCollapsible('als-auto-pin-form', false);
      }
    });

    // Auto messages toggle
    $('als-toggle-auto-msg')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this._toggleCollapsible('als-auto-msg-form', checked);
    });

    // Auto reply toggle
    $('als-toggle-auto-reply')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this._toggleCollapsible('als-auto-reply-form', checked);
    });

    // Sliders
    $('als-msg-min-slider')?.addEventListener('input', () => this._updateMsgIntervalLabel());
    $('als-msg-max-slider')?.addEventListener('input', () => this._updateMsgIntervalLabel());

    // Chat messages CRUD
    $('als-btn-save-msg')?.addEventListener('click', () => {
      const input = $('als-chat-msg-input') as HTMLInputElement;
      const text = input?.value.trim();
      if (!text) return;
      this.automationMod.addChatMessage(text);
      input.value = '';
      this._renderMessages(StateManager.settings.chatMessages);
    });

    // Auto reply CRUD
    $('als-btn-new-reply')?.addEventListener('click', () => {
      const form = $('als-reply-form-wrap');
      if (form) form.style.display = 'block';
    });

    $('als-btn-cancel-reply')?.addEventListener('click', () => {
      const form = $('als-reply-form-wrap');
      if (form) form.style.display = 'none';
    });

    $('als-btn-save-reply')?.addEventListener('click', () => {
      const triggersInput = $('als-reply-triggers') as HTMLInputElement;
      const textInput = $('als-reply-text') as HTMLTextAreaElement;
      const triggers = triggersInput?.value.split(',').map(t => t.trim()).filter(Boolean);
      const text = textInput?.value.trim();

      if (!triggers?.length || !text) {
        EventBus.emit('toast:show', { message: 'Preencha gatilhos e resposta', type: 'warn' });
        return;
      }

      this.automationMod.addAutoResponse(triggers, text);
      triggersInput.value = '';
      textInput.value = '';
      const form = $('als-reply-form-wrap');
      if (form) form.style.display = 'none';
      this._renderReplies(StateManager.settings.autoResponses);
    });

    // Products catalog sync
    $('als-btn-refresh-products')?.addEventListener('click', async () => {
      EventBus.emit('toast:show', { message: '🔄 Sincronizando catálogo com a LIVE...', type: 'info' });
      await this.productsMod.refreshProducts();
    });

    // Manual Pin
    $('als-btn-pin-now')?.addEventListener('click', async () => {
      const select = $('als-manual-pin-select') as HTMLSelectElement;
      const prodId = select?.value;
      if (!prodId) {
        EventBus.emit('toast:show', { message: 'Selecione um produto para fixar', type: 'warn' });
        return;
      }
      const res = await this.productsMod.pin(prodId);
      const statusEl = $('als-pin-status');
      if (statusEl) {
        statusEl.textContent = res.success ? 'Produto fixado na LIVE' : `⚠ ${res.error}`;
      }
    });

    $('als-btn-unpin')?.addEventListener('click', async () => {
      const res = await this.productsMod.unpin();
      const statusEl = $('als-pin-status');
      if (statusEl) {
        statusEl.textContent = res.success ? 'Produto desafixado' : `⚠ ${res.error}`;
      }
    });

    $('als-btn-main-unpin')?.addEventListener('click', async () => {
      await this.productsMod.unpin();
    });

    // Recorded Lives
    $('als-btn-load-recorded')?.addEventListener('click', async () => {
      EventBus.emit('toast:show', { message: '📼 Buscando gravações anteriores...', type: 'info' });
      const lives = await this.recordedLivesMod.loadRecordedLives();
      this._renderRecordedLives(lives);
    });

    $('als-search-recorded')?.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value;
      const filtered = this.recordedLivesMod.filterLives(q);
      this._renderRecordedLives(filtered);
    });

    // Audio & Settings
    $('als-toggle-sound')?.addEventListener('change', (e) => {
      const on = (e.target as HTMLInputElement).checked;
      this.audioMgr.setEnabled(on);
      this.settingsMod.updateSettings({ salesSoundEnabled: on, soundEnabled: on });
    });

    $('als-btn-unlock-audio')?.addEventListener('click', async () => {
      await this.audioMgr.unlock();
      EventBus.emit('toast:show', { message: '🔊 Áudio desbloqueado com sucesso', type: 'success' });
    });

    $('als-btn-test-sound')?.addEventListener('click', () => this.audioMgr.playSaleSound());

    $('als-btn-reset-pos')?.addEventListener('click', () => this.positionMgr.resetPosition());
    $('als-btn-reset-size')?.addEventListener('click', () => this.positionMgr.resetSize());

    // License
    $('als-btn-activate-license')?.addEventListener('click', async () => {
      const key = ($('als-license-key') as HTMLInputElement)?.value.trim() || '';
      const res = await this.settingsMod.activateLicense(key);
      const badge = $('als-license-badge');
      if (badge) {
        badge.className = `als-badge als-badge-${res.status.toLowerCase()}`;
        badge.textContent = res.status;
      }
      EventBus.emit('toast:show', {
        message: res.message,
        type: res.valid ? 'success' : 'warn',
      });
    });

    $('als-btn-eye')?.addEventListener('click', () => {
      const input = $('als-license-key') as HTMLInputElement;
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  }

  private _subscribeEvents(): void {
    EventBus.on('metrics:updated', (metrics: LiveMetrics) => {
      this._renderMetrics(metrics);
      this._updateDebugView();
    });

    EventBus.on('sale:detected', (sale: Sale) => this._addSaleToFeed(sale));

    EventBus.on('products:loaded', (products: LiveProduct[]) => {
      this._renderProductList(products);
      this._updateDebugView();
    });

    EventBus.on('products:updated', (products: LiveProduct[]) => {
      this._renderProductList(products);
      this._updateDebugView();
    });

    EventBus.on('products:pinned', ({ productId }) => {
      this._updatePinnedDisplay(productId);
      this._updateDebugView();
    });

    EventBus.on('products:unpinned', () => {
      const card = this.shadow.getElementById('als-main-pinned-card');
      if (card) card.style.display = 'none';
      this._updateDebugView();
    });

    EventBus.on('automation:started', () => {
      const label = this.shadow.getElementById('als-auto-status-label');
      if (label) {
        label.textContent = 'Ativo (executando)';
        label.className = 'text-green';
      }
      this._updateDebugView();
    });

    EventBus.on('automation:stopped', () => {
      const toggle = this.shadow.getElementById('als-toggle-auto-pin') as HTMLInputElement;
      if (toggle) toggle.checked = false;
      this._toggleCollapsible('als-auto-pin-form', false);

      const label = this.shadow.getElementById('als-auto-status-label');
      if (label) {
        label.textContent = 'Parado';
        label.className = 'text-muted';
      }
      this._updateDebugView();
    });

    EventBus.on('automation:tick', ({ nextSecs }) => {
      const cd = this.shadow.getElementById('als-auto-countdown-label');
      if (cd) {
        cd.textContent = `${nextSecs}s`;
      }
    });

    EventBus.on('recorded_lives:loaded', (lives: RecordedLive[]) => {
      this._renderRecordedLives(lives);
    });
  }

  private _renderMetrics(metrics: LiveMetrics): void {
    const $ = (id: string) => this.shadow.getElementById(id);
    const gmvEl = $('als-gmv-value');
    if (gmvEl) gmvEl.textContent = formatCurrency(metrics.gmv);

    const subEl = $('als-gmv-sub');
    if (subEl) {
      subEl.textContent = metrics.source === 'DOM' || metrics.source === 'tiktok'
        ? `Atualizado: ${new Date(metrics.updatedAt).toLocaleTimeString('pt-BR')}`
        : 'Calculado a partir das vendas';
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
    const feed = this.shadow.getElementById('als-sales-feed');
    if (!feed) return;

    const empty = feed.querySelector('.als-empty-state');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'als-sale-item';
    item.innerHTML = `
      <div>
        <div class="als-sale-name">🛍 ${escHtml(sale.productName || 'Produto')}</div>
        <div class="als-sale-meta">${formatRelativeTime(sale.timestamp)} · ${escHtml(sale.source || 'DOM')}</div>
      </div>
      <div class="als-sale-amount">${sale.amount ? formatCurrency(sale.amount) : '—'}</div>
    `;

    feed.insertBefore(item, feed.firstChild);

    if (this.audioMgr.isEnabled()) {
      this.audioMgr.playSaleSound();
    }
  }

  private _renderProductList(products: LiveProduct[]): void {
    const wrap = this.shadow.getElementById('als-product-list-wrap');
    const countLabel = this.shadow.getElementById('als-product-count-label');
    const manualSelect = this.shadow.getElementById('als-manual-pin-select') as HTMLSelectElement | null;
    const autoPinSelect = this.shadow.getElementById('als-pin-product-select') as HTMLSelectElement | null;

    if (countLabel) {
      countLabel.textContent = `${products.length} produtos sincronizados`;
    }

    if (!wrap) return;

    if (!products.length) {
      wrap.innerHTML = `<div class="als-empty-state"><div class="als-empty-icon">📦</div><div>Nenhum produto encontrado</div><div class="text-muted">Aguardando carregamento da vitrine...</div></div>`;
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

    if (manualSelect) manualSelect.innerHTML = optionsHtml;
    if (autoPinSelect) autoPinSelect.innerHTML = optionsHtml;
  }

  private _updatePinnedDisplay(productId: string): void {
    const card = this.shadow.getElementById('als-main-pinned-card');
    const info = this.shadow.getElementById('als-main-pinned-info');
    const product = StateManager.products.find(p => p.id === productId);

    if (card && info && product) {
      card.style.display = 'block';
      info.innerHTML = `
        <div class="als-product-name">${escHtml(product.name)}</div>
        ${product.price ? `<div class="als-product-price text-green bold">${formatCurrency(product.price)}</div>` : ''}
      `;
    }
  }

  private _renderRecordedLives(lives: RecordedLive[]): void {
    const container = this.shadow.getElementById('als-recorded-lives-list');
    if (!container) return;

    if (!lives || lives.length === 0) {
      container.innerHTML = `
        <div class="als-empty-state">
          <div class="als-empty-icon">📼</div>
          <div>Nenhuma transmissão encontrada</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    lives.forEach(live => {
      const card = document.createElement('div');
      card.className = 'als-card-sub mb4';
      card.innerHTML = `
        <div class="flex-between">
          <strong class="text-green">${escHtml(live.title)}</strong>
          <span class="als-badge als-badge-free">${new Date(live.startedAt).toLocaleDateString('pt-BR')}</span>
        </div>
        <div class="flex-between mt4 text-muted">
          <span>GMV: <strong class="text-1">${live.gmv ? formatCurrency(live.gmv) : '—'}</strong></span>
          <span>Pedidos: <strong class="text-1">${live.ordersCount ?? '—'}</strong></span>
        </div>
      `;
      container.appendChild(card);
    });
  }

  private _updateDebugView(): void {
    const $ = (id: string) => this.shadow.getElementById(id);
    const urlEl = $('als-dbg-url'); if (urlEl) urlEl.textContent = window.location.pathname;
    const statusEl = $('als-dbg-status'); if (statusEl) statusEl.textContent = StateManager.live.status;
    const countEl = $('als-dbg-prod-count'); if (countEl) countEl.textContent = String(StateManager.products.length);
    const pinnedEl = $('als-dbg-pinned'); if (pinnedEl) pinnedEl.textContent = StateManager.live.pinnedProductId || 'Nenhum';
    const srcEl = $('als-dbg-source'); if (srcEl) srcEl.textContent = StateManager.metrics.source;
    const autoEl = $('als-dbg-auto'); if (autoEl) autoEl.textContent = StateManager.live.automationEnabled ? 'Sim (Ativo)' : 'Não';
  }

  private async _promptGoal(): Promise<void> {
    const current = StateManager.settings.gmvGoal;
    const input = window.prompt('Definir Meta de Faturamento (R$):', current ? String(current) : '');
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
    const content = this.shadow.getElementById('als-goal-content');
    if (!content) return;

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
          <span class="als-progress-pct">${status.percentage}% alcançado</span>
          ${status.isReached ? '<span class="text-green bold">🎉 META BATIDA!</span>' : ''}
        </div>
      </div>
    `;
  }

  private _renderMessages(messages: ChatMessage[]): void {
    const list = this.shadow.getElementById('als-msg-list');
    if (!list) return;

    list.innerHTML = messages.length === 0
      ? '<div class="text-muted" style="text-align:center;padding:8px">Nenhuma mensagem configurada</div>'
      : messages.map(m => `
        <div class="als-msg-item">
          <span class="als-msg-text">${escHtml(m.text)}</span>
          <button class="als-btn als-btn-ghost als-btn-xs" data-del-msg="${m.id}">✕</button>
        </div>
      `).join('');

    list.querySelectorAll('[data-del-msg]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt((btn as HTMLElement).dataset['delMsg']!, 10);
        this.automationMod.removeChatMessage(id);
        this._renderMessages(StateManager.settings.chatMessages);
      });
    });
  }

  private _renderReplies(replies: AutoResponse[]): void {
    const list = this.shadow.getElementById('als-reply-list');
    if (!list) return;

    list.innerHTML = replies.length === 0
      ? '<div class="text-muted" style="text-align:center;padding:8px">Nenhuma regra de resposta</div>'
      : replies.map(r => `
        <div class="als-msg-item">
          <div style="flex:1">
            <div class="als-badge als-badge-free mb2">${escHtml(r.triggers.join(', '))}</div>
            <div class="als-msg-text">${escHtml(r.text)}</div>
          </div>
          <button class="als-btn als-btn-ghost als-btn-xs" data-del-reply="${r.id}">✕</button>
        </div>
      `).join('');

    list.querySelectorAll('[data-del-reply]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt((btn as HTMLElement).dataset['delReply']!, 10);
        this.automationMod.removeAutoResponse(id);
        this._renderReplies(StateManager.settings.autoResponses);
      });
    });
  }

  private _toggleCollapsible(id: string, open: boolean): void {
    const el = this.shadow.getElementById(id);
    if (!el) return;
    el.classList.toggle('open', open);
  }

  private _updateMsgIntervalLabel(): void {
    const minInput = this.shadow.getElementById('als-msg-min-slider') as HTMLInputElement | null;
    const maxInput = this.shadow.getElementById('als-msg-max-slider') as HTMLInputElement | null;
    const label = this.shadow.getElementById('als-msg-interval-label');

    if (!minInput || !maxInput || !label) return;

    let min = parseInt(minInput.value, 10);
    let max = parseInt(maxInput.value, 10);
    if (min > max) { min = max; minInput.value = String(min); }

    label.textContent = `${min}s – ${max}s`;
    this.settingsMod.updateSettings({ autoMsgMin: min, autoMsgMax: max });
  }

  private _startTimer(): void {
    this._stopTimer();
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      const h = Math.floor(this.elapsedSeconds / 3600);
      const m = Math.floor((this.elapsedSeconds % 3600) / 60);
      const s = this.elapsedSeconds % 60;

      const hEl = this.shadow.getElementById('als-timer-h');
      const mEl = this.shadow.getElementById('als-timer-m');
      const sEl = this.shadow.getElementById('als-timer-s');

      if (hEl) hEl.textContent = String(h).padStart(2, '0');
      if (mEl) mEl.textContent = String(m).padStart(2, '0');
      if (sEl) sEl.textContent = String(s).padStart(2, '0');
    }, 1000);
  }

  private _stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async _hydrate(): Promise<void> {
    const settings = await StorageManager.getSettings();
    if (settings.chatMessages) this._renderMessages(settings.chatMessages);
    if (settings.autoResponses) this._renderReplies(settings.autoResponses);

    if (settings.salesSoundEnabled || settings.soundEnabled) {
      const toggle = this.shadow.getElementById('als-toggle-sound') as HTMLInputElement | null;
      if (toggle) toggle.checked = true;
      this.audioMgr.setEnabled(true);
    }

    if (settings.licenseKey) {
      const input = this.shadow.getElementById('als-license-key') as HTMLInputElement | null;
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
    this._updateDebugView();
  }
}
