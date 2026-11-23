/* ==========================================================================
   南京崴肯自动化 · WebGIS 空间数据集 (RFC 7946 GeoJSON)
   坐标系：宏观地理视图 WGS84 (EPSG:4326) -> Web Mercator (EPSG:3857)
           微观车间视图 厂区局部平面坐标系 (EPSG:Local, 单位: m)
   ========================================================================== */

window.WEIKEN_GIS_DATA = (() => {
  'use strict';

  // 1. 长三角省级行政轮廓（真实经纬度简化矢量 GeoJSON，用于精密矢量底图与离线秒开）
  const boundaries = {
    type: 'FeatureCollection',
    name: 'YRD_Admin_Boundaries',
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
    features: [
      {
        type: 'Feature',
        properties: { code: '320000', name: '江苏省', en: 'Jiangsu' },
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
        properties: { code: '340000', name: '安徽省', en: 'Anhui' },
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
        properties: { code: '330000', name: '浙江省', en: 'Zhejiang' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [118.92, 30.12], [119.52, 30.62], [119.92, 31.18], [120.35, 30.88],
            [120.92, 31.12], [121.25, 30.68], [120.95, 30.28], [121.65, 30.15],
            [122.15, 29.82], [121.95, 29.15], [121.25, 28.65], [119.85, 28.72],
            [118.65, 29.12], [118.45, 29.68], [118.92, 30.12]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { code: '310000', name: '上海市', en: 'Shanghai' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [121.15, 31.48], [121.85, 31.82], [121.96, 31.12], [121.82, 30.86],
            [121.25, 30.68], [120.92, 31.12], [121.15, 31.48]
          ]]
        }
      }
    ]
  };

  // 2. 长江主干与太湖水系矢量
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

  // 3. 崴肯自动化核心空间节点（真实总部 + 真实客户基地 + 长三角汽车产业协同参考节点）
  const sites = {
    type: 'FeatureCollection',
    name: 'Weiken_Service_Network',
    features: [
      {
        type: 'Feature',
        properties: {
          id: 'hq-nanjing',
          name: '南京崴肯自动化总部',
          mapLabel: '南京总部 · WE CAN',
          labelPos: 'top',
          city: '江苏 · 南京',
          category: 'hq',
          catLabel: '研发与制造总部',
          verified: true,
          summary: '成立于 2019 年 8 月，注册资本 200 万元，30 余人研发与工程交付团队，辐射长三角汽车安全件产业集群。',
          equipment: ['DAB 安全气囊整线研发', '三工位热成型专机', '3D 视觉与机器人集成实验室'],
          responseHours: '0 h（工程中心）',
          heatWeight: 1.0,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [118.7969, 32.0603] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-wuhu',
          name: '芜湖金安世腾项目基地',
          mapLabel: '芜湖金安世腾',
          labelPos: 'right',
          city: '安徽 · 芜湖',
          category: 'airbag',
          catLabel: '已合作客户 · 安全气囊/安全带',
          verified: true,
          summary: '汽车被动安全核心零部件合作伙伴。针对安全气囊与安全带产线防错、在线检测与追溯需求提供非标自动化交付。',
          equipment: ['DAB 安全气囊生产线', 'DAB 气袋热成型设备', '整线联网双向追溯架构'],
          responseHours: '约 1.5 h（高频工程响应圈）',
          heatWeight: 0.95,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [118.4329, 31.3529] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'client-jinheng',
          name: '江苏锦恒合作项目基地',
          mapLabel: '江苏锦恒',
          labelPos: 'top',
          city: '江苏 · 苏州张家港（长三角）',
          category: 'belt',
          catLabel: '已合作客户 · 汽车安全系统',
          verified: true,
          summary: '汽车安全系统领域重要合作伙伴，面向安全带锁扣超声波焊接、插入力/打开力与导线导通在线检测提供定制设备支持。',
          equipment: ['安全带超声波焊接机集成应用', '插入力/打开力在线检测', '导线导通检测工位'],
          responseHours: '约 2.5 h（核心协同圈）',
          heatWeight: 0.92,
          indoorLinked: true
        },
        geometry: { type: 'Point', coordinates: [120.5558, 31.8754] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'hub-hefei',
          name: '合肥新能源汽车零部件集群',
          mapLabel: '合肥集群',
          labelPos: 'bottom',
          city: '安徽 · 合肥',
          category: 'cluster',
          catLabel: '长三角汽车产业辐射圈（参考）',
          verified: false,
          summary: '距离南京总部约 145 km，2 小时工程响应圈内重点新能源整车及安全件配套集群。',
          equipment: ['产线工艺诊断改善', '3D 视觉上下料方案'],
          responseHours: '约 2.0 h',
          heatWeight: 0.65,
          indoorLinked: false
        },
        geometry: { type: 'Point', coordinates: [117.2272, 31.8206] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'hub-changzhou',
          name: '常州汽车电子与安全件集群',
          mapLabel: '常州集群',
          labelPos: 'bottom',
          city: '江苏 · 常州',
          category: 'cluster',
          catLabel: '长三角汽车产业辐射圈（参考）',
          verified: false,
          summary: '沪宁产业带重要节点，1.5 小时车程覆盖，适配高节拍非标自动化改造与视觉集成。',
          equipment: ['非标自动化专机', '既有产线效率提升'],
          responseHours: '约 1.5 h',
          heatWeight: 0.72,
          indoorLinked: false
        },
        geometry: { type: 'Point', coordinates: [119.9741, 31.8112] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'hub-shanghai',
          name: '上海嘉定汽车城协同节点',
          mapLabel: '上海嘉定',
          labelPos: 'right',
          city: '上海 · 嘉定',
          category: 'cluster',
          catLabel: '长三角汽车产业辐射圈（参考）',
          verified: false,
          summary: '长三角汽车研发与 Tier-1 总部集聚区，支持前期工艺咨询、方案评审与试验设备定制。',
          equipment: ['安全件在线试验设备', '工艺咨询与方案打样'],
          responseHours: '约 3.2 h',
          heatWeight: 0.7,
          indoorLinked: false
        },
        geometry: { type: 'Point', coordinates: [121.2655, 31.3747] }
      },
      {
        type: 'Feature',
        properties: {
          id: 'hub-hangzhou',
          name: '杭州湾汽车制造协同节点',
          mapLabel: '杭州湾',
          labelPos: 'right',
          city: '浙江 · 杭州',
          category: 'cluster',
          catLabel: '长三角汽车产业辐射圈（参考）',
          verified: false,
          summary: '面向浙北汽车零部件工厂提供非标自动化产线与防错追溯升级服务。',
          equipment: ['整线联网与防错升级', '机器人系统集成'],
          responseHours: '约 3.0 h',
          heatWeight: 0.58,
          indoorLinked: false
        },
        geometry: { type: 'Point', coordinates: [120.1551, 30.2741] }
      }
    ]
  };

  // 4. 微观车间平面空间 GIS 数据（EPSG:Local 平面坐标系，单位：米 m，区域 28m x 16m）
  const indoorPlant = {
    name: 'DAB_Airbag_Workshop_Indoor_GIS',
    crs: 'EPSG:Local (Metric Floorplan, m)',
    width: 28,
    height: 16,
    stations: [
      {
        id: 'ST01',
        name: 'ST01 上料扫码防错区',
        zone: '上料防错',
        status: 'ok',
        load: 0.82,
        coords: [[2.0, 3.2], [6.2, 3.2], [6.2, 7.6], [2.0, 7.6]],
        center: [4.1, 5.4],
        sensors: '双工业扫码枪 · 物料 BOM 防错校验',
        cycle: '节拍均衡 · 整线联网正常',
        geofence: '安全光栅 A1'
      },
      {
        id: 'ST02',
        name: 'ST02 三工位气袋热成型区',
        zone: '热成型专机',
        status: 'ok',
        load: 0.94,
        coords: [[7.2, 3.2], [12.4, 3.2], [12.4, 7.6], [7.2, 7.6]],
        center: [9.8, 5.4],
        sensors: '三工位并行热压 · 温压闭环采集',
        cycle: '三工位并行 · 效率显著提升',
        geofence: '三面黄色安全光栅 A2'
      },
      {
        id: 'ST03',
        name: 'ST03 发生器装配与防错互锁',
        zone: '核心装配',
        status: 'warn',
        load: 0.88,
        coords: [[13.4, 3.2], [18.2, 3.2], [18.2, 7.6], [13.4, 7.6]],
        center: [15.8, 5.4],
        sensors: '力矩/角度伺服拧紧 · 序次防错强互锁',
        cycle: '支持异常批次即时锁止拦截',
        geofence: '双手启动 + 光栅互锁 A3'
      },
      {
        id: 'ST04',
        name: 'ST04 3D 视觉复检与导通测试',
        zone: '视觉/电测',
        status: 'ok',
        load: 0.78,
        coords: [[19.2, 3.2], [23.4, 3.2], [23.4, 7.6], [19.2, 7.6]],
        center: [21.3, 5.4],
        sensors: '3D 视觉定位复检 · 导线导通检测',
        cycle: '图像与测试数据绑定工件码',
        geofence: '封闭光学防护罩 A4'
      },
      {
        id: 'ST05',
        name: 'ST05 MES 总成赋码与下料区',
        zone: '追溯归档',
        status: 'ok',
        load: 0.75,
        coords: [[19.2, 9.6], [25.6, 9.6], [25.6, 13.4], [19.2, 13.4]],
        center: [22.4, 11.5],
        sensors: '工业标签打印复扫 · 零件⇄总成映射',
        cycle: '100% 双向可追溯放行入库',
        geofence: '成品出口感应区 A5'
      },
      {
        id: 'BELT01',
        name: '安全带锁扣超声焊接集成岛',
        zone: '安全带专机',
        status: 'ok',
        load: 0.85,
        coords: [[2.0, 9.6], [10.4, 9.6], [10.4, 13.4], [2.0, 13.4]],
        center: [6.2, 11.5],
        sensors: '自动超声波焊接 · 插入力/打开力/导通检测',
        cycle: '多检测工序一体化节拍集成',
        geofence: '声学防护 + 安全门锁 B1'
      },
      {
        id: 'MES-SRV',
        name: '整线 PLC / MES 边缘控制柜',
        zone: '联网中枢',
        status: 'ok',
        load: 0.65,
        coords: [[12.0, 10.2], [17.4, 10.2], [17.4, 13.4], [12.0, 13.4]],
        center: [14.7, 11.8],
        sensors: '整线工业以太网交换机 · 实时数据库同步',
        cycle: '低延迟防错互锁与谱系归档',
        geofence: '电控安全区 C1'
      }
    ],
    // 产线输送与 AGV 拓扑路径
    flowPath: [
      [4.1, 5.4], [9.8, 5.4], [15.8, 5.4], [21.3, 5.4],
      [24.5, 5.4], [24.5, 11.5], [22.4, 11.5]
    ],
    agvPath: [
      [1.2, 8.6], [11.2, 8.6], [18.6, 8.6], [26.6, 8.6], [26.6, 14.5], [1.2, 14.5], [1.2, 8.6]
    ],
    geofences: [
      [[1.5, 2.7], [24.0, 2.7], [24.0, 8.1], [1.5, 8.1], [1.5, 2.7]],
      [[1.5, 9.1], [10.9, 9.1], [10.9, 13.9], [1.5, 13.9], [1.5, 9.1]]
    ]
  };

  return { boundaries, hydro, sites, indoorPlant };
})();
