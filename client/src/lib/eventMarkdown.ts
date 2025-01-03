
import type { Event } from "@db/schema";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { prefectureCoordinates } from "./prefectures";

interface MarkdownOptions {
  includeMapLink?: boolean;
  includeTimestamp?: boolean;
}

export function generateEventMarkdown(events: Event[], options: MarkdownOptions = {}): string {
  let header = `# スクラムフェスマップ\n\n`;
  
  if (options.includeMapLink) {
    header += `- マップ: https://scrumfestmap.kawaguti.dev\n\n`;
  }
  
  header += `---\n\n`;

  const eventsList = events
    .filter(event => !event.isArchived)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(generateEventSection)
    .join('');

  return header + eventsList;
}

function generateEventSection(event: Event): string {
  let markdown = `## ${event.name}\n\n`;
  markdown += generateLocationInfo(event);
  markdown += generateDateInfo(event);
  markdown += generateDescriptionSection(event);
  markdown += generateLinksSection(event);
  markdown += '\n---\n\n';
  return markdown;
}

function generateLocationInfo(event: Event): string {
  let info = `- 開催地: ${event.prefecture}\n`;
  
  // イベントの座標が指定されている場合はそれを使用
  if (event.coordinates && event.coordinates.trim() !== '') {
    const [lat, lng] = event.coordinates.split(',').map(coord => coord.trim());
    info += `- 座標: \`[${lng}, ${lat}]\` (ユーザー指定座標)\n`;
  } else {
    // 座標が指定されていない場合は都道府県の座標を使用
    const prefCoords = prefectureCoordinates[event.prefecture];
    if (prefCoords) {
      const [lat, lng] = prefCoords;
      info += `- 座標: \`[${lng}, ${lat}]\` (都道府県座標)\n`;
    } else {
      info += `- 座標: 未設定\n`;
    }
  }
  return info;
}

function generateDateInfo(event: Event): string {
  const date = new Date(event.date);
  date.setHours(date.getHours() + 9); // JST adjustment
  return `- 開催日: ${format(date, "yyyy年MM月dd日(E)", { locale: ja })}\n\n`;
}

function generateDescriptionSection(event: Event): string {
  if (!event.description) return '';

  const paragraphs = event.description.trim().split(/\n\s*\n/);
  const formattedParagraphs = paragraphs.map((para, index) => {
    if (para.includes('\n- ')) return para;
    return index === 0
      ? para.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('  \n')
      : para.replace(/\s*\n\s*/g, ' ').trim();
  });

  return formattedParagraphs.join('\n\n') + '\n';
}

function generateLinksSection(event: Event): string {
  let links = '';
  
  if (event.website) {
    links += `\n- Webサイト: ${event.website}\n`;
  }
  
  if (event.youtubePlaylist?.trim()) {
    links += `- 録画一覧: ${event.youtubePlaylist}\n`;
  }
  
  return links;
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
