"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Octokit } from 'octokit';
import World from '../components/World';
import Hud from '../components/Hud';
import { Commit } from '../components/Building';
import { env, Weather } from '../lib/env';
import { planCity, demoRepos, rng } from '../lib/world';

const localHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };

async function countOf(o: Octokit, route: string, owner: string, repo: string) {
  const r = await o.request(route, { owner, repo, per_page: 1, anon: 'true' } as any);
  const m = /[?&]page=(\d+)>; rel="last"/.exec((r.headers as any).link || '');
  return m ? +m[1] : Array.isArray(r.data) ? r.data.length : 0;
}

async function recentRepoCommits(o: Octokit, repos: any[]): Promise<Record<string, Commit[]>> {
  const cutoff = Date.now() - 36 * 36e5;
  const candidates = repos
    .filter((repo) => new Date(repo.pushed_at || repo.updated_at || 0).getTime() >= cutoff)
    .slice(0, 20);
  const entries = await Promise.allSettled(candidates.map(async (repo) => {
    const { data } = await o.rest.repos.listCommits({
      owner: repo.owner.login,
      repo: repo.name,
      per_page: 3,
    });
    const commits = data
      .map((commit) => ({
        msg: commit.commit.message.split('\n')[0],
        t: new Date(commit.commit.author?.date || repo.pushed_at || Date.now()).getTime(),
      }))
      .filter((commit) => commit.t >= cutoff);
    return [repo.name, commits] as const;
  }));

  return Object.fromEntries(
    entries
      .filter((entry): entry is PromiseFulfilledResult<readonly [string, Commit[]]> => entry.status === 'fulfilled')
      .filter((entry) => entry.value[1].length > 0)
      .map((entry) => entry.value),
  );
}

export default function GitHubWorld() {
  const [repos, setRepos] = useState<any[]>([]);
  const [user, setUser] = useState({ name: 'SUDIPTA', login: '' });
  const [commits, setCommits] = useState<Record<string, Commit[]>>({});
  const [demo, setDemo] = useState(false);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, { commits?: number; contributors?: number }>>({});
  const [hour, setHour] = useState(localHour);
  const [live, setLive] = useState(true);
  const [weather, setWeather] = useState<Weather>('clear');
  const [traffic, setTraffic] = useState(1);
  const [mapOpen, setMapOpen] = useState(false);
  const known = useRef<Set<number> | null>(null);
  const octo = useRef<Octokit | null>(null);

  // ---- GitHub data (polled so new repos / commits appear live)
  const load = useCallback(async () => {
    const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
    if (!token) { setDemo(true); setRepos(demoRepos()); return; }
    try {
      const o = (octo.current ||= new Octokit({ auth: token }));
      const [{ data: me }, { data: list }] = await Promise.all([
        o.rest.users.getAuthenticated(),
        o.rest.repos.listForAuthenticatedUser({ sort: 'updated', per_page: 100, affiliation: 'owner' }),
      ]);
      setUser({ name: (me.name || me.login).split(' ')[0].toUpperCase(), login: me.login });
      setRepos(list);
      const ids = new Set(list.map((r: any) => r.id as number));
      if (known.current) {
        const fresh = list.filter((r: any) => !known.current!.has(r.id)).map((r: any) => r.id as number);
        if (fresh.length) setNewIds((s) => new Set([...s, ...fresh]));
      }
      known.current = ids;
      try {
        const { data: ev } = await o.rest.activity.listEventsForAuthenticatedUser({ username: me.login, per_page: 100 });
        const map: Record<string, Commit[]> = {};
        for (const e of ev as any[]) if (e.type === 'PushEvent') {
          const name = e.repo.name.split('/')[1];
          for (const c of e.payload.commits || []) (map[name] ||= []).push({ msg: c.message.split('\n')[0], t: new Date(e.created_at).getTime() });
        }
        const fallback = await recentRepoCommits(o, list);
        setCommits({ ...fallback, ...map });
      } catch (e) {
        console.warn('GitHub activity feed unavailable; loading recent repository commits instead.', e);
        try {
          setCommits(await recentRepoCommits(o, list));
        } catch (fallbackError) {
          console.warn('Unable to load recent repository commits.', fallbackError);
          setCommits({});
        }
      }
    } catch (e) {
      console.error('GitHub auth/network error — showing demo city', e);
      setDemo(true); setRepos((r) => (r.length ? r : demoRepos()));
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  // demo mode: fabricate a few fresh commits so construction is visible
  useEffect(() => {
    if (!demo) return;
    const now = Date.now();
    setCommits({
      'fabricanova': [{ msg: 'Added ML model training pipeline', t: now - 36e5 }],
      'payments-service': [{ msg: 'Added payment system with Stripe', t: now - 2 * 36e5 }, { msg: 'Fixed authentication token refresh', t: now - 5 * 36e5 }],
      'chat-ui': [{ msg: 'Improved UI layout and theme', t: now - 3 * 36e5 }],
      'orders-api': [{ msg: 'Added REST API endpoints', t: now - 20 * 36e5 }],
      'sql-warehouse': [{ msg: 'Added database migration', t: now - 4 * 864e5 }],
    });
  }, [demo]);

  // ---- layout
  const city = useMemo(() => planCity(repos), [repos]);
  const selected = useMemo(() => city.placed.find((b) => b.repo.id === selectedId) || null, [city, selectedId]);

  // ---- repo details (commit count + contributors) fetched on demand
  useEffect(() => {
    if (!selected || details[selected.repo.id]) return;
    const id = selected.repo.id;
    if (demo || !octo.current) {
      const r = rng(id);
      setDetails((d) => ({ ...d, [id]: { commits: Math.floor(r() * 400) + 10, contributors: 1 + Math.floor(r() * 4) } }));
      return;
    }
    const owner = selected.repo.owner.login, name = selected.repo.name;
    Promise.all([countOf(octo.current, 'GET /repos/{owner}/{repo}/commits', owner, name), countOf(octo.current, 'GET /repos/{owner}/{repo}/contributors', owner, name)])
      .then(([c, k]) => setDetails((d) => ({ ...d, [id]: { commits: c, contributors: k } })))
      .catch(() => setDetails((d) => ({ ...d, [id]: {} })));
  }, [selected]); // eslint-disable-line

  // ---- time / weather / traffic -> shared env
  useEffect(() => { env.hour = hour; }, [hour]);
  useEffect(() => { env.weather = weather; }, [weather]);
  useEffect(() => { env.traffic = traffic; }, [traffic]);
  useEffect(() => {
    if (!live) return;
    setHour(localHour());
    const id = setInterval(() => setHour(localHour()), 20_000);
    return () => clearInterval(id);
  }, [live]);

  // ---- hotkeys
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'm' || e.key === 'M') setMapOpen((v) => !v);
      if (e.key === 'Escape') { setSelectedId(null); setMapOpen(false); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const stats = useMemo(() => ({
    repos: repos.length,
    commits: Object.values(commits).reduce((a, c) => a + c.length, 0),
    languages: new Set(repos.map((r) => r.language).filter(Boolean)).size,
    stars: repos.reduce((a, r) => a + (r.stargazers_count || 0), 0),
  }), [repos, commits]);

  return (
    <main className="gw-root">
      <World
        placed={city.placed} parks={city.parks} lots={city.lots}
        commits={commits} newIds={newIds}
        onSelect={(id) => setSelectedId(id)}
      />
      <Hud
        user={user} stats={stats} demo={demo} placed={city.placed} selected={selected} details={selected ? details[selected.repo.id] : undefined}
        commits={commits} hour={hour} live={live} setHour={setHour} setLive={setLive} weather={weather} setWeather={setWeather}
        traffic={traffic} setTraffic={setTraffic} mapOpen={mapOpen} setMapOpen={setMapOpen}
        onSelect={(id: number) => setSelectedId(id)} onClose={() => setSelectedId(null)}
      />
    </main>
  );
}
