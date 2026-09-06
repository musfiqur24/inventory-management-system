import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// A virtual entry keeps Tailwind's build directives out of application CSS files.
const tailwindEntry = fileURLToPath(new URL('./tailwind.virtual.css', import.meta.url)).replaceAll('\\', '/')

export default defineConfig({
  plugins: [
    {
      name: 'tailwind-entry',
      resolveId(id) { if (id === 'virtual:tailwind.css') return tailwindEntry },
      load(id) {
        if (id === tailwindEntry) return `
          @import "tailwindcss";
          @theme {
            @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slide-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          }
        `
      },
    },
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
