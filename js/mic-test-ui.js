/* ============================================================
   WebcamClicks — Microphone Test UI Controller (mic-test-ui.js)
   Wires user controls, real-time visualizer, playback test,
   and diagnostic report rendering & export.
   ============================================================ */

import { MicrophoneTester } from './mic-test.js';
import { toast, downloadDataUrl } from './utils.js';

let tester = null;
let currentReport = null;

const el = {
  canvas: document.getElementById('mic-visualizer'),
  btnStart: document.getElementById('btn-mic-start'),
  btnStop: document.getElementById('btn-mic-stop'),
  micSelect: document.getElementById('mic-select'),
  dbLevel: document.getElementById('meter-db'),
  dbPeak: document.getElementById('meter-peak'),
  meterBar: document.getElementById('meter-bar-fill'),
  clipBadge: document.getElementById('badge-clip'),
  freqDisplay: document.getElementById('meter-freq'),
  
  /* Sample playback */
  btnRecordSample: document.getElementById('btn-record-sample'),
  sampleAudio: document.getElementById('sample-playback'),
  sampleStatus: document.getElementById('sample-status'),

  /* Report elements */
  btnGenerateReport: document.getElementById('btn-generate-report'),
  reportCard: document.getElementById('diagnostic-report'),
  reportScore: document.getElementById('report-score'),
  reportGrade: document.getElementById('report-grade'),
  reportSummary: document.getElementById('report-summary'),
  reportTable: document.getElementById('report-specs-body'),
  reportApps: document.getElementById('report-apps-grid'),
  reportRecs: document.getElementById('report-recs-list'),
  btnPrintReport: document.getElementById('btn-print-report'),
  btnCopyReport: document.getElementById('btn-copy-report'),
  btnDownloadReport: document.getElementById('btn-download-report')
};

function init() {
  tester = new MicrophoneTester({
    canvas: el.canvas,
    onMetrics: handleMetrics,
    onStateChange: handleStateChange
  });

  populateDevices();

  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', populateDevices);
  }

  el.btnStart.addEventListener('click', startTest);
  el.btnStop.addEventListener('click', stopTest);
  el.micSelect.addEventListener('change', onDeviceSwitch);
  el.btnRecordSample.addEventListener('click', recordSamplePhrase);
  el.btnGenerateReport.addEventListener('click', renderReport);
  el.btnPrintReport.addEventListener('click', () => window.print());
  el.btnCopyReport.addEventListener('click', copyReport);
  el.btnDownloadReport.addEventListener('click', downloadReport);
}

async function populateDevices() {
  const devices = await tester.listDevices();
  const currentVal = el.micSelect.value;
  el.micSelect.innerHTML = '';

  if (!devices.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Default System Microphone';
    el.micSelect.appendChild(opt);
    return;
  }

  devices.forEach((dev, idx) => {
    const opt = document.createElement('option');
    opt.value = dev.deviceId;
    opt.textContent = dev.label || `Microphone ${idx + 1}`;
    el.micSelect.appendChild(opt);
  });

  if (currentVal) el.micSelect.value = currentVal;
}

async function startTest() {
  try {
    el.btnStart.disabled = true;
    el.btnStart.textContent = 'Connecting…';
    const deviceId = el.micSelect.value || null;
    await tester.start(deviceId);
    await populateDevices();
    toast('🎙️ Microphone active! Speak to test volume & clarity.');
  } catch (err) {
    console.error(err);
    toast('⚠️ Could not access microphone. Please check permissions.');
  } finally {
    el.btnStart.textContent = '🎙️ Start Test';
    el.btnStart.disabled = false;
  }
}

function stopTest() {
  tester.stop();
  toast('⏹️ Microphone stopped.');
  resetMeterUI();
}

async function onDeviceSwitch(e) {
  const deviceId = e.target.value;
  if (tester.active) {
    try {
      await tester.switchDevice(deviceId);
      toast('🔄 Switched microphone');
    } catch {
      toast('⚠️ Could not switch to selected microphone');
    }
  }
}

function handleStateChange(isActive) {
  if (isActive) {
    el.btnStart.style.display = 'none';
    el.btnStop.style.display = 'inline-flex';
    el.btnRecordSample.disabled = false;
    el.btnGenerateReport.disabled = false;
  } else {
    el.btnStart.style.display = 'inline-flex';
    el.btnStop.style.display = 'none';
  }
}

function handleMetrics(m) {
  el.dbLevel.textContent = `${m.db} dB`;
  el.dbPeak.textContent = `${m.peakDb} dB`;
  el.freqDisplay.textContent = m.dominantFreq > 0 ? `${m.dominantFreq} Hz` : '—';

  el.meterBar.style.width = `${m.volumePercent}%`;
  if (m.clipping) {
    el.clipBadge.style.display = 'inline-block';
    el.meterBar.style.background = '#ef4444';
  } else {
    el.clipBadge.style.display = 'none';
    el.meterBar.style.background = 'var(--brand-grad)';
  }
}

function resetMeterUI() {
  el.dbLevel.textContent = '— dB';
  el.meterBar.style.width = '0%';
  el.clipBadge.style.display = 'none';
  el.freqDisplay.textContent = '—';
}

async function recordSamplePhrase() {
  if (!tester.active) {
    toast('Start microphone test first');
    return;
  }

  el.btnRecordSample.disabled = true;
  el.sampleStatus.textContent = 'Recording 5s sample... Speak now!';
  el.sampleAudio.style.display = 'none';

  const res = await tester.recordSample(5, (sec) => {
    el.btnRecordSample.textContent = `⏺️ Recording (${sec}s)…`;
  });

  el.btnRecordSample.disabled = false;
  el.btnRecordSample.textContent = '⏺️ Record 5s Test Sample';

  if (res && res.url) {
    el.sampleAudio.src = res.url;
    el.sampleAudio.style.display = 'block';
    el.sampleStatus.textContent = '✅ Sample recorded! Play below to verify audio clarity:';
    toast('🎉 Playback sample ready! Listen to hear your voice.');
  } else {
    el.sampleStatus.textContent = '⚠️ Could not capture audio sample.';
  }
}

function renderReport() {
  if (!tester.active && tester.sampleCount === 0) {
    toast('Run the microphone test for a few seconds first to capture data!');
    return;
  }

  currentReport = tester.generateReport();
  const r = currentReport;

  el.reportScore.textContent = `${r.score}/100`;
  el.reportGrade.textContent = r.status;
  el.reportGrade.className = `badge ${r.statusClass}`;
  el.reportSummary.textContent = r.summaryText;

  /* Hardware Table */
  el.reportTable.innerHTML = `
    <tr><td><strong>Device Name</strong></td><td>${r.device ? r.device.label : 'Microphone'}</td></tr>
    <tr><td><strong>Peak Input Level</strong></td><td>${r.metrics.peakDb} dB (Target: -24 dB to -6 dB)</td></tr>
    <tr><td><strong>Average RMS Level</strong></td><td>${r.metrics.avgDb} dB</td></tr>
    <tr><td><strong>Estimated Noise Floor</strong></td><td>${r.metrics.noiseFloorDb} dB (Lower is quieter)</td></tr>
    <tr><td><strong>Clipping Events</strong></td><td>${r.metrics.clippingEvents} (${r.metrics.clippingEvents === 0 ? 'Clean / No distortion' : 'Distortion detected'})</td></tr>
    <tr><td><strong>Sample Rate</strong></td><td>${r.metrics.sampleRate.toLocaleString()} Hz</td></tr>
    <tr><td><strong>Channel Format</strong></td><td>${r.metrics.channels}</td></tr>
    <tr><td><strong>Echo Cancellation</strong></td><td>${r.metrics.echoCancellation}</td></tr>
    <tr><td><strong>Noise Suppression</strong></td><td>${r.metrics.noiseSuppression}</td></tr>
  `;

  /* App Readiness Grid */
  el.reportApps.innerHTML = `
    <div class="app-chip"><span>Zoom Meetings</span><strong>${r.apps.zoom}</strong></div>
    <div class="app-chip"><span>Google Meet</span><strong>${r.apps.meet}</strong></div>
    <div class="app-chip"><span>Microsoft Teams</span><strong>${r.apps.teams}</strong></div>
    <div class="app-chip"><span>Discord Voice</span><strong>${r.apps.discord}</strong></div>
    <div class="app-chip"><span>Podcasting/Stream</span><strong>${r.apps.podcast}</strong></div>
  `;

  /* Recommendations */
  el.reportRecs.innerHTML = '';
  r.recommendations.forEach((rec) => {
    const li = document.createElement('li');
    li.textContent = rec;
    el.reportRecs.appendChild(li);
  });

  el.reportCard.style.display = 'block';
  el.reportCard.scrollIntoView({ behavior: 'smooth' });
  toast('📊 Diagnostic report generated successfully!');
}

function getReportText() {
  if (!currentReport) return '';
  const r = currentReport;
  return `=== WEBCAMCLICKS MICROPHONE DIAGNOSTIC REPORT ===
Date: ${r.formattedDate}
Device: ${r.device ? r.device.label : 'Microphone'}
Overall Score: ${r.score} / 100 (${r.status})
Summary: ${r.summaryText}

--- AUDIO METRICS ---
- Peak Volume: ${r.metrics.peakDb} dB
- Average Volume: ${r.metrics.avgDb} dB
- Noise Floor: ${r.metrics.noiseFloorDb} dB
- Sample Rate: ${r.metrics.sampleRate} Hz
- Channel Configuration: ${r.metrics.channels}
- Distortion / Clipping Events: ${r.metrics.clippingEvents}

--- APPLICATION COMPATIBILITY ---
- Zoom: ${r.apps.zoom}
- Google Meet: ${r.apps.meet}
- Microsoft Teams: ${r.apps.teams}
- Discord: ${r.apps.discord}
- Podcasting/Streaming: ${r.apps.podcast}

--- RECOMMENDATIONS ---
${r.recommendations.map((rec) => `• ${rec}`).join('\n')}

Generated at https://webcamclicks.com/mic-test.html
100% on-device private audio diagnostics.`;
}

async function copyReport() {
  const text = getReportText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast('📋 Full report copied to clipboard!');
  } catch {
    toast('⚠️ Could not copy report to clipboard');
  }
}

function downloadReport() {
  const text = getReportText();
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, `webcamclicks-mic-report-${Date.now()}.txt`);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('⬇️ Downloading report text file…');
}

document.addEventListener('DOMContentLoaded', init);
