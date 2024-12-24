
import { z } from 'zod';

// Custom error types for better error handling
export class DeviceFlowError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DeviceFlowError';
  }
}

// Zod schemas for response validation
const deviceFlowResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  expires_in: z.number()
});

const tokenResponseSchema = z.object({
  access_token: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional()
});

export class GitHubDeviceAuthService {
  private readonly clientId: string;
  private pollingInterval: number;
  private readonly maxRetries: number;

  constructor(
    clientId: string,
    options = { pollingInterval: 5000, maxRetries: 3 }
  ) {
    this.clientId = clientId;
    this.pollingInterval = options.pollingInterval;
    this.maxRetries = options.maxRetries;
  }

  async authenticateWithDeviceFlow(): Promise<string> {
    try {
      const deviceFlow = await this.startDeviceFlow();
      console.log('Device Flow initiated:', {
        userCode: deviceFlow.user_code,
        verificationUri: deviceFlow.verification_uri,
        expiresIn: deviceFlow.expires_in
      });

      return await this.pollForToken(deviceFlow.device_code, deviceFlow.expires_in);
    } catch (error) {
      if (error instanceof DeviceFlowError) {
        throw error;
      }
      throw new DeviceFlowError(
        'Device flow authentication failed',
        'DEVICE_FLOW_FAILED'
      );
    }
  }

  private async startDeviceFlow(): Promise<z.infer<typeof deviceFlowResponseSchema>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log('Starting Device Flow attempt:', attempt + 1);
        const response = await fetch('https://api.github.com/login/device/code', {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'ScrumFestMap-DeviceFlow'
          },
          body: JSON.stringify({
            client_id: this.clientId,
            scope: 'repo'
          })
        });

        console.log('Device Flow response status:', response.status);
        console.log('Device Flow response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          throw new DeviceFlowError(
            `GitHub API error: ${errorText}`,
            'GITHUB_API_ERROR'
          );
        }

        const data = await response.json();
        console.log('Parsed Device Flow response:', data);

        const validatedData = deviceFlowResponseSchema.parse(data);
        return validatedData;
      } catch (error) {
        console.error(`Device flow start attempt ${attempt + 1} failed:`, error);
        lastError = error as Error;

        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          continue;
        }
      }
    }

    throw new DeviceFlowError(
      `Failed to start device flow after ${this.maxRetries} attempts: ${lastError?.message}`,
      'START_DEVICE_FLOW_FAILED'
    );
  }

  private async pollForToken(deviceCode: string, expiresIn: number): Promise<string> {
    const startTime = Date.now();
    const timeout = expiresIn * 1000;
    let currentInterval = this.pollingInterval;
    let pollCount = 0;

    while (Date.now() - startTime < timeout) {
      try {
        console.log(`Polling attempt ${pollCount + 1}/180`);
        console.log('Polling for token with device code:', deviceCode);

        const url = 'https://github.com/login/oauth/access_token';
        console.log('Token request URL:', url);

        const response = await fetch('https://api.github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'ScrumFestMap-DeviceFlow'
          },
          body: JSON.stringify({
            client_id: this.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        });

        console.log('Token response status:', response.status);
        console.log('Token response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          throw new DeviceFlowError(
            `Token request failed: ${await response.text()}`,
            'TOKEN_REQUEST_FAILED'
          );
        }

        const data = await response.json();
        console.log('Parsed token response:', {
          hasToken: !!data.access_token,
          error: data.error,
          errorDescription: data.error_description
        });

        const validatedData = tokenResponseSchema.parse(data);
        pollCount++;

        if (validatedData.access_token) {
          return validatedData.access_token;
        }

        if (validatedData.error === 'authorization_pending') {
          console.log('Authorization is still pending');
          await new Promise(resolve => setTimeout(resolve, currentInterval));
          continue;
        }

        if (validatedData.error === 'slow_down') {
          currentInterval = Math.min(currentInterval * 1.5, 15000);
          console.log('Received slow_down signal, increasing interval to:', currentInterval);
          await new Promise(resolve => setTimeout(resolve, currentInterval));
          continue;
        }

        throw new DeviceFlowError(
          `Authentication error: ${validatedData.error_description || validatedData.error}`,
          validatedData.error || 'UNKNOWN_ERROR'
        );
      } catch (error) {
        console.error('Polling error:', error);

        if (error instanceof DeviceFlowError) {
          throw error;
        }

        const backoffTime = Math.min(1000 * Math.pow(2, pollCount % 4), 10000);
        console.log('Network error, backing off for:', backoffTime, 'ms');
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }

    throw new DeviceFlowError(
      `Authentication timeout after ${Math.round((Date.now() - startTime) / 1000)} seconds`,
      'AUTHENTICATION_TIMEOUT'
    );
  }
}
