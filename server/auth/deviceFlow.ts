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
          const errorText = await response.text();
          throw new DeviceFlowError(
            `GitHub API error: ${errorText}`,
            'GITHUB_API_ERROR'
          );
        }

        const data = await response.json();
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
        const response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: this.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        });

        if (!response.ok) {
          throw new DeviceFlowError(
            `Token request failed: ${await response.text()}`,
            'TOKEN_REQUEST_FAILED'
          );
        }

        const data = await tokenResponseSchema.parse(await response.json());
        pollCount++;

        console.log('Token polling response:', {
          attempt: pollCount,
          hasToken: !!data.access_token,
          error: data.error,
          errorDescription: data.error_description,
          elapsedTime: Math.round((Date.now() - startTime) / 1000),
          currentInterval
        });

        if (data.access_token) {
          return data.access_token;
        }

        if (data.error === 'authorization_pending') {
          await new Promise(resolve => setTimeout(resolve, currentInterval));
          continue;
        }

        if (data.error === 'slow_down') {
          currentInterval = Math.min(currentInterval * 1.5, 15000); // Cap at 15 seconds
          await new Promise(resolve => setTimeout(resolve, currentInterval));
          continue;
        }

        throw new DeviceFlowError(
          `Authentication error: ${data.error_description || data.error}`,
          data.error || 'UNKNOWN_ERROR'
        );
      } catch (error) {
        console.error('Polling error:', error);

        if (error instanceof DeviceFlowError) {
          throw error;
        }

        // For network errors, implement exponential backoff
        const backoffTime = Math.min(1000 * Math.pow(2, pollCount % 4), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }

    throw new DeviceFlowError(
      `Authentication timeout after ${Math.round((Date.now() - startTime) / 1000)} seconds`,
      'AUTHENTICATION_TIMEOUT'
    );
  }
}