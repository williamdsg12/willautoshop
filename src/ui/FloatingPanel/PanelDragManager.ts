// ============================================================
// Copilo Live Shop V2 — Panel Drag Manager
// Gerencia arrastar e soltar (drag & drop) com fluidez no Shadow DOM
// ============================================================

import { PanelPositionManager } from './PanelPositionManager';

interface DragContext {
  isDragging: boolean;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
}

export class PanelDragManager {
  private panelEl: HTMLElement;
  private handleEl: HTMLElement;
  private positionMgr: PanelPositionManager;
  private dragCtx: DragContext = {
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  };

  constructor(
    panelElement: HTMLElement,
    handleElement: HTMLElement,
    positionManager: PanelPositionManager,
  ) {
    this.panelEl = panelElement;
    this.handleEl = handleElement;
    this.positionMgr = positionManager;

    this._bindEvents();
  }

  private _bindEvents(): void {
    this.handleEl.addEventListener('mousedown', this._onMouseDown);
  }

  private _onMouseDown = (e: MouseEvent): void => {
    // Ignora cliques em botões de ação do header (minimizar/fechar)
    if ((e.target as HTMLElement).closest('.als-icon-btn')) {
      return;
    }

    const rect = this.panelEl.getBoundingClientRect();
    this.dragCtx = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (!this.dragCtx.isDragging) return;

    const deltaX = e.clientX - this.dragCtx.startX;
    const deltaY = e.clientY - this.dragCtx.startY;

    const newX = this.dragCtx.startLeft + deltaX;
    const newY = this.dragCtx.startTop + deltaY;

    this.positionMgr.setPosition(newX, newY);
  };

  private _onMouseUp = (): void => {
    if (!this.dragCtx.isDragging) return;

    this.dragCtx.isDragging = false;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);

    this.positionMgr.savePosition().catch(() => {});
  };

  destroy(): void {
    this.handleEl.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }
}
