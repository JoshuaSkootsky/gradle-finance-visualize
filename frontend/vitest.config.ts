import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Fix for vi.stubGlobal issue
    threads: false,
    // Ensure global variables are available
    globalSetup: undefined
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})