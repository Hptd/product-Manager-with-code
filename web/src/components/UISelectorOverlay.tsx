import { useEffect, useRef, useState, useCallback } from 'react';
import interact from 'interactjs';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UISelectorInfo = {
  id: string;
  tag: string;
  classList: string[];
  text?: string;
  rect: Rect;
  selector?: string;
  domPath?: string;
};

interface UISelectorOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onElementSelect?: (info: UISelectorInfo) => void;
  enabled?: boolean;
}

// 生成组件 ID
function getComponentId(element: Element): string {
  const baseId = element.id || 
    element.getAttribute('data-testid') ||
    `${element.tagName.toLowerCase()}${element.className ? '.' + element.className.split(' ')[0] : ''}`;
  return baseId || `elem-${Math.random().toString(36).substr(2, 9)}`;
}

// 检查元素是否可见
function isVisibleElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0';
}

// 获取元素矩形（相对于 iframe）
function getElementRect(element: Element, iframe: HTMLIFrameElement): Rect {
  const iframeRect = iframe.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  
  return {
    x: rect.left - iframeRect.left,
    y: rect.top - iframeRect.top,
    width: rect.width,
    height: rect.height
  };
}

// 构建 DOM 路径
function buildDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current.tagName) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const firstClass = current.className.split(' ')[0];
      if (firstClass) {
        selector += `.${firstClass}`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  
  return parts.join(' > ');
}

// 检查点击是否在 iframe 内部
function isClickInIframe(event: MouseEvent, iframe: HTMLIFrameElement): boolean {
  const rect = iframe.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

// 查找点击位置的元素
function findElementAtPoint(event: MouseEvent, iframe: HTMLIFrameElement): Element | null {
  if (!iframe.contentDocument) return null;
  if (!isClickInIframe(event, iframe)) return null;

  const iframeRect = iframe.getBoundingClientRect();
  const x = event.clientX - iframeRect.left;
  const y = event.clientY - iframeRect.top;

  const element = iframe.contentDocument.elementFromPoint(x, y);
  
  if (!element || !isVisibleElement(element as HTMLElement)) {
    return null;
  }

  return element;
}

export function UISelectorOverlay({ iframeRef, onElementSelect, enabled = true }: UISelectorOverlayProps) {
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // 处理点击选择
  const handleClick = useCallback((event: MouseEvent) => {
    if (!enabled || !iframeRef.current) return;
    
    const iframe = iframeRef.current;
    const element = findElementAtPoint(event, iframe);
    
    if (element) {
      // 生成组件信息
      const info: UISelectorInfo = {
        id: getComponentId(element),
        tag: element.tagName.toLowerCase(),
        classList: Array.from((element as HTMLElement).classList),
        text: element.textContent?.slice(0, 30).trim(),
        rect: getElementRect(element, iframe),
        selector: element.id ? `#${element.id}` : element.tagName.toLowerCase(),
        domPath: buildDomPath(element)
      };
      
      onElementSelect?.(info);
    }
  }, [enabled, iframeRef, onElementSelect]);

  // 监听 iframe 加载完成后添加事件监听
  useEffect(() => {
    if (!iframeRef.current || !enabled) return;

    const iframe = iframeRef.current;
    
    const addListeners = () => {
      if (!iframe.contentDocument) return;
      
      iframe.contentDocument.addEventListener('click', handleClick, true);
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      addListeners();
    } else {
      iframe.addEventListener('load', addListeners);
    }

    return () => {
      if (iframe.contentDocument) {
        iframe.contentDocument.removeEventListener('click', handleClick, true);
      }
    };
  }, [iframeRef, enabled, handleClick]);

  return null;
}

// 独立的 UI 信息展示组件（用于底部面板）
export function UISelectorDisplay({ info }: { info: UISelectorInfo | null }) {
  if (!info) {
    return (
      <div className="ui-selector-display empty">
        <p>💡 点击上方渲染区域内的元素，这里会显示组件信息</p>
      </div>
    );
  }

  return (
    <div className="ui-selector-display">
      <div className="ui-info-header">
        <span className="ui-info-tag">{info.tag}</span>
        <span className="ui-info-id">{info.id}</span>
      </div>
      
      {info.text && (
        <div className="ui-info-section">
          <span className="label">文本:</span>
          <span className="value">"{info.text}"</span>
        </div>
      )}
      
      {info.classList.length > 0 && (
        <div className="ui-info-section">
          <span className="label">Classes:</span>
          <span className="value classes">{info.classList.join(' ')}</span>
        </div>
      )}
      
      <div className="ui-info-section">
        <span className="label">DOM 路径:</span>
        <span className="value path">{info.domPath}</span>
      </div>
      
      <div className="ui-info-section">
        <span className="label">位置:</span>
        <span className="value">
          x: {Math.round(info.rect.x)}, y: {Math.round(info.rect.y)}
        </span>
      </div>
      
      <div className="ui-info-section">
        <span className="label">尺寸:</span>
        <span className="value">
          {Math.round(info.rect.width)} × {Math.round(info.rect.height)}
        </span>
      </div>
    </div>
  );
}
