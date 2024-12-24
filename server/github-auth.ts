import jwt from 'jsonwebtoken';

interface DeviceFlowStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
}

interface DeviceFlowTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export class GitHubDeviceAuthService {
  private readonly clientId: string;
  private deviceCode?: string;
  private accessToken?: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async startDeviceFlow(): Promise<DeviceFlowStartResponse> {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.clientId,
        scope: 'repo'  // Single fileアクセス用
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Device flow start failed: ${errorData.error || errorData.message || response.statusText}`);
    }

    const data = await response.json();
    this.deviceCode = data.device_code;

    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      expires_in: data.expires_in
    };
  }

  async pollForToken(): Promise<string> {
    if (!this.deviceCode) {
      throw new Error('Device flow not initiated');
    }

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
      const errorData = await response.json();
      throw new Error(`Token polling failed: ${errorData.error || errorData.message || response.statusText}`);
    }

    const data: DeviceFlowTokenResponse = await response.json();

    if (data.error) {
      if (data.error === 'authorization_pending') {
        return '';  // まだ認証待ち
      }
      throw new Error(data.error_description || data.error);
    }

    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    this.accessToken = data.access_token;
    return data.access_token;
  }

  getHeaders(): Headers {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    return new Headers({
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${this.accessToken}`,
      'User-Agent': 'ScrumFestMap-GitHub-App',
      'X-GitHub-Api-Version': '2022-11-28'
    });
  }

  async getFile(owner: string, repo: string, path: string) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: this.getHeaders()
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to get file: ${errorData.message || errorData.error || response.statusText}`);
    }

    return response.json();
  }
}