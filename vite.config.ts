/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { capturePlugin } from './plugins/capture.ts';
import { imageHotPlugin } from './plugins/image-hot.ts';
import { recordingPlugin } from './plugins/recording.ts';
import { shaderPlugin } from './plugins/shader.ts';
import { sketchWatchPlugin } from './plugins/sketch-watch.ts';

export default defineConfig({
  plugins: [shaderPlugin(), sketchWatchPlugin(), imageHotPlugin(), capturePlugin(), recordingPlugin()],
  resolve: {
    // `sketch.ts` imports defineSketch/prev from 'playground' (#12); keep in step with tsconfig paths.
    alias: { playground: fileURLToPath(new URL('./src/sketch/define.ts', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
