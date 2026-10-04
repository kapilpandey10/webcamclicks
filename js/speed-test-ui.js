/* ============================================================
   WebcamClicks — Speed Test UI & Canvas Gauge Controller (speed-test-ui.js)
   Renders the animated speedometer gauge, real-time speed curve graph,
   and application suitability matrix.
   ============================================================ */

import { SpeedTester } from './speed-test.js';
import { toast } from './utils.js';

let tester = null;
let currentResults = null;
let gaugeAnimId = null;
let targetGaugeSpeed = 0;
let currentGaugeSpeed = 0;
let particleList = [];

const el = {
  gaugeCanvas: document.getElementById('speed-gauge-canvas'),
  curveCanvas: document.getElementById('speed-curve-canvas'),
  btnStart: document.getElementById('btn-speed-start'),
  btnStop: document.getElementById('btn-speed-stop'),
  stageText: document.getElementById('speed-stage-label'),
  mainMbpsDisplay: document.getElementById('gauge-mbps-text'),
  
  // Dashboard cards
  pingVal: document.getElementById('stat-ping'),
  jitterVal: document.getElementById('stat-jitter'),
  downloadVal: document.getElementById('stat-download'),
  uploadVal: document.getElementById('stat-upload'),

  // Results panel
  resultsPanel: document.getElementById('speed-results-panel'),
  gradeBadge: document.getElementById('speed-grade-badge'),
  summaryText: document.getElementById('speed-summary-text'),
  appsGrid: document.getElementById('speed-apps-grid'),
  btnCopy: document.getElementById('btn-copy-speed'),
  btnTestAgain: document.getElementById('btn-test-again')
};

function init() {
  tester = new SpeedTester({
    onProgress: handleProgress,
    onStageChange: handleStageChange,
    onComplete: handleComplete
  });

  initParticles();
  startGaugeRenderLoop();

  el.btnStart.addEventListener('click', startTest);
  el.btnStop.addEventListener('click', stopTest);
  if (el.btnTestAgain) el.btnTestAgain.addEventListener('click', startTest);
  if (el.btnCopy) el.btnCopy.addEventListener('click', copyResults);
}

function initParticles() {
  particleList = [];
  for (let i = 0; i < 30; i++) {
    particleList.push({
      angle: Math.random() * Math.PI * 2,
      dist: 20 + Math.random() * 80,
      speed: 0.5 + Math.random() * 2,
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.2 + Math.random() * 0.6
    });
  }
}

async function startTest() {
  el.btnStart.style.display = 'none';
  el.btnStop.style.display = 'inline-flex';
  if (el.resultsPanel) el.resultsPanel.style.display = 'none';

  // Reset values
  targetGaugeSpeed = 0;
  currentGaugeSpeed = 0;
  el.pingVal.textContent = '—';
  el.jitterVal.textContent = '—';
  el.downloadVal.textContent = '—';
  el.uploadVal.textContent = '—';
  el.mainMbpsDisplay.textContent = '0.0';

  toast('🚀 Testing Internet Speed…');
  await tester.run();
}

function stopTest() {
  tester.abort();
  el.btnStart.style.display = 'inline-flex';
  el.btnStop.style.display = 'none';
  el.stageText.textContent = 'Ready to Test';
  toast('⏹️ Speed test stopped');
}

function handleStageChange(stage) {
  if (stage === 'ping') {
    el.stageText.textContent = '📡 Checking Ping & Latency…';
  } else if (stage === 'download') {
    el.stageText.textContent = '⬇️ Testing Download Speed…';
  } else if (stage === 'upload') {
    el.stageText.textContent = '⬆️ Testing Upload Speed…';
  } else if (stage === 'complete') {
    el.stageText.textContent = '✅ Speed Test Complete!';
    el.btnStart.style.display = 'inline-flex';
    el.btnStop.style.display = 'none';
  } else {
    el.stageText.textContent = 'Click Start to Begin';
    el.btnStart.style.display = 'inline-flex';
    el.btnStop.style.display = 'none';
  }
}

function handleProgress(data) {
  if (data.ping) el.pingVal.textContent = `${data.ping} ms`;
  if (data.jitter) el.jitterVal.textContent = `${data.jitter} ms`;

  if (data.stage === 'download') {
    targetGaugeSpeed = data.speedMbps;
    el.downloadVal.textContent = `${data.speedMbps.toFixed(1)} Mbps`;
    el.mainMbpsDisplay.textContent = data.speedMbps.toFixed(1);
    drawCurve(data.curve || []);
  } else if (data.stage === 'upload') {
    targetGaugeSpeed = data.speedMbps;
    el.uploadVal.textContent = `${data.speedMbps.toFixed(1)} Mbps`;
    el.mainMbpsDisplay.textContent = data.speedMbps.toFixed(1);
    drawCurve(data.curve || []);
  }
}

function handleComplete(results) {
  currentResults = results;
  targetGaugeSpeed = results.downloadMbps;

  el.downloadVal.textContent = `${results.downloadMbps.toFixed(1)} Mbps`;
  el.uploadVal.textContent = `${results.uploadMbps.toFixed(1)} Mbps`;
  el.pingVal.textContent = `${results.ping} ms`;
  el.jitterVal.textContent = `${results.jitter} ms`;

  if (el.resultsPanel) {
    el.gradeBadge.textContent = results.grade;
    el.gradeBadge.style.color = '#fff';
    el.gradeBadge.style.background = results.gradeColor;
    el.summaryText.textContent = results.summary;

    el.appsGrid.innerHTML = `
      <div class="app-chip"><span>4K Ultra HD Streaming</span><strong>${results.apps.stream4k}</strong></div>
      <div class="app-chip"><span>Zoom &amp; Video Calls</span><strong>${results.apps.videoCalls}</strong></div>
      <div class="app-chip"><span>Online Gaming &amp; Esports</span><strong>${results.apps.cloudGaming}</strong></div>
      <div class="app-chip"><span>Twitch/YouTube Broadcast</span><strong>${results.apps.liveStreaming}</strong></div>
    `;

    el.resultsPanel.style.display = 'block';
    el.resultsPanel.scrollIntoView({ behavior: 'smooth' });
  }

  toast('🎉 Speed Test Complete! View your performance report.');
}

/* ============================ Gauge Canvas Rendering ============================ */
function startGaugeRenderLoop() {
  const canvas = el.gaugeCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function render() {
    // Smooth gauge speed easing
    currentGaugeSpeed += (targetGaugeSpeed - currentGaugeSpeed) * 0.12;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2 + 15;
    const radius = Math.min(cx, cy) - 35;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw animated speed particles inside gauge
    const particleIntensity = Math.min(10, Math.max(0.5, currentGaugeSpeed / 20));
    ctx.fillStyle = '#ec4899';
    particleList.forEach((p) => {
      p.dist += p.speed * particleIntensity;
      if (p.dist > radius - 10) p.dist = 15;

      const px = cx + Math.cos(p.angle) * p.dist;
      const py = cy + Math.sin(p.angle) * p.dist;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Gauge Angles: from 135 deg to 405 deg (270 degree sweep)
    const startAngle = (135 * Math.PI) / 180;
    const endAngle = (405 * Math.PI) / 180;
    const totalSweep = endAngle - startAngle;

    // Logarithmic scale so 0 - 500+ Mbps renders naturally
    const maxSpeed = 300;
    const progress = Math.min(1, Math.max(0, currentGaugeSpeed / maxSpeed));
    const currentAngle = startAngle + totalSweep * progress;

    // 2. Track Background Ring
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fce7f3';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();

    // 3. Active Glowing Gradient Arc
    if (progress > 0.005) {
      const grad = ctx.createLinearGradient(0, cy, w, cy);
      grad.addColorStop(0, '#f43f5e');
      grad.addColorStop(0.5, '#ec4899');
      grad.addColorStop(1, '#d946ef');

      ctx.save();
      ctx.shadowColor = 'rgba(236, 72, 153, 0.45)';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = grad;
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, currentAngle);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Tick Marks & Scale Numbers
    const ticks = [0, 50, 100, 150, 200, 250, 300];
    ticks.forEach((val) => {
      const tProgress = val / maxSpeed;
      const tAngle = startAngle + totalSweep * tProgress;
      const innerR = radius - 20;
      const outerR = radius - 8;

      const x1 = cx + Math.cos(tAngle) * innerR;
      const y1 = cy + Math.sin(tAngle) * innerR;
      const x2 = cx + Math.cos(tAngle) * outerR;
      const y2 = cy + Math.sin(tAngle) * outerR;

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const labelR = radius - 34;
      const lx = cx + Math.cos(tAngle) * labelR;
      const ly = cy + Math.sin(tAngle) * labelR;

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${val}`, lx, ly);
    });

    // 5. Glowing Needle Indicator
    const needleR = radius - 6;
    const nx = cx + Math.cos(currentAngle) * needleR;
    const ny = cy + Math.sin(currentAngle) * needleR;

    ctx.save();
    ctx.shadowColor = 'rgba(219, 39, 119, 0.6)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#db2777';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    // Center pivot knob
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    gaugeAnimId = requestAnimationFrame(render);
  }

  gaugeAnimId = requestAnimationFrame(render);
}

/* ============================ Live Curve Graph ============================ */
function drawCurve(points) {
  const canvas = el.curveCanvas;
  if (!canvas || !points.length) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const maxVal = Math.max(...points, 50) * 1.2;
  const stepX = w / (points.length - 1 || 1);

  // Gradient fill area
  const areaGrad = ctx.createLinearGradient(0, 0, 0, h);
  areaGrad.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
  areaGrad.addColorStop(1, 'rgba(253, 242, 248, 0.05)');

  ctx.beginPath();
  ctx.moveTo(0, h);

  points.forEach((val, i) => {
    const x = i * stepX;
    const y = h - (val / maxVal) * (h - 10);
    ctx.lineTo(x, y);
  });

  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = areaGrad;
  ctx.fill();

  // Top line stroke
  ctx.beginPath();
  points.forEach((val, i) => {
    const x = i * stepX;
    const y = h - (val / maxVal) * (h - 10);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#db2777';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function copyResults() {
  if (!currentResults) return;
  const r = currentResults;
  const text = `🚀 Internet Speed Test Results:
• Download: ${r.downloadMbps} Mbps
• Upload: ${r.uploadMbps} Mbps
• Ping Latency: ${r.ping} ms (Jitter: ${r.jitter} ms)
• Connection Rating: ${r.grade}
Tested at https://webcamclicks.com/speed-test.html`;

  navigator.clipboard.writeText(text).then(() => {
    toast('📋 Speed test results copied to clipboard!');
  });
}

document.addEventListener('DOMContentLoaded', init);
