import { test, expect, describe, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { EventDashboard } from '../../client/src/components/EventDashboard';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../client/src/lib/queryClient';

const mockStats = {
  totalEvents: 5,
  upcomingEvents: 3,
  prefectureStats: {
    "東京都": 2,
    "大阪府": 1,
    "福岡県": 1,
    "北海道": 1
  },
  monthlyStats: {
    "1月": 1,
    "2月": 2,
    "3月": 2
  }
};

const server = setupServer(
  rest.get('/api/stats', (req, res, ctx) => {
    return res(ctx.json(mockStats));
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('統計ダッシュボード', () => {
  test('正しい統計情報が表示される', async () => {
    // Given: テストデータとしてイベントが登録されている
    render(<EventDashboard />, { wrapper });

    // When: ダッシュボードページを表示
    // Then: 総イベント数、開催予定イベント数、都道府県別トップ5が正しく表示される
    await waitFor(() => {
      // 総イベント数の検証
      expect(screen.getByText('5')).toBeInTheDocument();
      // 開催予定イベント数の検証
      expect(screen.getByText('3')).toBeInTheDocument();
      // 都道府県別統計の検証
      expect(screen.getByText('東京都 (2件)')).toBeInTheDocument();
      expect(screen.getByText('大阪府 (1件)')).toBeInTheDocument();
      expect(screen.getByText('福岡県 (1件)')).toBeInTheDocument();
      expect(screen.getByText('北海道 (1件)')).toBeInTheDocument();
    });
  });

  test('ローディング状態が表示される', () => {
    render(<EventDashboard />, { wrapper });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('エラー時の表示', async () => {
    server.use(
      rest.get('/api/stats', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    render(<EventDashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });
  });
});
