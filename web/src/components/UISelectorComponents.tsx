import { useState } from 'react';
import { type SelectorMode, type UISelectorInfo, type UIIntent, type MoveIntent, type ResizeIntent } from './UISelector';

// ==================== Toast 通知组件 ====================

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-toast toast-${toast.type}`}
        >
          <span className="toast-icon">
            {toast.type === 'success' && '✅'}
            {toast.type === 'error' && '❌'}
            {toast.type === 'info' && 'ℹ️'}
          </span>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// ==================== 模式选择器组件 ====================

export function ModeSelector({
  currentMode,
  onModeChange,
  disabled,
  inline = false
}: {
  currentMode: SelectorMode;
  onModeChange: (mode: SelectorMode) => void;
  disabled?: boolean;
  inline?: boolean;
}) {
  const modes: { mode: SelectorMode; icon: string; label: string; color: string }[] = [
    { mode: 'select', icon: '🎯', label: '选择', color: '#2196F3' },
    { mode: 'move', icon: '✋', label: '移动', color: '#4CAF50' },
    { mode: 'resize', icon: '📐', label: '缩放', color: '#FF9800' },
  ];

  return (
    <div className={`mode-selector${inline ? ' mode-selector-inline' : ''}`}>
      {modes.map(({ mode, icon, label, color }) => (
        <button
          key={mode}
          className={`mode-btn ${currentMode === mode ? 'active' : ''}`}
          onClick={() => onModeChange(mode)}
          disabled={disabled}
          title={`${label}模式`}
          style={{
            '--mode-color': color
          } as React.CSSProperties}
        >
          <span className="mode-icon">{icon}</span>
          <span className="mode-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ==================== 标准格式信息生成 ====================

export interface StandardFormatOptions {
  includeHTML: boolean;
  includeCSS: boolean;
  includeAttributes: boolean;
  includeStyles: boolean;
  includeSelector: boolean;
  formatType: 'json' | 'markdown' | 'plain';
}

export function generateStandardFormat(
  info: UISelectorInfo,
  options: StandardFormatOptions = {
    includeHTML: true,
    includeCSS: true,
    includeAttributes: true,
    includeStyles: true,
    includeSelector: true,
    formatType: 'json'
  }
): string {
  const { formatType } = options;

  if (formatType === 'json') {
    return generateJSONFormat(info, options);
  } else if (formatType === 'markdown') {
    return generateMarkdownFormat(info, options);
  } else {
    return generatePlainFormat(info, options);
  }
}

function generateJSONFormat(info: UISelectorInfo, options: StandardFormatOptions): string {
  const data: Record<string, any> = {
    element: {
      tag: info.tag,
      id: info.id,
      selector: info.cssSelector || info.selector,
      domPath: info.domPath
    }
  };

  if (options.includeAttributes && info.attributes) {
    data.attributes = info.attributes;
  }

  if (options.includeCSS && info.styles) {
    data.styles = info.styles;
  }

  if (options.includeHTML) {
    data.html = {
      outerHTML: info.outerHTML,
      innerHTML: info.innerHTML?.slice(0, 500)
    };
  }

  if (info.text) {
    data.text = info.text;
  }

  if (info.ariaLabel || info.dataTestId) {
    data.accessibility = {};
    if (info.ariaLabel) data.accessibility.ariaLabel = info.ariaLabel;
    if (info.dataTestId) data.accessibility.dataTestId = info.dataTestId;
  }

  return JSON.stringify(data, null, 2);
}

function generateMarkdownFormat(info: UISelectorInfo, options: StandardFormatOptions): string {
  let md = `# UI 元素信息\n\n`;
  md += `## 基础信息\n\n`;
  md += `- **标签**: \`${info.tag}\`\n`;
  md += `- **ID**: \`${info.id}\`\n`;
  md += `- **选择器**: \`${info.cssSelector || info.selector}\`\n`;
  md += `- **DOM 路径**: \`${info.domPath}\`\n`;
  
  if (info.text) {
    md += `- **文本内容**: "${info.text}"\n`;
  }
  
  if (info.classList.length > 0) {
    md += `- **CSS 类**: \`${info.classList.join(' ')}\`\n`;
  }

  if (options.includeAttributes && info.attributes && Object.keys(info.attributes).length > 0) {
    md += `\n## 属性\n\n`;
    Object.entries(info.attributes).forEach(([key, value]) => {
      md += `- \`${key}\`: "${value}"\n`;
    });
  }

  if (options.includeCSS && info.styles && Object.keys(info.styles).length > 0) {
    md += `\n## 样式\n\n\`\`\`css\n`;
    Object.entries(info.styles).forEach(([key, value]) => {
      md += `${key}: ${value};\n`;
    });
    md += `\`\`\`\n`;
  }

  if (options.includeHTML && info.outerHTML) {
    md += `\n## HTML 代码\n\n\`\`\`html\n${info.outerHTML}\n\`\`\`\n`;
  }

  return md;
}

function generatePlainFormat(info: UISelectorInfo, options: StandardFormatOptions): string {
  let plain = `=== UI 元素信息 ===\n\n`;
  plain += `标签：${info.tag}\n`;
  plain += `ID: ${info.id}\n`;
  plain += `选择器：${info.cssSelector || info.selector}\n`;
  plain += `DOM 路径：${info.domPath}\n`;
  
  if (info.text) {
    plain += `文本：${info.text}\n`;
  }
  
  if (info.classList.length > 0) {
    plain += `CSS 类：${info.classList.join(' ')}\n`;
  }

  if (options.includeAttributes && info.attributes && Object.keys(info.attributes).length > 0) {
    plain += `\n=== 属性 ===\n`;
    Object.entries(info.attributes).forEach(([key, value]) => {
      plain += `${key}="${value}"\n`;
    });
  }

  if (options.includeCSS && info.styles && Object.keys(info.styles).length > 0) {
    plain += `\n=== 样式 ===\n`;
    Object.entries(info.styles).forEach(([key, value]) => {
      plain += `${key}: ${value};\n`;
    });
  }

  if (options.includeHTML && info.outerHTML) {
    plain += `\n=== HTML 代码 ===\n${info.outerHTML}\n`;
  }

  return plain;
}

// ==================== 复制工具函数 ====================

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('复制失败:', err);
    // 降级方案
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      return false;
    }
  }
}

export async function copyElementInfo(
  info: UISelectorInfo,
  format: 'json' | 'markdown' | 'plain' = 'json'
): Promise<boolean> {
  const text = generateStandardFormat(info, {
    includeHTML: true,
    includeCSS: true,
    includeAttributes: true,
    includeStyles: true,
    includeSelector: true,
    formatType: format
  });
  return copyToClipboard(text);
}

export async function copyOuterHTML(info: UISelectorInfo): Promise<boolean> {
  if (!info.outerHTML) return false;
  return copyToClipboard(info.outerHTML);
}

export async function copyCSSSelector(info: UISelectorInfo): Promise<boolean> {
  const selector = info.cssSelector || info.selector || '';
  return copyToClipboard(selector);
}

// ==================== AI 提示词构建 ====================

export function buildAiPrompt(info: UISelectorInfo, intent: UIIntent): string {
  const selector = info.cssSelector || info.selector || '';
  const domPath = info.domPath || '';
  const tag = info.tag;
  const classList = info.classList.length > 0 ? info.classList.join(', ') : '(无)';

  let operation = '';
  let changeDetails = '';

  if (intent.type === 'move') {
    const mi = intent as MoveIntent;
    const deltaX = Math.round(mi.after.x - mi.before.x);
    const deltaY = Math.round(mi.after.y - mi.before.y);
    operation = '移动 (Move)';
    changeDetails = [
      `位置: (${Math.round(mi.before.x)}, ${Math.round(mi.before.y)}) → (${Math.round(mi.after.x)}, ${Math.round(mi.after.y)})`,
      `偏移: Δx=${deltaX >= 0 ? '+' : ''}${deltaX}px, Δy=${deltaY >= 0 ? '+' : ''}${deltaY}px`,
      '',
      '修改后样式:',
      `  position: relative;`,
      `  transform: translate(${deltaX}px, ${deltaY}px);`
    ].join('\n');
  } else if (intent.type === 'resize') {
    const ri = intent as ResizeIntent;
    const deltaW = Math.round(ri.after.width - ri.before.width);
    const deltaH = Math.round(ri.after.height - ri.before.height);
    const deltaLeft = Math.round(ri.after.x - ri.before.x);
    const deltaTop = Math.round(ri.after.y - ri.before.y);
    operation = '缩放 (Resize)';
    const lines = [
      `位置: (${Math.round(ri.before.x)}, ${Math.round(ri.before.y)}) → (${Math.round(ri.after.x)}, ${Math.round(ri.after.y)})`,
      `尺寸: ${Math.round(ri.before.width)}×${Math.round(ri.before.height)} → ${Math.round(ri.after.width)}×${Math.round(ri.after.height)}`,
      `偏移: Δ宽=${deltaW >= 0 ? '+' : ''}${deltaW}px, Δ高=${deltaH >= 0 ? '+' : ''}${deltaH}px`,
      ''
    ];
    const styleLines = ['修改后样式:', '  position: relative;', '  box-sizing: border-box;'];
    if (deltaLeft !== 0 || deltaTop !== 0) {
      styleLines.push(`  transform: translate(${deltaLeft}px, ${deltaTop}px);`);
    }
    styleLines.push(`  width: ${Math.round(ri.after.width)}px;`, `  height: ${Math.round(ri.after.height)}px;`);
    changeDetails = lines.concat(styleLines).join('\n');
  }

  return [
    '## UI 元素修改',
    '',
    '### 元素定位',
    `- CSS 选择器: ${selector}`,
    `- DOM 路径: ${domPath}`,
    `- 标签: ${tag}`,
    `- 类名: ${classList}`,
    '',
    '### 修改内容',
    `- 操作: ${operation}`,
    changeDetails
  ].join('\n');
}

export function buildJsonPrompt(info: UISelectorInfo, intent: UIIntent): string {
  return JSON.stringify({
    element: {
      cssSelector: info.cssSelector || info.selector,
      domPath: info.domPath,
      tag: info.tag,
      classList: info.classList
    },
    intent
  }, null, 2);
}

// ==================== Intent 工具函数 ====================

export function intentToJson(intent: UIIntent): string {
  return JSON.stringify(intent, null, 2);
}

export async function copyIntentToClipboard(intent: UIIntent): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(intentToJson(intent));
    return true;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
}

export function createMoveIntent(
  widgetId: string,
  widgetPath: string,
  widgetType: string,
  before: { x: number; y: number; width: number; height: number },
  after: { x: number; y: number; width: number; height: number }
): UIIntent {
  return {
    type: 'move',
    widget_id: widgetId,
    widget_path: widgetPath,
    widget_type: widgetType,
    before,
    after
  };
}

export function createResizeIntent(
  widgetId: string,
  widgetPath: string,
  widgetType: string,
  before: { x: number; y: number; width: number; height: number },
  after: { x: number; y: number; width: number; height: number }
): UIIntent {
  return {
    type: 'resize',
    widget_id: widgetId,
    widget_path: widgetPath,
    widget_type: widgetType,
    before,
    after
  };
}

export function createDescribeIntent(
  widgetId: string,
  widgetPath: string,
  widgetType: string,
  description: string
): UIIntent {
  return {
    type: 'describe',
    widget_id: widgetId,
    widget_path: widgetPath,
    widget_type: widgetType,
    description
  };
}

// ==================== UI 信息展示组件 ====================

type CopyFormat = 'json' | 'markdown' | 'plain';

export function UISelectorDisplay({
  info,
  intent,
  onCopyIntent
}: {
  info: UISelectorInfo | null;
  intent?: UIIntent | null;
  onCopyIntent?: () => void;
}) {
  const [copyFormat, setCopyFormat] = useState<CopyFormat>('json');
  const [activeTab, setActiveTab] = useState<'info' | 'html' | 'css' | 'intent'>('info');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 显示 Toast 通知
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    // 2 秒后自动消失
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2000);
  };

  if (!info) {
    return (
      <div className="ui-selector-display empty">
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h4>UI 选择系统</h4>
          <p>点击右侧渲染区域内的元素，这里会显示组件详情</p>
          <div className="mode-hints">
            <div className="mode-hint">
              <span className="mode-dot mode-dot-select"></span>
              <span>选择模式：点击选择元素，获取完整 HTML 信息</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const standardFormatText = generateStandardFormat(info, {
    includeHTML: true,
    includeCSS: true,
    includeAttributes: true,
    includeStyles: true,
    includeSelector: true,
    formatType: copyFormat
  });

  const handleCopyStandard = async () => {
    const success = await copyToClipboard(standardFormatText);
    if (success) {
      showToast('已复制标准格式');
    } else {
      showToast('复制失败', 'error');
    }
  };

  const handleCopyOuterHTML = async () => {
    if (info.outerHTML) {
      const success = await copyToClipboard(info.outerHTML);
      if (success) {
        showToast('OuterHTML 已复制');
      } else {
        showToast('复制失败', 'error');
      }
    }
  };

  const handleCopySelector = async () => {
    const selector = info.cssSelector || info.selector || '';
    const success = await copyToClipboard(selector);
    if (success) {
      showToast(`CSS 选择器已复制`);
    } else {
      showToast('复制失败', 'error');
    }
  };

  return (
    <div className="ui-selector-display">
      {/* Toast 通知容器 */}
      <ToastContainer toasts={toasts} />

      {/* 顶部操作栏 */}
      <div className="ui-display-toolbar">
        <div className="ui-display-tabs">
          <button
            className={`ui-display-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            📋 信息
          </button>
          <button
            className={`ui-display-tab ${activeTab === 'html' ? 'active' : ''}`}
            onClick={() => setActiveTab('html')}
          >
            📄 HTML
          </button>
          <button
            className={`ui-display-tab ${activeTab === 'css' ? 'active' : ''}`}
            onClick={() => setActiveTab('css')}
          >
            🎨 CSS
          </button>
          {intent && (
            <button
              className={`ui-display-tab ${activeTab === 'intent' ? 'active' : ''}`}
              onClick={() => setActiveTab('intent')}
            >
              🔄 Intent
            </button>
          )}
        </div>
        <div className="ui-display-actions">
          <select
            className="format-select"
            value={copyFormat}
            onChange={(e) => setCopyFormat(e.target.value as CopyFormat)}
            title="选择输出格式"
          >
            <option value="json">JSON 格式</option>
            <option value="markdown">Markdown 格式</option>
            <option value="plain">纯文本格式</option>
          </select>
          <button className="btn-copy-primary" onClick={handleCopyStandard}>
            📋 复制标准格式
          </button>
        </div>
      </div>

      {/* 信息面板 */}
      {activeTab === 'info' && (
        <div className="ui-info-content">
          {/* 基本信息头部 */}
          <div className="ui-info-header">
            <span className="ui-info-tag ui-info-tag-mode">{info.tag}</span>
            <span className="ui-info-id">{info.id}</span>
          </div>

          {/* 快速操作 */}
          <div className="quick-actions">
            <button className="btn-quick-action" onClick={handleCopySelector} title="复制 CSS 选择器">
              🎯 复制选择器
            </button>
            <button className="btn-quick-action" onClick={handleCopyOuterHTML} title="复制 OuterHTML">
              📄 复制 HTML
            </button>
            <button className="btn-quick-action" onClick={handleCopyStandard} title="复制元素完整信息">
              📋 复制元素信息
            </button>
          </div>

          {/* 文本内容 */}
          {info.text && (
            <div className="ui-info-section">
              <span className="label">📝 文本内容:</span>
              <span className="value text-value">"{info.text}"</span>
            </div>
          )}

          {/* ARIA / Data 属性 */}
          {(info.ariaLabel || info.dataTestId) && (
            <div className="ui-info-section ui-info-accessibility">
              <span className="label">♿ 无障碍/测试:</span>
              <div className="accessibility-tags">
                {info.ariaLabel && (
                  <span className="accessibility-tag" title="ARIA Label">
                    aria: {info.ariaLabel}
                  </span>
                )}
                {info.dataTestId && (
                  <span className="accessibility-tag" title="Data Test ID">
                    testid: {info.dataTestId}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* CSS Classes */}
          {info.classList.length > 0 && (
            <div className="ui-info-section">
              <span className="label">🎨 CSS Classes:</span>
              <div className="classes-list">
                {info.classList.map((cls, idx) => (
                  <span key={idx} className="class-tag">{cls}</span>
                ))}
              </div>
            </div>
          )}

          {/* 选择器 */}
          <div className="ui-info-section">
            <span className="label">🎯 CSS 选择器:</span>
            <code className="code-value">{info.cssSelector || info.selector}</code>
          </div>

          {/* DOM 路径 */}
          <div className="ui-info-section">
            <span className="label">🌲 DOM 路径:</span>
            <code className="code-value path-value">{info.domPath}</code>
          </div>

          {/* 位置和尺寸 */}
          <div className="ui-info-section ui-info-geometry">
            <div className="geometry-row">
              <span className="label">📍 位置:</span>
              <span className="value geometry-value">
                x: <strong>{Math.round(info.rect.x)}</strong>, y: <strong>{Math.round(info.rect.y)}</strong>
              </span>
            </div>
            <div className="geometry-row">
              <span className="label">📐 尺寸:</span>
              <span className="value geometry-value">
                <strong>{Math.round(info.rect.width)}</strong> × <strong>{Math.round(info.rect.height)}</strong>
              </span>
            </div>
          </div>

          {/* 层级信息 */}
          <div className="ui-info-section">
            <span className="label">📊 层级信息:</span>
            <div className="hierarchy-info">
              <span>子元素：<strong>{info.childrenCount}</strong></span>
              {info.parentTag && (
                <span>父标签：<strong>&lt;{info.parentTag}&gt;</strong></span>
              )}
            </div>
          </div>

          {/* ========== 移动对比信息 ========== */}
          {intent && intent.type === 'move' && (
            <div className="ui-info-section ui-move-compare-section">
              <span className="label">🔄 移动对比:</span>
              <div className="ui-change-details">
                <div className="ui-change-row">
                  <span className="ui-change-key">位置</span>
                  <span className="ui-change-compare">
                    <span className="ui-before">({Math.round(intent.before.x)}, {Math.round(intent.before.y)})</span>
                    <span className="ui-arrow">→</span>
                    <span className="ui-after">({Math.round(intent.after.x)}, {Math.round(intent.after.y)})</span>
                  </span>
                </div>
                {(() => {
                  const dx = Math.round(intent.after.x - intent.before.x);
                  const dy = Math.round(intent.after.y - intent.before.y);
                  return (
                    <div className="ui-change-row">
                      <span className="ui-change-key">偏移</span>
                      <span className="ui-change-delta">
                        Δx={dx >= 0 ? '+' : ''}{dx}px, Δy={dy >= 0 ? '+' : ''}{dy}px
                      </span>
                    </div>
                  );
                })()}
              </div>
              <pre className="ui-style-preview">
{`position: relative;
transform: translate(${Math.round(intent.after.x - intent.before.x)}px, ${Math.round(intent.after.y - intent.before.y)}px);`}
              </pre>
              <div className="ui-copy-actions" style={{ marginTop: '8px' }}>
                <button
                  className="btn-copy-ai-prompt"
                  onClick={async () => {
                    const prompt = buildAiPrompt(info, intent);
                    const ok = await copyToClipboard(prompt);
                    showToast(ok ? '已复制移动修改信息' : '复制失败', ok ? 'success' : 'error');
                  }}
                  title="复制元素信息 + 移动修改对比"
                >
                  🔄 复制移动对比
                </button>
                <button
                  className="btn-copy-json"
                  onClick={async () => {
                    const json = buildJsonPrompt(info, intent);
                    const ok = await copyToClipboard(json);
                    showToast(ok ? '已复制 JSON' : '复制失败', ok ? 'success' : 'error');
                  }}
                  title="复制 JSON 格式"
                >
                  📋 复制 JSON
                </button>
              </div>
            </div>
          )}

          {/* ========== 缩放对比信息 ========== */}
          {intent && intent.type === 'resize' && (
            <div className="ui-info-section ui-resize-compare-section">
              <span className="label">📐 缩放对比:</span>
              <div className="ui-change-details">
                <div className="ui-change-row">
                  <span className="ui-change-key">位置</span>
                  <span className="ui-change-compare">
                    <span className="ui-before">({Math.round(intent.before.x)}, {Math.round(intent.before.y)})</span>
                    <span className="ui-arrow">→</span>
                    <span className="ui-after">({Math.round(intent.after.x)}, {Math.round(intent.after.y)})</span>
                  </span>
                </div>
                <div className="ui-change-row">
                  <span className="ui-change-key">尺寸</span>
                  <span className="ui-change-compare">
                    <span className="ui-before">{Math.round(intent.before.width)}×{Math.round(intent.before.height)}</span>
                    <span className="ui-arrow">→</span>
                    <span className="ui-after">{Math.round(intent.after.width)}×{Math.round(intent.after.height)}</span>
                  </span>
                </div>
                {(() => {
                  const dw = Math.round(intent.after.width - intent.before.width);
                  const dh = Math.round(intent.after.height - intent.before.height);
                  return (
                    <div className="ui-change-row">
                      <span className="ui-change-key">增量</span>
                      <span className="ui-change-delta">
                        Δ宽={dw >= 0 ? '+' : ''}{dw}px, Δ高={dh >= 0 ? '+' : ''}{dh}px
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div className="ui-copy-actions" style={{ marginTop: '8px' }}>
                <button
                  className="btn-copy-ai-prompt"
                  onClick={async () => {
                    const prompt = buildAiPrompt(info, intent);
                    const ok = await copyToClipboard(prompt);
                    showToast(ok ? '已复制缩放修改信息' : '复制失败', ok ? 'success' : 'error');
                  }}
                  title="复制元素信息 + 缩放修改对比"
                >
                  📐 复制缩放对比
                </button>
                <button
                  className="btn-copy-json"
                  onClick={async () => {
                    const json = buildJsonPrompt(info, intent);
                    const ok = await copyToClipboard(json);
                    showToast(ok ? '已复制 JSON' : '复制失败', ok ? 'success' : 'error');
                  }}
                  title="复制 JSON 格式"
                >
                  📋 复制 JSON
                </button>
              </div>
            </div>
          )}

          {/* 属性列表 */}
          {info.attributes && Object.keys(info.attributes).length > 0 && (
            <div className="ui-info-section">
              <span className="label">🔖 HTML 属性:</span>
              <div className="attributes-list">
                {Object.entries(info.attributes).map(([key, value]) => (
                  <div key={key} className="attribute-item">
                    <span className="attr-name">{key}</span>
                    <span className="attr-value">"{value}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 样式列表 */}
          {info.styles && Object.keys(info.styles).length > 0 && (
            <div className="ui-info-section">
              <span className="label">💅 计算样式:</span>
              <div className="styles-grid">
                {Object.entries(info.styles).map(([key, value]) => (
                  <div key={key} className="style-item">
                    <span className="style-name">{key}</span>
                    <span className="style-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 标准格式预览 */}
          <div className="ui-info-section">
            <span className="label">📋 标准格式预览:</span>
            <pre className="standard-format-preview">
              {standardFormatText.slice(0, 1000)}
              {standardFormatText.length > 1000 ? '\n...(内容过长，点击复制获取完整)' : ''}
            </pre>
          </div>
        </div>
      )}

      {/* HTML 面板 */}
      {activeTab === 'html' && (
        <div className="ui-html-content">
          <div className="code-panel">
            <div className="code-panel-header">
              <span>OuterHTML</span>
              <button className="btn-copy-small" onClick={handleCopyOuterHTML}>
                📋 复制
              </button>
            </div>
            <pre className="code-block">
              <code>{info.outerHTML || '无 HTML 内容'}</code>
            </pre>
          </div>
          {info.innerHTML && (
            <div className="code-panel">
              <div className="code-panel-header">
                <span>InnerHTML</span>
              </div>
              <pre className="code-block">
                <code>{info.innerHTML}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* CSS 面板 */}
      {activeTab === 'css' && (
        <div className="ui-css-content">
          {info.styles && Object.keys(info.styles).length > 0 ? (
            <div className="code-panel">
              <div className="code-panel-header">
                <span>计算样式 (Computed Styles)</span>
                <button className="btn-copy-small" onClick={() => copyToClipboard(
                  Object.entries(info.styles!).map(([k, v]) => `${k}: ${v};`).join('\n')
                )}>
                  📋 复制
                </button>
              </div>
              <pre className="code-block css-code">
                <code>
                  {Object.entries(info.styles).map(([key, value]) => (
                    <div key={key}>{key}: <span className="css-value">{value}</span>;</div>
                  ))}
                </code>
              </pre>
            </div>
          ) : (
            <div className="empty-message">暂无样式信息</div>
          )}
          {info.classList.length > 0 && (
            <div className="code-panel">
              <div className="code-panel-header">
                <span>CSS Classes</span>
              </div>
              <div className="classes-list-detailed">
                {info.classList.map((cls, idx) => (
                  <div key={idx} className="class-item">
                    <code>.{cls}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Intent 面板 - 变更对比 + 一键复制 */}
      {activeTab === 'intent' && intent && (
        <div className="ui-intent-content">
          <div className="ui-intent-header">
            <span className={`ui-intent-badge ui-intent-badge-${intent.type}`}>
              {intent.type === 'move' && '🔄 移动意图'}
              {intent.type === 'resize' && '📐 缩放意图'}
              {intent.type === 'describe' && '📝 描述意图'}
            </span>
          </div>

          {/* 元素定位信息 */}
          <div className="ui-change-section">
            <span className="ui-change-label">📍 元素定位</span>
            <div className="ui-change-details">
              <div className="ui-change-row">
                <span className="ui-change-key">CSS 选择器</span>
                <code className="ui-change-value">{info.cssSelector || info.selector}</code>
              </div>
              <div className="ui-change-row">
                <span className="ui-change-key">DOM 路径</span>
                <code className="ui-change-value">{info.domPath}</code>
              </div>
              <div className="ui-change-row">
                <span className="ui-change-key">标签</span>
                <span className="ui-change-value">{info.tag}</span>
              </div>
              {info.classList.length > 0 && (
                <div className="ui-change-row">
                  <span className="ui-change-key">类名</span>
                  <span className="ui-change-value">{info.classList.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* 位置/尺寸变化对比 */}
          <div className="ui-change-section">
            <span className="ui-change-label">
              {intent.type === 'move' ? '📐 位置变化' : '📐 尺寸变化'}
            </span>
            <div className="ui-change-details">
              <div className="ui-change-row">
                <span className="ui-change-key">位置</span>
                <span className="ui-change-compare">
                  <span className="ui-before">({Math.round(intent.before.x)}, {Math.round(intent.before.y)})</span>
                  <span className="ui-arrow">→</span>
                  <span className="ui-after">({Math.round(intent.after.x)}, {Math.round(intent.after.y)})</span>
                </span>
              </div>
              <div className="ui-change-row">
                <span className="ui-change-key">尺寸</span>
                <span className="ui-change-compare">
                  <span className="ui-before">{Math.round(intent.before.width)}×{Math.round(intent.before.height)}</span>
                  <span className="ui-arrow">→</span>
                  <span className="ui-after">{Math.round(intent.after.width)}×{Math.round(intent.after.height)}</span>
                </span>
              </div>
              {intent.type === 'move' && (() => {
                const dx = Math.round(intent.after.x - intent.before.x);
                const dy = Math.round(intent.after.y - intent.before.y);
                return (
                  <div className="ui-change-row">
                    <span className="ui-change-key">偏移</span>
                    <span className="ui-change-delta">
                      Δx={dx >= 0 ? '+' : ''}{dx}px, Δy={dy >= 0 ? '+' : ''}{dy}px
                    </span>
                  </div>
                );
              })()}
              {intent.type === 'resize' && (() => {
                const dw = Math.round(intent.after.width - intent.before.width);
                const dh = Math.round(intent.after.height - intent.before.height);
                return (
                  <div className="ui-change-row">
                    <span className="ui-change-key">增量</span>
                    <span className="ui-change-delta">
                      Δ宽={dw >= 0 ? '+' : ''}{dw}px, Δ高={dh >= 0 ? '+' : ''}{dh}px
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 修改后样式预览 */}
          <div className="ui-change-section">
            <span className="ui-change-label">💅 修改后样式</span>
            <pre className="ui-style-preview">
              {intent.type === 'move' ? (() => {
                const dx = Math.round(intent.after.x - intent.before.x);
                const dy = Math.round(intent.after.y - intent.before.y);
                return `position: relative;\ntransform: translate(${dx}px, ${dy}px);`;
              })() : (() => {
                const dl = Math.round(intent.after.x - intent.before.x);
                const dt = Math.round(intent.after.y - intent.before.y);
                const lines = ['position: relative;', 'box-sizing: border-box;'];
                if (dl !== 0 || dt !== 0) lines.push(`transform: translate(${dl}px, ${dt}px);`);
                lines.push(`width: ${Math.round(intent.after.width)}px;`, `height: ${Math.round(intent.after.height)}px;`);
                return lines.join('\n');
              })()}
            </pre>
          </div>

          {/* 一键复制 */}
          <div className="ui-change-section">
            <span className="ui-change-label">📋 一键复制修改信息</span>
            <div className="ui-copy-actions">
              <button
                className="btn-copy-ai-prompt"
                onClick={async () => {
                  const prompt = buildAiPrompt(info, intent);
                  const ok = await copyToClipboard(prompt);
                  showToast(ok ? '已复制 AI 提示词' : '复制失败', ok ? 'success' : 'error');
                }}
                title="复制定位信息 + 修改内容，可直接粘贴给 AI"
              >
                🤖 复制 AI 提示词
              </button>
              <button
                className="btn-copy-json"
                onClick={async () => {
                  const json = buildJsonPrompt(info, intent);
                  const ok = await copyToClipboard(json);
                  showToast(ok ? '已复制 JSON' : '复制失败', ok ? 'success' : 'error');
                }}
                title="复制 JSON 格式"
              >
                📋 复制 JSON
              </button>
            </div>
            <pre className="ui-ai-prompt-preview">{buildAiPrompt(info, intent)}</pre>
          </div>

          {/* 原始 Intent JSON */}
          <details className="ui-intent-details">
            <summary className="ui-intent-summary">原始 Intent JSON</summary>
            <pre className="ui-intent-json">
              {JSON.stringify(intent, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
