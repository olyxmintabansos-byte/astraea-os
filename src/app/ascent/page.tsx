'use client';

import React, { useState, useEffect } from 'react';
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
  Activity,
  Crosshair,
  Compass,
  Volume2,
  VolumeX
} from 'lucide-react';
import { LAUNCH_TIMELINE } from '@/lib/mockData';
import { EngineTelemetry } from '@/lib/types';

const playChirp = (freq = 880, type: OscillatorType = 'sine', duration = 0.08) => {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    // Ignored
  }
};

export default function AscentTelemetryPage() {
  const [metSeconds, setMetSeconds] = useState<number>(75);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [warp, setWarp] = useState<number>(2);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [manualThrottle, setManualThrottle] = useState<number>(100);

  const calculateFlightDynamics = (t: number) => {
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
      const frac = t / 154;
      altKm = 0.5 * 0.0027 * Math.pow(t, 2);
      velKmh = frac * 6840;
      dynPressKpa = 36 * Math.exp(-Math.pow((t - 68) / 32, 2));
      gForce = 1.2 + frac * 3.3;
      pitchDeg = Math.max(22, 90 - Math.pow(frac, 0.75) * 68);
      s1FuelPct = Math.max(4.0, (1 - frac) * 100);
      s1LoxPct = Math.max(3.8, (1 - frac) * 100);
      activeStage = 'STAGE_1';
    } else if (t <= 165) {
      altKm = 64.2 + (t - 154) * 0.75;
      velKmh = 6840 + (t - 154) * 20;
      dynPressKpa = 0.2;
      gForce = 0.05;
      pitchDeg = 21;
      s1FuelPct = 4.0;
      s1LoxPct = 3.8;
      stage1Separated = true;
      activeStage = 'INTERSTAGE';
    } else if (t <= 520) {
      const frac = (t - 165) / (520 - 165);
      altKm = 72 + frac * 348;
      velKmh = 7100 + frac * (27400 - 7100);
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
      const frac = Math.min(1, (t - 520) / 60);
      altKm = 420 + frac * 30;
      velKmh = 27400 + frac * 150;
      dynPressKpa = 0.0;
      gForce = 0.0;
      pitchDeg = 0.0;
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

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setMetSeconds((prev) => {
        if (prev >= 600) {
          setIsPlaying(false);
          return 600;
        }
        const next = Math.min(600, prev + 1);
        if (soundEnabled && (next === 68 || next === 154 || next === 158 || next === 165 || next === 210 || next === 520)) {
          playChirp(1200, 'triangle', 0.12);
        }
        return next;
      });
    }, 1000 / warp);

    return () => clearInterval(interval);
  }, [isPlaying, warp, soundEnabled]);

  const engines: EngineTelemetry[] = Array.from({ length: 9 }).map((_, i) => {
    const isCenter = i === 8;
    const isStage1Running = current.activeStage === 'STAGE_1';
    const isThrottled = metSeconds >= 55 && metSeconds <= 85;
    const nominalPc = isThrottled ? 6.8 : 9.7;
    const jitter = Math.sin(metSeconds * 0.5 + i) * 0.12;

    return {
      id: i + 1,
      name: isCenter ? 'E9 (CENTER)' : `E${i + 1} (OCTA)`,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 font-mono select-none">
      {/* Top Console Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-2 py-0.2 rounded bg-[#2b1f0c] border border-[#66491d] text-amber-300 font-bold">
              PROPULSION & TRAJECTORY // 2-STAGE LAUNCH VEHICLE
            </span>
            <span className="text-[11px] text-gray-400">
              OCTAWEB 9-CLUSTER • VACUUM STAGE 2 • CLOSED-LOOP
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            MULTI-STAGE ASCENT & PROPULSION TELEMETRY CONSOLE
          </h1>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 p-1 bg-[#06080e] border border-[#1a2333] rounded">
            {[1, 2, 5, 10].map((rate) => (
              <button
                key={rate}
                onClick={() => setWarp(rate)}
                className={`px-2 py-1 rounded transition-colors ${
                  warp === rate ? 'bg-amber-400 text-black font-extrabold' : 'text-gray-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded font-bold border transition-colors flex items-center gap-1.5 ${
              isPlaying
                ? 'bg-[#181308] border-[#422c0d] text-amber-400 hover:bg-[#261e0d]'
                : 'bg-[#0e1a14] border-[#1b432e] text-emerald-400 hover:bg-[#16291f]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'HOLD' : 'RUN'}</span>
          </button>

          <button
            onClick={() => {
              setMetSeconds(0);
              setIsPlaying(true);
            }}
            className="p-1.5 rounded bg-[#06080e] hover:bg-white/5 border border-[#1a2333] text-gray-400 hover:text-white"
            title="Reset to T+00:00"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MET Timeline Scrubber & Phase Status Bar */}
      <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-gray-500">MISSION ELAPSED:</span>
            <span className="text-lg font-bold text-amber-400 tracking-wider">
              T+{String(Math.floor(metSeconds / 60)).padStart(2, '0')}:{String(metSeconds % 60).padStart(2, '0')}
            </span>
            <span className="text-[10px] text-gray-500">({metSeconds}s)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">PHASE:</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
              current.activeStage === 'STAGE_1' ? 'bg-[#2b1f0c] text-amber-300 border-[#66491d]' :
              current.activeStage === 'INTERSTAGE' ? 'bg-[#1e1329] text-purple-300 border-[#44295e]' :
              current.activeStage === 'STAGE_2' ? 'bg-[#0f1d2e] text-cyan-300 border-[#1e3a5f]' :
              'bg-[#0e1a14] text-emerald-400 border-[#1b432e]'
            }`}>
              {current.activeStage === 'STAGE_1' ? 'STAGE 1 BOOST PHASE' :
               current.activeStage === 'INTERSTAGE' ? 'PNEUMATIC SEPARATION' :
               current.activeStage === 'STAGE_2' ? 'VACUUM STAGE 2 (SES-1)' :
               'ORBITAL INSERTION ACHIEVED'}
            </span>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="600"
          value={metSeconds}
          onChange={(e) => setMetSeconds(Number(e.target.value))}
          className="w-full h-1.5 bg-[#06080e] rounded appearance-none cursor-pointer accent-amber-400"
        />
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>T+00s (LIFTOFF)</span>
          <span className={metSeconds >= 68 ? 'text-amber-400 font-bold' : ''}>T+68s (MAX-Q)</span>
          <span className={metSeconds >= 154 ? 'text-purple-400 font-bold' : ''}>T+154s (MECO)</span>
          <span className={metSeconds >= 210 ? 'text-cyan-400 font-bold' : ''}>T+210s (FAIRING)</span>
          <span className={metSeconds >= 520 ? 'text-emerald-400 font-bold' : ''}>T+520s (SECO-1)</span>
        </div>
      </div>

      {/* 4 Telemetry Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-1">
          <span className="text-[10px] text-gray-500 block">ALTITUDE (MSL)</span>
          <div className="text-xl font-bold text-white">{current.altKm.toFixed(1)} <span className="text-xs text-cyan-400 font-normal">km</span></div>
          <span className="text-[10px] text-gray-400">Downrange: {current.downrangeKm.toFixed(1)} km</span>
        </div>

        <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-1">
          <span className="text-[10px] text-gray-500 block">VELOCITY (INERTIAL)</span>
          <div className="text-xl font-bold text-white">{Math.round(current.velKmh).toLocaleString()} <span className="text-xs text-amber-400 font-normal">km/h</span></div>
          <span className="text-[10px] text-gray-400">Mach {current.mach.toFixed(2)}</span>
        </div>

        <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-1">
          <span className="text-[10px] text-gray-500 block">DYNAMIC PRESSURE (q)</span>
          <div className="text-xl font-bold text-white">{current.dynPressKpa.toFixed(1)} <span className="text-xs text-red-400 font-normal">kPa</span></div>
          <span className="text-[10px] text-gray-400">Peak Stress: {current.dynPressKpa > 30 ? 'MAX-Q ACTIVE' : 'NOMINAL'}</span>
        </div>

        <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-1">
          <span className="text-[10px] text-gray-500 block">ACCELERATION / ATT</span>
          <div className="text-xl font-bold text-white">{current.gForce.toFixed(2)} <span className="text-xs text-purple-400 font-normal">G</span></div>
          <span className="text-[10px] text-gray-400">Pitch: {current.pitchDeg.toFixed(1)}° ATT</span>
        </div>
      </div>

      {/* Main Dual Row: Rocket Airframe Schematic (Left 5 Cols) + Octaweb & Trajectory (Right 7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Rocket Airframe Cutaway (5 Cols) */}
        <div className="lg:col-span-5 p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-white font-bold flex items-center gap-1.5">
              <Rocket className="w-4 h-4 text-cyan-400" />
              AIRFRAME & PROPELLANT DRAIN
            </span>
            <span className="text-[10px] text-gray-400">
              MASS: {((current.s1LoxPct + current.s1FuelPct + current.s2LoxPct + current.s2FuelPct) * 1.35 + 28).toFixed(1)} T
            </span>
          </div>

          {/* Clean SVG Cutaway */}
          <div className="bg-[#06080e] rounded border border-white/5 p-2 flex items-center justify-center min-h-[420px]">
            <svg viewBox="0 0 280 440" className="w-full max-w-[260px] h-[400px]">
              <defs>
                <linearGradient id="loxGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0369a1" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
                <linearGradient id="rp1Grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#92400e" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
              </defs>

              {/* PAYLOAD FAIRING */}
              {current.fairingAttached ? (
                <g>
                  <path d="M 120 40 Q 140 10 160 40 L 165 85 L 115 85 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <rect x="132" y="48" width="16" height="24" fill="#ca8a04" stroke="#eab308" strokeWidth="1" rx="2" />
                  <text x="140" y="80" textAnchor="middle" fill="#64748b" fontSize="6.5">PAYLOAD</text>
                </g>
              ) : (
                <g opacity="0.4">
                  <path d="M 95 35 Q 105 15 115 40 L 115 80 L 90 75 Z" fill="#1e293b" stroke="#475569" strokeDasharray="2,2" />
                  <path d="M 185 35 Q 175 15 165 40 L 165 80 L 190 75 Z" fill="#1e293b" stroke="#475569" strokeDasharray="2,2" />
                  <rect x="130" y="45" width="20" height="26" fill="#eab308" rx="2" />
                  <text x="140" y="80" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="bold">SATELLITE</text>
                </g>
              )}

              {/* STAGE 2 TANKS */}
              <rect x="120" y="90" width="40" height="38" rx="2" fill="#0b0f17" stroke="#1e293b" />
              <rect x="122" y={90 + 38 * (1 - current.s2LoxPct / 100)} width="36" height={38 * (current.s2LoxPct / 100)} fill="url(#loxGrad)" opacity="0.8" />
              <text x="140" y="112" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="bold">
                S2 LOX {current.s2LoxPct.toFixed(0)}%
              </text>

              <rect x="120" y="130" width="40" height="28" rx="2" fill="#0b0f17" stroke="#1e293b" />
              <rect x="122" y={130 + 28 * (1 - current.s2FuelPct / 100)} width="36" height={28 * (current.s2FuelPct / 100)} fill="url(#rp1Grad)" opacity="0.8" />
              <text x="140" y="148" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="bold">
                S2 RP-1 {current.s2FuelPct.toFixed(0)}%
              </text>

              {/* S2 Engine Nozzle */}
              <path d="M 134 160 L 146 160 L 152 172 L 128 172 Z" fill="#334155" />
              {current.activeStage === 'STAGE_2' && (
                <path d="M 130 172 Q 140 205 150 172 Q 145 190 140 215 Q 135 190 130 172 Z" fill="#f59e0b" opacity="0.85" />
              )}

              {/* INTERSTAGE GAP */}
              <line x1="110" y1="176" x2="170" y2="176" stroke={current.stage1Separated ? '#ef4444' : '#475569'} strokeWidth="1.5" strokeDasharray={current.stage1Separated ? '4,4' : 'none'} />

              {/* STAGE 1 BOOSTER */}
              <g opacity={current.stage1Separated ? 0.3 : 1}>
                {/* S1 LOX */}
                <rect x="118" y="182" width="44" height="85" rx="2" fill="#0b0f17" stroke="#1e293b" />
                <rect x="120" y={182 + 85 * (1 - current.s1LoxPct / 100)} width="40" height={85 * (current.s1LoxPct / 100)} fill="url(#loxGrad)" opacity="0.8" />
                <text x="140" y="228" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold">
                  S1 LOX {current.s1LoxPct.toFixed(0)}%
                </text>

                {/* S1 RP-1 */}
                <rect x="118" y="270" width="44" height="65" rx="2" fill="#0b0f17" stroke="#1e293b" />
                <rect x="120" y={270 + 65 * (1 - current.s1FuelPct / 100)} width="40" height={65 * (current.s1FuelPct / 100)} fill="url(#rp1Grad)" opacity="0.8" />
                <text x="140" y="306" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold">
                  S1 RP-1 {current.s1FuelPct.toFixed(0)}%
                </text>

                {/* Grid Fins */}
                <rect x="110" y="186" width="8" height="14" fill="#334155" rx="1" />
                <rect x="162" y="186" width="8" height="14" fill="#334155" rx="1" />

                {/* Engine Mount */}
                <path d="M 118 335 L 162 335 L 166 345 L 114 345 Z" fill="#1e293b" />
                <rect x="122" y="345" width="6" height="8" fill="#475569" />
                <rect x="131" y="345" width="6" height="8" fill="#475569" />
                <rect x="140" y="345" width="6" height="8" fill="#64748b" />
                <rect x="149" y="345" width="6" height="8" fill="#475569" />
                <rect x="158" y="345" width="6" height="8" fill="#475569" />

                {/* S1 Plume */}
                {current.activeStage === 'STAGE_1' && (
                  <path d="M 116 353 Q 140 435 164 353 Q 150 405 140 438 Q 130 405 116 353 Z" fill="#f59e0b" opacity="0.9" />
                )}
              </g>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <button
              onClick={() => setMetSeconds(154)}
              className="px-2 py-1.5 rounded bg-[#21160a] hover:bg-[#33220f] border border-[#4a3217] text-amber-300 font-bold transition-colors"
            >
              TRIGGER MECO (T+154)
            </button>
            <button
              onClick={() => setMetSeconds(210)}
              className="px-2 py-1.5 rounded bg-[#0f1d2e] hover:bg-[#162c47] border border-[#1e3a5f] text-cyan-300 font-bold transition-colors"
            >
              JETTISON FAIRING (T+210)
            </button>
          </div>
        </div>

        {/* Octaweb 9-Engine Telemetry & Trajectory Profile (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Octaweb 9-Engine Cluster Card */}
          <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                OCTAWEB 9-PROPULSION CLUSTER STATUS
              </span>
              <span className="text-gray-400">GLOBAL THROTTLE: <strong className="text-amber-300">{engines[0].throttlePercent}%</strong></span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {engines.map((eng) => (
                <div
                  key={eng.id}
                  className={`p-2.5 rounded border transition-colors ${
                    eng.status === 'NOMINAL' ? 'bg-[#06080e] border-white/5' :
                    eng.status === 'THROTTLED' ? 'bg-[#181308] border-[#422c0d]' :
                    'bg-[#06080e] border-transparent opacity-40'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="font-bold text-white">{eng.name}</span>
                    <span className={`text-[9px] px-1 rounded ${
                      eng.status === 'NOMINAL' ? 'text-emerald-400 bg-emerald-950/60' :
                      eng.status === 'THROTTLED' ? 'text-amber-400 bg-amber-950/60' :
                      'text-gray-500'
                    }`}>
                      {eng.status}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-[10px] text-gray-400">
                    <div className="flex justify-between">
                      <span>Pc:</span>
                      <span className="text-cyan-300 font-bold">{eng.chamberPressureMpa.toFixed(2)} MPa</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RPM:</span>
                      <span className="text-white">{eng.turbopumpRpm.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trajectory Profile SVG Graph */}
          <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-2 text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                ASCENT FLIGHT TRAJECTORY (ALTITUDE VS DOWNRANGE)
              </span>
              <span className="text-gray-500">LEO TARGET: 420 KM</span>
            </div>

            <div className="bg-[#06080e] rounded border border-white/5 p-2">
              <svg viewBox="0 0 500 180" className="w-full h-40">
                <line x1="40" y1="150" x2="480" y2="150" stroke="#1e293b" strokeWidth="1" />
                <line x1="40" y1="20" x2="40" y2="150" stroke="#1e293b" strokeWidth="1" />

                {/* Kármán Line 100km */}
                <line x1="40" y1="115" x2="480" y2="115" stroke="#0284c7" strokeWidth="1" strokeDasharray="3,3" />
                <text x="475" y="111" textAnchor="end" fill="#0284c7" fontSize="8">KÁRMÁN (100 KM)</text>

                {/* LEO Insertion 420km */}
                <line x1="40" y1="35" x2="480" y2="35" stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" />
                <text x="475" y="31" textAnchor="end" fill="#10b981" fontSize="8">LEO INSERTION (420 KM)</text>

                {/* Theoretical path */}
                <path d="M 40 150 Q 120 140, 220 95 T 460 35" fill="none" stroke="#334155" strokeWidth="1.5" strokeDasharray="4,4" />

                {/* Vehicle position dot */}
                {(() => {
                  const progress = Math.min(1, current.downrangeKm / 800);
                  const posX = 40 + progress * 420;
                  const posY = 150 - (current.altKm / 450) * 115;
                  return (
                    <g>
                      <circle cx={posX} cy={posY} r="4" fill="#38bdf8" />
                      <line x1={posX} y1={posY} x2={posX + 12} y2={posY - 10} stroke="#38bdf8" strokeWidth="1" />
                      <text x={posX + 15} y={posY - 10} fill="#38bdf8" fontSize="8" fontWeight="bold">
                        {current.altKm.toFixed(0)} km
                      </text>
                    </g>
                  );
                })()}

                <text x="40" y="165" fill="#475569" fontSize="8">0 km</text>
                <text x="260" y="165" fill="#475569" fontSize="8">400 km DOWNRANGE</text>
                <text x="480" y="165" fill="#475569" fontSize="8" textAnchor="end">800 km</text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Flight Timeline Manifest */}
      <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
        <div className="flex justify-between items-center border-b border-white/10 pb-2">
          <span className="text-white font-bold flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            ASCENT STAGING SEQUENCER MANIFEST
          </span>
          <span className="text-gray-500">8 KEY MILESTONES</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-[10px]">
                <th className="pb-2">MET</th>
                <th className="pb-2">EVENT MILESTONE</th>
                <th className="pb-2">STAGE</th>
                <th className="pb-2">ALTITUDE</th>
                <th className="pb-2">VELOCITY</th>
                <th className="pb-2">THRUST</th>
                <th className="pb-2 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[11px]">
              {LAUNCH_TIMELINE.map((ev) => {
                const isPassed = metSeconds >= ev.timeSeconds;
                const isCurrent = Math.abs(metSeconds - ev.timeSeconds) < 15;

                return (
                  <tr
                    key={ev.timeSeconds}
                    className={`cursor-pointer transition-colors ${
                      isCurrent ? 'bg-amber-950/30' : isPassed ? 'hover:bg-white/5' : 'opacity-40 hover:bg-white/5'
                    }`}
                    onClick={() => setMetSeconds(ev.timeSeconds)}
                  >
                    <td className="py-2 text-amber-400 font-bold">T+{ev.timeSeconds}s</td>
                    <td className="py-2 text-white font-medium">{ev.event}</td>
                    <td className="py-2 text-cyan-300">{ev.stage}</td>
                    <td className="py-2 text-gray-300">{ev.altitudeKm} km</td>
                    <td className="py-2 text-gray-300">{ev.velocityKmh.toLocaleString()} km/h</td>
                    <td className="py-2 text-amber-300">{ev.thrustKiloNewtons} kN</td>
                    <td className="py-2 text-right">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                        isPassed ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30' :
                        isCurrent ? 'bg-amber-950 text-amber-300 border-amber-500/40' :
                        'bg-slate-900 text-slate-500 border-slate-700'
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
