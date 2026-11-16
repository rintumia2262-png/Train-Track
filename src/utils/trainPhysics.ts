import {
  LiveTrainState,
  STATIONS,
  TrainDefinition,
  TrainMotionPhase,
} from '../data/railwayNetwork';

export interface TrainPhysicsMemory {
  dwellUntilMs: number;
  lastDwelledStopIdx: number;
  exactSpeedKmh: number;
}

const CRUISE_SPEED_BY_TRAIN: Record<string, number> = {
  'suborna-701': 84,
  'sonar-bangla-788': 82,
  'banalata-791': 84,
  'ekota-706': 76,
  'drutojan-757': 76,
  'chitra-763': 70,
  'parabat-709': 68,
};

const BRIDGE_OR_CROSSING_IDS = new Set([
  'bbsetu_e',
  'chhatian_gram',
  'ishwardi_bp',
  'akhaura',
]);

/**
 * Advances a single train along its corridor using realistic rail kinematics:
 * - Gradual tractive acceleration leaving stations
 * - Open-track cruising speed with mild grade undulation
 * - Speed restrictions across major bridges & loop crossings
 * - Smooth braking into intermediate stations + 20s platform dwell at 0 km/h
 */
export function stepRealisticTrainPhysics(
  train: TrainDefinition,
  state: LiveTrainState,
  memory: TrainPhysicsMemory,
  dtSec: number,
  nowMs: number
): LiveTrainState {
  const totalKm = Math.max(10, train.stops[train.stops.length - 1]?.kmFromStart || 300);
  const currentKm = state.progress01 * totalKm;
  const cruiseKmh = CRUISE_SPEED_BY_TRAIN[train.id] ?? 74;

  // 1. Check if currently dwelling at a station platform
  if (memory.dwellUntilMs > nowMs) {
    const stop = train.stops[memory.lastDwelledStopIdx];
    const st = stop ? STATIONS[stop.stationId] : undefined;
    memory.exactSpeedKmh = 0;
    return {
      ...state,
      speedKmh: 0,
      motionPhase: 'stopped',
      statusNoteBn: st ? `${st.nameBn} প্ল্যাটফর্মে যাত্রাবিরতি` : 'প্ল্যাটফর্মে বিরতি',
      statusNoteEn: st ? `Halted at ${st.nameEn}` : 'Halted at platform',
    };
  }

  // 2. Find nearest previous & next scheduled stops
  let prevIdx = 0;
  for (let i = 0; i < train.stops.length - 1; i++) {
    if (currentKm >= train.stops[i].kmFromStart) {
      prevIdx = i;
    }
  }
  const nextIdx = Math.min(train.stops.length - 1, prevIdx + 1);
  const prevStop = train.stops[prevIdx];
  const nextStop = train.stops[nextIdx];

  const distSincePrevKm = Math.max(0, currentKm - prevStop.kmFromStart);
  const distToNextKm = Math.max(0, nextStop.kmFromStart - currentKm);

  // Trigger realistic platform stop when arriving at an intermediate station (within 90m)
  if (
    nextIdx > 0 &&
    nextIdx < train.stops.length - 1 &&
    distToNextKm <= 0.09 &&
    memory.lastDwelledStopIdx !== nextIdx
  ) {
    memory.lastDwelledStopIdx = nextIdx;
    memory.dwellUntilMs = nowMs + 20_000; // 20s realistic passenger boarding dwell
    memory.exactSpeedKmh = 0;
    const st = STATIONS[nextStop.stationId];
    return {
      ...state,
      progress01: Math.min(0.98, nextStop.kmFromStart / totalKm),
      speedKmh: 0,
      motionPhase: 'stopped',
      statusNoteBn: st ? `${st.nameBn} স্টেশনে থামছে` : 'স্টেশনে থামছে',
      statusNoteEn: st ? `Stopped at ${st.nameEn}` : 'Stopped at station',
    };
  }

  // 3. Compute target track speed limit based on distance to stations & bridges
  let targetSpeedKmh = cruiseKmh;
  let motionPhase: TrainMotionPhase = 'cruising';
  let statusNoteBn = 'পূর্ণ গতিতে চলছে';
  let statusNoteEn = 'Cruising on mainline';

  // Bridge / loop-crossing speed restriction (within 2.2 km of major bridge/junction)
  for (const stop of train.stops) {
    if (BRIDGE_OR_CROSSING_IDS.has(stop.stationId)) {
      const dist = Math.abs(currentKm - stop.kmFromStart);
      if (dist < 2.2 && dist > 0.12) {
        const cap = stop.stationId === 'bbsetu_e' ? 40 : 48;
        if (cap < targetSpeedKmh) {
          targetSpeedKmh = cap;
          const st = STATIONS[stop.stationId];
          statusNoteBn = st ? `${st.nameBn} সংলগ্ন সেতু/ক্রসিং সীমা` : 'ক্রসিং সতর্কতা';
          statusNoteEn = st ? `Caution near ${st.nameEn}` : 'Bridge / crossing speed limit';
        }
      }
    }
  }

  // Approaching station braking curve (last 2.6 km)
  const BRAKE_ZONE_KM = 2.6;
  if (distToNextKm < BRAKE_ZONE_KM) {
    const approachTarget = Math.max(8, Math.sqrt(distToNextKm / BRAKE_ZONE_KM) * cruiseKmh);
    if (approachTarget < targetSpeedKmh) {
      targetSpeedKmh = approachTarget;
      motionPhase = 'braking';
      const nextSt = STATIONS[nextStop.stationId];
      statusNoteBn = nextSt ? `${nextSt.nameBn} স্টেশনে প্রবেশ করছে` : 'স্টেশনে থামছে';
      statusNoteEn = nextSt ? `Braking for ${nextSt.nameEn}` : 'Braking for station';
    }
  }

  // Departing station tractive acceleration curve (first 2.4 km)
  const ACCEL_ZONE_KM = 2.4;
  if (distSincePrevKm < ACCEL_ZONE_KM && prevIdx > 0) {
    const accelCap = Math.max(14, 10 + Math.sqrt(distSincePrevKm / ACCEL_ZONE_KM) * (cruiseKmh - 10));
    if (accelCap < targetSpeedKmh) {
      targetSpeedKmh = accelCap;
      motionPhase = 'accelerating';
      const prevSt = STATIONS[prevStop.stationId];
      statusNoteBn = prevSt ? `${prevSt.nameBn} ছেড়ে গতি তুলছে` : 'গতি তুলছে';
      statusNoteEn = prevSt ? `Accelerating out of ${prevSt.nameEn}` : 'Accelerating';
    }
  }

  // Subtle realistic track grade undulation during cruise
  if (motionPhase === 'cruising') {
    const gradeWave = Math.sin(nowMs * 0.00035 + train.number.charCodeAt(0)) * 2.2;
    targetSpeedKmh = Math.max(20, targetSpeedKmh + gradeWave);
  }

  // 4. Rate-limit acceleration (+1.9 km/h per sec) & braking (-2.6 km/h per sec)
  const curSpeed = memory.exactSpeedKmh;
  const maxAccelStep = 1.9 * dtSec;
  const maxBrakeStep = 2.6 * dtSec;

  let nextSpeed = curSpeed;
  if (targetSpeedKmh > curSpeed) {
    nextSpeed = Math.min(targetSpeedKmh, curSpeed + maxAccelStep);
    if (motionPhase === 'cruising' && curSpeed < targetSpeedKmh - 6) {
      motionPhase = 'accelerating';
      statusNoteBn = 'গতি বৃদ্ধি করছে';
      statusNoteEn = 'Picking up speed';
    }
  } else if (targetSpeedKmh < curSpeed) {
    nextSpeed = Math.max(targetSpeedKmh, curSpeed - maxBrakeStep);
    if (curSpeed - targetSpeedKmh > 5) {
      motionPhase = 'braking';
    }
  }
  memory.exactSpeedKmh = Math.max(0, Math.min(115, nextSpeed));

  // 5. Integrate position along route using average speed over dtSec
  const avgSpeedKmh = (curSpeed + memory.exactSpeedKmh) * 0.5;
  const deltaKm = (avgSpeedKmh / 3600) * dtSec;
  let nextProgress = state.progress01 + deltaKm / totalKm;

  if (nextProgress >= 0.985) {
    nextProgress = 0.03;
    memory.lastDwelledStopIdx = -1;
    memory.dwellUntilMs = 0;
    memory.exactSpeedKmh = 18;
  }

  return {
    ...state,
    progress01: nextProgress,
    speedKmh: Math.round(memory.exactSpeedKmh),
    motionPhase,
    statusNoteBn,
    statusNoteEn,
  };
}
