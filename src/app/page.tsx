'use client';

import React, { useState, useEffect } from 'react';
import { 
  Orbit, 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  Compass, 
  Gauge, 
  Layers, 
  ArrowUpRight,
  Flame,
  Globe2,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { StateVector, KeplerianElements } from '@/lib/types';
import { rk4Step, stateVectorToKeplerian, EARTH_RADIUS_KM, MU_EARTH } from '@/lib/rk4Engine';
import { INITIAL_ORBIT_STATE } from '@/lib/mockData';
import ThreeOrbitView from '@/components/ThreeOrbitView';
import PrimaryFlightDisplay from '@/components/PrimaryFlightDisplay';

export default function OrbitalDynamicsPage() {
  const [state, setState] = useState<StateVector>(INITIAL_ORBIT_STATE);
  const [keplerian, setKeplerian] = useState<KeplerianElements>(stateVectorToKeplerian(INITIAL_ORBIT_STATE));
  const [simActive, setSimActive] = useState<boolean>(true);
  const [timeWarp, setTimeWarp] = useState<number>(10);
  const [selectedTargetOrbit, setSelectedTargetOrbit] = useState<'ISS' | 'GEO' | 'LUNAR'>('GEO');
  const [burnNotice, setBurnNotice] = useState<string | null>(null);

  // RK4 numerical integration simulation loop
  useEffect(() => {
    if (!simActive) return;
    const interval = setInterval(() => {
      setState((prev) => {
        const next = rk4Step(prev, timeWarp);
        setKeplerian(stateVectorToKeplerian(next));
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [simActive, timeWarp]);

  // Delta-V Thruster Burn
  const applyDeltaV = (dvKmS: number, label: string) => {
    setState((prev) => {
      const next = { ...prev, vy: prev.vy + dvKmS };
      setKeplerian(stateVectorToKeplerian(next));
      return next;
    });
    setBurnNotice(`IMPULSE EXECUTED: ${label} (${(dvKmS * 1000).toFixed(0)} m/s)`);
    setTimeout(() => setBurnNotice(null), 3000);
  };

  // Hohmann Transfer Calculation
  const calculateHohmann = () => {
    const r1 = EARTH_RADIUS_KM + keplerian.perigeeKm;
    let r2 = EARTH_RADIUS_KM + 42164; // GEO
    let label = 'Geostationary (GEO)';

    if (selectedTargetOrbit === 'ISS') {
      r2 = EARTH_RADIUS_KM + 420;
      label = 'ISS Orbit (420 km)';
    } else if (selectedTargetOrbit === 'LUNAR') {
      r2 = 384400; // Moon distance
      label = 'Trans-Lunar Injection (TLI)';
    }

    const v1 = Math.sqrt(MU_EARTH / r1);
    const vTransfer1 = Math.sqrt(MU_EARTH * (2 / r1 - 2 / (r1 + r2)));
    const deltaV1 = Math.abs(vTransfer1 - v1);

    const v2 = Math.sqrt(MU_EARTH / r2);
    const vTransfer2 = Math.sqrt(MU_EARTH * (2 / r2 - 2 / (r1 + r2)));
    const deltaV2 = Math.abs(v2 - vTransfer2);

    const totalDeltaV = deltaV1 + deltaV2;
    const aTransfer = (r1 + r2) / 2;
    const transferHours = (Math.PI * Math.sqrt((aTransfer * aTransfer * aTransfer) / MU_EARTH)) / 3600;

    return {
      label,
      targetRadiusKm: Math.round(r2),
      deltaV1: (deltaV1 * 1000).toFixed(1),
      deltaV2: (deltaV2 * 1000).toFixed(1),
      totalDeltaV: (totalDeltaV * 1000).toFixed(1),
      transferHours: transferHours.toFixed(2),
    };
  };

  const hohmann = calculateHohmann();

  const resetOrbit = () => {
    setState(INITIAL_ORBIT_STATE);
    setKeplerian(stateVectorToKeplerian(INITIAL_ORBIT_STATE));
    setBurnNotice('ORBIT RESET TO NOMINAL 500 KM LEO');
    setTimeout(() => setBurnNotice(null), 2500);
  };

  // Speed and altitude
  const currentSpeedKmS = Math.sqrt(state.vx * state.vx + state.vy * state.vy + state.vz * state.vz);
  const currentRadiusKm = Math.sqrt(state.x * state.x + state.y * state.y + state.z * state.z);
  const currentAltitudeKm = currentRadiusKm - EARTH_RADIUS_KM;

  // Sub-satellite latitude / longitude computation
  const subLatDeg = ((Math.asin(state.z / currentRadiusKm) * 180) / Math.PI).toFixed(2);
  const subLonDeg = ((Math.atan2(state.y, state.x) * 180) / Math.PI).toFixed(2);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 font-mono select-none">
      {/* Top Workstation Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-2 py-0.2 rounded bg-[#162338] border border-[#2b4266] text-cyan-300 font-bold">
              ASTRODYNAMICS SUITE // RK4 SOLVER
            </span>
            <span className="text-[11px] text-gray-400">
              J2 GEOPOTENTIAL ACTIVE • SGP4 INERTIAL COUPLING
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            ORBITAL MECHANICS & NUMERICAL INTEGRATION CONSOLE
          </h1>
        </div>

        {/* Time-warp and Run controls */}
        <div className="flex items-center gap-2">
          {burnNotice && (
            <span className="text-xs text-amber-400 font-bold px-2 py-1 bg-amber-950/60 border border-amber-500/40 rounded">
              {burnNotice}
            </span>
          )}

          <div className="flex items-center gap-1 p-1 bg-[#06080e] border border-[#1a2333] rounded text-xs">
            {[1, 5, 10, 30].map((rate) => (
              <button
                key={rate}
                onClick={() => setTimeWarp(rate)}
                className={`px-2 py-1 rounded transition-colors ${
                  timeWarp === rate ? 'bg-cyan-500 text-black font-extrabold' : 'text-gray-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <button
            onClick={() => setSimActive(!simActive)}
            className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              simActive
                ? 'bg-[#181308] border-[#422c0d] text-amber-400 hover:bg-[#261e0d]'
                : 'bg-[#0e1a14] border-[#1b432e] text-emerald-400 hover:bg-[#16291f]'
            }`}
          >
            {simActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{simActive ? 'HOLD' : 'RUN'}</span>
          </button>

          <button
            onClick={resetOrbit}
            className="p-1.5 rounded bg-[#06080e] hover:bg-white/5 border border-[#1a2333] text-gray-400 hover:text-white"
            title="Reset Orbit"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split-Screen Cockpit View: 3D WebGL Earth (Left 8 Cols) + Primary Flight Display (Right 4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Three.js 3D WebGL Orbit Canvas (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="h-[460px] w-full">
            <ThreeOrbitView state={state} keplerian={keplerian} />
          </div>

          {/* Interactive Thruster Impulse Burn Bar */}
          <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-gray-400 font-bold flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              DIRECT ORBITAL THRUSTER IMPULSE (ΔV):
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => applyDeltaV(0.02, '+20 m/s PROGRADE')}
                className="px-2.5 py-1 rounded bg-[#0f1d2e] hover:bg-[#162c47] border border-[#1e3a5f] text-cyan-300 font-bold transition-colors"
              >
                +20 m/s PROGRADE
              </button>
              <button
                onClick={() => applyDeltaV(-0.02, '-20 m/s RETROGRADE')}
                className="px-2.5 py-1 rounded bg-[#21160a] hover:bg-[#33220f] border border-[#4a3217] text-amber-300 font-bold transition-colors"
              >
                -20 m/s RETROGRADE
              </button>
              <button
                onClick={() => applyDeltaV(0.1, '+100 m/s APOGEE BOOST')}
                className="px-2.5 py-1 rounded bg-[#1e1329] hover:bg-[#2e1c3f] border border-[#44295e] text-purple-300 font-bold transition-colors"
              >
                +100 m/s BOOST
              </button>
            </div>
          </div>
        </div>

        {/* Primary Flight Display & Attitude Telemetry (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="h-[280px] w-full">
            <PrimaryFlightDisplay
              pitchDeg={-4.2}
              rollDeg={1.8}
              yawDeg={184.2}
              altitudeKm={currentAltitudeKm}
              velocityKmS={currentSpeedKmS}
              gForce={1.0}
              mach={currentSpeedKmS * 2.94}
            />
          </div>

          {/* Sub-Satellite Coordinate Tracking */}
          <div className="p-3.5 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-2 text-xs">
            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <span className="text-gray-400">SUB-SATELLITE GROUND TRACK:</span>
              <span className="text-cyan-400 font-bold">ECI J2000</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-[#06080e] rounded border border-white/5">
                <span className="text-gray-500 block text-[10px]">LATITUDE:</span>
                <span className="text-white font-bold">{subLatDeg}° N</span>
              </div>
              <div className="p-2 bg-[#06080e] rounded border border-white/5">
                <span className="text-gray-500 block text-[10px]">LONGITUDE:</span>
                <span className="text-white font-bold">{subLonDeg}° E</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Dual Operational Console: Keplerian State Matrix (Left) + Hohmann Transfer Planner (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Keplerian Orbital Elements State Matrix */}
        <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-cyan-400 font-bold flex items-center gap-1.5">
              <Orbit className="w-4 h-4 text-cyan-400" />
              KEPLERIAN ORBITAL STATE VECTOR
            </span>
            <span className="text-[10px] text-gray-500">6 CLASSICAL ELEMENTS</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded">
              <span className="text-gray-500 block text-[10px]">SEMI-MAJOR AXIS (a)</span>
              <span className="text-white font-bold">{keplerian.semiMajorAxisKm.toFixed(1)} km</span>
            </div>
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded">
              <span className="text-gray-500 block text-[10px]">ECCENTRICITY (e)</span>
              <span className="text-cyan-300 font-bold">{keplerian.eccentricity.toFixed(5)}</span>
            </div>
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded">
              <span className="text-gray-500 block text-[10px]">INCLINATION (i)</span>
              <span className="text-white font-bold">{keplerian.inclinationDeg.toFixed(2)}°</span>
            </div>
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded">
              <span className="text-gray-500 block text-[10px]">APOGEE (Ap)</span>
              <span className="text-amber-400 font-bold">{keplerian.apogeeKm.toFixed(1)} km</span>
            </div>
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded">
              <span className="text-gray-500 block text-[10px]">PERIGEE (Pe)</span>
              <span className="text-emerald-400 font-bold">{keplerian.perigeeKm.toFixed(1)} km</span>
            </div>
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded">
              <span className="text-gray-500 block text-[10px]">ORBITAL PERIOD (T)</span>
              <span className="text-purple-300 font-bold">{keplerian.orbitalPeriodMin.toFixed(1)} min</span>
            </div>
          </div>
        </div>

        {/* Hohmann Orbital Transfer Computer */}
        <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              HOHMANN TRANSFER ORBIT INSERTION COMPUTER
            </span>
            <span className="text-[10px] text-gray-500">CLOSED-FORM VIS-VIVA</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['ISS', 'GEO', 'LUNAR'] as const).map((orb) => (
              <button
                key={orb}
                onClick={() => setSelectedTargetOrbit(orb)}
                className={`py-1.5 px-2 rounded text-[10px] font-bold border transition-colors ${
                  selectedTargetOrbit === orb
                    ? 'bg-[#2b1f0c] text-amber-300 border-[#66491d]'
                    : 'bg-[#06080e] text-gray-400 border-white/5 hover:text-white'
                }`}
              >
                {orb === 'ISS' ? 'ISS (420 km)' : orb === 'GEO' ? 'GEO (35,786 km)' : 'LUNAR TLI'}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 p-2.5 bg-[#06080e] border border-white/5 rounded text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Transfer Target:</span>
              <span className="text-white font-bold">{hohmann.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Burn 1 (Periapsis ΔV₁):</span>
              <span className="text-amber-400 font-bold">+{hohmann.deltaV1} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Burn 2 (Apoapsis ΔV₂):</span>
              <span className="text-amber-400 font-bold">+{hohmann.deltaV2} m/s</span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-1">
              <span className="text-gray-400 font-bold">TOTAL REQUIRED ΔV:</span>
              <span className="text-cyan-300 font-bold">{hohmann.totalDeltaV} m/s ({hohmann.transferHours} hrs)</span>
            </div>
          </div>

          <button
            onClick={() => applyDeltaV(parseFloat(hohmann.deltaV1) / 1000, `HOHMANN BURN 1 -> ${hohmann.label}`)}
            className="w-full py-2 rounded bg-[#1c293d] hover:bg-[#253957] border border-[#2d4973] text-cyan-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>EXECUTE HOHMANN INSERTION BURN 1 (+{hohmann.deltaV1} m/s)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
