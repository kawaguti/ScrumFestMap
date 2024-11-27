import { useState, useMemo } from "react";
import { prefectures } from "@/lib/prefectures";
import { prefecturePaths } from "@/lib/prefecturePaths";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EventList } from "./EventList";
import type { Event } from "@db/schema";

interface JapanMapProps {
  events: Event[];
  selectedPrefecture: string | null;
  onPrefectureSelect: (prefectureId: string) => void;
}

export function JapanMap({ events, selectedPrefecture, onPrefectureSelect }: JapanMapProps) {
  const [showEventDialog, setShowEventDialog] = useState(false);

  const prefectureEvents = useMemo(() => {
    if (!selectedPrefecture) return [];
    const prefecture = prefectures.find(p => p.id === selectedPrefecture);
    return events.filter(event => event.prefecture === prefecture?.name);
  }, [events, selectedPrefecture]);

  const getPrefectureColor = (id: string) => {
    const prefecture = prefectures.find(p => p.id === id);
    const hasEvents = events.some(event => event.prefecture === prefecture?.name);
    
    if (selectedPrefecture === id) {
      return "hsl(222.2 47.4% 11.2%)";
    }
    return hasEvents ? "hsl(222.2 47.4% 40%)" : "hsl(210 40% 96.1%)";
  };

  return (
    <>
      <Card className="p-4">
        <svg
          viewBox="0 0 800 1100"
          className="w-full h-full"
          style={{ maxHeight: '80vh' }}
        >
          <g>
            {prefectures.map((prefecture) => (
              <path
                key={prefecture.id}
                d={prefecturePaths[prefecture.id]}
                fill={getPrefectureColor(prefecture.id)}
                stroke="white"
                strokeWidth="0.5"
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  onPrefectureSelect(prefecture.id);
                  setShowEventDialog(true);
                }}
              />
            ))}
          </g>
        </svg>
      </Card>

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedPrefecture && prefectures.find(p => p.id === selectedPrefecture)?.name}
              のイベント
            </DialogTitle>
            <DialogDescription>
              選択された地域で開催されるイベント一覧
            </DialogDescription>
          </DialogHeader>
          <EventList events={prefectureEvents} />
        </DialogContent>
      </Dialog>
    </>
  );
}