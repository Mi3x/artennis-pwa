/* ============================================================
   CourtVision — tagging-ui.js  (v4.3)
   The tagger is now a FACTORY, so it can live in two places:
     • floating panel  → courtside live tagging (source: 'live')
     • inline in REVIEW → studio tagging from video (source: 'video')
   Both share one engine (match-logic.js) and one look.
   Also new: the MATCHES tab becomes a real match picker —
   every saved match, live or video, selectable.

   API:
     CourtVisionTagger.create({ mount, source, getVideoTime, videoName })
       → { setMatch, newFromVideo, refresh, el }
     CourtVisionTagger.renderBreakdown(container, match)
     CourtVisionTagger.renderMatchesTab(container)
   Requires match-logic.js (v4.3) and charts.js first.
   ============================================================ */
(function () {
  const M = window.CourtVisionMatch;
  if (!M) { console.error('tagging-ui: load match-logic.js first'); return; }

  // ---- one stylesheet for every instance -------------------------------
  const css = `
  .cvt-fab{position:fixed;bottom:84px;right:16px;z-index:9998;background:#d9f64b;color:#1c330f;
    border:none;border-radius:999px;padding:12px 18px;font-weight:600;font-size:14px;
    box-shadow:0 4px 14px rgba(0,0,0,.4);cursor:pointer;font-family:inherit}
  .cvt-panel{font-family:inherit;color:#f0f7ec}
  .cvt-panel.float{position:fixed;inset:auto 0 0 0;max-height:86vh;overflow-y:auto;z-index:9999;
    background:#12291a;border-radius:20px 20px 0 0;padding:18px 16px 28px;
    box-shadow:0 -6px 30px rgba(0,0,0,.5);display:none}
  .cvt-panel.float.open{display:block}
  .cvt-panel.inline{display:block;background:transparent;padding:0}
  .cvt-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .cvt-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap}
  .cvt-label{font-size:11px;letter-spacing:1.5px;color:#8fbf9a;text-transform:uppercase}
  .cvt-q{font-size:15px;font-weight:600;margin:6px 0 8px}
  .cvt-btn{background:#1d4028;border:1px solid #2c5638;color:#f0f7ec;border-radius:10px;
    padding:10px 12px;font-size:13px;cursor:pointer;font-family:inherit}
  .cvt-btn.sel{background:#d9f64b;color:#1c330f;border-color:#d9f64b;font-weight:600}
  .cvt-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
  .cvt-auto{display:flex;align-items:center;gap:8px;background:#2e4a1f;border:1.5px solid #d9f64b;
    border-radius:10px;padding:8px 12px;font-size:12px;color:#d9f64b;margin-bottom:12px}
  .cvt-pill{border-radius:999px}
  .cvt-save{display:block;margin:8px auto 0;background:#d9f64b;color:#1c330f;border:none;
    border-radius:10px;padding:11px 30px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
  .cvt-x{background:none;border:none;color:#8fbf9a;font-size:13px;cursor:pointer;font-family:inherit}
  .cvt-sec{display:none;border-top:1px solid #2c5638;padding-top:12px;margin-top:4px}
  .cvt-sec.show{display:block}
  .cvt-zone{border:1.5px solid #4a7a56;border-radius:12px;overflow:hidden;width:100%;max-width:280px;margin:0 auto}
  .cvt-zone button{display:block;width:100%;background:#1d4028;border:none;border-bottom:1px dashed #4a7a56;
    color:#f0f7ec;font-size:12px;padding:13px 4px;cursor:pointer;font-family:inherit}
  .cvt-zone button:last-child{border-bottom:none}
  .cvt-zone button.sel{background:#d9f64b;color:#1c330f;font-weight:600}
  .cvt-stat{display:flex;justify-content:space-between;font-size:12px;color:#cfe6d4;margin:8px 0 3px}
  .cvt-bar{background:#1d4028;border-radius:4px;height:10px}
  .cvt-fill{border-radius:4px;height:10px;background:#d9f64b;width:0%}
  .cvt-fill.loss{background:#e8975a}
  .cvt-cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}
  .cvt-card{background:#1d4028;border-radius:10px;padding:10px}
  .cvt-card b{font-size:20px;color:#d9f64b;display:block}
  .cvt-card span{font-size:11px;color:#9fc9aa}
  .cvt-card.hl{background:#d9f64b}.cvt-card.hl b{color:#1c330f}.cvt-card.hl span{color:#3d5a1e}
  .cvt-score{background:#1d4028;border-radius:12px;padding:10px 14px;margin-bottom:12px}
  .cvt-ends{display:none;background:#e8975a;color:#1c330f;border-radius:10px;padding:8px 12px;
    font-size:13px;font-weight:600;margin-bottom:12px;text-align:center}
  .cvt-ends.show{display:block}
  .cvt-input{width:100%;box-sizing:border-box;background:#1d4028;border:1px solid #2c5638;color:#f0f7ec;
    border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;margin-bottom:10px}
  .cvt-wings{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .cvt-wingtitle{font-size:12px;font-weight:700;text-align:center;margin:0 0 6px}
  .cvt-shotgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}
  .cvt-cell{position:relative;background:#1d4028;border:1px solid #2c5638;color:#f0f7ec;
    border-radius:10px;padding:12px 2px;font-size:12px;text-align:center;cursor:pointer;font-family:inherit}
  .cvt-cell[data-wing="fh"]{color:#d9f64b}
  .cvt-cell.sel{background:#d9f64b;color:#1c330f;border-width:2px;border-color:#f0f7ec;padding:11px 1px;font-weight:600}
  .cvt-cell .n{position:absolute;top:2px;right:5px;font-size:9px;color:#8fbf9a}
  .cvt-cell.sel .n{color:#1c330f;font-weight:700}
  .cvt-panel.compact .cvt-cell{padding:9px 2px;font-size:11px}
  .cvt-panel.compact .cvt-cell.sel{padding:8px 1px}
  .cvt-endgrid{display:grid;grid-template-columns:76px 1fr 1fr 1fr;gap:6px;align-items:stretch}
  .cvt-endname{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600}
  .cvt-endbtn{background:#1d4028;border:1px solid #2c5638;border-radius:12px;padding:14px 4px;
    text-align:center;cursor:pointer;font-family:inherit;color:#f0f7ec}
  .cvt-endbtn p{margin:0;font-size:18px}
  .cvt-endbtn span{display:block;font-size:11px;margin-top:3px}
  .cvt-chipauto{display:flex;align-items:center;gap:8px;background:#2e4a1f;border:1.5px solid #d9f64b;
    border-radius:12px;padding:12px 14px;margin-bottom:14px}
  .cvt-chipauto b{font-size:15px;color:#d9f64b}
  .cvt-changegrids{display:none;margin-bottom:12px}
  .cvt-changegrids.show{display:block}
  .cvt-acebtn{background:#d9f64b;color:#1c330f;font-weight:600;border-color:#d9f64b}
  .cvt-sb{display:flex;align-items:center;gap:16px;flex-wrap:wrap;width:100%}
  .cvt-sbnames{font-size:12px;color:#cfe6d4}
  .cvt-sbsmall{font-size:11px;color:#8fbf9a;letter-spacing:.5px}
  .cvt-sbsmall b{color:#f0f7ec;font-size:13px;font-weight:600}
  .cvt-sbsmall i{color:#8fbf9a;font-size:13px;font-style:normal}
  .cvt-sbmain{margin-left:auto;background:#0f2415;border:1.5px solid #d9f64b;border-radius:10px;
    padding:6px 16px;font-size:22px;font-weight:700;color:#d9f64b;letter-spacing:1px}
  .cvt-sbmain.hot{animation:cvtpulse 1.4s ease-in-out infinite}
  .cvt-sbmain.tb{border-color:#e8975a;color:#e8975a}
  @keyframes cvtpulse{0%,100%{box-shadow:0 0 0 0 rgba(217,246,75,.5)}50%{box-shadow:0 0 0 7px rgba(217,246,75,0)}}
  .cvt-mlist{display:grid;gap:8px;margin-bottom:16px}
  .cvt-mitem{display:flex;align-items:center;gap:10px;background:#1d4028;border:1px solid #2c5638;
    border-radius:12px;padding:10px 12px;cursor:pointer;font-family:inherit;text-align:left;width:100%;color:#f0f7ec}
  .cvt-mitem.sel{border-color:#d9f64b;border-width:2px;padding:9px 11px}
  .cvt-mtag{font-size:9px;letter-spacing:1px;border-radius:6px;padding:2px 7px;font-weight:700}
  .cvt-mtag.live{background:#d9f64b;color:#1c330f}
  .cvt-mtag.video{background:#4a7a56;color:#f0f7ec}
  .cvt-exp{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0 4px}
  .cvt-exp .cvt-btn{padding:8px 12px;font-size:12px}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const cellsHTML = wing => M.SHOT_TYPES.map(sh =>
    `<button class="cvt-cell" data-wing="${wing}" data-shot="${sh}">${M.SHOT_LABELS[sh]}<span class="n" data-n="${wing}-${sh}">0</span></button>`).join('');
  const detailCellsHTML = wing => M.SHOT_TYPES.map(sh =>
    `<button class="cvt-cell cvt-dcell" data-wing="${wing}" data-shot="${sh}">${M.SHOT_LABELS[sh]}</button>`).join('');

  const ZONE_LABELS = { net_play: 'Net play', middle_court: 'Middle court', ahead_baseline: 'Ahead of baseline', behind_baseline: 'Behind baseline' };
  const BAR_DEFS = [
    ['How you won', [['consistency', 'Consistency play'], ['aggressive', 'Aggressive play'], ['serve', 'Serve play'], ['opp_double_faults', 'Opp. double faults']], 'how_you_won', ''],
    ['How you lost', [['your_unforced_errors', 'Your unforced errors'], ['opp_aggressive', 'Opp. aggressive play'], ['opp_serve', 'Opp. serve'], ['your_double_faults', 'Your double faults']], 'how_you_lost', 'loss'],
  ];

  // ================= export / import ====================================
  const SL = k => (k ? (M.SHOT_LABELS[k] || k) : '');
  const fmtTime = t => (t == null) ? '' :
    String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  function matchToCSV(match) {
    const P = match.players;
    const head = ['point', 'winner', 'server', 'win_cause', 'loss_cause', 'end_detail',
      'serve', 'serve_placement', 'shots_in_rally', 'rally_shots',
      'final_wing', 'final_shot', 'zone', 'video_time'];
    const rows = match.points.map(p => {
      const strokes = (p.strokes || []).map(x => {
        const w = (x && x.wing) ? x.wing : (typeof x === 'string' ? x : '');
        const sh = (x && x.shot) ? x.shot : '';
        return (w ? w.toUpperCase() : '?') + (sh ? ' ' + SL(sh) : '');
      }).join(' | ');
      return [p.n, P[p.winner], P[p.server], p.win_cause, p.loss_cause, p.end_detail || '',
        p.serve || '', p.serve_placement || '', p.shots_in_rally || 0, strokes,
        p.wing || '', SL(p.shot_type), p.zone || '', fmtTime(p.video_time)];
    });
    const esc = v => {
      const t = String(v == null ? '' : v);
      return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    // stats summary block on top
    const s2 = M.getStats(match);
    const meta = [
      ['CourtVision match export'], [P.A + ' vs ' + P.B],
      ['date', new Date(match.createdAt).toLocaleString()],
      ['source', match.source || 'live'], ['clip', match.videoName || ''],
      ['win points', s2.win_points], ['lost points', s2.lost_points], ['balance', s2.balance_point],
      ['won by consistency', s2.how_you_won.consistency.n + ' (' + s2.how_you_won.consistency.pct + '%)'],
      ['won by aggressive', s2.how_you_won.aggressive.n + ' (' + s2.how_you_won.aggressive.pct + '%)'],
      ['won by serve', s2.how_you_won.serve.n + ' (' + s2.how_you_won.serve.pct + '%)'],
      ['opp double faults', s2.how_you_won.opp_double_faults.n],
      ['your unforced errors', s2.how_you_lost.your_unforced_errors.n],
      ['1st serve %', s2.serve.first_serve_pct], ['2nd serve %', s2.serve.second_serve_pct],
      ['double faults', s2.serve.double_faults],
      ['FH consistency %', s2.consistency.fh.pct], ['BH consistency %', s2.consistency.bh.pct],
      [], ['SHOT MIX'], ['shot', 'hit', 'errors', '% in play'],
      ...s2.shot_mix.map(r => [r.wing.toUpperCase() + ' ' + SL(r.shot), r.n, r.errors, r.in_play_pct]),
      [], ['POINT BY POINT'],
    ];
    return [...meta.map(r => r.map(esc).join(',')), head.join(','),
            ...rows.map(r => r.map(esc).join(','))].join('\n');
  }

  function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const safeName = match =>
    (match.players.A + '-vs-' + match.players.B + '-' + new Date(match.createdAt).toISOString().slice(0, 10))
      .replace(/[^a-z0-9\-]/gi, '_');

  function exportCSV(match) { download(matchToCSV(match), safeName(match) + '.csv', 'text/csv'); }
  function exportJSON(match) { download(JSON.stringify(match, null, 2), safeName(match) + '.json', 'application/json'); }

  async function shareCSV(match) {
    const file = new File([matchToCSV(match)], safeName(match) + '.csv', { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: 'CourtVision match data' }); return; } catch (e) { return; }
    }
    exportCSV(match);
  }

  function importJSON(file, done) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const m = JSON.parse(r.result);
        if (!m || !m.players || !Array.isArray(m.points)) throw new Error('not a CourtVision match file');
        // fresh id if it clashes, so imports never overwrite
        if (M.loadMatch(m.id)) m.id = 'match_' + Date.now();
        m.source = m.source || 'live';
        m.current = { serve: null, serveFaults: 0, strokes: [] };
        M.saveMatch(m);
        done(null, m);
      } catch (e) { done(e); }
    };
    r.onerror = () => done(new Error('could not read file'));
    r.readAsText(file);
  }

  // ================= shared breakdown renderer =========================
  function renderBreakdown(container, match, opts = {}) {
    if (!container || !match) return;
    const s = M.getStats(match);
    const P = match.players;
    container.innerHTML = '';

    const head = el('p', 'cvt-label', 'Point breakdown · ' + P.A + ' vs ' + P.B +
      ' · ' + new Date(match.createdAt).toLocaleDateString() +
      (match.source === 'video' ? ' · 🎬 ' + (match.videoName || 'video') : ''));
    head.style.marginBottom = '10px';
    container.appendChild(head);

    if (opts.exportBar !== false) {
      const bar = el('div', 'cvt-exp');
      const mk = (label, fn) => { const b = el('button', 'cvt-btn', label); b.onclick = fn; return b; };
      bar.appendChild(el('span', 'cvt-label', 'Export:'));
      bar.appendChild(mk('📤 Share CSV', () => shareCSV(match)));
      bar.appendChild(mk('📊 CSV', () => exportCSV(match)));
      bar.appendChild(mk('🗂 JSON', () => exportJSON(match)));
      container.appendChild(bar);
    }

    const cards = el('div', 'cvt-cards');
    cards.innerHTML =
      `<div class="cvt-card"><b>${s.win_points}</b><span>Win points</span></div>
       <div class="cvt-card"><b style="color:#f0f7ec">${s.lost_points}</b><span>Lost points</span></div>
       <div class="cvt-card hl"><b>${(s.balance_point >= 0 ? '+' : '') + s.balance_point}</b><span>Balance point</span></div>`;
    container.appendChild(cards);

    const vis = el('div');
    container.appendChild(vis);
    if (window.CourtVisionCharts) CourtVisionCharts.renderInto(vis, match);

    BAR_DEFS.forEach(([title, rows, key, lossCls]) => {
      container.appendChild(el('p', 'cvt-q', title));
      rows.forEach(([k, label]) => {
        const d = s[key][k];
        container.appendChild(el('div', 'cvt-stat', `<span>${label}</span><span>${d.n} · ${d.pct}%</span>`));
        const bar = el('div', 'cvt-bar'); const fill = el('div', 'cvt-fill ' + lossCls);
        fill.style.width = d.pct + '%'; bar.appendChild(fill); container.appendChild(bar);
      });
      if (key === 'how_you_won' && (s.aggressive_split.clean_winners || s.aggressive_split.forced_errors)) {
        container.appendChild(el('div', 'cvt-stat',
          `<span style="color:#8fbf9a">↳ aggressive split</span><span style="color:#8fbf9a">${s.aggressive_split.clean_winners} winners · ${s.aggressive_split.forced_errors} forced errors</span>`));
      }
    });

    if (s.shot_mix.length) {
      container.appendChild(el('p', 'cvt-q', 'Shot mix'));
      s.shot_mix.forEach(r => container.appendChild(el('div', 'cvt-stat',
        `<span>${r.wing.toUpperCase()} ${M.SHOT_LABELS[r.shot] || r.shot}</span><span>${r.n} hit · <span style="color:${r.errors ? '#e8975a' : '#d9f64b'}">${r.errors} err</span> · ${r.in_play_pct}% in</span>`)));
    }

    if (s.shot_map.length) {
      container.appendChild(el('p', 'cvt-q', 'Shot selection & court position'));
      M.ZONES.forEach(z => {
        const inZone = s.shot_map.filter(x => x.zone === z);
        if (!inZone.length) return;
        const w = inZone.filter(x => x.outcome === 'aggressive_win').length;
        container.appendChild(el('div', 'cvt-stat',
          `<span>${ZONE_LABELS[z]}</span><span><span style="color:#d9f64b">${w} won</span> · <span style="color:#e8975a">${inZone.length - w} errors</span></span>`));
      });
      const byShot = {};
      s.shot_map.forEach(x => {
        if (!x.wing || !x.shot_type) return;
        const k = x.wing.toUpperCase() + ' ' + (M.SHOT_LABELS[x.shot_type] || x.shot_type);
        byShot[k] = byShot[k] || { w: 0, e: 0 };
        x.outcome === 'aggressive_win' ? byShot[k].w++ : byShot[k].e++;
      });
      Object.entries(byShot).sort((a, b) => (b[1].w + b[1].e) - (a[1].w + a[1].e)).forEach(([k, v]) =>
        container.appendChild(el('div', 'cvt-stat',
          `<span>${k}</span><span><span style="color:#d9f64b">${v.w} won</span> · <span style="color:#e8975a">${v.e} errors</span></span>`)));
    }

    if (match.points.length) {
      container.appendChild(el('p', 'cvt-q', 'Point log'));
      const causeL = { consistency: 'consistency', aggressive: 'aggressive', serve: 'serve', opp_double_fault: 'opp. DF' };
      const endL = { winner: '🎯', forced_error: '💪', unforced_error: '❌', double_fault: '🎁' };
      match.points.slice().reverse().forEach(p => {
        const shot = p.shot_type ? ` · ${(p.wing || '').toUpperCase()} ${(M.SHOT_LABELS[p.shot_type] || p.shot_type)}` : '';
        const srv = p.serve ? ` · ${p.serve.replace(/_/g, ' ')}` : '';
        const vt = (p.video_time != null)
          ? ` <span style="color:#4a7a56">· ${String(Math.floor(p.video_time / 60)).padStart(2, '0')}:${String(Math.floor(p.video_time % 60)).padStart(2, '0')}</span>` : '';
        const row = el('div', 'cvt-stat',
          `<span>#${p.n} ${match.players[p.winner]} ${endL[p.end_detail] || ''}</span><span>${causeL[p.win_cause]}${srv}${shot}${vt}</span>`);
        if (opts.onPointClick && p.video_time != null) {
          row.style.cursor = 'pointer';
          row.onclick = () => opts.onPointClick(p);
        }
        container.appendChild(row);
      });
    }

    const foot = el('div', 'cvt-cards');
    foot.style.marginTop = '12px';
    foot.innerHTML =
      `<div class="cvt-card"><b>${s.serve.service_points ? s.serve.first_serve_pct + '%' : '–'}</b><span>1st serve %</span></div>
       <div class="cvt-card"><b>${s.consistency.fh.strokes ? s.consistency.fh.pct + '%' : '–'}</b><span>FH consistency</span></div>
       <div class="cvt-card"><b>${s.consistency.bh.strokes ? s.consistency.bh.pct + '%' : '–'}</b><span>BH consistency</span></div>`;
    container.appendChild(foot);
  }

  // ================= the tagger factory ================================
  function create(opts = {}) {
    const source = opts.source || 'live';
    const floating = !opts.mount;
    let match = null;
    let selZone = null, selWing = null, selShot = null, pending = null;
    let secondServe = false, selFirstServer = 'A';

    const panel = el('div', 'cvt-panel ' + (floating ? 'float' : 'inline') + (opts.compact ? ' compact' : ''));
    panel.innerHTML = `
      <div class="cvt-head">
        <span class="cvt-label" data-r="title">Live tagging</span>
        <span>
          <button class="cvt-x" data-r="undopoint" style="color:#e8975a">↩ undo point</button>
          <button class="cvt-x" data-r="newmatch">＋ new match</button>
          <button class="cvt-x" data-r="viewstats">📊 stats</button>
          ${floating ? '<button class="cvt-x" data-r="close">✕ close</button>' : ''}
        </span>
      </div>

      <div class="cvt-sec" data-s="setup">
        <p class="cvt-q">Match setup</p>
        <p class="cvt-label" style="margin-bottom:4px">Your player</p>
        <input class="cvt-input" data-r="nameA" placeholder="e.g. Mali S." />
        <p class="cvt-label" style="margin-bottom:4px">Opponent</p>
        <input class="cvt-input" data-r="nameB" placeholder="e.g. K. Boon" />
        <p class="cvt-q" style="font-size:13px">Who serves first?</p>
        <div class="cvt-grid2" data-r="firstserver"></div>
        <button class="cvt-save" data-r="start">Start match</button>
      </div>

      <div data-s="live" style="display:none">
        <div class="cvt-score" data-r="scoreboard"></div>
        <div class="cvt-ends" data-r="ends">🔄 Change ends</div>
        <div class="cvt-row">
          <span style="font-size:12px;color:#9fc9aa" data-r="server"></span>
          <button class="cvt-btn cvt-pill cvt-serve" data-pl="t">1st in-T</button>
          <button class="cvt-btn cvt-pill cvt-serve" data-pl="body">1st in-B</button>
          <button class="cvt-btn cvt-pill cvt-serve" data-pl="angle">1st in-A</button>
          <button class="cvt-btn cvt-pill" data-r="sfault">Fault</button>
          <button class="cvt-btn cvt-pill cvt-acebtn" data-pl="t">⚡Ace-T</button>
          <button class="cvt-btn cvt-pill cvt-acebtn" data-pl="body">⚡Ace-B</button>
          <button class="cvt-btn cvt-pill cvt-acebtn" data-pl="angle">⚡Ace-A</button>
          <button class="cvt-btn cvt-pill" data-r="undoserve" style="margin-left:auto">↩ undo serve</button>
        </div>
        <div class="cvt-row" style="justify-content:space-between">
          <span style="font-size:12px;color:#9fc9aa" data-r="tally">Rally: FH 0 · BH 0</span>
          <button class="cvt-btn cvt-pill" data-r="undo">↩ undo</button>
        </div>
        <div class="cvt-wings">
          <div><p class="cvt-wingtitle" style="color:#d9f64b">FH · forehand</p><div class="cvt-shotgrid">${cellsHTML('fh')}</div></div>
          <div><p class="cvt-wingtitle">BH · backhand</p><div class="cvt-shotgrid">${cellsHTML('bh')}</div></div>
        </div>
        <button class="cvt-save" data-r="end">Rally ended →</button>
      </div>

      <div class="cvt-sec" data-s="point">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <p class="cvt-q" style="margin:0">Who ended the point?</p>
          <button class="cvt-x" data-r="backlive">← back</button>
        </div>
        <div class="cvt-endgrid" data-r="endgrid"></div>
        <button class="cvt-x" data-r="skippt" style="display:block;margin:12px auto 0">✕ skip this point</button>
      </div>

      <div class="cvt-sec" data-s="shot">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <p class="cvt-label" data-r="shothead" style="margin:0"></p>
          <button class="cvt-x" data-r="backpoint">← back</button>
        </div>
        <div class="cvt-chipauto">
          <span style="background:#d9f64b;border-radius:8px;font-size:10px;color:#1c330f;padding:1px 6px">auto</span>
          <b data-r="shotchip">—</b>
          <button class="cvt-x" data-r="changeshot" style="margin-left:auto;text-decoration:underline">change</button>
        </div>
        <div class="cvt-changegrids" data-r="changegrids">
          <div class="cvt-wings">
            <div><p class="cvt-wingtitle" style="font-size:10px;color:#d9f64b">FH</p><div class="cvt-shotgrid">${detailCellsHTML('fh')}</div></div>
            <div><p class="cvt-wingtitle" style="font-size:10px">BH</p><div class="cvt-shotgrid">${detailCellsHTML('bh')}</div></div>
          </div>
        </div>
        <p class="cvt-q">Hit from where?</p>
        <div class="cvt-zone" data-r="zones"></div>
        <button class="cvt-save" data-r="saveshot">Save ✓</button>
        <button class="cvt-x" data-r="skipshot" style="display:block;margin:8px auto 0">skip</button>
      </div>

      <div class="cvt-sec" data-s="stats">
        <div data-r="breakdown"></div>
        <button class="cvt-save" data-r="next">Next point →</button>
      </div>`;

    const $ = r => panel.querySelector('[data-r="' + r + '"]');
    const $s = s => panel.querySelector('[data-s="' + s + '"]');
    const names = () => match.players;
    const SCREENS = ['setup', 'live', 'point', 'shot', 'stats'];
    const show = id => SCREENS.forEach(s => {
      const n = $s(s);
      if (s === 'live') n.style.display = (s === id) ? 'block' : 'none';
      else n.classList.toggle('show', s === id);
    });
    const flash = b => { b.classList.add('sel'); setTimeout(() => b.classList.remove('sel'), 250); };
    const vtime = () => (opts.getVideoTime ? opts.getVideoTime() : null);

    // ---- setup ----
    function buildSetup() {
      const box = $('firstserver'); box.innerHTML = '';
      [['A', 'Your player'], ['B', 'Opponent']].forEach(([k, label]) => {
        const b = el('button', 'cvt-btn' + (k === selFirstServer ? ' sel' : ''), label);
        b.onclick = () => { selFirstServer = k; [...box.children].forEach(c => c.classList.remove('sel')); b.classList.add('sel'); };
        box.appendChild(b);
      });
    }
    $('start').onclick = () => {
      match = M.newMatch({
        playerA: $('nameA').value.trim() || 'Player',
        playerB: $('nameB').value.trim() || 'Opponent',
        server: selFirstServer, source,
        videoName: opts.videoName ? opts.videoName() : null,
      });
      if (source === 'live') window.cvMatch = match;
      M.saveMatch(match); refreshAll(); show('live');
    };
    $('newmatch').onclick = () => { $('title').textContent = 'Match setup'; buildSetup(); show('setup'); };

    // ---- point card ----
    const END_COLS = [['winner', '🎯', 'Winner'], ['forced', '💪', 'Forced err'], ['unforced', '❌', 'Unforced']];
    function buildEndGrid() {
      const g = $('endgrid'); g.innerHTML = '';
      [['A', names().A, 'your player'], ['B', names().B, 'opponent']].forEach(([who, name, role]) => {
        g.appendChild(el('div', 'cvt-endname',
          `<span style="text-align:center;color:#f0f7ec">${name}<br><small style="font-size:9px;color:#8fbf9a;font-weight:400">${role}</small></span>`));
        END_COLS.forEach(([how, icon, label]) => {
          const pt = (how === 'winner')
            ? '<small style="display:block;font-size:9px;color:#d9f64b;margin-top:2px">get pt</small>'
            : '<small style="display:block;font-size:9px;color:#e8975a;margin-top:2px">lost pt</small>';
          const b = el('button', 'cvt-endbtn', `<p>${icon}</p><span>${label}</span>${pt}`);
          b.onclick = () => onPointEnd(who, how);
          g.appendChild(b);
        });
      });
    }
    function endSummary(d) {
      const c = { consistency: 'consistency', serve: 'serve play',
        aggressive: d.endDetail === 'forced_error' ? 'aggressive (forced the error)' : 'aggressive play' };
      return names()[d.winner] + ' wins · ' + (c[d.winCause] || d.winCause);
    }
    function onPointEnd(who, how) {
      const d = M.derivePointEnd(match, who, how);
      const needDetail = (who === 'A') || (who === 'B' && how === 'forced');
      if (needDetail) {
        pending = d;
        const last = M.lastStroke(match);
        selWing = last ? last.wing : null; selShot = last ? last.shot : null; selZone = null;
        openShotCard(d); show('shot');
      } else {
        M.savePoint(match, { winner: d.winner, winCause: d.winCause, endDetail: d.endDetail, videoTime: vtime() });
        backToLive();
      }
    }

    // ---- shot detail ----
    function openShotCard(d) {
      $('shothead').textContent = endSummary(d) + ' · shot detail';
      updateChip();
      $('changegrids').classList.remove('show');
      panel.querySelectorAll('.cvt-dcell').forEach(x =>
        x.classList.toggle('sel', x.dataset.wing === selWing && x.dataset.shot === selShot));
      const z = $('zones'); z.innerHTML = '';
      M.ZONES.forEach(k => {
        const b = el('button', '', ZONE_LABELS[k]);
        b.onclick = () => { selZone = k; [...z.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); };
        z.appendChild(b);
      });
      if (!selWing || !selShot) $('changegrids').classList.add('show');
    }
    const updateChip = () => $('shotchip').textContent = (selWing && selShot)
      ? selWing.toUpperCase() + ' · ' + (M.SHOT_LABELS[selShot] || selShot)
      : 'No shot tapped — pick one';
    $('changeshot').onclick = () => $('changegrids').classList.toggle('show');
    panel.querySelectorAll('.cvt-dcell').forEach(b => b.onclick = e => {
      const c = e.currentTarget;
      selWing = c.dataset.wing; selShot = c.dataset.shot;
      panel.querySelectorAll('.cvt-dcell').forEach(x => x.classList.remove('sel'));
      c.classList.add('sel'); updateChip();
    });
    function finishPending(detail) {
      if (!pending) return;
      M.savePoint(match, { winner: pending.winner, winCause: pending.winCause, endDetail: pending.endDetail, shotDetail: detail, videoTime: vtime() });
      pending = null; backToLive();
    }
    $('saveshot').onclick = () => finishPending((selZone || (selWing && selShot)) ? { zone: selZone, wing: selWing, shotType: selShot } : null);
    $('skipshot').onclick = () => finishPending(null);

    // ---- live screen ----
    function updateLive() {
      if (!match) return;
      const counts = {}; let fh = 0, bh = 0;
      match.current.strokes.forEach(x => {
        const wing = x && x.wing ? x.wing : (x === 'fh' || x === 'bh' ? x : null);
        const shot = x && x.shot ? x.shot : null;
        if (wing === 'fh') fh++; if (wing === 'bh') bh++;
        if (wing && shot) counts[wing + '-' + shot] = (counts[wing + '-' + shot] || 0) + 1;
      });
      panel.querySelectorAll('[data-n]').forEach(n => n.textContent = counts[n.dataset.n] || 0);
      $('tally').textContent = `Rally: FH ${fh} · BH ${bh}`;

      const sc = M.getScore(match);
      $('server').innerHTML = names()[sc.server] + ' serving:' +
        (secondServe ? ' <span style="background:#e8975a;color:#1c330f;border-radius:8px;padding:1px 8px;font-size:10px;font-weight:700">2nd SERVE</span>' : '');
      panel.querySelectorAll('.cvt-serve').forEach(b =>
        b.textContent = (secondServe ? '2nd in-' : '1st in-') + b.dataset.pl.charAt(0).toUpperCase());
      $('title').textContent = (source === 'video' ? 'Studio tagging · Point ' : 'Live tagging · Point ') + (match.points.length + 1);

      const mark = w => (sc.server === w && !sc.finished) ? '⚡' : '';
      const pair = (a, b) => (a >= b ? `<b>${a}</b>` : `<i>${a}</i>`) + '<i>-</i>' + (b >= a ? `<b>${b}</b>` : `<i>${b}</i>`);
      const setsStr = sc.setHistory.map(x => x.A + '-' + x.B).join(' ');
      const hot = /Ad|Deuce/.test(sc.gameScore) || sc.tiebreak;
      $('scoreboard').innerHTML = `<div class="cvt-sb">
          <span class="cvt-sbnames">${mark('A')}${names().A} <i style="color:#8fbf9a;font-style:normal">vs</i> ${mark('B')}${names().B}</span>
          <span class="cvt-sbsmall">SETS ${pair(sc.sets.A, sc.sets.B)}${setsStr ? ` <small style="color:#4a7a56">(${setsStr})</small>` : ''}</span>
          <span class="cvt-sbsmall">GAMES ${pair(sc.games.A, sc.games.B)}</span>
          ${sc.finished ? `<span class="cvt-sbmain">🏆 ${names()[sc.matchWinner]}</span>`
          : `<span class="cvt-sbmain${hot ? ' hot' : ''}${sc.tiebreak ? ' tb' : ''}">${sc.gameScore}</span>`}
        </div>`;
      $('ends').classList.toggle('show', sc.changeEnds && !sc.finished);
    }
    function refreshAll() {
      updateLive();
      if (match) renderBreakdown($('breakdown'), match);
      if (source === 'live' && typeof renderMatchesTab === 'function') {
        const mt = document.getElementById('cv-breakdown');
        if (mt) renderMatchesTab(mt);
      }
    }
    function backToLive() {
      selZone = selWing = selShot = null; pending = null; secondServe = false;
      panel.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
      refreshAll(); M.saveMatch(match); show('live');
    }

    // ---- wiring ----
    panel.querySelectorAll('.cvt-serve').forEach(b => b.onclick = e => {
      M.recordServe(match, 'in', e.currentTarget.dataset.pl);
      panel.querySelectorAll('.cvt-serve').forEach(x => x.classList.remove('sel'));
      e.currentTarget.classList.add('sel'); $('sfault').classList.remove('sel');
    });
    $('sfault').onclick = e => {
      flash(e.currentTarget);
      const r = M.recordServe(match, 'fault');
      if (r.doubleFault) backToLive(); else { secondServe = true; updateLive(); }
    };
    panel.querySelectorAll('.cvt-acebtn').forEach(b => b.onclick = e => {
      flash(e.currentTarget);
      const srv = match.server;
      M.recordServe(match, 'in', e.currentTarget.dataset.pl);
      M.savePoint(match, { winner: srv, winCause: 'serve', endDetail: 'winner', videoTime: vtime() });
      backToLive();
    });
    $('undoserve').onclick = e => {
      const c = match.current;
      if (!c.serve && c.serveFaults === 0) return;
      flash(e.currentTarget);
      c.serve = null; c.serveFaults = 0; c.servePlacement = null; secondServe = false;
      panel.querySelectorAll('.cvt-serve').forEach(x => x.classList.remove('sel'));
      $('sfault').classList.remove('sel'); updateLive();
    };
    panel.querySelectorAll('[data-s="live"] .cvt-cell').forEach(b => b.onclick = e => {
      flash(e.currentTarget);
      M.recordStroke(match, e.currentTarget.dataset.wing, e.currentTarget.dataset.shot);
      updateLive();
    });
    $('undo').onclick = e => {
      if (!match.current.strokes.length) return;
      flash(e.currentTarget); M.undoStroke(match); updateLive();
    };
    $('undopoint').onclick = () => {
      if (!match || !match.points.length) { alert('No points to undo yet'); return; }
      const last = match.points[match.points.length - 1];
      const c = { consistency: 'consistency', aggressive: 'aggressive', serve: 'serve play', opp_double_fault: 'double fault' };
      if (!confirm('Undo point #' + last.n + ' — ' + names()[last.winner] + ' · ' + (c[last.win_cause] || last.win_cause) + '?')) return;
      M.undoLastPoint(match); backToLive();
    };
    $('end').onclick = () => { buildEndGrid(); show('point'); };
    $('skippt').onclick = () => { match.current = { serve: null, serveFaults: 0, strokes: [] }; backToLive(); };
    $('backlive').onclick = () => { updateLive(); show('live'); };
    $('backpoint').onclick = () => { pending = null; buildEndGrid(); show('point'); };
    $('viewstats').onclick = () => { if (!match) return; renderBreakdown($('breakdown'), match); show('stats'); };
    $('next').onclick = () => show('live');

    // ---- floating shell ----
    let fab = null;
    if (floating) {
      fab = el('button', 'cvt-fab', '🎾 Tag match');
      document.body.appendChild(fab);
      document.body.appendChild(panel);
      fab.onclick = () => {
        panel.classList.toggle('open');
        if (!panel.classList.contains('open')) return;
        if (!match) { buildSetup(); show('setup'); } else { refreshAll(); show('live'); }
      };
      $('close').onclick = () => panel.classList.remove('open');
    } else {
      opts.mount.appendChild(panel);
    }

    // ---- load newest match of this source ----
    const mine = M.listMatches().filter(m => (m.source || 'live') === source);
    if (mine.length) match = M.loadMatch(mine[0].id);
    if (match && source === 'live') window.cvMatch = match;
    if (match) { refreshAll(); show('live'); } else { buildSetup(); show('setup'); }

    return {
      el: panel,
      setMatch(m) { match = m; refreshAll(); show('live'); },
      startSetup() { $('title').textContent = 'Match setup'; buildSetup(); show('setup'); },
      refresh: refreshAll,
      getMatch: () => match,
    };
  }

  // ================= MATCHES tab: picker + breakdown ====================
  let pickedId = null;
  function renderMatchesTab(container) {
    if (!container) return;
    const list = M.listMatches();
    container.innerHTML = '';
    if (!list.length) {
      container.appendChild(el('p', 'cvt-label', 'No matches yet — tag one with the 🎾 button or in Video review.'));
      const t = el('div', 'cvt-exp');
      const imp0 = el('button', 'cvt-btn', '📥 Import match (JSON)');
      const f0 = el('input'); f0.type = 'file'; f0.accept = '.json,application/json'; f0.style.display = 'none';
      imp0.onclick = () => f0.click();
      f0.onchange = e => {
        if (!e.target.files.length) return;
        importJSON(e.target.files[0], (err, m) => {
          if (err) { alert('Import failed: ' + err.message); return; }
          pickedId = m.id; renderMatchesTab(container);
        });
      };
      t.appendChild(imp0); t.appendChild(f0);
      container.appendChild(t);
      return;
    }
    if (!pickedId || !list.some(m => m.id === pickedId)) pickedId = list[0].id;

    const tools = el('div', 'cvt-exp');
    const imp = el('button', 'cvt-btn', '📥 Import match (JSON)');
    const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.style.display = 'none';
    imp.onclick = () => fileIn.click();
    fileIn.onchange = e => {
      if (!e.target.files.length) return;
      importJSON(e.target.files[0], (err, m) => {
        if (err) { alert('Import failed: ' + err.message); return; }
        pickedId = m.id; renderMatchesTab(container);
        alert('Imported: ' + m.players.A + ' vs ' + m.players.B + ' · ' + m.points.length + ' points');
      });
    };
    tools.appendChild(imp); tools.appendChild(fileIn);
    const del = el('button', 'cvt-btn', '🗑 Delete selected');
    del.style.color = '#e8975a';
    del.onclick = () => {
      const m = list.find(x => x.id === pickedId); if (!m) return;
      if (!confirm('Delete ' + m.players.A + ' vs ' + m.players.B + ' (' + m.points + ' points)? This cannot be undone.')) return;
      M.deleteMatch(pickedId); pickedId = null; renderMatchesTab(container);
    };
    tools.appendChild(del);
    container.appendChild(tools);

    const box = el('div', 'cvt-mlist');
    list.forEach(m => {
      const b = el('button', 'cvt-mitem' + (m.id === pickedId ? ' sel' : ''),
        `<span class="cvt-mtag ${m.source}">${m.source === 'video' ? 'VIDEO' : 'LIVE'}</span>
         <span style="flex:1;min-width:0">
           <span style="font-size:13px;font-weight:600">${m.players.A} vs ${m.players.B}</span><br>
           <small style="font-size:11px;color:#8fbf9a">${new Date(m.createdAt).toLocaleString()} · ${m.points} points${m.videoName ? ' · ' + m.videoName : ''}</small>
         </span>
         <span style="font-size:11px;color:#8fbf9a">view →</span>`);
      b.onclick = () => { pickedId = m.id; renderMatchesTab(container); };
      box.appendChild(b);
    });
    container.appendChild(box);

    const detail = el('div');
    container.appendChild(detail);
    const full = M.loadMatch(pickedId);
    if (full) renderBreakdown(detail, full);
  }

  // ================= boot ==============================================
  window.CourtVisionTagger = { create, renderBreakdown, renderMatchesTab,
    exportCSV, exportJSON, shareCSV, matchToCSV, importJSON };
  // courtside instance (floating 🎾 button) — always on
  window.cvTagger = create({ source: 'live' });
  // MATCHES tab
  const mt = document.getElementById('cv-breakdown');
  if (mt) renderMatchesTab(mt);
})();
