import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  title?: string;
  sub?: string;
  href?: string;
  kind?: 'label' | 'label-alt' | 'dot' | 'num' | 'num-ghost';
  onClick?: () => void;
}

const icon = (p: MapPoint) =>
  L.divIcon({
    className: 'pin',
    iconSize: undefined as never,
    html:
      p.kind === 'num' || p.kind === 'num-ghost'
        ? `<span class="pin-num ${p.kind === 'num-ghost' ? 'ghost' : ''}">${p.label ?? ''}</span>`
        : p.kind === 'dot'
          ? '<span class="pin-dot"></span>'
          : `<span class="pin-label ${p.kind === 'label-alt' ? 'alt' : ''}">${(p.label ?? '').replace(/</g, '&lt;')}</span>`,
  });

function Fit({ points, focus }: { points: MapPoint[]; focus?: string | null }) {
  const map = useMap();
  useEffect(() => {
    const f = focus ? points.find((p) => p.id === focus) : null;
    if (f) {
      map.flyTo([f.lat, f.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
      return;
    }
    if (!points.length) return;
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14);
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 15 });
  }, [map, points, focus]);
  return null;
}

/** Light, cool-toned Leaflet map (keyless Esri light-grey canvas). Used for hotels, trips and rentals. */
export function HotelMap({
  points,
  height = 420,
  route = false,
  focus,
  center,
  zoom = 12,
}: {
  points: MapPoint[];
  height?: number | string;
  route?: boolean;
  focus?: string | null;
  center?: [number, number];
  zoom?: number;
}) {
  const valid = useMemo(() => points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0)), [points]);
  const start: [number, number] = center ?? (valid[0] ? [valid[0].lat, valid[0].lng] : [20.59, 78.96]);
  return (
    <div className="map" style={{ height }}>
      <MapContainer center={start} zoom={valid.length ? zoom : 4} scrollWheelZoom={false} attributionControl>
        {/* Keyless Esri light-grey canvas, cooled slightly in CSS to sit on the sky palette. */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
          maxZoom={16}
        />
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
        {route && valid.length > 1 && <Polyline positions={valid.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#001489', weight: 1.5, dashArray: '4 6', opacity: 0.9 }} />}
        {valid.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icon(p)} eventHandlers={p.onClick ? { click: p.onClick } : undefined}>
            {(p.title || p.sub) && (
              <Popup>
                <strong style={{ textTransform: 'uppercase', fontWeight: 500 }}>{p.title}</strong>
                {p.sub && <div style={{ opacity: 0.7, marginTop: 4 }}>{p.sub}</div>}
                {p.href && (
                  <a href={p.href} style={{ display: 'inline-block', marginTop: 8, textDecoration: 'underline', textTransform: 'uppercase', fontSize: 11 }}>
                    Open →
                  </a>
                )}
              </Popup>
            )}
          </Marker>
        ))}
        <Fit points={valid} focus={focus} />
      </MapContainer>
    </div>
  );
}
