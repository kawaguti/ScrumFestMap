import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

interface GitHubUpdateResponse {
  commit: {
    sha: string;
  }
}

export class GitHubAppService {
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly installationId: string;

  constructor(appId: string, privateKey: string, installationId: string) {
    this.appId = appId;
    this.privateKey = privateKey;
    this.installationId = installationId;
  }

  private async getOctokit(): Promise<Octokit> {
    try {
      const auth = createAppAuth({
        appId: this.appId,
        privateKey: this.privateKey,
        installationId: this.installationId
      });

      const { token } = await auth({ type: "installation" });
      return new Octokit({ auth: token });
    } catch (error) {
      console.error('Failed to initialize Octokit:', error);
      throw new Error('GitHub認証の初期化に失敗しました');
    }
  }

  async updateAllEventsFile(newContent: string, owner: string, repo: string, path: string): Promise<GitHubUpdateResponse> {
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

      console.log('Current file fetched successfully');

      // Update file
      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: 'Update all-events.md',
        content: Buffer.from(newContent).toString('base64'),
        sha: currentFile.sha,
      });

      console.log('File updated successfully');
      return { commit: { sha: data.commit.sha } };
    } catch (error) {
      console.error('File update failed:', error);
      throw error;
    }
  }
}