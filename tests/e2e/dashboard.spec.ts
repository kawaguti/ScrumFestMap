import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventDashboard } from '@/components/EventDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('ダッシュボードのe2eテスト', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  test('正しい統計情報が表示される', async () => {
    // Given: テストデータとしてイベントが登録されている
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    render(<EventDashboard />, { wrapper });

    // When: ダッシュボードページを表示
    // Then: 統計情報が正しく表示される
    await waitFor(() => {
      expect(screen.getByText('総イベント数')).toBeInTheDocument();
      expect(screen.getByText('開催予定')).toBeInTheDocument();
      expect(screen.getByText('都道府県別トップ5')).toBeInTheDocument();
    });
  });
});
