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
      console.log('Processing private key...');

      // キーの正規化
      let normalizedKey = privateKey
        .replace(/\\n/g, '\n')
        .trim();

      // 改行の追加
      if (!normalizedKey.endsWith('\n')) {
        normalizedKey += '\n';
      }

      // PEMフォーマットの検証
      console.log('Key format check:', {
        hasBeginMarker: normalizedKey.includes('BEGIN RSA PRIVATE KEY'),
        hasEndMarker: normalizedKey.includes('END RSA PRIVATE KEY'),
        lineCount: normalizedKey.split('\n').length,
        totalLength: normalizedKey.length
      });

      this.privateKey = normalizedKey;
      this.owner = owner;
      this.repo = repo;

      console.log('GitHubFileUpdater initialized successfully');
    } catch (error) {
      console.error('GitHubFileUpdater initialization error:', error);
      throw error;
    }
  }

  private generateJWT(): string {
    try {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iat: now - 30,
        exp: now + (10 * 60),
        iss: this.appId
      };

      console.log('Generating JWT with key length:', this.privateKey.length);
      return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
    } catch (error) {
      console.error('JWT Generation Error:', error);
      throw error;
    }
  }

  public async updateFile(path: string, content: string, message: string): Promise<GitHubUpdateResponse> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;

    try {
      const token = this.generateJWT();
      console.log('JWT token generated successfully');

      const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      };

      // 既存ファイルの取得
      console.log('Fetching existing file:', path);
      const fileResponse = await fetch(url, { headers });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        throw new Error(`File fetch failed (${fileResponse.status}): ${errorText}`);
      }

      const fileData = await fileResponse.json() as GitHubFileResponse;

      // ファイルの更新
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
        throw new Error(`File update failed (${updateResponse.status}): ${errorText}`);
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

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function generateMarkdown(events: Event[]): string {
  const now = new Date();
  let markdown = `# スクラムフェスマップ\n\n`;
  markdown += `作成日時: ${now.toLocaleString('ja-JP')}\n\n---\n\n`;

  const sortedEvents = [...events].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  sortedEvents.forEach(event => {
    markdown += `## ${event.name}\n\n`;
    markdown += `- 開催日: ${new Date(event.date).toLocaleDateString('ja-JP')}\n`;
    markdown += `- 開催地: ${event.prefecture}\n`;
    if (event.website) markdown += `- Webサイト: ${event.website}\n`;
    if (event.youtubePlaylist) markdown += `- 録画一覧: ${event.youtubePlaylist}\n`;
    if (event.description) markdown += `\n${event.description}\n`;
    markdown += '\n---\n\n';
  });

  return markdown;
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
        console.error("Missing GitHub credentials");
        return res.status(500).json({
          error: "GitHub App credentials are not configured",
          details: "環境変数の設定を確認してください"
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