import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useLocation } from "wouter";
import type { Event } from "@db/schema";
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
import { Loader2, Edit, Download, Trash2, GitPullRequest } from "lucide-react";
import { EventForm } from "@/components/EventForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import SyncDebugPanel from "@/components/SyncDebugPanel";

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

  const syncGitHubMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/sync-github", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "GitHubとの同期に失敗しました");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "同期完了",
        description: `GitHubリポジトリにイベント一覧を同期しました。${data.details ? `\n${data.details}` : ""}`,
      });
    },
    onError: (error) => {
      console.error("Sync error:", error);
      toast({
        variant: "destructive",
        title: "同期エラー",
        description: error instanceof Error ? error.message : "GitHubとの同期に失敗しました。",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">イベント一覧</h1>
          {events.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = '/api/events/download';
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                マークダウンでダウンロード
              </Button>

              {user && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => syncGitHubMutation.mutate()}
                    disabled={syncGitHubMutation.isPending}
                  >
                    {syncGitHubMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <GitPullRequest className="h-4 w-4 mr-2" />
                    )}
                    GitHubに同期
                  </Button>
                  {user.isAdmin && <SyncDebugPanel />}
                </div>
              )}

            </div>
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
            <div className="grid gap-4 max-h-[calc(100vh-20rem)] overflow-y-auto pr-4">
              <EventForm
                defaultValues={{
                  name: editingEvent.name,
                  prefecture: editingEvent.prefecture,
                  date: new Date(editingEvent.date),
                  website: editingEvent.website || "",
                  description: editingEvent.description || "",
                  youtubePlaylist: editingEvent.youtubePlaylist || "",
                  coordinates: editingEvent.coordinates || "",
                }}
                onSubmit={async (data) => {
                  try {
                    const response = await fetch(`/api/events/${editingEvent.id}`, {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        ...data,
                        coordinates: data.coordinates
                      }),
                      credentials: "include",
                    });

                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || "Failed to update event");
                    }

                    await queryClient.invalidateQueries({ queryKey: ["events"] });
                    toast({
                      title: "更新完了",
                      description: "イベント情報を更新しました。",
                    });
                    setEditingEvent(null);
                  } catch (error) {
                    console.error("Update error:", error);
                    toast({
                      variant: "destructive",
                      title: "エラー",
                      description: error instanceof Error ? error.message : "イベントの更新に失敗しました。",
                    });
                  }
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {sortedEvents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>表示できるイベントはありません。</p>
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
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>開催地: {event.prefecture}</p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                  )}
                  <div className="flex gap-2 mt-4">
                    {event.website && event.website.trim() !== "" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (event.website) {
                            window.open(event.website, "_blank");
                          }
                        }}
                      >
                        Webサイトを開く
                      </Button>
                    )}
                    {event.youtubePlaylist && event.youtubePlaylist.trim() !== "" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (event.youtubePlaylist) {
                            window.open(event.youtubePlaylist, "_blank");
                          }
                        }}
                      >
                        録画を見る
                      </Button>
                    )}
                    {user && (
                      <div className="flex gap-2">
                        {(user.isAdmin || event.createdBy === Number(user.id)) && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm("このイベントを削除してもよろしいですか？\nこの操作は取り消すことができません。")) {
                                // Delete event
                                fetch(`/api/events/${event.id}`, {
                                  method: "DELETE",
                                  credentials: "include",
                                })
                                  .then((response) => {
                                    if (!response.ok) {
                                      throw new Error("Failed to delete event");
                                    }
                                    queryClient.invalidateQueries({ queryKey: ["events"] });
                                    toast({
                                      title: "削除完了",
                                      description: "イベントを削除しました。",
                                    });
                                  })
                                  .catch((error) => {
                                    console.error("Delete error:", error);
                                    toast({
                                      variant: "destructive",
                                      title: "エラー",
                                      description: error instanceof Error ? error.message : "イベントの削除に失敗しました。",
                                    });
                                  });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            削除
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingEvent(event)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/events/${event.id}/history`)}
                        >
                          履歴を見る
                        </Button>
                      </div>
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