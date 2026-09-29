'use client';

import React from 'react';
import { Flame, ShieldAlert, WifiOff, Thermometer, Gauge } from 'lucide-react';
import { REENTRY_DATA } from '@/lib/mockData';

export default function ReentryThermodynamicsPage() {
  const data = REENTRY_DATA;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="p-6 rounded-xl hud-panel-alert space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] bg-red-950 text-red-300 border border-red-500/40 font-mono flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            HYPERSONIC ATMOSPHERIC ENTRY
          </span>
          <span className="text-xs text-amber-400 font-mono">MACH 21.4 • ENTRY INTERFACE (120 KM)</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          REENTRY THERMODYNAMICS & PLASMA BLACKOUT HUD
        </h1>
        <p className="text-xs text-gray-300">
          Chapman stagnation-point aerothermodynamic heat flux solver, TPS ablative tile temperature gradient, and RF ionization blackout.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 font-mono text-xs">
        <div className="p-5 rounded-xl hud-panel space-y-2">
          <span className="text-gray-400">STAGNATION HEAT FLUX</span>
          <div className="text-2xl font-black text-red-400">{data.stagnationHeatFluxWattsCm2} W/cm²</div>
          <span className="text-[10px] text-gray-500">Chapman Viscous Dissipation</span>
        </div>

        <div className="p-5 rounded-xl hud-panel space-y-2">
          <span className="text-gray-400">PICA-X SHIELD TEMP</span>
          <div className="text-2xl font-black text-amber-400">{data.tpsTileTempCelsius} °C</div>
          <span className="text-[10px] text-gray-500">Carbon-Phenolic Sublimation</span>
        </div>

        <div className="p-5 rounded-xl hud-panel space-y-2">
          <span className="text-gray-400">RF IONIZATION SHEATH</span>
          <div className="text-2xl font-black text-red-500 flex items-center gap-1">
            <WifiOff className="w-5 h-5 text-red-400 animate-pulse" />
            {data.rfAttenuationDb} dB
          </div>
          <span className="text-[10px] text-red-300">S-Band & TDRS Blackout</span>
        </div>

        <div className="p-5 rounded-xl hud-panel space-y-2">
          <span className="text-gray-400">DYNAMIC PRESSURE (q)</span>
          <div className="text-2xl font-black text-cyan-300">{data.dynamicPressureKPa} kPa</div>
          <span className="text-[10px] text-gray-500">Atmospheric Density: Exponential</span>
        </div>
      </div>

      <div className="p-6 rounded-xl hud-panel space-y-4">
        <h2 className="text-sm font-mono font-bold text-white border-b border-white/10 pb-3">
          THERMAL PROTECTION SYSTEM (TPS) CROSS-SECTION HEAT SINK
        </h2>
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded bg-black/40 border border-white/5 space-y-2">
            <div className="flex justify-between">
              <span className="text-red-400 font-bold">OUTER BOUNDARY SHOCK LAYER</span>
              <span className="text-white">6,800 K (Ionized Plasma)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-yellow-300 w-[95%]" />
            </div>
          </div>

          <div className="p-4 rounded bg-black/40 border border-white/5 space-y-2">
            <div className="flex justify-between">
              <span className="text-amber-400 font-bold">PICA-X REUSABLE ABLATIVE TILES</span>
              <span className="text-white">1,640 °C (Surface Radiant Limit)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full bg-amber-500 w-[65%]" />
            </div>
          </div>

          <div className="p-4 rounded bg-black/40 border border-white/5 space-y-2">
            <div className="flex justify-between">
              <span className="text-cyan-400 font-bold">TITANIUM PRESSURE VESSEL CABIN</span>
              <span className="text-emerald-400 font-bold">24.2 °C (NOMINAL)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full bg-cyan-400 w-[15%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
