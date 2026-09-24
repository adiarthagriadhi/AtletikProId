const state = {
  user: null,
  view: 'loading', // loading | auth | admin-setup | app
  athletes: [],
  selectedAthleteId: null,
  toast: null,
  palette: (typeof localStorage !== 'undefined' && localStorage.getItem('ui-palette')) || 'indigo',
  font: (typeof localStorage !== 'undefined' && localStorage.getItem('ui-font')) || 'system',
  portalDay: null,
  athleteTab: 'program', // program (=jadwal) | tests | monitoring | athlete-feed
  scheduleView: 'week', // day | week | month
  scheduleViewUserSet: false,
  compareWithId: null,
  compareCache: null,
  fieldPage: 'home', // home | athlete | week | log | tests | more
  coachFullMobile: false, // true = UI desktop dipaksa di HP

  athleteFeed: null,
  successMessage: null,
  forgotResult: null,
  resetToken: null,
  successAction: null,
  program: null,
  calendar: null,
  calendarYear: null,
  calendarMonth: null,
  calendarSelectedDate: null,
  tests: [],
  editingTestId: null,
  techniqueChecklist: null,
  monitoringLogs: [],
  editingLogId: null,
  monitoringPrefill: null, // { rpe, durationMin, note } — diisi dari tombol "Catat dari sesi"
  acwr: null,
  acwrSeries: null,
  nutrition: null, // hasil GET /athletes/:id/nutrition — { available, targets, ... } atau { available:false, reason }
  adminCoaches: null,
  adminFilterCoachId: null,
  adminFilterCoachName: null,
  categories: null,
  error: null,
  sidebarOpen: false,
  showGuide: false,
};

const root = document.getElementById('app');

// ---------- API helper ----------
async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request gagal (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  attrs = attrs || {};
  for (const k in attrs) {
    if (attrs[k] === undefined || attrs[k] === null) continue; // omit entirely — setAttribute(k, undefined) would coerce to the string "undefined", which is a truthy attribute
    if (k === 'class') node.className = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
    else if (k === 'html') node.innerHTML = attrs[k];
    else node.setAttribute(k, attrs[k]);
  }
  (children || []).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

// ---------- Icons (inline SVG, no external requests) ----------
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}
const ICON_SHAPES = {
  users: [['path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }], ['circle', { cx: 9, cy: 7, r: 4 }], ['path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87' }], ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }]],
  calendar: [['rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }], ['line', { x1: 16, y1: 2, x2: 16, y2: 6 }], ['line', { x1: 8, y1: 2, x2: 8, y2: 6 }], ['line', { x1: 3, y1: 10, x2: 21, y2: 10 }]],
  clipboard: [['path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }], ['rect', { x: 8, y: 2, width: 8, height: 4, rx: 1, ry: 1 }]],
  activity: [['polyline', { points: '22 12 18 12 15 21 9 3 6 12 2 12' }]],
  shield: [['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }]],
  sun: [['circle', { cx: 12, cy: 12, r: 5 }], ['line', { x1: 12, y1: 1, x2: 12, y2: 3 }], ['line', { x1: 12, y1: 21, x2: 12, y2: 23 }], ['line', { x1: 4.22, y1: 4.22, x2: 5.64, y2: 5.64 }], ['line', { x1: 18.36, y1: 18.36, x2: 19.78, y2: 19.78 }], ['line', { x1: 1, y1: 12, x2: 3, y2: 12 }], ['line', { x1: 21, y1: 12, x2: 23, y2: 12 }], ['line', { x1: 4.22, y1: 19.78, x2: 5.64, y2: 18.36 }], ['line', { x1: 18.36, y1: 5.64, x2: 19.78, y2: 4.22 }]],
  moon: [['path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }]],
  logout: [['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }], ['polyline', { points: '16 17 21 12 16 7' }], ['line', { x1: 21, y1: 12, x2: 9, y2: 12 }]],
  plus: [['line', { x1: 12, y1: 5, x2: 12, y2: 19 }], ['line', { x1: 5, y1: 12, x2: 19, y2: 12 }]],
  download: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }], ['polyline', { points: '7 10 12 15 17 10' }], ['line', { x1: 12, y1: 15, x2: 12, y2: 3 }]],
  pencil: [['path', { d: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' }]],
  trash: [['polyline', { points: '3 6 5 6 21 6' }], ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }], ['line', { x1: 10, y1: 11, x2: 10, y2: 17 }], ['line', { x1: 14, y1: 11, x2: 14, y2: 17 }]],
  'chevron-left': [['polyline', { points: '15 18 9 12 15 6' }]],
  'chevron-right': [['polyline', { points: '9 18 15 12 9 6' }]],
  x: [['line', { x1: 18, y1: 6, x2: 6, y2: 18 }], ['line', { x1: 6, y1: 6, x2: 18, y2: 18 }]],
  menu: [['line', { x1: 3, y1: 12, x2: 21, y2: 12 }], ['line', { x1: 3, y1: 6, x2: 21, y2: 6 }], ['line', { x1: 3, y1: 18, x2: 21, y2: 18 }]],
  heart: [['path', { d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' }]],
  'book-open': [['path', { d: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' }], ['path', { d: 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' }]],
  instagram: [['rect', { x: 2, y: 2, width: 20, height: 20, rx: 5, ry: 5 }], ['circle', { cx: 12, cy: 12, r: 4 }], ['circle', { cx: 17.5, cy: 6.5, r: 1, fill: 'currentColor', stroke: 'none' }]],
  'message-circle': [['path', { d: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' }]],
  'shield-check': [['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }], ['polyline', { points: '9 12 11 14 15 10' }]],
  target: [['circle', { cx: 12, cy: 12, r: 10 }], ['circle', { cx: 12, cy: 12, r: 6 }], ['circle', { cx: 12, cy: 12, r: 2 }]],
  // Pictogram per kategori nomor atletik — dipakai di badge kategori.
  zap: [['polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' }]], // Sprint — eksplosif
  'trending-up': [['polyline', { points: '23 6 13.5 15.5 8.5 10.5 1 18' }], ['polyline', { points: '17 6 23 6 23 12' }]], // Menengah — ritme pace
  compass: [['circle', { cx: 12, cy: 12, r: 10 }], ['polygon', { points: '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76' }]], // Jauh — jelajah jarak
  'arrow-up-circle': [['circle', { cx: 12, cy: 12, r: 10 }], ['polyline', { points: '16 12 12 8 8 12' }], ['line', { x1: 12, y1: 16, x2: 12, y2: 8 }]], // Lompat — gerak vertikal
  // --- Library ikon tambahan (sesi, status, feed) ---
  dumbbell: [['path', { d: 'M6.5 6.5l11 11' }], ['path', { d: 'M17.5 6.5l-11 11' }], ['path', { d: 'M4 8h4v4H4z' }], ['path', { d: 'M16 12h4v4h-4z' }], ['path', { d: 'M4 14h4v4H4z' }], ['path', { d: 'M16 6h4v4h-4z' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 10 }], ['polyline', { points: '12 6 12 12 16 14' }]],
  gauge: [['path', { d: 'M12 15l3.5-3.5' }], ['path', { d: 'M19.4 15a7.1 7.1 0 0 0 .6-3 8 8 0 1 0-16 0 7.1 7.1 0 0 0 .6 3' }], ['path', { d: 'M12 12v.01' }]],
  flag: [['path', { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' }], ['line', { x1: 4, y1: 22, x2: 4, y2: 15 }]],
  'alert-triangle': [['path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }], ['line', { x1: 12, y1: 9, x2: 12, y2: 13 }], ['line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }]],
  'check-circle': [['path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }], ['polyline', { points: '22 4 12 14.01 9 11.01' }]],
  layers: [['polygon', { points: '12 2 2 7 12 12 22 7 12 2' }], ['polyline', { points: '2 17 12 22 22 17' }], ['polyline', { points: '2 12 12 17 22 12' }]],
  wind: [['path', { d: 'M9.59 4.59A2 2 0 1 1 11 8H2' }], ['path', { d: 'M12.59 19.41A2 2 0 1 0 14 16H2' }], ['path', { d: 'M17.74 8.74A2.5 2.5 0 1 1 19.5 13H2' }]],
  droplet: [['path', { d: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z' }]],
  bed: [['path', { d: 'M2 4v16' }], ['path', { d: 'M2 8h18a2 2 0 0 1 2 2v10' }], ['path', { d: 'M2 17h20' }], ['path', { d: 'M6 8v9' }]],
  flame: [['path', { d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z' }]],
  repeat: [['polyline', { points: '17 1 21 5 17 9' }], ['path', { d: 'M3 11V9a4 4 0 0 1 4-4h14' }], ['polyline', { points: '7 23 3 19 7 15' }], ['path', { d: 'M21 13v2a4 4 0 0 1-4 4H3' }]],
  'bar-chart': [['line', { x1: 12, y1: 20, x2: 12, y2: 10 }], ['line', { x1: 18, y1: 20, x2: 18, y2: 4 }], ['line', { x1: 6, y1: 20, x2: 6, y2: 16 }]],
  award: [['circle', { cx: 12, cy: 8, r: 7 }], ['polyline', { points: '8.21 13.89 7 23 12 20 17 23 15.79 13.88' }]],
  timer: [['line', { x1: 10, y1: 2, x2: 14, y2: 2 }], ['line', { x1: 12, y1: 14, x2: 15, y2: 11 }], ['circle', { cx: 12, cy: 14, r: 8 }]],
  'map-pin': [['path', { d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' }], ['circle', { cx: 12, cy: 10, r: 3 }]],
  sparkles: [['path', { d: 'M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z' }], ['path', { d: 'M5 19l.8 2.2L8 22l-2.2.8L5 25l-.8-2.2L2 22l2.2-.8L5 19z' }]],
  lock: [['rect', { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }], ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }]],
  mail: [['path', { d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' }], ['polyline', { points: '22,6 12,13 2,6' }]],
  utensils: [['path', { d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' }], ['path', { d: 'M7 2v20' }], ['path', { d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' }]], // Nutrisi — garpu & pisau
};
const CATEGORY_ICON = { sprint: 'zap', menengah: 'trending-up', jauh: 'compass', lompat: 'arrow-up-circle', renang_gaya_bebas: 'wind', renang_gaya_punggung: 'wind', renang_gaya_dada: 'wind', renang_gaya_kupu: 'zap', renang_gaya_ganti: 'layers' };
function icon(name, extraClass) {
  const shapes = ICON_SHAPES[name];
  const svg = svgEl('svg', { class: 'icon' + (extraClass ? ' ' + extraClass : ''), viewBox: '0 0 24 24' });
  (shapes || []).forEach(([tag, attrs]) => svg.appendChild(svgEl(tag, attrs)));
  return svg;
}

// Ilustrasi empty-state — bentuk besar dari salah satu shape di ICON_SHAPES,
// ditaruh di atas lingkaran lunak beraksen, plus beberapa titik dekoratif.
// Dipakai di tempat yang sebelumnya cuma teks polos (daftar atlet kosong,
// belum ada sesi, dst) — tidak menambah aset gambar baru, cuma menyusun
// ulang shape ikon yang sudah ada dalam skala lebih besar.

/** Pilih ikon sesi dari nama/label/mode (library ikon in-app) */
function sessionIconName(s) {
  const t = ((s && (s.name || s.label || s.goal || '')) + ' ' + (s && s.mode || '')).toLowerCase();
  if (/recover|easy|pemulih|recovery|istirahat|active rest/.test(t)) return 'heart';
  if (/teknik|drill|technique|skill/.test(t)) return 'sparkles';
  if (/kekuat|strength|gym|plyo|pliometr|dryland|angkat/.test(t)) return 'dumbbell';
  if (/sprint|speed|akseler|flying|percepat/.test(t)) return 'zap';
  if (/interval|vo2|quality|rep/.test(t)) return 'timer';
  if (/tempo|threshold|css|ambang/.test(t)) return 'activity';
  if (/long|jauh|distance|endurance|aerob|volume/.test(t)) return 'wind';
  if (/race|lomba|kompetisi|pace/.test(t)) return 'flag';
  if (/approach|lompat|jump|take-?off/.test(t)) return 'arrow-up-circle';
  if (s && (s.mode === 'test' || s.source === 'test')) return 'clipboard';
  if (s && s.override && s.override.kind === 'extra') return 'plus';
  if (s && s.override) return 'pencil';
  return 'layers';
}

function iconBadge(name, tone) {
  return el('span', { class: 'icon-badge' + (tone ? ' icon-badge-' + tone : '') }, [icon(name)]);
}

function emptyIllustration(iconName) {
  const svg = svgEl('svg', { class: 'empty-illustration', viewBox: '0 0 120 120' });
  svg.appendChild(svgEl('circle', { cx: 60, cy: 60, r: 52, fill: 'var(--primary-light)' }));
  const g = svgEl('g', { transform: 'translate(36 36) scale(2)', fill: 'none', stroke: 'var(--primary)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  (ICON_SHAPES[iconName] || []).forEach(([tag, attrs]) => g.appendChild(svgEl(tag, attrs)));
  svg.appendChild(g);
  [[14, 20, 3, 0.35], [108, 90, 4, 0.22], [100, 16, 2.5, 0.3]].forEach(([cx, cy, r, o]) => {
    svg.appendChild(svgEl('circle', { cx, cy, r, fill: 'var(--primary)', opacity: o }));
  });
  return svg;
}

// ---------- Charts (SVG line/bar, hover crosshair + tooltip) ----------
// Dibangun sendiri (bukan library eksternal) supaya konsisten dengan CSP
// tanpa-CDN & arsitektur tanpa-build-step aplikasi ini — pola sama dengan
// timeline periodisasi & gauge ACWR yang sudah ada. Interaksi hover
// dipasang langsung ke node yang dibuat, TIDAK memanggil render() global,
// supaya gerakan pointer tetap mulus (re-render seluruh app tiap pointermove
// akan terasa berat/patah-patah).
function fmtDateShort(str) {
  if (!str) return '-';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function niceTicks(min, max, count) {
  if (min === max) { min -= 1; max += 1; }
  const ticks = [];
  for (let i = 0; i < count; i++) ticks.push(min + ((max - min) * i) / (count - 1));
  return ticks;
}

function roundedTopBarPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

function chartTooltipEl() {
  return el('div', { class: 'chart-tooltip' });
}
// Tooltip DIPAKUKAN di dekat atas kartu chart (bukan mengikuti tinggi titik
// yang di-hover) — .chart-scroll butuh overflow-x:auto untuk geser di layar
// sempit, tapi itu membuat overflow-y ikut kepotong (aturan CSS: kalau
// overflow-x bukan visible, overflow-y otomatis jadi auto juga). Tooltip
// yang coba muncul DI ATAS titik (translateY -100%) jadi kepotong kalau
// titiknya dekat puncak grafik. Dipaku dekat atas, cuma geser horizontal
// mengikuti crosshair, tetap selalu di dalam area yang tidak kepotong.
function positionTooltip(tooltip, xPct) {
  tooltip.style.opacity = '1';
  tooltip.style.left = `${xPct * 100}%`;
  tooltip.style.top = '2px';
  tooltip.style.transform = xPct > 0.72 ? 'translateX(-100%)' : xPct < 0.14 ? 'translateX(0)' : 'translateX(-50%)';
}

// points: [{ x: 'YYYY-MM-DD', y: number|null }] urut kronologis (lama→baru).
// bands (opsional): [{ from, to, color }] — zona referensi warna latar,
// mis. zona risiko ACWR (bukan seri data tambahan, murni referensi visual).
function buildLineChart({ points, height = 180, color = 'var(--primary)', valueFormat = (v) => String(v), yMin, yMax, bands, emptyText = 'Belum cukup data untuk grafik tren (butuh minimal 2 titik).' }) {
  const valid = points.filter((p) => p.y != null);
  if (valid.length < 2) return el('div', { class: 'chart-empty' }, [emptyText]);

  const VBW = 640, VBH = height;
  const padL = 52, padR = 14, padT = 16, padB = 24;
  const plotW = VBW - padL - padR;
  const plotH = VBH - padT - padB;

  const values = valid.map((p) => p.y);
  let lo = yMin != null ? yMin : Math.min(...values);
  let hi = yMax != null ? yMax : Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  if (yMin == null) lo -= pad;
  if (yMax == null) hi += pad;

  const n = points.length;
  const xAt = (i) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const yAt = (v) => padT + (1 - (v - lo) / (hi - lo)) * plotH;

  const svg = svgEl('svg', { viewBox: `0 0 ${VBW} ${VBH}`, class: 'chart-svg', preserveAspectRatio: 'xMidYMid meet' });

  (bands || []).forEach((b) => {
    const y1 = yAt(Math.min(b.to, hi));
    const y2 = yAt(Math.max(b.from, lo));
    if (y2 <= y1) return;
    svg.appendChild(svgEl('rect', { x: padL, y: y1, width: plotW, height: y2 - y1, fill: b.color }));
  });

  niceTicks(lo + pad * 0.4, hi - pad * 0.4, 3).forEach((t) => {
    const y = yAt(t);
    svg.appendChild(svgEl('line', { x1: padL, x2: padL + plotW, y1: y, y2: y, class: 'chart-gridline' }));
    const label = svgEl('text', { x: padL - 6, y: y + 3, class: 'chart-tick-label', 'text-anchor': 'end' });
    label.textContent = valueFormat(t);
    svg.appendChild(label);
  });

  // Path dipecah per segmen kontinu — melompati titik null (bukan menyambung
  // lurus seolah-olah ada data di antara dua tanggal yang sebenarnya kosong).
  let segment = [];
  const segments = [];
  points.forEach((p, i) => {
    if (p.y == null) { if (segment.length) segments.push(segment); segment = []; return; }
    segment.push([xAt(i), yAt(p.y)]);
  });
  if (segment.length) segments.push(segment);

  segments.forEach((seg) => {
    if (seg.length < 2) return;
    const d = seg.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
    const areaD = `${d} L${seg[seg.length - 1][0]},${padT + plotH} L${seg[0][0]},${padT + plotH} Z`;
    svg.appendChild(svgEl('path', { d: areaD, fill: `color-mix(in srgb, ${color} 10%, transparent)`, stroke: 'none' }));
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  });

  let lastIdx = -1;
  for (let i = points.length - 1; i >= 0; i--) if (points[i].y != null) { lastIdx = i; break; }
  if (lastIdx >= 0) {
    const lx = xAt(lastIdx), ly = yAt(points[lastIdx].y);
    svg.appendChild(svgEl('circle', { cx: lx, cy: ly, r: 6, fill: 'var(--surface)' }));
    svg.appendChild(svgEl('circle', { cx: lx, cy: ly, r: 4, fill: color }));
    const nearRight = lx > VBW - 70;
    const lbl = svgEl('text', { x: nearRight ? lx - 8 : lx + 8, y: ly - 8, class: 'chart-end-label', 'text-anchor': nearRight ? 'end' : 'start' });
    lbl.textContent = valueFormat(points[lastIdx].y);
    svg.appendChild(lbl);
  }

  const firstLabel = svgEl('text', { x: padL, y: VBH - 4, class: 'chart-axis-label', 'text-anchor': 'start' });
  firstLabel.textContent = fmtDateShort(points[0].x);
  const lastLabel = svgEl('text', { x: padL + plotW, y: VBH - 4, class: 'chart-axis-label', 'text-anchor': 'end' });
  lastLabel.textContent = fmtDateShort(points[points.length - 1].x);
  svg.appendChild(firstLabel);
  svg.appendChild(lastLabel);

  const crosshair = svgEl('line', { x1: 0, x2: 0, y1: padT, y2: padT + plotH, class: 'chart-crosshair' });
  const hoverDot = svgEl('circle', { r: 5, class: 'chart-hover-dot' });
  svg.appendChild(crosshair);
  svg.appendChild(hoverDot);

  const tooltip = chartTooltipEl();
  const hitRect = svgEl('rect', { x: padL, y: padT, width: plotW, height: plotH, class: 'chart-hit' });

  function showAt(clientX, svgRect) {
    const relX = ((clientX - svgRect.left) / svgRect.width) * VBW;
    let idx = Math.round(((relX - padL) / plotW) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    const p = points[idx];
    const x = xAt(idx);
    crosshair.setAttribute('x1', x); crosshair.setAttribute('x2', x); crosshair.classList.add('visible');
    if (p.y != null) {
      hoverDot.setAttribute('cx', x); hoverDot.setAttribute('cy', yAt(p.y)); hoverDot.classList.add('visible');
      tooltip.textContent = `${fmtDate(p.x)} · ${valueFormat(p.y)}`;
      positionTooltip(tooltip, x / VBW);
    } else {
      hoverDot.classList.remove('visible');
      tooltip.style.opacity = '0';
    }
  }
  hitRect.addEventListener('pointermove', (e) => showAt(e.clientX, svg.getBoundingClientRect()));
  hitRect.addEventListener('pointerleave', () => {
    crosshair.classList.remove('visible');
    hoverDot.classList.remove('visible');
    tooltip.style.opacity = '0';
  });
  svg.appendChild(hitRect);

  return el('div', { class: 'chart-scroll chart-plot-fill' }, [el('div', { class: 'chart-wrap' }, [svg, tooltip])]);
}

// points: [{ x: 'YYYY-MM-DD', y: number }] urut kronologis.
function buildBarChart({ points, height = 140, color = 'var(--primary)', valueFormat = (v) => String(v) }) {
  const valid = points.filter((p) => p.y != null && p.y > 0);
  if (valid.length < 2) return el('div', { class: 'chart-empty' }, ['Belum cukup data untuk grafik (butuh minimal 2 hari tercatat).']);

  const VBW = 640, VBH = height;
  const padL = 48, padR = 12, padT = 14, padB = 24;
  const plotW = VBW - padL - padR;
  const plotH = VBH - padT - padB;

  const n = points.length;
  const maxV = Math.max(...points.map((p) => p.y || 0), 1);
  const yAt = (v) => padT + (1 - v / maxV) * plotH;
  const slot = plotW / n;
  const barW = Math.min(24, slot * 0.6);
  const baseline = padT + plotH;

  const svg = svgEl('svg', { viewBox: `0 0 ${VBW} ${VBH}`, class: 'chart-svg', preserveAspectRatio: 'xMidYMid meet' });

  niceTicks(0, maxV, 3).forEach((t) => {
    const y = yAt(t);
    svg.appendChild(svgEl('line', { x1: padL, x2: padL + plotW, y1: y, y2: y, class: 'chart-gridline' }));
    const label = svgEl('text', { x: padL - 6, y: y + 3, class: 'chart-tick-label', 'text-anchor': 'end' });
    label.textContent = String(Math.round(t));
    svg.appendChild(label);
  });

  const tooltip = chartTooltipEl();

  points.forEach((p, i) => {
    const cx = padL + slot * (i + 0.5);
    const v = p.y || 0;
    const y = yAt(v);
    const barH = Math.max(baseline - y, v > 0 ? 2 : 0);
    const path = svgEl('path', { d: roundedTopBarPath(cx - barW / 2, baseline - barH, barW, barH, 4), fill: color, class: 'chart-bar' });
    svg.appendChild(path);
    const hit = svgEl('rect', { x: cx - slot / 2, y: padT, width: slot, height: plotH, class: 'chart-hit' });
    hit.addEventListener('pointerenter', () => {
      path.classList.add('chart-bar-hover');
      tooltip.textContent = `${fmtDate(p.x)} · ${valueFormat(v)}`;
      positionTooltip(tooltip, cx / VBW);
    });
    hit.addEventListener('pointerleave', () => {
      path.classList.remove('chart-bar-hover');
      tooltip.style.opacity = '0';
    });
    svg.appendChild(hit);
  });

  const firstLabel = svgEl('text', { x: padL, y: VBH - 4, class: 'chart-axis-label', 'text-anchor': 'start' });
  firstLabel.textContent = fmtDateShort(points[0].x);
  const lastLabel = svgEl('text', { x: padL + plotW, y: VBH - 4, class: 'chart-axis-label', 'text-anchor': 'end' });
  lastLabel.textContent = fmtDateShort(points[points.length - 1].x);
  svg.appendChild(firstLabel);
  svg.appendChild(lastLabel);

  return el('div', { class: 'chart-scroll chart-plot-fill' }, [el('div', { class: 'chart-wrap' }, [svg, tooltip])]);
}

// ---------- Theme (light/dark) ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}

function applyPalette(palette) {
  const p = palette || 'indigo';
  document.documentElement.setAttribute('data-palette', p);
  try { localStorage.setItem('ui-palette', p); } catch (_) {}
  state.palette = p;
}

function applyFont(font) {
  const f = font || 'system';
  document.documentElement.setAttribute('data-font', f);
  try { localStorage.setItem('ui-font', f); } catch (_) {}
  state.font = f;
}

const PALETTE_OPTIONS = [
  { id: 'indigo', label: 'Indigo', hint: 'Standar — fokus & profesional' },
  { id: 'ocean', label: 'Ocean', hint: 'Teal — segar, nuansa performa' },
  { id: 'ember', label: 'Ember', hint: 'Navy + amber — hangat & tegas' },
];

const FONT_OPTIONS = [
  { id: 'system', label: 'Sistem', hint: 'Font bawaan perangkat' },
  { id: 'modern', label: 'Modern', hint: 'Inter — rapi di layar' },
  { id: 'sport', label: 'Sport', hint: 'Lebih tegas, angka jelas' },
];

function currentTheme() {
  return document.documentElement.dataset.theme
    || localStorage.getItem('theme')
    || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  render();
}
const storedTheme = localStorage.getItem('theme');
try {
  applyPalette(localStorage.getItem('ui-palette') || 'indigo');
  applyFont(localStorage.getItem('ui-font') || 'system');
} catch (_) {}

if (storedTheme) applyTheme(storedTheme);

function fmtDate(str) {
  if (!str) return '-';
  const d = new Date(str + (str.length <= 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Tanggal lokal hari ini sebagai 'YYYY-MM-DD' — BUKAN toISOString().slice(0,10),
// yang mengonversi ke UTC dan bisa memberi tanggal KEMARIN untuk pengguna di
// WIB/WITA/WIT pada jam-jam pagi (lihat lib/dateUtil.js untuk versi server-side).
function todayLocalDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// ---------- Bootstrap ----------
async function bootstrap() {
  const params = new URLSearchParams(location.search);
  const resetTok = params.get('reset');
  // Tautan email: /?reset=TOKEN harus buka form password, bukan landing.
  if (resetTok) {
    state.view = 'auth';
    state.authMode = 'reset';
    state.resetToken = resetTok;
    render();
    return;
  }
  try {
    state.user = await api('GET', '/auth/me');
    state.view = 'app';
    state.categories = await api('GET', '/athletes/categories');
    await loadAthletes();
  } catch (e) {
    // Link luar (bio Instagram, pesan WA) bisa lompat langsung ke form
    // masuk/daftar tanpa mampir landing page dulu lewat ?masuk=1 / ?daftar=1.
    if (params.has('masuk') || params.has('daftar')) {
      state.view = 'auth';
      state.authMode = params.has('daftar') ? 'register' : 'login';
    } else {
      state.view = 'landing';
      if (params.has('pelatih')) state.landingMode = 'coach';
      // Tautan "Buka program lengkap" dari email hasil kuesioner.
      if (params.get('program')) {
        render();
        funnelOpenFromLead(params.get('program'));
        return;
      }
      // Atlet yang sudah login tidak perlu melihat selling page lagi.
      if (!params.has('beranda') && !params.has('pelatih')) {
        try {
          const me = await api('GET', '/athlete/auth/me');
          if (me && me.id) { location.replace('/athlete'); return; }
        } catch (_) { /* belum login sebagai atlet */ }
      }
    }
  }
  render();
}

async function loadAthletes() {
  // Admin bisa melihat semua atlet; filter "Lihat atlet" di Panel Admin
  // harus ikut ke GET /athletes (bukan cuma portal-day). Tanpa query
  // coachId, backend admin mengembalikan seluruh roster lintas pelatih.
  const filterId = state.adminFilterCoachId;
  const q = filterId ? `?coachId=${encodeURIComponent(filterId)}` : '';
  let list = await api('GET', '/athletes' + q);
  if (filterId != null && Array.isArray(list)) {
    const idNum = Number(filterId);
    list = list.filter((a) => Number(a.coachId) === idNum);
  }
  state.athletes = list;
  if (state.user && state.user.role === 'admin' && !state.adminCoaches) {
    try { state.adminCoaches = await api('GET', '/admin/coaches'); } catch (_) { /* panel tetap bisa dimuat manual */ }
  }
  try {
    state.portalDay = await api('GET', `/athletes/portal-day${q}`);
  } catch (_) {
    state.portalDay = null;
  }
}

// Dipanggil setelah login/register/admin-setup berhasil — bootstrap() saja
// tidak cukup karena hanya jalan sekali di awal load halaman, bukan setelah
// aksi auth di dalam SPA.
async function afterAuthSuccess() {
  if (!state.categories) state.categories = await api('GET', '/athletes/categories');
  await loadAthletes();
}

// ---------- Auth screens ----------
// ---------- Landing page ----------
// Lambang merek — badge kotak membulat + 3 batang menaik (progres/performa),
// versi skalabel dari favicon (lihat index.html). Dipakai ulang di nav,
// hero, dan footer supaya konsisten satu identitas visual.
function brandMark(size) {
  const s = size || 40;
  const svg = svgEl('svg', { viewBox: '0 0 32 32', width: s, height: s, class: 'brand-mark' });
  svg.appendChild(svgEl('rect', { width: 32, height: 32, rx: 9, fill: 'var(--primary)' }));
  svg.appendChild(svgEl('rect', { x: 7, y: 17, width: 4, height: 8, rx: 1.5, fill: 'var(--on-primary)' }));
  svg.appendChild(svgEl('rect', { x: 14, y: 12, width: 4, height: 13, rx: 1.5, fill: 'var(--on-primary)' }));
  svg.appendChild(svgEl('rect', { x: 21, y: 6, width: 4, height: 19, rx: 1.5, fill: 'var(--on-primary)' }));
  return svg;
}

function goToAuth(mode) {
  return (e) => { e.preventDefault(); state.authMode = mode; state.error = null; state.view = 'auth'; render(); };
}

const LANDING_FEATURES = [
  ['activity', 'Periodisasi Otomatis', 'Fase latihan berubah otomatis mengikuti sisa waktu ke kompetisi — Persiapan Umum, Khusus, Puncak, hingga Transisi.'],
  ['target', 'Personalisasi Berbasis Data', 'Volume latihan disesuaikan dari level prestasi & risiko ACWR tiap atlet — bukan angka pukul rata.'],
  ['utensils', 'Nutrisi Atlet', 'Target kalori, karbo, protein, lemak, dan cairan dihitung dari fase latihan. Menu minggu disusun dari pangan lokal; paket pemulihan aktif saat ada cedera.'],
  ['heart', 'Pantau Risiko Cedera', 'Grafik tren ACWR & beban latihan harian, volume otomatis dikurangi saat beban melonjak terlalu cepat.'],
  ['trending-up', 'Grafik Progres Hasil Tes', 'VDOT, RAST Power, hingga prestasi lomba — tervisualisasi dan dibandingkan benchmark. Jadwal tes berikutnya & tes terlewat tampil di program dan tab Tes.'],
  ['zap', '4 Kategori Nomor', 'Sprint, Menengah, Jauh, dan Lompat — masing-masing dengan mesin program, protokol tes, dan layout pemantauan yang sesuai.'],
  ['calendar', 'Kalender & Ekspor Word', 'Lihat jadwal latihan sebulan penuh, unduh program lengkap sebagai dokumen Word kapan saja.'],
  ['users', 'Portal Atlet', 'Atlet bisa mencatat latihan, wellness, dan melihat program dari HP — pelatih tetap memegang kendali akses.'],
];

const LANDING_TEAM = {
  ketua: 'Dr. dr. I Putu Adiartha Griadhi, S.Ked., M.Fis.',
  anggota: [
    'Dr. I Nyoman Sudarmada, S.Pd., M.Pd.',
    'Dr. dr. Nila Wahyuni, S.Ked., M.Fis.',
    'Dr. dr. Indira Vidiari Juhannya, S.Ked., M.Fis.',
  ],
};

const IG_HANDLE = 'atletik_pro';
const WA_NUMBER = '081999636899';
const WA_LINK = `https://wa.me/62${WA_NUMBER.replace(/^0/, '')}`;
const IG_LINK = `https://instagram.com/${IG_HANDLE}`;

// Halaman depan: pengunjung umum melihat selling page kuesioner atlet
// (public/funnel.js); landing lama khusus pelatih tetap ada lewat menu
// "Untuk Pelatih" atau tautan /?pelatih=1.
function renderLanding() {
  if (state.landingMode === 'coach') return renderCoachLanding();
  return renderFunnel();
}

function renderCoachLanding() {
  try {
    document.documentElement.setAttribute('data-ui', 'landing');
    document.documentElement.removeAttribute('data-drawer');
    document.body.style.overflow = '';
    document.body.style.height = '';
  } catch (_) {}
  const nav = el('header', { class: 'landing-nav' }, [
    el('div', { class: 'landing-nav-inner' }, [
      el('div', { class: 'landing-brand' }, [brandMark(32), el('span', { class: 'brand', html: 'Atletik <span class="accent">Pro Id</span>' })]),
      el('nav', { class: 'landing-nav-links' }, [
        el('a', { href: '#', onclick: (e) => { e.preventDefault(); state.landingMode = null; render(); window.scrollTo(0, 0); } }, ['Untuk Atlet']),
        el('a', { href: '#fitur' }, ['Fitur']),
        el('a', { href: '#tim' }, ['Tim']),
        el('a', { href: '#kontak' }, ['Kontak']),
      ]),
      el('button', { class: 'secondary', onclick: goToAuth('login') }, ['Masuk']),
    ]),
  ]);

  const hero = el('section', { class: 'landing-hero' }, [
    el('div', { class: 'landing-hero-copy' }, [
      el('span', { class: 'eyebrow' }, ['Untuk Pelatih Atletik Indonesia']),
      el('h1', {}, ['Latihan yang Terukur, Bukan Sekadar Terjadwal']),
      el('p', { class: 'landing-lede' }, ['Atletik Pro Id menyusun program latihan, jadwal tes, dan rencana nutrisi otomatis dari hasil tes & data harian atlet Anda — periodisasi, personalisasi, pemantauan cedera, dan menu makan berbasis pedoman gizi atlet.']),
      el('div', { class: 'landing-cta-row' }, [
        el('button', { onclick: goToAuth('register') }, [icon('plus'), 'Daftar Sebagai Pelatih']),
        el('button', { class: 'secondary', onclick: goToAuth('login') }, ['Masuk ke Akun']),
      ]),
    ]),
    el('div', { class: 'landing-hero-preview card' }, [
      el('div', { class: 'phase-header' }, [
        el('h3', {}, ['Fase Periodisasi Saat Ini']),
        el('span', { class: 'badge badge-khusus' }, ['Persiapan Khusus']),
      ]),
      el('div', { class: 'periodization-timeline' }, [
        el('div', { class: 'timeline-track' }, [
          el('div', { class: 'timeline-fill', style: 'width:58%;background:var(--khusus);' }),
          el('div', { class: 'timeline-marker', style: 'left:58%;background:var(--khusus);' }),
        ]),
      ]),
      el('div', { class: 'row', style: 'margin-top:16px;' }, [
        el('span', { class: 'muted' }, ['ACWR saat ini']),
        el('span', { class: 'badge badge-ok' }, ['1.12 — Aman']),
      ]),
      el('div', { class: 'row', style: 'margin-top:10px;' }, [
        el('span', { class: 'muted' }, [icon('utensils'), ' Nutrisi hari ini']),
        el('span', { class: 'badge badge-ok' }, ['3040 kkal · 2.9 L']),
      ]),
    ]),
  ]);

  const features = el('section', { class: 'landing-section', id: 'fitur' }, [
    el('h2', {}, ['Semua yang Dibutuhkan untuk Melatih dengan Data']),
    el('div', { class: 'landing-feature-grid' }, LANDING_FEATURES.map(([ic, title, desc]) => el('div', { class: 'landing-feature-card' }, [
      el('div', { class: 'landing-feature-icon' }, [icon(ic)]),
      el('h3', {}, [title]),
      el('p', { class: 'muted' }, [desc]),
    ]))),
  ]);

  const stats = state.publicStats;
  const statsSection = el('section', { class: 'landing-section landing-stats', id: 'dampak' }, [
    el('div', { class: 'landing-stats-grid' }, [
      el('div', { class: 'landing-stat' }, [
        el('div', { class: 'landing-stat-value' }, [
          stats && typeof stats.coachCount === 'number' ? String(stats.coachCount) : '—',
        ]),
        el('div', { class: 'landing-stat-label muted' }, ['Pelatih terdaftar']),
      ]),
      el('div', { class: 'landing-stat' }, [
        el('div', { class: 'landing-stat-value' }, [
          stats && typeof stats.athleteCount === 'number' ? String(stats.athleteCount) : '—',
        ]),
        el('div', { class: 'landing-stat-label muted' }, ['Atlet tercover']),
      ]),
    ]),
    el('p', { class: 'landing-stats-note muted' }, [
      'Angka di atas diperbarui otomatis dari data platform.',
    ]),
  ]);

  // Tim pengembang — naratif, tidak menonjol (bukan kartu/avatar)
  const anggotaList = LANDING_TEAM.anggota.join('; ');
  const team = el('section', { class: 'landing-section landing-team-narrative', id: 'tim' }, [
    el('p', { class: 'landing-team-prose muted' }, [
      'Platform ini dikembangkan di bawah arahan ',
      el('strong', {}, [LANDING_TEAM.ketua]),
      ' sebagai ketua, bersama ',
      el('strong', {}, [anggotaList]),
      '. Kolaborasi akademisi fisiologi olahraga ini memastikan logika di balik setiap angka program dapat dipertanggungjawabkan secara ilmiah.',
    ]),
  ]);

  const contact = el('section', { class: 'landing-section', id: 'kontak' }, [
    el('h2', {}, ['Ada Pertanyaan?']),
    el('p', { class: 'landing-section-intro muted' }, ['Hubungi kami langsung lewat WhatsApp atau ikuti Instagram untuk update fitur & tips melatih.']),
    el('div', { class: 'landing-contact-grid' }, [
      el('a', { class: 'landing-contact-card', href: WA_LINK, target: '_blank', rel: 'noopener noreferrer' }, [
        el('div', { class: 'landing-contact-icon' }, [icon('message-circle')]),
        el('div', {}, [
          el('div', { class: 'landing-team-name' }, ['WhatsApp']),
          el('div', { class: 'muted' }, [WA_NUMBER]),
        ]),
      ]),
      el('a', { class: 'landing-contact-card', href: IG_LINK, target: '_blank', rel: 'noopener noreferrer' }, [
        el('div', { class: 'landing-contact-icon' }, [icon('instagram')]),
        el('div', {}, [
          el('div', { class: 'landing-team-name' }, ['Instagram']),
          el('div', { class: 'muted' }, [`@${IG_HANDLE}`]),
        ]),
      ]),
    ]),
  ]);

  const footer = el('footer', { class: 'landing-footer' }, [
    el('div', { class: 'landing-brand' }, [brandMark(24), el('span', { class: 'brand', html: 'Atletik <span class="accent">Pro Id</span>' })]),
    el('div', { class: 'landing-footer-links' }, [
      el('a', { href: WA_LINK, target: '_blank', rel: 'noopener noreferrer' }, [icon('message-circle'), 'WhatsApp']),
      el('a', { href: IG_LINK, target: '_blank', rel: 'noopener noreferrer' }, [icon('instagram'), `@${IG_HANDLE}`]),
    ]),
    el('div', { class: 'muted landing-footer-copy' }, [
      `© ${new Date().getFullYear()} Atletik Pro Id. PT Artha Sarana Saintifika bersama Universitas Udayana.`,
    ]),
  ]);

  root.innerHTML = '';
  root.appendChild(el('div', { class: 'landing' }, [nav, hero, statsSection, features, team, contact, footer]));

  // Muat statistik publik sekali (pelatih & atlet) untuk angka di landing
  if (!state.publicStatsLoading && state.publicStats == null) {
    state.publicStatsLoading = true;
    api('GET', '/public/stats')
      .then((data) => {
        state.publicStats = data || { coachCount: 0, athleteCount: 0 };
        state.publicStatsLoading = false;
        if (state.view === 'landing') render();
      })
      .catch(() => {
        state.publicStats = { coachCount: 0, athleteCount: 0 };
        state.publicStatsLoading = false;
        if (state.view === 'landing') render();
      });
  }
}

function renderAuth() {
  try { document.documentElement.setAttribute('data-ui', 'auth'); } catch (_) {}
  const authMode = state.authMode || 'login';
  const wrap = el('div', { class: 'center-screen' }, [
    el('div', { class: 'card', style: 'width:100%;max-width:400px;' }, [
      el('div', { class: 'brand', html: 'Atletik <span class="accent">Pro Id</span>' }),
      el('p', { class: 'muted' }, ['Platform manajemen program latihan atletik.']),
      state.error ? el('div', { class: 'error-box' }, [state.error]) : null,
      state.successMessage ? el('div', { class: 'callout callout-ok', style: 'margin-bottom:12px;' }, [state.successMessage]) : null,
      authMode === 'login' ? renderLoginForm()
        : authMode === 'register' ? renderRegisterForm()
        : authMode === 'forgot' ? renderForgotForm()
        : authMode === 'reset' ? renderResetForm()
        : renderLoginForm(),
      el('div', { class: 'footer-link' }, [
        authMode === 'login'
          ? el('div', {}, [
            el('a', { href: '#', onclick: (e) => { e.preventDefault(); state.authMode = 'forgot'; state.error = null; state.successMessage = null; render(); } }, ['Lupa password?']),
            el('span', { class: 'muted' }, [' · ']),
            el('a', { href: '#', onclick: (e) => { e.preventDefault(); state.authMode = 'register'; state.error = null; render(); } }, ['Belum punya akun? Daftar']),
          ])
          : authMode === 'forgot' || authMode === 'reset'
            ? el('a', { href: '#', onclick: (e) => { e.preventDefault(); state.authMode = 'login'; state.error = null; state.resetToken = null; render(); } }, ['← Kembali ke masuk'])
            : el('a', { href: '#', onclick: (e) => { e.preventDefault(); state.authMode = 'login'; state.error = null; render(); } }, ['Sudah punya akun? Masuk']),
      ]),
      el('div', { class: 'footer-link' }, [
        el('a', { href: '#', onclick: (e) => { e.preventDefault(); state.view = 'admin-setup'; state.error = null; render(); } }, ['Setup Admin Pertama Kali']),
      ]),
      el('div', { class: 'footer-link' }, [
        el('a', { href: '#', onclick: (e) => { e.preventDefault(); state.view = 'landing'; state.error = null; render(); } }, ['← Kembali ke beranda']),
      ]),
    ]),
  ]);
  root.innerHTML = '';
  root.appendChild(wrap);
}


function renderForgotForm() {
  const emailInput = el('input', { type: 'email', required: 'true', placeholder: 'email@contoh.com' });
  return el('form', {
    autocomplete: 'off',
    onsubmit: async (e) => {
      e.preventDefault();
      state.error = null;
      state.forgotResult = null;
      try {
        const res = await api('POST', '/auth/forgot-password', { email: emailInput.value });
        state.forgotResult = res;
        state.successMessage = res.message || 'Permintaan reset diproses.';
        if (res.resetUrl) {
          state.authMode = 'reset';
          // extract token
          try {
            const u = new URL(res.resetUrl);
            state.resetToken = u.searchParams.get('reset');
          } catch (_) {
            state.resetToken = null;
          }
        }
      } catch (err) {
        state.error = err.message;
      }
      render();
    },
  }, [
    el('p', { class: 'muted' }, ['Masukkan email akun pelatih. Anda akan mendapat tautan untuk mengatur password baru (berlaku 1 jam).']),
    el('div', {}, [el('label', {}, ['Email']), emailInput]),
    el('button', { type: 'submit' }, ['Kirim tautan reset']),
    state.forgotResult && state.forgotResult.resetUrl
      ? el('div', { class: 'callout callout-ok', style: 'margin-top:12px;' }, [
        el('p', {}, [el('strong', {}, ['Tautan reset (salin):'])]),
        el('input', {
          type: 'text',
          readonly: 'true',
          value: state.forgotResult.resetUrl,
          style: 'width:100%;font-size:0.8rem;',
          onclick: (e) => e.target.select(),
        }),
        el('button', {
          type: 'button', class: 'secondary', style: 'margin-top:8px;width:100%;',
          onclick: () => {
            const url = state.forgotResult.resetUrl;
            if (navigator.clipboard) navigator.clipboard.writeText(url);
            state.authMode = 'reset';
            try { state.resetToken = new URL(url).searchParams.get('reset'); } catch (_) {}
            render();
          },
        }, ['Lanjut atur password baru']),
      ])
      : null,
  ]);
}

function renderResetForm() {
  const passInput = el('input', { type: 'password', required: 'true', minlength: '8', placeholder: 'Minimal 8 karakter' });
  const pass2 = el('input', { type: 'password', required: 'true', minlength: '8', placeholder: 'Ulangi password' });
  return el('form', {
    autocomplete: 'off',
    onsubmit: async (e) => {
      e.preventDefault();
      state.error = null;
      if (passInput.value !== pass2.value) {
        state.error = 'Password tidak sama';
        render();
        return;
      }
      try {
        const res = await api('POST', '/auth/reset-password', {
          token: state.resetToken,
          password: passInput.value,
        });
        state.successMessage = res.message || 'Password diubah. Silakan masuk.';
        state.authMode = 'login';
        state.resetToken = null;
        state.forgotResult = null;
        // bersihkan query string
        try { history.replaceState({}, '', '/'); } catch (_) {}
      } catch (err) {
        state.error = err.message;
      }
      render();
    },
  }, [
    el('p', { class: 'muted' }, ['Masukkan password baru untuk akun Anda.']),
    el('div', {}, [el('label', {}, ['Password baru']), passInput]),
    el('div', {}, [el('label', {}, ['Ulangi password']), pass2]),
    el('button', { type: 'submit' }, ['Simpan password baru']),
  ]);
}

function renderLoginForm() {
  const emailInput = el('input', { type: 'email', required: 'true', id: 'login-email' });
  const passInput = el('input', { type: 'password', required: 'true', id: 'login-password' });
  return el('form', {
    autocomplete: 'off',
    onsubmit: async (e) => {
      e.preventDefault();
      state.error = null;
      try {
        state.user = await api('POST', '/auth/login', { email: emailInput.value, password: passInput.value });
        state.view = 'app';
        await afterAuthSuccess();
      } catch (err) {
        state.error = err.message;
      }
      render();
    },
  }, [
    el('div', {}, [el('label', {}, ['Email']), emailInput]),
    el('div', {}, [el('label', {}, ['Password']), passInput]),
    el('button', { type: 'submit' }, ['Masuk']),
  ]);
}

function renderRegisterForm() {
  const nameInput = el('input', { required: 'true' });
  const emailInput = el('input', { type: 'email', required: 'true' });
  const passInput = el('input', { type: 'password', required: 'true', minlength: '8' });
  return el('form', {
    autocomplete: 'off',
    onsubmit: async (e) => {
      e.preventDefault();
      state.error = null;
      try {
        state.user = await api('POST', '/auth/register', { name: nameInput.value, email: emailInput.value, password: passInput.value });
        state.view = 'app';
        await afterAuthSuccess();
      } catch (err) {
        state.error = err.message;
      }
      render();
    },
  }, [
    el('div', {}, [el('label', {}, ['Nama']), nameInput]),
    el('div', {}, [el('label', {}, ['Email']), emailInput]),
    el('div', {}, [el('label', {}, ['Password (minimal 8 karakter)']), passInput]),
    el('button', { type: 'submit' }, ['Daftar sebagai Pelatih']),
  ]);
}

function renderAdminSetup() {
  const nameInput = el('input', { required: 'true' });
  const emailInput = el('input', { type: 'email', required: 'true' });
  const passInput = el('input', { type: 'password', required: 'true', minlength: '8' });
  const keyInput = el('input', { type: 'text', required: 'true' });

  const wrap = el('div', { class: 'center-screen' }, [
    el('div', { class: 'card', style: 'width:100%;max-width:400px;' }, [
      el('h2', {}, ['Setup Admin Pertama Kali']),
      el('p', { class: 'muted' }, ['Hanya bisa dipakai sekali. Butuh kode setup yang sama dengan ADMIN_SETUP_KEY di server.']),
      state.error ? el('div', { class: 'error-box' }, [state.error]) : null,
      el('form', {
    autocomplete: 'off',
        onsubmit: async (e) => {
          e.preventDefault();
          state.error = null;
          try {
            state.user = await api('POST', '/auth/admin-setup', {
              name: nameInput.value, email: emailInput.value, password: passInput.value, setupKey: keyInput.value,
            });
            state.view = 'app';
            await afterAuthSuccess();
          } catch (err) {
            state.error = err.message;
          }
          render();
        },
      }, [
        el('div', {}, [el('label', {}, ['Nama']), nameInput]),
        el('div', {}, [el('label', {}, ['Email']), emailInput]),
        el('div', {}, [el('label', {}, ['Password (minimal 8 karakter)']), passInput]),
        el('div', {}, [el('label', {}, ['Kode Setup (ADMIN_SETUP_KEY)']), keyInput]),
        el('button', { type: 'submit' }, ['Buat Akun Admin']),
      ]),
      el('div', { class: 'footer-link' }, [
        el('a', { href: '#', onclick: (e) => { e.preventDefault(); state.view = 'auth'; state.error = null; render(); } }, ['Kembali ke halaman masuk']),
      ]),
    ]),
  ]);
  root.innerHTML = '';
  root.appendChild(wrap);
}

// ---------- Main app shell ----------
function pageTitle() {
  if (state.showGuide) return 'Panduan Istilah';
  if (state.selectedAthleteId) {
    if (state.view === 'athlete-edit') return 'Ubah Atlet';
    const a = state.athletes.find((x) => x.id === state.selectedAthleteId);
    return a ? a.profile.nama : 'Atlet';
  }
  if (state.view === 'athlete-form') return 'Tambah Atlet';
  return 'Atlet';
}


/** Toast notifikasi singkat */

/** Mode HP: lebar ≤640px — densitas rendah, default jadwal harian */
function isMobileUi() {
  try {
    return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  } catch (_) {
    return typeof window !== 'undefined' && window.innerWidth <= 640;
  }
}

function applyMobileUiDefaults() {
  try {
    document.documentElement.setAttribute('data-mobile', isMobileUi() ? '1' : '0');
  } catch (_) {}
  if (isMobileUi()) {
    state.scheduleView = 'day';
    try {
      if (localStorage.getItem('coach-full-mobile') === '1') state.coachFullMobile = true;
    } catch (_) {}
  } else {
    state.coachFullMobile = false;
  }
}


/** Preferensi ukuran panel (localStorage) — default standar, user bisa drag */
const PANEL_DEFAULTS = {
  'mod-h': 50,      // form | grafik (%)
  'mod-v': 78,      // area atas vs riwayat (%)
  'jadwal-h': 38,   // kiri fase | kanan sesi (%)
};

function loadPanelPct(key) {
  try {
    const raw = localStorage.getItem('panel-layout-v1');
    if (!raw) return PANEL_DEFAULTS[key];
    const o = JSON.parse(raw);
    const v = Number(o[key]);
    if (Number.isFinite(v) && v >= 20 && v <= 80) return v;
  } catch (_) {}
  return PANEL_DEFAULTS[key];
}

function savePanelPct(key, pct) {
  try {
    const raw = localStorage.getItem('panel-layout-v1');
    const o = raw ? JSON.parse(raw) : {};
    o[key] = Math.round(pct * 10) / 10;
    localStorage.setItem('panel-layout-v1', JSON.stringify(o));
  } catch (_) {}
}

function resetPanelLayouts() {
  try { localStorage.removeItem('panel-layout-v1'); } catch (_) {}
}

/**
 * Pasang drag-handle antara dua panel.
 * parent: container flex/grid
 * handle: elemen pemisah
 * axis: 'h' (lebar kiri) | 'v' (tinggi atas)
 * storageKey: kunci localStorage
 */
function attachSplitHandle(parent, handle, axis, storageKey) {
  if (!parent || !handle) return;
  let dragging = false;

  const onMove = (clientX, clientY) => {
    const rect = parent.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    let pct;
    if (axis === 'h') {
      pct = ((clientX - rect.left) / rect.width) * 100;
    } else {
      pct = ((clientY - rect.top) / rect.height) * 100;
    }
    pct = Math.max(22, Math.min(78, pct));
    applySplitPct(parent, axis, pct);
    savePanelPct(storageKey, pct);
  };

  const up = () => {
    dragging = false;
    document.body.classList.remove('is-resizing');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  const move = (e) => {
    if (!dragging) return;
    e.preventDefault();
    onMove(e.clientX, e.clientY);
  };

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    document.body.classList.add('is-resizing');
    handle.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // double-click = reset default
  handle.addEventListener('dblclick', () => {
    const d = PANEL_DEFAULTS[storageKey] != null ? PANEL_DEFAULTS[storageKey] : 50;
    applySplitPct(parent, axis, d);
    savePanelPct(storageKey, d);
  });
}

function applySplitPct(parent, axis, pct) {
  if (axis === 'h') {
    parent.style.gridTemplateColumns = `${pct}% 6px 1fr`;
  } else {
    parent.style.gridTemplateRows = `${pct}% 6px 1fr`;
    parent.style.gridTemplateColumns = '';
  }
}


function showToast(message, kind) {
  state.toast = { message: String(message || ''), kind: kind || 'ok', at: Date.now() };
  render();
  setTimeout(() => {
    if (state.toast && Date.now() - state.toast.at >= 2400) {
      state.toast = null;
      render();
    }
  }, 2600);
}

function renderToast() {
  if (!state.toast) return null;
  return el('div', {
    class: 'app-toast app-toast-' + (state.toast.kind || 'ok'),
    role: 'status',
  }, [state.toast.message]);
}

function tip(text) {
  return { title: text };
}



/** Mode Lapangan (HP pelatih): halaman terpisah, tanpa grid */
function isCoachFieldMode() {
  return isMobileUi() && !state.coachFullMobile;
}

function fieldBackHome() {
  state.selectedAthleteId = null;
  state.fieldPage = 'home';
  state.view = 'app';
  render();
}

function fieldBackAthlete() {
  state.fieldPage = 'athlete';
  render();
}

function fieldNavCard(title, sub, ic, onClick) {
  return el('button', { type: 'button', class: 'field-card', onclick: onClick }, [
    el('span', { class: 'field-card-ico' }, [icon(ic)]),
    el('span', { class: 'field-card-body' }, [
      el('strong', {}, [title]),
      sub ? el('span', { class: 'muted' }, [sub]) : null,
    ]),
    el('span', { class: 'field-card-chevron' }, ['›']),
  ]);
}

function renderFieldShell(title, bodyChildren, opts) {
  opts = opts || {};
  const top = el('div', { class: 'field-topbar' }, [
    opts.onBack
      ? el('button', { type: 'button', class: 'field-back', onclick: opts.onBack }, ['←', ' Kembali'])
      : el('span', { class: 'field-brand' }, ['AtletikPro']),
    el('strong', { class: 'field-title' }, [title || '']),
    el('button', {
      type: 'button', class: 'field-menu-btn',
      title: 'Menu',
      onclick: () => {
        const open = document.documentElement.getAttribute('data-drawer') === '1';
        document.documentElement.setAttribute('data-drawer', open ? '0' : '1');
      },
    }, ['☰']),
  ]);
  return el('div', { class: 'field-shell' }, [
    top,
    el('div', { class: 'field-body' }, bodyChildren),
  ]);
}

function renderFieldHome() {
  const athletes = state.athletes || [];
  const attention = athletes.filter((a) => a.summary && a.summary.needsAttention);
  const todayItems = (state.portalDay && state.portalDay.items) || [];

  const children = [
    el('p', { class: 'field-lead muted' }, ['Mode lapangan — satu layar, satu tugas.']),
  ];

  if (attention.length) {
    children.push(el('h3', { class: 'field-h' }, ['Perlu perhatian']));
    attention.slice(0, 5).forEach((a) => {
      children.push(fieldNavCard(
        a.profile.nama,
        categoryLabel(a.profile.kategori) || a.profile.kategori,
        'alert-triangle',
        async () => {
          state.selectedAthleteId = a.id;
          state.fieldPage = 'athlete';
          await openAthlete(a.id);
        }
      ));
    });
  }

  if (todayItems.length) {
    children.push(el('h3', { class: 'field-h' }, ['Sesi hari ini']));
    todayItems.slice(0, 6).forEach((it) => {
      const sess = (it.sessions || []).map((s) => s.name).join(' · ') || 'Sesi';
      children.push(fieldNavCard(
        it.nama || 'Atlet',
        sess,
        'calendar',
        async () => {
          state.selectedAthleteId = it.athleteId;
          state.fieldPage = 'week';
          await openAthlete(it.athleteId);
        }
      ));
    });
  }

  children.push(el('h3', { class: 'field-h' }, ['Skuat']));
  if (!athletes.length) {
    children.push(el('p', { class: 'muted' }, ['Belum ada atlet.']));
  } else {
    athletes.forEach((a) => {
      const sum = a.summary || {};
      const sub = [
        categoryLabel(a.profile.kategori) || a.profile.kategori,
        sum.phaseLabel || null,
      ].filter(Boolean).join(' · ');
      children.push(fieldNavCard(
        a.profile.nama,
        sub,
        'user',
        async () => {
          state.selectedAthleteId = a.id;
          state.fieldPage = 'athlete';
          await openAthlete(a.id);
        }
      ));
    });
  }

  children.push(el('div', { class: 'field-footer-actions' }, [
    el('button', {
      type: 'button', class: 'secondary',
      onclick: () => {
        state.coachFullMobile = true;
        try { localStorage.setItem('coach-full-mobile', '1'); } catch (_) {}
        render();
      },
    }, ['Mode lengkap (layar kecil)']),
  ]));

  return renderFieldShell('Markas', children, {});
}

function renderFieldAthlete(athlete) {
  const p = athlete.profile || {};
  const sum = athlete.summary || {};
  const prog = state.program || {};
  const phase = (prog.phase && prog.phase.label) || sum.phaseLabel || '—';
  let acwr = '—';
  if (prog.acwr && prog.acwr.eligible && prog.acwr.acwr != null) acwr = Number(prog.acwr.acwr).toFixed(2);
  else if (sum.acwr && sum.acwr.acwr != null) acwr = Number(sum.acwr.acwr).toFixed(2);
  const dtc = sum.daysToComp != null ? sum.daysToComp : null;

  const children = [
    el('div', { class: 'field-context card' }, [
      el('div', { class: 'field-context-name' }, [p.nama]),
      el('div', { class: 'muted' }, [
        (categoryLabel(p.kategori) || p.kategori || '') + (p.event ? ' · ' + p.event : ''),
      ]),
      el('div', { class: 'field-pills' }, [
        el('span', { class: 'cmd-pill' }, ['Fase ', phase]),
        el('span', { class: 'cmd-pill' }, ['ACWR ', acwr]),
        dtc != null ? el('span', { class: 'cmd-pill' }, ['Kompetisi ', String(dtc), 'h']) : null,
      ]),
    ]),
    el('h3', { class: 'field-h' }, ['Menu atlet']),
    fieldNavCard('Latihan minggu ini', 'Lihat sesi terjadwal', 'calendar', () => {
      state.fieldPage = 'week';
      state.athleteTab = 'program';
      state.scheduleView = 'week';
      loadAthleteTab().then(() => render());
    }),
    fieldNavCard('Input setelah latihan', 'RPE, durasi, catatan', 'activity', () => {
      state.fieldPage = 'log';
      render();
    }),
    fieldNavCard('Tes', 'Catat / lihat hasil tes', 'clipboard', async () => {
      state.fieldPage = 'tests';
      state.athleteTab = 'tests';
      await loadAthleteTab();
      render();
    }),
    fieldNavCard('Nutrisi', 'Target kalori & menu harian', 'utensils', async () => {
      state.fieldPage = 'nutrition';
      state.athleteTab = 'nutrition';
      await loadAthleteTab();
      render();
    }),
    fieldNavCard('Lainnya', 'Monitor, feed, unduh di mode lengkap', 'layers', () => {
      state.fieldPage = 'more';
      render();
    }),
  ];

  return renderFieldShell(p.nama || 'Atlet', children, { onBack: fieldBackHome });
}

function renderFieldWeek(athlete) {
  const prog = state.program;
  const children = [];
  if (!prog || !prog.weeks) {
    children.push(el('p', { class: 'muted' }, ['Program belum tersedia. Lengkapi tes di PC atau menu Tes.']));
  } else {
    // Cari minggu yang mengandung hari ini
    const today = todayLocalDate();
    let week = null;
    (prog.weeks || []).forEach((w) => {
      if (w.startDate && w.endDate && today >= w.startDate && today <= w.endDate) week = w;
    });
    if (!week && prog.weeks.length) week = prog.weeks[prog.weeks.length - 1];
    if (week) {
      children.push(el('p', { class: 'muted' }, [
        (week.label || 'Minggu ini') + (week.phaseLabel ? ' · ' + week.phaseLabel : ''),
      ]));
      const sessions = week.sessions || week.days || [];
      if (Array.isArray(week.days)) {
        week.days.forEach((d) => {
          const list = d.sessions || [];
          if (!list.length) return;
          children.push(el('div', { class: 'field-session-day' }, [
            el('strong', {}, [fmtDate(d.date) || d.date || '']),
            ...list.map((s) => el('div', { class: 'field-session-item card' }, [
              el('strong', {}, [s.name || s.label || 'Sesi']),
              s.goal ? el('p', { class: 'muted' }, [s.goal]) : null,
              el('p', { class: 'muted' }, [
                [s.targetRPE != null ? 'RPE ' + s.targetRPE : null, s.durationMin != null ? s.durationMin + ' mnt' : null]
                  .filter(Boolean).join(' · '),
              ]),
            ])),
          ]));
        });
      } else if (sessions.length) {
        sessions.forEach((s) => {
          children.push(el('div', { class: 'field-session-item card' }, [
            el('strong', {}, [s.name || s.label || 'Sesi']),
            s.goal ? el('p', { class: 'muted' }, [s.goal]) : null,
          ]));
        });
      } else {
        children.push(el('p', { class: 'muted' }, ['Tidak ada sesi pada minggu ini.']));
      }
    }
  }
  children.push(el('p', { class: 'muted field-note' }, [
    'Override program hanya di PC/tablet atau Mode lengkap.',
  ]));
  return renderFieldShell('Minggu ini', children, { onBack: fieldBackAthlete });
}

function renderFieldLog(athlete) {
  const date = el('input', { type: 'date', value: todayLocalDate(), required: 'true' });
  const rpe = el('input', { type: 'number', min: '1', max: '10', step: '1', placeholder: '1–10', required: 'true' });
  const dur = el('input', { type: 'number', min: '1', placeholder: 'menit', required: 'true' });
  const note = el('input', { placeholder: 'Opsional' });
  const msg = el('div');

  const form = el('form', {
    class: 'field-log-form',
    onsubmit: async (e) => {
      e.preventDefault();
      msg.textContent = '';
      try {
        await api('POST', '/athletes/' + athlete.id + '/monitoring', {
          date: date.value,
          rpe: rpe.value,
          durationMin: dur.value,
          note: note.value,
        });
        msg.appendChild(el('div', { class: 'success-box' }, ['Tersimpan.']));
        rpe.value = '';
        dur.value = '';
        note.value = '';
        state.monitoringLogs = await api('GET', '/athletes/' + athlete.id + '/monitoring');
      } catch (err) {
        msg.appendChild(el('div', { class: 'error-box' }, [err.message || 'Gagal simpan']));
      }
    },
  }, [
    el('label', {}, ['Tanggal']), date,
    el('label', {}, ['RPE (1–10)']), rpe,
    el('label', {}, ['Durasi (menit)']), dur,
    el('label', {}, ['Catatan']), note,
    el('button', { type: 'submit', class: 'field-primary-btn' }, ['Simpan latihan']),
    msg,
  ]);

  return renderFieldShell('Input latihan', [
    el('p', { class: 'muted' }, ['Catat beban setelah sesi — masuk ke ACWR.']),
    el('div', { class: 'card' }, [form]),
  ], { onBack: fieldBackAthlete });
}

function renderFieldTests(athlete) {
  // Pakai form tes yang sudah ada, dalam halaman scroll penuh (bukan tile)
  const inner = renderTestsTab(athlete);
  return renderFieldShell('Tes', [
    el('p', { class: 'muted field-note' }, ['Geser untuk mengisi. Grafik detail lebih nyaman di PC.']),
    el('div', { class: 'field-embed' }, [inner]),
  ], { onBack: fieldBackAthlete });
}

function renderFieldNutrition(athlete) {
  const inner = renderNutritionTab(athlete);
  return renderFieldShell('Nutrisi', [
    el('p', { class: 'muted field-note' }, ['Dihitung otomatis dari profil & fase — tidak perlu diisi ulang.']),
    el('div', { class: 'field-embed' }, [inner]),
  ], { onBack: fieldBackAthlete });
}

function renderFieldMore(athlete) {
  return renderFieldShell('Lainnya', [
    el('p', { class: 'muted' }, ['Fitur analisis dibuka lewat Mode lengkap atau PC.']),
    fieldNavCard('Mode lengkap', 'Semua menu seperti PC (layar sempit)', 'layers', () => {
      state.coachFullMobile = true;
      try { localStorage.setItem('coach-full-mobile', '1'); } catch (_) {}
      state.athleteTab = 'program';
      render();
    }),
    fieldNavCard('Monitor (mode lengkap)', 'Setelah aktifkan mode lengkap', 'heart', () => {
      state.coachFullMobile = true;
      try { localStorage.setItem('coach-full-mobile', '1'); } catch (_) {}
      state.athleteTab = 'monitoring';
      loadAthleteTab().then(() => render());
    }),
    el('p', { class: 'muted field-note' }, [
      'Override, komparasi, dan tile grafik besar disarankan di tablet/PC.',
    ]),
  ], { onBack: fieldBackAthlete });
}

function renderCoachFieldMode() {
  const athlete = (state.athletes || []).find((a) => a.id === state.selectedAthleteId);
  if (state.fieldPage === 'home' || !athlete) {
    state.fieldPage = 'home';
    return renderFieldHome();
  }
  if (state.fieldPage === 'week') return renderFieldWeek(athlete);
  if (state.fieldPage === 'log') return renderFieldLog(athlete);
  if (state.fieldPage === 'tests') return renderFieldTests(athlete);
  if (state.fieldPage === 'nutrition') return renderFieldNutrition(athlete);
  if (state.fieldPage === 'more') return renderFieldMore(athlete);
  return renderFieldAthlete(athlete);
}


function renderApp() {
  root.innerHTML = '';
  try {
    applyMobileUiDefaults();
    try { applyPalette(state.palette || 'indigo'); applyFont(state.font || 'system'); } catch (_) {}
  } catch (_) {}

  // Mode lapangan HP (halaman terpisah) — kecuali Mode lengkap / panduan / form auth
  if (state.user && isCoachFieldMode() && state.view === 'app' && !state.showGuide) {
    try { document.documentElement.setAttribute('data-ui', 'field'); } catch (_) {}
    root.appendChild(renderCoachFieldMode());
    return;
  }

  try { document.documentElement.setAttribute('data-ui', 'command'); } catch (_) {}

  const closeDrawer = () => { state.sidebarOpen = false; render(); };

  const goHQ = async () => {
    state.selectedAthleteId = null;
    state.compareWithId = null;
    state.showGuide = false;
    state.fieldPage = 'home';
    state.view = 'app';
    if (state.adminFilterCoachId) {
      state.adminFilterCoachId = null;
      state.adminFilterCoachName = null;
      await loadAthletes();
    }
    closeDrawer();
    render();
  };

  const athleteModules = [
    ['program', 'Jadwal', 'calendar'],
    ['tests', 'Tes', 'clipboard'],
    ['monitoring', 'Monitor', 'heart'],
    ['nutrition', 'Nutrisi', 'utensils'],
    ['athlete-feed', 'Feed', 'users'],
  ];

  const selectedAthlete = state.selectedAthleteId
    ? (state.athletes || []).find((a) => a.id === state.selectedAthleteId)
    : null;

  // —— LEFT RAIL: navigasi murni ——
  const railNav = [];

  railNav.push(el('div', { class: 'rail-section-label' }, ['Operasi']));
  railNav.push(el('button', {
    type: 'button',
    class: 'rail-item' + (!state.selectedAthleteId && !state.showGuide ? ' active' : ''),
    onclick: goHQ,
  }, [
    el('span', { class: 'rail-ico' }, [icon('target')]),
    el('span', { class: 'rail-txt' }, ['Markas']),
    el('span', { class: 'rail-hint' }, ['HQ']),
  ]));

  if (selectedAthlete && !state.showGuide) {
    railNav.push(el('div', { class: 'rail-section-label' }, ['Modul atlet']));
    athleteModules.forEach(([key, label, ic]) => {
      railNav.push(el('button', {
        type: 'button',
        class: 'rail-item rail-item-mod' + (state.athleteTab === key ? ' active' : ''),
        onclick: async () => {
          state.athleteTab = key;
          state.error = null;
          state.editingTestId = null;
          state.editingLogId = null;
          state.showGuide = false;
          await loadAthleteTab();
          closeDrawer();
          render();
        },
      }, [
        el('span', { class: 'rail-ico' }, [icon(ic)]),
        el('span', { class: 'rail-txt' }, [label]),
      ]));
    });
  }

  // Skuat cepat — ganti atlet tanpa kembali ke markas
  const roster = (state.athletes || []).slice(0, isMobileUi() ? 6 : 16);
  if (roster.length && !state.showGuide) {
    railNav.push(el('div', { class: 'rail-section-label' }, ['Skuat']));
    roster.forEach((a) => {
      const sum = a.summary || {};
      const risk = sum.acwr && sum.acwr.atRisk;
      const need = sum.needsAttention;
      railNav.push(el('button', {
        type: 'button',
        class: 'rail-item rail-roster' + (state.selectedAthleteId === a.id ? ' active' : '') + (risk ? ' is-risk' : need ? ' is-warn' : ''),
        title: a.profile.nama,
        onclick: async () => {
          state.selectedAthleteId = a.id;
          state.showGuide = false;
          state.athleteTab = state.athleteTab || 'program';
          await openAthlete(a.id);
          closeDrawer();
        },
      }, [
        el('span', { class: 'rail-avatar' }, [initials(a.profile.nama)]),
        el('span', { class: 'rail-txt rail-roster-name' }, [a.profile.nama]),
        risk ? el('span', { class: 'rail-dot risk' }) : need ? el('span', { class: 'rail-dot warn' }) : null,
      ]));
    });
  }

  railNav.push(el('div', { class: 'rail-section-label' }, ['Sistem']));
  railNav.push(el('button', {
    type: 'button',
    class: 'rail-item' + (state.showGuide ? ' active' : ''),
    onclick: () => { state.showGuide = true; state.selectedAthleteId = null; state.view = 'app'; closeDrawer(); render(); },
  }, [
    el('span', { class: 'rail-ico' }, [icon('book-open')]),
    el('span', { class: 'rail-txt' }, ['Panduan']),
  ]));

  if (state.user.role === 'admin') {
    railNav.push(el('button', {
      type: 'button',
      class: 'rail-item',
      onclick: () => {
        state.selectedAthleteId = null;
        state.showGuide = false;
        render();
        setTimeout(() => {
          const t = document.getElementById('admin-panel-anchor');
          if (t) t.scrollIntoView({ behavior: 'smooth' });
        }, 50);
        closeDrawer();
      },
    }, [
      el('span', { class: 'rail-ico' }, [icon('shield')]),
      el('span', { class: 'rail-txt' }, ['Admin']),
    ]));
  }

  railNav.push(el('div', { class: 'rail-section-label' }, ['Tampilan']));
  const pal = state.palette || 'indigo';
  const palIdx = Math.max(0, PALETTE_OPTIONS.findIndex((x) => x.id === pal));
  const nextPal = PALETTE_OPTIONS[(palIdx + 1) % PALETTE_OPTIONS.length];
  railNav.push(el('button', {
    type: 'button',
    class: 'rail-item',
    title: (PALETTE_OPTIONS[palIdx] && PALETTE_OPTIONS[palIdx].hint) || '',
    onclick: () => { applyPalette(nextPal.id); render(); },
  }, [
    el('span', { class: 'rail-ico' }, [icon('layers')]),
    el('span', { class: 'rail-txt' }, ['Palet: ' + (PALETTE_OPTIONS[palIdx] ? PALETTE_OPTIONS[palIdx].label : 'Indigo')]),
  ]));
  const fnt = state.font || 'system';
  const fIdx = Math.max(0, FONT_OPTIONS.findIndex((x) => x.id === fnt));
  const nextFont = FONT_OPTIONS[(fIdx + 1) % FONT_OPTIONS.length];
  railNav.push(el('button', {
    type: 'button',
    class: 'rail-item',
    title: (FONT_OPTIONS[fIdx] && FONT_OPTIONS[fIdx].hint) || '',
    onclick: () => { applyFont(nextFont.id); render(); },
  }, [
    el('span', { class: 'rail-ico' }, [icon('book-open')]),
    el('span', { class: 'rail-txt' }, ['Font: ' + (FONT_OPTIONS[fIdx] ? FONT_OPTIONS[fIdx].label : 'Sistem')]),
  ]));
  railNav.push(el('button', {
    type: 'button',
    class: 'rail-item',
    onclick: () => { toggleTheme(); render(); },
  }, [
    el('span', { class: 'rail-ico' }, [icon(currentTheme() === 'dark' ? 'sun' : 'moon')]),
    el('span', { class: 'rail-txt' }, [currentTheme() === 'dark' ? 'Terang' : 'Gelap']),
  ]));

  railNav.push(el('button', {
    type: 'button',
    class: 'rail-item rail-logout',
    onclick: async () => {
      await api('POST', '/auth/logout');
      state.user = null; state.view = 'auth'; state.selectedAthleteId = null;
      render();
    },
  }, [
    el('span', { class: 'rail-ico' }, [icon('chevron-left')]),
    el('span', { class: 'rail-txt' }, ['Keluar']),
  ]));

  const roleLabel = state.user.role === 'admin'
    ? 'Admin'
    : (state.user.access && state.user.access.plan === 'annual'
        ? 'Tahunan'
      : state.user.access && state.user.access.plan === 'monthly'
        ? 'Bulanan'
        : state.user.access && state.user.access.trialDaysLeft != null
          ? `Trial ${state.user.access.trialDaysLeft}h`
          : 'Pelatih');

  const leftRail = el('aside', { class: 'cmd-rail' + (state.sidebarOpen ? ' open' : '') }, [
    el('div', { class: 'cmd-rail-brand' }, [
      el('div', { class: 'cmd-logo' }, ['AP']),
      el('div', { class: 'cmd-brand-text' }, [
        el('div', { class: 'cmd-brand-title' }, ['Atletik Pro']),
        el('div', { class: 'cmd-brand-sub' }, ['Command']),
      ]),
      el('button', { type: 'button', class: 'icon-btn rail-close', onclick: closeDrawer }, [icon('x')]),
    ]),
    el('div', { class: 'cmd-coach' }, [
      el('div', { class: 'avatar-circle cmd-coach-av' }, [initials(state.user.name)]),
      el('div', { class: 'cmd-coach-meta' }, [
        el('div', { class: 'cmd-coach-name' }, [state.user.name]),
        el('div', { class: 'cmd-coach-role' }, [roleLabel]),
      ]),
    ]),
    el('nav', { class: 'cmd-rail-nav' }, railNav),
  ]);

  // —— CENTER STAGE ——
  const contextBits = [];
  if (selectedAthlete && !state.showGuide) {
    const p = selectedAthlete.profile;
    const sum = selectedAthlete.summary || {};
    const phase = (state.program && state.program.phase && state.program.phase.label)
      || (sum.phaseLabel) || '—';
    const acwrV = state.program && state.program.acwr && state.program.acwr.eligible && state.program.acwr.acwr != null
      ? Number(state.program.acwr.acwr).toFixed(2)
      : (sum.acwr && sum.acwr.acwr != null ? Number(sum.acwr.acwr).toFixed(2) : '—');
    const tabLabel = ({ program: 'Jadwal', calendar: 'Jadwal', tests: 'Tes', monitoring: 'Monitor', 'athlete-feed': 'Feed' })[state.athleteTab] || '';
    contextBits.push(
      el('div', { class: 'cmd-context-athlete' }, [
        el('span', { class: 'cmd-context-avatar' }, [initials(p.nama)]),
        el('div', {}, [
          el('div', { class: 'cmd-context-name' }, [p.nama]),
          el('div', { class: 'cmd-context-meta muted' }, [
            `${categoryLabel(p.kategori) || p.kategori || ''} · ${tabLabel}`,
          ]),
        ]),
      ]),
      el('div', { class: 'cmd-context-pills' }, [
        el('span', { class: 'cmd-pill' }, [icon('layers'), ' ', phase]),
        el('span', { class: 'cmd-pill' }, [icon('gauge'), ' ACWR ', acwrV]),
      ]),
      el('div', { class: 'cmd-context-actions' }, [
        el('button', {
          type: 'button', class: 'secondary pill-btn',
          title: 'Kembali ke Markas',
          onclick: () => { state.selectedAthleteId = null; state.view = 'app'; render(); },
        }, [icon('chevron-left')]),
        el('button', {
          type: 'button', class: 'secondary pill-btn',
          title: 'Undang atlet',
          onclick: async () => {
            try {
              const inv = await api('POST', `/athletes/${selectedAthlete.id}/invite`, { programAccess: 'reminding' });
              showInviteCopyModal(inv.inviteCode, `${window.location.origin}/athlete.html`);
            } catch (err) { alert(err.message || 'Gagal undangan'); }
          },
        }, [icon('users')]),
        el('button', {
          type: 'button', class: 'secondary pill-btn',
          title: 'Bandingkan atlet',
          onclick: () => openComparePicker(selectedAthlete.id),
        }, [icon('bar-chart')]),
        el('button', {
          type: 'button', class: 'secondary pill-btn',
          title: 'Ubah profil',
          onclick: () => { state.view = 'athlete-edit'; render(); },
        }, [icon('pencil')]),
      ]),
    );
  } else if (state.showGuide) {
    contextBits.push(el('div', { class: 'cmd-context-title' }, ['Panduan']));
  } else {
    contextBits.push(
      el('div', { class: 'cmd-context-title' }, ['Markas pelatih']),
      el('div', { class: 'cmd-context-sub muted' }, ['Ringkasan skuat & sinyal hari ini']),
    );
  }

  const stageHeader = el('header', { class: 'cmd-stage-header' }, [
    el('button', {
      type: 'button',
      class: 'icon-btn cmd-menu-btn',
      onclick: () => { state.sidebarOpen = true; render(); },
    }, [icon('menu')]),
    el('div', { class: 'cmd-context' }, contextBits),
  ]);

  const stageBody = el('div', { class: 'cmd-stage-body' });
  const banner = renderAccessBanner();
  if (banner) stageBody.appendChild(banner);
  if (state.user.role === 'admin' && !state.selectedAthleteId) {
    stageBody.appendChild(el('div', { id: 'admin-panel-anchor' }, [renderAdminPanel()]));
  }
  if (state.showGuide) {
    stageBody.appendChild(renderGuide());
  } else if (state.selectedAthleteId) {
    stageBody.appendChild(renderAthleteDetail());
  } else {
    stageBody.appendChild(renderAthleteList());
  }

  const stage = el('main', { class: 'cmd-stage' }, [stageHeader, stageBody]);
  const overlay = el('div', {
    class: 'cmd-rail-overlay' + (state.sidebarOpen ? ' open' : ''),
    onclick: closeDrawer,
  });

  root.appendChild(el('div', { class: 'cmd-shell' }, [overlay, leftRail, stage]));
  const toastEl = renderToast();
  if (toastEl) root.appendChild(toastEl);
}


// ---------- Panduan Istilah (glosarium in-app) ----------
// Semua angka/ambang batas di sini diambil langsung dari lib/*.js (bukan
// definisi umum dari luar) — kalau nilainya disetel ulang di kode, halaman
// ini perlu diperbarui juga supaya tetap akurat.
function guideFaqItem(q, aParts) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'guide-faq-q' }, [q]),
    el('p', { class: 'muted' }, aParts),
  ]);
}
function guideTermCard(name, tag, bodyChildren) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'guide-term-head' }, [
      el('span', { class: 'guide-term-name' }, [name]),
      tag ? el('span', { class: 'guide-tag' }, [tag]) : null,
    ]),
    ...bodyChildren,
  ]);
}
function guideFigure(children, warn) {
  return el('div', { class: 'guide-figure' + (warn ? ' warn' : '') }, children);
}
function guideZoneRow(key, children) {
  return el('div', { class: 'guide-zone-row' }, [el('span', { class: 'guide-zone-key' }, [key]), el('span', {}, children)]);
}
function guidePhaseRow(name, when, desc) {
  return el('div', { class: 'guide-phase-row' }, [
    el('b', {}, [name]),
    el('div', {}, [el('div', { class: 'guide-phase-when' }, [when]), el('div', { class: 'guide-phase-desc' }, [desc])]),
  ]);
}

function renderGuide() {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'row' }, [
    el('p', { class: 'muted' }, ['Penjelasan sederhana untuk semua istilah & angka yang muncul di aplikasi — untuk pelatih dan atlet.']),
  ]));

  // -- Pertanyaan Umum --
  wrap.appendChild(el('h3', {}, [icon('book-open'), ' Pertanyaan Umum']));
  wrap.appendChild(guideFaqItem('Kenapa volume latihan saya berubah-ubah tiap minggu?', [
    'Karena dua hal dikalikan otomatis: fase periodisasi (makin dekat kompetisi, volume makin turun) dan personalisasi (level prestasi × risiko ACWR). Angka akhirnya selalu ditampilkan transparan di kartu Program sebagai "Total Pengali Volume".',
  ]));
  wrap.appendChild(guideFaqItem('Dua atlet dengan catatan waktu sama, kenapa porsi latihannya bisa beda?', [
    'Karena ACWR — pola beban latihan riil 2–4 minggu terakhir — juga ikut menentukan, bukan cuma catatan waktu terbaik. Atlet yang beban latihannya baru melonjak akan diberi volume lebih ringan dulu.',
  ]));
  wrap.appendChild(guideFaqItem('ACWR saya di atas 1,5 — apa artinya?', [
    'Beban latihan minggu ini naik terlalu cepat dibanding kebiasaan sebulan terakhir — zona risiko cedera tinggi. Sistem otomatis memangkas volume latihan minggu ini sebesar 25% sampai beban kembali stabil.',
  ]));
  wrap.appendChild(guideFaqItem('Apa bedanya RPE dan ACWR?', [
    'RPE = seberapa berat SATU sesi terasa hari itu (skala 0-10, diisi atlet sendiri). ACWR = pola dari BANYAK sesi selama berminggu-minggu, dihitung otomatis dari kumpulan RPE yang sudah dicatat.',
  ]));
  wrap.appendChild(guideFaqItem('Kenapa VDOT penting buat pelari Menengah/Jauh?', [
    'VDOT itu satu angka yang mewakili kebugaran aerobik. Dari situ aplikasi menghitung pace latihan di 5 zona intensitas, dan memprediksi waktu di nomor lain — tanpa perlu time trial di tiap nomor.',
  ]));

  // -- Tes & Pengukuran Fisik --
  wrap.appendChild(el('h3', {}, [icon('clipboard'), ' Tes & Pengukuran Fisik']));
  wrap.appendChild(guideTermCard('VO2 Maks', 'VO2max', [
    el('p', {}, ['Kapasitas maksimal tubuh menyerap & memakai oksigen saat berolahraga — ukuran klasik daya tahan aerobik. Diukur lewat tes MFT (Multi-stage Fitness Test / bleep test).']),
    guideFigure([el('span', {}, ['Satuan: ']), el('code', {}, ['ml/kg/menit']), el('span', {}, ['. Makin tinggi, makin bagus daya tahannya.'])]),
  ]));
  wrap.appendChild(guideTermCard('RAST', 'Sprint', [
    el('p', {}, ['Running-based Anaerobic Sprint Test — lari 35 meter sekuat mungkin 6 kali dengan istirahat singkat. Dari 6 catatan waktu ini aplikasi otomatis menghitung dua angka turunan:']),
    el('p', {}, [el('strong', {}, ['RAST Power (W/kg)']), ' — tenaga anaerobik puncak relatif terhadap berat badan. Makin tinggi, makin eksplosif.']),
    el('p', {}, [el('strong', {}, ['Fatigue Index (W/s)']), ' — seberapa cepat tenaga menurun dari repetisi pertama ke terakhir. Di sini makin rendah makin baik.']),
    guideFigure([el('strong', {}, ['Perlu diisi: ']), el('span', {}, ['berat badan atlet di profil — tanpa itu, RAST Power tidak bisa dihitung.'])], true),
  ]));
  wrap.appendChild(guideTermCard('HR Puncak & HRR5', null, [
    el('p', {}, ['Detak jantung tertinggi saat tes (HR Puncak), lalu detak jantung 5 menit setelah berhenti (HR Menit ke-5). Selisih keduanya (HRR5, Heart Rate Recovery) menunjukkan seberapa cepat jantung pulih — makin besar selisihnya, makin baik.']),
  ]));
  wrap.appendChild(guideTermCard('Time Trial', 'Menengah · Jauh', [
    el('p', {}, ['Lari secepat mungkin menempuh jarak tertentu untuk mengukur kebugaran aktual, bukan estimasi. Jarak & waktunya dipakai menghitung VDOT otomatis.']),
  ]));
  wrap.appendChild(guideTermCard('VDOT', 'Menengah · Jauh', [
    el('p', {}, ['Satu angka gabungan yang mewakili kebugaran aerobik seorang pelari (formula Jack Daniels & Jimmy Gilbert). Dipakai menghitung pace latihan di 5 zona intensitas, dan memprediksi waktu di nomor lain dari satu hasil time trial.']),
    guideFigure([el('span', {}, ['Makin tinggi VDOT, makin bagus kebugaran aerobiknya.'])]),
  ]));
  wrap.appendChild(guideTermCard('5 Zona Pace', 'E · M · T · I · R', [
    el('p', {}, ['Turunan dari VDOT — tiap zona untuk tujuan latihan berbeda, dari paling santai sampai paling cepat:']),
    guideZoneRow('E', [el('strong', {}, ['Easy']), ' — fondasi aerobik & pemulihan (≈70% kecepatan VDOT)']),
    guideZoneRow('M', [el('strong', {}, ['Marathon']), ' — pace lomba maraton (≈82%)']),
    guideZoneRow('T', [el('strong', {}, ['Threshold']), ' — ambang laktat / tempo (≈88%)']),
    guideZoneRow('I', [el('strong', {}, ['Interval']), ' — mendekati VO2 maks (≈98%)']),
    guideZoneRow('R', [el('strong', {}, ['Repetition']), ' — kecepatan & ekonomi lari (≈108%)']),
  ]));
  wrap.appendChild(guideTermCard('SLJ', 'Lompat', [
    el('p', {}, ['Standing Long Jump — lompat jauh tanpa awalan dari posisi diam, mengukur power tungkai. Dicatat dalam cm.']),
  ]));
  wrap.appendChild(guideTermCard('Vertical Jump', 'Lompat', [
    el('p', {}, ['Lompat setinggi mungkin di tempat, mengukur power vertikal. Dicatat dalam cm.']),
  ]));
  wrap.appendChild(guideTermCard('Prestasi Lomba', 'Lompat', [
    el('p', {}, ['Catatan resmi terbaik atlet di kompetisi sungguhan (lompat jauh/tinggi) — beda dari hasil tes latihan, ini hasil pertandingan.']),
  ]));
  wrap.appendChild(guideTermCard('Checklist Teknik', 'Sprint · Lompat', [
    el('p', {}, ['Penilaian kualitatif form/teknik gerakan, skala 1-5 (Sangat Kurang → Sangat Baik), diisi pelatih berdasarkan pengamatan — bukan hasil alat ukur.']),
  ]));

  // -- Monitoring & Beban Latihan --
  wrap.appendChild(el('h3', {}, [icon('heart'), ' Monitoring & Beban Latihan']));
  wrap.appendChild(guideTermCard('RPE', 'Borg CR10', [
    el('p', {}, ['Rate of Perceived Exertion — skala 0-10 seberapa BERAT satu sesi terasa menurut atlet sendiri (0 = istirahat total, 10 = maksimal habis-habisan). Diisi atlet/pelatih setelah sesi selesai.']),
  ]));
  wrap.appendChild(guideTermCard('Training Load', 'Beban Latihan', [
    el('p', {}, ['Satu angka yang menggabungkan "seberapa berat" dan "berapa lama" jadi satu ukuran beban per sesi.']),
    guideFigure([el('strong', {}, ['Training Load']), el('span', {}, [' = ']), el('code', {}, ['RPE × durasi (menit)'])]),
  ]));
  wrap.appendChild(guideTermCard('ACWR', 'Acute:Chronic Workload Ratio', [
    el('p', {}, ['Rasio beban latihan jangka pendek (rata-rata 7 hari terakhir — "akut") dibanding beban jangka panjang (rata-rata hingga 28 hari terakhir — "kronik"). Menunjukkan apakah beban minggu ini melonjak dibanding kebiasaan sebulan terakhir.']),
    guideZoneRow('≈1', [el('span', {}, ['Beban stabil, sesuai kebiasaan — aman'])]),
    guideZoneRow('>1,5', [el('strong', {}, ['Risiko cedera tinggi']), el('span', {}, [' — volume otomatis dipangkas 25%'])]),
    guideFigure([el('span', {}, ['Perlu minimal 14 hari riwayat monitoring sebelum status risiko bisa dihitung.'])], true),
  ]));

  // -- Program & Periodisasi --
  wrap.appendChild(el('h3', {}, [icon('activity'), ' Program & Periodisasi']));
  wrap.appendChild(guideTermCard('Fase Periodisasi', null, [
    el('p', {}, ['Tahap latihan yang berganti otomatis mengikuti sisa waktu ke tanggal kompetisi (dihitung mundur, bukan dari waktu yang sudah berlalu):']),
    guidePhaseRow('Persiapan Umum', '> 9 minggu sebelum kompetisi', 'Bangun fondasi aerobik & kekuatan umum, belum spesifik nomor lomba.'),
    guidePhaseRow('Persiapan Khusus', '3–9 minggu', 'Sesi spesifik nomor mulai masuk, volume naik-turun per siklus 4 minggu.'),
    guidePhaseRow('Kompetisi/Puncak', '≤ 3 minggu ("taper")', 'Volume terus menurun, intensitas dipertajam — tubuh disiapkan segar untuk hari-H.'),
    guidePhaseRow('Transisi', 'Setelah kompetisi lewat', 'Aktivitas bebas, volume minimal, fokus pemulihan sebelum siklus berikutnya.'),
    guideFigure([el('span', {}, ['Siklus latihan pendek bisa melewati satu fase sepenuhnya — tidak dipaksakan muncul.'])]),
  ]));
  wrap.appendChild(guideTermCard('Kurva Mingguan & Faktor Volume', null, [
    el('p', {}, ['Tiap minggu dalam satu fase punya "faktor volume" berbeda. Contoh: minggu ke-4 tiap siklus sengaja diturunkan drastis sebagai minggu unloading — waktu pemulihan supaya tubuh tidak terus dibebani penuh.']),
  ]));
  wrap.appendChild(guideTermCard('Level Prestasi', null, [
    el('p', {}, ['Klasifikasi otomatis dari catatan waktu/hasil tes terbaik atlet dibanding tabel acuan, disederhanakan jadi 3 pengali volume:']),
    guideZoneRow('×1,0', [el('strong', {}, ['Elite/Kompetitif']), el('span', {}, [' — volume standar'])]),
    guideZoneRow('×0,92', [el('strong', {}, ['Berkembang'])]),
    guideZoneRow('×0,80', [el('strong', {}, ['Pemula']), el('span', {}, [' — volume dikurangi, perlu adaptasi lebih bertahap'])]),
  ]));
  wrap.appendChild(guideTermCard('Total Pengali Volume', null, [
    el('p', {}, ['Angka akhir yang benar-benar menentukan berapa persen dari volume "standar" dipakai minggu ini.']),
    guideFigure([el('strong', {}, ['Total Pengali']), el('span', {}, [' = ']), el('code', {}, ['Pengali Level Prestasi × Pengali Risiko ACWR'])]),
  ]));
  wrap.appendChild(guideTermCard('Prediksi Waktu Lomba', 'Menengah · Jauh', [
    el('p', {}, ['Estimasi waktu di nomor target atlet, dihitung dari VDOT hasil time trial terakhir. Bukan jaminan hasil sungguhan — dipengaruhi kondisi hari-H, cuaca, dan faktor lain.']),
  ]));

  // -- Kategori & Umum --
  wrap.appendChild(el('h3', {}, [icon('users'), ' Kategori & Istilah Umum']));
  wrap.appendChild(guideTermCard('4 Kategori Nomor', null, [
    el('p', {}, [el('strong', {}, ['Sprint']), ' (100/200/400m) · ', el('strong', {}, ['Menengah']), ' (800/1500m) · ', el('strong', {}, ['Jauh']), ' (5000m/10000m/half marathon/marathon) · ', el('strong', {}, ['Lompat']), ' (lompat jauh/lompat tinggi).']),
  ]));
  wrap.appendChild(guideTermCard('Catatan Waktu 100m', 'Sprint · Lompat', [
    el('p', {}, ['Dipakai sebagai acuan Level Prestasi untuk kategori Sprint & Lompat. Kategori Menengah/Jauh memakai VDOT dari time trial sebagai gantinya.']),
  ]));
  wrap.appendChild(guideTermCard('Bank Gerakan Kekuatan', null, [
    el('p', {}, ['Daftar latihan kekuatan & pliometrik penunjang sesuai fase periodisasi saat ini — pelengkap program lari/lompat, bukan sesi utama.']),
  ]));
  wrap.appendChild(guideTermCard('Timeline Periodisasi & Gauge ACWR', null, [
    el('p', {}, ['Dua bar visual di tab Program: Timeline menunjukkan posisi hari ini di antara tanggal mulai program & kompetisi. Gauge menunjukkan posisi ACWR saat ini di antara zona aman dan berisiko.']),
  ]));

  return wrap;
}

function coachNameById(coachId) {
  const id = Number(coachId);
  if (state.adminFilterCoachId != null && Number(state.adminFilterCoachId) === id && state.adminFilterCoachName) {
    return state.adminFilterCoachName;
  }
  const row = (state.adminCoaches || []).find((x) => Number(x.id) === id);
  if (row && row.name) return row.name;
  if (state.user && Number(state.user.id) === id) return state.user.name;
  return id ? `Pelatih #${id}` : '—';
}

function renderAdminPanel() {
  const wrap = el('div', { class: 'card' });
  wrap.appendChild(el('h3', {}, ['Panel Admin — Daftar Pelatih']));
  wrap.appendChild(el('p', { class: 'muted' }, [
    'Admin bisa memberikan paket Bulanan (30 hari) atau Tahunan (365 hari) tanpa pembayaran. Cabut paket mengembalikan pelatih ke trial/expired.',
  ]));
  const loadBtn = el('button', {
    class: 'secondary', onclick: async () => {
      state.adminCoaches = await api('GET', '/admin/coaches');
      render();
    },
  }, ['Muat / refresh daftar pelatih']);
  wrap.appendChild(loadBtn);

  if (state.adminCoaches) {
    const table = el('table', {}, [
      el('thead', {}, [el('tr', {}, ['Nama', 'Email', 'Atlet', 'Paket', 'Sisa trial', ''].map((h) => el('th', {}, [h])))]),
    ]);
    const tbody = el('tbody');
    state.adminCoaches.forEach((c) => {
      const acc = c.access || {};
      const planLabel = acc.plan === 'annual' ? 'Tahunan'
        : acc.plan === 'monthly' ? 'Bulanan'
        : acc.plan === 'trial' ? 'Trial'
        : acc.plan === 'expired' ? 'Expired'
        : 'Trial';
      const planBadge = acc.plan === 'annual' || acc.plan === 'monthly' ? 'badge-ok'
        : acc.plan === 'expired' ? 'badge-risk'
        : 'badge-caution';
      const daysLeft = acc.subscriptionDaysLeft != null
        ? `${acc.subscriptionDaysLeft} hr`
        : (acc.trialDaysLeft != null ? `${acc.trialDaysLeft} hr` : '—');
      tbody.appendChild(el('tr', {}, [
        el('td', {}, [c.name]),
        el('td', {}, [c.email]),
        el('td', {}, [String(c.athleteCount)]),
        el('td', {}, [el('span', { class: `badge ${planBadge}` }, [planLabel])]),
        el('td', {}, [daysLeft]),
        el('td', { class: 'row-actions' }, [
          el('button', {
            class: 'link',
            style: Number(state.adminFilterCoachId) === Number(c.id) ? 'font-weight:700;' : undefined,
            onclick: async () => {
              state.adminFilterCoachId = Number(c.id);
              state.adminFilterCoachName = c.name;
              state.selectedAthleteId = null;
              state.showGuide = false;
              state.view = 'app';
              await loadAthletes();
              render();
              // Scroll ke daftar atlet di bawah panel
              setTimeout(() => {
                const list = document.querySelector('.container .row');
                if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 50);
            },
          }, [Number(state.adminFilterCoachId) === Number(c.id) ? '● Sedang dilihat' : 'Lihat atlet']),
          el('button', {
            class: 'link',
            onclick: async () => {
              if (!confirm(`Berikan paket Bulanan (30 hari) kepada ${c.name}?`)) return;
              await api('POST', `/admin/coaches/${c.id}/membership`, { plan: 'monthly' });
              state.adminCoaches = await api('GET', '/admin/coaches');
              render();
            },
          }, ['Grant Bulanan']),
          el('button', {
            class: 'link',
            onclick: async () => {
              if (!confirm(`Berikan paket Tahunan (365 hari) kepada ${c.name}?`)) return;
              await api('POST', `/admin/coaches/${c.id}/membership`, { plan: 'annual' });
              state.adminCoaches = await api('GET', '/admin/coaches');
              render();
            },
          }, ['Grant Tahunan']),
          el('button', {
            class: 'link',
            onclick: async () => {
              if (!confirm(`Cabut paket berbayar dari ${c.name}? Akun kembali ke aturan trial/expired.`)) return;
              await api('POST', `/admin/coaches/${c.id}/membership`, { plan: 'none' });
              state.adminCoaches = await api('GET', '/admin/coaches');
              render();
            },
          }, ['Cabut paket']),
          el('button', {
            class: 'link',
            onclick: async () => {
              if (!confirm(`Reset password untuk ${c.name} (${c.email})? Password sementara akan ditampilkan sekali.`)) return;
              try {
                const res = await api('POST', `/admin/coaches/${c.id}/reset-password`, {});
                alert(`Password sementara untuk ${res.email}:\n\n${res.temporaryPassword}\n\nBerikan ke pelatih dan minta segera diganti setelah login.`);
              } catch (err) {
                alert(err.message || 'Gagal reset password');
              }
            },
          }, ['Reset password']),
        ]),
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(el('div', { class: 'table-wrap' }, [table]));
  }
  if (state.adminFilterCoachId) {
    const coachLabel = coachNameById(state.adminFilterCoachId);
    wrap.appendChild(el('div', { class: 'callout callout-warning', style: 'margin-top:12px;' }, [
      el('p', {}, [
        'Filter aktif: menampilkan atlet milik ',
        el('strong', {}, [coachLabel]),
        '.',
      ]),
      el('button', {
        type: 'button',
        class: 'secondary',
        style: 'margin-top:8px;',
        onclick: async () => {
          state.adminFilterCoachId = null;
          state.adminFilterCoachName = null;
          await loadAthletes();
          render();
        },
      }, ['Tampilkan semua pelatih']),
    ]));
  }
  return wrap;
}

function formatIdr(n) {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  } catch (_) {
    return `Rp ${Number(n).toLocaleString('id-ID')}`;
  }
}

/** Muat script Snap.js Midtrans sekali (sandbox atau production). */
function loadSnapScript(isProduction) {
  return new Promise((resolve, reject) => {
    if (window.snap) return resolve(window.snap);
    const src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    // Hapus script lama jika ganti environment
    const existing = document.querySelector('script[data-midtrans-snap]');
    if (existing) existing.remove();
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-midtrans-snap', '1');
    s.onload = () => resolve(window.snap);
    s.onerror = () => reject(new Error('Gagal memuat Midtrans Snap.js'));
    document.head.appendChild(s);
  });
}

/**
 * Alur bayar: create-snap(plan) → snap.pay → refresh /me
 * plan: 'monthly' | 'annual'
 */
async function startCheckout(planId) {
  try {
    const mapped = planId === 'lifetime' ? 'annual' : (planId || 'annual');
    const session = await api('POST', '/payments/create-snap', { plan: mapped });
    if (!session.token) throw new Error('Token pembayaran tidak tersedia');

    const src = session.isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    let script = document.querySelector('script[data-midtrans-snap]');
    if (!script || script.getAttribute('src') !== src) {
      if (script) script.remove();
      delete window.snap;
      script = document.createElement('script');
      script.src = src;
      script.setAttribute('data-midtrans-snap', '1');
      script.setAttribute('data-client-key', session.clientKey || '');
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error('Gagal memuat Midtrans Snap.js'));
        document.head.appendChild(script);
      });
    } else if (session.clientKey) {
      script.setAttribute('data-client-key', session.clientKey);
    }

    if (!window.snap || typeof window.snap.pay !== 'function') {
      throw new Error('Snap.js belum siap. Muat ulang halaman lalu coba lagi.');
    }

    window.snap.pay(session.token, {
      onSuccess: async function () {
        for (let i = 0; i < 5; i++) {
          try {
            state.user = await api('GET', '/auth/me');
            const p = state.user.access && state.user.access.plan;
            if (p === 'monthly' || p === 'annual') break;
          } catch (_) {}
          await new Promise((r) => setTimeout(r, 800));
        }
        state.error = null;
        const p = state.user.access && state.user.access.plan;
        alert(p === 'monthly'
          ? 'Pembayaran berhasil. Langganan bulanan aktif (30 hari).'
          : p === 'annual'
            ? 'Pembayaran berhasil. Langganan tahunan aktif (365 hari).'
            : 'Pembayaran berhasil. Akses aktif.');
        render();
      },
      onPending: async function () {
        try { state.user = await api('GET', '/auth/me'); } catch (_) {}
        alert('Pembayaran menunggu konfirmasi. Akses akan aktif otomatis setelah lunas.');
        render();
      },
      onError: function () {
        alert('Pembayaran gagal atau dibatalkan. Silakan coba lagi.');
      },
      onClose: function () {},
    });
  } catch (err) {
    alert(err.message || 'Gagal memulai pembayaran');
  }
}

/** Modal pilih paket: Bulanan vs Lifetime — layout rapi, stack di mobile */
async function openPlanPicker() {
  let plans = [
    { id: 'monthly', name: 'Langganan Bulanan', priceIdr: 49000 },
    { id: 'annual', name: 'Paket Tahunan', priceIdr: 299000 },
  ];
  try {
    const cfg = await api('GET', '/payments/config');
    if (cfg.plans && cfg.plans.length) plans = cfg.plans;
  } catch (_) {}
  plans = plans
    .map((p) => (p.id === 'lifetime' ? Object.assign({}, p, { id: 'annual', name: 'Paket Tahunan' }) : p))
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

  const overlay = el('div', { class: 'plan-modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const card = el('div', { class: 'plan-modal card' }, [
    el('h3', {}, ['Pilih Paket']),
    el('p', { class: 'muted plan-modal-sub' }, ['Bayar aman via Midtrans (QRIS, VA, kartu, dll.).']),
    el('div', { class: 'plan-options' }, plans.map((p) => {
      const isMonthly = p.id === 'monthly';
      return el('div', { class: 'plan-option' + (isMonthly ? '' : ' plan-option-featured') }, [
        el('div', { class: 'plan-option-top' }, [
          el('div', { class: 'plan-option-title' }, [p.name]),
          el('div', { class: 'plan-price' }, [formatIdr(p.priceIdr)]),
        ]),
        el('div', { class: 'plan-option-desc muted' }, [
          isMonthly ? 'Akses penuh 30 hari · bisa diperpanjang' : 'Akses penuh 365 hari · bisa diperpanjang',
        ]),
        el('button', {
          type: 'button',
          class: isMonthly ? 'secondary plan-option-btn' : 'plan-option-btn',
          onclick: () => { overlay.remove(); startCheckout(p.id); },
        }, [isMonthly ? 'Pilih bulanan' : 'Pilih tahunan']),
      ]);
    })),
    el('button', { type: 'button', class: 'secondary plan-modal-cancel', onclick: () => overlay.remove() }, ['Batal']),
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function renderUpgradeButton(label) {
  return el('button', {
    type: 'button',
    onclick: () => { openPlanPicker(); },
  }, [label || 'Pilih paket']);
}

function renderAccessBanner() {
  const access = state.user && state.user.access;
  if (!access || state.user.role === 'admin') return null;

  if (access.plan === 'monthly' || access.plan === 'annual') {
    const urgent = access.subscriptionDaysLeft != null && access.subscriptionDaysLeft <= 5;
    const days = access.subscriptionDaysLeft;
    return el('div', { class: `access-banner ${urgent ? 'access-banner-warn' : 'access-banner-info'}` }, [
      el('div', { class: 'access-banner-row' }, [
        el('div', { class: 'access-banner-text' }, [
          el('strong', {}, [urgent ? 'Langganan hampir berakhir' : (access.plan === 'annual' ? 'Langganan tahunan aktif' : 'Langganan bulanan aktif')]),
          days != null
            ? el('span', { class: 'muted' }, [` · ${days} hari tersisa`])
            : null,
        ]),
        el('div', { class: 'access-banner-actions' }, [
          el('button', { type: 'button', class: 'secondary', onclick: () => startCheckout('monthly') }, ['Perpanjang']),
          el('button', { type: 'button', onclick: () => startCheckout('annual') }, ['Tahunan']),
        ]),
      ]),
    ]);
  }

  if (access.plan === 'trial') {
    const urgent = access.trialDaysLeft != null && access.trialDaysLeft <= 7;
    const days = access.trialDaysLeft;
    const total = access.trialDaysTotal;
    // Satu baris saja — hindari pesan ganda dari access.message
    return el('div', { class: `access-banner ${urgent ? 'access-banner-warn' : 'access-banner-info'}` }, [
      el('div', { class: 'access-banner-row' }, [
        el('div', { class: 'access-banner-text' }, [
          el('strong', {}, [urgent ? 'Trial hampir berakhir' : 'Masa trial aktif']),
          days != null
            ? el('span', { class: 'muted' }, [
              total != null && total > 0
                ? ` · ${days} dari ${total} hari tersisa`
                : ` · ${days} hari tersisa`,
            ])
            : null,
        ]),
        renderUpgradeButton(urgent ? 'Pilih paket' : 'Lihat paket'),
      ]),
    ]);
  }

  // expired
  return el('div', { class: 'access-banner access-banner-danger' }, [
    el('div', { class: 'access-banner-row' }, [
      el('div', { class: 'access-banner-text' }, [
        el('strong', {}, ['Akses berakhir']),
        access.athleteLimit != null
          ? el('span', { class: 'muted' }, [` · batas ${access.athleteCount}/${access.athleteLimit} atlet`])
          : null,
      ]),
      renderUpgradeButton('Pilih paket'),
    ]),
  ]);
}

// ---------- Athlete list ----------
function categoryLabel(kategori) {
  const cat = state.categories && state.categories[kategori];
  return cat ? cat.label : kategori;
}

// Warna badge klasifikasi prestasi — tierIndex 0 = tingkat terbaik pada
// tabel benchmark (mis. "Elite Dunia"), mengikuti urutan yang sama dipetakan
// LEVEL_TIERS di lib/personalization.js (index 0-2 -> Elite/Kompetitif,
// index 3 -> Berkembang, index >=4 -> Pemula). Sengaja TIDAK pakai warna
// merah/risiko untuk tingkat pemula — ini level kemampuan, bukan status
// bahaya seperti ACWR.
function tierBadgeClass(tierIndex) {
  if (tierIndex == null) return '';
  if (tierIndex <= 2) return 'badge-ok';
  if (tierIndex === 3) return 'badge-dev';
  return 'badge-low';
}


/** Portal pelatih — meja kerja pagi (inspirasi FM: ringkasan dulu, detail on demand) */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const t = new Date(dateStr + 'T12:00:00');
  return Math.round((t - today) / 86400000);
}


function renderCoachPortal() {
  const athletes = state.athletes || [];
  const access = state.user && state.user.access;
  const attention = athletes.filter((a) => a.summary && a.summary.needsAttention);
  const risk = athletes.filter((a) => a.summary && a.summary.acwr && a.summary.acwr.atRisk);
  const nearComp = athletes.filter((a) => {
    const d = a.summary && a.summary.daysToComp != null ? a.summary.daysToComp : daysUntil(a.periodization && a.periodization.compDate);
    return d != null && d >= 0 && d <= 21;
  }).sort((a, b) => {
    const da = a.summary && a.summary.daysToComp != null ? a.summary.daysToComp : 999;
    const db = b.summary && b.summary.daysToComp != null ? b.summary.daysToComp : 999;
    return da - db;
  });

  const tiles = el('div', { class: 'portal-tiles' }, [
    el('div', { class: 'portal-tile portal-tile-blue' }, [
      el('div', { class: 'portal-tile-icon' }, [icon('users')]),
      el('div', { class: 'portal-tile-body' }, [
        el('div', { class: 'portal-tile-label' }, ['Atlet aktif']),
        el('div', { class: 'portal-tile-value' }, [String(athletes.length)]),
        el('div', { class: 'portal-tile-sub muted' }, ['Dalam daftar Anda']),
      ]),
    ]),
    el('div', { class: 'portal-tile portal-tile-amber' + (attention.length ? ' portal-tile-warn' : '') }, [
      el('div', { class: 'portal-tile-icon' }, [icon('activity')]),
      el('div', { class: 'portal-tile-body' }, [
        el('div', { class: 'portal-tile-label' }, ['Perlu perhatian']),
        el('div', { class: 'portal-tile-value' }, [String(attention.length)]),
        el('div', { class: 'portal-tile-sub muted' }, [attention.length ? 'ACWR / tes / kompetisi / nyeri' : 'Semua stabil']),
      ]),
    ]),
    el('div', { class: 'portal-tile portal-tile-red' + (risk.length ? ' portal-tile-risk' : '') }, [
      el('div', { class: 'portal-tile-icon' }, [icon('heart')]),
      el('div', { class: 'portal-tile-body' }, [
        el('div', { class: 'portal-tile-label' }, ['ACWR risiko']),
        el('div', { class: 'portal-tile-value' }, [String(risk.length)]),
        el('div', { class: 'portal-tile-sub muted' }, [risk.length ? 'Beban akut tinggi' : 'Tidak ada']),
      ]),
    ]),
    el('div', { class: 'portal-tile portal-tile-purple' }, [
      el('div', { class: 'portal-tile-icon' }, [icon('target')]),
      el('div', { class: 'portal-tile-body' }, [
        el('div', { class: 'portal-tile-label' }, ['Kompetisi ≤21 hari']),
        el('div', { class: 'portal-tile-value' }, [String(nearComp.length)]),
        el('div', { class: 'portal-tile-sub muted' }, [nearComp.length ? 'Persiapan puncak' : 'Tidak ada']),
      ]),
    ]),
  ]);

  const attentionList = attention.length
    ? el('div', { class: 'portal-attention' }, [
      el('h3', {}, ['Yang perlu ditinjau']),
      el('ul', { class: 'portal-attention-list' }, attention.slice(0, 8).map((a) => {
        const s = a.summary || {};
        const reasons = [];
        if (s.acwr && s.acwr.atRisk) reasons.push('ACWR risiko');
        if (s.highPain) reasons.push('Nyeri tinggi');
        if (!s.lastTestDate && !s.testSummary) reasons.push('Belum ada tes');
        const dtc = s.daysToComp != null ? s.daysToComp : daysUntil(a.periodization && a.periodization.compDate);
        if (dtc != null && dtc >= 0 && dtc <= 14) reasons.push(`Kompetisi ${dtc}h`);
        const openTab = async (tab) => {
          state.selectedAthleteId = a.id;
          state.athleteTab = tab;
          await openAthlete(a.id);
        };
        return el('li', { class: 'portal-attention-item' }, [
          el('div', {
            class: 'portal-attention-main',
            onclick: () => openTab('program'),
          }, [
            el('span', { class: 'portal-attention-icon' }, [
              icon((s.acwr && s.acwr.atRisk) || s.highPain ? 'alert-triangle' : (!s.lastTestDate && !s.testSummary) ? 'clipboard' : 'flag'),
            ]),
            el('strong', {}, [a.profile.nama]),
            el('span', { class: 'muted' }, [' — ' + (reasons.join(' · ') || 'Perlu dicek')]),
          ]),
          el('div', { class: 'portal-attention-actions' }, [
            (s.acwr && s.acwr.atRisk) || s.highPain
              ? el('button', { type: 'button', class: 'secondary pill-btn', onclick: (e) => { e.stopPropagation(); openTab('monitoring'); } }, ['Monitoring'])
              : null,
            (!s.lastTestDate && !s.testSummary)
              ? el('button', { type: 'button', class: 'secondary pill-btn', onclick: (e) => { e.stopPropagation(); openTab('tests'); } }, ['Lengkapi tes'])
              : null,
            el('button', { type: 'button', class: 'secondary pill-btn', onclick: (e) => { e.stopPropagation(); openTab('program'); } }, ['Program']),
          ]),
        ]);
      })),
    ])
    : el('div', { class: 'portal-attention portal-attention-ok' }, [
      el('p', {}, ['Tidak ada sinyal mendesak. Lanjutkan coaching rutin.']),
    ]);

  const nearBlock = nearComp.length
    ? el('div', { class: 'card portal-near-comp' }, [
      el('h3', {}, ['Menjelang kompetisi']),
      el('div', { class: 'portal-near-grid' }, nearComp.slice(0, 6).map((a) => {
        const dtc = a.summary && a.summary.daysToComp != null
          ? a.summary.daysToComp
          : daysUntil(a.periodization && a.periodization.compDate);
        return el('button', {
          type: 'button',
          class: 'portal-near-chip',
          onclick: () => { state.selectedAthleteId = a.id; state.athleteTab = 'program'; state.scheduleView = 'month'; openAthlete(a.id); },
        }, [
          el('span', { class: 'portal-near-name' }, [a.profile.nama]),
          el('span', { class: 'portal-near-days' }, [dtc != null ? (dtc === 0 ? 'Hari H' : `${dtc} hari`) : '—']),
        ]);
      })),
    ])
    : null;

  // Sesi hari ini
  const pd = state.portalDay;
  let todayBlock = null;
  if (pd && pd.items && pd.items.length) {
    todayBlock = el('div', { class: 'card portal-today' }, [
      el('h3', {}, [`Sesi hari ini · ${pd.dayName || ''} ${pd.date ? fmtDate(pd.date) : ''}`]),
      el('div', { class: 'portal-today-list' }, pd.items.map((it) => el('div', { class: 'portal-today-row' }, [
        el('button', {
          type: 'button',
          class: 'link portal-today-name',
          onclick: () => { state.selectedAthleteId = it.athleteId; state.athleteTab = 'program'; openAthlete(it.athleteId); },
        }, [it.nama]),
        el('div', { class: 'portal-today-sessions muted' }, [
          it.sessions.map((s) => s.name + (s.extra ? ' (tambahan)' : (s.manual ? ' (manual)' : ''))).join(' · '),
        ]),
        it.nutritionToday
          ? el('div', {
            class: it.nutritionKarboLoadingAktif ? 'portal-today-sessions' : 'portal-today-sessions muted',
            style: it.nutritionKarboLoadingAktif ? 'color:var(--danger);font-weight:700;' : undefined,
          }, [icon(it.nutritionKarboLoadingAktif ? 'flag' : 'utensils'), ' ', it.nutritionToday])
          : null,
      ]))),
    ]);
  } else if (pd && pd.items && pd.items.length === 0) {
    todayBlock = el('div', { class: 'card portal-today' }, [
      el('h3', {}, ['Sesi hari ini']),
      el('p', { class: 'muted' }, ['Tidak ada sesi terjadwal untuk hari ini (atau belum ada data tes untuk generate program).']),
    ]);
  }

  let subLine = null;
  if (access && state.user && state.user.role !== 'admin') {
    if (access.trialActive) {
      subLine = el('p', { class: 'muted portal-sub' }, [
        `Masa trial aktif — ${access.trialDaysLeft != null ? access.trialDaysLeft : '—'} hari tersisa.`,
      ]);
    } else if (access.plan === 'annual' || access.plan === 'monthly') {
      const days = access.subscriptionDaysLeft;
      subLine = el('p', { class: 'muted portal-sub' }, [
        access.plan === 'annual' ? 'Langganan tahunan aktif' : 'Langganan bulanan aktif',
        days != null ? ` — ${days} hari tersisa.` : '.',
      ]);
    } else if (access.subscriptionActive) {
      subLine = el('p', { class: 'muted portal-sub' }, ['Langganan aktif.']);
    }
  }

  const todayPane = todayBlock || el('div', { class: 'card portal-today' }, [
    el('h3', {}, ['Sesi hari ini']),
    el('p', { class: 'muted' }, ['Belum ada ringkasan sesi hari ini.']),
  ]);
  const nearPane = nearBlock || el('div', { class: 'card portal-near-comp' }, [
    el('h3', {}, ['Menjelang kompetisi']),
    el('p', { class: 'muted' }, ['Tidak ada atlet dalam 21 hari ke kompetisi.']),
  ]);

  return el('div', { class: 'coach-portal tile-markas' }, [
    el('div', { class: 'portal-header markas-tile markas-header' }, [
      el('div', {}, [
        el('h2', {}, ['Meja kerja']),
        el('p', { class: 'muted' }, ['Ringkasan skuat — klik untuk membuka modul terkait.']),
      ]),
      subLine,
    ]),
    el('div', { class: 'markas-tile markas-kpis' }, [tiles]),
    el('div', { class: 'markas-tile markas-mid' }, [
      el('div', { class: 'markas-mid-col' }, [todayPane]),
      el('div', { class: 'markas-mid-col' }, [attentionList]),
    ]),
    el('div', { class: 'markas-tile markas-bottom' }, [nearPane]),
  ]);
}



function renderAthleteStatusBar(athlete) {
  const prog = state.program;
  const s = athlete.summary || {};
  const phase = prog && prog.phase && prog.phase.phase
    ? prog.phase.label
    : '—';
  const remain = prog && prog.phase && prog.phase.remainingWeeks != null
    ? `${prog.phase.remainingWeeks} mgg`
    : null;
  const acwr = (prog && prog.acwr) || (s.acwr ? {
    eligible: s.acwr.eligible,
    acwr: s.acwr.value,
  } : null);
  const acwrInfo = typeof acwrStatusInfo === 'function' ? acwrStatusInfo(acwr) : null;
  const dtc = s.daysToComp != null
    ? s.daysToComp
    : daysUntil(athlete.periodization && athlete.periodization.compDate);
  const logs7 = s.logsLast7 != null ? s.logsLast7 : null;

  function tile(label, value, opts) {
    opts = opts || {};
    return el('button', {
      type: 'button',
      title: opts.tip || '',
      class: 'status-tile' + (opts.warn ? ' status-tile-warn' : '') + (opts.risk ? ' status-tile-risk' : ''),
      onclick: opts.tab ? async () => {
        state.athleteTab = opts.tab;
        state.error = null;
        await loadAthleteTab();
        render();
      } : undefined,
    }, [
      el('span', { class: 'status-tile-top' }, [
        opts.icon ? el('span', { class: 'status-tile-icon' }, [icon(opts.icon)]) : null,
        el('span', { class: 'status-tile-label' }, [label]),
      ]),
      el('span', { class: 'status-tile-value' }, [value]),
      opts.sub ? el('span', { class: 'status-tile-sub muted' }, [opts.sub]) : null,
    ]);
  }

  const acwrVal = acwrInfo && acwrInfo.eligible && acwr && acwr.acwr != null
    ? String(Number(acwr.acwr).toFixed(2))
    : (acwrInfo ? acwrInfo.badgeText : '—');
  const acwrRisk = acwrInfo && acwrInfo.eligible && acwr && acwr.acwr != null && acwr.acwr > 1.5;

  return el('div', { class: 'athlete-status-bar' }, [
    tile('Fase', phase, { tab: 'program', sub: remain, icon: 'layers', tip: 'Fase periodisasi saat ini. Klik untuk ke tab Program.' }),
    tile('ACWR', acwrVal, {
      tab: 'monitoring',
      risk: acwrRisk,
      warn: acwrInfo && !acwrInfo.eligible,
      sub: acwrInfo && acwrInfo.eligible ? (acwrInfo.badgeText || '') : 'Belum eligible',
      icon: 'gauge',
      tip: 'Acute:Chronic Workload Ratio = beban 7 hari / 28 hari (RPE×menit). >1.5 = risiko lonjakan. Klik ke Monitoring.',
    }),
    tile('Kompetisi', dtc == null ? '—' : (dtc < 0 ? 'Lewat' : (dtc === 0 ? 'Hari H' : `${dtc} hari`)), {
      tab: 'program',
      icon: 'flag',
      warn: dtc != null && dtc >= 0 && dtc <= 14,
      sub: athlete.periodization && athlete.periodization.compDate
        ? fmtDate(athlete.periodization.compDate)
        : null,
    }),
    tile('Monitoring 7h', logs7 != null ? String(logs7) : '—', {
      tab: 'monitoring',
      icon: 'activity',
      warn: logs7 != null && logs7 === 0,
      sub: 'log',
    }),
    tile('Tes', s.lastTestDate ? fmtDate(s.lastTestDate) : (s.testSummary ? 'Ada' : 'Belum'), {
      tab: 'tests',
      icon: 'clipboard',
      warn: !s.lastTestDate && !s.testSummary,
      sub: s.testSummary && s.testSummary.label ? s.testSummary.label : null,
    }),
  ]);
}


function renderAthleteList() {
  const wrap = el('div');
  const access = state.user && state.user.access;
  const canAdd = !access || access.canAddAthlete !== false || state.user.role === 'admin';

  // Form Tambah Atlet: halaman fokus tersendiri, pola sama seperti
  // state.view === 'athlete-edit' di renderAthleteDetail() — early return
  // SEBELUM dashboard Markas (renderCoachPortal) dirender, supaya klik
  // "Tambah Atlet" langsung berpindah ke form, bukan menambahkannya di
  // bawah seluruh dashboard (Panel Admin, stat tile, sesi hari ini, dst).
  if (state.view === 'athlete-form') {
    if (!canAdd) {
      wrap.appendChild(el('div', { class: 'callout callout-warning' }, [
        el('p', {}, [(access && access.message) || 'Anda tidak bisa menambah atlet saat ini.']),
        el('div', { style: 'margin-top:10px;' }, [renderUpgradeButton('Pilih paket')]),
      ]));
      return wrap;
    }
    wrap.appendChild(renderAthleteForm(null));
    return wrap;
  }

  wrap.appendChild(renderCoachPortal());
  const addBtn = canAdd
    ? el('button', { onclick: () => { state.view = 'athlete-form'; render(); } }, [icon('plus'), 'Tambah Atlet'])
    : el('button', {
      class: 'secondary',
      disabled: 'true',
      title: (access && access.message) || 'Batas atlet tercapai',
    }, [icon('plus'), 'Tambah Atlet (terkunci)']);

  // Filter admin: tampilkan nama pelatih, bukan coachId mentah
  if (state.user && state.user.role === 'admin' && state.adminFilterCoachId) {
    const coachLabel = coachNameById(state.adminFilterCoachId);
    wrap.appendChild(el('div', { class: 'callout callout-warning' }, [
      el('p', {}, [
        'Sedang memfilter atlet milik ',
        el('strong', {}, [coachLabel]),
        '.',
      ]),
      el('button', {
        type: 'button',
        class: 'secondary',
        style: 'margin-top:8px;',
        onclick: async () => {
          state.adminFilterCoachId = null;
          state.adminFilterCoachName = null;
          await loadAthletes();
          render();
        },
      }, ['Tampilkan semua']),
    ]));
  }

  wrap.appendChild(el('div', { class: 'row' }, [
    el('p', { class: 'muted' }, [
      state.adminFilterCoachId
        ? `Atlet milik ${coachNameById(state.adminFilterCoachId)}.`
        : 'Kelola atlet dan program latihan mereka.',
    ]),
    addBtn,
  ]));

  if (!state.athletes.length) {
    wrap.appendChild(el('div', { class: 'card empty-state' }, [
      emptyIllustration('users'),
      'Belum ada atlet. Tambahkan atlet pertama Anda.',
      canAdd ? null : el('p', { class: 'muted' }, [(access && access.message) || '']),
    ]));
    return wrap;
  }

  const counts = {};
  state.athletes.forEach((a) => { counts[a.profile.kategori] = (counts[a.profile.kategori] || 0) + 1; });
  const statCards = [
    el('div', { class: 'stat-card' }, [
      el('div', { class: 'stat-value' }, [String(state.athletes.length)]),
      el('div', { class: 'stat-label' }, [icon('users'), 'Total Atlet']),
    ]),
  ];
  Object.keys(counts).forEach((k) => {
    statCards.push(el('div', { class: 'stat-card' }, [
      el('div', { class: 'stat-value' }, [String(counts[k])]),
      el('div', { class: 'stat-label' }, [el('span', { class: `badge badge-cat-${k}` }, [icon(CATEGORY_ICON[k]), categoryLabel(k)])]),
    ]));
  });
  wrap.appendChild(el('div', { class: 'stat-card-grid' }, statCards));

  // .athlete-list-fit sudah lama distyle di style.css (flex:1 + overflow:
  // auto, komentar "Meja kerja: daftar atlet bisa scroll internal, header
  // portal tetap") tapi belum pernah ditempel ke elemen manapun di sini —
  // makanya kartu roster ini ikut kepotong overflow:hidden milik wrap-nya
  // (.cmd-stage-body > div, lihat style.css) tanpa cara mencapai sisanya.
  const list = el('div', { class: 'card athlete-list-fit' });
  const showCoachCol = !!(state.user && state.user.role === 'admin' && !state.adminFilterCoachId);
  const headCols = showCoachCol
    ? ['Atlet', 'Pelatih', 'Kategori', 'Nomor', 'Mulai Program', 'Kompetisi', 'ACWR', 'Rata² Hasil Tes', '']
    : ['Atlet', 'Kategori', 'Nomor', 'Mulai Program', 'Kompetisi', 'ACWR', 'Rata² Hasil Tes', ''];
  const table = el('table', {}, [
    el('thead', {}, [el('tr', {}, headCols.map((h) => el('th', {}, [h])))]),
  ]);
  const tbody = el('tbody');
  state.athletes.forEach((a) => {
    // Baris klik langsung buka atlet (nama sudah bisa diklik) — kolom aksi
    // "Buka" diganti indikator ACWR & rata-rata skor teknik supaya pelatih
    // bisa memindai status atlet langsung dari daftar, tanpa buka satu-satu.
    const openThis = () => { state.selectedAthleteId = a.id; state.athleteTab = 'program'; state.editingTestId = null; state.editingLogId = null; openAthlete(a.id); };
    const s = a.summary || {};
    const acwrCell = s.acwr && s.acwr.eligible
      ? el('span', { class: `badge ${s.acwr.atRisk ? 'badge-risk' : 'badge-ok'}` }, [s.acwr.atRisk ? 'Risiko' : 'Aman'])
      : el('span', { class: 'muted' }, ['–']);
    const testCell = s.testSummary
      ? el('span', { class: `badge ${tierBadgeClass(s.testSummary.tierIndex)}`, title: `${s.testSummary.label}${s.testSummary.tierLabel ? ' — ' + s.testSummary.tierLabel : ''}` }, [
        `${s.testSummary.value.toFixed(s.testSummary.unit === 'm' ? 2 : 1)}${s.testSummary.unit ? ' ' + s.testSummary.unit : ''}`,
      ])
      : el('span', { class: 'muted' }, ['–']);
    tbody.appendChild(el('tr', { class: 'row-clickable', onclick: openThis }, [
      el('td', {}, [el('div', { class: 'athlete-name-cell' }, [
        el('div', { class: 'avatar-circle' }, [initials(a.profile.nama)]),
        a.profile.nama,
      ])]),
      showCoachCol ? el('td', {}, [a.selfCoached ? 'Atlet mandiri' : coachNameById(a.coachId)]) : null,
      el('td', {}, [el('span', { class: `badge badge-cat-${a.profile.kategori}` }, [icon(CATEGORY_ICON[a.profile.kategori]), categoryLabel(a.profile.kategori)])]),
      el('td', {}, [a.profile.event]),
      el('td', {}, [fmtDate(a.periodization.startDate)]),
      el('td', {}, [fmtDate(a.periodization.compDate)]),
      el('td', {}, [acwrCell]),
      el('td', {}, [testCell]),
      el('td', { class: 'row-chevron' }, [icon('chevron-right')]),
    ]));
  });
  table.appendChild(tbody);
  list.appendChild(el('div', { class: 'table-wrap' }, [table]));
  wrap.appendChild(list);
  return wrap;
}

function eventsForCategory(kategori) {
  const cat = state.categories && state.categories[kategori];
  return cat ? cat.events : [];
}

function categoryNeedsBest100m(kategori) {
  const cat = state.categories && state.categories[kategori];
  return cat ? cat.needsBest100m : false;
}

function renderAthleteForm(athlete) {
  const p = (athlete && athlete.profile) || {};
  const pd = (athlete && athlete.periodization) || {};
  const categoryKeys = Object.keys(state.categories || {});
  const initialKategori = p.kategori || categoryKeys[0] || '';

  const nama = el('input', { value: p.nama || '', required: 'true' });
  const kategori = el('select', { required: 'true' }, categoryKeys.map((k) =>
    el('option', { value: k, selected: k === initialKategori ? 'true' : undefined }, [state.categories[k].label])));
  const event = el('select', { required: 'true' }, eventsForCategory(initialKategori).map((v) =>
    el('option', { value: v, selected: p.event === v ? 'true' : undefined }, [v])));
  const usia = el('input', { type: 'number', value: p.usia || '', required: 'true' });
  const jk = el('select', { required: 'true' }, [
    el('option', { value: '' }, ['Pilih...']),
    el('option', { value: 'L', selected: p.jenisKelamin === 'L' ? 'true' : undefined }, ['Laki-laki']),
    el('option', { value: 'P', selected: p.jenisKelamin === 'P' ? 'true' : undefined }, ['Perempuan']),
  ]);
  const tinggi = el('input', { type: 'number', value: p.tinggi ?? '' });
  const berat = el('input', { type: 'number', value: p.berat ?? '' });
  const pengalaman = el('input', { type: 'number', value: p.pengalaman ?? '' });
  const alergiMakanan = el('input', { value: p.alergiMakanan || '', required: 'true', placeholder: 'Contoh: kacang, seafood — atau isi "Tidak ada"' });
  const pantanganMakanan = el('input', { value: p.pantanganMakanan || '', required: 'true', placeholder: 'Contoh: vegetarian, tidak makan daging babi — atau isi "Tidak ada"' });
  const best100m = el('input', { type: 'number', step: '0.01', value: p.best100m ?? '' });
  const best100mWrap = el('div', { style: categoryNeedsBest100m(initialKategori) ? '' : 'display:none;' }, [
    el('label', {}, ['Catatan waktu 100m (detik)']), best100m,
  ]);
  const startDate = el('input', { type: 'date', value: pd.startDate || '', required: 'true' });
  const compDate = el('input', { type: 'date', value: pd.compDate || '', required: 'true' });
  const manualPhase = el('select', {}, [
    el('option', { value: '' }, ['Otomatis (disarankan)']),
    ...['umum', 'khusus', 'puncak', 'transisi'].map((v) =>
      el('option', { value: v, selected: pd.manualPhase === v ? 'true' : undefined }, [v])),
  ]);

  kategori.addEventListener('change', () => {
    const k = kategori.value;
    event.innerHTML = '';
    eventsForCategory(k).forEach((v) => event.appendChild(el('option', { value: v }, [v])));
    best100mWrap.style.display = categoryNeedsBest100m(k) ? '' : 'none';
  });

  return el('div', { class: 'card' }, [
    el('h3', {}, [athlete ? 'Ubah Atlet' : 'Tambah Atlet Baru']),
    state.error ? el('div', { class: 'error-box' }, [state.error]) : null,
    el('form', {
    autocomplete: 'off',
      onsubmit: async (e) => {
        e.preventDefault();
        state.error = null;
        const body = {
          nama: nama.value, kategori: kategori.value, event: event.value, usia: usia.value, jenisKelamin: jk.value,
          tinggi: tinggi.value, berat: berat.value, pengalaman: pengalaman.value, best100m: best100m.value,
          alergiMakanan: alergiMakanan.value, pantanganMakanan: pantanganMakanan.value,
          startDate: startDate.value, compDate: compDate.value, manualPhase: manualPhase.value,
        };
        try {
          if (athlete) {
            await api('PUT', `/athletes/${athlete.id}`, body);
          } else {
            await api('POST', '/athletes', body);
            // Refresh status akses (batas atlet trial/expired)
            try { state.user = await api('GET', '/auth/me'); } catch (_) { /* ignore */ }
          }
          state.view = 'app';
          await loadAthletes();
        } catch (err) {
          state.error = err.message;
        }
        render();
      },
    }, [
      el('div', { class: 'field-row' }, [
        el('div', {}, [el('label', {}, ['Nama Atlet']), nama]),
        el('div', {}, [el('label', {}, ['Kategori']), kategori]),
        el('div', {}, [el('label', {}, ['Nomor']), event]),
        el('div', {}, [el('label', {}, ['Usia']), usia]),
      ]),
      el('div', { class: 'field-row' }, [
        el('div', {}, [el('label', {}, ['Jenis Kelamin']), jk]),
        el('div', {}, [el('label', {}, ['Tinggi (cm)']), tinggi]),
        el('div', {}, [el('label', {}, ['Berat (kg)']), berat]),
        el('div', {}, [el('label', {}, ['Pengalaman (tahun)']), pengalaman]),
      ]),
      best100mWrap,
      el('div', { class: 'field-row' }, [
        el('div', {}, [el('label', {}, ['Alergi Makanan']), alergiMakanan]),
        el('div', {}, [el('label', {}, ['Pantangan Makanan']), pantanganMakanan]),
      ]),
      el('h4', {}, ['Periodisasi']),
      el('div', { class: 'field-row' }, [
        el('div', {}, [el('label', {}, ['Tanggal Mulai Program']), startDate]),
        el('div', {}, [el('label', {}, ['Tanggal Kompetisi Target']), compDate]),
        el('div', {}, [el('label', {}, ['Override Fase (opsional)']), manualPhase]),
      ]),
      el('div', { class: 'row' }, [
        el('button', { type: 'submit' }, ['Simpan']),
        el('button', {
          type: 'button', class: 'secondary', onclick: () => { state.view = 'app'; state.error = null; render(); },
        }, ['Batal']),
      ]),
    ]),
  ]);
}

async function openAthlete(id) {
  state.selectedAthleteId = id;
  state.showGuide = false;
  state.error = null;
  await loadAthleteTab();
  render();
}

/** Senin minggu berjalan (YYYY-MM-DD) di zona lokal browser */
function localMondayKey(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function addDaysKeyLocal(yyyyMmDd, days) {
  const p = String(yyyyMmDd).slice(0, 10).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Gabungkan sesi source=extra dari kalender bulan ini ke program minggu ini (fallback jika API program belum update). */
function mergeExtrasFromCalendar(program, calendar) {
  if (!program) return program;
  const wk = localMondayKey();
  const weekEnd = addDaysKeyLocal(wk, 6);
  const sessions = Array.isArray(program.sessions) ? program.sessions.slice() : [];
  const keys = new Set(sessions.map((s) => s.key).filter(Boolean));
  let added = 0;
  const days = (calendar && calendar.days) ? calendar.days : {};
  Object.keys(days).forEach((dateKey) => {
    if (dateKey < wk || dateKey > weekEnd) return;
    const day = days[dateKey];
    (day.sessions || []).forEach((s) => {
      const isExtra = s.source === 'extra' || (s.override && s.override.kind === 'extra');
      if (!isExtra) return;
      const key = s.key || `extra-cal-${dateKey}-${s.name || ''}`;
      if (keys.has(key)) return;
      keys.add(key);
      sessions.push({
        ...s,
        key,
        source: 'extra',
        day: s.day || dateKey,
        mode: s.mode || 'extra',
        override: s.override || { manual: true, kind: 'extra' },
      });
      added += 1;
    });
  });
  program.sessions = sessions;
  program.extrasApplied = (program.extrasApplied || 0) + added;
  program.weekKey = program.weekKey || wk;
  return program;
}

async function loadAthleteTab() {
  const id = state.selectedAthleteId;
  if (state.athleteTab === 'program') {
    const now = new Date();
    if (state.calendarYear == null) state.calendarYear = now.getFullYear();
    if (state.calendarMonth == null) state.calendarMonth = now.getMonth() + 1;
    const y = state.calendarYear;
    const m = state.calendarMonth;
    const [program, tests, monitoringLogs, calendar] = await Promise.all([
      api('GET', `/athletes/${id}/program`),
      api('GET', `/athletes/${id}/tests`),
      api('GET', `/athletes/${id}/monitoring`),
      api('GET', `/athletes/${id}/calendar?year=${y}&month=${m}`).catch(() => null),
    ]);
    state.program = mergeExtrasFromCalendar(program, calendar);
    state.tests = tests;
    state.monitoringLogs = monitoringLogs;
    if (calendar) state.calendar = calendar;
    if (!state.calendarSelectedDate) state.calendarSelectedDate = todayLocalDate();
    if (!state.scheduleView) state.scheduleView = 'week';
    if (isMobileUi()) state.scheduleView = 'day';
  } else if (state.athleteTab === 'calendar') {
    state.athleteTab = 'program';
    state.scheduleView = state.scheduleView || 'month';
    return loadAthleteTab();
  } else if (state.athleteTab === 'tests') {
    const [tests, checklist, program] = await Promise.all([
      api('GET', `/athletes/${id}/tests`),
      api('GET', `/athletes/${id}/tests/technique-checklist`),
      api('GET', `/athletes/${id}/program`).catch(() => state.program),
    ]);
    state.tests = tests;
    state.techniqueChecklist = checklist;
    if (program) state.program = program;
  } else if (state.athleteTab === 'monitoring') {
    state.monitoringLogs = await api('GET', `/athletes/${id}/monitoring`);
    state.acwr = await api('GET', `/athletes/${id}/monitoring/acwr`);
    state.acwrSeries = await api('GET', `/athletes/${id}/monitoring/acwr-series?days=42`);
  } else if (state.athleteTab === 'nutrition') {
    state.nutrition = await api('GET', `/athletes/${id}/nutrition`);
  } else if (state.athleteTab === 'athlete-feed') {
    state.athleteFeed = await api('GET', `/athletes/${id}/athlete-feed`);
  }
}

async function loadCalendar() {
  const id = state.selectedAthleteId;
  const now = new Date();
  if (state.calendarYear == null) state.calendarYear = now.getFullYear();
  if (state.calendarMonth == null) state.calendarMonth = now.getMonth() + 1;
  state.calendar = await api('GET', `/athletes/${id}/calendar?year=${state.calendarYear}&month=${state.calendarMonth}`);
  state.calendarSelectedDate = null;
}

async function navigateCalendar(delta) {
  let month = state.calendarMonth + delta;
  let year = state.calendarYear;
  if (month < 1) { month = 12; year -= 1; }
  if (month > 12) { month = 1; year += 1; }
  state.calendarMonth = month;
  state.calendarYear = year;
  await loadCalendar();
  render();
}

function showInviteCopyModal(code, athleteUrl) {
  const overlay = el('div', { class: 'plan-modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const codeInput = el('input', {
    type: 'text',
    readonly: 'true',
    value: String(code || '').toUpperCase(),
    style: 'font-size:1.5rem;font-weight:800;letter-spacing:0.2em;text-align:center;text-transform:uppercase;',
    onclick: (e) => { e.target.select(); },
  });
  const urlInput = el('input', {
    type: 'text',
    readonly: 'true',
    value: athleteUrl,
    style: 'font-size:0.95rem;',
    onclick: (e) => { e.target.select(); },
  });
  function copyFrom(input, btn) {
    const text = input.value;
    const done = () => {
      const old = btn.textContent;
      btn.textContent = 'Tersalin ✓';
      setTimeout(() => { btn.textContent = old; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        input.select();
        document.execCommand('copy');
        done();
      });
    } else {
      input.select();
      document.execCommand('copy');
      done();
    }
  }
  const copyCodeBtn = el('button', { type: 'button', class: 'secondary', onclick: () => copyFrom(codeInput, copyCodeBtn) }, ['Salin kode']);
  const copyUrlBtn = el('button', { type: 'button', class: 'secondary', onclick: () => copyFrom(urlInput, copyUrlBtn) }, ['Salin alamat web']);
  const copyAllBtn = el('button', {
    type: 'button',
    onclick: () => {
      const blob = `Atletik Pro — Aplikasi Atlet\nKode undangan: ${code}\nAlamat: ${athleteUrl}\n\nBuka alamat di HP, daftar/masuk sebagai atlet, lalu masukkan kode.`;
      const btn = copyAllBtn;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(blob).then(() => {
          btn.textContent = 'Semua tersalin ✓';
          setTimeout(() => { btn.textContent = 'Salin semua (kode + alamat)'; }, 1500);
        });
      } else {
        alert(blob);
      }
    },
  }, ['Salin semua (kode + alamat)']);

  const card = el('div', { class: 'plan-modal card invite-copy-modal' }, [
    el('h3', {}, ['Undangan aplikasi atlet']),
    el('p', { class: 'muted' }, ['Bagikan kode unik dan alamat web ini ke atlet. Kode hanya bisa dipakai sekali.']),
    el('label', {}, ['Kode undangan']),
    codeInput,
    el('div', { class: 'row-actions', style: 'margin-bottom:12px;' }, [copyCodeBtn]),
    el('label', {}, ['Alamat web aplikasi atlet']),
    urlInput,
    el('div', { class: 'row-actions', style: 'margin-bottom:12px;' }, [copyUrlBtn]),
    el('div', { class: 'callout callout-warning', style: 'margin-bottom:12px;' }, [
      el('p', { style: 'margin:0;font-size:0.88rem;' }, [
        'Atlet membuka alamat → daftar/masuk → masukkan kode → terhubung ke profil ',
        el('strong', {}, ['latihan yang Anda undang']),
        '.',
      ]),
    ]),
    copyAllBtn,
    el('button', {
      type: 'button', class: 'secondary', style: 'margin-top:8px;width:100%;',
      onclick: () => overlay.remove(),
    }, ['Tutup']),
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  setTimeout(() => { codeInput.focus(); codeInput.select(); }, 50);
}


function athleteLatestTest(athleteId, testsList) {
  const tests = (testsList || []).filter((x) => x.athleteId == null || x.athleteId === athleteId);
  if (!tests.length) return null;
  return [...tests].sort((a, b) => new Date(b.date) - new Date(a.date) || (b.id - a.id))[0];
}


function getCompareBundle(athleteId) {
  const cache = state.compareCache && state.compareCache.byId;
  if (cache && cache[athleteId]) return cache[athleteId];
  // fallback: primary athlete uses live state
  if (state.selectedAthleteId === athleteId) {
    return {
      tests: state.tests || [],
      mon: state.monitoringLogs || [],
      acwr: (state.program && state.program.acwr) || state.acwr || null,
      phaseLabel: state.program && state.program.phase ? state.program.phase.label : null,
      remainingWeeks: state.program && state.program.phase ? state.program.phase.remainingWeeks : null,
    };
  }
  return { tests: [], mon: [], acwr: null, phaseLabel: null, remainingWeeks: null };
}

function compareNumericMetric(athlete) {
  const p = athlete.profile || {};
  const sum = athlete.summary || {};
  const bundle = getCompareBundle(athlete.id);

  let acwrVal = null;
  if (bundle.acwr && bundle.acwr.eligible && bundle.acwr.acwr != null) {
    acwrVal = Number(bundle.acwr.acwr);
  } else if (sum.acwr && sum.acwr.acwr != null) {
    acwrVal = Number(sum.acwr.acwr);
  }

  let weeks = null;
  if (bundle.remainingWeeks != null) weeks = bundle.remainingWeeks;
  else if (sum.weeksToComp != null) weeks = sum.weeksToComp;
  else if (athlete.periodization && athlete.periodization.compDate) {
    const t0 = new Date(todayLocalDate() + 'T00:00:00');
    const t1 = new Date(athlete.periodization.compDate + 'T00:00:00');
    weeks = Math.max(0, Math.round((t1 - t0) / (7 * 86400000)));
  }

  const tests = bundle.tests || [];
  const latest = [...tests].sort((a, b) => new Date(b.date) - new Date(a.date) || (b.id - a.id))[0] || null;
  let power = null;
  let vdot = null;
  if (latest && latest.rast && latest.rast.relPower != null) power = Number(latest.rast.relPower);
  if (latest && latest.vdot != null) vdot = Number(latest.vdot);
  if (latest && latest.slj != null && power == null) power = Number(latest.slj);

  const mon = bundle.mon || [];
  const today = new Date(todayLocalDate() + 'T00:00:00');
  let load7 = 0;
  mon.forEach((m) => {
    const d = new Date(m.date + 'T00:00:00');
    const diff = (today - d) / 86400000;
    if (diff <= 6 && diff >= 0 && m.rpe != null && m.durationMin != null) {
      load7 += Number(m.rpe) * Number(m.durationMin);
    }
  });

  return {
    id: athlete.id,
    name: p.nama || 'Atlet',
    kategori: categoryLabel(p.kategori) || p.kategori || '—',
    phase: bundle.phaseLabel || sum.phaseLabel || '—',
    acwr: acwrVal,
    weeks,
    power,
    vdot,
    load7: load7 > 0 ? load7 : null,
    latestDate: latest ? latest.date : null,
    tests,
    mon,
  };
}

function compareNarrative(metricKey, nameA, nameB, valA, valB) {
  const a = valA != null && Number.isFinite(Number(valA)) ? Number(valA) : null;
  const b = valB != null && Number.isFinite(Number(valB)) ? Number(valB) : null;
  if (a == null && b == null) return 'Data belum tersedia untuk kedua atlet.';
  if (a == null) return `Baru ${nameB} yang punya data pada metrik ini.`;
  if (b == null) return `Baru ${nameA} yang punya data pada metrik ini.`;
  const diff = Math.abs(a - b);
  const approxEq = diff < 0.05 || (Math.max(Math.abs(a), Math.abs(b)) > 0 && diff / Math.max(Math.abs(a), Math.abs(b), 0.01) < 0.03);

  if (metricKey === 'acwr') {
    if (approxEq) return `Beban relatif ${nameA} dan ${nameB} sejajar — risiko kelelahan serupa.`;
    if (a < 0.8 && b < 0.8) return `Keduanya di zona undertraining; ${a < b ? nameA : nameB} sedikit lebih rendah.`;
    if (a > 1.5 || b > 1.5) {
      const hot = a > b ? nameA : nameB;
      return `${hot} di zona risiko ACWR tinggi — prioritaskan recovery.`;
    }
    if (a > b) return `ACWR ${nameA} lebih tinggi dari ${nameB}: volume akut ${nameA} relatif lebih agresif.`;
    return `ACWR ${nameB} lebih tinggi dari ${nameA}: volume akut ${nameB} relatif lebih agresif.`;
  }
  if (metricKey === 'load7') {
    if (approxEq) return `Volume 7 hari ${nameA} dan ${nameB} hampir sama.`;
    if (a > b) return `${nameA} menanggung beban latihan 7 hari lebih besar daripada ${nameB}.`;
    return `${nameB} menanggung beban latihan 7 hari lebih besar daripada ${nameA}.`;
  }
  if (metricKey === 'weeks') {
    if (approxEq) return `${nameA} dan ${nameB} punya sisa waktu ke kompetisi yang mirip.`;
    if (a < b) return `${nameA} lebih dekat ke hari kompetisi daripada ${nameB}.`;
    return `${nameB} lebih dekat ke hari kompetisi daripada ${nameA}.`;
  }
  if (metricKey === 'power') {
    if (approxEq) return `Skor tes terakhir ${nameA} dan ${nameB} setara.`;
    if (a > b) return `Hasil tes terakhir ${nameA} lebih kuat daripada ${nameB}.`;
    return `Hasil tes terakhir ${nameB} lebih kuat daripada ${nameA}.`;
  }
  if (metricKey === 'vdot') {
    if (approxEq) return `VDOT ${nameA} dan ${nameB} berada di level serupa.`;
    if (a > b) return `Kebugaran aerobik (VDOT) ${nameA} saat ini lebih tinggi daripada ${nameB}.`;
    return `Kebugaran aerobik (VDOT) ${nameB} saat ini lebih tinggi daripada ${nameA}.`;
  }
  return '';
}

function compareBarRow(label, metricKey, nameA, nameB, valA, valB, format) {
  const a = valA != null && Number.isFinite(Number(valA)) ? Number(valA) : null;
  const b = valB != null && Number.isFinite(Number(valB)) ? Number(valB) : null;
  const max = Math.max(a != null ? Math.abs(a) : 0, b != null ? Math.abs(b) : 0, 0.01);
  const pctA = a != null ? Math.round((Math.abs(a) / max) * 100) : 0;
  const pctB = b != null ? Math.round((Math.abs(b) / max) * 100) : 0;
  const fmt = format || ((v) => (v == null ? '—' : String(v)));
  const tip = compareNarrative(metricKey, nameA, nameB, a, b);
  return el('div', { class: 'compare-bar-row' }, [
    el('div', { class: 'compare-bar-label' }, [el('span', {}, [label])]),
    el('div', { class: 'compare-bar-pair' }, [
      el('div', { class: 'compare-bar-track compare-bar-a' }, [
        el('div', { class: 'compare-bar-fill', style: 'width:' + pctA + '%;' }),
        el('span', { class: 'compare-bar-val' }, [fmt(a)]),
      ]),
      el('div', { class: 'compare-bar-track compare-bar-b' }, [
        el('div', { class: 'compare-bar-fill', style: 'width:' + pctB + '%;' }),
        el('span', { class: 'compare-bar-val' }, [fmt(b)]),
      ]),
    ]),
    tip ? el('p', { class: 'compare-narrative muted' }, [tip]) : null,
  ]);
}


function buildCompareLoadSeries(mon, days) {
  const today = new Date(todayLocalDate() + 'T00:00:00');
  const map = {};
  (mon || []).forEach((m) => {
    if (m.rpe == null || m.durationMin == null) return;
    map[m.date] = (map[m.date] || 0) + m.rpe * m.durationMin;
  });
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({ x: key, y: map[key] != null ? map[key] : 0 });
  }
  return points;
}

function renderCompareView(primary) {
  const other = (state.athletes || []).find((a) => a.id === state.compareWithId);
  if (!other) {
    return el('div', { class: 'card' }, [
      el('p', {}, ['Pilih atlet pembanding.']),
      el('button', { class: 'secondary', onclick: () => { state.compareWithId = null; state.compareCache = null; render(); } }, ['Tutup']),
    ]);
  }
  const mA = compareNumericMetric(primary);
  const mB = compareNumericMetric(other);

  const wrap = el('div', { class: 'page-frame compare-frame' });
  wrap.appendChild(el('div', { class: 'compare-toolbar' }, [
    el('div', { class: 'compare-legend' }, [
      el('span', { class: 'compare-dot compare-dot-a' }),
      el('strong', {}, [mA.name]),
      el('span', { class: 'muted' }, [' · ' + mA.kategori + (mA.phase && mA.phase !== '—' ? ' · ' + mA.phase : '')]),
    ]),
    el('div', { class: 'compare-legend' }, [
      el('span', { class: 'compare-dot compare-dot-b' }),
      el('strong', {}, [mB.name]),
      el('span', { class: 'muted' }, [' · ' + mB.kategori + (mB.phase && mB.phase !== '—' ? ' · ' + mB.phase : '')]),
    ]),
    el('button', {
      type: 'button', class: 'secondary pill-btn',
      onclick: () => { state.compareWithId = null; state.compareCache = null; render(); },
    }, ['Tutup']),
  ]));

  // Dual chart: training load 14 hari
  const seriesA = buildCompareLoadSeries(mA.mon || [], 14);
  const seriesB = buildCompareLoadSeries(mB.mon || [], 14);
  const chartCard = el('div', { class: 'card compare-chart-card' }, [
    el('h3', {}, ['Beban latihan 14 hari (RPE × durasi)']),
    el('div', { class: 'compare-dual-charts' }, [
      el('div', {}, [
        el('p', { class: 'muted', style: 'font-size:0.8rem;margin:0 0 4px;' }, [mA.name]),
        buildBarChart({ points: seriesA, height: 120, color: 'var(--primary)', valueFormat: (v) => String(Math.round(v)) }),
      ]),
      el('div', {}, [
        el('p', { class: 'muted', style: 'font-size:0.8rem;margin:0 0 4px;' }, [mB.name]),
        buildBarChart({ points: seriesB, height: 120, color: '#0d9488', valueFormat: (v) => String(Math.round(v)) }),
      ]),
    ]),
  ]);

  // RAST / VDOT progress if available
  const testsA = mA.tests || [];
  const testsB = mB.tests || [];
  const rastA = testsA.filter((x) => x.rast && x.rast.relPower != null).slice().reverse();
  const rastB = testsB.filter((x) => x.rast && x.rast.relPower != null).slice().reverse();
  const vdotA = testsA.filter((x) => x.vdot != null).slice().reverse();
  const vdotB = testsB.filter((x) => x.vdot != null).slice().reverse();

  let progressCard = null;
  if (rastA.length >= 2 || rastB.length >= 2) {
    progressCard = el('div', { class: 'card compare-chart-card' }, [
      el('h3', {}, ['Progres RAST Power (W/kg)']),
      el('div', { class: 'compare-dual-charts' }, [
        el('div', {}, [
          el('p', { class: 'muted', style: 'font-size:0.8rem;margin:0 0 4px;' }, [mA.name]),
          rastA.length >= 2
            ? buildLineChart({ points: rastA.map((t) => ({ x: t.date, y: t.rast.relPower })), height: 120, valueFormat: (v) => v.toFixed(1) })
            : el('p', { class: 'muted' }, ['Belum cukup data']),
        ]),
        el('div', {}, [
          el('p', { class: 'muted', style: 'font-size:0.8rem;margin:0 0 4px;' }, [mB.name]),
          rastB.length >= 2
            ? buildLineChart({ points: rastB.map((t) => ({ x: t.date, y: t.rast.relPower })), height: 120, color: '#0d9488', valueFormat: (v) => v.toFixed(1) })
            : el('p', { class: 'muted' }, ['Belum cukup data']),
        ]),
      ]),
    ]);
  } else if (vdotA.length >= 2 || vdotB.length >= 2) {
    progressCard = el('div', { class: 'card compare-chart-card' }, [
      el('h3', {}, ['Progres VDOT']),
      el('div', { class: 'compare-dual-charts' }, [
        el('div', {}, [
          el('p', { class: 'muted', style: 'font-size:0.8rem;margin:0 0 4px;' }, [mA.name]),
          vdotA.length >= 2
            ? buildLineChart({ points: vdotA.map((t) => ({ x: t.date, y: t.vdot })), height: 120, valueFormat: (v) => v.toFixed(1) })
            : el('p', { class: 'muted' }, ['Belum cukup data']),
        ]),
        el('div', {}, [
          el('p', { class: 'muted', style: 'font-size:0.8rem;margin:0 0 4px;' }, [mB.name]),
          vdotB.length >= 2
            ? buildLineChart({ points: vdotB.map((t) => ({ x: t.date, y: t.vdot })), height: 120, color: '#0d9488', valueFormat: (v) => v.toFixed(1) })
            : el('p', { class: 'muted' }, ['Belum cukup data']),
        ]),
      ]),
    ]);
  }

  const bars = el('div', { class: 'card compare-bars-card' }, [
    el('h3', {}, ['Metrik utama']),
    compareBarRow('ACWR', 'acwr', mA.name, mB.name, mA.acwr, mB.acwr, (v) => (v == null ? '—' : v.toFixed(2))),
    compareBarRow('Beban 7 hari', 'load7', mA.name, mB.name, mA.load7, mB.load7, (v) => (v == null ? '—' : String(Math.round(v)))),
    compareBarRow('Minggu ke kompetisi', 'weeks', mA.name, mB.name, mA.weeks, mB.weeks, (v) => (v == null ? '—' : String(v))),
    (mA.power != null || mB.power != null)
      ? compareBarRow('Skor tes terakhir (RAST/lompat)', 'power', mA.name, mB.name, mA.power, mB.power, (v) => (v == null ? '—' : v.toFixed(1)))
      : null,
    (mA.vdot != null || mB.vdot != null)
      ? compareBarRow('VDOT terakhir', 'vdot', mA.name, mB.name, mA.vdot, mB.vdot, (v) => (v == null ? '—' : v.toFixed(1)))
      : null,
  ]);

  const body = el('div', { class: 'compare-body module-scroll' }, [
    bars,
    chartCard,
    progressCard,
  ].filter(Boolean));
  wrap.appendChild(body);
  return wrap;
}

async function openComparePicker(primaryId) {
  const others = (state.athletes || []).filter((a) => a.id !== primaryId);
  if (!others.length) {
    alert('Belum ada atlet lain untuk dibanding.');
    return;
  }
  const overlay = el('div', { class: 'plan-modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const list = el('div', { class: 'compare-picker-list' });
  others.forEach((a) => {
    list.appendChild(el('button', {
      type: 'button',
      class: 'nav-item',
      style: 'width:100%;margin-bottom:4px;',
      onclick: async () => {
        const idB = a.id;
        const idA = primaryId;
        state.compareWithId = idB;
        state.compareCache = null;
        overlay.remove();
        try {
          const results = await Promise.all([
            api('GET', '/athletes/' + idA + '/tests'),
            api('GET', '/athletes/' + idA + '/monitoring'),
            api('GET', '/athletes/' + idA + '/monitoring/acwr'),
            api('GET', '/athletes/' + idB + '/tests'),
            api('GET', '/athletes/' + idB + '/monitoring'),
            api('GET', '/athletes/' + idB + '/monitoring/acwr'),
          ]);
          const [testsA, monA, acwrA, testsB, monB, acwrB] = results;
          const phaseA = state.program && state.program.phase ? state.program.phase : null;
          state.compareCache = {
            byId: {
              [idA]: {
                tests: testsA || [],
                mon: monA || [],
                acwr: acwrA || null,
                phaseLabel: phaseA ? phaseA.label : null,
                remainingWeeks: phaseA ? phaseA.remainingWeeks : null,
              },
              [idB]: {
                tests: testsB || [],
                mon: monB || [],
                acwr: acwrB || null,
                phaseLabel: null,
                remainingWeeks: null,
              },
            },
          };
        } catch (err) {
          state.compareCache = { byId: {} };
        }
        render();
      },
    }, [a.profile.nama || ('Atlet #' + a.id)]));
  });
  overlay.appendChild(el('div', { class: 'plan-modal card' }, [
    el('h3', {}, ['Pilih atlet pembanding']),
    el('p', { class: 'muted' }, ['Layout kiri–kanan 50:50.']),
    list,
    el('button', { type: 'button', class: 'secondary', style: 'width:100%;margin-top:8px;', onclick: () => overlay.remove() }, ['Batal']),
  ]));
  document.body.appendChild(overlay);
}

function renderAthleteDetail() {
  const athlete = state.athletes.find((a) => a.id === state.selectedAthleteId);
  const wrap = el('div', { class: 'page-frame athlete-detail-fit' });
  if (!athlete) {
    wrap.appendChild(el('p', {}, ['Atlet tidak ditemukan di daftar saat ini.']));
    wrap.appendChild(el('button', { class: 'secondary', onclick: () => { state.selectedAthleteId = null; render(); } }, [icon('chevron-left'), 'Kembali']));
    return wrap;
  }

  const p = athlete.profile;
  const jkLabel = p.jenisKelamin === 'P' ? 'Perempuan' : p.jenisKelamin === 'L' ? 'Laki-laki' : '—';
  const metaParts = [
    categoryLabel(p.kategori),
    p.event,
    p.usia != null ? `${p.usia} th` : null,
    jkLabel !== '—' ? jkLabel : null,
  ].filter(Boolean);

  // Kartu identitas atlet — selalu di atas tab
  wrap.appendChild(el('div', { class: 'card athlete-identity-card cmd-identity-mobile' }, [
    el('div', { class: 'athlete-identity-row' }, [
      el('div', { class: 'athlete-identity-main' }, [
        el('div', { class: 'avatar-circle athlete-identity-avatar' }, [initials(p.nama)]),
        el('div', {}, [
          el('h2', { class: 'athlete-identity-name' }, [p.nama || 'Tanpa nama']),
          el('div', { class: 'athlete-identity-meta' }, [
            el('span', { class: `badge badge-cat-${p.kategori}` }, [icon(CATEGORY_ICON[p.kategori]), categoryLabel(p.kategori)]),
            el('span', { class: 'muted' }, [metaParts.slice(1).join(' · ')]),
          ]),
          el('div', { class: 'muted', style: 'font-size:0.85rem;margin-top:4px;' }, [
            `Program: ${fmtDate(athlete.periodization.startDate)} → ${fmtDate(athlete.periodization.compDate)}`,
            p.best100m != null ? ` · Best 100m: ${p.best100m}s` : '',
          ]),
        ]),
      ]),
      el('div', { class: 'row-actions athlete-identity-actions' }, [
        el('button', { class: 'secondary', onclick: () => { state.view = 'athlete-edit'; render(); } }, [icon('pencil'), 'Ubah']),
        el('button', {
          class: 'danger', onclick: async () => {
            if (!confirm(`Hapus atlet "${p.nama}"? Seluruh riwayat tes & monitoring ikut terhapus.`)) return;
            await api('DELETE', `/athletes/${athlete.id}`);
            state.selectedAthleteId = null;
            await loadAthletes();
            render();
          },
        }, [icon('trash'), 'Hapus']),
        el('button', { class: 'secondary', onclick: () => { state.selectedAthleteId = null; state.view = 'app'; render(); } }, [icon('chevron-left'), 'Kembali']),
        el('button', {
          class: 'secondary',
          title: 'Buat kode undangan untuk aplikasi atlet',
          onclick: async () => {
            try {
              const inv = await api('POST', `/athletes/${athlete.id}/invite`, { programAccess: 'reminding' });
              showInviteCopyModal(inv.inviteCode, `${window.location.origin}/athlete.html`);
            } catch (err) {
              alert(err.message || 'Gagal membuat undangan');
            }
          },
        }, [icon('users'), 'Undang atlet']),
      ]),
    ]),
  ]));

  if (state.view === 'athlete-edit') {
    wrap.appendChild(renderAthleteForm(athlete));
    return wrap;
  }

  // Tab dipindah ke sidebar — meja hanya konten

  // Satu navigasi = satu halaman (konten di mini-window)
  const pageBody = el('div', { class: 'page-body mini-win' });
  if (state.compareWithId) {
    pageBody.appendChild(renderCompareView(athlete));
  } else if (state.athleteTab === 'program') {
    pageBody.appendChild(renderProgramTab(athlete));
  } else if (state.athleteTab === 'calendar') {
    state.athleteTab = 'program';
    state.scheduleView = 'month';
    pageBody.appendChild(renderProgramTab(athlete));
  } else {
    const scroll = el('div', { class: 'module-scroll' });
    if (state.athleteTab === 'tests') scroll.appendChild(renderTestsTab(athlete));
    else if (state.athleteTab === 'monitoring') scroll.appendChild(renderMonitoringTab(athlete));
    else if (state.athleteTab === 'nutrition') scroll.appendChild(renderNutritionTab(athlete));
    else if (state.athleteTab === 'athlete-feed') scroll.appendChild(renderAthleteFeedTab(athlete));
    pageBody.appendChild(scroll);
  }
  wrap.appendChild(pageBody);

  return wrap;
}

// ---------- Program tab ----------
// Baris tampilan satu sesi — dipakai bersama tab Program (sesi minggu ini)
// dan tab Kalender (detail sesi per tanggal).
function feedFlagBadge(level) {
  if (level === 'risk') return el('span', { class: 'badge badge-risk' }, ['Risiko']);
  if (level === 'warn') return el('span', { class: 'badge badge-caution' }, ['Pantau']);
  return el('span', { class: 'badge badge-ok' }, ['OK']);
}

function hydrationLabel(h) {
  if (h === 'poor') return 'Buruk';
  if (h === 'good') return 'Baik';
  if (h === 'ok') return 'Cukup';
  return '—';
}

/** Tab pelatih: kesimpulan + rincian input dari aplikasi atlet */
function renderAthleteFeedTab(athlete) {
  const wrap = el('div');
  const feed = state.athleteFeed;
  if (!feed) {
    wrap.appendChild(el('div', { class: 'card' }, ['Memuat input atlet...']));
    return wrap;
  }
  const sum = feed.summary || {};
  // Data asli dari GET /athletes/:id/athlete-feed ada di feed.wellness (bukan
  // feed.preSession/checkins) dan feed.athleteMonitoring — lihat
  // routes/athletes.js. sum.checkins7d/avgRpe/avgSleep/flagLevel tidak pernah
  // dikirim backend (selalu undefined) sehingga tile ini dulu selalu tampil
  // "—"/"OK" apa pun datanya — dipetakan ulang ke field yang benar-benar ada.
  const wellness = feed.wellness || [];
  const mon = feed.athleteMonitoring || [];
  const inj = feed.injuries || [];
  const overallVariant = sum.overall === 'risk' ? 'red' : sum.overall === 'warn' ? 'amber' : 'blue';
  const overallLabel = sum.overall === 'risk' ? 'Risiko' : sum.overall === 'warn' ? 'Perlu Pantau' : 'Stabil';
  const overallIcon = sum.overall === 'risk' ? 'alert-triangle' : sum.overall === 'warn' ? 'flag' : 'shield-check';

  const formChildren = [
    el('h3', {}, [icon('users'), ' Ringkasan input atlet']),
    el('p', { class: 'muted' }, ['Data dari aplikasi atlet (check-in & monitoring mandiri) — kesimpulan cepat, bukan pengganti pemantauan langsung.']),
  ];
  if (sum.headline) {
    formChildren.push(el('p', { style: 'font-weight:700;font-size:1.05rem;margin-top:12px;' }, [sum.headline]));
  }
  formChildren.push(el('div', { class: 'portal-tiles portal-tiles-stack portal-tiles-2col' }, [
    statTile({
      ic: 'message-circle', variant: 'blue',
      value: sum.lastWellnessDate ? fmtDate(sum.lastWellnessDate) : '—',
      label: 'Check-in terakhir',
      sub: wellness.length ? `${wellness.length} entri tercatat` : 'Belum ada isian dari atlet',
    }),
    statTile({
      ic: 'gauge', variant: 'purple',
      value: sum.lastReadiness != null ? sum.lastReadiness : '—', unit: '/10',
      label: 'Kesiapan (readiness)',
      sub: 'Dilaporkan atlet sebelum sesi',
    }),
    statTile({
      ic: 'moon', variant: 'amber',
      value: sum.lastSleep != null ? sum.lastSleep : '—', unit: '/5',
      label: 'Kualitas tidur',
      sub: 'Dilaporkan atlet sebelum sesi',
    }),
    statTile({
      ic: overallIcon, variant: overallVariant,
      value: overallLabel,
      label: 'Status keseluruhan',
      sub: sum.activeInjuryCount ? `${sum.activeInjuryCount} keluhan aktif` : 'Tidak ada keluhan aktif',
    }),
  ]));
  formChildren.push(el('p', { class: 'muted', style: 'font-size:0.8rem;margin-top:8px;' }, [
    'Atlet mengisi lewat /athlete.html. Monitoring pasca-latihan dari atlet ikut dihitung ke ACWR.',
  ]));
  const formCard = el('div', { class: 'card' }, formChildren);

  const sideEls = [];
  sideEls.push(el('div', { class: 'card mod-chart-card' }, [
    el('h4', {}, [icon('message-circle'), ' Check-in terbaru']),
    !wellness.length
      ? el('p', { class: 'muted' }, ['Belum ada check-in dari atlet.'])
      : el('ul', { class: 'mod-mini-list' }, wellness.slice(0, 5).map((c) => el('li', {}, [
        el('strong', {}, [c.date ? fmtDate(c.date) : '—']),
        ` · Tidur ${c.sleepQuality ?? '—'}/5 · Kesiapan ${c.readiness ?? '—'}/10`,
        c.painScore != null ? el('div', { class: 'muted' }, [`Nyeri ${c.painScore}/10${c.painLocation ? ' · ' + c.painLocation : ''}`]) : null,
        c.note ? el('div', { class: 'muted' }, [c.note]) : null,
      ]))),
  ]));

  sideEls.push(el('div', { class: 'card mod-chart-card' }, [
    el('h4', {}, [icon('alert-triangle'), ' Keluhan / cedera']),
    !inj.length
      ? el('p', { class: 'muted' }, ['Tidak ada keluhan aktif.'])
      : el('ul', { class: 'mod-mini-list' }, inj.slice(0, 5).map((i) => el('li', {}, [
        el('strong', {}, [i.location || '—']),
        ` · ${i.score != null ? i.score + '/10' : ''} · ${i.status || ''}`,
      ]))),
  ]));

  const historyCard = el('div', { class: 'card' }, [
    el('h3', {}, [icon('clipboard'), ' Riwayat monitoring dari atlet']),
    !mon.length
      ? el('p', { class: 'muted' }, ['Belum ada monitoring dari aplikasi atlet.'])
      : el('div', { class: 'table-wrap mod-history-scroll' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, ['Tanggal', 'RPE', 'Durasi', 'Load', 'Catatan'].map((h) => el('th', {}, [h])))]),
          el('tbody', {}, mon.map((m) => el('tr', {}, [
            el('td', {}, [m.date ? fmtDate(m.date) : '—']),
            el('td', {}, [String(m.rpe ?? '—')]),
            el('td', {}, [m.durationMin != null ? String(m.durationMin) : '—']),
            el('td', {}, [m.rpe != null && m.durationMin != null ? String(m.rpe * m.durationMin) : '—']),
            el('td', {}, [m.note || '—']),
          ]))),
        ]),
      ]),
  ]);

  wrap.appendChild(assembleModPanels(formCard, sideEls, historyCard));
  return wrap;
}


/** Modal override sesi: pilih dari katalog + feedback konfirmasi/peringatan */
async function openSessionOverrideModal(athleteId, session, sessionIndex, context) {
  session = session || {};
  // Jangan pakai nama "opts" — ambil tanggal/week dari argumen ke-4 atau dari objek sesi
  const ctx = (context && typeof context === 'object') ? context : {};
  const weekKeyForSave = ctx.weekKey || session.weekKey || null;
  const dateForSave = ctx.date || session.sessionDate || (typeof state !== 'undefined' ? state.calendarSelectedDate : null) || null;
  const idx = Number(sessionIndex);
  if (!Number.isInteger(idx) || idx < 0) {
    alert('Indeks sesi tidak valid. Muat ulang halaman lalu coba lagi.');
    return;
  }

  let library = { groups: [] };
  try {
    library = await api('GET', `/athletes/${athleteId}/session-library`);
  } catch (err) {
    alert((err.message || 'Gagal memuat katalog') + (err.status ? ' (HTTP ' + err.status + ')' : '')
      + '\n\nPastikan routes/sessionOverrides.js dan lib/sessionLibrary.js sudah di server, lalu restart Node.');
    return;
  }
  if (!library.groups || !library.groups.length) {
    alert('Katalog latihan kosong. Upload lib/sessionLibrary.js ke server.');
    return;
  }

  const overlay = el('div', { class: 'plan-modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const detailBox = el('div', { class: 'override-detail muted' }, ['Pilih jenis latihan untuk melihat gambaran.']);
  const evalBox = el('div', { class: 'override-eval-live' });
  const errBox = el('div', { class: 'error-box', style: 'display:none;margin-top:8px;' });
  let selectedId = (session.override && session.override.libraryId) || 'technique';
  let nameIn, goalIn, rpeIn, durIn, volIn, noteIn, saveBtn;

  function showErr(msg) {
    errBox.style.display = 'block';
    errBox.textContent = msg;
  }
  function clearErr() {
    errBox.style.display = 'none';
    errBox.textContent = '';
  }

  const sel = el('select');
  library.groups.forEach((g) => {
    const og = document.createElement('optgroup');
    og.label = g.group;
    (g.items || []).forEach((it) => {
      const opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = it.label;
      if (it.id === selectedId) opt.selected = true;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
  if (![...sel.options].some((o) => o.value === selectedId) && sel.options.length) {
    selectedId = sel.options[0].value;
    sel.value = selectedId;
  }
  sel.addEventListener('change', () => { selectedId = sel.value; refreshPreview(); });

  async function refreshPreview() {
    try {
      const prev = await api('POST', `/athletes/${athleteId}/session-overrides/evaluate`, {
        libraryId: selectedId,
        targetRPE: rpeIn ? rpeIn.value : undefined,
      });
      const d = prev.defaults || {};
      if (nameIn && !nameIn.dataset.touched) nameIn.value = d.name || '';
      if (goalIn && !goalIn.dataset.touched) goalIn.value = d.goal || '';
      if (rpeIn && !rpeIn.dataset.touched) rpeIn.value = d.targetRPE != null ? String(d.targetRPE) : '';
      if (durIn && !durIn.dataset.touched) durIn.value = d.durationMin != null ? String(d.durationMin) : '';
      if (volIn && !volIn.dataset.touched) volIn.value = d.volume != null ? String(d.volume) : '';
      detailBox.innerHTML = '';
      detailBox.appendChild(el('p', {}, [el('strong', {}, [d.name || selectedId])]));
      if (d.purpose) detailBox.appendChild(el('p', {}, ['Tujuan: ', d.purpose]));
      if (d.intensityNote) detailBox.appendChild(el('p', {}, [d.intensityNote]));
      if (d.phaseHint) detailBox.appendChild(el('p', { class: 'muted' }, [d.phaseHint]));
      const ev = prev.evaluation || {};
      evalBox.className = 'override-eval-live override-eval-' + (ev.level || 'neutral');
      evalBox.innerHTML = '';
      evalBox.appendChild(el('strong', {}, [ev.title || '']));
      (ev.messages || []).forEach((m) => evalBox.appendChild(el('div', {}, [m])));
    } catch (err) {
      evalBox.textContent = err.message || 'Gagal evaluasi';
    }
  }

  nameIn = el('input', { value: session.name || '' });
  nameIn.addEventListener('input', () => { nameIn.dataset.touched = '1'; });
  goalIn = el('textarea', { rows: '2' });
  goalIn.value = session.goal || '';
  goalIn.addEventListener('input', () => { goalIn.dataset.touched = '1'; });
  rpeIn = el('input', {
    type: 'number', min: '0', max: '10', step: '0.5',
    value: session.targetRPE != null ? String(session.targetRPE) : '',
  });
  rpeIn.addEventListener('change', () => { rpeIn.dataset.touched = '1'; refreshPreview(); });
  durIn = el('input', {
    type: 'number', min: '1', max: '300',
    value: session.durationMin != null ? String(session.durationMin) : (session.durMin != null ? String(session.durMin) : ''),
  });
  durIn.addEventListener('input', () => { durIn.dataset.touched = '1'; });
  volIn = el('input', {
    type: 'number', min: '0',
    value: session.volume != null ? String(session.volume) : '',
  });
  volIn.addEventListener('input', () => { volIn.dataset.touched = '1'; });
  noteIn = el('input', { placeholder: 'Catatan pelatih (opsional)', maxlength: '200' });

  saveBtn = el('button', {
    type: 'button',
    onclick: async () => {
      clearErr();
      if (!selectedId) {
        showErr('Pilih jenis latihan dari katalog.');
        return;
      }
      const payload = {
        kind: 'replace',
        sessionIndex: idx,
        sessionKey: session.key || null,
        weekKey: weekKeyForSave || undefined,
        date: dateForSave || undefined,
        libraryId: selectedId,
        name: nameIn.value,
        goal: goalIn.value,
        targetRPE: rpeIn.value,
        durationMin: durIn.value,
        volume: volIn.value,
        note: noteIn.value || undefined,
      };
      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan...';
      try {
        await api('POST', `/athletes/${athleteId}/session-overrides`, payload);
        overlay.remove();
          showToast('Override tersimpan');
        try {
          state.program = await api('GET', `/athletes/${athleteId}/program`);
        } catch (_) { /* ignore */ }
        if (state.athleteTab === 'calendar') {
          try { await loadCalendar(); } catch (_) { /* ignore */ }
        }
        render();
      } catch (err) {
        const extra = err.status ? ` (HTTP ${err.status})` : '';
        showErr((err.message || 'Gagal menyimpan override') + extra);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan override';
      }
    },
  }, ['Simpan override']);

  const card = el('div', { class: 'plan-modal card override-modal' }, [
    el('h3', {}, ['Override sesi']),
    el('p', { class: 'muted' }, [
      'Usulan sistem: ', el('strong', {}, [session.name || '—']),
      session.override ? ' · saat ini sudah manual' : '',
      ' · indeks ', String(idx),
    ]),
    el('label', {}, ['Jenis latihan (katalog standar)']),
    sel,
    detailBox,
    el('label', {}, ['Nama tampilan']),
    nameIn,
    el('label', {}, ['Tujuan / catatan sesi']),
    goalIn,
    el('div', { class: 'field-row' }, [
      el('div', {}, [el('label', {}, ['Target RPE']), rpeIn]),
      el('div', {}, [el('label', {}, ['Durasi (mnt)']), durIn]),
      el('div', {}, [el('label', {}, ['Volume (m)']), volIn]),
    ]),
    el('label', {}, ['Catatan override']),
    noteIn,
    el('div', { style: 'margin:10px 0;' }, [evalBox]),
    errBox,
    saveBtn,
    el('button', {
      type: 'button', class: 'secondary', style: 'margin-top:8px;width:100%;',
      onclick: () => overlay.remove(),
    }, ['Batal']),
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  refreshPreview();
}


function renderSessionLine(s) {
  const lines = [];
  if (s.day) lines.push(el('p', { class: 'muted' }, [s.day]));
  if (s.goal) lines.push(el('p', {}, [s.goal]));

  if (s.mode === 'reps') {
    // Sesi interval Menengah/Jauh — berbasis zona pace VDOT.
    lines.push(el('p', {}, [`Zona ${s.zone} (${s.zoneLabel})`]));
    lines.push(el('p', {}, [`${s.reps} × ${s.repDist}m — target waktu/rep ${s.repTimeLabel} — istirahat ${s.restSec} detik — volume ${s.volume}m`]));
  } else if (s.mode === 'duration') {
    // Sesi durasi Menengah/Jauh (Tempo/Threshold, Lari Panjang).
    lines.push(el('p', {}, [`Zona ${s.zone} (${s.zoneLabel})`]));
    lines.push(el('p', {}, [`${s.durMin} menit @ pace ${s.paceLabel}${s.estDistKm != null ? ` — estimasi jarak ${s.estDistKm} km` : ''}`]));
  } else if (s.mode === 'approach') {
    // Sesi Kecepatan Approach Lompat — berbasis % kecepatan maksimal (sama pola dengan Sprint).
    lines.push(el('p', {}, [`${s.reps} × ${s.dist}m — target waktu ${s.timeLabel} — istirahat ${s.restMin}-${s.restMax} menit — volume ${s.volume}m`]));
  } else if (s.mode === 'teknik') {
    // Sesi Teknik Lompat — reps drill saja, tanpa jarak/kecepatan.
    lines.push(el('p', {}, [`${s.reps} repetisi drill teknik`]));
  } else if (s.mode === 'kekuatan') {
    // Sesi Kekuatan & Pliometrik Lompat — sets × reps/set.
    lines.push(el('p', {}, [`${s.sets} set × ${s.repsPerSet} repetisi`]));
  } else if (s.reps != null) {
    // Sesi interval Sprint — berbasis % kecepatan maksimal.
    lines.push(el('p', {}, [`${s.reps} × ${s.dist}m — target waktu ${s.timeLabel} — istirahat ${s.restMin}-${s.restMax} menit — volume ${s.volume}m`]));
  } else if (s.mode === 'extra' || (s.override && s.override.kind === 'extra')) {
    if (s.durationMin != null) lines.push(el('p', {}, [`Durasi: ${s.durationMin} menit`]));
    if (s.volume != null) lines.push(el('p', {}, [`Volume: ${s.volume} m`]));
  } else if (s.durationMin != null) {
    // Sesi conditioning umum / transisi (dipakai bersama semua kategori).
    lines.push(el('p', {}, [`Durasi: ${s.durationMin} menit`]));
  }

  if (s.targetRPE != null) {
    lines.push(el('p', {}, [
      el('strong', {}, ['Target RPE: ']),
      `${s.targetRPE} (Borg CR10)`,
    ]));
  }

  // Estimasi durasi untuk prefill monitoring (jika tidak ada durationMin eksplisit)
  let estDuration = s.durationMin || s.durMin || null;
  if (estDuration == null && s.reps != null && s.restMax != null) {
    // perkiraan kasar: (rep ~ kerja 20–40 dtk + rest) × reps, dibulatkan ke 5 menit
    const workSec = s.dist ? Math.max(15, Math.min(60, s.dist * 0.15)) : 30;
    const totalSec = s.reps * (workSec + (s.restMax || 3) * 60);
    estDuration = Math.max(20, Math.round(totalSec / 60 / 5) * 5);
  } else if (estDuration == null && s.mode === 'teknik') {
    estDuration = 40;
  } else if (estDuration == null && s.mode === 'kekuatan') {
    estDuration = 45;
  }

  if (s.mode === 'test' || s.source === 'test') {
    const nt = (state.program && state.program.nextTest) || (state.calendar && state.calendar.nextTest);
    lines.push(el('p', {}, [s.goal || (nt && nt.hint) || 'Sesi tes lapangan, bukan sesi latihan volume.']));
    if (nt && nt.note) lines.push(el('p', { class: 'muted' }, [nt.note]));
    const goTest = el('button', {
      type: 'button',
      class: 'pill-btn',
      onclick: () => { state.athleteTab = 'tests'; loadAthleteTab().then(render); },
    }, [icon('clipboard'), ' Buka tab Tes']);
    return el('div', { class: 'session-card session-card-test' }, [
      el('h4', { class: 'session-card-title' }, [
        el('span', { class: 'session-card-icon' }, [icon('clipboard')]),
        el('span', {}, [`Tes — ${s.name || 'Tes lapangan'}`]),
        el('span', { class: `badge ${nt && nt.status === 'overdue' ? 'badge-muted' : 'badge-caution'}`, style: 'margin-left:8px;' }, [nt && nt.statusLabel ? nt.statusLabel : 'Jadwal tes']),
      ]),
      ...lines,
      el('div', { class: 'session-actions' }, [goTest]),
    ]);
  }

  const logBtn = el('button', {
    type: 'button',
    class: 'pill-btn',
    onclick: () => {
      state.monitoringPrefill = {
        rpe: s.targetRPE != null ? s.targetRPE : 7,
        durationMin: estDuration || 50,
        note: `Selesai: ${s.name}${s.day ? ` (${s.day})` : ''}`,
      };
      state.editingLogId = null;
      state.athleteTab = 'monitoring';
      loadAthleteTab().then(render);
    },
  }, [icon('heart'), ' Catat monitoring sesi ini']);

  const idx = s.sessionIndex != null ? s.sessionIndex : 0;
  const overrideBtn = el('button', {
    type: 'button',
    class: 'secondary pill-btn',
    onclick: () => openSessionOverrideModal(state.selectedAthleteId, s, idx, {
      date: s.sessionDate || state.calendarSelectedDate || undefined,
      weekKey: s.weekKey || undefined,
    }),
  }, [icon('pencil'), s.override ? ' Ubah override' : ' Override sesi']);

  const actions = [overrideBtn, logBtn];
  if (s.override && s.override.id) {
    actions.unshift(el('button', {
      type: 'button',
      class: 'link',
      onclick: async () => {
        if (!confirm('Kembalikan sesi ini ke usulan sistem?')) return;
        try {
          await api('DELETE', `/athletes/${state.selectedAthleteId}/session-overrides/${s.override.id}`);
          state.program = await api('GET', `/athletes/${state.selectedAthleteId}/program`);
          if (state.athleteTab === 'calendar') await loadCalendar();
          render();
        } catch (err) { alert(err.message); }
      },
    }, ['Kembalikan ke sistem']));
  }

  const head = el('h4', { class: 'session-card-title' }, [
    el('span', { class: 'session-card-icon' }, [icon(sessionIconName(s))]),
    el('span', {}, [`${s.label || 'Sesi'} — ${s.name}`]),
    s.override && s.override.kind === 'extra'
      ? el('span', { class: 'badge badge-caution', style: 'margin-left:8px;' }, ['Tambahan'])
      : s.override
        ? el('span', { class: 'badge badge-caution', style: 'margin-left:8px;' }, ['Manual'])
        : null,
  ]);
  const evalBox = s.override && s.override.evaluation
    ? el('div', { class: `override-eval override-eval-${s.override.evaluation.level || 'neutral'}` }, [
      el('strong', {}, [s.override.evaluation.title || 'Override']),
      ...(s.override.evaluation.messages || []).map((msg) => el('div', { class: 'muted', style: 'font-size:0.85rem;' }, [msg])),
    ])
    : null;

  return el('div', { class: 'session-card' }, [
    head,
    ...lines,
    evalBox,
    el('div', { class: 'session-actions' }, actions),
  ]);
}

// Bar horizontal start→hari ini→kompetisi, dihitung client-side dari tanggal
// periodisasi atlet — murni visual, tidak menambah data baru dari server.

function renderPeriodizationTimeline(athlete, prog) {
  const start = new Date(athlete.periodization.startDate + 'T00:00:00');
  const comp = new Date(athlete.periodization.compDate + 'T00:00:00');
  const totalDays = (comp - start) / 86400000;
  if (!(totalDays > 0)) return null;
  const today = new Date(todayLocalDate() + 'T00:00:00');
  const elapsedDays = Math.max(0, Math.min(totalDays, (today - start) / 86400000));
  const pct = (elapsedDays / totalDays) * 100;
  const phaseKey = prog.phase && prog.phase.phase;
  const phaseColor = phaseKey ? `var(--${phaseKey})` : 'var(--primary)';
  const steps = [
    { key: 'umum', label: 'Umum' },
    { key: 'khusus', label: 'Khusus' },
    { key: 'puncak', label: 'Puncak' },
    { key: 'transisi', label: 'Transisi' },
  ];
  const idx = Math.max(0, steps.findIndex((s) => s.key === phaseKey));
  return el('div', { class: 'phase-line-wrap' }, [
    el('div', { class: 'phase-line-track' }, [
      el('div', { class: 'phase-line-fill', style: `width:${pct}%;background:${phaseColor};` }),
      el('div', { class: 'phase-line-now', style: `left:${pct}%;background:${phaseColor};`, title: 'Hari ini' }),
      ...steps.map((s, i) => {
        const left = (i / Math.max(1, steps.length - 1)) * 100;
        let cls = 'phase-line-dot';
        if (i < idx) cls += ' is-done';
        if (i === idx) cls += ' is-active';
        return el('div', {
          class: cls,
          style: `left:${left}%;`,
          title: s.label,
        }, [el('span', { class: 'phase-line-dot-label' }, [s.label])]);
      }),
    ]),
    el('div', { class: 'phase-line-dates muted' }, [
      el('span', {}, [icon('calendar'), ' ', fmtDate(athlete.periodization.startDate)]),
      el('span', {}, [icon('flag'), ' ', fmtDate(athlete.periodization.compDate)]),
    ]),
  ]);
}

/** Ringkasan progress — satu baris ringkas + ikon */
function nextTestFromState() {
  return (state.program && state.program.nextTest)
    || (state.calendar && state.calendar.nextTest)
    || null;
}

function nextTestBadgeClass(status) {
  if (status === 'overdue') return 'badge-muted';
  if (status === 'baseline' || status === 'dueSoon') return 'badge-caution';
  return 'badge-ok';
}

function renderNextTestCard(athlete, opts) {
  opts = opts || {};
  const nt = nextTestFromState();
  if (!nt) return null;
  const when = nt.date
    ? `${fmtDate(nt.date)}${nt.dayName ? ' · ' + nt.dayName : ''}`
    : 'Tidak dijadwalkan';
  const sub = nt.lastTestDate
    ? `Terakhir ${fmtDate(nt.lastTestDate)}${nt.lastTestLabel ? ' · ' + nt.lastTestLabel : ''}`
    : 'Belum ada tes tercatat';
  const children = [
    el('div', { class: 'phase-header' }, [
      el('h3', {}, [icon('clipboard'), nt.status === 'overdue' ? ' Tes terlewat' : (opts.title || ' Tes berikutnya')]),
      el('span', { class: `badge ${nextTestBadgeClass(nt.status)}` }, [nt.statusLabel || 'Tes']),
    ]),
    el('p', {}, [el('strong', {}, [when]), ` — ${nt.label}`]),
    el('p', { class: 'muted' }, [nt.note || nt.hint || '']),
    el('p', { class: 'muted', style: 'font-size:0.85rem;' }, [sub + ` · interval fase ${nt.intervalDays || '—'} hari`]),
  ];
  if (opts.showCta !== false) {
    children.push(el('button', {
      type: 'button',
      class: 'secondary',
      style: 'margin-top:8px;',
      onclick: () => { state.athleteTab = 'tests'; loadAthleteTab().then(render); },
    }, [icon('plus'), ' Catat hasil tes']));
  }
  const cardCls = 'card next-test-card' + (nt.status === 'overdue' ? ' next-test-card-overdue' : '');
  return el('div', { class: cardCls }, children);
}

function renderProgressSummaryCard(athlete, prog) {
  const tests = state.tests || [];
  const logs = state.monitoringLogs || [];
  const latestTest = tests.length
    ? [...tests].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)[0]
    : null;
  const acwrInfo = acwrStatusInfo(prog.acwr);
  const today = new Date(todayLocalDate() + 'T00:00:00');
  let logsLast7 = 0;
  logs.forEach((m) => {
    const d = new Date(m.date + 'T00:00:00');
    const diff = (today - d) / 86400000;
    if (diff <= 6 && diff >= 0) logsLast7 += 1;
  });

  const acwrVariant = !acwrInfo || !acwrInfo.eligible ? 'purple'
    : acwrInfo.badgeClass === 'badge-risk' ? 'red'
    : acwrInfo.badgeClass === 'badge-caution' ? 'amber'
    : 'blue';

  return el('div', { class: 'card' }, [
    el('div', { class: 'portal-tiles portal-tiles-stack portal-tiles-2col' }, [
      statTile({
        ic: 'clipboard', variant: 'blue',
        value: latestTest ? fmtDate(latestTest.date) : 'Belum ada',
        label: 'Tes terakhir',
        sub: 'Lihat riwayat tes',
        onclick: () => { state.athleteTab = 'tests'; loadAthleteTab().then(render); },
      }),
      statTile({
        ic: 'activity', variant: 'amber',
        value: String(logsLast7), unit: 'sesi',
        label: 'Monitoring 7 hari',
        sub: 'Lihat riwayat monitor',
        onclick: () => { state.athleteTab = 'monitoring'; loadAthleteTab().then(render); },
      }),
      statTile({
        ic: 'gauge', variant: acwrVariant,
        value: acwrInfo && acwrInfo.eligible && prog.acwr && prog.acwr.acwr != null
          ? Number(prog.acwr.acwr).toFixed(2)
          : (acwrInfo ? acwrInfo.badgeText : '—'),
        label: 'ACWR',
        sub: (acwrInfo && acwrInfo.eligible) ? acwrInfo.badgeText : null,
      }),
      statTile({
        ic: 'layers', variant: 'purple',
        value: (prog.phase && prog.phase.label) || '—',
        label: 'Fase saat ini',
      }),
    ]),
  ]);
}

/** ACWR — hanya garis bergradasi + nilai (satu pola display) */
function renderAcwrGauge(acwr) {
  if (!acwr || !acwr.eligible || acwr.acwr == null) return null;
  const v = Number(acwr.acwr);
  const pct = Math.max(0, Math.min(100, (v / 2) * 100));
  let zone = 'safe';
  let zoneLabel = 'Sweet spot';
  if (v < 0.8) { zone = 'low'; zoneLabel = 'Rendah'; }
  else if (v > 1.5) { zone = 'risk'; zoneLabel = 'Risiko'; }
  else if (v > 1.3) { zone = 'caution'; zoneLabel = 'Waspada'; }

  return el('div', { class: 'acwr-line acwr-line-' + zone }, [
    el('div', { class: 'acwr-line-head' }, [
      icon('gauge'),
      el('strong', {}, ['ACWR ', v.toFixed(2)]),
      el('span', { class: 'badge acwr-zone-badge acwr-zone-' + zone }, [zoneLabel]),
    ]),
    el('div', { class: 'acwr-scale-track' }, [
      el('div', { class: 'acwr-scale-marker', style: `left:${pct}%;` }),
    ]),
    el('div', { class: 'acwr-scale-labels' }, [
      el('span', {}, ['0']),
      el('span', {}, ['0.8']),
      el('span', {}, ['1.3']),
      el('span', {}, ['1.5']),
      el('span', {}, ['2.0']),
    ]),
  ]);
}

function renderPhaseSteps(phaseKey) {
  // Diganti phase-line di timeline — tetap no-op aman jika terpanggil
  return null;
}

function renderRacePredictionCompact(rp) {
  if (!rp) return null;
  const main = rp.label || rp.event || 'Prediksi';
  const time = rp.timeLabel || rp.predictedLabel || rp.value || '—';
  return el('div', { class: 'card' }, [
    statTile({
      ic: 'timer', variant: 'purple',
      value: time,
      label: `Prediksi lomba · ${main}`,
      sub: rp.note || null,
    }),
  ]);
}

function renderPersonalizationCompact(pz, prog) {
  if (!pz) return null;
  const acwrInfo = acwrStatusInfo(prog && prog.acwr);
  return el('div', { class: 'card' }, [
    el('div', { class: 'portal-tiles portal-tiles-stack portal-tiles-3col' }, [
      statTile({
        ic: 'award', variant: 'amber',
        value: pz.level && pz.level.label ? `×${pz.level.multiplier}` : '×1.0',
        label: 'Level',
        sub: (pz.level && (pz.level.benchTier || pz.level.label)) || '—',
      }),
      statTile({
        ic: 'heart', variant: 'red',
        value: `×${pz.risk ? pz.risk.multiplier : 1}`,
        label: 'Risiko',
      }),
      statTile({
        ic: 'bar-chart', variant: 'blue',
        value: `×${Number(pz.multiplier || 1).toFixed(2)}`,
        label: 'Pengali volume',
      }),
    ]),
    el('p', { class: 'muted nutri-stack-desc' }, [
      'Volume latihan mingguan disesuaikan otomatis dari level prestasi atlet dan risiko ACWR — pengali volume adalah hasil gabungan keduanya.',
    ]),
    renderAcwrGauge(prog && prog.acwr),
    acwrInfo && !acwrInfo.eligible
      ? el('p', { class: 'muted', style: 'margin:0.4rem 0 0;font-size:0.8rem;' }, [acwrInfo.advice])
      : null,
  ]);
}




/** Sesi pada tanggal YYYY-MM-DD dari kalender API (atau fallback program minggu) */
function sessionsOnDate(dateStr) {
  const cal = state.calendar;
  if (cal && cal.days && cal.days[dateStr] && Array.isArray(cal.days[dateStr].sessions)) {
    return cal.days[dateStr].sessions;
  }
  return [];
}

function renderScheduleViewSwitcher() {
  const views = [
    ['day', 'Hari'],
    ['week', 'Minggu'],
    ['month', 'Bulan'],
  ];
  return el('div', { class: 'sched-view-switch', role: 'tablist' }, views.map(([k, label]) => el('button', {
    type: 'button',
    class: 'sched-view-btn' + (state.scheduleView === k ? ' active' : ''),
    onclick: async () => {
      state.scheduleView = k;
      state.scheduleViewUserSet = true;
      if (k === 'day' && !state.calendarSelectedDate) state.calendarSelectedDate = todayLocalDate();
      if (k === 'month' || k === 'day') {
        try { await loadCalendar(); } catch (_) {}
      }
      render();
    },
  }, [label])));
}

function renderScheduleTimelineBar(athlete, prog) {
  const per = athlete.periodization || {};
  if (!per.startDate || !per.compDate) return null;
  const start = new Date(per.startDate + 'T00:00:00');
  const comp = new Date(per.compDate + 'T00:00:00');
  const total = (comp - start) / 86400000;
  if (!(total > 0)) return null;
  const today = new Date(todayLocalDate() + 'T00:00:00');
  const elapsed = Math.max(0, Math.min(total, (today - start) / 86400000));
  const pct = (elapsed / total) * 100;
  const phaseKey = prog && prog.phase && prog.phase.phase;
  const phaseLabel = (prog && prog.phase && prog.phase.label) || '—';
  const remain = prog && prog.phase && prog.phase.remainingWeeks != null
    ? `${prog.phase.remainingWeeks} minggu ke kompetisi`
    : '';
  return el('div', { class: 'sched-timeline card' }, [
    el('div', { class: 'sched-timeline-head' }, [
      el('div', {}, [
        el('span', { class: 'sched-timeline-title' }, [icon('flag'), ' Lintasan program']),
        el('span', { class: `badge badge-${phaseKey || 'umum'}` }, [phaseLabel]),
      ]),
      remain ? el('span', { class: 'muted' }, [remain]) : null,
    ]),
    el('div', { class: 'sched-timeline-track' }, [
      el('div', { class: 'sched-timeline-fill', style: `width:${pct}%;` }),
      el('div', { class: 'sched-timeline-marker', style: `left:${pct}%;`, title: 'Hari ini' }),
      el('div', { class: 'sched-timeline-start-dot', title: 'Mulai' }),
      el('div', { class: 'sched-timeline-end-dot', title: 'Kompetisi / puncak' }),
    ]),
    el('div', { class: 'sched-timeline-labels' }, [
      el('span', {}, [fmtDate(per.startDate), ' · mulai']),
      el('span', {}, [fmtDate(per.compDate), ' · kompetisi']),
    ]),
  ]);
}

function renderProgramTab(athlete) {
  const prog = state.program;
  if (!prog) return el('div', { class: 'card' }, ['Memuat...']);
  if (!prog.phase.phase) {
    return el('div', { class: 'card empty-state' }, [emptyIllustration('clipboard'), prog.note]);
  }

  const wrap = el('div', { class: 'program-fit tile-jadwal' });
  const fitLeft = el('div', { class: 'program-fit-left' });
  const fitRight = el('div', { class: 'program-fit-right' });
  fitLeft.appendChild(el('div', { class: 'export-word-row' }, [
    el('button', {
      class: 'secondary',
      onclick: () => { window.location.href = `/api/athletes/${athlete.id}/export/word`; },
    }, [icon('download'), 'Unduh Laporan Lengkap (Word)']),
  ]));
  const phaseCard = el('div', { class: 'card program-phase-card' }, [
    el('div', { class: 'phase-header' }, [
      el('h3', {}, [icon('layers'), ' Fase Periodisasi Saat Ini']),
      el('span', { class: `badge badge-large badge-${prog.phase.phase}` }, [prog.phase.label]),
    ]),
        prog.phase.remainingWeeks != null
      ? el('p', { class: 'muted' }, [`Sisa waktu ke kompetisi: ${prog.phase.remainingWeeks} minggu.`])
      : null,
    prog.phase.note ? el('p', { class: 'muted' }, [prog.phase.note]) : null,
    prog.weekPlan
      ? el('p', {}, [`Kurva mingguan: `, el('strong', {}, [prog.weekPlan.label]), ` (set ${prog.weekPlan.curveSet}, faktor volume ×${prog.weekPlan.factor})`])
      : null,
    renderPeriodizationTimeline(athlete, prog),
  ]);
  fitLeft.appendChild(phaseCard);
  const tl = renderScheduleTimelineBar(athlete, prog);
  if (tl) fitLeft.appendChild(tl);

  // Ringkasan progress singkat (tes + monitoring)
  fitLeft.appendChild(renderProgressSummaryCard(athlete, prog));
  const nextTestCard = renderNextTestCard(athlete, { title: ' Tes berikutnya' });
  if (nextTestCard) fitLeft.appendChild(nextTestCard);

  if (prog.racePrediction) {
    fitLeft.appendChild(renderRacePredictionCompact(prog.racePrediction));
  }

  if (prog.personalization) {
    fitLeft.appendChild(renderPersonalizationCompact(prog.personalization, prog));
  }

  if (prog.warning) {
    // Warning biasanya karena data tes belum lengkap (time trial / best100m)
    fitLeft.appendChild(el('div', { class: 'callout callout-warning' }, [
      el('h4', {}, [icon('clipboard'), ' Data tes masih kurang']),
      el('p', {}, [prog.warning]),
      el('p', { class: 'muted' }, ['Tanpa data baseline, sistem tidak bisa menghitung pace/target yang akurat.']),
      el('button', {
        class: 'secondary',
        onclick: () => { state.athleteTab = 'tests'; loadAthleteTab().then(render); },
      }, [icon('plus'), ' Lengkapi Tes Sekarang']),
    ]));
  }

  
  // —— Jadwal: Hari | Minggu | Bulan (mengganti tab Kalender terpisah) ——
  const schedHead = el('div', { class: 'card sched-head-card' }, [
    el('div', { class: 'sched-head-row' }, [
      el('h3', { class: 'program-sessions-title', style: 'margin:0;' }, [icon('calendar'), ' Jadwal latihan']),
      renderScheduleViewSwitcher(),
    ]),
  ]);
  fitRight.appendChild(schedHead);

  if (state.scheduleView === 'month') {
    fitRight.appendChild(renderScheduleMonthPanel(athlete));
  } else if (state.scheduleView === 'day') {
    fitRight.appendChild(renderScheduleDayPanel(athlete, prog));
  } else {
    // week (default) — sesi minggu ini

  if (prog.sessions && prog.sessions.length) {
    const sessionsCard = el('div', { class: 'card program-sessions-card' });
    sessionsCard.appendChild(el('h3', { class: 'program-sessions-title' }, ['Sesi minggu ini']));
    // Gabungkan extraSessions dari API jika belum ada di sessions (kompatibilitas)
    let sessions = Array.isArray(prog.sessions) ? prog.sessions.slice() : [];
    if (Array.isArray(prog.extraSessions) && prog.extraSessions.length) {
      const keys = new Set(sessions.map((s) => s.key).filter(Boolean));
      prog.extraSessions.forEach((ex) => {
        if (ex.key && keys.has(ex.key)) return;
        sessions.push(ex);
        if (ex.key) keys.add(ex.key);
      });
    }
    const nExtra = sessions.filter((s) => s.source === 'extra' || (s.override && s.override.kind === 'extra')).length;
    sessionsCard.appendChild(el('p', { class: 'muted' }, [
      'Setelah selesai latihan, tekan “Catat monitoring sesi ini” agar RPE & durasi langsung terisi sesuai target.',
      nExtra > 0 ? ` · ${nExtra} sesi tambahan manual minggu ini.` : '',
    ]));
    if (nExtra === 0 && prog.extrasDebug && prog.extrasDebug.totalActiveExtras > 0) {
      sessionsCard.appendChild(el('div', { class: 'callout callout-warning', style: 'margin-bottom:12px;' }, [
        el('p', {}, [
          `Ada ${prog.extrasDebug.totalActiveExtras} sesi tambahan tersimpan, tetapi tidak di rentang minggu ini (${prog.extrasDebug.weekRange || '—'}). `,
          'Buka tab Kalender pada tanggal sesi tersebut, atau tambah sesi di tanggal minggu berjalan.',
        ]),
      ]));
    }
    sessions.forEach((s) => sessionsCard.appendChild(renderSessionLine(s)));
    // Tombol cepat: tambah sesi hari ini tanpa lewat kalender
    sessionsCard.appendChild(el('button', {
      type: 'button',
      class: 'secondary',
      style: 'margin-top:12px;width:100%;',
      onclick: () => {
        const today = (typeof todayLocalDate === 'function') ? todayLocalDate() : new Date().toISOString().slice(0, 10);
        openExtraSessionModal(athlete.id, today);
      },
    }, ['+ Tambah sesi di hari ini']));
    fitRight.appendChild(sessionsCard);
  } else if (prog.sessions) {
    /* empty sessions week */
    // sessions array kosong — biasanya karena warning (tes belum ada)
    const protocol = (state.categories && state.categories[athlete.profile.kategori])
      ? state.categories[athlete.profile.kategori].testProtocol
      : null;
    let tip = 'Belum ada sesi untuk ditampilkan.';
    if (protocol === 'time_trial') {
      tip = 'Sesi menengah/jauh membutuhkan time trial valid agar VDOT & pace bisa dihitung.';
    } else if (protocol === 'sprint' || athlete.profile.kategori === 'sprint') {
      tip = 'Sesi sprint membutuhkan catatan waktu 100m di profil atau hasil tes.';
    } else if (protocol === 'jump' || athlete.profile.kategori === 'lompat') {
      tip = 'Sesi lompat membutuhkan catatan waktu 100m (untuk kecepatan approach).';
    }
    fitRight.appendChild(el('div', { class: 'card empty-state' }, [
      emptyIllustration('activity'),
      el('p', {}, [tip]),
      el('button', {
        class: 'secondary',
        style: 'margin-top:12px;',
        onclick: () => { state.athleteTab = 'tests'; loadAthleteTab().then(render); },
      }, [icon('clipboard'), ' Buka tab Tes']),
    ]));
  }

  } /* end schedule week else */

  if (prog.strengthBank && prog.strengthBank.length) {
    fitRight.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, [icon('dumbbell'), ' Bank Gerakan Kekuatan']),
      el('div', { class: 'pill-list' }, prog.strengthBank.map((s) => el('span', { class: 'pill' }, [s]))),
    ]));
  }

  if (prog.techniqueChecklist && prog.techniqueChecklist.length) {
    fitRight.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, [icon('check-circle'), ' Checklist Teknik']),
      el('ul', {}, prog.techniqueChecklist.map((t) => el('li', {}, [t]))),
    ]));
  }

  wrap.appendChild(fitLeft);
  wrap.appendChild(fitRight);
  return wrap;
}

// ---------- Calendar tab ----------
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function calendarDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Sesi tambahan di kalender (di luar jadwal generate) — beban masuk ACWR lewat monitoring */
async function openExtraSessionModal(athleteId, dateStr) {
  let library = { groups: [] };
  try {
    library = await api('GET', `/athletes/${athleteId}/session-library`);
  } catch (err) {
    alert(err.message || 'Gagal memuat katalog');
    return;
  }
  const overlay = el('div', { class: 'plan-modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const detailBox = el('div', { class: 'override-detail muted' }, ['Pilih jenis latihan.']);
  const evalBox = el('div', { class: 'override-eval-live' });
  let selectedId = 'technique';
  let nameIn, goalIn, rpeIn, durIn, volIn, noteIn;

  const sel = el('select');
  library.groups.forEach((g) => {
    const og = document.createElement('optgroup');
    og.label = g.group;
    g.items.forEach((it) => {
      const opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = it.label;
      if (it.id === selectedId) opt.selected = true;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
  sel.addEventListener('change', () => { selectedId = sel.value; refreshPreview(); });

  async function refreshPreview() {
    try {
      const prev = await api('POST', `/athletes/${athleteId}/session-overrides/evaluate`, {
        libraryId: selectedId,
        targetRPE: rpeIn ? rpeIn.value : undefined,
      });
      const d = prev.defaults || {};
      if (nameIn && !nameIn.dataset.touched) nameIn.value = (d.name || selectedId) + ' (tambahan)';
      if (goalIn && !goalIn.dataset.touched) goalIn.value = d.goal || '';
      if (rpeIn && !rpeIn.dataset.touched) rpeIn.value = d.targetRPE != null ? d.targetRPE : '';
      if (durIn && !durIn.dataset.touched) durIn.value = d.durationMin != null ? d.durationMin : '';
      if (volIn && !volIn.dataset.touched) volIn.value = d.volume != null ? d.volume : '';
      detailBox.innerHTML = '';
      detailBox.appendChild(el('p', {}, [el('strong', {}, [d.name || selectedId])]));
      if (d.purpose) detailBox.appendChild(el('p', {}, ['Tujuan: ', d.purpose]));
      if (d.intensityNote) detailBox.appendChild(el('p', {}, [d.intensityNote]));
      const ev = prev.evaluation || {};
      evalBox.className = 'override-eval-live override-eval-' + (ev.level || 'neutral');
      evalBox.innerHTML = '';
      evalBox.appendChild(el('strong', {}, [ev.title || '']));
      (ev.messages || []).forEach((m) => evalBox.appendChild(el('div', {}, [m])));
    } catch (err) {
      evalBox.textContent = err.message || 'Gagal evaluasi';
    }
  }

  nameIn = el('input', {});
  nameIn.addEventListener('input', () => { nameIn.dataset.touched = '1'; });
  goalIn = el('textarea', { rows: '2' });
  goalIn.addEventListener('input', () => { goalIn.dataset.touched = '1'; });
  rpeIn = el('input', { type: 'number', min: '0', max: '10', step: '0.5' });
  rpeIn.addEventListener('change', () => { rpeIn.dataset.touched = '1'; refreshPreview(); });
  durIn = el('input', { type: 'number', min: '1', max: '300' });
  durIn.addEventListener('input', () => { durIn.dataset.touched = '1'; });
  volIn = el('input', { type: 'number', min: '0' });
  volIn.addEventListener('input', () => { volIn.dataset.touched = '1'; });
  noteIn = el('input', { placeholder: 'Catatan (opsional)', maxlength: '200' });

  const card = el('div', { class: 'plan-modal card override-modal' }, [
    el('h3', {}, ['Sesi tambahan']),
    el('p', { class: 'muted' }, [
      'Tanggal: ', el('strong', {}, [fmtDate(dateStr)]),
      ' · Di luar jadwal generate. Setelah latihan, catat monitoring agar beban masuk ACWR.',
    ]),
    el('label', {}, ['Jenis latihan']),
    sel,
    detailBox,
    el('label', {}, ['Nama']),
    nameIn,
    el('label', {}, ['Tujuan']),
    goalIn,
    el('div', { class: 'field-row' }, [
      el('div', {}, [el('label', {}, ['Target RPE']), rpeIn]),
      el('div', {}, [el('label', {}, ['Durasi (mnt)']), durIn]),
      el('div', {}, [el('label', {}, ['Volume (m)']), volIn]),
    ]),
    el('label', {}, ['Catatan']),
    noteIn,
    el('div', { style: 'margin:10px 0;' }, [evalBox]),
    el('button', {
      type: 'button',
      onclick: async () => {
        try {
          await api('POST', `/athletes/${athleteId}/session-overrides`, {
            kind: 'extra',
            date: dateStr,
            libraryId: selectedId,
            name: nameIn.value,
            goal: goalIn.value,
            targetRPE: rpeIn.value,
            durationMin: durIn.value,
            volume: volIn.value,
            note: noteIn.value || undefined,
          });
          overlay.remove();
          showToast('Sesi tambahan tersimpan');
          await loadCalendar();
          try {
            const program = await api('GET', `/athletes/${athleteId}/program`);
            state.program = mergeExtrasFromCalendar(program, state.calendar);
          } catch (_) { /* ignore */ }
          render();
        } catch (err) {
          alert(err.message || 'Gagal menyimpan');
        }
      },
    }, ['Simpan sesi tambahan']),
    el('button', {
      type: 'button', class: 'secondary', style: 'margin-top:8px;width:100%;',
      onclick: () => overlay.remove(),
    }, ['Batal']),
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  refreshPreview();
}


function renderScheduleDayPanel(athlete, prog) {
  const dateStr = state.calendarSelectedDate || todayLocalDate();
  const wrap = el('div', { class: 'card program-sessions-card' });
  wrap.appendChild(el('div', { class: 'sched-day-nav' }, [
    el('button', {
      type: 'button', class: 'secondary pill-btn',
      onclick: () => {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        state.calendarSelectedDate = dateKeyFromDate(d);
        render();
      },
    }, [icon('chevron-left')]),
    el('strong', {}, [fmtDate(dateStr)]),
    el('button', {
      type: 'button', class: 'secondary pill-btn',
      onclick: () => {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        state.calendarSelectedDate = dateKeyFromDate(d);
        render();
      },
    }, [icon('chevron-right')]),
    el('button', {
      type: 'button', class: 'secondary pill-btn',
      onclick: () => { state.calendarSelectedDate = todayLocalDate(); render(); },
    }, ['Hari ini']),
  ]));
  const sessions = sessionsOnDate(dateStr);
  if (!sessions.length) {
    wrap.appendChild(el('p', { class: 'muted' }, ['Tidak ada sesi pada tanggal ini.']));
  } else {
    sessions.forEach((s) => wrap.appendChild(renderSessionLine(s)));
  }
  wrap.appendChild(el('button', {
    type: 'button', class: 'secondary', style: 'margin-top:10px;width:100%;',
    onclick: () => openExtraSessionModal(athlete.id, dateStr),
  }, [icon('plus'), ' Tambah sesi hari ini']));
  return wrap;
}

function dateKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function renderScheduleMonthPanel(athlete) {
  // Reuse calendar tab UI inside jadwal
  const panel = el('div', { class: 'sched-month-panel' });
  panel.appendChild(renderCalendarTab(athlete));
  return panel;
}

function renderCalendarTab(athlete) {
  const cal = state.calendar;
  if (!cal) return el('div', { class: 'card' }, ['Memuat...']);

  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'row' }, [
    el('h3', {}, [`${MONTH_NAMES[cal.month - 1]} ${cal.year}`]),
    el('div', { class: 'row-actions' }, [
      el('button', { class: 'secondary', onclick: () => navigateCalendar(-1) }, [icon('chevron-left'), 'Bulan Sebelumnya']),
      el('button', { class: 'secondary', onclick: () => navigateCalendar(1) }, ['Bulan Berikutnya', icon('chevron-right')]),
    ]),
  ]));

  if (cal.note) {
    wrap.appendChild(el('div', { class: 'card empty-state' }, [emptyIllustration('calendar'), cal.note]));
    return wrap;
  }

  const daysInMonthCount = new Date(cal.year, cal.month, 0).getDate();
  const firstWeekdayJS = new Date(cal.year, cal.month - 1, 1).getDay(); // 0=Minggu..6=Sabtu
  const leadingBlanks = firstWeekdayJS === 0 ? 6 : firstWeekdayJS - 1; // geser ke basis Senin

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonthCount; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const headerRow = el('div', { class: 'calendar-grid calendar-header' },
    ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((h) => el('div', { class: 'calendar-head-cell' }, [h])));

  const per = athlete.periodization || {};
  const startDateStr = per.startDate || null;
  const compDateStr = per.compDate || null;
  const todayStr = todayLocalDate();

  const gridCells = cells.map((d) => {
    if (d == null) return el('div', { class: 'calendar-cell calendar-cell-empty' });
    const dateStr = calendarDateKey(cal.year, cal.month, d);
    const dayData = cal.days[dateStr];
    const isSelected = state.calendarSelectedDate === dateStr;
    const isToday = dateStr === todayStr;
    const isStart = startDateStr && dateStr === startDateStr;
    const isComp = compDateStr && dateStr === compDateStr;
    const hasExtra = dayData && dayData.sessions.some((s) => s.source === 'extra');
    const hasTest = dayData && dayData.sessions.some((s) => s.source === 'test' || s.mode === 'test');
    let cls = 'calendar-cell';
    if (dayData) cls += ' calendar-cell-has-session';
    if (hasExtra) cls += ' calendar-cell-has-extra';
    if (hasTest) cls += ' calendar-cell-has-test';
    if (isSelected) cls += ' calendar-cell-selected';
    if (isToday) cls += ' calendar-cell-today';
    if (isStart) cls += ' calendar-cell-start';
    if (isComp) cls += ' calendar-cell-comp';
    const markers = [];
    if (isToday) markers.push(el('span', { class: 'cal-marker cal-marker-today', title: 'Hari ini' }, ['Hari ini']));
    if (isStart) markers.push(el('span', { class: 'cal-marker cal-marker-start', title: 'Mulai program' }, ['Mulai']));
    if (isComp) markers.push(el('span', { class: 'cal-marker cal-marker-comp', title: 'Kompetisi / puncak' }, ['Kompetisi']));
    return el('div', {
      class: cls,
      onclick: () => { state.calendarSelectedDate = isSelected ? null : dateStr; render(); },
    }, [
      el('div', { class: 'calendar-cell-date' }, [String(d)]),
      markers.length ? el('div', { class: 'calendar-cell-markers' }, markers) : null,
      dayData
        ? el('div', { class: 'calendar-cell-badges' }, dayData.sessions.map((s) => el('span', {
          class: `pill pill-sm ${s.source === 'extra' ? 'pill-extra' : (s.source === 'test' || s.mode === 'test') ? 'pill-test' : 'badge-cat-' + athlete.profile.kategori}`,
        }, [s.source === 'extra' ? ('+ ' + (s.label || s.name)) : (s.source === 'test' || s.mode === 'test') ? ('Tes · ' + (s.name || '')) : s.name])))
        : null,
    ]);
  });

  wrap.appendChild(el('div', { class: 'card calendar-wrap calendar-fit' }, [headerRow, el('div', { class: 'calendar-grid' }, gridCells)]));
  wrap.appendChild(el('div', { class: 'calendar-legend' }, [
    el('span', { class: 'cal-legend-item' }, [el('span', { class: 'cal-marker cal-marker-today' }, ['Hari ini']), ' Hari ini']),
    el('span', { class: 'cal-legend-item' }, [el('span', { class: 'cal-marker cal-marker-start' }, ['Mulai']), ' Mulai program']),
    el('span', { class: 'cal-legend-item' }, [el('span', { class: 'cal-marker cal-marker-comp' }, ['Kompetisi']), ' Kompetisi / puncak']),
    el('span', { class: 'cal-legend-item' }, [el('span', { class: 'pill pill-sm pill-test' }, ['Tes']), ' Jadwal tes']),
  ]));
  wrap.appendChild(el('p', { class: 'muted', style: 'font-size:0.85rem;' }, [
    'Klik tanggal untuk melihat sesi atau menambah sesi di luar jadwal generate. Beban sesi tambahan masuk ACWR setelah dicatat di Monitoring (RPE × durasi).',
  ]));

  if (state.calendarSelectedDate) {
    const selectedDay = cal.days[state.calendarSelectedDate];
    const detailChildren = [
      el('h3', {}, [`Detail ${fmtDate(state.calendarSelectedDate)}`]),
    ];
    if (selectedDay && selectedDay.phaseLabel) {
      detailChildren.push(el('p', { class: 'muted' }, [`Fase: ${selectedDay.phaseLabel}${selectedDay.weekLabel ? ' · Kurva: ' + selectedDay.weekLabel : ''}`]));
    } else {
      detailChildren.push(el('p', { class: 'muted' }, ['Tidak ada sesi generate sistem pada tanggal ini — Anda bisa menambah sesi manual.']));
    }
    if (selectedDay && selectedDay.sessions && selectedDay.sessions.length) {
      selectedDay.sessions.forEach((s) => detailChildren.push(renderSessionLine(s)));
    }
    detailChildren.push(el('button', {
      type: 'button',
      class: 'secondary',
      style: 'margin-top:12px;width:100%;',
      onclick: () => openExtraSessionModal(athlete.id, state.calendarSelectedDate),
    }, [icon('plus'), ' Tambah sesi di tanggal ini']));
    wrap.appendChild(el('div', { class: 'card' }, detailChildren));
  }

  return wrap;
}

// ---------- Tests tab ----------
function avgTechniqueScore(techniqueScores) {
  if (!techniqueScores || !techniqueScores.length) return null;
  const scored = techniqueScores.filter((s) => s.score != null);
  if (!scored.length) return null;
  return scored.reduce((sum, s) => sum + s.score, 0) / scored.length;
}

function fmtClockDisplay(sec) {
  if (sec == null) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function testProtocolFor(kategori) {
  const cat = state.categories && state.categories[kategori];
  return cat ? cat.testProtocol : 'sprint';
}


/**
 * Kartu stat kecil ikon+angka — gaya yang sama dipakai di tile HQ (Markas,
 * lihat renderCoachPortal) dan tab Nutrisi. Satu helper dipakai lintas tab
 * (Jadwal/Tes/Monitor/Feed/Nutrisi) supaya angka ringkasan selalu tampil
 * konsisten (ikon berwarna + angka besar + label + keterangan singkat
 * opsional) — jangan bikin ulang markup ini di tempat lain (UI-CONVENTIONS
 * §3). `sub` opsional untuk satu baris keterangan kecil di bawah label
 * (mis. status/interpretasi angka).
 */
function statTile(it) {
  it = it || {};
  return el('div', {
    class: 'portal-tile' + (it.variant ? ' portal-tile-' + it.variant : '') + (it.big ? ' nutri-tile-big' : '') + (it.onclick ? ' portal-tile-clickable' : ''),
    onclick: it.onclick || undefined,
  }, [
    el('span', { class: 'portal-tile-icon' }, [icon(it.ic || 'bar-chart')]),
    el('div', {}, [
      el('div', { class: 'portal-tile-value' }, [
        String(it.value != null && it.value !== '' ? it.value : '—'),
        it.unit ? ' ' : null,
        it.unit ? el('span', { class: 'muted', style: 'font-size:0.55em;font-weight:700;text-transform:none;letter-spacing:0;' }, [it.unit]) : null,
      ]),
      el('div', { class: 'portal-tile-label' }, [it.label]),
      it.sub ? el('div', { class: 'portal-tile-sub muted' }, [it.sub]) : null,
    ]),
  ]);
}

/** Layout 2/3 panel: form kiri | chart kanan (atas-bawah) | riwayat full-width scroll */
function assembleModPanels(formEl, sideEls, historyEl) {
  const formNode = formEl || el('div', { class: 'card' }, [
    el('p', { class: 'error-box' }, ['Form input tidak tersedia. Muat ulang halaman.']),
  ]);
  const charts = (sideEls || []).filter(Boolean);
  // Tandai kartu yang benar-benar berisi grafik (punya .chart-scroll di
  // dalamnya) dengan class .mod-chart-graph — dipakai CSS untuk menyusun
  // ulang kolom kanan (ringkasan di kiri, grafik ditumpuk di kanan) tanpa
  // perlu :has() bersarang (":has(a:has(b))"), yang tidak didukung semua
  // versi browser.
  charts.forEach((elm) => {
    if (elm && elm.querySelector && elm.querySelector('.chart-scroll')) {
      elm.classList.add('mod-chart-graph');
    }
  });
  const side = el('div', { class: 'mod-panel-side' },
    charts.length
      ? charts
      : [el('div', { class: 'card muted' }, [el('p', {}, ['Belum cukup data untuk grafik.'])])]
  );
  const hasSummary = charts[0] && !charts[0].classList.contains('mod-chart-graph');
  const graphCount = charts.filter((c) => c.classList && c.classList.contains('mod-chart-graph')).length;
  if (hasSummary && graphCount >= 1) side.classList.add('mod-side-test-split');
  return el('div', { class: 'mod-panels tile-layout' }, [
    el('div', { class: 'mod-panels-top' }, [
      el('div', { class: 'mod-panel-form' }, [formNode]),
      side,
    ]),
    el('div', { class: 'mod-panel-history' }, [historyEl || el('div')]),
  ]);
}

function renderTestsTab(athlete) {
  const protocol = testProtocolFor(athlete.profile.kategori);
  if (protocol === 'time_trial') return renderTimeTrialTestsTab(athlete);
  if (protocol === 'jump') return renderJumpTestsTab(athlete);
  return renderSprintTestsTab(athlete);
}

function renderSprintTestsTab(athlete) {
  const wrap = el('div');
  if (!Array.isArray(state.tests)) state.tests = [];
  const editingTest = state.editingTestId != null ? state.tests.find((t) => t.id === state.editingTestId) : null;

  const rastInputs = [0, 1, 2, 3, 4, 5].map((i) => el('input', { type: 'number', step: '0.01', placeholder: 'detik', value: editingTest ? (editingTest.rastTimes[i] ?? '') : '' }));
  const label = el('input', { placeholder: 'cth. Baseline, Evaluasi 1', value: editingTest ? editingTest.label || '' : '' });
  const date = el('input', { type: 'date', required: 'true', value: editingTest ? editingTest.date : todayLocalDate() });
  const vo2 = el('input', { type: 'number', step: '0.1', placeholder: 'ml/kg/menit', value: editingTest ? (editingTest.vo2max ?? '') : '' });
  const hrPeak = el('input', { type: 'number', placeholder: 'bpm', value: editingTest ? (editingTest.hrPeak ?? '') : '' });
  const hr5 = el('input', { type: 'number', placeholder: 'bpm', value: editingTest ? (editingTest.hr5 ?? '') : '' });

  const checklist = state.techniqueChecklist;
  const likertScale = (checklist && checklist.likertScale) || [];
  const checklistItems = (checklist && checklist.items) || [];
  const existingScores = editingTest ? editingTest.techniqueScores : null;
  const techniqueSelects = checklistItems.map((item, i) => {
    const existingScore = existingScores && existingScores[i] ? existingScores[i].score : null;
    return el('select', {}, [
      el('option', { value: '' }, ['Belum dinilai']),
      ...likertScale.map((l) => el('option', { value: String(l.value), selected: existingScore === l.value ? 'true' : undefined }, [`${l.value} — ${l.label}`])),
    ]);
  });

  const form = el('form', {
    autocomplete: 'off',
    onsubmit: async (e) => {
      e.preventDefault();
      state.error = null;
      try {
        const body = {
          label: label.value, date: date.value, vo2max: vo2.value,
          rastTimes: rastInputs.map((i) => i.value), hrPeak: hrPeak.value, hr5: hr5.value,
          techniqueScores: techniqueSelects.map((s) => s.value),
        };
        if (editingTest) {
          await api('PUT', `/athletes/${athlete.id}/tests/${editingTest.id}`, body);
          state.editingTestId = null;
        } else {
          await api('POST', `/athletes/${athlete.id}/tests`, body);
        }
        state.tests = await api('GET', `/athletes/${athlete.id}/tests`);
      } catch (err) {
        state.error = err.message;
      }
      render();
    },
  }, [
    el('div', { class: 'field-row' }, [
      el('div', {}, [el('label', {}, ['Label']), label]),
      el('div', {}, [el('label', {}, ['Tanggal']), date]),
      el('div', {}, [el('label', {}, ['VO2 Maks (MFT)']), vo2]),
    ]),
    el('div', { class: 'field-row' }, [
      el('div', {}, [el('label', {}, ['HR Puncak']), hrPeak]),
      el('div', {}, [el('label', {}, ['HR Menit ke-5']), hr5]),
    ]),
    el('label', {}, ['6× Waktu RAST (35m, detik)']),
    el('div', { class: 'field-row' }, rastInputs),
    checklistItems.length
      ? el('div', {}, [
        el('label', {}, ['Checklist Teknik (kualitatif, skala Likert 1-5)']),
        el('div', {}, checklistItems.map((item, i) => el('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:6px;' }, [
          el('span', { style: 'flex:1;font-size:0.9rem;' }, [item]),
          el('div', { style: 'width:180px;flex-shrink:0;' }, [techniqueSelects[i]]),
        ]))),
      ])
      : null,
    el('div', { class: 'row-actions' }, [
      el('button', { type: 'submit' }, [editingTest ? 'Simpan Perubahan' : 'Simpan Tes']),
      editingTest ? el('button', { type: 'button', class: 'secondary', onclick: () => { state.editingTestId = null; render(); } }, ['Batal Ubah']) : null,
    ]),
  ]);

  const formCard = el('div', { class: 'card' }, [
    el('h3', {}, [icon('clipboard'), editingTest ? ' Ubah Hasil Tes' : ' Catat Hasil Tes Baru']),
    state.error ? el('div', { class: 'error-box' }, [state.error]) : null,
    form,
  ]);

  const sideEls = [];
  if (state.tests.length) {
    const latest = [...state.tests].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)[0];
    const rast = latest.rast;
    const avg = avgTechniqueScore(latest.techniqueScores);
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('gauge'), ' Tes terakhir']),
      el('p', { class: 'muted', style: 'font-size:0.8rem;' }, [`${latest.label || 'Tanpa label'} · ${fmtDate(latest.date)}`]),
      el('div', { class: 'portal-tiles portal-tiles-stack portal-tiles-2col' }, [
        statTile({
          ic: 'wind', variant: 'blue',
          value: latest.vo2max != null ? latest.vo2max : '—', unit: 'ml/kg/mnt',
          label: 'VO2 Maks', sub: 'Daya tahan aerobik',
        }),
        statTile({
          ic: 'zap', variant: 'amber',
          value: rast ? rast.relPower.toFixed(1) : '—', unit: 'W/kg',
          label: 'RAST Power', sub: (rast && rast.relPowerTier) || 'Power anaerobik',
        }),
        statTile({
          ic: 'activity', variant: 'red',
          value: rast ? rast.fatigueIndex.toFixed(1) : '—', unit: 'W/s',
          label: 'Fatigue Index', sub: 'Makin rendah makin baik',
        }),
        statTile({
          ic: 'heart', variant: 'purple',
          value: latest.hrr5 != null ? latest.hrr5 : '—', unit: 'bpm',
          label: 'Pemulihan (HRR5)', sub: avg != null ? `Teknik rata² ${avg.toFixed(1)}/5` : 'Checklist belum dinilai',
        }),
      ]),
    ]));
  }
  if (state.tests.length >= 2) {
    const chrono = [...state.tests].reverse();
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('trending-up'), ' Progres RAST Power']),
      buildLineChart({
        points: chrono.map((t) => ({ x: t.date, y: t.rast ? t.rast.relPower : null })),
        valueFormat: (v) => `${v.toFixed(1)} W/kg`,
      }),
    ]));
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('trending-up'), ' Progres Fatigue Index']),
      el('p', { class: 'muted' }, ['Makin rendah makin baik.']),
      buildLineChart({
        points: chrono.map((t) => ({ x: t.date, y: t.rast ? t.rast.fatigueIndex : null })),
        valueFormat: (v) => `${v.toFixed(1)} W/s`,
      }),
    ]));
  }

  const historyCard = el('div', { class: 'card' });
  historyCard.appendChild(el('h3', {}, [icon('clipboard'), ' Riwayat Tes']));
  if (!state.tests.length) {
    historyCard.appendChild(el('p', { class: 'muted' }, ['Belum ada tes tercatat.']));
  } else {
    const table = el('table', {}, [
      el('thead', {}, [el('tr', {}, ['Tanggal', 'Label', 'VO2', 'RAST (6x)', 'RAST Power', 'Fatigue Index', 'HR Puncak/5m (HRR5)', 'Checklist Teknik', ''].map((h) => el('th', {}, [h])))]),
    ]);
    const tbody = el('tbody');
    state.tests.forEach((t) => {
      const avg = avgTechniqueScore(t.techniqueScores);
      const rast = t.rast;
      tbody.appendChild(el('tr', {}, [
        el('td', {}, [fmtDate(t.date)]),
        el('td', {}, [t.label || '-']),
        el('td', {}, [t.vo2max != null ? String(t.vo2max) : '-']),
        el('td', {}, [(Array.isArray(t.rastTimes) ? t.rastTimes.filter((x) => x != null).join(', ') : '') || '-']),
        el('td', {}, [rast ? `${rast.relPower.toFixed(1)} W/kg${rast.relPowerTier ? ` (${rast.relPowerTier})` : ''}` : '-']),
        el('td', {}, [rast ? `${rast.fatigueIndex.toFixed(1)} W/s${rast.fatigueTier ? ` (${rast.fatigueTier})` : ''}` : '-']),
        el('td', {}, [`${t.hrPeak ?? '-'} / ${t.hr5 ?? '-'}${t.hrr5 != null ? ` (${t.hrr5})` : ''}`]),
        el('td', {}, [avg != null ? `Rata² ${avg.toFixed(1)}/5` : '-']),
        el('td', { class: 'row-actions' }, [
          el('button', { class: 'link', onclick: () => { state.editingTestId = t.id; state.error = null; render(); } }, [icon('pencil'), 'Ubah']),
          el('button', {
            class: 'link', style: 'color:var(--danger);', onclick: async () => {
              if (!confirm('Hapus entri tes ini?')) return;
              await api('DELETE', `/athletes/${athlete.id}/tests/${t.id}`);
              if (state.editingTestId === t.id) state.editingTestId = null;
              state.tests = await api('GET', `/athletes/${athlete.id}/tests`);
              render();
            },
          }, [icon('trash'), 'Hapus']),
        ]),
      ]));
    });
    table.appendChild(tbody);
    historyCard.appendChild(el('div', { class: 'table-wrap mod-history-scroll' }, [table]));
  }
  const ntCardSp = renderNextTestCard(athlete, { showCta: false, title: ' Tes berikutnya' });
  if (ntCardSp) wrap.appendChild(ntCardSp);
  wrap.appendChild(assembleModPanels(formCard, sideEls, historyCard));
  return wrap;
}

// Menengah/Jauh — jarak & waktu time trial, dikonversi ke VDOT di server
// (dihitung ulang setiap dibaca, tidak disimpan sebagai angka turunan).
function renderTimeTrialTestsTab(athlete) {
  const wrap = el('div');
  const editingTest = state.editingTestId != null ? state.tests.find((t) => t.id === state.editingTestId) : null;

  const label = el('input', { placeholder: 'cth. Time Trial 3000m', value: editingTest ? editingTest.label || '' : '' });
  const date = el('input', { type: 'date', required: 'true', value: editingTest ? editingTest.date : todayLocalDate() });
  const ttDistance = el('input', { type: 'number', placeholder: 'meter, cth. 3000', value: editingTest ? (editingTest.ttDistance ?? '') : '' });
  const ttTime = el('input', { type: 'text', placeholder: 'mm:ss atau h:mm:ss, cth. 12:30', value: editingTest && editingTest.ttTimeSec != null ? fmtClockDisplay(editingTest.ttTimeSec) : '' });

  const form = el('form', {
    autocomplete: 'off',
    onsubmit: async (e) => {
      e.preventDefault();
      state.error = null;
      try {
        const body = { label: label.value, date: date.value, ttDistance: ttDistance.value, ttTime: ttTime.value };
        if (editingTest) {
          await api('PUT', `/athletes/${athlete.id}/tests/${editingTest.id}`, body);
          state.editingTestId = null;
        } else {
          await api('POST', `/athletes/${athlete.id}/tests`, body);
        }
        state.tests = await api('GET', `/athletes/${athlete.id}/tests`);
      } catch (err) {
        state.error = err.message;
      }
      render();
    },
  }, [
    el('div', { class: 'field-row' }, [
      el('div', {}, [el('label', {}, ['Label']), label]),
      el('div', {}, [el('label', {}, ['Tanggal']), date]),
      el('div', {}, [el('label', {}, ['Jarak Time Trial (m)']), ttDistance]),
      el('div', {}, [el('label', {}, ['Waktu Time Trial']), ttTime]),
    ]),
    el('div', { class: 'row-actions' }, [
      el('button', { type: 'submit' }, [editingTest ? 'Simpan Perubahan' : 'Simpan Tes']),
      editingTest ? el('button', { type: 'button', class: 'secondary', onclick: () => { state.editingTestId = null; render(); } }, ['Batal Ubah']) : null,
    ]),
  ]);

  const formCard = el('div', { class: 'card' }, [
    el('h3', {}, [icon('clipboard'), editingTest ? ' Ubah Hasil Time Trial' : ' Catat Hasil Time Trial Baru']),
    el('p', { class: 'muted' }, ['VDOT & pace latihan dihitung otomatis dari jarak & waktu time trial (formula Daniels–Gilbert).']),
    state.error ? el('div', { class: 'error-box' }, [state.error]) : null,
    form,
  ]);

  const sideEls = [];
  const testsList = Array.isArray(state.tests) ? state.tests : [];
  if (testsList.length) {
    const latest = [...testsList].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)[0];
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('gauge'), ' Tes terakhir']),
      el('p', { class: 'muted', style: 'font-size:0.8rem;' }, [`${latest.label || 'Tanpa label'} · ${fmtDate(latest.date)}`]),
      el('div', { class: 'portal-tiles portal-tiles-stack portal-tiles-2col' }, [
        statTile({
          ic: 'trending-up', variant: 'blue',
          value: latest.vdot != null ? Number(latest.vdot).toFixed(1) : '—',
          label: 'VDOT', sub: 'Semakin tinggi semakin baik',
        }),
        statTile({
          ic: 'flag', variant: 'amber',
          value: latest.ttDistance != null ? String(latest.ttDistance) : '—', unit: 'm',
          label: 'Jarak TT', sub: 'Time trial',
        }),
        statTile({
          ic: 'timer', variant: 'purple',
          value: latest.ttTimeSec != null ? fmtClockDisplay(latest.ttTimeSec) : '—',
          label: 'Waktu TT', sub: 'Finish',
        }),
        statTile({
          ic: 'activity', variant: 'red',
          value: (latest.ttTimeSec != null && latest.ttDistance)
            ? fmtClockDisplay(Math.round(latest.ttTimeSec / (Number(latest.ttDistance) / 1000)))
            : '—',
          label: 'Pace', sub: 'menit / km',
        }),
      ]),
    ]));
  }
  if (testsList.length >= 2) {
    const chrono = [...testsList].reverse();
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('trending-up'), ' Progres VDOT']),
      el('p', { class: 'muted' }, ['Semakin tinggi VDOT, semakin baik.']),
      buildLineChart({
        points: chrono.map((t) => ({ x: t.date, y: t.vdot })),
        valueFormat: (v) => (v != null ? Number(v).toFixed(1) : '—'),
      }),
    ]));
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('timer'), ' Progres waktu TT']),
      el('p', { class: 'muted' }, ['Makin rendah makin cepat.']),
      buildLineChart({
        points: chrono.map((t) => ({ x: t.date, y: t.ttTimeSec })),
        valueFormat: (v) => fmtClockDisplay(v),
      }),
    ]));
  }

  const historyCard = el('div', { class: 'card' });
  historyCard.appendChild(el('h3', {}, [icon('clipboard'), ' Riwayat Tes']));
  if (!testsList.length) {
    historyCard.appendChild(el('p', { class: 'muted' }, ['Belum ada tes tercatat.']));
  } else {
    const table = el('table', {}, [
      el('thead', {}, [el('tr', {}, ['Tanggal', 'Label', 'Jarak TT', 'Waktu TT', 'VDOT', ''].map((h) => el('th', {}, [h])))]),
    ]);
    const tbody = el('tbody');
    testsList.forEach((t) => {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, [fmtDate(t.date)]),
        el('td', {}, [t.label || '-']),
        el('td', {}, [t.ttDistance != null ? `${t.ttDistance} m` : '-']),
        el('td', {}, [fmtClockDisplay(t.ttTimeSec)]),
        el('td', {}, [t.vdot != null ? Number(t.vdot).toFixed(1) : '-']),
        el('td', { class: 'row-actions' }, [
          el('button', { class: 'link', onclick: () => { state.editingTestId = t.id; state.error = null; render(); } }, [icon('pencil'), 'Ubah']),
          el('button', {
            class: 'link', style: 'color:var(--danger);', onclick: async () => {
              if (!confirm('Hapus entri tes ini?')) return;
              await api('DELETE', `/athletes/${athlete.id}/tests/${t.id}`);
              if (state.editingTestId === t.id) state.editingTestId = null;
              state.tests = await api('GET', `/athletes/${athlete.id}/tests`);
              render();
            },
          }, [icon('trash'), 'Hapus']),
        ]),
      ]));
    });
    table.appendChild(tbody);
    historyCard.appendChild(el('div', { class: 'table-wrap mod-history-scroll' }, [table]));
  }
  const ntCardTt = renderNextTestCard(athlete, { showCta: false, title: ' Tes berikutnya' });
  if (ntCardTt) wrap.appendChild(ntCardTt);
  wrap.appendChild(assembleModPanels(formCard, sideEls, historyCard));
  return wrap;
}

// Lompat — SLJ, Vertical Jump, prestasi lomba (boleh sebagian, minimal satu
// diisi), plus checklist teknik kualitatif skala Likert (sama mekanismenya
// dengan Sprint, dibedakan butir Lompat Jauh vs Lompat Tinggi di server).
function renderJumpTestsTab(athlete) {
  const wrap = el('div');
  const editingTest = state.editingTestId != null ? state.tests.find((t) => t.id === state.editingTestId) : null;

  const label = el('input', { placeholder: 'cth. Evaluasi 1', value: editingTest ? editingTest.label || '' : '' });
  const date = el('input', { type: 'date', required: 'true', value: editingTest ? editingTest.date : todayLocalDate() });
  const sljDistance = el('input', { type: 'number', placeholder: 'cm', value: editingTest ? (editingTest.sljDistance ?? '') : '' });
  const vjHeight = el('input', { type: 'number', placeholder: 'cm', value: editingTest ? (editingTest.vjHeight ?? '') : '' });
  const compMark = el('input', { type: 'number', step: '0.01', placeholder: 'meter', value: editingTest ? (editingTest.compMark ?? '') : '' });

  const checklist = state.techniqueChecklist;
  const likertScale = (checklist && checklist.likertScale) || [];
  const checklistItems = (checklist && checklist.items) || [];
  const existingScores = editingTest ? editingTest.techniqueScores : null;
  const techniqueSelects = checklistItems.map((item, i) => {
    const existingScore = existingScores && existingScores[i] ? existingScores[i].score : null;
    return el('select', {}, [
      el('option', { value: '' }, ['Belum dinilai']),
      ...likertScale.map((l) => el('option', { value: String(l.value), selected: existingScore === l.value ? 'true' : undefined }, [`${l.value} — ${l.label}`])),
    ]);
  });

  const form = el('form', {
    autocomplete: 'off',
    onsubmit: async (e) => {
      e.preventDefault();
      state.error = null;
      try {
        const body = {
          label: label.value, date: date.value,
          sljDistance: sljDistance.value, vjHeight: vjHeight.value, compMark: compMark.value,
          techniqueScores: techniqueSelects.map((s) => s.value),
        };
        if (editingTest) {
          await api('PUT', `/athletes/${athlete.id}/tests/${editingTest.id}`, body);
          state.editingTestId = null;
        } else {
          await api('POST', `/athletes/${athlete.id}/tests`, body);
        }
        state.tests = await api('GET', `/athletes/${athlete.id}/tests`);
      } catch (err) {
        state.error = err.message;
      }
      render();
    },
  }, [
    el('div', { class: 'field-row' }, [
      el('div', {}, [el('label', {}, ['Label']), label]),
      el('div', {}, [el('label', {}, ['Tanggal']), date]),
    ]),
    el('div', { class: 'field-row' }, [
      el('div', {}, [el('label', {}, ['Standing Long Jump (cm)']), sljDistance]),
      el('div', {}, [el('label', {}, ['Vertical Jump (cm)']), vjHeight]),
      el('div', {}, [el('label', {}, ['Prestasi Lomba (m)']), compMark]),
    ]),
    el('p', { class: 'muted' }, ['Isi minimal salah satu dari ketiga hasil tes di atas.']),
    checklistItems.length
      ? el('div', {}, [
        el('label', {}, ['Checklist Teknik (kualitatif, skala Likert 1-5)']),
        el('div', {}, checklistItems.map((item, i) => el('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:6px;' }, [
          el('span', { style: 'flex:1;font-size:0.9rem;' }, [item]),
          el('div', { style: 'width:180px;flex-shrink:0;' }, [techniqueSelects[i]]),
        ]))),
      ])
      : null,
    el('div', { class: 'row-actions' }, [
      el('button', { type: 'submit' }, [editingTest ? 'Simpan Perubahan' : 'Simpan Tes']),
      editingTest ? el('button', { type: 'button', class: 'secondary', onclick: () => { state.editingTestId = null; render(); } }, ['Batal Ubah']) : null,
    ]),
  ]);

  const formCard = el('div', { class: 'card' }, [
    el('h3', {}, [icon('clipboard'), editingTest ? ' Ubah Hasil Tes' : ' Catat Hasil Tes Baru']),
    state.error ? el('div', { class: 'error-box' }, [state.error]) : null,
    form,
  ]);
  const sideEls = [];

  if (state.tests.length) {
    const latest = [...state.tests].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)[0];
    const avg = avgTechniqueScore(latest.techniqueScores);
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('gauge'), ' Tes terakhir']),
      el('p', { class: 'muted', style: 'font-size:0.8rem;' }, [`${latest.label || 'Tanpa label'} · ${fmtDate(latest.date)}`]),
      el('div', { class: 'portal-tiles portal-tiles-stack portal-tiles-2col' }, [
        statTile({
          ic: 'zap', variant: 'blue',
          value: latest.sljDistance != null ? latest.sljDistance : '—', unit: 'cm',
          label: 'Standing Long Jump', sub: latest.sljTier || null,
        }),
        statTile({
          ic: 'trending-up', variant: 'amber',
          value: latest.vjHeight != null ? latest.vjHeight : '—', unit: 'cm',
          label: 'Vertical Jump', sub: latest.vjTier || null,
        }),
        statTile({
          ic: 'flag', variant: 'purple',
          value: latest.compMark != null ? latest.compMark : '—', unit: 'm',
          label: 'Prestasi Lomba', sub: latest.compMarkTier || null,
        }),
        statTile({
          ic: 'check-circle', variant: 'red',
          value: avg != null ? avg.toFixed(1) : '—', unit: '/5',
          label: 'Checklist Teknik', sub: avg != null ? 'Rata-rata skala Likert' : 'Belum dinilai',
        }),
      ]),
    ]));
  }

  if (state.tests.length >= 2) {
    const chrono = [...state.tests].reverse();
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('trending-up'), ' Progres Standing Long Jump']),
      buildLineChart({
        points: chrono.map((t) => ({ x: t.date, y: t.sljDistance })),
        valueFormat: (v) => `${v.toFixed(0)} cm`,
      }),
    ]));
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('trending-up'), ' Progres Vertical Jump']),
      buildLineChart({
        points: chrono.map((t) => ({ x: t.date, y: t.vjHeight })),
        valueFormat: (v) => `${v.toFixed(0)} cm`,
      }),
    ]));
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('trending-up'), ' Progres Prestasi Lomba']),
      buildLineChart({
        points: chrono.map((t) => ({ x: t.date, y: t.compMark })),
        valueFormat: (v) => `${v.toFixed(2)} m`,
      }),
    ]));
  }

  const historyCard = el('div', { class: 'card' });
  historyCard.appendChild(el('h3', {}, [icon('clipboard'), ' Riwayat Tes']));
  if (!state.tests.length) {
    historyCard.appendChild(el('p', { class: 'muted' }, ['Belum ada tes tercatat.']));
  } else {
    const table = el('table', {}, [
      el('thead', {}, [el('tr', {}, ['Tanggal', 'Label', 'SLJ', 'Vertical Jump', 'Prestasi Lomba', 'Checklist Teknik', ''].map((h) => el('th', {}, [h])))]),
    ]);
    const tbody = el('tbody');
    state.tests.forEach((t) => {
      const avg = avgTechniqueScore(t.techniqueScores);
      tbody.appendChild(el('tr', {}, [
        el('td', {}, [fmtDate(t.date)]),
        el('td', {}, [t.label || '-']),
        el('td', {}, [t.sljDistance != null ? `${t.sljDistance} cm${t.sljTier ? ` (${t.sljTier})` : ''}` : '-']),
        el('td', {}, [t.vjHeight != null ? `${t.vjHeight} cm${t.vjTier ? ` (${t.vjTier})` : ''}` : '-']),
        el('td', {}, [t.compMark != null ? `${t.compMark} m${t.compMarkTier ? ` (${t.compMarkTier})` : ''}` : '-']),
        el('td', {}, [avg != null ? `Rata² ${avg.toFixed(1)}/5` : '-']),
        el('td', { class: 'row-actions' }, [
          el('button', { class: 'link', onclick: () => { state.editingTestId = t.id; state.error = null; render(); } }, [icon('pencil'), 'Ubah']),
          el('button', {
            class: 'link', style: 'color:var(--danger);', onclick: async () => {
              if (!confirm('Hapus entri tes ini?')) return;
              await api('DELETE', `/athletes/${athlete.id}/tests/${t.id}`);
              if (state.editingTestId === t.id) state.editingTestId = null;
              state.tests = await api('GET', `/athletes/${athlete.id}/tests`);
              render();
            },
          }, [icon('trash'), 'Hapus']),
        ]),
      ]));
    });
    table.appendChild(tbody);
    historyCard.appendChild(el('div', { class: 'table-wrap mod-history-scroll' }, [table]));
  }
  const ntCardJp = renderNextTestCard(athlete, { showCta: false, title: ' Tes berikutnya' });
  if (ntCardJp) wrap.appendChild(ntCardJp);
  wrap.appendChild(assembleModPanels(formCard, typeof sideEls !== 'undefined' ? sideEls : [], historyCard));
  return wrap;
}

// ---------- Monitoring tab ----------
function acwrStatusInfo(acwr) {
  if (!acwr || !acwr.eligible || acwr.acwr == null) {
    const days = acwr ? acwr.daysOfHistory : 0;
    const remaining = Math.max(0, 14 - days);
    return {
      eligible: false,
      badgeClass: 'badge-muted',
      badgeText: 'Belum eligible',
      advice: days === 0
        ? 'Belum ada log monitoring. Catat RPE + durasi setiap selesai latihan agar sistem bisa menghitung risiko cedera.'
        : `Sudah ${days} hari riwayat. Butuh ${remaining} hari lagi (minimal 14 hari) sebelum status risiko ACWR aktif.`,
      progressPct: Math.min(100, Math.round((days / 14) * 100)),
      days,
      remaining,
    };
  }
  const v = acwr.acwr;
  if (v < 0.8) {
    return { eligible: true, badgeClass: 'badge-muted', badgeText: 'Undertraining', advice: 'Beban akut masih rendah dibanding kronik. Pertimbangkan naikkan volume secara bertahap agar adaptasi tidak stagnan.', value: v };
  }
  if (v <= 1.3) {
    return { eligible: true, badgeClass: 'badge-ok', badgeText: 'Sweet spot (Aman)', advice: 'Rasio beban ideal. Pertahankan pola ini — risiko cedera relatif rendah.', value: v };
  }
  if (v <= 1.5) {
    return { eligible: true, badgeClass: 'badge-caution', badgeText: 'Waspada', advice: 'Beban akut mulai tinggi. Pantau pemulihan & jangan lonjakkan volume lagi minggu ini.', value: v };
  }
  return { eligible: true, badgeClass: 'badge-risk', badgeText: 'Risiko tinggi', advice: `ACWR ${v.toFixed(2)} > 1.5. Sistem otomatis mengurangi volume ±25%. Prioritaskan recovery & kurangi intensitas.`, value: v };
}

function renderMonitoringTab(athlete) {
  const wrap = el('div');
  const editingLog = state.editingLogId != null ? state.monitoringLogs.find((m) => m.id === state.editingLogId) : null;
  const prefill = (!editingLog && state.monitoringPrefill) ? state.monitoringPrefill : null;
  // Prefill dipakai sekali lalu dibersihkan agar tidak menempel di kunjungan berikutnya
  if (prefill) state.monitoringPrefill = null;

  // --- Form fields ---
  const date = el('input', { type: 'date', required: 'true', value: editingLog ? editingLog.date : todayLocalDate() });
  const rpe = el('input', {
    type: 'number', min: '0', max: '10', step: '0.5', required: 'true', placeholder: '0–10',
    value: editingLog ? editingLog.rpe : (prefill && prefill.rpe != null ? prefill.rpe : ''),
  });
  const duration = el('input', {
    type: 'number', min: '1', max: '600', required: 'true', placeholder: 'menit',
    value: editingLog ? editingLog.durationMin : (prefill && prefill.durationMin != null ? prefill.durationMin : ''),
  });
  const note = el('input', {
    type: 'text',
    placeholder: 'Opsional: catatan singkat (mis. “sesuai target”, “lutut terasa”)',
    value: editingLog && editingLog.note ? editingLog.note : (prefill && prefill.note ? prefill.note : ''),
    maxlength: '200',
  });
  // Opsional — dipakai lib/hydrationCalc.js untuk rekomendasi cairan presisi
  // (tab Nutrisi, "Dengan timbangan"). Kosongkan kalau tidak ada timbangan.
  const beratSebelum = el('input', {
    type: 'number', step: '0.1', min: '20', max: '200', placeholder: 'kg',
    value: editingLog && editingLog.beratSebelumKg != null ? editingLog.beratSebelumKg : '',
  });
  const beratSesudah = el('input', {
    type: 'number', step: '0.1', min: '20', max: '200', placeholder: 'kg',
    value: editingLog && editingLog.beratSesudahKg != null ? editingLog.beratSesudahKg : '',
  });
  const cairanDiminum = el('input', {
    type: 'number', step: '10', min: '0', max: '10000', placeholder: 'ml',
    value: editingLog && editingLog.cairanDiminumMlSaatSesi != null ? editingLog.cairanDiminumMlSaatSesi : '',
  });
  // Tile ikon+angka gaya statTile(), tapi dibangun manual (bukan lewat
  // statTile()) supaya nilainya bisa di-update langsung tanpa render ulang
  // form saat pelatih mengetik RPE/durasi (lihat updateLoadPreview di bawah).
  const loadValueEl = el('div', { class: 'portal-tile-value' }, ['—']);
  const loadSubEl = el('div', { class: 'portal-tile-sub muted' }, ['Isi RPE & durasi dulu']);
  const loadTile = el('div', { class: 'portal-tile portal-tile-blue' }, [
    el('span', { class: 'portal-tile-icon' }, [icon('zap')]),
    el('div', {}, [loadValueEl, el('div', { class: 'portal-tile-label' }, ['Training Load']), loadSubEl]),
  ]);

  function updateLoadPreview() {
    const r = Number(rpe.value);
    const d = Number(duration.value);
    if (Number.isFinite(r) && Number.isFinite(d) && d > 0) {
      loadValueEl.textContent = String(Math.round(r * d));
      loadSubEl.textContent = 'RPE × durasi — dipakai untuk hitung ACWR';
    } else {
      loadValueEl.textContent = '—';
      loadSubEl.textContent = 'Isi RPE & durasi dulu';
    }
  }
  rpe.addEventListener('input', updateLoadPreview);
  duration.addEventListener('input', updateLoadPreview);
  if (editingLog || prefill) updateLoadPreview();

  // Quick-fill presets (hanya saat menambah baru)
  const quickRow = editingLog ? null : el('div', { class: 'quick-presets' }, [
    el('span', { class: 'muted', style: 'font-size:0.85rem;' }, ['Isi cepat:']),
    el('button', {
      type: 'button', class: 'secondary pill-btn',
      onclick: () => { rpe.value = '6'; duration.value = '45'; updateLoadPreview(); },
    }, ['Mudah (RPE 6 · 45 mnt)']),
    el('button', {
      type: 'button', class: 'secondary pill-btn',
      onclick: () => { rpe.value = '7'; duration.value = '60'; updateLoadPreview(); },
    }, ['Sedang (RPE 7 · 60 mnt)']),
    el('button', {
      type: 'button', class: 'secondary pill-btn',
      onclick: () => { rpe.value = '8'; duration.value = '75'; updateLoadPreview(); },
    }, ['Berat (RPE 8 · 75 mnt)']),
    el('button', {
      type: 'button', class: 'secondary pill-btn',
      onclick: () => { rpe.value = '9'; duration.value = '40'; updateLoadPreview(); },
    }, ['Sangat berat (RPE 9 · 40 mnt)']),
  ]);

  const form = el('form', {
    autocomplete: 'off',
    onsubmit: async (e) => {
      e.preventDefault();
      state.error = null;
      try {
        const body = {
          date: date.value,
          rpe: rpe.value,
          durationMin: duration.value,
          note: (note.value || '').trim() || undefined,
          beratSebelumKg: beratSebelum.value || undefined,
          beratSesudahKg: beratSesudah.value || undefined,
          cairanDiminumMlSaatSesi: cairanDiminum.value || undefined,
        };
        if (editingLog) {
          await api('PUT', `/athletes/${athlete.id}/monitoring/${editingLog.id}`, body);
          state.editingLogId = null;
        } else {
          await api('POST', `/athletes/${athlete.id}/monitoring`, body);
        }
        state.monitoringLogs = await api('GET', `/athletes/${athlete.id}/monitoring`);
        state.acwr = await api('GET', `/athletes/${athlete.id}/monitoring/acwr`);
        state.acwrSeries = await api('GET', `/athletes/${athlete.id}/monitoring/acwr-series?days=42`);
      } catch (err) {
        state.error = err.message;
      }
      render();
    },
  }, [
    quickRow,
    el('div', { class: 'field-row' }, [
      el('div', {}, [el('label', {}, ['Tanggal Sesi']), date]),
      el('div', {}, [el('label', {}, ['RPE Aktual (0–10)']), rpe]),
      el('div', {}, [el('label', {}, ['Durasi (menit)']), duration]),
    ]),
    el('div', {}, [el('label', {}, ['Catatan (opsional)']), note]),
    el('h4', { style: 'margin-top:14px;' }, [icon('droplet'), ' Timbangan sesi (opsional)']),
    el('p', { class: 'muted', style: 'font-size:0.82rem;margin-top:-6px;' }, ['Isi kalau ada timbangan di lokasi — dipakai untuk rekomendasi cairan presisi di tab Nutrisi.']),
    el('div', { class: 'field-row' }, [
      el('div', {}, [el('label', {}, ['Berat sebelum sesi']), beratSebelum]),
      el('div', {}, [el('label', {}, ['Berat sesudah sesi']), beratSesudah]),
      el('div', {}, [el('label', {}, ['Cairan diminum saat sesi']), cairanDiminum]),
    ]),
    el('div', { class: 'load-preview-row' }, [loadTile]),
    el('div', { class: 'row-actions' }, [
      el('button', { type: 'submit' }, [editingLog ? 'Simpan Perubahan' : 'Simpan Log']),
      editingLog ? el('button', { type: 'button', class: 'secondary', onclick: () => { state.editingLogId = null; render(); } }, ['Batal Ubah']) : null,
    ]),
  ]);


  const formCard = el('div', { class: 'card' }, [
    el('h3', {}, [icon('heart'), editingLog ? ' Ubah Log Monitoring' : ' Catat Monitoring Pasca-Latihan']),
    el('p', { class: 'muted' }, ['Isi segera setelah sesi. Data dipakai ACWR & volume.']),
    state.error ? el('div', { class: 'error-box' }, [state.error]) : null,
    form,
  ]);

  const sideEls = [];
  const info = acwrStatusInfo(state.acwr);
  const statusChildren = [el('h3', {}, [icon('shield'), ' Status ACWR'])];
  if (info.eligible) {
    statusChildren.push(
      el('p', {}, [
        `ACWR: `, el('strong', {}, [info.value.toFixed(2)]),
        ' — ',
        el('span', { class: `badge ${info.badgeClass}` }, [info.badgeText]),
      ]),
      renderAcwrGauge(state.acwr),
      el('p', { class: 'muted' }, [info.advice]),
    );
  } else {
    statusChildren.push(
      el('p', {}, [el('span', { class: `badge ${info.badgeClass}` }, [info.badgeText])]),
      el('p', { class: 'muted' }, [info.advice]),
      el('div', { class: 'progress-bar-track' }, [
        el('div', { class: 'progress-bar-fill', style: `width:${info.progressPct}%;` }),
      ]),
    );
  }
  sideEls.push(el('div', { class: 'card mod-chart-card' }, statusChildren));

  if (state.acwrSeries && state.acwrSeries.length) {
    sideEls.push(el('div', { class: 'card mod-chart-card' }, [
      el('h3', {}, [icon('trending-up'), ' Tren ACWR']),
      buildLineChart({
        points: state.acwrSeries.map((p) => ({ x: p.date, y: p.acwr })),
        valueFormat: (v) => v.toFixed(2),
        bands: [
          { from: 0.8, to: 1.3, color: 'color-mix(in srgb, var(--acwr-safe, #10b981) 16%, transparent)' },
          { from: 1.3, to: 1.5, color: 'color-mix(in srgb, var(--acwr-caution, #f59e0b) 18%, transparent)' },
          { from: 1.5, to: 2, color: 'color-mix(in srgb, var(--acwr-risk, #ef4444) 16%, transparent)' },
        ],
      }),
    ]));
  }

  const historyCard = el('div', { class: 'card' });
  historyCard.appendChild(el('h3', {}, [icon('heart'), ' Riwayat Monitoring']));
  if (!state.monitoringLogs.length) {
    historyCard.appendChild(el('div', { class: 'empty-state' }, [
      emptyIllustration('heart'),
      el('p', {}, ['Belum ada log monitoring.']),
    ]));
  } else {
    const table = el('table', {}, [
      el('thead', {}, [el('tr', {}, ['Tanggal', 'RPE', 'Durasi', 'Load', 'Catatan', ''].map((h) => el('th', {}, [h])))]),
    ]);
    const tbody = el('tbody');
    state.monitoringLogs.forEach((m) => {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, [fmtDate(m.date)]),
        el('td', {}, [String(m.rpe)]),
        el('td', {}, [`${m.durationMin} mnt`]),
        el('td', {}, [String(Math.round(m.rpe * m.durationMin))]),
        el('td', { class: 'muted' }, [m.note || '—']),
        el('td', { class: 'row-actions' }, [
          el('button', { class: 'link', onclick: () => { state.editingLogId = m.id; state.error = null; render(); } }, [icon('pencil'), 'Ubah']),
          el('button', {
            class: 'link', style: 'color:var(--danger);', onclick: async () => {
              if (!confirm('Hapus log monitoring ini?')) return;
              await api('DELETE', `/athletes/${athlete.id}/monitoring/${m.id}`);
              if (state.editingLogId === m.id) state.editingLogId = null;
              state.monitoringLogs = await api('GET', `/athletes/${athlete.id}/monitoring`);
              state.acwr = await api('GET', `/athletes/${athlete.id}/monitoring/acwr`);
              state.acwrSeries = await api('GET', `/athletes/${athlete.id}/monitoring/acwr-series?days=42`);
              render();
            },
          }, [icon('trash'), 'Hapus']),
        ]),
      ]));
    });
    table.appendChild(tbody);
    historyCard.appendChild(el('div', { class: 'table-wrap mod-history-scroll' }, [table]));
  }

  wrap.appendChild(assembleModPanels(formCard, sideEls, historyCard));

  return wrap;
}

// ---------- Nutrisi tab ----------
// Mesin deterministik (lib/nutritionEngine.js) — dihitung ulang tiap tab
// dibuka, tidak ada tombol "Generate", tidak ada riwayat/status tersimpan.
// nutritionTargetTile lama dilebur ke statTile() generik (lihat dekat
// assembleModPanels) supaya tile ikon+angka ini bisa dipakai ulang di tab
// lain, bukan cuma Nutrisi — perilaku/markup untuk pemanggilan di bawah
// (tanpa `sub`) persis sama seperti sebelumnya.
const nutritionTargetTile = statTile;

// Dulu satu grid rata 5 stat-card (Kalori/Karbo/Protein/Lemak/Air) — cabang
// olahraga & fase punya bobot yang beda-beda untuk tiap angka ini, jadi
// disatukan jadi 3 kelompok bermakna (kalori total, tiga makronutrien,
// cairan) supaya pengguna baca sebagai "3 cerita" bukan "5 angka lepas".
// Tiap kelompok pakai class .card yang sudah ada (bukan komponen baru),
// dengan deskripsi bahasa awam 2 kalimat di bawahnya (§1 NUTRITION-MODULE-
// DESIGN.md — pelatih/atlet bukan ahli gizi, hindari istilah teknis).
function nutritionTargetStacks(targets) {
  const t = targets || {};

  const kalori = nutritionTargetTile({
    value: t.kaloriKcalPerHari != null ? Math.round(t.kaloriKcalPerHari) : '—',
    unit: 'kkal', label: 'Kalori / hari', ic: 'flame', variant: 'amber', big: true,
  });
  const karbo = nutritionTargetTile({
    value: t.karbohidratGramPerHari != null ? t.karbohidratGramPerHari : '—',
    unit: 'g / hari', label: 'Karbohidrat', ic: 'bar-chart', variant: 'blue',
  });
  const protein = nutritionTargetTile({
    value: t.proteinGramPerHari != null ? t.proteinGramPerHari : '—',
    unit: 'g / hari', label: 'Protein', ic: 'dumbbell', variant: 'purple',
  });
  const lemak = nutritionTargetTile({
    value: t.lemakPersenKalori != null ? t.lemakPersenKalori : '—',
    unit: '% kalori', label: 'Lemak', ic: 'layers', variant: '',
  });
  const air = nutritionTargetTile({
    value: t.airLiterPerHari != null ? t.airLiterPerHari : '—',
    unit: 'liter', label: 'Air / hari', ic: 'droplet', variant: 'blue',
  });

  return el('div', { class: 'nutri-stacks' }, [
    el('div', { class: 'card nutri-stack' }, [
      kalori,
      el('p', { class: 'muted nutri-stack-desc' }, [
        'Kalori adalah total energi yang dibutuhkan tubuh dalam sehari, dari makanan dan minuman. Jumlahnya menyesuaikan fase latihan dan cabang olahraga atlet.',
      ]),
    ]),
    el('div', { class: 'card nutri-stack' }, [
      el('div', { class: 'portal-tiles nutri-macro-tiles' }, [karbo, protein, lemak]),
      el('p', { class: 'muted nutri-stack-desc' }, [
        'Karbohidrat, protein, dan lemak adalah tiga sumber energi utama dari makanan. Porsinya berbeda-beda tergantung intensitas latihan dan kebutuhan pemulihan otot.',
      ]),
    ]),
    el('div', { class: 'card nutri-stack' }, [
      air,
      el('p', { class: 'muted nutri-stack-desc' }, [
        'Cairan menjaga tubuh tetap terhidrasi selama latihan dan membantu pemulihan setelahnya. Kebutuhannya meningkat saat cuaca panas atau sesi latihan berat.',
      ]),
    ]),
  ]);
}


function renderNutritionWeekCard(week, athlete) {
  const today = week.todayMenu;
  const pkg = week.injuryPackage;
  const children = [
    el('h4', {}, [icon('calendar'), ' Menu minggu ini']),
    el('p', { class: 'muted', style: 'font-size:0.8rem;margin:0 0 8px;' }, [
      `${week.weekStart} → ${week.weekEnd}`,
      week.phaseKey ? ` · Fase ${week.phaseKey}` : '',
      today && today.mode === 'recovery' ? ' · Mode pemulihan' : '',
    ]),
  ];
  const todayKey = week.today || todayLocalDate();
  const pkgActive = pkg && pkg.start && pkg.end && todayKey >= pkg.start && todayKey <= pkg.end;
  if (pkgActive) {
    children.push(el('div', { class: 'callout callout-warning', style: 'margin-bottom:8px;padding:8px 10px;' }, [
      el('p', { style: 'margin:0;font-size:0.85rem;' }, [
        `Paket cedera aktif ${pkg.start} s/d ${pkg.end}`,
        pkg.location ? ` (${pkg.location})` : '',
        '. Setelah itu menu kembali normal.',
      ]),
    ]));
  }
  if (!today || !today.available) {
    children.push(el('p', { class: 'muted' }, [(today && today.reason) || 'Menu hari ini belum tersedia.']));
  } else {
    children.push(el('div', { class: 'muted', style: 'font-size:0.8rem;margin-bottom:10px;' }, [
      `Hari ini (${week.today}) · target ~${today.targetKcal || '—'} kkal · total susunan ~${today.totals ? today.totals.kcal : '—'} kkal`,
    ]));
    const SLOT_HINT = {
      breakfast: { time: 'Pagi', hint: 'Mulai hari dengan karbo + protein.' },
      pre: { time: '±2 jam sebelum latihan', hint: 'Usahakan selesai makan sekitar 2 jam sebelum sesi agar pencernaan nyaman.' },
      post: { time: 'Ideal 0–60 menit setelah latihan', hint: 'Jendela pemulihan: isi ulang karbo + protein sesegera mungkin setelah sesi.' },
      dinner: { time: 'Malam', hint: 'Seimbangkan sisa kebutuhan harian.' },
    };
    const slotCards = (today.slots || []).map((slot) => {
      const meta = SLOT_HINT[slot.key] || { time: '', hint: '' };
      return el('div', { class: 'card nutri-meal-card' }, [
        el('div', { class: 'nutri-meal-head' }, [
          el('div', { class: 'nutri-meal-title' }, [slot.label]),
          meta.time ? el('div', { class: 'nutri-meal-time' }, [meta.time]) : null,
        ]),
        meta.hint ? el('p', { class: 'muted nutri-meal-hint' }, [meta.hint]) : null,
        el('ul', { class: 'nutri-meal-items' },
          (slot.items || []).map((it) => el('li', {}, [
            el('span', { class: 'nutri-meal-item-name' }, [it.name]),
            el('span', { class: 'muted nutri-meal-item-meta' }, [`${it.grams} g · ${it.kcal} kkal`]),
          ]))
        ),
        el('div', { class: 'nutri-meal-foot muted' }, [
          slot.totals ? `Subtotal ~${slot.totals.kcal} kkal` : '',
        ]),
      ]);
    });
    children.push(el('div', { class: 'nutri-meal-grid' }, slotCards));
  }
  // Pratinjau sisa minggu (ringkas)
  const rest = (week.days || []).filter((d) => d.date > todayKey && d.available);
  const footKids = [];
  if (rest.length) {
    footKids.push(el('div', { class: 'nutri-week-preview' }, [
      el('div', { class: 'muted nutri-week-preview-title' }, ['Pratinjau sisa minggu']),
      el('ul', { class: 'feed-flag-list nutri-week-preview-list' }, rest.map((d) => {
        const inInj = pkgActive && pkg && d.date >= pkg.start && d.date <= pkg.end;
        return el('li', {}, [
          `${d.date}: ~${d.totals ? d.totals.kcal : '—'} kkal`,
          inInj && d.mode === 'recovery' ? ' (pemulihan)' : '',
        ]);
      })),
    ]));
  }
  footKids.push(el('button', {
    type: 'button',
    class: 'secondary',
    style: 'margin-top:10px;width:100%;',
    onclick: async () => {
      try {
        await api('POST', `/athletes/${athlete.id}/nutrition/week/regenerate`);
        state.nutrition = await api('GET', `/athletes/${athlete.id}/nutrition`);
        render();
        showToast('Menu minggu disusun ulang', 'ok');
      } catch (err) {
        alert(err.message || 'Gagal menyusun ulang');
      }
    },
  }, ['Susun ulang sisa minggu']));
  footKids.push(el('p', { class: 'muted', style: 'font-size:0.75rem;margin-top:8px;' }, [
    'Estimasi berbasis target atlet & database pangan lokal. Bukan resep medis. Sesuaikan dengan ketersediaan bahan dan saran tenaga gizi bila perlu.',
  ]));
  children.push(el('div', { class: 'nutri-week-foot' }, footKids));
  return el('div', { class: 'card mod-chart-card nutri-week-card' }, children);
}

function renderNutritionTab(athlete) {
  const wrap = el('div');
  const plan = state.nutrition;

  const formChildren = [
    el('h3', {}, [icon('utensils'), ' Nutrisi']),
  ];

  // Callout TERPISAH & menonjol (token --danger, beda dari callout-warning
  // generik di bawah), paling atas kalau aktif — sensitif waktu, tidak
  // boleh tenggelam di antara peringatan lain (§9a).
  if (plan && plan.available && plan.karboLoading) {
    const kl = plan.karboLoading;
    formChildren.push(el('div', { class: 'callout callout-danger' }, [
      el('h4', {}, [icon('flag'), ` KARBO-LOADING AKTIF — H-${kl.hariMenujuKompetisi} menuju kompetisi`]),
      el('p', {}, [kl.catatan]),
      el('p', { class: 'muted', style: 'font-size:0.8rem;margin-top:4px;' }, [
        `Target karbo hari ini: ${kl.targetGramPerKgHariIni} g/kg BB — menggantikan target fase harian biasa untuk hari ini.`,
      ]),
    ]));
  }

  formChildren.push(
    el('p', { class: 'muted' }, [
      `${categoryLabel(athlete.profile.kategori) || athlete.profile.kategori} · ${athlete.profile.event}`,
      plan && plan.available && plan.phaseLabel ? ` · Fase ${plan.phaseLabel}` : '',
    ]),
    el('p', { class: 'muted', style: 'font-size:0.8rem;' }, ['Dihitung otomatis dari profil, fase, dan beban latihan atlet — bukan digenerate AI.']),
  );

  if (!plan) {
    formChildren.push(el('p', { class: 'muted' }, ['Memuat...']));
  } else if (!plan.available) {
    formChildren.push(
      el('div', { class: 'empty-state' }, [
        emptyIllustration('utensils'),
        el('p', {}, [plan.reason || 'Rencana nutrisi belum bisa dihitung.']),
      ]),
      el('button', { type: 'button', class: 'secondary', onclick: () => { state.view = 'athlete-edit'; render(); } }, [icon('pencil'), 'Lengkapi Profil Atlet']),
    );
  } else {
    formChildren.push(
      plan.ringkasanSingkat ? el('p', { style: 'font-weight:700;font-size:1.05rem;margin-top:12px;' }, [plan.ringkasanSingkat]) : null,
      nutritionTargetStacks(plan.targets || {}),
    );
  }

  const sideEls = [];
  if (plan && plan.available) {
    if (plan.cairan) {
      const c = plan.cairan;
      const narasiMinimum = `Ini perkiraan minimum berdasarkan berat badan dan latihan hari ini, ${fmtDate(todayLocalDate())}. Kebutuhan cairan sekitar ${c.minimumLiter} liter — bisa lebih tinggi tergantung cuaca dan intensitas latihan sebenarnya.`;
      const narasiPresisi = c.presisiLiter != null
        ? `Dihitung dari perubahan berat badan sebelum-sesudah sesi latihan tanggal ${fmtDate(c.presisiDariSesiTanggal)}. Kebutuhan cairan sekitar ${c.presisiLiter} liter — lebih akurat karena mengikuti kondisi tubuh sebenarnya. Selalu catat berat badan sebelum & sesudah latihan di form Monitoring agar rekomendasi ini makin tepat.`
        : 'Belum ada data timbangan — catat berat badan sebelum & sesudah latihan di form Monitoring supaya rekomendasi ini bisa dihitung lebih akurat.';
      sideEls.push(el('div', { class: 'card mod-chart-card' }, [
        el('h4', {}, [icon('droplet'), ' Rekomendasi Cairan']),
        el('div', { class: 'cairan-option' }, [
          el('div', { class: 'info-chip-label' }, ['Tanpa timbangan (estimasi minimum)']),
          el('div', { class: 'info-chip-value' }, [`${c.minimumLiter} L`]),
          el('p', { class: 'muted nutri-stack-desc' }, [narasiMinimum]),
        ]),
        el('div', { class: 'cairan-option' + (c.presisiLiter != null ? ' cairan-option-emphasis' : '') }, [
          el('div', { class: 'info-chip-label' }, ['Dengan timbangan (direkomendasikan)']),
          el('div', { class: 'info-chip-value' }, [c.presisiLiter != null ? `${c.presisiLiter} L` : '—']),
          el('p', { class: 'muted nutri-stack-desc' }, [narasiPresisi]),
        ]),
      ]));
    }
    // Menu minggu (generate Senin–Minggu, recall hari ini)
    if (plan.weekMenu && plan.weekMenu.todayMenu) {
      sideEls.push(renderNutritionWeekCard(plan.weekMenu, athlete));
    } else if (plan.contohMenuHarian && plan.contohMenuHarian.length) {
      sideEls.push(el('div', { class: 'card mod-chart-card' }, [
        el('h4', {}, ['Contoh menu harian']),
        el('ul', { class: 'feed-flag-list' }, plan.contohMenuHarian.map((m) => el('li', {}, [icon('utensils'), ' ', m]))),
      ]));
    }
    if (plan.peringatanKhusus && plan.peringatanKhusus.length) {
      sideEls.push(el('div', { class: 'callout callout-warning mod-chart-card' }, [
        el('h4', {}, [icon('alert-triangle'), ' Catatan khusus']),
        ...plan.peringatanKhusus.map((p) => el('p', {}, [p])),
      ]));
    }
  }

  // Satu blok sumber saja: kutipan penuh + satu baris atribusi (tanpa mengulang
  // sumberPedoman yang isinya hampir sama, dan tanpa footer history).
  if (plan && plan.available && plan.citation && plan.citation.text) {
    let citeText = String(plan.citation.text).trim().replace(/\.+$/, '.');
    let atribusi = plan.citation.atribusi
      ? String(plan.citation.atribusi).trim().replace(/[.:\s]+$/, '')
      : (plan.sumberPedoman
          ? String(plan.sumberPedoman).replace(/^Berbasis\s+/i, '').replace(/\.+$/, '')
          : '');
    formChildren.push(el('div', { class: 'nutri-source-block' }, [
      el('blockquote', { class: 'nutri-citation' }, [
        el('p', { class: 'nutri-citation-text' }, [citeText]),
        atribusi
          ? el('cite', { class: 'nutri-citation-attr' }, [icon('book-open'), ' ', atribusi])
          : null,
      ]),
    ]));
  } else if (plan && plan.available && plan.sumberPedoman) {
    formChildren.push(el('div', { class: 'nutri-source-block' }, [
      el('p', { class: 'muted nutri-sumber-line' }, [
        icon('book-open'),
        ' ',
        String(plan.sumberPedoman).trim().replace(/\.+$/, '.'),
      ]),
    ]));
  }

  const formCardFinal = el('div', { class: 'card' }, formChildren);
  wrap.appendChild(assembleModPanels(formCardFinal, sideEls, null));

  return wrap;
}

// ---------- Render dispatcher ----------
function render() {
  if (state.view === 'landing') return renderLanding();
  if (state.view === 'auth') return renderAuth();
  if (state.view === 'admin-setup') return renderAdminSetup();
  if (state.view === 'app' || state.view === 'athlete-form' || state.view === 'athlete-edit') return renderApp();
  root.innerHTML = 'Memuat...';
}

bootstrap();
