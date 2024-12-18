import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { EventHistory } from "@db/schema";

interface EventHistoryWithDetails extends EventHistory {
  username: string;
  eventName: string;
}

async function fetchEventHistory(eventId: string): Promise<EventHistoryWithDetails[]> {
  const response = await fetch(`/api/events/${eventId}/history`);
  if (!response.ok) {
    throw new Error("編集履歴の取得に失敗しました");
  }
  return response.json();
}

const columnNameMap: Record<string, string> = {
  name: "イベント名",
  prefecture: "開催都道府県",
  date: "開催日",
  website: "Webサイト",
  description: "説明",
  youtubePlaylist: "YouTubeプレイリスト",
};

export default function EventHistoryPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const eventId = params.eventId;

  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ["eventHistory", eventId],
    queryFn: () => fetchEventHistory(eventId!),
    enabled: !!eventId,
    refetchInterval: 1000, // 1秒ごとに自動更新
    refetchOnWindowFocus: true, // ウィンドウにフォーカスが当たった時に更新
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
      <div className="container mx-auto py-6 space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">編集履歴</h1>
          <Button variant="outline" onClick={() => setLocation("/my-events")}>
            イベント一覧へ戻る
          </Button>
        </header>
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-destructive space-y-2">
              <p className="font-medium">エラーが発生しました</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "編集履歴の取得に失敗しました"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">編集履歴</h1>
        <Button variant="outline" onClick={() => setLocation("/my-events")}>
          イベント一覧へ戻る
        </Button>
      </header>

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>編集履歴はありません。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((record) => (
            <Card key={record.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {record.eventName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(record.modifiedAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                  </p>
                  <p>
                    編集者: <span className="font-medium">{record.username}</span>
                  </p>
                  <p>
                    変更項目: <span className="font-medium">{columnNameMap[record.modifiedColumn] || record.modifiedColumn}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm font-medium mb-1">変更前</p>
                      <p className="text-sm text-muted-foreground">{record.oldValue || "(なし)"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">変更後</p>
                      <p className="text-sm text-muted-foreground">{record.newValue}</p>
                    </div>
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
