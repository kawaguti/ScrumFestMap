import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthPage from '@/pages/AuthPage';

describe('認証ページのe2eテスト', () => {
  test('ユーザー登録フォームが機能する', async () => {
    render(<AuthPage />);

    // When: 登録フォームに情報を入力して送信
    fireEvent.click(screen.getByText('新規登録'));
    
    const usernameInput = screen.getByLabelText('ユーザー名');
    const emailInput = screen.getByLabelText('メールアドレス');
    const passwordInput = screen.getByLabelText('パスワード');
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByText('登録'));

    // Then: 登録成功メッセージが表示される
    await waitFor(() => {
      expect(screen.getByText(/登録が完了しました/)).toBeInTheDocument();
    });
  });

  test('ログインフォームが機能する', async () => {
    render(<AuthPage />);

    // When: ログインフォームに情報を入力して送信
    const usernameInput = screen.getByLabelText('ユーザー名');
    const passwordInput = screen.getByLabelText('パスワード');
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByText('ログイン'));

    // Then: ログイン成功メッセージが表示される
    await waitFor(() => {
      expect(screen.getByText(/ログインしました/)).toBeInTheDocument();
    });
  });
});