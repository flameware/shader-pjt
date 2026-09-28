/// <reference types="vite/client" />

declare module '*.frag' {
  const shader: import('./shader-source').ShaderSource;
  export default shader;
}

declare module 'virtual:shader-hot' {
  /** Calls `listener` with the new source each time a `.frag` module is hot-updated. Returns an unsubscribe function. */
  export function onShaderUpdate(listener: (shader: import('./shader-source').ShaderSource) => void): () => void;
}
