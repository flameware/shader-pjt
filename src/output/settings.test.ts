import { describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../params/values';
import { createOutputSettings } from './settings';

describe('output settings', () => {
  it('starts at window/fit when sketch.ts gives no default', () => {
    const settings = createOutputSettings('s', memoryStorage());
    expect(settings.output()).toBe('window');
    expect(settings.renderScale()).toBe('fit');
  });

  it('starts at the sketch.ts default', () => {
    expect(createOutputSettings('s', memoryStorage(), '4:5').output()).toBe('4:5');
  });

  it('remembers the choice per Sketch across reloads', () => {
    const storage = memoryStorage();
    const first = createOutputSettings('a', storage);
    first.setOutput('9:16');
    first.setRenderScale('full');
    const again = createOutputSettings('a', storage);
    expect(again.output()).toBe('9:16');
    expect(again.renderScale()).toBe('full');
    expect(createOutputSettings('b', storage).output()).toBe('window');
  });

  it('the stored choice wins over the sketch.ts default', () => {
    const storage = memoryStorage();
    createOutputSettings('a', storage, '4:5').setOutput('1:1');
    expect(createOutputSettings('a', storage, '4:5').output()).toBe('1:1');
  });

  it('drops the stored choice when the sketch.ts default changes (like Parameter defaults)', () => {
    const storage = memoryStorage();
    const first = createOutputSettings('a', storage, '4:5');
    first.setOutput('1:1');
    first.setRenderScale('full');
    const changed = createOutputSettings('a', storage, [640, 480]);
    expect(changed.output()).toEqual([640, 480]);
    expect(changed.renderScale()).toBe('fit');
  });

  it('ignores a stored value it cannot read', () => {
    const storage = memoryStorage();
    storage.setItem('shader-playground:output:a', '{"default":"window","output":"3:2","renderScale":"huge"}');
    const settings = createOutputSettings('a', storage);
    expect(settings.output()).toBe('window');
    expect(settings.renderScale()).toBe('fit');
    storage.setItem('shader-playground:output:a', 'not json');
    expect(createOutputSettings('a', storage).output()).toBe('window');
  });

  it('window is always fit: choosing full there does nothing, and going to window drops full', () => {
    const settings = createOutputSettings('s', memoryStorage());
    settings.setRenderScale('full');
    expect(settings.renderScale()).toBe('fit');
    settings.setOutput('4:5');
    settings.setRenderScale('full');
    settings.setOutput('window');
    expect(settings.renderScale()).toBe('fit');
  });

  it('offers window, the presets, and a custom sketch.ts size', () => {
    expect(createOutputSettings('s', memoryStorage()).options()).toEqual(['window', '1:1', '4:5', '9:16', '16:9']);
    expect(createOutputSettings('s', memoryStorage(), [640, 480]).options()).toEqual(['window', '1:1', '4:5', '9:16', '16:9', [640, 480]]);
  });

  it('refuses a custom size that is not the sketch.ts one', () => {
    const settings = createOutputSettings('s', memoryStorage());
    settings.setOutput([123, 45]);
    expect(settings.output()).toBe('window');
  });

  it('notifies on a real change only', () => {
    const settings = createOutputSettings('s', memoryStorage());
    const listener = vi.fn();
    settings.subscribe(listener);
    settings.setOutput('window');
    settings.setRenderScale('fit');
    expect(listener).not.toHaveBeenCalled();
    settings.setOutput('4:5');
    settings.setRenderScale('full');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps working in memory when storage throws', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    const settings = createOutputSettings('s', storage);
    settings.setOutput('1:1');
    expect(settings.output()).toBe('1:1');
  });
});
