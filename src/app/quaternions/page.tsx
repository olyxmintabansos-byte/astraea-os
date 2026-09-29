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
  RotateCcw,
  Sun,
  Globe2,
  Radio
} from 'lucide-react';
import { AttitudeQuaternion, ReactionWheelState } from '@/lib/types';

function normalizeQuaternion(q: [number, number, number, number]): [number, number, number, number] {
  const norm = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  if (norm < 1e-6) return [1, 0, 0, 0];
  return [q[0] / norm, q[1] / norm, q[2] / norm, q[3] / norm];
}

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
  const q2 = cr * cp * cy + sr * sp * sy;
  const q3 = cr * cp * sy - sr * sp * cy;

  return normalizeQuaternion([q0, q1, q2, q3]);
}

function quaternionToEuler(q: [number, number, number, number]): [number, number, number] {
  const [q0, q1, q2, q3] = q;

  const sinr_cosp = 2 * (q0 * q1 + q2 * q3);
  const cosr_cosp = 1 - 2 * (q1 * q1 + q2 * q2);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  const sinp = 2 * (q0 * q2 - q3 * q1);
  let pitch: number;
  if (Math.abs(sinp) >= 1) {
    pitch = (Math.PI / 2) * Math.sign(sinp);
  } else {
    pitch = Math.asin(sinp);
  }

  const siny_cosp = 2 * (q0 * q3 + q1 * q2);
  const cosy_cosp = 1 - 2 * (q2 * q2 + q3 * q3);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  return [
    (roll * 180) / Math.PI,
    (pitch * 180) / Math.PI,
    (yaw * 180) / Math.PI,
  ];
}

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

  const [q, setQ] = useState<[number, number, number, number]>([0.7071, 0.0, 0.7071, 0.0]);
  const [angularRate, setAngularRate] = useState<[number, number, number]>([0.001, -0.002, 0.0005]);
  const [hydrazineKg, setHydrazineKg] = useState<number>(48.2);

  const [slerpActive, setSlerpActive] = useState<boolean>(false);
  const [slerpProgress, setSlerpProgress] = useState<number>(0);
  const slerpStartRef = useRef<[number, number, number, number]>([0.7071, 0.0, 0.7071, 0.0]);
  const slerpEndRef = useRef<[number, number, number, number]>([1, 0, 0, 0]);

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

  const [reactionWheels, setReactionWheels] = useState<ReactionWheelState[]>([
    { axis: 'X', rpm: 3420, maxRpm: 6000, torqueNm: 0.045, saturated: false },
    { axis: 'Y', rpm: -2180, maxRpm: 6000, torqueNm: -0.028, saturated: false },
    { axis: 'Z', rpm: 4850, maxRpm: 6000, torqueNm: 0.082, saturated: false },
  ]);

  const [roll, pitch, yaw] = quaternionToEuler(q);

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

  const fireThruster = (id: number, pulseMs = 80) => {
    setHydrazineKg((prev) => Math.max(0, prev - (pulseMs / 1000) * 0.024));

    setRcsThrusters((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'FIRING', pulseMs } : t))
    );

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

  const triggerSlew = (targetQ: [number, number, number, number]) => {
    slerpStartRef.current = q;
    slerpEndRef.current = targetQ;
    setSlerpProgress(0);
    setSlerpActive(true);
  };

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

  const desaturateWheels = () => {
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

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Subtle radar circle
    ctx.strokeStyle = '#141d2e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.stroke();

    const transformPoint = (p: [number, number, number]): [number, number, number] => {
      const x = dcm[0][0] * p[0] + dcm[0][1] * p[1] + dcm[0][2] * p[2];
      const y = dcm[1][0] * p[0] + dcm[1][1] * p[1] + dcm[1][2] * p[2];
      const z = dcm[2][0] * p[0] + dcm[2][1] * p[1] + dcm[2][2] * p[2];
      return [x, y, z];
    };

    const project = (p3: [number, number, number]): [number, number] => {
      const scale = 1.1;
      return [cx + p3[0] * scale, cy - p3[1] * scale];
    };

    const s = 42;
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

    const lw1 = transformPoint([-s, 0, 0]);
    const lw2 = transformPoint([-s - 90, -22, 0]);
    const lw3 = transformPoint([-s - 90, 22, 0]);

    const rw1 = transformPoint([s, 0, 0]);
    const rw2 = transformPoint([s + 90, -22, 0]);
    const rw3 = transformPoint([s + 90, 22, 0]);

    const transformedBody = bodyVertices.map(transformPoint);

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    // Panels
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;

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

    // Body
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    edges.forEach(([i, j]) => {
      const p1 = project(transformedBody[i]);
      const p2 = project(transformedBody[j]);
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    });

    // Triad vectors
    const origin = project([0, 0, 0]);
    const axisLen = 75;

    // X (Red)
    const xAxis3 = transformPoint([axisLen, 0, 0]);
    const pX = project(xAxis3);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin[0], origin[1]);
    ctx.lineTo(pX[0], pX[1]);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('+X (ROLL)', pX[0] + 4, pX[1]);

    // Y (Green)
    const yAxis3 = transformPoint([0, axisLen, 0]);
    const pY = project(yAxis3);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin[0], origin[1]);
    ctx.lineTo(pY[0], pY[1]);
    ctx.stroke();
    ctx.fillStyle = '#10b981';
    ctx.fillText('+Y (PITCH)', pY[0] + 4, pY[1]);

    // Z (Cyan)
    const zAxis3 = transformPoint([0, 0, axisLen]);
    const pZ = project(zAxis3);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin[0], origin[1]);
    ctx.lineTo(pZ[0], pZ[1]);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('+Z (YAW)', pZ[0] + 4, pZ[1]);
  }, [dcm, rcsThrusters]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 font-mono select-none">
      {/* Top Console Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-2 py-0.2 rounded bg-[#1e1329] border border-[#44295e] text-purple-300 font-bold">
              ADCS // ATTITUDE DETERMINATION & CONTROL
            </span>
            <span className="text-[11px] text-gray-400">
              UNIT QUATERNION S³ • GIMBAL-LOCK IMMUNE • 16-RCS THRUSTERS
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            SPACECRAFT ATTITUDE QUATERNION & RCS CONSOLE
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={desaturateWheels}
            className="px-3 py-1.5 rounded font-bold border transition-colors bg-[#1e1329] hover:bg-[#2e1c3f] border-[#44295e] text-purple-300 flex items-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>DESATURATE WHEELS (MTQ)</span>
          </button>

          <button
            onClick={() => {
              setQ([0.7071, 0, 0.7071, 0]);
              setSlerpActive(false);
            }}
            className="p-1.5 rounded bg-[#06080e] hover:bg-white/5 border border-[#1a2333] text-gray-400 hover:text-white"
            title="Reset Attitude"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quaternion & Euler Telemetry Banner */}
      <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
          <div>
            <span className="text-gray-500 text-[10px] block">UNIT QUATERNION VECTOR (S³ 3-SPHERE):</span>
            <div className="text-lg font-bold text-cyan-300 tracking-wider">
              q = [{q[0].toFixed(4)}, {q[1].toFixed(4)}i, {q[2].toFixed(4)}j, {q[3].toFixed(4)}k]
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#0e1a14] border border-[#1b432e] text-emerald-400 font-bold self-start sm:self-center">
            ‖q‖ = 1.0000 (UNITARY CONSTRAINT)
          </span>
        </div>

        {/* Roll, Pitch, Yaw Euler */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-[#06080e] border border-white/5 rounded space-y-0.5">
            <span className="text-[10px] text-gray-500 block">ROLL (φ // X-AXIS)</span>
            <div className="text-2xl font-bold text-red-400">{roll.toFixed(2)}°</div>
            <span className="text-[9px] text-gray-500">Rate: {(angularRate[0] * 1000).toFixed(1)} mrad/s</span>
          </div>

          <div className="p-3 bg-[#06080e] border border-white/5 rounded space-y-0.5">
            <span className="text-[10px] text-gray-500 block">PITCH (θ // Y-AXIS)</span>
            <div className="text-2xl font-bold text-emerald-400">{pitch.toFixed(2)}°</div>
            <span className="text-[9px] text-gray-500">Continuous S³ Manifold</span>
          </div>

          <div className="p-3 bg-[#06080e] border border-white/5 rounded space-y-0.5">
            <span className="text-[10px] text-gray-500 block">YAW (ψ // Z-AXIS)</span>
            <div className="text-2xl font-bold text-cyan-300">{yaw.toFixed(2)}°</div>
            <span className="text-[9px] text-gray-500">Rate: {(angularRate[2] * 1000).toFixed(1)} mrad/s</span>
          </div>
        </div>
      </div>

      {/* Main Row: 3D Attitude Canvas (7 Cols) + DCM & RWA (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 3D Wireframe Canvas (7 Cols) */}
        <div className="lg:col-span-7 p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-white font-bold flex items-center gap-1.5">
              <Rotate3d className="w-4 h-4 text-purple-400" />
              3D SPACECRAFT BODY ATTITUDE
            </span>
            {slerpActive && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                SLERP SLEW {(slerpProgress * 100).toFixed(0)}%
              </span>
            )}
          </div>

          <div className="bg-[#06080e] rounded border border-white/5 p-2 flex items-center justify-center min-h-[320px]">
            <canvas ref={canvasRef} width={500} height={300} className="w-full max-w-[500px] h-[280px]" />
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] text-gray-500 block">SLERP AUTONOMOUS SLEW TARGET PRESETS:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => triggerSlew([1, 0, 0, 0])}
                className="p-2 rounded bg-[#06080e] hover:bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>LVLH ZERO</span>
              </button>
              <button
                onClick={() => triggerSlew([0.7071, 0.7071, 0, 0])}
                className="p-2 rounded bg-[#06080e] hover:bg-white/5 border border-white/10 text-amber-300 font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>SUN POINT</span>
              </button>
              <button
                onClick={() => triggerSlew([0.7071, 0, 0.7071, 0])}
                className="p-2 rounded bg-[#06080e] hover:bg-white/5 border border-white/10 text-cyan-300 font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>EARTH NADIR</span>
              </button>
              <button
                onClick={() => triggerSlew([0, 0, 1, 0])}
                className="p-2 rounded bg-[#06080e] hover:bg-white/5 border border-white/10 text-purple-300 font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <span>DSN COMM</span>
              </button>
            </div>
          </div>
        </div>

        {/* DCM & Reaction Wheels (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 text-xs">
          {/* DCM 3x3 */}
          <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-2">
            <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                DIRECTION COSINE MATRIX (DCM 3×3)
              </span>
              <span className="text-[10px] text-gray-500">ORTHOGONAL</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              {dcm.map((row, rIdx) =>
                row.map((val, cIdx) => (
                  <div key={`${rIdx}-${cIdx}`} className="p-1.5 rounded bg-[#06080e] border border-white/5">
                    <span className="text-[8px] text-gray-500 block">C[{rIdx+1},{cIdx+1}]</span>
                    <span className={val >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {val >= 0 ? `+${val.toFixed(3)}` : val.toFixed(3)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center p-2 bg-[#06080e] border border-white/5 rounded text-[11px] mt-1">
              <span className="text-gray-500">HYDRAZINE MONOPROPELLANT:</span>
              <span className="font-bold text-amber-400">{hydrazineKg.toFixed(2)} KG</span>
            </div>
          </div>

          {/* Reaction Wheels */}
          <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-2">
            <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
              <span className="text-purple-400 font-bold flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-purple-400" />
                REACTION WHEEL ASSEMBLY (RWA)
              </span>
              <span className="text-[10px] text-gray-500">LIMIT: ±6,000 RPM</span>
            </div>

            <div className="space-y-2">
              {reactionWheels.map((wheel) => {
                const rpmRatio = Math.abs(wheel.rpm) / wheel.maxRpm;
                return (
                  <div key={wheel.axis} className="p-2 bg-[#06080e] border border-white/5 rounded space-y-1">
                    <div className="flex justify-between text-white font-medium text-[11px]">
                      <span>WHEEL #{wheel.axis}</span>
                      <span className={rpmRatio > 0.8 ? 'text-red-400' : 'text-purple-300'}>
                        {wheel.rpm > 0 ? `+${wheel.rpm}` : wheel.rpm} RPM
                      </span>
                    </div>
                    <div className="w-full h-1 bg-[#141b29] rounded overflow-hidden">
                      <div
                        className={`h-full ${rpmRatio > 0.8 ? 'bg-red-500' : 'bg-purple-500'}`}
                        style={{ width: `${Math.min(100, rpmRatio * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 16-Thruster RCS Pulse Matrix */}
      <div className="p-4 bg-[#0a0e17] border border-[#1a2333] rounded-lg space-y-3 text-xs">
        <div className="flex justify-between items-center border-b border-white/10 pb-2">
          <span className="text-amber-400 font-bold flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            16-NOZZLE RCS PULSE ACTUATOR MATRIX
          </span>
          <span className="text-gray-500">4 QUAD PODS • PWM PULSES</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {rcsThrusters.map((th) => (
            <div
              key={th.id}
              className={`p-2 rounded border space-y-1 transition-colors ${
                th.status === 'FIRING' ? 'bg-[#2b1f0c] border-amber-400' : 'bg-[#06080e] border-white/5'
              }`}
            >
              <div className="flex justify-between text-[10px]">
                <span className="font-bold text-white">#{th.id}</span>
                <span className="text-cyan-400 font-bold">{th.axis}</span>
              </div>
              <button
                onClick={() => fireThruster(th.id, 80)}
                className={`w-full py-1 rounded text-[10px] font-bold border transition-colors ${
                  th.status === 'FIRING'
                    ? 'bg-amber-400 text-black border-amber-400'
                    : 'bg-[#1e1329] hover:bg-[#2e1c3f] border-[#44295e] text-purple-300'
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
