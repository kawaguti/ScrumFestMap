import { Event } from "@db/schema";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export function generateEventMarkdown(events: Event[]): string {
  const now = new Date();
  const header = `# イベント一覧\n\n作成日時: ${format(now, "yyyy年MM月dd日 HH:mm", { locale: ja })}\n\n`;
  
  const eventsList = events.map(event => {
    let markdown = `## ${event.name}\n\n`;
    markdown += `- 開催地: ${event.prefecture}\n`;
    markdown += `- 開催日: ${format(new Date(event.date), "yyyy年MM月dd日(E)", { locale: ja })}\n`;
    
    if (event.description) {
      markdown += `- 説明:\n  ${event.description}\n`;
    }
    
    if (event.website) {
      markdown += `- Webサイト: ${event.website}\n`;
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
