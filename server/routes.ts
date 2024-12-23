import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory, insertEventSchema } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import jwt, { sign } from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';

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

  constructor(appId: string, privateKeyPath: string, owner: string, repo: string) {
    try {
      this.appId = appId;

      // プライベートキーファイルを直接読み込む
      this.privateKey = readFileSync(join(process.cwd(), privateKeyPath), 'utf8');

      this.owner = owner;
      this.repo = repo;

      console.log('GitHubFileUpdater initialized with:', {
        appId,
        owner,
        repo,
        privateKeyLength: this.privateKey.length,
        privateKeyLines: this.privateKey.split('\n').length,
        privateKeyStart: this.privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----'),
        privateKeyEnd: this.privateKey.endsWith('-----END RSA PRIVATE KEY-----\n')
      });
    } catch (error) {
      console.error('GitHubFileUpdater initialization error:', error);
      throw new Error(`GitHub認証の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
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

      console.log('Generating JWT with payload:', {
        ...payload,
        privateKeyLines: this.privateKey.split('\n').length
      });

      return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
    } catch (error) {
      console.error('JWT Generation Error:', error);
      throw new Error(`JWT生成エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getHeaders(): Promise<Headers> {
    try {
      const token = this.generateJWT();
      console.log('JWT token generated successfully');

      return new Headers({
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      });
    } catch (error) {
      console.error('Headers Generation Error:', error);
      throw error;
    }
  }

  public async updateFile(path: string, content: string, message: string): Promise<GitHubUpdateResponse> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;

    try {
      const headers = await this.getHeaders();
      console.log('Fetching existing file:', path);

      // 既存ファイルの取得
      const fileResponse = await fetch(url, { headers });
      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        console.error('File fetch failed:', {
          status: fileResponse.status,
          statusText: fileResponse.statusText,
          errorText
        });
        throw new Error(`ファイル取得エラー (${fileResponse.status}): ${errorText}`);
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
        console.error('File update failed:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          errorText
        });
        throw new Error(`ファイル更新エラー (${updateResponse.status}): ${errorText}`);
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

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ error: "管理者権限が必要です" });
  }
  next();
}

export function setupRoutes(app: Express) {
  app.get("/api/events", async (req, res) => {
    try {
      console.log("Fetching events from database...");
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      console.log(`Found ${allEvents.length} events`);
      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({
        error: "イベントの取得に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー"
      });
    }
  });

  app.post("/api/admin/sync-github", requireAdmin, async (req, res) => {
    console.log("Starting GitHub sync process...");

    try {
      const githubAppId = process.env.GITHUB_APP_ID;
      if (!githubAppId) {
        console.error("Missing GitHub App ID");
        return res.status(500).json({
          error: "GitHub App IDが設定されていません",
          details: "環境変数GITHUB_APP_IDを設定してください"
        });
      }

      console.log('Creating GitHubFileUpdater instance...');
      const github = new GitHubFileUpdater(
        githubAppId,
        'scrumfestmap.2024-12-23.private-key.pem',  // プライベートキーファイルのパス
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