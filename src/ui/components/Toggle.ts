// ============================================================
// Copilo Live Shop V2 — Toggle Component
// ============================================================

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
