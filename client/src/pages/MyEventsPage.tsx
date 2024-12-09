import { useEffect, useState } from "react";
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
import { Loader2, Edit, Save, X } from "lucide-react";
import type { Event } from "@db/schema";
import { EventForm } from "@/components/EventForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const queryClient = useQueryClient();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: fetchAllEvents,
    enabled: true,
    retry: 1,
  });

  const updateEventMutation = useMutation({
    mutationFn: async (updatedEvent: Event) => {
      const response = await fetch(`/api/events/${updatedEvent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedEvent),
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to update event");
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
    onError: () => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "イベントの更新に失敗しました。",
      });
    },
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
                        onClick={() => window.open(event.website, "_blank")}
                      >
                        Webサイトを開く
                      </Button>
                    )}
                    {event.youtubePlaylist && event.youtubePlaylist.trim() !== "" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(event.youtubePlaylist, "_blank")}
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