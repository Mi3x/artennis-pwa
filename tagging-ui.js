/* ============================================================
   CourtVision — tagging-ui.js  (v4)
   New in v4:
   - "Rally ended" opens a 2×3 one-tap card:
       rows = players, columns = Winner / Forced err / Unforced.
     One tap derives winner + cause (serve play auto-detected when
     the server won with zero rally taps) and saves the point.
   - Shot detail card streamlined: auto chip with the final shot
     from the last grid tap + "change" link (grids expand only on
     demand) + zone strip + Save. Shown only when the tracked
     player's shot ended the rally (her winner / her error / her
     forcing shot on opponent's forced error).
   Keeps everything else: 3×3 grids with per-cell counts, serve
   placement, auto scoring, stats page, charts, MATCHES mirror.
   Requires match-logic.js (v4) and charts.js loaded first.
   ============================================================ */
(function () {
  const M = window.CourtVisionMatch;
  if (!M) { console.error('tagging-ui: load match-logic.js first'); return; }

  let match = null;
  const saved = M.listMatches();
  if (saved.length) match = M.loadMatch(saved[0].id);
  window.cvMatch = match;

  const css = `
  .cvt-fab{position:fixed;bottom:84px;right:16px;z-index:9998;background:#d9f64b;color:#1c330f;
    border:none;border-radius:999px;padding:12px 18px;font-weight:600;font-size:14px;
    box-shadow:0 4px 14px rgba(0,0,0,.4);cursor:pointer;font-family:inherit}
  .cvt-panel{position:fixed;inset:auto 0 0 0;max-height:86vh;overflow-y:auto;z-index:9999;
    background:#12291a;border-radius:20px 20px 0 0;padding:18px 16px 28px;
    box-shadow:0 -6px 30px rgba(0,0,0,.5);font-family:inherit;color:#f0f7ec;display:none}
  .cvt-panel.open{display:block}
  .cvt-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .cvt-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .cvt-label{font-size:11px;letter-spacing:1.5px;color:#8fbf9a;text-transform:uppercase}
  .cvt-q{font-size:15px;font-weight:600;margin:6px 0 8px}
  .cvt-btn{background:#1d4028;border:1px solid #2c5638;color:#cfe6d4;border-radius:10px;
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
    color:#cfe6d4;font-size:12px;padding:13px 4px;cursor:pointer;font-family:inherit}
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
  .cvt-score{display:flex;gap:14px;align-items:center;background:#1d4028;border-radius:12px;
    padding:10px 14px;margin-bottom:12px;font-size:13px;flex-wrap:wrap}
  .cvt-score b{color:#d9f64b;font-size:16px}
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
  .cvt-endgrid{display:grid;grid-template-columns:76px 1fr 1fr 1fr;gap:6px;align-items:stretch}
  .cvt-endname{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600}
  .cvt-endbtn{background:#1d4028;border:1px solid #2c5638;border-radius:12px;padding:14px 4px;
    text-align:center;cursor:pointer;font-family:inherit;color:#cfe6d4}
  .cvt-endbtn p{margin:0;font-size:18px}
  .cvt-endbtn span{display:block;font-size:11px;margin-top:3px}
  .cvt-chipauto{display:flex;align-items:center;gap:8px;background:#2e4a1f;border:1.5px solid #d9f64b;
    border-radius:12px;padding:12px 14px;margin-bottom:14px}
  .cvt-chipauto b{font-size:15px;color:#d9f64b}
  .cvt-changegrids{display:none;margin-bottom:12px}
  .cvt-changegrids.show{display:block}
  .cvt-acebtn{background:#d9f64b;color:#1c330f;font-weight:600;border-color:#d9f64b}
  .cvt-acebtn.sel{border-color:#f0f7ec;border-width:2px}
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
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const names = () => match.players;

  let selZone = null, selWing = null, selShot = null;
  let pending = null; // derived point end waiting for shot detail
  let secondServe = false;

  const fab = el('button', 'cvt-fab', '🎾 Tag match');
  const panel = el('div', 'cvt-panel');
  document.body.appendChild(fab); document.body.appendChild(panel);

  const cellsHTML = (wing) => M.SHOT_TYPES.map(sh =>
    `<button class="cvt-cell" data-wing="${wing}" data-shot="${sh}">${M.SHOT_LABELS[sh]}<span class="n" id="cvt-n-${wing}-${sh}">0</span></button>`
  ).join('');
  const detailCellsHTML = (wing) => M.SHOT_TYPES.map(sh =>
    `<button class="cvt-cell cvt-dcell" data-wing="${wing}" data-shot="${sh}">${M.SHOT_LABELS[sh]}</button>`
  ).join('');

  panel.innerHTML = `
    <div class="cvt-head">
      <span class="cvt-label" id="cvt-title">Live tagging</span>
      <span>
        <button class="cvt-x" id="cvt-undopoint" style="color:#e8975a">↩ undo point</button>
        <button class="cvt-x" id="cvt-newmatch">＋ new match</button>
        <button class="cvt-x" id="cvt-viewstats">📊 stats</button>
        <button class="cvt-x" id="cvt-close">✕ close</button>
      </span>
    </div>

    <div class="cvt-sec" id="cvt-setup">
      <p class="cvt-q">Match setup</p>
      <p class="cvt-label" style="margin-bottom:4px">Your player</p>
      <input class="cvt-input" id="cvt-nameA" placeholder="e.g. Mali S." />
      <p class="cvt-label" style="margin-bottom:4px">Opponent</p>
      <input class="cvt-input" id="cvt-nameB" placeholder="e.g. K. Boon" />
      <p class="cvt-q" style="font-size:13px">Who serves first?</p>
      <div class="cvt-grid2" id="cvt-firstserver"></div>
      <button class="cvt-save" id="cvt-start">Start match</button>
    </div>

    <div id="cvt-live" style="display:none">
      <div class="cvt-score" id="cvt-scoreboard"></div>
      <div class="cvt-ends" id="cvt-ends">🔄 Change ends</div>
      <div class="cvt-row">
        <span style="font-size:12px;color:#9fc9aa" id="cvt-server"></span>
        <button class="cvt-btn cvt-pill cvt-serve" data-pl="t">1st in-T</button>
        <button class="cvt-btn cvt-pill cvt-serve" data-pl="body">1st in-B</button>
        <button class="cvt-btn cvt-pill cvt-serve" data-pl="angle">1st in-A</button>
        <button class="cvt-btn cvt-pill" id="cvt-sfault">Fault</button>
        <button class="cvt-btn cvt-pill cvt-acebtn" data-pl="t">⚡Ace-T</button>
        <button class="cvt-btn cvt-pill cvt-acebtn" data-pl="body">⚡Ace-B</button>
        <button class="cvt-btn cvt-pill cvt-acebtn" data-pl="angle">⚡Ace-A</button>
        <button class="cvt-btn cvt-pill" id="cvt-undoserve" style="margin-left:auto">↩ undo serve</button>
      </div>
      <div class="cvt-row" style="justify-content:space-between">
        <span style="font-size:12px;color:#9fc9aa" id="cvt-tally">Rally: FH 0 · BH 0</span>
        <button class="cvt-btn cvt-pill" id="cvt-undo">↩ undo</button>
      </div>
      <div class="cvt-wings">
        <div>
          <p class="cvt-wingtitle" style="color:#d9f64b">FH · forehand</p>
          <div class="cvt-shotgrid">${cellsHTML('fh')}</div>
        </div>
        <div>
          <p class="cvt-wingtitle">BH · backhand</p>
          <div class="cvt-shotgrid">${cellsHTML('bh')}</div>
        </div>
      </div>
      <button class="cvt-save" id="cvt-end">Rally ended →</button>
    </div>

    <div class="cvt-sec" id="cvt-point">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <p class="cvt-q" style="margin:0">Who ended the point?</p>
        <button class="cvt-x" id="cvt-backlive">← back</button>
      </div>
      <div class="cvt-endgrid" id="cvt-endgrid"></div>
      <button class="cvt-x" id="cvt-skippt" style="display:block;margin:12px auto 0">✕ skip this point</button>
    </div>

    <div class="cvt-sec" id="cvt-shot">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <p class="cvt-label" id="cvt-shothead" style="margin:0"></p>
        <button class="cvt-x" id="cvt-backpoint">← back</button>
      </div>
      <div class="cvt-chipauto">
        <span style="background:#d9f64b;border-radius:8px;font-size:10px;color:#1c330f;padding:1px 6px">auto</span>
        <b id="cvt-shotchip">—</b>
        <button class="cvt-x" id="cvt-changeshot" style="margin-left:auto;text-decoration:underline">change</button>
      </div>
      <div class="cvt-changegrids" id="cvt-changegrids">
        <div class="cvt-wings">
          <div><p class="cvt-wingtitle" style="font-size:10px;color:#d9f64b">FH</p><div class="cvt-shotgrid" id="cvt-detail-fh">${detailCellsHTML('fh')}</div></div>
          <div><p class="cvt-wingtitle" style="font-size:10px">BH</p><div class="cvt-shotgrid" id="cvt-detail-bh">${detailCellsHTML('bh')}</div></div>
        </div>
      </div>
      <p class="cvt-q">Hit from where?</p>
      <div class="cvt-zone" id="cvt-zones"></div>
      <button class="cvt-save" id="cvt-saveshot">Save ✓</button>
      <button class="cvt-x" id="cvt-skipshot" style="display:block;margin:8px auto 0">skip</button>
    </div>

    <div class="cvt-sec" id="cvt-stats">
      <p class="cvt-label" style="margin-bottom:10px" id="cvt-statshead">Point breakdown</p>
      <div class="cvt-cards">
        <div class="cvt-card"><b id="cvt-wp">0</b><span>Win points</span></div>
        <div class="cvt-card"><b id="cvt-lp" style="color:#f0f7ec">0</b><span>Lost points</span></div>
        <div class="cvt-card hl"><b id="cvt-bp">0</b><span>Balance point</span></div>
      </div>
      <div id="cvt-visuals"></div>
      <div id="cvt-bars"></div>
      <div id="cvt-shotmix"></div>
      <div id="cvt-shotmap"></div>
      <div id="cvt-log"></div>
      <button class="cvt-save" id="cvt-next">Next point →</button>
      <div class="cvt-cards" style="margin-top:12px">
        <div class="cvt-card"><b id="cvt-s1">–</b><span>1st serve %</span></div>
        <div class="cvt-card"><b id="cvt-fhc">–</b><span>FH consistency</span></div>
        <div class="cvt-card"><b id="cvt-bhc">–</b><span>BH consistency</span></div>
      </div>
    </div>
  `;

  const $ = id => panel.querySelector('#' + id);

  const SCREENS = ['cvt-setup', 'cvt-live', 'cvt-point', 'cvt-shot', 'cvt-stats'];
  function showScreen(id) {
    SCREENS.forEach(s => {
      const n = $(s);
      if (s === 'cvt-live') n.style.display = (s === id) ? 'block' : 'none';
      else n.classList.toggle('show', s === id);
    });
  }

  // ---- setup ------------------------------------------------------------
  let selFirstServer = 'A';
  function buildSetup() {
    const box = $('cvt-firstserver'); box.innerHTML = '';
    [['A', 'Your player'], ['B', 'Opponent']].forEach(([k, label]) => {
      const b = el('button', 'cvt-btn' + (k === selFirstServer ? ' sel' : ''), label);
      b.onclick = () => { selFirstServer = k; [...box.children].forEach(c => c.classList.remove('sel')); b.classList.add('sel'); };
      box.appendChild(b);
    });
  }
  $('cvt-start').onclick = () => {
    const a = $('cvt-nameA').value.trim() || 'Player';
    const b = $('cvt-nameB').value.trim() || 'Opponent';
    match = M.newMatch({ playerA: a, playerB: b, server: selFirstServer });
    window.cvMatch = match;
    M.saveMatch(match);
    updateLive(); renderStats(); showScreen('cvt-live');
  };
  $('cvt-newmatch').onclick = () => { $('cvt-title').textContent = 'Match setup'; buildSetup(); showScreen('cvt-setup'); };

  // ---- the 2x3 one-tap point card --------------------------------------------
  const END_COLS = [
    ['winner', '🎯', 'Winner'],
    ['forced', '💪', 'Forced err'],
    ['unforced', '❌', 'Unforced'],
  ];
  function buildEndGrid() {
    const g = $('cvt-endgrid'); g.innerHTML = '';
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
  function onPointEnd(who, how) {
    const d = M.derivePointEnd(match, who, how);
    // shot detail only when the tracked player's (A) shot is the story:
    // A ended the rally, or A forced B's error
    const detailNeeded = (who === 'A') || (who === 'B' && how === 'forced');
    if (detailNeeded) {
      pending = d;
      const last = M.lastStroke(match);
      selWing = last ? last.wing : null;
      selShot = last ? last.shot : null;
      selZone = null;
      openShotCard(d);
      showScreen('cvt-shot');
    } else {
      M.savePoint(match, { winner: d.winner, winCause: d.winCause, endDetail: d.endDetail });
      showLive();
    }
  }
  function endSummary(d) {
    const causeL = { consistency: 'consistency', aggressive: d.endDetail === 'forced_error' ? 'aggressive (forced the error)' : 'aggressive play', serve: 'serve play' };
    return names()[d.winner] + ' wins · ' + (causeL[d.winCause] || d.winCause);
  }

  // ---- shot detail (auto chip + change + zone) ---------------------------------
  function openShotCard(d) {
    $('cvt-shothead').textContent = endSummary(d) + ' · shot detail';
    updateShotChip();
    $('cvt-changegrids').classList.remove('show');
    panel.querySelectorAll('.cvt-dcell').forEach(x => {
      x.classList.toggle('sel', x.dataset.wing === selWing && x.dataset.shot === selShot);
    });
    const zoneLabels = { net_play: 'Net play', middle_court: 'Middle court', ahead_baseline: 'Ahead of baseline', behind_baseline: 'Behind baseline' };
    const z = $('cvt-zones'); z.innerHTML = '';
    M.ZONES.forEach(k => {
      const b = el('button', '', zoneLabels[k]);
      b.onclick = () => { selZone = k; [...z.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); };
      z.appendChild(b);
    });
    if (!selWing || !selShot) $('cvt-changegrids').classList.add('show');
  }
  function updateShotChip() {
    $('cvt-shotchip').textContent = (selWing && selShot)
      ? selWing.toUpperCase() + ' · ' + (M.SHOT_LABELS[selShot] || selShot)
      : 'No shot tapped — pick one';
  }
  $('cvt-changeshot').onclick = () => $('cvt-changegrids').classList.toggle('show');
  panel.querySelectorAll('.cvt-dcell').forEach(b => {
    b.onclick = (e) => {
      const c = e.currentTarget;
      selWing = c.dataset.wing; selShot = c.dataset.shot;
      panel.querySelectorAll('.cvt-dcell').forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
      updateShotChip();
    };
  });
  function finishPending(detail) {
    if (!pending) return;
    M.savePoint(match, { winner: pending.winner, winCause: pending.winCause, endDetail: pending.endDetail, shotDetail: detail });
    pending = null;
    showLive();
  }
  $('cvt-saveshot').onclick = () => finishPending(
    (selZone || (selWing && selShot)) ? { zone: selZone, wing: selWing, shotType: selShot } : null);
  $('cvt-skipshot').onclick = () => finishPending(null);

  // ---- stats -----------------------------------------------------------------
  const BAR_DEFS = [
    ['How you won', [['consistency', 'Consistency play'], ['aggressive', 'Aggressive play'], ['serve', 'Serve play'], ['opp_double_faults', 'Opp. double faults']], 'how_you_won', ''],
    ['How you lost', [['your_unforced_errors', 'Your unforced errors'], ['opp_aggressive', 'Opp. aggressive play'], ['opp_serve', 'Opp. serve'], ['your_double_faults', 'Your double faults']], 'how_you_lost', 'loss'],
  ];
  function renderStats() {
    if (!match) return;
    const s = M.getStats(match);
    $('cvt-statshead').textContent = 'Point breakdown · ' + names().A + ' vs ' + names().B +
      ' · ' + new Date(match.createdAt).toLocaleDateString();
    $('cvt-wp').textContent = s.win_points;
    $('cvt-lp').textContent = s.lost_points;
    $('cvt-bp').textContent = (s.balance_point >= 0 ? '+' : '') + s.balance_point;

    if (window.CourtVisionCharts) CourtVisionCharts.renderInto($('cvt-visuals'), match);

    const box = $('cvt-bars'); box.innerHTML = '';
    BAR_DEFS.forEach(([title, rows, key, lossCls]) => {
      box.appendChild(el('p', 'cvt-q', title));
      rows.forEach(([k, label]) => {
        const d = s[key][k];
        box.appendChild(el('div', 'cvt-stat', `<span>${label}</span><span>${d.n} · ${d.pct}%</span>`));
        const bar = el('div', 'cvt-bar'); const fill = el('div', 'cvt-fill ' + lossCls);
        fill.style.width = d.pct + '%'; bar.appendChild(fill); box.appendChild(bar);
      });
      if (key === 'how_you_won' && (s.aggressive_split.clean_winners || s.aggressive_split.forced_errors)) {
        box.appendChild(el('div', 'cvt-stat',
          `<span style="color:#8fbf9a">↳ aggressive split</span><span style="color:#8fbf9a">${s.aggressive_split.clean_winners} winners · ${s.aggressive_split.forced_errors} forced errors</span>`));
      }
    });

    const sx = $('cvt-shotmix'); sx.innerHTML = '';
    if (s.shot_mix.length) {
      sx.appendChild(el('p', 'cvt-q', 'Shot mix'));
      s.shot_mix.forEach(r => {
        sx.appendChild(el('div', 'cvt-stat',
          `<span>${r.wing.toUpperCase()} ${M.SHOT_LABELS[r.shot] || r.shot}</span><span>${r.n} hit · <span style="color:${r.errors ? '#e8975a' : '#d9f64b'}">${r.errors} err</span> · ${r.in_play_pct}% in</span>`));
      });
    }

    const zl = { net_play: 'Net play', middle_court: 'Middle court', ahead_baseline: 'Ahead of baseline', behind_baseline: 'Behind baseline' };
    const sm = $('cvt-shotmap'); sm.innerHTML = '';
    if (s.shot_map.length) {
      sm.appendChild(el('p', 'cvt-q', 'Shot selection & court position'));
      M.ZONES.forEach(z => {
        const inZone = s.shot_map.filter(x => x.zone === z);
        if (!inZone.length) return;
        const w = inZone.filter(x => x.outcome === 'aggressive_win').length;
        const e = inZone.length - w;
        sm.appendChild(el('div', 'cvt-stat',
          `<span>${zl[z]}</span><span><span style="color:#d9f64b">${w} won</span> · <span style="color:#e8975a">${e} errors</span></span>`));
      });
      const byShot = {};
      s.shot_map.forEach(x => {
        if (!x.wing || !x.shot_type) return;
        const k = x.wing.toUpperCase() + ' ' + (M.SHOT_LABELS[x.shot_type] || x.shot_type);
        byShot[k] = byShot[k] || { w: 0, e: 0 };
        x.outcome === 'aggressive_win' ? byShot[k].w++ : byShot[k].e++;
      });
      Object.entries(byShot).sort((a, b) => (b[1].w + b[1].e) - (a[1].w + a[1].e)).forEach(([k, v]) => {
        sm.appendChild(el('div', 'cvt-stat',
          `<span>${k}</span><span><span style="color:#d9f64b">${v.w} won</span> · <span style="color:#e8975a">${v.e} errors</span></span>`));
      });
    }

    const lg = $('cvt-log'); lg.innerHTML = '';
    if (match.points.length) {
      lg.appendChild(el('p', 'cvt-q', 'Point log'));
      const causeL = { consistency: 'consistency', aggressive: 'aggressive', serve: 'serve', opp_double_fault: 'opp. DF' };
      const endL = { winner: '🎯', forced_error: '💪', unforced_error: '❌', double_fault: '🎁' };
      match.points.slice().reverse().forEach(p => {
        const who = match.players[p.winner];
        const shot = p.shot_type ? ` · ${(p.wing || '').toUpperCase()} ${(M.SHOT_LABELS[p.shot_type] || p.shot_type)}` : '';
        const srv = p.serve ? ` · ${p.serve.replace(/_/g, ' ')}` : '';
        const ed = p.end_detail ? ' ' + (endL[p.end_detail] || '') : '';
        lg.appendChild(el('div', 'cvt-stat',
          `<span>#${p.n} ${who}${ed}</span><span>${causeL[p.win_cause]}${srv}${shot}</span>`));
      });
    }

    $('cvt-s1').textContent = s.serve.service_points ? s.serve.first_serve_pct + '%' : '–';
    $('cvt-fhc').textContent = s.consistency.fh.strokes ? s.consistency.fh.pct + '%' : '–';
    $('cvt-bhc').textContent = s.consistency.bh.strokes ? s.consistency.bh.pct + '%' : '–';

    const mount = document.getElementById('cv-breakdown');
    if (mount) {
      const c = $('cvt-stats').cloneNode(true);
      c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      c.classList.add('show');
      const nb = c.querySelector('.cvt-save'); if (nb) nb.remove();
      mount.replaceChildren(c);
    }
  }

  // ---- live screen / scoreboard --------------------------------------------------
  function updateLive() {
    if (!match) return;
    const counts = {};
    let fh = 0, bh = 0;
    match.current.strokes.forEach(x => {
      const wing = x && x.wing ? x.wing : (x === 'fh' || x === 'bh' ? x : null);
      const shot = x && x.shot ? x.shot : null;
      if (wing === 'fh') fh++;
      if (wing === 'bh') bh++;
      if (wing && shot) { const k = wing + '-' + shot; counts[k] = (counts[k] || 0) + 1; }
    });
    M.WINGS.forEach(w => M.SHOT_TYPES.forEach(sh => {
      const n = panel.querySelector('#cvt-n-' + w + '-' + sh);
      if (n) n.textContent = counts[w + '-' + sh] || 0;
    }));
    $('cvt-tally').textContent = `Rally: FH ${fh} · BH ${bh}`;

    const sc = M.getScore(match);
    $('cvt-server').innerHTML = names()[sc.server] + ' serving:' +
      (secondServe ? ' <span style="background:#e8975a;color:#1c330f;border-radius:8px;padding:1px 8px;font-size:10px;font-weight:700">2nd SERVE</span>' : '');
    panel.querySelectorAll('.cvt-serve').forEach(b => {
      b.textContent = (secondServe ? '2nd in-' : '1st in-') + b.dataset.pl.charAt(0).toUpperCase();
    });
    $('cvt-title').textContent = 'Live tagging · Point ' + (match.points.length + 1);

    // ---- scoreboard: game score is the hero, sets/games are context ----
    const srvMark = w => (sc.server === w && !sc.finished) ? '⚡' : '';
    const pair = (a, b) => {
      const A = a >= b ? `<b>${a}</b>` : `<i>${a}</i>`;
      const B = b >= a ? `<b>${b}</b>` : `<i>${b}</i>`;
      return A + '<i>-</i>' + B;
    };
    const setsStr = sc.setHistory.map(x => x.A + '-' + x.B).join(' ');
    // Ad / Deuce / tiebreak = pressure moments -> pulse
    const hot = /Ad|Deuce/.test(sc.gameScore) || sc.tiebreak;
    const mainCls = 'cvt-sbmain' + (hot && !sc.finished ? ' hot' : '') + (sc.tiebreak ? ' tb' : '');
    $('cvt-scoreboard').innerHTML = `<div class="cvt-sb">
        <span class="cvt-sbnames">${srvMark('A')}${names().A} <i style="color:#8fbf9a;font-style:normal">vs</i> ${srvMark('B')}${names().B}</span>
        <span class="cvt-sbsmall">SETS ${pair(sc.sets.A, sc.sets.B)}${setsStr ? ` <small style="color:#4a7a56">(${setsStr})</small>` : ''}</span>
        <span class="cvt-sbsmall">GAMES ${pair(sc.games.A, sc.games.B)}</span>
        ${sc.finished
        ? `<span class="cvt-sbmain">🏆 ${names()[sc.matchWinner]}</span>`
        : `<span class="${mainCls}">${sc.gameScore}</span>`}
      </div>`;
    $('cvt-ends').classList.toggle('show', sc.changeEnds && !sc.finished);
  }

  function resetSelections() {
    selZone = selWing = selShot = null;
    pending = null;
    panel.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
  }
  function showLive() {
    resetSelections(); secondServe = false; updateLive(); renderStats();
    M.saveMatch(match);
    showScreen('cvt-live');
  }

  // ---- wiring ------------------------------------------------------------------
  function flash(btn) { btn.classList.add('sel'); setTimeout(() => btn.classList.remove('sel'), 250); }

  fab.onclick = () => {
    panel.classList.toggle('open');
    if (!panel.classList.contains('open')) return;
    if (!match) { buildSetup(); showScreen('cvt-setup'); }
    else { updateLive(); renderStats(); showScreen('cvt-live'); }
  };
  $('cvt-close').onclick = () => panel.classList.remove('open');
  $('cvt-viewstats').onclick = () => { if (!match) return; renderStats(); showScreen('cvt-stats'); };
  $('cvt-next').onclick = () => showScreen('cvt-live');

  panel.querySelectorAll('.cvt-serve').forEach(b => {
    b.onclick = (e) => {
      M.recordServe(match, 'in', e.target.dataset.pl);
      panel.querySelectorAll('.cvt-serve').forEach(x => x.classList.remove('sel'));
      e.target.classList.add('sel');
      $('cvt-sfault').classList.remove('sel');
    };
  });
  $('cvt-sfault').onclick = (e) => {
    flash(e.target);
    const r = M.recordServe(match, 'fault');
    if (r.doubleFault) showLive(); else { secondServe = true; updateLive(); }
  };

  // ---- Ace fast road: one tap = serve-play point saved ----
  panel.querySelectorAll('.cvt-acebtn').forEach(b => {
    b.onclick = (e) => {
      const cell = e.currentTarget;
      flash(cell);
      const srv = match.server;
      M.recordServe(match, 'in', cell.dataset.pl); // 1st_in or 2nd_in + placement
      M.savePoint(match, { winner: srv, winCause: 'serve', endDetail: 'winner' });
      showLive();
    };
  });

  // ---- undo serve: clears this point's serve state (fault taken back) ----
  $('cvt-undoserve').onclick = (e) => {
    const cur = match.current;
    if (!cur.serve && cur.serveFaults === 0) return; // nothing to undo
    flash(e.currentTarget);
    cur.serve = null;
    cur.serveFaults = 0;
    cur.servePlacement = null;
    secondServe = false;
    panel.querySelectorAll('.cvt-serve').forEach(x => x.classList.remove('sel'));
    $('cvt-sfault').classList.remove('sel');
    updateLive();
  };

  // ---- undo point: removes the last SAVED point; score rewinds itself ----
  $('cvt-undopoint').onclick = () => {
    if (!match || !match.points.length) { alert('No points to undo yet'); return; }
    const last = match.points[match.points.length - 1];
    const causeL = { consistency: 'consistency', aggressive: 'aggressive', serve: 'serve play', opp_double_fault: 'double fault' };
    const ok = confirm('Undo point #' + last.n + ' — ' + names()[last.winner] + ' · ' + (causeL[last.win_cause] || last.win_cause) + '?');
    if (!ok) return;
    M.undoLastPoint(match);
    showLive();
  };

  // ---- back buttons (nothing saved yet at these steps) ----
  $('cvt-backlive').onclick = () => { updateLive(); showScreen('cvt-live'); };
  $('cvt-backpoint').onclick = () => { pending = null; buildEndGrid(); showScreen('cvt-point'); };

  panel.querySelectorAll('#cvt-live .cvt-cell').forEach(b => {
    b.onclick = (e) => {
      const cell = e.currentTarget;
      flash(cell);
      M.recordStroke(match, cell.dataset.wing, cell.dataset.shot);
      updateLive();
    };
  });
  $('cvt-undo').onclick = (e) => {
    if (match.current.strokes.length === 0) return;
    flash(e.currentTarget);
    M.undoStroke(match);
    updateLive();
  };

  $('cvt-end').onclick = () => { buildEndGrid(); showScreen('cvt-point'); };
  $('cvt-skippt').onclick = () => { match.current = { serve: null, serveFaults: 0, strokes: [] }; showLive(); };
})();
