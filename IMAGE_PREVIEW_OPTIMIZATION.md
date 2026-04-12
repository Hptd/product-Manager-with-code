# 图片预览优化说明

## 优化内容

### 1. ImageViewer 组件增强

#### 新增功能
- ✅ **加载状态显示** - 图片加载时显示"加载中..."提示
- ✅ **错误处理** - 加载失败时显示错误信息和重试按钮
- ✅ **状态重置** - 切换图片时自动重置缩放、旋转和位置
- ✅ **按钮禁用状态** - 缩放达到极限时禁用对应按钮
- ✅ **键盘快捷键提示** - 工具栏显示快捷键提示

#### 状态管理
```typescript
const [loading, setLoading] = useState(true);      // 加载状态
const [error, setError] = useState(false);          // 错误状态
const [scale, setScale] = useState(100);            // 缩放比例
const [rotation, setRotation] = useState(0);        // 旋转角度
const [position, setPosition] = useState({x: 0, y: 0}); // 位置偏移
```

#### 交互优化
- 缩放范围：25% - 500%
- 旋转：每次 90 度
- 拖拽：仅在缩放 > 100% 时启用
- 滚轮缩放：支持鼠标滚轮快速缩放

### 2. VideoPlayer 组件增强

#### 新增功能
- ✅ **加载状态显示** - 视频加载时显示"加载中..."提示
- ✅ **错误处理** - 加载失败时显示错误信息和重试按钮
- ✅ **状态重置** - 切换视频时自动重置播放状态

### 3. RenderFrame 组件修复

#### 问题修复
- 修复了媒体文件 URL 获取逻辑
- 添加了 URL 清理机制（防止内存泄漏）
- 添加了详细的调试日志

```typescript
// 清理旧的 URL
useEffect(() => {
  return () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  };
}, [imageUrl]);

// 获取媒体 URL
useEffect(() => {
  if (!filePath || (fileType !== 'image' && fileType !== 'video')) {
    setImageUrl('');
    return;
  }
  
  const projectName = filePath.split('/')[0] || 'project-1';
  const relativePath = filePath.includes('/') 
    ? filePath.substring(projectName.length + 1) 
    : filePath;
  
  getMediaUrl(projectName, relativePath).then(url => {
    setImageUrl(url);
  }).catch(err => {
    console.error('获取媒体文件失败:', err);
    setImageUrl('');
  });
}, [filePath, fileType]);
```

### 4. 样式优化

#### ImageViewer.css
- 添加加载状态样式（旋转动画）
- 添加错误状态样式
- 添加按钮禁用状态样式
- 添加自定义滚动条样式

#### VideoPlayer.css
- 添加加载状态样式
- 添加错误状态样式
- 添加视频淡入淡出过渡效果

## 调试日志

### 图片加载成功
```
🔍 获取媒体文件 URL：{ filePath, projectName, relativePath, fileType }
📷 媒体文件 URL：blob:http://localhost:3001/xxx-xxx-xxx
✅ 图片加载成功：{ width: 800, height: 600, src }
```

### 图片加载失败
```
❌ 获取媒体文件失败：Error: ...
```

## 使用场景

### 图片查看
1. 点击左侧文件树中的图片文件（.png, .jpg, .gif, .svg, .webp 等）
2. 等待图片加载（显示"加载中..."）
3. 使用工具栏控制：
   - 🔍− / 🔍+ : 缩小/放大
   - ↶ / ↷ : 向左/向右旋转
   - ⟲ 重置 : 恢复默认状态
4. 鼠标滚轮快速缩放
5. 缩放 > 100% 时可拖拽查看

### 视频播放
1. 点击左侧文件树中的视频文件（.mp4, .mov, .avi, .webm 等）
2. 等待视频加载
3. 使用播放器控制：
   - 播放/暂停
   - 停止
   - 进度条拖动
   - 音量调节
   - 播放速度调整
   - 全屏切换

## 快捷键

| 功能 | 快捷键 |
|------|--------|
| 放大 | `+` |
| 缩小 | `-` |
| 重置 | `0` |
| 左旋转 | `L` |
| 右旋转 | `R` |

## 技术细节

### Blob URL 管理
```typescript
// 创建 Blob URL
const url = URL.createObjectURL(blob);

// 清理 Blob URL（防止内存泄漏）
URL.revokeObjectURL(url);
```

### MIME 类型映射
后端 `/api/file/blob` 接口根据文件扩展名自动设置正确的 Content-Type：
- `.png` → `image/png`
- `.jpg` → `image/jpeg`
- `.gif` → `image/gif`
- `.svg` → `image/svg+xml`
- `.webp` → `image/webp`
- `.mp4` → `video/mp4`
- 等

## 测试方法

1. 访问 http://localhost:3000
2. 选择包含图片/视频的项目
3. 点击不同类型的文件测试：
   - 图片：检查加载状态、缩放、旋转功能
   - 视频：检查播放控制
   - 大文件：测试加载性能
   - 错误文件：测试错误处理

## 已知问题

无

## 后续优化建议

1. **图片预览**
   - 添加图片画廊模式
   - 支持多图浏览
   - 添加图片信息 EXIF 显示

2. **视频播放**
   - 添加弹幕功能
   - 支持播放列表
   - 添加截图功能

3. **性能优化**
   - 图片懒加载
   - 视频预加载
   - 缩略图生成
