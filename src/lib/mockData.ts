import { StateVector, StagingTimelineEvent, ReentryPlasmaTelemetry, AttitudeQuaternion } from './types';

export const INITIAL_ORBIT_STATE: StateVector = {
  x: 6878.14, // ~500 km LEO circular equatorial
  y: 0,
  z: 320.5,
  vx: 0,
  vy: 7.612, // orbital velocity ~7.61 km/s
  vz: 0.12,
  epochSeconds: 0,
};

export const LAUNCH_TIMELINE: StagingTimelineEvent[] = [
  { timeSeconds: 0, event: 'LIFTOFF // ALL 9 ENGINES NOMINAL', stage: 'STAGE_1', altitudeKm: 0.0, velocityKmh: 0, thrustKiloNewtons: 7600, status: 'COMPLETED' },
  { timeSeconds: 68, event: 'MAXIMUM DYNAMIC PRESSURE (MAX-Q)', stage: 'STAGE_1', altitudeKm: 12.8, velocityKmh: 1650, thrustKiloNewtons: 7450, status: 'COMPLETED' },
  { timeSeconds: 154, event: 'MAIN ENGINE CUTOFF (MECO)', stage: 'STAGE_1', altitudeKm: 64.2, velocityKmh: 6840, thrustKiloNewtons: 6200, status: 'COMPLETED' },
  { timeSeconds: 158, event: 'STAGE 1 PNEUMATIC SEPARATION', stage: 'INTERSTAGE', altitudeKm: 67.5, velocityKmh: 6920, thrustKiloNewtons: 0, status: 'ACTIVE' },
  { timeSeconds: 165, event: 'VACUUM ENGINE IGNITION (SES-1)', stage: 'STAGE_2', altitudeKm: 72.1, velocityKmh: 7100, thrustKiloNewtons: 981, status: 'PENDING' },
  { timeSeconds: 210, event: 'COMPOSITE PAYLOAD FAIRING JETTISON', stage: 'PAYLOAD_FAIRING', altitudeKm: 115.4, velocityKmh: 9450, thrustKiloNewtons: 981, status: 'PENDING' },
  { timeSeconds: 520, event: 'SECOND STAGE ENGINE CUTOFF (SECO-1)', stage: 'STAGE_2', altitudeKm: 420.0, velocityKmh: 27400, thrustKiloNewtons: 981, status: 'PENDING' },
  { timeSeconds: 580, event: 'SPACECRAFT NOMINAL ORBITAL INSERTION', stage: 'STAGE_2', altitudeKm: 450.0, velocityKmh: 27550, thrustKiloNewtons: 0, status: 'PENDING' }
];

export const REENTRY_DATA: ReentryPlasmaTelemetry = {
  altitudeKm: 68.4,
  velocityMach: 21.4,
  stagnationHeatFluxWattsCm2: 485.2,
  tpsTileTempCelsius: 1640.5,
  rfAttenuationDb: -64.8,
  blackoutStatus: 'PEAK_BLACKOUT',
  dynamicPressureKPa: 74.2,
};

export const INITIAL_ATTITUDE: AttitudeQuaternion = {
  q0: 0.7071,
  q1: 0.0,
  q2: 0.7071,
  q3: 0.0,
  rollDeg: 0.04,
  pitchDeg: -45.0,
  yawDeg: 180.0,
  angularRateRadS: [0.001, -0.002, 0.0005],
  rcsThrusters: [
    { id: 1, axis: '+X', status: 'IDLE', pulseMs: 120 },
    { id: 2, axis: '-X', status: 'IDLE', pulseMs: 80 },
    { id: 3, axis: '+Y', status: 'FIRING', pulseMs: 250 },
    { id: 4, axis: '-Y', status: 'IDLE', pulseMs: 60 },
    { id: 5, axis: '+Z', status: 'IDLE', pulseMs: 140 },
    { id: 6, axis: '-Z', status: 'FIRING', pulseMs: 180 }
  ]
};
