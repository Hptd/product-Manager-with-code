import { useRef, useEffect, useState } from 'react';
import { UISelectorOverlay, type UISelectorInfo, type SelectorMode, type UIIntent, type HoverElementInfo } from './UISelector';
import { ModeSelector, UISelectorDisplay } from './UISelectorComponents';
import { HoverTooltip, StatusBar } from './UISelectorTooltip';
import { CodeEditor } from './CodeEditor';
import { ImageViewer } from './ImageViewer';
import { VideoPlayer } from './VideoPlayer';
import { MarkdownViewer } from './MarkdownViewer';
import { api } from '../api/client';
import './RenderFrame.css';

interface RenderFrameProps {
  filePath?: string;
  fileContent?: string;
  onFileChange?: (path: string) => void;
  onElementSelect?: (info: UISelectorInfo) => void;
  onIntentGenerate?: (intent: UIIntent) => void;
  onRefresh?: () => void;
}

type ViewMode = 'preview' | 'code';
type FileType = 
  | 'html' | 'css' | 'js' | 'json' | 'text' | 'markdown' | 'image' | 'video' | 'unknown';

export function RenderFrame({ filePath, fileContent, onFileChange, onElementSelect, onIntentGenerate, onRefresh }: RenderFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uiSelectorEnabled, setUiSelectorEnabled] = useState(true);
  const [currentMode, setCurrentMode] = useState<SelectorMode>('select');
  const [hoverElementInfo, setHoverElementInfo] = useState<HoverElementInfo | null>(null);

  // 视图模式和编辑状态
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [currentCode, setCurrentCode] = useState<string>('');
  const [fileType, setFileType] = useState<FileType>('unknown');
  const [imageUrl, setImageUrl] = useState<string>('');

  // 检测文件类型
  const detectFileType = (path: string): FileType => {
    const lowerPath = path.toLowerCase();
    if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) return 'html';
    if (lowerPath.endsWith('.css')) return 'css';
    if (lowerPath.endsWith('.js') || lowerPath.endsWith('.ts') || lowerPath.endsWith('.jsx') || lowerPath.endsWith('.tsx')) return 'js';
    if (lowerPath.endsWith('.json')) return 'json';
    if (lowerPath.endsWith('.md') || lowerPath.endsWith('.markdown')) return 'markdown';
    
    // 图片格式
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];
    if (imageExts.some(ext => lowerPath.endsWith(ext))) return 'image';
    
    // 视频格式
    const videoExts = ['.mp4', '.mov', '.avi', '.webm', '.ogg', '.mkv', '.flv'];
    if (videoExts.some(ext => lowerPath.endsWith(ext))) return 'video';
    
    // 文本/代码格式
    const textExts = ['.txt', '.py', '.cc', '.cpp', '.h', '.hpp', '.java', '.c', '.cs', '.go', '.rs', '.php', '.rb', '.sh', '.yaml', '.yml', '.xml', '.toml'];
    if (textExts.some(ext => lowerPath.endsWith(ext))) return 'text';
    
    return 'unknown';
  };

  // 获取媒体文件 URL（图片/视频）
  // 直接返回 API 端点 URL，让浏览器自行加载
  // 优势：本地/云端都适用，浏览器自动缓存，无需清理 Blob
  const getMediaUrl = (projectName: string, filePath: string) => {
    // 使用当前 API 基础 URL（自动适配本地和云端）
    const apiBaseUrl = import.meta.env.VITE_API_URL || window.location.protocol + '//' + window.location.hostname + ':3001';
    return `${apiBaseUrl}/api/file/blob?project=${projectName}&path=${encodeURIComponent(filePath)}`;
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
        
        // 根据文件类型设置视图模式
        if (type === 'css' || type === 'js' || type === 'json' || type === 'text' || type === 'unknown') {
          setViewMode('code');
        } else if (type === 'markdown') {
          setViewMode('preview');
        } else if (type === 'image' || type === 'video') {
          setViewMode('preview');
        } else {
          setViewMode('preview');
        }
      }
    }
  }, [fileContent, filePath]);

  // 当文件类型是图片/视频时，获取媒体 URL
  useEffect(() => {
    if (!filePath || (fileType !== 'image' && fileType !== 'video')) {
      setImageUrl('');
      return;
    }
    
    // 解析项目名和文件路径
    // filePath 格式：project-1/logo.png 或 logo.png
    const slashIndex = filePath.indexOf('/');
    let projectName: string;
    let relativePath: string;
    
    if (slashIndex > 0) {
      // 有项目名：project-1/logo.png
      projectName = filePath.substring(0, slashIndex);
      relativePath = filePath.substring(slashIndex + 1);
    } else {
      // 没有项目名：使用默认项目名
      projectName = 'project-1';
      relativePath = filePath;
    }
    
    console.log('🔍 获取媒体文件 URL:', { filePath, projectName, relativePath, fileType });
    
    // 直接生成 URL，不需要异步请求
    const url = getMediaUrl(projectName, relativePath);
    console.log('📷 媒体文件 URL:', url);
    setImageUrl(url);
  }, [filePath, fileType]);

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

  // 判断是否显示功能按钮
  const showRefreshButton = fileType === 'html';
  const showEditButton = fileType === 'html' || fileType === 'markdown';
  const showUISelector = fileType === 'html' && viewMode === 'preview';

  return (
    <div className="render-frame">
      <div className="render-frame-header">
        <div className="render-frame-header-left">
          {showRefreshButton && (
            <button
              className="btn-refresh"
              onClick={() => onRefresh?.()}
              title="刷新当前文件（Ctrl+R）"
              disabled={!filePath}
            >
              🔃
            </button>
          )}
          <span className="render-frame-title">
            {fileType === 'html' && '📄'}
            {fileType === 'css' && '🎨'}
            {fileType === 'js' && '📜'}
            {fileType === 'json' && '📋'}
            {fileType === 'text' && '📝'}
            {fileType === 'markdown' && '📘'}
            {fileType === 'image' && '🖼️'}
            {fileType === 'video' && '🎬'}
            {fileType === 'unknown' && '📁'}
            {viewMode === 'preview' ? '预览' : '编辑'}：{filePath}
          </span>
          <span className="render-frame-status">{error ? '❌ 错误' : '✅ 正常'}</span>
        </div>
        <div className="render-frame-header-right">
          {/* 编辑代码按钮 - HTML 和 Markdown 显示 */}
          {showEditButton && (
            <button className="view-mode-toggle" onClick={toggleViewMode} title="切换预览/代码">
              {viewMode === 'preview' ? '📝 编辑代码' : '👁️ 预览'}
            </button>
          )}
          {/* 保存按钮 - 代码编辑模式显示（除了 HTML 预览模式） */}
          {viewMode === 'code' && (
            <label className="ui-selector-toggle" style={{ background: 'rgba(76, 175, 80, 0.2)' }}>
              <span>💾 编辑模式</span>
            </label>
          )}
          {/* UI 选择器模式选择 - 仅 HTML 预览模式显示 */}
          {showUISelector && uiSelectorEnabled && (
            <ModeSelector
              currentMode={currentMode}
              onModeChange={setCurrentMode}
              disabled={!uiSelectorEnabled}
            />
          )}
          {/* UI 选择器开关 - 仅 HTML 预览模式显示 */}
          {showUISelector && (
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
              fileType={
                fileType === 'unknown' || fileType === 'image' || fileType === 'video'
                  ? 'text'
                  : fileType === 'markdown'
                  ? 'text'
                  : fileType
              }
              onSave={handleSave}
              onContentChange={setCurrentCode}
            />
          ) : fileType === 'image' && imageUrl ? (
            // 图片预览
            <ImageViewer src={imageUrl} fileName={filePath.split('/').pop() || filePath} />
          ) : fileType === 'video' && imageUrl ? (
            // 视频预览
            <VideoPlayer src={imageUrl} fileName={filePath.split('/').pop() || filePath} />
          ) : fileType === 'markdown' ? (
            // Markdown 预览
            <MarkdownViewer content={srcDoc} fileName={filePath.split('/').pop() || filePath} />
          ) : (
            // HTML 预览（默认）
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
