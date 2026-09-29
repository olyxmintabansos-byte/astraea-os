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
  Activity,
  Radio
} from 'lucide-react';
import { TPSTileZone } from '@/lib/types';

export default function ReentryThermodynamicsPage() {
  const [altitudeKm, setAltitudeKm] = useState<number>(68.4);
  const [angleAttackDeg, setAngleAttackDeg] = useState<number>(40);
  const [flightPathAngleDeg, setFlightPathAngleDeg] = useState<number>(-6.2);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [selectedTileZone, setSelectedTileZone] = useState<string>('Z1-NOSE');

  const calculateAerothermo = (alt: number, alpha: number, gamma: number) => {
    const normAlt = Math.max(0, Math.min(1, (120 - alt) / 110));
    const mach = Math.max(0.8, 25 - normAlt * 24.2);
    const velKms = (mach * 1225) / 3600;

    const scaleHeightKm = 7.5;
    const rhoKgM3 = 1.225 * Math.exp(-alt / scaleHeightKm);

    const peakFactor = Math.exp(-Math.pow((alt - 68) / 18, 2));
    const heatFluxWattsCm2 = Math.max(12, 540 * peakFactor * (Math.sin((alpha * Math.PI) / 180) / Math.sin((40 * Math.PI) / 180)));

    const noseTempC = Math.max(20, 1680 * peakFactor + 40);
    const midbodyTempC = noseTempC * 0.72;
    const leewardTempC = noseTempC * 0.38;
    const cabinTempC = 24.2 + (noseTempC > 1400 ? (noseTempC - 1400) * 0.015 : 0);

    const isPlasmaActive = alt <= 95 && alt >= 40;
    const plasmaIntensity = isPlasmaActive ? Math.exp(-Math.pow((alt - 65) / 16, 2)) : 0;
    const rfAttenDb = -(plasmaIntensity * 72);

    let blackoutStatus: 'CLEAR' | 'IONIZING' | 'PEAK_BLACKOUT' | 'COMM_RESTORED' = 'CLEAR';
    if (alt > 95) blackoutStatus = 'CLEAR';
    else if (alt > 78) blackoutStatus = 'IONIZING';
    else if (alt > 48) blackoutStatus = 'PEAK_BLACKOUT';
    else blackoutStatus = 'COMM_RESTORED';

    const gFactor = Math.exp(-Math.pow((alt - 48) / 15, 2));
    const gForce = Math.max(0.1, 5.8 * gFactor * (Math.abs(gamma) / 6.2));

    const dynPressureKpa = Math.max(0.1, 82 * Math.exp(-Math.pow((alt - 52) / 16, 2)));

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

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setAltitudeKm((prev) => {
        if (prev <= 20) {
          setIsPlaying(false);
          return 20;
        }
        return Math.max(20, Number((prev - 0.4).toFixed(1)));
      });
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 font-mono select-none">
      {/* Top Reentry Console Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-2 py-0.2 rounded bg-[#2b1216] border border-[#591d28] text-red-400 font-bold">
              HYPERSONIC ENTRY // MACH {aero.mach.toFixed(1)}
            </span>
            <span className="text-[11px] text-gray-400">
              CHAPMAN HEAT FLUX • IONIZATION BLACKOUT • PICA-X TPS
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            REENTRY THERMODYNAMICS & PLASMA BLACKOUT CONSOLE
          </h1>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2 text-xs">
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
              setAltitudeKm(120);
              setIsPlaying(true);
            }}
            className="p-1.5 rounded bg-[#06080e] hover:bg-white/5 border border-[#1a2333] text-gray-400 hover:text-white"
            title="Reset to 120 km"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Altitude Scrubber & Corridor Status */}
      <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-2 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-500">ALTITUDE:</span>
            <span className="text-lg font-bold text-amber-400 tracking-wider">
              {altitudeKm.toFixed(1)} KM
            </span>
            <span className="text-[10px] text-gray-500">({(altitudeKm * 3280.84).toFixed(0)} ft)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">CORRIDOR STATUS:</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
              aero.corridorState === 'NOMINAL' ? 'bg-[#0e1a14] text-emerald-400 border-[#1b432e]' :
              aero.corridorState === 'SKIP_OFF_RISK' ? 'bg-[#2b1f0c] text-amber-300 border-[#66491d]' :
              'bg-[#2b1216] text-red-400 border-[#591d28]'
            }`}>
              {aero.corridorState === 'NOMINAL' ? 'NOMINAL FLIGHT CORRIDOR' :
               aero.corridorState === 'SKIP_OFF_RISK' ? 'SKIP-OFF WARNING (TOO SHALLOW)' :
               'CRITICAL: HIGH G-LOAD (TOO STEEP)'}
            </span>
          </div>
        </div>

        <input
          type="range"
          min="20"
          max="120"
          step="0.2"
          value={altitudeKm}
          onChange={(e) => setAltitudeKm(Number(e.target.value))}
          className="w-full h-1.5 bg-[#06080e] rounded appearance-none cursor-pointer accent-red-500"
        />
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>120 KM (INTERFACE)</span>
          <span className={altitudeKm <= 75 && altitudeKm >= 55 ? 'text-red-400 font-bold' : ''}>68 KM (PEAK HEAT)</span>
          <span className={altitudeKm <= 55 && altitudeKm >= 40 ? 'text-amber-400 font-bold' : ''}>45 KM (PEAK 5.8G)</span>
          <span>20 KM (TERMINAL)</span>
        </div>
      </div>

      {/* 4 Telemetry Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-1">
          <span className="text-[10px] text-gray-500 block">HEAT FLUX (STAGNATION)</span>
          <div className="text-xl font-bold text-white">{aero.heatFluxWattsCm2.toFixed(1)} <span className="text-xs text-red-400 font-normal">W/cm²</span></div>
          <span className="text-[10px] text-gray-400">Limit: 650 W/cm²</span>
        </div>

        <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-1">
          <span className="text-[10px] text-gray-500 block">NOSE TILE TEMP</span>
          <div className="text-xl font-bold text-white">{Math.round(aero.noseTempC)} <span className="text-xs text-amber-400 font-normal">°C</span></div>
          <span className="text-[10px] text-gray-400">Cabin Core: {aero.cabinTempC.toFixed(1)} °C</span>
        </div>

        <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-1">
          <span className="text-[10px] text-gray-500 block">RF ATTENUATION (S-BAND)</span>
          <div className="text-xl font-bold text-white">{aero.rfAttenDb.toFixed(1)} <span className="text-xs text-purple-400 font-normal">dB</span></div>
          <span className="text-[10px] text-gray-400">{aero.blackoutStatus}</span>
        </div>

        <div className="p-3 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-1">
          <span className="text-[10px] text-gray-500 block">DECELERATION LOAD</span>
          <div className="text-xl font-bold text-white">{aero.gForce.toFixed(2)} <span className="text-xs text-cyan-400 font-normal">G</span></div>
          <span className="text-[10px] text-gray-400">q = {aero.dynPressureKpa.toFixed(1)} kPa</span>
        </div>
      </div>

      {/* Main Row: Hypersonic Shockwave Visualizer (7 Cols) + RF Spectrum (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Hypersonic Bow Shock SVG (7 Cols) */}
        <div className="lg:col-span-7 p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-white font-bold flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-400" />
              HYPERSONIC BOW SHOCK & PLASMA LAYER
            </span>
            <span className="text-[10px] text-gray-400">SHOCK TEMP: ~{(aero.noseTempC * 3.8 + 273).toFixed(0)} K</span>
          </div>

          <div className="bg-[#06080e] rounded border border-white/5 p-2 flex items-center justify-center min-h-[300px]">
            <svg viewBox="0 0 500 280" className="w-full h-64">
              <defs>
                <linearGradient id="bowShockGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                  <stop offset="40%" stopColor="#fef08a" stopOpacity="0.7" />
                  <stop offset="80%" stopColor="#f97316" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Freestream vectors */}
              <g stroke="#38bdf8" strokeWidth="1" strokeDasharray="6,8" opacity="0.25">
                <line x1="20" y1="50" x2="150" y2="50" />
                <line x1="20" y1="90" x2="170" y2="90" />
                <line x1="20" y1="140" x2="185" y2="140" />
                <line x1="20" y1="190" x2="170" y2="190" />
                <line x1="20" y1="230" x2="150" y2="230" />
              </g>

              {/* Bow shock curve */}
              {(() => {
                const shockStandOff = Math.max(15, 38 - aero.mach);
                const shockApexX = 180 - shockStandOff;
                return (
                  <path
                    d={`M ${shockApexX + 110} 20 Q ${shockApexX} 140 ${shockApexX + 110} 260`}
                    fill="none"
                    stroke="url(#bowShockGrad)"
                    strokeWidth={Math.max(4, (aero.heatFluxWattsCm2 / 500) * 12)}
                    strokeLinecap="round"
                  />
                );
              })()}

              {/* Spacecraft capsule rotated by alpha */}
              <g transform={`rotate(${angleAttackDeg - 40}, 240, 140)`}>
                <path
                  d="M 210 90 Q 185 140 210 190 L 220 186 Q 198 140 220 94 Z"
                  fill={aero.noseTempC > 1400 ? '#ea580c' : aero.noseTempC > 900 ? '#d97706' : '#334155'}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                <path d="M 220 94 L 310 115 L 310 165 L 220 186 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
                <circle cx="260" cy="130" r="4" fill="#38bdf8" />
              </g>

              <text x="30" y="30" fill="#38bdf8" fontSize="9">FREESTREAM: MACH {aero.mach.toFixed(1)}</text>
              <text x="470" y="30" fill="#ef4444" fontSize="9" textAnchor="end">STAGNATION: {Math.round(aero.heatFluxWattsCm2)} W/cm²</text>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">ANGLE OF ATTACK (α):</span>
                <span className="font-bold text-amber-400">{angleAttackDeg}°</span>
              </div>
              <input
                type="range"
                min="25"
                max="55"
                value={angleAttackDeg}
                onChange={(e) => setAngleAttackDeg(Number(e.target.value))}
                className="w-full h-1 bg-[#1a2333] rounded appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">FLIGHT PATH (γ):</span>
                <span className={`font-bold ${aero.corridorState === 'NOMINAL' ? 'text-emerald-400' : 'text-red-400'}`}>
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
                className="w-full h-1 bg-[#1a2333] rounded appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* RF Link Budget Spectrum (5 Cols) */}
        <div className="lg:col-span-5 p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-purple-400 font-bold flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-purple-400" />
              RF SPECTRUM ATTENUATION
            </span>
            <span className="text-[10px] text-gray-500">ne ~ 10¹³ cm⁻³</span>
          </div>

          <div className="space-y-2">
            {/* S-Band */}
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-white font-bold">S-BAND (2.2 GHz)</span>
                <span className="text-red-400 font-bold">{aero.rfAttenDb.toFixed(0)} dB</span>
              </div>
              <div className="w-full h-1.5 bg-[#141b29] rounded overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${Math.max(5, 100 - Math.abs(aero.rfAttenDb) * 1.3)}%` }} />
              </div>
            </div>

            {/* X-Band */}
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-white font-bold">X-BAND (8.4 GHz)</span>
                <span className="text-amber-400 font-bold">{(aero.rfAttenDb * 0.75).toFixed(0)} dB</span>
              </div>
              <div className="w-full h-1.5 bg-[#141b29] rounded overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${Math.max(10, 100 - Math.abs(aero.rfAttenDb * 0.75) * 1.3)}%` }} />
              </div>
            </div>

            {/* Ka-Band */}
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-white font-bold">KA-BAND (26 GHz)</span>
                <span className="text-cyan-400 font-bold">{(aero.rfAttenDb * 0.42).toFixed(0)} dB</span>
              </div>
              <div className="w-full h-1.5 bg-[#141b29] rounded overflow-hidden">
                <div className="h-full bg-cyan-400" style={{ width: `${Math.max(25, 100 - Math.abs(aero.rfAttenDb * 0.42) * 1.3)}%` }} />
              </div>
            </div>

            {/* Optical Laser */}
            <div className="p-2.5 bg-[#06080e] border border-white/5 rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-white font-bold">OPTICAL LASER (1550 nm)</span>
                <span className="text-emerald-400 font-bold">0.0 dB (NOMINAL)</span>
              </div>
              <div className="w-full h-1.5 bg-[#141b29] rounded overflow-hidden">
                <div className="h-full bg-emerald-400 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TPS Thermal Protection System Tile Matrix Grid */}
      <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
        <div className="flex justify-between items-center border-b border-white/10 pb-2">
          <span className="text-white font-bold flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" />
            TPS TILE THERMAL MATRIX (12 ZONES)
          </span>
          <span className="text-gray-500">CLICK TILE TO INSPECT</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {tpsZones.map((zone) => {
            const isSelected = selectedTileZone === zone.zoneId;
            const tempRatio = zone.currentTempCelsius / zone.maxDesignTempCelsius;

            return (
              <div
                key={zone.zoneId}
                onClick={() => setSelectedTileZone(zone.zoneId)}
                className={`p-2.5 rounded border cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#1b263b] border-cyan-400' : 'bg-[#06080e] border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                  <span>{zone.zoneId}</span>
                  <span className="text-gray-400">{zone.material}</span>
                </div>
                <div className="text-sm font-bold text-white">{zone.currentTempCelsius}°C</div>
                <div className="w-full h-1 bg-[#141b29] rounded overflow-hidden my-1">
                  <div
                    className={`h-full ${tempRatio > 0.85 ? 'bg-red-500' : tempRatio > 0.65 ? 'bg-amber-500' : 'bg-cyan-400'}`}
                    style={{ width: `${Math.min(100, tempRatio * 100)}%` }}
                  />
                </div>
                <div className="text-[9px] text-gray-500">Max: {zone.maxDesignTempCelsius}°C</div>
              </div>
            );
          })}
        </div>

        {/* Selected zone details */}
        <div className="p-2.5 bg-[#06080e] border border-white/5 rounded flex justify-between items-center text-[11px]">
          <div>
            <span className="text-amber-400 font-bold">{activeTile.zoneId} // {activeTile.name}</span>
            <div className="text-gray-500 text-[10px]">
              Substrate: {activeTile.material} • Recession: {activeTile.ablationDepthMm} mm • Flux: {activeTile.heatFluxWattsCm2} W/cm²
            </div>
          </div>
          <div className="text-right">
            <span className="text-emerald-400 font-bold">
              +{(activeTile.maxDesignTempCelsius - activeTile.currentTempCelsius)}°C THERMAL RESERVE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
