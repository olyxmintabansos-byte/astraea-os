'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Rocket, Orbit, Flame, Compass, ShieldAlert, Cpu } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const routes = [
    { href: '/', label: 'RK4 ORBIT DYNAMICS', icon: Orbit, badge: '500 KM LEO' },
    { href: '/ascent/', label: 'MULTI-STAGE ASCENT', icon: Rocket, badge: 'MECO/SECO' },
    { href: '/reentry/', label: 'HYPERSONIC REENTRY', icon: Flame, badge: 'MACH 21' },
    { href: '/quaternions/', label: 'ATTITUDE & RCS', icon: Compass, badge: 'QUATERNION' },
  ];

  return (
    <header className="sticky top-0 z-50 hud-panel border-b border-cyan-500/30 bg-[#030308]/90">
      <div className="h-0.5 w-full bg-gradient-to-r from-cyan-400 via-amber-400 to-purple-500" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded bg-cyan-950/60 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,245,212,0.2)]">
              <Rocket className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider text-white">
                  ASTRAEA<span className="text-cyan-400">.OS</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  COLOSSUS #1
                </span>
              </div>
              <p className="text-[10px] text-gray-400 tracking-tighter">
                AEROSPACE DYNAMICS & RK4 ORBITAL SOLVER
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-2">
            {routes.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono tracking-wider transition-all border ${
                    isActive
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(0,245,212,0.3)]'
                      : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded ${isActive ? 'bg-cyan-400 text-black font-bold' : 'bg-white/10 text-gray-400'}`}>
                    {item.badge}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="hidden sm:inline">SOLVER:</span>
            <span className="font-bold text-white">RK4 ACTIVE</span>
          </div>
        </div>
      </div>
    </header>
  );
}
