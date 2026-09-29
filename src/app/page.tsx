'use client';

import React, { useState, useEffect } from 'react';
import { Orbit, Play, Pause, RotateCcw, Zap, Compass, Crosshair, ChevronRight } from 'lucide-react';
import { StateVector, KeplerianElements } from '@/lib/types';
import { rk4Step, stateVectorToKeplerian } from '@/lib/rk4Engine';
import { INITIAL_ORBIT_STATE } from '@/lib/mockData';

export default function OrbitalDynamicsPage() {
  const [state, setState] = useState<StateVector>(INITIAL_ORBIT_STATE);
  const [keplerian, setKeplerian] = useState<KeplerianElements>(stateVectorToKeplerian(INITIAL_ORBIT_STATE));
  const [simActive, setSimActive] = useState<boolean>(true);
  const [stepSize, setStepSize] = useState<number>(10); // 10s per tick
  const [orbitPath, setOrbitPath] = useState<{ x: number; y: number }[]>([]);

  // Simulation tick loop
  useEffect(() => {
    if (!simActive) return;
    const interval = setInterval(() => {
      setState((prev) => {
        const next = rk4Step(prev, stepSize);
        setKeplerian(stateVectorToKeplerian(next));
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [simActive, stepSize]);

  // Keep trail for trajectory visualization
  useEffect(() => {
    // Project x, y onto 2D canvas coordinates (center 200, 200)
    // Scale 1 px = 50 km
    const cx = 200;
    const cy = 200;
    const scale = 0.025;
    const px = cx + state.x * scale;
    const py = cy + state.y * scale;

    setOrbitPath((prev) => {
      const next = [...prev, { x: px, y: py }];
      return next.slice(-60); // keep last 60 points
    });
  }, [state]);

  const applyDeltaV = (dvKmS: number) => {
    setState((prev) => {
      const next = { ...prev, vy: prev.vy + dvKmS };
      setKeplerian(stateVectorToKeplerian(next));
      return next;
    });
  };

  const resetOrbit = () => {
    setState(INITIAL_ORBIT_STATE);
    setKeplerian(stateVectorToKeplerian(INITIAL_ORBIT_STATE));
    setOrbitPath([]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl hud-panel">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              NUMERICAL ASTRODYNAMICS
            </span>
            <span className="text-xs text-amber-400 font-mono">
              RK4 STEP: {stepSize}s • J2 OBLATENESS ACTIVE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            RUNGE-KUTTA 4TH-ORDER ORBITAL PROPAGATOR
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time numerical integration of 2-body equations with Earth oblateness J2 harmonic perturbations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSimActive(!simActive)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-mono font-bold border transition-colors ${
              simActive ? 'bg-amber-950 text-amber-300 border-amber-500' : 'bg-cyan-950 text-cyan-300 border-cyan-500'
            }`}
          >
            {simActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{simActive ? 'PAUSE SOLVER' : 'RESUME SOLVER'}</span>
          </button>

          <button
            onClick={resetOrbit}
            className="p-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
            title="Reset Orbit"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Orbit Visualization & Cartesian Vector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 2D Trajectory Viewport */}
        <div className="lg:col-span-7 p-6 rounded-xl hud-panel flex flex-col items-center justify-center space-y-4">
          <div className="w-full flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
              <Crosshair className="w-4 h-4" />
              EQUATORIAL INERTIAL PLANE (ECI)
            </span>
            <span className="text-[10px] font-mono text-gray-400">SCALE: 1px = 40 km</span>
          </div>

          <div className="w-full max-w-[400px] aspect-square relative flex items-center justify-center">
            <svg viewBox="0 0 400 400" className="w-full h-full select-none">
              {/* Earth Body */}
              <circle cx="200" cy="200" r="100" fill="#082f49" stroke="#00f5d4" strokeWidth="1.5" />
              <circle cx="200" cy="200" r="95" fill="#0369a1" opacity="0.4" />
              <text x="200" y="205" fill="#00f5d4" fontSize="11" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                EARTH (Re: 6378 km)
              </text>

              {/* Trajectory Points */}
              {orbitPath.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="3,3"
                  points={orbitPath.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              )}

              {/* Satellite Position */}
              {(() => {
                const satX = 200 + state.x * 0.025;
                const satY = 200 + state.y * 0.025;
                return (
                  <g>
                    <circle cx={satX} cy={satY} r="7" fill="#00f5d4" className="animate-ping" />
                    <circle cx={satX} cy={satY} r="4" fill="#ffffff" />
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Quick Delta-V Thruster Buttons */}
          <div className="w-full flex items-center justify-between gap-2 border-t border-cyan-500/20 pt-3 font-mono text-xs">
            <span className="text-gray-400">THRUST IMPULSE (ΔV):</span>
            <div className="flex gap-2">
              <button
                onClick={() => applyDeltaV(0.05)}
                className="px-2.5 py-1 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 hover:bg-cyan-900"
              >
                +50 m/s PROGRADE
              </button>
              <button
                onClick={() => applyDeltaV(-0.05)}
                className="px-2.5 py-1 rounded bg-amber-950 border border-amber-400 text-amber-300 hover:bg-amber-900"
              >
                -50 m/s RETROGRADE
              </button>
            </div>
          </div>
        </div>

        {/* Right: Keplerian Elements & Cartesian State */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl hud-panel space-y-3">
            <h2 className="text-xs font-mono font-bold text-amber-400 border-b border-white/10 pb-2">
              KEPLERIAN ORBITAL PARAMETERS
            </h2>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2 rounded bg-black/40 border border-white/5">
                <span className="text-gray-400">SEMI-MAJOR AXIS (a):</span>
                <span className="font-bold text-white">{keplerian.semiMajorAxisKm} km</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/40 border border-white/5">
                <span className="text-gray-400">ECCENTRICITY (e):</span>
                <span className="font-bold text-cyan-300">{keplerian.eccentricity}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/40 border border-white/5">
                <span className="text-gray-400">APOGEE ALTITUDE:</span>
                <span className="font-bold text-amber-400">{keplerian.apogeeKm} km</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/40 border border-white/5">
                <span className="text-gray-400">PERIGEE ALTITUDE:</span>
                <span className="font-bold text-amber-400">{keplerian.perigeeKm} km</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/40 border border-white/5">
                <span className="text-gray-400">INCLINATION (i):</span>
                <span className="font-bold text-white">{keplerian.inclinationDeg}°</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/40 border border-white/5">
                <span className="text-gray-400">ORBITAL PERIOD:</span>
                <span className="font-bold text-cyan-300">{keplerian.orbitalPeriodMin} min</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl hud-panel space-y-3 font-mono text-xs">
            <h3 className="font-bold text-cyan-400 border-b border-white/10 pb-2">
              CARTESIAN ECI STATE VECTORS
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-black/40">X: {state.x.toFixed(2)} km</div>
              <div className="p-2 rounded bg-black/40">Vx: {state.vx.toFixed(4)} km/s</div>
              <div className="p-2 rounded bg-black/40">Y: {state.y.toFixed(2)} km</div>
              <div className="p-2 rounded bg-black/40">Vy: {state.vy.toFixed(4)} km/s</div>
              <div className="p-2 rounded bg-black/40">Z: {state.z.toFixed(2)} km</div>
              <div className="p-2 rounded bg-black/40">Vz: {state.vz.toFixed(4)} km/s</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
