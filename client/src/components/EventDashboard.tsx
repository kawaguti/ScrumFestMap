import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface EventStats {
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
        <Loader2 className="h-8 w-8 animate-spin" role="status" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>月別イベント統計</CardTitle>
          <CardDescription>月ごとのイベント数</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(stats.monthlyStats).map(([month, count]) => (
              <div key={month} className="flex items-center gap-2">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2"
                    style={{
                      width: `${(count / Math.max(...Object.values(stats.monthlyStats))) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-muted-foreground min-w-[8rem] text-right">
                  {month} ({count}件)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}