import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { mockHandlers } from './mocks/handlers';

// Setup MSW server for API mocking
export const server = setupServer(...mockHandlers);

beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'error' });
  
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock window.location
  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      href: 'http://localhost:5173',
      origin: 'http://localhost:5173',
      protocol: 'http:',
      host: 'localhost:5173',
      hostname: 'localhost',
      port: '5173',
      pathname: '/',
      search: '',
      hash: '',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
  });

  // Mock HTMLCanvasElement
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Array(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Array(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  });

  // Mock Fabric.js
  global.fabric = {
    Canvas: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      renderAll: vi.fn(),
      dispose: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      setDimensions: vi.fn(),
      toJSON: vi.fn(() => ({})),
      loadFromJSON: vi.fn(),
    })),
    Object: vi.fn(),
    Rect: vi.fn(),
    Circle: vi.fn(),
    Text: vi.fn(),
    Image: vi.fn(),
  };

  // Mock Konva
  global.Konva = {
    Stage: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      draw: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    })),
    Layer: vi.fn(),
    Rect: vi.fn(),
    Circle: vi.fn(),
    Text: vi.fn(),
    Image: vi.fn(),
  };
});

afterAll(() => {
  // Stop MSW server
  server.close();
});

beforeEach(() => {
  // Reset MSW handlers
  server.resetHandlers();
});

afterEach(() => {
  // Cleanup DOM
  cleanup();
  
  // Reset MSW handlers
  server.resetHandlers();
  
  // Clear all mocks
  vi.clearAllMocks();
});