'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Rotate3d, 
  Compass, 
  Zap, 
  ShieldCheck, 
  Sliders, 
  Layers, 
  Activity, 
  Crosshair, 
  Play, 
  Pause, 
  RotateCcw,
  Sun,
  Globe2,
  Radio,
  Volume2,
  VolumeX
} from 'lucide-react';
import { AttitudeQuaternion, ReactionWheelState } from '@/lib/types';

// Audio chirp generator
const playRcsThump = (duration = 0.08) => {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // blocked or not supported
  }
};

// Quaternion normalization helper
function normalizeQuaternion(q: [number, number, number, number]): [number, number, number, number] {
  const norm = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  if (norm < 1e-6) return [1, 0, 0, 0];
  return [q[0] / norm, q[1] / norm, q[2] / norm, q[3] / norm];
}

// Convert Euler (roll, pitch, yaw in degrees) to Quaternion [q0, q1, q2, q3]
function eulerToQuaternion(rollDeg: number, pitchDeg: number, yawDeg: number): [number, number, number, number] {
  const r = (rollDeg * Math.PI) / 360;
  const p = (pitchDeg * Math.PI) / 360;
  const y = (yawDeg * Math.PI) / 360;

  const cr = Math.cos(r);
  const sr = Math.sin(r);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cy = Math.cos(y);
  const sy = Math.sin(y);

  const q0 = cr * cp * cy + sr * sp * sy;
  const q1 = sr * cp * cy - cr * sp * sy;
  const q2 = cr * sp * cy + sr * cp * sy;
  const q3 = cr * cp * sy - sr * sp * cy;

  return normalizeQuaternion([q0, q1, q2, q3]);
}

// Convert Quaternion to Euler angles (degrees)
function quaternionToEuler(q: [number, number, number, number]): [number, number, number] {
  const [q0, q1, q2, q3] = q;

  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (q0 * q1 + q2 * q3);
  const cosr_cosp = 1 - 2 * (q1 * q1 + q2 * q2);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  // Pitch (y-axis rotation)
  const sinp = 2 * (q0 * q2 - q3 * q1);
  let pitch: number;
  if (Math.abs(sinp) >= 1) {
    pitch = (Math.PI / 2) * Math.sign(sinp); // Gimbal lock singularity
  } else {
    pitch = Math.asin(sinp);
  }

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (q0 * q3 + q1 * q2);
  const cosy_cosp = 1 - 2 * (q2 * q2 + q3 * q3);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  return [
    (roll * 180) / Math.PI,
    (pitch * 180) / Math.PI,
    (yaw * 180) / Math.PI,
  ];
}

// SLERP between two quaternions
function slerp(
  qa: [number, number, number, number],
  qb: [number, number, number, number],
  t: number
): [number, number, number, number] {
  let cosHalfTheta = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3];

  let targetB = [...qb] as [number, number, number, number];
  if (cosHalfTheta < 0) {
    targetB = [-qb[0], -qb[1], -qb[2], -qb[3]];
    cosHalfTheta = -cosHalfTheta;
  }

  if (Math.abs(cosHalfTheta) >= 1.0) {
    return qa;
  }

  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

  if (Math.abs(sinHalfTheta) < 0.001) {
    return [
      qa[0] * 0.5 + targetB[0] * 0.5,
      qa[1] * 0.5 + targetB[1] * 0.5,
      qa[2] * 0.5 + targetB[2] * 0.5,
      qa[3] * 0.5 + targetB[3] * 0.5,
    ];
  }

  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

  return normalizeQuaternion([
    qa[0] * ratioA + targetB[0] * ratioB,
    qa[1] * ratioA + targetB[1] * ratioB,
    qa[2] * ratioA + targetB[2] * ratioB,
    qa[3] * ratioA + targetB[3] * ratioB,
  ]);
}

export default function AttitudeQuaternionsPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Current quaternion state [q0, q1, q2, q3]
  const [q, setQ] = useState<[number, number, number, number]>([0.7071, 0.0, 0.7071, 0.0]);
  const [angularRate, setAngularRate] = useState<[number, number, number]>([0.001, -0.002, 0.0005]);
  const [hydrazineKg, setHydrazineKg] = useState<number>(48.2);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Target attitude presets for SLERP slewing
  const [slerpActive, setSlerpActive] = useState<boolean>(false);
  const [slerpProgress, setSlerpProgress] = useState<number>(0);
  const slerpStartRef = useRef<[number, number, number, number]>([0.7071, 0.0, 0.7071, 0.0]);
  const slerpEndRef = useRef<[number, number, number, number]>([1, 0, 0, 0]);

  // 16 RCS Thrusters configuration (4 clusters of 4 thrusters)
  const [rcsThrusters, setRcsThrusters] = useState<
    { id: number; pod: string; axis: '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z'; status: 'IDLE' | 'FIRING'; pulseMs: number }[]
  >(
    Array.from({ length: 16 }).map((_, i) => {
      const podId = Math.floor(i / 4) + 1;
      const axes: ('+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z')[] = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];
      return {
        id: i + 1,
        pod: `POD-${podId}`,
        axis: axes[i % axes.length],
        status: 'IDLE',
        pulseMs: 50,
      };
    })
  );

  // Reaction Wheels State (X, Y, Z)
  const [reactionWheels, setReactionWheels] = useState<ReactionWheelState[]>([
    { axis: 'X', rpm: 3420, maxRpm: 6000, torqueNm: 0.045, saturated: false },
    { axis: 'Y', rpm: -2180, maxRpm: 6000, torqueNm: -0.028, saturated: false },
    { axis: 'Z', rpm: 4850, maxRpm: 6000, torqueNm: 0.082, saturated: false },
  ]);

  // Euler angles derived from quaternion
  const [roll, pitch, yaw] = quaternionToEuler(q);

  // Direction Cosine Matrix (3x3)
  const dcm = [
    [
      1 - 2 * (q[2] * q[2] + q[3] * q[3]),
      2 * (q[1] * q[2] - q[0] * q[3]),
      2 * (q[1] * q[3] + q[0] * q[2]),
    ],
    [
      2 * (q[1] * q[2] + q[0] * q[3]),
      1 - 2 * (q[1] * q[1] + q[3] * q[3]),
      2 * (q[2] * q[3] - q[0] * q[1]),
    ],
    [
      2 * (q[1] * q[3] - q[0] * q[2]),
      2 * (q[2] * q[3] + q[0] * q[1]),
      1 - 2 * (q[1] * q[1] + q[2] * q[2]),
    ],
  ];

  // Fire specific thruster
  const fireThruster = (id: number, pulseMs = 80) => {
    if (soundEnabled) playRcsThump(pulseMs / 1000);
    setHydrazineKg((prev) => Math.max(0, prev - (pulseMs / 1000) * 0.024));

    setRcsThrusters((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'FIRING', pulseMs } : t))
    );

    // Apply incremental impulse rotation
    const thruster = rcsThrusters.find((t) => t.id === id);
    if (thruster) {
      const impulse = 0.015;
      let dRoll = 0, dPitch = 0, dYaw = 0;
      if (thruster.axis === '+X') dRoll = impulse;
      if (thruster.axis === '-X') dRoll = -impulse;
      if (thruster.axis === '+Y') dPitch = impulse;
      if (thruster.axis === '-Y') dPitch = -impulse;
      if (thruster.axis === '+Z') dYaw = impulse;
      if (thruster.axis === '-Z') dYaw = -impulse;

      const newQ = eulerToQuaternion(roll + dRoll * 10, pitch + dPitch * 10, yaw + dYaw * 10);
      setQ(newQ);
    }

    setTimeout(() => {
      setRcsThrusters((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'IDLE' } : t))
      );
    }, pulseMs);
  };

  // Trigger Slew Maneuver with SLERP
  const triggerSlew = (targetQ: [number, number, number, number], name: string) => {
    slerpStartRef.current = q;
    slerpEndRef.current = targetQ;
    setSlerpProgress(0);
    setSlerpActive(true);
    if (soundEnabled) playRcsThump(0.12);
  };

  // SLERP animation tick
  useEffect(() => {
    if (!slerpActive) return;
    const interval = setInterval(() => {
      setSlerpProgress((prev) => {
        const next = prev + 0.04;
        if (next >= 1.0) {
          setQ(slerpEndRef.current);
          setSlerpActive(false);
          return 1.0;
        }
        setQ(slerp(slerpStartRef.current, slerpEndRef.current, next));
        return next;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [slerpActive]);

  // Magnetic Desaturation of Reaction Wheels
  const desaturateWheels = () => {
    if (soundEnabled) playRcsThump(0.2);
    setReactionWheels((prev) =>
      prev.map((w) => ({
        ...w,
        rpm: Math.round(w.rpm * 0.25),
        torqueNm: Number((w.torqueNm * 0.25).toFixed(3)),
      }))
    );
  };

  // 3D Wireframe Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle circular radar reticle
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.arc(cx, cy, 70, 0, Math.PI * 2);
      ctx.stroke();

      // Transform 3D point using DCM
      const transformPoint = (p: [number, number, number]): [number, number, number] => {
        const x = dcm[0][0] * p[0] + dcm[0][1] * p[1] + dcm[0][2] * p[2];
        const y = dcm[1][0] * p[0] + dcm[1][1] * p[1] + dcm[1][2] * p[2];
        const z = dcm[2][0] * p[0] + dcm[2][1] * p[1] + dcm[2][2] * p[2];
        return [x, y, z];
      };

      // Project 3D onto 2D screen
      const project = (p3: [number, number, number]): [number, number] => {
        const scale = 1.15;
        return [cx + p3[0] * scale, cy - p3[1] * scale];
      };

      // Spacecraft Body Cube Vertices [-w..w]
      const s = 45;
      const bodyVertices: [number, number, number][] = [
        [-s, -s, -s],
        [s, -s, -s],
        [s, s, -s],
        [-s, s, -s],
        [-s, -s, s],
        [s, -s, s],
        [s, s, s],
        [-s, s, s],
      ];

      // Solar Array Wing Vertices (Left Wing)
      const lw1 = transformPoint([-s, 0, 0]);
      const lw2 = transformPoint([-s - 100, -25, 0]);
      const lw3 = transformPoint([-s - 100, 25, 0]);

      // Solar Array Wing Vertices (Right Wing)
      const rw1 = transformPoint([s, 0, 0]);
      const rw2 = transformPoint([s + 100, -25, 0]);
      const rw3 = transformPoint([s + 100, 25, 0]);

      // Transform body vertices
      const transformedBody = bodyVertices.map(transformPoint);

      // Edges of the cube
      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0], // Back
        [4, 5], [5, 6], [6, 7], [7, 4], // Front
        [0, 4], [1, 5], [2, 6], [3, 7], // Connecting
      ];

      // Draw Solar Panels
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;

      // Left Panel
      ctx.beginPath();
      const pLw1 = project(lw1);
      const pLw2 = project(lw2);
      const pLw3 = project(lw3);
      ctx.moveTo(pLw1[0], pLw1[1]);
      ctx.lineTo(pLw2[0], pLw2[1]);
      ctx.lineTo(pLw3[0], pLw3[1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right Panel
      ctx.beginPath();
      const pRw1 = project(rw1);
      const pRw2 = project(rw2);
      const pRw3 = project(rw3);
      ctx.moveTo(pRw1[0], pRw1[1]);
      ctx.lineTo(pRw2[0], pRw2[1]);
      ctx.lineTo(pRw3[0], pRw3[1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw Satellite Main Bus Wireframe
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      edges.forEach(([i, j]) => {
        const p1 = project(transformedBody[i]);
        const p2 = project(transformedBody[j]);
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      });

      // Draw Triad Coordinate Axes (Body Frame)
      const origin = project([0, 0, 0]);
      const axisLen = 85;

      // X-Axis (Roll / Red)
      const xAxis3 = transformPoint([axisLen, 0, 0]);
      const pX = project(xAxis3);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(pX[0], pX[1]);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('+X (ROLL)', pX[0] + 4, pX[1]);

      // Y-Axis (Pitch / Green)
      const yAxis3 = transformPoint([0, axisLen, 0]);
      const pY = project(yAxis3);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(pY[0], pY[1]);
      ctx.stroke();
      ctx.fillStyle = '#10b981';
      ctx.fillText('+Y (PITCH)', pY[0] + 4, pY[1]);

      // Z-Axis (Yaw / Cyan)
      const zAxis3 = transformPoint([0, 0, axisLen]);
      const pZ = project(zAxis3);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(pZ[0], pZ[1]);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('+Z (YAW)', pZ[0] + 4, pZ[1]);

      // Draw active RCS Thruster plume flares on the bus
      rcsThrusters.forEach((th) => {
        if (th.status === 'FIRING') {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 40, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    };

    render();
  }, [dcm, rcsThrusters]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner / ADCS Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl hud-panel">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 text-purple-300 border border-purple-500/50 flex items-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              ADCS // ATTITUDE DETERMINATION & CONTROL
            </span>
            <span className="text-xs text-cyan-400 font-mono">
              UNIT QUATERNION S³ • GIMBAL-LOCK IMMUNE • 16-RCS THRUSTERS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight glow-purple">
            SPACECRAFT ATTITUDE QUATERNION & RCS HUD
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            Real-time hypercomplex 4-parameter quaternion kinematics, 3x3 Direction Cosine Matrix (DCM), Spherical Linear Interpolation (SLERP) slewing, and hypergolic cold-gas pulse thruster actuation.
          </p>
        </div>

        {/* Audio Toggle & Desaturation Trigger */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-mono transition-all ${
              soundEnabled
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                : 'bg-black/50 border-white/10 text-gray-500 hover:text-white'
            }`}
            title="Toggle Thruster Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={desaturateWheels}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>DESATURATE WHEELS (MTQ)</span>
          </button>

          <button
            onClick={() => {
              setQ([0.7071, 0, 0.7071, 0]);
              setSlerpActive(false);
              if (soundEnabled) playRcsThump(0.08);
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white"
            title="Reset to Nominal Attitude"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quaternion Vector Pill Banner & Euler Conversion Display */}
      <div className="p-6 rounded-2xl hud-panel space-y-4 font-mono">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <span className="text-gray-400 text-xs">UNIT HYPERCOMPLEX QUATERNION (S³ 3-SPHERE):</span>
            <div className="text-xl sm:text-2xl font-black text-cyan-300 tracking-wider glow-cyan mt-0.5">
              q = [{q[0].toFixed(4)}, {q[1].toFixed(4)}i, {q[2].toFixed(4)}j, {q[3].toFixed(4)}k]
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">NORM CONSTRAINT:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
              ‖q‖ = {Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]).toFixed(4)} (UNITARY)
            </span>
          </div>
        </div>

        {/* Euler Angles Grid (Roll, Pitch, Yaw) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl bg-black/40 border border-red-500/30 space-y-1">
            <span className="text-xs text-gray-400 block">ROLL ANGLE (φ // X-AXIS)</span>
            <span className="text-3xl font-black text-red-400">{roll.toFixed(2)}°</span>
            <span className="text-[10px] text-gray-500 block">Angular Rate: {(angularRate[0] * 1000).toFixed(1)} mrad/s</span>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/30 space-y-1">
            <span className="text-xs text-gray-400 block">PITCH ANGLE (θ // Y-AXIS)</span>
            <span className="text-3xl font-black text-emerald-400">{pitch.toFixed(2)}°</span>
            <span className="text-[10px] text-gray-500 block">Singularity Free (S³ Continuous)</span>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-cyan-500/30 space-y-1">
            <span className="text-xs text-gray-400 block">YAW ANGLE (ψ // Z-AXIS)</span>
            <span className="text-3xl font-black text-cyan-300">{yaw.toFixed(2)}°</span>
            <span className="text-[10px] text-gray-500 block">Angular Rate: {(angularRate[2] * 1000).toFixed(1)} mrad/s</span>
          </div>
        </div>
      </div>

      {/* Main Dual Row: 3D Attitude Wireframe Canvas (Left) + DCM & Slew Target Controls (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 3D Wireframe Canvas Visualizer (7 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl hud-panel space-y-4 font-mono">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Rotate3d className="w-4 h-4 text-purple-400" />
                3D SPACECRAFT BODY ATTITUDE ORIENTATION
              </h2>
              <span className="text-[10px] text-gray-400">ORTHOGRAPHIC PROJECTION & COORDINATE TRIAD</span>
            </div>
            {slerpActive && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/50 animate-pulse font-bold">
                SLERP SLEWING {(slerpProgress * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {/* Interactive HTML5 Canvas */}
          <div className="relative bg-black/70 rounded-xl border border-white/10 p-2 flex items-center justify-center min-h-[380px]">
            <canvas
              ref={canvasRef}
              width={540}
              height={360}
              className="w-full max-w-[540px] h-[340px]"
            />
          </div>

          {/* Slew Maneuver Presets */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] text-gray-400 block">AUTONOMOUS SLEW MANEUVER PRESETS (SLERP):</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => triggerSlew([1, 0, 0, 0], 'IDENTITY / LVLH')}
                className="p-2.5 rounded-lg bg-black/50 hover:bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>LVLH ZERO</span>
              </button>

              <button
                onClick={() => triggerSlew([0.7071, 0.7071, 0, 0], 'SUN POINTING')}
                className="p-2.5 rounded-lg bg-black/50 hover:bg-white/5 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>SUN POINT</span>
              </button>

              <button
                onClick={() => triggerSlew([0.7071, 0, 0.7071, 0], 'EARTH NADIR')}
                className="p-2.5 rounded-lg bg-black/50 hover:bg-white/5 border border-cyan-500/30 text-cyan-300 font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>EARTH NADIR</span>
              </button>

              <button
                onClick={() => triggerSlew([0, 0, 1, 0], 'COMM RELAY DSN')}
                className="p-2.5 rounded-lg bg-black/50 hover:bg-white/5 border border-purple-500/30 text-purple-300 font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <span>DSN COMM</span>
              </button>
            </div>
          </div>
        </div>

        {/* Direction Cosine Matrix (DCM) & Reaction Wheels (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Direction Cosine Matrix 3x3 */}
          <div className="p-6 rounded-2xl hud-panel space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h2 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                DIRECTION COSINE MATRIX (DCM 3×3)
              </h2>
              <span className="text-[10px] text-gray-400">ORTHOGONAL BODY-TO-INERTIAL</span>
            </div>

            <div className="p-3 rounded-xl bg-black/50 border border-white/10 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                {dcm.map((row, rIdx) =>
                  row.map((val, cIdx) => (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      className="p-2 rounded bg-white/5 border border-white/5 font-mono text-gray-300"
                    >
                      <span className="text-[9px] text-gray-500 block">C[{rIdx+1},{cIdx+1}]</span>
                      <span className={val >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {val >= 0 ? `+${val.toFixed(3)}` : val.toFixed(3)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Propellant & Health telemetry */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-black/40 border border-white/10">
              <span className="text-gray-400">HYDRAZINE MONOPROPELLANT:</span>
              <span className="font-bold text-amber-400 text-sm">{hydrazineKg.toFixed(2)} KG</span>
            </div>
          </div>

          {/* Reaction Wheels Tachometer (X, Y, Z) */}
          <div className="p-6 rounded-2xl hud-panel space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h2 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" />
                REACTION WHEEL ASSEMBLY (RWA)
              </h2>
              <span className="text-[10px] text-gray-400">LIMIT: ±6,000 RPM</span>
            </div>

            <div className="space-y-3">
              {reactionWheels.map((wheel) => {
                const rpmRatio = Math.abs(wheel.rpm) / wheel.maxRpm;
                return (
                  <div key={wheel.axis} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                    <div className="flex justify-between text-white font-bold">
                      <span>WHEEL #{wheel.axis} FLYWHEEL</span>
                      <span className={rpmRatio > 0.8 ? 'text-red-400' : 'text-purple-300'}>
                        {wheel.rpm > 0 ? `+${wheel.rpm}` : wheel.rpm} RPM
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className={`h-full ${rpmRatio > 0.8 ? 'bg-red-500' : 'bg-purple-500'}`}
                        style={{ width: `${Math.min(100, rpmRatio * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Torque Output: {wheel.torqueNm} N·m</span>
                      <span>Margin: {(100 - rpmRatio * 100).toFixed(0)}% Headroom</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 16-Nozzle Reaction Control System (RCS) Pulse Matrix */}
      <div className="p-6 rounded-2xl hud-panel space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              16-NOZZLE REACTION CONTROL SYSTEM (RCS) PULSE ACTUATOR MATRIX
            </h2>
            <span className="text-[10px] text-gray-400">4 QUAD PODS • HYPERGOLIC COLD-GAS HYDRAZINE • PWM COMMANDS</span>
          </div>
          <span className="text-[10px] text-cyan-300">CLICK TO TEST-FIRE NOZZLE PULSE</span>
        </div>

        {/* 16-Thruster Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {rcsThrusters.map((th) => (
            <div
              key={th.id}
              className={`p-3 rounded-xl border space-y-2 transition-all ${
                th.status === 'FIRING'
                  ? 'bg-amber-950/80 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse'
                  : 'bg-black/40 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-white">#{th.id}</span>
                <span className="text-cyan-400 font-bold">{th.axis}</span>
              </div>
              <div className="text-[9px] text-gray-400">{th.pod}</div>
              <button
                onClick={() => fireThruster(th.id, 80)}
                className={`w-full py-1.5 rounded text-[10px] font-bold border transition-colors ${
                  th.status === 'FIRING'
                    ? 'bg-amber-400 text-black border-amber-400'
                    : 'bg-purple-950/60 hover:bg-purple-900 border-purple-500/40 text-purple-300'
                }`}
              >
                {th.status === 'FIRING' ? 'FIRING' : 'FIRE 80ms'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
