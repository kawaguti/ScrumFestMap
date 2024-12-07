import { useState, useMemo } from "react";
import { JapanMap } from "../../components/JapanMap";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Label } from "../../components/ui/label";
import type { Event } from "@db/schema";

// 静的なイベントデータ（後でJSONファイルとして分離）
const staticEvents: Event[] = [];

export default function StaticHomePage() {
  const [selectedPrefecture, setSelectedPrefecture] = useState<string | null>(null);
  const [displayPeriod, setDisplayPeriod] = useState<"all" | "upcoming">("all");

  // イベントのフィルタリング
  const filteredEvents = useMemo(() => {
    if (displayPeriod === "all") return staticEvents;
    
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    return staticEvents.filter(event => {
      const eventDate = new Date(event.date);
      const now = new Date();
      return eventDate >= now && eventDate <= oneYearFromNow;
    });
  }, [displayPeriod]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b px-4 py-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent whitespace-nowrap">
              スクラムフェスマップ
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/events"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:bg-accent hover:text-accent-foreground h-10 py-2 px-4"
            >
              イベント一覧
            </a>
          </div>
        </div>

        {/* 表示期間選択 */}
        <div className="w-full sm:w-auto">
          <RadioGroup
            value={displayPeriod}
            onValueChange={(value: "all" | "upcoming") => setDisplayPeriod(value)}
            className="flex items-center justify-center sm:justify-start space-x-4 p-2 bg-muted/10 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">全期間</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="upcoming" id="upcoming" />
              <Label htmlFor="upcoming">今後一年間</Label>
            </div>
          </RadioGroup>
        </div>
      </header>

      <div className="space-y-6">
        <JapanMap
          events={filteredEvents}
          selectedPrefecture={selectedPrefecture}
          onPrefectureSelect={setSelectedPrefecture}
        />
      </div>
    </div>
  );
}
