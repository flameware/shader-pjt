import { describe, expect, it } from 'vitest';
import { sizeLimitProblem } from './limits';

describe('sizeLimitProblem', () => {
  const limits = { maxTextureSize: 4096, maxRenderbufferSize: 8192, maxViewportDims: [8192, 3000] as const };

  it('passes sizes within every limit', () => {
    expect(sizeLimitProblem([[4096, 3000], [16, 16]], limits)).toBeNull();
  });

  it('names the size and the limit it exceeds', () => {
    expect(sizeLimitProblem([[4097, 100]], limits)).toMatch(/4097×100.*MAX_TEXTURE_SIZE 4096/);
    expect(sizeLimitProblem([[100, 3001]], limits)).toMatch(/100×3001.*MAX_VIEWPORT_DIMS 8192×3000/);
    expect(sizeLimitProblem([[100, 100]], { ...limits, maxRenderbufferSize: 64 })).toMatch(/MAX_RENDERBUFFER_SIZE 64/);
  });
});
