import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    command === 'serve' ? basicSsl() : null
  ].filter(Boolean),
  server: {
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
    target: 'es2015',
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react', 'recharts'],
          'vendor-utils': ['firebase/app', 'firebase/firestore', 'file-saver']
        }
      }
    }
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
}))