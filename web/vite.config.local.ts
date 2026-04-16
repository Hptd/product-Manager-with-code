import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 本地开发覆盖配置（不修改原 vite.config.ts）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',  // 允许局域网访问
    proxy: {
      '/api': {
        target: 'http://localhost:8001',  // 后端 API 端口
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8002',  // WebSocket 端口
        ws: true
      }
    }
  },
  define: {
    'import.meta.env.VITE_WS_PORT': JSON.stringify(process.env.VITE_WS_PORT || '8002')
  }
})
