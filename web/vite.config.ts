import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'path'

const getBasePath = () => {
  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (!repository) return '/'
  if (repository.endsWith('.github.io')) return '/'
  return `/${repository}/`
}

// 拡張の public から art-cruise の音源/背景を web の public へ複製する。
// dev / build どちらでも buildStart で走り、複製先は git 管理外。
const copyArtCruiseAssets = (): Plugin => {
  const src = path.resolve(__dirname, '../public/assets/art-cruise')
  const dest = path.resolve(__dirname, 'public/assets/art-cruise')
  const subdirs = ['audio', 'mandala']
  return {
    name: 'copy-art-cruise-assets',
    buildStart() {
      for (const sub of subdirs) {
        const from = path.join(src, sub)
        if (!fs.existsSync(from)) continue
        fs.cpSync(from, path.join(dest, sub), { recursive: true })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(() => ({
  base: getBasePath(),
  plugins: [copyArtCruiseAssets(), tailwindcss(), react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        ja: path.resolve(__dirname, 'ja/index.html'),
        artCruise: path.resolve(__dirname, 'art-cruise/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
}))
