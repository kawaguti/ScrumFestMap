import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from '@/pages/HomePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('イベント管理のe2eテスト', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  test('新規イベントを登録できる', async () => {
    // Given: ログイン済みユーザー
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    render(<HomePage />, { wrapper });

    // When: イベント登録フォームに情報を入力して送信
    fireEvent.click(screen.getByText('新規イベント登録'));
    
    const nameInput = screen.getByLabelText('イベント名');
    const prefectureInput = screen.getByLabelText('開催地');
    const dateInput = screen.getByLabelText('開催日時');
    
    fireEvent.change(nameInput, { target: { value: 'テストイベント' } });
    fireEvent.change(prefectureInput, { target: { value: '東京都' } });
    fireEvent.change(dateInput, { target: { value: '2024-12-25T10:00' } });
    
    fireEvent.click(screen.getByText('登録'));

    // Then: イベントが登録され、マップ上に表示される
    await waitFor(() => {
      expect(screen.getByText('テストイベント')).toBeInTheDocument();
    });
  });

  test('登録済みイベントが表示される', async () => {
    // Given: イベントが登録されている状態
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    render(<HomePage />, { wrapper });

    // Then: イベントリストにイベントが表示される
    await waitFor(() => {
      expect(screen.getByText('イベント一覧')).toBeInTheDocument();
    });
  });
});
