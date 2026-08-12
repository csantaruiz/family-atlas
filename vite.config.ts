/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { atlasApiPlugin } from './vite.atlas-api-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), atlasApiPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
