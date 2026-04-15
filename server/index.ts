import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRouter from './src/routes/auth.js';
import usersRouter from './src/routes/users.js';
import filesRouter from './src/routes/files.js';
import { initializeAdminUser } from './src/utils/initAdmin.js';
import { verifyWebSocketToken } from './src/middleware/auth.js';
import { getUserProjectsDir } from './src/utils/userProjects.js';
import { createSandbox, getSandboxStream, updateSandboxActivity, destroySandbox } from './src/utils/sandbox.js';
import pty from 'node-pty';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const WS_PORT = parseInt(process.env.WS_PORT || '3002');
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

// Rate Limiting - 登录接口限流
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 20, // 每个IP最多20次
  message: { success: false, error: '请求过于频繁，请稍后再试' }
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', loginLimiter);

// 路由
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api', filesRouter);

// 存储终端会话
const terminalSessions = new Map();
// 存储每个 WebSocket 连接的文件监听器
const wsWatchers = new Map<WebSocket, chokidar.FSWatcher>();

// 启动 HTTP 服务
const server = app.listen(PORT, HOST, async () => {
  console.log(`📡 HTTP Server running on http://${HOST === '0.0.0.0' ? '0.0.0.0' : 'localhost'}:${PORT}`);
  await initializeAdminUser();
});

// 启动 WebSocket 服务用于热更新和终端
const wss = new WebSocketServer({ port: WS_PORT, host: HOST });

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url || '', `ws://localhost:${WS_PORT}`);
  
  // WebSocket 认证验证
  const authResult = verifyWebSocketToken(req.url || '');
  
  if (!authResult) {
    console.warn('⚠️ WebSocket 连接认证失败');
    ws.send(JSON.stringify({ type: 'error', error: '认证失败' }));
    ws.close();
    return;
  }

  console.log(`🔌 Client connected: ${authResult.username} (${authResult.role})`);
  
  const sessionId = url.searchParams.get('session') || `default-${Date.now()}`;
  const userId = authResult.userId;
  const userRole = authResult.role;

  // 处理终端会话
  if (url.searchParams.has('terminal')) {
    const project = url.searchParams.get('project') || '';
    const userProjectsDir = getUserProjectsDir(userId);
    const userProjectDir = path.join(userProjectsDir, project);

    // 确保用户项目目录存在
    if (!fs.existsSync(userProjectsDir)) {
      fs.mkdirSync(userProjectsDir, { recursive: true });
    }

    const cwd = fs.existsSync(userProjectDir) ? userProjectDir : userProjectsDir;
    const displayName = project || 'projects';

    try {
      // ✅ 使用沙箱容器代替宿主机进程
      console.log(`📦 创建沙箱终端: user=${userId}, project=${displayName}`);

      const { stream } = await createSandbox(sessionId, userId, project, cwd);

      console.log(`✅ 沙箱终端已创建: session=${sessionId}`);

      // 沙箱输出 → 前端
      stream.on('data', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'terminal-data',
            session: sessionId,
            data: data.toString()
          }));
        }
      });

      // 前端输入 → 沙箱
      ws.on('message', async (message) => {
        try {
          const msg = JSON.parse(message.toString());

          if (msg.type === 'terminal-input' && msg.session === sessionId) {
            // 写入沙箱标准输入
            stream.write(msg.data);
            
            // 更新活动时间
            updateSandboxActivity(sessionId);
          }

          if (msg.type === 'terminal-resize' && msg.session === sessionId) {
            // Docker exec 不支持动态调整终端大小
            console.log(`⚠️  终端大小调整请求 (Docker 不支持动态调整): ${msg.cols}x${msg.rows}`);
          }
        } catch (error) {
          console.error('Error handling terminal message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`🔌 Terminal session ${sessionId} closed`);
        destroySandbox(sessionId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for session ${sessionId}:`, error);
      });

      // 发送欢迎消息
      ws.send(JSON.stringify({
        type: 'terminal-ready',
        session: sessionId
      }));

      return;
    } catch (error) {
      console.error('❌ Failed to spawn terminal:', error);
      ws.send(JSON.stringify({
        type: 'terminal-error',
        session: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      return;
    }
  }

  // 处理文件监听
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());

      if (msg.type === 'watch-project') {
        const projectName = msg.project;

        // 关闭旧的监听器
        const oldWatcher = wsWatchers.get(ws);
        if (oldWatcher) {
          oldWatcher.close();
        }

        const watchDir = path.join(getUserProjectsDir(userId), projectName);

        if (!fs.existsSync(watchDir)) {
          ws.send(JSON.stringify({ type: 'error', error: '项目目录不存在' }));
          return;
        }

        // 创建新的文件监听器
        const watcher = chokidar.watch(watchDir, {
          ignored: /node_modules|[\/\\]\./,
          persistent: true,
          ignoreInitial: true
        });

        watcher.on('change', (filePath) => {
          const relPath = path.relative(watchDir, filePath).replace(/\\/g, '/');
          ws.send(JSON.stringify({
            type: 'file-change',
            path: relPath,
            timestamp: Date.now()
          }));
        });

        watcher.on('add', (filePath) => {
          const relPath = path.relative(watchDir, filePath).replace(/\\/g, '/');
          ws.send(JSON.stringify({
            type: 'file-add',
            path: relPath,
            timestamp: Date.now()
          }));
        });

        watcher.on('unlink', (filePath) => {
          const relPath = path.relative(watchDir, filePath).replace(/\\/g, '/');
          ws.send(JSON.stringify({
            type: 'file-delete',
            path: relPath,
            timestamp: Date.now()
          }));
        });

        wsWatchers.set(ws, watcher);
        console.log(`👀 Watching project: ${projectName} for user: ${authResult.username}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`🔌 WebSocket client disconnected`);
    const watcher = wsWatchers.get(ws);
    if (watcher) {
      watcher.close();
      wsWatchers.delete(ws);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('🛑 HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('🛑 HTTP server closed');
    process.exit(0);
  });
});
