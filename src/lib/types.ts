export interface StateVector {
  x: number; // km
  y: number; // km
  z: number; // km
  vx: number; // km/s
  vy: number; // km/s
  vz: number; // km/s
  epochSeconds: number;
}

export interface KeplerianElements {
  semiMajorAxisKm: number; // a
  eccentricity: number; // e
  inclinationDeg: number; // i
  raanDeg: number; // Omega
  argPeriapsisDeg: number; // omega
  trueAnomalyDeg: number; // nu
  orbitalPeriodMin: number;
  apogeeKm: number;
  perigeeKm: number;
}

export interface StagingTimelineEvent {
  timeSeconds: number;
  event: string;
  stage: 'STAGE_1' | 'INTERSTAGE' | 'STAGE_2' | 'PAYLOAD_FAIRING';
  altitudeKm: number;
  velocityKmh: number;
  thrustKiloNewtons: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
}

export interface ReentryPlasmaTelemetry {
  altitudeKm: number;
  velocityMach: number;
  stagnationHeatFluxWattsCm2: number;
  tpsTileTempCelsius: number;
  rfAttenuationDb: number;
  blackoutStatus: 'CLEAR' | 'IONIZING' | 'PEAK_BLACKOUT' | 'COMM_RESTORED';
  dynamicPressureKPa: number;
}

export interface AttitudeQuaternion {
  q0: number; // Scalar
  q1: number; // Vector x
  q2: number; // Vector y
  q3: number; // Vector z
  rollDeg: number;
  pitchDeg: number;
  yawDeg: number;
  angularRateRadS: [number, number, number];
  rcsThrusters: {
    id: number;
    axis: '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';
    status: 'IDLE' | 'FIRING';
    pulseMs: number;
  }[];
}
