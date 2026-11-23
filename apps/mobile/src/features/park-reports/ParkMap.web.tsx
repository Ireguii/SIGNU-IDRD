import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { initialPoint } from './api';
import type { ParkMapProps } from './ParkMap.types';
import 'leaflet/dist/leaflet.css';

export function ParkMap({ point, onPick }: ParkMapProps) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.CircleMarker | null>(null);
  const current = useRef({ point, onPick });
  current.current = { point, onPick };

  useEffect(() => {
    let disposed = false;
    void import('leaflet').then((module) => {
      if (disposed || !container.current) return;
      const library = module.default ?? module;
      const center = current.current.point ?? initialPoint;
      const instance = library.map(container.current).setView([center.latitude, center.longitude], 14);
      library.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        referrerPolicy: 'strict-origin',
      }).on('tileerror', () => setTilesUnavailable(true))
        .on('tileload', () => setTilesUnavailable(false))
        .addTo(instance);
      marker.current = library.circleMarker([center.latitude, center.longitude], {
        radius: 8, color: '#fff', weight: 3, fillColor: '#a61d30', fillOpacity: 1, opacity: 0,
      }).addTo(instance);
      if (current.current.point) marker.current.setStyle({ opacity: 1, fillOpacity: 1 });
      else marker.current.setStyle({ fillOpacity: 0 });
      instance.on('click', ({ latlng }: Leaflet.LeafletMouseEvent) =>
        current.current.onPick({ latitude: latlng.lat, longitude: latlng.lng }));
      map.current = instance;
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!point) return;
    marker.current?.setLatLng([point.latitude, point.longitude]).setStyle({ opacity: 1, fillOpacity: 1 });
    map.current?.panTo([point.latitude, point.longitude]);
  }, [point]);

  return (
    <div style={{ position: 'relative', isolation: 'isolate' }}>
      <div
        ref={container}
        aria-label="Mapa para elegir el punto de la novedad"
        style={{ height: 250, borderRadius: 18, backgroundColor: '#e7f0eb', overflow: 'hidden', zIndex: 0 }}
      />
      {tilesUnavailable && <div role="status" style={{
        position: 'absolute', left: 47, top: 10, right: 10, padding: '8px 10px',
        borderRadius: 8, background: '#fff', color: '#142638', font: '12px system-ui', pointerEvents: 'none',
      }}>Mapa base temporalmente no disponible. Puedes usar tu ubicación o elegir uno de los parques.</div>}
    </div>
  );
}
