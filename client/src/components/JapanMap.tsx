import { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import { prefectures } from "@/lib/prefectures";
import type { GeoJSON, GeoFeature } from "@/lib/japanGeoData";
import { japanGeoData } from "@/lib/japanGeoData";
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
  const svgRef = useRef<SVGSVGElement>(null);
  const mapWidth = 800;
  const mapHeight = 600;

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

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear existing content
    d3.select(svgRef.current).selectAll("*").remove();

    // Create the projection
    const projection = d3.geoMercator()
      .center([137, 38])
      .scale(1600)
      .translate([mapWidth / 2, mapHeight / 2]);

    // Create the path generator
    const path = d3.geoPath().projection(projection);

    // Create the SVG container
    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [mapWidth, mapHeight]])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    // Apply zoom behavior
    svg.call(zoom);

    // Create a container for the map
    const g = svg.append("g");

    // Draw prefectures
    g.selectAll("path")
      .data(japanGeoData.features)
      .enter()
      .append("path")
      .attr("d", path as any)
      .attr("fill", (d: any) => getPrefectureColor(d.properties.id))
      .attr("stroke", "white")
      .attr("stroke-width", "0.5")
      .attr("class", "cursor-pointer hover:opacity-80 transition-opacity")
      .on("click", (_, d: any) => {
        onPrefectureSelect(d.properties.id);
        setShowEventDialog(true);
      })
      .on("mouseover", function(_, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke-width", "2");
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke-width", "0.5");
      });

    // Add markers for events
    events.forEach(event => {
      const prefecture = prefectures.find(p => p.name === event.prefecture);
      if (!prefecture) return;

      const feature = japanGeoData.features.find((f: GeoFeature) => f.properties.id === prefecture.id);
      if (!feature) return;

      const [x, y] = path.centroid(feature as any);

      g.append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 4)
        .attr("fill", "red")
        .attr("class", "animate-pulse");
    });

  }, [events, selectedPrefecture, onPrefectureSelect]);

  return (
    <>
      <Card className="p-4">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ maxHeight: '80vh' }}
        />
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
