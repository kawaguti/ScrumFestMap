import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventForm } from "@/components/EventForm";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Edit2, Trash2 } from "lucide-react";
import type { Event } from "@db/schema";

export default function MyEventsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["my-events"],
    queryFn: async () => {
      const response = await fetch("/api/my-events");
      if (!response.ok) throw new Error("Failed to fetch events");
      return response.json();
    },
    enabled: !!user,
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: Event) => {
      const response = await fetch(`/api/events/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-events", "events"] });
      toast({ title: "成功", description: "イベントを更新しました。" });
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

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-events", "events"] });
      toast({ title: "成功", description: "イベントを削除しました。" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "イベントの削除に失敗しました。",
      });
    },
  });

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">マイイベント</h1>
        <Button variant="outline" asChild>
          <Link href="/">ホームへ戻る</Link>
        </Button>
      </header>

      <div className="grid gap-4">
        {events.map((event: Event) => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle>{event.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p>開催地: {event.prefecture}</p>
                  <p>開催日: {format(new Date(event.date), "yyyy年M月d日(E) HH:mm", {
                    locale: ja,
                  })}</p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingEvent(event)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    編集
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("このイベントを削除してもよろしいですか？")) {
                        deleteEventMutation.mutate(event.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    削除
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent className="sm:max-w-[650px] p-8 backdrop-blur-sm bg-background/95">
          <DialogHeader className="space-y-4 mb-8">
            <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              イベントの編集
            </DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg -m-3 p-3" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background/80 rounded-lg opacity-50" />
              <div className="relative z-10 space-y-8">
                <EventForm
                  defaultValues={editingEvent}
                  onSubmit={async (data) => {
                    await updateEventMutation.mutateAsync({
                      ...editingEvent,
                      ...data,
                      id: editingEvent.id,
                    });
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
