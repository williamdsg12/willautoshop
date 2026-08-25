// ============================================================
// Copilo Live Shop V2 — MetricCard Component
// ============================================================

import { escHtml } from '@/shared/utils';

export interface MetricCardOptions {
  label: string;
  value: string | number;
  sub?: string;
  idValue?: string;
}

export function createMetricCard(options: MetricCardOptions): HTMLElement {
  const card = document.createElement('div');
  card.className = 'als-metric';

  card.innerHTML = `
    <div class="als-metric-label">${escHtml(options.label)}</div>
    <div class="als-metric-value" ${options.idValue ? `id="${options.idValue}"` : ''}>${escHtml(String(options.value))}</div>
    ${options.sub ? `<div class="als-metric-sub">${escHtml(options.sub)}</div>` : ''}
  `;

  return card;
}
