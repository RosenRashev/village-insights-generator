import { useEffect, useRef, useState } from "react";

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

type RouteInfo =
  | { kind: "road"; km: number; minutes: number }
  | { kind: "straight"; km: number };

/** Лека вградена карта (Leaflet + OSM плочки), зарежда се само в браузъра. */
export function LocationMap({ place, current = null }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const controller = new AbortController();

    setRouteInfo(null);
    setLoading(current !== null);

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

      if (!current) {
        map.setView([place.lat, place.lng], 12);
        cleanup = () => map.remove();
        return;
      }

      L.marker([current.lat, current.lng], { icon: dot("#059669") })
        .addTo(map)
        .bindTooltip(current.label, { direction: "top", offset: [0, -8] });

      const drawStraightFallback = () => {
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

        const km = distanceKm(place, current);
        if (!cancelled && km !== null) setRouteInfo({ kind: "straight", km });
      };

      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${current.lng},${current.lat};${place.lng},${place.lat}?overview=full&geometries=geojson`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        const json = (await res.json()) as {
          routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[];
        };
        const route = json.routes?.[0];
        const coords = route?.geometry?.coordinates;
        if (!coords || coords.length < 2 || typeof route?.distance !== "number") {
          throw new Error("OSRM: няма маршрут");
        }

        const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
        L.polyline(latLngs, { color: "#059669", weight: 4, opacity: 0.85 }).addTo(map);
        map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36] });

        if (!cancelled) {
          setRouteInfo({
            kind: "road",
            km: Math.round((route.distance / 1000) * 10) / 10,
            minutes: Math.round((route.duration ?? 0) / 60),
          });
        }
      } catch {
        if (!cancelled) drawStraightFallback();
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }

      cleanup = () => map.remove();
    })();

    return () => {
      cancelled = true;
      controller.abort();
      cleanup?.();
    };
  }, [place.lat, place.lng, place.label, current?.lat, current?.lng, current?.label, current]);

  return (
    <div>
      <div
        ref={ref}
        className="h-64 w-full overflow-hidden rounded-[1.25rem] shadow-sm ring-1 ring-black/5"
        role="img"
        aria-label={`Карта с местоположението на ${place.label}`}
      />
      {loading && (
        <p className="mt-2 text-sm text-black/60">Изчисляване на маршрут…</p>
      )}
      {!loading && routeInfo?.kind === "road" && (
        <p className="mt-2 text-sm text-black/60">
          Разстояние по път: <b>{routeInfo.km} км</b> (~{routeInfo.minutes} мин)
        </p>
      )}
      {!loading && routeInfo?.kind === "straight" && (
        <p className="mt-2 text-sm text-black/60">
          Права линия до настоящата локация: <b>{routeInfo.km} км</b> (маршрутът по път не бе достъпен)
        </p>
      )}
    </div>
  );
}
