# 多文件类型渲染支持 - 问题修复说明

## 问题描述
上传多个格式的文件后，点击选择在核心渲染界面没有看到对应的预览效果。

## 问题原因

### 1. App.tsx 中文件内容加载逻辑不完整
**原代码**只加载 HTML 文件内容：
```typescript
if (path.endsWith('.html') || path.endsWith('.htm')) {
  // 加载内容
}
```

**修复后**支持所有文本文件：
```typescript
const textExts = ['.html', '.htm', '.md', '.markdown', '.txt', '.css', '.js', '.ts', '.jsx', '.tsx', '.json', '.py', '.xml', '.yaml', '.yml'];
const isTextFile = textExts.some(ext => path.toLowerCase().endsWith(ext));
if (isTextFile) {
  // 加载内容
}
```

### 2. RenderFrame.tsx 中媒体文件 URL 获取时机问题
**原代码**在文件内容变化的 useEffect 中获取媒体 URL，逻辑耦合。

**修复后**独立 useEffect 专门处理媒体文件 URL 获取，并添加调试日志。

## 修复内容

### 修改的文件
1. `web/src/App.tsx`
   - `handleSelectFile` - 支持所有文本文件类型
   - `handleFileChange` - 支持所有文本文件类型（热更新）

2. `web/src/components/RenderFrame.tsx`
   - 独立 `useEffect` 获取媒体文件 URL
   - 添加调试日志

## 支持的文件类型

| 类型 | 扩展名 | 渲染方式 | 功能 |
|------|--------|---------|------|
| HTML | `.html`, `.htm` | iframe | 刷新/编辑/UI 选择器 |
| 图片 | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`, `.bmp` | ImageViewer | 缩放/旋转/重置 |
| 视频 | `.mp4`, `.mov`, `.avi`, `.webm`, `.ogg`, `.mkv`, `.flv` | VideoPlayer | 播放控制 |
| Markdown | `.md`, `.markdown` | MarkdownViewer | 预览/编辑切换 |
| 文本/代码 | `.txt`, `.json`, `.py`, `.js`, `.ts`, `.css` 等 | CodeEditor | 编辑保存 |

## 测试方法

### 1. 启动服务
```bash
npm run dev
```

访问 http://localhost:3000

### 2. 上传测试文件
- 右键点击项目文件夹 → 上传文件
- 或直接拖拽文件到上传区域

### 3. 测试各类文件
1. **图片文件** - 点击 `.png`/`.jpg` 文件，应显示图片查看器
2. **视频文件** - 点击 `.mp4` 文件，应显示视频播放器
3. **Markdown** - 点击 `.md` 文件，应显示渲染效果，可切换编辑
4. **代码文件** - 点击 `.js`/`.py`/`.txt`，应显示代码编辑器

### 4. 检查调试日志
打开浏览器控制台，查看：
- `🔍 获取媒体文件 URL:` - 媒体文件加载日志
- `📷 媒体文件 URL:` - URL 获取成功日志
- `❌ 获取媒体文件失败:` - 错误日志

## 常见问题排查

### 图片/视频不显示
1. 检查浏览器控制台是否有错误日志
2. 检查文件路径是否正确
3. 检查后端 `/api/file/blob` 接口是否正常工作

### Markdown 不渲染
1. 确认文件扩展名为 `.md` 或 `.markdown`
2. 检查是否安装了 `react-markdown` 依赖

### 代码文件无法编辑
1. 确认文件类型在支持列表中
2. 检查是否处于代码编辑模式

## 后端 API 说明

### `/api/file/blob` - 二进制文件读取
```
GET /api/file/blob?project=project-1&path=logo.png
```
返回：二进制文件流（Content-Type 根据扩展名自动设置）

### MIME 类型映射
```typescript
{
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  // ...
}
```
