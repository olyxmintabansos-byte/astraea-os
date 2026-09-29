import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Astraea OS | Aerospace Flight Dynamics & RK4 Orbital Mechanics',
  description: 'Colossus #1: 4th-Order Runge-Kutta orbital integrator, multi-stage launch ascent telemetry, and hypersonic atmospheric reentry simulation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#030308] text-[#e2e8f0] min-h-screen flex flex-col space-grid selection:bg-cyan-500 selection:text-black">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
