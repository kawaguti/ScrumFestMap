import { format } from "date-fns";
import { ja } from "date-fns/locale";
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
}

export function EventList({ events }: EventListProps) {
  const sortedEvents = [...events].sort(
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
    <div className="space

-y-4">
      {sortedEvents.map((event) => (
        <Card key={event.id}>
          <CardHeader>
            <CardTitle>{event.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(event.date), "yyyy年M月d日(E) HH:mm", {
                locale: ja,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {event.description && (
              <p className="text-sm text-muted-foreground mb-4">
                {event.description}
              </p>
            )}
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
