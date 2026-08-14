import { useEffect, useRef } from "react";

import { distanceKm } from "@/lib/settlements";

export type MapPoint = {
  lat: number;
  lng: number;
  label: string;
};

type Props = {
  place: MapPoint;
  current?: MapPoint | null;
};

/** Лека вградена карта (Leaflet + OSM плочки), зарежда се само в браузъра. */
export function LocationMap({ place, current = null }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;

      const map = L.map(ref.current, {
        scrollWheelZoom: false,
        attributionControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const dot = (color: string) =>
        L.divIcon({
          className: "",
          html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};box-shadow:0 0 0 4px ${color}33"></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

      L.marker([place.lat, place.lng], { icon: dot("#dc2626") })
        .addTo(map)
        .bindTooltip(place.label, { direction: "top", offset: [0, -8] });

      if (current) {
        L.marker([current.lat, current.lng], { icon: dot("#059669") })
          .addTo(map)
          .bindTooltip(current.label, { direction: "top", offset: [0, -8] });

        L.polyline(
          [
            [current.lat, current.lng],
            [place.lat, place.lng],
          ],
          { color: "#059669", weight: 3, dashArray: "6 8", opacity: 0.8 },
        ).addTo(map);

        map.fitBounds(
          L.latLngBounds([
            [current.lat, current.lng],
            [place.lat, place.lng],
          ]),
          { padding: [36, 36] },
        );
      } else {
        map.setView([place.lat, place.lng], 12);
      }

      cleanup = () => map.remove();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [place.lat, place.lng, place.label, current?.lat, current?.lng, current?.label, current]);

  const km = current ? distanceKm(place, current) : null;

  return (
    <div>
      <div
        ref={ref}
        className="h-64 w-full overflow-hidden rounded-2xl ring-1 ring-black/10"
        role="img"
        aria-label={`Карта с местоположението на ${place.label}`}
      />
      {km !== null && (
        <p className="mt-2 text-sm text-black/60">
          Права линия до настоящата локация: <b>{km} км</b>
        </p>
      )}
    </div>
  );
}
