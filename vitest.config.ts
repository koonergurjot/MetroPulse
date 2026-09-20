import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.js so the server tests do not load the React
// and Tailwind plugins the frontend build needs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/server/**/*.test.ts'],
  },
});
