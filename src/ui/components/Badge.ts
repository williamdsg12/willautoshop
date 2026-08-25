// ============================================================
// Copilo Live Shop V2 — Badge Component
// ============================================================

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
