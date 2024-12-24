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
  private readonly apiUrl = 'https://github.com';
  private readonly pollingInterval = 5000;
  private deviceCode: string | null = null;

  constructor(clientId: string) {
    if (!clientId) {
      throw new Error('GitHub Client ID is required');
    }
    this.clientId = clientId;
    console.log('GitHubDeviceAuthService initialized with clientId:', clientId);
  }

  async startDeviceFlow(): Promise<DeviceFlowStartResponse> {
    console.log('Starting device flow...');

    const url = `${this.apiUrl}/login/device/code`;
    console.log('Request URL:', url);
    console.log('Request payload:', {
      client_id: this.clientId,
      scope: 'repo'
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: this.clientId,
          scope: 'repo'
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers));

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      try {
        const data = JSON.parse(responseText) as DeviceFlowStartResponse;
        console.log('Parsed device flow response:', data);

        if (!data.device_code || !data.user_code || !data.verification_uri) {
          throw new Error('Invalid device flow response: missing required fields');
        }

        this.deviceCode = data.device_code;
        return data;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error(`Failed to parse response as JSON: ${responseText}`);
      }
    } catch (error) {
      console.error('Device flow start error:', error);
      throw error;
    }
  }

  private async pollForToken(): Promise<string | null> {
    if (!this.deviceCode) {
      throw new Error('Device code not found. Start device flow first.');
    }

    console.log('Polling for token with device code:', this.deviceCode);

    const url = `${this.apiUrl}/login/oauth/access_token`;
    console.log('Token request URL:', url);
    console.log('Token request payload:', {
      client_id: this.clientId,
      device_code: this.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: this.clientId,
          device_code: this.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      console.log('Token response status:', response.status);
      console.log('Token response headers:', Object.fromEntries(response.headers));

      const responseText = await response.text();
      console.log('Raw token response:', responseText);

      try {
        const data = JSON.parse(responseText) as TokenResponse;
        console.log('Parsed token response:', data);

        if (data.error === 'authorization_pending') {
          console.log('Authorization is still pending');
          return null;
        }

        if (data.error) {
          throw new Error(data.error_description || data.error);
        }

        if (!data.access_token) {
          throw new Error('Invalid token response: missing access_token');
        }

        return data.access_token;
      } catch (parseError) {
        console.error('Token response parse error:', parseError);
        throw new Error(`Failed to parse token response as JSON: ${responseText}`);
      }
    } catch (error) {
      console.error('Token polling error:', error);
      throw error;
    }
  }

  async authenticate(): Promise<string> {
    const flow = await this.startDeviceFlow();
    console.log('Device Flow started successfully:', {
      verification_uri: flow.verification_uri,
      user_code: flow.user_code,
      expires_in: flow.expires_in
    });

    let attempts = 0;
    const maxAttempts = 180; // 15分 (900秒) / 5秒 = 180回
    const startTime = Date.now();
    const timeoutMs = flow.expires_in * 1000;

    while (attempts < maxAttempts) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('認証がタイムアウトしました。もう一度お試しください。');
      }

      attempts++;
      console.log(`Polling attempt ${attempts}/${maxAttempts}`);

      try {
        const token = await this.pollForToken();
        if (token) {
          console.log('Authentication successful!');
          return token;
        }

        // 次のポーリングまで待機
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
      } catch (error) {
        console.error(`Polling attempt ${attempts} failed:`, error);
        if (attempts === maxAttempts) {
          throw new Error('認証の試行回数が上限に達しました。もう一度お試しください。');
        }
        // エラーの場合も一定時間待機してから再試行
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
      }
    }

    throw new Error('認証の試行回数が上限に達しました。もう一度お試しください。');
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