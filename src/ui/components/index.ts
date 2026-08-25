// ============================================================
// Copilo Live Shop V2 — UI Components (Toggle, Badge, MetricCard)
// ============================================================

import { escHtml } from '@/shared/utils';

export interface ToggleOptions {
  id?: string;
  checked?: boolean;
  small?: boolean;
  onChange?: (checked: boolean) => void;
}

export function createToggle(options: ToggleOptions = {}): HTMLElement {
  const label = document.createElement('label');
  label.className = `als-toggle ${options.small ? 'als-toggle-sm' : ''}`;

  const input = document.createElement('input');
  input.type = 'checkbox';
  if (options.id) input.id = options.id;
  input.checked = !!options.checked;

  const slider = document.createElement('span');
  slider.className = 'als-toggle-slider';

  if (options.onChange) {
    input.addEventListener('change', () => options.onChange!(input.checked));
  }

  label.appendChild(input);
  label.appendChild(slider);
  return label;
}

export interface BadgeOptions {
  text: string;
  variant?: 'free' | 'pro' | 'premium' | 'active' | 'detecting' | 'ended' | 'error';
  id?: string;
}

export function createBadge(options: BadgeOptions): HTMLElement {
  const span = document.createElement('span');
  if (options.id) span.id = options.id;
  span.className = `als-badge als-badge-${options.variant || 'free'}`;
  span.textContent = options.text;
  return span;
}

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
