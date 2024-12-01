import { expect, beforeAll, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

beforeAll(() => {
  // Add any global test setup here
  vi.mock('react', async () => {
    const actual = await vi.importActual('react');
    return {
      ...actual,
      useEffect: vi.fn(),
    };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
