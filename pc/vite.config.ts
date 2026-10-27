import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  const proxy = {
    '/api': {
      target: env.PC_API_TARGET || 'http://127.0.0.1:8080', changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
      configure: (server: import('vite').HttpProxy.Server) => {
        server.on('proxyReq', request => {
          for (const header of ['authorization', 'cookie', 'x-wx-openid', 'x-wx-unionid', 'x-wx-from-openid']) request.removeHeader(header)
        })
      },
    },
  }
  return {
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '0.0.0.0', port: 5174, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: 5174, strictPort: true, proxy },
  build: { outDir: '../dist/pc', emptyOutDir: true },
  }
})
