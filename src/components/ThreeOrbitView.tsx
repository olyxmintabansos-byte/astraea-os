'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { StateVector, KeplerianElements } from '@/lib/types';

interface ThreeOrbitViewProps {
  state: StateVector;
  keplerian: KeplerianElements;
  onDeltaV?: (dvKmS: number, label: string) => void;
}

// Procedural Earth Texture Generator (high-contrast tactical wireframe + continents)
function createEarthCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean background
  ctx.fillStyle = '#060a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Coordinate grid lines (Latitude / Longitude)
  ctx.strokeStyle = '#0f1d2e';
  ctx.lineWidth = 1;

  for (let lat = 0; lat <= canvas.height; lat += 32) {
    ctx.beginPath();
    ctx.moveTo(0, lat);
    ctx.lineTo(canvas.width, lat);
    ctx.stroke();
  }

  for (let lon = 0; lon <= canvas.width; lon += 64) {
    ctx.beginPath();
    ctx.moveTo(lon, 0);
    ctx.lineTo(lon, canvas.height);
    ctx.stroke();
  }

  // Major Continents Silhouettes (tactical vector paths normalized to 1024x512)
  ctx.fillStyle = '#16283d';
  ctx.strokeStyle = '#254466';
  ctx.lineWidth = 1.5;

  // North America
  ctx.beginPath();
  ctx.moveTo(150, 80);
  ctx.lineTo(280, 70);
  ctx.lineTo(260, 150);
  ctx.lineTo(220, 200);
  ctx.lineTo(190, 220);
  ctx.lineTo(170, 160);
  ctx.lineTo(130, 110);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // South America
  ctx.beginPath();
  ctx.moveTo(250, 230);
  ctx.lineTo(310, 260);
  ctx.lineTo(290, 360);
  ctx.lineTo(250, 420);
  ctx.lineTo(230, 330);
  ctx.lineTo(230, 250);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eurasia & Africa
  ctx.beginPath();
  ctx.moveTo(460, 80);
  ctx.lineTo(750, 70);
  ctx.lineTo(780, 160);
  ctx.lineTo(650, 180);
  ctx.lineTo(580, 150);
  ctx.lineTo(510, 130);
  ctx.lineTo(470, 100);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Africa
  ctx.beginPath();
  ctx.moveTo(480, 180);
  ctx.lineTo(580, 180);
  ctx.lineTo(580, 290);
  ctx.lineTo(520, 370);
  ctx.lineTo(470, 280);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Australia
  ctx.beginPath();
  ctx.moveTo(760, 300);
  ctx.lineTo(840, 290);
  ctx.lineTo(850, 360);
  ctx.lineTo(770, 370);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Equator line highlight
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export default function ThreeOrbitView({ state, keplerian }: ThreeOrbitViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const satelliteMeshRef = useRef<THREE.Group | null>(null);
  const orbitLineRef = useRef<THREE.Line | null>(null);

  // Camera interactive rotation & zoom
  const [cameraDistance, setCameraDistance] = useState<number>(4.2);
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraRotRef = useRef<{ theta: number; phi: number }>({ theta: 0.6, phi: 1.1 });

  // Initialize Three.js scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 450;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    cameraRef.current = camera;

    // Renderer with antialias
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.4);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Earth Sphere (Radius = 1.0 unit = 6,378 km)
    const earthTexture = createEarthCanvasTexture();
    const earthGeo = new THREE.SphereGeometry(1.0, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.7,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Atmospheric Limb Glow Shell
    const atmoGeo = new THREE.SphereGeometry(1.045, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // Orbital Plane Reference Ring (Equatorial)
    const eqRingGeo = new THREE.RingGeometry(1.01, 1.03, 64);
    const eqRingMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const eqRing = new THREE.Mesh(eqRingGeo, eqRingMat);
    eqRing.rotation.x = Math.PI / 2;
    scene.add(eqRing);

    // GEO Reference Ring (Altitude ~35,786 km = ~5.6 units)
    const geoRingPoints: THREE.Vector3[] = [];
    const geoRadius = (6378 + 35786) / 6378; // ~6.6 units
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      geoRingPoints.push(new THREE.Vector3(Math.cos(theta) * geoRadius, 0, Math.sin(theta) * geoRadius));
    }
    const geoRingGeo = new THREE.BufferGeometry().setFromPoints(geoRingPoints);
    const geoRingMat = new THREE.LineDashedMaterial({
      color: 0x475569,
      dashSize: 0.2,
      gapSize: 0.2,
      transparent: true,
      opacity: 0.4,
    });
    const geoLine = new THREE.Line(geoRingGeo, geoRingMat);
    geoLine.computeLineDistances();
    scene.add(geoLine);

    // Spacecraft Satellite 3D Model
    const satGroup = new THREE.Group();

    // Satellite Main Body Bus (Box)
    const busGeo = new THREE.BoxGeometry(0.08, 0.08, 0.12);
    const busMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });
    const busMesh = new THREE.Mesh(busGeo, busMat);
    satGroup.add(busMesh);

    // Solar Arrays (Left & Right)
    const panelGeo = new THREE.BoxGeometry(0.24, 0.01, 0.08);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.set(-0.16, 0, 0);
    satGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(panelGeo, panelMat);
    rightPanel.position.set(0.16, 0, 0);
    satGroup.add(rightPanel);

    scene.add(satGroup);
    satelliteMeshRef.current = satGroup;

    // Keplerian Orbit Line Ellipse
    const orbitLineGeo = new THREE.BufferGeometry();
    const orbitLineMat = new THREE.LineBasicMaterial({ color: 0x00f5d4, linewidth: 2 });
    const orbitLine = new THREE.Line(orbitLineGeo, orbitLineMat);
    scene.add(orbitLine);
    orbitLineRef.current = orbitLine;

    // Animation Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Rotate Earth slowly on its axis
      earthMesh.rotation.y += 0.0008;

      // Update camera position from spherical coordinates
      const { theta, phi } = cameraRotRef.current;
      const r = cameraDistance;
      camera.position.x = r * Math.sin(phi) * Math.sin(theta);
      camera.position.y = r * Math.cos(phi);
      camera.position.z = r * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Orbit Path & Satellite Position when state/keplerian changes
  useEffect(() => {
    if (!satelliteMeshRef.current || !orbitLineRef.current) return;

    // Scale: 1.0 unit = 6,378 km (Earth Radius)
    const earthR = 6378;
    const posX = state.x / earthR;
    const posY = state.z / earthR; // Map Z to Y for 3D coordinate convention
    const posZ = state.y / earthR;

    satelliteMeshRef.current.position.set(posX, posY, posZ);

    // Compute 128 points for 3D Keplerian Orbit Path
    const a = keplerian.semiMajorAxisKm / earthR;
    const e = keplerian.eccentricity;
    const inc = (keplerian.inclinationDeg * Math.PI) / 180;
    const raan = (keplerian.raanDeg * Math.PI) / 180;
    const argP = (keplerian.argPeriapsisDeg * Math.PI) / 180;

    const points: THREE.Vector3[] = [];
    const segments = 128;

    for (let i = 0; i <= segments; i++) {
      const nu = (i / segments) * Math.PI * 2;
      const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));

      // Orbital plane coordinates
      const xOrb = r * Math.cos(nu);
      const yOrb = r * Math.sin(nu);

      // Rotate by Argument of Periapsis (omega)
      const x1 = xOrb * Math.cos(argP) - yOrb * Math.sin(argP);
      const y1 = xOrb * Math.sin(argP) + yOrb * Math.cos(argP);

      // Rotate by Inclination (i)
      const x2 = x1;
      const y2 = y1 * Math.cos(inc);
      const z2 = y1 * Math.sin(inc);

      // Rotate by Longitude of Ascending Node (RAAN / Omega)
      const x3 = x2 * Math.cos(raan) - y2 * Math.sin(raan);
      const y3 = x2 * Math.sin(raan) + y2 * Math.cos(raan);
      const z3 = z2;

      // Coordinate map to Three.js: (X, Z_up, Y)
      points.push(new THREE.Vector3(x3, z3, y3));
    }

    orbitLineRef.current.geometry.setFromPoints(points);
  }, [state, keplerian]);

  // Mouse drag handlers for 3D Camera Orbit
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    cameraRotRef.current.theta -= dx * 0.008;
    cameraRotRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraRotRef.current.phi - dy * 0.008));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setCameraDistance((prev) => Math.max(1.8, Math.min(10.0, prev + e.deltaY * 0.004)));
  };

  return (
    <div className="relative w-full h-full min-h-[420px] bg-[#07090e] border border-white/10 rounded-lg overflow-hidden select-none">
      {/* 3D Three.js Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Cockpit HUD Overlays */}
      <div className="absolute top-3 left-3 pointer-events-none font-mono text-[11px] space-y-1">
        <div className="flex items-center gap-1.5 bg-black/70 px-2 py-0.5 rounded border border-white/10 text-cyan-300">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>THREE.JS 3D WEBGL ENGINE // ECI J2000</span>
        </div>
        <div className="bg-black/60 px-2 py-0.5 rounded border border-white/5 text-gray-400">
          CAM DIST: {(cameraDistance * 6378).toFixed(0)} KM • ZOOM: {((4.2 / cameraDistance) * 100).toFixed(0)}%
        </div>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1 font-mono text-[10px]">
        <button
          onClick={() => {
            cameraRotRef.current = { theta: 0.6, phi: 1.1 };
            setCameraDistance(4.2);
          }}
          className="px-2 py-1 rounded bg-black/70 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
        >
          RESET CAM
        </button>
        <button
          onClick={() => {
            cameraRotRef.current = { theta: 0.0, phi: 0.1 };
            setCameraDistance(3.2);
          }}
          className="px-2 py-1 rounded bg-black/70 hover:bg-white/10 border border-white/10 text-cyan-300 transition-colors"
        >
          NORTH POLE
        </button>
        <button
          onClick={() => {
            cameraRotRef.current = { theta: 1.57, phi: 1.57 };
            setCameraDistance(2.4);
          }}
          className="px-2 py-1 rounded bg-black/70 hover:bg-white/10 border border-white/10 text-amber-300 transition-colors"
        >
          EQUATORIAL
        </button>
      </div>

      {/* Orbit Telemetry Legend Footer */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-black/80 border border-white/10 font-mono text-[10px] text-gray-400 backdrop-blur-sm pointer-events-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <strong className="text-white">ASTRAEA:</strong> ({state.x.toFixed(0)}, {state.y.toFixed(0)}, {state.z.toFixed(0)}) km
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-cyan-400" />
            <strong className="text-cyan-300">LEO ORBIT:</strong> {keplerian.perigeeKm.toFixed(0)} × {keplerian.apogeeKm.toFixed(0)} km
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <span>DRAG MOUSE TO ROTATE</span>
          <span>•</span>
          <span>SCROLL TO ZOOM</span>
        </div>
      </div>
    </div>
  );
}
