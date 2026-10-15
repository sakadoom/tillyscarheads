import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom belum menyediakan dua API ini, sedangkan beberapa komponen layout
// memakainya melalui CSS/tema. Stub minimal supaya render di test tidak gagal.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

interface ObservedElement {
  disconnect(): void;
  observe(): void;
  unobserve(): void;
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: new () => ObservedElement }).ResizeObserver = class {
    disconnect(): void {}
    observe(): void {}
    unobserve(): void {}
  };
}

afterEach(() => {
  cleanup();
});
