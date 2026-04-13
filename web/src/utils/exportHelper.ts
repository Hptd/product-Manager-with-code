import JSZip from 'jszip';

/**
 * 资源文件信息
 */
export interface ResourceFile {
  path: string;          // 相对路径，如 assets/image.png
  content: string;       // 文本文件内容或二进制文件的 base64
  isText: boolean;       // 是否为文本文件
}

/**
 * 从 HTML 内容中提取所有资源路径
 * 
 * 支持提取：
 * - src="xxx" 和 href="xxx" 属性中的路径
 * - viewMedia('path', 'type') 调用中的路径
 * - 处理相对路径和绝对API路径
 */
export function extractResourcePaths(htmlContent: string, htmlFilePath: string): string[] {
  const paths = new Set<string>();
  const apiBaseUrl = 'http://localhost:3001/api/file/blob';

  // 提取 HTML 属性中的路径 (src="xxx", href="xxx")
  const attrRegex = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = attrRegex.exec(htmlContent)) !== null) {
    const path = match[1];
    const normalizedPath = normalizePath(path, apiBaseUrl);
    if (normalizedPath) {
      paths.add(normalizedPath);
    }
  }

  // 提取 viewMedia('path', 'type') 调用中的路径
  const viewMediaRegex = /viewMedia\s*\(\s*["']([^"']+)["']/gi;
  while ((match = viewMediaRegex.exec(htmlContent)) !== null) {
    const path = match[1];
    const normalizedPath = normalizePath(path, apiBaseUrl);
    if (normalizedPath) {
      paths.add(normalizedPath);
    }
  }

  // 提取 style 标签中的 url() 路径
  const urlRegex = /url\s*\(\s*["']?([^"')\s]+)["']?\s*\)/gi;
  while ((match = urlRegex.exec(htmlContent)) !== null) {
    const path = match[1];
    const normalizedPath = normalizePath(path, apiBaseUrl);
    if (normalizedPath) {
      paths.add(normalizedPath);
    }
  }

  console.log('[extractResourcePaths] 提取到的资源路径:', Array.from(paths));
  return Array.from(paths);
}

/**
 * 规范化路径：将API绝对路径转换为相对路径
 */
function normalizePath(path: string, apiBaseUrl: string): string | null {
  // 跳过空路径
  if (!path || path.trim() === '') return null;

  // 跳过特殊路径
  if (path.startsWith('#') || 
      path.startsWith('javascript:') || 
      path.startsWith('mailto:') ||
      path.startsWith('data:') ||
      path.startsWith('blob:')) {
    return null;
  }

  // 如果是绝对HTTP路径，提取其中的path参数
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      const pathParam = url.searchParams.get('path');
      if (pathParam) {
        console.log('[normalizePath] API路径转换为相对路径:', path, '->', pathParam);
        return pathParam;
      }
      // 如果不是API URL，可能是外部资源，跳过
      return null;
    } catch (e) {
      // URL解析失败，可能是无效路径
      return null;
    }
  }

  // 已经是相对路径，直接返回
  return path;
}

/**
 * 将API绝对路径转换为相对路径（用于HTML内容修复）
 */
export function convertApiPathsToRelative(
  htmlContent: string,
  apiBaseUrl: string = 'http://localhost:3001/api/file/blob'
): string {
  let processedHtml = htmlContent;

  // 替换 src 和 href 属性中的API路径
  processedHtml = processedHtml.replace(
    /((?:src|href)\s*=\s*)(["'])([^"']+)["']/gi,
    (match, attr, quote, path) => {
      const relativePath = extractRelativePath(path, apiBaseUrl);
      return relativePath ? `${attr}${quote}${relativePath}${quote}` : match;
    }
  );

  // 替换 viewMedia 调用中的API路径
  processedHtml = processedHtml.replace(
    /viewMedia\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']*)["']\s*\)/gi,
    (match, path, type) => {
      const relativePath = extractRelativePath(path, apiBaseUrl);
      return relativePath ? `viewMedia('${relativePath}', '${type}')` : match;
    }
  );

  // 替换 url() 中的API路径
  processedHtml = processedHtml.replace(
    /url\s*\(\s*["']?([^"')\s]+)["']?\s*\)/gi,
    (match, path) => {
      const relativePath = extractRelativePath(path, apiBaseUrl);
      return relativePath ? `url('${relativePath}')` : match;
    }
  );

  return processedHtml;
}

/**
 * 从路径中提取相对部分
 */
function extractRelativePath(path: string, apiBaseUrl: string): string | null {
  if (!path) return null;

  // 如果是API URL，提取path参数
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      const pathParam = url.searchParams.get('path');
      return pathParam;
    } catch (e) {
      return null;
    }
  }

  // 已经是相对路径
  return path;
}

/**
 * 导出HTML及其资源文件为ZIP
 * 
 * @param htmlContent HTML文件内容
 * @param htmlFileName HTML文件名（如 index.html）
 * @param resourceFiles 资源文件列表
 * @param projectName 项目名称（用于ZIP文件名）
 */
export async function exportToZip(
  htmlContent: string,
  htmlFileName: string,
  resourceFiles: ResourceFile[],
  projectName: string = 'project'
): Promise<void> {
  const zip = new JSZip();

  // 将API绝对路径转换为相对路径
  const processedHtml = convertApiPathsToRelative(htmlContent);

  // 添加HTML文件到ZIP根目录
  zip.file(htmlFileName, processedHtml);

  // 添加资源文件，保持目录结构
  for (const file of resourceFiles) {
    if (!file.path || file.path.trim() === '') continue;

    try {
      if (file.isText) {
        // 文本文件直接添加
        zip.file(file.path, file.content);
      } else {
        // 二进制文件从base64转换
        const binaryString = atob(file.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        zip.file(file.path, bytes);
      }
    } catch (error) {
      console.error(`[exportToZip] 添加文件失败: ${file.path}`, error);
    }
  }

  // 生成ZIP文件
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  // 触发下载
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}_export_${formatDate(new Date())}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('[exportToZip] 导出完成:', a.download);
}

/**
 * 格式化日期为字符串
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}`;
}

/**
 * 判断是否为文本文件
 */
export function isTextFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().split('.').pop();
  const textExts = [
    'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'txt',
    'md', 'markdown', 'svg', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config'
  ];
  return ext ? textExts.includes(ext) : false;
}
