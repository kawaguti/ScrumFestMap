import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

interface GitHubUpdateResponse {
  commit: {
    sha: string;
  }
}

export class GitHubAppService {
  private readonly appId: string | undefined;
  private readonly privateKey: string | undefined;
  private readonly installationId: string | undefined;

  constructor(appId: string | undefined, privateKey: string | undefined, installationId: string | undefined) {
    console.log('Initializing GitHubAppService...');
    this.appId = appId;
    this.privateKey = privateKey ? this.normalizePrivateKey(privateKey) : undefined;
    this.installationId = installationId;

    // 初期化時の設定値をログ出力（秘密鍵は長さのみ）
    console.log(`App ID: ${this.appId ? 'Set' : 'Not set'}`);
    console.log(`Private Key: ${this.privateKey ? `Set (length: ${this.privateKey.length})` : 'Not set'}`);
    console.log(`Installation ID: ${this.installationId ? 'Set' : 'Not set'}`);
  }

  private normalizePrivateKey(key: string): string {
    console.log('Normalizing private key...');
    if (!key.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      console.log('Adding RSA private key headers');
      return `-----BEGIN RSA PRIVATE KEY-----\n${key}\n-----END RSA PRIVATE KEY-----`;
    }
    console.log('Private key already has proper format');
    return key;
  }

  private validateConfig(): { isValid: boolean; message?: string } {
    console.log('Validating GitHub App configuration...');
    if (!this.appId || !this.privateKey || !this.installationId) {
      const missing = [
        !this.appId && 'GITHUB_APP_ID',
        !this.privateKey && 'GITHUB_PRIVATE_KEY',
        !this.installationId && 'GITHUB_INSTALLATION_ID'
      ].filter(Boolean).join(', ');

      console.log(`Invalid configuration: Missing ${missing}`);
      return {
        isValid: false,
        message: `GitHub認証の設定が不完全です。${missing}が必要です。`
      };
    }
    console.log('GitHub App configuration is valid');
    return { isValid: true };
  }

  private async getOctokit(): Promise<Octokit> {
    const config = this.validateConfig();
    if (!config.isValid) {
      throw new Error(config.message);
    }

    try {
      const auth = createAppAuth({
        appId: this.appId!,
        privateKey: this.privateKey!,
        installationId: this.installationId!
      });

      const { token } = await auth({ type: "installation" });
      return new Octokit({ auth: token });
    } catch (error) {
      console.error('Failed to initialize Octokit:', error);
      throw new Error('GitHub認証の初期化に失敗しました');
    }
  }

  async updateAllEventsFile(
    newContent: string,
    owner: string,
    repo: string,
    path: string,
    commitMessage: string = 'Update all-events.md'
  ): Promise<GitHubUpdateResponse> {
    const config = this.validateConfig();
    if (!config.isValid) {
      throw new Error(config.message);
    }

    try {
      const octokit = await this.getOctokit();
      console.log('Octokit initialized successfully');

      // Get current file to get its SHA
      const { data: currentFile } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(currentFile)) {
        throw new Error('Unexpected response: path points to a directory');
      }

      if (!('sha' in currentFile)) {
        throw new Error('File SHA not found in response');
      }

      console.log('Current file fetched successfully');

      // Update file
      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: commitMessage,
        content: Buffer.from(newContent).toString('base64'),
        sha: currentFile.sha,
      });

      console.log('File updated successfully');

      if (!data.commit?.sha) {
        throw new Error('Commit SHA not found in response');
      }

      return { commit: { sha: data.commit.sha } };
    } catch (error) {
      console.error('File update failed:', error);
      throw error;
    }
  }
}