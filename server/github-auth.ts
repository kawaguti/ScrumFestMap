import jwt from 'jsonwebtoken';

interface DeviceFlowAuth {
  client_id: string;
  device_code?: string;
  access_token?: string;
}

export class GitHubDeviceAuthService {
  constructor(private config: DeviceFlowAuth) {}

  async startDeviceFlow() {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.config.client_id,
        scope: 'repo' // Single fileアクセス用
      })
    });

    if (!response.ok) {
      throw new Error('Failed to start device flow');
    }

    const data = await response.json();
    this.config.device_code = data.device_code;

    return {
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in
    };
  }

  async pollForToken(): Promise<string> {
    if (!this.config.device_code) {
      throw new Error('Device flow not initiated');
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.config.client_id,
        device_code: this.config.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    });

    if (!response.ok) {
      throw new Error('Token polling failed');
    }

    const data = await response.json();
    if (data.error) {
      if (data.error === 'authorization_pending') {
        return ''; // まだ認証待ち
      }
      throw new Error(data.error);
    }

    this.config.access_token = data.access_token;
    return data.access_token;
  }

  getHeaders(): Headers {
    if (!this.config.access_token) {
      throw new Error('No access token available');
    }

    return new Headers({
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${this.config.access_token}`,
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
      throw new Error(`Failed to get file: ${await response.text()}`);
    }

    return response.json();
  }
}
