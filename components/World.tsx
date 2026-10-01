"use client";

import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import Lighting from './Lighting';
import CameraRig from './CameraRig';
import CityGround from './CityGround';
import Building, { Commit } from './Building';
import Traffic from './Vehicles';
import People from './People';
import { env } from '../lib/env';
import { Lot, Placed } from '../lib/world';

interface Props {
  placed: Placed[]; parks: Lot[]; lots: Lot[];
  commits: Record<string, Commit[]>; newIds: Set<number>;
  onSelect: (id: number | null) => void;
}

export default function World({ placed, parks, lots, commits, newIds, onSelect }: Props) {
  const totalActivity = placed.reduce((a, p) => a + p.activity, 0);
  const vehicles = Math.min(90, Math.round(14 + totalActivity * 3.2));
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 1.75]}
      camera={{ fov: 38, near: 2, far: 1800, position: [190, 170, 230] }}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelect(null)}
    >
      <Lighting />
      <CameraRig />
      <CityGround placed={placed} parks={parks} lots={lots} />
      {placed.map((p) => (
        <Building
          key={p.repo.id}
          p={p}
          commits={commits[p.repo.name] || []}
          isNew={newIds.has(p.repo.id)}
          onSelect={onSelect}
          onFocus={(b) => { env.focus = { x: b.lot.cx, z: b.lot.cz, dist: 60 }; }}
        />
      ))}
      <Traffic total={vehicles} />
      <People placed={placed} />
    </Canvas>
  );
}
