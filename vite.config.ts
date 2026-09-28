/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { shaderPlugin } from './plugins/shader.ts';

export default defineConfig({
  plugins: [shaderPlugin()],
  test: {
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
  },
});
