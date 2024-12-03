export const PASSWORD_MIN_LENGTH = 8;

export function validatePasswordStrength(password: string): { 
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`パスワードは${PASSWORD_MIN_LENGTH}文字以上である必要があります`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('パスワードには大文字を含める必要があります');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('パスワードには小文字を含める必要があります');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('パスワードには数字を含める必要があります');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('パスワードには特殊文字(!@#$%^&*(),.?":{}|<>)を含める必要があります');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
