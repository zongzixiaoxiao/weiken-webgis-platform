/* ==========================================================================
   南京崴肯自动化 · 企业级高德地图 JS API 2.0 + 自研微空间双引擎 WebGIS (v6.0)
   核心能力：
   - 手写高精度 WGS84 (EPSG:4326) <-> GCJ-02 (火星坐标系) <-> EPSG:3857 投影纠偏
   - 高德 2.0 3D 视角 + 标准矢量 / 高清卫星+路网 / 极客暗夜三底图切换
   - 真实高速驾车路径规划 (AMap.Driving) 返回精确公路里程与驾车耗时
   - 真球面测地缓冲区多边形分析 (100-900 km) + 贝塞尔服务飞线 + 高德热力图层
   - 官方测距 (AMap.RangingTool) + 面积量测 (AMap.MouseTool) + RFC 7946 GeoJSON 导出
   - 一键下钻自研 Canvas 2D 厂区米制平面 Indoor GIS (EPSG:Local)
   ========================================================================== */

(() => {
  'use strict';

  const PI = Math.PI;
  const A_AXIS = 6378245.0;
  const EE = 0.00669342162296594323;
  const EARTH_R = 6378137.0;
  const EARTH_R_KM = 6371.0088;
  const DEG = PI / 180;
  const RAD = 180 / PI;

  /* ================= 1. 坐标纠偏与球面测地算法库 ================= */
  function outOfChina(lon, lat) {
    return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }

  function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320.0 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
    return ret;
  }

  function transformLon(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
    return ret;
  }

  const Spatial = {
    wgs84ToGcj02(lon, lat) {
      if (outOfChina(lon, lat)) return [lon, lat];
      let dLat = transformLat(lon - 105.0, lat - 35.0);
      let dLon = transformLon(lon - 105.0, lat - 35.0);
      const radLat = (lat / 180.0) * PI;
      let magic = Math.sin(radLat);
      magic = 1 - EE * magic * magic;
      const sqrtMagic = Math.sqrt(magic);
      dLat = (dLat * 180.0) / (((A_AXIS * (1 - EE)) / (magic * sqrtMagic)) * PI);
      dLon = (dLon * 180.0) / ((A_AXIS / sqrtMagic) * Math.cos(radLat) * PI);
      return [lon + dLon, lat + dLat];
    },

    gcj02ToWgs84(lon, lat) {
      if (outOfChina(lon, lat)) return [lon, lat];
      let wLon = lon, wLat = lat;
      for (let i = 0; i < 4; i++) {
        const [gLon, gLat] = this.wgs84ToGcj02(wLon, wLat);
        wLon -= gLon - lon;
        wLat -= gLat - lat;
      }
      return [wLon, wLat];
    },

    lonLatTo3857(lon, lat) {
      const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
      const x = lon * DEG * EARTH_R;
      const y = Math.log(Math.tan(PI / 4 + (clamped * DEG) / 2)) * EARTH_R;
      return [x, y];
    },

    haversineKm(lon1, lat1, lon2, lat2) {
      const dLat = (lat2 - lat1) * DEG;
      const dLon = (lon2 - lon1) * DEG;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
      return 2 * EARTH_R_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    geodesicCircleWgs84(lon, lat, radiusKm, steps = 72) {
      const ring = [];
      const angDist = radiusKm / EARTH_R_KM;
      const phi1 = lat * DEG;
      const lam1 = lon * DEG;
      for (let i = 0; i <= steps; i++) {
        const brng = (i / steps) * PI * 2;
        const phi2 = Math.asin(Math.sin(phi1) * Math.cos(angDist) + Math.cos(phi1) * Math.sin(angDist) * Math.cos(brng));
        const lam2 = lam1 + Math.atan2(Math.sin(brng) * Math.sin(angDist) * Math.cos(phi1), Math.cos(angDist) - Math.sin(phi1) * Math.sin(phi2));
        ring.push([lam2 * RAD, phi2 * RAD]);
      }
      return ring;
    },

    formatDuration(sec) {
      const mins = Math.round(sec / 60);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h} 小时 ${m} 分钟` : `${m} 分钟`;
    }
  };

  window.WeikenSpatial = Spatial;

  function makeMarkerContent(feature, isSelected) {
    const p = feature.properties;
    const isHq = p.category === 'hq';
    const pos = `pos-${p.labelPos || 'right'}`;
    const cls = ['amap-pin', isHq ? 'hq' : 'client', pos, isSelected ? 'selected' : ''].join(' ');
    return `
      <div class="${cls}" data-pin-id="${p.id}">
        <span class="amap-pin-dot">${isHq ? '<i class="amap-pin-pulse"></i>' : ''}</span>
        <span class="amap-pin-label">${p.mapLabel || p.name}</span>
      </div>
    `;
  }

  /* ================= 2. 首页嵌入式高德 2.0 预览地图 ================= */
  function initHomeAmap() {
    const container = document.getElementById('home-amap');
    if (!container || typeof AMap === 'undefined' || !window.WEIKEN_GIS_DATA) return false;

    const data = window.WEIKEN_GIS_DATA;
    const hq = data.sites.features.find((f) => f.properties.id === 'hq-nanjing');
    const [hqLon, hqLat] = hq.geometry.coordinates;
    const hqGcj = Spatial.wgs84ToGcj02(hqLon, hqLat);

    const map = new AMap.Map(container, {
      viewMode: '3D',
      pitch: 28,
      zoom: 6.4,
      center: Spatial.wgs84ToGcj02(119.9, 30.3),
      mapStyle: 'amap://styles/whitesmoke',
      scrollWheel: false
    });

    // 350km & 100km Geodesic Buffer Rings
    [350, 100].forEach((km, idx) => {
      const path = Spatial.geodesicCircleWgs84(hqLon, hqLat, km, 72).map(([lo, la]) => Spatial.wgs84ToGcj02(lo, la));
      new AMap.Polygon({
        map,
        path,
        fillColor: idx === 0 ? '#2553C7' : 'transparent',
        fillOpacity: idx === 0 ? 0.06 : 0,
        strokeColor: idx === 0 ? '#1E3A8A' : '#64748B',
        strokeWeight: idx === 0 ? 1.5 : 1,
        strokeStyle: 'dashed',
        strokeOpacity: idx === 0 ? 0.65 : 0.35
      });
    });

    // OD Curved Arcs
    data.sites.features.forEach((f) => {
      if (f.properties.id === 'hq-nanjing') return;
      const tgt = Spatial.wgs84ToGcj02(f.geometry.coordinates[0], f.geometry.coordinates[1]);
      const mid = [(hqGcj[0] + tgt[0]) / 2 - (tgt[1] - hqGcj[1]) * 0.14, (hqGcj[1] + tgt[1]) / 2 + (tgt[0] - hqGcj[0]) * 0.14];
      new AMap.BezierCurve({
        map,
        path: [hqGcj, [mid[0], mid[1], tgt[0], tgt[1]]],
        strokeColor: '#1E3A8A',
        strokeWeight: 1.8,
        strokeOpacity: 0.62
      });
    });

    const coordEl = document.getElementById('home-gis-coord');
    const infoNameEl = document.getElementById('home-gis-name');
    const infoMetaEl = document.getElementById('home-gis-meta');
    const infoDescEl = document.getElementById('home-gis-desc');

    const markers = new Map();
    let selectedId = 'hq-nanjing';

    function selectSite(id, fly = true) {
      const f = data.sites.features.find((item) => item.properties.id === id);
      if (!f) return;
      selectedId = id;
      markers.forEach((mk, key) => {
        const feat = data.sites.features.find((item) => item.properties.id === key);
        mk.setContent(makeMarkerContent(feat, key === selectedId));
      });
      const [lon, lat] = f.geometry.coordinates;
      const gcj = Spatial.wgs84ToGcj02(lon, lat);
      if (fly) {
        map.setZoomAndCenter(id === 'hq-nanjing' ? 14.5 : 8.8, gcj, false, 650);
        map.setPitch(id === 'hq-nanjing' ? 48 : 28);
      }
      const p = f.properties;
      const distKm = Spatial.haversineKm(hqLon, hqLat, lon, lat);
      if (infoNameEl) infoNameEl.textContent = p.name;
      if (infoMetaEl) {
        infoMetaEl.textContent = id === 'hq-nanjing'
          ? `${p.city} · 步月路133号江苏可成科技园A幢1楼`
          : `${p.city} · 直线距总部 ${distKm.toFixed(1)} km · ${p.responseHours}`;
      }
      if (infoDescEl) infoDescEl.textContent = p.summary;
    }

    data.sites.features.forEach((f) => {
      const gcj = Spatial.wgs84ToGcj02(f.geometry.coordinates[0], f.geometry.coordinates[1]);
      const mk = new AMap.Marker({
        map,
        position: gcj,
        content: makeMarkerContent(f, f.properties.id === selectedId),
        offset: new AMap.Pixel(-8, -8),
        zIndex: f.properties.category === 'hq' ? 130 : 110
      });
      mk.on('click', () => selectSite(f.properties.id, true));
      markers.set(f.properties.id, mk);
    });

    map.on('mousemove', (e) => {
      if (!coordEl || !e.lnglat) return;
      const [wLon, wLat] = Spatial.gcj02ToWgs84(e.lnglat.lng, e.lnglat.lat);
      coordEl.textContent = `WGS84 ${wLon.toFixed(4)}°E, ${wLat.toFixed(4)}°N`;
    });

    document.querySelectorAll('[data-home-fly]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectSite(btn.dataset.homeFly, true);
        document.querySelectorAll('[data-home-fly]').forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('home-gis-zin')?.addEventListener('click', () => map.zoomIn());
    document.getElementById('home-gis-zout')?.addEventListener('click', () => map.zoomOut());
    document.getElementById('home-gis-reset')?.addEventListener('click', () => {
      map.setPitch(28);
      map.setZoomAndCenter(6.4, Spatial.wgs84ToGcj02(119.9, 30.3), false, 500);
    });

    // Hide fallback canvas when AMap is active
    const fallbackCanvas = document.getElementById('home-gis-canvas');
    if (fallbackCanvas) fallbackCanvas.style.display = 'none';
    return true;
  }

  /* ================= 3. 全屏旗舰 WebGIS 工作台 (gis.html) ================= */
  function initWorkbenchAmap() {
    const amapContainer = document.getElementById('amap-container');
    if (!amapContainer || typeof AMap === 'undefined' || !window.WEIKEN_GIS_DATA) return false;

    const data = window.WEIKEN_GIS_DATA;
    const hq = data.sites.features.find((f) => f.properties.id === 'hq-nanjing');
    const [hqLon, hqLat] = hq.geometry.coordinates;
    const hqGcj = Spatial.wgs84ToGcj02(hqLon, hqLat);

    // Hide Canvas Geo fallback when AMap loads cleanly; Canvas remains dedicated to Indoor Workshop GIS!
    const indoorWrap = document.getElementById('indoor-canvas-wrap');
    const indoorCanvas = document.getElementById('gis-canvas');
    let indoorEngine = null;

    // Create AMap 2.0 3D Map
    const map = new AMap.Map(amapContainer, {
      viewMode: '3D',
      pitch: 32,
      rotation: 0,
      zoom: 6.75,
      center: Spatial.wgs84ToGcj02(119.8, 30.2),
      mapStyle: 'amap://styles/whitesmoke',
      buildingAnimation: true
    });

    // Satellite + RoadNet layers (toggled on demand)
    const satLayer = new AMap.TileLayer.Satellite({ zIndex: 2 });
    const roadNetLayer = new AMap.TileLayer.RoadNet({ zIndex: 3 });
    let satActive = false;

    // Scale plugin
    if (AMap.Scale) map.addControl(new AMap.Scale({ position: 'LB' }));

    // Driving Service (Real Highway Routing from Pukou HQ)
    let drivingService = null;
    let routePolyline = null;
    if (AMap.Driving) {
      drivingService = new AMap.Driving({
        policy: AMap.DrivingPolicy?.LEAST_TIME ?? 0
      });
    }

    // Ranging & Area Measurement Tools
    let rangingTool = AMap.RangingTool ? new AMap.RangingTool(map) : null;
    let mouseTool = AMap.MouseTool ? new AMap.MouseTool(map) : null;

    // Layers State
    let bufferRadiusKm = 350;
    let selectedId = 'hq-nanjing';
    let currentMode = 'geo'; // 'geo' | 'indoor'
    let is3D = true;
    let lastDrivingResult = null;

    const bufferPolygons = [];
    const odCurves = [];
    const markers = new Map();
    let heatmapLayer = null;

    // UI Elements
    const coordEl = document.getElementById('wb-coord');
    const mercEl = document.getElementById('wb-merc');
    const zoomEl = document.getElementById('wb-zoom');
    const crsEl = document.getElementById('wb-crs');
    const bufValEl = document.getElementById('wb-buf-val');
    const bufSummaryEl = document.getElementById('wb-buf-summary');
    const inspectorEl = document.getElementById('wb-inspector');
    const siteListEl = document.getElementById('wb-site-list');
    const measureBar = document.getElementById('wb-measure-bar');
    const measureStatusEl = document.getElementById('wb-measure-status');

    // Render Geodesic Buffer Rings
    function drawBuffers(visible = true) {
      bufferPolygons.forEach((p) => p.setMap(null));
      bufferPolygons.length = 0;
      if (!visible) return;

      [
        { km: 100, primary: false },
        { km: bufferRadiusKm, primary: true }
      ].forEach(({ km, primary }) => {
        const path = Spatial.geodesicCircleWgs84(hqLon, hqLat, km, 72).map(([lo, la]) => Spatial.wgs84ToGcj02(lo, la));
        const poly = new AMap.Polygon({
          map,
          path,
          fillColor: primary ? '#2553C7' : 'transparent',
          fillOpacity: primary ? 0.075 : 0,
          strokeColor: primary ? '#1E3A8A' : '#64748B',
          strokeWeight: primary ? 1.8 : 1.1,
          strokeStyle: 'dashed',
          strokeOpacity: primary ? 0.72 : 0.4,
          zIndex: 20
        });
        bufferPolygons.push(poly);
      });
    }

    // Update Spatial Buffer Hit List
    function updateBufferAnalysis() {
      if (bufValEl) bufValEl.textContent = `${bufferRadiusKm} km`;
      const results = data.sites.features
        .filter((f) => f.properties.id !== 'hq-nanjing')
        .map((f) => {
          const [lo, la] = f.geometry.coordinates;
          const distKm = Spatial.haversineKm(hqLon, hqLat, lo, la);
          return { name: f.properties.name, city: f.properties.city, distKm, inside: distKm <= bufferRadiusKm };
        })
        .sort((a, b) => a.distKm - b.distKm);

      const hits = results.filter((r) => r.inside);
      if (bufSummaryEl) {
        const txt = hits.map((r) => `${r.name.replace(/\(.*\)/, '').trim()} (${Math.round(r.distKm)}km)`).join(' · ');
        bufSummaryEl.innerHTML = `球面半径内命中 <strong>${hits.length} / ${results.length}</strong> 个真实基地：${txt || '暂无'}`;
      }
    }

    // Render OD Bezier Curves
    function drawOdCurves() {
      odCurves.forEach((c) => c.setMap(null));
      odCurves.length = 0;
      data.sites.features.forEach((f) => {
        if (f.properties.id === 'hq-nanjing') return;
        const tgt = Spatial.wgs84ToGcj02(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        const mid = [
          (hqGcj[0] + tgt[0]) / 2 - (tgt[1] - hqGcj[1]) * 0.14,
          (hqGcj[1] + tgt[1]) / 2 + (tgt[0] - hqGcj[0]) * 0.14
        ];
        const curve = new AMap.BezierCurve({
          map,
          path: [hqGcj, [mid[0], mid[1], tgt[0], tgt[1]]],
          strokeColor: '#2553C7',
          strokeWeight: 1.8,
          strokeOpacity: 0.55,
          strokeStyle: 'dashed',
          zIndex: 30
        });
        odCurves.push(curve);
      });
    }

    // Initialize Heatmap Layer (hidden by default)
    if (AMap.HeatMap) {
      heatmapLayer = new AMap.HeatMap(map, {
        radius: 55,
        opacity: [0, 0.78],
        gradient: { 0.35: '#2553C7', 0.65: '#0EA5E9', 0.85: '#F59E0B', 1.0: '#CC2420' }
      });
      const hpts = data.sites.features.map((f) => {
        const [gLo, gLa] = Spatial.wgs84ToGcj02(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        return { lng: gLo, lat: gLa, count: Math.round((f.properties.heatWeight || 0.8) * 100) };
      });
      heatmapLayer.setDataSet({ data: hpts, max: 100 });
      heatmapLayer.hide();
    }

    // Clear Active Highway Route
    function clearRoute() {
      if (routePolyline) {
        routePolyline.setMap(null);
        routePolyline = null;
      }
      lastDrivingResult = null;
    }

    // Real AMap.Driving Highway Route Planning (HQ -> Client)
    function planHighwayRoute(feature) {
      clearRoute();
      if (!drivingService || feature.properties.id === 'hq-nanjing') return;

      const statusBox = document.getElementById('insp-route-box');
      if (statusBox) {
        statusBox.innerHTML = `<span class="mono" style="color:var(--brand)">正在调用高德实时高速路网规划路线…</span>`;
      }

      const tgtGcj = Spatial.wgs84ToGcj02(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
      drivingService.search(hqGcj, tgtGcj, (status, result) => {
        if (status === 'complete' && result?.routes?.length) {
          const route = result.routes[0];
          const path = [];
          (route.steps || []).forEach((st) => {
            (st.path || []).forEach((pt) => path.push([pt.lng, pt.lat]));
          });
          if (path.length) {
            routePolyline = new AMap.Polyline({
              map,
              path,
              strokeColor: '#CC2420',
              strokeWeight: 4.5,
              strokeOpacity: 0.92,
              lineJoin: 'round',
              showDir: true,
              zIndex: 80
            });
            map.setFitView([routePolyline], false, [70, 70, 70, 70]);
          }
          const km = (route.distance / 1000).toFixed(1);
          const dur = Spatial.formatDuration(route.time);
          const tolls = route.tolls ? ` · 高速费约 ¥${route.tolls}` : '';
          lastDrivingResult = { km, dur, tolls };
          const box = document.getElementById('insp-route-box');
          if (box) {
            box.innerHTML = `
              <div class="route-result">
                <strong>高德实时高速路线已规划</strong>
                <div class="route-metrics">
                  <span>真实公路里程 <b class="mono">${km} km</b></span>
                  <span>预计驾车耗时 <b>${dur}</b>${tolls}</span>
                </div>
              </div>
            `;
          }
        } else if (statusBox) {
          statusBox.innerHTML = `<span style="color:var(--ink-3)">路线规划暂不可用（${result?.info || status}）</span>`;
        }
      });
    }

    // Render Right Feature Inspector
    function renderGeoInspector(feature) {
      if (!inspectorEl) return;
      const p = feature.properties;
      const [lon, lat] = feature.geometry.coordinates;
      const [gLon, gLat] = Spatial.wgs84ToGcj02(lon, lat);
      const [mx, my] = Spatial.lonLatTo3857(lon, lat);
      const distKm = Spatial.haversineKm(hqLon, hqLat, lon, lat);
      const isHq = p.id === 'hq-nanjing';

      inspectorEl.innerHTML = `
        <div class="insp-head">
          <span class="chip ${p.category === 'belt' || p.category === 'steering' ? 'belt' : ''}">${p.catLabel}</span>
          <span class="mono" style="font-size:11px;color:var(--ok)">高德 2.0 实景</span>
        </div>
        <h3>${p.name}</h3>
        <p class="insp-desc">${p.summary}</p>
        ${p.address ? `<div class="insp-addr">📍 ${p.address}</div>` : ''}
        <div class="insp-kv">
          <div><span>WGS84 基准坐标</span><strong class="mono">${lon.toFixed(4)}°E, ${lat.toFixed(4)}°N</strong></div>
          <div><span>GCJ-02 火星纠偏坐标</span><strong class="mono">${gLon.toFixed(4)}°E, ${gLat.toFixed(4)}°N</strong></div>
          <div><span>EPSG:3857 墨卡托</span><strong class="mono">${Math.round(mx)}, ${Math.round(my)}</strong></div>
          <div><span>球面直线测地距</span><strong class="mono">${isHq ? '0.0 km（总部）' : distKm.toFixed(1) + ' km'}</strong></div>
        </div>
        ${!isHq ? `<div id="insp-route-box" class="insp-route-slot"><button type="button" class="btn btn-red btn-sm" style="width:100%" id="btn-plan-route">规划高德真实高速响应路线</button></div>` : `<button type="button" class="btn btn-red btn-sm" style="width:100%;margin-top:12px" id="btn-hq-3d">飞往浦口总部 3D 街道实景</button>`}
        <div class="insp-equip">
          <span class="insp-sub">交付自动化设备与产线</span>
          <ul>${p.equipment.map((e) => `<li>${e}</li>`).join('')}</ul>
        </div>
        ${p.indoorLinked ? `<button type="button" class="btn btn-primary btn-sm" style="width:100%;margin-top:12px" id="drill-indoor-btn">下钻至车间孪生平面（产线拓扑）</button>` : ''}
      `;

      document.getElementById('btn-plan-route')?.addEventListener('click', () => planHighwayRoute(feature));
      document.getElementById('btn-hq-3d')?.addEventListener('click', () => {
        is3D = true;
        map.setPitch(52);
        map.setRotation(-18);
        map.setZoomAndCenter(16.2, hqGcj, false, 900);
      });
      document.getElementById('drill-indoor-btn')?.addEventListener('click', () => switchScale('indoor'));
    }

    function renderIndoorInspector(st) {
      if (!inspectorEl || !st) return;
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
        <button type="button" class="btn btn-outline btn-sm" style="width:100%;margin-top:14px" id="back-geo-btn">返回全国交付网络</button>
      `;
      document.getElementById('back-geo-btn')?.addEventListener('click', () => switchScale('geo'));
    }

    // Select Site
    function selectSite(id, fly = true, autoRoute = false) {
      const f = data.sites.features.find((item) => item.properties.id === id);
      if (!f) return;
      selectedId = id;
      clearRoute();
      markers.forEach((mk, key) => {
        const feat = data.sites.features.find((item) => item.properties.id === key);
        mk.setContent(makeMarkerContent(feat, key === selectedId));
      });
      siteListEl?.querySelectorAll('[data-wb-site]').forEach((el) => {
        el.classList.toggle('active', el.dataset.wbSite === id);
      });
      renderGeoInspector(f);
      if (fly) {
        const gcj = Spatial.wgs84ToGcj02(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        map.setZoomAndCenter(id === 'hq-nanjing' ? 11.5 : 8.5, gcj, false, 650);
      }
      if (autoRoute && id !== 'hq-nanjing') {
        planHighwayRoute(f);
      }
    }

    // Create Markers for All 9 Verified Nodes
    data.sites.features.forEach((f) => {
      const gcj = Spatial.wgs84ToGcj02(f.geometry.coordinates[0], f.geometry.coordinates[1]);
      const mk = new AMap.Marker({
        map,
        position: gcj,
        content: makeMarkerContent(f, f.properties.id === selectedId),
        offset: new AMap.Pixel(-8, -8),
        zIndex: f.properties.category === 'hq' ? 140 : 120
      });
      mk.on('click', () => selectSite(f.properties.id, false, true));
      markers.set(f.properties.id, mk);
    });

    // Populate Left Site List
    if (siteListEl) {
      siteListEl.innerHTML = data.sites.features
        .map((f) => {
          const p = f.properties;
          const dist = Spatial.haversineKm(hqLon, hqLat, f.geometry.coordinates[0], f.geometry.coordinates[1]);
          return `
            <button type="button" class="wb-site-item ${p.id === 'hq-nanjing' ? 'active' : ''}" data-wb-site="${p.id}">
              <div>
                <strong>${p.name}</strong>
                <span>${p.city}${dist > 1 ? ` · 直线 ${Math.round(dist)} km` : ' · 浦口总部'}</span>
              </div>
              <i class="wb-dot ${p.category === 'hq' ? 'red' : 'blue'}"></i>
            </button>
          `;
        })
        .join('');

      siteListEl.querySelectorAll('[data-wb-site]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (currentMode !== 'geo') switchScale('geo');
          selectSite(btn.dataset.wbSite, true, true);
        });
      });
    }

    // Draw initial overlays
    drawBuffers(true);
    drawOdCurves();
    updateBufferAnalysis();
    selectSite('hq-nanjing', false, false);

    // Live Telemetry Readout
    map.on('mousemove', (e) => {
      if (currentMode !== 'geo' || !e.lnglat) return;
      const [wLon, wLat] = Spatial.gcj02ToWgs84(e.lnglat.lng, e.lnglat.lat);
      const [mx, my] = Spatial.lonLatTo3857(wLon, wLat);
      if (coordEl) coordEl.textContent = `WGS84: ${wLon.toFixed(4)}°E, ${wLat.toFixed(4)}°N | GCJ02: ${e.lnglat.lng.toFixed(4)}, ${e.lnglat.lat.toFixed(4)}`;
      if (mercEl) mercEl.textContent = `3857: ${Math.round(mx)}m, ${Math.round(my)}m`;
    });

    const syncCameraTelemetry = () => {
      if (currentMode !== 'geo') return;
      if (zoomEl) zoomEl.textContent = `Z ${map.getZoom().toFixed(2)} · 俯仰 ${Math.round(map.getPitch())}°`;
      if (crsEl) crsEl.textContent = 'AMap 2.0 (GCJ-02 ⇄ WGS84)';
    };
    map.on('zoomchange', syncCameraTelemetry);
    map.on('mapmove', syncCameraTelemetry);
    syncCameraTelemetry();

    // Macro Geo (AMap 2.0) <-> Micro Indoor Workshop (Canvas 2D EPSG:Local) Switcher
    function switchScale(mode) {
      currentMode = mode;
      document.querySelectorAll('[data-wb-mode]').forEach((b) => b.classList.toggle('active', b.dataset.wbMode === mode));
      document.getElementById('wb-geo-layers')?.classList.toggle('hidden', mode !== 'geo');
      document.getElementById('wb-indoor-layers')?.classList.toggle('hidden', mode !== 'indoor');

      const geoOnlyControls = document.querySelectorAll('[data-geo-only]');
      geoOnlyControls.forEach((el) => { el.style.display = mode === 'geo' ? '' : 'none'; });

      if (mode === 'indoor') {
        amapContainer.style.display = 'none';
        if (indoorWrap) indoorWrap.style.display = 'block';
        if (!indoorEngine && indoorCanvas && window.WeikenWebGIS) {
          indoorEngine = new window.WeikenWebGIS(indoorCanvas, {
            mode: 'indoor',
            onCursorMove(c) {
              if (currentMode !== 'indoor') return;
              if (coordEl) coordEl.textContent = `厂区米制平面: X ${c.mx.toFixed(2)} m, Y ${c.my.toFixed(2)} m`;
              if (mercEl) mercEl.textContent = `车间尺寸: 28.0m × 16.0m`;
            },
            onCameraChange(cam) {
              if (currentMode !== 'indoor') return;
              if (zoomEl) zoomEl.textContent = `${Math.round(cam.zoom)} px/m`;
              if (crsEl) crsEl.textContent = 'EPSG:Local (厂区米制平面)';
            },
            onSelectFeature(payload) {
              if (payload.mode === 'indoor') renderIndoorInspector(payload.station);
            },
            onMeasureChange(m) {
              if (!measureStatusEl || currentMode !== 'indoor') return;
              measureStatusEl.innerHTML = m.count
                ? `已标定 <strong>${m.count}</strong> 点 · 车间平面测距 <strong class="mono">${m.total.toFixed(2)} m</strong>`
                : '在车间平面图上点击两点以上开始米级测距';
            }
          });
        }
        indoorEngine?.resize();
        indoorEngine?.fitIndoor();
        renderIndoorInspector(data.indoorPlant.stations[1]);
        if (coordEl) coordEl.textContent = '厂区米制平面: X 14.00 m, Y 8.00 m';
        if (mercEl) mercEl.textContent = '车间尺寸: 28.0m × 16.0m';
      } else {
        if (indoorWrap) indoorWrap.style.display = 'none';
        amapContainer.style.display = 'block';
        map.resize();
        syncCameraTelemetry();
        const f = data.sites.features.find((item) => item.properties.id === selectedId);
        if (f) renderGeoInspector(f);
      }
    }

    document.querySelectorAll('[data-wb-mode]').forEach((btn) => {
      btn.addEventListener('click', () => switchScale(btn.dataset.wbMode));
    });

    // Basemap Style Switcher (Whitesmoke / Satellite / Darkblue)
    document.querySelectorAll('[data-amap-style]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = btn.dataset.amapStyle;
        document.querySelectorAll('[data-amap-style]').forEach((b) => b.classList.toggle('active', b === btn));
        if (st === 'satellite') {
          if (!satActive) {
            map.add([satLayer, roadNetLayer]);
            satActive = true;
          }
        } else {
          if (satActive) {
            map.remove([satLayer, roadNetLayer]);
            satActive = false;
          }
          map.setMapStyle(st === 'dark' ? 'amap://styles/darkblue' : 'amap://styles/whitesmoke');
        }
      });
    });

    // 2D / 3D Tilt Toggle
    document.getElementById('wb-toggle-3d')?.addEventListener('click', (e) => {
      is3D = !is3D;
      map.setPitch(is3D ? 44 : 0);
      e.currentTarget.classList.toggle('active', is3D);
      e.currentTarget.textContent = is3D ? '3D 视角' : '2D 平面';
      syncCameraTelemetry();
    });

    // Layer Checkboxes
    document.querySelectorAll('[data-wb-layer]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const name = cb.dataset.wbLayer;
        const on = cb.checked;
        if (name === 'buffers') drawBuffers(on);
        else if (name === 'odFlows') odCurves.forEach((c) => (on ? c.show() : c.hide()));
        else if (name === 'heatmap' && heatmapLayer) (on ? heatmapLayer.show() : heatmapLayer.hide());
        else if (name === 'labels') {
          amapContainer.classList.toggle('hide-pin-labels', !on);
        } else if (indoorEngine) {
          indoorEngine.setLayer(name, on);
        }
      });
    });

    // Buffer Slider
    document.getElementById('wb-buf-slider')?.addEventListener('input', (e) => {
      bufferRadiusKm = Number(e.target.value);
      const bufCb = document.querySelector('[data-wb-layer="buffers"]');
      drawBuffers(!bufCb || bufCb.checked);
      updateBufferAnalysis();
    });

    // Spatial Tools (Pan / Measure Distance / Measure Area)
    function resetTools() {
      rangingTool?.turnOff();
      mouseTool?.close(true);
      indoorEngine?.setTool('pan');
      measureBar?.classList.remove('show');
    }

    document.querySelectorAll('[data-wb-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.wbTool;
        document.querySelectorAll('[data-wb-tool]').forEach((b) => b.classList.toggle('active', b === btn));
        resetTools();
        if (currentMode === 'indoor') {
          if (t === 'measure') {
            indoorEngine?.setTool('measure');
            measureBar?.classList.add('show');
            if (measureStatusEl) measureStatusEl.textContent = '在车间平面图上点击两点以上开始米级测距';
          }
          return;
        }
        if (t === 'measure' && rangingTool) {
          rangingTool.turnOn();
          measureBar?.classList.add('show');
          if (measureStatusEl) measureStatusEl.textContent = '高德测距已开启：左键连续点选标点，双击或右键结束测量';
        } else if (t === 'area' && mouseTool) {
          mouseTool.measureArea({
            strokeColor: '#CC2420',
            fillColor: '#2553C7',
            fillOpacity: 0.16
          });
          measureBar?.classList.add('show');
          if (measureStatusEl) measureStatusEl.textContent = '面积量测已开启：左键绘制多边形区域，双击闭合计算面积';
        }
      });
    });

    document.getElementById('wb-measure-clear')?.addEventListener('click', () => {
      rangingTool?.turnOff();
      mouseTool?.close(true);
      indoorEngine?.clearMeasure();
      const activeToolBtn = document.querySelector('.wb-tool-btn.active[data-wb-tool]');
      const t = activeToolBtn?.dataset.wbTool;
      if (currentMode === 'geo') {
        if (t === 'measure') rangingTool?.turnOn();
        if (t === 'area') mouseTool?.measureArea({ strokeColor: '#CC2420', fillColor: '#2553C7', fillOpacity: 0.16 });
      }
    });

    // Zoom & Reset
    document.getElementById('wb-zin')?.addEventListener('click', () => {
      if (currentMode === 'geo') map.zoomIn(); else indoorEngine?.zoomBy(0.6);
    });
    document.getElementById('wb-zout')?.addEventListener('click', () => {
      if (currentMode === 'geo') map.zoomOut(); else indoorEngine?.zoomBy(-0.6);
    });
    document.getElementById('wb-reset')?.addEventListener('click', () => {
      if (currentMode === 'geo') {
        clearRoute();
        map.setPitch(32);
        map.setRotation(0);
        map.setZoomAndCenter(6.75, Spatial.wgs84ToGcj02(119.8, 30.2), false, 600);
      } else {
        indoorEngine?.fitIndoor();
      }
    });

    // RFC 7946 GeoJSON Modal & Download
    const geoModal = document.getElementById('geojson-modal');
    const geoPre = document.getElementById('geojson-code');
    function buildGeoJSON() {
      const ring = Spatial.geodesicCircleWgs84(hqLon, hqLat, bufferRadiusKm, 72);
      return {
        type: 'FeatureCollection',
        name: 'Weiken_Automation_AMap_WebGIS_Export',
        generatedAt: new Date().toISOString(),
        crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
        features: [
          ...data.sites.features,
          {
            type: 'Feature',
            properties: {
              id: 'buffer-analysis',
              name: `南京浦口总部 ${bufferRadiusKm} km 球面测地响应圈`,
              radiusKm: bufferRadiusKm,
              crsNote: 'Exported in standard WGS84; auto-converted to GCJ-02 for AMap 2.0 display'
            },
            geometry: { type: 'Polygon', coordinates: [ring] }
          }
        ]
      };
    }

    document.getElementById('wb-export-btn')?.addEventListener('click', () => {
      if (geoPre) geoPre.textContent = JSON.stringify(buildGeoJSON(), null, 2);
      geoModal?.classList.add('open');
      geoModal?.setAttribute('aria-hidden', 'false');
    });
    document.getElementById('geojson-close')?.addEventListener('click', () => {
      geoModal?.classList.remove('open');
      geoModal?.setAttribute('aria-hidden', 'true');
    });
    document.getElementById('geojson-download')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(buildGeoJSON(), null, 2)], { type: 'application/geo+json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'weiken-automation-china.geojson';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Expose debug handle for automated QA
    window.__weikenAmap = { map, selectSite, planHighwayRoute, switchScale };
    return true;
  }

  // Boot automatically once DOM + AMap SDK are ready
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof AMap !== 'undefined') {
      initHomeAmap();
      initWorkbenchAmap();
    }
  });
})();
