/**
 * 360 CAM — Spherical Equirectangular Stitcher & Blending Engine
 * Transforms camera snapshots with known yaw/pitch/roll vectors into a
 * seamless 2:1 equirectangular panoramic image with multi-band feathered border blending,
 * ambient polar infill, and Adobe/Google GPano XMP photosphere metadata injection.
 */

export class SphericalStitcher {
  constructor(options = {}) {
    this.panoWidth = options.width || 2048;
    this.panoHeight = options.height || 1024;
  }

  /**
   * Stitch multiple captured frames into an equirectangular canvas
   * @param {Array<{canvas: HTMLCanvasElement, yaw: number, pitch: number, roll: number, fovH: number, fovV: number}>} frames
   * @param {Function} onProgress (percent, statusText)
   * @returns {Promise<HTMLCanvasElement>}
   */
  async stitch(frames, onProgress = () => {}) {
    if (!frames || frames.length === 0) {
      throw new Error('No frames provided for 360 stitching');
    }

    const W = this.panoWidth;
    const H = this.panoHeight;

    onProgress(10, 'Initializing 2:1 spherical projection buffer...');
    await this._yield();

    // Accumulator buffers for weighted color blending
    const rAccum = new Float32Array(W * H);
    const gAccum = new Float32Array(W * H);
    const bAccum = new Float32Array(W * H);
    const wAccum = new Float32Array(W * H);

    const totalFrames = frames.length;

    // Process each frame into the equirectangular buffer
    for (let fIdx = 0; fIdx < totalFrames; fIdx++) {
      const frame = frames[fIdx];
      const percent = Math.round(15 + ((fIdx + 1) / totalFrames) * 60);
      onProgress(percent, `Projecting frame ${fIdx + 1} of ${totalFrames} (${Math.round(frame.yaw)}° yaw)...`);
      await this._yield();

      this._projectFrame(frame, rAccum, gAccum, bAccum, wAccum, W, H);
    }

    onProgress(80, 'Feathering seams and infilling ambient sky/ground caps...');
    await this._yield();

    // Create final panorama canvas
    const panoCanvas = document.createElement('canvas');
    panoCanvas.width = W;
    panoCanvas.height = H;
    const ctx = panoCanvas.getContext('2d');
    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;

    // First pass: normalize covered pixels and find min/max covered latitudes
    let minCoveredY = H;
    let maxCoveredY = 0;
    const topRowColors = { r: 0, g: 0, b: 0, count: 0 };
    const bottomRowColors = { r: 0, g: 0, b: 0, count: 0 };

    for (let y = 0; y < H; y++) {
      let rowHasCoverage = false;
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const w = wAccum[idx];
        if (w > 0.0001) {
          rowHasCoverage = true;
          const r = Math.min(255, Math.max(0, Math.round(rAccum[idx] / w)));
          const g = Math.min(255, Math.max(0, Math.round(gAccum[idx] / w)));
          const b = Math.min(255, Math.max(0, Math.round(bAccum[idx] / w)));
          const pIdx = idx * 4;
          data[pIdx] = r;
          data[pIdx + 1] = g;
          data[pIdx + 2] = b;
          data[pIdx + 3] = 255;
        }
      }
      if (rowHasCoverage) {
        if (y < minCoveredY) minCoveredY = y;
        if (y > maxCoveredY) maxCoveredY = y;
      }
    }

    // Sample average colors of top and bottom covered rows for seamless polar infill
    for (let x = 0; x < W; x++) {
      if (minCoveredY < H) {
        const topIdx = (minCoveredY * W + x) * 4;
        if (data[topIdx + 3] === 255) {
          topRowColors.r += data[topIdx];
          topRowColors.g += data[topIdx + 1];
          topRowColors.b += data[topIdx + 2];
          topRowColors.count++;
        }
      }
      if (maxCoveredY >= 0) {
        const btmIdx = (maxCoveredY * W + x) * 4;
        if (data[btmIdx + 3] === 255) {
          bottomRowColors.r += data[btmIdx];
          bottomRowColors.g += data[btmIdx + 1];
          bottomRowColors.b += data[btmIdx + 2];
          bottomRowColors.count++;
        }
      }
    }

    const avgTop = topRowColors.count > 0 ? {
      r: Math.round(topRowColors.r / topRowColors.count),
      g: Math.round(topRowColors.g / topRowColors.count),
      b: Math.round(topRowColors.b / topRowColors.count)
    } : { r: 35, g: 65, b: 110 };

    const avgBottom = bottomRowColors.count > 0 ? {
      r: Math.round(bottomRowColors.r / bottomRowColors.count),
      g: Math.round(bottomRowColors.g / bottomRowColors.count),
      b: Math.round(bottomRowColors.b / bottomRowColors.count)
    } : { r: 25, g: 25, b: 30 };

    // Infill zenith (sky) and nadir (floor) gaps with smooth ambient gradient
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const pIdx = idx * 4;

        if (data[pIdx + 3] === 0) {
          // Uncovered pixel
          if (y < minCoveredY) {
            // Zenith sky gradient
            const t = Math.max(0, y / Math.max(1, minCoveredY));
            const skyR = Math.round(15 * (1 - t) + avgTop.r * t);
            const skyG = Math.round(35 * (1 - t) + avgTop.g * t);
            const skyB = Math.round(75 * (1 - t) + avgTop.b * t);
            data[pIdx] = skyR;
            data[pIdx + 1] = skyG;
            data[pIdx + 2] = skyB;
            data[pIdx + 3] = 255;
          } else if (y > maxCoveredY) {
            // Nadir ground gradient
            const t = Math.max(0, (y - maxCoveredY) / Math.max(1, H - maxCoveredY));
            const gndR = Math.round(avgBottom.r * (1 - t) + 12 * t);
            const gndG = Math.round(avgBottom.g * (1 - t) + 12 * t);
            const gndB = Math.round(avgBottom.b * (1 - t) + 18 * t);
            data[pIdx] = gndR;
            data[pIdx + 1] = gndG;
            data[pIdx + 2] = gndB;
            data[pIdx + 3] = 255;
          } else {
            // Gap between frames: sample nearest horizontal covered pixel
            let leftCovered = null;
            let rightCovered = null;
            for (let offset = 1; offset < 40; offset++) {
              const lx = (x - offset + W) % W;
              const rx = (x + offset) % W;
              const lIdx = (y * W + lx) * 4;
              const rIdx = (y * W + rx) * 4;
              if (data[lIdx + 3] === 255 && !leftCovered) leftCovered = lIdx;
              if (data[rIdx + 3] === 255 && !rightCovered) rightCovered = rIdx;
              if (leftCovered && rightCovered) break;
            }
            const src = leftCovered || rightCovered;
            if (src) {
              data[pIdx] = data[src];
              data[pIdx + 1] = data[src + 1];
              data[pIdx + 2] = data[src + 2];
              data[pIdx + 3] = 255;
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    onProgress(100, '360 panorama ready!');
    return panoCanvas;
  }

  /**
   * Project a single rectilinear camera snapshot into the equirectangular accumulator
   */
  _projectFrame(frame, rAccum, gAccum, bAccum, wAccum, panoW, panoH) {
    const srcCanvas = frame.canvas;
    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
    const srcData = srcImgData.data;

    // Angles in radians
    const yawRad = ((frame.yaw % 360) * Math.PI) / 180;
    const pitchRad = (frame.pitch * Math.PI) / 180;
    const rollRad = (frame.roll * Math.PI) / 180;

    // Field of view in radians
    const fovHRad = ((frame.fovH || 65) * Math.PI) / 180;
    const fovVRad = ((frame.fovV || 80) * Math.PI) / 180;

    const focalX = (srcW / 2) / Math.tan(fovHRad / 2);
    const focalY = (srcH / 2) / Math.tan(fovVRad / 2);

    // Compute camera coordinate basis vectors in world space
    // Standard rotation order: Yaw (Y) * Pitch (X) * Roll (Z)
    const cy = Math.cos(yawRad);
    const sy = Math.sin(yawRad);
    const cp = Math.cos(pitchRad);
    const sp = Math.sin(pitchRad);
    const cr = Math.cos(rollRad);
    const sr = Math.sin(rollRad);

    // Forward optical vector (camera pointing direction)
    const fwdX = sy * cp;
    const fwdY = sp;
    const fwdZ = cy * cp;

    // Right vector
    const rgtX = cy * cr + sy * sp * sr;
    const rgtY = -cp * sr;
    const rgtZ = -sy * cr + cy * sp * sr;

    // Up vector
    const upX = -cy * sr + sy * sp * cr;
    const upY = cp * cr;
    const upZ = sy * sr + cy * sp * cr;

    // Compute bounding box on equirectangular map to avoid evaluating all pixels
    const maxAngle = Math.max(fovHRad, fovVRad) * 0.75;
    const minLat = pitchRad - maxAngle;
    const maxLat = pitchRad + maxAngle;

    const yStart = Math.max(0, Math.floor(((Math.PI / 2 - maxLat) / Math.PI) * panoH));
    const yEnd = Math.min(panoH - 1, Math.ceil(((Math.PI / 2 - minLat) / Math.PI) * panoH));

    const halfSpanX = Math.ceil((maxAngle / (2 * Math.PI)) * panoW * 1.5);
    const centerX = Math.floor((yawRad / (2 * Math.PI)) * panoW);

    for (let y = yStart; y <= yEnd; y++) {
      const phi = Math.PI / 2 - (y / panoH) * Math.PI; // Latitude: -pi/2 to pi/2
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);

      for (let dx = -halfSpanX; dx <= halfSpanX; dx++) {
        const x = ((centerX + dx) % panoW + panoW) % panoW;
        const lambda = (x / panoW) * 2 * Math.PI; // Longitude: 0 to 2pi

        // Point on unit sphere
        const px = cosPhi * Math.sin(lambda);
        const py = sinPhi;
        const pz = cosPhi * Math.cos(lambda);

        // Project point onto camera coordinate frame
        const zCam = px * fwdX + py * fwdY + pz * fwdZ;

        if (zCam > 0.05) {
          const xCam = px * rgtX + py * rgtY + pz * rgtZ;
          const yCam = px * upX + py * upY + pz * upZ;

          // Camera pinhole projection
          const u = srcW / 2 + (xCam / zCam) * focalX;
          const v = srcH / 2 - (yCam / zCam) * focalY;

          if (u >= 0 && u < srcW && v >= 0 && v < srcH) {
            // Bilinear feathering weight based on distance to frame edge
            const edgeDistX = Math.min(u, srcW - 1 - u) / (srcW / 2);
            const edgeDistY = Math.min(v, srcH - 1 - v) / (srcH / 2);
            const rawWeight = Math.min(edgeDistX, edgeDistY);

            // Cosine smooth feathering
            const weight = Math.min(1.0, Math.max(0.0, Math.sin(Math.min(1.0, rawWeight * 4.5) * Math.PI * 0.5)));

            if (weight > 0.001) {
              const uInt = Math.floor(u);
              const vInt = Math.floor(v);
              const sIdx = (vInt * srcW + uInt) * 4;

              const r = srcData[sIdx];
              const g = srcData[sIdx + 1];
              const b = srcData[sIdx + 2];

              const pIdx = y * panoW + x;
              rAccum[pIdx] += r * weight;
              gAccum[pIdx] += g * weight;
              bAccum[pIdx] += b * weight;
              wAccum[pIdx] += weight;
            }
          }
        }
      }
    }
  }

  /**
   * Inject Google Photo Sphere / Facebook 360 XMP metadata into standard JPEG Blob
   * @param {Blob} jpegBlob
   * @param {number} width
   * @param {number} height
   * @returns {Promise<Blob>}
   */
  async injectGPanoMetadata(jpegBlob, width = 2048, height = 1024) {
    const arrayBuffer = await jpegBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Verify JPEG SOI marker (0xFF 0xD8)
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      return jpegBlob; // Not standard JPEG, return as is
    }

    const xmpXml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"><GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer><GPano:CaptureSoftware>WebcamClicks 360 CAM</GPano:CaptureSoftware><GPano:ProjectionType>equirectangular</GPano:ProjectionType><GPano:PoseHeadingDegrees>0.0</GPano:PoseHeadingDegrees><GPano:PosePitchDegrees>0.0</GPano:PosePitchDegrees><GPano:PoseRollDegrees>0.0</GPano:PoseRollDegrees><GPano:CroppedAreaImageWidthPixels>${width}</GPano:CroppedAreaImageWidthPixels><GPano:CroppedAreaImageHeightPixels>${height}</GPano:CroppedAreaImageHeightPixels><GPano:FullPanoWidthPixels>${width}</GPano:FullPanoWidthPixels><GPano:FullPanoHeightPixels>${height}</GPano:FullPanoHeightPixels><GPano:CroppedAreaLeftPixels>0</GPano:CroppedAreaLeftPixels><GPano:CroppedAreaTopPixels>0</GPano:CroppedAreaTopPixels></rdf:Description></rdf:RDF></x:xmpmeta>`;

    const encoder = new TextEncoder();
    const xmpPayload = encoder.encode(xmpXml);
    const xmpHeader = encoder.encode('http://ns.adobe.com/xap/1.0/\0');

    const totalPayloadLen = xmpHeader.length + xmpPayload.length;
    const markerLen = totalPayloadLen + 2;

    // Create APP1 marker
    const app1Header = new Uint8Array([
      0xFF, 0xE1,
      (markerLen >> 8) & 0xFF,
      markerLen & 0xFF
    ]);

    // Build final injected JPEG buffer: SOI (2 bytes) + APP1 (4 bytes + payload) + rest of original JPEG
    const totalLength = 2 + app1Header.length + totalPayloadLen + (bytes.length - 2);
    const resultBuffer = new Uint8Array(totalLength);

    // SOI
    resultBuffer[0] = 0xFF;
    resultBuffer[1] = 0xD8;

    let offset = 2;
    resultBuffer.set(app1Header, offset);
    offset += app1Header.length;

    resultBuffer.set(xmpHeader, offset);
    offset += xmpHeader.length;

    resultBuffer.set(xmpPayload, offset);
    offset += xmpPayload.length;

    // Remaining JPEG payload (starting from index 2)
    resultBuffer.set(bytes.subarray(2), offset);

    return new Blob([resultBuffer], { type: 'image/jpeg' });
  }

  _yield() {
    return new Promise((resolve) => setTimeout(resolve, 15));
  }
}
