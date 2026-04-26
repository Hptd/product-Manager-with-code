import { useEffect, useRef, useState, useCallback } from 'react';
import {
  updatePreviewTranslation,
  resetPreviewForElement,
  applyEditingStyles,
  resetEditingStyles,
  hasPreviewState
} from '../utils/previewState';

// ==================== 类型定义 ====================

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelectorMode = 'select' | 'move' | 'resize' | 'describe';

export type UISelectorInfo = {
  id: string;
  tag: string;
  classList: string[];
  text?: string;
  rect: Rect;

  selector?: string;
  domPath?: string;
  cssSelector?: string;

  ariaLabel?: string;
  dataTestId?: string;

  outerHTML?: string;
  innerHTML?: string;
  attributes?: Record<string, string>;
  styles?: Record<string, string>;

  childrenCount?: number;
  parentTag?: string;
};

export type MoveIntent = {
  type: 'move';
  widget_id: string;
  widget_path: string;
  widget_type: string;
  before: Rect;
  after: Rect;
};

export type ResizeIntent = {
  type: 'resize';
  widget_id: string;
  widget_path: string;
  widget_type: string;
  before: Rect;
  after: Rect;
};

export type DescribeIntent = {
  type: 'describe';
  widget_id: string;
  widget_path: string;
  widget_type: string;
  description: string;
};

export type UIIntent = MoveIntent | ResizeIntent | DescribeIntent;

export type HoverElementInfo = UISelectorInfo & {
  mouseX: number;
  mouseY: number;
};

// ==================== 工具函数 ====================

function getComponentId(element: Element): string {
  const baseId = element.id ||
    element.getAttribute('data-testid') ||
    element.getAttribute('data-slot') ||
    `${element.tagName.toLowerCase()}${element.className ? '.' + (element.className as string).split(' ')[0] : ''}`;
  return baseId || `elem-${Math.random().toString(36).substr(2, 9)}`;
}

function isVisibleElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0';
}

function getElementRect(element: Element, iframe: HTMLIFrameElement): Rect {
  const elementRect = element.getBoundingClientRect();
  const iframeRect = iframe.getBoundingClientRect();
  return {
    x: elementRect.left + iframeRect.left,
    y: elementRect.top + iframeRect.top,
    width: elementRect.width,
    height: elementRect.height
  };
}

function buildDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.tagName) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const firstClass = (current.className as string).split(' ')[0];
      if (firstClass) {
        selector += `.${firstClass}`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function buildCssSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.tagName) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    } else if (current.className && typeof current.className === 'string' && (current.className as string).trim()) {
      const classes = (current.className as string).split(' ').filter(c => c).slice(0, 2);
      classes.forEach(cls => {
        selector += `.${cls}`;
      });
    }
    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function getElementAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (attr.name !== 'class' && attr.name !== 'style') {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

function getElementStyles(element: Element): Record<string, string> {
  const styles: Record<string, string> = {};
  const computed = window.getComputedStyle(element);
  const keyProps = [
    'display', 'position', 'width', 'height',
    'top', 'right', 'bottom', 'left',
    'margin', 'padding', 'border',
    'flex', 'grid', 'gap',
    'font-size', 'font-weight', 'color',
    'background', 'background-color',
    'border-radius', 'box-shadow',
    'z-index', 'opacity', 'visibility',
    'overflow', 'cursor'
  ];

  keyProps.forEach(prop => {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'auto' && value !== 'normal') {
      styles[prop] = value;
    }
  });

  return styles;
}

function getModeColor(mode: SelectorMode): string {
  switch (mode) {
    case 'select': return 'rgba(33, 150, 243, 0.3)';
    case 'move': return 'rgba(76, 175, 80, 0.3)';
    case 'resize': return 'rgba(255, 152, 0, 0.3)';
    case 'describe': return 'rgba(156, 39, 176, 0.3)';
    default: return 'rgba(33, 150, 243, 0.3)';
  }
}

function getBorderColor(mode: SelectorMode): string {
  switch (mode) {
    case 'select': return '#2196F3';
    case 'move': return '#4CAF50';
    case 'resize': return '#FF9800';
    case 'describe': return '#9C27B0';
    default: return '#2196F3';
  }
}

// ==================== 拖拽覆盖层工具 ====================

function createDragOverlay(cursorStyle?: string): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'ui-selector-drag-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100002;
    cursor: ${cursorStyle || 'inherit'};
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function removeDragOverlay() {
  const overlay = document.querySelector('.ui-selector-drag-overlay');
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

// ==================== 主组件 ====================

interface UISelectorOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onElementSelect?: (info: UISelectorInfo) => void;
  onElementHover?: (info: HoverElementInfo | null) => void;
  onIntentGenerate?: (intent: UIIntent) => void;
  enabled?: boolean;
  mode?: SelectorMode;
}

export function UISelectorOverlay({
  iframeRef,
  onElementSelect,
  onElementHover,
  onIntentGenerate,
  enabled = true,
  mode = 'select'
}: UISelectorOverlayProps) {
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [elementInfo, setElementInfo] = useState<UISelectorInfo | null>(null);
  const [highlightRect, setHighlightRect] = useState<Rect | null>(null);
  const [hoverElement, setHoverElement] = useState<Element | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverElementInfo | null>(null);
  const isHovering = useRef(false);

  // resize frame 引用
  const resizeFrameRef = useRef<HTMLDivElement | null>(null);
  // 拖拽状态引用
  const isDraggingRef = useRef(false);

  // 记录 before rect
  const beforeRectRef = useRef<Rect | null>(null);
  const originalRectRef = useRef<Rect | null>(null);

  // 构建元素信息
  const buildElementInfo = useCallback((element: Element, iframe: HTMLIFrameElement): UISelectorInfo => {
    const iframeWindow = iframe.contentWindow;
    const computed = iframeWindow?.getComputedStyle(element as HTMLElement);

    return {
      id: getComponentId(element),
      tag: element.tagName.toLowerCase(),
      classList: Array.from((element as HTMLElement).classList),
      text: element.textContent?.slice(0, 100).trim(),
      rect: getElementRect(element, iframe),

      selector: element.id ? `#${element.id}` : element.tagName.toLowerCase(),
      domPath: buildDomPath(element),
      cssSelector: buildCssSelector(element),

      ariaLabel: element.getAttribute('aria-label') || undefined,
      dataTestId: element.getAttribute('data-testid') || undefined,

      outerHTML: element.outerHTML,
      innerHTML: element.innerHTML,
      attributes: getElementAttributes(element),
      styles: computed ? (() => {
        const s: Record<string, string> = {};
        const keyProps = ['display', 'position', 'width', 'height', 'top', 'right', 'bottom', 'left',
          'margin', 'padding', 'font-size', 'font-weight', 'color', 'background-color', 'border-radius',
          'transform', 'box-sizing', 'z-index'];
        keyProps.forEach(prop => {
          const value = computed.getPropertyValue(prop);
          if (value && value !== 'none' && value !== 'auto' && value !== 'normal') {
            s[prop] = value;
          }
        });
        return s;
      })() : getElementStyles(element),

      childrenCount: element.children.length,
      parentTag: element.parentElement?.tagName.toLowerCase()
    };
  }, []);

  // 清理 resize frame
  const cleanupResizeFrame = useCallback(() => {
    if (resizeFrameRef.current && resizeFrameRef.current.parentNode) {
      resizeFrameRef.current.parentNode.removeChild(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
  }, []);

  // 恢复已选元素的编辑样式
  const restoreSelectedElement = useCallback((element: Element | null) => {
    if (element instanceof HTMLElement) {
      if (hasPreviewState(element)) {
        resetPreviewForElement(element);
      }
      resetEditingStyles(element);
    }
  }, []);

  // ==================== 悬停预览 - 所有模式都支持（resize 除外） ====================
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!enabled || !iframeRef.current) return;
    if (mode === 'resize') return;
    if (isDraggingRef.current) return;

    event.stopImmediatePropagation();

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      setHoverElement(null);
      setHoverInfo(null);
      onElementHover?.(null);
      isHovering.current = false;
      return;
    }

    const iframeRect = iframe.getBoundingClientRect();
    const mouseX = iframeRect.left + event.clientX;
    const mouseY = iframeRect.top + event.clientY;
    const element = iframeDoc.elementFromPoint(event.clientX, event.clientY);

    if (element && isVisibleElement(element as HTMLElement)) {
      if (element !== hoverElement) {
        setHoverElement(element);
        const info = buildElementInfo(element, iframe);
        const hoverInfo: HoverElementInfo = { ...info, mouseX, mouseY };
        setHoverInfo(hoverInfo);
        onElementHover?.(hoverInfo);

        // move 模式下，如果没有已选元素，悬停时显示高亮
        // 如果有已选元素，高亮保持选中元素的位置
        if (mode !== 'move' || !selectedElement) {
          setHighlightRect(info.rect);
        }
        isHovering.current = true;
      }
    } else {
      setHoverElement(null);
      setHoverInfo(null);
      onElementHover?.(null);
      if (mode !== 'move' || !selectedElement) {
        setHighlightRect(null);
      }
      isHovering.current = false;
    }
  }, [enabled, iframeRef, mode, hoverElement, selectedElement, buildElementInfo, onElementHover]);

  // ==================== 点击选择（select 模式） ====================
  const handleClick = useCallback((event: MouseEvent) => {
    if (!enabled || !iframeRef.current) return;
    if (isDraggingRef.current) return;
    // move 模式的点击由 mousedown 处理，不走这里
    if (mode === 'move') return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    const element = iframeDoc.elementFromPoint(event.clientX, event.clientY);

    if (element && isVisibleElement(element as HTMLElement)) {
      const info = buildElementInfo(element, iframe);

      restoreSelectedElement(selectedElement);

      setSelectedElement(element);
      setElementInfo(info);
      setHighlightRect(info.rect);
      originalRectRef.current = info.rect;
      beforeRectRef.current = null;

      onElementSelect?.(info);
      isHovering.current = false;
    }
  }, [enabled, iframeRef, mode, buildElementInfo, onElementSelect, selectedElement, restoreSelectedElement]);

  // ==================== Move 模式：点击选择 + 长按拖动 ====================
  useEffect(() => {
    if (!enabled || mode !== 'move' || !iframeRef.current) {
      return;
    }

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    // 区分点击和拖拽的阈值
    const DRAG_THRESHOLD = 4;
    let mouseDownX = 0;
    let mouseDownY = 0;
    let mouseDownTarget: Element | null = null;
    let isPotentialDrag = false;
    let hasMoved = false;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (isDraggingRef.current) return;

      const target = e.target as HTMLElement;
      const element = iframeDoc.elementFromPoint(e.clientX, e.clientY);
      if (!element || !isVisibleElement(element as HTMLElement)) return;

      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
      mouseDownTarget = element;
      isPotentialDrag = true;
      hasMoved = false;

      // 如果点击的就是已选元素（或其子元素），准备拖拽
      if (selectedElement && (selectedElement as HTMLElement).contains(element)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onMouseMoveInIframe = (e: MouseEvent) => {
      if (!isPotentialDrag || isDraggingRef.current) return;

      const dx = e.clientX - mouseDownX;
      const dy = e.clientY - mouseDownY;

      // 如果有已选元素且鼠标在其上，检测是否超出拖拽阈值
      if (selectedElement && mouseDownTarget && (selectedElement as HTMLElement).contains(mouseDownTarget)) {
        if (!hasMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          // 超出阈值 → 开始拖拽
          hasMoved = true;
          isDraggingRef.current = true;

          const element = selectedElement as HTMLElement;
          element.style.cursor = 'grabbing';

          // 记录 before rect
          const iframeRect = iframe.getBoundingClientRect();
          const elRect = element.getBoundingClientRect();
          const beforeRect: Rect = {
            x: elRect.left + iframeRect.left,
            y: elRect.top + iframeRect.top,
            width: elRect.width,
            height: elRect.height
          };
          beforeRectRef.current = beforeRect;

          // 创建覆盖层，捕获父文档事件
          createDragOverlay('grabbing');

          let lastClientX = e.clientX;
          let lastClientY = e.clientY;

          const onDocMouseMove = (ev: MouseEvent) => {
            if (!isDraggingRef.current) return;
            ev.preventDefault();

            const moveDx = ev.clientX - lastClientX;
            const moveDy = ev.clientY - lastClientY;
            lastClientX = ev.clientX;
            lastClientY = ev.clientY;

            if (moveDx === 0 && moveDy === 0) return;

            updatePreviewTranslation(element, moveDx, moveDy);

            const newRect = getElementRect(element, iframe);
            setHighlightRect(newRect);
          };

          const onDocMouseUp = (ev: MouseEvent) => {
            if (!isDraggingRef.current) return;
            ev.preventDefault();

            isDraggingRef.current = false;
            element.style.cursor = 'grab';

            document.removeEventListener('mousemove', onDocMouseMove);
            document.removeEventListener('mouseup', onDocMouseUp);
            removeDragOverlay();

            const afterRect = getElementRect(element, iframe);
            setHighlightRect(afterRect);

            if (elementInfo && beforeRectRef.current) {
              const intent: MoveIntent = {
                type: 'move',
                widget_id: elementInfo.id,
                widget_path: elementInfo.domPath || '',
                widget_type: elementInfo.tag,
                before: beforeRectRef.current,
                after: afterRect
              };
              onIntentGenerate?.(intent);
            }
          };

          document.addEventListener('mousemove', onDocMouseMove);
          document.addEventListener('mouseup', onDocMouseUp);
        }

        if (hasMoved) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (isDraggingRef.current) return;

      if (isPotentialDrag && !hasMoved) {
        // 没有移动 → 视为点击，选择元素
        const element = iframeDoc.elementFromPoint(e.clientX, e.clientY);
        if (element && isVisibleElement(element as HTMLElement)) {
          e.preventDefault();
          e.stopPropagation();

          const info = buildElementInfo(element, iframe);

          // 恢复之前选中元素的样式
          restoreSelectedElement(selectedElement);

          // 如果点击了不同的元素，先恢复之前的编辑样式
          if (selectedElement && selectedElement !== element) {
            if (hasPreviewState(selectedElement as HTMLElement)) {
              resetPreviewForElement(selectedElement as HTMLElement);
            }
            resetEditingStyles(selectedElement as HTMLElement);
          }

          setSelectedElement(element);
          setElementInfo(info);
          setHighlightRect(info.rect);
          originalRectRef.current = info.rect;
          beforeRectRef.current = null;

          // 应用移动编辑样式
          applyEditingStyles(element as HTMLElement, 'move');

          onElementSelect?.(info);
          isHovering.current = false;
        }
      }

      isPotentialDrag = false;
      hasMoved = false;
      mouseDownTarget = null;
    };

    iframeDoc.addEventListener('mousedown', onMouseDown, true);
    iframeDoc.addEventListener('mousemove', onMouseMoveInIframe, true);
    iframeDoc.addEventListener('mouseup', onMouseUp, true);

    return () => {
      iframeDoc.removeEventListener('mousedown', onMouseDown, true);
      iframeDoc.removeEventListener('mousemove', onMouseMoveInIframe, true);
      iframeDoc.removeEventListener('mouseup', onMouseUp, true);
      isDraggingRef.current = false;
      isPotentialDrag = false;
      removeDragOverlay();
    };
  }, [enabled, mode, selectedElement, elementInfo, iframeRef, onIntentGenerate, buildElementInfo, onElementSelect, restoreSelectedElement]);

  // ==================== Resize 行为 - 手动实现 ====================
  useEffect(() => {
    if (!enabled || mode !== 'resize' || !selectedElement || !iframeRef.current) {
      return;
    }

    const iframe = iframeRef.current;
    const element = selectedElement as HTMLElement;

    applyEditingStyles(element, 'resize');

    // 记录 before rect
    const iframeRect = iframe.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();
    const beforeRect: Rect = {
      x: elRect.left + iframeRect.left,
      y: elRect.top + iframeRect.top,
      width: elRect.width,
      height: elRect.height
    };
    beforeRectRef.current = beforeRect;

    // 在父文档中创建 resize frame
    let overlayContainer = document.querySelector('.ui-selector-overlay-container-external') as HTMLElement;
    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.className = 'ui-selector-overlay-container-external';
      overlayContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 99999;';
      document.body.appendChild(overlayContainer);
    }

    const resizeFrame = document.createElement('div');
    resizeFrame.className = 'ui-selector-resize-frame';
    resizeFrame.style.cssText = `
      position: fixed;
      left: ${beforeRect.x}px;
      top: ${beforeRect.y}px;
      width: ${beforeRect.width}px;
      height: ${beforeRect.height}px;
      pointer-events: auto;
      cursor: nwse-resize;
      z-index: 100001;
      border: 2px solid #FF9800;
      background: rgba(255, 152, 0, 0.1);
    `;

    const edges = [
      { cls: 'nw', style: 'top:-4px;left:-4px;cursor:nw-resize;', edge: 'nw' },
      { cls: 'ne', style: 'top:-4px;right:-4px;cursor:ne-resize;', edge: 'ne' },
      { cls: 'sw', style: 'bottom:-4px;left:-4px;cursor:sw-resize;', edge: 'sw' },
      { cls: 'se', style: 'bottom:-4px;right:-4px;cursor:se-resize;', edge: 'se' },
      { cls: 'n', style: 'top:-4px;left:50%;transform:translateX(-50%);cursor:n-resize;', edge: 'n' },
      { cls: 's', style: 'bottom:-4px;left:50%;transform:translateX(-50%);cursor:s-resize;', edge: 's' },
      { cls: 'w', style: 'top:50%;left:-4px;transform:translateY(-50%);cursor:w-resize;', edge: 'w' },
      { cls: 'e', style: 'top:50%;right:-4px;transform:translateY(-50%);cursor:e-resize;', edge: 'e' }
    ];
    edges.forEach(({ cls, style, edge }) => {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-handle-${cls}`;
      handle.setAttribute('data-resize-edge', edge);
      handle.style.cssText = `position:absolute;width:10px;height:10px;background:#FF9800;border-radius:2px;pointer-events:auto;${style}`;
      resizeFrame.appendChild(handle);
    });

    overlayContainer.appendChild(resizeFrame);
    resizeFrameRef.current = resizeFrame;

    type EdgeType = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

    let activeEdge: EdgeType | null = null;
    let startPointerX = 0;
    let startPointerY = 0;
    let startFrameLeft = beforeRect.x;
    let startFrameTop = beforeRect.y;
    let startFrameWidth = beforeRect.width;
    let startFrameHeight = beforeRect.height;
    let startElTranslateX = 0;
    let startElTranslateY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      const edgeAttr = target.getAttribute('data-resize-edge');
      activeEdge = (edgeAttr as EdgeType) || 'se';

      startPointerX = e.clientX;
      startPointerY = e.clientY;
      startFrameLeft = parseFloat(resizeFrame.style.left);
      startFrameTop = parseFloat(resizeFrame.style.top);
      startFrameWidth = parseFloat(resizeFrame.style.width);
      startFrameHeight = parseFloat(resizeFrame.style.height);

      const previewState = (element as any)._previewState;
      if (previewState) {
        startElTranslateX = previewState.x || 0;
        startElTranslateY = previewState.y || 0;
      } else {
        startElTranslateX = 0;
        startElTranslateY = 0;
      }

      isDraggingRef.current = true;

      const cursorMap: Record<string, string> = {
        n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
        ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize'
      };
      createDragOverlay(cursorMap[activeEdge] || 'nwse-resize');

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current || !activeEdge) return;
        ev.preventDefault();

        const deltaX = ev.clientX - startPointerX;
        const deltaY = ev.clientY - startPointerY;
        const edge = activeEdge;

        let newLeft = startFrameLeft;
        let newTop = startFrameTop;
        let newWidth = startFrameWidth;
        let newHeight = startFrameHeight;

        if (edge.includes('e')) {
          newWidth = Math.max(30, startFrameWidth + deltaX);
        }
        if (edge.includes('w')) {
          const possibleWidth = Math.max(30, startFrameWidth - deltaX);
          newLeft = startFrameLeft + (startFrameWidth - possibleWidth);
          newWidth = possibleWidth;
        }
        if (edge.includes('s')) {
          newHeight = Math.max(30, startFrameHeight + deltaY);
        }
        if (edge.includes('n')) {
          const possibleHeight = Math.max(30, startFrameHeight - deltaY);
          newTop = startFrameTop + (startFrameHeight - possibleHeight);
          newHeight = possibleHeight;
        }

        const translateDeltaX = newLeft - startFrameLeft;
        const translateDeltaY = newTop - startFrameTop;
        const totalTranslateX = startElTranslateX + translateDeltaX;
        const totalTranslateY = startElTranslateY + translateDeltaY;

        const baseTransform = element.style.transform.replace(/translate\([^)]*\)/g, '').trim();
        element.style.transform = baseTransform
          ? `${baseTransform} translate(${totalTranslateX}px, ${totalTranslateY}px)`
          : `translate(${totalTranslateX}px, ${totalTranslateY}px)`;
        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;

        resizeFrame.style.left = `${newLeft}px`;
        resizeFrame.style.top = `${newTop}px`;
        resizeFrame.style.width = `${newWidth}px`;
        resizeFrame.style.height = `${newHeight}px`;

        const newRect: Rect = { x: newLeft, y: newTop, width: newWidth, height: newHeight };
        setHighlightRect(newRect);
      };

      const handleMouseUp = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        ev.preventDefault();

        isDraggingRef.current = false;
        activeEdge = null;

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        removeDragOverlay();

        const afterIframeRect = iframe.getBoundingClientRect();
        const afterElRect = element.getBoundingClientRect();
        const afterRect: Rect = {
          x: afterElRect.left + afterIframeRect.left,
          y: afterElRect.top + afterIframeRect.top,
          width: afterElRect.width,
          height: afterElRect.height
        };

        const translateDeltaX = parseFloat(resizeFrame.style.left) - beforeRect.x;
        const translateDeltaY = parseFloat(resizeFrame.style.top) - beforeRect.y;

        const existingState = (element as any)._previewState;
        if (!existingState) {
          (element as any)._previewState = {
            baseTransform: '',
            baseWidth: element.style.width,
            baseHeight: element.style.height,
            basePosition: element.style.position,
            x: translateDeltaX,
            y: translateDeltaY
          };
        } else {
          existingState.x = translateDeltaX;
          existingState.y = translateDeltaY;
        }

        setHighlightRect(afterRect);

        if (elementInfo && beforeRectRef.current) {
          const intent: ResizeIntent = {
            type: 'resize',
            widget_id: elementInfo.id,
            widget_path: elementInfo.domPath || '',
            widget_type: elementInfo.tag,
            before: beforeRectRef.current,
            after: afterRect
          };
          onIntentGenerate?.(intent);
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    resizeFrame.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizeFrame.removeEventListener('mousedown', handleMouseDown);
      if (resizeFrame.parentNode) {
        resizeFrame.parentNode.removeChild(resizeFrame);
      }
      resizeFrameRef.current = null;
      isDraggingRef.current = false;
      removeDragOverlay();
    };
  }, [enabled, mode, selectedElement, elementInfo, iframeRef, onIntentGenerate]);

  // 模式切换时清理
  useEffect(() => {
    if (mode !== 'resize') {
      cleanupResizeFrame();
    }
    // 模式切换时也恢复选中元素的编辑样式
    if (selectedElement instanceof HTMLElement) {
      if (hasPreviewState(selectedElement)) {
        resetPreviewForElement(selectedElement);
      }
      resetEditingStyles(selectedElement);
    }
  }, [mode, cleanupResizeFrame, selectedElement]);

  // 组件卸载时恢复所有样式
  useEffect(() => {
    return () => {
      restoreSelectedElement(selectedElement);
      cleanupResizeFrame();
      removeDragOverlay();
    };
  }, []);

  // 监听 iframe 加载完成后添加事件监听
  useEffect(() => {
    if (!iframeRef.current || !enabled) return;

    const iframe = iframeRef.current;

    const addListeners = () => {
      if (!iframe.contentDocument) return;
      iframe.contentDocument.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
      iframe.contentDocument.addEventListener('click', handleClick, { capture: true });
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      addListeners();
    } else {
      iframe.addEventListener('load', addListeners);
    }

    return () => {
      if (iframe.contentDocument) {
        iframe.contentDocument.removeEventListener('mousemove', handleMouseMove, { capture: true } as any);
        iframe.contentDocument.removeEventListener('click', handleClick, { capture: true } as any);
      }
    };
  }, [iframeRef, enabled, handleMouseMove, handleClick]);

  // 渲染高亮覆盖层 - 在父文档中使用 fixed 定位
  useEffect(() => {
    if (!iframeRef.current) return;

    let overlayContainer = document.querySelector('.ui-selector-overlay-container-external') as HTMLElement;
    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.className = 'ui-selector-overlay-container-external';
      overlayContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 99999;';
      document.body.appendChild(overlayContainer);
    }

    if (highlightRect && (elementInfo || hoverInfo)) {
      const oldHighlights = overlayContainer.querySelectorAll('.ui-selector-highlight-external');
      oldHighlights.forEach(el => el.remove());

      const highlight = document.createElement('div');
      highlight.className = 'ui-selector-highlight-external';

      // move 模式：悬停时用较淡样式，选中元素用实线
      const isSelected = mode === 'move' && elementInfo && selectedElement;
      const isHoveringInMove = mode === 'move' && isHovering.current && hoverInfo && !isDraggingRef.current;

      let bgColor = getModeColor(mode);
      let borderStyle = 'dashed';

      if (mode === 'move') {
        if (isDraggingRef.current && selectedElement) {
          bgColor = 'rgba(76, 175, 80, 0.4)';
          borderStyle = 'solid';
        } else if (isSelected) {
          bgColor = 'rgba(76, 175, 80, 0.25)';
          borderStyle = 'solid';
        } else if (isHoveringInMove) {
          bgColor = 'rgba(76, 175, 80, 0.15)';
          borderStyle = 'dotted';
        }
      }

      if (isHovering.current && !elementInfo && mode === 'select') {
        bgColor = 'rgba(33, 150, 243, 0.2)';
        borderStyle = 'dotted';
      }

      highlight.style.cssText = `
        position: fixed;
        left: ${highlightRect.x}px;
        top: ${highlightRect.y}px;
        width: ${highlightRect.width}px;
        height: ${highlightRect.height}px;
        background-color: ${bgColor};
        border: 2px ${borderStyle} ${getBorderColor(mode)};
        pointer-events: none;
        z-index: 1000;
        transition: all 0.05s linear;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
      `;

      const modeLabel = document.createElement('div');
      modeLabel.className = 'ui-selector-mode-label-external';
      modeLabel.style.cssText = `
        position: absolute;
        top: -28px;
        left: 0;
        background-color: ${getBorderColor(mode)};
        color: white;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 4px 4px 0 0;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      const currentInfo = elementInfo || hoverInfo;
      modeLabel.textContent = `${mode.toUpperCase()} | ${currentInfo?.tag || 'unknown'} ${currentInfo?.id.slice(0, 25) || ''}${(currentInfo?.id.length || 0) > 25 ? '...' : ''}`;
      highlight.appendChild(modeLabel);

      // resize 模式下显示尺寸标签
      if (mode === 'resize') {
        const sizeLabel = document.createElement('div');
        sizeLabel.style.cssText = `
          position: absolute;
          bottom: -28px;
          right: 0;
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 4px 10px;
          font-size: 12px;
          border-radius: 4px;
          white-space: nowrap;
        `;
        sizeLabel.textContent = `${Math.round(highlightRect.width)} x ${Math.round(highlightRect.height)}`;
        highlight.appendChild(sizeLabel);
      }

      // move 模式下显示偏移标签
      if (mode === 'move' && beforeRectRef.current && elementInfo) {
        const deltaX = Math.round(highlightRect.x - beforeRectRef.current.x);
        const deltaY = Math.round(highlightRect.y - beforeRectRef.current.y);
        if (deltaX !== 0 || deltaY !== 0) {
          const offsetLabel = document.createElement('div');
          offsetLabel.style.cssText = `
            position: absolute;
            bottom: -28px;
            right: 0;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 10px;
            font-size: 12px;
            border-radius: 4px;
            white-space: nowrap;
          `;
          offsetLabel.textContent = `Δx: ${deltaX >= 0 ? '+' : ''}${deltaX}, Δy: ${deltaY >= 0 ? '+' : ''}${deltaY}`;
          highlight.appendChild(offsetLabel);
        }
      }

      overlayContainer.appendChild(highlight);
    } else if (!elementInfo && !hoverInfo) {
      const oldHighlights = overlayContainer.querySelectorAll('.ui-selector-highlight-external');
      oldHighlights.forEach(el => el.remove());
    }

    return () => {
      const highlights = overlayContainer?.querySelectorAll('.ui-selector-highlight-external');
      highlights?.forEach(el => el.remove());
    };
  }, [highlightRect, elementInfo, hoverInfo, mode, enabled, iframeRef, selectedElement]);

  // 暴露撤销方法
  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    (window as any).__uiSelectorUndo = () => {
      if (selectedElement instanceof HTMLElement) {
        const restoredRect = resetPreviewForElement(selectedElement);
        resetEditingStyles(selectedElement);

        const iframeRect = iframe.getBoundingClientRect();
        const viewportRect: Rect = {
          x: restoredRect.x + iframeRect.left,
          y: restoredRect.y + iframeRect.top,
          width: restoredRect.width,
          height: restoredRect.height
        };
        setHighlightRect(viewportRect);
        beforeRectRef.current = null;
      }
    };

    return () => {
      delete (window as any).__uiSelectorUndo;
    };
  }, [selectedElement, iframeRef]);

  return null;
}
