import { useState, useRef, useEffect } from 'react';
import './VideoPlayer.css';

interface VideoPlayerProps {
  src: string;
  fileName: string;
}

export function VideoPlayer({ src, fileName }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 重置状态当 src 变化
  useEffect(() => {
    setLoading(true);
    setError(false);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [src]);

  // 视频加载完成
  const handleLoadedMetadata = () => {
    setLoading(false);
    setError(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      console.log('✅ 视频加载成功:', {
        duration: videoRef.current.duration,
        src
      });
    }
  };

  // 视频加载失败
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setLoading(false);
    setError(true);
    console.error('❌ 视频加载失败:', {
      fileName,
      src,
      error: e
    });
  };

  // 格式化时间 (秒 -> MM:SS 或 HH:MM:SS)
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 时间更新
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // 播放结束
  const handleEnded = () => {
    setIsPlaying(false);
  };

  // 播放/暂停
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // 停止
  const handleStop = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // 进度条拖动
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 音量控制
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  // 静音切换
  const toggleMute = () => {
    if (!videoRef.current) return;

    if (isMuted) {
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  // 播放速度
  const handlePlaybackRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // 全屏切换
  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('全屏失败:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 显示/隐藏控制栏
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2000);
  };

  // 获取文件格式
  const getFileFormat = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN';
    return ext;
  };

  return (
    <div
      className="video-player"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {loading && (
        <div className="video-player-loading">
          <div className="loading-spinner">⏳</div>
          <span>加载中...</span>
        </div>
      )}

      {error && (
        <div className="video-player-error">
          <div className="error-icon">⚠️</div>
          <span>视频加载失败</span>
          <button onClick={() => window.location.reload()} className="retry-btn">
            重试
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        src={src}
        className={`video-player-video ${loading ? 'loading' : ''}`}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleVideoError}
        onClick={togglePlay}
        style={{ opacity: loading ? 0 : 1 }}
      />

      {/* 控制栏 */}
      <div className={`video-player-controls ${showControls ? 'show' : ''}`}>
        {/* 进度条 */}
        <div className="video-player-progress">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="progress-slider"
            step={0.1}
          />
        </div>

        <div className="video-player-controls-row">
          {/* 左侧控制按钮 */}
          <div className="video-player-controls-left">
            <button onClick={togglePlay} className="control-btn" title={isPlaying ? '暂停' : '播放'}>
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            <button onClick={handleStop} className="control-btn" title="停止">
              ⏹️
            </button>

            {/* 音量控制 */}
            <div className="volume-control">
              <button onClick={toggleMute} className="control-btn" title={isMuted ? '取消静音' : '静音'}>
                {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>

            {/* 时间显示 */}
            <span className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* 右侧控制 */}
          <div className="video-player-controls-right">
            {/* 播放速度 */}
            <select
              value={playbackRate}
              onChange={handlePlaybackRateChange}
              className="playback-rate-select"
              title="播放速度"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>

            {/* 全屏按钮 */}
            <button onClick={toggleFullscreen} className="control-btn" title={isFullscreen ? '退出全屏' : '全屏'}>
              {isFullscreen ? '❌' : '⛶'}
            </button>
          </div>
        </div>

        {/* 文件信息 */}
        <div className="video-player-info">
          <span className="video-info">{fileName} | {getFileFormat(fileName)}</span>
        </div>
      </div>

      {/* 暂停提示 */}
      {!isPlaying && currentTime === 0 && (
        <div className="video-player-overlay">
          <div className="video-player-overlay-text">
            <span className="overlay-icon">▶️</span>
            <span className="overlay-hint">点击播放或按空格键</span>
          </div>
        </div>
      )}
    </div>
  );
}
