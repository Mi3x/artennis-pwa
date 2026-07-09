/* ============================================================
   CourtVision — match-logic.js  (v2)
   Point log + automatic tennis scoring engine.
   Server flips every game; ends change after odd games
   (and every 6 points in a tiebreak). Sets: 6 games (2 clear),
   tiebreak at 6-6 (first to 7, 2 clear). Best of 3 sets.
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
const SHOT_TYPES = ['volley', 'down_the_line', 'cross_court', 'smash', 'slice', 'lob', 'angle', 'drop_shot'];

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

// ---- during the point --------------------------------------------
function recordServe(match, result) {
  const cur = match.current;
  if (result === 'in') {
    cur.serve = cur.serveFaults === 0 ? 'first_in' : 'second_in';
    return { done: false, doubleFault: false };
  }
  cur.serveFaults += 1;
  if (cur.serveFaults >= 2) {
    cur.serve = 'double_fault';
    const winner = match.server === 'A' ? 'B' : 'A';
    savePoint(match, { winner, winCause: 'opp_double_fault' });
    return { done: true, doubleFault: true };
  }
  return { done: false, doubleFault: false };
}
function recordStroke(match, wing) {
  if (!WINGS.includes(wing)) throw new Error('wing must be fh|bh');
  match.current.strokes.push(wing);
}
function undoStroke(match) { match.current.strokes.pop(); }
function suggestWing(match) {
  const s = match.current.strokes;
  return s.length ? s[s.length - 1] : null;
}

// ---- ending the point ----------------------------------------------
function savePoint(match, { winner, winCause, shotDetail = null }) {
  if (!WIN_CAUSES.includes(winCause)) throw new Error('bad winCause');
  const cur = match.current;
  const record = {
    n: match.points.length + 1,
    winner,
    server: match.server,
    win_cause: winCause,
    loss_cause: LOSS_CAUSE_MAP[winCause],
    serve: cur.serve,
    strokes: cur.strokes.slice(),
    shots_in_rally: cur.strokes.length || null,
    zone: shotDetail?.zone ?? null,
    wing: shotDetail?.wing ?? null,
    shot_type: shotDetail?.shotType ?? null,
    ts: new Date().toISOString(),
  };
  match.points.push(record);
  match.current = freshPoint();
  match.server = getScore(match).server; // auto server rotation
  return record;
}
function toggleServer(match) { match.server = match.server === 'A' ? 'B' : 'A'; }

// ---- scoring engine -------------------------------------------------
// Replays all points and returns the live tennis score.
function getScore(match) {
  const PTS = ['0', '15', '30', '40'];
  let sets = { A: 0, B: 0 };
  let setHistory = [];           // e.g. [{A:6,B:4}]
  let games = { A: 0, B: 0 };
  let gp = { A: 0, B: 0 };       // points in current game / tiebreak
  let tiebreak = false;
  let server = match.firstServer;
  let gamesPlayedTotal = 0;      // across whole match, for end changes
  let tbFirstServer = null;
  let finished = false;
  let matchWinner = null;

  const other = s => (s === 'A' ? 'B' : 'A');

  const endGame = (winner) => {
    games[winner] += 1;
    gp = { A: 0, B: 0 };
    gamesPlayedTotal += 1;
    // set won?
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
      // server: first server serves point 1, then alternates every 2 points
      const played = gp.A + gp.B;
      if ((gp.A >= 7 || gp.B >= 7) && Math.abs(gp.A - gp.B) >= 2) {
        const w = gp.A > gp.B ? 'A' : 'B';
        endGame(w); // counts as a game -> 7-6 set
      } else {
        server = (played % 2 === 1) ? other(tbFirstServer)
          : (Math.floor(played / 2) % 2 === 0 ? tbFirstServer : other(tbFirstServer));
        // simpler rotation: after point 1, swap every 2 points
        const idx = played; // points completed
        server = (idx === 0) ? tbFirstServer
          : ((Math.floor((idx + 1) / 2) % 2 === 0) ? tbFirstServer : other(tbFirstServer));
      }
    } else {
      // normal game
      const a = gp.A, b = gp.B;
      if ((a >= 4 || b >= 4) && Math.abs(a - b) >= 2) {
        endGame(a > b ? 'A' : 'B');
      }
    }
  }

  // display strings
  let gameScore;
  if (tiebreak) gameScore = gp.A + '-' + gp.B + ' (TB)';
  else {
    const a = gp.A, b = gp.B;
    if (a >= 3 && b >= 3) {
      if (a === b) gameScore = 'Deuce';
      else gameScore = 'Ad ' + (a > b ? 'A' : 'B');
    } else gameScore = (PTS[Math.min(a, 3)]) + '-' + (PTS[Math.min(b, 3)]);
  }

  // change ends after odd total games in a set (1,3,5...) and every 6 pts in TB
  const changeEnds = tiebreak
    ? ((gp.A + gp.B) > 0 && (gp.A + gp.B) % 6 === 0)
    : ((games.A + games.B) % 2 === 1 && gp.A + gp.B === 0);

  return {
    sets, setHistory, games, gameScore, tiebreak,
    server, changeEnds, finished, matchWinner,
  };
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
  const lossBreakdown = {
    your_unforced_errors: oppCauses.consistency || 0,
    opp_aggressive: oppCauses.aggressive || 0,
    opp_serve: oppCauses.serve || 0,
    your_double_faults: oppCauses.opp_double_fault || 0,
  };

  const aServes = pts.filter(p => p.server === 'A' && p.serve);
  const firstIn = aServes.filter(p => p.serve === 'first_in').length;
  const dfs = aServes.filter(p => p.serve === 'double_fault').length;
  const secondAttempts = aServes.length - firstIn;
  const secondIn = aServes.filter(p => p.serve === 'second_in').length;

  let fhTotal = 0, bhTotal = 0, fhErr = 0, bhErr = 0;
  for (const p of pts) {
    for (const w of p.strokes) (w === 'fh' ? fhTotal++ : bhTotal++);
    const isUE = p.winner === 'B' && p.win_cause === 'consistency';
    if (isUE && p.strokes.length) {
      const last = p.strokes[p.strokes.length - 1];
      (last === 'fh' ? fhErr++ : bhErr++);
    }
  }

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
    how_you_lost: {
      your_unforced_errors: mk(lossBreakdown.your_unforced_errors, lost.length),
      opp_aggressive: mk(lossBreakdown.opp_aggressive, lost.length),
      opp_serve: mk(lossBreakdown.opp_serve, lost.length),
      your_double_faults: mk(lossBreakdown.your_double_faults, lost.length),
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
  newMatch, recordServe, recordStroke, undoStroke, suggestWing,
  savePoint, toggleServer, getStats, getScore, saveMatch, loadMatch, listMatches,
  WIN_CAUSES, LOSS_CAUSE_MAP, ZONES, WINGS, SHOT_TYPES,
};
if (typeof window !== 'undefined') window.CourtVisionMatch = CourtVisionMatch;
if (typeof module !== 'undefined') module.exports = CourtVisionMatch;
