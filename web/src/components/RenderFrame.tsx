import { useRef, useEffect, useState } from 'react';
import { UISelectorOverlay, type UISelectorInfo } from './UISelectorOverlay';
import { CodeEditor } from './CodeEditor';
import { api } from '../api/client';
import './RenderFrame.css';

interface RenderFrameProps {
  filePath?: string;
  fileContent?: string;
  onFileChange?: (path: string) => void;
  onElementSelect?: (info: UISelectorInfo) => void;
}

type ViewMode = 'preview' | 'code';
type FileType = 'html' | 'css' | 'js' | 'json' | 'text' | 'unknown';

export function RenderFrame({ filePath, fileContent, onFileChange, onElementSelect }: RenderFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uiSelectorEnabled, setUiSelectorEnabled] = useState(true);
  
  // 新增：视图模式和编辑状态
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [currentCode, setCurrentCode] = useState<string>('');
  const [fileType, setFileType] = useState<FileType>('unknown');

  // 检测文件类型
  const detectFileType = (path: string): FileType => {
    if (path.endsWith('.html') || path.endsWith('.htm')) return 'html';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.js')) return 'js';
    if (path.endsWith('.json')) return 'json';
    return 'text';
  };

  // 处理文件内容变化
  useEffect(() => {
    if (fileContent !== undefined) {
      setSrcDoc(fileContent);
      setCurrentCode(fileContent);
      setError(null);
      if (filePath) {
        const type = detectFileType(filePath);
        setFileType(type);
        // CSS/JS 文件自动切换到代码模式
        if (type === 'css' || type === 'js' || type === 'json' || type === 'text') {
          setViewMode('code');
        } else {
          setViewMode('preview');
        }
      }
    }
  }, [fileContent, filePath]);

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

  // 保存文件
  const handleSave = async (content: string) => {
    if (!filePath) return;
    await api.saveFileContent('project-1', filePath, content);
    // 通知父组件文件已更改
    onFileChange?.(filePath);
  };

  // 切换视图模式
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'preview' ? 'code' : 'preview');
  };

  if (!filePath) {
    return (
      <div className="render-frame-empty">
        <div className="empty-state">
          <span className="empty-icon">📄</span>
          <p>请从左侧文件树选择一个文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="render-frame">
      <div className="render-frame-header">
        <div className="render-frame-header-left">
          <span className="render-frame-title">
            {fileType === 'html' && '📄'}
            {fileType === 'css' && '🎨'}
            {fileType === 'js' && '📜'}
            {fileType === 'json' && '📋'}
            {fileType === 'text' && '📝'}
            {viewMode === 'preview' ? '预览' : '编辑'}：{filePath}
          </span>
          <span className="render-frame-status">{error ? '❌ 错误' : '✅ 正常'}</span>
        </div>
        <div className="render-frame-header-right">
          {/* HTML 文件显示切换按钮 */}
          {fileType === 'html' && (
            <button className="view-mode-toggle" onClick={toggleViewMode} title="切换预览/代码">
              {viewMode === 'preview' ? '📝 编辑代码' : '👁️ 预览'}
            </button>
          )}
          {/* UI 选择器仅 HTML 预览模式显示 */}
          {fileType === 'html' && viewMode === 'preview' && (
            <label className="ui-selector-toggle">
              <input
                type="checkbox"
                checked={uiSelectorEnabled}
                onChange={(e) => setUiSelectorEnabled(e.target.checked)}
              />
              🎯 UI 选择器
            </label>
          )}
        </div>
      </div>
      <div className="render-frame-content">
        {error ? (
          <div className="render-frame-error">{error}</div>
        ) : (
          viewMode === 'code' ? (
            // 代码编辑模式
            <CodeEditor
              filePath={filePath}
              fileContent={fileContent || ''}
              fileType={fileType === 'unknown' ? 'text' : fileType}
              onSave={handleSave}
              onContentChange={setCurrentCode}
            />
          ) : (
            // 预览模式
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
          )
        )}
      </div>
    </div>
  );
}
