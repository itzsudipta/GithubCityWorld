"use client";

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { env, windowMats, roadMats, signMats, lampMat, headMat, tailMat, poolMat, crowdFactor } from '../lib/env';
import { smooth } from '../lib/world';

const WEATHER_DIM = { clear: 1, cloudy: 0.62, rain: 0.42, fog: 0.5 };

export default function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const fill = useRef<THREE.AmbientLight>(null!);
  const sky = useRef<any>(null);
  const { scene } = useThree();
  const [stars, setStars] = useState(false);
  const c = useMemo(() => ({
    a: new THREE.Color(), b: new THREE.Color(), night: new THREE.Color('#0a1020'), dusk: new THREE.Color('#d89a7a'),
    day: new THREE.Color('#bcd3e6'), grey: new THREE.Color('#8e979f'), warm: new THREE.Color('#ff8f4d'), white: new THREE.Color('#fff3e0'),
    moon: new THREE.Color('#8fa8ff'), hs: new THREE.Color('#223355'), hd: new THREE.Color('#bcd8ff'),
  }), []);

  useEffect(() => { scene.fog = new THREE.Fog('#bcd3e6', 200, 1600); }, [scene]);

  useFrame((_, dt) => {
    const a = ((env.hour - 6) / 12) * Math.PI;
    const elev = Math.sin(a);
    env.elev = elev;
    env.night = 1 - smooth(-0.1, 0.15, elev);
    env.crowd = crowdFactor(env.hour);
    const k = 1 - Math.exp(-dt * 1.2);
    env.rain += ((env.weather === 'rain' ? 1 : 0) - env.rain) * k;
    env.wet += ((env.weather === 'rain' ? 1 : 0) - env.wet) * (env.weather === 'rain' ? k : k * 0.15);
    env.fogAmt += ((env.weather === 'fog' ? 1 : 0) - env.fogAmt) * k;
    const dim = WEATHER_DIM[env.weather];
    const day = smooth(-0.05, 0.28, elev);

    // sun / moon (moon takes over below the horizon)
    const moonUp = elev < -0.03;
    const L = sun.current;
    L.position.set((moonUp ? -1 : 1) * Math.cos(a) * 220, Math.max(28, Math.abs(elev) * 220), 90);
    L.intensity = moonUp ? 0.8 : smooth(-0.03, 0.25, elev) * 2.5 * dim;
    L.color.copy(moonUp ? c.moon : c.a.copy(c.warm).lerp(c.white, smooth(0, 0.35, elev)));
    hemi.current.intensity = (0.28 + 0.55 * day) * (0.6 + 0.4 * dim);
    hemi.current.color.copy(c.hs).lerp(c.hd, day);
    fill.current.intensity = THREE.MathUtils.lerp(0.24, 0.08, day) * dim;
    fill.current.color.copy(c.moon);

    // fog / atmosphere
    c.b.copy(c.night).lerp(c.dusk, smooth(-0.15, 0.05, elev)).lerp(c.day, smooth(0.02, 0.3, elev));
    if (env.weather !== 'clear') c.b.lerp(c.grey.clone().multiplyScalar(0.35 + 0.65 * day), env.weather === 'fog' ? 0.7 : 0.45);
    const f = scene.fog as THREE.Fog;
    f.color.copy(c.b);
    f.near = THREE.MathUtils.lerp(260, 10, env.fogAmt);
    f.far = THREE.MathUtils.lerp(1700, 190, Math.max(env.fogAmt, env.rain * 0.45));
    scene.background = c.b;

    if (sky.current) {
      const u = sky.current.material.uniforms;
      u.sunPosition.value.set(Math.cos(a) * 400, Math.sin(a) * 400, 120);
      const overcast = env.weather !== 'clear';
      u.turbidity.value = overcast ? 14 : 3;
      u.rayleigh.value = overcast ? 0.5 : 1.6;
    }
    const wantStars = env.night > 0.6 && env.weather !== 'rain';
    if (wantStars !== stars) setStars(wantStars);

    // night-time / weather material states
    const n = env.night;
    windowMats.forEach((m) => { m.emissiveIntensity = n * 1.9; });
    signMats.forEach((m) => m.color.setScalar(0.8 + n * 0.7));
    lampMat.color.setRGB(0.5 + n * 1.2, 0.5 + n * 0.75, 0.52 + n * 0.2);
    headMat.color.setRGB(0.35 + n * 1.5, 0.35 + n * 1.4, 0.35 + n * 1.0);
    tailMat.color.setRGB(0.3 + n * 1.1, 0.05 + n * 0.05, 0.05 + n * 0.05);
    poolMat.opacity = n * 0.8;
    roadMats.forEach((m) => { m.roughness = 0.92 - 0.6 * env.wet; m.metalness = 0.15 * env.wet; m.color.setScalar(1 - 0.3 * env.wet); });
  });

  return (
    <>
      <Sky ref={sky} distance={900} turbidity={3} rayleigh={1.6} mieCoefficient={0.005} mieDirectionalG={0.8} />
      {stars && <Stars radius={700} depth={60} count={3500} factor={7} fade speed={0} />}
      <hemisphereLight ref={hemi} groundColor="#3b4a2c" />
      <ambientLight ref={fill} color="#8fa8ff" />
      <directionalLight ref={sun} castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.35}>
        <orthographicCamera attach="shadow-camera" args={[-175, 175, 175, -175, 1, 700]} />
      </directionalLight>
      <Rain />
    </>
  );
}

function Rain() {
  const ref = useRef<THREE.LineSegments>(null!);
  const mat = useRef<THREE.LineBasicMaterial>(null!);
  const anchor = useRef(new THREE.Vector3());
  const N = 4000;
  const geo = useMemo(() => {
    const p = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 240, y = Math.random() * 120, z = (Math.random() - 0.5) * 240;
      p.set([x, y, z, x + 0.15, y + 1.8, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const on = env.rain > 0.02;
    ref.current.visible = on;
    if (!on) return;
    mat.current.opacity = 0.45 * env.rain;
    anchor.current.set(env.cam.tx, 0, env.cam.tz);
    ref.current.position.lerp(anchor.current, 1 - Math.exp(-dt * 8));
    const p = geo.attributes.position as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const o = i * 6;
      a[o + 1] -= 70 * dt; a[o + 4] -= 70 * dt;
      if (a[o + 4] < 0) { a[o + 1] = 120; a[o + 4] = 121.8; }
    }
    p.needsUpdate = true;
  });
  return (
    <lineSegments ref={ref} geometry={geo} frustumCulled={false}>
      <lineBasicMaterial ref={mat} color="#b9c9d8" transparent opacity={0} />
    </lineSegments>
  );
}
