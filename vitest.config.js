import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    pool: 'threads',
    threads: {
      singleThread: true,
      isolate: false,
    },
    maxWorkers: 1,
  },
});
