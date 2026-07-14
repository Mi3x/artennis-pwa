/* ============================================================
   CourtVision — match-logic.js  (v4)
   New in v4:
   - endPoint(match, who, how): one-tap point ending.
     who: 'A'|'B' (whose racquet ended the rally)
     how: 'winner' | 'forced' | 'unforced'
     Derives winner + four-cause taxonomy automatically:
       winner  -> that player wins, cause aggressive
                  (or 'serve' if they served and rally had 0 taps)
       forced  -> OPPONENT wins, cause aggressive (they forced it)
       unforced-> opponent wins, cause consistency
   - end_detail stored per point ('winner'|'forced_error'|
     'unforced_error'|'double_fault') for report splits.
   - Consistency % and shot-mix errors count UNFORCED errors only.
   Backward compatible with v2/v3 saved matches.
   ============================================================ */

const WIN_CAUSES = ['consistency', 'aggressive', 'serve', 'opp_double_fault'];
const LOSS_CAUSE_MAP = {
  consistency: 'unforced_error',
  aggressive: 'unreturnable',
  serve: 'unreturnable',
  opp_double_fault: 'double_fault',
};
const ZONES = ['net_play', 'middle_court', 'ahead_baseline', 'behind_baseline'];
const WINGS = ['fh', 'bh'];
const SHOT_TYPES = ['drive', 'cross', 'angle', 'dtl', 'volley', 'slice', 'smash', 'drop', 'lob'];
const SHOT_LABELS = {
  drive: 'Drive', cross: 'Cross', angle: 'Angle', dtl: 'D.line', volley: 'Volley',
  slice: 'Slice', smash: 'Smash', drop: 'Drop', lob: 'Lob',
  cross_court: 'Cross', down_the_line: 'D.line', drop_shot: 'Drop', // legacy
};

function newMatch({ playerA, playerB, server = 'A', matchId = null }) {
  return {
    id: matchId || 'match_' + Date.now(),
    createdAt: new Date().toISOString(),
    players: { A: playerA, B: playerB },
    firstServer: server,
    server,
    points: [],
    current: freshPoint(),
  };
}
function freshPoint() { return { serve: null, serveFaults: 0, strokes: [] }; }

function normStroke(s) {
  if (s && typeof s === 'object') return { wing: s.wing || null, shot: s.shot || null };
  if (s === 'fh' || s === 'bh') return { wing: s, shot: null };
  if (s === 'sl') return { wing: null, shot: 'slice' };
  return { wing: null, shot: null };
}

// ---- during the point --------------------------------------------
function recordServe(match, result, placement = null) {
  const cur = match.current;
  if (result === 'in') {
    cur.serve = cur.serveFaults === 0 ? 'first_in' : 'second_in';
    cur.servePlacement = placement;
    return { done: false, doubleFault: false };
  }
  cur.serveFaults += 1;
  if (cur.serveFaults >= 2) {
    cur.serve = 'double_fault';
    cur.servePlacement = null;
    const winner = match.server === 'A' ? 'B' : 'A';
    savePoint(match, { winner, winCause: 'opp_double_fault', endDetail: 'double_fault' });
    return { done: true, doubleFault: true };
  }
  return { done: false, doubleFault: false };
}

function recordStroke(match, wing, shot = null) {
  if (!WINGS.includes(wing)) throw new Error('wing must be fh|bh');
  if (shot && !SHOT_TYPES.includes(shot)) throw new Error('unknown shot: ' + shot);
  match.current.strokes.push({ wing, shot });
}
function undoStroke(match) { match.current.strokes.pop(); }
function lastStroke(match) {
  const s = match.current.strokes;
  return s.length ? normStroke(s[s.length - 1]) : null;
}
function suggestWing(match) { const l = lastStroke(match); return l ? l.wing : null; }

// ---- one-tap point ending (the 2x3 card) ---------------------------
/**
 * who: 'A'|'B' — whose racquet ended the rally
 * how: 'winner'|'forced'|'unforced'
 * Returns { winner, winCause, endDetail } (not yet saved) so the UI
 * can show the auto line and optionally collect shot detail first.
 */
function derivePointEnd(match, who, how) {
  const other = who === 'A' ? 'B' : 'A';
  // v4.1: serve-play points come exclusively from the Ace button.
  // Rally ended is groundstroke territory — a zero-tap Winner here
  // honestly means a return winner (aggressive), not a serve.
  if (how === 'winner') {
    return { winner: who, winCause: 'aggressive', endDetail: 'winner' };
  }
  if (how === 'forced') {
    return { winner: other, winCause: 'aggressive', endDetail: 'forced_error' };
  }
  // unforced
  return { winner: other, winCause: 'consistency', endDetail: 'unforced_error' };
}

// ---- ending the point ----------------------------------------------
function savePoint(match, { winner, winCause, endDetail = null, shotDetail = null }) {
  if (!WIN_CAUSES.includes(winCause)) throw new Error('bad winCause');
  const cur = match.current;
  const record = {
    n: match.points.length + 1,
    winner,
    server: match.server,
    win_cause: winCause,
    loss_cause: LOSS_CAUSE_MAP[winCause],
    end_detail: endDetail,
    serve: cur.serve,
    serve_placement: cur.servePlacement ?? null,
    strokes: cur.strokes.slice(),
    shots_in_rally: cur.strokes.length || null,
    zone: shotDetail?.zone ?? null,
    wing: shotDetail?.wing ?? null,
    shot_type: shotDetail?.shotType ?? null,
    ts: new Date().toISOString(),
  };
  match.points.push(record);
  match.current = freshPoint();
  match.server = getScore(match).server;
  return record;
}
function toggleServer(match) { match.server = match.server === 'A' ? 'B' : 'A'; }

// ---- scoring engine ---------------------------------------------------
function getScore(match) {
  const PTS = ['0', '15', '30', '40'];
  let sets = { A: 0, B: 0 };
  let setHistory = [];
  let games = { A: 0, B: 0 };
  let gp = { A: 0, B: 0 };
  let tiebreak = false;
  let server = match.firstServer;
  let tbFirstServer = null;
  let finished = false;
  let matchWinner = null;
  const other = s => (s === 'A' ? 'B' : 'A');

  const endGame = (winner) => {
    games[winner] += 1;
    gp = { A: 0, B: 0 };
    const w = games[winner], l = games[other(winner)];
    if ((w >= 6 && w - l >= 2) || w === 7) {
      sets[winner] += 1;
      setHistory.push({ A: games.A, B: games.B });
      games = { A: 0, B: 0 };
      if (sets[winner] === 2) { finished = true; matchWinner = winner; }
    }
    tiebreak = (games.A === 6 && games.B === 6);
    if (tiebreak) { tbFirstServer = other(server); server = tbFirstServer; }
    else server = other(server);
  };

  for (const p of match.points) {
    if (finished) break;
    gp[p.winner] += 1;
    if (tiebreak) {
      const played = gp.A + gp.B;
      if ((gp.A >= 7 || gp.B >= 7) && Math.abs(gp.A - gp.B) >= 2) {
        endGame(gp.A > gp.B ? 'A' : 'B');
      } else {
        const idx = played;
        server = (idx === 0) ? tbFirstServer
          : ((Math.floor((idx + 1) / 2) % 2 === 0) ? tbFirstServer : other(tbFirstServer));
      }
    } else {
      const a = gp.A, b = gp.B;
      if ((a >= 4 || b >= 4) && Math.abs(a - b) >= 2) endGame(a > b ? 'A' : 'B');
    }
  }

  let gameScore;
  if (tiebreak) gameScore = gp.A + '-' + gp.B + ' (TB)';
  else {
    const a = gp.A, b = gp.B;
    if (a >= 3 && b >= 3) gameScore = (a === b) ? 'Deuce' : 'Ad ' + (a > b ? 'A' : 'B');
    else gameScore = PTS[Math.min(a, 3)] + '-' + PTS[Math.min(b, 3)];
  }
  const changeEnds = tiebreak
    ? ((gp.A + gp.B) > 0 && (gp.A + gp.B) % 6 === 0)
    : ((games.A + games.B) % 2 === 1 && gp.A + gp.B === 0);

  return { sets, setHistory, games, gameScore, tiebreak, server, changeEnds, finished, matchWinner };
}

// ---- stats -----------------------------------------------------------
function getStats(match) {
  const pts = match.points;
  const won = pts.filter(p => p.winner === 'A');
  const lost = pts.filter(p => p.winner === 'B');
  const countBy = (arr, key) =>
    arr.reduce((m, p) => ((m[p[key]] = (m[p[key]] || 0) + 1), m), {});
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

  const winCauses = countBy(won, 'win_cause');
  const oppCauses = countBy(lost, 'win_cause');

  const aServes = pts.filter(p => p.server === 'A' && p.serve);
  const firstIn = aServes.filter(p => p.serve === 'first_in').length;
  const dfs = aServes.filter(p => p.serve === 'double_fault').length;
  const secondAttempts = aServes.length - firstIn;
  const secondIn = aServes.filter(p => p.serve === 'second_in').length;

  // Wing totals + shot mix. Errors = UNFORCED only.
  // A point is A's unforced error when winner==='B' && cause consistency
  // AND (no end_detail  OR end_detail === 'unforced_error')  [v2/v3 compat]
  let fhTotal = 0, bhTotal = 0, fhErr = 0, bhErr = 0;
  const mix = {};
  // aggressive-win split for reports
  let cleanWinners = 0, forcedWins = 0;
  for (const p of pts) {
    const strokes = (p.strokes || []).map(normStroke);
    for (const st of strokes) {
      if (st.wing === 'fh') fhTotal++;
      if (st.wing === 'bh') bhTotal++;
      if (st.wing && st.shot) {
        const k = st.wing + ':' + st.shot;
        mix[k] = mix[k] || { n: 0, errors: 0 };
        mix[k].n++;
      }
    }
    const isUE = p.winner === 'B' && p.win_cause === 'consistency' &&
      (!p.end_detail || p.end_detail === 'unforced_error');
    if (isUE && strokes.length) {
      const last = strokes[strokes.length - 1];
      if (last.wing === 'fh') fhErr++;
      if (last.wing === 'bh') bhErr++;
      if (last.wing && last.shot) mix[last.wing + ':' + last.shot].errors++;
    }
    if (p.winner === 'A' && p.win_cause === 'aggressive') {
      if (p.end_detail === 'forced_error') forcedWins++;
      else cleanWinners++;
    }
  }
  const shot_mix = Object.entries(mix)
    .map(([k, v]) => {
      const [wing, shot] = k.split(':');
      return { wing, shot, n: v.n, errors: v.errors, in_play_pct: pct(v.n - v.errors, v.n) };
    })
    .sort((a, b) => b.n - a.n);

  const mk = (n, d) => ({ n: n || 0, pct: pct(n || 0, d) });
  return {
    total: pts.length,
    win_points: won.length,
    lost_points: lost.length,
    balance_point: won.length - lost.length,
    how_you_won: {
      consistency: mk(winCauses.consistency, won.length),
      aggressive: mk(winCauses.aggressive, won.length),
      serve: mk(winCauses.serve, won.length),
      opp_double_faults: mk(winCauses.opp_double_fault, won.length),
    },
    aggressive_split: { clean_winners: cleanWinners, forced_errors: forcedWins },
    how_you_lost: {
      your_unforced_errors: mk(oppCauses.consistency, lost.length),
      opp_aggressive: mk(oppCauses.aggressive, lost.length),
      opp_serve: mk(oppCauses.serve, lost.length),
      your_double_faults: mk(oppCauses.opp_double_fault, lost.length),
    },
    serve: {
      service_points: aServes.length,
      first_serve_pct: pct(firstIn, aServes.length),
      second_serve_pct: pct(secondIn, secondAttempts),
      double_faults: dfs,
    },
    consistency: {
      fh: { strokes: fhTotal, errors: fhErr, pct: pct(fhTotal - fhErr, fhTotal) },
      bh: { strokes: bhTotal, errors: bhErr, pct: pct(bhTotal - bhErr, bhTotal) },
    },
    shot_mix,
    shot_map: pts.filter(p => p.zone).map(p => ({
      outcome: p.winner === 'A' ? 'aggressive_win' : 'unforced_error',
      zone: p.zone, wing: p.wing, shot_type: p.shot_type,
    })),
  };
}

// ---- persistence ------------------------------------------------------
const STORE_PREFIX = 'courtvision_match_';
function saveMatch(match) {
  try { localStorage.setItem(STORE_PREFIX + match.id, JSON.stringify(match)); }
  catch (e) { console.error('save failed', e); }
}
function loadMatch(matchId) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + matchId);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { console.error('load failed', e); return null; }
}
function listMatches() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORE_PREFIX)) {
      const m = JSON.parse(localStorage.getItem(k));
      out.push({ id: m.id, createdAt: m.createdAt, players: m.players, points: m.points.length });
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const CourtVisionMatch = {
  newMatch, recordServe, recordStroke, undoStroke, suggestWing, lastStroke,
  derivePointEnd, savePoint, toggleServer, getStats, getScore,
  saveMatch, loadMatch, listMatches,
  WIN_CAUSES, LOSS_CAUSE_MAP, ZONES, WINGS, SHOT_TYPES, SHOT_LABELS,
};
if (typeof window !== 'undefined') window.CourtVisionMatch = CourtVisionMatch;
if (typeof module !== 'undefined') module.exports = CourtVisionMatch;
