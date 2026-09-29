'use client';

import React from 'react';
import { ExternalLink, Terminal, ShieldAlert } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-cyan-500/20 bg-[#020206] text-gray-400 font-mono text-xs py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div>
            <div className="text-cyan-400 font-bold mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              <span>ASTRAEA.OS CORE</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              4th-Order Runge-Kutta numerical integrator with J2 Earth gravitational oblateness and hypersonic aerothermodynamic reentry modeling.
            </p>
          </div>

          <div>
            <div className="text-cyan-400 font-bold mb-2">ASTRODYNAMICS SUITE</div>
            <ul className="text-[11px] space-y-1 text-gray-400">
              <li>• Vis-Viva semi-major axis solver</li>
              <li>• Chapman stagnation heat flux equation</li>
              <li>• Unit quaternion attitude matrix</li>
            </ul>
          </div>

          <div>
            <div className="text-cyan-400 font-bold mb-2">SOVEREIGN FLEET</div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Colossus #1 of The 5 Colossi Sovereign Suite. Deployed under organization <strong className="text-white">olyxmintabansos-byte</strong>.
            </p>
          </div>

          <div>
            <div className="text-cyan-400 font-bold mb-2">REPO ARTIFACT</div>
            <div className="p-3 rounded bg-cyan-950/20 border border-cyan-500/30">
              <a
                href="https://github.com/olyxmintabansos-byte/astraea-os"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>olyxmintabansos-byte/astraea-os</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
          <p>© 2026 ASTRAEA FLIGHT DYNAMICS • ALL SYSTEMS NOMINAL</p>
          <span className="text-cyan-400">ARCHITECT: ANTIGRAVITY</span>
        </div>
      </div>
    </footer>
  );
}
