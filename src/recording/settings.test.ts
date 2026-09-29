import { describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../params/values';
import { createRecordingSettings } from './settings';

describe('recording settings', () => {
  it('starts with no max length', () => {
    expect(createRecordingSettings('s', memoryStorage()).maxLength()).toBeNull();
  });

  it('remembers the max length per Sketch across reloads', () => {
    const storage = memoryStorage();
    createRecordingSettings('a', storage).setMaxLength(10);
    expect(createRecordingSettings('a', storage).maxLength()).toBe(10);
    expect(createRecordingSettings('b', storage).maxLength()).toBeNull();
  });

  it('remembers going back to no max length', () => {
    const storage = memoryStorage();
    createRecordingSettings('a', storage).setMaxLength(5);
    createRecordingSettings('a', storage).setMaxLength(null);
    expect(createRecordingSettings('a', storage).maxLength()).toBeNull();
  });

  it('ignores a length that is not offered, and a stored value it cannot read', () => {
    const storage = memoryStorage();
    const settings = createRecordingSettings('a', storage);
    settings.setMaxLength(7 as never);
    expect(settings.maxLength()).toBeNull();
    storage.setItem('shader-playground:recording:a', '{"maxLength":7}');
    expect(createRecordingSettings('a', storage).maxLength()).toBeNull();
    storage.setItem('shader-playground:recording:a', 'not json');
    expect(createRecordingSettings('a', storage).maxLength()).toBeNull();
  });

  it('notifies on a real change only', () => {
    const settings = createRecordingSettings('s', memoryStorage());
    const listener = vi.fn();
    settings.subscribe(listener);
    settings.setMaxLength(null);
    expect(listener).not.toHaveBeenCalled();
    settings.setMaxLength(15);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps working in memory when storage throws', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    const settings = createRecordingSettings('s', storage);
    settings.setMaxLength(30);
    expect(settings.maxLength()).toBe(30);
  });
});
