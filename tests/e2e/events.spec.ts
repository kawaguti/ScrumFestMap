import { test, expect, describe, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import HomePage from '../../client/src/pages/HomePage';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../client/src/lib/queryClient';

const mockEvents = [
  {
    id: 1,
    name: "Test Event 1",
    prefecture: "東京都",
    date: new Date().toISOString(),
    description: "Test description 1"
  },
  {
    id: 2,
    name: "Test Event 2",
    prefecture: "大阪府",
    date: new Date().toISOString(),
    description: "Test description 2"
  }
];

const server = setupServer(
  rest.get('/api/events', (req, res, ctx) => {
    return res(ctx.json(mockEvents));
  }),
  rest.post('/api/events', (req, res, ctx) => {
    return res(ctx.json({ ...req.body, id: 3 }));
  }),
  rest.get('/api/user', (req, res, ctx) => {
    return res(ctx.json({ id: 1, username: "testuser" }));
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

describe('イベント管理', () => {
  test('新規イベントを登録できる', async () => {
    // Given: ログイン済みユーザー
    render(<HomePage />, { wrapper });

    // When: イベント登録フォームに情報を入力して送信
    const newEventButton = screen.getByText('新規イベント登録');
    await userEvent.click(newEventButton);

    await userEvent.type(screen.getByLabelText('イベント名'), 'New Test Event');
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText('東京都'));
    await userEvent.type(screen.getByLabelText('イベント説明'), 'New test description');

    const submitButton = screen.getByRole('button', { name: '保存' });
    await userEvent.click(submitButton);

    // Then: イベントが作成され、地図上に表示される
    await waitFor(() => {
      expect(screen.getByText('New Test Event')).toBeInTheDocument();
    });
  });

  test('都道府県別にイベントを表示できる', async () => {
    // Given: 複数の都道府県にイベントが登録されている
    render(<HomePage />, { wrapper });

    // When: 特定の都道府県を選択
    const tokyoPath = screen.getByTestId('prefecture-tokyo');
    await userEvent.click(tokyoPath);

    // Then: 選択した都道府県のイベントのみが表示される
    await waitFor(() => {
      const events = screen.getAllByText(/Test Event/);
      expect(events).toHaveLength(1);
      expect(screen.getByText('Test Event 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Event 2')).not.toBeInTheDocument();
    });
  });
});
