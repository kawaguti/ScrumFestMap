import { db } from "../db";
import { events } from "../db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from 'url';

// ESM環境で__dirnameの代わりに使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportEvents() {
  try {
    // データベースからイベントを取得
    const allEvents = await db.select().from(events).orderBy(events.date);
    
    // JSONファイルとして出力
    const outputPath = path.resolve(__dirname, "../client/src/data/events.json");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      JSON.stringify(allEvents, null, 2),
      'utf-8'
    );
    
    console.log(`Events exported successfully to ${outputPath}`);
  } catch (error) {
    console.error("Failed to export events:", error);
    process.exit(1);
  }
}

exportEvents();
