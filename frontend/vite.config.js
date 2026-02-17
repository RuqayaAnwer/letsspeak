import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useLocalBackend = env.VITE_USE_LOCAL_BACKEND === 'true'
  const apiTarget = useLocalBackend ? 'http://127.0.0.1:8000' : 'https://api.letspeak.online'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // محلياً: يمكن التبديل بين الباكند المحلي والسيرفر عبر VITE_USE_LOCAL_BACKEND
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: !useLocalBackend,
        }
      }
    }
  }
})
























