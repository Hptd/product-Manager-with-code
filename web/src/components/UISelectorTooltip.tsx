import { type HoverElementInfo } from './UISelector';

// ==================== 悬停提示框组件 ====================

export function HoverTooltip({ info, visible }: { info: HoverElementInfo | null; visible: boolean }) {
  if (!info || !visible) return null;

  // 计算提示框位置，确保不超出屏幕边界
  const tooltipWidth = 280;
  const tooltipHeight = 140;
  const offsetX = 15;
  const offsetY = 15;

  // 获取屏幕尺寸
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // 计算理想位置
  let left = info.mouseX + offsetX;
  let top = info.mouseY + offsetY;

  // 如果右侧超出屏幕，放到鼠标左侧
  if (left + tooltipWidth > screenWidth) {
    left = info.mouseX - tooltipWidth - offsetX;
  }

  // 如果底部超出屏幕，放到鼠标上方
  if (top + tooltipHeight > screenHeight) {
    top = info.mouseY - tooltipHeight - offsetY;
  }

  // 确保不超出左边界
  if (left < 10) {
    left = 10;
  }

  // 确保不超出上边界
  if (top < 10) {
    top = 10;
  }

  return (
    <div
      className="hover-tooltip"
      style={{
        position: 'fixed',
        left: left,
        top: top,
        zIndex: 100000,
        pointerEvents: 'none'
      }}
    >
      <div className="hover-tooltip-content">
        <div className="tooltip-header">
          <span className="tooltip-tag">{info.tag}</span>
          <span className="tooltip-id">{info.id.slice(0, 30)}{info.id.length > 30 ? '...' : ''}</span>
        </div>

        {info.text && info.text.length > 0 && (
          <div className="tooltip-text">
            "{info.text.slice(0, 50)}{info.text.length > 50 ? '...' : ''}"
          </div>
        )}

        <div className="tooltip-meta">
          <span className="tooltip-size">
            {Math.round(info.rect.width)} × {Math.round(info.rect.height)}
          </span>
          {info.classList.length > 0 && (
            <span className="tooltip-classes">
              {info.classList.slice(0, 2).join(' ')}
              {info.classList.length > 2 ? ` +${info.classList.length - 2}` : ''}
            </span>
          )}
        </div>

        <div className="tooltip-hint">
          点击选择此元素
        </div>
      </div>
    </div>
  );
}

// ==================== 状态栏组件（显示当前悬停元素信息） ====================

export function StatusBar({ info, mode }: { info: HoverElementInfo | null; mode: string }) {
  if (!info) return null;

  return (
    <div className="ui-status-bar">
      <div className="status-bar-left">
        <span className="status-mode">{mode.toUpperCase()}</span>
        <span className="status-separator">|</span>
        <span className="status-tag">{info.tag}</span>
        <span className="status-id">{info.id}</span>
      </div>
      <div className="status-bar-right">
        {info.text && info.text.length > 0 && (
          <span className="status-text">
            "{info.text.slice(0, 40)}{info.text.length > 40 ? '...' : ''}"
          </span>
        )}
        <span className="status-size">
          {Math.round(info.rect.width)} × {Math.round(info.rect.height)}
        </span>
      </div>
    </div>
  );
}
