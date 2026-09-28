import { describe, expect, it } from 'vitest';
import { hasFloatLinear, missingRequiredFeature } from './features';

const withExtensions = (...names: string[]) => ({
  getExtension: (name: string) => (names.includes(name) ? {} : null),
});

describe('missingRequiredFeature', () => {
  it('reports WebGL2 when there is no WebGL2 context', () => {
    expect(missingRequiredFeature(null)).toBe('WebGL2');
  });

  it('reports EXT_color_buffer_float when the context lacks it', () => {
    expect(missingRequiredFeature(withExtensions('OES_texture_float_linear'))).toBe('EXT_color_buffer_float');
  });

  it('reports nothing when WebGL2 and EXT_color_buffer_float are both there', () => {
    expect(missingRequiredFeature(withExtensions('EXT_color_buffer_float'))).toBeNull();
  });
});

describe('hasFloatLinear', () => {
  it('is true only when OES_texture_float_linear is there', () => {
    expect(hasFloatLinear(withExtensions('EXT_color_buffer_float', 'OES_texture_float_linear'))).toBe(true);
    expect(hasFloatLinear(withExtensions('EXT_color_buffer_float'))).toBe(false);
  });
});
