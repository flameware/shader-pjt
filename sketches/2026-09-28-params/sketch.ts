import { defineSketch } from 'playground';

// `field` and `main` both include common.glsl, so they share the one `speed` Parameter.
export default defineSketch({
  title: 'Parameters',
  passes: {
    main: { channels: ['field'] },
  },
});
