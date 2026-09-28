/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { shaderPlugin } from './plugins/shader.ts';

export default defineConfig({
  plugins: [shaderPlugin()],
  resolve: {
    // `sketch.ts` imports defineSketch/prev from 'playground' (#12); keep in step with tsconfig paths.
    alias: { playground: fileURLToPath(new URL('./src/sketch/define.ts', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
