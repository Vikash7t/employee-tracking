'use client';

import React, { useEffect, useRef } from 'react';
import { Map, NavigationControl, Marker, Popup } from 'maplibre-gl';
import { WorksiteDto, AttendanceSessionDto } from '@employee-tracking/contracts';

interface MapLibreViewerProps {
  worksites: WorksiteDto[];
  activeSessions?: AttendanceSessionDto[];
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  height?: string;
}

/**
 * Generates GeoJSON circle polygon from center coordinate and radius in meters.
 */
function createGeoJsonCircle(lng: number, lat: number, radiusMeters: number, points: number = 64) {
  const coords: [number, number][] = [];
  const distanceX = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusMeters / 110540;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]); // Close ring

  return {
    type: 'Feature' as const,
    properties: { radiusMeters },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  };
}

export function MapLibreViewer({
  worksites,
  activeSessions = [],
  center = [77.5979, 12.9857], // Default Bengaluru
  zoom = 14,
  height = '500px',
}: MapLibreViewerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Use built-in standard OSM tile style object for 100% offline/local reliability
    const map = new Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center,
      zoom,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      // Build worksites GeoJSON collection
      const features: any[] = [];
      worksites.forEach((w) => {
        if (w.worksiteType === 'POLYGON' && w.polygonCoordinates) {
          features.push({
            type: 'Feature',
            properties: { id: w.id, name: w.name, type: 'POLYGON' },
            geometry: {
              type: 'Polygon',
              coordinates: w.polygonCoordinates,
            },
          });
        } else {
          features.push({
            ...createGeoJsonCircle(w.longitude, w.latitude, w.radiusMeters || 50),
            properties: { id: w.id, name: w.name, type: 'CIRCULAR' },
          });
        }
      });

      map.addSource('worksites-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features,
        },
      });

      // Fill layer
      map.addLayer({
        id: 'worksites-fill',
        type: 'fill',
        source: 'worksites-source',
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.2,
        },
      });

      // Outline stroke
      map.addLayer({
        id: 'worksites-stroke',
        type: 'line',
        source: 'worksites-source',
        paint: {
          'line-color': '#0369a1',
          'line-width': 2,
        },
      });
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update employee markers dynamically
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Render worksite center pins
    worksites.forEach((w) => {
      const el = document.createElement('div');
      el.className = 'w-7 h-7 bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold';
      el.innerText = '🏢';

      const popup = new Popup({ offset: 15 }).setHTML(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
          <strong style="color: #0f172a; font-size: 13px;">${w.name}</strong>
          <div style="color: #64748b; margin-top: 4px;">Type: ${w.worksiteType}</div>
          <div style="color: #64748b;">Radius: ${w.radiusMeters}m | Grace: ${w.gracePeriodSeconds}s</div>
        </div>
      `);

      const marker = new Marker({ element: el })
        .setLngLat([w.longitude, w.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });

    // Render active workforce pins
    activeSessions.forEach((s) => {
      // If we find worksite coordinates for the session
      const worksite = worksites.find((w) => w.id === s.worksiteId);
      if (!worksite) return;

      const isInside = s.presenceStatus === 'INSIDE';
      const isPending = s.presenceStatus === 'EXIT_PENDING';
      const color = isInside ? '#16a34a' : isPending ? '#d97706' : '#dc2626';

      const el = document.createElement('div');
      el.className = 'w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-md text-[10px] text-white font-bold cursor-pointer';
      el.style.backgroundColor = color;
      el.innerText = '👤';

      const popup = new Popup({ offset: 15 }).setHTML(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
          <strong style="color: #0f172a;">Employee Session</strong>
          <div style="margin-top: 4px;">Presence: <span style="color: ${color}; font-weight: bold;">${s.presenceStatus}</span></div>
          <div style="color: #64748b;">Clocked In: ${new Date(s.clockInAt).toLocaleTimeString()}</div>
          <div style="color: #64748b;">Inside Duration: ${Math.floor(s.insideDurationSeconds / 60)} min</div>
        </div>
      `);

      // Slightly jitter marker near center to avoid perfect overlap
      const marker = new Marker({ element: el })
        .setLngLat([worksite.longitude + 0.0001, worksite.latitude + 0.0001])
        .setPopup(popup)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [worksites, activeSessions]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-xs" style={{ height }}>
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs px-3 py-2 rounded-lg border border-slate-200 text-[11px] space-y-1 shadow-sm pointer-events-none">
        <div className="font-semibold text-slate-700">Geospatial Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
          <span className="text-slate-600">Worksite Geofence</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
          <span className="text-slate-600">Active (INSIDE)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span>
          <span className="text-slate-600">Exit Grace (PENDING)</span>
        </div>
      </div>
    </div>
  );
}
