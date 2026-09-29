'use client';

import React, { useState } from 'react';
import { Rocket, Flame, Gauge, ArrowUpRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { LAUNCH_TIMELINE } from '@/lib/mockData';
import { StagingTimelineEvent } from '@/lib/types';

export default function AscentTelemetryPage() {
  const [events, setEvents] = useState<StagingTimelineEvent[]>(LAUNCH_TIMELINE);
  const [activeStage, setActiveStage] = useState<'STAGE_1' | 'STAGE_2'>('STAGE_2');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="p-6 rounded-xl hud-panel space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-500/40 font-mono">
            LAUNCH VEHICLE FLIGHT DYNAMICS
          </span>
          <span className="text-xs text-cyan-400 font-mono">2-STAGE ORBITAL CLASS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          MULTI-STAGE LAUNCH ASCENT & STAGING TELEMETRY
        </h1>
        <p className="text-xs text-gray-400">
          Main engine cut-off (MECO), pneumatic stage separation, vacuum engine ignition (SES-1), and aerodynamic dynamic pressure curve.
        </p>
      </div>

      {/* Stage Engines & Tanks Gauge Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
        <div className="p-5 rounded-xl hud-panel space-y-3">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-gray-400">STAGE 1 PROPULSION</span>
            <span className="text-emerald-400 font-bold">MECO COMPLETED</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Engines:</span>
              <span className="text-white">9x Sea-Level Kerosene/LOX</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sea-Level Thrust:</span>
              <span className="text-amber-400">7,600 kN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Residual Fuel:</span>
              <span className="text-cyan-300">4.2% (Entry Burn Reserve)</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl hud-panel space-y-3">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-gray-400">STAGE 2 VACUUM (SES-1)</span>
            <span className="text-cyan-400 font-bold animate-pulse">THRUSTING</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Engine:</span>
              <span className="text-white">1x Vacuum Optimized (Isp: 348s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vacuum Thrust:</span>
              <span className="text-amber-400">981 kN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Chamber Pressure:</span>
              <span className="text-emerald-400">9.7 MPa</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl hud-panel space-y-3">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-gray-400">MAX-Q DYNAMICS</span>
            <span className="text-amber-300 font-bold">PASSED (T+68s)</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Peak Dynamic Press:</span>
              <span className="text-white">35.4 kPa</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Transonic Mach:</span>
              <span className="text-cyan-300">Mach 1.35</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fairing Thermal Load:</span>
              <span className="text-emerald-400">120 W/cm²</span>
            </div>
          </div>
        </div>
      </div>

      {/* Flight Timeline Sequence */}
      <div className="p-6 rounded-xl hud-panel space-y-4">
        <h2 className="text-sm font-mono font-bold text-white border-b border-white/10 pb-3">
          FLIGHT ASCENT SEQUENCE & SEPARATION MILESTONES
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-500 text-[11px]">
                <th className="pb-3">MET (T+)</th>
                <th className="pb-3">EVENT DESCRIPTION</th>
                <th className="pb-3">STAGE</th>
                <th className="pb-3">ALTITUDE</th>
                <th className="pb-3">VELOCITY</th>
                <th className="pb-3">THRUST</th>
                <th className="pb-3 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((ev) => (
                <tr key={ev.timeSeconds} className="hover:bg-white/5">
                  <td className="py-3 text-amber-400 font-bold">T+{ev.timeSeconds}s</td>
                  <td className="py-3 font-bold text-white">{ev.event}</td>
                  <td className="py-3 text-cyan-300">{ev.stage}</td>
                  <td className="py-3 text-gray-300">{ev.altitudeKm} km</td>
                  <td className="py-3 text-gray-300">{ev.velocityKmh.toLocaleString()} km/h</td>
                  <td className="py-3 text-amber-300">{ev.thrustKiloNewtons} kN</td>
                  <td className="py-3 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${
                      ev.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40' :
                      ev.status === 'ACTIVE' ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40 animate-pulse' :
                      'bg-slate-900 text-slate-500 border-slate-700'
                    }`}>
                      {ev.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
