import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link, useLocation } from "wouter";
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
import { Edit2, Trash2, Loader2, Download } from "lucide-react";
import { generateEventMarkdown, downloadMarkdown } from "@/lib/eventMarkdown";
import type { Event } from "@db/schema";

export default function MyEventsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // useEffectを使用してリダイレクト処理を行う
  useEffect(() => {
    if (!user) {
      setLocation("/auth");
    }
  }, [user, setLocation]);

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["my-events"],
    queryFn: async () => {
      const response = await fetch("/api/my-events", {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "イベントの取得に失敗しました");
      }
      return response.json();
    },
    enabled: !!user,
    retry: 1,
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
        throw new Error(error.error || "イベントの更新に失敗しました");
      }
      
      return response.json();
    },
    onSuccess: (updatedEvent) => {
      // Immediately update the cache with the new data
      queryClient.setQueryData<Event[]>(["my-events"], (oldEvents) => {
        if (!oldEvents) return [updatedEvent];
        return oldEvents.map((event) =>
          event.id === updatedEvent.id ? updatedEvent : event
        );
      });
      
      // Also invalidate the events query to ensure global list is updated
      queryClient.invalidateQueries({ queryKey: ["events"] });
      
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
        throw new Error(error.error || "イベントの削除に失敗しました");
      }
      
      return response.json();
    },
    onSuccess: (_, deletedEventId) => {
      // イベントリストから削除されたイベントを即座に除外
      queryClient.setQueryData<Event[]>(["my-events"], (oldEvents) => {
        if (!oldEvents) return [];
        return oldEvents.filter((event) => event.id !== deletedEventId);
      });

      // グローバルイベントリストも更新
      queryClient.setQueryData<Event[]>(["events"], (oldEvents) => {
        if (!oldEvents) return [];
        return oldEvents.filter((event) => event.id !== deletedEventId);
      });

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

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">マイイベント</h1>
        <Button variant="outline" asChild>
          <Link href="/">ホームへ戻る</Link>
        </Button>
      </header>
      {events.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              const markdown = generateEventMarkdown(events);
              downloadMarkdown(markdown, `my-events-${format(new Date(), "yyyyMMdd-HHmm")}.md`);
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            マークダウンでダウンロード
          </Button>
        </div>
      )}

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>登録されているイベントはありません。</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/">新しいイベントを登録する</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((event: Event) => (
            <Card key={event.id} className="group hover:shadow-lg transition-all duration-200">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">
                  {event.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingEvent(event)}
                      className="hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      編集
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="hover:bg-destructive/90 transition-colors"
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
      )}

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
                try {
                  await updateEventMutation.mutateAsync({
                    ...editingEvent,
                    ...data,
                  });
                } catch (error) {
                  console.error('Update error:', error);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
