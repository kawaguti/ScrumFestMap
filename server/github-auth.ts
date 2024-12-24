import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

interface GitHubUpdateResponse {
  commit: {
    sha: string;
  }
}

interface GitHubFileContent {
  content: string;
  sha: string;
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

  private async getCurrentFileContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string
  ): Promise<GitHubFileContent | null> {
    try {
      const { data: currentFile } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(currentFile)) {
        throw new Error('Unexpected response: path points to a directory');
      }

      if (!('sha' in currentFile) || !('content' in currentFile)) {
        throw new Error('Invalid file response format');
      }

      return {
        content: Buffer.from(currentFile.content, 'base64').toString('utf-8'),
        sha: currentFile.sha
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private detectChangedEvents(currentContent: string, newContent: string): string[] {
    const currentEvents = this.extractEventNames(currentContent);
    const newEvents = this.extractEventNames(newContent);

    const changes: string[] = [];

    // 新規追加または変更されたイベントを検出
    newEvents.forEach(event => {
      if (!currentEvents.includes(event)) {
        changes.push(`追加/更新: ${event}`);
      }
    });

    // 削除されたイベントを検出
    currentEvents.forEach(event => {
      if (!newEvents.includes(event)) {
        changes.push(`削除: ${event}`);
      }
    });

    return changes;
  }

  private extractEventNames(content: string): string[] {
    const eventPattern = /^## (.+?)$/gm;
    const matches = content.match(eventPattern) || [];
    return matches.map(match => match.replace('## ', '').trim());
  }

  async updateAllEventsFile(
    newContent: string,
    owner: string,
    repo: string,
    path: string
  ): Promise<GitHubUpdateResponse | null> {
    const config = this.validateConfig();
    if (!config.isValid) {
      throw new Error(config.message);
    }

    try {
      const octokit = await this.getOctokit();
      console.log('Octokit initialized successfully');

      const currentFile = await this.getCurrentFileContent(octokit, owner, repo, path);

      if (currentFile) {
        const changes = this.detectChangedEvents(currentFile.content, newContent);

        if (changes.length === 0) {
          console.log('No changes detected in events, skipping GitHub update');
          return null;
        }

        const commitMessage = `イベント情報を更新:\n${changes.join('\n')}`;
        console.log(`Updating file with changes:\n${commitMessage}`);

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
      } else {
        // ファイルが存在しない場合は新規作成
        console.log('File does not exist, creating new file');
        const { data } = await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message: '初回: イベント一覧を作成',
          content: Buffer.from(newContent).toString('base64'),
        });

        if (!data.commit?.sha) {
          throw new Error('Commit SHA not found in response');
        }

        return { commit: { sha: data.commit.sha } };
      }
    } catch (error) {
      console.error('File update failed:', error);
      throw error;
    }
  }
}