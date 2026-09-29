'use client';

import React from 'react';

interface PFDProps {
  pitchDeg: number;
  rollDeg: number;
  yawDeg: number;
  altitudeKm: number;
  velocityKmS: number;
  gForce: number;
  mach: number;
}

export default function PrimaryFlightDisplay({
  pitchDeg,
  rollDeg,
  yawDeg,
  altitudeKm,
  velocityKmS,
  gForce,
  mach,
}: PFDProps) {
  // Constrain pitch to visible range
  const clampedPitch = Math.max(-85, Math.min(85, pitchDeg));
  const pitchPixelOffset = (clampedPitch / 10) * 18; // 18px per 10 degrees

  return (
    <div className="relative w-full h-full min-h-[380px] bg-[#05070c] border border-white/10 rounded-lg overflow-hidden font-mono select-none flex flex-col justify-between p-2">
      {/* Top Annunciator Strip */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-b border-white/10 pb-1.5 z-20 bg-[#05070c]/90">
        <span className="text-cyan-400 font-bold">PFD // PRIMARY FLIGHT DISPLAY</span>
        <span className="text-emerald-400 font-bold">ATT: INERTIAL HOLD</span>
        <span>FD: AUTO</span>
      </div>

      {/* Main Horizon & Ladder Center Box */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden my-1">
        {/* Pitch and Roll Horizon Canvas Area */}
        <div
          className="absolute w-[400px] h-[400px] transition-transform duration-75 ease-out"
          style={{
            transform: `rotate(${-rollDeg}deg)`,
          }}
        >
          {/* Artificial Horizon Divider */}
          <div
            className="w-full h-full relative"
            style={{
              transform: `translateY(${pitchPixelOffset}px)`,
            }}
          >
            {/* Sky (Upper Half) */}
            <div className="absolute top-0 left-0 right-0 h-[200px] bg-gradient-to-b from-[#0c2444] to-[#0f3460] border-b-2 border-white" />
            {/* Ground / Nadir (Lower Half) */}
            <div className="absolute top-[200px] left-0 right-0 h-[200px] bg-gradient-to-b from-[#332211] to-[#1a1108]" />

            {/* Pitch Ladder Ticks */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {[-60, -50, -40, -30, -20, -10, 10, 20, 30, 40, 50, 60].map((deg) => {
                const yPos = 200 - (deg / 10) * 18;
                const isPositive = deg > 0;
                return (
                  <div
                    key={deg}
                    className="absolute flex items-center gap-1.5"
                    style={{ top: `${yPos}px` }}
                  >
                    <span className="text-[9px] text-white/80 font-bold">{Math.abs(deg)}</span>
                    <div
                      className={`h-[1px] ${isPositive ? 'w-8 bg-cyan-300' : 'w-8 bg-amber-400 border-dashed border-t'}`}
                    />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    <div
                      className={`h-[1px] ${isPositive ? 'w-8 bg-cyan-300' : 'w-8 bg-amber-400 border-dashed border-t'}`}
                    />
                    <span className="text-[9px] text-white/80 font-bold">{Math.abs(deg)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Static Boresight / Flight Director Crosshair (Center) */}
        <div className="absolute z-20 pointer-events-none flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 bg-black/40" />
          <div className="absolute w-8 h-[2px] bg-amber-400 -left-9" />
          <div className="absolute w-8 h-[2px] bg-amber-400 -right-9" />
          <div className="absolute w-[2px] h-3 bg-amber-400 -top-4" />
        </div>

        {/* Roll Arc Indicator (Top Arc) */}
        <div className="absolute top-2 z-20 pointer-events-none flex flex-col items-center">
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-amber-400" />
          <span className="text-[10px] text-amber-300 font-bold bg-black/80 px-1 rounded border border-white/10 mt-0.5">
            {rollDeg > 0 ? `+${rollDeg.toFixed(1)}` : rollDeg.toFixed(1)}°
          </span>
        </div>

        {/* Left Rolling Speed Tape */}
        <div className="absolute left-2 top-2 bottom-2 w-14 bg-black/80 border border-white/10 rounded z-20 flex flex-col justify-between p-1">
          <div className="text-[9px] text-gray-400 text-center border-b border-white/10 pb-0.5">V (KM/S)</div>
          <div className="relative flex-1 overflow-hidden my-1 flex items-center justify-center">
            {/* Speed numerical box */}
            <div className="bg-amber-950 border border-amber-500/80 px-1 py-0.5 rounded text-amber-300 font-bold text-center text-xs w-full shadow-[0_0_8px_rgba(245,158,11,0.3)]">
              {velocityKmS.toFixed(2)}
            </div>
          </div>
          <div className="text-[9px] text-gray-500 text-center">MACH {mach.toFixed(1)}</div>
        </div>

        {/* Right Rolling Altitude Tape */}
        <div className="absolute right-2 top-2 bottom-2 w-14 bg-black/80 border border-white/10 rounded z-20 flex flex-col justify-between p-1">
          <div className="text-[9px] text-gray-400 text-center border-b border-white/10 pb-0.5">ALT (KM)</div>
          <div className="relative flex-1 overflow-hidden my-1 flex items-center justify-center">
            {/* Altitude numerical box */}
            <div className="bg-cyan-950 border border-cyan-500/80 px-1 py-0.5 rounded text-cyan-300 font-bold text-center text-xs w-full shadow-[0_0_8px_rgba(6,182,212,0.3)]">
              {altitudeKm.toFixed(1)}
            </div>
          </div>
          <div className="text-[9px] text-gray-500 text-center">MSL</div>
        </div>
      </div>

      {/* Bottom Heading Tape & G-Meter */}
      <div className="flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px] text-gray-400 z-20 bg-[#05070c]/90">
        <div>
          <span>G-LOAD: </span>
          <span className="text-white font-bold">{gForce.toFixed(2)} G</span>
        </div>

        {/* Heading Readout */}
        <div className="flex items-center gap-1 bg-black/80 px-2 py-0.5 rounded border border-white/10">
          <span className="text-gray-400">HDG:</span>
          <span className="text-amber-400 font-bold">{Math.round((yawDeg + 360) % 360)}°</span>
        </div>

        <div>
          <span>PITCH: </span>
          <span className="text-cyan-300 font-bold">{pitchDeg.toFixed(1)}°</span>
        </div>
      </div>
    </div>
  );
}
