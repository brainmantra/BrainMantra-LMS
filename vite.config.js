import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand-logo.jpeg', 'icons.svg'],
      manifest: {
        name: 'Brain Mantra',
        short_name: 'Brain Mantra',
        description: 'Interactive Abacus learning app for students',
        theme_color: '#0c0e15',
        icons: [
          {
            src: 'brand-logo.jpeg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'brand-logo.jpeg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}']
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
