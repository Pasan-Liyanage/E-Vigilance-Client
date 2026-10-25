import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

/** Sri Lanka as a whole, before anything is pinned. */
const SRI_LANKA = { center: [7.87, 80.77], zoom: 7 };
/** Close enough to tell one junction from the next. */
const PIN_ZOOM = 17;

/**
 * The report's place on a map (OpenStreetMap). Tap anywhere to put the pin
 * there, or drag it; each move is reported through `onPick`. With a GPS fix,
 * a circle shows how far off it may be. Leaflet is loaded only when the map
 * is first shown, so the rest of the app stays light.
 *
 * @param {{
 *   latitude: number | null, longitude: number | null,
 *   accuracy?: number | null,
 *   onPick: (latitude: number, longitude: number) => void,
 * }} props
 */
export default function LocationMap({ latitude, longitude, accuracy, onPick }) {
  const box = useRef(null);
  const map = useRef(null); // { L, map, marker, circle }
  const pickRef = useRef(onPick);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  pickRef.current = onPick;

  // Create the map once.
  useEffect(() => {
    let alive = true;
    import('leaflet')
      .then(({ default: L }) => {
        if (!alive || !box.current) return;
        const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(
          SRI_LANKA.center,
          SRI_LANKA.zoom
        );
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(m);
        const pick = (ll) => pickRef.current(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
        m.on('click', (e) => pick(e.latlng));
        map.current = { L, map: m, marker: null, circle: null };
        // The step animates in; size the map once it has settled.
        setTimeout(() => m.invalidateSize(), 250);
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      map.current?.map.remove();
      map.current = null;
    };
  }, []);

  // Keep the pin and the accuracy circle in step with the form.
  useEffect(() => {
    const ctx = map.current;
    if (!ctx) return;
    const { L, map: m } = ctx;
    if (latitude == null || longitude == null) {
      ctx.marker?.remove();
      ctx.circle?.remove();
      ctx.marker = null;
      ctx.circle = null;
      return;
    }
    const at = [latitude, longitude];
    if (!ctx.marker) {
      ctx.marker = L.marker(at, {
        draggable: true,
        autoPan: true,
        keyboard: true,
        title: 'The place it happened. Drag to move.',
        icon: L.divIcon({ className: 'pin-icon', html: '<span></span>', iconSize: [28, 40], iconAnchor: [14, 40] }),
      }).addTo(m);
      ctx.marker.on('dragend', () => {
        const ll = ctx.marker.getLatLng();
        pickRef.current(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
      });
    } else {
      ctx.marker.setLatLng(at);
    }
    ctx.circle?.remove();
    ctx.circle = accuracy ? L.circle(at, { radius: accuracy, weight: 1, fillOpacity: 0.12 }).addTo(m) : null;
    if (!m.getBounds().pad(-0.2).contains(at) || m.getZoom() < 14) m.setView(at, Math.max(m.getZoom(), PIN_ZOOM));
  }, [latitude, longitude, accuracy, ready]);

  if (failed) {
    return (
      <div className="map-frame map-failed small muted">
        The map couldn't load. Use your current location, or paste a Google Maps link or coordinates below.
      </div>
    );
  }
  return <div ref={box} className="map-frame leaflet-host" role="application" aria-label="Map. Tap to place the pin." />;
}
