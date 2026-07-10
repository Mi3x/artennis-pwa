/* ============================================================
   CourtVision — tagging-ui.js  (v2)
   Requires match-logic.js (v2) loaded first.
   New: match setup screen (real names), automatic tennis score
   (games/sets/tiebreak), auto server rotation, change-ends banner,
   New match button. Keeps: wizard flow, tap flash, stats page,
   shot map, point log, Analytics-tab mirror.
   ============================================================ */
(function () {
  const M = window.CourtVisionMatch;
  if (!M) { console.error('tagging-ui: load match-logic.js first'); return; }

  let match = null;
  const saved = M.listMatches();
  if (saved.length) match = M.loadMatch(saved[0].id);
  window.cvMatch = match;

  // ---- styles ------------------------------------------------------
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
  .cvt-big{padding:24px 8px;font-size:20px;font-weight:600;border-radius:16px;text-align:center}
  .cvt-auto{display:none;align-items:center;gap:8px;background:#2e4a1f;border:1.5px solid #d9f64b;
    border-radius:10px;padding:8px 12px;font-size:12px;color:#d9f64b;margin-bottom:12px}
  .cvt-auto.show{display:flex}
  .cvt-pill{border-radius:999px}
  .cvt-save{display:block;margin:8px auto 0;background:#d9f64b;color:#1c330f;border:none;
    border-radius:10px;padding:11px 30px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
  .cvt-x{background:none;border:none;color:#8fbf9a;font-size:13px;cursor:pointer;font-family:inherit}
  .cvt-sec{display:none;border-top:1px solid #2c5638;padding-top:12px;margin-top:4px}
  .cvt-sec.show{display:block}
  .cvt-zone{border:1.5px solid #4a7a56;border-radius:10px;overflow:hidden;width:120px;flex:none}
  .cvt-zone button{display:block;width:100%;background:#1d4028;border:none;border-bottom:1px dashed #4a7a56;
    color:#cfe6d4;font-size:11px;padding:12px 4px;cursor:pointer;font-family:inherit}
  .cvt-zone button:last-child{border-bottom:none}
  .cvt-zone button.sel{background:#d9f64b;color:#1c330f;font-weight:600}
  .cvt-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
  .cvt-chips .cvt-btn{padding:7px 10px;font-size:12px;border-radius:8px}
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
    padding:10px 14px;margin-bottom:12px;font-size:13px}
  .cvt-score b{color:#d9f64b;font-size:16px}
  .cvt-ends{display:none;background:#e8975a;color:#1c330f;border-radius:10px;padding:8px 12px;
    font-size:13px;font-weight:600;margin-bottom:12px;text-align:center}
  .cvt-ends.show{display:block}
  .cvt-input{width:100%;box-sizing:border-box;background:#1d4028;border:1px solid #2c5638;color:#f0f7ec;
    border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;margin-bottom:10px}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const names = () => match.players;

  let selWinner = null, selCause = null, selZone = null, selWing = null, selShot = null;
  let secondServe = false;

  // ---- build panel ----------------------------------------------------
  const fab = el('button', 'cvt-fab', '🎾 Tag match');
  const panel = el('div', 'cvt-panel');
  document.body.appendChild(fab); document.body.appendChild(panel);

  panel.innerHTML = `
    <div class="cvt-head">
      <span class="cvt-label" id="cvt-title">Live tagging</span>
      <span>
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
      </div>
      <div class="cvt-row" style="justify-content:space-between">
        <span style="font-size:12px;color:#9fc9aa" id="cvt-tally">FH 0 · BH 0</span>
        <button class="cvt-btn cvt-pill" id="cvt-undo">↩ undo</button>
      </div>
      <div class="cvt-grid2" style="grid-template-columns:1fr 1fr 1fr">
        <button class="cvt-btn cvt-big" id="cvt-fh">FH <span id="cvt-fh-n" style="color:inherit">0</span><br><span style="font-size:10px;font-weight:400">forehand</span></button>
        <button class="cvt-btn cvt-big" id="cvt-bh">BH <span id="cvt-bh-n" style="color:inherit">0</span><br><span style="font-size:10px;font-weight:400">backhand</span></button>
        <button class="cvt-btn cvt-big" id="cvt-sl">SL <span id="cvt-sl-n" style="color:inherit">0</span><br><span style="font-size:10px;font-weight:400">slice</span></button>
      </div>
      <button class="cvt-save" id="cvt-end">Rally ended →</button>
    </div>

    <div class="cvt-sec" id="cvt-point">
      <p class="cvt-q">Who won the point?</p>
      <div class="cvt-grid2" id="cvt-winners"></div>
      <p class="cvt-q">How did they win it?</p>
      <div class="cvt-grid2" id="cvt-causes"></div>
      <div class="cvt-auto" id="cvt-autoline"><span style="background:#d9f64b;border-radius:8px;font-size:10px;color:#1c330f;padding:1px 6px">auto</span><span id="cvt-autotext"></span></div>
      <button class="cvt-save" id="cvt-savept">Save point</button>
      <button class="cvt-x" id="cvt-skippt" style="display:block;margin:8px auto 0">skip</button>
    </div>

    <div class="cvt-sec" id="cvt-shot">
      <p class="cvt-q">Shot detail <span style="font-weight:400;font-size:12px;color:#8fbf9a">(optional)</span></p>
      <div style="display:flex;gap:14px">
        <div>
          <p class="cvt-label" style="margin-bottom:6px">Hit from</p>
          <div class="cvt-zone" id="cvt-zones"></div>
        </div>
        <div style="flex:1;min-width:0">
          <p class="cvt-label" style="margin-bottom:6px">Forehand</p>
          <div class="cvt-chips" id="cvt-fhchips"></div>
          <p class="cvt-label" style="margin-bottom:6px">Backhand</p>
          <div class="cvt-chips" id="cvt-bhchips"></div>
        </div>
      </div>
      <button class="cvt-save" id="cvt-saveshot">Save shot detail</button>
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
      <div id="cvt-shotmap"></div>
      <div id="cvt-log"></div>
      <button class="cvt-save" id="cvt-next">Next point →</button>
      <div class="cvt-cards" style="margin-top:12px">
        <div class="cvt-card"><b id="cvt-s1">–</b><span>1st serve %</span></div>
        <div class="cvt-card"><b id="cvt-fhc">–</b><span>FH consistency</span></div>
        <div class="cvt-card"><b id="cvt-bhc">–</b><span>BH consistency</span></div>
        <div class="cvt-card"><b id="cvt-slc">–</b><span>SL consistency</span></div>
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

  // ---- setup screen ------------------------------------------------------
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
  $('cvt-newmatch').onclick = () => { buildSetup(); showScreen('cvt-setup'); };

  // ---- point card -----------------------------------------------------------
  function buildPointCard() {
    const w = $('cvt-winners'); w.innerHTML = '';
    [['A', names().A], ['B', names().B]].forEach(([k, name]) => {
      const b = el('button', 'cvt-btn', name);
      b.onclick = () => { selWinner = k; [...w.children].forEach(c => c.classList.remove('sel')); b.classList.add('sel'); updateAuto(); };
      w.appendChild(b);
    });
    const causes = [['consistency', '🔁 Consistency play'], ['aggressive', '🎯 Aggressive play'], ['serve', '⚡ Serve play'], ['opp_double_fault', '🎁 Opp. double fault']];
    const c = $('cvt-causes'); c.innerHTML = '';
    causes.forEach(([k, label]) => {
      const b = el('button', 'cvt-btn', label);
      b.onclick = () => { selCause = k; [...c.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); updateAuto(); };
      c.appendChild(b);
    });
  }
  function updateAuto() {
    const line = $('cvt-autoline');
    if (selWinner && selCause) {
      const loser = selWinner === 'A' ? names().B : names().A;
      const lossLabels = { unforced_error: 'Unforced error', unreturnable: 'Unreturnable', double_fault: 'Double fault' };
      $('cvt-autotext').textContent = loser + ' lost by: ' + lossLabels[M.LOSS_CAUSE_MAP[selCause]];
      line.classList.add('show');
    } else line.classList.remove('show');
  }

  // ---- shot detail ------------------------------------------------------------
  function buildShotCard() {
    const zoneLabels = { net_play: 'Net play', middle_court: 'Middle court', ahead_baseline: 'Ahead of baseline', behind_baseline: 'Behind baseline' };
    const z = $('cvt-zones'); z.innerHTML = '';
    M.ZONES.forEach(k => {
      const b = el('button', '', zoneLabels[k]);
      b.onclick = () => { selZone = k; [...z.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); };
      z.appendChild(b);
    });
    const shotLabels = { volley: 'Volley', down_the_line: 'Down the line', cross_court: 'Cross court', smash: 'Smash', slice: 'Slice', lob: 'Lob', angle: 'Angle', drop_shot: 'Drop shot' };
    [['fh', 'cvt-fhchips'], ['bh', 'cvt-bhchips']].forEach(([wing, id]) => {
      const box = $(id); box.innerHTML = '';
      M.SHOT_TYPES.forEach(sh => {
        const b = el('button', 'cvt-btn', shotLabels[sh]);
        b.onclick = () => {
          selWing = wing; selShot = sh;
          panel.querySelectorAll('.cvt-chips .cvt-btn').forEach(x => x.classList.remove('sel'));
          b.classList.add('sel');
        };
        box.appendChild(b);
      });
    });
  }

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
    });

    // Shot selection & court position
    const zl = { net_play: 'Net play', middle_court: 'Middle court', ahead_baseline: 'Ahead of baseline', behind_baseline: 'Behind baseline' };
    const sl = { volley: 'volley', down_the_line: 'down the line', cross_court: 'cross court', smash: 'smash', slice: 'slice', lob: 'lob', angle: 'angle', drop_shot: 'drop shot' };
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
        const k = x.wing.toUpperCase() + ' ' + sl[x.shot_type];
        byShot[k] = byShot[k] || { w: 0, e: 0 };
        x.outcome === 'aggressive_win' ? byShot[k].w++ : byShot[k].e++;
      });
      Object.entries(byShot).sort((a, b) => (b[1].w + b[1].e) - (a[1].w + a[1].e)).forEach(([k, v]) => {
        sm.appendChild(el('div', 'cvt-stat',
          `<span>${k}</span><span><span style="color:#d9f64b">${v.w} won</span> · <span style="color:#e8975a">${v.e} errors</span></span>`));
      });
    }

    // Point log
    const lg = $('cvt-log'); lg.innerHTML = '';
    if (match.points.length) {
      lg.appendChild(el('p', 'cvt-q', 'Point log'));
      const causeL = { consistency: 'consistency', aggressive: 'aggressive', serve: 'serve', opp_double_fault: 'opp. DF' };
      match.points.slice().reverse().forEach(p => {
        const who = match.players[p.winner];
        const shot = p.shot_type ? ` · ${(p.wing || '').toUpperCase()} ${p.shot_type.replace(/_/g, ' ')}` : '';
        const srv = p.serve ? ` · ${p.serve.replace(/_/g, ' ')}` : '';
        lg.appendChild(el('div', 'cvt-stat',
          `<span>#${p.n} ${who}</span><span>${causeL[p.win_cause]}${srv}${shot}</span>`));
      });
    }

    $('cvt-s1').textContent = s.serve.service_points ? s.serve.first_serve_pct + '%' : '–';
    $('cvt-fhc').textContent = s.consistency.fh.strokes ? s.consistency.fh.pct + '%' : '–';
    $('cvt-bhc').textContent = s.consistency.bh.strokes ? s.consistency.bh.pct + '%' : '–';
    $('cvt-slc').textContent = s.consistency.sl.strokes ? s.consistency.sl.pct + '%' : '–';

    // mirror into Analytics tab
    const mount = document.getElementById('cv-breakdown');
    if (mount) {
      const c = $('cvt-stats').cloneNode(true);
      c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      c.classList.add('show');
      const nb = c.querySelector('.cvt-save'); if (nb) nb.remove(); // no Next button in the tab
      mount.replaceChildren(c);
    }
  }

  // ---- live screen / scoreboard --------------------------------------------------
  function updateLive() {
    if (!match) return;
    const s = match.current.strokes;
    const fh = s.filter(x => x === 'fh').length;
    const bh = s.filter(x => x === 'bh').length;
    const sl = s.filter(x => x === 'sl').length;
    $('cvt-tally').textContent = `FH ${fh} · BH ${bh} · SL ${s.length - fh - bh}`;
    $('cvt-fh-n').textContent = fh;
    $('cvt-bh-n').textContent = bh;
    $('cvt-sl-n').textContent = sl;
    const sc = M.getScore(match);
    $('cvt-server').textContent = names()[sc.server] + ' serving:';
    panel.querySelectorAll('.cvt-serve').forEach(b => {
      b.textContent = (secondServe ? '2nd in-' : '1st in-') + b.dataset.pl.charAt(0).toUpperCase();
    });
    $('cvt-title').textContent = 'Live tagging · Point ' + (match.points.length + 1);

    const setsStr = sc.setHistory.map(x => x.A + '-' + x.B).join(' ');
    $('cvt-scoreboard').innerHTML =
      `<span>${names().A} vs ${names().B}</span>` +
      `<span>Sets <b>${sc.sets.A}-${sc.sets.B}</b>${setsStr ? ' <small style="color:#8fbf9a">(' + setsStr + ')</small>' : ''}</span>` +
      `<span>Games <b>${sc.games.A}-${sc.games.B}</b></span>` +
      `<span><b>${sc.gameScore}</b></span>` +
      (sc.finished ? `<span style="color:#d9f64b;font-weight:600">🏆 ${names()[sc.matchWinner]} wins!</span>` : '');
    $('cvt-ends').classList.toggle('show', sc.changeEnds && !sc.finished);
  }

  function resetSelections() {
    selWinner = selCause = selZone = selWing = selShot = null;
    panel.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
    $('cvt-autoline').classList.remove('show');
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
  $('cvt-fh').onclick = (e) => { flash(e.currentTarget); M.recordStroke(match, 'fh'); updateLive(); };
  $('cvt-bh').onclick = (e) => { flash(e.currentTarget); M.recordStroke(match, 'bh'); updateLive(); };
  $('cvt-sl').onclick = (e) => { flash(e.currentTarget); M.recordStroke(match, 'sl'); updateLive(); };
  $('cvt-undo').onclick = (e) => {
    if (match.current.strokes.length === 0) return; // nothing to undo
    flash(e.currentTarget);
    M.undoStroke(match);
    updateLive();
  };

  $('cvt-end').onclick = () => { buildPointCard(); showScreen('cvt-point'); };
  $('cvt-skippt').onclick = () => { match.current = { serve: null, serveFaults: 0, strokes: [] }; showLive(); };

  $('cvt-savept').onclick = () => {
    if (!selWinner || !selCause) { alert('Pick a winner and a cause first'); return; }
    const needDetail = selCause === 'aggressive' || selCause === 'consistency';
    if (needDetail) {
      selWing = M.suggestWing(match);
      buildShotCard();
      showScreen('cvt-shot');
    } else {
      M.savePoint(match, { winner: selWinner, winCause: selCause });
      showLive();
    }
  };
  function finishWithDetail(detail) {
    M.savePoint(match, { winner: selWinner, winCause: selCause, shotDetail: detail });
    showLive();
  }
  $('cvt-saveshot').onclick = () => finishWithDetail((selZone || selShot) ? { zone: selZone, wing: selWing, shotType: selShot } : null);
  $('cvt-skipshot').onclick = () => finishWithDetail(null);
})();
