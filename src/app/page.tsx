'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Orbit, 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  Compass, 
  Crosshair, 
  Sliders, 
  ChevronRight,
  Gauge,
  Flame,
  Globe2,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { StateVector, KeplerianElements } from '@/lib/types';
import { rk4Step, stateVectorToKeplerian, EARTH_RADIUS_KM, MU_EARTH } from '@/lib/rk4Engine';
import { INITIAL_ORBIT_STATE } from '@/lib/mockData';

export default function OrbitalDynamicsPage() {
  const [state, setState] = useState<StateVector>(INITIAL_ORBIT_STATE);
  const [keplerian, setKeplerian] = useState<KeplerianElements>(stateVectorToKeplerian(INITIAL_ORBIT_STATE));
  const [simActive, setSimActive] = useState<boolean>(true);
  const [timeWarp, setTimeWarp] = useState<number>(10); // 10s per simulation step
  const [orbitHistory, setOrbitHistory] = useState<{ x: number; y: number; v: number }[]>([]);
  const [selectedTargetOrbit, setSelectedTargetOrbit] = useState<'ISS' | 'GEO' | 'LUNAR'>('GEO');
  const [burnNotice, setBurnNotice] = useState<string | null>(null);

  // Simulation tick loop with RK4 Integrator
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

  // Track orbit history trail for SVG viewport
  useEffect(() => {
    const cx = 250;
    const cy = 250;
    const scale = 0.024; // 1px = ~41.6 km
    const px = cx + state.x * scale;
    const py = cy + state.y * scale;
    const v = Math.sqrt(state.vx * state.vx + state.vy * state.vy + state.vz * state.vz);

    setOrbitHistory((prev) => {
      const next = [...prev, { x: px, y: py, v }];
      return next.slice(-75); // trail of last 75 points
    });
  }, [state]);

  // Delta-V Thruster Burn
  const applyDeltaV = (dvKmS: number, label: string) => {
    setState((prev) => {
      const next = { ...prev, vy: prev.vy + dvKmS };
      setKeplerian(stateVectorToKeplerian(next));
      return next;
    });
    setBurnNotice(`IMPULSE EXECUTED: ${label} (${(dvKmS * 1000).toFixed(0)} m/s)`);
    setTimeout(() => setBurnNotice(null), 3500);
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

  // Execute Hohmann Insertion
  const executeHohmann = () => {
    applyDeltaV(parseFloat(hohmann.deltaV1) / 1000, `HOHMANN BURN 1 -> ${hohmann.label}`);
  };

  const resetOrbit = () => {
    setState(INITIAL_ORBIT_STATE);
    setKeplerian(stateVectorToKeplerian(INITIAL_ORBIT_STATE));
    setOrbitHistory([]);
    setBurnNotice('ORBIT RESET TO NOMINAL 500 KM CIRCULAR LEO');
    setTimeout(() => setBurnNotice(null), 3000);
  };

  // Speed and altitude
  const currentSpeedKmS = Math.sqrt(state.vx * state.vx + state.vy * state.vy + state.vz * state.vz);
  const currentRadiusKm = Math.sqrt(state.x * state.x + state.y * state.y + state.z * state.z);
  const currentAltitudeKm = currentRadiusKm - EARTH_RADIUS_KM;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Cockpit Annunciator & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl hud-panel">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,245,212,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              ASTRODYNAMICS SUITE // RK4 SOLVER
            </span>
            <span className="text-xs text-amber-400 font-mono">
              EARTH J2 OBLATENESS ACTIVE • SGP4 EPHEMERIS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight glow-cyan">
            ORBITAL MECHANICS & NUMERICAL INTEGRATION HUD
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            Continuous 4th-Order Runge-Kutta equations solver with geopotential harmonics, Keplerian state transitions, and real-time Hohmann orbital maneuvers.
          </p>
        </div>

        {/* Solver Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-black/60 border border-cyan-500/30 text-xs font-mono">
            {[1, 5, 10, 30].map((rate) => (
              <button
                key={rate}
                onClick={() => setTimeWarp(rate)}
                className={`px-2 py-1 rounded transition-colors ${
                  timeWarp === rate
                    ? 'bg-cyan-400 text-black font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <button
            onClick={() => setSimActive(!simActive)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-bold border transition-all ${
              simActive
                ? 'bg-amber-950/70 text-amber-300 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/80 shadow-[0_0_12px_rgba(0,245,212,0.3)]'
            }`}
          >
            {simActive ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-cyan-400" />}
            <span>{simActive ? 'HOLD SIM' : 'RESUME RK4'}</span>
          </button>

          <button
            onClick={resetOrbit}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-cyan-300 transition-colors"
            title="Reset to Baseline LEO"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Burn Notice Banner */}
      {burnNotice && (
        <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/80 text-amber-300 text-xs font-mono flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.25)] animate-pulse">
          <Flame className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="font-bold">{burnNotice}</span>
        </div>
      )}

      {/* Primary Flight Display & High-Fidelity Orbit Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Orbital Canvas Viewport */}
        <div className="lg:col-span-8 p-6 rounded-2xl hud-panel flex flex-col justify-between relative overflow-hidden space-y-4">
          <div className="w-full flex items-center justify-between border-b border-cyan-500/20 pb-3 relative z-10">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300">
              <Crosshair className="w-4 h-4 text-cyan-400" />
              <span>EQUATORIAL INERTIAL TRAJECTORY (ECI J2000)</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                VEHICLE
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                TRAIL (Kepler 2nd Law)
              </span>
            </div>
          </div>

          {/* SVG Viewport */}
          <div className="w-full max-w-[500px] aspect-square mx-auto relative flex items-center justify-center">
            <svg viewBox="0 0 500 500" className="w-full h-full select-none">
              <defs>
                {/* Earth Atmosphere Radial Gradient */}
                <radialGradient id="earthGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="65%" stopColor="#082f49" stopOpacity="1" />
                  <stop offset="85%" stopColor="#0284c7" stopOpacity="0.8" />
                  <stop offset="98%" stopColor="#00f5d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#00f5d4" stopOpacity="0" />
                </radialGradient>
                {/* Night Hemisphere Shadow */}
                <linearGradient id="nightTerminator" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="50%" stopColor="transparent" stopOpacity="0" />
                  <stop offset="100%" stopColor="#01040a" stopOpacity="0.85" />
                </linearGradient>
              </defs>

              {/* Starfield */}
              <g opacity="0.6">
                {[
                  [30, 40], [80, 120], [140, 60], [420, 80], [460, 190],
                  [40, 380], [100, 440], [390, 410], [440, 340], [470, 460],
                  [20, 220], [480, 260], [250, 40], [250, 460]
                ].map(([sx, sy], idx) => (
                  <circle key={idx} cx={sx} cy={sy} r="1" fill="#ffffff" className="animate-twinkle" />
                ))}
              </g>

              {/* Celestial Coordinate Radial Distance Rings */}
              <circle cx="250" cy="250" r="180" fill="none" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,3" />
              <text x="250" y="65" fill="#475569" fontSize="9" textAnchor="middle" fontFamily="monospace">
                GEO TRANSFER LIMIT
              </text>

              {/* Earth Body with Atmosphere Glow */}
              <circle cx="250" cy="250" r="130" fill="url(#earthGlow)" />
              <circle cx="250" cy="250" r="120" fill="#0c4a6e" />
              <circle cx="250" cy="250" r="120" fill="url(#nightTerminator)" />

              {/* Continents Outline Silhouette */}
              <path
                d="M 230 200 Q 250 180 270 210 Q 290 230 260 260 Q 240 250 230 200 Z"
                fill="#0369a1"
                opacity="0.5"
              />
              <path
                d="M 170 220 Q 200 210 210 240 Q 190 270 160 250 Z"
                fill="#0369a1"
                opacity="0.5"
              />

              {/* Earth Center Marker & Label */}
              <circle cx="250" cy="250" r="2.5" fill="#00f5d4" />
              <text x="250" y="255" fill="#00f5d4" fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                EARTH (Re: 6,378 km)
              </text>

              {/* Orbit History Trajectory Trail */}
              {orbitHistory.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="4,2"
                  points={orbitHistory.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              )}

              {/* Apsis Markers */}
              {(() => {
                const apX = 250 + (EARTH_RADIUS_KM + keplerian.apogeeKm) * 0.024;
                const peX = 250 - (EARTH_RADIUS_KM + keplerian.perigeeKm) * 0.024;
                return (
                  <g fontFamily="monospace" fontSize="9" fontWeight="bold">
                    {/* Apoapsis */}
                    <circle cx={apX} cy="250" r="3" fill="#f59e0b" />
                    <text x={apX + 5} y="245" fill="#f59e0b">
                      Ap: {keplerian.apogeeKm} km
                    </text>
                    {/* Periapsis */}
                    <circle cx={peX} cy="250" r="3" fill="#00f5d4" />
                    <text x={peX - 60} y="245" fill="#00f5d4">
                      Pe: {keplerian.perigeeKm} km
                    </text>
                  </g>
                );
              })()}

              {/* Spacecraft Active Position */}
              {(() => {
                const satX = 250 + state.x * 0.024;
                const satY = 250 + state.y * 0.024;
                return (
                  <g>
                    {/* Radar Pulse Wave */}
                    <circle cx={satX} cy={satY} r="14" fill="none" stroke="#00f5d4" strokeWidth="1.2" className="animate-ping" />
                    {/* Spacecraft Core */}
                    <circle cx={satX} cy={satY} r="5" fill="#00f5d4" stroke="#ffffff" strokeWidth="1.5" />
                    {/* Solar Wings */}
                    <line x1={satX - 10} y1={satY} x2={satX + 10} y2={satY} stroke="#f59e0b" strokeWidth="2.5" />
                    {/* Callsign Label Tag */}
                    <rect x={satX + 10} y={satY - 18} width="85" height="16" rx="3" fill="#060812" stroke="#00f5d4" strokeWidth="0.8" />
                    <text x={satX + 14} y={satY - 6} fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="bold">
                      ASTRAEA (LEO)
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Quick Thruster Impulses Bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 border-t border-cyan-500/20 pt-4 font-mono text-xs">
            <span className="text-gray-400 font-bold flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              DIRECT ORBITAL THRUSTER IMPULSE (ΔV):
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => applyDeltaV(0.02, '+20 m/s PROGRADE')}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400 text-cyan-300 font-bold transition-all shadow-[0_0_10px_rgba(0,245,212,0.2)]"
              >
                +20 m/s PROGRADE
              </button>
              <button
                onClick={() => applyDeltaV(-0.02, '-20 m/s RETROGRADE')}
                className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-400 text-amber-300 font-bold transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)]"
              >
                -20 m/s RETROGRADE
              </button>
              <button
                onClick={() => applyDeltaV(0.1, '+100 m/s BOOST')}
                className="px-3 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-400 text-purple-300 font-bold transition-all"
              >
                +100 m/s BOOST
              </button>
            </div>
          </div>
        </div>

        {/* Right: Primary Flight Telemetry & Hohmann Computer */}
        <div className="lg:col-span-4 space-y-6">
          {/* Primary Rolling Telemetry Card */}
          <div className="p-5 rounded-2xl hud-panel space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <span className="text-xs font-bold text-cyan-300">FLIGHT GAUGES</span>
              <span className="text-[10px] text-gray-500">ECI J2000 FRAME</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-black/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400 block">ALTITUDE (h)</span>
                <span className="text-xl font-black text-cyan-300 tracking-tight">
                  {currentAltitudeKm.toFixed(1)}
                </span>
                <span className="text-[9px] text-gray-500 block">km above MSL</span>
              </div>

              <div className="p-3 rounded-xl bg-black/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400 block">VELOCITY (v)</span>
                <span className="text-xl font-black text-amber-400 tracking-tight">
                  {currentSpeedKmS.toFixed(3)}
                </span>
                <span className="text-[9px] text-gray-500 block">km/s (orbital)</span>
              </div>
            </div>

            {/* Keplerian Elements Grid */}
            <div className="space-y-1.5 text-xs pt-2 border-t border-white/10">
              <div className="flex justify-between p-2 rounded bg-black/40">
                <span className="text-gray-400">APOGEE (Ap):</span>
                <span className="font-bold text-white">{keplerian.apogeeKm} km</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/40">
                <span className="text-gray-400">PERIGEE (Pe):</span>
                <span className="font-bold text-white">{keplerian.perigeeKm} km</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/40">
                <span className="text-gray-400">ECCENTRICITY (e):</span>
                <span className="font-bold text-cyan-300">{keplerian.eccentricity}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/40">
                <span className="text-gray-400">INCLINATION (i):</span>
                <span className="font-bold text-white">{keplerian.inclinationDeg}°</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/40">
                <span className="text-gray-400">PERIOD (T):</span>
                <span className="font-bold text-amber-300">{keplerian.orbitalPeriodMin} min</span>
              </div>
            </div>
          </div>

          {/* Hohmann Orbital Maneuver Calculator */}
          <div className="p-5 rounded-2xl hud-panel-amber space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                HOHMANN TRANSFER PLANNER
              </span>
              <span className="text-[10px] text-amber-400/70">ORBITAL INSERTION</span>
            </div>

            {/* Target Orbit Selector */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ISS', label: 'ISS (420km)' },
                { id: 'GEO', label: 'GEO (35k km)' },
                { id: 'LUNAR', label: 'LUNAR TLI' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTargetOrbit(t.id as any)}
                  className={`py-1.5 px-2 rounded text-[10px] font-bold border transition-colors ${
                    selectedTargetOrbit === t.id
                      ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                      : 'bg-black/50 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2 text-[11px] p-3 rounded-xl bg-black/50 border border-white/5">
              <div className="flex justify-between">
                <span className="text-gray-400">Target Altitude:</span>
                <span className="font-bold text-white">{hohmann.targetRadiusKm - EARTH_RADIUS_KM} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Burn 1 (Periapsis):</span>
                <span className="font-bold text-amber-400">+{hohmann.deltaV1} m/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Burn 2 (Apoapsis):</span>
                <span className="font-bold text-amber-400">+{hohmann.deltaV2} m/s</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1.5">
                <span className="text-gray-300 font-bold">TOTAL REQUIRED ΔV:</span>
                <span className="font-black text-cyan-300">{hohmann.totalDeltaV} m/s</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[10px]">
                <span>Transfer Coast Duration:</span>
                <span className="text-white">{hohmann.transferHours} hours</span>
              </div>
            </div>

            <button
              onClick={executeHohmann}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs transition-all shadow-[0_0_15px_rgba(245,158,11,0.35)] flex items-center justify-center gap-1.5"
            >
              <Flame className="w-4 h-4" />
              <span>COMMIT HOHMANN INSERTION BURN</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
