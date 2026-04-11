import { useState, useEffect, useRef } from 'react';
import './CodeEditor.css';

interface CodeEditorProps {
  filePath: string;
  fileContent: string;
  fileType: 'html' | 'css' | 'js' | 'json' | 'text';
  onSave?: (content: string) => Promise<void>;
  onContentChange?: (content: string) => void;
}

export function CodeEditor({ filePath, fileContent, fileType, onSave, onContentChange }: CodeEditorProps) {
  const [code, setCode] = useState(fileContent);
  const [isModified, setIsModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // 同步文件内容变化
  useEffect(() => {
    setCode(fileContent);
    setIsModified(false);
  }, [fileContent]);

  // 处理代码变化
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    setIsModified(newCode !== fileContent);
    onContentChange?.(newCode);
  };

  // 处理保存
  const handleSave = async () => {
    if (!onSave || !isModified) return;

    setIsSaving(true);
    try {
      await onSave(code);
      setIsModified(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 同步滚动行号
  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // 生成行号
  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  // 获取文件类型图标
  const getFileIcon = () => {
    switch (fileType) {
      case 'html': return '📄';
      case 'css': return '🎨';
      case 'js': return '📜';
      case 'json': return '📋';
      default: return '📝';
    }
  };

  return (
    <div className="code-editor">
      {/* 编辑器头部 */}
      <div className="code-editor-header">
        <div className="file-info">
          <span className="file-icon">{getFileIcon()}</span>
          <span className="file-path">{filePath}</span>
          {isModified && <span className="modified-indicator">●</span>}
        </div>
        <div className="editor-actions">
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={!isModified || isSaving}
            title={isModified ? '保存修改 (Ctrl+S)' : '无修改'}
          >
            {isSaving ? '💾 保存中...' : '💾 保存'}
          </button>
          {showSaveSuccess && <span className="save-success">✅ 已保存</span>}
        </div>
      </div>

      {/* 编辑器主体 */}
      <div className="code-editor-body">
        {/* 行号 */}
        <div ref={lineNumbersRef} className="line-numbers">
          {lineNumbers.map(num => (
            <div key={num} className="line-number">{num}</div>
          ))}
        </div>

        {/* 代码编辑区 */}
        <textarea
          ref={textareaRef}
          className="code-textarea"
          value={code}
          onChange={handleCodeChange}
          onScroll={handleScroll}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
      </div>

      {/* 状态栏 */}
      <div className="code-editor-footer">
        <span className="status-info">
          {lineCount} 行 | {code.length} 字符
        </span>
        <span className="file-type-badge">{fileType.toUpperCase()}</span>
      </div>
    </div>
  );
}
