import { RequestInit } from 'node-fetch';
import fetch from 'node-fetch';

interface DeviceFlowStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval?: number;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export class GitHubDeviceAuthService {
  private readonly clientId: string;
  private readonly pollingInterval = 5000; // 5秒ごとにポーリング
  private deviceCode: string | null = null;
  private lastPollTime: number = 0;

  constructor(clientId: string) {
    if (!clientId) {
      throw new Error('GitHub Client ID is required');
    }
    this.clientId = clientId;
    console.log('GitHubDeviceAuthService initialized with client ID:', this.clientId);
  }

  private async fetchWithJson<T>(url: string, options: RequestInit): Promise<T> {
    console.log(`Fetching from ${url}...`);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json() as T;
      console.log(`Response from ${url}:`, data);

      if ('error' in (data as any)) {
        const errorData = data as { error: string; error_description?: string };
        if (errorData.error !== 'authorization_pending') {
          throw new Error(errorData.error_description || errorData.error);
        }
      }

      return data;
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error);
      throw error;
    }
  }

  async startDeviceFlow(): Promise<DeviceFlowStartResponse> {
    try {
      console.log('Starting Device Flow with client ID:', this.clientId);

      const data = await this.fetchWithJson<DeviceFlowStartResponse>(
        'https://github.com/login/device/code',
        {
          method: 'POST',
          body: JSON.stringify({
            client_id: this.clientId,
            scope: 'repo'  // リポジトリアクセス用のスコープ
          })
        }
      );

      this.deviceCode = data.device_code;
      this.lastPollTime = Date.now();

      console.log('Device Flow started successfully:', {
        verification_uri: data.verification_uri,
        user_code: data.user_code,
        expires_in: data.expires_in
      });

      return data;
    } catch (error) {
      console.error('Device flow start error:', error);
      throw new Error(`Device flow start failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async pollForToken(): Promise<string | null> {
    if (!this.deviceCode) {
      throw new Error('Device flow not initiated');
    }

    // ポーリング間隔を確保
    const timeSinceLastPoll = Date.now() - this.lastPollTime;
    if (timeSinceLastPoll < this.pollingInterval) {
      await new Promise(resolve => setTimeout(resolve, this.pollingInterval - timeSinceLastPoll));
    }

    try {
      console.log('Polling for token with device code');
      const data = await this.fetchWithJson<TokenResponse>(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          body: JSON.stringify({
            client_id: this.clientId,
            device_code: this.deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        }
      );

      this.lastPollTime = Date.now();

      if (data.error) {
        if (data.error === 'authorization_pending') {
          console.log('Authorization pending, waiting for user...');
          return null;  // まだ認証待ち
        }
        throw new Error(data.error_description || data.error);
      }

      if (!data.access_token) {
        throw new Error('Invalid token response from GitHub');
      }

      console.log('Token received successfully');
      return data.access_token;
    } catch (error) {
      console.error('Token polling error:', error);
      if (error instanceof Error && error.message.includes('expired')) {
        throw new Error('認証の有効期限が切れました。もう一度認証を開始してください。');
      }
      throw new Error(`Token polling failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async waitForAuthentication(timeoutMs = 900000): Promise<string> {
    if (!this.deviceCode) {
      throw new Error('Device flow not initiated');
    }

    const startTime = Date.now();
    let token: string | null = null;
    let attempts = 0;

    while (!token) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('認証がタイムアウトしました。もう一度お試しください。');
      }

      attempts++;
      console.log(`Polling attempt ${attempts}...`);

      try {
        token = await this.pollForToken();

        if (!token) {
          console.log(`Waiting ${this.pollingInterval}ms before next poll...`);
          await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('expired')) {
          throw error; // 有効期限切れは即座にエラーとして処理
        }
        console.error(`Polling attempt ${attempts} failed:`, error);
        // その他のエラーは一時的なものとして扱い、リトライ
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
      }
    }

    return token;
  }

  getHeaders(token: string): { [key: string]: string } {
    return {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'ScrumFestMap-GitHub-App',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }
}