/* ============================================================
   CourtVision — match-logic.js
   State machine + point log + stats for Phase 1 tagging.
   Pure logic, no DOM. Wire your UI buttons to these functions.
   ============================================================ */

// ---- Constants -------------------------------------------------

const WIN_CAUSES = ['consistency', 'aggressive', 'serve', 'opp_double_fault'];

// Auto-derive map: winner's cause -> loser's mirrored cause
const LOSS_CAUSE_MAP = {
  consistency: 'unforced_error',
  aggressive: 'unreturnable',
  serve: 'unreturnable',
  opp_double_fault: 'double_fault',
};

const ZONES = ['net_play', 'middle_court', 'ahead_baseline', 'behind_baseline'];
const WINGS = ['fh', 'bh'];
const SHOT_TYPES = ['volley', 'down_the_line', 'cross_court', 'smash', 'slice', 'lob', 'angle', 'drop_shot'];

// ---- Match creation --------------------------------------------

/**
 * Create a new match object.
 * playerA is the tracked player (your player), playerB the opponent.
 * server: 'A' or 'B' — who serves first.
 */
function newMatch({ playerA, playerB, server = 'A', matchId = null }) {
  return {
    id: matchId || 'match_' + Date.now(),
    createdAt: new Date().toISOString(),
    players: { A: playerA, B: playerB },
    server, // current server: 'A' | 'B'
    points: [], // saved point records
    current: freshPoint(), // in-progress point state
  };
}

function freshPoint() {
  return {
    serve: null,        // 'first_in' | 'second_in' | 'double_fault'
    serveFaults: 0,     // 0 or 1 while point in progress
    strokes: [],        // ['fh','bh',...] taps for the tracked player (A)
  };
}

// ---- During the point -------------------------------------------

/**
 * Record a serve result tap. Call with 'in' or 'fault'.
 * Returns { done, doubleFault } — if doubleFault is true the point
 * auto-saved itself and the UI should skip the tagging card.
 */
function recordServe(match, result) {
  const cur = match.current;
  if (result === 'in') {
    cur.serve = cur.serveFaults === 0 ? 'first_in' : 'second_in';
    return { done: false, doubleFault: false };
  }
  // fault
  cur.serveFaults += 1;
  if (cur.serveFaults >= 2) {
    cur.serve = 'double_fault';
    // Receiver wins automatically; no tagging card needed.
    const winner = match.server === 'A' ? 'B' : 'A';
    savePoint(match, { winner, winCause: 'opp_double_fault' });
    return { done: true, doubleFault: true };
  }
  return { done: false, doubleFault: false };
}

/** Record one FH/BH stroke tap for the tracked player. */
function recordStroke(match, wing) {
  if (!WINGS.includes(wing)) throw new Error('wing must be fh|bh');
  match.current.strokes.push(wing);
}

/** Undo the most recent stroke tap. */
function undoStroke(match) {
  match.current.strokes.pop();
}

/**
 * Suggest the wing for the shot-detail card, from the last tap.
 * Returns 'fh' | 'bh' | null.
 */
function suggestWing(match) {
  const s = match.current.strokes;
  return s.length ? s[s.length - 1] : null;
}

// ---- Ending the point --------------------------------------------

/**
 * Save the completed point.
 * winner: 'A' | 'B'
 * winCause: one of WIN_CAUSES (from the tagging card)
 * shotDetail (optional): { zone, wing, shotType } from the detail card
 * Loss cause is always derived automatically.
 */
function savePoint(match, { winner, winCause, shotDetail = null }) {
  if (!WIN_CAUSES.includes(winCause)) throw new Error('bad winCause');
  const cur = match.current;

  const record = {
    n: match.points.length + 1,
    winner,
    server: match.server,
    win_cause: winCause,
    loss_cause: LOSS_CAUSE_MAP[winCause],
    serve: cur.serve, // may be null if serve toggle skipped
    strokes: cur.strokes.slice(), // tracked player's tap stream
    shots_in_rally: cur.strokes.length || null,
    zone: shotDetail?.zone ?? null,
    wing: shotDetail?.wing ?? null,
    shot_type: shotDetail?.shotType ?? null,
    ts: new Date().toISOString(),
  };

  match.points.push(record);
  match.current = freshPoint();
  return record;
}

/** Flip the server (call at the end of each game). */
function toggleServer(match) {
  match.server = match.server === 'A' ? 'B' : 'A';
}

// ---- Stats (computed from the log, tracked player = A) -----------

function getStats(match) {
  const pts = match.points;
  const won = pts.filter(p => p.winner === 'A');
  const lost = pts.filter(p => p.winner === 'B');

  const countBy = (arr, key) =>
    arr.reduce((m, p) => ((m[p[key]] = (m[p[key]] || 0) + 1), m), {});

  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

  // --- Point breakdown (the four-bar charts) ---
  const winCauses = countBy(won, 'win_cause');
  // "How you lost" = opponent's win causes, relabeled to your perspective
  const oppCauses = countBy(lost, 'win_cause');
  const lossBreakdown = {
    your_unforced_errors: oppCauses.consistency || 0,
    opp_aggressive: oppCauses.aggressive || 0,
    opp_serve: oppCauses.serve || 0,
    your_double_faults: oppCauses.opp_double_fault || 0,
  };

  // --- Serve effectiveness (points where A served, toggle used) ---
  const aServes = pts.filter(p => p.server === 'A' && p.serve);
  const firstIn = aServes.filter(p => p.serve === 'first_in').length;
  const dfs = aServes.filter(p => p.serve === 'double_fault').length;
  const secondAttempts = aServes.length - firstIn; // faulted first serves
  const secondIn = aServes.filter(p => p.serve === 'second_in').length;

  // --- FH/BH groundstroke consistency (from stroke tap streams) ---
  // A stroke is an error only if it was A's LAST stroke of a point
  // that A lost to the opponent's consistency (i.e. A's unforced error).
  let fhTotal = 0, bhTotal = 0, fhErr = 0, bhErr = 0;
  for (const p of pts) {
    for (const w of p.strokes) (w === 'fh' ? fhTotal++ : bhTotal++);
    const isUE = p.winner === 'B' && p.win_cause === 'consistency';
    if (isUE && p.strokes.length) {
      const last = p.strokes[p.strokes.length - 1];
      (last === 'fh' ? fhErr++ : bhErr++);
    }
  }

  return {
    total: pts.length,
    win_points: won.length,
    lost_points: lost.length,
    balance_point: won.length - lost.length,

    how_you_won: {
      consistency: { n: winCauses.consistency || 0, pct: pct(winCauses.consistency || 0, won.length) },
      aggressive:  { n: winCauses.aggressive || 0,  pct: pct(winCauses.aggressive || 0, won.length) },
      serve:       { n: winCauses.serve || 0,       pct: pct(winCauses.serve || 0, won.length) },
      opp_double_faults: { n: winCauses.opp_double_fault || 0, pct: pct(winCauses.opp_double_fault || 0, won.length) },
    },
    how_you_lost: {
      your_unforced_errors: { n: lossBreakdown.your_unforced_errors, pct: pct(lossBreakdown.your_unforced_errors, lost.length) },
      opp_aggressive:       { n: lossBreakdown.opp_aggressive,       pct: pct(lossBreakdown.opp_aggressive, lost.length) },
      opp_serve:            { n: lossBreakdown.opp_serve,            pct: pct(lossBreakdown.opp_serve, lost.length) },
      your_double_faults:   { n: lossBreakdown.your_double_faults,   pct: pct(lossBreakdown.your_double_faults, lost.length) },
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

    // Sheet 3 heatmap data: zone x wing x shot_type for aggressive
    // wins and unforced errors (only points with shot detail tagged)
    shot_map: pts
      .filter(p => p.zone)
      .map(p => ({
        outcome: p.winner === 'A' ? 'aggressive_win' : 'unforced_error',
        zone: p.zone, wing: p.wing, shot_type: p.shot_type,
      })),
  };
}

// ---- Persistence (localStorage) -----------------------------------

const STORE_PREFIX = 'courtvision_match_';

function saveMatch(match) {
  try {
    localStorage.setItem(STORE_PREFIX + match.id, JSON.stringify(match));
  } catch (e) { console.error('save failed', e); }
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

// ---- Exports (works as plain <script> or ES module) ---------------

const CourtVisionMatch = {
  newMatch, recordServe, recordStroke, undoStroke, suggestWing,
  savePoint, toggleServer, getStats, saveMatch, loadMatch, listMatches,
  WIN_CAUSES, LOSS_CAUSE_MAP, ZONES, WINGS, SHOT_TYPES,
};

if (typeof window !== 'undefined') window.CourtVisionMatch = CourtVisionMatch;
if (typeof module !== 'undefined') module.exports = CourtVisionMatch;

/* ============================================================
   WIRING EXAMPLE (in your existing app JS):

   const M = window.CourtVisionMatch;
   let match = M.newMatch({ playerA: 'N. Djokovic', playerB: 'A. Rinderknech' });

   // Serve toggle buttons:
   btn1stIn.onclick = () => M.recordServe(match, 'in');
   btnFault.onclick = () => {
     const r = M.recordServe(match, 'fault');
     if (r.doubleFault) { M.saveMatch(match); refreshAnalytics(); }
   };

   // FH/BH thumb buttons:
   btnFH.onclick = () => M.recordStroke(match, 'fh');
   btnBH.onclick = () => M.recordStroke(match, 'bh');
   btnUndo.onclick = () => M.undoStroke(match);

   // Point tagging card Save:
   //   winner: 'A' or 'B', winCause from the tapped button
   M.savePoint(match, { winner: 'A', winCause: 'consistency' });
   M.saveMatch(match);

   // With shot detail:
   M.savePoint(match, {
     winner: 'A', winCause: 'aggressive',
     shotDetail: { zone: 'ahead_baseline', wing: M.suggestWing(match) || 'fh', shotType: 'cross_court' },
   });

   // Analytics tab:
   const stats = M.getStats(match);
   // stats.how_you_won.consistency -> { n: 16, pct: 47 } etc.
   ============================================================ */
