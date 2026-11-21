/* WebcamClicks — AI super-resolution worker (Swin2SR via transformers.js). The image is processed in overlapping
   tiles (so big photos fit in memory) and stitched without seams. Models are cached by the browser. */

const TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';
export const MODELS = {
  fast: { id: 'Xenova/swin2SR-lightweight-x2-64', scale: 2, light: true },   // ~1 M parameters: quick on any device
  photo: { id: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr', scale: 4 },
  jpeg: { id: 'Xenova/swin2SR-compressed-sr-x4-48', scale: 4 },
  sharp: { id: 'Xenova/swin2SR-classical-sr-x2-64', scale: 2 }
};
let T = null, gpu = null, f16 = false;
const pipes = new Map(), loaded = new Map();

async function hasGpu() {
  if (gpu == null) { try { const a = self.navigator.gpu && await self.navigator.gpu.requestAdapter(); gpu = !!a; f16 = !!(a && a.features && a.features.has('shader-f16')); } catch (_) { gpu = false; } }
  return gpu;
}

async function getModel(key) {
  if (!T) { T = await import(TRANSFORMERS); T.env.allowLocalModels = false; }
  const m = MODELS[key], g = await hasGpu();
  let lastErr = null;
  for (const device of g ? ['webgpu', 'wasm'] : ['wasm']) {
    const k = `${key}|${device}`;
    try {
      // graphics chip: half precision when supported; processor: 8-bit weights for the big models (2–3× faster)
      const dtype = device === 'webgpu' ? (f16 ? 'fp16' : 'fp32') : m.light ? 'fp32' : 'q8';
      if (!pipes.has(k)) pipes.set(k, T.pipeline('image-to-image', m.id, { device, dtype, progress_callback: (p) => {
        if (p.status !== 'progress' || !p.total) return;
        loaded.set(`${key}|${p.file}`, [p.loaded, p.total]);
        let l = 0, t = 0; for (const [f, [a, b]] of loaded) if (f.startsWith(`${key}|`)) { l += a; t += b; }
        self.postMessage({ type: 'model', key, state: 'downloading', loaded: l, total: t });
      } }));
      const up = await pipes.get(k);
      self.postMessage({ type: 'model', key, state: 'ready', device });
      return { up, scale: m.scale, device };
    } catch (e) { pipes.delete(k); lastErr = e; }
  }
  throw lastErr || new Error('Model unavailable');
}

/** Upscale RGBA pixels tile by tile. Each tile is read with a margin; only its centre is kept. */
async function run({ id, key, data, width, height }) {
  const { up, scale, device } = await getModel(key);
  self.postMessage({ id, type: 'status', text: `Upscaling on your ${device === 'webgpu' ? 'graphics chip' : 'processor'}…` });
  const TILE = device === 'webgpu' ? 256 : 128, M = 12;
  const t0 = performance.now();
  const OW = width * scale, OH = height * scale, out = new Uint8ClampedArray(OW * OH * 4);
  const tiles = [];
  for (let y = 0; y < height; y += TILE) for (let x = 0; x < width; x += TILE) tiles.push([x, y]);
  let done = 0;
  for (const [tx, ty] of tiles) {
    const tw = Math.min(TILE, width - tx), th = Math.min(TILE, height - ty);
    const x0 = Math.max(0, tx - M), y0 = Math.max(0, ty - M), x1 = Math.min(width, tx + tw + M), y1 = Math.min(height, ty + th + M);
    const w = x1 - x0, h = y1 - y0, rgb = new Uint8ClampedArray(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((y0 + y) * width + x0 + x) * 4, d = (y * w + x) * 3; rgb[d] = data[s]; rgb[d + 1] = data[s + 1]; rgb[d + 2] = data[s + 2]; }
    let res = await up(new T.RawImage(rgb, w, h, 3));
    if (Array.isArray(res)) res = res[0];
    const rc = res.channels || 3, rw = res.width, rd = res.data;
    // copy the tile's centre (without the margin) into place
    const ox = (tx - x0) * scale, oy = (ty - y0) * scale;
    for (let y = 0; y < th * scale; y++) for (let x = 0; x < tw * scale; x++) {
      const s = ((oy + y) * rw + ox + x) * rc, d = ((ty * scale + y) * OW + tx * scale + x) * 4;
      out[d] = rd[s]; out[d + 1] = rd[s + 1]; out[d + 2] = rd[s + 2]; out[d + 3] = 255;
    }
    // keep transparency: upscale alpha with the source (nearest), AI only handles colour
    done++;
    self.postMessage({ id, type: 'progress', done: done / tiles.length, elapsed: (performance.now() - t0) / 1000, device });
  }
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) out[(y * OW + x) * 4 + 3] = data[(((y / scale) | 0) * width + ((x / scale) | 0)) * 4 + 3];
  self.postMessage({ id, type: 'done', data: out, width: OW, height: OH, scale }, [out.buffer]);
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'preload') { try { await getModel(m.key); } catch (err) { self.postMessage({ type: 'model', key: m.key, state: 'error', error: String(err && err.message || err) }); } return; }
  if (m.type === 'run') { try { await run(m); } catch (err) { self.postMessage({ id: m.id, type: 'error', text: String(err && err.message || err) }); } }
};
