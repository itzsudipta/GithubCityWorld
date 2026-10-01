"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { env, Weather } from '../lib/env';
import { DISTRICTS, EXTENT, KIND_LABEL, SPACING, RIVER_X, EVENT_LABEL, classify, rw, Placed } from '../lib/world';
import { Commit } from './Building';

const fmt = (n: number) => n.toLocaleString('en-US');
const ago = (iso: string | number) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 60) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 86400 / 30)}mo ago`;
};
const clock = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const WEATHER: { id: Weather; icon: string; label: string }[] = [
  { id: 'clear', icon: '☀', label: 'Clear' }, { id: 'cloudy', icon: '☁', label: 'Cloudy' },
  { id: 'rain', icon: '☂', label: 'Rain' }, { id: 'fog', icon: '≋', label: 'Fog' },
];

export function CityMap({ placed, size, onPick }: { placed: Placed[]; size: number; onPick?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const R = 175, s = size / (2 * R);
  const px = (v: number) => size / 2 + v * s;

  useEffect(() => {
    const cv = ref.current!, g = cv.getContext('2d')!;
    const draw = () => {
      const t = performance.now() / 1000;
      g.clearRect(0, 0, size, size);
      g.fillStyle = '#26361f'; g.fillRect(0, 0, size, size);
      g.fillStyle = '#2b5d78'; g.fillRect(px(RIVER_X - 9), 0, 18 * s, size);
      for (const d of DISTRICTS) {
        const sx = d.q[0] === '-' ? -1 : 1, sz = d.q[1] === '-' ? -1 : 1;
        g.fillStyle = d.color + '30';
        g.fillRect(px(sx < 0 ? -EXTENT : 0), px(sz < 0 ? -EXTENT : 0), EXTENT * s, EXTENT * s);
      }
      for (let k = -4; k <= 4; k++) {
        g.strokeStyle = k === 0 ? '#aeb8c0' : '#6f7b84'; g.lineWidth = k === 0 ? Math.max(2, rw(0) * s) : Math.max(1, rw(1) * s * 0.7);
        g.beginPath(); g.moveTo(px(-EXTENT), px(k * SPACING)); g.lineTo(px(k === 0 ? R : EXTENT), px(k * SPACING)); g.stroke();
        g.beginPath(); g.moveTo(px(k * SPACING), px(-EXTENT)); g.lineTo(px(k * SPACING), px(k === 0 ? R : EXTENT)); g.stroke();
      }
      for (const p of placed) {
        const sz = (3 + p.level * 1.4) * (size / 200);
        g.fillStyle = p.color; g.fillRect(px(p.lot.cx) - sz / 2, px(p.lot.cz) - sz / 2, sz, sz);
        if (p.activity > 0.6) {
          g.strokeStyle = `rgba(255,214,90,${0.35 + 0.35 * Math.sin(t * 3 + p.lot.i)})`; g.lineWidth = 1.5;
          g.beginPath(); g.arc(px(p.lot.cx), px(p.lot.cz), sz * 1.2 + 1.5 * (0.5 + 0.5 * Math.sin(t * 3)), 0, 7); g.stroke();
        }
      }
      // camera footprint
      const { x, z, tx, tz } = env.cam;
      const dx = tx - x, dz = tz - z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, wd = Math.min(L * 0.5, 120);
      g.fillStyle = 'rgba(255,255,255,.14)'; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(px(tx - (dx / L) * wd * 1.5), px(tz - (dz / L) * wd * 1.5));
      g.lineTo(px(tx + nx * wd + (dx / L) * wd * 0.6), px(tz + nz * wd + (dz / L) * wd * 0.6));
      g.lineTo(px(tx - nx * wd + (dx / L) * wd * 0.6), px(tz - nz * wd + (dz / L) * wd * 0.6));
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(px(tx), px(tz), 2.5, 0, 7); g.fill();
    };
    draw();
    const id = setInterval(draw, 120);
    return () => clearInterval(id);
  }, [placed, size]); // eslint-disable-line

  return (
    <canvas
      ref={ref} width={size} height={size} style={{ width: size, height: size, cursor: 'crosshair', display: 'block' }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width - 0.5) * 2 * R, z = ((e.clientY - r.top) / r.height - 0.5) * 2 * R;
        env.focus = { x, z }; onPick?.();
      }}
    />
  );
}

type Panel = 'activity' | 'search' | 'settings' | null;

export default function Hud(p: any) {
  const [panel, setPanel] = useState<Panel>(null);
  const [q, setQ] = useState('');
  const sel: Placed | null = p.selected;
  const toggle = (k: Panel) => setPanel((c) => (c === k ? null : k));
  const matches = useMemo(() => p.placed.filter((b: Placed) => b.repo.name.toLowerCase().includes(q.toLowerCase())).slice(0, 7), [p.placed, q]);
  const top = useMemo(() => [...p.placed].sort((a: Placed, b: Placed) => b.activity - a.activity).slice(0, 6) as Placed[], [p.placed]);
  const feed = useMemo(() => Object.entries(p.commits as Record<string, Commit[]>).flatMap(([repo, cs]) => cs.map((c) => ({ ...c, repo }))).sort((a, b) => b.t - a.t).slice(0, 6), [p.commits]);
  const focusOn = (b: Placed, dist = 60) => { env.focus = { x: b.lot.cx, z: b.lot.cz, dist }; p.onSelect(b.repo.id); setPanel(null); };
  const d = p.details;

  return (
    <>
      <div className="cb-panel cb-profile">
        <div className="cb-avatar">{p.user.name[0]}</div>
        <div><div className="cb-title">{p.user.name}</div><div className="cb-sub">GitHub World</div></div>
      </div>

      <div className="cb-panel cb-stats">
        {[['Repositories', p.stats.repos], ['Recent commits', p.stats.commits], ['Languages', p.stats.languages], ['Stars', p.stats.stars]].map(([l, v]) => (
          <div key={l as string}><span>{l}</span><b>{fmt(v as number)}</b></div>
        ))}
      </div>

      {p.demo && <div className="cb-panel cb-notice">Demo city — set NEXT_PUBLIC_GITHUB_TOKEN to load your repositories.</div>}

      {sel && (
        <div className="cb-panel cb-info">
          <div className="cb-info-head">
            <div><div className="cb-title">{sel.repo.name}</div><div className="cb-sub">{sel.repo.language || 'Mixed'} · {sel.district.name}</div></div>
            <button className="cb-x" onClick={p.onClose} aria-label="Close">✕</button>
          </div>
          <p className="cb-desc">{sel.repo.description || `${KIND_LABEL[sel.kind]} in the ${sel.district.name}.`}</p>
          <div className="cb-row"><span>Building</span><b>{KIND_LABEL[sel.kind]}</b></div>
          <div className="cb-row"><span>Activity</span><b>{Math.round(sel.activity * 100)}%</b></div>
          <div className="cb-bar"><i style={{ width: `${sel.activity * 100}%`, background: sel.color }} /></div>
          <div className="cb-row"><span>Stars</span><b>{fmt(sel.repo.stargazers_count || 0)}</b></div>
          <div className="cb-row"><span>Commits</span><b>{d?.commits != null ? fmt(d.commits) : '…'}</b></div>
          <div className="cb-row"><span>Contributors</span><b>{d?.contributors != null ? fmt(d.contributors) : '…'}</b></div>
          <div className="cb-row"><span>Forks · Issues</span><b>{sel.repo.forks_count || 0} · {sel.repo.open_issues_count || 0}</b></div>
          <div className="cb-row"><span>Size</span><b>{sel.repo.size > 1024 ? (sel.repo.size / 1024).toFixed(1) + ' MB' : (sel.repo.size || 0) + ' KB'}</b></div>
          <div className="cb-row"><span>Last update</span><b>{ago(sel.repo.pushed_at || sel.repo.updated_at)}</b></div>
          {(p.commits[sel.repo.name] || []).slice(0, 1).map((c: Commit) => (
            <div key={c.t} className="cb-row"><span>Works in progress</span><b>{EVENT_LABEL[classify(c.msg)]}</b></div>
          ))}
          <div className="cb-actions">
            <button className="cb-btn" onClick={() => focusOn(sel, 40)}>Focus</button>
            {sel.repo.html_url && sel.repo.html_url !== '#' && <a className="cb-btn" href={sel.repo.html_url} target="_blank" rel="noreferrer">Open on GitHub</a>}
          </div>
        </div>
      )}

      {panel && (
        <div className="cb-panel cb-pop">
          {panel === 'activity' && <>
            <div className="cb-pop-title">Most active projects</div>
            {top.map((b) => (
              <button key={b.repo.id} className="cb-item" onClick={() => focusOn(b)}>
                <span>{b.repo.name}</span><div className="cb-bar sm"><i style={{ width: `${b.activity * 100}%`, background: b.color }} /></div>
              </button>
            ))}
            <div className="cb-pop-title">Recent commits</div>
            {feed.length ? feed.map((c, i) => <div key={i} className="cb-feed"><b>{c.repo}</b> {c.msg.slice(0, 48)}<em>{ago(c.t)}</em></div>) : <div className="cb-feed">No recent commits found.</div>}
          </>}
          {panel === 'search' && <>
            <input autoFocus className="cb-input" placeholder="Search repositories" value={q} onChange={(e) => setQ(e.target.value)} />
            {matches.map((b: Placed) => <button key={b.repo.id} className="cb-item" onClick={() => focusOn(b)}><span>{b.repo.name}</span><em>{b.repo.language || ''}</em></button>)}
          </>}
          {panel === 'settings' && <>
            <div className="cb-pop-title">Weather</div>
            <div className="cb-seg">{WEATHER.map((w) => <button key={w.id} className={p.weather === w.id ? 'on' : ''} onClick={() => p.setWeather(w.id)}>{w.icon} {w.label}</button>)}</div>
            <div className="cb-pop-title">Time of day — {clock(p.hour)}</div>
            <input type="range" min={0} max={24} step={0.25} value={p.hour} onChange={(e) => { p.setLive(false); p.setHour(+e.target.value); }} className="cb-range" />
            <button className={`cb-btn sm ${p.live ? 'on' : ''}`} onClick={() => p.setLive(true)}>Use my local time</button>
            <div className="cb-pop-title">Traffic density</div>
            <input type="range" min={0.2} max={1.5} step={0.1} value={p.traffic} onChange={(e) => p.setTraffic(+e.target.value)} className="cb-range" />
          </>}
        </div>
      )}

      <div className="cb-panel cb-toolbar">
        <button onClick={() => { env.focus = { x: 0, z: 0, dist: 300 }; p.onClose(); setPanel(null); }}>City</button>
        <button className={p.mapOpen ? 'on' : ''} onClick={() => p.setMapOpen(!p.mapOpen)}>Map</button>
        <button className={panel === 'activity' ? 'on' : ''} onClick={() => toggle('activity')}>Activity</button>
        <button className={panel === 'search' ? 'on' : ''} onClick={() => toggle('search')}>Search</button>
        <button className={panel === 'settings' ? 'on' : ''} onClick={() => toggle('settings')}>Settings</button>
      </div>

      {p.mapOpen && (
        <div className="cb-overlay" onClick={() => p.setMapOpen(false)}>
          <div className="cb-panel cb-bigmap" onClick={(e) => e.stopPropagation()}>
            <div className="cb-info-head"><div className="cb-title">World map</div><button className="cb-x" onClick={() => p.setMapOpen(false)}>✕</button></div>
            <CityMap placed={p.placed} size={560} onPick={() => p.setMapOpen(false)} />
            <div className="cb-legend">{DISTRICTS.map((x) => <span key={x.id}><i style={{ background: x.color }} />{x.name}</span>)}</div>
          </div>
        </div>
      )}
    </>
  );
}
