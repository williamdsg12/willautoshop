/* ============================================================
   AutoLiveShop — Side Panel JavaScript
   Lógica principal das 4 abas + state management
   ============================================================ */

'use strict';

// ── Storage helper ────────────────────────────────────────────
const store = {
  get: (keys) => new Promise(r => chrome.storage.local.get(keys, r)),
  set: (obj)  => new Promise(r => chrome.storage.local.set(obj, r)),
};

// ── Estado em memória ─────────────────────────────────────────
const state = {
  liveStartTime: null,
  timerInterval: null,
  automationsPaused: false,
  autoCloseCountdownInterval: null,
  autoCloseTarget: null,
  mockSaleInterval: null,
  mockMetricInterval: null,
  editingReplyId: null,
  mockGMV: 0,
  mockSales: 0,
  mockViewers: 0,
};

// ═════════════════════════════════════════════════════════════
//  INIT
// ═════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllState();
  initTabs();
  initHeader();
  initPainelTab();
  initGestorTab();
  initRespostasTab();
  initAjustesTab();
  initModal();
  startMockFeed(); // mock de dados para demonstração MVP
  updateTabCount();
});

// ═════════════════════════════════════════════════════════════
//  LOAD STATE
// ═════════════════════════════════════════════════════════════
async function loadAllState() {
  const data = await store.get([
    'liveStartTime',
    'autoCloseEnabled', 'autoCloseTarget',
    'automationsPaused',
    'recordedLiveEnabled',
    'autoPinEnabled', 'pinProductId', 'repinInterval',
    'pinAnimEnabled', 'animHideTime',
    'autoMsgEnabled', 'msgMinSecs', 'msgMaxSecs', 'msgRandom',
    'chatMessages',
    'flashDealEnabled',
    'autoReplyEnabled', 'replyByName', 'replyCooldown',
    'autoResponses',
    'cartAlertEnabled', 'cartRateLimit', 'cartAlertMessages',
    'guardianEnabled', 'guardianAction', 'guardianWait', 'guardianAlarm',
    'notificationSettings',
    'licenseKey',
  ]);

  // -- Painel --
  if (data.liveStartTime) {
    state.liveStartTime = data.liveStartTime;
    startTimerTick();
  }
  if (data.autoCloseTarget && data.autoCloseEnabled) {
    state.autoCloseTarget = data.autoCloseTarget;
    setEl('toggleAutoClose', { checked: true });
    openCollapsible('autoCloseForm');
    startCountdownDisplay();
  }
  if (data.automationsPaused) state.automationsPaused = true;
  if (data.recordedLiveEnabled) {
    setEl('toggleRecordedLive', { checked: true });
    openCollapsible('recordedLiveForm');
  }

  // -- Gestor --
  if (data.autoPinEnabled) {
    setEl('toggleAutoPin', { checked: true });
    openCollapsible('autoPinForm');
  }
  if (data.pinProductId) el('pinProductSelect').value = data.pinProductId;
  if (data.repinInterval) el('repinInterval').value = data.repinInterval;
  if (data.pinAnimEnabled) {
    setEl('togglePinAnim', { checked: true });
    openCollapsible('pinAnimForm');
  }
  if (data.animHideTime) el('animHideTime').value = data.animHideTime;
  if (data.autoMsgEnabled) {
    setEl('toggleAutoMsg', { checked: true });
    openCollapsible('autoMsgForm');
  }
  if (data.msgMinSecs !== undefined) {
    el('msgMinSlider').value = data.msgMinSecs;
    el('msgMinLabel').textContent = data.msgMinSecs + 's';
  }
  if (data.msgMaxSecs !== undefined) {
    el('msgMaxSlider').value = data.msgMaxSecs;
    el('msgMaxLabel').textContent = data.msgMaxSecs + 's';
  }
  if (data.msgRandom) setEl('toggleMsgRandom', { checked: true });
  if (data.flashDealEnabled) setEl('toggleFlashDeal', { checked: true });
  renderChatMsgList(data.chatMessages || []);

  // -- Respostas --
  if (data.autoReplyEnabled) {
    setEl('toggleAutoReply', { checked: true });
    openCollapsible('autoReplyForm');
  }
  if (data.replyByName) setEl('toggleReplyByName', { checked: true });
  if (data.replyCooldown) el('replyCooldown').value = data.replyCooldown;
  renderReplyList(data.autoResponses || []);
  if (data.cartAlertEnabled) {
    setEl('toggleCartAlert', { checked: true });
    openCollapsible('cartAlertForm');
  }
  if (data.cartRateLimit) el('cartRateLimit').value = data.cartRateLimit;
  renderCartMsgList(data.cartAlertMessages || []);

  // -- Ajustes --
  if (data.guardianEnabled) {
    setEl('toggleGuardian', { checked: true });
    openCollapsible('guardianForm');
  }
  if (data.guardianAction) el('guardianAction').value = data.guardianAction;
  if (data.guardianWait) setEl('toggleGuardianWait', { checked: true });
  if (data.guardianAlarm) setEl('toggleGuardianAlarm', { checked: true });
  if (data.licenseKey) el('licenseKeyInput').value = data.licenseKey;

  const ns = data.notificationSettings || {};
  if (ns.productPinned !== undefined) el('notifProductPinned').checked = ns.productPinned;
  if (ns.stageAlerts   !== undefined) el('notifStageAlerts').checked   = ns.stageAlerts;
  if (ns.guardianAlerts !== undefined) el('notifGuardianAlerts').checked = ns.guardianAlerts;
  if (ns.chatResponse  !== undefined) el('notifChatResponse').checked  = ns.chatResponse;
}

// ═════════════════════════════════════════════════════════════
//  TABS
// ═════════════════════════════════════════════════════════════
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      el('pane-' + tab).classList.add('active');
    });
  });
}

// ═════════════════════════════════════════════════════════════
//  HEADER
// ═════════════════════════════════════════════════════════════
function initHeader() {
  el('btnPin').addEventListener('click', () => {
    // Side panel está sempre fixo quando aberto via chrome.sidePanel
    showToast('Painel fixado ✓');
  });
  el('btnClose').addEventListener('click', () => {
    window.close();
  });
}

async function updateTabCount() {
  try {
    const tabs = await new Promise(r => chrome.tabs.query({}, r));
    const liveTabs = tabs.filter(t => t.url && (
      t.url.includes('tiktok.com') || t.url.includes('seller')
    ));
    const count = Math.max(1, liveTabs.length);
    el('tabsCount').textContent = count;
  } catch {
    el('tabsCount').textContent = '1';
  }
}

// ═════════════════════════════════════════════════════════════
//  ABA 1: PAINEL
// ═════════════════════════════════════════════════════════════
function initPainelTab() {
  // ── Cronômetro ────────────────────────────────────────────
  el('btnStartTimer').addEventListener('click', async () => {
    if (!state.liveStartTime) {
      state.liveStartTime = Date.now();
      await store.set({ liveStartTime: state.liveStartTime });
      chrome.runtime.sendMessage({ action: 'START_LIVE_TIMER', startTime: state.liveStartTime }).catch(() => {});
      startTimerTick();
      showToast('⏱ Live iniciada!');
    }
  });
  el('btnStopTimer').addEventListener('click', async () => {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.liveStartTime = null;
    await store.set({ liveStartTime: null });
    chrome.runtime.sendMessage({ action: 'STOP_LIVE_TIMER' }).catch(() => {});
    renderTimer(0);
  });
  el('btnResetTimer').addEventListener('click', async () => {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.liveStartTime = Date.now();
    await store.set({ liveStartTime: state.liveStartTime });
    startTimerTick();
  });

  // ── Encerramento automático ───────────────────────────────
  el('toggleAutoClose').addEventListener('change', async (e) => {
    const on = e.target.checked;
    toggleCollapsible('autoCloseForm', on);
    if (!on) {
      clearAutoCloseCountdown();
      await store.set({ autoCloseEnabled: false, autoCloseTarget: null });
      chrome.runtime.sendMessage({ action: 'CANCEL_AUTO_CLOSE' }).catch(() => {});
    } else {
      await store.set({ autoCloseEnabled: true });
    }
  });

  el('btnStartAutoClose').addEventListener('click', async () => {
    const h = parseInt(el('acHours').value) || 0;
    const m = parseInt(el('acMinutes').value) || 0;
    const s = parseInt(el('acSeconds').value) || 0;
    const delayMs = (h * 3600 + m * 60 + s) * 1000;
    if (delayMs <= 0) { showToast('⚠ Defina um tempo maior que 0', 'warn'); return; }
    state.autoCloseTarget = Date.now() + delayMs;
    await store.set({ autoCloseTarget: state.autoCloseTarget });
    chrome.runtime.sendMessage({ action: 'SCHEDULE_AUTO_CLOSE', delayMs }).catch(() => {});
    el('countdownDisplay').style.display = 'flex';
    startCountdownDisplay();
    showToast('⏳ Encerramento agendado!');
  });

  el('btnCancelAutoClose').addEventListener('click', async () => {
    clearAutoCloseCountdown();
    el('toggleAutoClose').checked = false;
    toggleCollapsible('autoCloseForm', false);
    await store.set({ autoCloseEnabled: false, autoCloseTarget: null });
    chrome.runtime.sendMessage({ action: 'CANCEL_AUTO_CLOSE' }).catch(() => {});
    showToast('Encerramento cancelado');
  });

  // ── Pausar automação ──────────────────────────────────────
  el('btnPauseAutomation').addEventListener('click', async () => {
    state.automationsPaused = !state.automationsPaused;
    await store.set({ automationsPaused: state.automationsPaused });
    el('btnPauseAutomation').textContent = state.automationsPaused
      ? '▶ Retomar automação'
      : '⏸ Pausar automação';
    showToast(state.automationsPaused ? '⏸ Automações pausadas' : '▶ Automações retomadas');
  });

  // ── Encerrar live agora ───────────────────────────────────
  el('btnEndLiveNow').addEventListener('click', () => {
    showModal(
      '🔴 Encerrar live agora?',
      'Esta ação vai encerrar a live imediatamente. Não é possível desfazer.',
      async () => {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        state.liveStartTime = null;
        clearAutoCloseCountdown();
        await store.set({ liveStartTime: null, autoCloseEnabled: false, autoCloseTarget: null });
        renderTimer(0);
        el('liveBadge').style.opacity = '0.3';
        el('signalBars').style.opacity = '0.3';
        showToast('Live encerrada', 'warn');
      }
    );
  });

  // ── Live gravada ──────────────────────────────────────────
  el('toggleRecordedLive').addEventListener('change', async (e) => {
    const on = e.target.checked;
    toggleCollapsible('recordedLiveForm', on);
    await store.set({ recordedLiveEnabled: on });
  });
  el('videoFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      el('videoFileName').textContent = file.name;
      showToast('🎞 Vídeo selecionado: ' + file.name);
    }
  });

  // ── Limpar feed de vendas ─────────────────────────────────
  el('btnClearSales').addEventListener('click', () => {
    el('salesFeed').innerHTML = '<div class="sales-empty">Aguardando vendas...</div>';
  });
}

function startTimerTick() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    const elapsed = Date.now() - state.liveStartTime;
    renderTimer(elapsed);
  }, 1000);
  renderTimer(state.liveStartTime ? Date.now() - state.liveStartTime : 0);
}

function renderTimer(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  el('timerHours').textContent   = pad(h);
  el('timerMinutes').textContent = pad(m);
  el('timerSeconds').textContent = pad(s);
}

function clearAutoCloseCountdown() {
  if (state.autoCloseCountdownInterval) {
    clearInterval(state.autoCloseCountdownInterval);
    state.autoCloseCountdownInterval = null;
  }
  state.autoCloseTarget = null;
  el('countdownDisplay').style.display = 'none';
}

function startCountdownDisplay() {
  if (state.autoCloseCountdownInterval) clearInterval(state.autoCloseCountdownInterval);
  el('countdownDisplay').style.display = 'flex';
  const tick = () => {
    if (!state.autoCloseTarget) { clearInterval(state.autoCloseCountdownInterval); return; }
    const remaining = state.autoCloseTarget - Date.now();
    if (remaining <= 0) {
      el('countdownText').textContent = '00:00:00';
      clearAutoCloseCountdown();
      showToast('⚠️ Encerramento automático!', 'warn');
      return;
    }
    const s = Math.floor(remaining / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    el('countdownText').textContent = `${pad(h)}:${pad(m)}:${pad(sec)}`;
  };
  tick();
  state.autoCloseCountdownInterval = setInterval(tick, 1000);
}

// Mock de feed de vendas e métricas
function startMockFeed() {
  const products = [
    { name: 'Calça Marmorizada', price: 89.90 },
    { name: 'Conjunto Fitness', price: 129.90 },
    { name: 'Top Cropped', price: 49.90 },
    { name: 'Short Desfiado', price: 59.90 },
    { name: 'Legging Premium', price: 79.90 },
  ];

  // Métricas mockadas que crescem gradualmente
  state.mockMetricInterval = setInterval(() => {
    if (Math.random() > 0.6) {
      const p = products[Math.floor(Math.random() * products.length)];
      const qty = Math.ceil(Math.random() * 3);
      state.mockSales += qty;
      state.mockGMV   += p.price * qty;
      state.mockViewers = 120 + Math.floor(Math.random() * 80);

      el('metricSales').textContent   = state.mockSales;
      el('metricGMV').textContent     = 'R$ ' + state.mockGMV.toFixed(2).replace('.', ',');
      el('metricTicket').textContent  = 'R$ ' + (state.mockGMV / state.mockSales).toFixed(2).replace('.', ',');
      el('metricViewers').textContent = state.mockViewers;

      addSaleFeedItem(p.name, p.price * qty);
    }
  }, 4000);
}

function addSaleFeedItem(name, value) {
  const feed = el('salesFeed');
  const empty = feed.querySelector('.sales-empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'sale-item';
  item.innerHTML = `
    <span class="sale-info">🛍 ${name} — R$ ${value.toFixed(2).replace('.', ',')}</span>
    <span class="sale-time">agora</span>
  `;
  feed.insertBefore(item, feed.firstChild);

  // Atualizar timestamps
  let secsAgo = 0;
  const timer = setInterval(() => {
    secsAgo += 4;
    const timeEl = item.querySelector('.sale-time');
    if (!timeEl) { clearInterval(timer); return; }
    if (secsAgo < 60) timeEl.textContent = `há ${secsAgo}s`;
    else if (secsAgo < 3600) timeEl.textContent = `há ${Math.floor(secsAgo/60)} min`;
    else timeEl.textContent = `há ${Math.floor(secsAgo/3600)}h`;
  }, 4000);

  // Chrome notification
  chrome.runtime.sendMessage({
    action: 'SEND_NOTIFICATION',
    type: 'generic',
    title: '🛍 Nova venda!',
    message: `${name} — R$ ${value.toFixed(2).replace('.', ',')}`,
  }).catch(() => {});
}

// ═════════════════════════════════════════════════════════════
//  ABA 2: GESTOR DE LIVE
// ═════════════════════════════════════════════════════════════
function initGestorTab() {
  // ── Fixar automático ──────────────────────────────────────
  el('toggleAutoPin').addEventListener('change', async (e) => {
    const on = e.target.checked;
    toggleCollapsible('autoPinForm', on);
    await store.set({ autoPinEnabled: on });
    if (on) {
      const interval = parseInt(el('repinInterval').value) || 30;
      chrome.runtime.sendMessage({ action: 'START_REPIN', intervalSecs: interval }).catch(() => {});
      showToast('📌 Fixar automático ativado');
    } else {
      chrome.runtime.sendMessage({ action: 'STOP_REPIN' }).catch(() => {});
    }
  });
  el('pinProductSelect').addEventListener('change', async (e) => {
    await store.set({ pinProductId: e.target.value });
  });
  el('btnRefreshProducts').addEventListener('click', () => {
    showToast('🔄 Lista atualizada (Fase 2: sincronizará com TikTok)');
  });
  el('repinInterval').addEventListener('change', async (e) => {
    await store.set({ repinInterval: parseInt(e.target.value) });
  });

  // ── Animação do pin ───────────────────────────────────────
  el('togglePinAnim').addEventListener('change', async (e) => {
    const on = e.target.checked;
    toggleCollapsible('pinAnimForm', on);
    await store.set({ pinAnimEnabled: on });
  });
  el('animHideTime').addEventListener('change', async (e) => {
    await store.set({ animHideTime: parseInt(e.target.value) });
  });

  // ── Mensagens automáticas ─────────────────────────────────
  el('toggleAutoMsg').addEventListener('change', async (e) => {
    const on = e.target.checked;
    toggleCollapsible('autoMsgForm', on);
    await store.set({ autoMsgEnabled: on });
    if (on) {
      const minSecs = parseInt(el('msgMinSlider').value);
      const maxSecs = parseInt(el('msgMaxSlider').value);
      chrome.runtime.sendMessage({ action: 'START_AUTO_MESSAGES', minSecs, maxSecs }).catch(() => {});
    } else {
      chrome.runtime.sendMessage({ action: 'STOP_AUTO_MESSAGES' }).catch(() => {});
    }
  });

  el('msgMinSlider').addEventListener('input', async (e) => {
    const v = parseInt(e.target.value);
    el('msgMinLabel').textContent = v + 's';
    await store.set({ msgMinSecs: v });
  });
  el('msgMaxSlider').addEventListener('input', async (e) => {
    const v = parseInt(e.target.value);
    el('msgMaxLabel').textContent = v + 's';
    await store.set({ msgMaxSecs: v });
  });
  el('toggleMsgRandom').addEventListener('change', async (e) => {
    await store.set({ msgRandom: e.target.checked });
  });

  // ── Emoji picker (chat) ────────────────────────────────────
  initEmojiPicker('btnEmoji', 'emojiPicker', 'chatMsgInput');

  // ── Salvar mensagem ───────────────────────────────────────
  el('btnSaveChatMsg').addEventListener('click', async () => {
    const text = el('chatMsgInput').value.trim();
    if (!text) { showToast('⚠ Escreva uma mensagem', 'warn'); return; }
    const data = await store.get('chatMessages');
    const messages = data.chatMessages || [];
    messages.push({ id: Date.now(), text, active: true });
    await store.set({ chatMessages: messages });
    el('chatMsgInput').value = '';
    renderChatMsgList(messages);
    showToast('Mensagem salva!');
  });

  // ── Oferta relâmpago ──────────────────────────────────────
  el('toggleFlashDeal').addEventListener('change', async (e) => {
    await store.set({ flashDealEnabled: e.target.checked });
    if (e.target.checked) showToast('⚡ Oferta relâmpago automática ativada');
  });
}

function renderChatMsgList(messages) {
  const list = el('chatMsgList');
  list.innerHTML = '';
  if (!messages.length) {
    list.innerHTML = '<div style="color:var(--text-3);font-size:11px;text-align:center;padding:12px 0">Nenhuma mensagem cadastrada</div>';
    return;
  }
  messages.forEach((msg) => {
    const item = document.createElement('div');
    item.className = 'msg-item' + (msg.active ? ' active-item' : '');
    item.dataset.id = msg.id;
    item.innerHTML = `
      <span class="msg-text">${escHtml(msg.text)}</span>
      <div class="msg-actions">
        <label class="toggle toggle-sm" title="Ativar/desativar">
          <input type="checkbox" class="msg-toggle" ${msg.active ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-icon-tiny danger msg-delete" title="Excluir">🗑</button>
      </div>
    `;
    item.querySelector('.msg-toggle').addEventListener('change', async (e) => {
      msg.active = e.target.checked;
      item.classList.toggle('active-item', msg.active);
      const data = await store.get('chatMessages');
      const msgs = (data.chatMessages || []).map(m => m.id === msg.id ? { ...m, active: msg.active } : m);
      await store.set({ chatMessages: msgs });
    });
    item.querySelector('.msg-delete').addEventListener('click', async () => {
      const data = await store.get('chatMessages');
      const msgs = (data.chatMessages || []).filter(m => m.id !== msg.id);
      await store.set({ chatMessages: msgs });
      renderChatMsgList(msgs);
    });
    list.appendChild(item);
  });
}

// ═════════════════════════════════════════════════════════════
//  ABA 3: RESPOSTAS
// ═════════════════════════════════════════════════════════════
function initRespostasTab() {
  // ── Toggle respostas automáticas ──────────────────────────
  el('toggleAutoReply').addEventListener('change', async (e) => {
    const on = e.target.checked;
    toggleCollapsible('autoReplyForm', on);
    await store.set({ autoReplyEnabled: on });
    if (on) showToast('🤖 Respostas automáticas ativadas');
  });
  el('toggleReplyByName').addEventListener('change', async (e) => {
    await store.set({ replyByName: e.target.checked });
  });
  el('replyCooldown').addEventListener('change', async (e) => {
    await store.set({ replyCooldown: parseInt(e.target.value) });
  });

  // ── Nova resposta ─────────────────────────────────────────
  el('btnNewReply').addEventListener('click', () => {
    el('replyForm').style.display = 'block';
    el('replyTriggers').value = '';
    el('replyText').value = '';
    el('replyScope').value = 'all';
    state.editingReplyId = null;
    el('btnSaveReply').textContent = 'Salvar regra';
  });
  el('btnCancelReply').addEventListener('click', () => {
    el('replyForm').style.display = 'none';
    state.editingReplyId = null;
  });
  el('btnSaveReply').addEventListener('click', async () => {
    const triggers = el('replyTriggers').value.split(',').map(t => t.trim()).filter(Boolean);
    const text = el('replyText').value.trim();
    const scope = el('replyScope').value;
    if (!triggers.length || !text) {
      showToast('⚠ Preencha os gatilhos e a resposta', 'warn'); return;
    }
    const data = await store.get('autoResponses');
    let replies = data.autoResponses || [];
    if (state.editingReplyId) {
      replies = replies.map(r => r.id === state.editingReplyId ? { ...r, triggers, text, scope } : r);
    } else {
      replies.push({ id: Date.now(), triggers, text, scope, active: true });
    }
    await store.set({ autoResponses: replies });
    renderReplyList(replies);
    el('replyForm').style.display = 'none';
    state.editingReplyId = null;
    showToast('Regra salva!');
  });

  // ── Alerta carrinho ───────────────────────────────────────
  el('toggleCartAlert').addEventListener('change', async (e) => {
    const on = e.target.checked;
    toggleCollapsible('cartAlertForm', on);
    await store.set({ cartAlertEnabled: on });
  });
  el('cartRateLimit').addEventListener('change', async (e) => {
    await store.set({ cartRateLimit: parseInt(e.target.value) });
  });

  // Emoji picker carrinho
  initEmojiPicker('btnCartEmoji', 'cartEmojiPicker', 'cartMsgInput');

  el('btnSaveCartMsg').addEventListener('click', async () => {
    const text = el('cartMsgInput').value.trim();
    if (!text) { showToast('⚠ Escreva um aviso', 'warn'); return; }
    const data = await store.get('cartAlertMessages');
    const msgs = data.cartAlertMessages || [];
    msgs.push({ id: Date.now(), text, active: true });
    await store.set({ cartAlertMessages: msgs });
    el('cartMsgInput').value = '';
    renderCartMsgList(msgs);
    showToast('Aviso salvo!');
  });
}

function renderReplyList(replies) {
  const list = el('replyList');
  list.innerHTML = '';
  if (!replies.length) {
    list.innerHTML = '<div style="color:var(--text-3);font-size:11px;text-align:center;padding:12px 0">Nenhuma regra cadastrada</div>';
    return;
  }
  replies.forEach(reply => {
    const item = document.createElement('div');
    item.className = 'reply-item' + (reply.active ? ' active-item' : '');
    const scopeLabel = reply.scope === 'all' ? 'Todos os produtos' : reply.scope;
    item.innerHTML = `
      <div class="reply-header">
        <div style="flex:1">
          <div class="reply-triggers">
            ${reply.triggers.map(t => `<span class="trigger-tag">${escHtml(t)}</span>`).join('')}
          </div>
          <div class="reply-response">"${escHtml(reply.text)}"</div>
          <div class="reply-scope-badge">📦 ${escHtml(scopeLabel)}</div>
        </div>
        <div class="msg-actions">
          <label class="toggle toggle-sm">
            <input type="checkbox" class="reply-toggle" ${reply.active ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
          <button class="btn-icon-tiny reply-edit" title="Editar">✏</button>
          <button class="btn-icon-tiny danger reply-delete" title="Excluir">🗑</button>
        </div>
      </div>
    `;
    item.querySelector('.reply-toggle').addEventListener('change', async (e) => {
      reply.active = e.target.checked;
      item.classList.toggle('active-item', reply.active);
      const data = await store.get('autoResponses');
      const rs = (data.autoResponses || []).map(r => r.id === reply.id ? { ...r, active: reply.active } : r);
      await store.set({ autoResponses: rs });
    });
    item.querySelector('.reply-edit').addEventListener('click', () => {
      el('replyForm').style.display = 'block';
      el('replyTriggers').value = reply.triggers.join(', ');
      el('replyText').value = reply.text;
      el('replyScope').value = reply.scope;
      state.editingReplyId = reply.id;
      el('btnSaveReply').textContent = 'Atualizar regra';
      el('replyForm').scrollIntoView({ behavior: 'smooth' });
    });
    item.querySelector('.reply-delete').addEventListener('click', async () => {
      const data = await store.get('autoResponses');
      const rs = (data.autoResponses || []).filter(r => r.id !== reply.id);
      await store.set({ autoResponses: rs });
      renderReplyList(rs);
    });
    list.appendChild(item);
  });
}

function renderCartMsgList(msgs) {
  const list = el('cartMsgList');
  list.innerHTML = '';
  if (!msgs.length) {
    list.innerHTML = '<div style="color:var(--text-3);font-size:11px;text-align:center;padding:12px 0">Nenhum aviso cadastrado</div>';
    return;
  }
  msgs.forEach(msg => {
    const item = document.createElement('div');
    item.className = 'msg-item' + (msg.active ? ' active-item' : '');
    item.innerHTML = `
      <span class="msg-text">${escHtml(msg.text)}</span>
      <div class="msg-actions">
        <label class="toggle toggle-sm">
          <input type="checkbox" class="cart-toggle" ${msg.active ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-icon-tiny danger cart-delete" title="Excluir">🗑</button>
      </div>
    `;
    item.querySelector('.cart-toggle').addEventListener('change', async (e) => {
      msg.active = e.target.checked;
      item.classList.toggle('active-item', msg.active);
      const data = await store.get('cartAlertMessages');
      const ms = (data.cartAlertMessages || []).map(m => m.id === msg.id ? { ...m, active: msg.active } : m);
      await store.set({ cartAlertMessages: ms });
    });
    item.querySelector('.cart-delete').addEventListener('click', async () => {
      const data = await store.get('cartAlertMessages');
      const ms = (data.cartAlertMessages || []).filter(m => m.id !== msg.id);
      await store.set({ cartAlertMessages: ms });
      renderCartMsgList(ms);
    });
    list.appendChild(item);
  });
}

// ═════════════════════════════════════════════════════════════
//  ABA 4: AJUSTES
// ═════════════════════════════════════════════════════════════
function initAjustesTab() {
  // ── Licença ───────────────────────────────────────────────
  el('btnToggleLicenseKey').addEventListener('click', () => {
    const input = el('licenseKeyInput');
    if (input.type === 'password') {
      input.type = 'text';
      el('btnToggleLicenseKey').textContent = '🙈';
    } else {
      input.type = 'password';
      el('btnToggleLicenseKey').textContent = '👁';
    }
  });
  el('licenseKeyInput').addEventListener('change', async (e) => {
    await store.set({ licenseKey: e.target.value });
  });
  el('btnActivateLicense').addEventListener('click', async () => {
    const key = el('licenseKeyInput').value.trim();
    if (!key) { showToast('⚠ Digite a chave de licença', 'warn'); return; }
    // Fase 1: sempre ativo (mockado)
    el('licenseBadge').textContent = 'Ativa';
    el('licenseBadge').className = 'badge badge-active';
    await store.set({ licenseActive: true, licenseKey: key });
    showToast('✓ Licença ativada (modo demo)');
  });

  // ── Guardião anti-ban ─────────────────────────────────────
  el('toggleGuardian').addEventListener('change', async (e) => {
    const on = e.target.checked;
    toggleCollapsible('guardianForm', on);
    await store.set({ guardianEnabled: on });
  });
  el('guardianAction').addEventListener('change', async (e) => {
    await store.set({ guardianAction: e.target.value });
  });
  el('toggleGuardianWait').addEventListener('change', async (e) => {
    await store.set({ guardianWait: e.target.checked });
  });
  el('toggleGuardianAlarm').addEventListener('change', async (e) => {
    await store.set({ guardianAlarm: e.target.checked });
  });

  // ── Notificações ──────────────────────────────────────────
  ['notifProductPinned', 'notifStageAlerts', 'notifGuardianAlerts', 'notifChatResponse']
    .forEach(id => {
      el(id).addEventListener('change', async () => {
        const settings = {
          productPinned:  el('notifProductPinned').checked,
          stageAlerts:    el('notifStageAlerts').checked,
          guardianAlerts: el('notifGuardianAlerts').checked,
          chatResponse:   el('notifChatResponse').checked,
        };
        await store.set({ notificationSettings: settings });
        chrome.runtime.sendMessage({ action: 'SEND_NOTIFICATION', type: 'generic', title: 'AutoLiveShop', message: 'Configurações de notificação salvas' }).catch(() => {});
      });
    });
}

// ═════════════════════════════════════════════════════════════
//  MODAL
// ═════════════════════════════════════════════════════════════
let _modalCallback = null;
function initModal() {
  el('modalCancel').addEventListener('click', () => {
    el('modalOverlay').style.display = 'none';
    _modalCallback = null;
  });
  el('modalConfirm').addEventListener('click', () => {
    el('modalOverlay').style.display = 'none';
    if (_modalCallback) _modalCallback();
    _modalCallback = null;
  });
  el('modalOverlay').addEventListener('click', (e) => {
    if (e.target === el('modalOverlay')) {
      el('modalOverlay').style.display = 'none';
      _modalCallback = null;
    }
  });
}

function showModal(title, body, onConfirm) {
  el('modalTitle').textContent = title;
  el('modalBody').textContent = body;
  el('modalOverlay').style.display = 'flex';
  _modalCallback = onConfirm;
}

// ═════════════════════════════════════════════════════════════
//  EMOJI PICKER
// ═════════════════════════════════════════════════════════════
function initEmojiPicker(btnId, pickerId, inputId) {
  const btn    = el(btnId);
  const picker = el(pickerId);
  const input  = el(inputId);

  // Render individual clickable spans
  const emojis = picker.textContent.trim().split(/\s+/);
  picker.innerHTML = '';
  emojis.forEach(emoji => {
    const span = document.createElement('span');
    span.className = 'emoji-char';
    span.textContent = emoji;
    span.addEventListener('click', () => {
      input.value += emoji;
      input.focus();
    });
    picker.appendChild(span);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target) && e.target !== btn) {
      picker.classList.remove('open');
    }
  });
}

// ═════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═════════════════════════════════════════════════════════════
let _toastTimeout = null;
function showToast(msg, type = 'success') {
  let toast = document.getElementById('toastMsg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-card-alt);
      border: 1px solid var(--border-light);
      color: var(--text-1);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      z-index: 999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      transition: opacity 0.3s;
      white-space: nowrap;
      max-width: 90%;
      text-align: center;
    `;
    document.body.appendChild(toast);
  }
  if (type === 'warn') toast.style.borderColor = 'rgba(239,68,68,0.5)';
  else toast.style.borderColor = 'rgba(20,184,166,0.4)';
  toast.textContent = msg;
  toast.style.opacity = '1';
  if (_toastTimeout) clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ═════════════════════════════════════════════════════════════
//  MESSAGE LISTENER (from background)
// ═════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'AUTO_CLOSE_TRIGGERED') {
    showToast('⚠️ Encerramento automático acionado!', 'warn');
  }
  if (msg.action === 'REPIN_TRIGGERED') {
    showToast('📌 Produto refixado');
  }
  if (msg.action === 'SEND_CHAT_MESSAGE') {
    showToast('💬 Mensagem enviada: ' + msg.text.substring(0, 30));
  }
});

// ═════════════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════════════
function el(id) { return document.getElementById(id); }

function setEl(id, props) {
  const element = el(id);
  if (element) Object.assign(element, props);
}

function pad(n) { return String(n).padStart(2, '0'); }

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openCollapsible(id) {
  const el_ = document.getElementById(id);
  if (el_) el_.classList.add('open');
}

function closeCollapsible(id) {
  const el_ = document.getElementById(id);
  if (el_) el_.classList.remove('open');
}

function toggleCollapsible(id, open) {
  if (open) openCollapsible(id);
  else closeCollapsible(id);
}
