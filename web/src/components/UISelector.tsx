import { useEffect, useRef, useState, useCallback } from 'react';
import interact from 'interactjs';

// ==================== 类型定义 ====================

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelectorMode = 'select' | 'move' | 'resize' | 'describe';

// 增强的元素信息类型
export type UISelectorInfo = {
  // 基础信息
  id: string;
  tag: string;
  classList: string[];
  text?: string;
  rect: Rect;

  // 选择器和路径
  selector?: string;
  domPath?: string;
  cssSelector?: string;

  // 无障碍/测试属性
  ariaLabel?: string;
  dataTestId?: string;

  // 完整 HTML 信息
  outerHTML?: string;
  innerHTML?: string;
  attributes?: Record<string, string>;
  styles?: Record<string, string>;

  // 层级信息
  childrenCount?: number;
  parentTag?: string;
};

// Intent 类型
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

// 悬停元素信息
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
  // 获取元素相对于 iframe 视口的位置
  const elementRect = element.getBoundingClientRect();
  
  // 获取 iframe 相对于浏览器视口的位置
  const iframeRect = iframe.getBoundingClientRect();
  
  // 计算相对于浏览器视口的位置
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

function isClickInIframe(event: MouseEvent, iframe: HTMLIFrameElement): boolean {
  const rect = iframe.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
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
  const interactInstance = useRef<any>(null);
  const originalRect = useRef<Rect | null>(null);
  const isHovering = useRef(false);

  // 构建元素信息
  const buildElementInfo = useCallback((element: Element, iframe: HTMLIFrameElement): UISelectorInfo => {
    return {
      // 基础信息
      id: getComponentId(element),
      tag: element.tagName.toLowerCase(),
      classList: Array.from((element as HTMLElement).classList),
      text: element.textContent?.slice(0, 100).trim(),
      rect: getElementRect(element, iframe),
      
      // 选择器和路径
      selector: element.id ? `#${element.id}` : element.tagName.toLowerCase(),
      domPath: buildDomPath(element),
      cssSelector: buildCssSelector(element),
      
      // 无障碍/测试属性
      ariaLabel: element.getAttribute('aria-label') || undefined,
      dataTestId: element.getAttribute('data-testid') || undefined,
      
      // 完整 HTML 信息
      outerHTML: element.outerHTML,
      innerHTML: element.innerHTML,
      attributes: getElementAttributes(element),
      styles: getElementStyles(element),
      
      // 层级信息
      childrenCount: element.children.length,
      parentTag: element.parentElement?.tagName.toLowerCase()
    };
  }, []);

  // 处理鼠标移动 - 悬停预览（在 iframe 内部监听）
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!enabled || !iframeRef.current || mode !== 'select') return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument;
    
    if (!iframeDoc) {
      setHoverElement(null);
      setHoverInfo(null);
      onElementHover?.(null);
      isHovering.current = false;
      return;
    }

    // event.clientX/Y 在 iframe 内部是相对于 iframe 视口的
    // 需要加上 iframe 相对于浏览器视口的偏移
    const iframeRect = iframe.getBoundingClientRect();
    const mouseX = iframeRect.left + event.clientX;
    const mouseY = iframeRect.top + event.clientY;

    // 使用 iframe 内部的 elementFromPoint（使用 iframe 内部坐标）
    const element = iframeDoc.elementFromPoint(event.clientX, event.clientY);

    if (element && isVisibleElement(element as HTMLElement)) {
      // 只在元素变化时更新
      if (element !== hoverElement) {
        setHoverElement(element);

        const info = buildElementInfo(element, iframe);

        const hoverInfo: HoverElementInfo = {
          ...info,
          mouseX,
          mouseY
        };

        setHoverInfo(hoverInfo);
        onElementHover?.(hoverInfo);

        // 更新悬停高亮
        setHighlightRect(info.rect);
        isHovering.current = true;
      }
    } else {
      setHoverElement(null);
      setHoverInfo(null);
      onElementHover?.(null);
      setHighlightRect(null);
      isHovering.current = false;
    }
  }, [enabled, iframeRef, mode, hoverElement, buildElementInfo, onElementHover]);

  // 处理点击选择（在 iframe 内部监听）
  const handleClick = useCallback((event: MouseEvent) => {
    if (!enabled || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument;
    
    if (!iframeDoc) return;

    // 使用 iframe 内部的坐标系统
    const x = event.clientX;
    const y = event.clientY;

    // 使用 iframe 内部的 elementFromPoint
    const element = iframeDoc.elementFromPoint(x, y);

    if (element && isVisibleElement(element as HTMLElement)) {
      const info = buildElementInfo(element, iframe);

      setSelectedElement(element);
      setElementInfo(info);
      setHighlightRect(info.rect);
      originalRect.current = info.rect;

      onElementSelect?.(info);

      // 点击后保持高亮
      isHovering.current = false;
    }
  }, [enabled, iframeRef, buildElementInfo, onElementSelect]);

  // 初始化 interact.js 用于拖拽和缩放
  useEffect(() => {
    if (!enabled || !iframeRef.current || mode !== 'move' && mode !== 'resize') return;

    const iframe = iframeRef.current;

    const initInteract = () => {
      if (!iframe.contentDocument) return;

      const overlay = iframe.contentDocument.querySelector('.ui-selector-highlight');
      if (!overlay) return;

      if (interactInstance.current) {
        interactInstance.current.unset();
      }

      if (mode === 'move') {
        interactInstance.current = interact(overlay as any)
          .draggable({
            listeners: {
              move: (event: any) => {
                const newRect = {
                  ...originalRect.current!,
                  x: originalRect.current!.x + event.dx,
                  y: originalRect.current!.y + event.dy
                };
                setHighlightRect(newRect);

                if (selectedElement) {
                  (selectedElement as HTMLElement).style.transform = `translate(${event.dx}px, ${event.dy}px)`;
                  (selectedElement as HTMLElement).style.transition = 'none';
                }
              },
              end: (event: any) => {
                if (elementInfo && originalRect.current && selectedElement) {
                  const intent: MoveIntent = {
                    type: 'move',
                    widget_id: elementInfo.id,
                    widget_path: elementInfo.domPath || '',
                    widget_type: elementInfo.tag,
                    before: originalRect.current,
                    after: {
                      ...originalRect.current,
                      x: originalRect.current.x + event.dx,
                      y: originalRect.current.y + event.dy
                    }
                  };
                  onIntentGenerate?.(intent);
                }
              }
            },
            modifiers: [
              interact.modifiers.restrictRect({
                restriction: 'parent',
                endOnly: true
              })
            ]
          });
      } else if (mode === 'resize') {
        interactInstance.current = interact(overlay as any)
          .resizable({
            edges: { top: true, left: true, bottom: true, right: true },
            listeners: {
              move: (event: any) => {
                const newRect = {
                  x: event.rect.x,
                  y: event.rect.y,
                  width: event.rect.width,
                  height: event.rect.height
                };
                setHighlightRect(newRect);

                if (selectedElement) {
                  (selectedElement as HTMLElement).style.width = `${newRect.width}px`;
                  (selectedElement as HTMLElement).style.height = `${newRect.height}px`;
                  (selectedElement as HTMLElement).style.transition = 'none';
                }
              },
              end: (event: any) => {
                if (elementInfo && originalRect.current) {
                  const intent: ResizeIntent = {
                    type: 'resize',
                    widget_id: elementInfo.id,
                    widget_path: elementInfo.domPath || '',
                    widget_type: elementInfo.tag,
                    before: originalRect.current,
                    after: {
                      x: originalRect.current.x,
                      y: originalRect.current.y,
                      width: event.rect.width,
                      height: event.rect.height
                    }
                  };
                  onIntentGenerate?.(intent);
                }
              }
            },
            modifiers: [
              interact.modifiers.restrictSize({
                min: { width: 50, height: 50 },
                max: { width: 2000, height: 2000 }
              })
            ]
          });
      }
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      initInteract();
    } else {
      iframe.addEventListener('load', initInteract);
    }

    return () => {
      if (interactInstance.current) {
        interactInstance.current.unset();
        interactInstance.current = null;
      }
    };
  }, [enabled, iframeRef, mode, selectedElement, elementInfo, onIntentGenerate]);

  // 监听 iframe 加载完成后添加事件监听
  useEffect(() => {
    if (!iframeRef.current || !enabled) return;

    const iframe = iframeRef.current;

    const addListeners = () => {
      if (!iframe.contentDocument) return;
      
      // 使用 capture 阶段监听 mousemove 和 click
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
        iframe.contentDocument.removeEventListener('mousemove', handleMouseMove, { capture: true as any });
        iframe.contentDocument.removeEventListener('click', handleClick, { capture: true as any });
      }
    };
  }, [iframeRef, enabled, handleMouseMove, handleClick]);

  // 渲染高亮覆盖层 - 在父文档中使用 fixed 定位，确保坐标准确
  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;

    // 在父文档中创建覆盖层（而不是在 iframe 内部）
    let overlayContainer = document.querySelector('.ui-selector-overlay-container-external') as HTMLElement;
    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.className = 'ui-selector-overlay-container-external';
      overlayContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 99999;';
      document.body.appendChild(overlayContainer);
    }

    if (highlightRect && (elementInfo || hoverInfo)) {
      overlayContainer.innerHTML = '';
      const highlight = document.createElement('div');
      highlight.className = 'ui-selector-highlight-external';
      // highlightRect 已经是相对于视口的坐标了，直接使用
      highlight.style.cssText = `
        position: fixed;
        left: ${highlightRect.x}px;
        top: ${highlightRect.y}px;
        width: ${highlightRect.width}px;
        height: ${highlightRect.height}px;
        background-color: ${getModeColor(mode)};
        border: 2px dashed ${getBorderColor(mode)};
        pointer-events: ${mode === 'resize' ? 'auto' : 'none'};
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

      // 悬停时使用不同样式
      if (isHovering.current && !elementInfo) {
        highlight.style.backgroundColor = 'rgba(33, 150, 243, 0.2)';
        highlight.style.borderStyle = 'dotted';
      }

      if (mode === 'resize') {
        const sizeLabel = document.createElement('div');
        sizeLabel.className = 'ui-selector-size-label-external';
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
        sizeLabel.textContent = `${Math.round(highlightRect.width)} × ${Math.round(highlightRect.height)}`;
        highlight.appendChild(sizeLabel);

        const corners = ['se', 'sw', 'nw', 'ne'] as const;
        const cursors = { se: 'se-resize', sw: 'sw-resize', nw: 'nw-resize', ne: 'ne-resize' };
        corners.forEach(corner => {
          const handle = document.createElement('div');
          handle.className = `resize-handle-external resize-handle-${corner}`;
          handle.style.cssText = `
            position: absolute;
            ${corner.includes('n') ? 'top' : 'bottom'}: -6px;
            ${corner.includes('w') ? 'left' : 'right'}: -6px;
            width: 12px;
            height: 12px;
            background-color: ${getBorderColor(mode)};
            cursor: ${cursors[corner]};
            pointer-events: auto;
          `;
          highlight.appendChild(handle);
        });
      }

      overlayContainer.appendChild(highlight);
    } else {
      overlayContainer.innerHTML = '';
    }

    return () => {
      if (overlayContainer) {
        overlayContainer.innerHTML = '';
      }
    };
  }, [highlightRect, elementInfo, hoverInfo, mode, isHovering]);

  return null;
}
