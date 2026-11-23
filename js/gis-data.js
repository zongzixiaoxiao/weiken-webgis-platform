/* ==========================================================================
   南京崴肯自动化设备科技有限公司 (Nanjing We-Can Automation Tech. Co., Ltd.)
   WebGIS 空间数据集 (RFC 7946 GeoJSON) — v5.0 全量真实客户与产线数据版
   总部坐标：南京市浦口区步月路133号江苏可成科技园A幢1楼 (118.6186°E, 32.0942°N)
   ========================================================================== */

window.WEIKEN_GIS_DATA = (() => {
  'use strict';

  // 1. 华东-东南省级行政轮廓（苏、皖、浙、沪、闽真实经纬度矢量 GeoJSON）
  const boundaries = {
    type: 'FeatureCollection',
    name: 'East_Southeast_China_Admin',
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
    features: [
      {
        type: 'Feature',
        properties: { code: '320000', name: '江苏省' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [116.38, 34.45], [117.15, 34.95], [118.25, 34.62], [119.22, 35.08],
            [119.85, 34.48], [120.38, 33.78], [120.92, 32.85], [121.85, 31.82],
            [121.15, 31.48], [120.92, 31.12], [120.35, 30.88], [119.92, 31.18],
            [119.35, 31.22], [118.92, 31.55], [118.52, 31.28], [118.35, 31.95],
            [118.58, 32.52], [118.18, 33.05], [118.02, 33.68], [117.45, 34.05],
            [116.38, 34.45]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { code: '340000', name: '安徽省' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [115.65, 33.85], [116.38, 34.45], [117.45, 34.05], [118.02, 33.68],
            [118.18, 33.05], [118.58, 32.52], [118.35, 31.95], [118.52, 31.28],
            [118.92, 31.55], [119.35, 31.22], [119.52, 30.62], [118.92, 30.12],
            [118.45, 29.68], [117.65, 29.75], [116.82, 29.95], [116.12, 30.32],
            [115.62, 31.12], [115.48, 32.15], [115.18, 33.05], [115.65, 33.85]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { code: '330000', name: '浙江省' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [118.92, 30.12], [119.52, 30.62], [119.92, 31.18], [120.35, 30.88],
            [120.92, 31.12], [121.25, 30.68], [120.95, 30.28], [121.65, 30.15],
            [122.15, 29.82], [121.95, 29.15], [121.55, 28.45], [120.72, 27.32],
            [119.65, 27.45], [118.75, 28.15], [118.15, 28.88], [118.45, 29.68],
            [118.92, 30.12]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { code: '310000', name: '上海市' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [121.15, 31.48], [121.85, 31.82], [121.96, 31.12], [121.82, 30.86],
            [121.25, 30.68], [120.92, 31.12], [121.15, 31.48]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { code: '350000', name: '福建省' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [118.15, 28.18], [119.65, 27.45], [120.42, 27.15], [120.08, 26.25],
            [119.58, 25.45], [118.85, 24.75], [117.75, 23.75], [116.85, 23.85],
            [116.12, 25.12], [116.45, 26.45], [117.25, 27.65], [118.15, 28.18]
          ]]
        }
      }
    ]
  };

  // 2. 长江主干与太湖、巢湖水系
  const hydro = {
    type: 'FeatureCollection',
    name: 'Yangtze_Hydrology',
    features: [
      {
        type: 'Feature',
        properties: { name: '长江主干', kind: 'river' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [116.65, 29.95], [117.08, 30.52], [117.78, 30.94], [118.36, 31.34],
            [118.48, 31.68], [118.74, 32.06], [119.12, 32.22], [119.48, 32.24],
            [119.95, 32.02], [120.42, 31.94], [120.88, 31.88], [121.42, 31.46],
            [121.95, 31.28]
          ]
        }
      },
      {
        type: 'Feature',
        properties: { name: '太湖', kind: 'lake' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [119.95, 31.42], [120.28, 31.52], [120.48, 31.35], [120.45, 31.02],
            [120.15, 30.94], [119.92, 31.12], [119.95, 31.42]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { name: '巢湖', kind: 'lake' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [117.32, 31.68], [117.65, 31.68], [117.78, 31.55], [117.55, 31.44],
            [117.28, 31.52], [117.32, 31.68]
          ]]
        }
      }
    ]
  };

  // 3. 100% 真实客户与总部空间节点（源自公司正式简介资料）
  const sites = {
    type: 'FeatureCollection',
    name: 'Weiken_Verified_Client_Network',
    features: [
      {
        type: 'Feature',
        properties: {
          id: 'hq-nanjing',
          name: '南京崴肯自动化总部',
          mapLabel: '南京浦口总部 · WE CAN',
          labelPos: 'top',
          city: '江苏 · 南京市浦口区',
          address: '南京市浦口区步月路133号江苏可成科技园A幢1楼',
          category: 'hq',
          catLabel: '研发制造总部 · 国家高新技术企业',
          verified: true,
          summary: '2019年8月成立，2022年获国家级高新技术企业认证（GR202232018123），拥有20余项专利（含3项发明专利）与3项软著，熟悉 TS16949 体系。',
          equipment: ['DAB/PAB/SAB/CAB/KAB 安全气囊线', 'R200.2/R200RP 安全带线与试验机', '方向盘装配线与 3D 视觉集成'],
          responseHours: '0 h（浦口研发制造中心）',
          heatWeight: 1.0,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [118.6186, 32.0942] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-wuhu',
          name: '芜湖金安世腾',
          mapLabel: '芜湖金安世腾',
          labelPos: 'left',
          city: '安徽 · 芜湖',
          category: 'airbag',
          catLabel: '已交付客户 · 气囊 / 安全带',
          verified: true,
          summary: '汽车安全气囊与安全带非标自动化核心合作伙伴，交付整线装配、热成型、车带感角度检测与防错追溯设备。',
          equipment: ['安全气囊装配生产线', '安全带生产与试验设备', '整线联网双向追溯系统'],
          responseHours: '约 1.5 h',
          heatWeight: 0.96,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [118.4329, 31.3529] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-famous',
          name: '江苏菲姆斯 (FAMOUS)',
          mapLabel: '江苏菲姆斯',
          labelPos: 'bottom',
          city: '江苏 · 镇江丹阳 / 常州',
          category: 'airbag',
          catLabel: '已交付客户 · 安全气囊产线与模具',
          verified: true,
          summary: '提供安全气囊装配线、热成型模具及防错工装定制交付，支持多型号气囊柔性化混线生产。',
          equipment: ['安全气囊装配生产线', 'DAB 气袋热成型与专机模具'],
          responseHours: '约 1.5 h',
          heatWeight: 0.88,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [119.5750, 31.9950] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-jinheng',
          name: '江苏锦恒 (JIN HENG)',
          mapLabel: '江苏锦恒',
          labelPos: 'top',
          city: '江苏 · 张家港',
          category: 'airbag',
          catLabel: '已交付客户 · 安全气囊设备与工装',
          verified: true,
          summary: '汽车安全气囊设备与专用工装夹具重要合作客户，面向高节拍安全件产线提供稳定可靠的非标装备。',
          equipment: ['安全气囊生产专用设备', '产线工装与防错夹具'],
          responseHours: '约 2.5 h',
          heatWeight: 0.92,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [120.5558, 31.8754] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-mochengrui',
          name: '默成瑞安全系统 (MC)',
          mapLabel: '默成瑞安全系统',
          labelPos: 'right',
          city: '浙江 · 嘉兴 / 长三角',
          category: 'steering',
          catLabel: '已交付客户 · 气囊 / 安全带 / 方向盘',
          verified: true,
          summary: '覆盖汽车被动安全全系产线合作：安全气囊、安全带及方向盘装配生产线（ST10~ST60 条码追溯与电性能检测）。',
          equipment: ['安全气囊与安全带设备', '方向盘装配生产线 (SW Assembly Line)'],
          responseHours: '约 3.0 h',
          heatWeight: 0.88,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [120.7555, 30.7461] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-songyuan',
          name: '浙江松原 (SONGYUAN)',
          mapLabel: '浙江松原',
          labelPos: 'left',
          city: '浙江 · 宁波余姚',
          category: 'belt',
          catLabel: '已交付客户 · 安全带 / 安全气囊',
          verified: true,
          summary: '国内知名汽车被动安全系统企业，合作交付安全带卷收器、锁扣生产线、试验机及安全气囊非标自动化设备。',
          equipment: ['安全带产线与疲劳试验设备', '安全气囊生产与检测专机'],
          responseHours: '约 3.5 h',
          heatWeight: 0.95,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [121.1544, 30.0434] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-hualixing',
          name: '宁波华力兴',
          mapLabel: '宁波华力兴',
          labelPos: 'right',
          city: '浙江 · 宁波',
          category: 'belt',
          catLabel: '已交付客户 · 钢丝绳压铆设备',
          verified: true,
          summary: '交付四工位转盘钢丝绳压铆机，集成压力-位移实时监控曲线、100% 在线预拉伸测试与视觉尺寸到位检测。',
          equipment: ['四工位转盘钢丝绳压铆机', '压力-位移监控与视觉 OK/NG 分拣'],
          responseHours: '约 3.8 h',
          heatWeight: 0.85,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [121.5503, 29.8746] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-tiening',
          name: '浙江铁凝 / 浙江可正',
          mapLabel: '浙江铁凝 / 可正',
          labelPos: 'right',
          city: '浙江 · 台州',
          category: 'steering',
          catLabel: '已交付客户 · 气囊 / 方向盘产线',
          verified: true,
          summary: '交付安全气囊与方向盘装配生产线，覆盖卡簧/按键/下护罩装配、按键电检、总检及过程数据存储防错。',
          equipment: ['安全气囊装配线', '方向盘装配生产线 (ST10~ST60)'],
          responseHours: '约 4.5 h',
          heatWeight: 0.82,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [121.4208, 28.6564] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-quanzhou',
          name: '泉州国胜',
          mapLabel: '泉州国胜',
          labelPos: 'right',
          city: '福建 · 泉州',
          category: 'belt',
          catLabel: '已交付客户 · 安全带生产设备',
          verified: true,
          summary: '跨省交付至福建汽车零部件制造基地，提供安全带总成生产与检测非标自动化设备及远程/现场工程服务。',
          equipment: ['安全带生产专用设备', '在线性能检测与自动防错工装'],
          responseHours: '跨省专程工程支持',
          heatWeight: 0.78,
          indoorLinked: false
        },
        geometry: { type: 'Point', coordinates: [118.6757, 24.8741] }
      }
    ]
  };

  // 4. 微观车间平面空间 GIS 数据（基于真实倍速链气囊线、锁扣线、压铆转盘与方向盘线布局示意）
  const indoorPlant = {
    name: 'Weiken_Automotive_Safety_Workshop_Indoor_GIS',
    crs: 'EPSG:Local (Metric Floorplan, m)',
    width: 28,
    height: 16,
    stations: [
      {
        id: 'ST40',
        name: 'ST40 人工上件与视觉初检',
        zone: '气囊倍速链',
        status: 'ok',
        load: 0.84,
        coords: [[2.0, 2.8], [6.4, 2.8], [6.4, 7.2], [2.0, 7.2]],
        center: [4.2, 5.0],
        sensors: '条码扫码防错 · 视觉相机核验零件齐全与方向',
        cycle: 'DAB/PAB/KAB 柔性兼容 · MES 实时联网',
        geofence: '安全光栅 A1'
      },
      {
        id: 'ST50',
        name: 'ST50 三工位热成型 & 双枪自动拧紧',
        zone: '热成型/拧紧',
        status: 'ok',
        load: 0.94,
        coords: [[7.3, 2.8], [12.6, 2.8], [12.6, 7.2], [7.3, 7.2]],
        center: [9.95, 5.0],
        sensors: '气袋热压 75mm→48mm · 发明专利螺母双枪自动拧紧',
        cycle: '三工位并行 · 力矩/角度数据自动存盘',
        geofence: '三面安全光栅 A2'
      },
      {
        id: 'ST60',
        name: 'ST60 机器人电性能 & 喇叭按压力检测',
        zone: '视觉/电测',
        status: 'warn',
        load: 0.89,
        coords: [[13.5, 2.8], [18.5, 2.8], [18.5, 7.2], [13.5, 7.2]],
        center: [16.0, 5.0],
        sensors: '视觉引导机器人电性能检测 · 喇叭按压力检测',
        cycle: '异常自动防错锁止 · 禁止流入包装工位',
        geofence: '机器人封闭防护栏 A3'
      },
      {
        id: 'ST70',
        name: 'ST70 自动下料 · 总成/箱码双向追溯',
        zone: '下料追溯',
        status: 'ok',
        load: 0.78,
        coords: [[19.4, 2.8], [24.2, 2.8], [24.2, 7.2], [19.4, 7.2]],
        center: [21.8, 5.0],
        sensors: '自动打印总成条码与包装箱码 · 零件⇄总成双向追溯',
        cycle: '100% 合格放行至下料输送线',
        geofence: '成品出口光栅 A4'
      },
      {
        id: 'BUCKLE',
        name: '安全带锁扣倍速链 & 钢丝绳压铆岛',
        zone: '锁扣/压铆',
        status: 'ok',
        load: 0.86,
        coords: [[2.0, 9.6], [10.0, 9.6], [10.0, 13.6], [2.0, 13.6]],
        center: [6.0, 11.6],
        sensors: '超声焊接/拧紧 · 压力-位移曲线 · 100%预拉伸 · 激光打标',
        cycle: '插入力/开启力/导通检测 + OK/NG 自动分拣',
        geofence: '安全门锁与声学罩 B1'
      },
      {
        id: 'G-TEST',
        name: '安全带车带感角度检测一体机',
        zone: 'G值/角度检',
        status: 'ok',
        load: 0.82,
        coords: [[11.0, 9.6], [17.4, 9.6], [17.4, 13.6], [11.0, 13.6]],
        center: [14.2, 11.6],
        sensors: '车感0.45g / 带感0.8g-2.0g / 角度12°-27° / 噪音检测',
        cycle: '整体节拍 13-15s · 符合 GB14166-2013',
        geofence: '测试防护舱 C1'
      },
      {
        id: 'SW-LINE',
        name: '方向盘装配线 (ST10~ST60 · 10m)',
        zone: '方向盘产线',
        status: 'ok',
        load: 0.76,
        coords: [[18.4, 9.6], [26.0, 9.6], [26.0, 13.6], [18.4, 13.6]],
        center: [22.2, 11.6],
        sensors: '卡簧/按键/下护罩装配 · 按键电检 · 拧紧力矩存储',
        cycle: '全流程条码防错与总检包装',
        geofence: '工位光电防护 D1'
      }
    ],
    flowPath: [
      [4.2, 5.0], [9.95, 5.0], [16.0, 5.0], [21.8, 5.0], [25.6, 5.0]
    ],
    agvPath: [
      [1.2, 8.4], [10.5, 8.4], [18.0, 8.4], [26.8, 8.4], [26.8, 14.6], [1.2, 14.6], [1.2, 8.4]
    ],
    geofences: [
      [[1.5, 2.3], [24.8, 2.3], [24.8, 7.7], [1.5, 7.7], [1.5, 2.3]],
      [[1.5, 9.1], [10.5, 9.1], [10.5, 14.1], [1.5, 14.1], [1.5, 9.1]]
    ]
  };

  return { boundaries, hydro, sites, indoorPlant };
})();
