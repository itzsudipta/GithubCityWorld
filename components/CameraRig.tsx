"use client";

import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { env } from '../lib/env';

const off = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();

export default function CameraRig() {
  const controls = useRef<any>(null);
  const camera = useThree((s) => s.camera);
  const keys = useRef(new Set<string>());

  useEffect(() => {
    camera.position.set(190, 170, 230);
    controls.current?.target.set(0, 0, 0);
    const dn = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName !== 'INPUT') keys.current.add(e.key.toLowerCase()); };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, [camera]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const target: THREE.Vector3 = c.target;

    // keyboard pan (WASD / arrows) relative to the view direction
    const k = keys.current;
    const mx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const mz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    if (mx || mz) {
      env.focus = null;
      const dist = camera.position.distanceTo(target);
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      right.crossVectors(fwd, camera.up).normalize();
      const v = fwd.multiplyScalar(mz).add(right.multiplyScalar(mx)).multiplyScalar(dist * 0.9 * dt);
      target.add(v); camera.position.add(v);
    }

    // smooth fly-to (overview -> neighbourhood -> building)
    const f = env.focus;
    if (f) {
      off.copy(camera.position).sub(target);
      const curDist = off.length();
      const wantDist = f.dist ?? curDist;
      const a = 1 - Math.exp(-4 * dt);
      const nd = curDist + (wantDist - curDist) * a;
      target.x += (f.x - target.x) * a; target.z += (f.z - target.z) * a; target.y += (0 - target.y) * a;
      camera.position.copy(target).add(off.normalize().multiplyScalar(nd));
      if (Math.hypot(f.x - target.x, f.z - target.z) < 0.4 && Math.abs(wantDist - nd) < 1) env.focus = null;
    }

    // keep the camera over the city
    const lim = 230;
    target.x = THREE.MathUtils.clamp(target.x, -lim, lim);
    target.z = THREE.MathUtils.clamp(target.z, -lim, lim);

    env.cam.x = camera.position.x; env.cam.z = camera.position.z;
    env.cam.tx = target.x; env.cam.tz = target.z;
    env.cam.az = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
  });

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      screenSpacePanning={false}
      minDistance={14}
      maxDistance={420}
      minPolarAngle={0.25}
      maxPolarAngle={1.32}
      rotateSpeed={0.6}
      panSpeed={1.1}
      onStart={() => { env.focus = null; }}
      // @ts-ignore — available in recent three.js: zoom toward the cursor
      zoomToCursor
    />
  );
}
