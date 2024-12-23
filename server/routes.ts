import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory, insertEventSchema } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import jwt from 'jsonwebtoken';

interface GitHubFileResponse {
  sha: string;
  content: string;
  encoding: string;
}

interface GitHubUpdateResponse {
  content: {
    sha: string;
    html_url: string;
  };
  commit: {
    sha: string;
    url: string;
  };
}

class GitHubFileUpdater {
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly owner: string;
  private readonly repo: string;

  constructor(appId: string, privateKey: string, owner: string, repo: string) {
    this.appId = appId;
    try {
      // Base64デコードを試みる（Base64でエンコードされている場合）
      let decodedKey = privateKey;
      try {
        if (privateKey.match(/^[A-Za-z0-9+/=]+$/)) {
          decodedKey = Buffer.from(privateKey, 'base64').toString('utf-8');
        }
      } catch (error) {
        console.log('Key is not in Base64 format, proceeding with original key');
      }

      // プライベートキーの前処理
      const normalizedKey = decodedKey
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/["']/g, '')
        .trim();

      // キーの形式を確認
      const keyLines = normalizedKey.split('\n');
      const isValidKey = 
        keyLines[0].includes('BEGIN RSA PRIVATE KEY') &&
        keyLines[keyLines.length - 1].includes('END RSA PRIVATE KEY') &&
        keyLines.length > 2;

      if (!isValidKey) {
        throw new Error('Invalid private key format');
      }

      this.privateKey = normalizedKey;
      this.owner = owner;
      this.repo = repo;

      // 初期化時のデバッグ情報
      console.log('GitHubFileUpdater initialized:', {
        appId,
        keyLength: this.privateKey.length,
        lineCount: keyLines.length,
        headerValid: keyLines[0].includes('BEGIN RSA PRIVATE KEY'),
        footerValid: keyLines[keyLines.length - 1].includes('END RSA PRIVATE KEY'),
        contentLines: keyLines.length - 2
      });

    } catch (error) {
      console.error('Error initializing GitHubFileUpdater:', error);
      throw error;
    }
  }

  private async generateJWT(): Promise<string> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iat: now - 30,
        exp: now + (10 * 60),
        iss: this.appId
      };

      // JWTを生成する前の最終チェック
      const keyLines = this.privateKey.split('\n');
      console.log('JWT generation check:', {
        keyLength: this.privateKey.length,
        lineCount: keyLines.length,
        headerPresent: keyLines[0].includes('BEGIN RSA PRIVATE KEY'),
        footerPresent: keyLines[keyLines.length - 1].includes('END RSA PRIVATE KEY'),
        middleLinesSample: keyLines.slice(1, -1).length > 0 ? 
          keyLines[1].substring(0, 10) + '...' : 'No content'
      });

      const token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
      return token;
    } catch (error) {
      console.error('JWT Generation Error:', error);
      throw new Error(`Failed to generate JWT: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async updateFile(path: string, content: string, message: string): Promise<GitHubUpdateResponse> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;

    try {
      const token = await this.generateJWT();
      const headers = new Headers({
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      });

      console.log('Attempting to fetch file:', path);
      const fileResponse = await fetch(url, { headers });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        console.error('File fetch error:', {
          status: fileResponse.status,
          statusText: fileResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to fetch file: ${errorText}`);
      }

      const fileData = await fileResponse.json() as GitHubFileResponse;

      console.log('Updating file contents...');
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message,
          content: Buffer.from(content).toString('base64'),
          sha: fileData.sha
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('File update error:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to update file: ${errorText}`);
      }

      const result = await updateResponse.json() as GitHubUpdateResponse;
      console.log('File update successful:', {
        path,
        commitSha: result.commit.sha,
        url: result.content.html_url
      });

      return result;
    } catch (error) {
      console.error('GitHub API Error:', error);
      throw error;
    }
  }
}

// 管理者権限を確認するミドルウェア
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

export function setupRoutes(app: Express) {
  app.get("/api/events", async (req, res) => {
    try {
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({
        error: "Failed to fetch events",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/admin/sync-github", requireAdmin, async (req, res) => {
    console.log("Starting GitHub sync process...");

    try {
      const githubAppId = process.env.GITHUB_APP_ID;
      const githubPrivateKey = process.env.GITHUB_PRIVATE_KEY;

      if (!githubAppId || !githubPrivateKey) {
        console.error("Missing GitHub credentials:", {
          hasAppId: !!githubAppId,
          hasPrivateKey: !!githubPrivateKey
        });
        return res.status(500).json({
          error: "GitHub App credentials are not configured",
          details: "Please check GITHUB_APP_ID and GITHUB_PRIVATE_KEY environment variables"
        });
      }

      console.log('Creating GitHubFileUpdater instance...');
      const github = new GitHubFileUpdater(
        githubAppId,
        githubPrivateKey,
        'kawaguti',
        'ScrumFestMapViewer'
      );

      console.log('Fetching events from database...');
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      console.log(`Found ${allEvents.length} events to sync`);
      const markdownContent = generateMarkdown(allEvents);

      console.log('Updating GitHub file...');
      const result = await github.updateFile(
        'all-events.md',
        markdownContent,
        'Update events list via ScrumFestMap'
      );

      console.log('Sync completed successfully:', {
        commitSha: result.commit.sha,
        url: result.content.html_url
      });

      res.json({
        success: true,
        message: "GitHubリポジトリにイベント一覧を同期しました",
        details: `更新されたファイル: ${result.content.html_url}`
      });

    } catch (error) {
      console.error('Sync process error:', error);
      res.status(500).json({
        error: "同期処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

function generateMarkdown(events: Event[]): string {
  const today = new Date();
  let markdown = `# イベント一覧\n\n`;
  markdown += `最終更新: ${today.toLocaleDateString('ja-JP')}\n\n`;

  const sortedEvents = [...events].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  sortedEvents.forEach(event => {
    markdown += `## ${event.name}\n\n`;
    markdown += `- 日付: ${new Date(event.date).toLocaleDateString('ja-JP')}\n`;
    markdown += `- 場所: ${event.prefecture}\n`;
    if (event.website) markdown += `- Webサイト: ${event.website}\n`;
    if (event.youtubePlaylist) markdown += `- YouTube: ${event.youtubePlaylist}\n`;
    if (event.description) markdown += `\n${event.description}\n`;
    markdown += '\n---\n\n';
  });

  return markdown;
}

function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const isValid = password.length > 8;
  const errors = isValid ? [] : ["パスワードは8文字以上にする必要があります。"];
  return { isValid, errors };
}