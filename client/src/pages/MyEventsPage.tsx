import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import type { Event } from "@db/schema";

async function fetchAllEvents(): Promise<Event[]> {
  const response = await fetch("/api/events", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }
  return response.json();
}

export default function MyEventsPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: fetchAllEvents,
    enabled: true,
    retry: 1,
  });

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // エラー時の表示
  if (error) {
    return (
      <div className="container mx-auto py-6 text-center text-destructive">
        <p>エラーが発生しました。再度お試しください。</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/")}>
          ホームへ戻る
        </Button>
      </div>
    );
  }

  // 日付でソート（新しい順）
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">イベント一覧</h1>
        <Button variant="outline" onClick={() => setLocation("/")}>
          ホームへ戻る
        </Button>
      </header>

      {sortedEvents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>登録されているイベントはありません。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sortedEvents.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <CardTitle>{event.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>開催地: {event.prefecture}</p>
                  <p>開催日: {format(new Date(event.date), "yyyy年M月d日(E)", {
                    locale: ja,
                  })}</p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                  )}
                  {event.website && (
                    <p className="text-sm text-muted-foreground">
                      <a href={event.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Webサイトを開く
                      </a>
                    </p>
                  )}
                  {event.youtubePlaylist && event.youtubePlaylist.trim() !== "" && (
                    <p className="text-sm text-muted-foreground">
                      <a href={event.youtubePlaylist} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        録画を見る
                      </a>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}