import { Event } from "@db/schema";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { prefectureCoordinates } from "./prefectures";

export function generateEventMarkdown(events: Event[]): string {
  const now = new Date();
  const header = `# イベント一覧\n\n作成日時: ${format(now, "yyyy年MM月dd日 HH:mm", { locale: ja })}\n\n`;
  
  const eventsList = events.map(event => {
    const coordinates = prefectureCoordinates[event.prefecture] || [0, 0];
    let markdown = `## ${event.name}\n\n`;
    markdown += `- 開催地: ${event.prefecture}\n`;
    markdown += coordinates[0] === 0 && coordinates[1] === 0
      ? `- 座標: 未設定\n`
      : `- 座標: \`[${coordinates[1]}, ${coordinates[0]}]\` (Leaflet形式)\n`;
    markdown += `- 開催日: ${format(new Date(event.date), "yyyy年MM月dd日(E)", { locale: ja })}\n`;
    
    if (event.description) {
      markdown += `- 説明:\n  ${event.description}\n`;
    }
    
    if (event.website) {
      markdown += `- Webサイト: ${event.website}\n`;
    }
    
    if (event.youtubePlaylist && event.youtubePlaylist.trim() !== "") {
      markdown += `- 録画一覧: ${event.youtubePlaylist}\n`;
    }
    
    return markdown;
  }).join('\n---\n\n');
  
  return header + eventsList;
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
