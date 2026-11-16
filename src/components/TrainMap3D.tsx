import React, { useEffect, useRef, useState } from 'react';
import {
  type CustomLayerInterface,
  type GeoJSONSource,
  Map as MapLibreMap,
  MercatorCoordinate,
  setWorkerUrl,
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import * as THREE from 'three';
import { Layers, RotateCcw, Volume2, VolumeX } from 'lucide-react';

setWorkerUrl(maplibreWorkerUrl);
import { LiveTrainState, STATIONS, TrainDefinition } from '../data/railwayNetwork';
import {
  buildTrackPolyline,
  computeTrainTelemetry,
  samplePointAlongRoute,
} from '../utils/trackMath';

interface TrainMap3DProps {
  train: TrainDefinition;
  liveState: LiveTrainState;
  lang: 'bn' | 'en';
  soundEnabled: boolean;
  onToggleSound: () => void;
}

/**
 * Builds a composite 7-part Bangladesh Railway Diesel Locomotive (`THREE.Group`).
 * Forward direction is -Z, Up is +Y.
 */
function createBangladeshLocomotive(): THREE.Group {
  const loco = new THREE.Group();

  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.3 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, metalness: 0.25 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.2 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42, metalness: 0.25 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.15 });
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.5 });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 1.8,
  });

  // 1. Heavy Bogie Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 18.2), chassisMat);
  chassis.position.set(0, 0.55, 0);
  loco.add(chassis);

  // 2. Crimson Lower Skirt Band
  const redBand = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.85, 18.0), redMat);
  redBand.position.set(0, 1.4, 0);
  loco.add(redBand);

  // 3. Golden Yellow Mid Body
  const yellowBand = new THREE.Mesh(new THREE.BoxGeometry(3.22, 1.15, 17.8), yellowMat);
  yellowBand.position.set(0, 2.38, 0);
  loco.add(yellowBand);

  // 4. Royal Blue Upper Cab & Hood
  const blueUpper = new THREE.Mesh(new THREE.BoxGeometry(3.16, 1.05, 17.6), blueMat);
  blueUpper.position.set(0, 3.42, 0);
  loco.add(blueUpper);

  // 5. White Roof Cap
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.32, 17.2), roofMat);
  roof.position.set(0, 4.08, 0);
  loco.add(roof);

  // 6. 4 Roof Exhaust / Radiator Vents (matching screenshot)
  const ventGeo = new THREE.BoxGeometry(1.75, 0.18, 1.15);
  [-4.6, -1.6, 1.4, 4.4].forEach((zPos) => {
    const vent = new THREE.Mesh(ventGeo, ventMat);
    vent.position.set(0, 4.28, zPos);
    loco.add(vent);
  });

  // 7. Front Cab Windshield & Twin Headlights (-Z nose)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.72, 0.15), chassisMat);
  windshield.position.set(0, 3.4, -8.82);
  loco.add(windshield);

  [-0.85, 0.85].forEach((xOff) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.16), lightMat);
    lamp.position.set(xOff, 2.15, -8.92);
    loco.add(lamp);
  });

  return loco;
}

/**
 * Builds a composite 6-part Bangladesh Railway Green/White/Red Passenger Coach (`THREE.Group`).
 */
function createBangladeshCoach(): THREE.Group {
  const coach = new THREE.Group();

  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.3 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45, metalness: 0.2 });
  const redStripeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42, metalness: 0.2 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.15 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.45 });

  // 1. Underframe & Bogies
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.12, 0.85, 20.4), chassisMat);
  chassis.position.set(0, 0.5, 0);
  coach.add(chassis);

  // 2. Red Lower Belt Stripe
  const redBelt = new THREE.Mesh(new THREE.BoxGeometry(3.18, 0.55, 20.2), redStripeMat);
  redBelt.position.set(0, 1.18, 0);
  coach.add(redBelt);

  // 3. Bottle Green Main Coach Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.16, 2.1, 20.2), greenMat);
  body.position.set(0, 2.48, 0);
  coach.add(body);

  // 4. White Roof Canopy
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.34, 19.9), roofMat);
  roof.position.set(0, 3.68, 0);
  coach.add(roof);

  // 5. Recessed Side Windows along both flanks
  const winGeo = new THREE.BoxGeometry(3.22, 0.68, 1.35);
  for (let i = -3; i <= 3; i++) {
    const win = new THREE.Mesh(winGeo, windowMat);
    win.position.set(0, 2.68, i * 2.45);
    coach.add(win);
  }

  // 6. Roof AC Units
  const acGeo = new THREE.BoxGeometry(1.4, 0.22, 2.2);
  [-5.2, 5.2].forEach((zOff) => {
    const ac = new THREE.Mesh(acGeo, chassisMat);
    ac.position.set(0, 3.9, zOff);
    coach.add(ac);
  });

  return coach;
}

export const TrainMap3D: React.FC<TrainMap3DProps> = ({
  train,
  liveState,
  lang,
  soundEnabled,
  onToggleSound,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const [is3D, setIs3D] = useState(true);
  const [mapStyleMode, setMapStyleMode] = useState<'satellite' | 'street'>('satellite');
  const [webglError, setWebglError] = useState(false);
  const tailBadgeRef = useRef<HTMLDivElement | null>(null);

  // Latest props stored in refs so MapLibre custom Three.js layer reads them smoothly without re-creating the map
  const trainRef = useRef(train);
  const liveRef = useRef(liveState);
  const polylineRef = useRef<[number, number][]>(buildTrackPolyline(train));
  const followLockRef = useRef(true);

  useEffect(() => {
    trainRef.current = train;
    polylineRef.current = buildTrackPolyline(train);
    liveRef.current = liveState;
  }, [train, liveState]);

  // Update GeoJSON sources when selected train changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const poly = polylineRef.current;
    const trackSrc = map.getSource('railway-track') as GeoJSONSource | undefined;
    if (trackSrc) {
      trackSrc.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: poly },
      });
    }

    const stationSrc = map.getSource('railway-stations') as GeoJSONSource | undefined;
    if (stationSrc) {
      stationSrc.setData({
        type: 'FeatureCollection',
        features: train.stops
          .map((s) => STATIONS[s.stationId])
          .filter(Boolean)
          .map((st) => ({
            type: 'Feature' as const,
            properties: {
              name: lang === 'bn' ? st.nameBn : st.nameEn,
            },
            geometry: {
              type: 'Point' as const,
              coordinates: st.coords,
            },
          })),
      });
    }

    const telemetry = computeTrainTelemetry(train, liveState, poly);
    followLockRef.current = true;
    map.easeTo({
      center: telemetry.coords,
      zoom: 15.6,
      pitch: is3D ? 58 : 0,
      bearing: 28,
      duration: 900,
    });
  }, [train.id, lang]);

  // Trigger map repaint whenever live train state ticks
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const poly = polylineRef.current;
    const telemetry = computeTrainTelemetry(train, liveState, poly);

    if (followLockRef.current) {
      map.easeTo({
        center: telemetry.coords,
        duration: 600,
        easing: (t) => t,
      });
    }
    map.triggerRepaint();
  }, [liveState.progress01, train]);

  // Toggle Satellite vs Street Map layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('osm-layer')) {
      map.setLayoutProperty(
        'osm-layer',
        'visibility',
        mapStyleMode === 'street' ? 'visible' : 'none'
      );
    }
  }, [mapStyleMode]);

  // Toggle 2D vs 3D perspective pitch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      pitch: is3D ? 58 : 0,
      bearing: is3D ? 28 : 0,
      duration: 650,
    });
  }, [is3D]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const initialPoly = buildTrackPolyline(trainRef.current);
    const initialTelemetry = computeTrainTelemetry(trainRef.current, liveRef.current, initialPoly);

    const tileOrigin = window.location.origin;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        center: initialTelemetry.coords,
        zoom: 15.6,
        pitch: 58,
        bearing: 28,
        maxPitch: 72,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: 'raster',
              tiles: [`${tileOrigin}/api/tiles/satellite/{z}/{y}/{x}`],
              tileSize: 256,
              maxzoom: 18,
            },
            osm: {
              type: 'raster',
              tiles: [`${tileOrigin}/api/tiles/osm/{z}/{x}/{y}`],
              tileSize: 256,
              maxzoom: 18,
            },
          },
          layers: [
            {
              id: 'offline-fallback-bg',
              type: 'background',
              paint: { 'background-color': '#18281c' },
            },
            {
              id: 'satellite-layer',
              type: 'raster',
              source: 'satellite',
            },
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm',
              layout: { visibility: 'none' },
            },
          ],
        },
      });
    } catch {
      setWebglError(true);
      return;
    }

    mapRef.current = map;

    map.on('error', () => {
      // Handled gracefully: offline/background layer still renders the 3D track & train
    });

    map.on('dragstart', () => {
      followLockRef.current = false;
    });

    map.on('load', () => {
      const poly = polylineRef.current;

      map.addSource('railway-track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: poly },
        },
      });

      // 1. Green Embankment Corridor (matching screenshot!)
      map.addLayer({
        id: 'track-embankment',
        type: 'line',
        source: 'railway-track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#5c8c2a',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 18, 17, 42],
          'line-opacity': 0.92,
        },
      });

      // 2. Gravel Ballast Bed
      map.addLayer({
        id: 'track-ballast',
        type: 'line',
        source: 'railway-track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#3f4652',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 9, 17, 22],
        },
      });

      // 3. Railway Sleepers (Dashed cross-ties)
      map.addLayer({
        id: 'track-sleepers',
        type: 'line',
        source: 'railway-track',
        paint: {
          'line-color': '#1e242c',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 8, 17, 19],
          'line-dasharray': [0.35, 0.65],
        },
      });

      // 4. Twin Steel Rails Highlight
      map.addLayer({
        id: 'track-rails-center',
        type: 'line',
        source: 'railway-track',
        paint: {
          'line-color': '#cbd5e1',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2.2, 17, 4.5],
          'line-opacity': 0.85,
        },
      });

      // Stations layer
      map.addSource('railway-stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: trainRef.current.stops
            .map((s) => STATIONS[s.stationId])
            .filter(Boolean)
            .map((st) => ({
              type: 'Feature' as const,
              properties: { name: st.nameBn },
              geometry: { type: 'Point' as const, coordinates: st.coords },
            })),
        },
      });

      map.addLayer({
        id: 'station-dots',
        type: 'circle',
        source: 'railway-stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4, 15, 7],
          'circle-color': '#ffffff',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#be123c',
        },
      });

      // --- Three.js Custom 3D Bangladesh Railway Train Layer ---
      let renderer: THREE.WebGLRenderer;
      let scene: THREE.Scene;
      let camera: THREE.Camera;
      let locoMesh: THREE.Group;
      const coaches: THREE.Group[] = [];
      const COACH_COUNT = 5;

      const train3DLayer: CustomLayerInterface = {
        id: 'bd-train-3d-layer',
        type: 'custom',
        renderingMode: '3d',

        onAdd(_mapInstance, gl) {
          camera = new THREE.Camera();
          scene = new THREE.Scene();

          const ambient = new THREE.AmbientLight(0xffffff, 1.35);
          scene.add(ambient);

          const sun = new THREE.DirectionalLight(0xfff4d6, 1.8);
          sun.position.set(120, 180, 90);
          scene.add(sun);

          const rim = new THREE.DirectionalLight(0x93c5fd, 0.75);
          rim.position.set(-100, 80, -120);
          scene.add(rim);

          locoMesh = createBangladeshLocomotive();
          scene.add(locoMesh);

          for (let i = 0; i < COACH_COUNT; i++) {
            const coach = createBangladeshCoach();
            coaches.push(coach);
            scene.add(coach);
          }

          renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true,
          });
          renderer.autoClear = false;
        },

        render(_gl, options) {
          if (!renderer || !scene || !camera) return;

          const activePoly = polylineRef.current;
          const activeTrain = trainRef.current;
          const activeLive = liveRef.current;
          const zoom = map.getZoom();

          // Keep train readable at both close-up (zoom 16) and mid-range (zoom 12)
          const visualScale = Math.max(2.1, Math.min(28, Math.pow(2, 15.8 - zoom) * 2.2));
          const totalKm = Math.max(10, activeTrain.stops[activeTrain.stops.length - 1]?.kmFromStart || 300);

          // Sample head locomotive + articulated trailing coaches along curved track
          const headSample = samplePointAlongRoute(activePoly, activeLive.progress01);
          const headMerc = MercatorCoordinate.fromLngLat(headSample.coords, 0);
          const meterUnits = headMerc.meterInMercatorCoordinateUnits();
          const finalScale = meterUnits * visualScale;

          locoMesh.position.set(headMerc.x, headMerc.y, 0);
          locoMesh.scale.set(finalScale, finalScale, finalScale);
          locoMesh.rotation.set(Math.PI / 2, 0, headSample.bearingRad - Math.PI, 'ZYX');

          const coachSpacingKm = (21.5 * visualScale) / 1000;
          let tailCoords: [number, number] = headSample.coords;

          for (let i = 0; i < coaches.length; i++) {
            const offsetProgress = activeLive.progress01 - ((i + 1) * coachSpacingKm) / totalKm;
            const coachSample = samplePointAlongRoute(activePoly, Math.max(0.001, offsetProgress));
            const merc = MercatorCoordinate.fromLngLat(coachSample.coords, 0);
            const cScale = merc.meterInMercatorCoordinateUnits() * visualScale;

            coaches[i].position.set(merc.x, merc.y, 0);
            coaches[i].scale.set(cScale, cScale, cScale);
            coaches[i].rotation.set(Math.PI / 2, 0, coachSample.bearingRad - Math.PI, 'ZYX');

            if (i === coaches.length - 1) {
              tailCoords = coachSample.coords;
            }
          }

          // Project tail coach ("ক শেষ বগি") to screen space via DOM ref (zero React re-renders)
          const projectedTail = map.project(tailCoords);
          const badgeEl = tailBadgeRef.current;
          if (badgeEl) {
            const visible =
              projectedTail.x > 10 &&
              projectedTail.x < map.getContainer().clientWidth - 40 &&
              projectedTail.y > 20 &&
              projectedTail.y < map.getContainer().clientHeight - 20;
            badgeEl.style.opacity = visible ? '1' : '0';
            if (visible) {
              badgeEl.style.transform = `translate3d(${Math.round(projectedTail.x + 12)}px, ${Math.round(projectedTail.y - 16)}px, 0)`;
            }
          }

          camera.projectionMatrix.fromArray(options.defaultProjectionData.mainMatrix);
          renderer.resetState();
          renderer.render(scene, camera);
        },

        onRemove() {
          renderer?.dispose();
        },
      };

      map.addLayer(train3DLayer);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    followLockRef.current = true;
    const poly = polylineRef.current;
    const telemetry = computeTrainTelemetry(train, liveState, poly);
    map.flyTo({
      center: telemetry.coords,
      zoom: 15.6,
      pitch: is3D ? 58 : 0,
      bearing: 28,
      duration: 850,
    });
  };

  if (webglError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-emerald-950 p-6 text-center text-emerald-100">
        <div>
          <p className="text-base font-semibold">
            {lang === 'bn'
              ? '৩ডি WebGL ম্যাপ লোড করা যায়নি, তবে লাইভ ট্রেন ট্র্যাকিং ও শিডিউল সচল আছে।'
              : '3D WebGL map unavailable on this browser; live schedule & telemetry remain active.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#18281c]">
      {/* MapLibre + Three.js WebGL Mount */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Floating "↙ ক শেষ বগি" Coach Indicator matching screenshot */}
      <div
        ref={tailBadgeRef}
        className="pointer-events-none absolute left-0 top-0 z-10 flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-lg ring-1 ring-black/10 transition-opacity duration-150"
        style={{ opacity: 0 }}
      >
        <span className="text-rose-700 font-bold">↙</span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-700 text-[11px] font-bold text-white">
          {train.coaches[train.coaches.length - 1] ?? 'ক'}
        </span>
        <span className="whitespace-nowrap">
          {lang === 'bn' ? 'শেষ বগি' : 'Last Coach'}
        </span>
      </div>

      {/* Right-Side Vertical Map Controls Stack (Matching Screenshot) */}
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleSound}
          className={`flex w-14 flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 shadow-lg transition-colors cursor-pointer ${
            soundEnabled
              ? 'border-rose-300 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-white/95 text-rose-700 hover:bg-white'
          }`}
        >
          {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          <span className="text-[10px] font-semibold leading-tight whitespace-nowrap">
            {lang === 'bn' ? (soundEnabled ? 'শব্দ বন্ধ' : 'শব্দ চালু') : soundEnabled ? 'Mute' : 'Sound'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleResetView}
          className="flex w-14 flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white/95 px-1.5 py-2 text-rose-700 shadow-lg hover:bg-white transition-colors cursor-pointer"
        >
          <RotateCcw className="h-5 w-5" />
          <span className="text-[10px] font-semibold leading-tight whitespace-nowrap">
            {lang === 'bn' ? 'শুরুর ভিউ' : 'Reset'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMapStyleMode((m) => (m === 'satellite' ? 'street' : 'satellite'))}
          className="flex w-14 flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white/95 px-1.5 py-2 text-slate-800 shadow-lg hover:bg-white transition-colors cursor-pointer"
        >
          <Layers className="h-5 w-5 text-emerald-700" />
          <span className="text-[10px] font-semibold leading-tight whitespace-nowrap">
            {lang === 'bn'
              ? mapStyleMode === 'satellite'
                ? 'মানচিত্র'
                : 'স্যাটেলাইট'
              : mapStyleMode === 'satellite'
                ? 'Map'
                : 'Satellite'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIs3D((prev) => !prev)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-xs font-bold text-slate-900 shadow-lg hover:bg-white transition-colors cursor-pointer"
        >
          {is3D ? '2D' : '3D'}
        </button>
      </div>

      {/* Bottom-Left Map Attribution Pill (Matching Screenshot) */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-800 shadow-sm">
        <span className="font-bold text-emerald-800">BD Track</span>
        <span aria-hidden="true" className="text-slate-400">·</span>
        <span>{lang === 'bn' ? 'রেললাইন © OpenStreetMap' : 'Railways © OpenStreetMap'}</span>
      </div>
    </div>
  );
};
