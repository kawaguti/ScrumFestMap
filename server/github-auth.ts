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

  // ポーリング処理を別メソッドとして実装
  private async pollOnce(): Promise<string | null> {
    if (!this.deviceCode) {
      throw new Error('Device flow not initiated');
    }

    console.log('Polling for token...', this.deviceCode);

    const response = await fetch('https://github.com/login/oauth/access_token', {
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

    if (!response.ok) {
      throw new Error(`Token polling failed: ${await response.text()}`);
    }

    const data = await response.json() as TokenResponse;
    console.log('Poll response:', data);

    if (data.error === 'authorization_pending') {
      return null;
    }

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return data.access_token || null;
  }

  // メインのポーリングループ
  private async startPolling(onCode: (code: string) => void): Promise<void> {
    const startTime = Date.now();
    const timeoutMs = 900000; // 15分

    let attempts = 0;
    while (true) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('認証がタイムアウトしました。もう一度お試しください。');
      }

      attempts++;
      console.log(`Polling attempt ${attempts}...`);

      try {
        const timeSinceLastPoll = Date.now() - this.lastPollTime;
        if (timeSinceLastPoll < this.pollingInterval) {
          await new Promise(resolve => setTimeout(resolve, this.pollingInterval - timeSinceLastPoll));
        }

        const token = await this.pollOnce();
        this.lastPollTime = Date.now();

        if (token) {
          onCode(token);
          break;
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (error instanceof Error && error.message.includes('expired')) {
          throw error;
        }
        // その他のエラーは一時的なものとして扱い、リトライ
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
      }
    }
  }

  async startDeviceFlow(): Promise<DeviceFlowStartResponse> {
    try {
      console.log('Starting Device Flow with client ID:', this.clientId);

      const response = await fetch('https://github.com/login/device/code', {
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

      if (!response.ok) {
        throw new Error(`Device flow failed: ${await response.text()}`);
      }

      const data = await response.json() as DeviceFlowStartResponse;
      this.deviceCode = data.device_code;
      this.lastPollTime = Date.now();

      console.log('Device Flow started successfully:', {
        verification_uri: data.verification_uri,
        user_code: data.user_code,
        expires_in: data.expires_in
      });

      return data;
    } catch (error) {
      console.error('Start device flow error:', error);
      throw error;
    }
  }

  // 認証フローを開始し、コールバックで結果を通知
  async authenticate(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const flow = await this.startDeviceFlow();
        console.log('Device Flow started:', {
          userCode: flow.user_code,
          verificationUri: flow.verification_uri
        });

        // ポーリングを開始
        await this.startPolling(resolve);
      } catch (error) {
        reject(error);
      }
    });
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