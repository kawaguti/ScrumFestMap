import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface EventStats {
  totalEvents: number;
  upcomingEvents: number;
  prefectureStats: Record<string, number>;
  monthlyStats: Record<string, number>;
}

async function fetchEventStats(): Promise<EventStats> {
  const response = await fetch("/api/stats");
  if (!response.ok) {
    throw new Error("Failed to fetch event statistics");
  }
  return response.json();
}

export function EventDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["eventStats"],
    queryFn: fetchEventStats,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Sort prefecture stats by count
  const sortedPrefectureStats = Object.entries(stats.prefectureStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>総イベント数</CardTitle>
          <CardDescription>登録された全イベント</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.totalEvents}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>開催予定</CardTitle>
          <CardDescription>今後のイベント数</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.upcomingEvents}</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>都道府県別トップ5</CardTitle>
          <CardDescription>イベント数が多い地域</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedPrefectureStats.map(([prefecture, count]) => (
              <div key={prefecture} className="flex items-center gap-2">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2"
                    style={{
                      width: `${(count / stats.totalEvents) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-muted-foreground min-w-[8rem] text-right">
                  {prefecture} ({count}件)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
