import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => {
  const plugins = [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        inlineWorkboxRuntime: true
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Click-Go',
        short_name: 'Click-Go',
        description: 'PWA para pedidos de almacén',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]

  if (command === 'serve') {
    plugins.unshift({
      name: 'click-go-express-api',
      async configureServer(server) {
        const { app: apiApp } = await import('./server.js')
        server.middlewares.use(apiApp)
      }
    })
  }

  return { plugins }
})


