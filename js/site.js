/* ==========================================================================
   南京崴肯自动化设备科技有限公司 (WE CAN 崴肯)
   Interactive Front-End Engine — v4.0
   Zero external dependencies · Modular Vanilla ES6
   ========================================================================== */

(() => {
  'use strict';

  /* ---------- Toast Utility ---------- */
  let toastEl = null;
  let toastTimer = null;

  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  function copyText(text, successMsg) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        () => showToast(successMsg || '已复制到剪贴板'),
        () => fallbackCopy(text, successMsg)
      );
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || '已复制到剪贴板');
    } catch {
      showToast('复制失败，请手动复制');
    }
    document.body.removeChild(ta);
  }

  /* ---------- 1. Header Scroll State & Progress Bar ---------- */
  const head = document.getElementById('head');
  let progressBar = document.querySelector('.scroll-progress');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    progressBar.setAttribute('aria-hidden', 'true');
    document.body.prepend(progressBar);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY || 0;
      if (head) head.classList.toggle('scrolled', y > 16);
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const pct = maxScroll > 0 ? Math.min(100, (y / maxScroll) * 100) : 0;
      progressBar.style.width = `${pct.toFixed(2)}%`;
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 2. Mobile Navigation Drawer ---------- */
  const menuBtn = document.querySelector('.menu-btn');
  const nav = document.getElementById('nav');
  if (menuBtn && nav) {
    const closeMenu = () => {
      nav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    };
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !menuBtn.contains(e.target)) {
        closeMenu();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) closeMenu();
    });
  }

  /* ---------- 3. Scroll Reveal & KPI Counter ---------- */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.rv');

  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
    // Safety net for elements already in viewport
    setTimeout(() => {
      revealEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 60) el.classList.add('in');
      });
    }, 120);
  }

  const counterEls = document.querySelectorAll('[data-count]');
  if (counterEls.length && !reducedMotion && 'IntersectionObserver' in window) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          if (Number.isNaN(target)) return;
          const startVal = target > 1900 ? target - 18 : 0;
          const duration = 950;
          const t0 = performance.now();
          const step = (now) => {
            const p = Math.min(1, (now - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = String(Math.round(startVal + (target - startVal) * eased));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          cio.unobserve(el);
        });
      },
      { threshold: 0.3 }
    );
    counterEls.forEach((el) => cio.observe(el));
  }

  /* ---------- 4. Interactive 3D CAD Point-Cloud Engine ---------- */
  function buildGeometry(mode) {
    const pts = [];
    if (mode === 'airbag') {
      // DAB Airbag module: folded cushion ring + central inflator cylinder + 4 mounting studs
      for (let i = 0; i < 420; i++) {
        const u = (i / 420) * Math.PI * 2;
        const v = ((i * 29) % 100) / 100 * Math.PI * 2;
        const R = 1.02 + 0.06 * Math.sin(u * 4);
        const r = 0.34;
        const x = (R + r * Math.cos(v)) * Math.cos(u);
        const z = (R + r * Math.cos(v)) * Math.sin(u);
        const y = r * Math.sin(v) * 0.65 - 0.12;
        pts.push({ x, y, z, kind: 'body' });
      }
      // Central inflator steel housing
      for (let i = 0; i < 220; i++) {
        const a = (i / 220) * Math.PI * 2 * 5;
        const h = ((i % 22) / 22) * 0.56 - 0.28;
        const rad = 0.42;
        pts.push({ x: Math.cos(a) * rad, y: h, z: Math.sin(a) * rad, kind: 'core' });
      }
      // 4 mounting bolts / poka-yoke locating pins
      const corners = [[0.78, 0.78], [-0.78, 0.78], [0.78, -0.78], [-0.78, -0.78]];
      corners.forEach(([cx, cz]) => {
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          const h = (k % 6) * 0.07 - 0.42;
          pts.push({ x: cx + Math.cos(a) * 0.09, y: h, z: cz + Math.sin(a) * 0.09, kind: 'datum' });
        }
      });
    } else if (mode === 'buckle') {
      // Seatbelt buckle housing + ultrasonic weld seam contour + latch slot
      for (let i = 0; i < 440; i++) {
        const t = (i % 44) / 43;
        const s = Math.floor(i / 44) / 9;
        const x = (t - 0.5) * 2.2;
        const width = 0.62 - Math.abs(x) * 0.12;
        const side = (i % 2 === 0 ? 1 : -1);
        const y = (s - 0.5) * 0.64;
        const z = side * width;
        pts.push({ x, y, z, kind: 'body' });
      }
      // Top & bottom shell caps
      for (let i = 0; i < 180; i++) {
        const x = ((i % 18) / 17 - 0.5) * 2.1;
        const z = (Math.floor(i / 18) / 9 - 0.5) * (1.18 - Math.abs(x) * 0.22);
        const y = (i % 2 === 0 ? 0.32 : -0.32);
        pts.push({ x, y, z, kind: 'body' });
      }
      // Precision ultrasonic weld seam (highlighted in signal red)
      for (let i = 0; i < 160; i++) {
        const p = (i / 160) * Math.PI * 2;
        const x = Math.cos(p) * 1.12;
        const z = Math.sin(p) * (0.64 - Math.abs(x) * 0.11);
        pts.push({ x, y: 0, z, kind: 'weld' });
      }
    } else {
      // 3D Vision Robotic Pick Datum Calibration Grid + Stepped Part
      for (let gx = -5; gx <= 5; gx++) {
        for (let gz = -5; gz <= 5; gz++) {
          const x = gx * 0.24;
          const z = gz * 0.24;
          const r = Math.hypot(x, z);
          const y = r < 0.62 ? 0.28 : (r < 0.96 ? 0.02 : -0.24);
          pts.push({ x, y, z, kind: r < 0.62 ? 'core' : 'body' });
        }
      }
      // Coordinate axes triad (X, Y, Z)
      for (let k = 1; k <= 26; k++) {
        const d = k * 0.055;
        pts.push({ x: d, y: 0.28, z: 0, kind: 'weld' });
        pts.push({ x: 0, y: 0.28 + d, z: 0, kind: 'datum' });
        pts.push({ x: 0, y: 0.28, z: d, kind: 'core' });
      }
    }
    return pts;
  }

  function initCadStage(stage) {
    const canvas = stage.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ptsEl = stage.querySelector('[data-cad-pts]');
    const scanEl = stage.querySelector('[data-cad-scan]');
    const angleEl = stage.querySelector('[data-cad-angle]');
    const modeBtns = stage.querySelectorAll('.cad-mode-btn');
    const resetBtn = stage.querySelector('.cad-reset');
    const viewport = stage.querySelector('.cad-viewport');

    let mode = stage.dataset.defaultMode || 'airbag';
    let points = buildGeometry(mode);
    let yaw = 0.55;
    let pitch = 0.42;
    let targetYaw = yaw;
    let targetPitch = pitch;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let scanPhase = 0;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function updatePtsCount() {
      if (ptsEl) ptsEl.textContent = String(points.length);
    }
    updatePtsCount();

    function resize() {
      const rect = viewport.getBoundingClientRect();
      width = Math.max(260, rect.width);
      height = Math.max(240, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode || 'airbag';
        points = buildGeometry(mode);
        updatePtsCount();
        modeBtns.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        targetYaw = 0.55;
        targetPitch = 0.42;
      });
    }

    // Pointer orbit interaction
    const onDown = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      viewport.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      targetYaw += dx * 0.0085;
      targetPitch = Math.max(-1.05, Math.min(1.15, targetPitch + dy * 0.0075));
    };
    const onUp = () => { dragging = false; };

    viewport.addEventListener('pointerdown', onDown);
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onUp);

    function drawFrame() {
      if (!dragging && !reducedMotion) {
        targetYaw += 0.0042;
      }
      yaw += (targetYaw - yaw) * 0.12;
      pitch += (targetPitch - pitch) * 0.12;
      scanPhase = (scanPhase + (reducedMotion ? 0 : 0.022)) % (Math.PI * 2);
      const scanX = Math.sin(scanPhase) * 1.25;

      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.51;
      const scale = Math.min(width, height) * 0.34;
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

      // Subtle reference horizon ring
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const rx = Math.cos(a) * 1.48;
        const rz = Math.sin(a) * 1.48;
        const ry = -0.46;
        const x1 = rx * cosY - rz * sinY;
        const z1 = rx * sinY + rz * cosY;
        const y2 = ry * cosP - z1 * sinP;
        const z2 = ry * sinP + z1 * cosP;
        const f = 3.2 / (3.2 + z2);
        const px = cx + x1 * scale * f;
        const py = cy - y2 * scale * f;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(130, 165, 230, 0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Project & depth-sort points
      const projected = new Array(points.length);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y2 = p.y * cosP - z1 * sinP;
        const z2 = p.y * sinP + z1 * cosP;
        const f = 3.2 / (3.2 + z2);
        projected[i] = {
          px: cx + x1 * scale * f,
          py: cy - y2 * scale * f,
          z2,
          f,
          origX: p.x,
          kind: p.kind
        };
      }
      projected.sort((a, b) => b.z2 - a.z2);

      // Draw points
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];
        const nearLaser = Math.abs(pt.origX - scanX) < 0.095;
        const alpha = Math.max(0.22, Math.min(0.98, 0.72 - pt.z2 * 0.22));
        let radius = 1.65 * pt.f;

        if (nearLaser) {
          ctx.fillStyle = `rgba(248, 86, 78, ${Math.min(1, alpha + 0.25)})`;
          radius = 2.5 * pt.f;
        } else if (pt.kind === 'weld') {
          ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
          radius = 2.0 * pt.f;
        } else if (pt.kind === 'datum') {
          ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
          radius = 2.0 * pt.f;
        } else if (pt.kind === 'core') {
          ctx.fillStyle = `rgba(226, 238, 255, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(110, 164, 255, ${alpha * 0.9})`;
        }
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update telemetry text
      if (scanEl) scanEl.textContent = `${scanX >= 0 ? '+' : ''}${(scanX * 100).toFixed(1)} mm`;
      if (angleEl) {
        const degY = Math.round(((yaw * 180) / Math.PI) % 360);
        const degP = Math.round((pitch * 180) / Math.PI);
        angleEl.textContent = `${degY}° / ${degP}°`;
      }

      requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);
  }

  document.querySelectorAll('.cad-stage').forEach(initCadStage);

  /* ---------- 5. Interactive MES Bidirectional Traceability Simulator ---------- */
  const mesData = {
    'WK-DAB-2409-0182': {
      assemblySn: 'ASM-DAB-2409-0182',
      status: 'ok',
      statusLabel: 'PASS · 已入库',
      batch: 'LOT-2409A',
      parts: [
        { name: '气体发生器 (Inflator)', code: 'INF-9921-4082' },
        { name: '主气袋织物 (Cushion)', code: 'BAG-3308-7714' },
        { name: '主壳体/盖板 (Cover)', code: 'COV-1204-5521' },
        { name: '线束插接件 (Harness)', code: 'HRN-5120-0891' }
      ],
      stations: [
        {
          id: 'ST01',
          name: '上料扫码防错',
          short: '物料核验与批次绑定',
          state: 'ok',
          pill: 'PASS',
          desc: '扫码校验各核心零件批次与 BOM 匹配关系，防止错料、漏扫流入下道工序。',
          kv: [
            ['防错互锁', 'BOM 匹配通过'],
            ['扫码绑定', '4 / 4 零件已绑定'],
            ['防重校验', '无重复序列号'],
            ['联网状态', 'MES 实时同步']
          ]
        },
        {
          id: 'ST02',
          name: '气袋热成型',
          short: '三工位并行成型定型',
          state: 'ok',
          pill: 'PASS',
          desc: '三工位并行完成气袋折叠压制与热定型，温压曲线实时上传并关联工件条码。',
          kv: [
            ['运行模式', '三工位并行'],
            ['工艺追溯', '参数绑定工件码'],
            ['安全防护', '安全光栅互锁'],
            ['放行判定', '合格放行']
          ]
        },
        {
          id: 'ST03',
          name: '发生器装配',
          short: '拧紧与防漏装检测',
          state: 'ok',
          pill: 'PASS',
          desc: '发生器与壳体装配，力矩/角度及到位防错校验全部通过后方解锁治具。',
          kv: [
            ['到位检测', '全部传感器 OK'],
            ['防漏装逻辑', '序次强互锁'],
            ['关联发生器', 'INF-9921-4082'],
            ['放行判定', '合格放行']
          ]
        },
        {
          id: 'ST04',
          name: '视觉与导通复检',
          short: '外观识别与电性能检',
          state: 'ok',
          pill: 'PASS',
          desc: '工业视觉核对装配特征与标签清晰度，同步完成导线导通状态检测。',
          kv: [
            ['视觉复检', '特征点全部匹配'],
            ['导线导通', '导通状态 OK'],
            ['图像存档', '关联总成条码'],
            ['放行判定', '合格放行']
          ]
        },
        {
          id: 'ST05',
          name: '总成赋码入库',
          short: '生成总成码建立映射',
          state: 'ok',
          pill: 'PASS',
          desc: '自动打印粘贴总成二维码，在 MES 数据库中完成零件 ⇄ 总成双向树状归档。',
          kv: [
            ['总成条码', 'ASM-DAB-2409-0182'],
            ['正向查询', '零件 → 总成 可查'],
            ['反向溯源', '总成 → 零件 可查'],
            ['最终状态', '合格入库']
          ]
        }
      ]
    },
    'WK-DAB-2409-0183': {
      assemblySn: 'ASM-DAB-2409-0183',
      status: 'ok',
      statusLabel: 'PASS · 已入库',
      batch: 'LOT-2409A',
      parts: [
        { name: '气体发生器 (Inflator)', code: 'INF-9921-4083' },
        { name: '主气袋织物 (Cushion)', code: 'BAG-3308-7715' },
        { name: '主壳体/盖板 (Cover)', code: 'COV-1204-5522' },
        { name: '线束插接件 (Harness)', code: 'HRN-5120-0892' }
      ],
      stations: [
        {
          id: 'ST01',
          name: '上料扫码防错',
          short: '物料核验与批次绑定',
          state: 'ok',
          pill: 'PASS',
          desc: '4 项关键零件条码扫描完成，BOM 规则核验一致，自动开启本件工艺档案。',
          kv: [
            ['防错互锁', 'BOM 匹配通过'],
            ['扫码绑定', '4 / 4 零件已绑定'],
            ['防重校验', '首次上料'],
            ['联网状态', 'MES 实时同步']
          ]
        },
        {
          id: 'ST02',
          name: '气袋热成型',
          short: '三工位并行成型定型',
          state: 'ok',
          pill: 'PASS',
          desc: 'B 工位完成热成型保压工艺，温度、时间、保压状态均在工艺窗口内。',
          kv: [
            ['作业工位', '工位 B'],
            ['工艺追溯', '记录已归档'],
            ['安全防护', '光栅正常'],
            ['放行判定', '合格放行']
          ]
        },
        {
          id: 'ST03',
          name: '发生器装配',
          short: '拧紧与防漏装检测',
          state: 'ok',
          pill: 'PASS',
          desc: '发生器编号与前序上料记录比对一致，装配动作闭环完成。',
          kv: [
            ['到位检测', '全部传感器 OK'],
            ['防漏装逻辑', '校验通过'],
            ['关联发生器', 'INF-9921-4083'],
            ['放行判定', '合格放行']
          ]
        },
        {
          id: 'ST04',
          name: '视觉与导通复检',
          short: '外观识别与电性能检',
          state: 'ok',
          pill: 'PASS',
          desc: '完成关键特征视觉复检及回路导通测试，无异常告警。',
          kv: [
            ['视觉复检', '全部特征 OK'],
            ['导线导通', '导通状态 OK'],
            ['图像存档', '已绑定档案'],
            ['放行判定', '合格放行']
          ]
        },
        {
          id: 'ST05',
          name: '总成赋码入库',
          short: '生成总成码建立映射',
          state: 'ok',
          pill: 'PASS',
          desc: '总成二维码复扫校验通过，支持任意单件反查整包总成，或由总成反查各零件批次。',
          kv: [
            ['总成条码', 'ASM-DAB-2409-0183'],
            ['正向查询', '零件 → 总成 可查'],
            ['反向溯源', '总成 → 零件 可查'],
            ['最终状态', '合格入库']
          ]
        }
      ]
    },
    'WK-DAB-2409-0184': {
      assemblySn: '未赋码（防错拦截）',
      status: 'ng',
      statusLabel: '防错拦截 · ST03',
      batch: 'LOT-2409A',
      parts: [
        { name: '气体发生器 (Inflator)', code: 'INF-9921-4099 (批次不符)' },
        { name: '主气袋织物 (Cushion)', code: 'BAG-3308-7716' },
        { name: '主壳体/盖板 (Cover)', code: 'COV-1204-5523' },
        { name: '线束插接件 (Harness)', code: 'HRN-5120-0893' }
      ],
      stations: [
        {
          id: 'ST01',
          name: '上料扫码防错',
          short: '物料核验与批次绑定',
          state: 'ok',
          pill: 'PASS',
          desc: '基础壳体与气袋织物上料扫码通过，流转至热成型工位。',
          kv: [
            ['防错互锁', '初检通过'],
            ['扫码绑定', '基础件已绑定'],
            ['防重校验', '首次上料'],
            ['联网状态', 'MES 实时同步']
          ]
        },
        {
          id: 'ST02',
          name: '气袋热成型',
          short: '三工位并行成型定型',
          state: 'ok',
          pill: 'PASS',
          desc: '热成型工艺正常完成，转入 ST03 发生器装配。',
          kv: [
            ['作业工位', '工位 C'],
            ['工艺追溯', '记录已归档'],
            ['安全防护', '光栅正常'],
            ['放行判定', '合格放行']
          ]
        },
        {
          id: 'ST03',
          name: '发生器装配',
          short: '触发防错强互锁拦截',
          state: 'ng',
          pill: 'NG 拦截',
          desc: '检测到发生器条码与当前工单 BOM 型号不一致，设备立即声光报警并锁定治具，禁止流入后续工位！',
          kv: [
            ['触发机制', 'BOM 型号防错拦截'],
            ['设备动作', '治具锁止 + 声光告警'],
            ['异常物料', 'INF-9921-4099'],
            ['MES 处理', '标记异常 · 禁止下流']
          ]
        },
        {
          id: 'ST04',
          name: '视觉与导通复检',
          short: '上游拦截 · 自动锁止',
          state: 'hold',
          pill: 'HOLD',
          desc: '由于 ST03 触发防错拦截，本工位扫码识别异常状态后拒绝启动，杜绝不良品混流。',
          kv: [
            ['上游状态', 'ST03 NG 拦截'],
            ['本工位动作', '拒绝加工'],
            ['混流风险', '已隔离'],
            ['解除条件', '返工复检后放行']
          ]
        },
        {
          id: 'ST05',
          name: '总成赋码入库',
          short: '禁止赋码与出货',
          state: 'hold',
          pill: 'HOLD',
          desc: '系统禁止为未通过全流程校验的工件打印总成条码，确保出厂总成 100% 可追溯。',
          kv: [
            ['总成条码', '禁止打印'],
            ['入库许可', '拦截阻止'],
            ['追溯记录', '完整保留异常日志'],
            ['最终状态', '移入隔离区']
          ]
        }
      ]
    }
  };

  document.querySelectorAll('[data-mes-console]').forEach((consoleEl) => {
    let direction = 'forward'; // 'forward' | 'reverse'
    let currentSn = 'WK-DAB-2409-0182';
    let currentStIdx = 0;

    const dirBtns = consoleEl.querySelectorAll('[data-mes-dir]');
    const snBtns = consoleEl.querySelectorAll('[data-mes-sn]');
    const flowEl = consoleEl.querySelector('[data-mes-flow]');
    const detailEl = consoleEl.querySelector('[data-mes-detail]');

    function render() {
      const record = mesData[currentSn];
      if (!record || !flowEl || !detailEl) return;

      const list = direction === 'forward'
        ? record.stations.map((s, idx) => ({ s, idx }))
        : record.stations.map((s, idx) => ({ s, idx })).reverse();

      flowEl.innerHTML = list
        .map(({ s, idx }) => {
          const isActive = idx === currentStIdx;
          const cls = [
            'station-node',
            isActive ? 'active' : '',
            s.state === 'ng' ? 'blocked' : '',
            s.state === 'hold' ? 'skipped' : ''
          ].filter(Boolean).join(' ');
          const pillCls = s.state === 'ok' ? 'ok' : (s.state === 'ng' ? 'ng' : 'hold');
          return `
            <button type="button" class="${cls}" data-st-idx="${idx}">
              <div class="st-head">
                <span>${s.id}</span>
                <span class="st-pill ${pillCls}">${s.pill}</span>
              </div>
              <h4>${s.name}</h4>
              <p>${s.short}</p>
            </button>
          `;
        })
        .join('');

      flowEl.querySelectorAll('[data-st-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentStIdx = Number(btn.dataset.stIdx);
          render();
        });
      });

      const st = record.stations[currentStIdx];
      const pillCls = st.state === 'ok' ? 'ok' : (st.state === 'ng' ? 'ng' : 'hold');
      const dirLabel = direction === 'forward'
        ? '正向追溯：零件条码 → 工序记录 → 总成条码'
        : '反向溯源：总成条码 → 工序记录 → 零件批次';

      detailEl.innerHTML = `
        <div>
          <h4>
            <span>${st.id} · ${st.name}</span>
            <span class="st-pill ${pillCls}">${st.pill}</span>
          </h4>
          <p class="mes-detail-desc">${st.desc}</p>
          <div class="mes-kv-grid">
            ${st.kv.map(([k, v]) => `<div class="mes-kv"><span>${k}</span><strong>${v}</strong></div>`).join('')}
          </div>
        </div>
        <div class="mes-genealogy">
          <div class="mes-genealogy-head">
            <span>${dirLabel}</span>
            <span>${record.batch}</span>
          </div>
          <div class="genealogy-list">
            <div class="genealogy-row">
              <span>总成唯一码</span>
              <code>${record.assemblySn}</code>
            </div>
            ${record.parts.map((p) => `
              <div class="genealogy-row">
                <span>${p.name}</span>
                <code>${p.code}</code>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    dirBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        direction = btn.dataset.mesDir;
        dirBtns.forEach((b) => b.classList.toggle('active', b === btn));
        currentStIdx = direction === 'forward' ? 0 : 4;
        render();
      });
    });

    snBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        currentSn = btn.dataset.mesSn;
        snBtns.forEach((b) => b.classList.toggle('active', b === btn));
        currentStIdx = currentSn === 'WK-DAB-2409-0184' ? 2 : (direction === 'forward' ? 0 : 4);
        render();
      });
    });

    render();
  });

  /* ---------- 6. Case Filter & Enhanced Lightbox ---------- */
  const filterBtns = document.querySelectorAll('.filter-btn[data-f]');
  const caseCards = document.querySelectorAll('.case-card[data-cat]');
  const filterCountEl = document.getElementById('case-count');

  if (filterBtns.length && caseCards.length) {
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.f;
        filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        let shown = 0;
        caseCards.forEach((card) => {
          const match = cat === 'all' || card.dataset.cat === cat;
          card.classList.toggle('hidden', !match);
          if (match) shown++;
        });
        if (filterCountEl) filterCountEl.textContent = String(shown);
      });
    });
  }

  const lightbox = document.getElementById('lightbox');
  const zoomTriggers = Array.from(document.querySelectorAll('[data-zoom]'));
  if (lightbox && zoomTriggers.length) {
    const lbImg = lightbox.querySelector('img');
    const lbTitle = lightbox.querySelector('[data-lb-title]');
    const lbDesc = lightbox.querySelector('[data-lb-desc]');
    const lbIdx = lightbox.querySelector('[data-lb-idx]');
    const lbClose = lightbox.querySelector('[data-lb-close]');
    const lbPrev = lightbox.querySelector('[data-lb-prev]');
    const lbNext = lightbox.querySelector('[data-lb-next]');
    let activeIdx = 0;

    function openAt(idx) {
      activeIdx = (idx + zoomTriggers.length) % zoomTriggers.length;
      const t = zoomTriggers[activeIdx];
      lbImg.src = t.dataset.zoom;
      lbImg.alt = t.dataset.alt || '';
      if (lbTitle) lbTitle.textContent = t.dataset.alt || '';
      if (lbDesc) lbDesc.textContent = t.dataset.desc || '';
      if (lbIdx) lbIdx.textContent = `${String(activeIdx + 1).padStart(2, '0')} / ${String(zoomTriggers.length).padStart(2, '0')}`;
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeLb() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    zoomTriggers.forEach((t, i) => t.addEventListener('click', () => openAt(i)));
    lbClose?.addEventListener('click', closeLb);
    lbPrev?.addEventListener('click', () => openAt(activeIdx - 1));
    lbNext?.addEventListener('click', () => openAt(activeIdx + 1));
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLb(); });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') openAt(activeIdx - 1);
      if (e.key === 'ArrowRight') openAt(activeIdx + 1);
    });
  }

  /* ---------- 7. Copy Buttons & Contact Demand Brief Workbench ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyText(btn.dataset.copy, btn.dataset.copyMsg || '已复制到剪贴板');
    });
  });

  const needForm = document.getElementById('need-form');
  const briefPreviewEl = document.getElementById('brief-preview-text');
  const copyBriefBtn = document.getElementById('copy-brief-btn');

  if (needForm) {
    const buildSummary = () => {
      const fd = new FormData(needForm);
      const name = (fd.get('name') || '').toString().trim() || '（待填写）';
      const company = (fd.get('company') || '').toString().trim() || '（未填写）';
      const tel = (fd.get('tel') || '').toString().trim() || '（待填写）';
      const type = (fd.get('type') || '').toString().trim();
      const msg = (fd.get('msg') || '').toString().trim() || '（可填写工件类型、节拍要求、防错与追溯需求等）';
      return [
        '【项目咨询单 · 南京崴肯自动化】',
        `需求类型：${type}`,
        `联 系 人：${name}`,
        `所属公司：${company}`,
        `联系电话：${tel}`,
        '--------------------------------',
        '需求描述：',
        msg
      ].join('\n');
    };

    const updatePreview = () => {
      if (briefPreviewEl) briefPreviewEl.textContent = buildSummary();
    };

    needForm.addEventListener('input', updatePreview);
    needForm.addEventListener('change', updatePreview);
    updatePreview();

    if (copyBriefBtn) {
      copyBriefBtn.addEventListener('click', () => {
        copyText(buildSummary(), '需求摘要已复制，可直接粘贴至微信或邮件');
      });
    }

    needForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(needForm);
      const type = (fd.get('type') || '').toString().trim();
      const company = (fd.get('company') || '').toString().trim();
      const subject = `【设备咨询】${type}${company ? ' - ' + company : ''}`;
      const body = buildSummary();
      window.location.href = `mailto:yang.yunfeng@njwe-can.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      showToast('正在打开系统邮件客户端…');
    });
  }
})();
