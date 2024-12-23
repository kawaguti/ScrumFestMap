import type { Event } from "@db/schema";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { prefectureCoordinates } from "./prefectures";

export function generateEventMarkdown(events: Event[]): string {
  const now = new Date();
  const header = `# スクラムフェスマップ\n\n作成日時: ${format(now, "yyyy年MM月dd日 HH:mm", { locale: ja })}\n\n---\n\n`;

  const eventsList = events
    .filter(event => !event.isArchived)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(event => {
    let markdown = `## ${event.name}\n\n`;
    markdown += `- 開催地: ${event.prefecture}\n`;

    // 座標の処理
    if (event.coordinates) {
      const coordinates = typeof event.coordinates === 'string' 
        ? event.coordinates.split(',').map(coord => coord.trim())
        : event.coordinates;

      if (Array.isArray(coordinates)) {
        const [lat, lng] = coordinates;
        markdown += `- 座標: \`[${lng}, ${lat}]\` (Leaflet形式)\n`;
      }
    } else {
      const prefCoords = prefectureCoordinates[event.prefecture];
      if (prefCoords) {
        const [lat, lng] = prefCoords;
        markdown += `- 座標: \`[${lng}, ${lat}]\` (Leaflet形式)\n`;
      } else {
        markdown += `- 座標: 未設定\n`;
      }
    }

    markdown += `- 開催日: ${format(new Date(event.date), "yyyy年MM月dd日(E)", { locale: ja })}\n\n`;

    if (event.description) {
      const paragraphs = event.description.trim().split(/\n\s*\n/);
      const formattedParagraphs = paragraphs.map((para, index) => {
        if (para.includes('\n- ')) {
          return para;
        }
        return index === 0
          ? para.split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .join('  \n')
          : para.replace(/\s*\n\s*/g, ' ').trim();
      });

      markdown += formattedParagraphs.join('\n\n') + '\n';
    }

    if (event.website) {
      markdown += `\n- Webサイト: ${event.website}\n`;
    }

    if (event.youtubePlaylist && event.youtubePlaylist.trim() !== "") {
      markdown += `- 録画一覧: ${event.youtubePlaylist}\n`;
    }

    markdown += '\n---\n\n';
    return markdown;
  }).join('');

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