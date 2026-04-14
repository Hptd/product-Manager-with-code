import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { getToken } from '../api/client';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  cwd?: string;
  projectName?: string;
}

export function Terminal({ cwd, projectName }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionId = useRef<string>(`terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // 创建终端实例 - Windows PowerShell 风格配置
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#cccccc',
        cursorAccent: '#0c0c0c',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#0c0c0c',
        red: '#c50f1f',
        green: '#16c60c',
        yellow: '#f9f1a5',
        blue: '#0984e3',
        magenta: '#b741c5',
        cyan: '#00cec9',
        white: '#cccccc',
        brightBlack: '#767676',
        brightRed: '#e74856',
        brightGreen: '#23d18b',
        brightYellow: '#fcfc84',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      },
      convertEol: true,
      scrollback: 1000,
      tabStopWidth: 8,
      drawBoldTextInBrightColors: true,
      disableStdin: false,
      allowProposedApi: true,
      lineHeight: 1.3,
      cols: 60,
      rows: 20,
      rightClickSelectsWord: true
    });

    // 添加插件
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    // 先显示连接中状态
    term.write('\r\n\x1b[33m🔌 正在连接终端...\x1b[0m\r\n\r\n');

    // 获取当前用户的项目目录
    const token = getToken();
    let targetCwd = cwd;
    
    if (!targetCwd && projectName) {
      // 使用用户项目目录
      targetCwd = `project:${projectName}`;
    } else if (!targetCwd) {
      // 默认使用用户项目根目录
      targetCwd = 'project:';
    }

    // 连接 WebSocket 到后端 PTY - 添加 token 认证
    const wsUrl = `ws://localhost:3002?terminal=true&session=${sessionId.current}&project=${encodeURIComponent(projectName || '')}&token=${token || ''}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🔌 Terminal WebSocket connected');
      setConnected(true);
      term.write('\r\n\x1b[32m✅ 已连接到 PowerShell\x1b[0m\r\n\r\n');
      // 聚焦终端以便输入
      setTimeout(() => term.focus(), 100);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'terminal-data') {
          term.write(msg.data);
        }

        if (msg.type === 'terminal-ready') {
          console.log('Terminal ready');
        }

        if (msg.type === 'terminal-error') {
          console.error('Terminal error:', msg.error);
          setError(msg.error);
          term.write(`\r\n\x1b[31m❌ 终端错误：${msg.error}\x1b[0m\r\n`);
        }

        if (msg.type === 'terminal-exit') {
          term.write(`\r\n\x1b[33m⚠️  终端已退出 (code: ${msg.exitCode})\x1b[0m\r\n`);
        }
      } catch (error) {
        console.error('Error parsing terminal message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Terminal WebSocket error:', error);
      setError('WebSocket 连接失败');
      term.write('\r\n\x1b[31m❌ WebSocket 连接失败\x1b[0m\r\n');
    };

    ws.onclose = () => {
      console.log('🔌 Terminal WebSocket disconnected');
      setConnected(false);
      if (terminalInstance.current) {
        term.write('\r\n\x1b[33m⚠️  连接已断开\x1b[0m\r\n');
      }
    };

    // 终端输入 → WebSocket → 后端 PTY
    const onTerminalData = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'terminal-input',
          session: sessionId.current,
          data
        }));
      }
    };

    term.onData(onTerminalData);

    // 窗口大小变化 - 使用防抖
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN && terminalInstance.current) {
          ws.send(JSON.stringify({
            type: 'terminal-resize',
            session: sessionId.current,
            cols: term.cols,
            rows: term.rows
          }));
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    terminalInstance.current = term;

    // 初始适配
    setTimeout(handleResize, 100);

    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      term.dispose();
    };
  }, [cwd]);

  return (
    <div className="terminal-container-full">
      <div className="terminal-header-full">
        <span className="terminal-title">💻 PowerShell - AI Code CLI</span>
        <span className="terminal-subtitle">
          {connected ? '🟢 已连接' : error ? '🔴 错误' : '🟡 连接中'}
        </span>
      </div>
      <div ref={terminalRef} className="terminal-content-full" />
    </div>
  );
}
