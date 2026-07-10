/* ============================================================
   CourtVision — charts.js
   Visual charts drawn from live match data (SVG strings).
   Requires match-logic.js loaded first.
   Exposes window.CourtVisionCharts:
     renderInto(containerEl, match)  <- easiest: renders all three
     radarSVG(match), serveCourtSVG(match), zoneCourtSVG(match)
   ============================================================ */
(function () {
  const g = (typeof window !== 'undefined') ? window : globalThis;
  const M = g.CourtVisionMatch;
  if (!M) { console.error('charts.js: load match-logic.js first'); return; }

  const LIME = '#d9f64b', ORANGE = '#e8975a', GRID = '#2c5638',
    COURT = '#265232', LINE_C = '#e8f2e6', TXT = '#cfe6d4', DARK = '#12291a';

  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

  // ---------- radar values (0-100 each) -------------------------------
  function radarValues(match) {
    const s = M.getStats(match);
    const won = s.win_points;

    // Serve: 1st serve %
    const serve = s.serve.service_points ? s.serve.first_serve_pct : 0;
    // FH / BH consistency
    const fh = s.consistency.fh.strokes ? s.consistency.fh.pct : 0;
    const bh = s.consistency.bh.strokes ? s.consistency.bh.pct : 0;
    // Aggression: share of win points earned by aggressive play
    const aggr = won ? Math.round((s.how_you_won.aggressive.n / won) * 100) : 0;
    // Net play: win rate in the net zone (from shot detail tags)
    const net = zoneRate(s, 'net_play');
    // Pressure: game/set point conversion for player A (simulated from log)
    const press = pressureConversion(match);

    return [
      ['Serve', clamp(serve)],
      ['FH', clamp(fh)],
      ['Aggression', clamp(aggr)],
      ['Net play', clamp(net)],
      ['BH', clamp(bh)],
      ['Pressure', clamp(press)],
    ];
  }

  function zoneRate(stats, zone) {
    const inZone = stats.shot_map.filter(x => x.zone === zone);
    if (!inZone.length) return 0;
    const w = inZone.filter(x => x.outcome === 'aggressive_win').length;
    return (w / inZone.length) * 100;
  }

  // Game-point conversion for A: of the points where A held game point
  // (40-x or Ad, incl. tiebreak set points), how many did A win?
  function pressureConversion(match) {
    let a = 0, b = 0, games = { A: 0, B: 0 }, tb = false;
    let chances = 0, converted = 0;
    for (const p of match.points) {
      const gpA = tb
        ? (a >= 6 && a - b >= 1)
        : (a >= 3 && a - b >= 1);
      if (gpA) { chances++; if (p.winner === 'A') converted++; }
      if (p.winner === 'A') a++; else b++;
      const done = tb
        ? ((a >= 7 || b >= 7) && Math.abs(a - b) >= 2)
        : ((a >= 4 || b >= 4) && Math.abs(a - b) >= 2);
      if (done) {
        const w = a > b ? 'A' : 'B';
        games[w]++;
        a = 0; b = 0;
        tb = (games.A === 6 && games.B === 6);
        if (games.A >= 6 || games.B >= 6) {
          if (!tb && (Math.abs(games.A - games.B) >= 2 || games.A === 7 || games.B === 7)) games = { A: 0, B: 0 };
        }
      }
    }
    return chances ? (converted / chances) * 100 : 0;
  }

  // ---------- radar SVG --------------------------------------------------
  function radarSVG(match) {
    const vals = radarValues(match);
    const cx = 150, cy = 118, R = 88;
    const pt = (i, v) => {
      const ang = (Math.PI / 3) * i - Math.PI / 2; // start top, clockwise
      return [(cx + R * v * Math.cos(ang)).toFixed(1), (cy + R * v * Math.sin(ang)).toFixed(1)];
    };
    const ring = (v) => Array.from({ length: 6 }, (_, i) => pt(i, v).join(',')).join(' ');
    const dataPts = vals.map(([, v], i) => pt(i, Math.max(v, 4) / 100));
    const poly = dataPts.map(p => p.join(',')).join(' ');
    const axes = Array.from({ length: 6 }, (_, i) => {
      const [x, y] = pt(i, 1);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`;
    }).join('');
    const labelPos = [[150, 14, 'middle'], [258, 78, 'middle'], [258, 172, 'middle'], [150, 232, 'middle'], [42, 172, 'middle'], [42, 78, 'middle']];
    const labels = vals.map(([name, v], i) => {
      const [x, y, anch] = labelPos[i];
      return `<text x="${x}" y="${y}" text-anchor="${anch}" font-size="11" fill="${TXT}">${name} ${v}</text>`;
    }).join('');
    const dots = dataPts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${LIME}"/>`).join('');
    return `<svg viewBox="0 0 300 244" style="width:100%;max-width:320px;display:block;margin:0 auto" role="img" aria-label="Player profile radar">
      <polygon points="${ring(1)}" fill="none" stroke="${GRID}" stroke-width="1"/>
      <polygon points="${ring(0.66)}" fill="none" stroke="${GRID}" stroke-width="1"/>
      <polygon points="${ring(0.33)}" fill="none" stroke="${GRID}" stroke-width="1"/>
      ${axes}
      <polygon points="${poly}" fill="${LIME}" fill-opacity="0.28" stroke="${LIME}" stroke-width="2"/>
      ${dots}${labels}
    </svg>`;
  }

  // ---------- serve placement court ------------------------------------
  function serveCourtSVG(match) {
    const pts = match.points.filter(p =>
      p.server === 'A' && (p.serve === 'first_in' || p.serve === 'second_in'));
    const counts = { t: 0, body: 0, angle: 0 };
    pts.forEach(p => { if (p.serve_placement && counts[p.serve_placement] != null) counts[p.serve_placement]++; });
    const total = counts.t + counts.body + counts.angle;
    const pc = k => total ? Math.round((counts[k] / total) * 100) : 0;
    const op = k => total ? (0.12 + 0.5 * (counts[k] / Math.max(1, Math.max(counts.t, counts.body, counts.angle)))) : 0.12;
    return `<svg viewBox="0 0 200 170" style="width:100%;display:block" role="img" aria-label="Serve placement">
      <rect x="20" y="10" width="160" height="150" fill="${COURT}" rx="4"/>
      <rect x="35" y="18" width="130" height="134" fill="none" stroke="${LINE_C}" stroke-width="1.5"/>
      <line x1="35" y1="88" x2="165" y2="88" stroke="${LINE_C}" stroke-width="1"/>
      <line x1="100" y1="18" x2="100" y2="88" stroke="${LINE_C}" stroke-width="1"/>
      <rect x="78" y="18" width="22" height="70" fill="${LIME}" fill-opacity="${op('t')}"/>
      <rect x="57" y="18" width="21" height="70" fill="${LIME}" fill-opacity="${op('body')}"/>
      <rect x="35" y="18" width="22" height="70" fill="${LIME}" fill-opacity="${op('angle')}"/>
      <line x1="20" y1="160" x2="180" y2="160" stroke="${LINE_C}" stroke-width="2" stroke-dasharray="3 3"/>
      <text x="89" y="48" text-anchor="middle" font-size="10" font-weight="600" fill="${LINE_C}">T</text>
      <text x="89" y="61" text-anchor="middle" font-size="9" fill="${TXT}">${pc('t')}%</text>
      <text x="67" y="48" text-anchor="middle" font-size="10" fill="${LINE_C}">B</text>
      <text x="67" y="61" text-anchor="middle" font-size="9" fill="${TXT}">${pc('body')}%</text>
      <text x="46" y="48" text-anchor="middle" font-size="10" fill="${LINE_C}">A</text>
      <text x="46" y="61" text-anchor="middle" font-size="9" fill="${TXT}">${pc('angle')}%</text>
      <text x="100" y="126" text-anchor="middle" font-size="9" fill="${TXT}">${total} serves in · deuce view</text>
    </svg>`;
  }

  // ---------- win/error zone court --------------------------------------
  function zoneCourtSVG(match) {
    const s = M.getStats(match);
    const zones = ['net_play', 'middle_court', 'ahead_baseline', 'behind_baseline'];
    const zl = { net_play: 'Net', middle_court: 'Mid', ahead_baseline: 'Ahead', behind_baseline: 'Behind' };
    const bands = [[11, 31], [42, 31], [73, 33], [106, 33]]; // y, height
    let rects = '', texts = '';
    zones.forEach((z, i) => {
      const inZone = s.shot_map.filter(x => x.zone === z);
      const w = inZone.filter(x => x.outcome === 'aggressive_win').length;
      const e = inZone.length - w;
      const [y, h] = bands[i];
      let fill = GRID, fo = 0.25;
      if (inZone.length) {
        const winShare = w / inZone.length;
        fill = winShare >= 0.5 ? LIME : ORANGE;
        fo = 0.18 + 0.45 * Math.abs(winShare - 0.5) * 2;
      }
      rects += `<rect x="33" y="${y}" width="114" height="${h}" fill="${fill}" fill-opacity="${fo.toFixed(2)}"/>`;
      const label = inZone.length ? `${zl[z]} ${w}W·${e}E` : `${zl[z]} –`;
      texts += `<text x="90" y="${y + h / 2 + 4}" text-anchor="middle" font-size="9" fill="${LINE_C}">${label}</text>`;
    });
    return `<svg viewBox="0 0 180 150" style="width:100%;display:block" role="img" aria-label="Win and error zones">
      <rect x="22" y="6" width="136" height="138" fill="${COURT}" rx="4"/>
      <rect x="33" y="11" width="114" height="128" fill="none" stroke="${LINE_C}" stroke-width="1.5"/>
      ${rects}
      <line x1="22" y1="6" x2="158" y2="6" stroke="${LINE_C}" stroke-width="2" stroke-dasharray="3 3"/>
      ${texts}
    </svg>`;
  }

  // ---------- one-call renderer -------------------------------------------
  function renderInto(container, match) {
    if (!container || !match) return;
    container.innerHTML = `
      <div style="background:${DARK};border:1px solid ${GRID};border-radius:12px;padding:10px;margin-bottom:12px">
        <p style="font-size:11px;font-weight:600;margin:0 0 2px;color:#f0f7ec">Player profile</p>
        ${radarSVG(match)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="background:${DARK};border:1px solid ${GRID};border-radius:12px;padding:10px">
          <p style="font-size:11px;font-weight:600;margin:0 0 6px;color:#f0f7ec">Serve placement</p>
          ${serveCourtSVG(match)}
        </div>
        <div style="background:${DARK};border:1px solid ${GRID};border-radius:12px;padding:10px">
          <p style="font-size:11px;font-weight:600;margin:0 0 6px;color:#f0f7ec">Win / error zones</p>
          ${zoneCourtSVG(match)}
        </div>
      </div>`;
  }

  const CourtVisionCharts = { renderInto, radarSVG, serveCourtSVG, zoneCourtSVG, radarValues };
  g.CourtVisionCharts = CourtVisionCharts;
  if (typeof module !== 'undefined') module.exports = CourtVisionCharts;
})();
