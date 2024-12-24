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

interface GitHubErrorResponse {
  message?: string;
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

  private async fetchWithJson<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('Request URL:', url);
    console.log('Request options:', {
      method: options.method,
      headers: options.headers,
      body: options.body
    });
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse JSON response:', text);
      throw new Error('Invalid JSON response from GitHub API');
    }
  }

  async startDeviceFlow(): Promise<DeviceFlowStartResponse> {
    try {
      const data = await this.fetchWithJson<DeviceFlowStartResponse & GitHubErrorResponse>(
        'https://github.com/login/device/code',
        {
          method: 'POST',
          body: JSON.stringify({
            client_id: this.clientId,
            scope: 'repo'  // Single fileアクセス用
          })
        }
      );

      if ('error' in data) {
        throw new Error(data.error_description || data.error || 'Unknown error');
      }

      if (!data.device_code || !data.user_code || !data.verification_uri) {
        console.error('Invalid device flow response:', data);
        throw new Error('Invalid device flow response from GitHub');
      }

      this.deviceCode = data.device_code;
      return {
        device_code: data.device_code,
        user_code: data.user_code,
        verification_uri: data.verification_uri,
        expires_in: data.expires_in
      };
    } catch (error) {
      console.error('Device flow start error:', error);
      throw new Error(`Device flow start failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async pollForToken(): Promise<string> {
    if (!this.deviceCode) {
      throw new Error('Device flow not initiated');
    }

    try {
      const data = await this.fetchWithJson<DeviceFlowTokenResponse>(
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
          return '';  // まだ認証待ち
        }
        throw new Error(data.error_description || data.error);
      }

      if (!data.access_token) {
        console.error('No access token in response:', data);
        throw new Error('Invalid token response from GitHub');
      }

      this.accessToken = data.access_token;
      return data.access_token;
    } catch (error) {
      console.error('Token polling error:', error);
      throw new Error(`Token polling failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: this.getHeaders()
        }
      );

      console.log('File request headers:', Object.fromEntries(this.getHeaders()));
      console.log('File response status:', response.status);

      if (!response.ok) {
        const text = await response.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.error || response.statusText);
        } catch {
          console.error('Failed to parse error response:', text);
          throw new Error(`Failed to get file: ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('File response data:', data);
      return data;
    } catch (error) {
      console.error('File fetch error:', error);
      throw new Error(`Failed to get file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}