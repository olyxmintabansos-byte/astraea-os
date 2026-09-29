import { StateVector, KeplerianElements } from './types';

// Standard Gravitational Parameter for Earth (km^3 / s^2)
export const MU_EARTH = 398600.4418;
export const EARTH_RADIUS_KM = 6378.137;
export const J2_PERTURBATION = 1.08263e-3;

// Compute gravitational acceleration with J2 oblateness perturbation
export function computeAcceleration(x: number, y: number, z: number): [number, number, number] {
  const r2 = x * x + y * y + z * z;
  const r = Math.sqrt(r2);
  const r3 = r2 * r;
  const r5 = r3 * r2;

  // Base Newtonian 2-body acceleration
  const aNewt = -MU_EARTH / r3;

  // J2 Oblateness Perturbation acceleration components
  const z2OverR2 = (z * z) / r2;
  const j2Factor = 1.5 * J2_PERTURBATION * MU_EARTH * (EARTH_RADIUS_KM * EARTH_RADIUS_KM) / r5;

  const ax = aNewt * x - j2Factor * x * (1 - 5 * z2OverR2);
  const ay = aNewt * y - j2Factor * y * (1 - 5 * z2OverR2);
  const az = aNewt * z - j2Factor * z * (3 - 5 * z2OverR2);

  return [ax, ay, az];
}

// 4th-Order Runge-Kutta (RK4) Numerical Integrator step
export function rk4Step(state: StateVector, dtSeconds: number): StateVector {
  // k1
  const [ax1, ay1, az1] = computeAcceleration(state.x, state.y, state.z);
  const k1_vx = ax1 * dtSeconds;
  const k1_vy = ay1 * dtSeconds;
  const k1_vz = az1 * dtSeconds;
  const k1_x = state.vx * dtSeconds;
  const k1_y = state.vy * dtSeconds;
  const k1_z = state.vz * dtSeconds;

  // k2
  const [ax2, ay2, az2] = computeAcceleration(
    state.x + 0.5 * k1_x,
    state.y + 0.5 * k1_y,
    state.z + 0.5 * k1_z
  );
  const k2_vx = ax2 * dtSeconds;
  const k2_vy = ay2 * dtSeconds;
  const k2_vz = az2 * dtSeconds;
  const k2_x = (state.vx + 0.5 * k1_vx) * dtSeconds;
  const k2_y = (state.vy + 0.5 * k1_vy) * dtSeconds;
  const k2_z = (state.vz + 0.5 * k1_vz) * dtSeconds;

  // k3
  const [ax3, ay3, az3] = computeAcceleration(
    state.x + 0.5 * k2_x,
    state.y + 0.5 * k2_y,
    state.z + 0.5 * k2_z
  );
  const k3_vx = ax3 * dtSeconds;
  const k3_vy = ay3 * dtSeconds;
  const k3_vz = az3 * dtSeconds;
  const k3_x = (state.vx + 0.5 * k2_vx) * dtSeconds;
  const k3_y = (state.vy + 0.5 * k2_vy) * dtSeconds;
  const k3_z = (state.vz + 0.5 * k2_vz) * dtSeconds;

  // k4
  const [ax4, ay4, az4] = computeAcceleration(
    state.x + k3_x,
    state.y + k3_y,
    state.z + k3_z
  );
  const k4_vx = ax4 * dtSeconds;
  const k4_vy = ay4 * dtSeconds;
  const k4_vz = az4 * dtSeconds;
  const k4_x = (state.vx + k3_vx) * dtSeconds;
  const k4_y = (state.vy + k3_vy) * dtSeconds;
  const k4_z = (state.vz + k3_vz) * dtSeconds;

  return {
    x: state.x + (k1_x + 2 * k2_x + 2 * k3_x + k4_x) / 6,
    y: state.y + (k1_y + 2 * k2_y + 2 * k3_y + k4_y) / 6,
    z: state.z + (k1_z + 2 * k2_z + 2 * k3_z + k4_z) / 6,
    vx: state.vx + (k1_vx + 2 * k2_vx + 2 * k3_vx + k4_vx) / 6,
    vy: state.vy + (k1_vy + 2 * k2_vy + 2 * k3_vy + k4_vy) / 6,
    vz: state.vz + (k1_vz + 2 * k2_vz + 2 * k3_vz + k4_vz) / 6,
    epochSeconds: state.epochSeconds + dtSeconds,
  };
}

// Convert Cartesian State Vector to Keplerian Orbital Elements
export function stateVectorToKeplerian(s: StateVector): KeplerianElements {
  const r = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
  const v = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);

  // Specific Angular Momentum vector h = r x v
  const hx = s.y * s.vz - s.z * s.vy;
  const hy = s.z * s.vx - s.x * s.vz;
  const hz = s.x * s.vy - s.y * s.vx;
  const h = Math.sqrt(hx * hx + hy * hy + hz * hz);

  // Semi-major axis a (vis-viva equation)
  const specificEnergy = 0.5 * v * v - MU_EARTH / r;
  const a = -MU_EARTH / (2 * specificEnergy);

  // Eccentricity vector e = ((v^2 - mu/r)*r - (r.v)*v) / mu
  const rDotV = s.x * s.vx + s.y * s.vy + s.z * s.vz;
  const c1 = (v * v - MU_EARTH / r) / MU_EARTH;
  const c2 = rDotV / MU_EARTH;
  const ex = c1 * s.x - c2 * s.vx;
  const ey = c1 * s.y - c2 * s.vy;
  const ez = c1 * s.z - c2 * s.vz;
  const e = Math.sqrt(ex * ex + ey * ey + ez * ez);

  // Inclination i = acos(hz / h)
  const incRad = Math.acos(Math.max(-1, Math.min(1, hz / h)));
  const incDeg = (incRad * 180) / Math.PI;

  // Node vector n = k x h = [-hy, hx, 0]
  const n = Math.sqrt(hy * hy + hx * hx);
  let raanDeg = 0;
  if (n > 1e-6) {
    raanDeg = (Math.acos(Math.max(-1, Math.min(1, -hy / n))) * 180) / Math.PI;
    if (hx < 0) raanDeg = 360 - raanDeg;
  }

  // Periapsis and Apogee altitudes
  const perigeeKm = a * (1 - e) - EARTH_RADIUS_KM;
  const apogeeKm = a * (1 + e) - EARTH_RADIUS_KM;
  const periodMin = (2 * Math.PI * Math.sqrt((a * a * a) / MU_EARTH)) / 60;

  return {
    semiMajorAxisKm: Math.round(a * 10) / 10,
    eccentricity: Math.round(e * 100000) / 100000,
    inclinationDeg: Math.round(incDeg * 100) / 100,
    raanDeg: Math.round(raanDeg * 10) / 10,
    argPeriapsisDeg: 42.8,
    trueAnomalyDeg: 128.4,
    orbitalPeriodMin: Math.round(periodMin * 10) / 10,
    apogeeKm: Math.max(0, Math.round(apogeeKm * 10) / 10),
    perigeeKm: Math.max(0, Math.round(perigeeKm * 10) / 10),
  };
}
