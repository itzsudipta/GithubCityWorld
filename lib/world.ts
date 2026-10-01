// Pure layout / data helpers (no three.js, safe on the server)

export const SPACING = 30;
export const GRID = 4; // road lines at k*30, k = -4..4
export const EXTENT = SPACING * GRID; // 120
export const HW = 14; // highway width (k = 0)
export const RW = 8; // street width
export const RIVER_X = 150;
export const rw = (k: number) => (k === 0 ? HW : RW);

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function heightAt(x: number, z: number) {
  const m = Math.max(Math.abs(x), Math.abs(z));
  const corridor = smooth(10, 45, Math.min(Math.abs(x), Math.abs(z))); // keep highways flat
  const n = Math.sin(x * 0.021) * Math.cos(z * 0.017) * 14 + Math.sin(x * 0.047 + z * 0.039) * 6 + Math.cos(z * 0.09 - x * 0.06) * 2.5;
  let h = Math.max(0, n + 8) * smooth(170, 250, m) * corridor;
  h -= 3 * smooth(11, 6, Math.abs(x - RIVER_X)); // river bed
  return h;
}

export const DISTRICTS = [
  { id: 'ai', name: 'AI & ML District', q: '--', color: '#8b6cff', langs: ['Python', 'Jupyter Notebook', 'R', 'Julia'] },
  { id: 'web', name: 'Web District', q: '+-', color: '#38bdf8', langs: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'SCSS', 'Vue', 'Svelte'] },
  { id: 'backend', name: 'Backend District', q: '-+', color: '#ff8a5c', langs: ['Java', 'Go', 'C#', 'Kotlin', 'PHP', 'Ruby', 'SQL', 'PLpgSQL', 'Scala'] },
  { id: 'oss', name: 'Open Source & Systems', q: '++', color: '#5fd68a', langs: ['C', 'C++', 'Rust', 'Shell', 'Dockerfile', 'Makefile'] },
] as const;
export type District = (typeof DISTRICTS)[number];
export const districtFor = (lang?: string | null): District =>
  DISTRICTS.find((d) => lang && (d.langs as readonly string[]).includes(lang)) || DISTRICTS[3];

const LANG_COLORS: Record<string, string> = {
  Python: '#3d7ab8', Java: '#e5703a', JavaScript: '#e8c93a', TypeScript: '#3178c6', 'C++': '#d6477b', C: '#7b8794',
  'C#': '#6a9a3a', Go: '#1fb5c9', Rust: '#c9743f', HTML: '#e44d26', CSS: '#7a5cd6', SQL: '#d9a441', PHP: '#7a86b8',
  Ruby: '#c9322f', Kotlin: '#a97bff', Shell: '#6fbf73', 'Jupyter Notebook': '#f37726',
};
export const langColor = (l?: string | null) => LANG_COLORS[l || ''] || '#9aa7b4';
export const ROLES: Record<string, string> = {
  Python: 'AI/ML engineer', Java: 'Backend engineer', JavaScript: 'Web developer', TypeScript: 'Web developer',
  'C++': 'Systems engineer', C: 'Systems engineer', SQL: 'Database engineer', HTML: 'UI designer', CSS: 'UI designer',
};

export type Kind = 'startup' | 'office' | 'lab' | 'data' | 'campus' | 'hq';
export const KIND_LABEL: Record<Kind, string> = {
  startup: 'Startup workshop', office: 'Corporate office', lab: 'Research laboratory',
  data: 'Data center', campus: 'Technology campus', hq: 'Headquarters complex',
};

export interface Lot { i: number; j: number; cx: number; cz: number; sx: number; sz: number; q: string }
export interface Placed {
  repo: any; lot: Lot; district: District; level: number; kind: Kind; activity: number; color: string; rot: number;
}

export function activityOf(r: any): number {
  if (r.archived) return 0.04;
  const days = (Date.now() - new Date(r.pushed_at || r.updated_at || 0).getTime()) / 864e5;
  const a = days < 2 ? 1 : days < 7 ? 0.8 : days < 30 ? 0.55 : days < 120 ? 0.3 : 0.12;
  return Math.min(1, a + Math.min(0.1, (r.stargazers_count || 0) / 200));
}

export function isRecentlyPushed(r: any, hours = 36): boolean {
  const pushedAt = new Date(r.pushed_at || r.updated_at || 0).getTime();
  return Number.isFinite(pushedAt) && Date.now() - pushedAt < hours * 36e5;
}
export function levelOf(r: any): number {
  const s = r.stargazers_count || 0, kb = r.size || 0;
  return s > 50 || kb > 20000 ? 4 : s > 10 || kb > 5000 ? 3 : kb > 800 ? 2 : 1;
}
const kindFor = (d: string, level: number): Kind =>
  level === 1 ? 'startup' : level === 4 ? 'hq' : d === 'ai' ? 'lab' : d === 'backend' ? 'data' : level === 3 ? 'campus' : 'office';

export function planCity(repos: any[]) {
  const lots: Lot[] = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const kx = i - 4, kz = j - 4;
    const x0 = kx * SPACING + rw(kx) / 2, x1 = (kx + 1) * SPACING - rw(kx + 1) / 2;
    const z0 = kz * SPACING + rw(kz) / 2, z1 = (kz + 1) * SPACING - rw(kz + 1) / 2;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    lots.push({ i, j, cx, cz, sx: x1 - x0, sz: z1 - z0, q: (cx < 0 ? '-' : '+') + (cz < 0 ? '-' : '+') });
  }
  const free: Record<string, Lot[]> = {};
  for (const d of DISTRICTS) free[d.q] = lots.filter((l) => l.q === d.q).sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz));
  const placed: Placed[] = [];
  // stable order: oldest repos claim the lots closest to the centre, new repos grow outward
  for (const repo of [...repos].sort((a, b) => a.id - b.id)) {
    let dist: District = districtFor(repo.language);
    if (!free[dist.q].length) {
      const alt = DISTRICTS.find((d) => free[d.q].length);
      if (!alt) break;
      dist = alt;
    }
    const lot = free[dist.q].shift()!;
    const level = levelOf(repo);
    placed.push({ repo, lot, district: dist, level, kind: kindFor(dist.id, level), activity: activityOf(repo), color: langColor(repo.language), rot: lot.cz < 0 ? 0 : Math.PI });
  }
  return { placed, parks: DISTRICTS.flatMap((d) => free[d.q]), lots };
}

export const doorOf = (p: Placed) => ({ x: p.lot.cx, z: p.lot.cz + (p.rot === 0 ? 1 : -1) * (p.lot.sz / 2 - 5.2) });

// ---- commit message -> visual event
export type EventType = 'api' | 'database' | 'ui' | 'auth' | 'ml' | 'payment' | 'generic';
export function classify(msg: string): EventType {
  const m = msg.toLowerCase();
  if (/\b(auth|login|token|jwt|security|password|oauth|session)/.test(m)) return 'auth';
  if (/\b(pay|stripe|checkout|billing|invoice|razorpay)/.test(m)) return 'payment';
  if (/\b(model|ml|train|neural|dataset|torch|tensorflow|embedding|llm|ai)\b/.test(m)) return 'ml';
  if (/\b(database|db|sql|schema|migrat|mongo|postgres|redis|prisma)/.test(m)) return 'database';
  if (/\b(api|endpoint|route|rest|graphql|webhook|server)/.test(m)) return 'api';
  if (/\b(ui|style|css|design|layout|theme|frontend|component|page)/.test(m)) return 'ui';
  return 'generic';
}
export const EVENT_LABEL: Record<EventType, string> = {
  api: 'Network mast', database: 'Data silos', ui: 'Facade upgrade', auth: 'Security gate', ml: 'Research dome', payment: 'Payment kiosk', generic: 'Construction',
};

// traffic light: 0 green, 1 yellow, 2 red. Cycle 24s, phase-shifted per node.
export function light(node: number, axis: 'x' | 'z', t: number): 0 | 1 | 2 {
  const T = (((t + node * 5.3) % 24) + 24) % 24;
  const s = axis === 'x' ? T : (T + 12) % 24;
  return s < 10 ? 0 : s < 12 ? 1 : 2;
}
export const nodeIndex = (i: number, j: number) => (i + 4) * 9 + (j + 4);

export function demoRepos(): any[] {
  const r = rng(5);
  const data: [string, string | null, number][] = [
    ['fabricanova', 'Python', 12], ['neural-playground', 'Python', 31], ['vision-lab', 'Jupyter Notebook', 4], ['rag-assistant', 'Python', 18],
    ['portfolio-site', 'TypeScript', 9], ['shop-frontend', 'JavaScript', 3], ['design-system', 'CSS', 14], ['landing-kit', 'HTML', 1], ['chat-ui', 'TypeScript', 22], ['dashboard-pro', 'TypeScript', 7],
    ['payments-service', 'Java', 6], ['auth-gateway', 'Java', 11], ['orders-api', 'Go', 5], ['inventory-core', 'C#', 2], ['sql-warehouse', 'SQL', 0], ['batch-jobs', 'Kotlin', 1],
    ['os-kernel-toy', 'C', 41], ['tiny-compiler', 'Rust', 28], ['fast-matrix', 'C++', 16], ['dotfiles', 'Shell', 2], ['open-notes', 'TypeScript', 55], ['contrib-tools', 'JavaScript', 8],
    ['old-experiments', 'Python', 0], ['legacy-portal', 'Java', 1], ['hackathon-2022', 'JavaScript', 0],
  ];
  return data.map(([name, language, stars], i) => ({
    id: 1000 + i, name, language, stargazers_count: stars, forks_count: Math.floor(stars / 4),
    size: Math.floor(r() * 24000), open_issues_count: Math.floor(r() * 6), archived: i >= 22,
    description: `${name.replace(/-/g, ' ')} — demo repository`,
    pushed_at: new Date(Date.now() - (i % 6 === 0 ? 3e5 : r() * 200 * 864e5)).toISOString(),
    owner: { login: 'demo' }, html_url: '#',
  }));
}
