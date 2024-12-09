import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2, Edit, Download } from "lucide-react";
import type { Event } from "@db/schema";
import { EventForm } from "@/components/EventForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateEventMarkdown, downloadMarkdown } from "@/lib/eventMarkdown";

async function fetchAllEvents(): Promise<Event[]> {
  const response = await fetch("/api/events");
  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }
  return response.json();
}

export default function MyEventsPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: fetchAllEvents,
    retry: 1,
  });

  const updateEventMutation = useMutation({
    mutationFn: async (updatedEvent: Event) => {
      const updateData = {
        name: updatedEvent.name,
        prefecture: updatedEvent.prefecture,
        date: updatedEvent.date,
        website: updatedEvent.website,
        description: updatedEvent.description,
        youtubePlaylist: updatedEvent.youtubePlaylist,
      };

      const response = await fetch(`/api/events/${updatedEvent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "イベントの更新に失敗しました");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "更新完了",
        description: "イベント情報を更新しました。",
      });
      setEditingEvent(null);
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: error instanceof Error ? error.message : "イベントの更新に失敗しました。",
      });
    },
  });

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // エラー時の表示
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-destructive">
          <p>エラーが発生しました。</p>
          <p className="text-sm">{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      </div>
    );
  }

  // イベントのソート
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // ログインユーザーの場合は自分のイベントのみをフィルタリング
  const displayEvents = user
    ? sortedEvents.filter((event) => event.createdBy === user.id)
    : sortedEvents;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">イベント一覧</h1>
          {displayEvents.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                const markdown = generateEventMarkdown(displayEvents);
                downloadMarkdown(markdown, `all-events-${format(new Date(), "yyyyMMdd-HHmm")}.md`);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              マークダウンでダウンロード
            </Button>
          )}
        </div>
        <Button variant="outline" onClick={() => setLocation("/")}>
          ホームへ戻る
        </Button>
      </header>

      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>イベントの編集</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <EventForm
              defaultValues={{
                name: editingEvent.name,
                prefecture: editingEvent.prefecture,
                date: new Date(editingEvent.date),
                website: editingEvent.website || "",
                description: editingEvent.description || "",
                youtubePlaylist: editingEvent.youtubePlaylist || "",
              }}
              onSubmit={async (data) => {
                await updateEventMutation.mutateAsync({
                  ...editingEvent,
                  ...data,
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      {displayEvents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>表示できるイベントはありません。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {displayEvents.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{event.name}</CardTitle>
                    <CardDescription>
                      {format(new Date(event.date), "yyyy年M月d日(E)", {
                        locale: ja,
                      })}
                    </CardDescription>
                  </div>
                  {event.createdBy === user?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingEvent(event)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      編集
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>開催地: {event.prefecture}</p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                  )}
                  <div className="flex gap-2 mt-4">
                    {event.website && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => event.website && window.open(event.website, "_blank")}
                      >
                        Webサイトを開く
                      </Button>
                    )}
                    {event.youtubePlaylist && event.youtubePlaylist.trim() !== "" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => event.youtubePlaylist && window.open(event.youtubePlaylist, "_blank")}
                      >
                        録画を見る
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
