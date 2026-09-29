'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Rocket, Orbit, Flame, Compass, Volume2, VolumeX, Radio, CheckCircle2 } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [metSeconds, setMetSeconds] = useState<number>(14820);
  const [utcTime, setUtcTime] = useState<string>('00:00:00 UTC');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setMetSeconds((prev) => prev + 1);
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${h}:${m}:${s} ZULU`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatMet = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `T+${hours.toString().padStart(3, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const playBeep = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(960, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch {
      // Ignored
    }
  };

  const routes = [
    { href: '/', label: 'ORBITAL MECHANICS (3D)', icon: Orbit, badge: 'RK4' },
    { href: '/ascent/', label: 'ASCENT & PROPULSION', icon: Rocket, badge: '9-ENG' },
    { href: '/reentry/', label: 'REENTRY & BLACKOUT', icon: Flame, badge: 'MACH 25' },
    { href: '/quaternions/', label: 'ADCS & QUATERNIONS', icon: Compass, badge: 'S³ RCS' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#090d14] border-b border-[#1a2333] font-mono select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand & Callsign */}
          <Link href="/" onClick={playBeep} className="flex items-center gap-3 group">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-extrabold text-sm tracking-wider text-white">
                ASTRAEA<span className="text-cyan-400"> // COLOSSUS-01</span>
              </span>
            </div>
            <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded bg-[#131b29] border border-[#223147] text-gray-400 font-medium">
              NORAD #62914
            </span>
          </Link>

          {/* Nav Workstation Tabs */}
          <nav className="hidden lg:flex items-center space-x-1">
            {routes.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={playBeep}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors border ${
                    isActive
                      ? 'bg-[#162338] text-cyan-300 border-[#2b4266] font-bold'
                      : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded ${isActive ? 'bg-cyan-950 text-cyan-300' : 'bg-white/5 text-gray-500'}`}>
                    {item.badge}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Telemetry Clock & Comms */}
          <div className="flex items-center gap-3 text-xs">
            {/* UTC & MET Readout */}
            <div className="hidden sm:flex items-center gap-3 px-2.5 py-1 rounded bg-[#06080e] border border-[#1a2333] text-[11px]">
              <div className="text-gray-400">
                <span className="text-[9px] text-gray-500 mr-1.5">MET:</span>
                <span className="text-amber-400 font-bold">{formatMet(metSeconds)}</span>
              </div>
              <div className="h-3 w-[1px] bg-white/10" />
              <div className="text-gray-400">
                <span className="text-white font-medium">{utcTime}</span>
              </div>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Avionics Audio: ACTIVE' : 'Avionics Audio: MUTED'}
              className={`p-1.5 rounded border transition-colors ${
                soundEnabled
                  ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                  : 'border-[#1a2333] bg-[#06080e] text-gray-500 hover:text-gray-300'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* GNC Status Pill */}
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0a1612] border border-[#143d2c] text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>GNC: NOMINAL</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
