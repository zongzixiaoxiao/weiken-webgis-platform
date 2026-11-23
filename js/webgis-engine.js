/* ==========================================================================
   南京崴肯自动化 · Custom WebGIS Spatial Engine (v4.1)
   Core Capabilities:
   - Exact WGS84 (EPSG:4326) <-> Web Mercator (EPSG:3857) Projection Math
   - Slippy Map XYZ Tile Pyramid Loader (z/x/y) with LRU Cache & Offline Fallback
   - Geodesic Haversine Distance & Spherical Buffer Polygon Analysis
   - Offscreen Canvas Gaussian KDE Heatmap Layer
   - Ray-Casting Point-in-Polygon Picking for Indoor Workshop GIS (EPSG:Local)
   - Zero External Dependencies (Pure Canvas 2D + Vanilla ES6)
   ========================================================================== */

(() => {
  'use strict';

  const EARTH_R = 6378137; // WGS84 semi-major axis (m)
  const EARTH_R_KM = 6371.0088; // Mean Earth radius (km)
  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;

  /* ================= 1. Geodetic & Projection Utilities ================= */
  const GeoMath = {
    // WGS84 (EPSG:4326) -> Web Mercator meters (EPSG:3857)
    lonLatTo3857(lon, lat) {
      const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
      const x = lon * DEG * EARTH_R;
      const y = Math.log(Math.tan(Math.PI / 4 + (clampedLat * DEG) / 2)) * EARTH_R;
      return [x, y];
    },

    // Web Mercator meters -> WGS84
    mercator3857ToLonLat(x, y) {
      const lon = (x / EARTH_R) * RAD;
      const lat = (2 * Math.atan(Math.exp(y / EARTH_R)) - Math.PI / 2) * RAD;
      return [lon, lat];
    },

    // WGS84 -> Slippy Map World Pixel Space (256 * 2^z)
    lonLatToWorldPx(lon, lat, zoom) {
      const scale = 256 * Math.pow(2, zoom);
      const x = ((lon + 180) / 360) * scale;
      const sinLat = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, lat)) * DEG);
      const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
      return [x, y];
    },

    // Slippy Map World Pixel Space -> WGS84
    worldPxToLonLat(wx, wy, zoom) {
      const scale = 256 * Math.pow(2, zoom);
      const lon = (wx / scale) * 360 - 180;
      const n = Math.PI - (2 * Math.PI * wy) / scale;
      const lat = RAD * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      return [lon, lat];
    },

    // Exact Haversine Great-Circle Distance (km)
    haversineKm(lon1, lat1, lon2, lat2) {
      const dLat = (lat2 - lat1) * DEG;
      const dLon = (lon2 - lon1) * DEG;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
      return 2 * EARTH_R_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    // True Spherical Geodesic Buffer Polygon (Destination Point Formula)
    geodesicCircle(lon, lat, radiusKm, steps = 72) {
      const ring = [];
      const angDist = radiusKm / EARTH_R_KM;
      const phi1 = lat * DEG;
      const lam1 = lon * DEG;
      for (let i = 0; i <= steps; i++) {
        const brng = (i / steps) * Math.PI * 2;
        const phi2 = Math.asin(
          Math.sin(phi1) * Math.cos(angDist) +
            Math.cos(phi1) * Math.sin(angDist) * Math.cos(brng)
        );
        const lam2 =
          lam1 +
          Math.atan2(
            Math.sin(brng) * Math.sin(angDist) * Math.cos(phi1),
            Math.cos(angDist) - Math.sin(phi1) * Math.sin(phi2)
          );
        ring.push([lam2 * RAD, phi2 * RAD]);
      }
      return ring;
    },

    // Latitude-compensated ground resolution (meters/pixel)
    metersPerPixel(lat, zoom) {
      return (156543.03392804097 * Math.cos(lat * DEG)) / Math.pow(2, zoom);
    },

    // Ray-casting Point-in-Polygon (for Indoor GIS station selection)
    pointInPolygon(pt, ring) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect =
          yi > pt[1] !== yj > pt[1] &&
          pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi + 1e-12) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }
  };

  /* ================= 2. WebGIS Canvas Map Engine Class ================= */
  class WeikenWebGIS {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.data = window.WEIKEN_GIS_DATA;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      // View mode: 'geo' (Yangtze River Delta EPSG:3857) | 'indoor' (Workshop EPSG:Local)
      this.mode = options.mode || 'geo';
      this.compact = Boolean(options.compact);

      // Geo camera state (centered on East China / YRD client network)
      this.centerLon = options.centerLon ?? 119.9;
      this.centerLat = options.centerLat ?? 30.35;
      this.zoom = options.zoom ?? (this.compact ? 6.45 : 6.75);

      // Indoor camera state (EPSG:Local metric floorplan 28m x 16m)
      this.indoorCenterX = 14.0;
      this.indoorCenterY = 8.4;
      this.indoorPpm = 34; // pixels per meter

      // Layer visibility state
      this.layers = {
        vectorBase: true,
        xyzTiles: false, // Optional online Carto XYZ pyramid
        buffers: true,
        odFlows: true,
        heatmap: false,
        sites: true,
        labels: true,
        // Indoor layers
        indoorGeofence: true,
        indoorAgv: true,
        indoorHeat: false
      };

      // Theme: 'light' (Swiss Cartography) | 'dark' (Night Ops Radar)
      this.theme = options.theme || 'light';

      // Spatial Analysis State
      this.bufferRadiusKm = options.bufferRadiusKm ?? 350;
      this.activeTool = 'pan'; // 'pan' | 'measure'
      this.measurePts = []; // Geo: [lon, lat] | Indoor: [x, y]
      this.cursorCoord = null;
      this.hoveredId = null;
      this.selectedId = options.selectedId || 'hq-nanjing';
      this.selectedStationId = 'ST50';
      this.categoryFilter = 'all';

      // Callbacks
      this.onCursorMove = options.onCursorMove || null;
      this.onSelectFeature = options.onSelectFeature || null;
      this.onBufferChange = options.onBufferChange || null;
      this.onMeasureChange = options.onMeasureChange || null;
      this.onCameraChange = options.onCameraChange || null;

      // XYZ Tile Cache
      this.tileCache = new Map();
      this.animPhase = 0;
      this.flyAnim = null;

      // Offscreen canvas for KDE Heatmap
      this.heatCanvas = document.createElement('canvas');
      this.heatCtx = this.heatCanvas.getContext('2d');

      this.width = 600;
      this.height = 420;
      this._bindEvents();
      this.resize();
      this._emitBufferAnalysis();
      this._startLoop();
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = Math.max(280, Math.round(rect.width));
      this.height = Math.max(260, Math.round(rect.height));
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.heatCanvas.width = this.width;
      this.heatCanvas.height = this.height;
      this._emitCamera();
    }

    /* ----- Screen <-> World Coordinate Transforms ----- */
    geoToScreen(lon, lat) {
      const [cwx, cwy] = GeoMath.lonLatToWorldPx(this.centerLon, this.centerLat, this.zoom);
      const [wx, wy] = GeoMath.lonLatToWorldPx(lon, lat, this.zoom);
      return [this.width / 2 + (wx - cwx), this.height / 2 + (wy - cwy)];
    }

    screenToGeo(sx, sy) {
      const [cwx, cwy] = GeoMath.lonLatToWorldPx(this.centerLon, this.centerLat, this.zoom);
      const wx = cwx + (sx - this.width / 2);
      const wy = cwy + (sy - this.height / 2);
      return GeoMath.worldPxToLonLat(wx, wy, this.zoom);
    }

    indoorToScreen(mx, my) {
      return [
        this.width / 2 + (mx - this.indoorCenterX) * this.indoorPpm,
        this.height / 2 + (my - this.indoorCenterY) * this.indoorPpm
      ];
    }

    screenToIndoor(sx, sy) {
      return [
        this.indoorCenterX + (sx - this.width / 2) / this.indoorPpm,
        this.indoorCenterY + (sy - this.height / 2) / this.indoorPpm
      ];
    }

    /* ----- Public API ----- */
    setMode(mode) {
      if (this.mode === mode) return;
      this.mode = mode;
      this.measurePts = [];
      this.hoveredId = null;
      this.flyAnim = null;
      if (mode === 'indoor') {
        this.fitIndoor();
        if (this.onCursorMove) this.onCursorMove({ mode: 'indoor', mx: 14.0, my: 8.0 });
      } else if (this.onCursorMove) {
        const [mx, my] = GeoMath.lonLatTo3857(this.centerLon, this.centerLat);
        this.onCursorMove({ mode: 'geo', lon: this.centerLon, lat: this.centerLat, mx, my });
      }
      this._emitMeasure();
      this._emitCamera();
      if (mode === 'geo') {
        const f = this.getSiteById(this.selectedId);
        if (f && this.onSelectFeature) this.onSelectFeature({ mode: 'geo', feature: f, distKm: this._distFromHq(f) });
      } else {
        const st = this.getStationById(this.selectedStationId);
        if (st && this.onSelectFeature) this.onSelectFeature({ mode: 'indoor', station: st });
      }
    }

    fitIndoor() {
      const pad = 48;
      const ppmX = (this.width - pad * 2) / this.data.indoorPlant.width;
      const ppmY = (this.height - pad * 2) / this.data.indoorPlant.height;
      this.indoorPpm = Math.max(14, Math.min(48, Math.min(ppmX, ppmY)));
      this.indoorCenterX = this.data.indoorPlant.width / 2;
      this.indoorCenterY = this.data.indoorPlant.height / 2;
      this._emitCamera();
    }

    setTheme(theme) {
      this.theme = theme;
      this.tileCache.clear();
    }

    setLayer(name, visible) {
      this.layers[name] = visible;
    }

    setTool(tool) {
      this.activeTool = tool;
      if (tool !== 'measure') {
        this.measurePts = [];
        this._emitMeasure();
      }
      this.canvas.style.cursor = tool === 'measure' ? 'crosshair' : 'grab';
    }

    clearMeasure() {
      this.measurePts = [];
      this._emitMeasure();
    }

    setCategoryFilter(cat) {
      this.categoryFilter = cat;
      this._emitBufferAnalysis();
    }

    setBufferRadius(km) {
      this.bufferRadiusKm = km;
      this._emitBufferAnalysis();
    }

    zoomBy(delta, anchorX = this.width / 2, anchorY = this.height / 2) {
      if (this.mode === 'geo') {
        const [lonBefore, latBefore] = this.screenToGeo(anchorX, anchorY);
        this.zoom = Math.max(5.0, Math.min(12.5, this.zoom + delta));
        const [wxAfter, wyAfter] = GeoMath.lonLatToWorldPx(lonBefore, latBefore, this.zoom);
        const newCenterWx = wxAfter - (anchorX - this.width / 2);
        const newCenterWy = wyAfter - (anchorY - this.height / 2);
        const [nLon, nLat] = GeoMath.worldPxToLonLat(newCenterWx, newCenterWy, this.zoom);
        this.centerLon = nLon;
        this.centerLat = nLat;
      } else {
        const [mxBefore, myBefore] = this.screenToIndoor(anchorX, anchorY);
        const factor = delta > 0 ? 1.18 : 1 / 1.18;
        this.indoorPpm = Math.max(12, Math.min(90, this.indoorPpm * factor));
        this.indoorCenterX = mxBefore - (anchorX - this.width / 2) / this.indoorPpm;
        this.indoorCenterY = myBefore - (anchorY - this.height / 2) / this.indoorPpm;
      }
      this._emitCamera();
    }

    flyTo(lon, lat, targetZoom = 9.0, duration = 650) {
      this.mode = 'geo';
      this.flyAnim = {
        t0: performance.now(),
        duration,
        lon0: this.centerLon,
        lat0: this.centerLat,
        z0: this.zoom,
        lon1: lon,
        lat1: lat,
        z1: targetZoom
      };
    }

    resetView() {
      if (this.mode === 'geo') {
        this.flyTo(119.9, 30.35, this.compact ? 6.45 : 6.75, 520);
      } else {
        this.fitIndoor();
      }
    }

    getSiteById(id) {
      return this.data.sites.features.find((f) => f.properties.id === id);
    }

    getStationById(id) {
      return this.data.indoorPlant.stations.find((s) => s.id === id);
    }

    selectSite(id, shouldFly = true) {
      const f = this.getSiteById(id);
      if (!f) return;
      this.selectedId = id;
      if (shouldFly) {
        const [lon, lat] = f.geometry.coordinates;
        this.flyTo(lon, lat, Math.max(this.zoom, 8.6), 600);
      }
      if (this.onSelectFeature) {
        this.onSelectFeature({ mode: 'geo', feature: f, distKm: this._distFromHq(f) });
      }
    }

    selectStation(id) {
      const st = this.getStationById(id);
      if (!st) return;
      this.selectedStationId = id;
      if (this.onSelectFeature) {
        this.onSelectFeature({ mode: 'indoor', station: st });
      }
    }

    _distFromHq(feature) {
      const hq = this.getSiteById('hq-nanjing');
      const [lon1, lat1] = hq.geometry.coordinates;
      const [lon2, lat2] = feature.geometry.coordinates;
      return GeoMath.haversineKm(lon1, lat1, lon2, lat2);
    }

    _getFilteredSites() {
      return this.data.sites.features.filter((f) => {
        if (this.categoryFilter === 'all') return true;
        return f.properties.category === this.categoryFilter || f.properties.category === 'hq';
      });
    }

    _emitBufferAnalysis() {
      if (!this.onBufferChange) return;
      const hq = this.getSiteById('hq-nanjing');
      const [hqLon, hqLat] = hq.geometry.coordinates;
      const results = this.data.sites.features
        .filter((f) => f.properties.id !== 'hq-nanjing')
        .map((f) => {
          const [lon, lat] = f.geometry.coordinates;
          const distKm = GeoMath.haversineKm(hqLon, hqLat, lon, lat);
          return {
            id: f.properties.id,
            name: f.properties.name,
            city: f.properties.city,
            verified: f.properties.verified,
            distKm,
            inside: distKm <= this.bufferRadiusKm
          };
        })
        .sort((a, b) => a.distKm - b.distKm);

      this.onBufferChange({
        radiusKm: this.bufferRadiusKm,
        insideCount: results.filter((r) => r.inside).length,
        totalCount: results.length,
        results
      });
    }

    _emitMeasure() {
      if (!this.onMeasureChange) return;
      let total = 0;
      const segments = [];
      for (let i = 1; i < this.measurePts.length; i++) {
        const a = this.measurePts[i - 1];
        const b = this.measurePts[i];
        const d = this.mode === 'geo'
          ? GeoMath.haversineKm(a[0], a[1], b[0], b[1])
          : Math.hypot(b[0] - a[0], b[1] - a[1]);
        total += d;
        segments.push(d);
      }
      this.onMeasureChange({
        mode: this.mode,
        count: this.measurePts.length,
        total,
        unit: this.mode === 'geo' ? 'km' : 'm',
        segments
      });
    }

    _emitCamera() {
      if (!this.onCameraChange) return;
      if (this.mode === 'geo') {
        const mpp = GeoMath.metersPerPixel(this.centerLat, this.zoom);
        const targetMeters = mpp * 100;
        const niceSteps = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
        let chosen = niceSteps[0];
        for (const s of niceSteps) {
          if (s <= targetMeters * 1.35) chosen = s;
        }
        this.onCameraChange({
          mode: 'geo',
          zoom: this.zoom,
          scalePx: Math.round(chosen / mpp),
          scaleLabel: chosen >= 1000 ? `${chosen / 1000} km` : `${chosen} m`,
          crs: 'EPSG:3857 / WGS84'
        });
      } else {
        const targetMeters = 90 / this.indoorPpm;
        const nice = [1, 2, 5, 10];
        let chosen = nice[0];
        for (const s of nice) {
          if (s <= targetMeters * 1.4) chosen = s;
        }
        this.onCameraChange({
          mode: 'indoor',
          zoom: this.indoorPpm,
          scalePx: Math.round(chosen * this.indoorPpm),
          scaleLabel: `${chosen} m`,
          crs: 'EPSG:Local (厂区米制平面)'
        });
      }
    }

    exportGeoJSON() {
      const hq = this.getSiteById('hq-nanjing');
      const [hqLon, hqLat] = hq.geometry.coordinates;
      const bufferRing = GeoMath.geodesicCircle(hqLon, hqLat, this.bufferRadiusKm, 72);
      return {
        type: 'FeatureCollection',
        name: 'Weiken_Automation_WebGIS_Export',
        generatedAt: new Date().toISOString(),
        crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
        features: [
          ...this.data.sites.features,
          {
            type: 'Feature',
            properties: {
              id: 'buffer-analysis',
              name: `南京总部 ${this.bufferRadiusKm} km 工程响应辐射圈`,
              radiusKm: this.bufferRadiusKm,
              algorithm: 'Spherical Geodesic Destination Buffer'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [bufferRing]
            }
          }
        ]
      };
    }

    /* ================= 3. Pointer & Wheel Interaction ================= */
    _bindEvents() {
      let dragging = false;
      let moved = false;
      let startX = 0;
      let startY = 0;
      let lastX = 0;
      let lastY = 0;

      const getPos = (e) => {
        const r = this.canvas.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      };

      this.canvas.addEventListener('pointerdown', (e) => {
        const [x, y] = getPos(e);
        dragging = true;
        moved = false;
        startX = lastX = x;
        startY = lastY = y;
        this.flyAnim = null;
        this.canvas.setPointerCapture?.(e.pointerId);
        if (this.activeTool === 'pan') this.canvas.style.cursor = 'grabbing';
      });

      this.canvas.addEventListener('pointermove', (e) => {
        const [x, y] = getPos(e);

        if (dragging) {
          const dx = x - lastX;
          const dy = y - lastY;
          if (Math.hypot(x - startX, y - startY) > 4) moved = true;
          lastX = x;
          lastY = y;

          if (moved && this.activeTool === 'pan') {
            if (this.mode === 'geo') {
              const [cwx, cwy] = GeoMath.lonLatToWorldPx(this.centerLon, this.centerLat, this.zoom);
              const [nLon, nLat] = GeoMath.worldPxToLonLat(cwx - dx, cwy - dy, this.zoom);
              this.centerLon = Math.max(112, Math.min(126, nLon));
              this.centerLat = Math.max(26, Math.min(37, nLat));
            } else {
              this.indoorCenterX -= dx / this.indoorPpm;
              this.indoorCenterY -= dy / this.indoorPpm;
            }
            this._emitCamera();
          }
        }

        // Update cursor coordinates + hover picking
        if (this.mode === 'geo') {
          const [lon, lat] = this.screenToGeo(x, y);
          this.cursorCoord = [lon, lat];
          if (this.onCursorMove) {
            const [mx, my] = GeoMath.lonLatTo3857(lon, lat);
            this.onCursorMove({ mode: 'geo', lon, lat, mx, my });
          }
          if (!dragging) {
            const hit = this._hitTestGeo(x, y);
            this.hoveredId = hit ? hit.properties.id : null;
            this.canvas.style.cursor =
              this.activeTool === 'measure' ? 'crosshair' : hit ? 'pointer' : 'grab';
          }
        } else {
          const [mx, my] = this.screenToIndoor(x, y);
          this.cursorCoord = [mx, my];
          if (this.onCursorMove) {
            this.onCursorMove({ mode: 'indoor', mx, my });
          }
          if (!dragging) {
            const hit = this._hitTestIndoor(mx, my);
            this.hoveredId = hit ? hit.id : null;
            this.canvas.style.cursor =
              this.activeTool === 'measure' ? 'crosshair' : hit ? 'pointer' : 'grab';
          }
        }
      });

      const endDrag = (e) => {
        if (!dragging) return;
        const [x, y] = getPos(e);
        dragging = false;

        if (!moved) {
          if (this.activeTool === 'measure') {
            const pt = this.mode === 'geo' ? this.screenToGeo(x, y) : this.screenToIndoor(x, y);
            this.measurePts.push(pt);
            this._emitMeasure();
          } else if (this.mode === 'geo') {
            const hit = this._hitTestGeo(x, y);
            if (hit) this.selectSite(hit.properties.id, false);
          } else {
            const [mx, my] = this.screenToIndoor(x, y);
            const hit = this._hitTestIndoor(mx, my);
            if (hit) this.selectStation(hit.id);
          }
        }
        this.canvas.style.cursor = this.activeTool === 'measure' ? 'crosshair' : 'grab';
      };

      this.canvas.addEventListener('pointerup', endDrag);
      this.canvas.addEventListener('pointercancel', endDrag);

      this.canvas.addEventListener(
        'wheel',
        (e) => {
          // On compact home preview, allow page scroll unless Ctrl held or explicitly hovered? Actually zoom smoothly on gis.html, require subtle handling on compact
          if (this.compact && !e.ctrlKey) return;
          e.preventDefault();
          const [x, y] = getPos(e);
          const delta = e.deltaY < 0 ? 0.45 : -0.45;
          this.zoomBy(delta, x, y);
        },
        { passive: false }
      );

      window.addEventListener('resize', () => this.resize());
    }

    _hitTestGeo(sx, sy) {
      const list = this._getFilteredSites();
      let closest = null;
      let minD = 18;
      for (const f of list) {
        const [px, py] = this.geoToScreen(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        const d = Math.hypot(px - sx, py - sy);
        if (d < minD) {
          minD = d;
          closest = f;
        }
      }
      return closest;
    }

    _hitTestIndoor(mx, my) {
      for (const st of this.data.indoorPlant.stations) {
        if (GeoMath.pointInPolygon([mx, my], st.coords)) return st;
      }
      return null;
    }

    /* ================= 4. Rendering Pipeline ================= */
    _startLoop() {
      const tick = (now) => {
        if (this.flyAnim) {
          const p = Math.min(1, (now - this.flyAnim.t0) / this.flyAnim.duration);
          const ease = 1 - Math.pow(1 - p, 3);
          this.centerLon = this.flyAnim.lon0 + (this.flyAnim.lon1 - this.flyAnim.lon0) * ease;
          this.centerLat = this.flyAnim.lat0 + (this.flyAnim.lat1 - this.flyAnim.lat0) * ease;
          this.zoom = this.flyAnim.z0 + (this.flyAnim.z1 - this.flyAnim.z0) * ease;
          this._emitCamera();
          if (p >= 1) this.flyAnim = null;
        }
        this.animPhase = (this.animPhase + 0.014) % 1;
        this.render();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    render() {
      if (this.mode === 'geo') {
        this._renderGeo();
      } else {
        this._renderIndoor();
      }
    }

    /* ----- Geo Mode (EPSG:3857 Regional Cartography) ----- */
    _renderGeo() {
      const ctx = this.ctx;
      const dark = this.theme === 'dark';

      // Ocean / Canvas Backdrop
      ctx.fillStyle = dark ? '#080F1E' : '#EBF1F8';
      ctx.fillRect(0, 0, this.width, this.height);

      // Subtle WGS84 Graticule (经纬网)
      this._drawGraticule(dark);

      // Optional Slippy XYZ Tile Layer (Carto Light/Dark)
      if (this.layers.xyzTiles) {
        this._drawXyzTiles(dark);
      }

      // Precision GeoJSON Vector Basemap (Admin Boundaries + Yangtze Hydrology)
      if (this.layers.vectorBase) {
        this._drawVectorBasemap(dark);
      }

      // Optional Gaussian KDE Heatmap Layer
      if (this.layers.heatmap) {
        this._drawGeoHeatmap();
      }

      // True Spherical Geodesic Buffer Rings
      if (this.layers.buffers) {
        this._drawBuffers(dark);
      }

      // Animated OD Flow Arcs (HQ -> Delivery Bases)
      if (this.layers.odFlows) {
        this._drawOdFlows(dark);
      }

      // Delivery Sites & HQ Point Layer
      if (this.layers.sites) {
        this._drawSites(dark);
      }

      // Interactive Measure Overlay
      if (this.measurePts.length) {
        this._drawMeasureOverlay(dark);
      }
    }

    _drawGraticule(dark) {
      const ctx = this.ctx;
      const step = this.zoom > 9 ? 0.5 : 1.0;
      const [lonMin, latMax] = this.screenToGeo(0, 0);
      const [lonMax, latMin] = this.screenToGeo(this.width, this.height);

      ctx.strokeStyle = dark ? 'rgba(130, 165, 225, 0.08)' : 'rgba(30, 58, 138, 0.065)';
      ctx.lineWidth = 1;
      ctx.font = '10px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = dark ? 'rgba(148, 175, 220, 0.45)' : 'rgba(71, 85, 105, 0.55)';

      for (let lon = Math.floor(lonMin / step) * step; lon <= lonMax + step; lon += step) {
        const [x] = this.geoToScreen(lon, this.centerLat);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
        ctx.stroke();
        ctx.fillText(`${lon.toFixed(1)}°E`, x + 4, 14);
      }

      for (let lat = Math.floor(latMin / step) * step; lat <= latMax + step; lat += step) {
        const [, y] = this.geoToScreen(this.centerLon, lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
        ctx.fillText(`${lat.toFixed(1)}°N`, 6, y - 4);
      }
    }

    _drawXyzTiles(dark) {
      const ctx = this.ctx;
      const z = Math.max(5, Math.min(12, Math.round(this.zoom)));
      const [cwx, cwy] = GeoMath.lonLatToWorldPx(this.centerLon, this.centerLat, this.zoom);
      const scaleDiff = Math.pow(2, this.zoom - z);
      const tileSize = 256 * scaleDiff;

      const worldLeft = cwx - this.width / 2;
      const worldTop = cwy - this.height / 2;
      const minTX = Math.floor(worldLeft / tileSize);
      const maxTX = Math.floor((worldLeft + this.width) / tileSize);
      const minTY = Math.floor(worldTop / tileSize);
      const maxTY = Math.floor((worldTop + this.height) / tileSize);
      const maxIdx = Math.pow(2, z) - 1;

      const stylePath = dark ? 'dark_nolabels' : 'light_nolabels';

      for (let tx = minTX; tx <= maxTX; tx++) {
        for (let ty = minTY; ty <= maxTY; ty++) {
          if (tx < 0 || ty < 0 || tx > maxIdx || ty > maxIdx) continue;
          const key = `${stylePath}/${z}/${tx}/${ty}`;
          let entry = this.tileCache.get(key);
          if (!entry) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            entry = { img, loaded: false, error: false };
            img.onload = () => { entry.loaded = true; };
            img.onerror = () => { entry.error = true; };
            const sub = ['a', 'b', 'c', 'd'][(tx + ty) % 4];
            img.src = `https://${sub}.basemaps.cartocdn.com/${stylePath}/${z}/${tx}/${ty}.png`;
            if (this.tileCache.size > 120) {
              const firstKey = this.tileCache.keys().next().value;
              this.tileCache.delete(firstKey);
            }
            this.tileCache.set(key, entry);
          }
          if (entry.loaded) {
            const dx = tx * tileSize - worldLeft;
            const dy = ty * tileSize - worldTop;
            ctx.drawImage(entry.img, dx, dy, tileSize + 0.6, tileSize + 0.6);
          }
        }
      }
    }

    _drawVectorBasemap(dark) {
      const ctx = this.ctx;
      const fillAlpha = this.layers.xyzTiles ? 0.18 : 1;

      // Admin Province Polygons
      this.data.boundaries.features.forEach((feat) => {
        const ring = feat.geometry.coordinates[0];
        ctx.beginPath();
        ring.forEach(([lon, lat], idx) => {
          const [x, y] = this.geoToScreen(lon, lat);
          if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();

        if (fillAlpha > 0) {
          ctx.fillStyle = dark
            ? `rgba(17, 29, 52, ${fillAlpha})`
            : `rgba(255, 255, 255, ${fillAlpha})`;
          ctx.fill();
        }
        ctx.strokeStyle = dark ? 'rgba(130, 165, 225, 0.28)' : '#CBD6E6';
        ctx.lineWidth = 1.25;
        ctx.stroke();

        // Province centroid label
        if (this.layers.labels && !this.layers.xyzTiles) {
          let sx = 0, sy = 0;
          ring.forEach(([lon, lat]) => { sx += lon; sy += lat; });
          const [cx, cy] = this.geoToScreen(sx / ring.length, sy / ring.length);
          ctx.font = '600 12px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillStyle = dark ? 'rgba(148, 175, 220, 0.34)' : 'rgba(100, 116, 139, 0.42)';
          ctx.textAlign = 'center';
          ctx.fillText(feat.properties.name, cx, cy);
          ctx.textAlign = 'left';
        }
      });

      // Hydrology (Yangtze River & Lakes)
      this.data.hydro.features.forEach((feat) => {
        if (feat.geometry.type === 'Polygon') {
          const ring = feat.geometry.coordinates[0];
          ctx.beginPath();
          ring.forEach(([lon, lat], idx) => {
            const [x, y] = this.geoToScreen(lon, lat);
            if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = dark ? 'rgba(37, 99, 235, 0.22)' : '#D7E7FA';
          ctx.fill();
        } else if (feat.geometry.type === 'LineString') {
          ctx.beginPath();
          feat.geometry.coordinates.forEach(([lon, lat], idx) => {
            const [x, y] = this.geoToScreen(lon, lat);
            if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = dark ? 'rgba(59, 130, 246, 0.42)' : '#9EC3F2';
          ctx.lineWidth = Math.max(2, this.zoom * 0.42);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      });
    }

    _drawGeoHeatmap() {
      const hctx = this.heatCtx;
      hctx.clearRect(0, 0, this.width, this.height);
      const radius = Math.max(46, this.zoom * 9.5);

      this._getFilteredSites().forEach((f) => {
        const [x, y] = this.geoToScreen(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        const w = f.properties.heatWeight || 0.7;
        const grad = hctx.createRadialGradient(x, y, 2, x, y, radius);
        grad.addColorStop(0, `rgba(204, 36, 32, ${0.42 * w})`);
        grad.addColorStop(0.42, `rgba(37, 83, 199, ${0.32 * w})`);
        grad.addColorStop(0.75, `rgba(14, 165, 233, ${0.14 * w})`);
        grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
        hctx.fillStyle = grad;
        hctx.beginPath();
        hctx.arc(x, y, radius, 0, Math.PI * 2);
        hctx.fill();
      });

      this.ctx.drawImage(this.heatCanvas, 0, 0);
    }

    _drawBuffers(dark) {
      const ctx = this.ctx;
      const hq = this.getSiteById('hq-nanjing');
      const [hqLon, hqLat] = hq.geometry.coordinates;

      // Secondary reference ring (100 km) + Primary dynamic buffer ring
      const rings = [
        { km: 100, primary: false },
        { km: this.bufferRadiusKm, primary: true }
      ];

      rings.forEach(({ km, primary }) => {
        const pts = GeoMath.geodesicCircle(hqLon, hqLat, km, 72);
        ctx.beginPath();
        pts.forEach(([lon, lat], i) => {
          const [x, y] = this.geoToScreen(lon, lat);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();

        if (primary) {
          ctx.fillStyle = dark ? 'rgba(37, 83, 199, 0.14)' : 'rgba(37, 83, 199, 0.075)';
          ctx.fill();
          ctx.strokeStyle = dark ? 'rgba(107, 151, 255, 0.78)' : 'rgba(30, 58, 138, 0.62)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([7, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = dark ? 'rgba(148, 175, 220, 0.28)' : 'rgba(30, 58, 138, 0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // North apex label
        const [lx, ly] = this.geoToScreen(pts[0][0], pts[0][1]);
        ctx.font = '600 10.5px "JetBrains Mono", Consolas, monospace';
        ctx.fillStyle = primary
          ? (dark ? '#93B8FF' : '#1E3A8A')
          : (dark ? 'rgba(148,175,220,0.65)' : 'rgba(71,85,105,0.7)');
        ctx.textAlign = 'center';
        ctx.fillText(`R = ${km} km`, lx, ly - 6);
        ctx.textAlign = 'left';
      });
    }

    _drawOdFlows(dark) {
      const ctx = this.ctx;
      const hq = this.getSiteById('hq-nanjing');
      const [sx, sy] = this.geoToScreen(hq.geometry.coordinates[0], hq.geometry.coordinates[1]);

      this._getFilteredSites().forEach((f, idx) => {
        if (f.properties.id === 'hq-nanjing') return;
        const [tx, ty] = this.geoToScreen(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        const verified = f.properties.verified;

        // Curved Quadratic Bezier Arc
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const dx = tx - sx;
        const dy = ty - sy;
        const cx = mx - dy * 0.16;
        const cy = my + dx * 0.16;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cx, cy, tx, ty);
        ctx.strokeStyle = verified
          ? (dark ? 'rgba(96, 165, 250, 0.85)' : 'rgba(30, 58, 138, 0.72)')
          : (dark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.35)');
        ctx.lineWidth = verified ? 2.1 : 1.25;
        if (!verified) ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Moving signal pulse along curve
        const t = (this.animPhase + idx * 0.19) % 1;
        const inv = 1 - t;
        const px = inv * inv * sx + 2 * inv * t * cx + t * t * tx;
        const py = inv * inv * sy + 2 * inv * t * cy + t * t * ty;

        ctx.beginPath();
        ctx.arc(px, py, verified ? 3.5 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = verified ? '#CC2420' : (dark ? '#7FA5FF' : '#2553C7');
        ctx.fill();
      });
    }

    _drawSites(dark) {
      const ctx = this.ctx;
      const list = this._getFilteredSites();

      list.forEach((f) => {
        const p = f.properties;
        const [x, y] = this.geoToScreen(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        const isHq = p.category === 'hq';
        const isSelected = p.id === this.selectedId;
        const isHover = p.id === this.hoveredId;

        // Animated radar ring on HQ & selected site
        if (isHq || isSelected) {
          const rPulse = 10 + this.animPhase * 16;
          ctx.beginPath();
          ctx.arc(x, y, rPulse, 0, Math.PI * 2);
          ctx.strokeStyle = isHq
            ? `rgba(204, 36, 32, ${(1 - this.animPhase) * 0.65})`
            : `rgba(37, 83, 199, ${(1 - this.animPhase) * 0.65})`;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }

        // Outer halo
        const baseR = isHq ? 8 : (p.verified ? 6.5 : 5);
        const r = isHover || isSelected ? baseR + 2 : baseR;
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = dark ? 'rgba(10, 17, 32, 0.85)' : 'rgba(255, 255, 255, 0.92)';
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = isHq
          ? '#CC2420'
          : p.verified
            ? '#1E3A8A'
            : (dark ? '#64748B' : '#475569');
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = isHq ? '#FF8A85' : '#60A5FA';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Crisp Cartographic Label with Directional Anchor (Collision-Free)
        if (this.layers.labels) {
          const text = p.mapLabel || p.name;
          ctx.font = `${isHq || p.verified ? '600' : '500'} 11.5px "PingFang SC", "Microsoft YaHei", sans-serif`;
          const tw = ctx.measureText(text).width;
          const bw = tw + 12;
          const bh = 21;
          const pos = p.labelPos || 'right';
          let lx = x + r + 8;
          let ly = y - bh / 2;
          if (pos === 'top') {
            lx = x - bw / 2;
            ly = y - r - bh - 7;
          } else if (pos === 'bottom') {
            lx = x - bw / 2;
            ly = y + r + 7;
          } else if (pos === 'left') {
            lx = x - r - bw - 8;
            ly = y - bh / 2;
          }

          ctx.fillStyle = dark ? 'rgba(10, 17, 32, 0.9)' : 'rgba(255, 255, 255, 0.95)';
          ctx.strokeStyle = isSelected
            ? (isHq ? '#CC2420' : '#2553C7')
            : (dark ? 'rgba(255,255,255,0.16)' : '#CBD5E1');
          ctx.lineWidth = isSelected ? 1.5 : 1;

          this._roundRect(ctx, lx, ly, bw, bh, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = dark ? '#F1F5FB' : '#0B1528';
          ctx.fillText(text, lx + 6, ly + 14.5);
        }
      });
    }

    /* ----- Indoor Mode (EPSG:Local Metric Workshop Floorplan GIS) ----- */
    _renderIndoor() {
      const ctx = this.ctx;
      const dark = this.theme === 'dark';
      const plant = this.data.indoorPlant;

      ctx.fillStyle = dark ? '#080F1E' : '#F3F6FA';
      ctx.fillRect(0, 0, this.width, this.height);

      // Metric Coordinate Grid (1m & 5m)
      const [tlx, tly] = this.indoorToScreen(0, 0);
      const [brx, bry] = this.indoorToScreen(plant.width, plant.height);

      // Workshop Floor Slab
      ctx.fillStyle = dark ? '#0E192E' : '#FFFFFF';
      ctx.fillRect(tlx, tly, brx - tlx, bry - tly);

      for (let m = 0; m <= plant.width; m++) {
        const [x] = this.indoorToScreen(m, 0);
        ctx.beginPath();
        ctx.moveTo(x, tly);
        ctx.lineTo(x, bry);
        ctx.strokeStyle = m % 5 === 0
          ? (dark ? 'rgba(130,165,225,0.18)' : 'rgba(30,58,138,0.14)')
          : (dark ? 'rgba(130,165,225,0.06)' : 'rgba(30,58,138,0.05)');
        ctx.lineWidth = 1;
        ctx.stroke();
        if (m % 5 === 0) {
          ctx.font = '10px "JetBrains Mono", Consolas, monospace';
          ctx.fillStyle = dark ? '#6F809C' : '#64748B';
          ctx.fillText(`${m}m`, x + 3, tly - 6);
        }
      }

      for (let m = 0; m <= plant.height; m++) {
        const [, y] = this.indoorToScreen(0, m);
        ctx.beginPath();
        ctx.moveTo(tlx, y);
        ctx.lineTo(brx, y);
        ctx.strokeStyle = m % 5 === 0
          ? (dark ? 'rgba(130,165,225,0.18)' : 'rgba(30,58,138,0.14)')
          : (dark ? 'rgba(130,165,225,0.06)' : 'rgba(30,58,138,0.05)');
        ctx.lineWidth = 1;
        ctx.stroke();
        if (m % 5 === 0) {
          ctx.font = '10px "JetBrains Mono", Consolas, monospace';
          ctx.fillStyle = dark ? '#6F809C' : '#64748B';
          ctx.fillText(`${m}m`, tlx - 28, y + 3);
        }
      }

      // Outer Workshop Structural Wall
      ctx.strokeStyle = dark ? '#476599' : '#1E3A8A';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(tlx, tly, brx - tlx, bry - tly);

      // Optional Station Load Heatmap Layer
      if (this.layers.indoorHeat) {
        const hctx = this.heatCtx;
        hctx.clearRect(0, 0, this.width, this.height);
        plant.stations.forEach((st) => {
          const [cx, cy] = this.indoorToScreen(st.center[0], st.center[1]);
          const r = 3.2 * this.indoorPpm;
          const grad = hctx.createRadialGradient(cx, cy, 4, cx, cy, r);
          grad.addColorStop(0, `rgba(204, 36, 32, ${0.42 * st.load})`);
          grad.addColorStop(0.55, `rgba(217, 119, 6, ${0.22 * st.load})`);
          grad.addColorStop(1, 'rgba(37, 83, 199, 0)');
          hctx.fillStyle = grad;
          hctx.beginPath();
          hctx.arc(cx, cy, r, 0, Math.PI * 2);
          hctx.fill();
        });
        ctx.drawImage(this.heatCanvas, 0, 0);
      }

      // Safety Light Curtain Geofences (电子围栏)
      if (this.layers.indoorGeofence) {
        plant.geofences.forEach((ring) => {
          ctx.beginPath();
          ring.forEach(([mx, my], i) => {
            const [x, y] = this.indoorToScreen(mx, my);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = 'rgba(217, 119, 6, 0.85)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      // AGV & Material Routing Topology
      if (this.layers.indoorAgv) {
        // AGV Loop
        ctx.beginPath();
        plant.agvPath.forEach(([mx, my], i) => {
          const [x, y] = this.indoorToScreen(mx, my);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = dark ? 'rgba(52, 211, 153, 0.45)' : 'rgba(15, 157, 107, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated AGV dot on loop
        const agvPt = this._pointAlongPolyline(plant.agvPath, this.animPhase);
        const [ax, ay] = this.indoorToScreen(agvPt[0], agvPt[1]);
        ctx.fillStyle = '#0F9D6B';
        ctx.beginPath();
        ctx.arc(ax, ay, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 10px "JetBrains Mono", Consolas, monospace';
        ctx.fillText('AGV-01', ax + 8, ay + 3);

        // Main Production Line Conveyor Flow
        ctx.beginPath();
        plant.flowPath.forEach(([mx, my], i) => {
          const [x, y] = this.indoorToScreen(mx, my);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = dark ? 'rgba(96, 165, 250, 0.7)' : 'rgba(30, 58, 138, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Station Polygons
      plant.stations.forEach((st) => {
        const isSel = st.id === this.selectedStationId;
        const isHov = st.id === this.hoveredId;
        ctx.beginPath();
        st.coords.forEach(([mx, my], i) => {
          const [x, y] = this.indoorToScreen(mx, my);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();

        if (st.status === 'warn') {
          ctx.fillStyle = isSel ? 'rgba(204, 36, 32, 0.24)' : 'rgba(204, 36, 32, 0.12)';
          ctx.strokeStyle = '#CC2420';
        } else {
          ctx.fillStyle = isSel
            ? (dark ? 'rgba(37, 83, 199, 0.42)' : 'rgba(37, 83, 199, 0.18)')
            : isHov
              ? (dark ? 'rgba(37, 83, 199, 0.28)' : 'rgba(37, 83, 199, 0.12)')
              : (dark ? 'rgba(24, 38, 66, 0.9)' : '#F8FAFD');
          ctx.strokeStyle = isSel ? '#2553C7' : (dark ? '#4B6FA8' : '#1E3A8A');
        }
        ctx.lineWidth = isSel ? 2.4 : 1.4;
        ctx.fill();
        ctx.stroke();

        // Station Center Labels
        const [cx, cy] = this.indoorToScreen(st.center[0], st.center[1]);
        ctx.textAlign = 'center';
        ctx.font = '700 12px "JetBrains Mono", Consolas, monospace';
        ctx.fillStyle = st.status === 'warn' ? '#CC2420' : (dark ? '#93B8FF' : '#1E3A8A');
        ctx.fillText(st.id, cx, cy - 5);
        ctx.font = '600 11.5px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = dark ? '#F1F5FB' : '#0B1528';
        ctx.fillText(st.zone, cx, cy + 12);
        ctx.textAlign = 'left';
      });

      if (this.measurePts.length) {
        this._drawMeasureOverlay(dark);
      }
    }

    _pointAlongPolyline(pts, t) {
      let total = 0;
      const lens = [];
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        lens.push(d);
        total += d;
      }
      let target = t * total;
      for (let i = 0; i < lens.length; i++) {
        if (target <= lens[i]) {
          const r = target / (lens[i] || 1);
          return [
            pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r,
            pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r
          ];
        }
        target -= lens[i];
      }
      return pts[0];
    }

    _drawMeasureOverlay(dark) {
      const ctx = this.ctx;
      const toScreen = (pt) =>
        this.mode === 'geo' ? this.geoToScreen(pt[0], pt[1]) : this.indoorToScreen(pt[0], pt[1]);

      ctx.beginPath();
      this.measurePts.forEach((pt, i) => {
        const [x, y] = toScreen(pt);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      if (this.cursorCoord && this.activeTool === 'measure') {
        const [cx, cy] = toScreen(this.cursorCoord);
        ctx.lineTo(cx, cy);
      }
      ctx.strokeStyle = '#CC2420';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      let cumulative = 0;
      this.measurePts.forEach((pt, i) => {
        const [x, y] = toScreen(pt);
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#CC2420';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (i > 0) {
          const prev = this.measurePts[i - 1];
          const seg = this.mode === 'geo'
            ? GeoMath.haversineKm(prev[0], prev[1], pt[0], pt[1])
            : Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
          cumulative += seg;
          const unit = this.mode === 'geo' ? 'km' : 'm';
          const label = `${cumulative.toFixed(1)} ${unit}`;
          ctx.font = '600 11px "JetBrains Mono", Consolas, monospace';
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = dark ? '#0A1120' : '#FFFFFF';
          ctx.strokeStyle = '#CC2420';
          ctx.lineWidth = 1;
          this._roundRect(ctx, x + 8, y - 11, tw + 10, 20, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#CC2420';
          ctx.fillText(label, x + 13, y + 3);
        }
      });
    }

    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  /* ================= 5. Page Initializers (gis.html & index.html) ================= */
  window.WeikenWebGIS = WeikenWebGIS;
  window.WeikenGeoMath = GeoMath;

  // A. Home Page Compact WebGIS Preview
  const homeCanvas = document.getElementById('home-gis-canvas');
  if (homeCanvas && window.WEIKEN_GIS_DATA) {
    const scaleBarEl = document.getElementById('home-gis-scale');
    const scaleTxtEl = document.getElementById('home-gis-scale-txt');
    const coordEl = document.getElementById('home-gis-coord');
    const infoNameEl = document.getElementById('home-gis-name');
    const infoMetaEl = document.getElementById('home-gis-meta');
    const infoDescEl = document.getElementById('home-gis-desc');

    const map = new WeikenWebGIS(homeCanvas, {
      compact: true,
      centerLon: 119.9,
      centerLat: 30.35,
      zoom: 6.45,
      bufferRadiusKm: 350,
      onCursorMove(c) {
        if (!coordEl) return;
        coordEl.textContent = `${c.lon.toFixed(4)}°E, ${c.lat.toFixed(4)}°N`;
      },
      onCameraChange(cam) {
        if (scaleBarEl) scaleBarEl.style.width = `${cam.scalePx}px`;
        if (scaleTxtEl) scaleTxtEl.textContent = cam.scaleLabel;
      },
      onSelectFeature(payload) {
        if (payload.mode !== 'geo' || !payload.feature) return;
        const p = payload.feature.properties;
        if (infoNameEl) infoNameEl.textContent = p.name;
        if (infoMetaEl) {
          infoMetaEl.textContent = p.id === 'hq-nanjing'
            ? `${p.city} · 研发制造中心`
            : `${p.city} · 距总部 ${payload.distKm.toFixed(1)} km · ${p.responseHours}`;
        }
        if (infoDescEl) infoDescEl.textContent = p.summary;
      }
    });

    document.querySelectorAll('[data-home-fly]').forEach((btn) => {
      btn.addEventListener('click', () => {
        map.selectSite(btn.dataset.homeFly, true);
        document.querySelectorAll('[data-home-fly]').forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('home-gis-zin')?.addEventListener('click', () => map.zoomBy(0.6));
    document.getElementById('home-gis-zout')?.addEventListener('click', () => map.zoomBy(-0.6));
    document.getElementById('home-gis-reset')?.addEventListener('click', () => map.resetView());
  }

  // B. Flagship Full-Screen WebGIS Workbench (gis.html)
  const wbCanvas = document.getElementById('gis-canvas');
  if (wbCanvas && window.WEIKEN_GIS_DATA) {
    const coordEl = document.getElementById('wb-coord');
    const mercEl = document.getElementById('wb-merc');
    const zoomEl = document.getElementById('wb-zoom');
    const crsEl = document.getElementById('wb-crs');
    const scaleBarEl = document.getElementById('wb-scale-bar');
    const scaleTxtEl = document.getElementById('wb-scale-txt');
    const bufValEl = document.getElementById('wb-buf-val');
    const bufSummaryEl = document.getElementById('wb-buf-summary');
    const measureStatusEl = document.getElementById('wb-measure-status');
    const inspectorEl = document.getElementById('wb-inspector');
    const siteListEl = document.getElementById('wb-site-list');

    function renderInspector(payload) {
      if (!inspectorEl) return;
      if (payload.mode === 'geo' && payload.feature) {
        const p = payload.feature.properties;
        const [lon, lat] = payload.feature.geometry.coordinates;
        const [mx, my] = GeoMath.lonLatTo3857(lon, lat);
        inspectorEl.innerHTML = `
          <div class="insp-head">
            <span class="chip ${p.category === 'belt' ? 'belt' : ''}">${p.catLabel}</span>
            <span class="mono" style="font-size:11px;color:var(--ink-muted)">${p.verified ? '真实节点' : '协同参考'}</span>
          </div>
          <h3>${p.name}</h3>
          <p class="insp-desc">${p.summary}</p>
          <div class="insp-kv">
            <div><span>WGS84 经纬度</span><strong class="mono">${lon.toFixed(4)}°E, ${lat.toFixed(4)}°N</strong></div>
            <div><span>EPSG:3857 投影</span><strong class="mono">${Math.round(mx)}, ${Math.round(my)}</strong></div>
            <div><span>距南京总部测地距</span><strong class="mono">${payload.distKm < 1 ? '0.0 km（总部）' : payload.distKm.toFixed(1) + ' km'}</strong></div>
            <div><span>工程响应时效</span><strong>${p.responseHours}</strong></div>
          </div>
          <div class="insp-equip">
            <span class="insp-sub">关联自动化设备 / 方案</span>
            <ul>${p.equipment.map((e) => `<li>${e}</li>`).join('')}</ul>
          </div>
          ${p.indoorLinked ? `<button type="button" class="btn btn-primary btn-sm" style="width:100%;margin-top:14px" id="drill-indoor-btn">下钻至车间微空间 GIS（产线平面拓扑）</button>` : ''}
        `;
        document.getElementById('drill-indoor-btn')?.addEventListener('click', () => switchMode('indoor'));
      } else if (payload.mode === 'indoor' && payload.station) {
        const st = payload.station;
        inspectorEl.innerHTML = `
          <div class="insp-head">
            <span class="chip ${st.status === 'warn' ? 'belt' : ''}">${st.zone}</span>
            <span class="mono" style="font-size:11px;color:var(--ink-muted)">EPSG:Local</span>
          </div>
          <h3>${st.name}</h3>
          <p class="insp-desc">${st.sensors}</p>
          <div class="insp-kv">
            <div><span>工位中心坐标</span><strong class="mono">X: ${st.center[0].toFixed(1)}m, Y: ${st.center[1].toFixed(1)}m</strong></div>
            <div><span>设备负载率（示意）</span><strong class="mono">${Math.round(st.load * 100)}%</strong></div>
            <div><span>安全电子围栏</span><strong>${st.geofence}</strong></div>
            <div><span>工艺与追溯状态</span><strong>${st.cycle}</strong></div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" style="width:100%;margin-top:14px" id="back-geo-btn">返回长三角宏观地理 GIS</button>
        `;
        document.getElementById('back-geo-btn')?.addEventListener('click', () => switchMode('geo'));
      }
    }

    const wbMap = new WeikenWebGIS(wbCanvas, {
      centerLon: 119.9,
      centerLat: 30.35,
      zoom: 6.75,
      bufferRadiusKm: 350,
      onCursorMove(c) {
        if (c.mode === 'geo') {
          if (coordEl) coordEl.textContent = `WGS84: ${c.lon.toFixed(4)}°E, ${c.lat.toFixed(4)}°N`;
          if (mercEl) mercEl.textContent = `3857: ${Math.round(c.mx)}m, ${Math.round(c.my)}m`;
        } else {
          if (coordEl) coordEl.textContent = `厂区平面: X ${c.mx.toFixed(2)} m, Y ${c.my.toFixed(2)} m`;
          if (mercEl) mercEl.textContent = `车间面积: 28.0m × 16.0m`;
        }
      },
      onCameraChange(cam) {
        if (zoomEl) zoomEl.textContent = cam.mode === 'geo' ? `Z ${cam.zoom.toFixed(2)}` : `${Math.round(cam.zoom)} px/m`;
        if (crsEl) crsEl.textContent = cam.crs;
        if (scaleBarEl) scaleBarEl.style.width = `${cam.scalePx}px`;
        if (scaleTxtEl) scaleTxtEl.textContent = cam.scaleLabel;
      },
      onSelectFeature(payload) {
        renderInspector(payload);
        if (payload.mode === 'geo' && payload.feature) {
          siteListEl?.querySelectorAll('[data-wb-site]').forEach((el) => {
            el.classList.toggle('active', el.dataset.wbSite === payload.feature.properties.id);
          });
        }
      },
      onBufferChange(info) {
        if (bufValEl) bufValEl.textContent = `${info.radiusKm} km`;
        if (bufSummaryEl) {
          const names = info.results.filter((r) => r.inside).map((r) => `${r.city.split('·')[1]?.trim() || r.city} (${Math.round(r.distKm)}km)`);
          bufSummaryEl.innerHTML = `半径内命中 <strong>${info.insideCount} / ${info.totalCount}</strong> 个节点：${names.length ? names.join(' · ') : '暂无'}`;
        }
      },
      onMeasureChange(m) {
        if (!measureStatusEl) return;
        if (m.count === 0) {
          measureStatusEl.textContent = '在地图上依次点击两点以上开始测距';
        } else {
          measureStatusEl.innerHTML = `已标定 <strong>${m.count}</strong> 点 · 总测地距离 <strong class="mono">${m.total.toFixed(2)} ${m.unit}</strong>`;
        }
      }
    });

    // Populate site list
    if (siteListEl) {
      siteListEl.innerHTML = window.WEIKEN_GIS_DATA.sites.features
        .map((f) => {
          const p = f.properties;
          const dist = wbMap._distFromHq(f);
          return `
            <button type="button" class="wb-site-item ${p.id === 'hq-nanjing' ? 'active' : ''}" data-wb-site="${p.id}">
              <div>
                <strong>${p.name}</strong>
                <span>${p.city}${dist > 1 ? ` · ${Math.round(dist)} km` : ' · 总部'}</span>
              </div>
              <i class="wb-dot ${p.category === 'hq' ? 'red' : p.verified ? 'blue' : 'muted'}"></i>
            </button>
          `;
        })
        .join('');

      siteListEl.querySelectorAll('[data-wb-site]').forEach((btn) => {
        btn.addEventListener('click', () => {
          switchMode('geo');
          wbMap.selectSite(btn.dataset.wbSite, true);
        });
      });
    }

    // Initial inspector render
    wbMap.selectSite('hq-nanjing', false);

    // Mode switcher (Geo <-> Indoor)
    function switchMode(mode) {
      wbMap.setMode(mode);
      document.querySelectorAll('[data-wb-mode]').forEach((b) => b.classList.toggle('active', b.dataset.wbMode === mode));
      document.getElementById('wb-geo-layers')?.classList.toggle('hidden', mode !== 'geo');
      document.getElementById('wb-indoor-layers')?.classList.toggle('hidden', mode !== 'indoor');
    }

    document.querySelectorAll('[data-wb-mode]').forEach((btn) => {
      btn.addEventListener('click', () => switchMode(btn.dataset.wbMode));
    });

    // Layer checkboxes
    document.querySelectorAll('[data-wb-layer]').forEach((cb) => {
      cb.addEventListener('change', () => {
        wbMap.setLayer(cb.dataset.wbLayer, cb.checked);
      });
    });

    // Theme toggle (Light Swiss Cartography <-> Dark Radar)
    document.querySelectorAll('[data-wb-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        wbMap.setTheme(btn.dataset.wbTheme);
        document.querySelectorAll('[data-wb-theme]').forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    // Buffer radius slider
    document.getElementById('wb-buf-slider')?.addEventListener('input', (e) => {
      wbMap.setBufferRadius(Number(e.target.value));
    });

    // Tool buttons (Pan / Measure / Clear / Zoom / Reset)
    document.querySelectorAll('[data-wb-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.wbTool;
        wbMap.setTool(t);
        document.querySelectorAll('[data-wb-tool]').forEach((b) => b.classList.toggle('active', b === btn));
        document.getElementById('wb-measure-bar')?.classList.toggle('show', t === 'measure');
      });
    });

    document.getElementById('wb-measure-clear')?.addEventListener('click', () => wbMap.clearMeasure());
    document.getElementById('wb-zin')?.addEventListener('click', () => wbMap.zoomBy(0.65));
    document.getElementById('wb-zout')?.addEventListener('click', () => wbMap.zoomBy(-0.65));
    document.getElementById('wb-reset')?.addEventListener('click', () => wbMap.resetView());

    // GeoJSON Inspector & Download Modal
    const geoModal = document.getElementById('geojson-modal');
    const geoPre = document.getElementById('geojson-code');
    document.getElementById('wb-export-btn')?.addEventListener('click', () => {
      const jsonStr = JSON.stringify(wbMap.exportGeoJSON(), null, 2);
      if (geoPre) geoPre.textContent = jsonStr;
      geoModal?.classList.add('open');
      geoModal?.setAttribute('aria-hidden', 'false');
    });
    document.getElementById('geojson-close')?.addEventListener('click', () => {
      geoModal?.classList.remove('open');
      geoModal?.setAttribute('aria-hidden', 'true');
    });
    document.getElementById('geojson-download')?.addEventListener('click', () => {
      const jsonStr = JSON.stringify(wbMap.exportGeoJSON(), null, 2);
      const blob = new Blob([jsonStr], { type: 'application/geo+json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'weiken-automation-yrd.geojson';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
})();
