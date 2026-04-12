import { useState, useRef, useEffect } from 'react';
import './ImageViewer.css';

interface ImageViewerProps {
  src: string;
  fileName: string;
}

export function ImageViewer({ src, fileName }: ImageViewerProps) {
  const [scale, setScale] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 图片加载完成后获取尺寸信息
  const handleImageLoad = () => {
    setLoading(false);
    setError(false);
    if (imgRef.current) {
      setImageSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight
      });
      console.log('✅ 图片加载成功:', {
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
        src
      });
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoading(false);
    setError(true);
    console.error('❌ 图片加载失败:', {
      fileName,
      src,
      error: e
    });
  };

  // 重置状态当 src 变化
  useEffect(() => {
    setLoading(true);
    setError(false);
    setScale(100);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  // 缩放控制
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 25, 500));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 25, 25));
  };

  const handleReset = () => {
    setScale(100);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // 旋转控制
  const handleRotateLeft = () => {
    setRotation(prev => prev - 90);
  };

  const handleRotateRight = () => {
    setRotation(prev => prev + 90);
  };

  // 拖拽功能
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 100) {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -25 : 25;
    setScale(prev => Math.min(Math.max(prev + delta, 25), 500));
  };

  // 获取文件格式
  const getFileFormat = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN';
    return ext;
  };

  return (
    <div className="image-viewer">
      {/* 工具栏 */}
      <div className="image-viewer-toolbar">
        <div className="image-viewer-toolbar-group">
          <button 
            onClick={handleZoomOut} 
            title="缩小 (-)" 
            className="toolbar-btn"
            disabled={scale <= 25}
          >
            🔍−
          </button>
          <span className="zoom-level">{scale}%</span>
          <button 
            onClick={handleZoomIn} 
            title="放大 (+)" 
            className="toolbar-btn"
            disabled={scale >= 500}
          >
            🔍+
          </button>
        </div>

        <div className="image-viewer-toolbar-group">
          <button onClick={handleRotateLeft} title="向左旋转 (L)" className="toolbar-btn">
            ↶
          </button>
          <button onClick={handleRotateRight} title="向右旋转 (R)" className="toolbar-btn">
            ↷
          </button>
        </div>

        <div className="image-viewer-toolbar-group">
          <button onClick={handleReset} title="重置 (0)" className="toolbar-btn toolbar-btn-reset">
            ⟲ 重置
          </button>
        </div>

        <div className="image-viewer-info">
          {imageSize && (
            <span className="image-info">
              {imageSize.width} × {imageSize.height} px | {getFileFormat(fileName)}
            </span>
          )}
        </div>
      </div>

      {/* 图片展示区域 */}
      <div
        ref={containerRef}
        className="image-viewer-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        style={{ cursor: scale > 100 && !loading ? 'grab' : 'default' }}
      >
        {loading && (
          <div className="image-viewer-loading">
            <div className="loading-spinner">⏳</div>
            <span>加载中...</span>
          </div>
        )}
        
        {error && (
          <div className="image-viewer-error">
            <div className="error-icon">⚠️</div>
            <span>图片加载失败</span>
            <button onClick={() => window.location.reload()} className="retry-btn">
              重试
            </button>
          </div>
        )}

        <img
          ref={imgRef}
          src={src}
          alt={fileName}
          className={`image-viewer-image ${loading ? 'loading' : ''}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            transform: `scale(${scale / 100}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
            opacity: loading ? 0 : 1
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
