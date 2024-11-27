import { useMemo, useState } from "react";
import { prefectures } from "@/lib/prefectures";
import { prefecturePaths } from "@/lib/prefecturePaths";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    return events.filter(event => 
      prefectures.find(p => p.id === selectedPrefecture)?.name === event.prefecture
    );
  }, [events, selectedPrefecture]);

  const getPrefectureColor = (prefectureId: string) => {
    const hasEvents = events.some(event => 
      prefectures.find(p => p.id === prefectureId)?.name === event.prefecture
    );
    
    if (selectedPrefecture === prefectureId) {
      return "hsl(222.2 47.4% 11.2%)";
    }
    return hasEvents ? "hsl(222.2 47.4% 40%)" : "hsl(222.2 47.4% 80%)";
  };

  const handlePrefectureClick = (prefectureId: string) => {
    onPrefectureSelect(prefectureId);
    setShowEventDialog(true);
  };

  return (
    <>
      <Card className="p-4">
        <svg
          viewBox="0 0 800 1100"
          className="w-full h-full"
          style={{ maxHeight: '80vh' }}
        >
          {prefectures.map((prefecture) => (
            <path
              key={prefecture.id}
              id={prefecture.id}
              d={prefecturePaths[prefecture.id]}
              fill={getPrefectureColor(prefecture.id)}
              stroke="white"
              strokeWidth="0.5"
              onClick={() => handlePrefectureClick(prefecture.id)}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            />
          ))}
        </svg>
      </Card>

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPrefecture && prefectures.find(p => p.id === selectedPrefecture)?.name}
              のイベント
            </DialogTitle>
          </DialogHeader>
          <EventList events={prefectureEvents} />
        </DialogContent>
      </Dialog>
    </>
  );
}
