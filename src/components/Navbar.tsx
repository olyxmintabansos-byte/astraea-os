'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Rocket, Orbit, Flame, Compass, Volume2, VolumeX, Radio, ShieldCheck, Activity } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [metSeconds, setMetSeconds] = useState<number>(14820); // Mission Elapsed Time
  const [utcTime, setUtcTime] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  // Live UTC & MET clock
  useEffect(() => {
    const timer = setInterval(() => {
      setMetSeconds((prev) => prev + 1);
      const now = new Date();
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format MET: T+004:07:00
  const formatMet = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `T+${hours.toString().padStart(3, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Synthesized avionics chirp sound using Web Audio API
  const playBeep = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
      // Audio not permitted or supported
    }
  };

  const routes = [
    { href: '/', label: 'RK4 ORBIT DYNAMICS', icon: Orbit, badge: '500 KM LEO' },
    { href: '/ascent/', label: 'MULTI-STAGE ASCENT', icon: Rocket, badge: 'MECO/SECO' },
    { href: '/reentry/', label: 'HYPERSONIC REENTRY', icon: Flame, badge: 'MACH 21' },
    { href: '/quaternions/', label: 'ATTITUDE & RCS', icon: Compass, badge: 'QUATERNION' },
  ];

  return (
    <header className="sticky top-0 z-50 hud-panel border-b border-cyan-500/30 bg-[#030308]/95 backdrop-blur-xl">
      {/* Laser horizon top accent */}
      <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-amber-400 to-purple-500 shadow-[0_0_8px_rgba(0,245,212,0.8)]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Mission Callsign */}
          <Link href="/" onClick={playBeep} className="flex items-center gap-3 group">
            <div className="relative p-2 rounded-lg bg-cyan-950/60 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,245,212,0.25)] group-hover:border-cyan-300 transition-all">
              <Rocket className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider text-white">
                  ASTRAEA<span className="text-cyan-400">.OS</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  COLOSSUS #1
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono tracking-tighter">
                <span className="text-cyan-400 font-bold">NORAD #62914</span>
                <span>•</span>
                <span>FLIGHT DYNAMICS</span>
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-2">
            {routes.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={playBeep}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono tracking-wider transition-all border ${
                    isActive
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(0,245,212,0.35)]'
                      : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5 hover:border-cyan-500/20'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded ${
                    isActive ? 'bg-cyan-400 text-black font-extrabold' : 'bg-white/10 text-gray-400'
                  }`}>
                    {item.badge}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Real-Time Clocks & Audio Toggle */}
          <div className="flex items-center gap-3">
            {/* Mission Elapsed Time */}
            <div className="hidden sm:flex flex-col items-end px-2.5 py-1 rounded bg-black/60 border border-cyan-500/20 font-mono">
              <span className="text-[9px] text-gray-500 leading-none">MISSION ELAPSED</span>
              <span className="text-xs font-bold text-amber-400 tracking-wider">
                {formatMet(metSeconds)}
              </span>
            </div>

            {/* Audio Feedback Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playBeep();
              }}
              title={soundEnabled ? 'Telemetry Audio: ON' : 'Telemetry Audio: MUTED'}
              className="p-1.5 rounded border border-cyan-500/30 bg-black/40 text-cyan-400 hover:border-cyan-400 transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-300" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
            </button>

            {/* Solver Telemetry Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="hidden lg:inline text-[10px] text-gray-400">PROPAGATOR:</span>
              <span className="font-bold text-cyan-300">RK4 J2</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
