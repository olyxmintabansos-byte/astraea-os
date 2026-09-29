'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Rocket, 
  Flame, 
  Gauge, 
  Layers, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  ShieldAlert, 
  Activity,
  Crosshair,
  Compass,
  Volume2,
  VolumeX
} from 'lucide-react';
import { LAUNCH_TIMELINE } from '@/lib/mockData';
import { StagingTimelineEvent, EngineTelemetry } from '@/lib/types';

// Audio feedback generator
const playChirp = (freq = 880, type: OscillatorType = 'sine', duration = 0.08) => {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // AudioContext blocked or not supported
  }
};

export default function AscentTelemetryPage() {
  // Flight simulation time state
  const [metSeconds, setMetSeconds] = useState<number>(75); // Start mid-ascent near Max-Q
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [warp, setWarp] = useState<number>(2); // 2x playback speed
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [abortTriggered, setAbortTriggered] = useState<boolean>(false);
  const [manualThrottle, setManualThrottle] = useState<number>(100);

  // Flight dynamics calculation derived from MET
  const calculateFlightDynamics = (t: number) => {
    // Time checkpoints
    // 0 -> 154s : Stage 1 burn
    // 154s -> 158s : Stage 1 separation
    // 165s -> 520s : Stage 2 burn
    // 210s : Fairing jettison
    // 520s : SECO-1
    // 580s : Circular orbit insertion

    let altKm = 0;
    let velKmh = 0;
    let dynPressKpa = 0;
    let gForce = 1.0;
    let pitchDeg = 90;
    let s1FuelPct = 100;
    let s1LoxPct = 100;
    let s2FuelPct = 100;
    let s2LoxPct = 100;
    let fairingAttached = true;
    let stage1Separated = false;
    let activeStage: 'STAGE_1' | 'INTERSTAGE' | 'STAGE_2' | 'ORBIT' = 'STAGE_1';

    if (t <= 154) {
      // Stage 1 flight
      const frac = t / 154;
      altKm = 0.5 * 0.0027 * Math.pow(t, 2); // Quadratic climb to ~64km
      velKmh = frac * 6840;
      // Max-Q peaks at T+68s
      dynPressKpa = 36 * Math.exp(-Math.pow((t - 68) / 32, 2));
      gForce = 1.2 + frac * 3.3; // Accels up to 4.5G as fuel burns off
      pitchDeg = Math.max(22, 90 - Math.pow(frac, 0.75) * 68);
      s1FuelPct = Math.max(4.0, (1 - frac) * 100);
      s1LoxPct = Math.max(3.8, (1 - frac) * 100);
      activeStage = 'STAGE_1';
    } else if (t <= 165) {
      // Interstage coast & pneumatic separation
      altKm = 64.2 + (t - 154) * 0.75;
      velKmh = 6840 + (t - 154) * 20;
      dynPressKpa = 0.2;
      gForce = 0.05; // Free-fall weightlessness during separation
      pitchDeg = 21;
      s1FuelPct = 4.0;
      s1LoxPct = 3.8;
      stage1Separated = true;
      activeStage = 'INTERSTAGE';
    } else if (t <= 520) {
      // Stage 2 vacuum burn
      const frac = (t - 165) / (520 - 165);
      altKm = 72 + frac * 348; // Climbs to 420 km
      velKmh = 7100 + frac * (27400 - 7100); // Accelerates to orbital speed 27,400 km/h (7.61 km/s)
      dynPressKpa = 0.0;
      gForce = 0.8 + frac * 2.8;
      pitchDeg = Math.max(3, 21 - frac * 18);
      s1FuelPct = 4.0;
      s1LoxPct = 3.8;
      stage1Separated = true;
      fairingAttached = t < 210;
      s2FuelPct = Math.max(2.5, (1 - frac) * 100);
      s2LoxPct = Math.max(2.0, (1 - frac) * 100);
      activeStage = 'STAGE_2';
    } else {
      // Orbital insertion coast
      const frac = Math.min(1, (t - 520) / 60);
      altKm = 420 + frac * 30; // 450 km circular
      velKmh = 27400 + frac * 150;
      dynPressKpa = 0.0;
      gForce = 0.0;
      pitchDeg = 0.0; // Level horizontal with Earth curvature
      s1FuelPct = 4.0;
      s1LoxPct = 3.8;
      stage1Separated = true;
      fairingAttached = false;
      s2FuelPct = 2.5;
      s2LoxPct = 2.0;
      activeStage = 'ORBIT';
    }

    const mach = velKmh / 1225;
    const downrangeKm = (velKmh / 3600) * (t * 0.45);

    return {
      altKm,
      velKmh,
      mach,
      dynPressKpa,
      gForce,
      pitchDeg,
      s1FuelPct,
      s1LoxPct,
      s2FuelPct,
      s2LoxPct,
      fairingAttached,
      stage1Separated,
      activeStage,
      downrangeKm,
    };
  };

  const current = calculateFlightDynamics(metSeconds);

  // Real-time ascent simulation interval
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setMetSeconds((prev) => {
        if (prev >= 600) {
          setIsPlaying(false);
          return 600;
        }
        const next = Math.min(600, prev + 1);
        // Play audio chirps at significant milestones
        if (soundEnabled && (next === 68 || next === 154 || next === 158 || next === 165 || next === 210 || next === 520)) {
          playChirp(1200, 'triangle', 0.15);
        }
        return next;
      });
    }, 1000 / warp);

    return () => clearInterval(interval);
  }, [isPlaying, warp, soundEnabled]);

  // 9-Engine Octaweb Cluster dynamic state
  const engines: EngineTelemetry[] = Array.from({ length: 9 }).map((_, i) => {
    const isCenter = i === 8;
    const isStage1Running = current.activeStage === 'STAGE_1';
    const isThrottled = metSeconds >= 55 && metSeconds <= 85; // Deep throttle at Max-Q
    const nominalPc = isThrottled ? 6.8 : 9.7;
    const jitter = Math.sin(metSeconds * 0.5 + i) * 0.12;

    return {
      id: i + 1,
      name: isCenter ? 'E9 (CENTER)' : `E${i + 1} (OUTER)`,
      chamberPressureMpa: isStage1Running ? Math.max(0, nominalPc + jitter) : 0,
      turbopumpRpm: isStage1Running ? (isThrottled ? 28400 : 36200) + Math.round(jitter * 800) : 0,
      mixtureRatio: isStage1Running ? 2.36 : 0,
      throttlePercent: isStage1Running ? (isThrottled ? 70 : manualThrottle) : 0,
      status: isStage1Running ? (isThrottled ? 'THROTTLED' : 'NOMINAL') : 'SHUTDOWN',
      gimbalPitchDeg: isStage1Running ? Number((Math.sin(metSeconds * 0.2 + i * 0.7) * 2.4).toFixed(1)) : 0,
      gimbalYawDeg: isStage1Running ? Number((Math.cos(metSeconds * 0.2 + i * 0.7) * 2.1).toFixed(1)) : 0,
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner / Mission Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl hud-panel">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-500/50 flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              PROPULSION & AERODYNAMICS // 2-STAGE VEHICLE
            </span>
            <span className="text-xs text-cyan-400 font-mono">
              OCTAWEB 9-CLUSTER • VACUUM STAGE 2 • CLOSED-LOOP GUIDANCE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight glow-amber">
            MULTI-STAGE ASCENT & PROPULSION TELEMETRY HUD
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            Live launch vehicle trajectory integration, pneumatic stage separation kinematics, LOX/RP-1 propellant mass fraction, and supersonic aerodynamic dynamic pressure solver.
          </p>
        </div>

        {/* Playback & Mission Time Scrubbing */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-mono transition-all ${
              soundEnabled
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                : 'bg-black/50 border-white/10 text-gray-500 hover:text-white'
            }`}
            title="Toggle Avionics Audio"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Time Warp selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-black/60 border border-amber-500/30 text-xs font-mono">
            {[1, 2, 5, 10].map((rate) => (
              <button
                key={rate}
                onClick={() => setWarp(rate)}
                className={`px-2 py-1 rounded transition-colors ${
                  warp === rate
                    ? 'bg-amber-400 text-black font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Play/Pause */}
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              if (soundEnabled) playChirp(600, 'square', 0.05);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'PAUSE MET' : 'RESUME MET'}</span>
          </button>

          {/* Reset */}
          <button
            onClick={() => {
              setMetSeconds(0);
              setIsPlaying(true);
              setAbortTriggered(false);
              if (soundEnabled) playChirp(400, 'sine', 0.1);
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white"
            title="Reset to T+00:00"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MET Live Countdown Scrubber & Quick Phase Indicator */}
      <div className="p-4 rounded-xl hud-panel space-y-3 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">MISSION ELAPSED TIME:</span>
            <span className="text-2xl font-black text-amber-400 font-mono tracking-widest glow-amber">
              T+{String(Math.floor(metSeconds / 60)).padStart(2, '0')}:{String(metSeconds % 60).padStart(2, '0')}
            </span>
            <span className="text-[11px] text-gray-500">({metSeconds} SECONDS)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">FLIGHT PHASE:</span>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
              current.activeStage === 'STAGE_1' ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse' :
              current.activeStage === 'INTERSTAGE' ? 'bg-purple-950/80 text-purple-300 border-purple-500/50 animate-bounce' :
              current.activeStage === 'STAGE_2' ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 animate-pulse' :
              'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
            }`}>
              {current.activeStage === 'STAGE_1' ? 'BOOSTER FIRST-STAGE BURN' :
               current.activeStage === 'INTERSTAGE' ? 'PNEUMATIC SEPARATION / COAST' :
               current.activeStage === 'STAGE_2' ? 'VACUUM SECOND-STAGE BURN (SES-1)' :
               'ORBITAL INSERTION ACHIEVED'}
            </span>
          </div>
        </div>

        {/* Timeline Slider scrubber */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>T+00s (LIFTOFF)</span>
            <span className={metSeconds >= 68 ? 'text-amber-300 font-bold' : ''}>T+68s (MAX-Q)</span>
            <span className={metSeconds >= 154 ? 'text-purple-300 font-bold' : ''}>T+154s (MECO)</span>
            <span className={metSeconds >= 210 ? 'text-cyan-300 font-bold' : ''}>T+210s (FAIRING)</span>
            <span className={metSeconds >= 520 ? 'text-emerald-300 font-bold' : ''}>T+520s (SECO-1)</span>
          </div>
          <input
            type="range"
            min="0"
            max="600"
            value={metSeconds}
            onChange={(e) => setMetSeconds(Number(e.target.value))}
            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>
      </div>

      {/* Flight Telemetry Digital Avionics Instruments (4-Pillar Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
        <div className="p-4 rounded-xl hud-panel border-l-4 border-l-cyan-400 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>GEODETIC ALTITUDE</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {current.altKm.toFixed(1)} <span className="text-xs text-cyan-400 font-normal">KM</span>
          </div>
          <div className="text-[10px] text-gray-400 flex justify-between">
            <span>Downrange:</span>
            <span className="text-cyan-300">{current.downrangeKm.toFixed(1)} km</span>
          </div>
        </div>

        <div className="p-4 rounded-xl hud-panel border-l-4 border-l-amber-400 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>INERTIAL VELOCITY</span>
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {Math.round(current.velKmh).toLocaleString()} <span className="text-xs text-amber-400 font-normal">KM/H</span>
          </div>
          <div className="text-[10px] text-gray-400 flex justify-between">
            <span>Mach Number:</span>
            <span className="text-amber-300">Mach {current.mach.toFixed(2)}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl hud-panel border-l-4 border-l-red-500 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>DYNAMIC PRESSURE (q)</span>
            <Activity className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {current.dynPressKpa.toFixed(1)} <span className="text-xs text-red-400 font-normal">KPA</span>
          </div>
          <div className="text-[10px] text-gray-400 flex justify-between">
            <span>Max-Q Threshold:</span>
            <span className={current.dynPressKpa > 30 ? 'text-red-400 font-bold animate-pulse' : 'text-gray-400'}>
              {current.dynPressKpa > 30 ? 'PEAK STRESS' : 'NOMINAL'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl hud-panel border-l-4 border-l-purple-400 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>ACCELERATION / PITCH</span>
            <Compass className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {current.gForce.toFixed(2)} <span className="text-xs text-purple-400 font-normal">G</span>
          </div>
          <div className="text-[10px] text-gray-400 flex justify-between">
            <span>Pitch Attitude:</span>
            <span className="text-purple-300">{current.pitchDeg.toFixed(1)}° ATT</span>
          </div>
        </div>
      </div>

      {/* Main Tactical Visualizer Row: Rocket Cutaway Schematic (Left) + Octaweb & Trajectory (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Rocket Airframe & Propellant Tank Depletion Schematic (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl hud-panel space-y-4 font-mono">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Rocket className="w-4 h-4 text-cyan-400" />
                VEHICLE STRUCTURAL CROSS-SECTION
              </h2>
              <span className="text-[10px] text-gray-400">CRYOGENIC LOX & RP-1 PROPELLANT LEVELS</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-black/60 border border-cyan-500/40 text-cyan-300">
              MASS: {((current.s1LoxPct + current.s1FuelPct + current.s2LoxPct + current.s2FuelPct) * 1.35 + 28).toFixed(1)} TONS
            </span>
          </div>

          {/* Graphical SVG Rocket Cutaway */}
          <div className="relative bg-black/60 rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center min-h-[460px] overflow-hidden">
            {/* Stars background subtle */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

            <svg viewBox="0 0 280 440" className="w-full max-w-[260px] h-[420px] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
              <defs>
                <linearGradient id="loxGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0284c7" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0369a1" />
                </linearGradient>
                <linearGradient id="rp1Grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#b45309" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>
                <linearGradient id="fairingGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="50%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <linearGradient id="engineFlameGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="25%" stopColor="#fde047" />
                  <stop offset="60%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>

              {/* PAYLOAD FAIRING (Top) */}
              {current.fairingAttached ? (
                <g className="transition-all duration-500">
                  <path d="M 120 40 Q 140 10 160 40 L 165 85 L 115 85 Z" fill="url(#fairingGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                  {/* Internal Payload Satellite Mock */}
                  <rect x="132" y="48" width="16" height="24" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" rx="2" />
                  <line x1="124" y1="60" x2="132" y2="60" stroke="#38bdf8" strokeWidth="1.5" />
                  <line x1="148" y1="60" x2="156" y2="60" stroke="#38bdf8" strokeWidth="1.5" />
                  <text x="140" y="80" textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="monospace">PAYLOAD</text>
                </g>
              ) : (
                <g className="transition-all duration-500">
                  {/* Fairing split halves drifting away */}
                  <path d="M 95 35 Q 105 15 115 40 L 115 80 L 90 75 Z" fill="url(#fairingGrad)" opacity="0.4" stroke="#64748b" strokeDasharray="2,2" />
                  <path d="M 185 35 Q 175 15 165 40 L 165 80 L 190 75 Z" fill="url(#fairingGrad)" opacity="0.4" stroke="#64748b" strokeDasharray="2,2" />
                  {/* Satellite Exposed in space */}
                  <rect x="130" y="42" width="20" height="30" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" rx="2" />
                  <rect x="110" y="52" width="18" height="10" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                  <rect x="152" y="52" width="18" height="10" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                  <text x="140" y="80" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="bold" fontFamily="monospace">ORBITAL BUS</text>
                </g>
              )}

              {/* STAGE 2 TANKS & ENGINE */}
              <rect x="120" y="90" width="40" height="38" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
              {/* S2 LOX fill level */}
              <rect x="122" y={90 + 38 * (1 - current.s2LoxPct / 100)} width="36" height={38 * (current.s2LoxPct / 100)} fill="url(#loxGrad)" opacity="0.8" rx="1" />
              <text x="140" y="112" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="bold" fontFamily="monospace">
                S2 LOX {current.s2LoxPct.toFixed(0)}%
              </text>

              <rect x="120" y="130" width="40" height="28" rx="2" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.2" />
              {/* S2 RP-1 fill level */}
              <rect x="122" y={130 + 28 * (1 - current.s2FuelPct / 100)} width="36" height={28 * (current.s2FuelPct / 100)} fill="url(#rp1Grad)" opacity="0.8" rx="1" />
              <text x="140" y="148" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="bold" fontFamily="monospace">
                S2 RP-1 {current.s2FuelPct.toFixed(0)}%
              </text>

              {/* S2 Vacuum Engine Bell */}
              <path d="M 134 160 L 146 160 L 152 172 L 128 172 Z" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
              {current.activeStage === 'STAGE_2' && (
                <path d="M 130 172 Q 140 205 150 172 Q 145 190 140 215 Q 135 190 130 172 Z" fill="url(#engineFlameGrad)" opacity="0.9" />
              )}

              {/* INTERSTAGE SEPARATION GAP */}
              <g>
                <line x1="110" y1="176" x2="170" y2="176" stroke={current.stage1Separated ? '#ef4444' : '#64748b'} strokeWidth="1.5" strokeDasharray={current.stage1Separated ? '4,4' : 'none'} />
                {current.stage1Separated && (
                  <text x="140" y="174" textAnchor="middle" fill="#ef4444" fontSize="6" fontWeight="bold" fontFamily="monospace">
                    STAGE SEPARATION DISCONNECTED
                  </text>
                )}
              </g>

              {/* STAGE 1 BOOSTER (Below Interstage) */}
              <g opacity={current.stage1Separated ? 0.35 : 1} className="transition-opacity duration-700">
                {/* Stage 1 LOX Tank */}
                <rect x="118" y="182" width="44" height="85" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
                <rect x="120" y={182 + 85 * (1 - current.s1LoxPct / 100)} width="40" height={85 * (current.s1LoxPct / 100)} fill="url(#loxGrad)" opacity="0.8" rx="2" />
                <text x="140" y="228" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold" fontFamily="monospace">
                  S1 LOX {current.s1LoxPct.toFixed(0)}%
                </text>

                {/* Stage 1 RP-1 Fuel Tank */}
                <rect x="118" y="270" width="44" height="65" rx="3" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.2" />
                <rect x="120" y={270 + 65 * (1 - current.s1FuelPct / 100)} width="40" height={65 * (current.s1FuelPct / 100)} fill="url(#rp1Grad)" opacity="0.8" rx="2" />
                <text x="140" y="306" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold" fontFamily="monospace">
                  S1 RP-1 {current.s1FuelPct.toFixed(0)}%
                </text>

                {/* Grid Fins */}
                <rect x="110" y="186" width="8" height="14" fill="#334155" stroke="#94a3b8" rx="1" />
                <rect x="162" y="186" width="8" height="14" fill="#334155" stroke="#94a3b8" rx="1" />

                {/* Stage 1 Octaweb Engine Mount & Plumes */}
                <path d="M 118 335 L 162 335 L 166 345 L 114 345 Z" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
                
                {/* 9 Engine Nozzle cluster representation */}
                <rect x="122" y="345" width="6" height="8" fill="#475569" />
                <rect x="131" y="345" width="6" height="8" fill="#475569" />
                <rect x="140" y="345" width="6" height="8" fill="#64748b" />
                <rect x="149" y="345" width="6" height="8" fill="#475569" />
                <rect x="158" y="345" width="6" height="8" fill="#475569" />

                {/* Stage 1 Fire Plume */}
                {current.activeStage === 'STAGE_1' && (
                  <g>
                    <path
                      d="M 116 353 Q 140 435 164 353 Q 150 405 140 438 Q 130 405 116 353 Z"
                      fill="url(#engineFlameGrad)"
                      opacity="0.95"
                    />
                    {/* Shock Diamonds */}
                    <polygon points="140,365 143,372 140,379 137,372" fill="#ffffff" opacity="0.9" />
                    <polygon points="140,385 143,392 140,399 137,392" fill="#ffffff" opacity="0.75" />
                    <polygon points="140,405 142,411 140,417 138,411" fill="#ffffff" opacity="0.6" />
                  </g>
                )}
              </g>
            </svg>
          </div>

          {/* Quick Manual Stage Override Controls */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <button
              onClick={() => {
                setMetSeconds(154);
                if (soundEnabled) playChirp(900, 'triangle', 0.1);
              }}
              className="px-3 py-2 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 font-bold"
            >
              TRIGGER MECO (T+154)
            </button>
            <button
              onClick={() => {
                setMetSeconds(210);
                if (soundEnabled) playChirp(900, 'triangle', 0.1);
              }}
              className="px-3 py-2 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-bold"
            >
              JETTISON FAIRING (T+210)
            </button>
          </div>
        </div>

        {/* Octaweb 9-Engine Chamber Pressure & Ascent Flight Trajectory (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Octaweb 9-Engine Cluster Card */}
          <div className="p-6 rounded-2xl hud-panel space-y-4 font-mono">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  OCTAWEB 9-PROPULSION CLUSTER TELEMETRY
                </h2>
                <span className="text-[10px] text-gray-400">CHAMBER PRESSURE (Pc) & GIMBAL DEFLECTION</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400">GLOBAL THROTTLE:</span>
                <span className="text-xs font-bold text-amber-300">{engines[0].throttlePercent}%</span>
              </div>
            </div>

            {/* Octaweb 3x3 Grid of Engines */}
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
              {engines.map((eng) => (
                <div
                  key={eng.id}
                  className={`p-3 rounded-xl border transition-all ${
                    eng.status === 'NOMINAL'
                      ? 'bg-black/40 border-amber-500/30'
                      : eng.status === 'THROTTLED'
                      ? 'bg-amber-950/30 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      : 'bg-black/30 border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="font-bold text-white">{eng.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      eng.status === 'NOMINAL' ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-500/30' :
                      eng.status === 'THROTTLED' ? 'text-amber-300 bg-amber-950/80 border border-amber-500/30' :
                      'text-gray-500 bg-black/60 border border-white/5'
                    }`}>
                      {eng.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Chamber Pc:</span>
                      <span className="text-cyan-300 font-bold">{eng.chamberPressureMpa.toFixed(2)} MPa</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Turbopump:</span>
                      <span className="text-white">{eng.turbopumpRpm.toLocaleString()} RPM</span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-1">
                      <span className="text-gray-500">Gimbal (P/Y):</span>
                      <span className="text-purple-300 font-mono">
                        {eng.gimbalPitchDeg > 0 ? `+${eng.gimbalPitchDeg}` : eng.gimbalPitchDeg}° / {eng.gimbalYawDeg > 0 ? `+${eng.gimbalYawDeg}` : eng.gimbalYawDeg}°
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Flight Trajectory Canvas / SVG Graph */}
          <div className="p-6 rounded-2xl hud-panel space-y-3 font-mono">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h2 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                ASCENT PROFILE // ALTITUDE VS DOWNRANGE (KM)
              </h2>
              <span className="text-[10px] text-gray-400">KÁRMÁN BOUNDARY: 100 KM • TARGET: 420 KM</span>
            </div>

            {/* Trajectory SVG */}
            <div className="bg-black/60 rounded-xl border border-white/10 p-3">
              <svg viewBox="0 0 500 200" className="w-full h-48">
                {/* Grid Lines */}
                <line x1="40" y1="170" x2="480" y2="170" stroke="#334155" strokeWidth="1" />
                <line x1="40" y1="20" x2="40" y2="170" stroke="#334155" strokeWidth="1" />

                {/* Kármán Line (100km) */}
                <line x1="40" y1="130" x2="480" y2="130" stroke="#0284c7" strokeWidth="1" strokeDasharray="3,3" />
                <text x="475" y="126" textAnchor="end" fill="#0284c7" fontSize="8" fontFamily="monospace">KÁRMÁN LINE (100 KM)</text>

                {/* Target LEO (420km) */}
                <line x1="40" y1="35" x2="480" y2="35" stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" />
                <text x="475" y="31" textAnchor="end" fill="#10b981" fontSize="8" fontFamily="monospace">LEO INSERTION (420 KM)</text>

                {/* Max-Q marker zone */}
                <rect x="75" y="145" width="40" height="25" fill="#ef444415" stroke="#ef444440" strokeWidth="1" rx="2" />
                <text x="95" y="160" textAnchor="middle" fill="#ef4444" fontSize="7" fontFamily="monospace">MAX-Q</text>

                {/* Theoretical Full Ascent Path Arc */}
                <path
                  d="M 40 170 Q 120 160, 220 110 T 460 35"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />

                {/* Actual Real-Time Ascent Path */}
                {(() => {
                  const maxDownrange = 800; // km
                  const maxAlt = 450; // km
                  const progress = Math.min(1, current.downrangeKm / maxDownrange);
                  const posX = 40 + progress * 420;
                  const posY = 170 - (current.altKm / maxAlt) * 135;

                  return (
                    <g>
                      {/* Active vehicle telemetry blip */}
                      <circle cx={posX} cy={posY} r="5" fill="#38bdf8" className="animate-pulse" />
                      <circle cx={posX} cy={posY} r="12" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.5" />
                      {/* Rocket vector leader line */}
                      <line x1={posX} y1={posY} x2={posX + 15} y2={posY - 10} stroke="#38bdf8" strokeWidth="1.5" />
                      <text x={posX + 18} y={posY - 12} fill="#38bdf8" fontSize="8" fontWeight="bold" fontFamily="monospace">
                        VEHICLE ({current.altKm.toFixed(0)} km)
                      </text>
                    </g>
                  );
                })()}

                {/* Axis Labels */}
                <text x="40" y="185" fill="#64748b" fontSize="8" fontFamily="monospace">0 km</text>
                <text x="260" y="185" fill="#64748b" fontSize="8" fontFamily="monospace">400 km DOWNRANGE</text>
                <text x="480" y="185" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">800 km</text>

                <text x="35" y="170" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">0 km</text>
                <text x="35" y="100" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">200</text>
                <text x="35" y="35" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">420</text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Flight Timeline Sequence Table */}
      <div className="p-6 rounded-2xl hud-panel space-y-4 font-mono">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            ASCENT STAGING SEQUENCER & FLIGHT EVENT MANIFEST
          </h2>
          <span className="text-[10px] text-gray-400">8 KEY STAGING TRANSITIONS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-500 text-[11px]">
                <th className="pb-3">MET (T+)</th>
                <th className="pb-3">EVENT MILESTONE</th>
                <th className="pb-3">STAGE / VEHICLE</th>
                <th className="pb-3">ALTITUDE</th>
                <th className="pb-3">VELOCITY</th>
                <th className="pb-3">THRUST</th>
                <th className="pb-3 text-right">TELEMETRY STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {LAUNCH_TIMELINE.map((ev) => {
                const isPassed = metSeconds >= ev.timeSeconds;
                const isCurrent = Math.abs(metSeconds - ev.timeSeconds) < 15;

                return (
                  <tr
                    key={ev.timeSeconds}
                    className={`transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-500/10'
                        : isPassed
                        ? 'hover:bg-white/5'
                        : 'opacity-50 hover:bg-white/5'
                    }`}
                    onClick={() => {
                      setMetSeconds(ev.timeSeconds);
                      if (soundEnabled) playChirp(750, 'triangle', 0.08);
                    }}
                  >
                    <td className="py-3 text-amber-400 font-bold">T+{ev.timeSeconds}s</td>
                    <td className="py-3 font-bold text-white flex items-center gap-2">
                      {isPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-gray-600" />
                      )}
                      {ev.event}
                    </td>
                    <td className="py-3 text-cyan-300">{ev.stage}</td>
                    <td className="py-3 text-gray-300">{ev.altitudeKm} km</td>
                    <td className="py-3 text-gray-300">{ev.velocityKmh.toLocaleString()} km/h</td>
                    <td className="py-3 text-amber-300">{ev.thrustKiloNewtons} kN</td>
                    <td className="py-3 text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${
                        isPassed
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                          : isCurrent
                          ? 'bg-amber-950 text-amber-300 border-amber-500/50 animate-pulse'
                          : 'bg-slate-900 text-slate-500 border-slate-700'
                      }`}>
                        {isPassed ? 'COMPLETED' : isCurrent ? 'EXECUTING' : 'PENDING'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
