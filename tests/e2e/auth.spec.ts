import { test, expect, describe, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import AuthPage from '../../client/src/pages/AuthPage';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../client/src/lib/queryClient';

const server = setupServer(
  rest.post('/api/register', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        message: "Registration successful",
        user: { id: 1, username: "testuser" }
      })
    );
  }),
  rest.post('/api/login', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        message: "Login successful",
        user: { id: 1, username: "testuser" }
      })
    );
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

describe('認証フロー', () => {
  test('新規ユーザーが登録できる', async () => {
    // Given: 新規ユーザーの情報がある
    const newUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };

    render(<AuthPage />, { wrapper });

    // When: 登録フォームに情報を入力して送信
    const registerLink = screen.getByText('新規登録はこちら');
    await userEvent.click(registerLink);

    await userEvent.type(screen.getByLabelText('ユーザー名'), newUser.username);
    await userEvent.type(screen.getByLabelText('メールアドレス'), newUser.email);
    await userEvent.type(screen.getByLabelText('パスワード'), newUser.password);

    const submitButton = screen.getByRole('button', { name: '登録' });
    await userEvent.click(submitButton);

    // Then: ユーザーが作成され、ログイン状態になる
    await waitFor(() => {
      expect(screen.getByText('登録成功')).toBeInTheDocument();
    });
  });

  test('登録済みユーザーがログインできる', async () => {
    // Given: 登録済みユーザーの認証情報がある
    const user = {
      username: 'existinguser',
      password: 'password123'
    };

    render(<AuthPage />, { wrapper });

    // When: ログインフォームに情報を入力して送信
    await userEvent.type(screen.getByLabelText('ユーザー名'), user.username);
    await userEvent.type(screen.getByLabelText('パスワード'), user.password);

    const submitButton = screen.getByRole('button', { name: 'ログイン' });
    await userEvent.click(submitButton);

    // Then: ログイン状態になる
    await waitFor(() => {
      expect(screen.getByText('ログイン成功')).toBeInTheDocument();
    });
  });
});
