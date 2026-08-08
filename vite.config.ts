import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
})
