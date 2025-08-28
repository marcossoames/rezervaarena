// Vite plugin to automatically serve WebP images when available
import { defineConfig } from 'vite'

export const webpPlugin = () => {
  return {
    name: 'webp-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url
        
        // If request is for a JPEG/PNG image
        if (url && (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png'))) {
          const webpUrl = url.replace(/\.(jpg|jpeg|png)$/i, '.webp')
          
          // Check if WebP version exists
          try {
            const fs = require('fs')
            const path = require('path')
            const publicDir = path.join(process.cwd(), 'public')
            const webpPath = path.join(publicDir, webpUrl)
            
            if (fs.existsSync(webpPath)) {
              // Serve WebP if browser supports it
              const acceptHeader = req.headers.accept || ''
              if (acceptHeader.includes('image/webp')) {
                req.url = webpUrl
              }
            }
          } catch (error) {
            // Continue with original request if check fails
          }
        }
        
        next()
      })
    }
  }
}