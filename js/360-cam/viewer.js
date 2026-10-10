/**
 * 360 CAM — Interactive Three.js 360 Panorama Viewer
 * Renders equirectangular panoramas inside an inverted sphere with touch panning,
 * pinch-to-zoom FOV, mouse drag, inertia, and real-time Gyro Look device motion tracking.
 */

export class PanoramaViewer {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mesh = null;
    this.texture = null;

    // View angles
    this.lon = 0;       // Longitude (yaw)
    this.lat = 0;       // Latitude (pitch)
    this.targetLon = 0;
    this.targetLat = 0;
    this.fov = 75;

    // Interaction states
    this.isUserInteracting = false;
    this.onPointerDownPointerX = 0;
    this.onPointerDownPointerY = 0;
    this.onPointerDownLon = 0;
    this.onPointerDownLat = 0;

    // Pinch zoom state
    this.pinchStartDist = 0;
    this.pinchStartFov = 75;

    // Features
    this.autoRotate = false;
    this.autoRotateSpeed = 0.12;
    this.gyroLook = false;
    this.hasTexture = false;

    // Gyro tracking state for Three.js
    this.deviceOrientation = { alpha: 0, beta: 0, gamma: 0 };
    this.gyroBaseLon = 0;

    this.animId = null;

    this._initThree();
    this._bindEvents();
  }

  _initThree() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    // Scene
    this.scene = new window.THREE.Scene();

    // Camera
    this.camera = new window.THREE.PerspectiveCamera(this.fov, w / h, 1, 1200);
    this.camera.target = new window.THREE.Vector3(0, 0, 0);

    // Renderer
    this.renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';

    this.container.appendChild(this.renderer.domElement);

    // Inverted Sphere Geometry
    const geometry = new window.THREE.SphereGeometry(500, 64, 36);
    geometry.scale(-1, 1, 1); // Invert normals so texture faces inwards

    // Create default dark placeholder material
    const material = new window.THREE.MeshBasicMaterial({
      color: 0x111625
    });

    this.mesh = new window.THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    this._animate = this._animate.bind(this);
    this._animate();
  }

  /**
   * Set equirectangular panorama canvas or image
   * @param {HTMLCanvasElement|HTMLImageElement} imageSource
   */
  loadPanorama(imageSource) {
    if (this.texture) {
      this.texture.dispose();
    }

    this.texture = new window.THREE.CanvasTexture(imageSource);
    this.texture.minFilter = window.THREE.LinearFilter;
    this.texture.magFilter = window.THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    this.mesh.material.map = this.texture;
    this.mesh.material.color.setHex(0xffffff);
    this.mesh.material.needsUpdate = true;
    this.hasTexture = true;

    // Reset view to horizon
    this.lat = 0;
    this.lon = 0;
    this.targetLat = 0;
    this.targetLon = 0;
  }

  _bindEvents() {
    const el = this.renderer.domElement;

    // Pointer events (Mouse & Touch unified)
    el.addEventListener('pointerdown', this._onPointerDown.bind(this));
    window.addEventListener('pointermove', this._onPointerMove.bind(this));
    window.addEventListener('pointerup', this._onPointerUp.bind(this));
    window.addEventListener('pointercancel', this._onPointerUp.bind(this));

    // Touch pinch events
    el.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    el.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });

    // Wheel zoom
    el.addEventListener('wheel', this._onWheel.bind(this), { passive: false });

    // Resize
    window.addEventListener('resize', this.onResize.bind(this));

    // Gyro deviceorientation
    this._onDeviceOrientation = this._handleDeviceOrientation.bind(this);
    window.addEventListener('deviceorientation', this._onDeviceOrientation, false);
  }

  _onPointerDown(e) {
    if (e.touches && e.touches.length > 1) return; // Pinching
    this.isUserInteracting = true;
    this.onPointerDownPointerX = e.clientX;
    this.onPointerDownPointerY = e.clientY;
    this.onPointerDownLon = this.targetLon;
    this.onPointerDownLat = this.targetLat;
  }

  _onPointerMove(e) {
    if (!this.isUserInteracting) return;
    const factor = this.fov / 500;
    this.targetLon = (this.onPointerDownPointerX - e.clientX) * factor + this.onPointerDownLon;
    this.targetLat = (e.clientY - this.onPointerDownPointerY) * factor + this.onPointerDownLat;

    // Clamp latitude to prevent polar gimbal flip
    this.targetLat = Math.max(-85, Math.min(85, this.targetLat));
  }

  _onPointerUp() {
    this.isUserInteracting = false;
  }

  _onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.pinchStartDist = Math.hypot(dx, dy);
      this.pinchStartFov = this.fov;
    }
  }

  _onTouchMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = this.pinchStartDist / Math.max(10, dist);
      this.setFov(this.pinchStartFov * ratio);
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY * 0.05;
    this.setFov(this.fov + delta);
  }

  setFov(newFov) {
    this.fov = Math.max(30, Math.min(95, newFov));
    if (this.camera) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  _handleDeviceOrientation(event) {
    if (!this.gyroLook) return;
    if (event.alpha === null || event.beta === null || event.gamma === null) return;

    this.deviceOrientation = {
      alpha: event.alpha || 0,
      beta: event.beta || 0,
      gamma: event.gamma || 0
    };

    // Calculate heading from device motion
    const pitch = 90 - (event.beta || 90);
    const yaw = 360 - (event.alpha || 0);

    this.targetLat = Math.max(-85, Math.min(85, pitch));
    this.targetLon = yaw + this.gyroBaseLon;
  }

  toggleGyroLook(enable = null) {
    this.gyroLook = enable !== null ? enable : !this.gyroLook;
    if (this.gyroLook) {
      this.gyroBaseLon = this.lon - (360 - (this.deviceOrientation.alpha || 0));
    }
    return this.gyroLook;
  }

  toggleAutoRotate(enable = null) {
    this.autoRotate = enable !== null ? enable : !this.autoRotate;
    return this.autoRotate;
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    this.animId = requestAnimationFrame(this._animate);

    if (this.autoRotate && !this.isUserInteracting && !this.gyroLook) {
      this.targetLon += this.autoRotateSpeed;
    }

    // Smooth inertia interpolation
    this.lon += (this.targetLon - this.lon) * 0.12;
    this.lat += (this.targetLat - this.lat) * 0.12;

    const phi = window.THREE.MathUtils.degToRad(90 - this.lat);
    const theta = window.THREE.MathUtils.degToRad(this.lon);

    const target = new window.THREE.Vector3();
    target.x = 500 * Math.sin(phi) * Math.cos(theta);
    target.y = 500 * Math.cos(phi);
    target.z = 500 * Math.sin(phi) * Math.sin(theta);

    this.camera.lookAt(target);

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
    }
    window.removeEventListener('deviceorientation', this._onDeviceOrientation);
    window.removeEventListener('resize', this.onResize);
    if (this.texture) this.texture.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
