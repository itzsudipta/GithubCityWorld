import * as THREE from 'three';
import { rng } from './world';

const cache = new Map<string, THREE.CanvasTexture>();

function tex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true) {
  let t = cache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export type Style = 'glass' | 'concrete' | 'brick' | 'louver';
const WALL: Record<Style, string> = { glass: '#2f3d4a', concrete: '#cfccc4', brick: '#8c5b49', louver: '#8b9298' };

// One tile = 4 x 4 window cells (each cell is 4 m wide, 3.6 m tall)
export const facadeTex = (s: Style) => tex('f' + s, 256, 256, (g) => {
  g.fillStyle = WALL[s]; g.fillRect(0, 0, 256, 256);
  for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
    const x = cx * 64, y = cy * 64;
    if (s === 'louver') {
      for (let l = 0; l < 6; l++) { g.fillStyle = l % 2 ? '#6c737a' : '#a3a9ae'; g.fillRect(x + 4, y + 8 + l * 8, 56, 4); }
      continue;
    }
    const glass = s === 'glass';
    const gr = g.createLinearGradient(x, y, x, y + 64);
    gr.addColorStop(0, glass ? '#9cc6e3' : '#7fa3bd'); gr.addColorStop(1, glass ? '#3f6a8a' : '#456a85');
    g.fillStyle = gr;
    g.fillRect(x + (glass ? 3 : 9), y + (glass ? 5 : 12), glass ? 58 : 46, glass ? 54 : 40);
    if (glass) { g.fillStyle = 'rgba(20,30,40,.8)'; g.fillRect(x + 31, y + 5, 2, 54); }
  }
});

export const emissiveTex = (s: Style, p: number) => tex(`e${s}${Math.round(p * 10)}`, 256, 256, (g) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  const r = rng(Math.round(p * 10) * 31 + s.length);
  const warm = ['#ffd9a0', '#fff1d0', '#ffc680'];
  for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
    if (r() > p) continue;
    const x = cx * 64, y = cy * 64;
    if (s === 'louver') { g.fillStyle = '#2b7fa8'; g.fillRect(x + 4, y + 8, 56, 44); continue; }
    g.fillStyle = warm[Math.floor(r() * 3)];
    const glass = s === 'glass';
    g.fillRect(x + (glass ? 3 : 9), y + (glass ? 5 : 12), glass ? 58 : 46, glass ? 54 : 40);
  }
});

export const roadTexture = (highway: boolean) => tex(highway ? 'rh' : 'rl', 256, 256, (g) => {
  g.fillStyle = '#3b3e43'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},.05)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.fillStyle = 'rgba(235,235,230,.85)'; g.fillRect(0, 8, 256, 5); g.fillRect(0, 243, 256, 5);
  if (highway) {
    g.fillStyle = '#e7b923'; g.fillRect(0, 122, 256, 4); g.fillRect(0, 130, 256, 4);
    g.fillStyle = 'rgba(235,235,230,.8)'; g.fillRect(0, 62, 120, 3); g.fillRect(0, 191, 120, 3);
  } else { g.fillStyle = 'rgba(235,235,230,.8)'; g.fillRect(0, 126, 110, 4); }
});

export const glowTexture = () => tex('glow', 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
}, false);

export const barrierTexture = () => tex('barrier', 64, 16, (g) => {
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#ff6a1a';
  for (let x = -16; x < 64; x += 16) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 8, 16); g.lineTo(x + 16, 0); g.lineTo(x + 8, 0); g.fill(); }
});

export const signTexture = (name: string, color: string) => tex(`s${name}${color}`, 512, 128, (g) => {
  g.fillStyle = '#10171c'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = color; g.fillRect(0, 108, 512, 20);
  g.fillStyle = '#f2f5f7'; g.font = '700 46px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name.length > 18 ? name.slice(0, 17) + '…' : name.toUpperCase(), 256, 54, 480);
}, false);
