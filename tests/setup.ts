import { expect, beforeAll, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface Assertion extends matchers.Matchers {}
  }
}

beforeAll(() => {
  // Reactクエリのモック
  vi.mock('@tanstack/react-query', () => ({
    QueryClient: vi.fn(() => ({
      clear: vi.fn(),
      invalidateQueries: vi.fn(),
      prefetchQuery: vi.fn(),
      setQueryData: vi.fn(),
    })),
    QueryClientProvider: ({ children }) => children,
    useQuery: vi.fn(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    })),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isLoading: false,
    })),
  }));

  // グローバルにwaitForを追加
  global.waitFor = waitFor;

  // フェッチのモック
  global.fetch = vi.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  (global.fetch as unknown as ReturnType<typeof vi.fn>).mockClear();
});
