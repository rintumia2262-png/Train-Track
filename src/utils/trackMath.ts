import { LiveTrainState, STATIONS, TrainDefinition } from '../data/railwayNetwork';

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * DEG_TO_RAD;
  const dLng = (b[0] - a[0]) * DEG_TO_RAD;
  const lat1 = a[1] * DEG_TO_RAD;
  const lat2 = b[1] * DEG_TO_RAD;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function computeBearingRad(from: [number, number], to: [number, number]): number {
  const lat1 = from[1] * DEG_TO_RAD;
  const lat2 = to[1] * DEG_TO_RAD;
  const dLng = (to[0] - from[0]) * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return Math.atan2(y, x);
}

/**
 * Generates an organic curved railway track polyline connecting all stops of a train,
 * with subtle lateral track curvature so bends look like authentic OpenStreetMap rail geometry.
 */
export function buildTrackPolyline(train: TrainDefinition): [number, number][] {
  const stopCoords = train.stops
    .map((s) => STATIONS[s.stationId]?.coords)
    .filter((c): c is [number, number] => Boolean(c));

  if (stopCoords.length < 2) return stopCoords;

  const polyline: [number, number][] = [];
  const subSteps = 18;

  for (let i = 0; i < stopCoords.length - 1; i++) {
    const p0 = stopCoords[i];
    const p1 = stopCoords[i + 1];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular unit vector for gentle railway curve
    const nx = -dy / len;
    const ny = dx / len;
    const curveAmp = Math.sin((i + 1) * 1.9) * Math.min(len * 0.08, 0.0085);

    for (let step = 0; step < subSteps; step++) {
      const t = step / subSteps;
      const arch = Math.sin(t * Math.PI) * curveAmp;
      polyline.push([p0[0] + dx * t + nx * arch, p0[1] + dy * t + ny * arch]);
    }
  }
  polyline.push(stopCoords[stopCoords.length - 1]);
  return polyline;
}

export interface TrackSample {
  coords: [number, number];
  bearingRad: number; // clockwise from North in radians
  totalKm: number;
}

export function getPolylineTotalKm(polyline: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += haversineKm(polyline[i], polyline[i + 1]);
  }
  return total;
}

/**
 * Samples a geographic [lng, lat] point and forward bearing at progress01 along the polyline.
 */
export function samplePointAlongRoute(polyline: [number, number][], progress01: number): TrackSample {
  if (polyline.length === 0) {
    return { coords: [90.4265, 23.733], bearingRad: 0, totalKm: 1 };
  }
  if (polyline.length === 1) {
    return { coords: polyline[0], bearingRad: 0, totalKm: 1 };
  }

  const clamped = Math.max(0, Math.min(1, progress01));
  const segLengths: number[] = [];
  let totalKm = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const d = haversineKm(polyline[i], polyline[i + 1]);
    segLengths.push(d);
    totalKm += d;
  }

  if (totalKm <= 0) {
    return { coords: polyline[0], bearingRad: 0, totalKm: 1 };
  }

  const targetKm = clamped * totalKm;
  let accKm = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const segKm = segLengths[i];
    if (accKm + segKm >= targetKm || i === segLengths.length - 1) {
      const localT = segKm > 0 ? Math.max(0, Math.min(1, (targetKm - accKm) / segKm)) : 0;
      const a = polyline[i];
      const b = polyline[i + 1];
      return {
        coords: [a[0] + (b[0] - a[0]) * localT, a[1] + (b[1] - a[1]) * localT],
        bearingRad: computeBearingRad(a, b),
        totalKm,
      };
    }
    accKm += segKm;
  }

  const last = polyline[polyline.length - 1];
  const prev = polyline[polyline.length - 2];
  return {
    coords: last,
    bearingRad: computeBearingRad(prev, last),
    totalKm,
  };
}

/**
 * Samples along the polyline using exact arc-length and smoothly extrapolates backward
 * if progress01 < 0 so trailing coaches never collapse onto the starting point.
 */
export function samplePointAlongTrackExact(
  polyline: [number, number][],
  progress01: number
): TrackSample {
  if (polyline.length < 2) {
    return samplePointAlongRoute(polyline, progress01);
  }
  if (progress01 >= 0 && progress01 <= 1) {
    return samplePointAlongRoute(polyline, progress01);
  }

  const base = samplePointAlongRoute(polyline, progress01 < 0 ? 0 : 1);
  const a = progress01 < 0 ? polyline[0] : polyline[polyline.length - 2];
  const b = progress01 < 0 ? polyline[1] : polyline[polyline.length - 1];
  const segKm = Math.max(0.001, haversineKm(a, b));
  const extraKm = (progress01 < 0 ? progress01 : progress01 - 1) * base.totalKm;
  const ratio = extraKm / segKm;
  const anchor = progress01 < 0 ? a : b;

  return {
    coords: [anchor[0] + (b[0] - a[0]) * ratio, anchor[1] + (b[1] - a[1]) * ratio],
    bearingRad: computeBearingRad(a, b),
    totalKm: base.totalKm,
  };
}

/**
 * Snaps an arbitrary GPS coordinate [lng, lat] onto the nearest point on the railway polyline.
 */
export function snapGpsToTrack(
  polyline: [number, number][],
  lng: number,
  lat: number
): { progress01: number; coords: [number, number]; distanceKm: number } {
  let bestDistKm = Infinity;
  let bestProgress = 0;
  let bestCoords: [number, number] = polyline[0] ?? [lng, lat];

  const segLengths: number[] = [];
  let totalKm = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = haversineKm(polyline[i], polyline[i + 1]);
    segLengths.push(d);
    totalKm += d;
  }

  let accKm = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abLenSq = abx * abx + aby * aby;
    const t =
      abLenSq > 0 ? Math.max(0, Math.min(1, ((lng - a[0]) * abx + (lat - a[1]) * aby) / abLenSq)) : 0;
    const proj: [number, number] = [a[0] + abx * t, a[1] + aby * t];
    const distKm = haversineKm([lng, lat], proj);

    if (distKm < bestDistKm) {
      bestDistKm = distKm;
      bestCoords = proj;
      bestProgress = totalKm > 0 ? (accKm + segLengths[i] * t) / totalKm : 0;
    }
    accKm += segLengths[i];
  }

  return {
    progress01: Math.max(0, Math.min(1, bestProgress)),
    coords: bestCoords,
    distanceKm: bestDistKm,
  };
}

export interface ComputedTelemetry {
  prevStopNameBn: string;
  prevStopNameEn: string;
  currentAreaNameBn: string;
  currentAreaNameEn: string;
  nextStopId: string;
  nextStopNameBn: string;
  nextStopNameEn: string;
  distFromPrevKm: number;
  distToNextKm: number;
  segmentProgress01: number;
  coords: [number, number];
  bearingRad: number;
  totalRouteKm: number;
}

export function computeTrainTelemetry(
  train: TrainDefinition,
  live: LiveTrainState,
  polyline: [number, number][]
): ComputedTelemetry {
  const sample = samplePointAlongRoute(polyline, live.progress01);
  const lastStop = train.stops[train.stops.length - 1];
  const totalRouteKm = lastStop?.kmFromStart || sample.totalKm;
  const currentKm = live.progress01 * totalRouteKm;

  let prevIdx = 0;
  for (let i = 0; i < train.stops.length - 1; i++) {
    if (currentKm >= train.stops[i].kmFromStart) {
      prevIdx = i;
    }
  }
  const nextIdx = Math.min(train.stops.length - 1, prevIdx + 1);

  const prevStop = train.stops[prevIdx];
  const nextStop = train.stops[nextIdx];
  const prevStation = STATIONS[prevStop.stationId];
  const nextStation = STATIONS[nextStop.stationId];

  // If there is an intermediate small stop (like Chhatian Gram between Akkelpur & Santahar), surface it smoothly
  const segSpanKm = Math.max(0.5, nextStop.kmFromStart - prevStop.kmFromStart);
  const distFromPrevKm = Math.max(0, currentKm - prevStop.kmFromStart);
  const distToNextKm = Math.max(0, nextStop.kmFromStart - currentKm);
  const segmentProgress01 = Math.max(0, Math.min(1, distFromPrevKm / segSpanKm));

  return {
    prevStopNameBn: prevStation?.nameBn ?? '',
    prevStopNameEn: prevStation?.nameEn ?? '',
    currentAreaNameBn: distFromPrevKm < distToNextKm ? prevStation?.nameBn ?? '' : nextStation?.nameBn ?? '',
    currentAreaNameEn: distFromPrevKm < distToNextKm ? prevStation?.nameEn ?? '' : nextStation?.nameEn ?? '',
    nextStopId: nextStop.stationId,
    nextStopNameBn: nextStation?.nameBn ?? '',
    nextStopNameEn: nextStation?.nameEn ?? '',
    distFromPrevKm: Number(distFromPrevKm.toFixed(1)),
    distToNextKm: Number(distToNextKm.toFixed(1)),
    segmentProgress01,
    coords: sample.coords,
    bearingRad: sample.bearingRad,
    totalRouteKm,
  };
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBnDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}
