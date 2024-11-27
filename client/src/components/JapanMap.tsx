import { useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import { prefectures } from "@/lib/prefectures";
import { japanGeoData } from "@/lib/japanGeoData";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EventList } from "./EventList";
import type { Event } from "@db/schema";
import type { Layer } from "leaflet";

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

  // スタイル設定
  const getFeatureStyle = (feature: any) => {
    const prefId = feature.properties.id;
    const prefecture = prefectures.find(p => p.id === prefId);
    const hasEvents = events.some(event => event.prefecture === prefecture?.name);
    
    return {
      fillColor: selectedPrefecture === prefId 
        ? "hsl(222.2 47.4% 11.2%)" 
        : hasEvents 
          ? "hsl(222.2 47.4% 40%)" 
          : "hsl(210 40% 96.1%)",
      weight: 1,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.7
    };
  };

  // クリックイベントハンドラ
  const onEachFeature = (feature: any, layer: Layer) => {
    layer.on({
      click: () => {
        const prefId = feature.properties.id;
        onPrefectureSelect(prefId);
        setShowEventDialog(true);
      }
    });
  };

  return (
    <>
      <Card className="p-4">
        <MapContainer
          center={[36.5, 138]}
          zoom={5}
          style={{ height: "70vh", width: "100%" }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            data={japanGeoData}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
          />
          {events.map((event) => {
            const prefecture = prefectures.find(p => p.name === event.prefecture);
            if (!prefecture) return null;
            const coord = japanGeoData.features.find(f => f.properties.id === prefecture.id)
              ?.geometry.coordinates[0][0];
            if (!coord) return null;
            return (
              <Marker key={event.id} position={[coord[1], coord[0]]}>
                <Popup>
                  <div>
                    <h3 className="font-bold">{event.name}</h3>
                    <p>{event.prefecture}</p>
                    <p>{new Date(event.date).toLocaleDateString('ja-JP')}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
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
