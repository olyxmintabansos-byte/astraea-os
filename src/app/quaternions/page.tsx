'use client';

import React, { useState } from 'react';
import { Compass, Rotate3d, Zap, ShieldCheck } from 'lucide-react';
import { INITIAL_ATTITUDE } from '@/lib/mockData';
import { AttitudeQuaternion } from '@/lib/types';

export default function AttitudeQuaternionsPage() {
  const [attitude, setAttitude] = useState<AttitudeQuaternion>(INITIAL_ATTITUDE);

  const fireThruster = (id: number) => {
    setAttitude((prev) => ({
      ...prev,
      rcsThrusters: prev.rcsThrusters.map((t) => (t.id === id ? { ...t, status: 'FIRING' } : t)),
    }));

    setTimeout(() => {
      setAttitude((prev) => ({
        ...prev,
        rcsThrusters: prev.rcsThrusters.map((t) => (t.id === id ? { ...t, status: 'IDLE' } : t)),
      }));
    }, 400);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="p-6 rounded-xl hud-panel space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-500/40 font-mono">
            ADCS // GIMBAL STABILIZATION
          </span>
          <span className="text-xs text-cyan-400 font-mono">EULER & QUATERNION VECTOR SPACE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          SPACECRAFT ATTITUDE DETERMINATION & RCS PULSE MATRIX
        </h1>
        <p className="text-xs text-gray-400">
          Unit hypercomplex quaternion matrix representation q = [q0, q1, q2, q3] and 16-nozzle hypergolic pulse thruster actuation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Euler & Quaternion Vector Card */}
        <div className="p-6 rounded-xl hud-panel space-y-4 font-mono text-xs">
          <h2 className="text-sm font-bold text-cyan-400 border-b border-white/10 pb-2">
            UNIT QUATERNION VECTOR (S³ 3-SPHERE)
          </h2>

          <div className="p-4 rounded bg-black/50 border border-cyan-500/30 text-center font-bold text-base text-cyan-300">
            q = [{attitude.q0.toFixed(4)}, {attitude.q1.toFixed(4)}i, {attitude.q2.toFixed(4)}j, {attitude.q3.toFixed(4)}k]
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded bg-white/5 border border-white/10">
              <span className="text-gray-400 block text-[10px]">ROLL (φ)</span>
              <span className="text-lg font-bold text-white">{attitude.rollDeg}°</span>
            </div>
            <div className="p-3 rounded bg-white/5 border border-white/10">
              <span className="text-gray-400 block text-[10px]">PITCH (θ)</span>
              <span className="text-lg font-bold text-amber-400">{attitude.pitchDeg}°</span>
            </div>
            <div className="p-3 rounded bg-white/5 border border-white/10">
              <span className="text-gray-400 block text-[10px]">YAW (ψ)</span>
              <span className="text-lg font-bold text-purple-400">{attitude.yawDeg}°</span>
            </div>
          </div>
        </div>

        {/* RCS Thrusters Matrix */}
        <div className="p-6 rounded-xl hud-panel space-y-4 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <h2 className="text-sm font-bold text-amber-400">
              REACTION CONTROL SYSTEM (RCS) THRUSTERS
            </h2>
            <span className="text-[10px] text-gray-400">COLD GAS & MONOPROPELLANT</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {attitude.rcsThrusters.map((th) => (
              <div key={th.id} className="p-3 rounded bg-black/40 border border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">THRUSTER #{th.id}</span>
                  <span className="text-cyan-400">{th.axis}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Pulse: {th.pulseMs}ms</span>
                  <span className={th.status === 'FIRING' ? 'text-amber-400 font-bold animate-pulse' : 'text-gray-400'}>
                    {th.status}
                  </span>
                </div>
                <button
                  onClick={() => fireThruster(th.id)}
                  className="w-full py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-300 text-[10px] font-bold"
                >
                  TEST FIRE
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
