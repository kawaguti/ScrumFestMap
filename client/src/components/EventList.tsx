import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Event } from "@db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar } from "lucide-react";

interface EventListProps {
  events: Event[];
  selectedEvent?: Event | null;
}

export function EventList({ events, selectedEvent }: EventListProps) {
  // イベント履歴の場合は並び替えを行わず、そのままの順序を維持
  // それ以外の場合（都道府県別表示など）は日付でソート
  const sortedEvents = selectedEvent
    ? events  // 履歴表示の場合は並び替えない
    : [...events].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        イベントが見つかりません。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedEvents.map((event) => (
        <Card 
          key={event.id}
          className={cn(
            selectedEvent?.id === event.id && "border-primary"
          )}>
          <CardHeader>
            <CardTitle>{event.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(event.date), "yyyy年M月d日(E)", {
                locale: ja,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                {event.description && (
                  <p className="text-sm text-muted-foreground">
                    {event.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {event.website && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => event.website && window.open(event.website, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Webサイトへ
                  </Button>
                )}
                {event.youtubePlaylist && event.youtubePlaylist.trim() !== "" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(event.youtubePlaylist, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    YouTubeプレイリスト
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}