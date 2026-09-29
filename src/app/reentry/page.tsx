'use client';

import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  ShieldAlert, 
  WifiOff, 
  Wifi, 
  Thermometer, 
  Gauge, 
  Layers, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  Activity,
  Compass,
  Radio,
  Volume2,
  VolumeX,
  CheckCircle2
} from 'lucide-react';
import { REENTRY_DATA } from '@/lib/mockData';
import { TPSTileZone } from '@/lib/types';

// Audio feedback generator
const playTone = (freq: number, type: OscillatorType = 'sine', duration = 0.1) => {
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
    // blocked or not supported
  }
};

export default function ReentryThermodynamicsPage() {
  // Reentry simulation state
  const [altitudeKm, setAltitudeKm] = useState<number>(68.4); // Start near peak heating (68.4 km)
  const [angleAttackDeg, setAngleAttackDeg] = useState<number>(40); // Nominal 40 deg
  const [flightPathAngleDeg, setFlightPathAngleDeg] = useState<number>(-6.2); // Nominal -6.2 deg
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [selectedTileZone, setSelectedTileZone] = useState<string>('Z1-NOSE');

  // Derive atmospheric aerothermodynamics from altitude & flight path angle
  const calculateAerothermo = (alt: number, alpha: number, gamma: number) => {
    // Atmospheric interface at 120 km down to terminal 10 km
    const normAlt = Math.max(0, Math.min(1, (120 - alt) / 110)); // 0 at 120km, 1 at 10km

    // Velocity deceleration (Mach 25 down to Mach 0.8)
    const mach = Math.max(0.8, 25 - normAlt * 24.2);
    const velKms = (mach * 1225) / 3600;

    // Atmospheric density exponential model: rho = rho0 * exp(-h / H)
    const scaleHeightKm = 7.5;
    const rhoKgM3 = 1.225 * Math.exp(-alt / scaleHeightKm);

    // Stagnation heat flux: Chapman formula q = C * sqrt(rho / R_nose) * v^3
    // Peak heat flux occurs between 65km and 72km
    const peakFactor = Math.exp(-Math.pow((alt - 68) / 18, 2));
    const heatFluxWattsCm2 = Math.max(12, 540 * peakFactor * (Math.sin((alpha * Math.PI) / 180) / Math.sin((40 * Math.PI) / 180)));

    // Tile temperatures (Peak ~1,680°C at stagnation nose)
    const noseTempC = Math.max(20, 1680 * peakFactor + 40);
    const midbodyTempC = noseTempC * 0.72;
    const leewardTempC = noseTempC * 0.38;
    const cabinTempC = 24.2 + (noseTempC > 1400 ? (noseTempC - 1400) * 0.015 : 0);

    // RF Ionization and plasma electron density (Peak between 85km and 45km)
    const isPlasmaActive = alt <= 95 && alt >= 40;
    const plasmaIntensity = isPlasmaActive ? Math.exp(-Math.pow((alt - 65) / 16, 2)) : 0;
    const rfAttenDb = -(plasmaIntensity * 72);

    let blackoutStatus: 'CLEAR' | 'IONIZING' | 'PEAK_BLACKOUT' | 'COMM_RESTORED' = 'CLEAR';
    if (alt > 95) blackoutStatus = 'CLEAR';
    else if (alt > 78) blackoutStatus = 'IONIZING';
    else if (alt > 48) blackoutStatus = 'PEAK_BLACKOUT';
    else blackoutStatus = 'COMM_RESTORED';

    // Deceleration G-force (Peak ~5.8G at ~45km)
    const gFactor = Math.exp(-Math.pow((alt - 48) / 15, 2));
    const gForce = Math.max(0.1, 5.8 * gFactor * (Math.abs(gamma) / 6.2));

    // Dynamic pressure q = 0.5 * rho * v^2
    const dynPressureKpa = Math.max(0.1, 82 * Math.exp(-Math.pow((alt - 52) / 16, 2)));

    // Corridor safety evaluation
    let corridorState: 'NOMINAL' | 'SKIP_OFF_RISK' | 'OVER_G_CRITICAL' = 'NOMINAL';
    if (gamma > -5.2) corridorState = 'SKIP_OFF_RISK';
    else if (gamma < -7.4) corridorState = 'OVER_G_CRITICAL';

    return {
      mach,
      velKms,
      rhoKgM3,
      heatFluxWattsCm2,
      noseTempC,
      midbodyTempC,
      leewardTempC,
      cabinTempC,
      rfAttenDb,
      blackoutStatus,
      gForce,
      dynPressureKpa,
      corridorState,
    };
  };

  const aero = calculateAerothermo(altitudeKm, angleAttackDeg, flightPathAngleDeg);

  // Playback timer (descends from 120km to 20km)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setAltitudeKm((prev) => {
        if (prev <= 20) {
          setIsPlaying(false);
          return 20;
        }
        const next = Math.max(20, Number((prev - 0.4).toFixed(1)));
        if (soundEnabled && Math.abs(next - 68) < 0.3) {
          playTone(440, 'sawtooth', 0.2); // Alert tone at peak heating
        }
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying, soundEnabled]);

  // 12 Discrete TPS Tile Zones
  const tpsZones: TPSTileZone[] = [
    { zoneId: 'Z1-NOSE', name: 'Nose Stagnation Cap', material: 'RCC', currentTempCelsius: Math.round(aero.noseTempC), maxDesignTempCelsius: 1850, ablationDepthMm: Number((aero.noseTempC * 0.0022).toFixed(2)), heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2) },
    { zoneId: 'Z2-CHINE-L', name: 'Forward Chine (Port)', material: 'PICA-X', currentTempCelsius: Math.round(aero.noseTempC * 0.88), maxDesignTempCelsius: 1700, ablationDepthMm: Number((aero.noseTempC * 0.0018).toFixed(2)), heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.85) },
    { zoneId: 'Z3-CHINE-R', name: 'Forward Chine (Stbd)', material: 'PICA-X', currentTempCelsius: Math.round(aero.noseTempC * 0.88), maxDesignTempCelsius: 1700, ablationDepthMm: Number((aero.noseTempC * 0.0018).toFixed(2)), heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.85) },
    { zoneId: 'Z4-WIND-FWD', name: 'Windward Belly Fwd', material: 'PICA-X', currentTempCelsius: Math.round(aero.midbodyTempC * 1.15), maxDesignTempCelsius: 1650, ablationDepthMm: Number((aero.midbodyTempC * 0.0015).toFixed(2)), heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.78) },
    { zoneId: 'Z5-WIND-MID', name: 'Windward Belly Center', material: 'PICA-X', currentTempCelsius: Math.round(aero.midbodyTempC), maxDesignTempCelsius: 1650, ablationDepthMm: Number((aero.midbodyTempC * 0.0012).toFixed(2)), heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.70) },
    { zoneId: 'Z6-WIND-AFT', name: 'Windward Belly Aft', material: 'PICA-X', currentTempCelsius: Math.round(aero.midbodyTempC * 0.95), maxDesignTempCelsius: 1650, ablationDepthMm: Number((aero.midbodyTempC * 0.0010).toFixed(2)), heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.65) },
    { zoneId: 'Z7-FLAP-PORT', name: 'Body Flap Leading Edge (L)', material: 'TUFROC', currentTempCelsius: Math.round(aero.midbodyTempC * 1.08), maxDesignTempCelsius: 1700, ablationDepthMm: 0.12, heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.74) },
    { zoneId: 'Z8-FLAP-STBD', name: 'Body Flap Leading Edge (R)', material: 'TUFROC', currentTempCelsius: Math.round(aero.midbodyTempC * 1.08), maxDesignTempCelsius: 1700, ablationDepthMm: 0.12, heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.74) },
    { zoneId: 'Z9-LEE-CANOPY', name: 'Leeward Crew Canopy', material: 'LI-900', currentTempCelsius: Math.round(aero.leewardTempC), maxDesignTempCelsius: 1260, ablationDepthMm: 0.0, heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.25) },
    { zoneId: 'Z10-LEE-MID', name: 'Leeward Midbody', material: 'LI-900', currentTempCelsius: Math.round(aero.leewardTempC * 0.85), maxDesignTempCelsius: 1260, ablationDepthMm: 0.0, heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.20) },
    { zoneId: 'Z11-UMBILICAL', name: 'Aft Umbilical Door', material: 'LI-900', currentTempCelsius: Math.round(aero.leewardTempC * 0.9), maxDesignTempCelsius: 1260, ablationDepthMm: 0.0, heatFluxWattsCm2: Math.round(aero.heatFluxWattsCm2 * 0.22) },
    { zoneId: 'Z12-CABIN-CORE', name: 'Titanium Pressure Vessel', material: 'LI-900', currentTempCelsius: Math.round(aero.cabinTempC), maxDesignTempCelsius: 65, ablationDepthMm: 0.0, heatFluxWattsCm2: 2.1 },
  ];

  const activeTile = tpsZones.find((z) => z.zoneId === selectedTileZone) || tpsZones[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Cockpit Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl hud-panel-alert">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-red-950/80 text-red-300 border border-red-500/50 flex items-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
              <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              HYPERSONIC ENTRY AEROTHERMODYNAMICS // MACH {aero.mach.toFixed(1)}
            </span>
            <span className="text-xs text-amber-400 font-mono">
              CHAPMAN HEAT FLUX • IONIZATION BLACKOUT • PICA-X TPS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight glow-amber">
            REENTRY THERMODYNAMICS & PLASMA BLACKOUT HUD
          </h1>
          <p className="text-xs text-gray-300 mt-1 max-w-2xl">
            Viscous hypersonic bow shock detachment, continuous aerothermodynamic stagnation heating solver, ablative heat shield thermal response, and multi-band RF ionization attenuation.
          </p>
        </div>

        {/* Playback Controls & Audio */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-mono transition-all ${
              soundEnabled
                ? 'bg-red-950/60 border-red-500/50 text-red-300'
                : 'bg-black/50 border-white/10 text-gray-500 hover:text-white'
            }`}
            title="Toggle Reentry Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              if (soundEnabled) playTone(520, 'triangle', 0.08);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'FREEZE TELEMETRY' : 'RESUME ENTRY'}</span>
          </button>

          <button
            onClick={() => {
              setAltitudeKm(120);
              setIsPlaying(true);
              if (soundEnabled) playTone(300, 'sine', 0.1);
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white"
            title="Reset to 120 km (Interface)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Altitude Scrubber & Corridor Status Bar */}
      <div className="p-4 rounded-xl hud-panel space-y-3 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">ENTRY ALTITUDE:</span>
            <span className="text-2xl font-black text-amber-400 font-mono tracking-widest glow-amber">
              {altitudeKm.toFixed(1)} KM
            </span>
            <span className="text-[11px] text-gray-500">
              ({(altitudeKm * 3280.84).toFixed(0)} FT MSL)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">CORRIDOR INTEGRITY:</span>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
              aero.corridorState === 'NOMINAL' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' :
              aero.corridorState === 'SKIP_OFF_RISK' ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse' :
              'bg-red-950/80 text-red-300 border-red-500/50 animate-bounce'
            }`}>
              {aero.corridorState === 'NOMINAL' ? 'SAFE ENTRY CORRIDOR' :
               aero.corridorState === 'SKIP_OFF_RISK' ? 'WARNING: SKIP-OFF RISK (TOO SHALLOW)' :
               'CRITICAL: STRUCTURAL / THERMAL OVER-G (TOO STEEP)'}
            </span>
          </div>
        </div>

        {/* Altitude Range Scrubber */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>120 KM (ENTRY INTERFACE)</span>
            <span className={altitudeKm <= 95 && altitudeKm >= 45 ? 'text-red-400 font-bold' : ''}>
              68 KM (PEAK HEAT & BLACKOUT)
            </span>
            <span className={altitudeKm <= 45 ? 'text-amber-300 font-bold' : ''}>
              45 KM (PEAK DECEL 5.8G)
            </span>
            <span className={altitudeKm <= 25 ? 'text-emerald-300 font-bold' : ''}>
              20 KM (TERMINAL DESCENT)
            </span>
          </div>
          <input
            type="range"
            min="20"
            max="120"
            step="0.2"
            value={altitudeKm}
            onChange={(e) => setAltitudeKm(Number(e.target.value))}
            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>
      </div>

      {/* 4-Pillar Critical Reentry Telemetry Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
        <div className="p-4 rounded-xl hud-panel border-l-4 border-l-red-500 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>STAGNATION HEAT FLUX</span>
            <Flame className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {aero.heatFluxWattsCm2.toFixed(1)} <span className="text-xs text-red-400 font-normal">W/CM²</span>
          </div>
          <div className="text-[10px] text-gray-400 flex justify-between">
            <span>Peak Design:</span>
            <span className="text-red-300">650 W/cm² Limit</span>
          </div>
        </div>

        <div className="p-4 rounded-xl hud-panel border-l-4 border-l-amber-400 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>PICA-X SHIELD TEMP</span>
            <Thermometer className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {Math.round(aero.noseTempC)} <span className="text-xs text-amber-400 font-normal">°C</span>
          </div>
          <div className="text-[10px] text-gray-400 flex justify-between">
            <span>Cabin Internal:</span>
            <span className="text-emerald-300">{aero.cabinTempC.toFixed(1)} °C</span>
          </div>
        </div>

        <div className="p-4 rounded-xl hud-panel border-l-4 border-l-purple-500 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>RF PLASMA ATTENUATION</span>
            {aero.blackoutStatus === 'PEAK_BLACKOUT' ? (
              <WifiOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
          <div className="text-2xl font-black text-white">
            {aero.rfAttenDb.toFixed(1)} <span className="text-xs text-purple-400 font-normal">DB</span>
          </div>
          <div className="text-[10px] text-gray-400 flex justify-between">
            <span>Comms Status:</span>
            <span className={aero.blackoutStatus === 'PEAK_BLACKOUT' ? 'text-red-400 font-bold' : 'text-emerald-300'}>
              {aero.blackoutStatus}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl hud-panel border-l-4 border-l-cyan-400 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>AERODYNAMIC DECELERATION</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {aero.gForce.toFixed(2)} <span className="text-xs text-cyan-400 font-normal">G</span>
          </div>
          <div className="text-[10px] text-gray-400 flex justify-between">
            <span>Dynamic Pressure:</span>
            <span className="text-cyan-300">{aero.dynPressureKpa.toFixed(1)} kPa</span>
          </div>
        </div>
      </div>

      {/* Main Tactical Visualizer Row: Bow Shock Plasma Visualizer (Left) + Interactive Aerodynamics Controls (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hypersonic Bow Shock & Plasma Sheath Canvas / SVG (7 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl hud-panel space-y-4 font-mono">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-400" />
                HYPERSONIC BOW SHOCK & PLASMA SHEATH
              </h2>
              <span className="text-[10px] text-gray-400">DETACHMENT SHOCK LAYER & VISCOUS WAKE</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-red-300">
              SHOCK TEMP: ~{(aero.noseTempC * 3.8 + 273).toFixed(0)} K
            </span>
          </div>

          {/* SVG Shock Visualizer */}
          <div className="relative bg-black/70 rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center min-h-[380px] overflow-hidden">
            {/* Plasma Glow Atmosphere */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-500"
              style={{
                background: `radial-gradient(ellipse at 40% 50%, rgba(239, 68, 68, ${Math.min(0.4, aero.heatFluxWattsCm2 / 1200)}) 0%, transparent 70%)`
              }}
            />

            <svg viewBox="0 0 500 320" className="w-full h-72">
              <defs>
                {/* Plasma Bow Shock Gradient */}
                <linearGradient id="bowShockGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="30%" stopColor="#fef08a" stopOpacity="0.8" />
                  <stop offset="65%" stopColor="#f97316" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                </linearGradient>

                {/* Stagnation High Energy Gradient */}
                <radialGradient id="stagnationPointGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="40%" stopColor="#fde047" />
                  <stop offset="70%" stopColor="#ea580c" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>

                {/* Ablative Shield Gradient */}
                <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>

              {/* Hypersonic Free-Stream Airflow Vectors (Left to Right) */}
              <g stroke="#38bdf8" strokeWidth="1" strokeDasharray="6,8" opacity="0.35">
                <line x1="20" y1="60" x2="150" y2="60" />
                <line x1="20" y1="100" x2="170" y2="100" />
                <line x1="20" y1="140" x2="185" y2="140" />
                <line x1="20" y1="180" x2="185" y2="180" />
                <line x1="20" y1="220" x2="170" y2="220" />
                <line x1="20" y1="260" x2="150" y2="260" />
              </g>

              {/* Detached Hypersonic Bow Shock Hyperbolic Curve */}
              {(() => {
                const shockStandOff = Math.max(15, 38 - aero.mach);
                const shockApexX = 180 - shockStandOff;

                return (
                  <g>
                    {/* Glowing Shock Wave Sheath */}
                    <path
                      d={`M ${shockApexX + 110} 20 Q ${shockApexX} 160 ${shockApexX + 110} 300`}
                      fill="none"
                      stroke="url(#bowShockGrad)"
                      strokeWidth={Math.max(6, (aero.heatFluxWattsCm2 / 500) * 16)}
                      strokeLinecap="round"
                    />
                    <path
                      d={`M ${shockApexX + 120} 10 Q ${shockApexX - 10} 160 ${shockApexX + 120} 310`}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      opacity="0.6"
                      strokeDasharray="4,2"
                    />

                    {/* Stagnation Point Core Fireball */}
                    <circle
                      cx={shockApexX + 12}
                      cy="160"
                      r={Math.max(8, (aero.heatFluxWattsCm2 / 500) * 24)}
                      fill="url(#stagnationPointGrad)"
                      opacity="0.85"
                    />
                  </g>
                );
              })()}

              {/* Spacecraft Capsule Body (Rotated by Angle of Attack alpha) */}
              <g transform={`rotate(${angleAttackDeg - 40}, 240, 160)`}>
                {/* Heat Shield Nose Curved Cap (Windward) */}
                <path
                  d="M 210 100 Q 180 160 210 220 L 220 216 Q 194 160 220 104 Z"
                  fill={aero.noseTempC > 1400 ? '#f97316' : aero.noseTempC > 1000 ? '#f59e0b' : '#334155'}
                  stroke={aero.noseTempC > 1400 ? '#fde047' : '#94a3b8'}
                  strokeWidth="2"
                />

                {/* Capsule Aft Cone Structure */}
                <path
                  d="M 220 104 L 320 130 L 320 190 L 220 216 Z"
                  fill="url(#shieldGrad)"
                  stroke="#475569"
                  strokeWidth="1.5"
                />

                {/* Crew Windows */}
                <circle cx="265" cy="145" r="5" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
                <circle cx="280" cy="150" r="4" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />

                {/* Trailing Recirculation Wake Plasma (Downstream) */}
                <path
                  d="M 320 130 Q 420 110 480 140 Q 420 160 480 180 Q 420 210 320 190 Z"
                  fill="#ef4444"
                  opacity={Math.min(0.4, aero.heatFluxWattsCm2 / 1400)}
                />
              </g>

              {/* Telemetry Annotation Labels */}
              <text x="30" y="30" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                FREESTREAM: MACH {aero.mach.toFixed(1)} ({aero.velKms.toFixed(2)} km/s)
              </text>
              <text x="470" y="30" fill="#ef4444" fontSize="9" textAnchor="end" fontFamily="monospace">
                STAGNATION: {Math.round(aero.heatFluxWattsCm2)} W/cm²
              </text>
            </svg>
          </div>

          {/* Interactive Aerodynamic Parameter Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">ANGLE OF ATTACK (α):</span>
                <span className="font-bold text-amber-400">{angleAttackDeg}°</span>
              </div>
              <input
                type="range"
                min="25"
                max="55"
                value={angleAttackDeg}
                onChange={(e) => setAngleAttackDeg(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <span className="text-[10px] text-gray-500 block">Nominal Lift-to-Drag trim: 40°</span>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">FLIGHT PATH ANGLE (γ):</span>
                <span className={`font-bold ${
                  flightPathAngleDeg > -5.2 ? 'text-amber-400' :
                  flightPathAngleDeg < -7.4 ? 'text-red-400' :
                  'text-emerald-400'
                }`}>
                  {flightPathAngleDeg.toFixed(1)}°
                </span>
              </div>
              <input
                type="range"
                min="-9.0"
                max="-4.0"
                step="0.1"
                value={flightPathAngleDeg}
                onChange={(e) => setFlightPathAngleDeg(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-[10px] text-gray-500 block">Entry corridor safety envelope: -5.2° to -7.4°</span>
            </div>
          </div>
        </div>

        {/* RF Plasma Ionization & Multi-Band Attenuation Analyzer (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl hud-panel space-y-4 font-mono">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h2 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" />
                  RF IONIZATION LINK BUDGET SPECTRUM
                </h2>
                <span className="text-[10px] text-gray-400">ELECTRON DENSITY (ne) ~ 10¹³ cm⁻³</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${
                aero.blackoutStatus === 'PEAK_BLACKOUT'
                  ? 'bg-red-950 text-red-300 border-red-500/50 animate-pulse'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
              }`}>
                {aero.blackoutStatus}
              </span>
            </div>

            {/* Signal Bands Breakdown */}
            <div className="space-y-3 text-xs">
              {/* S-Band */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-white">S-BAND (2.2 GHz) // TELEMETRY & VOICE</span>
                  <span className="text-red-400 font-bold">{aero.rfAttenDb.toFixed(0)} dB</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-300"
                    style={{ width: `${Math.max(5, 100 - Math.abs(aero.rfAttenDb) * 1.3)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Downlink: Deep Blackout</span>
                  <span>Margin: -42.4 dB</span>
                </div>
              </div>

              {/* X-Band */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-white">X-BAND (8.4 GHz) // DSN TRACKING</span>
                  <span className="text-amber-400 font-bold">{(aero.rfAttenDb * 0.75).toFixed(0)} dB</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${Math.max(10, 100 - Math.abs(aero.rfAttenDb * 0.75) * 1.3)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Downlink: Intermittent Frames</span>
                  <span>Margin: -18.2 dB</span>
                </div>
              </div>

              {/* Ka-Band */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-white">KA-BAND (26.0 GHz) // TDRS HIGH-THROUGHPUT</span>
                  <span className="text-cyan-400 font-bold">{(aero.rfAttenDb * 0.42).toFixed(0)} dB</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${Math.max(25, 100 - Math.abs(aero.rfAttenDb * 0.42) * 1.3)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Downlink: Marginal Lock</span>
                  <span>Margin: +4.6 dB</span>
                </div>
              </div>

              {/* Optical Laser Terminal */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-white">OPTICAL LASER (1550 nm) // STARLINK INTER-SATELLITE</span>
                  <span className="text-emerald-400 font-bold">0.0 dB (NOMINAL)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div className="h-full bg-emerald-400 w-full" />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Downlink: 10.0 Gbps Unattenuated</span>
                  <span className="text-emerald-300">PLASMA IMMUNE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TPS Thermal Protection System Tile Matrix Grid */}
      <div className="p-6 rounded-2xl hud-panel space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              THERMAL PROTECTION SYSTEM (TPS) TILE MATRIX & ABLATION PROFILER
            </h2>
            <span className="text-[10px] text-gray-400">12 DISCRETE SENSOR ARRAYS • PICA-X / RCC / TUFROC / LI-900</span>
          </div>
          <span className="text-[10px] text-gray-400">SELECT TILE FOR TELEMETRY INSPECTION</span>
        </div>

        {/* 12-Zone Tile Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tpsZones.map((zone) => {
            const isSelected = selectedTileZone === zone.zoneId;
            const tempRatio = zone.currentTempCelsius / zone.maxDesignTempCelsius;
            const isWarning = tempRatio > 0.85;

            return (
              <div
                key={zone.zoneId}
                onClick={() => setSelectedTileZone(zone.zoneId)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : isWarning
                    ? 'bg-red-950/20 border-red-500/40 hover:border-red-400'
                    : 'bg-black/40 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1">
                  <span className="font-bold">{zone.zoneId}</span>
                  <span className="text-[9px] px-1 rounded bg-black/60 border border-white/10">{zone.material}</span>
                </div>
                <div className="text-base font-black text-white">{zone.currentTempCelsius}°C</div>
                <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden my-1">
                  <div
                    className={`h-full ${
                      tempRatio > 0.85 ? 'bg-red-500' : tempRatio > 0.65 ? 'bg-amber-500' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, tempRatio * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>Limit: {zone.maxDesignTempCelsius}°C</span>
                  <span>{zone.heatFluxWattsCm2} W</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Zone Deep Dive Panel */}
        <div className="p-4 rounded-xl bg-black/50 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div>
            <span className="text-amber-400 font-bold">{activeTile.zoneId} // {activeTile.name}</span>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Material Substrate: <span className="text-white">{activeTile.material}</span> • Ablation Recession: <span className="text-red-300">{activeTile.ablationDepthMm} mm</span> • Surface Flux: <span className="text-cyan-300">{activeTile.heatFluxWattsCm2} W/cm²</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <span className="text-gray-400 text-[10px] block">THERMAL SAFETY MARGIN</span>
              <span className="text-sm font-bold text-emerald-400">
                +{(activeTile.maxDesignTempCelsius - activeTile.currentTempCelsius)} °C RESERVE
              </span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] block">SUBLIMATION RESISTANCE</span>
              <span className="text-sm font-bold text-cyan-300">NOMINAL STABLE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
