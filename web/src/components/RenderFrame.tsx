import { useRef, useEffect, useState } from 'react';
import { UISelectorOverlay, type UISelectorInfo } from './UISelectorOverlay';

interface RenderFrameProps {
  filePath?: string;
  fileContent?: string;
  onFileChange?: (path: string) => void;
  onElementSelect?: (info: UISelectorInfo) => void;
}

export function RenderFrame({ filePath, fileContent, onFileChange, onElementSelect }: RenderFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uiSelectorEnabled, setUiSelectorEnabled] = useState(true);

  // 处理文件内容变化
  useEffect(() => {
    if (fileContent !== undefined) {
      setSrcDoc(fileContent);
      setError(null);
    }
  }, [fileContent]);

  // 处理热更新消息
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3002');

    ws.onopen = () => {
      console.log('🔌 热更新 WebSocket 已连接');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'file-change' && filePath) {
        // 如果变更的文件是当前显示的文件，通知父组件重新加载
        if (data.path === filePath) {
          console.log('📝 检测到文件变化，重新加载:', filePath);
          onFileChange?.(filePath);
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };

    ws.onclose = () => {
      console.log('🔌 热更新 WebSocket 已断开');
    };

    return () => {
      ws.close();
    };
  }, [filePath, onFileChange]);

  const handleIframeLoad = () => {
    console.log('✅ iframe 加载完成:', filePath);
  };

  const handleIframeError = () => {
    setError('加载页面失败');
  };

  if (!filePath) {
    return (
      <div className="render-frame-empty">
        <div className="empty-state">
          <span className="empty-icon">📄</span>
          <p>请从左侧文件树选择一个 HTML 文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="render-frame">
      <div className="render-frame-header">
        <div className="render-frame-header-left">
          <span className="render-frame-title">预览：{filePath}</span>
          <span className="render-frame-status">{error ? '❌ 错误' : '✅ 正常'}</span>
        </div>
        <div className="render-frame-header-right">
          <label className="ui-selector-toggle">
            <input
              type="checkbox"
              checked={uiSelectorEnabled}
              onChange={(e) => setUiSelectorEnabled(e.target.checked)}
            />
            🎯 UI 选择器
          </label>
        </div>
      </div>
      <div className="render-frame-content">
        {error ? (
          <div className="render-frame-error">{error}</div>
        ) : (
          <div className="iframe-wrapper">
            <iframe
              ref={iframeRef}
              title="preview"
              srcDoc={srcDoc}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-scripts allow-same-origin allow-forms"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
            {uiSelectorEnabled && (
              <UISelectorOverlay
                iframeRef={iframeRef}
                onElementSelect={onElementSelect}
                enabled={uiSelectorEnabled}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
