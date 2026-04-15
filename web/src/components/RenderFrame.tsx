import { useRef, useEffect, useState } from 'react';
import { UISelectorOverlay, type UISelectorInfo, type SelectorMode, type UIIntent, type HoverElementInfo } from './UISelector';
import { ModeSelector, UISelectorDisplay } from './UISelectorComponents';
import { HoverTooltip, StatusBar } from './UISelectorTooltip';
import { CodeEditor } from './CodeEditor';
import { ImageViewer } from './ImageViewer';
import { VideoPlayer } from './VideoPlayer';
import { MarkdownViewer } from './MarkdownViewer';
import { api } from '../api/client';
import { extractResourcePaths, exportToZip, isTextFile, type ResourceFile } from '../utils/exportHelper';
import './RenderFrame.css';

interface RenderFrameProps {
  filePath?: string;
  fileContent?: string;
  projectName?: string;  // 新增项目名参数
  onFileChange?: (path: string) => void;
  onElementSelect?: (info: UISelectorInfo) => void;
  onIntentGenerate?: (intent: UIIntent) => void;
  onRefresh?: () => void;
}

type ViewMode = 'preview' | 'code';
type FileType = 
  | 'html' | 'css' | 'js' | 'json' | 'text' | 'markdown' | 'image' | 'video' | 'unknown';

export function RenderFrame({ filePath, fileContent, projectName = 'project-1', onFileChange, onElementSelect, onIntentGenerate, onRefresh }: RenderFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uiSelectorEnabled, setUiSelectorEnabled] = useState(false);
  const [currentMode, setCurrentMode] = useState<SelectorMode>('select');
  const [hoverElementInfo, setHoverElementInfo] = useState<HoverElementInfo | null>(null);

  // 视图模式和编辑状态
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [currentCode, setCurrentCode] = useState<string>('');
  const [fileType, setFileType] = useState<FileType>('unknown');
  const [imageUrl, setImageUrl] = useState<string>('');

  // 导出状态
  const [isExporting, setIsExporting] = useState(false);

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
    // 使用相对路径，通过 Vite 代理转发到后端
    const apiBaseUrl = '/api';
    // 从 localStorage 获取 token 并附加到 URL
    const token = localStorage.getItem('accessToken');
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `${apiBaseUrl}/file/blob?project=${projectName}&path=${encodeURIComponent(filePath)}${tokenParam}`;
  };

  // 为 HTML 内容添加 base 标签，解决相对路径问题
  // 由于浏览器会将相对路径拼接到 base URL 的路径部分（而非查询参数），
  // 我们需要直接替换 HTML 中的相对资源路径为绝对 API URL
  const addBaseTag = (html: string, filePath: string) => {
    if (!filePath || !html) return html;

    // 使用组件的 projectName prop（而不是从 filePath 提取）
    // filePath 格式：indexx.html 或 assets/file.html（相对于项目目录）
    // 直接使用组件 prop 中的 projectName
    const htmlProjectName = projectName || 'project-1';

    // 计算文件所在目录
    const parts = filePath.split('/');
    const dirPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';

    // 构建 API 基础 URL（使用相对路径）
    const apiBaseUrl = '/api';

    console.log('[addBaseTag]', { filePath, htmlProjectName, dirPath });

    // 从 localStorage 获取 token
    const token = localStorage.getItem('accessToken');
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';

    // 构建资源路径转换函数
    const buildResourceUrl = (resourcePath: string) => {
      return `${apiBaseUrl}/file/blob?project=${htmlProjectName}&path=${encodeURIComponent(resourcePath)}${tokenParam}`;
    };

    // 替换 HTML 中的相对资源路径为绝对 API URL
    // 匹配 src="xxx"、src='xxx'、href="xxx"、href='xxx'
    const replaceRelativePath = (match: string, attr: string, quote: string, relativePath: string) => {
      // 跳过绝对路径、data URI、锚点、javascript 等
      if (relativePath.startsWith('http://') ||
          relativePath.startsWith('https://') ||
          relativePath.startsWith('data:') ||
          relativePath.startsWith('#') ||
          relativePath.startsWith('javascript:') ||
          relativePath.startsWith('mailto:')) {
        return match;
      }

      // 处理 Windows 本地绝对路径（如 F:\js-vue-project\...\image.png）
      // 提取相对于项目目录的路径
      if (relativePath.includes('\\') && !relativePath.startsWith('http')) {
        // 规范化路径分隔符
        const normalizedPath = relativePath.replace(/\\/g, '/');

        // 尝试提取 project-1 之后的路径
        const projectMatch = normalizedPath.match(/project-1[\/\\](.+)$/i);
        if (projectMatch) {
          // 找到了项目相对路径
          const resourcePath = projectMatch[1];
          const absoluteUrl = buildResourceUrl(resourcePath);
          console.log('[replaceRelativePath] Windows 路径转换:', relativePath, '->', absoluteUrl);
          return `${attr}${quote}${absoluteUrl}${quote}`;
        }

        // 如果没找到项目名，只提取文件名（假设在项目根目录）
        const fileName = normalizedPath.split('/').pop() || '';
        const absoluteUrl = buildResourceUrl(fileName);
        console.log('[replaceRelativePath] Windows 路径转换（仅文件名）:', relativePath, '->', absoluteUrl);
        return `${attr}${quote}${absoluteUrl}${quote}`;
      }

      // 计算资源相对于项目目录的完整路径
      let resourcePath: string;
      if (relativePath.startsWith('/')) {
        // 绝对路径（相对于项目根目录）
        resourcePath = relativePath.substring(1);
      } else if (relativePath.startsWith('./')) {
        // 当前目录
        resourcePath = dirPath ? `${dirPath}/${relativePath.substring(2)}` : relativePath.substring(2);
      } else if (relativePath.startsWith('../')) {
        // 父目录 - 简单处理，不考虑多级
        const parentDir = dirPath.substring(0, dirPath.lastIndexOf('/'));
        resourcePath = parentDir ? `${parentDir}/${relativePath.substring(3)}` : relativePath.substring(3);
      } else {
        // 普通相对路径
        resourcePath = dirPath ? `${dirPath}/${relativePath}` : relativePath;
      }

      // 构建绝对 API URL
      const absoluteUrl = buildResourceUrl(resourcePath);
      return `${attr}${quote}${absoluteUrl}${quote}`;
    };

    // 替换 src 和 href 属性中的相对路径
    let processedHtml = html.replace(
      /(src\s*=\s*|href\s*=\s*)(["'])([^"']+?)\2/gi,
      replaceRelativePath
    );

    // 替换 JavaScript 中的 viewMedia('path', 'type') 调用
    // 例如：viewMedia('assets/胡图.png', '图片') -> viewMedia('http://localhost:3001/...', '图片')
    processedHtml = processedHtml.replace(
      /viewMedia\s*\(\s*(['"])([^'"]+?)\1\s*,\s*(['"])([^'"]*?)\3\s*\)/g,
      (match, q1, path, q2, type) => {
        // 跳过已经是绝对路径的情况
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
          return match;
        }

        // 处理 Windows 路径
        let resourcePath: string;
        if (path.includes('\\')) {
          const normalizedPath = path.replace(/\\/g, '/');
          const projectMatch = normalizedPath.match(/project-1[\/\\](.+)$/i);
          resourcePath = projectMatch ? projectMatch[1] : path.split(/[\\\/]/).pop() || '';
        } else if (path.startsWith('/')) {
          resourcePath = path.substring(1);
        } else if (path.startsWith('./')) {
          resourcePath = dirPath ? `${dirPath}/${path.substring(2)}` : path.substring(2);
        } else if (path.startsWith('../')) {
          const parentDir = dirPath.substring(0, dirPath.lastIndexOf('/'));
          resourcePath = parentDir ? `${parentDir}/${path.substring(3)}` : path.substring(3);
        } else {
          resourcePath = dirPath ? `${dirPath}/${path}` : path;
        }

        const absoluteUrl = buildResourceUrl(resourcePath);
        console.log('[viewMedia] 路径转换:', path, '->', absoluteUrl);
        return `viewMedia(${q1}${absoluteUrl}${q1}, ${q2}${type}${q2})`;
      }
    );

    // 注入全局样式：统一处理 code/pre 标签的换行行为
    const injectedStyles = `
    <style>
      /* 代码块：保留原始格式 + 自动换行 */
      pre, pre code {
        white-space: pre-wrap !important;
        overflow-wrap: break-word !important;
        word-break: break-word !important;
        tab-size: 2;
        max-width: 100%;
        box-sizing: border-box;
      }
      /* 行内代码：不换行，超长时省略号 */
      :not(pre) > code {
        white-space: nowrap !important;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        display: inline-block;
        vertical-align: baseline;
      }
      /* 确保所有内容不溢出容器 */
      pre, code, p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6 {
        max-width: 100%;
        box-sizing: border-box;
      }
    </style>
    `;

    // 在 </head> 前注入样式，如果没有 </head> 则在内容最前插入
    if (processedHtml.includes('</head>')) {
      processedHtml = processedHtml.replace('</head>', injectedStyles + '</head>');
    } else {
      processedHtml = injectedStyles + processedHtml;
    }

    console.log('[addBaseTag] 原始 HTML:', html.substring(0, 500));
    console.log('[addBaseTag] 处理后 HTML:', processedHtml.substring(0, 500));

    return processedHtml;
  };

  // 处理文件内容变化
  useEffect(() => {
    if (fileContent !== undefined && filePath) {
      const type = detectFileType(filePath);
      setFileType(type);

      // HTML 文件：处理路径后加载
      const processedContent = type === 'html' ? addBaseTag(fileContent, filePath) : fileContent;
      
      console.log('[RenderFrame] 文件内容:', {
        filePath,
        fileType: type,
        processedContent: processedContent.substring(0, 200) + '...'
      });
      
      setSrcDoc(processedContent);
      setCurrentCode(fileContent);
      setError(null);

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
    } else if (fileContent !== undefined) {
      setSrcDoc(fileContent);
      setCurrentCode(fileContent);
      setError(null);
    }
  }, [fileContent, filePath]);

  // 当文件类型是图片/视频时，获取媒体 URL
  useEffect(() => {
    if (!filePath || (fileType !== 'image' && fileType !== 'video')) {
      setImageUrl('');
      return;
    }

    // 解析项目名和文件路径
    // filePath 格式：assets/video.mp4 或 project-1/assets/video.mp4
    const slashIndex = filePath.indexOf('/');
    let mediaProjectName: string;
    let relativePath: string;

    // 判断第一个斜杠前的部分是否是项目名格式
    const firstPart = slashIndex > 0 ? filePath.substring(0, slashIndex) : '';
    const isProjectPrefix = firstPart && !firstPart.includes('.') && 
                            !['assets', 'css', 'js', 'images', 'img', 'videos', 'video'].includes(firstPart.toLowerCase());

    if (isProjectPrefix) {
      // 有项目名：project-1/assets/video.mp4
      mediaProjectName = firstPart;
      relativePath = filePath.substring(slashIndex + 1);
    } else {
      // 没有项目名：assets/video.mp4 或 video.mp4
      mediaProjectName = projectName;
      relativePath = filePath;
    }

    console.log('🔍 获取媒体文件 URL:', { filePath, mediaProjectName, relativePath, fileType });

    // 直接生成 URL，不需要异步请求
    const url = getMediaUrl(mediaProjectName, relativePath);
    console.log('📷 媒体文件 URL:', url);
    setImageUrl(url);
  }, [filePath, fileType, projectName]);

  // 处理热更新消息
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8002');

    ws.onopen = () => {
      console.log('🔌 热更新 WebSocket 已连接');
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'file-change' && filePath) {
        // 路径匹配逻辑
        // 后端发送的路径格式：project-1/assets/index.html（包含项目名）
        // 前端 filePath 格式：assets/index.html（不包含项目名）
        const changedPath = data.path;
        
        // 从 changedPath 中提取不包含项目名的部分
        const slashIndex = changedPath.indexOf('/');
        const changedPathWithoutProject = slashIndex > 0 
          ? changedPath.substring(slashIndex + 1) 
          : changedPath;
        
        const currentFileName = filePath.split('/').pop() || filePath;
        const changedFileName = changedPathWithoutProject.split('/').pop() || changedPathWithoutProject;

        // 检查是否匹配：完全匹配 或 文件名匹配
        const isExactMatch = changedPathWithoutProject === filePath;
        const isNameMatch = currentFileName === changedFileName;

        if (isExactMatch || isNameMatch) {
          console.log('📝 检测到文件变化，重新加载:', filePath, '变更路径:', changedPath);
          // 使用不包含项目名的路径获取文件内容
          try {
            const content = await api.getFileContent(projectName, changedPathWithoutProject);
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
    if (!filePath || !projectName) return;
    // filePath 格式：project-1/index.html，需要提取相对路径
    const relativePath = filePath.includes('/') ? filePath.substring(filePath.indexOf('/') + 1) : filePath;
    await api.saveFileContent(projectName, relativePath, content);
    // 通知父组件文件已更改
    onFileChange?.(filePath);
  };

  // 切换视图模式
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'preview' ? 'code' : 'preview');
  };

  // 导出HTML及其资源
  const handleExport = async () => {
    if (!filePath || !fileContent || fileType !== 'html') {
      alert('当前文件不是HTML文件，无法导出');
      return;
    }

    setIsExporting(true);

    try {
      console.log('[handleExport] 开始导出...', { filePath, projectName });

      // 1. 提取HTML中的所有资源路径
      const resourcePaths = extractResourcePaths(fileContent, filePath);
      console.log('[handleExport] 提取到的资源路径:', resourcePaths);

      if (resourcePaths.length === 0) {
        // 没有外部资源，直接导出HTML
        console.log('[handleExport] 没有外部资源，直接导出HTML');
        await exportToZip(fileContent, filePath.split('/').pop() || 'index.html', [], projectName);
        alert('✅ 导出成功！');
        setIsExporting(false);
        return;
      }

      // 2. 批量获取资源文件
      console.log('[handleExport] 正在获取资源文件...');
      const resourceFiles = await api.getResourceFiles(projectName, resourcePaths);

      // 3. 转换为 ResourceFile 格式
      const files: ResourceFile[] = resourceFiles
        .filter(f => f.exists)
        .map(f => ({
          path: f.path,
          content: f.content || f.base64 || '',
          isText: isTextFile(f.path)
        }));

      const successCount = files.length;
      const failCount = resourcePaths.length - successCount;

      console.log('[handleExport] 获取到的资源文件:', successCount, '个', failCount > 0 ? `(失败 ${failCount} 个)` : '');

      // 4. 导出为ZIP
      const htmlFileName = filePath.split('/').pop() || 'index.html';
      await exportToZip(fileContent, htmlFileName, files, projectName);

      console.log('[handleExport] 导出完成');
      
      if (failCount > 0) {
        alert(`⚠️ 导出完成！成功 ${successCount} 个文件，失败 ${failCount} 个文件`);
      } else {
        alert(`✅ 导出成功！共导出 ${successCount + 1} 个文件`);
      }
    } catch (error) {
      console.error('[handleExport] 导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
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
  const showExportButton = fileType === 'html' && viewMode === 'preview';

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
          {/* 导出按钮 - 仅 HTML 预览模式显示 */}
          {showExportButton && (
            <button
              className="btn-export"
              onClick={handleExport}
              disabled={isExporting}
              title="导出HTML及所有资源文件为ZIP"
            >
              {isExporting ? '⏳ 导出中...' : '📦 导出'}
            </button>
          )}
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
                // sandbox 属性：允许脚本、同源访问、表单、内联资源加载
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
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
