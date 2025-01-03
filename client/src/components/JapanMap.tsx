import { useState, useMemo, FC, PropsWithChildren, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import type { Layer } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "react-leaflet-markercluster/dist/styles.min.css";
import { prefectures, prefectureCoordinates } from "@/lib/prefectures";
import { japanGeoData } from "@/lib/japanGeoData";
import { EventList } from "./EventList";
import type { Event } from "@db/schema";

interface MarkerClusterGroupProps {
  chunkedLoading?: boolean;
  spiderfyOnMaxZoom?: boolean;
  animate?: boolean;
  maxClusterRadius?: number;
}

const MarkerClusterGroupWithChildren: FC<PropsWithChildren<MarkerClusterGroupProps>> = 
  MarkerClusterGroup as any;

interface JapanMapProps {
  events: Event[];
  selectedPrefecture: string | null;
  onPrefectureSelect: (prefectureId: string) => void;
}

export function JapanMap({ events, selectedPrefecture, onPrefectureSelect }: JapanMapProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventHistory, setEventHistory] = useState<Event[]>([]);

  // イベントを「前日まで」と「当日以降」に分類する関数
  const categorizedEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events.reduce((acc, event) => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      
      if (eventDate < today) {
        acc.past.push(event);
      } else {
        acc.upcoming.push(event);
      }
      
      return acc;
    }, { past: [] as Event[], upcoming: [] as Event[] });
  }, [events]);

  // 初期表示時に当日以降の最初のイベントを自動選択
  useEffect(() => {
    if (!selectedEvent && events.length > 0 && categorizedEvents.upcoming.length > 0) {
      const upcomingEvent = categorizedEvents.upcoming[0];
      handleMarkerClick(upcomingEvent);
      // 該当する都道府県を選択
      const prefecture = prefectures.find(p => p.name === upcomingEvent.prefecture);
      if (prefecture) {
        onPrefectureSelect(prefecture.id);
      }
    }
  }, [events, categorizedEvents.upcoming, selectedEvent]);

  const handleMarkerClick = (event: Event) => {
    setSelectedEvent(event);
    setEventHistory(prev => {
      const filtered = prev.filter(e => e.id !== event.id);
      return [event, ...filtered].slice(0, 3);
    });
  };

  const prefectureEvents = useMemo(() => {
    if (!selectedPrefecture) return [];
    const prefecture = prefectures.find(p => p.id === selectedPrefecture);
    return events.filter(event => event.prefecture === prefecture?.name);
  }, [events, selectedPrefecture]);

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

  const onEachFeature = (feature: any, layer: Layer) => {
    layer.on({
      click: () => {
        const prefId = feature.properties.id;
        onPrefectureSelect(prefId);
        setSelectedEvent(null);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
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
            <MarkerClusterGroupWithChildren
              chunkedLoading
              spiderfyOnMaxZoom
              animate
              maxClusterRadius={30}
            >
              {events.map((event) => {
                const prefecture = prefectures.find(p => p.name === event.prefecture);
                if (!prefecture) return null;

                // イベントの座標か都道府県のデフォルト座標を使用
                let coordinates: [number, number];
                if (event.coordinates && event.coordinates.trim() !== '') {
                  try {
                    console.log(`イベント「${event.name}」の座標処理:`, event.coordinates);
                    const [lat, lng] = event.coordinates.split(',').map(coord => Number(coord.trim()));
                    console.log('パース後の座標:', { lat, lng });
                    if (!isNaN(lat) && !isNaN(lng)) {
                      // Leafletは[latitude, longitude]の順序で座標を期待する
                      coordinates = [lat, lng] as [number, number];
                      console.log('有効な座標として設定:', coordinates);
                      if (!coordinates[0] || !coordinates[1]) {
                        console.log('座標が不完全なためデフォルト使用');
                        coordinates = prefectureCoordinates[event.prefecture];
                      }
                    } else {
                      console.log('座標が無効なためデフォルト使用');
                      coordinates = prefectureCoordinates[event.prefecture];
                    }
                  } catch (error) {
                    console.error('座標の解析エラー:', error, event.coordinates);
                    coordinates = prefectureCoordinates[event.prefecture];
                  }
                } else {
                  coordinates = prefectureCoordinates[event.prefecture];
                }
                if (!coordinates) return null;
                
                const isFutureEvent = new Date(event.date) > new Date();
                
                return (
                  <Marker 
                    key={event.id} 
                    position={coordinates}
                    eventHandlers={{
                      click: () => handleMarkerClick(event)
                    }}
                    icon={L.divIcon({
                      className: 'marker-container',
                      html: `
                        <div class="marker-pin-google ${isFutureEvent ? 'future-event' : 'past-event'}">
                          <div class="marker-head"></div>
                          <div class="marker-tail"></div>
                        </div>
                      `,
                      iconSize: [30, 42],
                      iconAnchor: [15, 42],
                      popupAnchor: [0, -42]
                    })}
                  >
                    <Popup>
                      <div className="space-y-2">
                        <h3 className="font-bold text-lg">{event.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {event.prefecture}
                          {event.coordinates && (
                            <span className="text-xs ml-1">
                              ({event.coordinates.trim() === coordinates.join(', ') ? '都道府県座標' : 'ユーザー指定座標'})
                            </span>
                          )}
                        </p>
                        <p className="text-sm">{new Date(event.date).toLocaleDateString('ja-JP')}</p>
                        {event.description && (
                          <p className="text-sm mt-2 popup-description">{event.description}</p>
                        )}
                        <div className="flex gap-4 mt-2">
                          {event.website && (
                            <a
                              href={event.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-500 hover:text-blue-700"
                            >
                              イベントサイトへ
                            </a>
                          )}
                          {event.youtubePlaylist && event.youtubePlaylist.trim() !== "" && (
                            <a
                              href={event.youtubePlaylist}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-500 hover:text-blue-700"
                            >
                              録画を見る
                            </a>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroupWithChildren>
          </MapContainer>
        </Card>
      </div>

      <div className="space-y-4">
        {selectedEvent ? (
          <>
            <h2 className="text-xl font-semibold">選択されたイベント</h2>
            <EventList
              events={eventHistory}
              selectedEvent={selectedEvent}
            />
          </>
        ) : selectedPrefecture ? (
          <>
            <h2 className="text-xl font-semibold">{prefectures.find(p => p.id === selectedPrefecture)?.name}のイベント</h2>
            {categorizedEvents.upcoming.length > 0 && (
              <>
                <h3 className="text-lg font-medium mt-6 mb-2">これから</h3>
                <EventList
                  events={prefectureEvents.filter(event => categorizedEvents.upcoming.includes(event))}
                  selectedEvent={null}
                />
              </>
            )}
            {categorizedEvents.past.length > 0 && (
              <>
                <h3 className="text-lg font-medium mt-6 mb-2">これまで</h3>
                <EventList
                  events={prefectureEvents.filter(event => categorizedEvents.past.includes(event))}
                  selectedEvent={null}
                />
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">最近選択したイベント</h2>
            <EventList
              events={eventHistory}
              selectedEvent={selectedEvent}
            />
          </>
        )}
      </div>
    </div>
  );
}