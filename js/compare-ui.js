/* ============================================================
   WebcamClicks — Dual Camera Comparison UI Controller (compare-ui.js)
   Controls live dual video feeds, device selectors, metrics overlay,
   side-by-side snapshot capture, and hardware comparison table.
   ============================================================ */

import { DualWebcamComparator } from './compare.js';
import { toast } from './utils.js';

let comparator = null;

const el = {
  videoA: document.getElementById('compare-video-a'),
  videoB: document.getElementById('compare-video-b'),
  selectA: document.getElementById('select-cam-a'),
  selectB: document.getElementById('select-cam-b'),
  btnStartBoth: document.getElementById('btn-start-both'),
  btnStopBoth: document.getElementById('btn-stop-both'),
  btnCaptureBoth: document.getElementById('btn-capture-compare'),
  btnMirrorA: document.getElementById('btn-mirror-a'),
  btnMirrorB: document.getElementById('btn-mirror-b'),

  resBadgeA: document.getElementById('badge-res-a'),
  fpsBadgeA: document.getElementById('badge-fps-a'),
  resBadgeB: document.getElementById('badge-res-b'),
  fpsBadgeB: document.getElementById('badge-fps-b'),

  tableBody: document.getElementById('compare-specs-body')
};

async function init() {
  comparator = new DualWebcamComparator({
    videoA: el.videoA,
    videoB: el.videoB,
    onMetricsA: (specs) => updateMetricsA(specs),
    onMetricsB: (specs) => updateMetricsB(specs)
  });

  await populateCameraDropdowns();

  el.btnStartBoth.addEventListener('click', onStartBoth);
  el.btnStopBoth.addEventListener('click', onStopBoth);
  el.selectA.addEventListener('change', () => onSwitchCamera('A'));
  el.selectB.addEventListener('change', () => onSwitchCamera('B'));

  el.btnMirrorA.addEventListener('click', () => {
    comparator.mirrorA = !comparator.mirrorA;
    el.videoA.style.transform = comparator.mirrorA ? 'scaleX(-1)' : 'none';
    toast(comparator.mirrorA ? '🪞 Camera A Mirrored' : 'Camera A Unmirrored');
  });

  el.btnMirrorB.addEventListener('click', () => {
    comparator.mirrorB = !comparator.mirrorB;
    el.videoB.style.transform = comparator.mirrorB ? 'scaleX(-1)' : 'none';
    toast(comparator.mirrorB ? '🪞 Camera B Mirrored' : 'Camera B Unmirrored');
  });

  el.btnCaptureBoth.addEventListener('click', () => {
    const labelA = el.selectA.options[el.selectA.selectedIndex]?.textContent || 'Camera 1';
    const labelB = el.selectB.options[el.selectB.selectedIndex]?.textContent || 'Camera 2';
    comparator.captureSideBySide(labelA, labelB);
    toast('📸 Comparison snapshot captured & downloaded!');
  });
}

async function populateCameraDropdowns() {
  const devices = await comparator.listDevices();
  el.selectA.innerHTML = '';
  el.selectB.innerHTML = '';

  if (!devices.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Default Camera';
    el.selectA.appendChild(opt);
    el.selectB.appendChild(opt.cloneNode(true));
    return;
  }

  devices.forEach((dev, idx) => {
    const optA = document.createElement('option');
    optA.value = dev.deviceId;
    optA.textContent = dev.label || `Camera ${idx + 1}`;
    el.selectA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = dev.deviceId;
    optB.textContent = dev.label || `Camera ${idx + 1}`;
    el.selectB.appendChild(optB);
  });

  // Pick second device by default for Camera B if available
  if (devices.length > 1) {
    el.selectB.selectedIndex = 1;
  }
}

async function onStartBoth() {
  try {
    el.btnStartBoth.disabled = true;
    el.btnStartBoth.textContent = 'Starting…';

    const idA = el.selectA.value || null;
    const idB = el.selectB.value || null;

    await comparator.startBoth(idA, idB);
    await populateCameraDropdowns();

    el.btnStartBoth.style.display = 'none';
    el.btnStopBoth.style.display = 'inline-flex';
    el.btnCaptureBoth.disabled = false;
    updateComparisonTable();
    toast('🎥 Both cameras connected successfully!');
  } catch (err) {
    console.error(err);
    toast('⚠️ Could not start dual cameras. Check permissions.');
  } finally {
    el.btnStartBoth.disabled = false;
    el.btnStartBoth.textContent = '🎥 Start Dual Comparison';
  }
}

function onStopBoth() {
  comparator.stopAll();
  el.btnStartBoth.style.display = 'inline-flex';
  el.btnStopBoth.style.display = 'none';
  el.btnCaptureBoth.disabled = true;
  el.resBadgeA.textContent = '—';
  el.fpsBadgeA.textContent = '— fps';
  el.resBadgeB.textContent = '—';
  el.fpsBadgeB.textContent = '— fps';
  toast('⏹️ Cameras stopped');
}

async function onSwitchCamera(which) {
  if (!comparator.active) return;
  try {
    if (which === 'A') {
      await comparator.startCameraA(el.selectA.value);
    } else {
      await comparator.startCameraB(el.selectB.value);
    }
    updateComparisonTable();
    toast(`🔄 Switched Camera ${which}`);
  } catch {
    toast(`⚠️ Could not switch Camera ${which}`);
  }
}

function updateMetricsA(specs) {
  if (!specs) return;
  el.resBadgeA.textContent = specs.resolution;
  el.fpsBadgeA.textContent = `${specs.fps} fps`;
}

function updateMetricsB(specs) {
  if (!specs) return;
  el.resBadgeB.textContent = specs.resolution;
  el.fpsBadgeB.textContent = `${specs.fps} fps`;
}

function updateComparisonTable() {
  const sA = comparator.getSpecsA();
  const sB = comparator.getSpecsB();
  if (!sA || !sB) return;

  const labelA = el.selectA.options[el.selectA.selectedIndex]?.textContent || 'Camera 1';
  const labelB = el.selectB.options[el.selectB.selectedIndex]?.textContent || 'Camera 2';

  el.tableBody.innerHTML = `
    <tr><td><strong>Device Name</strong></td><td>${labelA}</td><td>${labelB}</td></tr>
    <tr><td><strong>Active Resolution</strong></td><td>${sA.resolution}</td><td>${sB.resolution}</td></tr>
    <tr><td><strong>Aspect Ratio</strong></td><td>${sA.ratio}</td><td>${sB.ratio}</td></tr>
    <tr><td><strong>Live Frame Rate</strong></td><td>${sA.fps} FPS</td><td>${sB.fps} FPS</td></tr>
    <tr><td><strong>Megapixels (Estimate)</strong></td><td>${sA.width ? (sA.width * sA.height / 1e6).toFixed(1) + ' MP' : '—'}</td><td>${sB.width ? (sB.width * sB.height / 1e6).toFixed(1) + ' MP' : '—'}</td></tr>
  `;
}

document.addEventListener('DOMContentLoaded', init);
