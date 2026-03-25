import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const getBasePath = () => {
  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (!repository) return '/'
  if (repository.endsWith('.github.io')) return '/'
  return `/${repository}/`
}

// https://vite.dev/config/
export default defineConfig(() => ({
  base: getBasePath(),
  plugins: [tailwindcss(), react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        ja: path.resolve(__dirname, 'ja/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
