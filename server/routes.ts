import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory, insertEventSchema } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';

// GitHubのレスポンス型定義
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

// GitHubファイル更新用のクラス
class GitHubFileUpdater {
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly owner: string;
  private readonly repo: string;

  constructor(appId: string, privateKeyPath: string, owner: string, repo: string) {
    this.appId = appId;
    try {
      // .pemファイルから直接読み込む
      let privateKey = readFileSync(privateKeyPath, 'utf8');

      // 改行コードの正規化と前後の空白を削除
      privateKey = privateKey
        .replace(/\r\n/g, '\n')  // Windows形式の改行を統一
        .replace(/\r/g, '\n')    // 古いMac形式の改行を統一
        .trim();                 // 前後の空白を削除

      this.privateKey = privateKey;
      this.owner = owner;
      this.repo = repo;

      // デバッグ情報の出力を詳細化
      console.log('GitHubFileUpdater initialized:', {
        appId,
        privateKeyLength: this.privateKey.length,
        privateKeyLines: this.privateKey.split('\n').length,
        privateKeyStart: this.privateKey.substring(0, 64),
        privateKeyEnd: this.privateKey.substring(this.privateKey.length - 64),
        privateKeyIsValid: this.validatePrivateKey(this.privateKey),
        owner,
        repo
      });

      if (!this.validatePrivateKey(this.privateKey)) {
        throw new Error('Invalid private key format detected during initialization');
      }
    } catch (error) {
      console.error('Error initializing GitHubFileUpdater:', error);
      throw error;
    }
  }

  private validatePrivateKey(key: string): boolean {
    const hasHeader = key.includes('-----BEGIN RSA PRIVATE KEY-----');
    const hasFooter = key.includes('-----END RSA PRIVATE KEY-----');
    const hasContent = key.length > 100;
    const lines = key.split('\n');
    const hasValidStructure = lines.length >= 3;  // ヘッダー、内容、フッターの最小構成

    const validationResult = {
      hasHeader,
      hasFooter,
      hasContent,
      hasValidStructure,
      lineCount: lines.length,
      keyLength: key.length,
      firstLine: lines[0],
      lastLine: lines[lines.length - 1]
    };

    console.log('Private key validation details:', validationResult);

    return hasHeader && hasFooter && hasContent && hasValidStructure;
  }

  private async generateJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      iat: now - 30,
      exp: now + (10 * 60),
      iss: this.appId
    };

    try {
      console.log('Generating JWT with payload:', payload);

      if (!this.validatePrivateKey(this.privateKey)) {
        throw new Error('Invalid private key format: The key must be a valid RSA private key');
      }

      // キーの形式を詳細にチェック
      const keyLines = this.privateKey.split('\n');
      console.log('Private key structure:', {
        totalLines: keyLines.length,
        hasCorrectHeader: keyLines[0] === '-----BEGIN RSA PRIVATE KEY-----',
        hasCorrectFooter: keyLines[keyLines.length - 1] === '-----END RSA PRIVATE KEY-----',
        contentLineCount: keyLines.length - 2,
        sampleContentLine: keyLines[1]?.substring(0, 32) + '...'
      });

      const token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
      console.log('JWT generated successfully');
      return token;
    } catch (error) {
      console.error('JWT Generation Error:', error);
      throw new Error(`Failed to generate JWT: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async updateFile(path: string, content: string, message: string): Promise<GitHubUpdateResponse> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
    console.log('Updating file at:', url);

    try {
      const headers = new Headers({
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${await this.generateJWT()}`,
        'X-GitHub-Api-Version': '2022-11-28'
      });

      // 1. Get current file to obtain SHA
      console.log('Fetching existing file...');
      const fileResponse = await fetch(url, {
        headers,
        method: 'GET'
      });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        console.error('Failed to fetch file:', {
          status: fileResponse.status,
          statusText: fileResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to fetch file: ${errorText}`);
      }

      const fileData = await fileResponse.json() as GitHubFileResponse;
      console.log('File fetched successfully, SHA:', fileData.sha);

      // 2. Update file
      console.log('Updating file with new content...');
      const updateData = {
        message,
        content: Buffer.from(content).toString('base64'),
        sha: fileData.sha
      };

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update file: ${errorText}`);
      }

      const result = await updateResponse.json() as GitHubUpdateResponse;
      console.log('File updated successfully:', result.content.html_url);
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
  // イベント一覧を取得するエンドポイント
  app.get("/api/events", async (req, res) => {
    try {
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      res.setHeader('Content-Type', 'application/json');
      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({
        error: "Failed to fetch events",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // GitHub同期エンドポイント
  app.post("/api/admin/sync-github", requireAdmin, async (req, res) => {
    try {
      console.log("Starting GitHub sync process...");
      const githubAppId = process.env.GITHUB_APP_ID;
      const githubPrivateKeyPath = 'scrumfestmap.2024-12-23.private-key.pem';

      if (!githubAppId) {
        console.error("GitHub App credentials are missing");
        return res.status(500).json({
          error: "GitHub App credentials are not configured",
          details: "Please set GITHUB_APP_ID environment variable"
        });
      }

      const github = new GitHubFileUpdater(
        githubAppId,
        githubPrivateKeyPath,
        'kawaguti',
        'ScrumFestMapViewer'
      );

      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      console.log(`Found ${allEvents.length} events to sync`);
      const markdownContent = generateMarkdown(allEvents);

      try {
        const result = await github.updateFile(
          'all-events.md',
          markdownContent,
          'Update events list via ScrumFestMap'
        );

        console.log('GitHub sync completed:', {
          commitSha: result.commit.sha,
          htmlUrl: result.content.html_url
        });

        res.json({
          success: true,
          message: "GitHubリポジトリにイベント一覧を同期しました",
          url: result.content.html_url
        });
      } catch (error: any) {
        console.error('GitHub sync error:', error);
        res.status(500).json({
          error: "GitHub同期に失敗しました",
          details: error.message
        });
      }
    } catch (error: any) {
      console.error('Server error:', error);
      res.status(500).json({
        error: "同期処理中にエラーが発生しました",
        details: error.message
      });
    }
  });
}

function generateMarkdown(allEvents: Event[]): string {
  const today = new Date();
  let markdown = `# イベント一覧\n\n`;
  markdown += `最終更新: ${today.toLocaleDateString('ja-JP')}\n\n`;

  const sortedEvents = [...allEvents].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  sortedEvents.forEach(event => {
    try {
      markdown += `## ${event.name}\n\n`;
      markdown += `- 日付: ${new Date(event.date).toLocaleDateString('ja-JP')}\n`;
      markdown += `- 場所: ${event.prefecture}\n`;
      if (event.website) markdown += `- Webサイト: ${event.website}\n`;
      if (event.youtubePlaylist) markdown += `- YouTube: ${event.youtubePlaylist}\n`;
      if (event.description) markdown += `\n${event.description}\n`;
      markdown += '\n---\n\n';
    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
    }
  });

  return markdown;
}

function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const isValid = password.length > 8;
  const errors = isValid ? [] : ["パスワードは8文字以上にする必要があります。"];
  return { isValid, errors };
}