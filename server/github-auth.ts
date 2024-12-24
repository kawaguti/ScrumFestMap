import {RequestInit} from 'node-fetch';

interface DeviceFlowStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
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

  constructor(clientId: string) {
    if (!clientId) {
      throw new Error('GitHub Client ID is required');
    }
    this.clientId = clientId;
  }

  private async fetchWithJson<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API Error:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        body: errorText
      });
      throw new Error(`GitHub API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async startDeviceFlow(): Promise<DeviceFlowStartResponse> {
    try {
      console.log('Starting Device Flow with client ID:', this.clientId);

      const data = await this.fetchWithJson<DeviceFlowStartResponse & { error?: string; error_description?: string }>(
        'https://github.com/login/device/code',
        {
          method: 'POST',
          body: JSON.stringify({
            client_id: this.clientId,
            scope: 'repo'  // リポジトリアクセス用のスコープ
          })
        }
      );

      if ('error' in data) {
        console.error('Device Flow error:', data);
        throw new Error(data.error_description || data.error || 'Unknown error');
      }

      this.deviceCode = data.device_code;
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
      throw new Error(`Token polling failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async waitForAuthentication(timeoutMs = 900000): Promise<string> {
    if (!this.deviceCode) {
      throw new Error('Device flow not initiated');
    }

    const startTime = Date.now();
    let token: string | null = null;

    while (!token) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('認証がタイムアウトしました。もう一度お試しください。');
      }

      token = await this.pollForToken();

      if (!token) {
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
      }
    }

    return token;
  }

  getHeaders(token: string): Headers {
    return new Headers({
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'ScrumFestMap-GitHub-App',
      'X-GitHub-Api-Version': '2022-11-28'
    });
  }
}