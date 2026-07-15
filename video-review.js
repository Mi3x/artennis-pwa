/* ============================================================
   CourtVision — video-review.js
   Freeze-frame annotator: load a clip, step frame by frame,
   draw on the paused frame (angle / line / circle / freehand /
   point), add a caption, then share the annotated image
   (native share sheet on mobile → LINE/WhatsApp, download
   fallback on desktop).
   Self-injecting: fills <div id="cv-review"></div>.
   No server, no dependencies.
   ============================================================ */
(function () {
  const MOUNT_ID = 'cv-review';
  const LIME = '#d9f64b', WHITE = '#f0f7ec', ORANGE = '#e8975a';
  const FPS = 30; // assumed frame rate for stepping

  function init() {
    const mount = document.getElementById(MOUNT_ID);
    if (!mount) return;

    const css = `
    .cvr-wrap{max-width:720px;margin:0 auto;font-family:inherit;color:#f0f7ec}
    .cvr-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .cvr-label{font-size:11px;letter-spacing:1.5px;color:#8fbf9a;text-transform:uppercase}
    .cvr-btn{background:#1d4028;border:1px solid #2c5638;color:#f0f7ec;border-radius:10px;
      padding:9px 12px;font-size:13px;cursor:pointer;font-family:inherit}
    .cvr-btn:hover{background:#265232}
    .cvr-btn.lime{background:#d9f64b;color:#1c330f;border-color:#d9f64b;font-weight:600}
    .cvr-btn.sel{background:#d9f64b;color:#1c330f;border-color:#f0f7ec;border-width:2px}
    .cvr-pill{border-radius:999px;padding:7px 12px;font-size:12px}
    .cvr-main{display:flex;gap:10px;align-items:flex-start}
    .cvr-rail{display:flex;flex-direction:column;gap:6px;flex:none}
    .cvr-tool{width:44px;height:44px;display:flex;align-items:center;justify-content:center;
      background:#1d4028;border:1px solid #2c5638;border-radius:10px;cursor:pointer;font-size:17px;color:#f0f7ec}
    .cvr-tool.sel{background:#d9f64b;color:#1c330f;border-color:#f0f7ec;border-width:2px}
    .cvr-sw{width:44px;height:26px;border-radius:8px;border:1px solid #2c5638;cursor:pointer}
    .cvr-sw.sel{border:2px solid #f0f7ec}
    .cvr-stage{position:relative;background:#0f2415;border-radius:12px;overflow:hidden;
      flex:1;min-width:0;display:flex;align-items:center;justify-content:center;min-height:220px}
    .cvr-stage video,.cvr-stage canvas{display:block;max-width:100%}
    .cvr-stage canvas{position:absolute;inset:0;margin:auto;touch-action:none;cursor:crosshair}
    .cvr-time{position:absolute;bottom:8px;left:10px;background:rgba(15,36,21,.85);border-radius:6px;
      padding:2px 8px;font-size:11px;color:#d9f64b;pointer-events:none}
    .cvr-row{display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap}
    .cvr-scrub{flex:1;min-width:120px;accent-color:#d9f64b}
    .cvr-cap{width:100%;box-sizing:border-box;background:#1d4028;border:1px solid #2c5638;color:#f0f7ec;
      border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;margin-top:10px;resize:vertical}
    .cvr-actions{display:flex;gap:8px;margin-top:12px}
    .cvr-actions .cvr-btn{flex:1;text-align:center}
    .cvr-drop{border:2px dashed #7fb88a;border-radius:14px;padding:44px 20px;text-align:center;background:#1d4a2a}
    .cvr-hint{font-size:12px;color:#8fbf9a;margin-top:8px;text-align:center}
    .cvr-modes{display:inline-flex;background:#0f2415;border:1px solid #2c5638;border-radius:999px;padding:3px}
    .cvr-mode{border:none;background:transparent;color:#cfe6d4;border-radius:999px;padding:6px 14px;
      font-size:12px;cursor:pointer;font-family:inherit}
    .cvr-mode.sel{background:#d9f64b;color:#1c330f;font-weight:600}
    .cvr-tagpane{display:none;border-top:1px solid #2c5638;padding-top:12px;margin-top:12px}
    .cvr-tagpane.show{display:block}
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    mount.innerHTML = `
      <div class="cvr-wrap">
        <div class="cvr-head">
          <span class="cvr-label" id="cvr-name">No clip loaded</span>
          <span style="display:flex;align-items:center;gap:8px">
            <span class="cvr-modes" id="cvr-modes">
              <button class="cvr-mode sel" data-mode="annotate">✏️ Annotate</button>
              <button class="cvr-mode" data-mode="tag">🎯 Tag</button>
            </span>
            <button class="cvr-btn cvr-pill" id="cvr-undo">↩ undo</button>
            <button class="cvr-btn cvr-pill" id="cvr-clear">✕ clear</button>
          </span>
        </div>

        <div id="cvr-empty" class="cvr-drop">
          <p style="font-size:28px;margin:0 0 8px">🎾</p>
          <p style="font-size:16px;font-weight:600;margin:0 0 6px">Drop a video here</p>
          <p style="font-size:13px;color:#b8d4bf;margin:0 0 14px">MP4 · MOV · any phone clip</p>
          <button class="cvr-btn lime" id="cvr-choose">Choose video</button>
          <input type="file" id="cvr-file" accept="video/*" hidden>
        </div>

        <div id="cvr-editor" style="display:none">
          <div class="cvr-main">
            <div class="cvr-rail" id="cvr-rail"></div>
            <div style="flex:1;min-width:0">
              <div class="cvr-stage" id="cvr-stage">
                <video id="cvr-video" playsinline></video>
                <canvas id="cvr-canvas"></canvas>
                <span class="cvr-time" id="cvr-time">00:00.00</span>
              </div>
              <div class="cvr-row">
                <button class="cvr-btn cvr-pill" id="cvr-prev" title="previous frame">◀</button>
                <button class="cvr-btn cvr-pill lime" id="cvr-play">▶</button>
                <button class="cvr-btn cvr-pill" id="cvr-next" title="next frame">▶</button>
                <button class="cvr-btn cvr-pill" id="cvr-speed">1×</button>
                <input type="range" class="cvr-scrub" id="cvr-scrub" min="0" max="1000" value="0">
              </div>
            </div>
          </div>
          <div id="cvr-annotate-only">
            <textarea class="cvr-cap" id="cvr-caption" rows="2" placeholder="Coach's note — e.g. contact point too far back, elbow 42° (aim 30°)"></textarea>
            <div class="cvr-actions">
              <button class="cvr-btn" id="cvr-newvid">📹 New clip</button>
              <button class="cvr-btn" id="cvr-save">⬇️ Save image</button>
              <button class="cvr-btn lime" id="cvr-share">📤 Share</button>
            </div>
            <p class="cvr-hint">Pause on the moment, draw, add a note, then share to LINE or WhatsApp.</p>
          </div>
          <div class="cvr-tagpane" id="cvr-tagpane"></div>
        </div>
      </div>`;

    const $ = id => document.getElementById(id);
    const video = $('cvr-video'), canvas = $('cvr-canvas'), ctx = canvas.getContext('2d');

    // ---- state ----
    const TOOLS = [
      ['angle', '📐', 'angle (auto degrees)'],
      ['line', '📏', 'line'],
      ['circle', '⭕', 'circle'],
      ['free', '✏️', 'freehand'],
      ['point', '✚', 'reference point'],
    ];
    let tool = 'angle', color = LIME;
    let shapes = [];        // committed annotations
    let draft = null;       // in-progress shape
    let anglePts = [];      // angle needs 3 clicks
    let speeds = [1, 0.5, 0.25], speedIdx = 0;

    // ---- tool rail ----
    const rail = $('cvr-rail');
    TOOLS.forEach(([k, icon, title]) => {
      const b = document.createElement('button');
      b.className = 'cvr-tool' + (k === tool ? ' sel' : '');
      b.innerHTML = icon; b.title = title; b.dataset.tool = k;
      b.onclick = () => {
        tool = k; anglePts = []; draft = null;
        rail.querySelectorAll('.cvr-tool').forEach(x => x.classList.toggle('sel', x.dataset.tool === k));
        redraw();
      };
      rail.appendChild(b);
    });
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid #2c5638;margin:2px 0';
    rail.appendChild(sep);
    [LIME, WHITE, ORANGE].forEach(c => {
      const s = document.createElement('button');
      s.className = 'cvr-sw' + (c === color ? ' sel' : '');
      s.style.background = c; s.dataset.color = c;
      s.setAttribute('aria-label', 'color ' + c);
      s.onclick = () => {
        color = c;
        rail.querySelectorAll('.cvr-sw').forEach(x => x.classList.toggle('sel', x.dataset.color === c));
      };
      rail.appendChild(s);
    });

    // ---- load video ----
    $('cvr-choose').onclick = () => $('cvr-file').click();
    $('cvr-file').onchange = e => { if (e.target.files.length) loadVideo(e.target.files[0]); };
    $('cvr-newvid').onclick = () => $('cvr-file').click();

    const drop = $('cvr-empty');
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.style.background = '#265232';
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.style.background = '#1d4a2a';
    }));
    drop.addEventListener('drop', e => {
      if (e.dataTransfer.files.length) loadVideo(e.dataTransfer.files[0]);
    });

    function loadVideo(file) {
      if (!file.type.startsWith('video/')) { alert('Please choose a video file'); return; }
      video.src = URL.createObjectURL(file);
      $('cvr-name').textContent = file.name;
      shapes = []; anglePts = []; draft = null;
      video.onloadedmetadata = () => {
        $('cvr-empty').style.display = 'none';
        $('cvr-editor').style.display = 'block';
        sizeCanvas();
        video.currentTime = 0;
      };
    }

    function sizeCanvas() {
      const r = video.getBoundingClientRect();
      canvas.width = r.width || video.videoWidth;
      canvas.height = r.height || video.videoHeight;
      canvas.style.width = canvas.width + 'px';
      canvas.style.height = canvas.height + 'px';
      redraw();
    }
    window.addEventListener('resize', () => { if (video.src) sizeCanvas(); });
    video.addEventListener('loadeddata', sizeCanvas);

    // ---- playback ----
    $('cvr-play').onclick = () => {
      if (video.paused) { video.play(); $('cvr-play').textContent = '❚❚'; }
      else { video.pause(); $('cvr-play').textContent = '▶'; }
    };
    video.addEventListener('pause', () => $('cvr-play').textContent = '▶');
    video.addEventListener('play', () => $('cvr-play').textContent = '❚❚');
    $('cvr-prev').onclick = () => { video.pause(); video.currentTime = Math.max(0, video.currentTime - 1 / FPS); };
    $('cvr-next').onclick = () => { video.pause(); video.currentTime = Math.min(video.duration, video.currentTime + 1 / FPS); };
    $('cvr-speed').onclick = () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      video.playbackRate = speeds[speedIdx];
      $('cvr-speed').textContent = speeds[speedIdx] + '×';
    };
    $('cvr-scrub').oninput = e => {
      if (!video.duration) return;
      video.pause();
      video.currentTime = (e.target.value / 1000) * video.duration;
    };
    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      $('cvr-scrub').value = Math.round((video.currentTime / video.duration) * 1000);
      const t = video.currentTime;
      const mm = String(Math.floor(t / 60)).padStart(2, '0');
      const ss = String(Math.floor(t % 60)).padStart(2, '0');
      const cs = String(Math.floor((t % 1) * 100)).padStart(2, '0');
      $('cvr-time').textContent = `${mm}:${ss}.${cs} · frame ${Math.round(t * FPS)}`;
    });

    // ---- drawing ----
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    };
    let drawing = false;

    const start = e => {
      e.preventDefault();
      video.pause();
      const p = pos(e);
      if (tool === 'point') { shapes.push({ t: 'point', color, x: p.x, y: p.y }); redraw(); return; }
      if (tool === 'angle') {
        anglePts.push(p);
        if (anglePts.length === 3) {
          shapes.push({ t: 'angle', color, pts: anglePts.slice() });
          anglePts = [];
        }
        redraw(); return;
      }
      drawing = true;
      draft = { t: tool, color, x1: p.x, y1: p.y, x2: p.x, y2: p.y, pts: [p] };
    };
    const move = e => {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      draft.x2 = p.x; draft.y2 = p.y;
      if (draft.t === 'free') draft.pts.push(p);
      redraw();
    };
    const end = () => {
      if (!drawing) return;
      drawing = false;
      if (draft) shapes.push(draft);
      draft = null; redraw();
    };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('mousemove', move); canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('mouseup', end); canvas.addEventListener('touchend', end);
    canvas.addEventListener('mouseleave', end);

    $('cvr-undo').onclick = () => { if (anglePts.length) anglePts.pop(); else shapes.pop(); redraw(); };
    $('cvr-clear').onclick = () => { shapes = []; anglePts = []; draft = null; redraw(); };

    function drawShape(c, s) {
      c.strokeStyle = s.color; c.fillStyle = s.color;
      c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
      if (s.t === 'line') { c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.stroke(); }
      else if (s.t === 'circle') {
        const rx = Math.abs(s.x2 - s.x1) / 2, ry = Math.abs(s.y2 - s.y1) / 2;
        c.beginPath(); c.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, rx, ry, 0, 0, Math.PI * 2); c.stroke();
      } else if (s.t === 'free') {
        c.beginPath(); s.pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
      } else if (s.t === 'point') {
        c.beginPath(); c.moveTo(s.x - 9, s.y); c.lineTo(s.x + 9, s.y);
        c.moveTo(s.x, s.y - 9); c.lineTo(s.x, s.y + 9); c.stroke();
        c.beginPath(); c.arc(s.x, s.y, 3, 0, Math.PI * 2); c.fill();
      } else if (s.t === 'angle') {
        const [a, v, b] = s.pts;
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(v.x, v.y); c.lineTo(b.x, b.y); c.stroke();
        const a1 = Math.atan2(a.y - v.y, a.x - v.x), a2 = Math.atan2(b.y - v.y, b.x - v.x);
        let deg = Math.abs((a1 - a2) * 180 / Math.PI); if (deg > 180) deg = 360 - deg;
        c.beginPath(); c.arc(v.x, v.y, 26, Math.min(a1, a2), Math.max(a1, a2)); c.stroke();
        c.font = '600 15px sans-serif';
        const mid = (a1 + a2) / 2;
        c.fillText(Math.round(deg) + '°', v.x + Math.cos(mid) * 42 - 10, v.y + Math.sin(mid) * 42 + 5);
      }
    }

    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      shapes.forEach(s => drawShape(ctx, s));
      if (draft) drawShape(ctx, draft);
      if (anglePts.length) {
        ctx.fillStyle = color;
        anglePts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); });
      }
    }

    // ---- export: frame + annotations + caption ----
    function buildImage() {
      const w = canvas.width, h = canvas.height;
      const cap = $('cvr-caption').value.trim();
      const capH = cap ? 54 : 0;
      const out = document.createElement('canvas');
      out.width = w; out.height = h + capH;
      const c = out.getContext('2d');
      c.fillStyle = '#12291a'; c.fillRect(0, 0, out.width, out.height);
      c.drawImage(video, 0, 0, w, h);
      c.drawImage(canvas, 0, 0);
      if (cap) {
        c.fillStyle = '#12291a'; c.fillRect(0, h, w, capH);
        c.fillStyle = '#f0f7ec'; c.font = '15px sans-serif';
        const words = cap.split(' '); let line = '', y = h + 22;
        words.forEach(word => {
          if (c.measureText(line + word).width > w - 90 && line) { c.fillText(line, 12, y); line = ''; y += 20; }
          line += word + ' ';
        });
        c.fillText(line, 12, y);
      }
      c.fillStyle = '#d9f64b'; c.font = '600 12px sans-serif';
      c.fillText('COURTVISION', w - 108, h + (cap ? 42 : -12));
      return out;
    }

    const toBlob = cv => new Promise(res => cv.toBlob(res, 'image/png'));

    $('cvr-save').onclick = async () => {
      const blob = await toBlob(buildImage());
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'courtvision-' + Date.now() + '.png';
      a.click();
    };

    // ---- studio mode: video + tagging together -----------------------
    let tagger = null, mode = 'annotate';
    function setMode(m) {
      mode = m;
      document.querySelectorAll('.cvr-mode').forEach(b => b.classList.toggle('sel', b.dataset.mode === m));
      const tagging = (m === 'tag');
      $('cvr-annotate-only').style.display = tagging ? 'none' : 'block';
      $('cvr-tagpane').classList.toggle('show', tagging);
      $('cvr-rail').style.display = tagging ? 'none' : 'flex';
      canvas.style.pointerEvents = tagging ? 'none' : 'auto';
      if (tagging && !tagger && window.CourtVisionTagger) {
        tagger = window.CourtVisionTagger.create({
          mount: $('cvr-tagpane'),
          source: 'video',
          compact: true,
          getVideoTime: () => (video.src ? video.currentTime : null),
          videoName: () => $('cvr-name').textContent,
        });
      } else if (tagging && tagger) {
        tagger.refresh();
      }
    }
    document.querySelectorAll('.cvr-mode').forEach(b => b.onclick = () => setMode(b.dataset.mode));

    $('cvr-share').onclick = async () => {
      const blob = await toBlob(buildImage());
      const file = new File([blob], 'courtvision.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: $('cvr-caption').value.trim() || 'CourtVision analysis' });
        } catch (e) { /* user cancelled */ }
      } else {
        $('cvr-save').click();
        alert('Sharing not supported on this browser — image downloaded instead.');
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
