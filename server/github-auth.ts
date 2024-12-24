
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
    const auth = createAppAuth({
      appId: this.appId,
      privateKey: this.privateKey,
      installationId: this.installationId
    });

    const { token } = await auth({ type: "installation" });
    return new Octokit({ auth: token });
  }

  async updateAllEventsFile(newContent: string, owner: string, repo: string, path: string): Promise<GitHubUpdateResponse> {
    try {
      const octokit = await this.getOctokit();
      
      // Get current file to get its SHA
      const { data: currentFile } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      // Update file
      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: 'Update all-events.md',
        content: Buffer.from(newContent).toString('base64'),
        sha: Array.isArray(currentFile) ? undefined : currentFile.sha,
      });

      return { commit: { sha: data.commit.sha } };
    } catch (error) {
      console.error('File update failed:', error);
      throw error;
    }
  }
}
