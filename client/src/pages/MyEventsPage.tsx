import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
      const response = await fetch("/api/my-events", {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch events");
      }
      return response.json();
    },
    enabled: !!user,
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: Event) => {
      const response = await fetch(`/api/events/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          prefecture: data.prefecture,
          date: data.date,
          website: data.website || "",
          description: data.description || "",
        }),
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update event");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-events", "events"] });
      toast({
        title: "更新完了",
        description: "イベントを更新しました。",
      });
      setEditingEvent(null);
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast({
        variant: "destructive",
        title: "更新エラー",
        description: error instanceof Error ? error.message : "イベントの更新に失敗しました。",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete event");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-events", "events"] });
      toast({
        title: "削除完了",
        description: "イベントを削除しました。",
      });
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast({
        variant: "destructive",
        title: "削除エラー",
        description: error instanceof Error ? error.message : "イベントの削除に失敗しました。",
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
                  {event.website && (
                    <p className="text-sm text-muted-foreground">
                      <a href={event.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Webサイトを開く
                      </a>
                    </p>
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        削除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-background/95 backdrop-blur-sm border-destructive/20">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold bg-gradient-to-r from-destructive to-destructive/80 bg-clip-text text-transparent">
                          イベントの削除
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base">
                          このイベントを削除してもよろしいですか？<br />
                          この操作は取り消すことができません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-background/50 border-input/20">キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteEventMutation.mutate(event.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          削除する
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="sm:max-w-[650px] p-8 bg-background/95 backdrop-blur-sm border-primary/20">
          <DialogHeader className="space-y-4 mb-8">
            <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              イベントの編集
            </DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <EventForm
              defaultValues={{
                name: editingEvent.name,
                prefecture: editingEvent.prefecture,
                date: new Date(editingEvent.date),
                website: editingEvent.website || "",
                description: editingEvent.description || "",
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
    </div>
  );
}
