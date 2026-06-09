import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: vi.fn(() => ({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: [] })),
    putImageData: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
  })),
});

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn();
