import { Event } from "@db/schema";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { prefectureCoordinates } from "./prefectures";

export function generateEventMarkdown(events: Event[]): string {
  const now = new Date();
  const header = `# スクラムフェスマップ\n\n作成日時: ${format(now, "yyyy年MM月dd日 HH:mm", { locale: ja })}\n\n---\n\n`;

  const eventsList = events.map(event => {
    let markdown = `## ${event.name}\n\n`;
    markdown += `- 開催地: ${event.prefecture}\n`;
    if (event.coordinates) {
      const [lat, lng] = event.coordinates.split(',').map(coord => coord.trim());
      markdown += `- 座標: \`[${lng}, ${lat}]\` (Leaflet形式)\n`;
    } else {
      markdown += `- 座標: 未設定\n`;
    }
    markdown += `- 開催日: ${format(new Date(event.date), "yyyy年MM月dd日(E)", { locale: ja })}\n\n`;

    if (event.description) {
      // 説明文を段落に分割
      const paragraphs = event.description.trim().split(/\n\s*\n/);

      // 各段落の処理
      const formattedParagraphs = paragraphs.map((para, index) => {
        // 箇条書きの場合は改行を維持
        if (para.includes('\n- ')) {
          return para;
        }

        // 概要部分（最初の段落）は改行を2つのスペースと改行に変換
        if (index === 0) {
          return para.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('  \n');
        }

        // その他の通常段落は1行にまとめる
        return para.replace(/\s*\n\s*/g, ' ').trim();
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