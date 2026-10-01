import * as THREE from 'three';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog';

// Mutable singleton read every frame by the scene (avoids React re-renders for animation values).
export const env = {
  hour: 14, night: 0, elev: 1,
  weather: 'clear' as Weather, rain: 0, wet: 0, fogAmt: 0,
  traffic: 1, crowd: 1,
  focus: null as null | { x: number; z: number; dist?: number },
  cam: { x: 0, z: 0, tx: 0, tz: 0, az: 0 },
};

// Materials whose look depends on time of day / weather — Lighting updates them each frame.
export const windowMats = new Set<THREE.MeshStandardMaterial>();
export const roadMats = new Set<THREE.MeshStandardMaterial>();
export const signMats = new Set<THREE.MeshBasicMaterial>();
export const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false });
export const headMat = new THREE.MeshBasicMaterial({ toneMapped: false });
export const tailMat = new THREE.MeshBasicMaterial({ toneMapped: false });
export const poolMat = new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: '#ffcf8a', toneMapped: false,
});

// Share of the city that is out and about at a given hour
export const crowdFactor = (h: number) =>
  h < 5 ? 0.2 : h < 8 ? 0.2 + ((h - 5) / 3) * 0.8 : h < 17 ? 1 : h < 22 ? 1 - ((h - 17) / 5) * 0.7 : 0.25;
