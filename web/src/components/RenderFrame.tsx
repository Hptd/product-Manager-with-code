import { useRef, useEffect, useState } from 'react';
import { UISelectorOverlay, type UISelectorInfo, type SelectorMode, type UIIntent, type HoverElementInfo } from './UISelector';
import { ModeSelector, UISelectorDisplay } from './UISelectorComponents';
import { HoverTooltip, StatusBar } from './UISelectorTooltip';
import { CodeEditor } from './CodeEditor';
import { api } from '../api/client';
import './RenderFrame.css';

interface RenderFrameProps {
  filePath?: string;
  fileContent?: string;
  onFileChange?: (path: string) => void;
  onElementSelect?: (info: UISelectorInfo) => void;
  onIntentGenerate?: (intent: UIIntent) => void;
}

type ViewMode = 'preview' | 'code';
type FileType = 'html' | 'css' | 'js' | 'json' | 'text' | 'unknown';

export function RenderFrame({ filePath, fileContent, onFileChange, onElementSelect, onIntentGenerate }: RenderFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uiSelectorEnabled, setUiSelectorEnabled] = useState(true);
  const [currentMode, setCurrentMode] = useState<SelectorMode>('select');
  const [hoverElementInfo, setHoverElementInfo] = useState<HoverElementInfo | null>(null);

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

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'file-change' && filePath) {
        // 路径匹配逻辑：支持多种路径格式
        // 后端发送的路径格式：project-1/index.html
        // 前端 filePath 格式：index.html
        const changedPath = data.path;
        const currentFileName = filePath.split('/').pop() || filePath;
        const changedFileName = changedPath.split('/').pop() || changedPath;
        
        // 检查是否匹配：完全匹配 或 文件名匹配
        const isExactMatch = changedPath === filePath;
        const isNameMatch = currentFileName === changedFileName && 
                           changedPath.includes(filePath);
        
        if (isExactMatch || isNameMatch) {
          console.log('📝 检测到文件变化，重新加载:', filePath, '变更路径:', changedPath);
          // 直接获取最新文件内容并更新 srcDoc
          try {
            const projectName = changedPath.split('/')[0] || 'project-1';
            const relativePath = changedPath.substring(projectName.length + 1);
            const content = await api.getFileContent(projectName, relativePath);
            setSrcDoc(content);
            setCurrentCode(content);
            setError(null);
          } catch (error) {
            console.error('热更新获取文件内容失败:', error);
          }
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
  }, [filePath]);

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
          {/* UI 选择器模式选择 - 仅 HTML 预览模式显示 */}
          {fileType === 'html' && viewMode === 'preview' && uiSelectorEnabled && (
            <ModeSelector
              currentMode={currentMode}
              onModeChange={setCurrentMode}
              disabled={!uiSelectorEnabled}
            />
          )}
          {/* UI 选择器开关 - 仅 HTML 预览模式显示 */}
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
                  onElementHover={setHoverElementInfo}
                  onIntentGenerate={onIntentGenerate}
                  enabled={uiSelectorEnabled}
                  mode={currentMode}
                />
              )}
              
              {/* 悬停提示框 */}
              {uiSelectorEnabled && currentMode === 'select' && (
                <HoverTooltip info={hoverElementInfo} visible={!!hoverElementInfo} />
              )}
            </div>
          )
        )}
      </div>
      
      {/* 状态栏 - 显示当前悬停元素信息 */}
      {uiSelectorEnabled && currentMode === 'select' && (
        <StatusBar info={hoverElementInfo} mode={currentMode} />
      )}
    </div>
  );
}
