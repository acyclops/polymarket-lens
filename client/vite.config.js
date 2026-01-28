import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["eb1e5b20aeb6.ngrok-free.app"],
    proxy: {
      "/api": {
        target: "http://localhost:3000", // backend port
        changeOrigin: true,
      },
    }
  }
})
