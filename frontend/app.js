/* ═══════════════════════════════════════════════════════
   AURA — Frontend Controller
   ═══════════════════════════════════════════════════════ */

const API  = `${location.protocol}//${location.host}/api`;
const WS   = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;

/* ── State ── */
let scenarioId   = null;
let ws           = null;
let currentImg   = null;   // Image object for REAL VIEW
let currentView  = 'real'; // 'real' | 'diff' | 'heatmap'
let lastDefects  = [];
let savedObs1    = null;   // score from observation 1
let inspRunning  = false;
let inspId       = Math.floor(Math.random() * 9000 + 1000);

/* ── DOM refs ── */
const $ = id => document.getElementById(id);

const canvas  = $('inspection-canvas');
const ctx     = canvas.getContext('2d');

const scenarioList = $('scenario-list');
const btnStart     = $('btn-start');
const btnReset     = $('btn-reset');
const fsmState     = $('fsm-state');
const timeline     = $('timeline');
const scanLine     = $('scan-line');

// Telemetry
const telPos    = $('tel-pos');
const telCam    = $('tel-cam');
const telLight  = $('tel-light');
const telAction = $('tel-action');
const camLabel  = $('cam-label');

// Scores
const valScore   = $('val-score');
const gaugeNeedle = $('gauge-needle');
const valConf    = $('val-conf');
const confFill   = $('conf-fill');

// Evidence
const evidenceBlock = $('evidence-block');
const evObs1  = $('ev-obs1');
const evObs2  = $('ev-obs2');
const evFused = $('ev-fused');

// Decision
const decisionCard   = $('decision-card');
const decisionResult = $('decision-result');
const decisionAction = $('decision-action');
const reasonList     = $('reason-list');

$('inspection-id').textContent = `#AURA-${inspId}`;

/* ═══════════════ SCENARIOS ═══════════════ */

const SCENARIO_META = {
    clean_board:      { badge: 'pass',    badgeText: 'PASS PATH',    hint: 'Defect-free board. AURA should quickly confirm PASS.' },
    obvious_defect:   { badge: 'fail',    badgeText: 'FAIL PATH',    hint: 'Clearly damaged trace. AURA should detect immediately.' },
    ambiguous_recheck:{ badge: 'recheck', badgeText: 'RECHECK PATH', hint: 'Subtle anomaly. AURA must change viewpoint and re-examine.' }
};

async function loadScenarios() {
    try {
        const res = await fetch(`${API}/scenarios`);
        const scenarios = await res.json();
        scenarioList.innerHTML = '';

        scenarios.forEach(s => {
            const meta = SCENARIO_META[s.id] || { badge: '', badgeText: '', hint: '' };
            const card = document.createElement('div');
            card.className = 'scenario-card';
            card.dataset.id = s.id;
            card.innerHTML = `
                <span class="sc-badge ${meta.badge}">${meta.badgeText}</span>
                <div class="sc-name">${s.name}</div>
                <div class="sc-desc">${meta.hint}</div>
            `;
            card.onclick = () => selectScenario(s.id, card);
            scenarioList.appendChild(card);
        });
    } catch (e) {
        console.error('Failed to load scenarios', e);
    }
}

function selectScenario(id, card) {
    if (inspRunning) return;
    document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    scenarioId = id;
    btnStart.disabled = false;
}

/* ═══════════════ WEBSOCKET ═══════════════ */

function connectWS() {
    ws = new WebSocket(WS);
    ws.onmessage = e => handleMsg(JSON.parse(e.data));
    ws.onclose   = () => setTimeout(connectWS, 2000);
    ws.onerror   = () => {};
}

/* ═══════════════ VIEW TOGGLE ═══════════════ */

document.querySelectorAll('.vt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.vt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        redraw();
    });
});

/* ═══════════════ CANVAS RENDERING ═══════════════ */

function loadImage(path, cb) {
    if (!path) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/' + path;
    img.onload = () => cb(img);
}

function drawOnCanvas(img) {
    currentImg = img;
    redraw();
}

function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentView === 'diff') {
        const diffImg = new Image();
        diffImg.src = '/data/pcb/test/current_diff.jpg?t=' + Date.now();
        diffImg.onload = () => { fitAndDraw(diffImg); drawDefectOverlays(); };
        diffImg.onerror = () => { if (currentImg) { fitAndDraw(currentImg); drawDefectOverlays(); } };
        return;
    }
    if (currentView === 'heatmap') {
        const heatImg = new Image();
        heatImg.src = '/data/pcb/test/current_heatmap.jpg?t=' + Date.now();
        heatImg.onload = () => { fitAndDraw(heatImg); drawDefectOverlays(); };
        heatImg.onerror = () => { if (currentImg) { fitAndDraw(currentImg); drawDefectOverlays(); } };
        return;
    }

    if (!currentImg) return;
    fitAndDraw(currentImg);
    drawDefectOverlays();
}

function fitAndDraw(img) {
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.drawImage(img, x, y, w, h);
}

function getImageTransform() {
    if (!currentImg) return { x: 0, y: 0, scale: 1 };
    const scale = Math.min(canvas.width / currentImg.width, canvas.height / currentImg.height);
    const w = currentImg.width * scale;
    const h = currentImg.height * scale;
    return { x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, scale };
}

function drawDefectOverlays() {
    if (!lastDefects.length) return;
    const t = getImageTransform();

    lastDefects.forEach(d => {
        const bx = t.x + d.bbox.x * t.scale;
        const by = t.y + d.bbox.y * t.scale;
        const bw = d.bbox.w * t.scale;
        const bh = d.bbox.h * t.scale;

        const isCrit = d.severity === 'CRITICAL' || d.severity === 'HIGH';
        const color = isCrit ? '#FF3B30' : '#FFB300';

        // Bounding box — thin, precise, professional
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        // Corner brackets
        const cs = Math.min(bw, bh, 12);
        ctx.lineWidth = 2;
        // TL
        ctx.beginPath(); ctx.moveTo(bx, by + cs); ctx.lineTo(bx, by); ctx.lineTo(bx + cs, by); ctx.stroke();
        // TR
        ctx.beginPath(); ctx.moveTo(bx + bw - cs, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cs); ctx.stroke();
        // BL
        ctx.beginPath(); ctx.moveTo(bx, by + bh - cs); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cs, by + bh); ctx.stroke();
        // BR
        ctx.beginPath(); ctx.moveTo(bx + bw - cs, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cs); ctx.stroke();

        // Label
        const label = `${d.severity}  ${d.defect_type.replace(/_/g, ' ').toUpperCase()}`;
        ctx.font = '600 10px "JetBrains Mono"';
        const tw = ctx.measureText(label).width + 10;
        const lx = bx;
        const ly = by - 4;
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(lx, ly - 14, tw, 16);
        ctx.fillStyle = color;
        ctx.fillText(label, lx + 5, ly - 2);
    });
}

/* ═══════════════ TIMELINE ═══════════════ */

function renderTimeline(items) {
    timeline.innerHTML = '';
    items.forEach((t, i) => {
        const step = document.createElement('div');
        const isLast = i === items.length - 1;
        step.className = `tl-step ${isLast ? 'active' : 'done'}`;
        const ts = new Date(t.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        step.innerHTML = `
            <span class="tl-time">${ts}</span>
            <span class="tl-event">${t.event}</span>
            <span class="tl-desc">${t.desc}</span>
        `;
        timeline.appendChild(step);
    });
    timeline.scrollLeft = timeline.scrollWidth;
}

/* ═══════════════ MESSAGE HANDLER ═══════════════ */

function handleMsg(msg) {
    if (msg.type === 'state_update') {
        const state = msg.state;
        const stateLC = state.toLowerCase();

        // FSM
        fsmState.textContent = state;
        fsmState.className = 'state-text ' + stateLC;
        document.body.className = 'state-' + stateLC;

        // Telemetry
        telAction.textContent = state;

        if (state === 'POSITIONING') {
            scanLine.classList.remove('active');
            if (msg.rechecks > 0) {
                fsmState.textContent = 'RECHECK REQUIRED';
                fsmState.className = 'state-text rechecking';
                telPos.textContent = 'X:160  Y:105  Z:150 mm';
                telCam.textContent = '35° ANGLED';
                telLight.textContent = 'ANGLED';
                telAction.textContent = 'CHANGING VIEWPOINT';
                camLabel.innerHTML = '<span>CAMERA 02</span><span>CLOSE-UP · 35° ANGLED</span>';
            } else {
                telPos.textContent = 'X:150  Y:100  Z:300 mm';
                telCam.textContent = '0° DIRECT';
                telLight.textContent = 'DIRECT';
                camLabel.innerHTML = '<span>CAMERA 01</span><span>DIRECT VIEW</span>';
            }
        }

        if (state === 'ANALYZING' || state === 'ACQUIRING') {
            scanLine.classList.add('active');
        } else {
            scanLine.classList.remove('active');
        }

        if (state === 'FUSING') {
            telAction.textContent = 'FUSING EVIDENCE';
        }

        // Image
        if (msg.current_image_path) {
            loadImage(msg.current_image_path, img => drawOnCanvas(img));
        }

        // Defects (real-time during analysis)
        if (msg.defects && msg.defects.length > 0) {
            lastDefects = msg.defects;
            redraw();
        }

        // Scores
        if (msg.current_score != null) {
            const s = msg.current_score;
            valScore.textContent = s.toFixed(3);
            gaugeNeedle.style.left = (s * 100).toFixed(1) + '%';

            // Color the score value
            if (s < 0.3) valScore.style.color = 'var(--green)';
            else if (s < 0.7) valScore.style.color = 'var(--amber)';
            else valScore.style.color = 'var(--red)';
        }

        // Per-observation scores for the fusion diagram
        if (msg.obs_scores && msg.obs_scores.length > 0) {
            evObs1.textContent = msg.obs_scores[0].toFixed(3);
            savedObs1 = msg.obs_scores[0];
            if (msg.obs_scores.length > 1) {
                evObs2.textContent = msg.obs_scores[1].toFixed(3);
            }
        }

        // Fused score
        if (msg.fused_score != null) {
            evidenceBlock.classList.remove('hidden');
            evFused.textContent = msg.fused_score.toFixed(3);
        }

        // Timeline
        if (msg.timeline) renderTimeline(msg.timeline);

    } else if (msg.type === 'inspection_complete') {
        inspRunning = false;
        document.body.className = 'state-complete';
        fsmState.textContent = 'COMPLETE';
        fsmState.className = 'state-text complete';
        scanLine.classList.remove('active');

        // Decision
        decisionCard.classList.remove('hidden', 'pass', 'fail');
        decisionCard.classList.add(msg.decision.toLowerCase());
        decisionResult.textContent = msg.decision;
        decisionAction.textContent = msg.decision === 'FAIL'
            ? '→ ROUTE TO REJECT BIN'
            : '→ RELEASE TO PRODUCTION';

        // Confidence
        if (msg.confidence != null) {
            const pct = (msg.confidence * 100).toFixed(1);
            valConf.textContent = pct + '%';
            confFill.style.width = pct + '%';
        }

        // Fused score
        if (msg.fused_score != null) {
            evidenceBlock.classList.remove('hidden');
            evFused.textContent = msg.fused_score.toFixed(3);
        }

        // Reasoning
        if (msg.reasoning && msg.reasoning.length) {
            reasonList.innerHTML = '';
            msg.reasoning.forEach(r => {
                const li = document.createElement('li');
                li.textContent = r;
                reasonList.appendChild(li);
            });
        }

        // Final image + defects
        if (msg.defects) lastDefects = msg.defects;
        if (msg.final_image) {
            loadImage(msg.final_image, img => drawOnCanvas(img));
        } else {
            redraw();
        }

        btnStart.disabled = false;
        btnStart.textContent = 'START INSPECTION';

    } else if (msg.type === 'error') {
        inspRunning = false;
        fsmState.textContent = 'ERROR';
        fsmState.className = 'state-text error';
        telAction.textContent = 'HALTED';
        scanLine.classList.remove('active');
        btnStart.disabled = false;
        btnStart.textContent = 'START INSPECTION';
    }
}

/* ═══════════════ ACTIONS ═══════════════ */

btnStart.onclick = async () => {
    if (!scenarioId || inspRunning) return;
    inspRunning = true;
    const id = scenarioId;
    resetUI(false);
    // re-select card
    document.querySelectorAll('.scenario-card').forEach(c => {
        if (c.dataset.id === id) { c.classList.add('active'); scenarioId = id; }
    });
    btnStart.disabled = true;
    btnStart.textContent = 'RUNNING...';

    try {
        await fetch(`${API}/inspection/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenario_id: scenarioId })
        });
    } catch (e) {
        console.error('Start inspection failed', e);
        inspRunning = false;
        btnStart.disabled = false;
        btnStart.textContent = 'START INSPECTION';
    }
};

btnReset.onclick = () => resetUI(true);

function resetUI(full) {
    // Scores
    valScore.textContent = '—';
    valScore.style.color = '';
    gaugeNeedle.style.left = '0%';
    valConf.textContent = '—';
    confFill.style.width = '0%';

    // Evidence
    evidenceBlock.classList.add('hidden');
    evObs1.textContent = '—';
    evObs2.textContent = '—';
    evFused.textContent = '—';
    savedObs1 = null;

    // Decision
    decisionCard.classList.add('hidden');
    decisionCard.classList.remove('pass', 'fail');
    decisionResult.textContent = '—';
    decisionAction.textContent = '—';

    // Reasoning
    reasonList.innerHTML = '<li>System idle. Select a scenario and start inspection.</li>';

    // Timeline
    timeline.innerHTML = '';

    // Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    currentImg = null;
    lastDefects = [];
    scanLine.classList.remove('active');

    // Telemetry
    telPos.textContent = 'X:150  Y:100  Z:300 mm';
    telCam.textContent = '0° DIRECT';
    telLight.textContent = 'DIRECT';
    telAction.textContent = 'IDLE';
    camLabel.innerHTML = '<span>CAMERA 01</span><span>DIRECT VIEW</span>';

    // FSM
    fsmState.textContent = 'IDLE';
    fsmState.className = 'state-text';
    document.body.className = 'state-idle';

    // View toggle reset
    currentView = 'real';
    document.querySelectorAll('.vt-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.vt-btn[data-view="real"]').classList.add('active');

    if (full) {
        document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));
        scenarioId = null;
        btnStart.disabled = true;
        inspRunning = false;
    }
    btnStart.textContent = 'START INSPECTION';
}

/* ═══════════════ INIT ═══════════════ */
loadScenarios();
connectWS();
